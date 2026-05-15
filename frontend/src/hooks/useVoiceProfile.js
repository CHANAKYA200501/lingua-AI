/**
 * useVoiceProfile — Voice enrollment and speaker verification
 * Records audio features when user says "Hey Lexa" during training,
 * then compares future wake words against the stored voice profile.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'lexa_voice_profile'
const REQUIRED_SAMPLES = 3
const MATCH_THRESHOLD = 0.72 // 0-1, higher = stricter

// Extract audio features from AnalyserNode
function extractFeatures(analyser) {
  const bufferLength = analyser.frequencyBinCount
  const freqData = new Float32Array(bufferLength)
  const timeData = new Float32Array(bufferLength)
  analyser.getFloatFrequencyData(freqData)
  analyser.getFloatTimeDomainData(timeData)

  // 1. Spectral centroid (weighted average frequency)
  let weightedSum = 0, magnitudeSum = 0
  for (let i = 0; i < bufferLength; i++) {
    const magnitude = Math.pow(10, freqData[i] / 20) // dB to linear
    weightedSum += i * magnitude
    magnitudeSum += magnitude
  }
  const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0

  // 2. Energy (RMS of time domain)
  let sumSq = 0
  for (let i = 0; i < timeData.length; i++) sumSq += timeData[i] * timeData[i]
  const rms = Math.sqrt(sumSq / timeData.length)

  // 3. Zero crossing rate
  let zeroCrossings = 0
  for (let i = 1; i < timeData.length; i++) {
    if ((timeData[i] >= 0 && timeData[i - 1] < 0) || (timeData[i] < 0 && timeData[i - 1] >= 0)) {
      zeroCrossings++
    }
  }
  const zcr = zeroCrossings / timeData.length

  // 4. Spectral bands energy (divide spectrum into 8 bands)
  const bands = 8
  const bandSize = Math.floor(bufferLength / bands)
  const bandEnergies = []
  for (let b = 0; b < bands; b++) {
    let bandSum = 0
    for (let i = b * bandSize; i < (b + 1) * bandSize && i < bufferLength; i++) {
      bandSum += Math.pow(10, freqData[i] / 20)
    }
    bandEnergies.push(bandSum / bandSize)
  }

  // 5. Spectral flatness
  let geoMean = 0, arithMean = 0
  const linearMags = []
  for (let i = 0; i < bufferLength; i++) {
    const mag = Math.max(Math.pow(10, freqData[i] / 20), 1e-10)
    linearMags.push(mag)
    geoMean += Math.log(mag)
    arithMean += mag
  }
  geoMean = Math.exp(geoMean / bufferLength)
  arithMean = arithMean / bufferLength
  const spectralFlatness = arithMean > 0 ? geoMean / arithMean : 0

  return {
    spectralCentroid,
    rms,
    zcr,
    bandEnergies,
    spectralFlatness,
  }
}

// Compare two feature sets, returns similarity 0-1
function compareFeatures(a, b) {
  if (!a || !b) return 0

  // Normalize and compare each feature
  const diffs = []

  // Spectral centroid (normalize by max possible)
  const maxCentroid = 512
  diffs.push(Math.abs(a.spectralCentroid - b.spectralCentroid) / maxCentroid)

  // ZCR
  diffs.push(Math.abs(a.zcr - b.zcr))

  // Spectral flatness
  diffs.push(Math.abs(a.spectralFlatness - b.spectralFlatness))

  // Band energies (cosine similarity)
  if (a.bandEnergies && b.bandEnergies) {
    let dotProduct = 0, normA = 0, normB = 0
    for (let i = 0; i < a.bandEnergies.length; i++) {
      dotProduct += a.bandEnergies[i] * b.bandEnergies[i]
      normA += a.bandEnergies[i] * a.bandEnergies[i]
      normB += b.bandEnergies[i] * b.bandEnergies[i]
    }
    const cosineSim = (normA > 0 && normB > 0) ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0
    diffs.push(1 - cosineSim) // convert to distance
  }

  // Average distance → similarity
  const avgDist = diffs.reduce((s, d) => s + d, 0) / diffs.length
  return Math.max(0, 1 - avgDist * 2) // scale to 0-1
}

// Average multiple feature samples into one profile
function averageFeatures(samples) {
  if (samples.length === 0) return null
  const avg = {
    spectralCentroid: 0, rms: 0, zcr: 0, spectralFlatness: 0,
    bandEnergies: new Array(8).fill(0),
  }
  for (const s of samples) {
    avg.spectralCentroid += s.spectralCentroid
    avg.rms += s.rms
    avg.zcr += s.zcr
    avg.spectralFlatness += s.spectralFlatness
    for (let i = 0; i < 8; i++) avg.bandEnergies[i] += (s.bandEnergies[i] || 0)
  }
  const n = samples.length
  avg.spectralCentroid /= n
  avg.rms /= n
  avg.zcr /= n
  avg.spectralFlatness /= n
  avg.bandEnergies = avg.bandEnergies.map(v => v / n)
  return avg
}

export default function useVoiceProfile() {
  const [profile, setProfile] = useState(null)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [enrollSamples, setEnrollSamples] = useState([])
  const [enrollStep, setEnrollStep] = useState(0) // 0-3
  const analyserRef = useRef(null)
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)

  // Load saved profile
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setProfile(JSON.parse(saved))
    } catch (e) {}
  }, [])

  const hasProfile = !!profile

  // Start audio analysis stream (shared by enrollment + verification)
  const startAudioStream = useCallback(async () => {
    if (streamRef.current) return // already running
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.3
      source.connect(analyser)
      streamRef.current = stream
      audioCtxRef.current = ctx
      analyserRef.current = analyser
    } catch (e) {
      console.error('Mic access denied:', e)
    }
  }, [])

  const stopAudioStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    analyserRef.current = null
  }, [])

  // Capture current features from the live mic
  const captureFeatures = useCallback(() => {
    if (!analyserRef.current) return null
    return extractFeatures(analyserRef.current)
  }, [])

  // ── Enrollment ──
  const startEnrollment = useCallback(async () => {
    setIsEnrolling(true)
    setEnrollSamples([])
    setEnrollStep(0)
    await startAudioStream()
  }, [startAudioStream])

  const recordEnrollSample = useCallback(() => {
    const features = captureFeatures()
    if (!features) return false
    const newSamples = [...enrollSamples, features]
    setEnrollSamples(newSamples)
    setEnrollStep(newSamples.length)

    if (newSamples.length >= REQUIRED_SAMPLES) {
      // All samples collected — save profile
      const avgProfile = averageFeatures(newSamples)
      setProfile(avgProfile)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(avgProfile))
      setIsEnrolling(false)
      stopAudioStream()
      return true // enrollment complete
    }
    return false
  }, [enrollSamples, captureFeatures, stopAudioStream])

  const cancelEnrollment = useCallback(() => {
    setIsEnrolling(false)
    setEnrollSamples([])
    setEnrollStep(0)
    stopAudioStream()
  }, [stopAudioStream])

  // ── Verification ──
  const verifyVoice = useCallback(() => {
    if (!profile) return true // no profile = allow anyone
    const current = captureFeatures()
    if (!current) return false
    const similarity = compareFeatures(current, profile)
    console.log('Voice similarity:', similarity.toFixed(3))
    return similarity >= MATCH_THRESHOLD
  }, [profile, captureFeatures])

  const clearProfile = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setProfile(null)
  }, [])

  return {
    profile,
    hasProfile,
    isEnrolling,
    enrollStep,
    requiredSamples: REQUIRED_SAMPLES,
    startEnrollment,
    recordEnrollSample,
    cancelEnrollment,
    verifyVoice,
    clearProfile,
    startAudioStream,
    stopAudioStream,
    captureFeatures,
  }
}
