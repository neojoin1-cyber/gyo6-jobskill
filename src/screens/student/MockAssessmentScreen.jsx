/**
 * MockAssessmentScreen — 실전 모의고사
 * 공식 규격은 고정하고, 기관별 구성이 다른 과목은 문항 수와 제한시간을 설정해 응시한다.
 * 객관식은 앱이 자동채점, 서술형은 교사 채점 대기로 저장되어 담당 교사에게 전송된다.
 * (자율학습과 분리된 별도 mock_assessments 테이블에 저장 — 랭킹에 영향 없음)
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { pushBack, popBack, triggerBack } from '../../lib/backButton.js'
import { supabase }         from '../../lib/supabase.js'
import MissionScreen        from './MissionScreen.jsx'
import JobAdaptationScreen  from './JobAdaptationScreen.jsx'
import { ncs2026Questions as ncsQuestions, buildNcs2026Areas } from '../../lib/ncs2026.js'
import { recruitWrittenQuestions, RECRUIT_WRITTEN_TRACKS } from '../../lib/recruitWritten.js'
import foodServiceQuestions from '../../lib/foodServiceBank.js'
import qualityMock          from '../../../data/mock-quality-pool.json'
import interviewMock        from '../../../data/mock-interview-pool.json'
import { buildSubjectMockPaper, getMockScopeCapacity } from '../../lib/mockData.js'
import {
  buildJcAreaPaper,
  buildJcMockAreas,
  JC_AREAS_ORDER,
  JC_OFFICIAL_SPECS,
} from '../../lib/jobCommonAreas.js'
import { ncsKeyCompare }         from '../../lib/ncsAreaPriority.js'
import { buildPassExam, gradePassExam, getPassSpec, PASS_SPECS } from '../../lib/passExam.js'
import { saveWrongAnswer } from '../../lib/wrongAnswers.js'
import { COMMON_ABILITY_COURSES } from '../../lib/officialStandards.js'

import { answerIdxOf } from '../../lib/questionNorm.js'
// 틀린 객관식/OX를 크로스기기 오답노트에 누적(food-service course_id=3)
function recordWrong(questions, mcqAnswers) {
  for (const q of questions) {
    if (q.questionMode !== 'mcq' && q.questionMode !== 'ox' &&
        q.practiceType !== 'choice' && q.practiceType !== 'ox') continue
    const sel = mcqAnswers[q.id]
    if (sel != null && sel !== answerIdxOf(q)) saveWrongAnswer(q, 3, String.fromCharCode(65 + sel))
  }
}

// 과목별 영역 목록 + 실제 문항 수 + 미션 빌더 ─────────────────────────────────
// 교육부·대한상의 직업공통능력 인증 5영역 — 공유 소스(jobCommonAreas)
// 로 자율학습·진단·모의고사가 모두 동일 5영역을 쓴다. 영어는 별도 뱅크라 questions 객체 직접 포함.
const buildJobAreas = buildJcMockAreas

function buildNcsAreas() {
  return buildNcs2026Areas(ncsQuestions).map(area => ({
    ...area,
    count: getMockScopeCapacity('ncs-basic', area.id),
    scopeKey: area.id,
    areaIds: [area.id],
  })).sort((a, b) => ncsKeyCompare(a.id, b.id))
}

function buildRecruitAreas() {
  return RECRUIT_WRITTEN_TRACKS.map(track => {
    const bankQuestions = recruitWrittenQuestions.filter(q =>
      !q.excludeFromQuiz && q.recruitmentTrack === track.id
    )
    const capacity = getMockScopeCapacity('recruit-written', track.label)
    return {
      id: track.id,
      displayName: track.label,
      description: track.summary,
      count: capacity,
      bankCount: bankQuestions.length,
      scopeKey: track.label,
      areaIds: [track.label],
    }
  }).filter(area => area.count > 0)
}

// 식음료서비스 내부 학습 단위 표시명
const FOOD_UNIT_NAMES = {
  C01: '식음료 영업 준비', C02: '식음료 영업장 예약 관리', C03: '환영 환송', C04: '식음료 주문',
  C05: '음료 서비스', C06: '음식 서비스', C07: '식음료 영업장 마감', C08: '식음료 영업장 위생안전관리',
}
function buildFoodAreas() {
  const map = {}
  for (const q of foodServiceQuestions) {
    if (q.excludeFromQuiz) continue
    const lid = q.lessonId
    if (!/^C0[1-8]$/.test(lid || '')) continue   // 통합 뱅크의 C01~C08 능력단위 문항 전체 집계
    if (!map[lid]) map[lid] = { id: lid, scopeKey: lid, displayName: FOOD_UNIT_NAMES[lid] || q.lessonTitle || lid, count: 0, areaIds: [lid], questionIds: [lid] }
    map[lid].count++
  }
  return Object.values(map).sort((a, b) => a.id.localeCompare(b.id))
}

// 품질·면접: 경량 풀(quiz만, area 태깅·questionMode 포함)에서 영역 구성 + 실제 문항 직접 포함.
// (job/ncs/food처럼 question_ids 패턴을 MissionScreen이 재해석하지 않고, questions 배열을 그대로 응시)
function buildAreasFromPool(poolFile, subjectId) {
  const nameOf = Object.fromEntries((poolFile.scopes || []).map(s => [s.key, s.name]))
  const map = {}
  for (const q of (poolFile.pool || [])) {
    const key = q._mockArea
    if (!map[key]) map[key] = { id: key, scopeKey: key, displayName: nameOf[key] || key, count: 0, areaIds: [key], questions: [] }
    map[key].questions.push(q)
  }
  for (const area of Object.values(map)) area.count = getMockScopeCapacity(subjectId, area.scopeKey)
  return (poolFile.scopes || []).map(s => map[s.key]).filter(a => a && a.count > 0)
}

const AREA_BUILDERS = {
  'job-common':   buildJobAreas,
  'ncs-basic':    buildNcsAreas,
  'recruit-written': buildRecruitAreas,
  'food-service': buildFoodAreas,
  'quality':      () => buildAreasFromPool(qualityMock, 'quality'),
  'interview':    () => buildAreasFromPool(interviewMock, 'interview'),
}

export default function MockAssessmentScreen({ subjectId, subjectName, onBack, onLearningContext }) {
  const [confirmArea,   setConfirmArea]   = useState(null)  // 시작 확인 모달 대상
  const [mockConfig,    setMockConfig]    = useState(null)  // 기관별 맞춤 모의 { area, count, minutes }
  const [activeMission, setActiveMission] = useState(null)  // 응시 중인 합성 미션
  const [openExams,     setOpenExams]     = useState([])    // 교사가 오픈한 과목별 모의고사
  const [passData,      setPassData]      = useState(null)  // 합격 판정 결과 { exam, mcqAnswers }
  const [selfPass,      setSelfPass]      = useState({})    // 면접 능력단위 자가 합격 { unit: bool }
  const [adaptation,    setAdaptation]    = useState(null)  // { full: bool, paperNo: number }
  const [fullComplete,  setFullComplete]  = useState(false)
  const [fullBreak,     setFullBreak]     = useState(null)  // { paperNo, nextIndex, completedArea }

  const areas = useMemo(() => (AREA_BUILDERS[subjectId]?.() ?? []), [subjectId])

  useEffect(() => {
    onLearningContext?.({
      subject: subjectId,
      mode: 'mock',
      stage: activeMission ? 'question' : passData ? 'result' : 'intro',
      areaLabel: mockConfig?.area?.displayName || subjectName,
      lessonLabel: activeMission?.title || (passData ? '모의평가 결과' : '모의평가 범위 선택'),
      title: activeMission?.title || subjectName,
    })
  }, [activeMission, mockConfig?.area?.displayName, onLearningContext, passData, subjectId, subjectName])

  // 교사가 오픈한 과목별 모의고사 조회(RLS: 내 학급 + 열린 것만)
  useEffect(() => {
    supabase.from('open_mock_exams')
      .select('id, title, subject_id, question_count, time_limit_min, scope, paper_no')
      .eq('subject_id', subjectId)
      .is('closed_at', null)
      .then(({ data }) => setOpenExams(data ?? []))
  }, [subjectId])

  function startExam(exam) {
    // 사전 시험지(scope/paper_no)면 30문항을 결정적·빈출가중으로 생성해 명시 출제.
    // 레거시(scope 없음)는 기존처럼 과목 전체에서 question_count만큼 랜덤.
    const paper = exam.scope ? buildSubjectMockPaper(subjectId, exam.scope, exam.paper_no, exam.question_count) : null
    if (exam.scope && (!paper || paper.length === 0)) {
      alert('이 모의고사의 시험지를 생성하지 못했습니다. 선생님께 문의해 주세요.')
      return
    }
    setActiveMission({
      id:    null,
      mock:  { kind: 'exam' },
      title: `${exam.title}`,
      subject_id:     subjectId,
      questions:      paper || undefined,        // 변형 적용 문항 객체 그대로 전달(원본 재조회 방지)
      question_ids:   paper ? paper.map(q => q.id) : [],
      area_ids:       [],
      question_count: paper ? paper.length : exam.question_count,
      shuffle:        paper ? false : true,   // 생성 시험지는 이미 시드 셔플됨 → 순서 유지
      time_limit_min: exam.time_limit_min,
    })
  }

  // 외부평가 대비 학습 준비도 점검. 공식 합격 판정으로 사용하지 않는다.
  function startPassExam(paperNo) {
    const exam = buildPassExam(subjectId, paperNo)
    const spec = exam.spec
    setSelfPass({})
    setActiveMission({
      id:    null,
      mock:  { kind: 'pass' },
      title: `🎯 외부평가 대비 준비도 점검 ${paperNo}회`,
      subject_id:     subjectId,
      questions:      exam.questions,
      question_count: exam.questions.length,
      shuffle:        false,
      time_limit_min: spec.written.timeMin + spec.interview.timeMin,
      onComplete: ({ mcqAnswers }) => {
        recordWrong(exam.questions, mcqAnswers)          // 오답 → 크로스기기 오답노트
        const g = gradePassExam(exam, mcqAnswers, {})
        // 학습 준비도 결과를 공식 합격 이력 테이블에 저장하지 않는다.
        if (!spec.readinessOnly) {
          supabase.rpc('rpc_save_pass_result', {
            p_subject_id: subjectId, p_paper_no: paperNo,
            p_unit_scores: g.units.map(u => ({ unit: u.unit, name: u.name, score: u.score, pass: u.pass, isWritten: u.isWritten })),
            p_passed_count: g.passedCount, p_verdict: g.verdict, p_weak_units: g.weakUnits,
          }).then(() => {}, () => {})
        }
        setActiveMission(null); setPassData({ exam, mcqAnswers, paperNo })
      },
    })
  }

  // 🎯 약점 능력단위 집중 복습: 틀린(객관식/OX)·면접 문항을 즉시 피드백 드릴로 다시 풀기
  function startWeakReview(exam, mcqAnswers, weakUnits) {
    const set = new Set(weakUnits)
    const review = exam.questions.filter(q => {
      if (!set.has(q._mockArea || q.lessonId)) return false   // 단원키: 품질 _mockArea / 식음료 lessonId
      if (q.questionMode === 'mcq' || q.questionMode === 'ox') return mcqAnswers[q.id] !== answerIdx(q.answer)
      return true   // 면접/서술형은 복습에 포함
    })
    if (review.length === 0) return
    setPassData(null)
    setActiveMission({
      id: null, mock: { kind: 'review' }, title: '🎯 약점 집중 복습',
      subject_id: subjectId, questions: review, question_count: review.length,
      shuffle: true, time_limit_min: null,   // 시간제한 없음 → 즉시 정답·해설 피드백
      onComplete: ({ mcqAnswers: a2 }) => { recordWrong(review, a2); setActiveMission(null) },
    })
  }

  // Android 뒤로가기: 응시 중 → 판정결과 → 확인모달 → 영역목록 → 상위
  const backRef = useRef(null)
  backRef.current = () => {
    if (activeMission) { return }
    if (fullComplete)  { setFullComplete(false); return }
    if (fullBreak)     { setFullBreak(null); return }
    if (passData)      { setPassData(null); return }
    if (mockConfig)    { setMockConfig(null); return }
    if (confirmArea)   { setConfirmArea(null); return }
    onBack?.()
  }
  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openArea(area) {
    if (subjectId === 'job-common') {
      setConfirmArea(area)
      return
    }
    const preferred = [40, 30, 20, 10, 5].find(n => n <= area.count) || area.count
    setMockConfig({ area, count: preferred, minutes: Math.max(5, preferred) })
  }

  function nextPaperNo(area) {
    const key = `mock_attempt_${subjectId}_${area.scopeKey || area.id}`
    const current = Number(localStorage.getItem(key) || 0) + 1
    try { localStorage.setItem(key, String(current)) } catch {}
    return current
  }

  function startConfiguredExam() {
    const config = mockConfig
    if (!config) return
    const { area } = config
    const paperNo = nextPaperNo(area)
    const paper = buildSubjectMockPaper(subjectId, area.scopeKey || area.id, paperNo, config.count)
    if (!paper.length) {
      alert('선택한 조건으로 시험지를 만들 수 없습니다. 문항 수를 줄여 다시 시도해 주세요.')
      return
    }
    setMockConfig(null)
    setActiveMission({
      id: null,
      mock: { kind: 'exam', scope: area.scopeKey || area.id, paperNo },
      title: `${subjectName} · ${area.displayName} 모의고사`,
      subject_id: subjectId,
      questions: paper,
      question_ids: paper.map(q => q.id),
      area_ids: area.areaIds,
      question_count: paper.length,
      shuffle: false,
      time_limit_min: config.minutes,
      lockNavigation: false,
    })
  }

  function startArea(area) {
    setConfirmArea(null)
    if (subjectId === 'job-common' && area.assessmentType === 'likert') {
      setAdaptation({ full: false, paperNo: 1 })
      return
    }
    const officialPaper = subjectId === 'job-common'
      ? buildJcAreaPaper(area.id, 1)
      : null
    setActiveMission({
      id:    null,
      mock:  { kind: 'area' },
      title: `${subjectName} · ${area.displayName} 모의고사`,
      subject_id:     subjectId,
      // 문항 객체를 직접 보유한 영역(품질·면접)은 그대로 응시, 아니면 question_ids 패턴 사용
      questions:      officialPaper || area.questions || undefined,
      question_ids:   officialPaper
        ? officialPaper.map(q => q.id)
        : area.questions ? area.questions.map(q => q.id) : area.questionIds,
      area_ids:       area.areaIds,
      question_count: officialPaper ? officialPaper.length : area.count,
      shuffle:        false,        // 순서대로 제시
      time_limit_min: subjectId === 'job-common' ? area.minutes : null,
      lockNavigation: subjectId === 'job-common',
    })
  }

  const cognitiveAreaNames = JC_AREAS_ORDER.filter(name => name !== '직무적응')

  function startJobCommonSection(paperNo, sectionIndex = 0) {
    const areaName = cognitiveAreaNames[sectionIndex]
    const spec = JC_OFFICIAL_SPECS[areaName]
    const paper = buildJcAreaPaper(areaName, paperNo)
    if (!spec || paper.length !== spec.count) {
      alert(`${areaName} 시험지를 완성하지 못했습니다. (${paper.length}/${spec?.count ?? 0}문항)`)
      return
    }
    setFullComplete(false)
    setFullBreak(null)
    setActiveMission({
      id: null,
      mock: { kind: 'official-certification-section', section: areaName },
      title: `${COMMON_ABILITY_COURSES['job-common'].title} 실전 ${paperNo}회 · ${sectionIndex + 1}교시 ${areaName}`,
      subject_id: 'job-common',
      questions: paper,
      question_count: paper.length,
      shuffle: false,
      time_limit_min: spec.minutes,
      lockNavigation: true,
      onComplete: () => {
        setActiveMission(null)
        const nextIndex = sectionIndex + 1
        if (nextIndex < cognitiveAreaNames.length) {
          setFullBreak({ paperNo, nextIndex, completedArea: areaName })
        } else {
          setAdaptation({ full: true, paperNo })
        }
      },
    })
  }

  function startJobCommonFull(paperNo) {
    startJobCommonSection(paperNo, 0)
  }

  // ── 응시 화면 ──
  if (activeMission) {
    return (
      <MissionScreen
        mission={activeMission}
        onBack={() => setActiveMission(null)}
      />
    )
  }

  if (fullBreak) {
    const nextArea = cognitiveAreaNames[fullBreak.nextIndex]
    const nextSpec = JC_OFFICIAL_SPECS[nextArea]
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>
          <span className="appbar-title">교시 완료</span>
        </div>
        <div className="screen-body" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="card" style={{ textAlign: 'center', border: '2px solid #4f46e5' }}>
            <p style={{ fontSize: 42, marginBottom: 8 }}>✓</p>
            <h2 style={{ fontSize: 19, marginBottom: 8 }}>{fullBreak.completedArea} 교시를 마쳤습니다</h2>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: 16 }}>
              다음은 <b>{fullBreak.nextIndex + 1}교시 {nextArea}</b>입니다.<br />
              {nextSpec.count}문항을 {nextSpec.minutes}분 동안 응시합니다.
            </p>
            <button className="btn btn-primary btn-full"
              onClick={() => startJobCommonSection(fullBreak.paperNo, fullBreak.nextIndex)}>
              다음 교시 시작
            </button>
            <button className="btn btn-ghost btn-full" style={{ marginTop: 8 }} onClick={() => setFullBreak(null)}>
              실전 모의 종료
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (adaptation) {
    return (
      <JobAdaptationScreen
        mode="full"
        paperNo={adaptation.paperNo}
        onBack={() => setAdaptation(null)}
        onComplete={() => {
          const wasFull = adaptation.full
          setAdaptation(null)
          if (wasFull) setFullComplete(true)
        }}
      />
    )
  }

  if (fullComplete) {
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>
          <span className="appbar-title">교육부 직업공통능력 인증 실전 완료</span>
        </div>
        <div className="screen-body" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="card" style={{ textAlign: 'center', border: '2px solid #0f766e' }}>
            <p style={{ fontSize: 42, marginBottom: 8 }}>완료</p>
            <h2 style={{ fontSize: 19, marginBottom: 8 }}>5영역 규모 실전 모의를 마쳤습니다</h2>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: 16 }}>
              인지영역 182문항과 직무적응 160문항, 총 342문항을 공식 제한시간 구성으로 응시했습니다.
              앱 결과는 학습용이며 공식 인증 결과를 대신하지 않습니다.
            </p>
            <button className="btn btn-primary btn-full" onClick={() => setFullComplete(false)}>모의고사 목록으로</button>
          </div>
        </div>
      </div>
    )
  }

  // ── 학습 준비도 결과 ──
  if (passData) {
    const spec = passData.exam.spec
    const grade = gradePassExam(passData.exam, passData.mcqAnswers, selfPass)
    const vm = {
      pass:    { icon: '🎉', label: '준비도 양호',         color: 'var(--success)', desc: `${spec.passUnits}개 능력단위에서 학습 기준을 충족했습니다` },
      fail:    { icon: '⚠️', label: '보완 학습 필요',      color: 'var(--danger)',  desc: '약점 능력단위를 복습한 뒤 다시 점검해 보세요' },
      pending: { icon: '📝', label: '면접 자가확인 필요',  color: 'var(--primary)', desc: '면접 답변을 스스로 확인하면 준비도가 정리됩니다' },
    }[grade.verdict]
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>
          <span className="appbar-title">🎯 외부평가 대비 학습 준비도</span>
        </div>
        <div className="screen-body">
          <div style={{ textAlign: 'center', padding: '24px 0 12px' }}>
            <div style={{ fontSize: 60 }}>{vm.icon}</div>
            <p style={{ fontSize: 26, fontWeight: 800, color: vm.color, marginTop: 6 }}>{vm.label}</p>
            <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 13 }}>{vm.desc}</p>
            <p style={{ marginTop: 12 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>{grade.passedCount}</span>
              <span style={{ color: 'var(--text-muted)' }}> / {spec.totalUnits} 능력단위 기준 충족 (학습 목표 {spec.passUnits}개)</span>
            </p>
          </div>

          <p className="section-title">📝 지필 ({spec.written.timeMin}분) · 자동 채점</p>
          {grade.units.filter(u => u.isWritten).map(u => (
            <div key={u.unit} className="card" style={{ marginBottom: 8, borderLeft: `4px solid ${u.pass ? 'var(--success)' : 'var(--danger)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.correct}/{u.autoCount} 정답</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: u.pass ? 'var(--success)' : 'var(--danger)' }}>{u.score}점</p>
                <span style={{ fontSize: 12, fontWeight: 700, color: u.pass ? 'var(--success)' : 'var(--danger)' }}>{u.pass ? '준비됨' : '보완 필요'} ({spec.passLine}점 기준)</span>
              </div>
            </div>
          ))}

          <p className="section-title">🎤 면접 ({spec.interview.timeMin}분) · {spec.interviewAuto ? '지식 자동채점(실전은 구술 평가)' : '모범답안과 비교해 스스로 평가'}</p>
          {grade.units.filter(u => !u.isWritten).map(u => (
            spec.interviewAuto ? (
              // 면접 단위 MCQ는 실제 구술 합격이 아닌 지식 준비도만 표시한다.
              <div key={u.unit} className="card" style={{ marginBottom: 8, borderLeft: `4px solid ${u.pass ? 'var(--success)' : 'var(--danger)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.correct}/{u.autoCount} 정답 · 구술 전 지식 점검</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: u.pass ? 'var(--success)' : 'var(--danger)' }}>{u.score}점</p>
                  <span style={{ fontSize: 12, fontWeight: 700, color: u.pass ? 'var(--success)' : 'var(--danger)' }}>{u.pass ? '준비됨' : '보완 필요'} ({spec.passLine}점 기준)</span>
                </div>
              </div>
            ) : (
              <div key={u.unit} className="card" style={{ marginBottom: 8 }}>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{u.name}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setSelfPass(p => ({ ...p, [u.unit]: true }))}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      border: `2px solid ${selfPass[u.unit] === true ? 'var(--success)' : 'var(--border)'}`,
                      background: selfPass[u.unit] === true ? 'var(--success)' : 'var(--card)', color: selfPass[u.unit] === true ? '#fff' : 'var(--text-muted)' }}>
                    충분히 답함
                  </button>
                  <button onClick={() => setSelfPass(p => ({ ...p, [u.unit]: false }))}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      border: `2px solid ${selfPass[u.unit] === false ? 'var(--danger)' : 'var(--border)'}`,
                      background: selfPass[u.unit] === false ? 'var(--danger)' : 'var(--card)', color: selfPass[u.unit] === false ? '#fff' : 'var(--text-muted)' }}>
                    보완 필요
                  </button>
                </div>
              </div>
            )
          ))}

          {grade.weakUnits.length > 0 && (
            <div style={{ background: '#fff8e1', border: '1px solid #f9a825', borderRadius: 10, padding: '12px 14px', margin: '10px 0' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#e65100', marginBottom: 4 }}>💪 약점 능력단위 — 집중 복습 권장</p>
              <p style={{ fontSize: 12, color: '#e65100', lineHeight: 1.6, marginBottom: 10 }}>{grade.weakUnits.map(u => spec.unitNames[u]).join(' · ')}</p>
              <button className="btn btn-primary btn-full"
                onClick={() => startWeakReview(passData.exam, passData.mcqAnswers, grade.weakUnits)}>
                🎯 약점 집중 복습 시작
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { const next = (passData.paperNo % 5) + 1; setPassData(null); startPassExam(next) }}>다른 회차 응시</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setPassData(null)}>닫기</button>
          </div>
        </div>
      </div>
    )
  }

  const totalCount = areas.reduce((n, a) => n + a.count, 0)

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>
        <span className="appbar-title">📝 {subjectName} 모의고사</span>
      </div>

      <div className="screen-body">
        <div style={{ background: '#EFF6FF', border: '1px solid #60A5FA', borderRadius: 12, padding: '13px 14px', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 900, color: '#1D4ED8', marginBottom: 4 }}>실전 시험 재현</p>
          <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.65 }}>
            제한시간 적용 · 응시 중 정답과 해설 미공개 · 종료 후 채점. {subjectId === 'job-common' ? '공개된 공식 규격은 문항 수와 시간이 고정됩니다.' : '실제 지원 기관의 공고에 맞춰 문항 수와 시간을 설정하세요.'}
          </p>
        </div>
        {subjectId === 'job-common' && (
          <div style={{
            background: 'linear-gradient(145deg,#eef2ff,#ecfdf5)',
            border: '2px solid #4f46e5',
            borderRadius: 14,
            padding: 15,
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 15, fontWeight: 900, color: '#3730a3', marginBottom: 5 }}>
              3학년 인증진단 실전 모의
            </p>
            <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.65, marginBottom: 10 }}>
              공개된 2026 구성을 반영한 5영역 342문항 · 총 240분입니다.
              국어·영어·수리활용·문제해결은 각각 50분 교시로 진행하고, 직무적응 160문항은 40분 동안 응답합니다.
              문항 반복을 막기 위해 현재 검증된 공식 규모 시험지는 1회만 제공합니다.
            </p>
            <button
              onClick={() => startJobCommonFull(1)}
              className="btn btn-primary btn-full"
            >
              인증진단 실전 1회 시작
            </button>
          </div>
        )}
        {/* 교사가 오픈한 과목별 모의고사 */}
        {openExams.length > 0 && (
          <>
            <p className="section-title" style={{ marginTop: 0 }}>📝 과목별 모의고사 (선생님 오픈)</p>
            {openExams.map(ex => (
              <button key={ex.id} onClick={() => startExam(ex)}
                style={{
                  width: '100%', textAlign: 'left', background: 'var(--card)',
                  border: '2px solid var(--primary)', borderRadius: 12,
                  padding: '14px', marginBottom: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                <div style={{ fontSize: 24 }}>⏱️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{ex.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {ex.question_count}문항 · 제한 {ex.time_limit_min}분 · 시간제한 시험
                  </p>
                </div>
                <span style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>응시 →</span>
              </button>
            ))}
          </>
        )}

        {/* 공식 결과를 대신하지 않는 외부평가 대비 학습 준비도 점검 */}
        {PASS_SPECS[subjectId] && (() => { const sp = getPassSpec(subjectId); return (
          <div style={{ background: '#eef2ff', border: '2px solid var(--primary)', borderRadius: 12, padding: '14px', marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>🎯 외부평가 대비 학습 준비도 점검</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
              능력단위별 내부 학습 기준 반영 — 지필 {sp.written.units.length}능력단위({sp.written.timeMin}분) + 면접 {sp.interview.units.length}능력단위({sp.interview.timeMin}분).
              능력단위별 준비도를 점검하며, 이 결과는 공식 외부평가 합격 판정을 대신하지 않습니다.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => startPassExam(n)}
                  style={{ flex: '1 0 28%', padding: '10px 0', borderRadius: 8, border: '1px solid var(--primary)', background: 'var(--card)', color: 'var(--primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {n}회 응시
                </button>
              ))}
            </div>
          </div>
        )})()}

        <div style={{
          background: 'var(--primary-light)', border: '1px solid var(--primary)',
          borderRadius: 12, padding: '12px 14px', marginBottom: 16,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
            맞춤 모의고사
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {subjectId === 'job-common'
              ? <>영역을 선택하면 <b>2026 공개 규격의 문항 수와 제한시간</b>으로 응시합니다. 직무적응은 정답 없는 5점 척도로 별도 진단합니다.</>
              : subjectId === 'recruit-written'
                ? <>지원 분야를 선택한 뒤 <b>문항 수와 제한시간</b>을 채용공고 기준으로 설정합니다.</>
              : <>영역을 선택한 뒤 <b>문항 수와 제한시간</b>을 설정합니다. 정답과 해설은 시험 종료 후 공개됩니다.</>}
          </p>
        </div>

        <p className="section-title">영역 선택 · 총 {totalCount}문항</p>

        {areas.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon">🗂️</span>
            <span className="empty-state-title">응시 가능한 영역이 없습니다</span>
          </div>
        )}

        {areas.map(area => (
          <button key={area.id} onClick={() => openArea(area)}
            style={{
              width: '100%', textAlign: 'left', background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: 12,
              padding: '14px', marginBottom: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{area.displayName}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {area.group ? `${area.group} · ` : ''}사용 가능 {area.count}문항{area.minutes ? ` · 공식 ${area.minutes}분` : ''}
                {area.bankCount ? ` · 문항은행 ${area.bankCount}` : ''}
              </p>
            </div>
            <span style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{subjectId === 'job-common' ? '규격 확인 →' : '설정 →'}</span>
          </button>
        ))}
      </div>

      {/* 기관별 시험 구성이 다른 과목의 맞춤 설정 */}
      {mockConfig && (() => {
        const max = mockConfig.area.count
        const countPresets = [5, 10, 20, 30, 40].filter(n => n <= max)
        const timeProfiles = [
          { label: '속도', minutes: Math.max(1, Math.ceil(mockConfig.count * .75)) },
          { label: '표준', minutes: Math.max(5, mockConfig.count) },
          { label: '여유', minutes: Math.max(5, Math.ceil(mockConfig.count * 1.5)) },
        ].filter((item, idx, all) => all.findIndex(other => other.minutes === item.minutes) === idx)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
            <div className="card" style={{ width: '100%', maxWidth: 360, padding: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#1D4ED8', marginBottom: 4 }}>맞춤 모의고사 설정</p>
              <p style={{ fontSize: 17, fontWeight: 900, marginBottom: 4 }}>{mockConfig.area.displayName}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 16 }}>문항은행 {max}개 · 지원 공고의 문항 수와 시간에 맞추는 것을 권장함</p>

              <label style={configLabel}>문항 수</label>
              <div style={configSegments}>
                {countPresets.map(n => <button key={n} onClick={() => setMockConfig(c => ({ ...c, count: n, minutes: Math.max(5, n) }))} style={{ ...configSegment, ...(mockConfig.count === n ? configSegmentActive : {}) }}>{n}</button>)}
              </div>
              <div style={numberRow}>
                <button aria-label="문항 수 줄이기" onClick={() => setMockConfig(c => ({ ...c, count: Math.max(1, c.count - 1) }))} style={stepperBtn}>−</button>
                <input aria-label="문항 수" type="number" min="1" max={max} value={mockConfig.count} onChange={e => setMockConfig(c => ({ ...c, count: Math.min(max, Math.max(1, Number(e.target.value) || 1)) }))} style={numberInput} />
                <button aria-label="문항 수 늘리기" onClick={() => setMockConfig(c => ({ ...c, count: Math.min(max, c.count + 1) }))} style={stepperBtn}>＋</button>
              </div>

              <label style={{ ...configLabel, marginTop: 14 }}>제한시간</label>
              <div style={configSegments}>
                {timeProfiles.map(profile => <button key={profile.minutes} onClick={() => setMockConfig(c => ({ ...c, minutes: profile.minutes }))} style={{ ...configSegment, ...(mockConfig.minutes === profile.minutes ? configSegmentActive : {}) }}>{profile.label}<span style={{ display: 'block', fontSize: 11 }}>{profile.minutes}분</span></button>)}
              </div>
              <div style={numberRow}>
                <button aria-label="제한시간 줄이기" onClick={() => setMockConfig(c => ({ ...c, minutes: Math.max(1, c.minutes - 1) }))} style={stepperBtn}>−</button>
                <input aria-label="제한시간" type="number" min="1" max="300" value={mockConfig.minutes} onChange={e => setMockConfig(c => ({ ...c, minutes: Math.min(300, Math.max(1, Number(e.target.value) || 1)) }))} style={numberInput} />
                <button aria-label="제한시간 늘리기" onClick={() => setMockConfig(c => ({ ...c, minutes: Math.min(300, c.minutes + 1) }))} style={stepperBtn}>＋</button>
              </div>

              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 12px', margin: '16px 0', fontSize: 13, lineHeight: 1.6 }}>
                <b>{mockConfig.count}문항 · {mockConfig.minutes}분</b> · 문항당 약 {Math.round(mockConfig.minutes * 60 / mockConfig.count)}초<br />
                중간 해설 없음 · 문항 이동/체크 가능 · 종료 후 채점
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setMockConfig(null)}>취소</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={startConfiguredExam}>시험 시작</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 시작 확인 모달 */}
      {confirmArea && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24 }}>
          <div className="card" style={{ width: '100%', maxWidth: 320, textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>📝</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{confirmArea.displayName}</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
              전체 <b style={{ color: 'var(--primary)' }}>{confirmArea.count}문항</b>
              {confirmArea.minutes ? ` · ${confirmArea.minutes}분` : ''}으로 응시합니다.<br />
              {confirmArea.assessmentType === 'likert' ? '정답 없이 평소의 자신을 기준으로 솔직하게 답하세요.' : ''}
              중간에 나가면 진행 상황이 사라집니다.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmArea(null)}>취소</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => startArea(confirmArea)}>시작</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const configLabel = { display: 'block', fontSize: 12.5, fontWeight: 900, marginBottom: 7 }
const configSegments = { display: 'flex', gap: 5, padding: 4, background: 'var(--bg)', borderRadius: 10 }
const configSegment = { flex: 1, minHeight: 40, border: '1px solid transparent', borderRadius: 8, background: 'transparent', color: 'var(--text-muted)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }
const configSegmentActive = { background: 'var(--card)', color: 'var(--primary)', borderColor: 'var(--primary)' }
const numberRow = { display: 'grid', gridTemplateColumns: '44px 1fr 44px', gap: 7, marginTop: 7 }
const stepperBtn = { minHeight: 42, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--text)', fontSize: 20, fontWeight: 800, cursor: 'pointer' }
const numberInput = { width: '100%', minHeight: 42, boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--text)', textAlign: 'center', fontSize: 15, fontWeight: 900 }
