<script lang="ts">
	import { api } from '$lib/api/client';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import { success, error } from '$lib/stores/toast.svelte';

	let name = $state('');
	let game = $state('');
	let format = $state('single_elim');
	let maxTeams = $state(8);
	let teamSize = $state(5);
	let boCount = $state(3);
	let thirdPlace = $state(false);
	let description = $state('');
	let coverImage = $state('');
	let loading = $state(false);

	const formats = [
		{ value: 'single_elim', label: '单败淘汰' },
		{ value: 'double_elim', label: '双败淘汰' },
		{ value: 'round_robin', label: '循环联赛' },
		{ value: 'swiss', label: '瑞士轮' },
	];

	async function createTournament() {
		loading = true;
		try {
			const tournament = await api.post<any>('/tournaments', {
				name,
				game,
				format,
				max_teams: maxTeams,
				team_size: teamSize,
				bo_count: boCount,
				third_place: thirdPlace,
				description,
				cover_image: coverImage || undefined,
			});
			success('赛事创建成功');
			goto(`/admin/tournaments/${tournament.id}`);
		} catch (e: any) {
			error(e.message || '创建失败');
		} finally {
			loading = false;
		}
	}
</script>

<div>
	<div class="mb-6">
		<a href="/admin/tournaments" class="text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">← 返回赛事列表</a>
	</div>
	<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black mb-6">创建赛事</h1>

	<div class="max-w-lg space-y-4">
		<div>
			<label class="block text-sm font-bold text-black mb-1">赛事名称 *</label>
			<input type="text" bind:value={name}
				class="w-full border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent" />
		</div>
		<div>
			<label class="block text-sm font-bold text-black mb-1">游戏</label>
			<input type="text" bind:value={game}
				class="w-full border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent" />
		</div>
		<div>
			<label class="block text-sm font-bold text-black mb-1">赛制</label>
			<select bind:value={format}
				class="w-full border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent">
				{#each formats as f}
					<option value={f.value}>{f.label}</option>
				{/each}
			</select>
		</div>
		<div class="grid grid-cols-3 gap-0 border-l border-t border-black">
			<div class="border-r border-b border-black p-3">
				<label class="block text-sm font-bold text-black mb-1">最大队伍数</label>
				<input type="number" bind:value={maxTeams} min="2"
					class="w-full border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent" />
			</div>
			<div class="border-r border-b border-black p-3">
				<label class="block text-sm font-bold text-black mb-1">每队人数</label>
				<input type="number" bind:value={teamSize} min="1"
					class="w-full border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent" />
			</div>
			<div class="border-r border-b border-black p-3">
				<label class="block text-sm font-bold text-black mb-1">BO 局数</label>
				<input type="number" bind:value={boCount} min="1" max="7"
					class="w-full border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent" />
			</div>
		</div>
		<div class="flex items-center gap-2">
			<input type="checkbox" bind:checked={thirdPlace} id="thirdPlace"
				class="border border-black" />
			<label for="thirdPlace" class="text-sm font-bold">启用三四名决赛</label>
		</div>
		<div>
			<label class="block text-sm font-bold text-black mb-1">描述</label>
			<textarea bind:value={description} rows="3"
				class="w-full border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent"></textarea>
		</div>
		<div>
			<label class="block text-sm font-bold text-black mb-1">Banner 图片 URL（可选）</label>
			<input type="url" bind:value={coverImage} placeholder="https://..."
				class="w-full border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent" />
			{#if coverImage}
				<div class="mt-2 border border-black overflow-hidden">
					<img src={coverImage} alt="banner preview" class="w-full h-32 object-cover" />
				</div>
			{/if}
		</div>
		<Button onclick={createTournament} disabled={loading || !name} en="Create Tournament" class="px-6">
			{loading ? '创建中...' : '创建赛事 →'}
		</Button>
	</div>
</div>
