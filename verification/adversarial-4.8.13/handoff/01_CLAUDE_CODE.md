# 클로드 코드 착수 지시서 — JOB고 4.8.13 적대적 검증

> 클로드 코드에서 이 파일을 지정해 시작하십시오.
> `verification/adversarial-4.8.13/handoff/01_CLAUDE_CODE.md 를 읽고 지시대로 시작해.`

너는 JOB고 스킬캠퍼스 4.8.13의 독립 적대적 검증자다. 개발자가 아니라 검증자로 행동하라.
목표는 PASS를 모으는 것이 아니라, 학교 현장에서 학생·교사·관리자의 신뢰를 무너뜨릴 실패를
출시 전에 찾아내는 것이다.

## 0. 착수 전 차단 관문 (BLOCK-BASELINE-01)

지금 소스·Android는 4.8.13이지만 운영 웹과 홈페이지 미러는 4.8.11이다. 이 상태에서 만든
어떤 PASS도 출시 승인 근거가 되지 못한다. 아래를 끝내기 전에는 검증을 시작하지 마라.

1. 미커밋 변경의 운명을 확정한다.
   - 현재 워킹트리의 실제 내용 변경은 `scripts/gate-promotion-promises.mjs` 1건이다.
     (리눅스 쪽에서 보면 CRLF 때문에 124개가 더 보이지만 내용은 동일하다. Windows에서 재확인하라.)
   - 출시 후보에 포함할지 제외할지 소유자에게 물어 확정하고, 그 결과로 새 커밋을 만든다.
2. 운영 웹을 4.8.13으로 올릴지, 검증 대상을 4.8.11로 내릴지 소유자에게 확인한다.
   - 올린다면 `npm run build:web:gyo6` 후 `D:\apps\neojoin1-cyber-homepage\apps\sugar-salt` 미러까지 맞춘다.
   - 내린다면 홍보물 4.8.13이 주장하는 기능 중 4.8.11에 없는 것을 목록화하고,
     그 목록 자체를 LEGAL 결함으로 원장에 등록한다.
3. 다섯 값을 한 표에 고정한다: 소스 커밋 / 웹 `version.json` / 웹 엔트리 자산 SHA-256 /
   AAB versionCode·versionName / Play 표시값. 뒤의 두 개는 코워크가 화면에서 수집해 원장에 남긴다.
4. `verification/adversarial-4.8.13/BASELINE.md`에 서명문을 쓰고 커밋한다.
   이후 모든 결함은 이 문서의 해시를 인용해야 유효하다.

## 1. 행동 원칙

1. 기존 PASS·기존 보고서·개발자 설명을 근거로 쓰지 마라. 같은 조건에서 직접 실행해 재현하라.
2. 정상 경로보다 실패 경로, 빈 상태, 느린 네트워크, 중복 입력, 역할 전환, 강제 종료를 먼저 공격하라.
3. 한 번의 성공보다 반복 한 건을 우선한다. n회 중 m회로 재현률을 기록하라.
4. 기존 보고서의 5,765문항·172단원·981학습카드·2,214페이지·120기관·1,200조합 같은 수치를
   인용하지 마라. 현재 트리에서 다시 계산하라. 숫자를 인용하는 것은 검증이 아니다.
5. 화면 문구·홍보물·코드·DB·실제 배포본이 다르면 가장 보수적인 해석을 적용하라.
6. 수정 권고보다 재현 절차와 영향 범위를 먼저 확정하라.
7. 검증 데이터만 사용하고 실제 학생 개인정보를 열람·복제하지 마라.

## 2. 담당 범위 — 292건 전부

의뢰서 4절의 최소 시나리오 전량을 네가 실행한다.

BL 12 · AUTH 18 · TRIAL 16 · STU 36 · CNT 45 · TCH 30 · SYNC 22 · PWA 14 ·
AND 18 · SEC 24 · PERF 15 · A11Y 18 · LEGAL 12 · OPS 12 = 292건
여기에 데이터 전수검사 전량이 추가된다(위 숫자에 포함되지 않음).

