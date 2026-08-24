import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { generateStudyRoadmap } from '@/lib/gemini';

export async function GET(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) {
    return NextResponse.json({ roadmap: null }, { status: 200 });
  }

  const { user } = authRes;
  const db = getDb();

  try {
    // Get latest active roadmap for this user if available
    const roadmap = db.prepare(`
      SELECT * FROM study_roadmaps WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(user.userId) as any;

    if (!roadmap) {
      return NextResponse.json({ roadmap: null });
    }

    const stages = db.prepare(`
      SELECT * FROM roadmap_stages WHERE roadmap_id = ? ORDER BY stage_order ASC
    `).all(roadmap.id) as any[];

    return NextResponse.json({
      success: true,
      roadmap: {
        id: roadmap.id,
        title: roadmap.title,
        goal: roadmap.goal,
        currentLevel: roadmap.current_level,
        targetLevel: roadmap.target_level,
        weeklyHours: roadmap.weekly_hours,
        estimatedDuration: roadmap.estimated_duration,
        version: roadmap.version,
        stages: stages.map(s => ({
          id: s.id,
          order: s.stage_order,
          title: s.title,
          description: s.description,
          skillQuery: s.skill_query,
          estimatedHours: s.estimated_hours,
          status: s.status,
          objectives: JSON.parse(s.objectives_json || '[]'),
          practiceTasks: JSON.parse(s.practice_tasks_json || '[]'),
          completionCriteria: JSON.parse(s.completion_criteria_json || '[]'),
        })),
      },
    });
  } catch (err: any) {
    console.error('Fetch roadmap error:', err);
    return NextResponse.json({ error: 'Failed to retrieve study roadmap' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authRes = requireAuth(req);
  const userId = 'errorResponse' in authRes ? null : authRes.user.userId;
  const db = getDb();

  try {
    const body = await req.json();
    const topic = (body.topic || 'Python Programming').trim();
    const currentLevel = body.currentLevel || 'Beginner';
    const targetLevel = body.targetLevel || 'Intermediate';
    const weeklyHours = Number(body.weeklyHours) || 6;

    // Generate structured roadmap via Gemini AI (or resilient local curriculum generator)
    const generated = await generateStudyRoadmap({
      goal: topic,
      currentLevel,
      targetLevel,
      weeklyHours,
    });

    const roadmapId = `rdm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Persist in database if user is authenticated
    if (userId) {
      db.prepare(`
        INSERT INTO study_roadmaps (
          id, user_id, title, goal, current_level, target_level, weekly_hours, estimated_duration, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        roadmapId,
        userId,
        generated.title,
        generated.goal,
        currentLevel,
        targetLevel,
        weeklyHours,
        generated.estimatedDuration
      );

      const insertStage = db.prepare(`
        INSERT INTO roadmap_stages (
          id, roadmap_id, stage_order, title, description, skill_query,
          estimated_hours, objectives_json, practice_tasks_json, completion_criteria_json, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NOT_STARTED')
      `);

      for (const st of generated.stages) {
        const stageId = `stg-${roadmapId}-${st.order}`;
        insertStage.run(
          stageId,
          roadmapId,
          st.order,
          st.title,
          st.description,
          st.skillQuery,
          st.estimatedHours || 5,
          JSON.stringify(st.objectives || []),
          JSON.stringify(st.practiceTasks || []),
          JSON.stringify(st.completionCriteria || [])
        );
      }
    }

    // Query real verified mentors matching topic
    const searchParam = `%${topic.toLowerCase()}%`;
    const excludeId = userId || 'anonymous';
    
    let matchedMentors = db.prepare(`
      SELECT 
        u.id as user_id, p.display_name, p.avatar, p.college, p.major, p.is_verified_student,
        s.name as skill_name, us.proficiency, us.experience_years, us.teaching_style, us.verification_status,
        COALESCE(r.bayesian_rating, 4.8) as bayesian_rating,
        COALESCE(r.total_sessions_taught, 0) as total_sessions_taught
      FROM user_skills us
      JOIN skills s ON us.skill_id = s.id
      JOIN users u ON us.user_id = u.id
      JOIN profiles p ON u.id = p.user_id
      LEFT JOIN reputations r ON u.id = r.user_id
      WHERE u.status = 'ACTIVE' 
        AND u.id != ?
        AND (LOWER(s.name) LIKE ? OR LOWER(s.category) LIKE ?)
      ORDER BY 
        CASE WHEN us.verification_status IN ('PLATFORM_VERIFIED', 'ASSESSMENT_VERIFIED') THEN 1 ELSE 2 END,
        r.bayesian_rating DESC,
        us.experience_years DESC
      LIMIT 6
    `).all(excludeId, searchParam, searchParam) as any[];

    // If niche topic has 0 specific mentors, provide top active verified campus mentors
    if (matchedMentors.length === 0) {
      matchedMentors = db.prepare(`
        SELECT 
          u.id as user_id, p.display_name, p.avatar, p.college, p.major, p.is_verified_student,
          s.name as skill_name, us.proficiency, us.experience_years, us.teaching_style, us.verification_status,
          COALESCE(r.bayesian_rating, 4.8) as bayesian_rating,
          COALESCE(r.total_sessions_taught, 0) as total_sessions_taught
        FROM user_skills us
        JOIN skills s ON us.skill_id = s.id
        JOIN users u ON us.user_id = u.id
        JOIN profiles p ON u.id = p.user_id
        LEFT JOIN reputations r ON u.id = r.user_id
        WHERE u.status = 'ACTIVE' AND u.id != ?
        ORDER BY 
          CASE WHEN us.verification_status IN ('PLATFORM_VERIFIED', 'ASSESSMENT_VERIFIED') THEN 1 ELSE 2 END,
          r.bayesian_rating DESC
        LIMIT 4
      `).all(excludeId) as any[];
    }

    return NextResponse.json({
      success: true,
      roadmap: {
        id: roadmapId,
        title: generated.title,
        goal: generated.goal,
        estimatedDuration: generated.estimatedDuration,
        provider: generated.provider,
        stages: generated.stages.map(s => ({
          ...s,
          status: 'NOT_STARTED',
        })),
      },
      recommendedMentors: matchedMentors.map(m => ({
        userId: m.user_id,
        displayName: m.display_name,
        avatar: m.avatar,
        college: m.college,
        major: m.major,
        isVerifiedStudent: Boolean(m.is_verified_student),
        skillName: m.skill_name,
        proficiency: m.proficiency,
        experienceYears: m.experience_years,
        teachingStyle: m.teaching_style,
        verificationStatus: m.verification_status,
        bayesianRating: m.bayesian_rating,
        totalSessionsTaught: m.total_sessions_taught,
      })),
    });
  } catch (err: any) {
    console.error('Study Coach Generation Error:', err);
    return NextResponse.json({ error: 'Failed to generate study roadmap' }, { status: 500 });
  }
}
