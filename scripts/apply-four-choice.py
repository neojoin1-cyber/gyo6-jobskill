#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
직업공통 문항을 **실제 인증진단 형식(4지선다)** 으로 바꾼 결과를 적용한다.

### 왜

교육부 직업공통능력 인증진단의 선택형은 **4지선다**다. 공식 자가진단 매뉴얼이
"4가지 선택지를 제시 받아 그 중 하나를 고르는 형태"라고 못박고 있고,
공식 모의체험 화면도 ①②③④ 네 개다. 그런데 우리 직업공통 문항은 375개가
5지선다였다. 보기 하나가 더 많은 것은 사소해 보이지만, 실전에서는 읽는 시간과
소거 전략이 통째로 달라진다.

게다가 그 5지선다들은 **정답만 길고 자세했다.** 오답은 한 마디로 끝나서,
내용을 몰라도 가장 긴 것을 고르면 절반 넘게 맞았다. 시험 대비 앱에서 이건
학생을 속이는 것이다.

### 무엇을 적용하나

`_data/four-choice-patch.json` 에 손으로 다시 쓴 보기를 담아 두고, 이 스크립트가
id 로 찾아 갈아 끼운다. 원칙은 셋이다.

1. **발문·지문·정답 본문은 건드리지 않는다.** 무엇을 묻는지는 그대로다.
2. **오답 셋은 저마다 다른 오류 유형을 담는다** — 조건 누락 / 범위·대상 오해 /
   반대 해석·계산 실수. 아무거나 그럴듯한 말이 아니라, 학생이 왜 틀렸는지
   해설에서 짚어 줄 수 있는 오답이어야 한다.
3. **네 보기의 문장 형태와 길이를 나란히 맞춘다.** 길이 단서는 이렇게 없앤다.
   오답을 억지로 늘려 붙이는 방식은 쓰지 않는다 — 그건 눈속임이다.

적용 뒤에는 스스로 검사한다. 정답 본문이 살아 있는지, 보기가 겹치지 않는지,
정답이 유독 길지 않은지, 네 개가 다 있는지.

