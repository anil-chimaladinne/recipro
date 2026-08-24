import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ModeratorActionSchema } from '@/lib/validations';
import { refundEscrowCredits, settleSessionCredits } from '@/lib/state-machine';

export async function GET(req: NextRequest) {
  const authRes = requireRole(req, ['MODERATOR', 'ADMIN']);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const db = getDb();

  // 1. Overview metrics
  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  const flaggedAlertsCount = (db.prepare("SELECT COUNT(*) as c FROM fraud_alerts WHERE status = 'PENDING_REVIEW'").get() as any).c;
  const openReportsCount = (db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'OPEN'").get() as any).c;
  const openDisputesCount = (db.prepare("SELECT COUNT(*) as c FROM disputes WHERE status = 'OPEN'").get() as any).c;
  const totalSessionsCount = (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as any).c;

  // 2. Fraud Alerts
  const fraudAlerts = db.prepare(`
    SELECT fa.*, p.display_name, p.college, p.major, u.email, u.status as user_status
    FROM fraud_alerts fa
    JOIN users u ON fa.user_id = u.id
    JOIN profiles p ON u.id = p.user_id
    ORDER BY fa.risk_score DESC, fa.created_at DESC
    LIMIT 20
  `).all();

  // 3. User Reports
  const reports = db.prepare(`
    SELECT 
      r.*,
      rp.display_name as reporter_name,
      tp.display_name as reported_name
    FROM reports r
    JOIN profiles rp ON r.reporter_id = rp.user_id
    JOIN profiles tp ON r.reported_id = tp.user_id
    ORDER BY r.created_at DESC
    LIMIT 20
  `).all();

  // 4. Disputes
  const disputes = db.prepare(`
    SELECT 
      d.*,
      s.title as session_title, s.credits_amount, s.teacher_id, s.learner_id,
      ip.display_name as initiator_name
    FROM disputes d
    JOIN sessions s ON d.session_id = s.id
    JOIN profiles ip ON d.initiator_id = ip.user_id
    ORDER BY d.created_at DESC
    LIMIT 20
  `).all();

  // 5. Recent Audit Logs
  const auditLogs = db.prepare(`
    SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 25
  `).all();

  return NextResponse.json({
    metrics: {
      totalUsers,
      flaggedAlertsCount,
      openReportsCount,
      openDisputesCount,
      totalSessionsCount,
    },
    fraudAlerts,
    reports,
    disputes,
    auditLogs,
  });
}

export async function POST(req: NextRequest) {
  const authRes = requireRole(req, ['MODERATOR', 'ADMIN']);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const body = await req.json();
    const parsed = ModeratorActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid moderator action schema', details: parsed.error.format() }, { status: 400 });
    }

    const { targetType, targetId, action, reason } = parsed.data;

    const tx = db.transaction(() => {
      let prevStatus = 'UNKNOWN';

      if (action === 'SUSPEND_USER') {
        const u = db.prepare('SELECT status FROM users WHERE id = ?').get(targetId) as any;
        prevStatus = u?.status || 'ACTIVE';
        db.prepare("UPDATE users SET status = 'SUSPENDED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(targetId);
      } else if (action === 'RESTRICT_CREDITS') {
        db.prepare("UPDATE users SET status = 'RESTRICTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(targetId);
      } else if (action === 'CLEAR_ALERT') {
        db.prepare("UPDATE fraud_alerts SET status = 'CLEARED', reviewed_by = ?, review_notes = ? WHERE id = ?").run(user.userId, reason, targetId);
      } else if (action === 'DISMISS_REPORT') {
        db.prepare("UPDATE reports SET status = 'DISMISSED', resolution_notes = ?, moderator_id = ? WHERE id = ?").run(reason, user.userId, targetId);
      } else if (action === 'RESOLVE_REFUND') {
        // Resolve dispute by refunding learner
        const dispute = db.prepare('SELECT session_id FROM disputes WHERE id = ?').get(targetId) as any;
        if (dispute) {
          const sess = db.prepare('SELECT * FROM sessions WHERE id = ?').get(dispute.session_id) as any;
          if (sess) {
            refundEscrowCredits(sess.learner_id, sess.credits_amount, sess.id, `Moderator Refund: ${reason}`);
            db.prepare("UPDATE sessions SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(sess.id);
            db.prepare("UPDATE disputes SET status = 'RESOLVED_REFUND', moderator_id = ?, resolution_notes = ? WHERE id = ?").run(user.userId, reason, targetId);
          }
        }
      } else if (action === 'RESOLVE_PAYOUT') {
        // Resolve dispute by settling credits to teacher
        const dispute = db.prepare('SELECT session_id FROM disputes WHERE id = ?').get(targetId) as any;
        if (dispute) {
          settleSessionCredits(dispute.session_id);
          db.prepare("UPDATE disputes SET status = 'RESOLVED_PAYOUT', moderator_id = ?, resolution_notes = ? WHERE id = ?").run(user.userId, reason, targetId);
        }
      }

      // Record in Audit Log
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, previous_state, new_state)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `audit-${Date.now()}`,
        user.userId,
        `MODERATOR_${action}`,
        targetType,
        targetId,
        prevStatus,
        action
      );
    });

    tx();

    return NextResponse.json({
      success: true,
      message: `Moderator action "${action}" executed and recorded in campus audit log.`,
    });
  } catch (err: any) {
    console.error('Moderator Action Error:', err);
    return NextResponse.json({ error: 'Failed to process moderator action' }, { status: 500 });
  }
}
