# -*- coding: utf-8 -*-
"""
903 4단계 — 구 체계(NCS-2003)를 신 체계(NCS-2025)로 옮긴다.

── 원본을 지우지 않는다 ─────────────────────────────────────────────
명세 §9-① 이 분명히 적어 두었다. 신 체계에 자리가 없는 490건이 있지만
**현재 공기업 채용 필기는 아직 구 10영역 기준**이다. 지금 가장 잘 팔릴
문항들을 버릴 이유가 없다.

그래서 원본은 `NCS-2003` 으로 그대로 두고, **신 체계 판본을 따로 만든다.**
같은 문항이 두 상품에 각각 들어간다.

── 기계적으로 옮기지 않는다 ─────────────────────────────────────────
명세 §9-② — 이관표에서 같은 줄에 있어도 내용이 다른 것이 있다.

  정보처리능력 → AI활용능력       정보 검색 문항이 AI 활용 문항이 되지 않는다
  기술이해능력 → 디지털책임의식   기술 원리와 윤리·책임은 다르다
  자아인식/자기관리 → 적응학습능력 자기이해와 변화대응 학습은 다르다

이 셋은 `needsRewrite: true` 를 달아 **배포 세트에서 뺀다.** 게이트 9번이
막는다. 사람이 다시 쓰기 전까지는 나가지 않는다.
"""
import json, io, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_PATH = 'D:/apps/sugar-salt/docs/specs/903-refs/_이관표_구신.json'
SRC = os.path.join(ROOT, 'data', 'ncs-questions.json')
OUT = os.path.join(ROOT, 'data', 'ncs-2025-questions.json')
DRY = '--dry' in sys.argv

table = json.load(io.open(MAP_PATH, encoding='utf-8'))['map']
qs = json.load(io.open(SRC, encoding='utf-8'))

rep = collections.Counter()
new_bank = []
retired = []

for q in qs:
    sub = q.get('subAbility')
    area = q.get('area')
    if not sub:
        rep['하위능력없음_건너뜀'] += 1
        continue

    m = table.get(f'{area}|{sub}')
    if not m:
        rep['이관표에없음'] += 1
        continue

    verdict = m.get('verdict')
    if m.get('area') is None:            # 소멸 — 신 체계에 자리가 없다
        retired.append(q.get('id'))
        rep['소멸(구 체계 전용으로 남김)'] += 1
        continue

    n = dict(q)
    n['system'] = 'NCS-2025'
    n['area'] = m['area']
    n['subAbility'] = m['sub']
    n['migratedFrom'] = {'system': 'NCS-2003', 'area': area, 'sub': sub}
    n['migrationVerdict'] = verdict
    # 「신설능력(기존 내용 일부 반영)」 — 자리는 있으나 내용이 다르다.
    if verdict == '요재작성':
        n['needsRewrite'] = True
        n['excludeFromQuiz'] = True      # 다시 쓰기 전까지는 내보내지 않는다
        rep['요재작성(배포 제외)'] += 1
    rep[f'이관:{verdict}'] += 1
    new_bank.append(n)

if not DRY:
    io.open(OUT, 'w', encoding='utf-8').write(json.dumps({
        'note': 'NCS 직업기초능력 2025.12 판본. 원본(NCS-2003)은 ncs-questions.json 에 그대로 있다.',
        'builtFrom': 'data/ncs-questions.json',
        'questions': new_bank,
    }, ensure_ascii=False, indent=2) + '\n')

print(('[미리보기] ' if DRY else '') + f'신 체계 판본 {len(new_bank)}건')
for k in sorted(rep): print(f'  {k}: {rep[k]}')

# 21칸 커버리지
NEW = {
 '의사소통능력': ['문서소통능력','구두소통능력','외국어소통능력'],
 '수리능력': ['연산능력','통계활용능력','도표활용능력'],
 '문제해결능력': ['문제분석능력','대안발굴능력','의사결정능력'],
 '자기관리능력': ['시간관리능력','적응학습능력','경력개발능력'],
 '대인관계능력': ['협업능력','리더십','갈등관리능력'],
 '디지털능력': ['디지털활용능력','인공지능(AI)활용능력','디지털책임의식'],
 '직업윤리': ['근로윤리','직장공동체의식','산업안전보건의식'],
}
live = [q for q in new_bank if not q.get('excludeFromQuiz')]
have = collections.Counter(q['subAbility'] for q in live)
empty = []
print('\n21칸 분포 (배포 가능한 것만)')
for a, subs in NEW.items():
    row = ' · '.join(f'{s} {have.get(s,0)}' for s in subs)
    print(f'  {a}: {row}')
    empty += [f'{a}/{s}' for s in subs if not have.get(s)]
print(f'\n빈 칸 {len(empty)}개' + (': ' + ', '.join(empty) if empty else ''))
