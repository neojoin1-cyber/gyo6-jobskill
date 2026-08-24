/**
 * SchoolTextbookScreen — 학교관리자 '교재' 탭: [📖 교재보기 | 🗂️ 교재배정]
 * 보기: 학교에 배정된 교재(school_subjects)를 완전교재 리더로 열람. (없으면 전체 표시)
 * 배정: 학급/학생 교재 배정(SchoolSubjectAssignScreen).
 */
import { useState, lazy, Suspense } from 'react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import SchoolSubjectAssignScreen from './SchoolSubjectAssignScreen.jsx'
import { lazyChunk } from '../../lib/lazyChunk.js'

const CourseListScreen = lazyChunk(() => import('../student/CourseListScreen.jsx'), 'CourseListScreen')

export default function SchoolTextbookScreen() {
  const { profile } = useAuth()
  const [view, setView] = useState('read')       // 'read' | 'assign'

  // 학교에 배정된 교재만 열람(미배정=전체)
  async function resolveSchoolSubjects() {
    try {
      const { data } = await supabase.from('school_subjects').select('subject_id').eq('school_id', profile.school_id)
      const ids = (data ?? []).map(r => r.subject_id)
      return ids.length ? new Set(ids) : null
    } catch { return null }
  }

  return (
    <div className="screen-body" style={{ paddingTop: 0 }}>
      <div style={{ display: 'flex', gap: 8, margin: '10px 0 14px' }}>
        {[['read', '📖 교재보기'], ['assign', '🗂️ 교재배정']].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              background: view === v ? 'var(--primary)' : 'var(--card)', color: view === v ? '#fff' : 'var(--text)',
              border: `1.5px solid ${view === v ? 'var(--primary)' : 'var(--border)'}` }}>
            {label}
          </button>
        ))}
      </div>

      {view === 'assign' ? <SchoolSubjectAssignScreen /> : (
        <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
          {/* 학생과 동일한 완전교재 화면을 학교 배정 교재로 필터해 열람 */}
          <CourseListScreen resolveSubjects={resolveSchoolSubjects} hideAppbar />
        </Suspense>
      )}
    </div>
  )
}
