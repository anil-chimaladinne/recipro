import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { getSkillDemandAnalytics, findPotentialMentorsForSkill } from '@/lib/skill-gap';

export async function GET(req: NextRequest) {
  const authRes = requireRole(req, ['MODERATOR', 'ADMIN']);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { searchParams } = new URL(req.url);
  const skillName = searchParams.get('skill');

  const demand = getSkillDemandAnalytics();
  let potentialMentors: any[] = [];
  if (skillName) {
    potentialMentors = findPotentialMentorsForSkill(skillName);
  }

  return NextResponse.json({
    demand,
    skillName,
    potentialMentors,
  });
}

export async function POST(req: NextRequest) {
  const authRes = requireRole(req, ['MODERATOR', 'ADMIN']);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const body = await req.json();
    const { targetUserId, requestedSkillName, reason } = body;

    if (!targetUserId || !requestedSkillName) {
      return NextResponse.json({ error: 'Missing targetUserId or requestedSkillName' }, { status: 400 });
    }

    const targetProfile = db.prepare('SELECT display_name FROM profiles WHERE user_id = ?').get(targetUserId) as { display_name: string } | undefined;

    // Send high-priority mentor invitation notification
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link)
      VALUES (?, ?, ?, ?, 'INFO', '/profile')
    `).run(
      `notif-${Date.now()}`,
      targetUserId,
      `Campus Invitation: Teach "${requestedSkillName}"!`,
      `Students at your campus have high demand for "${requestedSkillName}". Based on your related coursework & expertise, campus moderators invite you to take a quick skill assessment to become a verified mentor and earn Skill Credits!`
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, new_state)
      VALUES (?, ?, 'INVITE_POTENTIAL_MENTOR', 'USER', ?, ?)
    `).run(`audit-${Date.now()}`, user.userId, targetUserId, requestedSkillName);

    return NextResponse.json({
      success: true,
      message: `Invitation successfully sent to ${targetProfile?.display_name || 'student'} for skill "${requestedSkillName}"!`,
    });
  } catch (err: any) {
    console.error('Admin Demand Action Error:', err);
    return NextResponse.json({ error: 'Failed to send mentor invitation' }, { status: 500 });
  }
}
