// 홍보 약속 역검증 — 4.8.13 리플릿이 학교에 약속한 것을 화면에서 증명할 수 있는지 본다.
// 근거 문구는 output/promotion/rendered-direct-4.8.13/leaflet-01.png 에서 직접 읽은 것이다.
//
// 판정 규칙: 화면에서 증명하지 못한 약속은 LEGAL 결함 후보다.
//            "코드에 있다"는 증명이 아니다. 학생·교사가 보는 화면에 있어야 한다.
//
// 실행: node verification/adversarial-4.8.13/tools/e2e/promo-promises.mjs

import { openSession, appFrame, tapButton, save, mask, TRIAL_PAGE } from './lib/harness.mjs'

const results = []

async function launch(role) {
  const s = await openSession({ viewport: { width: 390, height: 844 } })
  await s.page.goto(TRIAL_PAGE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await s.page.waitForTimeout(2000)
  await s.page.locator(`[data-trial="${role}"]`).first().click()
  await s.page.waitForTimeout(10000)
  return s
}

const bodyOf = async s => (await appFrame(s.page).evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n')

// 라벨을 눌러 화면을 옮긴다. 버튼이 아니면 카드일 수 있어 텍스트 클릭도 시도한다.
async function go(s, label, waitMs = 3000) {
  let frame = appFrame(s.page)
  const r = await tapButton(frame, label, { page: s.page, waitMs })
  if (r.ok) return r
  frame = appFrame(s.page)
  const loc = frame.getByText(label).first()
  if (await loc.count().catch(() => 0)) {
    await loc.click({ timeout: 6000 }).catch(() => {})
    await s.page.waitForTimeout(waitMs)
    return { ok: true, via: 'text', label }
  }
  return { ok: false, label }
}

async function check({ id, promise, role, s, path, expect, shot }) {
  for (const step of path) await go(s, step.label, step.wait ?? 3000)
  const body = await bodyOf(s)
  const found = expect.filter(k => body.includes(k))
  const missing = expect.filter(k => !body.includes(k))
  const file = `legal/${id}.png`
  await s.shot(file).catch(() => {})
  const row = {
    id, promise, role,
    경로: path.map(p => p.label).join(' → '),
    화면에서찾은문구: found,
    못찾은문구: missing,
    판정: missing.length === 0 ? '증명됨' : (found.length ? '부분' : '증명못함'),
    증거: file,
    화면요약: mask(body).slice(0, 700),
  }
  results.push(row)
  console.log(`${row.판정 === '증명됨' ? '✔' : row.판정 === '부분' ? '△' : '✘'} ${id} ${promise} — 찾음 ${found.length}/${expect.length} ${missing.length ? '(없음: ' + missing.join(', ') + ')' : ''}`)
  return body
}

// ── 학생 화면 약속 ─────────────────────────────────────────────────────────
{
  const s = await launch('student')
  await check({
    id: 'LEGAL-S1', role: '학생', promise: '교육부 직업공통능력관·NCS 기본·심화관 등 6개 학습관',
    s, path: [], expect: ['교육부 직업공통능력관', 'NCS 직업기초능력관', '채용필기 심화관', '인성검사훈련관', '자기소개서관', '면접 스킬관'],
  })

  await check({
    id: 'LEGAL-S2', role: '학생', promise: '진단 → 개념 → 판단 → 평가연계 학습 흐름',
    s, path: [{ label: '바로 시작', wait: 4500 }, { label: '학습 시작', wait: 3500 }],
    expect: ['개념', '판단', '평가연계'],
  })

  await go(s, '홈', 2000)
  await check({
    id: 'LEGAL-S3', role: '학생', promise: '오답 저장 → 보완 순서',
    s, path: [{ label: '성장', wait: 3000 }],
    expect: ['오답', '복습'],
  })

  await go(s, '홈', 2000)
  await check({
    id: 'LEGAL-S4', role: '학생', promise: '자기소개서 항목별 작성·수정 자율학습',
    s, path: [{ label: '자기소개서관', wait: 3500 }],
    expect: ['자율학습', '작성'],
  })

  await go(s, '홈', 2000)
  await check({
    id: 'LEGAL-S5', role: '학생', promise: '1분 자기소개·지원동기·마지막 말 연습',
    s, path: [{ label: '면접 스킬관', wait: 3500 }, { label: '진단·모의·실전 보기', wait: 3000 }],
    expect: ['자기소개', '지원동기'],
  })

  await go(s, '홈', 2000)
  await check({
    id: 'LEGAL-S6', role: '학생', promise: '120개 지원기관 공고·직무 분석',
    s, path: [{ label: '탐험', wait: 3500 }],
    expect: ['지원', '기관'],
  })

  await check({
    id: 'LEGAL-S7', role: '학생', promise: '학생별 학과·자격·활동 포트폴리오 / 학년별 누적',
    s, path: [{ label: '나', wait: 3000 }],
    expect: ['포트폴리오'],
  })

  save('legal/student-storage.json', mask(await s.dumpStorage()))
  await s.close()
}

// ── 교사 화면 약속 ─────────────────────────────────────────────────────────
{
  const s = await launch('teacher')
  await check({
    id: 'LEGAL-T1', role: '교사', promise: '교사가 학교 안에서 계속 지도 — 수업 진행',
    s, path: [], expect: ['수업 시작', '학생 화면 보기'],
  })

  await check({
    id: 'LEGAL-T2', role: '교사', promise: '자율학습 현재 상태 관리(30초 갱신)',
    s, path: [], expect: ['현재 학습', '학습 화면에 있는 학생만'],
  })

  await check({
    id: 'LEGAL-T3', role: '교사', promise: '작성본 첨삭 · 개별 상담 · 메시지',
    s, path: [], expect: ['작성본 첨삭', '메시지'],
  })

  await check({
    id: 'LEGAL-T4', role: '교사', promise: '9단계 면접 관찰표 · 학생별 피드백',
    s, path: [{ label: '면접 코칭', wait: 3500 }],
    expect: ['관찰'],
  })

  save('legal/teacher-storage.json', mask(await s.dumpStorage()))
  await s.close()
}

save('legal/promo-promises.json', {
  _meta: {
    baseline: 'ee6aee89abf8',
    근거: 'output/promotion/rendered-direct-4.8.13/leaflet-01.png (4.8.13 직접제안형 리플릿)',
    판정규칙: '화면에서 증명하지 못한 약속은 LEGAL 결함 후보. 코드 존재는 증명이 아니다.',
  },
  results,
})
console.log('\n증명됨', results.filter(r => r.판정 === '증명됨').length,
  '· 부분', results.filter(r => r.판정 === '부분').length,
  '· 증명못함', results.filter(r => r.판정 === '증명못함').length)
