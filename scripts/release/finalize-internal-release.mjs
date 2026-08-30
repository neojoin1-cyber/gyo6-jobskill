import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, logPass, runNpm } from './release-utils.mjs'

const explicitMetadata = process.argv.find(value => value.startsWith('--metadata='))?.slice('--metadata='.length)
const confirmed = process.argv.includes('--play-published')
if (!confirmed) {
  throw new Error('Play 내부 테스트 게시 완료 후 --play-published를 붙여 실행해야 합니다.')
}

const releaseDir = resolve(ROOT, 'release/internal')
const metadataPath = explicitMetadata
  ? resolve(ROOT, explicitMetadata)
  : readdirSync(releaseDir)
      .filter(name => name.endsWith('.aab.release.json'))
      .map(name => resolve(releaseDir, name))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]

if (!metadataPath || !existsSync(metadataPath)) throw new Error('내부 테스트 AAB 메타데이터를 찾지 못했습니다.')

const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
const build = Number(metadata.build)
const version = String(metadata.version || '').trim()
const aabPath = resolve(releaseDir, String(metadata.aab || ''))
if (metadata.packageName !== 'com.gyo6.jobskill' || metadata.track !== 'internal') throw new Error('JOB고 내부 테스트 메타데이터가 아닙니다.')
if (!Number.isInteger(build) || build < 1 || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('내부 테스트 버전 정보가 올바르지 않습니다.')
if (!existsSync(aabPath)) throw new Error(`게시한 AAB를 찾지 못했습니다: ${aabPath}`)

const digest = createHash('sha256').update(readFileSync(aabPath)).digest('hex')
if (digest !== metadata.sha256) throw new Error('게시 대상 AAB와 메타데이터의 SHA-256이 다릅니다.')

runNpm(['run', 'internal:publish-config', '--', `--build=${build}`, `--version=${version}`], { stdio: 'inherit' })
writeFileSync(metadataPath, `${JSON.stringify({
  ...metadata,
  playPublished: true,
  finalizedAt: new Date().toISOString(),
}, null, 2)}\n`)

logPass(`내부 테스트 마감 · Play build ${build} · v${version} · 앱 실행 시 업데이트 자동 안내`)
