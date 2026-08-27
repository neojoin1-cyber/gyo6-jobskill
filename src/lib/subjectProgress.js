/**
 * subjectProgress.js — 과목 "학습 진행율(숙달도)" 단일 소스.
 *
 * 재설계 배경: 기존 mastery.js는 (맞은 수 / 푼 수)= 정답률이라, 완전교재 인라인
 * 퀴즈 1개만 맞혀도 100%가 됐다. 이는 "학습 진행"이 아니라 작은 표본 정답률이다.
 *
 * 새 정의: 과목의 "전체 영역/단원"을 실제로 문제를 풀어(=능동 응답) 익힌 비율.
 *  - 패시브 열람(완전교재 블록 넘기기·빠른 다음 클릭)은 응답이 아니므로 0점.
 *  - 과목 진행율 = 전 영역/단원 숙달도의 평균 → 한 영역만 잘해도 100% 될 수 없음.
 *
 * 과목마다 학습 신호가 달라 소스를 3갈래로 둔다(모두 능동 학습만 반영):
 *  - job-common·ncs-basic·recruit-written·food-service: 문항 id 단위 정답 기록(recordQuestion) → 영역별 커버리지
 *  - quality: 단원 게임 최고점(unitProgress bestScore) → 단원별 숙달
 *  - interview: 단원 자기평가(iv_progress: done/review) → 단원별 진행
 *  - personality: 정답 없는 검사 → 진행율 개념 미적용(null)
 */
import jobQuestions from '../../data/questions.json'
import { ncs2026Questions as ncsQuestions } from './ncs2026.js'
import { recruitWrittenQuestions, RECRUIT_WRITTEN_TRACKS } from './recruitWritten.js'
import foodServiceQuestions from '../../data/food-service-questions.json'
import interviewStudy from '../../data/interview-study.json'
import { jcOfficialArea, JC_AREAS_ORDER, englishStudyQuestions, jobCommonMediaQuestions } from './jobCommonAreas.js'
import { loadProgress as loadUnitProgress } from './unitProgress.js'
import { getSubjectConfig } from './subjectConfigs.js'
import { supabase } from './supabase.js'
import { userLocalStorage as localStorage } from './userLocalStorage.js'

const STORE_KEY = 'nova_qprog_v1'
const TARGET_PER_AREA = 8    // 한 영역을 "숙달"로 보는 정답 문항 목표(영역 문항수보다 크면 문항수로 캡)
const UNIT_MASTER_SCORE = 80 // 품질: 단원 게임 점수 80=별3=숙달

// 품질 단원은 config와 동일 소스 사용(빈 단원 제외분 반영) — 진행율 분모 = 실제 학습 단원
const QUALITY_UNIT_IDS   = (getSubjectConfig('quality')?.unitIds) || []
const INTERVIEW_LESSONS  = (interviewStudy.lessons || []).map(l => l.id)

// ── 문항 진행 기록(localStorage) ─────────────────────────────────────────
// 형태: { [subjectId]: { [qid]: 1(정답 도달) | 0(응답했으나 미도달) } }
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') } catch { return {} }
}
function saveStore(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)) } catch {} }

/** 능동 응답 1건 기록. correct=true면 해당 문항을 '숙달 도달'로 고정(sticky). */
export function recordQuestion(subjectId, questionId, correct) {
  if (!subjectId || questionId == null) return
  const qid = String(questionId)
  const d = loadStore()
  const m = (d[subjectId] ??= {})
  if (correct) m[qid] = 1
  else if (m[qid] == null) m[qid] = 0
  saveStore(d)
}

function correctIdSet(subjectId) {
  const m = loadStore()[subjectId] || {}
  const s = new Set()
  for (const [qid, v] of Object.entries(m)) if (v === 1) s.add(qid)
  return s
}
function answeredCount(subjectId) {
  return Object.keys(loadStore()[subjectId] || {}).length
}

// ── 과목별 영역 인벤토리(문항→영역, 영역 문항수) ─────────────────────────
function buildAreaIndex(questions, areaOf, orderHint) {
  const idToArea = new Map()
  const areaCount = new Map()
  for (const q of questions) {
    if (!q || q.excludeFromQuiz) continue
    const a = areaOf(q)
    if (!a) continue
    idToArea.set(String(q.id), a)
    areaCount.set(a, (areaCount.get(a) || 0) + 1)
  }
  const order = []
  for (const a of (orderHint || [])) if (areaCount.has(a) && !order.includes(a)) order.push(a)
  for (const a of areaCount.keys()) if (!order.includes(a)) order.push(a)
  return { idToArea, areaCount, areas: order }
}

