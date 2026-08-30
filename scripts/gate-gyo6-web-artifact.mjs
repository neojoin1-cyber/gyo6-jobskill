import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve('release/web/gyo6-site/apps/sugar-salt')
const failures = []
const requireValue = (condition, message) => { if (!condition) failures.push(message) }

requireValue(existsSync(root), `홈페이지용 산출물 폴더가 없습니다: ${root}`)
if (!existsSync(root)) {
  console.error(`[gyo6 웹 산출물 실패]\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

const index = readFileSync(join(root, 'index.html'), 'utf8')
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
const version = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8'))
const gradle = readFileSync(resolve('android/app/build.gradle'), 'utf8')
const expectedVersion = gradle.match(/versionName\s+["']([^"']+)["']/)?.[1]
const entryMatch = index.match(/\/apps\/sugar-salt\/assets\/(index-[^"']+\.js)/)
const references = [...index.matchAll(/(?:src|href)="\/apps\/sugar-salt\/([^"?#]+)/g)].map(match => match[1])

requireValue(Boolean(entryMatch), 'index.html이 /apps/sugar-salt/ 엔트리를 참조하지 않습니다.')
for (const reference of references) {
  requireValue(existsSync(join(root, reference)), `index.html 참조 파일 누락: ${reference}`)
}
for (const file of ['sw.js', 'registerSW.js', 'manifest.json', 'version.json']) {
  requireValue(existsSync(join(root, file)), `필수 웹 파일 누락: ${file}`)
}
requireValue(manifest.start_url === './?entry=member', '설치 아이콘의 정식 사용자 시작 URL이 다릅니다.')
requireValue(Boolean(expectedVersion), 'Android 기준 버전을 읽지 못했습니다.')
requireValue(version.version === expectedVersion, `웹 ${version.version}과 Android ${expectedVersion} 버전이 다릅니다.`)

let entry = ''
let entryHash = ''
if (entryMatch) {
  entry = entryMatch[1]
  const source = readFileSync(join(root, 'assets', entry))
  entryHash = createHash('sha256').update(source).digest('hex').toUpperCase()
  const text = source.toString('utf8')
  requireValue(text.includes('entry') && text.includes('member'), '엔트리에 정식 사용자 직행 처리가 없습니다.')
}

const files = readdirSync(root, { recursive: true }).map(name => join(root, name)).filter(path => statSync(path).isFile())
requireValue(files.length >= 150, `산출물 파일 수가 비정상적으로 적습니다: ${files.length}`)

if (failures.length) {
  console.error(`[gyo6 웹 산출물 실패]\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

const bytes = files.reduce((sum, path) => sum + statSync(path).size, 0)
console.log(`[통과] gyo6 홈페이지용 웹 산출물 · ${files.length}개 · ${bytes} bytes`)
console.log(`경로: ${root}`)
console.log(`엔트리: assets/${entry}`)
console.log(`SHA-256: ${entryHash}`)
