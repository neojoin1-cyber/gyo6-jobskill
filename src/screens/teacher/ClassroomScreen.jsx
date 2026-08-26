import { useAuth } from '../../App.jsx'
import TeacherLearningPreview from './TeacherLearningPreview.jsx'

/**
 * 교실 수업도 학생이 쓰는 학습관을 그대로 연다.
 * 별도의 슬라이드나 축약 교재를 만들지 않고, 교사용 기능은 공통 화면 위에만 얹는다.
 */
export default function ClassroomScreen({ initialSubject = null, initialContext = null, initialClassId = null, initialClassName = null, initialCoachOpen = false, onBack, onOpenMessages }) {
  const { profile, isTrial } = useAuth() ?? {}

  return (
    <TeacherLearningPreview
      profile={profile}
      demoMode={Boolean(isTrial)}
      initialSubject={initialSubject}
      initialContext={initialContext}
      initialClassId={initialClassId}
      initialClassName={initialClassName}
      initialCoachOpen={initialCoachOpen}
      teachingMode
      onBack={onBack}
      onOpenMessages={onOpenMessages}
    />
  )
}
