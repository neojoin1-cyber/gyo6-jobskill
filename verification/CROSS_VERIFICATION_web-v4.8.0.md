# 교차 적대적 검증 — Claude Code가 Cowork 보고서를 반증한다

| 항목 | 내용 |
|---|---|
| 검증일 | 2026-08-26 |
| 대상 | `D:\apps\sugar-salt-campus` @ `a3ff62c` / `web-v4.8.0` |
| 라이브 | https://neojoin1-cyber.github.io/gyo6-jobskill/ |
| 상대 보고서 | `적대적검증보고서_설탕과소금_20260826코워크.md` (Cowork, 조건부 추천) |
| 역할 | Cowork가 보고한 UX·콘텐츠 결함의 **실제 코드·데이터 원인**을 찾고, 동의하지 않고 반증한다 |
| 프로토콜 | 애플리케이션 코드 **수정 0건**. 쓰기는 이 `verification/` 폴더에만. **코드만 읽고 내린 판정은 PASS로 쓰지 않았다** |
| 최종 | **BLOCK 2건** · FIX BEFORE NEXT TEST 6건 · ACCEPTED RISK 5건 · PASS 4건 |

> **범위 주의**: 이 대상은 직전에 검증한 `sugar-salt` 3.9.48 AAB(스킬캠퍼스 아님)와 **다른 제품**이다. 두 보고서의 결함 번호는 서로 호환되지 않는다.

---

## 0. 결론 — 4단계 분류

### 🔴 BLOCK (출시 금지)

| ID | 내용 | 출처 |
|---|---|---|
| **SEC-002** | 체험계정 3종의 이메일과 **비밀번호가 라이브 배포 번들에 평문 노출** | **Claude Code 신규** (Cowork SEC-001을 포섭·강화) |
| **TRUST-001** | "체험 기록 저장 안 됨" 문구와 실제 동작 불일치 — 종료 후에도 개인 데이터 잔존 | Cowork 제기 → **실행으로 확정 + 누락 키 1건 추가 발견** |

### 🟠 FIX BEFORE NEXT TEST

| ID | 내용 | 판정 변화 |
|---|---|---|
| DEF-008 | STEP 1에서 sticky 액션바가 선택지를 덮음 | 확정 · **CSS 원인 특정** |
| DEF-007 | 상단 바로가기 4종 클릭 불가 | 확정 · **원인은 핸들러 누락이 아니라 안내 문구 오류** |
| DEF-005/006 | 체험 시드와 "처음이야" 문구 충돌 | 확정 · **Cowork의 원인 진단과 제안 수정안이 모두 틀림** |
| DEF-002 | 브랜드 명칭 불일치(설탕과소금 ↔ 스킬캠퍼스) | 라이브 재현 확정 |
| CON-003 | 지원 분야 무관 예시 텍스트 고정 | Cowork 증거 채택 |
| CON-004 | 첨삭 표본 자소서가 권장 분량의 8~14% | Cowork 증거 채택 |

### 🟡 ACCEPTED RISK

| ID | 내용 | 소유자 | 근거 | 재검토 시점 |
|---|---|---|---|---|
| DEF-009 | 학생 화면 560px 폭 고정 | 제품 오너 | `campus.css:216-218`의 **명시적 의도**. 전자칠판 수업을 전제하지 않으면 결함 아님 | 전자칠판 도입 학교 첫 계약 시 |
| DEF-001 | 첫 진입 백지 6초 | 프론트엔드 오너 | Cowork 1회 관측 · **재현 시험에서 미재현**(정상 로드). 상시 결함 아님 | 학교 무선망 실측 1회 |
| SEC-003 | 쓰기차단 트리거가 **마이그레이션 이후 생성 테이블에는 미적용** | DB 오너 | `20260825150000`은 1회성 DDL 루프. 신규 테이블은 무방비 | 신규 테이블 추가하는 다음 마이그레이션 |
| CON-001 | 학습관 명칭·태그 중복(NCS 기본/심화) | 콘텐츠 오너 | 콘텐츠는 실제로 분리돼 있음. 화면 라벨만의 문제 | 학습관 개편 시 |
| CON-002 | 기업 실명 다수 등재 | 법무·제품 오너 | 채용 공고는 공개 정보이나 상표 사용 검토 필요 | 학교 납품 계약 전 |

