import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { AnalyzeSkillsInputSchema } from '@/lib/validations';
import { analyzeAndExtractSkills } from '@/lib/ai-extractor';

export async function POST(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  try {
    const body = await req.json();
    const parsed = AnalyzeSkillsInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Please provide at least 10 characters of experience text', details: parsed.error.format() }, { status: 400 });
    }

    const extracted = await analyzeAndExtractSkills(parsed.data.freeText);

    return NextResponse.json({
      success: true,
      count: extracted.length,
      skills: extracted,
      message: 'Skills extracted. Please review and confirm which skills to add to your profile.',
    });
  } catch (err: any) {
    console.error('Skill Extraction API Error:', err);
    return NextResponse.json({ error: 'Failed to extract skills from text' }, { status: 500 });
  }
}
