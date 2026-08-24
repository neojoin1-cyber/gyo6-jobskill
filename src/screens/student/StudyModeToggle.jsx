// 모드 전환 스위치와 안내 띠.
//
// 토글이 두 군데에 각각 손으로 적혀 있어서 이름이 갈렸다(학습/문제, 학습/게임).
// 한 곳에서 그리면 갈릴 수가 없다.
//
// 색을 모드마다 다르게 준 것은 장식이 아니다. 지금이 **기록이 남는 자리인지**
// 학생이 화면을 보자마자 알아야 한다.

import { STUDY_MODES, MODE_ORDER, modeOf } from '../../lib/studyModes.js'

export default function StudyModeToggle({ mode, onChange, compact = false }) {
  const cur = modeOf(mode)
  return (
    <div style={{
      display: 'flex', background: 'var(--border)', borderRadius: 9,
      padding: 2, flexShrink: 0, gap: 2,
    }}>
      {MODE_ORDER.map(id => {
        const m = STUDY_MODES[id]
        const on = mode === id
        return (
          <button key={id} onClick={() => onChange(id)}
            aria-pressed={on}
            title={m.goal}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              minWidth: compact ? 0 : 44, minHeight: compact ? 0 : 44,
              padding: compact ? '5px 11px' : '0 12px',
              border: 'none', borderRadius: 7, cursor: 'pointer',
              fontSize: 12.5, fontWeight: on ? 800 : 600,
              background: on ? m.tint : 'transparent',
              color: on ? '#fff' : 'var(--text-muted)',
              transition: 'background .15s',
            }}>
            <span style={{ fontSize: 13 }}>{m.icon}</span>{m.label}
          </button>
        )
      })}
    </div>
  )
}

/** 모드가 무엇을 하는 자리인지 알려 주는 띠. 오른쪽에 진행 상황을 붙일 수 있다. */
export function StudyModeStrip({ mode, right }) {
  const m = modeOf(mode)
  return (
    <div style={{
      padding: '6px 14px', background: m.soft,
      borderBottom: `1px solid ${m.line}`, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 12, color: m.tint, fontWeight: 600 }}>
        {m.icon} {m.strip}
      </span>
      {right != null && (
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: m.tint, flexShrink: 0 }}>
          {right}
        </span>
      )}
    </div>
  )
}
