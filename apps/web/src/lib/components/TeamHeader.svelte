<script lang="ts">
	/** 队伍头部（全局队伍主页 + 赛事内队伍页共用） */

	interface Props {
		team: any;
		/** 是否显示种子/分组（赛事上下文） */
		showSeed?: boolean;
		/** 右侧附加内容（插槽） */
		children?: import('svelte').Snippet;
	}

	let { team, showSeed = true, children }: Props = $props();

	function logoUrlOf(t: any): string | null {
		return t?.logoUrl ?? t?.logo_url ?? null;
	}
	function statusLabel(s: string | null | undefined): string {
		if (!s) return '';
		return s === 'active' ? '活跃' : s === 'eliminated' ? '已淘汰' : s === 'withdrawn' ? '已退出' : s;
	}
</script>

<div class="relative overflow-hidden bg-black text-white px-4 py-4 mb-6">
	<div class="flex items-center gap-4 relative z-10 flex-wrap">
		{#if logoUrlOf(team)}
			<img src={logoUrlOf(team)} alt={team.name} width={56} height={56} class="w-14 h-14 md:w-16 md:h-16 object-contain bg-white p-1 border border-white/30 shrink-0" />
		{:else if team.logo_emoji ?? team.logoEmoji}
			<div class="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center border border-white/30 bg-white/10 text-3xl shrink-0" aria-hidden="true">{team.logo_emoji ?? team.logoEmoji}</div>
		{/if}
		<div class="min-w-0">
			<div class="flex items-center gap-3 flex-wrap">
				<h1 class="font-black text-xl md:text-2xl tracking-tight text-white truncate">{team.name}</h1>
				{#if team.status}
					<span class="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/80 border border-white/40 px-2 py-0.5">
						<span class="w-1.5 h-1.5 bg-accent" aria-hidden="true"></span>
						{statusLabel(team.status)}
					</span>
				{/if}
			</div>
			{#if showSeed && (team.seed != null || team.group_label)}
				<div class="text-xs font-bold text-white/60 mt-1">
					种子 #{team.seed}{#if team.seed != null && team.group_label} · {/if}{#if team.group_label}分组 {team.group_label}{/if}
				</div>
			{/if}
		</div>
		{#if children}{@render children()}{/if}
	</div>
	<span
		class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-4xl md:text-5xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/10"
		style="-webkit-mask-image: linear-gradient(to left, black, transparent); mask-image: linear-gradient(to left, black, transparent)"
		aria-hidden="true"
	>TEAM</span>
</div>
