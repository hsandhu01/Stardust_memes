// Render text to an offscreen canvas, then sample the lit pixels into a cloud of
// 2D points normalized to world space. Returns a Float32Array of [x, y] pairs,
// evenly distributed across the whole word (so letters stay legible regardless
// of how long the text is).

export function sampleText(text, { worldWidth = 11, count = 26000 } = {}) {
  const clean = (text || ' ').slice(0, 24)

  const height = 300
  const padding = 80
  const maxWidth = 1900

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  let fontSize = 230
  ctx.font = `900 ${fontSize}px "Segoe UI", system-ui, sans-serif`
  let metrics = ctx.measureText(clean)
  let textWidth = metrics.width

  if (textWidth + padding * 2 > maxWidth) {
    fontSize = Math.floor((fontSize * (maxWidth - padding * 2)) / textWidth)
    ctx.font = `900 ${fontSize}px "Segoe UI", system-ui, sans-serif`
    metrics = ctx.measureText(clean)
    textWidth = metrics.width
  }

  const width = Math.min(maxWidth, Math.ceil(textWidth + padding * 2))
  canvas.width = width
  canvas.height = height

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${fontSize}px "Segoe UI", system-ui, sans-serif`
  ctx.fillText(clean, width / 2, height / 2 + fontSize * 0.04)

  const data = ctx.getImageData(0, 0, width, height).data

  // Collect every lit pixel (fine step for a rich candidate pool).
  const worldHeight = (worldWidth * height) / width
  const candX = []
  const candY = []
  const step = 2
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4] > 130) {
        candX.push(x)
        candY.push(y)
      }
    }
  }

  const total = candX.length
  if (total === 0) return new Float32Array([0, 0])

  // Fisher-Yates shuffle of indices so the chosen particles cover the whole
  // word uniformly instead of filling from the top down.
  const idx = new Int32Array(total)
  for (let i = 0; i < total; i++) idx[i] = i
  for (let i = total - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t
  }

  const out = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const k = idx[i % total]
    // sub-pixel jitter so the grid sampling doesn't read as a grid
    const jx = (Math.random() - 0.5) * step
    const jy = (Math.random() - 0.5) * step
    out[i * 2] = ((candX[k] + jx) / width - 0.5) * worldWidth
    out[i * 2 + 1] = -((candY[k] + jy) / height - 0.5) * worldHeight
  }
  return out
}
