/**
 * scripts/verify-extraction.js
 *
 * data/questions.json 이 data/source/textbook.html 의 실제 내용과 맞는지
 * "자기보고"가 아니라 원본을 다시 세어 직접 대조한다 (CLAUDE.md 절대 규칙 #3, #4).
 *
 * 검증 항목:
 *  1) 원본의 <details class="answer-details"> 개수 == questions.json 항목 수
 *     (※ 기획서의 자기점검 질문은 "<h4> 개수와 비교"였지만, 이 교재는 <h4>가
 *        문항 단위가 아니라 "핵심 개념" 같은 학습 섹션 제목에도 쓰여서 1:1 대응이
 *        아니다. <details class="answer-details"> 가 문항 1개당 정확히 1개씩
 *        생기는 실제 구조이므로 이걸 기준으로 비교한다.)
 *  2) id 중복 없음
 *  3) lessonId/area/level 누락 없음
 *  4) needsManualReview=false 인 항목은 전부 answer(A~E) + choices(4개 이상) 보유
 *  5) area별/level별/sourceFormat별 분포 출력 (육안 대조용)
 *  6) needsManualReview 항목 전체 목록 + 이유 출력 (수동 확인용)
 *  7) area 하드코딩 검사: extract-questions.js 안에 실제 영역명을 하드코딩한
 *     흔적이 있는지 간단히 grep (재사용성 검증, CLAUDE.md 규칙 #5)
 */

const fs = require('fs');
const path = require('path');

const SRC_PATH = path.join(__dirname, '..', 'data', 'source', 'textbook.html');
const QUESTIONS_PATH = path.join(__dirname, '..', 'data', 'questions.json');
const EXTRACT_SCRIPT_PATH = path.join(__dirname, 'extract-questions.js');

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`[OK]   ${msg}`);
}

