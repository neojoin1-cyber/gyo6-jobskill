# 유료 API·서비스 사용량 감사

기준일: 2026-08-25

## 직접 과금되는 경로

- ElevenLabs 음원 생성만 해당함.
- `npm run audio:generate`, `npm run audio:regenerate`를 개발자가 직접 실행할 때만 API 호출함.
- 학생·교사 앱 실행, 듣기 재생, 자기소개서 제출·첨삭, PDF 저장에서는 ElevenLabs를 호출하지 않음.
- 빌드·배포 명령에도 음원 생성 명령이 연결되지 않음.

## 일반 서비스 사용량에 포함되는 경로

- 로그인·학습기록·오답·메시지·자기소개서 제출·첨삭: Supabase Auth·DB·Realtime 사용량에 포함됨.
- 자기소개서 체험 제출 1건은 DB 행과 알림 데이터를 만들지만 별도 AI 생성 비용은 없음.
- PDF: 학생 기기의 `html2canvas`와 `jsPDF`로 생성하므로 외부 변환 비용 없음.
- 듣기: 미리 만든 정적 MP3를 재생하므로 재생 횟수에 따른 ElevenLabs 비용 없음.
- 웹 배포: GitHub Actions·Pages의 저장공간과 전송량 정책 적용 대상임.

## 오인하기 쉬운 설정

- `supabase/config.toml`의 `OPENAI_API_KEY`는 로컬 Supabase Studio의 선택 기능 설정임.
- 앱 런타임과 배포된 서버 함수에서 OpenAI API를 호출하는 코드는 없음.

## 자동 방지

- `npm run gate:paid-api`가 앱 런타임의 ElevenLabs·OpenAI·Anthropic·Gemini·Stripe 표식을 검사함.
- `prebuild`에 검사를 연결해 유료 API가 학생·교사 화면에 들어오면 출시 빌드를 중단함.
