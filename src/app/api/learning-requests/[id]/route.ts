import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getLearningRequestDetail, cancelLearningRequest } from '@/lib/learning-requests';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const db = getDb();
  const requestId = params.id;

  try {
    const request = getLearningRequestDetail(db, requestId);
    if (!request) {
      return NextResponse.json({ error: 'Learning request not found' }, { status: 404 });
    }

    return NextResponse.json({ request });
  } catch (err: any) {
    console.error('Fetch learning request detail error:', err);
    return NextResponse.json({ error: 'Failed to retrieve request details' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();
  const requestId = params.id;

  try {
    const success = cancelLearningRequest(db, requestId, user.userId);
    if (!success) {
      return NextResponse.json({ error: 'Failed to cancel request or unauthorized' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Learning request cancelled successfully' });
  } catch (err: any) {
    console.error('Cancel learning request error:', err);
    return NextResponse.json({ error: 'Failed to cancel learning request' }, { status: 500 });
  }
}
