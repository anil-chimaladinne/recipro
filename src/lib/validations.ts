import { z } from 'zod';

// ==========================================
// AUTHENTICATION SCHEMAS
// ==========================================

export const UserTypeEnum = z.enum(['TEACHER', 'LEARNER', 'TEACHER_LEARNER']);
export const TeachingPreferenceEnum = z.enum(['Anyone', 'Women', 'Men']);
export const SkillVerificationStatusEnum = z.enum([
  'SELF_DECLARED',
  'ASSESSMENT_VERIFIED',
  'PLATFORM_VERIFIED',
  'VERIFICATION_FAILED',
  'CLAIMED', // backward compat
  'AI_SUGGESTED',
  'PEER_VERIFIED'
]);

export const RegisterSchema = z.object({
  email: z.preprocess(
    (val) => typeof val === 'string' ? val.trim().toLowerCase() : val,
    z.string().email('Please enter a valid email address')
  ),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50).optional(),
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(50).optional(),
  college: z.string().max(100).optional().default('SkillSwap Campus'),
  major: z.string().max(100).optional().default('General Studies'),
  year: z.enum(['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'PhD']).optional().default('Freshman'),
  userType: UserTypeEnum.optional().default('TEACHER_LEARNER'),
  role: z.enum(['STUDENT', 'MODERATOR', 'ADMIN']).optional().default('STUDENT'),
});

export const OnboardingSchema = z.object({
  userType: UserTypeEnum.default('TEACHER_LEARNER'),
  college: z.string().min(2, 'College name is required').max(100),
  major: z.string().min(2, 'Major/Faculty is required').max(100),
  year: z.enum(['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'PhD']),
  teachingPreference: TeachingPreferenceEnum.optional().default('Anyone'),
  bio: z.string().max(500).optional(),
});

export const LoginSchema = z.object({
  email: z.preprocess(
    (val) => typeof val === 'string' ? val.trim().toLowerCase() : val,
    z.string().email('Please enter a valid email address')
  ),
  password: z.string().min(1, 'Password is required'),
});

// ==========================================
// PROFILE & SKILLS SCHEMAS
// ==========================================

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  college: z.string().max(100).optional(),
  major: z.string().max(100).optional(),
  year: z.string().optional(),
  userType: UserTypeEnum.optional(),
  teachingPreference: TeachingPreferenceEnum.optional(),
  portfolioUrl: z.string().url().or(z.literal('')).optional(),
  teachingStyle: z.string().max(200).optional(),
  languages: z.string().max(200).optional(),
  profileVisibility: z.enum(['PUBLIC', 'CAMPUS_ONLY', 'PRIVATE']).optional(),
  skillVisibility: z.enum(['PUBLIC', 'CAMPUS_ONLY', 'PRIVATE']).optional(),
  availabilityVisibility: z.enum(['PUBLIC', 'CAMPUS_ONLY', 'PRIVATE']).optional(),
  portfolioVisibility: z.enum(['PUBLIC', 'CAMPUS_ONLY', 'PRIVATE']).optional(),
  learningGoalVisibility: z.enum(['PUBLIC', 'CAMPUS_ONLY', 'PRIVATE']).optional(),
  dailySessionLimit: z.number().int().min(1).max(10).optional(),
  mlConsent: z.boolean().optional(),
});

export const AddSkillSchema = z.object({
  skillName: z.string().min(2).max(50).trim(),
  category: z.string().min(2).max(50),
  proficiency: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']),
  experienceYears: z.number().min(0).max(20).default(1),
  teachingStyle: z.string().max(200).optional().default('Hands-on practice & examples'),
  evidenceUrl: z.string().url().or(z.literal('')).optional(),
  verificationStatus: SkillVerificationStatusEnum.optional().default('SELF_DECLARED'),
});

export const SubmitAssessmentSchema = z.object({
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

export const SubmitEvidenceSchema = z.object({
  skillId: z.string().min(1, 'Skill ID is required'),
  evidenceType: z.enum(['PORTFOLIO_LINK', 'GITHUB_REPO', 'CERTIFICATE', 'PROJECT_DEMO', 'ACADEMIC_TRANSCRIPT']),
  title: z.string().min(3).max(100),
  url: z.string().url(),
  description: z.string().max(500).optional(),
});

export const CreateSkillRequestSchema = z.object({
  skillName: z.string().min(2).max(50).trim(),
  category: z.string().min(2).max(50).default('Computer Science'),
  requestedProficiency: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']).default('Beginner'),
  currentProficiency: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']).default('Beginner'),
  learningGoal: z.string().min(5).max(500),
  preferredSchedule: z.string().max(200).optional(),
  preferredSessionMode: z.enum(['ONLINE', 'CAMPUS_IN_PERSON']).default('ONLINE'),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
});

export const SubscribeSkillNotificationSchema = z.object({
  skillName: z.string().min(2).max(50).trim(),
  category: z.string().min(2).max(50).default('Computer Science'),
});

export const CalculateSlotsSchema = z.object({
  teacherId: z.string().min(1, 'Teacher ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  startTimeWindow: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().default('08:00'),
  endTimeWindow: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().default('22:00'),
  durationHours: z.number().min(0.5).max(4).default(1.0),
  bufferMinutes: z.number().min(0).max(60).default(15),
  isFlexible: z.boolean().default(true),
});

export const AddGoalSchema = z.object({
  skillName: z.string().min(2).max(50).trim(),
  category: z.string().min(2).max(50),
  targetProficiency: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']).default('Intermediate'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  notes: z.string().max(300).optional(),
});

export const SetAvailabilitySchema = z.object({
  slots: z.array(z.object({
    dayOfWeek: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:MM'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:MM'),
  })),
});

// ==========================================
// SEARCH & DISCOVERY SCHEMAS
// ==========================================

export const SearchQuerySchema = z.object({
  q: z.string().optional().default(''), // Keyword (Person name OR Skill name)
  mode: z.enum(['ALL', 'MODE_A', 'MODE_B', 'MODE_C', 'SLOT_FINDER']).optional().default('ALL'),
  skillCategory: z.string().optional(),
  minProficiency: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']).optional(),
  dayOfWeek: z.string().optional(),
  verifiedOnly: z.enum(['true', 'false']).optional(),
  minRating: z.string().optional(),
  sessionMode: z.enum(['ONLINE', 'CAMPUS_IN_PERSON', 'ALL']).optional().default('ALL'),
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
});

// ==========================================
// SESSION & CREDIT SCHEMAS
// ==========================================

export const BookSessionSchema = z.object({
  teacherId: z.string().min(1, 'Teacher ID is required'),
  skillId: z.string().min(1, 'Skill ID is required'),
  title: z.string().min(3).max(100),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  durationHours: z.number().min(0.5).max(8).default(1.0),
  creditsAmount: z.number().int().min(1).max(10).default(1),
  mode: z.enum(['ONLINE', 'CAMPUS_IN_PERSON']).default('ONLINE'),
  notes: z.string().max(500).optional(),
});

export const SessionActionSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT', 'START', 'CONFIRM_COMPLETION', 'CONFIRM', 'CANCEL', 'DISPUTE']),
  reason: z.string().max(500).optional(),
  idempotencyKey: z.string().min(10).optional(),
});

// ==========================================
// RATINGS & REVIEWS SCHEMAS
// ==========================================

export const SubmitRatingSchema = z.object({
  sessionId: z.string().min(1),
  score: z.number().min(1).max(5),
  review: z.string().min(5).max(1000),
  punctualityScore: z.number().min(1).max(5).default(5),
  clarityScore: z.number().min(1).max(5).default(5),
  skillsDemonstrated: z.string().optional(),
});

// ==========================================
// WALLET & WEB3 SCHEMAS
// ==========================================

export const LinkWalletSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address'),
  chainId: z.number().int().default(31337),
  signature: z.string().min(10, 'Cryptographic signature is required'),
  nonce: z.string().min(8, 'Nonce challenge is required'),
});

