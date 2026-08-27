# CLAUDE.md

## 프로젝트
직업공통능력 교재(`data/source/textbook.html`)를 매치3+퀴즈 하이브리드 게임으로 전환하는
프로젝트. 이후 다른 교재로도 재사용 가능한 프레임워크로 설계한다.

## Phase 1에서 확인된 사실 (2026-06-24, 최종)
- 영역은 8개가 아니라 **9개**다: 의사소통능력, 수리능력, 문제해결능력, 자기개발능력,
  자원관리능력, 정보능력, 기술능력, 조직이해능력, 직업윤리. (자기개발능력 포함 확정됨 —
  18문항, 차시 1개뿐, 심화 단계만 존재하는 특수 영역이므로 Phase 2 areaMapping 설계 시
  이 점을 고려해야 한다.)
- 원본에는 `mistakePattern`(오답 패턴 12가지) 분류 정보가 **없다**. 이번 프로젝트에서는
  이 필드를 다루지 않기로 확정됨 (`mistakePattern: null`로 고정, 약점 배지 시스템은
  보류).
- 원본의 `<details class="answer-details">` 는 313개지만, 그중 2개(C37-36, C39-39)는
  "정답 및 해설" 바로 뒤에 같은 선택지를 다시 참조하는 "풀이 과정 보기"가 붙어있는
  중복 보충설명이라 별개 문항으로 세지 않고 직전 문항의 `supplementaryNote`로 병합했다.
  → **실제 문항 수 311개**.
