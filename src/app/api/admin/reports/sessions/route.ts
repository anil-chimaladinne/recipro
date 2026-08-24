import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getSessionsListReport, logAdminAction } from '@/lib/admin-reporting';

export async function GET(req: NextRequest) {
  const authRes = requireAdmin(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const { searchParams } = new URL(req.url);

  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'ALL';
  const date = searchParams.get('date') || 'ALL';
  const settlement = searchParams.get('settlement') || 'ALL';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const report = getSessionsListReport({
      search,
      status,
      date,
      settlement,
      page,
      limit,
    });

    logAdminAction({
      adminUserId: user.userId,
      action: 'ADMIN_VIEWED_SESSIONS_DIRECTORY',
      targetType: 'SESSIONS_LIST',
      targetId: `page-${page}`,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'SkillSwap Admin',
    });

    return NextResponse.json(report);
  } catch (err: any) {
    console.error('Admin sessions list report error:', err);
    return NextResponse.json({ error: 'Failed to retrieve sessions report', details: err.message }, { status: 500 });
  }
}
