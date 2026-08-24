#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
해설 첫머리의 "정답: N번" 이 실제 정답 자리와 어긋난 것을 바로잡는다.

### 왜 어긋나 있나

보기 순서를 돌리는 `balance-answer-positions.py` 는 해설의 'N번' 을 다시
매기지만, 해설이 원 순서를 여러 표기(①②③, A~E, 'N번')로 뒤섞어 부르면
전부를 따라가지 못한다. 그 결과 해설이 부르는 자리와 정답 키가 어긋난
문항이 남았다.

### 무엇만 고치나

**학생이 실제로 읽고 외우는 한 줄** — "정답: N번" 만 고친다. 해설 안의
보기별 분석(–① … –⑤)까지 함께 옮기려면 어떤 순서로 돌렸는지 역산해야
하는데, 표기가 섞인 해설에서는 그 역산이 확실하지 않다. 확실하지 않은
것을 고치면 지금보다 나빠질 수 있으므로 손대지 않고 남은 건수를 알린다.

고치기 전에 **내용으로 검산**한다. 해설이 실제 정답 보기의 본문을 담고
있고 원래 부르던 자리의 본문은 담고 있지 않을 때만 '자리 표기만 낡았다'로
보고 번호를 바꾼다. 검산이 안 되면 정답 키 쪽이 틀렸을 수 있으므로
건드리지 않는다.

실행: `python scripts/repair-explanation-claim.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LETTERS = "ABCDE"

CLAIM = [
    re.compile(r"(정답(?:은|이|[:：])\s*)([1-5])(\s*번)"),
    # 영어 문항 해설은 보기를 A~E 로 부른다. 자리 표기가 낡았을 때는
    # 헷갈리지 않도록 번호 표기로 바꿔 적는다.
    re.compile(r"(정답(?:은|이|[:：])\s*)([A-E])(?![A-Za-z0-9가-힣])()"),
    re.compile(r"(?<![A-Za-z0-9])()([A-E])(가\s*정답)"),
    re.compile(r"()([1-5])(\s*번(?:이|은)?\s*정답(?:입니다|이다|이라|\s*[.。]|$))"),
    re.compile(r"()([1-5])(번입니다)"),
]


def discover() -> list[Path]:
    names = set()
    for src in (ROOT / "src").rglob("*.js*"):
        for m in re.finditer(r"from\s+'[^']*?/data/([A-Za-z0-9._-]+\.json)'",
                             src.read_text(encoding="utf-8", errors="ignore")):
            names.add(m.group(1))
    return sorted(DATA / n for n in names if (DATA / n).exists())


def norm(s: str) -> str:
    return re.sub(r"[\s'\"‘’“”().,·…\-–—]+", "", str(s))


def answer_index(q: dict) -> int | None:
    ans, ch = q.get("answer"), q.get("choices")
    if not isinstance(ch, list) or len(ch) < 2:
        return None
    if isinstance(ans, int) and 0 <= ans < len(ch):
        return ans
    if isinstance(ans, str) and re.fullmatch(r"[A-E]", ans.strip()):
        i = LETTERS.index(ans.strip())
        return i if i < len(ch) else None
    return None


# 2단계 — 해설이 보기별 분석(–2번: …, ①②③)까지 담고 있고 그 표기가 **모두**
# 보기 번호임이 확실하면, 자리바꿈을 역산해 전부 함께 옮긴다. 하나라도
# 보기 번호인지 확신할 수 없으면(예: "3년간", "A(1,500)") 통째로 건너뛴다.
CIRCLED = "①②③④⑤"
NUMREF = re.compile(r"(\d+)\s*번")
CIRCREF = re.compile(r"[①②③④⑤]")
CHOICE_BEFORE = re.compile(r"(정답은|정답[:：]|답은|정답이|오답[:：]|보기|선택지|[-–]\s*)\s*$")
CHOICE_AFTER = re.compile(r"^\s*(보기|선택지|입니다|이다|[:：,.)]|[은는이가의과와도만])")


def full_remap(exp: str, n: int, old: int, target: int) -> str | None:
    order = list(range(n))
    order.insert(target, order.pop(old))
    new_index = {o: order.index(o) for o in range(n)}

    spans = []
    for m in NUMREF.finditer(exp):
        no = int(m.group(1))
        before, after = exp[max(0, m.start() - 12):m.start()], exp[m.end():m.end() + 40]
        if not 1 <= no <= n:
            return None
        if not (CHOICE_BEFORE.search(before) or CHOICE_AFTER.match(after)):
            return None
        spans.append((m.start(), m.end(), f"{new_index[no - 1] + 1}번"))
    for m in CIRCREF.finditer(exp):
        idx = CIRCLED.index(m.group(0))
        if idx >= n:
            return None
        spans.append((m.start(), m.end(), CIRCLED[new_index[idx]]))
    if not spans:
        return None
    spans.sort()
    out, last = [], 0
    for a, b, rep in spans:
        out.append(exp[last:a]); out.append(rep); last = b
    out.append(exp[last:])
    return "".join(out)

def process(q: dict, counter: dict) -> bool:
    exp = q.get("explanation")
    ai = answer_index(q)
    if ai is None or not isinstance(exp, str) or not exp:
        return False
    ch = q["choices"]
    for pat in CLAIM:
        m = pat.search(exp)
        if not m:
            continue
        tok = m.group(2)
        old = (LETTERS.index(tok) if tok.isalpha() else int(tok) - 1)
        if not 0 <= old < len(ch) or old == ai:
            return False
        # 내용 검산 — 실제 정답 본문은 해설에 있고, 원래 부르던 보기 본문은 없다.
        body = norm(exp)
        full_w, full_x = norm(ch[ai]), norm(ch[old])
        want, wrong = full_w[:14], full_x[:14]
        verified = (full_w and full_w in body and full_x not in body) or (
            len(want) >= 6 and want in body and not (len(wrong) >= 6 and wrong in body))
        if not verified:
            fixed = full_remap(exp, len(ch), old, ai)
            if fixed is None:
                counter["검산 실패"] = counter.get("검산 실패", 0) + 1
                return False
            q["explanation"] = fixed
            counter["보기별 표기까지 이동"] = counter.get("보기별 표기까지 이동", 0) + 1
            return True
        tail = m.group(3)
        rep = f"{ai + 1}번" if tok.isalpha() else str(ai + 1)
        if tok.isalpha() and tail.startswith("가"):
            rep, tail = f"{ai + 1}번이", tail[1:]
        q["explanation"] = exp[:m.start()] + m.group(1) + rep + tail + exp[m.end():]
        counter["고침"] = counter.get("고침", 0) + 1
        return True
    return False


def walk(node, counter) -> bool:
    changed = False
    if isinstance(node, list):
        for x in node:
            changed |= walk(x, counter)
    elif isinstance(node, dict):
        if "choices" in node and "answer" in node:
            changed |= process(node, counter)
        for v in node.values():
            if isinstance(v, (list, dict)):
                changed |= walk(v, counter)
    return changed


def main() -> int:
    dry = "--dry-run" in sys.argv
    counter: dict = {}
    for p in discover():
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if walk(d, counter) and not dry:
            p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    moved = counter.get("보기별 표기까지 이동", 0)
    print(f"[해설정답표기] {counter.get('고침', 0) + moved}문항 고침"
          + (f" (보기별 표기까지 옮긴 것 {moved}개)" if moved else "")
          + (" (dry-run)" if dry else " ✅"))
    if counter.get("검산 실패"):
        print(f"               검산이 안 돼 남겨 둔 문항 {counter['검산 실패']}개")
    return 0


if __name__ == "__main__":
    sys.exit(main())
