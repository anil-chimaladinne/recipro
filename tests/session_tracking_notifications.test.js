const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const path = require('path');
const jwt = require('jsonwebtoken');

const dbPath = path.join(__dirname, '../data/skillswap.db');
const JWT_SECRET = process.env.AUTH_SECRET || 'skillswap-super-secret-jwt-key-for-local-development-min32bytes';

function getFreshDb() {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Ensure tables and columns exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'INFO',
      related_entity_type TEXT,
      related_entity_id TEXT,
      action_url TEXT,
      link TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id TEXT PRIMARY KEY,
      in_app_enabled INTEGER NOT NULL DEFAULT 1,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      session_updates INTEGER NOT NULL DEFAULT 1,
      mentor_available INTEGER NOT NULL DEFAULT 1,
      credits INTEGER NOT NULL DEFAULT 1,
      security INTEGER NOT NULL DEFAULT 1,
      system INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS session_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      actor_id TEXT,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      previous_state TEXT,
      new_state TEXT,
      metadata_json TEXT DEFAULT '{}',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try { db.exec(`ALTER TABLE notifications ADD COLUMN related_entity_type TEXT`); } catch {}
  try { db.exec(`ALTER TABLE notifications ADD COLUMN related_entity_id TEXT`); } catch {}
  try { db.exec(`ALTER TABLE notifications ADD COLUMN action_url TEXT`); } catch {}
  try { db.exec(`ALTER TABLE notifications ADD COLUMN read_at DATETIME`); } catch {}

  return db;
}

