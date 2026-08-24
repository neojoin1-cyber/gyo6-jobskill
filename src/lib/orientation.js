/**
 * 화면 방향 — 교사 수업 모드용.
 *
 * ── 왜 필요한가 ───────────────────────────────────────────────────
 * 교실 프로젝터·전자칠판·모니터는 거의 전부 16:9 가로다. 세로로 만든
 * 화면을 그대로 회전만 시키면 좌우가 텅 비고 글씨는 그대로 작다. 그래서
 * **가로일 때 배치가 달라져야** 한다 — 회전이 아니라 다른 화면이다.
 *
 * ── 어떻게 잠그나 ─────────────────────────────────────────────────
 * 네이티브 플러그인을 새로 넣지 않는다. 브라우저 표준 ScreenOrientation
 * 은 **전체 화면일 때만** 방향을 잠글 수 있는데, 수업 투사는 어차피 전체
 * 화면으로 띄운다. 두 동작이 하나로 맞아떨어진다.
 *   전체 화면 → 가로 잠금 → (나갈 때) 잠금 해제 → 전체 화면 해제
 *
 * 잠금이 막히는 곳도 있다(데스크톱 브라우저, iOS 사파리). 그때는 전체
 * 화면만 되고 방향은 기기가 정한다 — 케이블로 연결한 큰 화면은 이미
 * 가로이므로 실제 수업에는 지장이 없다. 그래서 실패해도 조용히 넘어간다.
 */

/** 지금 가로인가. 잠금 여부와 무관하게 실제 배치 기준으로 판단한다. */
export function isLandscape() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia) return window.matchMedia('(orientation: landscape)').matches
  return window.innerWidth > window.innerHeight
}

/** 방향이 바뀌면 알려 준다. 해제 함수를 돌려준다. */
export function onOrientationChange(fn) {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia?.('(orientation: landscape)')
  const h = () => fn(isLandscape())
  // 셋 다 듣는다. 기기마다 무엇이 오는지가 다르다 — 안드로이드 웹뷰는
  // orientationchange 만 보내기도 하고, 데스크톱은 resize 만 보낸다.
  mq?.addEventListener?.('change', h)
  window.addEventListener('resize', h)
  window.addEventListener('orientationchange', h)
  return () => {
    mq?.removeEventListener?.('change', h)
    window.removeEventListener('resize', h)
    window.removeEventListener('orientationchange', h)
  }
}

/**
 * 전체 화면으로 띄우고 가로로 잠근다.
 * @returns {Promise<{full:boolean, locked:boolean}>} 무엇까지 됐는지 알려 준다.
 */
export async function enterProjection(el) {
  let full = false, locked = false
  try {
    if (!document.fullscreenElement && el?.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' })
    }
    full = !!document.fullscreenElement
  } catch { /* 브라우저가 막으면 전체 화면 없이 진행한다 */ }

  try {
    // 'landscape' 는 기기가 자연스러운 쪽(왼쪽/오른쪽)을 고르게 둔다.
    await screen.orientation?.lock?.('landscape')
    locked = true
  } catch { /* 데스크톱·iOS 는 잠글 수 없다. 케이블 화면은 이미 가로다 */ }

  return { full, locked }
}

/** 잠금을 풀고 전체 화면에서 나온다. 학생 화면은 다시 세로로 돌아가야 한다. */
export async function exitProjection() {
  try { screen.orientation?.unlock?.() } catch { /* 원래 안 잠겨 있었다 */ }
  try { if (document.fullscreenElement) await document.exitFullscreen() } catch { /* 이미 나왔다 */ }
}

/** 전체 화면 상태가 바뀌면 알려 준다(Esc 로 빠져나가는 경우 포함). */
export function onFullscreenChange(fn) {
  if (typeof document === 'undefined') return () => {}
  const h = () => fn(!!document.fullscreenElement)
  document.addEventListener('fullscreenchange', h)
  return () => document.removeEventListener('fullscreenchange', h)
}
