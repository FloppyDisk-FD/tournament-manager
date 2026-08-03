<script lang="ts">
	import { api } from '$lib/api/client';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import BackLink from '$lib/components/BackLink.svelte';
	import Input from '$lib/components/Input.svelte';
	import Label from '$lib/components/Label.svelte';
	import Select from '$lib/components/Select.svelte';
	import { TOURNAMENT_TEMPLATES, type TournamentTemplate } from '$lib/constants/tournament';
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
	let liveUrl = $state('');
	let entryFee = $state(0);
	let loading = $state(false);
	let selectedTemplate = $state<string | null>(null);

	const formats = [
		{ value: 'single_elim', label: '单败淘汰' },
		{ value: 'double_elim', label: '双败淘汰' },
		{ value: 'round_robin', label: '循环联赛' },
		{ value: 'swiss', label: '瑞士轮' },
	];

	/** 点击模板：填充表单（仍可修改后再创建） */
	function applyTemplate(tpl: TournamentTemplate) {
		name = tpl.name;
		format = tpl.format;
		maxTeams = tpl.maxTeams;
		entryFee = tpl.entryFee ?? 0;
		teamSize = tpl.teamSize;
		boCount = tpl.boCount;
		thirdPlace = tpl.thirdPlace;
		selectedTemplate = tpl.id;
	}

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
				live_url: liveUrl || undefined,
				entry_fee: entryFee,
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
		<BackLink href="/admin/tournaments">← 返回赛事列表</BackLink>
	</div>
	<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black mb-6">创建赛事</h1>

	<!-- 快速模板 -->
	<div class="mb-6">
		<div class="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">快速模板</div>
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-0 border-l border-t border-black">
			{#each TOURNAMENT_TEMPLATES as tpl}
				<button
					type="button"
					onclick={() => applyTemplate(tpl)}
					class="border-r border-b border-black p-3 text-left press transition-colors duration-150 {selectedTemplate === tpl.id
						? 'bg-black text-white'
						: 'bg-white hover:bg-neutral-50'}"
				>
					<div class="font-bold text-sm">{tpl.name}</div>
					<div class="text-xs mt-0.5 {selectedTemplate === tpl.id ? 'text-white/70' : 'text-neutral-500'}">{tpl.description}</div>
				</button>
			{/each}
		</div>
		<p class="text-xs text-neutral-400 mt-2">点击模板自动填充下方表单，可修改后创建。</p>
	</div>

	<div class="max-w-lg space-y-4">
		<div>
			<Label for="name">赛事名称 *</Label>
			<Input id="name" type="text" bind:value={name} />
		</div>
		<div>
			<Label for="game">游戏</Label>
			<Input id="game" type="text" bind:value={game} />
		</div>
		<div>
			<Label for="format">赛制</Label>
			<Select id="format" bind:value={format} options={formats} />
		</div>
		<div class="grid grid-cols-3 gap-0 border-l border-t border-black">
			<div class="border-r border-b border-black p-3">
				<Label for="maxTeams">最大队伍数</Label>
				<Input id="maxTeams" type="number" bind:value={maxTeams} min="2" />
			</div>
			<div class="border-r border-b border-black p-3">
				<Label for="teamSize">每队人数</Label>
				<Input id="teamSize" type="number" bind:value={teamSize} min="1" />
			</div>
			<div class="border-r border-b border-black p-3">
				<Label for="boCount">BO 局数</Label>
				<Input id="boCount" type="number" bind:value={boCount} min="1" max="7" />
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
			<Label for="coverImage">Banner 图片 URL（可选）</Label>
			<Input id="coverImage" type="url" bind:value={coverImage} placeholder="https://..." />
			{#if coverImage}
				<div class="mt-2 border border-black overflow-hidden">
					<img src={coverImage} alt="banner preview" class="w-full h-32 object-cover" />
				</div>
			{/if}
		</div>
		<div>
			<Label for="entryFee">报名费（元，0 = 免费）</Label>
			<Input id="entryFee" type="number" bind:value={entryFee} min="0" />
			<p class="text-xs text-neutral-500 mt-1 font-bold">报名时生成支付订单，支付成功后才可审核通过</p>
		</div>
		<div>
			<Label for="liveUrl">直播地址（可选）</Label>
			<Input id="liveUrl" type="url" bind:value={liveUrl} placeholder="https://live.bilibili.com/... 或 YouTube/Twitch 链接" />
			<p class="text-xs text-neutral-500 mt-1 font-bold">支持 YouTube / Twitch 页内嵌入；B 站等受限平台将显示为外链按钮</p>
		</div>
		<Button onclick={createTournament} disabled={loading || !name} en="Create Tournament" class="px-6">
			{loading ? '创建中...' : '创建赛事 →'}
		</Button>
	</div>
</div>
