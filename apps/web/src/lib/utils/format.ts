/**
 * 通用格式化工具
 */

/** ISO 日期 → YYYY-MM-DD（无效输入返回 '—'） */
export function formatDate(iso: string | undefined | null): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '—';
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${m}-${day}`;
}
