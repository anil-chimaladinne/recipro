import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { BookSessionSchema } from '@/lib/validations';
import { reserveEscrowCredits, recordSessionEvent } from '@/lib/state-machine';
import { checkSlotHardConstraints } from '@/lib/scheduling';
import { NotificationService } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();
  const { searchParams } = new URL(req.url);

  const search = (searchParams.get('search') || searchParams.get('q') || '').trim();
  const status = searchParams.get('status') || 'ALL';
  const skill = searchParams.get('skill') || 'ALL';
  const role = searchParams.get('role') || 'ALL'; // ALL, TEACHING, LEARNING
  const mode = searchParams.get('mode') || 'ALL'; // ALL, ONLINE, CAMPUS_IN_PERSON
  const creditStatus = searchParams.get('creditStatus') || 'ALL'; // ALL, RESERVED, SETTLED, REFUNDED
  const dateFilter = searchParams.get('dateFilter') || 'ALL';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const timeStart = searchParams.get('timeStart') || '';
  const timeEnd = searchParams.get('timeEnd') || '';
  const sort = searchParams.get('sort') || 'UPCOMING_FIRST';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '15', 10)));
  const offset = (page - 1) * limit;

  try {
    let whereClauses: string[] = ['(s.teacher_id = ? OR s.learner_id = ?)'];
    let queryParams: any[] = [user.userId, user.userId];

    // Role filter
    if (role === 'TEACHING') {
      whereClauses = ['s.teacher_id = ?'];
      queryParams = [user.userId];
    } else if (role === 'LEARNING') {
      whereClauses = ['s.learner_id = ?'];
      queryParams = [user.userId];
    }

    // Status filter
    if (status !== 'ALL') {
      if (status === 'ACTIVE' || status === 'UPCOMING') {
        whereClauses.push("s.status IN ('REQUESTED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS')");
      } else if (status === 'COMPLETED') {
        whereClauses.push("s.status IN ('COMPLETED', 'CREDIT_SETTLED')");
      } else {
        whereClauses.push('s.status = ?');
        queryParams.push(status);
      }
    }

    // Skill filter
    if (skill !== 'ALL') {
      whereClauses.push('LOWER(sk.name) LIKE LOWER(?)');
      queryParams.push(`%${skill}%`);
    }

    // Mode filter
    if (mode !== 'ALL') {
      whereClauses.push('s.mode = ?');
      queryParams.push(mode);
    }

    // Search query
    if (search) {
      whereClauses.push(`(
        LOWER(sk.name) LIKE LOWER(?) OR
        LOWER(s.title) LIKE LOWER(?) OR
        LOWER(tp.display_name) LIKE LOWER(?) OR
        LOWER(lp.display_name) LIKE LOWER(?) OR
        LOWER(s.id) LIKE LOWER(?)
      )`);
      const sTerm = `%${search}%`;
      queryParams.push(sTerm, sTerm, sTerm, sTerm, sTerm);
    }

    // Date Filters
    const today = new Date().toISOString().substring(0, 10);
    if (dateFilter === 'TODAY') {
      whereClauses.push('DATE(s.scheduled_start) = DATE(?)');
      queryParams.push(today);
    } else if (dateFilter === 'TOMORROW') {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().substring(0, 10);
      whereClauses.push('DATE(s.scheduled_start) = DATE(?)');
      queryParams.push(tomorrow);
    } else if (dateFilter === 'THIS_WEEK' || dateFilter === 'NEXT_7_DAYS') {
      const next7 = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);
      whereClauses.push('DATE(s.scheduled_start) >= DATE(?) AND DATE(s.scheduled_start) <= DATE(?)');
      queryParams.push(today, next7);
    } else if (dateFilter === 'THIS_MONTH') {
      const monthPrefix = today.substring(0, 7);
      whereClauses.push("strftime('%Y-%m', s.scheduled_start) = ?");
      queryParams.push(monthPrefix);
    } else if (dateFilter === 'CUSTOM') {
      if (dateFrom) {
        whereClauses.push('DATE(s.scheduled_start) >= DATE(?)');
        queryParams.push(dateFrom);
      }
      if (dateTo) {
        whereClauses.push('DATE(s.scheduled_start) <= DATE(?)');
        queryParams.push(dateTo);
      }
    }

    // Time Filters (HH:MM)
    if (timeStart) {
      whereClauses.push("strftime('%H:%M', s.scheduled_start) >= ?");
      queryParams.push(timeStart);
    }
    if (timeEnd) {
      whereClauses.push("strftime('%H:%M', s.scheduled_start) <= ?");
      queryParams.push(timeEnd);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    // Order By
    let orderBySql = 's.scheduled_start DESC';
    if (sort === 'UPCOMING_FIRST') {
      orderBySql = `
        CASE 
          WHEN s.status IN ('SCHEDULED', 'ACCEPTED', 'REQUESTED', 'IN_PROGRESS') THEN 0
          ELSE 1
        END ASC,
        s.scheduled_start ASC
      `;
    } else if (sort === 'NEWEST_FIRST') {
      orderBySql = 's.created_at DESC';
    } else if (sort === 'OLDEST_FIRST') {
      orderBySql = 's.created_at ASC';
    } else if (sort === 'RECENTLY_UPDATED') {
      orderBySql = 's.updated_at DESC';
    } else if (sort === 'RECENTLY_COMPLETED') {
      orderBySql = `
        CASE 
          WHEN s.status IN ('COMPLETED', 'CREDIT_SETTLED') THEN 0
          ELSE 1
        END ASC,
        s.updated_at DESC
      `;
    }

    // 1. Fetch Total Count for Pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sessions s
      LEFT JOIN skills sk ON s.skill_id = sk.id
      LEFT JOIN profiles tp ON s.teacher_id = tp.user_id
      LEFT JOIN profiles lp ON s.learner_id = lp.user_id
      ${whereSql}
    `;
    const total = (db.prepare(countQuery).get(...queryParams) as any).total;

    // 2. Fetch Sessions List
    const selectQuery = `
      SELECT 
        s.*,
        sk.name as skill_name, sk.category as skill_category, sk.icon as skill_icon,
        COALESCE(tp.display_name, 'Teacher') as teacher_name, tp.avatar as teacher_avatar, tp.college as teacher_college,
        COALESCE(lp.display_name, 'Learner') as learner_name, lp.avatar as learner_avatar, lp.college as learner_college,
        r.id as rating_id, r.score as rating_score,
        sea.id as agreement_id,
        sea.requested_return_skill_name as agreement_return_skill,
        sea.return_type as agreement_return_type,
        sea.credit_amount as agreement_credit_amount,
        sea.status as agreement_status,
        sea.proposed_by as agreement_proposed_by
      FROM sessions s
      LEFT JOIN skills sk ON s.skill_id = sk.id
      LEFT JOIN profiles tp ON s.teacher_id = tp.user_id
      LEFT JOIN profiles lp ON s.learner_id = lp.user_id
      LEFT JOIN session_exchange_agreements sea ON s.id = sea.session_id
      LEFT JOIN ratings r ON s.id = r.session_id AND r.rater_id = ?
      ${whereSql}
      ORDER BY ${orderBySql}
      LIMIT ? OFFSET ?
    `;
    const sessions = db.prepare(selectQuery).all(user.userId, ...queryParams, limit, offset);

    // 3. Compute Real Persisted Summary Counters for User
    const userSummary = db.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status IN ('SCHEDULED', 'ACCEPTED', 'IN_PROGRESS') THEN 1 ELSE 0 END) as upcoming_sessions,
        SUM(CASE WHEN status = 'REQUESTED' THEN 1 ELSE 0 END) as pending_requests,
        SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted_sessions,
        SUM(CASE WHEN status IN ('COMPLETED', 'CREDIT_SETTLED') THEN 1 ELSE 0 END) as completed_sessions,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_sessions,
        SUM(CASE WHEN status = 'DISPUTED' THEN 1 ELSE 0 END) as disputed_sessions,
        SUM(CASE WHEN teacher_id = ? AND status IN ('COMPLETED', 'CREDIT_SETTLED') THEN credits_amount ELSE 0 END) as credits_earned,
        SUM(CASE WHEN learner_id = ? AND status IN ('COMPLETED', 'CREDIT_SETTLED') THEN credits_amount ELSE 0 END) as credits_spent
      FROM sessions
      WHERE teacher_id = ? OR learner_id = ?
    `).get(user.userId, user.userId, user.userId, user.userId) as any;

    return NextResponse.json({
      sessions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalSessions: userSummary?.total_sessions || 0,
        upcomingSessions: userSummary?.upcoming_sessions || 0,
        pendingRequests: userSummary?.pending_requests || 0,
        acceptedSessions: userSummary?.accepted_sessions || 0,
        completedSessions: userSummary?.completed_sessions || 0,
        cancelledSessions: userSummary?.cancelled_sessions || 0,
        disputedSessions: userSummary?.disputed_sessions || 0,
        creditsEarned: userSummary?.credits_earned || 0,
        creditsSpent: userSummary?.credits_spent || 0,
      },
    });
  } catch (err: any) {
    console.error('Fetch Sessions Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve sessions', details: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const body = await req.json();
    const parsed = BookSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid booking data', details: parsed.error.format() }, { status: 400 });
    }

    const { teacherId, skillId, title, scheduledStart, scheduledEnd, durationHours, creditsAmount, mode, notes } = parsed.data;

    if (teacherId === user.userId) {
      return NextResponse.json({ error: 'You cannot book a skill session with yourself' }, { status: 400 });
    }

    // Verify teacher exists and teaches this skill
    const teacherSkill = db.prepare(`
      SELECT us.id, us.verification_status FROM user_skills us WHERE us.user_id = ? AND us.skill_id = ?
    `).get(teacherId, skillId) as { id: string; verification_status: string } | undefined;

    if (!teacherSkill) {
      return NextResponse.json({ error: 'The selected mentor does not teach this skill' }, { status: 400 });
    }

    // Pre-check learner credit balance
    const account = db.prepare(`
      SELECT balance FROM skill_credit_accounts WHERE user_id = ?
    `).get(user.userId) as { balance: number } | undefined;

    if (!account || account.balance < creditsAmount) {
      return NextResponse.json({ 
        error: `Insufficient Skill Credits. You have ${account?.balance || 0} credits, but ${creditsAmount} is required.` 
      }, { status: 402 });
    }

    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const idempotencyKey = `book-${sessionId}`;

    // Execute atomic booking transaction with hard scheduling constraint check
    let conflictResult: { hasConflict: boolean; reason?: string; nextAvailableSlot?: string } = { hasConflict: false };

    const bookingTx = db.transaction(() => {
      // 1. Check Hard Constraints atomically inside transaction
      conflictResult = checkSlotHardConstraints(db, {
        teacherId,
        learnerId: user.userId,
        scheduledStart,
        scheduledEnd,
        bufferMinutes: 15,
      });

      if (conflictResult.hasConflict) {
        return; // Abort booking transaction
      }

      // 2. Insert Session Record FIRST (Satisfies Foreign Key constraints for subsequent credit transactions)
      const meetingUrl = `https://meet.skillswap.internal/room/${sessionId}`;
      db.prepare(`
        INSERT INTO sessions (
          id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, mode, location_or_url, idempotency_key, notes
        ) VALUES (?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        title,
        skillId,
        teacherId,
        user.userId,
        scheduledStart,
        scheduledEnd,
        durationHours,
        creditsAmount,
        mode,
        meetingUrl,
        idempotencyKey,
        notes || ''
      );

      // 2b. Insert Session Participants (Explicit Session Roles)
      db.prepare(`
        INSERT OR IGNORE INTO session_participants (id, session_id, user_id, session_role, confirmed)
        VALUES (?, ?, ?, 'TRAINER', 0), (?, ?, ?, 'LEARNER', 0)
      `).run(
        `sp-${sessionId}-trainer`,
        sessionId,
        teacherId,
        `sp-${sessionId}-learner`,
        sessionId,
        user.userId
      );

      // 3. Reserve Learner Escrow Credits (Now references existing sessionId)
      const escrowRes = reserveEscrowCredits(user.userId, creditsAmount, sessionId, idempotencyKey);
      if (!escrowRes.success) {
        throw new Error(`INSUFFICIENT_CREDITS:${escrowRes.message}`);
      }

      // 4. Record Initial Lifecycle Audit Event
      recordSessionEvent(
        sessionId,
        user.userId,
        'REQUESTED',
        'Session Requested',
        `Learner requested a ${durationHours}h ${mode} session with 1 credit reserved in escrow.`,
        undefined,
        'REQUESTED'
      );

      // 5. Notify Teacher
      NotificationService.send(db, {
        userId: teacherId,
        type: 'SESSION_REQUESTED',
        title: 'New Session Request',
        message: `${user.email} requested a ${durationHours} hour skill session for ${title}`,
        relatedEntityType: 'SESSION',
        relatedEntityId: sessionId,
        actionUrl: `/sessions/${sessionId}`,
      });
    });

    try {
      bookingTx();
    } catch (txErr: any) {
      if (txErr.message.startsWith('INSUFFICIENT_CREDITS:')) {
        return NextResponse.json({ error: txErr.message.replace('INSUFFICIENT_CREDITS:', '') }, { status: 402 });
      }
      throw txErr;
    }

    if (conflictResult.hasConflict) {
      return NextResponse.json({ 
        error: conflictResult.reason || 'Selected time slot is unavailable',
        nextAvailableSlot: conflictResult.nextAvailableSlot,
      }, { status: 409 });
    }

    const createdSession = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId);
    return NextResponse.json({ session: createdSession }, { status: 201 });
  } catch (err: any) {
    console.error('Book Session Error:', err);
    return NextResponse.json({ error: 'Failed to book session', details: err.message }, { status: 500 });
  }
}