실행: `python scripts/apply-four-choice.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATCH = ROOT / "data" / "four-choice-patch.json"
# 같은 문항이 여러 파일에 복사되어 있다. questions.json 이 원본이고
# block-inline-* 은 교재 본문에 끼워 넣는 사본이다. 한쪽만 고치면 학생이
# 교재에서는 5지선다, 문제풀이에서는 4지선다를 보게 된다. 전부 함께 고친다.
# 은행 목록을 손으로 적어 두었더니, 새로 만든 은행(영어·평가틀 보강)에는
# 패치가 닿지 않았다. 48문항을 고쳐 놓고 "적용 0곳"이 떴다. 다른 복구
# 스크립트와 같은 방식으로 **src 가 실제로 읽는 data/*.json 전부**를 훑는다.
def discover_banks() -> list[Path]:
    names = set()
    for src in (ROOT / "src").rglob("*.js*"):
        for m in re.finditer(r"from\s+'[^']*?/data/([A-Za-z0-9._-]+\.json)'",
                             src.read_text(encoding="utf-8", errors="ignore")):
            names.add(m.group(1))
    # 교재 본문에 끼워 넣는 사본은 src 가 직접 import 하지 않아도 함께 고쳐야
    # 한다. 한쪽만 고치면 교재에서는 5지선다, 문제풀이에서는 4지선다가 된다.
    names.add("block-inline-job-common.json")
    return sorted((ROOT / "data" / n) for n in names if (ROOT / "data" / n).exists())


BANKS = discover_banks()
LETTERS = "ABCD"


def walk(o):
    if isinstance(o, dict):
        if isinstance(o.get("choices"), list) and o.get("answer"):
            yield o
        for v in o.values():
            yield from walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk(v)


def check(qid: str, item: dict, patch: dict) -> str | None:
    ch = patch["choices"]
    if "exclude" in patch:
        return None
    if len(ch) != 4:
        return f"{qid}: 보기가 4개가 아니다({len(ch)})"
    if len(set(c.strip() for c in ch)) != 4:
        return f"{qid}: 겹치는 보기가 있다"
    ai = LETTERS.index(patch["answer"])
    want = patch.get("answerText")
    if want and ch[ai].strip() != want.strip():
        return f"{qid}: 정답 자리의 본문이 정답과 다르다"
    # 원래 정답이 새 보기 안에 그대로 남아 있어야 한다 — 묻는 것이 바뀌면 안 된다
    old = item["choices"][ord(item["answer"]) - 65].strip()
    if old not in [c.strip() for c in ch]:
        return f"{qid}: 원래 정답이 사라졌다 — '{old[:24]}…'"
    if ch[ai].strip() != old:
        return f"{qid}: 정답 자리가 원래 정답을 가리키지 않는다"
    L = [len(c) for c in ch]
    others = [L[i] for i in range(4) if i != ai]
    # 보기가 숫자·기호처럼 아주 짧으면 길이는 단서가 되지 않는다.
    # "3.5"(3자)가 "-7"(2자)보다 길다고 해서 정답을 찍을 수는 없다.
    if max(L) <= 8:
        return None
    if L[ai] == max(L) and L[ai] >= 1.4 * (sum(others) / len(others)):
        return f"{qid}: 정답이 여전히 유독 길다({L})"
    return None


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv
    if not PATCH.exists():
        print("[4지선다] 적용할 것이 없다(four-choice-patch.json 없음)")
        return 0
    patches = json.loads(PATCH.read_text(encoding="utf-8"))

    applied, problems, missing = 0, [], set(patches)
    seen_anywhere: set[str] = set()
    for bank in BANKS:
        if not bank.exists():
            continue
        raw = json.loads(bank.read_text(encoding="utf-8"))
        touched = 0
        for q in walk(raw):
            qid = q.get("id")
            p = patches.get(qid)
            if not p:
                continue
            seen_anywhere.add(qid)
            # 이미 patch 와 똑같으면 건드리지 않는다. 예전에는 fourChoice 표시만
            # 보고 건너뛰었는데, 그러면 **한 번 적용한 문항은 patch 를 고쳐도
            # 영원히 반영되지 않는다.** 길이 단서를 지우려고 오답을 다시 쓴
            # 38문항이 "적용 완료"로 조용히 무시됐다.
            if q.get("choices") == p.get("choices") and q.get("answer") == p.get("answer"):
                continue                       # 몇 번을 돌려도 같다
            # 형식을 고쳐도 살릴 수 없는 문항은 출제에서 뺀다. 교재의 편집
            # 구조를 묻는 것("3줄 요약 세 번째 항목은?")이나 조건이 답을
            # 하나로 좁히지 못하는 문항이 여기 해당한다. 인증진단은 그런 것을
            # 묻지 않는다 — 남겨 두면 우리 교재를 외운 사람만 맞히게 된다.
            if p.get("exclude"):
                if not q.get("excludeFromQuiz"):
                    q["excludeFromQuiz"] = True
                    q["excludeReason"] = p["exclude"]
                    touched += 1
                continue
            err = check(qid, q, p)
            if err:
                problems.append(err)
                continue
            q["choices"] = list(p["choices"])
            q["answer"] = p["answer"]
            q["fourChoice"] = "공식 인증진단 형식(4지선다)에 맞춰 오답을 다시 씀"
            # 보기 자리가 바뀌었으므로 해설의 'N번'도 같이 바뀌어야 한다.
            # 그래서 해설을 통째로 새로 쓴 것을 함께 받는다 — 번호만 갈아 끼우면
            # 사라진 다섯 번째 보기를 가리키는 문장이 남는다.
            if p.get("explanation"):
                q["explanation"] = p["explanation"]
            if p.get("distractorTypes"):
                q["distractorTypes"] = p["distractorTypes"]
            touched += 1
        if touched and not dry:
            bank.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
        applied += touched
        if touched:
            print(f"    {bank.name}: {touched}문항")

    missing -= seen_anywhere
    print(f"[4지선다] {applied}곳 적용" + (" (--dry-run)" if dry else " ✅"))
    if missing:
        print(f"  ⚠️ 은행에서 못 찾은 id {len(missing)}개: {sorted(missing)[:5]}")
    for x in problems[:12]:
        print(f"  ✗ {x}")
    if problems:
        print(f"  ✗ 검사에 걸린 {len(problems)}문항은 적용하지 않았다.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
