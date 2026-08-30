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
  'scripts/release/publish-app-config.mjs',
  'scripts/release/finalize-internal-release.mjs',
  '.github/workflows/internal-release-finalize.yml',
  'android/app/src/androidTest/java/com/gyo6/jobskill/ReleaseRecoveryInstrumentedTest.java',
  'supabase/migrations/20260827130000_release_verification_privileges.sql',
]
for (const path of requiredFiles) {
  if (!existsSync(path)) failures.push(`출시 자동검증 파일 누락: ${path}`)
}

const pkg = JSON.parse(read('package.json'))
for (const name of ['release:migrations', 'release:sync', 'release:android', 'release:verify', 'internal:aab', 'internal:test', 'internal:publish-config', 'internal:finalize']) {
  if (!pkg.scripts?.[name]) failures.push(`npm 명령 누락: ${name}`)
}
requireText(pkg.scripts?.prebuild ?? '', 'gate:release-automation', '일반 빌드에서 출시 자동화 연결 상태를 검사하지 않음')

const workflow = read('.github/workflows/deploy.yml')
for (const token of ['production-approval:', 'OPERATIONS_APPROVED', 'supabase link --project-ref', 'remote-preflight:', 'android-preflight:', 'release:migrations -- --apply', 'release:sync', 'release:android -- --skip-web-build', 'needs: [remote-preflight, android-preflight]']) {
  requireText(workflow, token, `GitHub 출시 게이트 누락: ${token}`)
}

const internal = read('.github/workflows/internal-test.yml')
for (const token of ['"codex/**"', 'supabase link --project-ref', 'release:sync', 'release:android -- --skip-web-build', 'actions/upload-artifact@v4']) {
  requireText(internal, token, `GitHub 내부 테스트 게이트 누락: ${token}`)
}

const publishConfig = read('scripts/release/publish-app-config.mjs')
for (const token of ['latest_build', 'latest_version', "projects', 'api-keys'", 'force-minimum']) {
  requireText(publishConfig, token, `내부 테스트 업데이트 안내 자동화 누락: ${token}`)
}

const app = read('src/App.jsx')
for (const token of [".from('app_config')", "'appStateChange'", "updateState === 'soft'", 'UpdateBanner', 'market://details?id=com.gyo6.jobskill']) {
  requireText(app, token, `Android 앱의 실행·복귀 업데이트 자동 안내 누락: ${token}`)
}

const buildAab = read('scripts/release/build-internal-aab.mjs')
for (const token of ['packaged_manifests', 'android:versionCode', '${target}.release.json', 'playPublished: false']) {
  requireText(buildAab, token, `내부 테스트 AAB 게시 메타데이터 누락: ${token}`)
}

const finalize = read('scripts/release/finalize-internal-release.mjs')
for (const token of ['--play-published', 'sha256', 'internal:publish-config', 'playPublished']) {
  requireText(finalize, token, `Play 게시 후 업데이트 안내 마감 자동화 누락: ${token}`)
}

const finalizeWorkflow = read('.github/workflows/internal-release-finalize.yml')
for (const token of ['workflow_dispatch:', 'play_published:', 'internal:publish-config', 'SUPABASE_ACCESS_TOKEN']) {
  requireText(finalizeWorkflow, token, `내부 테스트 업데이트 안내 워크플로 누락: ${token}`)
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
