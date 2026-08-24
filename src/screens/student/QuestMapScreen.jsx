/**
 * QuestMapScreen — 품질경영 도장깨기 모드
 * 캐릭터 선택 → 7개 거점 지도 → 학습 → 모의고사 → 클리어
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { pushBack, popBack } from '../../lib/backButton.js'
import {
  loadQuestProgress, initQuestProgress, getAreaState,
  isAreaUnlocked, markLearnDone, recordExamScore, resetQuestProgress,
} from '../../lib/questProgress.js'
import studyData    from '../../../data/quality-mgmt-study.json'
import practiceData from '../../../data/quality-mgmt-practice.json'

// ── 상수 ──────────────────────────────────────────────────────────────────
const AREA_IDS  = ['s01-1', 's02-2', 's03-3', 's04-4', 's05-5', 's06-6', 's07-7']
const EXAM_CNT  = 15   // 모의고사 출제 수

const AREAS = AREA_IDS.map(id => {
  const unit = studyData.units.find(u => u.id === id)
  return { id, title: unit?.title ?? id, questions: unit?.questions ?? [] }
})

const CHARACTERS = [
  { id: 'nova',     emoji: '🤖', name: 'NOVA',    desc: 'AI 품질 보조 로봇',   color: '#4F46E5' },
  { id: 'senpai',   emoji: '🎓', name: '선배님',  desc: '현장 경험 5년차',     color: '#059669' },
  { id: 'engineer', emoji: '⚙️', name: '엔지니어', desc: '품질 분석 전문가',  color: '#D97706' },
  { id: 'master',   emoji: '🏆', name: '달인',    desc: '품질 마이스터',       color: '#DC2626' },
]

const AREA_GREET = [
  '첫 번째 거점! 구매품 품질관리는 품질의 시작이에요. 함께 정복해봐요! 💪',
  '자재 입고관리! 원자재 품질이 제품 품질을 결정해요. 꼼꼼히 배워봐요!',
  '설비 일상관리! 잘 관리된 설비가 품질 불량을 막아줘요.',
  '공정 품질관리! 생산 과정 중 품질을 지키는 핵심이에요.',
  '사내표준화! 표준이 있어야 일관된 품질이 나와요.',
  '지속적 개선활동! 품질은 끝없이 발전할 수 있어요.',
  '마지막 거점!! 여기까지 오다니 정말 대단해요! 최후의 도전! 🔥',
]

function scoreMsg(score) {
  if (score >= 90) return ['🏆', '완벽해요! 최고의 실력이에요!']
  if (score >= 80) return ['🎉', '클리어! 다음 거점이 열렸어요!']
  if (score >= 60) return ['💪', `${score}점이에요. 조금만 더 하면 클리어 가능해요!`]
  return ['📚', `${score}점이에요. 학습을 다시 하고 다시 도전해봐요!`]
}

// ── 유틸: 시험지 만들기 ────────────────────────────────────────────────
function pickExamQuestions(areaId) {
  const unit = practiceData.units.find(u => u.id === areaId)
  const pool = (unit?.questions ?? []).filter(q => q.type === 'choice' && q.choices?.length > 0)
  // Fisher-Yates shuffle
  const arr = [...pool]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, Math.min(EXAM_CNT, arr.length))
}

// ── NPC 대화 버블 ──────────────────────────────────────────────────────
function NpcBubble({ char, message, onClose }) {
  if (!message) return null
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 200,
      background: 'var(--card)', border: '2px solid var(--primary)',
      borderRadius: 16, padding: '12px 14px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      animation: 'slideUp 0.25s ease',
    }}>
      <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{char?.emoji ?? '🤖'}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, marginBottom: 3 }}>
          {char?.name ?? 'NOVA'}
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.55 }}>{message}</p>
      </div>
      <button onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', flexShrink: 0, padding: 0 }}>
        ✕
      </button>
    </div>
  )
}

// ── 1. 캐릭터 선택 ────────────────────────────────────────────────────
function CharacterSelect({ onSelect }) {
  return (
    <div className="screen">
      <div className="appbar">
        <span className="appbar-title">⚙️ 품질경영 도장깨기</span>
      </div>
      <div className="screen-body" style={{ paddingBottom: 40 }}>
        <div style={{ textAlign: 'center', padding: '20px 0 24px' }}>
          <p style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>캐릭터를 선택하세요</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            선택한 캐릭터와 함께 7개 거점을 정복해봐요!<br/>
            품질경영의 달인이 되는 그날까지 💪
          </p>
        </div>
        {CHARACTERS.map(c => (
          <button key={c.id} onClick={() => onSelect(c.id)}
            style={{
              width: '100%', textAlign: 'left', background: 'var(--card)',
              border: `2px solid ${c.color}33`, borderRadius: 16,
              padding: '16px 18px', marginBottom: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14,
              transition: 'transform 0.1s',
            }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: `${c.color}15`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 30,
            }}>
              {c.emoji}
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 3 }}>{c.name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.desc}</p>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 20, color: 'var(--text-muted)' }}>›</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 2. 메인 지도 ──────────────────────────────────────────────────────
function MapView({ progress, char, onSelectArea, onReset }) {
  const clearedCount = AREA_IDS.filter(id => getAreaState(progress, id).cleared).length
  const [showReset, setShowReset] = useState(false)

  // 현재 캐릭터가 위치할 거점 (가장 앞 활성 거점)
  const charPos = AREA_IDS.findIndex(id => !getAreaState(progress, id).cleared)
  const activeIdx = charPos < 0 ? AREA_IDS.length - 1 : charPos

  return (
    <div className="screen" style={{ background: '#F0F4FF' }}>
      <div className="appbar" style={{ background: '#3730A3' }}>
        <span className="appbar-title" style={{ color: '#fff' }}>⚙️ 품질경영 도장깨기</span>
        <button onClick={() => setShowReset(r => !r)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff9', fontSize: 13, padding: '0 4px' }}>
          ⋮
        </button>
      </div>

      {showReset && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 300, textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>처음부터 다시 시작할까요?</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>모든 진행 상황이 초기화됩니다.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowReset(false)}>취소</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { resetQuestProgress(); onReset() }}>초기화</button>
            </div>
          </div>
        </div>
      )}

      {/* 캐릭터 + 진행 현황 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, #3730A3 0%, #4F46E5 100%)',
        padding: '16px 20px 24px', color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32,
          }}>
            {char.emoji}
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: 17 }}>{char.name}</p>
            <p style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {clearedCount === 7 ? '🏆 모든 거점 정복 완료!' : `${clearedCount}/7 거점 정복`}
            </p>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {AREA_IDS.map((id, i) => {
                const s = getAreaState(progress, id)
                return (
                  <div key={id} style={{
                    width: 20, height: 6, borderRadius: 3,
                    background: s.cleared ? '#A5F3C8' : 'rgba(255,255,255,0.25)',
                  }} />
                )
              })}
            </div>
          </div>
        </div>
        {clearedCount === 7 && (
          <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
            🎉 축하해요! 7개 거점을 모두 정복했어요! 품질경영의 달인이 됐어요!
          </div>
        )}
      </div>

      {/* 거점 지도 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>
        {AREAS.map((area, idx) => {
          const state   = getAreaState(progress, area.id)
          const unlocked = isAreaUnlocked(progress, AREA_IDS, idx)
          const isActive = idx === activeIdx

          return (
            <div key={area.id} style={{ display: 'flex', marginBottom: 0, position: 'relative' }}>
              {/* 좌측 연결선 + 노드 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 44, flexShrink: 0 }}>
                {idx > 0 && (
                  <div style={{
                    width: 3, height: 20, flexShrink: 0,
                    background: isAreaUnlocked(progress, AREA_IDS, idx) ? '#4F46E5' : '#D1D5DB',
                    transition: 'background 0.4s',
                  }} />
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: 20, flexShrink: 0,
                  background: state.cleared ? '#059669' : unlocked ? '#4F46E5' : '#D1D5DB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: unlocked ? 14 : 16,
                  boxShadow: isActive && unlocked ? '0 0 0 4px rgba(79,70,229,0.25)' : 'none',
                  transition: 'all 0.3s',
                }}>
                  {state.cleared ? '✓' : unlocked ? idx + 1 : '🔒'}
                </div>
                {idx < AREAS.length - 1 && (
                  <div style={{
                    width: 3, flex: 1, minHeight: 20,
                    background: state.cleared ? '#059669' : '#D1D5DB',
                    transition: 'background 0.4s',
                  }} />
                )}
              </div>

              {/* 우측 카드 */}
              <button
                disabled={!unlocked}
                onClick={() => unlocked && onSelectArea(idx)}
                style={{
                  flex: 1, marginLeft: 12, marginBottom: idx < AREAS.length - 1 ? 0 : 0,
                  marginTop: idx > 0 ? 20 : 0,
                  textAlign: 'left', background: 'var(--card)',
                  border: `2px solid ${state.cleared ? '#059669' : isActive && unlocked ? '#4F46E5' : 'var(--border)'}`,
                  borderRadius: 14, padding: '12px 14px',
                  cursor: unlocked ? 'pointer' : 'default',
                  opacity: unlocked ? 1 : 0.45,
                  transition: 'all 0.2s',
                  boxShadow: isActive && unlocked ? '0 2px 12px rgba(79,70,229,0.18)' : 'var(--shadow)',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, flex: 1, marginRight: 8 }}>{area.title}</p>
                  {isActive && unlocked && !state.cleared && (
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: '#EEF2FF', color: '#4F46E5', whiteSpace: 'nowrap',
                    }}>
                      {char.emoji} 현재 위치
                    </span>
                  )}
                  {state.cleared && (
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: '#D1FAE5', color: '#059669', whiteSpace: 'nowrap',
                    }}>
                      ✅ 클리어
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {state.cleared && (
                    <p style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>
                      평균 {state.avgScore}점 · 총 {state.attempts.length}회 응시
                    </p>
                  )}
                  {!state.cleared && unlocked && state.attempts?.length > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      최근 {state.lastScore}점 · {state.learnDone ? '재도전 가능' : '학습 필요'}
                    </p>
                  )}
                  {!state.cleared && unlocked && !state.attempts?.length && (
                    <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                      {state.learnDone ? '모의고사 도전 가능! →' : '학습 시작하기 →'}
                    </p>
                  )}
                  {!unlocked && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>이전 거점을 클리어하세요</p>
                  )}
                </div>
              </button>
            </div>
          )
        })}

        {/* 완주 배너 */}
        {clearedCount === 7 && (
          <div style={{
            marginTop: 24, padding: '20px 16px', borderRadius: 16,
            background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
            border: '2px solid #059669', textAlign: 'center',
          }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>🏆</p>
            <p style={{ fontWeight: 800, fontSize: 16, color: '#065F46', marginBottom: 4 }}>
              품질경영 전 과정 정복!
            </p>
            <p style={{ fontSize: 12, color: '#047857' }}>
              {char.name}와 함께 모든 거점을 제패했어요!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 3. 거점 진입 화면 ─────────────────────────────────────────────────
function AreaDetail({ areaIdx, progress, char, onStartLearn, onStartExam, onBack }) {
  const area  = AREAS[areaIdx]
  const state = getAreaState(progress, area.id)
  const [npcMsg, setNpcMsg] = useState(
    !state.attempts?.length ? AREA_GREET[areaIdx] : null
  )

  const needLearn = !state.learnDone || (state.lastScore !== null && state.lastScore < 60)
  const canExam   = state.learnDone

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title">{area.title}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          거점 {areaIdx + 1}/7
        </span>
      </div>
      <div className="screen-body" style={{ paddingBottom: 100 }}>
        {/* 거점 상태 배너 */}
        <div style={{
          borderRadius: 16, padding: '16px 18px', marginBottom: 16,
          background: state.cleared ? 'linear-gradient(135deg,#D1FAE5,#A7F3D0)' : 'linear-gradient(135deg,#EEF2FF,#E0E7FF)',
          border: `2px solid ${state.cleared ? '#059669' : '#4F46E5'}`,
        }}>
          <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>
            {state.cleared ? '✅ 클리어 완료!' : `🎯 ${area.title}`}
          </p>
          {state.cleared ? (
            <p style={{ fontSize: 13, color: '#065F46' }}>
              평균 {state.avgScore}점 · 총 {state.attempts.length}회 응시<br/>
              복습을 통해 더 높은 점수에 도전해봐요!
            </p>
          ) : (
            <p style={{ fontSize: 13, color: '#3730A3', lineHeight: 1.6 }}>
              {needLearn ? '📚 먼저 학습을 완료하세요.' : '🎯 모의고사에 도전할 준비가 됐어요!'}<br/>
              <span style={{ fontSize: 12, opacity: 0.75 }}>
                모의고사 80점 이상 → 다음 거점 해금 | 60점 미만 → 재학습 필요
              </span>
            </p>
          )}
        </div>

        {/* 응시 이력 */}
        {state.attempts?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>📊 응시 이력</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {state.attempts.map((sc, i) => (
                <span key={i} style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  background: sc >= 80 ? '#D1FAE5' : sc >= 60 ? '#FEF3C7' : '#FEE2E2',
                  color: sc >= 80 ? '#059669' : sc >= 60 ? '#92400E' : '#991B1B',
                }}>
                  {i + 1}회: {sc}점
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 학습 버튼 */}
        <button onClick={onStartLearn}
          style={{
            width: '100%', textAlign: 'left', background: 'var(--card)',
            border: `2px solid ${needLearn ? '#4F46E5' : 'var(--border)'}`,
            borderRadius: 14, padding: '16px', marginBottom: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>📚</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
              {state.learnDone && state.lastScore >= 60 ? '복습하기' : '학습하기'}
              {needLearn && !state.cleared && (
                <span style={{ marginLeft: 6, fontSize: 12, background: '#4F46E5', color: '#fff', padding: '2px 7px', borderRadius: 20 }}>필수</span>
              )}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {area.questions.length}문항 · 면접형 답변 연습 (정답 공개)
            </p>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 20 }}>›</span>
        </button>

        {/* 모의고사 버튼 */}
        <button
          disabled={!canExam}
          onClick={canExam ? onStartExam : undefined}
          style={{
            width: '100%', textAlign: 'left',
            background: canExam ? 'var(--card)' : 'var(--bg)',
            border: `2px solid ${canExam && !state.cleared ? '#059669' : 'var(--border)'}`,
            borderRadius: 14, padding: '16px', marginBottom: 12,
            cursor: canExam ? 'pointer' : 'default', opacity: canExam ? 1 : 0.5,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: canExam ? '#D1FAE5' : 'var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>📝</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
              모의고사 도전
              {!canExam && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 6 }}>학습 완료 후 해금</span>}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {EXAM_CNT}문항 · 선다형 자동채점 · 80점 이상 → 다음 거점 해금
            </p>
          </div>
          {canExam && <span style={{ color: 'var(--text-muted)', fontSize: 20 }}>›</span>}
        </button>
      </div>

      <NpcBubble char={char} message={npcMsg} onClose={() => setNpcMsg(null)} />
    </div>
  )
}

// ── 4. 학습 모드 ──────────────────────────────────────────────────────
function LearnView({ areaIdx, progress, char, onDone, onBack }) {
  const area = AREAS[areaIdx]
  const qs   = area.questions
  const [idx, setIdx]         = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [seen, setSeen]         = useState(() => new Set())
  const scrollRef               = useRef(null)

  useEffect(() => {
    setRevealed(false)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [idx])

  const q = qs[idx]
  if (!q) return null

  const markedSeen = () => {
    const next = new Set(seen)
    next.add(q.id)
    setSeen(next)
    return next
  }

  function handleNext(s) {
    const ns = markedSeen()
    if (idx < qs.length - 1) { setIdx(i => i + 1) }
    else if (ns.size >= qs.length) {
      onDone()
    }
  }
  function handlePrev() {
    if (idx > 0) setIdx(i => i - 1)
  }

  const allSeen = seen.size >= qs.length

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title" style={{ fontSize: 12 }}>{area.title} — 학습</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{idx + 1}/{qs.length}</span>
      </div>

      {/* 진행바 */}
      <div style={{ height: 4, background: 'var(--border)' }}>
        <div style={{ height: '100%', background: 'var(--primary)', width: `${(seen.size / qs.length) * 100}%`, transition: 'width 0.3s' }} />
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 16px' }}>
        {/* 문제 번호 + 유형 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#EEF2FF', color: '#4F46E5' }}>
            {idx + 1}번
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{q.difficulty ?? '보통'}</span>
          {seen.has(q.id) && (
            <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>✓ 확인함</span>
          )}
        </div>

        {/* 문제 제목 */}
        {q.heading && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
            {q.heading}
          </p>
        )}

        {/* 문제 줄기 */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '14px 16px', marginBottom: 14,
          fontSize: 14, lineHeight: 1.75, fontWeight: 500,
        }}>
          {q.stem || q.stems?.map(s => s.text).join('\n')}
        </div>

        {/* 정답 확인 */}
        {!revealed ? (
          <button onClick={() => setRevealed(true)}
            style={{
              width: '100%', padding: '13px', borderRadius: 12,
              background: 'var(--primary)', color: '#fff',
              border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
            }}>
            💡 정답 확인하기
          </button>
        ) : (
          <div>
            <div style={{
              background: '#F0FDF4', border: '2px solid #059669',
              borderRadius: 12, padding: '14px 16px', marginBottom: 12,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginBottom: 6 }}>📌 모범 답안</p>
              <p style={{ fontSize: 13, lineHeight: 1.75, color: '#065F46' }}>
                {q.modelAnswer || q.answer}
              </p>
            </div>

            {/* 설명 / 힌트 */}
            {q.teacherHints?.length > 0 && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                {q.teacherHints.map((h, i) => (
                  <div key={i} style={{ marginBottom: i < q.teacherHints.length - 1 ? 8 : 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 2 }}>
                      🔑 {h.label}
                    </p>
                    <p style={{ fontSize: 12, color: '#78350F', lineHeight: 1.6 }}>{h.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 이해 여부 버튼 */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <button
                onClick={() => handleNext('done')}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  background: '#059669', color: '#fff',
                  border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                }}>
                ✓ 이해했어요
              </button>
              <button
                onClick={() => handleNext('review')}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  background: '#FEF3C7', color: '#92400E',
                  border: '2px solid #FCD34D', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                }}>
                🔄 다시 볼게요
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 하단 네비게이션 */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid var(--border)',
        background: 'var(--card)', display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <button onClick={handlePrev} disabled={idx === 0}
          style={{
            padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--bg)', cursor: idx > 0 ? 'pointer' : 'default',
            opacity: idx > 0 ? 1 : 0.4, fontWeight: 600, fontSize: 14,
          }}>
          ← 이전
        </button>

        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          확인 {seen.size}/{qs.length}
        </div>

        {idx < qs.length - 1 ? (
          <button onClick={() => { markedSeen(); setIdx(i => i + 1) }}
            style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: 'var(--primary)', color: '#fff',
              cursor: 'pointer', fontWeight: 700, fontSize: 14,
            }}>
            다음 →
          </button>
        ) : (
          <button onClick={onDone}
            style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: allSeen || seen.size > 0 ? '#059669' : 'var(--text-muted)',
              color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            }}>
            학습 완료 ✓
          </button>
        )}
      </div>
    </div>
  )
}

