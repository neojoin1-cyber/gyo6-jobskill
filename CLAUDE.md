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
