import { FiSettings } from 'react-icons/fi'

const VoiceSettings = ({ voice }) => {
  const { settings, updateSettings, voices } = voice
  const langVoices = voices.filter(v => v.lang.startsWith('en'))

  return (
    <div className="voice-settings">
      <div className="voice-settings-title"><FiSettings size={13} /> Voice Settings</div>
      <div className="voice-settings-grid">
        <div className="voice-setting-item">
          <div className="voice-setting-label">Speed <span className="voice-setting-value">{settings.rate.toFixed(1)}x</span></div>
          <input type="range" className="voice-slider" min="0.3" max="2" step="0.1" value={settings.rate} onChange={e => updateSettings({ rate: +e.target.value })} />
        </div>
        <div className="voice-setting-item">
          <div className="voice-setting-label">Pitch <span className="voice-setting-value">{settings.pitch.toFixed(1)}</span></div>
          <input type="range" className="voice-slider" min="0.3" max="2" step="0.1" value={settings.pitch} onChange={e => updateSettings({ pitch: +e.target.value })} />
        </div>
        <div className="voice-setting-item">
          <div className="voice-setting-label">Volume <span className="voice-setting-value">{Math.round(settings.volume * 100)}%</span></div>
          <input type="range" className="voice-slider" min="0" max="1" step="0.1" value={settings.volume} onChange={e => updateSettings({ volume: +e.target.value })} />
        </div>
      </div>
      {langVoices.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="voice-setting-label" style={{ marginBottom: 6 }}>Voice</div>
          <select className="voice-select" style={{ width: '100%' }} value={settings.voiceIndex} onChange={e => updateSettings({ voiceIndex: +e.target.value })}>
            {langVoices.map((v, i) => <option key={i} value={i}>{v.name} ({v.lang})</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
export default VoiceSettings
