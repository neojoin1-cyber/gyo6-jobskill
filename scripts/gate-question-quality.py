#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
문항 품질 게이트 — 앱과 교사 자료에 나가기 전에 막는다.

### 왜 만들었나

객관식 830문항 중 74개가 **발문에 질문이 하나도 없는 상태**로 학생 화면과
교사 수업 덱에 나가 있었다. `stem` 자리에 차시 제목이나 지문 꼬리가 들어가
"무엇을 묻는지 알 수 없는 문항"이 되어 있었다.

문항 수·영역 균형·정답 분포는 검증해 놓고 **정작 문항이 질문인지는 아무도
확인하지 않았다.** 사용자가 교사 자료 화면을 보고 발견했다. 같은 일이
다시 일어나지 않게 자동으로 막는다.

### 검사 항목

1. 발문에 질문 표현이 있는가 (객관식만)
2. 정답이 보기 범위 안에 있는가
3. 보기가 중복되지 않는가
4. 해설이 있는가
5. 발문이 차시 제목과 똑같지 않은가
6. 발문이 제작용 안내("3단계: …")가 아닌가

### 쓰는 법

    python scripts/gate-question-quality.py            # 실패 시 종료코드 1
    python scripts/gate-question-quality.py --report   # 위반 전부 출력

검사 대상은 **앱 소스가 실제로 import 하는** data/**/*.json 이다. 자동으로 찾으므로
파일이 늘어도 손댈 필요가 없다.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

def discover_banks() -> list[Path]:
    """앱 소스가 실제로 import 하는 data/**/*.json 을 찾아낸다.

    목록을 손으로 적었더니 앱이 쓰는 23개 중 9개만 검사하고 있었다.
    발문이 깨진 문항이 검사 밖 파일(ncs-extracted-bank.json)에 그대로 남아
    학생 화면에 나갔다. 소스에서 뽑으면 파일이 늘어도 저절로 따라온다.
    """
    names = set()
    for src in (ROOT / "src").rglob("*.js*"):
        for m in re.finditer(r"from\s+'[^']*?/data/([A-Za-z0-9._/-]+\.json)'", src.read_text(encoding="utf-8", errors="ignore")):
            names.add(m.group(1))
    return sorted(DATA / n for n in names if (DATA / n).exists())


# 발문 어디든 이 표현이 있으면 질문으로 인정한다.
# 끝만 검사하면 "…고른 것은? ①규칙 ②유연" 같은 정상 문항을 파손으로 잡는다.
Q_ANY = re.compile(
    r"(\?|것은|것을|무엇|어느|고르|하는가|인가|알맞은|적절한|옳은|옳지"
    r"|쓰시오|하시오|골라|구하면|얼마|몇|것인가|바르게|틀린|까요|나요"
    # 명령형 발문도 질문이다 — "…순서를 결정하라", "…을 선택하시오"
    r"|결정하라|선택하시오|정하시오|서술하시오)"
)
GUIDE = re.compile(r"^(\d단계\s*[:：]|접근법|업무 상황\s*[:：]|직무\s?상황\s*[:：])")
# "다음 조건"·"위 자료"처럼 어딘가를 가리키는 발문.
REFERS = re.compile(r"(다음|위|아래)\s*(의\s*)?(조건|자료|표|그래프|도표|규정|지문|안내문|공지|보고서|회의록)")

# 빈칸 표기 — "___", "( )", "（ ）", "…은(는) ____이다"
BLANK = re.compile(r"_{2,}|\(\s*\)|（\s*）|\[\s*\]")
LETTERS = "ABCDEFGH"

# 화면에 나가지 않는 은행. 여기 있는 파일의 위반은 빌드를 막지 않는다.
# 대신 **정말로 걸러지고 있는지**를 소스에서 확인한다. 필터가 사라지면 실패한다.
ARCHIVE = {
    "ncs-extracted-bank.json": (
        "원본 교재에서 기계로 뽑은 미검수 은행. 이 중 발문이 온전한 것만 ncs2026.js 가 "
        "출제 풀에 올리고, 나머지는 걸러진다. 복습 id 조회는 isRenderable 이 한 번 더 막는다."
    ),
}


