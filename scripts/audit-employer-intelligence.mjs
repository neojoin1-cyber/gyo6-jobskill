import { INTERVIEW_ORGANIZATIONS } from '../src/lib/interviewCareerContent.js'

const failures = []
const fail = message => failures.push(message)
const counts = Object.fromEntries(['finance', 'public', 'enterprise'].map(sector => [sector, INTERVIEW_ORGANIZATIONS.filter(item => item.sector === sector).length]))

if (INTERVIEW_ORGANIZATIONS.length < 120) fail(`지원처가 ${INTERVIEW_ORGANIZATIONS.length}곳뿐임(최소 120곳)`)
if (counts.finance < 30) fail(`금융권이 ${counts.finance}곳뿐임(최소 30곳)`)
if (counts.public < 40) fail(`공공기관이 ${counts.public}곳뿐임(최소 40곳)`)
if (counts.enterprise < 50) fail(`대기업이 ${counts.enterprise}곳뿐임(최소 50곳)`)

for (const field of ['id', 'name']) {
  const values = INTERVIEW_ORGANIZATIONS.map(item => item[field])
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index)
  if (duplicates.length) fail(`${field} 중복: ${[...new Set(duplicates)].join(', ')}`)
}

for (const organization of INTERVIEW_ORGANIZATIONS) {
  const label = `${organization.name}(${organization.id})`
  if (!/^https:\/\//.test(organization.officialUrl || '')) fail(`${label}: HTTPS 공식 주소 없음`)
  if ((organization.roles || []).length < 3) fail(`${label}: 직무 3개 미만`)
  if ((organization.values || []).length < 3) fail(`${label}: 가치 기준 3개 미만`)
  if (!organization.identity || organization.identity.length < 20) fail(`${label}: 핵심 정체성이 지나치게 짧음`)
  if (!/^2026-\d{2}$/.test(organization.verifiedAt || '')) fail(`${label}: 검증 기준월 형식 오류`)
  if ((organization.intelligence?.themes || []).length !== 3) fail(`${label}: 분석 주제 3개가 아님`)
  if ((organization.intelligence?.timeline || []).length !== 3) fail(`${label}: 연도 확인 흐름 3단계가 아님`)
  if ((organization.intelligence?.provenance || []).length < 2) fail(`${label}: 공식·교차 출처가 부족함`)
  if (organization.intelligence?.provenance?.some(item => !/^https:\/\//.test(item.url || ''))) fail(`${label}: 출처 URL이 HTTPS가 아님`)
  const corpus = JSON.stringify(organization)
  if (/남학생|여학생|남성에게|여성에게|성별에 따라/.test(corpus)) fail(`${label}: 성별 고정관념 문구 발견`)
}

const identities = INTERVIEW_ORGANIZATIONS.map(item => item.identity)
const duplicateIdentities = identities.filter((value, index) => identities.indexOf(value) !== index)
if (duplicateIdentities.length) fail(`핵심 정체성 완전 중복: ${[...new Set(duplicateIdentities)].join(' / ')}`)

if (failures.length) {
  console.error(`\n[employer-intelligence] ${failures.length}개 실패`)
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log(`[employer-intelligence] 통과: ${INTERVIEW_ORGANIZATIONS.length}곳 (금융 ${counts.finance} · 공공 ${counts.public} · 대기업 ${counts.enterprise})`)
console.log('[employer-intelligence] 고유 식별자·HTTPS 출처·직무·가치·3개 연도 확인·성별 중립성 검증 완료')

