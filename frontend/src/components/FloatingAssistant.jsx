/**
 * FloatingAssistant — Siri-like floating voice assistant bubble
 * 
 * Features:
 * - Draggable across screen (touch + mouse)
 * - Single tap → Activate voice
 * - Double tap → Quick re-translate last input
 * - Long press → Expand options panel
 * - Visual states: idle/listening/processing/speaking
 * - Expandable mini-panel with status + quick actions
 * - Snaps to edges when released
 * - Customizable icon style
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { FiMic, FiSettings, FiVolume2, FiX, FiRefreshCw, FiZap } from 'react-icons/fi'

const ICON_STYLES = ['orb', 'mic', 'ai']
const SNAP_MARGIN = 16 // px from screen edge

const FloatingAssistant = ({
  assistantState,
  onActivate,
  onDeactivate,
  onQuickTranslate,
  translatedText,
  targetLang,
  voice,
  liveTranscript,
}) => {
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('fab_position')
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 80, y: window.innerHeight - 160 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [iconStyle, setIconStyle] = useState(() => localStorage.getItem('fab_icon') || 'orb')
  const [fabSize, setFabSize] = useState(() => Number(localStorage.getItem('fab_size')) || 56)
  const [showCustomize, setShowCustomize] = useState(false)
  const [statusText, setStatusText] = useState('')

  const dragRef = useRef(null)
  const dragStartRef = useRef({ x: 0, y: 0, px: 0, py: 0, moved: false })
  const longPressTimer = useRef(null)
  const doubleTapTimer = useRef(null)
  const tapCountRef = useRef(0)

  const isActive = assistantState !== 'sleeping'
  const isListening = assistantState === 'listening'
  const isProcessing = assistantState === 'processing'
  const isSpeaking = assistantState === 'speaking'

  // Update status text
  useEffect(() => {
    if (isListening) setStatusText('Listening...')
    else if (isProcessing) setStatusText('Translating...')
    else if (isSpeaking) setStatusText("Here's your result")
    else if (isActive) setStatusText('Ready')
    else setStatusText('')
  }, [assistantState, isActive, isListening, isProcessing, isSpeaking])

  // Auto-expand when active
  useEffect(() => {
    if (isListening || isProcessing || isSpeaking) setIsExpanded(true)
  }, [isListening, isProcessing, isSpeaking])

  // Auto-collapse when sleeping
  useEffect(() => {
    if (assistantState === 'sleeping') {
      const t = setTimeout(() => setIsExpanded(false), 2000)
      return () => clearTimeout(t)
    }
  }, [assistantState])

  // Save position
  useEffect(() => {
    localStorage.setItem('fab_position', JSON.stringify(position))
  }, [position])

  // Save prefs
  useEffect(() => { localStorage.setItem('fab_icon', iconStyle) }, [iconStyle])
  useEffect(() => { localStorage.setItem('fab_size', String(fabSize)) }, [fabSize])

  // Snap to nearest edge
  const snapToEdge = useCallback((x, y) => {
    const w = window.innerWidth
    const h = window.innerHeight
    const centerX = x + fabSize / 2
    const snapX = centerX < w / 2 ? SNAP_MARGIN : w - fabSize - SNAP_MARGIN
    const snapY = Math.max(SNAP_MARGIN, Math.min(y, h - fabSize - SNAP_MARGIN))
    return { x: snapX, y: snapY }
  }, [fabSize])

  // ── Drag handling (pointer events for both touch & mouse) ──
  const handlePointerDown = useCallback((e) => {
    if (e.target.closest('.fab-panel-inner')) return // Don't drag from panel clicks
    e.preventDefault()
    
    dragStartRef.current = {
      x: e.clientX, y: e.clientY,
      px: position.x, py: position.y,
      moved: false,
    }

    // Start long-press timer (500ms)
    longPressTimer.current = setTimeout(() => {
      if (!dragStartRef.current.moved) {
        setIsExpanded(true)
        setShowCustomize(true)
        // Haptic feedback on supported devices
        if (navigator.vibrate) navigator.vibrate(30)
      }
    }, 500)

    setIsDragging(true)
    if (dragRef.current) dragRef.current.setPointerCapture(e.pointerId)
  }, [position])

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragStartRef.current.moved = true
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }

    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - fabSize, dragStartRef.current.px + dx)),
      y: Math.max(0, Math.min(window.innerHeight - fabSize, dragStartRef.current.py + dy)),
    })
  }, [isDragging, fabSize])

  const handlePointerUp = useCallback((e) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    setIsDragging(false)

    if (dragStartRef.current.moved) {
      // Snap to edge
      setPosition(snapToEdge(
        dragStartRef.current.px + (e.clientX - dragStartRef.current.x),
        dragStartRef.current.py + (e.clientY - dragStartRef.current.y)
      ))
      return
    }

    // Handle taps (not a drag)
    tapCountRef.current++
    
    if (tapCountRef.current === 1) {
      doubleTapTimer.current = setTimeout(() => {
        // Single tap
        if (tapCountRef.current === 1) {
          handleSingleTap()
        }
        tapCountRef.current = 0
      }, 200)
    } else if (tapCountRef.current === 2) {
      // Double tap
      clearTimeout(doubleTapTimer.current)
      tapCountRef.current = 0
      handleDoubleTap()
    }
  }, [snapToEdge])

  const handleSingleTap = () => {
    if (assistantState === 'sleeping' || assistantState === 'idle') {
      onActivate?.()
      setIsExpanded(true)
    } else if (isListening) {
      // Already listening — collapse
      setIsExpanded(!isExpanded)
    } else if (isSpeaking) {
      voice?.stop()
    }
  }

  const handleDoubleTap = () => {
    if (onQuickTranslate) {
      onQuickTranslate()
      if (navigator.vibrate) navigator.vibrate([50, 30, 50])
    }
  }

  // Render icon based on style and state
  const renderIcon = () => {
    if (isListening) {
      return (
        <div className="fab-waves">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="fab-wave-bar" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      )
    }
    if (isSpeaking) {
      return (
        <div className="fab-waves speaking">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="fab-wave-bar" style={{ animationDelay: `${i * 0.06}s` }} />
          ))}
        </div>
      )
    }
    if (isProcessing) {
      return <div className="fab-spinner" />
    }

    // Idle icons
    switch (iconStyle) {
      case 'mic': return <FiMic size={fabSize * 0.38} />
      case 'ai': return <span className="fab-ai-face">AI</span>
      default: return <div className="fab-orb-inner" />
    }
  }

  // Get state class
  const stateClass = isListening ? 'listening' : isProcessing ? 'processing' : isSpeaking ? 'speaking' : isActive ? 'active' : 'idle'

  return (
    <>
      {/* Floating bubble */}
      <div
        ref={dragRef}
        className={`floating-fab ${stateClass} ${isDragging ? 'dragging' : ''} ${isExpanded ? 'expanded' : ''}`}
        style={{
          left: position.x,
          top: position.y,
          width: fabSize,
          height: fabSize,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="button"
        aria-label="Voice Assistant"
      >
        {/* Ripple rings */}
        {(isListening || isSpeaking) && (
          <>
            <div className="fab-ripple" />
            <div className="fab-ripple delay-1" />
            <div className="fab-ripple delay-2" />
          </>
        )}

        {/* Processing ring */}
        {isProcessing && <div className="fab-process-ring" />}

        {/* Idle glow */}
        {!isActive && <div className="fab-glow" />}

        {/* Icon */}
        <div className="fab-icon-inner">
          {renderIcon()}
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div
          className={`fab-panel ${stateClass}`}
          style={{
            left: position.x < window.innerWidth / 2
              ? position.x
              : position.x - 240 + fabSize,
            top: position.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="fab-panel-inner">
            {/* Status */}
            <div className="fab-status-row">
              <div className={`fab-status-dot ${stateClass}`} />
              <span className="fab-status-text">{statusText || 'Tap to speak'}</span>
              <button className="fab-close" onClick={(e) => { e.stopPropagation(); setIsExpanded(false); setShowCustomize(false) }}>
                <FiX size={14} />
              </button>
            </div>

            {/* Live transcript */}
            {liveTranscript && (
              <div className="fab-transcript">
                <span className="fab-transcript-dots">●●●</span> {liveTranscript}
              </div>
            )}

            {/* Last translation */}
            {translatedText && !isListening && (
              <div className="fab-result">
                <div className="fab-result-text">{translatedText}</div>
                <button className="fab-result-speak" onClick={(e) => {
                  e.stopPropagation()
                  voice?.speak(translatedText, targetLang)
                }}>
                  <FiVolume2 size={13} />
                </button>
              </div>
            )}

            {/* Quick actions */}
            <div className="fab-actions">
              {assistantState === 'sleeping' ? (
                <button className="fab-action-btn primary" onClick={(e) => { e.stopPropagation(); onActivate?.() }}>
                  <FiMic size={13} /> Speak
                </button>
              ) : (
                <button className="fab-action-btn danger" onClick={(e) => { e.stopPropagation(); onDeactivate?.() }}>
                  <FiX size={13} /> Stop
                </button>
              )}
              {translatedText && (
                <button className="fab-action-btn" onClick={(e) => { e.stopPropagation(); onQuickTranslate?.() }}>
                  <FiRefreshCw size={13} /> Re-translate
                </button>
              )}
              <button className="fab-action-btn" onClick={(e) => { e.stopPropagation(); setShowCustomize(!showCustomize) }}>
                <FiSettings size={13} />
              </button>
            </div>

            {/* Customize panel */}
            {showCustomize && (
              <div className="fab-customize">
                <div className="fab-customize-row">
                  <label>Icon Style</label>
                  <div className="fab-style-options">
                    {ICON_STYLES.map(s => (
                      <button
                        key={s}
                        className={`fab-style-btn ${iconStyle === s ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setIconStyle(s) }}
                      >
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fab-customize-row">
                  <label>Size: {fabSize}px</label>
                  <input
                    type="range" min="40" max="72" value={fabSize}
                    onChange={(e) => { e.stopPropagation(); setFabSize(Number(e.target.value)) }}
                    onClick={(e) => e.stopPropagation()}
                    className="voice-slider"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default FloatingAssistant