def archive_filter_intact() -> bool:
    """복습 인덱스의 거름망이 그대로 있는지 확인한다.

    이 검사가 없으면 ARCHIVE 등록이 그냥 면죄부가 된다. 누가 isRenderable 을
    지우면 727개가 복습 화면으로 새어 나가는데 게이트는 통과시켜 버린다.
    """
    src = ROOT / "src" / "lib" / "questionIndex.js"
    if not src.exists():
        return False
    t = src.read_text(encoding="utf-8", errors="ignore")
    return "isRenderable" in t and "IDX[q.id] && isRenderable(q)" in t


def archive_leak_ids() -> set[str] | None:
    """실제로 빌드되는 출제 풀에 지적 문항이 섞였는지 **번들을 돌려** 확인한다.

    처음에는 "이 은행은 화면에 안 나간다"는 설명만 적어 두고 면제했다. 그 뒤
    ncs2026.js 가 이 은행에서 1,141문항을 끌어다 쓰게 되면서 설명이 사실과
    달라졌는데 게이트는 그대로 통과시켰다. 설명이 아니라 결과를 검사한다.

    esbuild/node 를 못 쓰는 환경이면 None 을 돌려주고 판단을 보류한다.
    """
    probe = ("import bank from './data/ncs-extracted-bank.json' with { type: 'json' };"
             "const { ncs2026Questions } = await import('./src/lib/ncs2026.js');"
             "const ids = new Set(ncs2026Questions.map(q => q.id));"
             "console.log(JSON.stringify((bank.questions ?? bank).map(q => q.id)"
             ".filter(id => ids.has(id))));")
    tmp = ROOT / ".gate-leak-probe.mjs"
    out = ROOT / ".gate-leak-probe.bundle.mjs"
    try:
        tmp.write_text(probe, encoding="utf-8")
        env = '{"VITE_SUPABASE_URL":"http://127.0.0.1:1","VITE_SUPABASE_ANON_KEY":"x"}'
        build = subprocess.run(
            ["npx", "esbuild", tmp.name, "--bundle", "--platform=node", "--format=esm",
             "--loader:.json=json", f"--define:import.meta.env={env}",
             f"--outfile={out.name}", "--log-level=error"],
            cwd=ROOT, capture_output=True, text=True, shell=(os.name == "nt"))
        if build.returncode != 0:
            return None
        run = subprocess.run(["node", out.name], cwd=ROOT, capture_output=True,
                             text=True, shell=(os.name == "nt"))
        if run.returncode != 0:
            return None
        return set(json.loads(run.stdout.strip().splitlines()[-1]))
    except (OSError, ValueError, json.JSONDecodeError):
        return None
    finally:
        tmp.unlink(missing_ok=True)
        out.unlink(missing_ok=True)


def load(path: Path):
    """문항 배열을 꺼낸다. 요약·변형표처럼 문항이 아닌 파일은 빈 목록."""
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"  ✗ {path.name}: JSON 파싱 실패 — {e}")
        return []
    items = d if isinstance(d, list) else (d.get("questions") or d.get("items") or [])
    if not isinstance(items, list):
        return []

    # 문항을 **품고 있는** 레코드도 있다. 훈화 자료(morning-talks.json)는
    # 한 편에 `question: {stem, choices, answer, explanation}` 이 들어 있어서,
    # 그대로 넘기면 stem 자리에 dict 가 와 검사가 터진다. 안쪽 문항을 꺼내
    # 함께 검사한다 — 학생 화면에 나가는 문항이므로 면제할 이유가 없다.
    out = []
    for q in items:
        if not isinstance(q, dict):
            continue
        inner = q.get("question")
        if isinstance(inner, dict) and inner.get("stem"):
            out.append({**inner, "id": q.get("id")})
            continue
        if q.get("stem") or isinstance(inner, str):
            out.append(q)

    # 최상위 배열이 비어 있는 파일도 있다. 변형 문항(ncs-variants·job-variants)은
    # `{variants: {부모id: [...]}}` 꼴이라 위 경로로는 하나도 잡히지 않았고,
    # 그 안에서 정답 키 오류 3건이 모의평가에 그대로 나갔다. 중첩까지 훑는다.
    if not out:
        def gather(node):
            if isinstance(node, list):
                for x in node:
                    gather(x)
            elif isinstance(node, dict):
                if isinstance(node.get("choices"), list) and node.get("stem"):
                    out.append(node)
                for v in node.values():
                    if isinstance(v, (list, dict)):
                        gather(v)
        gather(d)
    return out


