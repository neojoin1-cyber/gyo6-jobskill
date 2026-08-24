import { answerIdxOf } from './questionNorm.js'
/**
 * 외부평가 대비 학습 준비도 점검 (과목 규격 기반).
 *
 *  - 식음료 25V3: 지필 C01·C02·C06·C07·C08(자동채점) + 면접 C03·C04·C05(자가확인). 8중 6.
 *  - 품질  22V2: 7 능력단위(지필 4 + 면접 3). 면접 단위 MCQ는 지식 준비도만 점검한다.
 *
 * 시험지는 빈출 가중 + 변형 출제(buildSubjectMockPaper)로 회차마다 신선하게 구성된다.
 */
import { buildSubjectMockPaper } from './mockData.js'

export const PASS_SPECS = {
  'food-service': {
    standard: '25V3', title: '식음료서비스',
    unitNames: {
      C01: '식음료 영업 준비', C02: '식음료 영업장 예약 관리', C03: '환영 환송', C04: '식음료 주문',
      C05: '음료 서비스', C06: '음식 서비스', C07: '식음료 영업장 마감', C08: '식음료 영업장 위생안전관리',
    },
    written:   { units: ['C01', 'C02', 'C06', 'C07', 'C08'], timeMin: 50, perUnit: 6 }, // 지필 30문항(자동채점)
    interview: { units: ['C03', 'C04', 'C05'], timeMin: 15, perUnit: 3 },               // 면접 9문항(자가확인)
    interviewAuto: false,  // 면접 = 모범답안 비교 자가평가
    readinessOnly: true,
    passLine: 60, passUnits: 6, totalUnits: 8,
  },
  'quality': {
    standard: '22V2', title: '품질경영',
    unitNames: {
      S01: '구매품 품질관리', S02: '자재 입고관리', S03: '설비일상관리', S04: '공정품질관리',
      S05: '사내표준화', S06: '지속적개선활동', S07: '현장품질관리',
    },
    written:   { units: ['S02', 'S03', 'S04', 'S07'], timeMin: 40, perUnit: 6 }, // 지필 4 능력단위
    interview: { units: ['S01', 'S05', 'S06'], timeMin: 20, perUnit: 6 },        // 면접 3 능력단위(지식 자동채점 예측)
    interviewAuto: true,   // 실제 구술 합격 판정이 아닌 지식 준비도 자동점검
    readinessOnly: true,
    passLine: 60, passUnits: 5, totalUnits: 7,
  },
}

// 하위호환: 기존 import { PASS_SPEC } (식음료 규격)
export const PASS_SPEC = PASS_SPECS['food-service']
export function getPassSpec(subjectId) { return PASS_SPECS[subjectId] || PASS_SPECS['food-service'] }

const isAuto = q => q.questionMode === 'mcq' || q.questionMode === 'ox'

// 지필 능력단위에는 자동채점 가능한 문항만 허용한다.
function pickWritten(subjectId, unit, paperNo, n) {
  const big  = buildSubjectMockPaper(subjectId, unit, paperNo, n * 4)
  const auto = big.filter(isAuto)
  return auto.slice(0, n)
}

// 면접 능력단위에는 구술·자가확인형만 허용한다.
function pickInterview(subjectId, unit, paperNo, n) {
  const big = buildSubjectMockPaper(subjectId, unit, paperNo, Math.max(120, n * 20))
  return big.filter(q => !isAuto(q)).slice(0, n)
}

/** (과목, 회차) → 능력단위별 시험지. 같은 회차는 결정적, 회차마다 다른 변형. */
export function buildPassExam(subjectId = 'food-service', paperNo = 1) {
  const spec = getPassSpec(subjectId)
  const byUnit = {}
  for (const u of spec.written.units)
    byUnit[u] = pickWritten(subjectId, u, paperNo, spec.written.perUnit)
  for (const u of spec.interview.units)
    byUnit[u] = spec.interviewAuto
      ? pickWritten(subjectId, u, paperNo, spec.interview.perUnit)             // 지식 준비도 점검
      : pickInterview(subjectId, u, paperNo, spec.interview.perUnit)           // 구술·자가확인
  const written   = spec.written.units.flatMap(u => byUnit[u])
  const interview = spec.interview.units.flatMap(u => byUnit[u])
  return { subjectId, spec, paperNo, byUnit, written, interview, questions: [...written, ...interview] }
}

/**
 * 채점. 지필(객관식/OX)은 자동, 면접은 자가확인(selfPass) 또는 자동(interviewAuto).
 * @param exam        buildPassExam 결과(spec·subjectId 포함)
 * @param mcqAnswers  { questionId: 선택index }
 * @param selfPass    { unit: true|false }  면접 능력단위 자가 합격 표시(interviewAuto=false일 때)
 */
export function gradePassExam(exam, mcqAnswers = {}, selfPass = {}) {
  const spec = exam.spec || PASS_SPEC
  const allUnits = [...spec.written.units, ...spec.interview.units]
  const autoUnit = u => spec.written.units.includes(u) || spec.interviewAuto
  const units = []
  for (const u of allUnits) {
    const qs = exam.byUnit[u] || []
    const isWritten = spec.written.units.includes(u)
    const auto = qs.filter(isAuto)
    let correct = 0
    for (const q of auto) if (mcqAnswers[q.id] === answerIdxOf(q)) correct++
    const gradable = auto.length > 0
    const score = gradable ? Math.round((correct / auto.length) * 100) : null
    let pass
    if (autoUnit(u)) pass = gradable ? score >= spec.passLine : false
    else             pass = (u in selfPass) ? !!selfPass[u] : null   // 면접: 자가확인
    units.push({
      unit: u, name: spec.unitNames[u], isWritten,
      total: qs.length, autoCount: auto.length, correct, score, gradable, pass,
    })
  }
  const passedCount  = units.filter(x => x.pass === true).length
  const failedCount  = units.filter(x => x.pass === false).length
  const pendingCount = units.filter(x => x.pass === null).length
  // 학습 준비도: 기준 충족 능력단위 수를 요약하며 공식 합격 판정으로 사용하지 않는다.
  const maxPossible = passedCount + pendingCount
  const verdict =
    passedCount >= spec.passUnits ? 'pass' :
    maxPossible <  spec.passUnits ? 'fail' : 'pending'
  // 약점 능력단위(불합격 또는 자동채점 60점 미만) — 단, 이미 통과 단원은 제외
  const weakUnits = units.filter(x => x.pass !== true && (x.pass === false || (x.gradable && x.score < spec.passLine))).map(x => x.unit)
  return { units, passedCount, failedCount, pendingCount, passUnitsNeeded: spec.passUnits, verdict, weakUnits }
}
