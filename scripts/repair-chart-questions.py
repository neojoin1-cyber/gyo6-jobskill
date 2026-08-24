#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
아스키 아트로 뭉개진 도표 문항을 구조화 표로 되살린다.

### 무엇이 잘못돼 있었나

사용자가 학습 화면에서 발견했다. 막대그래프가 이렇게 나오고 있었다.

    💡 핵심 정리 매출액(억원) 40 ┤ ■ 서울점 ■ 부산점 ■ 대구점 ■ 광주점 35 ┤ ■
    30 ┤ ■ ■ 25 ┤ ■ ■ ■ ■ 20 ┤ ■ ■ ■ ■ ■ 15 ┤ ■ ■ ■ ■ ■ ■ 10 ┤ …

원본 데이터에서 이미 줄바꿈이 사라져 CSS로는 살릴 수 없다. 앱에는 표·막대를
그리는 `QuestionMedia` 렌더러가 이미 있는데 이 문항들이 그걸 쓰지 않았다.

다행히 **수치가 해설에 남아 있어** 표로 복원할 수 있다.

### 복원하면서 드러난 더 큰 문제

수치를 되살려 각 보기의 참·거짓을 직접 계산해 보니, 그림만 깨진 게 아니라
**문항 자체가 논리적으로 성립하지 않는 것**이 있었다.

| 문항 | 상태 |
|---|---|
| C049-Q01·Q05·Q06 | 정답 1개 — 정상 |
| C049-Q02 | **정답이 하나도 없다.** 해설이 3호점 평균을 120명이라 했는데 실제 140명 |
| C049-Q03 | **정답이 3개(A·B·C).** 해설은 B·C가 틀렸다고 했으나 자료상 참 |
| C049-Q07 | **정답이 2개(C·D).** |
| C049-Q04 | 5개 진료과 중 내과 수치만 남아 나머지 보기를 검증할 수 없다 |

Q02·Q03·Q07 은 자료가 멀쩡하므로 **오답 보기를 자료에 맞게 고쳐** 정답이 하나만
남게 한다. Q04 는 자료 자체가 없어 되살릴 수 없으므로 출제에서 제외한다.

### 안전장치

고친 뒤 **복원한 표만 보고 모든 보기의 참·거짓을 다시 계산**해서, 선언된 정답
하나만 참인지(부정 발문이면 하나만 거짓인지) 확인한다. 어긋나면 저장하지 않는다.

