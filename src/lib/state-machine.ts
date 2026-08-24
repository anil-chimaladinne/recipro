import { getDb } from './db';
import crypto from 'crypto';

export type SessionState = 
  | 'REQUESTED' 
  | 'ACCEPTED' 
  | 'SCHEDULED' 
  | 'IN_PROGRESS' 
  | 'PENDING_CONFIRMATION' 
  | 'COMPLETED' 
  | 'CREDIT_SETTLED' 
  | 'DISPUTED' 
  | 'CANCELLED';

export interface TransitionResult {
  success: boolean;
  previousState: SessionState;
  newState: SessionState;
  sessionId: string;
  message: string;
  txHash?: string;
}

/**
 * Valid state transitions map
 */
const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  'REQUESTED': ['ACCEPTED', 'CANCELLED'],
  'ACCEPTED': ['SCHEDULED', 'IN_PROGRESS', 'PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED'],
  'SCHEDULED': ['IN_PROGRESS', 'PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'DISPUTED'],
  'IN_PROGRESS': ['PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'DISPUTED'],
  'PENDING_CONFIRMATION': ['COMPLETED', 'CREDIT_SETTLED', 'CANCELLED', 'DISPUTED'],
  'COMPLETED': ['CREDIT_SETTLED', 'DISPUTED'],
  'CREDIT_SETTLED': ['DISPUTED'], // Post-settlement disputes can still be submitted for investigation
  'DISPUTED': ['CREDIT_SETTLED', 'CANCELLED'], // Resolved by moderator
  'CANCELLED': [], // Terminal
};

/**
 * Reserve Learner Credits when Session is Requested
 */
export function reserveEscrowCredits(
  learnerId: string, 
  creditsAmount: number, 
  sessionId: string, 
  idempotencyKey: string
): { success: boolean; message: string } {
  const db = getDb();

  const account = db.prepare(`
    SELECT balance, escrow_balance FROM skill_credit_accounts WHERE user_id = ?
  `).get(learnerId) as { balance: number; escrow_balance: number } | undefined;

  if (!account || account.balance < creditsAmount) {
    return {
      success: false,
      message: `Insufficient Skill Credits. You have ${account?.balance || 0} credits, but ${creditsAmount} is required.`,
    };
  }

  // Atomic transaction
  const tx = db.transaction(() => {
    // Check if idempotency key already processed
    const existingTx = db.prepare(`SELECT id FROM credit_transactions WHERE idempotency_key = ?`).get(idempotencyKey);
    if (existingTx) return;

    db.prepare(`
      UPDATE skill_credit_accounts 
      SET balance = balance - ?, escrow_balance = escrow_balance + ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(creditsAmount, creditsAmount, learnerId);

    db.prepare(`
      INSERT INTO credit_transactions (
        id, reference_session_id, sender_id, receiver_id, amount, transaction_type, status, idempotency_key
      ) VALUES (?, ?, ?, NULL, ?, 'ESCROW_RESERVE', 'SETTLED', ?)
    `).run(
      `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sessionId,
      learnerId,
      creditsAmount,
      idempotencyKey
    );
  });

  tx();
  return { success: true, message: 'Credits reserved in escrow' };
}

/**
 * Refund Escrow Credits back to Learner upon Cancellation / Rejection
 */
export function refundEscrowCredits(
  learnerId: string, 
  creditsAmount: number, 
  sessionId: string, 
  reason: string
): void {
  const db = getDb();
  const idempotencyKey = `refund-${sessionId}-${Date.now()}`;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE skill_credit_accounts 
      SET balance = balance + ?, escrow_balance = MAX(0, escrow_balance - ?), updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(creditsAmount, creditsAmount, learnerId);

    db.prepare(`
      INSERT INTO credit_transactions (
        id, reference_session_id, sender_id, receiver_id, amount, transaction_type, status, idempotency_key
      ) VALUES (?, ?, NULL, ?, ?, 'ESCROW_REFUND', 'SETTLED', ?)
    `).run(
      `tx-refund-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sessionId,
      learnerId,
      creditsAmount,
      idempotencyKey
    );

    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, previous_state, new_state)
      VALUES (?, ?, 'ESCROW_REFUND', 'SESSION', ?, 'ESCROW_HELD', 'REFUNDED')
    `).run(`audit-${Date.now()}`, learnerId, sessionId);
  });

  tx();
}

