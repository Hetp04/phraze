import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getImagePath, getVideoPath } from '../utils/assetPaths';
import FeatureShowcase from './FeatureShowcase';
import { DemoPreviewThread, mayaImg, alexImg, priyaImg } from './DemoPreviewThread';

// Image moved to public folder - using dynamic paths
const greyBg = getImagePath('grey.jpg'); // Use simpler filename
console.log('Grey background path:', greyBg); // Debug log

// Add CSS keyframes for FAQ animations
const faqAnimationStyles = `
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes slideUp {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-10px);
    }
  }
`;

export default function ChatDemo({ disableNegativeMargin = false } = {}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const messagesRef = useRef(null);
  const scrollIntervalRef = useRef(null);
  const videoRef = useRef(null);
  const [isVideoVisible, setIsVideoVisible] = useState(false);

  // Timeline workflow expansion state (moved from Hero)
  const timelineSectionRef = useRef(null);
  const cardRefs = useRef([]);
  const wrapperRefs = useRef([]);
  const timelineGridRef = useRef(null);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [expandedStyle, setExpandedStyle] = useState(null);
  const [originalRect, setOriginalRect] = useState(null);
  const [overlayHTML, setOverlayHTML] = useState('');
  const [backdropVisible, setBackdropVisible] = useState(false);
  const [overlayContentVisible, setOverlayContentVisible] = useState(true);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [showExpandIcons, setShowExpandIcons] = useState(false);
  const [reserveSpace, setReserveSpace] = useState(0);
  const showIconsDelayRef = useRef(null);
  const showIconsRafRef = useRef(null);
  const hideIconsDelayRef = useRef(null);
  const showExpandIconsRef = useRef(false);
  
  // Auto-cursor for timeline share icon (third card)
  const [autoShareActive, setAutoShareActive] = useState(false);
  const shareAutoRanInThisViewRef = useRef(false);
  const heroWorkflowRef = useRef(null);
  // Auto-cursor for overlay share icon when third card is expanded
  const [autoShareOverlayActive, setAutoShareOverlayActive] = useState(false);
  const shareOverlayRanRef = useRef(false);
  const expandedOverlayRef = useRef(null);
  const bodyOverflowBeforeLockRef = useRef('');
  const bodyPaddingRightBeforeLockRef = useRef('');

  // Share modal state (for timeline workflow)
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareMode, setShareMode] = useState('collaborative');
  const [typingRestartKey, setTypingRestartKey] = useState(0);

  // Add hover functionality for annotation cards
  useEffect(() => {
    const handleHighlightHover = (event) => {
      const highlight = event.target;
      if (!highlight.classList.contains('PhrazeHighlight')) return;

      const label = highlight.getAttribute('data-label');
      const labelType = highlight.getAttribute('data-label-type');
      const code = highlight.getAttribute('data-code');
      const codeType = highlight.getAttribute('data-code-type');
      const notes = highlight.getAttribute('data-notes');
      const user = highlight.getAttribute('data-user');
      const position = highlight.getAttribute('data-position');

      if (!label && !code && !notes) return; // Skip if no annotation data

      // Remove any existing annotation cards
      const existingCard = document.querySelector('.phraze-unified-annotation-card');
      if (existingCard) {
        existingCard.remove();
      }

      // Get highlight position
      const rect = highlight.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      // Find the chat demo container
      const chatDemoContainer = document.querySelector('.chat-demo-window');
      if (!chatDemoContainer) return;

      const containerRect = chatDemoContainer.getBoundingClientRect();
      const containerScrollTop = chatDemoContainer.scrollTop || 0;

      // Create annotation card
      const card = document.createElement('div');
      card.className = 'phraze-unified-annotation-card PhrazeMark active';
      card.style.position = 'absolute';
      card.style.zIndex = '1000000000';
      
      // Calculate position relative to the chat demo container
      const cardWidth = 320; // max-width from CSS
      const cardHeight = 200; // estimated height
      
      // For "above" positioning, center directly above the highlight
      let left, top;
      
      if (position === 'above') {
        // Center the card directly above the highlight, shifted slightly right
        left = rect.left + rect.width / 2 - cardWidth / 2 + 80; // Increased right shift from 50px to 80px
        top = rect.top + scrollTop - 100 - cardHeight; // Increased gap from 80px to 100px for more space above
        
        // Ensure it stays within container bounds but prioritize centering
        const minLeft = containerRect.left + scrollLeft;
        const maxLeft = containerRect.right + scrollLeft - cardWidth;
        const minTop = containerRect.top + scrollTop + 50; // Add 50px buffer from top of container
        
        // Only adjust horizontally if absolutely necessary
        left = Math.max(minLeft, Math.min(left, maxLeft));
        
        // For vertical positioning, ensure it doesn't go too close to top or bottom
        if (top < minTop) {
          // If can't fit above with buffer, position it higher up
          top = Math.max(minTop, rect.top + scrollTop - cardHeight - 100);
        }
        
        // Also ensure it doesn't get too close to the bottom (input area)
        const maxTop = containerRect.bottom + scrollTop - cardHeight - 80; // 80px buffer from bottom
        if (top > maxTop) {
          top = maxTop;
        }
      } else {
        // Default behavior for other highlights
        left = rect.left + rect.width / 2 - cardWidth / 2;
        top = rect.top + scrollTop - 15 - cardHeight; // Increased gap for default positioning too
        
        // Constrain within container bounds with buffer from input area
        const minLeft = containerRect.left + scrollLeft;
        const maxLeft = containerRect.right + scrollLeft - cardWidth;
        const minTop = containerRect.top + scrollTop;
        const maxTop = containerRect.bottom + scrollTop - cardHeight - 60; // 60px buffer from bottom
        
        left = Math.max(minLeft, Math.min(left, maxLeft));
        top = Math.max(minTop, Math.min(top, maxTop));
        
        // If card would go below highlight, position it below
        if (top + cardHeight > rect.bottom + scrollTop) {
          top = rect.bottom + scrollTop + 15; // Increased gap here too
        }
      }
      
      card.style.left = left + 'px';
      card.style.top = top + 'px';
      card.style.opacity = '1';
      card.style.pointerEvents = 'auto';

      // Get user avatar based on user name
      let avatarSrc = '';
      if (user === 'Alex Kim') {
        avatarSrc = 'https://api.dicebear.com/7.x/notionists/svg?seed=Alex&backgroundColor=ffdfbf';
      } else if (user === 'Sarah Chen') {
        avatarSrc = 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah&backgroundColor=f0f8ff';
      } else if (user === 'Maria Rodriguez') {
        avatarSrc = 'https://api.dicebear.com/7.x/bottts/svg?seed=Maria&backgroundColor=d1d4f9';
      } else if (user === 'Tom Wilson') {
        avatarSrc = 'https://api.dicebear.com/7.x/micah/svg?seed=Tom&backgroundColor=ffd5dc';
      } else if (user === 'Phraze') {
        avatarSrc = 'https://api.dicebear.com/7.x/bottts/svg?seed=AI&backgroundColor=6366f1';
      } else {
        avatarSrc = 'https://api.dicebear.com/7.x/avataaars/svg?seed=User&backgroundColor=b6e3f4';
      }

      // Build labels section
      let labelsSection = '';
      if (label) {
        labelsSection = `
          <div class="labels-section">
            <div class="conditional-header">Labels</div>
            <div class="labels-container">
              <span class="label-pill">${label}</span>
            </div>
          </div>
        `;
      }

      // Build codes section
      let codesSection = '';
      if (code) {
        codesSection = `
          <div class="codes-section">
            <div class="conditional-header">Codes</div>
            <div class="codes-container">
              <span class="code-pill">${code}</span>
            </div>
          </div>
        `;
      }

      // Build notes section
      let notesSection = '';
      if (notes) {
        notesSection = `
          <div class="notes-section">
            <ul class="phraze-note-list PhrazeMark">
              <li class="phraze-note-item">${notes}</li>
            </ul>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="annotation-card-header">
          <div class="profile-section">
            <img alt="" class="profile-image" src="${avatarSrc}" style="display: block;">
            <span class="username">${user}</span>
          </div>
          ${labelsSection}
          ${codesSection}
        </div>
        ${notesSection}
        <div class="annotation-card-footer">
          <button class="add-note-btn" title="Add note">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
              <path fill="currentColor" d="M19 11h-6V5a1 1 0 0 0-2 0v6H5a1 1 0 0 0 0 2h6v6a1 1 0 0 0 2 0v-6h6a1 1 0 0 0 0-2Z"></path>
            </svg>
          </button>
          <button class="attach-highlight-btn" title="Attach to chat" style="display: inline-block;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 26 26">
              <path fill="currentColor" d="M19.719 2.063a3.96 3.96 0 0 0-1.157.218c-1.499.505-2.785 1.66-4.062 2.938l-8.25 8.25c-.733.733-1.298 1.627-1.469 2.687a3.694 3.694 0 0 0 1.063 3.188a3.691 3.691 0 0 0 3.25 1.031c1.058-.19 1.944-.757 2.625-1.438l9.062-9.062a1 1 0 1 0-1.406-1.406l-9.063 9.062c-.43.43-1.024.779-1.562.875c-.538.096-.996.035-1.5-.468c-.525-.525-.581-.966-.5-1.47c.081-.503.397-1.084.906-1.593l8.25-8.25c1.21-1.209 2.367-2.13 3.281-2.438c.915-.307 1.571-.241 2.625.813c.788.787 1.626 1.497 1.844 2.219c.11.36.11.72-.125 1.312c-.234.592-.745 1.402-1.718 2.375c-4.148 4.15-7.332 7.332-9.063 9.063c-1.537 1.537-2.989 2.563-4.281 2.843c-1.293.281-2.52-.018-4.125-1.625c-1.607-1.607-2.169-3.163-2-4.78c.168-1.618 1.153-3.373 2.969-5.188c2.196-2.196 6.78-6.406 6.78-6.406a1 1 0 1 0-1.343-1.47S6.158 7.5 3.875 9.782C1.852 11.804.578 13.978.344 16.22c-.234 2.24.674 4.455 2.594 6.375s3.992 2.61 5.937 2.187c1.945-.422 3.63-1.755 5.281-3.406c1.731-1.73 4.915-4.913 9.063-9.063c1.1-1.1 1.812-2.083 2.187-3.03c.375-.949.39-1.884.157-2.657c-.467-1.545-1.72-2.408-2.344-3.031c-.716-.716-1.508-1.168-2.313-1.375a4.315 4.315 0 0 0-1.187-.156z"></path>
            </svg>
          </button>
          <button class="delete-highlight-btn" title="Delete highlight">✕</button>
        </div>
        <button title="Close annotation card" style="position: absolute; top: 8px; right: 8px; background-color: rgb(243, 244, 246); border: none; color: rgb(107, 114, 128); width: 20px; height: 20px; font-size: 14px; line-height: 18px; border-radius: 3px; cursor: pointer;">×</button>
      `;

      document.body.appendChild(card);

      // Add event listeners for card interactions
      const closeBtn = card.querySelector('button[title="Close annotation card"]');
      const deleteBtn = card.querySelector('.delete-highlight-btn');
      
      const removeCard = () => {
        if (card && card.parentNode) {
          card.remove();
        }
        // Clean up reference and reset card hover state
        if (highlight._annotationCard) {
          delete highlight._annotationCard;
        }
        setIsCardHovered(false); // Ensure scrolling resumes when card is removed
      };

      closeBtn?.addEventListener('click', removeCard);
      deleteBtn?.addEventListener('click', removeCard);

      // Add hover events to the card itself for smooth interaction
      let cardHovered = false;
      card.addEventListener('mouseenter', () => {
        cardHovered = true;
        setIsCardHovered(true); // Pause scrolling when hovering over card
      });
      
      card.addEventListener('mouseleave', () => {
        cardHovered = false;
        setIsCardHovered(false); // Resume scrolling when leaving card
        // Small delay to allow moving back to highlight
        setTimeout(() => {
          if (!cardHovered && !highlight.matches(':hover')) {
            removeCard();
          }
        }, 100);
      });

      // Store reference for cleanup
      highlight._annotationCard = card;
    };

    const handleHighlightLeave = (event) => {
      const highlight = event.target;
      if (!highlight.classList.contains('PhrazeHighlight')) return;
      
      // Small delay to allow moving to the card
      setTimeout(() => {
        if (highlight._annotationCard && !document.body.contains(highlight._annotationCard)) {
          delete highlight._annotationCard;
          return;
        }
        
        const card = document.querySelector('.phraze-unified-annotation-card');
        if (card && !card.matches(':hover') && !highlight.matches(':hover')) {
          card.remove();
          if (highlight._annotationCard) {
            delete highlight._annotationCard;
          }
          setIsCardHovered(false); // Ensure scrolling resumes when card is removed
        }
      }, 150); // Slightly longer delay for smoother UX
    };

    // Function to attach event listeners to highlights
    const attachHighlightListeners = () => {
      const highlights = document.querySelectorAll('.PhrazeHighlight');
      highlights.forEach((highlight) => {
        // Remove existing listeners first to avoid duplicates
        highlight.removeEventListener('mouseenter', handleHighlightHover);
        highlight.removeEventListener('mouseleave', handleHighlightLeave);
        
        // Add new listeners
        highlight.addEventListener('mouseenter', handleHighlightHover);
        highlight.addEventListener('mouseleave', handleHighlightLeave);
      });
    };

    // Attach listeners immediately
    attachHighlightListeners();

    // Also attach listeners after a short delay to catch any dynamically rendered content
    const timeoutId = setTimeout(attachHighlightListeners, 1000);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      
      const highlights = document.querySelectorAll('.PhrazeHighlight');
      highlights.forEach(highlight => {
        highlight.removeEventListener('mouseenter', handleHighlightHover);
        highlight.removeEventListener('mouseleave', handleHighlightLeave);
      });
      
      // Remove any existing annotation cards
      const existingCards = document.querySelectorAll('.phraze-unified-annotation-card');
      existingCards.forEach(card => card.remove());
    };
  }, []);

  // Add CSS styles for FAQ animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = faqAnimationStyles;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Hover detection using mouse events on the container
  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return;

    let hoverTimeout;

    const handleMouseEnter = () => {
      clearTimeout(hoverTimeout);
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      // Small delay to prevent flickering when moving between highlights
      hoverTimeout = setTimeout(() => {
        setIsHovered(false);
      }, 100);
    };

    // Add event listeners to the container
    messagesElement.addEventListener('mouseenter', handleMouseEnter);
    messagesElement.addEventListener('mouseleave', handleMouseLeave);

    // Cleanup function
    return () => {
      clearTimeout(hoverTimeout);
      messagesElement.removeEventListener('mouseenter', handleMouseEnter);
      messagesElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []); // Empty dependency array means this runs once and persists

  useEffect(() => {
    const startAutoScroll = () => {
      if (scrollIntervalRef.current) return;
      
      scrollIntervalRef.current = setInterval(() => {
        if (messagesRef.current && !isHovered && !isCardHovered) {
          messagesRef.current.scrollTop += 1; // Slightly faster scroll speed
          
          // Reset to top when reaching bottom for infinite scroll
          const scrollPosition = messagesRef.current.scrollTop;
          const maxScroll = messagesRef.current.scrollHeight - messagesRef.current.clientHeight;
          
          if (scrollPosition >= maxScroll) {
            messagesRef.current.scrollTop = 0;
          }
        }
      }, 50); // Update every 50ms for smooth scrolling
    };

    const stopAutoScroll = () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };

    // Start auto-scroll after a short delay
    const timer = setTimeout(() => {
      startAutoScroll();
    }, 1000);

    return () => {
      clearTimeout(timer);
      stopAutoScroll();
    };
  }, [isHovered, isCardHovered]);

  // Intersection Observer to control video playback
  useEffect(() => {
    const videoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVideoVisible(true);
            if (videoRef.current) {
              videoRef.current.play();
            }
          } else {
            setIsVideoVisible(false);
            if (videoRef.current) {
              videoRef.current.pause();
            }
          }
        });
      },
      {
        threshold: 0.5, // Video plays when 50% visible
        rootMargin: '-10% 0px -10% 0px' // Adjust trigger area
      }
    );

    if (videoRef.current) {
      videoObserver.observe(videoRef.current);
    }

    return () => {
      if (videoRef.current) {
        videoObserver.unobserve(videoRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Timeline workflow helper functions (moved from Hero)
  useEffect(() => { showExpandIconsRef.current = showExpandIcons; }, [showExpandIcons]);

  const measureTargetSize = () => {
    const availableHeight = window.innerHeight - 96 - 56;
    const desiredHeight = 560;
    const desiredWidth = 1100;
    return {
      width: Math.min(desiredWidth, window.innerWidth - 48),
      height: Math.min(desiredHeight, availableHeight),
    };
  };

  const lockBodyScroll = () => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    bodyOverflowBeforeLockRef.current = document.body.style.overflow;
    bodyPaddingRightBeforeLockRef.current = document.body.style.paddingRight;
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = 'hidden';
  };

  const unlockBodyScroll = () => {
    document.body.style.overflow = bodyOverflowBeforeLockRef.current || '';
    document.body.style.paddingRight = bodyPaddingRightBeforeLockRef.current || '';
  };

  const isElementVisible = (element, threshold = 0.55) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const viewportW = window.innerWidth || document.documentElement.clientWidth;
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const visibleW = Math.max(0, Math.min(rect.right, viewportW) - Math.max(rect.left, 0));
    const visibleH = Math.max(0, Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0));
    const visibleArea = visibleW * visibleH;
    const totalArea = Math.max(1, rect.width * rect.height);
    return visibleArea / totalArea >= threshold;
  };

  // Define collapseExpanded before useEffects that use it
  const collapseExpanded = useCallback(() => {
    if (expandedIndex === null || !originalRect) return;
    setOverlayContentVisible(false);
    setIsCollapsing(true);
    setReserveSpace(0);
    
    setExpandedStyle((prev) => (
      prev
        ? {
            ...prev,
            width: `${originalRect.width}px`,
            height: `${originalRect.height}px`,
            left: `${originalRect.left}px`,
            borderRadius: originalRect.borderRadius || '16px',
            boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
            background: 'transparent',
            pointerEvents: 'none',
            opacity: 0.98,
            overflow: 'hidden',
            transition: `top 200ms cubic-bezier(0.22, 1, 0.36, 1), left 200ms cubic-bezier(0.22, 1, 0.36, 1), width 200ms cubic-bezier(0.22, 1, 0.36, 1), height 200ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }
        : prev
    ));

    const TRANSITION_MS = 200;
    window.setTimeout(() => {
      setBackdropVisible(false);
      setOverlayHTML('');
      unlockBodyScroll();
      setExpandedIndex(null);
      setExpandedStyle(null);
      setOriginalRect(null);
      setIsCollapsing(false);
    }, TRANSITION_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedIndex, originalRect]);

  // ESC to close expanded card
  useEffect(() => {
    if (expandedIndex === null) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') collapseExpanded();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [expandedIndex, collapseExpanded]);

  // Show expand icons when the grid's center is near viewport center
  useEffect(() => {
    const el = timelineGridRef.current;
    if (!el) return undefined;

    const compute = () => {
      showIconsRafRef.current = null;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 0;
      const preferredY = Math.floor(vh * 0.42);
      const elementCenterY = rect.top + rect.height / 2;
      const bandPx = Math.max(110, Math.floor(vh * 0.14));
      const holdBandPx = bandPx + Math.max(80, Math.floor(vh * 0.08));

      const visibleHeight = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
      const elementHeight = Math.max(1, rect.height);
      const visibleRatio = Math.max(0, Math.min(visibleHeight / elementHeight, 1));

      const centerNear = Math.abs(elementCenterY - preferredY) <= bandPx;
      const enoughVisible = visibleRatio >= 0.3;
      const withinHold = Math.abs(elementCenterY - preferredY) <= holdBandPx;
      const enoughVisibleHold = visibleRatio >= 0.15;
      const shouldShow = centerNear && enoughVisible;

      if (shouldShow) {
        if (hideIconsDelayRef.current) {
          window.clearTimeout(hideIconsDelayRef.current);
          hideIconsDelayRef.current = null;
        }
        if (!showIconsDelayRef.current) {
          showIconsDelayRef.current = window.setTimeout(() => {
            setShowExpandIcons(true);
            showIconsDelayRef.current = null;
          }, 650);
        }
      } else {
        if (showIconsDelayRef.current && (!withinHold || !enoughVisibleHold)) {
          window.clearTimeout(showIconsDelayRef.current);
          showIconsDelayRef.current = null;
        }
        const outOfView = rect.bottom < 0 || rect.top > vh || visibleRatio < 0.05;
        if (outOfView) {
          if (hideIconsDelayRef.current) {
            window.clearTimeout(hideIconsDelayRef.current);
            hideIconsDelayRef.current = null;
          }
          setShowExpandIcons(false);
        } else {
          if (showExpandIconsRef.current && !hideIconsDelayRef.current) {
            hideIconsDelayRef.current = window.setTimeout(() => {
              setShowExpandIcons(false);
              hideIconsDelayRef.current = null;
            }, 800);
          } else if (!showExpandIconsRef.current) {
            if (!withinHold || !showIconsDelayRef.current) {
              setShowExpandIcons(false);
            }
          }
        }
      }
    };

    const onScrollOrResize = () => {
      if (showIconsRafRef.current != null) return;
      showIconsRafRef.current = window.requestAnimationFrame(compute);
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('orientationchange', onScrollOrResize);
    onScrollOrResize();

    return () => {
      if (showIconsDelayRef.current) {
        window.clearTimeout(showIconsDelayRef.current);
        showIconsDelayRef.current = null;
      }
      if (hideIconsDelayRef.current) {
        window.clearTimeout(hideIconsDelayRef.current);
        hideIconsDelayRef.current = null;
      }
      if (showIconsRafRef.current != null) {
        window.cancelAnimationFrame(showIconsRafRef.current);
        showIconsRafRef.current = null;
      }
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('orientationchange', onScrollOrResize);
    };
  }, []);

  // Trigger share auto-cursor when expand icons appear
  useEffect(() => {
    if (showExpandIcons) {
      const sectionEl = heroWorkflowRef.current;
      if (!sectionEl || !isElementVisible(sectionEl, 0.55)) return undefined;
      if (!shareAutoRanInThisViewRef.current) {
        shareAutoRanInThisViewRef.current = true;
        const id = window.setTimeout(() => setAutoShareActive(true), 420);
        return () => window.clearTimeout(id);
      }
    } else {
      shareAutoRanInThisViewRef.current = false;
    }
    return undefined;
  }, [showExpandIcons]);

  // Trigger overlay share auto-cursor when third card is expanded
  useEffect(() => {
    if (expandedIndex === 2 && overlayContentVisible) {
      if (!shareOverlayRanRef.current) {
        shareOverlayRanRef.current = true;
        const id = window.setTimeout(() => setAutoShareOverlayActive(true), 900);
        return () => window.clearTimeout(id);
      }
    } else {
      shareOverlayRanRef.current = false;
      setAutoShareOverlayActive(false);
    }
    return undefined;
  }, [expandedIndex, overlayContentVisible]);

  // ESC to close share modal overlay
  useEffect(() => {
    const onShareOpen = () => {
      try {
        const host = expandedOverlayRef.current;
        if (!host) return;
        const overlayHost = host;
        if (getComputedStyle(overlayHost).position === 'static') {
          overlayHost.style.position = 'relative';
        }
        let modalBackdrop = overlayHost.querySelector('[data-share-blur]');
        if (!modalBackdrop) {
          modalBackdrop = document.createElement('div');
          modalBackdrop.setAttribute('data-share-blur', '');
          modalBackdrop.style.position = 'absolute';
          const cs = getComputedStyle(overlayHost);
          const padT = parseFloat(cs.paddingTop || '12') || 12;
          const padR = parseFloat(cs.paddingRight || '12') || 12;
          const padB = parseFloat(cs.paddingBottom || '12') || 12;
          const padL = parseFloat(cs.paddingLeft || '12') || 12;
          modalBackdrop.style.top = `${Math.max(8, padT)}px`;
          modalBackdrop.style.left = `${Math.max(8, padL)}px`;
          modalBackdrop.style.right = `${Math.max(8, padR)}px`;
          modalBackdrop.style.bottom = `${Math.max(12, padB)}px`;
          modalBackdrop.style.borderRadius = getComputedStyle(overlayHost).borderRadius || '8px';
          modalBackdrop.style.background = 'rgba(17,24,39,0.28)';
          modalBackdrop.style.backdropFilter = 'blur(2px)';
          modalBackdrop.style.WebkitBackdropFilter = 'blur(2px)';
          modalBackdrop.style.zIndex = '25';
          modalBackdrop.style.pointerEvents = 'none';
          overlayHost.appendChild(modalBackdrop);
        }
        requestAnimationFrame(() => { modalBackdrop.style.opacity = '1'; });
      } catch (_) {}
    };
    const onShareClose = () => {
      try {
        const host = expandedOverlayRef.current;
        if (!host) return;
        const candidates = [host, host.querySelector('.overlay-chat-scroll')].filter(Boolean);
        candidates.forEach((container) => {
          container
            .querySelectorAll('[data-share-blur], [data-share-spotlight]')
            .forEach((el) => {
              try { el.remove(); } catch (_) {}
            });
        });
      } catch (_) {}
    };
    window.addEventListener('share-modal:open', onShareOpen);
    window.addEventListener('share-modal:close', onShareClose);
    return () => {
      window.removeEventListener('share-modal:open', onShareOpen);
      window.removeEventListener('share-modal:close', onShareClose);
    };
  }, []);

  // Timeline cursor animation components
  const TimelineShareAutoCursor = ({ active }) => {
    const [showCursor, setShowCursor] = useState(false);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [cursorScale, setCursorScale] = useState(1);
    const [cursorOpacity, setCursorOpacity] = useState(0);
    const [rippleVisible, setRippleVisible] = useState(false);
    const [rippleScale, setRippleScale] = useState(0.8);
    const [rippleOpacity, setRippleOpacity] = useState(0);
    const [ripplePos, setRipplePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
      if (!active) return;
      const container = heroWorkflowRef.current;
      const thirdCard = cardRefs.current[2];
      if (!container || !thirdCard) return;
      if (!isElementVisible(thirdCard, 0.55)) return;
      const shareIcon = thirdCard.querySelector('.step-icon.collaborate-icon');
      if (!shareIcon) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = shareIcon.getBoundingClientRect();
      const targetX = targetRect.left - containerRect.left + Math.min(22, targetRect.width * 0.6);
      const targetY = targetRect.top - containerRect.top + Math.min(22, targetRect.height * 0.65);
      setRipplePos({ x: targetX + 10, y: targetY + 8 });

      setShowCursor(true);
      setCursorOpacity(0);
      setCursorPos({ x: Math.max(0, targetX - 110), y: Math.max(0, targetY - 72) });
      const raf = requestAnimationFrame(() => {
        setCursorOpacity(1);
        setCursorPos({ x: targetX, y: targetY });
      });

      const moveMs = 900;
      const preClickDwellMs = 160;
      const postClickLingerMs = 700;
      const clickTimer = setTimeout(() => {
        try { shareIcon.click(); } catch (_) {}
        setCursorScale(0.94);
        setRippleVisible(true);
        setRippleScale(0.8);
        setRippleOpacity(0.35);
        setTimeout(() => { setRippleScale(1.8); setRippleOpacity(0); }, 10);
        setTimeout(() => {
          setCursorScale(1);
          setCursorOpacity(0);
          setTimeout(() => setShowCursor(false), 250);
          setRippleVisible(false);
          setAutoShareActive(false);
        }, postClickLingerMs);
      }, moveMs + preClickDwellMs);

      return () => { cancelAnimationFrame(raf); clearTimeout(clickTimer); };
    }, [active]);

    if (!showCursor) return null;
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}>
        <div
          style={{
            position: 'absolute',
            transform: `translate(${cursorPos.x}px, ${cursorPos.y}px) scale(${cursorScale}) rotate(-8deg)`,
            transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1), opacity 360ms ease',
            opacity: cursorOpacity,
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))' }}>
            <path fill="#FFF" stroke="#000" strokeWidth="1.25" d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z"></path>
          </svg>
        </div>
        {rippleVisible && (
          <div style={{ position: 'absolute', transform: `translate(${ripplePos.x}px, ${ripplePos.y}px)` }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(17,17,17,0.4)', transform: `scale(${rippleScale})`, transition: 'transform 320ms ease, opacity 320ms ease', opacity: rippleOpacity }} />
          </div>
        )}
      </div>
    );
  };

  const ShareOverlayAutoCursor = ({ active }) => {
    const [showCursor, setShowCursor] = useState(false);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [cursorScale, setCursorScale] = useState(1);
    const [cursorOpacity, setCursorOpacity] = useState(0);
    const [rippleVisible, setRippleVisible] = useState(false);
    const [rippleScale, setRippleScale] = useState(0.8);
    const [rippleOpacity, setRippleOpacity] = useState(0);
    const [ripplePos, setRipplePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
      if (!active) return;
      const container = expandedOverlayRef.current;
      if (!container) return;
      const button = container.querySelector('button[aria-label="Share chat"]');
      if (!button) return;

      const containerRect = container.getBoundingClientRect();
      const btnRect = button.getBoundingClientRect();
      const targetX = btnRect.left - containerRect.left + Math.min(16, btnRect.width * 0.6);
      const targetY = btnRect.top - containerRect.top + Math.min(16, btnRect.height * 0.6);
      setRipplePos({ x: targetX + 8, y: targetY + 6 });

      setShowCursor(true);
      setCursorOpacity(0);
      setCursorPos({ x: Math.max(0, targetX - 110), y: Math.max(0, targetY - 72) });
      const raf = requestAnimationFrame(() => {
        setCursorOpacity(1);
        setCursorPos({ x: targetX, y: targetY });
      });

      const moveMs = 900;
      const preClickDwellMs = 220;
      const postClickLingerMs = 800;
      const clickTimer = setTimeout(() => {
        try { button.click(); } catch (_) {}
        try { button.blur(); } catch (_) {}
        setCursorScale(0.94);
        setTimeout(() => {
          setCursorScale(0.88);
          setCursorOpacity(0);
          setTimeout(() => setShowCursor(false), 700);
          setAutoShareOverlayActive(false);
        }, postClickLingerMs);
      }, moveMs + preClickDwellMs);

      return () => { cancelAnimationFrame(raf); clearTimeout(clickTimer); };
    }, [active]);

    if (!showCursor) return null;
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}>
        <div
          style={{
            position: 'absolute',
            transform: `translate(${cursorPos.x}px, ${cursorPos.y}px) scale(${cursorScale}) rotate(-8deg)`,
            transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1), opacity 360ms ease',
            opacity: cursorOpacity,
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))' }}>
            <path fill="#FFF" stroke="#000" strokeWidth="1.25" d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z"></path>
          </svg>
        </div>
        {rippleVisible && (
          <div style={{ position: 'absolute', transform: `translate(${ripplePos.x}px, ${ripplePos.y}px)` }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(17,17,17,0.4)', transform: `scale(${rippleScale})`, transition: 'transform 320ms ease, opacity 320ms ease', opacity: rippleOpacity }} />
          </div>
        )}
      </div>
    );
  };

  const expandCard = (index) => {
    if (expandedIndex !== null) return;
    const card = cardRefs.current[index];
    const wrapper = wrapperRefs.current[index];
    if (!card || !wrapper) return;

    const rect = card.getBoundingClientRect();
    // Calculate position relative to the workflow container
    const heroEl = heroWorkflowRef.current;
    if (!heroEl) return;
    const heroRect = heroEl.getBoundingClientRect();
    const start = {
      top: rect.top - heroRect.top,
      left: rect.left - heroRect.left,
      width: rect.width,
      height: rect.height,
    };
    const computed = window.getComputedStyle(card);
    const startRadius = computed.borderRadius || '16px';

    setOriginalRect({ ...start, borderRadius: startRadius });
    setExpandedIndex(index);
    setIsCollapsing(false);

    if (index === 0) {
      setOverlayHTML('');
    } else if (index === 1) {
      setOverlayHTML('');
    } else if (index === 2) {
      setOverlayHTML('');
    } else {
      setOverlayHTML(card.innerHTML);
    }

    setOverlayContentVisible(true);

    const transition = '200ms cubic-bezier(0.22, 1, 0.36, 1)';
    
    // Calculate target dimensions first
    const { width: targetWidth, height: targetHeight } = measureTargetSize();
    const marginX = 24;
    const clampedWidth = Math.min(targetWidth, window.innerWidth - marginX * 2);
    const bottomBreathingRoom = 84;
    const clampedHeight = Math.max(start.height, targetHeight - bottomBreathingRoom);
    const growthDelta = Math.max(0, clampedHeight - start.height);
    const extraGap = 80;
    
    // Set reserveSpace immediately so the section shifts down at the same time
    setReserveSpace(growthDelta + extraGap);
    
    setExpandedStyle({
      position: 'absolute',
      top: `${start.top}px`,
      left: `${start.left}px`,
      width: `${start.width}px`,
      height: `${start.height}px`,
      margin: 0,
      zIndex: 2000,
      borderRadius: startRadius,
      boxShadow: '0 20px 48px rgba(0,0,0,0.18)',
      transition: `top ${transition}, left ${transition}, width ${transition}, height ${transition}, border-radius ${transition}, box-shadow ${transition}, opacity 150ms ease-out`,
      background: '#ffffff',
      opacity: 1,
    });

    setBackdropVisible(true);
    lockBodyScroll();
    setOverlayContentVisible(false);

    let targetLeft = start.left;
    if (index === 1) {
      targetLeft = start.left - (clampedWidth - start.width) / 2;
    } else if (index === 2) {
      targetLeft = start.left + (start.width - clampedWidth);
    }
    const targetTop = start.top;

    requestAnimationFrame(() => {
      card.offsetHeight;
      requestAnimationFrame(() => {
        setExpandedStyle((prev) => (
          prev
            ? {
                ...prev,
                width: `${clampedWidth}px`,
                height: `${clampedHeight}px`,
                left: `${targetLeft}px`,
                top: `${targetTop}px`,
                borderRadius: '12px',
              }
            : prev
        ));
        window.setTimeout(() => setOverlayContentVisible(true), 60);
      });
    });
  };

  return (
    <section className="chat-demo demo-section" style={{ 
      marginTop: disableNegativeMargin ? '0px' : '-200px',
      paddingTop: '2rem',
      background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 92%, #b8c4d0 100%)',
      position: 'relative',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      zIndex: 1
    }}>

      <div className="container" style={{
        width: '1400px',
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative',
        minWidth: '1400px'
      }}>
        {/* Decorative gradient circles behind the chat card */}
        {/* Gray Circle (Bottom Left) */}
        <div style={{
          position: 'absolute',
          left: '120px',
          top: '630px',
          width: '322px',
          height: '322px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(195, 230, 255, 0.5) 0%, rgba(204, 232, 255, 0.53) 25%, rgba(212, 229, 255, 0.3) 45%, rgba(240, 248, 255, 0.15) 65%, rgba(240, 248, 255, 0.05) 80%, rgba(255, 255, 255, 0) 100%)',
          zIndex: 1,
          pointerEvents: 'none'
        }}></div>
        
        {/* Blue Circle (Top Right) */}
        <div style={{
          position: 'absolute',
          top: '1100px',
          right: '100px',
          width: '322px',
          height: '322px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(195, 217, 255, 0.5) 0%, rgba(204, 223, 255, 0.42) 25%, rgba(212, 229, 255, 0.3) 45%, rgba(240, 248, 255, 0.15) 65%, rgba(240, 248, 255, 0.05) 80%, rgba(255, 255, 255, 0) 100%)',
          zIndex: 1,
          pointerEvents: 'none'
        }}></div>

        <div className="hidden md:block" style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)', height: '1px', backgroundColor: '#e5e7eb' }} />

        {/* Sponsors Section */}
        <div style={{
          padding: '20px 0',
          maxWidth: '1400px',
          margin: '0.75rem auto 0 auto',
          paddingLeft: '20px',
          paddingRight: '20px',
          textAlign: 'center'
        }}>
          <h2 style={{
            fontSize: '0.9rem',
            fontWeight: '500',
            color: '#6b7280',
            marginBottom: '1.2rem',
            fontFamily: '"Inter", "Inter Fallback", sans-serif',
            letterSpacing: '0.02em'
          }}>
            Supported by the generous contributions of
          </h2>
          
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '6.2rem',
            flexWrap: 'wrap'
          }}>
            {/* Western University Logo */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '70px',
              opacity: '0.9',
              transition: 'all 0.3s ease',
              filter: 'grayscale(100%) saturate(0%)',
              padding: '10px'
            }}>
              <img 
                src="/western.svg" 
                alt="Western University"
                style={{
                  height: '100%',
                  maxWidth: '220px',
                  objectFit: 'contain',
                  filter: 'grayscale(100%) saturate(0%)'
                }}
              />
            </div>

            {/* NSERC Logo */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '90px',
              opacity: '0.9',
              transition: 'all 0.3s ease',
              filter: 'grayscale(100%) saturate(0%)',
              padding: '10px'
            }}>
              <img 
                src="/NSERC.svg" 
                alt="NSERC"
                style={{
                  height: '100%',
                  maxWidth: '450px',
                  objectFit: 'contain',
                  filter: 'grayscale(100%) saturate(0%)'
                }}
              />
            </div>

            {/* SSHRC Logo */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '70px',
              opacity: '0.9',
              transition: 'all 0.3s ease',
              filter: 'grayscale(100%) saturate(0%)',
              padding: '10px'
            }}>
              <img 
                src="/sshrc.png" 
                alt="SSHRC"
                style={{
                  height: '100%',
                  maxWidth: '320px',
                  objectFit: 'contain',
                  filter: 'grayscale(100%) saturate(0%)'
                }}
              />
            </div>

            {/* Human-Centered Computing Group (HCCG) Text */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '40px',
              padding: '6px 14px',
              backgroundColor: 'rgb(229, 231, 235)',
              borderRadius: '20px',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(17, 24, 39, 0.06)',
              gap: '8px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" style={{ flexShrink: 0, transform: 'translateY(-1px)' }}>
                <path fill="#6b7280" d="m221.56 100.85l-79.95-75.47l-.16-.15a19.93 19.93 0 0 0-26.91 0l-.17.15l-79.93 75.47a20.07 20.07 0 0 0-6.44 14.7V208a20 20 0 0 0 20 20h160a20 20 0 0 0 20-20v-92.45a20.07 20.07 0 0 0-6.44-14.7ZM204 204H52v-86.72l76-71.75l76 71.75Z"/>
              </svg>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: '600',
                color: '#6b7280',
                fontFamily: '"Inter", "Inter Fallback", sans-serif',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em'
              }}>
                HCCG (Human-Centered Computing Group)
              </span>
            </div>
          </div>
        </div>

        <div className="hidden md:block" style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)', height: '1px', backgroundColor: '#e5e7eb' }} />

        <div className="chat-demo-header" style={{
          marginBottom: '2rem',
          marginTop: '10rem',
          position: 'relative',
          zIndex: 2
        }}>
          <h2 style={{
            fontSize: '1.7rem',
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: '2rem',
            marginTop: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            letterSpacing: '-0.02em',
            lineHeight: '1.2'
          }}>See Phraze in Action</h2>
          <p style={{
            fontSize: '18px',
            color: '#666',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: '1.6',
            marginBottom: '1rem',
            fontFamily: '"Inter", "Inter Fallback", sans-serif'
          }}>Experience how Phraze transforms conversations with AI through intelligent highlighting and annotation</p>
        </div>
        
        <div className="chat-demo-window" style={{ position: 'relative', zIndex: 2 }}>
          <div className="chat-demo-header-bar">
            <div className="window-controls">
              <div className="control-dot red"></div>
              <div className="control-dot yellow"></div>
              <div className="control-dot green"></div>
            </div>
            <div className="chat-demo-title" style={{ fontFamily: '"Inter", "Inter Fallback", sans-serif' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              Team Discussion
            </div>
          </div>
          
          <div 
            ref={messagesRef}
            className="chat-demo-messages" 
            style={{ 
              paddingBottom: '0', 
              marginBottom: '0',
              maxHeight: '400px',
              overflowY: 'auto',
              scrollBehavior: 'auto'
            }}
          >
            {/* Alex starts the conversation with @mention */}
            <div style={{ padding: '0 1rem', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'flex-end', position: 'relative', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: '0' }}>
                {/* Username display with profile icon */}
                <div style={{ fontSize: '0.8rem', marginBottom: '8px', fontWeight: '500', color: '#555', textAlign: 'right', paddingRight: '0', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <img 
                    src="https://api.dicebear.com/7.x/notionists/svg?seed=Alex&backgroundColor=ffdfbf" 
                    alt="Alex Kim" 
                    style={{ 
                      width: '20px', 
                      height: '20px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      border: '1px solid #cbd5e1'
                    }} 
                  />
                  <span>Alex Kim</span>
                </div>
                <div className="message-bubble" style={{ padding: '1rem', background: '#ffffff', borderRadius: '2rem', borderBottomRightRadius: '5px', color: '#0A0A0A', display: 'inline-block', width: '100%', position: 'relative', marginTop: '4px' }}>
                  <div id="message-content0" style={{ fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                   <strong>@Maria</strong> can you share the <span 
                       className="PhrazeHighlight has-annotations" 
                       data-label="Performance" 
                       data-label-type="Data Analysis"
                       data-code="METRICS-001" 
                       data-code-type="Performance Tracking"
                       data-notes="Need baseline comparison for Q4 performance review. Include CPU, memory, and response time metrics."
                     data-user="Alex Kim"
                   >server metrics from last week</span>? We need to compare with our normal performance levels.
              </div>
                  <div className="message-actions" style={{ position: 'absolute', left: '-120px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '8px', opacity: '0', transition: 'opacity 0.2s' }}>
                    <button title="Copy message" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <button title="Edit message" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button title="Draw on message (click again to close)" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                        <path d="M2 2l7.586 7.586"></path>
                        <circle cx="11" cy="11" r="2"></circle>
                      </svg>
                    </button>
                </div>
                </div>
              </div>
            </div>

            {/* Sarah asks a direct question (no @ mention) */}
            <div style={{ padding: '0 1rem', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'flex-end', position: 'relative', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: '0' }}>
                {/* Username display with profile icon */}
                <div style={{ fontSize: '0.8rem', marginBottom: '8px', fontWeight: '500', color: '#555', textAlign: 'right', paddingRight: '0', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <img 
                    src="https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah&backgroundColor=f0f8ff" 
                    alt="Sarah Chen" 
                    style={{ 
                      width: '20px', 
                      height: '20px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      border: '1px solid #cbd5e1'
                    }} 
                  />
                  <span>Sarah Chen</span>
                </div>
                <div className="message-bubble" style={{ padding: '1rem', background: '#ffffff', borderRadius: '2rem', borderBottomRightRadius: '5px', color: '#0A0A0A', display: 'inline-block', width: '100%', position: 'relative', marginTop: '4px' }}>
                  <div id="message-content1" style={{ fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    What are the best ways to <span className="PhrazeHighlight">measure improvements</span> when we fix these issues?
              </div>
                  <div className="message-actions" style={{ position: 'absolute', left: '-120px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '8px', opacity: '0', transition: 'opacity 0.2s' }}>
                    <button title="Copy message" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <button title="Edit message" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button title="Draw on message (click again to close)" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                        <path d="M2 2l7.586 7.586"></path>
                        <circle cx="11" cy="11" r="2"></circle>
                      </svg>
                    </button>
                </div>
                </div>
              </div>
            </div>

            {/* AI responds to Sarah's direct question (no @ mention) */}
            <div style={{ padding: '0', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'flex-start', position: 'relative', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: '0' }}>
                {/* Username display with profile icon */}
                <div style={{ fontSize: '0.8rem', marginBottom: '8px', fontWeight: '500', color: '#555', textAlign: 'left', paddingRight: '0rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-start' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '600', color: 'white', border: '1px solid #475569' }}>
                    P
                </div>
                  <span>phraze</span>
                </div>
                <div className="message-bubble" style={{ padding: '0rem', background: 'transparent', borderRadius: '0.5rem', color: '#0A0A0A', display: 'inline-block', width: '100%', position: 'relative', marginTop: '4px' }}>
                  <div id="message-content-ai1" style={{ fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'normal' }}>
                    For measuring improvements, I recommend: 1. <span 
                      className="PhrazeHighlight has-annotations" 
                      data-label="Tools" 
                      data-label-type="Performance Analysis"
                      data-code="TOOLS-003" 
                      data-code-type="Web Performance"
                      data-notes="Primary tool for Core Web Vitals measurement. Provides both mobile and desktop scores with specific recommendations."
                      data-user="Phraze"
                      data-position="above"
                    >Google PageSpeed Insights</span> for performance scores 2. Real User Monitoring to track actual user experience 3. Before and after screenshots to show visual improvements to stakeholders.
                  </div>
                  <div className="ai-message-actions" style={{ marginTop: '8px', display: 'flex', gap: '8px', opacity: 1, justifyContent: 'flex-start' }}>
                    <button style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }} title="Copy message">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <button style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }} title="Regenerate response">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                      </svg>
                    </button>
                    <button style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }} title="Edit message">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Maria responds to Alex's earlier request */}
            <div style={{ padding: '0 1rem', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'flex-end', position: 'relative', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: '0' }}>
                {/* Username display with profile icon */}
                <div style={{ fontSize: '0.8rem', marginBottom: '8px', fontWeight: '500', color: '#555', textAlign: 'right', paddingRight: '0', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <img 
                    src="https://api.dicebear.com/7.x/bottts/svg?seed=Maria&backgroundColor=d1d4f9" 
                    alt="Maria Rodriguez" 
                    style={{ 
                      width: '20px', 
                      height: '20px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      border: '1px solid #cbd5e1'
                    }} 
                  />
                  <span>Maria Rodriguez</span>
                </div>
                <div className="message-bubble" style={{ padding: '1rem', background: '#ffffff', borderRadius: '2rem', borderBottomRightRadius: '5px', color: '#0A0A0A', display: 'inline-block', width: '100%', position: 'relative', marginTop: '4px' }}>
                  <div id="message-content2" style={{ fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    <strong>@Alex</strong> Sure! I'll get those metrics compiled and share them in the next hour. Also adding the <span className="PhrazeHighlight">baseline comparisons from previous months</span>.
              </div>
                  <div className="message-actions" style={{ position: 'absolute', left: '-120px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '8px', opacity: '0', transition: 'opacity 0.2s' }}>
                    <button title="Copy message" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <button title="Edit message" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button title="Draw on message (click again to close)" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                        <path d="M2 2l7.586 7.586"></path>
                        <circle cx="11" cy="11" r="2"></circle>
                      </svg>
                    </button>
                </div>
                </div>
              </div>
            </div>

            {/* Tom adds to the conversation */}
            <div style={{ padding: '0 1rem', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'flex-end', position: 'relative', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: '0' }}>
                {/* Username display with profile icon */}
                <div style={{ fontSize: '0.8rem', marginBottom: '8px', fontWeight: '500', color: '#555', textAlign: 'right', paddingRight: '0', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <img 
                    src="https://api.dicebear.com/7.x/micah/svg?seed=Tom&backgroundColor=ffd5dc" 
                    alt="Tom Wilson" 
                    style={{ 
                      width: '20px', 
                      height: '20px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      border: '1px solid #cbd5e1'
                    }} 
                  />
                  <span>Tom Wilson</span>
                </div>
                <div className="message-bubble" style={{ padding: '1rem', background: '#ffffff', borderRadius: '2rem', borderBottomRightRadius: '5px', color: '#0A0A0A', display: 'inline-block', width: '100%', position: 'relative', marginTop: '4px' }}>
                  <div id="message-content3" style={{ fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    <strong>@Sarah</strong> Great point! We should also track <span 
                      className="PhrazeHighlight has-annotations" 
                      data-label="Metrics" 
                      data-label-type="Web Performance Standards"
                      data-code="WEBVITALS-001" 
                      data-code-type="Performance Metrics"
                      data-notes="Focus on LCP, FID, and CLS. These are Google's key user experience metrics that impact SEO rankings."
                      data-user="Tom Wilson"
                    >Core Web Vitals</span> - especially Largest Contentful Paint and First Input Delay.
              </div>
                  <div className="message-actions" style={{ position: 'absolute', left: '-120px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '8px', opacity: '0', transition: 'opacity 0.2s' }}>
                    <button title="Copy message" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <button title="Edit message" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button title="Draw on message (click again to close)" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                        <path d="M2 2l7.586 7.586"></path>
                        <circle cx="11" cy="11" r="2"></circle>
                      </svg>
                    </button>
                </div>
                </div>
              </div>
            </div>

            {/* Alex asks another question directly */}
            <div style={{ padding: '0 1rem', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'flex-end', position: 'relative', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: '0' }}>
                {/* Username display with profile icon */}
                <div style={{ fontSize: '0.8rem', marginBottom: '8px', fontWeight: '500', color: '#555', textAlign: 'right', paddingRight: '0', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <img 
                    src="https://api.dicebear.com/7.x/notionists/svg?seed=Alex&backgroundColor=ffdfbf" 
                    alt="Alex Kim" 
                    style={{ 
                      width: '20px', 
                      height: '20px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      border: '1px solid #cbd5e1'
                    }} 
                  />
                  <span>Alex Kim</span>
                </div>
                <div className="message-bubble" style={{ padding: '1rem', background: '#ffffff', borderRadius: '2rem', borderBottomRightRadius: '5px', color: '#0A0A0A', display: 'inline-block', width: '100%', position: 'relative', marginTop: '4px' }}>
                  <div id="message-content4" style={{ fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    What's the best way to handle <span className="PhrazeHighlight">image optimization</span> for better loading times?
              </div>
                  <div className="message-actions" style={{ position: 'absolute', left: '-120px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '8px', opacity: '0', transition: 'opacity 0.2s' }}>
                    <button title="Copy message" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <button title="Edit message" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button title="Draw on message (click again to close)" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                        <path d="M2 2l7.586 7.586"></path>
                        <circle cx="11" cy="11" r="2"></circle>
                      </svg>
                    </button>
                </div>
                </div>
              </div>
            </div>

            {/* AI responds to Alex's direct question */}
            <div style={{ padding: '0', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'flex-start', position: 'relative', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: '0' }}>
                {/* Username display with profile icon */}
                <div style={{ fontSize: '0.8rem', marginBottom: '8px', fontWeight: '500', color: '#555', textAlign: 'left', paddingRight: '0rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-start' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '600', color: 'white', border: '1px solid #475569' }}>
                    P
                </div>
                  <span>phraze</span>
                </div>
                <div className="message-bubble" style={{ padding: '0rem', background: 'transparent', borderRadius: '0.5rem', color: '#0A0A0A', display: 'inline-block', width: '100%', position: 'relative', marginTop: '4px' }}>
                  <div id="message-content-ai2" style={{ fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'normal' }}>
                    For image optimization, consider: 1. <span className="PhrazeHighlight">WebP and AVIF formats</span> for better compression 2. Lazy loading for images below the fold 3. Responsive images with different sizes for different devices.
                  </div>
                  <div className="ai-message-actions" style={{ marginTop: '8px', display: 'flex', gap: '8px', opacity: 1, justifyContent: 'flex-start' }}>
                    <button style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }} title="Copy message">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <button style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }} title="Regenerate response">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                      </svg>
                    </button>
                    <button style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }} title="Edit message">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Maria shares her experience */}
            <div style={{ padding: '0 1rem', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'flex-end', position: 'relative', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: '0' }}>
                {/* Username display with profile icon */}
                <div style={{ fontSize: '0.8rem', marginBottom: '8px', fontWeight: '500', color: '#555', textAlign: 'right', paddingRight: '0', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <img 
                    src="https://api.dicebear.com/7.x/bottts/svg?seed=Maria&backgroundColor=d1d4f9" 
                    alt="Maria Rodriguez" 
                    style={{ 
                      width: '20px', 
                      height: '20px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      border: '1px solid #cbd5e1'
                    }} 
                  />
                  <span>Maria Rodriguez</span>
                </div>
                <div className="message-bubble" style={{ padding: '1rem', background: '#ffffff', borderRadius: '2rem', borderBottomRightRadius: '5px', color: '#0A0A0A', display: 'inline-block', width: '100%', position: 'relative', marginTop: '4px' }}>
                  <div id="message-content5" style={{ fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    <strong>@Alex</strong> We've had great success with <span 
                      className="PhrazeHighlight has-annotations" 
                      data-label="Tool" 
                      data-label-type="CDN Solution"
                      data-code="CDN-001" 
                      data-code-type="Image Optimization"
                      data-notes="Reduced image load times by 40%. Supports WebP, AVIF formats. Automatic compression without quality loss."
                      data-user="Maria Rodriguez"
                    >Cloudflare Image Optimization</span>. It automatically converts images to the best format and compresses them.
              </div>
                  <div className="message-actions" style={{ position: 'absolute', left: '-120px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '8px', opacity: '0', transition: 'opacity 0.2s' }}>
                    <button title="Copy message" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <button title="Edit message" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button title="Draw on message (click again to close)" style={{ background: 'rgba(240, 240, 240, 0.8)', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', color: 'rgb(107, 114, 128)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                        <path d="M2 2l7.586 7.586"></path>
                        <circle cx="11" cy="11" r="2"></circle>
                      </svg>
                    </button>
                </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="chat-demo-input" style={{ 
            paddingTop: '0.15rem',
            padding: '0.15rem 1.5rem 1.5rem 1.5rem',
            marginTop: '0',
            background: 'transparent'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: '0.75rem',
              backgroundColor: '#fff',
              padding: '0',
              width: '100%',
              maxWidth: '850px',
              margin: '0 auto'
            }}>
              {/* Image upload button */}
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.9rem 1.25rem',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Upload image"
                disabled
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </button>

              {/* Microphone button */}
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.9rem 0.5rem',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '0.5rem'
                }}
                title="Speak"
                disabled
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
              </button>

              {/* Text input */}
              <textarea
                placeholder="Message Phraze..."
                style={{
                  width: '100%',
                  padding: '0.9rem 0.5rem',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  lineHeight: '1.5',
                  resize: 'none',
                  maxHeight: '200px',
                  outline: 'none',
                  backgroundColor: '#fff',
                  fontFamily: 'inherit',
                  overflowY: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
                rows={1}
                disabled
              />

              {/* Send button */}
              <button
                type="submit"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'not-allowed',
                  opacity: 0.5,
                  transition: 'opacity 0.2s',
                  padding: '0.9rem 1.25rem'
                }}
                disabled
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="black"
                  strokeWidth="2"
                  style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    transform: 'rotate(90deg)',
                    color: '#10a37f'
                  }}
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
            

          </div>

        </div>
        
        {/* Feature Showcase Section with gradient circles */}
        <div style={{ position: 'relative' }}>
          {/* Shared Insights Description */}
          <div style={{
            maxWidth: '1400px',
            margin: '2rem auto 0.5rem auto',
            paddingLeft: '20px',
            paddingRight: '20px',
            textAlign: 'left'
          }}>
            <h2 style={{
              fontSize: '0.9rem',
              fontWeight: '500',
              color: '#6b7280',
              marginBottom: '0',
              marginTop: '2rem',
              fontFamily: '"Inter", "Inter Fallback", sans-serif',
              letterSpacing: '0.02em'
            }}>
              See What's Possible
            </h2>
          </div>
          
          {/* Gradient circles behind feature panels */}
          {/* Purple Circle (Bottom Left) */}
          <div style={{
            position: 'absolute',
            left: '-140px',
            top: '770px',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(195, 200, 255, 0.4) 0%, rgba(204, 208, 255, 0.35) 25%, rgba(212, 215, 255, 0.25) 45%, rgba(240, 242, 255, 0.12) 65%, rgba(240, 242, 255, 0.04) 80%, rgba(255, 255, 255, 0) 100%)',
            zIndex: 1,
            pointerEvents: 'none'
          }}></div>
          
          {/* Teal Circle (Top Right) */}
          <div style={{
            position: 'absolute',
            top: '-100px',
            right: '-150px',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(195, 255, 230, 0.4) 0%, rgba(204, 255, 235, 0.35) 25%, rgba(212, 255, 240, 0.25) 45%, rgba(240, 255, 248, 0.12) 65%, rgba(240, 255, 248, 0.04) 80%, rgba(255, 255, 255, 0) 100%)',
            zIndex: 1,
            pointerEvents: 'none'
          }}></div>
          
          <div style={{ position: 'relative', zIndex: 2 }}>
        <FeatureShowcase />
          </div>
        </div>
        
        {/* Video demonstration underneath the chat demo */}
        <div style={{
          marginTop: '0',
          marginLeft: 'auto',
          marginRight: 'auto',
          marginBottom: '0',
          textAlign: 'center',
          maxWidth: '1250px',
          padding: '0 20px'
        }}>
          <div className="video-demo-header" style={{
            marginTop: '7.2rem'
          }}>
            <h2 style={{
              fontSize: '1.7rem',
              fontWeight: 700,
              color: '#1a1a1a',
              marginBottom: '2rem',
              marginTop: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
              letterSpacing: '-0.02em',
              lineHeight: '1.2'
            }}>Product Demo</h2>
            <p style={{
              fontSize: '18px',
              color: '#666',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: '1.6',
              marginBottom: '2.5rem',
              fontFamily: '"Inter", "Inter Fallback", sans-serif'
            }}>Watch our demo to see how Phraze transforms AI conversations with intelligent highlighting and annotation</p>
          </div>
          
          {/* Video with grey background frame */}
          <div style={{
            position: 'relative',
            padding: '3rem',
            borderRadius: '16px',
            display: 'inline-block',
            width: '100%',
            border: '2px solid #e5e7eb',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            {/* Background image with lightening overlay */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url(${greyBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
              backgroundBlendMode: 'lighten',
              filter: 'blur(0.2px)'
            }}></div>
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                position: 'relative',
                zIndex: 1
              }}
            >
              <source src={getVideoPath('video.mp4')} type="video/mp4" />
            </video>
          </div>
        </div>
        
        {/* Two Feature Sections */}
        <div style={{
          marginTop: '4rem',
          maxWidth: '1400px',
          margin: '4rem auto 0 auto',
          padding: '0 20px'
        }}>
          <div style={{
            display: 'flex',
            gap: '3rem',
            justifyContent: 'space-between'
          }}>
            {/* Left Section */}
            <div style={{ flex: '1' }}>
              <h2 style={{
                fontSize: '1.7rem',
                fontWeight: 700,
                color: '#1a1a1a',
                marginBottom: '1rem',
                marginTop: 0,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                letterSpacing: '-0.02em',
                lineHeight: '1.2'
              }}>Annotate your chats</h2>
              <p style={{
                fontSize: '18px',
                color: '#6b7280',
                lineHeight: '1.6',
                fontFamily: '"Inter", "Inter Fallback", sans-serif',
                marginBottom: '2rem'
              }}>Highlight, code, and take notes directly in conversations so insights are always captured, organized, and never lost.</p>
              
              <div style={{
                height: '300px',
                background: 'radial-gradient(circle at 50% 50%, #c3d9ff, #ccdfff, #d4e5ff, #ddeaff, #e5efff, #eef5ff, #f6f9ff, #ffffff)',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '80%',
                  height: '242px',
                  backgroundColor: '#ffffff',
                  borderRadius: '16px 16px 0 0',
                  boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  padding: '1.5rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '1rem'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16">
                      <path fill="currentColor" fillRule="evenodd" d="m14.773 3.485l-.78-.184l-2.108 2.096l-1.194-1.216l2.056-2.157l-.18-.792a4.42 4.42 0 0 0-1.347-.228a3.64 3.64 0 0 0-1.457.28a3.824 3.824 0 0 0-1.186.84a3.736 3.736 0 0 0-.875 1.265a3.938 3.938 0 0 0 0 2.966a335.341 335.341 0 0 0-6.173 6.234c-.21.275-.31.618-.284.963a1.403 1.403 0 0 0 .464.967c.124.135.272.247.437.328c.17.075.353.118.538.127c.316-.006.619-.126.854-.337c1.548-1.457 4.514-4.45 6.199-6.204c.457.194.948.294 1.444.293a3.736 3.736 0 0 0 2.677-1.133a3.885 3.885 0 0 0 1.111-2.73a4.211 4.211 0 0 0-.196-1.378zM2.933 13.928a.31.31 0 0 1-.135.07a.437.437 0 0 1-.149 0a.346.346 0 0 1-.144-.057a.336.336 0 0 1-.114-.11c-.14-.143-.271-.415-.14-.568c1.37-1.457 4.191-4.305 5.955-6.046c.1.132.21.258.328.376c.118.123.245.237.38.341c-1.706 1.75-4.488 4.564-5.98 5.994zm11.118-9.065c.002.765-.296 1.5-.832 2.048a2.861 2.861 0 0 1-4.007 0a2.992 2.992 0 0 1-.635-3.137A2.748 2.748 0 0 1 10.14 2.18a2.76 2.76 0 0 1 1.072-.214h.254L9.649 3.839v.696l1.895 1.886h.66l1.847-1.816v.258zM3.24 6.688h1.531l.705.717l.678-.674l-.665-.678V6.01l.057-1.649l-.22-.437l-2.86-1.882l-.591.066l-.831.849l-.066.599l1.838 2.918l.424.215zm-.945-3.632L4.609 4.58L4.57 5.703H3.494L2.002 3.341l.293-.285zm7.105 6.96l.674-.673l3.106 3.185a1.479 1.479 0 0 1 0 2.039a1.404 1.404 0 0 1-1.549.315a1.31 1.31 0 0 1-.437-.315l-3.142-3.203l.679-.678l3.132 3.194a.402.402 0 0 0 .153.105a.477.477 0 0 0 .359 0a.403.403 0 0 0 .153-.105a.436.436 0 0 0 .1-.153a.525.525 0 0 0 .036-.184a.547.547 0 0 0-.035-.184a.436.436 0 0 0-.1-.153L9.4 10.016z" clipRule="evenodd"/>
                    </svg>
                    <span style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#374151'
                    }}>Tools</span>
                  </div>
                  
                  {/* Four Icons */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '1.25rem'
                  }}>
                    {/* Icon 1 - Tag */}
                    <div style={{
                      width: '82px',
                      height: '82px',
                      background: 'linear-gradient(145deg, #ffffff, #e6e6e6)',
                      borderRadius: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      boxShadow: 'inset 1px 1px 3px rgba(255, 255, 255, 0.7), inset -1px -1px 3px rgba(0, 0, 0, 0.08), 3px 3px 6px rgba(0, 0, 0, 0.08)'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24">
                        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
                          <path d="m17.524 17.524l-2.722 2.723a2.567 2.567 0 0 1-3.634 0L4.13 13.209A3.852 3.852 0 0 1 3 10.487V5.568A2.568 2.568 0 0 1 5.568 3h4.919c1.021 0 2 .407 2.722 1.13l7.038 7.038a2.567 2.567 0 0 1 0 3.634z"/>
                          <path d="M9.126 11.694a2.568 2.568 0 1 0 0-5.137a2.568 2.568 0 0 0 0 5.137"/>
                        </g>
                      </svg>
                    </div>
                    
                    {/* Icon 2 - Sparkles */}
                    <div style={{
                      width: '82px',
                      height: '82px',
                      background: 'linear-gradient(145deg, #ffffff, #e6e6e6)',
                      borderRadius: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      boxShadow: 'inset 1px 1px 3px rgba(255, 255, 255, 0.7), inset -1px -1px 3px rgba(0, 0, 0, 0.08), 3px 3px 6px rgba(0, 0, 0, 0.08)'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24">
                        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
                          <path d="m11.777 10l4.83 1.294M11 12.898l2.898.776m6.414-1.027c-.605 2.255-.907 3.383-1.592 4.114a4 4 0 0 1-2.01 1.161c-.097.023-.195.04-.295.052c-.915.113-2.032-.186-4.064-.73c-2.255-.605-3.383-.907-4.114-1.592a4 4 0 0 1-1.161-2.011c-.228-.976.074-2.103.679-4.358l.517-1.932l.244-.905c.455-1.666.761-2.583 1.348-3.21a4 4 0 0 1 2.01-1.16c.976-.228 2.104.074 4.36.679c2.254.604 3.382.906 4.113 1.59a4 4 0 0 1 1.161 2.012c.161.69.057 1.456-.231 2.643"/>
                          <path strokeLinejoin="round" d="M3.272 16.647c.604 2.255.907 3.383 1.592 4.114a4 4 0 0 0 2.01 1.161c.976.227 2.104-.075 4.36-.679c2.254-.604 3.382-.906 4.113-1.591a4 4 0 0 0 1.068-1.678M8.516 6.445c-.352.091-.739.195-1.165.31c-2.255.604-3.383.906-4.114 1.59a4 4 0 0 0-1.161 2.012c-.161.69-.057 1.456.231 2.643"/>
                        </g>
                      </svg>
                    </div>
                    
                    {/* Icon 3 - Users */}
                    <div style={{
                      width: '82px',
                      height: '82px',
                      background: 'linear-gradient(145deg, #ffffff, #e6e6e6)',
                      borderRadius: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      boxShadow: 'inset 1px 1px 3px rgba(255, 255, 255, 0.7), inset -1px -1px 3px rgba(0, 0, 0, 0.08), 3px 3px 6px rgba(0, 0, 0, 0.08)'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 20 20">
                        <path fill="currentColor" d="M6.75 3.5a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5ZM3.5 5.75a3.25 3.25 0 1 1 6.5 0a3.25 3.25 0 0 1-6.5 0Zm0 4.25a2 2 0 0 0-2 2v.084a1.717 1.717 0 0 0 .012.175a3.948 3.948 0 0 0 .67 1.806C2.883 15.08 4.237 16 6.75 16c.946 0 1.727-.13 2.371-.347a5.6 5.6 0 0 1-.12-1.02c-.564.222-1.297.367-2.251.367c-2.237 0-3.258-.799-3.745-1.503a2.948 2.948 0 0 1-.498-1.336a1.608 1.608 0 0 1-.006-.083l-.001-.017V12a1 1 0 0 1 1-1H10c.08 0 .16.01.235.028c.227-.28.48-.535.758-.765A1.991 1.991 0 0 0 10 10H3.5Zm11-5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3ZM12 6.5a2.5 2.5 0 1 1 5 0a2.5 2.5 0 0 1-5 0ZM14.5 19a4.5 4.5 0 1 0-3.937-2.318l-.544 1.789a.41.41 0 0 0 .51.51l1.79-.544A4.48 4.48 0 0 0 14.5 19ZM12 13.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5Zm.5 2.5a.5.5 0 0 1 0-1h2a.5.5 0 0 1 0 1h-2Z"/>
                      </svg>
                    </div>
                    
                    {/* Icon 4 - Search */}
                    <div style={{
                      width: '82px',
                      height: '82px',
                      background: 'linear-gradient(145deg, #ffffff, #e6e6e6)',
                      borderRadius: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      boxShadow: 'inset 1px 1px 3px rgba(255, 255, 255, 0.7), inset -1px -1px 3px rgba(0, 0, 0, 0.08), 3px 3px 6px rgba(0, 0, 0, 0.08)'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 26 26">
                        <path fill="currentColor" d="M10 .188A9.812 9.812 0 0 0 .187 10A9.812 9.812 0 0 0 10 19.813c2.29 0 4.393-.811 6.063-2.125l.875.875a1.845 1.845 0 0 0 .343 2.156l4.594 4.625c.713.714 1.88.714 2.594 0l.875-.875a1.84 1.84 0 0 0 0-2.594l-4.625-4.594a1.824 1.824 0 0 0-2.157-.312l-.875-.875A9.812 9.812 0 0 0 10 .188zM10 2a8 8 0 1 1 0 16a8 8 0 0 1 0-16zM4.937 7.469a5.446 5.446 0 0 0-.812 2.875a5.46 5.46 0 0 0 5.469 5.469a5.516 5.516 0 0 0 3.156-1a7.166 7.166 0 0 1-.75.03a7.045 7.045 0 0 1-7.063-7.062c0-.104-.005-.208 0-.312z"/>
                      </svg>
                    </div>
                  </div>
                  
                  {/* Feature Status Indicators */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '1.5rem',
                    gap: '1.5rem'
                  }}>
                    {/* Labels & Codes */}
                    <div style={{
                      textAlign: 'center',
                      flex: '1'
                    }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.25rem'
                      }}>Labels</div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>Active</div>
                    </div>
                    
                    {/* Notes */}
                    <div style={{
                      textAlign: 'center',
                      flex: '1'
                    }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.25rem'
                      }}>Notes</div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>Synced</div>
                    </div>
                    
                    {/* Collaboration */}
                    <div style={{
                      textAlign: 'center',
                      flex: '1'
                    }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.25rem'
                      }}>Collaboration</div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>Is live</div>
                    </div>
                    
                    {/* Search */}
                    <div style={{
                      textAlign: 'center',
                      flex: '1'
                    }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.25rem'
                      }}>Search</div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>Annotations</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Section */}
            <div style={{ flex: '1' }}>
              <h2 style={{
                fontSize: '1.7rem',
                fontWeight: 700,
                color: '#1a1a1a',
                marginBottom: '1rem',
                marginTop: 0,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                letterSpacing: '-0.02em',
                lineHeight: '1.2'
              }}>Collaborate in real time</h2>
              <p style={{
                fontSize: '18px',
                color: '#6b7280',
                lineHeight: '1.6',
                fontFamily: '"Inter", "Inter Fallback", sans-serif',
                marginBottom: '2rem'
              }}>Collaborate directly within your conversations. Add meaning, context, and ideas all in one place.</p>
              
              <div style={{
                height: '300px',
                background: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '80%',
                  height: '242px',
                  backgroundColor: '#ffffff',
                  borderRadius: '16px 16px 0 0',
                  boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.07)',
                  border: '1px solid rgba(0, 0, 0, 0.04)',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* Video Animation */}
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    style={{
                      width: '100%',
                      height: '180px',
                      borderRadius: '8px',
                      objectFit: 'cover'
                    }}
                  >
                    <source src={getVideoPath('anim.mp4')} type="video/mp4" />
                  </video>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Frequently Asked Questions Section */}
        <div style={{
          marginTop: '13.75rem',
          textAlign: 'left',
          maxWidth: '1600px',
          margin: '7rem auto 0 auto',
          padding: '4rem 0',
          position: 'relative'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '3.5rem',
            padding: '0 2rem'
          }}>
            <h2 style={{
              fontSize: '1.7rem',
              fontWeight: '600',
              color: '#1a1a1a',
              marginBottom: '1rem',
              marginTop: 0,
              fontFamily: '"Inter", "Inter Fallback", sans-serif',
              letterSpacing: '-0.025em'
            }}>Want to know more?</h2>
            <p style={{
              fontSize: '18px',
              color: '#6b7280',
              marginBottom: '0',
              lineHeight: '1.6',
              fontFamily: '"Inter", "Inter Fallback", sans-serif',
              maxWidth: '600px',
              margin: '0 auto'
            }}>Here's a list of FAQs to help you get started!</p>
          </div>
            
            <div style={{
              display: 'flex',
              gap: '2rem',
              alignItems: 'flex-start',
              padding: '0 2rem'
            }}>
              {/* FAQ Section */}
              <div style={{
                flex: '1',
                backgroundColor: '#ffffff',
                padding: '0',
                borderRadius: '20px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                border: '1px solid #e2e8f0'
              }}>
              {[
                {
                  question: "What is Phraze?",
                  answer: "Phraze is a collaborative workspace and living notebook for every AI conversation. It helps you highlight, annotate, and organize text from any webpage or LLM conversation.",
                  isFirst: true
                },
                {
                  question: "How does Phraze work?",
                  answer: "Phraze uses intelligent highlighting and annotation to transform AI conversations. You can add labels, codes, and notes to individual messages, making it easy to organize discussions and capture insights as they happen."
                },
                {
                  question: "What makes Phraze different from other tools?",
                  answer: "Unlike traditional tools that require exporting transcripts and switching platforms, Phraze keeps everything in context. It turns raw dialogue into organized, actionable material while maintaining the conversation flow."
                },
                {
                  question: "Can I collaborate with my team?",
                  answer: "Yes! Phraze is built for teams working with conversational data. Multiple collaborators can work in the same thread without leaving the chat, making it perfect for researchers and development teams."
                },
                {
                  question: "How do I get started with Phraze?",
                  answer: "Getting started is easy! Simply sign up for an account, install the Chrome extension if you want web highlighting, and start organizing your AI conversations with our intuitive annotation tools."
                },
                {
                  question: "What types of annotations can I create?",
                  answer: "Phraze supports custom labels, codes, and detailed notes. You can categorize conversations, highlight important insights, and create a structured knowledge base from your AI interactions."
                },
                {
                  question: "Is my data secure with Phraze?",
                  answer: "Absolutely. We prioritize data security and privacy. All your conversations and annotations are encrypted and stored securely. You have full control over your data and can export or delete it at any time."
                },
                {
                  question: "Can I export my annotated conversations?",
                  answer: "Yes! Phraze allows you to export your organized conversations in multiple formats. You can share insights with your team, create reports, or integrate the data with other tools in your workflow.",
                  isLast: true
                }
              ].map((faq, index) => (
                <FAQItem 
                  key={index} 
                  question={faq.question} 
                  answer={faq.answer} 
                  isFirst={index === 0}
                  isLast={index === 7}
                />
              ))}
            </div>
            
            {/* Contact Section */}
            <div style={{
              flex: '0 0 320px',
              backgroundColor: '#ffffff',
              padding: '2.5rem',
              borderRadius: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>Need more support?</h3>
              <p style={{
                fontSize: '0.95rem',
                color: '#6b7280',
                marginBottom: '2rem',
                lineHeight: '1.5',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>Can't find what you're looking for? Get in touch with our team.</p>
              
              <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '0' }}>
                <input
                  type="text"
                  placeholder="Your name"
                  style={{
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontFamily: '"Inter", "Inter Fallback", sans-serif'
                  }}
                />
                <input
                  type="email"
                  placeholder="Your email"
                  style={{
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontFamily: '"Inter", "Inter Fallback", sans-serif'
                  }}
                />
                <input
                  type="text"
                  placeholder="Subject"
                  style={{
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontFamily: '"Inter", "Inter Fallback", sans-serif'
                  }}
                />
                <textarea
                  placeholder="How can we help?"
                  rows="4"
                  style={{
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontFamily: '"Inter", "Inter Fallback", sans-serif',
                    resize: 'vertical'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f8fafc',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    fontFamily: '"Inter", "Inter Fallback", sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginBottom: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#f1f5f9';
                    e.target.style.borderColor = '#d1d5db';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#f8fafc';
                    e.target.style.borderColor = '#e5e7eb';
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 2L11 13" />
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                  </svg>
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
        
        {/* Call to Action Section */}
        <div style={{
          maxWidth: '1600px',
          margin: '8rem auto 0 auto',
          padding: '4rem 2rem',
          background: '#ffffff',
          borderRadius: '32px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4rem',
            flexWrap: 'wrap'
          }}>
            {/* Text Content */}
            <div style={{
              textAlign: 'center',
              maxWidth: '800px'
            }}>
              {/* Decorative Badge */}
              <div style={{
                display: 'inline-block',
                backgroundColor: '#f0f9ff',
                color: '#0369a1',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '0.875rem',
                fontWeight: '500',
                marginBottom: '1.5rem',
                fontFamily: '"Inter", "Inter Fallback", sans-serif',
                border: '1px solid rgba(3, 105, 161, 0.1)'
              }}>
                ✨ Start collaborating today
              </div>
              
              <h2 style={{
                fontSize: '2.5rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '1.5rem',
                marginTop: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif',
                letterSpacing: '-0.02em',
                lineHeight: '1.2'
              }}>
                Transform Your Workflow Now
              </h2>
              
              <p style={{
                fontSize: '1.125rem',
                color: '#6b7280',
                marginBottom: '2.5rem',
                lineHeight: '1.6',
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                Collaborate on AI conversations with your team.<br />
                Organize and annotate everything in one place.
              </p>
              
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'center',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <button style={{
                  backgroundColor: '#111827',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 32px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  fontFamily: '"Inter", "Inter Fallback", sans-serif',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(17, 24, 39, 0.15)',
                  letterSpacing: '-0.01em'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#1f2937';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 6px 16px rgba(17, 24, 39, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#111827';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(17, 24, 39, 0.15)';
                }}
                >
                  Try Now
                </button>
                
                <a href="#demo" style={{
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px 32px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  fontFamily: '"Inter", "Inter Fallback", sans-serif',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textDecoration: 'none',
                  display: 'inline-block',
                  letterSpacing: '-0.01em'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#f9fafb';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.borderColor = '#d1d5db';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#ffffff';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.borderColor = '#e5e7eb';
                }}
                >
                  Watch Demo →
                </a>
              </div>
              
              <p style={{
                fontSize: '0.875rem',
                color: '#9ca3af',
                marginTop: '1.5rem',
                marginBottom: 0,
                fontFamily: '"Inter", "Inter Fallback", sans-serif'
              }}>
                No credit card required • Free to start
              </p>
            </div>
          </div>
        </div>
        
        {/* Minimal Footer */}
        <div style={{
          textAlign: 'center',
          padding: '7rem 0 4rem 0',
          marginTop: '4rem',
          borderTop: '1px solid rgba(0, 0, 0, 0.06)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            marginBottom: '1rem',
            flexWrap: 'wrap'
          }}>
                      <Link to="/terms" style={{
            fontSize: '14px',
            color: '#6b7280',
            textDecoration: 'none',
            fontFamily: '"Inter", "Inter Fallback", sans-serif',
            transition: 'color 0.2s ease'
          }}>Terms of Service</Link>
            <Link to="/privacy" style={{
              fontSize: '14px',
              color: '#6b7280',
              textDecoration: 'none',
              fontFamily: '"Inter", "Inter Fallback", sans-serif',
              transition: 'color 0.2s ease'
            }}>Privacy Policy</Link>
            <Link to="/cookies" style={{
              fontSize: '14px',
              color: '#6b7280',
              textDecoration: 'none',
              fontFamily: '"Inter", "Inter Fallback", sans-serif',
              transition: 'color 0.2s ease'
            }}>Cookie Policy</Link>
            <Link to="/contact" style={{
              fontSize: '14px',
              color: '#6b7280',
              textDecoration: 'none',
              fontFamily: '"Inter", "Inter Fallback", sans-serif',
              transition: 'color 0.2s ease'
            }}>Contact</Link>
          </div>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: '0',
            fontFamily: '"Inter", "Inter Fallback", sans-serif'
          }}>
            © 2025 Phraze. All rights reserved. Affiliated with Human-Centered Computing Group (HCCG).
          </p>
        </div>
      </div>
    </section>
  );
}

// FAQ Item Component
function FAQItem({ question, answer, isFirst, isLast }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="faq-item" style={{
      borderBottom: isLast ? 'none' : '1px solid #e2e8f0',
      padding: '1.25rem 2rem',
      textAlign: 'left',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      backgroundColor: isOpen ? '#fafafa' : '#ffffff',
      borderRadius: isFirst ? '20px 20px 0 0' : isLast ? '0 0 20px 20px' : '0',
      ':hover': {
        backgroundColor: '#f9fafb'
      }
    }}
    onClick={() => setIsOpen(!isOpen)}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        <div style={{
          flex: 1,
          minWidth: 0
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontFamily: '"Inter", "Inter Fallback", sans-serif',
            fontWeight: '500',
            color: '#111827',
            margin: '0',
            lineHeight: '1.4'
          }}>{question}</h3>
          
          <div style={{
            maxHeight: isOpen ? '300px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: isOpen ? 1 : 0
          }}>
            <p style={{
              color: '#6b7280',
              lineHeight: '1.6',
              fontSize: '0.95rem',
              fontFamily: '"Inter", "Inter Fallback", sans-serif',
              fontWeight: '400',
              margin: '0',
              paddingTop: '0.5rem'
            }}>
              {answer}
            </p>
          </div>
        </div>
        
        <div style={{
          flexShrink: 0
        }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              color: '#9ca3af'
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
