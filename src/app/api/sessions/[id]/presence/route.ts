import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const sessionId = params.id;
  const db = getDb();

  try {
    const presence = db.prepare(`
      SELECT 
        p.user_id, p.display_name, p.role, p.camera_on, p.mic_on, p.screen_sharing, p.status, p.last_ping,
        pr.avatar
      FROM session_room_presence p
      LEFT JOIN profiles pr ON p.user_id = pr.user_id
      WHERE p.session_id = ?
    `).all(sessionId);

    return NextResponse.json({ presence });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch presence' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const sessionId = params.id;
  const db = getDb();

  try {
    const body = await req.json();
    const { cameraOn, micOn, screenSharing, status } = body;

    const session = db.prepare(`
      SELECT s.*, tp.display_name as teacher_name, lp.display_name as learner_name
      FROM sessions s
      LEFT JOIN profiles tp ON s.teacher_id = tp.user_id
      LEFT JOIN profiles lp ON s.learner_id = lp.user_id
      WHERE s.id = ?
    `).get(sessionId) as any;

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const isTeacher = session.teacher_id === user.userId;
    const role = isTeacher ? 'TRAINER' : 'LEARNER';
    const displayName = isTeacher ? (session.teacher_name || 'Mentor') : (session.learner_name || 'Learner');

    db.prepare(`
      INSERT INTO session_room_presence (
        id, session_id, user_id, display_name, role, camera_on, mic_on, screen_sharing, status, last_ping
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(session_id, user_id) DO UPDATE SET
        display_name = excluded.display_name,
        role = excluded.role,
        camera_on = COALESCE(excluded.camera_on, session_room_presence.camera_on),
        mic_on = COALESCE(excluded.mic_on, session_room_presence.mic_on),
        screen_sharing = COALESCE(excluded.screen_sharing, session_room_presence.screen_sharing),
        status = COALESCE(excluded.status, session_room_presence.status),
        last_ping = CURRENT_TIMESTAMP
    `).run(
      `pres-${sessionId}-${user.userId}`,
      sessionId,
      user.userId,
      displayName,
      role,
      cameraOn !== undefined ? (cameraOn ? 1 : 0) : 1,
      micOn !== undefined ? (micOn ? 1 : 0) : 1,
      screenSharing !== undefined ? (screenSharing ? 1 : 0) : 0,
      status || 'CONNECTED'
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
  }
}