### 🟢 PASS (실행 검증으로 통과)

| ID | 내용 | 실행 증거 |
|---|---|---|
| RLS-STUDENT | 타 학생 자소서 조회 차단 | 테이블 GRANT 0건 · 미인증 401 · RPC 파라미터 부재(§2-8) |
| TRIAL-WRITE | 체험 중 서버 기록 없음 | public 스키마 **전 테이블** BEFORE 트리거로 차단(§2-2) |
| ANON-BOUNDARY | 미인증 데이터 접근 차단 | 6개 엔드포인트 실측 401/빈배열(§2-8) |
| NAMING | 2026 명칭 최신화 | Cowork 확인에 동의 — 반증 사유 없음 |

---

## 1. Cowork 보고서에 대한 반증 3건

### 반증 ① DEF-005/006 — "시드 주입"이라는 진단이 틀렸다

**Cowork 주장**
> `kbs_bootstrap_v1`에 `xp.total_xp: 80`, `streak.current_streak: 2`가 **주입**되어 있다.
> **시드를 0으로 조정하면 두 결함이 동시에 해소된다.**

**반증** — `kbs_bootstrap_v1`은 시드가 아니라 **서버 응답 캐시**다.

```js
// src/lib/localFirst.js:31
const CACHE_KEY  = 'kbs_bootstrap_v1'
const CACHE_TTL  = 5 * 60 * 1000     // 부트스트랩 캐시 수명
// :69-71
const { data, error } = await supabase.rpc('rpc_bootstrap')
if (error || !data || data.error) return cached?.data ?? null
write(CACHE_KEY, { at: Date.now(), data })      // ← 서버 응답을 그대로 캐시
```

라이브 실측한 캐시 내용:

```json
{"at":1787703623785,
 "data":{"xp":{"level":1,"total_xp":80,"weekly_xp":80},
         "streak":{"current_streak":2,"last_active_date":"2026-08-25",
                   "longest_streak":2,"total_days":2},
         "profile":{…},"missions":[…],"class_ids":[…],
         "server_time":"…","wrong_count":…,"unread_count":…}}
```

- `server_time` 필드가 서버 응답임을 증명한다.
- `last_active_date: "2026-08-25"`는 **어제 날짜의 실제 활동 기록**이다. 클라이언트가 만들 수 없는 값이다.
- `src/lib/localFirst.js`·`src/lib/trialSession.js`에 **하드코딩 시드 0건**(`total_xp: 80` 등 리터럴 검색 결과 없음).

**결론**: XP 80·streak 2는 **demo.student 계정이 서버에 실제로 보유한 데이터**다. 클라이언트 시드가 아니므로 **Cowork가 제안한 "시드를 0으로 조정" 수정은 적용할 대상이 존재하지 않는다.**

**올바른 수정 방향** (택1)
1. demo 계정의 **서버 데이터**를 0으로 초기화 (DB 작업)
2. 데이터는 두되 화면의 "첫 학습 시작하기 / 관심 있는 학습관을 골라 보세요" 빈 상태 문구를 진행 상태와 일치시킴
3. "체험 계정 예시 기록입니다" 라벨 부착

> 화면 모순 자체(§DEF-005/006)는 라이브에서 그대로 재현됐다 — `오늘의 루트 2 / 6` · `스킬 스탬프 3 / 4` · `9+` 배지가 `첫 학습 시작하기` · `관심 있는 학습관을 골라 보세요`와 동시 표시. **결함은 유효하되 원인과 처방이 다르다.**

---

### 반증 ② DEF-007 — "핸들러 누락"이 아니라 "안내 문구 오류"다

**Cowork 질문(claim 6)**: 핸들러 누락인지 의도된 라벨인지

**답**: **의도된 표시용 범례다.** `src/screens/student/CourseListScreen.jsx:341-356`

