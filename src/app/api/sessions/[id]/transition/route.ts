import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { transitionSessionState, SessionState, canTransition } from '@/lib/state-machine';
import { getDb } from '@/lib/db';

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
    const targetState = body.targetState as SessionState;
    const reason = body.reason;
    const idempotencyKey = body.idempotencyKey;

    if (!targetState) {
      return NextResponse.json({ error: 'Missing targetState in request body' }, { status: 400 });
    }

    const result = transitionSessionState(sessionId, targetState, user.userId, {
      reason,
      idempotencyKey,
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
    console.error('Session Transition Error:', err);
    return NextResponse.json({ error: 'Failed to transition session state', details: err.message }, { status: 500 });
  }
}
