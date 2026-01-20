export default function TimelineNav() {
  const handleDotClick = (index) => {
    const sections = ['hero', 'platforms', 'demonstration'];
    document.querySelector(`.${sections[index]}`).scrollIntoView({ 
      behavior: 'smooth' 
    });
  };

  return (
    <div className="timeline-nav">
      <div className="timeline-dot" data-section="Home" onClick={() => handleDotClick(0)}></div>
      <div className="timeline-dot" data-section="Essential Tools" onClick={() => handleDotClick(1)}></div>
      <div className="timeline-dot" data-section="Demonstration" onClick={() => handleDotClick(2)}></div>
    </div>
  );
} 