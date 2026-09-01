// 진입 경로 실측 — 정식 진입과 체험 진입이 각각 무엇을 띄우는지 먼저 눈으로 확인한다.
// 실행: node verification/adversarial-4.8.13/tools/e2e/explore-entry.mjs

import { openSession, save, mask, MEMBER_ENTRY, TRIAL_PAGE } from './lib/harness.mjs'

const out = {}

async function probe(name, url, { waitMs = 4000 } = {}) {
  const s = await openSession()
  const t0 = Date.now()
  const resp = await s.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await s.page.waitForTimeout(waitMs)
  const title = await s.page.title()
  const bodyText = (await s.page.evaluate(() => document.body.innerText || '')).slice(0, 2500)
  const buttons = await s.page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a[role=button], [data-trial], input[type=submit]')]
    return els.slice(0, 60).map(e => ({
      tag: e.tagName.toLowerCase(),
      text: (e.innerText || e.value || '').trim().slice(0, 60),
      trial: e.getAttribute('data-trial') || null,
      disabled: e.disabled ?? null,
    })).filter(x => x.text || x.trial)
  })
  await s.shot(`entry/${name}.png`)
  out[name] = {
    url, httpStatus: resp?.status() ?? null, loadMs: Date.now() - t0, title,
    bodyPreview: mask(bodyText),
    controls: buttons,
    storage: mask(await s.dumpStorage()),
    consoleErrors: s.logs.console.filter(c => c.type === 'error'),
    pageErrors: s.logs.pageErrors,
    failedRequests: s.logs.requests.filter(r => r.status >= 400),
  }
  await s.close()
}

await probe('member-entry', MEMBER_ENTRY)
await probe('trial-page', TRIAL_PAGE)

save('entry/entry-probe.json', out)
for (const [k, v] of Object.entries(out)) {
  console.log(`\n=== ${k} (${v.httpStatus}, ${v.loadMs}ms) — ${v.title}`)
  console.log('controls:', v.controls.map(c => `${c.trial ? `[${c.trial}]` : ''}${c.text}`).join(' | ').slice(0, 500))
  console.log('body:', v.bodyPreview.replace(/\n+/g, ' / ').slice(0, 500))
  console.log('console errors:', v.consoleErrors.length, 'page errors:', v.pageErrors.length, 'failed reqs:', v.failedRequests.length)
  if (v.consoleErrors.length) console.log('  ', JSON.stringify(v.consoleErrors.slice(0, 3)))
  if (v.failedRequests.length) console.log('  ', JSON.stringify(v.failedRequests.slice(0, 3)))
}
