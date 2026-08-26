import { useEffect, useMemo, useRef, useState } from 'react'
import { SpeakerHigh, StopCircle } from '@phosphor-icons/react'

function canSpeak() {
  return typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function'
}

/**
 * 듣기 지문 재생.
 *
 * ── 왜 한 번만 틀 수 있나 ─────────────────────────────────────────
 * 실제 듣기평가는 한 번만 들려준다. 평가 화면에서는 그 규칙이 맞다.
 *
 * ── 교실에서는 다르다 ─────────────────────────────────────────────
 * 교사가 「다시 한 번 들어 볼까요」를 해야 하고, 학생 자율학습에서도
 * 놓친 표현을 다시 들어야 한다. 배우는 화면에서는 `mode` 또는
 * `unlimited` 로 몇 번이든 다시 들을 수 있게 한다.
 *
 * ── 무엇으로 소리를 내나 ──────────────────────────────────────────
 * ① 미리 만들어 둔 mp3 (기본)
 *    듣기 지문 51개는 고정이라 미리 만들어 두었다. 브라우저 음성보다
 *    훨씬 자연스럽고, 기기마다 목소리가 달라지지 않는다.
 *    **앱 설치 때 함께 받지 않는다** — 그 문항을 처음 열 때만 받는다
 *    (서비스워커 precache 목록에 mp3 가 없다).
 * ② 브라우저 음성 (대비책)
 *    mp3 가 없거나 못 받았을 때만 쓴다. 새 문항을 넣고 음성을 아직 안
 *    만들었을 때도 학생이 문항을 풀 수는 있어야 한다.
 */
