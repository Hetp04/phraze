import React, { useEffect, useRef } from 'react';

export default function AnnotationPanel() {
  const scrollRef = useRef(null);
  const isHoveredRef = useRef(false);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let targetScrollPosition = 0;
    let currentScrollPosition = 0;
    let isPaused = false;
    let pauseStartTime = 0;
    const scrollSpeed = 0.8; // pixels per frame
    const smoothness = 0.1; // lower = smoother
    const pauseDuration = 1500; // 1.5 seconds pause at the top

    const autoScroll = () => {
      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      if (maxScroll > 0 && !isHoveredRef.current) {
        // Check if we're at the top and should pause
        if (targetScrollPosition <= 0 && !isPaused) {
          isPaused = true;
          pauseStartTime = Date.now();
        }

        // Check if pause duration has elapsed
        if (isPaused && Date.now() - pauseStartTime >= pauseDuration) {
          isPaused = false;
        }

        // Only scroll if not paused
        if (!isPaused) {
          targetScrollPosition += scrollSpeed;
          
          // Reset to top when reaching bottom
          if (targetScrollPosition >= maxScroll) {
            targetScrollPosition = 0;
          }
        }
        
        // Smooth interpolation towards target position
        currentScrollPosition += (targetScrollPosition - currentScrollPosition) * smoothness;
        scrollContainer.scrollTop = currentScrollPosition;
      }
      
      requestAnimationFrame(autoScroll);
    };

    // Start auto scroll
    const animationId = requestAnimationFrame(autoScroll);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  const modelTypeOptions = ['Supervised', 'Unsupervised', 'Reinforcement'];
  const algorithmOptions = ['Neural Network', 'Decision Tree', 'Random Forest'];
  const codeCategories = [
    {
      name: 'Sentiment Analysis',
      options: ['Positive', 'Negative', 'Neutral']
    },
    {
      name: 'Data Quality',
      options: ['High Quality', 'Medium Quality', 'Low Quality']
    }
  ];
  const toolbarButtons = [
    { icon: <i className="fas fa-bold"></i>, title: 'Bold', fontWeight: 700 },
    { icon: <i className="fas fa-italic"></i>, title: 'Italic', fontWeight: 400, fontStyle: 'italic' },
    { icon: <i className="fa fa-palette"></i>, title: 'Mention', fontWeight: 500 },
    { icon: <i className="fas fa-image"></i>, title: 'Image', fontWeight: 500 }
  ];

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '10px 10px 0px',
      pointerEvents: 'none'
    }}>
      <div style={{
        width: '100%',
        height: '97.2%',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" color="currentColor">
              <path d="m14.6 20.474l-6.966 1.293c-1.336.248-2.004.372-2.389-.012c-.384-.385-.26-1.053-.012-2.39L6.526 12.4c.208-1.117.311-1.675.68-2.013c.368-.337 1.041-.403 2.388-.535C10.892 9.725 12.12 9.28 13.4 8l5.6 5.6c-1.28 1.28-1.725 2.508-1.853 3.806c-.131 1.347-.197 2.02-.535 2.389c-.337.368-.896.471-2.012.679"></path>
              <path d="M13 16.21a2.66 2.66 0 0 1-1.474-.736m0 0A2.66 2.66 0 0 1 10.79 14m.736 1.474L6 21m7.5-13c.633-.934 1.99-2.839 3.261-2.99c.868-.104 1.586.615 3.023 2.052l.154.154c1.437 1.437 2.156 2.155 2.052 3.023c-.151 1.27-2.056 2.628-2.99 3.261M5 8V2M2 5h6"></path>
            </svg>
            <h2 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 600,
              color: '#18181b',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              letterSpacing: '-0.01em'
            }}>
              Add Annotation
            </h2>
          </div>
          <div style={{
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          pointerEvents: 'none',
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          WebkitScrollbar: { display: 'none' } // Webkit browsers
        }} ref={scrollRef}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: 'rgb(107, 114, 128)',
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              Selected text:
            </label>
            <div style={{
              padding: '10px 12px',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#18181b',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontStyle: 'italic'
            }}>
              gradient descent algorithm optimizes the loss function
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: 'rgb(107, 114, 128)',
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              Labels:
            </label>
            
            <div style={{
              width: '100%',
              padding: '10px 12px',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#71717a',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Add Label</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            <div style={{
              marginTop: '4px',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div>
                <div style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6b7280',
                  backgroundColor: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                  MODEL TYPE
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {modelTypeOptions.map((option) => (
                    <div
                      key={option}
                      style={{
                        padding: '8px 12px',
                        fontSize: '14px',
                        color: '#111827',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      }}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              </div>


              <div style={{ height: '1px', background: '#f3f4f6', margin: '0 12px' }} />

              <div>
                <div style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6b7280',
                  backgroundColor: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                  ALGORITHM
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {algorithmOptions.map((option) => (
                    <div
                      key={option}
                      style={{
                        padding: '8px 12px',
                        fontSize: '14px',
                        color: '#111827',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      }}
                    >
                      {option}
                    </div>
                  ))}
                  <div style={{
                    padding: '8px 12px',
                    borderTop: '1px solid #e5e7eb',
                    color: '#6b7280',
                    fontSize: '14px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '4px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create new label
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: 'rgb(107, 114, 128)',
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              Codes:
            </label>
            <div style={{
              width: '100%',
              padding: '10px 12px',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#71717a',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Add Code</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <div style={{
              marginTop: '4px',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              {codeCategories.map((category, categoryIndex) => (
                <div key={category.name}>
                  {categoryIndex > 0 && <div style={{ height: '1px', background: '#f3f4f6', margin: '0 12px' }} />}
                  <div>
                    <div style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      backgroundColor: '#f9fafb',
                      borderBottom: '1px solid #e5e7eb',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      {category.name}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {category.options.map((option) => (
                        <div
                          key={option}
                          style={{
                            padding: '8px 12px',
                            fontSize: '14px',
                            color: '#111827',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          }}
                        >
                          {option}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{
                padding: '8px 12px',
                borderTop: '1px solid #e5e7eb',
                color: '#6b7280',
                fontSize: '14px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '4px'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create new code
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: 'rgb(107, 114, 128)',
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              Annotation:
            </label>

            <div style={{
              display: 'flex',
              gap: '4px',
              marginBottom: '8px',
              padding: '4px',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '4px 4px 0 0'
            }}>
              {toolbarButtons.map((btn) => (
                <div
                  key={btn.title}
                  title={btn.title}
                  style={{
                    width: '28px',
                    height: '28px',
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: btn.fontWeight,
                    fontStyle: btn.fontStyle || 'normal',
                    color: '#52525b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  {btn.icon}
                </div>
              ))}
            </div>

            <div style={{
              width: '100%',
              minHeight: '100px',
              padding: '10px 12px',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderTop: 'none',
              borderRadius: '0 0 4px 4px',
              fontSize: '13px',
              color: '#18181b',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              lineHeight: '1.5'
            }}>
              This is a fundamental concept in training neural networks. The learning rate parameter is crucial here - too high and the model won't converge, too low and training takes forever.
            </div>
          </div>
        </div>

        <div style={{
          padding: '16px',
          borderTop: '1px solid #e5e7eb',
          flexShrink: 0
        }}>
          <div style={{
            width: '100%',
            padding: '10px 16px',
            background: '#f8fafc',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#64748b',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: '-0.01em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Add Annotation
          </div>
        </div>
      </div>
    </div>
  );
}
