import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { SetAvailabilitySchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  const slots = db.prepare(`
    SELECT id, day_of_week, start_time, end_time, timezone, is_preferred, window_label, skill_id
    FROM availability_slots
    WHERE user_id = ?
    ORDER BY 
      CASE day_of_week
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6
        WHEN 'Sunday' THEN 7
      END, start_time
  `).all(user.userId);

  return NextResponse.json({ slots });
}

export async function POST(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const body = await req.json();
    const rawSlots = body.slots || [];

    const tx = db.transaction(() => {
      // Clear previous slots
      db.prepare(`DELETE FROM availability_slots WHERE user_id = ?`).run(user.userId);

      // Insert new slots
      const insertStmt = db.prepare(`
        INSERT INTO availability_slots (id, user_id, day_of_week, start_time, end_time, is_preferred, window_label, skill_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const slot of rawSlots) {
        const slotId = `avail-${user.userId}-${slot.dayOfWeek}-${(slot.startTime || '').replace(':', '')}-${(slot.endTime || '').replace(':', '')}-${Math.random().toString(36).substring(2, 7)}`;
        insertStmt.run(
          slotId,
          user.userId,
          slot.dayOfWeek,
          slot.startTime,
          slot.endTime,
          slot.isPreferred ? 1 : 0,
          slot.windowLabel || 'General',
          slot.skillId || null
        );
      }
    });

    tx();

    return NextResponse.json({
      success: true,
      message: 'Weekly availability updated successfully!',
      count: rawSlots.length,
    });
  } catch (err: any) {
    console.error('Availability Error:', err);
    return NextResponse.json({ error: 'Failed to update availability schedule' }, { status: 500 });
  }
}
