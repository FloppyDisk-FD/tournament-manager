<script lang="ts">
	import BackLink from '$lib/components/BackLink.svelte';

	const sections: { title: string; body: string }[] = [
		{ title: '1. 我们收集的信息', body: '当您注册账号、创建赛事、报名参赛或使用预测功能时，我们会收集必要的信息，包括：用户名、密码（加密存储）、联系方式（邮箱/QQ 等，仅在您填写时收集）、队伍与选手资料、赛事数据及您提交的报名信息。' },
		{ title: '2. 信息的使用', body: '我们使用收集的信息来：提供赛事创建与管理功能、处理报名与审核、展示比赛结果与排行榜、发送通知（站内信与浏览器推送）、改进产品体验。' },
		{ title: '3. 信息的共享', body: '我们不会出售您的个人信息。仅在以下情况共享：支付处理（向支付服务商提供必要信息）、法律要求、您主动公开的内容（如队伍资料、比赛结果）。' },
		{ title: '4. 数据的存储与安全', body: '您的数据存储于加密的数据库中，密码使用哈希算法存储。我们会采取合理的技术措施保护您的数据安全，但无法保证绝对安全。' },
		{ title: '5. 您的权利', body: '您可以随时查看、修改您的个人资料，或联系我们删除您的账号与数据。已发布的赛事与比赛结果在赛事结束后作为公开记录保留。' },
		{ title: '6. Cookie 与本地存储', body: '我们使用 Cookie 保持登录状态，使用浏览器本地存储保存界面偏好。您可以通过浏览器设置拒绝 Cookie，但可能影响登录功能。' },
		{ title: '7. 联系我们', body: '如对本隐私政策有任何疑问，请通过 support@tournix.app 联系我们。' },
	];
</script>

<svelte:head>
	<title>隐私政策 — Tournix</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 md:px-8 py-8">
	<div class="mb-6">
		<BackLink href="/">返回首页</BackLink>
	</div>

	<!-- 标题栏 -->
	<div class="relative overflow-hidden bg-black text-white px-4 py-5 mb-8">
		<div class="relative z-10">
			<div class="flex items-center gap-2 mb-1">
				<span class="inline-block w-1 h-1 bg-accent" aria-hidden="true"></span>
				<span class="text-xs font-black uppercase tracking-widest text-white/60">Privacy</span>
			</div>
			<h1 class="font-black text-2xl md:text-3xl tracking-tight">隐私政策</h1>
			<p class="text-sm text-white/70 mt-1">最后更新：{new Date().toLocaleDateString('zh-CN')}</p>
		</div>
		<span
			class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-5xl md:text-6xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
			style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
		>Privacy</span>
	</div>

	<div class="border border-black bg-white divide-y divide-black">
		{#each sections as item}
			<section class="px-4 md:px-6 py-4">
				<h2 class="font-black text-base tracking-tight text-black mb-2">{item.title}</h2>
				<p class="text-sm text-neutral-600 leading-relaxed">{item.body}</p>
			</section>
		{/each}
	</div>
</div>
