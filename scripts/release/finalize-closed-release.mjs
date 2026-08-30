import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, logPass, runNpm } from './release-utils.mjs'

const explicitMetadata = process.argv.find(value => value.startsWith('--metadata='))?.slice('--metadata='.length)
const submitted = process.argv.includes('--play-submitted')
const published = process.argv.includes('--play-published')
if (!submitted && !published) {
  throw new Error('Play 비공개 테스트 제출 후 --play-submitted, 실제 제공 후 --play-published를 붙여 실행해야 합니다.')
}

const releaseDir = resolve(ROOT, 'release/closed')
const metadataPath = explicitMetadata
  ? resolve(ROOT, explicitMetadata)
  : readdirSync(releaseDir)
      .filter(name => name.endsWith('.aab.release.json'))
      .map(name => resolve(releaseDir, name))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]

if (!metadataPath || !existsSync(metadataPath)) throw new Error('비공개 테스트 AAB 메타데이터를 찾지 못했습니다.')

const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
const build = Number(metadata.build)
const version = String(metadata.version || '').trim()
const aabPath = resolve(releaseDir, String(metadata.aab || ''))
if (metadata.packageName !== 'com.gyo6.jobskill' || metadata.track !== 'closed') throw new Error('JOB고 비공개 테스트 메타데이터가 아닙니다.')
if (!Number.isInteger(build) || build < 1 || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('비공개 테스트 버전 정보가 올바르지 않습니다.')
if (!existsSync(aabPath)) throw new Error(`게시한 AAB를 찾지 못했습니다: ${aabPath}`)

const digest = createHash('sha256').update(readFileSync(aabPath)).digest('hex')
if (digest !== metadata.sha256) throw new Error('게시 대상 AAB와 메타데이터의 SHA-256이 다릅니다.')

const now = new Date().toISOString()
if (published) {
  runNpm(['run', 'closed:publish-config', '--', `--build=${build}`, `--version=${version}`], { stdio: 'inherit' })
  writeFileSync(metadataPath, `${JSON.stringify({
    ...metadata,
    playSubmitted: true,
    submittedAt: metadata.submittedAt || now,
    playPublished: true,
    finalizedAt: now,
  }, null, 2)}\n`)
  logPass(`비공개 테스트 제공 완료 · Play build ${build} · v${version} · 앱 실행 시 업데이트 자동 안내`)
} else {
  writeFileSync(metadataPath, `${JSON.stringify({
    ...metadata,
    playSubmitted: true,
    submittedAt: now,
  }, null, 2)}\n`)
  logPass(`비공개 테스트 검토 제출 기록 · Play build ${build} · v${version}`)
}
