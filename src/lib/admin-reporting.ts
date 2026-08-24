import { getDb } from './db';

export type SettlementClassification = 
  | 'DIRECT_SKILL_EXCHANGE'
  | 'CREDIT_TRANSFER'
  | 'MIXED'
  | 'NO_SETTLEMENT'
  | 'DISPUTED'
  | 'CANCELLED';

/**
 * Deterministically classify session settlement from canonical database records.
 */
export function classifySettlement(session: any, agreement?: any, creditTx?: any, dispute?: any): SettlementClassification {
  if (session.status === 'DISPUTED' || (dispute && (dispute.id || dispute.status) && dispute.status && dispute.status !== 'DISMISSED')) {
    return 'DISPUTED';
  }
  if (session.status === 'CANCELLED') {
    return 'CANCELLED';
  }
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

/**
 * Log privileged administrative action in immutable audit logs.
 */
export function logAdminAction(params: {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  previousState?: string;
  newState?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const db = getDb();
  try {
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
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
}

/**
 * Generate Daily Session & Platform Audit Report for a given date (YYYY-MM-DD).
 */
export function getDailyReport(dateStr: string) {
  const db = getDb();

  // 1. Fetch all sessions scheduled, created, or updated on the selected date (or all dates)
  const isAll = dateStr === 'ALL';
  const sessionsQuery = `
    SELECT 
      s.*,
      sk.name as skill_name, sk.category as skill_category,
      tp.display_name as teacher_name, tp.college as teacher_college, tp.major as teacher_major,
      lp.display_name as learner_name, lp.college as learner_college, lp.major as learner_major,
      tu.email as teacher_email, lu.email as learner_email,
      us.verification_status as mentor_verification_status,
      sea.status as agreement_status, sea.return_type as agreement_return_type, sea.requested_return_skill_name,
      d.id as dispute_id, d.reason as dispute_reason, d.status as dispute_status
    FROM sessions s
    JOIN skills sk ON s.skill_id = sk.id
    JOIN profiles tp ON s.teacher_id = tp.user_id
    JOIN profiles lp ON s.learner_id = lp.user_id
    LEFT JOIN users tu ON s.teacher_id = tu.id
    LEFT JOIN users lu ON s.learner_id = lu.id
    LEFT JOIN user_skills us ON (s.teacher_id = us.user_id AND s.skill_id = us.skill_id)
    LEFT JOIN session_exchange_agreements sea ON s.id = sea.session_id
    LEFT JOIN disputes d ON s.id = d.session_id
    ${isAll ? '' : 'WHERE DATE(s.scheduled_start) = DATE(?) OR DATE(s.created_at) = DATE(?) OR DATE(s.updated_at) = DATE(?)'}
    ORDER BY s.scheduled_start DESC, s.created_at DESC
  `;
  const sessions = isAll
    ? (db.prepare(sessionsQuery).all() as any[])
    : (db.prepare(sessionsQuery).all(dateStr, dateStr, dateStr) as any[]);

  // 2. Fetch all credit transactions on this date (or all dates)
  const creditTxsQuery = `
    SELECT 
      ctx.*,
      sp.display_name as sender_name,
      rp.display_name as receiver_name
    FROM credit_transactions ctx
    LEFT JOIN profiles sp ON ctx.sender_id = sp.user_id
    LEFT JOIN profiles rp ON ctx.receiver_id = rp.user_id
    ${isAll ? '' : 'WHERE DATE(ctx.created_at) = DATE(?)'}
    ORDER BY ctx.created_at DESC
  `;
  const creditTxs = isAll
    ? (db.prepare(creditTxsQuery).all() as any[])
    : (db.prepare(creditTxsQuery).all(dateStr) as any[]);

  // 3. Compute Session Metrics
  let totalScheduled = 0;
  let totalStarted = 0;
  let totalCompleted = 0;
  let totalCancelled = 0;
  let totalNoShows = 0;
  let totalDisputed = 0;
  let totalPending = 0;
  let totalFailed = 0;

  let totalDirectSkillExchanges = 0;
  let totalCreditSettledSessions = 0;
  let totalMixedSessions = 0;

  const enrichedSessions = sessions.map(sess => {
    totalScheduled++;

    if (sess.status === 'IN_PROGRESS' || sess.status === 'PENDING_CONFIRMATION' || sess.status === 'CREDIT_SETTLED' || sess.status === 'COMPLETED') {
      totalStarted++;
    }
    if (sess.status === 'CREDIT_SETTLED' || sess.status === 'COMPLETED') {
      totalCompleted++;
    } else if (sess.status === 'CANCELLED') {
      totalCancelled++;
    } else if (sess.status === 'DISPUTED') {
      totalDisputed++;
      if (sess.dispute_reason === 'NO_SHOW' || (sess.cancellation_reason && sess.cancellation_reason.toLowerCase().includes('no_show'))) {
        totalNoShows++;
      }
    } else if (sess.status === 'REQUESTED' || sess.status === 'ACCEPTED' || sess.status === 'SCHEDULED' || sess.status === 'PENDING_CONFIRMATION') {
      totalPending++;
    }

    // Settlement determination
    const settlement = classifySettlement(sess, { status: sess.agreement_status, return_type: sess.agreement_return_type }, null, { status: sess.dispute_status });
    
    if (settlement === 'DIRECT_SKILL_EXCHANGE') totalDirectSkillExchanges++;
    else if (settlement === 'CREDIT_TRANSFER') totalCreditSettledSessions++;
    else if (settlement === 'MIXED') totalMixedSessions++;

    return {
      ...sess,
      settlement_classification: settlement,
    };
  });

  // 4. Compute Credit Metrics
  let creditsTransferred = 0;
  let creditsEarned = 0;
  let creditsSpent = 0;
  let creditsRefunded = 0;
  let creditsPending = 0;
  let creditsDisputed = 0;

  for (const ctx of creditTxs) {
    if (ctx.transaction_type === 'ESCROW_RELEASE' && ctx.status === 'SETTLED') {
      creditsEarned += ctx.amount;
      creditsSpent += ctx.amount;
      creditsTransferred += ctx.amount;
    } else if (ctx.transaction_type === 'ESCROW_REFUND' && ctx.status === 'SETTLED') {
      creditsRefunded += ctx.amount;
    } else if (ctx.transaction_type === 'ESCROW_RESERVE' && ctx.status === 'PENDING') {
      creditsPending += ctx.amount;
    }
  }

  // Count active disputed session credits
  const disputedSessionCredits = sessions
    .filter(s => s.status === 'DISPUTED')
    .reduce((acc, s) => acc + (s.credits_amount || 1), 0);
  creditsDisputed = disputedSessionCredits;

  // 5. Fetch Learning Requests
  const learningRequests = db.prepare(`
    SELECT 
      lr.*,
      lp.display_name as learner_name, lp.college as learner_college,
      mp.display_name as mentor_name, mp.college as mentor_college
    FROM learning_requests lr
    LEFT JOIN profiles lp ON lr.learner_id = lp.user_id
    LEFT JOIN profiles mp ON lr.matched_mentor_id = mp.user_id
    ORDER BY lr.created_at DESC
    LIMIT 50
  `).all() as any[];

  // 6. Fetch Notification Deliveries
  const notificationDeliveries = db.prepare(`
    SELECT nd.*, p.display_name
    FROM notification_deliveries nd
    LEFT JOIN profiles p ON nd.user_id = p.user_id
    ORDER BY nd.created_at DESC
    LIMIT 50
  `).all() as any[];

  // 7. Compute Platform-Wide Lifetime Totals across All Time
  const allTimeStatsRaw = db.prepare(`
    SELECT 
      COUNT(*) as total_lifetime_sessions,
      SUM(CASE WHEN status IN ('ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_CONFIRMATION') THEN 1 ELSE 0 END) as active_sessions,
      SUM(CASE WHEN status IN ('COMPLETED', 'CREDIT_SETTLED') THEN 1 ELSE 0 END) as completed_sessions,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_sessions,
      SUM(CASE WHEN status = 'DISPUTED' THEN 1 ELSE 0 END) as disputed_sessions
    FROM sessions
  `).get() as any;

  const totalEscrowLocked = (db.prepare(`
    SELECT COALESCE(SUM(escrow_balance), 0) as total FROM skill_credit_accounts
  `).get() as any).total;

  const totalUsersCount = (db.prepare(`
    SELECT COUNT(*) as count FROM users
  `).get() as any).count;

  // 8. Fetch Chronological Day Timeline Events ("What happened first, then what happened next")
  const dayTimelineEventsQuery = `
    SELECT 
      se.*,
      ap.display_name as actor_name,
      s.title as session_title,
      s.credits_amount,
      sk.name as skill_name,
      tp.display_name as teacher_name, tp.college as teacher_college,
      lp.display_name as learner_name, lp.college as learner_college,
      us.verification_status as mentor_verification_status,
      sea.return_type as agreement_return_type,
      sea.requested_return_skill_name,
      sea.status as agreement_status
    FROM session_events se
    JOIN sessions s ON se.session_id = s.id
    LEFT JOIN skills sk ON s.skill_id = sk.id
    LEFT JOIN profiles ap ON se.actor_id = ap.user_id
    LEFT JOIN profiles tp ON s.teacher_id = tp.user_id
    LEFT JOIN profiles lp ON s.learner_id = lp.user_id
    LEFT JOIN user_skills us ON (s.teacher_id = us.user_id AND s.skill_id = us.skill_id)
    LEFT JOIN session_exchange_agreements sea ON s.id = sea.session_id
    ${isAll ? '' : 'WHERE DATE(se.created_at) = DATE(?)'}
    ORDER BY se.created_at ASC
  `;
  const dayTimelineEvents = isAll
    ? (db.prepare(dayTimelineEventsQuery).all() as any[])
    : (db.prepare(dayTimelineEventsQuery).all(dateStr) as any[]);

  // 9. Group Day-Wise Metrics for Lifetime View
  const lifetimeDayWiseMetrics = db.prepare(`
    SELECT 
      DATE(created_at) as session_date,
      COUNT(*) as total_sessions,
      SUM(CASE WHEN status IN ('COMPLETED', 'CREDIT_SETTLED') THEN 1 ELSE 0 END) as completed_sessions,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_sessions,
      SUM(CASE WHEN status = 'DISPUTED' THEN 1 ELSE 0 END) as disputed_sessions,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_sessions,
      SUM(credits_amount) as total_credits_volume
    FROM sessions
    GROUP BY DATE(created_at)
    ORDER BY session_date DESC
    LIMIT 30
  `).all() as any[];

  return {
    reportDate: dateStr,
    isLifetime: isAll,
    generatedAt: new Date().toISOString(),
    platformLifetimeStats: {
      totalLifetimeSessions: allTimeStatsRaw?.total_lifetime_sessions || 0,
      activeSessions: allTimeStatsRaw?.active_sessions || 0,
      completedSessions: allTimeStatsRaw?.completed_sessions || 0,
      cancelledSessions: allTimeStatsRaw?.cancelled_sessions || 0,
      disputedSessions: allTimeStatsRaw?.disputed_sessions || 0,
      totalEscrowLocked,
      totalUsersCount,
    },
    overview: {
      totalSessions: totalScheduled,
      completedSessions: totalCompleted,
      cancelledSessions: totalCancelled,
      disputedSessions: totalDisputed,
      successfulSkillExchanges: totalDirectSkillExchanges,
      creditBasedSessions: totalCreditSettledSessions,
      mixedSessions: totalMixedSessions,
      pendingSessions: totalPending,
      totalLearningRequests: learningRequests.length,
      openLearningRequests: learningRequests.filter(r => r.status === 'OPEN').length,
      matchedLearningRequests: learningRequests.filter(r => r.status === 'MENTOR_FOUND' || r.status === 'NOTIFIED').length,
      fulfilledLearningRequests: learningRequests.filter(r => r.status === 'FULFILLED').length,
    },
    sessionStats: {
      totalScheduled,
      totalStarted,
      totalCompleted,
      totalCancelled,
      totalNoShows,
      totalDisputed,
      totalPending,
      totalFailed,
      directSkillExchanges: totalDirectSkillExchanges,
      creditSettledSessions: totalCreditSettledSessions,
      mixedSessions: totalMixedSessions,
    },
    creditActivity: {
      totalTransferred: creditsTransferred,
      creditsEarned,
      creditsSpent,
      creditsRefunded,
      creditsPending,
      creditsDisputed,
      transactionCount: creditTxs.length,
    },
    dayTimelineEvents,
    lifetimeDayWiseMetrics,
    sessions: isAll ? [] : enrichedSessions, // In Lifetime view, return metrics only; return detailed sessions when a day is selected!
    creditTransactions: creditTxs,
    learningRequests,
    notificationDeliveries,
  };
}

/**
 * Get Comprehensive Sessions List with Server-Side Search, Status Filter & Pagination
 */
export function getSessionsListReport(params: {
  search?: string;
  status?: string;
  date?: string;
  settlement?: string;
  page?: number;
  limit?: number;
}) {
  const db = getDb();
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(5, params.limit || 20));
  const offset = (page - 1) * limit;

  let whereClauses: string[] = [];
  let queryParams: any[] = [];

  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim().toLowerCase()}%`;
    whereClauses.push(`(
      LOWER(sk.name) LIKE ? OR
      LOWER(tp.display_name) LIKE ? OR
      LOWER(lp.display_name) LIKE ? OR
      LOWER(tu.email) LIKE ? OR
      LOWER(lu.email) LIKE ? OR
      s.id LIKE ?
    )`);
    queryParams.push(term, term, term, term, term, term);
  }

  if (params.status && params.status !== 'ALL') {
    whereClauses.push(`s.status = ?`);
    queryParams.push(params.status);
  }

  if (params.date && params.date !== 'ALL') {
    whereClauses.push(`(DATE(s.scheduled_start) = DATE(?) OR DATE(s.created_at) = DATE(?))`);
    queryParams.push(params.date, params.date);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalCount = (db.prepare(`
    SELECT COUNT(*) as count
    FROM sessions s
    JOIN skills sk ON s.skill_id = sk.id
    JOIN profiles tp ON s.teacher_id = tp.user_id
    JOIN profiles lp ON s.learner_id = lp.user_id
    JOIN users tu ON s.teacher_id = tu.id
    JOIN users lu ON s.learner_id = lu.id
    ${whereSql}
  `).get(...queryParams) as any).count;

  const rawSessions = db.prepare(`
    SELECT 
      s.*,
      sk.name as skill_name, sk.category as skill_category, sk.icon as skill_icon,
      tp.display_name as teacher_name, tp.college as teacher_college, tp.avatar as teacher_avatar, tu.email as teacher_email,
      lp.display_name as learner_name, lp.college as learner_college, lp.avatar as learner_avatar, lu.email as learner_email,
      sea.status as agreement_status, sea.return_type as agreement_return_type, sea.requested_return_skill_name, sea.credit_amount as agreement_credit_amount, sea.proposed_by as agreement_proposed_by, sea.accepted_by as agreement_accepted_by, sea.accepted_at as agreement_accepted_at,
      d.id as dispute_id, d.reason as dispute_reason, d.status as dispute_status
    FROM sessions s
    JOIN skills sk ON s.skill_id = sk.id
    JOIN profiles tp ON s.teacher_id = tp.user_id
    JOIN profiles lp ON s.learner_id = lp.user_id
    JOIN users tu ON s.teacher_id = tu.id
    JOIN users lu ON s.learner_id = lu.id
    LEFT JOIN session_exchange_agreements sea ON s.id = sea.session_id
    LEFT JOIN disputes d ON s.id = d.session_id
    ${whereSql}
    ORDER BY s.scheduled_start DESC, s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...queryParams, limit, offset) as any[];

  const sessions = rawSessions.map(sess => {
    const settlement = classifySettlement(sess, { status: sess.agreement_status, return_type: sess.agreement_return_type }, null, { status: sess.dispute_status });
    return {
      ...sess,
      settlement_classification: settlement,
    };
  });

  return {
    sessions,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: offset + sessions.length < totalCount,
    }
  };
}

