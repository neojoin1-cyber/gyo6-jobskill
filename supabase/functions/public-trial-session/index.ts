import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ACCOUNTS: Record<string, string> = {
  student: 'demo.student@sugarsalt.kr',
  teacher: 'demo.teacher@sugarsalt.kr',
  school_admin: 'demo.admin@sugarsalt.kr',
}

const ALLOWED_ORIGINS = new Set([
  'https://gyo6.kr',
  'https://www.gyo6.kr',
  'https://neojoin1-cyber.github.io',
  'http://127.0.0.1:7700',
  'http://127.0.0.1:7717',
  'http://localhost:7700',
])

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://gyo6.kr'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async request => {
  const origin = request.headers.get('origin')
  const headers = cors(origin)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return json({ message: '허용되지 않은 요청입니다.' }, 405, headers)
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ message: '허용되지 않은 접속 경로입니다.' }, 403, headers)

  try {
    const { role, deviceId } = await request.json()
    if (!ACCOUNTS[role] || typeof deviceId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(deviceId)) {
      return json({ message: '체험 요청 정보가 올바르지 않습니다.' }, 400, headers)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ip = request.headers.get('cf-connecting-ip') || forwarded || 'unknown'
    const [deviceHash, ipHash] = await Promise.all([
      sha256(`${serviceKey}:device:${deviceId}`),
      sha256(`${serviceKey}:network:${ip}`),
    ])

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: claim, error: claimError } = await admin.rpc('claim_public_trial_session', {
      p_device_hash: deviceHash,
      p_ip_hash: ipHash,
      p_role: role,
    })
    if (claimError) throw claimError
    if (!claim?.allowed) {
      const message = claim?.reason === 'network_limit'
        ? '이 접속망의 공개 체험 이용 한도에 도달했습니다. 학교 도입 상담을 이용해 주세요.'
        : '이 역할의 체험은 한 시간 뒤 다시 이용할 수 있습니다.'
      return json({ message, nextAllowedAt: claim?.nextAllowedAt || null }, 429, headers)
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: ACCOUNTS[role],
    })
    const tokenHash = link?.properties?.hashed_token
    if (linkError || !tokenHash) throw linkError || new Error('One-time token was not generated')

    return json({ tokenHash, expiresInSeconds: 900 }, 200, headers)
  } catch (error) {
    console.error('public-trial-session failed', error)
    return json({ message: '체험 연결을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 500, headers)
  }
})
