// 학교관리자가 교사에게 학급을 붙일 수 있는가 — 운영에서 직접 시험한다.
//
// 저장소 마이그레이션(rpc_admin_update_user)은 p_class_id 를 '학생'에게만 적용한다.
// 그러나 운영 함수가 저장소보다 최신인 사례가 이미 있었으므로(OPS-002),
// 소유자 말대로 되는지 실제 호출로 확인한다.
//
// 소유자가 직접 로그인한 관리자 세션을 재사용하고, 비밀번호는 다루지 않는다.
// 실행: node verification/adversarial-4.8.13/tools/e2e/probe-admin-assign-teacher.mjs <classId>

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { openWithSession } from './lib/session.mjs'
import { save } from './lib/harness.mjs'

const env = readFileSync('D:/apps/sugar-salt-campus/.env.local', 'utf8')
const cfg = k => (env.match(new RegExp(`^${k}=(.*)`, 'm')) || [])[1]?.trim()
const CLASS_ID = process.argv[2] || '7880eca9-a328-439d-8db5-5fff299e2184'

// 교사 uid 는 교사 자신의 세션에서 얻는다(값은 출력하지 않는다).
const t = createClient(cfg('VITE_SUPABASE_URL'), cfg('VITE_SUPABASE_ANON_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const { data: tIn, error: tErr } = await t.auth.signInWithPassword({
  email: cfg('DEMO_TEACHER_EMAIL'), password: cfg('DEMO_PASSWORD'),
})
if (tErr) { console.error('교사 로그인 실패'); process.exit(1) }
const teacherId = tIn.user.id

const s = await openWithSession('admin', { viewport: { width: 1280, height: 800 } })
await s.page.goto('https://gyo6.kr/apps/sugar-salt/?entry=member', { waitUntil: 'domcontentloaded', timeout: 60000 })
await s.page.waitForTimeout(9000)

const 결과 = await s.page.evaluate(async ({ URL_, ANON, teacherId, classId }) => {
  let token = null
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i)
    if (!k.startsWith('sugar-salt-auth-')) continue
    try { token = JSON.parse(sessionStorage.getItem(k))?.access_token } catch { /* 형식 불일치 */ }
  }
  if (!token) return { 오류: '관리자 토큰 없음' }

  const call = async (path, init = {}) => {
    const r = await fetch(`${URL_}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    })
    const text = await r.text()
    let body = null
    try { body = JSON.parse(text) } catch { body = text.slice(0, 200) }
    return { status: r.status, body }
  }

  const 이전 = await call(`teacher_classes?select=teacher_id&class_id=eq.${classId}`)

  // 1) 앱의 관리자 화면이 쓰는 경로 그대로
  const 배정 = await call('rpc/rpc_admin_update_user', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: teacherId, p_class_id: classId }),
  })

  const 이후 = await call(`teacher_classes?select=teacher_id&class_id=eq.${classId}`)

  // 2) 직접 삽입도 되는지(관리자 권한으로 RLS 통과 여부)
  const 직접 = await call('teacher_classes', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ teacher_id: teacherId, class_id: classId }),
  })
  const 최종 = await call(`teacher_classes?select=teacher_id&class_id=eq.${classId}`)

  return {
    이전담당수: Array.isArray(이전.body) ? 이전.body.length : 이전.status,
    RPC상태: 배정.status,
    RPC응답: 배정.body,
    RPC후담당수: Array.isArray(이후.body) ? 이후.body.length : 이후.status,
    직접삽입상태: 직접.status,
    직접삽입응답: typeof 직접.body === 'object' ? JSON.stringify(직접.body).slice(0, 160) : String(직접.body).slice(0, 160),
    최종담당수: Array.isArray(최종.body) ? 최종.body.length : 최종.status,
  }
}, { URL_: cfg('VITE_SUPABASE_URL'), ANON: cfg('VITE_SUPABASE_ANON_KEY'), teacherId, classId: CLASS_ID })

console.log(JSON.stringify(결과, null, 1))
save('flows/admin-assign-teacher.json', {
  _meta: { baseline: '9797477fe73a (4.8.14)', 대상학급: CLASS_ID, 방법: '소유자 관리자 세션으로 운영에서 직접 시험' },
  결과,
})
await s.close()
