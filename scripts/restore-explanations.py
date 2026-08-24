# -*- coding: utf-8 -*-
"""
망가진 해설을 백업에서 되살린다.

fix-explanation-answer-label.py 의 정규식 버그로 해설에서 띄어쓰기·쉼표·
마침표가 지워졌다. 지워진 것은 되돌릴 수 없으므로 백업에서 가져온다.

**망가진 것만** 되살린다 — 백업 해설에서 공백·쉼표·마침표를 뺀 것이
지금 해설과 같으면 그건 망가진 것이다. 그 외에는 손대지 않는다(정상적으로
번호를 옮긴 해설까지 되돌리면 안 된다).
"""
import json, io, os, re, sys

PAIRS = [
  ('data/ncs-questions.json', 'data/_backup-903-stage35/ncs-questions.json'),
  ('D:/apps/sugar-salt/textbooks/_questions_by_area.json',
   'data/_backup-903-stage35/_questions_by_area.json'),
  ('D:/apps/sugar-salt/data/question-banks/ncs-questions.json',
   'D:/apps/sugar-salt/data/question-banks/_backup-903/ncs-questions.json'),
]
strip = lambda s: re.sub(r'[\s,.]', '', str(s or ''))
marks = lambda s: len(re.findall(r'[\s,.]', str(s or '')))

def load(p):
    d = json.load(io.open(p, encoding='utf-8'))
    if isinstance(d, dict) and 'questions' in d: return d, d['questions']
    if isinstance(d, list): return d, d
    return d, [x for v in d.values() if isinstance(v, list) for x in v]

for cur_p, bak_p in PAIRS:
    if not (os.path.exists(cur_p) and os.path.exists(bak_p)):
        print(f'  건너뜀 {cur_p}'); continue
    doc, cur = load(cur_p)
    _, bak = load(bak_p)
    by = {q.get('id'): q for q in bak}
    n = untouched = 0
    for q in cur:
        b = by.get(q.get('id'))
        if not b: continue
        now, old = str(q.get('explanation') or ''), str(b.get('explanation') or '')
        if not old or now == old: continue
        # 손상 신호 — 글 내용은 그대로인데 공백·부호만 크게 줄었다.
        # 번호표까지 함께 바뀐 경우가 있어 「완전히 같은가」로는 못 잡는다.
        marks_old, marks_now = marks(old), marks(now)
        same_body = abs(len(strip(now)) - len(strip(old))) < 40
        if marks_old >= 4 and marks_now <= marks_old * 0.4 and same_body:
            q['explanation'] = old
            q.pop('explanationLabelFixed', None)   # 번호표는 뒤에서 다시 맞춘다
            n += 1
        else:
            untouched += 1               # 정상적으로 바뀐 해설 — 손대지 않는다
    io.open(cur_p, 'w', encoding='utf-8').write(json.dumps(doc, ensure_ascii=False, indent=2) + '\n')
    print(f'  {os.path.basename(cur_p)}: 복원 {n}건 · 정상 변경이라 유지 {untouched}건')
