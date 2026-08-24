import { getDb } from './db';

export interface SkillRequestItem {
  id: string;
  learnerId: string;
  learnerName: string;
  learnerCollege: string;
  skillId: string;
  skillName: string;
  category: string;
  requestedProficiency: string;
  currentProficiency: string;
  learningGoal: string;
  preferredSchedule: string | null;
  preferredSessionMode: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'MATCHED' | 'FULFILLED' | 'CANCELLED';
  createdAt: string;
}

export interface SkillDemandSummary {
  skillId: string;
  skillName: string;
  category: string;
  learnerDemandCount: number;
  verifiedTeacherCount: number;
  pendingTeacherCount: number;
  status: 'ZERO_SUPPLY' | 'LOW_SUPPLY' | 'BALANCED' | 'HEALTHY';
  relatedSkills: string[];
}

/**
 * Related Skills Taxonomy for Potential Mentor Discovery
 */
export const RELATED_SKILLS_MAP: Record<string, string[]> = {
  'quantum computing': ['Physics', 'Linear Algebra', 'Algorithms', 'Machine Learning', 'Python'],
  'solidity': ['JavaScript', 'TypeScript', 'Cryptography', 'Backend Development', 'Rust', 'Python'],
  'rust': ['C++', 'Systems Programming', 'Go', 'Data Structures', 'Operating Systems'],
  'machine learning': ['Python', 'Calculus', 'Linear Algebra', 'Statistics', 'Data Science'],
  'figma': ['UI/UX Design', 'Graphic Design', 'Web Design', 'Frontend Development'],
  'calculus': ['Linear Algebra', 'Physics', 'Discrete Mathematics', 'Differential Equations'],
  'cybersecurity': ['Computer Networks', 'Operating Systems', 'Linux', 'Cryptography', 'Python'],
  'neuroscience': ['Biology', 'Psychology', 'Cognitive Science', 'Machine Learning'],
};

/**
 * Get Demand Aggregation Statistics
 */
export function getSkillDemandAnalytics(): SkillDemandSummary[] {
  const db = getDb();

  const skills = db.prepare('SELECT id, name, category FROM skills ORDER BY name ASC').all() as Array<{
    id: string;
    name: string;
    category: string;
  }>;

  const results: SkillDemandSummary[] = [];

  for (const skill of skills) {
    // 1. Learner Demand Count from Open Skill Requests and Learning Goals
    const requestCount = (db.prepare(`
      SELECT COUNT(*) as count FROM skill_requests WHERE skill_id = ? AND status = 'OPEN'
    `).get(skill.id) as any)?.count || 0;

    const goalCount = (db.prepare(`
      SELECT COUNT(*) as count FROM learning_goals WHERE skill_id = ?
    `).get(skill.id) as any)?.count || 0;

    const totalDemand = requestCount + goalCount;

    // 2. Verified Teachers
    const verifiedCount = (db.prepare(`
      SELECT COUNT(DISTINCT us.user_id) as count 
      FROM user_skills us
      JOIN users u ON us.user_id = u.id
      WHERE us.skill_id = ? 
        AND u.status = 'ACTIVE'
        AND us.verification_status IN ('PLATFORM_VERIFIED', 'ASSESSMENT_VERIFIED')
    `).get(skill.id) as any)?.count || 0;

    // 3. Pending/Claimed Teachers
    const pendingCount = (db.prepare(`
      SELECT COUNT(DISTINCT us.user_id) as count 
      FROM user_skills us
      JOIN users u ON us.user_id = u.id
      WHERE us.skill_id = ? 
        AND u.status = 'ACTIVE'
        AND us.verification_status IN ('SELF_DECLARED', 'CLAIMED', 'AI_SUGGESTED')
    `).get(skill.id) as any)?.count || 0;

    let status: SkillDemandSummary['status'] = 'HEALTHY';
    if (totalDemand > 0 && verifiedCount === 0) {
      status = 'ZERO_SUPPLY';
    } else if (totalDemand > verifiedCount * 3) {
      status = 'LOW_SUPPLY';
    } else if (totalDemand > 0) {
      status = 'BALANCED';
    }

    const normName = skill.name.toLowerCase();
    const related = RELATED_SKILLS_MAP[normName] || ['Computer Science', 'General Mentorship'];

    results.push({
      skillId: skill.id,
      skillName: skill.name,
      category: skill.category,
      learnerDemandCount: totalDemand,
      verifiedTeacherCount: verifiedCount,
      pendingTeacherCount: pendingCount,
      status,
      relatedSkills: related,
    });
  }

  // Sort by highest unfulfilled demand first (ZERO_SUPPLY first, then descending demand)
  results.sort((a, b) => {
    if (a.status === 'ZERO_SUPPLY' && b.status !== 'ZERO_SUPPLY') return -1;
    if (b.status === 'ZERO_SUPPLY' && a.status !== 'ZERO_SUPPLY') return 1;
    return b.learnerDemandCount - a.learnerDemandCount;
  });

  return results;
}

/**
 * Discover Potential Mentors with Related Skills for an unfulfilled skill
 */
