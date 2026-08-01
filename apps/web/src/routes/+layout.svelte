<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { Trophy, LayoutDashboard, LogOut } from 'lucide-svelte';
	import { fetchUser, getUser, logout } from '$lib/stores/auth.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children, data } = $props();

	onMount(() => {
		if (data.authenticated && !getUser()) {
			fetchUser();
		}
	});
</script>

<div class="min-h-screen flex flex-col">
	<a href="#main-content" class="skip-link">跳到主内容</a>
	<nav class="bg-black/75 backdrop-blur-md border-b-2 border-black px-4 md:px-8 h-14 flex items-center justify-between sticky top-0 z-50" aria-label="主导航">
		<a href="/" class="font-black text-lg md:text-xl tracking-tight text-white press inline-flex items-center gap-2" aria-label="返回首页">
			<Trophy size={20} strokeWidth={2} class="shrink-0" aria-hidden="true" />
			赛事管理平台
		</a>
		<div class="flex items-center gap-4 md:gap-6">
			{#if data.authenticated}
				<a href="/admin" class="text-sm font-bold text-white border-b-2 border-white hover:text-accent hover:border-accent transition-colors duration-150 link-underline inline-flex items-center gap-1.5">
					<LayoutDashboard size={15} class="shrink-0" aria-hidden="true" />
					管理后台
				</a>
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
			<span class="font-black text-lg md:text-xl">赛事管理平台</span>
			<p class="text-sm text-neutral-400 mt-2">&copy; {new Date().getFullYear()} — Swiss Style Tournament System</p>
		</div>
	</footer>
</div>

<Toast />
