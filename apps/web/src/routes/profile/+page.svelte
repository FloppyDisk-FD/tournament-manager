<script lang="ts">
	import { onMount } from 'svelte';
	import { User } from 'lucide-svelte';
	import { api } from '$lib/api/client';
	import { getUser } from '$lib/stores/auth.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Label from '$lib/components/Label.svelte';
	import { success, error } from '$lib/stores/toast.svelte';

	let profile = $state<any>(null);
	let loaded = $state(false);
	let saving = $state(false);

	let avatarUrl = $state('');
	let displayName = $state('');
	let bio = $state('');

	onMount(async () => {
		if (!getUser()) { loaded = true; return; }
		try {
			profile = await api.get<any>('/auth/me');
			avatarUrl = profile?.avatar_url ?? '';
			displayName = profile?.display_name ?? '';
			bio = profile?.bio ?? '';
		} catch { /* ignore */ } finally {
			loaded = true;
		}
	});

	async function save() {
		saving = true;
		try {
			await api.put('/auth/me', {
				avatar_url: avatarUrl.trim() || undefined,
				display_name: displayName.trim() || undefined,
				bio: bio.trim() || undefined,
			});
			profile = { ...profile, avatar_url: avatarUrl.trim() || null, display_name: displayName.trim() || null, bio: bio.trim() || null };
			success('个人资料已保存');
		} catch (e: any) {
			error(e.message || '保存失败');
		} finally {
			saving = false;
		}
	}
</script>

<div class="max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12 animate-enter">
	<div class="flex items-baseline justify-between mb-8 flex-wrap gap-2">
		<div>
			<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">个人资料</h1>
			<p class="text-sm text-neutral-600 mt-1">@{profile?.username ?? getUser()?.username ?? ''}</p>
		</div>
		<span class="text-xs font-bold uppercase tracking-widest text-neutral-500">Profile</span>
	</div>

	{#if !getUser()}
		<div class="border border-black bg-white text-center py-16">
			<p class="text-sm text-neutral-500 font-bold mb-3">请先登录</p>
			<a href="/login" class="text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">去登录 →</a>
		</div>
	{:else if !loaded}
		<div class="skeleton h-16 w-full" aria-hidden="true"></div>
	{:else}
		<div class="border border-black bg-white">
			<div class="relative overflow-hidden flex items-center justify-between px-4 py-3 bg-black text-white">
				<div class="flex items-center gap-2 relative z-10">
					<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
					<span class="font-black text-base tracking-tight">资料编辑</span>
				</div>
				<span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-4xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
					style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)">Profile</span>
			</div>
			<div class="p-4 space-y-4">
				<div class="flex items-center gap-4">
					{#if avatarUrl}
						<img src={avatarUrl} alt="头像" class="w-20 h-20 object-cover border border-black shrink-0" />
					{:else}
						<div class="w-20 h-20 border border-black bg-neutral-100 flex items-center justify-center shrink-0">
							<User size={32} class="text-neutral-400" aria-hidden="true" />
						</div>
					{/if}
					<div class="flex-1">
						<Label for="avatar">头像图片 URL</Label>
						<Input id="avatar" type="url" bind:value={avatarUrl} placeholder="https://..." />
					</div>
				</div>
				<div>
					<Label for="displayName">昵称</Label>
					<Input id="displayName" bind:value={displayName} placeholder="你的昵称（可选）" maxlength="50" />
				</div>
				<div>
					<Label for="bio">个人简介</Label>
					<textarea id="bio" bind:value={bio} rows="3"
						class="w-full rounded-none border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent"
						placeholder="介绍一下自己（可选）"></textarea>
				</div>
				<div class="flex gap-2 pt-2">
					<Button onclick={save} disabled={saving} en="Save" class="rounded-none">
						{saving ? '保存中...' : '保存资料'}
					</Button>
				</div>
			</div>
		</div>
	{/if}
</div>
