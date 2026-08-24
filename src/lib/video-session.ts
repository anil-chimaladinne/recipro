import Database from 'better-sqlite3';
import { getDb } from './db';

export interface AuthorizedParticipant {
  authorized: boolean;
  sessionId: string;
  userId: string;
  displayName: string;
  role: 'TRAINER' | 'LEARNER';
  sessionTitle: string;
  skillName: string;
  token: string;
  isOnline: boolean;
  status: string;
  error?: string;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  message: string;
  status: 'SENDING' | 'SENT' | 'FAILED';
  isSystem: boolean;
  createdAt: string;
}

/**
 * Escapes HTML characters to prevent XSS payloads in session text chat
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Strict Backend Authorization: Verifies user is an active participant in the session
 */
export function authorizeSessionParticipant(
  db: Database.Database,
  sessionId: string,
  userId: string
): AuthorizedParticipant {
  const session = db.prepare(`
    SELECT s.*, sk.name as skill_name,
           tp.display_name as teacher_name, lp.display_name as learner_name
    FROM sessions s
    LEFT JOIN skills sk ON s.skill_id = sk.id
    LEFT JOIN profiles tp ON s.teacher_id = tp.user_id
    LEFT JOIN profiles lp ON s.learner_id = lp.user_id
    WHERE s.id = ?
  `).get(sessionId) as any;

  if (!session) {
    return {
      authorized: false,
      sessionId,
      userId,
      displayName: 'Guest',
      role: 'LEARNER',
      sessionTitle: '',
      skillName: '',
      token: '',
      isOnline: false,
      status: 'NOT_FOUND',
      error: 'Session does not exist',
    };
  }

  if (session.status === 'CANCELLED') {
    return {
      authorized: false,
      sessionId,
      userId,
      displayName: 'Participant',
      role: 'LEARNER',
      sessionTitle: session.title,
      skillName: session.skill_name || 'Skill',
      token: '',
      isOnline: false,
      status: 'CANCELLED',
      error: 'Session has been cancelled',
    };
  }

  if (session.status === 'DISPUTED') {
    return {
      authorized: false,
      sessionId,
      userId,
      displayName: 'Participant',
      role: 'LEARNER',
      sessionTitle: session.title,
      skillName: session.skill_name || 'Skill',
      token: '',
      isOnline: false,
      status: 'DISPUTED',
      error: 'Session is frozen under moderator dispute review.',
    };
  }

  const isTeacher = (session.teacher_id === userId);
  const isLearner = (session.learner_id === userId);

  if (!isTeacher && !isLearner) {
    return {
      authorized: false,
      sessionId,
      userId,
      displayName: 'Unauthorized',
      role: 'LEARNER',
      sessionTitle: session.title,
      skillName: session.skill_name || 'Skill',
      token: '',
      isOnline: false,
      status: 'FORBIDDEN',
      error: 'Access denied: You are not an authorized participant in this learning session.',
    };
  }

  // Pre-Session Return Skill Start Gate for Direct Skill Exchanges
  const agreement = db.prepare(`
    SELECT * FROM session_exchange_agreements WHERE session_id = ?
  `).get(sessionId) as any;

  if (agreement && agreement.return_type === 'SKILL' && agreement.status !== 'ACCEPTED') {
    return {
      authorized: false,
      sessionId,
      userId,
      displayName: isTeacher ? (session.teacher_name || 'Teacher') : (session.learner_name || 'Learner'),
      role: isTeacher ? 'TRAINER' : 'LEARNER',
      sessionTitle: session.title,
      skillName: session.skill_name || 'Skill Session',
      token: '',
      isOnline: false,
      status: session.status,
      error: 'Session entry locked: Pre-session return skill agreement has not been confirmed by the learner.',
    };
  }

  const role: 'TRAINER' | 'LEARNER' = isTeacher ? 'TRAINER' : 'LEARNER';
  const displayName = isTeacher ? (session.teacher_name || 'Teacher') : (session.learner_name || 'Learner');
  const token = `vtok-${sessionId}-${userId}-${Date.now().toString(36)}`;

  return {
    authorized: true,
    sessionId,
    userId,
    displayName,
    role,
    sessionTitle: session.title,
    skillName: session.skill_name || 'Skill Session',
    token,
    isOnline: session.mode === 'ONLINE',
    status: session.status,
  };
}

