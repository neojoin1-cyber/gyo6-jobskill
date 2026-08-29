import { useState, useEffect } from 'react'
import { filterActiveSubjects } from '../../lib/subjectCatalog.js'
import { supabase } from '../../lib/supabase.js'
import { buildJcMissionAreas } from '../../lib/jobCommonAreas.js'
import { buildNcs2026Areas } from '../../lib/ncs2026.js'
import { RECRUIT_WRITTEN_TRACKS, buildRecruitWrittenAreas } from '../../lib/recruitWritten.js'
import {
  INTERVIEW_AREAS,
  PERSONALITY_AREAS,
  guidedQuestionIds,
} from '../../lib/guidedSubjectContent.js'

const MISSION_TYPES = ['이번시간', '오늘', '이번주', '중간고사', '기말고사', '인증평가']

const DEMO_SUBJECTS = [
  { id: 'job-common', name: '교육부 직업공통능력', description: '교육부·대한상공회의소 평가 체계 연계' },
  { id: 'ncs-basic', name: 'NCS 직업공통능력', description: '고용노동부·한국산업인력공단 NCS 직업기초능력' },
  { id: 'recruit-written', name: '채용필기 심화', description: '공공기관·금융권·대기업 추가 출제영역' },
  { id: 'interview', name: '면접 스킬', description: '공정채용 면접 상황·답변 연습' },
  { id: 'personality', name: '인성검사', description: '응답 경향과 일관성 확인' },
]

// 교육부·대한상의 직업공통능력 인증 5영역 — 자율학습·모의평가와 동일 소스
const JOB_AREAS = buildJcMissionAreas()

// 교사 미션도 NCS 26v1 공식 7영역만 출제한다.
const NCS_AREAS = buildNcs2026Areas()
const RECRUIT_AREAS = RECRUIT_WRITTEN_TRACKS.flatMap(track =>
  buildRecruitWrittenAreas(track.id).map(area => ({
    ...area,
    displayName: `${track.label} · ${area.displayName}`,
  }))
)

export default function MissionCreateScreen({ classId, className, onBack, demo = false }) {
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
    if (demo) {
      setAvailableSubjects(DEMO_SUBJECTS)
      setSubjectId(DEMO_SUBJECTS[0].id)
      return
    }
    // 교사에게 배정된 과목 조회 (없으면 전체 subject 표시)
    supabase.from('teacher_subjects').select('subject_id, subjects(id, name, description)')
      .then(({ data }) => {
        const subs = (data ?? []).map(r => r.subjects).filter(Boolean)
        if (subs.length > 0) {
          const active = filterActiveSubjects(subs)
          setAvailableSubjects(active)
          setSubjectId(active[0]?.id ?? 'job-common')
        } else {
          // 배정 없으면 전체 subjects 표시
          supabase.from('subjects').select('id, name, description').then(({ data: all }) => {
            const active = filterActiveSubjects(all)
            setAvailableSubjects(active)
            setSubjectId(active[0]?.id ?? 'job-common')
          })
        }
      })
  }, [demo])

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
    if (subjectId === 'job-common' || subjectId === 'interview') {
      setSelectedLessons(prev => {
        const areaLessons = visibleAreas.find(a => a.id === areaId)?.lessons?.map(l => l.id) ?? []
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
      const allQuestionIds = JOB_AREAS.flatMap(a => {
        if (selectedAreas.includes(a.id)) return a.lessons.flatMap(l => l.questionIds)
        return a.lessons.filter(l => selectedLessons.includes(l.id)).flatMap(l => l.questionIds)
      })
      questionIds = [...new Set(allQuestionIds)]
      if (areaIds.length === 0) areaIds = [...selectedLessons]
    } else if (subjectId === 'interview' || subjectId === 'personality') {
      questionIds = [...new Set(guidedQuestionIds(subjectId, selectedAreas, selectedLessons))]
      areaIds = selectedAreas.length > 0 ? selectedAreas : selectedLessons
    } else {
      // NCS: area 이름 기반
      questionIds = selectedAreas.map(a => `area:${a}`)
      areaIds = selectedAreas
    }

    if (demo) {
      setSuccess(`${className || '선택 학급'} 미션 초안을 만들었습니다. 체험 기록은 서버에 저장되지 않습니다.`)
      return
    }

    setLoading(true)
    const { data: missionId, error: err } = await supabase.rpc('rpc_create_mission', {
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

    // subject_id 별도 업데이트 — rpc가 반환한 mission id로 정확히 갱신(최신 draft 추정 금지)
    if (!err && missionId && subjectId !== 'job-common') {
      const { error: upErr } = await supabase.from('missions')
        .update({ subject_id: subjectId })
        .eq('id', missionId)
      if (upErr) { setLoading(false); setError('과목 지정 실패: ' + upErr.message); return }
    }

    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess('미션이 생성되었습니다 (초안 상태). 대시보드에서 활성화하세요.')
    setTimeout(onBack, 1800)
  }

  const isNCS         = subjectId === 'ncs-basic'
  const isRecruit     = subjectId === 'recruit-written'
  const isInterview   = subjectId === 'interview'
  const isPersonality = subjectId === 'personality'
  const visibleAreas  = isNCS ? NCS_AREAS
    : isRecruit ? RECRUIT_AREAS
      : isInterview ? INTERVIEW_AREAS
        : isPersonality ? PERSONALITY_AREAS
          : JOB_AREAS

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
                  <span style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{s.description ?? s.desc}</span>
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
            {isPersonality && (
              <p className="mission-source-note">
                인성검사는 정답·오답을 매기지 않습니다. 학생의 응답 완료와 요인별 경향을 상담 자료로 확인합니다.
              </p>
            )}
            {visibleAreas.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                선택 가능한 영역이 없습니다.
              </div>
            )}
            {visibleAreas.map(area => (
              <div key={area.id || area.displayName} style={{ marginBottom: (isNCS || isRecruit) ? 6 : 12 }}>
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
                  {area.description && <span className="mission-area-desc">{area.description}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{area.totalQuestions}문항</span>
                </label>
                {/* 직업공통능력만 단원 세부 선택 가능 */}
                {(subjectId === 'job-common' || isInterview) && !selectedAreas.includes(area.id) && area.lessons?.length > 0 && (
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
