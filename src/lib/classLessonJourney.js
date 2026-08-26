import { STUDENT_CAMPUS_HALLS } from './studentCampusRoutes.js'
import { getFirstClassLesson } from './firstClassLessons.js'

function focusContext(firstLesson, hallId) {
  return firstLesson ? {
    subject: hallId,
    mode: 'study',
    track: firstLesson.match?.trackId || null,
    area: firstLesson.match?.areaId || null,
    lesson: firstLesson.match?.lessonId || null,
    label: firstLesson.lessonTitle,
  } : { subject: hallId, mode: 'study' }
}

export function summarizeClassLessonJourney(rows = [], lessonRows = []) {
  const sessions = [...rows].sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0))
  const bySubject = Object.fromEntries(STUDENT_CAMPUS_HALLS.map(hall => [hall.id, []]))
  const progressBySubject = Object.fromEntries(STUDENT_CAMPUS_HALLS.map(hall => [hall.id, []]))

  for (const session of sessions) {
    const subject = session?.focus?.subject
    if (bySubject[subject]) bySubject[subject].push(session)
  }

  const recordedLessons = lessonRows.length ? lessonRows : sessions
    .filter(session => session?.focus?.subject && session?.focus?.lesson)
    .map(session => ({
      subject_id: session.focus.subject,
      area_id: session.focus.area || '',
      lesson_id: session.focus.lesson,
      last_focus: session.focus,
      updated_at: session.started_at,
      completed_at: session.focus.stage === 'end' ? session.started_at : null,
    }))

  for (const lesson of recordedLessons) {
    if (progressBySubject[lesson.subject_id]) progressBySubject[lesson.subject_id].push(lesson)
  }
  Object.values(progressBySubject).forEach(items => items.sort(
    (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0),
  ))

  const subjects = STUDENT_CAMPUS_HALLS.map(hall => {
    const subjectSessions = bySubject[hall.id]
    const latest = subjectSessions[0] || null
    const subjectLessons = progressBySubject[hall.id]
    const activeLesson = subjectLessons.find(item => !item.completed_at) || subjectLessons[0] || null
    const firstLesson = getFirstClassLesson(hall.id)
    const defaultContext = focusContext(firstLesson, hall.id)
    const context = activeLesson?.last_focus || latest?.focus || defaultContext
    const completedCount = subjectLessons.filter(item => item.completed_at).length
    const inProgressCount = subjectLessons.filter(item => !item.completed_at).length
    return {
      ...hall,
      sessionCount: subjectSessions.length,
      lessonCount: subjectLessons.length,
      completedCount,
      inProgressCount,
      latest,
      status: inProgressCount ? '진행 중' : subjectLessons.length ? '다음 수업' : '수업 전',
      lastLabel: activeLesson?.last_focus?.label || latest?.focus?.label || latest?.title || null,
      nextLabel: context?.label || firstLesson?.lessonTitle || '첫 단원 선택',
      context: { ...context, subject: hall.id, mode: context?.mode || 'study' },
    }
  })

  const latest = sessions.find(session => session?.focus?.subject) || null
  const activeProgress = Object.values(progressBySubject)
    .flat()
    .filter(item => !item.completed_at)
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))[0]
  const latestProgress = activeProgress || Object.values(progressBySubject)
    .flat()
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))[0]
  const nextSubject = latestProgress?.subject_id || latest?.focus?.subject || STUDENT_CAMPUS_HALLS[0].id
  const next = subjects.find(subject => subject.id === nextSubject) || subjects[0]
  return {
    totalSessions: sessions.length,
    touchedSubjects: subjects.filter(subject => subject.sessionCount > 0 || subject.lessonCount > 0).length,
    subjects,
    next,
  }
}

export function demoClassLessonJourney(classId) {
  const presets = {
    c1: [
      ['interview', '면접 이해와 전형 준비 · 면접시험 전체 개요 및 진단평가', 'interview-foundation', 'A01'],
      ['job-common', '의사소통 국어 · 업무 문서 이해', '의사소통 국어', 'C01-0'],
    ],
    c2: [
      ['ncs-basic', '의사소통능력 · 문서소통능력', '의사소통능력', '문서소통능력'],
    ],
    c3: [],
  }
  const sessions = (presets[classId] || []).map((item, index) => ({
    id: `${classId}-session-${index}`,
    started_at: new Date(Date.now() - index * 86400000).toISOString(),
    ended_at: new Date(Date.now() - index * 86400000 + 2700000).toISOString(),
    title: item[1],
    focus: { kind: 'learning', subject: item[0], mode: 'study', area: item[2], lesson: item[3], label: item[1] },
  }))
  const lessonRows = sessions.map((session, index) => ({
    subject_id: session.focus.subject,
    area_id: session.focus.area,
    lesson_id: session.focus.lesson,
    last_focus: session.focus,
    updated_at: session.started_at,
    completed_at: classId === 'c1' && index === 1 ? session.ended_at : null,
  }))
  return summarizeClassLessonJourney(sessions, lessonRows)
}
