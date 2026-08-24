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

const CREDIT_RATE_PER_HOUR = 1;
function calculateRequiredCredits(durationHours = 1.0) {
  return Math.max(1, Math.ceil((durationHours || 1.0) * CREDIT_RATE_PER_HOUR));
}

function proposeReturnSkillTest(db, params) {
  const { sessionId, actorUserId, skillName, notes } = params;
  if (!skillName || !skillName.trim()) {
    return { success: false, message: 'Return skill name is required' };
  }

  const session = db.prepare(`
    SELECT s.*, sk.name as skill_name FROM sessions s JOIN skills sk ON s.skill_id = sk.id WHERE s.id = ?
  `).get(sessionId);

  if (!session) {
    return { success: false, message: 'Session not found' };
  }

  const cleanName = skillName.trim();
  let returnSkill = db.prepare(`
    SELECT id, name FROM skills 
    WHERE LOWER(name) = LOWER(?) OR LOWER(name) LIKE ? OR ? LIKE ('%' || LOWER(name) || '%')
    ORDER BY CASE WHEN LOWER(name) = LOWER(?) THEN 0 ELSE 1 END
    LIMIT 1
  `).get(cleanName, `%${cleanName.toLowerCase()}%`, cleanName.toLowerCase(), cleanName);

  if (!returnSkill) {
    const newSkillId = `skill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    db.prepare(`
      INSERT INTO skills (id, name, category, description, is_verified)
      VALUES (?, ?, 'General', ?, 1)
    `).run(newSkillId, cleanName, `Peer requested skill: ${cleanName}`);
    returnSkill = { id: newSkillId, name: cleanName };
  }

  const creditAmount = calculateRequiredCredits(session.duration_hours);
  const existing = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId);

  let agreementId;
  let newStatus;
  let newProposalCount;

  if (existing) {
    if (existing.proposal_count >= 5) {
      return { success: false, message: 'Maximum negotiation limit reached for this session.' };
    }
    agreementId = existing.id;
    newStatus = session.teacher_id === actorUserId ? 'PROPOSED' : 'CHANGED';
    newProposalCount = existing.proposal_count + 1;

    db.prepare(`
      UPDATE session_exchange_agreements
      SET requested_return_skill_id = ?,
          requested_return_skill_name = ?,
          credit_amount = ?,
          status = ?,
          proposal_count = ?,
          proposed_by = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      returnSkill.id,
      returnSkill.name,
      creditAmount,
      newStatus,
      newProposalCount,
      actorUserId,
      notes || '',
      agreementId
    );

    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, previous_state, new_state)
      VALUES (?, ?, 'RETURN_SKILL_PROPOSED', 'EXCHANGE_AGREEMENT', ?, ?, ?)
    `).run(`audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, actorUserId, agreementId, existing.status, newStatus);
  } else {
    agreementId = `sea-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    newStatus = 'PROPOSED';
    newProposalCount = 1;

    db.prepare(`
      INSERT INTO session_exchange_agreements (
        id, session_id, mentor_id, learner_id, taught_skill_id, requested_return_skill_id, requested_return_skill_name, return_type, credit_amount, status, proposal_count, proposed_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SKILL', ?, 'PROPOSED', 1, ?, ?)
    `).run(
      agreementId,
      sessionId,
      session.teacher_id,
      session.learner_id,
      session.skill_id,
      returnSkill.id,
      returnSkill.name,
      creditAmount,
      actorUserId,
      notes || ''
    );

    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, previous_state, new_state)
      VALUES (?, ?, 'RETURN_SKILL_PROPOSED', 'EXCHANGE_AGREEMENT', ?, 'NONE', 'PROPOSED')
    `).run(`audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, actorUserId, agreementId);
  }

  const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE id = ?`).get(agreementId);
  return { success: true, agreement, message: 'Return skill proposed successfully' };
}

