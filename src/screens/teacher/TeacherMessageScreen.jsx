import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  ChatCircleDots,
  Check,
  Megaphone,
  PaperPlaneTilt,
  Sparkle,
  UsersThree,
} from '@phosphor-icons/react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../App.jsx'
import '../../styles/campus.css'

const TEMPLATES = [
  { id: 'encourage', title: '오늘의 한 걸음', body: '오늘 학습에서 좋아진 점이 보여요. 지금 흐름 그대로 한 번 더 도전해 볼까요?' },
  { id: 'wrong', title: '오답 코칭', body: '틀린 문제는 실력이 자라는 신호예요. 오답노트에서 한 문제만 다시 살펴보세요.' },
  { id: 'remind', title: '미션 안내', body: '오늘의 캠퍼스 미션이 열렸어요. 부담 없이 짧게 시작해 보세요.' },
]

export default function TeacherMessageScreen({ onBack, initialScope, initialTarget, initialStudentName, initialTitle = '', initialBody = '', demo = false }) {
  const { profile } = useAuth() ?? {}
  const [tab, setTab] = useState('send')
  const [classes, setClasses] = useState(demo ? [{ id: 'c1', name: '3학년 2반' }] : [])
  const [students, setStudents] = useState(demo ? demoStudents() : [])
  const [scope, setScope] = useState(initialScope || 'class')
  const [target, setTarget] = useState(initialTarget || '')
  const [type, setType] = useState('encourage')
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [inbox, setInbox] = useState(demo ? demoInbox() : [])
  const [loading, setLoading] = useState(!demo)

  useEffect(() => { if (demo) return; if (profile) load() }, [demo, profile?.id])

  async function load() {
    setLoading(true)
    const { data: teacherClasses } = await supabase
      .from('teacher_classes').select('class_id, classes(name)').eq('teacher_id', profile.id)
    const list = (teacherClasses ?? []).map(row => ({ id: row.class_id, name: row.classes?.name ?? '이름 없는 학급' }))
    setClasses(list)
    if (!target && list.length) setTarget(list[0].id)

    if (list.length) {
      const { data: studentClasses } = await supabase
        .from('student_classes').select('student_id, class_id, profiles(display_name)')
        .in('class_id', list.map(item => item.id))
      setStudents((studentClasses ?? []).map(row => ({
        id: row.student_id,
        classId: row.class_id,
        name: row.profiles?.display_name ?? '이름 없음',
      })))
    }
    setLoading(false)
  }

  async function loadInbox() {
    if (demo) return
    const { data } = await supabase.rpc('rpc_teacher_inbox', { p_limit: 50 })
    setInbox(Array.isArray(data) ? data : [])
  }

  useEffect(() => { if (tab === 'inbox') loadInbox() }, [tab])

  useEffect(() => {
    if (!initialTarget || loading) return
    setScope(initialScope || 'personal')
    setTarget(initialTarget)
  }, [initialScope, initialTarget, loading])

  useEffect(() => {
    if (initialTitle) setTitle(initialTitle)
    if (initialBody) setBody(initialBody)
  }, [initialTitle, initialBody])

  async function send() {
    if (!title.trim() || !body.trim() || !target) return
    setSending(true)
    setResult(null)
    const response = demo
      ? { data: { sent: scope === 'class' ? 28 : 1 }, error: null }
      : await supabase.rpc('rpc_send_message', {
          p_scope: scope, p_target: target, p_title: title.trim(), p_body: body.trim(), p_type: type,
        })
    setSending(false)
    if (response.error || response.data?.error) {
      setResult({ ok: false, msg: response.data?.error === 'forbidden' ? '담당 학급 범위를 벗어난 대상입니다.' : '보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.' })
      return
    }
    setResult({ ok: true, msg: `${response.data.sent}명에게 메시지를 보냈습니다.` })
    setTitle('')
    setBody('')
  }

  const targetOptions = useMemo(() => {
    if (scope === 'class') return classes.map(item => ({ id: item.id, name: item.name, meta: '학급 전체' }))
    if (scope === 'personal') return students.map(item => ({ id: item.id, name: item.name, meta: classes.find(c => c.id === item.classId)?.name || '' }))
    return [{ id: profile?.school_id, name: '우리 학교 전체', meta: '학교관리자 전용' }]
  }, [scope, classes, students, profile?.school_id])

  const selected = targetOptions.find(item => item.id === target)

  function applyTemplate(template) {
    setType(template.id === 'encourage' ? 'encourage' : 'notice')
    setTitle(template.title)
    setBody(template.body)
  }

  if (loading) return <div className="campus-loading"><span /></div>

  return (
    <main className="teacher-message">
      <header className="teacher-message-head">
        <button className="teacher-message-back" onClick={onBack} aria-label="교사 작업대로 돌아가기"><ArrowLeft /></button>
        <div><span>TEACHER CAMPUS POST</span><h1>학생과 대화하기</h1><p>진도와 오답을 살핀 다음, 필요한 학생에게 따뜻하고 구체적인 말을 전하세요.</p></div>
        <nav>
          <button className={tab === 'send' ? 'is-on' : ''} onClick={() => setTab('send')}><PaperPlaneTilt /> 메시지 쓰기</button>
          <button className={tab === 'inbox' ? 'is-on' : ''} onClick={() => setTab('inbox')}><ChatCircleDots /> 학생 답장 {inbox.length > 0 && <i>{inbox.length}</i>}</button>
        </nav>
      </header>

      {tab === 'send' ? (
        <div className="teacher-message-layout">
          <aside className="recipient-panel">
            <h2>받는 사람</h2>
            <div className="recipient-scope">
              <button className={scope === 'class' ? 'is-on' : ''} onClick={() => { setScope('class'); setTarget(classes[0]?.id || '') }}><UsersThree /> 학급</button>
              <button className={scope === 'personal' ? 'is-on' : ''} onClick={() => { setScope('personal'); setTarget(students[0]?.id || '') }}><ChatCircleDots /> 개인</button>
              {(profile?.role === 'school_admin' || profile?.role === 'admin') && <button className={scope === 'school' ? 'is-on' : ''} onClick={() => { setScope('school'); setTarget(profile.school_id) }}><Megaphone /> 학교</button>}
            </div>
            {initialStudentName && scope === 'personal' && <p className="selected-student-note"><Check weight="bold" /> {initialStudentName} 학생을 선택했어요.</p>}
            <div className="recipient-list">
              {targetOptions.map(item => (
                <button key={item.id} className={target === item.id ? 'is-on' : ''} onClick={() => setTarget(item.id)}>
                  <span>{item.name.slice(0, 1)}</span><div><b>{item.name}</b><small>{item.meta}</small></div>{target === item.id && <Check weight="bold" />}
                </button>
              ))}
            </div>
          </aside>

          <section className="message-writing-desk">
            <div className="writing-context"><span><PaperPlaneTilt weight="fill" /></span><div><small>TO</small><b>{selected?.name || '받는 사람을 선택하세요'}</b></div></div>

            <div className="message-template-strip">
              <span>빠른 시작</span>
              {TEMPLATES.map(template => <button key={template.id} onClick={() => applyTemplate(template)}>{template.title}</button>)}
            </div>

            <div className="message-kind">
              <button className={type === 'notice' ? 'is-on' : ''} onClick={() => setType('notice')}><Bell /> 안내</button>
              <button className={type === 'encourage' ? 'is-on' : ''} onClick={() => setType('encourage')}><Sparkle /> 격려</button>
            </div>

            <label className="teacher-message-field"><span>제목</span><input value={title} maxLength={60} placeholder="학생이 한눈에 이해할 제목" onChange={event => setTitle(event.target.value)} /><small>{title.length} / 60</small></label>
            <label className="teacher-message-field teacher-message-body"><span>내용</span><textarea value={body} rows={7} maxLength={500} placeholder="무엇이 좋아졌는지, 다음에는 무엇을 해보면 좋을지 구체적으로 적어 주세요." onChange={event => setBody(event.target.value)} /><small>{body.length} / 500</small></label>

            <footer className="teacher-message-sendbar">
              {result && <p className={result.ok ? 'is-ok' : 'is-error'}>{result.ok && <Check weight="bold" />}{result.msg}</p>}
              <button disabled={sending || !title.trim() || !body.trim() || !target} onClick={send}><PaperPlaneTilt weight="fill" /> {sending ? '보내는 중' : '메시지 보내기'}</button>
            </footer>
          </section>
        </div>
      ) : (
        <section className="teacher-inbox">
          <header><div><h2>학생 답장</h2><p>학생이 선생님의 메시지에 보낸 답장만 표시됩니다.</p></div><button onClick={loadInbox}><ChatCircleDots /> 새로고침</button></header>
          {inbox.length === 0 ? <div className="teacher-inbox-empty"><ChatCircleDots /><b>아직 도착한 답장이 없습니다</b><span>학생이 답장하면 이곳에서 바로 확인할 수 있어요.</span></div>
            : inbox.map(item => <article key={item.id}><span>{(item.from_name || '학').slice(0, 1)}</span><div><header><b>{item.from_name || '학생'}</b><time>{new Date(item.created_at).toLocaleString('ko-KR')}</time></header><p>{item.body}</p></div></article>)}
        </section>
      )}
    </main>
  )
}

function demoStudents() {
  return [
    { id: 's1', classId: 'c1', name: '이수현' },
    { id: 's2', classId: 'c1', name: '박민준' },
    { id: 's3', classId: 'c1', name: '최유나' },
  ]
}

function demoInbox() {
  return [
    { id: 'r1', from_name: '박민준', body: '선생님, 오답노트에서 다시 풀어봤어요. 두 번째에는 맞혔습니다!', created_at: new Date().toISOString() },
    { id: 'r2', from_name: '이수현', body: '오늘 미션 확인했어요. 방과 후에 마무리할게요.', created_at: new Date(Date.now() - 4200000).toISOString() },
  ]
}
