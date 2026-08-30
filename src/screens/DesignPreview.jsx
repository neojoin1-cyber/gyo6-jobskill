import { useEffect, useState } from 'react'
import { Bell, ChartLineUp, Compass, House, UserCircle } from '@phosphor-icons/react'
import StudentCampusHome from './student/StudentCampusHome.jsx'
import NotificationsScreen from './student/NotificationsScreen.jsx'
import TeacherWorkspace from './teacher/TeacherWorkspace.jsx'
import TeacherMessageScreen from './teacher/TeacherMessageScreen.jsx'
import CoverLetterReviewScreen from './teacher/CoverLetterReviewScreen.jsx'
import GuidedStudyScreen from './student/GuidedStudyScreen.jsx'
import InterviewStudyScreen from './student/InterviewStudyScreen.jsx'
import TeacherLearningPreview from './teacher/TeacherLearningPreview.jsx'
import CourseListScreen from './student/CourseListScreen.jsx'
import AccountDataScreen from './student/AccountDataScreen.jsx'
import PwaInstallPrompt from '../components/PwaInstallPrompt.jsx'
import { campusCourseTarget } from '../lib/studentCampusRoutes.js'
import { rememberStudentLearningContext } from '../lib/studentLearningJourney.js'
import StudySummary, { buildStudySummaryCards } from './student/StudySummary.jsx'
import { PERSONALITY_STUDY_PROGRAM } from '../lib/guidedLearningPrograms.js'
import { buildQuestionDrivenSummary } from '../lib/learningExperience.js'
import { generalKnowledgeQuestions } from '../lib/ncsBanks.js'
import { ncs2026Questions } from '../lib/ncs2026.js'
import abilitySummaries from '../../data/ability-summaries.json'
import '../styles/campus.css'

const STUDENT_PROFILE = { id: 'preview-student', display_name: '민준', role: 'student' }
const TEACHER_PROFILE = { id: 'preview-teacher', display_name: '김선생', role: 'teacher' }
const MBO_PREVIEW_QUESTION = generalKnowledgeQuestions.find(question => question.stem?.includes('MBO(목표관리법'))
const TEAMWORK_PREVIEW_QUESTIONS = ncs2026Questions.filter(question => question.ncsAbility === '협업능력')

