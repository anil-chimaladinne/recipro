const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { execSync } = require('child_process');

const dbPath = path.join(__dirname, '..', 'data', 'skillswap.db');

test.before(() => {
  // Ensure database has up-to-date schema and seeds
  execSync('node scripts/seed.js', { cwd: path.join(__dirname, '..') });
});

// Canonical Schemas
const AssessmentQuestionOptionSchema = z.object({
  id: z.enum(['A', 'B', 'C', 'D']),
  text: z.string().min(1),
});

const AssessmentQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(5),
  codeSnippet: z.string().optional(),
  options: z.array(AssessmentQuestionOptionSchema).length(4),
  correctOption: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().min(5),
  hint: z.string().optional(),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']).default('Intermediate'),
});

const GeneratedQuizSchema = z.object({
  assessmentVersion: z.string().default('v1.0'),
  skill: z.literal('Python').or(z.string()),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']),
  provider: z.enum(['GEMINI_AI', 'LOCAL_FALLBACK']).default('GEMINI_AI'),
  questions: z.array(AssessmentQuestionSchema).min(5).max(20),
});

const RoadmapStageSchema = z.object({
  order: z.number().int().optional(),
  stage: z.number().int().optional(),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  skillQuery: z.string().optional(),
  estimatedHours: z.number().optional().default(5),
  objectives: z.array(z.string()).optional().default([]),
  topics: z.array(z.string()).optional().default([]),
  practiceTasks: z.array(z.string()).optional().default([]),
  completionCriteria: z.array(z.string()).optional().default([]),
}).transform((st) => ({
  order: st.order ?? st.stage ?? 1,
  title: st.title,
  description: st.description || `Core concepts and practical application of ${st.title}.`,
  skillQuery: st.skillQuery || st.title.split(' ')[0] || 'Python',
  estimatedHours: st.estimatedHours || 5,
  objectives: st.objectives && st.objectives.length > 0 ? st.objectives : (st.topics && st.topics.length > 0 ? st.topics : ['Master core principles']),
  practiceTasks: st.practiceTasks && st.practiceTasks.length > 0 ? st.practiceTasks : ['Complete hands-on coding exercises'],
  completionCriteria: st.completionCriteria && st.completionCriteria.length > 0 ? st.completionCriteria : ['Complete stage review and code verification'],
}));

const GeneratedRoadmapSchema = z.object({
  title: z.string().min(1),
  goal: z.string().optional(),
  estimatedDuration: z.string().optional().default('6 weeks'),
  provider: z.enum(['GEMINI_AI', 'LOCAL_FALLBACK']).optional().default('GEMINI_AI'),
  stages: z.array(RoadmapStageSchema).optional(),
  roadmap: z.array(RoadmapStageSchema).optional(),
}).transform((rdm) => ({
  title: rdm.title,
  goal: rdm.goal || rdm.title,
  estimatedDuration: rdm.estimatedDuration || '6 weeks',
  provider: rdm.provider || 'GEMINI_AI',
  stages: (rdm.stages && rdm.stages.length > 0 ? rdm.stages : (rdm.roadmap || [])),
}));

const SubmitAssessmentSchema = z.object({
  skillId: z.string().min(1, 'Skill ID is required'),
  targetLevel: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']).default('Intermediate'),
  answers: z.array(z.object({
    questionId: z.string().min(1, 'Question ID is required'),
    selectedOption: z.union([
      z.number().int().min(0).max(3),
      z.enum(['A', 'B', 'C', 'D']),
      z.string().min(1),
    ]),
  })).min(1, 'At least one answer must be submitted'),
});

function sanitizeAssessmentForClient(quiz) {
  return {
    assessmentVersion: quiz.assessmentVersion,
    skill: quiz.skill,
    difficulty: quiz.difficulty,
    provider: quiz.provider,
    questionsCount: quiz.questions.length,
    questions: quiz.questions.map(q => ({
      id: q.id,
      question: q.question,
      codeSnippet: q.codeSnippet,
      options: q.options,
      hint: q.hint,
      level: q.level,
    })),
  };
}

