# -*- coding: utf-8 -*-
"""Phase 1-④⑤ (식음료·품질): 장(h3) 경계 실측 → 블록↔단원 매핑 + 단원평가 quiz 주입.
- 식음료: 'N장' → C0N (능력단위). quiz = 기출/공식예상(exam-bank, 정답표기본)에서 결정적 12문항.
- 품질: 'N장' → s0N-N. quiz = answerSource 표기된 검증문항(choice/ox)에서 결정적 12문항.
"""
import json, os, re, sys, hashlib
sys.stdout.reconfigure(encoding='utf-8')
from bs4 import BeautifulSoup

DATA = os.path.join(os.path.dirname(__file__), '..', 'data')
TB = os.path.join(os.path.dirname(__file__), '..', '..', 'textbooks')

def block_chapter_map(fn, unit_of_chapter):
    soup = BeautifulSoup(open(os.path.join(TB, fn), encoding='utf-8').read(), 'html.parser')
    blocks = soup.find_all(class_='block')
    m, cur = [], None
    for i, b in enumerate(blocks):
        h = b.find(['h3', 'h4'])
        if h:
            mm = re.match(r'\s*(\d+)장', h.get_text())
            if mm:
                cur = unit_of_chapter(int(mm.group(1)))
        m.append({'blockIndex': i, 'unitId': cur})
    return m, len(blocks)

# ── 식음료 ──────────────────────────────────────────
fs_map, nfs = block_chapter_map('KBS_NOVA_식음료서비스_전자책.html', lambda n: f'C{n:02d}')
fs_units = sorted({x['unitId'] for x in fs_map if x['unitId']})
print(f'식음료: 블록 {nfs} · 단원 {fs_units}')

# 식음료 문항: 기출/공식(정답표기) 뱅크에서 lessonId별
def load_fs_bank():
    out = {}
    for f in ['food-service-exam-bank.json', 'food-service-official-spec.json']:
        d = json.load(open(os.path.join(DATA, f), encoding='utf-8'))
        arr = d if isinstance(d, list) else d.get('questions', [])
        for q in arr:
            lid = (q.get('lessonId') or q.get('unit') or '')[:3]
            if re.match(r'^C0[1-8]$', lid) and q.get('choices') and q.get('answer'):
                out.setdefault(lid, []).append(q)
    return out
fs_bank = load_fs_bank()
for x in fs_map:
    x['questionIds'] = [q.get('id') for q in fs_bank.get(x['unitId'], [])] if x['unitId'] else []
json.dump({'_meta': {'subject': 'food-service', 'date': '2026-07-05', 'rule': 'N장 h3 실측 + forward-fill'},
           'map': fs_map}, open(os.path.join(DATA, 'block-quiz-map-food-service.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('  뱅크 단원 분포:', {k: len(v) for k, v in sorted(fs_bank.items())})

def det_pick(pool, salt, n=12):
    return sorted(pool, key=lambda q: hashlib.md5((salt + str(q.get('id'))).encode()).hexdigest())[:n]

bp = os.path.join(DATA, 'textbook-food-service.json')
bundle = json.load(open(bp, encoding='utf-8'))
allfs = [q for v in fs_bank.values() for q in v]
for u in bundle['units']:
    qs = det_pick(allfs, u['unitId'])
    u['quiz'] = [{'id': q.get('id'), 'stem': q.get('stem'), 'context': q.get('context'),
                  'choices': q.get('choices'), 'answer': q.get('answer'),
                  'explanation': q.get('explanation'), 'label': q.get('lessonId', '')} for q in qs]
    print(f"  quiz 주입 {u['unitId']}: {len(u['quiz'])}")
json.dump(bundle, open(bp, 'w', encoding='utf-8'), ensure_ascii=False)

# ── 품질 ──────────────────────────────────────────
qm_map, nqm = block_chapter_map('KBS_NOVA_품질경영_전자책.html', lambda n: f's{n:02d}-{n}')
print(f'품질: 블록 {nqm} · 단원 {sorted({x["unitId"] for x in qm_map if x["unitId"]})}')

d = json.load(open(os.path.join(DATA, 'quality-mgmt-practice.json'), encoding='utf-8'))
qm_bank = {}
for u in d['units']:
    qs = list(u.get('questions') or [])
    for s in (u.get('sections') or []):
        qs += list(s.get('questions') or [])
    good = [q for q in qs if str(q.get('answerSource', '')).strip() not in ('', '?')
            and q.get('type') in ('choice', 'ox') and q.get('choices')]
    if good:
        qm_bank.setdefault(u['id'], []).extend(good)
for x in qm_map:
    x['questionIds'] = [q.get('id') for q in qm_bank.get(x['unitId'], [])] if x['unitId'] else []
json.dump({'_meta': {'subject': 'quality', 'date': '2026-07-05', 'rule': 'N장 h3 실측 + forward-fill · 검증문항만'},
           'map': qm_map}, open(os.path.join(DATA, 'block-quiz-map-quality.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('  검증문항 단원 분포:', {k: len(v) for k, v in sorted(qm_bank.items())})

bp = os.path.join(DATA, 'textbook-quality.json')
bundle = json.load(open(bp, encoding='utf-8'))
allqm = [q for v in qm_bank.values() for q in v]
for u in bundle['units']:
    qs = det_pick(allqm, u['unitId'])
    def choice_texts(q):
        return [c.get('text', str(c)) if isinstance(c, dict) else str(c) for c in q.get('choices', [])]
    def ans_letter(q):
        ch = q.get('choices', [])
        if ch and isinstance(ch[0], dict):
            vals = [c.get('value') for c in ch]
            return chr(65 + vals.index(q.get('answer'))) if q.get('answer') in vals else q.get('answer')
        return q.get('answer')
    u['quiz'] = [{'id': q.get('id'), 'stem': q.get('stem'), 'context': None,
                  'choices': choice_texts(q), 'answer': ans_letter(q),
                  'explanation': q.get('explanation'), 'label': q.get('heading', '')} for q in qs]
    print(f"  quiz 주입 {u['unitId']}: {len(u['quiz'])}")
json.dump(bundle, open(bp, 'w', encoding='utf-8'), ensure_ascii=False)
print('완료')
