<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	const STORAGE_KEY = 'tournix-cookie-consent';
	let visible = $state(false);

	onMount(() => {
		if (!browser) return;
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved !== 'accepted' && saved !== 'rejected') {
			// 延迟显示，避免干扰首屏
			setTimeout(() => (visible = true), 800);
		}
	});

	function accept() {
		if (browser) localStorage.setItem(STORAGE_KEY, 'accepted');
		visible = false;
	}

	function reject() {
		if (browser) localStorage.setItem(STORAGE_KEY, 'rejected');
		visible = false;
	}
</script>

{#if visible}
	<div
		class="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-black bg-white p-4"
		role="dialog"
		aria-label="Cookie 设置"
	>
		<div class="max-w-3xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-3">
			<div class="flex-1 min-w-0">
				<div class="font-black text-sm tracking-tight">Cookie 设置</div>
				<p class="text-xs text-neutral-600 mt-0.5">
					我们使用 Cookie 保持登录状态与界面偏好。继续使用即表示你同意我们使用必要的 Cookie。
					<a href="/privacy" class="font-bold text-accent underline underline-offset-2">隐私政策</a>
				</p>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<button
					type="button"
					onclick={reject}
					class="border border-black px-3 py-1.5 text-sm font-bold bg-white text-black hover:bg-neutral-100 transition-colors duration-150"
				>仅必要</button>
				<button
					type="button"
					onclick={accept}
					class="border-2 border-black px-3 py-1.5 text-sm font-black bg-black text-white hover:bg-accent hover:border-accent transition-colors duration-150"
				>全部接受</button>
			</div>
		</div>
	</div>
{/if}
