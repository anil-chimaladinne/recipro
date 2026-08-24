import { NextRequest, NextResponse } from 'next/server';
import { SearchQuerySchema } from '@/lib/validations';
import { searchAndMatchCandidates, searchAndMatchCandidatesAsync } from '@/lib/matching';
import { discoverExchangeCycles } from '@/lib/cycle-finder';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const authUser = getAuthUser(req);

    const queryObj = {
      q: searchParams.get('q') || '',
      mode: (searchParams.get('mode') as any) || 'ALL',
      skillCategory: searchParams.get('skillCategory') || undefined,
      minProficiency: (searchParams.get('minProficiency') as any) || undefined,
      dayOfWeek: searchParams.get('dayOfWeek') || undefined,
      verifiedOnly: (searchParams.get('verifiedOnly') as any) || undefined,
      minRating: searchParams.get('minRating') || undefined,
      sessionMode: (searchParams.get('sessionMode') as any) || 'ALL',
    };

    const parsed = SearchQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid search parameters', details: parsed.error.format() }, { status: 400 });
    }

    const { q, mode, skillCategory, minProficiency, dayOfWeek, verifiedOnly, minRating, sessionMode } = parsed.data;

    // Execute 3-Mode Matching Engine (ML Service with TypeScript Fallback)
    const matchResults = await searchAndMatchCandidatesAsync({
      query: q,
      skillCategory,
      minProficiency,
      dayOfWeek,
      verifiedOnly: verifiedOnly === 'true',
      minRating: minRating ? parseFloat(minRating) : undefined,
      sessionMode,
      requesterUserId: authUser?.userId,
    });

    // Check if Mode C cycle discovery is also requested
    let cycles: any[] = [];
    if (mode === 'MODE_C' || mode === 'ALL') {
      cycles = discoverExchangeCycles(authUser?.userId);
    }

    return NextResponse.json({
      success: true,
      query: q,
      mode,
      results: {
        modeA_knownPerson: matchResults.knownPersonMatches,
        modeB_skillMatches: matchResults.skillMatches,
        insideCollegeMatches: matchResults.insideCollegeMatches,
        outsideCollegeMatches: matchResults.outsideCollegeMatches,
        modeC_exchangeCycles: cycles,
      },
      summary: {
        exactMatchesCount: matchResults.knownPersonMatches.length,
        skillCandidatesCount: matchResults.skillMatches.length,
        insideMatchesCount: matchResults.insideCollegeMatches.length,
        outsideMatchesCount: matchResults.outsideCollegeMatches.length,
        exchangeCyclesCount: cycles.length,
      }
    });
  } catch (err: any) {
    console.error('Search API Error:', err);
    return NextResponse.json({ error: 'Search processing error occurred' }, { status: 500 });
  }
}
