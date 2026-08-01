<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getUser, fetchUser, logout } from '$lib/stores/auth.svelte';

	let { children } = $props();

	const navGroups = $derived([
		{
			label: '主要功能',
			items: [
				{ href: '/admin', label: '概览', en: 'Overview', exact: true },
				{ href: '/admin/tournaments', label: '赛事管理', en: 'Tournaments', exact: false },
				{ href: '/admin/teams', label: '队伍库', en: 'Teams', exact: false },
			],
		},
	]);

	function isActive(href: string, exact: boolean): boolean {
		const path = page.url.pathname;
		return exact ? path === href : path === href || path.startsWith(href + '/');
	}

	onMount(() => {
		if (!getUser()) {
			fetchUser();
		}
	});
</script>

<div class="min-h-screen flex">
	<aside class="w-56 border-r-2 border-black bg-white flex flex-col">
		<div class="p-4 border-b-2 border-black">
			<h2 class="font-black text-lg tracking-tight text-black">管理后台</h2>
			<p class="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">Admin Console</p>
		</div>
		<nav class="flex-1 p-2" aria-label="管理后台导航">
			{#each navGroups as group}
				<div class="px-3 pt-4 pb-1">
					<span class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{group.label}</span>
				</div>
				{#each group.items as item}
					<a
						href={item.href}
						data-sveltekit-preload-data="hover"
						aria-current={isActive(item.href, item.exact) ? 'page' : undefined}
						class="group relative flex items-center justify-between gap-2 overflow-hidden px-3 py-2 text-sm font-bold transition-colors duration-150 {isActive(item.href, item.exact)
							? 'bg-black text-white'
							: 'text-black hover:bg-neutral-100'}"
					>
						<span class="flex items-center gap-2">
							<span class="inline-block w-1 h-1 {isActive(item.href, item.exact) ? 'bg-accent' : 'bg-transparent'}"></span>
							<span>{item.label}</span>
						</span>
						{#if isActive(item.href, item.exact)}
							<span
								class="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-5xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15 group-hover:animate-[watermark-in_200ms_ease-out]"
								style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
							>{item.en}</span>
						{/if}
					</a>
				{/each}
			{/each}
		</nav>
		<div class="p-4 border-t-2 border-black">
			<div class="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">当前用户</div>
			<div class="text-sm font-black text-black mb-2">{getUser()?.username ?? ''}</div>
			<button onclick={logout} class="text-sm font-bold text-accent border-b border-accent hover:opacity-70 transition-opacity duration-150">
				退出登录 →
			</button>
		</div>
	</aside>
	<main class="flex-1 p-4 md:p-6 overflow-auto">
		{@render children()}
	</main>
</div>
