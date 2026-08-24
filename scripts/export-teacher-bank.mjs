// 교사 자료(수업 덱·허브)가 읽는 문항 은행을 앱과 같은 산출물로 내보낸다.
//
// 앱의 문항은 JSON 원본 그대로가 아니다. ncs2026.js 가 보강 문항을 합치고,
// 표준을 붙이고, 같은 내용을 걸러 낸 **런타임 산출물**이 학생이 푸는 문항이다.
// 교사 덱을 원본 JSON에서 만들면 앱과 교재의 문항이 어긋난다.
//
// 앞서 이 내보내기를 그때그때 손으로 돌렸더니, 문항 데이터를 고친 뒤 교사
// 자료를 다시 만들어야 한다는 사실이 기록으로 남지 않았다. 스크립트로 둔다.
//
// 실행: node scripts/export-teacher-bank.mjs
//   (import.meta.env 가 필요하므로 esbuild 로 묶어서 돌린다 — package.json 참고)

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { ncs2026Questions, buildNcs2026Areas } from '../src/lib/ncs2026.js'

const OUT = 'D:/apps/sugar-salt-build/_data'

// 교사 자료에 필요한 필드만. 학생 화면 전용 상태값은 빼고 내보낸다.
const FIELDS = ['id', 'area', 'level', 'demandLevel', 'type',
  'context', 'stem', 'visual', 'choices', 'answer', 'explanation',
  'lessonId', 'lessonTitle']

// 앱 안에서는 하위능력·요소를 ncsAbility/ncsElement 로 부른다. 교사 자료는
// ability/element 로 읽으므로 여기서 이름을 맞춰 준다. 예전에 손으로 내보낼
// 때 함께 해 주던 일이라 스크립트에 옮겨 적지 않으면 덱 생성이 통째로 깨진다.
const bank = ncs2026Questions
  .filter(q => !q.excludeFromQuiz)
  .map(q => ({
    ...Object.fromEntries(FIELDS.filter(f => q[f] !== undefined).map(f => [f, q[f]])),
    ability: q.ncsAbility ?? null,
    element: q.ncsElement ?? null,
  }))

const noAbility = bank.filter(q => !q.ability).length
if (noAbility) {
  // 하위능력이 없으면 어느 차시 덱에도 들어가지 못한다. 조용히 빠지면
  // 교사는 문항이 사라진 줄도 모른다.
  console.warn(`  ⚠️ 하위능력이 비어 덱에 담기지 못하는 문항 ${noAbility}개`)
}

const areas = buildNcs2026Areas()

mkdirSync(dirname(`${OUT}/x`), { recursive: true })
writeFileSync(`${OUT}/ncs26-bank.json`, JSON.stringify(bank, null, 1) + '\n')
// make_ncs_decks.py 는 {"areas": [...]} 꼴을 읽는다. 배열만 쓰면 그쪽이 깨진다.
writeFileSync(`${OUT}/ncs26-areas.json`, JSON.stringify({ areas }, null, 1) + '\n')

const withVisual = bank.filter(q => q.visual).length
console.log(`[교사은행] ${bank.length}문항 내보냄 (표·그래프 ${withVisual}개) → ${OUT}`)
console.log(`           영역 ${areas.length}개`)
