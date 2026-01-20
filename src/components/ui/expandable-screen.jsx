import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

const ExpandableScreenContext = createContext(undefined);

export function useExpandableScreen() {
  const context = useContext(ExpandableScreenContext);
  if (!context) {
    throw new Error('useExpandableScreen must be used within ExpandableScreen');
  }
  return context;
}

export function ExpandableScreen({
  children,
  layoutId = 'expandable-card',
  triggerRadius = '100px',
  contentRadius = '24px',
  animationDuration = 0.3,
  defaultExpanded = false,
  onExpandChange,
  lockScroll = true,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeLayoutId, setActiveLayoutId] = useState(layoutId);

  const expand = useCallback((sourceLayoutId) => {
    if (sourceLayoutId) {
      setActiveLayoutId(sourceLayoutId);
    } else {
      setActiveLayoutId(layoutId);
    }
    setIsExpanded(true);
    onExpandChange?.(true);
  }, [layoutId, onExpandChange]);

  const collapse = useCallback(() => {
    setIsExpanded(false);
    onExpandChange?.(false);
  }, [onExpandChange]);

  // Keep activeLayoutId in sync if the default layoutId prop changes
  useEffect(() => {
    setActiveLayoutId(layoutId);
  }, [layoutId]);

  // Lock body scroll when expanded
  useEffect(() => {
    if (lockScroll && isExpanded) {
      const scrollY = window.scrollY || window.pageYOffset || 0;

      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;

      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;

        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isExpanded, lockScroll]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isExpanded) {
        collapse();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isExpanded, collapse]);

  const value = {
    isExpanded,
    expand,
    collapse,
    layoutId,
    activeLayoutId,
    triggerRadius,
    contentRadius,
    animationDuration,
  };

  return (
    <ExpandableScreenContext.Provider value={value}>
      <LayoutGroup>
        {children}
      </LayoutGroup>
    </ExpandableScreenContext.Provider>
  );
}

export function ExpandableScreenTrigger({ children, className = '', style = {}, layoutId: layoutIdProp }) {
  const { isExpanded, expand, layoutId, triggerRadius, animationDuration } = useExpandableScreen();
  const triggerLayoutId = layoutIdProp || layoutId;

  return (
    <motion.div
      layout
      layoutId={triggerLayoutId}
      onClick={!isExpanded ? () => expand(triggerLayoutId) : undefined}
      style={{
        borderRadius: triggerRadius,
        cursor: isExpanded ? 'default' : 'pointer',
        pointerEvents: isExpanded ? 'none' : 'auto',
        ...style,
      }}
      transition={{
        layout: {
          type: 'spring',
          stiffness: 280,
          damping: 28,
          mass: 0.9,
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
export function ExpandableScreenContent({
  children,
  className = '',
  showCloseButton = true,
  closeButtonClassName = '',
  onClose = undefined,
  useScaleAnimation = false,
  transformOrigin = undefined,
  morphOnClose = true,
}) {
  const {
    isExpanded,
    collapse,
    layoutId,
    activeLayoutId,
    contentRadius,
    animationDuration,
  } = useExpandableScreen();
  const [isExiting, setIsExiting] = useState(false);
  const layoutIdForAnimation = useRef(activeLayoutId || layoutId);

  const resolvedLayoutId = activeLayoutId || layoutId;

  const handleClose = () => {
    if (!morphOnClose || useScaleAnimation) {
      setIsExiting(true);
    } else {
      setIsExiting(false);
    }
    collapse();
    onClose?.();
  };

  // Reset exit state and layoutId when opening - ensure it's set BEFORE animation
  useEffect(() => {
    if (isExpanded) {
      // Set layoutId immediately when opening so animation works
      layoutIdForAnimation.current = resolvedLayoutId;
      setIsExiting(false);
    }
  }, [isExpanded, resolvedLayoutId]);

  // Reset layoutId after exit animation completes so it works again next time
  useEffect(() => {
    if (!isExpanded && !isExiting) {
      // Ensure layoutId is always available when closed
      layoutIdForAnimation.current = resolvedLayoutId;
    } else if (!isExpanded && isExiting) {
      // Reset after exit animation completes
      const timer = setTimeout(() => {
        layoutIdForAnimation.current = resolvedLayoutId;
        setIsExiting(false);
      }, animationDuration * 1000 + 100);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, isExiting, resolvedLayoutId, animationDuration]);

  return (
    <AnimatePresence>
      {isExpanded && (
        <>
          {/* Content */}
          <motion.div
            layout
            layoutId={useScaleAnimation || !morphOnClose ? undefined : resolvedLayoutId}
            initial={useScaleAnimation ? { scale: 0.8, opacity: 0 } : false}
            animate={useScaleAnimation ? {
              scale: 1,
              opacity: 1,
              borderRadius: contentRadius,
            } : {
              borderRadius: contentRadius,
            }}
            exit={useScaleAnimation ? {
              opacity: 0,
              scale: 0.3,
            } : {
              opacity: 0,
            }}
            transition={{
              layout: useScaleAnimation ? false : {
                type: 'spring',
                stiffness: 280,
                damping: 28,
                mass: 0.9,
              },
              borderRadius: {
                type: 'spring',
                stiffness: 280,
                damping: 28,
                mass: 0.9,
              },
              opacity: {
                duration: animationDuration * 0.9,
                ease: [0.22, 1, 0.36, 1],
              },
              ...(useScaleAnimation && {
                scale: {
                  duration: animationDuration * 0.95,
                  ease: [0.22, 1, 0.36, 1],
                },
              }),
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              overflow: 'auto',
              transformOrigin: transformOrigin || 'center center',
            }}
            className={className}
          >
            {showCloseButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                aria-label="Close"
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  zIndex: 10000,
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  color: 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                }}
                className={closeButtonClassName}
              >
                ×
              </button>
            )}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function ExpandableScreenBackground({ trigger, content, className = '' }) {
  const { isExpanded } = useExpandableScreen();
  return <div className={className}>{isExpanded ? content : trigger}</div>;
}