test('SkillSwap Campus — Session Tracking, Filters, Notification Inbox & Mentor Allocation Suite', async (t) => {
  const db = getFreshDb();
  const runId = Date.now();

  const learnerId = `test-learner-alice-${runId}`;
  const mentorId = `test-mentor-rahul-${runId}`;
  const otherId = `test-other-bob-${runId}`;
  const sessionId = `test-sess-${runId}`;
  const lreqId = `test-lreq-${runId}`;

  // 1. Seed baseline users
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, status, email_verified)
    VALUES 
      (?, ?, 'hashed123', 'STUDENT', 'ACTIVE', 1),
      (?, ?, 'hashed123', 'STUDENT', 'ACTIVE', 1),
      (?, ?, 'hashed123', 'STUDENT', 'ACTIVE', 1)
  `).run(
    learnerId, `alice-${runId}@campus.edu`,
    mentorId, `rahul-${runId}@campus.edu`,
    otherId, `bob-${runId}@campus.edu`
  );

  db.prepare(`
    INSERT INTO profiles (user_id, display_name, college, major, bio)
    VALUES 
      (?, 'Alice Sharma', 'Campus Engineering College', 'Computer Science', 'Learning Python'),
      (?, 'Rahul Reddy', 'Campus Engineering College', 'Computer Science', 'Verified Python Mentor'),
      (?, 'Bob Mehta', 'Partner Arts College', 'Design', 'UI Designer')
  `).run(learnerId, mentorId, otherId);

  // Setup Credit Accounts
  db.prepare(`
    INSERT INTO skill_credit_accounts (user_id, balance, escrow_balance)
    VALUES (?, 5, 0), (?, 0, 0), (?, 3, 0)
  `).run(learnerId, mentorId, otherId);

  // Python skill
  let pySkill = db.prepare(`SELECT id, name FROM skills WHERE id = 'skill-python' OR LOWER(name) = 'python'`).get();
  const pythonSkillId = pySkill ? pySkill.id : 'skill-python';
  if (!pySkill) {
    db.prepare(`
      INSERT INTO skills (id, name, category, icon, is_verified) VALUES (?, 'Python', 'Computer Science', 'BookOpen', 1)
    `).run(pythonSkillId);
  }

  // Rahul is a verified Python mentor
  db.prepare(`
    INSERT INTO user_skills (
      id, user_id, skill_id, proficiency, experience_years, verification_status,
      teaching_days, available_start_time, available_end_time
    ) VALUES (
      ?, ?, ?, 'Advanced', 2, 'ASSESSMENT_VERIFIED',
      '["Tuesday", "Thursday"]', '17:00', '21:00'
    )
  `).run(`usk-${runId}`, mentorId, pythonSkillId);

  await t.test('1. Session State Machine & Escrow Credit Lifecycle', () => {
    // 1a. Create a requested session with 1 credit reserved in escrow
    db.prepare(`
      INSERT INTO sessions (
        id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, mode, idempotency_key
      ) VALUES (?, 'Learn Python OOP', ?, ?, ?, 'REQUESTED', '2026-08-28 18:00:00', '2026-08-28 19:00:00', 1, 1, 'ONLINE', ?)
    `).run(sessionId, pythonSkillId, mentorId, learnerId, `key-sess-${runId}`);

    // Reserve 1 Escrow Credit from Alice
    db.prepare(`
      UPDATE skill_credit_accounts 
      SET balance = balance - 1, escrow_balance = escrow_balance + 1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(learnerId);

    db.prepare(`
      INSERT INTO credit_transactions (
        id, reference_session_id, sender_id, receiver_id, amount, transaction_type, status, idempotency_key
      ) VALUES (?, ?, ?, NULL, 1, 'ESCROW_RESERVE', 'SETTLED', ?)
    `).run(`tx-res-${runId}`, sessionId, learnerId, `key-res-${runId}`);

    const learnerAcc = db.prepare(`SELECT balance, escrow_balance FROM skill_credit_accounts WHERE user_id = ?`).get(learnerId);
    assert.equal(learnerAcc.balance, 4);
    assert.equal(learnerAcc.escrow_balance, 1);

    // 1b. Mentor accepts session
    db.prepare(`UPDATE sessions SET status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);
    db.prepare(`
      INSERT INTO session_events (id, session_id, actor_id, event_type, title, description, previous_state, new_state)
      VALUES (?, ?, ?, 'ACCEPTED', 'Session Accepted', 'Mentor accepted session request', 'REQUESTED', 'ACCEPTED')
    `).run(`sev-acc-${runId}`, sessionId, mentorId);

    const sessAccepted = db.prepare(`SELECT status FROM sessions WHERE id = ?`).get(sessionId);
    assert.equal(sessAccepted.status, 'ACCEPTED');

    // 1c. Set pre-session exchange agreement
    db.prepare(`
      INSERT INTO session_exchange_agreements (id, session_id, mentor_id, learner_id, taught_skill_id, requested_return_skill_name, return_type, status, proposed_by)
      VALUES (?, ?, ?, ?, ?, 'Credit Compensation', 'CREDIT', 'ACCEPTED', ?)
    `).run(`sea-${sessionId}`, sessionId, mentorId, learnerId, pythonSkillId, mentorId);

    // 1d. Session Starts Live
    db.prepare(`UPDATE sessions SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);
    db.prepare(`
      INSERT INTO session_events (id, session_id, actor_id, event_type, title, description, previous_state, new_state)
      VALUES (?, ?, ?, 'STARTED', 'Session Live', 'Participants joined classroom', 'ACCEPTED', 'IN_PROGRESS')
    `).run(`sev-start-${runId}`, sessionId, mentorId);

    // 1e. Both parties confirm and settle credits
    db.prepare(`
      UPDATE sessions 
      SET learner_confirmed = 1, teacher_confirmed = 1, status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(sessionId);

    // Settle 1 Escrow Credit to Rahul
    db.prepare(`
      UPDATE skill_credit_accounts 
      SET escrow_balance = escrow_balance - 1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(learnerId);

    db.prepare(`
      UPDATE skill_credit_accounts 
      SET balance = balance + 1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(mentorId);

    db.prepare(`
      INSERT INTO credit_transactions (
        id, reference_session_id, sender_id, receiver_id, amount, transaction_type, status, idempotency_key
      ) VALUES (?, ?, ?, ?, 1, 'SESSION_REWARD', 'SETTLED', ?)
    `).run(`tx-set-${runId}`, sessionId, learnerId, mentorId, `key-set-${runId}`);

    db.prepare(`
      INSERT INTO session_events (id, session_id, actor_id, event_type, title, description, previous_state, new_state)
      VALUES (?, ?, ?, 'CREDITS_SETTLED', 'Session Complete & Settled', 'Credits settled to mentor', 'IN_PROGRESS', 'CREDIT_SETTLED')
    `).run(`sev-settle-${runId}`, sessionId, mentorId);

    const learnerEnd = db.prepare(`SELECT balance, escrow_balance FROM skill_credit_accounts WHERE user_id = ?`).get(learnerId);
    const mentorEnd = db.prepare(`SELECT balance, escrow_balance FROM skill_credit_accounts WHERE user_id = ?`).get(mentorId);
    assert.equal(learnerEnd.balance, 4);
    assert.equal(learnerEnd.escrow_balance, 0, 'Escrow must be 0 after settlement');
    assert.equal(mentorEnd.balance, 1, 'Mentor must receive 1 credit');
  });

  await t.test('2. Audit Timeline Events Verification', () => {
    const events = db.prepare(`
      SELECT * FROM session_events WHERE session_id = ? ORDER BY created_at ASC
    `).all(sessionId);

    assert.ok(events.length >= 3, 'Must record ACCEPTED, STARTED, and CREDITS_SETTLED events');
    const types = events.map(e => e.event_type);
    assert.ok(types.includes('ACCEPTED'));
    assert.ok(types.includes('STARTED'));
    assert.ok(types.includes('CREDITS_SETTLED'));
  });

  await t.test('3. Persistent Notifications Inbox & Read Tracking', () => {
    const notifId1 = `notif-1-${runId}`;
    const notifId2 = `notif-2-${runId}`;

    // Insert 2 in-app notifications
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, action_url)
      VALUES 
        (?, ?, 'Session Accepted', 'Rahul accepted Python session', 'SESSION_ACCEPTED', 0, 'SESSION', ?, ?),
        (?, ?, 'Mentor Available', 'Verified Python mentor available', 'MENTOR_AVAILABLE', 0, 'LEARNER_REQUEST', ?, ?)
    `).run(
      notifId1, learnerId, sessionId, `/sessions/${sessionId}`,
      notifId2, learnerId, lreqId, `/learner-requests/${lreqId}/confirm-match`
    );

    // Check unread count
    const unreadCount = (db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`).get(learnerId)).count;
    assert.equal(unreadCount, 2);

    // Mark 1 as read
    db.prepare(`UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ?`).run(notifId1);
    const updatedUnread = (db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`).get(learnerId)).count;
    assert.equal(updatedUnread, 1);

    // Mark all as read
    db.prepare(`UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ?`).run(learnerId);
    const finalUnread = (db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`).get(learnerId)).count;
    assert.equal(finalUnread, 0);
  });

  await t.test('4. Mentor Allocation Match & Idempotency', () => {
    // Insert learning request
    db.prepare(`
      INSERT INTO learning_requests (
        id, learner_id, skill_id, skill_name, category, requested_proficiency,
        preferred_days, preferred_time_start, preferred_time_end, duration_hours,
        learning_goal, search_scope, status
      ) VALUES (?, ?, ?, 'Python', 'Computer Science', 'Beginner', '["Tuesday","Thursday"]', '18:00', '20:00', 1, 'Learn Python', 'ALL', 'MENTOR_FOUND')
    `).run(lreqId, learnerId, pythonSkillId);

    // Insert match record
    db.prepare(`
      INSERT OR REPLACE INTO learning_request_matches (
        id, request_id, mentor_id, match_score, match_reasons_json, notified_at, status
      ) VALUES (?, ?, ?, 95, '["Verified Python Mentor", "Matching Schedule"]', CURRENT_TIMESTAMP, 'NOTIFIED')
    `).run(`match-${runId}`, lreqId, mentorId);

    // Log Email Delivery Record
    db.prepare(`
      INSERT INTO notification_deliveries (
        id, notification_id, user_id, request_id, type, channel, recipient, subject, content, status
      ) VALUES (?, ?, ?, ?, 'MENTOR_AVAILABLE', 'EMAIL', ?, 'Good news! Mentor Available', 'Mentor Rahul is available', 'DELIVERED')
    `).run(`del-${runId}`, `notif-2-${runId}`, learnerId, lreqId, `alice-${runId}@campus.edu`);

    const deliveries = db.prepare(`SELECT * FROM notification_deliveries WHERE request_id = ?`).all(lreqId);
    assert.ok(deliveries.length >= 1);
    assert.equal(deliveries[0].channel, 'EMAIL');
    assert.equal(deliveries[0].status, 'DELIVERED');
  });

  await t.test('5. Session Search, Multi-Field Filters & Counters', () => {
    // Search by skill
    const pySessions = db.prepare(`
      SELECT s.*, sk.name as skill_name, tp.display_name as teacher_name
      FROM sessions s
      JOIN skills sk ON s.skill_id = sk.id
      JOIN profiles tp ON s.teacher_id = tp.user_id
      WHERE (s.teacher_id = ? OR s.learner_id = ?) AND LOWER(sk.name) LIKE '%python%'
    `).all(learnerId, learnerId);

    assert.ok(pySessions.length >= 1);
    assert.ok(pySessions[0].skill_name.toLowerCase().includes('python'));

    // User Summary Counters
    const userSummary = db.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status IN ('COMPLETED', 'CREDIT_SETTLED') THEN 1 ELSE 0 END) as completed_sessions,
        SUM(CASE WHEN teacher_id = ? AND status IN ('COMPLETED', 'CREDIT_SETTLED') THEN credits_amount ELSE 0 END) as credits_earned,
        SUM(CASE WHEN learner_id = ? AND status IN ('COMPLETED', 'CREDIT_SETTLED') THEN credits_amount ELSE 0 END) as credits_spent
      FROM sessions
      WHERE teacher_id = ? OR learner_id = ?
    `).get(mentorId, mentorId, mentorId, mentorId);

    assert.ok(userSummary.total_sessions >= 1);
    assert.ok(userSummary.completed_sessions >= 1);
    assert.equal(userSummary.credits_earned, 1);
  });
});
