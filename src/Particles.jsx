import React, { useMemo, useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleText } from './sampleText.js'
import { parsePhrases, HOLD_MS } from './phrases.js'

const isMobile = typeof window !== 'undefined' &&
  (window.matchMedia('(max-width: 768px)').matches || /Mobi|Android/i.test(navigator.userAgent))
const COUNT = isMobile ? 14000 : 30000
const SPAN = isMobile ? 8.5 : 11

function makeSprite() {
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0.0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.42, 'rgba(255,255,255,0.35)')
  g.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function Particles({ text, theme, analyserRef, burst, restart, onPhrase }) {
  const pointsRef = useRef()
  const groupRef = useRef()
  const matRef = useRef()
  const { size, camera } = useThree()

  const sprite = useMemo(() => makeSprite(), [])
  const baseSize = isMobile ? 0.1 : 0.085

  const state = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const targets = new Float32Array(COUNT * 3)
    const velocities = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const seed = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      const r = 9 + Math.random() * 9
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(ph) * Math.cos(th)
      positions[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th)
      positions[i * 3 + 2] = r * Math.cos(ph)
      seed[i] = Math.random()
    }
    return { positions, targets, velocities, colors, seed }
  }, [])

  const pointer = useRef(new THREE.Vector3(999, 999, 0))
  const pointerActive = useRef(false)
  const audioLevel = useRef(0)
  const themeRef = useRef(theme)
  const cloudsRef = useRef([])
  const phase = useRef({ i: 0, t: HOLD_MS / 1000 })

  // Write one phrase's point cloud into the targets + recolor for the theme.
  const applyCloud = useCallback((i) => {
    const cloud = cloudsRef.current[i]
    if (!cloud) return
    const { targets, colors, velocities, seed } = state
    const a = new THREE.Color(themeRef.current[0])
    const b = new THREE.Color(themeRef.current[1])
    const tmp = new THREE.Color()
    for (let n = 0; n < COUNT; n++) {
      const tx = cloud[n * 2]
      const ty = cloud[n * 2 + 1]
      targets[n * 3] = tx
      targets[n * 3 + 1] = ty
      targets[n * 3 + 2] = (seed[n] - 0.5) * 0.7
      velocities[n * 3] += (Math.random() - 0.5) * 0.6
      velocities[n * 3 + 1] += (Math.random() - 0.5) * 0.6
      const u = THREE.MathUtils.clamp(tx / SPAN + 0.5, 0, 1)
      tmp.copy(a).lerp(b, u)
      const spark = 0.75 + seed[n] * 0.6
      colors[n * 3] = tmp.r * spark
      colors[n * 3 + 1] = tmp.g * spark
      colors[n * 3 + 2] = tmp.b * spark
    }
    if (pointsRef.current) pointsRef.current.geometry.attributes.color.needsUpdate = true
  }, [state])

  // Rebuild the sequence of clouds whenever the text changes.
  useEffect(() => {
    const phrases = parsePhrases(text)
    cloudsRef.current = phrases.map((p) => sampleText(p, { worldWidth: SPAN, count: COUNT }))
    phase.current = { i: 0, t: HOLD_MS / 1000 }
    applyCloud(0)
    onPhrase?.(0, phrases.length)
  }, [text, applyCloud, onPhrase])

  // Recolor in place when the theme changes.
  useEffect(() => {
    themeRef.current = theme
    applyCloud(phase.current.i)
  }, [theme, applyCloud])

  // Restart the message sequence from the first phrase (used before recording).
  useEffect(() => {
    if (!restart) return
    phase.current = { i: 0, t: HOLD_MS / 1000 }
    applyCloud(0)
    onPhrase?.(0, cloudsRef.current.length)
  }, [restart, applyCloud, onPhrase])

  // Explode outward on "burst" (used to capture the reform on video).
  useEffect(() => {
    if (!burst) return
    const { positions, velocities } = state
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      const dx = positions[ix], dy = positions[ix + 1], dz = positions[ix + 2]
      const len = Math.hypot(dx, dy, dz) || 1
      const f = 14 + Math.random() * 10
      velocities[ix] += (dx / len) * f
      velocities[ix + 1] += (dy / len) * f
      velocities[ix + 2] += (dz / len) * f
    }
  }, [burst, state])

  // Track the pointer and project onto the world plane.
  useEffect(() => {
    const onMove = (e) => {
      const t = e.touches ? e.touches[0] : e
      if (!t) return
      const nx = (t.clientX / window.innerWidth) * 2 - 1
      const ny = -(t.clientY / window.innerHeight) * 2 + 1
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z
      const halfW = halfH * (size.width / size.height)
      pointer.current.set(nx * halfW, ny * halfH, 0)
      pointerActive.current = true
    }
    const onLeave = () => { pointerActive.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [camera, size])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(state.positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(state.colors, 3))
    return g
  }, [state])

  const freqData = useRef(null)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const { positions, targets, velocities } = state
    const px = pointer.current.x
    const py = pointer.current.y
    const active = pointerActive.current
    const t = performance.now() * 0.001

    // advance the message sequence
    if (cloudsRef.current.length > 1) {
      phase.current.t -= dt
      if (phase.current.t <= 0) {
        phase.current.i = (phase.current.i + 1) % cloudsRef.current.length
        phase.current.t = HOLD_MS / 1000
        applyCloud(phase.current.i)
        onPhrase?.(phase.current.i, cloudsRef.current.length)
      }
    }

    // audio level (smoothed)
    const analyser = analyserRef && analyserRef.current
    let lvlTarget = 0
    if (analyser) {
      if (!freqData.current || freqData.current.length !== analyser.frequencyBinCount) {
        freqData.current = new Uint8Array(analyser.frequencyBinCount)
      }
      analyser.getByteFrequencyData(freqData.current)
      let sum = 0
      const nb = Math.min(freqData.current.length, 48)
      for (let k = 0; k < nb; k++) sum += freqData.current[k]
      lvlTarget = Math.min(1, (sum / nb / 255) * 1.8)
    }
    audioLevel.current += (lvlTarget - audioLevel.current) * 0.18
    const al = audioLevel.current

    const stiffness = 6.5
    const damping = Math.pow(0.0006, dt)
    const repelR2 = 2.4 * 2.4
    const pulse = al * 3.2

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      const iy = ix + 1
      const iz = ix + 2

      velocities[ix] += (targets[ix] - positions[ix]) * stiffness * dt
      velocities[iy] += (targets[iy] - positions[iy]) * stiffness * dt
      velocities[iz] += (targets[iz] - positions[iz]) * stiffness * dt

      if (active) {
        const dx = positions[ix] - px
        const dy = positions[iy] - py
        const d2 = dx * dx + dy * dy
        if (d2 < repelR2 && d2 > 0.0001) {
          const f = (1 - d2 / repelR2) * 26 * dt
          const inv = 1 / Math.sqrt(d2)
          velocities[ix] += dx * inv * f
          velocities[iy] += dy * inv * f
        }
      }

      const s = state.seed[i]
      velocities[ix] += Math.sin(t * 0.7 + s * 30) * 0.006
      velocities[iy] += Math.cos(t * 0.6 + s * 40) * 0.006
      velocities[iz] += Math.sin(t * 0.5 + s * 50) * 0.006

      if (pulse > 0.01) {
        velocities[ix] += targets[ix] * pulse * dt * 0.6
        velocities[iy] += targets[iy] * pulse * dt * 0.6
      }

      velocities[ix] *= damping
      velocities[iy] *= damping
      velocities[iz] *= damping

      positions[ix] += velocities[ix] * dt
      positions[iy] += velocities[iy] * dt
      positions[iz] += velocities[iz] * dt
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
    if (matRef.current) matRef.current.size = baseSize * (1 + al * 1.6)

    if (groupRef.current) {
      const tx = active ? pointer.current.y * 0.03 : 0
      const ty = active ? pointer.current.x * 0.03 : 0
      groupRef.current.rotation.x += (tx - groupRef.current.rotation.x) * 0.04
      groupRef.current.rotation.y += (ty - groupRef.current.rotation.y) * 0.04
      groupRef.current.scale.setScalar(1 + al * 0.06)
    }
  })

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} geometry={geom}>
        <pointsMaterial
          ref={matRef}
          size={baseSize}
          map={sprite}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  )
}
