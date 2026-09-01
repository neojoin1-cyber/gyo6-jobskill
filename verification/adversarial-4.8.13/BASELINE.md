# 기준선 서명문 — JOB고 스킬캠퍼스 4.8.13 적대적 검증

이 문서가 고정하는 다섯 값이 이번 검증의 유일한 기준선이다.
이후 모든 결함 기록은 이 문서의 `기준선 서명 해시`를 인용해야 유효하다.
값이 하나라도 바뀌면 이 문서를 새로 작성하고, 그 전에 만든 판정은 재시험 없이는 승계하지 않는다.

작성: 클로드 코드(독립 적대적 검증자) · 작성 시각 2026-09-01 22:52 KST

---

## 0. 관문 처리 결과 (BLOCK-BASELINE-01)

| 항목 | 소유자 결정 | 실행 결과 |
|---|---|---|
| 미커밋 변경 `scripts/gate-promotion-promises.mjs` | 출시 후보에 **포함** | 커밋 `2b0edcb` 생성. 워킹트리 정리 완료 |
| 운영 웹 버전 | **4.8.13으로 상향** | `npm run build:web:gyo6` → 홈페이지 미러 교체 → `neojoin1-cyber-homepage@9101af0` push |

Windows에서 재확인한 미커밋 변경은 `scripts/gate-promotion-promises.mjs` 1건뿐이었다(CRLF 착시 없음).
이 변경은 게이트 스크립트이며 런타임 번들에 포함되지 않는다 — AAB·웹 자산 해시에 영향 없음을 아래 3절에서 확인했다.

---

## 1. 다섯 값

| # | 항목 | 값 |
|---|---|---|
| 1 | 소스 커밋 | `2b0edcb` (branch `codex/web-v4.0.0-release`) — 직전 `4824727 feat: restore teacher live learning visibility for 4.8.13` |
| 2 | 웹 `version.json` | `4.8.13` / channel `web-release` / releasedAt `2026-08-31` — https://gyo6.kr/apps/sugar-salt/version.json |
| 3 | 웹 엔트리 자산 SHA-256 | `assets/index-CMR-vnJC.js` = `19876d5fc5b06f3205b3f1055dbeed144c12224480bcb3ca591a683fd986da31` |
| 4 | AAB | versionName `4.8.13` / versionCode `29803019` / sha256 `f64dc8f465fb8c7238163adb6aa386012cd95e2f431a783053e19fb91aa452bf` / 파일 `release/closed/JOBGO-v4.8.13-closed-2026-08-31_13-00-27-425.aab` |
| 5 | Play 표시값 | **미확보 — 코워크가 Play Console 화면에서 수집해 원장에 남긴다** (트랙: 비공개 테스트) |

부속 값(검증 중 인용 가능):

| 항목 | 값 |
|---|---|
| 웹 산출물 규모 | 183개 파일 / 21,530,799 bytes (`gate:gyo6-web` 보고값) |
| 홈페이지 미러 커밋 | `neojoin1-cyber/neojoin1-cyber-homepage@9101af0` (branch `main`, CNAME `gyo6.kr`) |
| 운영 DB | Supabase `eniyjdmtbunvizrsomrp` — 마이그레이션 `20260831090000_autonomous_learning_presence.sql` **적용 확인됨** |
| AAB 릴리스 기록 | `playSubmitted: true` / `playPublished: true` / finalizedAt `2026-09-01T07:56 KST` |

---

## 2. 검증 대상 표면

| 표면 | 주소·경로 | 버전 |
|---|---|---|
| 정식 웹 | https://gyo6.kr/apps/sugar-salt/?entry=member | 4.8.13 |
| 체험 웹 | https://gyo6.kr/learning-app.html#trial-accounts | 4.8.13 (같은 산출물) |
| Android | `com.gyo6.jobskill` 폐쇄 테스트 AAB | 4.8.13 / 29803019 |
| DB·RPC | Supabase `eniyjdmtbunvizrsomrp` | 4.8.13 마이그레이션 적용본 |

