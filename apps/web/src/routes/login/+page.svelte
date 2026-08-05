<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Label from '$lib/components/Label.svelte';

	let { form } = $props();

	let username = $state('');
	let password = $state('');
	let regRole = $state('user');
	let error = $state('');
	let loading = $state(false);
	let isRegister = $state(false);
	let registered = $state(false);

	// 从 URL 读取 Auth.js 错误（登录失败跳回 /login?error=CredentialsSignin 时展示）
	if (typeof window !== 'undefined') {
		const urlError = new URL(window.location.href).searchParams.get('error');
		if (urlError) {
			error = urlError === 'CredentialsSignin' ? '用户名或密码错误' : '登录失败，请重试';
			// 清除 URL 参数（避免刷新后重复提示）
			history.replaceState(null, '', window.location.pathname);
		}
	}

	const roleOptions = [
		{ value: 'tournament_manager', label: '赛事管理者', desc: '管理自己创建的赛事' },
		{ value: 'team_manager', label: '队伍管理员', desc: '管理自己的队伍与队员' },
		{ value: 'user', label: '普通用户', desc: '浏览赛事与报名' },
	];

	async function doLogin() {
		error = '';
		if (!username || !password) { error = '请输入用户名和密码'; return; }
		loading = true;
		try {
			await signIn('credentials', { username, password, redirectTo: '/' });
			// signIn 内部会按服务端返回跳转（成功→主页，失败→/login?error=...）
			// 注意：不要在这里额外 window.location.href='/'，会覆盖 signIn 的错误跳转
		} catch (e: any) {
			error = e?.message?.includes('CredentialsSignin') ? '用户名或密码错误' : (e?.message || '登录失败');
		} finally {
			loading = false;
		}
	}

	function onRegisterSuccess() {
		registered = true;
		// 注册成功后自动切换回登录态并预填用户名
		isRegister = false;
		setTimeout(() => doLogin(), 50);
	}
</script>

<div class="min-h-screen flex items-center justify-center px-4 md:px-8">
	<div class="w-full max-w-md">
		<div class="border-2 border-black bg-white p-6 md:p-8">
			<h1 class="font-black text-2xl md:text-3xl tracking-tight text-black mb-2">
				{isRegister ? '注册' : '登录'}
			</h1>
			<p class="text-sm text-neutral-600 mb-6">Tournix — 管理后台</p>

			{#if error}
				<div class="border border-accent bg-accent/10 text-accent text-sm p-3 mb-4 font-bold">{error}</div>
			{/if}
			{#if form?.error}
				<div class="border border-accent bg-accent/10 text-accent text-sm p-3 mb-4 font-bold">{form.error}</div>
			{/if}
			{#if registered}
				<div class="border border-black bg-black text-white text-sm p-3 mb-4 font-bold">注册成功，正在登录…</div>
			{/if}

			{#if isRegister}
				<form method="POST" action="?/register" class="space-y-4">
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
					<div>
						<Label for="regUsername">用户名</Label>
						<Input id="regUsername" name="username" type="text" bind:value={username} class="md:px-4 md:py-3" />
					</div>
					<div>
						<Label for="regPassword">密码</Label>
						<Input id="regPassword" name="password" type="password" bind:value={password} placeholder="至少 8 位，含字母和数字" class="md:px-4 md:py-3" />
						<p class="text-xs text-neutral-400 mt-1">至少 8 位，需包含字母和数字</p>
					</div>
					<Button type="submit" en="Register" class="w-full md:px-6 md:py-3">注册 →</Button>
				</form>
			{:else}
				<div class="space-y-4">
					<div>
						<Label for="username">用户名</Label>
						<Input id="username" type="text" bind:value={username} onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && doLogin()} class="md:px-4 md:py-3" />
					</div>
					<div>
						<Label for="password">密码</Label>
						<Input id="password" type="password" bind:value={password} onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && doLogin()} class="md:px-4 md:py-3" />
					</div>
					<Button onclick={doLogin} disabled={loading} en="Sign In" class="w-full md:px-6 md:py-3">
						{loading ? '登录中...' : '登录 →'}
					</Button>
				</div>
			{/if}

			<div class="mt-6 pt-4 border-t border-black/20 text-center text-sm">
				{#if isRegister}
					<span class="text-neutral-600">已有账号？</span>
					<button type="button" onclick={() => (isRegister = false)} class="font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">去登录 →</button>
				{:else}
					<span class="text-neutral-600">没有账号？</span>
					<button type="button" onclick={() => (isRegister = true)} class="font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">去注册 →</button>
				{/if}
			</div>
		</div>
	</div>
</div>