# Import/Export Bento Card - Complete Code

## State Variables
```javascript
// Export demo state variables
const [showExportModal, setShowExportModal] = useState(false);
const [selectedExportOption, setSelectedExportOption] = useState('download');
const [showExportToast, git  setShowExportToast] = useState(false);
const [exportButtonClicked, setExportButtonClicked] = useState(false);
```

## useEffect Hooks for Modal and Toast Management
```javascript
// Handle modal closing and showing toast
useEffect(() => {
  if (showExportModal) {
    // Auto-close modal after 2.5 seconds and show toast
    const modalTimeout = setTimeout(() => {
      setShowExportModal(false);
      setShowExportToast(true);
    }, 2500);

    return () => clearTimeout(modalTimeout);
  }
}, [showExportModal]);

// Handle toast closing
useEffect(() => {
  if (showExportToast) {
    // Auto-close toast after 2 seconds
    const toastTimeout = setTimeout(() => {
      setShowExportToast(false);
    }, 2000);

    return () => clearTimeout(toastTimeout);
  }
}, [showExportToast]);
```

## Scroll Animation useEffect
```javascript
// Luxurious scroll effect for Import/Export panel
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
          targetScrollPosition = -10; // Start slightly above top to ensure full visibility
        }

        // Ensure we don't go below 0
        if (targetScrollPosition < 0) {
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
```

## Main Import/Export Bento Card JSX
```javascript
{/* Import/Export Options */}
<div style={{
  background: '#ffffff',
  borderRadius: '24px',
  padding: '32px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  border: '1px solid #e5e7eb',
  position: 'relative',
  overflow: 'hidden'
}}>
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px'
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </div>
    <div>
      <h3 style={{
        margin: '0 0 4px 0',
        fontSize: '20px',
        fontWeight: '600',
        color: '#111827',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        Import/Export Options
      </h3>
      <p style={{
        margin: '0',
        fontSize: '14px',
        color: '#6b7280',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        Seamlessly transfer your data
      </p>
    </div>
  </div>

  {/* Scrollable Content Container */}
  <div 
    ref={scrollRef}
    style={{
      background: '#f8faff',
      borderRadius: '16px',
      padding: '20px',
      maxHeight: '200px',
      overflow: 'hidden',
      position: 'relative',
      border: '1px solid #e2e8f0'
    }}
    onMouseEnter={() => isHoveredRef.current = true}
    onMouseLeave={() => isHoveredRef.current = false}
  >
    {/* Export Modal */}
    {showExportModal && (
      <div style={{
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        background: 'rgba(255, 255, 255, 0.3)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '8px',
          padding: '0',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          width: '90%',
          maxWidth: '500px',
          border: '1px solid #e5e7eb'
        }}>
          {/* Header */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{
              margin: '0',
              fontSize: '14px',
              fontWeight: '600',
              color: '#111827',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              Export Data
            </h3>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '3px',
              background: '#f9fafb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '12px' }}>
            <p style={{
              margin: '0 0 8px 0',
              fontSize: '12px',
              color: '#6b7280',
              lineHeight: '1.3',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              Choose how you'd like to export your data:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {[
                { id: 'download', label: 'Continue Download', description: 'Download as JSON file' },
                { id: 'email', label: 'Email File', description: 'Send to your email address' },
                { id: 'json', label: 'Copy JSON', description: 'Copy to clipboard' }
              ].map((option) => (
                <div
                  key={option.id}
                  style={{
                    padding: '8px 10px',
                    background: selectedExportOption === option.id ? '#f9fafb' : 'transparent',
                    border: selectedExportOption === option.id ? '1px solid #d1d5db' : '1px solid transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#111827',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      {option.label}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      color: '#6b7280',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      {option.description}
                    </span>
                  </div>
                  {selectedExportOption === option.id && (
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#111827',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 12px',
            borderTop: '1px solid #f3f4f6',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '6px'
          }}>
            <button style={{
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#374151',
              cursor: 'pointer',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              transition: 'all 0.15s ease'
            }}>
              Cancel
            </button>
            <button style={{
              padding: '4px 10px',
              background: '#111827',
              border: '1px solid #111827',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#ffffff',
              cursor: 'pointer',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              transition: 'all 0.15s ease'
            }}>
              Export
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Toast Notification */}
    {showExportToast && (
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        zIndex: 2000,
        animation: 'slideUp 0.3s ease-out',
        maxWidth: '280px'
      }}>
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: '#111827',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span style={{
          fontSize: '13px',
          fontWeight: '500',
          color: '#111827',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          Export completed successfully!
        </span>
      </div>
    )}

    {/* Scrollable Content */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '10px',
      marginBottom: '20px'
    }}>
      <div 
        style={{
          padding: '12px 16px',
          background: exportButtonClicked ? '#e0e7ff' : '#f8faff',
          border: exportButtonClicked ? '1px solid #3b82f6' : '1px solid #e2e8f0',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          transition: 'all 0.2s ease',
          transform: exportButtonClicked ? 'scale(0.98)' : 'scale(1)',
          cursor: 'pointer'
        }}
        onClick={() => {
          setExportButtonClicked(true);
          setTimeout(() => {
            setExportButtonClicked(false);
            setShowExportModal(true);
          }, 200);
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#334155',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          letterSpacing: '-0.01em'
        }}>
          Export Data
        </span>
      </div>

      <div style={{
        padding: '12px 16px',
        background: '#f8fffc',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.2s ease'
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#334155',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          letterSpacing: '-0.01em'
        }}>
          Import Data
        </span>
      </div>
    </div>

    <p style={{
      fontSize: '14px',
      color: '#6b7280',
      lineHeight: '1.5',
      margin: '0 0 16px 0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      Share your annotations with others using a unique link.
    </p>

    <div style={{
      padding: '12px 16px',
      background: '#faf8ff',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      <span style={{
        fontSize: '14px',
        fontWeight: 500,
        color: '#334155',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        letterSpacing: '-0.01em'
      }}>
        Share Link
      </span>
    </div>
  </div>
</div>
```

## CSS Animation (Add to App.css)
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
```

## Required Refs
```javascript
const scrollRef = useRef(null);
const isHoveredRef = useRef(false);
```

## Notes
- The scroll animation automatically scrolls through the content
- The Export Data button has click functionality with visual feedback
- The modal appears with a glassmorphism blur effect
- The toast notification slides up from the bottom
- All timing is controlled by the useEffect hooks
- The modal and toast are positioned absolutely within the grey container
