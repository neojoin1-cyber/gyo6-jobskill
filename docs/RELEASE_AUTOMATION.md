# 비공개 테스트와 운영 출시 자동화

## 기본 완료선

일반 개발 작업은 전체 검증 뒤 변경사항을 커밋하고 `codex/**` 브랜치에 푸시한다. 푸시하면 `Closed Test`가 자동 실행되어 웹 산출물과 Android 테스트 APK를 만들고, 운영 DB를 변경하지 않은 채 필수 최신 동기화 스키마와 임시 학생 PC·휴대폰 동기화를 확인한다. 마이그레이션 이력 대조와 적용은 로컬 `closed:test`에서 먼저 완료한다.

로컬에서는 다음 명령으로 같은 검증과 서명된 비공개 테스트 AAB 생성을 한 번에 실행한다.

```bash
npm run closed:test
```

서명 키와 비밀번호는 로컬 파일에만 두며 GitHub에 커밋하지 않는다. AAB는 Play 비공개 `Alpha` 트랙에 게시하고, 정식 프로덕션 트랙 업로드는 소유자의 별도 승인 전에는 진행하지 않는다.

운영 출시 전 필수 확인은 다음 한 명령으로 실행한다.

```bash
npm run release:verify
```

## 자동 실행 범위

1. `20260823120000` 이후 14자리 버전의 신규 Supabase 마이그레이션만 순서대로 운영 DB에 적용한다.
2. 적용 이력, `user_device_state` RLS, 동기화 묶음 1.5MB 및 항목 400KB 상한을 원격 DB에서 다시 읽어 확인한다.
3. 운영 Auth에 임시 학생 계정을 만들고 PC와 휴대폰 역할의 독립 세션으로 양방향 동기화, 같은 키 충돌, RLS, 요청량 상한을 검증한다.
4. 검증 계정과 데이터는 성공·실패와 관계없이 자동 삭제한다.
5. Android API 36 에뮬레이터를 자동 부팅하고 APK와 계측 APK를 설치한다.
6. WebView 로컬 저장의 Activity 재생성 후 복구와 강제 종료 후 학습 화면 재실행을 2회 확인한다.
7. 자동으로 시작한 에뮬레이터는 검증 종료 시 함께 종료한다.

## GitHub 출시 게이트

운영 공개 워크플로는 `Production Deploy (Approval Required)`이며, 소유자의 별도 출시 결정 뒤에만 `approval` 입력에 `OPERATIONS_APPROVED`를 넣어 실행한다. 이 값이 없거나 다르면 공개 배포는 시작되지 않는다.

수동 GitHub Pages 출시 작업은 다음 두 작업이 모두 통과해야 빌드와 배포를 시작한다.

- `remote-preflight`: 운영 마이그레이션 적용 및 실제 학생 교차 동기화
- `android-preflight`: Android 설치·종료·복구

저장소 Actions secrets에는 다음 이름이 필요하다.

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY`

비밀값은 파일이나 로그에 기록하지 않는다. 자동검증은 Supabase CLI에서 service role 키를 실행 중 메모리로만 받아 쓰고 즉시 폐기한다.

## 실패 원칙

- 신규 운영 마이그레이션이 있는데 `--apply`가 없으면 실패한다.
- 과거 날짜형 중복 이력은 자동 재적용하지 않는다.
- 운영 계정 생성, 양방향 동기화, 충돌 처리, RLS, Android 복구 중 하나라도 실패하면 배포를 시작하지 않는다.
- GitHub 필수 비밀정보가 없으면 우회하지 않고 출시 작업을 실패시킨다.
