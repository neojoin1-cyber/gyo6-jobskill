import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  Play,
  Target,
  WarningCircle,
} from '@phosphor-icons/react'

const AREAS = {
  intent: '질문 의도',
  target: '지원처·직무',
  evidence: '경험 근거',
  structure: '답변 구조',
  ethics: '사실·블라인드',
  polish: '문장·최종 점검',
}

function q(id, area, stem, choices, answer, explanation) {
  return { id, area, stem, choices, answer, explanation }
}

export const COVER_DIAGNOSTIC_QUESTIONS = [
  q('CD01', 'intent', '지원동기 문항에서 평가자가 가장 먼저 확인할 연결은?', ['지원자의 취미와 성격', '개인 계기·지원처 근거·직무 기여', '기업 규모·복지·연봉', '합격 의지와 간절함'], 1, '지원동기는 개인 계기, 지원처만의 근거, 직무 기여가 한 흐름으로 이어져야 함.'),
  q('CD02', 'intent', '협업 경험 문항에 가장 필요한 내용은?', ['친한 관계를 유지한 방법', '팀 전체가 한 일을 길게 설명', '의견 차이를 조정한 내 행동과 공동 결과', '갈등이 없었다는 사실'], 2, '협업 문항은 의견 차이, 조정 행동, 공동 결과를 확인함.'),
  q('CD03', 'target', '지원처 조사 내용을 자기소개서에 쓰는 방법으로 가장 적절한 것은?', ['홈페이지 문구를 그대로 복사', '유명 기업이라는 점을 강조', '공식 사업 사실을 내 경험·직무 선택과 연결', '최근 기사를 출처 없이 단정'], 2, '공식 사실을 확인한 뒤 내 관심과 직무 준비 근거로 연결해야 함.'),
  q('CD04', 'target', '직무역량 문항에서 전공을 설명하는 가장 좋은 방식은?', ['학과 이름만 제시', '자격증 수만 나열', '사용 도구·수행 작업·지킨 기준을 제시', '좋아하는 과목을 길게 소개'], 2, '직무역량은 실제 수행 행동과 기준으로 증명해야 함.'),
  q('CD05', 'evidence', '좋은 경험 근거에 반드시 가까운 것은?', ['거창한 수상 경력', '내 행동과 확인 가능한 변화', '친구가 대신 정리한 결과', '열심히 했다는 다짐'], 1, '작은 경험도 직접 한 행동과 확인 가능한 결과가 있으면 강한 근거가 됨.'),
  q('CD06', 'evidence', '팀 프로젝트 경험에서 자신의 기여를 분명히 하는 표현은?', ['우리 팀은 최선을 다했습니다', '모두 함께 해결했습니다', '제가 거래 내역을 분류하고 팀원과 수정 금액을 검산했습니다', '성공적으로 마무리했습니다'], 2, '주어, 행동, 확인 방법이 드러나야 자신의 기여를 판단할 수 있음.'),
  q('CD07', 'structure', '문제해결 경험의 가장 설득력 있는 순서는?', ['성과→다짐→상황→원인', '상황→원인 확인→행동→전후 결과', '배운 점→팀 소개→문제', '회사 칭찬→경험→성격'], 1, '문제와 원인을 구분하고 행동 후 변화까지 보여 주는 순서가 적절함.'),
  q('CD08', 'structure', '700자 문항에서 상황 설명이 400자를 차지한다면 먼저 할 일은?', ['상황을 더 자세히 씀', '행동과 결과를 삭제', '상황을 줄이고 판단·행동·결과를 보강', '글자 수를 무시'], 2, '배경보다 지원자의 판단과 행동, 결과에 충분한 분량을 배분해야 함.'),
  q('CD09', 'ethics', '블라인드 자기소개서에서 가장 먼저 고칠 표현은?', ['전기 실습에서 회로를 점검함', '교내 프로젝트에서 기록을 개선함', '서울 소재 ○○고등학교에서 회장을 맡음', '팀원과 역할을 조정함'], 2, '학교명과 지역 등 편견을 유발할 수 있는 정보는 공고 기준에 따라 제거해야 함.'),
  q('CD10', 'ethics', '경험의 수치가 정확히 기억나지 않을 때 적절한 방법은?', ['더 커 보이는 수치를 만듦', '확인 가능한 기록을 찾고 불확실하면 과장하지 않음', '친구의 수치를 사용', '대략적인 값을 정확한 값처럼 씀'], 1, '자기소개서의 모든 사실과 수치는 질문을 받아도 설명할 수 있어야 함.'),
  q('CD11', 'polish', '글자 수가 700자 이내인 문항에 180자만 작성했다면?', ['제한을 지켰으므로 충분', '핵심 근거가 빠졌는지 확인하고 권장 분량까지 구체화', '같은 문장을 반복', '다른 기업 이름을 추가'], 1, '지나치게 짧은 답변은 질문의 요구와 근거가 충분한지 다시 점검해야 함.'),
  q('CD12', 'polish', '제출 직전 최종 점검으로 가장 적절한 것은?', ['맞춤법만 확인', '기관명·직무·질문 요구·블라인드·글자 수·사실을 함께 확인', '문장을 모두 길게 바꿈', '모범답안을 그대로 붙여 넣음'], 1, '형식뿐 아니라 지원처 일치, 질문 충족, 사실성까지 함께 확인해야 함.'),
]

