import { createClient } from '@supabase/supabase-js'
import { getProjectRef, loadLocalEnv, logPass, parseJsonOutput, runSupabase } from './release-utils.mjs'

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3)
const build = Number(arg('build'))
const version = String(arg('version') || '').trim()
const forceMinimum = process.argv.includes('--force-minimum')

if (!Number.isInteger(build) || build < 1) throw new Error('--build=<Play 버전 코드>가 필요합니다.')
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('--version=<표시 버전>이 필요합니다.')

const env = { ...loadLocalEnv(), ...process.env }
const url = env.VITE_SUPABASE_URL
if (!url) throw new Error('VITE_SUPABASE_URL이 필요합니다.')

const apiKeys = parseJsonOutput(
  runSupabase(['projects', 'api-keys', '--project-ref', getProjectRef(), '--reveal', '--output', 'json']).stdout,
  'Supabase API 키',
)
const serviceKey = apiKeys.find(key => key.name === 'service_role')?.api_key
  ?? apiKeys.find(key => key.type === 'secret')?.api_key
if (!serviceKey) throw new Error('운영 app_config를 갱신할 service role 키를 찾지 못했습니다.')

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const { data: current, error: readError } = await admin.from('app_config').select('min_build,latest_build').eq('key', 'android').maybeSingle()
if (readError) throw new Error(`현재 앱 버전 조회 실패: ${readError.message}`)
if (Number(current?.latest_build || 0) > build) throw new Error(`운영 최신 빌드 ${current.latest_build}보다 낮은 ${build}로 되돌릴 수 없습니다.`)

const payload = {
  key: 'android',
  latest_build: build,
  latest_version: version,
  store_url: 'market://details?id=com.gyo6.jobskill',
  min_build: forceMinimum ? build : Number(current?.min_build || 1),
}
const { error } = await admin.from('app_config').upsert(payload)
if (error) throw new Error(`운영 앱 버전 갱신 실패: ${error.message}`)

const { data: verified, error: verifyError } = await admin.from('app_config').select('min_build,latest_build,latest_version,store_url').eq('key', 'android').single()
if (verifyError || verified.latest_build !== build || verified.latest_version !== version) throw new Error(`운영 앱 버전 재확인 실패: ${verifyError?.message || '값 불일치'}`)

logPass(`업데이트 안내 운영값 · latest_build ${build} · v${version}${forceMinimum ? ' · 강제 업데이트' : ''}`)
