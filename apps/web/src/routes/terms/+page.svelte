<script lang="ts">
	import BackLink from '$lib/components/BackLink.svelte';

	const sections: { title: string; body: string }[] = [
		{ title: '1. 服务概述', body: 'Tournix（"本平台"）是一个电竞赛事管理平台，为用户提供赛事创建、队伍管理、报名参赛、比分记录、竞猜预测等功能。使用本平台即表示您同意本条款。' },
		{ title: '2. 账号责任', body: '您负责维护账号安全，不得共享密码或允许他人使用您的账号从事违规活动。您对账号下发生的所有操作负责。' },
		{ title: '3. 用户行为规范', body: '您承诺不利用本平台从事：非法活动、侵犯他人知识产权、发布虚假信息、骚扰或攻击其他用户、恶意操纵比赛结果或竞猜数据。违反者将被封禁账号。' },
		{ title: '4. 赛事与报名', body: '赛事主办方负责赛事规则的制定与解释。报名费由主办方设置，通过第三方支付服务商（Waffo Pancake）处理。支付一经完成，退款政策由主办方决定。' },
		{ title: '5. 知识产权', body: '本平台的代码、设计、品牌（Tournix）及相关内容的知识产权归平台所有。您提交的内容（队伍资料、赛事信息）仍归您所有，但授予平台在服务范围内使用的许可。' },
		{ title: '6. 服务变更与终止', body: '我们可能随时更新、暂停或终止部分或全部服务。对于违反本条款的用户，我们有权终止其账号而不另行通知。' },
		{ title: '7. 免责声明', body: '本平台按"现状"提供服务，不对服务的连续性、准确性作任何明示或暗示的担保。因使用本平台产生的直接或间接损失，平台不承担超出您实际支付金额的责任。' },
		{ title: '8. 联系我们', body: '如对本服务条款有任何疑问，请通过 support@tournix.app 联系我们。' },
	];
</script>

<svelte:head>
	<title>服务条款 — Tournix</title>
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
				<span class="text-xs font-black uppercase tracking-widest text-white/60">Terms</span>
			</div>
			<h1 class="font-black text-2xl md:text-3xl tracking-tight">服务条款</h1>
			<p class="text-sm text-white/70 mt-1">最后更新：{new Date().toLocaleDateString('zh-CN')}</p>
		</div>
		<span
			class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-5xl md:text-6xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
			style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
		>Terms</span>
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
