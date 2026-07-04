const BASE = 'https://b966415b.tournament-manager-web.pages.dev';

// 登录
const loginRaw = await fetch(`${BASE}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});
const cookie = loginRaw.headers.get('set-cookie');
const cookies = cookie ? cookie.split(';')[0] : '';

// 1. Admin 概览页 — 提取统计数字
const adminRes = await fetch(`${BASE}/admin`, { headers: { cookie: cookies } });
const adminHtml = await adminRes.text();
// 找到三个统计卡片
const statMatches = adminHtml.match(/<div class="text-xs[^"]*">[^<]+<\/div>\s*<div class="font-black[^"]*">\s*(\d+)\s*<\/div>/g);
if (statMatches) {
  console.log('Admin stats (raw):');
  statMatches.forEach((m, i) => {
    const label = m.match(/>([^<]+)<\/div>/)?.[1];
    const value = m.match(/font-black[^"]*">\s*(\d+)/)?.[1];
    console.log(`  ${i}: ${label} = ${value}`);
  });
}

// 2. 检查 API 返回的赛事
const tRes = await fetch(`${BASE}/api/v1/tournaments?limit=100`, { headers: { cookie: cookies } });
const tJson = await tRes.json();
console.log(`\nTournaments from API: total=${tJson.total}, count=${tJson.items?.length}`);
tJson.items?.forEach((t, i) => {
  console.log(`  ${i}: ${t.name} - ${t.status}`);
});

// 3. 检查不存在赛事的错误处理
console.log('\n--- Non-existent tournament ---');
const nonRes = await fetch(`${BASE}/tournaments/non-existent-id`);
console.log(`Status: ${nonRes.status}`);
const nonHtml = await nonRes.text();
// 提取错误信息
const errMsg = nonHtml.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1] || 'N/A';
console.log(`H1: ${errMsg}`);
const bodyText = nonHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] || '';
const visibleText = bodyText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
console.log(`Visible: ${visibleText}`);

// 4. 检查不存在赛事的详情 + bracket
const nonBracketRes = await fetch(`${BASE}/tournaments/non-existent-id/bracket`);
console.log(`\nBracket status: ${nonBracketRes.status}`);
