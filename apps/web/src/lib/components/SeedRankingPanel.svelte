<script lang="ts">
	import { api } from '$lib/api/client';
	import { ArrowRight } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import { success, error } from '$lib/stores/toast.svelte';

	interface Props {
		/** 队伍列表（含 id/name/seed/logo_url/logo_emoji） */
		teams: any[];
		tournamentId: string;
		/** 关闭面板回调（父组件控制显示/隐藏） */
		onclose: () => void;
	}

	let { teams, tournamentId, onclose }: Props = $props();

	// 按当前 seed 初始化排序
	let orderedTeams = $state([...teams].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999)));
	let generating = $state(false);

	/** 上移/下移（新引用赋值，确保触发响应式） */
	function moveTeam(idx: number, dir: -1 | 1) {
		const j = idx + dir;
		if (j < 0 || j >= orderedTeams.length) return;
		const arr = [...orderedTeams];
		[arr[idx], arr[j]] = [arr[j], arr[idx]];
		orderedTeams = arr;
	}

	function shuffleSeeds() {
		orderedTeams = [...orderedTeams].sort(() => Math.random() - 0.5);
	}

	/** 按手动顺序生成赛程 */
	async function generateBySeeds() {
		if (orderedTeams.length < 2) {
			error('至少需要 2 支队伍');
			return;
		}
		generating = true;
		try {
			await api.post(`/tournaments/${tournamentId}/generate`, {
				seed_by: 'manual',
				seed_order: orderedTeams.map((tm: any) => tm.id),
			});
			success('赛程生成成功');
			setTimeout(() => window.location.reload(), 600);
		} catch (e: any) {
			error(e.message);
		} finally {
			generating = false;
		}
	}
</script>

<div class="border border-black bg-white mb-6 animate-enter">
	<!-- 标题栏：与侧边栏 tab 风格一致（黑底 + 红点指示 + 英文水印） -->
	<div class="relative overflow-hidden flex items-center justify-between gap-3 px-4 py-3 bg-black text-white">
		<div class="flex items-center gap-2 relative z-10 min-w-0">
			<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
			<span class="font-black text-base tracking-tight">种子排位</span>
		</div>
		<div class="relative z-10 flex items-center gap-3 shrink-0">
			<button onclick={onclose}
				class="text-sm font-bold text-white/80 border-b border-white/50 hover:text-white hover:border-white transition-colors duration-150">
				关闭
			</button>
		</div>
		<span
			class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-5xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
			style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
		>Seeding</span>
	</div>
	<div class="p-4">
		{#if orderedTeams.length === 0}
			<p class="text-sm text-neutral-500 font-bold text-center py-4">暂无队伍可排序</p>
		{:else}
			<div class="space-y-1">
				{#each orderedTeams as tm, i (tm.id)}
					<div class="flex items-center gap-3 border border-black bg-white px-3 py-2 select-none">
						<span class="w-7 text-xs font-black tabular-nums text-neutral-500">{i + 1}</span>
						{#if tm.logo_url}
							<img src={tm.logo_url} alt={tm.name} class="w-5 h-5 object-contain" />
						{:else if tm.logo_emoji}
							<span class="text-lg" aria-hidden="true">{tm.logo_emoji}</span>
						{/if}
						<span class="flex-1 font-bold text-sm truncate select-none">{tm.name}</span>
						<div class="flex gap-1 shrink-0">
							<button type="button" onclick={() => moveTeam(i, -1)} disabled={i === 0}
								class="border border-black px-2 py-0.5 text-xs font-bold cursor-pointer hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150" aria-label="上移">↑</button>
							<button type="button" onclick={() => moveTeam(i, 1)} disabled={i === orderedTeams.length - 1}
								class="border border-black px-2 py-0.5 text-xs font-bold cursor-pointer hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150" aria-label="下移">↓</button>
						</div>
					</div>
				{/each}
			</div>
			<p class="text-xs text-neutral-400 mt-2">使用箭头按钮调整种子顺序。</p>
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<Button onclick={generateBySeeds} disabled={generating} en="Generate" class="rounded-none">
					<ArrowRight size={14} class="shrink-0" aria-hidden="true" />
					{generating ? '生成中...' : '按此顺序生成赛程'}
				</Button>
				<button type="button" onclick={shuffleSeeds}
					class="border border-black bg-white text-black px-4 py-2 text-sm font-bold hover:bg-neutral-100 transition-colors duration-150 press">
					随机打乱
				</button>
			</div>
		{/if}
	</div>
</div>
