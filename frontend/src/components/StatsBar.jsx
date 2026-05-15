import { FiZap, FiGlobe, FiBookOpen, FiMic } from 'react-icons/fi'

const StatsBar = ({ stats, assistantState }) => {
  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-icon cyan"><FiZap /></div>
        <div><div className="stat-value">{stats.total}</div><div className="stat-label">Translations</div></div>
      </div>
      <div className="stat-card">
        <div className="stat-icon blue"><FiGlobe /></div>
        <div><div className="stat-value">{stats.languages}</div><div className="stat-label">Languages</div></div>
      </div>
      <div className="stat-card">
        <div className="stat-icon violet"><FiBookOpen /></div>
        <div><div className="stat-value">{stats.words.toLocaleString()}</div><div className="stat-label">Words</div></div>
      </div>
      <div className="stat-card">
        <div className="stat-icon emerald"><FiMic /></div>
        <div><div className="stat-value" style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>{assistantState}</div><div className="stat-label">Assistant</div></div>
      </div>
    </div>
  )
}
export default StatsBar
