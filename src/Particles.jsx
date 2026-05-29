import React, { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleText } from './sampleText.js'

const isMobile = typeof window !== 'undefined' &&
  (window.matchMedia('(max-width: 768px)').matches || /Mobi|Android/i.test(navigator.userAgent))
const COUNT = isMobile ? 12000 : 26000

// Soft round glow sprite so each particle reads as a little star, not a square.
function makeSprite() {
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0.0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.25)')
  g.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function Particles({ text, theme, analyserRef, burst }) {
  const pointsRef = useRef()
  const groupRef = useRef()
  const matRef = useRef()
  const { size, camera } = useThree()

  const sprite = useMemo(() => makeSprite(), [])
  const baseSize = isMobile ? 0.1 : 0.085

  // Persistent per-particle state.
  const state = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const targets = new Float32Array(COUNT * 3)
    const velocities = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const seed = new Float32Array(COUNT)

    for (let i = 0; i < COUNT; i++) {
      const r = 9 + Math.random() * 9
      const t = Math.random() * Math.PI * 2
      const p = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(p) * Math.cos(t)
      positions[i * 3 + 1] = r * Math.sin(p) * Math.sin(t)
      positions[i * 3 + 2] = r * Math.cos(p)
      seed[i] = Math.random()
    }
    return { positions, targets, velocities, colors, seed }
  }, [])

  const pointer = useRef(new THREE.Vector3(999, 999, 0))
  const pointerActive = useRef(false)
  const audioLevel = useRef(0)

  // Rebuild targets whenever the text changes.
  useEffect(() => {
    const cloud = sampleText(text, { worldWidth: isMobile ? 8.5 : 11 })
    const m = cloud.length / 2
    const { targets } = state
    for (let i = 0; i < COUNT; i++) {
      const j = (i % m) * 2
      targets[i * 3] = cloud[j]
      targets[i * 3 + 1] = cloud[j + 1]
      targets[i * 3 + 2] = (state.seed[i] - 0.5) * 1.6
      state.velocities[i * 3] += (Math.random() - 0.5) * 0.5
      state.velocities[i * 3 + 1] += (Math.random() - 0.5) * 0.5
    }
  }, [text, state])

  // Explode outward on "burst" (used to capture the reform animation on video).
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

  // Recolor whenever theme changes.
  useEffect(() => {
    const { colors, targets, seed } = state
    const a = new THREE.Color(theme[0])
    const b = new THREE.Color(theme[1])
    const tmp = new THREE.Color()
    const span = isMobile ? 8.5 : 11
    for (let i = 0; i < COUNT; i++) {
      const t = THREE.MathUtils.clamp(targets[i * 3] / span + 0.5, 0, 1)
      tmp.copy(a).lerp(b, t)
      const spark = 0.75 + seed[i] * 0.6
      colors[i * 3] = tmp.r * spark
      colors[i * 3 + 1] = tmp.g * spark
      colors[i * 3 + 2] = tmp.b * spark
    }
    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.color.needsUpdate = true
    }
  }, [theme, state, text])

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

    // --- audio level (smoothed) ---
    const analyser = analyserRef && analyserRef.current
    let target = 0
    if (analyser) {
      if (!freqData.current || freqData.current.length !== analyser.frequencyBinCount) {
        freqData.current = new Uint8Array(analyser.frequencyBinCount)
      }
      analyser.getByteFrequencyData(freqData.current)
      let sum = 0
      const n = Math.min(freqData.current.length, 48) // emphasize bass/mids
      for (let k = 0; k < n; k++) sum += freqData.current[k]
      target = Math.min(1, (sum / n / 255) * 1.8)
    }
    audioLevel.current += (target - audioLevel.current) * 0.18
    const al = audioLevel.current

    const stiffness = 5.0
    const damping = Math.pow(0.0009, dt)
    const repelR2 = 2.4 * 2.4
    const pulse = al * 3.2 // outward kick on the beat

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
      velocities[ix] += Math.sin(t * 0.7 + s * 30) * 0.012
      velocities[iy] += Math.cos(t * 0.6 + s * 40) * 0.012
      velocities[iz] += Math.sin(t * 0.5 + s * 50) * 0.012

      // music push: drive each particle outward from its target on loud frames
      if (pulse > 0.01) {
        velocities[ix] += (targets[ix] === 0 ? (s - 0.5) : targets[ix]) * pulse * dt * 0.6
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

    if (matRef.current) {
      matRef.current.size = baseSize * (1 + al * 1.6)
    }

    if (groupRef.current) {
      const tx = active ? pointer.current.y * 0.03 : 0
      const ty = active ? pointer.current.x * 0.03 : 0
      groupRef.current.rotation.x += (tx - groupRef.current.rotation.x) * 0.04
      groupRef.current.rotation.y += (ty - groupRef.current.rotation.y) * 0.04
      const sc = 1 + al * 0.06
      groupRef.current.scale.setScalar(sc)
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
