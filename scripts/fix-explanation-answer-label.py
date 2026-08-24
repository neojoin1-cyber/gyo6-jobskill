# -*- coding: utf-8 -*-
"""
해설 첫머리의 「정답(N번)」 번호표를 실제 정답에 맞춘다.

── 왜 어긋났나 ──────────────────────────────────────────────────────
해설은 「정답(3번): …」처럼 번호로 시작하는데, 그 뒤 선택지 순서를 고르게
바꾸는 작업이 있었고 번호표가 따라오지 않았다. 그래서 **해설이 학생에게
틀린 번호를 알려 준다.**

── 무엇을 진실로 보나 ───────────────────────────────────────────────
`answer` 가 가리키는 **선택지 글**이다. 실제로 대조해 보니 해설 본문이
설명하는 내용과 answer 가 가리키는 글이 일치했다(예: 해설이 "면접 비중을
50%로 상향"이라 했고 answer 가 가리키는 보기가 정확히 그 문장이었다).
어긋난 것은 번호표뿐이다.

── 하지 않는 것 ────────────────────────────────────────────────────
해설 본문은 손대지 않는다. 번호표만 고친다. 본문까지 다시 쓰는 것은
사람이 읽고 판단할 일이다.
"""
import json, io, re, sys, os

L = 'ABCDE'
DRY = '--dry' in sys.argv
FILES = ['data/ncs-questions.json',
         'D:/apps/sugar-salt/data/question-banks/ncs-questions.json',
         'D:/apps/sugar-salt/textbooks/_questions_by_area.json']

def ans_idx(a, n):
    parts = a if isinstance(a, (list, tuple)) else str(a or '').replace(',', ' ').split()
    out = []
    for t in parts:
        t = str(t).strip().upper()
        i = L.find(t)
        if i < 0 and t.isdigit(): i = int(t) - 1
        if 0 <= i < n: out.append(i)
    return out

# 「정답(3번)」 「정답 3번」 「정답: 3번」 을 모두 잡되, 앞머리에 있는 것만.
LABEL = re.compile(r'^(\s*정답\s*[:(\s]*)([1-5])(\s*번)')

def run(path):
    d = json.load(io.open(path, encoding='utf-8'))
    if isinstance(d, dict) and 'questions' in d: qs = d['questions']
    elif isinstance(d, list): qs = d
    else: qs = [x for v in d.values() if isinstance(v, list) for x in v]

    fixed = dangling = 0
    for q in qs:
        exp = q.get('explanation')
        if not exp: continue
        ch = q.get('choices') or []
        n = len(ch)
        ai = ans_idx(q.get('answer'), n)
        if not ai: continue

        m = LABEL.match(str(exp))
        if m and int(m.group(2)) - 1 != ai[0]:
            new = LABEL.sub(lambda mm: f'{mm.group(1)}{ai[0]+1}{mm.group(3)}', str(exp), count=1)
            if not DRY:
                q['explanation'] = new
                q['explanationLabelFixed'] = {'from': m.group(2), 'to': str(ai[0]+1)}
            fixed += 1

        # 없어진 보기를 부르는 조각. 「5번은 …」 절을 통째로 덜어낸다.
        #
        # ★ 여기서 한 번 크게 틀렸다. 선택지가 5개인 문항은 지울 번호가
        #   없어 range(6,6) 이 비고, 그러면 문자 클래스가 `[]` 가 되어
        #   **엉뚱한 글자들을 지웠다** — 해설 755건에서 띄어쓰기와 문장부호가
        #   사라졌다. 지울 번호가 없으면 아예 손대지 않는다.
        s = q.get('explanation') if not DRY else exp
        gone = [str(i) for i in range(n + 1, 6)]
        s2 = str(s)
        if gone:
            s2 = re.sub(r',?\s*[' + ''.join(gone) + r']번은[^,.]*[,.]?', '', s2)
        if s2 != str(s):
            dangling += 1
            if not DRY: q['explanation'] = s2.strip()

    if not DRY and (fixed or dangling):
        io.open(path, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    print(f'  {os.path.basename(path)}: 번호표 정정 {fixed} · 사라진 보기 언급 정리 {dangling}')

for p in FILES:
    if os.path.exists(p): run(p)
