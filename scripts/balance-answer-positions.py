#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
정답 위치 쏠림을 없앤다 — 학생이 몰라도 찍히는 단서를 지운다.

### 무엇이 잘못돼 있었나

출제 풀의 정답 위치를 실측했다.

    NCS 26v1   ①16% ②34% ③31% ④16% ⑤3%   → ②③에 65%
    직업공통    ①8%  ②38% ③41% ④10% ⑤2%   → ②③에 79%
    훈화 문항   ①36% ②58% ③7%  ④0%        → ①②에 94%

모르는 학생이 ②나 ③만 찍어도 3할 넘게 맞는다. "1등급 대비"를 내건 앱에서
**내용을 몰라도 오르는 점수**는 그 자체가 결함이다.

### 무엇만 옮기나

내용은 한 글자도 바꾸지 않는다. **보기 순서만** 돌리고 정답 라벨을 다시 매긴다.
그런데 해설이 "정답은 3번 '…'" 처럼 번호를 부르는 경우가 있어, 순서를 돌리면
해설이 거짓말이 된다. 그래서 다음만 손댄다.

    ✔ 해설에 번호 언급이 없는 문항                     3,473개
    ✔ 번호 뒤에 보기 본문이 따옴표로 붙어 재매김 가능    109개
    ✘ 번호만 부르고 본문이 없어 무엇을 가리키는지 모름  1,420개  ← 건드리지 않는다
    ✘ 보기가 서로를 가리킴(①과 ③) 또는 순서 의존         28개  ← 건드리지 않는다

건드리지 않는 1,448개는 그대로 두는 편이 낫다. 해설과 어긋난 문항을 만드느니
편향이 조금 남는 쪽이 학생에게 덜 해롭다.

### 어떤 순서로 돌리나

문항 id 를 씨앗으로 목표 자리를 정한다. 같은 자료에 다시 돌려도 결과가 같아
검토가 가능하다. 보기 개수가 다르면 그 안에서만 돈다.

실행: `python scripts/balance-answer-positions.py [--dry-run]`
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LETTERS = "ABCDE"

NUMREF = re.compile(r"(\d+)\s*번")
# 'N번' 이 보기 번호임이 **확실한** 꼴만 옮긴다. 없는 것을 배제하는 방식으로는
# 안 된다 — "120만원이 3번으로 자주 발생"의 3번은 **횟수**인데, 이걸 보기
# 번호로 착각해 4번으로 바꿨다가 해설이 사실과 어긋났다. 실제로 겪은 일이다.
#
#   보기 번호  "정답은 3번"  "정답: 2번"  "–1번: 프레젠테이션은…"  "2번 보기"
#              "1번은 중도해지시…"  "3번이 정답"
#   보기 아님  "3번으로 발생"  "5번째 항"  "3번 반복"  "2번씩"
CHOICE_BEFORE = re.compile(r"(정답은|정답[:：]|답은|정답이|오답[:：]|보기|선택지|[-–]\s*)\s*$")
# "정답은 3번입니다" 처럼 **번호 뒤에 서술어가 붙는** 꼴을 빠뜨리고 있었다.
# 새로 쓴 해설이 대부분 이 꼴이라, 해설을 고쳐 쓴 문항 432개가 통째로 자리
# 바꿈에서 빠져 있었다 — 정답 위치를 고르게 만들려고 둔 장치가 정작 새로
# 쓴 문항에는 닿지 않았다.
CHOICE_AFTER = re.compile(r"^\s*(보기|선택지|입니다|이다|[:：,.)]"
                          r"|[은는이가의과와도만]|[은는이가의과와도만][^가-힣])")
# 보기가 서로를 가리키거나 순서에 기대는 문항 — 순서를 바꾸면 뜻이 무너진다.
ORDER_DEPENDENT = re.compile(r"[①②③④⑤]|위 보기|앞의 보기|보기 순서|다음 중 순서")


def discover() -> list[Path]:
    names = set()
    for src in (ROOT / "src").rglob("*.js*"):
        for m in re.finditer(r"from\s+'[^']*?/data/([A-Za-z0-9._-]+\.json)'",
                             src.read_text(encoding="utf-8", errors="ignore")):
            names.add(m.group(1))
    return sorted(DATA / n for n in names if (DATA / n).exists())


def seed_of(text: str) -> int:
    h = 2166136261
    for ch in str(text):
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return h


