import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, isAcademicEmail } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { EmailService } from '@/lib/email-service';

// GET /api/auth/verify-email?token=xyz
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token || !token.trim()) {
    return NextResponse.json({ error: 'Verification token is required' }, { status: 400 });
  }

  const db = getDb();

  try {
    const user = db.prepare(`
      SELECT id, email, email_verified, verification_token_expires, is_academic_email
      FROM users
      WHERE verification_token = ?
    `).get(token.trim()) as any;

    if (!user) {
      return NextResponse.json({ error: 'This verification link is invalid or has already been used.' }, { status: 400 });
    }

    if (user.verification_token_expires && new Date(user.verification_token_expires).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This verification link has expired. Please request a new verification email.' }, { status: 400 });
    }

    // Invalidate token and mark email_verified = 1
    db.prepare(`
      UPDATE users 
      SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id);

    // Record verified event in notifications
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link)
      VALUES (?, ?, 'Email Verified Successfully', 'Your email address has been verified. You can now complete your onboarding.', 'INFO', '/onboarding')
    `).run(`notif-verify-${Date.now()}`, user.id);

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully!',
      isAcademicEmail: Boolean(user.is_academic_email),
    });
  } catch (err: any) {
    console.error('Verify Email Error:', err);
    return NextResponse.json({ error: 'Failed to verify email address' }, { status: 500 });
  }
}

// POST /api/auth/verify-email
// Dispatches a fresh verification token to user's email via SMTP / EmailService
export async function POST(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    // Generate fresh token & dispatch via EmailService
    const freshToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      UPDATE users
      SET verification_token = ?, verification_token_expires = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(freshToken, tokenExpires, user.userId);

    const fullUser = db.prepare(`SELECT email FROM users WHERE id = ?`).get(user.userId) as any;
    const userEmail = fullUser?.email || user.email;

    const profile = db.prepare(`SELECT display_name FROM profiles WHERE user_id = ?`).get(user.userId) as any;
    const displayName = profile?.display_name || userEmail.split('@')[0];

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/verify-email?token=${freshToken}`;

    // Dispatch verification email via EmailService (SMTP / Resend / Dev Fallback)
    const emailResult = await EmailService.sendVerificationEmail(db, {
      to: userEmail,
      displayName,
      verificationUrl,
      token: freshToken,
      userId: user.userId,
      expiresInHours: 24,
    });

    // Also add in-app notification
    const notifId = `notif-verify-req-${Date.now()}`;
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link)
      VALUES (?, ?, 'Email Verification Link', 'Click here to verify your campus email address.', 'INFO', '/verify-email?token=' || ?)
    `).run(notifId, user.userId, freshToken);

    return NextResponse.json({
      success: true,
      message: `Verification email dispatched via ${emailResult.provider}.`,
      provider: emailResult.provider,
      verificationToken: freshToken,
      verificationLink: `/verify-email?token=${freshToken}`,
    });
  } catch (err: any) {
    console.error('Resend/Verify Email Error:', err);
    return NextResponse.json({ error: 'Failed to process email verification: ' + err.message }, { status: 500 });
  }
}

