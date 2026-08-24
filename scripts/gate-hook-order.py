#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
컴포넌트의 **화면 분기(early return) 뒤에 훅이 오는 것**을 막는다.

### 왜 필요한가

리액트는 훅이 매번 같은 순서로 같은 개수만큼 불리는 것을 전제로 한다.
컴포넌트가 이렇게 생기면 그 전제가 깨진다.

    if (!areaId) return (<영역 고르는 화면 />)   ← 여기서 끝나는 렌더가 있고
    ...
    const summary = useMemo(...)                 ← 여기까지 가는 렌더도 있다

영역을 고르는 동안에는 훅이 5개, 단원에 들어가면 6개가 된다. 리액트는
"훅이 늘었다"며 화면을 통째로 떨어뜨린다(React #310).

실제로 그렇게 됐다. 요점정리를 읽어 오는 `useMemo` 를 본문 아래쪽에 두었더니
단원을 누르는 순간 **"교재를 불러오지 못했어요"** 가 떴다. 빌드는 멀쩡했고
경고 하나 없었다. 브라우저에서 눌러 보고서야 알았다.

그래서 빌드 전에 기계가 대신 눌러 본다.

### 어떻게 보나

파일 맨 왼쪽에서 시작하는 함수(=컴포넌트) 하나하나를 훑으며,
중괄호 깊이 1(=함수 본문 바로 아래)에서

    1. `return (` 또는 `return <` 를 만난 뒤에
    2. `useState`·`useMemo` 같은 훅 호출이 또 나오면

지적한다. 깊이 2 이상(콜백·JSX 안)은 보지 않는다.

실행: `python scripts/gate-hook-order.py`  (prebuild 가 부른다)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

FUNC = re.compile(r"^(?:export\s+default\s+)?function\s+([A-Z]\w*)\s*\(")
HOOK = re.compile(r"\b(use[A-Z]\w*)\s*\(")
RETURN_VIEW = re.compile("return[ \t]*[(<]")


def scan(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        m = FUNC.match(lines[i])
        if not m:
            i += 1
            continue
        name = m.group(1)
        depth = 0
        returned_at = None
        j = i
        while j < len(lines):
            code = re.sub(r"//.*$", "", lines[j])
            if j > i and depth == 0:
                break
            # 화면을 그리고 끝나는 return 인가. 들여쓰기는 보지 않는다 —
            # 실제 사고는 `if (...) {` 안의 4칸짜리 return 에서 났다.
            if returned_at is None and RETURN_VIEW.search(code):
                nxt = " ".join(lines[j:j + 3])
                if "<" in nxt:
                    returned_at = j + 1
            elif returned_at is not None and depth == 1:
                h = HOOK.search(code)
                if h:
                    out.append(f"{path.relative_to(ROOT)}:{j + 1}  {name}() — "
                               f"{returned_at}줄의 화면 분기 뒤에 {h.group(1)}")
                    returned_at = None      # 한 함수당 한 번만 알린다
            depth += code.count("{") - code.count("}")
            j += 1
        i = j
    return out


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    problems: list[str] = []
    n = 0
    for p in sorted(SRC.rglob("*.jsx")):
        n += 1
        problems += scan(p)
    print(f"[훅순서] 파일 {n}개 검사 · 지적 {len(problems)}건")
    for x in problems:
        print(f"  ✗ {x}")
    if problems:
        print("     화면 분기보다 위로 옮겨라. 안 그러면 그 화면에서 React #310 이 난다.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
