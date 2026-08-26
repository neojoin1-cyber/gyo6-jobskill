// 교육부·대한상공회의소 직업공통능력 인증진단 5영역(2026 기준).
// 기존 NCS식 9영역 문항을 공식 인증영역에 맞게 재분류한다.
import areaMapping from '../../data/areaMapping.json'
import englishBank from '../../data/jc-english-bank.json'
import jobQuestionsRaw from '../../data/questions.json'
import synthesisKorean from '../../data/jc-synthesis-korean.json'
import synthesisMath from '../../data/jc-synthesis-math.json'
import synthesisProblem from '../../data/jc-synthesis-problem.json'
import englishSupplement from '../../data/jc-english-supplement.json'
import jobVariantsFile from '../../data/job-variants.json'
import { attachDemand } from './demandLevel.js'
import { JOB_ADAPT_STUDY_LESSON, JOB_ADAPT_STUDY_QUESTIONS } from './jobAdaptationStudy.js'
import { JC_PULLDOWN_QUESTIONS } from './jobCommonPulldown.js'
import { JC_SET_QUESTIONS } from './jobCommonSets.js'
import { JC_BLUEPRINT_FILL } from './jobCommonBlueprintFill.js'
import { TEENUP_2026 } from './officialStandards.js'
import { questionPartitionIndex } from './assessmentPartition.js'
import {
  koreanListeningQuestions,
  mathVisualQuestions,
  jobCommonMediaQuestions,
} from './jobCommonMediaBank.js'

export const JC_OFFICIAL_SPECS = {
  '의사소통 국어': { count: 50, minutes: 50, group: '기초능력군' },
  '의사소통 영어': { count: 50, minutes: 50, group: '기초능력군' },
  '수리활용':      { count: 50, minutes: 50, group: '기초능력군' },
  '문제해결':      { count: 32, minutes: 50, group: '업무처리능력군' },
  '직무적응':      { count: 160, minutes: 40, group: '직장적응능력군', assessmentType: 'likert' },
}

// 공식 안내의 NCS 연계표:
// 문제해결 = 문제해결·자원관리·정보·기술·조직이해
// 직무적응 = 대인관계·자기개발·직업윤리
export const JC_AREA_MAP = {
  '의사소통능력': '의사소통 국어',
  '수리능력':     '수리활용',
  '문제해결능력': '문제해결',
  '자원관리능력': '문제해결',
  '정보능력':     '문제해결',
  '기술능력':     '문제해결',
  '조직이해능력': '문제해결',
  '대인관계능력': '직무적응',
  '자기개발능력': '직무적응',
  '직업윤리':     '직무적응',
}
export const JC_AREAS_ORDER = Object.keys(JC_OFFICIAL_SPECS)

export const JC_SELF_DIAG_SPECS = Object.fromEntries(
  TEENUP_2026.selfDiagnosis.areas.map(area => [area.id, {
    count: area.count,
    minutes: area.minutes,
    assessmentType: area.assessmentType,
  }])
)

export function jcOfficialArea(q) {
  if (JC_AREAS_ORDER.includes(q?.officialArea || q?.area)) return q.officialArea || q.area
  if (q?.id?.startsWith?.('ENG-') || q?.area === '의사소통 영어' || q?.area === '영어') {
    return '의사소통 영어'
  }
  const ncs = q?.area || null
  return JC_AREA_MAP[ncs] || null
}

// 1등급 등급기술("자료를 근거로 추론, 종합 파악")을 겨냥한 문항.
// 재태깅 실측 결과 인증진단 182문항 중 종합·추론 요구 문항이 11개(6%)뿐이고
// 국어·수리활용·문제해결은 0개였다. 단순 정보 찾기(5등급 수준)만으로는
// 1등급 대비가 되지 않아 세 영역에 15문항씩 새로 설계해 넣는다.
// 표·그래프는 아스키 아트가 아니라 visual 구조화 데이터로 두어 QuestionMedia 가 그린다.
// 영어 풀이 75문항인데 인증진단은 한 번에 50문항을 낸다. 1.5배뿐이라
// 2회차에 절반이 그대로 재출제됐다(실측 25/50). 40문항을 더해 2.3배로 만든다.
const ENGLISH_SUPPLEMENT = (englishSupplement.questions || []).map(q => ({
  ...q, mediaType: q.mediaType ?? null,
}))

const SYNTHESIS_QUESTIONS = [
  ...(synthesisKorean.questions || []),
  ...(synthesisMath.questions || []),
  ...(synthesisProblem.questions || []),
]

// 자율학습 화면이 쓰는 문항 목록.
//
// 시험지(buildJcAreaPaper 등)에는 이 문항들이 들어가는데 **자율학습 목록에는
// 없었다.** 그래서 종합·추론 세 단원과 영어 보강 단원을 고르면 화면이 텅 비었다.
// 단원은 만들어 두고 그 단원이 쓸 문항은 다른 통에 두었기 때문이다.
//
// lessonId 를 여기서 붙여 준다 — 자율학습은 lessonId 로 문항을 찾는다.
const SYNTH_LESSON = {
  'jc-synthesis-korean': 'JC-SYN-KO',
  'jc-synthesis-math': 'JC-SYN-MA',
  'jc-synthesis-problem': 'JC-SYN-PS',
}

