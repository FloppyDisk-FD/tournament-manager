<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft, Home } from 'lucide-svelte';

	const status = $derived(page.status);
	const message = $derived(status === 404 ? '页面不存在' : status === 500 ? '服务器开小差了' : '出错了');
</script>

<svelte:head>
	<title>{status} — Tournix</title>
</svelte:head>

<div class="min-h-[60vh] flex items-center justify-center px-4">
	<div class="w-full max-w-md text-center">
		<div class="relative overflow-hidden bg-black text-white px-6 py-10 mb-6">
			<div class="relative z-10">
				<div class="flex items-center gap-2 mb-2 justify-center">
					<span class="inline-block w-1 h-1 bg-accent" aria-hidden="true"></span>
					<span class="text-xs font-black uppercase tracking-widest text-white/60">Error</span>
				</div>
				<div class="font-black text-6xl tracking-tight tabular-nums">{status}</div>
				<p class="text-sm font-bold text-white/70 mt-2">{message}</p>
			</div>
			<span
				class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-6xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/10"
				style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
			>404</span>
		</div>

		<div class="flex items-center justify-center gap-3">
			<a
				href="/"
				class="inline-flex items-center gap-1.5 text-sm font-black border-2 border-black px-4 py-2 bg-black text-white hover:bg-accent hover:border-accent transition-colors duration-150"
			>
				<Home size={14} class="shrink-0" aria-hidden="true" />
				返回首页
			</a>
			<a
				href="/tournaments"
				class="inline-flex items-center gap-1.5 text-sm font-bold border border-black px-4 py-2 bg-white text-black hover:bg-neutral-100 transition-colors duration-150"
			>
				<ArrowLeft size={14} class="shrink-0" aria-hidden="true" />
				浏览赛事
			</a>
		</div>
	</div>
</div>
