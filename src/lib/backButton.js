/**
 * Android 하드웨어 뒤로가기 버튼 핸들러 스택
 * - pushBack(fn) : 화면 진입 시 핸들러 등록 → 고유 ID 반환
 * - popBack(id)  : 화면 이탈 시 해당 ID 핸들러 해제 (id 생략 시 최상단 pop)
 * ID 기반 관리로 useEffect 재실행 등 비대칭 push/pop 에서도 스택 안전성 보장.
 */
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

let _nextId = 0
const stack = []  // [{ id, fn }, ...]

export function pushBack(fn) {
  const id = ++_nextId
  stack.push({ id, fn })
  return id
}

export function popBack(id) {
  if (id !== undefined) {
    const i = stack.findIndex(h => h.id === id)
    if (i !== -1) stack.splice(i, 1)
  } else {
    stack.pop()
  }
}

if (Capacitor.isNativePlatform()) {
  App.addListener('backButton', () => {
    const top = stack[stack.length - 1]
    if (top) top.fn()
  })
}