_NUM = re.compile(r"\d[\d,.]*")


def _nums(t: str) -> set[str]:
    return {x.replace(",", "").rstrip(".") for x in _NUM.findall(t or "")}


def choice_pairs(c):
    """보기를 (키, 값) 목록으로 정규화한다. 배열형과 객체형이 섞여 있다."""
    if isinstance(c, list):
        return list(zip(LETTERS[:len(c)], c))
    if isinstance(c, dict):
        return list(c.items())
    return []


# 해설이 "정답은 3번" / "C가 정답" 처럼 자리를 부르는데 실제 정답 키와 다르면
# 학생이 해설을 믿고 틀린 보기를 외운다. 보기 순서를 돌리면서 해설을 함께
# 고치지 않아 81문항이 실제로 어긋나 있었다.
# 숫자는 '번' 이 붙은 것만 본다. "정답: 4월 매출" 의 4 를 보기 번호로 읽어
# 멀쩡한 문항을 파손으로 잡은 적이 있다. 알파벳은 뒤에 한글·영문·숫자가
# 붙으면 보기 글자가 아니다 — "정답은 C제품만" 의 C 가 그런 경우다.
_ANS_CLAIM = [
    re.compile(r"정답(?:은|이|[:：])\s*([1-5])\s*번"),
    re.compile(r"정답\s*\(\s*([1-5])\s*번\s*\)"),
    re.compile(r"정답\s*\(\s*([1-5])\s*\)"),
    re.compile(r"정답(?:은|이|[:：])\s*([①②③④⑤])"),
    re.compile(r"정답\s*\(\s*([①②③④⑤])\s*\)"),
    # "3번은 정답이 있는 선택형과 혼동한 것" 의 3번은 오답 설명이다. 뒤가 서술로
    # 끝나는 단언만 정답 지목으로 본다 — 이 구분이 없어 멀쩡한 문항 2개를
    # 파손으로 잡았다.
    re.compile(r"([1-5])\s*번(?:이|은)?\s*정답(?:입니다|이다|이라|\s*[.。]|$)"),
    re.compile(r"([1-5])번입니다"),
    re.compile(r"([1-5])\s*번(?:이|가)?\s*(?:가장\s*)?(?:적절|알맞|옳|맞)(?:한|다|습니다|음)"),
    re.compile(r"정답(?:은|이|[:：])\s*([A-E])(?![A-Za-z0-9가-힣])"),
    re.compile(r"(?<![A-Za-z0-9])([A-E])(?:가|이)\s*정답"),
]


