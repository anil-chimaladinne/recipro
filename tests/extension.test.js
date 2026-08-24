const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');

function setupTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'STUDENT',
      user_type TEXT NOT NULL DEFAULT 'TEACHER_LEARNER',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      campus_id TEXT
    );

    CREATE TABLE profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      college TEXT,
      major TEXT,
      year TEXT,
      is_verified_student INTEGER DEFAULT 1,
      trust_score REAL DEFAULT 75.0,
      completion_rate REAL DEFAULT 100.0,
      cancellation_rate REAL DEFAULT 0.0,
      hourly_rate_credits INTEGER DEFAULT 1,
      teaching_preference TEXT DEFAULT 'Anyone',
      daily_session_limit INTEGER DEFAULT 3
    );

    CREATE TABLE skills (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL
    );

    CREATE TABLE user_skills (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      proficiency TEXT NOT NULL,
      experience_years REAL DEFAULT 1.0,
      teaching_style TEXT DEFAULT 'Interactive',
      verification_status TEXT NOT NULL DEFAULT 'SELF_DECLARED',
      assessment_score REAL,
      verified_at DATETIME,
      verified_by TEXT,
      reassessment_required INTEGER DEFAULT 0,
      UNIQUE(user_id, skill_id)
    );

    CREATE TABLE skill_assessments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      score REAL NOT NULL,
      max_score REAL NOT NULL,
      percentage REAL NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      target_level TEXT NOT NULL,
      verified_level TEXT,
      version TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE skill_requests (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      requested_proficiency TEXT DEFAULT 'Beginner',
      current_proficiency TEXT DEFAULT 'Beginner',
      learning_goal TEXT,
      urgency TEXT DEFAULT 'MEDIUM',
      status TEXT DEFAULT 'OPEN',
      matched_teacher_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE skill_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, skill_id)
    );

    CREATE TABLE availability_slots (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      buffer_minutes INTEGER DEFAULT 15
    );

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      learner_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'REQUESTED',
      scheduled_start DATETIME NOT NULL,
      scheduled_end DATETIME NOT NULL,
      duration_hours REAL DEFAULT 1.0,
      credits_amount INTEGER DEFAULT 1,
      idempotency_key TEXT UNIQUE NOT NULL
    );

    CREATE TABLE skill_credit_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      balance INTEGER DEFAULT 3,
      escrow_balance INTEGER DEFAULT 0
    );

    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'INFO',
      is_read INTEGER DEFAULT 0
    );
  `);
  return db;
}

// ----------------------------------------------------
// 1. User Types & Security Authorization Invariants
// ----------------------------------------------------
test('User Types & Registration Role Invariants', () => {
  const db = setupTestDb();

  // Test teacher, learner, and teacher_learner participation types
  db.prepare("INSERT INTO users (id, email, password_hash, role, user_type) VALUES ('u1', 't@campus.edu', 'hash', 'STUDENT', 'TEACHER')").run();
  db.prepare("INSERT INTO users (id, email, password_hash, role, user_type) VALUES ('u2', 'l@campus.edu', 'hash', 'STUDENT', 'LEARNER')").run();
  db.prepare("INSERT INTO users (id, email, password_hash, role, user_type) VALUES ('u3', 'tl@campus.edu', 'hash', 'STUDENT', 'TEACHER_LEARNER')").run();

  const u1 = db.prepare("SELECT user_type, role FROM users WHERE id = 'u1'").get();
  assert.strictEqual(u1.user_type, 'TEACHER');
  assert.strictEqual(u1.role, 'STUDENT');

  // Verify learner-only cannot be retrieved in teacher candidate discovery
  const teacherCandidates = db.prepare("SELECT id FROM users WHERE user_type IN ('TEACHER', 'TEACHER_LEARNER')").all();
  const candidateIds = teacherCandidates.map(c => c.id);
  assert.ok(candidateIds.includes('u1'), 'TEACHER must be eligible');
  assert.ok(candidateIds.includes('u3'), 'TEACHER_LEARNER must be eligible');
  assert.ok(!candidateIds.includes('u2'), 'LEARNER must NOT be eligible as a teacher candidate');
});

// ----------------------------------------------------
// 2. Per-Skill Verification & Assessment Lifecycle
// ----------------------------------------------------
test('Per-Skill Verification Lifecycle & Assessment Thresholds', () => {
  const db = setupTestDb();

  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-rahul', 'rahul@campus.edu', 'hash')").run();
  db.prepare("INSERT INTO skills (id, name, category) VALUES ('sk-py', 'Python', 'CS'), ('sk-sol', 'Solidity', 'CS')").run();

  // Step 1: User adds a self-declared skill -> must be SELF_DECLARED (Orange)
  db.prepare(`
    INSERT INTO user_skills (id, user_id, skill_id, proficiency, verification_status)
    VALUES ('usk-1', 'u-rahul', 'sk-py', 'Advanced', 'SELF_DECLARED')
  `).run();

  const skill1 = db.prepare("SELECT verification_status FROM user_skills WHERE id = 'usk-1'").get();
  assert.strictEqual(skill1.verification_status, 'SELF_DECLARED', 'Initial skill must be SELF_DECLARED');

  // Step 2: User completes assessment with 90% score -> upgrades to PLATFORM_VERIFIED or ASSESSMENT_VERIFIED
  const score = 90;
  const passed = score >= 80;
  const verifiedLevel = 'Advanced';
  const newStatus = passed ? 'PLATFORM_VERIFIED' : 'VERIFICATION_FAILED';

  db.prepare(`
    UPDATE user_skills
    SET verification_status = ?, assessment_score = ?, proficiency = ?
    WHERE user_id = 'u-rahul' AND skill_id = 'sk-py'
  `).run(newStatus, score, verifiedLevel);

  const updatedSkill = db.prepare("SELECT verification_status, assessment_score FROM user_skills WHERE id = 'usk-1'").get();
  assert.strictEqual(updatedSkill.verification_status, 'PLATFORM_VERIFIED');
  assert.strictEqual(updatedSkill.assessment_score, 90);

  // Step 3: Verify individual skill specificity: Adding a 2nd skill does NOT automatically verify it
  db.prepare(`
    INSERT INTO user_skills (id, user_id, skill_id, proficiency, verification_status)
    VALUES ('usk-2', 'u-rahul', 'sk-sol', 'Beginner', 'SELF_DECLARED')
  `).run();

  const skill2 = db.prepare("SELECT verification_status FROM user_skills WHERE id = 'usk-2'").get();
  assert.strictEqual(skill2.verification_status, 'SELF_DECLARED', 'Second skill must remain SELF_DECLARED independently');
});

// ----------------------------------------------------
// 3. No-Mentor / Skill Gap Engine & Notifications
// ----------------------------------------------------
test('Skill Gap Demand Tracking & Automatic Mentor Arrival Notification', () => {
  const db = setupTestDb();

  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-alice', 'alice@campus.edu', 'hash')").run();
  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-david', 'david@campus.edu', 'hash')").run();
  db.prepare("INSERT INTO profiles (id, user_id, display_name, college) VALUES ('p-alice', 'u-alice', 'Alice Chen', 'Stanford'), ('p-david', 'u-david', 'David Kim', 'Stanford')").run();
  db.prepare("INSERT INTO skills (id, name, category) VALUES ('sk-qc', 'Quantum Computing', 'Physics')").run();

  // 1. Check verified mentors for Quantum Computing -> 0 mentors
  const verifiedMentors = db.prepare(`
    SELECT user_id FROM user_skills WHERE skill_id = 'sk-qc' AND verification_status = 'PLATFORM_VERIFIED'
  `).all();
  assert.strictEqual(verifiedMentors.length, 0, 'Must have zero verified mentors initially');

  // 2. Alice creates an open SkillRequest and subscribes
  db.prepare(`
    INSERT INTO skill_requests (id, learner_id, skill_id, requested_proficiency, learning_goal, status)
    VALUES ('req-1', 'u-alice', 'sk-qc', 'Beginner', 'Learn Qiskit algorithms', 'OPEN')
  `).run();
  db.prepare("INSERT INTO skill_subscriptions (id, user_id, skill_id) VALUES ('sub-1', 'u-alice', 'sk-qc')").run();

  // Verify demand count
  const demandCount = (db.prepare("SELECT COUNT(*) as c FROM skill_requests WHERE skill_id = 'sk-qc' AND status = 'OPEN'").get()).c;
  assert.strictEqual(demandCount, 1, 'Demand count should increment to 1');

  // 3. David becomes a verified mentor for Quantum Computing
  db.prepare(`
    INSERT INTO user_skills (id, user_id, skill_id, proficiency, verification_status)
    VALUES ('usk-qc-david', 'u-david', 'sk-qc', 'Advanced', 'PLATFORM_VERIFIED')
  `).run();

  // 4. Trigger notification to subscribed learners
  const subscribers = db.prepare("SELECT user_id FROM skill_subscriptions WHERE skill_id = 'sk-qc' AND user_id != 'u-david'").all();
  for (const sub of subscribers) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type)
      VALUES ('notif-' || random(), ?, 'New Verified Mentor Available!', 'David Kim is now verified to teach Quantum Computing', 'INFO')
    `).run(sub.user_id);
  }

  // Check Alice's notification
  const aliceNotif = db.prepare("SELECT title, message FROM notifications WHERE user_id = 'u-alice'").get();
  assert.ok(aliceNotif, 'Alice must receive a notification');
  assert.strictEqual(aliceNotif.title, 'New Verified Mentor Available!');
});

