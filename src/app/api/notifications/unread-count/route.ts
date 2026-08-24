import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { NotificationService } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const unreadCount = NotificationService.getUnreadCount(db, user.userId);
    return NextResponse.json({ unreadCount });
  } catch (err: any) {
    console.error('Fetch Unread Count Error:', err);
    return NextResponse.json({ unreadCount: 0 });
  }
}
