import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'

export const ROOT = resolve(import.meta.dirname, '../..')

export function loadLocalEnv() {
  const values = {}
  try {
    const source = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match || match[1].startsWith('#')) continue
      values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  } catch {
    // CI supplies these values through environment variables.
  }
  return values
}

export function getProjectRef() {
  if (process.env.SUPABASE_PROJECT_ID) return process.env.SUPABASE_PROJECT_ID.trim()
  try {
    return readFileSync(resolve(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim()
  } catch {
    throw new Error('SUPABASE_PROJECT_ID 또는 supabase/.temp/project-ref가 필요합니다.')
  }
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`${command} ${args.join(' ')} 실패${details ? `\n${details}` : ''}`)
  }
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

export function runSupabase(args, options) {
  if (process.env.SUPABASE_CLI) return run(process.env.SUPABASE_CLI, args, options)
  if (process.platform === 'win32' && process.env.APPDATA) {
    const cli = join(process.env.APPDATA, 'npm', 'node_modules', 'supabase', 'dist', 'supabase.js')
    return run(process.execPath, [cli, ...args], options)
  }
  return run('supabase', args, options)
}

export function runNpm(args, options) {
  if (process.platform !== 'win32') return run('npm', args, options)
  const cli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  return run(process.execPath, [cli, ...args], options)
}

export function gradleEnv() {
  const probe = spawnSync('java', ['-XshowSettings:properties', '-version'], {
    encoding: 'utf8',
    shell: false,
  })
  const output = `${probe.stdout ?? ''}\n${probe.stderr ?? ''}`
  const version = output.match(/^\s*java\.version\s*=\s*(\S+)/m)?.[1]
  const javaHome = output.match(/^\s*java\.home\s*=\s*(.+)$/m)?.[1]?.trim()
  const major = Number(version?.match(/^(?:1\.)?(\d+)/)?.[1])
  if (probe.status !== 0 || !javaHome || !Number.isFinite(major) || major < 21) {
    throw new Error('Android 빌드에는 PATH에서 실행 가능한 Java 21 이상이 필요합니다.')
  }
  return { ...process.env, JAVA_HOME: javaHome }
}

export function parseJsonOutput(output, label) {
  const start = Math.min(...['{', '[']
    .map(token => output.indexOf(token))
    .filter(index => index >= 0))
  if (!Number.isFinite(start)) throw new Error(`${label} JSON 응답을 찾지 못했습니다.`)
  try {
    return JSON.parse(output.slice(start))
  } catch (error) {
    throw new Error(`${label} JSON 해석 실패: ${error.message}`)
  }
}

export function logPass(message) {
  console.log(`[출시 자동검증] 통과 - ${message}`)
}