**단 하나 예외**: CNT 45건 중 정답의 옳고 그름 판정은 네가 하지 않는다.
너는 앱의 정답을 알고 있으므로 독립 판정자가 될 수 없다. 아래 3번 절차대로
정답을 가린 문항 세트를 내보내면, 코워크가 앱 값을 모르는 상태에서 독립 정답을
산출해 돌려준다. 너는 그 결과를 앱 값과 대조해 불일치를 P1로 등록한다.
CNT의 나머지(해설 번호 일치, 출제 포인트 정합, 중복 문항, 정답 위치 분포,
줄바꿈 포매터 등 기계 감사)는 전부 네 몫이다.

사람은 검증을 하지 않는다. 사람이 하는 일은 이 세 가지뿐이다:
Play 비공개 테스터 12명 확보 / 소유자 승인 서명 4종 / 시험 계정 자격정보 전달.

## 3. 최우선 작업 — 코워크 인계 파일 생성

다른 무엇보다 먼저 이것을 만들어라. 코워크가 이 파일을 기다리고 있다.

`verification/adversarial-4.8.13/handoff/CNT_blind_questions.json`

- 원천: `data/*.json`, `src/lib/jobCommonAreas.js`, `src/lib/ncsBanks.js`,
  `src/lib/interview*.js`, `src/lib/cover*.js`, `data/manual-answer-overrides.json`
- 각 항목에서 `answer`와 `explanation`을 **제거**하고 `questionId`·과목·단원·지문·보기만 남긴다.
- 5절 층화 기준을 만족해야 한다:
  교육부 직업공통능력 5개 영역 각 30문항 + 고위험 전수 /
  NCS 26v1 하위능력별 10문항 이상 / 채용필기 지원처 유형별 30문항 /
  식음료서비스 단원별 10문항 / 자기소개서 30유형 전부 / 면접 기초 168 + 심화 표본
- 앱 정답은 별도로 `CNT_app_answers.json`에 보관하되 코워크에게 주지 마라.

**완료 신호**: 이 파일을 다 만들면, 사용자에게 화면에 이렇게 한 줄로 알려라.

    [코워크 인계] CNT_blind_questions.json 생성 완료 (문항 N건). 코워크에 "문항 채점 해줘"라고 요청하십시오.

같은 규칙을 다른 인계 시점에도 적용한다.
- `LEDGER.md`에 P0 또는 P1을 처음 등록했을 때 → `[코워크 확인] P1 등록 N건. 원장 검토를 요청하십시오.`
- 292건 실행과 재시험을 모두 마쳤을 때 → `[코워크 인계] 검증 완료. 판정서 작성을 요청하십시오.`

이 신호는 사용자가 두 검증자 사이를 중계하는 유일한 수단이므로 생략하지 마라.

## 4. Android 자동화 — 사람 대신 네가 한다 (AND 18건)

