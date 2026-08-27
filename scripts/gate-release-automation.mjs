import { existsSync, readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const failures = []
const requireText = (source, token, message) => {
  if (!source.includes(token)) failures.push(message)
}

const requiredFiles = [
  '.github/workflows/internal-test.yml',
  'scripts/release/apply-linked-migrations.mjs',
  'scripts/release/verify-device-sync-remote.mjs',
  'scripts/release/verify-android-recovery.mjs',
  'scripts/release/build-internal-aab.mjs',
  'android/app/src/androidTest/java/com/gyo6/jobskill/ReleaseRecoveryInstrumentedTest.java',
  'supabase/migrations/20260827130000_release_verification_privileges.sql',
]
for (const path of requiredFiles) {
  if (!existsSync(path)) failures.push(`출시 자동검증 파일 누락: ${path}`)
}

const pkg = JSON.parse(read('package.json'))
for (const name of ['release:migrations', 'release:sync', 'release:android', 'release:verify', 'internal:aab', 'internal:test']) {
  if (!pkg.scripts?.[name]) failures.push(`npm 명령 누락: ${name}`)
}
requireText(pkg.scripts?.prebuild ?? '', 'gate:release-automation', '일반 빌드에서 출시 자동화 연결 상태를 검사하지 않음')

const workflow = read('.github/workflows/deploy.yml')
for (const token of ['production-approval:', 'OPERATIONS_APPROVED', 'supabase link --project-ref', 'remote-preflight:', 'android-preflight:', 'release:migrations -- --apply', 'release:sync', 'release:android -- --skip-web-build', 'needs: [remote-preflight, android-preflight]']) {
  requireText(workflow, token, `GitHub 출시 게이트 누락: ${token}`)
}

const internal = read('.github/workflows/internal-test.yml')
for (const token of ['"codex/**"', 'supabase link --project-ref', 'release:migrations', 'release:sync', 'release:android -- --skip-web-build', 'actions/upload-artifact@v4']) {
  requireText(internal, token, `GitHub 내부 테스트 게이트 누락: ${token}`)
}

const sync = read('scripts/release/verify-device-sync-remote.mjs')
for (const token of ['createUser', 'release.pc.progress', 'release.mobile.draft', 'release.shared.answer', '1_500_100', 'deleteUser']) {
  requireText(sync, token, `운영 교차 동기화 시나리오 누락: ${token}`)
}

const android = read('scripts/release/verify-android-recovery.mjs')
for (const token of ['assembleDebugAndroidTest', 'am', 'force-stop', 'React app painted; native boot guard released', 'emu', 'kill']) {
  requireText(android, token, `Android 종료·복구 시나리오 누락: ${token}`)
}

const inspected = requiredFiles.filter(existsSync).map(read).join('\n')
if (/eyJhbGciOi|sb_secret_[A-Za-z0-9_-]{12,}/.test(inspected)) failures.push('출시 자동화 소스에 실제 비밀키로 보이는 값이 포함됨')

if (failures.length) {
  failures.forEach(message => console.error(`[출시 자동화] 실패 - ${message}`))
  process.exit(1)
}

console.log('[출시 자동화] 통과 - 운영 마이그레이션·PC↔휴대폰·Android 종료복구·CI 차단 연결')
