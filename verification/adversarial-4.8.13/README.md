# 4.8.13 출시 전 적대적 검증 — 협업 규약

## 누가 무엇을 하나

| 담당 | 하는 일 |
|---|---|
| 클로드 코드 | 시나리오 292건 전량 실행, 원인 규명, 수정, 재시험 |
| 코워크 | 문항 독립 채점, 최종 판정서 |
| 사람 | Play 테스터 12명 확보 / 승인 서명 4종 / 시험 계정 자격정보 전달 |

## 시작하는 법

클로드 코드에 이 한 줄:

    verification/adversarial-4.8.13/handoff/01_CLAUDE_CODE.md 를 읽고 지시대로 시작해.

## 파일

| 파일 | 쓰는 쪽 | 읽는 쪽 |
|---|---|---|
| `00_SPLIT.md` | 고정 | 양쪽 |
| `handoff/01_CLAUDE_CODE.md` | 고정 | 클로드 코드 |
| `handoff/02_COWORK.md` | 고정 | 코워크 |
| `handoff/CNT_blind_questions.json` | 클로드 코드 생성 | 코워크 소비 |
| `handoff/CNT_independent_answers.json` | 코워크 생성 | 클로드 코드 대조 |
| `LEDGER.md` | 양쪽 추가만 | 양쪽 |
| `VERDICT.md` | 코워크 | 소유자 |
| `evidence/` | 클로드 코드 | 양쪽 |

## 원장 규칙

1. `LEDGER.md`를 수정하기 전에 반드시 다시 읽는다.
2. 추가만 한다. 다른 담당의 행을 수정·삭제하지 않는다.
3. 관측 사실과 원인 가설을 분리해 적는다.
4. 재시험은 발견한 쪽이 같은 절차로 수행한다.

## 알려진 함정

이 저장소를 리눅스 쪽에서 보면 CRLF 때문에 124개 파일이 수정된 것처럼 보인다.
실제 미커밋 변경은 `scripts/gate-promotion-promises.mjs` 1건뿐이다.
워킹트리 판정은 반드시 Windows의 클로드 코드가 한다.
