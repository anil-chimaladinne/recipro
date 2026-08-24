import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { EmailService } from '@/lib/email-service';

export async function POST(req: NextRequest) {
  const db = getDb();

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const testRecipient = body.to || process.env.SMTP_USER || 'test@campus.edu';
    const testSubject = body.subject || 'SkillSwap Campus — SMTP Test Email';

    const testHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #0f172a; color: #ffffff;">
        <h2 style="color: #14b8a6; margin-top: 0;">SkillSwap Campus — Email System Active!</h2>
        <p style="color: #cbd5e1; font-size: 14px;">
          This is a test email sent from SkillSwap Campus. If you are seeing this, your email configuration (SMTP / API) is working properly!
        </p>
        <div style="background-color: #1e293b; border-radius: 8px; padding: 12px; margin: 16px 0; font-family: monospace; font-size: 12px; color: #2dd4bf;">
          <div>Provider: ${process.env.SMTP_HOST ? `SMTP (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587})` : process.env.RESEND_API_KEY ? 'Resend HTTP API' : 'Local Development Logger'}</div>
          <div>From: ${process.env.EMAIL_FROM || 'SkillSwap Campus'}</div>
          <div>Recipient: ${testRecipient}</div>
          <div>Timestamp: ${new Date().toISOString()}</div>
        </div>
      </div>
    `;

    const result = await EmailService.sendEmail(db, {
      to: testRecipient,
      subject: testSubject,
      html: testHtml,
      category: 'SMTP_TEST',
      metadata: {
        userId: 'system-test',
      },
    });

    return NextResponse.json({
      success: result.success,
      provider: result.provider,
      messageId: result.messageId,
      status: result.status,
      error: result.error,
      smtpConfig: {
        host: process.env.SMTP_HOST || '(Not set - using dev logger)',
        port: process.env.SMTP_PORT || '587',
        user: process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 3)}***` : '(Not set)',
        hasPass: Boolean(process.env.SMTP_PASS),
        from: process.env.EMAIL_FROM || 'SkillSwap Campus <notifications@skillswap.campus.edu>',
      },
    });
  } catch (err: any) {
    console.error('Email Test Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
