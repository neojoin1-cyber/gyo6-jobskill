# 작업지시서 — gyo6.kr 설탕과소금 앱 체험 페이지

**의뢰** 설탕과소금 · **수행** gyo6.kr 홈페이지 관리자 · **작성** 2026-08-24
**저장소** `neojoin1-cyber/neojoin1-cyber-homepage` (브랜치 `main`, CNAME `gyo6.kr`)

---

## 0. 결론부터 — 새로 만들 것이 거의 없습니다

조사해 보니 **체험 페이지도, 앱도 이미 올라가 있습니다.**

| 이미 있는 것 | 경로 | 상태 |
|---|---|---|
| 체험 페이지 | `learning-app.html` | 정상 (HTTP 200) |
| 앱 본체 | `apps/sugar-salt/` | 정상 (HTTP 200) |
| 진입 링크 | `vocational.html` 안의 카드 1개 | 있음 |

**빠진 것은 두 가지뿐입니다.**

1. **체험 계정 안내가 없다** — 로그인 화면이 뜨는데 아이디를 안 알려 준다
2. **앱이 낡았다** — `apps/sugar-salt/` 가 2026-08-23 자

이 지시서는 그 둘을 채우는 작업입니다.

---

## 1. 작업 A — 앱 갈아 끼우기 (선행)

### A-1. 받을 것

설탕과소금 개발 담당이 전달하는 폴더:

```
인계-체험본-gyo6kr-20260824b\apps\sugar-salt\   (약 32MB, 109개 파일)
```

- **이미 `gyo6.kr/apps/sugar-salt/` 하위 경로용으로 빌드**되어 있다.
- **`audio/listening/` 에 듣기 음성 mp3 51개가 들어 있다.**
  앱을 열 때 함께 받지 않고, 그 문항을 **처음 열 때만** 받는다(약 168KB).
  서비스워커 사전 캐시 목록에 없으므로 설치 용량은 늘지 않는다.
- **홈페이지 전용 두 줄이 `index.html` 에 이미 들어 있다** (파비콘·`trial-responsive.css`).
  따로 손댈 필요 없다.
- `assets/trial-responsive.css` 도 포함되어 있다.

### A-2. 넣는 위치

```
neojoin1-cyber-homepage/
└─ apps/
   └─ sugar-salt/        ← 여기 내용을 통째로 교체
      ├─ index.html
      ├─ registerSW.js
      ├─ sw.js
      ├─ manifest.json
      ├─ assets/
      └─ icons/
```

### A-3. 순서

1. `apps/sugar-salt/assets/` **폴더를 통째로 삭제** (옛 번들이 남으면 저장소만 커진다)
2. 받은 폴더의 `apps/sugar-salt/` 내용을 그대로 복사
3. `main` 브랜치에 커밋·푸시 → GitHub Actions 자동 배포 (수 분)
4. **Cloudflare 캐시 퍼지** 실행
5. 브라우저 **Ctrl+Shift+R** 후 `https://gyo6.kr/apps/sugar-salt/` 확인

### A-4. 주의

> **`sw.js` 와 `registerSW.js` 를 반드시 함께 교체할 것.**
> 이 앱은 오프라인 동작을 위해 서비스 워커를 쓴다. 이 두 파일을 안 바꾸면
> 방문자 브라우저에 **옛 화면이 계속 뜬다.**

---

## 2. 작업 B — 체험 계정 안내 넣기 (본 작업)

### B-1. 문제

`learning-app.html` 은 iframe 으로 앱을 띄운다. 방문자는 **로그인 화면**을 만나는데
아이디를 알려 주는 곳이 없다. 그대로 나간다.

### B-2. 고칠 파일

```
neojoin1-cyber-homepage/learning-app.html
```

현재 구조 (요약)

```html
<body class="service-viewer-body">
  <a class="skip" href="#service-frame">…</a>
  <header class="site-header">…메뉴…</header>
  <main id="main" class="service-viewer-main">
    <div class="service-frame-wrap">
      <div class="service-frame-loading" id="service-loading">…</div>
      <iframe id="service-frame" src="apps/sugar-salt/"></iframe>   ← 앱
    </div>
    <noscript>…</noscript>
  </main>
```

### B-3. 넣을 위치

`<main …>` 바로 다음, **`<div class="service-frame-wrap">` 앞**에 안내 블록을 넣는다.
앱 위에 올려 두어야 로그인 전에 보인다.

### B-4. 넣을 내용 — 아래를 그대로 쓸 것

