import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '../verification/adversarial-4.8.13/tools/e2e/node_modules/@playwright/test/index.mjs'
import { AxeBuilder } from '../verification/adversarial-4.8.13/tools/e2e/node_modules/@axe-core/playwright/dist/index.mjs'

const APP = process.env.APP_URL || 'http://127.0.0.1:7700/'
const outputDir = 'output/playwright/adversarial-4.8.20'
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

async function openTrial(role, viewport = { width: 390, height: 844 }) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport, locale: 'ko-KR' })
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
  } else if (role === 'school_admin') {
    await page.locator('.school-admin-shell').waitFor({ state: 'visible', timeout: 40_000 }).catch(() => {})
  } else {
    await page.waitForFunction(() => document.body.innerText.includes('TEACHER CAMPUS'), null, { timeout: 40_000 }).catch(() => {})
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
    let reconsiderGateChecked = false
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

      const reconsider = student.page.locator('.learning-reconsider:visible').first()
      if (await reconsider.isVisible().catch(() => false)) {
        const nextBeforeReconsider = student.page.locator('.study-summary-navigation .btn-primary:visible').first()
        if (!reconsiderGateChecked) {
          check('changed-condition judgment is required', await nextBeforeReconsider.isDisabled().catch(() => false))
        }
        await reconsider.locator('button').first().click()
        if (!reconsiderGateChecked) {
          check('changed-condition judgment unlocks next step', !await nextBeforeReconsider.isDisabled().catch(() => true))
          reconsiderGateChecked = true
        }
      }

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
    check('changed-condition activity encountered', reconsiderGateChecked)
    const challengeButtons = (await student.page.locator('button:visible').allInnerTexts()).join(' | ')
    const answer = student.page.locator('[data-question-choice]:visible').first()
    check('student challenge reached', await answer.isVisible().catch(() => false), challengeButtons.slice(0, 260))
    if (await answer.isVisible().catch(() => false)) {
      const choiceIdentity = await answer.evaluate(element => ({
        accessibleName: element.getAttribute('aria-label') || '',
        visibleText: element.innerText.trim().replace(/\s+/g, ' '),
      }))
      check('question choice uses matching numeric labels', /^1번\s+\S/.test(choiceIdentity.accessibleName) && /^1\s+/.test(choiceIdentity.visibleText), JSON.stringify(choiceIdentity))
      const structuredContext = await student.page.locator('[data-question-context]:visible').first().innerText().catch(() => '')
      check('document passage keeps readable field breaks', /\n제목\s*[:：]/.test(structuredContext) && /\n일시\s*[:：]/.test(structuredContext), structuredContext.replace(/\n/g, ' | ').slice(0, 240))
    }
    await student.page.screenshot({ path: `${outputDir}/student-challenge.png` })
    if (await answer.isVisible().catch(() => false)) {
      await answer.click()
      const confirmAnswer = student.page.getByRole('button', { name: /확인하기|정답·해설 확인/ }).first()
      if (await confirmAnswer.isVisible().catch(() => false)) await confirmAnswer.click()
      await student.page.waitForTimeout(700)
    }
    const liveText = await student.page.locator('[aria-live], [role="status"], [role="alert"]').allInnerTexts()
    check('student answer announced', liveText.some(text => /정답|오답|맞|다시/.test(text)), liveText.join(' | ').slice(0, 180))

    await student.page.getByRole('button', { name: '성장', exact: true }).click()
    const wrongCount = student.page.locator('[data-wrong-answer-count]')
    await wrongCount.waitFor({ state: 'visible', timeout: 10_000 })
    const wrongCountColor = await wrongCount.evaluate(element => getComputedStyle(element).color)
    check('wrong-answer header count has readable contrast', /rgba?\(255,\s*255,\s*255/.test(wrongCountColor), wrongCountColor)
    await student.page.screenshot({ path: `${outputDir}/student-wrong-answers.png` })
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

const teacherDesktop = await openTrial('teacher', { width: 1280, height: 720 })
try {
  await teacherDesktop.page.getByRole('button', { name: '수업 시작' }).click()
  await teacherDesktop.page.locator('.teacher-learning-preview.is-teaching').waitFor({ state: 'visible', timeout: 20_000 })
  await teacherDesktop.page.locator('.classroom-scenario-nav').waitFor({ state: 'visible', timeout: 20_000 })
  const collapsedPulse = await teacherDesktop.page.evaluate(() => {
    const stage = document.querySelector('.teacher-preview-stage')
    const toggle = document.querySelector('.classroom-live-pulse-toggle')
    return {
      stageWidth: Math.round(stage?.getBoundingClientRect().width || 0),
      toggleVisible: Boolean(toggle && toggle.getBoundingClientRect().width > 0),
      panelVisible: Boolean(document.querySelector('.classroom-live-pulse-panel')),
    }
  })
  check('desktop live pulse defaults to one collapsed button',
    collapsedPulse.toggleVisible && !collapsedPulse.panelVisible && collapsedPulse.stageWidth === 1280,
    JSON.stringify(collapsedPulse))

  await teacherDesktop.page.getByRole('button', { name: /라이브 펄스/ }).click()
  const livePulse = teacherDesktop.page.getByRole('dialog', { name: '라이브 펄스' })
  await livePulse.waitFor({ state: 'visible' })
  const pulseText = (await livePulse.innerText()).replace(/\s+/g, ' ').trim()
  check('live pulse overlay keeps all four connection states',
    ['연결됨 18', '화면 벗어남 3', '연결 확인 2', '미접속 5'].every(label => pulseText.includes(label)),
    pulseText)
  const pulseGeometry = await teacherDesktop.page.evaluate(() => {
    const stage = document.querySelector('.teacher-preview-stage')?.getBoundingClientRect()
    const panel = document.querySelector('.classroom-live-pulse-panel')?.getBoundingClientRect()
    return { stageWidth: Math.round(stage?.width || 0), panelRight: Math.round(panel?.right || 0), viewportWidth: innerWidth }
  })
  check('live pulse overlays instead of shrinking learning content',
    pulseGeometry.stageWidth === pulseGeometry.viewportWidth && pulseGeometry.panelRight <= pulseGeometry.viewportWidth,
    JSON.stringify(pulseGeometry))
  await teacherDesktop.page.screenshot({ path: `${outputDir}/teacher-live-pulse-1280.png` })

  await livePulse.getByRole('button', { name: '상세' }).click()
  const connectionDialog = teacherDesktop.page.getByRole('dialog', { name: '학생 연결 상세' })
  await connectionDialog.waitFor({ state: 'visible', timeout: 10_000 })
  const detailStudents = connectionDialog.locator('ul[aria-label="학생별 연결 상태"] > li')
  check('class connection detail shows all students on demand', await detailStudents.count() === 28,
    `students=${await detailStudents.count()}`)
  const sendFocus = connectionDialog.getByRole('button', { name: '현재 위치 다시 보내기' })
  check('teacher can explicitly resend student app location', await sendFocus.isVisible() && await sendFocus.isEnabled())
  await sendFocus.click()
  await teacherDesktop.page.waitForFunction(() => document.body.innerText.includes('현재 학습 위치를 전달했습니다.'), null, { timeout: 10_000 })
  await teacherDesktop.page.screenshot({ path: `${outputDir}/teacher-connection-detail-1280.png` })
  await connectionDialog.getByRole('button', { name: '학생 연결 상세 닫기' }).click()
  await connectionDialog.waitFor({ state: 'hidden' })

  await teacherDesktop.page.getByRole('button', { name: /라이브 펄스/ }).click()
  await livePulse.waitFor({ state: 'visible' })
  await livePulse.getByRole('button', { name: '열기' }).click()
  const responseDialog = teacherDesktop.page.getByRole('dialog', { name: '학생 응답' })
  await responseDialog.waitFor({ state: 'visible' })
  check('teacher can open current-scene student responses from live pulse',
    await responseDialog.locator('.classroom-response-list article').count() > 0,
    `responses=${await responseDialog.locator('.classroom-response-list article').count()}`)
  await teacherDesktop.page.screenshot({ path: `${outputDir}/teacher-responses-1280.png` })
  await responseDialog.getByRole('button', { name: '학생 응답 닫기' }).click()
  const measureClassroom = async viewport => {
    await teacherDesktop.page.setViewportSize(viewport)
    await teacherDesktop.page.waitForTimeout(300)
    return teacherDesktop.page.evaluate(() => {
      const stage = document.querySelector('.teacher-preview-stage')
      const zoom = document.querySelector('.classroom-zoom-control button:nth-child(2) span')?.textContent?.trim() || ''
      const projectionHeader = document.querySelector('.classroom-projection-header')?.getBoundingClientRect()
      const scenario = document.querySelector('.classroom-scenario-nav')?.getBoundingClientRect()
      return {
        zoom,
        projectionHeaderVisible: Boolean(projectionHeader?.width && projectionHeader.left >= 0 && projectionHeader.right <= innerWidth),
        scenarioVisible: Boolean(scenario?.width && scenario.left >= 0 && scenario.right <= innerWidth),
        clientWidth: stage?.clientWidth || 0,
        scrollWidth: stage?.scrollWidth || 0,
      }
    })
  }
  const classroom1280 = await measureClassroom({ width: 1280, height: 720 })
  const classroom1389 = await measureClassroom({ width: 1389, height: 868 })
  const fits = result => result.projectionHeaderVisible && result.scenarioVisible && result.scrollWidth <= result.clientWidth + 2
  check('desktop classroom starts at 100%', classroom1280.zoom === '100%' && classroom1389.zoom === '100%', JSON.stringify({ classroom1280, classroom1389 }))
  check('desktop classroom starts without horizontal clipping', fits(classroom1280) && fits(classroom1389), JSON.stringify({ classroom1280, classroom1389 }))
  const projectorTypography = await teacherDesktop.page.evaluate(() => {
    const visible = [...document.querySelectorAll('.teacher-classroom-content > .screen p, .teacher-classroom-content > .screen li, .teacher-classroom-content > .screen span, .teacher-classroom-content > .screen strong, .teacher-classroom-content > .screen b, .teacher-classroom-content > .screen small, .teacher-classroom-content > .screen figcaption, .teacher-classroom-content > .screen summary, .teacher-classroom-content > .screen button')]
      .filter(element => element.textContent?.trim() && element.getBoundingClientRect().width > 0)
    const sizes = visible.map(element => Number(getComputedStyle(element).fontSize.replace('px', '')))
    return { minimum: sizes.length ? Math.min(...sizes) : 0, count: sizes.length }
  })
  check('desktop classroom uses projector-readable body type', projectorTypography.count > 0 && projectorTypography.minimum >= 18,
    JSON.stringify(projectorTypography))
  await teacherDesktop.page.setViewportSize({ width: 1280, height: 720 })
  await teacherDesktop.page.screenshot({ path: `${outputDir}/teacher-classroom-1280.png` })

  await teacherDesktop.page.setViewportSize({ width: 390, height: 844 })
  await teacherDesktop.page.waitForTimeout(500)
  const phonePresence = await teacherDesktop.page.evaluate(() => {
    const panel = document.querySelector('.classroom-connection-panel')
    const summary = document.querySelector('[data-presence-summary]')
    return {
      height: Math.round(panel?.getBoundingClientRect().height || 0),
      summary: summary?.innerText.replace(/\s+/g, ' ').trim() || '',
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }
  })
  check('phone class connection stays compact and complete', phonePresence.height <= 50 &&
    phonePresence.documentWidth <= phonePresence.viewportWidth + 2 &&
    ['연결됨 18', '화면 벗어남 3', '연결 확인 2', '미접속 5'].every(label => phonePresence.summary.includes(label)),
  JSON.stringify(phonePresence))
  await teacherDesktop.page.getByRole('button', { name: /상세보기/ }).click()
  const phoneDialog = teacherDesktop.page.getByRole('dialog', { name: '학생 연결 상세' })
  await phoneDialog.waitFor({ state: 'visible' })
  const phoneDialogPosition = await phoneDialog.evaluate(element => {
    const dialog = element.getBoundingClientRect()
    const title = element.querySelector('h2')?.getBoundingClientRect()
    return { top: Math.round(dialog.top), titleTop: Math.round(title?.top || 0) }
  })
  check('phone connection detail clears top app chrome', phoneDialogPosition.top >= 44 && phoneDialogPosition.titleTop >= phoneDialogPosition.top + 10,
    JSON.stringify(phoneDialogPosition))
  await teacherDesktop.page.screenshot({ path: `${outputDir}/teacher-connection-detail-390.png` })
  await teacherDesktop.page.getByRole('button', { name: '학생 연결 상세 닫기' }).click()
  check('desktop classroom page errors', teacherDesktop.errors.length === 0, teacherDesktop.errors.join(' | ').slice(0, 180))
} finally {
  await teacherDesktop.context.close(); await teacherDesktop.browser.close()
}

const launchBrowser = await chromium.launch({ headless: true })
const launchContext = await launchBrowser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
const launchPage = await launchContext.newPage()
try {
  await launchPage.route('**/functions/v1/public-trial-session', async route => {
    await new Promise(resolve => setTimeout(resolve, 700))
    await route.continue()
  })
  await launchPage.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await launchPage.getByRole('button', { name: /교사 체험/ }).click()
  const launchFeedback = launchPage.getByRole('button', { name: /체험 화면 여는 중/ })
  check('teacher trial gives immediate launch feedback', await launchFeedback.isVisible().catch(() => false) && await launchFeedback.isDisabled().catch(() => false))
  await launchPage.locator('.teacher-mobile-tools').waitFor({ state: 'visible', timeout: 40_000 })

  const transitions = []
  for (const role of ['student', 'teacher', 'student']) {
    await launchPage.goto(`${APP}?trial=${role}&trial_nonce=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const target = role === 'student' ? launchPage.locator('.campus-home') : launchPage.locator('.teacher-mobile-tools')
    await target.waitFor({ state: 'visible', timeout: 40_000 }).catch(() => {})
    transitions.push({ role, visible: await target.isVisible().catch(() => false) })
  }
  check('student and teacher trials switch without clearing storage', transitions.every(item => item.visible), JSON.stringify(transitions))
} finally {
  await launchContext.close(); await launchBrowser.close()
}

const admin = await openTrial('school_admin')
try {
  check('school admin trial entered', await admin.page.locator('.school-admin-shell').isVisible())
  await scan(admin.page, 'admin-home')
  await zoomCheck(admin.page, 'admin-home')
  await admin.page.screenshot({ path: `${outputDir}/admin-home.png` })

  await admin.page.getByRole('button', { name: /정보 수정/ }).first().waitFor({ state: 'visible', timeout: 20_000 })
  await admin.page.getByRole('button', { name: /정보 수정/ }).first().click()
  await admin.page.locator('[data-admin-choice="role"] .admin-choice-trigger').click()
  const roleDialog = admin.page.getByRole('dialog', { name: '역할 선택' })
  const roleOptions = roleDialog.getByRole('option')
  const roleSurface = await roleDialog.evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }))
  check('admin role choices visible', await roleOptions.count() === 4, `options=${await roleOptions.count()}`)
  check('admin role choices use light surface', roleSurface.background === 'rgb(255, 255, 255)', JSON.stringify(roleSurface))
  await roleDialog.getByRole('button', { name: '역할 선택 닫기' }).click()

  await admin.page.locator('[data-admin-choice="school"] .admin-choice-trigger').click()
  const schoolDialog = admin.page.getByRole('dialog', { name: '소속 학교 선택' })
  const schoolOptions = schoolDialog.getByRole('option')
  check('admin school choices visible', await schoolOptions.count() > 1, `options=${await schoolOptions.count()}`)
  await schoolDialog.getByRole('button', { name: '소속 학교 선택 닫기' }).click()
  const adminVersion = await admin.page.locator('[data-app-version]').first().getAttribute('data-app-version')
  check('installed version is visible in administrator chrome', /^\d+\.\d+\.\d+$/.test(adminVersion || ''), adminVersion || '')
  await admin.page.screenshot({ path: `${outputDir}/admin-member-edit.png` })
  await admin.page.getByRole('button', { name: '취소' }).first().click()

  const memberFilters = await admin.page.evaluate(() => ({
    offices: document.querySelector('#member-office-filter')?.options.length ?? 0,
    schools: document.querySelector('#member-school-filter')?.options.length ?? 0,
    roles: document.querySelectorAll('.admin-role-filters button').length,
    result: document.querySelector('.admin-filter-result')?.textContent?.trim() ?? '',
  }))
  check('admin education office school role filters', memberFilters.offices > 1 && memberFilters.schools > 1 && memberFilters.roles === 5, JSON.stringify(memberFilters))
  await admin.page.getByRole('button', { name: /^학교관리자 \d+$/ }).click()
  const filteredRoles = await admin.page.locator('[data-member-role]').evaluateAll(elements => elements.map(element => element.dataset.memberRole))
  check('admin role filter narrows member list', filteredRoles.length > 0 && filteredRoles.every(role => role === 'school_admin'), filteredRoles.join(', '))
  await admin.page.screenshot({ path: `${outputDir}/admin-member-filters.png` })
} finally {
  await admin.context.close(); await admin.browser.close()
}

writeFileSync('output/adversarial-ui-report.json', `${JSON.stringify(report, null, 2)}\n`)
const failures = report.checks.filter(item => !item.pass)
console.log(`UI integrity checks: ${report.checks.length - failures.length}/${report.checks.length} passed`)
if (failures.length) process.exitCode = 1
