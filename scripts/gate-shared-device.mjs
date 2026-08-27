import { readFileSync } from 'node:fs'
import {
  activateUserStorage,
  clearUserStorage,
  deactivateUserStorage,
  getUserStorageMeta,
  markUserStorageSynced,
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

userLocalStorage.setItem('iv_interview_script_draft', '동기화 시작본')
const uploadAt = getUserStorageMeta().keys.iv_interview_script_draft.updatedAt
userLocalStorage.setItem('iv_interview_script_draft', '전송 중 추가 문장')
if (markUserStorageSynced('iv_interview_script_draft', uploadAt)) fail('전송 중 추가 입력을 이미 동기화된 것으로 표시함')
const latestMeta = getUserStorageMeta().keys.iv_interview_script_draft
if (latestMeta.syncedAt) fail('전송 중 추가 입력의 대기 상태가 사라짐')
if (!markUserStorageSynced('iv_interview_script_draft', latestMeta.updatedAt)) fail('최신 입력을 전송 완료로 표시하지 못함')
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
if (!lifecycle.includes('saveBeforeExit') || !lifecycle.includes('syncDeviceState()') || !lifecycle.includes('syncResult?.ok')) fail('종료·로그아웃 전 동기화 또는 성공 확인이 없음')
for (const contract of ['discardLocal', 'clearDevice && !saved.localCleared', 'blocked: true']) {
  if (!lifecycle.includes(contract)) fail(`공용 PC 오프라인 로그아웃 보호 누락: ${contract}`)
}
const app = read('src/App.jsx')
if (!app.includes("document.addEventListener('visibilitychange'") || !app.includes("window.addEventListener('beforeunload'") || !app.includes('getDeviceSyncStatus().dirty > 0')) fail('브라우저 숨김 저장 또는 변경 대기 이탈 경고가 없음')
if (!app.includes("profile?.role !== 'student'")) fail('교사·관리자까지 학생 요점정리를 갱신함')
const exitDialog = read('src/components/SaveExitDialog.jsx')
for (const contract of ['기기 자동 저장 완료', '저장 후 종료', '인터넷 연결 후 같은 계정으로 로그인하면 동기화합니다.', '기기 기록 삭제 후 로그아웃']) {
  if (!exitDialog.includes(contract)) fail(`저장 종료 안내 누락: ${contract}`)
}
const migration = read('supabase/migrations/20260827090000_user_device_state.sql')
for (const contract of ['enable row level security', 'user_id = auth.uid()', 'rpc_sync_user_device_state', 'public_trial_read_only']) {
  if (!migration.includes(contract)) fail(`기기 동기화 DB 계약 누락: ${contract}`)
}
const syncClient = read('src/lib/deviceSync.js')
for (const contract of ['LOCAL_ONLY_PATTERNS', 'iv_cover_evidence_cache', 'MAX_ITEM_BYTES', 'MAX_PAYLOAD_BYTES', 'pendingBytes', 'markUserStorageSynced', 'getUserStorageMeta().keys?.[row.key]']) {
  if (!syncClient.includes(contract)) fail(`저부하 동기화 계약 누락: ${contract}`)
}
const userStorage = read('src/lib/userLocalStorage.js')
for (const contract of ['syncedAt: updatedAt', 'markUserStorageSynced', 'previousAt && previousAt >= now']) {
  if (!userStorage.includes(contract)) fail(`동기화 중 추가 입력 보호 누락: ${contract}`)
}
const payloadGuard = read('supabase/migrations/20260827120000_device_sync_payload_guard.sql')
for (const contract of ['octet_length', '1500000', '400000', 'rpc_sync_user_device_state']) {
  if (!payloadGuard.includes(contract)) fail(`동기화 요청량 보호 누락: ${contract}`)
}
const summaries = read('src/lib/studySummaries.js')
for (const contract of [".select('key, data, updated_at')", ".gt('updated_at', since)", 'REFRESH_KEY']) {
  if (!summaries.includes(contract)) fail(`요점정리 증분 갱신 계약 누락: ${contract}`)
}
const studentShell = read('src/screens/student/StudentShell.jsx')
if (studentShell.includes('setInterval(check')) fail('학생별 수업 확인이 고정 간격 반복 조회임')
for (const contract of ['scheduleFallback', 'Math.random()', "document.addEventListener('visibilitychange'"]) {
  if (!studentShell.includes(contract)) fail(`학생 수업 확인 분산·즉시 갱신 계약 누락: ${contract}`)
}
const progress = read('src/lib/subjectProgress.js')
for (const contract of ['SYNCED_PROGRESS_KEY', 'persisted[subjectId] === signature', 'if (error) throw error']) {
  if (!progress.includes(contract)) fail(`과목 진행률 중복 전송 방지 계약 누락: ${contract}`)
}

if (!process.exitCode) console.log('[공용 PC 격리] 통과 - 사용자별 저장·선택 삭제·저장 후 종료·증분 콘텐츠·분산 수업 확인·진행률 중복 방지·RLS 확인')
