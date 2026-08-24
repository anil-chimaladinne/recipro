import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getUserActivityReport, logAdminAction } from '@/lib/admin-reporting';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRes = requireAdmin(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const targetUserId = params.id;
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get('from') || undefined;
  const toDate = searchParams.get('to') || undefined;

  try {
    const report = getUserActivityReport(targetUserId, fromDate, toDate);

    if (!report) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    logAdminAction({
      adminUserId: user.userId,
      action: 'ADMIN_VIEWED_USER_REPORT',
      targetType: 'USER_REPORT',
      targetId: targetUserId,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'SkillSwap Admin',
    });

    return NextResponse.json(report);
  } catch (err: any) {
    console.error('User activity report error:', err);
    return NextResponse.json({ error: 'Failed to generate user report' }, { status: 500 });
  }
}
