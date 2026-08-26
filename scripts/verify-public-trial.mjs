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

const deviceId = randomUUID()
const endpoint = `${url}/functions/v1/public-trial-session`
const headers = { apikey: anon, 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:7700' }
const issue = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ role: 'student', deviceId }) })
const ticket = await issue.json()
if (!issue.ok || !ticket.tokenHash) throw new Error(`Trial ticket failed (${issue.status}): ${ticket.message || 'no token'}`)

const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
const { data: auth, error: authError } = await client.auth.verifyOtp({ token_hash: ticket.tokenHash, type: 'magiclink' })
if (authError || !auth.user) throw new Error(`Trial OTP failed: ${authError?.message || 'no user'}`)
if (auth.user.user_metadata?.is_public_trial !== true || auth.user.user_metadata?.trial_role !== 'student') {
  throw new Error('Trial identity metadata is missing')
}

const { data: profile, error: profileError } = await client.from('profiles').select('id, role, display_name').eq('id', auth.user.id).single()
if (profileError || profile?.role !== 'student') throw new Error(`Trial profile read failed: ${profileError?.message || profile?.role}`)

const { error: writeError } = await client.from('profiles').update({ display_name: profile.display_name }).eq('id', profile.id)
if (writeError?.code !== '42501') throw new Error(`Trial write was not blocked: ${writeError?.code || 'no error'}`)

const repeat = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ role: 'student', deviceId }) })
if (repeat.status !== 429) throw new Error(`Trial cooldown was not enforced: ${repeat.status}`)

await client.auth.signOut({ scope: 'local' })
console.log('PASS: public trial one-time token, identity metadata, read access, server write block, and cooldown')
