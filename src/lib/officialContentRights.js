export const OFFICIAL_ITEM_PROVENANCE = 'official-published-item'

const APPROVED_LICENSE_TYPES = new Set([
  'KOGL-1',
  'WRITTEN-LICENSE',
  'PUBLIC-DOMAIN',
])

function text(value) {
  return String(value ?? '').trim()
}

function isHttpUrl(value) {
  try {
    const url = new URL(text(value))
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function isOfficialItemCandidate(source = {}) {
  return source.itemProvenance === OFFICIAL_ITEM_PROVENANCE
    || source.officialItem === true
    || source.alignmentStatus === OFFICIAL_ITEM_PROVENANCE
}

export function evaluateOfficialItemRights(source = {}) {
  if (!isOfficialItemCandidate(source)) {
    return { candidate: false, cleared: false, reasons: [] }
  }

  const rights = source.rights || source.usageRights || {}
  const permissions = rights.permissions || {}
  const reasons = []

  if (!text(source.sourceLabel || source.standardAuthority)) reasons.push('공식 출처명 없음')
  if (!isHttpUrl(source.sourceUrl)) reasons.push('공식 원문 URL 없음')
  if (rights.reviewStatus !== 'approved') reasons.push('권리 검토 승인 없음')
  if (!APPROVED_LICENSE_TYPES.has(rights.licenseType)) reasons.push('유료 앱에 허용된 이용 근거 없음')
  if (!isHttpUrl(rights.evidenceUrl) && !text(rights.permissionRecordId)) reasons.push('이용 근거 증빙 없음')
  if (permissions.commercialUse !== true) reasons.push('상업적 이용 허용 없음')
  if (permissions.redistribution !== true) reasons.push('앱 재배포 허용 없음')
  if (permissions.offlineStorage !== true) reasons.push('기기 저장 허용 없음')
  if (permissions.adaptation !== true) reasons.push('문항 가공·상호작용화 허용 없음')
  if (rights.thirdPartyAssetsCleared !== true) reasons.push('지문·사진·도표·음원 제3자 권리 확인 없음')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(rights.reviewedAt))) reasons.push('권리 검토일 없음')

  return {
    candidate: true,
    cleared: reasons.length === 0,
    reasons,
    licenseType: text(rights.licenseType),
    attribution: text(rights.attribution),
    evidenceUrl: text(rights.evidenceUrl),
  }
}

export function assertOfficialItemRights(source = {}, scope = '공식 공개 문항') {
  const result = evaluateOfficialItemRights(source)
  if (result.candidate && !result.cleared) {
    throw new Error(`${scope}: ${result.reasons.join(', ')}`)
  }
  return result
}
