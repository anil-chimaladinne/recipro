const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'skillswap.db');

const PROFICIENCY_QUALITY_MAP = {
  Expert: { score: 5.0, percentage: 100, label: 'Expert (5.0 ★)' },
  Advanced: { score: 4.5, percentage: 90, label: 'Advanced (4.5 ★)' },
  Intermediate: { score: 4.0, percentage: 80, label: 'Intermediate (4.0 ★)' },
  Beginner: { score: 3.0, percentage: 60, label: 'Beginner (3.0 ★)' },
};

function calculateMentorQuality(params) {
  const prof = params.proficiency || 'Intermediate';
  const profInfo = PROFICIENCY_QUALITY_MAP[prof] || PROFICIENCY_QUALITY_MAP['Intermediate'];
  const ratings = (params.learnerRatings || []).filter(r => !r.flagged_suspicious);
  const reviewsCount = ratings.length;
  const lecturesTaught = params.lecturesTaught ?? reviewsCount;

  // Case 1: First Lecture (0 reviews) -> Calculated from proficiency
  if (reviewsCount === 0) {
    return {
      qualityScore: profInfo.score,
      qualityPercentage: profInfo.percentage,
      qualitySource: 'PROFICIENCY_FIRST_LECTURE',
      qualityLabel: `Initial Quality: ${profInfo.score.toFixed(1)} ★ (Proficiency: ${prof} • 1st Lecture)`,
      lecturesTaught: 0,
      totalReviews: 0,
      proficiency: prof,
      proficiencyScore: profInfo.score,
      averageLearnerRating: null,
      breakdown: {
        clarityScore: profInfo.score,
        punctualityScore: 5.0,
      },
    };
  }

  // Case 2: From the Second Lecture (>= 1 reviews) -> Calculated from learner ratings
  const sumScores = ratings.reduce((acc, r) => acc + r.score, 0);
  const avgScore = sumScores / reviewsCount;
  const avgClarity = ratings.reduce((acc, r) => acc + (r.clarity_score || 5.0), 0) / reviewsCount;
  const avgPunctuality = ratings.reduce((acc, r) => acc + (r.punctuality_score || 5.0), 0) / reviewsCount;

  const qualityScore = Math.round(avgScore * 100) / 100;
  const qualityPercentage = Math.min(100, Math.max(20, Math.round((qualityScore / 5.0) * 100)));

  return {
    qualityScore,
    qualityPercentage,
    qualitySource: 'LEARNER_RATINGS',
    qualityLabel: `Learner Verified: ${qualityScore.toFixed(1)} ★ (${reviewsCount} review${reviewsCount > 1 ? 's' : ''})`,
    lecturesTaught,
    totalReviews: reviewsCount,
    proficiency: prof,
    proficiencyScore: profInfo.score,
    averageLearnerRating: qualityScore,
    breakdown: {
      clarityScore: Math.round(avgClarity * 100) / 100,
      punctualityScore: Math.round(avgPunctuality * 100) / 100,
    },
  };
}

function getMentorQualityForSkillFromDb(db, mentorId, skillId) {
  let proficiency = 'Intermediate';
  if (skillId) {
    const userSkill = db.prepare(`
      SELECT proficiency FROM user_skills WHERE user_id = ? AND skill_id = ?
    `).get(mentorId, skillId);
    if (userSkill && userSkill.proficiency) {
      proficiency = userSkill.proficiency;
    }
  }

  let ratingsQuery = `
    SELECT r.score, r.punctuality_score, r.clarity_score, r.flagged_suspicious
    FROM ratings r
    JOIN sessions s ON r.session_id = s.id
    WHERE r.ratee_id = ? AND s.teacher_id = ? AND r.flagged_suspicious = 0
  `;
  const queryParams = [mentorId, mentorId];
  if (skillId) {
    ratingsQuery += ` AND s.skill_id = ?`;
    queryParams.push(skillId);
  }

  const learnerRatings = db.prepare(ratingsQuery).all(...queryParams);
  const lecturesTaught = db.prepare(`
    SELECT COUNT(*) as c FROM sessions WHERE teacher_id = ? AND (status = 'COMPLETED' OR status = 'CREDIT_SETTLED')
  `).get(mentorId).c;

  return calculateMentorQuality({
    proficiency,
    learnerRatings,
    lecturesTaught,
  });
}

