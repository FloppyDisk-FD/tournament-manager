<script lang="ts">
	import { api } from '$lib/api/client';
	import { ArrowRight, Check, Circle, QrCode, Image as ImageIcon, Video as VideoIcon, Ticket as TicketIcon, Handshake as HandshakeIcon, ClipboardList as ClipboardListIcon, ScrollText as ScrollTextIcon } from 'lucide-svelte';
	import QRCode from 'qrcode';
	import Button from '$lib/components/Button.svelte';
	import BackLink from '$lib/components/BackLink.svelte';
	import Input from '$lib/components/Input.svelte';
	import Label from '$lib/components/Label.svelte';
	import Select from '$lib/components/Select.svelte';
	import SeedRankingPanel from '$lib/components/SeedRankingPanel.svelte';
	import { FORMAT_MAP, TOURNAMENT_STATUS_MAP, REGISTRATION_STATUS_MAP } from '$lib/constants/tournament';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PanelHeader from '$lib/components/PanelHeader.svelte';
	import { success, error } from '$lib/stores/toast.svelte';

	let { data } = $props();
	let generating = $state(false);
	let bannerOpen = $state(false);
	let settingsCard = $state<HTMLDivElement>();
	let bannerUrl = $state(data.tournament?.coverImage ?? data.tournament?.cover_image ?? '');

	// 报名审核
	let registrations = $state<any[]>([]);
	let regLoaded = $state(false);
	let reviewing = $state<string | null>(null);

	// 签到管理
	let checkins = $state<any>({ teams: [], stats: { total: 0, checked: 0 } });
	const checkinMeta = $derived(`${checkins.stats.checked}/${checkins.stats.total}`);
	let checkinLoaded = $state(false);
	let checkinToggling = $state<string | null>(null);

	async function loadCheckins() {
		try {
			const res = await api.get<any>(`/tournaments/${data.tournament.id}/checkins`);
			checkins = res ?? { teams: [], stats: { total: 0, checked: 0 } };
			checkinLoaded = true;
		} catch { /* ignore */ }
	}

	async function toggleCheckin(teamId: string) {
		checkinToggling = teamId;
		try {
			await api.post(`/tournaments/${data.tournament.id}/checkins/team/${teamId}`);
			await loadCheckins();
		} catch (e: any) {
			error(e.message);
		} finally {
			checkinToggling = null;
		}
	}

	$effect(() => {
		if (data.tournament && !checkinLoaded) loadCheckins();
	});

	// 签到二维码（单码：所有队伍扫同一个码）
	let qrOpen = $state(false);
	let qrUrl = $state('');

	async function showQr() {
		const url = `${window.location.origin}/tournaments/${data.tournament.id}/checkin`;
		const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1 });
		qrUrl = dataUrl;
		qrOpen = true;
	}

	// 手动种子排位（面板组件化）
	let seedPanelOpen = $state(false);

	async function loadRegistrations() {
		try {
			const res = await api.get<any[]>(`/tournaments/${data.tournament.id}/registrations`);
			registrations = Array.isArray(res) ? res : [];
			regLoaded = true;
		} catch { /* ignore */ }
	}

	$effect(() => {
		if (data.tournament?.status === 'draft' && !regLoaded) loadRegistrations();
	});

	const pendingRegs = $derived(registrations.filter((r) => r.status === 'pending'));

	async function approveRegistration(rid: string) {
		reviewing = rid;
		try {
			await api.post(`/tournaments/${data.tournament.id}/registrations/${rid}/approve`);
			success('报名已通过');
			await loadRegistrations();
		} catch (e: any) {
			error(e.message);
		} finally {
			reviewing = null;
		}
	}

	async function rejectRegistration(rid: string) {
		const note = prompt('拒绝原因（可选）：');
		if (note === null) return;
		reviewing = rid;
		try {
			await api.post(`/tournaments/${data.tournament.id}/registrations/${rid}/reject`, { note });
			success('报名已拒绝');
			await loadRegistrations();
		} catch (e: any) {
			error(e.message);
		} finally {
			reviewing = null;
		}
	}


	/** 打开种子排位面板 */
	function openSeedPanel() {
		seedPanelOpen = true;
	}

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
			bannerOpen = false;
			success('Banner 已更新');
		} catch (e: any) {
			error(e.message);
		}
	}

	let livePanelOpen = $state(false);
	let liveInput = $state(data.tournament?.liveUrl ?? data.tournament?.live_url ?? '');
	const liveUrlValue = $derived(data.tournament?.liveUrl ?? data.tournament?.live_url ?? '');

	async function saveLive() {
		try {
			const updated = await api.put<any>(`/tournaments/${data.tournament.id}/live`, { live_url: liveInput });
			data.tournament = { ...data.tournament, ...updated };
			livePanelOpen = false;
			success('直播配置已保存');
		} catch (e: any) {
			error(e.message);
		}
	}

	async function clearLive() {
		liveInput = '';
		await saveLive();
	}

	// 报名费
	let feeInput = $state(data.tournament?.entryFee ?? data.tournament?.entry_fee ?? 0);
	const entryFeeValue = $derived(data.tournament?.entryFee ?? data.tournament?.entry_fee ?? 0);

	// 赞助商与 Banner 广告位
	interface SponsorItem { name: string; logoUrl: string; url: string }
	let sponsorPanelOpen = $state(false);
	let bannerInput = $state(data.tournament?.bannerUrl ?? data.tournament?.banner_url ?? '');
	const bannerUrlValue = $derived(data.tournament?.bannerUrl ?? data.tournament?.banner_url ?? '');
	let sponsorsInput = $state<SponsorItem[]>(
		(data.tournament?.sponsors ?? []).map((s: any) => ({ name: s?.name ?? '', logoUrl: s?.logoUrl ?? s?.logo_url ?? '', url: s?.url ?? '' }))
	);
	const sponsorCount = $derived(sponsorsInput.filter((s) => s.name.trim()).length);

	async function saveSponsors() {
		try {
			const updated = await api.put<any>(`/tournaments/${data.tournament.id}/sponsors`, {
				banner_url: bannerInput || null,
				sponsors: sponsorsInput.filter((s) => s.name.trim()),
			});
			data.tournament = { ...data.tournament, ...updated };
			sponsorPanelOpen = false;
			success('赞助商与 Banner 已保存');
		} catch (e: any) {
			error(e.message);
		}
	}

	async function clearSponsors() {
		bannerInput = '';
		sponsorsInput = [];
		await saveSponsors();
	}

	function addSponsor() {
		sponsorsInput = [...sponsorsInput, { name: '', logoUrl: '', url: '' }];
	}

	function removeSponsor(i: number) {
		sponsorsInput = sponsorsInput.filter((_, idx) => idx !== i);
	}
	let feePanelOpen = $state(false);
	let feeSaving = $state(false);
	async function saveFee() {
		feeSaving = true;
		try {
			const updated = await api.put<any>(`/tournaments/${data.tournament.id}/fee`, { entry_fee: feeInput });
			data.tournament = { ...data.tournament, ...updated };
			feePanelOpen = false;
			success('报名费已保存');
		} catch (e: any) {
			error(e.message);
		} finally {
			feeSaving = false;
		}
	}

	// 赛事规则
	let rulesPanelOpen = $state(false);
	let rulesSaving = $state(false);
	let rulesInput = $state(data.tournament?.rules ?? '');

	async function saveRules() {
		rulesSaving = true;
		try {
			const updated = await api.put<any>(`/tournaments/${data.tournament.id}/rules`, { rules: rulesInput });
			data.tournament = { ...data.tournament, ...updated };
			rulesPanelOpen = false;
			success('赛事规则已保存');
		} catch (e: any) {
			error(e.message || '保存失败');
		} finally {
			rulesSaving = false;
		}
	}

	// 报名表单自定义字段
	let customFields = $state<any[]>(Array.isArray(data.tournament?.customFields) ? data.tournament.customFields : []);
	let customPanelOpen = $state(false);
	let customSaving = $state(false);
	let newField = $state({ key: '', label: '', type: 'text', required: false, options: '' });
	const FIELD_TYPES: Record<string, string> = { text: '文本', number: '数字', select: '下拉选择', textarea: '多行文本' };

	function addField() {
		const label = newField.label.trim();
		if (!label) return error('请填写字段名称');
		const key = newField.key.trim() || label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
		if (!key) return error('字段标识无效');
		if (customFields.some((f) => f.key === key)) return error('字段标识已存在');
		customFields.push({
			key,
			label,
			type: newField.type,
			required: newField.required,
			options: newField.type === 'select' ? newField.options.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean) : undefined,
		});
		newField = { key: '', label: '', type: 'text', required: false, options: '' };
	}

	async function saveCustomFields() {
		customSaving = true;
		try {
			const updated = await api.put<any>(`/tournaments/${data.tournament.id}/custom-fields`, { fields: customFields });
			customFields = Array.isArray(updated?.customFields) ? updated.customFields : [];
			data.tournament = { ...data.tournament, ...updated };
			customPanelOpen = false;
			success('报名表单已保存');
		} catch (e: any) {
			error(e.message || '保存失败');
		} finally {
			customSaving = false;
		}
	}

	const t = $derived(data.tournament);
	const teams = $derived(data.teams);

	// 数据统计
	let stats = $state<any>(null);
	$effect(() => {
		if (!stats) {
			api.get<any>(`/tournaments/${data.tournament.id}/stats`)
				.then((s) => { stats = s; })
				.catch(() => { stats = null; });
		}
	});
