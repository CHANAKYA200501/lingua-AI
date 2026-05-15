import { useState, useEffect, useCallback, useRef } from 'react'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import axios from 'axios'
import Header from './components/Header'
import JarvisOrb from './components/JarvisOrb'
import TranslatorPanel from './components/TranslatorPanel'
import HistoryPanel from './components/HistoryPanel'
import StatsBar from './components/StatsBar'
import VoiceSettings from './components/VoiceSettings'
import CommandSuggestions from './components/CommandSuggestions'
import ConversationLog from './components/ConversationLog'
import VoiceEnrollment from './components/VoiceEnrollment'
import LiveTranslation from './components/LiveTranslation'
import FloatingAssistant from './components/FloatingAssistant'
import Background from './components/Background'
import useSpeechSynthesis from './hooks/useSpeechSynthesis'
import useVoiceProfile from './hooks/useVoiceProfile'
import useBackgroundService from './hooks/useBackgroundService'
import { parseCommand } from './utils/commandParser'
import { playActivateSound, playDeactivateSound, playSuccessSound, playClickSound } from './utils/soundEffects'
import './App.css'

const STATE = {
  SLEEPING: 'sleeping',
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
}

const AUTO_SLEEP_MS = 60000

function App() {
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState({ total: 0, languages: 0, words: 0 })
  const [activeTab, setActiveTab] = useState('translate')
  const [assistantState, setAssistantState] = useState(STATE.SLEEPING)
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('en')
  const [sourceText, setSourceText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [detectedLang, setDetectedLang] = useState(null)
  const [confidence, setConfidence] = useState(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [convoLog, setConvoLog] = useState([])
  const [liveTranscript, setLiveTranscript] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showEnrollment, setShowEnrollment] = useState(false)
  const [passiveListening, setPassiveListening] = useState(true)
  const langSetRef = useRef(new Set(['en']))
  const autoSleepRef = useRef(null)
  const recognitionRef = useRef(null)
  const passiveRecRef = useRef(null)
  const voiceInitiatedRef = useRef(false) // BUG-05: flag to prevent duplicate auto-translate
  const handleVoiceResultRef = useRef(null) // Stable ref for handleVoiceResult
  const executeCommandRef = useRef(null) // Stable ref for executeCommand
  const addConvoEntryRef = useRef(null) // Stable ref for addConvoEntry

  const voice = useSpeechSynthesis()
  const voiceProfile = useVoiceProfile()
  const bgService = useBackgroundService()

  // ── Stable refs for values used in callbacks (prevents stale closures) ──
  const sourceLangRef = useRef(sourceLang)
  const targetLangRef = useRef(targetLang)
  const translatedTextRef = useRef(translatedText)
  const sourceTextRef = useRef(sourceText)
  const assistantStateRef = useRef(assistantState)
  useEffect(() => { sourceLangRef.current = sourceLang }, [sourceLang])
  useEffect(() => { targetLangRef.current = targetLang }, [targetLang])
  useEffect(() => { translatedTextRef.current = translatedText }, [translatedText])
  useEffect(() => { sourceTextRef.current = sourceText }, [sourceText])
  useEffect(() => { assistantStateRef.current = assistantState }, [assistantState])

  // ── Auto-sleep timer ──
  const resetAutoSleep = useCallback(() => {
    if (autoSleepRef.current) clearTimeout(autoSleepRef.current)
    autoSleepRef.current = setTimeout(() => {
      stopMic()
      setAssistantState(STATE.SLEEPING)
      setLiveTranscript('')
    }, AUTO_SLEEP_MS)
  }, [])

  // ── Mic control (only for active commands, NOT passive) ──
  const stopMic = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch(e) {}
      recognitionRef.current = null
    }
    setLiveTranscript('')
  }, [])

  // ── Mic language for speech recognition ──
  // Chrome can only listen in ONE language at a time. 
  // micLang = the language the mic is actively listening in.
  // When sourceLang is 'auto', user can toggle micLang between Hindi/English.
  const [micLang, setMicLang] = useState(() => localStorage.getItem('micLang') || 'en-US')

  // Save mic lang preference
  useEffect(() => { localStorage.setItem('micLang', micLang) }, [micLang])

  // Toggle mic language (used by the quick-switch button)
  // NOTE: startMicWithLang is NOT in deps because it's defined later and only
  // called lazily inside setTimeout (no TDZ risk at call-time)
  const startMicWithLangRef = useRef(null) // populated after startMicWithLang is defined
  const toggleMicLang = useCallback(() => {
    setMicLang(prev => {
      const next = prev === 'en-US' ? 'hi-IN' : 'en-US'
      console.log(`🎧 Mic language switched: ${prev} → ${next}`)
      // Restart mic if currently listening
      if (recognitionRef.current) {
        stopMic()
        setTimeout(() => {
          if (assistantStateRef.current === STATE.LISTENING && startMicWithLangRef.current) {
            startMicWithLangRef.current(next, (text) => handleVoiceResultRef.current(text))
          }
        }, 200)
      }
      return next
    })
  }, [stopMic])

  // Get the effective mic language
  const getEffectiveMicLang = useCallback(() => {
    if (!sourceLang || sourceLang === 'auto') return micLang
    // Map source lang code to BCP-47
    const langMap = {
      'hi': 'hi-IN', 'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR',
      'de': 'de-DE', 'ja': 'ja-JP', 'ko': 'ko-KR', 'zh': 'zh-CN',
      'ar': 'ar-SA', 'pt': 'pt-BR', 'ru': 'ru-RU', 'it': 'it-IT',
      'bn': 'bn-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'mr': 'mr-IN',
      'gu': 'gu-IN', 'kn': 'kn-IN', 'ml': 'ml-IN', 'pa': 'pa-IN',
      'ur': 'ur-PK', 'th': 'th-TH', 'vi': 'vi-VN', 'tr': 'tr-TR',
      'nl': 'nl-NL', 'pl': 'pl-PL', 'sv': 'sv-SE', 'da': 'da-DK',
    }
    return langMap[sourceLang] || sourceLang
  }, [sourceLang, micLang])

  // Core mic start with explicit language
  const startMicWithLang = useCallback((lang, onFinalResult) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Speech recognition not supported. Use Chrome.'); return }
    stopMic()

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = lang
    console.log(`🎧 Mic listening in: ${lang}`)

    rec.onresult = (e) => {
      let finalText = ''
      let interimText = ''
      let bestConfidence = 0
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript
          bestConfidence = Math.max(bestConfidence, e.results[i][0].confidence || 0)
        } else {
          interimText += e.results[i][0].transcript
        }
      }
      if (interimText) setLiveTranscript(interimText)
      if (finalText) {
        setLiveTranscript('')
        resetAutoSleep()
        console.log(`🎯 Recognized (${lang}): "${finalText}" confidence=${(bestConfidence * 100).toFixed(0)}%`)
        if (onFinalResult) onFinalResult(finalText.trim())
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      toast.error('Mic error: ' + e.error)
      setAssistantState(STATE.IDLE)
    }
    rec.onend = () => { recognitionRef.current = null }
    recognitionRef.current = rec
    try { rec.start() } catch(e) {}
  }, [stopMic, resetAutoSleep])
  // Sync ref so toggleMicLang (defined above) can access startMicWithLang lazily
  startMicWithLangRef.current = startMicWithLang

  // Public startMic uses effective language
  const startMic = useCallback((onFinalResult) => {
    startMicWithLang(getEffectiveMicLang(), onFinalResult)
  }, [startMicWithLang, getEffectiveMicLang])


  // ── JARVIS speak ──
  // After speaking, auto-resume listening so user never has to press Space
  const jarvisSay = useCallback((text, lang, onDone) => {
    stopMic()
    setAssistantState(STATE.SPEAKING)
    if (addConvoEntryRef.current) addConvoEntryRef.current('lexa', text)
    voice.speak(text, lang || 'en', () => {
      resetAutoSleep()
      if (onDone) {
        onDone()
      } else {
        // Auto-resume listening for next command
        setAssistantState(STATE.LISTENING)
        startMic((nextText) => handleVoiceResultRef.current(nextText))
      }
    })
  }, [voice, stopMic, resetAutoSleep, startMic])

  const addConvoEntry = useCallback((who, text) => {
    setConvoLog(prev => [...prev, { who, text, time: Date.now() }].slice(-30))
  }, [])
  addConvoEntryRef.current = addConvoEntry

  // ── Translation ──
  const doTranslate = useCallback(async (text, tgtOverride) => {
    if (!text?.trim()) return
    const tgt = tgtOverride || targetLangRef.current
    voiceInitiatedRef.current = true // BUG-05: prevent TranslatorPanel from re-triggering
    setSourceText(text)
    setIsTranslating(true)
    setAssistantState(STATE.PROCESSING)
    try {
      const src = sourceLangRef.current
      const res = await axios.post('/api/translate', { text, source_lang: src, target_lang: tgt })
      const d = res.data
      setTranslatedText(d.translated_text)
      setDetectedLang(d.detected_language)
      setConfidence(d.confidence)

      // Smart auto-swap: if detected language is same as target, flip target
      const detected = d.detected_language?.split('-')?.[0] || ''
      if (detected && detected === tgt.split('-')[0]) {
        const newTarget = detected === 'en' ? 'hi' : 'en'
        setTargetLang(newTarget)
        console.log(`🔄 Auto-swapped target: ${tgt} → ${newTarget} (detected=${detected})`)
        // Re-translate with correct target
        try {
          const res2 = await axios.post('/api/translate', { text, source_lang: src, target_lang: newTarget })
          setTranslatedText(res2.data.translated_text)
          setDetectedLang(res2.data.detected_language)
          setConfidence(res2.data.confidence)
          const entry2 = { id: Date.now(), sourceText: text, translatedText: res2.data.translated_text, sourceLang: detected, targetLang: newTarget, timestamp: new Date().toISOString() }
          setHistory(prev => [entry2, ...prev].slice(0, 50))
          setStats(prev => ({ total: prev.total + 1, words: prev.words + text.split(' ').length, languages: langSetRef.current.size }))
          playSuccessSound()
          jarvisSay(res2.data.translated_text, newTarget)
        } catch (e) {
          console.warn('Auto-swap re-translate failed:', e)
        }
        return // BUG-03: always return after auto-swap path, even if re-translate fails
      }
      const entry = { id: Date.now(), sourceText: text, translatedText: d.translated_text, sourceLang: d.detected_language || src, targetLang: tgt, timestamp: new Date().toISOString() }
      setHistory(prev => [entry, ...prev].slice(0, 50))
      setStats(prev => ({ total: prev.total + 1, words: prev.words + text.split(' ').length, languages: langSetRef.current.size }))
      playSuccessSound()

      // Speak the translated text automatically
      jarvisSay(d.translated_text, tgt)

      // Show notification if app is in background
      if (bgService.isInBackground && bgService.notificationsGranted) {
        bgService.showTaskNotification(
          `🌐 "${text}"`,
          d.translated_text
        )
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Translation failed')
      jarvisSay('Sorry, translation failed.', 'en')
    } finally {
      setIsTranslating(false)
      // Reset flag after delay so TranslatorPanel's debounce doesn't re-fire
      setTimeout(() => { voiceInitiatedRef.current = false }, 1200)
    }
  }, [jarvisSay, bgService])

  // ── Voice result handler ──
  // Uses refs for forward-referenced functions to avoid TDZ
  const handleVoiceResult = useCallback((text) => {
    if (addConvoEntryRef.current) addConvoEntryRef.current('user', text)
    const cmd = parseCommand(text)
    cmd.originalText = text
    if (executeCommandRef.current) executeCommandRef.current(cmd)
  }, [])
  // Keep ref in sync
  useEffect(() => { handleVoiceResultRef.current = handleVoiceResult }, [handleVoiceResult])

  // ── Deactivate (defined before executeCommand to avoid circular deps) ──
  const deactivateAssistant = useCallback(() => {
    stopMic()
    voice.stop()
    if (autoSleepRef.current) clearTimeout(autoSleepRef.current)
    setAssistantState(STATE.SLEEPING)
    setLiveTranscript('')
  }, [stopMic, voice])

  // ── Command executor ──
  const executeCommand = useCallback((cmd) => {
    if (!cmd.originalText && addConvoEntryRef.current) addConvoEntryRef.current('user', cmd.text || cmd.type)

    switch (cmd.type) {
      case 'TRANSLATE':
        if (cmd.targetLangCode) {
          setTargetLang(cmd.targetLangCode)
          langSetRef.current.add(cmd.targetLangCode)
          setStats(prev => ({ ...prev, languages: langSetRef.current.size }))
        }
        doTranslate(cmd.text, cmd.targetLangCode)
        break
      case 'SET_SOURCE_LANG':
        if (cmd.langCode) {
          setSourceLang(cmd.langCode); langSetRef.current.add(cmd.langCode)
          setStats(prev => ({ ...prev, languages: langSetRef.current.size }))
          playClickSound(); jarvisSay(`Input language changed to ${cmd.langName}.`, 'en')
        } else jarvisSay(`Sorry, I don't recognize that language.`, 'en')
        break
      case 'SET_TARGET_LANG':
        if (cmd.langCode) {
          setTargetLang(cmd.langCode); langSetRef.current.add(cmd.langCode)
          setStats(prev => ({ ...prev, languages: langSetRef.current.size }))
          playClickSound(); jarvisSay(`Output language changed to ${cmd.langName}.`, 'en')
        } else jarvisSay(`Sorry, I don't recognize that language.`, 'en')
        break
      case 'SWAP_LANGS': {
        const curSrc = sourceLangRef.current
        if (curSrc !== 'auto') {
          const curTgt = targetLangRef.current
          setSourceLang(curTgt); setTargetLang(curSrc)
          setSourceText(translatedTextRef.current); setTranslatedText(sourceTextRef.current)
          playClickSound(); jarvisSay('Languages swapped.', 'en')
        } else jarvisSay('Cannot swap when source is auto-detect.', 'en')
        break
      }
      case 'CLEAR':
        setSourceText(''); setTranslatedText(''); setDetectedLang(null); setConfidence(null)
        playClickSound(); jarvisSay('All cleared.', 'en')
        break
      case 'REPEAT':
        translatedTextRef.current ? jarvisSay(translatedTextRef.current, targetLangRef.current) : jarvisSay('Nothing to repeat yet.', 'en')
        break
      case 'STOP_SPEAKING':
        voice.stop(); setAssistantState(STATE.IDLE)
        break
      case 'COPY_TRANSLATION':
        if (translatedTextRef.current) { navigator.clipboard.writeText(translatedTextRef.current); playClickSound(); jarvisSay('Copied translation.', 'en') }
        else jarvisSay('No translation to copy.', 'en')
        break
      case 'COPY_SOURCE':
        if (sourceTextRef.current) { navigator.clipboard.writeText(sourceTextRef.current); playClickSound(); jarvisSay('Copied source text.', 'en') }
        else jarvisSay('No source text to copy.', 'en')
        break
      case 'SHOW_HISTORY':
        setActiveTab('history'); playClickSound(); jarvisSay('Here is your history.', 'en')
        break
      case 'CLEAR_HISTORY':
        setHistory([]); playClickSound(); jarvisSay('History cleared.', 'en')
        break
      case 'SHOW_TRANSLATOR':
        setActiveTab('translate'); playClickSound(); jarvisSay('Back to translator.', 'en')
        break
      case 'VOICE_SPEED': {
        const d = cmd.direction?.toLowerCase()
        let r = voice.settings.rate
        if (d === 'up' || d === 'faster') r = Math.min(2, r + 0.2)
        else if (d === 'down' || d === 'slower') r = Math.max(0.3, r - 0.2)
        else r = 1.0
        voice.updateSettings({ rate: r }); jarvisSay(`Speed set to ${r.toFixed(1)}.`, 'en')
        break
      }
      case 'VOICE_PITCH': {
        const d = cmd.direction?.toLowerCase()
        let p = voice.settings.pitch
        if (d === 'up' || d === 'higher') p = Math.min(2, p + 0.2)
        else if (d === 'down' || d === 'lower') p = Math.max(0.3, p - 0.2)
        else p = 1.0
        voice.updateSettings({ pitch: p }); jarvisSay(`Pitch set to ${p.toFixed(1)}.`, 'en')
        break
      }
      case 'SLEEP':
        playDeactivateSound()
        jarvisSay('Going to sleep. Say Hey Lexa or click the orb to wake me.', 'en', () => {
          deactivateAssistant()
        })
        break
      case 'HELP':
        setShowSettings(true); jarvisSay('Here are the available commands.', 'en')
        break
      default:
        jarvisSay("I didn't understand that. Try 'translate hello to Spanish'.", 'en')
    }
  }, [voice, doTranslate, jarvisSay, deactivateAssistant])
  // Sync executeCommand ref so handleVoiceResult always gets latest
  useEffect(() => { executeCommandRef.current = executeCommand }, [executeCommand])

  // ── Activate ──
  const activateAssistant = useCallback(() => {
    playActivateSound()
    setAssistantState(STATE.SPEAKING)
    addConvoEntry('lexa', 'Online. How can I help you, Lexa?')

    // If app is in background, send notification to bring user back
    if (bgService.isInBackground) {
      bgService.showWakeNotification('Lexa is awake and ready! Tap to return.')
    }

    voice.speak('Online. How can I help you, Lexa?', 'en', () => {
      setAssistantState(STATE.LISTENING)
      resetAutoSleep()
      startMic((text) => handleVoiceResultRef.current(text))
    })
  }, [voice, startMic, resetAutoSleep, addConvoEntry, bgService])

  const startListeningSession = useCallback(() => {
    setAssistantState(STATE.LISTENING)
    resetAutoSleep()
    startMic((text) => handleVoiceResult(text))
  }, [startMic, resetAutoSleep, handleVoiceResult])

  // ═══════════════════════════════════════
  // PASSIVE LISTENING — "Hey Lexa" wake word (always-on by default)
  // Uses a SEPARATE SpeechRecognition instance for wake word detection.
  // ═══════════════════════════════════════
  useEffect(() => {
    if (!passiveListening || assistantState !== STATE.SLEEPING || showEnrollment) {
      // Stop passive listener — use small delay to avoid race condition (BUG-12)
      const timer = setTimeout(() => {
        if (passiveRecRef.current) {
          try { passiveRecRef.current.abort() } catch(e) {}
          passiveRecRef.current = null
        }
      }, 100)
      return () => clearTimeout(timer)
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    let rec = null
    let stopped = false

    const startPassive = () => {
      if (stopped) return
      rec = new SR()
      rec.continuous = true
      rec.interimResults = false
      rec.lang = 'en-US'

      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            const text = e.results[i][0].transcript.toLowerCase().trim()
            // Check for "Hey Lexa" wake word
            if (text.includes('lexa') || text.includes('hey lexa')) {
              // Verify voice if profile exists
              if (voiceProfile.hasProfile) {
                const isMatch = voiceProfile.verifyVoice()
                if (!isMatch) {
                  console.log('Wake word detected but voice mismatch — ignoring')
                  return
                }
              }
              // Voice verified or no profile — activate!
              try { rec.abort() } catch(e) {}
              passiveRecRef.current = null
              activateAssistant()
              return
            }
          }
        }
      }

      rec.onend = () => {
        // Auto-restart passive listening
        if (!stopped && passiveListening) {
          setTimeout(() => startPassive(), 500)
        }
      }
      rec.onerror = () => {}
      passiveRecRef.current = rec
      try { rec.start() } catch(e) {}
    }

    // Start audio stream for voice verification
    if (voiceProfile.hasProfile) {
      voiceProfile.startAudioStream().then(() => startPassive())
    } else {
      startPassive()
    }

    return () => {
      stopped = true
      if (rec) try { rec.abort() } catch(e) {}
      passiveRecRef.current = null
      voiceProfile.stopAudioStream()
    }
  }, [passiveListening, assistantState, showEnrollment, voiceProfile.hasProfile, activateAssistant])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (assistantState === STATE.SLEEPING) activateAssistant()
        else if (assistantState === STATE.IDLE) startListeningSession()
        else if (assistantState === STATE.LISTENING) { stopMic(); setAssistantState(STATE.IDLE) }
        else if (assistantState === STATE.SPEAKING) { voice.stop(); setAssistantState(STATE.IDLE) }
      }
      if (e.code === 'Escape') deactivateAssistant()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [assistantState, activateAssistant, deactivateAssistant, startListeningSession, stopMic, voice])

  // Cleanup
  useEffect(() => {
    return () => { stopMic(); if (autoSleepRef.current) clearTimeout(autoSleepRef.current) }
  }, [stopMic])

  // ── Orb click ──
  const handleOrbClick = () => {
    if (assistantState === STATE.SLEEPING) activateAssistant()
    else if (assistantState === STATE.IDLE) startListeningSession()
    else if (assistantState === STATE.LISTENING) { stopMic(); setAssistantState(STATE.IDLE) }
    else if (assistantState === STATE.SPEAKING) { voice.stop(); setAssistantState(STATE.IDLE) }
    else deactivateAssistant()
  }

  const togglePassiveListening = () => {
    if (!passiveListening) {
      setPassiveListening(true)
      toast.success('Passive listening ON — say "Hey Lexa" to wake')
    } else {
      setPassiveListening(false)
      toast('Passive listening OFF', { icon: '🔇' })
    }
  }

  const toggleBackgroundMode = async () => {
    if (bgService.isBackgroundActive) {
      bgService.stopBackgroundService()
      toast('Background mode OFF', { icon: '🔇' })
    } else {
      await bgService.startBackgroundService()
      // Also enable passive listening when background mode is on
      if (!passiveListening) setPassiveListening(true)
      toast.success('🛡️ Background mode ON — Hey Lexa works even when tab is hidden')
    }
  }

  const getStatusText = () => {
    switch(assistantState) {
      case STATE.SLEEPING: return passiveListening ? 'Say "Hey Lexa" to wake me up' : 'Click orb to wake'
      case STATE.IDLE: return 'Ready — speak your command'
      case STATE.LISTENING: return '● Listening...'
      case STATE.PROCESSING: return '⟳ Processing...'
      case STATE.SPEAKING: return '♫ Speaking...'
      default: return ''
    }
  }

  return (
    <div className="app-root">
      <Background />
      <Toaster position="top-right" toastOptions={{ style: { background: 'rgba(6,16,31,0.95)', color: '#e8f4ff', border: '1px solid rgba(0,212,255,0.1)', backdropFilter: 'blur(20px)', borderRadius: '12px' }, success: { iconTheme: { primary: '#10b981', secondary: '#020810' } }, error: { iconTheme: { primary: '#f43f5e', secondary: '#020810' } } }} />

      {showEnrollment && (
        <VoiceEnrollment
          voiceProfile={voiceProfile}
          onComplete={() => { setShowEnrollment(false); toast.success('✅ Voice trained! Only your voice will activate.') }}
          onCancel={() => setShowEnrollment(false)}
        />
      )}

      <Header activeTab={activeTab} setActiveTab={setActiveTab} assistantState={assistantState} />

      <main className="app-main">
        <StatsBar stats={stats} assistantState={assistantState} />

        <JarvisOrb
          state={assistantState}
          onClick={handleOrbClick}
          statusText={getStatusText()}
          liveTranscript={liveTranscript}
          isSpeaking={voice.isSpeaking}
          passiveListening={passiveListening}
          hasProfile={voiceProfile.hasProfile}
          onTogglePassive={togglePassiveListening}
          onTrainVoice={() => setShowEnrollment(true)}
          onClearProfile={voiceProfile.clearProfile}
          bgService={bgService}
          onToggleBackground={toggleBackgroundMode}
          micLang={micLang}
          onToggleMicLang={toggleMicLang}
          sourceLang={sourceLang}
        />

        <div className="app-content">
          {activeTab === 'translate' ? (
            <div className="translator-section">
              <TranslatorPanel
                sourceLang={sourceLang} setSourceLang={setSourceLang}
                targetLang={targetLang} setTargetLang={setTargetLang}
                sourceText={sourceText} setSourceText={setSourceText}
                translatedText={translatedText} setTranslatedText={setTranslatedText}
                detectedLang={detectedLang} setDetectedLang={setDetectedLang}
                confidence={confidence} setConfidence={setConfidence}
                isTranslating={isTranslating}
                doTranslate={doTranslate}
                voice={voice}
                addToHistory={(e) => setHistory(prev => [e,...prev].slice(0,50))}
                updateStats={(s) => setStats(prev => ({...prev,...s}))}
                langSetRef={langSetRef}
                voiceInitiatedRef={voiceInitiatedRef}
              />
              {showSettings && <VoiceSettings voice={voice} />}
              <CommandSuggestions />
              {convoLog.length > 0 && <ConversationLog entries={convoLog} />}
            </div>
          ) : activeTab === 'live' ? (
            <LiveTranslation voice={voice} />
          ) : (
            <HistoryPanel history={history} setHistory={setHistory} voice={voice} />
          )}
        </div>
      </main>

      <footer className="app-footer">

      </footer>

      <FloatingAssistant
        assistantState={assistantState}
        onActivate={activateAssistant}
        onDeactivate={deactivateAssistant}
        onQuickTranslate={() => { if (sourceText) doTranslate(sourceText) }}
        translatedText={translatedText}
        targetLang={targetLang}
        voice={voice}
        liveTranscript={liveTranscript}
      />
    </div>
  )
}

export default App
