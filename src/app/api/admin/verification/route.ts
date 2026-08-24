import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { notifyLearnersOfNewMentor } from '@/lib/skill-gap';

export async function GET(req: NextRequest) {
  const authRes = requireRole(req, ['MODERATOR', 'ADMIN']);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const db = getDb();

  // Fetch all user skills with verification details
  const pendingSkills = db.prepare(`
    SELECT 
      us.*,
      s.name as skill_name, s.category as skill_category,
      p.display_name, p.college, p.major, p.year,
      u.email, u.campus_id,
      r.bayesian_rating, r.total_sessions_taught
    FROM user_skills us
    JOIN skills s ON us.skill_id = s.id
    JOIN users u ON us.user_id = u.id
    JOIN profiles p ON us.user_id = p.user_id
    LEFT JOIN reputations r ON us.user_id = r.user_id
    ORDER BY 
      CASE WHEN us.verification_status = 'SELF_DECLARED' THEN 1
           WHEN us.verification_status = 'ASSESSMENT_VERIFIED' THEN 2
           ELSE 3 END,
      us.created_at DESC
  `).all();

  const recentAssessments = db.prepare(`
    SELECT 
      sa.*,
      s.name as skill_name,
      p.display_name, p.college
    FROM skill_assessments sa
    JOIN skills s ON sa.skill_id = s.id
    JOIN profiles p ON sa.user_id = p.user_id
    ORDER BY sa.created_at DESC
    LIMIT 20
  `).all();

  return NextResponse.json({
    skills: pendingSkills,
    assessments: recentAssessments,
  });
}

export async function POST(req: NextRequest) {
  const authRes = requireRole(req, ['MODERATOR', 'ADMIN']);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const body = await req.json();
    const { userId, skillId, action, notes } = body; // action: 'APPROVE_PLATFORM_VERIFIED' | 'REQUEST_REASSESSMENT' | 'REJECT'

    if (!userId || !skillId || !action) {
      return NextResponse.json({ error: 'Missing userId, skillId, or action' }, { status: 400 });
    }

    const skill = db.prepare('SELECT name FROM skills WHERE id = ?').get(skillId) as { name: string } | undefined;
    const skillName = skill ? skill.name : 'Skill';

    let newStatus = 'SELF_DECLARED';
    let notifTitle = '';
    let notifMsg = '';

    if (action === 'APPROVE_PLATFORM_VERIFIED') {
      newStatus = 'PLATFORM_VERIFIED';
      notifTitle = `Skill Verified: ${skillName}`;
      notifMsg = `Congratulations! Your teaching proficiency in "${skillName}" has been officially Platform Verified by campus administrators.`;
    } else if (action === 'REQUEST_REASSESSMENT') {
      newStatus = 'VERIFICATION_FAILED';
      notifTitle = `Reassessment Requested: ${skillName}`;
      notifMsg = `Administrator note on your ${skillName} skill: ${notes || 'Please retake the skill assessment to demonstrate current proficiency.'}`;
    } else {
      newStatus = 'SELF_DECLARED';
      notifTitle = `Skill Review: ${skillName}`;
      notifMsg = `Administrator note: ${notes || 'Skill claim marked as self-declared.'}`;
    }

    db.prepare(`
      UPDATE user_skills
      SET 
        verification_status = ?,
        verified_at = CURRENT_TIMESTAMP,
        verified_by = ?,
        reassessment_required = CASE WHEN ? = 'VERIFICATION_FAILED' THEN 1 ELSE 0 END
      WHERE user_id = ? AND skill_id = ?
    `).run(newStatus, user.userId, newStatus, userId, skillId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, new_state)
      VALUES (?, ?, ?, 'USER_SKILL', ?, ?)
    `).run(`audit-${Date.now()}`, user.userId, action, `${userId}:${skillId}`, newStatus);

    // Notification
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link)
      VALUES (?, ?, ?, ?, 'CREDENTIAL_ISSUED', '/profile')
    `).run(`notif-${Date.now()}`, userId, notifTitle, notifMsg);

    if (newStatus === 'PLATFORM_VERIFIED') {
      notifyLearnersOfNewMentor(userId, skillId);
    }

    return NextResponse.json({
      success: true,
      message: `Skill status updated to ${newStatus}`,
      status: newStatus,
    });
  } catch (err: any) {
    console.error('Admin Verification Action Error:', err);
    return NextResponse.json({ error: 'Failed to process verification action' }, { status: 500 });
  }
}
