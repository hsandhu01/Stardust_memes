import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Particles from './Particles.jsx'

const THEMES = [
  { name: 'Aurora', colors: ['#00e5ff', '#a96bff'] },
  { name: 'Ember', colors: ['#ff5e3a', '#ffd166'] },
  { name: 'Bloom', colors: ['#ff4ecd', '#7afcff'] },
  { name: 'Mint', colors: ['#00ffa3', '#0a84ff'] },
  { name: 'Gold', colors: ['#fff1a8', '#ff8a00'] },
]

const PROMPTS = ['hello', 'dream', 'love', '你好', '2026', 'wish', 'magic']

function readURL() {
  const p = new URLSearchParams(window.location.search)
  const text = (p.get('text') || 'stardust').slice(0, 24)
  let theme = parseInt(p.get('theme') ?? '0', 10)
  if (Number.isNaN(theme) || theme < 0 || theme >= THEMES.length) theme = 0
  return { text, theme }
}

export default function App() {
  const initial = useRef(readURL()).current
  const [text, setText] = useState(initial.text)
  const [draft, setDraft] = useState(initial.text)
  const [themeIdx, setThemeIdx] = useState(initial.theme)
  const [micOn, setMicOn] = useState(false)
  const [recording, setRecording] = useState(false)
  const [toast, setToast] = useState('')
  const [burst, setBurst] = useState(0)

  const glRef = useRef(null)
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)
  const micStreamRef = useRef(null)

  // Keep the URL in sync so any view is a shareable link.
  useEffect(() => {
    const p = new URLSearchParams()
    p.set('text', text)
    p.set('theme', String(themeIdx))
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`)
  }, [text, themeIdx])

  const flash = useCallback((msg) => {
    setToast(msg)
    window.clearTimeout(flash._t)
    flash._t = window.setTimeout(() => setToast(''), 2200)
  }, [])

  const commit = useCallback((value) => {
    const v = (value ?? draft).trim()
    setText(v.length ? v : ' ')
  }, [draft])

  const copyLink = useCallback(async () => {
    const p = new URLSearchParams({ text, theme: String(themeIdx) })
    const url = `${window.location.origin}${window.location.pathname}?${p.toString()}`
    try {
      await navigator.clipboard.writeText(url)
      flash('Link copied — share it ✦')
    } catch {
      flash(url)
    }
  }, [text, themeIdx, flash])

  const saveImage = useCallback(() => {
    const gl = glRef.current
    if (!gl) return
    requestAnimationFrame(() => {
      const url = gl.domElement.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `stardust-${text.replace(/[^a-z0-9]/gi, '_') || 'art'}.png`
      a.click()
      flash('Image saved ✦')
    })
  }, [text, flash])

  const toggleMic = useCallback(async () => {
    if (micOn) {
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
      analyserRef.current = null
      setMicOn(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      src.connect(analyser)
      analyserRef.current = analyser
      micStreamRef.current = stream
      setMicOn(true)
      flash('Listening — play some music ♫')
    } catch {
      flash('Microphone access denied')
    }
  }, [micOn, flash])

  // Record the reform animation to a WebM video.
  const recordVideo = useCallback(() => {
    const gl = glRef.current
    if (!gl || recording) return
    const canvas = gl.domElement
    if (!canvas.captureStream) { flash('Recording not supported here'); return }

    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    const mimeType = types.find((t) => window.MediaRecorder?.isTypeSupported(t))
    if (!mimeType) { flash('Recording not supported here'); return }

    const stream = canvas.captureStream(60)
    const chunks = []
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 })
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stardust-${text.replace(/[^a-z0-9]/gi, '_') || 'art'}.webm`
      a.click()
      URL.revokeObjectURL(url)
      setRecording(false)
      flash('Video saved ✦')
    }

    setRecording(true)
    flash('Recording the morph…')
    setBurst((b) => b + 1) // explode, then let it reform on camera
    rec.start()
    window.setTimeout(() => rec.state !== 'inactive' && rec.stop(), 4200)
  }, [recording, text, flash])

  const theme = THEMES[themeIdx].colors

  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 14], fov: 50 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => { glRef.current = gl }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#02030a']} />
        <Particles text={text} theme={theme} analyserRef={analyserRef} burst={burst} />
      </Canvas>

      <div style={styles.brand}>✦ STARDUST</div>
      <div style={styles.hint}>move your cursor through the stars</div>

      <div style={styles.panel}>
        <div style={styles.inputRow}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            placeholder="type anything…"
            maxLength={24}
            spellCheck={false}
            autoFocus
            style={styles.input}
          />
          <button style={styles.go} onClick={() => commit()}>form ✦</button>
        </div>

        <div style={styles.prompts}>
          {PROMPTS.map((p) => (
            <button key={p} style={styles.chip} onClick={() => { setDraft(p); commit(p) }}>{p}</button>
          ))}
        </div>

        <div style={styles.bottomRow}>
          <div style={styles.themes}>
            {THEMES.map((t, i) => (
              <button
                key={t.name}
                title={t.name}
                onClick={() => setThemeIdx(i)}
                style={{
                  ...styles.swatch,
                  background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})`,
                  outline: i === themeIdx ? '2px solid #fff' : '2px solid transparent',
                  transform: i === themeIdx ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>

          <div style={styles.actions}>
            <button style={styles.iconBtn} onClick={copyLink} title="Copy shareable link">link</button>
            <button
              style={{ ...styles.iconBtn, ...(micOn ? styles.iconActive : null) }}
              onClick={toggleMic}
              title="React to music"
            >{micOn ? '♫ on' : '♫ mic'}</button>
            <button style={styles.iconBtn} onClick={saveImage} title="Save PNG">image</button>
            <button
              style={{ ...styles.iconBtn, ...(recording ? styles.recActive : null) }}
              onClick={recordVideo}
              disabled={recording}
              title="Record the morph as video"
            >{recording ? '● rec' : 'video'}</button>
          </div>
        </div>
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </>
  )
}

const glass = {
  background: 'rgba(12, 14, 28, 0.55)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.10)',
}

const styles = {
  brand: {
    position: 'fixed', top: 22, left: 26, zIndex: 10,
    color: '#fff', fontWeight: 800, letterSpacing: '0.22em',
    fontSize: 14, opacity: 0.85, userSelect: 'none',
    textShadow: '0 0 18px rgba(120,180,255,0.6)',
  },
  hint: {
    position: 'fixed', top: 24, right: 26, zIndex: 10, color: 'rgba(255,255,255,0.45)',
    fontSize: 12, letterSpacing: '0.04em', userSelect: 'none',
  },
  panel: {
    position: 'fixed', left: '50%', bottom: 'max(18px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)', zIndex: 10, width: 'min(580px, calc(100vw - 24px))',
    padding: 14, borderRadius: 20, ...glass,
    display: 'flex', flexDirection: 'column', gap: 12,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  inputRow: { display: 'flex', gap: 8 },
  input: {
    flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
    padding: '12px 14px', color: '#fff', fontSize: 16, outline: 'none', fontWeight: 600,
  },
  go: {
    background: 'linear-gradient(135deg,#7afcff,#a96bff)', color: '#04060f',
    border: 'none', borderRadius: 12, padding: '0 18px', fontWeight: 800,
    fontSize: 15, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  prompts: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  chip: {
    background: 'rgba(255,255,255,0.06)', color: '#cfe0ff',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999,
    padding: '6px 12px', fontSize: 13, cursor: 'pointer',
  },
  bottomRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, flexWrap: 'wrap',
  },
  themes: { display: 'flex', gap: 9 },
  swatch: {
    width: 26, height: 26, borderRadius: '50%', border: 'none',
    cursor: 'pointer', transition: 'transform 0.15s ease', flex: '0 0 auto',
  },
  actions: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  iconBtn: {
    background: 'rgba(255,255,255,0.08)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10,
    padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  iconActive: { background: 'linear-gradient(135deg,#00ffa3,#0a84ff)', color: '#04060f', border: 'none' },
  recActive: { background: 'linear-gradient(135deg,#ff5e3a,#ff2d55)', color: '#fff', border: 'none' },
  toast: {
    position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
    ...glass, color: '#fff', padding: '10px 16px', borderRadius: 999, fontSize: 14,
    fontWeight: 600, maxWidth: 'calc(100vw - 32px)', textAlign: 'center',
  },
}
