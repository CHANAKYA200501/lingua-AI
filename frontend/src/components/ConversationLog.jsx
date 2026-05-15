import { useRef, useEffect } from 'react'
import { FiMessageCircle } from 'react-icons/fi'

const ConversationLog = ({ entries }) => {
  const scrollRef = useRef(null)
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [entries.length])

  return (
    <div className="convo-log" ref={scrollRef}>
      <div className="convo-log-title"><FiMessageCircle size={13} style={{ marginRight: 6 }} /> Conversation Log</div>
      {entries.map((e, i) => (
        <div key={i} className="convo-entry">
          <div className={`convo-who ${e.who}`}>
            {e.who === 'user' ? 'You' : 'Lexa'}
          </div>
          <div className="convo-text">{e.text}</div>
        </div>
      ))}
    </div>
  )
}
export default ConversationLog
