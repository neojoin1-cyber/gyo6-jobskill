#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
요점정리 예시문항에서 **내용을 몰라도 찍히는 단서**를 없앤다.

### 무엇이 잘못돼 있었나

21개 하위능력의 예시문항 154개를 실측했다.

    정답 위치   ①17  ②100  ③24  ④13     ← ②가 65%
    정답이 가장 긴 보기 (산문형 146개 중)  119개 = 82%

학생은 내용을 몰라도 **②를 찍거나 가장 긴 것을 고르면** 대부분 맞는다.
요점정리는 문제 푸는 법을 익히는 자리인데, 이대로면 '찍는 법'을 익힌다.

### 무엇을 하나

**위치 쏠림**은 여기서 기계적으로 없앤다. 보기 순서를 돌려 정답이 ①②③④에
고르게 가도록 재배치하고 `→ 정답:` 줄을 함께 고친다. 내용은 한 글자도
바뀌지 않는다 — 순서만 바뀐다.

돌리는 방향은 문항마다 정해진 값으로 계산한다(하위능력 이름 + 순번).
그래야 다시 돌려도 같은 결과가 나와 검토가 가능하다.

**길이 단서**는 여기서 못 고친다. 오답을 길게 쓰는 것은 내용을 새로 쓰는
일이라 기계가 할 수 없다. 이 스크립트는 실태를 숫자로 남기고, 남은 것은
사람이 손보게 목록으로 찍는다.

실행: `python scripts/debias-sample-questions.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CIRC = "①②③④⑤"
ANSWER = re.compile(r"(→\s*정답\s*[:：]\s*)([①②③④⑤])")


def parse(sq: str):
    """(머리말, [보기…], 정답인덱스, 꼬리말) 로 가른다. 못 가르면 None."""
    m = ANSWER.search(sq)
    if not m:
        return None
    head_end = None
    opts = []
    for om in re.finditer(r"([①②③④⑤])\s*([^\n]*)", sq[:m.start()]):
        if head_end is None:
            head_end = om.start()
        opts.append((om.group(1), om.group(2).rstrip()))
    if len(opts) < 4 or head_end is None:
        return None
    # 보기 표시가 ①부터 차례대로여야 한다. 아니면 본문의 원문자다.
    if [o[0] for o in opts] != list(CIRC[:len(opts)]):
        return None
    ai = CIRC.index(m.group(2))
    if ai >= len(opts):
        return None
    return sq[:head_end].rstrip(), [o[1] for o in opts], ai, sq[m.end():]


def rebuild(head, opts, ai, tail):
    return (head + "\n\n"
            + "\n".join(f"{CIRC[i]} {t}" for i, t in enumerate(opts))
            + f"\n\n→ 정답: {CIRC[ai]}" + tail)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv

    files = sorted(DATA.glob("ability-summaries-block*.json"))
    if not files:
        print("[예시문항] 블록 파일이 없다")
        return 1

    banks = {p: json.loads(p.read_text(encoding="utf-8")) for p in files}
    items = [(p, name, i, k)
             for p, d in banks.items()
             for name, s in d.items()
             for i, k in enumerate(s.get("keyPoints") or [])]

    before_pos, after_pos = {}, {}
    long_before = long_after = prose = 0
    moved = skipped = 0
    still_long = []

    # 정답이 ①②③④ 를 차례로 돌게 배정한다. 순서를 고정해 두면 다시 돌려도 같다.
    for n, (p, name, i, k) in enumerate(items):
        parsed = parse(k.get("sampleQuestion") or "")
        if not parsed:
            skipped += 1
            continue
        head, opts, ai, tail = parsed
        before_pos[ai + 1] = before_pos.get(ai + 1, 0) + 1
        lens = [len(o) for o in opts]
        is_prose = max(lens) > 12
        if is_prose:
            prose += 1
            long_before += (lens[ai] == max(lens))

        target = n % len(opts)                 # 이 문항의 정답이 갈 자리
        if target != ai:
            o = opts.pop(ai)
            opts.insert(target, o)
            moved += 1
        k["sampleQuestion"] = rebuild(head, opts, target, tail)
        after_pos[target + 1] = after_pos.get(target + 1, 0) + 1
        if is_prose and len(opts[target]) == max(len(x) for x in opts):
            long_after += 1
            still_long.append(f"{name} #{i + 1}")

    print(f"[예시문항] {len(items) - skipped}개 · 자리 옮김 {moved}개 · 못 읽음 {skipped}개")
    print(f"  정답 위치  전 {dict(sorted(before_pos.items()))}  →  후 {dict(sorted(after_pos.items()))}")
    print(f"  정답이 최장 보기(산문 {prose}개 중): 전 {long_before}개 "
          f"({long_before / max(prose,1) * 100:.0f}%) → 후 {long_after}개 "
          f"({long_after / max(prose,1) * 100:.0f}%)")
    print("  ⚠️ 길이 단서는 순서를 바꿔도 남는다. 오답을 길게 쓰는 것은 내용 작업이다.")

    if not dry:
        for p, d in banks.items():
            p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (DATA / "sample-question-length-cue.json").write_text(
            json.dumps(still_long, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"  저장 완료 · 길이 단서가 남은 {len(still_long)}개는 "
              f"data/sample-question-length-cue.json 에 목록화")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
