// 화면 시나리오 공용 하네스 — 관측을 빠짐없이 남기기 위한 최소 장치.
//
// 원칙: 화면에서 본 것(관측)과 왜 그런지(가설)를 섞지 않는다.
// 이 파일은 관측만 모은다. 콘솔·네트워크·접근성 트리·저장소를 그대로 덤프한다.

import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 증거는 실행 위치와 무관하게 한 곳에 모은다. cwd 기준이면 도구 폴더 밑에 사본이 생긴다.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')

export const APP = 'https://gyo6.kr/apps/sugar-salt/'
export const MEMBER_ENTRY = 'https://gyo6.kr/apps/sugar-salt/?entry=member'
export const TRIAL_PAGE = 'https://gyo6.kr/learning-app.html#trial-accounts'
export const EVIDENCE = join(REPO_ROOT, 'verification/adversarial-4.8.13/evidence')

export const VIEWPORTS = {
  '320x568': { width: 320, height: 568 },
  '360x800': { width: 360, height: 800 },
  '390x844': { width: 390, height: 844 },
  '768x1024': { width: 768, height: 1024 },
  '1280x720': { width: 1280, height: 720 },
  '1920x1080': { width: 1920, height: 1080 },
}

export function save(relPath, content) {
  const full = join(EVIDENCE, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 1) + '\n')
  return full
}

// 개인정보·토큰은 증거에서 지운다(§8 금지사항).
const SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, '<JWT-MASKED>'],
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID-MASKED>'],
  [/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, '<EMAIL-MASKED>'],
]
export function mask(value) {
  const isString = typeof value === 'string'
  let out = isString ? value : JSON.stringify(value)
  for (const [re, rep] of SECRET_PATTERNS) out = out.replace(re, rep)
  // 객체로 받은 것은 객체로 돌려준다. 문자열로 바꿔 돌려주면 호출부가 조용히 깨진다.
  return isString ? out : JSON.parse(out)
}

export async function openSession({ viewport = VIEWPORTS['390x844'], headless = true, deviceScaleFactor = 1 } = {}) {
  const browser = await chromium.launch({ headless })
  const context = await browser.newContext({ viewport, deviceScaleFactor, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await context.newPage()

  const console_ = []
  const pageErrors = []
  const requests = []
  page.on('console', m => console_.push({ type: m.type(), text: mask(m.text()).slice(0, 400) }))
  page.on('pageerror', e => pageErrors.push(mask(String(e)).slice(0, 600)))
  page.on('response', async res => {
    const url = res.url()
    if (!/supabase|gyo6\.kr/.test(url)) return
    requests.push({ status: res.status(), method: res.request().method(), url: mask(url).slice(0, 200) })
  })

  return {
    browser, context, page,
    logs: { console: console_, pageErrors, requests },
    async shot(name) {
      const full = join(EVIDENCE, name)
      mkdirSync(dirname(full), { recursive: true })
      await page.screenshot({ path: full, fullPage: false })
      return full
    },
    async dumpStorage() {
      return page.evaluate(async () => {
        const out = { localStorage: {}, sessionStorage: {}, indexedDB: [], caches: [], cookies: document.cookie || '' }
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out.localStorage[k] = String(localStorage.getItem(k)).slice(0, 600) } } catch (e) { out.localStorage = { _error: String(e) } }
        try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); out.sessionStorage[k] = String(sessionStorage.getItem(k)).slice(0, 600) } } catch (e) { out.sessionStorage = { _error: String(e) } }
        try { if (indexedDB.databases) out.indexedDB = (await indexedDB.databases()).map(d => d.name) } catch (e) { out.indexedDB = ['_error:' + String(e)] }
        try { if (window.caches) out.caches = await caches.keys() } catch (e) { out.caches = ['_error:' + String(e)] }
        return out
      })
    },
    async close() { await context.close(); await browser.close() },
  }
}

// 체험 진입은 앱을 learning-app.html 안의 iframe 으로 띄운다.
// 메인 프레임에서 글자를 찾으면 홈페이지 문구만 잡혀 조작이 통째로 헛돈다.
export function appFrame(page) {
  return page.frames().find(f => f.url().includes('/apps/sugar-salt')) || page.mainFrame()
}

// 접근성 트리에 "읽힐 내용"이 실제로 있는지 본다. 음성은 듣지 않는다(대체의 한계는 판정서에 명시).
export async function a11ySnapshot(page) {
  return page.accessibility.snapshot({ interestingOnly: false })
}


// 버튼을 누를 때는 버튼을 눌러야 한다. getByText 는 본문 글자("확인된 사실…")도 잡아
// 아무 일도 일어나지 않은 채 성공으로 보인다 — 실제로 이 함정에 걸렸다.
export async function tapButton(frame, name, { waitMs = 2200, page = null } = {}) {
  const byRole = frame.getByRole('button', { name: new RegExp(name) })
  let target = byRole.first()
  let count = await byRole.count().catch(() => 0)
  if (!count) {
    const byText = frame.locator('button, [role=button]').filter({ hasText: new RegExp(name) })
    count = await byText.count().catch(() => 0)
    if (!count) return { ok: false, reason: 'no-button', name }
    target = byText.first()
  }
  await target.scrollIntoViewIfNeeded().catch(() => {})
  let ok = true
  await target.click({ timeout: 8000 }).catch(async () => {
    await target.click({ force: true, timeout: 5000 }).catch(() => { ok = false })
  })
  if (page) await page.waitForTimeout(waitMs)
  return { ok, name, matches: count }
}

export async function buttonTexts(frame) {
  return frame.evaluate(() => [...document.querySelectorAll('button, [role=button]')]
    .map(b => (b.innerText || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean).slice(0, 40))
}


// 체험 로그인 후 앱을 최상위 창에서 연다.
// 체험 패널의 iframe 은 높이가 고정돼 있어 뷰포트·배율 변형 시험에 쓸 수 없다.
// 세션은 같은 출처(gyo6.kr)의 저장소에 있으므로 앱 주소로 바로 가도 유지된다.
export async function loginTrial(s, role) {
  await s.page.goto(TRIAL_PAGE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await s.page.waitForTimeout(2000)
  await s.page.locator(`[data-trial="${role}"]`).first().click()
  await s.page.waitForTimeout(10000)
  await s.page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await s.page.waitForTimeout(9000)
  return s.page
}

// 화면에 실제로 보이는 조작만. 숨은 DOM 은 사용자에게 없는 것과 같다.
export async function visibleControls(page) {
  return page.evaluate(() => [...document.querySelectorAll('button, [role=button], a, [role=tab]')]
    .filter(e => {
      const r = e.getBoundingClientRect(); const st = getComputedStyle(e)
      return r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.05
    })
    .map(e => (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean).slice(0, 60))
}

export async function tapVisible(page, label, waitMs = 2600) {
  const loc = page.locator('button, [role=button], a').filter({ hasText: new RegExp(label) })
  const n = await loc.count().catch(() => 0)
  if (!n) return { ok: false, label }
  const target = loc.first()
  await target.scrollIntoViewIfNeeded().catch(() => {})
  let ok = true
  await target.click({ timeout: 8000 }).catch(async () => {
    await target.click({ force: true, timeout: 5000 }).catch(() => { ok = false })
  })
  await page.waitForTimeout(waitMs)
  return { ok, label, matches: n }
}

export const sleep = ms => new Promise(r => setTimeout(r, ms))
