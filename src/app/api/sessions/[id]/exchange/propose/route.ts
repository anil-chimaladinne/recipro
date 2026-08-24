import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ProposeReturnSkillSchema } from '@/lib/validations';
import { proposeReturnSkill } from '@/lib/state-machine';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const sessionId = params.id;

  try {
    const body = await req.json();
    const parsed = ProposeReturnSkillSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid proposal format', details: parsed.error.format() }, { status: 400 });
    }

    const { skillName, notes } = parsed.data;

    const result = proposeReturnSkill({
      sessionId,
      actorUserId: user.userId,
      skillName,
      notes,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      agreement: result.agreement,
    });
  } catch (err: any) {
    console.error('Propose Return Skill Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to propose return skill' }, { status: 500 });
  }
}