```jsx
).map(([icon, a, b]) => (
  <div key={a} style={{ display:'flex', alignItems:'center', gap:2, flex:1 }}>
    <div style={{ flex:1, textAlign:'center' }}>
      <div style={{ width:28, height:28, … }}>{icon}</div>
```

- 해당 map 블록에 `onClick`·`role` **0건** (실측).
- 실제 클릭 대상은 이 카드 **아래의 학습관 목록**이다. 이 4종은 "이 과목에는 이런 기능이 있다"는 범례다.

**결론**: DOM은 설계대로다. 결함은 바로 위 `<p>원하는 학습 기능을 **바로 선택하세요**</p>`(`:332`)라는 **문구가 클릭을 지시**한다는 점이다.

**수정 방향**: 문구를 "이 과목에서 제공하는 학습 기능"으로 바꾸는 것이 최소 수정이다. 클릭 가능하게 만들려면 4종 각각의 라우팅 대상을 새로 정의해야 하므로 범위가 커진다.

---

### 반증 ③ SEC-001 — 진단이 과소평가됐다. 실제로는 타이머 자체가 무의미하다

**Cowork 주장**: `localStorage.removeItem('sst.public-trial.usage')`로 우회 가능

**반증**: 우회는 그보다 훨씬 근본적이다. **체험계정 자격증명이 라이브 번들에 평문으로 있다.**

```js
// src/lib/trialSession.js:12-26
student:      { email: 'demo.student@sugarsalt.kr' },
teacher:      { email: 'demo.teacher@sugarsalt.kr' },
school_admin: { email: 'demo.admin@sugarsalt.kr'  },
export const TRIAL_PASSWORD = import.meta.env.VITE_TRIAL_PASSWORD || 'sugarsalt2026'
```

**라이브 배포본에서 실측 확인**:

```
https://neojoin1-cyber.github.io/gyo6-jobskill/assets/supabase-Dy3EcMtZ.js  (205,555 bytes)
  "sugarsalt2026"            → 1건
  demo.student@sugarsalt.kr  → 1건
```

즉 누구나 브라우저 소스만 열면 계정과 비밀번호를 얻어 **Supabase에 직접 인증**할 수 있다. 이 경우 15분 타이머는 UI에만 존재하므로 **애초에 적용되지 않는다.** localStorage 우회는 이 문제의 부분집합이다.

→ **SEC-002로 승격하고 BLOCK 처리.** 상세·완화요인은 §3 참조.

---

## 2. Cowork가 요청한 10개 주장 — 검증 결과

| # | 주장 | 판정 | 근거 |
|---|---|---|---|
| 1 | 체험 종료 시 `iv_cover_draft` 등이 삭제되는가 | **❌ 삭제 안 됨** | `trialSession.js:106-108` `clearTrialSession()`은 `sessionStorage`의 `sst.public-trial.session` **1개만** 제거. localStorage는 손대지 않는다. 라이브 실행 결과 종료 후 `kbs_bootstrap_v1`·`gyo6.studySummaries.v2`·`sst.public-trial.usage` 잔존 |
| 2 | "서버 기록 없음"이 사실인가 | **✅ 사실 (서버에서 강제)** | `20260825150000_public_trial_read_only.sql:50-71` — public 스키마 **모든 테이블**을 순회하며 `BEFORE INSERT OR UPDATE OR DELETE` 트리거 부착, 체험계정이면 `42501` 예외. 클라이언트 선의가 아니라 **DB가 차단**한다 |
| 3 | 체험 제한이 서버에도 존재하는가 | **❌ 없음** | `trialSession.js` 전체가 클라이언트 저장소 기반. `TRIAL_DURATION_MS=15분`·`TRIAL_COOLDOWN_MS=45분`, 키 `sst.public-trial.usage`. 서버 검증 호출 0건. **게다가 §반증③으로 무의미** |
| 4 | 첫 로드 백지 6초의 원인 | **재현 실패** | 라이브 로드 정상(제목·본문 즉시 렌더, 콘솔 에러 0). 메인 번들 243,627 B로 과대하지 않음. GitHub Pages 콜드 스타트 가능성 남음 → ACCEPTED RISK |
| 5 | sticky 겹침의 뷰포트 범위 | **원인 특정 · 범위 미측정** | `interview-career.css:190` `.cover-step-actions { position: sticky; bottom: 0; z-index: 4; background: color-mix(… 94%, transparent) }` — 스크롤 컨테이너에 **하단 여백 보정이 없어** 마지막 선택지가 바에 깔린다. 320~1920 전 구간 측정은 미실시(§5) |
| 6 | 바로가기 4종이 원래 클릭 가능해야 했는가 | **아니오 — 의도된 범례** | §반증② |
| 7 | `kbs_bootstrap_v1` 시드가 프로덕션 계정에도 주입되는가 | **질문 자체가 성립 안 함** | 시드가 아니라 서버 응답 캐시. 실계정은 자기 데이터를 캐시한다. §반증① |
| 8 | 학생 A의 자소서를 학생 B 토큰으로 조회 가능한가 | **✅ 차단 (구조적으로 불가)** | 아래 상세 |
| 9 | 비담임·타 학교 교사가 첨삭 문서를 조회 가능한가 | **✅ 코드상 차단 · 인증 실행 미실시** | 아래 상세 |
| 10 | 학생 앱 폭 고정이 의도인가 | **✅ 의도됨** | `campus.css:216-218` `@media (min-width: 700px) { .campus-home { max-width: 560px; margin: 0 auto; border-inline: 1px solid … } }` — 700px 이상에서 명시적으로 560px 고정 + 좌우 테두리. 우연이 아닌 설계 |

