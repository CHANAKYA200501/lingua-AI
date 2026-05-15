/**
 * JARVIS-style sound effects generator using Web Audio API
 * Creates synthetic sounds without needing audio files
 */

let audioCtx = null

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

export function playActivateSound() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(400, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.15)
  osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.25)
  gain.gain.setValueAtTime(0.12, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.35)
}

export function playDeactivateSound() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.2)
  gain.gain.setValueAtTime(0.1, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.3)
}

export function playSuccessSound() {
  const ctx = getCtx()
  const times = [0, 0.1, 0.2]
  const freqs = [523, 659, 784]
  times.forEach((t, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freqs[i], ctx.currentTime + t)
    gain.gain.setValueAtTime(0.08, ctx.currentTime + t)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + t + 0.15)
    osc.start(ctx.currentTime + t)
    osc.stop(ctx.currentTime + t + 0.15)
  })
}

export function playErrorSound() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.3)
  gain.gain.setValueAtTime(0.06, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.3)
}

export function playClickSound() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1000, ctx.currentTime)
  gain.gain.setValueAtTime(0.04, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.05)
}