// ==========================================
// AI & EXTRACTION SCHEMAS
// ==========================================

export const AnalyzeSkillsInputSchema = z.object({
  freeText: z.string().min(10, 'Please provide at least 10 characters of experience text').max(5000),
});

// ==========================================
// REPORTS & MODERATION SCHEMAS
// ==========================================

export const CreateReportSchema = z.object({
  reportedId: z.string().min(1),
  sessionId: z.string().optional(),
  reason: z.enum(['NO_SHOW', 'HARASSMENT', 'WRONG_SKILL', 'CREDIT_FRAUD', 'OTHER']),
  details: z.string().min(10).max(2000),
});

export const CreateDisputeSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().min(10).max(2000),
  evidenceUrl: z.string().url().or(z.literal('')).optional(),
});

export const ModeratorActionSchema = z.object({
  targetType: z.enum(['USER', 'REPORT', 'DISPUTE', 'FRAUD_ALERT', 'SESSION']),
  targetId: z.string().min(1),
  action: z.enum(['RESOLVE_REFUND', 'RESOLVE_PAYOUT', 'SUSPEND_USER', 'RESTRICT_CREDITS', 'DISMISS_REPORT', 'CLEAR_ALERT', 'FORCE_CANCEL']),
  reason: z.string().min(5).max(500),
});

// ==========================================
// PRE-SESSION RETURN CONFIRMATION SCHEMAS
// ==========================================

export const ProposeReturnSkillSchema = z.object({
  skillName: z.string().min(1, 'Skill name is required').max(50).trim(),
  notes: z.string().max(300).optional(),
});

export const RespondReturnSkillSchema = z.object({
  action: z.enum(['ACCEPT_SKILL', 'OFFER_CREDITS', 'PROPOSE_ALTERNATIVE', 'DECLINE']),
  alternativeSkillName: z.string().max(50).trim().optional(),
  notes: z.string().max(300).optional(),
});

export function isAcademicEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const lower = email.trim().toLowerCase();
  const parts = lower.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  if (!domain) return false;

  return (
    domain.endsWith('.edu') ||
    domain.endsWith('.ac.in') ||
    domain.endsWith('.ac.uk') ||
    domain.endsWith('.edu.in') ||
    domain.endsWith('.edu.au') ||
    domain.endsWith('.ac.nz') ||
    domain.endsWith('.ac.za') ||
    domain.endsWith('.edu.sg') ||
    domain.includes('.edu.') ||
    domain.includes('.ac.')
  );
}


