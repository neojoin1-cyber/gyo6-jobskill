# -*- coding: utf-8 -*-
"""Phase 1-② 준비: 품질 미표기 1,023문항 → 검증 배치 파일(15문항/배치) 생성."""
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
DATA = os.path.join(os.path.dirname(__file__), '..', 'data')
OUTD = os.path.join(DATA, 'qm-verify')
os.makedirs(OUTD, exist_ok=True)

def collect(fn, src):
    d = json.load(open(os.path.join(DATA, fn), encoding='utf-8'))
    units = d['units'] if isinstance(d, dict) else d
    out = []
    for u in units:
        qs = list(u.get('questions') or [])
        for s in (u.get('sections') or []):
            qs += list(s.get('questions') or [])
        for q in qs:
            if str(q.get('answerSource', '')).strip() in ('', '?'):
                out.append({
                    'file': src, 'unit': u.get('id'), 'unitTitle': u.get('title'),
                    'id': q.get('id'), 'type': q.get('type'),
                    'stem': q.get('stem'), 'choices': q.get('choices') or [],
                    'answer': q.get('answer'),
                    'modelAnswer': q.get('modelAnswer'),
                    'explanation': q.get('explanation'),
                })
    return out

allq = collect('quality-mgmt-practice.json', 'practice') + collect('quality-mgmt-study.json', 'study')
print('미표기 총:', len(allq))

B = 15
batches = [allq[i:i+B] for i in range(0, len(allq), B)]
for i, b in enumerate(batches):
    json.dump(b, open(os.path.join(OUTD, f'batch_{i:03d}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('배치:', len(batches), '개 →', OUTD)
