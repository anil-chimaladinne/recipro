import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { OnboardingSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const body = await req.json();
    const parsed = OnboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid onboarding fields', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { userType, college, major, year, teachingPreference, bio } = parsed.data;

    const tx = db.transaction(() => {
      // 1. Update user capability (user_type)
      db.prepare(`
        UPDATE users 
        SET user_type = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(userType, user.userId);

      // 2. Update profile details
      db.prepare(`
        UPDATE profiles 
        SET college = ?, major = ?, year = ?, teaching_preference = ?, bio = COALESCE(?, bio), updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(college, major, year, teachingPreference, bio || null, user.userId);
    });

    tx();

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully!',
      userType,
      college,
      major,
      year,
    });
  } catch (err: any) {
    console.error('Onboarding API Error:', err);
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }
}
