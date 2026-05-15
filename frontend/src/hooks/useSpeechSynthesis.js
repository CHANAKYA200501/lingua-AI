/**
 * useSpeechSynthesis — TTS hook
 * 
 * Voice strategy:
 * - English text → Use locked sweet female voice (Samantha)
 * - Non-English text → Use best available voice for that language
 * - Always prefer female voices
 * - Chrome resume workaround for long speech
 */

import { useState, useRef, useCallback, useEffect } from 'react'

const PREFERRED_VOICES = [
  'samantha', 'karen', 'moira', 'tessa', 'allison', 'ava',
  'susan', 'fiona', 'veena', 'victoria',
  'zira', 'hazel', 'catherine',
  'google uk english female', 'google us english',
  'female', 'woman',
]

const MALE_BLOCKLIST = [
  'daniel', 'alex', 'fred', 'thomas', 'jacques', 'david', 'mark',
  'ralph', 'albert', 'junior', 'bruce', 'gordon', 'reed', 'lee',
  'rishi', 'aaron', 'james', 'jorge', 'diego', 'luca', 'oliver',
  'google uk english male', 'microsoft david', 'microsoft mark',
]

function isMale(v) {
  const n = v.name.toLowerCase()
  return MALE_BLOCKLIST.some(m => n.includes(m)) || (n.includes('male') && !n.includes('female'))
}

function findBestFemaleVoice(voices) {
  if (!voices?.length) return null
  const enVoices = voices.filter(v => v.lang.startsWith('en'))
  const pool = enVoices.length > 0 ? enVoices : voices
  for (const name of PREFERRED_VOICES) {
    const match = pool.find(v => v.name.toLowerCase().includes(name) && !isMale(v))
    if (match) return match
  }
  return pool.find(v => !isMale(v)) || voices.find(v => !isMale(v)) || voices[0]
}

// Find the best voice for a specific language
function findVoiceForLang(voices, langCode) {
  if (!voices?.length || !langCode) return null
  const prefix = langCode.split('-')[0] // 'hi-IN' → 'hi'
  
  // Get all voices for this language
  const langVoices = voices.filter(v => v.lang.startsWith(prefix))
  if (langVoices.length === 0) return null
  
  // Prefer female voices
  const female = langVoices.find(v => !isMale(v))
  return female || langVoices[0]
}

export default function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState([])
  const [settings, setSettings] = useState({
    rate: 0.95,
    pitch: 0.95,
    volume: 1.0,
  })

  const lockedVoiceRef = useRef(null)
  const resumeTimerRef = useRef(null)
  const speakQueueRef = useRef(null)
  const allVoicesRef = useRef([])

  // Load voices
  useEffect(() => {
    const loadAndLock = () => {
      const available = window.speechSynthesis.getVoices()
      if (available.length === 0) return
      setVoices(available)
      allVoicesRef.current = available
      if (!lockedVoiceRef.current) {
        const best = findBestFemaleVoice(available)
        lockedVoiceRef.current = best
        if (best) console.log(`🎙️ English Voice LOCKED: "${best.name}" (${best.lang})`)
        // Log available languages
        const langs = [...new Set(available.map(v => v.lang.split('-')[0]))]
        console.log(`🌐 Available TTS languages: ${langs.join(', ')}`)
      }
    }
    loadAndLock()
    window.speechSynthesis.addEventListener('voiceschanged', loadAndLock)
    const r1 = setTimeout(loadAndLock, 500)
    const r2 = setTimeout(loadAndLock, 2000)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadAndLock)
      clearTimeout(r1)
      clearTimeout(r2)
    }
  }, [])

  const speak = useCallback((text, lang, onDone) => {
    if (!text) { if (onDone) onDone(); return }

    // Clear any pending queue
    if (speakQueueRef.current) { clearTimeout(speakQueueRef.current); speakQueueRef.current = null }

    // If currently speaking, cancel first and wait before new speak
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel()
      speakQueueRef.current = setTimeout(() => doSpeak(text, lang, onDone), 200)
    } else {
      doSpeak(text, lang, onDone)
    }
  }, [settings])

  function doSpeak(text, lang, onDone) {
    const utterance = new SpeechSynthesisUtterance(text)
    const langCode = (!lang || lang === 'auto') ? 'en-US' : lang
    utterance.lang = langCode
    utterance.rate = settings.rate
    utterance.pitch = settings.pitch
    utterance.volume = settings.volume

    // Pick voice based on language
    const isEnglish = langCode.startsWith('en')
    
    if (isEnglish && lockedVoiceRef.current) {
      // English → use locked sweet female voice
      utterance.voice = lockedVoiceRef.current
      console.log(`🎤 Using locked voice: ${lockedVoiceRef.current.name}`)
    } else {
      // Non-English → find best voice for that language
      const langVoice = findVoiceForLang(allVoicesRef.current, langCode)
      if (langVoice) {
        utterance.voice = langVoice
        console.log(`🎤 Using ${langCode} voice: ${langVoice.name} (${langVoice.lang})`)
      } else {
        // No voice for this language — don't set voice, let browser handle
        console.log(`🎤 No specific voice for ${langCode}, using browser default`)
      }
    }

    // Chrome resume keepalive for long text
    utterance.onstart = () => {
      console.log(`🔊 Speaking: "${text.substring(0, 60)}..."`)
      setIsSpeaking(true)
      if (resumeTimerRef.current) clearInterval(resumeTimerRef.current)
      resumeTimerRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause()
          window.speechSynthesis.resume()
        }
      }, 10000)
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      if (resumeTimerRef.current) { clearInterval(resumeTimerRef.current); resumeTimerRef.current = null }
      if (onDone) onDone()
    }

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') console.warn('TTS error:', e.error)
      setIsSpeaking(false)
      if (resumeTimerRef.current) { clearInterval(resumeTimerRef.current); resumeTimerRef.current = null }
      if (onDone) onDone()
    }

    window.speechSynthesis.speak(utterance)
  }

  const stop = useCallback(() => {
    if (speakQueueRef.current) { clearTimeout(speakQueueRef.current); speakQueueRef.current = null }
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    if (resumeTimerRef.current) { clearInterval(resumeTimerRef.current); resumeTimerRef.current = null }
  }, [])

  const updateSettings = useCallback((partial) => {
    setSettings(prev => ({ ...prev, ...partial }))
  }, [])

  return { isSpeaking, voices, settings, speak, stop, updateSettings,
    lockedVoiceName: lockedVoiceRef.current?.name || 'Loading...' }
}