```html
<section class="trial-accounts" aria-label="체험 계정 안내">
  <h2>체험 계정으로 바로 로그인하세요</h2>
  <p class="trial-accounts-lead">가입 없이 아래 계정으로 들어가 보실 수 있습니다.</p>

  <table class="trial-accounts-table">
    <thead>
      <tr><th scope="col">역할</th><th scope="col">아이디</th><th scope="col">비밀번호</th><th scope="col"></th></tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">학생</th>
        <td><code>demo.student@sugarsalt.kr</code></td>
        <td><code>sugarsalt2026</code></td>
        <td><button type="button" class="trial-copy"
              data-id="demo.student@sugarsalt.kr" data-pw="sugarsalt2026">복사</button></td>
      </tr>
      <tr>
        <th scope="row">교사</th>
        <td><code>demo.teacher@sugarsalt.kr</code></td>
        <td><code>sugarsalt2026</code></td>
        <td><button type="button" class="trial-copy"
              data-id="demo.teacher@sugarsalt.kr" data-pw="sugarsalt2026">복사</button></td>
      </tr>
      <tr>
        <th scope="row">학교관리자</th>
        <td><code>demo.admin@sugarsalt.kr</code></td>
        <td><code>sugarsalt2026</code></td>
        <td><button type="button" class="trial-copy"
              data-id="demo.admin@sugarsalt.kr" data-pw="sugarsalt2026">복사</button></td>
      </tr>
    </tbody>
  </table>

  <details class="trial-guide">
    <summary>무엇을 눌러 보면 되나요?</summary>
    <div class="trial-guide-body">
      <h3>학생으로</h3>
      <ol>
        <li>「학생이에요」 → 로그인</li>
        <li>아래 <strong>학습</strong> 탭 → 교재 선택 → 영역 → 단원 → 문항 풀기</li>
        <li><strong>오답노트</strong> 탭에서 틀린 문항 다시 보기</li>
      </ol>
      <p class="trial-note">듣기 문항은 소리가 납니다. 이어폰을 준비하세요.</p>

      <h3>교사로</h3>
      <ol>
        <li>「선생님이에요」 → 로그인</li>
        <li>오른쪽 위 <strong>▭ 가로</strong> 를 눌러 수업용 화면으로 전환</li>
        <li><strong>수업 시작</strong> → 「문항으로 수업」 → 영역·단원 선택</li>
        <li>화면 좌우를 눌러 넘기고, <kbd>Space</kbd> 로 정답 공개</li>
        <li>도구줄의 <strong>⏱ 생각</strong>(타이머) · <strong>🎲 지목</strong>(무작위 지목)
            · <strong>📄 지문 접기</strong>(글자 키우기)</li>
      </ol>
      <p class="trial-note">가로 모드는 프로젝터·전자칠판에 맞춘 배치입니다.
        되돌리려면 <strong>▯ 세로</strong> 를 누르세요.</p>

      <h3>학교관리자로</h3>
      <ol>
        <li>「선생님이에요」 → 로그인 (학교관리자도 이 입구로 들어갑니다)</li>
        <li>학급·학생 현황과 교재 배정 화면 둘러보기</li>
      </ol>
    </div>
  </details>

  <div class="trial-caution">
    <strong>여러 분이 함께 쓰는 체험 계정입니다</strong>
    <ul>
      <li>같은 계정에 여러 명이 동시에 접속할 수 있습니다. 서로 로그아웃되지 않습니다.</li>
      <li>다만 <strong>학습 기록(점수·진도·오답)은 함께 쌓입니다.</strong>
          다른 분이 푼 문항이 내 기록에 보일 수 있습니다.</li>
      <li>체험 계정의 기록은 주기적으로 초기화됩니다.</li>
      <li>실제 학교 데이터와 분리되어 있어, 무엇을 눌러도 다른 학교에는 영향이 없습니다.</li>
      <li><strong>개인정보를 입력하지 마세요.</strong> 실명·연락처를 적지 마세요.</li>
      <li>화면이 예전 것으로 보이면 새로고침(<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>)을 해 주세요.</li>
    </ul>
  </div>
</section>
```

### B-5. 복사 버튼 동작 — `<body>` 끝의 기존 `<script>` 안에 추가

```js
document.querySelectorAll('.trial-copy').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const text = `${btn.dataset.id}\n${btn.dataset.pw}`;
    try {
      await navigator.clipboard.writeText(text);
      const old = btn.textContent;
      btn.textContent = '복사됨';
      setTimeout(() => { btn.textContent = old; }, 1500);
    } catch {
      // 클립보드가 막힌 브라우저 — 사용자가 직접 고르게 둔다
      btn.textContent = '직접 복사';
    }
  });
});
```

