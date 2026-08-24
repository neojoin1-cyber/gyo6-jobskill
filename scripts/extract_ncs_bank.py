# -*- coding: utf-8 -*-
"""
NCS 원본 교재(1~3권) → 문항뱅크 결정적 추출 (Phase 1-①).
원문에 명시된 정답('정답: ④번')만 사용 — 추측·생성 0 (날조 금지 원칙).

구조: .lesson > .linner 순차 자식
  div.sh(라벨: 진단 문항/기초 1번/…) → p.tx(발문) → div.qbox(제시문)* → div.ch×N(선택지)
  → details.gyo6-answer-details(summary에 '해설서 보기 <라벨> 정답', 본문에 '정답: ④번' + 해설)
출력: data/ncs-extracted-bank.json
"""
import sys, re, json, os
sys.stdout.reconfigure(encoding='utf-8')
from bs4 import BeautifulSoup

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'ncs-extracted-bank.json')

VOLUMES = [
    ('NC직업기초능력교재1권.html', 'v1'),
    ('NCS직업기초능력교재2권.html', 'v2'),
    ('NCS직업기초능력교재3권.html', 'v3'),
]

CIRCLED = {'①':'A','②':'B','③':'C','④':'D','⑤':'E'}

def norm(t):
    return re.sub(r'\s+', ' ', t or '').strip()

def parse_volume(path, vol):
    soup = BeautifulSoup(open(path, encoding='utf-8').read(), 'html.parser')
    out, skipped = [], []
    for les in soup.find_all(class_='lesson'):
        lid = les.get('id') or '?'
        # 차시 제목: lesson 내 첫 제목성 텍스트(클래스 다양 → 첫 .sh 이전의 굵은 텍스트 or lheader)
        title_el = les.find(class_=re.compile(r'ltitle|lesson-title|lheader'))
        ltitle = norm(title_el.get_text())[:80] if title_el else ''
        # 영역: 차시 메타에서 '의사소통' 등 키워드 (없으면 권 기본)
        area = ''
        meta = les.find(class_=re.compile(r'lmeta|meta'))
        if meta: area = norm(meta.get_text())[:30]

        linner = les.find(class_='linner') or les

        # 단일 패스: 문서 순서대로 문항(선택지 묶음 감지)·해설(해설서 details) 두 큐 수집.
        # '함께 풀어보기' 섹션은 해설서가 없는 예시풀이 → 문항 큐에서 제외.
        SKIP_SECTIONS = ('함께 풀어보기',)
        qqueue, dqueue = [], []
        section = ''
        buf = []            # 마지막 경계 이후 텍스트 요소들 (stem/지문 후보)
        cur_choices = []    # 진행 중 선택지

        def flush_question():
            nonlocal buf, cur_choices
            if len(cur_choices) >= 2:
                stem = ''
                ctx = []
                for name, cls, txt in buf:
                    if not stem and name == 'p' and 'tx' in cls and 'subtit-plain' not in cls:
                        stem = txt
                    elif txt:
                        ctx.append(txt)
                if stem and not any(sec in section for sec in SKIP_SECTIONS):
                    qqueue.append({'section': section, 'stem': stem,
                                   'context': '\n'.join(ctx) or None,
                                   'choices': cur_choices[:]})
            buf = []; cur_choices = []

        for el in linner.find_all(recursive=False):
            cls = el.get('class') or []
            if el.name == 'details':
                sm = norm((el.find('summary') or el).get_text())
                if '해설' in sm:
                    flush_question()
                    body = norm(el.get_text())
                    mlab = re.search(r'해설서\s*보기\s*(.*?)\s*정답', sm)
                    m = re.search(r'정답\s*[:：]?\s*([①②③④⑤])', body)
                    if m:
                        dqueue.append({'label': (mlab.group(1).strip() if mlab else ''),
                                       'answer': CIRCLED[m.group(1)],
                                       'explanation': re.sub(r'^해설서 보기\s*', '', body)})
                continue
            if 'sh' in cls:
                flush_question()
                section = norm(el.get_text())
                continue
            if 'ch' in cls and el.name == 'div':
                if len(cur_choices) >= 5:
                    flush_question()
                cur_choices.append(re.sub(r'^[①②③④⑤]\s*', '', norm(el.get_text())))
                continue
            if cur_choices:      # 선택지 뒤 일반 요소 = 문항 종료
                flush_question()
            t = norm(el.get_text())
            if t:
                buf.append((el.name, cls, t))
        flush_question()

        # 패밀리(섹션군) 단위 페어링 — 개수 불일치 시 그 패밀리는 통째로 제외(오정렬 원천 차단).
        def fam_of_section(sec):
            if '진단' in sec: return 'diag'
            if '재도전' in sec: return 'retry'
            return 'practice'
        def fam_of_label(lab):
            if '진단' in lab: return 'diag'
            if '재도전' in lab: return 'retry'
            return 'practice'
        qf, df = {}, {}
        for q in qqueue: qf.setdefault(fam_of_section(q['section']), []).append(q)
        for dd in dqueue: df.setdefault(fam_of_label(dd['label']), []).append(dd)
        pairs = []
        for fam in ('diag', 'practice', 'retry'):
            a, b = qf.get(fam, []), df.get(fam, [])
            if len(a) == len(b):
                pairs += list(zip(a, b))
            elif a or b:
                skipped.append((lid, f'{fam} q{len(a)}/d{len(b)}', 'family-mismatch-dropped'))
        qn = 0
        for q, d in pairs:
            if ord(d['answer']) - 65 >= len(q['choices']):
                skipped.append((lid, d['label'], 'answer-out-of-range'))
                continue
            qn += 1
            out.append({
                'id': f'NCSX-{vol}-{lid}-Q{qn:02d}',
                'source': 'ncs-original-' + vol,
                'lessonId': lid, 'lessonTitle': ltitle, 'areaHint': area,
                'label': d['label'] or q['section'],
                'stem': q['stem'], 'context': q['context'],
                'choices': q['choices'],
                'answer': d['answer'], 'explanation': d['explanation'],
                'answerSource': 'explicit',
            })
    return out, skipped

all_q, all_skip = [], []
for fn, vol in VOLUMES:
    qs, sk = parse_volume(os.path.join(ROOT, fn), vol)
    all_q += qs; all_skip += sk
    print(f'{fn}: 추출 {len(qs)} · 스킵 {len(sk)}')

# 검증: id 중복·정답 범위·선택지 수
ids = [q['id'] for q in all_q]
assert len(ids) == len(set(ids)), 'ID 중복!'
bad = [q for q in all_q if not (2 <= len(q['choices']) <= 5)]
print('선택지 수 이상:', len(bad))
from collections import Counter
print('선택지 수 분포:', dict(Counter(len(q['choices']) for q in all_q)))
print('정답 분포:', dict(Counter(q['answer'] for q in all_q)))
print('스킵 사유:', dict(Counter(s[2] for s in all_skip)))

json.dump({'_meta': {'source': 'NCS 원본 1~3권 결정적 추출', 'date': '2026-07-05',
                     'rule': '원문 명시 정답만(answerSource=explicit)'},
           'questions': all_q},
          open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print('저장:', OUT, '| 총', len(all_q), '문항')