에뮬레이터 또는 USB 연결 실기기에 대해 adb로 수행한다. 각 항목은 3회 반복해 재현률을 남긴다.

    # 설치 (폐쇄 테스트 산출물 그대로)
    bundletool build-apks --bundle=release\closed\JOBGO-v4.8.13-closed-*.aab ^
      --output=jobgo.apks --local-testing
    bundletool install-apks --apks=jobgo.apks

    # 노치·컷아웃 충돌
    adb shell cmd overlay enable com.android.internal.display.cutout.emulation.corner
    adb shell cmd overlay enable com.android.internal.display.cutout.emulation.tall
    adb shell cmd overlay enable com.android.internal.display.cutout.emulation.waterfall

    # 제스처 내비 vs 3버튼
    adb shell cmd overlay enable com.android.internal.systemui.navbar.gestural
    adb shell cmd overlay enable com.android.internal.systemui.navbar.threebutton

    # 세로↔가로, 폰트 크게, 디스플레이 크게
    adb shell settings put system accelerometer_rotation 0
    adb shell settings put system user_rotation 1
    adb shell settings put system font_scale 1.30
    adb shell wm density 480

    # 뒤로가기 중복 / 강제 종료 / 재부팅
    adb shell input keyevent KEYCODE_BACK
    adb shell am force-stop com.gyo6.jobskill
    adb reboot

    # 저장 대기 중 네트워크 단절 후 복구
    adb shell svc wifi disable && adb shell svc data disable
    adb shell svc wifi enable

    # 알림 권한 거부/허용/철회
    adb shell pm revoke com.gyo6.jobskill android.permission.POST_NOTIFICATIONS
    adb shell pm grant  com.gyo6.jobskill android.permission.POST_NOTIFICATIONS

    # 증거 수집
    adb exec-out screencap -p > evidence\and-001.png
    adb shell uiautomator dump && adb pull /sdcard/window_dump.xml
    adb shell dumpsys window displays        # 시스템바 인셋 좌표
    adb shell dumpsys gfxinfo com.gyo6.jobskill framestats
    adb shell dumpsys meminfo com.gyo6.jobskill

**safe area 겹침 판정**: `uiautomator dump`의 요소 좌표와 `dumpsys window displays`의
인셋을 비교해 하단탭·헤더가 시스템 영역과 겹치는지 수치로 판정하라. 눈으로 보지 말고 좌표로 판정하라.

**업데이트 데이터 보존**: 내부테스트 설치본을 먼저 깔고 그 위에 4.8.13을 설치한 뒤,
학습 위치·작성본·기기상태가 보존되는지 확인한다.

반복 흐름은 Maestro YAML로 스크립트화해 3회 실행을 자동화하는 것을 권장한다.

## 5. 저사양 체감을 지표로 대체 (PERF 15건)

"느리다"는 체감을 판정 기준으로 쓰지 말고 아래 지표로 고정하라.

- Playwright + CDP `Emulation.setCPUThrottlingRate {rate: 6}` (저사양 PC 근사)
- `Network.emulateNetworkConditions` 3G 수준 지연·패킷 손실
- 판정 기준: 첫 상호작용 응답, long task(>50ms) 개수, INP, 프레임 드랍률,
  교사 1명 + 학생 30명 조건에서 수업 시작·위치 전송·따라가기·상태 갱신의 지연 분포
- Android 쪽은 `dumpsys gfxinfo ... framestats`의 jank 비율과 `dumpsys battery` 온도 상승
- 부하는 `scripts/loadtest/run.mjs`, `scripts/loadtest/presence-bench.mjs` 활용.
  단, 서비스 가용성을 떨어뜨리는 무제한 동시접속은 금지다. 30명 조건을 넘지 마라.

## 6. 스크린리더를 트리로 대체 (A11Y 18건 중 판정 기준)

- 웹: Playwright `page.accessibility.snapshot()` 덤프 + axe-core 자동 검사.
  랜드마크·제목·버튼명·상태변경·오류가 접근성 트리에 실제로 존재하는지 검사한다.
  `aria-live` 영역의 변경을 MutationObserver로 캡처해 "읽힐 내용"을 텍스트로 남긴다.
- Android: TalkBack을 켜고 이벤트를 덤프한다.

    adb shell settings put secure enabled_accessibility_services \
      com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService
    adb shell settings put secure accessibility_enabled 1
    adb shell dumpsys accessibility

- 대비비는 계산으로 판정한다(WCAG AA). 색만으로 정답/오답/상태를 구분하는 곳을 찾아라.
- 실제 음성 청취는 하지 않는다. 트리에 정보가 없으면 결함이고, 있으면 통과로 본다.
  이 대체의 한계는 판정서에 명시하라.

## 6-2. 화면 시나리오 자동화 (STU·TCH·AUTH·PWA·SYNC·LEGAL 등 154건)

