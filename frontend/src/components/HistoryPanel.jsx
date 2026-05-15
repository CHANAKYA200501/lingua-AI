import { FiClock, FiTrash2, FiVolume2, FiCopy } from 'react-icons/fi'
import toast from 'react-hot-toast'

const formatTime = (iso) => {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const HistoryPanel = ({ history, setHistory, voice }) => {
  const handleCopy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!') }
  const handleDelete = (id) => { setHistory(prev => prev.filter(i => i.id !== id)); toast.success('Removed') }

  return (
    <div className="history-panel">
      <div className="history-header">
        <h2 className="history-title"><span className="gradient-text">Translation</span> History</h2>
        {history.length > 0 && <button className="history-clear-btn" onClick={() => { setHistory([]); toast.success('History cleared') }}><FiTrash2 size={12} style={{ marginRight: 4 }} />Clear All</button>}
      </div>
      {history.length === 0 ? (
        <div className="history-empty"><div className="history-empty-icon">📝</div><p className="history-empty-text">No translations yet. Start translating!</p></div>
      ) : (
        <div className="history-list">
          {history.map(item => (
            <div key={item.id} className="history-item">
              <div className="history-item-meta">
                <span className="history-lang-badge">{item.sourceLang?.toUpperCase()}</span>
                <span className="history-arrow">→</span>
                <span className="history-lang-badge" style={{ background: 'rgba(0,212,255,0.08)', color: 'var(--accent-cyan)', borderColor: 'rgba(0,212,255,0.15)' }}>{item.targetLang?.toUpperCase()}</span>
                <span className="history-time"><FiClock size={10} style={{ marginRight: 3 }} />{formatTime(item.timestamp)}</span>
                <button className="icon-btn" onClick={() => handleDelete(item.id)} style={{ marginLeft: 4 }}><FiTrash2 size={11} /></button>
              </div>
              <div className="history-texts">
                <div className="history-text-block">
                  <div className="history-text-label">Original</div>
                  <p>{item.sourceText}</p>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <button className="icon-btn" onClick={() => handleCopy(item.sourceText)}><FiCopy size={11} /></button>
                    <button className="icon-btn" onClick={() => voice.speak(item.sourceText, item.sourceLang)}><FiVolume2 size={11} /></button>
                  </div>
                </div>
                <div className="history-text-block">
                  <div className="history-text-label" style={{ color: 'var(--accent-cyan)' }}>Translated</div>
                  <p style={{ color: 'var(--accent-cyan)' }}>{item.translatedText}</p>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <button className="icon-btn" onClick={() => handleCopy(item.translatedText)}><FiCopy size={11} /></button>
                    <button className="icon-btn" onClick={() => voice.speak(item.translatedText, item.targetLang)}><FiVolume2 size={11} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
export default HistoryPanel
