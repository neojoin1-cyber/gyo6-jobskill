// 교사 미션 전달률 재현 — MissionScreen.loadQuestions 의 폴백 사슬을 그대로 옮겨
// 교사가 고른 단원·영역이 학생에게 어떤 문항으로 전달되는지 계산한다.
//
// 기준선 ee6aee89abf8
// 실행: npx esbuild verification/adversarial-4.8.13/tools/probe-mission-delivery.mjs //         --bundle --platform=node --format=esm --loader:.json=json //         --outfile=.cache/probe-mission-delivery.mjs && node .cache/probe-mission-delivery.mjs
import jobQuestions from '../../../data/questions.json'
import { buildJcMissionAreas, englishStudyQuestions, jobCommonMediaQuestions } from '../../../src/lib/jobCommonAreas.js'
const POOL=[...jobQuestions, ...englishStudyQuestions, ...jobCommonMediaQuestions]

function loadPool(qIds, areaIds){
  const all=POOL
  let pool=[]
  let route='id'
  if(qIds.length>0 && !qIds[0].endsWith('-Q*')){ const s=new Set(qIds); pool=all.filter(q=>s.has(q.id)&&!q.excludeFromQuiz) }
  if(pool.length===0 && qIds.length>0 && qIds[0].startsWith('area:')){ const s=new Set(qIds.map(x=>x.replace('area:',''))); pool=all.filter(q=>s.has(q.area)&&!q.excludeFromQuiz); route='area:' }
  if(pool.length===0 && qIds.length>0){ const pre=qIds.map(p=>p.replace(/-Q\*$/,'')); pool=all.filter(q=>pre.some(p=>q.lessonId===p||q.id.startsWith(p+'-Q'))&&!q.excludeFromQuiz); route='prefix' }
  if(pool.length===0 && areaIds?.length>0){ pool=all.filter(q=>areaIds.some(a=>q.area===a||q.lessonId?.startsWith(a.replace('a','C'))||q.id.startsWith(a))&&!q.excludeFromQuiz); route='area_ids' }
  if(pool.length===0){ pool=all.filter(q=>!q.excludeFromQuiz); route='전체폴백' }
  return {pool, route}
}

const areas=buildJcMissionAreas()
console.log('=== 단원 1개만 선택했을 때 (교사가 가장 흔히 하는 조작) ===')
const bad=[]
for(const a of areas) for(const l of a.lessons){
  const qIds=[...new Set(l.questionIds)]
  const {pool,route}=loadPool(qIds, [l.id])           // 영역 미선택 → areaIds = selectedLessons
  const asked=new Set(qIds)
  const delivered=pool.filter(q=>asked.has(q.id)).length
  const foreign=pool.length-delivered
  if(route!=='id'||foreign>0) bad.push({area:a.displayName,lesson:l.title,qIds:qIds.length,route,poolSize:pool.length,delivered,foreign})
}
console.log('문제 있는 단원', bad.length, '/', areas.reduce((s,a)=>s+a.lessons.length,0))
bad.slice(0,12).forEach(b=>console.log(`  [${b.route}] ${b.area} / ${b.lesson} — 지정 ${b.qIds} → 풀 ${b.poolSize} (지정분 ${b.delivered}, 지정 밖 ${b.foreign})`))
console.log('\n=== 영역 1개 선택했을 때 ===')
for(const a of areas){
  const qIds=[...new Set(a.lessons.flatMap(l=>l.questionIds))]
  const {pool,route}=loadPool(qIds,[a.id])
  const asked=new Set(qIds)
  console.log(`  [${route}] ${a.displayName} — 지정 ${qIds.length} → 풀 ${pool.length} (지정분 ${pool.filter(q=>asked.has(q.id)).length}, 지정 밖 ${pool.filter(q=>!asked.has(q.id)).length})`)
}
