<script lang="ts">
	import { api } from '$lib/api/client';
	import { success, error as toastError } from '$lib/stores/toast.svelte';

	let open = $state(false);
	let content = $state('');
	let category = $state('general');
	let submitting = $state(false);

	const CATEGORIES = [
		{ value: 'general', label: '一般反馈' },
		{ value: 'bug', label: '问题报告' },
		{ value: 'feature', label: '功能建议' },
	];

	async function submit() {
		if (!content.trim()) { toastError('请填写反馈内容'); return; }
		submitting = true;
		try {
			await api.post('/monitor/feedback', {
				content: content.trim(),
				category,
				url: typeof window !== 'undefined' ? window.location.href : '',
			});
			success('感谢你的反馈！');
			open = false;
			content = '';
			category = 'general';
		} catch (e: any) {
			toastError(e.message || '提交失败');
		} finally {
			submitting = false;
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="用户反馈">
		<div class="w-full max-w-md border-2 border-black bg-white">
			<div class="flex items-center justify-between px-4 py-2.5 bg-black text-white">
				<span class="text-xs font-black uppercase tracking-widest text-white/70">Feedback</span>
				<button type="button" onclick={() => (open = false)} class="p-1.5 text-white/60 hover:text-white transition-colors duration-150" aria-label="关闭">×</button>
			</div>
			<div class="p-4 space-y-3">
				<div>
					<label for="fbCategory" class="block text-sm font-bold text-black mb-1">类型</label>
					<select id="fbCategory" bind:value={category} class="w-full border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none">
						{#each CATEGORIES as c}
							<option value={c.value}>{c.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="fbContent" class="block text-sm font-bold text-black mb-1">内容 *</label>
					<textarea id="fbContent" bind:value={content} rows="4" placeholder="告诉我们你的想法、遇到的问题或功能建议"
						class="w-full border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none"></textarea>
				</div>
				<div class="flex items-center gap-2">
					<button type="button" onclick={submit} disabled={submitting}
						class="border-2 border-black px-4 py-2 text-sm font-black bg-black text-white hover:bg-accent hover:border-accent transition-colors duration-150 disabled:opacity-50">
						{submitting ? '提交中...' : '提交反馈'}
					</button>
					<button type="button" onclick={() => (open = false)} class="px-4 py-2 text-sm font-bold hover:bg-neutral-100 transition-colors duration-150">取消</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<button type="button" onclick={() => (open = true)} class="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-accent transition-colors duration-150">
	<span aria-hidden="true">💬</span> 反馈
</button>
