// 능력 문항과 상식 문항은 파일이 나뉘어 있다(903 §4-⑥). 이 파일은
// 둘을 다 쓰므로 합친 것을 받는다.
import { allNcsSourceQuestions as rawNcsQuestions } from './ncsBanks.js'
import jobVariantsFile from '../../data/job-variants.json'
import recruitStudySupplement from '../../data/recruit-written-study-supplement.json'
import { questionLane } from './assessmentPartition.js'
import { applyQuestionIntegrityToPool } from './questionIntegrity.js'
import {
  RECRUITMENT_EXTRA_AREA_IDS,
  recruitmentTrackIds,
  recruitResidualKind,
} from './recruitWrittenPolicy.js'

const EXTRA_AREA_SET = new Set(RECRUITMENT_EXTRA_AREA_IDS)
export { RECRUITMENT_EXTRA_AREA_IDS } from './recruitWrittenPolicy.js'

export const RECRUIT_WRITTEN_TRACKS = [
  {
    id: 'public',
    label: '공공기관형',
    icon: '🏛️',
    color: '#1D4ED8',
    bg: '#EFF6FF',
    sourceAreas: ['자원관리', '조직이해', '기술능력', '대인관계'],
    summary: '현행 NCS와 겹치지 않는 공공기관 채용 잔여역량을 대비합니다.',
    notice: '전공기초·한국사·법·기관상식은 기관과 직렬마다 범위가 다르므로 지원 공고를 기준으로 별도 준비해야 합니다.',
  },
  {
    id: 'finance',
    label: '금융권형',
    icon: '🏦',
    color: '#047857',
    bg: '#ECFDF5',
    sourceAreas: ['금융상식', '경제상식', '경영상식', '일반상식', '자원관리', '대인관계'],
    summary: '금융·경제·경영·시사와 금융권에 필요한 잔여역량을 함께 연습합니다.',
    notice: '시사는 출제 시점에 따라 달라집니다. 앱의 일반상식은 경제 이슈 중심의 기초 문항이며 최신 시사는 지원 공고와 최근 자료로 보완해야 합니다.',
  },
  {
    id: 'enterprise',
    label: '대기업형',
    icon: '🏢',
    color: '#B45309',
    bg: '#FFFBEB',
    sourceAreas: ['인적성', '기술능력', '대인관계'],
    summary: '직무적성과 기술직·고객서비스 직군의 잔여역량을 함께 연습합니다.',
    notice: '성향을 확인하는 인성검사는 정답이 없는 별도 교재입니다. 교재 목록의 ‘인성검사’에서 따로 체험하세요.',
  },
]

const TRACK_BY_ID = Object.fromEntries(RECRUIT_WRITTEN_TRACKS.map(track => [track.id, track]))

const CURATED_LESSON_GROUPS = {
  금융상식: [
    {
      label: '금융시장·금융기관·예금보호',
      lessonIds: ['C161', 'C162', 'C163', 'C164', 'C173', 'C213'],
      questionIds: ['039', '040', '041', '045', '050'],
    },
    {
      label: '예금·신용·대출·은행업무',
      lessonIds: ['C165', 'C174', 'C175', 'C176'],
      questionIds: ['043', '046', '047', '048', '051', '052', '053'],
    },
    {
      label: '주식·채권·펀드와 투자위험',
      lessonIds: ['C166', 'C167', 'C168', 'C216'],
      questionIds: ['042', '044', '049'],
    },
    {
      label: '환율·외환시장·국제수지',
      lessonIds: ['C169', 'C170', 'C171', 'C172'],
      questionIds: [],
    },
  ],
  경제상식: [
    {
      label: '수요·공급·시장균형과 탄력성',
      lessonIds: ['C177', 'C178', 'C179', 'C180'],
      questionIds: ['029', '031', '034', '037', '040', '041'],
    },
    {
      label: 'GDP·물가·고용과 경기지표',
      lessonIds: ['C181', 'C182', 'C183'],
      questionIds: ['030', '033', '039', '042'],
    },
    {
      label: '재정·통화·환율과 시장실패',
      lessonIds: ['C186'],
      questionIds: ['032', '035', '036', '038', '043'],
    },
  ],
  경영상식: [
    {
      label: '마케팅·소비자·경쟁전략',
      lessonIds: ['C193', 'C196'],
      questionIds: ['014', '019', '020', '022', '023', '027', '028', '030', '033', '034', '035', '039', '041', '045', '047', '049', '052', '053'],
    },
    {
      label: '조직·인사·리더십·성과관리',
      lessonIds: ['C195'],
      questionIds: ['015', '017', '018', '024', '026', '029', '031', '036', '043', '044', '046', '051'],
    },
    {
      label: '회계·재무·원가와 의사결정',
      lessonIds: [],
      questionIds: ['016', '021', '037', '048', '050'],
    },
    {
      label: '생산·SCM·품질·경영정보',
      lessonIds: [],
      questionIds: ['025', '032', '038', '040', '042'],
    },
  ],
  일반상식: [
    {
      label: '경제·통계·자료해석',
      lessonIds: ['C197', 'C198', 'C199', 'C200'],
      questionIds: ['015', '016', '022', '024', '025', '028', '031', '033', '035'],
    },
    {
      label: '헌법·노동법·사회보험·개인정보',
      lessonIds: [],
      questionIds: ['017', '018', '019', '020', '021', '023', '029', '032', '034'],
    },
    {
      label: '직장·ESG·사회·국제상식',
      lessonIds: [],
      questionIds: ['026', '027', '030', '036'],
    },
  ],
  인적성: [
    {
      label: '언어이해·독해·비판적 사고',
      lessonIds: ['C201', 'C202', 'C203', 'C204'],
      questionIds: ['041', '044', '049', '051', '053', '055'],
    },
    {
      label: '명제·조건·관계·논리추론',
      lessonIds: ['C209', 'C210', 'C211', 'C212'],
      questionIds: ['045', '046', '048', '052', '054'],
    },
    {
      label: '수리·자료해석·수열·규칙',
      lessonIds: ['C205', 'C206', 'C207', 'C208'],
      questionIds: ['042', '043', '047', '050'],
    },
  ],
}

