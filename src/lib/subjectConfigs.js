/**
 * subjectConfigs.js — 전 과목 데이터 → 통합 UnitConfig 스키마 어댑터
 *
 * UnitConfig {
 *   id, title,
 *   conceptCards: [{id, term, definition, keyPoint, practice}]
 *   quizItems:    [{id, type:'choice', stem, context, choices:[{value,text}], answer, hint, explanation}]
 * }
 */
import studyData    from '../../data/quality-mgmt-study.json'
import practiceData from '../../data/quality-mgmt-practice.json'

// ── 품질경영 ────────────────────────────────────────────────────────────────

// modelAnswer에서 확인/현장조치/기록·보고 3섹션 파싱
function parseAnswerSections(answer) {
  if (!answer || answer.length < 50) return []
  const parts = answer
    .split(/(?=확인할\s*것은|현장에서는|문제가\s*있으면)/)
    .map(p => p.trim())
    .filter(p => p.length > 15)
  if (parts.length < 2) return []
  return parts.map(p => ({
    type: /^확인/.test(p) ? 'check' : /^현장/.test(p) ? 'action' : 'record',
    text: p,
  }))
}

function extractConceptCards(questions, count = 4) {
  // 수행준거 3파트 면접형 우선 선발
  const interview = questions.filter(q =>
    q.heading?.includes('수행준거') &&
    q.teacherHints?.length > 0 &&
    (q.modelAnswer || q.answer)
  )
  const rest = questions.filter(q =>
    !q.heading?.includes('수행준거') &&
    q.teacherHints?.length > 0 &&
    (q.modelAnswer || q.answer)
  )
  const pool = [...interview, ...rest]

  return pool.slice(0, count).map(q => {
    const answer = q.modelAnswer || q.answer || ''
    const stemLine1 = (q.stem || '').split('\n')[0].trim()
    const isInterview = !!q.heading?.includes('수행준거')
    const sections = isInterview ? parseAnswerSections(answer) : []
    const lastHint = q.teacherHints[q.teacherHints.length - 1]
    return {
      id: q.id,
      term: stemLine1 || (q.stem || '').slice(0, 50),
      isInterview,
      sections,
      definition: answer,
      keyPoint: q.teacherHints[0]?.text?.slice(0, 160) || '',
      practice: lastHint?.text?.slice(0, 130) || '',
      label0: q.teacherHints[0]?.label || '핵심 포인트',
      label1: lastHint?.label || '실무 적용',
    }
  })
}

function buildQualityConfig() {
  const builtUnits = studyData.units.map(unit => {
    const pUnit = practiceData.units.find(u => u.id === unit.id)

    const quizItems = (pUnit?.questions ?? [])
      .filter(q => q.type === 'choice' && q.choices?.length > 0)
      .map(q => {
        // quality-mgmt-practice.json 은 stem(string) 사용
        // 구버전 stems(array) 포맷도 호환
        const stem = q.stem || (q.stems ?? [])
          .filter(s => s.type === 'text').map(s => s.text).join('\n')
        const ulPart = (q.stems ?? []).find(s => s.type === 'ul')
        const context = q.context || (ulPart ? ulPart.items.map(it => `• ${it}`).join('\n') : null)
        return {
          id: q.id,
          type: 'choice',
          stem,
          context,
          choices: q.choices,
          answer: q.answer,
          hint: null,
          explanation: q.explanation || null,
        }
      })
      .slice(0, 20)

    return {
      id: unit.id,
      title: unit.title,
      conceptCards: extractConceptCards(unit.questions, 4),
      quizItems,
    }
  })

  // 콘텐츠(개념카드·퀴즈) 둘 다 없는 빈 단원 제외 — 예: s08-8 "외부평가 전환 진단"(문항 0개)
  // → 자율학습 빈 화면 방지 + 진행율 분모(getSubjectConfig().unitIds)도 실제 학습 단원만 반영.
  const units = builtUnits.filter(u => u.quizItems.length > 0 || u.conceptCards.length > 0)

  return {
    id: 'quality',
    name: '품질경영',
    emoji: '⚙️',
    color: '#4F46E5',
    units,
    unitIds: units.map(u => u.id),
  }
}

// ── 캐시 + 공개 API ──────────────────────────────────────────────────────────

const cache = {}

export function getSubjectConfig(subjectId) {
  if (!cache[subjectId]) {
    if (subjectId === 'quality') cache[subjectId] = buildQualityConfig()
    // food-service, job-common 등은 Phase D에서 추가
    else return null
  }
  return cache[subjectId]
}
