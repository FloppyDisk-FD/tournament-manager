import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1280, height: 900 } });
const page = await browser.newPage();
page.on('pageerror', err => console.log('PAGEERROR:', err.message.slice(0, 200)));
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
await sleep(3000);
const txt = await page.evaluate(() => document.body.innerText);
const idx = txt.indexOf('报名参赛');
console.log('=== 报名区块 ===');
console.log(txt.slice(idx, idx + 400));
await browser.close();
