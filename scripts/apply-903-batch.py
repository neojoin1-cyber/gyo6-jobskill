# -*- coding: utf-8 -*-
"""
903 3·5단계 적용 — 판정을 실제 문항에 붙인다.

에이전트는 **판단만** 한다(어느 하위능력인가, 어느 오답이 가장 약한가).
문항을 실제로 고치는 것은 이 스크립트다. 에이전트에게 선택지 배열을
통째로 다시 쓰게 하면 따옴표·공백·번호 표기가 조금씩 달라지면서
데이터가 서서히 망가진다. 판단과 수술을 나누는 이유다.

── 5지 → 4지로 줄일 때 따라오는 것들 ────────────────────────────────
선택지 하나를 빼면 그 뒤 선택지의 번호가 하나씩 당겨진다. 그래서
  · 정답 글자(A~E)를 다시 계산해야 하고
  · 해설이 "③이 정답" 처럼 번호를 부르고 있으면 그것도 따라와야 하며
  · 정답이 여러 개인 문항은 전부 옮겨야 한다.
하나라도 빠지면 정답과 해설이 어긋난 문항이 학생에게 나간다.

사용
  python scripts/apply-903-batch.py --dry     무엇이 바뀌는지만 본다
  python scripts/apply-903-batch.py           실제로 적용
"""
import json, io, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.cache', '903')
DRY = '--dry' in sys.argv

TARGETS = {
    'app': 'D:/Claude/KBS_NOVA_WORKSPACE/gyo6-jobskill-game/data/ncs-questions.json',
    'tb':  'D:/apps/sugar-salt/textbooks/_questions_by_area.json',
}
LETTERS = 'ABCDE'

def load(p):
    d = json.load(io.open(p, encoding='utf-8'))
    if isinstance(d, dict) and 'questions' in d: return d, d['questions'], 'dict'
    if isinstance(d, list): return d, d, 'list'
    return d, None, 'buckets'

def iter_questions(raw, kind):
    if kind == 'buckets':
        for k, v in raw.items():
            if isinstance(v, list):
                for q in v:
                    if isinstance(q, dict): yield q
    elif kind == 'dict':
        for q in raw['questions']: yield q
    else:
        for q in raw: yield q

def ans_indices(ans, n):
    """정답이 리스트 ['A','B'] 로 저장된 문항도 있다. 형태부터 편다."""
    out = []
    if ans is None: return out
    parts = ans if isinstance(ans, (list, tuple)) else str(ans).replace(',', ' ').split()
    for t in parts:
        t = str(t).strip().upper()
        i = LETTERS.find(t)
        if 0 <= i < n: out.append(i); continue
        if t.isdigit():
            k = int(t) - 1
            if 0 <= k < n: out.append(k)
    return out

# 해설 안의 번호 표기. ①~⑤ · "3번" · "3)" 를 잡는다.
CIRCLE = '①②③④⑤'
def renumber_explanation(text, old_to_new, n_old):
    """뺀 선택지 뒤 번호를 하나씩 당긴다. 없어진 번호를 부르면 그대로 둔다."""
    if not text: return text, False
    changed = False
    def circ(m):
        nonlocal changed
        i = CIRCLE.index(m.group(0))
        j = old_to_new.get(i)
        if j is None: return m.group(0)      # 사라진 보기를 가리킴 — 손대지 않는다
        if j != i: changed = True
        return CIRCLE[j]
    out = re.sub('[' + CIRCLE + ']', circ, text)

    def num(m):
        nonlocal changed
        i = int(m.group(1)) - 1
        if i < 0 or i >= n_old: return m.group(0)
        j = old_to_new.get(i)
        if j is None: return m.group(0)
        if j != i: changed = True
        return f'{j + 1}{m.group(2)}'
    out = re.sub(r'\b([1-5])(번|\))', num, out)
    return out, changed