export const jobCommonExtraStudyQuestions = [
  ...(synthesisKorean.questions || []).map(q => ({ ...q, lessonId: 'JC-SYN-KO', lessonTitle: '복합 자료 종합·추론' })),
  ...(synthesisMath.questions || []).map(q => ({ ...q, lessonId: 'JC-SYN-MA', lessonTitle: '자료 해석 종합·추론' })),
  ...(synthesisProblem.questions || []).map(q => ({ ...q, lessonId: 'JC-SYN-PS', lessonTitle: '복합 제약 상황의 최적안 도출' })),
  ...ENGLISH_SUPPLEMENT.map(q => ({ ...q, lessonId: 'JC-ENG-SUP', lessonTitle: '직무 영어 실전 보강' })),
  // 직무적응은 5점 척도 검사라 "공부할 것이 없다"고 두었더니, 342문항의 47%를
  // 차지하는 영역에 학습 단원이 하나도 없었다. 검사를 제대로 받는 법은 배울
  // 수 있다 — 이 문항들은 자율학습 전용이고 시험지에는 들어가지 않는다.
  ...JOB_ADAPT_STUDY_QUESTIONS,
  // 공식 시각자료 8문항은 인증평가의 표·그래프 비율을 맞추기 위해 모두
  // 평가 전용이다. 자율학습에는 내용이 겹치지 않는 별도 표 읽기 예시를 둔다.
  {
    id: 'JC26-MATH-VIS-STUDY-01',
    visual: {
      type: 'table',
      caption: '동아리 행사 준비 물품',
      columns: ['물품', '필요 수량', '현재 수량'],
      rows: [
        ['명찰', 80, 65],
        ['안내 책자', 60, 54],
        ['필기구', 90, 72],
        ['생수', 100, 88],
      ],
    },
    stem: '부족한 수량이 가장 많은 물품은 무엇인가요?',
    choices: ['명찰', '안내 책자', '필기구', '생수', '모두 같다'],
    answer: 'C',
    explanation: '필요 수량에서 현재 수량을 빼면 명찰 15개, 안내 책자 6권, 필기구 18개, 생수 12병이 부족합니다. 따라서 부족분이 가장 큰 필기구가 정답입니다. 필요 수량이나 현재 수량만 비교하면 실제 부족분을 잘못 판단하게 됩니다.',
    distractorTypes: ['현재 수량만 비교', '필요 수량만 비교', '차이 계산 누락', '전체 동일 오인'],
    area: '수리활용',
    officialArea: '수리활용',
    lessonId: 'JC26-MATH-VISUAL',
    lessonTitle: '표·그래프 수리활용',
    level: '기초',
    mediaType: 'visual',
    questionMode: 'mcq',
    learningLane: 'study',
    answerSource: 'app-authored-study-only',
  },
  // 풀다운은 공식 유형인데 우리에게 한 문항도 없었다. 서식의 여러 칸을 서로
  // 어긋나지 않게 채우는 연습은 사지선다로는 되지 않는다.
  ...JC_PULLDOWN_QUESTIONS,
  // 세트 문항 — 자료 하나로 여러 문항을 이어서 푼다. 공식 화면 구성에 있는데
  // 우리에게는 한 세트도 없었다. 낱개 문항만 풀면 "자료를 한 번 제대로 읽어
  // 두고 여러 문항에 나눠 쓰는" 방식을 연습할 기회가 없다.
  ...JC_SET_QUESTIONS,
  // 평가틀 격자에서 비어 있던 칸(자원관리 x 평가·성찰 등)을 채우려고 새로 쓴 문항.
  ...JC_BLUEPRINT_FILL,
]

// 원본 평가 문항을 학습 화면에 그대로 복사하지 않는다. 검증된 변형 문항 중
// 첫 번째를 같은 기준·다른 상황의 학습 전용 문항으로 사용한다.
const JOB_VARIANTS = jobVariantsFile?.variants || {}
export const jobCommonValidatedStudyQuestions = jobQuestionsRaw.flatMap(question => {
  const variant = JOB_VARIANTS[question.id]?.[0]
  if (!variant?.stem || !Array.isArray(variant.choices)) return []
  return [{
    ...question,
    ...variant,
    id: `${question.id}-LEARN-V1`,
    sourceQuestionId: question.id,
    learningLane: 'study',
    answerSource: 'validated-study-variant',
  }]
})

// 자율학습용: 5영역 각각에 소단원(lessons) 묶기 + 영어 단원 추가
// ── 교육부 인증진단의 문제해결 평가틀 축 ──────────────────────────────────
//
// 공개된 평가틀은 문제해결을 **4대 내용영역 × 4단계 과정**으로 본다.
// 그런데 우리 자율학습 단원은 NCS 직업기초능력 10영역 교재 목차를 그대로
// 옮겨 놓은 것이었다. "자원관리능력 연계 · 인력과 예산 배분하기" 처럼.
//
// 이름이 같은 것이 둘 있어서 더 혼란스러웠다 — 교육부 인증(5영역)과
// NCS 직업기초능력 26v1(7영역)은 **다른 시험**인데, 인증 과목 안에서
// NCS 능력 이름이 단원 제목과 배지로 떴다. 문항 풀은 처음부터 분리되어
// 있었지만(겹치는 문항 0개) 학생 눈에는 섞여 보였다.
//
// 그래서 문제해결 단원을 시험이 묻는 축으로 다시 세운다. 학생은 자기가
// 지금 어느 내용영역의 어느 단계를 연습하는지 알고 푼다.
export const PS_CONTENT_DOMAINS = [
  { id: '자원관리',     hint: '시간·예산·인력·물자를 조건에 맞게 나누기' },
  { id: '정보활용',     hint: '필요한 정보를 찾고 믿을 만한지 가리기' },
  { id: '기술활용',     hint: '도구와 절차를 골라 업무에 적용하기' },
  { id: '시스템적 사고', hint: '얽힌 문제의 원인과 파급을 함께 보기' },
]

