import { marked } from 'marked';

/**
 * 渲染赛事规则 Markdown。
 * 输出经轻量白名单清理（移除 script/iframe 等危险标签与 on* 事件属性），
 * SSR 与客户端行为一致。
 */
export function renderMarkdown(src: string | null | undefined): string {
  if (!src || !src.trim()) return '';
  const raw = marked.parse(src, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string;
  return raw
    // 成对危险标签
    .replace(/<(script|iframe|object|embed|style|link|meta|form|input)[\s\S]*?<\/\1>/gi, '')
    // 自闭合/孤立危险标签
    .replace(/<(script|iframe|object|embed|style|link|meta|form|input)[^>]*\/?>/gi, '')
    // 事件属性
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // javascript: URL
    .replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'\s>]*/gi, '$1="#"');
}