def explanation_answer_conflict(q: dict) -> str | None:
    exp = q.get("explanation")
    ch, ans = q.get("choices"), q.get("answer")
    if not (isinstance(exp, str) and exp and isinstance(ch, list) and len(ch) >= 2):
        return None
    if isinstance(ans, int):
        ai = ans
    elif isinstance(ans, str) and re.fullmatch(r"[A-E]", ans.strip()):
        ai = "ABCDE".index(ans.strip())
    else:
        return None
    for pat in _ANS_CLAIM:
        m = pat.search(exp)
        if not m:
            continue
        tok = m.group(1)
        idx = ("ABCDE".index(tok) if tok.isalpha()
               else "①②③④⑤".index(tok) if tok in "①②③④⑤"
               else int(tok) - 1)
        if not 0 <= idx < len(ch):
            return None
        if idx != ai:
            return (f"해설이 정답을 {tok}로 부르는데 실제 정답은 "
                    f"{ai + 1}번('{str(ch[ai])[:20]}')")
        return None
    return None


def check(q: dict, src: str) -> list[str]:
    """문항 유형마다 '정상'의 모습이 다르다.

    처음에는 전부 4지선다로 가정해 검사했더니, 보기가 없는 게 정상인
    단답형(text) 44개와 연결형(matching) 16개를 파손으로 잡았다.
    O/X 는 발문이 진술문인 것이 정상이라 질문 표현 검사에서 뺀다.
    """
    out = []

    # 출제에서 뺀 문항은 학생 화면에 나가지 않는다. 다만 **까닭을 적어 둔 것만**
    # 봐준다 — excludeFromQuiz 하나로 검사를 피해 갈 수 있으면 그건 면죄부다.
    if q.get("excludeFromQuiz"):
        if not (q.get("excludeReason") or "").strip():
            return ["출제 제외인데 까닭(excludeReason)이 없음"]
        return []

    # 자동 검사에 걸렸지만 사람이 검산해 정상으로 확인한 문항. 무엇을 확인했는지
    # 적어 둔 것만 인정한다.
    if (q.get("keptAfterReview") or "").strip():
        return []

    stem = (q.get("stem") or q.get("question") or "").strip()
    pairs = choice_pairs(q.get("choices"))
    conflict = explanation_answer_conflict(q)
    if conflict:
        out.append(conflict)
    qtype = q.get("type") or q.get("questionMode")
    # 보기가 O/X 두 개뿐이면 진술문 발문이 정상이다. 이걸 객관식으로 보면
    # 멀쩡한 O/X 57문항이 "발문에 질문 표현이 없음"으로 잡힌다(실제로 그랬다).
    if not qtype and len(pairs) == 2:
        vals = {str(v).strip().upper() for _, v in pairs}
        if vals <= {"O", "X"} or vals == {"맞다", "틀리다"} or vals == {"예", "아니오"}:
            qtype = "ox"
    if not qtype:
        # type 이 없는 문항이 많다. 보기와 정답의 생김새로 유추한다.
        # 정답이 "Self Assessment"·"투명성" 처럼 낱말이면 빈칸 채우기(단답형)다.
        # 이걸 객관식으로 보면 멀쩡한 단답형 10개가 파손으로 잡힌다.
        ans = q.get("answer")
        if pairs:
            qtype = "mc"
        elif isinstance(ans, str) and ans.strip() not in ("O", "X"):
            qtype = "text"
        else:
            qtype = "ox"

    if qtype in ("ox", "selfcheck"):        # 진술문 발문이 정상
        # 보기가 ["O","X"] 인 은행은 정답을 A/B 로 적는다. 둘 다 정상이다.
        ok = ("O", "X", True, False, "true", "false")
        if q.get("answer") not in ok and not (
                len(pairs) == 2 and str(q.get("answer")) in ("A", "B")):
            out.append(f"O/X 정답값이 이상함: {q.get('answer')!r}")
        return out

    if qtype in ("text", "short", "matching"):   # 보기 없는 것이 정상
        if not stem:
            out.append("발문이 비어 있음")
        # 빈칸 채우기는 빈칸 자체가 질문이라 의문 표현이 없어도 정상이다.
        # 이걸 빼먹어 멀쩡한 클로즈 문항 10개를 파손으로 잡았다.
        elif not (Q_ANY.search(stem) or BLANK.search(stem)):
            out.append(f"발문에 질문 표현도 빈칸도 없음: {stem[:40]!r}")
        if q.get("answer") in (None, "", []):
            out.append("정답 없음")
        return out

    if len(pairs) < 2:
        out.append(f"보기가 {len(pairs)}개")
        return out

    if not stem:
        out.append("발문이 비어 있음")
    else:
        if not Q_ANY.search(stem):
            out.append(f"발문에 질문 표현이 없음: {stem[:40]!r}")
        if stem == (q.get("lessonTitle") or "").strip():
            out.append("발문이 차시 제목과 동일")
        if GUIDE.match(stem):
            out.append(f"발문이 제작용 안내문: {stem[:40]!r}")
        # 교재 한 덩어리가 통째로 발문에 들어가면 보기가 두 번 그려진다.
        # 질문 표현은 있으므로 위 검사들은 전부 통과해 버린다 — 실제로 8문항이
        # 이 상태로 학생 화면에 나갔다. 보기 본문이 발문 안에 있는지로 잡는다.
        dup = sum(1 for _, v in pairs if len(str(v).strip()) > 6 and str(v).strip() in stem)
        if dup >= 2:
            out.append(f"보기 {dup}개가 발문 안에 그대로 들어 있음: {stem[:40]!r}")
        # "다음 조건을 만족하는…"이라 해 놓고 그 조건이 어디에도 없는 문항.
        # 실제로 129문항에서 자료가 통째로 잘려 나가 있었고, 학생은 찍는 수밖에
        # 없었다. 자료가 발문 안에 들어간 경우도 있으므로 발문의 수치·목록까지
        # 함께 센다 — 그러지 않으면 멀쩡한 표 내장 문항 10개를 잘못 잡는다.
        if not q.get("excludeFromQuiz") and REFERS.search(stem):
            ctx = (q.get("context") or "").strip()
            material = f"{stem} {ctx}"
            # 자료가 산문으로 발문 안에 들어간 경우도 있다(회의록 전문 등).
            # 수치·목록만 세면 그 셋을 잘못 잡는다 — 발문이 길면 자료로 본다.
            has = (q.get("visual") or len(ctx) >= 40 or len(stem) >= 120
                   or len(re.findall(r"\d", material)) >= 8
                   # 조건이 한 줄 안에 "• A • B" 로 이어지는 문항도 있다.
                   # 줄머리만 보면 그런 것을 자료 없음으로 잘못 잡는다.
                   or re.search(r"[•·]|(^|\n)\s*[–\-|]|\d\)", material))
            if not has:
                out.append(f"가리키는 자료가 문항에 없음: {stem[:40]!r}")

    # 자료 안에 정답·해설이 들어간 문항. 원본 교재에서 뽑을 때 해설 블록이
    # 자료에 딸려 들어온 것이 있다. 학생 화면에서는 지문에 답이 적혀 있는 셈이다.
    ctx_leak = q.get("context") or ""
    if not q.get("excludeFromQuiz") and re.search(r"정답\s*[:：]|해설\s*[:：]", ctx_leak):
        out.append(f"자료에 정답·해설이 들어 있음: {ctx_leak[:40]!r}")

    # 해설이 스스로 다른 답을 가리키는 문항.
    #
    # 정답 보기의 수치가 해설에 하나도 없는데, 해설의 결론 부분에는 **다른
    # 보기**의 수치가 있는 경우다. 실측하니 5문항이 이 상태였고 전부 진짜
    # 고장이었다(정답 키 오기 3, 해설 오기 1, 보기에 정답이 없음 1).
    # 해설에 수치가 아예 없는 설명형은 잡지 않는다 — 그건 불친절일 뿐 오류가 아니다.
    ans_one = q.get("answer")
    exp = q.get("explanation") or ""
    if isinstance(ans_one, str) and len(ans_one) == 1 and exp and not q.get("excludeFromQuiz"):
        i = ord(ans_one) - 65
        vals_s = [str(v) for _, v in pairs]
        if 0 <= i < len(vals_s) and len(vals_s[i]) <= 18:
            an, en = _nums(vals_s[i]), _nums(exp)
            if an and en and not (an & en):
                tail = _nums(exp[-90:])
                clash = [chr(65 + j) for j, t in enumerate(vals_s)
                         if j != i and len(t) <= 18 and (_nums(t) & tail)]
                if clash:
                    out.append(f"해설의 결론이 정답({ans_one}) 아닌 보기 {clash} 를 가리킴")

    # 보기 본문에 A·B·C… 표기가 다시 들어오면 화면에 번호가 두 번 찍힌다
    # ("1. A -14"). 실제로 506문항이 이 상태로 나가고 있었다.
    letters = [m.group(1) for m in
               (re.match(r"^([A-E])[.)]?\s+\S", str(v)) for _, v in pairs) if m]
    if len(letters) == len(pairs) and letters == [LETTERS[i] for i in range(len(pairs))]:
        out.append("보기 본문에 A~E 표기가 중복으로 들어 있음")

    keys = [k for k, _ in pairs]
    vals = [str(v) for _, v in pairs]
    ans = q.get("answer")
    for a in (ans if isinstance(ans, list) else [ans]):
        if a not in keys:
            out.append(f"정답 {a!r} 이 보기키 {keys} 밖")
    if len(set(vals)) != len(vals):
        out.append("보기 중복")
    if not (q.get("explanation") or "").strip():
        out.append("해설 없음")
    return out


