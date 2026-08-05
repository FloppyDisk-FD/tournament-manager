import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1280, height: 900 } });
const page = await browser.newPage();
await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle2', timeout: 30000 });
await page.type('#username', '2');
await page.type('#password', 'Test123!');
const handles = await page.$$('button');
for (const h of handles) {
  const t = await h.evaluate(el => el.textContent);
  if (t.includes('登') && t.includes('录')) { await h.click(); break; }
}
await sleep(2500);
await page.goto('http://localhost:5174/tournaments/751740b6-872f-412d-848b-08e00cf6280b', { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(2500);
// 点击重新申请
const btn = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('重新申请'));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
console.log('btn:', JSON.stringify(btn));
if (btn) { await page.mouse.click(btn.x, btn.y); await sleep(1500); }
// 打印页面 body 中报名区块附近文本
const txt = await page.evaluate(() => document.body.innerText);
const idx = txt.indexOf('报名');
console.log('=== 报名区块文本 ===');
console.log(txt.slice(Math.max(0, idx - 200), idx + 600));
await browser.close();
