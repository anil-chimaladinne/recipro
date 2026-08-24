import { getDb } from './db';
import { getMentorQualityForSkill, MentorQualityResult } from './reputation';

export interface MatchingWeights {
  skillCompatibility: number;     // default 0.30
  availabilityOverlap: number;   // default 0.20
  proficiencyCompatibility: number;// default 0.15
  learningGoalSimilarity: number; // default 0.10
  reliability: number;           // default 0.10
  reputation: number;            // default 0.10
  teachingStyle: number;         // default 0.05
}

export const DEFAULT_WEIGHTS: MatchingWeights = {
  skillCompatibility: 0.30,
  availabilityOverlap: 0.20,
  proficiencyCompatibility: 0.15,
  learningGoalSimilarity: 0.10,
  reliability: 0.10,
  reputation: 0.10,
  teachingStyle: 0.05,
};

export interface CandidateResult {
  userId: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  college: string | null;
  major: string | null;
  year: string | null;
  userType: 'TEACHER' | 'LEARNER' | 'TEACHER_LEARNER';
  teachingPreference: 'Anyone' | 'Women' | 'Men';
  campusTier: 'OWN_COLLEGE' | 'PARTNER_COLLEGE' | 'NETWORK';
  isOutsideCollege: boolean;
  isVerifiedStudent: boolean;
  trustScore: number;
  completionRate: number;
  hourlyRateCredits: number;
  teachingStyle: string;
  languages: string;
  matchedSkill: {
    skillId: string;
    skillName: string;
    category: string;
    proficiency: string;
    experienceYears: number;
    verificationStatus: string;
    assessmentScore?: number | null;
  };
  mentorQuality?: MentorQualityResult;
  reputation: {
    bayesianRating: number;
    totalReviews: number;
    totalSessionsTaught: number;
    reliabilityScore: number;
  };
  availability: Array<{
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }>;
  matchScore: number; // 0 to 100
  matchBreakdown: {
    skillScore: number;
    availabilityScore: number;
    proficiencyScore: number;
    goalScore: number;
    reliabilityScore: number;
    reputationScore: number;
    styleScore: number;
  };
  explanationPoints: string[];
  discoveryMode: 'MODE_A_KNOWN_PERSON' | 'MODE_B_KNOWN_SKILL' | 'FALLBACK';
}

export interface SearchMatchResult {
  knownPersonMatches: CandidateResult[];
  skillMatches: CandidateResult[];
  insideCollegeMatches: CandidateResult[];
  outsideCollegeMatches: CandidateResult[];
  totalResults: number;
}

export interface SearchParams {
  query?: string;
  mode?: 'ALL' | 'MODE_A' | 'MODE_B' | 'MODE_C';
  skillCategory?: string;
  minProficiency?: string;
  dayOfWeek?: string;
  verifiedOnly?: boolean;
  minRating?: number;
  sessionMode?: string;
  requesterUserId?: string;
}

const PROFICIENCY_RANK: Record<string, number> = {
  'Beginner': 1,
  'Intermediate': 2,
  'Advanced': 3,
  'Expert': 4,
};

