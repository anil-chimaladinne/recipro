import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { respondToReturnProposal } from '@/lib/state-machine';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const sessionId = params.id;

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const action = body.action || 'ACCEPT_SKILL';

    const result = respondToReturnProposal({
      sessionId,
      actorUserId: user.userId,
      action: action as any,
      alternativeSkillName: body.alternativeSkillName,
      notes: body.notes,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      agreement: result.agreement,
    });
  } catch (err: any) {
    console.error('Accept Return Skill Error:', err);
    return NextResponse.json({ error: err.message || 'Your response could not be saved.' }, { status: 500 });
  }
}
