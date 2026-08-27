import { readFileSync } from 'node:fs'
import {
  activateUserStorage,
  clearUserStorage,
  deactivateUserStorage,
  userLocalStorage,
} from '../src/lib/userLocalStorage.js'

class MemoryStorage {
  #values = new Map()
  get length() { return this.#values.size }
  key(index) { return [...this.#values.keys()][index] ?? null }
  getItem(key) { return this.#values.get(key) ?? null }
  setItem(key, value) { this.#values.set(key, String(value)) }
  removeItem(key) { this.#values.delete(key) }
  clear() { this.#values.clear() }
}

globalThis.localStorage = new MemoryStorage()
globalThis.sessionStorage = new MemoryStorage()

const fail = message => {
  console.error(`[공용 PC 격리] 실패 - ${message}`)
  process.exitCode = 1
}

activateUserStorage('student-user-a')
userLocalStorage.setItem('iv_cover_draft', 'A의 자기소개서')
activateUserStorage('student-user-b')
if (userLocalStorage.getItem('iv_cover_draft') !== null) fail('다른 사용자의 초안이 노출됨')
userLocalStorage.setItem('iv_cover_draft', 'B의 자기소개서')

activateUserStorage('student-user-a')
if (userLocalStorage.getItem('iv_cover_draft') !== 'A의 자기소개서') fail('A의 저장 공간을 다시 불러오지 못함')
clearUserStorage()
if (userLocalStorage.getItem('iv_cover_draft') !== null) fail('A의 기기 사본이 삭제되지 않음')
activateUserStorage('student-user-b')
if (userLocalStorage.getItem('iv_cover_draft') !== 'B의 자기소개서') fail('A 삭제가 B의 자료까지 지움')
deactivateUserStorage()

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const personalFiles = [
  'src/lib/localFirst.js',
  'src/lib/subjectProgress.js',
  'src/lib/unitProgress.js',
  'src/screens/student/InterviewCareerLab.jsx',
  'src/screens/student/InterviewStudyScreen.jsx',
  'src/screens/student/DiagnosticScreen.jsx',
]
for (const path of personalFiles) {
  if (!read(path).includes('userLocalStorage as localStorage')) fail(`${path}가 사용자별 저장소를 사용하지 않음`)
}

const trial = read('src/lib/trialSession.js')
if (trial.includes('localStorage.clear()')) fail('체험 종료가 공용 브라우저 전체 저장소를 삭제함')
const lifecycle = read('src/lib/sessionLifecycle.js')
if (!lifecycle.includes('syncDeviceState()') || !lifecycle.includes('syncResult?.ok')) fail('로그아웃 전 동기화 또는 성공 확인이 없음')
const migration = read('supabase/migrations/20260827090000_user_device_state.sql')
for (const contract of ['enable row level security', 'user_id = auth.uid()', 'rpc_sync_user_device_state', 'public_trial_read_only']) {
  if (!migration.includes(contract)) fail(`기기 동기화 DB 계약 누락: ${contract}`)
}

if (!process.exitCode) console.log('[공용 PC 격리] 통과 - 사용자별 저장·선택 삭제·동기화 후 로그아웃·RLS 확인')
