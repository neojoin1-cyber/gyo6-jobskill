import { useState } from 'react'
import StudyScreen          from './StudyScreen.jsx'
import InterviewStudyScreen from './InterviewStudyScreen.jsx'
import QualityMgmtScreen    from './QualityMgmtScreen.jsx'

const CATALOG = [
  {
    id: 'job-common',
    icon: '🏅',
    name: '직업공통능력',
    tag: '교육부 인증평가',
    tagColor: '#5B21B6',
    bg: '#EDE9FE',
    desc: '특성화고 · 마이스터고 학생 필수 인증평가 준비',
    meta: '9개 영역 · 311문항',
    type: 'study',
  },
  {
    id: 'ncs-basic',
    icon: '📖',
    name: '직업기초능력',
    tag: '공채 필기시험',
    tagColor: '#1D4ED8',
    bg: '#DBEAFE',
    desc: 'NCS 기반 기업 공채 필기시험 대비 학습',
    meta: '10개 영역',
    type: 'study',
  },
  {
    id: 'food-service',
    icon: '🍽️',
    name: '식음료서비스',
    tag: '도제학교 외부평가',
    tagColor: '#065F46',
    bg: '#D1FAE5',
    desc: 'NCS 기반 식음료서비스 직무 이론 학습',
    meta: '560문항',
    type: 'study',
  },
  {
    id: 'quality',
    icon: '⚙️',
    name: '품질경영',
    tag: '도제학교 외부평가',
    tagColor: '#065F46',
    bg: '#D1FAE5',
    desc: 'ISO · KS 품질관리 이론 및 실무 학습',
    meta: '교재 + 문제풀이 · 모의평가 10회',
    type: 'quality',
  },
  {
    id: 'interview',
    icon: '🎤',
    name: '고졸취업 면접스킬',
    tag: '취업 전략',
    tagColor: '#92400E',
    bg: '#FEF3C7',
    desc: '자기소개서 작성부터 면접 핵심 전략까지',
    meta: '유형별 학습 · 실전 연습',
    type: 'interview',
  },
]

export default function CourseListScreen() {
  const [course, setCourse] = useState(null)

  const selected = CATALOG.find(c => c.id === course)

  if (selected?.type === 'study') {
    return <StudyScreen initialSubject={course} onBack={() => setCourse(null)} />
  }
  if (course === 'quality') {
    return <QualityMgmtScreen onBack={() => setCourse(null)} />
  }
  if (course === 'interview') {
    return <InterviewStudyScreen onBack={() => setCourse(null)} />
  }

  return (
    <div className="screen">
      <div className="appbar">
        <span className="appbar-title">📚 교재</span>
      </div>
      <div className="screen-body">
        <p className="section-title">학습 과목 선택</p>
        {CATALOG.map(c => (
          <button key={c.id} onClick={() => setCourse(c.id)}
            style={{
              width: '100%', textAlign: 'left', background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: 14,
              padding: '14px', marginBottom: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: c.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26,
            }}>
              {c.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: c.tagColor, background: c.bg,
                  padding: '2px 7px', borderRadius: 20,
                  border: `1px solid ${c.tagColor}44`,
                  whiteSpace: 'nowrap',
                }}>
                  {c.tag}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 4 }}>{c.desc}</p>
              <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>{c.meta}</span>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 20, flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
