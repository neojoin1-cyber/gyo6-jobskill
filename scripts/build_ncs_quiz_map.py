# -*- coding: utf-8 -*-
"""
Phase 1-④⑤ (NCS): 추출뱅크 → ①블록↔문항 매핑 ②단원평가 quiz 주입.
- NCS 전자책 .block[i] = 원본 .lesson[i] (변환기가 lesson당 1블록 생성) → lessonId로 정확 매핑.
- textbook-ncs-basic.json units[v].quiz = 권별 단원평가(차시 고른 샘플, 결정적 시드).
- 산출: data/block-quiz-map-ncs.json + textbook-ncs-basic.json quiz 필드 갱신.
"""
import json, os, re, sys, hashlib
sys.stdout.reconfigure(encoding='utf-8')
from bs4 import BeautifulSoup

DATA = os.path.join(os.path.dirname(__file__), '..', 'data')
TB = os.path.join(os.path.dirname(__file__), '..', '..', 'textbooks')

bank = json.load(open(os.path.join(DATA, 'ncs-extracted-bank.json'), encoding='utf-8'))['questions']
by_lesson = {}
for q in bank:
    by_lesson.setdefault(q['lessonId'], []).append(q)

VOL_FILES = {'ncs-v1': 'KBS_NOVA_NCS_1권_의사소통수리.html',
             'ncs-v2': 'KBS_NOVA_NCS_2권_문제해결자원관리외.html',
             'ncs-v3': 'KBS_NOVA_NCS_3권_상식인적성.html'}

# 1) 블록 인덱스 ↔ lessonId: 전자책의 .block 내부 .lesson id를 그대로 읽어 확정(가정 아님)
blockmap = {}
for uid, fn in VOL_FILES.items():
    soup = BeautifulSoup(open(os.path.join(TB, fn), encoding='utf-8').read(), 'html.parser')
    blocks = soup.find_all(class_='block')
    m = []
    for i, b in enumerate(blocks):
        les = b.find(class_='lesson')
        lid = les.get('id') if les else None
        qids = [q['id'] for q in by_lesson.get(lid, [])]
        m.append({'blockIndex': i, 'lessonId': lid, 'questionIds': qids})
    blockmap[uid] = m
    ok = sum(1 for x in m if x['questionIds'])
    print(f'{uid}: 블록 {len(m)} · 문항연결 블록 {ok} · 연결문항 {sum(len(x["questionIds"]) for x in m)}')

json.dump({'_meta': {'subject': 'ncs-basic', 'date': '2026-07-05',
                     'rule': '.block 내부 .lesson id 실측 매핑(추정 없음)'},
           'map': blockmap},
          open(os.path.join(DATA, 'block-quiz-map-ncs.json'), 'w', encoding='utf-8'), ensure_ascii=False)

# 2) 권별 단원평가 quiz: 각 권에서 차시 고른 샘플 12문항(결정적: id 해시 정렬)
def pick(uid, n=12):
    lessons = [x['lessonId'] for x in blockmap[uid] if x['questionIds']]
    picked, i = [], 0
    while len(picked) < n and i < 100:
        for lid in lessons:
            pool = sorted(by_lesson[lid], key=lambda q: hashlib.md5((uid + q['id']).encode()).hexdigest())
            if i < len(pool):
                picked.append(pool[i])
                if len(picked) >= n: break
        i += 1
    return picked[:n]

bundle_path = os.path.join(DATA, 'textbook-ncs-basic.json')
bundle = json.load(open(bundle_path, encoding='utf-8'))
for u in bundle['units']:
    qz = [{'id': q['id'], 'stem': q['stem'], 'context': q['context'],
           'choices': q['choices'], 'answer': q['answer'],
           'explanation': q['explanation'], 'label': q['label']} for q in pick(u['unitId'])]
    u['quiz'] = qz
    print(f"quiz 주입 {u['unitId']}: {len(qz)}문항")
json.dump(bundle, open(bundle_path, 'w', encoding='utf-8'), ensure_ascii=False)
print('완료: block-quiz-map-ncs.json + textbook-ncs-basic.json(quiz)')
