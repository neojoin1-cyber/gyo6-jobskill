/**
 * scripts/extract-questions.js
 *
 * data/source/textbook.html (원본 교재, 읽기 전용) 에서 문항을 추출하여
 * data/questions.json 으로 저장한다.
 *
 * 절대 규칙(CLAUDE.md):
 *  - data/source/textbook.html 은 절대 수정하지 않는다.
 *  - 정답/해설 텍스트를 추측하지 않는다. 추출 불가능한 항목은
 *    needsManualReview=true 로 표시하고 answer/choices를 비워둔다.
 *
 * 처리하는 원본 문항 형식 3가지:
 *  1) inline_p              : <p>A. ..</p>~<p>E. ..</p> 형태로 선택지가 개별 <p>로 존재
 *  2) ordered_list           : "A등급 심화 학습 문제" - <ol class="advanced-choice-list"><li>..</li></ol>
 *  3) inline_bundled_paragraph: "행동 후보: A. .. B. .. C. .. D. .. E. .." 처럼 한 <p> 안에
 *                               선택지가 모두 들어있는 경우. 이 경우 원본에는 그 아래
 *                               <p>A. A</p><p>B. B</p>... 같은 깨진 표시용 선택지가 같이
 *                               있는 경우가 있는데(원본 생성 버그), 그건 무시하고 실제
 *                               텍스트가 들어있는 문단에서 다시 파싱한다.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const SRC_PATH = path.join(__dirname, '..', 'data', 'source', 'textbook.html');
const OUT_PATH = path.join(__dirname, '..', 'data', 'questions.json');
const OVERRIDES_PATH = path.join(__dirname, '..', 'data', 'manual-answer-overrides.json');

const CHOICE_LINE_RE = /^([A-E])[.)]\s*([\s\S]*)$/;
const INLINE_CHOICE_RE = /([A-E])[.)]\s*(.+?)(?=\s[A-E][.)]\s|$)/g;
const INLINE_PAREN_CHOICE_RE = /([A-E])\(([^)]+)\)/g;

function isPlaceholder(choices) {
  if (!choices || !choices.length) return false;
  const letters = ['A', 'B', 'C', 'D', 'E'];
  return choices.every((c, i) => c === letters[i]);
}

function extractInlineChoices(text) {
  let matches = [...text.matchAll(INLINE_CHOICE_RE)];
  if (matches.length < 2) {
    matches = [...text.matchAll(INLINE_PAREN_CHOICE_RE)];
  }
  if (matches.length < 2) return null;
  const expected = ['A', 'B', 'C', 'D', 'E'];
  const out = [];
  for (const m of matches) {
    const letter = m[1];
    if (letter !== expected[out.length]) return null;
    out.push(m[2].trim());
    if (out.length >= 5) break;
  }
  if (out.length < 4) return null;
  return out;
}

function run() {
  if (!fs.existsSync(SRC_PATH)) {
    console.error(`[FATAL] 원본 교재 파일을 찾을 수 없습니다: ${SRC_PATH}`);
    process.exit(1);
  }
  const html = fs.readFileSync(SRC_PATH, 'utf-8');
  const $ = cheerio.load(html);

  let overridesMap = {};
  if (fs.existsSync(OVERRIDES_PATH)) {
    const overridesData = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8'));
    for (const o of overridesData.overrides || []) overridesMap[o.id] = o;
  }

  function textWithSpaces($el) {
    const parts = [];
    $el.contents().each((_, node) => {
      if (node.type === 'text') {
        parts.push(node.data);
      } else if (node.type === 'tag') {
        parts.push(textWithSpaces($(node)));
      }
    });
    return parts.join(' ');
  }

  function cleanText(elOrStr) {
    let txt;
    if (typeof elOrStr === 'string') {
      txt = elOrStr;
    } else {
      txt = textWithSpaces(elOrStr);
    }
    return txt.replace(/\s+/g, ' ').trim();
  }

  const questions = [];
  const issues = [];

  const lessons = $('article.lesson').toArray();

  for (const lessonEl of lessons) {
    const $lesson = $(lessonEl);
    const lessonId = $lesson.attr('id');
    const area = $lesson.attr('data-category');
    const lessonLevel = $lesson.attr('data-level');
    const lessonTitle = $lesson.attr('data-title');

    const detailsList = $lesson.find('details.answer-details').toArray();
    let qCounter = 0;

    for (const detEl of detailsList) {
      const $det = $(detEl);

      // ---- 중복 보충설명 감지: 바로 앞 형제가 또 다른 answer-details 라면
      // (원본에 "정답 및 해설" 다음 곧바로 "풀이 과정 보기"가 같은 선택지를 다시
      //  참조하는 경우가 있다 - 별개 문항이 아니라 직전 문항의 보충 설명이다.
      //  새 문항으로 만들지 않고 직전 문항에 합친다.)
      const prevSibling = $det.prev();
      if (prevSibling.length && prevSibling.is('details.answer-details') && questions.length) {
        const supplementaryParts = [];
        $det.children().each((_, c) => {
          if (c.tagName !== 'summary') supplementaryParts.push(cleanText($(c)));
        });
        const lastQ = questions[questions.length - 1];
        if (lastQ.lessonId === lessonId) {
          lastQ.supplementaryNote = supplementaryParts.join(' ').trim();
          continue;
        }
      }

      qCounter += 1;
      const qid = `${lessonId}-Q${String(qCounter).padStart(2, '0')}`;

      const $summary = $det.find('summary').first();
      const summaryText = $summary.length ? cleanText($summary) : '';

      const bodyParts = [];
      $det.children().each((_, c) => {
        if (c.tagName !== 'summary') bodyParts.push(cleanText($(c)));
      });
      const fullBodyText = bodyParts.join(' ');

      let answerLetter = null;
      let explanation = fullBodyText;
      const am = fullBodyText.match(/정답\s*(?:및\s*해설)?\s*[:：]\s*([A-E])\b\.?\s*/);
      if (am) {
        answerLetter = am[1];
        explanation = fullBodyText.slice(am.index + am[0].length).trim();
      } else {
        issues.push({ qid, issue: 'NO_ANSWER_LETTER_FOUND', raw: fullBodyText.slice(0, 200) });
      }

      // ---- Strategy A: advanced-challenge ordered list ----
      let choices = [];
      let choiceFormat = null;
      let foundOl = null;
      {
        let prevEl = $det.prev();
        let depth = 0;
        while (prevEl.length && depth < 8) {
          if (prevEl.is('ol.advanced-choice-list')) {
            foundOl = prevEl;
            break;
          }
          const innerOl = prevEl.find('ol.advanced-choice-list').first();
          if (innerOl.length) {
            foundOl = innerOl;
            break;
          }
          prevEl = prevEl.prev();
          depth += 1;
        }
      }

      if (foundOl) {
        choiceFormat = 'ordered_list';
        foundOl.children('li').each((_, li) => choices.push(cleanText($(li))));
      } else {
        // ---- Strategy B: contiguous <p> siblings matching A-E pattern ----
        const collected = {};
        let prevEl = $det.prev();
        let steps = 0;
        while (prevEl.length && steps < 30) {
          if (prevEl.is('p')) {
            const txt = cleanText(prevEl);
            const cm = txt.match(CHOICE_LINE_RE);
            if (cm) {
              collected[cm[1]] = cm[2].trim();
            } else if (Object.keys(collected).length) {
              break;
            }
          }
          prevEl = prevEl.prev();
          steps += 1;
        }
        if (Object.keys(collected).length) {
          choiceFormat = 'inline_p';
          for (const letter of ['A', 'B', 'C', 'D', 'E']) {
            if (collected[letter] !== undefined) choices.push(collected[letter]);
          }
        }
      }

      // ---- Strategy C: fallback for missing/placeholder choices ----
      // (handles the "행동 후보: A. .. E. .." bundled-paragraph format, and skips past
      //  any broken placeholder <p>A. A</p> choices and any intervening "문제. ...?" line)
      let usedFallbackLabelEl = null;
      if (!choices.length || isPlaceholder(choices)) {
        let prevEl = $det.prev();
        let steps = 0;
        while (prevEl.length && steps < 30) {
          if (prevEl.is('details')) break;
          if (prevEl.is('p')) {
            const txt = cleanText(prevEl);
            if (CHOICE_LINE_RE.test(txt)) {
              prevEl = prevEl.prev();
              steps += 1;
              continue;
            }
            const inline = extractInlineChoices(txt);
            if (inline) {
              choices = inline;
              choiceFormat = 'inline_bundled_paragraph';
              usedFallbackLabelEl = prevEl;
              break;
            }
          }
          prevEl = prevEl.prev();
          steps += 1;
        }
      }

      if (!choices.length) {
        issues.push({ qid, issue: 'NO_CHOICES_FOUND', raw: fullBodyText.slice(0, 150) });
      }

      // ---- stem (+ teachingNote for advanced-challenge) ----
      let stemParts = [];
      let teachingNote = null;

      if (choiceFormat === 'inline_p') {
        let prevEl = $det.prev();
        let skipSteps = 0;
        while (prevEl.length && skipSteps < 30) {
          if (prevEl.is('p') && CHOICE_LINE_RE.test(cleanText(prevEl))) {
            prevEl = prevEl.prev();
            skipSteps += 1;
            continue;
          }
          break;
        }
        let steps = 0;
        while (prevEl.length && steps < 40) {
          if (prevEl.is('details')) break;
          stemParts.push(cleanText(prevEl));
          prevEl = prevEl.prev();
          steps += 1;
        }
        stemParts.reverse();
      } else if (choiceFormat === 'ordered_list') {
        const acDiv = foundOl.closest('div.advanced-challenge');
        if (acDiv.length) {
          acDiv.children('p').each((_, p) => {
            const $p = $(p);
            const $strong = $p.find('strong').first();
            const label = $strong.length ? cleanText($strong) : '';
            const full = cleanText($p);
            const bodyOnly = label && full.startsWith(label) ? full.slice(label.length).trim() : full;
            if (label === '심화 포인트') teachingNote = bodyOnly;
            else if (label === '문제') stemParts = [bodyOnly];
          });
        }
        if (!stemParts.length) {
          let prevEl = foundOl.prev();
          let steps = 0;
          while (prevEl.length && steps < 40) {
            if (prevEl.is('details')) break;
            stemParts.push(cleanText(prevEl));
            prevEl = prevEl.prev();
            steps += 1;
          }
          stemParts.reverse();
        }
      } else if (choiceFormat === 'inline_bundled_paragraph') {
        let prevEl = $det.prev();
        let steps = 0;
        let passedLabel = false;
        const labelNode = usedFallbackLabelEl ? usedFallbackLabelEl.get(0) : null;
        while (prevEl.length && steps < 40) {
          if (prevEl.is('details')) break;
          if (labelNode && prevEl.get(0) === labelNode) {
            passedLabel = true;
            prevEl = prevEl.prev();
            steps += 1;
            continue;
          }
          if (!passedLabel) {
            if (prevEl.is('p') && CHOICE_LINE_RE.test(cleanText(prevEl))) {
              prevEl = prevEl.prev();
              steps += 1;
              continue;
            }
          }
          stemParts.push(cleanText(prevEl));
          prevEl = prevEl.prev();
          steps += 1;
        }
        stemParts.reverse();
      }

      let stem = stemParts.filter(Boolean).join(' ');
      stem = stem.replace(/^(\[[^\]]+\]\s*)+/, '').trim();

      let qLevel = lessonLevel;
      if (summaryText === '풀이 과정 보기' || choiceFormat === 'ordered_list') qLevel = '심화';

      let answerSource = answerLetter ? 'explicit' : 'unresolved';
      let reviewReason = null;
      let excludeFromQuiz = false;

      const override = overridesMap[qid];
      if (!answerLetter && override) {
        answerLetter = override.answer;
        explanation = explanation || '';
        answerSource = 'inferred_from_explanation';
        reviewReason = `정답 글자가 원본에 없어 분석으로 추론함: ${override.reasoning}`;
      } else if (!answerLetter) {
        reviewReason = '원본에 정답 글자(A~E)가 없고, 분석으로도 단정할 근거가 부족함 (해결과정 서술만 존재).';
        excludeFromQuiz = true;
      }

      if (!choices.length) {
        reviewReason = (reviewReason ? reviewReason + ' ' : '') + '원본에 선택지 자체가 없음 (서술형/토론형 콘텐츠로 추정).';
        excludeFromQuiz = true;
      } else if (isPlaceholder(choices)) {
        reviewReason =
          (reviewReason ? reviewReason + ' ' : '') +
          '선택지가 깨진 placeholder(A,B,C,D,E 글자뿐)이고 실제 선택지 텍스트를 원본에서 복구할 수 없음 (중복/고아 문항으로 추정).';
        excludeFromQuiz = true;
      }

      const needsManualReview = answerSource !== 'explicit' || excludeFromQuiz;

      questions.push({
        id: qid,
        lessonId,
        area,
        lessonTitle,
        level: qLevel,
        stem,
        choices,
        answer: answerLetter,
        explanation,
        teachingNote: choiceFormat === 'ordered_list' ? teachingNote : null,
        supplementaryNote: null,
        mistakePattern: null, // 원본에 오답 패턴 분류 정보가 없음 (사용자 확인됨, 추후 별도 작업)
        isAGrade: choiceFormat === 'ordered_list',
        sourceFormat: choiceFormat,
        answerSource,
        needsManualReview,
        reviewReason,
        excludeFromQuiz,
      });
    }
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(questions, null, 2), 'utf-8');

  console.log(`총 ${questions.length}개 문항을 추출했습니다 -> ${path.relative(process.cwd(), OUT_PATH)}`);

  const inferred = questions.filter((q) => q.answerSource === 'inferred_from_explanation');
  const excluded = questions.filter((q) => q.excludeFromQuiz);
  const explicit = questions.filter((q) => q.answerSource === 'explicit');

  console.log(`  - 원본에 정답이 명시됨(explicit): ${explicit.length}개`);
  console.log(`  - 분석으로 정답 추론함(inferred_from_explanation): ${inferred.length}개`);
  for (const q of inferred) console.log(`      ${q.id}: answer=${q.answer} (${q.reviewReason})`);
  console.log(`  - 퀴즈에서 제외 권장(excludeFromQuiz): ${excluded.length}개`);
  for (const q of excluded) console.log(`      ${q.id}: ${q.reviewReason}`);

  if (issues.length) {
    console.log(`\n[참고] 파싱 1차 통과 시 발견된 이슈 ${issues.length}건 (이후 오버라이드/제외 처리로 해소됨):`);
    for (const i of issues) console.log(`  - ${i.qid}: ${i.issue}`);
  }
}

run();
