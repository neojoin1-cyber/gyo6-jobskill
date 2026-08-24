#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
교재 본문에 끼워 넣는 문항 사본을 **원본에서 다시 뜬다.**

### 왜 필요한가

같은 문항이 두 군데 있다. `questions.json` 이 원본이고,
`block-inline-job-common.json` 은 완전교재 본문 사이에 끼워 넣는 사본이다.
학생은 같은 문항을 문제풀이에서도 보고 교재를 읽다가도 만난다.

그런데 그동안 복구·정정은 원본에만 닿았다. 사본은 옛 상태로 남아
**한 문항이 두 얼굴**을 갖게 됐다.

    C15-14-Q04  발문은 "일정이 2주 지연될 것으로 예상된다…"
                보기는 "총무팀 박○○에게 직접 연락 / 팀장A에게 보고 후…"
                → 다른 문항의 보기가 붙어 있어 **답을 고를 수 없다**

    C01-0-Q03   사본 발문이 "기초 수준 1번 회사 게시판의 다음 공지사항에서…"
                → 원본에서 걷어 낸 제작 라벨이 사본에 그대로 남았다

167개 사본 가운데 39개만 원본과 같았다.

### 무엇을 하나

원본에 있는 문항이면 **발문·자료·보기·정답·해설을 원본 것으로 덮는다.**
사본에만 있는 필드(본문 배치 정보 등)는 건드리지 않는다.
원본에 없는 문항은 그대로 둔다 — 지울 근거가 없다.

이렇게 해 두면 앞으로 원본만 고치면 사본이 따라온다.

실행: `python scripts/sync-inline-copies.py [--dry-run]`
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANON = ROOT / "data" / "questions.json"
COPIES = [ROOT / "data" / "block-inline-job-common.json"]

# 원본이 가진 값으로 덮을 필드. 나머지는 사본 것을 그대로 둔다.
FIELDS = ("stem", "context", "choices", "answer", "explanation")


def walk(o):
    if isinstance(o, dict):
        if isinstance(o.get("choices"), list) and o.get("id"):
            yield o
        for v in o.values():
            yield from walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk(v)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv

    canon = {}
    for q in walk(json.loads(CANON.read_text(encoding="utf-8"))):
        canon.setdefault(q["id"], q)

    total_synced = 0
    for path in COPIES:
        if not path.exists():
            continue
        raw = json.loads(path.read_text(encoding="utf-8"))
        synced = missing = 0
        for q in walk(raw):
            src = canon.get(q["id"])
            if not src:
                missing += 1
                continue
            changed = False
            for f in FIELDS:
                want = src.get(f)
                if f == "choices":
                    want = list(want or [])
                if q.get(f) != want:
                    if want is None:
                        q.pop(f, None)
                    else:
                        q[f] = want
                    changed = True
            if changed:
                synced += 1
        if synced and not dry:
            path.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
        total_synced += synced
        print(f"    {path.name}: 원본과 맞춘 문항 {synced}개"
              + (f" · 원본에 없어 그대로 둔 것 {missing}개" if missing else ""))

    print(f"[본문사본] {total_synced}문항 동기화" + (" (--dry-run)" if dry else " ✅"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
