import { useEffect, useMemo, useState } from 'react'
import { ArrowClockwise, Briefcase, CalendarCheck, ChatCircleDots, CheckCircle, ClipboardText, MagnifyingGlass, Student, WarningCircle } from '@phosphor-icons/react'
import { supabase } from '../../lib/supabase.js'
import { careerGradeRoadmap, careerProfileReadiness, extracurricularCategoryLabel, normalizeCareerContext, qualificationStatusLabel } from '../../lib/careerProfile.js'

function demoCareerRows() {
  const rows = [
    { id: 's1', name: '김하늘', grade: 1, departmentName: '스마트기계과', majorGroup: 'mechanical', targetIndustry: '자동차 부품', targetRole: '생산설비', semesterGoal: '기능사 준비 일정과 실습 근거 2장 만들기', qualifications: [{ id: 'q1', name: '생산자동화기능사', issuer: '한국산업인력공단', status: 'preparing', grade: 1, targetDate: '2027-02-15' }], extracurricularActivities: [{ id: 'a1', category: 'club', name: '메이커 동아리', organizer: '교내', grade: 1, role: '부품 조립', outcome: '작동 시제품 완성', proof: '작업일지', skills: ['협업', '측정'] }], evidence: 1 },
    { id: 's2', name: '박서준', grade: 2, departmentName: '회계금융과', majorGroup: 'business', targetIndustry: '금융', targetRole: '사무행정', semesterGoal: '전산회계 취득과 고객 응대 경험 정리', qualifications: [{ id: 'q2', name: '전산회계', issuer: '한국세무사회', status: 'acquired', grade: 2, achievedAt: '2026-06-20', proof: '합격 확인서' }], extracurricularActivities: [{ id: 'a2', category: 'competition', name: '교내 창업경진대회', organizer: '교내', grade: 2, role: '원가표 작성', outcome: '본선 진출', proof: '발표자료', skills: ['회계', '설명'] }], evidence: 3 },
    { id: 's3', name: '이민지', grade: 1, departmentName: '', majorGroup: 'general', targetIndustry: '', targetRole: '', semesterGoal: '', qualifications: [], extracurricularActivities: [], evidence: 0 },
  ]
  return rows.map(item => {
    const profile = normalizeCareerContext({ ...item, currentGrade: item.grade })
    return { student_id: item.id, student_name: item.name, profile_data: profile, readiness_score: careerProfileReadiness(profile, { evidenceCount: item.evidence }).score, evidence_count: item.evidence, profile_updated_at: new Date().toISOString(), feedback_note: '', feedback_next_action: '', feedback_review_on: null }
  })
}

function normalizeRow(row) {
  const profile = normalizeCareerContext(row.profile_data || {})
  return {
    ...row,
    profile,
    readiness: careerProfileReadiness(profile, { evidenceCount: row.evidence_count || 0 }),
    roadmap: careerGradeRoadmap(profile, { evidenceCount: row.evidence_count || 0 }),
  }
}

