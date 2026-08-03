<script lang="ts">
	import { PLAYER_ROLE_MAP } from '$lib/constants/tournament';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';

	interface Props {
		/** 选手对象（$state 引用，字段直接 bind 同步到父级） */
		player: any;
		index: number;
		onSetCaptain: (index: number) => void;
		onRemovePlayer: (index: number) => void;
	}

	let { player, index, onSetCaptain, onRemovePlayer }: Props = $props();
</script>

<div class="rounded-none border border-black bg-white">
	<!-- 标题栏：与种子排位面板同款（黑底 + 红点 + 英文水印） -->
	<div class="relative overflow-hidden flex items-center justify-between gap-3 px-3 py-2 bg-black text-white">
		<div class="flex items-center gap-2 relative z-10 min-w-0">
			<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
			<span class="text-xs font-black tabular-nums text-white/50 shrink-0">{String(index + 1).padStart(2, '0')}</span>
			<span class="text-sm font-black text-white truncate">{player.player_name || '未命名选手'}</span>
			{#if player.is_captain}
				<span class="text-accent text-xs shrink-0" title="队长">★</span>
			{/if}
		</div>
		<div class="relative z-10 flex items-center gap-1 shrink-0">
			<button
				type="button"
				onclick={() => onSetCaptain(index)}
				class="rounded-none font-sans font-bold border border-white/60 px-2 py-0.5 text-xs transition-colors duration-150 active:opacity-70 hover:bg-white/10 {player.is_captain ? 'bg-white text-black border-white' : 'text-white'}"
				title="设为队长"
			>
				{player.is_captain ? '★' : '☆'}
			</button>
			<button
				type="button"
				onclick={() => onRemovePlayer(index)}
				class="rounded-none font-sans font-bold border border-white/60 text-accent px-2 py-0.5 text-xs transition-colors duration-150 active:opacity-70 hover:bg-white/10"
				title="删除选手"
			>
				×
			</button>
		</div>
		<span
			class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-4xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
			style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
		>Player</span>
	</div>

	<!-- 卡片体：头像 + 字段双栏 -->
	<div class="p-3 flex items-start gap-3">
		<div class="shrink-0 w-16 h-16 border border-black bg-neutral-100 flex items-center justify-center overflow-hidden">
			{#if player.avatar_url}
				<img src={player.avatar_url} alt={player.player_name || '选手'} class="w-full h-full object-cover" />
			{:else}
				<span class="font-black text-xl text-neutral-400">{player.player_name?.charAt(0) || '?'}</span>
			{/if}
		</div>

		<div class="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-2">
			<div>
				<label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">选手名</label>
				<Input bind:value={player.player_name} placeholder="选手名" />
			</div>
			<div>
				<label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">角色</label>
				<Select bind:value={player.player_role} options={Object.entries(PLAYER_ROLE_MAP).map(([value, label]) => ({ value, label }))} />
			</div>
			<div>
				<label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">游戏 ID</label>
				<Input bind:value={player.game_id} placeholder="游戏内 ID" />
			</div>
			<div>
				<label class="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">头像 URL</label>
				<Input type="url" bind:value={player.avatar_url} placeholder="https://..." />
			</div>
		</div>
	</div>
</div>
