import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getLearningRequestDetail } from '@/lib/learning-requests';
import { reserveEscrowCredits, recordSessionEvent } from '@/lib/state-machine';
import { NotificationService } from '@/lib/notifications';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();
  const requestId = params.id;

  try {
    const body = await req.json().catch(() => ({}));
    const { scheduledStart, scheduledEnd, mentorId: reqMentorId } = body;

    const request = getLearningRequestDetail(db, requestId);
    if (!request) {
      return NextResponse.json({ error: 'Learning request not found' }, { status: 404 });
    }

    if (request.learnerId !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized to accept matches for this request' }, { status: 403 });
    }

    const mentorId = reqMentorId || request.matchedMentor?.userId;
    if (!mentorId) {
      return NextResponse.json({ error: 'No matched mentor specified' }, { status: 400 });
    }

    // Default scheduled time if not provided: tomorrow during preferred window
    const now = new Date();
    const defaultDate = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
    const sStart = scheduledStart || `${defaultDate}T${request.preferredTimeStart || '18:00'}:00.000Z`;
    const sEnd = scheduledEnd || `${defaultDate}T${request.preferredTimeEnd || '19:00'}:00.000Z`;

    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const idempotencyKey = `book-${sessionId}`;

    const tx = db.transaction(() => {
      // 1. Create Session
      db.prepare(`
        INSERT INTO sessions (
          id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, mode, location_or_url, idempotency_key, notes
        ) VALUES (?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?, 1, 'ONLINE', ?, ?, ?)
      `).run(
        sessionId,
        `Learn ${request.skillName}`,
        request.skillId,
        mentorId,
        user.userId,
        sStart,
        sEnd,
        request.durationHours || 1.0,
        `https://meet.skillswap.internal/room/${sessionId}`,
        idempotencyKey,
        `Created from Learning Request ${requestId}`
      );

      // 1b. Session Participants
      db.prepare(`
        INSERT OR IGNORE INTO session_participants (id, session_id, user_id, session_role, confirmed)
        VALUES (?, ?, ?, 'TRAINER', 0), (?, ?, ?, 'LEARNER', 0)
      `).run(
        `sp-${sessionId}-trainer`,
        sessionId,
        mentorId,
        `sp-${sessionId}-learner`,
        sessionId,
        user.userId
      );

      // 2. Reserve Escrow Credits
      const escrowRes = reserveEscrowCredits(user.userId, 1, sessionId, idempotencyKey);
      if (!escrowRes.success) {
        throw new Error(escrowRes.message);
      }

      // 3. Update Learning Request Status
      db.prepare(`
        UPDATE learning_requests 
        SET status = 'SESSION_REQUESTED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(requestId);

      // 4. Log Event
      recordSessionEvent(
        sessionId,
        user.userId,
        'REQUESTED',
        'Session Requested from Matched Mentor',
        `Learner confirmed match with mentor for ${request.skillName}. 1 credit reserved in escrow.`,
        undefined,
        'REQUESTED'
      );

      db.prepare(`
        INSERT INTO learning_request_events (id, request_id, event_type, title, description, created_at)
        VALUES (?, ?, 'SESSION_REQUESTED', 'Session Request Submitted', ?, CURRENT_TIMESTAMP)
      `).run(
        `ev-${requestId}-sess-${Date.now()}`,
        requestId,
        `Submitted session booking request to ${request.matchedMentor?.displayName || 'Mentor'}.`
      );

      // 5. Notify Mentor
      NotificationService.send(db, {
        userId: mentorId,
        type: 'SESSION_REQUESTED',
        title: 'New Session Request from Matched Learner',
        message: `${user.email} confirmed your match and requested a 1-on-1 session for ${request.skillName}.`,
        relatedEntityType: 'SESSION',
        relatedEntityId: sessionId,
        actionUrl: `/sessions/${sessionId}`,
      });
    });

    tx();

    return NextResponse.json({
      success: true,
      message: 'Session booking request created successfully!',
      sessionId,
      redirectUrl: `/sessions/${sessionId}`,
    });
  } catch (err: any) {
    console.error('Accept match error:', err);
    return NextResponse.json({ error: err.message || 'Failed to accept mentor match' }, { status: 400 });
  }
}