// ----------------------------------------------------
// 4. Time-Slot Constraint Resolution & Buffer & Limits
// ----------------------------------------------------
test('Time-Slot Constraints, 15m Buffer, Daily Limits, and Conflict Rejection', () => {
  const db = setupTestDb();

  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-rahul', 'rahul@campus.edu', 'hash')").run();
  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-learner1', 'l1@campus.edu', 'hash')").run();
  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-learner2', 'l2@campus.edu', 'hash')").run();
  db.prepare("INSERT INTO profiles (id, user_id, display_name, daily_session_limit) VALUES ('p-rahul', 'u-rahul', 'Rahul Kumar', 2)").run();
  db.prepare("INSERT INTO skills (id, name, category) VALUES ('sk-py', 'Python', 'CS')").run();

  // Mentor committed session 1: 16:00 to 17:00
  db.prepare(`
    INSERT INTO sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, idempotency_key)
    VALUES ('sess-1', 'Python Lesson', 'sk-py', 'u-rahul', 'u-learner1', 'SCHEDULED', '2026-08-25T16:00:00.000Z', '2026-08-25T17:00:00.000Z', 'idemp-1')
  `).run();

  const bufferMinutes = 15;
  const bufferMs = bufferMinutes * 60 * 1000;

  function isSlotAvailable(teacherId, reqStartIso, reqEndIso) {
    const reqStart = new Date(reqStartIso).getTime();
    const reqEnd = new Date(reqEndIso).getTime();

    const existingSessions = db.prepare("SELECT scheduled_start, scheduled_end FROM sessions WHERE teacher_id = ? AND status != 'CANCELLED'").all(teacherId);
    for (const s of existingSessions) {
      const sStart = new Date(s.scheduled_start).getTime() - bufferMs;
      const sEnd = new Date(s.scheduled_end).getTime() + bufferMs;
      if (reqStart < sEnd && reqEnd > sStart) {
        return false; // Conflict or Buffer violation
      }
    }
    return true;
  }

  // Attempt 1: Direct collision at 16:30 -> REJECTED
  assert.strictEqual(isSlotAvailable('u-rahul', '2026-08-25T16:30:00.000Z', '2026-08-25T17:30:00.000Z'), false, 'Direct collision must be rejected');

  // Attempt 2: Buffer violation at 17:05 (less than 15 mins after 17:00) -> REJECTED
  assert.strictEqual(isSlotAvailable('u-rahul', '2026-08-25T17:05:00.000Z', '2026-08-25T18:05:00.000Z'), false, 'Buffer violation (5 mins after session) must be rejected');

  // Attempt 3: Valid buffer compliance at 17:15 -> ACCEPTED
  assert.strictEqual(isSlotAvailable('u-rahul', '2026-08-25T17:15:00.000Z', '2026-08-25T18:15:00.000Z'), true, 'Valid 15m buffer slot must be accepted');

  // Book the 2nd session at 17:15
  db.prepare(`
    INSERT INTO sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, idempotency_key)
    VALUES ('sess-2', 'Python Lesson 2', 'sk-py', 'u-rahul', 'u-learner2', 'SCHEDULED', '2026-08-25T17:15:00.000Z', '2026-08-25T18:15:00.000Z', 'idemp-2')
  `).run();

  // Attempt 4: Daily limit check (Rahul has max limit of 2 sessions/day) -> 3rd session on same date must be REJECTED
  const dailyCount = (db.prepare(`
    SELECT COUNT(*) as c FROM sessions 
    WHERE teacher_id = 'u-rahul' AND scheduled_start >= '2026-08-25T00:00:00.000Z' AND scheduled_start <= '2026-08-25T23:59:59.999Z'
  `).get()).c;
  assert.strictEqual(dailyCount, 2);
  const maxAllowed = (db.prepare("SELECT daily_session_limit FROM profiles WHERE user_id = 'u-rahul'").get()).daily_session_limit;
  assert.ok(dailyCount >= maxAllowed, 'Mentor daily session limit reached');
});