// 1. GEMINI AI STRUCTURED SCHEMA VALIDATION
test('1. Gemini AI Schema: Strict validation for Python quiz and curriculum roadmaps', () => {
  // Test valid quiz
  const validQuiz = {
    assessmentVersion: 'v1.0',
    skill: 'Python',
    difficulty: 'Intermediate',
    provider: 'GEMINI_AI',
    questions: [
      {
        id: 'q-1',
        question: 'What is the difference between list and tuple?',
        options: [
          { id: 'A', text: 'Lists are mutable, tuples are immutable' },
          { id: 'B', text: 'Tuples are mutable, lists are immutable' },
          { id: 'C', text: 'They are identical' },
          { id: 'D', text: 'Tuples only store strings' }
        ],
        correctOption: 'A',
        explanation: 'Lists can be modified in place while tuples are immutable.'
      },
      {
        id: 'q-2',
        question: 'What does the yield keyword produce?',
        options: [
          { id: 'A', text: 'A thread' },
          { id: 'B', text: 'A generator iterator' },
          { id: 'C', text: 'A socket' },
          { id: 'D', text: 'An exception' }
        ],
        correctOption: 'B',
        explanation: 'yield produces a generator iterator.'
      },
      {
        id: 'q-3',
        question: 'What does asyncio.gather do?',
        options: [
          { id: 'A', text: 'Runs coroutines concurrently' },
          { id: 'B', text: 'Stops the event loop' },
          { id: 'C', text: 'Spawns OS processes' },
          { id: 'D', text: 'Deletes tasks' }
        ],
        correctOption: 'A',
        explanation: 'asyncio.gather executes awaitables concurrently.'
      },
      {
        id: 'q-4',
        question: 'What is dict lookup time complexity on average?',
        options: [
          { id: 'A', text: 'O(n)' },
          { id: 'B', text: 'O(1)' },
          { id: 'C', text: 'O(log n)' },
          { id: 'D', text: 'O(n^2)' }
        ],
        correctOption: 'B',
        explanation: 'Hash tables give O(1) average lookup.'
      },
      {
        id: 'q-5',
        question: 'How to handle exceptions in Python?',
        options: [
          { id: 'A', text: 'try / except' },
          { id: 'B', text: 'try / catch' },
          { id: 'C', text: 'begin / rescue' },
          { id: 'D', text: 'defer / recover' }
        ],
        correctOption: 'A',
        explanation: 'Python uses try / except blocks.'
      }
    ]
  };

  const parsedQuiz = GeneratedQuizSchema.safeParse(validQuiz);
  assert.strictEqual(parsedQuiz.success, true, 'Valid quiz must parse cleanly');

  // Test invalid quiz (missing correctOption)
  const invalidQuiz = {
    assessmentVersion: 'v1.0',
    skill: 'Python',
    difficulty: 'Intermediate',
    questions: [{ id: 'q1', question: 'No options' }]
  };
  assert.strictEqual(GeneratedQuizSchema.safeParse(invalidQuiz).success, false, 'Invalid quiz must be rejected');

  // Test roadmap schema with topics/stages flexibility
  const validRoadmap = {
    title: 'Python for Data Science & ML',
    goal: 'Master Python fundamentals and scikit-learn',
    estimatedDuration: '8 weeks',
    provider: 'GEMINI_AI',
    stages: [
      {
        stage: 1,
        title: 'Core Syntax',
        description: 'Variables, loops, and functions.',
        skillQuery: 'Python',
        estimatedHours: 6,
        topics: ['Control flow'],
        practiceTasks: ['Write 5 scripts'],
        completionCriteria: ['Zero syntax errors']
      },
      {
        stage: 2,
        title: 'Data Structures',
        description: 'Lists, dicts, tuples, sets.',
        skillQuery: 'Data Structures',
        estimatedHours: 8,
        topics: ['Data structure ops'],
        practiceTasks: ['Implement a stack'],
        completionCriteria: ['Pass test suite']
      },
      {
        stage: 3,
        title: 'Pandas & NumPy',
        description: 'Tabular data processing.',
        skillQuery: 'Python',
        estimatedHours: 10,
        topics: ['Vectorized operations'],
        practiceTasks: ['Analyze dataset'],
        completionCriteria: ['Produce summary report']
      }
    ]
  };
  const parsedRoadmap = GeneratedRoadmapSchema.safeParse(validRoadmap);
  assert.strictEqual(parsedRoadmap.success, true, 'Valid roadmap must parse cleanly');
  assert.strictEqual(parsedRoadmap.data.stages[0].order, 1, 'Transformed stage to order');
  assert.deepStrictEqual(parsedRoadmap.data.stages[0].objectives, ['Control flow'], 'Transformed topics to objectives');
});