def renumber_explanation(exp: str, choices: list[str], order: list[int]) -> str | None:
    """해설의 'N번' 을 새 자리로 고친다. 못 고치면 None(=이 문항은 건너뛴다)."""
    if not NUMREF.search(exp):
        return exp
    # 새 자리: 원래 i번째 보기가 order 안에서 몇 번째로 갔는가
    new_index = {old: order.index(old) for old in range(len(choices))}

    out, last = [], 0
    for m in NUMREF.finditer(exp):
        old_no = int(m.group(1))
        after = exp[m.end():m.end() + 60]
        before = exp[max(0, m.start() - 12):m.start()]
        certain = bool(CHOICE_BEFORE.search(before) or CHOICE_AFTER.match(after))
        if not 1 <= old_no <= len(choices) or not certain:
            # 보기 번호라고 확신할 수 없다. 하나라도 애매하면 이 문항은
            # 통째로 건너뛴다. 잘못 고치느니 안 옮기는 게 낫다.
            return None
        # 번호 뒤에 보기 본문이 따옴표로 붙어 있으면 그것으로 확인한다.
        q = re.match(r"\s*['‘\"]([^'’\"]{2,40})", after)
        src_idx = None
        if q:
            quoted = q.group(1).strip()
            src_idx = next((i for i, c in enumerate(choices)
                            if c.strip().startswith(quoted[:12])), None)
        if src_idx is None:
            # 인용문이 없어도 'N번' 은 N번째 보기를 가리킨다. 해설 1,130개가
            # 인용문이 없다는 이유만으로 자리 옮김에서 빠져 있었고, 그만큼
            # 정답이 2번에 쏠린 채 남았다.
            src_idx = old_no - 1
        out.append(exp[last:m.start()])
        out.append(f"{new_index[src_idx] + 1}번")
        last = m.end()
    out.append(exp[last:])
    return "".join(out)


def process(q: dict, counter: dict) -> bool:
    ch = q.get("choices")
    ans = q.get("answer")
    if not (isinstance(ch, list) and len(ch) >= 4 and all(isinstance(c, str) for c in ch)):
        return False
    if not (isinstance(ans, str) and re.fullmatch(r"[A-E]", ans)):
        return False
    ai = LETTERS.index(ans)
    if ai >= len(ch):
        return False

    if ORDER_DEPENDENT.search(" ".join(ch) + " " + (q.get("stem") or "")):
        counter["순서의존"] = counter.get("순서의존", 0) + 1
        return False

    n = len(ch)
    target = seed_of(q.get("id") or q.get("stem") or "") % n
    if target == ai:
        counter["이미 균형"] = counter.get("이미 균형", 0) + 1
        return False

    order = list(range(n))
    order.insert(target, order.pop(ai))      # 정답을 target 자리로, 나머지는 순서 유지

    exp = q.get("explanation")
    if isinstance(exp, str) and exp:
        # 자리를 옮기기 전에 검산한다. 해설이 "정답은 3번" 이라고 적어 놓고
        # 정답 키가 2번이면 둘 중 하나가 틀린 것이다. 그대로 옮기면 어긋난
        # 채로 굳으므로 손대지 않고 세어 둔다.
        m = re.search(r"(?:정답은|정답[:：]|답은|정답이)\s*(\d+)\s*번", exp)
        if m and 1 <= int(m.group(1)) <= n and int(m.group(1)) - 1 != ai:
            counter["해설과 정답 불일치"] = counter.get("해설과 정답 불일치", 0) + 1
            return False
        fixed = renumber_explanation(exp, ch, order)
        if fixed is None:
            counter["해설 재매김 불가"] = counter.get("해설 재매김 불가", 0) + 1
            return False
        q["explanation"] = fixed

    q["choices"] = [ch[i] for i in order]
    q["answer"] = LETTERS[target]
    q["choiceOrderBalanced"] = True
    counter["옮김"] = counter.get("옮김", 0) + 1
    return True


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


def measure(paths) -> dict:
    pos = {}
    for p in paths:
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        def scan(n):
            if isinstance(n, list):
                for x in n:
                    scan(x)
            elif isinstance(n, dict):
                ch, a = n.get("choices"), n.get("answer")
                if (isinstance(ch, list) and len(ch) >= 4 and isinstance(a, str)
                        and re.fullmatch(r"[A-E]", a) and LETTERS.index(a) < len(ch)):
                    k = LETTERS.index(a) + 1
                    pos[k] = pos.get(k, 0) + 1
                for v in n.values():
                    if isinstance(v, (list, dict)):
                        scan(v)
        scan(d)
    return pos


def show(label, pos):
    tot = sum(pos.values()) or 1
    print(f"  {label}: " + " ".join(f"{k}번 {v}({v/tot*100:.0f}%)"
                                    for k, v in sorted(pos.items())))


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv
    paths = discover()

    print("[정답위치]")
    show("전", measure(paths))

    counter, touched = {}, []
    for p in paths:
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if walk(d, counter):
            touched.append(p)
            if not dry:
                shutil.copyfile(p, p.with_suffix(".json.bak"))
                p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n",
                             encoding="utf-8")

    if not dry:
        show("후", measure(paths))
    print(f"  파일 {len(touched)}개 · " + " · ".join(f"{k} {v}" for k, v in sorted(counter.items()))
          + (" (--dry-run)" if dry else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