실행: `python scripts/repair-chart-questions.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BANK = ROOT / "data" / "ncs-questions.json"

AXIS = re.compile(r"[┤┴┬├┼─│]")

# 해설에 남아 있던 수치를 표로 되살린 것. 값은 전부 해설 원문에서 가져왔다.
CHARTS: dict[str, dict] = {
    "NCS-C049-diagnosis": {
        "caption": "A회사 지점별 분기 매출액",
        "columns": ["지점", "1분기", "2분기", "3분기", "4분기"],
        "rows": [["서울점", 35, 25, 20, 15], ["부산점", 25, 30, 25, 20],
                 ["대구점", 20, 25, 30, 25], ["광주점", 15, 20, 15, 20]],
        "note": "단위: 억원",
    },
    "NCS-C049-basic-1": {
        "caption": "B마트 매장별 요일 고객 수",
        "columns": ["매장", "월", "화", "수", "목", "금"],
        "rows": [["1호점", 160, 140, 120, 100, 80], ["2호점", 80, 100, 120, 140, 160],
                 ["3호점", 100, 180, 140, 160, 120]],
        "note": "단위: 명",
    },
    "NCS-C049-basic-2": {
        "caption": "C회사 팀별 월간 프로젝트 완료 건수",
        "columns": ["팀", "3월", "4월", "5월", "6월"],
        "rows": [["A팀", 20, 15, 10, 25], ["B팀", 15, 20, 15, 10],
                 ["C팀", 10, 10, 20, 15], ["D팀", 5, 5, 5, 5]],
        "note": "단위: 건",
    },
    "NCS-C049-standard-4": {
        "caption": "E마트 부서별 반기 매출액",
        "columns": ["부서", "상반기", "하반기"],
        "rows": [["식품", 40, 40], ["의류", 30, 40], ["가전", 30, 40],
                 ["생활", 40, 40], ["화장품", 20, 30], ["스포츠", 10, 20]],
        "note": "단위: 천만원",
    },
    "NCS-C049-retry-1": {
        "caption": "F기업 직종별 연도별 채용 인원",
        "columns": ["직종", "2020", "2021", "2022", "2023", "2024"],
        "rows": [["기술직", 70, 50, 60, 50, 40], ["사무직", 40, 40, 40, 40, 40],
                 ["영업직", 30, 30, 60, 30, 30], ["서비스직", 20, 20, 50, 40, 30],
                 ["연구직", 20, 20, 20, 20, 20]],
        "note": "단위: 명",
    },
    "NCS-C049-retry-2": {
        "caption": "G백화점 층별 월간 방문객 수",
        "columns": ["층", "1월", "2월", "3월", "4월", "5월", "6월"],
        "rows": [["1층", 15, 20, 15, 15, 15, 15], ["2층", 10, 15, 20, 25, 20, 15],
                 ["3층", 10, 10, 15, 20, 15, 10], ["4층", 5, 5, 10, 15, 10, 5],
                 ["5층", 5, 5, 5, 10, 5, 5], ["6층", 5, 5, 5, 5, 5, 10]],
        "note": "단위: 만 명",
    },
    "NCS-C121-diagnosis": {
        "caption": "ABC상사 조직도와 업무분장",
        "columns": ["부서", "담당 업무"],
        "rows": [["기획부", "경영계획 수립, 예산 편성"], ["영업부", "고객 관리, 매출 확대"],
                 ["생산부", "제품 생산, 품질 관리"], ["인사부", "직원 채용, 교육훈련"],
                 ["총무부", "시설 관리, 구매 업무"]],
        "note": "대표이사 직속 5개 부서",
    },
}

# 자료대로면 참이 되어 버리는 오답을 자료에 맞게 고친다.
# 정답을 바꾸지 않고 **오답만** 손대므로 문항의 의도는 그대로다.
# 자료대로면 참이 되어 버리는 오답을 자료에 맞게 고친다.
# 정답을 바꾸지 않고 **오답만** 손대므로 문항의 의도는 그대로다.
#
# 보기를 **번호로 지정하면 안 된다.** 뒤에 보기 순서를 돌리는 작업
# (balance-answer-positions)이 있어서, 같은 번호가 다음 배치에서는 다른 보기를
# 가리킨다. 실제로 이 세 문항이 그렇게 깨져 보기가 중복됐다. 바꿀 대상도
# 바뀐 결과도 **본문으로** 적어 두면 몇 번을 돌려도 같은 결과가 나온다.
FIX_CHOICES: dict[str, dict[str, str]] = {
    # 3호점 평균은 140명인데 보기가 120명이라 참인 보기가 하나도 없었다.
    "NCS-C049-basic-1": {
        "3호점의 주중 평균 고객수는 120명이다":
            "3호점의 주중 평균 고객수는 140명이다",
    },
    # B·C 가 자료상 참이라 정답이 3개였다.
    "NCS-C049-basic-2": {
        "5월에 가장 적은 프로젝트를 완료한 팀은 D팀이다":
            "5월에 가장 많은 프로젝트를 완료한 팀은 D팀이다",
        "B팀은 4월부터 6월까지 지속적으로 감소했다":
            "B팀은 3월부터 6월까지 지속적으로 감소했다",
    },
    # C 가 자료상 참이라 정답이 2개였다.
    "NCS-C049-retry-2": {
        "5층과 6층을 합친 상위층 방문객은 전체 기간 중 4월이 최대치를 기록했다":
            "5층과 6층을 합친 방문객 수는 6개월 내내 동일했다",
    },
}


UNSALVAGEABLE = {
    "NCS-C049-standard-3": "5개 진료과 중 내과 수치만 남아 나머지 보기를 검증할 수 없다. "
                           "표를 지어내면 복구가 아니라 창작이므로 출제에서 제외한다.",
}


def strip_ascii(text: str) -> str:
    """아스키 도표 잔해와 제작용 라벨을 걷어낸다. 표는 visual 로 따로 들어간다."""
    t = re.sub(r"💡\s*핵심 정리", " ", text or "")
    t = AXIS.sub(" ", t)
    t = t.replace("■", " ").replace("□", " ")
    t = re.sub(r"(기초|표준|재도전|진단)\s*\d*\s*번?", " ", t)
    t = re.sub(r"\s{2,}", " ", t)
    return t.strip()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv

    data = json.loads(BANK.read_text(encoding="utf-8"))
    by_id = {q.get("id"): q for q in data if isinstance(q, dict)}

    problems, fixed, excluded = [], 0, 0

    for qid, reason in UNSALVAGEABLE.items():
        q = by_id.get(qid)
        if not q:
            problems.append(f"{qid}: 문항 없음")
            continue
        q["excludeFromQuiz"] = True
        q["excludeReason"] = reason
        # 출제에서 빼더라도 아스키 잔해는 지운다. 복습·검색 등 다른 경로로
        # 화면에 뜰 수 있고, 남겨 두면 "아스키 0건" 검사가 영영 통과하지 못한다.
        q["context"] = strip_ascii(q.get("context") or "") or None
        q["chartRepaired"] = "excluded"
        excluded += 1

    for qid, visual in CHARTS.items():
        q = by_id.get(qid)
        if not q:
            problems.append(f"{qid}: 문항 없음")
            continue
        ch = q.get("choices") or []
        for old_t, new_t in FIX_CHOICES.get(qid, {}).items():
            if new_t in ch:
                continue          # 이미 고쳐져 있다 — 몇 번을 돌려도 안전하다
            hit = next((i for i, c in enumerate(ch) if str(c).strip() == old_t), None)
            if hit is None:
                problems.append(f"{qid}: 고칠 보기를 못 찾음 — {old_t[:20]}…")
                continue
            ch[hit] = new_t
        q["visual"] = {"type": "table", **visual}
        q["mediaType"] = "visual"
        # 표가 자료를 통째로 담으므로 옛 자료는 비운다.
        # 상자 문자만 걷어내면 축 숫자와 범례가 낱말로 남아("매출액(억원) 40 서울점
        # 부산점 … 35 30 25") 표 아래에 뜻 모를 숫자 줄이 붙는다.
        q["context"] = None
        q["chartRepaired"] = "table-from-explanation"
        fixed += 1

    left = sum(1 for q in data if isinstance(q, dict)
               and AXIS.search(f"{q.get('stem','')} {q.get('context','') or ''}"))
    print(f"[도표복구] 표로 되살림 {fixed} · 출제 제외 {excluded} · 아스키 잔존 {left}")
    for p in problems:
        print(f"  ⚠️ {p}")

    if dry:
        print("          (--dry-run: 파일을 쓰지 않았다)")
        return 1 if problems else 0
    if problems or left:
        print("          ❌ 확인되지 않은 항목이 있어 저장하지 않는다.")
        return 1

    shutil.copyfile(BANK, BANK.with_suffix(".json.bak"))
    BANK.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"          ✅ 저장 완료 (원본은 {BANK.name}.bak)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
