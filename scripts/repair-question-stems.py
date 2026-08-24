#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
발문(stem) 자리에 질문이 없는 문항을 고친다.

### 무엇이 잘못돼 있었나

객관식 830문항 중 74개는 발문에 질문 표현이 하나도 없었다. 학생 화면과
교사 수업 덱에 그대로 노출돼, 무엇을 묻는지 알 수 없는 상태였다.

    stem   : "업무 공지문의 핵심 내용 파악하기"      ← 차시 제목
    context: 과장 대사(지시 4가지)
    choices: 업무 5개
    answer : B

원인은 두 가지다.

**유형1 (25문항) — 필드가 어긋났다.**
질문이 사라진 게 아니라 `context` 맨 앞에 들어가 있고, `stem` 에는 지문의
뒷부분이 들어가 있었다. 화면은 자료(context) → 발문(stem) 순으로 그리므로
읽는 사람은 질문을 자료 속에서 먼저 보고, 지문 꼬리를 발문으로 읽게 된다.

    context: "다음 글의 전개방식으로 가장 적절한 것은? 최근 우리 회사의…"
    stem   : "따라서 다음과 같은 개선 방안을 제시한다. 첫째, …"

이건 내용을 새로 쓰지 않고 되돌릴 수 있다. 질문 문장을 stem 으로 옮기고,
원래 stem(지문 꼬리)을 context 끝에 붙인다. **글자는 하나도 버리지 않는다.**

**유형2 (49문항) — 질문이 애초에 없다.**
`stem` 에 `lessonTitle` 이 그대로 복사됐거나 대사·지시문이 들어갔다.
이건 기계적으로 복원할 수 없어 `authored_stems.json` 에 사람이 쓴 발문을
두고 id 로 맞춰 넣는다. 근거는 자료·보기·해설에 남아 있다.

### 안전장치

- 원본을 덮어쓰기 전에 `.bak` 을 남긴다.
- 유형1 변환은 글자 수 보존을 검사한다(질문 문장 이동 외 손실 0).
- 고친 문항에 `stemRepaired` 를 남겨 나중에 추적할 수 있게 한다.
- 고친 뒤 다시 검사해 남은 파손이 0인지 확인하고, 아니면 실패로 끝난다.

