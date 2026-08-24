/**
 * TeacherTextbookScreen — 교사·학급관리자 교재 열람.
 * 학생과 동일한 완전교재 화면(CourseListScreen)을 배정 교재로 필터해 제공.
 * 열람 범위: rpc_my_viewable_subjects(학급관리자=학급 배정 교재, 교사=본인 배정 과목). 미배정=전체.
 */
import { Suspense } from 'react'
import { supabase } from '../../lib/supabase.js'
import { lazyChunk } from '../../lib/lazyChunk.js'

const CourseListScreen = lazyChunk(() => import('../student/CourseListScreen.jsx'), 'CourseListScreen')

async function resolveTeacherSubjects() {
  try {
    const { data, error } = await supabase.rpc('rpc_my_viewable_subjects')
    const arr = (!error && Array.isArray(data)) ? data : []
    return arr.length ? new Set(arr) : null   // 미배정 = 전체
  } catch { return null }
}

export default function TeacherTextbookScreen({ onBack }) {
  return (
    <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
      <CourseListScreen resolveSubjects={resolveTeacherSubjects} onBack={onBack} />
    </Suspense>
  )
}
