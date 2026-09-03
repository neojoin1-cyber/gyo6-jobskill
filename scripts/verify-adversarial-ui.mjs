import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '../verification/adversarial-4.8.13/tools/e2e/node_modules/@playwright/test/index.mjs'
import { AxeBuilder } from '../verification/adversarial-4.8.13/tools/e2e/node_modules/@axe-core/playwright/dist/index.mjs'
import { openWithSession } from '../verification/adversarial-4.8.13/tools/e2e/lib/session.mjs'

const APP = process.env.APP_URL || 'http://127.0.0.1:7700/'
const outputDir = 'output/playwright/adversarial-4.8.16'
mkdirSync(outputDir, { recursive: true })
const report = { generatedAt: new Date().toISOString(), app: APP, checks: [], scans: [] }

function check(name, pass, detail = '') {
  report.checks.push({ name, pass: Boolean(pass), detail: String(detail || '') })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`)
}

async function scan(page, name) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = result.violations.filter(item => ['serious', 'critical'].includes(item.impact))
  report.scans.push({
    name,
    violations: result.violations.map(item => ({
      id: item.id,
      impact: item.impact,
      count: item.nodes.length,
      nodes: item.nodes.slice(0, 8).map(node => ({
        target: node.target.join(' '),
        html: node.html.slice(0, 220),
        summary: node.failureSummary?.replace(/\s+/g, ' ').slice(0, 220),
      })),
    })),
  })
  check(`${name} WCAG serious/critical`, serious.length === 0,
    serious.map(item => `${item.id}:${item.nodes.length}`).join(', '))
}

async function zoomCheck(page, name) {
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  await page.waitForTimeout(600)
  const result = await page.evaluate(() => {
    const width = innerWidth
    const controls = [...document.querySelectorAll('button, a, [role="button"], [role="tab"]')]
      .filter(element => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      })
    const outside = controls.filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.left < -2 || rect.right > width + 2
    })
    return {
      outside: outside.length,
      documentOverflow: document.documentElement.scrollWidth > width + 2,
      examples: outside.slice(0, 10).map(element => {
        const rect = element.getBoundingClientRect()
        return {
          text: (element.innerText || element.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40),
          className: typeof element.className === 'string' ? element.className : '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        }
      }),
    }
  })
  check(`${name} 200% controls`, result.outside === 0 && !result.documentOverflow, JSON.stringify(result))
  await page.evaluate(() => { document.documentElement.style.zoom = '1' })
}

async function openTrial(role) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
  const page = await context.newPage()
  const errors = []
  const network = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(`${message.type()}: ${message.text()}`)
  })
  page.on('response', response => {
    if (response.url().includes('public-trial-session')) network.push(`${response.status()} ${response.url()}`)
  })
  await page.goto(`${APP}?trial=${role}&trial_nonce=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  if (role === 'student') {
    await page.waitForFunction(() => document.body.innerText.includes('스킬캠퍼스'), null, { timeout: 40_000 }).catch(() => {})
  } else {
    await page.locator('.teacher-mobile-tools button').first().waitFor({ state: 'visible', timeout: 40_000 }).catch(() => {})
  }
  await page.waitForTimeout(600)
  return { browser, context, page, errors, network }
}

