#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
발문 안에 지문·보기·힌트가 통째로 들어간 문항을 갈라 놓는다.

### 무엇이 보이고 있었나

오늘의 도전에서 문항 하나를 열었더니 보기가 두 번 나왔다.

    발문  수신: 회계팀 발신: 기획팀장 … 문제. 이 이메일에서 요청하는 내용으로
          옳은 것은 무엇인가요? A. 자료를 이메일 첨부로 … E. 제출 기한은 …
          ※ 제출 방법과 제출 형식을 정확히 구분하세요.
    보기  ["자료를 이메일 첨부로…", "제출 형식은 PDF…", …]

교재의 한 덩어리가 통째로 `stem` 에 들어갔다. 화면은 발문을 그대로 그리고
그 아래에 `choices` 를 또 그리므로, 학생은 같은 보기를 두 번 읽는다. 질문
문장은 그 사이에 묻혀 어디가 물음인지 찾기 어렵다.

기존 발문복구(`repair-question-stems.py`)는 이걸 잡지 못했다. 그 검사는
"발문에 질문 표현이 있는가"만 보는데, 여기엔 '무엇'이 들어 있어 정상으로
분류됐다. 파손의 종류가 다르다 — 질문이 없는 게 아니라 **너무 많다.**

### 어떻게 가르나

    [지문] 문제. [질문?] [보기 A~E] ※[힌트]
      ↓        ↓                ↓        ↓
    context   stem          버린다    explanation

보기 목록은 `choices` 에 이미 같은 내용이 있을 때만 버린다. 하나라도
대조되지 않으면 그 문항은 건드리지 않는다 — 내용을 잃느니 그대로 두는 편이 낫다.
힌트(`※ …`)는 학습에 쓸모가 있으므로 해설로 옮긴다.

