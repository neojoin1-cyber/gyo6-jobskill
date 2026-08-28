import fs from 'node:fs'
import path from 'node:path'
import * as cheerio from 'cheerio'

const ROOT = process.cwd()
const BASE = 'https://www.hifive.go.kr'
const LIST_PATH = '/stats/schInfoList.do?menuId=010101&rootMenuId=01&titledepth=3'
const OUTPUT = path.join(ROOT, 'data', 'hifive-departments.json')
const CATALOG_OUTPUT = path.join(ROOT, 'data', 'hifive-department-catalog.json')
const CONCURRENCY = 5

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function fetchHtml(url, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'JOBGO-education-content-audit/1.0 (school department reference; contact: support@sugarandsalt.kr)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (response.ok) return response.text()
  if (attempt < 4 && [429, 500, 502, 503, 504].includes(response.status)) {
    await sleep(600 * attempt)
    return fetchHtml(url, attempt + 1)
  }
  throw new Error(`${response.status} ${response.statusText}: ${url}`)
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizeDepartmentName(value) {
  return clean(value)
    .normalize('NFKC')
    .replace(/[·ㆍ]/g, '·')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s+/g, '')
}

function inferMajorGroup(name) {
  const value = normalizeDepartmentName(name)
  const rules = [
    ['food', /(조리|제과|제빵|식품|외식|카페|바리스타|푸드|농산|수산|축산)/],
    ['service', /(관광|호텔|항공서비스|서비스|컨벤션|레저|여행|경찰|소방|부사관)/],
    ['design', /(디자인|미용|뷰티|패션|의상|메이크업|헤어|웹툰|애니메이션|방송|사진|영상|공예)/],
    ['bio', /(보건|간호|바이오|의료|생명|제약|동물|반려|산림|원예|환경)/],
    ['business', /(경영|회계|세무|금융|사무|비즈니스|유통|마케팅|무역|상업|전자상거래)/],
    ['architecture', /(건축|토목|건설|측량|공간|실내|조경)/],
    ['mechanical', /(기계|자동차|모빌리티|항공|조선|용접|금형|정밀|냉동|설비|스마트팩토리)/],
    ['electrical', /(전기|전자|반도체|로봇|제어|통신|에너지|디스플레이|자동화)/],
    ['software', /(소프트웨어|인공지능|AI|컴퓨터|정보|게임|콘텐츠|메타버스|빅데이터|네트워크|스마트IT|IT융합|사이버)/i],
  ]
  return rules.find(([, pattern]) => pattern.test(value))?.[0] || 'general'
}

async function readSchools() {
  const schools = new Map()
  for (let page = 1; page <= 100; page += 1) {
    const separator = LIST_PATH.includes('?') ? '&' : '?'
    const html = await fetchHtml(`${BASE}${LIST_PATH}${separator}currpage=${page}`)
    const matches = [...html.matchAll(/schoolMain\.do\?sch_seq=(\d+)[^>]*>([^<]+)<\/a>/g)]
    const before = schools.size
    for (const match of matches) schools.set(match[1], { id: match[1], name: clean(match[2]) })
    if (!matches.length || schools.size === before) break
    if (page % 10 === 0) console.log(`HIFIVE schools discovered: ${schools.size}`)
    await sleep(120)
  }
  return [...schools.values()]
}

function parseSchoolDetail(school, html) {
  const $ = cheerio.load(html)
  const updatedAt = clean($('.update').text()).replace(/^최종작성일\s*:\s*/, '')
  const departments = []
  $('th.major').each((_, element) => {
    const row = $(element).closest('tr')
    const name = clean($(element).text())
    const students = row.find('td.man').toArray().reduce((sum, cell) => sum + (Number(clean($(cell).text())) || 0), 0)
    const classes = row.find('td.class').toArray().reduce((sum, cell) => sum + (Number(clean($(cell).text())) || 0), 0)
    if (name && (students > 0 || classes > 0)) departments.push({ name, students, classes })
  })
  return { ...school, updatedAt, departments }
}

async function mapConcurrent(items, worker, concurrency) {
  const results = new Array(items.length)
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
      await sleep(90)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run))
  return results
}

async function main() {
  if (process.argv.includes('--catalog-only')) {
    const existing = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'))
    writeCatalog(existing)
    return
  }
  const schools = await readSchools()
  if (schools.length < 400) throw new Error(`전국 학교 목록이 충분하지 않음: ${schools.length}`)

  const details = await mapConcurrent(schools, async (school, index) => {
    const html = await fetchHtml(`${BASE}/search/schoolMain.do?sch_seq=${school.id}`)
    if ((index + 1) % 50 === 0) console.log(`HIFIVE school details: ${index + 1}/${schools.length}`)
    return parseSchoolDetail(school, html)
  }, CONCURRENCY)

  const grouped = new Map()
  for (const school of details) {
    for (const department of school.departments) {
      const normalizedName = normalizeDepartmentName(department.name)
      const entry = grouped.get(normalizedName) || {
        normalizedName,
        displayNames: new Set(),
        schools: [],
        majorGroup: inferMajorGroup(normalizedName),
      }
      entry.displayNames.add(department.name)
      entry.schools.push({ id: school.id, name: school.name, students: department.students, classes: department.classes, updatedAt: school.updatedAt })
      grouped.set(normalizedName, entry)
    }
  }

  const departments = [...grouped.values()].map(item => ({
    name: [...item.displayNames].sort((a, b) => a.length - b.length || a.localeCompare(b, 'ko'))[0],
    aliases: [...item.displayNames].sort((a, b) => a.localeCompare(b, 'ko')),
    normalizedName: item.normalizedName,
    majorGroup: item.majorGroup,
    schoolCount: item.schools.length,
    studentCount: item.schools.reduce((sum, school) => sum + school.students, 0),
    schools: item.schools.sort((a, b) => a.name.localeCompare(b.name, 'ko')),
  })).sort((a, b) => b.schoolCount - a.schoolCount || b.studentCount - a.studentCount || a.name.localeCompare(b.name, 'ko'))

  const output = {
    source: {
      name: '특성화고·마이스터고 포털 하이파이브',
      url: `${BASE}${LIST_PATH}`,
      note: '학교가 입력한 공개 학교현황의 현재 재학생 학과를 집계함. 앱 예시는 원문을 복제하지 않고 학과 분류 근거로만 사용함.',
      fetchedAt: new Date().toISOString(),
    },
    summary: {
      schools: details.length,
      schoolsWithDepartments: details.filter(item => item.departments.length).length,
      departmentNames: departments.length,
      repeatedDepartmentNames: departments.filter(item => item.schoolCount >= 2).length,
      singleSchoolDepartmentNames: departments.filter(item => item.schoolCount === 1).length,
    },
    priorityDepartments: departments.filter(item => item.schoolCount >= 2),
    expansionDepartments: departments.filter(item => item.schoolCount === 1),
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  writeCatalog(output)
  console.log(`HIFIVE department sync PASS: ${output.summary.schools} schools · ${output.summary.repeatedDepartmentNames} repeated · ${output.summary.singleSchoolDepartmentNames} single-school`)
}

function writeCatalog(output) {
  const slim = item => ({ name: item.name, majorGroup: item.majorGroup, schoolCount: item.schoolCount, studentCount: item.studentCount })
  const catalog = {
    source: output.source,
    summary: output.summary,
    priorityDepartments: output.priorityDepartments.map(slim),
    expansionDepartments: output.expansionDepartments.map(slim),
  }
  fs.writeFileSync(CATALOG_OUTPUT, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  console.log(`HIFIVE app catalog written: ${CATALOG_OUTPUT}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
