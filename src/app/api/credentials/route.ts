import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('userId') || user.userId;

  const credentials = db.prepare(`
    SELECT c.*, s.name as skill_name, s.category as skill_category, s.icon as skill_icon
    FROM credentials c
    LEFT JOIN skills s ON c.skill_id = s.id
    WHERE c.user_id = ? AND c.is_revoked = 0
    ORDER BY c.issued_at DESC
  `).all(targetUserId);

  return NextResponse.json({ credentials });
}
