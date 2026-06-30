<script lang="ts">
	import { onMount } from 'svelte';
	import { getUser, fetchUser, logout } from '$lib/stores/auth.svelte';

	let { children } = $props();

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
		</div>
		<nav class="flex-1 p-2">
			<a href="/admin" class="block px-3 py-2 text-sm font-bold hover:bg-neutral-100 transition-colors duration-150 text-black">
				概览
			</a>
			<a href="/admin/tournaments" class="block px-3 py-2 text-sm font-bold hover:bg-neutral-100 transition-colors duration-150 text-black">
				赛事管理
			</a>
			<a href="/admin/teams" class="block px-3 py-2 text-sm font-bold hover:bg-neutral-100 transition-colors duration-150 text-black">
				队伍库
			</a>
		</nav>
		<div class="p-4 border-t-2 border-black">
			<div class="text-sm font-bold text-black mb-2">{getUser()?.username ?? ''}</div>
			<button onclick={logout} class="text-sm font-bold text-accent border-b border-accent hover:opacity-70 transition-opacity duration-150">
				退出登录 →
			</button>
		</div>
	</aside>
	<main class="flex-1 p-4 md:p-6 overflow-auto">
		{@render children()}
	</main>
</div>