/**
 * Settle Credits: Releases escrow from Learner to Teacher upon Completion
 */
export function settleSessionCredits(sessionId: string): { success: boolean; txHash: string; message: string } {
  const db = getDb();

  const session = db.prepare(`
    SELECT id, teacher_id, learner_id, credits_amount, status FROM sessions WHERE id = ?
  `).get(sessionId) as any;

  if (!session) {
    return { success: false, txHash: '', message: 'Session not found' };
  }

  if (session.status === 'CREDIT_SETTLED') {
    return { success: true, txHash: 'already_settled', message: 'Session credits have already been settled' };
  }

  const simulatedTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;
  const idempotencyKey = `settle-${sessionId}`;

  const tx = db.transaction(() => {
    // 1. Deduct from learner's escrow balance & increment lifetime spent
    db.prepare(`
      UPDATE skill_credit_accounts
      SET escrow_balance = MAX(0, escrow_balance - ?), lifetime_spent = lifetime_spent + ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(session.credits_amount, session.credits_amount, session.learner_id);

    // 2. Add to teacher's balance & increment lifetime earned
    db.prepare(`
      UPDATE skill_credit_accounts
      SET balance = balance + ?, lifetime_earned = lifetime_earned + ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(session.credits_amount, session.credits_amount, session.teacher_id);

    // 3. Record credit transaction
    db.prepare(`
      INSERT INTO credit_transactions (
        id, reference_session_id, sender_id, receiver_id, amount, transaction_type, status, idempotency_key, on_chain_tx_hash
      ) VALUES (?, ?, ?, ?, ?, 'ESCROW_RELEASE', 'SETTLED', ?, ?)
    `).run(
      `tx-settle-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      session.id,
      session.learner_id,
      session.teacher_id,
      session.credits_amount,
      idempotencyKey,
      simulatedTxHash
    );

    // 4. Update session status to CREDIT_SETTLED
    db.prepare(`
      UPDATE sessions SET status = 'CREDIT_SETTLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(sessionId);

    // 5. Update Reputations: increment sessions taught and learned
    db.prepare(`
      UPDATE reputations
      SET total_sessions_taught = total_sessions_taught + 1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(session.teacher_id);

    db.prepare(`
      UPDATE reputations
      SET total_sessions_learned = total_sessions_learned + 1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(session.learner_id);

    // 6. Record in Blockchain transactions registry
    db.prepare(`
      INSERT INTO blockchain_transactions (
        id, reference_type, reference_id, chain_id, contract_address, tx_hash, status
      ) VALUES (?, 'SESSION_SETTLEMENT', ?, 31337, '0x5FbDB2315678afecb367f032d93F642f64180aa3', ?, 'CONFIRMED')
    `).run(`bctx-${Date.now()}`, sessionId, simulatedTxHash);

    // 7. Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, previous_state, new_state)
      VALUES (?, ?, 'SETTLE_CREDITS', 'SESSION', ?, 'COMPLETED', 'CREDIT_SETTLED')
    `).run(`audit-${Date.now()}`, session.teacher_id, sessionId);

    // 8. Fulfill any linked learning requests for this learner and skill
    try {
      const linkedReq = db.prepare(`
        SELECT id FROM learning_requests
        WHERE learner_id = ? AND (skill_id = ? OR session_id = ?) AND status NOT IN ('FULFILLED', 'CANCELLED')
        LIMIT 1
      `).get(session.learner_id, session.skill_id, sessionId) as { id: string } | undefined;

      if (linkedReq) {
        db.prepare(`
          UPDATE learning_requests 
          SET status = 'FULFILLED', session_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(sessionId, linkedReq.id);

        db.prepare(`
          INSERT INTO learning_request_events (id, request_id, event_type, title, description, created_at)
          VALUES (?, ?, 'REQUEST_FULFILLED', 'Learning Request Fulfilled', 'Session completed and skill credits settled.', CURRENT_TIMESTAMP)
        `).run(`ev-${linkedReq.id}-fulfilled-${Date.now()}`, linkedReq.id);
      }
    } catch {
      // Non-fatal
    }
  });

  tx();

  // Check and evaluate if teacher qualifies for Verifiable Credential Badges!
  checkAndAwardCredentials(session.teacher_id, session.skill_id);

  return {
    success: true,
    txHash: simulatedTxHash,
    message: `1 Skill Credit successfully settled to teacher. Blockchain Proof: ${simulatedTxHash.substring(0, 10)}...`,
  };
}

/**
 * Deterministic Verifiable Credential Evaluation
 */
export function checkAndAwardCredentials(userId: string, skillId: string): void {
  const db = getDb();

  const reputation = db.prepare(`
    SELECT total_sessions_taught, bayesian_rating, reliability_score FROM reputations WHERE user_id = ?
  `).get(userId) as any;

  if (!reputation) return;

  const skill = db.prepare(`SELECT name FROM skills WHERE id = ?`).get(skillId) as { name: string } | undefined;
  const skillName = skill ? skill.name : 'General';

  // Criteria for Tier 1 Mentor: >= 3 completed teaching sessions & rating >= 4.5
  if (reputation.total_sessions_taught >= 3 && reputation.bayesian_rating >= 4.5) {
    const existingCred = db.prepare(`
      SELECT id FROM credentials WHERE user_id = ? AND badge_type = 'MENTOR_TIER_1' AND skill_id = ?
    `).get(userId, skillId);

    if (!existingCred) {
      const tokenId = `CERT-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
      const criteria = JSON.stringify({
        sessionsTaught: reputation.total_sessions_taught,
        bayesianRating: reputation.bayesian_rating,
        minSessionsRequired: 3,
        minRatingRequired: 4.5,
      });

      db.prepare(`
        INSERT INTO credentials (id, user_id, title, badge_type, skill_id, token_id, tx_hash, criteria_met)
        VALUES (?, ?, ?, 'MENTOR_TIER_1', ?, ?, ?, ?)
      `).run(
        `cred-${Date.now()}`,
        userId,
        `${skillName} Mentor — Level 1`,
        skillId,
        tokenId,
        txHash,
        criteria
      );

      // Notification
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, link)
        VALUES (?, ?, 'Verifiable Credential Earned!', ?, 'CREDENTIAL_ISSUED', '/credentials')
      `).run(
        `notif-${Date.now()}`,
        userId,
        `Congratulations! You earned the verified credential: "${skillName} Mentor — Level 1"`
      );
    }
  }
}

