import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getUserListReport, logAdminAction } from '@/lib/admin-reporting';

export async function GET(req: NextRequest) {
  const authRes = requireAdmin(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const { searchParams } = new URL(req.url);

  const search = searchParams.get('search') || undefined;
  const role = searchParams.get('role') || undefined;
  const status = searchParams.get('status') || undefined;
  const skill = searchParams.get('skill') || undefined;
  const settlement = searchParams.get('settlement') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const report = getUserListReport({
      search,
      role,
      status,
      skill,
      settlement,
      page,
      limit,
    });

    logAdminAction({
      adminUserId: user.userId,
      action: 'ADMIN_VIEWED_USER_LIST_REPORT',
      targetType: 'USER_REPORT_LIST',
      targetId: search ? `search:${search}` : 'all',
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'SkillSwap Admin',
    });

    return NextResponse.json(report);
  } catch (err: any) {
    console.error('User list report error:', err);
    return NextResponse.json({ error: 'Failed to generate user list report' }, { status: 500 });
  }
}
