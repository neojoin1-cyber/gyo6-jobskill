import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
for (const size of [192, 512]) {
  const source = path.join(root, 'public', 'icons', `icon-${size}.png`)
  const target = path.join(root, 'public', 'icons', `icon-${size}-maskable.png`)
  const safeSize = Math.round(size * 0.72)
  const inset = Math.floor((size - safeSize) / 2)
  await sharp(source)
    .resize(safeSize, safeSize, { fit: 'contain' })
    .extend({
      top: inset,
      bottom: size - safeSize - inset,
      left: inset,
      right: size - safeSize - inset,
      background: '#4F46E5',
    })
    .png()
    .toFile(target)
  console.log(`maskable icon generated: ${path.relative(root, target)}`)
}
