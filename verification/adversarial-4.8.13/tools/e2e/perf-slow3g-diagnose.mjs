// 3G 조건에서 홈이 완성되지 않는 것이 '느린 것'인지 '멈춘 것'인지 가른다.
import { openSession, loginTrial, save, mask, VIEWPORTS, APP } from './lib/harness.mjs'

const tag = process.argv[2] || 'run'   // 회차별로 증거를 따로 남긴다(성공 회차가 실패 회차를 덮어썼다)
const s = await openSession({ viewport: VIEWPORTS['390x844'] })
const cdp = await s.context.newCDPSession(s.page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
await cdp.send('Network.enable')
await cdp.send('Network.emulateNetworkConditions', {
  offline: false, latency: 400,
  downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8,
})

const reqs = new Map()
s.page.on('request', r => reqs.set(r.url(), { at: Date.now(), done: false, type: r.resourceType() }))
s.page.on('requestfinished', r => { const e = reqs.get(r.url()); if (e) { e.done = true; e.ms = Date.now() - e.at } })
s.page.on('requestfailed', r => { const e = reqs.get(r.url()); if (e) { e.done = true; e.failed = r.failure()?.errorText } })

await loginTrial(s, 'student')
const t0 = Date.now()
await s.page.goto(APP, { waitUntil: 'commit', timeout: 180000 })

const 관측 = []
for (let i = 0; i < 12; i++) {
  await s.page.waitForTimeout(10000)
  const body = (await s.page.evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n')
  const 대기중 = [...reqs.entries()].filter(([, e]) => !e.done)
  관측.push({
    경과초: Math.round((Date.now() - t0) / 1000),
    본문길이: body.length,
    학습관보임: body.includes('교육부 직업공통능력관'),
    바로시작보임: /바로 시작/.test(body),
    대기중요청: 대기중.length,
    대기중예: 대기중.slice(0, 3).map(([u, e]) => ({ url: mask(u).slice(0, 90), type: e.type, 경과ms: Date.now() - e.at })),
    본문머리: mask(body).replace(/\n/g, ' | ').slice(0, 160),
  })
  console.log(`${관측.at(-1).경과초}s — 본문 ${body.length}자 · 학습관 ${관측.at(-1).학습관보임} · 대기중 ${대기중.length}`)
  if (관측.at(-1).바로시작보임) break
}
const 실패 = [...reqs.entries()].filter(([, e]) => e.failed).map(([u, e]) => ({ url: mask(u).slice(0, 100), 오류: e.failed }))
await s.shot(`perf/slow3g-${tag}-final.png`).catch(() => {})
save(`perf/slow3g-diagnose-${tag}.json`, { _meta: { baseline: '9797477fe73a', 조건: '3G 400ms + CPU 6배' }, 관측, 실패요청: 실패, 총요청: reqs.size })
console.log('실패 요청:', JSON.stringify(실패).slice(0, 400))
await s.close()