const student = await openTrial('student')
try {
  const studentBody = await student.page.locator('body').innerText()
  check('student trial entered', /스킬캠퍼스/.test(studentBody), `${studentBody.replace(/\s+/g, ' ').slice(0, 160)} | ${student.network.join(', ')}`)
  await scan(student.page, 'student-home')
  await zoomCheck(student.page, 'student-home')
  await student.page.screenshot({ path: `${outputDir}/student-home.png` })

  const start = student.page.getByRole('button', { name: /바로 시작|이어가기|미션 시작/ }).first()
  check('student recommended learning reachable', await start.isVisible().catch(() => false))
  if (await start.isVisible().catch(() => false)) {
    await start.click()
    await student.page.waitForTimeout(1_200)
    const learningStart = student.page.getByRole('button', { name: /학습 시작/ }).first()
    if (await learningStart.isVisible().catch(() => false)) {
      await learningStart.click()
      await student.page.waitForTimeout(1_200)
    }
    const semantics = await student.page.evaluate(() => ({
      headings: document.querySelectorAll('h1, h2, h3, [role="heading"]').length,
      mains: document.querySelectorAll('main, [role="main"]').length,
      live: document.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length,
    }))
    const learningBody = (await student.page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 240)
    check('student question heading and main', semantics.headings > 0 && semantics.mains > 0, `${JSON.stringify(semantics)} ${learningBody}`)
    await student.page.screenshot({ path: `${outputDir}/student-learning.png` })
    await scan(student.page, 'student-question')
    for (let guard = 0; guard < 30; guard += 1) {
      const startChallenge = student.page.getByRole('button', { name: /단원 도전 시작/ }).first()
      if (await startChallenge.isVisible().catch(() => false)) {
        await startChallenge.click()
        await student.page.waitForTimeout(300)
        break
      }

      const visibleSample = student.page.locator('[data-learning-choice]:visible').first()
      if (await visibleSample.isVisible().catch(() => false)) await visibleSample.click()

      const reveal = student.page.getByRole('button', { name: /탭하여 확인|정답 용어 보기|정답 근거 보기/ }).first()
      if (await reveal.isVisible().catch(() => false)) await reveal.click()

      const missionCriterion = student.page.locator('.learning-exit-criteria button:visible').first()
      if (await missionCriterion.isVisible().catch(() => false)) {
        await missionCriterion.click()
        await student.page.getByRole('button', { name: '내 실전 행동 확정' }).click()
      }

      const formativeItems = student.page.locator('.learning-formative > ol > li')
      for (let index = 0; index < await formativeItems.count(); index += 1) {
        const item = formativeItems.nth(index)
        const choice = item.locator('.learning-formative-choices button:not([disabled])').first()
        if (await choice.isVisible().catch(() => false)) await choice.click()
        const confirm = item.getByRole('button', { name: '정답·해설 확인' })
        if (await confirm.isVisible().catch(() => false)) await confirm.click()
      }

      const nextScene = student.page.locator('button:visible').filter({ hasText: /다음|학습 정리 보기|학습 시작/ }).last()
      if (!await nextScene.isVisible().catch(() => false) || await nextScene.isDisabled().catch(() => true)) break
      await nextScene.click()
      await student.page.waitForTimeout(120)
    }
    const challengeButtons = (await student.page.locator('button:visible').allInnerTexts()).join(' | ')
    const answer = student.page.locator('[data-question-choice]:visible').first()
    check('student challenge reached', await answer.isVisible().catch(() => false), challengeButtons.slice(0, 260))
    await student.page.screenshot({ path: `${outputDir}/student-challenge.png` })
    if (await answer.isVisible().catch(() => false)) {
      await answer.click()
      const confirmAnswer = student.page.getByRole('button', { name: /확인하기|정답·해설 확인/ }).first()
      if (await confirmAnswer.isVisible().catch(() => false)) await confirmAnswer.click()
      await student.page.waitForTimeout(700)
    }
    const liveText = await student.page.locator('[aria-live], [role="status"], [role="alert"]').allInnerTexts()
    check('student answer announced', liveText.some(text => /정답|오답|맞|다시/.test(text)), liveText.join(' | ').slice(0, 180))
  }
  check('student page errors', student.errors.length === 0, student.errors.join(' | ').slice(0, 180))
} finally {
  await student.context.close(); await student.browser.close()
}

const teacher = await openTrial('teacher')
try {
  const tools = teacher.page.locator('.teacher-mobile-tools button')
  const labels = await tools.allInnerTexts().catch(() => [])
  check('teacher phone core tools', labels.length === 5 && ['미션', '채점', '첨삭', '면접', '상담'].every(label => labels.some(text => text.includes(label))), labels.join(', '))
  await scan(teacher.page, 'teacher-home')
  await zoomCheck(teacher.page, 'teacher-home')
  await teacher.page.screenshot({ path: `${outputDir}/teacher-home.png` })
  check('teacher page errors', teacher.errors.length === 0, teacher.errors.join(' | ').slice(0, 180))
} finally {
  await teacher.context.close(); await teacher.browser.close()
}

const admin = await openWithSession('admin', { viewport: { width: 390, height: 844 } })
try {
  await admin.page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await admin.page.waitForTimeout(4_000)
  check('admin current-source session entered', !/로그인/.test((await admin.page.locator('body').innerText()).slice(0, 200)))
  await scan(admin.page, 'admin-home')
  await zoomCheck(admin.page, 'admin-home')
  await admin.page.screenshot({ path: `${outputDir}/admin-home.png` })
} finally {
  await admin.close()
}

writeFileSync('output/adversarial-ui-report.json', `${JSON.stringify(report, null, 2)}\n`)
const failures = report.checks.filter(item => !item.pass)
console.log(`UI integrity checks: ${report.checks.length - failures.length}/${report.checks.length} passed`)
if (failures.length) process.exitCode = 1
