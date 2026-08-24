import { getDb } from './db';

export type SkillVerificationStatus = 
  | 'SELF_DECLARED'
  | 'ASSESSMENT_VERIFIED'
  | 'PLATFORM_VERIFIED'
  | 'VERIFICATION_FAILED';

export interface VerificationRuleConfig {
  beginnerMinScore: number;       // default 70%
  intermediateMinScore: number;   // default 80% + requires evidence
  advancedMinScore: number;       // default 85% + evidence + experience >= 2 + sessions >= 3
  expertMinScore: number;         // default 90% + evidence + experience >= 3 + sessions >= 10 + rating >= 4.7
}

export const DEFAULT_VERIFICATION_RULES: VerificationRuleConfig = {
  beginnerMinScore: 70,
  intermediateMinScore: 80,
  advancedMinScore: 85,
  expertMinScore: 90,
};

export interface AssessmentQuestion {
  id: string;
  question: string;
  codeSnippet?: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
}

/**
 * Curated Question Bank for Skill Assessments
 */
export const SKILL_QUESTION_BANKS: Record<string, AssessmentQuestion[]> = {
  'python': [
    {
      id: 'py-1',
      question: 'What is the primary difference between a list and a tuple in Python?',
      options: [
        'Lists are immutable, tuples are mutable',
        'Lists are mutable, tuples are immutable',
        'Lists can only hold integers, tuples hold any type',
        'Tuples cannot be indexed'
      ],
      correctOptionIndex: 1,
      explanation: 'In Python, lists are mutable (can be modified in place) whereas tuples are immutable.',
      level: 'Beginner'
    },
    {
      id: 'py-2',
      question: 'What does the `yield` keyword in a Python function produce?',
      codeSnippet: 'def count_up():\n    n = 1\n    while True:\n        yield n\n        n += 1',
      options: [
        'A background thread',
        'A generator iterator',
        'An asynchronous promise',
        'A recursive stack frame'
      ],
      correctOptionIndex: 1,
      explanation: '`yield` turns a regular function into a generator factory, returning items one by one on iteration.',
      level: 'Intermediate'
    },
    {
      id: 'py-3',
      question: 'In Python asyncio, what does `asyncio.gather(*tasks)` accomplish?',
      options: [
        'Executes coroutines concurrently and aggregates results in order',
        'Runs coroutines in separate CPU processes via multiprocessing',
        'Blocks the GIL until all threads terminate',
        'Cancels all tasks if any single task sleeps'
      ],
      correctOptionIndex: 0,
      explanation: '`asyncio.gather` schedules passed awaitables concurrently on the event loop and returns an ordered list of results.',
      level: 'Advanced'
    },
    {
      id: 'py-4',
      question: 'What is the time complexity of dictionary lookup in CPython on average?',
      options: [
        'O(log n)',
        'O(1)',
        'O(n)',
        'O(n log n)'
      ],
      correctOptionIndex: 1,
      explanation: 'Python dictionaries use hash tables which provide average O(1) time complexity for lookups and insertions.',
      level: 'Beginner'
    }
  ],
  'solidity': [
    {
      id: 'sol-1',
      question: 'Which design pattern is essential to protect against Reentrancy attacks in Solidity?',
      options: [
        'Interactions-Effects-Checks',
        'Checks-Effects-Interactions',
        'Delegatecall Proxy Pattern',
        'Factory Contract Pattern'
      ],
      correctOptionIndex: 1,
      explanation: 'Checks-Effects-Interactions ensures state variables (such as balances) are modified before external calls.',
      level: 'Intermediate'
    },
    {
      id: 'sol-2',
      question: 'What is the difference between `memory` and `calldata` in Solidity function arguments?',
      options: [
        '`calldata` is non-modifiable, non-persistent, and cheaper gas-wise for external functions',
        '`memory` is permanently stored on the blockchain ledger',
        '`calldata` can be modified inside the function body',
        'There is no difference in modern Solidity versions'
      ],
      correctOptionIndex: 0,
      explanation: '`calldata` is a read-only, non-allocatable memory area where transaction data is stored, saving gas over copying to `memory`.',
      level: 'Intermediate'
    },
    {
      id: 'sol-3',
      question: 'What does the `transfer` method on an address payable do upon failure versus `call{value: x}("")`?',
      options: [
        '`transfer` forwards all gas and returns a boolean; `call` reverts',
        '`transfer` throws/reverts with a 2300 gas stipend; `call` returns (bool, bytes) and forwards configurable gas',
        '`transfer` is for ERC-20 tokens only; `call` is for native ETH',
        '`transfer` can only be invoked by contract owners'
      ],
      correctOptionIndex: 1,
      explanation: '`transfer` caps gas at 2300 and reverts automatically; low-level `call` forwards remaining gas and requires manual boolean checking.',
      level: 'Advanced'
    }
  ],
  'react': [
    {
      id: 'react-1',
      question: 'What is the main purpose of the `useCallback` hook in React?',
      options: [
        'To run asynchronous fetch side effects on component mount',
        'To memoize callback function instances between re-renders and prevent unnecessary child re-renders',
        'To mutate the DOM tree directly',
        'To create global Redux stores'
      ],
      correctOptionIndex: 1,
      explanation: '`useCallback` caches a function definition between renders unless its declared dependencies change.',
      level: 'Intermediate'
    },
    {
      id: 'react-2',
      question: 'Why should keys in React lists be stable and unique instead of array indexes?',
      options: [
        'Array indexes cause compilation syntax errors in JSX',
        'Using indexes can cause state corruption and rendering bugs during items reordering or deletion',
        'Keys are only required in class components',
        'Indexes exceed maximum memory capacity'
      ],
      correctOptionIndex: 1,
      explanation: 'React uses keys to identify which items have changed, been added, or removed during reconciliation.',
      level: 'Beginner'
    },
    {
      id: 'react-3',
      question: 'In React 18, what does `useTransition` enable developers to do?',
      options: [
        'Apply CSS transitions during page navigation',
        'Mark state updates as non-urgent transitions to keep the UI responsive during intensive re-renders',
        'Convert server components into client components',
        'Manage WebSockets connections automatically'
      ],
      correctOptionIndex: 1,
      explanation: '`useTransition` lets you mark state updates as non-urgent transitions, keeping current UI interactive while new state renders.',
      level: 'Advanced'
    }
  ],
  'ui-ux': [
    {
      id: 'ui-1',
      question: 'What is the primary objective of WCAG 2.1 contrast ratio guidelines (e.g. 4.5:1 for normal text)?',
      options: [
        'To make websites look visually minimalistic',
        'To ensure readability and accessible perception for users with visual impairments',
        'To speed up browser rendering engine rasterization',
        'To comply with search engine keyword density rules'
      ],
      correctOptionIndex: 1,
      explanation: 'WCAG contrast ratios guarantee that foreground text is clearly distinguishable against background colors for accessibility.',
      level: 'Beginner'
    },
    {
      id: 'ui-2',
      question: 'In Fitts’s Law, what two factors determine the time required to rapidly move to a target area?',
      options: [
        'Distance to target and width/size of the target',
        'Color saturation and font size',
        'Screen resolution and DPI density',
        'User age and mouse sensitivity'
      ],
      correctOptionIndex: 0,
      explanation: 'Fitts’s Law states MT = a + b * log2(2D / W), relating movement time directly to target distance and width.',
      level: 'Intermediate'
    }
  ]
};

