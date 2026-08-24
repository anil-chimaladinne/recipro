import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSessionEvents } from '@/lib/state-machine';
import { getDb } from '@/lib/db';

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
    const session = db.prepare(`SELECT teacher_id, learner_id FROM sessions WHERE id = ?`).get(sessionId) as any;
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.teacher_id !== user.userId && session.learner_id !== user.userId && user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
      return NextResponse.json({ error: 'Unauthorized to view events for this session' }, { status: 403 });
    }

    const events = getSessionEvents(sessionId);
    return NextResponse.json({ events });
  } catch (err: any) {
    console.error('Fetch Session Events Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve session events', details: err.message }, { status: 500 });
  }
}
