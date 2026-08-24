#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
학생용 문항에서 잘려 나간 자료(조건·표·지문)를 원본에서 되살린다.

### 무엇이 잘못돼 있었나

문제해결능력 첫 문항을 학습 화면에서 열었더니 이렇게 나왔다.

    자료  신입사원 김대리는 A, B, C, D 네 개의 업무를 월~목요일에 하루에 하나씩
          처리해야 한다. **다음 조건을 만족하는** 업무 배정을 찾아야 한다.
    발문  위 조건을 모두 만족하는 업무 배정 순서로 옳은 것은?

**그 '다음 조건'이 없다.** 조건 목록이 통째로 빠져 있어 어떤 보기가 답인지
정할 방법이 없다. 정답은 A로 적혀 있지만 학생은 찍는 수밖에 없다.

같은 문항이 `ncs-extracted-bank.json`(원본 교재에서 기계로 뽑은 것)에는
조건 네 줄과 함께 온전히 남아 있었다.

    –A업무는 C업무보다 먼저 처리되어야 한다
    –B업무는 화요일 또는 수요일에 처리되어야 한다
    –D업무는 A업무 바로 다음 날에 처리되어야 한다
    –목요일에는 C업무가 처리되어야 한다

발문과 보기가 **글자 하나까지 같은** 짝이 344쌍 있고, 그중 131쌍에서
학생용 쪽 자료가 더 짧다. 편집 과정에서 잘려 나간 것이다.

### 어떤 경우에만 되살리나

내용을 지어내지 않는 것이 원칙이다. 다음 둘만 손댄다.

1. 학생용 자료가 사실상 없다(20자 미만)
2. 원본 자료가 학생용 자료를 **통째로 포함**한다(같은 글 + 빠진 부분)

둘 다 아니면 서로 다른 글이므로 건드리지 않고 목록에만 남긴다.

