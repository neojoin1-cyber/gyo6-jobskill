#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
해설이 부르는 보기 **알파벳**을 실제 자리에 맞춘다.

### 무엇이 어긋나 있었나

`balance-answer-positions.py` 는 보기 순서를 돌리면서 해설의 'N번' 만 다시
매겼다. 그런데 영어 문항 해설은 번호가 아니라 **알파벳**으로 보기를 부른다.

    ENG-read-std-07  정답 자리 A  ·  해설 "C가 정답입니다"

순서를 돌린 뒤 해설이 거짓말을 하게 된 문항이 81개였다. 학생이 해설을 믿고
C를 외우면 시험장에서 틀린다. 편향을 지우려다 더 큰 오류를 심은 셈이다.

### 어떻게 되돌리나

돌린 방식이 정해져 있어 역산이 된다. 해설이 부르는 글자가 **돌리기 전** 정답
자리이고, 지금 정답 키가 **돌린 뒤** 자리다. 두 값이면 그때 쓴 자리바꿈을
그대로 복원할 수 있고, 해설 안의 모든 보기 글자를 같은 규칙으로 옮긴다.

    order = [0..n-1];  order.insert(target, order.pop(old))
    새 자리(old) = order.index(old)

보기 글자인지 확신할 수 없는 알파벳이 하나라도 있으면 그 문항은 건드리지
않는다. 잘못 고치느니 그대로 두는 편이 낫다.

실행: `python scripts/sync-explanation-letters.py [--dry-run]`
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

CLAIM = [
    re.compile(r"정답(?:은|이|[:：])\s*([A-E])(?![A-Za-z0-9가-힣])"),
    re.compile(r"(?<![A-Za-z0-9])([A-E])(?:가|이)\s*정답"),
]
LETTER = re.compile(r"(?<![A-Za-z0-9])([A-E])(?![A-Za-z0-9])")
# 보기 글자로 읽어도 되는 자리 — 뒤에 조사가 붙거나, 글자가 나열되거나,
# 문장이 그 글자로 끝나거나, 앞에 '정답/답/보기/선택지' 가 오는 경우.
AFTER_OK = re.compile(r"^\s*(?:입니다|이다|번|[은는이가와과도만의를]"
                      r"|[,·、]\s*[A-E](?![A-Za-z0-9])|[✗✓×○]|[.)\]]|$)")
BEFORE_OK = re.compile(r"(정답은|정답[:：]|답은|정답이|보기|선택지|따라서)\s*$")


def discover() -> list[Path]:
    names = set()
    for src in (ROOT / "src").rglob("*.js*"):
        for m in re.finditer(r"from\s+'[^']*?/data/([A-Za-z0-9._-]+\.json)'",
                             src.read_text(encoding="utf-8", errors="ignore")):
            names.add(m.group(1))
    return sorted(DATA / n for n in names if (DATA / n).exists())


def claimed(exp: str) -> int | None:
    for p in CLAIM:
        m = p.search(exp)
        if m:
            return LETTERS.index(m.group(1))
    return None


def remap(exp: str, n: int, old_ai: int, target: int) -> str | None:
    order = list(range(n))
    order.insert(target, order.pop(old_ai))
    new_index = {old: order.index(old) for old in range(n)}

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
        out.append(LETTERS[new_index[idx]])
        last = m.end()
    out.append(exp[last:])
    return "".join(out)


def process(q: dict, counter: dict) -> bool:
    ch, ans, exp = q.get("choices"), q.get("answer"), q.get("explanation")
    if not (isinstance(ch, list) and len(ch) >= 4 and isinstance(ans, str)
            and re.fullmatch(r"[A-E]", ans) and isinstance(exp, str) and exp):
        return False
    n, target = len(ch), LETTERS.index(ans)
    if target >= n:
        return False
    old_ai = claimed(exp)
    if old_ai is None or old_ai >= n or old_ai == target:
        return False
    fixed = remap(exp, n, old_ai, target)
    if fixed is None:
        counter["재매김 불가"] = counter.get("재매김 불가", 0) + 1
        return False
    if claimed(fixed) != target:
        counter["검산 실패"] = counter.get("검산 실패", 0) + 1
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
    touched = 0
    for p in discover():
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if walk(d, counter):
            touched += 1
            if not dry:
                p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    fixed = counter.get("고침", 0)
    print(f"[해설글자] {fixed}문항 고침 · 파일 {touched}개" + (" (dry-run)" if dry else " ✅"))
    for k, v in sorted(counter.items()):
        if k != "고침":
            print(f"           {k} {v}문항")
    return 0


if __name__ == "__main__":
    sys.exit(main())
