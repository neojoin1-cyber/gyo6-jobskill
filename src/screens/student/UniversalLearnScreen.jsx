/**
 * UniversalLearnScreen — 통합 학습 화면 컨트롤러
 * charSelect → map → session(TikiTakaEngine) 흐름 오케스트레이션
 */
import { useState, useRef, useEffect } from 'react'
import { userLocalStorage as localStorage } from '../../lib/userLocalStorage.js'
import { pushBack, popBack } from '../../lib/backButton.js'
import { getSubjectConfig } from '../../lib/subjectConfigs.js'
import { loadProgress, recordUnitResult, getUnitState } from '../../lib/unitProgress.js'
import UnitMap from './UnitMap.jsx'
import TikiTakaEngine from './TikiTakaEngine.jsx'

const CHARACTERS = [
  { id: 'nova',     emoji: '🤖', name: 'NOVA',    desc: 'AI 품질 보조 로봇',   color: '#4F46E5' },
  { id: 'senpai',   emoji: '🎓', name: '선배님',  desc: '현장 경험 5년차',     color: '#059669' },
  { id: 'engineer', emoji: '⚙️', name: '엔지니어', desc: '품질 분석 전문가',  color: '#D97706' },
  { id: 'master',   emoji: '🏆', name: '달인',    desc: '품질 마이스터',       color: '#DC2626' },
]

const CHAR_SAVE_KEY = (subjectId) => `nova_char_${subjectId}`

// ── 캐릭터 선택 화면 ──────────────────────────────────────────────────────────
function CharacterSelect({ subjectConfig, onSelect }) {
  const { name, emoji, color } = subjectConfig
  return (
    <div className="screen">
      <div className="appbar" style={{ background: color }}>
        <span className="appbar-title" style={{ color: '#fff' }}>{emoji} {name}</span>
      </div>
      <div className="screen-body" style={{ paddingBottom: 40 }}>
        <div style={{ textAlign: 'center', padding: '24px 0 20px' }}>
          <p style={{ fontSize: 24, marginBottom: 10 }}>🎮</p>
          <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
            함께 공부할 캐릭터를 선택하세요
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            캐릭터마다 학습 스타일과 대화가 달라요!<br />
            나중에 변경할 수 없으니 신중하게 골라요 😊
          </p>
        </div>

        {CHARACTERS.map(c => (
          <button key={c.id} onClick={() => onSelect(c.id)}
            style={{
              width: '100%', textAlign: 'left',
              background: 'var(--card)',
              border: `2px solid ${c.color}33`,
              borderRadius: 18, padding: '16px 18px',
              marginBottom: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}>
            <div style={{
              width: 60, height: 60, borderRadius: 18, flexShrink: 0,
              background: `${c.color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, border: `2px solid ${c.color}33`,
            }}>
              {c.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 3 }}>{c.name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.desc}</p>
            </div>
            <span style={{ color: c.color, fontSize: 22 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 메인 컨트롤러 ─────────────────────────────────────────────────────────────
export default function UniversalLearnScreen({ subjectId, onBack }) {
  const subjectConfig = getSubjectConfig(subjectId)

  const [charId, setCharId] = useState(() => {
    return localStorage.getItem(CHAR_SAVE_KEY(subjectId)) || null
  })
  const [progress, setProgress] = useState(() => loadProgress(subjectId))
  const [view, setView]         = useState(() =>
    localStorage.getItem(CHAR_SAVE_KEY(subjectId)) ? 'map' : 'charSelect'
  )
  const [unitIdx, setUnitIdx] = useState(0)

  const char = CHARACTERS.find(c => c.id === charId) ?? CHARACTERS[0]

  // Android 뒤로가기
  const backRef = useRef(null)
  backRef.current = { view, onBack }
  useEffect(() => {
    const id = pushBack(() => {
      const { view, onBack } = backRef.current
      if (view === 'charSelect' || view === 'map') { onBack?.(); return }
      setView('map')
    })
    return () => popBack(id)
  }, [])

  if (!subjectConfig) {
    return (
      <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>지원하지 않는 과목입니다.</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={onBack}>돌아가기</button>
      </div>
    )
  }

  function handleCharSelect(id) {
    localStorage.setItem(CHAR_SAVE_KEY(subjectId), id)
    setCharId(id)
    setView('map')
  }

  function handleSelectUnit(idx) {
    setUnitIdx(idx)
    setView('session')
  }

  function handleSessionComplete(result) {
    const unit = subjectConfig.units[unitIdx]
    const newProgress = recordUnitResult(subjectId, progress, unit.id, result.score)
    setProgress(newProgress)
  }

  if (view === 'charSelect') {
    return <CharacterSelect subjectConfig={subjectConfig} onSelect={handleCharSelect} />
  }

  if (view === 'map') {
    return (
      <UnitMap
        subjectConfig={subjectConfig}
        progress={progress}
        char={char}
        onSelectUnit={handleSelectUnit}
        onBack={onBack}
      />
    )
  }

  if (view === 'session') {
    const unit = subjectConfig.units[unitIdx]
    return (
      <TikiTakaEngine
        unit={unit}
        char={char}
        onComplete={handleSessionComplete}
        onBack={() => setView('map')}
      />
    )
  }

  return null
}
