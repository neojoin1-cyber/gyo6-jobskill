import { compactTextLines } from '../lib/compactCopy.js'

export default function CompactText({ text, className = '', style, maxItemChars = 82, ordered = false }) {
  const lines = compactTextLines(text, { maxItemChars })
  if (!lines.length) return null
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={`compact-copy ${ordered ? 'is-ordered' : ''} ${className}`.trim()} style={style}>
      {lines.map((line, index) => (
        <li key={`${line.label}-${index}`}>
          {line.label && <strong>{line.label}</strong>}
          <span>{line.text}</span>
        </li>
      ))}
    </Tag>
  )
}
