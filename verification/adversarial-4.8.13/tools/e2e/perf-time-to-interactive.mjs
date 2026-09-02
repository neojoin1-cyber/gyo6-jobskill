// 3G·저사양에서 "학생이 첫 조작을 할 수 있게 되기까지" 걸리는 시간을 잰다.
// 체감이 아니라 시각으로 고정한다. 기준선 9797477fe73a
import { openSession, loginTrial, save, VIEWPORTS, APP } from './lib/harness.mjs'

const mode = process.argv[2] || 'slow3g'
const s = await openSession({ viewport: VIEWPORTS['390x844'] })
const cdp = await s.context.newCDPSession(s.page)
if (mode !== 'normal') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
if (mode === 'slow3g') {
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 400,
    downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8,
  })
}
await loginTrial(s, 'student')

const t0 = Date.now()
await s.page.goto(APP, { waitUntil: 'commit', timeout: 180000 })
const marks = {}
const wait = async (label, fn, limitMs = 90000) => {
  const start = Date.now()
  while (Date.now() - start < limitMs) {
    if (await fn().catch(() => false)) { marks[label] = Date.now() - t0; return }
    await s.page.waitForTimeout(400)
  }
  marks[label] = null
}
await wait('첫 글자가 보일 때까지', async () => ((await s.page.evaluate(() => document.body?.innerText || '')).trim().length > 20))
await wait('학습관 목록이 보일 때까지', async () => (await s.page.evaluate(() => (document.body.innerText || '').includes('교육부 직업공통능력관'))))
await wait('첫 조작(바로 시작)이 가능할 때까지', async () => (await s.page.locator('button, [role=button]').filter({ hasText: /바로 시작/ }).count()) > 0)

const 결과 = { _meta: { baseline: '9797477fe73a (4.8.14)', 조건: mode, 대상: APP }, 밀리초: marks }
save(`perf/time-to-interactive-${mode}.json`, 결과)
console.log(JSON.stringify(결과, null, 1))
await s.close()
