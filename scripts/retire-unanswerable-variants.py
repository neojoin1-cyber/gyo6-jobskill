#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
풀 수 없는 변형 문항을 출제에서 뺀다.

### 왜 빼나

게이트가 지적한 23문항은 고칠 수 없는 것들이다.

    "행사 준비를 위해 5개 업무(A~E)를 … 다음 조건을 모두 만족하는 순서를 고르시오"
    자료: (비어 있음)

**그 '다음 조건'이 어디에도 없다.** 조건을 지어내면 복구가 아니라 창작이고,
원본 교재에도 같은 문항이 없어 되살릴 근거가 없다. 발문 자리에 지문 꼬리나
제작 안내("3단계: …")가 들어간 것들도 마찬가지로 무엇을 묻는지 알 수 없다.

이 문항들은 모의평가에 그대로 나간다. 학생은 풀 수 없는 문제를 만나 찍고,
틀리고, 오답노트에 쌓인다. **찍을 수밖에 없는 문항을 남겨 두는 것보다 빼는
것이 낫다.** 뺀 자리는 같은 영역의 다른 문항이 채운다.

무엇을 왜 뺐는지 `excludeReason` 에 남긴다. 나중에 원본을 찾으면 되살릴 수 있다.

실행: `python scripts/retire-unanswerable-variants.py [--dry-run]`
"""

from __future__ import annotations

import importlib.util
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BANKS = [ROOT / "data" / "ncs-variants.json", ROOT / "data" / "job-variants.json"]

REASON = {
    "가리키는 자료": "발문이 가리키는 조건·표·자료가 문항 어디에도 없어 풀 수 없다. "
                 "조건을 지어내면 복구가 아니라 창작이므로 출제에서 제외한다.",
    "발문에 질문": "발문 자리에 지문 조각이 들어가 무엇을 묻는지 알 수 없다. "
                "원본에 같은 문항이 없어 질문을 되살릴 근거가 없다.",
    "발문이 제작용": "발문이 문항 제작용 안내문이다. 학생에게 물을 질문이 아니다.",
    "해설의 결론": "해설이 정답과 다른 답을 계산한다. 어느 쪽이 옳은지 자료만으로 정할 수 없다.",
}


def load_gate():
    spec = importlib.util.spec_from_file_location(
        "gate", ROOT / "scripts" / "gate-question-quality.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv
    gate = load_gate()

    total = 0
    for bank in BANKS:
        if not bank.exists():
            continue
        raw = json.loads(bank.read_text(encoding="utf-8"))

        found: list = []

        def gather(node):
            if isinstance(node, list):
                for x in node:
                    gather(x)
            elif isinstance(node, dict):
                if isinstance(node.get("choices"), list) and node.get("stem"):
                    found.append(node)
                for v in node.values():
                    if isinstance(v, (list, dict)):
                        gather(v)

        gather(raw)

        n = 0
        for q in found:
            if q.get("excludeFromQuiz"):
                continue
            msgs = list(gate.check(q, bank.name))
            if not msgs:
                continue
            why = next((r for k, r in REASON.items() if any(k in m for m in msgs)), None)
            if why is None:
                continue
            q["excludeFromQuiz"] = True
            q["excludeReason"] = why
            n += 1
            print(f"    · {(q.get('stem') or '')[:52]}")
        if n and not dry:
            shutil.copyfile(bank, bank.with_suffix(".json.bak"))
            bank.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
        print(f"[변형정리] {bank.name}: {n}문항 출제 제외")
        total += n

    print(f"[변형정리] 합계 {total}문항" + (" (--dry-run)" if dry else " ✅"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
