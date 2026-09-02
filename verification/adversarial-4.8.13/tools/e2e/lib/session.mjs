// 저장된 세션(탭 단위 sessionStorage 포함)으로 컨텍스트를 연다.
// 이 앱은 auth 세션을 sessionStorage + window.name 에 두므로 storageState 만으로는 부족하다.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

export const SESSION_DIR = 'C:/Users/kbe/AppData/Local/Temp/claude/D--apps-sugar-salt-campus/e6bc74b3-0c98-43db-908f-fb5749de244b/scratchpad/sessions'

export async function openWithSession(role, { viewport = { width: 390, height: 844 }, headless = true } = {}) {
  const path = `${SESSION_DIR}/${role}.json`
  const state = JSON.parse(readFileSync(path, 'utf8'))
  const tab = state.__tab || { windowName: '', sessionStorage: {} }
  delete state.__tab

  const browser = await chromium.launch({ headless })
  const context = await browser.newContext({ storageState: state, viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  await context.addInitScript(({ windowName, sessionStorage: ss }) => {
    try {
      if (windowName) window.name = windowName
      for (const [k, v] of Object.entries(ss || {})) sessionStorage.setItem(k, v)
    } catch { /* 접근 불가 환경 */ }
  }, tab)
  const page = await context.newPage()
  return { browser, context, page, close: async () => { await context.close(); await browser.close() } }
}
