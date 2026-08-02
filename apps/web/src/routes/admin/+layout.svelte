<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Menu, X } from 'lucide-svelte';
	import { getUser, fetchUser, logout } from '$lib/stores/auth.svelte';

	let { children } = $props();

	// 移动端抽屉状态（桌面端始终显示侧边栏）
	let sidebarOpen = $state(false);

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
		// ESC 关闭抽屉
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') sidebarOpen = false;
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// 抽屉打开时锁定 body 滚动（仅客户端）
	$effect(() => {
		document.body.style.overflow = sidebarOpen ? 'hidden' : '';
	});
</script>

{#snippet navContent(close: () => void)}
	<nav class="flex-1 p-2" aria-label="管理后台导航">
		{#each navGroups as group}
			<div class="px-3 pt-4 pb-1">
				<span class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{group.label}</span>
			</div>
			{#each group.items as item}
				<a
					href={item.href}
					onclick={close}
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
{/snippet}

<div class="min-h-screen flex flex-col md:flex-row">
	<!-- 移动端顶栏 -->
	<header class="md:hidden sticky top-0 z-40 bg-white border-b-2 border-black flex items-center justify-between px-4 h-14">
		<div class="flex items-center gap-3 min-w-0">
			<button
				onclick={() => (sidebarOpen = true)}
				class="p-1.5 -ml-1.5 press"
				aria-label="打开菜单"
				aria-expanded={sidebarOpen}
				aria-controls="admin-sidebar-mobile"
			>
				<Menu size={22} aria-hidden="true" />
			</button>
			<h2 class="font-black text-lg tracking-tight text-black truncate">管理后台</h2>
		</div>
		<span class="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Admin</span>
	</header>

	<!-- 移动端遮罩 -->
	{#if sidebarOpen}
		<div
			class="fixed inset-0 z-40 bg-black/40 md:hidden"
			onclick={() => (sidebarOpen = false)}
			aria-hidden="true"
		></div>
	{/if}

	<!-- 移动端抽屉 -->
	<aside
		id="admin-sidebar-mobile"
		class="md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white border-r-2 border-black flex flex-col transition-transform duration-200 ease-out {sidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
		aria-label="管理后台导航（移动端）"
	>
		<div class="p-4 border-b-2 border-black flex items-center justify-between">
			<div>
				<h2 class="font-black text-lg tracking-tight text-black">管理后台</h2>
				<p class="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">Admin Console</p>
			</div>
			<button onclick={() => (sidebarOpen = false)} class="p-1.5 press" aria-label="关闭菜单">
				<X size={18} aria-hidden="true" />
			</button>
		</div>
		{@render navContent(() => (sidebarOpen = false))}
	</aside>

	<!-- 桌面端侧边栏 -->
	<aside class="hidden md:flex w-56 border-r-2 border-black bg-white flex-col shrink-0">
		<div class="p-4 border-b-2 border-black">
			<h2 class="font-black text-lg tracking-tight text-black">管理后台</h2>
			<p class="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">Admin Console</p>
		</div>
		{@render navContent(() => {})}
	</aside>

	<main class="flex-1 p-4 md:p-6 overflow-auto">
		{@render children()}
	</main>
</div>
