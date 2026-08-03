<script lang="ts">
	import { api } from '$lib/api/client';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { FORMAT_MAP } from '$lib/constants/tournament';
	import { success, error } from '$lib/stores/toast.svelte';

	let { data } = $props();
	let tournaments = $state(data.tournaments ?? []);
	let deleting = $state<string | null>(null);

	async function deleteTournament(id: string) {
		if (!confirm('确定删除此赛事？此操作不可撤销。')) return;
		deleting = id;
		try {
			await api.del(`/tournaments/${id}`);
			tournaments = tournaments.filter((t: any) => t.id !== id);
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
		<Button href="/admin/tournaments/new" en="Create Tournament">
			创建赛事 →
		</Button>
	</div>

	{#if tournaments.length === 0}
		<EmptyState title="暂无赛事" description="点击右上角「创建赛事」开始" class="bg-neutral-50 p-12" />
	{:else}
		<div class="border border-black overflow-hidden overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="bg-black text-white">
					<tr>
						<th class="text-left px-4 py-3 font-bold sticky left-0 bg-black z-10">名称</th>
						<th class="text-left px-4 py-3 font-bold">游戏</th>
						<th class="text-left px-4 py-3 font-bold">赛制</th>
						<th class="text-left px-4 py-3 font-bold">状态</th>
						<th class="text-left px-4 py-3 font-bold">操作</th>
					</tr>
				</thead>
				<tbody>
					{#each tournaments as t, i (t.id)}
						<tr class="group border-t border-black/20 hover:bg-neutral-50 transition-colors duration-150 animate-enter" style="animation-delay:{Math.min(i * 30, 240)}ms">
							<td class="px-4 py-3 font-bold sticky left-0 bg-white group-hover:bg-neutral-50 transition-colors duration-150">{t.name}</td>
							<td class="px-4 py-3 text-neutral-600">{t.game}</td>
							<td class="px-4 py-3 text-neutral-600">{FORMAT_MAP[t.format] ?? t.format}</td>
							<td class="px-4 py-3">
								<StatusBadge status={t.status} />
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
