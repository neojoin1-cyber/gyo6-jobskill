import { evaluateOfficialItemRights, isOfficialItemCandidate } from './officialContentRights.js'
import { contextualLearningFocus } from './contextualDeepening.js'

const COURSE_CASES = {
  'education-certification': {
    label: '공개 평가틀 연계 연습',
    detail: '교육부·대한상공회의소의 직업기초능력 평가 체계에 맞춘 앱 연습 사례입니다.',
    caution: '공식 공개 기출문항 원문이 아니라, 같은 판단 기준을 익히기 위한 연습 문항입니다.',
  },
  ncs: {
    label: 'NCS 능력단위 연계 연습',
    detail: '고용노동부·한국산업인력공단 NCS 능력단위와 직업기초능력 기준에 연결한 앱 연습 사례입니다.',
    caution: '실제 채용시험의 과목·범위·형식은 지원 기관의 최신 공고에서 다시 확인해야 합니다.',
  },
  recruitment: {
    label: '채용 필기형 연습 사례',
    detail: '공공기관·금융권·대기업 고졸 채용에서 확인할 수 있는 추가 평가영역을 연습용으로 재구성했습니다.',
    caution: '특정 기관의 실제 기출문항으로 단정하지 않으며, 최신 채용공고의 과목과 시간을 우선합니다.',
  },
  interview: {
    label: '공정채용 면접형 사례',
    detail: '고졸 공정채용 면접의 질문 의도와 후속 질문 방식에 맞춘 답변 연습 사례입니다.',
    caution: '특정 기업의 실제 질문을 그대로 옮긴 것이 아니며, 학생의 사실 경험으로 답을 완성해야 합니다.',
  },
  'cover-letter': {
    label: '고졸 공채 문항형 사례',
    detail: '고졸 채용 자기소개서에서 반복되는 문항 요구를 바탕으로 만든 작성·수정 연습 사례입니다.',
    caution: '지원 전에는 해당 기업·기관의 현재 문항과 글자 수, 직무기술서를 다시 확인해야 합니다.',
  },
  personality: {
    label: '인성검사 응답 원리 사례',
    detail: '부정문·일관성·과장 응답 등 실제 검사에서 필요한 읽기와 응답 원리를 익히는 상황 사례입니다.',
    caution: '정답이나 합격 답안을 제시하지 않으며, 평소 반복 행동을 기준으로 성찰합니다.',
  },
}

const SUBJECT_TO_COURSE = {
  'job-common': 'education-certification',
  'ncs-basic': 'ncs',
  'recruit-written': 'recruitment',
  interview: 'interview',
  'cover-letter': 'cover-letter',
  personality: 'personality',
}

export function courseKindForSubject(subject) {
  return SUBJECT_TO_COURSE[subject] || subject || ''
}

export function learningCaseProvenance(courseKind, sample = {}) {
  const source = sample?.sourceQuestion || sample || {}
  const resolvedCourse = COURSE_CASES[courseKind] ? courseKind : courseKindForSubject(courseKind)
  const base = COURSE_CASES[resolvedCourse] || {
    label: '현재 단원 적용 사례',
    detail: '현재 학습 목표를 실제 상황과 문제 형식에 적용한 앱 연습 사례입니다.',
    caution: '출처가 명시되지 않은 사례를 공식 기출문항으로 해석하지 않습니다.',
  }
  const officialItem = isOfficialItemCandidate(source)
  const rights = evaluateOfficialItemRights(source)
  const focus = contextualLearningFocus(sample)

  if (officialItem && rights.cleared) {
    return {
      kind: 'official-item',
      label: '공식 공개 문항',
      detail: source.sourceLabel || source.standardAuthority || '공식 공개 출처가 확인된 문항입니다.',
      caution: source.sourceUrl ? '원문과 시행 시점은 연결된 공식 출처에서 확인합니다.' : '원문 출처와 시행 시점을 함께 확인합니다.',
      sourceUrl: source.sourceUrl || '',
      rightsState: 'approved',
      licenseType: rights.licenseType,
      attribution: rights.attribution,
    }
  }

  if (officialItem) {
    return {
      kind: 'rights-review',
      label: '출처 권리 검토 필요',
      detail: source.sourceLabel || source.standardAuthority || '공식 출처 후보이나 앱 이용 권리가 확인되지 않았습니다.',
      caution: '상업 이용·재배포·오프라인 저장·문항 가공 권리가 모두 확인될 때까지 학습 문항으로 제공하지 않습니다.',
      sourceUrl: source.sourceUrl || '',
      rightsState: 'blocked',
      rightsReasons: rights.reasons,
    }
  }

  return {
    kind: 'aligned-practice',
    label: `${base.label} · ${[...focus.stem].slice(0, 26).join('')}${[...focus.stem].length > 26 ? '...' : ''}`,
    detail: `${base.detail} 이번 화면에서는 “${focus.stem}”을 바탕으로 ${focus.skill}입니다.`,
    caution: focus.evidence
      ? `${base.caution} 판단 뒤에는 “${focus.evidence}”를 현재 문항의 근거로 다시 확인합니다.`
      : `${base.caution} 판단 뒤에는 현재 지문·해설의 근거와 직접 대조합니다.`,
    sourceUrl: source.sourceUrl || '',
    rightsState: 'not-required',
  }
}