// ── 5. 모의고사 모드 ──────────────────────────────────────────────────
function ExamView({ areaIdx, char, onSubmit, onBack }) {
  const area = AREAS[areaIdx]
  const [questions]         = useState(() => pickExamQuestions(area.id))
  const [qIdx, setQIdx]     = useState(0)
  const [answers, setAnswers] = useState({})
  const scrollRef             = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [qIdx])

  const q         = questions[qIdx]
  const answered  = answers[qIdx] !== undefined
  const allDone   = Object.keys(answers).length === questions.length

  if (!q) return null

  function select(val) {
    setAnswers(prev => ({ ...prev, [qIdx]: val }))
  }

  function handleSubmit() {
    let correct = 0
    questions.forEach((q, i) => { if (answers[i] === q.answer) correct++ })
    const score = Math.round((correct / questions.length) * 100)
    onSubmit(score, correct, questions.length)
  }

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title" style={{ fontSize: 12 }}>{area.title} — 모의고사</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{qIdx + 1}/{questions.length}</span>
      </div>

      {/* 진행바 */}
      <div style={{ height: 4, background: 'var(--border)' }}>
        <div style={{ height: '100%', background: 'var(--success)', width: `${(Object.keys(answers).length / questions.length) * 100}%`, transition: 'width 0.3s' }} />
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#D1FAE5', color: '#059669' }}>
            {qIdx + 1}번
          </span>
          {answered && (
            <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>✓ 답 선택됨</span>
          )}
        </div>

        {/* 문제 */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '14px 16px', marginBottom: 14,
          fontSize: 14, lineHeight: 1.75, fontWeight: 500,
        }}>
          {(q.stems ?? []).map((s, i) => {
            if (s.type === 'ul') return (
              <div key={i} style={{ marginTop: 8, padding: '8px 12px', background: '#F9FAFB', borderRadius: 8, border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>[보기]</p>
                {s.items.map((it, j) => (
                  <p key={j} style={{ fontSize: 13, lineHeight: 1.6 }}>• {it}</p>
                ))}
              </div>
            )
            return <p key={i} style={{ marginBottom: i < q.stems.length - 1 ? 6 : 0 }}>{s.text}</p>
          })}
        </div>

        {/* 선택지 */}
        {(q.choices ?? []).map((c, i) => {
          const selected = answers[qIdx] === c.value
          return (
            <button key={i} onClick={() => select(c.value)}
              style={{
                width: '100%', textAlign: 'left', padding: '13px 14px',
                borderRadius: 10, border: `2px solid ${selected ? '#4F46E5' : 'var(--border)'}`,
                background: selected ? '#EEF2FF' : 'var(--card)',
                marginBottom: 8, cursor: 'pointer',
                fontSize: 14, lineHeight: 1.55, fontWeight: selected ? 700 : 400,
                color: selected ? '#3730A3' : 'var(--text)',
              }}>
              <span style={{ marginRight: 8, opacity: 0.6, fontSize: 12 }}>
                {['①','②','③','④','⑤'][i]}
              </span>
              {c.text}
            </button>
          )
        })}
      </div>

      {/* 하단 네비게이션 */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid var(--border)',
        background: 'var(--card)', display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <button onClick={() => setQIdx(i => i - 1)} disabled={qIdx === 0}
          style={{
            padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--bg)', cursor: qIdx > 0 ? 'pointer' : 'default',
            opacity: qIdx > 0 ? 1 : 0.4, fontWeight: 600, fontSize: 14,
          }}>
          ← 이전
        </button>

        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          {Object.keys(answers).length}/{questions.length} 답변됨
        </div>

        {qIdx < questions.length - 1 ? (
          <button onClick={() => setQIdx(i => i + 1)}
            style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: 'var(--primary)', color: '#fff',
              cursor: 'pointer', fontWeight: 700, fontSize: 14,
            }}>
            다음 →
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!allDone}
            style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: allDone ? '#059669' : 'var(--text-muted)',
              color: '#fff', cursor: allDone ? 'pointer' : 'default',
              fontWeight: 700, fontSize: 13, opacity: allDone ? 1 : 0.6,
            }}>
            제출 →
          </button>
        )}
      </div>
    </div>
  )
}

