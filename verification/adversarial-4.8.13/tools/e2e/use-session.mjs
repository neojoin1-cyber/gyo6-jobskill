// 저장된 세션으로 앱을 열어 재사용이 되는지 확인한다. 자격정보는 다루지 않는다.
import { openWithSession } from './lib/session.mjs'
const role = process.argv[2] || 'admin'
const s = await openWithSession(role, { viewport: { width: 1280, height: 800 } })
await s.page.goto('https://gyo6.kr/apps/sugar-salt/?entry=member', { waitUntil: 'domcontentloaded', timeout: 60000 })
await s.page.waitForTimeout(9000)
const t = (await s.page.evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n')
console.log('로그인 유지:', !/비밀번호를 잊으셨나요|설탕과소금 계정으로 로그인/.test(t))
console.log('화면머리:', t.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 6).join(' / ').slice(0, 200))
await s.close()
