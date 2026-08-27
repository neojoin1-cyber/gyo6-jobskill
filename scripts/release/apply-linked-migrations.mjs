import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, logPass, parseJsonOutput, runSupabase } from './release-utils.mjs'

const BASELINE = '20260823120000'
const apply = process.argv.includes('--apply')
const migrationDir = resolve(ROOT, 'supabase/migrations')

function readRemoteVersions() {
  const sql = 'select version from supabase_migrations.schema_migrations order by version'
  const { stdout } = runSupabase(['db', 'query', '--linked', '--output-format', 'json', sql])
  const result = parseJsonOutput(stdout, '원격 마이그레이션')
  return new Set((result.rows ?? []).map(row => String(row.version)))
}

const migrations = readdirSync(migrationDir)
  .map(name => ({ name, version: name.match(/^(\d+)_/)?.[1] }))
  .filter(item => item.version?.length === 14 && item.version >= BASELINE && item.name.endsWith('.sql'))
  .sort((a, b) => a.version.localeCompare(b.version))

const duplicates = migrations.filter((item, index) => migrations.findIndex(other => other.version === item.version) !== index)
if (duplicates.length) throw new Error(`중복 마이그레이션 버전: ${[...new Set(duplicates.map(item => item.version))].join(', ')}`)

let remote = readRemoteVersions()
const pending = migrations.filter(item => !remote.has(item.version))

if (pending.length && !apply) {
  throw new Error(`운영 적용 대기 마이그레이션 ${pending.length}개: ${pending.map(item => item.name).join(', ')} (--apply 필요)`)
}

for (const item of pending) {
  console.log(`[출시 자동검증] 운영 마이그레이션 적용 - ${item.name}`)
  runSupabase(['db', 'query', '--linked', '--file', resolve(migrationDir, item.name)])
  runSupabase(['migration', 'repair', '--linked', '--status', 'applied', item.version, '--yes'])
}

remote = readRemoteVersions()
const missing = migrations.filter(item => !remote.has(item.version))
if (missing.length) throw new Error(`운영 이력 확인 실패: ${missing.map(item => item.name).join(', ')}`)

const guardSql = `
select
  c.relrowsecurity as rls_enabled,
  position('1500000' in pg_get_functiondef(p.oid)) > 0 as batch_limit,
  position('400000' in pg_get_functiondef(p.oid)) > 0 as item_limit
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_class c on c.relname = 'user_device_state'
where n.nspname = 'public' and p.proname = 'rpc_sync_user_device_state'
limit 1`
const guardResult = parseJsonOutput(
  runSupabase(['db', 'query', '--linked', '--output-format', 'json', guardSql]).stdout,
  '동기화 DB 보호장치',
)
const guard = guardResult.rows?.[0]
if (!guard?.rls_enabled || !guard?.batch_limit || !guard?.item_limit) {
  throw new Error('운영 DB의 RLS 또는 동기화 요청량 보호장치가 완전하지 않습니다.')
}

logPass(`운영 마이그레이션 ${pending.length ? `${pending.length}개 적용` : '최신 상태'} · RLS/요청량 상한 확인`)
