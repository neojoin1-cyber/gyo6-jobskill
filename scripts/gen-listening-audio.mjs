/**
 * Generate the fixed listening bank as static ElevenLabs MP3 files.
 *
 * Korean prompts use a native Korean voice. English dialogues use stable
 * American voices per speaker so the same character never changes mid-item.
 * Existing audio is backed up before a forced regeneration.
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = 'public/audio/listening'
const BANK = '.cache/jc.mjs'
const FORCE = process.argv.includes('--force')
const DRY_RUN = process.argv.includes('--dry-run')
const MODEL = 'eleven_v3'
const OUTPUT_FORMAT = 'mp3_44100_128'

const KOREAN_VOICE = {
  id: 'uyVNoMrnUku1dZyVEXwD',
  name: 'Anna Kim',
  locale: 'ko-KR',
  provenance: 'ElevenLabs native Korean voice library',
}

const AMERICAN_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', locale: 'en-US' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', locale: 'en-US' },
]

const KEY = process.env.ELEVENLABS_API_KEY?.trim()
  || (fs.existsSync('.cache/.elevenlabs-key')
    ? fs.readFileSync('.cache/.elevenlabs-key', 'utf8').trim()
    : '')

if (!DRY_RUN && !KEY) {
  throw new Error('ELEVENLABS_API_KEY or .cache/.elevenlabs-key is required')
}
if (!fs.existsSync(BANK)) {
  throw new Error(`Missing ${BANK}. Run npm run audio:bundle first.`)
}

fs.mkdirSync(OUT, { recursive: true })

const { jcStudyQuestions } = await import(`../${BANK}?v=${Date.now()}`)
const allItems = jcStudyQuestions().filter(question => question.audioText)
const requestedItems = allItems.filter(question => {
  if (process.argv.includes('--korean-only')) return question.id.startsWith('JC26-')
  if (process.argv.includes('--english-only')) return question.id.startsWith('ENG-')
  return true
})

if (FORCE && !DRY_RUN) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = path.join('.cache', `listening-audio-backup-${stamp}`)
  fs.cpSync(OUT, backup, { recursive: true })
  console.log(`Backed up current audio to ${backup}`)
}

const generation = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  provider: 'ElevenLabs',
  model: MODEL,
  outputFormat: OUTPUT_FORMAT,
  strategy: 'native-ko-and-american-dialogue',
  voices: {
    korean: KOREAN_VOICE,
    english: AMERICAN_VOICES,
  },
  files: {},
}

let made = 0
let skipped = 0
const failed = []
let chars = 0

for (const question of requestedItems) {
  const destination = path.join(OUT, `${question.id}.mp3`)
  if (!FORCE && fs.existsSync(destination) && fs.statSync(destination).size > 5000) {
    skipped++
    continue
  }

  const isKorean = question.id.startsWith('JC26-')
  const text = String(question.audioText).trim()
  chars += text.length

  if (DRY_RUN) {
    console.log(`${question.id}: ${isKorean ? KOREAN_VOICE.name : 'Rachel + Adam'} (${text.length} chars)`)
    continue
  }

  try {
    const result = isKorean
      ? await createKoreanSpeech(text)
      : await createEnglishDialogue(text)

    const temporary = `${destination}.new`
    fs.writeFileSync(temporary, result.audio)
    if (result.audio.length <= 5000) throw new Error(`Audio response too small: ${result.audio.length} bytes`)
    fs.renameSync(temporary, destination)

    generation.files[question.id] = {
      locale: isKorean ? 'ko-KR' : 'en-US',
      mode: isKorean ? 'single-speaker' : 'multi-speaker-dialogue',
      voices: result.voices,
      characters: text.length,
    }
    made++
    process.stdout.write(`\rGenerated ${made}/${requestedItems.length} · skipped ${skipped} · failed ${failed.length}`)
  } catch (error) {
    failed.push(`${question.id}: ${error.message}`)
  }
}

if (!DRY_RUN) {
  generation.generatedAt = new Date().toISOString()
  fs.writeFileSync(path.join(OUT, 'generation.json'), `${JSON.stringify(generation, null, 2)}\n`)
}

console.log(`\nGenerated ${made} · skipped ${skipped} · failed ${failed.length} · ${chars.toLocaleString()} chars`)
if (failed.length) {
  failed.slice(0, 10).forEach(item => console.error(`  ${item}`))
  process.exitCode = 1
}

async function createKoreanSpeech(text) {
  const audio = await requestAudio(
    `https://api.elevenlabs.io/v1/text-to-speech/${KOREAN_VOICE.id}?output_format=${OUTPUT_FORMAT}`,
    {
      text,
      model_id: MODEL,
      language_code: 'ko',
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
        style: 0.08,
        use_speaker_boost: true,
        speed: 0.97,
      },
    },
  )
  return { audio, voices: [KOREAN_VOICE] }
}

async function createEnglishDialogue(text) {
  const roleVoices = new Map()
  const inputs = text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    const match = line.match(/^([^:]+):\s*(.*)$/)
    const role = match?.[1]?.trim() || `Speaker ${index + 1}`
    const speech = (match?.[2] || line).replace(/_{2,}/g, '...').trim()
    if (!roleVoices.has(role)) {
      roleVoices.set(role, AMERICAN_VOICES[roleVoices.size % AMERICAN_VOICES.length])
    }
    return { text: speech || '...', voice_id: roleVoices.get(role).id }
  })

  const audio = await requestAudio(
    `https://api.elevenlabs.io/v1/text-to-dialogue?output_format=${OUTPUT_FORMAT}`,
    { model_id: MODEL, inputs },
  )
  return { audio, voices: [...new Set(roleVoices.values())] }
}

async function requestAudio(url, body) {
  let lastError
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300)
        throw new Error(`HTTP ${response.status} ${detail}`)
      }
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      lastError = error
      if (/HTTP (400|401|402|403|422)/.test(error.message)) break
      await new Promise(resolve => setTimeout(resolve, attempt * 1500))
    }
  }
  throw lastError
}
