const SECTION_LABELS = [
  '프로젝트명', 'PM', '승인 체계', '회의 결정', '추가 변수',
  '현황', '대안 검토 결과', '추가 조건', '개발 단계별 정보',
  '불량률 현황', '주요 불량 원인', '개선 조치사항', '팀장 의견',
  '제목', '일시', '사유', '조치사항', '문의',
  '접수일시', '고객명', '불만내용', '처리기한', '담당자',
]

const SECTION_PATTERN = new RegExp(
  '((?:' + [...SECTION_LABELS].sort((left, right) => right.length - left.length).join('|') + '))\\s*([:：])[ \\t]*',
  'g',
)

/**
 * 원천 문항에서 합쳐진 표제·단계·항목을 사람이 읽을 수 있는 행으로 복원한다.
 * 계산식의 빼기 기호와 날짜 범위는 건드리지 않고, 문서 구조 표지만 줄바꿈한다.
 */
export function formatStructuredLearningText(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*(【[^】]+】)\s*(?=\S)/g, '\n$1\n')
    .replace(/\s*([■●◆])\s*/g, '\n$1 ')
    .replace(/\s*·\s*(?=(?:개발 단계별 정보|현황|조건|자료)\s*[:：])/g, '\n')
    .replace(/\s*[–—]\s*(?=[가-힣A-Za-z0-9“"'])/g, '\n- ')
    .replace(/\s+-\s+(?=(?:제안서|예산|검토|즉시|장기|대상|일정|방법|적용|근무|확정|검토 중|예정))/g, '\n- ')
    .replace(SECTION_PATTERN, '\n$1$2 ')
    .replace(/\s+(?=[A-Z가-힣]+팀원은\s)/g, '\n')
    .replace(/([.!?])\s*(?=(?:[A-Z가-힣]+팀원은|다음은\s|참고로\s))/g, '$1\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function formatReadableScenario(value) {
  return formatStructuredLearningText(value)
    .replace(/\s*•\s*/g, '\n• ')
    // 숫자 앞 마침표는 날짜·소수점일 수 있으므로 문장 경계로 취급하지 않는다.
    .replace(/([.!?~])(?=[가-힣A-Za-z【[])/g, '$1\n')
    .replace(/,(?=(?:아래|다음|단,|그리고|하지만|반면))/g, ',\n')
    .replace(/\^\^(?=[가-힣A-Za-z])/g, '^^\n')
    .trim()
}
