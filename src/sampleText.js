// Render text (or emoji) to an offscreen canvas, then sample the lit pixels into
// a cloud of 2D points normalized to world space. Returns a Float32Array of
// [x, y] pairs, evenly distributed across the whole glyph set so it stays
// legible regardless of length.

const FONT = '"Segoe UI", system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

export function sampleText(text, { worldWidth = 11, count = 26000 } = {}) {
  const clean = (text || ' ').slice(0, 24)

  const height = 300
  const padding = 80
  const maxWidth = 1900

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  let fontSize = 230
  ctx.font = `900 ${fontSize}px ${FONT}`
  let metrics = ctx.measureText(clean)
  let textWidth = metrics.width || fontSize

  if (textWidth + padding * 2 > maxWidth) {
    fontSize = Math.floor((fontSize * (maxWidth - padding * 2)) / textWidth)
    ctx.font = `900 ${fontSize}px ${FONT}`
    metrics = ctx.measureText(clean)
    textWidth = metrics.width || fontSize
  }

  const width = Math.min(maxWidth, Math.max(220, Math.ceil(textWidth + padding * 2)))
  canvas.width = width
  canvas.height = height

  // Transparent background + alpha sampling so colored emoji are detected too.
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${fontSize}px ${FONT}`
  ctx.fillText(clean, width / 2, height / 2 + fontSize * 0.04)

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
  if (total === 0) return out // all at origin; nothing to draw

  // Shuffle indices so the chosen particles cover the whole glyph set uniformly
  // instead of filling from the top down.
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
