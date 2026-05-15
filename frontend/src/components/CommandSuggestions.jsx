import { FiCommand } from 'react-icons/fi'
import { COMMAND_SUGGESTIONS } from '../utils/commandParser'

const CommandSuggestions = () => (
  <div className="cmd-suggestions">
    <div className="cmd-suggestions-title"><FiCommand size={13} /> Voice Commands</div>
    <div className="cmd-grid">
      {COMMAND_SUGGESTIONS.map((c, i) => (
        <div key={i} className="cmd-item">
          <code>{c.cmd}</code>
          <span>{c.desc}</span>
        </div>
      ))}
    </div>
  </div>
)
export default CommandSuggestions
