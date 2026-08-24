import { difficultyTier } from '../../lib/difficulty.js'

/**
 * 난이도 배지 — 순화 3티어(기본기/실전/도전). 하위 표현 없음.
 * '도전'만 선택 안내(만점·A등급 도전용). 티어 없으면 미표시.
 */
export default function DifficultyBadge({ q, showDesc = false }) {
  const t = difficultyTier(q)
  if (!t) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
      fontSize: 12, fontWeight: 800, color: t.color, background: t.bg,
      border: `1px solid ${t.color}33`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
    }}>
      {t.icon} {t.label}{showDesc && t.key === 'challenge' ? ' · 선택' : ''}
    </span>
  )
}
