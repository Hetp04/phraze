import { useEffect } from 'react';

export default function SlidingRectangles() {
  useEffect(() => {
    // This is just to ensure the component is mounted
    // The animation is handled by CSS
  }, []);

  // App-related text for the rectangles - exactly 6 per row
  const row1Texts = [
    "Precision Annotations",
    "Custom Labels",
    "Conversation Analysis",
    "Model Debugging",
    "Training Data Creation",
    "Performance Metrics"
  ];

  const row2Texts = [
    "Real-time Feedback",
    "Error Detection",
    "Context Tracking",
    "Response Quality",
    "Pattern Recognition",
    "Behavior Analysis"
  ];

  const row3Texts = [
    "Data Export",
    "Model Fine-tuning",
    "Collaborative Tools",
    "Version Control",
    "API Integration",
    "Workflow Automation"
  ];

  // We need to duplicate each row once for the infinite animation to work
  const duplicateForAnimation = (texts) => {
    return [...texts, ...texts];
  };

  const gradientMaskStyle = {
    position: 'relative',
    overflow: 'hidden',
  };

  const leftGradientMask = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '10%',
    height: '100%',
    background: 'linear-gradient(to right, rgb(252,252,250) 0%, rgba(252,252,250,0) 100%)',
    zIndex: 2,
    pointerEvents: 'none',
  };

  const rightGradientMask = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '10%',
    height: '100%',
    background: 'linear-gradient(to left, rgb(252,252,250) 0%, rgba(252,252,250,0) 100%)',
    zIndex: 2,
    pointerEvents: 'none',
  };

  return (
    <div className="sliding-rectangles-container" style={{ background: 'transparent' }}>
      <div className="container">
        <div className="sliding-row" style={gradientMaskStyle}>
          <div style={leftGradientMask}></div>
          <div style={rightGradientMask}></div>
          <div className="sliding-left">
            {duplicateForAnimation(row1Texts).map((text, index) => (
              <div className="sliding-rectangle" key={`row1-${index}`} style={{ 
                background: 'rgb(240,240,240)', 
                color: '#444',
                border: 'none',
                boxShadow: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '400'
              }}>
                {text}
              </div>
            ))}
          </div>
        </div>
        
        <div className="sliding-row" style={gradientMaskStyle}>
          <div style={leftGradientMask}></div>
          <div style={rightGradientMask}></div>
          <div className="sliding-right">
            {duplicateForAnimation(row2Texts).map((text, index) => (
              <div className="sliding-rectangle" key={`row2-${index}`} style={{ 
                background: 'rgb(240,240,240)', 
                color: '#444',
                border: 'none',
                boxShadow: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '400'
              }}>
                {text}
              </div>
            ))}
          </div>
        </div>
        
        <div className="sliding-row" style={gradientMaskStyle}>
          <div style={leftGradientMask}></div>
          <div style={rightGradientMask}></div>
          <div className="sliding-left">
            {duplicateForAnimation(row3Texts).map((text, index) => (
              <div className="sliding-rectangle" key={`row3-${index}`} style={{ 
                background: 'rgb(240,240,240)', 
                color: '#444',
                border: 'none',
                boxShadow: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '400'
              }}>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 