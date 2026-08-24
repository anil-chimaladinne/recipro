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
      hourly_rate_credits INTEGER DEFAULT 1,
      teaching_preference TEXT DEFAULT 'Anyone'
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
      UNIQUE(user_id, skill_id)
    );

    CREATE TABLE skill_requests (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      requested_proficiency TEXT DEFAULT 'Beginner',
      current_proficiency TEXT DEFAULT 'Beginner',
      learning_goal TEXT,
      preferred_schedule TEXT,
      preferred_session_mode TEXT DEFAULT 'ONLINE',
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

    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'INFO',
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

// ----------------------------------------------------
// Test 1: Stage 1 — Inside College Mentor Discovery
// ----------------------------------------------------
test('Stage 1: Inside College Mentor is discovered first when available', () => {
  const db = setupTestDb();

  // Create Learner at MIT
  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-mit-learner', 'l@mit.edu', 'hash')").run();
  db.prepare("INSERT INTO profiles (id, user_id, display_name, college) VALUES ('p-1', 'u-mit-learner', 'Ben MIT', 'MIT')").run();

  // Create Mentor at MIT teaching React
  db.prepare("INSERT INTO users (id, email, password_hash, user_type) VALUES ('u-mit-mentor', 'm@mit.edu', 'hash', 'TEACHER')").run();
  db.prepare("INSERT INTO profiles (id, user_id, display_name, college) VALUES ('p-2', 'u-mit-mentor', 'Sarah MIT', 'MIT')").run();

  // Create Mentor at Stanford teaching React
  db.prepare("INSERT INTO users (id, email, password_hash, user_type) VALUES ('u-stan-mentor', 's@stanford.edu', 'hash', 'TEACHER')").run();
  db.prepare("INSERT INTO profiles (id, user_id, display_name, college) VALUES ('p-3', 'u-stan-mentor', 'Alice Stanford', 'Stanford')").run();

  db.prepare("INSERT INTO skills (id, name, category) VALUES ('sk-react', 'React', 'Computer Science')").run();
  db.prepare("INSERT INTO user_skills (id, user_id, skill_id, proficiency, verification_status) VALUES ('usk-1', 'u-mit-mentor', 'sk-react', 'Advanced', 'PLATFORM_VERIFIED')").run();
  db.prepare("INSERT INTO user_skills (id, user_id, skill_id, proficiency, verification_status) VALUES ('usk-2', 'u-stan-mentor', 'sk-react', 'Advanced', 'PLATFORM_VERIFIED')").run();

  const requesterCollege = 'MIT';
  const query = 'React';

  const candidates = db.prepare(`
    SELECT u.id as user_id, p.display_name, p.college, s.name as skill_name, us.proficiency, us.verification_status
    FROM user_skills us
    JOIN skills s ON us.skill_id = s.id
    JOIN users u ON us.user_id = u.id
    JOIN profiles p ON u.id = p.user_id
    WHERE u.status = 'ACTIVE' 
      AND u.id != 'u-mit-learner'
      AND LOWER(s.name) LIKE ?
  `).all(`%${query.toLowerCase()}%`);

  const insideCollegeMatches = candidates.filter(c => c.college?.toLowerCase() === requesterCollege.toLowerCase());
  const outsideCollegeMatches = candidates.filter(c => c.college?.toLowerCase() !== requesterCollege.toLowerCase());

  assert.strictEqual(insideCollegeMatches.length, 1, 'Should find 1 inside college mentor');
  assert.strictEqual(insideCollegeMatches[0].display_name, 'Sarah MIT');
  assert.strictEqual(outsideCollegeMatches.length, 1, 'Should find 1 outside college mentor');
  assert.strictEqual(outsideCollegeMatches[0].display_name, 'Alice Stanford');
});

// ----------------------------------------------------
// Test 2: Stage 2 — Outside College Fallback when Inside is Empty
// ----------------------------------------------------
test('Stage 2: Outside College Fallback activates when no inside-college mentor exists', () => {
  const db = setupTestDb();

  // Create Learner at MIT searching for Solidity
  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-mit-learner', 'l@mit.edu', 'hash')").run();
  db.prepare("INSERT INTO profiles (id, user_id, display_name, college) VALUES ('p-1', 'u-mit-learner', 'Ben MIT', 'MIT')").run();

  // Only Stanford has a mentor for Solidity
  db.prepare("INSERT INTO users (id, email, password_hash, user_type) VALUES ('u-stan-mentor', 's@stanford.edu', 'hash', 'TEACHER')").run();
  db.prepare("INSERT INTO profiles (id, user_id, display_name, college) VALUES ('p-2', 'u-stan-mentor', 'Rahul Stanford', 'Stanford')").run();

  db.prepare("INSERT INTO skills (id, name, category) VALUES ('sk-sol', 'Solidity', 'Computer Science')").run();
  db.prepare("INSERT INTO user_skills (id, user_id, skill_id, proficiency, verification_status) VALUES ('usk-sol', 'u-stan-mentor', 'sk-sol', 'Expert', 'PLATFORM_VERIFIED')").run();

  const requesterCollege = 'MIT';
  const query = 'Solidity';

  const candidates = db.prepare(`
    SELECT u.id as user_id, p.display_name, p.college, s.name as skill_name, us.proficiency, us.verification_status
    FROM user_skills us
    JOIN skills s ON us.skill_id = s.id
    JOIN users u ON us.user_id = u.id
    JOIN profiles p ON u.id = p.user_id
    WHERE u.status = 'ACTIVE' 
      AND u.id != 'u-mit-learner'
      AND LOWER(s.name) LIKE ?
  `).all(`%${query.toLowerCase()}%`);

  const insideCollegeMatches = candidates.filter(c => c.college?.toLowerCase() === requesterCollege.toLowerCase());
  const outsideCollegeMatches = candidates.filter(c => c.college?.toLowerCase() !== requesterCollege.toLowerCase());

  assert.strictEqual(insideCollegeMatches.length, 0, 'No inside-college mentor should be found');
  assert.strictEqual(outsideCollegeMatches.length, 1, 'Stage 2 outside college fallback should find Stanford mentor');
  assert.strictEqual(outsideCollegeMatches[0].college, 'Stanford');
  assert.strictEqual(outsideCollegeMatches[0].display_name, 'Rahul Stanford');
});

// ----------------------------------------------------
// Test 3: Stage 3 — No Mentor Found in Entire Network
// ----------------------------------------------------
test('Stage 3: No Mentor Found anywhere in network triggers Learner Request System', () => {
  const db = setupTestDb();

  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-mit-learner', 'l@mit.edu', 'hash')").run();
  db.prepare("INSERT INTO profiles (id, user_id, display_name, college) VALUES ('p-1', 'u-mit-learner', 'Ben MIT', 'MIT')").run();
  db.prepare("INSERT INTO skills (id, name, category) VALUES ('sk-qc', 'Quantum Computing', 'Physics')").run();

  const requesterCollege = 'MIT';
  const query = 'Quantum';

  const candidates = db.prepare(`
    SELECT u.id as user_id, p.display_name, p.college, s.name as skill_name, us.proficiency, us.verification_status
    FROM user_skills us
    JOIN skills s ON us.skill_id = s.id
    JOIN users u ON us.user_id = u.id
    JOIN profiles p ON u.id = p.user_id
    WHERE u.status = 'ACTIVE' 
      AND LOWER(s.name) LIKE ?
  `).all(`%${query.toLowerCase()}%`);

  assert.strictEqual(candidates.length, 0, '0 mentors anywhere in network');

  // Learner creates and saves request
  db.prepare(`
    INSERT INTO skill_requests (id, learner_id, skill_id, requested_proficiency, learning_goal, status)
    VALUES ('req-qc-1', 'u-mit-learner', 'sk-qc', 'Beginner', 'Need guidance on quantum teleportation protocol', 'OPEN')
  `).run();

  const savedRequest = db.prepare("SELECT * FROM skill_requests WHERE id = 'req-qc-1'").get();
  assert.ok(savedRequest, 'Request must be saved in database');
  assert.strictEqual(savedRequest.status, 'OPEN');
  assert.strictEqual(savedRequest.learning_goal, 'Need guidance on quantum teleportation protocol');
});

// ----------------------------------------------------
// Test 4: Stage 4 — Future Monitoring & Automatic Notification Dispatch
// ----------------------------------------------------
test('Stage 4: New mentor joining triggers automatic notification to waiting learners', () => {
  const db = setupTestDb();

  db.prepare("INSERT INTO users (id, email, password_hash) VALUES ('u-mit-learner', 'l@mit.edu', 'hash')").run();
  db.prepare("INSERT INTO profiles (id, user_id, display_name, college) VALUES ('p-1', 'u-mit-learner', 'Ben MIT', 'MIT')").run();
  db.prepare("INSERT INTO skills (id, name, category) VALUES ('sk-qc', 'Quantum Computing', 'Physics')").run();

  // Learner posted open request
  db.prepare(`
    INSERT INTO skill_requests (id, learner_id, skill_id, requested_proficiency, learning_goal, status)
    VALUES ('req-qc-1', 'u-mit-learner', 'sk-qc', 'Beginner', 'Quantum algorithms', 'OPEN')
  `).run();

  // New mentor (Elena from Cambridge) later adds & verifies Quantum Computing
  db.prepare("INSERT INTO users (id, email, password_hash, user_type) VALUES ('u-cam-mentor', 'e@cam.ac.uk', 'hash', 'TEACHER')").run();
  db.prepare("INSERT INTO profiles (id, user_id, display_name, college) VALUES ('p-2', 'u-cam-mentor', 'Elena Rostova', 'Cambridge')").run();
  db.prepare("INSERT INTO user_skills (id, user_id, skill_id, proficiency, verification_status) VALUES ('usk-qc-elena', 'u-cam-mentor', 'sk-qc', 'Expert', 'PLATFORM_VERIFIED')").run();

  // System triggers notification function
  const openRequests = db.prepare("SELECT learner_id, skill_id FROM skill_requests WHERE skill_id = 'sk-qc' AND status = 'OPEN'").all();
  const mentorProfile = db.prepare("SELECT display_name, college FROM profiles WHERE user_id = 'u-cam-mentor'").get();
  const skill = db.prepare("SELECT name FROM skills WHERE id = 'sk-qc'").get();

  for (const req of openRequests) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, link, type)
      VALUES ('notif-' || random(), ?, 'New Verified Mentor Available!', ?, '/explore?q=Quantum', 'INFO')
    `).run(
      req.learner_id,
      `Great news! ${mentorProfile.display_name} (${mentorProfile.college}) is now verified to teach "${skill.name}". Book your session now!`
    );

    db.prepare("UPDATE skill_requests SET status = 'MATCHED', matched_teacher_id = 'u-cam-mentor' WHERE skill_id = ?").run(req.skill_id);
  }

  // Verify learner received notification
  const notif = db.prepare("SELECT * FROM notifications WHERE user_id = 'u-mit-learner'").get();
  assert.ok(notif, 'Learner must have received a notification');
  assert.strictEqual(notif.title, 'New Verified Mentor Available!');
  assert.ok(notif.message.includes('Elena Rostova (Cambridge)'));

  // Verify request status transitioned
  const updatedReq = db.prepare("SELECT status, matched_teacher_id FROM skill_requests WHERE id = 'req-qc-1'").get();
  assert.strictEqual(updatedReq.status, 'MATCHED');
  assert.strictEqual(updatedReq.matched_teacher_id, 'u-cam-mentor');
});
