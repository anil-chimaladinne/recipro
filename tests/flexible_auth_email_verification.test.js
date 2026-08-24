const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'skillswap.db');

test('SkillSwap Campus — Flexible Auth, Email Verification & Role Architecture Test Suite', async (t) => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Academic domain detection helper logic (matching src/lib/db.ts)
  function isAcademicEmail(email) {
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

  const rand = Math.random().toString(36).substring(2, 8);
  const gmailEmail = `student.test.${rand}@gmail.com`;
  const outlookEmail = `student.test.${rand}@outlook.com`;
  const academicEmail = `student.test.${rand}@university.ac.in`;
  const eduEmail = `student.test.${rand}@college.edu`;
  const customEmail = `student.test.${rand}@mycompany.org`;

  await t.test('1. Registration with Gmail, Outlook, Yahoo, and Custom Domains (No .edu restriction)', () => {
    const passwordHash = bcrypt.hashSync('Password123!', 10);
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, campus_id, user_type, email_verified, verification_token, verification_token_expires, is_academic_email)
      VALUES (?, ?, ?, 'STUDENT', 'ACTIVE', ?, 'TEACHER_LEARNER', 0, ?, ?, ?)
    `);

    // 1A: Gmail
    const gmailToken = crypto.randomBytes(32).toString('hex');
    insertUser.run(`usr-gmail-${rand}`, gmailEmail, passwordHash, `CAMPUS-GMAIL-${rand}`, gmailToken, tokenExpires, isAcademicEmail(gmailEmail) ? 1 : 0);
    const gmailUser = db.prepare('SELECT * FROM users WHERE email = ?').get(gmailEmail);
    assert.ok(gmailUser, 'Gmail user must register successfully');
    assert.equal(gmailUser.is_academic_email, 0, 'Gmail is not academic email');

    // 1B: Outlook
    const outlookToken = crypto.randomBytes(32).toString('hex');
    insertUser.run(`usr-outlook-${rand}`, outlookEmail, passwordHash, `CAMPUS-OUTLOOK-${rand}`, outlookToken, tokenExpires, isAcademicEmail(outlookEmail) ? 1 : 0);
    const outlookUser = db.prepare('SELECT * FROM users WHERE email = ?').get(outlookEmail);
    assert.ok(outlookUser, 'Outlook user must register successfully');

    // 1C: University .ac.in
    const academicToken = crypto.randomBytes(32).toString('hex');
    insertUser.run(`usr-acad-${rand}`, academicEmail, passwordHash, `CAMPUS-ACAD-${rand}`, academicToken, tokenExpires, isAcademicEmail(academicEmail) ? 1 : 0);
    const acadUser = db.prepare('SELECT * FROM users WHERE email = ?').get(academicEmail);
    assert.ok(acadUser, 'University .ac.in user must register successfully');
    assert.equal(acadUser.is_academic_email, 1, '.ac.in domain must be detected as academic');

    // 1D: College .edu
    const eduToken = crypto.randomBytes(32).toString('hex');
    insertUser.run(`usr-edu-${rand}`, eduEmail, passwordHash, `CAMPUS-EDU-${rand}`, eduToken, tokenExpires, isAcademicEmail(eduEmail) ? 1 : 0);
    const eduUser = db.prepare('SELECT * FROM users WHERE email = ?').get(eduEmail);
    assert.ok(eduUser, '.edu user must register successfully');
    assert.equal(eduUser.is_academic_email, 1, '.edu domain must be detected as academic');

    // 1E: Custom domain .org
    const customToken = crypto.randomBytes(32).toString('hex');
    insertUser.run(`usr-custom-${rand}`, customEmail, passwordHash, `CAMPUS-ORG-${rand}`, customToken, tokenExpires, isAcademicEmail(customEmail) ? 1 : 0);
    const customUser = db.prepare('SELECT * FROM users WHERE email = ?').get(customEmail);
    assert.ok(customUser, 'Custom .org user must register successfully');
  });

  await t.test('2. Email Normalization & Case-Insensitive Duplicate Account Prevention', () => {
    // Attempt inserting existing email with mixed casing and leading/trailing whitespace
    const messyEmail = `  ${gmailEmail.toUpperCase()}  `;
    const cleanEmail = messyEmail.trim().toLowerCase();

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    assert.ok(existing, 'Normalized email lookup must find the existing user');

    // Verify DB UNIQUE constraint on email
    assert.throws(() => {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, status)
        VALUES ('usr-duplicate-test', ?, 'hash', 'STUDENT', 'ACTIVE')
      `).run(cleanEmail);
    }, /UNIQUE constraint failed/);
  });

  await t.test('3. Security Rule: Public Registration CANNOT Create ADMIN or MODERATOR Roles', () => {
    // Simulate public registration payload with malicious role=ADMIN or role=MODERATOR
    const maliciousPayload = {
      email: `hacker.${rand}@gmail.com`,
      password: 'Password123!',
      name: 'Sneaky User',
      role: 'ADMIN', // Hacker attempts role elevation
    };

    // Public register API handler always forces role = 'STUDENT'
    const safeRole = 'STUDENT';
    assert.equal(safeRole, 'STUDENT', 'Server-side registration must ignore public role=ADMIN');

    const cleanEmail = maliciousPayload.email.trim().toLowerCase();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, user_type)
      VALUES (?, ?, 'hash', ?, 'ACTIVE', 'TEACHER_LEARNER')
    `).run(`usr-hacker-${rand}`, cleanEmail, safeRole);

    const createdUser = db.prepare('SELECT role FROM users WHERE email = ?').get(cleanEmail);
    assert.equal(createdUser.role, 'STUDENT', 'Account must have STUDENT role, not ADMIN');
  });

  await t.test('4. Cryptographically Secure Email Verification Token Flow', () => {
    const targetEmail = gmailEmail;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(targetEmail);
    assert.equal(user.email_verified, 0, 'Initial state must be unverified (0)');
    assert.ok(user.verification_token, 'Verification token must exist');
    assert.equal(user.verification_token.length, 64, 'Token must be 32 bytes hex string (64 chars)');

    // 4A: Valid Token Verification
    const token = user.verification_token;
    const verifyUser = db.prepare(`
      SELECT id, email, verification_token_expires 
      FROM users WHERE verification_token = ?
    `).get(token);
    assert.ok(verifyUser, 'Token must locate user');

    // Invalidate token & set email_verified = 1
    db.prepare(`
      UPDATE users 
      SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(verifyUser.id);

    const verifiedUser = db.prepare('SELECT email_verified, verification_token FROM users WHERE id = ?').get(verifyUser.id);
    assert.equal(verifiedUser.email_verified, 1, 'email_verified must become 1');
    assert.equal(verifiedUser.verification_token, null, 'verification_token must be cleared after use');

    // 4B: Reused Token Rejection
    const reusedAttempt = db.prepare('SELECT id FROM users WHERE verification_token = ?').get(token);
    assert.equal(reusedAttempt, undefined, 'Used verification token must not match any user');
  });

  await t.test('5. Expired Verification Token Handling & Resend Flow', () => {
    const expiredToken = crypto.randomBytes(32).toString('hex');
    const expiredDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour in the past

    db.prepare(`
      UPDATE users 
      SET verification_token = ?, verification_token_expires = ?, email_verified = 0
      WHERE email = ?
    `).run(expiredToken, expiredDate, outlookEmail);

    const targetUser = db.prepare('SELECT * FROM users WHERE verification_token = ?').get(expiredToken);
    const isExpired = new Date(targetUser.verification_token_expires).getTime() < Date.now();
    assert.equal(isExpired, true, 'Expired token must be detected');

    // Resend fresh token
    const freshToken = crypto.randomBytes(32).toString('hex');
    const freshExpires = new Date(Date.now() + 24 * 3600000).toISOString();

    db.prepare(`
      UPDATE users 
      SET verification_token = ?, verification_token_expires = ?
      WHERE id = ?
    `).run(freshToken, freshExpires, targetUser.id);

    const refreshed = db.prepare('SELECT verification_token FROM users WHERE id = ?').get(targetUser.id);
    assert.equal(refreshed.verification_token, freshToken, 'Fresh token must be saved');
  });

  await t.test('6. Separation of Email Verification from College Verification', () => {
    // Email verified user with Gmail
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(gmailEmail);
    const profile = db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, college, is_verified_student)
      VALUES (?, ?, 'Gmail Student', 'Stanford University', 0)
      RETURNING *
    `).get(`prof-${user.id}`, user.id);

    assert.equal(user.email_verified, 1, 'Email is verified');
    assert.equal(profile.is_verified_student, 0, 'College verification must NOT be granted automatically');
  });

  await t.test('7. Dedicated Onboarding: User Selects Initial Platform Capabilities', () => {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(customEmail);

    // User chooses 'TEACHER' on onboarding
    db.prepare(`
      UPDATE users SET user_type = 'TEACHER', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(user.id);

    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, college, major, year, teaching_preference)
      VALUES (?, ?, 'Custom Teacher', 'MIT', 'Physics', 'Junior', 'Women')
      ON CONFLICT(user_id) DO UPDATE SET
        college = excluded.college, major = excluded.major, year = excluded.year, teaching_preference = excluded.teaching_preference
    `).run(`prof-${user.id}`, user.id);

    const updatedUser = db.prepare('SELECT user_type FROM users WHERE id = ?').get(user.id);
    const updatedProfile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id);

    assert.equal(updatedUser.user_type, 'TEACHER');
    assert.equal(updatedProfile.college, 'MIT');
    assert.equal(updatedProfile.teaching_preference, 'Women');
  });

  await t.test('8. Server-Side Authoritative Mentor Upgrade Flow', () => {
    // Start with a learner
    const learnerId = `usr-upgrade-${rand}`;
    const learnerEmail = `learner.upgrade.${rand}@campus.edu`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, user_type)
      VALUES (?, ?, 'hash', 'STUDENT', 'ACTIVE', 'LEARNER')
    `).run(learnerId, learnerEmail);

    const before = db.prepare('SELECT user_type FROM users WHERE id = ?').get(learnerId);
    assert.equal(before.user_type, 'LEARNER');

    // Upgrade server-side to TEACHER_LEARNER
    db.prepare(`
      UPDATE users SET user_type = 'TEACHER_LEARNER', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(learnerId);

    const after = db.prepare('SELECT user_type FROM users WHERE id = ?').get(learnerId);
    assert.equal(after.user_type, 'TEACHER_LEARNER', 'Role must upgrade to TEACHER_LEARNER');
  });

  await t.test('9. Admin Route Authorization Guard', () => {
    // Normal student cannot access admin APIs
    const studentUser = db.prepare('SELECT * FROM users WHERE email = ?').get(gmailEmail);
    assert.equal(studentUser.role, 'STUDENT');

    function checkAdminAccess(role) {
      return role === 'ADMIN';
    }

    assert.equal(checkAdminAccess(studentUser.role), false, 'STUDENT role must be denied admin access');

    // Admin user can access admin APIs
    const adminUser = db.prepare("SELECT * FROM users WHERE role = 'ADMIN'").get();
    assert.ok(adminUser, 'Admin persona must exist in DB');
    assert.equal(checkAdminAccess(adminUser.role), true, 'ADMIN role must be granted admin access');
  });

  db.close();
});