---

## 3. 동일성 검증 기록 (직접 계산)

기준선을 고정하기 전에 세 산출물이 같은 소스에서 나왔는지 해시로 대조했다.

| 대조 | 결과 |
|---|---|
| AAB 내부 `base/assets/public/assets/index-Dg6Ye1qm.js` ↔ 로컬 `dist/assets/index-Dg6Ye1qm.js` | 동일 — `1a685dfe26303a3a1350e32e73dbec48d6dc5c7cf7973eea3de44280fc60e2d2` |
| AAB 내부 `base/assets/public/version.json` | `4.8.13` |
| 배포 전 운영 웹 ↔ 홈페이지 미러 ↔ `release/web/gyo6-site` (4.8.11) | 3중 동일 — `7238eb8e19e24c39e0b581e10ea6a740149467bca639cd4675e27d0f65bc62a5` |

즉 관문 처리 전 상태는 **소스·Android = 4.8.13 / DB = 4.8.13 / 웹 = 4.8.11** 의 혼재였고,
관문 처리로 웹을 4.8.13으로 올려 네 표면을 일치시켰다.

---

## 4. 이 기준선의 한계 (명시)

1. Play 표시값(5번)은 아직 비어 있다. 코워크가 채우기 전까지, Play 화면 표기에 의존하는 판정은 유보한다.
2. 홍보물 8종 중 4.8.13 판은 2종(`직접제안형 3단리플릿`, `학생편·교사편 인쇄편집판`)뿐이고
   나머지 6종은 4.8.11 판이다. 홍보 약속 역검증(LEGAL)은 이 판본 차이를 함께 기록한다.
3. 운영 DB는 검증 시작 시점에 이미 4.8.13 마이그레이션이 적용되어 있었다. 즉 "웹 4.8.11 + DB 4.8.13"
   조합이 실제로 운영에 존재했다. 그 조합에서 발생했을 수 있는 사고는 이 검증 범위 밖이며,
   필요하면 별도 조사 대상이다.
4. 이 문서의 수치는 전부 현재 트리에서 다시 계산한 값이다. 기존 보고서의 수치는 인용하지 않았다.

---

## 5. 기준선 서명 해시

아래 값은 1절 다섯 값(및 부속 값)을 문자열로 이어 SHA-256 한 것이다.
결함 기록의 `기준선` 항목에는 이 해시의 앞 12자리를 적는다.

```
BASELINE-INPUT =
  commit=2b0edcb
  web.version=4.8.13
  web.entry=assets/index-CMR-vnJC.js
  web.entry.sha256=19876d5fc5b06f3205b3f1055dbeed144c12224480bcb3ca591a683fd986da31
  aab.versionName=4.8.13
  aab.versionCode=29803019
  aab.sha256=f64dc8f465fb8c7238163adb6aa386012cd95e2f431a783053e19fb91aa452bf
  play.display=UNRESOLVED
```

기준선 서명 해시: `ee6aee89abf8a49e743ec298c591bb8c671582f8fefbca50c70af92c983b4eea`
(짧은 형태 `ee6aee89abf8` — 결함 기록에는 이 12자리를 적는다.)

계산 방법: 위 8줄을 `key=value` 형태로 정리해 개행 문자(LF)로 이어 붙인 UTF-8 문자열의 SHA-256.
같은 8줄이면 누구든 같은 값을 얻는다.

---

## 6. 서명

| 역할 | 담당 | 확인 |
|---|---|---|
| 독립 적대적 검증자 | 클로드 코드 | 위 다섯 값을 직접 실행·계산으로 확인함 |
| 문항 독립 채점·판정서 | 코워크 | Play 표시값 수집 후 5번 칸을 채운다 |
| 소유자 | 사람 | 웹 4.8.13 상향과 미커밋 변경 포함을 승인함 (2026-09-01) |