export default function ListeningPrompt({ q, revealTranscript = false, unlimited = false, mode = 'assessment' }) {
  const text = String(q?.audioText || '').trim()
  const [played, setPlayed] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [failed, setFailed] = useState(false)
  const audioRef = useRef(null)
  // mp3 가 있는지 아직 모르는 상태(null) · 있음(true) · 없음(false)
  const [hasFile, setHasFile] = useState(null)
  const utteranceRef = useRef(null)
  // 재생이 끝났는지 지켜보는 타이머. onend 가 유실되는 브라우저가 있어
  // 이벤트 대신 상태를 직접 확인한다.
  const watchdogRef = useRef(null)
  const supported = useMemo(canSpeak, [])
  // 미리 만든 음성 파일 경로. 상대경로라 하위 폴더에 올려도 그대로 맞는다.
  const audioUrl = useMemo(
    () => (q?.id && typeof document !== 'undefined'
      ? new URL(`audio/listening/${q.id}.mp3`, document.baseURI).href
      : null),
    [q?.id],
  )
  const language = q?.audioLang || 'en-US'
  const isKorean = language.toLowerCase().startsWith('ko')
  const repeatable = unlimited || mode === 'study' || mode === 'classroom'
  const repeatCopy = mode === 'study'
    ? '자율학습에서는 필요한 만큼 다시 들을 수 있습니다.'
    : '수업에서는 필요한 만큼 다시 들을 수 있습니다.'

  useEffect(() => () => {
    // 화면을 떠나면 감시도 함께 멈춘다. 안 그러면 문항을 넘길 때마다
    // interval 이 하나씩 쌓인다.
    if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null }
    // 문항을 넘기면 소리도 멈춘다. 안 그러면 다음 문항 위로 앞 지문이 겹쳐 흐른다.
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    if (utteranceRef.current && window.speechSynthesis?.speaking) {
      window.speechSynthesis.cancel()
    }
  }, [])

  if (!text) return null

  /**
   * 목소리 목록을 기다린다.
   *
   * 브라우저는 목소리를 **비동기로** 불러온다. 페이지를 열자마자
   * getVoices() 를 부르면 빈 배열이 온다(실측: 0개 -> 잠시 뒤 4개).
   * 그 상태에서 speak() 를 부르면 **소리 없이 아무 일도 안 일어난다.**
   * 「재생을 눌러도 작동을 안 함」의 정체가 이것이었다.
   */
  function loadVoices(timeout = 1500) {
    return new Promise(resolve => {
      const now = window.speechSynthesis.getVoices()
      if (now.length) return resolve(now)
      let done = false
      const finish = () => {
        if (done) return
        done = true
        window.speechSynthesis.removeEventListener('voiceschanged', finish)
        resolve(window.speechSynthesis.getVoices())
      }
      window.speechSynthesis.addEventListener('voiceschanged', finish)
      // voiceschanged 를 아예 안 보내는 브라우저가 있다. 그때도 넘어간다.
      setTimeout(finish, timeout)
    })
  }

  /**
   * 미리 만든 mp3 로 재생한다.
   *
   * 성공하면 true, 파일이 없거나 못 틀면 false 를 돌려준다.
   * false 면 부르는 쪽이 브라우저 음성으로 넘어간다.
   */
  function playFile() {
    return new Promise(resolve => {
      if (!audioUrl) return resolve(false)
      const el = audioRef.current ?? new Audio()
      audioRef.current = el
      let settled = false
      const done = (ok) => {
        if (settled) return
        settled = true
        // ★ onended 는 지우지 않는다. 여기서 함께 지웠더니 재생이 끝나도
        //   버튼이 「재생 중」에 붙박였다 — 끝을 알려 줄 사람이 사라진다.
        el.oncanplaythrough = null
        resolve(ok)
      }
      el.onerror = () => { setHasFile(false); setSpeaking(false); done(false) }
      el.onended = () => { setSpeaking(false) }
      el.onpause = () => { if (el.currentTime >= (el.duration || 0) - 0.1) setSpeaking(false) }
      el.oncanplaythrough = () => { setHasFile(true); done(true) }

      el.src = audioUrl
      el.currentTime = 0
      el.play().catch(() => { setHasFile(false); done(false) })
      // 네트워크가 느려도 마냥 기다리지 않는다. 8초면 브라우저 음성으로 넘어간다.
      setTimeout(() => {
        if (settled) return
        const playable = Number.isFinite(el.duration) && el.duration > 0
        if (!playable) {
          el.pause()
          el.removeAttribute('src')
          el.load()
        }
        done(playable)
      }, 8000)
    })
  }

  async function play() {
    // ── 먼저 미리 만든 mp3 를 시도한다 ────────────────────────────
    // 브라우저 음성보다 자연스럽고 기기마다 달라지지 않는다.
    if (hasFile !== false) {
      if (repeatable && audioRef.current) { audioRef.current.pause() }
      else if (played || speaking) return
      setSpeaking(true); setFailed(false)
      const ok = await playFile()
      if (ok) { setPlayed(true); return }
      // 못 틀었으면 아래 브라우저 음성으로 넘어간다.
      setSpeaking(false)
    }

    if (!supported) { setFailed(true); return }
    // 수업 모드에서는 이미 들었어도, 재생 중이어도 다시 튼다.
    if (repeatable) { window.speechSynthesis.cancel() }
    else if (played || speaking) return
    setSpeaking(true)
    setFailed(false)

    const voices = await loadVoices()
    // 언어에 맞는 목소리를 **직접 고른다.** lang 만 적어 두면 브라우저가
    // 못 찾고 조용히 넘어가는 경우가 있다.
    const want = language.toLowerCase().split('-')[0]
    const voice = voices.find(v => v.lang.toLowerCase().replace('_', '-') === language.toLowerCase())
              || voices.find(v => v.lang.toLowerCase().startsWith(want))

    if (!voice && voices.length) {
      // 그 언어 목소리가 기기에 없다. 억지로 읽히면 엉뚱한 발음이 난다.
      setSpeaking(false)
      setFailed(true)
      return
    }

    setPlayed(true)
    const utterance = new window.SpeechSynthesisUtterance(
      text.replace(/_{2,}/g, ' ... ').replace(new RegExp('\n+','g'), '. '),
    )
    if (voice) utterance.voice = voice
    utterance.lang = language
    utterance.rate = 0.86
    utterance.pitch = 1

    const stop = () => {
      if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null }
      setSpeaking(false)
    }
    utterance.onend = stop
    utterance.onerror = () => { stop(); setFailed(true) }

    utteranceRef.current = utterance
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)

    // ── 끝났는지 직접 지켜본다 ──────────────────────────────────
    // onend 는 유실된다. 실측에서 speechSynthesis.speaking 이 false 인데도
    // onend 가 오지 않아 버튼이 「재생 중」에 붙박였다. 학생 화면에서는
    // 그러면 **다시 누를 수도 없다.**
    // 그래서 이벤트를 믿지 않고 상태를 짧은 간격으로 확인한다.
    const started = Date.now()
    const guard = () => {
      // 막 speak() 한 직후에는 아직 speaking 이 false 일 수 있다. 조금 봐준다.
      const warmup = Date.now() - started < 800
      if (!warmup && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        clearInterval(watchdogRef.current)
        watchdogRef.current = null
        setSpeaking(false)
        return
      }
      // 아무리 길어도 2분이면 끊는다.
      if (Date.now() - started > 120000) {
        clearInterval(watchdogRef.current)
        watchdogRef.current = null
        window.speechSynthesis.cancel()
        setSpeaking(false)
      }
    }
    if (watchdogRef.current) clearInterval(watchdogRef.current)
    watchdogRef.current = setInterval(guard, 250)
  }

  const showFallback = (hasFile === false && !supported) || failed
  const showTranscript = revealTranscript || showFallback

  return (
    <div data-listening-prompt={mode} style={{
      background: '#EFF6FF',
      border: '1px solid #93C5FD',
      borderRadius: 12,
      padding: '12px 14px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={play}
          disabled={!repeatable && (played || speaking)}
          aria-label={repeatable
            ? `${isKorean ? '한국어' : '영어'} 듣기 음성 재생 (${mode === 'study' ? '자율학습' : '수업'} · 다시 들을 수 있음)`
            : (played ? '듣기 음성을 이미 한 번 재생했습니다'
                      : `${isKorean ? '한국어' : '영어'} 듣기 음성 한 번 재생`)}
          style={{
            border: 0,
            borderRadius: 10,
            padding: '10px 14px',
            background: (played && !repeatable) ? '#CBD5E1' : '#1D4ED8',
            color: (played && !repeatable) ? '#475569' : '#FFFFFF',
            fontWeight: 800,
            fontSize: 13,
            cursor: played && !repeatable ? 'default' : 'pointer',
            flexShrink: 0,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {speaking ? <StopCircle weight="fill" size={17} /> : <SpeakerHigh weight="fill" size={17} />}
            {repeatable
              ? (speaking ? '처음부터' : played ? '다시 듣기' : '듣기 재생')
              : speaking ? '재생 중' : played ? '재생 완료' : '듣기 재생'}
          </span>
        </button>
        <div>
          <p style={{ fontSize: 12.5, fontWeight: 800, color: '#1E3A8A', marginBottom: 2 }}>
            {isKorean ? '한국어 듣기 문항' : '영어 듣기 문항'}
          </p>
          <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>
            {repeatable ? repeatCopy : '인증진단 조건에 맞춰 한 번만 재생됩니다.'}
          </p>
        </div>
      </div>

      {showTranscript && (
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid #BFDBFE',
          fontSize: 12.5,
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          color: '#1E3A8A',
        }}>
          <b>{showFallback ? '음성 재생 대체 대본' : '정답 확인용 대본'}</b>
          <p style={{ marginTop: 4 }}>{q.transcript || text}</p>
        </div>
      )}
    </div>
  )
}
