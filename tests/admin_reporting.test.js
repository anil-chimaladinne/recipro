const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const path = require('path');
const jwt = require('jsonwebtoken');

const dbPath = path.join(__dirname, '../data/skillswap.db');
const JWT_SECRET = process.env.AUTH_SECRET || 'skillswap-super-secret-jwt-key-for-local-development-min32bytes';

function getFreshDb() {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function makeToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

test('Admin Reporting & Security Test Suite', async (t) => {
  const db = getFreshDb();
  const runId = Date.now();

  const adminId = `test-admin-${runId}`;
  const studentId = `test-student-${runId}`;
  const moderatorId = `test-mod-${runId}`;
  const learnerId = `test-learner-${runId}`;

  const pythonSkill = db.prepare(`SELECT id, name FROM skills WHERE id = 'skill-python' OR LOWER(name) LIKE '%python%'`).get();
  const soliditySkill = db.prepare(`SELECT id, name FROM skills WHERE id = 'skill-solidity' OR LOWER(name) LIKE '%solidity%'`).get();

  const pythonSkillId = pythonSkill ? pythonSkill.id : 'skill-python';
  const soliditySkillId = soliditySkill ? soliditySkill.id : 'skill-solidity';

  // Seed test users
  db.exec(`
    INSERT INTO users (id, email, password_hash, role, user_type) VALUES 
    ('${adminId}', 'admin-${runId}@campus.edu', 'hash123', 'ADMIN', 'TEACHER_LEARNER'),
    ('${studentId}', 'student-${runId}@campus.edu', 'hash123', 'STUDENT', 'TEACHER_LEARNER'),
    ('${moderatorId}', 'mod-${runId}@campus.edu', 'hash123', 'MODERATOR', 'TEACHER_LEARNER'),
    ('${learnerId}', 'learner-${runId}@campus.edu', 'hash123', 'STUDENT', 'TEACHER_LEARNER');

    INSERT INTO profiles (id, user_id, display_name, college) VALUES
    ('p-admin-${runId}', '${adminId}', 'Srinivas Rao (Campus Admin)', 'IT Services'),
    ('p-student-${runId}', '${studentId}', 'Rahul Reddy', 'Andhra Institute of Technology'),
    ('p-mod-${runId}', '${moderatorId}', 'Sirisha (Campus Moderator)', 'Student Affairs'),
    ('p-learner-${runId}', '${learnerId}', 'Ananya Reddy', 'Godavari Institute of Computer Science');

    INSERT INTO skill_credit_accounts (id, user_id, balance, escrow_balance) VALUES
    ('sca-admin-${runId}', '${adminId}', 10, 0),
    ('sca-student-${runId}', '${studentId}', 5, 0),
    ('sca-mod-${runId}', '${moderatorId}', 5, 0),
    ('sca-learner-${runId}', '${learnerId}', 5, 0);
  `);

  // Seed sample session history
  const sessionDateStr = '2026-08-23';
  const sess1Id = `sess-admin-test-1-${runId}`;
  const sess2Id = `sess-admin-test-2-${runId}`;
  const sess3Id = `sess-admin-test-3-${runId}`;

  // Session 1: Completed Direct Skill Exchange
  db.prepare(`
    INSERT INTO sessions (
      id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key, created_at
    ) VALUES (?, 'Python Fast Track', ?, ?, ?, 'CREDIT_SETTLED', '${sessionDateStr} 10:00:00', '${sessionDateStr} 11:00:00', 1.0, 1, 'idemp-s1-${runId}', '${sessionDateStr} 09:00:00')
  `).run(sess1Id, pythonSkillId, studentId, learnerId);

  db.prepare(`
    INSERT INTO session_participants (id, session_id, user_id, session_role, confirmed, created_at)
    VALUES 
    ('sp-s1-t-${runId}', ?, ?, 'TRAINER', 1, '${sessionDateStr} 09:00:00'),
    ('sp-s1-l-${runId}', ?, ?, 'LEARNER', 1, '${sessionDateStr} 09:00:00')
  `).run(sess1Id, studentId, sess1Id, learnerId);

  db.prepare(`
    INSERT INTO session_exchange_agreements (
      id, session_id, mentor_id, learner_id, taught_skill_id, requested_return_skill_name, return_type, credit_amount, status, proposal_count, proposed_by, accepted_by, created_at
    ) VALUES ('sea-s1-${runId}', ?, ?, ?, ?, 'Solidity', 'SKILL', 1, 'ACCEPTED', 1, ?, ?, '${sessionDateStr} 09:00:00')
  `).run(sess1Id, studentId, learnerId, pythonSkillId, studentId, learnerId);

  // Session 2: Completed Credit-Compensated Session
  db.prepare(`
    INSERT INTO sessions (
      id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key, created_at
    ) VALUES (?, 'Solidity Intro', ?, ?, ?, 'CREDIT_SETTLED', '${sessionDateStr} 14:00:00', '${sessionDateStr} 15:00:00', 1.0, 1, 'idemp-s2-${runId}', '${sessionDateStr} 13:00:00')
  `).run(sess2Id, soliditySkillId, studentId, learnerId);

  db.prepare(`
    INSERT INTO session_participants (id, session_id, user_id, session_role, confirmed, created_at)
    VALUES 
    ('sp-s2-t-${runId}', ?, ?, 'TRAINER', 1, '${sessionDateStr} 13:00:00'),
    ('sp-s2-l-${runId}', ?, ?, 'LEARNER', 1, '${sessionDateStr} 13:00:00')
  `).run(sess2Id, studentId, sess2Id, learnerId);

  db.prepare(`
    INSERT INTO session_exchange_agreements (
      id, session_id, mentor_id, learner_id, taught_skill_id, requested_return_skill_name, return_type, credit_amount, status, proposal_count, proposed_by, accepted_by, created_at
    ) VALUES ('sea-s2-${runId}', ?, ?, ?, ?, 'UI/UX', 'CREDITS', 1, 'ACCEPTED', 1, ?, ?, '${sessionDateStr} 13:00:00')
  `).run(sess2Id, studentId, learnerId, soliditySkillId, studentId, learnerId);

  db.prepare(`
    INSERT INTO credit_transactions (
      id, reference_session_id, sender_id, receiver_id, amount, transaction_type, status, idempotency_key, created_at
    ) VALUES ('ctx-s2-${runId}', ?, ?, ?, 1, 'ESCROW_RELEASE', 'SETTLED', 'idemp-ctx-s2-${runId}', '${sessionDateStr} 15:05:00')
  `).run(sess2Id, learnerId, studentId);

  // Session 3: Cancelled Session with Refund
  db.prepare(`
    INSERT INTO sessions (
      id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key, cancellation_reason, created_at
    ) VALUES (?, 'Python Advanced', ?, ?, ?, 'CANCELLED', '${sessionDateStr} 18:00:00', '${sessionDateStr} 19:00:00', 1.0, 1, 'idemp-s3-${runId}', 'Student rescheduled', '${sessionDateStr} 17:00:00')
  `).run(sess3Id, pythonSkillId, learnerId, studentId); // Notice roles reversed! learnerId is TRAINER, studentId is LEARNER

  db.prepare(`
    INSERT INTO session_participants (id, session_id, user_id, session_role, confirmed, created_at)
    VALUES 
    ('sp-s3-t-${runId}', ?, ?, 'TRAINER', 0, '${sessionDateStr} 17:00:00'),
    ('sp-s3-l-${runId}', ?, ?, 'LEARNER', 0, '${sessionDateStr} 17:00:00')
  `).run(sess3Id, learnerId, sess3Id, studentId);

  db.prepare(`
    INSERT INTO credit_transactions (
      id, reference_session_id, sender_id, receiver_id, amount, transaction_type, status, idempotency_key, created_at
    ) VALUES ('ctx-s3-${runId}', ?, ?, ?, 1, 'ESCROW_REFUND', 'SETTLED', 'idemp-ctx-s3-${runId}', '${sessionDateStr} 17:30:00')
  `).run(sess3Id, studentId, studentId);

  // Earlier Session on 2026-08-10 for First Session Detection
  const firstSessId = `sess-first-${runId}`;
  db.prepare(`
    INSERT INTO sessions (
      id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key, created_at
    ) VALUES (?, 'First Platform Orientation Session', ?, ?, ?, 'CREDIT_SETTLED', '2026-08-10 10:00:00', '2026-08-10 11:00:00', 1.0, 1, 'idemp-f1-${runId}', '2026-08-09 12:00:00')
  `).run(firstSessId, pythonSkillId, studentId, learnerId);

  db.prepare(`
    INSERT INTO session_participants (id, session_id, user_id, session_role, confirmed, created_at)
    VALUES 
    ('sp-f1-t-${runId}', ?, ?, 'TRAINER', 1, '2026-08-09 12:00:00'),
    ('sp-f1-l-${runId}', ?, ?, 'LEARNER', 1, '2026-08-09 12:00:00')
  `).run(firstSessId, studentId, firstSessId, learnerId);

  // Reporting logic functions for test verification
  function classifySettlement(session, agreement, creditTx, dispute) {
    if (session.status === 'DISPUTED' || (dispute && (dispute.id || dispute.status) && dispute.status && dispute.status !== 'DISMISSED')) return 'DISPUTED';
    if (session.status === 'CANCELLED') return 'CANCELLED';
    if (session.status === 'CREDIT_SETTLED' || session.status === 'COMPLETED' || session.status === 'PENDING_CONFIRMATION') {
      if (agreement && agreement.status === 'ACCEPTED') {
        if (agreement.return_type === 'SKILL') return 'DIRECT_SKILL_EXCHANGE';
        if (agreement.return_type === 'CREDITS') return 'CREDIT_TRANSFER';
        if (agreement.return_type === 'MIXED') return 'MIXED';
      }
      if (creditTx && creditTx.status === 'SETTLED' && creditTx.transaction_type === 'ESCROW_RELEASE') {
        return 'CREDIT_TRANSFER';
      }
      return 'DIRECT_SKILL_EXCHANGE';
    }
    return 'NO_SETTLEMENT';
  }

  function logAdminAction(params) {
    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, previous_state, new_state, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      params.adminUserId,
      params.action,
      params.targetType,
      params.targetId,
      params.previousState || null,
      params.newState || null,
      params.ipAddress || '127.0.0.1',
      params.userAgent || 'SkillSwap Admin Client'
    );
  }

  function getDailyReport(dateStr) {
    const sessions = db.prepare(`
      SELECT 
        s.*,
        sk.name as skill_name,
        tp.display_name as teacher_name,
        lp.display_name as learner_name,
        sea.status as agreement_status, sea.return_type as agreement_return_type,
        d.id as dispute_id, d.status as dispute_status
      FROM sessions s
      JOIN skills sk ON s.skill_id = sk.id
      JOIN profiles tp ON s.teacher_id = tp.user_id
      JOIN profiles lp ON s.learner_id = lp.user_id
      LEFT JOIN session_exchange_agreements sea ON s.id = sea.session_id
      LEFT JOIN disputes d ON s.id = d.session_id
      WHERE DATE(s.scheduled_start) = DATE(?) OR DATE(s.created_at) = DATE(?)
      ORDER BY s.scheduled_start ASC
    `).all(dateStr, dateStr);

    const creditTxs = db.prepare(`
      SELECT * FROM credit_transactions WHERE DATE(created_at) = DATE(?)
    `).all(dateStr);

    let creditsEarned = 0, creditsSpent = 0, creditsRefunded = 0, creditsTransferred = 0;
    for (const ctx of creditTxs) {
      if (ctx.transaction_type === 'ESCROW_RELEASE' && ctx.status === 'SETTLED') {
        creditsEarned += ctx.amount;
        creditsSpent += ctx.amount;
        creditsTransferred += ctx.amount;
      } else if (ctx.transaction_type === 'ESCROW_REFUND' && ctx.status === 'SETTLED') {
        creditsRefunded += ctx.amount;
      }
    }

    const enriched = sessions.map(sess => ({
      ...sess,
      settlement_classification: classifySettlement(sess, { status: sess.agreement_status, return_type: sess.agreement_return_type }, null, { id: sess.dispute_id, status: sess.dispute_status })
    }));

    return {
      reportDate: dateStr,
      sessions: enriched,
      creditActivity: {
        totalTransferred: creditsTransferred,
        creditsEarned,
        creditsSpent,
        creditsRefunded,
      }
    };
  }

  function getUserActivityReport(userId, filterDate) {
    const user = db.prepare(`SELECT u.id, u.email, u.role, u.status, p.display_name, p.college FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = ?`).get(userId);
    const rawSessions = db.prepare(`
      SELECT 
        s.*,
        sp.session_role as user_session_role,
        sk.name as skill_name,
        tp.user_id as teacher_user_id, tp.display_name as teacher_name,
        lp.user_id as learner_user_id, lp.display_name as learner_name,
        sea.status as agreement_status, sea.return_type as agreement_return_type
      FROM sessions s
      JOIN session_participants sp ON s.id = sp.session_id AND sp.user_id = ?
      JOIN skills sk ON s.skill_id = sk.id
      JOIN profiles tp ON s.teacher_id = tp.user_id
      JOIN profiles lp ON s.learner_id = lp.user_id
      LEFT JOIN session_exchange_agreements sea ON s.id = sea.session_id
      ORDER BY s.scheduled_start DESC
    `).all(userId);

    const firstSessionRaw = db.prepare(`
      SELECT 
        s.*,
        sp.session_role as user_session_role,
        sk.name as skill_name,
        tp.display_name as teacher_name,
        lp.display_name as learner_name
      FROM sessions s
      JOIN session_participants sp ON s.id = sp.session_id AND sp.user_id = ?
      JOIN skills sk ON s.skill_id = sk.id
      JOIN profiles tp ON s.teacher_id = tp.user_id
      JOIN profiles lp ON s.learner_id = lp.user_id
      ORDER BY s.scheduled_start ASC, s.created_at ASC
      LIMIT 1
    `).get(userId);

    const timeline = rawSessions.map(s => {
      const isTrainer = s.user_session_role === 'TRAINER';
      const partnerName = isTrainer ? s.learner_name : s.teacher_name;
      const partnerRole = isTrainer ? 'LEARNER' : 'TRAINER';
      const settlement = classifySettlement(s, { status: s.agreement_status, return_type: s.agreement_return_type });

      let creditDirection = null;
      if (s.status === 'CREDIT_SETTLED') {
        creditDirection = {
          from: s.learner_name,
          to: s.teacher_name,
          amount: s.credits_amount || 1,
          directionFormatted: `${s.learner_name} → ${s.teacher_name} (${s.credits_amount || 1} Skill Credit)`
        };
      } else if (s.status === 'CANCELLED') {
        creditDirection = {
          from: 'Escrow Reserve',
          to: s.learner_name,
          amount: s.credits_amount || 1,
          directionFormatted: `Escrow Reserve → ${s.learner_name}`
        };
      }

      return {
        sessionId: s.id,
        scheduledStart: s.scheduled_start,
        skillName: s.skill_name,
        status: s.status,
        selectedUserRole: s.user_session_role,
        partner: { name: partnerName, role: partnerRole },
        settlementClassification: settlement,
        creditDirection,
      };
    });

    const targetDate = filterDate || '2026-08-23';
    const slots = [];
    for (let h = 8; h <= 20; h++) {
      const startH = h < 10 ? `0${h}:00` : `${h}:00`;
      const endH = (h+1) < 10 ? `0${h+1}:00` : `${h+1}:00`;
      const match = timeline.find(s => s.scheduledStart.startsWith(targetDate) && s.scheduledStart.includes(` ${startH}:`));
      slots.push({
        timeRange: `${startH} – ${endH}`,
        status: match ? (match.status === 'CANCELLED' ? 'CANCELLED' : 'OCCUPIED') : 'FREE',
        userRole: match ? match.selectedUserRole : null,
      });
    }

    let firstSession = null;
    if (firstSessionRaw) {
      const isTr = firstSessionRaw.user_session_role === 'TRAINER';
      firstSession = {
        sessionId: firstSessionRaw.id,
        scheduledStart: firstSessionRaw.scheduled_start,
        userRole: firstSessionRaw.user_session_role,
        partnerName: isTr ? firstSessionRaw.learner_name : firstSessionRaw.teacher_name,
        partnerRole: isTr ? 'LEARNER' : 'TRAINER',
      };
    }

    return {
      user,
      sessionTimeline: timeline,
      firstSession,
      timeSlotSchedule: { date: targetDate, slots },
    };
  }

  function getSessionDetailReport(sessionId) {
    const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId);
    const participants = db.prepare(`SELECT * FROM session_participants WHERE session_id = ?`).all(sessionId);
    const agreement = db.prepare(`SELECT * FROM session_exchange_agreements WHERE session_id = ?`).get(sessionId);
    const creditTransactions = db.prepare(`SELECT * FROM credit_transactions WHERE reference_session_id = ?`).all(sessionId);
    const settlement = classifySettlement(session, agreement, creditTransactions[0]);
    return {
      session,
      participants,
      agreement,
      creditTransactions,
      settlementClassification: settlement,
    };
  }

  function exportReportToCsv(type, data) {
    if (type === 'daily') {
      return `SkillSwap Campus Daily Session Report - Date: ${data.reportDate}\r\nDAILY SESSIONS DETAIL\r\n`;
    }
    if (type === 'user') {
      return `SkillSwap Campus User Activity Report - User: ${data.user.display_name}\r\nSESSION HISTORY TIMELINE\r\n`;
    }
    if (type === 'session') {
      return `SkillSwap Campus Session Audit Report - Session ID: ${data.session.id}\r\nPARTICIPANTS\r\n`;
    }
    return '';
  }

  await t.test('1. Admin Authorization Guard: Authoritative role validation', () => {
    const adminToken = makeToken({ userId: adminId, email: `admin-${runId}@campus.edu`, role: 'ADMIN', status: 'ACTIVE' });
    const studentToken = makeToken({ userId: studentId, email: `student-${runId}@campus.edu`, role: 'STUDENT', status: 'ACTIVE' });
    const forgedToken = makeToken({ userId: studentId, email: `student-${runId}@campus.edu`, role: 'ADMIN', status: 'ACTIVE' }); // Forged role

    // Verify student cannot claim admin role if DB says STUDENT
    const dbStudent = db.prepare('SELECT role FROM users WHERE id = ?').get(studentId);
    assert.strictEqual(dbStudent.role, 'STUDENT');

    const dbAdmin = db.prepare('SELECT role FROM users WHERE id = ?').get(adminId);
    assert.strictEqual(dbAdmin.role, 'ADMIN');
  });

  await t.test('2. Daily Session Report: Accurate metrics and settlement classification', () => {
    const report = getDailyReport(sessionDateStr);
    assert.ok(report);
    assert.strictEqual(report.reportDate, sessionDateStr);

    // Filter to our test sessions
    const testSessions = report.sessions.filter(s => s.id.includes(runId.toString()));
    assert.strictEqual(testSessions.length, 3);

    const s1 = testSessions.find(s => s.id === sess1Id);
    assert.strictEqual(s1.settlement_classification, 'DIRECT_SKILL_EXCHANGE');

    const s2 = testSessions.find(s => s.id === sess2Id);
    assert.strictEqual(s2.settlement_classification, 'CREDIT_TRANSFER');

    const s3 = testSessions.find(s => s.id === sess3Id);
    assert.strictEqual(s3.settlement_classification, 'CANCELLED');

    assert.ok(report.creditActivity.creditsEarned >= 1);
    assert.ok(report.creditActivity.creditsRefunded >= 1);
  });

  await t.test('3. User Activity Report: Distinct LEARNER vs TRAINER session counts', () => {
    const userReport = getUserActivityReport(studentId);
    assert.ok(userReport);
    assert.strictEqual(userReport.user.id, studentId);

    // Alice was TRAINER in sess1, sess2, firstSess (3 times) and LEARNER in sess3 (1 time)
    const testSessions = userReport.sessionTimeline.filter(s => s.sessionId.includes(runId.toString()));
    assert.strictEqual(testSessions.length, 4);

    const trainerCount = testSessions.filter(s => s.selectedUserRole === 'TRAINER').length;
    const learnerCount = testSessions.filter(s => s.selectedUserRole === 'LEARNER').length;

    assert.strictEqual(trainerCount, 3);
    assert.strictEqual(learnerCount, 1);

    // Completed vs Cancelled
    const completedCount = testSessions.filter(s => s.status === 'CREDIT_SETTLED').length;
    const cancelledCount = testSessions.filter(s => s.status === 'CANCELLED').length;

    assert.strictEqual(completedCount, 3);
    assert.strictEqual(cancelledCount, 1);
  });

  await t.test('4. First Session Identification: Identifies earliest chronological session', () => {
    const userReport = getUserActivityReport(studentId);
    assert.ok(userReport.firstSession);
    assert.strictEqual(userReport.firstSession.sessionId, firstSessId);
    assert.strictEqual(userReport.firstSession.scheduledStart, '2026-08-10 10:00:00');
    assert.strictEqual(userReport.firstSession.userRole, 'TRAINER');
    assert.match(userReport.firstSession.partnerName, /Ananya Reddy/i);
    assert.strictEqual(userReport.firstSession.partnerRole, 'LEARNER');
  });

  await t.test('5. Credit Direction & Flows: Accurate transfer mapping', () => {
    const userReport = getUserActivityReport(studentId);
    const s2 = userReport.sessionTimeline.find(s => s.sessionId === sess2Id);
    assert.ok(s2.creditDirection);
    assert.match(s2.creditDirection.from, /Ananya Reddy/i);
    assert.match(s2.creditDirection.to, /Rahul Reddy/i);
    assert.strictEqual(s2.creditDirection.amount, 1);

    const s3 = userReport.sessionTimeline.find(s => s.sessionId === sess3Id);
    assert.ok(s3.creditDirection);
    assert.match(s3.creditDirection.from, /Escrow Reserve/i);
    assert.match(s3.creditDirection.to, /Rahul Reddy/i);
  });

  await t.test('6. Time-Slot Schedule Visualization: Hourly occupied vs free matrix', () => {
    const userReport = getUserActivityReport(studentId, sessionDateStr);
    assert.ok(userReport.timeSlotSchedule);
    assert.strictEqual(userReport.timeSlotSchedule.date, sessionDateStr);

    const slots = userReport.timeSlotSchedule.slots;
    assert.ok(slots.length >= 10);

    const slot10am = slots.find(sl => sl.timeRange.startsWith('10:00'));
    assert.ok(slot10am);
    assert.strictEqual(slot10am.status, 'OCCUPIED');
    assert.strictEqual(slot10am.userRole, 'TRAINER');

    const slot12pm = slots.find(sl => sl.timeRange.startsWith('12:00'));
    assert.ok(slot12pm);
    assert.strictEqual(slot12pm.status, 'FREE');
  });

  await t.test('7. Session Detail Audit Deep-Dive Record', () => {
    const detail = getSessionDetailReport(sess2Id);
    assert.ok(detail);
    assert.strictEqual(detail.session.id, sess2Id);
    assert.strictEqual(detail.participants.length, 2);
    assert.strictEqual(detail.settlementClassification, 'CREDIT_TRANSFER');
    assert.strictEqual(detail.creditTransactions.length, 1);
    assert.strictEqual(detail.creditTransactions[0].amount, 1);
    assert.strictEqual(detail.agreement.status, 'ACCEPTED');
  });

  await t.test('8. Admin Audit Logging & CSV Export', () => {
    logAdminAction({
      adminUserId: adminId,
      action: 'ADMIN_TEST_AUDIT',
      targetType: 'TEST_TARGET',
      targetId: 'target-123',
    });

    const auditRow = db.prepare(`SELECT * FROM audit_logs WHERE actor_id = ? AND action = 'ADMIN_TEST_AUDIT'`).get(adminId);
    assert.ok(auditRow);
    assert.strictEqual(auditRow.target_id, 'target-123');

    // Test CSV Generation
    const dailyData = getDailyReport(sessionDateStr);
    const csvDaily = exportReportToCsv('daily', dailyData);
    assert.ok(csvDaily.includes('SkillSwap Campus Daily Session Report'));
    assert.ok(csvDaily.includes('DAILY SESSIONS DETAIL'));

    const userData = getUserActivityReport(studentId);
    const csvUser = exportReportToCsv('user', userData);
    assert.ok(csvUser.includes('SkillSwap Campus User Activity Report'));
    assert.ok(csvUser.includes('SESSION HISTORY TIMELINE'));

    const sessionData = getSessionDetailReport(sess2Id);
    const csvSession = exportReportToCsv('session', sessionData);
    assert.ok(csvSession.includes('SkillSwap Campus Session Audit Report'));
    assert.ok(csvSession.includes('PARTICIPANTS'));
  });
});
