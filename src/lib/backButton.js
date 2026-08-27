/**
 * 앱 전체 뒤로가기 핸들러 스택.
 *
 * Android 하드웨어 버튼과 PC 브라우저 버튼이 같은 최상위 핸들러를 호출한다.
 * 화면 안의 단계가 남아 있으면 한 단계만 되돌리고, 단계가 끝난 뒤에만 상위
 * 화면으로 빠져나간다. 브라우저에서는 같은 URL의 guard history를 사용하므로
 * 상태 기반 React 화면도 주소가 없는 앱처럼 갑자기 첫 화면으로 이동하지 않는다.
 */
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

let _nextId = 0
const stack = []  // [{ id, fn }, ...]
const WEB_BACK_KEY = '__sugarSaltBackId'
let suppressWebPop = 0

function isWeb() {
  return !Capacitor.isNativePlatform() && typeof window !== 'undefined' && Boolean(window.history)
}

function currentWebBackId() {
  return isWeb() ? window.history.state?.[WEB_BACK_KEY] : null
}

function pushWebGuard(id) {
  if (!isWeb() || currentWebBackId() === id) return
  window.history.pushState({ ...(window.history.state || {}), [WEB_BACK_KEY]: id }, '', window.location.href)
}

function topHandler() {
  return stack[stack.length - 1] || null
}

export function pushBack(fn) {
  const id = ++_nextId
  stack.push({ id, fn })
  pushWebGuard(id)
  return id
}

export function popBack(id) {
  let removed = null
  if (id !== undefined) {
    const i = stack.findIndex(h => h.id === id)
    if (i !== -1) removed = stack.splice(i, 1)[0]
  } else {
    removed = stack.pop()
  }

  // 화면의 화살표로 빠져나온 경우 현재 guard도 함께 걷어 낸다. 다음 popstate는
  // 정리 과정일 뿐이므로 상위 화면을 한 번 더 닫지 않는다.
  if (removed && isWeb() && currentWebBackId() === removed.id) {
    suppressWebPop += 1
    window.history.back()
  }
}

/** 화면 안에 있는 공통 '이전' 버튼이 현재 최상위 단계를 실행할 때 사용한다. */
export function triggerBack() {
  const top = topHandler()
  if (top) top.fn()
  return Boolean(top)
}

if (Capacitor.isNativePlatform()) {
  App.addListener('backButton', () => {
    triggerBack()
  })
} else if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (suppressWebPop > 0) {
      suppressWebPop -= 1
      return
    }
    const handled = topHandler()
    if (!handled) return
    handled.fn()

    // 같은 컴포넌트 안에서 단원→영역처럼 한 단계만 바뀌었다면 다음 PC
    // 뒤로가기도 다시 잡을 수 있게 guard를 재설정한다. 화면이 언마운트됐다면
    // 그 사이 스택 최상단이 바뀌므로 새 최상단에 맞춰진다.
    queueMicrotask(() => {
      const next = topHandler()
      if (next) pushWebGuard(next.id)
    })
  })
}
