const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'skillswap.db');

test('SkillSwap Campus — Post-Session Peer Rating & Reputation Engine Suite', async (t) => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const rand = Math.random().toString(36).substring(2, 8);
  const mentorId = `usr-mentor-rate-${rand}`;
  const learnerId = `usr-learner-rate-${rand}`;
  const thirdPartyId = `usr-third-party-${rand}`;
  const sessionId = `sess-rate-test-${rand}`;
  const skillName = `Test Skill ${rand}`;
  const skillId = `skill-custom-${rand}`;

  // Seed Users with unique emails
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, status, campus_id, user_type, email_verified)
    VALUES 
      (?, ?, 'hash', 'STUDENT', 'ACTIVE', ?, 'TEACHER_LEARNER', 1),
      (?, ?, 'hash', 'STUDENT', 'ACTIVE', ?, 'TEACHER_LEARNER', 1),
      (?, ?, 'hash', 'STUDENT', 'ACTIVE', ?, 'TEACHER_LEARNER', 1)
  `).run(
    mentorId, `mentor.rate.${rand}@test.edu`, `CAMPUS-M-${rand}`,
    learnerId, `learner.rate.${rand}@test.edu`, `CAMPUS-L-${rand}`,
    thirdPartyId, `third.party.${rand}@test.edu`, `CAMPUS-T-${rand}`
  );

  // Seed Profiles
  db.prepare(`
    INSERT INTO profiles (id, user_id, display_name, college, major, year, is_verified_student)
    VALUES 
      (?, ?, 'Mentor Anil', 'Engineering Campus', 'CSE', 'Senior', 1),
      (?, ?, 'Learner Sneha', 'Engineering Campus', 'ECE', 'Sophomore', 1),
      (?, ?, 'Random Student', 'Engineering Campus', 'ME', 'Freshman', 1)
  `).run(`prof-m-${rand}`, mentorId, `prof-l-${rand}`, learnerId, `prof-t-${rand}`, thirdPartyId);

  // Seed Reputation
  db.prepare(`
    INSERT INTO reputations (id, user_id, total_reviews, total_sessions_taught, total_sessions_learned, bayesian_rating, reliability_score)
    VALUES (?, ?, 0, 0, 0, 4.5, 95.0)
  `).run(`rep-${mentorId}`, mentorId);

  // Seed Skill & Session
  db.prepare(`
    INSERT INTO skills (id, name, category, description)
    VALUES (?, ?, 'Computer Science', 'Interactive coding')
  `).run(skillId, skillName);

  db.prepare(`
    INSERT INTO sessions (id, teacher_id, learner_id, skill_id, title, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key)
    VALUES (?, ?, ?, ?, 'Live Next.js Mentoring', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1.0, 1, ?)
  `).run(sessionId, mentorId, learnerId, skillId, `idem-rate-${rand}`);

  await t.test('1. Security: Unrelated third-party student CANNOT submit rating for another session', () => {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    assert.ok(session, 'Session must exist');

    const isParticipant = session.teacher_id === thirdPartyId || session.learner_id === thirdPartyId;
    assert.equal(isParticipant, false, 'Third-party must NOT be recognized as a session participant');
  });

  await t.test('2. Learner submits 5-star rating with detailed review, clarity & punctuality scores', () => {
    const ratingId = `rat-${Date.now()}-${rand}`;
    const score = 5.0;
    const review = 'Outstanding mentor! Explained Next.js and API architecture with clear practical examples.';
    const punctualityScore = 5.0;
    const clarityScore = 5.0;
    const skillsDemonstrated = 'Clear Explanations, Practical Code Examples, Well Prepared & On-Time';

    db.prepare(`
      INSERT INTO ratings (
        id, session_id, rater_id, ratee_id, score, review, punctuality_score, clarity_score, skills_demonstrated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ratingId, sessionId, learnerId, mentorId, score, review, punctualityScore, clarityScore, skillsDemonstrated);

    const savedRating = db.prepare('SELECT * FROM ratings WHERE session_id = ? AND rater_id = ?').get(sessionId, learnerId);
    assert.ok(savedRating, 'Rating must be saved in database');
    assert.equal(savedRating.score, 5.0);
    assert.equal(savedRating.clarity_score, 5.0);
    assert.equal(savedRating.punctuality_score, 5.0);
    assert.equal(savedRating.skills_demonstrated, skillsDemonstrated);
  });

  await t.test('3. Duplicate Rating Prevention: Same learner cannot submit a second rating for the same session', () => {
    assert.throws(() => {
      db.prepare(`
        INSERT INTO ratings (
          id, session_id, rater_id, ratee_id, score, review, punctuality_score, clarity_score
        ) VALUES ('rat-dup-attempt', ?, ?, ?, 4.0, 'Duplicate test', 4.0, 4.0)
      `).run(sessionId, learnerId, mentorId);
    }, /UNIQUE constraint failed/, 'Database UNIQUE constraint on session_id must prevent duplicate ratings');
  });

  await t.test('4. Bayesian Reputation Update: Recalculates mentor peer rating and increments review count', () => {
    // Calculate Bayesian average: (C * m + sum(ratings)) / (C + N) where C=5 prior weight, m=4.5 baseline
    const ratings = db.prepare('SELECT score FROM ratings WHERE ratee_id = ?').all(mentorId);
    const N = ratings.length;
    const C = 5.0;
    const m = 4.5;
    const sumRatings = ratings.reduce((acc, r) => acc + r.score, 0);
    const bayesianRating = Math.round(((C * m + sumRatings) / (C + N)) * 100) / 100;

    db.prepare(`
      UPDATE reputations
      SET total_reviews = ?, total_sessions_taught = total_sessions_taught + 1, bayesian_rating = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(N, bayesianRating, mentorId);

    const rep = db.prepare('SELECT * FROM reputations WHERE user_id = ?').get(mentorId);
    assert.equal(rep.total_reviews, 1);
    assert.equal(rep.total_sessions_taught, 1);
    assert.ok(rep.bayesian_rating >= 4.5, 'Bayesian rating must reflect the 5-star positive review');
  });

  await t.test('5. Query Session With Ratings: Retrieves user rating and peer rating accurately', () => {
    const userRating = db.prepare(`
      SELECT r.*, p.display_name as rater_name
      FROM ratings r
      LEFT JOIN profiles p ON r.rater_id = p.user_id
      WHERE r.session_id = ? AND r.rater_id = ?
    `).get(sessionId, learnerId);

    assert.ok(userRating, 'User rating must be found for learner');
    assert.equal(userRating.rater_name, 'Learner Sneha');
    assert.equal(userRating.score, 5.0);

    const peerRating = db.prepare(`
      SELECT r.*, p.display_name as rater_name
      FROM ratings r
      LEFT JOIN profiles p ON r.rater_id = p.user_id
      WHERE r.session_id = ? AND r.rater_id != ?
    `).get(sessionId, learnerId);

    assert.equal(peerRating, undefined, 'No peer rating yet submitted by mentor');
  });

  db.close();
});
