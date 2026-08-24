import { getDb } from './db';
import Database from 'better-sqlite3';

export interface CandidateSlot {
  startTime: string; // ISO string (UTC)
  endTime: string;   // ISO string (UTC)
  displayStart: string; // e.g. "17:15"
  displayEnd: string;   // e.g. "18:15"
  score: number;        // 0 to 100
  isPreferred: boolean;
  isRecommended: boolean;
  scoreBreakdown: {
    mentorPreference: number;
    learnerPreference: number;
    overlapQuality: number;
    urgency: number;
    fairness: number;
    continuity: number;
  };
  explanation: string;
}

export interface SchedulingRankingWeights {
  mentorPreference: number;   // 0.30
  learnerPreference: number;  // 0.25
  overlapQuality: number;     // 0.20
  urgency: number;            // 0.10
  fairness: number;           // 0.10
  continuity: number;         // 0.05
}

export const DEFAULT_SCHEDULING_WEIGHTS: SchedulingRankingWeights = {
  mentorPreference: 0.30,
  learnerPreference: 0.25,
  overlapQuality: 0.20,
  urgency: 0.10,
  fairness: 0.10,
  continuity: 0.05,
};

export interface CheckSlotParams {
  teacherId: string;
  learnerId: string;
  scheduledStart: string; // ISO string
  scheduledEnd: string;
  bufferMinutes?: number;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  reason?: string;
  conflictingSession?: {
    start: string;
    end: string;
    type: 'TEACHER_BUSY' | 'LEARNER_BUSY' | 'DAILY_LIMIT_REACHED' | 'OUTSIDE_AVAILABILITY';
  };
  nextAvailableSlot?: string;
}

export interface MentorWithSlots {
  userId: string;
  displayName: string;
  avatar: string | null;
  college: string;
  major: string;
  year: string;
  isOutsideCollege: boolean;
  isVerifiedStudent: boolean;
  trustScore: number;
  completionRate: number;
  hourlyRateCredits: number;
  teachingPreference: string;
  matchedSkill: {
    skillId: string;
    skillName: string;
    category: string;
    proficiency: string;
    experienceYears: number;
    verificationStatus: string;
  };
  reputation: {
    bayesianRating: number;
    totalReviews: number;
    totalSessionsTaught: number;
    reliabilityScore: number;
  };
  matchScore: number;
  availableSlots: CandidateSlot[];
  preferredWindowDisplay: string;
  closestAlternatives?: CandidateSlot[];
}

export interface SmartSlotSearchParams {
  skillQuery?: string;
  date: string; // YYYY-MM-DD
  startTimeWindow?: string; // HH:MM, default "08:00"
  endTimeWindow?: string;   // HH:MM, default "22:00"
  durationMinutes?: number; // 30, 45, 60, 90, 120 (default 60)
  isFlexible?: boolean;     // true (Flexible) vs false (Exact)
  campusScope?: 'OWN_COLLEGE' | 'PARTNER_COLLEGE' | 'ALL';
  learnerId?: string;
  sessionMode?: 'ONLINE' | 'CAMPUS_IN_PERSON';
  verifiedOnly?: boolean;
}

export interface SmartSlotSearchResult {
  status: 'SUCCESS' | 'NO_MENTOR_FOUND' | 'NO_SLOTS_AVAILABLE_AT_TIME';
  date: string;
  dayOfWeek: string;
  insideCollegeMentors: MentorWithSlots[];
  outsideCollegeMentors: MentorWithSlots[];
  totalMentorsFound: number;
  totalValidSlots: number;
  isStage2Fallback: boolean;
  message: string;
}

/**
 * Hard Constraint Validator: Checks if a chosen slot is free of conflicts, respects buffer, and daily limit
 */
