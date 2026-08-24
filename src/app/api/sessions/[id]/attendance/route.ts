import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { authorizeSessionParticipant, recordAttendanceEvent } from '@/lib/video-session';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();
  const sessionId = params.id;

  try {
    const authResult = authorizeSessionParticipant(db, sessionId, user.userId);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error || 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const eventType = body.eventType; // 'JOINED', 'LEFT', 'RECONNECTED', 'MUTED', 'UNMUTED', 'VIDEO_ON', 'VIDEO_OFF', etc.

    if (!eventType) {
      return NextResponse.json({ error: 'Event type is required' }, { status: 400 });
    }

    recordAttendanceEvent(db, sessionId, user.userId, eventType, body.metadata);

    return NextResponse.json({ success: true, eventType });
  } catch (err: any) {
    console.error('Record attendance event error:', err);
    return NextResponse.json({ error: 'Failed to record attendance event' }, { status: 500 });
  }
}