export function searchAndMatchCandidates(params: SearchParams, weights: MatchingWeights = DEFAULT_WEIGHTS): SearchMatchResult {
  const db = getDb();
  const q = (params.query || '').trim().toLowerCase();
  const requesterId = params.requesterUserId || '';

  let requesterCollege = '';
  let requesterGoals: Array<{ skill_id: string; target_proficiency: string }> = [];
  let requesterAvailability: Array<{ day_of_week: string; start_time: string; end_time: string }> = [];

  if (requesterId) {
    const rProf = db.prepare('SELECT college FROM profiles WHERE user_id = ?').get(requesterId) as { college: string } | undefined;
    if (rProf) requesterCollege = (rProf.college || '').toLowerCase();

    requesterGoals = db.prepare(`
      SELECT skill_id, target_proficiency FROM learning_goals WHERE user_id = ?
    `).all(requesterId) as Array<{ skill_id: string; target_proficiency: string }>;

    requesterAvailability = db.prepare(`
      SELECT day_of_week, start_time, end_time FROM availability_slots WHERE user_id = ?
    `).all(requesterId) as Array<{ day_of_week: string; start_time: string; end_time: string }>;
  }

  // ============================================================
  // STAGE 1: MODE A — EXACT KNOWN PERSON LOOKUP (Deterministic)
  // ============================================================
  let knownPersonMatches: CandidateResult[] = [];

  if (q.length > 0) {
    // Check if query directly matches a user display name, email handle, or college ID
    const personRows = db.prepare(`
      SELECT 
        u.id as user_id, u.email, u.status, u.campus_id, COALESCE(u.user_type, 'TEACHER_LEARNER') as user_type,
        p.display_name, p.avatar, p.bio, p.college, p.major, p.year,
        p.is_verified_student, p.trust_score, p.completion_rate, p.hourly_rate_credits,
        p.teaching_style, p.languages, COALESCE(p.teaching_preference, 'Anyone') as teaching_preference,
        r.bayesian_rating, r.total_reviews, r.total_sessions_taught, r.reliability_score
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      LEFT JOIN reputations r ON u.id = r.user_id
      WHERE u.status = 'ACTIVE'
        AND u.id != ?
        AND (
          LOWER(p.display_name) LIKE ?
          OR LOWER(u.email) LIKE ?
          OR LOWER(u.campus_id) LIKE ?
        )
      LIMIT 5
    `).all(requesterId, `%${q}%`, `${q}%`, `${q}%`) as any[];

    for (const pRow of personRows) {
      // Fetch skills taught by this person
      const userSkills = db.prepare(`
        SELECT us.*, s.name as skill_name, s.category as skill_category
        FROM user_skills us
        JOIN skills s ON us.skill_id = s.id
        WHERE us.user_id = ?
      `).all(pRow.user_id) as any[];

      const userAvail = db.prepare(`
        SELECT day_of_week, start_time, end_time
        FROM availability_slots
        WHERE user_id = ?
      `).all(pRow.user_id) as any[];

      const primarySkill = userSkills[0] || {
        skill_id: 'general',
        skill_name: 'Peer Tutoring & General Mentorship',
        skill_category: 'General',
        proficiency: 'Advanced',
        experience_years: 1,
        verification_status: 'SELF_DECLARED',
      };

      const candCollege = (pRow.college || '').toLowerCase();
      let campusTier: CandidateResult['campusTier'] = 'NETWORK';
      if (requesterCollege && candCollege && requesterCollege === candCollege) {
        campusTier = 'OWN_COLLEGE';
      } else if (candCollege) {
        campusTier = 'PARTNER_COLLEGE';
      }

        const mentorQuality = getMentorQualityForSkill(pRow.user_id, primarySkill.skill_id);

        knownPersonMatches.push({
          userId: pRow.user_id,
          displayName: pRow.display_name,
          avatar: pRow.avatar,
          bio: pRow.bio,
          college: pRow.college,
          major: pRow.major,
          year: pRow.year,
          userType: pRow.user_type || 'TEACHER_LEARNER',
          teachingPreference: pRow.teaching_preference || 'Anyone',
          campusTier,
          isOutsideCollege: campusTier !== 'OWN_COLLEGE',
          isVerifiedStudent: Boolean(pRow.is_verified_student),
          trustScore: pRow.trust_score || 70,
          completionRate: pRow.completion_rate || 100,
          hourlyRateCredits: pRow.hourly_rate_credits || 1,
          teachingStyle: pRow.teaching_style || 'Interactive & Hands-on',
          languages: pRow.languages || 'English',
          matchedSkill: {
            skillId: primarySkill.skill_id,
            skillName: primarySkill.skill_name,
            category: primarySkill.skill_category,
            proficiency: primarySkill.proficiency,
            experienceYears: primarySkill.experience_years,
            verificationStatus: primarySkill.verification_status,
            assessmentScore: primarySkill.assessment_score,
          },
          mentorQuality,
          reputation: {
            bayesianRating: pRow.bayesian_rating || 4.5,
            totalReviews: pRow.total_reviews || 0,
            totalSessionsTaught: pRow.total_sessions_taught || 0,
            reliabilityScore: pRow.reliability_score || 95,
          },
        availability: userAvail.map((a: any) => ({
          dayOfWeek: a.day_of_week,
          startTime: a.start_time,
          endTime: a.end_time,
        })),
        matchScore: 99.0, // Top deterministic priority
        matchBreakdown: {
          skillScore: 95,
          availabilityScore: 90,
          proficiencyScore: 95,
          goalScore: 90,
          reliabilityScore: 98,
          reputationScore: 95,
          styleScore: 90,
        },
        explanationPoints: [
          `Exact identity match for "${pRow.display_name}"`,
          `Faculty: ${pRow.college} (${pRow.major})`,
          `Campus Tier: ${campusTier === 'OWN_COLLEGE' ? 'Your College' : 'SkillSwap Network'}`,
          `Verified Student Badge: ${pRow.is_verified_student ? 'Yes' : 'Unverified'}`,
        ],
        discoveryMode: 'MODE_A_KNOWN_PERSON',
      });
    }
  }

  // ============================================================
  // STAGE 2: MODE B — HARD FILTERS + DETERMINISTIC CANDIDATE SET
  // ============================================================
  let filterConditions = [
    `u.status = 'ACTIVE'`,
    `COALESCE(u.user_type, 'TEACHER_LEARNER') IN ('TEACHER', 'TEACHER_LEARNER')`,
    `u.id != ?`
  ];
  let filterParams: any[] = [requesterId];

  // Skill keyword or category search
  if (q.length > 0) {
    filterConditions.push(`(
      LOWER(s.name) LIKE ? 
      OR LOWER(s.category) LIKE ? 
      OR LOWER(us.teaching_style) LIKE ?
      OR LOWER(p.bio) LIKE ?
    )`);
    filterParams.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (params.skillCategory) {
    filterConditions.push(`LOWER(s.category) = LOWER(?)`);
    filterParams.push(params.skillCategory);
  }

  if (params.verifiedOnly) {
    filterConditions.push(`us.verification_status IN ('PLATFORM_VERIFIED', 'ASSESSMENT_VERIFIED')`);
  }

  if (params.minRating && params.minRating > 0) {
    filterConditions.push(`COALESCE(r.bayesian_rating, 4.0) >= ?`);
    filterParams.push(params.minRating);
  }

  const querySql = `
    SELECT 
      u.id as user_id, u.email, u.status, u.campus_id, COALESCE(u.user_type, 'TEACHER_LEARNER') as user_type,
      p.display_name, p.avatar, p.bio, p.college, p.major, p.year,
      p.is_verified_student, p.trust_score, p.completion_rate, p.hourly_rate_credits,
      p.teaching_style, p.languages, COALESCE(p.teaching_preference, 'Anyone') as teaching_preference,
      s.id as skill_id, s.name as skill_name, s.category as skill_category,
      us.proficiency, us.experience_years, us.teaching_style as user_teaching_style,
      us.verification_status, us.evidence_url, us.assessment_score,
      r.bayesian_rating, r.total_reviews, r.total_sessions_taught, r.reliability_score
    FROM user_skills us
    JOIN skills s ON us.skill_id = s.id
    JOIN users u ON us.user_id = u.id
    JOIN profiles p ON u.id = p.user_id
    LEFT JOIN reputations r ON u.id = r.user_id
    WHERE ${filterConditions.join(' AND ')}
  `;

  const candidateRows = db.prepare(querySql).all(...filterParams) as any[];

  // ============================================================
  // STAGE 3: ML FEATURE CALCULATION & EXPLAINABILITY ENGINE
  // ============================================================
  const skillMatches: CandidateResult[] = [];

  for (const row of candidateRows) {
    // 1. Availability overlap score
    const userAvail = db.prepare(`
      SELECT day_of_week, start_time, end_time
      FROM availability_slots
      WHERE user_id = ?
    `).all(row.user_id) as any[];

    // If dayOfWeek filter applied, enforce hard availability filter
    if (params.dayOfWeek) {
      const hasDay = userAvail.some((a: any) => a.day_of_week.toLowerCase() === params.dayOfWeek?.toLowerCase());
      if (!hasDay) continue;
    }

    let availabilityScore = 70; // Baseline
    let hasScheduleOverlap = false;

    if (requesterAvailability.length > 0 && userAvail.length > 0) {
      // Calculate intersection of available slots
      let overlapCount = 0;
      for (const rA of requesterAvailability) {
        for (const uA of userAvail) {
          if (rA.day_of_week === uA.day_of_week) {
            overlapCount++;
            hasScheduleOverlap = true;
          }
        }
      }
      availabilityScore = Math.min(100, 50 + overlapCount * 25);
    } else if (userAvail.length >= 3) {
      availabilityScore = 85;
    }

    // 2. Skill compatibility score
    const teacherProfRank = PROFICIENCY_RANK[row.proficiency] || 2;
    let minProfRank = 1;
    if (params.minProficiency) {
      minProfRank = PROFICIENCY_RANK[params.minProficiency] || 1;
      if (teacherProfRank < minProfRank) continue; // Hard filter
    }

    let skillScore = 70 + (teacherProfRank * 6);
    if (row.verification_status === 'PLATFORM_VERIFIED') skillScore += 12;
    if (row.verification_status === 'ASSESSMENT_VERIFIED') skillScore += 8;
    if (row.verification_status === 'PEER_VERIFIED') skillScore += 6;
    if (row.experience_years >= 2) skillScore += 6;
    skillScore = Math.min(100, skillScore);

    // 3. Proficiency compatibility
    const proficiencyScore = teacherProfRank >= 3 ? 95 : 80;

    // 4. Learning Goal similarity / Reciprocity
    let goalScore = 60;
    if (requesterGoals.length > 0) {
      const matchGoal = requesterGoals.some(g => g.skill_id === row.skill_id);
      if (matchGoal) goalScore = 95;
    }

    // 5. Reliability score
    const reliabilityScore = Math.min(100, Math.max(0, row.reliability_score || 95));

    // 6. Bayesian Reputation score
    const bayesianRating = row.bayesian_rating || 4.5;
    const reputationScore = Math.min(100, Math.round((bayesianRating / 5.0) * 100));

    // 7. Teaching Style compatibility
    const styleScore = 85;

    // Weighted Hybrid ML Score
    const totalMatchScore = Math.round(
      (skillScore * weights.skillCompatibility) +
      (availabilityScore * weights.availabilityOverlap) +
      (proficiencyScore * weights.proficiencyCompatibility) +
      (goalScore * weights.learningGoalSimilarity) +
      (reliabilityScore * weights.reliability) +
      (reputationScore * weights.reputation) +
      (styleScore * weights.teachingStyle)
    );

    // Campus Tier Classification
    const candCollege = (row.college || '').toLowerCase();
    let campusTier: CandidateResult['campusTier'] = 'NETWORK';
    if (requesterCollege && candCollege && requesterCollege === candCollege) {
      campusTier = 'OWN_COLLEGE';
    } else if (candCollege) {
      campusTier = 'PARTNER_COLLEGE';
    }

    // Explainable Points
    const explanationPoints: string[] = [];
    explanationPoints.push(`✓ ${row.skill_name} expertise (${row.proficiency} level, ${row.experience_years} yrs)`);
    if (row.verification_status === 'PLATFORM_VERIFIED') {
      explanationPoints.push(`✓ Platform Verified Skill Mentor`);
    } else if (row.verification_status === 'ASSESSMENT_VERIFIED') {
      explanationPoints.push(`✓ Assessment Verified (${row.assessment_score || 85}% score)`);
    }
    if (hasScheduleOverlap) {
      explanationPoints.push(`✓ Mutual schedule availability overlap`);
    } else if (userAvail.length > 0) {
      explanationPoints.push(`✓ Active availability on ${userAvail.map((a: any) => a.day_of_week).slice(0, 2).join(', ')}`);
    }
    if (row.total_sessions_taught > 0) {
      explanationPoints.push(`✓ Strong verified history: ${bayesianRating.toFixed(1)}⭐ (${row.total_sessions_taught} completed sessions)`);
    }
    if (campusTier === 'OWN_COLLEGE') {
      explanationPoints.push(`✓ Classmate at your college (${row.college})`);
    }

    const mentorQuality = getMentorQualityForSkill(row.user_id, row.skill_id);

    skillMatches.push({
      userId: row.user_id,
      displayName: row.display_name,
      avatar: row.avatar,
      bio: row.bio,
      college: row.college,
      major: row.major,
      year: row.year,
      userType: row.user_type,
      teachingPreference: row.teaching_preference,
      campusTier,
      isOutsideCollege: campusTier !== 'OWN_COLLEGE',
      isVerifiedStudent: Boolean(row.is_verified_student),
      trustScore: row.trust_score || 70,
      completionRate: row.completion_rate || 100,
      hourlyRateCredits: row.hourly_rate_credits || 1,
      teachingStyle: row.user_teaching_style || row.teaching_style || 'Interactive',
      languages: row.languages || 'English',
      matchedSkill: {
        skillId: row.skill_id,
        skillName: row.skill_name,
        category: row.skill_category,
        proficiency: row.proficiency,
        experienceYears: row.experience_years,
        verificationStatus: row.verification_status,
        assessmentScore: row.assessment_score,
      },
      mentorQuality,
      reputation: {
        bayesianRating,
        totalReviews: row.total_reviews || 0,
        totalSessionsTaught: row.total_sessions_taught || 0,
        reliabilityScore: row.reliability_score || 95,
      },
      availability: userAvail.map((a: any) => ({
        dayOfWeek: a.day_of_week,
        startTime: a.start_time,
        endTime: a.end_time,
      })),
      matchScore: totalMatchScore,
      matchBreakdown: {
        skillScore,
        availabilityScore,
        proficiencyScore,
        goalScore,
        reliabilityScore,
        reputationScore,
        styleScore,
      },
      explanationPoints,
      discoveryMode: 'MODE_B_KNOWN_SKILL',
    });
  }

  // Sort skill matches: First by campus tier if logged in with matching college, then by descending ML score
  skillMatches.sort((a, b) => {
    if (a.campusTier === 'OWN_COLLEGE' && b.campusTier !== 'OWN_COLLEGE') return -1;
    if (b.campusTier === 'OWN_COLLEGE' && a.campusTier !== 'OWN_COLLEGE') return 1;
    return b.matchScore - a.matchScore;
  });

  const insideCollegeMatches = skillMatches.filter(m => m.campusTier === 'OWN_COLLEGE');
  const outsideCollegeMatches = skillMatches.filter(m => m.campusTier !== 'OWN_COLLEGE');

  return {
    knownPersonMatches,
    skillMatches,
    insideCollegeMatches,
    outsideCollegeMatches,
    totalResults: knownPersonMatches.length + skillMatches.length,
  };
}

export async function searchAndMatchCandidatesAsync(params: SearchParams, weights: MatchingWeights = DEFAULT_WEIGHTS): Promise<SearchMatchResult> {
  const baseResult = searchAndMatchCandidates(params, weights);
  if (baseResult.skillMatches.length === 0) {
    return baseResult;
  }

  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
  try {
    const payload = {
      candidates: baseResult.skillMatches.map(c => ({
        user_id: c.userId,
        display_name: c.displayName,
        skill_score: c.matchBreakdown.skillScore,
        availability_score: c.matchBreakdown.availabilityScore,
        proficiency_score: c.matchBreakdown.proficiencyScore,
        goal_score: c.matchBreakdown.goalScore,
        reliability_score: c.matchBreakdown.reliabilityScore,
        reputation_score: c.matchBreakdown.reputationScore,
        style_score: c.matchBreakdown.styleScore,
      })),
      weights: {
        skill: weights.skillCompatibility,
        availability: weights.availabilityOverlap,
        proficiency: weights.proficiencyCompatibility,
        goal: weights.learningGoalSimilarity,
        reliability: weights.reliability,
        reputation: weights.reputation,
        style: weights.teachingStyle,
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);

    const res = await fetch(`${mlServiceUrl}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const mlData = await res.json() as Array<{
        user_id: string;
        match_score: number;
        breakdown: any;
        explanation: string[];
      }>;

      const scoreMap = new Map(mlData.map(item => [item.user_id, item]));
      for (const candidate of baseResult.skillMatches) {
        const mlItem = scoreMap.get(candidate.userId);
        if (mlItem) {
          candidate.matchScore = mlItem.match_score;
          if (mlItem.explanation && mlItem.explanation.length > 0) {
            candidate.explanationPoints = [
              ...mlItem.explanation.map(e => `✓ ${e}`),
              ...candidate.explanationPoints.filter(p => p.includes('Verified') || p.includes('history'))
            ].slice(0, 4);
          }
        }
      }

      baseResult.skillMatches.sort((a, b) => {
        if (a.campusTier === 'OWN_COLLEGE' && b.campusTier !== 'OWN_COLLEGE') return -1;
        if (b.campusTier === 'OWN_COLLEGE' && a.campusTier !== 'OWN_COLLEGE') return 1;
        return b.matchScore - a.matchScore;
      });

      baseResult.insideCollegeMatches = baseResult.skillMatches.filter(m => m.campusTier === 'OWN_COLLEGE');
      baseResult.outsideCollegeMatches = baseResult.skillMatches.filter(m => m.campusTier !== 'OWN_COLLEGE');
    }
  } catch {
    // Graceful deterministic fallback
  }

  return baseResult;
}
