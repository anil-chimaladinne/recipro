require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = parseInt(process.env.SMTP_PORT || '587', 10);
const secure = process.env.SMTP_SECURE === 'true' || port === 465;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const recipient = process.argv[2] || user || 'test@campus.edu';

console.log('====================================================');
console.log('SkillSwap Campus — Live SMTP Connection Test Tool');
console.log('====================================================');
console.log('Host:', host);
console.log('Port:', port);
console.log('Secure:', secure);
console.log('User:', user ? `${user.substring(0, 3)}***` : '(Not configured)');
console.log('Password Set:', Boolean(pass));
console.log('Target Recipient:', recipient);
console.log('----------------------------------------------------');

if (!user || !pass) {
  console.log('⚠️ SMTP_USER or SMTP_PASS is missing in .env.local.');
  console.log('Configure your SMTP credentials in .env.local to run live tests.');
  process.exit(0);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
  tls: { rejectUnauthorized: false }
});

console.log('Connecting to SMTP server...');

transporter.verify((err) => {
  if (err) {
    console.error('❌ SMTP Connection Failed:', err.message);
    process.exit(1);
  }

  console.log('✅ SMTP Handshake Successful! Sending test email...');

  transporter.sendMail({
    from: process.env.EMAIL_FROM || `SkillSwap Campus <${user}>`,
    to: recipient,
    subject: 'SkillSwap Campus — Email System Active!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #1e293b; border-radius: 12px; background-color: #0f172a; color: #ffffff;">
        <h1 style="color: #14b8a6; margin-top: 0;">SkillSwap Campus</h1>
        <h2 style="color: #ffffff; font-size: 18px;">Email System Successfully Connected!</h2>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Your SMTP email service is active and sending emails.
        </p>
        <div style="margin-top: 20px; padding: 12px; background-color: #1e293b; border-radius: 8px; font-family: monospace; font-size: 12px; color: #2dd4bf;">
          Timestamp: ${new Date().toISOString()}
        </div>
      </div>
    `
  }, (sendErr, info) => {
    if (sendErr) {
      console.error('❌ Error sending message:', sendErr.message);
      process.exit(1);
    }
    console.log('🚀 Test email sent successfully to:', recipient);
    console.log('📬 Message ID:', info.messageId);
    process.exit(0);
  });
});