test('SkillSwap Campus — Mentor Quality Engine (1st Lecture Proficiency vs 2nd+ Lecture Learner Ratings)', async (t) => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  await t.test('1. First Lecture (0 Reviews): Quality calculated purely from skill proficiency', () => {
    // 1A. Expert Proficiency
    const expertQuality = calculateMentorQuality({
      proficiency: 'Expert',
      learnerRatings: [],
      lecturesTaught: 0,
    });
    assert.equal(expertQuality.qualityScore, 5.0, 'Expert mentor should have 5.0 quality on 1st lecture');
    assert.equal(expertQuality.qualityPercentage, 100);
    assert.equal(expertQuality.qualitySource, 'PROFICIENCY_FIRST_LECTURE');
    assert.equal(expertQuality.totalReviews, 0);

    // 1B. Advanced Proficiency
    const advancedQuality = calculateMentorQuality({
      proficiency: 'Advanced',
      learnerRatings: [],
      lecturesTaught: 0,
    });
    assert.equal(advancedQuality.qualityScore, 4.5, 'Advanced mentor should have 4.5 quality on 1st lecture');
    assert.equal(advancedQuality.qualityPercentage, 90);
    assert.equal(advancedQuality.qualitySource, 'PROFICIENCY_FIRST_LECTURE');

    // 1C. Intermediate Proficiency
    const intermediateQuality = calculateMentorQuality({
      proficiency: 'Intermediate',
      learnerRatings: [],
      lecturesTaught: 0,
    });
    assert.equal(intermediateQuality.qualityScore, 4.0, 'Intermediate mentor should have 4.0 quality on 1st lecture');
    assert.equal(intermediateQuality.qualityPercentage, 80);
    assert.equal(intermediateQuality.qualitySource, 'PROFICIENCY_FIRST_LECTURE');

    // 1D. Beginner Proficiency
    const beginnerQuality = calculateMentorQuality({
      proficiency: 'Beginner',
      learnerRatings: [],
      lecturesTaught: 0,
    });
    assert.equal(beginnerQuality.qualityScore, 3.0, 'Beginner mentor should have 3.0 quality on 1st lecture');
    assert.equal(beginnerQuality.qualityPercentage, 60);
    assert.equal(beginnerQuality.qualitySource, 'PROFICIENCY_FIRST_LECTURE');
  });

  await t.test('2. From Second Lecture (>= 1 Review): Quality dynamically computed from learner ratings', () => {
    // 2A. After 1st session with 5-star review
    const afterFirstLecture = calculateMentorQuality({
      proficiency: 'Intermediate', // Initial baseline was 4.0
      learnerRatings: [
        { score: 5.0, clarity_score: 5.0, punctuality_score: 5.0 }
      ],
      lecturesTaught: 1,
    });
    assert.equal(afterFirstLecture.qualityScore, 5.0, 'Quality must now reflect the real learner rating (5.0)');
    assert.equal(afterFirstLecture.qualitySource, 'LEARNER_RATINGS');
    assert.equal(afterFirstLecture.totalReviews, 1);

    // 2B. After 2nd session with 4-star review -> Average = (5 + 4) / 2 = 4.5
    const afterSecondLecture = calculateMentorQuality({
      proficiency: 'Intermediate',
      learnerRatings: [
        { score: 5.0, clarity_score: 5.0, punctuality_score: 5.0 },
        { score: 4.0, clarity_score: 4.0, punctuality_score: 5.0 }
      ],
      lecturesTaught: 2,
    });
    assert.equal(afterSecondLecture.qualityScore, 4.5, 'Quality must be average of learner ratings ((5 + 4) / 2 = 4.5)');
    assert.equal(afterSecondLecture.qualityPercentage, 90);
    assert.equal(afterSecondLecture.qualitySource, 'LEARNER_RATINGS');
    assert.equal(afterSecondLecture.totalReviews, 2);
    assert.equal(afterSecondLecture.breakdown.clarityScore, 4.5);
    assert.equal(afterSecondLecture.breakdown.punctualityScore, 5.0);
  });

  await t.test('3. Database End-to-End: getMentorQualityForSkill with database seed', () => {
    const rand = Math.random().toString(36).substring(2, 8);
    const mentorId = `usr-mentor-q-${rand}`;
    const learner1 = `usr-learner1-q-${rand}`;
    const learner2 = `usr-learner2-q-${rand}`;
    const skillId = `skill-q-${rand}`;
    const sess1 = `sess-q1-${rand}`;
    const sess2 = `sess-q2-${rand}`;

    // Seed users
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, campus_id, user_type, email_verified)
      VALUES 
        (?, ?, 'hash', 'STUDENT', 'ACTIVE', 'C-M', 'TEACHER_LEARNER', 1),
        (?, ?, 'hash', 'STUDENT', 'ACTIVE', 'C-L1', 'TEACHER_LEARNER', 1),
        (?, ?, 'hash', 'STUDENT', 'ACTIVE', 'C-L2', 'TEACHER_LEARNER', 1)
    `).run(mentorId, `mq.mentor.${rand}@campus.edu`, learner1, `mq.learner1.${rand}@campus.edu`, learner2, `mq.learner2.${rand}@campus.edu`);

    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, college, major, year, is_verified_student)
      VALUES 
        (?, ?, 'Mentor Quality Test', 'Tech University', 'CS', 'Senior', 1),
        (?, ?, 'Learner One', 'Tech University', 'CS', 'Junior', 1),
        (?, ?, 'Learner Two', 'Tech University', 'CS', 'Sophomore', 1)
    `).run(`prof-qm-${rand}`, mentorId, `prof-ql1-${rand}`, learner1, `prof-ql2-${rand}`, learner2);

    // Seed Skill & User Skill with Advanced proficiency (4.5 baseline)
    db.prepare(`
      INSERT INTO skills (id, name, category, description)
      VALUES (?, ?, 'Computer Science', 'Test')
    `).run(skillId, `Quality Test Skill ${rand}`);

    db.prepare(`
      INSERT INTO user_skills (id, user_id, skill_id, proficiency, experience_years, verification_status)
      VALUES (?, ?, ?, 'Advanced', 2.0, 'PLATFORM_VERIFIED')
    `).run(`us-q-${rand}`, mentorId, skillId);

    // Phase 1: Zero completed sessions -> Quality must be 4.5 (Advanced 1st Lecture)
    const initialQuality = getMentorQualityForSkillFromDb(db, mentorId, skillId);
    assert.equal(initialQuality.qualityScore, 4.5);
    assert.equal(initialQuality.qualitySource, 'PROFICIENCY_FIRST_LECTURE');
    assert.equal(initialQuality.totalReviews, 0);

    // Phase 2: First session completed & rated with 5.0
    db.prepare(`
      INSERT INTO sessions (id, teacher_id, learner_id, skill_id, title, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key)
      VALUES (?, ?, ?, ?, 'Session 1', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1.0, 1, ?)
    `).run(sess1, mentorId, learner1, skillId, `idem-q1-${rand}`);

    db.prepare(`
      INSERT INTO ratings (id, session_id, rater_id, ratee_id, score, review, clarity_score, punctuality_score)
      VALUES (?, ?, ?, ?, 5.0, 'Great 1st lecture!', 5.0, 5.0)
    `).run(`rat-q1-${rand}`, sess1, learner1, mentorId);

    const qualityAfter1 = getMentorQualityForSkillFromDb(db, mentorId, skillId);
    assert.equal(qualityAfter1.qualityScore, 5.0);
    assert.equal(qualityAfter1.qualitySource, 'LEARNER_RATINGS');
    assert.equal(qualityAfter1.totalReviews, 1);

    // Phase 3: Second session completed & rated with 4.0 -> Average = 4.5
    db.prepare(`
      INSERT INTO sessions (id, teacher_id, learner_id, skill_id, title, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key)
      VALUES (?, ?, ?, ?, 'Session 2', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1.0, 1, ?)
    `).run(sess2, mentorId, learner2, skillId, `idem-q2-${rand}`);

    db.prepare(`
      INSERT INTO ratings (id, session_id, rater_id, ratee_id, score, review, clarity_score, punctuality_score)
      VALUES (?, ?, ?, ?, 4.0, 'Very good 2nd lecture!', 4.0, 5.0)
    `).run(`rat-q2-${rand}`, sess2, learner2, mentorId);

    const qualityAfter2 = getMentorQualityForSkillFromDb(db, mentorId, skillId);
    assert.equal(qualityAfter2.qualityScore, 4.5);
    assert.equal(qualityAfter2.qualitySource, 'LEARNER_RATINGS');
    assert.equal(qualityAfter2.totalReviews, 2);
  });

  db.close();
});
