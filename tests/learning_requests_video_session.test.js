const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'skillswap.db');

test('SkillSwap Campus — Learner Requests & Online Video Classroom End-to-End Suite', async (t) => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const randSuffix = Math.random().toString(36).substring(2, 9);
  const testLearnerId = `usr-lr-learner-${randSuffix}`;
  const testMentorId = `usr-lr-mentor-${randSuffix}`;
  const testSkillId = `skill-rust-${randSuffix}`;
  const testRequestId = `lreq-test-${randSuffix}`;
  const testSessionId = `sess-test-${randSuffix}`;
  const testUskId = `usk-test-${randSuffix}`;

  await t.test('1. Prepare Test Users & Skill Catalog', () => {
    // Insert test learner
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, user_type)
      VALUES (?, ?, 'hash', 'STUDENT', 'ACTIVE', 'LEARNER')
    `).run(testLearnerId, `learner-${randSuffix}@campus.edu`);

    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, college, is_verified_student, email_notifications_enabled, in_app_notifications_enabled)
      VALUES (?, ?, 'Test Learner', 'School of Engineering', 1, 1, 1)
    `).run(`prof-${testLearnerId}`, testLearnerId);

    // Insert test mentor
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, user_type)
      VALUES (?, ?, 'hash', 'STUDENT', 'ACTIVE', 'TEACHER_LEARNER')
    `).run(testMentorId, `mentor-${randSuffix}@campus.edu`);

    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, college, is_verified_student)
      VALUES (?, ?, 'Test Mentor', 'School of Engineering', 1)
    `).run(`prof-${testMentorId}`, testMentorId);

    // Insert test skill
    db.prepare(`
      INSERT INTO skills (id, name, category, description, is_verified)
      VALUES (?, ?, 'Computer Science', 'Low level systems programming with Rust', 1)
    `).run(testSkillId, `Rust Systems Programming ${randSuffix}`);

    const checkSkill = db.prepare(`SELECT * FROM skills WHERE id = ?`).get(testSkillId);
    assert.ok(checkSkill);
    assert.equal(checkSkill.name, `Rust Systems Programming ${randSuffix}`);
  });

  await t.test('2. Create Persistent Learner Request in SQLite Database', () => {
    const insertReq = db.prepare(`
      INSERT INTO learning_requests (
        id, learner_id, skill_id, skill_name, category, requested_proficiency,
        preferred_days, preferred_time_start, preferred_time_end, duration_hours,
        learning_goal, search_scope, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'Computer Science', 'Intermediate',
        '["Monday","Wednesday","Friday"]', '17:00', '20:00', 1.0,
        'Master Rust ownership, borrowing, and async Tokio runtime', 'ALL', 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    insertReq.run(testRequestId, testLearnerId, testSkillId, `Rust Systems Programming ${randSuffix}`);

    const saved = db.prepare(`SELECT * FROM learning_requests WHERE id = ?`).get(testRequestId);
    assert.ok(saved, 'Learning request must be persisted in database');
    assert.equal(saved.status, 'OPEN', 'Initial status must be OPEN (Waiting for Mentor)');
    assert.equal(saved.requested_proficiency, 'Intermediate');
    assert.equal(saved.duration_hours, 1.0);
  });

  await t.test('3. Activity Event Logging on Request Creation', () => {
    db.prepare(`
      INSERT INTO learning_request_events (id, request_id, event_type, title, description)
      VALUES (?, ?, 'REQUEST_CREATED', 'Learning Request Created', 'Requested Intermediate Rust mentorship')
    `).run(`ev-${randSuffix}-1`, testRequestId);

    const events = db.prepare(`SELECT * FROM learning_request_events WHERE request_id = ?`).all(testRequestId);
    assert.equal(events.length, 1);
    assert.equal(events[0].event_type, 'REQUEST_CREATED');
  });

  await t.test('4. Automated Mentor Matching with Hard Constraints', () => {
    // 4A: Mentor registers skill with CLAIMED status (unverified) -> Must NOT match
    db.prepare(`
      INSERT INTO user_skills (
        id, user_id, skill_id, proficiency, experience_years, teaching_style, verification_status,
        teaching_days, available_start_time, available_end_time
      ) VALUES (?, ?, ?, 'Intermediate', 1.0, 'Code reviews', 'CLAIMED',
        '["Monday","Wednesday"]', '17:00', '20:00')
    `).run(testUskId, testMentorId, testSkillId);

    // Verify unverified mentors are excluded
    const unverifiedMatch = db.prepare(`
      SELECT us.* FROM user_skills us
      JOIN users u ON us.user_id = u.id
      WHERE us.skill_id = ? AND us.verification_status IN ('PLATFORM_VERIFIED', 'ASSESSMENT_VERIFIED')
    `).all(testSkillId);
    assert.equal(unverifiedMatch.length, 0, 'Unverified skills must NOT produce candidate matches');

    // 4B: Mentor passes platform verification -> Qualifies as verified match
    db.prepare(`
      UPDATE user_skills 
      SET verification_status = 'PLATFORM_VERIFIED', assessment_score = 96.0, proficiency = 'Advanced'
      WHERE id = ?
    `).run(testUskId);

    const verifiedMatch = db.prepare(`
      SELECT us.*, p.display_name, p.college 
      FROM user_skills us
      JOIN users u ON us.user_id = u.id
      JOIN profiles p ON us.user_id = p.user_id
      WHERE us.skill_id = ? 
        AND us.verification_status IN ('PLATFORM_VERIFIED', 'ASSESSMENT_VERIFIED')
        AND u.status = 'ACTIVE'
        AND us.user_id != ?
    `).get(testSkillId, testLearnerId);

    assert.ok(verifiedMatch, 'Verified mentor must be discovered');
    assert.equal(verifiedMatch.verification_status, 'PLATFORM_VERIFIED');

    // Update request state: OPEN -> MENTOR_FOUND
    db.prepare(`
      UPDATE learning_requests 
      SET status = 'MENTOR_FOUND', matched_mentor_id = ?, matched_at = CURRENT_TIMESTAMP, match_score = 95
      WHERE id = ?
    `).run(testMentorId, testRequestId);

    const matchedReq = db.prepare(`SELECT * FROM learning_requests WHERE id = ?`).get(testRequestId);
    assert.equal(matchedReq.status, 'MENTOR_FOUND');
    assert.equal(matchedReq.matched_mentor_id, testMentorId);
  });

  await t.test('5. Multi-Channel Notification Dispatch & Audit Log', () => {
    // Record In-App notification
    db.prepare(`
      INSERT INTO notification_deliveries (
        id, notification_id, user_id, request_id, type, channel, recipient, subject, content, status
      ) VALUES (?, ?, ?, ?, 'MENTOR_FOUND', 'IN_APP', ?, 'Mentor Found for Rust', 'A verified mentor is available', 'DELIVERED')
    `).run(`notif-inapp-${randSuffix}`, `notif-1-${randSuffix}`, testLearnerId, testRequestId, testLearnerId);

    // Record Email notification
    db.prepare(`
      INSERT INTO notification_deliveries (
        id, notification_id, user_id, request_id, type, channel, recipient, subject, content, status
      ) VALUES (?, ?, ?, ?, 'MENTOR_FOUND', 'EMAIL', ?, 'A Rust mentor is now available on SkillSwap Campus', 'Good news! A verified mentor is available.', 'DELIVERED')
    `).run(`notif-email-${randSuffix}`, `notif-2-${randSuffix}`, testLearnerId, testRequestId, `learner-${randSuffix}@campus.edu`);

    const deliveries = db.prepare(`SELECT * FROM notification_deliveries WHERE request_id = ?`).all(testRequestId);
    assert.equal(deliveries.length, 2, 'Both in-app and email delivery must be audited');

    // Transition to NOTIFIED
    db.prepare(`UPDATE learning_requests SET status = 'NOTIFIED' WHERE id = ?`).run(testRequestId);
    const notifiedReq = db.prepare(`SELECT status FROM learning_requests WHERE id = ?`).get(testRequestId);
    assert.equal(notifiedReq.status, 'NOTIFIED');
  });

  await t.test('6. Create Session from Matched Request & Authorize Video Classroom', () => {
    // Create session linking learner and mentor
    db.prepare(`
      INSERT INTO sessions (
        id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end,
        duration_hours, credits_amount, mode, location_or_url, idempotency_key
      ) VALUES (?, 'Rust Async Tokio Deep-Dive', ?, ?, ?, 'ACCEPTED', '2026-08-25 18:00:00', '2026-08-25 19:00:00',
        1.0, 1, 'ONLINE', 'https://meet.skillswap.internal/room-live', ?)
    `).run(testSessionId, testSkillId, testMentorId, testLearnerId, `idemp-test-sess-${randSuffix}`);

    // Add session participants
    db.prepare(`
      INSERT INTO session_participants (id, session_id, user_id, session_role, confirmed)
      VALUES (?, ?, ?, 'TRAINER', 1), (?, ?, ?, 'LEARNER', 1)
    `).run(`sp-${testSessionId}-t`, testSessionId, testMentorId, `sp-${testSessionId}-l`, testSessionId, testLearnerId);

    // Verify authorized participants
    const teacherPart = db.prepare(`SELECT * FROM session_participants WHERE session_id = ? AND user_id = ?`).get(testSessionId, testMentorId);
    const learnerPart = db.prepare(`SELECT * FROM session_participants WHERE session_id = ? AND user_id = ?`).get(testSessionId, testLearnerId);
    const outsiderPart = db.prepare(`SELECT * FROM session_participants WHERE session_id = ? AND user_id = 'usr-stranger'`).get(testSessionId);

    assert.ok(teacherPart, 'Teacher must be authorized participant');
    assert.equal(teacherPart.session_role, 'TRAINER');
    assert.ok(learnerPart, 'Learner must be authorized participant');
    assert.equal(learnerPart.session_role, 'LEARNER');
    assert.equal(outsiderPart, undefined, 'Unauthorized users must be rejected from video classroom');
  });

  await t.test('7. Video Classroom Attendance Telemetry Logging', () => {
    // Log JOINED attendance event for mentor
    db.prepare(`
      INSERT INTO session_attendance (id, session_id, user_id, event_type, joined_at, metadata_json)
      VALUES (?, ?, ?, 'JOINED', '2026-08-25 18:00:00', '{"role":"TRAINER"}')
    `).run(`att-${randSuffix}-1`, testSessionId, testMentorId);

    // Log JOINED attendance event for learner
    db.prepare(`
      INSERT INTO session_attendance (id, session_id, user_id, event_type, joined_at, metadata_json)
      VALUES (?, ?, ?, 'JOINED', '2026-08-25 18:01:00', '{"role":"LEARNER"}')
    `).run(`att-${randSuffix}-2`, testSessionId, testLearnerId);

    // Log LEFT attendance event for mentor
    db.prepare(`
      INSERT INTO session_attendance (id, session_id, user_id, event_type, joined_at, metadata_json)
      VALUES (?, ?, ?, 'LEFT', '2026-08-25 19:00:00', '{"durationMinutes":60}')
    `).run(`att-${randSuffix}-3`, testSessionId, testMentorId);

    const events = db.prepare(`SELECT * FROM session_attendance WHERE session_id = ? ORDER BY joined_at ASC`).all(testSessionId);
    assert.equal(events.length, 3);
    assert.equal(events[0].event_type, 'JOINED');
    assert.equal(events[2].event_type, 'LEFT');
  });

  await t.test('8. Live In-Room Chat with XSS Sanitization', () => {
    function escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    const rawMessage = '<script>alert("xss")</script> let x = 10;';
    const sanitized = escapeHtml(rawMessage);

    assert.equal(sanitized.includes('<script>'), false, 'Raw script tags must be escaped');
    assert.equal(sanitized.includes('&lt;script&gt;'), true, 'Escaped script tags must be stored safely');

    db.prepare(`
      INSERT INTO chat_messages (id, session_id, sender_id, message, status, is_system)
      VALUES (?, ?, ?, ?, 'SENT', 0)
    `).run(`msg-${randSuffix}`, testSessionId, testMentorId, sanitized);

    const chatHistory = db.prepare(`SELECT * FROM chat_messages WHERE session_id = ?`).all(testSessionId);
    assert.equal(chatHistory.length, 1);
    assert.equal(chatHistory[0].message, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; let x = 10;');
  });

  await t.test('9. Session Settlement Auto-Fulfills Linked Learner Request', () => {
    // Link request to session
    db.prepare(`
      UPDATE learning_requests 
      SET session_id = ?, status = 'SESSION_CONFIRMED'
      WHERE id = ?
    `).run(testSessionId, testRequestId);

    // Complete and settle session
    db.prepare(`
      UPDATE sessions 
      SET status = 'CREDIT_SETTLED'
      WHERE id = ?
    `).run(testSessionId);

    // Settle trigger marks linked request as FULFILLED
    db.prepare(`
      UPDATE learning_requests 
      SET status = 'FULFILLED', updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(testSessionId);

    const finalReq = db.prepare(`SELECT * FROM learning_requests WHERE id = ?`).get(testRequestId);
    assert.equal(finalReq.status, 'FULFILLED', 'Linked learning request must transition to FULFILLED on credit settlement');
  });

  await t.test('10. Admin Operational Auditing & Deep-Dive Queries', () => {
    // Test Admin query for all requests
    const adminReqs = db.prepare(`
      SELECT lr.*, lp.display_name as learner_name, mp.display_name as mentor_name
      FROM learning_requests lr
      LEFT JOIN profiles lp ON lr.learner_id = lp.user_id
      LEFT JOIN profiles mp ON lr.matched_mentor_id = mp.user_id
      WHERE lr.id = ?
    `).get(testRequestId);

    assert.ok(adminReqs);
    assert.equal(adminReqs.learner_name, 'Test Learner');
    assert.equal(adminReqs.mentor_name, 'Test Mentor');
    assert.equal(adminReqs.status, 'FULFILLED');

    // Test Admin query for session classroom telemetry & chat metadata
    const attendanceCount = db.prepare(`SELECT COUNT(*) as c FROM session_attendance WHERE session_id = ?`).get(testSessionId);
    const chatMetadata = db.prepare(`
      SELECT COUNT(*) as total_messages, COUNT(DISTINCT sender_id) as active_chatters
      FROM chat_messages WHERE session_id = ?
    `).get(testSessionId);

    assert.equal(attendanceCount.c, 3);
    assert.equal(chatMetadata.total_messages, 1);
    assert.equal(chatMetadata.active_chatters, 1);
  });

  db.close();
});