실행: `python scripts/repair-question-stems.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTHORED = Path(__file__).resolve().parent / "authored-stems.json"

# 같은 파손이 여러 은행에 있다. ncs-extracted-bank 는 727문항이 같은 꼴이고
# 그중 702개가 "질문이 context 앞머리에" 유형이라 같은 규칙으로 되돌아간다.
BANKS = [
    ROOT / "data" / "ncs-questions.json",
    ROOT / "data" / "ncs-extracted-bank.json",
    # 변형 문항도 모의평가에 그대로 나가는데 중첩 구조라 그동안 이 스크립트가
    # 보지 못했다. 같은 필드 어긋남이 48건 남아 있었다.
    ROOT / "data" / "ncs-variants.json",
    ROOT / "data" / "job-variants.json",
]

# 발문 어디든 질문 표현이 있으면 정상으로 본다.
# 끝만 보면 "…고른 것은? ①규칙 ②유연" 처럼 보기가 뒤에 붙은 정상 문항을
# 파손으로 잘못 잡는다(실제로 한 번 208개로 과대 계상했다).
Q_ANY = re.compile(
    r"(\?|것은|것을|무엇|어느|고르|하는가|인가|알맞은|적절한|옳은|옳지"
    r"|쓰시오|하시오|골라|구하면|얼마|몇|것인가|바르게|틀린|시오|하라)"
)

# context 앞머리에 박힌 질문 문장 한 개를 통째로 집어낸다.
# 키워드 목록으로 잡으면 "이 회의에서 확정된 결정사항은?" 처럼 목록에 없는
# 어미를 놓친다. 물음표로 끝나는 문장이면 질문으로 본다 — 자료(지문) 안에
# 물음표 문장이 들어가는 경우는 드물고, 있어도 앞머리에 오지는 않는다.
# 물음표로 끝나지 않는 질문도 있다 — "…을 선택하시오.", "…순서를 결정하라."
# 이걸 인정하지 않아 변형 문항 8건이 발문 없이 남아 있었다.
Q_SENT = re.compile(r"[^.?!\n]*(?:\?|(?:시오|하라)\.)")


# 발문 자리에 있던 글이 '버려도 되는 것'인지 가르는 기준.
# 차시 제목이 복사된 것과 문항 제작용 안내("3단계: …")는 독자에게 의미가 없다.
# 그 외(대사·조건·지문 꼬리)는 내용이므로 버리면 문항이 풀리지 않는다.
DISPOSABLE = re.compile(r"^(\d단계\s*[:：]|접근법|업무 상황\s*[:：]|직무\s?상황\s*[:：])")


def choice_values(c):
    if isinstance(c, list):
        return c
    if isinstance(c, dict):
        return list(c.values())
    return []


def is_broken(q: dict) -> bool:
    """객관식인데 발문이 질문 구실을 못 하는 것.

    질문 표현이 없는 경우뿐 아니라 제작용 안내문("3단계: … 무엇인지 판단해보세요")도
    포함한다. 안내문에 '무엇'이 들어 있어 질문으로 오인된 사례가 실제로 있었다.
    """
    if q.get("excludeFromQuiz") and (q.get("excludeReason") or "").strip():
        # 까닭을 적어 일부러 뺀 문항. 되살릴 수 없어 뺀 것을 계속 '미해결'로
        # 세면 이 스크립트가 영영 실패로 끝난다.
        return False
    stem = (q.get("stem") or "").strip()
    if len(choice_values(q.get("choices"))) < 2:
        return False
    return not Q_ANY.search(stem) or bool(DISPOSABLE.match(stem))


def repair_field_swap(q: dict) -> bool:
    """유형1 — context 앞의 질문 문장을 stem 으로 되돌린다. 성공하면 True."""
    ctx = q.get("context") or ""

    # 발문은 지문 앞머리에 오거나(짧은 상황 설명 뒤) 지문 맨 끝에 온다
    # (회의록·안내문 전문을 싣고 마지막에 묻는 형태). 실측하니 앞머리 352개,
    # 끝 327개였다. 앞머리만 인정하면 절반을 놓친다.
    #
    # 다만 지문 한복판의 대사("…어떨까요?")를 집으면 안 되므로, 끝쪽 문장은
    # **독자에게 던지는 질문 표현**이 있을 때만 인정한다. 등장인물의 대사는
    # 보통 "~할까요?"로 끝나지 "~것은?"으로 끝나지 않는다.
    READER_Q = re.compile(r"(것은|것을|무엇|어느|고르|알맞은|적절한|옳은|옳지|바르게|틀린|얼마|몇|하는가|인가)")
    cands = list(Q_SENT.finditer(ctx))
    if not cands:
        return False
    m = None
    for c in cands:
        head = c.start() <= 160
        tail = ctx[c.end():].strip() == ""          # 지문의 마지막 문장인가
        if head or (tail and READER_Q.search(c.group(0))):
            m = c
            if head:
                break
    if m is None:
        return False
    # 따옴표 안의 물음표는 등장인물의 대사다. 실제로 고객 대사
    # ("이런 식으로 운영하시는 거예요?")를 발문으로 집는 사고가 있었다.
    if ctx[:m.start()].count('"') % 2 == 1 or ctx[:m.start()].count("“") > ctx[:m.start()].count("”"):
        return False
    question = m.group(0).strip()
    # "문제: 이 회의에서…" 처럼 붙어 있는 라벨은 화면에 그대로 뜨면 어색하다.
    question = re.sub(r"^(문제|질문|Q)\s*[.:：]\s*", "", question).strip()
    rest = (ctx[:m.start()] + ctx[m.end():]).strip()
    tail = (q.get("stem") or "").strip()

    # 라벨("문제:")만큼은 의도적으로 줄어드므로 비교 기준에서도 빼 준다.
    label = len(re.sub(r"\s", "", m.group(0).strip())) - len(re.sub(r"\s", "", question))
    before = len(re.sub(r"\s", "", ctx + tail)) - label
    q["stem"] = question
    q["context"] = (rest + ("\n\n" + tail if tail else "")).strip()
    after = len(re.sub(r"\s", "", q["context"] + q["stem"]))
    if before != after:                     # 글자가 사라졌다면 이 문항은 건드리지 않는다
        raise RuntimeError(f"{q.get('id') or '(id없음)'}: 글자 수 불일치 {before} → {after}")

    q["stemRepaired"] = "field-swap"
    return True


def apply_authored(q: dict, stem: str) -> None:
    """유형2 — 사람이 쓴 발문을 넣되, 기존 발문에 내용이 있으면 자료로 옮긴다."""
    old = (q.get("stem") or "").strip()
    title = (q.get("lessonTitle") or "").strip()
    keep = old and old != title and not DISPOSABLE.match(old)

    if keep:
        ctx = (q.get("context") or "").strip()
        if old not in ctx:                  # 이미 자료에 들어 있으면 중복시키지 않는다
            q["context"] = (ctx + ("\n\n" if ctx else "") + old).strip()

    q["stem"] = stem
    q["stemRepaired"] = "authored" + ("+moved" if keep else "")


def repair_bank(bank: Path, authored: dict, dry: bool) -> int:
    raw = json.loads(bank.read_text(encoding="utf-8"))
    data = raw if isinstance(raw, list) else raw.get("questions", [])
    if not data:
        # `{variants: {부모id: [...]}}` 처럼 중첩된 파일. 최상위 배열만 보면
        # 한 문항도 못 찾는다.
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
        data = []
        gather(raw)

    broken = [q for q in data if is_broken(q)]
    print(f"[발문복구] {bank.name}: 파손 {len(broken)}개")

    swapped = written = skipped = 0
    for q in broken:
        stem = authored.get(q.get("id"))
        if stem:                            # 사람이 써 둔 발문이 있으면 그것이 우선
            apply_authored(q, stem)
            written += 1
            continue
        try:
            if repair_field_swap(q):
                swapped += 1
                continue
        except RuntimeError as e:
            print(f"  ⚠️ {e}")
        skipped += 1

    still = [q for q in data if is_broken(q)]
    print(f"          되돌림 {swapped} · 작성 적용 {written} · 미해결 {skipped} · 잔존 {len(still)}")
    for q in still[:6]:
        print(f"            {q.get('id') or '(id없음)'} {(q.get('stem') or '')[:56]}")

    if dry:
        return len(still)

    # 남은 게 있어도 저장한다. 처음에는 "전부 아니면 저장 안 함"으로 두었는데,
    # 727문항짜리 은행에서 531개를 되살려 놓고 나머지 196개 때문에 전부 버리는
    # 꼴이 됐다. 되살린 만큼은 분명히 이득이고, 남은 파손은 문항 게이트와
    # questionIndex 의 isRenderable 이 학생 화면에서 걸러 준다.
    if swapped or written:
        shutil.copyfile(bank, bank.with_suffix(".json.bak"))
        bank.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"          ✅ 저장 완료 (원본은 {bank.name}.bak)")
    else:
        print("          바뀐 것이 없어 저장하지 않는다")
    return len(still)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv
    authored = json.loads(AUTHORED.read_text(encoding="utf-8")) if AUTHORED.exists() else {}

    # 미검수 은행(ncs-extracted-bank)은 되살리지 못한 것이 남아도 실패로 보지 않는다.
    # 그 문항들은 출제 풀에도 복습 인덱스에도 나가지 않고, 문항 게이트가
    # **번들을 돌려** 유입 0건인지 매번 확인한다. 여기서 실패로 끝내면
    # 되살릴 수 없는 195개 때문에 복구 파이프라인 전체가 영영 빨간불이 된다.
    ARCHIVE_NAME = "ncs-extracted-bank.json"
    left = 0
    for b in BANKS:
        if not b.exists():
            continue
        n = repair_bank(b, authored, dry)
        if b.name == ARCHIVE_NAME:
            if n:
                print(f"          ⓘ {b.name} 의 {n}개는 화면에 나가지 않는 미검수분 — "
                      f"게이트가 유입 0건을 따로 확인한다")
            continue
        left += n
    if dry:
        print(f"          (--dry-run) 전체 잔존 {left}개")
    return 1 if (left and not dry) else 0


if __name__ == "__main__":
    raise SystemExit(main())
