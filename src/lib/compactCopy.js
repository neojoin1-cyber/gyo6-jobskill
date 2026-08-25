const LABELS = [
  '정답 근거', '정답', '핵심', '결론', '근거', '계산', '확인', '오답 분석',
  '오답', '실수 포인트', '학습 포인트', '출제 포인트', '예시', '현장 예시',
]

const LABEL_PATTERN = new RegExp(`^(${LABELS.join('|')})\\s*[:：｜-]\\s*`)
const BULLET_PATTERN = /^(?:[•·▪◦‣–—-]|[①②③④⑤⑥⑦⑧⑨⑩]|\d+[.)])\s*/

function plain(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function noteEnding(value) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/(?:하였습니다|했습니다)(?=$|[.!?])/g, '했음')
    .replace(/(?:되었습니다|됐습니다)(?=$|[.!?])/g, '됐음')
    .replace(/(?:해야|하여야)\s*(?:합니다|한다|함)(?=$|[.!?])/g, ' 필요')
    .replace(/할 수 (?:있습니다|있다|있음)(?=$|[.!?])/g, ' 가능')
    .replace(/할 수 (?:없습니다|없다|없음)(?=$|[.!?])/g, ' 불가')
    .replace(/(?:하는 것이|할 필요가) 중요(?:합니다|하다|함)(?=$|[.!?])/g, ' 필요')
    .replace(/(?:입니다|이다|이에요|예요)(?=$|[.!?])/g, '임')
    .replace(/(?:합니다|한다)(?=$|[.!?])/g, '함')
    .replace(/(?:됩니다|된다)(?=$|[.!?])/g, '됨')
    .replace(/(?:있습니다|있다)(?=$|[.!?])/g, '있음')
    .replace(/(?:없습니다|없다)(?=$|[.!?])/g, '없음')
    .replace(/(?:아닙니다|아니다)(?=$|[.!?])/g, '아님')
    .replace(/(?:필요합니다|필요하다)(?=$|[.!?])/g, '필요')
    .replace(/(?:가능합니다|가능하다)(?=$|[.!?])/g, '가능')
    .replace(/빠뜨립니다(?=$|[.!?])/g, '누락함')
    .replace(/([가-힣]+)립니다(?=$|[.!?])/g, '$1림')
    .replace(/([가-힣]+)힙니다(?=$|[.!?])/g, '$1힘')
    .replace(/([가-힣]+)웁니다(?=$|[.!?])/g, '$1움')
    .replace(/([가-힣]+)릅니다(?=$|[.!?])/g, '$1름')
    .replace(/([가-힣]+)습니다(?=$|[.!?])/g, '$1음')
    .replace(/([가-힣]+)린다(?=$|[.!?])/g, '$1림')
    .replace(/([가-힣]+)힌다(?=$|[.!?])/g, '$1힘')
    .replace(/([가-힣]+)킨다(?=$|[.!?])/g, '$1킴')
    .replace(/([가-힣]+)친다(?=$|[.!?])/g, '$1침')
    .replace(/([가-힣]+)낸다(?=$|[.!?])/g, '$1냄')
    .replace(/([가-힣]+)른다(?=$|[.!?])/g, '$1름')
    .replace(/([가-힣]+)든다(?=$|[.!?])/g, '$1듦')
    .replace(/([가-힣]+)운다(?=$|[.!?])/g, '$1움')
    .replace(/([가-힣]+)는다(?=$|[.!?])/g, '$1음')
    .replace(/([가-힣]+)은다(?=$|[.!?])/g, '$1음')
    .replace(/\b본다(?=$|[.!?])/g, '봄')
    .replace(/\b쓴다(?=$|[.!?])/g, '씀')
    .replace(/\b간다(?=$|[.!?])/g, '감')
    .replace(/\b온다(?=$|[.!?])/g, '옴')
    .replace(/(?:어렵습니다|어렵다)(?=$|[.!?])/g, '어려움')
    .replace(/(?:높습니다|높다)(?=$|[.!?])/g, '높음')
    .replace(/(?:낮습니다|낮다)(?=$|[.!?])/g, '낮음')
    .replace(/[.!。]+$/, '')
    .trim()
}

function splitLong(value, maxItemChars) {
  if ([...value].length <= maxItemChars) return [value]
  const clauses = value
    .split(/,\s+(?=(?:그러나|반면|따라서|다만|즉|특히|예를|[가-힣A-Za-z0-9"'“‘(]))/)
    .map(part => part.trim())
    .filter(Boolean)
  if (clauses.length > 1) {
    return clauses.flatMap((part, index) => {
      const cleaned = index < clauses.length - 1 ? part.replace(/(?:이고|이며|하고|지만|므로|해서)$/, '') : part
      return splitLong(cleaned, maxItemChars)
    })
  }
  const words = value.split(' ')
  const rows = []
  let row = ''
  for (const word of words) {
    const next = row ? `${row} ${word}` : word
    if (row && [...next].length > maxItemChars) {
      rows.push(row)
      row = word
    } else row = next
  }
  if (row) rows.push(row)
  return rows
}

export function compactTextLines(value, { maxItemChars = 82 } = {}) {
  const text = plain(value)
    .replace(/\s+(?=(?:정답 근거|오답 분석|실수 포인트|학습 포인트|출제 포인트)\s*[:：])/g, '\n')
  if (!text) return []

  const rawLines = text
    .split(/\n+|(?<=[.!?。])\s+(?=[가-힣A-Za-z0-9①-⑩💡📌✅☑️🧠💼])/)
    .map(line => line.trim())
    .filter(Boolean)

  const result = []
  for (const rawLine of rawLines) {
    let line = rawLine.replace(BULLET_PATTERN, '').trim()
    let label = ''
    const labelMatch = line.match(LABEL_PATTERN)
    if (labelMatch) {
      label = labelMatch[1]
      line = line.slice(labelMatch[0].length).trim()
    }
    line = line
      .replace(/^해설\s*[:：]\s*/, '')
      // "정답은 D입니다" 같은 해설 표지만 걷어낸다. "정답을 맞히는 시험"처럼
      // 정답으로 시작하는 일반 문장은 건드리지 않는다.
      .replace(/^정답(?:은|[:：])\s*["'“‘]?(.+?)["'”’]?(?:입니다|이다|임)[.!]?$/u, '$1')
      .trim()
    for (const [index, part] of splitLong(line, maxItemChars).entries()) {
      const textPart = noteEnding(part)
      if (textPart) result.push({ label: index === 0 ? label : '', text: textPart })
    }
  }
  return result
}

export function compactText(value, options) {
  return compactTextLines(value, options)
    .map(item => item.label ? `${item.label}｜${item.text}` : item.text)
    .join('\n')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Converts prose paragraphs in trusted lesson-deck HTML to compact lists.
 * Tables, examples, documents and existing lists keep their original markup.
 */
export function compactInstructionHtml(value, { maxItemChars = 94 } = {}) {
  return String(value ?? '').replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (original, attrs, body) => {
    const lines = compactTextLines(body, { maxItemChars })
    if (!lines.length) return ''
    if (lines.length === 1 && plain(body).length < 58) {
      return original
    }
    const items = lines.map(({ label, text }) => (
      `<li>${label ? `<strong>${escapeHtml(label)}</strong>` : ''}<span>${escapeHtml(text)}</span></li>`
    )).join('')
    return `<ul class="compact-copy deck-compact-copy">${items}</ul>`
  })
}
