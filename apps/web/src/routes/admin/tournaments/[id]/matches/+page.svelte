<script lang="ts">
	import { api } from '$lib/api/client';
	import { ArrowRight, ClipboardList } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import BackLink from '$lib/components/BackLink.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Input from '$lib/components/Input.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { success, error } from '$lib/stores/toast.svelte';

	let { data } = $props();
	let matches = $state(data.matches ?? []);
	let editingMatch = $state<string | null>(null);
	let gameScores = $state<Record<number, { home: number; away: number }>>({});
	/** 编辑中的比赛时间输入（datetime-local 字符串） */
	let matchTimeInput = $state('');
	let generating = $state(false);
	let justCompleted = $state<string | null>(null);
	let submitting = $state<string | null>(null);

	let grouped = $derived(() => {
		// 按 stage 分组，每个 stage 内再按 round 分组
		const stageMap = new Map<string, { stageName: string; stageOrder: number; rounds: Map<number, any[]> }>();
		for (const m of matches) {
			const stageKey = m.stageId ?? 'main';
			if (!stageMap.has(stageKey)) {
				stageMap.set(stageKey, {
					stageName: m.stageName ?? '主赛程',
					stageOrder: m.stageOrder ?? 0,
					rounds: new Map(),
				});
			}
			const stage = stageMap.get(stageKey)!;
			if (!stage.rounds.has(m.round)) stage.rounds.set(m.round, []);
			stage.rounds.get(m.round)!.push(m);
		}
		// 展平为 stage-round 列表，按 stageOrder + round 排序
		const result: { stageName: string; stageOrder: number; round: number; matches: any[] }[] = [];
		for (const stage of stageMap.values()) {
			for (const [round, ms] of stage.rounds) {
				result.push({
					stageName: stage.stageName,
					stageOrder: stage.stageOrder,
					round,
					matches: ms.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
				});
			}
		}
		return result.sort((a, b) => {
			if (a.stageOrder !== b.stageOrder) return a.stageOrder - b.stageOrder;
			return a.round - b.round;
		});
	});

	let canGenerateNextRound = $derived(
		data.tournament.format === 'swiss' &&
		matches.length > 0 &&
		matches.every(m => m.status === 'completed')
	);

	// 判断哪一方是胜者（基于比分）
	function winnerSide(match: any): 0 | 1 | 2 | null {
		if (match.status !== 'completed') return null;
		const s1 = match.team1Score ?? 0;
		const s2 = match.team2Score ?? 0;
		if (s1 > s2) return 1;
		if (s2 > s1) return 2;
		return null;
	}

	function startEdit(match: any) {
		editingMatch = match.id;
		const games = data.tournament.boCount || 1;
		gameScores = {};
		for (let i = 0; i < games; i++) {
			gameScores[i] = { home: 0, away: 0 };
		}
		// 预填比赛时间（datetime-local 格式，本地时区）
		if (match.scheduled_at) {
			const d = new Date(match.scheduled_at);
			matchTimeInput = formatDateTimeLocal(d);
		} else {
			matchTimeInput = '';
		}
	}

	/** Date → datetime-local 字符串（本地时区） */
	function formatDateTimeLocal(d: Date): string {
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	/** 时间显示格式化 */
	function fmtTime(iso: string | null | undefined): string {
		if (!iso) return '未排期';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '未排期';
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	/** 保存比赛时间 */
	async function saveSchedule(match: any) {
		if (!matchTimeInput) { error('请选择比赛时间'); return; }
		submitting = match.id;
		try {
			await api.put(`/matches/${match.id}/schedule`, { scheduled_at: new Date(matchTimeInput).toISOString() });
			matches = await api.get<any[]>(`/tournaments/${data.tournament.id}/matches`).then(r => Array.isArray(r) ? r : []);
			success('比赛时间已更新');
		} catch (e: any) {
			error(e.message || '保存失败');
		} finally {
			submitting = null;
		}
	}

	async function submitScore(match: any) {
		submitting = match.id;
		const games = Object.entries(gameScores).map(([idx, s]) => {
			const gameNumber = Number(idx) + 1;
			let winnerId: string | null = null;
			if (s.home > s.away) winnerId = match.team1Id;
			else if (s.away > s.home) winnerId = match.team2Id;
			return { game_number: gameNumber, winner_id: winnerId };
		});
		try {
			await api.put(`/matches/${match.id}/score`, { games });
			matches = await api.get<any[]>(`/tournaments/${data.tournament.id}/matches`).then(r => Array.isArray(r) ? r : []);
			editingMatch = null;
			justCompleted = match.id;
			success('比分已提交');
			setTimeout(() => { justCompleted = null; }, 800);
		} catch (e: any) {
			error(e.message);
		} finally {
			submitting = null;
		}
	}

	async function generateNextRound() {
		generating = true;
		try {
			await api.post(`/tournaments/${data.tournament.id}/generate-next-round`);
			matches = await api.get<any[]>(`/tournaments/${data.tournament.id}/matches`).then(r => Array.isArray(r) ? r : []);
			success('下一轮已生成');
		} catch (e: any) {
			error(e.message);
		} finally {
			generating = false;
		}
	}

	const t = $derived(data.tournament);
</script>

<div class="animate-enter">
	<div class="mb-6">
		<BackLink href="/admin/tournaments/{t.id}">← 返回赛事</BackLink>
	</div>
	<PageHeader title="比赛管理" subtitle={t.name} />

	{#if canGenerateNextRound}
		<div class="mb-6 border border-black bg-neutral-50 p-4 flex items-center justify-between animate-enter-scale">
			<div class="flex items-center gap-3">
				<span class="w-1.5 h-1.5 bg-accent status-dot" aria-hidden="true"></span>
				<span class="text-sm font-bold text-black">当前轮次已全部结束，可以生成下一轮对阵</span>
			</div>
			<Button onclick={generateNextRound} disabled={generating} en="Next Round">
			{generating ? '生成中...' : '生成下一轮 →'}
		</Button>
		</div>
	{/if}

	{#if matches.length === 0}
		<EmptyState icon={ClipboardList} title="尚未生成赛程" description="请先返回赛事页面生成赛程" class="py-16 bg-neutral-50" />
	{:else}
		{#each grouped() as group, gi}
			<div class="mb-8 animate-enter" style="animation-delay:{gi * 60}ms">
				<div class="flex items-baseline gap-3 mb-3">
					<span class="text-xs font-bold uppercase tracking-widest text-neutral-500">{group.stageName}</span>
					<span class="font-black text-lg md:text-xl tracking-tight">第 {group.round} 轮</span>
				</div>				<div class="space-y-2">
					{#each group.matches as match, mi}
						{@const win = winnerSide(match)}
						{@const decided = win !== null}
						<div class="relative border border-black bg-white p-4 {justCompleted === match.id ? 'animate-flash' : ''} {decided ? 'border-l-2 border-l-black' : ''} transition-colors duration-150">
							{#if match.scheduled_at && editingMatch !== match.id}
								<div class="mb-2 flex items-center gap-1.5 text-xs font-bold text-neutral-500">
									<span class="inline-block w-1.5 h-1.5 bg-accent" aria-hidden="true"></span>
									比赛时间：{fmtTime(match.scheduled_at)}
								</div>
							{/if}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-4 flex-1">
									<div class="flex-1 text-sm text-right {win === 1 ? 'font-black' : win === 2 ? 'opacity-40 font-medium' : 'font-bold'}">
										{match.team1Name ?? 'TBD'}
									</div>
									<div class="px-3 py-1 bg-black text-white text-sm font-bold tabular-nums {justCompleted === match.id ? 'animate-pop' : ''}">
										{match.team1Score ?? 0} : {match.team2Score ?? 0}
									</div>
									<div class="flex-1 text-sm {win === 2 ? 'font-black' : win === 1 ? 'opacity-40 font-medium' : 'font-bold'}">
										{match.team2Name ?? 'TBD'}
									</div>
								</div>
								<div class="ml-4 flex items-center gap-2">
								{#if match.status === 'completed'}
									<span class="text-[10px] font-bold uppercase tracking-wider text-neutral-400">已结束</span>
								{:else if editingMatch === match.id}
									<button onclick={() => editingMatch = null} class="text-sm font-bold text-neutral-500 border-b border-neutral-500 hover:text-black hover:border-black transition-colors duration-150">
										← 取消
									</button>
								{:else if !match.team1Id || !match.team2Id}
									<span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
										<span class="w-1.5 h-1.5 bg-neutral-400 status-dot"></span>
										待定
									</span>
								{:else}
									<button onclick={() => startEdit(match)}
										class="px-3 py-1 text-sm font-bold text-black border border-black hover:bg-neutral-100 transition-colors duration-150 press">
										录入比分 →
									</button>
								{/if}
	</div>
						</div>
							{#if editingMatch === match.id}
								<div class="mt-4 pt-4 border-t border-black/20 space-y-4">
									<!-- 比赛时间编辑 -->
									<div class="flex items-center gap-3 flex-wrap">
										<label for="match-time-{match.id}" class="text-xs font-black uppercase tracking-widest text-neutral-500 shrink-0">比赛时间</label>
										<Input id="match-time-{match.id}" type="datetime-local" bind:value={matchTimeInput} class="w-auto min-w-[200px]" />
										<Button onclick={() => saveSchedule(match)} disabled={submitting === match.id} en="Save" class="rounded-none text-xs">
											{submitting === match.id ? '保存中...' : '保存时间'}
										</Button>
									</div>
									<div class="space-y-2">
										{#each Object.entries(gameScores) as [idx, score]}
											<div class="flex items-center gap-4">
												<span class="text-xs text-neutral-500 font-bold w-12">第 {Number(idx) + 1} 局</span>
												<Input type="number" bind:value={gameScores[Number(idx)].home} min="0" class="w-16 px-2 py-1 text-center" />
												<span class="text-xs text-neutral-500 font-bold">:</span>
												<Input type="number" bind:value={gameScores[Number(idx)].away} min="0" class="w-16 px-2 py-1 text-center" />
											</div>
										{/each}
									</div>
									<Button onclick={() => submitScore(match)} disabled={submitting === match.id} en="Submit" class="mt-4">
									<ArrowRight size={14} class="shrink-0" aria-hidden="true" />
									{submitting === match.id ? '提交中...' : '提交比分'}
								</Button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
