import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  Buildings,
  ChartLineUp,
  Compass,
  House,
  PresentationChart,
  UserCircle,
} from '@phosphor-icons/react'
import StudentCampusHome from '../student/StudentCampusHome.jsx'
import CourseListScreen from '../student/CourseListScreen.jsx'
import WrongAnswerScreen from '../student/WrongAnswerScreen.jsx'
import NotificationsScreen from '../student/NotificationsScreen.jsx'
import RankingScreen from '../student/RankingScreen.jsx'
import { campusCourseTarget } from '../../lib/studentCampusRoutes.js'
import TeacherLessonCoach from './TeacherLessonCoach.jsx'

export default function TeacherLearningPreview({ profile, initialSubject = null, onBack, onOpenMessages }) {
  const initialLink = useMemo(() => campusCourseTarget(initialSubject), [initialSubject])
  const [tab, setTab] = useState(initialLink ? 'study' : 'home')
  const [deepLink, setDeepLink] = useState(initialLink)
  const [learningContext, setLearningContext] = useState({ subject: initialLink?.subject || initialSubject, mode: null })
  const [coachOpen, setCoachOpen] = useState(() => window.matchMedia?.('(min-width: 900px)').matches ?? false)

  function openStudy(subject) {
    setDeepLink(campusCourseTarget(subject))
    setLearningContext({ subject, mode: null })
    setTab('study')
  }

  const tabs = [
    { id: 'home', label: '홈', icon: House, onClick: () => setTab('home') },
    { id: 'study', label: '탐험', icon: Compass, onClick: () => { setDeepLink(null); setTab('study') } },
    { id: 'growth', label: '성장', icon: ChartLineUp, onClick: () => setTab('growth') },
    { id: 'messages', label: '소식', icon: Bell, onClick: () => setTab('messages') },
    { id: 'ranking', label: '나', icon: UserCircle, onClick: () => setTab('ranking') },
  ]

  return (
    <div className="screen teacher-learning-preview">
      <header className="teacher-preview-context">
        <button type="button" className="teacher-preview-back" onClick={onBack} aria-label="교사 캠퍼스로 돌아가기">
          <ArrowLeft weight="bold" />
        </button>
        <span className="teacher-preview-mark"><Buildings weight="fill" /></span>
        <div><small>STUDENT VIEW</small><b>학생 화면 그대로 보기</b></div>
        <button type="button" className={`teacher-preview-exit ${coachOpen ? 'is-on' : ''}`} onClick={() => setCoachOpen(value => !value)} aria-expanded={coachOpen}>
          <PresentationChart weight={coachOpen ? 'fill' : 'regular'} />수업 코치
        </button>
      </header>

      <div className={`teacher-preview-stage ${coachOpen ? 'has-coach' : ''}`}>
        <div className="teacher-preview-body">
          {tab === 'home' && (
            <StudentCampusHome
              profile={profile}
              demo
              teacherPreview
              onOpenMission={() => openStudy(null)}
              onGoStudy={openStudy}
              onGoWrong={() => setTab('growth')}
              onGoMessages={() => setTab('messages')}
            />
          )}
          {tab === 'study' && (
            <CourseListScreen
              key={deepLink ? `${deepLink.subject}:teacher-preview` : 'teacher-preview-browse'}
              deepLink={deepLink}
              onContextChange={setLearningContext}
              onBack={() => { setDeepLink(null); setTab('home') }}
            />
          )}
          {tab === 'growth' && <WrongAnswerScreen profile={profile} />}
          {tab === 'messages' && <NotificationsScreen />}
          {tab === 'ranking' && <RankingScreen />}
        </div>
        {coachOpen && (
          <TeacherLessonCoach
            subject={learningContext.subject}
            mode={learningContext.mode}
            onMessage={onOpenMessages}
            onClose={() => setCoachOpen(false)}
          />
        )}
      </div>

      <nav className="bottom-tab teacher-preview-tabs" aria-label="학생 화면 미리보기 메뉴">
        {tabs.map(item => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button key={item.id} className={`tab-item ${active ? 'active' : ''}`} onClick={item.onClick}>
              <span className="tab-icon"><Icon weight={active ? 'fill' : 'regular'} /></span>
              {item.label}
            </button>
          )
        })}
      </nav>

      {tab === 'messages' && (
        <button className="teacher-preview-message-link" onClick={() => onOpenMessages?.({})}>
          교사 메시지함 열기
        </button>
      )}
    </div>
  )
}
