import { readFileSync } from 'node:fs'

const bank = JSON.parse(readFileSync(new URL('../data/ncs-extracted-bank.json', import.meta.url), 'utf8'))
const questions = Array.isArray(bank) ? bank : bank.questions || []
const circles = ['①', '②', '③', '④', '⑤']
const failures = []

function answerIndex(answer) {
  const value = String(answer ?? '').trim().toUpperCase()
  if (/^[A-E]$/.test(value)) return value.charCodeAt(0) - 65
  if (/^[1-5]$/.test(value)) return Number(value) - 1
  return circles.indexOf(value)
}

for (const question of questions) {
  const correct = answerIndex(question.answer)
  if (correct < 0) continue
  const explanation = String(question.explanation || '')
  if (!explanation) continue

  const declarations = [...explanation.matchAll(/정답(?:은|\s*[:：])\s*(?:[A-E](?=\s|[.!,:：]|$)|[1-5]\s*번|[①②③④⑤])/gi)]
  const declared = declarations.at(-1)?.[0] || ''
  const declaredToken = declared.match(/[A-E①②③④⑤]|[1-5](?=번|$)/i)?.[0]
  if (declaredToken && answerIndex(declaredToken) !== correct) {
    failures.push(`${question.id}: 정답 필드 ${correct + 1}번과 해설 표기 '${declared}' 불일치`)
  }

  const wrongAt = explanation.search(/오답\s*분석/)
  if (wrongAt < 0) continue
  const wrong = explanation.slice(wrongAt)
  const correctMarker = circles[correct]
  const wrongMarker = new RegExp(`(?:[–—-]\\s*|^|\\s)${correctMarker}(?:\\s*[,、:]|\\s*번|\\s*[은는이가:]|\\s*$)`)
  if (wrongMarker.test(wrong)) {
    failures.push(`${question.id}: 오답 분석이 실제 정답 ${correctMarker}을 오답으로 지목함`)
  }

  for (const match of wrong.matchAll(/([①②③④⑤]|[1-5]번)보다/g)) {
    const compared = answerIndex(match[1].replace('번', ''))
    if (compared !== correct) {
      failures.push(`${question.id}: 오답 비교 기준 '${match[0]}'이 실제 정답 ${correct + 1}번과 다름`)
    }
  }
}

if (failures.length) {
  console.error(`FAIL explanation consistency audit: ${failures.length}`)
  failures.slice(0, 80).forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`PASS explanation consistency audit: ${questions.length} questions`)