def empty_lessons() -> list[str] | None:
    """자율학습 목록에 있는데 문항이 하나도 없는 단원을 찾는다.

    단원을 목록에 넣어 놓고 그 단원이 쓸 문항은 다른 통에 두면, 학생이 눌렀을 때
    "학습 문항이 없습니다"만 뜬다. 실제로 직업공통 5개 단원이 그 상태였다
    (종합·추론 3개, 영어 보강 1개, 자가진단 1개).

    화면과 같은 방식으로 세어 본다 — 목록만 보고는 알 수 없다.
    """
    probe = (
        "const m = await import('./src/lib/jobCommonAreas.js');"
        # 화면과 같은 풀을 쓴다(평가틀 태그가 붙은 것).
        "const pool = m.jcStudyQuestions();"
        "const out = [];"
        "for (const a of m.buildJcOfficialAreas()) for (const l of a.lessons ?? []) {"
        "  if (l.kind === 'self-report') continue;"
        # 화면이 쓰는 것과 **같은 규칙**으로 센다. 규칙이 갈리면 게이트가
        # 멀쩡한 단원을 비었다고 하거나, 빈 단원을 놓친다.
        "  const n = pool.filter(q => !q.excludeFromQuiz && m.jcLessonMatches(q, l.id)).length;"
        "  if (n === 0) out.push(`${a.id}/${l.id}`); }"
        # 반대 방향도 본다 — 어느 단원에도 걸리지 않아 **학생이 닿을 수 없는**
        # 문항. 실제로 172문항이 그렇게 묻혀 있었다(자기개발 69·직업윤리 51·
        # 대인관계 52). 단원을 통째로 건너뛰면서 생긴 일이라 눈에 띄지 않았다.
        "const lids = [];"
        "for (const a of m.buildJcOfficialAreas()) for (const l of a.lessons ?? []) lids.push(l.id);"
        "const orphan = pool.filter(q => !q.excludeFromQuiz &&"
        "  !lids.some(id => m.jcLessonMatches(q, id)));"
        "if (orphan.length) out.push(`고아문항 ${orphan.length}개 (예: ${orphan.slice(0,3).map(q=>q.id).join(', ')})`);"
        "console.log(JSON.stringify(out));")
    tmp = ROOT / ".gate-empty-probe.mjs"
    out = ROOT / ".gate-empty-probe.bundle.mjs"
    try:
        tmp.write_text(probe, encoding="utf-8")
        env = '{"VITE_SUPABASE_URL":"http://127.0.0.1:1","VITE_SUPABASE_ANON_KEY":"x"}'
        b = subprocess.run(
            ["npx", "esbuild", tmp.name, "--bundle", "--platform=node", "--format=esm",
             "--loader:.json=json", f"--define:import.meta.env={env}",
             f"--outfile={out.name}", "--log-level=error"],
            cwd=ROOT, capture_output=True, text=True,
            encoding="utf-8", errors="replace", shell=(os.name == "nt"))
        if b.returncode != 0:
            return None
        # 단원 이름에 한글이 있다. 인코딩을 지정하지 않으면 윈도우에서
        # cp949 로 읽다 깨져 검사 자체가 죽는다 — 실제로 그렇게 멈췄다.
        r = subprocess.run(["node", out.name], cwd=ROOT, capture_output=True,
                           text=True, encoding="utf-8", errors="replace",
                           shell=(os.name == "nt"))
        if r.returncode != 0:
            return None
        if not r.stdout:
            return None
        return json.loads(r.stdout.strip().splitlines()[-1])
    except (OSError, ValueError, AttributeError, IndexError, json.JSONDecodeError):
        return None
    finally:
        tmp.unlink(missing_ok=True)
        out.unlink(missing_ok=True)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    report = "--report" in sys.argv

    banks = discover_banks()
    total = 0
    violations: list[tuple[str, str, str]] = []
    archived: list[tuple[str, str, str]] = []
    for p in banks:
        for q in load(p):
            total += 1
            for msg in check(q, p.name):
                (archived if p.name in ARCHIVE else violations).append(
                    (p.name, q.get("id", "(id없음)"), msg))

    print(f"[문항게이트] 파일 {len(banks)}개 · {total}문항 검사 · 위반 {len(violations)}건")

    empty = empty_lessons()
    if empty is None:
        print("  ⚠️ 빈 단원 검사를 돌리지 못했다(번들 실패).")
    elif empty:
        orphan = [e for e in empty if str(e).startswith("고아문항")]
        blanks = [e for e in empty if not str(e).startswith("고아문항")]
        if blanks:
            print(f"  ✗ 자율학습에 문항이 0개인 단원 {len(blanks)}개: {blanks}")
        for o in orphan:
            print(f"  ✗ 어느 단원에도 걸리지 않아 학생이 닿을 수 없는 {o}")
        return 1
    else:
        print("           빈 단원 0개")

    if archived:
        for name in sorted({a[0] for a in archived}):
            n = sum(1 for a in archived if a[0] == name)
            print(f"  ⓘ {name}: {n}건 — 미검수 은행이라 이 지적은 빌드를 막지 않음")
            print(f"     {ARCHIVE[name]}")
        leak = archive_leak_ids()
        flagged = {a[1] for a in archived}
        if leak is None:
            print("     ⚠️ 번들 검사를 돌리지 못해 출제 풀 유입 여부는 확인하지 못했다.")
        elif leak & flagged:
            print(f"  ✗ 지적된 문항 {len(leak & flagged)}개가 출제 풀에 올라와 있다: "
                  f"{sorted(leak & flagged)[:5]}")
            return 1
        else:
            print(f"     출제 풀 유입 0건 (풀에 오른 것 {len(leak)}개는 모두 지적 없음)")
        if not archive_filter_intact():
            print("  ✗ questionIndex.js 의 isRenderable 거름망이 사라졌다. "
                  "비노출 은행의 파손 문항이 복습 화면에 나갈 수 있다.")
            return 1

    if violations:
        shown = violations if report else violations[:20]
        for src, qid, msg in shown:
            print(f"  ✗ {src} / {qid}: {msg}")
        if not report and len(violations) > len(shown):
            print(f"  … 외 {len(violations) - len(shown)}건 (--report 로 전체 출력)")
        return 1

    print("[문항게이트] 통과")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
