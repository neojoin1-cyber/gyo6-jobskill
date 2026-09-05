import { createServer } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const failures = []
const checks = []

function check(condition, message, detail = '') {
  checks.push({ ok: Boolean(condition), message, detail })
  if (!condition) failures.push(`${message}${detail ? `: ${detail}` : ''}`)
}

function countBy(items, keyOf) {
  const result = {}
  for (const item of items) {
    const key = keyOf(item)
    result[key] = (result[key] || 0) + 1
  }
  return result
}

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
})

try {
  const standards = await vite.ssrLoadModule('/src/lib/officialStandards.js')
  const ncs = await vite.ssrLoadModule('/src/lib/ncs2026.js')
  const jc = await vite.ssrLoadModule('/src/lib/jobCommonAreas.js')
  const mock = await vite.ssrLoadModule('/src/lib/mockData.js')

  check(standards.STANDARD_AUTHORITIES.teenup2026.productTitle === '교육부 직업공통능력 인증', '교육부 인증 과목명에 주관기관 명시')
  check(standards.STANDARD_AUTHORITIES.ncs2026.productTitle === 'NCS 직업기초능력 26v1', 'NCS 과목명에 기관 체계·버전 명시')
  check(standards.COMMON_ABILITY_COURSES['job-common'].standardId !== standards.COMMON_ABILITY_COURSES['ncs-basic'].standardId, '두 직업공통능력 과목의 기준 ID 분리')

  check(standards.NCS_2026_AREAS.length === 7, 'NCS 현행 영역은 7개여야 함')
  check(standards.NCS_2026.abilityIds.length === 21, 'NCS 현행 능력은 21개여야 함')
  check(new Set(standards.NCS_2026.abilityIds).size === 21, 'NCS 21개 능력 식별자는 중복되면 안 됨')

  const coverage = ncs.ncs2026Coverage()
  for (const area of coverage) {
    for (const ability of area.abilities) {
      check(ability.count > 0, `NCS 능력 문항 커버리지: ${area.area} > ${ability.ability}`, `${ability.count}문항`)
      for (const element of ability.elements) {
        check(element.count >= 2, `NCS 공식 요소 최소 2문항: ${area.area} > ${ability.ability} > ${element.element}`, `${element.count}문항`)
      }
    }
  }
  const currentAreas = new Set(ncs.ncs2026Questions.map(question => question.area))
  for (const extra of ['금융상식', '경제상식', '경영상식', '일반상식', '인적성']) {
    check(!currentAreas.has(extra), `현행 NCS 평가에서 공채 부가영역 제외: ${extra}`)
  }

  for (let paperNo = 1; paperNo <= 3; paperNo++) {
    for (const [areaName, spec] of Object.entries(jc.JC_OFFICIAL_SPECS)) {
      if (spec.assessmentType === 'likert') continue
      const paper = jc.buildJcAreaPaper(areaName, paperNo)
      check(paper.length === spec.count, `3학년 ${paperNo}회 ${areaName} 문항 수`, `${paper.length}/${spec.count}`)
      check(new Set(paper.map(question => question.id)).size === paper.length, `3학년 ${paperNo}회 ${areaName} 문항 ID 중복 없음`)
      if (areaName === '의사소통 국어' || areaName === '의사소통 영어') {
        const audioCount = paper.filter(question => question.mediaType === 'audio').length
        check(audioCount === Math.round(spec.count * 0.3), `3학년 ${paperNo}회 ${areaName} 듣기 30%`, `${audioCount}문항`)
      }
      if (areaName === '수리활용') {
        check(paper.filter(question => question.mediaType === 'visual').length >= 5, `3학년 ${paperNo}회 수리 시각자료 포함`)
      }
      if (areaName === '문제해결') {
        const ideas = new Set(paper.map(question => question.teenupBlueprint?.contentDomain))
        const processes = new Set(paper.map(question => question.teenupBlueprint?.process))
        check(standards.TEENUP_2026.problemSolving.bigIdeas.every(item => ideas.has(item)), `3학년 ${paperNo}회 문제해결 4대 내용축`)
        check(standards.TEENUP_2026.problemSolving.processes.every(item => processes.has(item)), `3학년 ${paperNo}회 문제해결 4개 과정`)
        check(paper.every(question => question.teenupBlueprint?.classificationBasis), `3학년 ${paperNo}회 문제해결 내용 기반 분류 근거`)
        check(paper.every(question => !question.teenupBlueprint?.classificationBasis?.includes('hash')), `3학년 ${paperNo}회 문제해결 ID 해시 분류 금지`)
      }
    }
  }

  for (const [areaName, spec] of Object.entries(jc.JC_SELF_DIAG_SPECS)) {
    if (spec.assessmentType === 'likert') continue
    const paper = jc.buildJcSelfDiagnosisAreaPaper(areaName, 1)
    check(paper.length === spec.count, `1·2학년 ${areaName} 자가진단 문항 수`, `${paper.length}/${spec.count}`)
    if (areaName === '의사소통 국어' || areaName === '의사소통 영어') {
      check(
        paper.filter(question => question.mediaType === 'audio').length === Math.round(spec.count * 0.3),
        `1·2학년 ${areaName} 듣기 30%`,
      )
    }
  }

  for (const subjectId of ['job-common', 'ncs-basic']) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const paper = mock.buildDiagnosticPaper(subjectId, attempt, 40)
      check(paper.length === 40, `${subjectId} 빠른 진단 ${attempt + 1}회 40문항 보장`, `${paper.length}/40`)
      check(new Set(paper.map(question => question.id)).size === 40, `${subjectId} 빠른 진단 ${attempt + 1}회 중복 없음`)
    }
  }

  const allAudited = [...ncs.ncs2026Questions, ...jc.jobCommonMediaQuestions]
  const duplicateIds = Object.entries(countBy(allAudited, question => question.id)).filter(([, count]) => count > 1)
  check(duplicateIds.length === 0, '신규 공식 정렬 문항 ID 중복 없음', duplicateIds.map(([id]) => id).join(', '))
  for (const question of allAudited) {
    if (!Array.isArray(question.choices) || question.choices.length < 2) continue
    const answerIndex = String(question.answer || '').charCodeAt(0) - 65
    check(answerIndex >= 0 && answerIndex < question.choices.length, `정답 인덱스 유효: ${question.id}`, String(question.answer))
  }

  check(ncs.ncs2026Questions.every(question => question.classificationBasis), 'NCS 26v1 전 문항 분류 근거 존재')
  check(ncs.ncs2026Questions.every(question => !question.classificationBasis.includes('hash')), 'NCS 하위능력요소 ID 해시 분류 금지')
  check(ncs.ncs2026Questions.every(question => !question.classificationBasis.includes('ability-definition-default')), 'NCS 근거 없는 첫 요소 강제 배정 금지')

  const repoRoot = process.cwd()
  const textbookLoader = fs.readFileSync(path.join(repoRoot, 'src/lib/textbooks.js'), 'utf8')
  const textbookReader = fs.readFileSync(path.join(repoRoot, 'src/screens/student/TextbookReader.jsx'), 'utf8')
  const courseList = fs.readFileSync(path.join(repoRoot, 'src/screens/student/CourseListScreen.jsx'), 'utf8')
  const wrongAnswerScreen = fs.readFileSync(path.join(repoRoot, 'src/screens/student/WrongAnswerScreen.jsx'), 'utf8')
  const classProgressScreen = fs.readFileSync(path.join(repoRoot, 'src/screens/teacher/ClassProgressScreen.jsx'), 'utf8')
  const mockScreen = fs.readFileSync(path.join(repoRoot, 'src/screens/student/MockAssessmentScreen.jsx'), 'utf8')
  check(!textbookLoader.includes("import('../../data/textbook-job-common.json')"), '구형 9영역 job-common 완전교재 번들 금지')
  check(!textbookReader.includes("import('../../../data/block-inline-job-common.json')"), '구형 job-common 인라인 교재 번들 금지')
  check(courseList.includes("COMMON_ABILITY_COURSES['job-common']") && courseList.includes("COMMON_ABILITY_COURSES['ncs-basic']"), '학생 과목명 중앙 기준 원장 사용')
  check(wrongAnswerScreen.includes("COMMON_ABILITY_COURSES['job-common']") && wrongAnswerScreen.includes("COMMON_ABILITY_COURSES['ncs-basic']"), '오답노트 과목명 중앙 기준 원장 사용')
  check(classProgressScreen.includes("COMMON_ABILITY_COURSES['job-common']") && classProgressScreen.includes("COMMON_ABILITY_COURSES['ncs-basic']"), '교사 진도 과목명 중앙 기준 원장 사용')
  check(mockScreen.includes('인증진단 실전 다음 회차 시작') && mockScreen.includes("scopeKey: '__full__'") && mockScreen.includes('buildJcAreaPaper(area.id, paperNo)'), '교육부 인증 실전은 공식 규모를 유지하며 문제은행을 회차별 순환')
} finally {
  await vite.close()
}

const verbose = process.env.AUDIT_VERBOSE === '1'
for (const item of checks) {
  if (verbose || !item.ok) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.message}${item.detail ? ` (${item.detail})` : ''}`)
}

console.log(`\nOfficial alignment audit: ${checks.length - failures.length}/${checks.length} passed`)
if (failures.length) {
  console.error(failures.map(item => `- ${item}`).join('\n'))
  process.exit(1)
}