export function checkSlotHardConstraints(
  db: Database.Database,
  params: CheckSlotParams
): ConflictCheckResult {
  const reqStart = new Date(params.scheduledStart);
  const reqEnd = new Date(params.scheduledEnd);
  const bufferMs = (params.bufferMinutes ?? 15) * 60 * 1000;

  // 1. Check Mentor Daily Session Limit
  const dateStr = reqStart.toISOString().substring(0, 10);
  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  const mentorProfile = db.prepare(`
    SELECT daily_session_limit FROM profiles WHERE user_id = ?
  `).get(params.teacherId) as { daily_session_limit: number } | undefined;
  const maxSessions = mentorProfile?.daily_session_limit || 3;

  const teacherDailySessions = (db.prepare(`
    SELECT COUNT(*) as count FROM sessions 
    WHERE teacher_id = ? 
      AND status NOT IN ('CANCELLED', 'DISPUTED')
      AND scheduled_start >= ? AND scheduled_start <= ?
  `).get(params.teacherId, startOfDay, endOfDay) as any)?.count || 0;

  if (teacherDailySessions >= maxSessions) {
    return {
      hasConflict: true,
      reason: `Mentor has reached their maximum daily teaching limit (${maxSessions} sessions/day).`,
      conflictingSession: {
        start: startOfDay,
        end: endOfDay,
        type: 'DAILY_LIMIT_REACHED',
      },
    };
  }

  // 2. Check Teacher Conflicting Sessions (with Buffer)
  const teacherSessions = db.prepare(`
    SELECT id, scheduled_start, scheduled_end, status FROM sessions
    WHERE teacher_id = ? AND status IN ('REQUESTED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_CONFIRMATION')
  `).all(params.teacherId) as Array<{ id: string; scheduled_start: string; scheduled_end: string; status: string }>;

  for (const sess of teacherSessions) {
    const sStart = new Date(sess.scheduled_start).getTime() - bufferMs;
    const sEnd = new Date(sess.scheduled_end).getTime() + bufferMs;
    const rStartMs = reqStart.getTime();
    const rEndMs = reqEnd.getTime();

    // Check overlap
    if (rStartMs < sEnd && rEndMs > sStart) {
      const nextAvail = new Date(new Date(sess.scheduled_end).getTime() + bufferMs);
      return {
        hasConflict: true,
        reason: `Mentor is teaching another session from ${new Date(sess.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to ${new Date(sess.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. (Buffer: ${params.bufferMinutes ?? 15}m)`,
        conflictingSession: {
          start: sess.scheduled_start,
          end: sess.scheduled_end,
          type: 'TEACHER_BUSY',
        },
        nextAvailableSlot: nextAvail.toISOString(),
      };
    }
  }

  // 3. Check Learner Conflicting Sessions
  const learnerSessions = db.prepare(`
    SELECT id, scheduled_start, scheduled_end FROM sessions
    WHERE (learner_id = ? OR teacher_id = ?) AND status IN ('REQUESTED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_CONFIRMATION')
  `).all(params.learnerId, params.learnerId) as Array<{ id: string; scheduled_start: string; scheduled_end: string }>;

  for (const sess of learnerSessions) {
    const sStart = new Date(sess.scheduled_start).getTime();
    const sEnd = new Date(sess.scheduled_end).getTime();
    const rStartMs = reqStart.getTime();
    const rEndMs = reqEnd.getTime();

    if (rStartMs < sEnd && rEndMs > sStart) {
      return {
        hasConflict: true,
        reason: `You already have another campus session scheduled from ${new Date(sess.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to ${new Date(sess.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        conflictingSession: {
          start: sess.scheduled_start,
          end: sess.scheduled_end,
          type: 'LEARNER_BUSY',
        },
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Flexible Time-Window Solver for a single mentor
 */
export function calculateAvailableSlots(params: {
  teacherId: string;
  learnerId?: string;
  date: string; // YYYY-MM-DD
  startTimeWindow?: string; // HH:MM, default "08:00"
  endTimeWindow?: string;   // HH:MM, default "22:00"
  durationHours?: number;   // default 1.0
  bufferMinutes?: number;   // default 15
  isFlexible?: boolean;     // default true
  exactStartTime?: string;  // e.g. "17:00"
  skillId?: string;
}, weights: SchedulingRankingWeights = DEFAULT_SCHEDULING_WEIGHTS): {
  candidateSlots: CandidateSlot[];
  dayOfWeek: string;
  mentorAvailable: boolean;
  totalValidSlots: number;
  preferredWindowDisplay: string;
  closestAlternatives: CandidateSlot[];
} {
  const db = getDb();
  const dateObj = new Date(`${params.date}T00:00:00Z`);
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = daysOfWeek[dateObj.getUTCDay()];

  const durationHours = params.durationHours || 1.0;
  const bufferMinutes = params.bufferMinutes ?? 15;
  const durationMs = Math.round(durationHours * 60 * 60 * 1000);
  const bufferMs = bufferMinutes * 60 * 1000;

  // 1. Retrieve General Availability Slots for this day of week
  const generalSlots = db.prepare(`
    SELECT start_time, end_time, is_preferred, window_label FROM availability_slots
    WHERE user_id = ? AND LOWER(day_of_week) = LOWER(?)
  `).all(params.teacherId, dayName) as Array<{ start_time: string; end_time: string; is_preferred: number; window_label: string }>;

  // 2. Check Skill-Specific Teaching Availability if skillId provided
  let skillSpecificDays: string[] = [];
  let skillAvailStart = '17:00';
  let skillAvailEnd = '20:00';
  let skillPrefStart = '18:00';
  let skillPrefEnd = '20:00';

  if (params.skillId) {
    const userSkillRow = db.prepare(`
      SELECT teaching_days, available_start_time, available_end_time, preferred_start_time, preferred_end_time 
      FROM user_skills 
      WHERE user_id = ? AND skill_id = ?
    `).get(params.teacherId, params.skillId) as any;

    if (userSkillRow) {
      try {
        skillSpecificDays = JSON.parse(userSkillRow.teaching_days || '[]');
      } catch (e) {
        skillSpecificDays = [];
      }
      skillAvailStart = userSkillRow.available_start_time || '17:00';
      skillAvailEnd = userSkillRow.available_end_time || '20:00';
      skillPrefStart = userSkillRow.preferred_start_time || '18:00';
      skillPrefEnd = userSkillRow.preferred_end_time || '20:00';
    }
  }

  // 3. Learner Availability for reciprocity scoring
  let learnerSlots: Array<{ start_time: string; end_time: string }> = [];
  if (params.learnerId) {
    learnerSlots = db.prepare(`
      SELECT start_time, end_time FROM availability_slots
      WHERE user_id = ? AND LOWER(day_of_week) = LOWER(?)
    `).all(params.learnerId, dayName) as Array<{ start_time: string; end_time: string }>;
  }

  // 4. Fetch Mentor Confirmed Bookings on target date
  const dayStartStr = `${params.date}T00:00:00.000Z`;
  const dayEndStr = `${params.date}T23:59:59.999Z`;

  const mentorBookings = db.prepare(`
    SELECT scheduled_start, scheduled_end FROM sessions
    WHERE teacher_id = ? AND status IN ('REQUESTED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_CONFIRMATION')
      AND scheduled_start >= ? AND scheduled_start <= ?
  `).all(params.teacherId, dayStartStr, dayEndStr) as Array<{ scheduled_start: string; scheduled_end: string }>;

  // 5. Fetch Learner Confirmed Bookings
  let learnerBookings: Array<{ scheduled_start: string; scheduled_end: string }> = [];
  if (params.learnerId) {
    learnerBookings = db.prepare(`
      SELECT scheduled_start, scheduled_end FROM sessions
      WHERE (learner_id = ? OR teacher_id = ?) AND status IN ('REQUESTED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_CONFIRMATION')
        AND scheduled_start >= ? AND scheduled_start <= ?
    `).all(params.learnerId, params.learnerId, dayStartStr, dayEndStr) as Array<{ scheduled_start: string; scheduled_end: string }>;
  }

  // 6. Mentor Daily Limit
  const mentorProfile = db.prepare('SELECT daily_session_limit FROM profiles WHERE user_id = ?').get(params.teacherId) as any;
  const maxDaily = mentorProfile?.daily_session_limit || 3;
  if (mentorBookings.length >= maxDaily) {
    return {
      candidateSlots: [],
      dayOfWeek: dayName,
      mentorAvailable: false,
      totalValidSlots: 0,
      preferredWindowDisplay: 'Daily limit reached',
      closestAlternatives: [],
    };
  }

  // Determine effective scanning windows
  let windowsToScan: Array<{ start_time: string; end_time: string; is_preferred?: number }> = [];

  if (generalSlots.length > 0) {
    windowsToScan = generalSlots;
  } else if (skillSpecificDays.length > 0) {
    if (skillSpecificDays.some(d => d.toLowerCase() === dayName.toLowerCase())) {
      windowsToScan = [{ start_time: skillAvailStart, end_time: skillAvailEnd, is_preferred: 0 }];
    } else {
      windowsToScan = []; // Not available on this day
    }
  } else {
    // Default availability window
    windowsToScan = [{ start_time: skillAvailStart, end_time: skillAvailEnd, is_preferred: 0 }];
  }

  const candidateSlots: CandidateSlot[] = [];
  const allGeneratedSlots: CandidateSlot[] = [];

  // Granularity step: 15 minutes for fine-grained slots
  const stepMs = 15 * 60 * 1000;

  for (const win of windowsToScan) {
    const windowStartMs = new Date(`${params.date}T${win.start_time.padStart(5, '0')}:00Z`).getTime();
    const windowEndMs = new Date(`${params.date}T${win.end_time.padStart(5, '0')}:00Z`).getTime();

    // Bound with query window if specified
    const qStartMs = params.startTimeWindow ? new Date(`${params.date}T${params.startTimeWindow.padStart(5, '0')}:00Z`).getTime() : windowStartMs;
    const qEndMs = params.endTimeWindow ? new Date(`${params.date}T${params.endTimeWindow.padStart(5, '0')}:00Z`).getTime() : windowEndMs;

    const scanStartMs = Math.max(windowStartMs, qStartMs);
    const scanEndMs = Math.min(windowEndMs, qEndMs);

    for (let slotStart = scanStartMs; slotStart + durationMs <= scanEndMs; slotStart += stepMs) {
      const slotEnd = slotStart + durationMs;

      // Hard constraint 1: Mentor conflicting session overlap + buffer
      const mentorConflict = mentorBookings.some(b => {
        const bStart = new Date(b.scheduled_start).getTime() - bufferMs;
        const bEnd = new Date(b.scheduled_end).getTime() + bufferMs;
        return slotStart < bEnd && slotEnd > bStart;
      });
      if (mentorConflict) continue;

      // Hard constraint 2: Learner conflicting session overlap
      const learnerConflict = learnerBookings.some(b => {
        const bStart = new Date(b.scheduled_start).getTime();
        const bEnd = new Date(b.scheduled_end).getTime();
        return slotStart < bEnd && slotEnd > bStart;
      });
      if (learnerConflict) continue;

      // Preference Check: Mentor preferred window (e.g. 18:00 - 20:00 or is_preferred flag)
      const prefStartMs = new Date(`${params.date}T${skillPrefStart.padStart(5, '0')}:00Z`).getTime();
      const prefEndMs = new Date(`${params.date}T${skillPrefEnd.padStart(5, '0')}:00Z`).getTime();
      const isSlotInPrefWindow = (slotStart >= prefStartMs && slotEnd <= prefEndMs) || win.is_preferred === 1;

      const mentorPrefScore = isSlotInPrefWindow ? 98 : 75;

      // Learner preference score
      let learnerPrefScore = 80;
      if (learnerSlots.length > 0) {
        const isWithinLearner = learnerSlots.some(ls => {
          const lStart = new Date(`${params.date}T${ls.start_time}:00Z`).getTime();
          const lEnd = new Date(`${params.date}T${ls.end_time}:00Z`).getTime();
          return slotStart >= lStart && slotEnd <= lEnd;
        });
        learnerPrefScore = isWithinLearner ? 95 : 65;
      }

      const overlapQuality = 92;
      const urgencyScore = 85;
      const fairnessScore = 90;
      const continuityScore = 85;

      const totalScore = Math.round(
        (mentorPrefScore * weights.mentorPreference) +
        (learnerPrefScore * weights.learnerPreference) +
        (overlapQuality * weights.overlapQuality) +
        (urgencyScore * weights.urgency) +
        (fairnessScore * weights.fairness) +
        (continuityScore * weights.continuity)
      );

      const dStart = new Date(slotStart).toISOString();
      const dEnd = new Date(slotEnd).toISOString();

      const candidate: CandidateSlot = {
        startTime: dStart,
        endTime: dEnd,
        displayStart: new Date(slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
        displayEnd: new Date(slotEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
        score: totalScore,
        isPreferred: isSlotInPrefWindow,
        isRecommended: false,
        scoreBreakdown: {
          mentorPreference: mentorPrefScore,
          learnerPreference: learnerPrefScore,
          overlapQuality,
          urgency: urgencyScore,
          fairness: fairnessScore,
          continuity: continuityScore,
        },
        explanation: isSlotInPrefWindow 
          ? `High preference match: within mentor preferred teaching window (${skillPrefStart}–${skillPrefEnd})`
          : `Valid bookable slot with ${bufferMinutes}m buffer constraint.`,
      };

      allGeneratedSlots.push(candidate);

      // If Exact mode requested, check if it matches exact start time
      if (params.isFlexible === false && params.exactStartTime) {
        const slotTimeStr = candidate.displayStart;
        if (slotTimeStr === params.exactStartTime) {
          candidateSlots.push(candidate);
        }
      } else {
        candidateSlots.push(candidate);
      }
    }
  }

  // Sort candidate slots by highest ranking score
  candidateSlots.sort((a, b) => b.score - a.score);
  if (candidateSlots.length > 0) {
    candidateSlots[0].isRecommended = true;
  }

  // If Exact mode resulted in 0 slots, find closest alternatives from allGeneratedSlots
  let closestAlternatives: CandidateSlot[] = [];
  if (params.isFlexible === false && candidateSlots.length === 0 && allGeneratedSlots.length > 0) {
    closestAlternatives = allGeneratedSlots.slice(0, 3);
  }

  return {
    candidateSlots,
    dayOfWeek: dayName,
    mentorAvailable: candidateSlots.length > 0,
    totalValidSlots: candidateSlots.length,
    preferredWindowDisplay: `${skillPrefStart} – ${skillPrefEnd}`,
    closestAlternatives,
  };
}

/**
 * High-Level IRCTC-Style Smart Slot Search across all eligible mentors
 */
export function searchSmartSlots(
  params: SmartSlotSearchParams,
  weights: SchedulingRankingWeights = DEFAULT_SCHEDULING_WEIGHTS
): SmartSlotSearchResult {
  const db = getDb();
  const dateObj = new Date(`${params.date}T00:00:00Z`);
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = daysOfWeek[dateObj.getUTCDay()];

  const durationHours = (params.durationMinutes || 60) / 60.0;
  const query = (params.skillQuery || '').trim();

  // 1. Fetch Learner info for college isolation
  let learnerCollege = '';
  if (params.learnerId) {
    const lProf = db.prepare('SELECT college FROM profiles WHERE user_id = ?').get(params.learnerId) as any;
    learnerCollege = (lProf?.college || '').toLowerCase();
  }

  // 2. Find eligible mentors teaching the requested skill or all active teachers
  let mentorQuery = `
    SELECT 
      u.id as user_id,
      p.display_name,
      p.avatar,
      p.college,
      p.major,
      p.year,
      p.is_verified_student,
      p.trust_score,
      p.completion_rate,
      p.hourly_rate_credits,
      p.teaching_preference,
      s.id as skill_id,
      s.name as skill_name,
      s.category as skill_category,
      us.proficiency,
      us.experience_years,
      us.verification_status,
      COALESCE(r.bayesian_rating, 4.5) as bayesian_rating,
      COALESCE(r.total_reviews, 0) as total_reviews,
      COALESCE(r.total_sessions_taught, 0) as total_sessions_taught,
      COALESCE(r.reliability_score, 95.0) as reliability_score
    FROM user_skills us
    JOIN skills s ON us.skill_id = s.id
    JOIN users u ON us.user_id = u.id
    JOIN profiles p ON u.id = p.user_id
    LEFT JOIN reputations r ON u.id = r.user_id
    WHERE u.status = 'ACTIVE'
  `;

  const queryArgs: any[] = [];
  if (params.learnerId) {
    mentorQuery += ' AND u.id != ?';
    queryArgs.push(params.learnerId);
  }

  if (query) {
    mentorQuery += ' AND (LOWER(s.name) LIKE ? OR LOWER(p.display_name) LIKE ?)';
    queryArgs.push(`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`);
  }

  if (params.verifiedOnly) {
    mentorQuery += " AND us.verification_status IN ('PEER_VERIFIED', 'PLATFORM_VERIFIED', 'ASSESSMENT_VERIFIED')";
  }

  const eligibleMentors = db.prepare(mentorQuery).all(...queryArgs) as any[];

  // Case A: Zero mentors found anywhere in the network
  if (eligibleMentors.length === 0) {
    return {
      status: 'NO_MENTOR_FOUND',
      date: params.date,
      dayOfWeek: dayName,
      insideCollegeMentors: [],
      outsideCollegeMentors: [],
      totalMentorsFound: 0,
      totalValidSlots: 0,
      isStage2Fallback: false,
      message: `No verified mentor found for "${query || 'requested skill'}" anywhere in the SkillSwap network.`,
    };
  }

  const insideCollegeMentors: MentorWithSlots[] = [];
  const outsideCollegeMentors: MentorWithSlots[] = [];

  for (const m of eligibleMentors) {
    const candCollege = (m.college || '').toLowerCase();
    const isOutside = Boolean(learnerCollege && candCollege && learnerCollege !== candCollege);

    if (params.campusScope === 'OWN_COLLEGE' && isOutside) {
      continue;
    }

    // Calculate slots for this mentor
    const slotResult = calculateAvailableSlots({
      teacherId: m.user_id,
      learnerId: params.learnerId,
      date: params.date,
      startTimeWindow: params.startTimeWindow || '08:00',
      endTimeWindow: params.endTimeWindow || '22:00',
      durationHours,
      bufferMinutes: 15,
      isFlexible: params.isFlexible ?? true,
      skillId: m.skill_id,
    }, weights);

    // Compute composite match score
    const skillScore = m.verification_status === 'PLATFORM_VERIFIED' ? 98 : m.verification_status === 'PEER_VERIFIED' ? 88 : 75;
    const ratingScore = Math.min(100, Math.round(m.bayesian_rating * 20));
    const reliabilityScore = Math.round(m.reliability_score || 95);
    const slotsBonus = slotResult.candidateSlots.length > 0 ? 95 : 50;

    const matchScore = Math.round(
      (skillScore * 0.35) +
      (slotsBonus * 0.25) +
      (ratingScore * 0.20) +
      (reliabilityScore * 0.20)
    );

    const mentorWithSlots: MentorWithSlots = {
      userId: m.user_id,
      displayName: m.display_name,
      avatar: m.avatar,
      college: m.college || 'Campus Faculty',
      major: m.major || 'Computer Science',
      year: m.year || 'Senior',
      isOutsideCollege: isOutside,
      isVerifiedStudent: Boolean(m.is_verified_student),
      trustScore: m.trust_score || 85,
      completionRate: m.completion_rate || 100,
      hourlyRateCredits: m.hourly_rate_credits || 1,
      teachingPreference: m.teaching_preference || 'Anyone',
      matchedSkill: {
        skillId: m.skill_id,
        skillName: m.skill_name,
        category: m.skill_category,
        proficiency: m.proficiency,
        experienceYears: m.experience_years || 1,
        verificationStatus: m.verification_status,
      },
      reputation: {
        bayesianRating: m.bayesian_rating,
        totalReviews: m.total_reviews,
        totalSessionsTaught: m.total_sessions_taught,
        reliabilityScore: m.reliability_score,
      },
      matchScore,
      availableSlots: slotResult.candidateSlots,
      preferredWindowDisplay: slotResult.preferredWindowDisplay,
      closestAlternatives: slotResult.closestAlternatives,
    };

    if (!isOutside) {
      insideCollegeMentors.push(mentorWithSlots);
    } else {
      outsideCollegeMentors.push(mentorWithSlots);
    }
  }

  // Sort mentors by match score & slot availability
  insideCollegeMentors.sort((a, b) => (b.availableSlots.length > 0 ? 100 : 0) + b.matchScore - ((a.availableSlots.length > 0 ? 100 : 0) + a.matchScore));
  outsideCollegeMentors.sort((a, b) => (b.availableSlots.length > 0 ? 100 : 0) + b.matchScore - ((a.availableSlots.length > 0 ? 100 : 0) + a.matchScore));

  const totalValidSlots = insideCollegeMentors.reduce((acc, m) => acc + m.availableSlots.length, 0) +
                          outsideCollegeMentors.reduce((acc, m) => acc + m.availableSlots.length, 0);

  const totalMentorsFound = insideCollegeMentors.length + outsideCollegeMentors.length;
  const isStage2Fallback = insideCollegeMentors.filter(m => m.availableSlots.length > 0).length === 0 &&
                           outsideCollegeMentors.filter(m => m.availableSlots.length > 0).length > 0;

  // Case B: Mentors exist in database, but 0 slots in requested time window
  if (totalValidSlots === 0) {
    return {
      status: 'NO_SLOTS_AVAILABLE_AT_TIME',
      date: params.date,
      dayOfWeek: dayName,
      insideCollegeMentors,
      outsideCollegeMentors,
      totalMentorsFound,
      totalValidSlots: 0,
      isStage2Fallback,
      message: `We found ${totalMentorsFound} mentor(s) for "${query || 'your search'}", but none have bookable slots during your selected time window on ${dayName}.`,
    };
  }

  return {
    status: 'SUCCESS',
    date: params.date,
    dayOfWeek: dayName,
    insideCollegeMentors,
    outsideCollegeMentors,
    totalMentorsFound,
    totalValidSlots,
    isStage2Fallback,
    message: `Found ${totalValidSlots} valid, bookable time slot(s) across ${totalMentorsFound} verified mentor(s).`,
  };
}
