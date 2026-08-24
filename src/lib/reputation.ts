import { getDb } from './db';

/**
 * Confidence-Aware Bayesian Rating Calculator
 * Prior mean m = 4.5, Prior weight C = 3
 */
export function calculateBayesianRating(ratings: number[], priorMean: number = 4.5, priorWeight: number = 3): number {
  if (ratings.length === 0) return priorMean;
  const sum = ratings.reduce((acc, score) => acc + score, 0);
  const bayesian = (priorWeight * priorMean + sum) / (priorWeight + ratings.length);
  return Math.round(bayesian * 100) / 100;
}

/**
 * Recalculate and update reputation metrics for a specific user
 */
export function refreshUserReputation(userId: string): {
  bayesianRating: number;
  totalReviews: number;
  reliabilityScore: number;
  teachingScore: number;
  reciprocalRatio: number;
} {
  const db = getDb();

  // Fetch all ratings received by this user
  const ratings = db.prepare(`
    SELECT score, punctuality_score, clarity_score, flagged_suspicious
    FROM ratings
    WHERE ratee_id = ? AND flagged_suspicious = 0
  `).all(userId) as any[];

  const scores = ratings.map(r => r.score);
  const bayesianRating = calculateBayesianRating(scores);

  // Fetch session completion statistics
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_sessions,
      SUM(CASE WHEN status = 'CREDIT_SETTLED' OR status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_sessions,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_sessions
    FROM sessions
    WHERE teacher_id = ? OR learner_id = ?
  `).get(userId, userId) as any;

  const totalSessions = stats.total_sessions || 0;
  const completed = stats.completed_sessions || 0;
  const cancelled = stats.cancelled_sessions || 0;

  const completionRate = totalSessions > 0 ? (completed / totalSessions) * 100 : 100;
  const cancellationRate = totalSessions > 0 ? (cancelled / totalSessions) * 100 : 0;

  // Average punctuality
  const avgPunctuality = ratings.length > 0
    ? ratings.reduce((acc, r) => acc + (r.punctuality_score || 5.0), 0) / ratings.length
    : 5.0;

  const reliabilityScore = Math.min(100, Math.max(0, Math.round(
    (completionRate * 0.7) + (avgPunctuality * 20 * 0.3)
  )));

  // Teaching score
  const teachingScore = Math.min(100, Math.round(
    (bayesianRating / 5.0) * 80 + (Math.min(10, completed) * 2)
  ));

  // Reciprocal ratio check
  const givenCount = (db.prepare(`SELECT COUNT(*) as c FROM ratings WHERE rater_id = ?`).get(userId) as any).c;
  const receivedCount = ratings.length;
  const reciprocalRatio = receivedCount > 0 ? Math.min(1.0, givenCount / receivedCount) : 0;

  // Update reputations table
  db.prepare(`
    INSERT INTO reputations (
      id, user_id, total_reviews, bayesian_rating, reliability_score, teaching_score, reciprocal_rating_ratio, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      total_reviews = excluded.total_reviews,
      bayesian_rating = excluded.bayesian_rating,
      reliability_score = excluded.reliability_score,
      teaching_score = excluded.teaching_score,
      reciprocal_rating_ratio = excluded.reciprocal_rating_ratio,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    `rep-${userId}`,
    userId,
    receivedCount,
    bayesianRating,
    reliabilityScore,
    teachingScore,
    reciprocalRatio
  );

  // Sync profile trust metrics
  const overallTrust = Math.round((bayesianRating / 5.0) * 40 + reliabilityScore * 0.4 + 20);
  db.prepare(`
    UPDATE profiles
    SET trust_score = ?, completion_rate = ?, cancellation_rate = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(overallTrust, completionRate, cancellationRate, userId);

  return {
    bayesianRating,
    totalReviews: receivedCount,
    reliabilityScore,
    teachingScore,
    reciprocalRatio,
  };
}

/**
 * Proficiency score mapping for initial mentor quality (1st Lecture / 0 Learner Reviews)
 */
export const PROFICIENCY_QUALITY_MAP: Record<string, { score: number; percentage: number; label: string }> = {
  Expert: { score: 5.0, percentage: 100, label: 'Expert (5.0 ★)' },
  Advanced: { score: 4.5, percentage: 90, label: 'Advanced (4.5 ★)' },
  Intermediate: { score: 4.0, percentage: 80, label: 'Intermediate (4.0 ★)' },
  Beginner: { score: 3.0, percentage: 60, label: 'Beginner (3.0 ★)' },
};

export interface MentorQualityResult {
  qualityScore: number;         // 1.0 to 5.0
  qualityPercentage: number;    // 20 to 100
  qualitySource: 'PROFICIENCY_FIRST_LECTURE' | 'LEARNER_RATINGS';
  qualityLabel: string;
  lecturesTaught: number;       // total completed sessions taught
  totalReviews: number;
  proficiency: string;
  proficiencyScore: number;
  averageLearnerRating: number | null;
  breakdown: {
    clarityScore: number;
    punctualityScore: number;
  };
}

/**
 * Calculates a student's mentor quality:
 * 1. For the FIRST lecture (0 reviews / 0 completed sessions): based on their proficiency in the specific skill.
 * 2. From the SECOND lecture onwards (>= 1 learner reviews): based on the ratings given by every learner after completion of the sessions.
 */
export function calculateMentorQuality(params: {
  proficiency?: string;
  learnerRatings?: Array<{ score: number; punctuality_score?: number; clarity_score?: number; flagged_suspicious?: number }>;
  lecturesTaught?: number;
}): MentorQualityResult {
  const prof = params.proficiency || 'Intermediate';
  const profInfo = PROFICIENCY_QUALITY_MAP[prof] || PROFICIENCY_QUALITY_MAP['Intermediate'];
  const ratings = (params.learnerRatings || []).filter(r => !r.flagged_suspicious);
  const reviewsCount = ratings.length;
  const lecturesTaught = params.lecturesTaught ?? reviewsCount;

  // Case 1: First Lecture (0 rated sessions / 0 reviews) -> Calculated from skill proficiency
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

  // Case 2: From the Second Lecture (>= 1 learner reviews) -> Calculated from learner ratings
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

/**
 * Convenience query to get mentor quality for a specific user and skill from database
 */
export function getMentorQualityForSkill(mentorId: string, skillId?: string): MentorQualityResult {
  const db = getDb();

  // 1. Get declared/verified proficiency for this skill
  let proficiency = 'Intermediate';
  if (skillId) {
    const userSkill = db.prepare(`
      SELECT proficiency FROM user_skills WHERE user_id = ? AND skill_id = ?
    `).get(mentorId, skillId) as any;
    if (userSkill?.proficiency) {
      proficiency = userSkill.proficiency;
    }
  } else {
    const primarySkill = db.prepare(`
      SELECT proficiency FROM user_skills WHERE user_id = ? LIMIT 1
    `).get(mentorId) as any;
    if (primarySkill?.proficiency) {
      proficiency = primarySkill.proficiency;
    }
  }

  // 2. Get ratings given by learners for sessions taught by this mentor
  let ratingsQuery = `
    SELECT r.score, r.punctuality_score, r.clarity_score, r.flagged_suspicious
    FROM ratings r
    JOIN sessions s ON r.session_id = s.id
    WHERE r.ratee_id = ? AND s.teacher_id = ? AND r.flagged_suspicious = 0
  `;
  const queryParams: any[] = [mentorId, mentorId];

  if (skillId) {
    ratingsQuery += ` AND s.skill_id = ?`;
    queryParams.push(skillId);
  }

  const learnerRatings = db.prepare(ratingsQuery).all(...queryParams) as any[];

  // 3. Count completed sessions taught
  let sessionsQuery = `
    SELECT COUNT(*) as c FROM sessions
    WHERE teacher_id = ? AND (status = 'COMPLETED' OR status = 'CREDIT_SETTLED')
  `;
  const sessParams: any[] = [mentorId];
  if (skillId) {
    sessionsQuery += ` AND skill_id = ?`;
    sessParams.push(skillId);
  }
  const lecturesTaught = (db.prepare(sessionsQuery).get(...sessParams) as any)?.c || 0;

  return calculateMentorQuality({
    proficiency,
    learnerRatings,
    lecturesTaught,
  });
}
