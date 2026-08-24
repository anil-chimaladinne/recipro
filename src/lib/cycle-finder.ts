import { getDb } from './db';
import crypto from 'crypto';

export interface ExchangeCycleNode {
  userId: string;
  displayName: string;
  avatar: string | null;
  teachesSkill: string;
  wantsSkill: string;
  trustScore: number;
  bayesianRating: number;
}

export interface ExchangeCycle {
  cycleId: string;
  cycleHash: string;
  cycleLength: number;
  participants: ExchangeCycleNode[];
  skillsFlow: Array<{
    fromUser: string;
    fromName: string;
    toUser: string;
    toName: string;
    skillName: string;
  }>;
  feasibilityScore: number; // 0 to 100
  explanation: string;
  status: 'PROPOSED' | 'ACCEPTED_BY_ALL' | 'EXECUTED';
}

/**
 * Multi-Person Exchange Engine:
 * Constructs a directed graph of [Student] -> [Desired Skills] & [Teaches Skills]
 * Discovers cycles of length 2, 3, or 4 where A teaches B, B teaches C, C teaches A.
 */
export function discoverExchangeCycles(focusUserId?: string): ExchangeCycle[] {
  const db = getDb();

  // 1. Fetch all teaching capabilities
  const teachingRows = db.prepare(`
    SELECT 
      us.user_id, us.skill_id, s.name as skill_name,
      p.display_name, p.avatar, p.trust_score,
      COALESCE(r.bayesian_rating, 4.5) as bayesian_rating
    FROM user_skills us
    JOIN skills s ON us.skill_id = s.id
    JOIN users u ON us.user_id = u.id
    JOIN profiles p ON u.id = p.user_id
    LEFT JOIN reputations r ON u.id = r.user_id
    WHERE u.status = 'ACTIVE'
  `).all() as any[];

  // 2. Fetch all learning goals
  const goalRows = db.prepare(`
    SELECT 
      lg.user_id, lg.skill_id, s.name as skill_name
    FROM learning_goals lg
    JOIN skills s ON lg.skill_id = s.id
    JOIN users u ON lg.user_id = u.id
    WHERE u.status = 'ACTIVE'
  `).all() as any[];

  // Build lookup maps:
  // User -> Skills they can teach (skillId -> skillName)
  const userTeaches = new Map<string, Map<string, { skillName: string; profile: any }>>();
  for (const row of teachingRows) {
    if (!userTeaches.has(row.user_id)) {
      userTeaches.set(row.user_id, new Map());
    }
    userTeaches.get(row.user_id)!.set(row.skill_id, {
      skillName: row.skill_name,
      profile: {
        userId: row.user_id,
        displayName: row.display_name,
        avatar: row.avatar,
        trustScore: row.trust_score || 75,
        bayesianRating: row.bayesian_rating || 4.5,
      }
    });
  }

  // User -> Skills they want to learn
  const userWants = new Map<string, Map<string, string>>();
  for (const row of goalRows) {
    if (!userWants.has(row.user_id)) {
      userWants.set(row.user_id, new Map());
    }
    userWants.get(row.user_id)!.set(row.skill_id, row.skill_name);
  }

  // Build Directed Adjacency Graph:
  // Edge (A -> B) exists if A can teach a skill that B wants!
  // Edge payload contains the skill being taught from A to B.
  const adj = new Map<string, Array<{ toUser: string; skillId: string; skillName: string }>>();
  const allUsers = Array.from(new Set([...Array.from(userTeaches.keys()), ...Array.from(userWants.keys())]));

  for (const userA of allUsers) {
    adj.set(userA, []);
    const aTeaches = userTeaches.get(userA);
    if (!aTeaches) continue;

    for (const userB of allUsers) {
      if (userA === userB) continue;
      const bWants = userWants.get(userB);
      if (!bWants) continue;

      // Check if any skill A teaches is wanted by B
      for (const [skillId, tInfo] of aTeaches.entries()) {
        if (bWants.has(skillId)) {
          adj.get(userA)!.push({
            toUser: userB,
            skillId,
            skillName: tInfo.skillName,
          });
        }
      }
    }
  }

  // DFS Cycle Finder (Cycles of length 2 to 4)
  const foundCycles: ExchangeCycle[] = [];
  const visitedCycleHashes = new Set<string>();

  function normalizeCyclePath(nodes: string[]): string {
    // Find min element and rotate so representation is canonical
    const minNode = nodes.reduce((min, cur) => cur < min ? cur : min, nodes[0]);
    const minIdx = nodes.indexOf(minNode);
    const rotated = [...nodes.slice(minIdx), ...nodes.slice(0, minIdx)];
    return rotated.join('->');
  }

  function findCyclesForStart(startNode: string) {
    const stack: Array<{
      current: string;
      path: string[];
      skills: Array<{ from: string; to: string; skillName: string }>;
    }> = [{ current: startNode, path: [startNode], skills: [] }];

    while (stack.length > 0) {
      const { current, path, skills } = stack.pop()!;

      const neighbors = adj.get(current) || [];
      for (const edge of neighbors) {
        if (edge.toUser === startNode && path.length >= 2 && path.length <= 4) {
          // Cycle found!
          const cyclePath = [...path];
          const cycleHash = crypto.createHash('sha256').update(normalizeCyclePath(cyclePath)).digest('hex').substring(0, 16);

          if (!visitedCycleHashes.has(cycleHash)) {
            visitedCycleHashes.add(cycleHash);

            const allCycleSkills = [
              ...skills,
              { from: current, to: startNode, skillName: edge.skillName }
            ];

            // Build cycle participants
            const participants: ExchangeCycleNode[] = [];
            for (let i = 0; i < cyclePath.length; i++) {
              const uId = cyclePath[i];
              const nextUId = cyclePath[(i + 1) % cyclePath.length];
              const prevUId = cyclePath[(i - 1 + cyclePath.length) % cyclePath.length];

              const teachInfo = allCycleSkills.find(s => s.from === uId && s.to === nextUId);
              const learnInfo = allCycleSkills.find(s => s.from === prevUId && s.to === uId);

              const pProfile = userTeaches.get(uId)?.values().next().value?.profile || {
                displayName: 'Student',
                avatar: null,
                trustScore: 80,
                bayesianRating: 4.6,
              };

              participants.push({
                userId: uId,
                displayName: pProfile.displayName,
                avatar: pProfile.avatar,
                teachesSkill: teachInfo?.skillName || 'Skill',
                wantsSkill: learnInfo?.skillName || 'Skill',
                trustScore: pProfile.trustScore,
                bayesianRating: pProfile.bayesianRating,
              });
            }

            // Skills flow representation
            const skillsFlow = allCycleSkills.map(s => {
              const fromP = participants.find(p => p.userId === s.from);
              const toP = participants.find(p => p.userId === s.to);
              return {
                fromUser: s.from,
                fromName: fromP?.displayName || 'Student',
                toUser: s.to,
                toName: toP?.displayName || 'Student',
                skillName: s.skillName,
              };
            });

            // Calculate feasibility score based on participant trust & ratings
            const avgTrust = participants.reduce((acc, p) => acc + p.trustScore, 0) / participants.length;
            const feasibilityScore = Math.min(100, Math.round(avgTrust * 0.9 + 10));

            const explanation = `${participants.length}-Person Skill Loop: ${skillsFlow.map(sf => `${sf.fromName} teaches ${sf.skillName} to ${sf.toName}`).join(' -> ')}`;

            foundCycles.push({
              cycleId: `cycle-${cycleHash}`,
              cycleHash,
              cycleLength: participants.length,
              participants,
              skillsFlow,
              feasibilityScore,
              explanation,
              status: 'PROPOSED',
            });
          }
        } else if (!path.includes(edge.toUser) && path.length < 4) {
          stack.push({
            current: edge.toUser,
            path: [...path, edge.toUser],
            skills: [
              ...skills,
              { from: current, to: edge.toUser, skillName: edge.skillName }
            ],
          });
        }
      }
    }
  }

  // If focus user provided, search starting with focus user; else search all
  const searchStarts = focusUserId ? [focusUserId] : allUsers;
  for (const sNode of searchStarts) {
    findCyclesForStart(sNode);
  }

  return foundCycles;
}