/**
 * Get User-Wise Activity List with server-side search, filtering, and pagination.
 */
export function getUserListReport(params: {
  search?: string;
  role?: string;
  status?: string;
  skill?: string;
  settlement?: string;
  page?: number;
  limit?: number;
}) {
  const db = getDb();
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(5, params.limit || 20));
  const offset = (page - 1) * limit;

  let whereClauses: string[] = [];
  let queryParams: any[] = [];

  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim().toLowerCase()}%`;
    whereClauses.push(`(LOWER(u.email) LIKE ? OR LOWER(p.display_name) LIKE ? OR u.id LIKE ?)`);
    queryParams.push(term, term, term);
  }

  if (params.role && params.role !== 'ALL') {
    whereClauses.push(`u.role = ?`);
    queryParams.push(params.role);
  }

  if (params.status && params.status !== 'ALL') {
    whereClauses.push(`u.status = ?`);
    queryParams.push(params.status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalUsers = (db.prepare(`
    SELECT COUNT(*) as count FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    ${whereSql}
  `).get(...queryParams) as any).count;

  const users = db.prepare(`
    SELECT 
      u.id, u.email, u.role, u.status, u.user_type, u.created_at,
      p.display_name, p.avatar, p.college, p.major, p.year, p.trust_score,
      sca.balance as credit_balance, sca.escrow_balance,
      (
        SELECT COUNT(DISTINCT sp.session_id) 
        FROM session_participants sp 
        WHERE sp.user_id = u.id
      ) as total_sessions,
      (
        SELECT COUNT(*) 
        FROM session_participants sp 
        WHERE sp.user_id = u.id AND sp.session_role = 'LEARNER'
      ) as learner_sessions,
      (
        SELECT COUNT(*) 
        FROM session_participants sp 
        WHERE sp.user_id = u.id AND sp.session_role = 'TRAINER'
      ) as trainer_sessions,
      (
        SELECT COUNT(DISTINCT s.id) 
        FROM sessions s 
        JOIN session_participants sp ON s.id = sp.session_id
        WHERE sp.user_id = u.id AND s.status IN ('CREDIT_SETTLED', 'COMPLETED')
      ) as completed_sessions,
      (
        SELECT COUNT(DISTINCT s.id) 
        FROM sessions s 
        JOIN session_participants sp ON s.id = sp.session_id
        WHERE sp.user_id = u.id AND s.status = 'CANCELLED'
      ) as cancelled_sessions,
      (
        SELECT COUNT(DISTINCT s.id) 
        FROM sessions s 
        JOIN session_participants sp ON s.id = sp.session_id
        WHERE sp.user_id = u.id AND s.status = 'DISPUTED'
      ) as disputed_sessions,
      (
        SELECT COALESCE(SUM(ctx.amount), 0)
        FROM credit_transactions ctx
        WHERE ctx.receiver_id = u.id AND ctx.transaction_type = 'ESCROW_RELEASE' AND ctx.status = 'SETTLED'
      ) as credits_earned,
      (
        SELECT COALESCE(SUM(ctx.amount), 0)
        FROM credit_transactions ctx
        WHERE ctx.sender_id = u.id AND ctx.transaction_type = 'ESCROW_RELEASE' AND ctx.status = 'SETTLED'
      ) as credits_spent,
      (
        SELECT COALESCE(SUM(ctx.amount), 0)
        FROM credit_transactions ctx
        WHERE ctx.receiver_id = u.id AND ctx.transaction_type = 'ESCROW_REFUND' AND ctx.status = 'SETTLED'
      ) as credits_refunded
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN skill_credit_accounts sca ON u.id = sca.user_id
    ${whereSql}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...queryParams, limit, offset) as any[];

  return {
    users: users.map(u => ({
      ...u,
      credits_transferred: (u.credits_earned || 0) + (u.credits_spent || 0),
    })),
    pagination: {
      page,
      limit,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
    },
  };
}

