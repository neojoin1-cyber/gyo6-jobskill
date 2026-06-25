import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import areaMapping          from '../../../data/areaMapping.json'
import ncsQuestions         from '../../../data/ncs-questions.json'
import foodServiceQuestions from '../../../data/food-service-questions.json'

const MISSION_TYPES = ['이번시간', '오늘', '이번주', '중간고사', '기말고사', '인증평가']

// NCS 영역 목록
const NCS_AREAS = (() => {
  const map = {}
  for (const q of ncsQuestions) {
    if (!q.excludeFromQuiz && q.area) {
      if (!map[q.area]) map[q.area] = { id: q.area, displayName: q.area, totalQuestions: 0 }
      map[q.area].totalQuestions++
    }
  }
  return Object.values(map).sort((a, b) => b.totalQuestions - a.totalQuestions)
})()

// 식음료서비스 장별 목록 (단원만, 모의평가 제외)
const FOOD_SERVICE_AREAS = (() => {
  const map = {}
  for (const q of foodServiceQuestions) {
    if (q.excludeFromQuiz || q.lessonKind !== 'unit') continue
    const key = q.lessonId
    if (!map[key]) map[key] = { id: key, displayName: q.lessonTitle, totalQuestions: 0 }
    map[key].totalQuestions++
  }
  return Object.values(map).sort((a, b) => a.id.localeCompare(b.id))
})()

