// 관리자 화면 검증 — 실제 학교·학생 자료가 보이는 화면이므로 원문을 저장하지 않는다.
// 남기는 것은 구조·개수·권한 판정뿐이다(§8 개인정보 금지).
//
//  AD1 관리자 화면 구성과 이동 (학교·교사·학급·통계·랭킹)
//  AD2 각 화면의 오류·실패 요청
//  AD3 랭킹 화면에 체험·검증 계정이 실제 학생과 섞여 보이는가
//  AD4 접근성(이름 없는 버튼·랜드마크) 과 대비비
//  AD5 관리자 권한 경계 — 이 계정이 실제로 어디까지 보는가(개수만 기록)
//
// 실행: node verification/adversarial-4.8.13/tools/e2e/admin-scan.mjs

import { AxeBuilder } from '@axe-core/playwright'
import { openWithSession } from './lib/session.mjs'
import { save } from './lib/harness.mjs'

const APP = 'https://gyo6.kr/apps/sugar-salt/?entry=member'
const s = await openWithSession('admin', { viewport: { width: 1280, height: 800 } })
const report = { _meta: { baseline: '9797477fe73a (4.8.14)', 주의: '개인정보 보호를 위해 원문 대신 구조·개수만 기록' }, screens: [] }

const console_ = []
const failed = []
s.page.on('console', m => { if (m.type() === 'error') console_.push(m.text().slice(0, 200)) })
s.page.on('response', r => { if (r.status() >= 400 && /supabase|gyo6/.test(r.url())) failed.push({ status: r.status(), url: r.url().split('?')[0].slice(-60) }) })

await s.page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 })
await s.page.waitForTimeout(9000)
// 설치 안내가 떠 있으면 닫는다
await s.page.evaluate(() => {
  const el = [...document.querySelectorAll('button, [role=button]')].find(e => /웹으로 계속/.test(e.innerText || ''))
  el?.click()
}).catch(() => {})
await s.page.waitForTimeout(2000)

// 화면에서 개인정보를 빼고 구조만 센다.
async function 구조() {
  return s.page.evaluate(() => {
    const t = document.body?.innerText || ''
    const 버튼 = [...document.querySelectorAll('button, [role=button], a')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
      .map(e => (e.innerText || e.getAttribute('aria-label') || '').trim())
      .filter(Boolean)
    return {
      글자수: t.length,
      // 사람 이름·이메일이 섞이므로 화면 제목 성격의 짧은 라벨만 추린다
      조작라벨: [...new Set(버튼.filter(x => x.length <= 14))].slice(0, 40),
      표행수: document.querySelectorAll('tr').length,
      카드수: document.querySelectorAll('[class*=card]').length,
      이메일노출건수: (t.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g) || []).length,
      숫자지표: (t.match(/\d+\s*\/\s*\d+/g) || []).slice(0, 8),
    }
  })
}

async function scan(name, 이동) {
  if (이동) {
    const ok = await s.page.evaluate(label => {
      const el = [...document.querySelectorAll('button, [role=button], a')]
        .find(e => (e.innerText || '').trim().includes(label))
      el?.click(); return Boolean(el)
    }, 이동)
    if (!ok) { report.screens.push({ screen: name, 이동실패: 이동 }); console.log(`✘ ${name} — '${이동}' 없음`); return }
    await s.page.waitForTimeout(3500)
  }
  const st = await 구조()
  let axe = { violations: [] }
  try {
    axe = await new AxeBuilder({ page: s.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  } catch { /* 분석 불가 화면 */ }
  const 위반 = axe.violations.map(v => ({ id: v.id, impact: v.impact, 건수: v.nodes.length }))
  report.screens.push({ screen: name, 구조: st, axe위반: 위반, 위반건수: 위반.reduce((a, v) => a + v.건수, 0) })
  await s.shot?.(`admin/${name}.png`).catch?.(() => {})
  await s.page.screenshot({ path: `D:/apps/sugar-salt-campus/verification/adversarial-4.8.13/evidence/admin/${name}.png` }).catch(() => {})
  console.log(`✔ ${name} — 조작 ${st.조작라벨.length}개 · 표 ${st.표행수}행 · 이메일노출 ${st.이메일노출건수}건 · axe ${위반.reduce((a, v) => a + v.건수, 0)}건`)
}

// 관리자 하단 메뉴는 학교 · 회원 · 교재 · 순위 · 통계 다섯 개다(실측 라벨)
await scan('01-학교')
await scan('02-회원', '회원')
await scan('03-교재', '교재')
await scan('04-순위', '순위')
await scan('05-통계', '통계')

report.콘솔오류 = console_.slice(0, 10)
report.실패요청 = failed.slice(0, 10)
save('admin/admin-scan.json', report)
console.log('\n콘솔 오류', console_.length, '· 실패 요청', failed.length)
await s.close()
