#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
해설만 손으로 다시 쓴 문항을 반영한다.

`sync-explanation-letters.py` 는 자리바꿈을 역산해 해설의 보기 글자를 고친다.
그런데 해설 안에 'Building C', 'B(나사)', 'C품목' 처럼 보기 번호가 아닌 알파벳이
섞여 있으면 무엇을 옮겨야 하는지 기계가 판단할 수 없다. 그런 문항은 손으로
다시 쓴 해설을 `data/explanation-fix.json` 에 두고 여기서 덮어쓴다.

정답 키는 건드리지 않는다. 해설이 부르는 번호가 실제 정답 자리와 맞는지는
`gate-question-quality.py` 가 매번 검사한다.

실행: `python scripts/apply-explanation-fix.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def discover() -> list[Path]:
    names = set()
    for src in (ROOT / "src").rglob("*.js*"):
        for m in re.finditer(r"from\s+'[^']*?/data/([A-Za-z0-9._-]+\.json)'",
                             src.read_text(encoding="utf-8", errors="ignore")):
            names.add(m.group(1))
    return sorted(DATA / n for n in names if (DATA / n).exists())


def walk(node, fixes: dict, hit: dict) -> bool:
    changed = False
    if isinstance(node, list):
        for x in node:
            changed |= walk(x, fixes, hit)
    elif isinstance(node, dict):
        qid = node.get("id")
        if qid in fixes and "choices" in node:
            # 이미 같은 해설이어도 '찾았다' 로 센다. 두 번째 실행에서 못 찾은 것으로
            # 세면 멀쩡한 파이프라인이 실패로 끝난다.
            hit[qid] = hit.get(qid, 0) + 1
            if node.get("explanation") != fixes[qid]:
                node["explanation"] = fixes[qid]
                changed = True
        for v in node.values():
            if isinstance(v, (list, dict)):
                changed |= walk(v, fixes, hit)
    return changed


def main() -> int:
    src = DATA / "explanation-fix.json"
    if not src.exists():
        print("[해설고침] data/explanation-fix.json 이 없다 — 건너뛴다")
        return 0
    fixes = json.loads(src.read_text(encoding="utf-8"))
    dry = "--dry-run" in sys.argv
    hit: dict = {}
    for p in discover():
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if walk(d, fixes, hit) and not dry:
            p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    missing = sorted(set(fixes) - set(hit))
    print(f"[해설고침] {len(hit)}/{len(fixes)}문항 반영" + (" (dry-run)" if dry else " ✅"))
    if missing:
        print(f"           문항을 못 찾음: {', '.join(missing)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
