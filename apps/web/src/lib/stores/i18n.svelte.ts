import { browser } from '$app/environment';

/**
 * 轻量 i18n：中文（默认）/ 英文。
 * - 语言存 localStorage（tournix-lang），浏览器 navigator.language 兜底
 * - 公共文案集中在字典，组件通过 $t() 读取
 */

export type Lang = 'zh' | 'en';

const STORAGE_KEY = 'tournix-lang';

const zh = {
	'nav.home': '首页',
	'nav.tournaments': '赛事',
	'nav.archived': '历史赛事',
	'nav.login': '登录 / 注册',
	'nav.dashboard': '我的后台',
	'nav.admin': '管理后台',
	'nav.profile': '账户设置',
	'nav.logout': '退出登录',
	'footer.support': '支持：support@tournix.app',
	'footer.help': '帮助中心',
	'footer.privacy': '隐私政策',
	'footer.terms': '服务条款',
	'footer.feedback': '反馈',
	'hero.eyebrow': 'Tournix',
	'hero.title': '电竞赛事管理平台',
	'hero.subtitle': '创建赛事、管理队伍、赛程对阵、实时比分、竞猜预测、报名支付一站式搞定。',
	'common.browse': '浏览赛事',
	'common.loading': '加载中...',
	'common.error': '出错了',
	'common.retry': '重试',
	'common.backHome': '返回首页',
	'lang.name': 'English',
};

const en: Record<keyof typeof zh, string> = {
	'nav.home': 'Home',
	'nav.tournaments': 'Tournaments',
	'nav.archived': 'Archived',
	'nav.login': 'Sign in / Register',
	'nav.dashboard': 'Dashboard',
	'nav.admin': 'Admin',
	'nav.profile': 'Settings',
	'nav.logout': 'Sign out',
	'footer.support': 'Support: support@tournix.app',
	'footer.help': 'Help',
	'footer.privacy': 'Privacy',
	'footer.terms': 'Terms',
	'footer.feedback': 'Feedback',
	'hero.eyebrow': 'Tournix',
	'hero.title': 'Esports Tournament Platform',
	'hero.subtitle': 'Create tournaments, manage teams, brackets, live scores, predictions, registration & payment — all in one place.',
	'common.browse': 'Browse tournaments',
	'common.loading': 'Loading...',
	'common.error': 'Something went wrong',
	'common.retry': 'Retry',
	'common.backHome': 'Back to home',
	'lang.name': '中文',
};

export type TKey = keyof typeof zh;

export function detectLang(): Lang {
	if (browser) {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === 'en' || saved === 'zh') return saved;
		const nav = navigator.language?.toLowerCase() ?? '';
		if (nav.startsWith('zh')) return 'zh';
		return 'en';
	}
	return 'zh';
}

export function setLang(lang: Lang) {
	if (browser) localStorage.setItem(STORAGE_KEY, lang);
}

export function translate(key: TKey, lang: Lang): string {
	return lang === 'en' ? en[key] : zh[key];
}