function respondToReturnProposalTest(db, params) {
  const { sessionId, actorUserId, action, alternativeSkillName, notes } = params;

  const session = db.prepare(`
    SELECT s.*, sk.name as skill_name FROM sessions s JOIN skills sk ON s.skill_id = sk.id WHERE s.id = ?
  `).get(sessionId);

  if (!session) return { success: false, message: 'Session not found' };

  const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId);
  if (!agreement) return { success: false, message: 'No exchange proposal exists' };

  if (action === 'ACCEPT_SKILL') {
    const reqName = agreement.requested_return_skill_name.toLowerCase();
    const skillProviderId = session.learner_id;
    const verifiedSkill = db.prepare(`
      SELECT us.* FROM user_skills us
      JOIN skills sk ON us.skill_id = sk.id
      WHERE us.user_id = ? 
        AND (
          us.skill_id = ? 
          OR LOWER(sk.name) = LOWER(?) 
          OR LOWER(sk.name) LIKE ? 
          OR ? LIKE ('%' || LOWER(sk.name) || '%')
        )
        AND us.verification_status IN ('PEER_VERIFIED', 'PLATFORM_VERIFIED', 'ASSESSMENT_VERIFIED', 'VERIFIED')
    `).get(
      skillProviderId, 
      agreement.requested_return_skill_id, 
      agreement.requested_return_skill_name,
      `%${reqName}%`,
      reqName
    );

    if (!verifiedSkill) {
      return {
        success: false,
        message: `Learner does not have a verified teaching skill for "${agreement.requested_return_skill_name}". Please take the verification assessment or offer credits.`,
      };
    }

    db.prepare(`
      UPDATE session_exchange_agreements
      SET return_type = 'SKILL',
          status = 'ACCEPTED',
          accepted_by = ?,
          accepted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(actorUserId, agreement.id);

    db.prepare(`UPDATE sessions SET status = 'SCHEDULED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);

    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, previous_state, new_state)
      VALUES (?, ?, 'RETURN_SKILL_ACCEPTED', 'EXCHANGE_AGREEMENT', ?, ?, 'ACCEPTED')
    `).run(`audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, actorUserId, agreement.id, agreement.status);

    return { success: true, message: 'Return skill exchange confirmed' };
  }

  if (action === 'OFFER_CREDITS') {
    const requiredCredits = agreement.credit_amount || calculateRequiredCredits(session.duration_hours);
    const account = db.prepare(`SELECT balance, escrow_balance FROM skill_credit_accounts WHERE user_id = ?`).get(actorUserId);

    if (!account || account.balance < requiredCredits) {
      return {
        success: false,
        message: `Insufficient Skill Credits. Required: ${requiredCredits}, Available: ${account ? account.balance : 0}.`,
      };
    }

    // Reserve credits atomically in escrow
    db.prepare(`
      UPDATE skill_credit_accounts
      SET balance = balance - ?, escrow_balance = escrow_balance + ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(requiredCredits, requiredCredits, actorUserId);

    db.prepare(`
      UPDATE session_exchange_agreements
      SET return_type = 'CREDITS',
          credit_amount = ?,
          status = 'ACCEPTED',
          accepted_by = ?,
          accepted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(requiredCredits, actorUserId, agreement.id);

    db.prepare(`
      UPDATE sessions SET credits_amount = ?, status = 'SCHEDULED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(requiredCredits, sessionId);

    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, previous_state, new_state)
      VALUES (?, ?, 'CREDIT_RESERVED', 'EXCHANGE_AGREEMENT', ?, ?, 'ACCEPTED')
    `).run(`audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, actorUserId, agreement.id, agreement.status);

    return { success: true, message: 'Credit exchange confirmed' };
  }

  if (action === 'PROPOSE_ALTERNATIVE') {
    return proposeReturnSkillTest(db, {
      sessionId,
      actorUserId,
      skillName: alternativeSkillName,
      notes: notes || 'Counter-proposal',
    });
  }

  if (action === 'DECLINE') {
    db.prepare(`
      UPDATE session_exchange_agreements SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(agreement.id);

    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, previous_state, new_state)
      VALUES (?, ?, 'RETURN_SKILL_DECLINED', 'EXCHANGE_AGREEMENT', ?, ?, 'REJECTED')
    `).run(`audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, actorUserId, agreement.id, agreement.status);

    return { success: true, message: 'Proposal declined' };
  }

  return { success: false, message: 'Unknown action' };
}

