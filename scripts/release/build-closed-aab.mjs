import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { gradleEnv, ROOT, logPass, run, runNpm } from './release-utils.mjs'

const skipSync = process.argv.includes('--skip-sync')
const outDir = resolve(ROOT, 'release/closed')
mkdirSync(outDir, { recursive: true })

const releaseEntries = readdirSync(outDir)
  .filter(name => name.endsWith('.aab.release.json'))
  .map(name => {
    try {
      return { name, metadata: JSON.parse(readFileSync(resolve(outDir, name), 'utf8')) }
    } catch {
      return null
    }
  })
  .filter(Boolean)

const latestPublishedBuild = Math.max(0, ...releaseEntries
  .filter(entry => entry.metadata.playPublished)
  .map(entry => Number(entry.metadata.build) || 0))
const pendingReleases = releaseEntries.filter(entry => (
  entry.metadata.playSubmitted
  && !entry.metadata.playPublished
  && !entry.metadata.playSuperseded
  && Number(entry.metadata.build) > latestPublishedBuild
))

if (pendingReleases.length) {
  const details = pendingReleases
    .map(({ name, metadata }) => `${name} (v${metadata.version}, build ${metadata.build})`)
    .join(', ')
  throw new Error(
    `이전 비공개 테스트 제출이 아직 마감되지 않았습니다: ${details}\n`
    + 'Play에서 제공 중이면 closed:finalize -- --play-published, 반려·대체되었으면 --play-superseded로 먼저 마감하세요.',
  )
}

const keystore = resolve(ROOT, 'android/app/jobhigh-release.jks')
const properties = resolve(ROOT, 'android/keystore.properties')
if (!existsSync(keystore) || !existsSync(properties)) {
  throw new Error('비공개 테스트용 서명 키가 없습니다. GitHub에는 키를 올리지 않고 로컬에서만 AAB를 만듭니다.')
}

if (!skipSync) runNpm(['run', 'android:sync'], { stdio: 'inherit' })

const gradle = resolve(ROOT, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'sh'
const args = process.platform === 'win32'
  ? ['/d', '/c', `${gradle} app:bundleRelease --no-daemon`]
  : [gradle, 'app:bundleRelease', '--no-daemon']
run(command, args, { cwd: resolve(ROOT, 'android'), env: gradleEnv(), stdio: 'inherit' })

const source = resolve(ROOT, 'android/app/build/outputs/bundle/release/app-release.aab')
if (!existsSync(source)) throw new Error('서명된 비공개 테스트 AAB를 찾지 못했습니다.')

const packagedManifest = resolve(ROOT, 'android/app/build/intermediates/packaged_manifests/release/processReleaseManifestForPackage/AndroidManifest.xml')
if (!existsSync(packagedManifest)) throw new Error('AAB의 실제 버전 정보를 담은 AndroidManifest.xml을 찾지 못했습니다.')
const manifestSource = readFileSync(packagedManifest, 'utf8')
const build = Number(manifestSource.match(/android:versionCode=["'](\d+)["']/)?.[1])
const versionName = manifestSource.match(/android:versionName=["']([^"']+)["']/)?.[1]
const packageName = manifestSource.match(/\bpackage=["']([^"']+)["']/)?.[1]
if (!Number.isInteger(build) || build < 1 || !/^\d+\.\d+\.\d+$/.test(versionName || '') || packageName !== 'com.gyo6.jobskill') {
  throw new Error('AAB 실제 버전 또는 패키지 정보를 확인하지 못했습니다.')
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
const target = resolve(outDir, `JOBGO-v${versionName}-closed-${stamp}.aab`)
copyFileSync(source, target)
const digest = createHash('sha256').update(readFileSync(target)).digest('hex')
writeFileSync(`${target}.sha256`, `${digest}  ${target.split(/[\\/]/).pop()}\n`)
writeFileSync(`${target}.release.json`, `${JSON.stringify({
  packageName,
  track: 'closed',
  build,
  version: versionName,
  aab: target.split(/[\\/]/).pop(),
  sha256: digest,
  builtAt: new Date().toISOString(),
  playSubmitted: false,
  playPublished: false,
}, null, 2)}\n`)

logPass(`서명된 비공개 테스트 AAB 생성 · build ${build} · v${versionName} · ${target}`)