export default function MissionCreateScreen({ classId, className, onBack }) {
  const [availableSubjects, setAvailableSubjects] = useState([])
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState(null)
  const [missionType, setMissionType] = useState('이번시간')
  const [selectedAreas, setSelectedAreas] = useState([])
  const [selectedLessons, setSelectedLessons] = useState([])
  const [questionCount, setQuestionCount] = useState(10)
  const [timeLimitMin, setTimeLimitMin] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [shuffle, setShuffle] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // 교사에게 배정된 과목 조회 (없으면 전체 subject 표시)
    supabase.from('teacher_subjects').select('subject_id, subjects(id, name, description)')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const subs = data.map(r => r.subjects)
          setAvailableSubjects(subs)
          setSubjectId(subs[0].id)
        } else {
          // 배정 없으면 전체 subjects 표시
          supabase.from('subjects').select('id, name, description').then(({ data: all }) => {
            setAvailableSubjects(all ?? [])
            setSubjectId((all ?? [])[0]?.id ?? 'job-common')
          })
        }
      })
  }, [])

  // 과목 전환 시 영역 선택 초기화
  function switchSubject(id) {
    setSubjectId(id)
    setSelectedAreas([])
    setSelectedLessons([])
  }

  function toggleArea(areaId) {
    setSelectedAreas(prev =>
      prev.includes(areaId) ? prev.filter(a => a !== areaId) : [...prev, areaId]
    )
    if (subjectId === 'job-common') {
      setSelectedLessons(prev => {
        const areaLessons = areaMapping.areas.find(a => a.id === areaId)?.lessons.map(l => l.id) ?? []
        if (selectedAreas.includes(areaId)) {
          return prev.filter(l => !areaLessons.includes(l))
        }
        return prev
      })
    }
  }

  function toggleLesson(lessonId) {
    setSelectedLessons(prev =>
      prev.includes(lessonId) ? prev.filter(l => l !== lessonId) : [...prev, lessonId]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('미션 제목을 입력하세요.'); return }
    if (selectedAreas.length === 0 && selectedLessons.length === 0) {
      setError('영역을 하나 이상 선택하세요.')
      return
    }

    let questionIds = []
    let areaIds = [...selectedAreas]

    if (subjectId === 'job-common') {
      const allLessonIds = areaMapping.areas.flatMap(a => {
        if (selectedAreas.includes(a.id)) return a.lessons.map(l => l.id)
        return a.lessons.filter(l => selectedLessons.includes(l.id)).map(l => l.id)
      })
      questionIds = allLessonIds.map(lid => `${lid}-Q*`)
      if (areaIds.length === 0) areaIds = allLessonIds
    } else if (subjectId === 'food-service') {
      // 식음료서비스: lessonId(C01, C02...) 기반
      questionIds = selectedAreas   // e.g. ["C01", "C03"]
      areaIds = selectedAreas
    } else {
      // NCS: area 이름 기반
      questionIds = selectedAreas.map(a => `area:${a}`)
      areaIds = selectedAreas
    }

    setLoading(true)
    const { error: err } = await supabase.rpc('rpc_create_mission', {
      p_class_id: classId,
      p_title: title.trim(),
      p_mission_type: missionType,
      p_question_ids: questionIds,
      p_area_ids: areaIds,
      p_question_count: questionCount,
      p_time_limit_min: timeLimitMin ? parseInt(timeLimitMin) : null,
      p_shuffle: shuffle,
      p_due_at: dueDate ? new Date(dueDate).toISOString() : null,
    })

    // subject_id 별도 업데이트 (rpc는 subject_id 파라미터 없음)
    if (!err && subjectId !== 'job-common') {
      // 방금 생성된 미션의 subject_id 업데이트 (최신 draft 미션)
      await supabase.from('missions')
        .update({ subject_id: subjectId })
        .eq('class_id', classId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
    }

    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess('미션이 생성되었습니다 (초안 상태). 대시보드에서 활성화하세요.')
    setTimeout(onBack, 1800)
  }

  const isNCS         = subjectId === 'ncs-basic'
  const isFoodService = subjectId === 'food-service'
  const visibleAreas  = isNCS ? NCS_AREAS : isFoodService ? FOOD_SERVICE_AREAS : areaMapping.areas

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={onBack}>←</button>
        <span className="appbar-title">{className} — 미션 만들기</span>
      </div>

      <div className="screen-body">
        <form onSubmit={handleSubmit}>

          {/* 과목 선택 */}
          <div className="form-group">
            <label className="form-label">과목</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {availableSubjects.map(s => (
                <button key={s.id} type="button"
                  className={`btn ${subjectId === s.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, padding: '10px 8px', fontSize: 13, flexDirection: 'column', height: 'auto' }}
                  onClick={() => switchSubject(s.id)}>
                  <span style={{ fontWeight: 700 }}>{s.name}</span>
                  <span style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">미션 제목</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 1학기 중간고사 의사소통능력" required />
          </div>

          <div className="form-group">
            <label className="form-label">미션 유형</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {MISSION_TYPES.map(t => (
                <button key={t} type="button"
                  className={`btn ${missionType === t ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '8px 14px', fontSize: 13 }}
                  onClick={() => setMissionType(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">출제 영역 선택</label>
            {visibleAreas.map(area => (
              <div key={area.id || area.displayName} style={{ marginBottom: isNCS ? 6 : 12 }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: selectedAreas.includes(area.id || area.displayName) ? 'var(--primary-light)' : 'var(--card)',
                  borderRadius: 10,
                  border: `1.5px solid ${selectedAreas.includes(area.id || area.displayName) ? 'var(--primary)' : 'var(--border)'}`,
                  cursor: 'pointer',
                }}>
                  <input type="checkbox"
                    checked={selectedAreas.includes(area.id || area.displayName)}
                    onChange={() => toggleArea(area.id || area.displayName)} />
                  <span style={{ fontWeight: 700 }}>{area.displayName}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{area.totalQuestions}문항</span>
                </label>
                {/* 직업공통능력만 단원 세부 선택 가능 */}
                {!isNCS && !isFoodService && !selectedAreas.includes(area.id) && (
                  <div style={{ paddingLeft: 16, marginTop: 4 }}>
                    {area.lessons.map(lesson => (
                      <label key={lesson.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox" checked={selectedLessons.includes(lesson.id)} onChange={() => toggleLesson(lesson.id)} />
                        <span>{lesson.title}</span>
                        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>{lesson.questionCount}문</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">문항 수</label>
              <input className="form-input" type="number" min="1" max="50" value={questionCount} onChange={e => setQuestionCount(parseInt(e.target.value))} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">시간제한 (분, 선택)</label>
              <input className="form-input" type="number" min="1" value={timeLimitMin} onChange={e => setTimeLimitMin(e.target.value)} placeholder="없음" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">마감일 (선택)</label>
            <input className="form-input" type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} />
              <span>문항 순서 셔플</span>
            </label>
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          {success && <p style={{ color: 'var(--success)', fontSize: 13, marginBottom: 12 }}>{success}</p>}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? '생성 중...' : '미션 생성 (초안)'}
          </button>
        </form>
      </div>
    </div>
  )
}