export function findPotentialMentorsForSkill(skillName: string): Array<{
  userId: string;
  displayName: string;
  email: string;
  college: string;
  relatedSkillName: string;
  proficiency: string;
  reputationRating: number;
}> {
  const db = getDb();
  const normName = skillName.toLowerCase();
  const relatedNames = RELATED_SKILLS_MAP[normName] || [];

  if (relatedNames.length === 0) return [];

  const placeholders = relatedNames.map(() => '?').join(',');
  const querySql = `
    SELECT DISTINCT
      u.id as user_id, u.email,
      p.display_name, p.college,
      s.name as related_skill_name,
      us.proficiency,
      COALESCE(r.bayesian_rating, 4.5) as reputation_rating
    FROM user_skills us
    JOIN skills s ON us.skill_id = s.id
    JOIN users u ON us.user_id = u.id
    JOIN profiles p ON u.id = p.user_id
    LEFT JOIN reputations r ON u.id = r.user_id
    WHERE u.status = 'ACTIVE'
      AND LOWER(s.name) IN (${placeholders})
      AND us.proficiency IN ('Advanced', 'Expert')
    LIMIT 10
  `;

  const rows = db.prepare(querySql).all(...relatedNames.map(n => n.toLowerCase())) as any[];

  return rows.map(r => ({
    userId: r.user_id,
    displayName: r.display_name,
    email: r.email,
    college: r.college || 'Campus',
    relatedSkillName: r.related_skill_name,
    proficiency: r.proficiency,
    reputationRating: r.reputation_rating,
  }));
}

/**
 * Create a new Skill Request when no verified mentor exists
 */
export function createSkillRequest(data: {
  learnerId: string;
  skillName: string;
  category: string;
  requestedProficiency: string;
  currentProficiency: string;
  learningGoal: string;
  preferredSchedule?: string;
  preferredSessionMode?: string;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
}): { success: boolean; requestId: string; message: string } {
  const db = getDb();

  // Find or create skill
  let skill = db.prepare('SELECT id, name FROM skills WHERE LOWER(name) = LOWER(?)').get(data.skillName) as { id: string; name: string } | undefined;
  if (!skill) {
    const skillId = `skill-${data.skillName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    db.prepare(`
      INSERT INTO skills (id, name, category, icon, description)
      VALUES (?, ?, ?, 'BookOpen', 'Student requested skill')
    `).run(skillId, data.skillName, data.category || 'Computer Science');
    skill = { id: skillId, name: data.skillName };
  }

  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  db.prepare(`
    INSERT INTO skill_requests (
      id, learner_id, skill_id, requested_proficiency, current_proficiency,
      learning_goal, preferred_schedule, preferred_session_mode, urgency, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
  `).run(
    requestId,
    data.learnerId,
    skill.id,
    data.requestedProficiency || 'Beginner',
    data.currentProficiency || 'Beginner',
    data.learningGoal,
    data.preferredSchedule || null,
    data.preferredSessionMode || 'ONLINE',
    data.urgency || 'MEDIUM'
  );

  // Automatically subscribe learner for mentor availability notifications
  db.prepare(`
    INSERT OR IGNORE INTO skill_subscriptions (id, user_id, skill_id)
    VALUES (?, ?, ?)
  `).run(`sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, data.learnerId, skill.id);

  return {
    success: true,
    requestId,
    message: `Skill Request for "${data.skillName}" created! You will be automatically notified as soon as a mentor becomes verified.`,
  };
}

/**
 * Notify Subscribed Learners when a New Verified Mentor Joins
 */
export function notifyLearnersOfNewMentor(teacherId: string, skillId: string): number {
  const db = getDb();

  const skill = db.prepare('SELECT name FROM skills WHERE id = ?').get(skillId) as { name: string } | undefined;
  const teacherProfile = db.prepare('SELECT display_name, college FROM profiles WHERE user_id = ?').get(teacherId) as { display_name: string; college: string } | undefined;

  if (!skill || !teacherProfile) return 0;

  // Find all subscribers and open request owners
  const subscribers = db.prepare(`
    SELECT DISTINCT user_id FROM skill_subscriptions WHERE skill_id = ? AND user_id != ?
    UNION
    SELECT DISTINCT learner_id as user_id FROM skill_requests WHERE skill_id = ? AND status = 'OPEN' AND learner_id != ?
  `).all(skillId, teacherId, skillId, teacherId) as Array<{ user_id: string }>;

  let notifiedCount = 0;
  for (const sub of subscribers) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link)
      VALUES (?, ?, 'New Verified Mentor Available!', ?, 'INFO', '/explore')
    `).run(
      `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sub.user_id,
      `Great news! ${teacherProfile.display_name} (${teacherProfile.college}) is now verified to teach "${skill.name}". Book your session now!`
    );
    notifiedCount++;
  }

  // Update open requests to MATCHED
  db.prepare(`
    UPDATE skill_requests 
    SET status = 'MATCHED', matched_teacher_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE skill_id = ? AND status = 'OPEN'
  `).run(teacherId, skillId);

  return notifiedCount;
}