/**
 * Get Comprehensive User Activity Report & Session Timeline for a specific user.
 */
export function getUserActivityReport(userId: string, fromDate?: string, toDate?: string) {
  const db = getDb();

  const user = db.prepare(`
    SELECT u.id, u.email, u.role, u.status, u.user_type, u.created_at,
           p.display_name, p.avatar, p.bio, p.college, p.major, p.year, p.trust_score,
           sca.balance as credit_balance, sca.escrow_balance, sca.lifetime_earned, sca.lifetime_spent,
           r.bayesian_rating, r.reliability_score, r.total_reviews
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN skill_credit_accounts sca ON u.id = sca.user_id
    LEFT JOIN reputations r ON u.id = r.user_id
    WHERE u.id = ?
  `).get(userId) as any;

  if (!user) return null;

  // 1. Session History Query with optional Date Range
  let dateFilter = '';
  const dateParams: any[] = [userId];

  if (fromDate) {
    dateFilter += ` AND DATE(s.scheduled_start) >= DATE(?)`;
    dateParams.push(fromDate);
  }
  if (toDate) {
    dateFilter += ` AND DATE(s.scheduled_start) <= DATE(?)`;
    dateParams.push(toDate);
  }

  const rawSessions = db.prepare(`
    SELECT 
      s.*,
      sp.session_role as user_session_role,
      sk.name as skill_name, sk.category as skill_category,
      tp.user_id as teacher_user_id, tp.display_name as teacher_name, tp.college as teacher_college, tp.avatar as teacher_avatar,
      lp.user_id as learner_user_id, lp.display_name as learner_name, lp.college as learner_college, lp.avatar as learner_avatar,
      sea.status as agreement_status, sea.return_type as agreement_return_type, sea.requested_return_skill_name, sea.credit_amount as agreement_credit_amount,
      d.id as dispute_id, d.reason as dispute_reason, d.status as dispute_status, d.resolution_notes as dispute_resolution
    FROM sessions s
    JOIN session_participants sp ON s.id = sp.session_id AND sp.user_id = ?
    JOIN skills sk ON s.skill_id = sk.id
    JOIN profiles tp ON s.teacher_id = tp.user_id
    JOIN profiles lp ON s.learner_id = lp.user_id
    LEFT JOIN session_exchange_agreements sea ON s.id = sea.session_id
    LEFT JOIN disputes d ON s.id = d.session_id
    WHERE 1=1 ${dateFilter}
    ORDER BY s.scheduled_start DESC
  `).all(...dateParams) as any[];

  // 2. Fetch linked Credit Transactions for this user
  const creditTxs = db.prepare(`
    SELECT 
      ctx.*,
      sp.display_name as sender_name,
      rp.display_name as receiver_name,
      s.title as session_title
    FROM credit_transactions ctx
    LEFT JOIN profiles sp ON ctx.sender_id = sp.user_id
    LEFT JOIN profiles rp ON ctx.receiver_id = rp.user_id
    LEFT JOIN sessions s ON ctx.reference_session_id = s.id
    WHERE ctx.sender_id = ? OR ctx.receiver_id = ?
    ORDER BY ctx.created_at DESC
  `).all(userId, userId) as any[];

  // 3. Process sessions & compute timeline
  let learnerSessionsCount = 0;
  let trainerSessionsCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let disputedCount = 0;
  let noShowCount = 0;

  const sessionTimeline = rawSessions.map(sess => {
    const isTrainer = sess.user_session_role === 'TRAINER';
    if (isTrainer) trainerSessionsCount++;
    else learnerSessionsCount++;

    if (sess.status === 'CREDIT_SETTLED' || sess.status === 'COMPLETED') completedCount++;
    else if (sess.status === 'CANCELLED') cancelledCount++;
    else if (sess.status === 'DISPUTED') {
      disputedCount++;
      if (sess.dispute_reason === 'NO_SHOW') noShowCount++;
    }

    const partnerId = isTrainer ? sess.learner_user_id : sess.teacher_user_id;
    const partnerName = isTrainer ? sess.learner_name : sess.teacher_name;
    const partnerRole = isTrainer ? 'LEARNER' : 'TRAINER';
    const partnerCollege = isTrainer ? sess.learner_college : sess.teacher_college;
    const partnerAvatar = isTrainer ? sess.learner_avatar : sess.teacher_avatar;

    const settlement = classifySettlement(sess, { status: sess.agreement_status, return_type: sess.agreement_return_type }, null, { status: sess.dispute_status });

    // Credit direction computation
    let creditDirection = null;
    if (settlement === 'CREDIT_TRANSFER' || sess.status === 'CREDIT_SETTLED') {
      creditDirection = {
        from: sess.learner_name,
        to: sess.teacher_name,
        amount: sess.credits_amount || 1,
        unit: 'Skill Credit',
        directionFormatted: `${sess.learner_name} → ${sess.teacher_name} (${sess.credits_amount || 1} Skill Credit)`,
      };
    } else if (sess.status === 'CANCELLED' && sess.credits_amount) {
      creditDirection = {
        from: 'Escrow Reserve',
        to: sess.learner_name,
        amount: sess.credits_amount,
        unit: 'Skill Credit',
        directionFormatted: `Escrow Reserve → ${sess.learner_name} (${sess.credits_amount} Skill Credit Refund)`,
      };
    }

    return {
      sessionId: sess.id,
      title: sess.title,
      skillName: sess.skill_name,
      skillCategory: sess.skill_category,
      scheduledStart: sess.scheduled_start,
      scheduledEnd: sess.scheduled_end,
      durationHours: sess.duration_hours,
      status: sess.status,
      selectedUserRole: sess.user_session_role,
      partner: {
        id: partnerId,
        name: partnerName,
        role: partnerRole,
        college: partnerCollege,
        avatar: partnerAvatar,
      },
      settlementClassification: settlement,
      exchangeTerms: sess.agreement_status === 'ACCEPTED' ? {
        taughtSkill: sess.skill_name,
        returnSkill: sess.requested_return_skill_name,
        returnType: sess.agreement_return_type,
      } : null,
      creditDirection,
      outcome: sess.status === 'CREDIT_SETTLED' ? 'Successfully Completed & Settled' :
               sess.status === 'COMPLETED' ? 'Completed' :
               sess.status === 'CANCELLED' ? `Cancelled (${sess.cancellation_reason || 'Rescheduled'})` :
               sess.status === 'DISPUTED' ? `Disputed (${sess.dispute_reason || 'Under Review'})` :
               sess.status === 'IN_PROGRESS' ? 'Currently In Progress' : 'Scheduled / Pending Confirmation',
    };
  });

  // 4. Identify First Session Ever (Earliest in chronological DB order)
  const firstSessionRaw = db.prepare(`
    SELECT 
      s.*,
      sp.session_role as user_session_role,
      sk.name as skill_name,
      tp.display_name as teacher_name, tp.college as teacher_college,
      lp.display_name as learner_name, lp.college as learner_college,
      sea.status as agreement_status, sea.return_type as agreement_return_type, sea.requested_return_skill_name
    FROM sessions s
    JOIN session_participants sp ON s.id = sp.session_id AND sp.user_id = ?
    JOIN skills sk ON s.skill_id = sk.id
    JOIN profiles tp ON s.teacher_id = tp.user_id
    JOIN profiles lp ON s.learner_id = lp.user_id
    LEFT JOIN session_exchange_agreements sea ON s.id = sea.session_id
    ORDER BY s.scheduled_start ASC, s.created_at ASC
    LIMIT 1
  `).get(userId) as any;

  let firstSession = null;
  if (firstSessionRaw) {
    const isTrainer = firstSessionRaw.user_session_role === 'TRAINER';
    const settlement = classifySettlement(firstSessionRaw, { status: firstSessionRaw.agreement_status, return_type: firstSessionRaw.agreement_return_type });
    firstSession = {
      sessionId: firstSessionRaw.id,
      title: firstSessionRaw.title,
      skillName: firstSessionRaw.skill_name,
      scheduledStart: firstSessionRaw.scheduled_start,
      scheduledEnd: firstSessionRaw.scheduled_end,
      userRole: firstSessionRaw.user_session_role,
      partnerName: isTrainer ? firstSessionRaw.learner_name : firstSessionRaw.teacher_name,
      partnerRole: isTrainer ? 'LEARNER' : 'TRAINER',
      partnerCollege: isTrainer ? firstSessionRaw.learner_college : firstSessionRaw.teacher_college,
      status: firstSessionRaw.status,
      settlementClassification: settlement,
      creditDirection: `${firstSessionRaw.learner_name} → ${firstSessionRaw.teacher_name} (${firstSessionRaw.credits_amount || 1} Skill Credit)`,
      outcome: firstSessionRaw.status === 'CREDIT_SETTLED' ? 'Successfully Completed' : firstSessionRaw.status,
    };
  }

  // 5. Credit Aggregate Flows
  let creditsEarned = 0;
  let creditsSpent = 0;
  let creditsRefunded = 0;

  for (const ctx of creditTxs) {
    if (ctx.receiver_id === userId && ctx.transaction_type === 'ESCROW_RELEASE' && ctx.status === 'SETTLED') {
      creditsEarned += ctx.amount;
    }
    if (ctx.sender_id === userId && ctx.transaction_type === 'ESCROW_RELEASE' && ctx.status === 'SETTLED') {
      creditsSpent += ctx.amount;
    }
    if (ctx.receiver_id === userId && ctx.transaction_type === 'ESCROW_REFUND' && ctx.status === 'SETTLED') {
      creditsRefunded += ctx.amount;
    }
  }

  // 6. Time-Slot Occupancy Schedule (for the most recent active date or selected fromDate)
  const targetScheduleDate = fromDate || (sessionTimeline.length > 0 ? sessionTimeline[0].scheduledStart.substring(0, 10) : new Date().toISOString().substring(0, 10));
  
  const timeSlots = [];
  for (let hour = 8; hour <= 21; hour++) {
    const startHourStr = hour < 10 ? `0${hour}:00` : `${hour}:00`;
    const endHourStr = (hour + 1) < 10 ? `0${hour + 1}:00` : `${hour + 1}:00`;
    const slotStartIso = `${targetScheduleDate} ${startHourStr}:00`;
    const slotEndIso = `${targetScheduleDate} ${endHourStr}:00`;

    const matchingSession = sessionTimeline.find(s => {
      const sessDate = s.scheduledStart.substring(0, 10);
      const sessStart = s.scheduledStart.substring(11, 16);
      return sessDate === targetScheduleDate && sessStart >= startHourStr && sessStart < endHourStr;
    });

    if (matchingSession) {
      timeSlots.push({
        timeRange: `${startHourStr} – ${endHourStr}`,
        status: matchingSession.status === 'CANCELLED' ? 'CANCELLED' : 'OCCUPIED',
        userRole: matchingSession.selectedUserRole,
        partnerName: matchingSession.partner.name,
        skillName: matchingSession.skillName,
        sessionStatus: matchingSession.status,
        sessionId: matchingSession.sessionId,
      });
    } else {
      timeSlots.push({
        timeRange: `${startHourStr} – ${endHourStr}`,
        status: 'FREE',
        userRole: null,
        partnerName: null,
        skillName: null,
        sessionStatus: null,
        sessionId: null,
      });
    }
  }

  return {
    user,
    summary: {
      totalSessions: rawSessions.length,
      learnerSessions: learnerSessionsCount,
      trainerSessions: trainerSessionsCount,
      completedSessions: completedCount,
      cancelledSessions: cancelledCount,
      disputedSessions: disputedCount,
      noShowSessions: noShowCount,
    },
    creditSummary: {
      earned: creditsEarned,
      spent: creditsSpent,
      transferred: creditsEarned + creditsSpent,
      refunded: creditsRefunded,
      pending: user.escrow_balance || 0,
      balance: user.credit_balance || 0,
    },
    firstSession,
    sessionTimeline,
    timeSlotSchedule: {
      date: targetScheduleDate,
      slots: timeSlots,
    },
    creditHistory: creditTxs,
  };
}

