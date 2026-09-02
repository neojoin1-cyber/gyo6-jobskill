// 학급을 만들면 담당 교사가 붙는가 — 운영에서 직접 확인한다.
//
// 소유자가 직접 로그인한 관리자 세션을 재사용한다. 비밀번호는 다루지 않는다.
// 토큰은 브라우저 안에서만 쓰이고 이 스크립트 밖으로 나오지 않는다.
//
// 실행: node verification/adversarial-4.8.13/tools/e2e/probe-class-teacher-link.mjs

import { openWithSession } from './lib/session.mjs'
import { save } from './lib/harness.mjs'
import { readFileSync } from 'node:fs'

// 공개 키(anon)와 주소는 환경 파일에서 읽는다 — 비밀값이 아니다.
const env = readFileSync('D:/apps/sugar-salt-campus/.env.local', 'utf8')
const cfg = k => (env.match(new RegExp(`^${k}=(.*)`, 'm')) || [])[1]?.trim()

const s = await openWithSession('admin', { viewport: { width: 1280, height: 800 } })
await s.page.goto('https://gyo6.kr/apps/sugar-salt/?entry=member', { waitUntil: 'domcontentloaded', timeout: 60000 })
await s.page.waitForTimeout(9000)

const 결과 = await s.page.evaluate(async ({ URL_, ANON }) => {
  // 앱과 같은 방식으로 세션 토큰을 꺼낸다(탭 단위 sessionStorage).
  let token = null
  const url = URL_, anon = ANON
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i)
    if (!k.startsWith('sugar-salt-auth-')) continue
    try { token = JSON.parse(sessionStorage.getItem(k))?.access_token } catch { /* 형식 불일치 */ }
  }
  if (!token || !url) return { 오류: `토큰 ${Boolean(token)} / 주소 ${Boolean(url)}` }

  const call = async (path, init = {}) => {
    const r = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    })
    const text = await r.text()
    let body = null
    try { body = JSON.parse(text) } catch { body = text.slice(0, 200) }
    return { status: r.status, body }
  }

  // 1) 관리자로 검증 전용 학급 생성
  const 생성 = await call('rpc/rpc_create_class', {
    method: 'POST',
    body: JSON.stringify({ p_name: '[검증]전용학급', p_grade: 3, p_academic_year: new Date().getFullYear() }),
  })

  const classId = 생성.body?.class_id ?? null
  // 2) 그 학급에 담당 교사가 자동으로 붙었는지
  const 담당 = classId
    ? await call(`teacher_classes?select=teacher_id&class_id=eq.${classId}`)
    : { status: null, body: null }

  return {
    생성상태: 생성.status,
    생성응답: 생성.body,
    classId,
    담당교사조회상태: 담당.status,
    담당교사수: Array.isArray(담당.body) ? 담당.body.length : null,
  }
}, { URL_: cfg('VITE_SUPABASE_URL'), ANON: cfg('VITE_SUPABASE_ANON_KEY') })

console.log(JSON.stringify(결과, null, 1))
save('flows/class-teacher-link.json', {
  _meta: { baseline: '9797477fe73a (4.8.14)', 방법: '소유자 관리자 세션으로 운영에서 직접 확인' },
  결과,
})
await s.close()
