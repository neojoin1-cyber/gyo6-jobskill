#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
훈화 원고 블록을 합치고 **직접 검사한다**.

블록별로 나눠 쓴 원고를 `data/morning-talks.json` 하나로 합친다. 합치기 전에
규격을 실제로 검사한다 — 작성자가 "전부 지켰다"고 보고해도 그대로 믿지 않는다.

검사 항목
  · id 중복 / 편수
  · body 길이 250~400자
  · question.choices 4개, answer 가 A~D 범위 안
  · 보기 본문에 `A.` 같은 표기가 들어가지 않았는지(앱이 번호를 따로 붙인다)
  · 보기 중복
  · area 가 NCS 26v1 7영역 안인지
  · title / oneLine 중복
  · teacherNote.openQuestions 2개

하나라도 어긋나면 합치지 않고 목록을 찍는다. 반쯤 맞는 데이터를 넣으면
화면에서 터지거나, 더 나쁘게는 조용히 이상한 것이 보인다.

실행: `python scripts/build-morning-talks.py`
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "morning-talks.json"

AREAS = {"의사소통능력", "수리능력", "문제해결능력", "자기관리능력",
         "대인관계능력", "디지털능력", "직업윤리"}
LETTER_PREFIX = re.compile(r"^[A-E][.)]\s")


def check(t: dict, seen_ids: set, seen_titles: set, seen_lines: set) -> list[str]:
    bad = []
    tid = t.get("id", "(id없음)")

    if tid in seen_ids:
        bad.append("id 중복")
    seen_ids.add(tid)

    body = (t.get("body") or "").strip()
    if not 250 <= len(body) <= 400:
        bad.append(f"body {len(body)}자 (250~400 밖)")

    if not (t.get("oneLine") or "").strip():
        bad.append("oneLine 없음")
    if t.get("area") not in AREAS:
        bad.append(f"area 가 7영역 밖: {t.get('area')!r}")

    title = (t.get("title") or "").strip()
    if title in seen_titles:
        bad.append(f"title 중복: {title!r}")
    seen_titles.add(title)
    line = (t.get("oneLine") or "").strip()
    if line in seen_lines:
        bad.append(f"oneLine 중복: {line!r}")
    seen_lines.add(line)

    q = t.get("question") or {}
    ch = q.get("choices") or []
    if len(ch) != 4:
        bad.append(f"보기 {len(ch)}개 (4개여야 함)")
    if len(set(map(str, ch))) != len(ch):
        bad.append("보기 중복")
    if any(LETTER_PREFIX.match(str(c)) for c in ch):
        bad.append("보기 본문에 A. 같은 표기가 있음")
    if q.get("answer") not in ("A", "B", "C", "D"):
        bad.append(f"정답값 이상: {q.get('answer')!r}")
    if not (q.get("stem") or "").strip():
        bad.append("문항 발문 없음")
    if not (q.get("explanation") or "").strip():
        bad.append("문항 해설 없음")

    note = t.get("teacherNote") or {}
    if len(note.get("openQuestions") or []) < 2:
        bad.append("교사용 발문이 2개 미만")

    return [f"{tid}: {b}" for b in bad]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    blocks = sorted(DATA.glob("morning-talks-block*.json"))
    if not blocks:
        print("[훈화] 블록 파일이 없다")
        return 1

    talks, problems = [], []
    seen_ids, seen_titles, seen_lines = set(), set(), set()
    for b in blocks:
        try:
            items = json.loads(b.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            problems.append(f"{b.name}: JSON 파싱 실패 — {e}")
            continue
        if not isinstance(items, list):
            problems.append(f"{b.name}: 최상위가 배열이 아니다")
            continue
        print(f"    {b.name}: {len(items)}편")
        for t in items:
            problems += check(t, seen_ids, seen_titles, seen_lines)
            talks.append(t)

    talks.sort(key=lambda t: t.get("id", ""))
    lens = [len((t.get("body") or "")) for t in talks]
    areas = {}
    for t in talks:
        areas[t.get("area")] = areas.get(t.get("area"), 0) + 1

    print(f"[훈화] {len(talks)}편 · body {min(lens)}~{max(lens)}자 · 위반 {len(problems)}건")
    print("       영역별: " + " · ".join(f"{k} {v}" for k, v in sorted(areas.items(), key=lambda x: -x[1])))
    for p in problems[:20]:
        print(f"  ✗ {p}")
    if problems:
        print("       ❌ 규격 위반이 있어 합치지 않는다.")
        return 1

    OUT.write_text(json.dumps(talks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"       ✅ {OUT.name} 저장")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
