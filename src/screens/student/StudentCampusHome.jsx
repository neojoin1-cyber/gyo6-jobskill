import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Bell,
  BookOpenText,
  Briefcase,
  Buildings,
  ChartLineUp,
  ChatCircleDots,
  CheckCircle,
  FileText,
  GraduationCap,
  LockSimple,
  MapPin,
  PaperPlaneTilt,
  Play,
} from '@phosphor-icons/react'
import { supabase } from '../../lib/supabase.js'
import { getBootstrap } from '../../lib/localFirst.js'
import { getLevelInfo } from '../../lib/xp.js'
import { STUDENT_CAMPUS_HALLS } from '../../lib/studentCampusRoutes.js'
import '../../styles/campus.css'

const HALL_PRESENTATION = {
  'job-common': { icon: BookOpenText, className: 'spot-problem' },
  'ncs-basic': { icon: CheckCircle, className: 'spot-team' },
  'recruit-written': { icon: Briefcase, className: 'spot-career' },
  personality: { icon: ChartLineUp, className: 'spot-data' },
  'cover-letter': { icon: FileText, className: 'spot-cover' },
}

const CAMPUS_SPOTS = STUDENT_CAMPUS_HALLS
  .filter(hall => hall.id !== 'interview')
  .map(hall => ({ ...hall, ...HALL_PRESENTATION[hall.id] }))

const CONTINUE_COURSES = [
  { id: 'job-common', label: '직업공통능력 인증' },
  { id: 'ncs-basic', label: 'NCS 직업기초능력' },
  { id: 'recruit-written', label: '채용 필기' },
  { id: 'interview', label: '고졸 면접' },
  { id: 'cover-letter', label: '나를쓰다' },
]

function findContinueCourse() {
  try {
    const answered = JSON.parse(localStorage.getItem('nova_qprog_v1') || '{}')
    const interview = JSON.parse(localStorage.getItem('iv_progress') || '{}')
    return CONTINUE_COURSES
      .map(course => ({
        ...course,
        activityCount: course.id === 'interview'
          ? Object.keys(interview).length
          : Object.keys(answered[course.id] || {}).length,
      }))
      .filter(course => course.activityCount > 0)
      .sort((a, b) => b.activityCount - a.activityCount)[0] ?? null
  } catch { return null }
}

const campusAsset = (name) => `${import.meta.env.BASE_URL}images/campus/${name}`;

const STAMPS = [
  { src: campusAsset('stamp-listening.webp'), label: '경청 마스터' },
  { src: campusAsset('stamp-expression.webp'), label: '표현력 향상' },
  { src: campusAsset('stamp-perspective.webp'), label: '관점 전환' },
]

const EMPTY_BOOT = {
  xp: { total_xp: 860, weekly_xp: 140, level: 5 },
  streak: { current_streak: 7 },
  missions: [],
  wrong_count: 4,
  unread_count: 1,
}

