import { createContext, useContext, useEffect, useState } from 'react'

const ThemeCtx = createContext(null)

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('gyo6.theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('gyo6.theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <ThemeCtx.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() { return useContext(ThemeCtx) }

export function ThemeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={dark ? '라이트 모드로' : '다크 모드로'}
      style={{
        background: 'rgba(255,255,255,0.15)',
        border: 'none', cursor: 'pointer',
        borderRadius: 8, padding: '4px 8px',
        fontSize: 17, lineHeight: 1,
        color: '#fff',
      }}>
      {dark ? '☀️' : '🌙'}
    </button>
  )
}
