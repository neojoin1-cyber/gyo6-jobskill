import { createContext, useContext, useEffect, useState } from 'react'
import { MoonStars, Sun } from '@phosphor-icons/react'

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
        borderRadius: 8, padding: '4px 10px',
        // 학생·교사·관리자 앱바에 공통으로 놓이는 버튼이다.
        // 25px 이던 것을 모바일 탭 기준 44px 로 맞춘다.
        minHeight: 44, minWidth: 44,
        display: 'inline-grid', placeItems: 'center',
        fontSize: 17, lineHeight: 1,
        color: '#fff',
      }}>
      {dark ? <Sun size={20} weight="fill" /> : <MoonStars size={20} weight="fill" />}
    </button>
  )
}
