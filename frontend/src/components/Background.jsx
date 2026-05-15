const Background = () => {
  // Pre-calculate random positions for 20 particles
  const particles = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 5}s`,
    animationDuration: `${10 + Math.random() * 15}s`
  }))

  return (
    <div className="bg-canvas" aria-hidden="true">
      <div className="bg-grid" />
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />
      <div className="bg-scan" />
      {particles.map(p => (
        <div 
          key={p.id} 
          className="bg-particle" 
          style={{ 
            top: p.top, 
            left: p.left, 
            animationDelay: p.animationDelay, 
            animationDuration: p.animationDuration 
          }} 
        />
      ))}
    </div>
  )
}
export default Background
