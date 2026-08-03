export type LiveEmbed =
	| { kind: 'iframe'; src: string; url: string }
	| { kind: 'link'; url: string };

/**
 * 把赛事配置的直播地址解析为可嵌入形式。
 * - YouTube（watch / youtu.be / live）→ 官方 embed iframe（若作者禁止嵌入，页面会显示 152 错误，外链兜底）
 * - Twitch 频道 → player.twitch.tv（需要 parent 域名，SSR 阶段无 window 时降级为外链）
 * - Bilibili 直播 → 禁止 iframe（X-Frame-Options），降级为外链
 * - 其他站点 → 尝试直接 iframe（若被目标站 CSP 拦截，观众可点外链）
 */
export function resolveLiveEmbed(url: string, parentHost?: string): LiveEmbed {
	try {
		const u = new URL(url);
		const host = u.hostname.toLowerCase();

		// YouTube
		if (host === 'youtu.be') {
			const id = u.pathname.slice(1).split('/')[0];
			if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${id}`, url };
		}
		if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
			const v = u.searchParams.get('v') ?? u.pathname.split('/').pop();
			if (v) return { kind: 'iframe', src: `https://www.youtube.com/embed/${v}`, url };
		}

		// Twitch
		if (host === 'twitch.tv' || host.endsWith('.twitch.tv')) {
			const channel = u.pathname.split('/').filter(Boolean)[0];
			if (channel && parentHost) {
				return { kind: 'iframe', src: `https://player.twitch.tv/?channel=${channel}&parent=${parentHost}`, url };
			}
			return { kind: 'link', url };
		}

		// Bilibili 直播（含主站直播页）禁止嵌入
		if (host === 'live.bilibili.com' || host.endsWith('bilibili.com')) {
			return { kind: 'link', url };
		}

		// 其他：尝试直接嵌入
		return { kind: 'iframe', src: url, url };
	} catch {
		return { kind: 'link', url };
	}
}