function main() {
  if (!fs.existsSync(SRC_PATH)) {
    fail(`원본 파일 없음: ${SRC_PATH}`);
    return;
  }
  if (!fs.existsSync(QUESTIONS_PATH)) {
    fail(`questions.json 없음. 먼저 node scripts/extract-questions.js 를 실행하세요.`);
    return;
  }

  const html = fs.readFileSync(SRC_PATH, 'utf-8');
  const questions = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf-8'));

  // ---- 1) 원본 개수와 직접 대조 ----
  // 원본에는 "정답 및 해설" 바로 뒤에 같은 선택지를 다시 참조하는 "풀이 과정 보기"가
  // 붙어 별개 문항처럼 보이는 경우가 2건 있다 (C37-36, C39-39). 이건 새 문항이 아니라
  // 직전 문항의 보충 설명이므로 extract-questions.js가 병합하고 supplementaryNote로
  // 붙여놓는다. 따라서 "원본 details 개수 == 문항 수 + 병합된 보충설명 개수" 가 맞다.
  const detailsCountInSource = (html.match(/<details class="answer-details">/g) || []).length;
  const mergedCount = questions.filter((q) => q.supplementaryNote).length;
  if (detailsCountInSource === questions.length + mergedCount) {
    ok(
      `원본 <details class="answer-details"> 개수(${detailsCountInSource}) == 문항 수(${questions.length}) + 병합된 보충설명(${mergedCount})`
    );
  } else {
    fail(
      `개수 불일치: 원본=${detailsCountInSource}, questions.json=${questions.length} + 병합=${mergedCount} (합계 ${
        questions.length + mergedCount
      })`
    );
  }

  // ---- 2) id 중복 검사 ----
  const idCounts = {};
  for (const q of questions) idCounts[q.id] = (idCounts[q.id] || 0) + 1;
  const dupes = Object.entries(idCounts).filter(([, c]) => c > 1);
  if (dupes.length === 0) {
    ok('id 중복 없음');
  } else {
    fail(`중복 id 발견: ${dupes.map(([id, c]) => `${id}(${c}회)`).join(', ')}`);
  }

  // ---- 3) 필수 필드 누락 검사 ----
  const missingMeta = questions.filter((q) => !q.lessonId || !q.area || !q.level);
  if (missingMeta.length === 0) {
    ok('모든 문항에 lessonId/area/level 존재');
  } else {
    fail(`lessonId/area/level 누락 문항 ${missingMeta.length}개: ${missingMeta.map((q) => q.id).join(', ')}`);
  }

  // ---- 4) 실제로 퀴즈에 쓸 수 있는 문항(excludeFromQuiz=false)의 answer/choices 완전성 ----
  const usableQuestions = questions.filter((q) => !q.excludeFromQuiz);
  const broken = usableQuestions.filter(
    (q) => !['A', 'B', 'C', 'D', 'E'].includes(q.answer) || !q.choices || q.choices.length < 4
  );
  if (broken.length === 0) {
    ok(`excludeFromQuiz=false 인 ${usableQuestions.length}개 문항 모두 answer(A~E) + choices(4개 이상) 보유`);
  } else {
    fail(
      `excludeFromQuiz=false 인데 answer/choices가 불완전한 문항 ${broken.length}개: ${broken
        .map((q) => q.id)
        .join(', ')}`
    );
  }

  // ---- 5) 분포 출력 ----
  function distribution(key) {
    const d = {};
    for (const q of questions) {
      const v = q[key] === null || q[key] === undefined ? '(null)' : q[key];
      d[v] = (d[v] || 0) + 1;
    }
    return d;
  }
  console.log('\n--- area 분포 (영역 9개 — 자기개발능력 포함) ---');
  console.log(distribution('area'));
  console.log('\n--- level 분포 ---');
  console.log(distribution('level'));
  console.log('\n--- sourceFormat 분포 ---');
  console.log(distribution('sourceFormat'));
  console.log('\n--- isAGrade 분포 ---');
  console.log(distribution('isAGrade'));

  const choiceLenDist = {};
  for (const q of questions) {
    const n = q.choices ? q.choices.length : 0;
    choiceLenDist[n] = (choiceLenDist[n] || 0) + 1;
  }
  console.log('\n--- 선택지 개수 분포 (4개=원본에 5번째 선택지가 없는 정상 문항, 0=수동확인 필요) ---');
  console.log(choiceLenDist);

  // ---- 6) 투명성 목록: 추론된 정답 / 퀴즈 제외 항목 ----
  const inferred = questions.filter((q) => q.answerSource === 'inferred_from_explanation');
  const excluded = questions.filter((q) => q.excludeFromQuiz);
  console.log(`\n--- 분석으로 정답을 추론한 문항 (${inferred.length}개, 원본에 정답 글자 없음) ---`);
  for (const q of inferred) {
    console.log(`  ${q.id} [${q.area} / ${q.lessonTitle}] answer=${q.answer}`);
    console.log(`    근거: ${q.reviewReason}`);
  }
  console.log(`\n--- 퀴즈에서 제외 권장 문항 (${excluded.length}개, 원본에서 복구 불가) ---`);
  for (const q of excluded) {
    console.log(`  ${q.id} [${q.area} / ${q.lessonTitle}]`);
    console.log(`    stem: ${q.stem.slice(0, 80)}${q.stem.length > 80 ? '...' : ''}`);
    console.log(`    이유: ${q.reviewReason}`);
  }

  // ---- 7) area/lesson 하드코딩 여부 간단 검사 ----
  const extractSrc = fs.readFileSync(EXTRACT_SCRIPT_PATH, 'utf-8');
  const knownAreas = [
    '의사소통능력', '수리능력', '문제해결능력', '자기개발능력',
    '자원관리능력', '정보능력', '기술능력', '조직이해능력', '직업윤리',
  ];
  const hardcoded = knownAreas.filter((a) => extractSrc.includes(a));
  if (hardcoded.length === 0) {
    ok('extract-questions.js 안에 영역명 하드코딩 없음 (data-category 속성으로만 읽음 - 재사용 가능)');
  } else {
    fail(`extract-questions.js 안에 영역명이 하드코딩되어 있음: ${hardcoded.join(', ')}`);
  }

  console.log('\n=== 검증 완료 ===');
  if (process.exitCode === 1) {
    console.log('일부 항목이 FAIL 입니다. 위 내용을 확인하세요.');
  } else {
    console.log(
      `퀴즈 사용 가능 ${usableQuestions.length}개 (그중 분석 추론 ${inferred.length}개) + 제외 권장 ${excluded.length}개 = 총 ${questions.length}개. 구조적 문제 없음.`
    );
  }
}

main();
