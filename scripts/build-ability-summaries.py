#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
하위능력 요점정리를 합치고 **직접 검사한다**.

NCS 자율학습은 하위능력(문서소통능력 등)을 골라 들어오는데, 요점정리는 영역
(의사소통능력) 단위로만 있었다. 고른 것과 배우는 것이 어긋나 있었다.

블록별로 나눠 쓴 21개를 `data/ability-summaries.json` 하나로 합친다. 합치기 전에
규격을 실제로 검사한다 — 작성자가 "다 지켰다"고 해도 그대로 믿지 않는다.

검사 항목
  · 21개 하위능력이 빠짐없이 있는가(표준 목록과 대조)
  · keyPoints 6~8개 · learn 이 💡 로 시작 · sampleQuestion 이 `→ 정답: N` 로 끝
  · 보기 표기가 ①②③④ 인가(앱은 번호로 그리므로 A. 같은 표기가 섞이면 안 된다)
  · 정답 번호가 보기 개수 안에 있는가
  · mode 가 이해/적용/종합 중 하나이고 한쪽에 몰리지 않는가
  · mustRemember 5개 · terms 3~5개 · tips 3개
  · 마크다운 표시가 문장에 섞이지 않았는가

하나라도 어긋나면 합치지 않는다. 반쯤 맞는 자료를 넣으면 화면에서 터지거나,
더 나쁘게는 조용히 이상한 것이 학생에게 보인다.

실행: `python scripts/build-ability-summaries.py`
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "ability-summaries.json"
ABILITIES = Path("D:/apps/sugar-salt-build/_data/ability-list.json")

MODES = {"이해", "적용", "종합"}
CIRCLED = "①②③④⑤"
ANSWER_LINE = re.compile(r"→\s*정답\s*[:：]\s*([①②③④⑤]|\d)\s*$")
MARKDOWN = re.compile(r"\*\*|^#{1,6}\s", re.M)


def check(name: str, s: dict) -> list[str]:
    bad = []
    kp = s.get("keyPoints") or []
    if not 6 <= len(kp) <= 8:
        bad.append(f"keyPoints {len(kp)}개 (6~8이어야 함)")
    if not (s.get("title") or "").strip():
        bad.append("title 없음")
    if not (s.get("intro") or "").strip():
        bad.append("intro 없음")

    modes = []
    for i, k in enumerate(kp, 1):
        learn = k.get("learn") or ""
        sq = (k.get("sampleQuestion") or "").strip()
        if not learn.startswith("💡"):
            bad.append(f"keyPoint {i}: learn 이 💡 로 시작하지 않음")
        if MARKDOWN.search(learn) or MARKDOWN.search(sq):
            bad.append(f"keyPoint {i}: 마크다운 표시가 섞임")
        m = ANSWER_LINE.search(sq)
        if not m:
            bad.append(f"keyPoint {i}: sampleQuestion 이 '→ 정답: N' 으로 끝나지 않음")
        else:
            marks = [c for c in CIRCLED if c in sq]
            if len(marks) < 4:
                bad.append(f"keyPoint {i}: 보기 표기가 ①②③④ 가 아님")
            ans = m.group(1)
            idx = CIRCLED.index(ans) + 1 if ans in CIRCLED else int(ans)
            if not 1 <= idx <= len(marks):
                bad.append(f"keyPoint {i}: 정답 {ans} 가 보기 {len(marks)}개 밖")
        if re.search(r"(?<![A-Za-z])[A-E][.)]\s", sq):
            bad.append(f"keyPoint {i}: 보기에 A. 같은 알파벳 표기가 섞임")
        if k.get("mode") not in MODES:
            bad.append(f"keyPoint {i}: mode 가 {k.get('mode')!r}")
        else:
            modes.append(k["mode"])
    if modes and len(set(modes)) == 1 and len(modes) >= 6:
        bad.append(f"mode 가 전부 {modes[0]} 하나로 몰림")

    if len(s.get("mustRemember") or []) != 5:
        bad.append(f"mustRemember {len(s.get('mustRemember') or [])}개 (5개여야 함)")
    if not 3 <= len(s.get("terms") or []) <= 5:
        bad.append(f"terms {len(s.get('terms') or [])}개 (3~5개여야 함)")
    for t in s.get("terms") or []:
        if not (t.get("word") and t.get("def")):
            bad.append("terms 에 word/def 가 빠진 항목")
            break
    if len(s.get("tips") or []) != 3:
        bad.append(f"tips {len(s.get('tips') or [])}개 (3개여야 함)")

    return [f"{name}: {b}" for b in bad]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    if not ABILITIES.exists():
        print(f"[요점정리] 표준 하위능력 목록이 없다: {ABILITIES}")
        return 1
    want = [a["ability"] for a in json.loads(ABILITIES.read_text(encoding="utf-8"))]

    merged, problems = {}, []
    for p in sorted(DATA.glob("ability-summaries-block*.json")):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            problems.append(f"{p.name}: JSON 파싱 실패 — {e}")
            continue
        print(f"    {p.name}: {len(d)}개")
        for k, v in d.items():
            if k in merged:
                problems.append(f"{k}: 두 블록에 중복")
            merged[k] = v
            problems += check(k, v)

    missing = [a for a in want if a not in merged]
    extra = [k for k in merged if k not in want]
    if missing:
        problems.append(f"빠진 하위능력 {len(missing)}개: {missing}")
    if extra:
        problems.append(f"표준에 없는 이름 {extra}")

    kp = [len(v.get("keyPoints") or []) for v in merged.values()]
    print(f"[요점정리] {len(merged)}/21개 · keyPoints {min(kp) if kp else 0}~{max(kp) if kp else 0}개 "
          f"· 위반 {len(problems)}건")
    for p_ in problems[:20]:
        print(f"  ✗ {p_}")
    if problems:
        print("           ❌ 규격 위반이 있어 합치지 않는다.")
        return 1

    OUT.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"           ✅ {OUT.name} 저장 (하위능력 {len(merged)}개)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
