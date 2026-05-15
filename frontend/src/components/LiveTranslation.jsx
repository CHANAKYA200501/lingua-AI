import { useState, useRef, useCallback, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { LANGUAGES } from '../utils/languages'
import { FiSquare, FiPlay, FiVolume2, FiVolumeX, FiType, FiDownload, FiCpu, FiTrash2, FiSettings } from 'react-icons/fi'

const SPEAKER_COLORS = ['#00E5FF', '#A3FF12', '#7CFF00', '#f59e0b', '#FF4D6D']
const SILENCE_GAP_MS = 2500

const LiveTranslation = ({ voice }) => {
  const [isActive, setIsActive] = useState(false)
  const [entries, setEntries] = useState([])
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [showSubtitles, setShowSubtitles] = useState(true)
  const [latestSubtitle, setLatestSubtitle] = useState('')
  const [status, setStatus] = useState('idle')
  const [liveSourceLang, setLiveSourceLang] = useState('auto')
  const [liveTargetLang, setLiveTargetLang] = useState('en')
  const [captureMode, setCaptureMode] = useState('mic')
  const [summary, setSummary] = useState(null)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [subtitleSize, setSubtitleSize] = useState(18)
  const [subtitleOpacity, setSubtitleOpacity] = useState(0.9)
  const [showControls, setShowControls] = useState(false)
  const [speakerCount, setSpeakerCount] = useState(1)
  const [sessionDuration, setSessionDuration] = useState(0)

  const recognitionRef = useRef(null)
  const tabStreamRef = useRef(null)
  const micStreamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)
  const scrollRef = useRef(null)
  const lastSpeechRef = useRef(Date.now())
  const currentSpeakerRef = useRef(1)
  const startTimeRef = useRef(null)
  const timerRef = useRef(null)

  // ★ CRITICAL: Use refs for values accessed inside SpeechRecognition callbacks
  // This prevents stale closure bugs where isActive/lang/muted are captured as old values
  const isActiveRef = useRef(false)
  const targetLangRef = useRef('hi')
  const sourceLangRef = useRef('auto')
  const isMutedRef = useRef(false)
  const speakerCountRef = useRef(1)

  // Keep refs in sync with state
  useEffect(() => { isActiveRef.current = isActive }, [isActive])
  useEffect(() => { targetLangRef.current = liveTargetLang }, [liveTargetLang])
  useEffect(() => { sourceLangRef.current = liveSourceLang }, [liveSourceLang])
  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])
  useEffect(() => { speakerCountRef.current = speakerCount }, [speakerCount])

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [entries.length, currentTranscript])

  // Session timer
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSessionDuration(Date.now() - startTimeRef.current)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isActive])

  // Waveform drawing
  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)

    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight

    ctx.clearRect(0, 0, w, h)
    const barCount = 80
    const barW = w / barCount - 1

    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor(i * bufferLength / barCount)
      const barH = (dataArray[idx] / 255) * h * 0.9
      const hue = 190 + (i / barCount) * 40
      ctx.fillStyle = `hsla(${hue}, 85%, 55%, 0.8)`
      ctx.fillRect(i * (barW + 1), h - barH, barW, barH)
      ctx.fillStyle = `hsla(${hue}, 85%, 55%, 0.15)`
      ctx.fillRect(i * (barW + 1), 0, barW, Math.max(0, barH * 0.3))
    }
    animFrameRef.current = requestAnimationFrame(drawWaveform)
  }, [])

  // Handle final speech result — uses REFS to avoid stale closures
  const handleSpeechResult = useCallback(async (text) => {
    if (!text.trim()) return
    setStatus('translating')

    const tgtLang = targetLangRef.current
    const srcLang = sourceLangRef.current
    const muted = isMutedRef.current
    const spkCount = speakerCountRef.current

    // Speaker detection via silence gap
    const now = Date.now()
    const gap = now - lastSpeechRef.current
    if (gap > SILENCE_GAP_MS) {
      currentSpeakerRef.current = currentSpeakerRef.current >= spkCount
        ? 1 : currentSpeakerRef.current + 1
    }
    lastSpeechRef.current = now
    const speaker = `Speaker ${currentSpeakerRef.current}`

    try {
      const res = await axios.post('/api/translate', {
        text, source_lang: srcLang, target_lang: tgtLang
      })
      const result = res.data
      if (!result) { setStatus('listening'); return }

      const entry = {
        id: Date.now(),
        speaker,
        original: text,
        translated: result.translated_text,
        detectedLang: result.detected_language,
        targetLang: tgtLang,
        timestamp: new Date().toLocaleTimeString(),
      }
      setEntries(prev => [...prev, entry])
      setLatestSubtitle(result.translated_text)

      // TTS
      if (!muted) {
        setStatus('speaking')
        voice.speak(result.translated_text, tgtLang, () => setStatus('listening'))
      } else {
        setStatus('listening')
      }
    } catch (err) {
      console.error('Translation error:', err)
      setStatus('listening')
    }
  }, [voice]) // Only voice is needed — everything else comes from refs

  // Start live session
  const startSession = useCallback(async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Speech Recognition not supported. Use Chrome.'); return }

    try {
      // Mic stream for waveform
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = micStream
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const source = ctx.createMediaStreamSource(micStream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser

      // Tab audio capture
      if (captureMode === 'tab' || captureMode === 'both') {
        try {
          const tabStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          tabStreamRef.current = tabStream
          tabStream.getVideoTracks().forEach(t => t.stop())
          if (tabStream.getAudioTracks().length > 0) {
            const tabSource = ctx.createMediaStreamSource(tabStream)
            tabSource.connect(analyser)
            toast.success('Tab audio captured')
          } else {
            toast('No tab audio detected. Select a tab with audio.', { icon: '⚠️' })
          }
        } catch (e) {
          toast('Tab sharing cancelled. Using mic only.', { icon: 'ℹ️' })
        }
      }

      // Start waveform
      drawWaveform()

      // ★ Set active BEFORE creating recognition so the ref is true
      setIsActive(true)
      isActiveRef.current = true

      // Speech Recognition
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = sourceLangRef.current === 'auto' ? (localStorage.getItem('micLang') || 'en-US') : sourceLangRef.current

      rec.onresult = (e) => {
        let final = '', interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript
          else interim += e.results[i][0].transcript
        }
        if (interim) setCurrentTranscript(interim)
        if (final) {
          setCurrentTranscript('')
          handleSpeechResult(final.trim())
        }
      }

      // ★ FIX: Use ref instead of state to check if still active
      rec.onend = () => {
        if (isActiveRef.current) {
          setTimeout(() => {
            try {
              const newRec = new SR()
              newRec.continuous = true
              newRec.interimResults = true
              newRec.lang = sourceLangRef.current === 'auto' ? (localStorage.getItem('micLang') || 'en-US') : sourceLangRef.current
              newRec.onresult = rec.onresult
              newRec.onend = rec.onend
              newRec.onerror = rec.onerror
              recognitionRef.current = newRec
              newRec.start()
            } catch(e) { console.warn('Recognition restart failed:', e) }
          }, 300)
        }
      }

      rec.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('Speech error:', e.error)
        }
      }

      recognitionRef.current = rec
      rec.start()

      setStatus('listening')
      setSummary(null)
      startTimeRef.current = Date.now()
      lastSpeechRef.current = Date.now()
      currentSpeakerRef.current = 1
      toast.success('🔴 Live translation started')
    } catch (e) {
      toast.error('Mic access denied')
    }
  }, [captureMode, drawWaveform, handleSpeechResult])

  // Stop session
  const stopSession = useCallback(() => {
    isActiveRef.current = false
    if (recognitionRef.current) { try { recognitionRef.current.abort() } catch(e) {} recognitionRef.current = null }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null }
    if (tabStreamRef.current) { tabStreamRef.current.getTracks().forEach(t => t.stop()); tabStreamRef.current = null }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    analyserRef.current = null
    voice.stop()
    setIsActive(false)
    setStatus('idle')
    setCurrentTranscript('')
    setLatestSubtitle('')
    toast('Live translation stopped', { icon: '⏹️' })
  }, [voice])

  // Generate AI summary
  const generateSummary = useCallback(async () => {
    if (entries.length === 0) { toast.error('No conversation to summarize'); return }
    setIsGeneratingSummary(true)
    try {
      const res = await axios.post('/api/summarize', {
        entries: entries.map(e => ({ speaker: e.speaker, original: e.original, detectedLang: e.detectedLang })),
        duration_ms: sessionDuration
      })
      setSummary(res.data.summary)
    } catch { setSummary('Failed to generate summary.') }
    setIsGeneratingSummary(false)
  }, [entries, sessionDuration])

  // Export transcript
  const exportTranscript = useCallback((format) => {
    if (entries.length === 0) { toast.error('No data to export'); return }
    const mins = Math.floor(sessionDuration / 60000)
    const secs = Math.floor((sessionDuration % 60000) / 1000)
    let content = `=== LinguaAI Live Translation Transcript ===\nDate: ${new Date().toLocaleDateString()}\nDuration: ${mins}m ${secs}s\nTarget Language: ${LANGUAGES.find(l => l.code === liveTargetLang)?.name || liveTargetLang}\n\n`

    entries.forEach(e => {
      content += `[${e.timestamp}] ${e.speaker}:\n  Original: ${e.original}\n  Translated: ${e.translated}\n\n`
    })
    if (summary) content += `\n${summary}\n`

    if (format === 'txt') {
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `live-translation-${Date.now()}.txt`
      a.click(); URL.revokeObjectURL(url)
      toast.success('Transcript exported')
    } else {
      const w = window.open('', '_blank')
      w.document.write(`<html><head><title>Live Translation Transcript</title><style>body{font-family:monospace;padding:40px;background:#0a111a;color:#EAF2FF;line-height:1.8}h1{color:#00E5FF}h2{color:#A3FF12}.entry{margin:16px 0;padding:12px;border-left:3px solid #00E5FF;background:rgba(0,229,255,0.04)}.speaker{font-weight:bold;color:#00E5FF}.original{color:#EAF2FF}.translated{color:#A3FF12;font-style:italic}.time{color:#475569;font-size:0.85em}pre{white-space:pre-wrap;color:#94A3B8}</style></head><body>`)
      w.document.write(`<h1>🌐 LinguaAI Live Translation</h1><p class="time">Date: ${new Date().toLocaleDateString()} | Duration: ${mins}m ${secs}s</p>`)
      entries.forEach(e => {
        w.document.write(`<div class="entry"><span class="speaker">[${e.timestamp}] ${e.speaker}</span><br/><span class="original">${e.original}</span><br/><span class="translated">→ ${e.translated}</span></div>`)
      })
      if (summary) w.document.write(`<h2>Summary</h2><pre>${summary}</pre>`)
      w.document.write('</body></html>')
      w.document.close()
      w.print()
    }
  }, [entries, liveTargetLang, summary, sessionDuration])

  // Cleanup
  useEffect(() => { return () => { isActiveRef.current = false; stopSession() } }, [])

  const formatDuration = (ms) => {
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const targetLangs = LANGUAGES.filter(l => l.code !== 'auto')

  return (
    <div className="live-panel">
      {/* Header */}
      <div className="live-header">
        <div className="live-header-left">
          <div className={`live-indicator ${isActive ? 'active' : ''}`}>
            <span className="live-dot" /> {isActive ? 'LIVE' : 'OFFLINE'}
          </div>
          {isActive && <span className="live-timer">{formatDuration(sessionDuration)}</span>}
        </div>
        <div className="live-header-right">
          <span className={`live-status-badge ${status}`}>
            {status === 'idle' ? '◯ Ready' : status === 'listening' ? '● Listening' : status === 'translating' ? '⟳ Translating' : '♫ Speaking'}
          </span>
        </div>
      </div>

      {/* Controls Row */}
      <div className="live-controls-row">
        <div className="live-lang-group">
          <div className="live-lang-item">
            <label>Source</label>
            <select value={liveSourceLang} onChange={e => setLiveSourceLang(e.target.value)} disabled={isActive} className="lang-select">
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
          <span className="live-arrow">→</span>
          <div className="live-lang-item">
            <label>Target</label>
            <select value={liveTargetLang} onChange={e => setLiveTargetLang(e.target.value)} className="lang-select">
              {targetLangs.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
        </div>

        <div className="live-mode-group">
          <select value={captureMode} onChange={e => setCaptureMode(e.target.value)} disabled={isActive} className="lang-select" title="Audio source">
            <option value="mic">Mic Only</option>
            <option value="tab">Tab Audio</option>
            <option value="both">Both</option>
          </select>
          <select value={speakerCount} onChange={e => setSpeakerCount(Number(e.target.value))} disabled={isActive} className="lang-select" title="Number of speakers">
            <option value={1}>1 Speaker</option>
            <option value={2}>2 Speakers</option>
            <option value={3}>3 Speakers</option>
          </select>
        </div>

        <button className={`live-start-btn ${isActive ? 'stop' : ''}`} onClick={isActive ? stopSession : startSession}>
          {isActive ? <><FiSquare size={14} /> Stop</> : <><FiPlay size={14} /> Start Live</>}
        </button>
      </div>

      {/* Waveform */}
      <div className="live-waveform-container">
        <canvas ref={canvasRef} className="live-waveform-canvas" />
        {!isActive && <div className="waveform-placeholder">Waveform will appear when live session starts</div>}
      </div>

      {/* Transcript */}
      <div className="live-transcript" ref={scrollRef}>
        {entries.length === 0 && !isActive && (
          <div className="live-empty">
            <div className="live-empty-icon"></div>
            <p>Start a live session to translate conversations in real-time</p>
            <p className="live-empty-sub">Works with phone calls, Google Meet, Zoom, Discord, Teams & more</p>
          </div>
        )}
        {entries.length === 0 && isActive && (
          <div className="live-empty">
            <div className="live-empty-icon"></div>
            <p>Listening... Start speaking to see live translations</p>
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="live-entry" style={{ '--speaker-color': SPEAKER_COLORS[(parseInt(e.speaker.split(' ')[1]) - 1) % SPEAKER_COLORS.length] }}>
            <div className="live-entry-header">
              <span className="live-speaker" style={{ color: SPEAKER_COLORS[(parseInt(e.speaker.split(' ')[1]) - 1) % SPEAKER_COLORS.length] }}>
                {e.speaker}
              </span>
              <span className="live-time">{e.timestamp}</span>
              {e.detectedLang && <span className="live-lang-badge">{e.detectedLang}</span>}
            </div>
            <div className="live-original">{e.original}</div>
            <div className="live-translated">→ {e.translated}</div>
          </div>
        ))}
        {currentTranscript && (
          <div className="live-entry interim-entry">
            <div className="live-original interim-text">
              <span className="typing-dots">●●●</span> {currentTranscript}
            </div>
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="live-toolbar">
        <button className={`live-tool-btn ${isMuted ? 'active-red' : ''}`} onClick={() => setIsMuted(!isMuted)} title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? <FiVolumeX size={15} /> : <FiVolume2 size={15} />}
          <span>{isMuted ? 'Muted' : 'Voice On'}</span>
        </button>
        <button className={`live-tool-btn ${showSubtitles ? 'active-cyan' : ''}`} onClick={() => setShowSubtitles(!showSubtitles)} title="Toggle subtitles">
          <FiType size={15} /><span>Subtitles</span>
        </button>
        <button className="live-tool-btn" onClick={() => setShowControls(!showControls)} title="Settings">
          <FiSettings size={15} /><span>Settings</span>
        </button>
        <button className="live-tool-btn" onClick={() => exportTranscript('txt')} disabled={entries.length === 0} title="Export TXT">
          <FiDownload size={15} /><span>Export TXT</span>
        </button>
        <button className="live-tool-btn" onClick={() => exportTranscript('pdf')} disabled={entries.length === 0} title="Export PDF">
          <FiDownload size={15} /><span>Export PDF</span>
        </button>
        <button className="live-tool-btn violet" onClick={generateSummary} disabled={entries.length === 0 || isGeneratingSummary} title="AI Summary">
          <FiCpu size={15} /><span>{isGeneratingSummary ? 'Generating...' : 'AI Summary'}</span>
        </button>
        <button className="live-tool-btn red" onClick={() => { setEntries([]); setSummary(null); setSessionDuration(0) }} disabled={entries.length === 0} title="Clear">
          <FiTrash2 size={15} /><span>Clear</span>
        </button>
      </div>

      {/* Subtitle settings */}
      {showControls && (
        <div className="live-settings">
          <div className="live-setting-item">
            <label>Subtitle Size: {subtitleSize}px</label>
            <input type="range" min="12" max="36" value={subtitleSize} onChange={e => setSubtitleSize(Number(e.target.value))} className="voice-slider" />
          </div>
          <div className="live-setting-item">
            <label>Subtitle Opacity: {Math.round(subtitleOpacity * 100)}%</label>
            <input type="range" min="30" max="100" value={subtitleOpacity * 100} onChange={e => setSubtitleOpacity(e.target.value / 100)} className="voice-slider" />
          </div>
        </div>
      )}

      {/* AI Summary */}
      {summary && (
        <div className="live-summary">
          <div className="live-summary-title"><FiCpu size={14} /> AI Summary</div>
          <pre className="live-summary-text">{summary}</pre>
        </div>
      )}

      {/* Floating Subtitles */}
      {showSubtitles && latestSubtitle && isActive && (
        <div className="live-subtitle-overlay" style={{ fontSize: subtitleSize, opacity: subtitleOpacity }}>
          <div className="live-subtitle-text">{latestSubtitle}</div>
        </div>
      )}
    </div>
  )
}

export default LiveTranslation