export const CREDIT_RATE_PER_HOUR = 1;

export function calculateRequiredCredits(durationHours: number = 1.0): number {
  return Math.max(1, Math.ceil((durationHours || 1.0) * CREDIT_RATE_PER_HOUR));
}

/**
 * Get or query exchange agreement for a session
 */
export function getExchangeAgreement(sessionId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT sea.*, 
           sk_taught.name as taught_skill_name,
           sk_return.name as return_skill_catalog_name,
           mp.display_name as mentor_name,
           lp.display_name as learner_name
    FROM session_exchange_agreements sea
    JOIN skills sk_taught ON sea.taught_skill_id = sk_taught.id
    LEFT JOIN skills sk_return ON sea.requested_return_skill_id = sk_return.id
    JOIN profiles mp ON sea.mentor_id = mp.user_id
    JOIN profiles lp ON sea.learner_id = lp.user_id
    WHERE sea.session_id = ?
  `).get(sessionId) as any;
}

/**
 * Propose Return Skill by Mentor (or counter-propose by Learner)
 */
export function proposeReturnSkill(params: {
  sessionId: string;
  actorUserId: string;
  skillName: string;
  notes?: string;
}): { success: boolean; agreement?: any; message: string } {
  const db = getDb();
  const { sessionId, actorUserId, skillName, notes } = params;

  if (!skillName || !skillName.trim()) {
    return { success: false, message: 'Return skill name is required' };
  }

  const session = db.prepare(`
    SELECT s.*, sk.name as skill_name FROM sessions s JOIN skills sk ON s.skill_id = sk.id WHERE s.id = ?
  `).get(sessionId) as any;

  if (!session) {
    return { success: false, message: 'Session not found' };
  }

  if (session.status === 'COMPLETED' || session.status === 'CANCELLED' || session.status === 'DISPUTED' || session.status === 'IN_PROGRESS') {
    return { success: false, message: `Cannot modify return skill for a session with status ${session.status}` };
  }

  const isTeacher = session.teacher_id === actorUserId;
  const isLearner = session.learner_id === actorUserId;

  if (!isTeacher && !isLearner) {
    return { success: false, message: 'Unauthorized: You are not a participant in this session' };
  }

  // Normalize / find skill in catalog (exact or substring match)
  const cleanName = skillName.trim();
  let returnSkill = db.prepare(`
    SELECT id, name FROM skills 
    WHERE LOWER(name) = LOWER(?) OR LOWER(name) LIKE ? OR ? LIKE ('%' || LOWER(name) || '%')
    ORDER BY CASE WHEN LOWER(name) = LOWER(?) THEN 0 ELSE 1 END
    LIMIT 1
  `).get(cleanName, `%${cleanName.toLowerCase()}%`, cleanName.toLowerCase(), cleanName) as any;

  if (!returnSkill) {
    const newSkillId = `skill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    db.prepare(`
      INSERT INTO skills (id, name, category, description, is_verified)
      VALUES (?, ?, 'General', ?, 1)
    `).run(newSkillId, cleanName, `Peer requested skill: ${cleanName}`);
    returnSkill = { id: newSkillId, name: cleanName };
  }

  const creditAmount = calculateRequiredCredits(session.duration_hours);
  const existing = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId) as any;

  const resultAgreement = db.transaction(() => {
    let agreementId: string;
    let newStatus: string;
    let newProposalCount: number;

    if (existing) {
      if (existing.proposal_count >= 10) {
        throw new Error('Maximum negotiation limit reached for this session.');
      }
      agreementId = existing.id;
      newStatus = isTeacher ? 'PROPOSED' : 'CHANGED';
      newProposalCount = existing.proposal_count + 1;

      db.prepare(`
        UPDATE session_exchange_agreements
        SET requested_return_skill_id = ?,
            requested_return_skill_name = ?,
            return_type = 'SKILL',
            credit_amount = ?,
            status = ?,
            proposal_count = ?,
            proposed_by = ?,
            accepted_by = NULL,
            accepted_at = NULL,
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
        VALUES (?, ?, ?, 'EXCHANGE_AGREEMENT', ?, ?, ?)
      `).run(`audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, actorUserId, isTeacher ? 'RETURN_SKILL_PROPOSED' : 'RETURN_SKILL_CHANGED', agreementId, existing.status, newStatus);
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

    // Send in-app notification to the counterparty
    const targetUserId = isTeacher ? session.learner_id : session.teacher_id;
    const actorProfile = db.prepare(`SELECT display_name FROM profiles WHERE user_id = ?`).get(actorUserId) as any;
    const actorName = actorProfile?.display_name || 'Your peer';

    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link)
      VALUES (?, ?, 'SkillSwap Return Request', ?, 'RETURN_SKILL_REQUESTED', '/sessions')
    `).run(
      `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      targetUserId,
      `${actorName} requested "${returnSkill.name}" in return for your upcoming ${session.skill_name} session.`
    );

    return db.prepare(`SELECT * FROM session_exchange_agreements WHERE id = ?`).get(agreementId);
  })();

  return {
    success: true,
    agreement: resultAgreement,
    message: `Return skill "${returnSkill.name}" proposed successfully.`,
  };
}

/**
 * Respond to Pre-Session Return Proposal
 */
export function respondToReturnProposal(params: {
  sessionId: string;
  actorUserId: string;
  action: 'ACCEPT_SKILL' | 'OFFER_CREDITS' | 'PROPOSE_ALTERNATIVE' | 'DECLINE';
  alternativeSkillName?: string;
  notes?: string;
}): { success: boolean; agreement?: any; message: string } {
  const db = getDb();
  const { sessionId, actorUserId, action, alternativeSkillName, notes } = params;

  const session = db.prepare(`
    SELECT s.*, sk.name as skill_name FROM sessions s JOIN skills sk ON s.skill_id = sk.id WHERE s.id = ?
  `).get(sessionId) as any;

  if (!session) {
    return { success: false, message: 'Session not found' };
  }

  const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId) as any;
  if (!agreement) {
    return { success: false, message: 'No exchange proposal exists for this session' };
  }

  const isTeacher = session.teacher_id === actorUserId;
  const isLearner = session.learner_id === actorUserId;

  if (!isTeacher && !isLearner) {
    return { success: false, message: 'Unauthorized: You are not a participant in this session' };
  }

  const actorProfile = db.prepare(`SELECT display_name FROM profiles WHERE user_id = ?`).get(actorUserId) as any;
  const actorName = actorProfile?.display_name || 'Your peer';
  const targetUserId = isLearner ? session.teacher_id : session.learner_id;

  if (action === 'ACCEPT_SKILL') {
    // Validate server-side: Does the return skill provider (the learner) actually have this verified teaching skill?
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
    ) as any;

    if (!verifiedSkill) {
      return {
        success: false,
        message: `Learner does not have a verified teaching skill for "${agreement.requested_return_skill_name}". Please take the skill verification assessment first or offer Skill Credits.`,
      };
    }

    db.transaction(() => {
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

      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, link)
        VALUES (?, ?, 'Return Skill Confirmed ✓', ?, 'RETURN_SKILL_ACCEPTED', '/sessions')
      `).run(
        `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        targetUserId,
        `${actorName} confirmed they will teach "${agreement.requested_return_skill_name}" in return. Exchange is confirmed!`
      );
    })();

    return {
      success: true,
      message: `Return skill exchange confirmed: ${session.skill_name} ↔ ${agreement.requested_return_skill_name}`,
    };
  }

  if (action === 'OFFER_CREDITS') {
    const requiredCredits = agreement.credit_amount || calculateRequiredCredits(session.duration_hours);
    const account = db.prepare(`SELECT balance, escrow_balance FROM skill_credit_accounts WHERE user_id = ?`).get(actorUserId) as any;

    if (!account || account.balance < requiredCredits) {
      return {
        success: false,
        message: `Insufficient Skill Credits. Required: ${requiredCredits}, Available: ${account?.balance || 0}.`,
      };
    }

    const idempotencyKey = `escrow-exchange-${sessionId}-${Date.now()}`;
    const escrowRes = reserveEscrowCredits(actorUserId, requiredCredits, sessionId, idempotencyKey);
    if (!escrowRes.success) {
      return { success: false, message: escrowRes.message };
    }

    db.transaction(() => {
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
      `).run(`audit-${Date.now()}`, actorUserId, agreement.id, agreement.status);

      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, link)
        VALUES (?, ?, 'Credit Return Confirmed ✓', ?, 'RETURN_CREDIT_OFFERED', '/sessions')
      `).run(
        `notif-${Date.now()}`,
        targetUserId,
        `${actorName} offered ${requiredCredits} Skill Credit(s) in return. Credits are safely reserved in escrow.`
      );
    })();

    return {
      success: true,
      message: `Credit exchange confirmed: ${session.skill_name} ↔ ${requiredCredits} Skill Credit(s) reserved.`,
    };
  }

  if (action === 'PROPOSE_ALTERNATIVE') {
    if (!alternativeSkillName || !alternativeSkillName.trim()) {
      return { success: false, message: 'Please specify the alternative skill you can teach.' };
    }
    return proposeReturnSkill({
      sessionId,
      actorUserId,
      skillName: alternativeSkillName,
      notes: notes || 'Counter-proposal from peer',
    });
  }

  if (action === 'DECLINE') {
    db.transaction(() => {
      db.prepare(`
        UPDATE session_exchange_agreements
        SET status = 'REJECTED',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(agreement.id);

      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, previous_state, new_state)
        VALUES (?, ?, 'RETURN_SKILL_DECLINED', 'EXCHANGE_AGREEMENT', ?, ?, 'REJECTED')
      `).run(`audit-${Date.now()}`, actorUserId, agreement.id, agreement.status);

      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, link)
        VALUES (?, ?, 'Return Skill Declined', ?, 'RETURN_SKILL_DECLINED', '/sessions')
      `).run(
        `notif-${Date.now()}`,
        targetUserId,
        `${actorName} declined the return requirement for your upcoming session.`
      );
    })();

    return {
      success: true,
      message: 'Return proposal declined.',
    };
  }

  return { success: false, message: 'Unknown action' };
}

