import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { searchSmartSlots, SmartSlotSearchParams } from '@/lib/scheduling';

export async function POST(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    const body = await req.json();

    const date = body.date || new Date().toISOString().substring(0, 10);
    const skillQuery = body.skillQuery || '';
    const startTimeWindow = body.startTimeWindow || '08:00';
    const endTimeWindow = body.endTimeWindow || '22:00';
    const durationMinutes = Number(body.durationMinutes) || 60;
    const isFlexible = body.isFlexible !== false; // default true
    const campusScope = body.campusScope || 'ALL';
    const sessionMode = body.sessionMode || 'ONLINE';
    const verifiedOnly = body.verifiedOnly === true;

    const params: SmartSlotSearchParams = {
      skillQuery,
      date,
      startTimeWindow,
      endTimeWindow,
      durationMinutes,
      isFlexible,
      campusScope,
      learnerId: authUser?.userId,
      sessionMode,
      verifiedOnly,
    };

    const results = searchSmartSlots(params);

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (err: any) {
    console.error('Smart Slot Search API Error:', err);
    return NextResponse.json(
      { error: 'Failed to execute smart slot search', details: err.message },
      { status: 500 }
    );
  }
}
