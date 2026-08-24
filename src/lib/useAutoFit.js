/**
 * 한 화면을 꽉 채우도록 글자를 키운다.
 *
 * ── 왜 필요한가 ───────────────────────────────────────────────────
 * 교실 화면은 16:9 다. 내용 분량은 문항마다·장마다 크게 다른데 글자
 * 크기를 고정하면, 짧은 것은 화면의 절반 이상이 비고 긴 것은 넘친다.
 * 실측했을 때 채움률이 20%~72% 로 널뛰었다.
 *
 * 발표 도구가 하는 일을 그대로 한다 — **글자를 상자에 맞춰 키운다.**
 * 짧으면 크게, 길면 작게. 어느 화면을 넘겨도 차 있고, 교실 뒤에서 읽을
 * 수 있는 가장 큰 글씨가 된다.
 *
 * ── 어떻게 찾나 ───────────────────────────────────────────────────
 * 이분 탐색이다. 배율을 넣어 보고 넘치는지 보고, 안 넘치면 키우고 넘치면
 * 줄인다. 7번이면 1% 안쪽으로 좁혀진다. 화면을 넘길 때 한 번만 돈다.
 *
 * 쓰는 쪽 CSS 는 `font-size: calc(1em * var(--fit, 1))` 로 받는다.
 */
import { useLayoutEffect } from 'react'

export const FIT_MIN = 0.62
export const FIT_MAX = 4.20

export default function useAutoFit(ref, dep, { min = FIT_MIN, max = FIT_MAX } = {}) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    /**
     * 이 배율에서 내용이 다 들어가는가.
     *
     * 바깥 상자만 보면 속는다. 안쪽 칸(좌우 2단 같은 것)이 flex 로 높이를
     * 배정받으면 바깥은 「다 들어갔다」고 보고하는데 안쪽 내용은 삐져나간다.
     * 실측에서 바깥은 584/584 인데 안쪽이 4060/549 였다 — 내용의 7분의 1만
     * 보이는 상태였다. 그래서 **자손까지 훑는다.**
     */
    const fits = (v) => {
      el.style.setProperty('--fit', v)
      // 1px 은 소수점 반올림 여유. 이게 없으면 딱 맞는 것도 넘친다고 본다.
      if (el.scrollHeight > el.clientHeight + 1) return false
      for (const d of el.querySelectorAll('*')) {
        if (d.scrollHeight > d.clientHeight + 1) return false
      }
      return true
    }

    const measure = () => {
      // 가장 작게 해도 넘치면 더 볼 것 없다. 그대로 두고 스크롤에 맡긴다.
      if (!fits(min)) return
      let lo = min, hi = max
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid; else hi = mid
      }
      el.style.setProperty('--fit', lo)
    }

    measure()
    // 창 크기가 바뀌거나 기기를 돌리면 다시 잰다.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [dep])
}
