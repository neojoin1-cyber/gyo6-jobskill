#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
해설이 보기를 부르는 방식을 화면 표기(①②③④ = 1·2·3·4번)와 맞춘다.

### 무엇이 어긋나 있었나

학생 화면은 보기를 **번호**로 매긴다.

    1  Nice to see you again. …
    2  He is my best friend …
    3  Hold on, please. I'll put you through.
    4  I don't like taking phone calls …

그런데 해설은 알파벳으로 부른다 — "C가 정답입니다. A는 직접 만났을 때 하는
인사라…". 화면에 A·B·C·D 는 어디에도 없다. 학생은 C 를 찾다가 세 번째를
세어 보고 나서야 이해한다. 실제 시험은 ①②③④ 로 제시되므로, 익숙해져야 할
표기도 번호다.

### 어떻게 바꾸나

보기 번호임이 **확실한** 알파벳만 번호 표기로 옮긴다. 하나라도 보기 글자인지
확신할 수 없으면(예: "Building C", "품질등급 B", "A(1,500)") 그 문항은
건드리지 않는다. 정답 키가 가리키는 자리와 해설이 부르는 자리가 이미 어긋난
문항도 손대지 않는다 — 그건 `sync-explanation-letters.py` 가 먼저 맞출 일이다.

실행: `python scripts/normalize-explanation-refs.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LETTERS = "ABCDE"

# 보기 글자로 읽어도 되는 뒤 문맥. 한글이 바로 이어지면 조사·서술어일 때만
# 인정한다 — 이 구분이 없으면 "C가 정답입니다" 의 C 를 놓치고(뒤가 한글),
# 반대로 다 허용하면 "C제품" 의 C 까지 보기 번호로 바꿔 버린다.
_SUFFIX = r"(?![A-Za-z0-9])(?=$|[^가-힣]|[은는이가와과도만의를]|입니다|이다|번)"

LETTER = re.compile(r"(?<![A-Za-z0-9])([A-E])" + _SUFFIX)
AFTER_OK = re.compile(r"^\s*(?:입니다|이다|[은는이가와과도만의를]"
                      r"|[,·、]\s*[A-E](?![A-Za-z0-9가-힣])|[✗✓×○]|[.)\]]|$)")
BEFORE_OK = re.compile(r"(정답은|정답[:：]|답은|정답이|보기|선택지|따라서)\s*$")
# 정답을 어느 글자로 부르는지 — 이미 맞는 문항만 표기를 바꾼다.
CLAIM = [
    re.compile(r"정답(?:은|이|[:：])\s*([A-E])" + _SUFFIX),
    re.compile(r"(?<![A-Za-z0-9])([A-E])(?:가|이)\s*정답"),
]
# 조사에 맞춰 번호를 붙인다. 'C가' → '3번이', 'A는' → '1번은'.
PARTICLE = {"가": "이", "는": "은", "를": "을", "와": "과", "과": "과"}


def discover() -> list[Path]:
    names = set()
    for src in (ROOT / "src").rglob("*.js*"):
        for m in re.finditer(r"from\s+'[^']*?/data/([A-Za-z0-9._-]+\.json)'",
                             src.read_text(encoding="utf-8", errors="ignore")):
            names.add(m.group(1))
    names.add("block-inline-job-common.json")
    return sorted((DATA / n) for n in names if (DATA / n).exists())


def answer_index(q: dict) -> int | None:
    ans, ch = q.get("answer"), q.get("choices")
    if not isinstance(ch, list) or len(ch) < 2:
        return None
    if isinstance(ans, int) and 0 <= ans < len(ch):
        return ans
    if isinstance(ans, str) and re.fullmatch(r"[A-E]", ans.strip()):
        i = LETTERS.index(ans.strip())
        return i if i < len(ch) else None
    return None


def convert(exp: str, n: int) -> str | None:
    if not LETTER.search(exp):
        return None
    out, last = [], 0
    for m in LETTER.finditer(exp):
        idx = LETTERS.index(m.group(1))
        if idx >= n:
            return None
        after = exp[m.end():m.end() + 24]
        before = exp[max(0, m.start() - 12):m.start()]
        if not (AFTER_OK.match(after) or BEFORE_OK.search(before)):
            return None                       # 보기 글자인지 확신할 수 없다
        out.append(exp[last:m.start()])
        nxt = exp[m.end():m.end() + 1]
        if nxt in PARTICLE:
            out.append(f"{idx + 1}번{PARTICLE[nxt]}")
            last = m.end() + 1
        else:
            out.append(f"{idx + 1}번")
            last = m.end()
    out.append(exp[last:])
    return "".join(out)


def process(q: dict, counter: dict) -> bool:
    exp = q.get("explanation")
    ai = answer_index(q)
    if ai is None or not isinstance(exp, str) or not exp:
        return False
    for pat in CLAIM:
        m = pat.search(exp)
        if m:
            if LETTERS.index(m.group(1)) != ai:
                counter["정답 자리 불일치"] = counter.get("정답 자리 불일치", 0) + 1
                return False
            break
    fixed = convert(exp, len(q["choices"]))
    if fixed is None or fixed == exp:
        if fixed is None and LETTER.search(exp):
            counter["표기 변환 불가"] = counter.get("표기 변환 불가", 0) + 1
        return False
    q["explanation"] = fixed
    counter["고침"] = counter.get("고침", 0) + 1
    return True


def walk(node, counter) -> bool:
    changed = False
    if isinstance(node, list):
        for x in node:
            changed |= walk(x, counter)
    elif isinstance(node, dict):
        if "choices" in node and "answer" in node:
            changed |= process(node, counter)
        for v in node.values():
            if isinstance(v, (list, dict)):
                changed |= walk(v, counter)
    return changed


def main() -> int:
    dry = "--dry-run" in sys.argv
    counter: dict = {}
    for p in discover():
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if walk(d, counter) and not dry:
            p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[해설표기] {counter.get('고침', 0)}문항을 번호 표기로 통일"
          + (" (dry-run)" if dry else " ✅"))
    for k in ("표기 변환 불가", "정답 자리 불일치"):
        if counter.get(k):
            print(f"           {k} {counter[k]}문항 — 건드리지 않았다")
    return 0


if __name__ == "__main__":
    sys.exit(main())
