/**
 * UnitMap — 게임 스타일 단원 지도
 * 2열 그리드, 별점(1-3), 잠금/해금, 캐릭터 토큰, 전체 진행 바
 */
import { useState } from 'react'
import { getUnitState, isUnitUnlocked, resetSubjectProgress } from '../../lib/unitProgress.js'

const STAR_THRESHOLDS = [50, 65, 80]   // 1·2·3별 최소 점수

function starCount(state) { return state?.stars ?? 0 }

function Stars({ count, color }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3].map(s => (
        <span key={s} style={{
          fontSize: 13,
          opacity: s <= count ? 1 : 0.18,
          filter: s <= count ? `drop-shadow(0 0 2px ${color}88)` : 'none',
        }}>⭐</span>
      ))}
    </div>
  )
}

export default function UnitMap({ subjectConfig, progress, char, onSelectUnit, onBack }) {
  const { units, unitIds, name, emoji, color } = subjectConfig
  const [showReset, setShowReset] = useState(false)

  const clearedCount = unitIds.filter(id => (getUnitState(progress, id).stars ?? 0) >= 1).length
  const totalStars   = unitIds.reduce((sum, id) => sum + starCount(getUnitState(progress, id)), 0)
  const maxStars     = unitIds.length * 3

  // 캐릭터 토큰 위치: 첫 번째 미완료 단원
  const activeIdx = unitIds.findIndex(id => (getUnitState(progress, id).stars ?? 0) === 0)
  const charIdx   = activeIdx < 0 ? unitIds.length - 1 : activeIdx

  return (
    <div className="screen" style={{ background: '#F0F4FF' }}>
      {/* 앱바 */}
      <div className="appbar" style={{ background: color }}>
        <button className="appbar-back" onClick={onBack}
          style={{ color: '#fff', opacity: 0.85 }}>←</button>
        <span className="appbar-title" style={{ color: '#fff' }}>{emoji} {name}</span>
        <button onClick={() => setShowReset(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 18, padding: '0 4px' }}>
          ⋮
        </button>
      </div>

      {/* 헤더 — 진행 현황 */}
      <div style={{
        background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
        padding: '16px 18px 20px', color: '#fff',
      }}>
        {/* 캐릭터 + 스탯 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, border: '2px solid rgba(255,255,255,0.3)',
          }}>
            {char.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 16 }}>{char.name}</p>
            <p style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {clearedCount === unitIds.length
                ? '🏆 전 단원 완료!'
                : `${clearedCount}/${unitIds.length} 단원 클리어 · ⭐ ${totalStars}/${maxStars}`}
            </p>
          </div>
        </div>

        {/* 전체 진행 바 */}
        <div style={{ height: 8, background: 'rgba(255,255,255,0.25)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            background: 'rgba(255,255,255,0.9)',
            width: `${unitIds.length > 0 ? (clearedCount / unitIds.length) * 100 : 0}%`,
            borderRadius: 4, transition: 'width 0.6s ease',
          }} />
        </div>

        {/* 단원 도트 */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          {unitIds.map((id, i) => {
            const s = getUnitState(progress, id)
            return (
              <div key={id} style={{
                width: 22, height: 8, borderRadius: 4,
                background: s.stars >= 1 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
                transition: 'background 0.3s',
              }} />
            )
          })}
        </div>

        {/* 전 단원 클리어 */}
        {clearedCount === unitIds.length && (
          <div style={{
            marginTop: 12, background: 'rgba(255,255,255,0.2)',
            borderRadius: 12, padding: '10px 14px', fontSize: 13,
            border: '1px solid rgba(255,255,255,0.3)',
          }}>
            🎉 {name} 전 과정 마스터! {char.name}와 함께 해냈어요!
          </div>
        )}
      </div>

      {/* 단원 그리드 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 80px' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, paddingLeft: 4 }}>
          단원을 선택해 학습을 시작하세요
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {units.map((unit, idx) => {
            const state    = getUnitState(progress, unit.id)
            const unlocked = isUnitUnlocked(progress, unitIds, idx)
            const isActive = idx === charIdx
            const stars    = starCount(state)
            const hasScore = state.lastScore !== null

            return (
              <button
                key={unit.id}
                disabled={!unlocked}
                onClick={() => unlocked && onSelectUnit(idx)}
                style={{
                  position: 'relative',
                  textAlign: 'left',
                  background: stars >= 1
                    ? 'linear-gradient(135deg, #D1FAE5, #ECFDF5)'
                    : unlocked
                    ? 'var(--card)'
                    : '#F9FAFB',
                  border: `2px solid ${
                    stars >= 1 ? '#059669'
                    : isActive && unlocked ? color
                    : unlocked ? `${color}44`
                    : 'var(--border)'
                  }`,
                  borderRadius: 16, padding: '14px 12px',
                  cursor: unlocked ? 'pointer' : 'default',
                  opacity: unlocked ? 1 : 0.5,
                  boxShadow: isActive && unlocked
                    ? `0 4px 16px ${color}44`
                    : stars >= 1 ? '0 2px 8px rgba(5,150,105,0.15)' : 'var(--shadow)',
                  transition: 'all 0.2s',
                }}>
                {/* 단원 번호 + 잠금 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: stars >= 1 ? '#059669' : unlocked ? color : '#D1D5DB',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800,
                  }}>
                    {stars >= 1 ? '✓' : unlocked ? idx + 1 : '🔒'}
                  </span>
                  {stars >= 1 && <Stars count={stars} color="#F59E0B" />}
                </div>

                {/* 단원명 */}
                <p style={{
                  fontSize: 13, fontWeight: 700, lineHeight: 1.4, marginBottom: 6,
                  color: stars >= 1 ? '#065F46' : unlocked ? 'var(--text)' : 'var(--text-muted)',
                }}>
                  {unit.title}
                </p>

                {/* 상태 정보 */}
                {stars >= 1 && hasScore && (
                  <p style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>
                    최고 {state.bestScore}점
                  </p>
                )}
                {!stars && unlocked && hasScore && (
                  <p style={{ fontSize: 12, color: '#D97706', fontWeight: 600 }}>
                    최근 {state.lastScore}점 · 재도전!
                  </p>
                )}
                {!stars && unlocked && !hasScore && (
                  <p style={{ fontSize: 12, color: color, fontWeight: 600 }}>
                    {isActive ? '← 지금 여기!' : '시작하기'}
                  </p>
                )}
                {!unlocked && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    이전 단원 완료 후 해금
                  </p>
                )}

                {/* 캐릭터 토큰 */}
                {isActive && unlocked && (
                  <div style={{
                    position: 'absolute', top: -10, right: -6,
                    width: 28, height: 28, borderRadius: 20,
                    background: color, border: '2px solid #fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, boxShadow: `0 2px 8px ${color}66`,
                    animation: 'tiki-float 2s ease infinite',
                  }}>
                    {char.emoji}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 초기화 모달 */}
      {showReset && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 300, textAlign: 'center' }}>
            <p style={{ fontSize: 24, marginBottom: 8 }}>⚠️</p>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>진행 초기화</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              모든 단원의 별·점수·기록이 삭제됩니다.<br/>캐릭터 선택도 초기화돼요.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }}
                onClick={() => setShowReset(false)}>취소</button>
              <button className="btn btn-danger" style={{ flex: 1 }}
                onClick={() => { resetSubjectProgress(subjectConfig.id); window.location.reload() }}>
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes tiki-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
    </div>
  )
}