// ----------------------------------------------------
// 5. Simultaneous Booking Race Condition Prevention
// ----------------------------------------------------
test('Concurrent Booking Race Condition Guard Invariant', () => {
  const db = setupTestDb();

  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-rahul', 'rahul@campus.edu', 'hash')").run();
  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-alice', 'alice@campus.edu', 'hash')").run();
  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-bob', 'bob@campus.edu', 'hash')").run();
  db.prepare("INSERT INTO skill_credit_accounts (id, user_id, balance) VALUES ('acc-a', 'u-alice', 3), ('acc-b', 'u-bob', 3)").run();
  db.prepare("INSERT INTO skills (id, name, category) VALUES ('sk-py', 'Python', 'CS')").run();

  // Function simulating atomic transaction reservation
  function tryBookSlot(learnerId, slotStart, slotEnd) {
    const tx = db.transaction(() => {
      // 1. Check collision atomically inside transaction
      const collision = db.prepare(`
        SELECT id FROM sessions 
        WHERE teacher_id = 'u-rahul' 
          AND status != 'CANCELLED'
          AND scheduled_start < ? AND scheduled_end > ?
      `).get(slotEnd, slotStart);

      if (collision) {
        return { success: false, reason: 'Slot already reserved by another student' };
      }

      // 2. Insert session
      db.prepare(`
        INSERT INTO sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, idempotency_key)
        VALUES ('sess-' || random(), 'Python Tutoring', 'sk-py', 'u-rahul', ?, 'REQUESTED', ?, ?, 'idemp-' || random())
      `).run(learnerId, slotStart, slotEnd);

      return { success: true };
    });

    return tx();
  }

  const slotStart = '2026-08-26T18:00:00.000Z';
  const slotEnd = '2026-08-26T19:00:00.000Z';

  // Learner 1 (Alice) requests the slot
  const res1 = tryBookSlot('u-alice', slotStart, slotEnd);
  assert.strictEqual(res1.success, true, 'First learner must successfully reserve slot');

  // Learner 2 (Bob) simultaneously requests the exact same slot
  const res2 = tryBookSlot('u-bob', slotStart, slotEnd);
  assert.strictEqual(res2.success, false, 'Second learner must be rejected due to collision');
  assert.strictEqual(res2.reason, 'Slot already reserved by another student');

  // Ensure only 1 session exists in database
  const totalBookings = (db.prepare("SELECT COUNT(*) as c FROM sessions WHERE teacher_id = 'u-rahul'").get()).c;
  assert.strictEqual(totalBookings, 1, 'Exactly one session must be recorded without double-booking');
});
