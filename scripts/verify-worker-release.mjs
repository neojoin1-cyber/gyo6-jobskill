import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve('dist')
const indexPath = path.join(dist, 'index.html')
const guidePath = path.join(dist, 'school-materials', 'member-registration-guide.html')
const index = fs.readFileSync(indexPath, 'utf8')

if (index.includes('/gyo6-jobskill/')) {
  throw new Error('Worker artifact still contains the GitHub Pages base path.')
}

const refs = [...index.matchAll(/(?:src|href)="(\/assets\/[^"#?]+)"/g)].map((match) => match[1])
const missing = refs.filter((ref) => !fs.existsSync(path.join(dist, ref.slice(1))))
if (missing.length > 0) {
  throw new Error(`Worker artifact has missing assets: ${missing.join(', ')}`)
}

if (!fs.existsSync(guidePath)) {
  throw new Error('Worker artifact is missing the school materials guide.')
}

const guide = fs.readFileSync(guidePath, 'utf8')
if (!guide.includes('특성화고는 이제 이 하나의 앱으로 취업 준비 끝내자')) {
  throw new Error('Worker artifact contains an outdated school guide message.')
}

if (fs.existsSync(path.join(dist, '_redirects'))) {
  throw new Error('Worker artifact contains a Pages _redirects file that can conflict with Worker HTML handling.')
}

console.log(`Worker release gate PASS: ${refs.length} root assets · guide present · Pages base absent`)
