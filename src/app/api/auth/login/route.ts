import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { LoginSchema } from '@/lib/validations';
import { verifyPassword, signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const cleanEmail = email.trim().toLowerCase();
    const db = getDb();

    const user = db.prepare(`
      SELECT 
        u.id, u.email, u.password_hash, u.role, u.status, u.campus_id, u.user_type,
        COALESCE(u.email_verified, 0) as email_verified, COALESCE(u.is_academic_email, 0) as is_academic_email,
        p.display_name, p.avatar, p.college, p.major, p.year, p.is_verified_student,
        acc.balance, acc.escrow_balance
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      LEFT JOIN skill_credit_accounts acc ON u.id = acc.user_id
      WHERE LOWER(u.email) = ?
    `).get(cleanEmail) as any;

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password credentials' }, { status: 401 });
    }

    if (user.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'Your account has been suspended by campus moderators.' }, { status: 403 });
    }

    const isMatch = await verifyPassword(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid email or password credentials' }, { status: 401 });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatar: user.avatar,
        college: user.college,
        major: user.major,
        year: user.year,
        role: user.role,
        user_type: user.user_type || 'TEACHER_LEARNER',
        status: user.status,
        campusId: user.campus_id,
        isVerifiedStudent: Boolean(user.is_verified_student),
        emailVerified: Boolean(user.email_verified),
        isAcademicEmail: Boolean(user.is_academic_email),
        balance: user.balance || 0,
        escrowBalance: user.escrow_balance || 0,
      },
      token,
    });

    response.cookies.set('skillswap_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('Login API Error:', err);
    return NextResponse.json({ error: 'Internal server error occurred' }, { status: 500 });
  }
}
