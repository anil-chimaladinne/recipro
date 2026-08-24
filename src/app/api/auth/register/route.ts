import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, isAcademicEmail } from '@/lib/db';
import { RegisterSchema } from '@/lib/validations';
import { hashPassword, signToken } from '@/lib/auth';
import { EmailService } from '@/lib/email-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input fields', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, password, college, major, year } = parsed.data;
    const displayName = (parsed.data.name || parsed.data.displayName || 'Campus Member').trim();
    const cleanEmail = email.trim().toLowerCase();
    const userType = parsed.data.userType || 'TEACHER_LEARNER';
    const db = getDb();

    // Check if user already exists (case-insensitive)
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email address already exists' },
        { status: 409 }
      );
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = await hashPassword(password);
    
    // Strict security rule: Public registration CANNOT grant ADMIN or MODERATOR role
    const userRole = 'STUDENT';
    const campusId = `STU-${Math.floor(100000 + Math.random() * 900000)}`;

    // Generate cryptographically secure email verification token (valid for 24 hours)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const isAcademic = isAcademicEmail(cleanEmail) ? 1 : 0;

    const tx = db.transaction(() => {
      // 1. Insert User as active and verified
      db.prepare(`
        INSERT INTO users (
          id, email, password_hash, role, status, campus_id, user_type,
          email_verified, verification_token, verification_token_expires, is_academic_email
        ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, 1, ?, ?, ?)
      `).run(userId, cleanEmail, passwordHash, userRole, campusId, userType, verificationToken, tokenExpires, isAcademic);

      // 2. Insert Profile with default values
      db.prepare(`
        INSERT INTO profiles (
          id, user_id, display_name, college, major, year, is_verified_student, trust_score, teaching_preference
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 75.0, 'Anyone')
      `).run(`prof-${userId}`, userId, displayName, college || 'SkillSwap Campus', major || 'General Studies', year || 'Freshman');

      // 3. Insert Skill Credit Account with 3 starter credits
      db.prepare(`
        INSERT INTO skill_credit_accounts (id, user_id, balance, escrow_balance, lifetime_earned, lifetime_spent)
        VALUES (?, ?, 3, 0, 0, 0)
      `).run(`acc-${userId}`, userId);

      // 4. Insert Initial Reputation
      db.prepare(`
        INSERT INTO reputations (id, user_id, total_reviews, total_sessions_taught, total_sessions_learned, bayesian_rating, reliability_score)
        VALUES (?, ?, 0, 0, 0, 4.5, 95.0)
      `).run(`rep-${userId}`, userId);

      // 5. Welcome Notification
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, link)
        VALUES (?, ?, 'Welcome to SkillSwap Campus!', 'Your account has been created! Complete your profile setup to start exchanging skills.', 'INFO', '/onboarding')
      `).run(`notif-${Date.now()}`, userId);
    });

    tx();

    // Send welcome email in background
    try {
      await EmailService.sendEmail(db, {
        to: cleanEmail,
        subject: 'Welcome to SkillSwap Campus!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #1e293b; border-radius: 12px; background-color: #0f172a; color: #ffffff;">
            <h1 style="color: #14b8a6; margin-top: 0;">SkillSwap Campus</h1>
            <h2 style="color: #ffffff; font-size: 18px;">Welcome, ${displayName}!</h2>
            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
              Your campus skill exchange account is ready. You have received <strong>3 starter skill credits</strong> to begin booking and offering peer sessions.
            </p>
          </div>
        `,
        category: 'WELCOME',
        metadata: { userId },
      });
    } catch (mailErr) {
      console.warn('[Register:EMAIL_DISPATCH_WARN]', mailErr);
    }

    const token = signToken({
      userId,
      email: cleanEmail,
      role: userRole,
      status: 'ACTIVE',
    });

    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully!',
      user: {
        id: userId,
        email: cleanEmail,
        displayName,
        role: userRole,
        campusId,
        college: college || 'SkillSwap Campus',
        major: major || 'General Studies',
        year: year || 'Freshman',
        balance: 3,
        emailVerified: true,
        isAcademicEmail: Boolean(isAcademic),
      },
      token,
      verificationToken,
      nextStep: '/onboarding',
    }, { status: 201 });

    response.cookies.set('skillswap_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('Register API Error:', err);
    return NextResponse.json({ error: 'Internal server error occurred' }, { status: 500 });
  }
}
