import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const mode = process.argv[2] || '--source'
const roots = mode === '--dist' ? ['dist'] : ['src']
const forbidden = [
  [/demo\.(student|teacher|admin)@sugarsalt\.kr/i, '공개 체험 이메일'],
  [/sugarsalt2026/i, '폐기 대상 체험 비밀번호'],
  [/VITE_TRIAL_PASSWORD/, '프런트 체험 비밀번호 환경변수'],
]
let failed = false

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

for (const folder of roots) {
  const absolute = new URL(`${folder}/`, root)
  if (!existsSync(absolute)) continue
  for (const file of walk(fileURLToPath(absolute))) {
    if (!/\.(?:js|jsx|mjs|cjs|html|css|json|map)$/i.test(file)) continue
    const source = readFileSync(file, 'utf8')
    for (const [pattern, label] of forbidden) {
      if (!pattern.test(source)) continue
      console.error(`[출시 보안] 실패 - ${relative(fileURLToPath(root), file)}에 ${label} 노출`)
      failed = true
    }
  }
}

if (failed) process.exit(1)
console.log('[출시 보안] 통과 - 소스·배포 청크에 체험 계정 자격 증명 없음')
