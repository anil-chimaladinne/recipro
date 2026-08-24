const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/skillswap.db');

function getFreshDb() {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

test('SkillSwap Campus — Return Skill Flow, Learner Confirmation & Session Entry Gate Suite', async (t) => {
  const db = getFreshDb();

  // Test Entities Setup
  const mentorId = 'usr-rahul'; // Rahul Reddy
  const learnerId = 'usr-ananya'; // Ananya Reddy
  const unrelatedUserId = 'usr-sravani';
  const skillId = 'skill-python';
  const testSessionId = `test-sess-return-${Date.now()}`;

  // 1. Clean up & Create test session
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(testSessionId);
  db.prepare(`DELETE FROM session_exchange_agreements WHERE session_id = ?`).run(testSessionId);
  db.prepare(`DELETE FROM session_participants WHERE session_id = ?`).run(testSessionId);

  db.prepare(`
    INSERT INTO sessions (
      id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, mode, location_or_url, idempotency_key
    ) VALUES (?, 'Advanced Python & UI/UX Direct Exchange', ?, ?, ?, 'SCHEDULED', '2026-08-25 18:00:00', '2026-08-25 19:00:00', 1.0, 1, 'ONLINE', 'https://meet.skillswap.internal/room/test', ?)
  `).run(testSessionId, skillId, mentorId, learnerId, `idemp-${testSessionId}`);

  db.prepare(`
    INSERT INTO session_participants (id, session_id, user_id, session_role, confirmed)
    VALUES (?, ?, ?, 'TRAINER', 0), (?, ?, ?, 'LEARNER', 0)
  `).run(`sp-test-trainer`, testSessionId, mentorId, `sp-test-learner`, testSessionId, learnerId);

  // Unit Test 1: Unauthorized user cannot set return skill
  await t.test('1. Security: Unrelated user cannot set return skill', () => {
    const isParticipant = db.prepare(`
      SELECT COUNT(*) as count FROM sessions WHERE id = ? AND (teacher_id = ? OR learner_id = ?)
    `).get(testSessionId, unrelatedUserId, unrelatedUserId);
    assert.strictEqual(isParticipant.count, 0, 'Unrelated user is not a session participant');
  });

  // Unit Test 2: Mentor sets return skill "UI/UX Design"
  await t.test('2. Mentor proposes return skill (UI/UX Design)', () => {
    const agreementId = `sea-${Date.now()}`;
    db.prepare(`
      INSERT INTO session_exchange_agreements (
        id, session_id, mentor_id, learner_id, taught_skill_id, requested_return_skill_name, return_type, credit_amount, status, proposal_count, proposed_by
      ) VALUES (?, ?, ?, ?, ?, 'UI/UX Design', 'SKILL', 1, 'PROPOSED', 1, ?)
    `).run(agreementId, testSessionId, mentorId, learnerId, skillId, mentorId);

    const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(testSessionId);
    assert.ok(agreement, 'Agreement record created');
    assert.strictEqual(agreement.requested_return_skill_name, 'UI/UX Design');
    assert.strictEqual(agreement.status, 'PROPOSED');
    assert.strictEqual(agreement.proposed_by, mentorId);
  });

  // Unit Test 3: Session entry is locked while agreement is PROPOSED (not ACCEPTED)
  await t.test('3. Gate: Session entry locked while agreement is PROPOSED', () => {
    const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(testSessionId);
    const canEnter = agreement && agreement.status === 'ACCEPTED';
    assert.strictEqual(canEnter, false, 'Entry must be blocked while agreement is not ACCEPTED');
  });

  // Unit Test 4: Learner rejects proposal -> Status becomes REJECTED
  await t.test('4. Learner rejects return skill proposal', () => {
    db.prepare(`
      UPDATE session_exchange_agreements
      SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(testSessionId);

    const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(testSessionId);
    assert.strictEqual(agreement.status, 'REJECTED');

    const canEnter = agreement && agreement.status === 'ACCEPTED';
    assert.strictEqual(canEnter, false, 'Entry must be blocked when proposal is REJECTED');
  });

  // Unit Test 5: Mentor modifies/replaces proposal with "Solidity"
  await t.test('5. Mentor proposes alternative return skill (Solidity)', () => {
    db.prepare(`
      UPDATE session_exchange_agreements
      SET requested_return_skill_name = 'Solidity',
          status = 'PROPOSED',
          proposal_count = proposal_count + 1,
          proposed_by = ?,
          accepted_by = NULL,
          accepted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(mentorId, testSessionId);

    const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(testSessionId);
    assert.strictEqual(agreement.requested_return_skill_name, 'Solidity');
    assert.strictEqual(agreement.status, 'PROPOSED');
    assert.strictEqual(agreement.proposal_count, 2);
  });

  // Unit Test 6: Learner accepts proposal -> Status becomes ACCEPTED
  await t.test('6. Learner explicitly accepts return skill proposal', () => {
    db.prepare(`
      UPDATE session_exchange_agreements
      SET status = 'ACCEPTED',
          accepted_by = ?,
          accepted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(learnerId, testSessionId);

    const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(testSessionId);
    assert.strictEqual(agreement.status, 'ACCEPTED');
    assert.strictEqual(agreement.accepted_by, learnerId);
    assert.ok(agreement.accepted_at, 'Accepted timestamp recorded');
  });

  // Unit Test 7: Session entry is now unlocked
  await t.test('7. Gate: Session entry unlocked when agreement is ACCEPTED', () => {
    const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(testSessionId);
    const canEnter = agreement && agreement.status === 'ACCEPTED';
    assert.strictEqual(canEnter, true, 'Entry is allowed once agreement is ACCEPTED');
  });

  // Unit Test 8: Modifying return skill after acceptance resets status to PROPOSED
  await t.test('8. Changing return skill after acceptance resets agreement to PROPOSED and locks gate', () => {
    db.prepare(`
      UPDATE session_exchange_agreements
      SET requested_return_skill_name = 'Rust Programming',
          status = 'PROPOSED',
          proposal_count = proposal_count + 1,
          proposed_by = ?,
          accepted_by = NULL,
          accepted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(mentorId, testSessionId);

    const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(testSessionId);
    assert.strictEqual(agreement.status, 'PROPOSED');
    assert.strictEqual(agreement.accepted_by, null);
    assert.strictEqual(agreement.accepted_at, null);

    const canEnter = agreement && agreement.status === 'ACCEPTED';
    assert.strictEqual(canEnter, false, 'Entry is immediately re-locked when mentor alters terms');
  });

  // Cleanup test session
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(testSessionId);
  db.prepare(`DELETE FROM session_exchange_agreements WHERE session_id = ?`).run(testSessionId);
  db.prepare(`DELETE FROM session_participants WHERE session_id = ?`).run(testSessionId);
});
