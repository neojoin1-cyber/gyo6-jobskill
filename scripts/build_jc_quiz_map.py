# -*- coding: utf-8 -*-
"""Phase 1-④⑤ (직업공통): 블록↔문항 매핑(섹션 id 실측 + forward-fill) + 단원평가 quiz 주입."""
import json, os, re, sys, hashlib
sys.stdout.reconfigure(encoding='utf-8')
from bs4 import BeautifulSoup

DATA = os.path.join(os.path.dirname(__file__), '..', 'data')
TB = os.path.join(os.path.dirname(__file__), '..', '..', 'textbooks')

bank = json.load(open(os.path.join(DATA, 'questions.json'), encoding='utf-8'))
bank = [q for q in bank if not q.get('excludeFromQuiz')]
by_lesson = {}
for q in bank:
    by_lesson.setdefault(q['lessonId'], []).append(q)

soup = BeautifulSoup(open(os.path.join(TB, 'KBS_NOVA_직업공통_전자책.html'), encoding='utf-8').read(), 'html.parser')
blocks = soup.find_all(class_='block')
m, cur = [], None
for i, b in enumerate(blocks):
    el = b.find(id=re.compile(r'^C\d+-\d+-section'))
    if el:
        cur = re.sub(r'-section.*$', '', el.get('id'))
    qids = [q['id'] for q in by_lesson.get(cur, [])] if cur else []
    m.append({'blockIndex': i, 'lessonId': cur, 'questionIds': qids})
linked = sum(1 for x in m if x['questionIds'])
lessons_covered = len({x['lessonId'] for x in m if x['lessonId']})
print(f'직업공통: 블록 {len(m)} · 차시연결 블록 {linked} · 차시 {lessons_covered} · 뱅크차시 {len(by_lesson)}')

json.dump({'_meta': {'subject': 'job-common', 'date': '2026-07-05',
                     'rule': '섹션 id 실측 + 직전 차시 forward-fill'},
           'map': m},
          open(os.path.join(DATA, 'block-quiz-map-job-common.json'), 'w', encoding='utf-8'), ensure_ascii=False)

# 단원평가 quiz: 전 차시 고른 샘플 12문항(결정적)
def pick(uid='jc-full', n=12):
    picked, i = [], 0
    lessons = sorted(by_lesson.keys())
    while len(picked) < n and i < 50:
        for lid in lessons:
            pool = sorted(by_lesson[lid], key=lambda q: hashlib.md5((uid + q['id']).encode()).hexdigest())
            if i < len(pool):
                picked.append(pool[i])
                if len(picked) >= n: break
        i += 1
    return picked[:n]

bp = os.path.join(DATA, 'textbook-job-common.json')
bundle = json.load(open(bp, encoding='utf-8'))
for u in bundle['units']:
    u['quiz'] = [{'id': q['id'], 'stem': q['stem'], 'context': None,
                  'choices': q['choices'], 'answer': q['answer'],
                  'explanation': q['explanation'], 'label': q.get('lessonTitle', '')} for q in pick(u['unitId'])]
    print(f"quiz 주입 {u['unitId']}: {len(u['quiz'])}문항")
json.dump(bundle, open(bp, 'w', encoding='utf-8'), ensure_ascii=False)
print('완료')
