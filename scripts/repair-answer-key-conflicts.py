#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
해설이 계산해 놓은 답과 정답 키가 어긋난 문항을 바로잡는다.

### 어떻게 찾았나

정답 보기의 수치가 해설 어디에도 없는 문항을 훑고, 그중 **해설의 결론 수치가
다른 보기와 일치하는 것**만 남겼다. 해설이 스스로 다른 답을 가리키고 있다는
뜻이라 사람이 확인할 값어치가 있다. 이렇게 8건이 남았고, 하나하나 손으로
계산해 보니 다섯 가지 서로 다른 고장이었다.

    NCSX-v1-C074-Q08   해설 계산 127.5시간, 정답 키는 105시간  → **정답 키가 틀림**
    NCS-C076-diagnosis 연립방정식 답은 1,500원, 해설만 2,000원 → **해설이 틀림**
    NCS-C116-retry-1   해설이 100만원이라 해 놓고 160으로 더함 → **해설이 틀림**
    NCS-C114-standard-3 자료대로면 660만원인데 보기에 없음      → **보기가 틀림**
    NCS-C114-standard-4 조건이 답을 하나로 좁히지 못함          → **문항이 성립 안 함**

나머지 세 건(job-variants C20-19-Q05 등)은 검산해 보니 정상이었다. 다른 보기의
숫자가 해설에 등장했을 뿐이다. 건드리지 않는다.

### 원칙

- 계산이 옳고 키가 틀렸으면 **키를 고친다**.
- 키가 옳고 해설이 틀렸으면 **해설을 고친다**. 답은 그대로 둔다.
- 자료가 가리키는 값이 보기에 없으면 **그 보기 하나만** 자료에 맞춘다.
- 조건이 답을 결정하지 못하면 **출제에서 뺀다**. 지어내는 것보다 낫다.

같은 문항이 두 은행에 있으므로 **id 가 아니라 발문으로 찾아** 양쪽 다 고친다.

