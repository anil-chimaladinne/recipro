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
    
    // Support either skillId or skillName
    let skillName = body.skillName;
    if (!skillName && body.skillId) {
      skillName = body.skillId;
    }

    const parsed = ProposeReturnSkillSchema.safeParse({
      skillName,
      notes: body.notes,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid return skill format', details: parsed.error.format() }, { status: 400 });
    }

    const result = proposeReturnSkill({
      sessionId,
      actorUserId: user.userId,
      skillName: parsed.data.skillName,
      notes: parsed.data.notes,
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
    console.error('Save Return Skill Error:', err);
    return NextResponse.json({ error: err.message || 'Unable to save the return skill.' }, { status: 500 });
  }
}
