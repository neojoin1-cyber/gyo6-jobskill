import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const directory = 'public/audio/listening'
const generationPath = join(directory, 'generation.json')
const generation = existsSync(generationPath)
  ? JSON.parse(readFileSync(generationPath, 'utf8'))
  : null
const files = readdirSync(directory).filter(name => name.endsWith('.mp3')).sort()
const entries = files.map(name => {
  const path = join(directory, name)
  return {
    questionId: name.slice(0, -4),
    file: name,
    bytes: statSync(path).size,
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
    ...(generation?.files?.[name.slice(0, -4)] || {}),
  }
})

const manifest = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  provider: 'ElevenLabs',
  delivery: 'pre-generated-static-audio',
  model: generation?.model || 'eleven_multilingual_v2',
  strategy: generation?.strategy || 'legacy-single-voice',
  voices: generation?.voices || null,
  files: entries,
}

writeFileSync(join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote listening manifest for ${entries.length} files`)
