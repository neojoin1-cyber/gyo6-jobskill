/**
 * 고용노동부·한국산업인력공단 NCS 직업기초능력 26v1 표시 순서.
 * 공식 7영역은 출제 빈도에 따른 우열 관계가 아니므로 임의 중요도 순위를 만들지 않는다.
 */
export const NCS_CORE = ['의사소통능력', '수리능력', '문제해결능력']
export const NCS_MAJOR = ['자기관리능력', '대인관계능력', '디지털능력', '직업윤리']
export const NCS_2026_ORDER = [...NCS_CORE, ...NCS_MAJOR]

export function ncsTier(area) {
  if (NCS_CORE.includes(area)) {
    return {
      rank: NCS_2026_ORDER.indexOf(area),
      tier: 'foundation',
      label: '기초 직무역량',
      desc: 'NCS 26v1 공식 영역',
      color: '#1d4ed8',
      bg: '#eff6ff',
      border: '#bfdbfe',
    }
  }
  if (NCS_MAJOR.includes(area)) {
    return {
      rank: NCS_2026_ORDER.indexOf(area),
      tier: 'work',
      label: '직업 수행역량',
      desc: 'NCS 26v1 공식 영역',
      color: '#047857',
      bg: '#ecfdf5',
      border: '#a7f3d0',
    }
  }
  return {
    rank: 99,
    tier: 'legacy',
    label: '구기준·부가자료',
    desc: '공식 26v1 평가에서 분리',
    color: '#6b7280',
    bg: '#f8fafc',
    border: '#cbd5e1',
  }
}

export function ncsAreaCompare(a, b) {
  const ra = NCS_2026_ORDER.indexOf(a.id)
  const rb = NCS_2026_ORDER.indexOf(b.id)
  if (ra >= 0 || rb >= 0) return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb)
  return String(a.id).localeCompare(String(b.id), 'ko')
}

export function ncsKeyCompare(a, b) {
  const ra = NCS_2026_ORDER.indexOf(a)
  const rb = NCS_2026_ORDER.indexOf(b)
  return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb)
}
