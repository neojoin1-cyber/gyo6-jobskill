# -*- coding: utf-8 -*-
"""Phase 2: 블록별 인라인 확인문제 데이터 생성.
각 블록에 그 블록이 속한 차시/단원 문항 중 1개를 중복 없이 분배(임베드).
산출: data/block-inline-<subject>.json = {"blocks":{"<idx>":[qObj]}}
qObj = {id, stem, context, choices[], answer('A'..), explanation}
"""
import json, os, sys, hashlib
sys.stdout.reconfigure(encoding='utf-8')
DATA = os.path.join(os.path.dirname(__file__), '..', 'data')

def jload(f):
    return json.load(open(os.path.join(DATA, f), encoding='utf-8'))

def norm_letter(ans, choices):
    if isinstance(ans, str) and len(ans) == 1 and ans in 'ABCDE':
        return ans
    # value 기반(품질 {value,text}) → letter
    if choices and isinstance(choices[0], dict):
        vals = [c.get('value') for c in choices]
        if ans in vals:
            return chr(65 + vals.index(ans))
    return None

def choice_texts(choices):
    return [c.get('text', str(c)) if isinstance(c, dict) else str(c) for c in choices]

def mk(q):
    """소스 문항 → 표준 qObj (mcq만). 부적합 시 None."""
    ch = q.get('choices') or []
    if len(ch) < 2:
        return None
    letter = norm_letter(q.get('answer'), ch)
    texts = choice_texts(ch)
    if not letter or (ord(letter) - 65) >= len(texts):
        return None
    return {
        'id': q.get('id'), 'stem': q.get('stem') or q.get('question') or '',
        'context': q.get('context'), 'choices': texts, 'answer': letter,
        'explanation': q.get('explanation') or '',
    }

# ── 소스 뱅크: id → qObj ──
def index(rows):
    d = {}
    for q in rows:
        o = mk(q)
        if o and o['id'] and o['stem']:
            d[o['id']] = o
    return d

NCS = index(jload('ncs-extracted-bank.json')['questions'])
JC = index([q for q in jload('questions.json') if not q.get('excludeFromQuiz')])
# 품질: 검증 통과(verified) + 자율격리 제외 + mcq
qm_rows = []
for u in jload('quality-mgmt-practice.json')['units']:
    qs = list(u.get('questions') or [])
    for s in (u.get('sections') or []):
        qs += list(s.get('questions') or [])
    for q in qs:
        src = str(q.get('answerSource', '')).strip()
        if src not in ('', '?', 'unverified-quarantined') and q.get('type') in ('choice', 'ox'):
            qm_rows.append(q)
QM = index(qm_rows)
# 식음료: exam-bank + official-spec
fs_rows = []
for f in ['food-service-exam-bank.json', 'food-service-official-spec.json']:
    d = jload(f)
    fs_rows += d if isinstance(d, list) else d.get('questions', [])
FS = index(fs_rows)

BANKS = {'ncs-basic': NCS, 'job-common': JC, 'quality': QM, 'food-service': FS}
MAPS = {'ncs-basic': 'block-quiz-map-ncs.json', 'job-common': 'block-quiz-map-job-common.json',
        'quality': 'block-quiz-map-quality.json', 'food-service': 'block-quiz-map-food-service.json'}

# 단일단원 과목의 unitId
SINGLE_UNIT = {'job-common': 'jc-full', 'quality': 'qm-full', 'food-service': 'fs-full'}

def assign_unit(entries, bank, used):
    """한 단원의 entries(blockIndex/lessonId|unitId/questionIds) → {blockIdx:[qObj]}."""
    groups, qidsByKey = {}, {}
    for e in entries:
        key = e.get('lessonId') or e.get('unitId') or '_'
        groups.setdefault(key, []).append(e['blockIndex'])
        qidsByKey.setdefault(key, e.get('questionIds') or [])
    res = {}
    n = 0
    for key, blocks in groups.items():
        qids = [q for q in qidsByKey[key] if q in bank and q not in used]
        qids.sort(key=lambda x: hashlib.md5((str(key) + str(x)).encode()).hexdigest())
        for bi, qid in zip(sorted(blocks), qids):
            res[str(bi)] = [bank[qid]]
            used.add(qid); n += 1
    return res, n

for subj, mapfile in MAPS.items():
    bank = BANKS[subj]
    m = jload(mapfile)['map']
    used = set()
    units_out, total = {}, 0
    if isinstance(m, dict):   # NCS: {uid: [entries]}
        for uid, entries in m.items():
            r, n = assign_unit(entries, bank, used); units_out[uid] = r; total += n
    else:                     # 단일단원 list
        r, n = assign_unit(m, bank, used); units_out[SINGLE_UNIT[subj]] = r; total += n
    out = {'_meta': {'subject': subj, 'date': '2026-07-05', 'rule': '블록당 1문항 중복없이 분배'},
           'units': units_out}
    json.dump(out, open(os.path.join(DATA, f'block-inline-{subj}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{subj}: 인라인문항 배정 {total} · 뱅크가용 {len(bank)} · 단원 {list(units_out.keys())}')
