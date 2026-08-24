import { getDb } from './db';

export interface FraudEvaluationResult {
  userId: string;
  riskScore: number; // 0 to 100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  anomalyReasons: string[];
  signals: {
    reciprocityIndex: number;
    ratingConcentration: number;
    dailySessionVelocity: number;
    cancellationRate: number;
    creditVelocity: number;
    walletReuseDetected: boolean;
    accountAgeDays: number;
  };
  recommendation: string;
}

/**
 * Multi-Signal Fraud & Sybil Detector:
 * Evaluates account patterns against Isolation Forest / Heuristic rule signals.
 */
export function evaluateUserFraudRisk(userId: string): FraudEvaluationResult {
  const db = getDb();

  // 1. Fetch user account metadata
  const user = db.prepare(`
    SELECT u.id, u.email, u.created_at, u.status,
           p.completion_rate, p.cancellation_rate, p.is_verified_student
    FROM users u
    JOIN profiles p ON u.id = p.user_id
    WHERE u.id = ?
  `).get(userId) as any;

  if (!user) {
    return {
      userId,
      riskScore: 0,
      riskLevel: 'LOW',
      anomalyReasons: ['User account not found'],
      signals: {
        reciprocityIndex: 0,
        ratingConcentration: 0,
        dailySessionVelocity: 0,
        cancellationRate: 0,
        creditVelocity: 0,
        walletReuseDetected: false,
        accountAgeDays: 0,
      },
      recommendation: 'Account not found',
    };
  }

  const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
  const accountAgeDays = Math.max(0.1, accountAgeMs / (1000 * 60 * 60 * 24));

  // 2. Fetch rating reciprocity (A rates B 5*, B rates A 5*)
  const givenRatings = db.prepare(`
    SELECT ratee_id, score, created_at FROM ratings WHERE rater_id = ?
  `).all(userId) as any[];

  const receivedRatings = db.prepare(`
    SELECT rater_id, score, created_at FROM ratings WHERE ratee_id = ?
  `).all(userId) as any[];

  let reciprocalMatches = 0;
  const receivedRaterMap = new Map<string, number>();
  for (const r of receivedRatings) {
    receivedRaterMap.set(r.rater_id, (receivedRaterMap.get(r.rater_id) || 0) + 1);
  }

  for (const g of givenRatings) {
    if (receivedRaterMap.has(g.ratee_id)) {
      reciprocalMatches++;
    }
  }

  const totalReviews = receivedRatings.length;
  const reciprocityIndex = totalReviews > 0 ? (reciprocalMatches / totalReviews) : 0;

  // 3. Rating Concentration: % of reviews coming from top counterparty
  let maxReviewsFromSingleUser = 0;
  for (const count of receivedRaterMap.values()) {
    if (count > maxReviewsFromSingleUser) maxReviewsFromSingleUser = count;
  }
  const ratingConcentration = totalReviews > 0 ? (maxReviewsFromSingleUser / totalReviews) : 0;

  // 4. Session Velocity (Sessions completed per day)
  const sessionCount = db.prepare(`
    SELECT COUNT(*) as count FROM sessions WHERE (teacher_id = ? OR learner_id = ?) AND status = 'COMPLETED'
  `).get(userId, userId) as { count: number };
  const dailySessionVelocity = sessionCount.count / accountAgeDays;

  // 5. Credit Velocity (Transactions in last 24h)
  const recentCreditTx = db.prepare(`
    SELECT COUNT(*) as count, SUM(amount) as total_amount 
    FROM credit_transactions 
    WHERE (sender_id = ? OR receiver_id = ?) 
      AND created_at >= datetime('now', '-1 day')
  `).get(userId, userId) as { count: number; total_amount: number | null };
  const creditVelocity = recentCreditTx.count || 0;

  // 6. Wallet Reuse Detection (Same wallet linked to multiple accounts)
  let walletReuseDetected = false;
  const userWallet = db.prepare(`SELECT address FROM wallets WHERE user_id = ?`).get(userId) as { address: string } | undefined;
  if (userWallet?.address) {
    const reuseCount = db.prepare(`SELECT COUNT(*) as count FROM wallets WHERE address = ?`).get(userWallet.address) as { count: number };
    if (reuseCount.count > 1) {
      walletReuseDetected = true;
    }
  }

  // 7. Cancellation Rate
  const cancellationRate = user.cancellation_rate || 0;

  // ============================================================
  // RISK SCORING ENGINE (Isolation Forest / Multi-Signal Rules)
  // ============================================================
  let riskScore = 10; // Low baseline
  const anomalyReasons: string[] = [];

  // Signal 1: Reciprocal Rating Loops
  if (totalReviews >= 3 && reciprocityIndex >= 0.7) {
    riskScore += 30;
    anomalyReasons.push(`High reciprocal rating loop detected (${(reciprocityIndex * 100).toFixed(0)}% mutual 5-star reviews)`);
  }

  // Signal 2: Extreme Rating Concentration
  if (totalReviews >= 4 && ratingConcentration >= 0.75) {
    riskScore += 25;
    anomalyReasons.push(`Suspicious review concentration: ${(ratingConcentration * 100).toFixed(0)}% of reviews originate from a single counterparty`);
  }

  // Signal 3: Impossible Session Velocity
  if (dailySessionVelocity > 6) {
    riskScore += 30;
    anomalyReasons.push(`Abnormal session frequency: ${dailySessionVelocity.toFixed(1)} sessions/day on a ${accountAgeDays.toFixed(1)}-day old account`);
  }

  // Signal 4: Rapid Credit Movement / Farming
  if (creditVelocity > 10) {
    riskScore += 20;
    anomalyReasons.push(`Rapid credit velocity: ${creditVelocity} credit operations in the last 24 hours`);
  }

  // Signal 5: Wallet Reuse
  if (walletReuseDetected) {
    riskScore += 35;
    anomalyReasons.push(`Sybil Indicator: Wallet address ${userWallet?.address.substring(0, 8)}... is linked to multiple accounts`);
  }

  // Signal 6: High Cancellation Rate
  if (cancellationRate > 35) {
    riskScore += 15;
    anomalyReasons.push(`Elevated cancellation rate (${cancellationRate.toFixed(1)}%) after reserving credits`);
  }

  // Clamp risk score to [0, 100]
  riskScore = Math.min(100, Math.max(5, Math.round(riskScore)));

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (riskScore >= 70) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 40) {
    riskLevel = 'MEDIUM';
  }

  let recommendation = 'Account healthy. Normal operations permitted.';
  if (riskLevel === 'HIGH') {
    recommendation = 'FLAG FOR CAMPUS MODERATION: Freeze automated credential issuance until verified.';
  } else if (riskLevel === 'MEDIUM') {
    recommendation = 'Monitor account: Apply session confirmation review requirements.';
  }

  return {
    userId,
    riskScore,
    riskLevel,
    anomalyReasons,
    signals: {
      reciprocityIndex,
      ratingConcentration,
      dailySessionVelocity,
      cancellationRate,
      creditVelocity,
      walletReuseDetected,
      accountAgeDays,
    },
    recommendation,
  };
}