export default function StudentCampusHome({
  profile,
  onOpenMission,
  onGoStudy,
  onGoWrong,
  onGoMessages,
  demo = false,
  teacherPreview = false,
}) {
  const [boot, setBoot] = useState(EMPTY_BOOT)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(!demo)

  useEffect(() => {
    if (demo) return
    let alive = true
    ;(async () => {
      const next = await getBootstrap()
      if (!alive) return
      setBoot(next ?? EMPTY_BOOT)

      if (profile?.id) {
        const { data } = await supabase
          .from('notifications')
          .select('id, title, body, created_at, is_read, sender_id')
          .eq('user_id', profile.id)
          .not('sender_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (alive) setMessage(data ?? null)
      }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [demo, profile?.id])

  const mission = useMemo(() => {
    const active = (boot?.missions ?? []).filter(item => item.status === 'active' && !item.completed_at)
    return active[0] ?? null
  }, [boot?.missions])

  const level = getLevelInfo(boot?.xp?.total_xp ?? 0)
  const displayName = profile?.display_name || '민준'
  const missionTitle = mission?.title || '오늘 배울 과목 고르기'
  const missionMinutes = mission?.time_limit_min || 12
  const unread = boot?.unread_count ?? 0
  const continuing = useMemo(findContinueCourse, [])

  function launchMission() {
    if (mission) onOpenMission?.(mission)
    else onGoStudy?.(null)
  }

  if (loading) {
    return <div className="campus-loading" aria-label="스킬캠퍼스를 준비하는 중"><span /></div>
  }

  return (
    <main className="campus-home">
      <header className="campus-topbar">
        <div className="campus-brand">
          <Buildings weight="fill" aria-hidden="true" />
          <span>스킬캠퍼스</span>
        </div>
        <div className="campus-level" aria-label={`${level.name}, ${level.progress}% 진행`}>
          <span className="level-mark"><GraduationCap weight="fill" /></span>
          <span>Lv. {boot?.xp?.level ?? 1}</span>
          <span className="level-track"><i style={{ width: `${level.progress}%` }} /></span>
        </div>
        <button className="campus-icon-button" onClick={onGoMessages} aria-label={`소식 ${unread}개`}>
          <Bell weight={unread ? 'fill' : 'regular'} />
          {unread > 0 && <span className="campus-unread">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </header>

      <section className="campus-greeting">
        <span className="campus-avatar" aria-hidden="true">{displayName.slice(0, 1)}</span>
        <div>
          <h1>{teacherPreview ? '학생 화면을 함께 살펴봐요' : `${displayName}아, 반가워!`}</h1>
          <p><span className="live-dot" /> {teacherPreview ? '학생과 같은 학습 흐름을 체험 중' : '친구들과 함께 캠퍼스를 탐험 중'}</p>
        </div>
        <button className="route-status" onClick={() => onGoStudy?.(null)}>
          <MapPin weight="fill" />
          <span>오늘의 루트</span>
          <b>2 / 6</b>
          <ArrowRight />
        </button>
      </section>

      <section className="campus-map" aria-label="스킬캠퍼스 지도">
        <img src={campusAsset('skill-campus-map.webp')} alt="학생들이 함께 배우고 쉬는 스킬캠퍼스 전경" />
        {CAMPUS_SPOTS.map(({ id, label, badge, authority, icon: Icon, className }) => (
          <button key={id} className={`campus-spot ${className}`} onClick={() => onGoStudy?.(id)} aria-label={`${label} · ${authority}`}>
            <Icon weight="bold" />
            <span className="campus-spot-copy"><small>{badge}</small><b>{label}</b></span>
          </button>
        ))}
        <button className="campus-active-spot" onClick={() => onGoStudy?.('interview')} aria-label="고졸면접관 · 특성화고 공정채용 면접">
          <ChatCircleDots weight="fill" />
          <span className="campus-spot-copy"><small>면접 필수</small><b>고졸면접관</b></span>
        </button>
      </section>

      <section className="mission-dock" aria-labelledby="today-mission-title">
        <img src={campusAsset('skill-campus-map.webp')} alt="" />
        <div className="mission-copy">
          <span className="mission-eyebrow">오늘의 캠퍼스 미션</span>
          <h2 id="today-mission-title">{missionTitle}</h2>
          <p>{mission ? `${mission.question_count ?? 5}개 활동 · ${missionMinutes}분` : '6개 학습관에서 오늘의 목표를 선택하세요'}</p>
        </div>
        <button className="mission-launch" onClick={launchMission}>
          <Play weight="fill" />
          <span>미션 출발</span>
        </button>
      </section>

      <section className="campus-section continue-section">
        <div className="campus-section-head">
          <h2>이어하기</h2>
          <button onClick={() => onGoStudy?.(null)}>전체 보기 <ArrowRight /></button>
        </div>
        <button className="continue-row" onClick={() => onGoStudy?.(continuing?.id ?? null)}>
          <span className="continue-media">
            <img src={campusAsset('skill-campus-map.webp')} alt="스킬캠퍼스 학습관 전경" />
            <i><Play weight="fill" /></i>
          </span>
          <span className="continue-copy">
            <b>{continuing ? `${continuing.label} 이어하기` : '첫 학습 시작하기'}</b>
            <small>{continuing ? `${continuing.activityCount}개 학습 기록에서 계속` : '관심 있는 학습관을 골라 보세요'}</small>
          </span>
          <strong>{continuing ? '이어가기' : 'START'}</strong>
          <ArrowRight />
        </button>
      </section>

      <section className="campus-section stamps-section">
        <div className="campus-section-head">
          <h2>내가 모은 스킬 스탬프 <span>3 / 4</span></h2>
          <button onClick={onGoWrong}>성장 기록 <ArrowRight /></button>
        </div>
        <div className="stamp-list">
          {STAMPS.map(stamp => (
            <button key={stamp.label} className="stamp-item" onClick={onGoWrong}>
              <img src={stamp.src} alt="" />
              <span>{stamp.label}</span>
            </button>
          ))}
          <button className="stamp-item stamp-locked" onClick={onGoWrong}>
            <span className="stamp-lock"><LockSimple weight="fill" /></span>
            <span>공감 챌린지</span>
          </button>
        </div>
      </section>

      <section className="teacher-note">
        <button onClick={onGoMessages}>
          <span className="teacher-avatar"><PaperPlaneTilt weight="fill" /></span>
          <span className="teacher-note-copy">
            <small>선생님 상담실</small>
            <b>{message?.title || '김선생님'} <i /></b>
            <span>{message?.body || '지난 대화 과제에서 질문 방식이 정말 좋아졌어! 다음 챕터도 기대할게 :)'}</span>
          </span>
          <ArrowRight />
        </button>
      </section>

    </main>
  )
}