/**
 * Get Complete Auditable Session Record for a single session.
 */
export function getSessionDetailReport(sessionId: string) {
  const db = getDb();

  const session = db.prepare(`
    SELECT 
      s.*,
      sk.name as skill_name, sk.category as skill_category, sk.description as skill_description,
      tp.user_id as teacher_user_id, tp.display_name as teacher_name, tp.college as teacher_college, tp.major as teacher_major, tp.avatar as teacher_avatar, tp.is_verified_student as teacher_verified,
      lp.user_id as learner_user_id, lp.display_name as learner_name, lp.college as learner_college, lp.major as learner_major, lp.avatar as learner_avatar, lp.is_verified_student as learner_verified,
      tu.email as teacher_email, lu.email as learner_email,
      us.verification_status as mentor_verification_status
    FROM sessions s
    JOIN skills sk ON s.skill_id = sk.id
    JOIN profiles tp ON s.teacher_id = tp.user_id
    JOIN profiles lp ON s.learner_id = lp.user_id
    LEFT JOIN users tu ON s.teacher_id = tu.id
    LEFT JOIN users lu ON s.learner_id = lu.id
    LEFT JOIN user_skills us ON (s.teacher_id = us.user_id AND s.skill_id = us.skill_id)
    WHERE s.id = ?
  `).get(sessionId) as any;

  if (!session) return null;

  const participants = db.prepare(`
    SELECT sp.*, p.display_name, p.college, p.major, p.avatar, p.is_verified_student, u.email
    FROM session_participants sp
    JOIN profiles p ON sp.user_id = p.user_id
    LEFT JOIN users u ON sp.user_id = u.id
    WHERE sp.session_id = ?
  `).all(sessionId) as any[];

  const agreement = db.prepare(`
    SELECT * FROM session_exchange_agreements WHERE session_id = ?
  `).get(sessionId) as any;

  const sessionEvents = db.prepare(`
    SELECT se.*, p.display_name as actor_name
    FROM session_events se
    LEFT JOIN profiles p ON se.actor_id = p.user_id
    WHERE se.session_id = ?
    ORDER BY se.created_at ASC
  `).all(sessionId) as any[];

  const creditTransactions = db.prepare(`
    SELECT ctx.*, sp.display_name as sender_name, rp.display_name as receiver_name
    FROM credit_transactions ctx
    LEFT JOIN profiles sp ON ctx.sender_id = sp.user_id
    LEFT JOIN profiles rp ON ctx.receiver_id = rp.user_id
    WHERE ctx.reference_session_id = ?
    ORDER BY ctx.created_at ASC
  `).all(sessionId) as any[];

  const dispute = db.prepare(`
    SELECT d.*, p.display_name as initiator_name
    FROM disputes d
    JOIN profiles p ON d.initiator_id = p.user_id
    WHERE d.session_id = ?
  `).get(sessionId) as any;

  const blockchainTx = db.prepare(`
    SELECT * FROM blockchain_transactions
    WHERE reference_id = ? OR payload_json LIKE ?
  `).get(sessionId, `%${sessionId}%`) as any;

  const auditHistory = db.prepare(`
    SELECT * FROM audit_logs
    WHERE target_id = ? OR target_id = ?
    ORDER BY created_at ASC
  `).all(sessionId, agreement ? agreement.id : sessionId) as any[];

  const attendanceEvents = db.prepare(`
    SELECT sa.*, p.display_name
    FROM session_attendance sa
    LEFT JOIN profiles p ON sa.user_id = p.user_id
    WHERE sa.session_id = ?
    ORDER BY sa.joined_at ASC
  `).all(sessionId) as any[];

  const chatSummary = db.prepare(`
    SELECT 
      COUNT(*) as total_messages,
      MAX(created_at) as last_message_at,
      COUNT(DISTINCT sender_id) as active_chatters
    FROM chat_messages
    WHERE session_id = ?
  `).get(sessionId) as any;

  const settlement = classifySettlement(session, agreement, creditTransactions[0], dispute);

  return {
    session,
    participants,
    agreement: agreement || null,
    sessionEvents,
    creditTransactions,
    dispute: dispute || null,
    blockchainTx: blockchainTx || null,
    auditHistory,
    attendanceEvents,
    chatMetadata: {
      totalMessages: chatSummary?.total_messages || 0,
      lastMessageAt: chatSummary?.last_message_at || null,
      activeChatters: chatSummary?.active_chatters || 0,
    },
    settlementClassification: settlement,
  };
}