### 8번 상세 — 타 학생 조회가 구조적으로 불가능한 이유

Cowork는 "8·9번이 통과하지 못하면 출시해서는 안 된다"고 했다. **통과한다.** 근거는 정책 튜닝이 아니라 **공격 표면 자체의 부재**다.

`cover_letter_submissions`에 도달하는 경로를 전수 조사한 결과 4개뿐이며 전부 막혀 있다.

1. **PostgREST 직접 조회** → 불가.
   - `20260825003000:38` `ENABLE ROW LEVEL SECURITY`, 그리고 이 테이블에 대한 `CREATE POLICY` **0건** → 정책 없는 RLS는 **전면 거부**.
   - 더 나아가 이 테이블에 대한 `GRANT` 자체가 **0건**(`GRANT … ON public.cover_letter_evidence`만 존재). `authenticated` 롤조차 테이블 권한이 없다.
   - 클라이언트 코드에도 `from('cover_letter_submissions')` **0건** — 전부 RPC 경유.
2. **`rpc_my_cover_letters()`** → **파라미터가 하나도 없다.** `WHERE s.student_id = (select auth.uid())`로 하드 필터. 타인을 지정할 입력 자체가 존재하지 않는다.
3. **`rpc_teacher_cover_letters`** → 역할 검사 후 `teacher_classes` 매핑/학교 범위 제한.
4. **`rpc_submit_cover_letter`** → 쓰기 전용, `v_role <> 'student'`면 거부.

**미인증 실행 검증** (실제 HTTP, 공개 anon key 사용):

```
GET  /rest/v1/cover_letter_submissions   → HTTP 401  {"code":"42501","message":"permission denied …"}
GET  /rest/v1/cover_letter_feedback      → HTTP 401  42501
GET  /rest/v1/cover_letter_evidence      → HTTP 401  42501
GET  /rest/v1/profiles?select=display_name → HTTP 200  []          ← 권한은 있으나 RLS로 0행
POST /rest/v1/rpc/rpc_my_cover_letters   → HTTP 401  "permission denied for function"
POST /rest/v1/rpc/rpc_teacher_cover_letters → HTTP 401  "permission denied for function"
```

**한계**: 학생 A·B 두 토큰을 실제로 발급받아 교차 요청하는 시험은 **하지 않았다**(§5-2). 위 판정은 "미인증 실행 + 전 경로 구조 분석"에 근거한다.

### 9번 상세 — 교사 범위

`rpc_teacher_cover_letters`(`20260825123000:107-151`)는 다음만 통과시킨다.