/**
 * Main State Machine Transition Handler
 */
export function transitionSessionState(
  sessionId: string,
  targetState: SessionState,
  actorUserId: string,
  metadata?: { reason?: string; idempotencyKey?: string }
): TransitionResult {
  const db = getDb();

  const session = db.prepare(`
    SELECT * FROM sessions WHERE id = ?
  `).get(sessionId) as any;

  if (!session) {
    return {
      success: false,
      previousState: 'REQUESTED',
      newState: 'REQUESTED',
      sessionId,
      message: 'Session does not exist',
    };
  }

  const currentState = session.status as SessionState;

  // Verify actor is either teacher, learner, or moderator/admin
  const isTeacher = session.teacher_id === actorUserId;
  const isLearner = session.learner_id === actorUserId;

  const actorUser = db.prepare(`SELECT role FROM users WHERE id = ?`).get(actorUserId) as { role: string } | undefined;
  const isPrivileged = actorUser?.role === 'MODERATOR' || actorUser?.role === 'ADMIN';

  if (!isTeacher && !isLearner && !isPrivileged) {
    return {
      success: false,
      previousState: currentState,
      newState: currentState,
      sessionId,
      message: 'Unauthorized: You are not a participant in this session',
    };
  }

  // Check state machine transition validity
  const allowedNext = VALID_TRANSITIONS[currentState] || [];
  if (!allowedNext.includes(targetState) && !isPrivileged) {
    return {
      success: false,
      previousState: currentState,
      newState: currentState,
      sessionId,
      message: `Invalid state transition from ${currentState} to ${targetState}`,
    };
  }

  // Handle Specific Transition Logic
  if (targetState === 'CANCELLED') {
    // Release any escrow credits and cancel exchange agreement
    refundEscrowCredits(session.learner_id, session.credits_amount, session.id, metadata?.reason || 'Cancelled');
    db.prepare(`
      UPDATE session_exchange_agreements SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE session_id = ?
    `).run(sessionId);

    db.prepare(`
      UPDATE sessions SET status = 'CANCELLED', cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(metadata?.reason || 'Cancelled', sessionId);

    recordSessionEvent(
      sessionId,
      actorUserId,
      'CANCELLED',
      'Session Cancelled',
      metadata?.reason ? `Session cancelled. Reason: ${metadata.reason}` : 'Session was cancelled. Escrow credits refunded.',
      currentState,
      'CANCELLED',
      metadata
    );

    // Notify other participant
    const otherUserId = isTeacher ? session.learner_id : session.teacher_id;
    try {
      const { NotificationService } = require('./notifications');
      NotificationService.send(db, {
        userId: otherUserId,
        type: 'SESSION_CANCELLED',
        title: 'Session Cancelled',
        message: `The session was cancelled: ${metadata?.reason || 'Cancelled by participant'}. Any reserved credits have been refunded.`,
        relatedEntityType: 'SESSION',
        relatedEntityId: sessionId,
        actionUrl: `/sessions/${sessionId}`,
      });
    } catch {}

    return {
      success: true,
      previousState: currentState,
      newState: 'CANCELLED',
      sessionId,
      message: 'Session cancelled and credits refunded to learner',
    };
  }

  if (targetState === 'ACCEPTED') {
    if (!isTeacher && !isPrivileged) {
      return { success: false, previousState: currentState, newState: currentState, sessionId, message: 'Only the mentor can accept this session request' };
    }
    db.prepare(`UPDATE sessions SET status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);

    recordSessionEvent(
      sessionId,
      actorUserId,
      'ACCEPTED',
      'Session Accepted by Mentor',
      'The mentor has accepted the session booking request.',
      currentState,
      'ACCEPTED'
    );

    try {
      const { NotificationService } = require('./notifications');
      NotificationService.send(db, {
        userId: session.learner_id,
        type: 'SESSION_ACCEPTED',
        title: 'Session Request Accepted!',
        message: 'Your mentor accepted the session. You can now review exchange terms or enter the classroom when scheduled.',
        relatedEntityType: 'SESSION',
        relatedEntityId: sessionId,
        actionUrl: `/sessions/${sessionId}`,
      });
    } catch {}

    return { success: true, previousState: currentState, newState: 'ACCEPTED', sessionId, message: 'Session accepted by mentor' };
  }

  if (targetState === 'IN_PROGRESS') {
    // Session Start Lock: Validate that pre-session return confirmation is established and ACCEPTED
    const agreement = db.prepare(`
      SELECT * FROM session_exchange_agreements WHERE session_id = ?
    `).get(sessionId) as any;

    if (!agreement || agreement.status !== 'ACCEPTED') {
      return {
        success: false,
        previousState: currentState,
        newState: currentState,
        sessionId,
        message: 'Pre-session exchange confirmation required. The mentor and learner must confirm the return skill or credit terms before starting.',
      };
    }

    db.prepare(`UPDATE sessions SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);

    recordSessionEvent(
      sessionId,
      actorUserId,
      'STARTED',
      'Session Started Live',
      'Participants joined the live collaborative classroom.',
      currentState,
      'IN_PROGRESS'
    );

    return { success: true, previousState: currentState, newState: 'IN_PROGRESS', sessionId, message: 'Session is now live in progress' };
  }

  if (targetState === 'PENDING_CONFIRMATION' || targetState === 'COMPLETED') {
    // Record confirmation flags
    let learnerConfirmed = session.learner_confirmed;
    let teacherConfirmed = session.teacher_confirmed;

    if (isLearner) learnerConfirmed = 1;
    if (isTeacher) teacherConfirmed = 1;

    // If both confirmed (or privileged moderator overrides), mark COMPLETED & Settle Credits!
    if ((learnerConfirmed === 1 && teacherConfirmed === 1) || isPrivileged) {
      db.prepare(`
        UPDATE sessions 
        SET learner_confirmed = 1, teacher_confirmed = 1, status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(sessionId);

      const settleRes = settleSessionCredits(sessionId);

      recordSessionEvent(
        sessionId,
        actorUserId,
        'CREDITS_SETTLED',
        'Session Completed & Credits Settled',
        'Both participants confirmed completion. Escrow credits successfully transferred.',
        currentState,
        'CREDIT_SETTLED',
        { txHash: settleRes.txHash }
      );

      try {
        const { NotificationService } = require('./notifications');
        NotificationService.send(db, {
          userId: session.teacher_id,
          type: 'CREDIT_SETTLED',
          title: 'Skill Credit Earned!',
          message: `Your mentoring session is complete. ${session.credits_amount || 1} Skill Credit was added to your balance.`,
          relatedEntityType: 'CREDIT',
          relatedEntityId: sessionId,
          actionUrl: `/wallet`,
        });
        NotificationService.send(db, {
          userId: session.learner_id,
          type: 'SESSION_COMPLETED',
          title: 'Session Completed',
          message: `Your learning session has been finalized and settled. Don't forget to leave a review!`,
          relatedEntityType: 'SESSION',
          relatedEntityId: sessionId,
          actionUrl: `/sessions/${sessionId}`,
        });
      } catch {}

      return {
        success: true,
        previousState: currentState,
        newState: 'CREDIT_SETTLED',
        sessionId,
        txHash: settleRes.txHash,
        message: 'Session confirmed complete by both parties. Credits settled!',
      };
    } else {
      db.prepare(`
        UPDATE sessions 
        SET learner_confirmed = ?, teacher_confirmed = ?, status = 'PENDING_CONFIRMATION', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(learnerConfirmed, teacherConfirmed, sessionId);

      recordSessionEvent(
        sessionId,
        actorUserId,
        'CONFIRMED',
        'Completion Confirmed',
        `${isTeacher ? 'Mentor' : 'Learner'} confirmed session completion. Waiting for counterparty confirmation.`,
        currentState,
        'PENDING_CONFIRMATION'
      );

      const waitingUserId = isTeacher ? session.learner_id : session.teacher_id;
      try {
        const { NotificationService } = require('./notifications');
        NotificationService.send(db, {
          userId: waitingUserId,
          type: 'SESSION_COMPLETION_PENDING',
          title: 'Session Completion Awaiting Confirmation',
          message: 'The other participant marked the session as complete. Please confirm completion to finalize escrow settlement.',
          relatedEntityType: 'SESSION',
          relatedEntityId: sessionId,
          actionUrl: `/sessions/${sessionId}`,
        });
      } catch {}

      return {
        success: true,
        previousState: currentState,
        newState: 'PENDING_CONFIRMATION',
        sessionId,
        message: 'Your confirmation was recorded. Waiting for the other participant to confirm.',
      };
    }
  }

  if (targetState === 'DISPUTED') {
    db.prepare(`UPDATE sessions SET status = 'DISPUTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);

    recordSessionEvent(
      sessionId,
      actorUserId,
      'DISPUTED',
      'Session Flagged for Dispute',
      metadata?.reason ? `Dispute filed: ${metadata.reason}` : 'Session was flagged for dispute. Escrow credits frozen pending review.',
      currentState,
      'DISPUTED',
      metadata
    );

    return {
      success: true,
      previousState: currentState,
      newState: 'DISPUTED',
      sessionId,
      message: 'Session flagged for dispute. Escrow credits frozen pending moderator review.',
    };
  }

  return {
    success: false,
    previousState: currentState,
    newState: currentState,
    sessionId,
    message: 'Unhandled transition state',
  };
}

/**
 * Record historical session lifecycle event
 */
export function recordSessionEvent(
  sessionId: string,
  actorId: string | null,
  eventType: string,
  title: string,
  description: string,
  previousState?: string,
  newState?: string,
  metadata?: any
) {
  const db = getDb();
  const eventId = `sev-${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  try {
    db.prepare(`
      INSERT INTO session_events (
        id, session_id, actor_id, event_type, title, description, previous_state, new_state, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      eventId,
      sessionId,
      actorId,
      eventType,
      title,
      description,
      previousState || null,
      newState || null,
      JSON.stringify(metadata || {})
    );
  } catch (err) {
    console.error('Record Session Event Error:', err);
  }
}

/**
 * Get all historical session timeline events
 */
export function getSessionEvents(sessionId: string) {
  const db = getDb();
  try {
    return db.prepare(`
      SELECT se.*, p.display_name as actor_name
      FROM session_events se
      LEFT JOIN profiles p ON se.actor_id = p.user_id
      WHERE se.session_id = ?
      ORDER BY se.created_at ASC
    `).all(sessionId);
  } catch (err) {
    return [];
  }
}

/**
 * Centralized State Machine Validation Helper
 */
export function canTransition(
  currentState: SessionState,
  targetState: SessionState,
  actorRole: 'TEACHER' | 'LEARNER' | 'ADMIN'
): { allowed: boolean; reason?: string } {
  const allowedNext = VALID_TRANSITIONS[currentState] || [];
  if (!allowedNext.includes(targetState) && actorRole !== 'ADMIN') {
    return {
      allowed: false,
      reason: `Cannot transition from ${currentState} to ${targetState}`,
    };
  }

  if (targetState === 'ACCEPTED' && actorRole !== 'TEACHER' && actorRole !== 'ADMIN') {
    return { allowed: false, reason: 'Only the mentor can accept a session' };
  }

  return { allowed: true };
}
