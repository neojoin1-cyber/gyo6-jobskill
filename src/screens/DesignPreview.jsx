import { useEffect, useState } from 'react'
import { Bell, ChartLineUp, Compass, House, UserCircle } from '@phosphor-icons/react'
import StudentCampusHome from './student/StudentCampusHome.jsx'
import NotificationsScreen from './student/NotificationsScreen.jsx'
import TeacherWorkspace from './teacher/TeacherWorkspace.jsx'
import TeacherMessageScreen from './teacher/TeacherMessageScreen.jsx'
import CoverLetterReviewScreen from './teacher/CoverLetterReviewScreen.jsx'
import '../styles/campus.css'

const STUDENT_PROFILE = { id: 'preview-student', display_name: '민준', role: 'student' }
const TEACHER_PROFILE = { id: 'preview-teacher', display_name: '김선생', role: 'teacher' }

export default function DesignPreview() {
  const initial = new URLSearchParams(window.location.search).get('preview') || 'student'
  const bare = new URLSearchParams(window.location.search).get('bare') === '1'
  const [mode, setMode] = useState(initial)
  const [messageTarget, setMessageTarget] = useState({})
  const student = mode.startsWith('student')

  useEffect(() => {
    document.documentElement.classList.toggle('teacher-mode', !student)
    if (!student) document.documentElement.dataset.teacherView = 'wide'
    else delete document.documentElement.dataset.teacherView
    return () => {
      document.documentElement.classList.remove('teacher-mode')
      delete document.documentElement.dataset.teacherView
    }
  }, [student])

  return (
    <div className={`design-preview ${student ? 'is-student' : 'is-teacher'} ${bare ? 'is-bare' : ''}`}>
      {!bare && <div className="design-preview-toolbar">
        <b>설탕과소금 · 스킬캠퍼스 작업본</b>
        <div>
          <button className={mode === 'student' ? 'is-on' : ''} onClick={() => setMode('student')}>학생 홈</button>
          <button className={mode === 'student-messages' ? 'is-on' : ''} onClick={() => setMode('student-messages')}>학생 소식</button>
          <button className={mode === 'teacher' ? 'is-on' : ''} onClick={() => setMode('teacher')}>교사 관리</button>
          <button className={mode === 'teacher-messages' ? 'is-on' : ''} onClick={() => setMode('teacher-messages')}>교사 메시지</button>
          <button className={mode === 'teacher-cover' ? 'is-on' : ''} onClick={() => setMode('teacher-cover')}>자소서 첨삭</button>
        </div>
      </div>}

      <div className="design-preview-stage">
        {mode === 'student' && (
          <div className="preview-phone">
            <StudentCampusHome profile={STUDENT_PROFILE} demo
              onGoMessages={() => setMode('student-messages')}
              onGoStudy={() => {}}
              onGoWrong={() => {}}
              onOpenMission={() => {}} />
            <PreviewBottomNav onMessages={() => setMode('student-messages')} />
          </div>
        )}
        {mode === 'student-messages' && (
          <div className="preview-phone"><NotificationsScreen demo /><PreviewBottomNav active="messages" onMessages={() => {}} /></div>
        )}
        {mode === 'teacher' && (
          <TeacherWorkspace profile={TEACHER_PROFILE} demo tab="dashboard" pendingCount={3} missions={[]}
            onTab={() => {}} onNavigate={() => {}} onOpenClassroom={() => {}}
            onOpenMessages={params => { setMessageTarget(params || {}); setMode('teacher-messages') }}
            onOpenCoverReviews={() => setMode('teacher-cover')} />
        )}
        {mode === 'teacher-empty' && (
          <TeacherWorkspace profile={TEACHER_PROFILE} classes={[]} tab="dashboard" pendingCount={0} missions={[]}
            workspaceState="ready" onRefresh={() => {}} onTab={() => {}} onNavigate={() => {}}
            onOpenClassroom={() => {}} onOpenMessages={() => {}} onOpenCoverReviews={() => {}} />
        )}
        {mode === 'teacher-messages' && <TeacherMessageScreen demo onBack={() => setMode('teacher')}
          initialScope={messageTarget.scope} initialTarget={messageTarget.target}
          initialStudentName={messageTarget.studentName} />}
        {mode === 'teacher-cover' && <CoverLetterReviewScreen demo onBack={() => setMode('teacher')} />}
      </div>
    </div>
  )
}

function PreviewBottomNav({ active = 'home', onMessages }) {
  const items = [
    { id: 'home', label: '홈', icon: House },
    { id: 'study', label: '탐험', icon: Compass },
    { id: 'growth', label: '성장', icon: ChartLineUp },
    { id: 'messages', label: '소식', icon: Bell, onClick: onMessages },
    { id: 'me', label: '나', icon: UserCircle },
  ]
  return <nav className="bottom-tab preview-bottom-tab">{items.map(item => { const Icon = item.icon; return <button key={item.id} className={`tab-item ${active === item.id ? 'active' : ''}`} onClick={item.onClick}><span className="tab-icon"><Icon weight={active === item.id ? 'fill' : 'regular'} /></span>{item.label}</button> })}</nav>
}
