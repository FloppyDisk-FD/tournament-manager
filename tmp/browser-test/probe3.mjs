import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1280, height: 900 } });
const page = await browser.newPage();
page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warn') console.log('CONSOLE:', msg.type(), msg.text().slice(0, 200)); });
page.on('pageerror', err => console.log('PAGEERROR:', err.message.slice(0, 300)));

await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle2', timeout: 30000 });
await page.type('#username', '2');
await page.type('#password', 'Test123!');
const handles = await page.$$('button');
for (const h of handles) {
  const t = await h.evaluate(el => el.textContent);
  if (t.includes('登') && t.includes('录')) { await h.click(); break; }
}
await sleep(2500);
console.log('url after login:', page.url());
await page.goto('http://localhost:5174/tournaments/751740b6-872f-412d-848b-08e00cf6280b', { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(2500);

// 检查按钮是否存在 + 是否有遮挡元素
const probe = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('重新申请'));
  if (!b) return { found: false };
  const r = b.getBoundingClientRect();
  // 检查点击点最上层元素
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return {
    found: true,
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    topElement: top ? { tag: top.tagName, cls: top.className?.toString().slice(0, 60), txt: top.textContent?.slice(0, 20) } : null,
    isSame: top === b,
  };
});
console.log('PROBE:', JSON.stringify(probe, null, 2));
if (probe.found) {
  const r = probe.rect;
  await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
  await sleep(1500);
}
const after = await page.evaluate(() => {
  const sel = document.querySelector('#regTeam');
  const txt = document.body.innerText;
  return { hasTeamSelect: !!sel, hasReapply: txt.includes('重新申请'), hasFormLabel: txt.includes('选择参赛队伍') };
});
console.log('AFTER:', JSON.stringify(after));
await browser.close();