// ── 6. 결과 화면 ──────────────────────────────────────────────────────
function ResultView({ areaIdx, score, correct, total, progress, char, onBack, onRetryExam, onRetryLearn, onNextArea }) {
  const [icon, msg] = scoreMsg(score)
  const area   = AREAS[areaIdx]
  const state  = getAreaState(progress, area.id)
  const nextArea = AREAS[areaIdx + 1]
  const isLast = areaIdx === AREAS.length - 1

  const circumference = 2 * Math.PI * 36
  const dashOffset    = circumference * (1 - score / 100)

  return (
    <div className="screen">
      <div className="appbar">
        <span className="appbar-title">{area.title} — 결과</span>
      </div>
      <div className="screen-body" style={{ textAlign: 'center', paddingBottom: 80 }}>

        {/* 점수 원형 */}
        <div style={{ margin: '24px auto 20px', position: 'relative', width: 120, height: 120 }}>
          <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="60" cy="60" r="36" fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle cx="60" cy="60" r="36" fill="none"
              stroke={score >= 80 ? '#059669' : score >= 60 ? '#F59E0B' : '#EF4444'}
              strokeWidth="8" strokeDasharray={circumference}
              strokeDashoffset={dashOffset} strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          }}>
            <p style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{score}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>점</p>
          </div>
        </div>

        {/* 이모지 + 메시지 */}
        <p style={{ fontSize: 36, marginBottom: 8 }}>{icon}</p>
        <p style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{msg}</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          {correct}/{total}문항 정답 ({score}점)
        </p>

        {/* NPC 대화 */}
        <div style={{
          background: 'var(--card)', border: '2px solid var(--primary)', borderRadius: 14,
          padding: '14px 16px', marginBottom: 24, display: 'flex', gap: 12, textAlign: 'left',
        }}>
          <span style={{ fontSize: 28, flexShrink: 0 }}>{char.emoji}</span>
          <div>
            <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, marginBottom: 4 }}>{char.name}</p>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>
              {score >= 80
                ? `🎉 정말 잘했어요! ${score}점으로 거점을 클리어했어요!${!isLast ? ` ${nextArea?.title}가 열렸어요!` : ' 전 과정 완주!'}`
                : score >= 60
                  ? `${score}점이에요. 조금만 더 하면 80점을 넘길 수 있어요! 다시 도전해봐요.`
                  : `${score}점이에요. 먼저 학습을 다시 하고 자신감을 올려봐요! 할 수 있어요! 💪`}
            </p>
          </div>
        </div>

        {/* 다음 행동 버튼 */}
        {score >= 80 && !isLast && (
          <button onClick={onNextArea}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: '#059669', color: '#fff',
              cursor: 'pointer', fontWeight: 700, fontSize: 15, marginBottom: 10,
            }}>
            🏆 다음 거점 도전하기 →
          </button>
        )}

        {score >= 60 && score < 80 && (
          <button onClick={onRetryExam}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: 'var(--primary)', color: '#fff',
              cursor: 'pointer', fontWeight: 700, fontSize: 15, marginBottom: 10,
            }}>
            🔄 다시 도전하기
          </button>
        )}

        {score < 60 && (
          <>
            <button onClick={onRetryLearn}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                background: 'var(--primary)', color: '#fff',
                cursor: 'pointer', fontWeight: 700, fontSize: 15, marginBottom: 10,
              }}>
              📚 학습 다시 하기
            </button>
          </>
        )}

        <button onClick={onBack}
          style={{
            width: '100%', padding: '13px', borderRadius: 12, border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--text)',
            cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}>
          지도로 돌아가기
        </button>
      </div>
    </div>
  )
}

