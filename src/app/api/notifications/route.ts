import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { NotificationService } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();
  const { searchParams } = new URL(req.url);

  const category = searchParams.get('category') || 'ALL';
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '15', 10);

  try {
    const result = NotificationService.getUserNotifications(db, user.userId, {
      category,
      unreadOnly,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Fetch Notifications Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve notifications', details: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const body = await req.json();
    const { recipientUserId, type, title, message, actionUrl, relatedEntityType, relatedEntityId } = body;

    // Only Admin can create notifications for arbitrary users; regular users can trigger through system actions
    if (recipientUserId !== user.userId && user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
      return NextResponse.json({ error: 'Unauthorized to send arbitrary notifications' }, { status: 403 });
    }

    const result = await NotificationService.send(db, {
      userId: recipientUserId || user.userId,
      type: type || 'SYSTEM_NOTIFICATION',
      title,
      message,
      actionUrl,
      relatedEntityType,
      relatedEntityId,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Create Notification Error:', err);
    return NextResponse.json({ error: 'Failed to create notification', details: err.message }, { status: 500 });
  }
}