// 실제 업무에서 문제를 다루는 순서. 학습도 이 순서로 흐르게 한다.
export const PS_PROCESS_ORDER = ['문제인식', '대안탐색 및 선택', '전략수립 및 실행', '평가 및 성찰']

const PS_PREFIX = 'PS|'
const JA_PREFIX = 'JA|'

// 직무적응은 5점 척도 검사라 "문제를 푸는 단원이 없다"고 보고 NCS 쪽 단원을
// 통째로 건너뛰었다. 그 결과 **172문항이 학생에게 닿지 않았다** —
// 자기개발 69, 직업윤리 51, 대인관계 52. 만들어 두고 묻어 둔 셈이다.
//
// 검사는 성격·동기·태도를 재지만, 그 태도가 자라는 바탕은 이 세 가지다.
// 검사 앞에 바탕을 익히는 단원으로 되살린다.
// 대인관계능력도 직무적응으로 이어지지만 직업공통 풀에는 문항이 하나도 없다.
// 빈 단원을 세우면 눌렀을 때 "학습 문항이 없습니다"만 뜬다. 문항이 생기면
// 게이트의 '고아 문항' 검사가 알려 준다.
export const JA_STUDY_DOMAINS = [
  { area: '자기개발능력', label: '자기개발 — 목표를 세우고 스스로 관리하기' },
  { area: '직업윤리',     label: '직업윤리 — 규정과 책임을 지키기' },
]

/** 이 문항이 그 단원에 속하는가. 평가틀 단원과 기존 단원을 함께 다룬다. */
export function jcLessonMatches(q, lessonId) {
  if (!q || !lessonId || lessonId === '__all__') return false
  if (lessonId.startsWith(PS_PREFIX)) {
    return q.teenupBlueprint?.contentDomain === lessonId.slice(PS_PREFIX.length)
  }
  if (lessonId.startsWith(JA_PREFIX)) {
    return q.area === lessonId.slice(JA_PREFIX.length)
  }
  return q.lessonId === lessonId || String(q.id || '').startsWith(lessonId)
}

/** 평가틀 단원 안에서는 과정 순서대로 푼다. 그 밖에는 원래 순서 그대로. */
export function jcOrderInLesson(questions, lessonId) {
  if (!lessonId || !lessonId.startsWith(PS_PREFIX)) return questions
  const rank = (q) => {
    const i = PS_PROCESS_ORDER.indexOf(q.teenupBlueprint?.process)
    return i < 0 ? PS_PROCESS_ORDER.length : i
  }
  return [...questions].sort((a, b) => rank(a) - rank(b))
}

/**
 * 자율학습이 쓰는 직업공통 문항 풀. **평가틀 태그를 붙여서** 내보낸다.
 *
 * 태그(내용영역·과정·업무맥락)는 그동안 모의고사 구성에서만 붙이고 학습
 * 화면에는 붙이지 않았다. 그래서 학생은 자기가 지금 무엇을 연습하는지
 * 알 수 없었고, 평가틀 단원으로 문항을 고를 수도 없었다.
 */
export function jcStudyQuestions() {
  const pool = [
    ...jobQuestionsRaw,
    ...englishStudyQuestions,
    ...jobCommonMediaQuestions,
    ...jobCommonExtraStudyQuestions,
    ...jobCommonValidatedStudyQuestions,
  ]
  const annotated = pool.filter(q => !q.excludeFromQuiz).map(q => {
    const off = jcOfficialArea(q)
    return off ? annotateBlueprint(q, off) : q
  })
  return dedupeByContent(annotated).filter(question => !isJcAssessmentQuestion(question))
}

const JC_STUDY_ONLY_IDS = new Set([
  'C25-24-Q01',
  'C10-9-Q01',
  'JC26-KO-LISTEN-01',
  'JC26-KO-LISTEN-02',
  'JC26-KO-LISTEN-03',
  'ENG-dialog-basic-01',
  'ENG-dialog-basic-02',
  'ENG-dialog-basic-03',
  // 복합 제약은 개념 적용에 필요한 서로 다른 상황을 충분히 연습한 뒤
  // 인증평가로 넘어가도록 5개 대표 문항을 학습 전용으로 확보한다.
  'JC-SYN-PS-01',
  'JC-SYN-PS-02',
  'JC-SYN-PS-03',
  'JC-SYN-PS-04',
  'JC-SYN-PS-05',
])

function isJcAssessmentQuestion(question) {
  if (question.learningLane === 'study') return false
  if (question.learningLane === 'assessment') return true
  if (JC_STUDY_ONLY_IDS.has(question.id)) return false
  if (question.mediaType === 'audio' || question.mediaType === 'visual') return true
  if ((question.choices || []).length !== 4) return false
  // 인증평가는 영역당 최대 50문항과 매체 비율을 맞춰야 한다. 4지선다의
  // 75%를 평가 전용으로 남기고 나머지와 비4지선다는 자율학습에만 쓴다.
  return questionPartitionIndex(question, 4) !== 0
}

