import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { NotificationService } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const updatedCount = NotificationService.markAllAsRead(db, user.userId);
    return NextResponse.json({ success: true, updatedCount });
  } catch (err: any) {
    console.error('Mark All Notifications Read Error:', err);
    return NextResponse.json({ error: 'Failed to update notifications', details: err.message }, { status: 500 });
  }
}