이전에는 사람이나 다른 검증자가 브라우저로 훑던 몫이다. 네가 Playwright로 수행한다.

- 대상: https://gyo6.kr/apps/sugar-salt/?entry=member (정식),
  https://gyo6.kr/learning-app.html#trial-accounts (체험)
- 변형축을 조합으로 소진한다.
  화면 320x568 / 360x800 / 390x844 / 768x1024 / 1280x720 / 1920x1080
  배율 100% / 125% / 150% / 200% + 앱 내 큰글자 최댓값
  망 정상 / 3G 지연 / 패킷 손실 / 순간 단절 / Realtime만 단절 / 완전 오프라인
  상태 신규 / 학습 중 / 완료 / 오답 다수 / 메시지 읽음 / 저장 대기 / 계정 전환
  입력 연속 탭 / 뒤로가기 / 새로고침 / 화면회전 / 강제종료 / 중복 제출 / 느린 응답

핵심 과제 4개:

1. **학생 여정 12단계**를 신규 계정 하나로 연속 수행.
   가입 -> 홈 -> 6개 학습관 -> 학습 -> 오답 -> 지원처 조사 -> 자기소개서 -> 면접 ->
   포트폴리오 -> 교사 왕복 -> 메시지 -> 재접속.
   각 단계에서 "정답 번호만 외워도 다음 단계로 갈 수 있는가"를 묻는다.
2. **교사·학생 두 컨텍스트 동시 조작**. 교사가 문항을 이동할 때 학생 화면이
   최신 questionId로 따라가는지, 연결 상태 라벨(접속·벗어남·확인 필요·미접속)이
   실제 네트워크·화면이탈 조건과 일치하는지.
3. **홍보 약속 11개 역검증**. 6개 학습관, 120개 지원기관, 맞춤형 취업지도,
   자기소개서 자율학습, 면접 자율학습, 3개 학년 포트폴리오, 교사 수업,
   자율학습 관리, 메시지·상담, 공용 PC. 화면에서 증명하지 못한 약속은 LEGAL 결함이다.
   근거: output/promotion/ 의 홍보물 PDF 3종.
4. **저장소 잔존 확인**. 체험 종료 후 localStorage·sessionStorage·IndexedDB·cache를
   덤프해 개인 작성물과 인증 흔적이 남는지(SEC-06), 오류 화면·네트워크 응답·콘솔에
   PII/SQL/키가 노출되는지(SEC-09), 공용 PC 계정 전환 후 이전 사용자 캐시에
   앱 경로로 접근되는지(SEC-10).

화면에서 증상을 찾으면 원인 규명까지 이어서 하되, 결함 기록에는 관측 사실과
원인 가설을 반드시 분리해 적어라.

## 7. 실행할 로컬 게이트

    npm test
    npm run prebuild
    npm run verify:explanation-consistency
    npm run gate:questions
    npm run verify:teacher-release
    npm run verify:learning-render
    npm run gate:promotion-promises
    npm run gate:shared-device
    npm run gate:trial-isolation
    npm run gate:release-security
    npm run gate:account-deletion
    npm run gate:boot-recovery
    npm run gate:notification-consent
    npm run gate:pwa-entry

게이트가 통과해도 그것을 근거로 쓰지 마라. 게이트가 검사하지 않는 경로를 찾는 것이 네 일이다.

## 8. 절대 금지

- `npm run release:verify`, `npm run closed:test`, `npm run release:migrations -- --apply`를
  소유자 승인 없이 실행
- 운영 DB에 임의 DELETE/UPDATE, 마이그레이션 적용, 계정 생성·삭제
- 실제 학생·교사의 문서·메시지·진단 결과 열람 또는 로컬 다운로드
- 서비스 가용성을 떨어뜨리는 무제한 동시접속·DoS·자동 비밀번호 대입
- 취약점이나 체험 자격정보를 대화 밖 공개 채널에 게시
- 보고서에 이메일·UUID·학생 이름 노출 (반드시 마스킹)