실행: `python scripts/restore-missing-context.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "ncs-questions.json"
SOURCE = ROOT / "data" / "ncs-extracted-bank.json"

MIN_GAP = 20          # 이만큼은 길어야 '빠졌다'고 본다

# 원본에 남은 아스키 도표. 이걸 되살리면 줄바꿈이 사라진 그림이 다시 화면에
# 나온다(앞서 표로 다시 만든 그 문항들이다). 자료가 길어도 가져오지 않는다.
ASCII_CHART = re.compile(r"[┤┴┬├┼─│■□]")


def flat(t) -> str:
    return re.sub(r"[\s'\"·,.()\[\]–\-]", "", str(t or ""))


def content_key(q):
    stem = flat(q.get("stem"))
    if len(stem) < 12:
        return None
    ch = q.get("choices")
    vals = ch if isinstance(ch, list) else (list(ch.values()) if isinstance(ch, dict) else [])
    return f"{stem}|{flat('|'.join(str(v) for v in vals))}"


def covered(mine: str, theirs: str) -> bool:
    """학생용 자료가 원본 안에 사실상 다 들어 있는가.

    학생용을 조각내어 원본에서 찾는 방식으로 두 번 헛짚었다. 목록을 지우면서
    앞뒤 문장이 한 줄로 붙어 버린 자리가 있어서, 어떤 크기로 자르든 그 자리는
    원본에 없다. 짧은 자료일수록 그 한 자리가 기준을 뒤집는다.

    방향을 뒤집는다. **원본의 조각들을 학생용에서 지워 나가고**, 남는 글자가
    얼마나 되는지 본다. 목록만 빠진 글이면 남는 것이 거의 없고, 문장을 고쳐
    쓴 글이면 원본 조각이 통째로는 안 맞아 큰 덩어리가 남는다.
    """
    small = flat(mine)
    if not small:
        return True
    rest = small
    parts = [p for p in re.split(r"[.\n\]\[]", theirs) if len(flat(p)) >= 5]
    for part in sorted(parts, key=lambda x: -len(flat(x))):
        rest = rest.replace(flat(part), "")
    return len(rest) / len(small) <= 0.15


# 원본에서 되살린 자료는 순서가 뒤집혀 있는 경우가 있다. 조건 목록이 먼저
# 나오고 "다음은 …이다" 같은 안내 문장이 맨 뒤에 붙는다. 앞선 발문복구가
# 질문을 앞으로 빼면서 남은 꼬리를 뒤에 붙여 둔 자국이다. 읽는 순서가
# 뒤집혀 있으면 학생은 무엇에 대한 목록인지 모른 채 목록부터 읽게 된다.
#
# 안내 문장은 "다음은 …이다"로 시작하기도 하고, "김대리는 … 처리해야 한다.
# 다음 조건을 만족하는 …을 찾아야 한다."처럼 두 문장일 때도 있다. 시작만 보면
# 뒤엣것을 놓친다 — 글 안에 다음/아래/위가 있고 끝이 서술형이면 안내로 본다.
LEAD_IN = re.compile(r"^.{0,160}(다음|아래|위).{0,160}(이다|한다|합니다|있다)[.]?$", re.S)
# "[상황] 신입사원 김현수는 … 확인하고 있다." 처럼 다음/아래/위 없이 장면만
# 소개하는 꼬리도 있다. 대괄호 표제로 시작하고 짧으면 안내로 본다.
SCENE_IN = re.compile(r"^\[(상황|배경|안내|사례)\].{0,120}$", re.S)
# 목록·표제로 시작하는 자료에서만 옮긴다. 그냥 이어지는 글이라면 마지막
# 문장이 결론일 수 있고, 결론을 앞으로 끌어내면 글이 망가진다.
# 목록이 "구매 규정:" 같은 표제 뒤 둘째 줄부터 시작하기도 하므로 첫 글자만
# 보지 않는다.
LIST_HEAD = re.compile(r"^([–\-•\[【※]|\d[).])|\n\s*([–\-•]|\d[).])")


def reorder_lead_in(text: str) -> str:
    blocks = [b.strip() for b in text.split("\n\n") if b.strip()]
    if len(blocks) < 2:
        return text
    last = blocks[-1]
    if not LIST_HEAD.search(blocks[0]):
        return text
    if not (LEAD_IN.match(last) or SCENE_IN.match(last)):
        return text
    return "\n\n".join([last] + blocks[:-1])


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv

    target = json.loads(TARGET.read_text(encoding="utf-8"))
    raw = json.loads(SOURCE.read_text(encoding="utf-8"))
    source = raw if isinstance(raw, list) else raw.get("questions", [])

    src_by_key = {}
    for q in source:
        k = content_key(q)
        if k and k not in src_by_key:
            src_by_key[k] = q

    restored, skipped = [], []
    for q in target:
        k = content_key(q)
        if not k or k not in src_by_key:
            continue
        mine = (q.get("context") or "").strip()
        theirs = (src_by_key[k].get("context") or "").strip()
        if len(theirs) <= len(mine) + MIN_GAP:
            continue
        if q.get("excludeFromQuiz") or ASCII_CHART.search(theirs):
            skipped.append((q.get("id"), src_by_key[k].get("id"), len(mine), len(theirs),
                            "아스키 도표" if ASCII_CHART.search(theirs) else "출제 제외 문항"))
            continue
        # 지어내지 않는다 — 내 자료가 없거나, 저쪽이 내 자료를 **다 담고** 있을 때만.
        #
        # 처음에는 문자열 통째로 포함되는지만 봤는데, 원본은 조건 목록을 앞에
        # 두고 안내 문장을 뒤에 두는 반면 학생용은 순서가 반대여서 20건이
        # 전부 '서로 다른 글'로 밀려났다. 실제로는 같은 글에서 목록만 빠진
        # 것이었다. 문장 단위로 하나씩 들어 있는지 본다.
        if len(mine) >= MIN_GAP and not covered(mine, theirs):
            skipped.append((q.get("id"), src_by_key[k].get("id"), len(mine), len(theirs),
                            "서로 다른 글"))
            continue
        q["context"] = reorder_lead_in(theirs)
        q["contextRestored"] = src_by_key[k].get("id")
        restored.append((q.get("id"), len(mine), len(theirs)))

    print(f"[자료복원] 되살림 {len(restored)}건 · 글이 달라 건너뜀 {len(skipped)}건"
          + (" (--dry-run)" if dry else ""))
    for r in restored[:10]:
        print(f"    ✔ {r[0]}  자료 {r[1]}자 → {r[2]}자")
    for s in skipped[:6]:
        print(f"    · {s[0]} ← {s[1]}  ({s[2]}자 vs {s[3]}자) {s[4]}")

    if restored and not dry:
        shutil.copyfile(TARGET, TARGET.with_suffix(".json.bak"))
        TARGET.write_text(json.dumps(target, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf-8")
        print(f"          ✅ 저장 완료 (원본은 {TARGET.name}.bak)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
