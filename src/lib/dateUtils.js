export function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ko')
}

export function formatDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDuration(sec) {
  if (sec == null) return '-'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

export function formatDueDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  const now = new Date()
  const diff = Math.ceil((dt - now) / (1000 * 60 * 60 * 24))
  const base = dt.toLocaleDateString('ko')
  if (diff < 0)  return `${base} (마감)`
  if (diff === 0) return `오늘 마감`
  if (diff === 1) return `내일 마감`
  if (diff <= 7)  return `${base} (D-${diff})`
  return base
}