export function jcAssessmentQuestions(questions) {
  return (questions || []).filter(isJcAssessmentQuestion)
}

export function buildJcOfficialAreas() {
  const byOfficial = {}
  for (const name of JC_AREAS_ORDER) byOfficial[name] = { id: name, label: name, lessons: [] }
  for (const a of areaMapping.areas) {
    const off = JC_AREA_MAP[a.displayName]
    if (!off) continue
    // 직무적응은 정답형 지식문항이 아니라 전용 리커트 자가진단으로 제공한다.
    if (off === '직무적응') continue
    // 문제해결은 아래에서 평가틀 축으로 따로 세운다. NCS 교재 목차를 그대로
    // 옮긴 단원(자원관리능력 연계 …)은 인증 과목에서 쓰지 않는다.
    if (off === '문제해결') continue
    for (const l of (a.lessons || [])) {
      // 자율학습에서는 별도 기능인 진단평가·모의평가로 오인될 명칭을 쓰지 않는다.
      // 문항은 학습 자료로 유지하되 학습 목적에 맞는 수준·단원명으로 안내한다.
      const studyTitle = l.title
        .replace(/종합복습\s*및\s*실전모의고사/g, '종합 복습')
        .replace(/진단평가/g, '핵심 점검')
        .replace(/진단\s*:/g, '핵심 점검 ·')
        .replace(/실전모의고사/g, '실전 종합 복습')
        .replace(/종합평가/g, '종합 복습')
        .replace(/활용 역량 평가/g, '활용 역량 점검')
        .replace(/융합 사고력 테스트/g, '융합 사고력 연습')
        // 제목 안쪽에 남은 NCS 능력 이름도 인증 영역 이름으로 바꾼다.
        // 교육부 인증 과목에서 "의사소통능력 종합 복습"이라고 뜨면, 이름이
        // 비슷한 NCS 직업기초능력 26v1 과목과 헷갈린다. 둘은 다른 시험이다.
        .replace(/의사소통능력/g, '의사소통 국어')
        .replace(/수리능력/g, '수리활용')
        .replace(/문제해결능력/g, '문제해결')
      byOfficial[off].lessons.push({
        id: l.id,
        label: studyTitle,
        level: l.level === '진단' ? '기초' : l.level,
      })
    }
  }
  // 문제해결: 시험이 묻는 4대 내용영역으로 단원을 세운다. 각 단원 안에서는
  // 문제인식 → 대안탐색 → 전략수립 → 평가·성찰 순으로 문항이 이어진다.
  for (const d of PS_CONTENT_DOMAINS) {
    byOfficial['문제해결'].lessons.push({
      id: `${PS_PREFIX}${d.id}`,
      label: `${d.id} — ${d.hint}`,
    })
  }

  // 영어: 공식 듣기·읽기 맥락이 드러나도록 유형명을 구체화한다.
  const engGroups = { vocab: '직무 어휘', dialog: '직무 대화 듣기', reading: '직무 문서 읽기' }
  for (const [kind, label] of Object.entries(engGroups))
    byOfficial['의사소통 영어'].lessons.push({ id: `ENG-${kind}`, label })
  byOfficial['의사소통 영어'].lessons.push({ id: 'JC-ENG-SUP', label: '직무 영어 실전 보강' })
  byOfficial['의사소통 국어'].lessons.push({ id: 'JC26-KO-LISTEN', label: '직무 한국어 듣기' })
  byOfficial['수리활용'].lessons.push({ id: 'JC26-MATH-VISUAL', label: '표·그래프 수리활용' })
  // 1등급 대비 종합·추론 단원
  byOfficial['의사소통 국어'].lessons.push({ id: 'JC-SYN-KO', label: '복합 자료 종합·추론', level: '고급' })
  byOfficial['수리활용'].lessons.push({ id: 'JC-SYN-MA', label: '자료 해석 종합·추론', level: '고급' })
  byOfficial['문제해결'].lessons.push({ id: 'JC-SYN-PS', label: '복합 제약 상황의 최적안 도출', level: '고급' })
  // 이건 문제를 푸는 단원이 아니라 5점 척도 자가진단이다. 자율학습 목록에
  // 그냥 두면 눌렀을 때 "학습 문항이 없습니다"만 뜬다 — 실제로 그랬다.
  // 성격을 표시해 두고 화면이 다르게 안내하게 한다.
  // 검사가 재는 태도의 바탕이 되는 세 갈래. 여기 문항들이 그동안 어느
  // 단원에도 걸리지 않아 묻혀 있었다.
  for (const d of JA_STUDY_DOMAINS) {
    byOfficial['직무적응'].lessons.push({ id: `${JA_PREFIX}${d.area}`, label: d.label })
  }

  // 검사 앞에 '배우는 단원'을 둔다. 무엇을 재는지, 어떻게 응답해야 내 모습이
  // 왜곡 없이 담기는지를 먼저 익히고 검사로 넘어가게 한다.
  byOfficial['직무적응'].lessons.push({
    id: JOB_ADAPT_STUDY_LESSON.id, label: JOB_ADAPT_STUDY_LESSON.label,
  })
  byOfficial['직무적응'].lessons.push({
    id: 'JC26-JOB-ADAPTATION', label: '정답 없는 6요인 자가진단', kind: 'self-report',
  })
  return JC_AREAS_ORDER.map(n => byOfficial[n]).filter(a => a.lessons.length)
}