export const COVER_MOCK_QUESTIONS = [
  q('CM01', 'intent', '“입사 후 이루고 싶은 목표” 문항의 답변으로 가장 적절한 것은?', ['빠르게 승진하겠습니다', '초기 업무를 정확히 익힌 뒤 반복 오류를 기록해 개선에 기여하겠습니다', '회사의 모든 업무를 잘하겠습니다', '최고의 인재가 되겠습니다'], 1, '초기 학습 행동과 장기 기여가 현실적으로 연결되어야 함.'),
  q('CM02', 'intent', '“실패 경험” 문항에서 감점 가능성이 가장 큰 답변은?', ['실패 원인 중 내 판단을 설명', '이후 바꾼 행동을 제시', '문제의 책임을 모두 팀원에게 돌림', '재적용 결과를 확인'], 2, '실패 문항은 책임 회피 없이 자신의 판단과 변화된 행동을 확인함.'),
  q('CM03', 'target', 'A기관의 공공가치를 지원동기에 연결한 문장으로 가장 적절한 것은?', ['공기업이라 안정적이어서 지원함', '국민 안전을 위한 설비 운영 역할을 확인했고, 안전 점검 실습 경험을 직무에 연결해 지원함', '누구나 아는 기관이라 지원함', '복지가 좋다고 들어 지원함'], 1, '기관의 역할, 자신의 경험, 지원 직무가 모두 드러남.'),
  q('CM04', 'target', '채용공고의 직무명이 “설비보전”일 때 가장 적절한 준비 근거는?', ['기업 광고를 많이 봄', 'PLC·센서 점검 순서와 작업 기록 경험', '친구가 해당 기업을 추천함', '회사 제품을 좋아함'], 1, '직무가 요구하는 실제 기술과 수행 경험을 제시해야 함.'),
  q('CM05', 'target', '지원 기관을 바꾼 뒤 반드시 함께 바꿔야 할 내용은?', ['글꼴만 변경', '지원처 근거·직무 요구·기여 내용', '이름만 변경', '문단 순서만 변경'], 1, '기관 이름만 교체하면 지원처별 근거와 직무 연결이 어긋남.'),
  q('CM06', 'evidence', '다음 중 행동 근거가 가장 구체적인 문장은?', ['책임감 있게 해결했습니다', '열심히 노력했습니다', '오류 항목을 시간순으로 분류하고 원본 영수증과 두 번 대조했습니다', '적극적으로 참여했습니다'], 2, '확인 가능한 동사, 순서, 기준이 포함된 문장이 강한 근거가 됨.'),
  q('CM07', 'evidence', '결과를 쓰는 방식으로 가장 적절한 것은?', ['큰 성과를 냈습니다', '팀이 좋아했습니다', '누락 3건을 찾아 정산표를 맞추고 검산 칸을 추가했습니다', '좋은 경험이었습니다'], 2, '수치, 완성물, 오류 변화 같은 확인 가능한 결과가 필요함.'),
  q('CM08', 'evidence', '수상 경력이 없는 학생이 사용할 수 있는 근거는?', ['사용할 근거가 없음', '전공 실습·현장실습·동아리·아르바이트에서 직접 한 행동', '다른 학생의 수상 경험', '가상의 프로젝트'], 1, '일상적인 학습과 활동도 행동과 결과가 분명하면 직무 근거가 됨.'),
  q('CM09', 'structure', 'STAR 구조에서 A에 해당하는 내용은?', ['상황', '과제', '내가 취한 행동', '결과'], 2, 'Action은 지원자가 실제로 취한 행동을 뜻함.'),
  q('CM10', 'structure', '지원동기의 올바른 연결 순서는?', ['복지→연봉→규모', '개인 계기→지원처 공식 근거→직무 기여', '성격→취미→가족', '회사 연혁→대표 이름→매출'], 1, '왜 이 지원처와 직무인지 자신의 근거로 연결해야 함.'),
  q('CM11', 'structure', '두 경험을 한 문항에 넣어 중심이 흐려질 때 가장 좋은 수정은?', ['경험을 더 추가', '질문 요구를 가장 잘 증명하는 경험 하나를 중심으로 정리', '결과를 모두 삭제', '기관 소개를 늘림'], 1, '핵심 경험 하나를 깊게 설명하는 편이 평가 근거를 선명하게 함.'),
  q('CM12', 'structure', '경험 문단에서 가장 많은 비중을 둘 부분은?', ['상황 배경', '팀원 소개', '내 판단·행동과 결과', '회사 역사'], 2, '평가자는 지원자가 무엇을 판단하고 실행했는지 확인함.'),
  q('CM13', 'ethics', '다음 중 사실성 점검을 통과하기 어려운 문장은?', ['작업일지로 점검 순서를 확인할 수 있음', '팀원과 검산한 파일이 남아 있음', '기여율 100%로 모든 문제를 혼자 해결함', '담당 교사의 피드백을 반영함'], 2, '팀 활동을 혼자 한 것처럼 과장하면 면접에서 검증되기 어려움.'),
  q('CM14', 'ethics', '고객 개인정보를 다룬 경험에서 강조할 행동은?', ['빠른 공유를 위해 개인 메신저 사용', '필요한 범위만 확인하고 규정된 저장·폐기 절차 준수', '친구에게 사례 전달', '화면을 촬영해 보관'], 1, '정보 최소 확인과 규정 준수 행동이 신뢰를 증명함.'),
  q('CM15', 'ethics', '모범답안을 활용하는 올바른 방법은?', ['문장 전체를 복사', '구조만 참고하고 경험·수치·표현은 자신의 사실로 작성', '기관명만 교체', '친구와 같은 답변 제출'], 1, '예시는 답변 구조를 익히는 자료이며 개인 사실을 대신할 수 없음.'),
  q('CM16', 'polish', '“저는 책임감이 강합니다”를 보완하는 가장 좋은 방법은?', ['매우를 추가', '책임감을 세 번 반복', '맡은 일, 판단 기준, 끝까지 확인한 결과를 사례로 제시', '다른 장점을 나열'], 2, '추상적인 강점은 행동 사례와 결과로 증명해야 함.'),
  q('CM17', 'polish', '문항이 요구한 내용이 세 가지인데 두 가지만 답했다면?', ['문장이 자연스러우면 제출', '빠진 요구를 확인해 근거와 함께 보완', '글자 수만 맞춤', '제목을 바꿈'], 1, '질문의 모든 요구 요소에 답했는지 체크해야 함.'),
  q('CM18', 'polish', '한 문장이 너무 길어 의미가 흐릴 때 적절한 수정은?', ['쉼표를 계속 추가', '한 문장에 한 핵심 행동을 두고 원인·행동·결과를 나눔', '내용을 모두 삭제', '어려운 용어를 추가'], 1, '핵심 단위로 문장을 나누면 행동과 결과가 분명해짐.'),
  q('CM19', 'polish', '제출 파일의 기관명이 본문과 다를 때 해야 할 일은?', ['파일명만 수정', '지원처와 관련된 모든 문장·직무·파일명을 다시 대조', '그대로 제출', '기업명을 약칭으로 통일'], 1, '지원처 불일치는 치명적이므로 문서 전체를 다시 확인해야 함.'),
  q('CM20', 'polish', '자기소개서와 1분 자기소개를 연결하는 가장 좋은 방법은?', ['서로 다른 경험 사용', '자기소개서의 핵심 직무 강점과 대표 근거를 말하기 분량으로 압축', '자기소개서 내용을 모두 암기', '지원처 이름을 생략'], 1, '두 자료는 같은 지원처·직무·사실을 공유하되 말하기에 맞게 압축해야 함.'),
]

