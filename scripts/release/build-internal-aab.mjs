import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { gradleEnv, ROOT, logPass, run, runNpm } from './release-utils.mjs'

const skipSync = process.argv.includes('--skip-sync')
const keystore = resolve(ROOT, 'android/app/jobhigh-release.jks')
const properties = resolve(ROOT, 'android/keystore.properties')
if (!existsSync(keystore) || !existsSync(properties)) {
  throw new Error('내부 테스트용 서명 키가 없습니다. GitHub에는 키를 올리지 않고 로컬에서만 AAB를 만듭니다.')
}

if (!skipSync) runNpm(['run', 'android:sync'], { stdio: 'inherit' })

const gradle = resolve(ROOT, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'sh'
const args = process.platform === 'win32'
  ? ['/d', '/c', `${gradle} app:bundleRelease --no-daemon`]
  : [gradle, 'app:bundleRelease', '--no-daemon']
run(command, args, { cwd: resolve(ROOT, 'android'), env: gradleEnv(), stdio: 'inherit' })

const source = resolve(ROOT, 'android/app/build/outputs/bundle/release/app-release.aab')
if (!existsSync(source)) throw new Error('서명된 내부 테스트 AAB를 찾지 못했습니다.')

const outDir = resolve(ROOT, 'release/internal')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
const target = resolve(outDir, `KBS-NOVA-internal-${stamp}.aab`)
copyFileSync(source, target)
const digest = createHash('sha256').update(readFileSync(target)).digest('hex')
writeFileSync(`${target}.sha256`, `${digest}  ${target.split(/[\\/]/).pop()}\n`)

logPass(`서명된 내부 테스트 AAB 생성 · ${target}`)
