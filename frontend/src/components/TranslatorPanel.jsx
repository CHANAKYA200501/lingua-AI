import { useRef, useEffect, useCallback } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { FiMic, FiMicOff, FiVolume2, FiCopy, FiArrowRight, FiTrash2 } from 'react-icons/fi'
import { LANGUAGES, getLangName } from '../utils/languages'

const TranslatorPanel = ({
  sourceLang, setSourceLang, targetLang, setTargetLang,
  sourceText, setSourceText, translatedText, setTranslatedText,
  detectedLang, setDetectedLang, confidence, setConfidence,
  isTranslating, doTranslate, voice, addToHistory, updateStats, langSetRef,
  voiceInitiatedRef
}) => {
  const debounceRef = useRef(null)

  useEffect(() => {
    if (sourceLang !== 'auto') langSetRef.current.add(sourceLang)
    langSetRef.current.add(targetLang)
    updateStats({ languages: langSetRef.current.size })
  }, [sourceLang, targetLang])

  useEffect(() => {
    if (!sourceText.trim()) { setTranslatedText(''); setDetectedLang(null); setConfidence(null); return }
    // BUG-05: Skip auto-translate if voice command already triggered it
    if (voiceInitiatedRef?.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doTranslate(sourceText), 900)
    return () => clearTimeout(debounceRef.current)
  }, [sourceText, sourceLang, targetLang])

  const handleTranslateClick = () => { if (debounceRef.current) clearTimeout(debounceRef.current); doTranslate(sourceText) }
  const handleSwap = () => {
    if (sourceLang === 'auto') return
    const p = sourceLang; setSourceLang(targetLang); setTargetLang(p)
    setSourceText(translatedText); setTranslatedText(sourceText); setDetectedLang(null)
  }
  const handleCopy = (text, label) => { if (!text) return; navigator.clipboard.writeText(text); toast.success(`${label} copied!`) }
  const handleClear = () => { setSourceText(''); setTranslatedText(''); setDetectedLang(null); setConfidence(null) }

  return (
    <div>
      <div className="lang-selector-row">
        <div className="lang-select-wrapper">
          <span className="lang-select-label">From</span>
          <select className="lang-select" value={sourceLang} onChange={e => setSourceLang(e.target.value)}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
          </select>
          {detectedLang && <span className="detect-badge">Detected: {getLangName(detectedLang)}</span>}
        </div>
        <button className="swap-btn" onClick={handleSwap} disabled={sourceLang === 'auto'}>⇄</button>
        <div className="lang-select-wrapper">
          <span className="lang-select-label">To</span>
          <select className="lang-select" value={targetLang} onChange={e => setTargetLang(e.target.value)}>
            {LANGUAGES.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
          </select>
        </div>
      </div>

      <div className="text-panels" style={{ marginTop: 16 }}>
        <div className="text-card">
          <div className="text-card-header">
            <span className="text-card-title">Source Text</span>
            <div className="text-card-actions">
              <button className="icon-btn" onClick={() => handleCopy(sourceText, 'Source')} title="Copy"><FiCopy size={13} /></button>
              <button className="icon-btn" onClick={() => voice.speak(sourceText, sourceLang)} title="Listen"><FiVolume2 size={13} /></button>
            </div>
          </div>
          <textarea className="textarea-input" placeholder="Type, speak, or use voice commands..." value={sourceText} onChange={e => setSourceText(e.target.value)} maxLength={5000} />
          <div className="text-card-footer"><span className="char-count">{sourceText.length}/5000</span></div>
        </div>

        <div className="text-card" style={{ borderColor: translatedText ? 'rgba(0,212,255,0.15)' : undefined }}>
          <div className="text-card-header">
            <span className="text-card-title">Translation</span>
            <div className="text-card-actions">
              <button className="icon-btn" onClick={() => handleCopy(translatedText, 'Translation')} disabled={!translatedText}><FiCopy size={13} /></button>
              <button className={`icon-btn ${voice.isSpeaking ? 'speak-active' : ''}`} onClick={() => voice.isSpeaking ? voice.stop() : voice.speak(translatedText, targetLang)} disabled={!translatedText}><FiVolume2 size={13} /></button>
            </div>
          </div>
          <div className="translated-output">
            {isTranslating ? <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center' }}><div className="loading-dots"><span/><span/><span/></div></div>
              : translatedText ? <p>{translatedText}</p> : <p className="translated-placeholder">Translation will appear here...</p>}
          </div>
          {confidence !== null && (
            <div className="confidence-row">
              <span className="confidence-label">Confidence</span>
              <div className="confidence-bar-bg"><div className="confidence-bar-fill" style={{ width: `${Math.round(confidence * 100)}%` }} /></div>
              <span className="confidence-pct">{Math.round(confidence * 100)}%</span>
            </div>
          )}
          <div className="text-card-footer"><span className="char-count">{translatedText.length} chars</span></div>
        </div>
      </div>

      <div className="action-bar" style={{ marginTop: 16 }}>
        <button className="translate-btn" onClick={handleTranslateClick} disabled={isTranslating || !sourceText.trim()}>
          {isTranslating ? <><div className="btn-spinner"/>Translating...</> : <><FiArrowRight size={16}/>Translate Now</>}
        </button>
        <button className="clear-btn" onClick={handleClear} disabled={!sourceText && !translatedText}><FiTrash2 size={14}/>Clear</button>
      </div>
    </div>
  )
}

export default TranslatorPanel
