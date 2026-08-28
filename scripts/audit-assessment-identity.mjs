import {
  buildDiagnosticPaper,
  buildSubjectMockPaper,
  diagnosticGroupOfQuestion,
  getDiagnosticScopes,
  getMockScopes,
  getMockScopeCapacity,
} from '../src/lib/mockData.js'
import { INTERVIEW_ORGANIZATIONS } from '../src/lib/interviewCareerContent.js'
import { readFileSync } from 'node:fs'

const failures = []
const subjects = ['ncs-basic', 'recruit-written', 'interview']
const diagnosticScreenSource = readFileSync(new URL('../src/screens/student/DiagnosticScreen.jsx', import.meta.url), 'utf8')

function assert(ok, message) { if (!ok) failures.push(message) }

for (const subjectId of subjects) {
  const diagnosticScopes = getDiagnosticScopes(subjectId)
  const areaScopes = diagnosticScopes.filter(s => s.level === 'area')
  const unitScopes = diagnosticScopes.filter(s => s.level === 'unit')
  console.log(`${subjectId}: 범위 구성 확인 중 — 전체 ${diagnosticScopes.length}`)
  assert(diagnosticScopes.some(s => s.level === 'all'), `${subjectId}: 전체 진단 범위 없음`)
  assert(areaScopes.length > 0, `${subjectId}: 영역 진단 범위 없음`)

  const representativeScopes = [
    diagnosticScopes.find(s => s.level === 'all'),
    areaScopes[0],
    unitScopes[0],
  ].filter(Boolean)
  for (const scope of representativeScopes) {
    console.log(`  진단: ${scope.level}/${scope.name} (${scope.count})`)
    const requested = Math.min(scope.count, scope.level === 'unit' ? 5 : 10)
    const paper = buildDiagnosticPaper(subjectId, 0, requested, scope.key)
    assert(paper.length === requested, `${subjectId}/${scope.name}: 진단 ${requested}문항 생성 실패(${paper.length})`)
    assert(new Set(paper.map(q => q.id)).size === paper.length, `${subjectId}/${scope.name}: 진단 시험지 내 중복`)
    if (scope.level === 'area') {
      assert(paper.every(q => diagnosticGroupOfQuestion(subjectId, q).area === scope.area), `${subjectId}/${scope.name}: 다른 영역 문항 유입`)
    }
    if (scope.level === 'unit') {
      assert(paper.every(q => diagnosticGroupOfQuestion(subjectId, q).unit === scope.unit), `${subjectId}/${scope.name}: 다른 소단원 문항 유입`)
    }
  }

  const mockScopes = getMockScopes(subjectId).filter(s => s.key !== '__all__')
  if (subjectId === 'interview') {
    const allScope = diagnosticScopes.find(s => s.level === 'all')
    const expectedOrganizationUnits = INTERVIEW_ORGANIZATIONS.length
    const expectedUnitScopes = 17 + expectedOrganizationUnits
    const expectedQuestionPool = 280 + expectedOrganizationUnits * 5
    assert(areaScopes.length === 10, `interview: 진단 영역은 기초 6 + 심화 4여야 함(${areaScopes.length})`)
    assert(unitScopes.length === expectedUnitScopes, `interview: 진단 소단원은 고정 17 + 지원처 ${expectedOrganizationUnits}개여야 함(${unitScopes.length})`)
    assert(allScope?.count === expectedQuestionPool, `interview: 전체 진단 문항 풀은 고정 280 + 지원처별 5문항이어야 함(${allScope?.count})`)
    assert(areaScopes.reduce((sum, scope) => sum + scope.count, 0) === allScope?.count, 'interview: 영역별 문항 합계가 전체 문항 풀과 다름')
    assert(mockScopes.length === 10, `interview: 모의 범위는 기초 6 + 심화 4여야 함(${mockScopes.length})`)
    assert(unitScopes.every(scope => !/^(FOUNDATION|ORG|COVER)-/.test(scope.name)), 'interview: 소단원 선택에 내부 코드가 노출됨')
  }
  for (const scope of mockScopes.slice(0, 2)) {
    console.log(`  모의: ${scope.name}`)
    const capacity = getMockScopeCapacity(subjectId, scope.key)
    const requested = Math.min(10, capacity)
    if (!requested) continue
    const paper = buildSubjectMockPaper(subjectId, scope.key, 3, requested)
    assert(paper.length === requested, `${subjectId}/${scope.name}: 맞춤 모의 ${requested}문항 생성 실패(${paper.length})`)
    assert(new Set(paper.map(q => q.id)).size === paper.length, `${subjectId}/${scope.name}: 맞춤 모의고사 내 중복`)
  }

  console.log(`${subjectId}: 진단 전체 1 · 영역 ${areaScopes.length} · 소단원 ${unitScopes.length} · 모의 범위 ${mockScopes.length}`)
}

assert(diagnosticScreenSource.includes('개 영역 중 현재 1개 선택'), '진단 화면: 영역 전체 수와 현재 선택 범위를 구분하는 안내 없음')
assert(diagnosticScreenSource.includes('개 소단원 중 현재 1개 선택'), '진단 화면: 소단원 전체 수와 현재 선택 범위를 구분하는 안내 없음')
assert(diagnosticScreenSource.includes('문항 풀은 반복할 때 출제할 수 있는 전체 문항 수'), '진단 화면: 문항 풀과 1회 응시 문항 수를 구분하는 안내 없음')
assert(diagnosticScreenSource.includes('이 소단원은 5문항 빠른 확인용'), '진단 화면: 소단원 5문항의 진단 한계 안내 없음')

if (failures.length) {
  console.error(`[평가 정체성] 실패 ${failures.length}건`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('[평가 정체성] 통과 — 범위별 진단 격리·표본 최소량·맞춤 모의 문항 수·시험지 중복 확인')
