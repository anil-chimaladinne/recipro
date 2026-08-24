import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { SessionActionSchema } from '@/lib/validations';
import { transitionSessionState, SessionState } from '@/lib/state-machine';

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
    const parsed = SessionActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid action format', details: parsed.error.format() }, { status: 400 });
    }

    const { action, reason, idempotencyKey } = parsed.data;
    const resolvedIdempotencyKey = idempotencyKey || `${sessionId}-${action}-${Date.now()}`;

    let targetState: SessionState = 'REQUESTED';
    if (action === 'ACCEPT') targetState = 'ACCEPTED';
    else if (action === 'START') targetState = 'IN_PROGRESS';
    else if (action === 'CONFIRM_COMPLETION' || action === 'CONFIRM') targetState = 'COMPLETED';
    else if (action === 'CANCEL' || action === 'REJECT') targetState = 'CANCELLED';
    else if (action === 'DISPUTE') targetState = 'DISPUTED';

    const result = transitionSessionState(sessionId, targetState, user.userId, {
      reason,
      idempotencyKey: resolvedIdempotencyKey,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      previousState: result.previousState,
      newState: result.newState,
      txHash: result.txHash,
    });
  } catch (err: any) {
    console.error('Session Action Error:', err);
    return NextResponse.json({ error: 'Failed to process session action' }, { status: 500 });
  }
}
