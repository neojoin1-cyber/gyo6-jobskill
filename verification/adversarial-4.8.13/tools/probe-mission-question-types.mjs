// 교사 미션에 담기는 문항 유형 점검 — MissionScreen 은 q.choices 만 그린다.
// 연결형(matching)·단답형(text) 문항이 미션 풀에 섞이면 보기 없는 화면이 된다.
// 기준선 ee6aee89abf8

import jobQuestions from '../../../data/questions.json'
import { buildJcMissionAreas, englishStudyQuestions, jobCommonMediaQuestions } from '../../../src/lib/jobCommonAreas.js'
import { withExtractedChoices, isOXQuestion } from '../../../src/lib/questionNorm.js'
const POOL=[...jobQuestions, ...englishStudyQuestions, ...jobCommonMediaQuestions]
const byId=new Map(POOL.map(q=>[q.id,q]))
const areas=buildJcMissionAreas()
let totalIds=0, missing=0, noChoice=0
const badLessons=[]
for(const a of areas) for(const l of a.lessons){
  let bad=[]
  for(const id of l.questionIds){
    totalIds++
    const q=byId.get(id)
    if(!q){missing++; continue}
    const n=withExtractedChoices(q); const ch=n.choices||n.options||[]
    if(!isOXQuestion(n) && ch.length<2){noChoice++; bad.push(id)}
  }
  if(bad.length) badLessons.push({area:a.displayName,lesson:l.title,total:l.questionIds.length,bad:bad.length,ids:bad.slice(0,4)})
}
console.log('미션 영역', areas.length, '· 교사가 고를 수 있는 문항 id 총합', totalIds)
console.log('미션 풀에 없는 id(조용히 사라짐):', missing)
console.log('보기 없이 뜨는 id:', noChoice)
console.log('영향 단원 수', badLessons.length)
badLessons.slice(0,8).forEach(b=>console.log('  ',b.area,'|',b.lesson,'|',b.bad+'/'+b.total, b.ids.join(',')))
// 단원 전체가 보기없는 문항뿐인 경우 = 미션을 열면 아무것도 못 푸는 수업
const dead=badLessons.filter(b=>b.bad===b.total)
console.log('단원 전체가 보기없음:', dead.length, dead.slice(0,5).map(d=>d.area+'/'+d.lesson))
