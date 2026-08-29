import { useId, useMemo, useState } from 'react'
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react'

const normalize = value => String(value || '').replace(/\s+/g, '').toLocaleLowerCase('ko-KR')

export default function SearchSuggestionInput({
  value,
  onChange,
  onSelect,
  items = [],
  getLabel = item => item.label,
  getMeta = () => '',
  placeholder = '검색하거나 직접 입력',
  emptyText = '일치하는 항목이 없습니다. 입력한 내용을 그대로 사용할 수 있습니다.',
  maxResults = 24,
  ariaLabel,
}) {
  const id = useId().replace(/:/g, '')
  const [open, setOpen] = useState(false)
  const matches = useMemo(() => {
    const keyword = normalize(value)
    return items
      .filter(item => !keyword || normalize(getLabel(item)).includes(keyword) || normalize(getMeta(item)).includes(keyword))
      .sort((a, b) => {
        const aLabel = normalize(getLabel(a))
        const bLabel = normalize(getLabel(b))
        return Number(bLabel.startsWith(keyword)) - Number(aLabel.startsWith(keyword))
          || getLabel(a).localeCompare(getLabel(b), 'ko-KR', { sensitivity: 'base' })
      })
      .slice(0, maxResults)
  }, [getLabel, getMeta, items, maxResults, value])

  function choose(item) {
    onChange(getLabel(item))
    onSelect?.(item)
    setOpen(false)
  }

  return <div className="search-suggestion-input">
    <div className="search-suggestion-control">
      <MagnifyingGlass aria-hidden="true" />
      <input
        value={value}
        onChange={event => { onChange(event.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        placeholder={placeholder}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
      />
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => setOpen(current => !current)} aria-label="검색 목록 열기" title="검색 목록 열기"><CaretDown /></button>
    </div>
    {open && <div className="search-suggestion-menu" id={`${id}-options`} role="listbox">
      <header><b>가나다순 검색 결과</b><span>{matches.length}개 표시</span></header>
      {matches.length ? matches.map(item => <button type="button" role="option" key={item.id || getLabel(item)} onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}>
        <b>{getLabel(item)}</b>{getMeta(item) && <span>{getMeta(item)}</span>}
      </button>) : <p>{emptyText}</p>}
    </div>}
  </div>
}
