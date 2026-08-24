import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  // 1. Study Groups
  const studyGroups = db.prepare(`
    SELECT 
      sg.*,
      p.display_name as creator_name,
      (SELECT COUNT(*) FROM study_group_members WHERE group_id = sg.id) as member_count,
      (SELECT COUNT(*) FROM study_group_members WHERE group_id = sg.id AND user_id = ?) as is_member
    FROM study_groups sg
    JOIN profiles p ON sg.creator_id = p.user_id
    ORDER BY sg.created_at DESC
  `).all(user.userId);

  // 2. Study Resources
  const resources = db.prepare(`
    SELECT 
      sr.*,
      p.display_name as author_name,
      p.college as author_college
    FROM study_resources sr
    JOIN profiles p ON sr.author_id = p.user_id
    ORDER BY sr.upvotes DESC, sr.created_at DESC
  `).all();

  // 3. Flashcard Decks
  const flashcardDecks = db.prepare(`
    SELECT 
      fd.*,
      p.display_name as creator_name,
      (SELECT COUNT(*) FROM flashcards WHERE deck_id = fd.id) as total_cards
    FROM flashcard_decks fd
    JOIN profiles p ON fd.user_id = p.user_id
    ORDER BY fd.created_at DESC
  `).all();

  return NextResponse.json({
    studyGroups,
    resources,
    flashcardDecks,
  });
}

export async function POST(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'JOIN_GROUP') {
      const { groupId } = body;
      db.prepare(`
        INSERT OR IGNORE INTO study_group_members (id, group_id, user_id, role)
        VALUES (?, ?, ?, 'MEMBER')
      `).run(`sgm-${Date.now()}`, groupId, user.userId);

      return NextResponse.json({ success: true, message: 'Joined study circle successfully!' });
    }

    if (action === 'UPVOTE_RESOURCE') {
      const { resourceId } = body;
      db.prepare(`UPDATE study_resources SET upvotes = upvotes + 1 WHERE id = ?`).run(resourceId);
      return NextResponse.json({ success: true, message: 'Resource upvoted!' });
    }

    if (action === 'CREATE_GROUP') {
      const { name, description, subject, meetingSchedule, maxMembers } = body;
      const groupId = `grp-${Date.now()}`;

      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO study_groups (id, name, description, subject, creator_id, meeting_schedule, max_members)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(groupId, name, description, subject, user.userId, meetingSchedule || 'Weekly', maxMembers || 10);

        db.prepare(`
          INSERT INTO study_group_members (id, group_id, user_id, role)
          VALUES (?, ?, ?, 'ADMIN')
        `).run(`sgm-${Date.now()}`, groupId, user.userId);
      });

      tx();
      return NextResponse.json({ success: true, message: 'Study circle created!', groupId }, { status: 201 });
    }

    if (action === 'GET_DECK_CARDS') {
      const { deckId } = body;
      const cards = db.prepare('SELECT * FROM flashcards WHERE deck_id = ? ORDER BY id ASC').all(deckId);
      return NextResponse.json({ cards });
    }

    if (action === 'UPDATE_CARD_MASTERY') {
      const { cardId, masteryLevel } = body;
      db.prepare('UPDATE flashcards SET mastery_level = ? WHERE id = ?').run(masteryLevel, cardId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('StudySphere Action Error:', err);
    return NextResponse.json({ error: 'Failed to process StudySphere action' }, { status: 500 });
  }
}