/**
 * Records session attendance and telemetry events
 */
export function recordAttendanceEvent(
  db: Database.Database,
  sessionId: string,
  userId: string,
  eventType: 'JOINED' | 'LEFT' | 'RECONNECTED' | 'MUTED' | 'UNMUTED' | 'VIDEO_ON' | 'VIDEO_OFF' | 'SCREEN_SHARE_START' | 'SCREEN_SHARE_STOP',
  metadata?: any
) {
  const eventId = `att-${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT INTO session_attendance (
      id, session_id, user_id, event_type, joined_at, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
  `).run(
    eventId,
    sessionId,
    userId,
    eventType,
    JSON.stringify(metadata || {})
  );

  // Update participant joined timestamp in session_participants
  if (eventType === 'JOINED') {
    db.prepare(`
      UPDATE session_participants 
      SET joined_at = CURRENT_TIMESTAMP 
      WHERE session_id = ? AND user_id = ?
    `).run(sessionId, userId);
  }
}

/**
 * Validates, escapes, and sends an in-room session chat message
 */
export function sendSessionChatMessage(
  db: Database.Database,
  sessionId: string,
  senderId: string,
  rawMessage: string
): { success: boolean; message?: ChatMessageRecord; error?: string } {
  const trimmed = rawMessage.trim();
  if (!trimmed) {
    return { success: false, error: 'Message cannot be empty' };
  }

  if (trimmed.length > 1000) {
    return { success: false, error: 'Message exceeds maximum length (1000 characters)' };
  }

  // Authorize participant
  const auth = authorizeSessionParticipant(db, sessionId, senderId);
  if (!auth.authorized) {
    return { success: false, error: auth.error || 'Unauthorized to chat in this session' };
  }

  // Rate-limiting check: Max 10 messages per 10 seconds per user
  const recentCount = (db.prepare(`
    SELECT COUNT(*) as count FROM chat_messages 
    WHERE session_id = ? AND sender_id = ? AND created_at >= datetime('now', '-10 seconds')
  `).get(sessionId, senderId) as any)?.count || 0;

  if (recentCount >= 10) {
    return { success: false, error: 'Rate limit exceeded: Please wait a moment before sending another message.' };
  }

  // XSS-Safe Sanitization
  const safeMessage = escapeHtml(trimmed);
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  db.prepare(`
    INSERT INTO chat_messages (id, session_id, sender_id, message, status, is_system, created_at)
    VALUES (?, ?, ?, ?, 'SENT', 0, CURRENT_TIMESTAMP)
  `).run(messageId, sessionId, senderId, safeMessage);

  const senderProfile = db.prepare(`SELECT display_name, avatar FROM profiles WHERE user_id = ?`).get(senderId) as any;

  return {
    success: true,
    message: {
      id: messageId,
      sessionId,
      senderId,
      senderName: senderProfile?.display_name || auth.displayName,
      senderAvatar: senderProfile?.avatar || null,
      message: safeMessage,
      status: 'SENT',
      isSystem: false,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Retrieves chat history for authorized session participants
 */
export function getSessionChatHistory(
  db: Database.Database,
  sessionId: string,
  userId: string
): { authorized: boolean; messages: ChatMessageRecord[]; error?: string } {
  const auth = authorizeSessionParticipant(db, sessionId, userId);
  if (!auth.authorized) {
    return { authorized: false, messages: [], error: auth.error };
  }

  const rows = db.prepare(`
    SELECT m.*, p.display_name as sender_name, p.avatar as sender_avatar
    FROM chat_messages m
    LEFT JOIN profiles p ON m.sender_id = p.user_id
    WHERE m.session_id = ?
    ORDER BY m.created_at ASC
  `).all(sessionId) as any[];

  return {
    authorized: true,
    messages: rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      senderId: r.sender_id,
      senderName: r.is_system ? 'System' : (r.sender_name || 'Participant'),
      senderAvatar: r.sender_avatar,
      message: r.message,
      status: r.status as any,
      isSystem: Boolean(r.is_system),
      createdAt: r.created_at,
    })),
  };
}
