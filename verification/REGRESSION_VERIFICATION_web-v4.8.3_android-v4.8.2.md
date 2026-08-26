# REGRESSION VERIFICATION - web-v4.8.3 / Android 4.8.2

| 항목 | 결과 |
|---|---|
| 검증일 | 2026-08-26 |
| 장애 | 앱 업데이트 및 웹 자산 교체 뒤 React 시작 전 흰 화면, 뒤로가기 무반응 |
| 판정 | **GO - 수정본 내부 테스트 및 웹 배포** |

## 1. 확인된 원인

- Android 번들에 웹 PWA의 `registerSW.js`, `sw.js`, Workbox가 함께 들어갔다.
- `https://localhost`에 등록된 WebView 서비스워커와 Cache Storage는 APK 업데이트 뒤에도 남았다.
- 이전 서비스워커가 새 APK에서 삭제된 파일을 요청하면 React와 오류 경계가 시작되기 전에 빈 WebView가 남았다.
- React 진입 파일 자체가 실패할 때 웹에도 번들과 독립된 복구 UI가 없었다.
- Android 13+ 예측 뒤로가기 경로가 기존 `onBackPressed()` 재정의를 우회했다.

## 2. 수정

- `vite build --mode native`에서는 PWA 플러그인을 비활성화해 서비스워커 파일과 등록 코드를 Android 번들에서 제외했다.
- 설치 빌드 번호가 바뀌면 WebView 생성 전에 `Service Worker` 저장소와 HTTP Cache만 제거한다.
- Local Storage, IndexedDB, Cookies는 지우지 않아 로그인·작성자료 저장소를 보존한다.
- 네이티브 화면이 React 준비 신호를 받지 못하면 12초 뒤 복구·종료 버튼을 표시한다.
- Android 13+ `OnBackPressedDispatcher` 경로에서 부팅 실패 중 뒤로가기를 앱 작업 종료로 연결했다.
- 웹 `index.html`에 번들과 독립된 정적 부팅 화면을 두고, 10초 타임아웃 뒤 최신 화면 복구 버튼을 표시한다.

## 3. 실제 업데이트 검증

| 시나리오 | 결과 |
|---|---|
| 결함 APK 첫 실행 후 서비스워커 등록 | `registerSW.js`, `sw.js`, Workbox 요청을 ADB에서 재현 |
| 결함 APK 위 수정 APK 덮어쓰기 | WebView 생성 전 이전 서비스워커 저장소 제거 |
| 업데이트 첫 실행 | 약 4초에 `React app painted` 확인, 흰 화면 0 |
| 업데이트 뒤 서비스워커 | 등록 0, Cache Storage 0 |
| Local Storage 보존 표식 | `KEEP-20260826` 유지 |
| 고의 메인 JS 404 | 12초 뒤 네이티브 복구·종료 UI 표시 |
| 고의 실패 중 시스템 뒤로가기 | 앱에서 런처로 복귀 |
| 고의 실패 APK 위 정상 APK 업데이트 | 자동 복구, 정상 로그인 선택 화면 표시 |

## 4. 웹 실패 주입 검증

- 메인 JavaScript만 404로 반환한 실제 브라우저 시험에서 즉시 부팅 안내를 표시했다.
- 10초 뒤 `최신 화면 다시 받기`, `다시 열기` 버튼이 표시됐다.
- 정상 빌드는 2초 안에 로그인 선택 화면을 표시했고 콘솔 오류는 0건이었다.

## 5. 출시 차단 조건

- 네이티브 산출물에 서비스워커 파일 또는 등록 코드가 있으면 빌드를 실패시킨다.
- WebView 생성 전 선별 캐시 정리, 네이티브 타임아웃 UI, Android 13+ 뒤로가기 중 하나라도 없으면 빌드를 실패시킨다.
- 웹 정적 부팅 화면과 복구 버튼, React 준비 신호가 없으면 빌드를 실패시킨다.

## 6. 최종 산출물 검증

| 항목 | 결과 |
|---|---|
| Android 버전 | `4.8.2` (`versionCode 29795166`) |
| AAB | `android/app/build/outputs/bundle/release/app-release.aab` |
| AAB 크기 | 15,731,680 bytes |
| AAB SHA-256 | `07B621544BE2BDAC6A80E3D2878D6E4FC750C5CC54160FAF9783311CF75244C5` |
| AAB 서명 | `jarsigner -verify` 통과 |
| Android 린트 | 오류·경고 0건 (`No issues found.`) |
| Android 단위 테스트 | `testReleaseUnitTest` 통과 |
| Android 릴리스 번들 | `bundleRelease` 통과 |
| AAB 내 금지 자산 | `sw.js`, `registerSW.js`, Workbox, 장애 주입 파일 0개 |
| AAB 내 복구 장치 | 정적 부팅 화면·복구 버튼·실제 메인 청크 존재 확인 |
| 웹 전체 빌드 게이트 | 1,334 공식 정합성, 5,765 문항, 150단원/921카드 등 전체 통과 |
| 운영 역할 흐름 | 학생·교사·학교관리자 및 체험 쓰기 차단 `31/31` 통과 |

## 최종 판정

기존 4.8.1 AAB는 업데이트 흰 화면 위험이 있으므로 승격하지 않는다. Android 4.8.2 수정 AAB를 새 내부 테스트 버전으로 배포하고, 웹은 web-v4.8.3으로 교체한다.
