# -*- coding: utf-8 -*-
"""Phase 1-② 마무리: 워크플로 판정(1,023건)을 품질 문항 데이터에 적용.
pass → answerSource='verified-vs-original-20260705'
fail → selfStudyOnly=True + answerSource='unverified-quarantined' (진단·모의고사 제외용)
"""
import json, re, sys, os
sys.stdout.reconfigure(encoding='utf-8')

OUT_FILE = r'C:\Users\kbe\AppData\Local\Temp\claude\D--Claude-KBS-NOVA-WORKSPACE\45f27eb7-e669-47e8-befd-29fe1fef4439\tasks\wxuut8quv.output'
DATA = os.path.join(os.path.dirname(__file__), '..', 'data')

doc = json.load(open(OUT_FILE, encoding='utf-8'))
obj = doc['result']
verdicts = {v['id']: v for v in obj['verdicts']}
print('판정 로드:', len(obj['verdicts']), '건 | 고유 id:', len(verdicts),
      '| pass:', sum(1 for v in obj['verdicts'] if v['verdict'] == 'pass'))

# 중복 id(배치 간 동일 id 재출현) → 하나라도 fail이면 fail (보수적)
dup_fail = {}
for v in obj['verdicts']:
    if v['id'] in dup_fail:
        if v['verdict'] == 'fail':
            dup_fail[v['id']] = 'fail'
    else:
        dup_fail[v['id']] = v['verdict']

applied = {'pass': 0, 'fail': 0, 'miss': 0}
def apply(fn):
    p = os.path.join(DATA, fn)
    d = json.load(open(p, encoding='utf-8'))
    units = d['units'] if isinstance(d, dict) else d
    for u in units:
        qlists = [u.get('questions') or []] + [s.get('questions') or [] for s in (u.get('sections') or [])]
        for qs in qlists:
            for q in qs:
                if str(q.get('answerSource', '')).strip() not in ('', '?'):
                    continue
                verdict = dup_fail.get(q.get('id'))
                if verdict == 'pass':
                    q['answerSource'] = 'verified-vs-original-20260705'
                    applied['pass'] += 1
                elif verdict == 'fail':
                    q['answerSource'] = 'unverified-quarantined'
                    q['selfStudyOnly'] = True
                    applied['fail'] += 1
                else:
                    applied['miss'] += 1
    json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    print('적용:', fn)

apply('quality-mgmt-practice.json')
apply('quality-mgmt-study.json')
print('결과:', applied)