// 대화 문항은 화면 대본 대신 1회 재생 듣기로 제공한다. 재생 불가 환경에서는
// ListeningPrompt가 접근성 대체수단으로 대본을 표시한다.
export const englishStudyQuestions = (englishBank.questions || []).map(q => ({
  ...q,
  area: '의사소통 영어',
  lessonId: `ENG-${q.kind}`,
  lessonTitle: { vocab: '직무 어휘', dialog: '직무 대화 듣기', reading: '직무 문서 읽기' }[q.kind] || '의사소통 영어',
  ...(q.kind === 'dialog' ? {
    audioText: q.context,
    transcript: q.context,
    audioLang: 'en-US',
    context: null,
    mediaType: 'audio',
    maxPlays: 1,
  } : {}),
}))

const ENG_LESSON_LABEL = {
  'ENG-vocab': '직무 어휘',
  'ENG-dialog': '직무 대화 듣기',
  'ENG-reading': '직무 문서 읽기',
}

function hashText(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededOrder(items, seed) {
  return [...items].sort((a, b) =>
    hashText(`${seed}|${a.id}`) - hashText(`${seed}|${b.id}`))
}

const PROBLEM_BIG_IDEA = {
  '자원관리능력': '자원관리',
  '정보능력': '정보활용',
  '기술능력': '기술활용',
  '문제해결능력': '시스템적 사고',
  '조직이해능력': '시스템적 사고',
}
const PROCESS_RULES = [
  {
    process: '평가 및 성찰',
    pattern: /결과|성과|효과|평가|검증|점검|피드백|재발|개선|보완|오류를?\s*(찾|확인)|적절했는지/,
  },
  {
    process: '전략수립 및 실행',
    pattern: /실행|시행|조치|절차|계획|일정|우선순위|담당|배분|보고|대응\s*방안|실천/,
  },
  {
    process: '대안탐색 및 선택',
    pattern: /대안|선택|비교|의사결정|가장\s*(적절|합리|효과)|해결\s*방안|우선해야/,
  },
  {
    process: '문제인식',
    pattern: /원인|핵심|쟁점|문제\s*(정의|파악|인식)|현황|차이|요구사항|제약|위험요인|상황을?\s*파악/,
  },
]

function classifyProblemProcess(q) {
  // 새로 설계한 문항은 어느 칸을 채우려고 쓴 것인지 문항 자체에 적어 둔다.
  // 낱말로 짐작하는 분류는 "결과"라는 단어 하나에 칸이 바뀌어서, 빈 칸을
  // 채우려고 쓴 문항이 엉뚱한 칸으로 가 버린다.
  if (q.psProcess && PS_PROCESS_ORDER.includes(q.psProcess)) {
    return { process: q.psProcess, basis: 'authored-blueprint' }
  }
  const text = `${q.lessonTitle || ''} ${q.stem || ''} ${q.context || ''}`
  const hit = PROCESS_RULES.find(rule => rule.pattern.test(text))
  if (hit) return { process: hit.process, basis: `content-keyword:${hit.process}` }

  // 명확한 과정 단서가 없는 구 문항은 영역의 교육 목적에 맞는 보수적 기본값을 쓴다.
  // ID·배열순서로 분류하지 않으며, 공식 기출과 동일하다고 주장하지 않는다.
  if (q.area === '정보능력' || q.area === '기술능력') {
    return { process: '평가 및 성찰', basis: `legacy-domain:${q.area}` }
  }
  if (q.area === '자원관리능력' || q.area === '조직이해능력') {
    return { process: '전략수립 및 실행', basis: `legacy-domain:${q.area}` }
  }
  return { process: '문제인식', basis: `legacy-domain:${q.area || '문제해결능력'}` }
}

function classifyWorkContext(q) {
  const text = `${q.lessonTitle || ''} ${q.stem || ''} ${q.context || ''}`
  if (/고객|민원|거래처|손님|서비스|상담/.test(text)) return '고객 응대'
  if (/동료|상사|팀|부서|조직|협업|회의/.test(text)) return '동료·상사 협업'
  return '개인 업무'
}

function classifyCognitiveDemand(q) {
  const text = `${q.stem || ''} ${q.context || ''}`
  if (/평가|성찰|타당|검증|개선|비판/.test(text)) return '판단 및 성찰'
  if (/적용|실행|조치|대응|작성|계산/.test(text)) return '직무 적용'
  if (/관계|원인|영향|비교|추론|분석/.test(text)) return '관계 이해'
  return '정보 확인'
}

function annotateBlueprint(q, officialArea) {
  const problem = officialArea === '문제해결' ? classifyProblemProcess(q) : null
  const contentDomain = officialArea === '문제해결'
    ? (q.psDomain || PROBLEM_BIG_IDEA[q.area] || '시스템적 사고')
    : officialArea
  const cleanText = value => typeof value === 'string'
    ? value
        .replace(/A등급\s*답안/g, '1등급·우수 수준의 답안')
        .replace(/A등급\s*문제해결/g, '1등급·우수 수준의 문제해결')
        .replace(/직업윤리\s*A등급\s*판단/g, '직업윤리 우수 수준의 판단')
    : value
  const visibleLessonTitle = officialArea === '문제해결'
    ? `${contentDomain} · ${problem?.process || '문제인식'}`
    : officialArea === '직무적응' && q.area === '자기개발능력'
      ? '자기관리 습관'
      : officialArea === '직무적응' && q.area === '직업윤리'
        ? '직업윤리와 책임'
        : q.lessonTitle
  // 요구 수준(공식 등급기술 앵커 기준)을 함께 붙인다. 기존 level 은 차시 배지에
  // 쓰이므로 건드리지 않고 별도 필드로 둔다.
  return {
    ...attachDemand(q),
    stem: cleanText(q.stem),
    explanation: cleanText(q.explanation),
    teachingNote: cleanText(q.teachingNote),
    lessonTitle: visibleLessonTitle,
    officialArea,
    teenupBlueprint: {
      contentDomain,
      cognitiveDemand: classifyCognitiveDemand(q),
      workContext: classifyWorkContext(q),
      process: problem?.process || null,
      classificationBasis: problem?.basis || 'official-area-crosswalk',
      alignmentStatus: q.alignmentStatus || 'crosswalk-practice-not-official-item',
    },
  }
}

function rotatedWindow(ordered, count, paperNo) {
  if (!ordered.length || count <= 0) return []
  const start = ((Math.max(1, paperNo) - 1) * count) % ordered.length
  return Array.from({ length: Math.min(count, ordered.length) }, (_, index) =>
    ordered[(start + index) % ordered.length])
}

function rotatedPick(items, count, paperNo, seed) {
  return rotatedWindow(seededOrder(items, seed), count, paperNo)
}

function balancedPick(items, count, groupOf, seed) {
  const groups = {}
  for (const item of items) (groups[groupOf(item)] ||= []).push(item)
  const keys = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'ko'))
  for (const key of keys) groups[key] = seededOrder(groups[key], `${seed}|${key}`)
  const indexes = Object.fromEntries(keys.map(key => [key, 0]))
  const picked = []
  while (picked.length < count) {
    let progressed = false
    for (const key of keys) {
      if (picked.length >= count) break
      if (indexes[key] < groups[key].length) {
        picked.push(groups[key][indexes[key]++])
        progressed = true
      }
    }
    if (!progressed) break
  }
  return picked
}

