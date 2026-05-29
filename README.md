# ✦ Stardust

Type anything and watch ~26,000 glowing particles swarm into formation to spell it — floating in 3D, scattering away from your cursor, and pulsing to music.

**Live:** https://hsandhu01.github.io/Stardust_memes/

## Features

- **Type anything** — names, words, emoji, CJK characters. The particles reform into the exact shape.
- **Cursor force** — move through the field and the stars scatter, then settle back.
- **5 color themes** — Aurora, Ember, Bloom, Mint, Gold.
- **Shareable links** — every creation has its own URL (`?text=Harry&theme=2`); the link reopens the exact scene.
- **Save as image** — one-click PNG.
- **Record the morph** — capture the reform animation as a WebM video.
- **Music reactive** — enable the mic and the particles pulse to whatever's playing.
- **Mobile ready** — touch-driven, with an adaptive particle count.

## Run locally

```bash
npm install
npm run dev
```

Open the printed `localhost` URL.

## Build

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build
```

## Deploy

Pushing to `main` triggers a GitHub Actions workflow that builds the site and
publishes it to GitHub Pages. Enable Pages once under
**Settings → Pages → Source: GitHub Actions**.

## Stack

React · three.js · @react-three/fiber · Vite

## How it works

1. Text is rendered to an offscreen 2D canvas, then its lit pixels are sampled
   into a point cloud (`src/sampleText.js`).
2. Each particle springs toward its target pixel while reacting to the cursor,
   ambient noise, and the audio analyser (`src/Particles.jsx`).
3. Rendering uses additive-blended glow sprites — no post-processing pass — so it
   stays fast even at tens of thousands of points.

## License

MIT
