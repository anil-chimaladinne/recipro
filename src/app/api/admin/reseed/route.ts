import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authRes = requireRole(req, ['ADMIN']);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  try {
    const db = getDb();
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // Skills
    const skillsData = [
      { id: 'skill-python', name: 'Python Programming', category: 'Computer Science' },
      { id: 'skill-react', name: 'React & Next.js', category: 'Computer Science' },
      { id: 'skill-solidity', name: 'Solidity & Smart Contracts', category: 'Computer Science' },
      { id: 'skill-ml', name: 'Machine Learning & PyTorch', category: 'Computer Science' },
      { id: 'skill-dsa', name: 'Data Structures & Algorithms', category: 'Computer Science' },
      { id: 'skill-figma', name: 'UI/UX Design & Figma', category: 'Design' },
      { id: 'skill-spanish', name: 'Spanish Conversation', category: 'Languages' },
      { id: 'skill-calculus', name: 'Calculus & Linear Algebra', category: 'Mathematics' },
      { id: 'skill-finance', name: 'Corporate Finance & Valuation', category: 'Business' },
      { id: 'skill-node', name: 'Node.js & Express Backend', category: 'Computer Science' },
    ];

    for (const s of skillsData) {
      db.prepare(`INSERT OR IGNORE INTO skills (id, name, category) VALUES (?, ?, ?)`).run(s.id, s.name, s.category);
    }

    const students = [
      { id: 'usr-keerthana', email: 'keerthana.rao@campus.edu', role: 'STUDENT', name: 'Keerthana Rao', college: 'Krishna Valley Engineering College', major: 'Computer Science', year: 'Junior', balance: 4, verified: 1, trust: 92 },
      { id: 'usr-saikiran', email: 'sai.kiran@campus.edu', role: 'STUDENT', name: 'Sai Kiran', college: 'Krishna Valley Engineering College', major: 'Computer Science & AI', year: 'Senior', balance: 6, verified: 1, trust: 96 },
      { id: 'usr-bhavya', email: 'bhavya.reddy@campus.edu', role: 'STUDENT', name: 'Bhavya Reddy', college: 'Coastal Andhra University', major: 'Digital Media & UI/UX', year: 'Senior', balance: 5, verified: 1, trust: 94 },
      { id: 'usr-vamsi', email: 'vamsi.krishna@campus.edu', role: 'STUDENT', name: 'Vamsi Krishna', college: 'Vijaya Engineering College', major: 'Applied Mathematics', year: 'Junior', balance: 3, verified: 1, trust: 90 },
      { id: 'usr-suspect-1', email: 'botfarm1@external-temp.net', role: 'STUDENT', name: 'QuickSwap Pro', college: 'Unknown Faculty', major: 'General Studies', year: 'Freshman', balance: 15, verified: 0, trust: 42 },
      { id: 'usr-mod-sirisha', email: 'moderator.sirisha@campus.edu', role: 'MODERATOR', name: 'Sirisha (Campus Moderator)', college: 'Andhra Institute of Technology', major: 'Student Affairs', year: 'Graduate', balance: 10, verified: 1, trust: 99 },
      { id: 'usr-admin', email: 'admin@skillswap.campus.edu', role: 'ADMIN', name: 'Srinivas Rao (Campus Admin)', college: 'IT & Infrastructure Services', major: 'System Administration', year: 'Staff', balance: 100, verified: 1, trust: 100 },
    ];

    for (const s of students) {
      db.prepare(`INSERT OR REPLACE INTO users (id, email, password_hash, role, status, campus_id) VALUES (?, ?, ?, ?, 'ACTIVE', ?)`).run(s.id, s.email, passwordHash, s.role, `STU-${s.id.toUpperCase()}`);
      db.prepare(`INSERT OR REPLACE INTO profiles (id, user_id, display_name, college, major, year, is_verified_student, trust_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(`prof-${s.id}`, s.id, s.name, s.college, s.major, s.year, s.verified, s.trust);
      db.prepare(`INSERT OR REPLACE INTO skill_credit_accounts (id, user_id, balance, escrow_balance) VALUES (?, ?, ?, 0)`).run(`acc-${s.id}`, s.id, s.balance);
      db.prepare(`INSERT OR REPLACE INTO reputations (id, user_id, total_reviews, total_sessions_taught, total_sessions_learned, bayesian_rating, reliability_score) VALUES (?, ?, 0, 0, 0, 4.5, 95.0)`).run(`rep-${s.id}`, s.id);
    }

    // Teaching Skills
    db.prepare(`INSERT OR REPLACE INTO user_skills (id, user_id, skill_id, proficiency, experience_years, teaching_style, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('usk-keerthana-react', 'usr-keerthana', 'skill-react', 'Advanced', 2.5, 'Hands-on project reviews', 'PLATFORM_VERIFIED');
    db.prepare(`INSERT OR REPLACE INTO user_skills (id, user_id, skill_id, proficiency, experience_years, teaching_style, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('usk-keerthana-node', 'usr-keerthana', 'skill-node', 'Intermediate', 1.5, 'API building workshops', 'PEER_VERIFIED');
    db.prepare(`INSERT OR REPLACE INTO user_skills (id, user_id, skill_id, proficiency, experience_years, teaching_style, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('usk-saikiran-python', 'usr-saikiran', 'skill-python', 'Expert', 3.5, 'Deep dive architecture & debugging', 'PLATFORM_VERIFIED');
    db.prepare(`INSERT OR REPLACE INTO user_skills (id, user_id, skill_id, proficiency, experience_years, teaching_style, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('usk-saikiran-solidity', 'usr-saikiran', 'skill-solidity', 'Advanced', 2.0, 'Smart contract security audits', 'PLATFORM_VERIFIED');
    db.prepare(`INSERT OR REPLACE INTO user_skills (id, user_id, skill_id, proficiency, experience_years, teaching_style, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('usk-bhavya-figma', 'usr-bhavya', 'skill-figma', 'Expert', 4.0, 'Figma component mastery & prototypes', 'PLATFORM_VERIFIED');
    db.prepare(`INSERT OR REPLACE INTO user_skills (id, user_id, skill_id, proficiency, experience_years, teaching_style, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('usk-vamsi-calculus', 'usr-vamsi', 'skill-calculus', 'Expert', 3.0, 'Step-by-step problem walkthroughs', 'PLATFORM_VERIFIED');

    // Learning Goals
    db.prepare(`INSERT OR REPLACE INTO learning_goals (id, user_id, skill_id, target_proficiency, priority, notes) VALUES (?, ?, ?, ?, ?, ?)`).run('goal-keerthana-solidity', 'usr-keerthana', 'skill-solidity', 'Intermediate', 'HIGH', 'Want to build DeFi and credential contracts for senior project');
    db.prepare(`INSERT OR REPLACE INTO learning_goals (id, user_id, skill_id, target_proficiency, priority, notes) VALUES (?, ?, ?, ?, ?, ?)`).run('goal-saikiran-figma', 'usr-saikiran', 'skill-figma', 'Intermediate', 'HIGH', 'Need better UI/UX skills for my open-source projects');
    db.prepare(`INSERT OR REPLACE INTO learning_goals (id, user_id, skill_id, target_proficiency, priority, notes) VALUES (?, ?, ?, ?, ?, ?)`).run('goal-bhavya-python', 'usr-bhavya', 'skill-python', 'Intermediate', 'HIGH', 'Need Python data scripts for UX analytics');

    // Availability
    db.prepare(`INSERT OR REPLACE INTO availability_slots (id, user_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)`).run('avail-keerthana-tue', 'usr-keerthana', 'Tuesday', '18:00', '20:00');
    db.prepare(`INSERT OR REPLACE INTO availability_slots (id, user_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)`).run('avail-keerthana-thu', 'usr-keerthana', 'Thursday', '18:00', '20:00');
    db.prepare(`INSERT OR REPLACE INTO availability_slots (id, user_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)`).run('avail-saikiran-tue', 'usr-saikiran', 'Tuesday', '18:00', '21:00');
    db.prepare(`INSERT OR REPLACE INTO availability_slots (id, user_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)`).run('avail-saikiran-thu', 'usr-saikiran', 'Thursday', '18:00', '21:00');
    db.prepare(`INSERT OR REPLACE INTO availability_slots (id, user_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)`).run('avail-bhavya-tue', 'usr-bhavya', 'Tuesday', '18:00', '20:00');
    db.prepare(`INSERT OR REPLACE INTO availability_slots (id, user_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)`).run('avail-vamsi-mon', 'usr-vamsi', 'Monday', '16:00', '19:00');

    // Reputations
    db.prepare(`UPDATE reputations SET total_reviews=24, total_sessions_taught=27, bayesian_rating=4.9, reliability_score=99 WHERE user_id='usr-saikiran'`).run();
    db.prepare(`UPDATE reputations SET total_reviews=18, total_sessions_taught=19, bayesian_rating=4.9, reliability_score=97 WHERE user_id='usr-bhavya'`).run();
    db.prepare(`UPDATE reputations SET total_reviews=7, total_sessions_taught=8, bayesian_rating=4.8, reliability_score=98 WHERE user_id='usr-keerthana'`).run();
    db.prepare(`UPDATE skill_credit_accounts SET lifetime_earned=27, lifetime_spent=12 WHERE user_id='usr-saikiran'`).run();

    // Verifiable Credential for Sai Kiran
    db.prepare(`INSERT OR REPLACE INTO credentials (id, user_id, title, badge_type, skill_id, token_id, tx_hash, criteria_met) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'cred-saikiran-python-1', 'usr-saikiran', 'Python Mentor — Level 1', 'MENTOR_TIER_1', 'skill-python', 'CERT-8841',
      '0x8f28c11e72e128b9d3b4a2e5d6c8109923847162901928374615243123456789',
      JSON.stringify({ sessionsTaught: 27, bayesianRating: 4.9, minSessionsRequired: 3, minRatingRequired: 4.5 })
    );

    // StudySphere Groups & Resources
    db.prepare(`INSERT OR REPLACE INTO study_groups (id, name, description, subject, creator_id, meeting_schedule, max_members) VALUES (?,?,?,?,?,?,?)`).run('grp-1', 'Web3 & EVM Builders Circle', 'Weekly Solidity smart contract collaboration.', 'Computer Science', 'usr-saikiran', 'Thursdays 7:00 PM', 10);
    db.prepare(`INSERT OR REPLACE INTO study_groups (id, name, description, subject, creator_id, meeting_schedule, max_members) VALUES (?,?,?,?,?,?,?)`).run('grp-2', 'Figma Design System Jam', 'Critique and design system token standardization sessions.', 'Design', 'usr-bhavya', 'Wednesdays 6:00 PM', 8);

    db.prepare(`INSERT OR REPLACE INTO study_resources (id, title, description, subject, author_id, resource_type, file_url, upvotes) VALUES (?,?,?,?,?,?,?,?)`).run('res-1', 'Smart Contract Security Audit Checklist', 'Comprehensive checklist: reentrancy, integer overflow, access control.', 'Computer Science', 'usr-saikiran', 'PDF', 'https://docs.skillswap.internal/evm-security.pdf', 34);
    db.prepare(`INSERT OR REPLACE INTO study_resources (id, title, description, subject, author_id, resource_type, file_url, upvotes) VALUES (?,?,?,?,?,?,?,?)`).run('res-2', 'React 18 Server Components Cheat Sheet', 'Visual guide to hydration boundaries and Suspense patterns.', 'Computer Science', 'usr-keerthana', 'NOTES', 'https://docs.skillswap.internal/react-cheatsheet.pdf', 28);

    db.prepare(`INSERT OR REPLACE INTO flashcard_decks (id, user_id, title, subject, cards_count, is_public) VALUES (?,?,?,?,?,?)`).run('deck-1', 'usr-saikiran', 'Solidity & EVM Opcodes Master Deck', 'Computer Science', 3, 1);
    db.prepare(`INSERT OR REPLACE INTO flashcards (id, deck_id, front, back, mastery_level) VALUES (?,?,?,?,?)`).run('fc-1', 'deck-1', 'What is the Checks-Effects-Interactions pattern?', 'A security pattern: state checks first, internal state modifications second, external calls last — prevents reentrancy.', 4);
    db.prepare(`INSERT OR REPLACE INTO flashcards (id, deck_id, front, back, mastery_level) VALUES (?,?,?,?,?)`).run('fc-2', 'deck-1', 'Gas cost: storage vs memory?', 'Storage SSTORE costs up to 20,000 gas (permanent). Memory is temporary and very cheap.', 3);
    db.prepare(`INSERT OR REPLACE INTO flashcards (id, deck_id, front, back, mastery_level) VALUES (?,?,?,?,?)`).run('fc-3', 'deck-1', 'Why never use tx.origin for authorization?', 'tx.origin returns the original EOA — vulnerable to phishing contracts. Always use msg.sender.', 5);

    // Fraud Alert for Suspect-1
    db.prepare(`INSERT OR REPLACE INTO fraud_alerts (id, user_id, risk_score, risk_level, anomaly_reasons, status) VALUES (?,?,?,?,?,?)`).run(
      'alert-suspect-1', 'usr-suspect-1', 88.0, 'HIGH',
      JSON.stringify(['High reciprocal rating loop detected (100% mutual 5-star reviews)', 'Rapid credit velocity: 10 transactions in <24h', 'Unverified campus identity status']),
      'PENDING_REVIEW'
    );

    return NextResponse.json({ success: true, message: 'Campus database successfully re-seeded with authentic Indian campus data!' });
  } catch (err: any) {
    console.error('Reseed API Error:', err);
    return NextResponse.json({ error: 'Failed to re-seed database: ' + err.message }, { status: 500 });
  }
}