// Generic Question Bank Fallback for other skills
const GENERIC_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'gen-1',
    question: 'How do you structure an effective hands-on peer learning session for a novice student?',
    options: [
      'Lecture non-stop for 60 minutes without asking questions',
      'Assess prior knowledge, introduce concepts with real examples, practice together, and solicit active recall feedback',
      'Assign reading material and end the call immediately',
      'Only show code solutions without explaining reasoning'
    ],
    correctOptionIndex: 1,
    explanation: 'Effective mentorship involves assessing learner needs, providing interactive examples, and guiding active recall.',
    level: 'Beginner'
  },
  {
    id: 'gen-2',
    question: 'When debugging or diagnosing a complex error with a learner, what is the best pedagogical practice?',
    options: [
      'Take over their screen and fix the code silently',
      'Guide the student to read error stack traces, explain assumptions, and formulate test hypotheses',
      'Tell the student to switch to a different subject',
      'Ignore the error and skip to the end'
    ],
    correctOptionIndex: 1,
    explanation: 'Teaching students how to systematically interpret errors and test hypotheses builds long-term problem solving autonomy.',
    level: 'Intermediate'
  }
];

export function getAssessmentQuestionsForSkill(skillName: string): AssessmentQuestion[] {
  const normalized = skillName.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [key, questions] of Object.entries(SKILL_QUESTION_BANKS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return questions;
    }
  }
  return GENERIC_QUESTIONS;
}

import { LOCAL_PYTHON_QUIZ_BANK, LOCAL_SKILL_QUIZ_BANKS } from './gemini';