let _idx = null
function idx() {
  if (_idx) return _idx
  _idx = {
    'job-common':   buildAreaIndex([...jobQuestions, ...englishStudyQuestions, ...jobCommonMediaQuestions], jcOfficialArea, JC_AREAS_ORDER),
    'ncs-basic':    buildAreaIndex(ncsQuestions, q => q.area, null),
    'recruit-written': buildAreaIndex(
      recruitWrittenQuestions,
      q => `${q.recruitmentTrack}:${q.area}`,
      RECRUIT_WRITTEN_TRACKS.flatMap(track => track.sourceAreas.map(area => `${track.id}:${area}`)),
    ),
    // 식음료: 자율학습과 동일하게 능력단위(lessonKind==='unit', C01~C08)만 분모로.
    // (mock 시험지 M1~M5 lessonId는 학습 단원이 아니므로 제외)
    'food-service': buildAreaIndex(foodServiceQuestions, q => q.lessonKind === 'unit' ? q.lessonId : null, null),
  }
  return _idx
}

// ── 진행율 계산 ─────────────────────────────────────────────────────────
// (1) 영역·문항 기반: job-common / ncs-basic / recruit-written / food-service
function areaBasedProgress(subjectId) {
  const info = idx()[subjectId]
  if (!info || info.areas.length === 0) return null
  const correct = correctIdSet(subjectId)
  const perArea = new Map()
  for (const qid of correct) {
    const a = info.idToArea.get(qid)
    if (a) perArea.set(a, (perArea.get(a) || 0) + 1)
  }
  let sum = 0, done = 0, nextArea = null
  for (const a of info.areas) {
    const target = Math.min(TARGET_PER_AREA, info.areaCount.get(a) || TARGET_PER_AREA)
    const score = target > 0 ? Math.min(1, (perArea.get(a) || 0) / target) : 0
    sum += score
    if (score >= 1) done += 1
    else if (!nextArea) nextArea = a.includes(':') ? a.split(':').slice(1).join(':') : a
  }
  const total = info.areas.length
  return { pct: Math.round((sum / total) * 100), done, total, answered: answeredCount(subjectId), nextLabel: nextArea }
}

// (2) 품질: 단원 게임 최고점 기반(패시브로는 점수 못 냄)
function qualityProgress() {
  if (QUALITY_UNIT_IDS.length === 0) return null
  const p = loadUnitProgress('quality') || {}
  let sum = 0, done = 0
  for (const uid of QUALITY_UNIT_IDS) {
    const best = p[uid]?.bestScore ?? 0
    const score = Math.min(1, best / UNIT_MASTER_SCORE)
    sum += score
    if (score >= 1) done += 1
  }
  const total = QUALITY_UNIT_IDS.length
  return { pct: Math.round((sum / total) * 100), done, total, answered: null }
}

// (3) 면접: 단원 자기평가(iv_progress) 기반 — done=1.0, review(복습필요)=0.5
function interviewProgress() {
  if (INTERVIEW_LESSONS.length === 0) return null
  let iv = {}
  try { iv = JSON.parse(localStorage.getItem('iv_progress') || '{}') } catch { iv = {} }
  let sum = 0, done = 0, nextLabel = null
  for (const lesson of (interviewStudy.lessons || [])) {
    const st = iv[lesson.id]
    const score = st === 'done' ? 1 : st === 'review' ? 0.5 : 0
    sum += score
    if (score >= 1) done += 1
    else if (!nextLabel) nextLabel = lesson.title
  }
  const total = INTERVIEW_LESSONS.length
  return { pct: Math.round((sum / total) * 100), done, total, answered: null, nextLabel }
}

/**
 * 과목 진행율 반환. 없으면 null(막대 미표시).
 * @returns {{pct:number, done:number, total:number, answered:number|null}|null}
 */
export function getSubjectProgress(subjectId) {
  if (subjectId === 'quality')     return qualityProgress()
  if (subjectId === 'interview')   return interviewProgress()
  if (subjectId === 'personality') return null // 정답 없는 검사 — 진행율 개념 미적용
  return areaBasedProgress(subjectId)
}

export function getProgressColor(pct) {
  if (pct == null) return null
  if (pct >= 80) return '#10B981'
  if (pct >= 50) return '#F59E0B'
  return '#EF4444'
}

// ── 서버 동기화 ─────────────────────────────────────────────────────────
// 학생 카드와 교사·관리자 학습현황이 같은 기준을 보도록 진행율 pct를 서버에 미러링.
// 값이 바뀐 과목만 전송(세션 내 중복 방지). best-effort — 실패해도 학습 흐름 무방해.
const _syncedPct = {}
export async function syncSubjectProgress(subjectId) {
  const p = getSubjectProgress(subjectId)
  if (!p) return
  if (_syncedPct[subjectId] === p.pct) return
  _syncedPct[subjectId] = p.pct
  try {
    await supabase.rpc('rpc_sync_subject_progress', {
      p_subject_id: subjectId, p_pct: p.pct,
      p_sections_done: p.done, p_sections_total: p.total, p_answered: p.answered,
    })
  } catch { delete _syncedPct[subjectId] }
}
