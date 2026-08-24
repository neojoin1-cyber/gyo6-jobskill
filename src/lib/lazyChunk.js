import { lazy } from 'react'

/**
 * 화면 청크를 늦게 불러오되, **실패하면 스스로 회복한다.**
 *
 * 앱을 새로 배포하면 파일 이름의 해시가 바뀐다(`StudyScreen-D2eoP4RO.js` →
 * `StudyScreen-XXXX.js`). 그런데 학생이 앱을 켜 둔 채로 배포가 되면, 화면에
 * 떠 있는 것은 **옛 코드**다. 옛 코드는 사라진 옛 파일 이름을 부르고, 서버는
 * 404 를 준다. 화면이 하얗게 비고, 학생은 앱이 고장 났다고 생각한다.
 *
 * 실제로 그렇게 됐다. 새로 빌드한 뒤 열었더니 "학습하기"가 빈 화면이었고,
 * 콘솔에는 `Failed to fetch dynamically imported module` 만 남았다.
 *
 * 고치는 방법은 간단하다. **한 번 다시 받아 보고, 그래도 안 되면 새로고침.**
 * 새로고침하면 새 index 를 받아 새 파일 이름을 알게 되므로 그대로 이어진다.
 *
 * 새로고침이 되풀이되지 않도록 세션에 표시를 남긴다. 진짜 오프라인이라
 * 계속 실패하는 경우에는 무한 새로고침 대신 오류 화면이 뜨는 편이 낫다.
 */
export function lazyChunk(load, name = 'chunk') {
  return lazy(() =>
    load().catch(async (err) => {
      try {
        return await load()          // 순간적인 네트워크 끊김이면 이걸로 끝난다
      } catch {
        const key = `sst.reloaded.${name}`
        let already = false
        try { already = sessionStorage.getItem(key) === '1' } catch { /* 사생활 모드 */ }
        if (!already) {
          try { sessionStorage.setItem(key, '1') } catch { /* 무시 */ }
          // 낡은 서비스워커가 옛 파일을 붙들고 있으면 새로고침만으로는
          // 부족하다. 등록을 풀고 캐시를 비운 뒤 다시 받게 한다.
          try {
            const regs = await navigator.serviceWorker?.getRegistrations?.()
            await Promise.all((regs || []).map(r => r.unregister()))
            const keys = await caches?.keys?.()
            await Promise.all((keys || []).map(k => caches.delete(k)))
          } catch { /* 지원하지 않는 브라우저 */ }
          window.location.reload()
          // 새로고침이 시작될 때까지 화면을 비워 둔다
          return { default: () => null }
        }
        throw err
      }
    })
  )
}
