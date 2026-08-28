import { useEffect, useMemo, useState } from 'react'
import { userLocalStorage as localStorage } from '../../lib/userLocalStorage.js'
import {
  ArrowLeft,
  CaretRight,
  CheckCircle,
  ChatCircleDots,
  ClipboardText,
  Eye,
  Student,
  Target,
  WarningCircle,
} from '@phosphor-icons/react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../App.jsx'
import { INTERVIEW_OBSERVATION_AREAS, INTERVIEW_PRACTICAL_STAGES } from '../../lib/interviewPracticalContent.js'
import '../../styles/interview-practical.css'

function reviewKey(studentId, stageId) {
  return `iv_teacher_practice_${studentId || 'none'}_${stageId}`
}

function readReview(studentId, stageId) {
  try { return JSON.parse(localStorage.getItem(reviewKey(studentId, stageId)) || '{}') }
  catch { return {} }
}

export default function TeacherInterviewPracticeScreen({ onBack, initialClassId, onMessage, demo = false }) {
  const { profile } = useAuth() ?? {}
  const [classes, setClasses] = useState(demo ? [
    { id: 'c1', name: '3학년 2반' },
    { id: 'c2', name: '2학년 취업반' },
    { id: 'c3', name: '1학년 진로반' },
  ] : [])
  const [students, setStudents] = useState(demo ? [
    { id: 'c1-s1', classId: 'c1', name: '이수현' },
    { id: 'c1-s2', classId: 'c1', name: '박민준' },
    { id: 'c2-s1', classId: 'c2', name: '윤지호' },
    { id: 'c2-s2', classId: 'c2', name: '한예린' },
    { id: 'c3-s1', classId: 'c3', name: '강민서' },
    { id: 'c3-s2', classId: 'c3', name: '신도현' },
  ] : [])
  const [classId, setClassId] = useState(initialClassId || '')
  const [studentId, setStudentId] = useState('')
  const [stageId, setStageId] = useState(INTERVIEW_PRACTICAL_STAGES[0].id)
  const [review, setReview] = useState({})
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [synced, setSynced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const stage = INTERVIEW_PRACTICAL_STAGES.find(item => item.id === stageId) || INTERVIEW_PRACTICAL_STAGES[0]
  const selectedStudent = students.find(item => item.id === studentId)
  const classStudents = students.filter(item => !classId || item.classId === classId)
  const checkedCount = Object.values(review).filter(value => value === 'good').length

  useEffect(() => {
    if (demo || !profile?.id) return
    async function load() {
      const { data: teacherClasses } = await supabase.from('teacher_classes').select('class_id, classes(name)').eq('teacher_id', profile.id)
      const rows = (teacherClasses || []).map(row => ({ id: row.class_id, name: row.classes?.name || '학급' }))
      setClasses(rows)
      const nextClass = initialClassId || rows[0]?.id || ''
      setClassId(nextClass)
      if (!rows.length) return
      const { data: studentRows } = await supabase.from('student_classes').select('student_id, class_id, profiles(display_name)').in('class_id', rows.map(item => item.id))
      setStudents((studentRows || []).map(row => ({ id: row.student_id, classId: row.class_id, name: row.profiles?.display_name || '학생' })))
    }
    load()
  }, [demo, profile?.id, initialClassId])

  useEffect(() => {
    const first = students.find(item => !classId || item.classId === classId)
    if (!students.some(item => item.id === studentId && (!classId || item.classId === classId))) setStudentId(first?.id || '')
  }, [classId, students])

  useEffect(() => {
    const savedReview = readReview(studentId, stageId)
    setReview(savedReview.ratings || {})
    setNote(savedReview.note || '')
    setSaved(Boolean(savedReview.savedAt))
    setSynced(false)
    setSaveError('')
    if (demo || !studentId) return
    let cancelled = false
    supabase.rpc('rpc_interview_practice_review', { p_student_id: studentId, p_stage_id: stageId }).then(({ data, error }) => {
      if (cancelled || error || data?.error || !data?.savedAt) return
      setReview(data.ratings || {})
      setNote(data.note || '')
      setSaved(true)
      setSynced(true)
    })
    return () => { cancelled = true }
  }, [studentId, stageId])

  const messageBody = useMemo(() => {
    const strengths = INTERVIEW_OBSERVATION_AREAS.filter(item => review[item.id] === 'good').map(item => item.label)
    const practices = INTERVIEW_OBSERVATION_AREAS.filter(item => review[item.id] === 'practice').map(item => item.label)
    return [`${stage.title} 리허설 피드백`, strengths.length ? `잘된 점: ${strengths.join('·')}` : '', practices.length ? `다음 연습: ${practices.join('·')}` : '', note ? `선생님 메모: ${note}` : '', `다음 회차에는 한 가지 행동부터 고쳐 봅시다.`].filter(Boolean).join('\n')
  }, [review, note, stage.title])

  function setRating(id, value) {
    setReview(current => ({ ...current, [id]: current[id] === value ? null : value }))
    setSaved(false)
  }

  async function saveReview() {
    if (!studentId) return
    setSaving(true)
    setSaveError('')
    setSynced(false)
    const savedAt = new Date().toISOString()
    const local = { ratings: review, note, savedAt }
    localStorage.setItem(reviewKey(studentId, stageId), JSON.stringify(local))
    if (!demo) {
      const { data, error } = await supabase.rpc('rpc_save_interview_practice_review', {
        p_class_id: classId, p_student_id: studentId, p_stage_id: stageId,
        p_ratings: review, p_note: note,
      })
      if (error || data?.error) {
        setSaving(false)
        setSaved(false)
        setSaveError('서버 저장 실패 · 연결 확인 후 다시 저장')
        return false
      }
    }
    setSaving(false)
    setSaved(true)
    setSynced(true)
    return true
  }

  async function sendFeedback() {
    const ok = await saveReview()
    if (!ok) return
    onMessage?.({
      scope: 'personal', target: studentId, studentName: selectedStudent?.name,
      title: `${stage.short} 리허설 피드백`, body: messageBody,
    })
  }

  return <main className="teacher-practical-screen">
    <header className="teacher-practical-head"><button onClick={onBack} aria-label="교사 캠퍼스로 돌아가기"><ArrowLeft /></button><div><span>TEACHER INTERVIEW COACH</span><h1>실전면접 코칭</h1><p>학생과 같은 9단계 기준으로 관찰하고, 다음 연습 행동을 바로 전달함.</p></div></header>
    <div className="teacher-practical-layout">
      <aside className="teacher-practical-route">
        <div className="teacher-practical-selectors">
          <label><span>담당 학급</span><select value={classId} onChange={event => setClassId(event.target.value)}>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>관찰 학생</span><select value={studentId} onChange={event => setStudentId(event.target.value)}><option value="">학생 선택</option>{classStudents.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </div>
        <nav>{INTERVIEW_PRACTICAL_STAGES.map((item, index) => <button key={item.id} className={stageId === item.id ? 'is-on' : ''} onClick={() => setStageId(item.id)}><span>{index + 1}</span><div><b>{item.title}</b><small>{item.timing}</small></div><CaretRight /></button>)}</nav>
      </aside>
      <section className="teacher-practical-desk">
        <header><div><span>STAGE {INTERVIEW_PRACTICAL_STAGES.findIndex(item => item.id === stageId) + 1}</span><h2>{stage.title}</h2><p>{stage.goal}</p></div><b>{checkedCount}/{INTERVIEW_OBSERVATION_AREAS.length}</b></header>
        <div className="teacher-guide-grid">
          <section><h3><Target weight="fill" />지도 방법</h3><ul>{stage.teacher.map(item => <li key={item}>{item}</li>)}</ul></section>
          <section className="is-example"><h3><CheckCircle weight="fill" />잘된 사례</h3><p>{stage.good}</p><h3><WarningCircle weight="fill" />잘못된 사례</h3><p>{stage.bad}</p></section>
        </div>
        <section className="teacher-observation">
          <header><div><ClipboardText weight="duotone" /><span><b>{selectedStudent ? `${selectedStudent.name} 학생 관찰표` : '학생을 먼저 선택'}</b><small>관찰 사실을 기준으로 선택함</small></span></div></header>
          <div>{INTERVIEW_OBSERVATION_AREAS.map(item => <article key={item.id}><div><b>{item.label}</b><small>{item.help}</small></div><button className={review[item.id] === 'good' ? 'is-good' : ''} onClick={() => setRating(item.id, 'good')} disabled={!studentId}><CheckCircle />잘됨</button><button className={review[item.id] === 'practice' ? 'is-practice' : ''} onClick={() => setRating(item.id, 'practice')} disabled={!studentId}><Eye />연습</button></article>)}</div>
          <label><span>관찰 메모</span><textarea rows={4} value={note} onChange={event => { setNote(event.target.value); setSaved(false) }} placeholder="예: 첫 답변 20초 동안 시선이 바닥에 4회 머묾. 다음 회차에는 첫 문장 전 호흡 1회 연습." /></label>
          {saveError && <p className="teacher-practical-save-error" role="alert">{saveError}</p>}
          <footer><button onClick={saveReview} disabled={!studentId || saving}><ClipboardText />{saving ? '저장 중' : synced ? '서버 저장됨' : saved ? '기기 저장됨 · 동기화' : '관찰표 저장'}</button><button className="is-primary" onClick={sendFeedback} disabled={!studentId || saving}><ChatCircleDots weight="fill" />학생에게 피드백</button></footer>
        </section>
        <section className="teacher-practical-principle"><Student weight="fill" /><div><b>외모 채점 금지</b><p>표정·시선·자세는 전달을 방해하는 관찰 행동만 기록함. 학교·가족·외모 등 직무와 무관한 편견 요소는 평가하지 않음.</p></div></section>
      </section>
    </div>
  </main>
}