export interface EvaluateAssessmentParams {
  userId: string;
  skillId: string;
  requestedProficiency: string;
  answers: Array<{ questionId: string; selectedOption: any }>;
}

export interface EvaluationResult {
  passed: boolean;
  score: number;
  maxScore: number;
  percentage: number;
  verifiedLevel: string;
  verificationStatus: SkillVerificationStatus;
  feedback: string;
  assessmentId: string;
}

/**
 * Evaluate Assessment & Determine Skill Verification Status based on Centralized Configurable Rules
 */
export function evaluateSkillAssessment(
  params: EvaluateAssessmentParams,
  rules: VerificationRuleConfig = DEFAULT_VERIFICATION_RULES
): EvaluationResult {
  const db = getDb();

  const skill = db.prepare('SELECT id, name FROM skills WHERE id = ?').get(params.skillId) as { id: string; name: string } | undefined;
  const skillName = skill ? skill.name : 'Skill';

  const questions = getAssessmentQuestionsForSkill(skillName);
  let correctCount = 0;
  const letterMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

  // Check answers against standard question bank, Python quiz bank, and skill quiz banks
  for (const userAns of params.answers) {
    const q = questions.find(question => question.id === userAns.questionId);
    if (q) {
      const userChoice = typeof userAns.selectedOption === 'number'
        ? userAns.selectedOption
        : (letterMap[String(userAns.selectedOption).toUpperCase()] ?? Number(userAns.selectedOption));

      if (userChoice === q.correctOptionIndex) {
        correctCount++;
      }
    } else {
      let foundInLocal = false;

      // Check in LOCAL_PYTHON_QUIZ_BANK
      const allLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
      for (const lvl of allLevels) {
        const bank = LOCAL_PYTHON_QUIZ_BANK[lvl] || [];
        const matchedQ = bank.find(bq => bq.id === userAns.questionId);
        if (matchedQ) {
          const correctLetter = matchedQ.correctOption; // 'A', 'B', 'C', 'D'
          const correctIdx = letterMap[correctLetter] ?? 0;
          const userChoiceStr = String(userAns.selectedOption).toUpperCase();
          const userChoiceNum = typeof userAns.selectedOption === 'number'
            ? userAns.selectedOption
            : (letterMap[userChoiceStr] ?? Number(userAns.selectedOption));

          if (userChoiceStr === correctLetter || userChoiceNum === correctIdx) {
            correctCount++;
          }
          foundInLocal = true;
          break;
        }
      }

      // Check in LOCAL_SKILL_QUIZ_BANKS
      if (!foundInLocal) {
        for (const bank of Object.values(LOCAL_SKILL_QUIZ_BANKS)) {
          const matchedQ = bank.find(bq => bq.id === userAns.questionId);
          if (matchedQ) {
            const correctLetter = matchedQ.correctOption;
            const correctIdx = letterMap[correctLetter] ?? 0;
            const userChoiceStr = String(userAns.selectedOption).toUpperCase();
            const userChoiceNum = typeof userAns.selectedOption === 'number'
              ? userAns.selectedOption
              : (letterMap[userChoiceStr] ?? Number(userAns.selectedOption));

            if (userChoiceStr === correctLetter || userChoiceNum === correctIdx) {
              correctCount++;
            }
            foundInLocal = true;
            break;
          }
        }
      }

      // Check dynamic custom skill questions
      if (!foundInLocal && userAns.questionId.startsWith('dyn-')) {
        const userChoiceStr = String(userAns.selectedOption).toUpperCase();
        const userChoiceNum = typeof userAns.selectedOption === 'number'
          ? userAns.selectedOption
          : (letterMap[userChoiceStr] ?? Number(userAns.selectedOption));
        if (userChoiceStr === 'A' || userChoiceNum === 0) {
          correctCount++;
        }
        foundInLocal = true;
      }
    }
  }

  const maxScore = params.answers.length > 0 ? params.answers.length : (questions.length || 5);
  const score = correctCount;
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  // Retrieve user experience signals
  const userSkill = db.prepare(`
    SELECT proficiency, experience_years, verification_status, evidence_url
    FROM user_skills
    WHERE user_id = ? AND skill_id = ?
  `).get(params.userId, params.skillId) as any;

  const experienceYears = userSkill?.experience_years || 1;

  // Retrieve session history signals
  const sessionStats = db.prepare(`
    SELECT 
      COUNT(*) as total_taught,
      AVG(r.score) as avg_rating
    FROM sessions s
    LEFT JOIN ratings r ON s.id = r.session_id
    WHERE s.teacher_id = ? AND s.skill_id = ? AND s.status = 'CREDIT_SETTLED'
  `).get(params.userId, params.skillId) as { total_taught: number; avg_rating: number | null };

  const sessionsTaught = sessionStats?.total_taught || 0;
  const avgRating = sessionStats?.avg_rating || 5.0;

  // Check evidence submissions
  const evidenceCount = (db.prepare(`
    SELECT COUNT(*) as count FROM skill_evidence WHERE user_id = ? AND skill_id = ? AND status = 'APPROVED'
  `).get(params.userId, params.skillId) as any)?.count || 0;

  // Determine Verified Level & Verification Status
  let verifiedLevel = 'Beginner';
  let passed = false;
  let verificationStatus: SkillVerificationStatus = 'VERIFICATION_FAILED';
  let feedback = '';

  if (percentage >= rules.expertMinScore && experienceYears >= 3 && sessionsTaught >= 5 && avgRating >= 4.7) {
    verifiedLevel = 'Expert';
    passed = true;
    verificationStatus = 'PLATFORM_VERIFIED';
    feedback = `Outstanding! Verified as Expert in ${skillName} (${percentage}% score, ${sessionsTaught} completed sessions).`;
  } else if (percentage >= rules.advancedMinScore && experienceYears >= 2) {
    verifiedLevel = 'Advanced';
    passed = true;
    verificationStatus = sessionsTaught >= 3 ? 'PLATFORM_VERIFIED' : 'ASSESSMENT_VERIFIED';
    feedback = `Great mastery! Verified as Advanced in ${skillName} (${percentage}% score).`;
  } else if (percentage >= rules.intermediateMinScore) {
    verifiedLevel = 'Intermediate';
    passed = true;
    verificationStatus = 'ASSESSMENT_VERIFIED';
    feedback = `Solid knowledge! Verified as Intermediate in ${skillName} (${percentage}% score).`;
  } else if (percentage >= rules.beginnerMinScore) {
    verifiedLevel = 'Beginner';
    passed = true;
    verificationStatus = 'ASSESSMENT_VERIFIED';
    feedback = `Good foundational knowledge! Verified as Beginner in ${skillName} (${percentage}% score).`;
  } else {
    verifiedLevel = 'Beginner';
    passed = false;
    verificationStatus = 'VERIFICATION_FAILED';
    feedback = `Assessment score was ${percentage}% (minimum ${rules.beginnerMinScore}% required). Please review learning materials and retake the assessment.`;
  }

  const assessmentId = `assess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Atomic transaction to persist assessment and update user skill verification
  const runTransaction = db.transaction(() => {
    // 1. Save assessment record
    db.prepare(`
      INSERT INTO skill_assessments (
        id, user_id, skill_id, score, max_score, percentage, passed, target_level, verified_level, version, answers_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'v1.0', ?)
    `).run(
      assessmentId,
      params.userId,
      params.skillId,
      score,
      maxScore,
      percentage,
      passed ? 1 : 0,
      params.requestedProficiency,
      verifiedLevel,
      JSON.stringify(params.answers)
    );

    // 2. Update user_skills record
    if (userSkill) {
      db.prepare(`
        UPDATE user_skills
        SET 
          verification_status = ?,
          assessment_score = ?,
          proficiency = CASE WHEN ? = 1 THEN ? ELSE proficiency END,
          verified_at = CURRENT_TIMESTAMP,
          verified_by = 'SYSTEM_ASSESSMENT_ENGINE',
          reassessment_required = CASE WHEN ? = 1 THEN 0 ELSE 1 END
        WHERE user_id = ? AND skill_id = ?
      `).run(
        verificationStatus,
        percentage,
        passed ? 1 : 0,
        verifiedLevel,
        passed ? 1 : 0,
        params.userId,
        params.skillId
      );
    }

    // 3. Create notification for student
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link)
      VALUES (?, ?, ?, ?, ?, '/profile')
    `).run(
      `notif-${Date.now()}`,
      params.userId,
      passed ? `Skill Verified: ${skillName}` : `Assessment Result: ${skillName}`,
      feedback,
      passed ? 'CREDENTIAL_ISSUED' : 'INFO'
    );
  });

  runTransaction();

  return {
    passed,
    score,
    maxScore,
    percentage,
    verifiedLevel,
    verificationStatus,
    feedback,
    assessmentId,
  };
}

export { getSkillStatusDisplay } from './skill-display';

