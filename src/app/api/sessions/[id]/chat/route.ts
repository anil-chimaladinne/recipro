import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getSessionChatHistory, sendSessionChatMessage } from '@/lib/video-session';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();
  const sessionId = params.id;

  try {
    const chatData = getSessionChatHistory(db, sessionId, user.userId);
    if (!chatData.authorized) {
      return NextResponse.json({ error: chatData.error || 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ messages: chatData.messages });
  } catch (err: any) {
    console.error('Fetch session chat error:', err);
    return NextResponse.json({ error: 'Failed to retrieve session chat' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();
  const sessionId = params.id;

  try {
    const body = await req.json();
    const rawMessage = body.message;

    if (!rawMessage || typeof rawMessage !== 'string') {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    const sendResult = sendSessionChatMessage(db, sessionId, user.userId, rawMessage);
    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || 'Failed to send message' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: sendResult.message,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Send session chat message error:', err);
    return NextResponse.json({ error: 'Failed to send chat message' }, { status: 500 });
  }
}
