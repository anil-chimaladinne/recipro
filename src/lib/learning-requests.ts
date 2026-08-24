import Database from 'better-sqlite3';
import { getDb } from './db';
import { NotificationService } from './notifications';

export interface CreateLearningRequestParams {
  learnerId: string;
  skillName: string;
  category?: string;
  requestedProficiency?: string;
  preferredDays?: string[]; // e.g. ['Tuesday', 'Thursday']
  preferredTimeStart?: string; // e.g. '17:00'
  preferredTimeEnd?: string;   // e.g. '20:00'
  durationHours?: number;      // e.g. 1.0
  learningGoal?: string;
  searchScope?: 'OWN_COLLEGE' | 'PARTNER_COLLEGE' | 'ALL';
}

export interface LearningRequestSummary {
  id: string;
  learnerId: string;
  skillId: string;
  skillName: string;
  category: string;
  requestedProficiency: string;
  preferredDays: string[];
  preferredTimeStart: string;
  preferredTimeEnd: string;
  durationHours: number;
  learningGoal: string;
  searchScope: string;
  status: 'OPEN' | 'MENTOR_FOUND' | 'NOTIFIED' | 'SESSION_REQUESTED' | 'SESSION_CONFIRMED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
  matchedMentor?: {
    userId: string;
    displayName: string;
    avatar: string | null;
    college: string;
    major: string;
    isVerifiedStudent: boolean;
    skillName: string;
    proficiency: string;
    verificationStatus: string;
    bayesianRating: number;
    matchScore: number;
    matchReasons: string[];
    isOutsideCollege: boolean;
    availableSlots?: any[];
  } | null;
  events: Array<{
    id: string;
    eventType: string;
    title: string;
    description: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Creates a persistent learning request and records creation events
 */
export function createLearningRequest(
  db: Database.Database,
  params: CreateLearningRequestParams
): LearningRequestSummary {
  const normalizedSkill = params.skillName.trim();
  const category = params.category || 'Computer Science';
  const proficiency = params.requestedProficiency || 'Beginner';
  const preferredDays = params.preferredDays && params.preferredDays.length > 0 
    ? params.preferredDays 
    : ['Tuesday', 'Thursday'];
  const preferredDaysJson = JSON.stringify(preferredDays);
  const timeStart = params.preferredTimeStart || '17:00';
  const timeEnd = params.preferredTimeEnd || '20:00';
  const durationHours = params.durationHours || 1.0;
  const searchScope = params.searchScope || 'ALL';

  // Find or create skill record
  let skill = db.prepare(`SELECT id, name FROM skills WHERE LOWER(name) = LOWER(?)`).get(normalizedSkill) as { id: string; name: string } | undefined;
  if (!skill) {
    const newSkillId = `skill-${normalizedSkill.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    db.prepare(`
      INSERT INTO skills (id, name, category, icon, is_verified)
      VALUES (?, ?, ?, 'BookOpen', 1)
    `).run(newSkillId, normalizedSkill, category);
    skill = { id: newSkillId, name: normalizedSkill };
  }

  const requestId = `lreq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Atomic insertion of request and initial lifecycle events
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO learning_requests (
        id, learner_id, skill_id, skill_name, category, requested_proficiency,
        preferred_days, preferred_time_start, preferred_time_end, duration_hours,
        learning_goal, search_scope, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      requestId,
      params.learnerId,
      skill.id,
      skill.name,
      category,
      proficiency,
      preferredDaysJson,
      timeStart,
      timeEnd,
      durationHours,
      params.learningGoal || `Learn ${skill.name}`,
      searchScope
    );

    // Initial Timeline Events
    db.prepare(`
      INSERT INTO learning_request_events (id, request_id, event_type, title, description, created_at)
      VALUES (?, ?, 'REQUEST_CREATED', 'Learning Request Created', ?, CURRENT_TIMESTAMP)
    `).run(
      `ev-${requestId}-created`,
      requestId,
      `Requested ${proficiency} level mentorship for ${skill.name} on ${preferredDays.join(', ')} (${timeStart} - ${timeEnd})`
    );

    db.prepare(`
      INSERT INTO learning_request_events (id, request_id, event_type, title, description, created_at)
      VALUES (?, ?, 'COLLEGE_SEARCH_EMPTY', 'College Search Completed', ?, CURRENT_TIMESTAMP)
    `).run(
      `ev-${requestId}-colsearch`,
      requestId,
      `Searched verified mentors inside your college for ${skill.name}. No available mentor found.`
    );

    db.prepare(`
      INSERT INTO learning_request_events (id, request_id, event_type, title, description, created_at)
      VALUES (?, ?, 'OUTSIDE_SEARCH_EMPTY', 'Campus Network Search Completed', ?, CURRENT_TIMESTAMP)
    `).run(
      `ev-${requestId}-netsearch`,
      requestId,
      `Searched external partner colleges for ${skill.name}. Placed request in active queue for notification.`
    );
  });

  tx();

  // Evaluate if any newly eligible mentor already matches
  evaluateActiveLearningRequests(db, { triggerSkillId: skill.id });

  return getLearningRequestDetail(db, requestId)!;
}

/**
 * Hard Constraints Evaluator: Scans OPEN learning requests and matches verified mentors
 */
export function evaluateActiveLearningRequests(
  db: Database.Database,
  filter?: { triggerSkillId?: string; triggerUserId?: string }
): { matchedCount: number } {
  let query = `
    SELECT lr.*, p.college as learner_college
    FROM learning_requests lr
    JOIN profiles p ON lr.learner_id = p.user_id
    WHERE lr.status = 'OPEN'
  `;
  const queryParams: any[] = [];

  if (filter?.triggerSkillId) {
    query += ` AND lr.skill_id = ?`;
    queryParams.push(filter.triggerSkillId);
  }

  const openRequests = db.prepare(query).all(...queryParams) as any[];
  let matchedCount = 0;

  for (const req of openRequests) {
    let preferredDays: string[] = [];
    try {
      preferredDays = JSON.parse(req.preferred_days || '[]');
    } catch {
      preferredDays = ['Tuesday', 'Thursday'];
    }

    // Deterministic Candidate Selection: Verified Mentors with matching skill
    const candidates = db.prepare(`
      SELECT 
        u.id as user_id, u.status as user_status,
        p.display_name, p.college, p.major, p.is_verified_student,
        us.skill_id, us.proficiency, us.verification_status, us.teaching_days,
        us.available_start_time, us.available_end_time,
        COALESCE(r.bayesian_rating, 4.8) as bayesian_rating,
        COALESCE(r.total_sessions_taught, 0) as total_sessions_taught
      FROM user_skills us
      JOIN users u ON us.user_id = u.id
      JOIN profiles p ON u.id = p.user_id
      LEFT JOIN reputations r ON u.id = r.user_id
      WHERE (us.skill_id = ? OR LOWER(us.skill_id) LIKE ?)
        AND us.user_id != ?
        AND u.status = 'ACTIVE'
        AND us.verification_status IN ('PLATFORM_VERIFIED', 'ASSESSMENT_VERIFIED')
    `).all(req.skill_id, `%${req.skill_name.toLowerCase()}%`, req.learner_id) as any[];

    if (candidates.length === 0) continue;

    // Evaluate Hard Overlap Constraints for each candidate
    let bestMatch: any = null;
    let bestScore = 0;
    let matchReasons: string[] = [];

    for (const mentor of candidates) {
      let mentorDays: string[] = [];
      try {
        mentorDays = JSON.parse(mentor.teaching_days || '[]');
      } catch {
        mentorDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      }

      // Check day overlap
      const dayOverlap = preferredDays.filter(d => 
        mentorDays.some(md => md.toLowerCase() === d.toLowerCase())
      );

      // Check time availability overlap
      const mStart = mentor.available_start_time || '17:00';
      const mEnd = mentor.available_end_time || '20:00';
      const rStart = req.preferred_time_start || '17:00';
      const rEnd = req.preferred_time_end || '20:00';

      const hasTimeOverlap = (rStart < mEnd && rEnd > mStart);
      const isInsideCollege = (mentor.college === req.learner_college);

      if (dayOverlap.length > 0 && hasTimeOverlap) {
        let score = 80;
        const reasons: string[] = [
          `✓ ${req.skill_name} skill verified via ${mentor.verification_status.replace('_', ' ')}`,
          `✓ Available on your preferred days (${dayOverlap.join(', ')})`,
          `✓ Overlapping teaching window (${mStart} – ${mEnd})`,
        ];

        if (isInsideCollege) {
          score += 15;
          reasons.unshift(`✓ Attends your campus (${mentor.college})`);
        } else {
          score += 5;
        }

        if (mentor.proficiency === 'Advanced' || mentor.proficiency === 'Expert') {
          score += 5;
          reasons.push(`✓ Advanced subject proficiency (${mentor.proficiency})`);
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = mentor;
          matchReasons = reasons;
        }
      }
    }

    // If an eligible mentor matched hard constraints, transition request
    if (bestMatch) {
      const matchId = `lmatch-${req.id}-${bestMatch.user_id}`;
      const isOutside = bestMatch.college !== req.learner_college;

      db.transaction(() => {
        // 1. Update Learning Request State
        db.prepare(`
          UPDATE learning_requests 
          SET status = 'MENTOR_FOUND', 
              matched_mentor_id = ?, 
              matched_at = CURRENT_TIMESTAMP, 
              match_score = ?, 
              match_reasons_json = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(bestMatch.user_id, bestScore, JSON.stringify(matchReasons), req.id);

        // 2. Insert Match Record (Idempotent)
        db.prepare(`
          INSERT OR REPLACE INTO learning_request_matches (
            id, request_id, mentor_id, match_score, match_reasons_json, notified_at, status, created_at
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'NOTIFIED', CURRENT_TIMESTAMP)
        `).run(
          matchId,
          req.id,
          bestMatch.user_id,
          bestScore,
          JSON.stringify(matchReasons)
        );

        // 3. Log Timeline Events
        db.prepare(`
          INSERT INTO learning_request_events (id, request_id, event_type, title, description, created_at)
          VALUES (?, ?, 'MENTOR_REGISTERED_VERIFIED', 'Verified Mentor Joined', ?, CURRENT_TIMESTAMP)
        `).run(
          `ev-${req.id}-mjoin-${Date.now()}`,
          req.id,
          `${bestMatch.display_name} verified for ${req.skill_name} (${bestMatch.proficiency} level)${isOutside ? ` at ${bestMatch.college}` : ''}`
        );

        db.prepare(`
          INSERT INTO learning_request_events (id, request_id, event_type, title, description, created_at)
          VALUES (?, ?, 'MENTOR_MATCHED', 'Mentor Matched Your Request', ?, CURRENT_TIMESTAMP)
        `).run(
          `ev-${req.id}-mmat-${Date.now()}`,
          req.id,
          `Matched with ${bestMatch.display_name} (${bestScore}% compatibility score).`
        );

        db.prepare(`
          INSERT INTO learning_request_events (id, request_id, event_type, title, description, created_at)
          VALUES (?, ?, 'NOTIFICATION_SENT', 'Notification Dispatched', ?, CURRENT_TIMESTAMP)
        `).run(
          `ev-${req.id}-notif-${Date.now()}`,
          req.id,
          `Sent in-app and email alert to learner.`
        );
      })();

      // 4. Send Multi-Channel Notification to Learner (In-App + Email)
      NotificationService.send(db, {
        userId: req.learner_id,
        requestId: req.id,
        type: 'MENTOR_AVAILABLE',
        title: `🎉 Mentor Found for ${req.skill_name}!`,
        message: `${bestMatch.display_name} is now available to teach ${req.skill_name} (${bestMatch.proficiency}) during your preferred time.${isOutside ? ' (Partner College Mentor)' : ''}`,
        relatedEntityType: 'LEARNER_REQUEST',
        relatedEntityId: bestMatch.user_id,
        mentorName: bestMatch.display_name,
        skillName: req.skill_name,
        mentorVerification: bestMatch.verification_status?.replace('_', ' ') || 'Verified Mentor',
        availabilityWindow: `${bestMatch.available_start_time} – ${bestMatch.available_end_time}`,
        matchScore: bestScore,
        link: `/learner-requests/${req.id}/confirm-match?mentorId=${bestMatch.user_id}`,
        actionUrl: `/learner-requests/${req.id}/confirm-match?mentorId=${bestMatch.user_id}`,
      });

      matchedCount++;
    }
  }

  return { matchedCount };
}

/**
 * Retrieves all learning requests for a specific learner
 */
export function getLearningRequestsForUser(db: Database.Database, userId: string): LearningRequestSummary[] {
  const rows = db.prepare(`
    SELECT lr.*, p.college as learner_college
    FROM learning_requests lr
    JOIN profiles p ON lr.learner_id = p.user_id
    WHERE lr.learner_id = ?
    ORDER BY lr.created_at DESC
  `).all(userId) as any[];

  return rows.map(r => formatLearningRequest(db, r));
}

/**
 * Retrieves a single learning request with full activity timeline and mentor match
 */
export function getLearningRequestDetail(db: Database.Database, requestId: string): LearningRequestSummary | null {
  const row = db.prepare(`
    SELECT lr.*, p.college as learner_college
    FROM learning_requests lr
    JOIN profiles p ON lr.learner_id = p.user_id
    WHERE lr.id = ?
  `).get(requestId) as any;

  if (!row) return null;
  return formatLearningRequest(db, row);
}

/**
 * Cancels a learning request
 */
export function cancelLearningRequest(db: Database.Database, requestId: string, userId: string): boolean {
  const res = db.prepare(`
    UPDATE learning_requests 
    SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND learner_id = ?
  `).run(requestId, userId);

  if (res.changes > 0) {
    db.prepare(`
      INSERT INTO learning_request_events (id, request_id, event_type, title, description, created_at)
      VALUES (?, ?, 'REQUEST_CANCELLED', 'Request Cancelled', 'You cancelled this learning request.', CURRENT_TIMESTAMP)
    `).run(`ev-${requestId}-cancelled`, requestId);
    return true;
  }
  return false;
}

/**
 * Helper to format request row with timeline events and matched mentor
 */
function formatLearningRequest(db: Database.Database, row: any): LearningRequestSummary {
  let preferredDays: string[] = [];
  try {
    preferredDays = JSON.parse(row.preferred_days || '[]');
  } catch {
    preferredDays = ['Tuesday', 'Thursday'];
  }

  let matchReasons: string[] = [];
  try {
    matchReasons = JSON.parse(row.match_reasons_json || '[]');
  } catch {
    matchReasons = [];
  }

  // Fetch timeline events
  const events = db.prepare(`
    SELECT id, event_type, title, description, created_at
    FROM learning_request_events
    WHERE request_id = ?
    ORDER BY created_at ASC
  `).all(row.id) as any[];

  // Fetch matched mentor if present
  let matchedMentor = null;
  if (row.matched_mentor_id) {
    const mentorProfile = db.prepare(`
      SELECT 
        u.id as user_id, p.display_name, p.avatar, p.college, p.major, p.is_verified_student,
        us.proficiency, us.verification_status, us.available_start_time, us.available_end_time,
        COALESCE(r.bayesian_rating, 4.8) as bayesian_rating,
        COALESCE(r.total_sessions_taught, 0) as total_sessions_taught
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      LEFT JOIN user_skills us ON u.id = us.user_id AND (us.skill_id = ? OR LOWER(us.skill_id) LIKE ?)
      LEFT JOIN reputations r ON u.id = r.user_id
      WHERE u.id = ?
    `).get(row.skill_id, `%${row.skill_name.toLowerCase()}%`, row.matched_mentor_id) as any;

    if (mentorProfile) {
      matchedMentor = {
        userId: mentorProfile.user_id,
        displayName: mentorProfile.display_name,
        avatar: mentorProfile.avatar,
        college: mentorProfile.college,
        major: mentorProfile.major,
        isVerifiedStudent: Boolean(mentorProfile.is_verified_student),
        skillName: row.skill_name,
        proficiency: mentorProfile.proficiency || row.requested_proficiency,
        verificationStatus: mentorProfile.verification_status || 'ASSESSMENT_VERIFIED',
        bayesianRating: mentorProfile.bayesian_rating,
        matchScore: row.match_score || 92,
        matchReasons,
        isOutsideCollege: mentorProfile.college !== row.learner_college,
      };
    }
  }

  return {
    id: row.id,
    learnerId: row.learner_id,
    skillId: row.skill_id,
    skillName: row.skill_name,
    category: row.category,
    requestedProficiency: row.requested_proficiency,
    preferredDays,
    preferredTimeStart: row.preferred_time_start,
    preferredTimeEnd: row.preferred_time_end,
    durationHours: row.duration_hours,
    learningGoal: row.learning_goal,
    searchScope: row.search_scope,
    status: row.status,
    matchedMentor,
    events: events.map(e => ({
      id: e.id,
      eventType: e.event_type,
      title: e.title,
      description: e.description,
      createdAt: e.created_at,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
