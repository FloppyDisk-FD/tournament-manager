<script lang="ts">
	import { login, register } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let isRegister = $state(false);

	async function submit() {
		error = '';
		loading = true;
		try {
			if (isRegister) {
				await register(username, password);
			} else {
				await login(username, password);
			}
			goto('/admin');
		} catch (e: any) {
			error = e.message || (isRegister ? '注册失败' : '登录失败');
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center px-4 md:px-8">
	<div class="w-full max-w-md">
		<div class="border-2 border-black bg-white p-6 md:p-8">
			<h1 class="font-black text-2xl md:text-3xl tracking-tight text-black mb-2">
				{isRegister ? '注册' : '登录'}
			</h1>
			<p class="text-sm text-neutral-600 mb-6">赛事管理平台 — 管理后台</p>

			{#if error}
				<div class="border border-accent bg-accent/10 text-accent text-sm p-3 mb-4 font-bold">{error}</div>
			{/if}

			<div class="space-y-4">
				<div>
					<label class="block text-sm font-bold text-black mb-1">用户名</label>
					<input type="text" bind:value={username}
						class="w-full border border-black font-sans px-3 py-2 md:px-4 md:py-3 text-sm bg-white focus:outline-none focus:border-accent" />
				</div>
				<div>
					<label class="block text-sm font-bold text-black mb-1">密码</label>
					<input type="password" bind:value={password}
						onkeydown={(e) => e.key === 'Enter' && submit()}
						class="w-full border border-black font-sans px-3 py-2 md:px-4 md:py-3 text-sm bg-white focus:outline-none focus:border-accent" />
				</div>
				<button onclick={submit} disabled={loading}
					class="w-full border border-black bg-black text-white font-bold px-4 py-2 md:px-6 md:py-3 text-sm transition-opacity duration-150 active:opacity-70 disabled:opacity-50">
					{loading ? (isRegister ? '注册中...' : '登录中...') : (isRegister ? '注册 →' : '登录 →')}
				</button>
			</div>

			<div class="mt-6 pt-4 border-t border-black/20 text-center text-sm">
				{#if isRegister}
					<span class="text-neutral-600">已有账号？</span>
					<button onclick={() => isRegister = false} class="font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">去登录 →</button>
				{:else}
					<span class="text-neutral-600">没有账号？</span>
					<button onclick={() => isRegister = true} class="font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">去注册 →</button>
				{/if}
			</div>
		</div>
	</div>
</div>
