<script lang="ts">
	import { api } from '$lib/api/client';
	import { ArrowRight } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import { success, error } from '$lib/stores/toast.svelte';

	let { data } = $props();
	let generating = $state(false);
	let editingBanner = $state(false);
	let bannerUrl = $state(data.tournament?.coverImage ?? data.tournament?.cover_image ?? '');

	const formatMap: Record<string, string> = {
		single_elim: '单败淘汰',
		double_elim: '双败淘汰',
		round_robin: '循环联赛',
		swiss: '瑞士轮',
	};

	const statusMap: Record<string, string> = {
		draft: '未开始',
		ongoing: '进行中',
		completed: '已结束',
		cancelled: '已取消',
	};

	async function generateBracket() {
		generating = true;
		try {
			await api.post(`/tournaments/${data.tournament.id}/generate`, { seed_by: 'random' });
			success('赛程生成成功');
			setTimeout(() => window.location.reload(), 600);
		} catch (e: any) {
			error(e.message);
		} finally {
			generating = false;
		}
	}

	async function resetBracket() {
		if (!confirm('确定要重置赛程吗？所有已生成的比赛和比分将被清除，赛事回到草稿状态。')) return;
		generating = true;
		try {
			await api.post(`/tournaments/${data.tournament.id}/reset`);
			success('赛程已重置');
			setTimeout(() => window.location.reload(), 600);
		} catch (e: any) {
			error(e.message);
		} finally {
			generating = false;
		}
	}

	async function saveBanner() {
		try {
			const payload = { ...data.tournament, cover_image: bannerUrl, coverImage: bannerUrl };
			const updated = await api.put<any>(`/tournaments/${data.tournament.id}`, payload);
			data.tournament = { ...data.tournament, ...updated };
			editingBanner = false;
			success('Banner 已更新');
		} catch (e: any) {
			error(e.message);
		}
	}

	const t = $derived(data.tournament);
	const teams = $derived(data.teams);
</script>

<div>
	<div class="mb-6">
		<a href="/admin/tournaments" class="text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">← 返回赛事列表</a>
	</div>

	<!-- Banner -->
	{#if t.coverImage ?? t.cover_image}
		<div class="relative border border-black overflow-hidden mb-6 group">
			<img src={t.coverImage ?? t.cover_image} alt={t.name} class="w-full h-40 md:h-56 object-cover" />
			{#if t.status === 'draft'}
				<button onclick={() => editingBanner = !editingBanner}
					class="absolute top-2 right-2 bg-white border border-black px-2 py-1 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-150">
					编辑 Banner
				</button>
			{/if}
		</div>
	{:else if t.status === 'draft'}
		<div class="border border-black bg-neutral-50 p-4 mb-6 text-center">
			<button onclick={() => editingBanner = !editingBanner}
				class="text-sm font-bold text-neutral-600 hover:text-black transition-colors duration-150">
				+ 添加赛事 Banner
			</button>
		</div>
	{/if}

	{#if editingBanner && t.status === 'draft'}
		<div class="border border-black bg-white p-4 mb-6">
			<label class="block text-sm font-bold text-black mb-2">Banner 图片 URL</label>
			<div class="flex gap-0">
				<input type="url" bind:value={bannerUrl} placeholder="https://..."
					class="flex-1 border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none" />
				<Button onclick={saveBanner} en="Save" class="px-4">
					保存
				</Button>
				<button onclick={() => { editingBanner = false; bannerUrl = t.coverImage ?? t.cover_image ?? ''; }}
					class="border border-l-0 border-black bg-white text-black font-bold px-4 py-2 text-sm hover:bg-neutral-100 transition-colors duration-150">
					取消
				</button>
			</div>
			{#if bannerUrl}
				<div class="mt-2 border border-black overflow-hidden">
					<img src={bannerUrl} alt="preview" class="w-full h-32 object-cover" />
				</div>
			{/if}
		</div>
	{/if}

	<div class="flex items-start justify-between mb-6">
		<div>
			<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">{t.name}</h1>
			<p class="text-sm text-neutral-600 mt-1">{t.game} · {formatMap[t.format] ?? t.format} · {statusMap[t.status] ?? t.status}</p>
		</div>
		<div class="flex gap-2">
			{#if t.status === 'draft'}
				<Button onclick={generateBracket} disabled={generating} en="Generate Bracket">
					<ArrowRight size={14} class="shrink-0" aria-hidden="true" />
					{generating ? '生成中...' : '生成赛程'}
				</Button>
			{:else}
				<button onclick={resetBracket} disabled={generating}
					class="border border-black bg-white text-black font-bold px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70 disabled:opacity-50">
					{generating ? '重置中...' : '重置赛程'}
				</button>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-2 md:grid-cols-4 gap-0 border-l border-t border-black mb-6">
		<div class="border-r border-b border-black bg-white p-4">
			<div class="text-xs text-neutral-500 font-bold">赛制</div>
			<div class="font-black text-lg mt-1">{formatMap[t.format] ?? t.format}</div>
		</div>
		<div class="border-r border-b border-black bg-white p-4">
			<div class="text-xs text-neutral-500 font-bold">队伍</div>
			<div class="font-black text-lg mt-1">{teams.length}/{t.maxTeams}</div>
		</div>
		<div class="border-r border-b border-black bg-white p-4">
			<div class="text-xs text-neutral-500 font-bold">局数</div>
			<div class="font-black text-lg mt-1">BO{t.boCount}</div>
		</div>
		<div class="border-r border-b border-black bg-white p-4">
			<div class="text-xs text-neutral-500 font-bold">状态</div>
			<div class="font-black text-lg mt-1">{statusMap[t.status] ?? t.status}</div>
		</div>
	</div>

	<div class="grid grid-cols-3 gap-0 border-l border-t border-black">
		<a href="/admin/tournaments/{t.id}/teams"
			class="border-r border-b border-black bg-white p-4 md:p-6 hover:bg-neutral-50 transition-colors duration-150 text-center">
			<div class="font-black text-sm md:text-base">队伍管理</div>
			<div class="text-xs text-neutral-500 mt-1 font-bold">{teams.length} 支队伍</div>
			<div class="text-xs font-bold text-black mt-2">→</div>
		</a>
		<a href="/admin/tournaments/{t.id}/matches"
			class="border-r border-b border-black bg-white p-4 md:p-6 hover:bg-neutral-50 transition-colors duration-150 text-center">
			<div class="font-black text-sm md:text-base">比赛管理</div>
			<div class="text-xs text-neutral-500 mt-1 font-bold">录入比分</div>
			<div class="text-xs font-bold text-black mt-2">→</div>
		</a>
		<a href="/tournaments/{t.id}/bracket"
			class="border-r border-b border-black bg-white p-4 md:p-6 hover:bg-neutral-50 transition-colors duration-150 text-center">
			<div class="font-black text-sm md:text-base">赛程图</div>
			<div class="text-xs text-neutral-500 mt-1 font-bold">全屏查看</div>
			<div class="text-xs font-bold text-black mt-2">→</div>
		</a>
	</div>
</div>
