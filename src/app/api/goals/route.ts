import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { AddGoalSchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  const goals = db.prepare(`
    SELECT lg.*, s.name as skill_name, s.category as skill_category
    FROM learning_goals lg
    JOIN skills s ON lg.skill_id = s.id
    WHERE lg.user_id = ?
  `).all(user.userId);

  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const body = await req.json();
    const parsed = AddGoalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid goal data', details: parsed.error.format() }, { status: 400 });
    }

    const { skillName, category, targetProficiency, priority, notes } = parsed.data;

    let skill = db.prepare('SELECT id FROM skills WHERE LOWER(name) = LOWER(?)').get(skillName) as { id: string } | undefined;
    if (!skill) {
      const skillId = `skill-${skillName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      db.prepare(`
        INSERT INTO skills (id, name, category, icon, description)
        VALUES (?, ?, ?, 'BookOpen', 'Student learning goal')
      `).run(skillId, skillName, category);
      skill = { id: skillId };
    }

    const learningDays = body.learningDays ? JSON.stringify(body.learningDays) : '["Tuesday","Thursday","Saturday"]';
    const availableStartTime = body.availableStartTime || '18:00';
    const availableEndTime = body.availableEndTime || '21:00';
    const preferredStartTime = body.preferredStartTime || '19:00';
    const preferredEndTime = body.preferredEndTime || '21:00';
    const sessionDurationMinutes = Number(body.sessionDurationMinutes) || 60;
    const timezone = body.timezone || 'Asia/Kolkata';
    const isFlexible = body.isFlexible === false ? 0 : 1;

    db.prepare(`
      INSERT INTO learning_goals (
        id, user_id, skill_id, target_proficiency, priority, notes,
        learning_days, available_start_time, available_end_time, preferred_start_time, preferred_end_time,
        session_duration_minutes, timezone, is_flexible
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, skill_id) DO UPDATE SET
        target_proficiency = excluded.target_proficiency,
        priority = excluded.priority,
        notes = excluded.notes,
        learning_days = excluded.learning_days,
        available_start_time = excluded.available_start_time,
        available_end_time = excluded.available_end_time,
        preferred_start_time = excluded.preferred_start_time,
        preferred_end_time = excluded.preferred_end_time,
        session_duration_minutes = excluded.session_duration_minutes,
        timezone = excluded.timezone,
        is_flexible = excluded.is_flexible
    `).run(
      `goal-${user.userId}-${skill.id}`,
      user.userId,
      skill.id,
      targetProficiency,
      priority,
      notes || '',
      learningDays,
      availableStartTime,
      availableEndTime,
      preferredStartTime,
      preferredEndTime,
      sessionDurationMinutes,
      timezone,
      isFlexible
    );

    return NextResponse.json({
      success: true,
      message: `Learning goal for "${skillName}" added to your study plan!`,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Add Goal Error:', err);
    return NextResponse.json({ error: 'Failed to add learning goal' }, { status: 500 });
  }
}
