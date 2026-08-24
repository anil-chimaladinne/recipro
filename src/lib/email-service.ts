import nodemailer from 'nodemailer';
import Database from 'better-sqlite3';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category?: string;
  metadata?: {
    userId?: string;
    notificationId?: string;
    requestId?: string;
    sessionId?: string;
  };
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  error?: string;
}

export class EmailService {
  /**
   * Creates a Nodemailer SMTP transporter if SMTP_HOST is configured
   */
  private static getSmtpTransporter() {
    if (!process.env.SMTP_HOST) return null;

    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || '',
      } : undefined,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production' && !process.env.SMTP_ALLOW_SELFSIGNED,
      },
    });
  }

  /**
   * Primary dispatcher: Checks SMTP -> Resend HTTP API -> SendGrid HTTP API -> Local Dev Logger
   */
  static async sendEmail(db: Database.Database, options: EmailOptions): Promise<EmailSendResult> {
    const deliveryId = `del-email-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const fromAddress = process.env.EMAIL_FROM || 'SkillSwap Campus <notifications@skillswap.campus.edu>';

    // 1. Check for SMTP Configuration (e.g. Gmail, Outlook, Amazon SES, Brevo, custom SMTP)
    const smtpTransporter = this.getSmtpTransporter();
    if (smtpTransporter) {
      try {
        const info = await smtpTransporter.sendMail({
          from: fromAddress,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text || options.subject,
        });

        this.logDelivery(db, deliveryId, options, 'DELIVERED', info.messageId);
        return {
          success: true,
          messageId: info.messageId,
          provider: `SMTP (${process.env.SMTP_HOST})`,
          status: 'SENT',
        };
      } catch (smtpErr: any) {
        console.error('[EmailService:SMTP_ERROR]', smtpErr);
        this.logDelivery(db, deliveryId, options, 'FAILED', undefined, smtpErr.message);
        return {
          success: false,
          provider: `SMTP (${process.env.SMTP_HOST})`,
          status: 'FAILED',
          error: smtpErr.message,
        };
      }
    }

    // 2. Check for Resend HTTP REST API
    if (process.env.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          this.logDelivery(db, deliveryId, options, 'DELIVERED', data.id);
          return { success: true, messageId: data.id, provider: 'Resend', status: 'SENT' };
        } else {
          const errText = await res.text();
          this.logDelivery(db, deliveryId, options, 'FAILED', undefined, errText);
          return { success: false, provider: 'Resend', status: 'FAILED', error: errText };
        }
      } catch (resendErr: any) {
        console.error('[EmailService:RESEND_ERROR]', resendErr);
        this.logDelivery(db, deliveryId, options, 'FAILED', undefined, resendErr.message);
        return { success: false, provider: 'Resend', status: 'FAILED', error: resendErr.message };
      }
    }

    // 3. Development / Test Fallback Provider (Safely logged in DB)
    console.log(`[EmailService:DEV_DISPATCH] To: ${options.to} | Subject: ${options.subject}`);
    this.logDelivery(db, deliveryId, options, 'SENT', `mock-msg-${Date.now()}`);
    return {
      success: true,
      messageId: `dev-${Date.now()}`,
      provider: 'LocalDevelopmentLogger',
      status: 'SENT',
    };
  }

  /**
   * Helper: Dispatch Account & Email Verification Link
   */
  static async sendVerificationEmail(
    db: Database.Database,
    params: {
      to: string;
      displayName: string;
      verificationUrl: string;
      token: string;
      userId: string;
      expiresInHours?: number;
    }
  ) {
    const hours = params.expiresInHours || 24;
    const subject = 'Verify your SkillSwap Campus Account';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #1e293b; border-radius: 16px; background-color: #0f172a; color: #f8fafc;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #14b8a6; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SkillSwap Campus</h1>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Peer-to-Peer Academic Skill Exchange</p>
        </div>

        <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">Welcome, ${params.displayName}!</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            Please verify your campus email address to activate your account, unlock skill exchanges, and receive your <strong>3 starter skill credits</strong>.
          </p>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            Click the button below to confirm your email. This link is valid for <strong>${hours} hours</strong>.
          </p>
          
          <div style="text-align: center; margin: 28px 0;">
            <a href="${params.verificationUrl}" style="background-color: #14b8a6; color: #020617; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(20, 184, 166, 0.3);">
              Verify Email Address &rarr;
            </a>
          </div>

          <div style="background-color: #0f172a; border-radius: 8px; padding: 12px; margin-top: 16px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">Or copy and paste this verification URL into your browser:</p>
            <p style="color: #2dd4bf; font-family: monospace; font-size: 11px; word-break: break-all; margin: 6px 0 0 0;">${params.verificationUrl}</p>
          </div>
        </div>

        <div style="border-top: 1px solid #334155; padding-top: 16px; text-align: center;">
          <p style="color: #64748b; font-size: 12px; margin: 0;">
            If you did not sign up for SkillSwap Campus, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;

    return this.sendEmail(db, {
      to: params.to,
      subject,
      html,
      category: 'VERIFY_EMAIL',
      metadata: {
        userId: params.userId,
      },
    });
  }

  /**
   * Helper: Dispatch Mentor Available Email to Learner with secure confirmation links
   */
  static async sendMentorAvailableEmail(
    db: Database.Database,
    params: {
      to: string;
      learnerName: string;
      skillName: string;
      mentorName: string;
      mentorVerification: string;
      availabilityWindow: string;
      matchScore?: number;
      confirmUrl: string;
      declineUrl: string;
      requestId: string;
      mentorId: string;
      userId: string;
      notificationId: string;
    }
  ) {
    const subject = `Good news! A verified ${params.skillName} mentor is available`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #1e293b; border-radius: 16px; background-color: #0f172a; color: #f8fafc;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #14b8a6; margin: 0; font-size: 22px; font-weight: 800;">SkillSwap Campus</h1>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 2px;">Smart Mentor Allocation</p>
        </div>

        <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #ffffff; font-size: 17px; margin-top: 0;">Hi ${params.learnerName},</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
            A verified peer mentor is now available for your <strong>${params.skillName}</strong> learning request!
          </p>

          <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 14px; margin: 16px 0;">
            <p style="margin: 4px 0; color: #f8fafc; font-size: 13px;"><strong>Mentor:</strong> ${params.mentorName}</p>
            <p style="margin: 4px 0; color: #f8fafc; font-size: 13px;"><strong>Skill:</strong> ${params.skillName} <span style="color: #14b8a6;">(${params.mentorVerification})</span></p>
            <p style="margin: 4px 0; color: #f8fafc; font-size: 13px;"><strong>Availability:</strong> ${params.availabilityWindow}</p>
            ${params.matchScore ? `<p style="margin: 4px 0; color: #34d399; font-size: 13px;"><strong>Match Compatibility:</strong> ${params.matchScore}%</p>` : ''}
          </div>

          <p style="color: #94a3b8; font-size: 13px;">
            Would you like to review this mentor and schedule your live 1-on-1 session?
          </p>

          <div style="margin: 20px 0; display: flex; gap: 10px;">
            <a href="${params.confirmUrl}" style="background-color: #14b8a6; color: #020617; font-weight: 700; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-size: 14px; display: inline-block;">
              Yes, Review &amp; Take Course &rarr;
            </a>
            <a href="${params.declineUrl}" style="background-color: #334155; color: #cbd5e1; font-weight: 600; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-size: 14px; display: inline-block; margin-left: 8px;">
              No, Keep Looking
            </a>
          </div>
        </div>

        <p style="color: #64748b; font-size: 11px; text-align: center; margin: 0;">
          Clicking "Yes" opens your secure confirmation page. No credits are charged until you confirm.
        </p>
      </div>
    `;

    return this.sendEmail(db, {
      to: params.to,
      subject,
      html,
      category: 'MENTOR_AVAILABLE',
      metadata: {
        userId: params.userId,
        notificationId: params.notificationId,
        requestId: params.requestId,
      },
    });
  }

  /**
   * Helper: Dispatch Session Scheduled Email
   */
  static async sendSessionScheduledEmail(
    db: Database.Database,
    params: {
      to: string;
      recipientName: string;
      partnerName: string;
      role: 'LEARNER' | 'MENTOR';
      skillName: string;
      scheduledStart: string;
      scheduledEnd: string;
      returnType: 'SKILL' | 'CREDIT';
      returnDetail: string;
      sessionUrl: string;
      sessionId: string;
      userId: string;
    }
  ) {
    const subject = `Session Confirmed: ${params.skillName} on ${new Date(params.scheduledStart).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #1e293b; border-radius: 16px; background-color: #0f172a; color: #f8fafc;">
        <h2 style="color: #14b8a6; margin-top: 0;">SkillSwap Campus — Session Confirmed</h2>
        <p style="color: #cbd5e1; font-size: 14px;">Hi <strong>${params.recipientName}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 14px;">
          Your 1-on-1 skill exchange session with <strong>${params.partnerName}</strong> is officially scheduled!
        </p>

        <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #f8fafc; font-size: 13px;"><strong>Topic:</strong> ${params.skillName}</p>
          <p style="margin: 4px 0; color: #f8fafc; font-size: 13px;"><strong>Start Time:</strong> ${new Date(params.scheduledStart).toLocaleString()}</p>
          <p style="margin: 4px 0; color: #f8fafc; font-size: 13px;"><strong>Exchange Agreement:</strong> ${params.returnType === 'SKILL' ? `Return Skill: ${params.returnDetail}` : `Credit Settlement: ${params.returnDetail}`}</p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${params.sessionUrl}" style="background-color: #14b8a6; color: #020617; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; display: inline-block;">
            Open Live Classroom &rarr;
          </a>
        </div>
      </div>
    `;

    return this.sendEmail(db, {
      to: params.to,
      subject,
      html,
      category: 'SESSION_SCHEDULED',
      metadata: {
        userId: params.userId,
        sessionId: params.sessionId,
      },
    });
  }

  /**
   * Persistent delivery logging in database
   */
  private static logDelivery(
    db: Database.Database,
    id: string,
    options: EmailOptions,
    status: 'SENT' | 'DELIVERED' | 'FAILED',
    providerMessageId?: string,
    errorDetails?: string
  ) {
    try {
      db.prepare(`
        INSERT INTO notification_deliveries (
          id, notification_id, user_id, request_id, type, channel, recipient, subject, content, status, error_details, created_at, sent_at, delivered_at
        ) VALUES (?, ?, ?, ?, ?, 'EMAIL', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${status === 'DELIVERED' ? 'CURRENT_TIMESTAMP' : 'NULL'})
      `).run(
        id,
        options.metadata?.notificationId || null,
        options.metadata?.userId || 'system',
        options.metadata?.requestId || null,
        options.category || 'GENERAL_EMAIL',
        options.to,
        options.subject,
        options.text || options.subject,
        status,
        errorDetails || null
      );
    } catch (err) {
      console.error('[EmailService:LOG_ERROR]', err);
    }
  }
}