</script>

<div>
	<div class="mb-6">
		<BackLink href="/admin/tournaments">← 返回赛事列表</BackLink>
	</div>

	<!-- Banner 预览 -->
	{#if t.coverImage ?? t.cover_image}
		<div class="relative border border-black overflow-hidden mb-6 group">
			<img src={t.coverImage ?? t.cover_image} alt={t.name} class="w-full h-40 md:h-56 object-cover" />
			{#if t.status === 'draft'}
				<button onclick={() => { bannerOpen = true; settingsCard?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
					class="absolute top-2 right-2 bg-white border border-black px-2 py-1 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-150">
					编辑 Banner
				</button>
			{/if}
		</div>
	{/if}

	<!-- 赛事设置 -->
	<div class="border border-black bg-white mb-6" bind:this={settingsCard}>
		<PanelHeader title="赛事设置" watermark="Settings">
			{#snippet right()}
				<span class="hidden md:block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Banner · 直播 · 报名费 · 赞助商 · 表单 · 规则</span>
			{/snippet}
		</PanelHeader>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-px bg-black">
			<!-- Banner -->
			<div class="bg-white {bannerOpen ? 'md:col-span-2' : ''}">
				<button onclick={() => (bannerOpen = !bannerOpen)}
					class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-neutral-50 transition-colors duration-150 text-left">
					<div class="flex items-center gap-2.5 min-w-0">
						<ImageIcon size={15} class="shrink-0" aria-hidden="true" />
						<span class="font-black text-sm tracking-tight shrink-0">Banner</span>
						{#if t.coverImage ?? t.cover_image}
							<span class="text-xs font-black bg-black text-white px-1.5 py-0.5 shrink-0">已设置</span>
						{:else}
							<span class="text-xs text-neutral-400 font-bold">未设置</span>
						{/if}
					</div>
					{#if t.status === 'draft'}
						<span class="text-xs font-bold border border-black px-2.5 py-1 bg-white hover:bg-neutral-100 transition-colors duration-150 shrink-0">
							{bannerOpen ? '收起' : (t.coverImage ?? t.cover_image) ? '编辑' : '配置'}
						</span>
					{/if}
				</button>
				{#if bannerOpen && t.status === 'draft'}
					<div class="px-4 pb-4">
						<label for="bannerUrl" class="block text-sm font-bold text-black mb-2">Banner 图片 URL</label>
						<div class="flex gap-0">
							<Input id="bannerUrl" type="url" bind:value={bannerUrl} placeholder="https://..." class="flex-1" />
							<Button onclick={saveBanner} en="Save" class="px-4">保存</Button>
							<button onclick={() => { bannerOpen = false; bannerUrl = t.coverImage ?? t.cover_image ?? ''; }}
								class="border border-l-0 border-black bg-white text-black font-bold px-4 py-2 text-sm hover:bg-neutral-100 transition-colors duration-150">取消</button>
						</div>
						{#if bannerUrl}
							<div class="mt-2 border border-black overflow-hidden">
								<img src={bannerUrl} alt="preview" class="w-full h-32 object-cover" />
							</div>
						{/if}
					</div>
				{/if}
			</div>
			<!-- 直播 -->
			<div class="bg-white {livePanelOpen ? 'md:col-span-2' : ''}">
				<button onclick={() => (livePanelOpen = !livePanelOpen)}
					class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-neutral-50 transition-colors duration-150 text-left">
					<div class="flex items-center gap-2.5 min-w-0">
						<VideoIcon size={15} class="shrink-0" aria-hidden="true" />
						<span class="font-black text-sm tracking-tight shrink-0">直播嵌入</span>
						{#if liveUrlValue}
							<span class="text-xs text-neutral-400 font-bold truncate">{liveUrlValue}</span>
						{:else}
							<span class="text-xs text-neutral-400 font-bold">未配置</span>
						{/if}
					</div>
					<span class="text-xs font-bold border border-black px-2.5 py-1 bg-white hover:bg-neutral-100 transition-colors duration-150 shrink-0">
						{livePanelOpen ? '收起' : liveUrlValue ? '编辑' : '+ 配置'}
					</span>
				</button>
				{#if livePanelOpen}
					<div class="px-4 pb-4">
						<Input type="url" bind:value={liveInput} placeholder="https://live.bilibili.com/... 或 YouTube/Twitch 链接" />
						<p class="text-xs text-neutral-500 mt-1 font-bold">支持 YouTube / Twitch 页内嵌入；B 站等受限平台将显示为外链按钮</p>
						<div class="mt-3 flex gap-2">
							<Button onclick={saveLive} en="Save" class="px-4">保存</Button>
							{#if liveUrlValue}
								<button onclick={clearLive} class="border border-black bg-white text-accent font-bold px-3 py-2 text-sm hover:bg-neutral-100">移除直播</button>
							{/if}
						</div>
					</div>
				{/if}
			</div>
			<!-- 报名费 -->
			<div class="bg-white {feePanelOpen ? 'md:col-span-2' : ''}">
				<button onclick={() => (feePanelOpen = !feePanelOpen)}
					class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-neutral-50 transition-colors duration-150 text-left">
					<div class="flex items-center gap-2.5 min-w-0">
						<TicketIcon size={15} class="shrink-0" aria-hidden="true" />
						<span class="font-black text-sm tracking-tight shrink-0">报名费</span>
						{#if entryFeeValue > 0}
							<span class="text-xs font-black bg-black text-white px-1.5 py-0.5 shrink-0">¥{entryFeeValue}</span>
						{:else}
							<span class="text-xs text-neutral-400 font-bold">免费</span>
						{/if}
					</div>
					{#if t.status === 'draft'}
						<span class="text-xs font-bold border border-black px-2.5 py-1 bg-white hover:bg-neutral-100 transition-colors duration-150 shrink-0">
							{feePanelOpen ? '收起' : entryFeeValue > 0 ? '修改' : '+ 设置'}
						</span>
					{:else}
						<span class="text-[10px] font-bold text-neutral-400 uppercase tracking-wider shrink-0">已锁定</span>
					{/if}
				</button>
				{#if feePanelOpen && t.status === 'draft'}
					<div class="px-4 pb-4">
						<Input type="number" bind:value={feeInput} min="0" />
						<p class="text-xs text-neutral-500 mt-1 font-bold">元为单位，0 = 免费。报名时自动生成支付订单，支付成功后才可审核通过；赛事开始后不可修改。</p>
						<div class="mt-3 flex gap-2">
							<Button onclick={saveFee} disabled={feeSaving} en="Save" class="px-4">{feeSaving ? '保存中...' : '保存'}</Button>
						</div>
					</div>
				{/if}
			</div>
			<!-- 赞助商与 Banner 广告位 -->
			<div class="bg-white {sponsorPanelOpen ? 'md:col-span-2' : ''}">
				<button onclick={() => (sponsorPanelOpen = !sponsorPanelOpen)}
					class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-neutral-50 transition-colors duration-150 text-left">
					<div class="flex items-center gap-2.5 min-w-0">
						<HandshakeIcon size={15} class="shrink-0" aria-hidden="true" />
						<span class="font-black text-sm tracking-tight shrink-0">赞助商与 Banner 广告位</span>
						{#if bannerUrlValue || sponsorCount > 0}
							<span class="text-xs font-black bg-black text-white px-1.5 py-0.5 shrink-0">{sponsorCount} 家赞助商</span>
						{:else}
							<span class="text-xs text-neutral-400 font-bold">未配置</span>
						{/if}
					</div>
					<span class="text-xs font-bold border border-black px-2.5 py-1 bg-white hover:bg-neutral-100 transition-colors duration-150 shrink-0">
						{sponsorPanelOpen ? '收起' : bannerUrlValue || sponsorCount > 0 ? '编辑' : '+ 配置'}
					</span>
				</button>
				{#if sponsorPanelOpen}
					<div class="px-4 pb-4 space-y-4">
						<div>
							<label for="bannerInput" class="block text-sm font-bold text-black mb-2">Banner 广告位图片 URL</label>
							<Input id="bannerInput" type="url" bind:value={bannerInput} placeholder="https://... 赛事页顶部展示的横幅图" />
							{#if bannerInput}
								<div class="mt-2 border border-black overflow-hidden">
									<img src={bannerInput} alt="banner preview" class="w-full h-28 object-cover" />
								</div>
							{/if}
						</div>
						<div>
							<div class="flex items-center justify-between mb-2">
								<label class="block text-sm font-bold text-black">赞助商 Logo 墙</label>
								<button onclick={addSponsor}
									class="text-xs font-bold border border-black px-2.5 py-1 bg-white hover:bg-neutral-100 transition-colors duration-150">
									+ 添加赞助商
								</button>
							</div>
							{#if sponsorsInput.length === 0}
								<p class="text-xs text-neutral-400 font-bold py-2">暂无赞助商，点击右上角添加</p>
							{:else}
								<div class="space-y-2">
									{#each sponsorsInput as s, i}
										<div class="border border-black p-2.5 flex flex-col md:flex-row gap-2">
											<Input type="text" bind:value={s.name} placeholder="赞助商名称" class="flex-1" />
											<Input type="url" bind:value={s.logoUrl} placeholder="Logo 图片 URL" class="flex-1" />
											<Input type="url" bind:value={s.url} placeholder="官网链接（可选）" class="flex-1" />
											<button onclick={() => removeSponsor(i)}
												class="border border-black bg-white text-accent font-bold px-3 py-2 text-sm hover:bg-neutral-100 shrink-0">
												删除
											</button>
										</div>
									{/each}
								</div>
							{/if}
						</div>
						<div class="flex gap-2 pt-1">
							<Button onclick={saveSponsors} en="Save" class="px-4">保存</Button>
							{#if bannerUrlValue || sponsorCount > 0}
								<button onclick={clearSponsors} class="border border-black bg-white text-accent font-bold px-3 py-2 text-sm hover:bg-neutral-100">清空</button>
							{/if}
						</div>
					</div>
				{/if}
			</div>
			<!-- 报名表单 -->
			<div class="bg-white {customPanelOpen ? 'md:col-span-2' : ''}">
				<button onclick={() => (customPanelOpen = !customPanelOpen)}
					class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-neutral-50 transition-colors duration-150 text-left">
					<div class="flex items-center gap-2.5 min-w-0">
						<ClipboardListIcon size={15} class="shrink-0" aria-hidden="true" />
						<span class="font-black text-sm tracking-tight shrink-0">报名表单</span>
						{#if customFields.length > 0}
							<span class="text-xs font-black bg-black text-white px-1.5 py-0.5 shrink-0">{customFields.length} 个字段</span>
						{:else}
							<span class="text-xs text-neutral-400 font-bold">默认表单</span>
						{/if}
					</div>
					{#if t.status === 'draft'}
						<span class="text-xs font-bold border border-black px-2.5 py-1 bg-white hover:bg-neutral-100 transition-colors duration-150 shrink-0">
							{customPanelOpen ? '收起' : customFields.length > 0 ? '编辑' : '+ 配置'}
						</span>
					{:else}
						<span class="text-[10px] font-bold text-neutral-400 uppercase tracking-wider shrink-0">已锁定</span>
					{/if}
				</button>
				{#if customPanelOpen && t.status === 'draft'}
					<div class="px-4 pb-4 space-y-3">
						{#if customFields.length > 0}
							<div class="border border-black divide-y divide-black">
								{#each customFields as f, i (f.key)}
									<div class="flex items-center justify-between gap-2 px-3 py-2">
										<div class="flex items-center gap-2 min-w-0 flex-wrap">
											<span class="font-black text-sm truncate">{f.label}</span>
											{#if f.required}<span class="text-[10px] font-black bg-accent text-white px-1">必填</span>{/if}
											<span class="text-[10px] font-bold text-neutral-400 border border-black px-1">{FIELD_TYPES[f.type] ?? f.type}</span>
											{#if f.type === 'select' && f.options?.length}
												<span class="text-[11px] text-neutral-500 font-bold truncate">选项：{f.options.join(' / ')}</span>
											{/if}
										</div>
										<button onclick={() => customFields.splice(i, 1)} aria-label={`删除字段 ${f.label}`}
											class="text-accent text-xs font-bold border border-black px-1.5 py-0.5 bg-white hover:bg-neutral-100 shrink-0">删除</button>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-neutral-500 font-bold">尚未配置自定义字段。可添加联系方式、游戏ID、段位等，报名时选手需填写。</p>
						{/if}
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
							<div>
								<Label for="cfLabel">字段名称</Label>
								<Input id="cfLabel" bind:value={newField.label} placeholder="如：QQ号" />
							</div>
							<div>
								<Label for="cfType">类型</Label>
								<Select id="cfType" bind:value={newField.type} options={[{ value: 'text', label: '文本' }, { value: 'number', label: '数字' }, { value: 'select', label: '下拉选择' }, { value: 'textarea', label: '多行文本' }]} />
							</div>
							<div>
								<Label for="cfOptions">选项（逗号分隔）</Label>
								<Input id="cfOptions" bind:value={newField.options} placeholder="青铜/白银/黄金" disabled={newField.type !== 'select'} />
							</div>
							<div class="flex items-center gap-3 pb-1">
								<label class="flex items-center gap-1.5 text-sm font-bold cursor-pointer select-none">
									<input type="checkbox" bind:checked={newField.required} class="accent-black" /> 必填
								</label>
								<button onclick={addField}
									class="border border-black bg-black text-white px-3 py-2 text-sm font-bold hover:opacity-80 transition-opacity duration-150">+ 添加字段</button>
							</div>
						</div>
						<div class="flex gap-2 pt-1">
							<Button onclick={saveCustomFields} disabled={customSaving} en="Save" class="px-4">{customSaving ? '保存中...' : '保存表单'}</Button>
						</div>
					</div>
				{/if}
			</div>
			<!-- 赛事规则 -->
			<div class="bg-white {rulesPanelOpen ? 'md:col-span-2' : ''}">
				<button onclick={() => (rulesPanelOpen = !rulesPanelOpen)}
					class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-neutral-50 transition-colors duration-150 text-left">
					<div class="flex items-center gap-2.5 min-w-0">
						<ScrollTextIcon size={15} class="shrink-0" aria-hidden="true" />
						<span class="font-black text-sm tracking-tight shrink-0">赛事规则</span>
						<span class="text-[10px] font-bold text-neutral-400 border border-black px-1 shrink-0">Markdown</span>
						{#if t.rules}
							<span class="text-xs font-black bg-black text-white px-1.5 py-0.5 shrink-0">已添加</span>
						{:else}
							<span class="text-xs text-neutral-400 font-bold">未添加</span>
						{/if}
					</div>
					<span class="text-xs font-bold border border-black px-2.5 py-1 bg-white hover:bg-neutral-100 transition-colors duration-150 shrink-0">
						{rulesPanelOpen ? '收起' : t.rules ? '编辑' : '+ 添加'}
					</span>
				</button>
				{#if rulesPanelOpen}
					<div class="px-4 pb-4 space-y-3">
						{#if !t.rules}
							<p class="text-sm text-neutral-400 font-bold">尚未添加规则，公开页不显示规则区块。</p>
						{/if}
						<textarea id="rulesInput" bind:value={rulesInput} rows="10"
							class="w-full rounded-none border border-black font-mono px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent"
							placeholder="支持 Markdown：## 标题、- 列表、**加粗**、[链接](url)&#10;&#10;## 赛制&#10;- 单败淘汰 BO3，每队 5 人&#10;&#10;## 奖品&#10;- 冠军：¥500 + 奖杯&#10;&#10;## 联系方式&#10;- QQ 群：123456&#10;- 邮箱：contact@example.com"></textarea>
						<div class="flex items-center gap-3">
							<Button onclick={saveRules} disabled={rulesSaving} en="Save" class="px-4">{rulesSaving ? '保存中...' : '保存规则'}</Button>
							<span class="text-xs text-neutral-400 font-bold">保存后公开页立即展示</span>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

		<div class="border border-black bg-white mb-6">
			<PanelHeader title="数据统计与导出" watermark="Stats" />
			<div class="p-4">
				{#if stats}
					<div class="grid grid-cols-2 md:grid-cols-4 gap-0 border-l border-t border-black mb-4">
						<div class="border-r border-b border-black p-3">
							<div class="text-xs text-neutral-500 font-bold">报名</div>
							<div class="text-xl font-black">{stats.registrations.total}</div>
							<div class="text-[11px] text-neutral-400 font-bold">通过 {stats.registrations.approved} · 待审 {stats.registrations.pending} · 拒绝 {stats.registrations.rejected}</div>
						</div>
						<div class="border-r border-b border-black p-3">
							<div class="text-xs text-neutral-500 font-bold">签到</div>
							<div class="text-xl font-black">{stats.teams.checkedIn}<span class="text-sm text-neutral-400 font-bold">/{stats.teams.total}</span></div>
							<div class="text-[11px] text-neutral-400 font-bold">已到 / 参赛队伍</div>
						</div>
						<div class="border-r border-b border-black p-3">
							<div class="text-xs text-neutral-500 font-bold">比赛</div>
							<div class="text-xl font-black">{stats.matches.completed}<span class="text-sm text-neutral-400 font-bold">/{stats.matches.total}</span></div>
							<div class="text-[11px] text-neutral-400 font-bold">已结束 / 全部</div>
						</div>
						<div class="border-r border-b border-black p-3">
							<div class="text-xs text-neutral-500 font-bold">收款</div>
							<div class="text-xl font-black">¥{stats.payments.amount}</div>
							<div class="text-[11px] text-neutral-400 font-bold">{stats.payments.paid} 笔已支付</div>
						</div>
					</div>
					<div class="flex flex-wrap gap-2">
						<a href={`/api/v1/tournaments/${data.tournament.id}/export/registrations.csv`}
							class="border border-black bg-black text-white font-bold px-3 py-2 text-sm hover:bg-neutral-800 transition-colors duration-150">导出报名名单</a>
						<a href={`/api/v1/tournaments/${data.tournament.id}/export/bracket.csv`}
							class="border border-black bg-black text-white font-bold px-3 py-2 text-sm hover:bg-neutral-800 transition-colors duration-150">导出赛程</a>
						<a href={`/api/v1/tournaments/${data.tournament.id}/export/standings.csv`}
							class="border border-black bg-black text-white font-bold px-3 py-2 text-sm hover:bg-neutral-800 transition-colors duration-150">导出积分榜</a>
					</div>
				{:else}
					<div class="text-xs text-neutral-400 font-bold">统计加载中...</div>
				{/if}
			</div>
		</div>

	<div class="flex items-start justify-between mb-6">
		<div>
			<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">{t.name}</h1>
			<p class="text-sm text-neutral-600 mt-1">{t.game} · {FORMAT_MAP[t.format] ?? t.format} · {TOURNAMENT_STATUS_MAP[t.status]?.label ?? t.status}</p>
		</div>
		<div class="flex gap-2">
			{#if t.status === 'draft'}
				{#if teams.length >= 2}
					<button
						onclick={openSeedPanel}
						class="border border-black bg-white text-black font-bold px-4 py-2 text-sm transition-colors duration-150 active:opacity-70 press"
					>
						种子排位
					</button>
				{/if}
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

	{#if seedPanelOpen}
		<SeedRankingPanel teams={teams} tournamentId={data.tournament.id} onclose={() => (seedPanelOpen = false)} />
	{/if}

	<div class="grid grid-cols-2 md:grid-cols-4 gap-0 border-l border-t border-black mb-6">
		<div class="border-r border-b border-black bg-white p-4">
			<div class="text-xs text-neutral-500 font-bold">赛制</div>
			<div class="font-black text-lg mt-1">{FORMAT_MAP[t.format] ?? t.format}</div>
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
			<div class="font-black text-lg mt-1">{TOURNAMENT_STATUS_MAP[t.status]?.label ?? t.status}</div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
		{#if t.status === 'draft'}
		<div class="border border-black bg-white">
			<PanelHeader title="报名审核" watermark="Review" badge={pendingRegs.length} />
			<div class="p-4">
				{#if registrations.length === 0}
					<p class="text-sm text-neutral-500 font-bold text-center py-2">暂无报名</p>
				{:else}
					<div class="space-y-2">
						{#each registrations as reg (reg.id)}
							<div class="border border-black bg-white grid grid-cols-1 sm:grid-cols-[1fr_auto]">
								<div class="px-3 py-2.5 border-b sm:border-b-0 sm:border-r border-black/20 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<StatusBadge status={reg.status} map={REGISTRATION_STATUS_MAP} />
										{#if reg.payment}
											{#if reg.payment.status === 'paid'}
												<span class="text-xs font-bold bg-black text-white px-1.5 py-0.5">已支付 ¥{reg.payment.amount}</span>
											{:else}
												<span class="text-xs font-bold bg-neutral-100 border border-black px-1.5 py-0.5">待支付 ¥{reg.payment.amount}</span>
											{/if}
										{/if}
										<span class="text-sm font-black truncate">{reg.teamName}</span>
									</div>
									<div class="mt-1 flex items-center gap-3 text-xs text-neutral-500 font-bold flex-wrap">
										<span>报名人：{reg.applicant?.username ?? '—'}</span>
										<span class="text-neutral-400">{reg.players?.length ?? 0} 名选手</span>
										{#if reg.status === 'rejected' && reg.note}
											<span>原因：{reg.note}</span>
										{/if}
									</div>
									{#if reg.answers && Object.keys(reg.answers).length > 0}
										<div class="mt-1 flex items-center gap-2 text-[11px] text-neutral-500 font-bold flex-wrap">
											{#each Object.entries(reg.answers) as [k, v]}
												<span class="border border-black/30 px-1 py-0.5 bg-neutral-50">{(customFields.find((f) => f.key === k)?.label ?? k)}：{v}</span>
											{/each}
										</div>
									{/if}
								</div>
								<div class="flex items-center justify-end gap-1 px-3 py-2.5">
									{#if reg.status === 'pending'}
										<button onclick={() => approveRegistration(reg.id)} disabled={reviewing === reg.id}
											class="rounded-none font-sans font-bold border border-black bg-black text-white px-3 py-1 text-xs transition-opacity duration-150 active:opacity-70 disabled:opacity-50">通过</button>
										<button onclick={() => rejectRegistration(reg.id)} disabled={reviewing === reg.id}
											class="rounded-none font-sans font-bold border border-black bg-white text-accent px-3 py-1 text-xs transition-opacity duration-150 active:opacity-70 disabled:opacity-50">拒绝</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		{/if}

		<div class="border border-black bg-white {t.status === 'draft' ? '' : 'lg:col-span-2'}">
		<PanelHeader title="签到管理" watermark="Check-in" meta={checkinMeta}>
			{#snippet right()}
				<button
					onclick={showQr}
					class="text-xs font-bold text-white/80 border-b border-white/50 hover:text-white hover:border-white transition-colors duration-150 inline-flex items-center gap-1"
					title="展示赛事签到二维码"
				>
					<QrCode size={13} class="shrink-0" aria-hidden="true" />
					签到二维码
				</button>
			{/snippet}
		</PanelHeader>
		<div class="p-4">
			{#if checkins.teams.length === 0}
				<p class="text-sm text-neutral-500 font-bold text-center py-2">暂无队伍</p>
			{:else}
				<div class="flex items-center gap-3 mb-3 text-xs font-bold text-neutral-500">
					<span class="inline-block w-2 h-2 bg-accent" aria-hidden="true"></span> 已到 {checkins.stats.checked}
					<span class="inline-block w-2 h-2 bg-neutral-300" aria-hidden="true"></span> 未到 {checkins.stats.total - checkins.stats.checked}
				</div>
				<div class="space-y-1">
					{#each checkins.teams as t (t.teamId)}
						<div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] border border-black bg-white">
							<div class="flex items-center gap-3 px-3 py-2.5 border-b sm:border-b-0 sm:border-r border-black/20 min-w-0">
								<span class="text-xs font-black tabular-nums text-neutral-500 shrink-0">{String(t.seed ?? '').padStart(2, '0')}</span>
								<span class="text-sm shrink-0 {t.checkedIn ? 'text-accent' : 'text-neutral-300'}" aria-hidden="true">
									{#if t.checkedIn}<Check size={14} class="shrink-0" />{:else}<Circle size={14} class="shrink-0" />{/if}
								</span>
								<span class="text-sm font-black truncate">{t.name}</span>
								{#if t.checkedInAt}
									<span class="text-xs text-neutral-400 font-bold shrink-0">{new Date(t.checkedInAt).toLocaleTimeString()}</span>
								{/if}
							</div>
							<div class="flex items-center justify-end px-3 py-2.5">
								<button
									onclick={() => toggleCheckin(t.teamId)}
									disabled={checkinToggling === t.teamId}
									class="rounded-none font-sans font-bold border border-black px-3 py-1 text-xs transition-colors duration-150 active:opacity-70 disabled:opacity-50 {t.checkedIn
										? 'bg-white text-accent hover:bg-neutral-100'
										: 'bg-black text-white hover:bg-neutral-800'}"
								>
									{t.checkedIn ? '取消签到' : '标记到场'}
								</button>
							</div>
						</div>
					{/each}
				</div>
				{#if qrOpen}
					<div class="border border-black bg-white p-4 text-center mt-2">
						{#if qrUrl}
							<img src={qrUrl} alt="签到二维码" class="w-44 h-44 mx-auto border border-black" />
							<p class="text-sm font-bold text-black mt-3">赛事签到二维码</p>
							<p class="text-xs text-neutral-400 font-bold mt-1">所有队伍扫码后登录，按身份匹配队伍签到</p>
							<button
								onclick={() => { qrOpen = false; qrUrl = ''; }}
								class="mt-3 rounded-none font-sans font-bold border border-black px-4 py-1.5 text-xs bg-black text-white hover:bg-neutral-800 transition-colors duration-150"
							>关闭</button>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
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
