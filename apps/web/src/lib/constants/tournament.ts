/**
 * 赛事相关常量与映射
 *
 * 全站统一文案/配色来源：statusMap 与 formatMap 曾分散复制在 6+ 个页面，
 * 收敛到此模块，组件与页面一律从这里导入。
 */

/** 赛制 → 中文文案 */
export const FORMAT_MAP: Record<string, string> = {
	single_elim: '单败淘汰',
	double_elim: '双败淘汰',
	round_robin: '循环联赛',
	swiss: '瑞士轮',
};

/** 状态徽章：label 为中文文案，variant 为瑞士风格配色 class */
export interface StatusVariant {
	label: string;
	variant: string;
}

/** 赛事状态 → 徽章 */
export const TOURNAMENT_STATUS_MAP: Record<string, StatusVariant> = {
	draft: { label: '未开始', variant: 'bg-neutral-100 text-black' },
	ongoing: { label: '进行中', variant: 'bg-black text-white' },
	completed: { label: '已结束', variant: 'bg-accent text-white' },
	cancelled: { label: '已取消', variant: 'bg-white text-neutral-500 line-through border border-black' },
};

/** 队伍状态 → 徽章 */
export const TEAM_STATUS_MAP: Record<string, StatusVariant> = {
	active: { label: '活跃', variant: 'bg-black text-white' },
	eliminated: { label: '已淘汰', variant: 'bg-accent text-white' },
	withdrawn: { label: '已退出', variant: 'bg-neutral-200 text-black' },
};

/** 选手角色 → 中文文案 */
export const PLAYER_ROLE_MAP: Record<string, string> = {
	captain: '队长',
	member: '成员',
	substitute: '替补',
	coach: '教练',
};

/** 报名状态 → 徽章 */
export const REGISTRATION_STATUS_MAP: Record<string, StatusVariant> = {
	pending: { label: '待审核', variant: 'bg-neutral-100 text-black' },
	approved: { label: '已通过', variant: 'bg-black text-white' },
	rejected: { label: '已拒绝', variant: 'bg-accent text-white' },
};

/** 赛事模板（内置预设，创建页一键填充表单） */
export interface TournamentTemplate {
	id: string;
	name: string;
	description: string;
	format: string;
	maxTeams: number;
	teamSize: number;
	boCount: number;
	thirdPlace: boolean;
	swissRounds?: number;
}

export const TOURNAMENT_TEMPLATES: TournamentTemplate[] = [
	{ id: 'single16', name: '16 队单败淘汰', description: '标准 BO3', format: 'single_elim', maxTeams: 16, teamSize: 5, boCount: 3, thirdPlace: false },
	{ id: 'double8', name: '8 队双败淘汰', description: 'BO3 双败', format: 'double_elim', maxTeams: 8, teamSize: 5, boCount: 3, thirdPlace: false },
	{ id: 'swiss8', name: '8 队瑞士轮', description: 'BO3 × 5 轮', format: 'swiss', maxTeams: 8, teamSize: 5, boCount: 3, thirdPlace: false, swissRounds: 5 },
	{ id: 'rr8', name: '8 队循环联赛', description: 'BO1 单循环', format: 'round_robin', maxTeams: 8, teamSize: 5, boCount: 1, thirdPlace: false },
	{ id: 'single4bo5', name: '4 队小场 BO5', description: '短平快', format: 'single_elim', maxTeams: 4, teamSize: 5, boCount: 5, thirdPlace: true },
];
