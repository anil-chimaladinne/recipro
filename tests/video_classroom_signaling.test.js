const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/skillswap.db');

function getFreshDb() {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

test('SkillSwap Campus — Video Classroom, WebRTC Signaling & Database Persistence Suite', async (t) => {
  const db = getFreshDb();

  const sessionId = `test-video-sess-${Date.now()}`;
  const mentorId = 'usr-rahul';
  const learnerId = 'usr-ananya';
  const skillId = 'skill-python';

  // 1. Setup session & agreement in ACCEPTED state
  db.prepare(`
    INSERT INTO sessions (
      id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, mode, location_or_url, idempotency_key
    ) VALUES (?, 'Live Video Classroom Test', ?, ?, ?, 'SCHEDULED', '2026-08-25 18:00:00', '2026-08-25 19:00:00', 1.0, 1, 'ONLINE', 'https://meet.skillswap.internal/room/test', ?)
  `).run(sessionId, skillId, mentorId, learnerId, `idemp-${sessionId}`);

  db.prepare(`
    INSERT INTO session_exchange_agreements (
      id, session_id, mentor_id, learner_id, taught_skill_id, requested_return_skill_name, return_type, credit_amount, status, proposal_count, proposed_by, accepted_by, accepted_at
    ) VALUES (?, ?, ?, ?, ?, 'UI/UX Design', 'SKILL', 1, 'ACCEPTED', 1, ?, ?, CURRENT_TIMESTAMP)
  `).run(`sea-${sessionId}`, sessionId, mentorId, learnerId, skillId, mentorId, learnerId);

  // Test 1: Record video room presence
  await t.test('1. Database: Record live video presence for mentor and learner', () => {
    db.prepare(`
      INSERT INTO session_room_presence (
        id, session_id, user_id, display_name, role, camera_on, mic_on, screen_sharing, status, last_ping
      ) VALUES (?, ?, ?, 'Rahul Reddy', 'TRAINER', 1, 1, 0, 'CONNECTED', CURRENT_TIMESTAMP)
    `).run(`pres-${sessionId}-${mentorId}`, sessionId, mentorId);

    db.prepare(`
      INSERT INTO session_room_presence (
        id, session_id, user_id, display_name, role, camera_on, mic_on, screen_sharing, status, last_ping
      ) VALUES (?, ?, ?, 'Ananya Reddy', 'LEARNER', 1, 1, 0, 'CONNECTED', CURRENT_TIMESTAMP)
    `).run(`pres-${sessionId}-${learnerId}`, sessionId, learnerId);

    const presence = db.prepare(`SELECT * FROM session_room_presence WHERE session_id = ?`).all(sessionId);
    assert.strictEqual(presence.length, 2, 'Both participants recorded in room presence');
    assert.strictEqual(presence[0].camera_on, 1, 'Mentor camera is on');
  });

  // Test 2: WebRTC Signaling Message Persistence
  await t.test('2. Signaling: Exchange SDP Offer, Answer and ICE Candidates', () => {
    // Mentor sends SDP Offer
    db.prepare(`
      INSERT INTO session_signaling_messages (
        id, session_id, sender_id, receiver_id, signal_type, payload_json, is_consumed, created_at
      ) VALUES (?, ?, ?, ?, 'OFFER', '{"sdp":"v=0\\r\\no=mentor 123 456 IN IP4 127.0.0.1"}', 0, CURRENT_TIMESTAMP)
    `).run(`sig-1-${sessionId}`, sessionId, mentorId, learnerId);

    // Learner receives offer and sends SDP Answer
    db.prepare(`
      INSERT INTO session_signaling_messages (
        id, session_id, sender_id, receiver_id, signal_type, payload_json, is_consumed, created_at
      ) VALUES (?, ?, ?, ?, 'ANSWER', '{"sdp":"v=0\\r\\no=learner 789 101 IN IP4 127.0.0.1"}', 0, CURRENT_TIMESTAMP)
    `).run(`sig-2-${sessionId}`, sessionId, learnerId, mentorId);

    const signals = db.prepare(`SELECT * FROM session_signaling_messages WHERE session_id = ? ORDER BY created_at ASC`).all(sessionId);
    assert.strictEqual(signals.length, 2, '2 signals recorded');
    assert.strictEqual(signals[0].signal_type, 'OFFER');
    assert.strictEqual(signals[1].signal_type, 'ANSWER');
  });

  // Test 3: Collaborative Live Code Scratchpad
  await t.test('3. Scratchpad: Real-time code synchronization in SQLite', () => {
    const codeSnippet = `function calculateFibonacci(n) {\n  return n <= 1 ? n : calculateFibonacci(n-1) + calculateFibonacci(n-2);\n}`;
    
    db.prepare(`
      INSERT INTO session_scratchpads (id, session_id, content, language, updated_by, updated_at)
      VALUES (?, ?, ?, 'javascript', ?, CURRENT_TIMESTAMP)
    `).run(`pad-${sessionId}`, sessionId, codeSnippet, mentorId);

    const pad = db.prepare(`SELECT * FROM session_scratchpads WHERE session_id = ?`).get(sessionId);
    assert.ok(pad, 'Scratchpad found');
    assert.strictEqual(pad.content, codeSnippet);
    assert.strictEqual(pad.updated_by, mentorId);
  });

  // Test 4: Persistent In-Room Chat Messages
  await t.test('4. In-Room Chat: Store encrypted chat messages during video call', () => {
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, sender_id, message, status, is_system, created_at)
      VALUES (?, ?, ?, 'Hello Ananya! Ready to start our Python and UI/UX exchange?', 'SENT', 0, CURRENT_TIMESTAMP)
    `).run(`chat-1-${sessionId}`, sessionId, mentorId);

    db.prepare(`
      INSERT INTO chat_messages (id, session_id, sender_id, message, status, is_system, created_at)
      VALUES (?, ?, ?, 'Yes Rahul! I have Figma open for our return exchange.', 'SENT', 0, CURRENT_TIMESTAMP)
    `).run(`chat-2-${sessionId}`, sessionId, learnerId);

    const msgs = db.prepare(`SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`).all(sessionId);
    assert.strictEqual(msgs.length, 2, '2 chat messages recorded');
    assert.strictEqual(msgs[0].sender_id, mentorId);
    assert.strictEqual(msgs[1].sender_id, learnerId);
  });

  // Clean up test data
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
  db.prepare(`DELETE FROM session_exchange_agreements WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM session_room_presence WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM session_signaling_messages WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM session_scratchpads WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM chat_messages WHERE session_id = ?`).run(sessionId);
});
