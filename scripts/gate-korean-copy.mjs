import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import interviewStudy from '../data/interview-study.json' with { type: 'json' }
import * as interviewCareerContent from '../src/lib/interviewCareerContent.js'
import { INTERVIEW_FOUNDATION_COURSES } from '../src/lib/interviewFoundationCourses.js'

const root = process.cwd()
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

function flattenStrings(value, path = 'content', rows = []) {
  if (typeof value === 'string') rows.push({ path, value })
  else if (Array.isArray(value)) value.forEach((item, index) => flattenStrings(item, `${path}[${index}]`, rows))
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => flattenStrings(item, `${path}.${key}`, rows))
  }
  return rows
}

function collectSourceFiles(relativePath) {
  const absolutePath = join(root, relativePath)
  if (!existsSync(absolutePath)) return []
  if (statSync(absolutePath).isFile()) return [relativePath]
  return readdirSync(absolutePath).flatMap(name => collectSourceFiles(join(relativePath, name)))
}

const sourceFiles = [
  ...collectSourceFiles('src/screens').filter(file => /\.(jsx|js)$/.test(file)),
  ...collectSourceFiles('src/components').filter(file => /\.(jsx|js)$/.test(file)),
  'src/App.jsx',
  'src/lib/interviewCareerContent.js',
  'src/lib/interviewFoundationCourses.js',
]

const sourceRows = sourceFiles.map(file => ({ path: file, value: readFileSync(join(root, file), 'utf8') }))
const generatedRows = flattenStrings(interviewCareerContent, 'interviewCareerContent')
const allRows = [...sourceRows, ...generatedRows]

const forbidden = [
  { pattern: /\uFFFD/, label: '깨진 문자 U+FFFD' },
  { pattern: /기술 이해을/, label: '잘못된 목적격 조사: 기술 이해을' },
  { pattern: /기술 이해를 지키/, label: '의미가 맞지 않는 서술: 기술 이해를 지키다' },
  { pattern: /됬/, label: '맞춤법 오류: 됬' },
  { pattern: /되요/, label: '맞춤법 오류: 되요' },
  { pattern: /몇일/, label: '맞춤법 오류: 몇일' },
  { pattern: /역활/, label: '맞춤법 오류: 역활' },
  { pattern: /어의없/, label: '맞춤법 오류: 어의없다' },
  { pattern: /웬지/, label: '맞춤법 오류: 웬지' },
  { pattern: /왠일/, label: '맞춤법 오류: 왠일' },
  { pattern: /금새(?=\s|[.,!?]|$)/, label: '맞춤법 오류: 금새' },
  { pattern: /(을을|를를|은은|는는|과과|와와)(?=\s|[.,!?]|$)/, label: '조사 중복' },
]

for (const row of allRows) {
  for (const rule of forbidden) {
    if (rule.pattern.test(row.value)) failures.push(`${rule.label}: ${row.path}`)
  }
}

for (const row of generatedRows) {
  if (/[.?!]{2,}/.test(row.value)) failures.push(`문장부호 중복: ${row.path}`)
}

const finalHangulHasBatchim = word => {
  const last = [...String(word)].reverse().find(character => /[가-힣]/.test(character))
  if (!last) return false
  return (last.charCodeAt(0) - 0xac00) % 28 !== 0
}
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const generatedText = generatedRows.map(row => row.value).join('\n')
for (const organization of interviewCareerContent.INTERVIEW_ORGANIZATIONS) {
  const particleTokens = [organization.name, organization.identity, ...organization.values]
  for (const token of particleTokens) {
    const hasBatchim = finalHangulHasBatchim(token)
    const wrongObject = hasBatchim ? '를' : '을'
    const wrongSubject = hasBatchim ? '가' : '이'
    check(!new RegExp(`${escapeRegExp(token)}${wrongObject}(?=\\s|[.,!?]|$)`).test(generatedText), `잘못된 목적격 조사: ${token}${wrongObject}`)
    check(!new RegExp(`${escapeRegExp(token)}${wrongSubject}(?=\\s|[.,!?]|$)`).test(generatedText), `잘못된 주격 조사: ${token}${wrongSubject}`)
  }
  const wrongDefinition = finalHangulHasBatchim(organization.identity) ? '라는' : '이라는'
  check(!generatedText.includes(`${organization.identity}${wrongDefinition} 점`), `잘못된 서술격 조사: ${organization.identity}${wrongDefinition}`)
}

const mappedCategories = INTERVIEW_FOUNDATION_COURSES.flatMap(course => course.categories)
const sourceCategories = [...new Set(interviewStudy.lessons.map(lesson => lesson.category))]
check(INTERVIEW_FOUNDATION_COURSES.length === 6, `기초 면접 과정 수 오류: ${INTERVIEW_FOUNDATION_COURSES.length}`)
check(new Set(mappedCategories).size === mappedCategories.length, '기초 면접 과정 사이에 중복 범주가 있음')
check(sourceCategories.every(category => mappedCategories.includes(category)), `과정에 포함되지 않은 면접 범주: ${sourceCategories.filter(category => !mappedCategories.includes(category)).join(', ')}`)
check(mappedCategories.every(category => sourceCategories.includes(category)), `실제 단원이 없는 면접 범주: ${mappedCategories.filter(category => !sourceCategories.includes(category)).join(', ')}`)
check(interviewStudy.lessons.length === 48, `기초 면접 단원 수 변경: ${interviewStudy.lessons.length}`)

if (failures.length) {
  console.error(`[한국어 문구] 실패 ${failures.length}건`)
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`[한국어 문구] 통과 — 화면·생성 문장 ${allRows.length}개 검사 · 면접 6개 과정/48개 단원 연결 확인`)