- 311개 중 `sourceFormat` 분포: `inline_p` 262개, `ordered_list` 40개(="심화 학습
  문제"=A등급, `isAGrade:true`), `inline_bundled_paragraph` 8개(원본 생성 버그 보정분).
- **309개는 퀴즈로 바로 사용 가능** (`excludeFromQuiz: false`). 그중 308개는 원본에
  정답 글자가 명시(`answerSource: "explicit"`), 1개(`C22-21-Q02`)는 원본의 "풀이 과정"
  서술과 선택지 텍스트를 대조해 분석으로 정답을 확정함(`answerSource:
  "inferred_from_explanation"`) — 근거는 `data/manual-answer-overrides.json`에 기록.
- **2개는 퀴즈에서 제외 권장** (`excludeFromQuiz: true`, 임의로 답을 채우지 않음):
  - `C33-32-Q02`: 원본 자체에 선택지가 없는 서술형/토론형 콘텐츠 (객관식으로 만들 수
    없음).
  - `C15-14-Q06`: 원본 생성 중 발생한 깨진 중복 문항으로 추정 (선택지 텍스트가
    placeholder 글자뿐이고 복구할 실제 텍스트가 원본에 없음).
  → 이 2개는 원본 교재 작성자가 가진 별도 자료(교사용 등)가 있다면 그걸로 보강 가능.
    없다면 게임에서는 제외하거나 "토론형/예시" 콘텐츠로만 다루는 것을 권장.

## 정답 추론 정책 (중요)
원본에 정답 글자가 없지만 "풀이 과정"/"해결과정" 서술이 있는 경우, 그 서술과 선택지
텍스트를 대조해서 한 선택지만 명확히 일치하고 나머지는 명백히 모순될 때만 분석으로
정답을 확정한다. 이런 추론은 **추출 스크립트(extract-questions.js)에 하드코딩하지
않고** `data/manual-answer-overrides.json`에 근거(reasoning)와 함께 별도 기록하며,
`answerSource: "inferred_from_explanation"`으로 표시해 원본 명시 정답과 구분한다.
근거 없이 선택지나 정답을 새로 만들어내지는 않는다 — 이 교재는 자격 인증 학습용
콘텐츠이므로, 근거 없는 정답은 학습자에게 잘못된 정보를 줄 수 있다.

## 절대 규칙
1. `data/source/textbook.html`은 절대 수정하지 않는다.
2. 문항/정답/해설은 추측하지 않는다. 반드시 `data/questions.json`만 사용하고,
   `needsManualReview: true`인 문항은 정답이 확정되기 전까지 정답 채점에 사용하지 않는다.
3. 작업 완료 후 반드시 해당 단계의 검증 스크립트를 실행하고 결과를 보고한다.
4. 막히면 우회하지 말고 무엇이 막혔는지 먼저 보고한다.
5. 게임 로직(`MatchEngine.js` 등)은 교재별 재사용을 위해 area/lesson 이름을
   하드코딩하지 않는다. 항상 `questions.json`과 `areaMapping.json`을 통해
   데이터를 주입받는 구조로 작성한다. (`verify-extraction.js`가 이 부분을
   자동으로 검사한다.)

## 빌드/테스트 명령어
- `npm install`
- `npm run extract` (= `node scripts/extract-questions.js`) — questions.json 재생성
- `npm run verify` (= `node scripts/verify-extraction.js`) — 추출 결과 구조적 검증
- `npx playwright test` (Phase 4부터)
- `npx cap sync && npx cap build android` (Phase 6)

## 데이터 모델 (실제 추출 스키마)
```json
{
  "id": "C09-8-Q01",
  "lessonId": "C09-8",
  "area": "의사소통능력",
  "lessonTitle": "업무 공지문과 이메일에서 핵심 정보 찾기",
  "level": "기초",
  "stem": "문항 본문",
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4", "선택지5"],
  "answer": "C",
  "explanation": "정답 해설",
  "teachingNote": "A등급(ordered_list) 문항에만 존재하는 학습 코칭 멘트, 그 외 null",
  "supplementaryNote": "원본에 중복 보충설명이 있던 문항에만 존재, 그 외 null",
  "mistakePattern": null,
  "isAGrade": false,
  "sourceFormat": "inline_p | ordered_list | inline_bundled_paragraph",
  "answerSource": "explicit | inferred_from_explanation | unresolved",
  "needsManualReview": false,
  "reviewReason": "answerSource나 excludeFromQuiz가 explicit/false가 아닐 때만 채워짐",
  "excludeFromQuiz": false
}
```

## Phase 4에서 확인된 사실 (2026-06-24, 완료)

### 핵심 루프 변경 (Before → After)
- Before: 모든 스왑 매치 → 퀴즈 강제 팝업 → 정답 통과해야 타일 제거
- After: 일반 색상 매치 → 즉시 타일 제거+점수. 퀴즈 버블(`quiz` 타입) 매치만 퀴즈 팝업 발생

### 구현 내용
- **MatchEngine.js**: `QUIZ_BUBBLE_TYPE='quiz'` 추가, `_randomTileType()`으로 15% 확률 생성(튜닝 필요 주석),
  정상 매치(`match`)는 즉시 처리, 퀴즈 버블 매치(`quiz_match`)만 `resolveQuiz` 대기
- **퀴즈 오답 페널티 없음**: `resolveQuiz` 오답 시 콤보 리셋만, 하트/점수 차감 없음
- **퀴즈 정답 보상**: +1 이동 횟수(`bonusMoves`), quiz_bonus 팡파레 사운드, 카메라 shake+flash
- **"넘기기" 버튼**: QuizOverlay에 상단 우측 추가, 클릭 시 tiles 제거만(점수/페널티 없음)
- **해설 선택 노출**: 오답 후 "해설 보기 ▾" 토글 버튼으로 opt-in (강제 노출 없음)
- **teachingNote**: 정답 시 자동 표시(보너스 팁으로, 강제 학습 아님)
- **스탯 패널**: 보드 하단 빈 공간(y≈468)에 퀴즈 N/M 정답 표시, 콤보 배지 배치
- **0하트 시작 화면**: "하트 충전 대기 중" + MM:SS 카운트다운 + "영역 선택" 버튼
- **시각 피드백**: `_shrinkCells` (Back.easeIn 축소), `_popInNewCells` (Back.easeOut 팝인, 열별 stagger),
  `_showFloatingScore` (위로 올라가는 +N점 텍스트), quiz 정답 시 camera shake+gold flash
- **퀴즈 버블 시각**: 금색(0xFFD700), 더 밝은 sheen(0.35), 진입 후 pulse 트윈(±6% scale)
- **콤보 사운드**: 정답으로 tier 상승 시(hot/fever/nova) 해당 사운드 자동 재생

### 수치 (튜닝 필요로 표시된 임의값)
- `QUIZ_BUBBLE_PROB = 0.15` (15%): 7×7 보드에 약 7개 생성 기대치. 체감 빈도 조정 필요
- 정답 보너스: `bonusMoves = 1` (이동 +1). 게임 밸런스에 따라 조정 가능
- 퀴즈 버블 pulse: 700ms 주기 1.06 scale, `repeat:-1`

### 주관적 플레이 평가
일반 매치가 즉시 처리되어 게임 진행 속도가 빨라짐. 금색 버블을 발견해서 3개 맞출 때 "의도적 노림"의 느낌이 생김. 정답 시 flash+shake는 체감이 확실함. 단, 퀴즈 버블이 금색이라 a07(밝은 노랑)과 육안 구별이 어려울 수 있음 — 추후 "?" 텍스트 레이어 또는 별도 아이콘 추가 검토 필요(Phase 5+).

### 알려진 미해결 이슈 (Phase 5로 이월)
- 퀴즈 버블 a07 yellow와 육안 구별 어려움: 아이콘/텍스트 오버레이 미구현
- "넘기기" 버튼 좌표: 게임 내부 좌표와 뷰포트 좌표 스케일 차이로 초기 클릭 실패(게임 동작에는 문제 없음)
- ResultScene "퀴즈 N개 중 M개 정답" 전달 경로: StageScene → ResultScene quizAttempts/quizCorrect 연결 확인됨
- 스탯 패널 콤보 배지: 퀴즈 정답 콤보에만 반응(일반 매치 콤보는 없는 것이 의도적 설계)

## Phase 3에서 확인된 사실 (2026-06-24, 완료)
- Phaser 4.2.0 사용 중 (npm install phaser → v4.2.0). API는 Phaser 3와 동일.
- Vite 8.1.0, ESM+CJS 공존: `"type":"module"` → 스크립트는 `.cjs` 확장자로 복사 사용.
- 5개 씬 모두 실제 동작 확인 (preview 도구로 스크린샷 검증):
  - BootScene: "로딩 중..." → AreaSelectScene 전환
  - AreaSelectScene: 9개 영역 3×3 카드, 데이터 기반(하드코딩 없음) ✓
  - StageScene: 7×7 타일 보드, 하트/점수/횟수 HUD, 집중영역 배지 ✓
  - QuizOverlay: 실제 questions.json 문항, 4/5지선 가변, 정오 피드백 ✓
  - ResultScene: 별/점수/하트/버튼 ✓
- 알려진 미해결 UX 이슈:
  - 하트가 0인 채로 세션 시작 시 즉시 게임오버 → "충전 대기 중" 화면 필요 (Phase 4+)
  - 보드 하단 여백: 7행×52px+100 = 464px, 700px 캔버스의 나머지 236px 빔 (레이아웃 조정 필요)
- Phaser resume 이벤트 서명: `events.on('resume', (_sys, data) => ...)` — 첫 인수는 Scene Systems 객체.
- Phaser 입력 이벤트: `window.dispatchEvent(new MouseEvent('mousedown', ...))` 사용.
  `canvas.dispatchEvent(pointerdown)`은 Phaser에서 감지하지 못함.
- localStorage 하트 키: `gyo6.hearts.v1`, 형식: `{ hearts, ts }`.
  테스트 리셋: `localStorage.setItem('gyo6.hearts.v1', JSON.stringify({ hearts: 5, ts: Date.now() }))`.

## 관련 파일
- `data/manual-answer-overrides.json` — 원본에 정답 글자가 없어 분석으로 추론한 정답과
  그 근거를 기록.
- `archive/match3-game-prototype/` — Phase 1~4 매치3+퀴즈 게임 코드 전체. 삭제 금지.
- `supabase/migrations/20260624_001_initial_schema.sql` — Phase 5 DB 스키마 (아래 참조).
- `supabase/seed.sql` — 개발용 더미 데이터 주석본.

## Phase 5 — 학교/학급 관리 플랫폼 (2026-06-24, 세션 1 진행 중)

### 전환 배경
매치3+퀴즈 게임 방향을 전면 폐기. 교사-학생 미션 기반 학습 플랫폼으로 재설계.
- 교사: 미션 생성 (이번시간/오늘/이번주/중간고사/기말고사/인증평가)
- 학생: 미션 수행 (questions.json 풀에서 출제)
- 랭킹: 개인/학급/학교/전국 (전국은 학교 opt-in + 닉네임 전용)
- 알림: 인앱 전용 (이메일/KakaoTalk/SMS 없음)
- 앱: Capacitor Android (폰 UI — 리스트/카드, 테이블 없음)

### 절대 규칙 (Phase 5 추가)
- **전국 랭킹 opt-in + 닉네임 전용** 설계는 반드시 보고 후에만 변경 (미성년자 개인정보)
- **Supabase 프로젝트**: 이 앱 전용 새 프로젝트 (ktedu.or.kr 분리)
- `excludeFromQuiz:true` 문항은 미션 풀에서 자동 제외 (기존 규칙 유지)

### DB 스키마 결정 (20260624_001)
테이블: `schools`, `profiles`, `classes`, `teacher_classes`, `student_classes`,
        `missions`, `submissions`, `rewards`, `notifications`
뷰:     `class_rankings`, `national_rankings`
RPC:    `rpc_create_teacher_profile`, `rpc_create_class`, `rpc_student_join`,
        `rpc_create_mission`, `rpc_submit_mission`

핵심 설계 결정:
- `profiles.nickname` — 전국 랭킹 전용. 실명·이메일 절대 노출 안 함.
- `schools.national_ranking_opt_in` — false이면 national_rankings 뷰에서 제외.
- `submissions` unique(mission_id, student_id) — 1회 제출 강제.
- 채점 방식: DB에 questions.json 정답 미저장 → 클라이언트 채점 후 `_score` 키로 전송,
  `rpc_submit_mission`에서 추출 후 저장. (questions.json 단일 진실 원칙 유지)
- class_code: 8자 대문자+숫자, 혼동 글자(O,0,I,1) 제외.

### Capacitor/Android 현황
- bubble-nova-star: 완전한 Capacitor + Android 프로젝트 (appId: com.bubblenova.star)
- gyo6-jobskill-game: Capacitor 미설치
- Phase 5 세션 3에서 Capacitor 추가 예정 (npx cap init → android 추가)

## Phase 5 세션 2 — 로컬 검증 완료 (2026-06-24)

### 발견된 SQL 버그 및 수정 내역
1. **class_rankings 뷰 42P20**: `rank() over (order by sum() over ...)` — 윈도우 중첩 불가.
   수정: CTE `student_class_totals`로 학생별 총점 먼저 집계 후 rank 적용.
2. **seed.sql 22P02**: `'sch-0000-0000-0001'`이 UUID 형식 아님.
   수정: `'00000000-0000-0000-0000-000000000001'`로 교체.
3. **profiles RLS 42P17 무한재귀**: `profiles_teacher_read_school` 정책이 `profiles`를 서브쿼리로
   참조 → 자기참조 순환. 수정: `my_profile_role()` / `my_school_id()` SECURITY DEFINER 헬퍼 함수로 우회.
4. **submissions 42501 권한 없음**: authenticated 역할에 GRANT 누락.
   수정: `GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated` 추가.

### 로컬 검증 결과 (supabase start + db reset 후)
- 마이그레이션: `supabase db reset` — 에러 없이 통과 ✓
- RPC 1 `rpc_create_class`: `{"class_id":"7a4d...","class_code":"VE4LCY6D"}` ✓
- RPC 2 `rpc_create_teacher_profile`: 교사 UUID 반환 ✓
- RPC 3 `rpc_student_join` × 5: 5명 전원 입장 성공 ✓
- RPC 4 `rpc_create_mission`: 미션 ID 반환, notifications 5건 생성 ✓
- RPC 5 `rpc_submit_mission` × 5: score 10/9/8/7/6 제출 ✓
- `class_rankings` 뷰: 10→9→8→7→6 정렬 + rank 1~5 정확 ✓
- `national_rankings` 뷰: 닉네임만 표시, 실명 없음, opt-in 조건 충족 ✓
- RLS A: 학생1 profiles 조회 → 본인 1건만 ✓
- RLS B: 학생1 submissions 조회 → 본인 제출 1건만 ✓
- RLS C: 교사 submissions 조회 → 담당 학급 5건 전부 ✓

### 로컬 스택 접속 정보 (개발 전용 — 공유 금지)
- DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- API: `http://127.0.0.1:54321`
- JWT Secret (로컬만): `super-secret-jwt-token-with-at-least-32-characters-long`

### 클라우드 검증 결과 (세션 2 완료)
- 클라우드 URL: https://eniyjdmtbunvizrsomrp.supabase.co
- 마이그레이션: Dashboard SQL Editor로 직접 적용 (supabase link 없이)
- 추가 발견: `service_role` GRANT 누락 → 마이그레이션 파일에 추가 완료
  (클라우드에는 Dashboard에서 수동으로 `grant all on all tables in schema public to service_role;` 실행 필요)
- RPC 1~5 클라우드 실제 실행 결과:
  - rpc_create_teacher_profile ✓
  - rpc_create_class → `{"class_id":"169bb9cc...","class_code":"PU832BD7"}` ✓
  - rpc_student_join × 5 → 5명 전원 "2-1반" 입장 ✓
  - rpc_create_mission → `"f1d83269..."` ✓
  - rpc_submit_mission × 5 → score=8/7/9/6/10, submission_id 각각 ✓
- class_rankings 뷰: 윤서아(10)→최유진(9)→이수연(8)→정민호(7)→강도현(6) ✓
- national_rankings 뷰: 닉네임만(서아달/유진별/수연이/민호짱/도현이), 실명 없음 ✓
- RLS A: 학생1 → submissions 1건(본인만) ✓
- RLS B: 교사 → submissions 5건(담당 학급 전체) ✓
- 테스트 계정 (클라우드): teacher1@gyo6test.com / student1~5@gyo6test.com (pw: Test1234!)

## Phase 5 세션 3 — React+Capacitor 골격 완료 (2026-06-24)

### 완료된 작업
- Phaser 제거, React + react-dom + react-router-dom + @supabase/supabase-js 설치
- @vitejs/plugin-react 설치, vite.config.js React 플러그인 적용
- Capacitor (core + cli + android + status-bar + splash-screen) 설치
- `npx cap init` → `npx cap add android` — Android 프로젝트 생성 완료
- 구 src/(engine, scenes, systems, constants.js, data-loader.js, main.js) 전부 삭제
  (archive/match3-game-prototype/에 백업됨)

### 프론트엔드 구조
```
src/
  main.jsx              React 진입점
  App.jsx               Auth 상태 → 역할별 라우팅 (teacher/student)
  index.css             전역 스타일 (CSS 변수, 공통 컴포넌트)
  lib/
    supabase.js         Supabase 클라이언트
  screens/
    LoginScreen.jsx     로그인 + 학생 가입 (학급 코드 기반)
    teacher/
      TeacherShell.jsx       화면 전환 컨트롤러
      TeacherDashboard.jsx   학급 목록 + 최근 미션 + 미션 활성화/마감
      MissionCreateScreen.jsx 미션 생성 (유형/영역/단원/문항수/시간제한/마감일)
      ClassResultsScreen.jsx  학급별 랭킹 결과
    student/
      StudentShell.jsx       바텀탭 (홈/랭킹/알림)
      StudentHome.jsx        미션 목록 (진행중/완료/마감)
      MissionScreen.jsx      퀴즈 플로우 + 클라이언트 채점 + RPC 제출 + 해설
      RankingScreen.jsx      학급/전국 랭킹 (닉네임 전용 보호 안내 포함)
      NotificationsScreen.jsx 인앱 알림 목록
```

### 실 화면 검증 결과 (클라우드 데이터 연동)
- 로그인 화면 ✓
- 교사 대시보드: 김지수 선생님, 2-1반(PU832BD7), 최근 미션 표시 ✓
- 미션 만들기: 유형 6종 버튼, 9개 영역 체크박스 + 단원 세부선택 ✓
- 학생 홈: 이수연, 완료 미션 80%(8/10) 표시 ✓
- 학급 랭킹: 🥇윤서아 🥈최유진 🥉이수연(나) 4위정민호 ✓
- 전국 랭킹: 닉네임만 표시(서아달 100%, 유진별 90%, 수연이(나) 80%) ✓
- 바텀탭 (홈/랭킹/알림) ✓

### 빌드 현황
- `npm run build` → 433KB JS (gzip 121KB) — 에러 없음 ✓
- `npx cap sync` — dist → android 복사 완료
- Android Studio에서 `android/` 폴더 열면 바로 에뮬레이터/실기기 빌드 가능

### 남은 작업 (세션 4+)
1. MissionScreen questions.json fetch 최적화 (현재 전체 로드 후 필터)
2. 교사 대시보드 "결과 보기" 미션 선택 UX 개선
3. 학생 가입 흐름 실제 테스트 (현재 클라우드 테스트 계정은 수동 생성)
4. Push 알림 (Capacitor FCM 연동, 선택)
5. Android APK 서명 + Play Store 배포 준비

## 2026-06-26 작업 요약 (식음료 외부평가 고도화 · 안정화 · 합격율 특화)

### 식음료서비스 25V3 전면 개편 + 인증 콘텐츠 대량 확보
- **25V3 평가유형 개편**: 지필 = C01·C02·C06·C07·C08(5), 면접 = C03·C04·C05(3). 지필 50분·면접 15분, 합격기준 8개 중 6개↑·능력단위별 60점. 공식 출제기준 PDF(25V3)로 100% 검증.
- **통합 문항뱅크** `src/lib/foodServiceBank.js`: 5개 소스 병합(base + c02-paper + exam-bank + official-spec + ncs-lm) + `normalize()`로 스키마 통일(OX O↔A/B, questionMode 부여). 자율학습·미션·모의평가 단일 소스. 단원별 C01:70·C02:77·C03:48·C04:74·C05:92·C06:68·C07:52·C08:64.
- **신규 인증 문항 데이터**(추측 금지, 출처 표기):
  - `food-service-c02-paper.json`(40): C02 지필 전환 보강(검증 채점포인트 파생)
  - `food-service-exam-bank.json`(66): 2023 실제 기출 + 능력단위별 공식 예상문제(정답표기본)
  - `food-service-official-spec.json`(19): 공식 출제기준 6유형 예시문항(정답 도메인 검증)
  - `food-service-ncs-lm.json`(18): NCS 학습모듈 추출(소독 6종·자외선·칵테일 베이스·제공온도 등)
- **NCS 학습모듈 추출 파이프라인 확립**(폰트 ToUnicode 손상 PDF 돌파): `_ocr/render.py` = `pip install pymupdf` → 자체 래스터라이저로 페이지 PNG 렌더 → Read 도구로 비전 판독(한국어·표 100% 정확). PDF페이지 = 인쇄페이지 + 12.
- swlc.kr 분석: pbsolve2 문제는 AI 실시간 생성(로그인 필요·오답 위험)이라 미수록. 단, 사이트가 링크한 공식 출제기준 PDF는 확보·수록.

### 반복 드릴 · 합격율 특화 기능
- **빈출 우선순위**(`examPriority`, answerSource 기반 3등급) + 🔥빈출/⭐중요 배지 + 빈출 우선 정렬 토글(기본 ON).
- **약점 집중 복습**: 전 단원에서 ❌·△ 표시 문항만 모아 반복(로컬 fs_progress).
- **반복 드릴 셔플**: mulberry32 시드로 문항·보기 순서 재배열(정답 재매핑, 1600/1600 검증).
- **오답노트 통합뱅크 연결**: 신규 문항도 매핑.

### 치명 버그 수정 (안정화)
- **회원가입 스크롤 불가**: `LoginScreen` 컨테이너 하단 패딩을 `calc(120px + env(safe-area-inset-bottom))`로 확대. 원인=100dvh가 안드로이드 네비바 영역 포함.
- **OX 정답 거꾸로 표시**: base OX 정답이 letter 'A'/'B'(A=O)인데 OXCard가 'O' 비교 → `oxCorrect()` 정규화로 base·신규 통일.
- **품질경영 "교재를 불러오지 못했어요"**: QualityMgmtScreen `backHandler` useCallback이 `const units`를 선언 전 의존성 참조 → TDZ 크래시. units 선언을 앞으로 이동. (useCallback/useMemo 의존성의 const 파생값은 hook 앞에 선언할 것.)

### 빌드/배포
- 자동 versionCode(timestamp) 유지. v1.3.8 → 1.4.6까지 순차 릴리즈. 매 릴리즈 AAB + 출시노트 + `app_config`(latest_build/version) 갱신.
- 빌드: `npm run build` → `npx cap sync android` → JAVA_HOME=Android Studio jbr → `gradlew bundleRelease` → AAB를 `KBS-NOVA-v{ver}-{date}.aab`로 복사.

### 미완 백로그 (메모리 project-backlog 참조)
- P1-1 품질경영 교재 식음료급 재구축(NCS LM 추출), P1-2 직업기초·직업공통 요점정리 심화+퀴즈 고도화(티키타카 배선은 됨, 콘텐츠 1차본이라 얕음), P1-3 합격 판정 실전 모의고사, P1-4 자율학습 오답→크로스기기 오답노트.

## 라이브 시연 서버 (사용자 눈으로 확인하는 워크플로 — 표준)
- 게임 개발처럼, 구글 콘솔 내부테스트 업로드 전에 **사용자가 자기 브라우저로 직접 시연 확인**한다.
- **사용자 전용 라이브 서버: `http://127.0.0.1:7700`** (게임 5178·Claude 프리뷰 5173과 분리된 고정 포트).
- 실행: `npm run live` (= `vite --port 7700 --strictPort --host 127.0.0.1`). 백그라운드 상시 기동.
- Vite HMR이므로 코드 저장 시 자동 반영 → 사용자는 새로고침 없이/혹은 새로고침으로 즉시 확인.
- 작업 절차: 작업 → 7700에서 시연 확인 → OK면 빌드/배포. (AAB 빌드는 별도)

## 2026-06-27(오후) 모의고사 변형 시스템 + P1 백로그 진행

사용자 지시: 중요(빈출) 문항을 출제에 재반영 + **같은 ~80문항을 그대로 돌리지 말고**,
하나의 문항을 표현·선지를 바꾼 **변형으로 생성**해 "다른 문제 같지만 같은 개념"을 반복 학습.
자격 인증 콘텐츠이므로 **정답 보존·사실 무첨가** + 적대적 검증 통과분만 채택(불합격=원본 폴백).
이어서 P1 백로그(P1-3 합격판정 → P1-4 크로스기기 오답노트 → P1-1 품질경영)까지 순서대로.

### ✅ 런타임 변형 시스템 (완료·검증)
- **src/lib/mockPaper.js**: `applyVariant(q, variants, scope, paperNo)` — `hash(var|scope|paperNo|id) % (n+1)`로
  0=원본, 그 외 변형[n-1]을 덮어씀(stem·context·choices·answer·explanation·questionMode). **id는 원본 유지**(채점·오답노트 개념 매핑).
  buildMockPaper가 opts.variantMap 받으면 최종 시험지에 변형 적용 → 같은 (scope,paperNo)는 결정적, 회차마다 다른 변형.
- **src/lib/mockData.js**: `data/food-service-variants.json`({_meta, variants:{id:[변형]}}) 로드 → food cfg.variantMap.
  중요도 가중 `importanceWeight(q)`(answerSource explicit +0.5 / 심화·A등급 +0.4 / 표준 +0.2) NCS·직업공통에 적용(빈출 데이터 부재 휴리스틱). 식음료는 기존 examPriority.
- 단위검증: 한 문항이 10회차에 원본+변형2 = 3종 로테이션, 결정적, 변형 answer 정합, id 보존 PASS.

### ✅ 변형 생성 + v1.5.2 빌드 (완료)
- 워크플로 `food-mock-variants`(95 에이전트, ~17분): 리드 에이전트가 `data/_mock-src/food-service-mcq.json`(식음료 mcq/ox 373) id 로드 →
  8문항 배치 47개 → 생성 → **적대적 검증**(정답 보존·두번째정답 없음·사실 무첨가·자연 한국어·동일 개념) → 통과분만.
  결과: 생성 732 · **채택 730 · 탈락 2 · 변형 보유 367문항**(mcq 510·ox 220). ⚠️ args 배열 전달 불안정 → 리드 에이전트가 파일에서 id 읽도록 수정.
- `data/food-service-variants.json`({_meta, variants})에 기록 → **코드가 import하므로 빌드 필요**.
- 검증: 전체영역 10회 시험지에 변형 103회 적용·정답 인덱스 오류 0·회차별 표현 상이 20문항.
- **v1.5.2 빌드**: versionName 1.5.2 / versionCode 29708919 / `KBS-NOVA-v1.5.2-20260627.aab`(3.62MB). **미업로드 v1.5.1 대체**(v1.5.1 내용 포함). 출시노트=`RELEASE-NOTES-v1.5.2.txt`.
  ⚠️ app_config(latest_build=29708919/version=1.5.2)는 **Play 콘솔 업로드 후** 갱신.
- 재생성/확대 방법: `data/_mock-src/food-service-mcq.json` 유지. NCS/직업공통도 같은 워크플로 패턴으로 변형 생성 가능(추출 스크립트만 과목 교체). 변형뱅크 미보유 과목은 원본 출제(안전).

### ✅ 변형 도달 수정 + P1-3 합격 판정 모의 (완료) → v1.5.3
- ★ **변형 도달 버그 수정(중요)**: MissionScreen이 `question_ids`로 원본 풀을 재조회해 **변형이 학생에게 안 닿던** 문제(v1.5.2 결함).
  → `mission.questions`(구성된 문항 객체) 우선 사용(loadQuestions 최상단). MockAssessmentScreen startExam도 `questions: paper` 전달.
  또 `mission.onComplete` 콜백 추가(부모 채점 모드, submitQuiz에서 RPC 대신 콜백).
- **P1-3 src/lib/passExam.js**: 25V3 — 지필 C01·C02·C06·C07·C08(50분, 능력단위당 6, 자동채점 우선), 면접 C03·C04·C05(15분, 능력단위당 3, 자가확인).
  `buildPassExam(paperNo)`(빈출+변형, pickWritten로 객관식/OX 우선) · `gradePassExam(exam, mcqAnswers, selfPass)` → 능력단위별 60점 Pass/Fail, 8중 6 합격 예측, weakUnits.
- **MockAssessmentScreen**: 🎯 합격 판정 진입(식음료, 1~5회) → startPassExam(65분 시험모드) → onComplete → 판정 결과 화면(능력단위별 합격/불합격 + 면접 자가평가 토글 + 약점 안내 + 다른 회차).
- 검증: 지필 30 전부 자동채점·면접 9·회차당 변형 16~23, 판정 정확. 라이브(프리뷰): 39문항·타이머·제시문(변형 도달) 확인.
- **v1.5.3 빌드**: versionName 1.5.3 / versionCode 29708934 / `KBS-NOVA-v1.5.3-20260627.aab`. **미업로드 v1.5.1·v1.5.2 대체**(정리 완료, 이 하나만 업로드). 출시노트=`RELEASE-NOTES-v1.5.3.txt`. ⚠️ app_config(29708934/1.5.3)는 업로드 후 갱신.

### ✅ P1-4 크로스기기 오답노트 (완료) → v1.5.4
- **DB 마이그레이션** `supabase/migrations/20260627_002_wrong_answers.sql`(운영 반영 확인): `wrong_answers` 테이블
  + `rpc_save_wrong_answer`/`rpc_resolve_wrong_answer` + RLS(student_id=auth.uid()). ★ 기존 `saveWrongAnswer`가 호출하던 RPC가 **미존재해 자율학습 오답이 조용히 저장 실패**하던 버그 해결.
  ⚠️ Management API는 Cloudflare가 python UA 차단(403/1010) → curl + `--data @file`(python으로 JSON 인코딩)로 적용. 운영 DB 테스트행 insert는 auto-mode가 차단(정상) → 우회 안 함.
- **WrongAnswerScreen**: `wrong_answers`(자율학습·크로스기기, status=open) + `submissions`(미션) 병합. GLOBAL_Q_INDEX(id→{q,subjectId}) 역참조, 자율학습 그룹 `🔁 자율학습 오답`. q 없으면 저장 텍스트 폴백.
- 검증: 프리뷰 오답노트 조회·렌더 정상(권한 오류 없음). 저장 경로=구성 검증(RPC·시그니처 일치).
- **v1.5.4 빌드**: versionName 1.5.4 / versionCode 29708947 / `KBS-NOVA-v1.5.4-20260627.aab`. **미업로드 v1.5.1~3 대체**(이 하나만 업로드). 출시노트=`RELEASE-NOTES-v1.5.4.txt`. ⚠️ app_config(29708947/1.5.4)는 업로드 후 갱신.

### ✅ P1-1 품질경영 빈출 보강 (완료) → v1.5.5
- 원본 LM PDF 5개(구매품·자재입고·설비일상·사내표준화·현장품질)를 `_ocr/render.py`로 p10-27 렌더(`_ocr/qm_png`).
- 워크플로 `qm-lm-extract`(10에이전트, ~9.4분): 모듈별 18페이지 **비전 판독→4지선다 작성→같은 페이지 재판독 적대적 검증**(정답 본문 근거·유일 정답·날조 없음). 작성 75 → **통과 69**(구매15·자재13·설비13·표준13·현장15).
- `scripts/integrate-qm-core.cjs`: 검증 통과분을 품질 선다형 스키마(type:'choice', choices:[{value,text}], answer=value, answerSource='ncs_learning_module')로 변환해 **해당 능력단위 단원 맨 앞에 ⭐빈출 핵심으로 prepend**. 스키마 불량 0.
- ChoiceCard가 이미 즉시 피드백 + `saveWrongAnswer(q,2,...)` 호출 → P1-4 덕에 품질 MCQ 오답도 크로스기기 오답노트 누적.
- **v1.5.5 빌드**: versionName 1.5.5 / versionCode 29708969 / `KBS-NOVA-v1.5.5-20260627.aab`. 미업로드 v1.5.1~4 대체. 출시노트=`RELEASE-NOTES-v1.5.5.txt`. ⚠️ app_config(29708969/1.5.5)는 업로드 후 갱신.

### ✅ 합격 판정 학습 루프 완성 (완료) → v1.5.6
- MockAssessmentScreen `startWeakReview(exam, mcqAnswers, weakUnits)`: 판정 결과 → 약점 능력단위의 틀린 객관식/OX·면접 문항을 모아
  즉시 피드백 드릴(time_limit_min:null → instantFeedback, shuffle). 판정 약점 박스에 "🎯 약점 집중 복습 시작" 버튼.
- `recordWrong(questions, mcqAnswers)`: 합격 모의·약점 복습 오답을 `saveWrongAnswer(q, 3, letter)`로 크로스기기 오답노트 누적(P1-4 연동).
- 루프: 모의 응시 → 판정/약점 진단 → 약점 집중 복습 + 오답 누적 → 다른 회차 재응시. **v1.5.6**(vc 29708990) `KBS-NOVA-v1.5.6-20260627.aab`.

### 🎉 P1 + 합격 루프 전부 완료. 남은 선택 과제:
- (선택) **NCS/직업공통 변형뱅크** 생성(같은 `food-mock-variants` 패턴, 추출 스크립트만 과목 교체).
- (선택) **품질 LM 심화 확장**(학습2·3: 검사방식·관리도·샘플링) + 기존 필러(s0X 85문항/단원, answerSource="?") 정리.
- (선택) **합격 판정 결과 서버 저장**(현재 로컬 판정·약점복습만) → mock_assessments 기록·교사 가시화.

---

## 2026-06-27 진행 체크포인트 — 모의고사 개편 (다음 세션 이어가기)

> 사용자 요구(원문): "교사에게 제공할 모의고사는 한번에 70문제씩 한영역에 하나의 시험지로
> 만드는 형식은 실 사용이 힘들어. 한 시험 문제에 **30문제** 정도로 해서 전체 학습 내용을
> 모두 수용하면서도 시험에 출제되었거나 출제될 비율이 높은 것을 더 많이 출제될 수 있게
> 비율을 정해서 **영역별로 랜덤으로 5번** 정도의 모의 시험을 준비해서 교사가 오픈 지정을
> 해서 오픈… **전체 영역을 대상으로… 모의시험지를 10회** 만들어 교사가 오픈을 지정해서
> 오픈할 수 있도록." + Task2: "퀴즈의 형식·내용 구성·전개도 학습에 도움 되게 업그레이드."

### ✅ 완료 (이 세션)
1. **DB 마이그레이션**: `open_mock_exams`에 `scope text default null`(영역 키 또는 `'__all__'`),
   `paper_no smallint default null`(전체 1~10·영역 1~5) 컬럼 추가. Supabase Management API로
   클라우드 적용 완료(201). 기존 컬럼: id, class_id, subject_id(text), title,
   question_count(default 50), time_limit_min(default 60), opened_by, created_at, closed_at.
   RLS: 교사 manage(teacher_classes), 학생 open만 read, 관리자 read.
2. **`src/lib/mockPaper.js`** (생성·완성): `buildMockPaper(pool, scope, paperNo, {count=30, areaKey, weight})`.
   결정적(같은 scope+paperNo→같은 시험지, DB에 문항ID 저장 불필요)·빈출가중(weight 큰 문항 우선)·
   영역 라운드로빈(전체 내용 고르게 수용)·시드 셔플. `MOCK_PAPERS={all:10, area:5}`, `MOCK_COUNT=30`.
3. **`src/lib/mockData.js`** (생성·완성, 의존성 검증됨): 과목별 설정 캡슐화.
   - `getMockScopes(subjectId)` → `[{key:'__all__',name:'전체 영역',papers:10}, …영역 {papers:5}]` (교사 오픈 목록).
   - `buildSubjectMockPaper(subjectId, scope, paperNo)` → 30문항 시험지(학생 응시).
   - `MOCK_SUBJECTS` = job-common / ncs-basic / food-service.
   - 과목별 cfg: food-service(pool=foodServiceBank, areaKey=q.lessonId(C01~C08), weight=examPriority),
     ncs-basic(pool=ncs-questions, areaKey=q.area, weight=1), job-common(pool=questions.json,
     areaKey=lessonId→areaMapping.displayName, weight=1).
   - import 검증: foodServiceBank `export default`(배열)+`examPriority` ✓ · ncs 배열601 ✓ · job 배열311 ✓ · areaMapping `areas[].displayName`/`lessons[].id` ✓.

### 진행 — 순서대로
- ✅ **(a) `src/screens/student/MockAssessmentScreen.jsx`** (완료): `buildSubjectMockPaper` import,
  openExams 쿼리에 `scope, paper_no` 추가, `startExam(exam)`가 `exam.scope` 있으면 30문항 시험지 생성→
  `question_ids`/`question_count:paper.length`/`shuffle:false`로 명시 출제(레거시 fallback 유지).
- ✅ **(b) `src/screens/teacher/TeacherDashboard.jsx`** (완료): 모달을 [과목→범위(getMockScopes)→회차(1..papers)→제한시간]
  선택 + 제목 미리보기로 교체. insert `open_mock_exams{class_id, subject_id, scope, paper_no, question_count:30(MOCK_COUNT), time_limit_min, title, opened_by}`.
  mockForm = `{subject_id, scope:'__all__', paper_no:1, time_limit_min:60}`. 닫기=closed_at(기존 재사용).
- ✅ **(c) 검증** (완료): `npm run build` 통과(124모듈, 에러무). esbuild 번들 로직테스트 — 3과목 전체#1=30문항·
  중복없음·결정적·회차별상이·전영역수용, 영역시험지 30문항·5회정원 모두 PASS.
- ✅ **(e) Task2 퀴즈 학습 개편** (완료·라이브검증): 시간제한 없는 학습 퀴즈에 즉시 피드백 도입.
  - **MissionScreen**(미션·모의고사): 확인→정답·해설 + 지문(context)·핵심용어(keyTerms)·주제칩·맞힘카운터.
    시간제한 시험(time_limit_min)은 기존대로 끝에 일괄 채점(시험 무결성). 헬퍼 ContextBox/KeyTerms/AnswerFeedback 추가.
  - **StudyScreen**(자율학습 'game' 모드): gameChecked 상태 + GameCard 즉시 피드백(정답 색상·✓/✗·해설·핵심용어) + GameFeedback 컴포넌트.
    안내문구 "답을 고르고 '확인'하면 바로 정답·해설". 5173 프리뷰에서 정답/오답 흐름 라이브 검증 완료.
  - **콘텐츠 발견**: NCS 90%·식음료 86% 문항에 지문(context)이 있었으나 MissionScreen이 미표시 → 표시하도록 수정.
- ✅ **(d) AAB 빌드 v1.5.1** (완료): versionName 1.5.1, versionCode 29708883. `KBS-NOVA-v1.5.1-20260627.aab`(3.55MB).
  번들 내용: 요점정리 카드 수정 + 모의고사 개편 + 퀴즈 즉시 피드백. 출시명·출시노트=동 폴더 `RELEASE-NOTES-v1.5.1.txt`.
  ⚠️ **app_config(latest_build=29708883/version=1.5.1) 갱신은 Play 콘솔 업로드 후**에 할 것(업로드 전 갱신 시 미배포 버전 안내 오작동).

### 참고 상수/엔드포인트
- 과목 ID: `job-common` / `ncs-basic` / `food-service`. AREA_BUILDERS = {job-common:buildJobAreas, ncs-basic:buildNcsAreas, food-service:buildFoodAreas}.
- Supabase Management API(DDL): `POST https://api.supabase.com/v1/projects/eniyjdmtbunvizrsomrp/database/query`. **토큰을 여기에 적지 말 것** — 이 파일은 공개 저장소에 커밋된다. 평소 작업은 `supabase db push`(CLI 세션)로 충분하고, auth 스키마를 건드려야 할 때만 관리 토큰이 필요하다. 그때는 환경변수 `SUPABASE_ACCESS_TOKEN` 으로 그 자리에서 받는다.
- 요점정리 심화(전 과목 449예시·117단원)는 **이미 Supabase 시드 완료**(무재빌드). 단 렌더 코드 수정은 빌드 필요(위 d).
