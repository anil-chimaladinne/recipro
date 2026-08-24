import Database from 'better-sqlite3';
import { getDb } from './db';
import { EmailService } from './email-service';

export type NotificationType =
  | 'SESSION_REQUESTED'
  | 'SESSION_ACCEPTED'
  | 'SESSION_REJECTED'
  | 'SESSION_CANCELLED'
  | 'SESSION_REMINDER'
  | 'SESSION_STARTED'
  | 'SESSION_COMPLETION_PENDING'
  | 'SESSION_COMPLETED'
  | 'SESSION_DISPUTED'
  | 'CREDIT_RESERVED'
  | 'CREDIT_SETTLED'
  | 'CREDIT_REFUNDED'
  | 'MENTOR_AVAILABLE'
  | 'LEARNER_REQUEST_CREATED'
  | 'LEARNER_REQUEST_UPDATED'
  | 'SKILL_VERIFIED'
  | 'SKILL_ASSESSMENT_FAILED'
  | 'CREDENTIAL_ISSUED'
  | 'SECURITY_ALERT'
  | 'SYSTEM_NOTIFICATION';

export type NotificationCategory =
  | 'ALL'
  | 'SESSIONS'
  | 'MENTORS'
  | 'LEARNING_REQUESTS'
  | 'CREDITS'
  | 'SECURITY'
  | 'SYSTEM';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: 'SESSION' | 'MENTOR' | 'LEARNER_REQUEST' | 'CREDIT' | 'SECURITY' | 'SYSTEM';
  relatedEntityId?: string;
  actionUrl?: string;
  link?: string;
  mentorName?: string;
  skillName?: string;
  mentorVerification?: string;
  availabilityWindow?: string;
  matchScore?: number;
  requestId?: string;
}

export class NotificationService {
  /**
   * Helper to map notification type to category
   */
  static getCategoryForType(type: string): NotificationCategory {
    if (type.startsWith('SESSION_')) return 'SESSIONS';
    if (type === 'MENTOR_AVAILABLE') return 'MENTORS';
    if (type.startsWith('LEARNER_REQUEST_')) return 'LEARNING_REQUESTS';
    if (type.startsWith('CREDIT_')) return 'CREDITS';
    if (type.startsWith('SECURITY_')) return 'SECURITY';
    return 'SYSTEM';
  }

