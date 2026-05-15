const JarvisOrb = ({
  state, onClick, statusText, liveTranscript, isSpeaking,
  passiveListening, hasProfile, onTogglePassive, onTrainVoice, onClearProfile,
  bgService, onToggleBackground,
  micLang, onToggleMicLang, sourceLang
}) => {
  const isActive = state !== 'sleeping'
  const isListening = state === 'listening'
  const isSpeakingState = state === 'speaking'

  return (
    <div className="jarvis-section">
      <div className="jarvis-orb-container" onClick={onClick} role="button" tabIndex={0} aria-label="Toggle Lexa assistant">
        <div className={`jarvis-orb ${state}`}>
          {isActive && (
            <>
              <div className="orb-ripple" />
              <div className="orb-ripple" />
              <div className="orb-ripple" />
            </>
          )}
          {(isListening || isSpeakingState) ? (
            <div className={`orb-waves ${isSpeakingState ? 'speaking' : ''}`}>
              {[...Array(7)].map((_, i) => <div key={i} className="orb-wave-bar" />)}
            </div>
          ) : (
            <div className="orb-icon">
              {state === 'sleeping' ? (passiveListening ? '👤' : '') : state === 'processing' ? '' : ''}
            </div>
          )}
        </div>
        <div className="orb-ring" />
        <div className="orb-ring orb-ring-2" />
      </div>

      <div className={`jarvis-status ${isSpeakingState ? 'speaking-status' : ''}`}>
        {statusText}
      </div>

      {liveTranscript && (
        <div className="jarvis-transcript">
          <span className="interim">"{liveTranscript}"</span>
        </div>
      )}

      {/* Controls — shown when sleeping */}
      {state === 'sleeping' && (
        <>
          <div className="passive-controls">
            <button
              className={`passive-toggle ${passiveListening ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onTogglePassive() }}
            >
              <span className="toggle-dot" />
              {passiveListening ? '"Hey Lexa" Active' : 'Enable "Hey Lexa"'}
            </button>

            <button
              className="train-btn"
              onClick={(e) => { e.stopPropagation(); onTrainVoice() }}
            >
              {hasProfile ? 'Re-Train Voice' : 'Train My Voice'}
            </button>

            {hasProfile && (
              <span className="profile-badge">Voice Trained</span>
            )}
          </div>

          {/* Background Mode Toggle */}
          <div className="passive-controls bg-controls">
            <button
              className={`passive-toggle bg-toggle ${bgService?.isBackgroundActive ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onToggleBackground?.() }}
            >
              <span className="toggle-dot" />
              {bgService?.isBackgroundActive ? 'Background Mode ON' : 'Enable Background Mode'}
            </button>

            {bgService?.isBackgroundActive && (
              <>
                <span className="profile-badge bg-badge">
                  {bgService.wakeLockActive ? 'Screen Lock' : 'Tab Alive'}
                </span>
                {bgService.notificationsGranted && (
                  <span className="profile-badge bg-badge">Alerts ON</span>
                )}
                {bgService.isInBackground && (
                  <span className="profile-badge bg-badge bg-pulse">Running in BG</span>
                )}
              </>
            )}
          </div>
        </>
      )}

      {state === 'listening' && (
        <div className="wake-hint">
          <div className="mic-lang-row">
            <span>Mic: {micLang === 'hi-IN' ? 'Hindi' : micLang === 'en-US' ? 'English' : micLang}</span>
            {(!sourceLang || sourceLang === 'auto') && (
              <button className="mic-lang-toggle" onClick={(e) => { e.stopPropagation(); onToggleMicLang?.() }}>
                Switch to {micLang === 'hi-IN' ? 'English' : 'Hindi'}
              </button>
            )}
          </div>
          Speak your command · Say <kbd>go to sleep</kbd> to deactivate
        </div>
      )}

      {state === 'idle' && (
        <div className="wake-hint">
          Say a command or <kbd>go to sleep</kbd>
        </div>
      )}
    </div>
  )
}

export default JarvisOrb
