import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { getMockScopes, MOCK_COUNT, MOCK_SUBJECTS } from '../../lib/mockData.js'
import { Suspense } from 'react'
import { lazyChunk } from '../../lib/lazyChunk.js'
const TeacherMessageScreen = lazyChunk(() => import('./TeacherMessageScreen.jsx'), 'TeacherMessageScreen')
const ClassroomScreen = lazyChunk(() => import('./ClassroomScreen.jsx'), 'ClassroomScreen')

// 수업자료 허브 주소. 배포처가 정해지면 .env 의 VITE_TEACHER_MATERIALS_URL 로 지정한다.
const MATERIALS_URL = import.meta.env.VITE_TEACHER_MATERIALS_URL || ''


// 과목별 모의고사 대상 과목 — mockData의 단일 소스(MOCK_SUBJECTS) 사용(전 과목 자동 반영)
const EXAM_SUBJECTS = MOCK_SUBJECTS.map(s => ({ id: s.id, label: s.name }))
const subjectLabel = id => EXAM_SUBJECTS.find(s => s.id === id)?.label ?? id

export default function TeacherDashboard({ profile, onLogout, onNavigate, hideAppbar }) {
  /**
   * 수업자료를 앱 계정 그대로 연다.
   *
   * 자료 사이트는 앱과 다른 주소라 로그인 상태가 따라가지 않는다. 그렇다고
   * 교사에게 거기서 또 로그인하라고 하면, 이미 앱에 로그인한 사람에게 같은 것을
   * 두 번 묻는 셈이다. 지금 들고 있는 토큰을 넘겨주면 저쪽이 확인만 하고 연다.
   *
   * 토큰은 주소의 **# 뒤**에 붙인다. # 뒤는 브라우저가 서버로 보내지 않아
   * 접속 기록이나 리퍼러에 토큰이 남지 않는다. 받는 쪽도 주소창에서 바로 지운다.
   *
   * 토큰을 못 가져오면 그냥 원래 주소로 연다 — 저쪽 로그인 화면이 받아 준다.
   */
  async function openMaterials(e) {
    try {
      const { data } = await supabase.auth.getSession()
      const t = data?.session?.access_token
      if (!t) return                       // 기본 동작(그냥 열기)에 맡긴다
      e.preventDefault()
      const r = data.session.refresh_token || ''
      const url = `${MATERIALS_URL.replace(/\/$/, '')}/open#t=${encodeURIComponent(t)}`
        + `&r=${encodeURIComponent(r)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      /* 실패하면 기본 동작으로 열린다 */
    }
  }

  const [showMessages, setShowMessages] = useState(false)
  const [showClassroom, setShowClassroom] = useState(false)
  const [classes, setClasses] = useState([])
  const [missions, setMissions] = useState([])
  const [openExams, setOpenExams] = useState([])
  const [loading, setLoading] = useState(true)

  // 모의고사 열기 모달
  const [mockModal, setMockModal] = useState(null)   // 대상 학급
  const [mockForm,  setMockForm]  = useState({ subject_id: 'job-common', scope: '__all__', paper_no: 1, time_limit_min: 60 })
  const [mockSaving, setMockSaving] = useState(false)

  useEffect(() => { load() }, [profile?.id])

  async function load() {
    setLoading(true)
    const { data: tc } = await supabase
      .from('teacher_classes')
      .select('class_id, classes(id, name, grade, class_code, school_id)')
      .eq('teacher_id', profile.id)
    const myClasses = (tc ?? []).map(r => r.classes).filter(Boolean)
    setClasses(myClasses)

    if (myClasses.length > 0) {
      const classIds = myClasses.map(c => c.id)
      const { data: ms } = await supabase
        .from('missions')
        .select('id, title, mission_type, status, due_at, class_id')
        .in('class_id', classIds)
        .order('created_at', { ascending: false })
        .limit(20)
      setMissions(ms ?? [])

      const { data: oe } = await supabase
        .from('open_mock_exams')
        .select('id, class_id, subject_id, title, question_count, time_limit_min, closed_at')
        .in('class_id', classIds)
        .is('closed_at', null)
        .order('created_at', { ascending: false })
      setOpenExams(oe ?? [])
    }
    setLoading(false)
  }

  // ── 모의고사 열기/닫기 ────────────────────────────────────────────────────────
  async function saveMockExam(e) {
    e.preventDefault()
    setMockSaving(true)
    const scopes = getMockScopes(mockForm.subject_id)
    const cur = scopes.find(s => s.key === mockForm.scope) || scopes[0]
    const title = `${subjectLabel(mockForm.subject_id)} · ${cur?.name ?? ''} 모의 ${mockForm.paper_no}회`
    const { error: err } = await supabase.from('open_mock_exams').insert({
      class_id:       mockModal.id,
      subject_id:     mockForm.subject_id,
      scope:          mockForm.scope,
      paper_no:       mockForm.paper_no,
      title,
      question_count: MOCK_COUNT,
      time_limit_min: Number(mockForm.time_limit_min) || 60,
      opened_by:      profile.id,
    })
    setMockSaving(false)
    if (err) { alert('모의고사 열기 오류: ' + err.message); return }
    setMockModal(null)
    setMockForm({ subject_id: 'job-common', scope: '__all__', paper_no: 1, time_limit_min: 60 })
    load()
  }

  async function closeMockExam(id) {
    if (!window.confirm('이 모의고사를 마감할까요? 학생에게 더 이상 보이지 않습니다.')) return
    await supabase.from('open_mock_exams').update({ closed_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function activateMission(missionId) {
    await supabase.from('missions').update({ status: 'active', activated_at: new Date().toISOString() }).eq('id', missionId)
    load()
  }

  async function closeMission(missionId) {
    await supabase.from('missions').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', missionId)
    load()
  }

  const statusBadge = s =>
    s === 'active' ? 'badge-green' :
    s === 'closed' ? 'badge-gray' : 'badge-yellow'
  const statusLabel = s =>
    s === 'active' ? '진행중' : s === 'closed' ? '마감' : '대기'

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  // 모의고사 모달용 파생값: 선택 과목의 범위 목록 + 현재 범위의 회차 수 + 제목 미리보기
  const mockScopes = getMockScopes(mockForm.subject_id)
  const curScope   = mockScopes.find(s => s.key === mockForm.scope) || mockScopes[0]
  const paperCount = curScope?.papers ?? 1
  const mockTitle  = curScope ? `${subjectLabel(mockForm.subject_id)} · ${curScope.name} 모의 ${mockForm.paper_no}회` : ''

  if (showClassroom) return (
    <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
      <ClassroomScreen onBack={() => setShowClassroom(false)} />
    </Suspense>
  )

  if (showMessages) return (
    <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
      <TeacherMessageScreen onBack={() => setShowMessages(false)} />
    </Suspense>
  )

  return (
    <div className="screen-body" style={{ paddingTop: hideAppbar ? 0 : undefined }}>

      {/* 가로에서는 이 두 카드가 나란히 선다. 세로에서는 위아래 그대로. */}
      <div className="teacher-grid">
      {/* 프로젝터에 띄워 함께 푸는 수업 화면 */}
      <button className="card" onClick={() => setShowClassroom(true)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                 marginBottom: 12, textAlign: 'left', cursor: 'pointer' }}>
        <span style={{ fontSize: 22 }}>🎬</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700 }}>수업 시작</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
            학생과 같은 문항을 큰 화면으로 · 정답 가리고 함께 풀기
          </span>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>›</span>
      </button>

      {/* 공지·격려 보내기, 학생 답장 받기 */}
      <button className="card" onClick={() => setShowMessages(true)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                 marginBottom: 12, textAlign: 'left', cursor: 'pointer' }}>
        <span style={{ fontSize: 22 }}>✉️</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700 }}>메시지</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
            학급 공지·개별 격려 보내기 · 학생 답장 확인
          </span>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>›</span>
      </button>
      </div>

        {/* 모의고사 열기 모달 */}
        {mockModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
            onClick={e => { if (e.target === e.currentTarget) setMockModal(null) }}>
            <div className="card" style={{ width: '100%', maxWidth: 380 }}>
              <p style={{ fontWeight: 700, marginBottom: 4 }}>📝 모의고사 시험지 열기</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                {mockModal.name} 학생에게 <b>30문항</b> 시험지가 노출됩니다. 빈출 비중이 높은 문항을 더 많이,
                전체 학습 내용을 고르게 담아 자동 구성됩니다.
              </p>
              <form onSubmit={saveMockExam}>
                <div className="form-group">
                  <label className="form-label">과목</label>
                  <select className="form-input" value={mockForm.subject_id}
                    onChange={e => setMockForm(f => ({ ...f, subject_id: e.target.value, scope: '__all__', paper_no: 1 }))}>
                    {EXAM_SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">범위</label>
                  <select className="form-input" value={mockForm.scope}
                    onChange={e => setMockForm(f => ({ ...f, scope: e.target.value, paper_no: 1 }))}>
                    {mockScopes.map(s => (
                      <option key={s.key} value={s.key}>
                        {s.key === '__all__' ? '🗂️ 전체 영역' : s.name} (총 {s.papers}회)
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">회차</label>
                    <select className="form-input" value={mockForm.paper_no}
                      onChange={e => setMockForm(f => ({ ...f, paper_no: Number(e.target.value) }))}>
                      {Array.from({ length: paperCount }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}회</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">제한 시간(분)</label>
                    <input className="form-input" type="number" min="1" max="180" value={mockForm.time_limit_min}
                      onChange={e => setMockForm(f => ({ ...f, time_limit_min: e.target.value }))} />
                  </div>
                </div>
                <div style={{
                  background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 8,
                  padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--primary)', fontWeight: 700,
                }}>
                  열릴 시험지: {mockTitle} · 30문항
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setMockModal(null)}>취소</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={mockSaving}>
                    {mockSaving ? '여는 중...' : '시험지 열기'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 수업자료 허브 — 앱 밖 정적 사이트.
            수업 덱·진행 도구·완전교재가 여기 모여 있는데 앱에서 갈 길이
            없었다(티켓 902 가 지적한 "자료 부족이 아니라 연결 부족").
            배포 주소는 VITE_TEACHER_MATERIALS_URL 로 바꿀 수 있다. */}
        {MATERIALS_URL && (
          <a href={MATERIALS_URL} target="_blank" rel="noopener noreferrer"
            onClick={openMaterials}
            style={{ width: '100%', textAlign: 'left', background: 'var(--card)', border: '1.5px solid #0F766E',
              borderRadius: 14, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
            <div style={{ fontSize: 24 }}>🧰</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 800, fontSize: 15, color: '#0F766E' }}>수업자료</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                과목별 수업 덱 · 진행 도구 · 완전교재를 한곳에서 · 바로 열림
              </p>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 20 }}>↗</span>
          </a>
        )}

        {/* 교재 보기 진입 */}
        <button onClick={() => onNavigate('textbook-browse')}
          style={{ width: '100%', textAlign: 'left', background: 'var(--card)', border: '1.5px solid var(--primary)',
            borderRadius: 14, padding: '14px 16px', marginBottom: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24 }}>📖</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>교재 보기</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>배정된 교재를 완전교재로 열람합니다.</p>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 20 }}>›</span>
        </button>

        {/* 학급 목록 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p className="section-title" style={{ margin: 0 }}>내 학급</p>
        </div>

        {classes.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🏫</span>
            <span className="empty-state-title">학급이 없습니다</span>
            <span>학교관리자에게 학급 등록과 담당 교사 배정을 요청하세요.</span>
          </div>
        ) : (
          <div className="teacher-grid">
          {classes.map(cls => (
            <div key={cls.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 16 }}>{cls.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>학급 코드: <b style={{ color: 'var(--primary)', letterSpacing: 1 }}>{cls.class_code}</b></p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-secondary" style={{ padding: '7px 10px', fontSize: 12.5 }}
                    onClick={() => onNavigate('class-diagnostics', { classId: cls.id, className: cls.name })}>
                    📊 진단현황
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '7px 10px', fontSize: 12.5 }}
                    onClick={() => onNavigate('class-personality', { classId: cls.id, className: cls.name })}>
                    🧭 인성검사
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '7px 10px', fontSize: 12.5 }}
                    onClick={() => onNavigate('class-weakness', { classId: cls.id, className: cls.name })}>
                    📉 약점
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '7px 10px', fontSize: 12.5 }}
                    onClick={() => onNavigate('class-progress', { classId: cls.id, className: cls.name })}>
                    📈 진행율
                  </button>
                  {profile?.role === 'class_admin' && (
                    <button className="btn btn-secondary" style={{ padding: '7px 10px', fontSize: 12.5 }}
                      onClick={() => onNavigate('class-subjects', { classId: cls.id, className: cls.name })}>
                      🗂️ 교재배정
                    </button>
                  )}
                  <button className="btn btn-secondary" style={{ padding: '7px 10px', fontSize: 12.5 }}
                    onClick={() => onNavigate('class-results', { classId: cls.id, className: cls.name })}>
                    결과 보기
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1, fontSize: 14 }}
                  onClick={() => onNavigate('create-mission', { classId: cls.id, className: cls.name })}>
                  + 미션 만들기
                </button>
                <button className="btn btn-secondary" style={{ flex: 1, fontSize: 14 }}
                  onClick={() => { setMockModal(cls); setMockForm({ subject_id: 'job-common', scope: '__all__', paper_no: 1, time_limit_min: 60 }) }}>
                  📝 모의고사 열기
                </button>
              </div>

              {/* 이 학급에 열린 모의고사 */}
              {openExams.filter(o => o.class_id === cls.id).map(o => (
                <div key={o.id} style={{
                  marginTop: 8, padding: '8px 12px', borderRadius: 8,
                  background: 'var(--primary-light)', border: '1px solid var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>📝 {o.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {subjectLabel(o.subject_id)} · {o.question_count}문항 · {o.time_limit_min}분 · 응시 가능
                    </p>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px', color: 'var(--danger)', flexShrink: 0 }}
                    onClick={() => closeMockExam(o.id)}>
                    마감
                  </button>
                </div>
              ))}
            </div>
          ))}
          </div>
        )}

        {/* 최근 미션 */}
        {missions.length > 0 && (
          <>
            <p className="section-title">최근 미션</p>
            {missions.map(m => {
              const cls = classes.find(c => c.id === m.class_id)
              return (
                <div key={m.id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, marginBottom: 4 }}>{m.title}</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className={`badge ${statusBadge(m.status)}`}>{statusLabel(m.status)}</span>
                        <span className="badge badge-blue">{m.mission_type}</span>
                        {cls && <span className="badge badge-gray">{cls.name}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {m.status === 'draft' && (
                        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => activateMission(m.id)}>
                          활성화
                        </button>
                      )}
                      {m.status === 'active' && (
                        <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => closeMission(m.id)}>
                          마감
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
    </div>
  )
}
