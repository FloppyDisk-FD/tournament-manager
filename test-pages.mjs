// SSR HTML 检查 — 通过 fetch 验证各页面返回的 HTML 是否包含错误标识
const BASE = 'https://b966415b.tournament-manager-web.pages.dev';
const issues = [];

async function fetchHTML(path, { cookies } = {}) {
  const headers = cookies ? { cookie: cookies } : {};
  const res = await fetch(`${BASE}${path}`, { headers });
  const html = await res.text();
  return { status: res.status, html, headers: res.headers };
}

async function fetchAPI(path, { cookies, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookies) headers.cookie = cookies;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  // 通过 Pages 端点访问 /api，触发 service binding
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text };
}

function checkHTML(name, path, { html, status }) {
  console.log(`[${name}] ${path} -> ${status}, ${html.length} bytes`);
  if (status >= 400) issues.push(`[${name}] HTTP ${status}`);
  if (html.includes('Internal Error')) issues.push(`[${name}] Page shows "Internal Error"`);
  if (html.includes('500')) {
    // 仅在错误页面上下文才算
    if (html.includes('message') && html.includes('INTERNAL_ERROR')) {
      issues.push(`[${name}] Page contains INTERNAL_ERROR`);
    }
  }
  // 检查 "undefined" 字面量（说明模板渲染了 undefined）
  const undefMatches = html.match(/\bundefined\b/g);
  if (undefMatches && undefMatches.length > 0) {
    issues.push(`[${name}] Page contains "undefined" literal (${undefMatches.length} times)`);
  }
  if (html.includes('[object Object]')) {
    issues.push(`[${name}] Page contains "[object Object]"`);
  }
  return html;
}

// 1. 登录拿 cookie
const loginRaw = await fetch(`${BASE}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});
console.log(`Login: ${loginRaw.status}`);
const cookie = loginRaw.headers.get('set-cookie');
const cookies = cookie ? cookie.split(';')[0] : '';
console.log(`Cookie: ${cookies ? 'obtained' : 'MISSING'}`);

// 2. 首页
let r = await fetchHTML('/');
checkHTML('Home', '/', r);
if (r.html.includes('暂无赛事')) {
  // 检查 API 是否真的有赛事
  const tRes = await fetchAPI('/api/v1/tournaments');
  console.log(`Tournaments API: ${tRes.status}, total=${tRes.json?.total}`);
  if (tRes.json?.total > 0 && tRes.json?.items?.length > 0) {
    issues.push(`[Home] Shows "暂无赛事" but API has ${tRes.json.total} tournaments — SSR data fetch failed`);
  }
}

// 3. 登录页
r = await fetchHTML('/login');
checkHTML('Login', '/login', r);

// 4. Admin 概览（带 cookie）
r = await fetchHTML('/admin', { cookies });
checkHTML('Admin', '/admin', r);
if (r.html.includes('管理概览')) {
  // 检查统计数字
  const statMatch = r.html.match(/已结束[\s\S]{0,200}?(\d+)/);
  if (statMatch) {
    console.log(`Admin "已结束" stat: ${statMatch[1]}`);
  }
  // 检查"最近赛事"是否有真实内容
  if (r.html.includes('管理全部赛事') && !r.html.includes('TEST1')) {
    issues.push(`[Admin] "最近赛事" still shows hardcoded link only (no real tournament names)`);
  }
  if (r.html.includes('暂无赛事') && r.html.includes('创建第一个赛事')) {
    // 空状态，但如果 API 有赛事说明数据没传过来
    const tRes = await fetchAPI('/api/v1/tournaments');
    if (tRes.json?.total > 0) {
      issues.push(`[Admin] Shows empty state but API has ${tRes.json.total} tournaments`);
    }
  }
}

// 5. Admin 队伍库
r = await fetchHTML('/admin/teams', { cookies });
checkHTML('Teams', '/admin/teams', r);

// 6. Admin 赛事管理列表
r = await fetchHTML('/admin/tournaments', { cookies });
checkHTML('Manage', '/admin/tournaments', r);

// 7. 赛事详情
r = await fetchHTML('/tournaments/01848ba0-840e-46c1-91f9-001317281473');
checkHTML('Detail', '/tournaments/...', r);
if (r.html.includes('TEST1')) {
  console.log('Detail: tournament name "TEST1" found');
} else {
  issues.push(`[Detail] Tournament name "TEST1" not found in SSR HTML`);
}

// 8. 赛事 Bracket
r = await fetchHTML('/tournaments/01848ba0-840e-46c1-91f9-001317281473/bracket');
checkHTML('Bracket', '/tournaments/.../bracket', r);

// 9. 赛事队伍管理
r = await fetchHTML('/admin/tournaments/01848ba0-840e-46c1-91f9-001317281473/teams', { cookies });
checkHTML('TournamentTeams', '/admin/tournaments/.../teams', r);

// 10. 赛事设置
r = await fetchHTML('/admin/tournaments/01848ba0-840e-46c1-91f9-001317281473', { cookies });
checkHTML('TournamentSettings', '/admin/tournaments/...', r);

// 11. 直接 API 测试 — 队伍
const teamsRes = await fetchAPI('/api/v1/teams', { cookies });
console.log(`Teams API: ${teamsRes.status}, count=${teamsRes.json?.length ?? 'N/A'}`);
if (Array.isArray(teamsRes.json)) {
  teamsRes.json.forEach((t) => {
    if (t.avatarEmoji !== undefined || t.avatar_emoji !== undefined) {
      // 检查是否还有 avatarEmoji 字段（应该没有，因为已改 schema）
    }
    if (t.players && t.players.length > 0) {
      t.players.forEach((p) => {
        if (p.avatarEmoji !== undefined) {
          issues.push(`[Teams API] Player ${p.playerName} still has avatarEmoji field (should be avatarUrl)`);
        }
      });
    }
  });
}

// 12. 赛事内队伍 API
const tTeamsRes = await fetchAPI('/api/v1/tournaments/01848ba0-840e-46c1-91f9-001317281473/teams', { cookies });
console.log(`Tournament teams API: ${tTeamsRes.status}`);
if (tTeamsRes.status === 200 && Array.isArray(tTeamsRes.json)) {
  console.log(`Tournament teams count: ${tTeamsRes.json.length}`);
}

// 13. 测试不存在赛事
r = await fetchHTML('/tournaments/non-existent-id');
checkHTML('NonExist', '/tournaments/non-existent-id', r);

// 14. 404 页面
r = await fetchHTML('/this-does-not-exist');
checkHTML('404', '/this-does-not-exist', r);

console.log('\n=== ISSUES FOUND ===');
if (issues.length === 0) {
  console.log('No issues detected');
} else {
  issues.forEach((i, idx) => console.log(`${idx + 1}. ${i}`));
  console.log(`\nTotal: ${issues.length} issues`);
}
