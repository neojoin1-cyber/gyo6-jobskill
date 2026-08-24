#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
문항 데이터에 남은 제작용 라벨을 걷어낸다.

### 무엇이 보이고 있었나

과목별 화면을 밟다가 학생용 자료에서 발견했다.

    📋 지문 / 상황
    💡 핵심 정리 【고객서비스팀 월례회의록】 참석자: 박과장(팀장)…

`💡 핵심 정리` 는 교재를 만들 때 쓰던 편집 표시다. 학생에게는 아무 뜻이 없고,
자료의 첫 줄을 차지해 진짜 자료가 무엇인지 흐린다. 같은 계열로
`기초 1번`·`재도전 2번` 같은 제작 번호와 `접근법 안내:` 도 함께 남아 있다.

    노출 문항 기준  💡 핵심 정리 76 · 접근법 안내 31 · 기초/재도전 N번 29

앞서 티켓 900 이 `[기초]`·`재도전 문항` 같은 라벨 1,531건을 걷어냈지만
그건 **전자책 HTML** 이었다. 문항 JSON 은 손대지 않아 그대로 남아 있었다.

### 무엇을 지우고 무엇을 남기나

- 지운다: 편집 표시(`💡 핵심 정리`), 제작 번호(`기초 1번`), 작성 안내(`접근법 안내:`)
- 남긴다: 자료 본문·발문·보기·해설의 내용은 한 글자도 건드리지 않는다

해설 앞머리의 `기초 1번 정답 및 해설 기초 1번 정답: ②` 같은 중복 표기도
`정답:` 한 번으로 줄인다. 같은 말이 세 번 반복돼 읽기 어렵다.

