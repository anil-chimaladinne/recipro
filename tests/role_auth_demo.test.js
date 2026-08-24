const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbPath = path.join(__dirname, '..', 'data', 'skillswap.db');

test.before(() => {
  // Run real project seed script
  execSync('node scripts/seed.js', { cwd: path.join(__dirname, '..') });
});

// 1. UI CLEANLINESS: No demo credentials exposed in login page code
test('1. UI Cleanliness: No Demo Credentials or quick login buttons in LoginPage source', () => {
  const loginCode = fs.readFileSync(path.join(__dirname, '../src/app/login/page.tsx'), 'utf8');
  assert.strictEqual(loginCode.includes('Password123!'), false, 'Plaintext password must not be in LoginPage');
  assert.strictEqual(loginCode.includes('DEMO_ACCOUNTS'), false, 'DEMO_ACCOUNTS array must not be in LoginPage');
  assert.strictEqual(loginCode.includes('Use Credentials'), false, 'No Use Credentials button in LoginPage');

  // Verify Navbar also has no demo switchers
  const navbarCode = fs.readFileSync(path.join(__dirname, '../src/components/Navbar.tsx'), 'utf8');
  assert.strictEqual(navbarCode.includes('Switch Campus Persona'), false, 'No persona switcher in Navbar');
  assert.strictEqual(navbarCode.includes('demoPersonas'), false, 'No demoPersonas array in Navbar');
});

// 2. DATABASE DEMO USERS EXIST AND ARE SECURELY HASHED
test('2. Seeded Database Users: Exist, roles correct, passwords hashed with bcrypt', async () => {
  const db = new Database(dbPath, { readonly: true });
  const users = db.prepare('SELECT id, email, password_hash, role, user_type FROM users').all();
  assert.ok(users.length >= 8, 'At least 8 personas seeded');

  // Verify bcrypt hashes for seeded demo accounts
  const seededEmails = [
    'ananya.reddy@campus.edu',
    'rahul.reddy@campus.edu',
    'sai.kiran@campus.edu',
    'sravani@campus.edu',
    'keerthana.rao@campus.edu',
    'bhavya.reddy@campus.edu',
    'vamsi.krishna@campus.edu',
    'pavan.kumar@campus.edu',
    'moderator.sirisha@campus.edu',
    'admin@skillswap.campus.edu',
  ];

  for (const email of seededEmails) {
    const u = users.find(user => user.email === email);
    assert.ok(u, `Seeded user ${email} must exist`);
    assert.ok(u.password_hash.startsWith('$2a$') || u.password_hash.startsWith('$2b$'), 'Password hash must be bcrypt');
    const valid = await bcrypt.compare('Password123!', u.password_hash);
    assert.strictEqual(valid, true, `Password123! must match for ${u.email}`);
  }

  // Student Only Persona: Ananya Reddy
  const ananya = users.find(u => u.email === 'ananya.reddy@campus.edu');
  assert.ok(ananya, 'Ananya Reddy exists');
  assert.strictEqual(ananya.user_type, 'LEARNER');
  assert.strictEqual(ananya.role, 'STUDENT');

  // Mentor Only Persona: Rahul Reddy
  const rahul = users.find(u => u.email === 'rahul.reddy@campus.edu');
  assert.ok(rahul, 'Rahul Reddy exists');
  assert.strictEqual(rahul.user_type, 'TEACHER');
  assert.strictEqual(rahul.role, 'STUDENT');

  // Mentor + Student: Sai Kiran
  const saikiran = users.find(u => u.email === 'sai.kiran@campus.edu');
  assert.ok(saikiran, 'Sai Kiran exists');
  assert.strictEqual(saikiran.user_type, 'TEACHER_LEARNER');
  assert.strictEqual(saikiran.role, 'STUDENT');

  // Admin User: Srinivas Rao / Admin
  const admin = users.find(u => u.email === 'admin@skillswap.campus.edu');
  assert.ok(admin, 'Admin exists');
  assert.strictEqual(admin.role, 'ADMIN');

  db.close();
});

