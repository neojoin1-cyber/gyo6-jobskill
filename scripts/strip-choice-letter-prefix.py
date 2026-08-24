#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
보기 앞에 두 번 붙는 번호를 걷어낸다.

### 무엇이 보이고 있었나

오답노트에서 수리 문항을 펼쳤더니 보기가 이렇게 나왔다.

    1. A -14
    2. B -10   ← 정답
    3. C -6

앱은 보기를 그릴 때 `1. 2. 3.` 을 스스로 붙인다. 그런데 저장된 보기 본문에도
`A. `·`B. ` 가 들어 있어서 번호가 두 번 찍힌다. 학생은 "1번인가 A번인가"를
잠깐 헷갈리고, 해설은 또 "정답은 2번"이라고 말한다. 표기가 셋이다.

앱이 실제로 읽는 은행에서 **506문항**이 이 상태였다.

    questions.json 265 · ncs-questions.json 115 · interview-quiz.json 63 · mock-interview-pool.json 63

### 어떤 것만 지우나

보기 전체가 **A·B·C…를 차례로** 달고 있을 때만 지운다. 한두 개만 그런 것은
내용일 가능성이 있다("A업무는…"). 차례가 맞아떨어지는 것은 우연이 아니라
번호 표기다.

정답(`answer`)은 보기의 **자리**를 가리키므로 손대지 않는다. 순서를 바꾸지
않으니 정답도 그대로 맞다.

실행: `python scripts/strip-choice-letter-prefix.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

# "A. 내용" / "A) 내용" / "A 내용" — 뒤에 반드시 내용이 있어야 한다.
PREFIX = re.compile(r"^([A-E])[.)]?\s+(?=\S)")


def discover() -> list[Path]:
    names = set()
    for src in (ROOT / "src").rglob("*.js*"):
        for m in re.finditer(r"from\s+'[^']*?/data/([A-Za-z0-9._-]+\.json)'",
                             src.read_text(encoding="utf-8", errors="ignore")):
            names.add(m.group(1))
    return sorted(DATA / n for n in names if (DATA / n).exists())


def strip_set(vals: list[str]) -> list[str] | None:
    """A·B·C… 가 차례로 붙어 있을 때만 걷어낸 목록을 돌려준다."""
    if len(vals) < 2 or not all(isinstance(v, str) for v in vals):
        return None
    marks = []
    for v in vals:
        m = PREFIX.match(v)
        if not m:
            return None
        marks.append(m.group(1))
    if marks != [chr(65 + i) for i in range(len(vals))]:
        return None
    return [PREFIX.sub("", v, count=1).strip() for v in vals]


def walk(node, counter: dict) -> bool:
    changed = False
    if isinstance(node, list):
        for item in node:
            changed |= walk(item, counter)
    elif isinstance(node, dict):
        ch = node.get("choices")
        if isinstance(ch, list):
            stripped = strip_set(ch)
            if stripped:
                node["choices"] = stripped
                counter["n"] = counter.get("n", 0) + 1
                changed = True
        for v in node.values():
            if isinstance(v, (list, dict)):
                changed |= walk(v, counter)
    return changed


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv
    total = 0

    for path in discover():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        counter: dict = {}
        if walk(data, counter):
            print(f"    {path.name}: {counter['n']}문항")
            total += counter["n"]
            if not dry:
                shutil.copyfile(path, path.with_suffix(".json.bak"))
                path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                                encoding="utf-8")

    print(f"[보기표기] {total}문항 정리" + (" (--dry-run)" if dry else " ✅"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
