import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(line => line && !line.trim().startsWith('#') && line.includes('='))
  .map(line => {
    const index = line.indexOf('=')
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
  }))
const endpoint = `${env.VITE_SUPABASE_URL}/functions/v1/public-trial-session`

for (const origin of ['https://localhost', 'capacitor://localhost']) {
  for (const role of ['student', 'teacher']) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: env.VITE_SUPABASE_ANON_KEY,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role, deviceId: randomUUID() }),
    })
    const ticket = await response.json().catch(() => ({}))
    if (!response.ok || response.headers.get('access-control-allow-origin') !== origin || !ticket.tokenHash) {
      throw new Error(`네이티브 체험 발급 실패: ${origin}/${role}/${response.status}`)
    }
    const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data, error } = await client.auth.verifyOtp({ token_hash: ticket.tokenHash, type: 'magiclink' })
    if (error || !data.user) throw new Error(`네이티브 체험 로그인 실패: ${origin}/${role}`)
    const metadata = data.user?.user_metadata
    const { data: profile, error: profileError } = await client
      .from('profiles').select('role').eq('id', data.user?.id).single()
    if (metadata?.is_public_trial !== true || metadata?.trial_role !== role || profileError || profile?.role !== role) {
      throw new Error(`네이티브 체험 역할 확인 실패: ${origin}/${role}`)
    }
    await client.auth.signOut()
    console.log(`PASS native trial ${origin} ${role}`)
  }
}