```sql
v_role = 'admin'
OR (v_role = 'school_admin' AND s.school_id = v_school)
OR EXISTS (SELECT 1 FROM teacher_classes tc WHERE tc.teacher_id = v_uid AND tc.class_id = s.class_id)
```

- 비담임 교사(= `teacher_classes` 행 없음) → 조회 0건
- 타 학교 교사 → `teacher_classes` 매핑 없으므로 0건
- **단 `school_admin`은 자기 학교 전체를 본다.** 이는 역할 정의상 타당하나, "담임이 아닌 교사"가 `school_admin` 권한을 받으면 전교 자소서를 열람한다. 학교에 **권한 부여 기준을 문서로 고지**할 것을 권고한다.

---

## 3. BLOCK 상세

### 🔴 SEC-002 — 체험계정 자격증명이 라이브 배포본에 평문 노출 (Claude Code 신규)

**증거**
- 소스: `src/lib/trialSession.js:12-26`
- 라이브: `https://neojoin1-cyber.github.io/gyo6-jobskill/assets/supabase-Dy3EcMtZ.js`에 `sugarsalt2026` 1건, `demo.student@sugarsalt.kr` 1건 (curl 실측)
- `import.meta.env.VITE_TRIAL_PASSWORD || 'sugarsalt2026'` — 환경변수 미설정 시 리터럴이 번들에 박힌다. **현재 배포본은 리터럴이 박힌 상태다.**

**영향**
- 15분 제한·45분 쿨다운이 **UI에만 존재**. 누구나 직접 인증해 무제한 사용 가능 → Cowork가 지적한 수익 모델 위험의 진짜 원인
- `demo.admin`은 `school_admin` 역할이므로 `rpc_teacher_cover_letters`로 **체험학교 전체 자소서 열람** 가능

**완화 요인 (공정하게 기록)**
- 쓰기는 DB 트리거가 차단(§2-2) → 데이터 오염·삭제 불가
- demo 계정은 `설탕과소금 체험학교`/`체험 1반`(`20260824210010_demo_school.sql`)에만 귀속 → **실제 학생 데이터는 노출되지 않는다**
- 따라서 개인정보 유출이 아니라 **① 수익 모델 붕괴 ② 프로덕션 인증 시스템에 공개된 상시 계정** 문제다

**조치**: 체험 진입을 서버 발급 단기 토큰으로 전환하거나, 최소한 비밀번호를 빌드 시 주입되는 회전 가능한 값으로 바꾸고 리터럴 폴백을 제거할 것.

### 🔴 TRUST-001 — 문구와 동작 불일치 (Cowork 제기 · 실행으로 확정)

**화면 문구**: `체험 기록 저장 안 됨 · 실제 학교 데이터와 분리` (라이브 확인)

**실행 결과** — 학생 체험 시작 → `×`(체험 종료) 클릭 후 저장소 실측:

```
sessionStorage  →  ['sst.auth.tab-id']                       ✅ 인증 토큰·체험 세션 정상 삭제
localStorage    →  ['gyo6.theme',
                    'sst.public-trial.usage',
                    'gyo6.studySummaries.v2',   ← Cowork 미보고 (신규)
                    'kbs_bootstrap_v1']          ← xp·streak·profile·class_ids 포함
```

**근본 원인**: `src/lib/trialSession.js:106-108`

```js
export function clearTrialSession() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* noop */ }
}
```

localStorage를 정리하는 코드가 **애초에 존재하지 않는다.** Cowork가 보고한 `iv_cover_draft`(`InterviewCareerLab.jsx:862·871·907`에서 기록)도 같은 이유로 남는다.

**Cowork 대비 보강**: 잔존 키 `gyo6.studySummaries.v2`를 추가로 발견했다. 정리 대상 목록을 만들 때 누락하면 안 된다.

**공정한 정정**: 인증 토큰과 체험 세션은 **정상적으로 삭제된다.** "아무것도 안 지운다"가 아니라 "sessionStorage만 지우고 localStorage를 안 지운다"가 정확한 서술이다.

