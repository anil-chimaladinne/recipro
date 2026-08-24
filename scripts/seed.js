const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'skillswap.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 1. Create Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'STUDENT',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    campus_id TEXT,
    user_type TEXT NOT NULL DEFAULT 'TEACHER_LEARNER',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

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
    teaching_preference TEXT DEFAULT 'Anyone',
    profile_visibility TEXT DEFAULT 'PUBLIC',
    skill_visibility TEXT DEFAULT 'PUBLIC',
    availability_visibility TEXT DEFAULT 'PUBLIC',
    portfolio_visibility TEXT DEFAULT 'PUBLIC',
    learning_goal_visibility TEXT DEFAULT 'PUBLIC',
    daily_session_limit INTEGER DEFAULT 3,
    portfolio_url TEXT,
    ml_consent INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    icon TEXT DEFAULT 'BookOpen',
    description TEXT,
    is_verified INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_skills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    proficiency TEXT NOT NULL,
    experience_years REAL DEFAULT 1.0,
    teaching_style TEXT DEFAULT 'Hands-on project based',
    verification_status TEXT NOT NULL DEFAULT 'CLAIMED',
    evidence_url TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, skill_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS learning_goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    target_proficiency TEXT NOT NULL DEFAULT 'Intermediate',
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, skill_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS availability_slots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    day_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'REQUESTED',
    scheduled_start DATETIME NOT NULL,
    scheduled_end DATETIME NOT NULL,
    duration_hours REAL NOT NULL DEFAULT 1.0,
    credits_amount INTEGER NOT NULL DEFAULT 1,
    mode TEXT NOT NULL DEFAULT 'ONLINE',
    location_or_url TEXT DEFAULT 'https://meet.skillswap.internal/room',
    learner_confirmed INTEGER NOT NULL DEFAULT 0,
    teacher_confirmed INTEGER NOT NULL DEFAULT 0,
    idempotency_key TEXT UNIQUE NOT NULL,
    notes TEXT,
    cancellation_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (skill_id) REFERENCES skills(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    FOREIGN KEY (learner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS session_participants (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_role TEXT NOT NULL,
    confirmed INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, user_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS session_exchange_agreements (
    id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    mentor_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    taught_skill_id TEXT NOT NULL,
    requested_return_skill_name TEXT,
    return_type TEXT NOT NULL,
    credit_amount INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'PENDING_LEARNER',
    proposal_count INTEGER DEFAULT 1,
    proposed_by TEXT NOT NULL,
    accepted_by TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (mentor_id) REFERENCES users(id),
    FOREIGN KEY (learner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS skill_credit_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    balance INTEGER NOT NULL DEFAULT 3,
    escrow_balance INTEGER NOT NULL DEFAULT 0,
    lifetime_earned INTEGER NOT NULL DEFAULT 0,
    lifetime_spent INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY,
    reference_session_id TEXT,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 1,
    transaction_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    idempotency_key TEXT UNIQUE NOT NULL,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reference_session_id) REFERENCES sessions(id),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reputations (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    total_sessions_taught INTEGER NOT NULL DEFAULT 0,
    total_sessions_learned INTEGER NOT NULL DEFAULT 0,
    bayesian_rating REAL NOT NULL DEFAULT 4.5,
    reliability_score REAL NOT NULL DEFAULT 95.0,
    badge_level TEXT DEFAULT 'BRONZE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    rater_id TEXT NOT NULL,
    ratee_id TEXT NOT NULL,
    role_rated TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    tags TEXT,
    review TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (rater_id) REFERENCES users(id),
    FOREIGN KEY (ratee_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    initiator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    resolution_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (initiator_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS fraud_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    score REAL NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'UNRESOLVED',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'INFO',
    link TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS skill_requests (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    requested_proficiency TEXT NOT NULL DEFAULT 'Intermediate',
    current_proficiency TEXT NOT NULL DEFAULT 'Beginner',
    learning_goal TEXT NOT NULL,
    preferred_schedule TEXT,
    preferred_session_mode TEXT DEFAULT 'ONLINE',
    urgency TEXT DEFAULT 'MEDIUM',
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS learning_requests (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    skill_id TEXT,
    skill_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    requested_proficiency TEXT NOT NULL DEFAULT 'Beginner',
    preferred_days TEXT NOT NULL DEFAULT '[]',
    preferred_time_start TEXT,
    preferred_time_end TEXT,
    duration_hours REAL NOT NULL DEFAULT 1.0,
    learning_goal TEXT,
    search_scope TEXT NOT NULL DEFAULT 'ALL',
    status TEXT NOT NULL DEFAULT 'OPEN',
    matched_mentor_id TEXT,
    matched_at DATETIME,
    match_score REAL,
    match_reasons_json TEXT DEFAULT '[]',
    session_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (matched_mentor_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS learning_request_matches (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    mentor_id TEXT NOT NULL,
    match_score REAL NOT NULL,
    reasons_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'POTENTIAL',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES learning_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS learning_request_events (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES learning_requests(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notification_deliveries (
    id TEXT PRIMARY KEY,
    notification_id TEXT,
    user_id TEXT NOT NULL,
    request_id TEXT,
    type TEXT NOT NULL,
    channel TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SENT',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    delivered_at DATETIME,
    error_message TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS session_attendance (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    metadata_json TEXT DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SENT',
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function safeAddColumn(database, table, column, definition) {
  try {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all();
    const exists = columns.some(c => c.name.toLowerCase() === column.toLowerCase());
    if (!exists) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (err) {}
}

// Runtime migrations
safeAddColumn(db, 'users', 'user_type', "TEXT NOT NULL DEFAULT 'TEACHER_LEARNER'");
safeAddColumn(db, 'users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
safeAddColumn(db, 'users', 'verification_token', 'TEXT');
safeAddColumn(db, 'users', 'verification_token_expires', 'DATETIME');
safeAddColumn(db, 'users', 'is_academic_email', 'INTEGER NOT NULL DEFAULT 0');
safeAddColumn(db, 'user_skills', 'assessment_score', 'REAL');
safeAddColumn(db, 'user_skills', 'teaching_days', "TEXT DEFAULT '[\"Monday\",\"Wednesday\",\"Friday\"]'");
safeAddColumn(db, 'user_skills', 'available_start_time', "TEXT DEFAULT '17:00'");
safeAddColumn(db, 'user_skills', 'available_end_time', "TEXT DEFAULT '20:00'");
safeAddColumn(db, 'user_skills', 'preferred_start_time', "TEXT DEFAULT '18:00'");
safeAddColumn(db, 'user_skills', 'preferred_end_time', "TEXT DEFAULT '20:00'");

// Seed Skills
console.log('Seeding Skills Catalog...');
const skills = [
  { id: 'skill-python', name: 'Python Programming', category: 'Computer Science', icon: 'Code', description: 'Core Python, scripting, data pipelines, and backend APIs' },
  { id: 'skill-react', name: 'React & Next.js', category: 'Computer Science', icon: 'Layout', description: 'Component architecture, state management, hooks, and SSR' },
  { id: 'skill-solidity', name: 'Solidity & Smart Contracts', category: 'Computer Science', icon: 'Cpu', description: 'EVM smart contract engineering, testing, and security' },
  { id: 'skill-ml', name: 'Machine Learning & PyTorch', category: 'Computer Science', icon: 'Brain', description: 'Supervised/unsupervised ML, scikit-learn, deep learning basics' },
  { id: 'skill-dsa', name: 'Data Structures & Algorithms', category: 'Computer Science', icon: 'Binary', description: 'Trees, graphs, dynamic programming, interview problem solving' },
  { id: 'skill-figma', name: 'UI/UX Design & Figma', category: 'Design', icon: 'PenTool', description: 'Design systems, interactive prototyping, user research, wireframing' },
  { id: 'skill-spanish', name: 'Spanish Conversation', category: 'Languages', icon: 'Languages', description: 'Conversational fluency, vocabulary, pronunciation, culture' },
  { id: 'skill-calculus', name: 'Calculus & Linear Algebra', category: 'Mathematics', icon: 'Sigma', description: 'Derivatives, integrals, multivariable calculus, matrix algebra' },
  { id: 'skill-finance', name: 'Corporate Finance & Valuation', category: 'Business', icon: 'TrendingUp', description: 'Financial modeling, DCF valuation, capital budgeting' },
  { id: 'skill-node', name: 'Node.js & Express Backend', category: 'Computer Science', icon: 'Server', description: 'REST APIs, middleware, authentication, and database integration' },
];

const insertSkill = db.prepare(`
  INSERT INTO skills (id, name, category, icon, description)
  VALUES (@id, @name, @category, @icon, @description)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    category = excluded.category,
    icon = excluded.icon,
    description = excluded.description
`);

for (const s of skills) {
  insertSkill.run(s);
}

// 2. Hash Seed Password
const passwordHash = bcrypt.hashSync('Password123!', 10);

// 3. Seed Realistic Indian / Telugu Campus Personas
const students = [
  // PERSONA 1: STUDENT ONLY (Python Learner)
  {
    id: 'usr-ananya',
    email: 'ananya.reddy@campus.edu',
    role: 'STUDENT',
    userType: 'LEARNER',
    displayName: 'Ananya Reddy',
    college: 'Godavari Institute of Computer Science',
    major: 'Data Science & Statistics',
    year: 'Sophomore',
    bio: 'Sophomore data science student eager to learn Python for pandas data analysis, automation scripts, and regression models.',
    isVerified: 1,
    trustScore: 88.0,
    balance: 4,
    teaching: [],
    goals: [
      { skillId: 'skill-python', target: 'Intermediate', priority: 'HIGH', notes: 'Need Python for data science coursework and statistical modeling' },
    ],
    availability: [
      { day: 'Tuesday', start: '18:00', end: '21:00' },
      { day: 'Thursday', start: '18:00', end: '21:00' },
      { day: 'Saturday', start: '14:00', end: '18:00' },
    ],
    reputation: { taught: 0, learned: 6, rating: 4.8, reliability: 98, reviews: 5 },
  },

  // PERSONA 2: MENTOR ONLY (Verified Python Mentor)
  {
    id: 'usr-rahul',
    email: 'rahul.reddy@campus.edu',
    role: 'STUDENT',
    userType: 'TEACHER',
    displayName: 'Rahul Reddy',
    college: 'Andhra Institute of Technology',
    major: 'Computer Science & Software Systems',
    year: 'Senior',
    bio: 'Senior software engineering TA specializing in Python architecture, concurrency, FastAPIs, and clean backend practices.',
    isVerified: 1,
    trustScore: 97.0,
    balance: 8,
    teaching: [
      { 
        skillId: 'skill-python', 
        proficiency: 'Expert', 
        exp: 3.5, 
        style: 'Hands-on architectural walkthroughs, debugging, and live coding', 
        status: 'PLATFORM_VERIFIED',
        score: 95.0,
        teachingDays: '["Monday","Wednesday","Friday"]',
        availStart: '17:00',
        availEnd: '20:00',
        prefStart: '17:00',
        prefEnd: '20:00'
      },
    ],
    goals: [],
    availability: [
      { day: 'Monday', start: '17:00', end: '20:00' },
      { day: 'Wednesday', start: '17:00', end: '20:00' },
      { day: 'Friday', start: '17:00', end: '20:00' },
    ],
    reputation: { taught: 32, learned: 0, rating: 4.95, reliability: 99, reviews: 29 },
  },

  // PERSONA 3: MENTOR + STUDENT (Verified Python Mentor & Web3 Learner)
  {
    id: 'usr-saikiran',
    email: 'sai.kiran@campus.edu',
    role: 'STUDENT',
    userType: 'TEACHER_LEARNER',
    displayName: 'Sai Kiran',
    college: 'Krishna Valley Engineering College',
    major: 'Computer Science & AI',
    year: 'Senior',
    bio: 'Senior developer specializing in Python data engineering, ML pipelines, and Solidity smart contracts.',
    isVerified: 1,
    trustScore: 96.0,
    balance: 6,
    teaching: [
      { 
        skillId: 'skill-python', 
        proficiency: 'Advanced', 
        exp: 3.0, 
        style: 'Deep dive into Python data pipelines, algorithms & clean backend architecture', 
        status: 'ASSESSMENT_VERIFIED',
        score: 92.0,
        teachingDays: '["Tuesday","Thursday","Sunday"]',
        availStart: '18:00',
        availEnd: '21:00',
        prefStart: '18:00',
        prefEnd: '21:00'
      },
      { 
        skillId: 'skill-solidity', 
        proficiency: 'Expert', 
        exp: 2.5, 
        style: 'Smart contract security audits and Hardhat test suites', 
        status: 'PLATFORM_VERIFIED',
        score: 98.0,
        teachingDays: '["Tuesday","Thursday"]',
        availStart: '18:00',
        availEnd: '21:00',
        prefStart: '18:00',
        prefEnd: '21:00'
      },
    ],
    goals: [
      { skillId: 'skill-figma', target: 'Intermediate', priority: 'HIGH', notes: 'Need better UI/UX skills for my open-source web projects' },
    ],
    availability: [
      { day: 'Tuesday', start: '18:00', end: '21:00' },
      { day: 'Thursday', start: '18:00', end: '21:00' },
      { day: 'Sunday', start: '11:00', end: '15:00' },
    ],
    reputation: { taught: 27, learned: 12, rating: 4.9, reliability: 99, reviews: 24 },
  },

  // PERSONA 4: MENTOR + STUDENT (Pending Verification Python Mentor)
  {
    id: 'usr-sravani',
    email: 'sravani@campus.edu',
    role: 'STUDENT',
    userType: 'TEACHER_LEARNER',
    displayName: 'Sravani',
    college: 'Andhra Institute of Technology',
    major: 'Information Technology',
    year: 'Junior',
    bio: 'Junior IT student. Self-taught in Python scripting and automating campus tasks. Ready to swap with React mentors.',
    isVerified: 1,
    trustScore: 82.0,
    balance: 3,
    teaching: [
      { 
        skillId: 'skill-python', 
        proficiency: 'Advanced', 
        exp: 2.0, 
        style: 'Practical beginner/intermediate Python automation scripts', 
        status: 'SELF_DECLARED',
        score: null,
        teachingDays: '["Monday","Wednesday","Friday"]',
        availStart: '18:00',
        availEnd: '21:00',
        prefStart: '18:00',
        prefEnd: '21:00'
      },
    ],
    goals: [
      { skillId: 'skill-react', target: 'Intermediate', priority: 'HIGH', notes: 'Looking to learn React components and state management' },
    ],
    availability: [
      { day: 'Monday', start: '18:00', end: '21:00' },
      { day: 'Wednesday', start: '18:00', end: '21:00' },
      { day: 'Friday', start: '18:00', end: '21:00' },
    ],
    reputation: { taught: 4, learned: 3, rating: 4.6, reliability: 92, reviews: 4 },
  },

  // PERSONA 5: Fullstack Web3 Developer (Keerthana Rao)
  {
    id: 'usr-keerthana',
    email: 'keerthana.rao@campus.edu',
    role: 'STUDENT',
    userType: 'TEACHER_LEARNER',
    displayName: 'Keerthana Rao',
    college: 'Krishna Valley Engineering College',
    major: 'Computer Science',
    year: 'Junior',
    bio: 'Junior CS student passionate about fullstack web apps and decentralized systems. Looking to master Solidity!',
    isVerified: 1,
    trustScore: 92.0,
    balance: 4,
    teaching: [
      { skillId: 'skill-react', proficiency: 'Advanced', exp: 2.5, style: 'Hands-on project reviews & coding sessions', status: 'PLATFORM_VERIFIED' },
      { skillId: 'skill-node', proficiency: 'Intermediate', exp: 1.5, style: 'API building workshops', status: 'PEER_VERIFIED' },
    ],
    goals: [
      { skillId: 'skill-solidity', target: 'Intermediate', priority: 'HIGH', notes: 'Want to build DeFi and credential contracts for senior project' },
    ],
    availability: [
      { day: 'Tuesday', start: '18:00', end: '20:00' },
      { day: 'Thursday', start: '18:00', end: '20:00' },
      { day: 'Saturday', start: '14:00', end: '17:00' },
    ],
    reputation: { taught: 8, learned: 5, rating: 4.8, reliability: 98, reviews: 7 },
  },

  // PERSONA 6: Design & UI/UX Specialist (Bhavya Reddy)
  {
    id: 'usr-bhavya',
    email: 'bhavya.reddy@campus.edu',
    role: 'STUDENT',
    userType: 'TEACHER_LEARNER',
    displayName: 'Bhavya Reddy',
    college: 'Coastal Andhra University',
    major: 'Digital Media & UI/UX',
    year: 'Senior',
    bio: 'Product designer focusing on accessible design systems and sleek web interfaces. Looking to learn Python for data visualization!',
    isVerified: 1,
    trustScore: 94.0,
    balance: 5,
    teaching: [
      { skillId: 'skill-figma', proficiency: 'Expert', exp: 4.0, style: 'Figma component mastery, auto-layout, and interactive prototypes', status: 'PLATFORM_VERIFIED' },
    ],
    goals: [
      { skillId: 'skill-python', target: 'Intermediate', priority: 'HIGH', notes: 'Need Python data scripts for UX analytics' },
    ],
    availability: [
      { day: 'Tuesday', start: '18:00', end: '20:00' },
      { day: 'Wednesday', start: '17:00', end: '19:00' },
      { day: 'Saturday', start: '13:00', end: '16:00' },
    ],
    reputation: { taught: 19, learned: 8, rating: 4.9, reliability: 97, reviews: 18 },
  },

  // PERSONA 7: Mathematics & DSA Specialist (Vamsi Krishna)
  {
    id: 'usr-vamsi',
    email: 'vamsi.krishna@campus.edu',
    role: 'STUDENT',
    userType: 'TEACHER_LEARNER',
    displayName: 'Vamsi Krishna',
    college: 'Vijaya Engineering College',
    major: 'Applied Mathematics',
    year: 'Junior',
    bio: 'Math and algorithms mentor. I simplify complex calculus proofs, matrix algebra, and algorithmic foundations.',
    isVerified: 1,
    trustScore: 90.0,
    balance: 3,
    teaching: [
      { skillId: 'skill-calculus', proficiency: 'Expert', exp: 3.0, style: 'Step-by-step problem walkthroughs and intuitive proofs', status: 'PLATFORM_VERIFIED' },
      { skillId: 'skill-dsa', proficiency: 'Advanced', exp: 2.0, style: 'Algorithmic complexity & dynamic programming', status: 'ASSESSMENT_VERIFIED' },
    ],
    goals: [
      { skillId: 'skill-react', target: 'Intermediate', priority: 'MEDIUM', notes: 'Want to build interactive math visualizers on the web' },
    ],
    availability: [
      { day: 'Monday', start: '16:00', end: '19:00' },
      { day: 'Wednesday', start: '16:00', end: '19:00' },
      { day: 'Friday', start: '15:00', end: '18:00' },
    ],
    reputation: { taught: 14, learned: 6, rating: 4.7, reliability: 95, reviews: 12 },
  },

  // PERSONA 8: Finance & Quantitative Learner (Pavan Kumar)
  {
    id: 'usr-pavan',
    email: 'pavan.kumar@campus.edu',
    role: 'STUDENT',
    userType: 'LEARNER',
    displayName: 'Pavan Kumar',
    college: 'Sri Vasavi Institute of Technology',
    major: 'Finance & Analytics',
    year: 'Senior',
    bio: 'Finance major preparing for quantitative roles. Looking for mentors in Python algorithmic trading scripts.',
    isVerified: 1,
    trustScore: 89.0,
    balance: 4,
    teaching: [
      { skillId: 'skill-finance', proficiency: 'Advanced', exp: 2.5, style: 'Real-world Excel financial modeling', status: 'PLATFORM_VERIFIED' },
    ],
    goals: [
      { skillId: 'skill-python', target: 'Intermediate', priority: 'HIGH', notes: 'Algorithmic trading scripts and financial data' },
    ],
    availability: [
      { day: 'Friday', start: '17:00', end: '20:00' },
      { day: 'Sunday', start: '14:00', end: '18:00' },
    ],
    reputation: { taught: 11, learned: 7, rating: 4.8, reliability: 94, reviews: 10 },
  },

  // PERSONA 9: Campus Moderator (Sirisha)
  {
    id: 'usr-mod-sirisha',
    email: 'moderator.sirisha@campus.edu',
    role: 'MODERATOR',
    userType: 'TEACHER_LEARNER',
    displayName: 'Sirisha (Campus Moderator)',
    college: 'Andhra Institute of Technology',
    major: 'Student Affairs & Honor Council',
    year: 'Graduate',
    bio: 'Official Campus Peer Learning Moderator. Reviewing dispute evidence, fraud signals, and credential standards.',
    isVerified: 1,
    trustScore: 99.0,
    balance: 10,
    teaching: [],
    goals: [],
    availability: [],
    reputation: { taught: 0, learned: 0, rating: 5.0, reliability: 100, reviews: 0 },
  },

  // PERSONA 10: Campus Admin (Srinivas Rao)
  {
    id: 'usr-admin',
    email: 'admin@skillswap.campus.edu',
    role: 'ADMIN',
    userType: 'TEACHER_LEARNER',
    displayName: 'Srinivas Rao (Campus Admin)',
    college: 'IT & Infrastructure Services',
    major: 'System Administration',
    year: 'Staff',
    bio: 'Principal administrator overseeing platform security, smart contracts, emergency pause, and audit logs.',
    isVerified: 1,
    trustScore: 100.0,
    balance: 100,
    teaching: [],
    goals: [],
    availability: [],
    reputation: { taught: 0, learned: 0, rating: 5.0, reliability: 100, reviews: 0 },
  },
];

for (const stu of students) {
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, status, campus_id, user_type, email_verified, is_academic_email)
    VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, 1, 1)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      password_hash = excluded.password_hash,
      role = excluded.role,
      user_type = excluded.user_type,
      email_verified = 1,
      is_academic_email = 1
  `).run(stu.id, stu.email, passwordHash, stu.role, `STU-${stu.id.replace('usr-', '').toUpperCase()}`, stu.userType || 'TEACHER_LEARNER');

  db.prepare(`
    INSERT INTO profiles (
      id, user_id, display_name, bio, college, major, year, is_verified_student, trust_score, teaching_preference
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Anyone')
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      bio = excluded.bio,
      college = excluded.college,
      major = excluded.major,
      year = excluded.year,
      is_verified_student = excluded.is_verified_student,
      trust_score = excluded.trust_score
  `).run(
    `prof-${stu.id}`,
    stu.id,
    stu.displayName,
    stu.bio,
    stu.college,
    stu.major,
    stu.year,
    stu.isVerified,
    stu.trustScore
  );

  db.prepare(`
    INSERT INTO skill_credit_accounts (id, user_id, balance, escrow_balance, lifetime_earned, lifetime_spent)
    VALUES (?, ?, ?, 0, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      balance = excluded.balance,
      lifetime_earned = excluded.lifetime_earned,
      lifetime_spent = excluded.lifetime_spent
  `).run(`acc-${stu.id}`, stu.id, stu.balance, stu.reputation.taught, stu.reputation.learned);

  db.prepare(`
    INSERT INTO reputations (
      id, user_id, total_reviews, total_sessions_taught, total_sessions_learned, bayesian_rating, reliability_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      total_reviews = excluded.total_reviews,
      total_sessions_taught = excluded.total_sessions_taught,
      total_sessions_learned = excluded.total_sessions_learned,
      bayesian_rating = excluded.bayesian_rating,
      reliability_score = excluded.reliability_score
  `).run(
    `rep-${stu.id}`,
    stu.id,
    stu.reputation.reviews,
    stu.reputation.taught,
    stu.reputation.learned,
    stu.reputation.rating,
    stu.reputation.reliability
  );

  // Teaching Skills
  for (const t of stu.teaching) {
    db.prepare(`
      INSERT INTO user_skills (
        id, user_id, skill_id, proficiency, experience_years, teaching_style, verification_status,
        assessment_score, teaching_days, available_start_time, available_end_time, preferred_start_time, preferred_end_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, skill_id) DO UPDATE SET
        proficiency = excluded.proficiency,
        experience_years = excluded.experience_years,
        teaching_style = excluded.teaching_style,
        verification_status = excluded.verification_status,
        assessment_score = excluded.assessment_score,
        teaching_days = excluded.teaching_days,
        available_start_time = excluded.available_start_time,
        available_end_time = excluded.available_end_time,
        preferred_start_time = excluded.preferred_start_time,
        preferred_end_time = excluded.preferred_end_time
    `).run(
      `usk-${stu.id}-${t.skillId}`,
      stu.id,
      t.skillId,
      t.proficiency,
      t.exp,
      t.style,
      t.status,
      t.score || null,
      t.teachingDays || '["Monday","Wednesday","Friday"]',
      t.availStart || '17:00',
      t.availEnd || '20:00',
      t.prefStart || '17:00',
      t.prefEnd || '20:00'
    );
  }

  // Learning Goals
  for (const g of stu.goals) {
    db.prepare(`
      INSERT INTO learning_goals (id, user_id, skill_id, target_proficiency, priority, notes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, skill_id) DO UPDATE SET
        target_proficiency = excluded.target_proficiency,
        priority = excluded.priority,
        notes = excluded.notes
    `).run(
      `goal-${stu.id}-${g.skillId}`,
      stu.id,
      g.skillId,
      g.target,
      g.priority,
      g.notes
    );
  }

  // Availability Slots
  for (const a of stu.availability) {
    db.prepare(`
      INSERT INTO availability_slots (id, user_id, day_of_week, start_time, end_time)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        day_of_week = excluded.day_of_week,
        start_time = excluded.start_time,
        end_time = excluded.end_time
    `).run(
      `avail-${stu.id}-${a.day}`,
      stu.id,
      a.day,
      a.start,
      a.end
    );
  }
}

// 4. Seed Open Python Learner Requests
db.prepare(`
  INSERT INTO skill_requests (
    id, learner_id, skill_id, requested_proficiency, current_proficiency,
    learning_goal, preferred_schedule, preferred_session_mode, urgency, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    status = excluded.status,
    learning_goal = excluded.learning_goal
`).run(
  'req-ananya-python',
  'usr-ananya',
  'skill-python',
  'Intermediate',
  'Beginner',
  'Need 1-on-1 Python guidance for statistical modeling and pandas DataFrame manipulations.',
  'Tuesday or Thursday evenings (6 PM - 9 PM)',
  'ONLINE',
  'HIGH',
  'OPEN'
);

db.prepare(`
  INSERT INTO skill_requests (
    id, learner_id, skill_id, requested_proficiency, current_proficiency,
    learning_goal, preferred_schedule, preferred_session_mode, urgency, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    status = excluded.status,
    learning_goal = excluded.learning_goal
  `).run(
  'req-pavan-python',
  'usr-pavan',
  'skill-python',
  'Intermediate',
  'Beginner',
  'Looking for Python tutor for automated financial modeling & quantitative trading backtests.',
  'Friday evenings (5 PM - 8 PM)',
  'ONLINE',
  'MEDIUM',
  'OPEN'
);

// 5. Seed Next Monday Blocked Session for Rahul Reddy (blocks 17:00-18:00 window)
const nextMonday = new Date();
const currentDay = nextMonday.getDay();
const diff = nextMonday.getDate() + (currentDay === 0 ? 1 : (8 - currentDay));
nextMonday.setDate(diff);
const sessionDateStr = nextMonday.toISOString().substring(0, 10);

db.prepare(`
  INSERT INTO sessions (
    id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end,
    duration_hours, credits_amount, mode, location_or_url, idempotency_key, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    status = excluded.status
`).run(
  'sess-rahul-blocked-1',
  'Python Async Architectures & FastAPIs',
  'skill-python',
  'usr-rahul',
  'usr-ananya',
  'SCHEDULED',
  `${sessionDateStr}T17:00:00Z`,
  `${sessionDateStr}T18:00:00Z`,
  1.0,
  1,
  'ONLINE',
  'https://meet.skillswap.internal/room-rahul-ananya',
  `idemp-rahul-session-${sessionDateStr}`,
  'Core Python backend architectures. Blocks 17:00-18:00 window.'
);

// 6. Seed Notifications
db.prepare(`
  INSERT INTO notifications (id, user_id, title, message, type, link)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET message = excluded.message
`).run(
  'notif-rahul-1',
  'usr-rahul',
  'Python Assessment Platform Verified',
  'Your Python skill assessment scored 95.0% and has been verified on-chain.',
  'CREDENTIAL_ISSUED',
  '/profile'
);

db.prepare(`
  INSERT INTO notifications (id, user_id, title, message, type, link)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET message = excluded.message
`).run(
  'notif-ananya-1',
  'usr-ananya',
  'Python Learner Request Active',
  'Your request for Python Programming is broadcast to campus mentors.',
  'INFO',
  '/explore'
);

// 7. Seed Diverse Historical & Today's Demo Sessions with Full Audit Trails
const historicalSessions = [
  {
    id: 'sess-hist-101',
    title: 'Python Pandas & Data Wrangling',
    skill_id: 'skill-python',
    teacher_id: 'usr-rahul',
    learner_id: 'usr-ananya',
    status: 'CREDIT_SETTLED',
    scheduled_start: '2026-08-23 10:00:00',
    scheduled_end: '2026-08-23 11:00:00',
    duration_hours: 1.0,
    credits_amount: 1,
    exchange_return: 'CREDITS',
    return_skill: 'Solidity & Smart Contracts',
    credit_tx: { from: 'usr-ananya', to: 'usr-rahul', amount: 1, type: 'ESCROW_RELEASE', reason: 'Completed Python teaching session' }
  },
  {
    id: 'sess-hist-102',
    title: 'React Components & Hooks Architecture',
    skill_id: 'skill-react',
    teacher_id: 'usr-sravani',
    learner_id: 'usr-rahul',
    status: 'CREDIT_SETTLED',
    scheduled_start: '2026-08-23 14:00:00',
    scheduled_end: '2026-08-23 15:00:00',
    duration_hours: 1.0,
    credits_amount: 1,
    exchange_return: 'SKILL',
    return_skill: 'Python Programming',
    reciprocal_note: 'Rahul teaches Python to Sravani in reciprocal exchange'
  },
  {
    id: 'sess-hist-103',
    title: 'Solidity Smart Contract Security & Reentrancy',
    skill_id: 'skill-solidity',
    teacher_id: 'usr-saikiran',
    learner_id: 'usr-bhavya',
    status: 'CREDIT_SETTLED',
    scheduled_start: '2026-08-23 16:00:00',
    scheduled_end: '2026-08-23 17:00:00',
    duration_hours: 1.0,
    credits_amount: 1,
    exchange_return: 'SKILL',
    return_skill: 'UI/UX Design & Figma'
  },
  {
    id: 'sess-hist-104',
    title: 'Calculus Proofs & Matrix Algebra',
    skill_id: 'skill-calculus',
    teacher_id: 'usr-vamsi',
    learner_id: 'usr-pavan',
    status: 'CANCELLED',
    scheduled_start: '2026-08-23 18:00:00',
    scheduled_end: '2026-08-23 19:00:00',
    duration_hours: 1.0,
    credits_amount: 1,
    cancellation_reason: 'Student rescheduled before start window',
    credit_tx: { from: 'usr-pavan', to: 'usr-pavan', amount: 1, type: 'ESCROW_REFUND', reason: 'Refund on session cancellation' }
  },
  {
    id: 'sess-hist-105',
    title: 'Financial Modeling & DCF Valuation',
    skill_id: 'skill-finance',
    teacher_id: 'usr-pavan',
    learner_id: 'usr-saikiran',
    status: 'DISPUTED',
    scheduled_start: '2026-08-23 19:00:00',
    scheduled_end: '2026-08-23 20:00:00',
    duration_hours: 1.0,
    credits_amount: 1,
    dispute: { reason: 'NO_SHOW', initiator: 'usr-saikiran', details: 'Instructor did not join meeting room.' }
  },
  {
    id: 'sess-hist-001',
    title: 'First Python Introduction & Environment Setup',
    skill_id: 'skill-python',
    teacher_id: 'usr-rahul',
    learner_id: 'usr-saikiran',
    status: 'CREDIT_SETTLED',
    scheduled_start: '2026-08-15 17:00:00',
    scheduled_end: '2026-08-15 18:00:00',
    duration_hours: 1.0,
    credits_amount: 1,
    exchange_return: 'CREDITS',
    return_skill: 'Solidity & Smart Contracts',
    credit_tx: { from: 'usr-saikiran', to: 'usr-rahul', amount: 1, type: 'ESCROW_RELEASE', reason: 'Completed first Python session' }
  }
];

const insertSess = db.prepare(`
  INSERT INTO sessions (
    id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end,
    duration_hours, credits_amount, mode, location_or_url, idempotency_key, notes, cancellation_reason, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET status = excluded.status
`);

const insertAgreement = db.prepare(`
  INSERT INTO session_exchange_agreements (
    id, session_id, mentor_id, learner_id, taught_skill_id, requested_return_skill_name, return_type, credit_amount, status, proposal_count, proposed_by, accepted_by, created_at, accepted_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACCEPTED', 1, ?, ?, ?, ?)
  ON CONFLICT(session_id) DO NOTHING
`);

const insertCreditTx = db.prepare(`
  INSERT INTO credit_transactions (
    id, reference_session_id, sender_id, receiver_id, amount, transaction_type, status, idempotency_key, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, 'SETTLED', ?, ?)
  ON CONFLICT(id) DO NOTHING
`);

const insertDispute = db.prepare(`
  INSERT INTO disputes (
    id, session_id, initiator_id, reason, status, resolution_notes, created_at
  ) VALUES (?, ?, ?, ?, 'UNDER_REVIEW', 'Under moderator investigation', ?)
  ON CONFLICT(session_id) DO NOTHING
`);

for (const hs of historicalSessions) {
  insertSess.run(
    hs.id,
    hs.title,
    hs.skill_id,
    hs.teacher_id,
    hs.learner_id,
    hs.status,
    hs.scheduled_start,
    hs.scheduled_end,
    hs.duration_hours,
    hs.credits_amount,
    'ONLINE',
    'https://meet.skillswap.internal/room-' + hs.id,
    'idemp-' + hs.id,
    hs.title,
    hs.cancellation_reason || null,
    hs.scheduled_start
  );

  if (hs.exchange_return) {
    insertAgreement.run(
      'sea-' + hs.id,
      hs.id,
      hs.teacher_id,
      hs.learner_id,
      hs.skill_id,
      hs.return_skill || 'Solidity',
      hs.exchange_return,
      hs.credits_amount,
      hs.teacher_id,
      hs.learner_id,
      hs.scheduled_start,
      hs.scheduled_start
    );
  }

  if (hs.credit_tx) {
    insertCreditTx.run(
      'ctx-' + hs.id,
      hs.id,
      hs.credit_tx.from,
      hs.credit_tx.to,
      hs.credit_tx.amount,
      hs.credit_tx.type,
      'idemp-ctx-' + hs.id,
      hs.scheduled_start
    );
  }

  if (hs.dispute) {
    insertDispute.run(
      'disp-' + hs.id,
      hs.id,
      hs.dispute.initiator,
      hs.dispute.reason,
      hs.scheduled_start
    );
  }
}

// 8. Auto-populate session_participants for all sessions
const allSessions = db.prepare(`SELECT id, teacher_id, learner_id, created_at FROM sessions`).all();
const insertParticipant = db.prepare(`
  INSERT INTO session_participants (id, session_id, user_id, session_role, confirmed, created_at)
  VALUES (?, ?, ?, ?, 1, ?)
  ON CONFLICT(session_id, user_id) DO NOTHING
`);

for (const s of allSessions) {
  if (s.teacher_id) {
    insertParticipant.run(`sp-${s.id}-trainer`, s.id, s.teacher_id, 'TRAINER', s.created_at);
  }
  if (s.learner_id) {
    insertParticipant.run(`sp-${s.id}-learner`, s.id, s.learner_id, 'LEARNER', s.created_at);
  }
}

// 9. Seed Sample Learning Requests & Notification Deliveries
const insertLearningReq = db.prepare(`
  INSERT INTO learning_requests (
    id, learner_id, skill_id, skill_name, category, requested_proficiency,
    preferred_days, preferred_time_start, preferred_time_end, duration_hours,
    learning_goal, search_scope, status, matched_mentor_id, matched_at, match_score, match_reasons_json, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    status = excluded.status,
    matched_mentor_id = excluded.matched_mentor_id,
    match_score = excluded.match_score
`);

const insertReqEvent = db.prepare(`
  INSERT INTO learning_request_events (id, request_id, event_type, title, description, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`);

const insertNotifDelivery = db.prepare(`
  INSERT INTO notification_deliveries (
    id, notification_id, user_id, request_id, type, channel, recipient, subject, content, status, created_at, sent_at, delivered_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`);

// Sample 1: Ananya Reddy's Open Python request (Waiting for Mentor)
insertLearningReq.run(
  'lreq-ananya-python',
  'usr-ananya',
  'skill-python',
  'Python',
  'Computer Science',
  'Beginner',
  '["Tuesday","Thursday"]',
  '17:00',
  '20:00',
  1.0,
  'Master Python data structures and algorithm foundations',
  'ALL',
  'OPEN',
  null,
  null,
  null,
  '[]',
  '2026-08-20 10:00:00',
  '2026-08-20 10:00:00'
);

insertReqEvent.run('ev-ananya-1', 'lreq-ananya-python', 'REQUEST_CREATED', 'Learning Request Created', 'Requested Beginner mentorship for Python on Tue/Thu (17:00 - 20:00)', '2026-08-20 10:00:00');
insertReqEvent.run('ev-ananya-2', 'lreq-ananya-python', 'COLLEGE_SEARCH_EMPTY', 'College Search Completed', 'Searched inside Godavari Institute of Computer Science. No available mentor found.', '2026-08-20 10:00:05');

// Sample 2: Pavan Kumar's Matched Solidity request
insertLearningReq.run(
  'lreq-pavan-solidity',
  'usr-pavan',
  'skill-solidity',
  'Solidity',
  'Computer Science',
  'Advanced',
  '["Monday","Wednesday","Friday"]',
  '18:00',
  '21:00',
  1.0,
  'Smart contract security auditing and reentrancy attack analysis',
  'ALL',
  'MENTOR_FOUND',
  'usr-rahul',
  '2026-08-22 14:00:00',
  94,
  JSON.stringify([
    '✓ Solidity skill verified via PLATFORM VERIFIED',
    '✓ Available on your preferred days (Monday, Wednesday, Friday)',
    '✓ Overlapping teaching window (17:00 – 20:00)',
    '✓ Attends Andhra Institute of Technology'
  ]),
  '2026-08-21 09:00:00',
  '2026-08-22 14:00:00'
);

insertReqEvent.run('ev-pavan-1', 'lreq-pavan-solidity', 'REQUEST_CREATED', 'Learning Request Created', 'Requested Advanced mentorship for Solidity', '2026-08-21 09:00:00');
insertReqEvent.run('ev-pavan-2', 'lreq-pavan-solidity', 'MENTOR_REGISTERED_VERIFIED', 'Verified Mentor Joined', 'Rahul Reddy verified for Solidity at Andhra Institute of Technology', '2026-08-22 14:00:00');
insertReqEvent.run('ev-pavan-3', 'lreq-pavan-solidity', 'MENTOR_MATCHED', 'Mentor Matched Your Request', 'Matched with Rahul Reddy (94% compatibility score)', '2026-08-22 14:00:01');
insertReqEvent.run('ev-pavan-4', 'lreq-pavan-solidity', 'NOTIFICATION_SENT', 'Notification Dispatched', 'Sent in-app and email alert to learner', '2026-08-22 14:00:05');

insertNotifDelivery.run(
  'del-pavan-email-1',
  'notif-pavan-1',
  'usr-pavan',
  'lreq-pavan-solidity',
  'MENTOR_FOUND',
  'EMAIL',
  'pavan.kumar@campus.edu',
  'A Solidity mentor is now available on SkillSwap Campus',
  'Good news! Rahul Reddy is now available to teach Solidity.',
  'DELIVERED',
  '2026-08-22 14:00:05',
  '2026-08-22 14:00:05',
  '2026-08-22 14:00:06'
);

insertNotifDelivery.run(
  'del-pavan-inapp-1',
  'notif-pavan-1',
  'usr-pavan',
  'lreq-pavan-solidity',
  'MENTOR_FOUND',
  'IN_APP',
  'usr-pavan',
  '🎉 Mentor Found for Solidity!',
  'Rahul Reddy is now available to teach Solidity (Advanced).',
  'DELIVERED',
  '2026-08-22 14:00:05',
  '2026-08-22 14:00:05',
  '2026-08-22 14:00:05'
);

// 10. Seed Sample Classroom Attendance & Chat Messages
const insertAttendance = db.prepare(`
  INSERT INTO session_attendance (id, session_id, user_id, event_type, joined_at, metadata_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`);

const insertChatMessage = db.prepare(`
  INSERT INTO chat_messages (id, session_id, sender_id, message, status, is_system, created_at)
  VALUES (?, ?, ?, ?, 'SENT', ?, ?)
  ON CONFLICT(id) DO NOTHING
`);

insertAttendance.run('att-demo-1', 'sess-hist-001', 'usr-rahul', 'JOINED', '2026-08-15 17:00:00', '{"role":"TRAINER"}', '2026-08-15 17:00:00');
insertAttendance.run('att-demo-2', 'sess-hist-001', 'usr-saikiran', 'JOINED', '2026-08-15 17:01:00', '{"role":"LEARNER"}', '2026-08-15 17:01:00');
insertAttendance.run('att-demo-3', 'sess-hist-001', 'usr-rahul', 'LEFT', '2026-08-15 18:00:00', '{"durationMinutes":60}', '2026-08-15 18:00:00');
insertAttendance.run('att-demo-4', 'sess-hist-001', 'usr-saikiran', 'LEFT', '2026-08-15 18:00:05', '{"durationMinutes":59}', '2026-08-15 18:00:05');

insertChatMessage.run('msg-demo-1', 'sess-hist-001', 'usr-rahul', 'Welcome Sai Kiran! Ready to dive into Python data pipelines?', 0, '2026-08-15 17:02:00');
insertChatMessage.run('msg-demo-2', 'sess-hist-001', 'usr-saikiran', 'Yes, excited to review the generator expressions and memory usage.', 0, '2026-08-15 17:03:00');

console.log('Database seeded successfully with authentic Indian / Telugu campus demo personas, historical session audit trails, Smart Slot availability, & Learner Requests.');
db.close();
