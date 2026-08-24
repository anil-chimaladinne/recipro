import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calculateRequiredCredits } from '@/lib/state-machine';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const sessionId = params.id;
  const db = getDb();

  try {
    const session = db.prepare(`
      SELECT 
        s.*,
        sk.name as skill_name, sk.category as skill_category, sk.icon as skill_icon,
        COALESCE(tp.display_name, 'Teacher') as teacher_name, tp.avatar as teacher_avatar, tp.college as teacher_college,
        COALESCE(lp.display_name, 'Learner') as learner_name, lp.avatar as learner_avatar, lp.college as learner_college
      FROM sessions s
      JOIN skills sk ON s.skill_id = sk.id
      JOIN profiles tp ON s.teacher_id = tp.user_id
      JOIN profiles lp ON s.learner_id = lp.user_id
      WHERE s.id = ?
    `).get(sessionId) as any;

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const isTeacher = session.teacher_id === user.userId;
    const isLearner = session.learner_id === user.userId;
    const userRoleInSession: 'MENTOR' | 'LEARNER' | 'VIEWER' = isTeacher ? 'MENTOR' : isLearner ? 'LEARNER' : 'VIEWER';

    // Fetch existing exchange agreement
    const agreement = db.prepare(`
      SELECT 
        sea.*,
        sk_taught.name as taught_skill_name,
        sk_return.name as return_skill_catalog_name,
        mp.display_name as mentor_name,
        lp.display_name as learner_name
      FROM session_exchange_agreements sea
      JOIN skills sk_taught ON sea.taught_skill_id = sk_taught.id
      LEFT JOIN skills sk_return ON sea.requested_return_skill_id = sk_return.id
      JOIN profiles mp ON sea.mentor_id = mp.user_id
      JOIN profiles lp ON sea.learner_id = lp.user_id
      WHERE sea.session_id = ?
    `).get(sessionId) as any;

    // Fetch mentor's registered teaching skills
    const mentorSkills = db.prepare(`
      SELECT us.skill_id, sk.name as skill_name, us.proficiency, us.verification_status
      FROM user_skills us
      JOIN skills sk ON us.skill_id = sk.id
      WHERE us.user_id = ?
    `).all(session.teacher_id);

    // Fetch learner's verified teaching skills
    const learnerSkills = db.prepare(`
      SELECT us.skill_id, sk.name as skill_name, us.proficiency, us.verification_status
      FROM user_skills us
      JOIN skills sk ON us.skill_id = sk.id
      WHERE us.user_id = ?
    `).all(session.learner_id);

    // Fetch all active skills in catalog for suggestion
    const allCatalogSkills = db.prepare(`
      SELECT id, name, category, icon FROM skills ORDER BY name ASC
    `).all();

    // Fetch learner's current credit balance
    const learnerAccount = db.prepare(`
      SELECT balance, escrow_balance FROM skill_credit_accounts WHERE user_id = ?
    `).get(session.learner_id) as any;

    const requiredCredits = agreement?.credit_amount || calculateRequiredCredits(session.duration_hours);
    const learnerAvailableBalance = learnerAccount?.balance || 0;

    // Determine if learner has the requested return skill
    let learnerCanTeachRequestedSkill = false;
    if (agreement?.requested_return_skill_name) {
      const reqName = agreement.requested_return_skill_name.toLowerCase();
      learnerCanTeachRequestedSkill = Boolean(
        learnerSkills.some((s: any) => 
          s.skill_name.toLowerCase() === reqName || 
          s.skill_name.toLowerCase().includes(reqName) ||
          reqName.includes(s.skill_name.toLowerCase())
        )
      );
    }

    // Determine if session is start-ready
    const isDirectExchange = !agreement || agreement.return_type === 'SKILL' || (agreement.status && agreement.status !== 'CANCELLED');
    const isAgreementAccepted = agreement?.status === 'ACCEPTED';
    const canStartSession = session.status !== 'CANCELLED' && session.status !== 'DISPUTED' && (!isDirectExchange || isAgreementAccepted);

    let sessionStartGateMessage = 'Exchange agreement confirmed. Session ready to start.';
    if (session.status === 'CANCELLED') {
      sessionStartGateMessage = 'Session has been cancelled.';
    } else if (session.status === 'DISPUTED') {
      sessionStartGateMessage = 'Session is under moderator dispute review.';
    } else if (isDirectExchange && !isAgreementAccepted) {
      sessionStartGateMessage = agreement?.status === 'PROPOSED'
        ? 'Return skill proposed. Waiting for learner confirmation before session can start.'
        : agreement?.status === 'REJECTED'
        ? 'Return skill rejected by learner. Mentor must specify another return skill.'
        : 'Return skill not specified yet. Mentor must define return skill before session can begin.';
    }

    return NextResponse.json({
      session,
      agreement: agreement || null,
      userRoleInSession,
      mentorSkills,
      learnerSkills,
      allCatalogSkills,
      learnerCanTeachRequestedSkill,
      learnerAvailableBalance,
      requiredCredits,
      canStartSession,
      sessionStartGateMessage,
    });
  } catch (err: any) {
    console.error('Fetch Exchange Details Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve exchange details', details: err.message }, { status: 500 });
  }
}
