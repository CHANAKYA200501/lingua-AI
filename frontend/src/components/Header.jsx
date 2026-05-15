import { FiGlobe, FiClock, FiRadio, FiUser } from 'react-icons/fi'

const Header = ({ activeTab, setActiveTab, assistantState }) => {
  const dotClass = assistantState === 'sleeping' ? 'sleeping' : assistantState === 'listening' ? 'listening' : 'active'
  const statusLabel = assistantState === 'sleeping' ? 'Standby' : assistantState === 'listening' ? 'Listening' : assistantState === 'speaking' ? 'Speaking' : 'Online'

  return (
    <>
      {/* Top header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-logo">
            <img src="/logo.png" alt="LinguaAI Logo" className="logo-img" style={{ width: '40px', height: 'auto', borderRadius: '8px' }} />
            <span className="logo-text gradient-text">LinguaAI</span>
          </div>
          <nav className="header-nav desktop-nav">
            <button className={`nav-btn ${activeTab === 'translate' ? 'active' : ''}`} onClick={() => setActiveTab('translate')}>
              <FiGlobe size={14} /> Translate
            </button>
            <button className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
              <FiClock size={14} /> History
            </button>
            <button className={`nav-btn ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>
              <FiRadio size={14} /> Live
            </button>
          </nav>
          <div className="status-dot">
            <div className={`dot ${dotClass}`} />
            {statusLabel}
          </div>
        </div>
      </header>

      {/* Bottom navigation bar for mobile */}
      <nav className="mobile-bottom-nav">
        <button className={`mobile-nav-btn ${activeTab === 'translate' ? 'active' : ''}`} onClick={() => setActiveTab('translate')}>
          <FiGlobe size={20} />
          <span>Translate</span>
        </button>
        <button className={`mobile-nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <FiClock size={20} />
          <span>History</span>
        </button>
        <button className={`mobile-nav-btn ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>
          <FiRadio size={20} />
          <span>Live</span>
        </button>
      </nav>
    </>
  )
}

export default Header
