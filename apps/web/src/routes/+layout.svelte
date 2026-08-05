<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { Trophy, LayoutDashboard, LogOut, Bell, User, LayoutGrid } from 'lucide-svelte';
	import { api } from '$lib/api/client';
	import { fetchUser, getUser, logout } from '$lib/stores/auth.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { success, error, info } from '$lib/stores/toast.svelte';
	import { isPushSupported, getPushSubscription, enablePush, disablePush } from '$lib/push';
	import { beforeNavigate, afterNavigate } from '$app/navigation';

	let { children, data } = $props();

	// 顶部导航进度条（瑞士风格：2px 红色细线）
	let navigating = $state(false);
	let navTimer: ReturnType<typeof setTimeout> | undefined;
	beforeNavigate(() => {
		navigating = true;
		clearTimeout(navTimer);
	});
	afterNavigate(() => {
		navTimer = setTimeout(() => (navigating = false), 250);
	});

	// 通知中心
	let notifOpen = $state(false);
	let notifications = $state<any[]>([]);
	let unread = $state(0);
	let notifLoaded = $state(false);

	async function loadNotifications() {
		try {
			const [list, count] = await Promise.all([
				api.get<any[]>('/notifications'),
				api.get<{ count: number }>('/notifications/unread-count'),
			]);
			notifications = Array.isArray(list) ? list : [];
			unread = count?.count ?? 0;
			notifLoaded = true;
		} catch { /* ignore */ }
	}

	async function markAllRead() {
		try {
			await api.post('/notifications/read-all');
			notifications = notifications.map((n) => ({ ...n, read: true }));
			unread = 0;
		} catch { /* ignore */ }
	}

	function formatTime(iso?: string): string {
		if (!iso) return '';
		const t = new Date(iso).getTime();
		if (Number.isNaN(t)) return '';
		const diff = Date.now() - t;
		if (diff < 60_000) return '刚刚';
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
		const d = new Date(t);
		return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	// 系统通知（Web Push）
	let pushSupported = $state(false);
	let pushEnabled = $state(false);
	let pushToggling = $state(false);

	async function initPush() {
		if (!isPushSupported()) return;
		pushSupported = true;
		pushEnabled = !!(await getPushSubscription());
	}

	async function togglePush() {
		if (pushToggling) return;
		pushToggling = true;
		try {
			if (pushEnabled) {
				await disablePush();
				pushEnabled = false;
				info('已关闭系统通知');
			} else {
				const ok = await enablePush();
				if (ok) {
					pushEnabled = true;
					success('系统通知已开启');
				} else {
					error('无法开启：浏览器未授权或服务端未配置 VAPID');
				}
			}
		} finally {
			pushToggling = false;
		}
	}

	onMount(() => {
		if (data.authenticated && !getUser()) {
			fetchUser();
		}
		if (data.authenticated) {
			loadNotifications();
			initPush();
		}
	});
</script>

<div class="min-h-screen flex flex-col">
	{#if navigating}
		<div class="fixed top-0 left-0 right-0 h-0.5 bg-accent z-[100]" aria-hidden="true">
			<div class="h-full w-1/3 bg-accent progress-slide"></div>
		</div>
	{/if}
	<a href="#main-content" class="skip-link">跳到主内容</a>
	<nav class="bg-black/75 backdrop-blur-md border-b-2 border-black px-4 md:px-8 h-14 flex items-center justify-between sticky top-0 z-50" aria-label="主导航">
		<a href="/" class="font-black text-lg md:text-xl tracking-tight text-white press inline-flex items-center gap-2" aria-label="返回首页">
			<Trophy size={20} strokeWidth={2} class="shrink-0" aria-hidden="true" />
			Tournix
		</a>
		<div class="flex items-center gap-4 md:gap-6">
			{#if data.authenticated}
				<div class="relative">
					<button
						onclick={() => {
							if (!notifLoaded) loadNotifications();
							notifOpen = !notifOpen;
						}}
						class="relative p-1.5 press text-white"
						aria-label="通知"
					>
						<Bell size={18} class="shrink-0" aria-hidden="true" />
						{#if unread > 0}
							<span class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 bg-accent text-white text-[10px] font-black flex items-center justify-center tabular-nums">{unread > 99 ? '99+' : unread}</span>
						{/if}
					</button>
					{#if notifOpen}
						<div class="fixed inset-0 z-40" onclick={() => (notifOpen = false)} aria-hidden="true"></div>
						<div class="absolute right-0 top-full mt-2 z-50 w-80 border border-black bg-white">
							<div class="relative overflow-hidden flex items-center justify-between px-3 py-2 bg-black text-white">
								<div class="flex items-center gap-2 relative z-10">
									<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
									<span class="text-xs font-bold uppercase tracking-widest">通知</span>
									{#if unread > 0}
										<span class="text-[10px] font-black bg-accent text-white px-1.5 py-0.5">{unread}</span>
									{/if}
								</div>
								{#if unread > 0}
									<button onclick={markAllRead} class="text-xs font-bold text-white/80 border-b border-white/50 hover:text-white hover:border-white transition-colors duration-150 relative z-10">全部已读</button>
								{/if}
								<span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-4xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
									style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)">Notice</span>
							</div>
							<div class="max-h-72 overflow-y-auto">
								{#if notifications.length === 0}
									<p class="text-sm text-neutral-500 font-bold text-center py-6">暂无通知</p>
								{:else}
									{#each notifications as n}
										<a
											href={n.link ?? '/admin'}
											onclick={() => (notifOpen = false)}
											class="block px-3 py-2 border-b border-black/20 hover:bg-neutral-50 transition-colors duration-150 {n.read ? 'opacity-60' : ''}"
										>
											<div class="flex items-start justify-between gap-3">
												<div class="flex items-center gap-2 min-w-0">
													<span class="w-1.5 h-1.5 shrink-0 mt-1 {n.read ? 'bg-neutral-300' : 'bg-accent'}" aria-hidden="true"></span>
													<span class="text-sm font-bold truncate">{n.title}</span>
												</div>
												<span class="text-[10px] text-neutral-400 font-bold shrink-0 tabular-nums">{formatTime(n.createdAt)}</span>
											</div>
											<p class="text-xs text-neutral-500 mt-1 ml-3.5 line-clamp-2 leading-relaxed">{n.message}</p>
										</a>
									{/each}
								{/if}
							</div>
							<div class="border-t border-black px-3 py-2.5 flex items-center justify-between gap-3 bg-neutral-50">
								<div class="min-w-0">
									<p class="text-xs font-bold text-black">系统通知</p>
									<p class="text-[10px] text-neutral-400 font-bold">浏览器桌面推送提醒</p>
								</div>
								{#if !pushSupported}
									<span class="text-[10px] text-neutral-400 font-bold shrink-0">浏览器不支持</span>
								{:else}
									<button
										onclick={togglePush}
										disabled={pushToggling}
										class="text-xs font-bold border border-black px-3 py-1 transition-colors duration-150 active:opacity-70 disabled:opacity-50 {pushEnabled ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-100'}"
									>
										{pushEnabled ? '已开启' : '开启'}
									</button>
								{/if}
							</div>
						</div>
					{/if}
				</div>
				<a href="/profile" class="text-sm font-bold text-white border-b-2 border-white hover:text-accent hover:border-accent transition-colors duration-150 link-underline inline-flex items-center gap-1.5">
					<User size={15} class="shrink-0" aria-hidden="true" />
					个人资料
				</a>
				{#if data.role && data.role !== 'tournament_manager'}
					<a href="/dashboard" class="text-sm font-bold text-white border-b-2 border-white hover:text-accent hover:border-accent transition-colors duration-150 link-underline inline-flex items-center gap-1.5">
						<LayoutGrid size={15} class="shrink-0" aria-hidden="true" />
						我的后台
					</a>
				{/if}
				{#if data.role === 'admin' || data.role === 'tournament_manager'}
					<a href="/admin" class="text-sm font-bold text-white border-b-2 border-white hover:text-accent hover:border-accent transition-colors duration-150 link-underline inline-flex items-center gap-1.5">
						<LayoutDashboard size={15} class="shrink-0" aria-hidden="true" />
						管理后台
					</a>
				{/if}
				<button onclick={logout} class="text-sm font-bold text-neutral-400 hover:text-accent transition-colors duration-150 press inline-flex items-center gap-1.5" aria-label="退出登录">
					<LogOut size={15} class="shrink-0" aria-hidden="true" />
					退出
				</button>
			{:else}
				<a href="/login" class="text-sm font-bold text-white border-b-2 border-white hover:text-accent hover:border-accent transition-colors duration-150 link-underline inline-flex items-center gap-1.5">
					<LayoutDashboard size={15} class="shrink-0" aria-hidden="true" />
					管理后台
				</a>
			{/if}
		</div>
	</nav>
	<main id="main-content" class="flex-1" tabindex="-1">
		{@render children()}
	</main>
	<footer class="bg-black text-white py-8 md:py-12 px-4 md:px-8">
		<div class="max-w-7xl mx-auto">
			<span class="font-black text-lg md:text-xl">Tournix</span>
			<p class="text-sm text-neutral-400 mt-2">&copy; {new Date().getFullYear()} — Tournix Tournament Platform</p>
		</div>
	</footer>
</div>

<Toast />
