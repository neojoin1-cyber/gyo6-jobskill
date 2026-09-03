import { existsSync, readdirSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { gradleEnv, logPass, run, runNpm, ROOT } from './release-utils.mjs'

const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms))
const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME
  || (process.platform === 'win32' ? join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk') : join(homedir(), 'Android', 'Sdk'))
const executable = name => join(sdk, name + (process.platform === 'win32' ? '.exe' : ''))
const adb = executable(join('platform-tools', 'adb'))
const emulator = executable(join('emulator', 'emulator'))
const gradle = resolve(ROOT, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
const appId = 'com.gyo6.jobskill'
let startedEmulator = null

for (const [label, path] of [['adb', adb], ['emulator', emulator], ['Gradle wrapper', gradle]]) {
  if (!existsSync(path)) throw new Error(`${label}을 찾지 못했습니다: ${path}`)
}

function adbRun(serial, args, options) {
  return run(adb, ['-s', serial, ...args], options)
}

function onlineEmulator() {
  const { stdout } = run(adb, ['devices'])
  return stdout.split(/\r?\n/).map(line => line.match(/^(emulator-\d+)\s+device$/)?.[1]).find(Boolean)
}

async function ensureEmulator() {
  const current = onlineEmulator()
  if (current) return current
  const avds = run(emulator, ['-list-avds']).stdout.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
  if (!avds.length) throw new Error('Android 자동검증용 AVD가 없습니다.')
  console.log(`[출시 자동검증] Android 에뮬레이터 시작 - ${avds[0]}`)
  const child = spawn(emulator, ['-avd', avds[0], '-no-window', '-no-boot-anim', '-no-snapshot-save', '-gpu', 'swiftshader_indirect'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
  const deadline = Date.now() + 240_000
  while (Date.now() < deadline) {
    await sleep(2000)
    const serial = onlineEmulator()
    if (!serial) continue
    const booted = adbRun(serial, ['shell', 'getprop', 'sys.boot_completed']).stdout.trim()
    if (booted === '1') {
      startedEmulator = serial
      return serial
    }
  }
  throw new Error('Android 에뮬레이터가 4분 안에 부팅되지 않았습니다.')
}

process.on('exit', () => {
  if (startedEmulator) spawnSync(adb, ['-s', startedEmulator, 'emu', 'kill'], { stdio: 'ignore' })
})

const skipWebBuild = process.argv.includes('--skip-web-build')
if (!skipWebBuild) runNpm(['run', 'android:sync'], { stdio: 'inherit' })
const serial = await ensureEmulator()

const gradleArgs = ['app:assembleDebug', 'app:assembleDebugAndroidTest', 'app:assembleRelease', '--no-daemon']
const gradleCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'sh'
const commandArgs = process.platform === 'win32'
  ? ['/d', '/c', `${gradle} ${gradleArgs.join(' ')}`]
  : [gradle, ...gradleArgs]
run(gradleCommand, commandArgs, {
  cwd: resolve(ROOT, 'android'),
  env: gradleEnv(),
  stdio: 'inherit',
  shell: false,
})

const appApk = resolve(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk')
const testDir = resolve(ROOT, 'android/app/build/outputs/apk/androidTest/debug')
const testApk = readdirSync(testDir).find(name => name.endsWith('.apk'))
if (!existsSync(appApk) || !testApk) throw new Error('Android 검증 APK를 찾지 못했습니다.')

spawnSync(adb, ['-s', serial, 'uninstall', `${appId}.test`], { stdio: 'ignore' })
spawnSync(adb, ['-s', serial, 'uninstall', appId], { stdio: 'ignore' })
adbRun(serial, ['install', '-r', appApk])
adbRun(serial, ['install', '-r', resolve(testDir, testApk)])
const instrument = adbRun(serial, ['shell', 'am', 'instrument', '-w', `${appId}.test/androidx.test.runner.AndroidJUnitRunner`], { maxBuffer: 16 * 1024 * 1024 })
if (!instrument.stdout.includes('OK (')) throw new Error(`Android 로컬 저장 복구 계측 실패\n${instrument.stdout}`)

async function verifyLaunchCycles(serial, label, cycles = 2) {
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    adbRun(serial, ['shell', 'am', 'force-stop', appId])
    adbRun(serial, ['logcat', '-c'])
    const launch = adbRun(serial, ['shell', 'am', 'start', '-W', '-n', `${appId}/.MainActivity`]).stdout
    // A cold WebView start can outlive ActivityManager's own -W timeout even
    // though the activity keeps starting normally. The process, crash log and
    // boot-guard checks below remain the authoritative readiness checks.
    if (!/Status:\s*(?:ok|timeout)/i.test(launch)) {
      throw new Error(`Android ${label} ${cycle}차 재실행 실패\n${launch}`)
    }
    const deadline = Date.now() + 60_000
    let ready = false
    while (Date.now() < deadline) {
      await sleep(1000)
      const pid = adbRun(serial, ['shell', 'pidof', appId]).stdout.trim()
      if (!pid) throw new Error(`Android ${label} ${cycle}차 재실행 후 프로세스가 종료됐습니다.`)
      const logs = adbRun(serial, ['logcat', '-d', '-t', '500']).stdout
      if (/FATAL EXCEPTION|Process: com\.gyo6\.jobskill[\s\S]*AndroidRuntime/i.test(logs)) {
        throw new Error(`Android ${label} ${cycle}차 재실행에서 치명적 오류가 발견됐습니다.`)
      }
      if (/Gyo6BootGuard.*React app painted; native boot guard released/.test(logs)) {
        ready = true
        break
      }
    }
    if (!ready) throw new Error(`Android ${label} ${cycle}차 재실행에서 학습 화면 준비 완료를 확인하지 못했습니다.`)
  }
}

await verifyLaunchCycles(serial, 'Debug')

const releaseApk = resolve(ROOT, 'android/app/build/outputs/apk/release/app-release.apk')
if (!existsSync(releaseApk)) throw new Error('서명된 Android Release APK를 찾지 못했습니다.')
adbRun(serial, ['uninstall', appId])
adbRun(serial, ['install', releaseApk])
await verifyLaunchCycles(serial, '서명 Release')

adbRun(serial, ['shell', 'am', 'force-stop', appId])
logPass(`Android Debug 계측 · 서명 Release 최초실행 · 강제종료/재실행 (${serial})`)
