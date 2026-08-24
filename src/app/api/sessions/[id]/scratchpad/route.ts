import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const sessionId = params.id;
  const db = getDb();

  try {
    const pad = db.prepare(`
      SELECT * FROM session_scratchpads WHERE session_id = ?
    `).get(sessionId) as any;

    if (!pad) {
      const defaultContent = `// SkillSwap Campus Live Collaborative Scratchpad\n// Topic: Mentoring Session Interactive Workspace\n\nfunction startSession() {\n  console.log("Welcome to your live SkillSwap peer classroom!");\n}\n`;
      return NextResponse.json({
        content: defaultContent,
        language: 'javascript',
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      content: pad.content,
      language: pad.language,
      updatedBy: pad.updated_by,
      updatedAt: pad.updated_at,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch scratchpad' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const sessionId = params.id;
  const db = getDb();

  try {
    const body = await req.json();
    const { content, language } = body;

    db.prepare(`
      INSERT INTO session_scratchpads (id, session_id, content, language, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(session_id) DO UPDATE SET
        content = excluded.content,
        language = COALESCE(excluded.language, session_scratchpads.language),
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      `pad-${sessionId}`,
      sessionId,
      content || '',
      language || 'javascript',
      user.userId
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to save scratchpad' }, { status: 500 });
  }
}