  /**
   * Dispatches notifications across In-App, Email, and Push with full user preferences & delivery tracking
   */
  static async send(db: Database.Database, payload: NotificationPayload): Promise<{
    inAppSuccess: boolean;
    emailSuccess: boolean;
    notificationId: string;
  }> {
    // 1. Fetch user notification preferences
    let prefs = db.prepare(`
      SELECT * FROM notification_preferences WHERE user_id = ?
    `).get(payload.userId) as any;

    if (!prefs) {
      // Default preferences: All enabled
      db.prepare(`
        INSERT INTO notification_preferences (user_id, in_app_enabled, email_enabled, session_updates, mentor_available, credits, security, system)
        VALUES (?, 1, 1, 1, 1, 1, 1, 1)
      `).run(payload.userId);
      prefs = {
        in_app_enabled: 1,
        email_enabled: 1,
        session_updates: 1,
        mentor_available: 1,
        credits: 1,
        security: 1,
        system: 1,
      };
    }

    const userProfile = db.prepare(`
      SELECT u.email, p.display_name
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(payload.userId) as { email: string; display_name: string } | undefined;

    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const category = this.getCategoryForType(payload.type);
    let inAppSuccess = false;
    let emailSuccess = false;

    // Check if category is enabled in in-app
    const categoryEnabled =
      category === 'SECURITY' ? true : // Security notifications always ON
      category === 'SESSIONS' ? prefs.session_updates === 1 :
      category === 'MENTORS' ? prefs.mentor_available === 1 :
      category === 'LEARNING_REQUESTS' ? prefs.mentor_available === 1 :
      category === 'CREDITS' ? prefs.credits === 1 :
      prefs.system === 1;

    // 1. IN-APP PERSISTENCE
    if (prefs.in_app_enabled && categoryEnabled) {
      try {
        db.prepare(`
          INSERT INTO notifications (
            id, user_id, type, title, message, related_entity_type, related_entity_id, action_url, link, is_read, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
        `).run(
          notificationId,
          payload.userId,
          payload.type,
          payload.title,
          payload.message,
          payload.relatedEntityType || category,
          payload.relatedEntityId || payload.requestId || null,
          payload.actionUrl || payload.link || '/notifications',
          payload.link || payload.actionUrl || '/notifications'
        );
        inAppSuccess = true;
      } catch (err) {
        console.error('In-App Notification Error:', err);
      }
    }

    // 2. EMAIL DISPATCH
    if (prefs.email_enabled && categoryEnabled && userProfile?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      if (payload.type === 'MENTOR_AVAILABLE' && payload.requestId) {
        // Mentor Available Email with Yes/No Confirmation Action
        const confirmUrl = `${appUrl}/learner-requests/${payload.requestId}/confirm-match?mentorId=${payload.relatedEntityId || ''}`;
        const declineUrl = `${appUrl}/learner-requests/${payload.requestId}/decline-match?mentorId=${payload.relatedEntityId || ''}`;

        const emailRes = await EmailService.sendMentorAvailableEmail(db, {
          to: userProfile.email,
          learnerName: userProfile.display_name || 'Learner',
          skillName: payload.skillName || 'Requested Skill',
          mentorName: payload.mentorName || 'Campus Peer Mentor',
          mentorVerification: payload.mentorVerification || 'Verified Mentor',
          availabilityWindow: payload.availabilityWindow || 'Preferred schedule',
          matchScore: payload.matchScore,
          confirmUrl,
          declineUrl,
          requestId: payload.requestId,
          mentorId: payload.relatedEntityId || '',
          userId: payload.userId,
          notificationId,
        });
        emailSuccess = emailRes.success;
      } else {
        // General Notification Email
        const emailRes = await EmailService.sendEmail(db, {
          to: userProfile.email,
          subject: payload.title,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h3 style="color: #0f172a;">${payload.title}</h3>
              <p style="color: #334155; font-size: 14px;">${payload.message}</p>
              <div style="margin: 20px 0;">
                <a href="${appUrl}${payload.actionUrl || '/notifications'}" style="background-color: #14b8a6; color: #020617; font-weight: bold; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block;">
                  View on SkillSwap Campus
                </a>
              </div>
            </div>
          `,
          text: payload.message,
          category: payload.type,
          metadata: {
            userId: payload.userId,
            notificationId,
            requestId: payload.requestId,
          },
        });
        emailSuccess = emailRes.success;
      }
    }

    return { inAppSuccess, emailSuccess, notificationId };
  }

  /**
   * Retrieves paginated user notifications with category filtering
   */
  static getUserNotifications(
    db: Database.Database,
    userId: string,
    params: {
      category?: string;
      unreadOnly?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 15));
    const offset = (page - 1) * limit;

    let whereClauses = ['user_id = ?'];
    let queryParams: any[] = [userId];

    if (params.unreadOnly) {
      whereClauses.push('is_read = 0');
    }

    if (params.category && params.category !== 'ALL') {
      const cat = params.category;
      if (cat === 'SESSIONS') {
        whereClauses.push("type LIKE 'SESSION_%'");
      } else if (cat === 'MENTORS') {
        whereClauses.push("type = 'MENTOR_AVAILABLE'");
      } else if (cat === 'LEARNING_REQUESTS') {
        whereClauses.push("type LIKE 'LEARNER_REQUEST_%'");
      } else if (cat === 'CREDITS') {
        whereClauses.push("type LIKE 'CREDIT_%'");
      } else if (cat === 'SECURITY') {
        whereClauses.push("type LIKE 'SECURITY_%'");
      } else if (cat === 'SYSTEM') {
        whereClauses.push("(type LIKE 'SYSTEM_%' OR type = 'INFO' OR type = 'GENERAL')");
      }
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const totalCount = (db.prepare(`
      SELECT COUNT(*) as count FROM notifications ${whereSql}
    `).get(...queryParams) as any).count;

    const unreadCount = (db.prepare(`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
    `).get(userId) as any).count;

    const notifications = db.prepare(`
      SELECT * FROM notifications
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams, limit, offset);

    return {
      notifications,
      unreadCount,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Retrieves quick unread count for navbar badges
   */
  static getUnreadCount(db: Database.Database, userId: string): number {
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
    `).get(userId) as { count: number } | undefined;
    return row?.count || 0;
  }

  /**
   * Marks a single notification as read
   */
  static markAsRead(db: Database.Database, notificationId: string, userId: string): boolean {
    const res = db.prepare(`
      UPDATE notifications 
      SET is_read = 1, read_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ?
    `).run(notificationId, userId);
    return res.changes > 0;
  }

  /**
   * Marks all notifications as read for a user
   */
  static markAllAsRead(db: Database.Database, userId: string): number {
    const res = db.prepare(`
      UPDATE notifications 
      SET is_read = 1, read_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND is_read = 0
    `).run(userId);
    return res.changes;
  }

  /**
   * Get user notification preferences
   */
  static getUserPreferences(db: Database.Database, userId: string) {
    let prefs = db.prepare(`SELECT * FROM notification_preferences WHERE user_id = ?`).get(userId);
    if (!prefs) {
      db.prepare(`
        INSERT INTO notification_preferences (user_id, in_app_enabled, email_enabled, session_updates, mentor_available, credits, security, system)
        VALUES (?, 1, 1, 1, 1, 1, 1, 1)
      `).run(userId);
      prefs = {
        user_id: userId,
        in_app_enabled: 1,
        email_enabled: 1,
        session_updates: 1,
        mentor_available: 1,
        credits: 1,
        security: 1,
        system: 1,
      };
    }
    return prefs;
  }

  /**
   * Update user notification preferences
   */
  static updateUserPreferences(
    db: Database.Database,
    userId: string,
    prefs: {
      inAppEnabled?: boolean;
      emailEnabled?: boolean;
      sessionUpdates?: boolean;
      mentorAvailable?: boolean;
      credits?: boolean;
      system?: boolean;
    }
  ) {
    db.prepare(`
      INSERT INTO notification_preferences (
        user_id, in_app_enabled, email_enabled, session_updates, mentor_available, credits, security, system, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        in_app_enabled = COALESCE(excluded.in_app_enabled, notification_preferences.in_app_enabled),
        email_enabled = COALESCE(excluded.email_enabled, notification_preferences.email_enabled),
        session_updates = COALESCE(excluded.session_updates, notification_preferences.session_updates),
        mentor_available = COALESCE(excluded.mentor_available, notification_preferences.mentor_available),
        credits = COALESCE(excluded.credits, notification_preferences.credits),
        system = COALESCE(excluded.system, notification_preferences.system),
        updated_at = CURRENT_TIMESTAMP
    `).run(
      userId,
      prefs.inAppEnabled !== undefined ? (prefs.inAppEnabled ? 1 : 0) : 1,
      prefs.emailEnabled !== undefined ? (prefs.emailEnabled ? 1 : 0) : 1,
      prefs.sessionUpdates !== undefined ? (prefs.sessionUpdates ? 1 : 0) : 1,
      prefs.mentorAvailable !== undefined ? (prefs.mentorAvailable ? 1 : 0) : 1,
      prefs.credits !== undefined ? (prefs.credits ? 1 : 0) : 1,
      prefs.system !== undefined ? (prefs.system ? 1 : 0) : 1
    );

    return this.getUserPreferences(db, userId);
  }
}