function cloneForRecruitment(q, trackId) {
  return {
    ...q,
    id: `RW-${trackId}-${q.id}`,
    sourceQuestionId: q.id,
    recruitmentTrack: trackId,
    recruitmentTrackLabel: TRACK_BY_ID[trackId].label,
    recruitmentResidualKind: recruitResidualKind(q),
  }
}

const JOB_VARIANTS = jobVariantsFile?.variants || {}

function cloneRecruitmentSet(question, trackId) {
  const base = cloneForRecruitment(question, trackId)
  const variants = (JOB_VARIANTS[question.id] || []).slice(0, 2)
  if (!variants.length) return [base]
  const baseLane = questionLane(base)
  return [
    base,
    ...variants.map((variant, index) => ({
      ...base,
      ...variant,
      id: `${base.id}-${index === 0 ? 'LEARN' : 'ASSESS'}-V${index + 1}`,
      sourceQuestionId: question.id,
      learningLane: variants.length === 1
        ? (baseLane === 'study' ? 'assessment' : 'study')
        : (index === 0 ? 'study' : 'assessment'),
      answerSource: 'validated-recruitment-variant',
    })),
  ]
}

// 원본 NCS 문항과 ID가 겹치지 않는 독립 교재 풀이다.
export const recruitWrittenQuestions = applyQuestionIntegrityToPool(rawNcsQuestions.flatMap(q =>
  recruitmentTrackIds(q).flatMap(trackId => cloneRecruitmentSet(q, trackId))
).concat((recruitStudySupplement.questions || []).flatMap(question =>
  (question.recruitmentTracks || []).map(trackId => cloneForRecruitment({
    ...question,
    learningLane: 'study',
    answerSource: 'authored-standards-supplement',
  }, trackId))
)))

export const ncsLegacySourceQuestions = rawNcsQuestions.filter(q => recruitResidualKind(q))
export const recruitmentExtraSourceQuestions = rawNcsQuestions.filter(q => EXTRA_AREA_SET.has(q.area))

export function getRecruitTrack(trackId) {
  return TRACK_BY_ID[trackId] ?? null
}

export function getRecruitTrackQuestions(trackId, questions = recruitWrittenQuestions) {
  return questions.filter(q => q.recruitmentTrack === trackId)
}

export function recruitAreaId(area) {
  return {
    '자원관리능력': '자원관리',
    '조직이해능력': '조직이해',
    '대인관계능력': '대인관계',
  }[area] || area
}

export function recruitAreaLabel(area) {
  area = recruitAreaId(area)
  if (area === '인적성') return '직무적성'
  if (area === '일반상식') return '시사·일반상식'
  if (area === '자원관리') return '자원배분·관리'
  if (area === '조직이해') return '조직·경영 이해'
  if (area === '기술능력') return '기술직 기초'
  if (area === '대인관계') return '고객서비스·협상'
  return area
}

export function recruitLessonTitle(q) {
  const groups = CURATED_LESSON_GROUPS[q.area]
  if (!groups) return q.lessonTitle ?? q.lessonId ?? q.area

  const supplementNo = String(q.id || '').match(/-(\d{3})$/)?.[1] ?? null
  const group = groups.find(item =>
    item.lessonIds.includes(q.lessonId) ||
    (q.lessonId?.endsWith('NEW') && supplementNo && item.questionIds.includes(supplementNo))
  )
  return group?.label ?? `${recruitAreaLabel(q.area)} 종합 실전`
}

export function buildRecruitWrittenAreas(trackId, questions = recruitWrittenQuestions) {
  const track = getRecruitTrack(trackId)
  if (!track) return []

  return track.sourceAreas.map(area => {
    const areaQuestions = questions.filter(q =>
      !q.excludeFromQuiz &&
      q.recruitmentTrack === trackId &&
      recruitAreaId(q.area) === area
    )
    const lessons = []
    for (const q of areaQuestions) {
      // 일부 구문항은 문항마다 lessonId만 다르고 같은 포괄 제목을 반복한다.
      // 사용자에게는 내부 ID가 아니라 의미 단원 제목으로 한 번만 묶어 보여준다.
      const id = recruitLessonTitle(q)
      if (!lessons.some(lesson => lesson.id === id)) {
        lessons.push({ id, label: id })
      }
    }
    return {
      id: area,
      label: recruitAreaLabel(area),
      displayName: recruitAreaLabel(area),
      qCount: areaQuestions.length,
      totalQuestions: areaQuestions.length,
      lessons,
    }
  }).filter(area => area.qCount > 0)
}
