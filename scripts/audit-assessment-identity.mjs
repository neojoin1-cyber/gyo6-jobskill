import {
  buildDiagnosticPaper,
  buildSubjectMockPaper,
  diagnosticGroupOfQuestion,
  getDiagnosticScopes,
  getMockScopes,
  getMockScopeCapacity,
} from '../src/lib/mockData.js'

const failures = []
const subjects = ['ncs-basic', 'recruit-written', 'interview']

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
    assert(areaScopes.length === 10, `interview: 진단 영역은 기초 6 + 심화 4여야 함(${areaScopes.length})`)
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

if (failures.length) {
  console.error(`[평가 정체성] 실패 ${failures.length}건`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('[평가 정체성] 통과 — 범위별 진단 격리·표본 최소량·맞춤 모의 문항 수·시험지 중복 확인')
