<script lang="ts">
	import { onMount } from 'svelte';
	import { User, Monitor, KeyRound, Bell, Trash2, Upload } from 'lucide-svelte';
	import { api } from '$lib/api/client';
	import { getUser } from '$lib/stores/auth.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Label from '$lib/components/Label.svelte';
	import PanelHeader from '$lib/components/PanelHeader.svelte';
	import { cn } from '$lib/utils';
	import { success, error } from '$lib/stores/toast.svelte';
	import { goto } from '$app/navigation';

	let profile = $state<any>(null);
	let loaded = $state(false);
	let saving = $state(false);

	let avatarUrl = $state('');
	let displayName = $state('');
	let bio = $state('');

	// Tab
	type TabId = 'profile' | 'security' | 'notifications' | 'sessions';
	let activeTab = $state<TabId>('profile');
	const tabs: { id: TabId; label: string }[] = [
		{ id: 'profile', label: '资料' },
		{ id: 'security', label: '安全' },
		{ id: 'notifications', label: '通知偏好' },
		{ id: 'sessions', label: '登录设备' },
	];

	// 安全：修改密码
	let oldPassword = $state('');
	let newPassword = $state('');
	let passwordSaving = $state(false);

	// 通知偏好
	const prefOptions = [
		{ key: 'reg_result', label: '报名结果', desc: '报名通过 / 拒绝时通知' },
		{ key: 'match_start', label: '比赛开始', desc: '所报队伍的比赛开始时通知' },
		{ key: 'prediction_result', label: '竞猜结果', desc: '竞猜的比赛结束后通知' },
		{ key: 'checkin', label: '签到提醒', desc: '赛事签到开始时提醒' },
	];
	let prefs = $state<Record<string, boolean>>({});
	let prefsLoaded = $state(false);

	// 会话管理
	let sessions = $state<any[]>([]);
	let sessionsLoaded = $state(false);

	// 头像上传
	let uploading = $state(false);
	const MAX_AVATAR_BYTES = 256 * 1024;

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
		loadPrefs();
		loadSessions();
	});

	async function loadPrefs() {
		try {
			prefs = (await api.get<any>('/auth/preferences')) ?? {};
			prefsLoaded = true;
		} catch { prefsLoaded = true; }
	}

	async function loadSessions() {
		try {
			sessions = (await api.get<any[]>('/auth/sessions')) ?? [];
			sessionsLoaded = true;
		} catch { sessionsLoaded = true; }
	}

	async function save() {
		saving = true;
		try {
			await api.put('/auth/me', {
				avatar_url: avatarUrl.trim() || undefined,
				display_name: displayName.trim() || undefined,
				bio: bio.trim() || undefined,
			});
			success('个人资料已保存');
		} catch (e: any) {
			error(e.message || '保存失败');
		} finally {
			saving = false;
		}
	}

	async function changePassword() {
		if (!oldPassword || !newPassword) { error('请填写当前密码和新密码'); return; }
		if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) { error('新密码至少 8 位，且需包含字母和数字'); return; }
		passwordSaving = true;
		try {
			await api.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword });
			oldPassword = '';
			newPassword = '';
			success('密码已更新');
		} catch (e: any) {
			error(e.message || '修改失败');
		} finally {
			passwordSaving = false;
		}
	}

	async function savePrefs() {
		try {
			await api.put('/auth/preferences', prefs);
			success('通知偏好已保存');
		} catch (e: any) {
			error(e.message || '保存失败');
		}
	}

	async function revokeOthers() {
		try {
			await api.post('/auth/sessions/revoke-others');
			success('其他设备已全部登出');
			await loadSessions();
		} catch (e: any) {
			error(e.message || '操作失败');
		}
	}

	async function deleteSession(id: string) {
		try {
			await api.del(`/auth/sessions/${id}`);
			success('已登出该设备');
			await loadSessions();
		} catch (e: any) {
			error(e.message || '操作失败');
		}
	}

	async function deleteAccount() {
		if (!confirm('确定要注销账号吗？此操作不可撤销，你的数据将被永久删除。')) return;
		try {
			await api.del('/auth/account');
			await goto('/');
			setTimeout(() => window.location.reload(), 100);
		} catch (e: any) {
			error(e.message || '注销失败');
		}
	}

	function fmtTime(iso?: string): string {
		if (!iso) return '—';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '—';
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	// 头像文件上传：压缩为小尺寸 JPEG Data URL
	function onAvatarFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) { error('请选择图片文件'); return; }
		uploading = true;
		const reader = new FileReader();
		reader.onload = () => {
			const img = new Image();
			img.onload = () => {
				const MAX = 256;
				let { width, height } = img;
				if (width > MAX || height > MAX) {
					const ratio = Math.min(MAX / width, MAX / height);
					width = Math.round(width * ratio);
					height = Math.round(height * ratio);
				}
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) { uploading = false; return; }
				ctx.fillStyle = '#fff';
				ctx.fillRect(0, 0, width, height);
				ctx.drawImage(img, 0, 0, width, height);
				const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
				if (dataUrl.length > MAX_AVATAR_BYTES * 1.4) { error('图片过大，请换一张'); uploading = false; return; }
				avatarUrl = dataUrl;
				uploading = false;
			};
			img.onerror = () => { error('图片读取失败'); uploading = false; };
			img.src = reader.result as string;
		};
		reader.onerror = () => { error('文件读取失败'); uploading = false; };
		reader.readAsDataURL(file);
	}