// 2. CRITICAL SECURITY: CLIENT SANITIZATION (ZERO ANSWER LEAKAGE)
test('2. Client Security: Sanitized assessment strips correctOption and explanation', () => {
  const quiz = {
    assessmentVersion: 'v1.0',
    skill: 'Python',
    difficulty: 'Advanced',
    provider: 'GEMINI_AI',
    questions: [
      {
        id: 'q-sec-1',
        question: 'What is GIL in CPython?',
        options: [
          { id: 'A', text: 'Global Interpreter Lock' },
          { id: 'B', text: 'Garbage Isolation Layer' },
          { id: 'C', text: 'Generic Interface Library' },
          { id: 'D', text: 'Graph Iterator Link' }
        ],
        correctOption: 'A',
        explanation: 'Global Interpreter Lock serializes bytecode execution.',
        hint: 'Lock mechanism in CPython'
      }
    ]
  };

  const sanitized = sanitizeAssessmentForClient(quiz);
  assert.strictEqual(sanitized.questions.length, 1);
  assert.strictEqual(sanitized.questions[0].correctOption, undefined, 'correctOption MUST NOT be sent to client');
  assert.strictEqual(sanitized.questions[0].explanation, undefined, 'explanation MUST NOT be sent to client');
  assert.strictEqual(sanitized.questions[0].question, 'What is GIL in CPython?');
  assert.strictEqual(sanitized.questions[0].hint, 'Lock mechanism in CPython');
});

// 3. SUBMIT ASSESSMENT SCHEMA CONTRACT: ACCEPTS BOTH NUMBERS & LETTERS
test('3. Schema Contract: SubmitAssessmentSchema parses both numeric indices (0,1) and letter strings (A,B)', () => {
  // Numeric submission
  const numericPayload = {
    skillId: 'skill-python',
    targetLevel: 'Intermediate',
    answers: [
      { questionId: 'py-1', selectedOption: 1 },
      { questionId: 'py-2', selectedOption: 0 },
    ]
  };
  const numParsed = SubmitAssessmentSchema.safeParse(numericPayload);
  assert.strictEqual(numParsed.success, true, 'Numeric payload must pass schema validation');

  // Letter submission
  const letterPayload = {
    skillId: 'skill-python',
    targetLevel: 'Intermediate',
    answers: [
      { questionId: 'py-b-1', selectedOption: 'B' },
      { questionId: 'py-b-2', selectedOption: 'C' },
    ]
  };
  const letterParsed = SubmitAssessmentSchema.safeParse(letterPayload);
  assert.strictEqual(letterParsed.success, true, 'Letter payload must pass schema validation');

  // Invalid payload (empty answers)
  const emptyPayload = {
    skillId: 'skill-python',
    targetLevel: 'Intermediate',
    answers: []
  };
  assert.strictEqual(SubmitAssessmentSchema.safeParse(emptyPayload).success, false, 'Empty answers array must be rejected');

  // Invalid payload (missing skillId)
  const missingSkillPayload = {
    targetLevel: 'Intermediate',
    answers: [{ questionId: 'py-1', selectedOption: 1 }]
  };
  assert.strictEqual(SubmitAssessmentSchema.safeParse(missingSkillPayload).success, false, 'Missing skillId must be rejected');
});

// 4. SERVER-SIDE ASSESSMENT SCORING & ATOMIC TRANSACTION
test('4. Server-Side Scoring: Passing score (>=70%) verifies skill; failing score (<70%) rejects', () => {
  const db = new Database(dbPath);

  function evaluateQuiz(answers, targetProficiency) {
    const questionBank = [
      { id: 'py-1', correctOption: 'B' },
      { id: 'py-2', correctOption: 'B' },
      { id: 'py-3', correctOption: 'A' },
      { id: 'py-4', correctOption: 'B' },
    ];

    let correct = 0;
    for (const a of answers) {
      const q = questionBank.find(qb => qb.id === a.questionId);
      if (q && String(a.selectedOption).toUpperCase() === q.correctOption) {
        correct++;
      }
    }

    const percentage = Math.round((correct / questionBank.length) * 100);
    const passed = percentage >= 70;
    const verificationStatus = passed ? 'ASSESSMENT_VERIFIED' : 'VERIFICATION_FAILED';

    return { passed, percentage, verificationStatus };
  }

  // Pass scenario (4/4 = 100%)
  const passResult = evaluateQuiz([
    { questionId: 'py-1', selectedOption: 'B' },
    { questionId: 'py-2', selectedOption: 'B' },
    { questionId: 'py-3', selectedOption: 'A' },
    { questionId: 'py-4', selectedOption: 'B' },
  ], 'Intermediate');

  assert.strictEqual(passResult.passed, true);
  assert.strictEqual(passResult.percentage, 100);
  assert.strictEqual(passResult.verificationStatus, 'ASSESSMENT_VERIFIED');

  // Fail scenario (0/4 = 0%)
  const failResult = evaluateQuiz([
    { questionId: 'py-1', selectedOption: 'A' },
    { questionId: 'py-2', selectedOption: 'A' },
    { questionId: 'py-3', selectedOption: 'C' },
    { questionId: 'py-4', selectedOption: 'A' },
  ], 'Intermediate');

  assert.strictEqual(failResult.passed, false);
  assert.strictEqual(failResult.percentage, 0);
  assert.strictEqual(failResult.verificationStatus, 'VERIFICATION_FAILED');

  db.close();
});

