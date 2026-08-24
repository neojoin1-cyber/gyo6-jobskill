import interviewQuiz from '../../data/interview-quiz.json'
import interviewStudy from '../../data/interview-study.json'
import personalityBank from '../../data/personality-test-bank.json'
import { INTERVIEW_FOUNDATION_COURSES } from './interviewFoundationCourses.js'

export const PERSONALITY_CHOICES = [
  '전혀 그렇지 않다',
  '그렇지 않은 편이다',
  '보통이다',
  '그런 편이다',
  '매우 그렇다',
]

export const INTERVIEW_QUESTIONS = (interviewQuiz.questions ?? []).map(question => ({
  ...question,
  type: question.type === 'choice' ? 'mcq' : (question.type ?? 'mcq'),
  questionMode: question.questionMode ?? 'mcq',
  area: question.category,
}))

export const PERSONALITY_QUESTIONS = (personalityBank.items ?? [])
  .filter(item => item.kind === 'trait')
  .map(item => ({
    id: item.id,
    stem: item.text,
    choices: PERSONALITY_CHOICES,
    type: 'survey',
    questionMode: 'survey',
    area: item.dim,
    lessonId: item.dim,
    dimension: item.dim,
    reverse: item.reverse,
  }))

const interviewLessons = interviewStudy.lessons ?? []
const dimensionByKey = Object.fromEntries((personalityBank.dimensions ?? []).map(item => [item.key, item]))

export const INTERVIEW_AREAS = INTERVIEW_FOUNDATION_COURSES
  .map(course => {
    const lessons = interviewLessons
      .filter(lesson => course.categories.includes(lesson.category))
      .map(lesson => ({
        id: lesson.id,
        label: lesson.title,
        title: lesson.title,
        questionIds: INTERVIEW_QUESTIONS.filter(question => question.lessonId === lesson.id).map(question => question.id),
      }))
      .filter(lesson => lesson.questionIds.length > 0)
    const questionIds = lessons.flatMap(lesson => lesson.questionIds)
    return {
      id: course.id,
      label: course.label,
      displayName: course.label,
      description: course.description,
      lessons,
      questionIds,
      totalQuestions: questionIds.length,
    }
  })
  .filter(area => area.totalQuestions > 0)

export const PERSONALITY_AREAS = (personalityBank.dimensions ?? []).map(dimension => {
  const questionIds = PERSONALITY_QUESTIONS
    .filter(question => question.dimension === dimension.key)
    .map(question => question.id)
  return {
    id: dimension.key,
    label: `${dimension.name} · ${dimension.short}`,
    displayName: dimension.name,
    description: dimension.short,
    lessons: [],
    questionIds,
    totalQuestions: questionIds.length,
  }
})

export const PERSONALITY_CLASSROOM_AREAS = [{
  id: 'personality-reflection',
  label: '인성검사 응답 성찰',
  lessons: PERSONALITY_AREAS.map(area => ({
    id: area.id,
    label: area.label,
  })),
}]

export function guidedQuestionIds(subjectId, selectedAreas, selectedLessons) {
  const areas = subjectId === 'interview' ? INTERVIEW_AREAS : PERSONALITY_AREAS
  return areas.flatMap(area => {
    if (selectedAreas.includes(area.id)) return area.questionIds
    return area.lessons
      .filter(lesson => selectedLessons.includes(lesson.id))
      .flatMap(lesson => lesson.questionIds)
  })
}

export function guidedLessonMatches(question, subjectId, lessonId) {
  if (subjectId === 'interview') return question.lessonId === lessonId
  if (subjectId === 'personality') return question.dimension === lessonId
  return false
}

export function personalityDimensionLabel(key) {
  const dimension = dimensionByKey[key]
  return dimension ? `${dimension.name} · ${dimension.short}` : key
}
