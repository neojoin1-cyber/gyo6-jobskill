// TRIAL — 체험이 실제 학교 데이터와 섞이지 않는지, 안내대로 동작하는지 본다.
//
//  T1 체험 시간 제한 안내와 실제 동작이 맞는가 (화면 문구 "제작·검수 기간 무제한")
//  T2 체험 계정이 랭킹·학급 같은 공용 화면에 실제 학생과 섞여 보이는가
//  T3 학생·교사 체험을 동시에 띄웠을 때 서로 간섭하는가
//  T4 체험 재진입 시 이전 체험의 흔적이 이어지는가
//  T5 체험 중 새로고침·뒤로가기에서 상태가 깨지는가
//
// 실행: node verification/adversarial-4.8.13/tools/e2e/trial-scan.mjs

import { openSession, loginTrial, tapVisible, save, mask, VIEWPORTS, APP } from './lib/harness.mjs'

const report = { _meta: { baseline: '9797477fe73a (4.8.14)', 대상: APP } }
const bodyOf = async p => (await p.evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n')

// ── T1 · T2 · T5 : 학생 체험 한 세션 ──────────────────────────────────────
const s1 = await openSession({ viewport: VIEWPORTS['390x844'] })
await loginTrial(s1, 'student')
const 홈 = await bodyOf(s1.page)

report.T1_시간제한 = {
  화면문구: (홈.match(/무제한|남은 시간|\d+분 체험/g) || []),
  안내: /무제한/.test(홈) ? '무제한으로 안내' : '제한 시간 안내 있음',
}

// 랭킹 화면에서 체험 계정이 실제 학생과 섞이는지
await tapVisible(s1.page, '^성장$', 3000)
const 성장 = await bodyOf(s1.page)
const 랭킹이동 = await tapVisible(s1.page, '랭킹|순위', 3500)
const 랭킹 = await bodyOf(s1.page)
await s1.shot('trial/student-ranking.png').catch(() => {})
report.T2_랭킹혼입 = {
  랭킹화면도달: 랭킹이동.ok,
  화면에보인이름: (랭킹.match(/[가-힣]{2,4}(?=\s|$)/g) || []).slice(0, 12),
  체험표식: /체험/.test(랭킹),
  전국랭킹문구: /전국/.test(랭킹),
  본문: mask(랭킹).slice(0, 600),
}

// 새로고침·뒤로가기
await s1.page.reload({ waitUntil: 'domcontentloaded' })
await s1.page.waitForTimeout(7000)
const 새로고침후 = await bodyOf(s1.page)
await s1.page.goBack().catch(() => {})
await s1.page.waitForTimeout(3000)
const 뒤로간뒤 = await bodyOf(s1.page)
report.T5_새로고침_뒤로가기 = {
  새로고침후_로그인유지: !/로그인하세요|비밀번호/.test(새로고침후.slice(0, 400)),
  새로고침후_길이: 새로고침후.length,
  뒤로간뒤_길이: 뒤로간뒤.length,
  뒤로간뒤_깨짐: /문제가 발생했어요|화면을 표시하는 중 오류/.test(뒤로간뒤),
}

const 저장1 = await s1.dumpStorage()
report.T4_첫세션_저장키 = Object.keys(저장1.localStorage)

// ── T3 : 교사 체험을 다른 브라우저로 동시에 ───────────────────────────────
const s2 = await openSession({ viewport: VIEWPORTS['390x844'] })
await loginTrial(s2, 'teacher')
const 교사홈 = await bodyOf(s2.page)
await s1.page.reload({ waitUntil: 'domcontentloaded' })
await s1.page.waitForTimeout(7000)
const 학생재확인 = await bodyOf(s1.page)
report.T3_동시세션 = {
  교사화면정상: /MY CLASS CAMPUS|학급/.test(교사홈),
  학생화면정상: /학습관|오늘도 이어서 학습/.test(학생재확인),
  학생화면에교사흔적: /TEACHER|학급 캠퍼스/.test(학생재확인),
}
await s2.close()

// ── T4 : 체험 종료 후 재진입 ──────────────────────────────────────────────
await s1.page.evaluate(() => {
  const el = [...document.querySelectorAll('button, [role=button]')]
    .find(e => (e.getAttribute('aria-label') || '') === '체험 종료')
  el?.click()
})
await s1.page.waitForTimeout(4000)
await loginTrial(s1, 'student')
const 재진입 = await bodyOf(s1.page)
const 저장2 = await s1.dumpStorage()
report.T4_재진입 = {
  재진입성공: /학습관|오늘도 이어서 학습/.test(재진입),
  이전세션키_남음: Object.keys(저장1.localStorage).filter(k => k in 저장2.localStorage),
  새세션키수: Object.keys(저장2.localStorage).length,
  같은사용자인가: Object.keys(저장2.localStorage).some(k => Object.keys(저장1.localStorage).includes(k) && k.startsWith('sst.user.')),
}
await s1.shot('trial/reenter.png').catch(() => {})
await s1.close()

save('trial/trial-scan.json', report)
console.log(JSON.stringify({
  T1: report.T1_시간제한,
  T2: { ...report.T2_랭킹혼입, 본문: undefined },
  T3: report.T3_동시세션,
  T4: report.T4_재진입,
  T5: report.T5_새로고침_뒤로가기,
}, null, 1))
