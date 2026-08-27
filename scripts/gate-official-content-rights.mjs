import fs from 'node:fs'
import path from 'node:path'
import { evaluateOfficialItemRights } from '../src/lib/officialContentRights.js'

const roots = ['src', 'data']
const marker = /(?:itemProvenance|alignmentStatus)\s*[:=]\s*['"]official-published-item['"]|"(?:itemProvenance|alignmentStatus)"\s*:\s*"official-published-item"|officialItem\s*[:=]\s*true/g
const rightsModule = path.normalize('src/lib/officialContentRights.js')
const failures = []
let candidates = 0

const baseFixture = {
  itemProvenance: 'official-published-item',
  sourceLabel: '공식 출처',
  sourceUrl: 'https://example.go.kr/question',
  rights: {
    reviewStatus: 'approved',
    licenseType: 'KOGL-1',
    evidenceUrl: 'https://example.go.kr/license',
    permissions: {
      commercialUse: true,
      redistribution: true,
      offlineStorage: true,
      adaptation: true,
    },
    thirdPartyAssetsCleared: true,
    reviewedAt: '2026-08-27',
  },
}

if (!evaluateOfficialItemRights(baseFixture).cleared) {
  failures.push('공공누리 제1유형 권리 완료 문항이 승인되지 않습니다.')
}
if (evaluateOfficialItemRights({
  ...baseFixture,
  rights: { ...baseFixture.rights, licenseType: 'KOGL-4' },
}).cleared) {
  failures.push('공공누리 제4유형 문항이 유료 앱용으로 잘못 승인됩니다.')
}
if (evaluateOfficialItemRights({
  ...baseFixture,
  rights: {
    ...baseFixture.rights,
    permissions: { ...baseFixture.rights.permissions, offlineStorage: false },
  },
}).cleared) {
  failures.push('오프라인 저장 권한이 없는 문항이 잘못 승인됩니다.')
}

function visit(target) {
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name)
    if (entry.isDirectory()) {
      visit(full)
      continue
    }
    if (!/\.(?:js|jsx|json|mjs)$/.test(entry.name) || path.normalize(full).endsWith(rightsModule)) continue
    const content = fs.readFileSync(full, 'utf8')
    const matches = content.match(marker) || []
    candidates += matches.length
    if (!matches.length) continue

    const hasRightsRecord = /(?:rights|usageRights)\s*[:=]/.test(content)
      || /"(?:rights|usageRights)"\s*:/.test(content)
    if (!hasRightsRecord) failures.push(`${path.relative(process.cwd(), full)}: 공식 문항 표시가 있지만 권리 메타데이터가 없습니다.`)
  }
}

for (const root of roots) {
  const target = path.join(process.cwd(), root)
  if (fs.existsSync(target)) visit(target)
}

if (failures.length) {
  console.error(`[공식 문항 권리 게이트] 실패 ${failures.length}건`)
  failures.forEach(failure => console.error(`  - ${failure}`))
  process.exit(1)
}

console.log(`[공식 문항 권리 게이트] 통과 - 공식 문항 후보 ${candidates}개, 미승인 원문 탑재 0개`)
