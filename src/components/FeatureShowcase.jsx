import React, { useState, useRef, useEffect } from 'react';

const FeatureShowcase = () => {
  const [hoveredCard, setHoveredCard] = useState(0); // Default to first card (index 0)
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const annotationVideoRef = useRef(null);
  const highlightVideoRef = useRef(null);
  const unifiedVideoRef = useRef(null);

  // Restart video when switching to panels with videos (cards 0, 1, and 3)
  useEffect(() => {
    if (hoveredCard === 0 && annotationVideoRef.current) {
      annotationVideoRef.current.currentTime = 0;
      annotationVideoRef.current.play().catch(error => {
        console.log('Annotation video autoplay prevented:', error);
      });
    } else if (hoveredCard === 1 && highlightVideoRef.current) {
      highlightVideoRef.current.currentTime = 0;
      highlightVideoRef.current.play().catch(error => {
        console.log('Highlight video autoplay prevented:', error);
      });
    } else if (hoveredCard === 3 && unifiedVideoRef.current) {
      unifiedVideoRef.current.currentTime = 0;
      unifiedVideoRef.current.play().catch(error => {
        console.log('Unified video autoplay prevented:', error);
      });
    }
  }, [hoveredCard]);

  // Pause videos when not active
  useEffect(() => {
    if (hoveredCard !== 0 && annotationVideoRef.current) {
      annotationVideoRef.current.pause();
    }
    if (hoveredCard !== 1 && highlightVideoRef.current) {
      highlightVideoRef.current.pause();
    }
    if (hoveredCard !== 3 && unifiedVideoRef.current) {
      unifiedVideoRef.current.pause();
    }
  }, [hoveredCard]);

  const cards = [
    {
      id: 0,
      title: "Real-Time Collaboration",
      description: "Collaborate on chat threads, track updates in real time, and maintain coordinated contributions."
    },
    {
      id: 1,
      title: "Smart Highlighting", 
      description: "Easily highlight, label, and annotate messages to streamline conversation analysis."
    },
    {
      id: 2,
      title: "Unified Workspace",
      description: "Keep all annotations, notes, and discussions organized in one collaborative space."
    },
    {
      id: 3,
      title: "Shared Insights",
      description: "Compare perspectives, align decisions, and capture key takeaways together."
    }
  ];

  const handleCardHover = (cardId) => {
    setHoveredCard(cardId);
  };

  const handleCardLeave = () => {
    // Don't reset hover state when leaving a card - keep current selection
  };

  const handlePanelClick = () => {
    // Cycle through panels when clicking the large panel
    setHoveredCard((prev) => (prev + 1) % cards.length);
  };

  const handlePreviousPanel = () => {
    setHoveredCard((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const handleNextPanel = () => {
    setHoveredCard((prev) => (prev + 1) % cards.length);
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const panelWidth = rect.width;
    
    // Show left arrow when mouse is in left 20% of panel
    setShowLeftArrow(x < panelWidth * 0.2);
    
    // Show right arrow when mouse is in right 20% of panel
    setShowRightArrow(x > panelWidth * 0.8);
  };

  const handleMouseLeave = () => {
    setShowLeftArrow(false);
    setShowRightArrow(false);
  };

  return (
      <section style={{
        padding: '40px 20px 40px 20px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
      {/* Cards Grid */}
      <div className="feature-grid" style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '18px',
        marginBottom: '22px'
      }}>
        {/* Connecting line behind the cards */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '0',
          right: '0',
          height: '2px',
          backgroundColor: '#e5e5e5',
          zIndex: 0,
          transform: 'translateY(-50%)'
        }}></div>
        {cards.map((card) => (
          <div
            key={card.id}
            className={`feature-showcase-card ${hoveredCard === card.id ? 'active' : ''}`}
            onMouseEnter={() => handleCardHover(card.id)}
            onMouseLeave={handleCardLeave}
            style={{
              borderRadius: '12px',
              padding: '24px 20px',
              fontFamily: '"Inter", "Inter Fallback", system-ui, sans-serif',
              backgroundColor: hoveredCard === card.id ? '#ffffff' : '#f8f8f6',
              border: hoveredCard === card.id ? '2px solid #e5e5e5' : '2px solid transparent',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              position: 'relative',
              zIndex: 1
            }}
          >
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1a1a1a',
              margin: '0 0 12px 0',
              lineHeight: '1.5'
            }}>
              {card.title}
            </h3>
            <p style={{
              fontSize: '15px',
              fontWeight: '400',
              color: '#666666',
              margin: '0',
              lineHeight: '1.6'
            }}>
              {card.description}
            </p>
          </div>
        ))}
      </div>

      {/* Preview Screen */}
      <div 
        onClick={handlePanelClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          backgroundColor: '#ffffff',
          border: '2px solid #e5e5e5',
          borderRadius: '12px',
          height: '100%',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.09)',
          transition: 'opacity 0.4s ease',
          opacity: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"Inter", "Inter Fallback", system-ui, sans-serif',
          overflow: 'hidden',
          position: 'relative',
          cursor: 'pointer'
        }}>
        {hoveredCard === 0 ? (
          // Real-Time Collaboration - Show annotation window video
          <video
            key="annotation-video"
            ref={annotationVideoRef}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: '10px'
            }}
          >
            <source src="/extension/img/annotationwindow.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : hoveredCard === 1 ? (
          // Smart Highlighting - Show highlight video
          <video
            key="highlight-video"
            ref={highlightVideoRef}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: '10px'
            }}
          >
            <source src="/extension/img/highlight.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : hoveredCard === 2 ? (
          // Unified Workspace - Show thirdPanel image
          <img
            src="/extension/img/thirdPanel.png"
            alt="Unified Workspace"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: '10px'
            }}
          />
        ) : hoveredCard === 3 ? (
          // Shared Insights - Show unified video
          <video
            key="unified-video"
            ref={unifiedVideoRef}
            autoPlay
            loop
            muted
            playsInline
            controls={false}
            preload="auto"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: '10px'
            }}
            onLoadedData={() => {
              if (unifiedVideoRef.current) {
                unifiedVideoRef.current.play().catch(console.error);
              }
            }}
          >
            <source src="/extension/img/unified.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          // Other panels - Show placeholder text
          <div style={{
            color: '#737373',
            fontSize: '16px',
            fontWeight: '400',
            textAlign: 'center'
          }}>
            Preview content for {cards[hoveredCard].title}
            <br />
            <span style={{ fontSize: '14px', marginTop: '8px', display: 'block' }}>
              (Empty placeholder - content will be added later)
            </span>
          </div>
        )}
        
        {/* Left Arrow Button */}
        {showLeftArrow && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePreviousPanel();
            }}
            style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e5e5',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: '8px',
              cursor: 'pointer',
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#333333',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#ffffff';
              e.target.style.transform = 'translateY(-50%) scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
              e.target.style.transform = 'translateY(-50%) scale(1)';
            }}
          >
            ←
          </button>
        )}

        {/* Right Arrow Button */}
        {showRightArrow && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNextPanel();
            }}
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e5e5',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: '8px',
              cursor: 'pointer',
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#333333',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#ffffff';
              e.target.style.transform = 'translateY(-50%) scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
              e.target.style.transform = 'translateY(-50%) scale(1)';
            }}
          >
            →
          </button>
        )}
      </div>

    </section>
  );
};

export default FeatureShowcase;