// 3. PYTHON VERIFICATION SCENARIOS
test('3. Python Verification Scenarios: Verified vs Pending mentors in database', () => {
  const db = new Database(dbPath, { readonly: true });
  const pythonSkills = db.prepare(`
    SELECT usk.user_id, u.email, usk.proficiency, usk.verification_status, usk.assessment_score
    FROM user_skills usk
    JOIN users u ON usk.user_id = u.id
    WHERE usk.skill_id = 'skill-python'
  `).all();

  assert.ok(pythonSkills.length >= 3, 'At least 3 Python mentors');

  const rahulSkill = pythonSkills.find(s => s.email === 'rahul.reddy@campus.edu');
  assert.strictEqual(rahulSkill.verification_status, 'PLATFORM_VERIFIED');
  assert.strictEqual(rahulSkill.assessment_score, 95.0);

  const saiSkill = pythonSkills.find(s => s.email === 'sai.kiran@campus.edu');
  assert.strictEqual(saiSkill.verification_status, 'ASSESSMENT_VERIFIED');

  const sravaniSkill = pythonSkills.find(s => s.email === 'sravani@campus.edu');
  assert.strictEqual(sravaniSkill.verification_status, 'SELF_DECLARED');

  db.close();
});

// 4. SMART SLOT FINDER DEMO DATA: Existing session blocks 5-6 PM on Monday for Rahul Reddy
test('4. Smart Slot Availability: Rahul Reddy has 5-6 PM blocked session leaving 6-8 PM open', () => {
  const db = new Database(dbPath, { readonly: true });
  const rahulSlots = db.prepare(`
    SELECT day_of_week, start_time, end_time FROM availability_slots WHERE user_id = 'usr-rahul'
  `).all();
  assert.ok(rahulSlots.some(s => s.day_of_week === 'Monday' && s.start_time === '17:00' && s.end_time === '20:00'));

  const blockedSession = db.prepare(`
    SELECT id, teacher_id, scheduled_start, scheduled_end, status FROM sessions WHERE id = 'sess-rahul-blocked-1'
  `).get();
  assert.ok(blockedSession, 'Blocked session exists for Rahul Reddy');
  assert.strictEqual(blockedSession.status, 'SCHEDULED');
  assert.ok(blockedSession.scheduled_start.includes('T17:00:00Z'));
  assert.ok(blockedSession.scheduled_end.includes('T18:00:00Z'));

  db.close();
});

// 5. PYTHON LEARNER REQUEST SCENARIOS
test('5. Learner Requests: Ananya Reddy & Pavan Kumar have real OPEN Python requests in DB', () => {
  const db = new Database(dbPath, { readonly: true });
  const requests = db.prepare(`
    SELECT sr.id, sr.learner_id, u.email, sr.skill_id, sr.status, sr.urgency
    FROM skill_requests sr
    JOIN users u ON sr.learner_id = u.id
    WHERE sr.skill_id = 'skill-python'
  `).all();

  assert.ok(requests.length >= 2, 'At least 2 Python requests');
  assert.ok(requests.some(r => r.email === 'ananya.reddy@campus.edu' && r.status === 'OPEN'));
  assert.ok(requests.some(r => r.email === 'pavan.kumar@campus.edu' && r.status === 'OPEN'));

  db.close();
});

// 6. IDEMPOTENT SEED EXECUTION
test('6. Idempotency: Re-running seed produces zero duplicate users or skills', () => {
  const db1 = new Database(dbPath, { readonly: true });
  const initialUsers = db1.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const initialSkills = db1.prepare('SELECT COUNT(*) as count FROM skills').get().count;
  db1.close();

  // Run second time
  execSync('node scripts/seed.js', { cwd: path.join(__dirname, '..') });

  const db2 = new Database(dbPath, { readonly: true });
  const afterUsers = db2.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const afterSkills = db2.prepare('SELECT COUNT(*) as count FROM skills').get().count;
  db2.close();

  assert.strictEqual(initialUsers, afterUsers, 'User count must remain identical');
  assert.strictEqual(initialSkills, afterSkills, 'Skill count must remain identical');
});
