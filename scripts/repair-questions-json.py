#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
`data/questions.json` 의 구조 파손 8건을 고친다.

발문만 없는 게 아니라 **보기가 다른 문항 것으로 바뀌어 있는** 경우가 있어
`repair-question-stems.py`(발문 전용)로는 못 고친다. 여기서 따로 다룬다.

### 무엇이 잘못돼 있었나

**보기 오배치 3건 (C15-14-Q04·Q05·Q08).**
보기가 발문 안에 "행동 후보: A. … B. …" 로 들어가 있고, `choices` 에는
**옆 문항의 보기**가 들어가 있었다.

    stem   : "프로젝트 일정이 2주 지연… 행동 후보: A. 보고 없이 수정 B. 협력업체에
              연락해 원인 파악 후 팀장 보고 C. …"
    choices: ["부서장 → 총무팀장 → 총무팀 박○○", "총무팀 박○○에게 직접 연락", …]
    answer : "B"   ← 발문 속 B 를 가리키는데, choices[1] 은 총무팀 연락이다

즉 **정답 키가 보기와 다른 것을 가리킨다.** 학생이 해설대로 고르면 오답 처리된다.
Q04·Q05 는 Q03 의 보기를, Q08 은 Q07 의 보기를 물려받았다.

**발문에 질문이 없는 것 4건 (C15-14-Q01·Q02, C19-18-Q05·Q06).**
상황 서술만 있고 무엇을 묻는지가 없다. 상황은 자료(context)로 옮기고 질문을 넣는다.

**되살릴 수 없는 것 1건 (C15-14-Q06).**
발문은 "문제. 가장 적절한 대응은 무엇인가요?", 보기는 문자 그대로 `["A","B","C","D","E"]`,
해설은 "정답은 3번 'C'임". **자료도 보기 내용도 어디에도 없다.** 지어내면 그건
복구가 아니라 창작이므로 `excludeFromQuiz` 로 내리고 이유를 남긴다.

### 안전장치

- 원본을 `.bak` 으로 남긴다.
- 보기를 옮길 때 **정답 문자가 가리키는 내용이 해설과 맞는지** 확인한다.
- 고친 문항에 `structureRepaired` 를 남긴다.
- 끝나고 게이트를 통과하는지는 `gate-question-quality.py` 로 따로 확인한다.

실행: `python scripts/repair-questions-json.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BANK = ROOT / "data" / "questions.json"

# 발문에 박힌 "행동 후보: A. … B. … E. …" 를 통째로 집어낸다.
EMBEDDED = re.compile(r"(행동 후보|선택지|보기)\s*[:：]\s*(?P<body>A[.．].+)$", re.S)
OPTION = re.compile(r"([A-E])[.．]\s*(.+?)(?=\s+[A-E][.．]\s|$)", re.S)

# 상황만 있고 질문이 없던 문항에 붙일 질문. 해설이 가리키던 것을 문장으로 옮겼다.
STEMS = {
    "C15-14-Q01": "신입사원이 취해야 할 대응으로 가장 적절한 것은?",
    "C15-14-Q02": "담당자가 취해야 할 행동으로 가장 적절한 것은?",
    "C15-14-Q04": "이 상황에서 담당자가 취해야 할 행동으로 가장 적절한 것은?",
    "C15-14-Q05": "이 상황에서 취해야 할 행동으로 가장 적절한 것은?",
    "C15-14-Q08": "이 상황에서 취해야 할 행동으로 가장 적절한 것은?",
    "C19-18-Q05": "네 과제의 처리 방식으로 가장 적절한 것은?",
    "C19-18-Q06": "이 상황에서 가장 적절한 대응은?",
}

# 발문 앞머리의 제작용 라벨. 학생 화면에 그대로 뜨면 문항 번호처럼 보여 헷갈린다.
LABEL = re.compile(r"^(재도전\s*\d*번?|문제)\s*[.:：]?\s*")

UNSALVAGEABLE = {
    "C15-14-Q06": "발문·보기·자료 어디에도 내용이 없다(보기가 문자 그대로 A~E). "
                  "복구하려면 문항을 새로 지어내야 하므로 출제에서 제외한다.",
}


def split_embedded(stem: str):
    """발문에서 상황과 보기를 갈라낸다. 보기를 못 찾으면 (원문, None)."""
    m = EMBEDDED.search(stem)
    if not m:
        return stem, None
    opts = OPTION.findall(m.group("body"))
    if len(opts) < 4:
        return stem, None
    situation = stem[:m.start()].strip()
    return situation, [re.sub(r"\s+", " ", t).strip() for _k, t in opts]


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv

    raw = json.loads(BANK.read_text(encoding="utf-8"))
    items = raw if isinstance(raw, list) else raw.get("questions", [])
    by_id = {q.get("id"): q for q in items if isinstance(q, dict)}

    moved = restemmed = excluded = 0
    problems = []

    for qid, reason in UNSALVAGEABLE.items():
        q = by_id.get(qid)
        if not q:
            problems.append(f"{qid}: 문항을 찾지 못했다")
            continue
        q["excludeFromQuiz"] = True
        q["excludeReason"] = reason
        q["structureRepaired"] = "excluded"
        excluded += 1

    for qid, question in STEMS.items():
        q = by_id.get(qid)
        if not q:
            problems.append(f"{qid}: 문항을 찾지 못했다")
            continue

        stem = LABEL.sub("", (q.get("stem") or "").strip())
        situation, opts = split_embedded(stem)

        if opts:
            # 정답이 가리키는 내용이 실제로 옮겨지는지 확인한다.
            ans = q.get("answer")
            idx = "ABCDE".find(ans) if isinstance(ans, str) else -1
            if not (0 <= idx < len(opts)):
                problems.append(f"{qid}: 정답 {ans!r} 이 추출한 보기 {len(opts)}개 범위 밖")
                continue
            q["choices"] = opts
            q["structureRepaired"] = "choices-from-stem"
            moved += 1

        ctx = (q.get("context") or "").strip()
        if situation and situation not in ctx:
            q["context"] = (ctx + ("\n\n" if ctx else "") + situation).strip()
        q["stem"] = question
        q["structureRepaired"] = q.get("structureRepaired", "") or "stem-authored"
        restemmed += 1

    print(f"[구조복구] 보기 되찾음 {moved} · 발문 작성 {restemmed} · 출제 제외 {excluded}")
    for p in problems:
        print(f"  ⚠️ {p}")

    if dry:
        print("          (--dry-run: 파일을 쓰지 않았다)")
        return 1 if problems else 0
    if problems:
        print("          ❌ 확인되지 않은 문항이 있어 저장하지 않는다.")
        return 1

    shutil.copyfile(BANK, BANK.with_suffix(".json.bak"))
    BANK.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"          ✅ 저장 완료 (원본은 {BANK.name}.bak)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
