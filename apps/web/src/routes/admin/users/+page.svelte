<script lang="ts">
	import { Search, Ban, RotateCcw } from 'lucide-svelte';
	import { api } from '$lib/api/client';
	import Input from '$lib/components/Input.svelte';
	import PanelHeader from '$lib/components/PanelHeader.svelte';
	import Select from '$lib/components/Select.svelte';
	import { success, error } from '$lib/stores/toast.svelte';
	import { goto } from '$app/navigation';

	let { data } = $props();
	let users = $derived(data.users);
	let total = $derived(data.total);
	let q = $state(data.q ?? '');
	let page = $derived(data.page);

	const roleLabels: Record<string, string> = {
		admin: '系统管理员',
		tournament_manager: '赛事管理者',
		team_manager: '队伍管理员',
		user: '普通用户',
	};

	const roleOptions = [
		{ value: 'user', label: '普通用户' },
		{ value: 'team_manager', label: '队伍管理员' },
		{ value: 'tournament_manager', label: '赛事管理者' },
		{ value: 'admin', label: '系统管理员' },
	];

	function search() {
		goto(`/admin/users?q=${encodeURIComponent(q.trim())}&page=1`, { invalidateAll: true });
	}

	function fmtDate(d?: string): string {
		if (!d) return '—';
		const dt = new Date(d);
		if (Number.isNaN(dt.getTime())) return '—';
		return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
	}

	async function toggleBan(u: any) {
		try {
			await api.post(`/admin/users/${u.id}/ban`, { banned: !u.banned });
			u.banned = !u.banned;
			success(u.banned ? `已封禁 ${u.username}` : `已解封 ${u.username}`);
		} catch (e: any) {
			error(e.message || '操作失败');
		}
	}

	async function changeRole(u: any, role: string) {
		try {
			await api.post(`/admin/users/${u.id}/role`, { role });
			u.role = role;
			success(`已将 ${u.username} 设为${roleLabels[role] ?? role}`);
		} catch (e: any) {
			error(e.message || '操作失败');
		}
	}
</script>

<div class="animate-enter">
	<PanelHeader title="用户管理" watermark="Users" meta={`${total} 位用户`} />

	<!-- 搜索 -->
	<div class="relative max-w-md mt-4 mb-6">
		<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" aria-hidden="true" />
		<Input
			bind:value={q}
			placeholder="搜索用户名 / 昵称…"
			class="pl-10"
			onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && search()}
			aria-label="搜索用户"
		/>
	</div>

	{#if users.length === 0}
		<div class="border border-black bg-white text-center py-16">
			<p class="text-sm font-bold text-neutral-400">暂无用户</p>
		</div>
	{:else}
		<div class="border border-black bg-white overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="bg-black text-white">
					<tr>
						<th class="text-left px-4 py-3 font-bold">用户</th>
						<th class="text-left px-4 py-3 font-bold hidden md:table-cell">注册时间</th>
						<th class="text-left px-4 py-3 font-bold w-40">角色</th>
						<th class="text-left px-4 py-3 font-bold w-28">状态</th>
						<th class="text-left px-4 py-3 font-bold w-24">操作</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-black/10">
					{#each users as u (u.id)}
						<tr class="hover:bg-neutral-50 transition-colors duration-150">
							<td class="px-4 py-3">
								<div class="flex items-center gap-3 min-w-0">
									{#if u.avatarUrl}
										<img src={u.avatarUrl} alt="" class="w-8 h-8 object-cover border border-black shrink-0" />
									{:else}
										<span class="w-8 h-8 flex items-center justify-center bg-black text-white text-xs font-black shrink-0">
											{(u.displayName ?? u.username).slice(0, 1).toUpperCase()}
										</span>
									{/if}
									<div class="min-w-0">
										<div class="font-black truncate">{u.displayName ?? u.username}</div>
										<div class="text-xs text-neutral-500 font-bold">@{u.username}</div>
									</div>
								</div>
							</td>
							<td class="px-4 py-3 text-xs font-bold text-neutral-500 tabular-nums hidden md:table-cell">{fmtDate(u.createdAt)}</td>
							<td class="px-4 py-3">
								<Select
									value={u.role}
									options={roleOptions}
									onchange={(e: Event) => changeRole(u, (e.target as HTMLSelectElement).value)}
									class="w-36 text-xs px-2 py-1.5"
								/>
							</td>
							<td class="px-4 py-3">
								<span class="text-xs font-black px-1.5 py-0.5 {u.banned ? 'bg-accent text-white' : 'bg-black text-white'}">
									{u.banned ? '已封禁' : '正常'}
								</span>
							</td>
							<td class="px-4 py-3">
								<button
									onclick={() => toggleBan(u)}
									disabled={u.role === 'admin'}
									class="inline-flex items-center gap-1 text-xs font-bold border border-black px-2 py-1 hover:bg-black hover:text-white transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
								>
									{#if u.banned}
										<RotateCcw size={12} class="shrink-0" aria-hidden="true" />
										解封
									{:else}
										<Ban size={12} class="shrink-0" aria-hidden="true" />
										封禁
									{/if}
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
