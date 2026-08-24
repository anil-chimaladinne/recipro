import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { NotificationService } from '@/lib/notifications';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();
  const notificationId = params.id;

  try {
    const success = NotificationService.markAsRead(db, notificationId, user.userId);
    if (!success) {
      return NextResponse.json({ error: 'Notification not found or unauthorized' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Marked as read' });
  } catch (err: any) {
    console.error('Mark Notification Read Error:', err);
    return NextResponse.json({ error: 'Failed to update notification', details: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return PATCH(req, { params });
}
