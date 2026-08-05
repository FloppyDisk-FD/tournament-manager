import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1280, height: 900 } });
const page = await browser.newPage();

// 1. 登录 username=2
await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle2', timeout: 30000 });
await page.type('#username', '2');
await page.type('#password', 'Test123!');
// 登录按钮文本含「登 录」或「登录」
const loginBtn = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const b = btns.find(x => x.textContent.includes('登') && x.textContent.includes('录'));
  return b ? { found: true, text: b.textContent.trim() } : { found: false };
});
console.log('LOGIN BTN:', JSON.stringify(loginBtn));
if (loginBtn.found) {
  const b = await page.$('button');
  const handles = await page.$$('button');
  for (const h of handles) {
    const t = await h.evaluate(el => el.textContent);
    if (t.includes('登') && t.includes('录')) { await h.click(); break; }
  }
}
await sleep(2500);
console.log('after login url:', page.url());

// 2. 打开 8 队瑞士轮详情页
await page.goto('http://localhost:5174/tournaments/751740b6-872f-412d-848b-08e00cf6280b', { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(2000);

// 3. 找「重新申请」按钮
const btnInfo = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const reapply = btns.find(b => b.textContent.includes('重新申请'));
  if (!reapply) return { found: false, allButtons: btns.map(b => b.textContent.trim().slice(0, 30)) };
  const rect = reapply.getBoundingClientRect();
  return { found: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: reapply.textContent.trim(), visible: rect.width > 0 && rect.height > 0 };
});
console.log('REAPPLY BTN:', JSON.stringify(btnInfo, null, 2));
if (btnInfo.found) {
  // 点击
  await page.mouse.click(btnInfo.x, btnInfo.y);
  await sleep(1500);
  // 检查表单是否出现
  const after = await page.evaluate(() => {
    const sel = document.querySelector('#regTeam');
    const submitBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('提交报名')).length;
    return { hasTeamSelect: !!sel, submitBtnCount: submitBtns, selVisible: sel ? (sel.offsetWidth > 0) : false };
  });
  console.log('AFTER CLICK:', JSON.stringify(after, null, 2));
  await page.screenshot({ path: 'C:/Users/Moryoo/OneDrive/Desktop/test/tournament-manager/tmp/browser-test/after-click.png' });
}
await browser.close();