실행: `python scripts/repair-answer-key-conflicts.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# 변형 문항(ncs-variants·job-variants)도 모의평가에 그대로 나간다. 중첩 구조라
# 그동안 이 스크립트도 게이트도 못 보고 지나쳤고, 정답 키 오류 3건이 남아 있었다.
BANKS = [
    ROOT / "data" / "ncs-questions.json",
    ROOT / "data" / "ncs-extracted-bank.json",
    ROOT / "data" / "ncs-variants.json",
    ROOT / "data" / "job-variants.json",
]

# 발문의 일부(고유한 대목) → 손볼 내용
FIXES = [
    {
        "match": "A팀과 B팀의 작업량 비율이 3:5",
        "answer_text": "127.5시간",
        "explanation": (
            "A팀 기본 작업량 = 240 × (3/8) = 90시간, B팀 작업량 = 240 × (5/8) = 150시간입니다. "
            "B팀 작업의 25%를 A팀이 지원하므로 150 × 0.25 = 37.5시간이 더해집니다. "
            "따라서 A팀이 담당할 총 작업시간은 90 + 37.5 = 127.5시간입니다."
        ),
        "why": "해설의 계산(127.5시간)이 옳고 정답 키(105시간)가 틀렸다",
    },
    {
        # 변형 문항. 발문이 "아래 식을 계산한 값은?"인데 **식이 없다.**
        # 해설에 계산 과정이 남아 있어 식을 되살릴 수 있다.
        "match": "아래 식을 계산한 값은",
        "stem": "다음 식을 계산한 값은?\n\n200 + 15 × 4 − 60 ÷ 3",
        "answer_text": "240",
        "explanation": (
            "곱셈·나눗셈을 먼저 합니다. 15 × 4 = 60, 60 ÷ 3 = 20입니다. "
            "그다음 앞에서부터 더하고 빼면 200 + 60 − 20 = 240입니다."
        ),
        "why": "발문이 가리키는 식이 없었고, 정답 키(220)도 해설의 계산(240)과 어긋났다",
    },
    {
        "match": "분기 평균을 백만원 단위로 반올림해 보고하라",
        "answer_text": "48백만원",
        "explanation": (
            "(38,456,700 + 61,234,500 + 44,308,800) ÷ 3 = 144,000,000 ÷ 3 = 48,000,000원입니다. "
            "백만원 단위로 반올림하면 48백만원입니다."
        ),
        "why": "해설의 계산(48백만원)이 옳고 정답 키(49백만원)가 틀렸다",
    },
    {
        "match": "같은 증가 패턴이 유지될 때 6월 매출은",
        "answer_text": "3,200만원",
        "explanation": (
            "매달 2배씩 늘어나는 등비수열입니다(공비 2). "
            "4월 800만원 → 5월 1,600만원 → 6월 3,200만원입니다."
        ),
        "why": "해설의 계산(3,200만원)이 옳고 정답 키(6,400만원)가 틀렸다",
    },
    {
        "match": "제품 A와 제품 B의 하루 생산량의 합이 120개",
        # 추출본 쌍둥이는 정답 키까지 틀려 있었다(16개). 보기 본문으로 다시 맞춘다.
        "answer_text": "20개",
        "explanation": (
            "A + B = 120, 1.2A + 0.8B = 124입니다. B = 120 - A를 대입하면 "
            "1.2A + 96 - 0.8A = 124이므로 0.4A = 28, 즉 A = 70개이고 B = 50개입니다. "
            "따라서 A - B = 20개입니다."
        ),
        "why": "정답(20개)이 옳고 해설이 A=80·B=40으로 잘못 풀어 40개라고 적었다",
    },
    {
        "match": "볼펜 1자루와 노트 1권의 가격의 합이 3,500원",
        "explanation": (
            "볼펜을 x, 노트를 y라 하면 x + y = 3,500, 3x + 2y = 8,500입니다. "
            "첫 식을 y = 3,500 - x로 바꿔 대입하면 3x + 7,000 - 2x = 8,500이므로 x = 1,500원입니다. "
            "따라서 볼펜 1자루는 1,500원, 노트 1권은 2,000원입니다."
        ),
        "why": "정답(1,500원)이 옳고 해설이 노트 값을 볼펜 값으로 적었다",
    },
    {
        "match": "최종적으로 프로젝트 A가 사용 가능한 총 예산은",
        "explanation": (
            "프로젝트 B의 잔여 예산은 800 × (1 - 0.8) = 160만원입니다. "
            "이를 A와 C에 5:3으로 나누면 A는 160 × 5/8 = 100만원을 받습니다. "
            "예비비 200만원은 전액 A에 투입되므로, A의 총 예산은 1,000 + 100 + 200 = 1,300만원입니다."
        ),
        "why": "정답(1,300만원)이 옳고 해설이 100만원 대신 160만원을 더했다",
    },
    {
        "match": "장 부장의 배정 방식에 따른 D부서 최종 예산은",
        # 번호로 지정하면 보기 순서를 돌린 뒤 엉뚱한 자리를 덮어 보기가 중복된다.
        # 실제로 660만원이 두 개가 됐다. 바꿀 대상도 본문으로 지정한다.
        "choice_replace": ("650만원", "660만원"),
        "answer_text": "660만원",
        "explanation": (
            "A부서는 전액 2,000만원, B부서는 10% 삭감된 1,350만원입니다. "
            "잔여 예산은 5,000 - 2,000 - 1,350 = 1,650만원이고, C·D 요청 합계는 1,200 + 800 = 2,000만원입니다. "
            "같은 삭감률 1,650 ÷ 2,000 = 0.825를 적용하면 D부서는 800 × 0.825 = 660만원입니다."
        ),
        "why": "자료대로 계산하면 660만원인데 보기에 없어 정답이 존재하지 않았다",
    },
    {
        "match": "권 수석의 제안에 따른 외부인력 투입 규모는",
        "exclude": (
            "2단계에 필요한 인력이 6명이고 내부 보유 인력도 6명이라 자료만으로는 외부 충원이 "
            "필요한지조차 정해지지 않는다. 원본 해설도 '겹치는 기간을 고려하면'이라는 근거 없는 "
            "가정으로 3명을 도출한다. 조건을 지어내야 풀리므로 출제에서 제외한다."
        ),
        "why": "조건이 답을 하나로 좁히지 못한다",
    },
    {
        # 발문을 고치고 나면 예전 발문으로는 다시 찾지 못한다. 두 번 돌려도
        # 같은 결과가 나오도록 고치기 전·후 발문을 모두 적어 둔다.
        "match": ("D건설회사의 경영전략 수립 근거로 가장 적절한 것은",
                  "D건설회사가 리모델링 사업부 신설을 결정한 근거"),
        "stem": "D건설회사가 리모델링 사업부 신설을 결정한 근거 중, 외부 환경에서 찾은 기회 요인은?",
        "explanation": (
            "외부 환경 요인은 회사가 통제할 수 없는 시장·정책 쪽의 변화입니다. "
            "부동산 정책 강화는 외부의 위협이고, 리모델링 시장이 20% 성장한 것은 외부의 기회입니다. "
            "리모델링 경험과 기술진은 회사가 이미 가진 내부 강점이고, 사업부 신설과 매출 목표는 "
            "근거가 아니라 그 근거로 세운 전략과 목표입니다."
        ),
        "why": "'근거'만 물으면 외부 기회(B)와 내부 강점(C)이 모두 답이 된다",
    },
]

LABEL = re.compile(r"^\d+번\s*【[^】]+】\s*")


def choices_of(q):
    c = q.get("choices")
    return c if isinstance(c, list) else None


def apply(q, fix) -> list[str]:
    done = []
    # 정답을 **보기 본문**으로 지정한다. 보기 순서를 돌리는 작업이 있어
    # 번호로 적어 두면 다음 배치에서 엉뚱한 것을 가리킨다.
    if "choice_replace" in fix:
        old_t, new_t = fix["choice_replace"]
        ch = choices_of(q) or []
        # 이미 고쳐져 있으면 손대지 않는다. 이 확인이 없으면 두 번째 실행이
        # 다른 보기를 덮어 같은 보기가 두 개가 된다 — 실제로 그렇게 깨졌다.
        if new_t in [str(c).strip() for c in ch]:
            old_t = None
        for i, c in enumerate(ch):
            if old_t is None:
                break
            if str(c).strip() == old_t:
                ch[i] = new_t
                done.append(f"보기{chr(65 + i)} '{old_t}'→'{new_t}'")
                break
    if "answer_text" in fix:
        ch = choices_of(q) or []
        want = fix["answer_text"]
        idx = next((i for i, c in enumerate(ch) if str(c).strip() == want), None)
        if idx is not None and q.get("answer") != chr(65 + idx):
            done.append(f"정답 {q.get('answer')}→{chr(65 + idx)}({want})")
            q["answer"] = chr(65 + idx)
    # 번호(A~E)로 정답을 지정하는 길은 없앴다. 보기 순서를 돌리는 작업이 있어
    # 번호로 적어 두면 나중에 엉뚱한 보기를 가리킨다 — 실제로 두 문항이 그렇게 깨졌다.
    if "answer" in fix:
        raise RuntimeError(f"{q.get('id')}: 정답은 answer_text(보기 본문)로 지정해야 한다")
    if "stem" in fix and q.get("stem") != fix["stem"]:
        done.append("발문 정정")
        q["stem"] = fix["stem"]
    if "explanation" in fix and q.get("explanation") != fix["explanation"]:
        done.append("해설 정정")
        q["explanation"] = fix["explanation"]
    if "exclude" in fix and not q.get("excludeFromQuiz"):
        q["excludeFromQuiz"] = True
        q["excludeReason"] = fix["exclude"]
        done.append("출제 제외")
    # 자료 앞머리의 제작 라벨("8번 【재도전】")도 함께 걷는다.
    ctx = q.get("context") or ""
    if LABEL.match(ctx.strip()):
        q["context"] = LABEL.sub("", ctx.strip()).strip() or None
        done.append("제작 라벨 제거")
    if done:
        q["answerKeyRepaired"] = fix["why"]
    return done


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv
    total = 0

    for bank in BANKS:
        raw = json.loads(bank.read_text(encoding="utf-8"))
        # 중첩 구조에서도 문항을 모두 찾아낸다. 최상위 배열만 보면 변형 문항을
        # 통째로 놓친다 — 그래서 정답 키 오류 3건이 모의평가에 그대로 나갔다.
        data: list = []

        def gather(node):
            if isinstance(node, list):
                for x in node:
                    gather(x)
            elif isinstance(node, dict):
                if isinstance(node.get("choices"), list) and node.get("stem"):
                    data.append(node)
                for v in node.values():
                    if isinstance(v, (list, dict)):
                        gather(v)

        gather(raw)
        touched = 0
        for fix in FIXES:
            for q in data:
                keys = fix["match"]
                keys = keys if isinstance(keys, tuple) else (keys,)
                if not any(k in (q.get("stem") or "") for k in keys):
                    continue
                done = apply(q, fix)
                if done:
                    touched += 1
                    print(f"    ✔ {bank.name} / {q.get('id')}  {' · '.join(done)}")
                    print(f"        까닭: {fix['why']}")
        if touched and not dry:
            shutil.copyfile(bank, bank.with_suffix(".json.bak"))
            bank.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
        total += touched

    print(f"[정답키정정] {total}건" + (" (--dry-run)" if dry else " ✅"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
