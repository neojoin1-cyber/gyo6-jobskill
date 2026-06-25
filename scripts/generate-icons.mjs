/**
 * generate-icons.mjs
 * SVG → PWA 아이콘 4종 + Android 런처 아이콘 전 사이즈 생성
 * 실행: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root  = join(__dir, '..')
const svg   = readFileSync(join(root, 'public/icons/icon-source.svg'))

// ── PWA 아이콘 ────────────────────────────────────────────────────
const PWA = [
  { out: 'public/icons/icon-192.png',          size: 192 },
  { out: 'public/icons/icon-512.png',          size: 512 },
  { out: 'public/icons/icon-192-maskable.png', size: 192 },
  { out: 'public/icons/icon-512-maskable.png', size: 512 },
]

console.log('\n📱 PWA 아이콘 생성...')
for (const cfg of PWA) {
  await sharp(svg).resize(cfg.size, cfg.size).png().toFile(join(root, cfg.out))
  console.log(`  ✓ ${cfg.out}`)
}

// ── Android 런처 아이콘 ───────────────────────────────────────────
// size: ic_launcher.png 크기 / fgSize: ic_launcher_foreground.png 크기 (108dp 기준)
const DENSITIES = [
  { d: 'ldpi',    size: 36,  fgSize: 81  },
  { d: 'mdpi',    size: 48,  fgSize: 108 },
  { d: 'hdpi',    size: 72,  fgSize: 162 },
  { d: 'xhdpi',   size: 96,  fgSize: 216 },
  { d: 'xxhdpi',  size: 144, fgSize: 324 },
  { d: 'xxxhdpi', size: 192, fgSize: 432 },
]

const RES = join(root, 'android/app/src/main/res')
const BG_COLOR = { r: 91, g: 33, b: 182 } // #5B21B6

console.log('\n🤖 Android 아이콘 생성...')
for (const { d, size, fgSize } of DENSITIES) {
  const dir = join(RES, `mipmap-${d}`)

  // ic_launcher.png
  await sharp(svg).resize(size, size).png().toFile(join(dir, 'ic_launcher.png'))

  // ic_launcher_round.png (동일 이미지 — launcher가 원형 마스크 적용)
  await sharp(svg).resize(size, size).png().toFile(join(dir, 'ic_launcher_round.png'))

  // ic_launcher_foreground.png — 중앙 60% 영역에 아이콘, 외곽 투명
  const contentSize = Math.round(fgSize * 0.6)
  const pad = Math.round((fgSize - contentSize) / 2)
  const iconBuf = await sharp(svg).resize(contentSize, contentSize).png().toBuffer()
  await sharp(iconBuf)
    .extend({ top: pad, bottom: pad, left: pad, right: pad,
              background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(dir, 'ic_launcher_foreground.png'))

  // ic_launcher_background.png — 단색 배경
  await sharp({ create: { width: fgSize, height: fgSize, channels: 3, background: BG_COLOR } })
    .png()
    .toFile(join(dir, 'ic_launcher_background.png'))

  console.log(`  ✓ mipmap-${d} (${size}px / fg ${fgSize}px)`)
}

console.log('\n✅ 아이콘 생성 완료!')
