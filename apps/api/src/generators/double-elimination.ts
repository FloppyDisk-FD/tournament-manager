import type { Team, Match, Stage } from '../db/schema';
import type { BracketGenerator, GenerateResult, BracketSettings } from './types';
import { SingleElimGenerator } from './single-elimination';

/**
 * 双败淘汰赛生成器
 *
 * 结构：
 * - 胜者组 (Winners Bracket): 单败结构，败者降入败者组
 * - 败者组 (Losers Bracket): 败者在此继续比赛，再败即淘汰
 * - 总决赛 (Grand Final): 胜者组冠军 vs 败者组冠军
 *
 * 败者组轮次规律（标准双败）：
 * 对于 numSlots = 2^k 的赛事，败者组共 2k-2 轮（k>=2）：
 *   LR1: 胜者组 R1 败者之间互打        (numSlots/4 场)
 *   LR2: LR1 胜者 vs 胜者组 R2 败者    (numSlots/4 场)
 *   LR3: LR2 胜者之间互打              (numSlots/8 场)
 *   LR4: LR3 胜者 vs 胜者组 R3 败者    (numSlots/8 场)
 *   ...
 *   LR(2k-2): 败者组决赛
 *
 * 轮次对（LR_{2i-1}, LR_{2i}）各 numSlots/2^(i+1) 场，i 从 1 到 k-1
 *
 * 占位 ID 约定：用 `__match_${下标}__` 指向 allMatches 数组中的位置，
 * 由 bracket.ts 的 second pass 统一替换为真实 match ID。
 */