export default function DesignPreview() {
  const params = new URLSearchParams(window.location.search)
  const initial = params.get('preview') || 'student'
  const bare = params.get('bare') === '1'
  const [mode, setMode] = useState(initial)
  const [messageTarget, setMessageTarget] = useState({})
  const [classroomContext, setClassroomContext] = useState(null)
  const [studentTarget, setStudentTarget] = useState(null)
  const student = mode.startsWith('student') || mode === 'interview-first' || (mode === 'personality-wording' && params.get('layout') === 'student')

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
        {mode === 'pwa-install' && <PwaInstallPrompt forceOpen />}
        {mode === 'student' && (
          <div className="preview-phone">
            <StudentCampusHome profile={STUDENT_PROFILE} demo
              onGoMessages={() => setMode('student-messages')}
              onGoStudy={target => { setStudentTarget(typeof target === 'string' || target == null ? campusCourseTarget(target) : target); setMode('student-study') }}
              onGoWrong={() => {}}
              onOpenMission={() => {}} />
            <PreviewBottomNav onMessages={() => setMode('student-messages')} onMe={() => setMode('student-account')} />
          </div>
        )}
        {mode === 'student-study' && <div className="preview-learning"><CourseListScreen
          deepLink={studentTarget}
          onContextChange={rememberStudentLearningContext}
          onBack={() => setMode('student')}
        /></div>}
        {mode === 'student-messages' && (
          <div className="preview-phone"><NotificationsScreen demo /><PreviewBottomNav active="messages" onMessages={() => {}} onMe={() => setMode('student-account')} /></div>
        )}
        {mode === 'student-account' && (
          <div className="preview-phone"><AccountDataScreen onOpenCareer={(options = {}) => {
            setStudentTarget({ subject: 'cover-letter', area: null, lesson: null, mode: options.workspace === 'evidence' ? 'cover-evidence' : 'cover-practical', evidenceSeed: options.evidenceSeed, careerProfile: options.careerProfile })
            setMode('student-study')
          }} /><PreviewBottomNav active="me" onMessages={() => setMode('student-messages')} onMe={() => {}} /></div>
        )}
        {mode === 'personality-wording' && (() => {
          const lesson = PERSONALITY_STUDY_PROGRAM.areas.find(area => area.id === 'response')?.lessons.find(item => item.id === 'personality-wording')
          const cards = buildStudySummaryCards(lesson?.summary)
          const requestedStep = params.get('card') === 'formative'
            ? cards.findIndex(card => card.type === 'formative')
            : Number(params.get('step') || 1)
          return <div className="preview-learning"><GuidedStudyScreen
            program={PERSONALITY_STUDY_PROGRAM}
            initialArea="response"
            initialLesson="personality-wording"
            initialStep={Math.max(0, requestedStep)}
            onBack={() => {}}
            onChallenge={() => {}}
          /></div>
        })()}
        {mode === 'interview-first' && (
          <div className="preview-learning"><InterviewStudyScreen
            initialArea="interview-foundation"
            initialLesson="A01"
            onBack={() => {}}
          /></div>
        )}
        {mode === 'knowledge-mbo' && MBO_PREVIEW_QUESTION && (
          <div className="preview-learning"><StudySummary
            summary={buildQuestionDrivenSummary({
              title: '조직·인사·리더십·성과관리',
              questions: [MBO_PREVIEW_QUESTION],
              courseKind: 'recruitment',
            })}
            questions={[MBO_PREVIEW_QUESTION]}
            initialStep={1}
            onStartQuiz={() => {}}
          /></div>
        )}
        {mode === 'knowledge-teamwork' && (
          <div className="preview-learning"><StudySummary
            summary={{ ...abilitySummaries['협업능력'], courseKind: 'ncs' }}
            questions={TEAMWORK_PREVIEW_QUESTIONS}
            initialStep={1}
            initialInteraction={{ step: 1, revealed: true }}
            onStartQuiz={() => {}}
          /></div>
        )}
        {mode === 'teacher' && (
          <TeacherWorkspace profile={TEACHER_PROFILE} demo tab="dashboard" pendingCount={3} missions={[]}
            onTab={() => {}} onNavigate={() => {}} onOpenClassroom={context => { setClassroomContext(context); setMode('teacher-classroom') }}
            onOpenMessages={params => { setMessageTarget(params || {}); setMode('teacher-messages') }}
            onOpenCoverReviews={() => setMode('teacher-cover')} />
        )}
        {mode === 'teacher-classroom' && <TeacherLearningPreview
          profile={TEACHER_PROFILE}
          demoMode
          teachingMode
          initialSubject={classroomContext?.subject}
          initialContext={classroomContext?.initialContext}
          initialClassId={classroomContext?.classId}
          initialClassName={classroomContext?.className}
          onBack={() => setMode('teacher')}
          onOpenMessages={() => {}}
        />}
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

function PreviewBottomNav({ active = 'home', onMessages, onMe }) {
  const items = [
    { id: 'home', label: '홈', icon: House },
    { id: 'study', label: '탐험', icon: Compass },
    { id: 'growth', label: '성장', icon: ChartLineUp },
    { id: 'messages', label: '소식', icon: Bell, onClick: onMessages },
    { id: 'me', label: '나', icon: UserCircle, onClick: onMe },
  ]
  return <nav className="bottom-tab preview-bottom-tab">{items.map(item => { const Icon = item.icon; return <button key={item.id} className={`tab-item ${active === item.id ? 'active' : ''}`} onClick={item.onClick}><span className="tab-icon"><Icon weight={active === item.id ? 'fill' : 'regular'} /></span>{item.label}</button> })}</nav>
}
