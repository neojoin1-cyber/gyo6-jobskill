import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  Buildings,
  ChartLineUp,
  Compass,
  House,
  Monitor,
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

export default function TeacherLearningPreview({ profile, initialSubject = null, teachingMode = false, onBack, onOpenClassroom, onOpenMessages }) {
  const initialLink = useMemo(() => campusCourseTarget(initialSubject), [initialSubject])
  const [tab, setTab] = useState(initialLink ? 'study' : 'home')
  const [deepLink, setDeepLink] = useState(initialLink)
  const [learningContext, setLearningContext] = useState({ subject: initialLink?.subject || initialSubject, mode: null })
  const [coachOpen, setCoachOpen] = useState(false)
  const contextReady = Boolean(
    learningContext.stage && !['area-choice', 'lesson-choice'].includes(learningContext.stage),
  )

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
        <div><small>STUDENT VIEW · TEACHER PASS</small><b>학생과 같은 화면으로 배우기</b></div>
        <div className="teacher-preview-actions">
          <button type="button" className={`teacher-preview-exit ${coachOpen ? 'is-on' : ''}`} disabled={!contextReady}
            title={contextReady ? '현재 차시의 교사용 지도 지원' : '학습관에서 단원을 열면 활성화됩니다'}
            onClick={() => setCoachOpen(value => !value)} aria-expanded={coachOpen} aria-haspopup="dialog">
            <PresentationChart weight={coachOpen ? 'fill' : 'regular'} /><span>{contextReady ? '현재 단계 지도' : '단원 선택 전'}</span>
          </button>
          <button type="button" className="teacher-preview-classroom" onClick={onOpenClassroom} aria-label="교실 화면 시작" title="교실 화면 시작">
            <Monitor weight="bold" />
          </button>
        </div>
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
            context={learningContext}
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
