import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getLearningRequestDetail } from '@/lib/learning-requests';
import { calculateAvailableSlots } from '@/lib/scheduling';

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

    if (!request.matchedMentor) {
      return NextResponse.json({
        matched: false,
        message: 'No mentor matched for this request yet.',
        request,
      });
    }

    // Calculate next available slots for the matched mentor
    const mentorId = request.matchedMentor.userId;
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];

    const slotResult = calculateAvailableSlots({
      teacherId: mentorId,
      learnerId: request.learnerId,
      skillId: request.skillId,
      date: startDate,
      startTimeWindow: request.preferredTimeStart,
      endTimeWindow: request.preferredTimeEnd,
      durationHours: request.durationHours,
    });

    return NextResponse.json({
      matched: true,
      request,
      matchedMentor: request.matchedMentor,
      availableSlots: slotResult.candidateSlots,
      preferredWindowDisplay: slotResult.preferredWindowDisplay,
    });
  } catch (err: any) {
    console.error('Fetch matched mentor slots error:', err);
    return NextResponse.json({ error: 'Failed to retrieve mentor slots' }, { status: 500 });
  }
}
