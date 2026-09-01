// 체험 진입 후 앱이 어디에 뜨는지, 어떤 화면을 가졌는지 실측한다.
// 실행: node verification/adversarial-4.8.13/tools/e2e/explore-trial.mjs student|teacher

import { openSession, save, mask, TRIAL_PAGE } from './lib/harness.mjs'

const role = process.argv[2] === 'teacher' ? 'teacher' : 'student'
const s = await openSession({ headless: true })

await s.page.goto(TRIAL_PAGE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await s.page.waitForTimeout(2500)

const btn = s.page.locator(`[data-trial="${role}"]`).first()
await btn.click()
await s.page.waitForTimeout(9000)

// 앱이 같은 탭인지, 새 탭인지, iframe 인지 판정
const pages = s.context.pages()
const frames = s.page.frames().map(f => ({ name: f.name(), url: mask(f.url()).slice(0, 120) }))
const target = pages.length > 1 ? pages[pages.length - 1] : s.page
if (target !== s.page) await target.waitForTimeout(6000)

const appFrame = target.frames().find(f => f.url().includes('/apps/sugar-salt')) || target.mainFrame()

const info = {
  role,
  openedPages: pages.length,
  frames,
  appFrameUrl: mask(appFrame.url()),
  title: await target.title(),
  bodyText: mask((await appFrame.evaluate(() => document.body?.innerText || '')).slice(0, 3000)),
  controls: await appFrame.evaluate(() => [...document.querySelectorAll('button, [role=button], [role=tab], a')]
    .slice(0, 80)
    .map(e => ({ tag: e.tagName.toLowerCase(), role: e.getAttribute('role'), text: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40) }))
    .filter(x => x.text)),
  storage: mask(await target.evaluate(() => {
    const o = { local: {}, session: {} }
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o.local[k] = String(localStorage.getItem(k)).slice(0, 300) } } catch {}
    try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); o.session[k] = String(sessionStorage.getItem(k)).slice(0, 300) } } catch {}
    return o
  })),
  consoleErrors: s.logs.console.filter(c => c.type === 'error').slice(0, 10),
  pageErrors: s.logs.pageErrors.slice(0, 10),
  failedRequests: s.logs.requests.filter(r => r.status >= 400).slice(0, 20),
}

await target.screenshot({ path: `verification/adversarial-4.8.13/evidence/trial/${role}-landing.png` }).catch(() => {})
save(`trial/${role}-landing.json`, info)

console.log('role:', role, '| pages:', info.openedPages, '| appFrame:', info.appFrameUrl)
console.log('title:', info.title)
console.log('controls:', info.controls.map(c => c.text).join(' | ').slice(0, 800))
console.log('body:', info.bodyText.replace(/\n+/g, ' / ').slice(0, 900))
console.log('console errors:', info.consoleErrors.length, JSON.stringify(info.consoleErrors.slice(0, 2)))
console.log('failed reqs:', info.failedRequests.length, JSON.stringify(info.failedRequests.slice(0, 3)))
console.log('storage keys:', Object.keys(info.storage.local).join(', '))

await s.close()
