import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const questions = JSON.parse(fs.readFileSync(path.join(root, 'data', 'questions.json'), 'utf8'))
const failures = []

const templated = questions.filter(q => /핵심 질문은|분리해 계산하면/.test(q.explanation || ''))
if (templated.length) failures.push(`근거 부족 생성형 해설 ${templated.length}건`)

const letterLabels = questions.filter(q => /\b[A-E]번/.test(q.explanation || ''))
if (letterLabels.length) failures.push(`화면과 다른 A~E 선택지 표기 ${letterLabels.length}건`)
const activeVariantText = fs.readFileSync(path.join(root, 'data', 'job-variants.json'), 'utf8')
if (/[A-E]번 '/.test(activeVariantText)) failures.push('직업공통 변형문항에 A~E 선택지 표기 잔존')

const calculationIds = [
  'C10-9-Q01', 'C10-9-Q02', 'C10-9-Q03', 'C10-9-Q04', 'C10-9-Q05', 'C10-9-Q06', 'C10-9-Q07',
  'C26-25-Q01', 'C26-25-Q02', 'C26-25-Q03', 'C26-25-Q04', 'C26-25-Q05', 'C26-25-Q06',
]
for (const id of calculationIds) {
  const q = questions.find(item => item.id === id)
  if (!q || !/[=×÷+\-]/.test(q.explanation || '')) failures.push(`${id}: 계산 과정 없음`)
}

const textExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.css'])
for (const start of ['src', 'data']) {
  const stack = [path.join(root, start)]
  while (stack.length) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (textExtensions.has(path.extname(entry.name)) && fs.readFileSync(full, 'utf8').includes('\uFFFD')) {
        failures.push(`깨진 문자 U+FFFD: ${path.relative(root, full)}`)
      }
    }
  }
}

if (failures.length) {
  console.error(`Launch content gate FAILED (${failures.length})`)
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log(`Launch content gate PASS: 해설 ${questions.length}건 · 계산과정 13/13 · U+FFFD 0건`)
