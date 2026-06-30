<script lang="ts">
	import { api } from '$lib/api/client';
	import { cn } from '$lib/utils';
	import { success, error } from '$lib/stores/toast.svelte';

	let { data } = $props();
	let tournaments = $state(data.tournaments ?? []);
	let deleting = $state<string | null>(null);

	const statusMap: Record<string, { label: string; variant: string }> = {
		draft: { label: '未开始', variant: 'bg-neutral-100 text-black' },
		ongoing: { label: '进行中', variant: 'bg-black text-white' },
		completed: { label: '已结束', variant: 'bg-accent text-white' },
		cancelled: { label: '已取消', variant: 'bg-white text-neutral-500 line-through border border-black' },
	};

	const formatMap: Record<string, string> = {
		single_elim: '单败淘汰',
		double_elim: '双败淘汰',
		round_robin: '循环联赛',
		swiss: '瑞士轮',
	};

	async function deleteTournament(id: string) {
		if (!confirm('确定删除此赛事？此操作不可撤销。')) return;
		deleting = id;
		try {
			await api.del(`/tournaments/${id}`);
			tournaments = tournaments.filter(t => t.id !== id);
			success('赛事已删除');
		} catch (e: any) {
			error(e.message || '删除失败');
		} finally {
			deleting = null;
		}
	}
</script>

<div class="animate-enter">
	<div class="flex items-center justify-between mb-6 flex-wrap gap-3">
		<div class="flex items-baseline gap-3">
			<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">赛事管理</h1>
			<span class="text-xs font-bold uppercase tracking-widest text-neutral-500">{tournaments.length} 项</span>
		</div>
		<a href="/admin/tournaments/new"
			class="border border-black bg-black text-white font-bold px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70 press hover:opacity-90">
			创建赛事 →
		</a>
	</div>

	{#if tournaments.length === 0}
		<div class="border border-black bg-neutral-50 p-12 text-center">
			<p class="text-sm text-neutral-500 font-bold mb-1">暂无赛事</p>
			<p class="text-xs text-neutral-400">点击右上角"创建赛事"开始</p>
		</div>
	{:else}
		<div class="border border-black overflow-hidden">
			<table class="w-full text-sm">
				<thead class="bg-black text-white">
					<tr>
						<th class="text-left px-4 py-3 font-bold">名称</th>
						<th class="text-left px-4 py-3 font-bold">游戏</th>
						<th class="text-left px-4 py-3 font-bold">赛制</th>
						<th class="text-left px-4 py-3 font-bold">状态</th>
						<th class="text-left px-4 py-3 font-bold">操作</th>
					</tr>
				</thead>
				<tbody>
					{#each tournaments as t, i (t.id)}
						<tr class="border-t border-black/20 hover:bg-neutral-50 transition-colors duration-150 animate-enter" style="animation-delay:{Math.min(i * 30, 240)}ms">
							<td class="px-4 py-3 font-bold">{t.name}</td>
							<td class="px-4 py-3 text-neutral-600">{t.game}</td>
							<td class="px-4 py-3 text-neutral-600">{formatMap[t.format] ?? t.format}</td>
							<td class="px-4 py-3">
								<span class={cn('px-2 py-0.5 text-xs font-bold', statusMap[t.status]?.variant)}>
									{statusMap[t.status]?.label ?? t.status}
								</span>
							</td>
							<td class="px-4 py-3">
								<div class="flex gap-3">
									<a href="/admin/tournaments/{t.id}" class="font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">编辑</a>
									{#if t.status === 'draft'}
										<button
											onclick={() => deleteTournament(t.id)}
											disabled={deleting === t.id}
											class="font-bold text-accent border-b border-accent hover:opacity-70 transition-opacity duration-150 disabled:opacity-50"
										>
											{deleting === t.id ? '删除中...' : '删除 →'}
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
