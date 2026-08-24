import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const errors = []
const read = path => readFileSync(join(root, path), 'utf8')

const viteConfig = read('vite.config.js')
const workflow = read('.github/workflows/deploy.yml')
const serviceWorkerPath = join(root, 'dist/sw.js')

if (/gyo6-api|supabase\\?\.co/.test(viteConfig)) {
  errors.push('Vite PWA configuration must not cache Supabase requests')
}

if (/branches:\s*\[(?:.|\n)*?(main|master)/.test(workflow)) {
  errors.push('GitHub Pages deployment must not run on every main/master push')
}
if (!/tags:\s*\['web-v\*'\]/.test(workflow)) {
  errors.push('GitHub Pages deployment is not restricted to web-v* release tags')
}
if (!workflow.includes('npm run verify:production-flows')) {
  errors.push('GitHub Pages deployment is missing the production role-flow gate')
}

if (!existsSync(serviceWorkerPath)) {
  errors.push('dist/sw.js is missing; run this gate after vite build')
} else {
  const serviceWorker = readFileSync(serviceWorkerPath, 'utf8')
  if (serviceWorker.includes('gyo6-api')) {
    errors.push('Generated service worker still contains the legacy API cache')
  }
  if (/registerRoute\([^)]*supabase\\?\.co/.test(serviceWorker)) {
    errors.push('Generated service worker still registers a Supabase cache route')
  }
}

if (errors.length) {
  console.error('Deployment safety gate failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('PASS: deployment safety gate (release-tag deploy, role-flow gate, no Supabase response cache)')