실행: `python scripts/repair-inline-choice-stems.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

# "문제." 라벨이 있으면 그 뒤가 질문이다. 없으면 첫 보기 앞의 마지막 물음표 문장.
LABEL = re.compile(r"문제\s*[.:：]\s*")
# 자료와 질문을 붙여 놓은 구분자. 앞뒤에 글이 있을 때만 구분자로 본다
# ("어려운 문제." 처럼 문장이 그 말로 끝나는 경우와 구분해야 한다).
SPLITTER = re.compile(r"(?<=\S)\s+문제\s*[.:：]\s*(?=\S)")
# 보기 목록의 시작. "A. " 또는 "①". 앞이 영문자면 약어(ETA)이므로 제외한다.
OPT = re.compile(r"(?<![A-Za-z])([A-E])\.\s|([①②③④⑤])")
HINT = re.compile(r"※\s*(.+?)\s*$", re.S)


def choice_texts(q) -> list[str]:
    ch = q.get("choices")
    vals = ch if isinstance(ch, list) else (list(ch.values()) if isinstance(ch, dict) else [])
    return [c if isinstance(c, str) else (c.get("text") or "") for c in vals]


def is_target(q) -> bool:
    """발문 안에 자료가 통째로 들어간 문항.

    처음에는 '보기가 발문 안에 두 번 나오는 것'만 잡았다. 그러다 보니
    보기가 짧은 문항("30%", "45%")은 여섯 자 미만이라 걸러졌고,
    `부서 예산 … 문제. 영업팀 예산의 구성비는? A. 30% B. 45%` 같은 45문항이
    그대로 남았다. 화면에서는 표가 발문 자리에 붙고 보기가 두 번 나온다.

    이제 두 가지 중 하나면 대상으로 본다.
      · 보기 본문이 발문 안에 두 개 이상 그대로 있다
      · 발문에 `문제.` / `문제:` 구분자가 있다 — 자료와 질문이 붙어 있다는 표시
    """
    stem = q.get("stem")
    texts = choice_texts(q)
    if not isinstance(stem, str) or len(texts) < 2:
        return False
    # 짧은 보기(`3500`, `20%`)는 지문의 수치와 우연히 겹친다. 실제로 멀쩡한
    # 연산 문항 24개가 대상으로 잡혔다. 긴 보기만 중복 판정에 쓰고, 짧은
    # 보기를 가진 문항은 `문제.` 구분자로만 잡는다.
    if sum(1 for t in texts if t and len(t) > 6 and t.strip() in stem) >= 2:
        return True
    return bool(SPLITTER.search(stem))


def split_stem(stem: str, texts: list[str]):
    """(지문, 질문, 힌트) 로 가른다. 확신이 없으면 None."""
    hint = ""
    m = HINT.search(stem)
    if m:
        hint = m.group(1).strip()
        stem = stem[:m.start()].strip()

    # 자르는 순서가 중요하다. 먼저 **질문 문장**을 확정하고, 보기는 그 뒤에서만
    # 찾는다. 반대로 하면 지문에 나온 낱말을 보기로 착각한다 — 실제로
    # "A업무 200만 원 … A. B업무" 문항에서 지문 속 'B업무'를 보기 시작점으로
    # 집어 실패했다.
    lm = LABEL.search(stem)
    if lm:
        passage = stem[:lm.start()].strip()
        rest = stem[lm.end():]
    else:
        passage, rest = "", stem
    qm = re.search(r"[?？]", rest)
    if not qm:
        return None
    question = rest[:qm.end()].strip()
    body = rest[qm.end():].strip()
    if not lm:
        # 라벨이 없으면 질문 앞부분이 지문이다. 문장 경계에서 가른다.
        cut = question.rfind(".", 0, len(question) - 1)
        passage, question = question[:cut + 1].strip(), question[cut + 1:].strip()
    if not question:
        return None
    # 보기가 발문에 딸려 오지 않은 문항도 있다. `문제.` 로 자료와 질문만 붙어
    # 있는 꼴이다. 그때는 버릴 것이 없으니 뒤가 비어 있어도 정상이다.
    if not body:
        return (passage, question, hint) if lm else None

    # 버릴 부분에 보기 말고 다른 내용이 남아 있으면 안 된다.
    leftover = body
    for t in sorted(texts, key=len, reverse=True):
        leftover = leftover.replace(t.strip(), " ")
    leftover = OPT.sub(" ", leftover)
    if re.sub(r"[\s.,·%]", "", leftover):
        return None                      # 보기 외의 글자가 남는다 → 손대지 않는다
    return passage, question, hint


def repair(q) -> bool:
    parsed = split_stem(q["stem"], choice_texts(q))
    if not parsed:
        return False
    passage, question, hint = parsed

    if passage:
        ctx = (q.get("context") or "").strip()
        # 발문에 있던 머리말(수신·발신·제목)이 자료의 앞이어야 순서가 자연스럽다.
        q["context"] = (passage + ("\n\n" + ctx if ctx else "")).strip()
    q["stem"] = question

    if hint:
        exp = (q.get("explanation") or "").strip()
        if hint not in exp:
            q["explanation"] = (exp + ("\n\n" if exp else "") + f"※ {hint}").strip()

    q["stemRepaired"] = "inline-split"
    return True


def discover() -> list[Path]:
    names = set()
    for src in (ROOT / "src").rglob("*.js*"):
        for m in re.finditer(r"from\s+'[^']*?/data/([A-Za-z0-9._-]+\.json)'",
                             src.read_text(encoding="utf-8", errors="ignore")):
            names.add(m.group(1))
    return sorted(DATA / n for n in names if (DATA / n).exists())


def collect(node, out):
    if isinstance(node, list):
        for x in node:
            collect(x, out)
    elif isinstance(node, dict):
        if is_target(node):
            out.append(node)
        for v in node.values():
            if isinstance(v, (list, dict)):
                collect(v, out)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv
    fixed = skipped = 0

    for path in discover():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        targets = []
        collect(data, targets)
        if not targets:
            continue

        done = 0
        for q in targets:
            if repair(q):
                done += 1
                print(f"    ✔ {q.get('id')}  발문 → {q['stem'][:44]}")
            else:
                skipped += 1
                print(f"    ⚠️ {q.get('id')}  자동으로 가를 수 없어 건너뜀")
        fixed += done
        if done and not dry:
            shutil.copyfile(path, path.with_suffix(".json.bak"))
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
            print(f"  {path.name}: {done}건 저장 (원본은 {path.name}.bak)")

    # 고친 뒤 같은 파손이 남아 있으면 안 된다.
    left = 0
    for path in discover():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        out = []
        collect(data, out)
        left += len(out)

    print(f"[보기중복] 분리 {fixed} · 건너뜀 {skipped} · 잔존 {left}"
          + (" (--dry-run)" if dry else (" ✅" if left == 0 else " ⚠️")))
    return 0 if (dry or left == skipped) else 1


if __name__ == "__main__":
    raise SystemExit(main())
