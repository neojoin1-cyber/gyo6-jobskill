# -*- coding: utf-8 -*-
"""
903 판정 결과 검사기 — 적용 **전에** 전부 걸러낸다.

서브에이전트가 판정한 것을 그대로 믿고 문항에 붙이면, 한 번 어긋난 것을
나중에 찾아내기가 매우 어렵다. 그래서 붙이기 전에 아래를 전수 검사한다.

  1  입력의 모든 id 가 출력에 있는가 (빠뜨림)
  2  출력에 입력에 없는 id 가 있는가 (지어냄)
  3  id 가 중복되는가
  4  subAbility 가 그 문항의 area 에 실제로 있는 하위능력인가
  5  removeIndex 가 선택지 범위 안인가
  6  removeIndex 가 **정답을 가리키지 않는가**  ← 가장 위험한 실수
  7  5지선다인데 removeIndex 가 없는가 / 5지가 아닌데 있는가

하나라도 걸리면 그 배치는 적용하지 않는다.
"""
import json, io, sys, os

def answer_indices(ans, n):
    """정답 번호들.

    'B,C' · 'B' · 2 · 'O' 뿐 아니라 **리스트** ['A','B'] 형태도 있다.
    리스트를 str() 로 바꿔 쪼개면 "['A'," 같은 토큰이 나와 하나도 못 읽고,
    그러면 「정답이 없는 문항」으로 잘못 보인다. 형태부터 편다.
    """
    if ans is None: return set()
    parts = ans if isinstance(ans, (list, tuple)) else str(ans).replace(',', ' ').split()
    out = set()
    for t in parts:
        t = str(t).strip().upper()
        i = 'ABCDE'.find(t)
        if i >= 0 and i < n: out.add(i); continue
        if t.isdigit():
            k = int(t) - 1
            if 0 <= k < n: out.add(k)
    return out

def check(inp_path, out_path):
    inp = json.load(io.open(inp_path, encoding='utf-8'))
    try:
        out = json.load(io.open(out_path, encoding='utf-8'))
    except Exception as e:
        return [f'출력 JSON 파싱 실패: {e}'], [], 0

    by_id = {q['id']: q for q in inp}
    errs = []
    warns = []
    seen = set()

    for r in out:
        rid = r.get('id')
        if rid not in by_id:
            errs.append(f'{rid}: 입력에 없는 id'); continue
        if rid in seen:
            errs.append(f'{rid}: 중복'); continue
        seen.add(rid)

        q = by_id[rid]
        allowed = q.get('allowed') or []
        sub = r.get('subAbility')
        if allowed and sub not in allowed:
            errs.append(f'{rid}: subAbility "{sub}" 가 {q.get("area")} 에 없음')

        n = q.get('nChoices') or 0
        ri = r.get('removeIndex')
        # 정답이 여러 개라 오답이 하나뿐인 문항이 있다. 그 하나를 빼면
        # 남은 넷이 전부 정답이 되어 문항이 무너진다. 줄이면 안 된다.
        n_ans = len(answer_indices(q.get('answer'), n))
        reducible = n == 5 and (n - n_ans) >= 2
        if n == 5 and not reducible:
            # 이건 판정자 잘못이 아니다 — 지시서에 이 규칙이 없었다.
            # 적용 스크립트가 알아서 무시하고 저작 검토로 돌리므로 경고만 남긴다.
            if ri is not None:
                warns.append(f'{rid}: 오답 {n-n_ans}개뿐 — 축약 보류(저작 검토)')
        elif n == 5:
            if ri is None:
                errs.append(f'{rid}: 5지선다인데 removeIndex 없음')
            elif not isinstance(ri, int) or ri < 0 or ri >= n:
                errs.append(f'{rid}: removeIndex {ri} 가 범위 밖(0~{n-1})')
            elif ri in answer_indices(q.get('answer'), n):
                errs.append(f'{rid}: ★ removeIndex {ri} 가 정답({q.get("answer")})을 가리킴')
        else:
            if ri is not None:
                errs.append(f'{rid}: {n}지선다인데 removeIndex {ri} 지정')

    missing = set(by_id) - seen
    for m in sorted(missing): errs.append(f'{m}: 판정 빠짐')
    return errs, warns, len(seen)
if __name__ == '__main__':
    d = '.cache/903'
    names = sorted(x for x in os.listdir(d) if x.startswith('batch-'))
    total_ok = total_err = total_warn = 0
    for b in names:
        o = os.path.join(d, 'out-' + b)
        if not os.path.exists(o): continue
        errs, warns, n = check(os.path.join(d, b), o)
        total_ok += n; total_err += len(errs); total_warn += len(warns)
        mark = 'OK  ' if not errs else 'FAIL'
        tail = f'  오류 {len(errs)}' + (f'  경고 {len(warns)}' if warns else '')
        print(f'{mark} {b}  판정 {n}건{tail}')
        for e in errs[:6]: print(f'       {e}')
        if len(errs) > 6: print(f'       … 외 {len(errs)-6}건')
    print(f'\n합계 판정 {total_ok}건 · 오류 {total_err}건 · 경고 {total_warn}건')
    if total_warn:
        print('  경고는 적용 시 「축약 보류 + 저작 검토」로 자동 처리됩니다.')
    sys.exit(1 if total_err else 0)
