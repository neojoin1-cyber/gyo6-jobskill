import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = path => readFileSync(resolve(root, path), 'utf8')

const checks = [
  ['self-delete RPC', read('supabase/migrations/20260827140000_self_service_account_deletion.sql'), /rpc_delete_my_account[\s\S]*DELETE FROM auth\.users/i],
  ['student deletion UI', read('src/screens/student/AccountDataScreen.jsx'), /deleteOwnAccount[\s\S]*계정 및 데이터 삭제/],
  ['teacher deletion UI', read('src/screens/teacher/TeacherShell.jsx'), /deleteOwnAccount[\s\S]*계정 및 데이터 삭제/],
  ['local cleanup after deletion', read('src/lib/sessionLifecycle.js'), /rpc_delete_my_account[\s\S]*clearUserStorage\(\)/],
]

for (const [label, source, pattern] of checks) {
  if (!pattern.test(source)) throw new Error(`[계정 삭제] ${label} 연결이 없습니다.`)
}

console.log('[계정 삭제] 통과 - 학생·교사 앱 내 삭제, 서버 계정·연결 데이터 삭제, 기기 사본 정리')
