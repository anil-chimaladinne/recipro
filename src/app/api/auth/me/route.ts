import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) {
    return NextResponse.json({ user: null, authenticated: false }, { status: 200 });
  }

  const { user } = authRes;
  const db = getDb();

  const fullUser = db.prepare(`
    SELECT 
      u.id, u.email, u.role, u.status, u.campus_id, COALESCE(u.user_type, 'TEACHER_LEARNER') as user_type,
      COALESCE(u.email_verified, 0) as email_verified, COALESCE(u.is_academic_email, 0) as is_academic_email,
      p.display_name, p.avatar, p.bio, p.college, p.major, p.year,
      p.is_verified_student, p.trust_score, p.completion_rate, p.cancellation_rate,
      p.hourly_rate_credits, p.teaching_style, p.languages, p.profile_visibility,
      COALESCE(p.teaching_preference, 'Anyone') as teaching_preference,
      p.portfolio_url, COALESCE(p.daily_session_limit, 3) as daily_session_limit,
      acc.balance, acc.escrow_balance, acc.lifetime_earned, acc.lifetime_spent,
      r.bayesian_rating, r.total_reviews, r.total_sessions_taught, r.total_sessions_learned, r.reliability_score,
      w.address as wallet_address, w.is_verified as wallet_verified
    FROM users u
    JOIN profiles p ON u.id = p.user_id
    LEFT JOIN skill_credit_accounts acc ON u.id = acc.user_id
    LEFT JOIN reputations r ON u.id = r.user_id
    LEFT JOIN wallets w ON u.id = w.user_id
    WHERE u.id = ?
  `).get(user.userId) as any;

  if (!fullUser) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  }

  // Fetch teaching skills
  const skills = db.prepare(`
    SELECT us.*, s.name as skill_name, s.category as skill_category, s.icon
    FROM user_skills us
    JOIN skills s ON us.skill_id = s.id
    WHERE us.user_id = ?
  `).all(user.userId);

  // Fetch learning goals
  const goals = db.prepare(`
    SELECT lg.*, s.name as skill_name, s.category as skill_category
    FROM learning_goals lg
    JOIN skills s ON lg.skill_id = s.id
    WHERE lg.user_id = ?
  `).all(user.userId);

  // Fetch availability slots count
  const slotsCount = (db.prepare(`
    SELECT COUNT(*) as count FROM availability_slots WHERE user_id = ?
  `).get(user.userId) as any).count;

  // Calculate Profile Completion Checklist
  const checklist = [
    { label: 'Basic Information', completed: Boolean(fullUser.display_name && fullUser.college && fullUser.major) },
    { label: 'Bio & Languages', completed: Boolean(fullUser.bio && fullUser.languages) },
    { label: 'Teaching Skills Added', completed: (skills as any[]).length > 0 },
    { label: 'Learning Goals Defined', completed: (goals as any[]).length > 0 },
    { label: 'Weekly Availability Schedule', completed: slotsCount > 0 },
    { label: 'Teaching Preference Set', completed: Boolean(fullUser.teaching_preference) },
    { label: 'Skill Verification Completed', completed: (skills as any[]).some(s => s.verification_status === 'PLATFORM_VERIFIED' || s.verification_status === 'ASSESSMENT_VERIFIED') },
  ];

  const completedCount = checklist.filter(c => c.completed).length;
  const completionPercentage = Math.round((completedCount / checklist.length) * 100);

  // Fetch unread notifications count
  const unreadNotifs = (db.prepare(`
    SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
  `).get(user.userId) as any).count;

  return NextResponse.json({
    user: {
      ...fullUser,
      is_verified_student: Boolean(fullUser.is_verified_student),
      skills,
      goals,
      profileCompletion: {
        percentage: completionPercentage,
        checklist,
      },
      unreadNotificationsCount: unreadNotifs,
    }
  });
}
