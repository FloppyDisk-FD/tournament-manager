<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api } from '$lib/api/client';
	import BackLink from '$lib/components/BackLink.svelte';
	import PanelHeader from '$lib/components/PanelHeader.svelte';

	let profile = $state<any>(null);
	let loaded = $state(false);

	const userId = $derived(page.params.id);

	onMount(async () => {
		try {
			profile = await api.get<any>(`/users/${userId}/profile`);
		} catch { /* ignore */ } finally {
			loaded = true;
		}
	});

	const joinedAt = $derived.by(() => {
		if (!profile?.createdAt) return '';
		return new Date(profile.createdAt).toLocaleDateString('zh-CN');
	});
</script>

<div class="min-h-screen bg-white px-4 md:px-8 py-6 max-w-5xl mx-auto">
	<BackLink href="/" class="mb-4 inline-block">← 返回</BackLink>

	{#if !loaded}
		<div class="border border-black bg-white p-6 text-sm font-bold text-neutral-500">加载中…</div>
	{:else if !profile}
		<div class="border border-black bg-white p-6 text-sm font-bold text-neutral-500">用户不存在</div>
	{:else}
		<!-- 标题栏 -->
		<div class="relative overflow-hidden bg-black text-white px-4 py-3 mb-6">
			<div class="flex items-center gap-3 relative z-10">
				{#if profile.avatarUrl}
					<img src={profile.avatarUrl} alt="" class="w-9 h-9 object-cover bg-white p-0.5 border border-white/30 shrink-0" />
				{:else}
					<span class="w-9 h-9 flex items-center justify-center bg-white/10 border border-white/30 shrink-0 text-lg font-black">{(profile.displayName ?? profile.username)?.slice(0, 1) ?? '?'}</span>
				{/if}
				<div>
					<h1 class="font-black text-lg tracking-tight">{profile.displayName ?? profile.username}</h1>
					<div class="text-[10px] font-bold text-white/50 uppercase tracking-widest">@{profile.username}{joinedAt ? ` · ${joinedAt} 加入` : ''}</div>
				</div>
			</div>
			<span class="absolute right-3 top-1/2 -translate-y-1/2 text-2xl font-black tracking-widest text-white/10 select-none pointer-events-none [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden="true">PROFILE</span>
		</div>

		{#if profile.bio}
			<div class="border border-black bg-white px-4 py-3 mb-6">
				<p class="text-sm whitespace-pre-wrap">{profile.bio}</p>
			</div>
		{/if}

		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- 参赛记录 -->
			<div class="border border-black bg-white">
				<PanelHeader title="参赛记录" watermark="Entries" meta={profile.registrations.length ? `${profile.registrations.length} 项` : undefined} />
				{#if profile.registrations.length === 0}
					<div class="px-4 py-8 text-center text-sm font-bold text-neutral-400">暂无参赛记录</div>
				{:else}
					<ul class="divide-y divide-black">
						{#each profile.registrations as r}
							<li class="px-4 py-2.5">
								<div class="flex items-center justify-between gap-3">
									<a href="/tournaments/{r.tournamentId}" class="text-sm font-bold hover:text-accent transition-colors duration-150 truncate">{r.tournamentName}</a>
									<span class="text-[10px] font-black px-1.5 py-0.5 shrink-0 {r.status === 'approved' ? 'bg-black text-white' : r.status === 'rejected' ? 'bg-accent text-white' : 'bg-neutral-100 text-black border border-black'}">{r.status === 'approved' ? '已通过' : r.status === 'rejected' ? '已拒绝' : '待审核'}</span>
								</div>
								<div class="flex items-center gap-2 mt-1 text-xs text-neutral-500 font-bold">
									{#if r.teamId}
										<a href="/teams/{r.teamId}" class="hover:text-accent transition-colors duration-150">{r.teamName ?? '队伍'}</a>
									{:else if r.teamName}
										<span>{r.teamName}</span>
									{/if}
									<span>·</span>
									<span>{new Date(r.createdAt).toLocaleDateString('zh-CN')}</span>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- 主办赛事 -->
			<div class="border border-black bg-white">
				<PanelHeader title="主办赛事" watermark="Hosted" meta={profile.hosted.length ? `${profile.hosted.length} 项` : undefined} />
				{#if profile.hosted.length === 0}
					<div class="px-4 py-8 text-center text-sm font-bold text-neutral-400">暂无主办赛事</div>
				{:else}
					<ul class="divide-y divide-black">
						{#each profile.hosted as t}
							<li class="flex items-center justify-between gap-3 px-4 py-2.5">
								<a href="/tournaments/{t.id}" class="text-sm font-bold hover:text-accent transition-colors duration-150 truncate">{t.name}</a>
								<span class="text-[10px] font-bold text-neutral-500 shrink-0">{t.status}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/if}
</div>
