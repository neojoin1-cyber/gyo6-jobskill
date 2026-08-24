/**
 * 지금 로그인한 사람의 id — **네트워크를 타지 않고** 가져온다.
 *
 * 여기저기서 `supabase.auth.getUser()` 를 쓰고 있었다. 이 호출은 이름과
 * 달리 로컬 값을 읽는 게 아니라 **매번 인증 서버(/auth/v1/user)로 왕복**한다.
 * 간격반복 기록(srs.js)이 문항마다 이걸 불렀으니, 학생이 30문항을 채점하면
 * 인증 서버로만 30번을 다녀왔다. 동시 접속이 수만이면 앱 서버가 아니라
 * **인증 서버가 먼저 무릎을 꿇는다.**
 *
 * getSession() 은 로컬 저장소의 세션을 읽고 만료됐을 때만 갱신한다. 그것을
 * 한 번 읽어 캐시하고, 로그인·로그아웃 때만 갱신한다.
 */
import { supabase } from './supabase.js'

let cachedId = null
let pending = null
let bound = false

function bindOnce() {
  if (bound) return
  bound = true
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedId = session?.user?.id ?? null
    pending = null
  })
}

/** @returns {Promise<string|null>} 로그인 안 했으면 null */
export async function currentUserId() {
  bindOnce()
  if (cachedId) return cachedId
  if (!pending) {
    pending = supabase.auth.getSession()
      .then(({ data }) => { cachedId = data?.session?.user?.id ?? null; return cachedId })
      .catch(() => null)
      .finally(() => { pending = null })
  }
  return pending
}
