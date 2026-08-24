#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
해설의 정답 표기를 화면 표기와 맞춘다.

### 무엇이 어긋나 있었나

화면은 보기를 `1 2 3 4 5` 로 그리는데, 해설은 세 가지로 말하고 있었다.

    정답: ④번          ← 원문자
    정답은 2번          ← 번호
    정답은 D번          ← 알파벳(앞서 정리함)

학생은 "④가 몇 번이지"를 한 번 더 생각해야 한다. 아침에 60초를 다투는
스피드 퀴즈에서는 그 한 번이 그대로 실점이다.

### 무엇만 바꾸나

**정답을 가리키는 원문자만** 바꾼다. 본문의 열거는 그대로 둔다.

    정답: ④번        → 정답: 4번        (바꾼다)
    ① 사과 ② 조치     → 그대로           (내용이다)
    제15조 ③항        → 그대로           (조문이다)
    보기 '①, ③'      → 그대로           (보기 본문이다)

그래서 `정답…①` 과 `①번` 두 꼴만 손댄다. 나머지 원문자는 건드리지 않는다.

### 함께 고치는 것

원본에서 되살린 자료 중 안내 문장이 맨 뒤에 붙은 것들이 추출본에도 남아 있다.
("… 데이터입니다." 가 표 뒤에 오는 꼴) 같은 규칙으로 앞으로 옮긴다.

실행: `python scripts/normalize-answer-notation.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

CIRC = "①②③④⑤⑥⑦⑧⑨⑩"

# 1) "정답: ④" / "정답은 ④" / "정답 ④번"
ANSWER_CIRC = re.compile(r"(정답\s*(?:은|는)?\s*[:：]?\s*)([" + CIRC + r"])")
# 2) 홀로 선 "④번"
NUM_CIRC = re.compile(r"([" + CIRC + r"])번")


def to_num(ch: str) -> str:
    return str(CIRC.index(ch) + 1)


def fix(text: str) -> str:
    text = ANSWER_CIRC.sub(lambda m: m.group(1) + to_num(m.group(2)), text)
    text = NUM_CIRC.sub(lambda m: to_num(m.group(1)) + "번", text)
    # "정답: 4 54.3명" 처럼 번호 뒤에 바로 값이 오면 '번'을 붙여 읽기 쉽게 한다.
    text = re.sub(r"(정답\s*(?:은|는)?\s*[:：]?\s*)(\d)(?=\s|$)", r"\g<1>\g<2>번", text)
    return text


def discover() -> list[Path]:
    names = set()
    for src in (ROOT / "src").rglob("*.js*"):
        for m in re.finditer(r"from\s+'[^']*?/data/([A-Za-z0-9._-]+\.json)'",
                             src.read_text(encoding="utf-8", errors="ignore")):
            names.add(m.group(1))
    return sorted(DATA / n for n in names if (DATA / n).exists())


def walk(node, counter: dict) -> bool:
    changed = False
    if isinstance(node, list):
        for item in node:
            changed |= walk(item, counter)
    elif isinstance(node, dict):
        v = node.get("explanation")
        if isinstance(v, str) and v:
            new = fix(v)
            if new != v:
                node["explanation"] = new
                counter["n"] = counter.get("n", 0) + 1
                changed = True
        for x in node.values():
            if isinstance(x, (list, dict)):
                changed |= walk(x, counter)
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
            print(f"    {path.name}: {counter['n']}건")
            total += counter["n"]
            if not dry:
                shutil.copyfile(path, path.with_suffix(".json.bak"))
                path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                                encoding="utf-8")

    # 남은 원문자는 내용이어야 한다. 정답 표기가 남아 있으면 규칙이 부족한 것이다.
    left = 0
    for path in discover():
        try:
            blob = path.read_text(encoding="utf-8")
        except OSError:
            continue
        left += len(re.findall(r"정답\s*(?:은|는)?\s*[:：]?\s*[" + CIRC + r"]", blob))
        left += len(re.findall(r"[" + CIRC + r"]번", blob))
    print(f"[정답표기] {total}건 정리 · 잔존 정답 원문자 {left}건"
          + (" (--dry-run)" if dry else (" ✅" if left == 0 else " ⚠️")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
