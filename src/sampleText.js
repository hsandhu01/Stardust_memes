// Render text to an offscreen canvas, then sample the lit pixels into a cloud of
// 2D points normalized to world space. Returns a Float32Array of [x, y] pairs.

export function sampleText(text, { worldWidth = 11, density = 1 } = {}) {
  const clean = (text || ' ').slice(0, 24)

  const height = 280
  const padding = 80
  const maxWidth = 1900

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  // Pick a font size that makes the text fill the canvas nicely.
  let fontSize = 210
  ctx.font = `900 ${fontSize}px "Segoe UI", system-ui, sans-serif`
  let metrics = ctx.measureText(clean)
  let textWidth = metrics.width

  if (textWidth + padding * 2 > maxWidth) {
    fontSize = Math.floor(fontSize * (maxWidth - padding * 2) / textWidth)
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

  // Sample with a step so we don't get more points than we need.
  const step = Math.max(1, Math.round(3 / density))
  const pts = []
  const worldHeight = (worldWidth * height) / width

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const alpha = data[(y * width + x) * 4] // red channel == brightness here
      if (alpha > 130) {
        // tiny jitter so the grid sampling doesn't look like a grid
        const jx = (Math.random() - 0.5) * step
        const jy = (Math.random() - 0.5) * step
        const wx = ((x + jx) / width - 0.5) * worldWidth
        const wy = -((y + jy) / height - 0.5) * worldHeight
        pts.push(wx, wy)
      }
    }
  }

  if (pts.length === 0) {
    // fallback single point so nothing breaks on empty input
    pts.push(0, 0)
  }

  return new Float32Array(pts)
}