> 복사 버튼이 필요한 이유 — 교사는 **휴대폰으로 안내를 보며 PC 에 입력**하는 경우가
> 많다. 아이디가 길어 오타가 난다.

### B-6. 스타일

`assets/site.css` 의 기존 규칙을 따르되, 최소한 아래는 지킬 것.

- `.trial-accounts-table` — 휴대폰에서 옆으로 넘치지 않게
  (`display:block; overflow-x:auto` 또는 좁은 화면에서 카드형으로 전환)
- `.trial-copy` — 손가락으로 눌리는 크기(높이 **44px 이상**)
- `.trial-caution` — 배경색을 주어 본문과 구분

---

## 3. 작업 C — 진입 경로 늘리기 (선택)

지금 `learning-app.html` 로 가는 링크는 **`vocational.html` 안 카드 하나뿐**이다.
아래에도 넣으면 방문자가 찾기 쉬워진다.

| 파일 | 넣을 곳 | 문구(안) |
|---|---|---|
| `index.html` | 메인 히어로 또는 서비스 카드 영역 | 「설탕과소금 앱 10분 체험」 |
| `apps.html` | 앱 목록 | 「설탕과소금 학습앱 — 체험해 보기」 |

링크는 `learning-app.html` 로 통일한다. **`apps/sugar-salt/` 를 직접 걸지 말 것** —
그러면 홈페이지 메뉴가 사라진 채 앱만 뜬다.

---

## 4. 하지 말 것

1. **`apps/sugar-salt/` 안의 파일 이름을 바꾸지 말 것.** 파일명 해시가 캐시를 구분한다.
2. **`index.html`(앱 쪽) 의 번들 경로를 손으로 고치지 말 것.**
3. **「무료 체험」「무료 가입」 표현 금지.** 가격 정책이 정해지지 않았다.
4. **앱 스토어 링크를 걸지 말 것.** 내부 테스트 단계라 테스터만 설치된다.
5. **비밀번호를 이미지로만 넣지 말 것.** 복사가 안 되면 오타가 난다.
6. **학교 실명·학생 사진을 예시로 쓰지 말 것.**

---

## 5. 완료 기준

- [ ] `https://gyo6.kr/apps/sugar-salt/` 가 새 번들을 참조한다
      (페이지 소스에서 `assets/index-` 뒤 해시가 바뀌었는지 확인)
- [ ] `https://gyo6.kr/learning-app.html` 에서 계정 표가 보인다
- [ ] **복사 버튼**이 아이디·비밀번호를 정확히 복사한다
- [ ] 세 계정 모두 iframe 안에서 로그인된다
- [ ] 교사 계정 로그인 후 오른쪽 위 **▭ 가로** 버튼이 보인다 ← 이번 갱신의 핵심
- [ ] 학생 계정 → 학습 → 의사소통 국어 → 「직무 한국어 듣기」 에서
      **듣기 재생을 누르면 사람 목소리가 들린다** (기계음이 아님)
- [ ] 휴대폰(세로·가로)과 PC 에서 표가 깨지지 않는다
- [ ] 주의사항 블록(§B-4 `.trial-caution`)이 빠짐없이 들어갔다

---

## 6. 설탕과소금 개발 담당에게 확인할 것

| # | 질문 | 왜 |
|---|---|---|
| 1 | 체험 계정 기록 초기화 주기 | §B-4 문구에 넣어야 함 |
| 2 | 스토어 공개 시점 | §4-4 링크 |
| 3 | 앱 갱신 시 연락 방법 | 다음 갱신 때 §1 반복 |

---

## 부록 — 실측 자료 (2026-08-24)

| 확인 항목 | 결과 |
|---|---|
| `gyo6.kr` 호스팅 | GitHub Pages + Cloudflare |
| 저장소 | `neojoin1-cyber/neojoin1-cyber-homepage` · `main` · CNAME `gyo6.kr` |
| `learning-app.html` | HTTP 200 · iframe `src="apps/sugar-salt/"` |
| `apps/sugar-salt/` | HTTP 200 · 마지막 배포 2026-08-23 06:12 UTC |
| 진입 링크 | `vocational.html` 1곳 |
| 새 빌드 하위경로 구동 | 로컬에서 `/apps/sugar-salt/` 로 띄워 정상 확인 |
| 교사 계정 로그인 | 확인 — 「체험 선생님」 · 가로/세로 버튼 표시 |
