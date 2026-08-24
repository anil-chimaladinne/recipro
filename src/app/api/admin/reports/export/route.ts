import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { 
  getDailyReport, 
  getUserActivityReport, 
  getSessionDetailReport, 
  exportReportToCsv, 
  logAdminAction 
} from '@/lib/admin-reporting';

export async function GET(req: NextRequest) {
  const authRes = requireAdmin(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get('type') || 'daily') as 'daily' | 'user' | 'session';

  try {
    let csvContent = '';
    let filename = `skillswap-report-${type}-${Date.now()}.csv`;

    if (type === 'daily') {
      const dateStr = searchParams.get('date') || new Date().toISOString().substring(0, 10);
      const data = getDailyReport(dateStr);
      csvContent = exportReportToCsv('daily', data);
      filename = `skillswap-daily-report-${dateStr}.csv`;
    } else if (type === 'user') {
      const userId = searchParams.get('userId');
      if (!userId) {
        return NextResponse.json({ error: 'userId query parameter is required for user export' }, { status: 400 });
      }
      const data = getUserActivityReport(userId, searchParams.get('from') || undefined, searchParams.get('to') || undefined);
      if (!data) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      csvContent = exportReportToCsv('user', data);
      filename = `skillswap-user-report-${userId}-${Date.now()}.csv`;
    } else if (type === 'session') {
      const sessionId = searchParams.get('sessionId');
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId query parameter is required for session export' }, { status: 400 });
      }
      const data = getSessionDetailReport(sessionId);
      if (!data) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      csvContent = exportReportToCsv('session', data);
      filename = `skillswap-session-report-${sessionId}.csv`;
    } else {
      return NextResponse.json({ error: 'Invalid export type. Supported: daily, user, session' }, { status: 400 });
    }

    logAdminAction({
      adminUserId: user.userId,
      action: 'ADMIN_EXPORTED_REPORT',
      targetType: `${type.toUpperCase()}_REPORT_EXPORT`,
      targetId: filename,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'SkillSwap Admin',
    });

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    console.error('Report export error:', err);
    return NextResponse.json({ error: 'Failed to generate report export' }, { status: 500 });
  }
}
