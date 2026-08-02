<script lang="ts">
	import { login, register } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Label from '$lib/components/Label.svelte';

	let username = $state('');
	let password = $state('');
	let regRole = $state('user');
	let error = $state('');
	let loading = $state(false);
	let isRegister = $state(false);

	const roleOptions = [
		{ value: 'tournament_manager', label: '赛事管理者', desc: '管理自己创建的赛事' },
		{ value: 'team_manager', label: '队伍管理员', desc: '管理自己的队伍与队员' },
		{ value: 'user', label: '普通用户', desc: '浏览赛事与报名' },
	];

	async function submit() {
		error = '';
		loading = true;
		try {
			if (isRegister) {
				await register(username, password, regRole);
			} else {
				await login(username, password);
			}
			// invalidateAll 强制重跑所有 load，刷新导航/页面登录态
			await goto('/', { invalidateAll: true });
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
				{#if isRegister}
					<div>
						<Label>选择角色</Label>
						<div class="space-y-2">
							{#each roleOptions as opt}
								<label
									class="flex items-center gap-3 border border-black px-3 py-2 cursor-pointer transition-colors duration-150 {regRole === opt.value ? 'bg-black text-white' : 'bg-white hover:bg-neutral-50'}"
								>
									<input type="radio" name="role" value={opt.value} bind:group={regRole} class="accent-white" />
									<div>
										<div class="text-sm font-bold">{opt.label}</div>
										<div class="text-xs {regRole === opt.value ? 'text-white/70' : 'text-neutral-500'}">{opt.desc}</div>
									</div>
								</label>
							{/each}
						</div>
					</div>
				{/if}
				<div>
					<Label for="username">用户名</Label>
					<Input id="username" type="text" bind:value={username} class="md:px-4 md:py-3" />
				</div>
				<div>
					<Label for="password">密码</Label>
					<Input id="password" type="password" bind:value={password} onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && submit()} class="md:px-4 md:py-3" />
				</div>
				<Button onclick={submit} disabled={loading} en={isRegister ? 'Register' : 'Sign In'} class="w-full md:px-6 md:py-3">
					{loading ? (isRegister ? '注册中...' : '登录中...') : (isRegister ? '注册 →' : '登录 →')}
				</Button>
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
