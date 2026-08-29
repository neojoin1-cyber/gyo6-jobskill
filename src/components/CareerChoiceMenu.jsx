import { useEffect, useId, useRef, useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'

export default function CareerChoiceMenu({ label, hint = '', value, options, onChange, ariaLabel = label, className = '' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const listboxId = useId()
  const selected = options.find(option => option.id === value)

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`account-field account-choice-field${className ? ` ${className}` : ''}`}>
      <span>{label}{hint && <small>{hint}</small>}</span>
      <button
        type="button"
        className="account-choice-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen(current => !current)}
      >
        <b>{selected?.label || '선택하세요'}</b>
        <CaretDown />
      </button>
      {open && (
        <div id={listboxId} className="account-choice-options" role="listbox" aria-label={ariaLabel}>
          {options.map(option => (
            <button
              type="button"
              role="option"
              aria-selected={option.id === value}
              className={option.id === value ? 'is-selected' : ''}
              key={option.id}
              onClick={() => { onChange(option.id); setOpen(false) }}
            >
              <span>{option.label}{option.description && <small>{option.description}</small>}</span>
              {option.id === value && <Check weight="bold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
