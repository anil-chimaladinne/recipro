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

    const result = respondToReturnProposal({
      sessionId,
      actorUserId: user.userId,
      action: 'DECLINE',
      notes: body.notes || 'Learner declined the return skill proposal',
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Return skill proposal rejected. Mentor may specify another return skill.',
      agreement: result.agreement,
    });
  } catch (err: any) {
    console.error('Reject Return Skill Error:', err);
    return NextResponse.json({ error: err.message || 'Your response could not be saved.' }, { status: 500 });
  }
}
