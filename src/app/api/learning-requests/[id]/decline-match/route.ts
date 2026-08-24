import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getLearningRequestDetail } from '@/lib/learning-requests';

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
    const { cancelRequest } = body;

    const request = getLearningRequestDetail(db, requestId);
    if (!request) {
      return NextResponse.json({ error: 'Learning request not found' }, { status: 404 });
    }

    if (request.learnerId !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (cancelRequest) {
      db.prepare(`UPDATE learning_requests SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(requestId);
      db.prepare(`
        INSERT INTO learning_request_events (id, request_id, event_type, title, description, created_at)
        VALUES (?, ?, 'REQUEST_CANCELLED', 'Request Cancelled by Learner', 'Learner chose to cancel the request.', CURRENT_TIMESTAMP)
      `).run(`ev-${requestId}-decl-${Date.now()}`, requestId);

      return NextResponse.json({
        success: true,
        status: 'CANCELLED',
        message: 'Learning request has been cancelled.',
      });
    } else {
      // Keep request active and searching
      db.prepare(`UPDATE learning_requests SET status = 'OPEN', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(requestId);
      db.prepare(`
        INSERT INTO learning_request_events (id, request_id, event_type, title, description, created_at)
        VALUES (?, ?, 'MATCH_DECLINED', 'Match Declined — Kept In Search Queue', 'Learner declined the matched mentor. Continuing search for alternative mentors.', CURRENT_TIMESTAMP)
      `).run(`ev-${requestId}-decl-${Date.now()}`, requestId);

      return NextResponse.json({
        success: true,
        status: 'OPEN',
        message: "Understood. We'll keep looking for suitable mentors.",
      });
    }
  } catch (err: any) {
    console.error('Decline match error:', err);
    return NextResponse.json({ error: 'Failed to process request', details: err.message }, { status: 500 });
  }
}
