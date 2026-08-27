import { useEffect, useRef, useState } from 'react'
import DiagnosticScreen from './DiagnosticScreen.jsx'
import JobAdaptationScreen from './JobAdaptationScreen.jsx'
import MissionScreen from './MissionScreen.jsx'
import {
  buildJcAreaPaper,
  buildJcSelfDiagnosisAreaPaper,
  JC_OFFICIAL_SPECS,
  JC_SELF_DIAG_SPECS,
} from '../../lib/jobCommonAreas.js'
import { COMMON_ABILITY_COURSES } from '../../lib/officialStandards.js'
import { popBack, pushBack, triggerBack } from '../../lib/backButton.js'

const COGNITIVE_AREAS = ['의사소통 국어', '의사소통 영어', '수리활용', '문제해결']

export default function JobCommonDiagnosticHub({ onBack }) {
  const [section, setSection] = useState(null)
  const [officialMission, setOfficialMission] = useState(null)
  const [officialBreak, setOfficialBreak] = useState(null)
  // 3학년 인증진단 전체 흐름. 회차를 바꿔 가며 같은 문항이 반복되지 않게 한다.
  const [certPaperNo] = useState(() => {
    try { return (Number(localStorage.getItem('sst.jc.certPaper') || 0) % 3) + 1 } catch { return 1 }
  })

  const backRef = useRef(null)
  backRef.current = () => {
    if (officialMission) {
      setOfficialMission(null)
      return
    }
    if (officialBreak) {
      setOfficialBreak(null)
      return
    }
    if (section) {
      setSection(null)
      return
    }
    onBack?.()
  }
  useEffect(() => {
    const id = pushBack(() => backRef.current())
    return () => popBack(id)
  }, [])

  // ── 3학년 인증진단(342문항·240분) 전체 흐름 ─────────────────────────
  //
  // 이 과목은 3학년 인증진단 대비인데, 진단 경로에는 1·2학년 자가진단
  // 215문항만 있었다. 학생이 "진단평가를 다 봤다"고 여기면서도 정작
  // 치를 시험은 한 번도 겪어 보지 못한 채 시험장에 간다.
  //
  // 공식 평가틀 그대로 간다 — 국어 50/50분, 영어 50/50분, 수리활용
  // 50/50분, 문제해결 32/50분, 직무적응 160문항/40분. 인지 4영역은
  // 듣기·멀티미디어 비중(국어·영어 30% 내외)과 도표 비중까지 시험지
  // 생성기가 맞춘다. 시간이 걸린 문항은 즉시 채점하지 않는다 —
  // 실제 시험처럼 끝나야 결과를 본다.
  function startCertSection(index = 0) {
    const areaName = COGNITIVE_AREAS[index]
    const spec = JC_OFFICIAL_SPECS[areaName]
    const paper = buildJcAreaPaper(areaName, certPaperNo)
    if (!spec || paper.length !== spec.count) {
      alert(`${areaName} 인증진단 시험지를 완성하지 못했습니다. (${paper.length}/${spec?.count ?? 0}문항)`)
      return
    }
    setOfficialBreak(null)
    setOfficialMission({
      id: null,
      mock: { kind: 'teenup-certification-section', section: areaName },
      title: `3학년 인증진단 · ${index + 1}교시 ${areaName}`,
      subject_id: 'job-common',
      questions: paper,
      question_count: paper.length,
      shuffle: false,
      time_limit_min: spec.minutes,
      lockNavigation: true,
      onComplete: () => {
        setOfficialMission(null)
        const nextIndex = index + 1
        if (nextIndex < COGNITIVE_AREAS.length) {
          setOfficialBreak({ nextIndex, completedArea: areaName, cert: true })
        } else {
          try {
            localStorage.setItem('sst.jc.certPaper', String(certPaperNo))
          } catch { /* 사생활 모드 */ }
          setSection('official-adaptation')
        }
      },
    })
  }

  function startOfficialSection(index = 0) {
    const areaName = COGNITIVE_AREAS[index]
    const spec = JC_SELF_DIAG_SPECS[areaName]
    const paper = buildJcSelfDiagnosisAreaPaper(areaName, 1)
    if (!spec || paper.length !== spec.count) {
      alert(`${areaName} 자가진단 시험지를 완성하지 못했습니다. (${paper.length}/${spec?.count ?? 0}문항)`)
      return
    }
    setOfficialBreak(null)
    setOfficialMission({
      id: null,
      mock: { kind: 'teenup-self-diagnosis-section', section: areaName },
      title: `1·2학년 자가진단 · ${index + 1}교시 ${areaName}`,
      subject_id: 'job-common',
      questions: paper,
      question_count: paper.length,
      shuffle: false,
      time_limit_min: spec.minutes,
      lockNavigation: true,
      onComplete: () => {
        setOfficialMission(null)
        const nextIndex = index + 1
        if (nextIndex < COGNITIVE_AREAS.length) {
          setOfficialBreak({ nextIndex, completedArea: areaName })
        } else {
          setSection('official-adaptation')
        }
      },
    })
  }

  if (officialMission) {
    return <MissionScreen mission={officialMission} onBack={() => setOfficialMission(null)} />
  }

  if (officialBreak) {
    const isCert = !!officialBreak.cert
    const nextArea = COGNITIVE_AREAS[officialBreak.nextIndex]
    const nextSpec = (isCert ? JC_OFFICIAL_SPECS : JC_SELF_DIAG_SPECS)[nextArea]
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>
          <span className="appbar-title">{isCert ? '인증진단' : '자가진단'} 교시 완료</span>
        </div>
        <div className="screen-body" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="card" style={{ textAlign: 'center', border: '2px solid #4f46e5' }}>
            <p style={{ fontSize: 40, marginBottom: 8 }}>✓</p>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>{officialBreak.completedArea} 완료</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
              다음은 {nextArea} {nextSpec.count}문항·{nextSpec.minutes}분입니다.
            </p>
            <button className="btn btn-primary btn-full"
              onClick={() => (isCert ? startCertSection : startOfficialSection)(officialBreak.nextIndex)}>
              다음 교시 시작
            </button>
            <button className="btn btn-ghost btn-full" style={{ marginTop: 8 }} onClick={() => setOfficialBreak(null)}>
              {isCert ? '인증진단' : '자가진단'} 종료
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (section === 'cognitive') {
    return (
      <DiagnosticScreen
        subjectId="job-common"
        subjectName={COMMON_ABILITY_COURSES['job-common'].title}
        onBack={() => setSection(null)}
      />
    )
  }
  if (section === 'adaptation') {
    return (
      <JobAdaptationScreen
        mode="quick"
        onBack={() => setSection(null)}
      />
    )
  }
  // 인증(3학년) 경로다. 1·2학년 규모(80문항·20분)를 쓰면 실제와 절반이 어긋난다.
  if (section === 'official-adaptation') {
    return (
      <JobAdaptationScreen
        mode="full"
        onBack={() => setSection(null)}
        onComplete={() => setSection('official-complete')}
      />
    )
  }
  if (section === 'official-complete') {
    return (
      <div className="screen">
        <div className="appbar">
          <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>
          <span className="appbar-title">1·2학년 자가진단 완료</span>
        </div>
        <div className="screen-body" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="card" style={{ textAlign: 'center', border: '2px solid #0f766e' }}>
            <p style={{ fontSize: 42, marginBottom: 8 }}>완료</p>
            <h2 style={{ fontSize: 19, marginBottom: 8 }}>215문항 자가진단을 마쳤습니다</h2>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: 16 }}>
              인지영역 135문항과 직무적응 80문항을 1·2학년 자가진단 규모로 응시했습니다.
              앱 결과는 학습용이며 공식 결과나 등급을 대신하지 않습니다.
            </p>
            <button className="btn btn-primary btn-full" onClick={() => setSection(null)}>진단 목록으로</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="appbar">
        <button className="appbar-back" onClick={triggerBack} aria-label="이전 화면">←</button>
        <span className="appbar-title">교육부 직업공통능력 인증</span>
      </div>
      <div className="screen-body">
        <div style={{
          borderRadius: 14,
          padding: '15px 16px',
          marginBottom: 16,
          background: 'linear-gradient(145deg,#eef2ff,#ecfeff)',
          border: '1px solid #a5b4fc',
        }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#3730a3', marginBottom: 5 }}>
            교육부·대한상의 기준: 학년별 진단 경로를 구분합니다
          </p>
          <p style={{ fontSize: 12.5, lineHeight: 1.7, color: '#475569' }}>
            3학년이 치르는 것은 342문항·240분 인증진단입니다. 1·2학년 자가진단(215문항)과
            규모·시간이 다르므로 학년에 맞는 경로로 응시하세요.
          </p>
        </div>

        {/* 모의고사에도 342문항 실전이 있다. 둘이 왜 따로 있는지 학생이 알 수
            있어야 한다 — 진단은 회차를 바꿔 가며 약한 영역을 찾는 쪽,
            모의는 검증된 시험지로 실전 한 번을 치르는 쪽이다. */}
        <p className="section-title">3학년 인증진단 규모 · 약한 영역 찾기</p>
        <button onClick={() => startCertSection(0)} style={{ ...cardStyle, border: '2px solid #0f766e' }}>
          <div style={{ ...iconStyle, background: '#ccfbf1', color: '#0f766e' }}>실전</div>
          <div style={{ flex: 1 }}>
            <p style={titleStyle}>5영역 342문항 인증진단 전체 흐름</p>
            <p style={descStyle}>
              국어 50 · 영어 50 · 수리활용 50 · 문제해결 32 (각 50분) + 직무적응 160 (40분)<br />
              국어·영어는 듣기 문항 30% 포함 · 교시마다 시간이 끝나면 자동 제출됩니다.<br />
              <b>응시할 때마다 회차가 바뀝니다.</b> 점수를 재는 실전 1회는 모의고사에 있습니다.
            </p>
          </div>
          <span style={arrowStyle}>›</span>
        </button>

        <p className="section-title">1·2학년 자가진단 규모</p>
        <button onClick={() => startOfficialSection(0)} style={{ ...cardStyle, border: '2px solid #4f46e5' }}>
          <div style={iconStyle}>공식</div>
          <div style={{ flex: 1 }}>
            <p style={titleStyle}>5영역 전체 자가진단 흐름</p>
            <p style={descStyle}>
              인지 135문항·각 50분 + 직무적응 80문항·20분<br />
              국어 40 · 영어 40 · 수리 25 · 문제해결 30 · 직무적응 80
            </p>
          </div>
          <span style={arrowStyle}>›</span>
        </button>

        <p className="section-title">앱 빠른 학습 진단</p>
        <button onClick={() => setSection('cognitive')} style={cardStyle}>
          <div style={iconStyle}>01</div>
          <div style={{ flex: 1 }}>
            <p style={titleStyle}>국어·영어·수리활용·문제해결</p>
            <p style={descStyle}>
              40문항 · 시간 제한 없음<br />
              2026 공개 영역 체계로 재분류한 축약 문항으로 취약 영역을 찾습니다.
            </p>
          </div>
          <span style={arrowStyle}>›</span>
        </button>

        <p className="section-title">직무적응 단독 자가진단</p>
        <button onClick={() => setSection('adaptation')} style={cardStyle}>
          <div style={{ ...iconStyle, background: '#ccfbf1', color: '#0f766e' }}>02</div>
          <div style={{ flex: 1 }}>
            <p style={titleStyle}>직무적응 6요인·12개 세부능력</p>
            <p style={descStyle}>
              80문항 · 20분 · 5점 척도<br />
              정답 없이 솔직성·일관성과 직무적응 성향을 점검합니다.
            </p>
          </div>
          <span style={arrowStyle}>›</span>
        </button>

        <div style={{
          marginTop: 16,
          padding: '11px 13px',
          borderRadius: 10,
          background: '#fff7ed',
          border: '1px solid #fdba74',
          color: '#9a3412',
          fontSize: 12,
          lineHeight: 1.65,
        }}>
          앱 진단은 학습용 자가진단이며 교육부·대한상공회의소의 공식 인증 결과나 등급을 대신하지 않습니다.
        </div>
      </div>
    </div>
  )
}

const cardStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  textAlign: 'left',
  padding: 15,
  marginBottom: 12,
  border: '1px solid var(--border)',
  borderRadius: 14,
  background: 'var(--card)',
  color: 'var(--text)',
  cursor: 'pointer',
  boxShadow: 'var(--shadow)',
}
const iconStyle = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  background: '#e0e7ff',
  color: '#4338ca',
  fontWeight: 900,
  fontSize: 13,
}
const titleStyle = { fontSize: 14.5, fontWeight: 800, marginBottom: 4 }
const descStyle = { fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted)' }
const arrowStyle = { fontSize: 22, color: 'var(--primary)', flexShrink: 0 }
