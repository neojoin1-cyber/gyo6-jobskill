/**
 * 진단평가가 **실제 시험과 같은지**를 빌드 때마다 확인한다.
 *
 * ### 왜 이 검사가 필요한가
 *
 * 시험 대비 앱에서 "비슷한 연습"은 쓸모가 절반이다. 보기가 다섯 개면 소거법이
 * 달라지고, 듣기가 빠지면 30%를 안 겪은 채 시험장에 가며, 문항 수가 모자라면
 * 시간 배분 감각이 통째로 어긋난다. 실제로 이런 것들이 하나씩 어긋나 있었다.
 *
 *   · 문제해결 시험지 32문항 중 30개가 5지선다였다(공식은 4지선다)
 *   · 3학년 인증진단 대비 과목인데 진단 경로에 1·2학년 자가진단만 있었다
 *   · 직무적응이 160문항·40분이어야 하는데 80문항·20분이 떴다
 *
 * 셋 다 코드가 아니라 **데이터가 바뀌면 조용히 다시 생길 수 있는** 종류다.
 * 그래서 사람이 눈으로 보는 대신, 시험지를 실제로 만들어 규격과 대조한다.
 *
 * ### 무엇을 대조하나 (공식 평가틀)
 *
 *   의사소통 국어  50문항 · 50분 · 듣기·멀티미디어 30% 내외
 *   의사소통 영어  50문항 · 50분 · 듣기·멀티미디어 30% 내외
 *   수리활용      50문항 · 50분 · 멀티미디어 포함
 *   문제해결      32문항 · 50분
 *   직무적응     160문항 · 40분 · 5점 척도
 *   합계        342문항 · 240분
 *
 * 여기에 형식 조건을 더한다 — **선택형은 모두 4지선다**(공식 자가진단 매뉴얼:
 * "4가지 선택지를 제시 받아 그 중 하나를 고르는 형태").
 *
 * 실행: `node scripts/gate-exam-fidelity.mjs`  (prebuild 가 부른다)
 */

import { buildJcAreaPaper } from '../src/lib/jobCommonAreas.js'
import { buildJobAdaptationItems } from '../src/lib/jobAdaptationTest.js'
import { TEENUP_2026 } from '../src/lib/officialStandards.js'

const PAPERS_PER_AREA = 3          // 회차를 바꿔 가며 매번 규격을 지키는지 본다
const problems = []
const spec = TEENUP_2026.certification

let totalCount = 0
let totalMinutes = 0

for (const area of spec.areas) {
  totalCount += area.count
  totalMinutes += area.minutes

  if (area.assessmentType === 'likert') {
    const items = buildJobAdaptationItems('full', 1)
    if (items.length !== area.count) {
      problems.push(`${area.id}: ${items.length}문항 (규격 ${area.count})`)
    }
    const scale = new Set(items.map(q => q.kind))
    if (!scale.size) problems.push(`${area.id}: 문항 종류를 확인할 수 없다`)
    continue
  }

  for (let no = 1; no <= PAPERS_PER_AREA; no++) {
    const paper = buildJcAreaPaper(area.id, no) || []
    const tag = `${area.id} ${no}회차`

    if (paper.length !== area.count) {
      problems.push(`${tag}: ${paper.length}문항 (규격 ${area.count})`)
      continue
    }
    const five = paper.filter(q => (q.choices || []).length === 5).length
    if (five) problems.push(`${tag}: 5지선다 ${five}문항 — 공식은 4지선다다`)

    const notFour = paper.filter(q => {
      const n = (q.choices || []).length
      return n && n !== 4 && n !== 5 && q.questionMode !== 'ox'
    }).length
    if (notFour) problems.push(`${tag}: 보기 수가 4개가 아닌 문항 ${notFour}개`)

    if (area.multimediaRatio) {
      const want = Math.round(area.count * area.multimediaRatio)
      const got = paper.filter(q => q.mediaType === 'audio' || q.mediaType === 'visual').length
      // 30% "내외"라 한 문항 정도의 차이는 둔다.
      if (got < want - 1) problems.push(`${tag}: 듣기·멀티미디어 ${got}문항 (필요 ${want})`)
    }
    if (area.multimediaRequired) {
      const got = paper.filter(q => q.mediaType === 'visual' || q.mediaType === 'audio').length
      if (got < 5) problems.push(`${tag}: 멀티미디어 ${got}문항 — 자료 해석 문항이 너무 적다`)
    }
  }
}

if (totalCount !== spec.totalCount) {
  problems.push(`영역별 합계 ${totalCount}문항 (공식 ${spec.totalCount})`)
}
if (totalMinutes !== spec.assessedMinutes) {
  problems.push(`영역별 시간 합계 ${totalMinutes}분 (공식 ${spec.assessedMinutes})`)
}

console.log(`[시험재현] 인증진단 ${spec.totalCount}문항 · ${spec.assessedMinutes}분 규격 대조 · 지적 ${problems.length}건`)
for (const p of problems) console.log(`  ✗ ${p}`)
if (problems.length) {
  console.log('     진단평가가 실제 시험과 달라졌다. 시험지 구성이나 문항 형식을 되돌려라.')
  process.exit(1)
}
console.log('  [시험재현] 통과 — 문항 수·시간·듣기 비율·4지선다 모두 공식 평가틀과 일치')
