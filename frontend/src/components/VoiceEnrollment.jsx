import { useState, useEffect, useRef } from 'react'

const VoiceEnrollment = ({ voiceProfile, onComplete, onCancel }) => {
  const { enrollStep, requiredSamples, recordEnrollSample, startEnrollment, cancelEnrollment } = voiceProfile
  const [listening, setListening] = useState(false)
  const [feedback, setFeedback] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => {
    startEnrollment()
    return () => cancelEnrollment()
  }, [])

  const listenForPhrase = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setFeedback('Speech recognition not supported. Use Chrome.'); return }

    if (recognitionRef.current) { recognitionRef.current.abort() }

    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'
    setListening(true)
    setFeedback('Say "Hey Lexa" now...')

    rec.onresult = (e) => {
      const text = e.results[0][0].transcript.toLowerCase().trim()
      if (text.includes('lexa') || text.includes('hey')) {
        // Capture voice features at this moment
        const done = recordEnrollSample()
        if (done) {
          setFeedback('Voice training complete! Your voice is now registered.')
          setListening(false)
          setTimeout(() => onComplete(), 1500)
        } else {
          setFeedback(`Sample ${enrollStep + 1} recorded! Say it again.`)
          setListening(false)
        }
      } else {
        setFeedback(`I heard "${text}". Please say "Hey Lexa".`)
        setListening(false)
      }
    }

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') setFeedback('Mic error: ' + e.error)
      setListening(false)
    }
    rec.onend = () => setListening(false)

    recognitionRef.current = rec
    rec.start()
  }

  const handleCancel = () => {
    if (recognitionRef.current) recognitionRef.current.abort()
    cancelEnrollment()
    onCancel()
  }

  return (
    <div className="enrollment-overlay">
      <div className="enrollment-modal">
        <div className="enrollment-icon">👤</div>
        <h2 className="enrollment-title">
          <span className="gradient-text">Voice Training</span>
        </h2>
        <p className="enrollment-subtitle">
          Train your voice so only <strong>you</strong> can wake up the assistant.
          <br />Say <strong>"Hey Lexa"</strong> {requiredSamples} times.
        </p>

        {/* Progress dots */}
        <div className="enrollment-progress">
          {Array.from({ length: requiredSamples }).map((_, i) => (
            <div key={i} className={`enrollment-dot ${i < enrollStep ? 'done' : i === enrollStep ? 'current' : ''}`}>
              {i < enrollStep ? '✓' : i + 1}
            </div>
          ))}
        </div>

        <div className="enrollment-feedback">{feedback || `Sample ${enrollStep + 1} of ${requiredSamples}`}</div>

        <div className="enrollment-actions">
          <button
            className={`enrollment-record-btn ${listening ? 'recording' : ''}`}
            onClick={listenForPhrase}
            disabled={listening}
          >
            {listening ? (
              <>
                <span className="rec-dot" /> Listening...
              </>
            ) : (
              <>Record Sample {enrollStep + 1}</>
            )}
          </button>
          <button className="enrollment-cancel-btn" onClick={handleCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default VoiceEnrollment
