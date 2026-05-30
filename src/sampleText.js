// Render text (or emoji) to an offscreen canvas, then sample the lit pixels into
// a cloud of 2D points normalized to world space. Longer multi-word phrases are
// wrapped onto two lines so the letters stay big and legible instead of being
// squeezed into thin, blurry strokes.

const FONT = '"Segoe UI", system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

export function sampleText(text, { worldWidth = 11, count = 26000 } = {}) {
  const clean = (text || ' ').slice(0, 24)

  const padding = 70
  const maxWidth = 1900
  const maxHeight = 640

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  let fontSize = 250
  const setFont = (fs) => { ctx.font = `900 ${fs}px ${FONT}` }
  setFont(fontSize)

  const maxTextW = maxWidth - padding * 2
  const words = clean.split(/\s+/).filter(Boolean)

  // Wrap to two balanced lines when a multi-word phrase is too wide for one line.
  let lines = [clean]
  if (words.length >= 2 && ctx.measureText(clean).width > maxTextW * 0.7) {
    let best = [clean]
    let bestDiff = Infinity
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ')
      const b = words.slice(i).join(' ')
      const diff = Math.abs(ctx.measureText(a).width - ctx.measureText(b).width)
      if (diff < bestDiff) { bestDiff = diff; best = [a, b] }
    }
    lines = best
  }

  const widthOf = () => Math.max(...lines.map((l) => ctx.measureText(l).width || fontSize))

  // Shrink to fit the width, then the height.
  let widest = widthOf()
  if (widest > maxTextW) {
    fontSize = Math.floor((fontSize * maxTextW) / widest)
    setFont(fontSize)
    widest = widthOf()
  }
  let lineH = fontSize * 1.12
  if (lines.length * lineH + padding > maxHeight) {
    fontSize = Math.floor((maxHeight - padding) / (lines.length * 1.12))
    setFont(fontSize)
    lineH = fontSize * 1.12
    widest = widthOf()
  }

  const width = Math.min(maxWidth, Math.max(220, Math.ceil(widest + padding * 2)))
  const height = Math.ceil(lines.length * lineH + padding)
  canvas.width = width
  canvas.height = height

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  setFont(fontSize)
  const startY = height / 2 - ((lines.length - 1) * lineH) / 2
  lines.forEach((line, i) => ctx.fillText(line, width / 2, startY + i * lineH))

  const data = ctx.getImageData(0, 0, width, height).data

  const worldHeight = (worldWidth * height) / width
  const candX = []
  const candY = []
  const step = 2
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] > 130) {
        candX.push(x)
        candY.push(y)
      }
    }
  }

  const total = candX.length
  const out = new Float32Array(count * 2)
  if (total === 0) return out

  const idx = new Int32Array(total)
  for (let i = 0; i < total; i++) idx[i] = i
  for (let i = total - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t
  }

  for (let i = 0; i < count; i++) {
    const k = idx[i % total]
    const jx = (Math.random() - 0.5) * step
    const jy = (Math.random() - 0.5) * step
    out[i * 2] = ((candX[k] + jx) / width - 0.5) * worldWidth
    out[i * 2 + 1] = -((candY[k] + jy) / height - 0.5) * worldHeight
  }
  return out
}
