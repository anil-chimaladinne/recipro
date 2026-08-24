import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getSessionDetailReport, logAdminAction } from '@/lib/admin-reporting';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRes = requireAdmin(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const sessionId = params.id;

  try {
    const report = getSessionDetailReport(sessionId);

    if (!report) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    logAdminAction({
      adminUserId: user.userId,
      action: 'ADMIN_VIEWED_SESSION_REPORT',
      targetType: 'SESSION_REPORT',
      targetId: sessionId,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'SkillSwap Admin',
    });

    return NextResponse.json(report);
  } catch (err: any) {
    console.error('Session detail report error:', err);
    return NextResponse.json({ error: 'Failed to generate session report' }, { status: 500 });
  }
}
