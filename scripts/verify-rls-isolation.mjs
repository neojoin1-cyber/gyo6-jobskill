import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function loadEnv(path) {
  if (!fs.existsSync(path)) return {}
  return Object.fromEntries(fs.readFileSync(path, 'utf8').split(/\r?\n/).map(line => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    return match ? [match[1], match[2].replace(/^['"]|['"]$/g, '')] : null
  }).filter(Boolean))
}

const env = loadEnv('.env.local')
const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
if (!url || !anon) throw new Error('Supabase public environment is missing')

async function login(role) {
  const response = await fetch(`${url}/functions/v1/public-trial-session`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:7700' },
    body: JSON.stringify({ role, deviceId: randomUUID() }),
  })
  const ticket = await response.json()
  if (!response.ok || !ticket.tokenHash) throw new Error(`${role} trial ticket failed (${response.status})`)
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.verifyOtp({ token_hash: ticket.tokenHash, type: 'magiclink' })
  if (error || !data.user) throw new Error(`${role} trial OTP failed: ${error?.message || 'no user'}`)
  return { client, user: data.user }
}

function assertBlocked(result, label) {
  if (result.error?.code === '42501') return
  if (Array.isArray(result.data) && result.data.length === 0) return
  if (result.data?.error === 'forbidden') return
  throw new Error(`${label} exposed data or returned an unexpected result: ${result.error?.code || JSON.stringify(result.data)}`)
}

const teacher = await login('teacher')
const student = await login('student')

assertBlocked(
  await student.client.from('profiles').select('id, display_name, role').eq('id', teacher.user.id),
  'student-to-teacher profile read',
)
assertBlocked(
  await student.client.from('cover_letter_submissions').select('id, student_id').neq('student_id', student.user.id).limit(1),
  'foreign cover-letter table read',
)
assertBlocked(
  await student.client.rpc('rpc_teacher_cover_letters', { p_class_id: null, p_limit: 10 }),
  'student-to-teacher review RPC',
)

const own = await student.client.rpc('rpc_my_cover_letters')
if (own.error || !Array.isArray(own.data)) {
  throw new Error(`own cover-letter RPC failed: ${own.error?.code || typeof own.data}`)
}

await student.client.auth.signOut({ scope: 'local' })
await teacher.client.auth.signOut({ scope: 'local' })
console.log('PASS: authenticated student cannot read a foreign profile, foreign cover letters, or teacher review RPC')
