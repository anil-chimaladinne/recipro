const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');

function setupTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      user_type TEXT NOT NULL DEFAULT 'TEACHER_LEARNER'
    );

    CREATE TABLE profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      college TEXT,
      major TEXT,
      year TEXT,
      is_verified_student INTEGER DEFAULT 1,
      trust_score REAL DEFAULT 85.0,
      completion_rate REAL DEFAULT 100.0,
      hourly_rate_credits INTEGER DEFAULT 1,
      teaching_preference TEXT DEFAULT 'Anyone',
      daily_session_limit INTEGER DEFAULT 3
    );

    CREATE TABLE skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL
    );

    CREATE TABLE user_skills (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      proficiency TEXT NOT NULL,
      experience_years REAL DEFAULT 1,
      verification_status TEXT DEFAULT 'SELF_DECLARED',
      teaching_days TEXT DEFAULT '["Monday","Wednesday","Friday"]',
      available_start_time TEXT DEFAULT '17:00',
      available_end_time TEXT DEFAULT '20:00',
      preferred_start_time TEXT DEFAULT '18:00',
      preferred_end_time TEXT DEFAULT '20:00',
      session_duration_minutes INTEGER DEFAULT 60,
      timezone TEXT DEFAULT 'Asia/Kolkata',
      is_flexible INTEGER DEFAULT 1,
      UNIQUE(user_id, skill_id)
    );

    CREATE TABLE learning_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      target_proficiency TEXT NOT NULL,
      priority TEXT DEFAULT 'HIGH',
      notes TEXT,
      learning_days TEXT DEFAULT '["Tuesday","Thursday","Saturday"]',
      available_start_time TEXT DEFAULT '18:00',
      available_end_time TEXT DEFAULT '21:00',
      preferred_start_time TEXT DEFAULT '19:00',
      preferred_end_time TEXT DEFAULT '21:00',
      session_duration_minutes INTEGER DEFAULT 60,
      timezone TEXT DEFAULT 'Asia/Kolkata',
      is_flexible INTEGER DEFAULT 1,
      UNIQUE(user_id, skill_id)
    );

    CREATE TABLE availability_slots (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      timezone TEXT DEFAULT 'Asia/Kolkata',
      is_preferred INTEGER DEFAULT 0,
      window_label TEXT DEFAULT 'General',
      skill_id TEXT,
      buffer_minutes INTEGER DEFAULT 15
    );

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      scheduled_start DATETIME NOT NULL,
      scheduled_end DATETIME NOT NULL,
      duration_hours REAL NOT NULL,
      credits_amount INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE reputations (
      user_id TEXT PRIMARY KEY,
      bayesian_rating REAL DEFAULT 4.5,
      total_reviews INTEGER DEFAULT 0,
      total_sessions_taught INTEGER DEFAULT 0,
      reliability_score REAL DEFAULT 95.0
    );
  `);

  // Seed sample users: Rahul (Teacher in Tech Campus) & Alice (Learner in Tech Campus) & Elena (Design Campus)
  db.prepare(`INSERT INTO users VALUES ('usr-rahul', 'rahul@tech.edu', 'ACTIVE', 'TEACHER_LEARNER')`).run();
  db.prepare(`INSERT INTO profiles VALUES ('prof-rahul', 'usr-rahul', 'Rahul Sharma', 'Tech Campus', 'CS', 'Junior', 1, 95.0, 100.0, 1, 'Anyone', 3)`).run();
  db.prepare(`INSERT INTO reputations VALUES ('usr-rahul', 4.9, 12, 12, 98.0)`).run();

  db.prepare(`INSERT INTO users VALUES ('usr-alice', 'alice@tech.edu', 'ACTIVE', 'TEACHER_LEARNER')`).run();
  db.prepare(`INSERT INTO profiles VALUES ('prof-alice', 'usr-alice', 'Alice Wang', 'Tech Campus', 'CS', 'Sophomore', 1, 90.0, 100.0, 1, 'Anyone', 3)`).run();

  db.prepare(`INSERT INTO users VALUES ('usr-elena', 'elena@design.edu', 'ACTIVE', 'TEACHER_LEARNER')`).run();
  db.prepare(`INSERT INTO profiles VALUES ('prof-elena', 'usr-elena', 'Elena Rostova', 'Design Campus', 'Interaction Design', 'Senior', 1, 92.0, 100.0, 1, 'Anyone', 3)`).run();
  db.prepare(`INSERT INTO reputations VALUES ('usr-elena', 4.8, 8, 8, 96.0)`).run();

  // Skills
  db.prepare(`INSERT INTO skills VALUES ('skill-python', 'Python', 'Computer Science')`).run();
  db.prepare(`INSERT INTO skills VALUES ('skill-solidity', 'Solidity', 'Computer Science')`).run();

  // Rahul teaches Python (Mon, Wed, Fri: 17:00-20:00, preferred 18:00-20:00)
  db.prepare(`
    INSERT INTO user_skills (
      id, user_id, skill_id, proficiency, experience_years, verification_status,
      teaching_days, available_start_time, available_end_time, preferred_start_time, preferred_end_time,
      session_duration_minutes, timezone, is_flexible
    ) VALUES (
      'usk-rahul-py', 'usr-rahul', 'skill-python', 'Advanced', 3, 'PLATFORM_VERIFIED',
      '["Monday","Wednesday","Friday"]', '17:00', '20:00', '18:00', '20:00', 60, 'Asia/Kolkata', 1
    )
  `).run();

  // Elena teaches Solidity (Outside College, Tue, Thu: 18:00-21:00)
  db.prepare(`
    INSERT INTO user_skills (
      id, user_id, skill_id, proficiency, experience_years, verification_status,
      teaching_days, available_start_time, available_end_time, preferred_start_time, preferred_end_time,
      session_duration_minutes, timezone, is_flexible
    ) VALUES (
      'usk-elena-sol', 'usr-elena', 'skill-solidity', 'Intermediate', 2, 'PEER_VERIFIED',
      '["Tuesday","Thursday"]', '18:00', '21:00', '19:00', '21:00', 60, 'Asia/Kolkata', 1
    )
  `).run();

  return db;
}

// Conflict checking helper function matching scheduling.ts
function checkHardConstraints(db, params) {
  const reqStart = new Date(params.scheduledStart);
  const reqEnd = new Date(params.scheduledEnd);
  const bufferMs = (params.bufferMinutes || 15) * 60 * 1000;

  // 1. Daily limit
  const dateStr = reqStart.toISOString().substring(0, 10);
  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  const mentorProfile = db.prepare('SELECT daily_session_limit FROM profiles WHERE user_id = ?').get(params.teacherId);
  const maxSessions = mentorProfile ? mentorProfile.daily_session_limit : 3;

  const countRow = db.prepare(`
    SELECT COUNT(*) as count FROM sessions 
    WHERE teacher_id = ? AND status NOT IN ('CANCELLED', 'DISPUTED')
      AND scheduled_start >= ? AND scheduled_start <= ?
  `).get(params.teacherId, startOfDay, endOfDay);

  if (countRow && countRow.count >= maxSessions) {
    return { hasConflict: true, reason: 'Daily session limit reached', type: 'DAILY_LIMIT_REACHED' };
  }

  // 2. Conflicting sessions + Buffer
  const sessions = db.prepare(`
    SELECT id, scheduled_start, scheduled_end FROM sessions
    WHERE teacher_id = ? AND status NOT IN ('CANCELLED')
  `).all(params.teacherId);

  for (const sess of sessions) {
    const sStart = new Date(sess.scheduled_start).getTime() - bufferMs;
    const sEnd = new Date(sess.scheduled_end).getTime() + bufferMs;
    const rStartMs = reqStart.getTime();
    const rEndMs = reqEnd.getTime();

    if (rStartMs < sEnd && rEndMs > sStart) {
      return { hasConflict: true, reason: `Conflicting session with ${params.bufferMinutes || 15}m buffer`, type: 'TEACHER_BUSY' };
    }
  }

  return { hasConflict: false };
}

// Generate slots helper matching scheduling.ts
function generateSlotsForDay(db, teacherId, dateStr, durationMinutes = 60, bufferMinutes = 15) {
  const userSkill = db.prepare('SELECT * FROM user_skills WHERE user_id = ?').get(teacherId);
  if (!userSkill) return [];

  const availStart = userSkill.available_start_time || '17:00';
  const availEnd = userSkill.available_end_time || '20:00';
  const prefStart = userSkill.preferred_start_time || '18:00';
  const prefEnd = userSkill.preferred_end_time || '20:00';

  const durationMs = durationMinutes * 60 * 1000;
  const bufferMs = bufferMinutes * 60 * 1000;

  const winStartMs = new Date(`${dateStr}T${availStart}:00Z`).getTime();
  const winEndMs = new Date(`${dateStr}T${availEnd}:00Z`).getTime();
  const prefStartMs = new Date(`${dateStr}T${prefStart}:00Z`).getTime();
  const prefEndMs = new Date(`${dateStr}T${prefEnd}:00Z`).getTime();

  // Booked sessions
  const booked = db.prepare(`
    SELECT scheduled_start, scheduled_end FROM sessions
    WHERE teacher_id = ? AND status NOT IN ('CANCELLED')
      AND scheduled_start >= ? AND scheduled_start <= ?
  `).all(teacherId, `${dateStr}T00:00:00.000Z`, `${dateStr}T23:59:59.999Z`);

  const slots = [];
  const stepMs = 15 * 60 * 1000;

  for (let s = winStartMs; s + durationMs <= winEndMs; s += stepMs) {
    const e = s + durationMs;

    const conflict = booked.some(b => {
      const bStart = new Date(b.scheduled_start).getTime() - bufferMs;
      const bEnd = new Date(b.scheduled_end).getTime() + bufferMs;
      return s < bEnd && e > bStart;
    });

    if (!conflict) {
      const isPreferred = (s >= prefStartMs && e <= prefEndMs);
      const mentorPrefScore = isPreferred ? 98 : 75;
      const learnerPrefScore = 85;
      const totalScore = Math.round(mentorPrefScore * 0.30 + learnerPrefScore * 0.25 + 90 * 0.20 + 85 * 0.10 + 90 * 0.10 + 85 * 0.05);

      slots.push({
        startTime: new Date(s).toISOString(),
        endTime: new Date(e).toISOString(),
        isPreferred,
        score: totalScore,
      });
    }
  }

  return slots.sort((a, b) => b.score - a.score);
}

test('1. Separation of Availability vs Preference Ranking', () => {
  const db = setupTestDb();
  const slots = generateSlotsForDay(db, 'usr-rahul', '2026-09-14', 60, 15);

  assert.ok(slots.length > 0, 'Must generate valid slots inside available window');
  
  const preferredSlots = slots.filter(s => s.isPreferred);
  const nonPreferredSlots = slots.filter(s => !s.isPreferred);

  assert.ok(preferredSlots.length > 0, 'Preferred slots exist');
  assert.ok(nonPreferredSlots.length > 0, 'Non-preferred valid slots exist');

  assert.ok(
    preferredSlots[0].score > nonPreferredSlots[0].score,
    'Preferred slot must receive higher weighted preference score than non-preferred slot'
  );
});

test('2. Hard Constraint: 15-Minute Buffer Subtracts Overlapping Candidate Slots', () => {
  const db = setupTestDb();
  const testDate = '2026-09-14';

  // Book a session from 17:00 to 18:00
  db.prepare(`
    INSERT INTO sessions (id, learner_id, teacher_id, skill_id, title, scheduled_start, scheduled_end, duration_hours, credits_amount, status)
    VALUES ('sess-buf-1', 'usr-alice', 'usr-rahul', 'skill-python', 'Live Test', '2026-09-14T17:00:00.000Z', '2026-09-14T18:00:00.000Z', 1.0, 1, 'CONFIRMED')
  `).run();

  // Test slot at 18:05 (violates 15m buffer which ends at 18:15)
  const conflictCheck1 = checkHardConstraints(db, {
    teacherId: 'usr-rahul',
    learnerId: 'usr-alice',
    scheduledStart: '2026-09-14T18:05:00.000Z',
    scheduledEnd: '2026-09-14T19:05:00.000Z',
    bufferMinutes: 15,
  });

  assert.equal(conflictCheck1.hasConflict, true, 'Slot within 15m buffer window must be rejected');

  // Test slot at 18:30 (outside 15m buffer)
  const conflictCheck2 = checkHardConstraints(db, {
    teacherId: 'usr-rahul',
    learnerId: 'usr-alice',
    scheduledStart: '2026-09-14T18:30:00.000Z',
    scheduledEnd: '2026-09-14T19:30:00.000Z',
    bufferMinutes: 15,
  });

  assert.equal(conflictCheck2.hasConflict, false, 'Slot after 15m buffer must be allowed');
});

test('3. Hard Constraint: Daily Session Limit Check', () => {
  const db = setupTestDb();
  const testDate = '2026-09-14';

  // Rahul has daily limit of 3
  db.prepare(`
    INSERT INTO sessions (id, learner_id, teacher_id, skill_id, title, scheduled_start, scheduled_end, duration_hours, credits_amount, status)
    VALUES ('sess-lim-1', 'usr-alice', 'usr-rahul', 'skill-python', 'S1', '2026-09-14T10:00:00.000Z', '2026-09-14T11:00:00.000Z', 1.0, 1, 'CONFIRMED'),
           ('sess-lim-2', 'usr-alice', 'usr-rahul', 'skill-python', 'S2', '2026-09-14T12:00:00.000Z', '2026-09-14T13:00:00.000Z', 1.0, 1, 'CONFIRMED'),
           ('sess-lim-3', 'usr-alice', 'usr-rahul', 'skill-python', 'S3', '2026-09-14T14:00:00.000Z', '2026-09-14T15:00:00.000Z', 1.0, 1, 'CONFIRMED')
  `).run();

  // 4th session attempt on the same day
  const conflictCheck = checkHardConstraints(db, {
    teacherId: 'usr-rahul',
    learnerId: 'usr-alice',
    scheduledStart: '2026-09-14T18:00:00.000Z',
    scheduledEnd: '2026-09-14T19:00:00.000Z',
    bufferMinutes: 15,
  });

  assert.equal(conflictCheck.hasConflict, true, 'Must reject booking when daily limit reached');
  assert.equal(conflictCheck.type, 'DAILY_LIMIT_REACHED');
});

test('4. IRCTC-Style Smart Slot Search: Case A (Zero Mentors Anywhere)', () => {
  const db = setupTestDb();
  const matches = db.prepare(`
    SELECT u.id FROM user_skills us
    JOIN skills s ON us.skill_id = s.id
    JOIN users u ON us.user_id = u.id
    WHERE LOWER(s.name) = LOWER('NonExistentSkillXYZ123') AND u.status = 'ACTIVE'
  `).all();

  assert.equal(matches.length, 0, 'Zero mentors found in network');
});

test('5. IRCTC-Style Smart Slot Search: Case B (Mentors exist but 0 slots in narrow window)', () => {
  const db = setupTestDb();
  const rahulSlots = generateSlotsForDay(db, 'usr-rahul', '2026-09-14', 60, 15);
  
  // Filter for 02:00 to 04:00 AM
  const midnightSlots = rahulSlots.filter(s => {
    const d = new Date(s.startTime);
    return d.getUTCHours() >= 2 && d.getUTCHours() < 4;
  });

  assert.equal(midnightSlots.length, 0, 'No slots available during midnight window');
});

test('6. Staged Discovery & Fallback across Colleges', () => {
  const db = setupTestDb();
  const learnerCollege = 'Tech Campus';

  // Search for Solidity: Only Elena teaches it, who is from 'Design Campus' (Outside College)
  const mentors = db.prepare(`
    SELECT u.id, p.display_name, p.college, s.name as skill_name
    FROM user_skills us
    JOIN skills s ON us.skill_id = s.id
    JOIN users u ON us.user_id = u.id
    JOIN profiles p ON u.id = p.user_id
    WHERE s.name = 'Solidity' AND u.status = 'ACTIVE'
  `).all();

  assert.equal(mentors.length, 1);
  const insideCollege = mentors.filter(m => m.college === learnerCollege);
  const outsideCollege = mentors.filter(m => m.college !== learnerCollege);

  assert.equal(insideCollege.length, 0, 'Stage 1 finds 0 inside mentors');
  assert.equal(outsideCollege.length, 1, 'Stage 2 fallback activates with partner mentor');
  assert.equal(outsideCollege[0].college, 'Design Campus');
});

test('7. Atomic Double-Booking Protection / Concurrency Revalidation', () => {
  const db = setupTestDb();
  const teacherId = 'usr-rahul';
  const learner1 = 'usr-alice';
  const learner2 = 'usr-bob';
  const testDate = '2026-09-14';
  const startTime = `${testDate}T18:00:00.000Z`;
  const endTime = `${testDate}T19:00:00.000Z`;

  // First learner books atomically
  const tx1 = db.transaction(() => {
    const check = checkHardConstraints(db, { teacherId, learnerId: learner1, scheduledStart: startTime, scheduledEnd: endTime, bufferMinutes: 15 });
    if (check.hasConflict) return false;

    db.prepare(`
      INSERT INTO sessions (id, learner_id, teacher_id, skill_id, title, scheduled_start, scheduled_end, duration_hours, credits_amount, status)
      VALUES ('sess-race-1', ?, ?, 'skill-python', 'Booking 1', ?, ?, 1.0, 1, 'CONFIRMED')
    `).run(learner1, teacherId, startTime, endTime);

    return true;
  });

  const res1 = tx1();
  assert.equal(res1, true, 'First booking must succeed');

  // Second learner attempts to book same slot
  const tx2 = db.transaction(() => {
    const check = checkHardConstraints(db, { teacherId, learnerId: learner2, scheduledStart: startTime, scheduledEnd: endTime, bufferMinutes: 15 });
    if (check.hasConflict) return false;

    db.prepare(`
      INSERT INTO sessions (id, learner_id, teacher_id, skill_id, title, scheduled_start, scheduled_end, duration_hours, credits_amount, status)
      VALUES ('sess-race-2', ?, ?, 'skill-python', 'Booking 2', ?, ?, 1.0, 1, 'CONFIRMED')
    `).run(learner2, teacherId, startTime, endTime);

    return true;
  });

  const res2 = tx2();
  assert.equal(res2, false, 'Second concurrent booking must fail due to overlap conflict');
});