export class DoubleElimGenerator implements BracketGenerator {
  generate(teams: Team[], settings: BracketSettings): GenerateResult {
    const singleElim = new SingleElimGenerator();
    const winnersResult = singleElim.generate(teams, { ...settings, thirdPlace: false });

    // 重命名胜者组 stage
    winnersResult.stages[0].name = '胜者组';
    winnersResult.stages[0].type = 'winners_bracket';
    // 标记胜者组比赛的 stage 索引（__stage_0__ 对应 allStages[0]）
    for (const m of winnersResult.matches) {
      m.stageId = '__stage_0__' as any;
    }

    const numTeams = teams.length;
    const numSlots = Math.pow(2, Math.ceil(Math.log2(numTeams)));
    const winnersRounds = Math.log2(numSlots); // k

    // 2 队伍特殊处理：双败退化为单败 + 总决赛（无败者组）
    if (winnersRounds < 2) {
      const grandFinalStage: Omit<Stage, 'id'> = {
        tournamentId: '', type: 'grand_final' as const, name: '总决赛', order: 1,
      };
      const grandFinalMatch: Omit<Match, 'id'> = {
        stageId: '__stage_1__', groupLabel: null, round: 1, position: 0, bracketPos: 0,
        team1Id: null, team2Id: null, winnerId: null, loserId: null,
        team1Score: 0, team2Score: 0, status: 'pending', scheduledAt: null,
        nextMatchId: null, nextLosersMatchId: null, swissScoreGroup: null,
      };
      // 胜者组决赛（也是唯一一场）→ 总决赛
      const winnersFinal = winnersResult.matches[0];
      if (winnersFinal) {
        const grandFinalIdxInAll = winnersResult.matches.length;
        winnersFinal.nextMatchId = `__match_${grandFinalIdxInAll}__` as any;
      }
      return {
        stages: [winnersResult.stages[0], grandFinalStage],
        matches: [...winnersResult.matches, grandFinalMatch],
      };
    }

    // 收集胜者组各轮比赛（按 round, position 排序），记录其在 winnersResult.matches 中的下标
    const winnersByRound = new Map<number, { winnerIdx: number; match: Omit<Match, 'id'> }[]>();
    for (let i = 0; i < winnersResult.matches.length; i++) {
      const m = winnersResult.matches[i];
      if (!winnersByRound.has(m.round)) winnersByRound.set(m.round, []);
      winnersByRound.get(m.round)!.push({ winnerIdx: i, match: m });
    }
    for (const arr of winnersByRound.values()) {
      arr.sort((a, b) => a.match.position - b.match.position);
    }

    // ========== 构建败者组 ==========
    // 败者组结构基于 numSlots（与胜者组对称），轮空比赛的"败者位"保持空缺
    // 8 队伍双败：LR1=2场, LR2=2场, LR3=1场, LR4=1场
    // 6 队伍（8 slot, 2 BYE）：LR1=2场（但只有 2 个真实败者，一场会空着）
    const losersMatches: Omit<Match, 'id'>[] = [];

    const totalLosersRounds = 2 * winnersRounds - 2;
    const losersRoundsSize = new Map<number, number>();
    for (let lr = 1; lr <= totalLosersRounds; lr++) {
      const i = Math.ceil(lr / 2); // 1,1,2,2,...
      losersRoundsSize.set(lr, numSlots / Math.pow(2, i + 1));
    }

    for (let lr = 1; lr <= totalLosersRounds; lr++) {
      const size = losersRoundsSize.get(lr)!;
      for (let pos = 0; pos < size; pos++) {
        losersMatches.push({
          stageId: '__stage_1__',
          groupLabel: null,
          round: lr,
          position: pos,
          bracketPos: null,
          team1Id: null,
          team2Id: null,
          winnerId: null,
          loserId: null,
          team1Score: 0,
          team2Score: 0,
          status: 'pending',
          scheduledAt: null,
          nextMatchId: null,
          nextLosersMatchId: null,
          swissScoreGroup: null,
        });
      }
    }

    // 辅助：按 round, position 查找败者组比赛在 losersMatches 中的下标
    const findLoserIdx = (round: number, position: number) =>
      losersMatches.findIndex((m) => m.round === round && m.position === position);

    // allMatches 布局：[winnersResult.matches..., losersMatches..., grandFinalMatch]
    const W = winnersResult.matches.length;
    const loserIdxInAll = (loserIdx: number) => W + loserIdx;
    const grandFinalIdxInAll = W + losersMatches.length;

    // ========== 链接败者组内部（nextMatchId） ==========
    // LR_i 的胜者晋升到 LR_{i+1}
    // 奇数轮（互打）→ 偶数轮（drop）：一对一晋升（drop 轮需要：互打胜者 + 胜者组败者）
    // 偶数轮（drop）→ 奇数轮（互打）：两场合并到下一轮同一场（互打轮需要两个 drop 胜者配对）
    for (let lr = 1; lr < totalLosersRounds; lr++) {
      const currentMatches = losersMatches.filter((m) => m.round === lr);
      const nextRoundSize = losersRoundsSize.get(lr + 1)!;
      for (let i = 0; i < currentMatches.length; i++) {
        const m = currentMatches[i];
        let nextPos: number;
        if (lr % 2 === 1) {
          // 奇数轮（互打）→ 偶数轮（drop）：一对一晋升
          nextPos = i;
        } else {
          // 偶数轮（drop）→ 奇数轮（互打）：两场合并到下一轮同一场
          nextPos = Math.floor(i / 2);
        }
        if (nextPos < nextRoundSize) {
          const nextLoserIdx = findLoserIdx(lr + 1, nextPos);
          if (nextLoserIdx !== -1) {
            m.nextMatchId = `__match_${loserIdxInAll(nextLoserIdx)}__` as any;
          }
        }
      }
    }

    // ========== 链接胜者组 → 败者组（nextLosersMatchId） ==========
    // LR1（互打轮，奇数 LR）：胜者组 R1 的败者两两配对 → 每 2 个败者填入 1 场比赛
    // LR2（drop 轮，偶数 LR）：胜者组 R2 的败者一对一 drop 进入 → 每个败者填入独立的 1 场比赛
    // LR3（互打轮）：LR2 胜者互打（不收胜者组败者）
    // LR4（drop 轮）：胜者组 R3（决赛）的败者一对一 drop 进入
    // 即：奇数 LR（互打）两两合并；偶数 LR（drop）一对一
    // 注意：跳过 walkthrough（轮空）比赛，轮空比赛只有 winner 没有 loser
    // 注意：循环包含 wr === winnersRounds（胜者组决赛败者 drop 到败者组决赛 LR_last）
    for (let wr = 1; wr <= winnersRounds; wr++) {
      const winnerMatches = winnersByRound.get(wr) || [];
      // wr=1 → LR1；wr=2 → LR2；wr=3 → LR4（胜者组决赛败者 drop 到败者组决赛）
      // 即 wr>=3 时 targetLR = 2*(wr-1)，但跳过 LR3（互打轮，不收胜者组败者）
      let targetLR: number;
      if (wr === 1) targetLR = 1;
      else if (wr === winnersRounds) targetLR = totalLosersRounds; // 胜者组决赛败者 → 败者组决赛（最后一轮）
      else targetLR = 2 * (wr - 1); // wr=2 → LR2
      const targetSize = losersRoundsSize.get(targetLR) ?? 0;
      const isDropRound = targetLR % 2 === 0 || targetLR === totalLosersRounds; // 偶数 LR 或最后一轮是 drop 轮

      // 只处理非轮空比赛（有真实两支队伍的）
      const realMatches = winnerMatches.filter((wm) => wm.match.status !== 'walkthrough');
      for (let i = 0; i < realMatches.length; i++) {
        // drop 轮：一对一（targetPos = i）；互打轮：两两合并（targetPos = floor(i/2)）
        const targetPos = isDropRound ? i : Math.floor(i / 2);
        if (targetPos >= targetSize) break;
        const targetLoserIdx = findLoserIdx(targetLR, targetPos);
        if (targetLoserIdx !== -1) {
          realMatches[i].match.nextLosersMatchId = `__match_${loserIdxInAll(targetLoserIdx)}__` as any;
        }
      }
    }

    // ========== 构建总决赛 ==========
    const grandFinalStage: Omit<Stage, 'id'> = {
      tournamentId: '',
      type: 'grand_final' as const,
      name: '总决赛',
      order: 2,
    };

    const grandFinalMatch: Omit<Match, 'id'> = {
      stageId: '__stage_2__',
      groupLabel: null,
      round: 1,
      position: 0,
      bracketPos: 0,
      team1Id: null, // 胜者组冠军（由胜者组决赛 nextMatchId 填充）
      team2Id: null, // 败者组冠军（由败者组决赛 nextMatchId 填充）
      winnerId: null,
      loserId: null,
      team1Score: 0,
      team2Score: 0,
      status: 'pending',
      scheduledAt: null,
      nextMatchId: null,
      nextLosersMatchId: null,
      swissScoreGroup: null,
    };

    // 胜者组决赛 → 总决赛（胜者晋升到 team1 槽位）
    const winnersFinal = winnersByRound.get(winnersRounds)?.[0];
    if (winnersFinal) {
      winnersFinal.match.nextMatchId = `__match_${grandFinalIdxInAll}__` as any;
    }

    // 败者组决赛 → 总决赛（胜者晋升到 team2 槽位）
    const losersFinal = losersMatches.filter((m) => m.round === totalLosersRounds)[0];
    if (losersFinal) {
      losersFinal.nextMatchId = `__match_${grandFinalIdxInAll}__` as any;
    }

    // ========== 组装结果 ==========
    const losersStage: Omit<Stage, 'id'> = {
      tournamentId: '',
      type: 'losers_bracket' as const,
      name: '败者组',
      order: 1,
    };

    const allStages = [winnersResult.stages[0], losersStage, grandFinalStage];
    const allMatches = [...winnersResult.matches, ...losersMatches, grandFinalMatch];

    return { stages: allStages, matches: allMatches };
  }
}