function startSessionTest(db, sessionId, actorUserId) {
  const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId);
  if (!agreement || agreement.status !== 'ACCEPTED') {
    return {
      success: false,
      message: 'Pre-session exchange confirmation required. The mentor and learner must confirm the return skill or credit terms before starting.',
    };
  }
  db.prepare(`UPDATE sessions SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);
  return { success: true, message: 'Session is now live in progress' };
}

function cancelSessionTest(db, sessionId, actorUserId, reason) {
  const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId);
  if (!session) return { success: false };

  const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId);

  // If credits were reserved, release them
  if (agreement && agreement.return_type === 'CREDITS' && agreement.status === 'ACCEPTED') {
    db.prepare(`
      UPDATE skill_credit_accounts
      SET balance = balance + ?, escrow_balance = MAX(0, escrow_balance - ?), updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(session.credits_amount, session.credits_amount, session.learner_id);
  }

  db.prepare(`UPDATE session_exchange_agreements SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE session_id = ?`).run(sessionId);
  db.prepare(`UPDATE sessions SET status = 'CANCELLED', cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(reason, sessionId);
  return { success: true, message: 'Session cancelled' };
}

test('Pre-Session Skill Return Confirmation Test Suite', async (t) => {
  const db = getFreshDb();

  const runId = Date.now();
  const rahulId = `test-rahul-${runId}`;
  const aliceId = `test-alice-${runId}`;
  const bobId = `test-bob-${runId}`;

  const pythonSkill = db.prepare(`SELECT id, name FROM skills WHERE id = 'skill-python' OR LOWER(name) LIKE '%python%'`).get();
  const soliditySkill = db.prepare(`SELECT id, name FROM skills WHERE id = 'skill-solidity' OR LOWER(name) LIKE '%solidity%'`).get();
  const reactSkill = db.prepare(`SELECT id, name FROM skills WHERE id = 'skill-react' OR LOWER(name) LIKE '%react%'`).get();

  const pythonSkillId = pythonSkill ? pythonSkill.id : 'skill-python';
  const soliditySkillId = soliditySkill ? soliditySkill.id : 'skill-solidity';
  const reactSkillId = reactSkill ? reactSkill.id : 'skill-react';

  db.exec(`
    INSERT INTO users (id, email, password_hash, role) VALUES 
    ('${rahulId}', 'rahul-${runId}@campus.edu', 'hash123', 'STUDENT'),
    ('${aliceId}', 'alice-${runId}@campus.edu', 'hash123', 'STUDENT'),
    ('${bobId}', 'bob-${runId}@campus.edu', 'hash123', 'STUDENT');

    INSERT INTO profiles (id, user_id, display_name, college) VALUES
    ('p-rahul-${runId}', '${rahulId}', 'Rahul Sharma', 'Engineering'),
    ('p-alice-${runId}', '${aliceId}', 'Alice Johnson', 'Science'),
    ('p-bob-${runId}', '${bobId}', 'Bob Martinez', 'Arts');

    INSERT INTO skill_credit_accounts (id, user_id, balance, escrow_balance) VALUES
    ('sca-rahul-${runId}', '${rahulId}', 5, 0),
    ('sca-alice-${runId}', '${aliceId}', 3, 0),
    ('sca-bob-${runId}', '${bobId}', 0, 0);

    -- Alice has verified Solidity and React skills
    INSERT INTO user_skills (id, user_id, skill_id, proficiency, verification_status) VALUES
    ('us-alice-sol-${runId}', '${aliceId}', '${soliditySkillId}', 'Advanced', 'PEER_VERIFIED'),
    ('us-rahul-py-${runId}', '${rahulId}', '${pythonSkillId}', 'Expert', 'PLATFORM_VERIFIED'),
    ('us-alice-react-${runId}', '${aliceId}', '${reactSkillId}', 'Intermediate', 'PEER_VERIFIED');
  `);

  await t.test('1. Mentor proposes return skill (Solidity) for a scheduled session', () => {
    const sessionId = `test-sess-1-${Date.now()}`;
    db.prepare(`
      INSERT INTO sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key)
      VALUES (?, 'Python Advanced Mentorship', ?, ?, ?, 'ACCEPTED', '2026-09-01 18:00:00', '2026-09-01 19:00:00', 1.0, 1, ?)
    `).run(sessionId, pythonSkillId, rahulId, aliceId, `idemp-1-${sessionId}`);

    const res = proposeReturnSkillTest(db, {
      sessionId,
      actorUserId: rahulId,
      skillName: 'Solidity',
      notes: 'I would like to learn Solidity in return.',
    });

    assert.strictEqual(res.success, true);
    assert.match(res.agreement.requested_return_skill_name, /Solidity/i);
    assert.strictEqual(res.agreement.status, 'PROPOSED');
    assert.strictEqual(res.agreement.credit_amount, 1);
  });

  await t.test('2. Learner with verified skill accepts return requirement -> Session becomes READY', () => {
    const sessionId = `test-sess-2-${Date.now()}`;
    db.prepare(`
      INSERT INTO sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key)
      VALUES (?, 'Python Advanced Mentorship', ?, ?, ?, 'ACCEPTED', '2026-09-01 18:00:00', '2026-09-01 19:00:00', 1.0, 1, ?)
    `).run(sessionId, pythonSkillId, rahulId, aliceId, `idemp-2-${sessionId}`);

    // Mentor proposes Solidity
    proposeReturnSkillTest(db, {
      sessionId,
      actorUserId: rahulId,
      skillName: 'Solidity',
    });

    // Alice accepts with verified Solidity skill
    const respondRes = respondToReturnProposalTest(db, {
      sessionId,
      actorUserId: aliceId,
      action: 'ACCEPT_SKILL',
    });

    assert.strictEqual(respondRes.success, true);

    const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId);
    assert.strictEqual(agreement.status, 'ACCEPTED');
    assert.strictEqual(agreement.return_type, 'SKILL');
    assert.strictEqual(agreement.accepted_by, aliceId);

    // Session can now start
    const startRes = startSessionTest(db, sessionId, rahulId);
    assert.strictEqual(startRes.success, true);
  });

  await t.test('3. Learner without verified skill is REJECTED from falsely claiming they can teach it', () => {
    const sessionId = `test-sess-3-${Date.now()}`;
    // Bob has no verified Solidity skill
    db.prepare(`
      INSERT INTO sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key)
      VALUES (?, 'Python Advanced Mentorship', ?, ?, ?, 'ACCEPTED', '2026-09-01 18:00:00', '2026-09-01 19:00:00', 1.0, 1, ?)
    `).run(sessionId, pythonSkillId, rahulId, bobId, `idemp-3-${sessionId}`);

    proposeReturnSkillTest(db, {
      sessionId,
      actorUserId: rahulId,
      skillName: 'Solidity',
    });

    // Bob tries to accept Solidity
    const respondRes = respondToReturnProposalTest(db, {
      sessionId,
      actorUserId: bobId,
      action: 'ACCEPT_SKILL',
    });

    assert.strictEqual(respondRes.success, false);
    assert.match(respondRes.message, /verified teaching skill/i);

    const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId);
    assert.strictEqual(agreement.status, 'PROPOSED'); // Unchanged
  });

  await t.test('4. Learner chooses Offer Skill Credits -> Credits reserved in escrow', () => {
    const sessionId = `test-sess-4-${Date.now()}`;
    db.prepare(`
      INSERT INTO sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key)
      VALUES (?, 'Python 2-Hour Intensive', ?, ?, ?, 'ACCEPTED', '2026-09-01 18:00:00', '2026-09-01 20:00:00', 2.0, 2, ?)
    `).run(sessionId, pythonSkillId, rahulId, aliceId, `idemp-4-${sessionId}`);

    proposeReturnSkillTest(db, {
      sessionId,
      actorUserId: rahulId,
      skillName: 'Solidity',
    });

    const prevAlice = db.prepare(`SELECT balance, escrow_balance FROM skill_credit_accounts WHERE user_id = ?`).get(aliceId);

    // Alice chooses to offer 2 Skill Credits
    const respondRes = respondToReturnProposalTest(db, {
      sessionId,
      actorUserId: aliceId,
      action: 'OFFER_CREDITS',
    });

    assert.strictEqual(respondRes.success, true);

    const newAlice = db.prepare(`SELECT balance, escrow_balance FROM skill_credit_accounts WHERE user_id = ?`).get(aliceId);
    assert.strictEqual(newAlice.balance, prevAlice.balance - 2);
    assert.strictEqual(newAlice.escrow_balance, prevAlice.escrow_balance + 2);

    const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId);
    assert.strictEqual(agreement.status, 'ACCEPTED');
    assert.strictEqual(agreement.return_type, 'CREDITS');
    assert.strictEqual(agreement.credit_amount, 2);
  });

  await t.test('5. Insufficient credit balance is rejected', () => {
    const sessionId = `test-sess-5-${Date.now()}`;
    // Bob has 0 credits
    db.prepare(`
      INSERT INTO sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key)
      VALUES (?, 'Python 1-Hour Session', ?, ?, ?, 'ACCEPTED', '2026-09-01 18:00:00', '2026-09-01 19:00:00', 1.0, 1, ?)
    `).run(sessionId, pythonSkillId, rahulId, bobId, `idemp-5-${sessionId}`);

    proposeReturnSkillTest(db, {
      sessionId,
      actorUserId: rahulId,
      skillName: 'Solidity',
    });

    const respondRes = respondToReturnProposalTest(db, {
      sessionId,
      actorUserId: bobId,
      action: 'OFFER_CREDITS',
    });

    assert.strictEqual(respondRes.success, false);
    assert.match(respondRes.message, /Insufficient Skill Credits/i);
  });

  await t.test('6. Session start is locked if exchange agreement is unconfirmed', () => {
    const sessionId = `test-sess-6-${Date.now()}`;
    db.prepare(`
      INSERT INTO sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key)
      VALUES (?, 'Python Unconfirmed Session', ?, ?, ?, 'ACCEPTED', '2026-09-01 18:00:00', '2026-09-01 19:00:00', 1.0, 1, ?)
    `).run(sessionId, pythonSkillId, rahulId, aliceId, `idemp-6-${sessionId}`);

    const startRes = startSessionTest(db, sessionId, rahulId);
    assert.strictEqual(startRes.success, false);
    assert.match(startRes.message, /Pre-session exchange confirmation required/i);
  });

  await t.test('7. Cancelling session releases reserved escrow credits and marks agreement CANCELLED', () => {
    const sessionId = `test-sess-7-${Date.now()}`;
    db.prepare(`
      INSERT INTO sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key)
      VALUES (?, 'Python Cancelled Session', ?, ?, ?, 'ACCEPTED', '2026-09-01 18:00:00', '2026-09-01 19:00:00', 1.0, 1, ?)
    `).run(sessionId, pythonSkillId, rahulId, aliceId, `idemp-7-${sessionId}`);

    proposeReturnSkillTest(db, { sessionId, actorUserId: rahulId, skillName: 'Solidity' });
    respondToReturnProposalTest(db, { sessionId, actorUserId: aliceId, action: 'OFFER_CREDITS' });

    const aliceBeforeCancel = db.prepare(`SELECT balance, escrow_balance FROM skill_credit_accounts WHERE user_id = ?`).get(aliceId);

    // Cancel session
    const cancelRes = cancelSessionTest(db, sessionId, rahulId, 'Student rescheduled');
    assert.strictEqual(cancelRes.success, true);

    const aliceAfterCancel = db.prepare(`SELECT balance, escrow_balance FROM skill_credit_accounts WHERE user_id = ?`).get(aliceId);
    assert.strictEqual(aliceAfterCancel.balance, aliceBeforeCancel.balance + 1); // Refunded
    assert.strictEqual(aliceAfterCancel.escrow_balance, aliceBeforeCancel.escrow_balance - 1);

    const agreement = db.prepare(`SELECT status FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId);
    assert.strictEqual(agreement.status, 'CANCELLED');
  });

  await t.test('8. Counter-proposal / negotiation flow and proposal limit guard', () => {
    const sessionId = `test-sess-8-${Date.now()}`;
    db.prepare(`
      INSERT INTO sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key)
      VALUES (?, 'Python Negotiation Session', ?, ?, ?, 'ACCEPTED', '2026-09-01 18:00:00', '2026-09-01 19:00:00', 1.0, 1, ?)
    `).run(sessionId, pythonSkillId, rahulId, aliceId, `idemp-8-${sessionId}`);

    // 1. Rahul proposes Solidity
    proposeReturnSkillTest(db, { sessionId, actorUserId: rahulId, skillName: 'Solidity' });

    // 2. Alice counter-proposes React
    const counterRes = respondToReturnProposalTest(db, {
      sessionId,
      actorUserId: aliceId,
      action: 'PROPOSE_ALTERNATIVE',
      alternativeSkillName: 'React',
    });

    assert.strictEqual(counterRes.success, true);
    let agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId);
    assert.match(agreement.requested_return_skill_name, /React/i);
    assert.strictEqual(agreement.status, 'CHANGED');
    assert.strictEqual(agreement.proposal_count, 2);

    // 3. Rahul accepts React
    const acceptRes = respondToReturnProposalTest(db, {
      sessionId,
      actorUserId: rahulId,
      action: 'ACCEPT_SKILL',
    });

    assert.strictEqual(acceptRes.success, true);
    agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId);
    assert.strictEqual(agreement.status, 'ACCEPTED');
    assert.strictEqual(agreement.return_type, 'SKILL');
  });
});