function areasOf(questions) {
  return [...new Set(questions.map(item => item.area))]
}

export default function CoverLetterAssessment({ mode = 'diagnostic', onGoLearn }) {
  const bank = mode === 'mock' ? COVER_MOCK_QUESTIONS : COVER_DIAGNOSTIC_QUESTIONS
  const [scope, setScope] = useState('all')
  const [count, setCount] = useState(mode === 'mock' ? 20 : 12)
  const [minutes, setMinutes] = useState(mode === 'mock' ? 20 : 0)
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [finished, setFinished] = useState(false)
  const [remaining, setRemaining] = useState(0)

  const questions = useMemo(() => {
    const scoped = scope === 'all' ? bank : bank.filter(item => item.area === scope)
    return scoped.slice(0, Math.min(count, scoped.length))
  }, [bank, count, scope])
  const current = questions[index]

  useEffect(() => {
    if (!started || finished || mode !== 'mock' || remaining <= 0) return
    const timer = setInterval(() => setRemaining(value => value - 1), 1000)
    return () => clearInterval(timer)
  }, [started, finished, mode, remaining])
  useEffect(() => {
    if (started && mode === 'mock' && remaining === 0) setFinished(true)
  }, [started, mode, remaining])

  function start() {
    setIndex(0); setAnswers({}); setFinished(false); setStarted(true)
    setRemaining(minutes * 60)
  }
  function choose(choice) {
    if (!current || answers[current.id] !== undefined) return
    setAnswers(value => ({ ...value, [current.id]: choice }))
  }
  function next() {
    if (index < questions.length - 1) setIndex(value => value + 1)
    else setFinished(true)
  }

  if (!started) {
    return <section className="cover-assessment-setup">
      <header><span>{mode === 'mock' ? 'WRITING PRACTICE TEST' : 'WRITING CHECK-UP'}</span><h3>{mode === 'mock' ? '실전 문항 평가' : '작성 기준 진단'}</h3><p>{mode === 'mock' ? '해설 없이 끝까지 풂 · 제출 후 기준별 결과 확인' : '질문 의도부터 최종 점검까지 부족한 기준을 찾음'}</p></header>
      <div className="cover-assessment-scopes"><button className={scope === 'all' ? 'is-on' : ''} onClick={() => setScope('all')}>전체</button>{areasOf(bank).map(area => <button key={area} className={scope === area ? 'is-on' : ''} onClick={() => setScope(area)}>{AREAS[area]}</button>)}</div>
      {mode === 'mock' && <div className="cover-assessment-options"><label><span>문항 수</span><select value={count} onChange={event => setCount(Number(event.target.value))}><option value="10">10문항</option><option value="20">20문항</option></select></label><label><span>제한 시간</span><select value={minutes} onChange={event => setMinutes(Number(event.target.value))}><option value="10">10분</option><option value="20">20분</option><option value="30">30분</option></select></label></div>}
      <div className="cover-assessment-ready"><Target weight="duotone" /><div><b>{questions.length}문항 준비됨</b><p>{mode === 'mock' ? `${minutes}분 · 중간 정답 공개 없음` : '완료 후 약한 기준과 학습 위치 안내'}</p></div></div>
      <button className="cover-assessment-start" onClick={start}><Play weight="fill" />{mode === 'mock' ? '실전 평가 시작' : '진단 시작'}</button>
    </section>
  }

  if (finished) {
    const correct = questions.filter(item => answers[item.id] === item.answer).length
    const score = Math.round(correct / Math.max(1, questions.length) * 100)
    const areaResults = areasOf(questions).map(area => {
      const items = questions.filter(item => item.area === area)
      const done = items.filter(item => answers[item.id] === item.answer).length
      return { area, done, total: items.length, pct: Math.round(done / items.length * 100) }
    }).sort((a, b) => a.pct - b.pct)
    try { localStorage.setItem(`iv_cover_${mode}_result`, JSON.stringify({ score, areaResults, at: new Date().toISOString() })) } catch { /* local storage unavailable */ }
    return <section className="cover-assessment-result">
      <header className={score >= 80 ? 'is-good' : 'is-review'}><CheckCircle weight="fill" /><div><span>{mode === 'mock' ? '실전 문항 평가 결과' : '작성 기준 진단 결과'}</span><strong>{score}점</strong><p>{correct}/{questions.length}문항 정답</p></div></header>
      <div className="cover-area-results">{areaResults.map(item => <article key={item.area}><div><b>{AREAS[item.area]}</b><span>{item.done}/{item.total}</span></div><i><span style={{ width: `${item.pct}%` }} /></i><small>{item.pct < 70 ? '보완 필요' : '기준 이해'}</small></article>)}</div>
      <section className="cover-result-review"><h4>틀린 문항 다시 보기</h4>{questions.filter(item => answers[item.id] !== item.answer).map(item => <details key={item.id}><summary><WarningCircle />{item.stem}</summary><p><b>정답</b> {item.choices[item.answer]}</p><p>{item.explanation}</p></details>)}</section>
      <div className="cover-result-actions"><button onClick={() => { setStarted(false); setFinished(false) }}><ArrowLeft />다시 설정</button><button onClick={onGoLearn}><FileText />부족한 기준 학습</button></div>
    </section>
  }

  const selected = answers[current.id]
  const canMove = selected !== undefined
  return <section className="cover-assessment-run">
    <header><div><b>{AREAS[current.area]}</b><span>{index + 1}/{questions.length}</span></div>{mode === 'mock' && <em><Clock />{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</em>}<i><span style={{ width: `${(index + 1) / questions.length * 100}%` }} /></i></header>
    <article><span>문제 {index + 1}</span><h3>{current.stem}</h3></article>
    <div className="cover-assessment-choices">{current.choices.map((choice, choiceIndex) => { const show = mode === 'diagnostic' && selected !== undefined; return <button key={choice} className={show ? choiceIndex === current.answer ? 'is-correct' : choiceIndex === selected ? 'is-wrong' : '' : selected === choiceIndex ? 'is-selected' : ''} onClick={() => choose(choiceIndex)}><span>{choiceIndex + 1}</span>{choice}</button> })}</div>
    {mode === 'diagnostic' && selected !== undefined && <div className={`cover-diagnostic-explain ${selected === current.answer ? 'is-correct' : 'is-wrong'}`}><b>{selected === current.answer ? '기준 이해' : `정답 ${current.answer + 1}번`}</b><p>{current.explanation}</p></div>}
    <button className="cover-assessment-next" disabled={!canMove} onClick={next}>{index === questions.length - 1 ? '결과 보기' : '다음 문제'}</button>
  </section>
}