실행: `python scripts/strip-production-labels.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

FIELDS = ("stem", "context", "explanation")

# (규칙, 바꿀 말). 순서가 중요하다 — 긴 것부터 지워야 조각이 남지 않는다.
RULES: list[tuple[re.Pattern, str]] = [
    # "기초 1번 정답 및 해설 기초 1번 정답: ②" → "정답: ②"
    (re.compile(r"(기초|표준|고급|심화|재도전|진단)\s*\d*\s*번?\s*정답\s*및\s*해설\s*"
                r"(?:(기초|표준|고급|심화|재도전|진단)\s*\d*\s*번?\s*)?정답\s*[:：]?\s*"), "정답: "),
    (re.compile(r"(기초|표준|고급|심화|재도전|진단)\s*\d*\s*번?\s*정답\s*및\s*해설\s*"), "해설: "),
    # 편집 표시
    (re.compile(r"💡\s*핵심\s*정리\s*"), ""),
    (re.compile(r"📋\s*지문\s*/\s*상황\s*"), ""),
    # 작성 안내
    (re.compile(r"접근법\s*(?:안내)?\s*[:：]\s*"), ""),
    # 제작 번호 — 뒤에 내용이 이어질 때만 지운다("기초 1번" 단독은 문항 구분일 수 있다)
    (re.compile(r"(?<![가-힣])(기초|표준|고급|심화|재도전)\s*\d+\s*번\s+(?=\S)"), ""),
    # 대괄호로 감싼 제작 번호. 발문 복구로 자료 앞머리에 드러난 것들이다.
    (re.compile(r"\[\s*(기초|표준|고급|심화|재도전|진단)\s*\d*\s*번?\s*\]\s*"), ""),
    # '기초 수준 1번', '재도전 2', '문항 1' — 자료복원으로 앞머리에 새로 드러난 꼴.
    # 앞선 규칙은 '번'이 붙은 것만 잡아서 이 셋이 그대로 남아 있었다.
    (re.compile(r"^(기초|표준|고급|심화|재도전|진단)\s*수준\s*\d+\s*번?\s*(?=\S)"), ""),
    (re.compile(r"^(기초|표준|고급|심화|재도전|진단)\s+\d+\s*(?=[가-힣])"), ""),
    # 번호가 제 줄에 홀로 선 꼴("기초 1" 다음 줄부터 자료). 위 규칙은 뒤에
    # 한글이 바로 붙은 것만 잡아서 이 꼴을 놓쳤다.
    (re.compile(r"^(기초|표준|고급|심화|재도전|진단)\s*\d+[ \t]*\n"), ""),
    (re.compile(r"^문항\s*\d+\s*(?=[–\-·\n])"), ""),
    # 번호 없이 "기초 문항"만 남은 꼴. 숫자를 요구하는 규칙들이 전부 비껴갔다.
    (re.compile(r"^(기초|표준|고급|심화|재도전|진단)\s*문항\s+(?=\S)"), ""),
    # 발문 앞머리의 "문제:" / "문제." — 발문 자리에 있는 것이 문제인 건 당연하다.
    (re.compile(r"^문제\s*[.:：]\s*(?=\S)"), ""),
    # 발문 끝의 교재 출처 표기. 학생에게는 뜻이 없고 문장만 늘어진다.
    (re.compile(r"\s*[(（]\s*교재[^)）]*[)）]\s*$"), ""),
    (re.compile(r"\s*[(（]\s*(표준|기초|심화|고급|재도전)\s*문제\s*\d*\s*[)）]\s*$"), ""),
    (re.compile(r"(진단|기초|표준|고급|심화|재도전)\s*문항\s*정답\s*및\s*해설\s*"
                r"(?:(진단|기초|표준|고급|심화|재도전)\s*문항\s*)?정답\s*[:：]?\s*"), "정답: "),
]

# 지우고 나서 이런 꼴이 남으면 안 된다.
# 💡 전체를 잡으면 안 된다 — 학습 자료의 "💡 팁 1: 3초 룰 활용하기" 처럼
# 의도된 강조 표시가 272건 있고, 그건 지우면 오히려 내용이 상한다.
# 제작 라벨인 "💡 핵심 정리" 만 잡는다.
LEFTOVER = re.compile(r"💡\s*핵심\s*정리|📋\s*지문\s*/|접근법\s*안내\s*[:：]|정답\s*및\s*해설\s*정답")


def clean(text: str) -> str:
    for rule, repl in RULES:
        text = rule.sub(repl, text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def discover() -> list[Path]:
    """앱이 실제로 import 하는 문항 파일만 손댄다."""
    names = set()
    for src in (ROOT / "src").rglob("*.js*"):
        for m in re.finditer(r"from\s+'[^']*?/data/([A-Za-z0-9._-]+\.json)'",
                             src.read_text(encoding="utf-8", errors="ignore")):
            names.add(m.group(1))
    return sorted(DATA / n for n in names if (DATA / n).exists())


def walk(node, counter: dict) -> bool:
    """중첩 구조 어디에 있든 문항 필드를 찾아 정리한다."""
    changed = False
    if isinstance(node, list):
        for item in node:
            changed |= walk(item, counter)
    elif isinstance(node, dict):
        for key in FIELDS:
            val = node.get(key)
            if isinstance(val, str) and val:
                new = clean(val)
                if new != val:
                    node[key] = new
                    counter[key] = counter.get(key, 0) + 1
                    changed = True
        for val in node.values():
            if isinstance(val, (list, dict)):
                changed |= walk(val, counter)
    return changed


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv

    total, touched = {}, []
    for path in discover():
        raw = path.read_text(encoding="utf-8")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        counter: dict = {}
        if walk(data, counter) and not dry:
            shutil.copyfile(path, path.with_suffix(".json.bak"))
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if counter:
            touched.append((path.name, sum(counter.values()), counter))
            for k, v in counter.items():
                total[k] = total.get(k, 0) + v

    print(f"[라벨정리] 파일 {len(touched)}개 · 필드 {sum(total.values())}곳 정리"
          + (" (--dry-run)" if dry else ""))
    for name, n, c in touched:
        print(f"    {name}: {n}곳 {c}")

    # 정리 후에도 남은 게 있으면 규칙이 부족한 것이다.
    left = 0
    for path in discover():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        blob = json.dumps(data, ensure_ascii=False)
        left += len(LEFTOVER.findall(blob))
    print(f"           잔존 라벨 {left}건" + ("" if dry else (" ✅" if left == 0 else " ⚠️ 규칙 보강 필요")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
