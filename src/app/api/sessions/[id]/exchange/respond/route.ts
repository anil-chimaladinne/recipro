import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { RespondReturnSkillSchema } from '@/lib/validations';
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
    const body = await req.json();
    const parsed = RespondReturnSkillSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid response format', details: parsed.error.format() }, { status: 400 });
    }

    const { action, alternativeSkillName, notes } = parsed.data;

    const result = respondToReturnProposal({
      sessionId,
      actorUserId: user.userId,
      action,
      alternativeSkillName,
      notes,
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
    console.error('Respond Return Proposal Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to respond to proposal' }, { status: 500 });
  }
}
