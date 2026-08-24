import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_URL
  ? path.resolve(process.cwd(), process.env.DATABASE_URL)
  : path.join(dataDir, 'skillswap.db');

// Global cached instance for Next.js hot reloading
let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('busy_timeout = 5000');
    initDatabase(dbInstance);
  }
  return dbInstance;
}

export function initDatabase(db: Database.Database) {
  // Execute database schema
  db.exec(`
    -- 1. Users & Authentication
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'STUDENT', -- 'STUDENT', 'MODERATOR', 'ADMIN'
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'UNDER_REVIEW'
      campus_id TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Profiles
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      avatar TEXT,
      bio TEXT,
      college TEXT,
      major TEXT,
      year TEXT,
      is_verified_student INTEGER NOT NULL DEFAULT 0,
      trust_score REAL NOT NULL DEFAULT 70.0,
      completion_rate REAL NOT NULL DEFAULT 100.0,
      cancellation_rate REAL NOT NULL DEFAULT 0.0,
      hourly_rate_credits INTEGER NOT NULL DEFAULT 1,
      teaching_style TEXT DEFAULT 'Interactive & Hands-on',
      languages TEXT DEFAULT 'English',
      profile_visibility TEXT DEFAULT 'PUBLIC', -- 'PUBLIC', 'CAMPUS_ONLY', 'PRIVATE'
      ml_consent INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 3. Skills Master
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL, -- 'Computer Science', 'Design', 'Languages', 'Mathematics', 'Business', 'Music'
      icon TEXT DEFAULT 'BookOpen',
      description TEXT,
      is_verified INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. User Teaching Skills
    CREATE TABLE IF NOT EXISTS user_skills (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      proficiency TEXT NOT NULL, -- 'Beginner', 'Intermediate', 'Advanced', 'Expert'
      experience_years REAL DEFAULT 1.0,
      teaching_style TEXT DEFAULT 'Hands-on project based',
      verification_status TEXT NOT NULL DEFAULT 'CLAIMED', -- 'CLAIMED', 'AI_SUGGESTED', 'PEER_VERIFIED', 'PLATFORM_VERIFIED'
      evidence_url TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, skill_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    -- 5. User Learning Goals
    CREATE TABLE IF NOT EXISTS learning_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      target_proficiency TEXT NOT NULL DEFAULT 'Intermediate',
      priority TEXT NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH'
      notes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, skill_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    -- 6. Availability Slots
    CREATE TABLE IF NOT EXISTS availability_slots (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      day_of_week TEXT NOT NULL, -- 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
      start_time TEXT NOT NULL, -- '18:00'
      end_time TEXT NOT NULL,   -- '20:00'
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 7. Sessions Lifecycle
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      learner_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'REQUESTED', -- 'REQUESTED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_CONFIRMATION', 'COMPLETED', 'CREDIT_SETTLED', 'DISPUTED', 'CANCELLED'
      scheduled_start DATETIME NOT NULL,
      scheduled_end DATETIME NOT NULL,
      duration_hours REAL NOT NULL DEFAULT 1.0,
      credits_amount INTEGER NOT NULL DEFAULT 1,
      mode TEXT NOT NULL DEFAULT 'ONLINE', -- 'ONLINE', 'CAMPUS_IN_PERSON'
      location_or_url TEXT DEFAULT 'https://meet.skillswap.internal/room',
      learner_confirmed INTEGER NOT NULL DEFAULT 0,
      teacher_confirmed INTEGER NOT NULL DEFAULT 0,
      idempotency_key TEXT UNIQUE NOT NULL,
      notes TEXT,
      cancellation_reason TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (skill_id) REFERENCES skills(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id),
      FOREIGN KEY (learner_id) REFERENCES users(id)
    );

    -- 7a. Session Participants (Discrete per-session roles: LEARNER vs TRAINER)
    CREATE TABLE IF NOT EXISTS session_participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      session_role TEXT NOT NULL, -- 'LEARNER', 'TRAINER'
      confirmed INTEGER NOT NULL DEFAULT 0,
      joined_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, user_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 7b. Pre-Session Skill Return Exchange Agreements
    CREATE TABLE IF NOT EXISTS session_exchange_agreements (
      id TEXT PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      mentor_id TEXT NOT NULL,
      learner_id TEXT NOT NULL,
      taught_skill_id TEXT NOT NULL,
      requested_return_skill_id TEXT,
      requested_return_skill_name TEXT NOT NULL,
      return_type TEXT NOT NULL DEFAULT 'SKILL', -- 'SKILL', 'CREDITS'
      credit_amount INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'PROPOSED', -- 'PENDING', 'PROPOSED', 'ACCEPTED', 'REJECTED', 'CHANGED', 'EXPIRED', 'CANCELLED'
      proposal_count INTEGER NOT NULL DEFAULT 1,
      proposed_by TEXT NOT NULL,
      accepted_by TEXT,
      notes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      accepted_at DATETIME,
      expires_at DATETIME,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (taught_skill_id) REFERENCES skills(id),
      FOREIGN KEY (requested_return_skill_id) REFERENCES skills(id)
    );

    -- 8. Skill Credits Ledger
    CREATE TABLE IF NOT EXISTS skill_credit_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      balance INTEGER NOT NULL DEFAULT 3, -- 3 starter credits
      escrow_balance INTEGER NOT NULL DEFAULT 0,
      lifetime_earned INTEGER NOT NULL DEFAULT 0,
      lifetime_spent INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS credit_transactions (
      id TEXT PRIMARY KEY,
      reference_session_id TEXT,
      sender_id TEXT, -- NULL for system mint / faucet
      receiver_id TEXT, -- NULL for escrow burn or platform reserve
      amount INTEGER NOT NULL,
      transaction_type TEXT NOT NULL, -- 'ESCROW_RESERVE', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'STARTER_GRANT', 'BONUS', 'ADMIN_ADJUST'
      status TEXT NOT NULL DEFAULT 'SETTLED', -- 'PENDING', 'SETTLED', 'FAILED', 'REVERSED'
      idempotency_key TEXT UNIQUE NOT NULL,
      on_chain_tx_hash TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reference_session_id) REFERENCES sessions(id),
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    );

    -- 9. Ratings & Confidence-Aware Reputation
    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      rater_id TEXT NOT NULL,
      ratee_id TEXT NOT NULL,
      score REAL NOT NULL CHECK(score >= 1.0 AND score <= 5.0),
      review TEXT,
      skills_demonstrated TEXT,
      punctuality_score REAL DEFAULT 5.0,
      clarity_score REAL DEFAULT 5.0,
      flagged_suspicious INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (rater_id) REFERENCES users(id),
      FOREIGN KEY (ratee_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reputations (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      total_reviews INTEGER NOT NULL DEFAULT 0,
      total_sessions_taught INTEGER NOT NULL DEFAULT 0,
      total_sessions_learned INTEGER NOT NULL DEFAULT 0,
      bayesian_rating REAL NOT NULL DEFAULT 4.5,
      reliability_score REAL NOT NULL DEFAULT 95.0,
      teaching_score REAL NOT NULL DEFAULT 90.0,
      reciprocal_rating_ratio REAL NOT NULL DEFAULT 0.0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 10. Verifiable Credentials & Badges
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL, -- e.g., 'Python Mentor - Level 1'
      badge_type TEXT NOT NULL, -- 'MENTOR_TIER_1', 'MENTOR_TIER_2', 'RELIABLE_TEACHER', 'CAMPUS_CONTRIBUTOR'
      skill_id TEXT,
      token_id TEXT, -- On-chain ERC-721/1155 Token ID
      tx_hash TEXT,
      criteria_met TEXT NOT NULL, -- JSON string of condition values satisfied
      is_revoked INTEGER NOT NULL DEFAULT 0,
      issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id)
    );

    -- 11. Campus Verification & Sybil Defense
    CREATE TABLE IF NOT EXISTS campus_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      student_email TEXT NOT NULL,
      college_id_card_url TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VERIFIED', 'REJECTED'
      verified_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 12. Safety, Reports, Disputes & Fraud Alerts
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      reported_id TEXT NOT NULL,
      session_id TEXT,
      reason TEXT NOT NULL, -- 'NO_SHOW', 'HARASSMENT', 'WRONG_SKILL', 'CREDIT_FRAUD', 'OTHER'
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'
      resolution_notes TEXT,
      moderator_id TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id),
      FOREIGN KEY (reported_id) REFERENCES users(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id TEXT PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      initiator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'UNDER_REVIEW', 'RESOLVED_REFUND', 'RESOLVED_PAYOUT', 'DISMISSED'
      evidence_url TEXT,
      moderator_id TEXT,
      resolution_notes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (initiator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS fraud_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      risk_score REAL NOT NULL, -- 0 to 100
      risk_level TEXT NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
      anomaly_reasons TEXT NOT NULL, -- JSON array of detected signals
      status TEXT NOT NULL DEFAULT 'PENDING_REVIEW', -- 'PENDING_REVIEW', 'INVESTIGATING', 'CLEARED', 'RESTRICTED'
      reviewed_by TEXT,
      review_notes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      previous_state TEXT,
      new_state TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'INFO',
      related_entity_type TEXT, -- 'SESSION', 'MENTOR', 'LEARNER_REQUEST', 'CREDIT', 'SECURITY', 'SYSTEM'
      related_entity_id TEXT,
      action_url TEXT,
      link TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id TEXT PRIMARY KEY,
      in_app_enabled INTEGER NOT NULL DEFAULT 1,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      session_updates INTEGER NOT NULL DEFAULT 1,
      mentor_available INTEGER NOT NULL DEFAULT 1,
      credits INTEGER NOT NULL DEFAULT 1,
      security INTEGER NOT NULL DEFAULT 1,
      system INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS session_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      actor_id TEXT,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      previous_state TEXT,
      new_state TEXT,
      metadata_json TEXT DEFAULT '{}',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    -- 13. Web3 Wallets & Blockchain Anchors
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      address TEXT UNIQUE NOT NULL,
      chain_id INTEGER NOT NULL DEFAULT 31337,
      signature_proof TEXT NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 1,
      linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS blockchain_transactions (
      id TEXT PRIMARY KEY,
      reference_type TEXT NOT NULL, -- 'SESSION_SETTLEMENT', 'CREDENTIAL_MINT', 'ANCHOR_PROOF'
      reference_id TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      contract_address TEXT NOT NULL,
      tx_hash TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONFIRMED', -- 'PENDING', 'CONFIRMED', 'FAILED', 'RECONCILIATION_REQUIRED'
      block_number INTEGER,
      payload_json TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 14. StudySphere Campus Features
    CREATE TABLE IF NOT EXISTS study_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      subject TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      meeting_schedule TEXT DEFAULT 'Every Wednesday 5 PM',
      max_members INTEGER NOT NULL DEFAULT 8,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS study_group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'MEMBER', -- 'ADMIN', 'MEMBER'
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS study_resources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      subject TEXT NOT NULL,
      author_id TEXT NOT NULL,
      resource_type TEXT NOT NULL DEFAULT 'PDF', -- 'PDF', 'NOTES', 'CODE', 'EXAM_PREP'
      file_url TEXT,
      upvotes INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS flashcard_decks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      cards_count INTEGER NOT NULL DEFAULT 0,
      is_public INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      mastery_level INTEGER NOT NULL DEFAULT 0, -- 0 to 5 (Spaced Repetition)
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exchange_proposals (
      id TEXT PRIMARY KEY,
      cycle_hash TEXT UNIQUE NOT NULL,
      participants_json TEXT NOT NULL, -- Array of User IDs in cycle
      skills_flow_json TEXT NOT NULL,   -- Array of { fromUser, toUser, skillName }
      status TEXT NOT NULL DEFAULT 'PROPOSED', -- 'PROPOSED', 'ACCEPTED_BY_ALL', 'EXECUTED', 'DECLINED', 'EXPIRED'
      accepted_users_json TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );

    -- 15. Skill Assessments & Verification
    CREATE TABLE IF NOT EXISTS skill_assessments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      score REAL NOT NULL,
      max_score REAL NOT NULL,
      percentage REAL NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      target_level TEXT NOT NULL DEFAULT 'Beginner', -- 'Beginner', 'Intermediate', 'Advanced', 'Expert'
      verified_level TEXT,
      version TEXT NOT NULL DEFAULT 'v1.0',
      answers_json TEXT,
      attempts INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skill_evidence (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      evidence_type TEXT NOT NULL, -- 'PORTFOLIO_LINK', 'GITHUB_REPO', 'CERTIFICATE', 'PROJECT_DEMO', 'ACADEMIC_TRANSCRIPT'
      title TEXT NOT NULL,
      url TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
      reviewed_by TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    -- 16. Skill Gap & Learner Demand Requests
    CREATE TABLE IF NOT EXISTS skill_requests (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      requested_proficiency TEXT NOT NULL DEFAULT 'Beginner',
      current_proficiency TEXT NOT NULL DEFAULT 'Beginner',
      learning_goal TEXT,
      preferred_schedule TEXT,
      preferred_session_mode TEXT NOT NULL DEFAULT 'ONLINE', -- 'ONLINE', 'CAMPUS_IN_PERSON'
      urgency TEXT NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH'
      status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'MATCHED', 'FULFILLED', 'CANCELLED', 'EXPIRED'
      matched_teacher_id TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS learning_requests (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Computer Science',
      requested_proficiency TEXT NOT NULL DEFAULT 'Beginner', -- 'Beginner', 'Intermediate', 'Advanced', 'Expert'
      preferred_days TEXT NOT NULL DEFAULT '["Tuesday","Thursday"]', -- JSON array of day strings
      preferred_time_start TEXT NOT NULL DEFAULT '17:00',
      preferred_time_end TEXT NOT NULL DEFAULT '20:00',
      duration_hours REAL NOT NULL DEFAULT 1.0,
      learning_goal TEXT,
      search_scope TEXT NOT NULL DEFAULT 'ALL', -- 'OWN_COLLEGE', 'PARTNER_COLLEGE', 'ALL'
      status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'MENTOR_FOUND', 'NOTIFIED', 'SESSION_REQUESTED', 'SESSION_CONFIRMED', 'FULFILLED', 'CANCELLED', 'EXPIRED'
      matched_mentor_id TEXT,
      matched_at DATETIME,
      match_score REAL,
      match_reasons_json TEXT DEFAULT '[]',
      session_id TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
      FOREIGN KEY (matched_mentor_id) REFERENCES users(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS learning_request_matches (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      mentor_id TEXT NOT NULL,
      match_score REAL NOT NULL,
      match_reasons_json TEXT NOT NULL DEFAULT '[]',
      notified_at DATETIME,
      status TEXT NOT NULL DEFAULT 'FOUND', -- 'FOUND', 'NOTIFIED', 'VIEWED', 'SESSION_REQUESTED', 'DECLINED'
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(request_id, mentor_id),
      FOREIGN KEY (request_id) REFERENCES learning_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS learning_request_events (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      event_type TEXT NOT NULL, -- 'REQUEST_CREATED', 'COLLEGE_SEARCH_EMPTY', 'OUTSIDE_SEARCH_EMPTY', 'MENTOR_REGISTERED_VERIFIED', 'MENTOR_MATCHED', 'NOTIFICATION_SENT', 'SESSION_REQUESTED', 'SESSION_CONFIRMED', 'SESSION_COMPLETED', 'REQUEST_FULFILLED', 'REQUEST_CANCELLED'
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata_json TEXT DEFAULT '{}',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES learning_requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id TEXT PRIMARY KEY,
      notification_id TEXT,
      user_id TEXT NOT NULL,
      request_id TEXT,
      type TEXT NOT NULL DEFAULT 'MENTOR_FOUND',
      channel TEXT NOT NULL DEFAULT 'IN_APP', -- 'IN_APP', 'EMAIL', 'PUSH'
      recipient TEXT,
      subject TEXT,
      content TEXT,
      status TEXT NOT NULL DEFAULT 'SENT', -- 'PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ'
      error_details TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      delivered_at DATETIME,
      read_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 16b. Video Attendance & Classroom Telemetry
    CREATE TABLE IF NOT EXISTS session_attendance (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      event_type TEXT NOT NULL, -- 'JOINED', 'LEFT', 'RECONNECTED', 'MUTED', 'UNMUTED', 'VIDEO_ON', 'VIDEO_OFF', 'SCREEN_SHARE_START', 'SCREEN_SHARE_STOP'
      joined_at DATETIME,
      left_at DATETIME,
      duration_seconds INTEGER DEFAULT 0,
      metadata_json TEXT DEFAULT '{}',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 16c. Secure In-Room Session Chat
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SENT', -- 'SENDING', 'SENT', 'FAILED'
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 16d. Video Room Signaling & WebRTC Exchange
    CREATE TABLE IF NOT EXISTS session_signaling_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      receiver_id TEXT,
      signal_type TEXT NOT NULL, -- 'OFFER', 'ANSWER', 'ICE_CANDIDATE', 'JOIN_ROOM', 'LEAVE_ROOM', 'PRESENCE_PING'
      payload_json TEXT NOT NULL,
      is_consumed INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 16e. Live Video Room Presence & Device State
    CREATE TABLE IF NOT EXISTS session_room_presence (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'TRAINER', 'LEARNER'
      camera_on INTEGER NOT NULL DEFAULT 1,
      mic_on INTEGER NOT NULL DEFAULT 1,
      screen_sharing INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'CONNECTED', -- 'CONNECTED', 'DISCONNECTED'
      last_ping DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, user_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 16f. Collaborative Live Code & Scratchpad
    CREATE TABLE IF NOT EXISTS session_scratchpads (
      id TEXT PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT 'javascript',
      updated_by TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skill_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, skill_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    -- 17. AI Study Roadmaps & Structured Stages
    CREATE TABLE IF NOT EXISTS study_roadmaps (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      goal TEXT NOT NULL,
      current_level TEXT NOT NULL DEFAULT 'Beginner',
      target_level TEXT NOT NULL DEFAULT 'Intermediate',
      weekly_hours INTEGER DEFAULT 6,
      estimated_duration TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS roadmap_stages (
      id TEXT PRIMARY KEY,
      roadmap_id TEXT NOT NULL,
      stage_order INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      skill_query TEXT NOT NULL,
      estimated_hours INTEGER DEFAULT 5,
      objectives_json TEXT NOT NULL DEFAULT '[]',
      practice_tasks_json TEXT NOT NULL DEFAULT '[]',
      completion_criteria_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'NOT_STARTED', -- 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (roadmap_id) REFERENCES study_roadmaps(id) ON DELETE CASCADE
    );

    -- Indexes for High Performance Querying
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_skills_skill ON user_skills(skill_id);
    CREATE INDEX IF NOT EXISTS idx_learning_goals_user ON learning_goals(user_id);
    CREATE INDEX IF NOT EXISTS idx_availability_user ON availability_slots(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_teacher ON sessions(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_learner ON sessions(learner_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_ratings_rater ON ratings(rater_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON ratings(ratee_id);
    CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(sender_id, receiver_id);
    CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user ON fraud_alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_skill_assessments_user ON skill_assessments(user_id);
    CREATE INDEX IF NOT EXISTS idx_skill_assessments_skill ON skill_assessments(skill_id);
    CREATE INDEX IF NOT EXISTS idx_skill_evidence_user ON skill_evidence(user_id);
    CREATE INDEX IF NOT EXISTS idx_skill_requests_skill ON skill_requests(skill_id);
    CREATE INDEX IF NOT EXISTS idx_skill_requests_learner ON skill_requests(learner_id);
    CREATE INDEX IF NOT EXISTS idx_learning_requests_learner ON learning_requests(learner_id);
    CREATE INDEX IF NOT EXISTS idx_learning_requests_skill ON learning_requests(skill_id);
    CREATE INDEX IF NOT EXISTS idx_learning_requests_status ON learning_requests(status);
    CREATE INDEX IF NOT EXISTS idx_learning_req_matches_req ON learning_request_matches(request_id);
    CREATE INDEX IF NOT EXISTS idx_learning_req_events_req ON learning_request_events(request_id);
    CREATE INDEX IF NOT EXISTS idx_notif_deliveries_user ON notification_deliveries(user_id);
    CREATE INDEX IF NOT EXISTS idx_session_attendance_sess ON session_attendance(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_sess ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_skill_subs_user_skill ON skill_subscriptions(user_id, skill_id);
    CREATE INDEX IF NOT EXISTS idx_study_roadmaps_user ON study_roadmaps(user_id);
    CREATE INDEX IF NOT EXISTS idx_roadmap_stages_roadmap ON roadmap_stages(roadmap_id);
    CREATE INDEX IF NOT EXISTS idx_exchange_session ON session_exchange_agreements(session_id);
    CREATE INDEX IF NOT EXISTS idx_exchange_mentor ON session_exchange_agreements(mentor_id);
    CREATE INDEX IF NOT EXISTS idx_exchange_learner ON session_exchange_agreements(learner_id);
    CREATE INDEX IF NOT EXISTS idx_session_participants_session ON session_participants(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_participants_user ON session_participants(user_id, session_role);
    CREATE INDEX IF NOT EXISTS idx_sessions_sched_start ON sessions(scheduled_start);
    CREATE INDEX IF NOT EXISTS idx_credit_tx_date ON credit_transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_credit_tx_ref_session ON credit_transactions(reference_session_id);
  `);

  // Auto-sync session_participants from sessions table
  syncSessionParticipants(db);

  // Safe runtime column migrations for existing DB
  safeAddColumn(db, 'users', 'user_type', "TEXT NOT NULL DEFAULT 'TEACHER_LEARNER'");
  safeAddColumn(db, 'users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
  safeAddColumn(db, 'users', 'verification_token', 'TEXT');
  safeAddColumn(db, 'users', 'verification_token_expires', 'DATETIME');
  safeAddColumn(db, 'users', 'is_academic_email', 'INTEGER NOT NULL DEFAULT 0');
  safeAddColumn(db, 'profiles', 'teaching_preference', "TEXT DEFAULT 'Anyone'");
  safeAddColumn(db, 'profiles', 'portfolio_url', 'TEXT');
  safeAddColumn(db, 'profiles', 'skill_visibility', "TEXT DEFAULT 'PUBLIC'");
  safeAddColumn(db, 'profiles', 'availability_visibility', "TEXT DEFAULT 'PUBLIC'");
  safeAddColumn(db, 'profiles', 'portfolio_visibility', "TEXT DEFAULT 'PUBLIC'");
  safeAddColumn(db, 'profiles', 'learning_goal_visibility', "TEXT DEFAULT 'PUBLIC'");
  safeAddColumn(db, 'profiles', 'daily_session_limit', 'INTEGER DEFAULT 3');
  safeAddColumn(db, 'profiles', 'email_notifications_enabled', 'INTEGER DEFAULT 1');
  safeAddColumn(db, 'profiles', 'push_notifications_enabled', 'INTEGER DEFAULT 1');
  safeAddColumn(db, 'profiles', 'in_app_notifications_enabled', 'INTEGER DEFAULT 1');
  safeAddColumn(db, 'user_skills', 'assessment_score', 'REAL');
  safeAddColumn(db, 'user_skills', 'verified_at', 'DATETIME');
  safeAddColumn(db, 'user_skills', 'verified_by', 'TEXT');
  safeAddColumn(db, 'user_skills', 'reassessment_required', 'INTEGER DEFAULT 0');
  
  // Smart Slot Finder: Teacher Skill Specific Availability & Preferences
  safeAddColumn(db, 'user_skills', 'teaching_days', "TEXT DEFAULT '[\"Monday\",\"Wednesday\",\"Friday\"]'");
  safeAddColumn(db, 'user_skills', 'available_start_time', "TEXT DEFAULT '17:00'");
  safeAddColumn(db, 'user_skills', 'available_end_time', "TEXT DEFAULT '20:00'");
  safeAddColumn(db, 'user_skills', 'preferred_start_time', "TEXT DEFAULT '18:00'");
  safeAddColumn(db, 'user_skills', 'preferred_end_time', "TEXT DEFAULT '20:00'");
  safeAddColumn(db, 'user_skills', 'session_duration_minutes', 'INTEGER DEFAULT 60');
  safeAddColumn(db, 'user_skills', 'timezone', "TEXT DEFAULT 'Asia/Kolkata'");
  safeAddColumn(db, 'user_skills', 'is_flexible', 'INTEGER DEFAULT 1');

  // Smart Slot Finder: Learner Goal Specific Availability & Preferences
  safeAddColumn(db, 'learning_goals', 'learning_days', "TEXT DEFAULT '[\"Tuesday\",\"Thursday\",\"Saturday\"]'");
  safeAddColumn(db, 'learning_goals', 'available_start_time', "TEXT DEFAULT '18:00'");
  safeAddColumn(db, 'learning_goals', 'available_end_time', "TEXT DEFAULT '21:00'");
  safeAddColumn(db, 'learning_goals', 'preferred_start_time', "TEXT DEFAULT '19:00'");
  safeAddColumn(db, 'learning_goals', 'preferred_end_time', "TEXT DEFAULT '21:00'");
  safeAddColumn(db, 'learning_goals', 'session_duration_minutes', 'INTEGER DEFAULT 60');
  safeAddColumn(db, 'learning_goals', 'timezone', "TEXT DEFAULT 'Asia/Kolkata'");
  safeAddColumn(db, 'learning_goals', 'is_flexible', 'INTEGER DEFAULT 1');

  // Smart Slot Finder: Multiple Availability Windows & Preference Flag
  safeAddColumn(db, 'availability_slots', 'buffer_minutes', 'INTEGER DEFAULT 15');
  safeAddColumn(db, 'availability_slots', 'is_preferred', 'INTEGER DEFAULT 0');
  safeAddColumn(db, 'availability_slots', 'skill_id', 'TEXT');
  safeAddColumn(db, 'availability_slots', 'window_label', "TEXT DEFAULT 'General'");

  // Notifications Entity Link & Read Timestamps
  safeAddColumn(db, 'notifications', 'related_entity_type', 'TEXT');
  safeAddColumn(db, 'notifications', 'related_entity_id', 'TEXT');
  safeAddColumn(db, 'notifications', 'action_url', 'TEXT');
  safeAddColumn(db, 'notifications', 'read_at', 'DATETIME');
}

function safeAddColumn(db: Database.Database, table: string, column: string, definition: string) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    const exists = columns.some(c => c.name.toLowerCase() === column.toLowerCase());
    if (!exists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (err) {
    // Ignore if column already added or table missing during initial bootstrap
  }
}

export function syncSessionParticipants(db: Database.Database) {
  try {
    const sessions = db.prepare(`
      SELECT s.id, s.teacher_id, s.learner_id, s.teacher_confirmed, s.learner_confirmed, s.created_at
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      WHERE sp.id IS NULL
    `).all() as Array<{
      id: string;
      teacher_id: string;
      learner_id: string;
      teacher_confirmed: number;
      learner_confirmed: number;
      created_at: string;
    }>;

    if (sessions.length > 0) {
      const insert = db.prepare(`
        INSERT OR IGNORE INTO session_participants (id, session_id, user_id, session_role, confirmed, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      db.transaction(() => {
        for (const s of sessions) {
          if (s.teacher_id) {
            insert.run(`sp-${s.id}-trainer`, s.id, s.teacher_id, 'TRAINER', s.teacher_confirmed || 0, s.created_at);
          }
          if (s.learner_id) {
            insert.run(`sp-${s.id}-learner`, s.id, s.learner_id, 'LEARNER', s.learner_confirmed || 0, s.created_at);
          }
        }
      })();
    }
  } catch (err) {
    // Ignore sync error during initial table setup
  }
}

export { isAcademicEmail } from './validations';


