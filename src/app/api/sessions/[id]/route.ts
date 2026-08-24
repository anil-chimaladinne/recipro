import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getSessionEvents, canTransition, SessionState } from '@/lib/state-machine';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();
  const sessionId = params.id;

  try {
    const session = db.prepare(`
      SELECT 
        s.*,
        sk.name as skill_name, sk.category as skill_category, sk.icon as skill_icon,
        tp.display_name as teacher_name, tp.avatar as teacher_avatar, tp.college as teacher_college, tp.major as teacher_major,
        lp.display_name as learner_name, lp.avatar as learner_avatar, lp.college as learner_college, lp.major as learner_major,
        tu.email as teacher_email, lu.email as learner_email,
        tus.verification_status as teacher_verification_status,
        sea.id as agreement_id,
        sea.status as agreement_status,
        sea.return_type as agreement_return_type,
        sea.requested_return_skill_name,
        sea.credit_amount as agreement_credit_amount,
        sea.proposed_by as agreement_proposed_by,
        d.id as dispute_id, d.reason as dispute_reason, d.status as dispute_status
      FROM sessions s
      LEFT JOIN skills sk ON s.skill_id = sk.id
      LEFT JOIN profiles tp ON s.teacher_id = tp.user_id
      LEFT JOIN profiles lp ON s.learner_id = lp.user_id
      LEFT JOIN users tu ON s.teacher_id = tu.id
      LEFT JOIN users lu ON s.learner_id = lu.id
      LEFT JOIN user_skills tus ON s.teacher_id = tus.user_id AND s.skill_id = tus.skill_id
      LEFT JOIN session_exchange_agreements sea ON s.id = sea.session_id
      LEFT JOIN disputes d ON s.id = d.session_id
      WHERE s.id = ?
    `).get(sessionId) as any;

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const isTeacher = session.teacher_id === user.userId;
    const isLearner = session.learner_id === user.userId;
    const isPrivileged = user.role === 'MODERATOR' || user.role === 'ADMIN';

    if (!isTeacher && !isLearner && !isPrivileged) {
      return NextResponse.json({ error: 'Unauthorized to view this session' }, { status: 403 });
    }

    const callerRole: 'TEACHER' | 'LEARNER' | 'ADMIN' = isPrivileged
      ? 'ADMIN'
      : isTeacher
      ? 'TEACHER'
      : 'LEARNER';

    // Fetch persistent lifecycle events
    let events = getSessionEvents(sessionId);

    // If no events recorded yet (for legacy sessions), generate synthetic baseline events
    if (events.length === 0) {
      events = [
        {
          id: `ev-init-${session.id}`,
          session_id: session.id,
          actor_id: session.learner_id,
          actor_name: session.learner_name,
          event_type: 'REQUESTED',
          title: 'Session Requested',
          description: `Session booking requested for ${session.skill_name || 'Skill'}.`,
          previous_state: null,
          new_state: 'REQUESTED',
          created_at: session.created_at,
        }
      ];

      if (session.status !== 'REQUESTED') {
        events.push({
          id: `ev-accepted-${session.id}`,
          session_id: session.id,
          actor_id: session.teacher_id,
          actor_name: session.teacher_name,
          event_type: 'ACCEPTED',
          title: 'Session Accepted',
          description: `Mentor accepted the session.`,
          previous_state: 'REQUESTED',
          new_state: 'ACCEPTED',
          created_at: session.updated_at || session.created_at,
        });
      }

      if (session.status === 'COMPLETED' || session.status === 'CREDIT_SETTLED') {
        events.push({
          id: `ev-completed-${session.id}`,
          session_id: session.id,
          actor_id: session.teacher_id,
          actor_name: 'Campus Escrow Engine',
          event_type: 'CREDITS_SETTLED',
          title: 'Session Completed & Credits Settled',
          description: `1 Skill Credit transferred from learner to mentor.`,
          previous_state: 'IN_PROGRESS',
          new_state: 'CREDIT_SETTLED',
          created_at: session.updated_at,
        });
      }
    }

    // Determine authorized actions for caller
    const currentState = session.status as SessionState;
    const authorizedActions: string[] = [];

    if (currentState === 'REQUESTED') {
      if (isTeacher || isPrivileged) {
        authorizedActions.push('ACCEPT', 'REJECT');
      }
      if (isLearner || isPrivileged) {
        authorizedActions.push('CANCEL');
      }
    } else if (currentState === 'ACCEPTED' || currentState === 'SCHEDULED') {
      if (session.agreement_status === 'PROPOSED' && isLearner) {
        authorizedActions.push('CONFIRM_RETURN_AGREEMENT', 'REJECT_RETURN_AGREEMENT');
      }
      if (isTeacher) {
        authorizedActions.push('SET_RETURN_SKILL');
      }
      authorizedActions.push('START_SESSION', 'JOIN_SESSION', 'CANCEL');
    } else if (currentState === 'IN_PROGRESS') {
      authorizedActions.push('JOIN_SESSION', 'CONFIRM_COMPLETION', 'DISPUTE');
    } else if (currentState === 'PENDING_CONFIRMATION') {
      authorizedActions.push('CONFIRM_COMPLETION', 'DISPUTE');
    } else if (currentState === 'COMPLETED' || currentState === 'CREDIT_SETTLED') {
      authorizedActions.push('RATE_SESSION', 'DISPUTE');
    }

    // Determine Credit Status
    let creditStatus = 'RESERVED';
    if (session.status === 'CREDIT_SETTLED' || session.status === 'COMPLETED') {
      creditStatus = 'SETTLED';
    } else if (session.status === 'CANCELLED') {
      creditStatus = 'REFUNDED';
    } else if (session.status === 'DISPUTED') {
      creditStatus = 'FROZEN_IN_DISPUTE';
    }

    // Fetch existing ratings for this session
    const userRating = db.prepare(`
      SELECT r.*, p.display_name as rater_name
      FROM ratings r
      LEFT JOIN profiles p ON r.rater_id = p.user_id
      WHERE r.session_id = ? AND r.rater_id = ?
    `).get(sessionId, user.userId) as any;

    const peerRating = db.prepare(`
      SELECT r.*, p.display_name as rater_name
      FROM ratings r
      LEFT JOIN profiles p ON r.rater_id = p.user_id
      WHERE r.session_id = ? AND r.rater_id != ?
    `).get(sessionId, user.userId) as any;

    return NextResponse.json({
      session: {
        ...session,
        credit_status: creditStatus,
      },
      userRating: userRating || null,
      peerRating: peerRating || null,
      hasRated: Boolean(userRating),
      events,
      callerRole,
      authorizedActions,
    });
  } catch (err: any) {
    console.error('Fetch Session Detail Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve session detail', details: err.message }, { status: 500 });
  }
}