## 9. 정량 경계 공격값

기기상태 399KB / 401KB · 클라이언트 묶음 1.19MB / 1.21MB · 서버 묶음 1.49MB / 1.51MB ·
묶음 항목 249 / 251 · 사용자확인 23:59 / 24:01 · 오프라인 71:59 / 72:01

## 10. SEC 24건 전량

SEC-01 번들·소스맵·로그에서 체험 비밀번호/토큰/키 검색 → 비밀값 0건
SEC-02 학생A 토큰으로 학생B 자소서·오답·기기상태 직접 조회 → 401/403 또는 0행
SEC-03 비담임 교사로 타 학급 첨삭·진도·메시지 RPC → 접근 거부
SEC-04 학교관리자A로 학교B 데이터 조회·수정 → 접근 거부
SEC-05 체험 학생·교사로 전 테이블 INSERT/UPDATE/DELETE → DB에서 42501
SEC-07 신규 테이블에 체험 쓰기차단 누락 여부 → 마이그레이션 이후에도 자동 보호
SEC-08 계정 삭제 후 Auth·프로필·작성본·알림토큰·기기상태 → 보유정책에 따라 완전 제거
SEC-06 체험 종료 후 local/session/IndexedDB/cache 덤프 → 개인 작성·인증 잔존 없음
SEC-09 오류 화면·네트워크 응답·콘솔의 PII/SQL/키 노출 → 민감정보 0건
SEC-10 공용 PC에서 계정 전환 후 이전 사용자 캐시 접근 → 앱 경로로 접근 불가

## 11. 증거 규격 — 모든 결함에 필수

고유 ID, 심각도 P0~P3, 기준선(커밋·웹 엔트리·AAB build·Play 트랙), 환경(기기·OS·브라우저/WebView·
화면크기·배율·네트워크), 사전조건, 최소 재현 단계, 기대 결과와 실제 결과를 같은 문장 구조로,
재현률 n회 중 m회, 증거(스크린샷/영상/콘솔/네트워크/HAR/DB·RPC 응답/questionId),
영향(오학습·수업중단·데이터손실·권한침해·구매신뢰), 원인 가설(확정과 추정을 분리),
개인정보·토큰이 제거된 원본 로그, 수정 커밋과 동일 절차 재시험 결과.

## 12. 산출

- 결함은 `verification/adversarial-4.8.13/LEDGER.md`에 **추가만** 한다.
  코워크가 문항 감사 결과를 같은 파일에 기록하므로, 수정 전에 반드시 다시 읽고 병합하라.
  남의 행을 지우지 마라.
- **최종 판정서는 네가 쓰지 않는다.** 코워크가 원장 전체를 읽고 작성한다.
  너는 원장과 증거를 완결된 상태로 남기는 것까지가 범위다.
- 증거 파일은 `verification/adversarial-4.8.13/evidence/`에 결함 ID로 저장한다.

## 13. 판정 기준

P0 대규모 개인정보/권한 침해, 서비스 불능, 데이터 파괴 → 즉시 중단·NO-GO
P1 오답 학습, 작성본 유실, 역할 간 노출, 로그인/수업 핵심 흐름 불능, 릴리스 불일치 → 출시 차단
P2 주요 기능 혼란, 반복 실패, 현장 수업 가독성·성능 문제 → 수정 또는 명시적 위험 승인
P3 국소 표현·시각적 완성도·낮은 빈도 불편 → 출시 후 일정 가능

**정답이 맞아도 해설의 번호·비교 문장·출제 포인트가 다른 선택지를 가리키면 P1이다.**
학생이 오답을 학습하게 만드는 오류는 화면 깨짐보다 심각하게 취급하라.

---

먼저 0단계 차단 관문의 현재 상태만 조사해 보고하고, 담당 범위를 어떻게 쪼갤지 계획을 제시하라.
내 승인 전에는 실행하지 마라.