/**
 * Generate RFC 4180 compliant CSV string for reports export.
 */
export function exportReportToCsv(type: 'daily' | 'user' | 'session', data: any): string {
  function escapeCsv(val: any): string {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  if (type === 'daily') {
    const lines = [
      `SkillSwap Campus Daily Session Report - Date: ${data.reportDate}`,
      `Generated At: ${data.generatedAt}`,
      '',
      'OVERVIEW METRICS',
      'Metric,Value',
      `Total Sessions,${data.overview.totalSessions}`,
      `Completed Sessions,${data.overview.completedSessions}`,
      `Cancelled Sessions,${data.overview.cancelledSessions}`,
      `Disputed Sessions,${data.overview.disputedSessions}`,
      `Successful Skill Exchanges,${data.overview.successfulSkillExchanges}`,
      `Credit-Based Sessions,${data.overview.creditBasedSessions}`,
      `Pending Sessions,${data.overview.pendingSessions}`,
      `Total Credits Transferred,${data.creditActivity.totalTransferred}`,
      '',
      'DAILY SESSIONS DETAIL',
      'Session ID,Title,Skill,Teacher,Learner,Scheduled Start,Duration (Hours),Status,Settlement Type,Credit Amount',
    ];

    for (const s of data.sessions || []) {
      lines.push([
        escapeCsv(s.id),
        escapeCsv(s.title),
        escapeCsv(s.skill_name),
        escapeCsv(s.teacher_name),
        escapeCsv(s.learner_name),
        escapeCsv(s.scheduled_start),
        escapeCsv(s.duration_hours),
        escapeCsv(s.status),
        escapeCsv(s.settlement_classification),
        escapeCsv(s.credits_amount || 1),
      ].join(','));
    }

    return lines.join('\r\n');
  }

  if (type === 'user') {
    const lines = [
      `SkillSwap Campus User Activity Report - User: ${data.user.display_name} (${data.user.email})`,
      `User ID: ${data.user.id}, Role: ${data.user.role}, College: ${data.user.college || 'N/A'}`,
      '',
      'USER ACTIVITY SUMMARY',
      'Metric,Value',
      `Total Sessions,${data.summary.totalSessions}`,
      `Learner Sessions,${data.summary.learnerSessions}`,
      `Trainer Sessions,${data.summary.trainerSessions}`,
      `Completed Sessions,${data.summary.completedSessions}`,
      `Cancelled Sessions,${data.summary.cancelledSessions}`,
      `Disputed Sessions,${data.summary.disputedSessions}`,
      `Credits Earned,${data.creditSummary.earned}`,
      `Credits Spent,${data.creditSummary.spent}`,
      `Credits Transferred,${data.creditSummary.transferred}`,
      `Credits Refunded,${data.creditSummary.refunded}`,
      '',
      'SESSION HISTORY TIMELINE',
      'Session ID,Date,Time,Skill,User Role,Partner,Partner Role,Status,Settlement,Credit Direction,Outcome',
    ];

    for (const s of data.sessionTimeline || []) {
      lines.push([
        escapeCsv(s.sessionId),
        escapeCsv(s.scheduledStart.substring(0, 10)),
        escapeCsv(s.scheduledStart.substring(11, 16)),
        escapeCsv(s.skillName),
        escapeCsv(s.selectedUserRole),
        escapeCsv(s.partner.name),
        escapeCsv(s.partner.role),
        escapeCsv(s.status),
        escapeCsv(s.settlementClassification),
        escapeCsv(s.creditDirection ? s.creditDirection.directionFormatted : 'None'),
        escapeCsv(s.outcome),
      ].join(','));
    }

    return lines.join('\r\n');
  }

  if (type === 'session') {
    const s = data.session;
    const lines = [
      `SkillSwap Campus Session Audit Report - Session ID: ${s.id}`,
      `Title: ${s.title}, Skill: ${s.skill_name} (${s.skill_category})`,
      `Scheduled Start: ${s.scheduled_start}, Duration: ${s.duration_hours}h`,
      `Status: ${s.status}, Settlement Classification: ${data.settlementClassification}`,
      '',
      'PARTICIPANTS',
      'Role,Name,User ID,College,Verified Student',
    ];

    for (const p of data.participants || []) {
      lines.push([
        escapeCsv(p.session_role),
        escapeCsv(p.display_name),
        escapeCsv(p.user_id),
        escapeCsv(p.college),
        escapeCsv(p.is_verified_student ? 'YES' : 'NO'),
      ].join(','));
    }

    lines.push('');
    lines.push('CREDIT TRANSACTIONS');
    lines.push('Transaction ID,From,To,Amount,Type,Status,Created At');
    for (const ctx of data.creditTransactions || []) {
      lines.push([
        escapeCsv(ctx.id),
        escapeCsv(ctx.sender_name || 'System'),
        escapeCsv(ctx.receiver_name || 'System'),
        escapeCsv(ctx.amount),
        escapeCsv(ctx.transaction_type),
        escapeCsv(ctx.status),
        escapeCsv(ctx.created_at),
      ].join(','));
    }

    return lines.join('\r\n');
  }

  return '';
}
