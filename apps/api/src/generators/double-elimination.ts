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
 * 队伍数不是 2 的幂时（存在 BYE/轮空），以上对称结构不再成立：
 * 胜者组 R1 的真实比赛数 = 队伍数 - numSlots/2，败者组各轮场数
 * 必须跟随"真实败者流"动态计算（奇数败者自然轮空到下一轮），
 * 否则会生成永远无人进入的空比赛，导致赛事永远无法完成。
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

    // ========== 构建败者组（跟随真实败者流） ==========
    // 胜者组败者 drop 到败者组的时机（与轮次是否可配对无关，配对由下面模拟决定）：
    //   wr=1 → LR1；wr=k → LR_last（败者组决赛）；其它 wr → LR(2wr-2)
    const totalLosersRounds = 2 * winnersRounds - 2;
    const dropPlan = new Map<number, number[]>();
    for (let wr = 1; wr <= winnersRounds; wr++) {
      let targetLR: number;
      if (wr === 1) targetLR = 1;
      else if (wr === winnersRounds) targetLR = totalLosersRounds; // 胜者组决赛败者 → 败者组决赛（最后一轮）
      else targetLR = 2 * (wr - 1); // wr=2 → LR2
      // 只处理非轮空比赛（有真实两支队伍的），轮空比赛只有 winner 没有 loser
      const realMatches = (winnersByRound.get(wr) || []).filter((wm) => wm.match.status !== 'walkthrough');
      for (const wm of realMatches) {
        if (!dropPlan.has(targetLR)) dropPlan.set(targetLR, []);
        dropPlan.get(targetLR)!.push(wm.winnerIdx);
      }
    }

    // 败者组单位：一个"等待配对"的败者/胜者，带其来源比赛下标
    //   via === 'nextLosersMatchId' → 来源是胜者组比赛（败者 drop）
    //   via === 'nextMatchId'       → 来源是败者组比赛（胜者晋级）
    type LoserUnit = { from: number; via: 'nextMatchId' | 'nextLosersMatchId' };

    const losersMatches: Omit<Match, 'id'>[] = [];

    // allMatches 布局：[winnersResult.matches..., losersMatches..., grandFinalMatch]
    const W = winnersResult.matches.length;
    const loserIdxInAll = (loserIdx: number) => W + loserIdx;

    // 来源比赛 → 目标比赛 的链接（占位 ID）
    const setLink = (unit: LoserUnit, targetAllIdx: number) => {
      const placeholder = `__match_${targetAllIdx}__` as any;
      if (unit.via === 'nextLosersMatchId') {
        // 胜者组比赛败者 → 目标败者组比赛
        winnersResult.matches[unit.from].nextLosersMatchId = placeholder;
      } else {
        // 败者组比赛胜者 → 目标败者组比赛
        losersMatches[unit.from - W].nextMatchId = placeholder;
      }
    };

    // 逐轮模拟败者流：
    // 每轮先纳入本轮 drop 的胜者组败者，再把等待队列中的单位两两配对生成比赛，
    // 配对的胜者进入"下一轮"的等待队列；无法配对的多余单位轮空，自然留到下一轮。
    let waiting: LoserUnit[] = [];
    for (let lr = 1; lr <= totalLosersRounds; lr++) {
      for (const wIdx of dropPlan.get(lr) ?? []) {
        waiting.push({ from: wIdx, via: 'nextLosersMatchId' });
      }

      const nextWaiting: LoserUnit[] = [];
      let pos = 0;
      while (waiting.length >= 2) {
        const u1 = waiting.shift()!;
        const u2 = waiting.shift()!;
        const allIdx = loserIdxInAll(losersMatches.length);

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

        setLink(u1, allIdx);
        setLink(u2, allIdx);
        // 本场胜者进入下一轮等待队列（不能留在本轮继续配对）
        nextWaiting.push({ from: allIdx, via: 'nextMatchId' });
        pos++;
      }
      // waiting 中剩余 0/1 个单位轮空，与下一轮胜者一起留到下一轮
      waiting = [...waiting, ...nextWaiting];
    }

    // ========== 构建总决赛 ==========
    const grandFinalStage: Omit<Stage, 'id'> = {
      tournamentId: '',
      type: 'grand_final' as const,
      name: '总决赛',
      order: 2,
    };

    const grandFinalIdxInAllFinal = W + losersMatches.length;

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
      winnersFinal.match.nextMatchId = `__match_${grandFinalIdxInAllFinal}__` as any;
    }

    // 败者组决赛 → 总决赛（胜者晋升到 team2 槽位）
    const losersFinal = losersMatches.filter((m) => m.round === totalLosersRounds)[0];
    if (losersFinal) {
      losersFinal.nextMatchId = `__match_${grandFinalIdxInAllFinal}__` as any;
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