def main():
    # 판정 모으기
    judg = {}
    for f in sorted(os.listdir(CACHE)):
        if not f.startswith('out-batch-'): continue
        for r in json.load(io.open(os.path.join(CACHE, f), encoding='utf-8')):
            judg[r['id']] = r
    if not judg:
        print('판정 파일이 없습니다.'); return

    report = collections.Counter()
    mismatches = []

    for tag, path in TARGETS.items():
        if not os.path.exists(path): continue
        raw, _, kind = load(path)
        touched = 0
        for q in iter_questions(raw, kind):
            r = judg.get(q.get('id'))
            if not r: continue

            # ── 3단계: 하위능력 ──────────────────────────────────
            if r.get('subAbility'):
                q['subAbility'] = r['subAbility']
                report[f'{tag}:subAbility'] += 1
            if r.get('areaMismatch'):
                q['areaReview'] = r.get('suggestedArea') or True
                mismatches.append((q.get('id'), q.get('area'), r.get('suggestedArea')))
                report[f'{tag}:areaReview'] += 1

            # ── 5단계: 5지 → 4지 ────────────────────────────────
            ri = r.get('removeIndex')
            ch = q.get('choices') or []
            ai_all = ans_indices(q.get('answer'), len(ch)) if ch else []
            # 오답이 하나뿐이거나 아예 없는 문항은 줄이지 않는다. 그 하나를
            # 빼면 남은 것이 전부 정답이 되어 고를 이유가 사라진다.
            # 애초에 오답이 0개인 문항은 지금도 변별력이 없다 — 저작 검토 대상.
            if ch and len(ch) - len(ai_all) == 0:
                q['needsAuthoring'] = 'all-choices-correct'
                report[f'{tag}:전부정답_저작검토'] += 1
            elif ch and len(ch) == 5 and len(ch) - len(ai_all) == 1:
                q['needsAuthoring'] = 'only-one-distractor'
                report[f'{tag}:오답1개_축약보류'] += 1
            elif ri is not None and len(ch) == 5 and 0 <= ri < 5:
                ai = ai_all
                if ri in ai:
                    report[f'{tag}:정답제거_거부'] += 1     # 검사기가 막았어야 할 것
                else:
                    old_to_new = {}
                    new_ch = []
                    for i, c in enumerate(ch):
                        if i == ri: continue
                        old_to_new[i] = len(new_ch)
                        new_ch.append(c)
                    q['choices'] = new_ch
                    # ★ 정답이 여럿인 문항은 **배열로 두어야 한다.**
                    #   앱은 Array.isArray(q.answer) 로 멀티체크형을 판별한다
                    #   (questionNorm.js:51, StudyScreen.jsx:278). 쉼표 문자열로
                    #   붙이면 단일정답으로 취급돼 채점이 틀어진다.
                    letters = [LETTERS[old_to_new[i]] for i in sorted(ai)]
                    q['answer'] = letters if len(letters) > 1 else letters[0]
                    q['fourChoice'] = True
                    q['removedChoice'] = {'index': ri, 'text': str(ch[ri])[:120],
                                          'why': r.get('why')}
                    exp, ch_ = renumber_explanation(q.get('explanation'), old_to_new, 5)
                    if ch_:
                        q['explanation'] = exp
                        report[f'{tag}:해설번호정정'] += 1
                    report[f'{tag}:4지변환'] += 1
            touched += 1

        if not DRY and touched:
            io.open(path, 'w', encoding='utf-8').write(
                json.dumps(raw, ensure_ascii=False, indent=2) + '\n')

    print(('[미리보기] ' if DRY else '') + '적용 결과')
    for k in sorted(report): print(f'  {k}: {report[k]}')
    if mismatches:
        print(f'\n영역 재검토 대상 {len(mismatches)}건 (상위 8)')
        for m in mismatches[:8]: print(f'  {m[0]}: {m[1]} → {m[2]}')

main()
