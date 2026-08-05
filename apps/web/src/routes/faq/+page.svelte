<script lang="ts">
	import BackLink from '$lib/components/BackLink.svelte';
	import { ChevronDown, MessageCircleQuestion } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	let openIndex = $state<number | null>(0);

	const faqs: { q: string; a: string }[] = [
		{ q: 'Tournix 是什么？', a: 'Tournix 是一个电竞赛事管理平台，支持单败淘汰、双败淘汰、循环联赛、瑞士轮四种赛制。主办方可以创建赛事、管理报名、录入比分；选手可以报名参赛、签到；观众可以查看赛程、参与竞猜。' },
		{ q: '创建赛事需要什么条件？', a: '注册时选择「赛事管理者」角色即可创建赛事。注册后也可由系统管理员调整角色。' },
		{ q: '如何报名参赛？', a: '在赛事详情页点击「报名参赛」，选择你的队伍（需先由队伍管理员创建队伍并添加队员），提交后等待主办方审核。若赛事设有报名费，支付成功后才会进入审核。' },
		{ q: '报名费如何支付？', a: '报名费通过 Waffo Pancake 安全支付。提交报名后会在赛事详情页生成支付入口，支持主流支付方式。支付状态会实时更新。' },
		{ q: '如何创建队伍和管理队员？', a: '注册时选择「队伍管理员」角色，登录后进入「我的后台」即可创建队伍、添加/编辑队员、设置队长。' },
		{ q: '赛事签到怎么用？', a: '主办方在赛事管理页可查看签到二维码，队伍管理员扫码即可一键签到（需登录）。签到状态会实时同步。' },
		{ q: '竞猜预测如何计分？', a: '每场已结束比赛的预测，猜对一场 +1 分。同分时按参与场次排序（参与少者优先）。排行榜实时更新。' },
		{ q: '如何导出赛事数据？', a: '主办方进入赛事管理页 → 「数据统计与导出」，可导出报名名单、赛程表、积分榜 CSV 文件。' },
		{ q: '忘记密码怎么办？', a: '请通过 support@tournix.app 联系管理员重置密码。（自助找回密码功能即将上线）' },
		{ q: '如何注销账号？', a: '登录后进入「账户设置」→「安全」→ 底部危险区「注销账号」。注销后数据将被永久删除。' },
	];
</script>

<svelte:head>
	<title>帮助中心 — Tournix</title>
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
				<span class="text-xs font-black uppercase tracking-widest text-white/60">Help Center</span>
			</div>
			<h1 class="font-black text-2xl md:text-3xl tracking-tight">帮助中心</h1>
			<p class="text-sm text-white/70 mt-1">常见问题解答 — 没找到答案？发邮件给我们</p>
		</div>
		<span
			class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-5xl md:text-6xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
			style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
		>FAQ</span>
	</div>

	<div class="border border-black bg-white divide-y divide-black">
		{#each faqs as faq, i}
			<div>
				<button
					onclick={() => (openIndex = openIndex === i ? null : i)}
					class="w-full flex items-center justify-between gap-3 px-4 md:px-6 py-4 text-left hover:bg-neutral-50 transition-colors duration-150 press"
					aria-expanded={openIndex === i}
				>
					<span class="font-black text-sm md:text-base tracking-tight">{faq.q}</span>
					<ChevronDown
						size={16}
						class={cn('shrink-0 transition-transform duration-150', openIndex === i ? 'rotate-180' : '')}
						aria-hidden="true"
					/>
				</button>
				{#if openIndex === i}
					<p class="px-4 md:px-6 pb-4 text-sm text-neutral-600 leading-relaxed">{faq.a}</p>
				{/if}
			</div>
		{/each}
	</div>

	<!-- 反馈入口 -->
	<div class="border border-black bg-black text-white px-4 md:px-6 py-5 mt-6 flex items-center justify-between gap-4 flex-wrap">
		<div class="flex items-center gap-3">
			<MessageCircleQuestion size={20} class="shrink-0 text-accent" aria-hidden="true" />
			<div>
				<div class="font-black">还有其他问题？</div>
				<p class="text-xs text-white/60 font-bold mt-0.5">我们会在 1-2 个工作日内回复</p>
			</div>
		</div>
		<a
			href="mailto:support@tournix.app?subject=Tournix%20反馈"
			class="text-sm font-black border border-white px-3 py-1.5 hover:bg-white hover:text-black transition-colors duration-150 shrink-0"
		>发送反馈</a>
	</div>
</div>
