import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { UpdateProfileSchema } from '@/lib/validations';

export async function PUT(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const body = await req.json();
    const parsed = UpdateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid profile data', details: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;

    const tx = db.transaction(() => {
      // 1. Update user_type if provided
      if (data.userType) {
        db.prepare('UPDATE users SET user_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(data.userType, user.userId);
      }

      // 2. Update profile table
      const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.userId) as any;
      if (profile) {
        db.prepare(`
          UPDATE profiles
          SET 
            display_name = COALESCE(?, display_name),
            bio = COALESCE(?, bio),
            college = COALESCE(?, college),
            major = COALESCE(?, major),
            year = COALESCE(?, year),
            teaching_style = COALESCE(?, teaching_style),
            languages = COALESCE(?, languages),
            teaching_preference = COALESCE(?, teaching_preference),
            portfolio_url = COALESCE(?, portfolio_url),
            profile_visibility = COALESCE(?, profile_visibility),
            skill_visibility = COALESCE(?, skill_visibility),
            availability_visibility = COALESCE(?, availability_visibility),
            portfolio_visibility = COALESCE(?, portfolio_visibility),
            learning_goal_visibility = COALESCE(?, learning_goal_visibility),
            daily_session_limit = COALESCE(?, daily_session_limit),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(
          data.displayName ?? null,
          data.bio ?? null,
          data.college ?? null,
          data.major ?? null,
          data.year ?? null,
          data.teachingStyle ?? null,
          data.languages ?? null,
          data.teachingPreference ?? null,
          data.portfolioUrl ?? null,
          data.profileVisibility ?? null,
          data.skillVisibility ?? null,
          data.availabilityVisibility ?? null,
          data.portfolioVisibility ?? null,
          data.learningGoalVisibility ?? null,
          data.dailySessionLimit ?? null,
          user.userId
        );
      }
    });

    tx();

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully!',
    });
  } catch (err: any) {
    console.error('Update Profile Error:', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
