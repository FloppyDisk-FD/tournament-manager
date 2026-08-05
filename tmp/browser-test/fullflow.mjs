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
await sleep(2500);

// 点击重新申请
const btn = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('重新申请'));
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.click(btn.x, btn.y);
await sleep(1200);

// 选择队伍（Select 是原生 select）
const teamVal = await page.evaluate(() => {
  const sel = document.querySelector('#regTeam');
  const opts = Array.from(sel.options).map(o => o.value);
  return opts;
});
console.log('TEAM OPTIONS:', JSON.stringify(teamVal));
if (teamVal.length > 1) {
  await page.select('#regTeam', teamVal[1]);
}
// 填自定义字段（cf-contact_qq / cf-rank）
const cfInputs = await page.evaluate(() => Array.from(document.querySelectorAll('[id^="cf-"]')).map(i => ({ id: i.id, tag: i.tagName })));
console.log('CF FIELDS:', JSON.stringify(cfInputs));
for (const f of cfInputs) {
  if (f.tag === 'SELECT') await page.select('#' + f.id, '青铜').catch(() => {});
  else await page.type('#' + f.id, 'test-qq');
}
// 提交
await sleep(500);
const submitBtn = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('提交报名'));
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
console.log('SUBMIT BTN:', JSON.stringify(submitBtn));
if (submitBtn) { await page.mouse.click(submitBtn.x, submitBtn.y); await sleep(3000); }

const after = await page.evaluate(() => {
  const txt = document.body.innerText;
  return {
    hasPayPanel: txt.includes('支付报名费'),
    hasPending: txt.includes('待审核'),
    hasPayBtn: txt.includes('去支付'),
    snippet: txt.slice(txt.indexOf('报名参赛'), txt.indexOf('报名参赛') + 300),
  };
});
console.log('AFTER SUBMIT:', JSON.stringify(after, null, 2));
await page.screenshot({ path: 'C:/Users/Moryoo/OneDrive/Desktop/test/tournament-manager/tmp/browser-test/submit-result.png' });
await browser.close();
