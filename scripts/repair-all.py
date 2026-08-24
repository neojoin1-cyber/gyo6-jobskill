#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
문항 데이터 복구를 **정해진 순서로 한 번에** 돌린다.

### 왜 필요한가

복구 스크립트가 열 개가 넘고 순서가 중요하다. 발문을 먼저 되살려야 라벨을
지울 수 있고, 라벨을 지워야 정답 표기를 고칠 수 있고, 정답을 고친 뒤에야
보기 순서를 돌릴 수 있다. 순서를 틀리면 조용히 어긋난다.

실제로 사고가 났다. `extract_ncs_bank.py` 가 원본 교재에서 문항을 **다시 뽑아**
`ncs-extracted-bank.json` 을 통째로 덮어썼고, 그동안의 복구가 전부 사라졌다.
게이트가 "지적 문항 2개가 출제 풀에 올라와 있다"로 잡아 냈다.

그때 필요한 것이 이 파일이다. 데이터가 다시 생성되면 이걸 한 번 돌리면 된다.
**모든 복구 스크립트는 여러 번 돌려도 같은 결과가 나오게 만들어 두었다.**

### 순서

    1 발문 복구          지문 꼬리가 발문 자리에 온 것을 되돌린다
    2 보기 분리          자료·보기가 발문에 통째로 들어간 것을 가른다
    3 자료 복원          잘려 나간 조건·표를 원본에서 되살린다
    4 도표 복구          아스키 그림을 구조화 표로
    5 제작 라벨 제거     "기초 1번", "💡 핵심 정리" 등
    6 보기 표기 정리     보기 본문의 A~E 중복 표기 제거
    7 정답 표기 통일     해설의 "정답: ④" → "정답: 4번"
    8 정답 키 정정       해설이 다른 답을 계산한 문항
    9 요점 해설 채우기   비어 있던 예시문항 해설
   10 정답 위치 균형     ②③ 쏠림 제거
   12 본문 사본 동기화   교재에 끼운 사본을 원본에서 다시 뜬다
   13 풀 수 없는 문항    자료가 없는 변형 문항을 출제에서 제외

실행: `python scripts/repair-all.py [--dry-run]`
"""

from __future__ import annotations

import hashlib
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# (스크립트, --dry-run 을 받는가)
STEPS = [
    ("repair-question-stems.py", True),
    ("repair-inline-choice-stems.py", True),
    ("restore-missing-context.py", True),
    ("repair-chart-questions.py", True),
    ("strip-production-labels.py", True),
    ("strip-choice-letter-prefix.py", True),
    ("normalize-answer-notation.py", True),
    ("repair-answer-key-conflicts.py", True),
    ("fill-summary-explanations.py", True),
    # 내용을 먼저 확정하고(4지선다 patch) **그다음에** 자리를 고르게 만든다.
    # 순서가 반대였을 때는 자리를 돌려 놓아도 patch 가 곧바로 원래 자리로
    # 되돌려, 정답이 patch 에 적어 둔 자리에 그대로 몰렸다.
    ("apply-four-choice.py", True),
    ("balance-answer-positions.py", True),
    ("sync-explanation-letters.py", True),
    ("apply-explanation-fix.py", True),
    ("normalize-explanation-refs.py", True),
    ("repair-explanation-claim.py", True),
    ("sync-inline-copies.py", True),
    ("retire-unanswerable-variants.py", True),
]


DATA = ROOT / "data"


def fingerprint() -> dict[str, str]:
    """문항 데이터 파일의 지문. 두 번 돌렸을 때 같은지 보려고 쓴다."""
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(DATA.glob("*.json")) if not p.name.endswith(".bak")}


def run_steps(dry: bool, quiet: bool = False) -> list[str]:
    failed = []
    for name, takes_dry in STEPS:
        script = ROOT / "scripts" / name
        if not script.exists():
            if not quiet:
                print(f"  ⚠️ {name}: 없음 — 건너뜀")
            continue
        cmd = [sys.executable, str(script)] + (["--dry-run"] if dry and takes_dry else [])
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        tail = [l for l in (r.stdout or "").splitlines() if l.strip()][-1:] or ["(출력 없음)"]
        mark = "✔" if r.returncode == 0 else "✗"
        if not quiet:
            print(f"  {mark} {name:38} {tail[0][:60]}")
        if r.returncode != 0:
            failed.append(name)
            for l in (r.stderr or "").splitlines()[-3:]:
                print(f"      {l[:90]}")
    return failed


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    dry = "--dry-run" in sys.argv

    failed = run_steps(dry)
    print(f"[복구전체] {len(STEPS) - len(failed)}/{len(STEPS)} 단계 성공"
          + (" (--dry-run)" if dry else ""))
    if failed:
        print(f"           실패: {failed}")
        return 1

    if not dry:
        # 한 번 더 돌려 **아무것도 바뀌지 않는지** 본다.
        #
        # 복구는 여러 번 돌게 되어 있다(데이터가 다시 생성될 때마다). 그런데
        # 번호로 보기를 지목하던 스크립트들은 뒤에 오는 '정답 위치 균형'이 순서를
        # 돌려 놓은 다음 두 번째로 돌면 엉뚱한 보기를 덮었다. 실제로 네 문항에서
        # 같은 보기가 두 개가 됐고, 한 문항은 정답까지 다른 곳을 가리켰다.
        # 게이트가 잡아 주긴 했지만, 원인을 바로 짚어 주지는 못했다.
        #
        # 두 번 돌려 지문이 같으면 그 부류의 고장은 없다.
        before = fingerprint()
        run_steps(False, quiet=True)
        after = fingerprint()
        drift = sorted(k for k in before if before[k] != after[k])
        if drift:
            print(f"  ✗ 두 번 돌리면 결과가 달라진다: {drift}")
            print("     번호로 보기·정답을 지목하는 복구가 남아 있다는 뜻이다. 본문 기준으로 바꿔라.")
            return 1
        print(f"  [반복안정] 두 번 돌려도 {len(before)}개 파일 그대로 ✅")

        gate = subprocess.run([sys.executable, str(ROOT / "scripts" / "gate-question-quality.py")],
                              cwd=ROOT, capture_output=True, text=True,
                              encoding="utf-8", errors="replace")
        for l in (gate.stdout or "").splitlines():
            if "게이트" in l or "✗" in l or "빈 단원" in l:
                print(f"  {l}")
        return gate.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
