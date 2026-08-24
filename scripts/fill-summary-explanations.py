#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
요점정리 예시문항의 빈 해설을 채운다.

### 무엇이 비어 있었나

요점정리 안의 예시문항 19곳(서로 다른 문항 8개)이 `explanation: null` 이었다.
학생은 답만 보고 **왜 그런지는 알 수 없다.** 요점정리는 문제 푸는 기준을
익히는 자리인데, 기준이 빠져 있으면 답을 외우는 자리가 된다.

정답 자체는 여덟 개 모두 검산해 옳았다. 그래서 답은 건드리지 않고 해설만 쓴다.
같은 문항이 여러 차시에 재사용돼 있어(최대 4곳) 발문으로 찾아 모두 채운다.

### 왜 오답까지 짚나

"C가 답이다"만 적으면 다음에 비슷한 문항에서 또 틀린다. **왜 나머지가 아닌지**를
한 줄이라도 적어야 판단 기준이 남는다.

실행: `python scripts/fill-summary-explanations.py [--dry-run]`
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "study-summaries.json"

# 발문의 앞부분 → 해설. 정답은 이미 옳으므로 손대지 않는다.
EXPLANATIONS = {
    "작년 매출 8,000만원, 올해 매출 9,200만원":
        "증가율은 '늘어난 만큼 ÷ 원래 값'입니다. 늘어난 만큼은 9,200 − 8,000 = 1,200만원이고 "
        "원래 값은 작년 매출 8,000만원이므로 1,200 ÷ 8,000 × 100 = 15%입니다. "
        "올해 매출로 나누거나(1번) 뒤집어 나누면(3번) 기준이 달라져 다른 값이 나옵니다.",
    "고객 불만이 급증했지만 원인은 아직 확정":
        "원인을 모를 때도 고객에게는 '지금 무엇을 하고 있는지'를 알려야 합니다. "
        "현황을 인정하고 조사와 임시 대응을 함께 안내하는 것이 그 답입니다. "
        "전면 보상 약속(1번)은 원인도 모르는 채 책임 범위를 정하는 것이고, "
        "글 삭제(2번)나 침묵(4번)은 불신을 키웁니다.",
    "오늘 마감 업무 3개가 있고 인력은 2명":
        "마감이 같다면 영향이 큰 일부터, 인력이 모자라면 미룰 수 있는 일을 옮깁니다. "
        "A는 고객 영향이 크고 2명이 필요하므로 먼저 배정하고, C는 내일 오전까지 가능하니 조정합니다. "
        "셋을 조금씩 나누면(3번) 어느 것도 마감에 닿지 못합니다.",
    "AI 검색 결과가 '정부 지원금 신청 마감이 다음 주'":
        "AI 답변은 그럴듯해도 사실과 다를 수 있어 원래 출처에서 확인해야 합니다. "
        "마감일 같은 사실은 소관 기관의 공고문과 신청 시스템이 1차 출처입니다. "
        "블로그(2번)나 동료의 말(4번)은 또 다른 2차 정보일 뿐입니다.",
    "업무 자동화 매크로를 처음 적용":
        "자동화는 되돌릴 수 없는 변경을 한꺼번에 일으킬 수 있어, "
        "백업 → 샘플 테스트 → 단계 적용 순서를 지킵니다. "
        "보안 경고를 끄거나(2번) 출처가 불분명한 것을 쓰는 것(4번)은 위험을 키웁니다.",
    "타 부서와 공동 프로젝트 중 비용 초과":
        "비용 초과는 혼자 판단해 처리할 수 있는 일이 아닙니다. "
        "사실과 영향 범위를 관련 부서 책임자에게 알리고 정해진 조정 절차를 밟아야 합니다. "
        "숨기면(2번) 나중에 더 큰 문제가 되고, 개인 판단으로 집행하면(4번) 규정 위반이 됩니다.",
    "가장 책임 있는 행동은 무엇인가요":
        "잘못된 정보가 나갔다면 먼저 보고하고 고객에게 바로잡아 알리는 것이 순서입니다. "
        "고객이 모른다고 넘어가거나(1번) 문제 제기를 기다리는 것(4번)은 피해를 키우고, "
        "책임을 넘기거나(3번) 틀린 정보를 덮는 설명을 덧붙이면(5번) 신뢰를 잃습니다.",
    "친척이 운영하는 업체가 학교 행사 물품 견적":
        "이해관계가 있으면 숨기지 말고 공개한 뒤 평가에서 빠지는 것이 원칙입니다. "
        "관계를 숨기고 공정하게 평가하겠다는 것(4번)은 결과가 옳아도 절차가 무너집니다. "
        "참여 자체를 금지하는 것(5번)은 규정에 없는 과한 조치입니다.",
}


def walk(node, counter: dict) -> bool:
    changed = False
    if isinstance(node, list):
        for x in node:
            changed |= walk(x, counter)
    elif isinstance(node, dict):
        stem = node.get("stem")
        if isinstance(stem, str) and isinstance(node.get("choices"), list):
            if not (node.get("explanation") or "").strip():
                for key, text in EXPLANATIONS.items():
                    if stem.startswith(key) or key in stem:
                        node["explanation"] = text
                        counter[key] = counter.get(key, 0) + 1
                        changed = True
                        break
        for v in node.values():
            if isinstance(v, (list, dict)):
                changed |= walk(v, counter)
    return changed


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv
    data = json.loads(TARGET.read_text(encoding="utf-8"))

    counter: dict = {}
    changed = walk(data, counter)
    filled = sum(counter.values())
    print(f"[요점해설] {len(counter)}종 문항 · {filled}곳 채움" + (" (--dry-run)" if dry else ""))
    for k, v in counter.items():
        print(f"    {v}곳 — {k[:40]}")

    # 남은 빈 해설이 있으면 EXPLANATIONS 에 없는 문항이다.
    left: list = []

    def scan(n):
        if isinstance(n, list):
            for x in n:
                scan(x)
        elif isinstance(n, dict):
            if isinstance(n.get("choices"), list) and n.get("stem") \
                    and not (n.get("explanation") or "").strip():
                left.append(n["stem"][:44])
            for v in n.values():
                if isinstance(v, (list, dict)):
                    scan(v)

    scan(data)
    print(f"           빈 해설 잔존 {len(left)}곳" + ("" if dry else (" ✅" if not left else " ⚠️")))
    for s in left[:5]:
        print(f"    · {s}")

    if changed and not dry:
        shutil.copyfile(TARGET, TARGET.with_suffix(".json.bak"))
        TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