// 인증진단 시험지에 반드시 섞어야 할 종합·추론 문항 비율.
// 공식 1등급 등급기술이 "자료를 근거로 추론, 종합 파악"인데, 이 목표가 없으면
// 종합 문항을 풀에 넣어도 시험지에 한 문항도 안 담긴다. 실제로 새 문항 45개를
// 넣고도 1회차 시험지의 종합 문항은 0개였다 — rotatedPick 이 풀 앞쪽만 집었다.
const SYNTHESIS_SHARE = 0.2

// 같은 문항이 id 만 다른 채 여러 차시에 복사돼 있다. 교육공통 은행에서 8개
// 묶음(35문항)이 8차시 간격으로 반복 각인돼 있고, 그대로 두면 한 시험지에
// 같은 문제가 두 번 나온다 — 실측 48장 중 15장에서 그런 일이 있었다.
// id 가 아니라 내용(발문+보기)으로 걸러야 잡힌다.
function contentKey(q) {
  const ch = Array.isArray(q.choices) ? q.choices : Object.values(q.choices || {})
  const flat = t => String(t ?? '').replace(/[\s'"·,.()[\]]/g, '')
  return `${flat(q.stem)}|${flat([...ch].map(String).sort().join('|'))}`
}

/** 발문·보기가 같은 문항을 하나만 남긴다. 순서는 그대로 둔다. */
function dedupeByContent(list) {
  const seen = new Set()
  return list.filter(q => {
    const k = contentKey(q)
    if (flatLen(q) < 12) return true      // 너무 짧으면 우연히 같을 수 있어 건드리지 않는다
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
const flatLen = q => String(q.stem ?? '').replace(/\s/g, '').length

/** 종합 문항을 먼저 목표 수만큼 확보한 뒤 나머지를 채운다. */
function withSynthesis(pool, count, paperNo, seed) {
  const target = Math.min(Math.round(count * SYNTHESIS_SHARE),
                          pool.filter(q => q.demandLevel === '종합').length)
  if (target <= 0) return null
  const syn = rotatedPick(pool.filter(q => q.demandLevel === '종합'), target, paperNo, `${seed}|syn`)
  const rest = rotatedPick(pool.filter(q => q.demandLevel !== '종합'),
                           count - syn.length, paperNo, `${seed}|rest`)
  return [...syn, ...rest]
}

function problemBlueprintPick(items, count, paperNo, seed) {
  const pool = dedupeByContent(items)
  const picked = []
  const used = new Set()
  const add = question => {
    if (!question || used.has(question.id) || picked.length >= count) return
    used.add(question.id)
    picked.push(question)
  }

  for (const domain of TEENUP_2026.problemSolving.bigIdeas) {
    add(rotatedPick(
      pool.filter(q => q.teenupBlueprint?.contentDomain === domain),
      1, paperNo, `${seed}|domain|${domain}`,
    )[0])
  }
  for (const process of TEENUP_2026.problemSolving.processes) {
    if (picked.some(q => q.teenupBlueprint?.process === process)) continue
    add(rotatedPick(
      pool.filter(q => q.teenupBlueprint?.process === process),
      1, paperNo, `${seed}|process|${process}`,
    )[0])
  }

  const synthesisTarget = Math.round(count * SYNTHESIS_SHARE)
  const synthesisNeeded = Math.max(0, synthesisTarget - picked.filter(q => q.demandLevel === '종합').length)
  for (const question of rotatedPick(
    pool.filter(q => !used.has(q.id) && q.demandLevel === '종합'),
    synthesisNeeded, paperNo, `${seed}|syn`,
  )) add(question)

  balancedPick(
    pool.filter(q => !used.has(q.id)),
    count - picked.length,
    q => `${q.teenupBlueprint?.contentDomain}|${q.teenupBlueprint?.process}`,
    `${seed}|fill|${paperNo}`,
  ).forEach(add)
  return picked
}

function buildBlueprintPaper(areaName, paperNo, count, seedPrefix) {
  const found = buildJcMockAreas().find(a => a.id === areaName)
  if (!found || found.assessmentType === 'likert') return []
  const seed = `${seedPrefix}|${areaName}`

  // 실제 인증진단의 선택형은 **4지선다**다(공식 자가진단 매뉴얼: "4가지 선택지를
  // 제시 받아 그 중 하나를 고르는 형태", 공개 모의체험 화면도 ①②③④).
  // 우리 문항 가운데 아직 5지선다로 남은 것이 섞여 들어가면, 학생은 실제와
  // 다른 보기 수로 소거법과 시간 배분을 연습하게 된다.
  //
  // 그래서 시험지를 짤 때는 4지선다만 쓴다. 다만 아직 변환이 끝나지 않은
  // 영역에서 4지선다만으로 문항 수를 채울 수 없으면, 시험지를 못 만드는
  // 것보다는 낫기에 원래 풀로 되돌아간다.
  // 4지선다만으로 짜 보고, 규격 문항 수를 못 채우면 원래 풀로 되돌아간다.
  // 형식을 맞추려다 시험지가 짧아지면 그게 더 큰 어긋남이다.
  const fourChoice = (found.questions || []).filter(q => (q.choices || []).length === 4)
  if (fourChoice.length >= count) {
    const only4 = buildBlueprintFrom({ ...found, questions: fourChoice }, areaName, paperNo, count, seed)
    if (only4.length === count) return only4
  }
  return buildBlueprintFrom(found, areaName, paperNo, count, seed)
}

/** 세트 문항이 흩어지지 않게 모으고 순서를 맞춘다.
 *
 * 세트는 자료 하나로 이어 푸는 형식이라 중간에 다른 문항이 끼면 "첫 번째
 * 문항부터 순차적으로" 라는 전제가 깨진다. 처음 등장한 자리에 세트 전체를
 * 순서대로 붙여 둔다. */
function groupSets(paper) {
  const out = []
  const done = new Set()
  for (const q of paper) {
    if (!q?.setId) { out.push(q); continue }
    if (done.has(q.setId)) continue
    done.add(q.setId)
    const members = paper.filter(x => x.setId === q.setId)
      .sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0))
    // 세트가 통째로 뽑히지 않고 일부만 들어오는 경우가 있다. 그때 "세트 2/3"
    // 이라고 띄우면 있지도 않은 앞 문항을 찾게 만든다. 자료는 문항마다 붙어
    // 있어 혼자서도 풀 수 있으므로, 온전하지 않은 세트는 낱개 문항으로 낸다.
    const whole = members.length === (q.setTotal ?? members.length)
    out.push(...members.map(m => (whole ? m : { ...m, setId: null, setOrder: null, setTotal: null })))
  }
  return out
}

function buildBlueprintFrom(area, areaName, paperNo, count, seed) {

  if (areaName === '의사소통 국어' || areaName === '의사소통 영어') {
    const mediaTarget = Math.round(count * 0.3)
    const media = rotatedPick(area.questions.filter(q => q.mediaType === 'audio'), mediaTarget, paperNo, `${seed}|audio`)
    // 듣기 몫을 뺀 나머지 안에서 종합·추론을 먼저 확보한다.
    const nonAudio = area.questions.filter(q => q.mediaType !== 'audio')
    const remain = count - media.length
    const synTarget = Math.min(Math.round(count * SYNTHESIS_SHARE),
                               nonAudio.filter(q => q.demandLevel === '종합').length)
    const syn = rotatedPick(nonAudio.filter(q => q.demandLevel === '종합'), synTarget, paperNo, `${seed}|syn`)
    const paper = [
      ...media,
      ...syn,
      ...rotatedPick(nonAudio.filter(q => q.demandLevel !== '종합'), remain - syn.length, paperNo, `${seed}|non-audio`),
    ]
    return groupSets(seededOrder(paper, `${seed}|order|${paperNo}`))
  }

  if (areaName === '수리활용') {
    const visualTarget = Math.min(count >= 50 ? 8 : 5, mathVisualQuestions.length)
    const visuals = rotatedPick(area.questions.filter(q => q.mediaType === 'visual'), visualTarget, paperNo, `${seed}|visual`)
    const usedIds = new Set(visuals.map(q => q.id))
    const rest = area.questions.filter(q => !usedIds.has(q.id))
    const synTarget = Math.max(0, Math.round(count * SYNTHESIS_SHARE)
      - visuals.filter(q => q.demandLevel === '종합').length)
    const syn = rotatedPick(rest.filter(q => q.demandLevel === '종합'),
      Math.min(synTarget, rest.filter(q => q.demandLevel === '종합').length), paperNo, `${seed}|syn`)
    const synIds = new Set(syn.map(q => q.id))
    const paper = [
      ...visuals,
      ...syn,
      ...rotatedPick(rest.filter(q => !synIds.has(q.id)), count - visuals.length - syn.length, paperNo, `${seed}|non-visual`),
    ]
    return groupSets(seededOrder(paper, `${seed}|order|${paperNo}`))
  }

  if (areaName === '문제해결') {
    const paper = problemBlueprintPick(area.questions, count, paperNo, seed)
    return groupSets(seededOrder(paper, `${seed}|order|${paperNo}`))
  }

  const withSyn = withSynthesis(area.questions, count, paperNo, seed)
  if (withSyn) return seededOrder(withSyn, `${seed}|order|${paperNo}`)
  return rotatedPick(area.questions, count, paperNo, seed)
}

export function buildJcAreaPaper(areaName, paperNo = 1) {
  const count = JC_OFFICIAL_SPECS[areaName]?.count || 0
  return buildBlueprintPaper(areaName, paperNo, count, 'certification')
}

export function buildJcCognitivePaper(paperNo = 1) {
  return JC_AREAS_ORDER
    .filter(name => name !== '직무적응')
    .flatMap(name => buildJcAreaPaper(name, paperNo))
}

export function buildJcSelfDiagnosisAreaPaper(areaName, paperNo = 1) {
  const spec = JC_SELF_DIAG_SPECS[areaName]
  if (!spec || spec.assessmentType === 'likert') return []
  return buildBlueprintPaper(areaName, paperNo, spec.count, 'self-diagnosis')
}

// 영역별 모의평가용: 공식 문항 수·시간과 실제 출제 풀을 함께 반환한다.
export function buildJcMockAreas() {
  const byOfficial = {}
  for (const name of JC_AREAS_ORDER) byOfficial[name] = { id: name, displayName: name, questions: [] }
  for (const q of jobQuestionsRaw) {
    if (q.excludeFromQuiz) continue
    const official = jcOfficialArea(q)
    if (official) byOfficial[official].questions.push(annotateBlueprint(q, official))
  }
  for (const q of englishStudyQuestions) {
    byOfficial['의사소통 영어'].questions.push(annotateBlueprint(q, '의사소통 영어'))
  }
  for (const q of jobCommonMediaQuestions) {
    byOfficial[q.officialArea].questions.push(annotateBlueprint(q, q.officialArea))
  }
  for (const q of SYNTHESIS_QUESTIONS) {
    const official = q.officialArea
    if (byOfficial[official]) byOfficial[official].questions.push(annotateBlueprint(q, official))
  }
  for (const q of ENGLISH_SUPPLEMENT) {
    byOfficial['의사소통 영어'].questions.push(annotateBlueprint(q, '의사소통 영어'))
  }
  // 새로 만든 공식 유형(풀다운·세트)도 출제 풀에 넣는다. 학습에만 넣어 두면
  // 정작 진단·모의에서는 한 번도 만나지 못한 채 시험장에 가게 된다.
  for (const q of [...JC_PULLDOWN_QUESTIONS, ...JC_SET_QUESTIONS, ...JC_BLUEPRINT_FILL]) {
    const official = jcOfficialArea(q)
    if (official && byOfficial[official]) {
      byOfficial[official].questions.push(annotateBlueprint(q, official))
    }
  }
  // 출제 풀에서 내용이 같은 문항을 미리 걸러 둔다. 시험지를 만든 뒤에 걸러내면
  // 그만큼 문항 수가 모자라진다(50문항 시험지가 48~49문항이 됐다).
  for (const name of JC_AREAS_ORDER) {
    byOfficial[name].questions = jcAssessmentQuestions(dedupeByContent(byOfficial[name].questions))
  }
  return JC_AREAS_ORDER
    .map(name => {
      const spec = JC_OFFICIAL_SPECS[name]
      const area = byOfficial[name]
      return {
        ...area,
        ...spec,
        poolCount: spec.assessmentType === 'likert' ? spec.count : area.questions.length,
        areaIds: [name],
        questionIds: area.questions.map(q => q.id),
      }
    })
    .filter(a => a.assessmentType === 'likert' || a.questions.length > 0)
}

// 미션 생성용(MissionCreateScreen): 5영역 + 각 영역의 소단원(lessons) 체크박스.
// lesson.id 는 실제 questions.json lessonId(또는 ENG-*)라 `${id}-Q*` 패턴이 MissionScreen에서 해석됨.
export function buildJcMissionAreas() {
  const pool = jcStudyQuestions()
  return buildJcOfficialAreas().map(area => {
    const lessons = area.lessons
      .filter(lesson => lesson.kind !== 'self-report')
      .map(lesson => {
        const questionIds = pool
          .filter(q => q.officialArea === area.id && jcLessonMatches(q, lesson.id))
          .map(q => q.id)
        return {
          id: lesson.id,
          title: lesson.label,
          questionCount: questionIds.length,
          questionIds,
        }
      })
      .filter(lesson => lesson.questionCount > 0)
    return {
      id: area.id,
      displayName: area.label,
      totalQuestions: lessons.reduce((sum, lesson) => sum + lesson.questionCount, 0),
      lessons,
    }
  }).filter(area => area.totalQuestions > 0)
}

export { jobCommonMediaQuestions }
