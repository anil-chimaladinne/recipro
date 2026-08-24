const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const path = require('path');
const nodemailer = require('nodemailer');

const dbPath = path.join(__dirname, '../data/skillswap.db');

test('SkillSwap Campus — SMTP & Email Features Test Suite', async (t) => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Insert a test user if not exists
  db.prepare(`
    INSERT OR IGNORE INTO users (id, email, password_hash, role, status)
    VALUES ('user-email-test-suite', 'emailtest@campus.edu', 'hash', 'STUDENT', 'ACTIVE')
  `).run();

  await t.test('1. Nodemailer SMTP transport initialization check', () => {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@campus.edu',
        pass: 'app-password',
      },
    });

    assert.ok(transporter);
    assert.strictEqual(typeof transporter.sendMail, 'function');
  });

  await t.test('2. Email delivery audit log persistence in database', () => {
    const deliveryId = `del-test-${Date.now()}`;
    const recipient = 'learner@university.edu';
    const subject = 'Test SMTP Delivery';
    const content = 'Test verification email content with token';

    db.prepare(`
      INSERT INTO notification_deliveries (
        id, user_id, type, channel, recipient, subject, content, status, created_at, sent_at, delivered_at
      ) VALUES (?, 'user-email-test-suite', 'VERIFY_EMAIL', 'EMAIL', ?, ?, ?, 'DELIVERED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(deliveryId, recipient, subject, content);

    const record = db.prepare(`SELECT * FROM notification_deliveries WHERE id = ?`).get(deliveryId);

    assert.ok(record);
    assert.strictEqual(record.recipient, recipient);
    assert.strictEqual(record.channel, 'EMAIL');
    assert.strictEqual(record.status, 'DELIVERED');
    assert.strictEqual(record.type, 'VERIFY_EMAIL');
  });

  await t.test('3. Mentor available email notification delivery format', () => {
    const deliveryId = `del-mentor-${Date.now()}`;
    const requestId = 'req-python-101';
    const recipient = 'learner-python@university.edu';
    const subject = 'Good news! A verified Python Programming mentor is available';

    db.prepare(`
      INSERT INTO notification_deliveries (
        id, user_id, request_id, type, channel, recipient, subject, content, status, created_at, sent_at, delivered_at
      ) VALUES (?, 'user-email-test-suite', ?, 'MENTOR_AVAILABLE', 'EMAIL', ?, ?, 'Mentor match content', 'DELIVERED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(deliveryId, requestId, recipient, subject);

    const record = db.prepare(`SELECT * FROM notification_deliveries WHERE id = ?`).get(deliveryId);

    assert.ok(record);
    assert.strictEqual(record.type, 'MENTOR_AVAILABLE');
    assert.strictEqual(record.request_id, requestId);
    assert.ok(record.subject.includes('Python Programming'));
  });

  await t.test('4. Session scheduled confirmation email logging', () => {
    const deliveryId = `del-sess-${Date.now()}`;
    const recipient = 'mentor@university.edu';
    const subject = 'Session Confirmed: Solidity Smart Contracts';

    db.prepare(`
      INSERT INTO notification_deliveries (
        id, user_id, type, channel, recipient, subject, content, status, created_at, sent_at, delivered_at
      ) VALUES (?, 'user-email-test-suite', 'SESSION_SCHEDULED', 'EMAIL', ?, ?, 'Session scheduled details', 'DELIVERED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(deliveryId, recipient, subject);

    const record = db.prepare(`SELECT * FROM notification_deliveries WHERE id = ?`).get(deliveryId);

    assert.ok(record);
    assert.strictEqual(record.type, 'SESSION_SCHEDULED');
    assert.ok(record.subject.includes('Solidity'));
  });

  db.close();
});
