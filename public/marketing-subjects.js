(function defineMarketingSubjects(scope) {
  const subjects = [
    { icon: '🏅', name: '교육부 직업공통능력 인증', desc: '교육부 주관·대한상의 시행 · 5개 인증영역' },
    { icon: '📖', name: 'NCS 직업기초능력 26v1', desc: '고용노동부·한국산업인력공단 · 7영역 21하위능력' },
    { icon: '📝', name: '채용 필기시험 실전확장', desc: '공공기관·금융권·대기업 3개 트랙' },
    { icon: '🎤', name: '고졸 공정채용 면접 ＆ 자기소개서', desc: 'NCS 능력중심·블라인드·구조화 면접 · 12주제' },
    { icon: '🧭', name: '인성검사', desc: '정답 없는 모의검사 · 결과 분석' },
  ]

  scope.SUGAR_SALT_MARKETING_SUBJECTS = Object.freeze(
    subjects.map(subject => Object.freeze(subject)),
  )
})(globalThis)