function formatDate(value) {
  if (!value) return '기록 없음'
  return new Date(value).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export default function CareerPortfolioScreen({ classId, className, demo = false, onMessage }) {
  const [rows, setRows] = useState(() => demo ? demoCareerRows().map(normalizeRow) : [])
  const [loading, setLoading] = useState(!demo)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(() => demo ? 's1' : '')
  const [note, setNote] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [reviewOn, setReviewOn] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  async function load() {
    if (!classId || demo) return
    setLoading(true)
    const { data, error } = await supabase.rpc('rpc_class_career_profiles', { p_class_id: classId })
    setLoading(false)
    if (error) {
      setNotice({ ok: false, text: '취업 준비 현황을 불러오지 못했습니다.' })
      return
    }
    const next = (Array.isArray(data) ? data : []).map(normalizeRow)
    setRows(next)
    setSelectedId(current => next.some(item => item.student_id === current) ? current : next[0]?.student_id || '')
  }

  useEffect(() => { load() }, [classId, demo])

  const visible = useMemo(() => rows.filter(item => {
    const corpus = `${item.student_name} ${item.profile.departmentName} ${item.profile.targetRole}`.toLowerCase()
    const matchQuery = !query || corpus.includes(query.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'needs' ? item.readiness.score < 55 : filter === 'ready' ? item.readiness.score >= 80 : !item.profile_updated_at)
    return matchQuery && matchFilter
  }), [filter, query, rows])
  const selected = rows.find(item => item.student_id === selectedId) || null
  const summary = useMemo(() => ({
    total: rows.length,
    started: rows.filter(item => item.profile_updated_at).length,
    evidence: rows.reduce((sum, item) => sum + Number(item.evidence_count || 0), 0),
    needs: rows.filter(item => item.readiness.score < 55).length,
  }), [rows])

  useEffect(() => {
    setNote(selected?.feedback_note || '')
    setNextAction(selected?.feedback_next_action || selected?.roadmap.nextActions[0] || '')
    setReviewOn(selected?.feedback_review_on || '')
    setNotice(null)
  }, [selectedId])

  async function saveFeedback() {
    if (!selected || note.trim().length < 5 || nextAction.trim().length < 2 || saving) {
      setNotice({ ok: false, text: '관찰 내용과 학생이 다음에 할 일을 구체적으로 적어 주세요.' })
      return
    }
    setSaving(true)
    if (demo) {
      setRows(current => current.map(item => item.student_id === selected.student_id ? { ...item, feedback_note: note.trim(), feedback_next_action: nextAction.trim(), feedback_review_on: reviewOn || null } : item))
      setSaving(false)
      setNotice({ ok: true, text: '학생의 취업 준비 화면에 지도 내용을 보냈습니다.' })
      return
    }
    const { data, error } = await supabase.rpc('rpc_review_student_career_profile', { p_student_id: selected.student_id, p_note: note.trim(), p_next_action: nextAction.trim(), p_review_on: reviewOn || null })
    setSaving(false)
    if (error || data?.error) {
      setNotice({ ok: false, text: '지도 내용을 저장하지 못했습니다. 담당 학급 범위를 확인해 주세요.' })
      return
    }
    setNotice({ ok: true, text: '학생의 취업 준비 화면에 지도 내용을 보냈습니다.' })
    await load()
  }

  return <section className="teacher-career-portfolio">
    <header><div><span>LONGITUDINAL CAREER COACH</span><h2>{className} 취업 준비 자산</h2><p>1학년부터 쌓은 자격·활동·작성 근거를 보고 다음 행동을 지도합니다.</p></div><button onClick={load} disabled={loading || demo}><ArrowClockwise />새로고침</button></header>
    <div className="teacher-career-summary"><div><b>{summary.started}/{summary.total}</b><span>프로필 시작</span></div><div><b>{summary.evidence}</b><span>근거 카드</span></div><div><b>{summary.needs}</b><span>우선 지도</span></div></div>
    <div className="teacher-career-layout">
      <aside><div className="teacher-career-filters"><label><MagnifyingGlass /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="학생·학과·직무 검색" /></label><div>{[['all', '전체'], ['needs', '우선'], ['ready', '활용 가능'], ['empty', '미작성']].map(([id, label]) => <button key={id} className={filter === id ? 'is-on' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div></div><div className="teacher-career-list">{loading && <p>현황을 불러오는 중입니다.</p>}{!loading && !visible.length && <p>조건에 맞는 학생이 없습니다.</p>}{visible.map(item => <button key={item.student_id} className={selectedId === item.student_id ? 'is-on' : ''} onClick={() => setSelectedId(item.student_id)}><Student /><span><b>{item.student_name}</b><small>{item.profile.currentGrade}학년 · {item.profile.departmentName || '학과 미입력'}</small><em>{item.readiness.level} · {item.readiness.score}점</em></span></button>)}</div></aside>
      {!selected ? <div className="teacher-career-empty"><Briefcase /><b>학생을 선택하세요</b></div> : <main>
        <section className="teacher-career-student-head"><div><span>{selected.profile.currentGrade}학년 · {selected.profile.departmentName || '학과 미입력'}</span><h3>{selected.student_name}</h3><p>{selected.profile.targetIndustry || '관심 산업 미정'} · {selected.profile.targetRole || '관심 직무 미정'}</p></div><strong>{selected.readiness.score}<small>/100</small></strong></section>
        <section className="teacher-career-metrics">{selected.readiness.checks.map(item => <div key={item.id}><span>{item.label}<b>{item.score}/{item.max}</b></span><i><em style={{ width: `${Math.round(item.score / item.max * 100)}%` }} /></i></div>)}</section>
        <section className="teacher-career-assets"><article><header><b>자격</b><span>{selected.profile.qualifications.length}개</span></header>{selected.profile.qualifications.length ? selected.profile.qualifications.map(item => <p key={item.id}><CheckCircle weight={item.status === 'acquired' ? 'fill' : 'regular'} />{item.name}{item.level ? ` · ${item.level}` : ''}<small>{qualificationStatusLabel(item)} · {item.issuer || '기관 미입력'}{item.validityType === 'expires' && item.validUntil ? ` · ${item.validUntil}까지` : ''}</small></p>) : <p className="is-empty">등록된 자격이 없습니다.</p>}</article><article><header><b>교과외활동</b><span>{selected.profile.extracurricularActivities.length}개</span></header>{selected.profile.extracurricularActivities.length ? selected.profile.extracurricularActivities.map(item => <p key={item.id}><ClipboardText />{item.name}<small>{extracurricularCategoryLabel(item)} · {item.role || '역할 미입력'} · {item.outcome || '결과 미입력'}</small></p>) : <p className="is-empty">등록된 활동이 없습니다.</p>}</article></section>
        <section className="teacher-career-next"><WarningCircle weight="fill" /><div><b>{selected.roadmap.stage} 지도 초점</b>{selected.roadmap.nextActions.slice(0, 4).map(item => <p key={item}>{item}</p>)}</div></section>
        <section className="teacher-career-meta"><span>근거 카드 {selected.evidence_count}장</span><span>최근 갱신 {formatDate(selected.profile_updated_at)}</span><span>학기 목표 {selected.profile.semesterGoal || '미입력'}</span></section>
      </main>}
      {selected && <aside className="teacher-career-coach"><header><ClipboardText /><div><b>성장 지도 보내기</b><p>학생 대신 작성하지 않고 다음 행동을 한 가지로 좁힙니다.</p></div></header><label><span>관찰·조언</span><textarea value={note} onChange={event => setNote(event.target.value.slice(0, 1200))} rows="5" placeholder="좋아진 점과 보완할 근거를 구체적으로 적습니다." /></label><label><span>학생이 다음에 할 일</span><input value={nextAction} onChange={event => setNextAction(event.target.value.slice(0, 300))} placeholder="예: 실습 활동에 내 역할과 결과 보완" /></label><label><span>함께 확인할 날짜</span><input type="date" value={reviewOn} onChange={event => setReviewOn(event.target.value)} /></label>{notice && <p className={notice.ok ? 'is-ok' : 'is-error'}>{notice.ok ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}{notice.text}</p>}<button onClick={saveFeedback} disabled={saving}><CalendarCheck weight="fill" />{saving ? '저장 중' : '지도 내용 보내기'}</button>{onMessage && <button className="is-secondary" onClick={() => onMessage({ student_id: selected.student_id, display_name: selected.student_name })}><ChatCircleDots />학생에게 메시지</button>}</aside>}
    </div>
  </section>
}
