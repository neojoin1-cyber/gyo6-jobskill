/**
 * 교사 화면 배치 — 세로냐 가로냐를 교사가 고른다.
 *
 * ── 왜 자동 감지로는 부족한가 ─────────────────────────────────────
 * 기기가 가로인지 세로인지만 보고 정하면 두 경우가 어긋난다.
 *
 *   태블릿을 세로로 든 채 HDMI 로 프로젝터에 물린 교사
 *     → 기기는 세로지만 나가는 화면은 가로다. 세로 배치로 띄우면 좌우가 빈다.
 *   PC 브라우저를 반만 열어 둔 교사
 *     → 창은 가로지만 좁다. 두 칸으로 나누면 글자가 뭉개진다.
 *
 * 그래서 **교사가 고른다.** 고른 값은 기기에 남아 다음에 열 때도 같다.
 *
 * ── 세 가지 값 ────────────────────────────────────────────────────
 *   auto   기기 방향을 따른다 (처음 값)
 *   tall   세로 — 학생 앱과 같은 한 칸. 폰으로 들고 다닐 때.
 *   wide   가로 — 여러 칸으로 펼친다. 큰 화면에 물렸을 때.
 *
 * 고른 값은 `<html data-teacher-view="wide">` 로 붙는다. 배치는 CSS 가
 * 그 표시를 보고 바꾼다 — 자바스크립트가 폭을 재서 옮기지 않는다.
 */
import { isLandscape, onOrientationChange } from './orientation.js'

const KEY = 'teacher-view'
const listeners = new Set()

let choice = read()

function read() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'wide' || v === 'tall' ? v : 'auto'
  } catch { return 'auto' }
}

/** 실제로 어느 배치인가. auto 면 기기 방향이 답이다. */
export function effectiveView() {
  const width = typeof window === 'undefined' ? 0 : window.innerWidth
  // 넓게 보기를 저장했더라도 좁은 세로 화면에서는 한 칸으로 강제 복귀한다.
  // 고정 2열이 남아 제목이 한 글자씩 찢어지는 것보다 사용자의 현재 화면이 우선이다.
  if (choice === 'wide') return width >= 860 ? 'wide' : 'tall'
  if (choice === 'tall') return 'tall'
  return width >= 960 && isLandscape() ? 'wide' : 'tall'
}

export const viewChoice = () => choice

function apply() {
  const el = document.documentElement
  el.setAttribute('data-teacher-view', effectiveView())
  listeners.forEach(fn => fn(effectiveView(), choice))
}

/** 교사가 고른다. 'auto' | 'tall' | 'wide' */
export function setView(v) {
  choice = (v === 'wide' || v === 'tall') ? v : 'auto'
  try { localStorage.setItem(KEY, choice) } catch { /* 시크릿 창 등 — 그냥 이번만 쓴다 */ }
  apply()
}

/**
 * 교사 앱에 들어갈 때 켜고, 나갈 때 끈다.
 * 학생 화면에 표시가 남으면 학생 앱까지 넓어진다.
 */
export function startTeacherLayout() {
  document.documentElement.classList.add('teacher-mode')
  apply()
  // 회전·창 크기 변경 모두 다시 계산한다. 수동 넓게 보기도 좁은 화면에서는
  // 안전하게 한 칸으로 내려가야 하므로 선택값과 무관하게 적용한다.
  const off = onOrientationChange(apply)
  window.addEventListener('resize', apply)
  return () => {
    off()
    window.removeEventListener('resize', apply)
    document.documentElement.classList.remove('teacher-mode')
    document.documentElement.removeAttribute('data-teacher-view')
  }
}

export function onViewChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