**조치**: 체험 종료·역할 전환 시 앱이 쓰는 localStorage 키를 화이트리스트로 관리해 일괄 삭제하거나, 문구를 "이 기기에만 임시 저장됨"으로 정정. 학교 공용 PC 시나리오에서는 **삭제가 정답**이다.

---

## 4. Cowork 결함별 근본 원인 (요청 역할)

| Cowork ID | 근본 원인 (파일:라인) | 비고 |
|---|---|---|
| TRUST-001 | `src/lib/trialSession.js:106-108` — localStorage 정리 코드 부재 | 확정 |
| SEC-001 | `src/lib/trialSession.js:26` — 비밀번호 리터럴 폴백 → SEC-002로 승격 | 진단 강화 |
| DEF-008 | `src/styles/interview-career.css:190` — `position:sticky; bottom:0` + 스크롤 컨테이너 하단 여백 보정 없음 | 확정 |
| DEF-009 | `src/styles/campus.css:216-218` — `@media(min-width:700px){ .campus-home{max-width:560px} }` | **의도된 설계** |
| DEF-007 | `src/screens/student/CourseListScreen.jsx:332` — 문구가 클릭을 지시 / `:341-356` 순수 div 범례 | **문구 문제** |
| DEF-005/006 | 클라이언트 원인 없음 — demo 계정의 **서버 데이터** | **진단 반증** |
| DEF-002 | 탭 제목 `설탕과소금` ↔ 진입 후 헤더 `스킬캠퍼스` (라이브 재현) | 확정 |
| DEF-001 | 재현 실패 | ACCEPTED RISK |
| CON-003 | Cowork 증거 채택 (코드 미추적) | 채택 |
| CON-004 | Cowork 증거 채택 (코드 미추적) | 채택 |

---

## 5. 검증하지 못한 범위

1. **DEF-008의 320~1920 전 구간 측정** — CSS 원인은 특정했으나 뷰포트 스윕은 미실시. 위저드 STEP 1 도달에 다단계 조작이 필요해 이번 세션에서 완료하지 못했다. **Cowork의 500×693·1280×720 실측 증거는 유효하다.**
2. **인증 상태의 학생↔학생 / 교사↔교사 교차 요청** — 계정 인증을 수행하지 않아(자격증명 입력 불가) 미실시. 8·9번 판정은 미인증 실행 + 구조 분석 근거다. **번들에 공개된 체험계정으로 이 시험이 가능하므로, 소유자가 직접 실행해 최종 확인할 것을 권고한다.**
3. **체험 중 네트워크 로그 전수** — 트리거로 서버 쓰기가 차단됨은 DDL로 확인했으나, 실제 요청 로그를 캡처하지는 않았다.
4. **CON-003·CON-004의 코드 추적** — Cowork 증거를 채택했고 독립 재현은 하지 않았다.
5. **첨삭실·면접관·인성검사관 콘텐츠** — 미열람.
6. Cowork §9의 미확인 항목(320~390px 실기기, 확대 125~200%, Play 내부테스트 APK)은 이번에도 미해결이다.

---

## 6. 실행한 명령

```bash
git rev-parse --short HEAD ; git describe --tags          # a3ff62c / web-v4.8.0
grep -rn "CREATE POLICY" supabase/migrations/*.sql        # cover_letter_submissions 정책 0건
grep -rn "GRANT.*ON.*cover_letter" supabase/migrations/   # 테이블 GRANT 0건
curl -s .../rest/v1/cover_letter_submissions -H "apikey: <anon>"   # 401 / 42501  (6개 엔드포인트)
curl -s https://neojoin1-cyber.github.io/gyo6-jobskill/assets/supabase-Dy3EcMtZ.js | grep -c sugarsalt2026   # 1
(브라우저) 라이브 학생 체험 시작 → 저장소 덤프 → 체험 종료 → 저장소 재덤프
```

## 7. 증거 파일

- 이 문서에 인용한 모든 수치는 위 명령의 직접 출력이다.
- Cowork 스크린샷 2건(`screenshot-1787700433530-0.png`, `screenshot-1787702177696-1.png`)은 재현하지 않았고 그대로 유효 증거로 채택했다.
