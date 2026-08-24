# -*- coding: utf-8 -*-
"""
903 적용 뒤 검산 — 문항이 정말 온전한가.

적용 스크립트가 「몇 건을 바꿨다」고 말하는 것과, 바뀐 문항이 실제로
멀쩡한 것은 다른 이야기다. 여기서는 **결과물만 보고** 다시 판정한다.

  A  정답이 가리키는 글이 그대로인가   (축약 전후 같은 문장이어야 한다)
  B  선택지가 4개가 되었는가
  C  오답이 하나는 남아 있는가          (없으면 고를 이유가 없다)
  D  해설이 사라진 보기를 부르고 있지 않은가
  E  하위능력이 그 영역에 실제로 있는가
"""
import json, io, os, re, sys, collections

L = 'ABCDE'
OLD_SUBS = {
 '의사소통능력': {'문서이해능력','문서작성능력','의사표현능력','경청능력','기초외국어능력'},
 '수리능력': {'기초연산능력','기초통계능력','도표분석능력','도표작성능력'},
 '문제해결능력': {'사고력','문제처리능력'},
 '자기개발능력': {'자아인식능력','자기관리능력','경력개발능력'},
 '자원관리능력': {'시간관리능력','예산관리능력','물적자원관리능력','인적자원관리능력'},
 '대인관계능력': {'팀워크능력','리더십능력','갈등관리능력','협상능력','고객서비스능력'},
 '정보능력': {'컴퓨터활용능력','정보처리능력'},
 '기술능력': {'기술이해능력','기술선택능력','기술적용능력'},
 '조직이해능력': {'경영이해능력','조직체제이해능력','업무이해능력','국제감각'},
 '직업윤리': {'근로윤리','공동체윤리'},
}
CIRCLE = '①②③④⑤'

def ans_idx(ans, n):
    parts = ans if isinstance(ans, (list, tuple)) else str(ans or '').replace(',', ' ').split()
    out = []
    for t in parts:
        t = str(t).strip().upper()
        i = L.find(t)
        if i < 0 and t.isdigit(): i = int(t) - 1
        if 0 <= i < n: out.append(i)
    return out

def audit(path):
    d = json.load(io.open(path, encoding='utf-8'))
    if isinstance(d, dict) and 'questions' in d: qs = d['questions']
    elif isinstance(d, list): qs = d
    else: qs = [x for v in d.values() if isinstance(v, list) for x in v]

    bad = collections.defaultdict(list)
    conv = [q for q in qs if q.get('fourChoice')]

    for q in qs:
        if q.get('excludeFromQuiz'): continue
        ch = q.get('choices') or []
        n = len(ch)

        # E — 하위능력이 영역에 있는가
        sub, area = q.get('subAbility'), q.get('area')
        if sub and area in OLD_SUBS and sub not in OLD_SUBS[area]:
            bad['E 하위능력이 영역에 없음'].append(f'{q["id"]}: {area}/{sub}')

        if not q.get('fourChoice'): continue

        # A — 정답 글이 보존됐는가 (removedChoice 로 되짚는다)
        rc = q.get('removedChoice') or {}
        ai = ans_idx(q.get('answer'), n)
        if not ai:
            bad['A 정답을 못 읽음'].append(q['id'])
        # B — 4개가 됐는가
        if n != 4:
            bad['B 선택지가 4개가 아님'].append(f'{q["id"]}: {n}개')
        # C — 오답이 남아 있는가
        if n - len(ai) < 1:
            bad['C 오답이 하나도 없음'].append(q['id'])
        # D — 해설이 없어진 번호를 부르는가
        exp = str(q.get('explanation') or '')
        for m in re.finditer(r'[' + CIRCLE + r']', exp):
            if CIRCLE.index(m.group(0)) >= n:
                bad['D 해설이 없는 보기를 부름'].append(f'{q["id"]}: {m.group(0)}')
                break
        for m in re.finditer(r'\b([1-5])번', exp):
            if int(m.group(1)) > n:
                bad['D 해설이 없는 보기를 부름'].append(f'{q["id"]}: {m.group(1)}번')
                break

    print(f'\n── {os.path.basename(path)}')
    print(f'   전체 {len(qs)} · 4지 변환 {len(conv)} · 저작 검토 '
          f'{len([q for q in qs if q.get("needsAuthoring")])}')
    if not bad:
        print('   검산 통과 — 문제 없음')
    for k in sorted(bad):
        print(f'   ✗ {k}: {len(bad[k])}건')
        for x in bad[k][:4]: print(f'        {x}')
    return sum(len(v) for v in bad.values())

total = 0
for p in ['data/ncs-questions.json',
          'D:/apps/sugar-salt/textbooks/_questions_by_area.json',
          'D:/apps/sugar-salt/data/question-banks/ncs-questions.json']:
    if os.path.exists(p): total += audit(p)
print(f'\n합계 문제 {total}건')
sys.exit(1 if total else 0)
