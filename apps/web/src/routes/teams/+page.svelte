<script lang="ts">
	import { Users } from 'lucide-svelte';

	let { data } = $props();
	const teams: any[] = $derived(data.teams ?? []);
</script>

<div class="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12 animate-enter">
	<!-- 黑底标题栏 -->
	<div class="relative overflow-hidden bg-black text-white px-4 py-5 mb-8">
		<div class="relative z-10">
			<div class="flex items-center gap-2 mb-1">
				<span class="inline-block w-1 h-1 bg-accent" aria-hidden="true"></span>
				<span class="text-xs font-black uppercase tracking-widest text-white/60">Team Library</span>
			</div>
			<h1 class="font-black text-2xl md:text-3xl tracking-tight">队伍库</h1>
			<p class="text-sm text-white/70 mt-1">共 {teams.length} 支队伍</p>
		</div>
		<span
			class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-5xl md:text-6xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
			style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
			aria-hidden="true">Teams</span>
	</div>

	{#if teams.length === 0}
		<div class="border border-black bg-white text-center py-16">
			<p class="text-sm font-bold text-neutral-400">暂无队伍</p>
			<p class="text-xs text-neutral-400 mt-1">队伍加入赛事后将在队伍库展示</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each teams as t (t.id)}
				<a
					href="/teams/{t.id}"
					class="border border-black bg-white p-4 hover:bg-neutral-50 transition-colors duration-150 flex items-center gap-3 lift animate-enter"
				>
					{#if t.logoUrl}
						<img src={t.logoUrl} alt={t.name} width={48} height={48} class="w-12 h-12 object-contain border border-black shrink-0" />
					{:else if t.logoEmoji}
						<span class="w-12 h-12 flex items-center justify-center border border-black text-2xl shrink-0">{t.logoEmoji}</span>
					{:else}
						<span class="w-12 h-12 flex items-center justify-center border border-black bg-black text-white text-sm font-black shrink-0">{t.name?.slice(0, 1) ?? '?'}</span>
					{/if}
					<div class="min-w-0 flex-1">
						<div class="font-black tracking-tight truncate">{t.name}</div>
						<div class="text-xs font-bold text-neutral-500 mt-0.5 flex items-center gap-1.5">
							<Users size={12} class="shrink-0" aria-hidden="true" />
							<span>{t.playerCount} 名选手</span>
						</div>
					</div>
					<span class="text-sm font-bold text-black shrink-0 transition-transform duration-150 group-hover:translate-x-1">→</span>
				</a>
			{/each}
		</div>
	{/if}
</div>
