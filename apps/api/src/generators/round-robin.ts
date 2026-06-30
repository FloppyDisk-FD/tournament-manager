import type { Team, Match, Stage } from '../db/schema';
import type { BracketGenerator, GenerateResult, BracketSettings } from './types';

/**
 * 循环赛生成器 — 标准 Circle Method（圆形轮转法）
 *
 * 算法：
 * - 固定 1 号位，其余队伍围成圆形轮转
 * - 每轮：固定位的队伍与圆形对面的队伍配对，其余相邻两两配对
 * - 奇数队伍时加入 BYE 占位（对应轮空）
 *
 * 参考实现：https://en.wikipedia.org/wiki/Round-robin_tournament#Circle_method
 */
export class RoundRobinGenerator implements BracketGenerator {
  generate(teams: Team[], _settings: BracketSettings): GenerateResult {
    // 复制一份，避免修改入参；奇数队伍补 BYE
    type Participant = Team | { id: '__bye__'; name: 'BYE' };
    const participants: Participant[] = [...teams];
    if (participants.length % 2 !== 0) {
      participants.push({ id: '__bye__', name: 'BYE' });
    }

    const n = participants.length;
    const totalRounds = n - 1;
    const matchesPerRound = n / 2;
    const matches: Omit<Match, 'id'>[] = [];

    // 圆形队列：fixed = participants[0]，rotation = 其余队伍
    const rotation = participants.slice(1); // 长度 n-1

    for (let round = 1; round <= totalRounds; round++) {
      for (let pos = 0; pos < matchesPerRound; pos++) {
        let teamA: Participant;
        let teamB: Participant;

        if (pos === 0) {
          // 第 0 位：fixed vs rotation 的最后一个
          teamA = participants[0];
          teamB = rotation[rotation.length - 1];
        } else {
          // 其余位：rotation[pos-1] vs rotation[n-2-pos]
          // 对称配对：pos=1 时取 rotation[0] vs rotation[n-3]
          teamA = rotation[pos - 1];
          teamB = rotation[n - 2 - pos];
        }

        const isBye = teamA.id === '__bye__' || teamB.id === '__bye__';
        const team1Id = teamA.id === '__bye__' ? null : teamA.id;
        const team2Id = teamB.id === '__bye__' ? null : teamB.id;

        matches.push({
          stageId: '',
          groupLabel: null,
          round,
          position: pos,
          bracketPos: null,
          team1Id,
          team2Id,
          winnerId: isBye ? (team1Id ?? team2Id ?? null) : null,
          loserId: null,
          team1Score: 0,
          team2Score: 0,
          status: isBye ? 'walkthrough' : 'pending',
          scheduledAt: null,
          nextMatchId: null,
          nextLosersMatchId: null,
          swissScoreGroup: null,
        });
      }

      // 轮转：rotation 的最后一个移到最前
      rotation.unshift(rotation.pop()!);
    }

    const stage: Omit<Stage, 'id'> = {
      tournamentId: '',
      type: 'round_robin',
      name: '循环赛',
      order: 0,
    };

    return { stages: [stage], matches };
  }
}