// ── 메인 컨트롤러 ─────────────────────────────────────────────────────
export default function QuestMapScreen({ onBack }) {
  const [progress, setProgress] = useState(() => loadQuestProgress())
  const [view, setView]         = useState(() => {
    const p = loadQuestProgress()
    return p ? 'map' : 'char-select'
  })
  const [areaIdx,   setAreaIdx]   = useState(0)
  const [examScore, setExamScore] = useState(null)
  const [examStats, setExamStats] = useState(null)   // {correct, total}

  const char = CHARACTERS.find(c => c.id === progress?.character) ?? CHARACTERS[0]

  // Android 뒤로가기
  const backRef = useRef(null)
  backRef.current = { view, onBack }
  useEffect(() => {
    const id = pushBack(() => {
      const { view, onBack } = backRef.current
      if (view === 'char-select' || view === 'map') { onBack?.(); return }
      setView('map')
    })
    return () => popBack(id)
  }, [])

  function handleCharSelect(charId) {
    const p = initQuestProgress(charId)
    setProgress(p)
    setView('map')
  }

  function handleSelectArea(idx) {
    setAreaIdx(idx)
    setView('area')
  }

  function handleStartLearn() {
    setView('learn')
  }

  function handleLearnDone() {
    const p = markLearnDone(progress, AREAS[areaIdx].id)
    setProgress(p)
    setView('area')
  }

  function handleStartExam() {
    setView('exam')
  }

  function handleExamSubmit(score, correct, total) {
    const p = recordExamScore(progress, AREAS[areaIdx].id, score)
    setProgress(p)
    setExamScore(score)
    setExamStats({ correct, total })
    setView('result')
  }

  function handleReset() {
    setProgress(null)
    setView('char-select')
  }

  if (view === 'char-select') return <CharacterSelect onSelect={handleCharSelect} />

  if (view === 'map') return (
    <MapView
      progress={progress} char={char}
      onSelectArea={handleSelectArea}
      onReset={handleReset}
    />
  )

  if (view === 'area') return (
    <AreaDetail
      areaIdx={areaIdx} progress={progress} char={char}
      onStartLearn={handleStartLearn}
      onStartExam={handleStartExam}
      onBack={() => setView('map')}
    />
  )

  if (view === 'learn') return (
    <LearnView
      areaIdx={areaIdx} progress={progress} char={char}
      onDone={handleLearnDone}
      onBack={() => setView('area')}
    />
  )

  if (view === 'exam') return (
    <ExamView
      areaIdx={areaIdx} char={char}
      onSubmit={handleExamSubmit}
      onBack={() => setView('area')}
    />
  )

  if (view === 'result') return (
    <ResultView
      areaIdx={areaIdx}
      score={examScore}
      correct={examStats?.correct}
      total={examStats?.total}
      progress={progress}
      char={char}
      onBack={() => setView('map')}
      onRetryExam={() => setView('exam')}
      onRetryLearn={() => setView('learn')}
      onNextArea={() => {
        setAreaIdx(i => i + 1)
        setView('area')
      }}
    />
  )

  return null
}