</script>

<div class="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12 animate-enter">
	<div class="flex items-baseline justify-between mb-8 flex-wrap gap-2">
		<div>
			<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">账户设置</h1>
			<p class="text-sm text-neutral-600 mt-1">@{profile?.username ?? getUser()?.username ?? ''}</p>
		</div>
		<span class="text-xs font-bold uppercase tracking-widest text-neutral-500">Account</span>
	</div>

	{#if !getUser()}
		<div class="border border-black bg-white text-center py-16">
			<p class="text-sm text-neutral-500 font-bold mb-3">请先登录</p>
			<a href="/login" class="text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">去登录 →</a>
		</div>
	{:else if !loaded}
		<div class="skeleton h-16 w-full" aria-hidden="true"></div>
	{:else}
		<!-- Tab 切换 -->
		<div class="border-b-2 border-black mb-6">
			<div class="flex gap-0" role="tablist" aria-label="账户设置视图切换">
				{#each tabs as tab}
					<button
						role="tab"
						aria-selected={activeTab === tab.id}
						onclick={() => (activeTab = tab.id)}
						class={cn(
							'flex-1 px-2 md:px-6 py-3 text-sm font-bold border-b-2 transition-colors duration-150 press text-center whitespace-nowrap',
							activeTab === tab.id
								? 'border-accent text-black bg-neutral-50'
								: 'border-transparent text-neutral-500 hover:text-black'
						)}
					>
						{tab.label}
					</button>
				{/each}
			</div>
		</div>

		{#if activeTab === 'profile'}
			<!-- 资料编辑 -->
			<div class="border border-black bg-white">
				<PanelHeader title="资料编辑" watermark="Profile" />
				<div class="p-4 space-y-4">
					<div class="flex items-center gap-4 flex-wrap">
						{#if avatarUrl}
							<img src={avatarUrl} alt="头像" class="w-20 h-20 object-cover border border-black shrink-0" />
						{:else}
							<div class="w-20 h-20 border border-black bg-neutral-100 flex items-center justify-center shrink-0">
								<User size={32} class="text-neutral-400" aria-hidden="true" />
							</div>
						{/if}
						<div class="flex-1 min-w-[220px] space-y-2">
							<Label for="avatar">头像图片 URL 或上传</Label>
							<Input id="avatar" type="url" bind:value={avatarUrl} placeholder="https://... 或点击下方上传" />
							<label class="inline-flex items-center gap-1.5 text-sm font-bold border border-black px-3 py-1.5 bg-white hover:bg-neutral-100 transition-colors duration-150 cursor-pointer press">
								<Upload size={14} class="shrink-0" aria-hidden="true" />
								{uploading ? '处理中...' : '上传图片'}
								<input type="file" accept="image/*" class="hidden" onchange={onAvatarFile} />
							</label>
							<p class="text-xs font-bold text-neutral-400">自动压缩至 256px，图片仅存于你的头像字段</p>
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
		{:else if activeTab === 'security'}
			<!-- 安全 -->
			<div class="border border-black bg-white">
				<PanelHeader title="修改密码" watermark="Security" />
				<div class="p-4 space-y-4">
					<div>
						<Label for="oldPassword">当前密码</Label>
						<Input id="oldPassword" type="password" bind:value={oldPassword} placeholder="输入当前密码" autocomplete="current-password" />
					</div>
					<div>
						<Label for="newPassword">新密码</Label>
						<Input id="newPassword" type="password" bind:value={newPassword} placeholder="至少 8 位，含字母和数字" autocomplete="new-password" />
					</div>
					<div class="flex gap-2 pt-2">
						<Button onclick={changePassword} disabled={passwordSaving} en="Update" class="rounded-none">
							<KeyRound size={14} class="shrink-0" aria-hidden="true" />
							{passwordSaving ? '更新中...' : '更新密码'}
						</Button>
					</div>
				</div>
			</div>

			<!-- 危险区 -->
			<div class="border border-black bg-white mt-6">
				<div class="px-4 py-2 bg-black text-white flex items-center gap-2">
					<Trash2 size={14} class="shrink-0 text-accent" aria-hidden="true" />
					<span class="text-xs font-black uppercase tracking-widest text-white/70">危险区</span>
				</div>
				<div class="p-4 flex items-center justify-between gap-3 flex-wrap">
					<div>
						<div class="text-sm font-black">注销账号</div>
						<p class="text-xs text-neutral-500 font-bold mt-0.5">永久删除账号与所有关联数据，不可恢复</p>
					</div>
					<button
						onclick={deleteAccount}
						class="text-sm font-bold text-accent border border-accent px-3 py-1.5 hover:bg-accent hover:text-white transition-colors duration-150"
					>注销账号</button>
				</div>
			</div>
		{:else if activeTab === 'notifications'}
			<!-- 通知偏好 -->
			<div class="border border-black bg-white">
				<PanelHeader title="通知偏好" watermark="Alerts" />
				<div class="p-4 space-y-1">
					{#if !prefsLoaded}
						<div class="skeleton h-12 w-full" aria-hidden="true"></div>
					{:else}
						{#each prefOptions as opt}
							<label class="flex items-center justify-between gap-3 px-3 py-2.5 border border-black/10 hover:bg-neutral-50 transition-colors duration-150 cursor-pointer">
								<div>
									<div class="text-sm font-black">{opt.label}</div>
									<div class="text-xs text-neutral-500 font-bold mt-0.5">{opt.desc}</div>
								</div>
								<input
									type="checkbox"
									bind:checked={prefs[opt.key]}
									class="w-4 h-4 accent-black shrink-0"
								/>
							</label>
						{/each}
						<div class="pt-3">
							<Button onclick={savePrefs} en="Save" class="rounded-none">保存偏好</Button>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<!-- 登录设备 -->
			<div class="border border-black bg-white">
				<PanelHeader title="登录设备" watermark="Devices" />
				<div class="p-4">
					<div class="flex justify-end mb-3">
						<button onclick={revokeOthers} class="text-sm font-bold text-accent border-b border-accent hover:opacity-70 transition-opacity duration-150">
							登出其他所有设备
						</button>
					</div>
					{#if !sessionsLoaded}
						<div class="skeleton h-12 w-full" aria-hidden="true"></div>
					{:else if sessions.length === 0}
						<p class="text-sm font-bold text-neutral-400 text-center py-6">暂无登录设备记录</p>
					{:else}
						<div class="divide-y divide-black/10">
							{#each sessions as s (s.id)}
								<div class="flex items-center gap-3 py-2.5">
									<span class="w-9 h-9 border border-black bg-neutral-50 flex items-center justify-center shrink-0">
										<Monitor size={16} class="text-neutral-500" aria-hidden="true" />
									</span>
									<div class="min-w-0 flex-1">
										<div class="text-sm font-black truncate">{s.deviceName ?? '未知设备'}</div>
										<div class="text-xs text-neutral-500 font-bold mt-0.5">{s.ip ? `${s.ip} · ` : ''}登录于 {fmtTime(s.createdAt)}</div>
									</div>
									<button
										onclick={() => deleteSession(s.id)}
										class="text-xs font-bold text-neutral-500 border border-black px-2 py-1 hover:text-accent hover:border-accent transition-colors duration-150 shrink-0"
									>登出</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>
