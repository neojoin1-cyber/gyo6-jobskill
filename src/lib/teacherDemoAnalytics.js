const CLASS_STUDENTS = {
  c1: ['이수현', '박민준', '최유나', '정도윤', '김서연'],
  c2: ['윤지호', '한예린', '오승현', '임다은'],
  c3: ['강민서', '신도현', '배서윤', '조현우'],
}

const AREA_SETS = {
  c1: ['면접 질문 의도', '경험 근거', '답변 구조'],
  c2: ['문서 이해', '수리 활용', '문제 해결'],
  c3: ['직업 이해', '의사소통', '자기관리'],
}

function students(classId) {
  return CLASS_STUDENTS[classId] || CLASS_STUDENTS.c1
}

function areas(classId) {
  return AREA_SETS[classId] || AREA_SETS.c1
}

export function demoClassDiagnostics(classId) {
  const names = students(classId)
  const labels = areas(classId)
  return names.map((displayName, index) => {
    if (index === names.length - 1) {
      return { student_id: `${classId}-diagnostic-${index}`, display_name: displayName, score: null, total: null, area_scores: {} }
    }
    const scores = [8, 6, 4, 7, 5]
    const score = scores[index % scores.length]
    return {
      student_id: `${classId}-diagnostic-${index}`,
      display_name: displayName,
      score,
      total: 10,
      area_scores: Object.fromEntries(labels.map((label, areaIndex) => {
        const total = 4
        const correct = Math.max(1, Math.min(total, score - areaIndex - index + 1))
        return [label, { correct, total }]
      })),
    }
  })
}

export function demoClassWeakness(classId) {
  const labels = areas(classId)
  return {
    areas: labels.map((area, index) => ({
      course_id: classId === 'c1' ? 4 : 1,
      area,
      wrong_count: 12 - index * 3,
      student_count: Math.max(2, students(classId).length - index),
    })),
    students: students(classId).map((displayName, index) => ({
      student_id: `${classId}-weak-${index}`,
      display_name: displayName,
      open_count: Math.max(0, 6 - index * 2),
      top_area: labels[index % labels.length],
    })),
  }
}

export function demoClassProgress(classId) {
  const subjectIds = classId === 'c1'
    ? ['job-common', 'interview']
    : classId === 'c2'
      ? ['ncs-basic', 'recruit-written']
      : ['job-common', 'personality']
  const rows = students(classId).map((displayName, index) => {
    const base = Math.max(0, 78 - index * 17)
    const subjects = index === students(classId).length - 1 ? [] : subjectIds.map((subjectId, subjectIndex) => ({
      subject_id: subjectId,
      pct: Math.max(8, base - subjectIndex * 11),
      sections_done: Math.max(1, 6 - index - subjectIndex),
      sections_total: 8,
    }))
    return { student_id: `${classId}-progress-${index}`, display_name: displayName, subjects }
  })
  return {
    students: rows,
    subjects: subjectIds.map((subjectId, index) => ({
      subject_id: subjectId,
      avg_pct: Math.max(18, 61 - index * 13),
      learner_count: Math.max(1, rows.length - 1),
    })),
  }
}

export function demoClassPersonality(classId) {
  const dimensions = [
    ['responsibility', '책임성'],
    ['cooperation', '협업성'],
    ['integrity', '성실성'],
    ['adaptability', '적응성'],
    ['communication', '소통성'],
    ['self-control', '자기조절'],
  ]
  return students(classId).map((displayName, index) => ({
    student_id: `${classId}-personality-${index}`,
    display_name: displayName,
    mode: index % 2 ? 'quick' : 'full',
    paper_no: index % 2 ? null : 1,
    profile: index === students(classId).length - 1 ? [] : dimensions.map(([key, name], dimIndex) => ({
      key,
      name,
      score: 48 + ((index * 7 + dimIndex * 5) % 31),
    })),
    reliability: { consistency: 72 - index * 3, social: 68 - index * 2, reliable: index !== 2 },
  }))
}

export function demoClassResults(classId) {
  const mission = {
    id: `${classId}-mission-1`,
    title: classId === 'c1' ? '면접 답변 근거 점검' : classId === 'c2' ? 'NCS 문서 이해 확인' : '직업 이해 첫 진단',
    mission_type: 'formative',
    status: 'closed',
    question_count: 5,
  }
  return {
    missions: [mission],
    rankings: students(classId).slice(0, 4).map((displayName, index) => ({
      student_id: `${classId}-result-${index}`,
      display_name: displayName,
      rank_in_mission: index + 1,
      rank_in_class: index + 1,
      score: Math.max(2, 5 - index),
      total_questions: 5,
      pct: Math.max(40, 100 - index * 20),
      time_taken_sec: 185 + index * 34,
    })),
  }
}