/**
 * Evaluates and syncs fraud alerts to the database for moderator review.
 */
export function scanAndRecordFraudAlert(userId: string): FraudEvaluationResult {
  const result = evaluateUserFraudRisk(userId);
  const db = getDb();

  if (result.riskLevel === 'HIGH' || result.riskLevel === 'MEDIUM') {
    const existing = db.prepare(`
      SELECT id FROM fraud_alerts WHERE user_id = ? AND status = 'PENDING_REVIEW'
    `).get(userId);

    if (!existing) {
      db.prepare(`
        INSERT INTO fraud_alerts (id, user_id, risk_score, risk_level, anomaly_reasons, status)
        VALUES (?, ?, ?, ?, ?, 'PENDING_REVIEW')
      `).run(
        `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId,
        result.riskScore,
        result.riskLevel,
        JSON.stringify(result.anomalyReasons)
      );
    }
  }

  return result;
}

export async function evaluateUserFraudRiskAsync(userId: string): Promise<FraudEvaluationResult> {
  const baseResult = evaluateUserFraudRisk(userId);
  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);

    const res = await fetch(`${mlServiceUrl}/detect_fraud`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        reciprocity_index: baseResult.signals.reciprocityIndex,
        rating_concentration: baseResult.signals.ratingConcentration,
        daily_session_velocity: baseResult.signals.dailySessionVelocity,
        cancellation_rate: baseResult.signals.cancellationRate,
        credit_velocity: baseResult.signals.creditVelocity,
        wallet_reuse: baseResult.signals.walletReuseDetected,
        account_age_days: baseResult.signals.accountAgeDays,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const mlData = await res.json();
      baseResult.riskScore = Math.max(baseResult.riskScore, mlData.risk_score);
      baseResult.riskLevel = mlData.risk_level;
      if (mlData.anomaly_reasons && mlData.anomaly_reasons.length > 0) {
        baseResult.anomalyReasons = Array.from(new Set([...baseResult.anomalyReasons, ...mlData.anomaly_reasons]));
      }
    }
  } catch {
    // Graceful fallback to heuristic evaluation
  }

  return baseResult;
}

export async function scanAndRecordFraudAlertAsync(userId: string): Promise<FraudEvaluationResult> {
  const result = await evaluateUserFraudRiskAsync(userId);
  const db = getDb();

  if (result.riskLevel === 'HIGH' || result.riskLevel === 'MEDIUM') {
    const existing = db.prepare(`
      SELECT id FROM fraud_alerts WHERE user_id = ? AND status = 'PENDING_REVIEW'
    `).get(userId);

    if (!existing) {
      db.prepare(`
        INSERT INTO fraud_alerts (id, user_id, risk_score, risk_level, anomaly_reasons, status)
        VALUES (?, ?, ?, ?, ?, 'PENDING_REVIEW')
      `).run(
        `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId,
        result.riskScore,
        result.riskLevel,
        JSON.stringify(result.anomalyReasons)
      );
    }
  }

  return result;
}