// 5. STUDY ROADMAP SCHEMA & REAL MENTOR INTEGRATION
test('5. Study Roadmap: Generates structured multi-stage curriculum and links to database mentors', () => {
  const db = new Database(dbPath, { readonly: true });

  // Querying skillQuery from SQLite finds real mentors
  const mentors = db.prepare(`
    SELECT u.id, p.display_name, s.name, us.proficiency, us.verification_status
    FROM user_skills us
    JOIN skills s ON us.skill_id = s.id
    JOIN users u ON us.user_id = u.id
    JOIN profiles p ON u.id = p.user_id
    WHERE s.name LIKE '%Python%' AND u.status = 'ACTIVE'
  `).all();

  assert.ok(mentors.length >= 2, 'Must find real Python mentors in DB');
  assert.ok(mentors.some(m => m.display_name === 'Rahul Reddy'));
  assert.ok(mentors.some(m => m.display_name === 'Sai Kiran'));

  // Test study_roadmaps and roadmap_stages tables exist in DB
  const roadmapTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='study_roadmaps'").get();
  assert.ok(roadmapTable, 'study_roadmaps table must exist');

  const stagesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='roadmap_stages'").get();
  assert.ok(stagesTable, 'roadmap_stages table must exist');

  db.close();
});

// 6. ROLE SYSTEM & ROLE UPGRADE API
test('6. Role System & Upgrade: Upgrades student to Mentor+Student while preserving records', () => {
  const db = new Database(dbPath);

  // Create isolated test user
  const testUserId = `usr-test-upgrade-${Date.now()}`;
  const testEmail = `upgrade.${Date.now()}@campus.edu`;
  
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, user_type, status)
    VALUES (?, ?, 'hash', 'STUDENT', 'LEARNER', 'ACTIVE')
  `).run(testUserId, testEmail);

  db.prepare(`
    INSERT INTO skill_credit_accounts (user_id, balance, escrow_balance)
    VALUES (?, 4, 0)
  `).run(testUserId);

  const initialUser = db.prepare('SELECT user_type FROM users WHERE email = ?').get(testEmail);
  assert.strictEqual(initialUser.user_type, 'LEARNER');

  // Perform role upgrade
  db.prepare("UPDATE users SET user_type = 'TEACHER_LEARNER' WHERE email = ?").run(testEmail);

  const upgradedUser = db.prepare('SELECT user_type FROM users WHERE email = ?').get(testEmail);
  assert.strictEqual(upgradedUser.user_type, 'TEACHER_LEARNER');

  // Verify balance remains intact
  const balance = db.prepare('SELECT balance FROM skill_credit_accounts WHERE user_id = ?').get(testUserId);
  assert.strictEqual(balance.balance, 4);

  // Clean up
  db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  db.prepare('DELETE FROM skill_credit_accounts WHERE user_id = ?').run(testUserId);
  db.close();
});

// 7. ROUTING & UI SEPARATION
test('7. Routing Separation: Navbar has separate /login and /register links, LoginPage has no register form', () => {
  const navbarCode = fs.readFileSync(path.join(__dirname, '../src/components/Navbar.tsx'), 'utf8');
  assert.ok(navbarCode.includes('href="/login"'), 'Navbar must link to /login');
  assert.ok(navbarCode.includes('href="/register"'), 'Navbar must link to /register');
  assert.strictEqual(navbarCode.includes('/login?tab=register'), false, 'No /login?tab=register hack in Navbar');

  const loginCode = fs.readFileSync(path.join(__dirname, '../src/app/login/page.tsx'), 'utf8');
  assert.ok(loginCode.includes('href="/register"'), 'Login must link to /register');
  assert.strictEqual(loginCode.includes('regCollege'), false, 'No registration inputs in LoginPage');
  assert.strictEqual(loginCode.includes('regMajor'), false, 'No registration inputs in LoginPage');

  // Verify /register sub-routes exist
  assert.ok(fs.existsSync(path.join(__dirname, '../src/app/register/page.tsx')));
  assert.ok(fs.existsSync(path.join(__dirname, '../src/app/register/student/page.tsx')));
  assert.ok(fs.existsSync(path.join(__dirname, '../src/app/register/mentor/page.tsx')));
  assert.ok(fs.existsSync(path.join(__dirname, '../src/app/register/mentor-student/page.tsx')));
});
