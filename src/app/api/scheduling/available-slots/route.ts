import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { CalculateSlotsSchema } from '@/lib/validations';
import { calculateAvailableSlots } from '@/lib/scheduling';

export async function POST(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;

  try {
    const body = await req.json();
    const parsed = CalculateSlotsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid scheduling parameters', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { teacherId, date, startTimeWindow, endTimeWindow, durationHours, bufferMinutes } = parsed.data;

    const result = calculateAvailableSlots({
      teacherId,
      learnerId: user.userId,
      date,
      startTimeWindow,
      endTimeWindow,
      durationHours,
      bufferMinutes,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Available Slots Error:', err);
    return NextResponse.json({ error: 'Failed to calculate available slots' }, { status: 500 });
  }
}
