import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import SlidingRectangles from '../components/SlidingRectangles';
import { useScrollAnimation } from '../components/ScrollAnimation';
import { getImagePath, getVideoPath } from '../utils/assetPaths';
import ProjectStack from '../components/ProjectStack';
import AnnotationPanel from '../components/AnnotationPanel';
import DataManagementPanel from '../components/DataManagementPanel';
import Footer from '../../karumi/components/Footer.jsx';

export default function Features() {
  // Initialize scroll animation
  useScrollAnimation();
  const [showBentoGrid, setShowBentoGrid] = useState(false);
  const scrollRef = useRef(null);
  const chatScrollRef = useRef(null);
  const isHoveredRef = useRef(false);
  const [hoveredTooltip, setHoveredTooltip] = useState(null);
  const [animationStep, setAnimationStep] = useState(0);

  // Export demo state variables
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportOption, setSelectedExportOption] = useState('download');
  const [showExportToast, setShowExportToast] = useState(false);
  const [exportButtonClicked, setExportButtonClicked] = useState(false);

  // Import demo state variables
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportToast, setShowImportToast] = useState(false);
  const [importButtonClicked, setImportButtonClicked] = useState(false);

  // Typing animation state for invite code
  const [typingText, setTypingText] = useState('');
  const [currentCodeIndex, setCurrentCodeIndex] = useState(0);
  
  // Generate random 8-character codes
  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  
  const inviteCodes = Array.from({ length: 10 }, generateRandomCode);
  
  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showAnnotationHistory, setShowAnnotationHistory] = useState(false);

  // AI Chat simulation state variables
  const [showAIChat, setShowAIChat] = useState(false);
  const [currentChatMessage, setCurrentChatMessage] = useState(0);
  const [highlightedText, setHighlightedText] = useState('');
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);

  // Contact list animation state variables
  const [showChatView, setShowChatView] = useState(false);
  const [clickedContact, setClickedContact] = useState(null);
  const [contactListOpacity, setContactListOpacity] = useState(1);

  useEffect(() => {
    // Show bento grid when user scrolls down
    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (scrollY > 100) { // Show when scrolled down 100px
        setShowBentoGrid(true);
      } else {
        setShowBentoGrid(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-cycling animation for modals (first cell only)
  useEffect(() => {
    if (!showBentoGrid) return;

    const animationSequence = [
      'highlight-1', 'info-1', 'delete-1'
    ];

    const interval = setInterval(() => {
      setAnimationStep(prev => {
        const nextStep = (prev + 1) % animationSequence.length;
        setHoveredTooltip(animationSequence[nextStep]);
        return nextStep;
      });
    }, 2500); // Change every 2.5 seconds

    // Start the animation after a delay
    const startTimeout = setTimeout(() => {
      setHoveredTooltip(animationSequence[0]);
    }, 1500);

    return () => {
      clearInterval(interval);
      clearTimeout(startTimeout);
    };
  }, [showBentoGrid]);

  // Typing animation for invite code input
  useEffect(() => {
    if (!showBentoGrid) return;

    const currentCode = inviteCodes[currentCodeIndex];
    let currentCharIndex = 0;
    let isDeleting = false;

    const typeInterval = setInterval(() => {
      if (isDeleting) {
        setTypingText(currentCode.substring(0, currentCharIndex - 1));
        currentCharIndex--;
        
        if (currentCharIndex === 0) {
          isDeleting = false;
          setCurrentCodeIndex((prev) => (prev + 1) % inviteCodes.length);
        }
      } else {
        setTypingText(currentCode.substring(0, currentCharIndex + 1));
        currentCharIndex++;
        
        if (currentCharIndex === currentCode.length) {
          // Show toast notification when code is complete
          setToastMessage(`Invite code ${currentCode} generated!`);
          setShowToast(true);
          
          setTimeout(() => {
            setShowToast(false);
          }, 3000); // Hide toast after 3 seconds
          
          setTimeout(() => {
            isDeleting = true;
          }, 2000); // Wait 2 seconds before deleting
        }
      }
    }, isDeleting ? 50 : 100); // Faster deletion, slower typing

    return () => clearInterval(typeInterval);
  }, [showBentoGrid, currentCodeIndex]);

  // Luxurious scroll effect for Import/Export panel with integrated modal trigger
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let targetScrollPosition = 0;
    let currentScrollPosition = 0;
    let isPaused = false;
    let pauseStartTime = 0;
    let modalTriggered = false;
    let isScrollingDown = true;
    let modalTimeouts = []; // Track all timeouts for cleanup
    const scrollSpeed = 1.5; // pixels per frame (much faster)
    const scrollUpSpeed = 12.0; // lightning fast when scrolling back up
    const smoothness = 0.11; // slightly smoother
    const pauseDuration = 1600; // 1.6 seconds pause at the top (slightly slower)

    const clearModalTimeouts = () => {
      modalTimeouts.forEach(timeout => clearTimeout(timeout));
      modalTimeouts = [];
    };

    const autoScroll = () => {
      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      if (maxScroll > 0 && !isHoveredRef.current) {
        // Check if we're at the top and should pause
        if (targetScrollPosition <= 0 && !isPaused && !isScrollingDown) {
          isPaused = true;
          pauseStartTime = Date.now();
          modalTriggered = false; // Reset modal trigger for new cycle
          isScrollingDown = true; // Prepare for next cycle
        }

        // Check if pause duration has elapsed and trigger modal
        if (isPaused && Date.now() - pauseStartTime >= pauseDuration && !modalTriggered) {
          modalTriggered = true;
          // Clear any existing timeouts first
          clearModalTimeouts();
          
          // Reset import states for new cycle
          setSelectedFile(null);
          setShowImportModal(false);
          setShowAnnotationHistory(false);
          
          // Trigger export demo sequence
          setExportButtonClicked(true);
          
          // Step 1: Show modal after button click effect
          const timeout1 = setTimeout(() => {
            setExportButtonClicked(false);
            setShowExportModal(true);
          }, 400); // Slightly slower
          modalTimeouts.push(timeout1);

          // Step 2: Auto-select "Continue Download" and close modal
          const timeout2 = setTimeout(() => {
            setShowExportModal(false);
            setShowExportToast(true);
          }, 2300); // Slightly slower
          modalTimeouts.push(timeout2);

          // Step 3: Hide toast and start import animation
          const timeout3 = setTimeout(() => {
            setShowExportToast(false);
            // Start import animation after 1.2 second pause (slightly slower)
            setTimeout(() => {
              setImportButtonClicked(true);
              setTimeout(() => {
                setImportButtonClicked(false);
                setShowImportModal(true);
              }, 300); // Slightly slower
              setTimeout(() => {
                setSelectedFile('annotations.json');
              }, 1400); // Slightly slower
              setTimeout(() => {
                setIsImporting(true);
              }, 2500); // Stay on file modal longer
              setTimeout(() => {
                setShowImportModal(false);
                setIsImporting(false);
                setShowAnnotationHistory(true);
                setShowImportToast(true); // Show toast immediately when history loads
              }, 3600); // Adjusted for longer file modal time
              setTimeout(() => {
                setShowImportToast(false);
              }, 6000); // Adjusted timing
              setTimeout(() => {
                setShowAnnotationHistory(false);
                // Start AI Chat simulation after annotation history - show all messages at once
                setShowAIChat(true);
                setCurrentChatMessage(3); // Show all messages at once
                setHighlightedText(''); // No specific highlight initially
              }, 8000); // Start AI chat after annotation history
              setTimeout(() => {
                setShowAIChat(false);
                setShowAnnotationPanel(false);
                setHighlightedText('');
                setCurrentChatMessage(0);
                // Reset to export screen 0 and start new cycle after 2 seconds (reduced from 5s)
                setTimeout(() => {
            isPaused = false; // Resume scrolling
            clearModalTimeouts(); // Clear timeouts after completion
                }, 2000); // Reduced pause
              }, 12000); // End AI chat simulation (reduced from 20s to 12s)
            }, 1200); // Slightly slower
          }, 3800); // Slightly slower
          modalTimeouts.push(timeout3);
        }

        // Only scroll if not paused
        if (!isPaused) {
          if (isScrollingDown) {
            // Scrolling down
            targetScrollPosition += scrollSpeed;
            
            // When we reach the bottom, start scrolling up
            if (targetScrollPosition >= maxScroll) {
              isScrollingDown = false;
              targetScrollPosition = maxScroll;
            }
          } else {
            // Scrolling up (faster)
            targetScrollPosition -= scrollUpSpeed;
            
            // When we reach the top, prepare for pause
            if (targetScrollPosition <= 0) {
              targetScrollPosition = 0;
            }
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
      clearModalTimeouts(); // Clean up timeouts on unmount
    };
  }, []);

  // Contact list animation sequence effect
  useEffect(() => {
    if (!showBentoGrid || showChatView) {
      setContactListOpacity(1); // Reset opacity when not showing
      return; // Only run when chat view is NOT showing
    }

    // Reset clickedContact to ensure fresh start
    setClickedContact(null);
    setContactListOpacity(1);

    // After 3 seconds, simulate clicking on Alex
    const timeout1 = setTimeout(() => {
      setClickedContact('Alex');
    }, 3000);

    // Cleanup function
    return () => {
      clearTimeout(timeout1);
      if (window._contactAnimationTimeout2) {
        clearTimeout(window._contactAnimationTimeout2);
      }
    };
  }, [showBentoGrid, showChatView]); // Re-run when chat view changes back to false

  // Separate effect for blur and fade transition after Alex is clicked
  useEffect(() => {
    if (clickedContact === 'Alex' && !showChatView) {
      // Wait for blur to be visible, then fade out and show chat
      const timeout2 = setTimeout(() => {
        setContactListOpacity(0);
        
        // After fade completes, show chat view
        const timeout3 = setTimeout(() => {
          setShowChatView(true);
          setContactListOpacity(1); // Reset for next cycle
        }, 300); // Match the transition duration

        window._contactAnimationTimeout3 = timeout3;
      }, 600); // Let blur be visible for 600ms

      window._contactAnimationTimeout2 = timeout2;

      return () => {
        clearTimeout(timeout2);
        if (window._contactAnimationTimeout3) {
          clearTimeout(window._contactAnimationTimeout3);
        }
      };
    }
  }, [clickedContact, showChatView]);

  // Auto-scroll effect for Chat conversation in Collaborative Chat bento box
  useEffect(() => {
    const scrollContainer = chatScrollRef.current;
    if (!scrollContainer || !showChatView) return; // Only scroll when chat view is showing

    let targetScrollPosition = 0;
    let currentScrollPosition = 0;
    let isPaused = false;
    let pauseStartTime = 0;
    let isScrollingDown = true;
    let animationFrameId = 0;
    const scrollSpeed = 1.5; // pixels per frame (for scrolling down)
    const scrollUpSpeed = 12.0; // pixels per frame (for quick scroll back up)
    const smoothness = 0.11; // for smooth interpolation
    const pauseDuration = 1600; // 1.6 seconds pause at boundaries

    const autoScroll = () => {
      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      if (maxScroll > 0) {
        // Check if we're at the top and should pause
        if (targetScrollPosition <= 0 && !isPaused && !isScrollingDown) {
          isPaused = true;
          pauseStartTime = Date.now();
          isScrollingDown = true; // Prepare for next cycle
        }

        // Check if pause duration has elapsed
        if (isPaused && Date.now() - pauseStartTime >= pauseDuration) {
          isPaused = false;
          // When paused at top, restart the entire contact list animation cycle
          setShowChatView(false);
          setClickedContact(null);
        }

        // Only scroll if not paused
        if (!isPaused) {
          if (isScrollingDown) {
            // Scrolling down
            targetScrollPosition += scrollSpeed;
            
            // When we reach the bottom, start scrolling up
            if (targetScrollPosition >= maxScroll) {
              isScrollingDown = false;
              targetScrollPosition = maxScroll;
            }
          } else {
            // Scrolling up (faster)
            targetScrollPosition -= scrollUpSpeed;
            
            // When we reach the top, prepare for pause
            if (targetScrollPosition <= 0) {
              targetScrollPosition = 0;
            }
          }
        }

        // Clamp targetScrollPosition to boundaries
        targetScrollPosition = Math.min(targetScrollPosition, maxScroll);
        targetScrollPosition = Math.max(targetScrollPosition, 0);

        // Smooth interpolation towards target position
        currentScrollPosition += (targetScrollPosition - currentScrollPosition) * smoothness;
        scrollContainer.scrollTop = currentScrollPosition;
      }

      animationFrameId = requestAnimationFrame(autoScroll);
    };

    // Start auto scroll after 1 second delay
    const startTimeout = setTimeout(() => {
      animationFrameId = requestAnimationFrame(autoScroll);
    }, 1000);

    return () => {
      clearTimeout(startTimeout);
      cancelAnimationFrame(animationFrameId);
    };
  }, [showChatView]); // Re-run when chat view changes

  // Setup hover functionality for AI chat highlights
  useEffect(() => {
    if (!showAIChat) return;

    // Function to create and show annotation card
    const createAndShowAnnotationCard = (highlight, autoShow = false) => {
      // Create container span for the highlight
      const containerSpan = document.createElement('span');
      containerSpan.className = 'phraze-highlight-container PhrazeMark unselectable';
      containerSpan.style.position = 'relative';
      containerSpan.style.display = 'inline';
      
      // Wrap the highlight with the container
      highlight.parentNode.insertBefore(containerSpan, highlight);
      containerSpan.appendChild(highlight);
      
      // Get highlight data
      const label = highlight.getAttribute('data-label');
      const labelType = highlight.getAttribute('data-label-type');
      const user = highlight.getAttribute('data-user');
      
      if (!label) return; // Only show if there's a label

      // Create unified annotation card with exact Phraze styling from ChatDemo
      const annotationCard = document.createElement('div');
      annotationCard.className = 'phraze-unified-annotation-card PhrazeMark active';
      annotationCard.style.position = 'fixed';
      annotationCard.style.zIndex = '1000000000';
      annotationCard.style.transform = 'translateX(-50%)';
      annotationCard.style.opacity = '0';
      annotationCard.style.transition = 'opacity 0.2s, visibility 0.2s';
      annotationCard.style.visibility = 'hidden';
      annotationCard.style.pointerEvents = 'none';
      annotationCard.style.width = '260px'; // Reduced from default 320px
      annotationCard.style.minWidth = '260px';
      annotationCard.style.maxWidth = '260px';
      
      // Get user avatar based on user name
      let avatarSrc = '';
      if (user === 'Alex Kim') {
        avatarSrc = 'https://api.dicebear.com/7.x/notionists/svg?seed=Alex&backgroundColor=ffdfbf';
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

      // Build label types section
      let labelTypesSection = '';
      if (labelType) {
        labelTypesSection = `
          <div class="labels-section">
            <div class="conditional-header">Label Types</div>
            <div class="labels-container">
              <span class="label-pill">${labelType}</span>
            </div>
          </div>
        `;
      }

      annotationCard.innerHTML = `
        <div class="annotation-card-header">
          <div class="profile-section">
            <img alt="" class="profile-image" src="${avatarSrc}" style="display: block;">
            <span class="username">${user}</span>
          </div>
          ${labelsSection}
          ${labelTypesSection}
        </div>
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
      
      // Add to body
      document.body.appendChild(annotationCard);
      
      // Setup hover events
      let hideTimeout = null;
      let isMouseOverHighlight = false;
      let isMouseOverCard = false;
      
      const showCard = () => {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        
        // Close other cards
        const openCards = document.querySelectorAll('.phraze-unified-annotation-card.active');
        openCards.forEach(card => {
          if (card !== annotationCard) {
            card.classList.remove('active');
            card.style.opacity = '0';
            card.style.visibility = 'hidden';
            card.style.pointerEvents = 'none';
          }
        });
        
        // Position and show this card - move more to the left and up to stay within bento box
        const rect = containerSpan.getBoundingClientRect();
        const cardWidth = 260; // Updated to match the smaller card width
        let leftPosition = rect.left + rect.width / 2 - cardWidth / 2 - 60; // Move 60px more to the left
        
        // Ensure card stays within viewport bounds
        const minLeft = 20; // 20px from left edge
        const maxLeft = window.innerWidth - cardWidth - 20; // 20px from right edge
        leftPosition = Math.max(minLeft, Math.min(leftPosition, maxLeft));
        
        annotationCard.style.left = `${leftPosition}px`;
        annotationCard.style.top = `${rect.top - 40}px`; // Moved up 30px more (was -10px, now -40px)
        annotationCard.classList.add('active');
        annotationCard.style.opacity = '1';
        annotationCard.style.visibility = 'visible';
        annotationCard.style.pointerEvents = 'auto';
        isMouseOverHighlight = true;
      };
      
      const scheduleHideCard = () => {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
        }
        
        hideTimeout = setTimeout(() => {
          if (!isMouseOverHighlight && !isMouseOverCard) {
            annotationCard.classList.remove('active');
            annotationCard.style.opacity = '0';
            annotationCard.style.visibility = 'hidden';
            annotationCard.style.pointerEvents = 'none';
          }
      }, 200);
      };
      
      const hideCard = () => {
        isMouseOverHighlight = false;
        if (!isMouseOverCard) {
          scheduleHideCard();
        }
      };
      
      // Add event listeners
      containerSpan.addEventListener('mouseenter', showCard);
      containerSpan.addEventListener('mouseleave', hideCard);
      
      annotationCard.addEventListener('mouseenter', () => {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        isMouseOverCard = true;
        annotationCard.classList.add('active');
        annotationCard.style.opacity = '1';
        annotationCard.style.visibility = 'visible';
        annotationCard.style.pointerEvents = 'auto';
      });
      
      annotationCard.addEventListener('mouseleave', () => {
        isMouseOverCard = false;
        if (!isMouseOverHighlight) {
          scheduleHideCard();
        }
      });
      
      // Close button - match ChatDemo structure
      const closeBtn = annotationCard.querySelector('button[title="Close annotation card"]');
      const deleteBtn = annotationCard.querySelector('.delete-highlight-btn');
      
      const removeCard = () => {
        if (annotationCard && annotationCard.parentNode) {
          annotationCard.remove();
        }
      };
      
      closeBtn?.addEventListener('click', removeCard);
      deleteBtn?.addEventListener('click', removeCard);
      
      // Auto-show the first card
      if (autoShow) {
      setTimeout(() => {
          showCard();
          // Auto-hide after 2 seconds (reduced from 3s)
          setTimeout(() => {
            if (!isMouseOverHighlight && !isMouseOverCard) {
              annotationCard.classList.remove('active');
              annotationCard.style.opacity = '0';
              annotationCard.style.visibility = 'hidden';
              annotationCard.style.pointerEvents = 'none';
            }
      }, 2000);
        }, 100);
      }
      
      // Mark as setup
      highlight.setAttribute('data-hover-setup', 'true');
    };

    const setupHighlightHovers = () => {
      const highlights = document.querySelectorAll('.PhrazeHighlight[data-highlight-id]');
      
      // Show first annotation card automatically after a short delay
      if (highlights.length > 0) {
        const firstHighlight = highlights[0];
      setTimeout(() => {
          createAndShowAnnotationCard(firstHighlight, true); // true = auto-show
        }, 800); // Show after 0.8 seconds (reduced from 1.5s)
      }
      
      highlights.forEach((highlight) => {
        if (highlight.hasAttribute('data-hover-setup')) return;
        createAndShowAnnotationCard(highlight, false); // false = hover only
      });
    };
    
    // Setup hovers after a short delay to ensure DOM is ready
    const timeout = setTimeout(setupHighlightHovers, 100);
    
    return () => {
      clearTimeout(timeout);
      // Clean up annotation cards
      const cards = document.querySelectorAll('.phraze-unified-annotation-card');
      cards.forEach(card => card.remove());
    };
  }, [showAIChat, currentChatMessage]);
  
  return (
    <main className="features-page" style={{ 
      background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 95%, #b8c4d0 100%)',
      minHeight: '100vh'
    }}>
      <style>{`
        @keyframes fadeInOut {
          0% {
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        
        @keyframes pulse {
          0% { 
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          50% { 
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.7;
          }
          100% { 
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
        
        @keyframes breathingPulse {
          0% { 
            transform: scale(1);
            opacity: 1;
          }
          50% { 
            transform: scale(1.15);
            opacity: 0.8;
          }
          100% { 
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes dotPulse {
          0%, 60%, 100% { 
            transform: scale(1);
            opacity: 0.4;
          }
          30% { 
            transform: scale(1.2);
            opacity: 1;
          }
        }
        
        @keyframes statusGlow {
          0% {
            box-shadow: 0 3px 8px rgba(16, 185, 129, 0.4), 0 0 0 2px rgba(16, 185, 129, 0.2);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.6), 0 0 0 4px rgba(16, 185, 129, 0.3);
            transform: scale(1.05);
          }
          100% {
            box-shadow: 0 3px 8px rgba(16, 185, 129, 0.4), 0 0 0 2px rgba(16, 185, 129, 0.2);
            transform: scale(1);
          }
        }
        
        @keyframes statusPulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.3);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
        
        @keyframes floatUpDown {
          0%, 100% {
            transform: translate(-50%, -50%) translateY(0px);
          }
          50% {
            transform: translate(-50%, -50%) translateY(-8px);
          }
        }
      `}</style>
      {/* Hero Section */}
      <section className="features-hero" style={{ paddingTop: '260px', background: 'transparent' }}>
        <div className="container">
          <div style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <p className="small-text" style={{ margin: 0, fontSize: '16px' }}>Phraze</p>
          </div>
          <h1>Advanced Features for LLM Development</h1>
          <p className="small-text" style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '16px' }}>Highlight, annotate, and organize text from any webpage or LLM conversation</p>
        </div>
      </section>

      {/* Sliding Rectangles Animation */}
      <SlidingRectangles />

      {/* Start Now Button */}
      <div style={{ 
        display: 'flex',
        justifyContent: 'center',
        margin: '40px 0'
      }}>
        <a href="#" className="small-text" style={{
          backgroundColor: 'rgb(240,240,240)',
          borderRadius: '18px',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          color: '#333',
          fontWeight: '500',
          transition: 'all 0.3s ease',
          margin: 0
        }}>
          Start now
          <span style={{ marginLeft: '8px' }}>↗</span>
        </a>
      </div>

      {/* Bento Grid Features Section */}
      <section style={{
        padding: '100px 0',
        maxWidth: '1400px',
        margin: '0 auto',
        paddingLeft: '20px',
        paddingRight: '20px',
        marginTop: '40px',
        marginBottom: '40px',
        opacity: showBentoGrid ? 1 : 0,
        transform: showBentoGrid ? 'translateY(0px)' : 'translateY(50px)',
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginTop: '60px'
        }}>
          {/* Top Left - Big Panel */}
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Grey Background Container (Project Stack) */}
              <div style={{
                background: 'rgb(247, 247, 247)',
                borderRadius: '16px',
                padding: '16px',
                margin: '0px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ width: '100%' }}>
                  <ProjectStack />
                </div>
              </div>
              
              {/* Text on White Card */}
              <div style={{
                marginTop: '16px'
              }}>
                {/* Header */}
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#1a1a1a',
                  marginBottom: '12px',
                  textAlign: 'center'
                }}>
                  Project Organization
                </h3>
                
                {/* Description */}
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  margin: '0',
                  textAlign: 'center'
                }}>
                  Organize conversations and annotations into separate projects.
                </p>
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  marginTop: '8px',
                  textAlign: 'center'
                }}>
                  Keep your workflow organized and efficient.
                </p>
              </div>
            </div>
          </div>

          {/* Top Right - Big Panel */}
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Grey Background Container */}
              <div style={{
                background: 'rgb(247, 247, 247)',
                borderRadius: '16px',
                padding: '16px',
                height: '359px',
                margin: '0px',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                  <AnnotationPanel />
                </div>
              </div>
              
              {/* Text on White Card */}
              <div style={{
                marginTop: '16px'
              }}>
                {/* Header */}
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#1a1a1a',
                  marginBottom: '12px',
                  textAlign: 'center'
                }}>
                  Annotation Hub
                </h3>
                
                {/* Description */}
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  margin: '0',
                  textAlign: 'center'
                }}>
                  Add labels, codes, voice notes, and notes to chat messages.
                </p>
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  marginTop: '8px',
                  textAlign: 'center'
                }}>
                  Enhance your conversations with rich annotations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* New Bento Boxes Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '24px',
          marginTop: '24px'
        }}>
          {/* Left - Large Bento Box */}
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Grey Background Container */}
              <div style={{
                background: 'rgb(247, 247, 247)',
                borderRadius: '16px',
                minHeight: '359px',
                margin: '0px',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center',
                overflow: 'visible',
                position: 'relative'
              }}>
                {/* Toast Notification - Inside Grey Visual Area */}
                {showToast && (
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#16a34a',
                    color: '#ffffff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
                    zIndex: 1000,
                    animation: 'fadeInOut 3s ease-in-out',
                    boxSizing: 'border-box',
                    whiteSpace: 'nowrap',
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {toastMessage}
                  </div>
                )}
                <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {/* Profile Avatars positioned on SVG */}
                  <div style={{
                    position: 'absolute',
                    top: '50px',
                    left: '-10%',
                    width: '120%',
                    height: '120%',
                    zIndex: 2,
                    pointerEvents: 'none'
                  }}>
                    {/* Priya Avatar */}
                    <div style={{
                      position: 'absolute',
                      top: '16%',
                      left: '76%',
                      transform: 'translate(-50%, -50%)'
                    }}>
                      <div style={{
                        position: 'relative',
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '3px solid #ffffff',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(16, 185, 129, 0.2)'
                      }}>
                        <img 
                          src="/priya.png" 
                          alt="Priya" 
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                      <div style={{
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: '#10b981',
                        border: '2px solid #ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}>
                      </div>
                    </div>
                    
                    {/* Alex Avatar */}
                    <div style={{
                      position: 'absolute',
                      top: '43%',
                      left: '85%',
                      transform: 'translate(-50%, -50%)'
                    }}>
                      <div style={{
                        position: 'relative',
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '3px solid #ffffff',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)'
                      }}>
                        <img 
                          src="/alex.png" 
                          alt="Alex" 
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                      <div style={{
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: '#10b981',
                        border: '2px solid #ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}>
                      </div>
                    </div>
                    
                    {/* Maya Avatar */}
                    <div style={{
                      position: 'absolute',
                      top: '45%',
                      left: '72%',
                      transform: 'translate(-50%, -50%)'
                    }}>
                      <div style={{
                        position: 'relative',
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '3px solid #ffffff',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 20px rgba(168, 85, 247, 0.4), 0 0 40px rgba(168, 85, 247, 0.2)'
                      }}>
                        <img 
                          src="/maya.png" 
                          alt="Maya" 
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                      <div style={{
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: '#10b981',
                        border: '2px solid #ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}>
                      </div>
                    </div>
                    
                    {/* Fourth Avatar - Below Maya */}
                    <div style={{
                      position: 'absolute',
                      top: '70%',
                      left: '78%',
                      transform: 'translate(-50%, -50%)'
                    }}>
                      <div style={{
                        position: 'relative',
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '3px solid #ffffff',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 20px rgba(245, 158, 11, 0.4), 0 0 40px rgba(245, 158, 11, 0.2)',
                        opacity: 0.7
                      }}>
                        <img 
                          src="/james.png" 
                          alt="James" 
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                      <div style={{
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: '#10b981',
                        border: '2px solid #ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}>
                      </div>
                    </div>
                  </div>
                  
                  {/* Text Bubble with Moving Dots above Priya */}
                  <div style={{
                    position: 'absolute',
                    top: '43px',
                    left: '-10%',
                    width: '120%',
                    height: '120%',
                    zIndex: 4,
                    pointerEvents: 'none'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '6%',
                      left: '76%',
                      transform: 'translateX(-50%)',
                      background: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '6px 10px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                      color: '#374151'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        <div style={{
                          width: '3px',
                          height: '3px',
                          borderRadius: '50%',
                          background: '#10b981',
                          animation: 'dotPulse 1.4s ease-in-out infinite'
                        }}></div>
                        <div style={{
                          width: '3px',
                          height: '3px',
                          borderRadius: '50%',
                          background: '#10b981',
                          animation: 'dotPulse 1.4s ease-in-out infinite',
                          animationDelay: '0.2s'
                        }}></div>
                        <div style={{
                          width: '3px',
                          height: '3px',
                          borderRadius: '50%',
                          background: '#10b981',
                          animation: 'dotPulse 1.4s ease-in-out infinite',
                          animationDelay: '0.4s'
                        }}></div>
                      </div>
                      {/* Bubble tail */}
                      <div style={{
                        position: 'absolute',
                        bottom: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '0',
                        height: '0',
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '6px solid #ffffff',
                        borderRadius: '0 0 2px 2px'
                      }}></div>
                    </div>
                  </div>

                  {/* Text Bubble with Moving Dots above Alex */}
                  <div style={{
                    position: 'absolute',
                    top: '43px',
                    left: '-10%',
                    width: '120%',
                    height: '120%',
                    zIndex: 4,
                    pointerEvents: 'none'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '33%',
                      left: '85%',
                      transform: 'translateX(-50%)',
                      background: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '6px 10px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                      color: '#374151'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        <div style={{
                          width: '3px',
                          height: '3px',
                          borderRadius: '50%',
                          background: '#10b981',
                          animation: 'dotPulse 1.4s ease-in-out infinite'
                        }}></div>
                        <div style={{
                          width: '3px',
                          height: '3px',
                          borderRadius: '50%',
                          background: '#10b981',
                          animation: 'dotPulse 1.4s ease-in-out infinite',
                          animationDelay: '0.2s'
                        }}></div>
                        <div style={{
                          width: '3px',
                          height: '3px',
                          borderRadius: '50%',
                          background: '#10b981',
                          animation: 'dotPulse 1.4s ease-in-out infinite',
                          animationDelay: '0.4s'
                        }}></div>
                      </div>
                      {/* Bubble tail */}
                      <div style={{
                        position: 'absolute',
                        bottom: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '0',
                        height: '0',
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '6px solid #ffffff',
                        borderRadius: '0 0 2px 2px'
                      }}></div>
                    </div>
                  </div>
                  
                  {/* Radial SVG Background */}
                  <svg 
                    width="100%" 
                    height="100%" 
                    viewBox="0 0 3117 1455" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                      position: 'absolute',
                      top: '50px',
                      left: '-10%',
                      width: '120%',
                      height: '120%',
                      zIndex: 0,
                      opacity: 0.6
                    }}
                  >
                    <path d="M3 620.49C3 620.49 893.9 6.22433 1551 3.01271C2215.64 -0.235762 3114 620.49 3114 620.49" stroke="url(#paint0_radial_107_70)" strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round"/>
                    <path d="M3 866.016C3 866.016 890.9 216.174 1548 213.027C2212.64 209.845 3114 866.016 3114 866.016" stroke="url(#paint1_radial_107_70)" strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round"/>
                    <path d="M3 1110.02C3 1110.02 885.762 463.159 1539.06 460.027C2199.85 456.859 3096 1110.02 3096 1110.02" stroke="#E1E1E1" strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round"/>
                    <path d="M114 1274.02C114 1274.02 930.833 710.753 1535.34 708.026C2146.78 705.267 2976 1274.02 2976 1274.02" stroke="#E1E1E1" strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round"/>
                    <path d="M285 1451.02C285 1451.02 1018.49 958.41 1561.33 956.024C2110.38 953.612 2855 1451.02 2855 1451.02" stroke="#E1E1E1" strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round"/>
                    <defs>
                      <radialGradient id="paint0_radial_107_70" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1558.5 287.272) scale(1555.5 333.256)">
                        <stop stopColor="#D1D1D1"/>
                        <stop offset="0.413462" stopColor="#E6E6E6"/>
                        <stop offset="1" stopColor="#DCDCDC"/>
                      </radialGradient>
                      <radialGradient id="paint1_radial_107_70" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1558.5 539.516) scale(1555.5 326.5)">
                        <stop stopColor="#F0F0F0"/>
                        <stop offset="0.317308" stopColor="#E6E6E6"/>
                        <stop offset="0.610577" stopColor="#DCDCDC"/>
                        <stop offset="0.975962" stopColor="#D2D2D2"/>
                      </radialGradient>
                    </defs>
                    </svg>

                   {/* Floating Resource Icons - Left Side */}
                   <div style={{
                     position: 'absolute',
                     top: '50px',
                     left: '-10%',
                     width: '120%',
                     height: '120%',
                     zIndex: 3,
                     pointerEvents: 'none'
                   }}>
                     {/* Chat Connected Card */}
                     <div style={{
                       position: 'absolute',
                       top: '18%',
                       left: '22%',
                       transform: 'translate(-50%, -50%)'
                     }}>
                       <div style={{
                         background: 'rgba(255, 255, 255, 0.35)',
                         backdropFilter: 'blur(9px)',
                         borderRadius: '16px',
                         padding: '8px 12px',
                         display: 'flex',
                         alignItems: 'center',
                         gap: '8px',
                         border: '1px solid rgba(107, 114, 128, 0.2)',
                         boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                         minWidth: '140px'
                       }}>
                         {/* Chat Icon */}
                         <div style={{
                           width: '24px',
                           height: '24px',
                           background: 'rgba(107, 114, 128, 0.1)',
                           borderRadius: '6px',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           flexShrink: 0
                         }}>
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
                             <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                           </svg>
                         </div>
                         
                         {/* Text */}
                         <div style={{
                           color: '#6b7280',
                           fontSize: '11px',
                           fontWeight: '500',
                           whiteSpace: 'nowrap'
                         }}>
                           5 shared chats
                         </div>
                       </div>
                     </div>

                     {/* Annotation Connected Card */}
                     <div style={{
                       position: 'absolute',
                       top: '37%',
                       left: '22%',
                       transform: 'translate(-50%, -50%)'
                     }}>
                       <div style={{
                         background: 'rgba(255, 255, 255, 0.35)',
                         backdropFilter: 'blur(9px)',
                         borderRadius: '16px',
                         padding: '8px 12px',
                         display: 'flex',
                         alignItems: 'center',
                         gap: '8px',
                         border: '1px solid rgba(107, 114, 128, 0.2)',
                         boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                         minWidth: '160px'
                       }}>
                         {/* Annotation Icon */}
                         <div style={{
                           width: '24px',
                           height: '24px',
                           background: 'rgba(107, 114, 128, 0.1)',
                           borderRadius: '6px',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           flexShrink: 0
                         }}>
                           <svg width="14" height="14" viewBox="0 0 256 256" fill="#6b7280">
                             <path d="M240 100.68a15.86 15.86 0 0 0-4.69-11.31l-68.68-68.69a16 16 0 0 0-22.63 0l-28.43 28.43l-58 21.77a16.06 16.06 0 0 0-10.22 12.35L24.11 222.68A8 8 0 0 0 32 232a8.4 8.4 0 0 0 1.32-.11l139.44-23.24a16 16 0 0 0 12.35-10.17l21.77-58L235.31 112a15.87 15.87 0 0 0 4.69-11.32Zm-69.87 92.19L55.32 212l47.37-47.37a28 28 0 1 0-11.32-11.32L44 200.7L63.13 85.86L118 65.29L190.7 138ZM104 140a12 12 0 1 1 12 12a12 12 0 0 1-12-12Zm96-15.32L131.31 56l24-24L224 100.68Z"/>
                           </svg>
                         </div>
                         
                         {/* Text */}
                         <div style={{
                           color: '#6b7280',
                           fontSize: '11px',
                           fontWeight: '500',
                           whiteSpace: 'nowrap'
                         }}>
                           12 shared annotations
                         </div>
                       </div>
                     </div>

                     {/* Contacts Connected Card */}
                     <div style={{
                       position: 'absolute',
                       top: '55%',
                       left: '22%',
                       transform: 'translate(-50%, -50%)'
                     }}>
                       <div style={{
                         background: 'rgba(255, 255, 255, 0.35)',
                         backdropFilter: 'blur(9px)',
                         borderRadius: '16px',
                         padding: '8px 12px',
                         display: 'flex',
                         alignItems: 'center',
                         gap: '8px',
                         border: '1px solid rgba(107, 114, 128, 0.2)',
                         boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                         minWidth: '150px'
                       }}>
                         {/* Contacts Icon */}
                         <div style={{
                           width: '24px',
                           height: '24px',
                           background: 'rgba(107, 114, 128, 0.1)',
                           borderRadius: '6px',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           flexShrink: 0
                         }}>
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
                             <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                             <circle cx="9" cy="7" r="4"/>
                             <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                             <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                           </svg>
                         </div>
                         
                         {/* Text */}
                         <div style={{
                           color: '#6b7280',
                           fontSize: '11px',
                           fontWeight: '500',
                           whiteSpace: 'nowrap'
                         }}>
                           8 shared contacts
                         </div>
                       </div>
                     </div>
                   </div>
                   
                   <div style={{
                     background: '#ffffff',
                    width: '280px',
                    overflow: 'hidden',
                    position: 'relative',
                    marginTop: '29px',
                    borderTop: '1px solid #e5e7eb',
                    borderLeft: '1px solid #e5e7eb',
                    borderRight: '1px solid #e5e7eb',
                    zIndex: 1
                  }}>
                    {/* Email Header */}
                    <div style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #e5e7eb',
                      color: '#6b7280',
                      fontSize: '13px',
                      fontWeight: '400'
                    }}>
                      hetpate384@gmail.com
                    </div>

                    {/* Menu Items */}
                    <div style={{ padding: '6px 0' }}>
                      {/* Account Settings */}
                      <button style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        padding: '10px 16px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '400',
                        color: '#1f2937',
                        textAlign: 'left',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'none';
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path>
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"></path>
                        </svg>
                        <span>Account Settings</span>
                      </button>

                      {/* Invite Account */}
                      <button style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        padding: '10px 16px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '400',
                        color: '#1f2937',
                        textAlign: 'left',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'none';
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        <span>Invite Account</span>
                      </button>
                    </div>

                    {/* Divider */}
                    <div style={{
                      height: '1px',
                      background: '#e5e7eb',
                      margin: '6px 0'
                    }} />

                    {/* Use Invite Code Section */}
                    <div style={{
                      padding: '12px 16px'
                    }}>
                      <div style={{
                        marginBottom: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Use Invite Code
                      </div>
                      <input
                        type="text"
                        placeholder={typingText || "Enter invite code"}
                        defaultValue=""
                        readOnly
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'border-color 0.15s ease',
                          boxSizing: 'border-box',
                          marginBottom: '8px'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#9ca3af';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                      />
                      <button style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgb(25, 25, 25)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#1f2937';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgb(25, 25, 25)';
                      }}>
                        Submit
                      </button>
                    </div>

                    {/* Divider */}
                    <div style={{
                      height: '1px',
                      background: '#e5e7eb',
                      margin: '6px 0'
                    }} />

                    {/* Log Out */}
                    <div style={{ padding: '6px 0' }}>
                      <button style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        padding: '10px 16px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '400',
                        color: '#1f2937',
                        textAlign: 'left',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'none';
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                          <polyline points="16 17 21 12 16 7"></polyline>
                          <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        <span>Log out</span>
                      </button>
                    </div>
                    
                    {/* Top Overlay Rectangle - covers only email header */}
                    <div style={{
                      position: 'absolute',
                      top: '0',
                      left: '0',
                      right: '0',
                      bottom: '250px',
                      background: '#ffffff',
                      opacity: 0.3,
                      pointerEvents: 'none',
                      zIndex: 1
                    }} />
                    
                    {/* White Overlay Rectangle - covers content after Submit button */}
                    <div style={{
                      position: 'absolute',
                      top: '260px',
                      left: '0',
                      right: '0',
                      bottom: '0',
                      background: '#ffffff',
                      opacity: 0.5,
                      pointerEvents: 'none',
                      zIndex: 1
                    }} />
                    
                    {/* Additional Overlay Rectangle - on top of Log out button for gradual fade */}
                    <div style={{
                      position: 'absolute',
                      top: '290px',
                      left: '0',
                      right: '0',
                      bottom: '0',
                      background: '#ffffff',
                      opacity: 0.2,
                      pointerEvents: 'none',
                      zIndex: 2
                    }} />
                    
                    {/* Bottom Card Overlay - covers entire card including border at bottom */}
                    <div style={{
                      position: 'absolute',
                      top: '0',
                      left: '-3px',
                      right: '-3px',
                      bottom: '-3px',
                      background: '#ffffff',
                      opacity: 0.18,
                      pointerEvents: 'none',
                      zIndex: 3,
                      borderRadius: '15px'
                    }} />
                  </div>

                </div>
              </div>
              
              {/* Text on White Card */}
              <div style={{
                marginTop: '16px',
                marginBottom: '0px'
              }}>
                {/* Header */}
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#1a1a1a',
                  marginBottom: '12px',
                  textAlign: 'center'
                }}>
                  Share & Invite
                </h3>
                
                {/* Description */}
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  margin: '0',
                  textAlign: 'center'
                }}>
                  Share specific chats and annotations with selected team members.
                </p>
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  marginTop: '8px',
                  textAlign: 'center'
                }}>
                  Create invite codes to dynamically share all chats, annotations, and contacts asynchronously.
                </p>
              </div>
            </div>
          </div>

          {/* Right - Small Bento Box */}
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Grey Background Container */}
              <div style={{
                background: 'rgb(247, 247, 247)',
                borderRadius: '16px',
                padding: '16px',
                height: '359px',
                margin: '0px',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                  {/* White box inside */}
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '10px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start'
                  }}>
                    {/* CONDITIONAL RENDERING: Contact List or Chat View */}
                    {!showChatView ? (
                      /* Contact List View */
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0px',
                        opacity: contactListOpacity,
                        transition: 'opacity 0.3s ease'
                      }}>
                        {/* Header */}
                        <div style={{
                          width: '100%',
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                          marginBottom: '0px'
                        }}>
                          <div style={{
                            fontSize: '14px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            fontWeight: '600',
                            color: '#1f2937'
                          }}>
                            Choose Contact
                          </div>
                        </div>
                        
                        {/* Contact List */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0px',
                          width: '100%',
                          padding: '0 4px'
                        }}>
                          {/* Contact: Alex */}
                          <button 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px',
                              border: 'none',
                              background: clickedContact === 'Alex' ? '#f5f5f5' : '#ffffff',
                              borderTop: 'solid 1px #F7F7F8',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                              width: '100%',
                              borderRadius: '8px',
                              boxSizing: 'border-box'
                            }}
                          >
                            <img 
                              src="/alex.png" 
                              alt="Alex"
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                objectFit: 'cover'
                              }}
                            />
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              flex: 1,
                              minWidth: 0
                            }}>
                              <div style={{
                                fontWeight: '500',
                                fontSize: '14px',
                                color: '#1f2937',
                                marginBottom: '4px'
                              }}>
                                Alex
                              </div>
                              <div style={{
                                fontSize: '13px',
                                color: '#6b7280',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '100%'
                              }}>
                                Check out this highlight I found:
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#9ca3af',
                              whiteSpace: 'nowrap'
                            }}>
                              10:27 AM
                            </div>
                          </button>
                          
                          {/* Contact: Priya */}
                          <button 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px',
                              border: 'none',
                              background: '#ffffff',
                              borderTop: 'solid 1px #F7F7F8',
                              cursor: 'pointer',
                              transition: 'background 0.2s, filter 0.3s',
                              width: '100%',
                              borderRadius: '8px',
                              boxSizing: 'border-box',
                              filter: clickedContact === 'Alex' ? 'blur(2px)' : 'none'
                            }}
                          >
                            <img 
                              src="/priya.png" 
                              alt="Priya"
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                objectFit: 'cover'
                              }}
                            />
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              flex: 1,
                              minWidth: 0
                            }}>
                              <div style={{
                                fontWeight: '500',
                                fontSize: '14px',
                                color: '#1f2937',
                                marginBottom: '4px'
                              }}>
                                Priya
                              </div>
                              <div style={{
                                fontSize: '13px',
                                color: '#6b7280',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '100%'
                              }}>
                                That's a great find! The parallel processing...
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#9ca3af',
                              whiteSpace: 'nowrap'
                            }}>
                              10:28 AM
                            </div>
                          </button>
                          
                          {/* Contact: Maya */}
                          <button 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px',
                              border: 'none',
                              background: '#ffffff',
                              borderTop: 'solid 1px #F7F7F8',
                              cursor: 'pointer',
                              transition: 'background 0.2s, filter 0.3s',
                              width: '100%',
                              borderRadius: '8px',
                              boxSizing: 'border-box',
                              filter: clickedContact === 'Alex' ? 'blur(2px)' : 'none'
                            }}
                          >
                            <img 
                              src="/maya.png" 
                              alt="Maya"
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                objectFit: 'cover'
                              }}
                            />
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              flex: 1,
                              minWidth: 0
                            }}>
                              <div style={{
                                fontWeight: '500',
                                fontSize: '14px',
                                color: '#1f2937',
                                marginBottom: '4px'
                              }}>
                                Maya
                              </div>
                              <div style={{
                                fontSize: '13px',
                                color: '#6b7280',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '100%'
                              }}>
                                Have you reviewed the latest changes?
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#9ca3af',
                              whiteSpace: 'nowrap'
                            }}>
                              10:15 AM
                            </div>
                          </button>
                          
                          {/* Contact: James */}
                          <button 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px',
                              border: 'none',
                              background: '#ffffff',
                              borderTop: 'solid 1px #F7F7F8',
                              cursor: 'pointer',
                              transition: 'background 0.2s, filter 0.3s',
                              width: '100%',
                              borderRadius: '8px',
                              boxSizing: 'border-box',
                              filter: clickedContact === 'Alex' ? 'blur(2px)' : 'none'
                            }}
                          >
                            <img 
                              src="/james.png" 
                              alt="James"
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                objectFit: 'cover'
                              }}
                            />
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              flex: 1,
                              minWidth: 0
                            }}>
                              <div style={{
                                fontWeight: '500',
                                fontSize: '14px',
                                color: '#1f2937',
                                marginBottom: '4px'
                              }}>
                                James
                              </div>
                              <div style={{
                                fontSize: '13px',
                                color: '#6b7280',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '100%'
                              }}>
                                Great progress on the project!
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#9ca3af',
                              whiteSpace: 'nowrap'
                            }}>
                              9:45 AM
                            </div>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Chat View (Existing) */
                      <div style={{
                        width: '100%',
                        height: '100%'
                      }}>
                        {/* Top Section: Back Button and Current Topic */}
                        <div style={{
                        display: 'flex',
                        alignItems: 'center',
                          gap: '8px',
                          width: '100%'
                        }}>
                          {/* Back Button - No background */}
                          <button id="messages-back" className="back-button" style={{ marginTop: '0px', background: 'transparent', border: 'none', padding: '0' }}>
                            <i className="fa-solid fa-angle-left"></i>
                          </button>
                          
                          {/* Current Topic Text */}
                          <div style={{
                            fontSize: '14px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <span style={{ color: '#6b7280' }}>Current Topic:</span>
                            <span style={{ color: '#1f2937', fontWeight: '600', marginLeft: '4px' }}>machine learning</span>
                          </div>
                        </div>
                        
                        {/* Underneath Section: Profile Picture and Name */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                            alignItems: 'center',
                          gap: '4px',
                          marginTop: '12px',
                          width: '100%'
                        }}>
                          {/* Profile Picture */}
                          <img 
                            src="alex.png" 
                            alt="Profile"
                            className="contact-avatar"
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              border: '2px solid transparent',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                          />
                          {/* Name */}
                          <span className="comment-header" style={{
                            color: '#000000',
                            fontWeight: '600',
                            fontSize: '14px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                          }}>Alex</span>
                        </div>
                        
                        {/* Sample Conversation */}
                        <div ref={chatScrollRef} style={{
                          width: '100%',
                          marginTop: '16px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          padding: '0 4px'
                        }}>
                      {/* Message from Alex */}
                      <div style={{
                        marginBottom: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end'
                      }}>
                        <div style={{
                          marginBottom: '4px',
                          fontSize: '13px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>
                          <span style={{
                            fontWeight: '600',
                            color: '#1f2937',
                            marginRight: '6px'
                          }}>Alex</span>
                          <span style={{
                            fontSize: '12px',
                            color: '#6b7280'
                          }}>10:23 AM</span>
                        </div>
                          <div style={{
                            fontSize: '14px',
                            backgroundColor: '#eff6ff',
                            color: '#111827',
                            lineHeight: '1.5',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            textAlign: 'left',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            display: 'inline-block',
                            maxWidth: '80%'
                          }}>
                            Have you seen the latest transformer architecture improvements?
                          </div>
                      </div>
                      
                      {/* Message from Priya */}
                      <div style={{
                        marginBottom: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start'
                      }}>
                        <div style={{
                          marginBottom: '4px',
                          fontSize: '13px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>
                          <span style={{
                            fontWeight: '600',
                            color: '#1f2937',
                            marginRight: '6px'
                          }}>Priya</span>
                          <span style={{
                            fontSize: '12px',
                            color: '#6b7280'
                          }}>10:25 AM</span>
                        </div>
                          <div style={{
                            fontSize: '14px',
                            backgroundColor: '#f3f4f6',
                            color: '#111827',
                            lineHeight: '1.5',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            display: 'inline-block',
                            maxWidth: '80%'
                          }}>
                            Yes! The attention mechanism optimizations are fascinating
                          </div>
                      </div>
                      
                      {/* Message from Alex with Attached Highlight */}
                      <div style={{
                        marginBottom: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end'
                      }}>
                        <div style={{
                          marginBottom: '4px',
                          fontSize: '13px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>
                          <span style={{
                            fontWeight: '600',
                            color: '#1f2937',
                            marginRight: '6px'
                          }}>Alex</span>
                          <span style={{
                            fontSize: '12px',
                            color: '#6b7280'
                          }}>10:27 AM</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '100%' }}>
                          <div style={{
                            fontSize: '14px',
                            backgroundColor: '#eff6ff',
                            color: '#111827',
                            lineHeight: '1.5',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            marginBottom: '8px',
                            textAlign: 'left',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            display: 'inline-block',
                            maxWidth: '80%'
                          }}>
                            Check out this highlight I found:
                          </div>
                          {/* Attached Highlight */}
                          <div style={{
                            background: '#f7f7f8',
                            border: '1px solid #e5e7eb',
                            borderLeft: '3px solid #6b7280',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            margin: '8px 0',
                            fontSize: '14px',
                            lineHeight: '1.4',
                            color: '#374151',
                            textAlign: 'left',
                            display: 'block',
                            width: '100%',
                            userSelect: 'text',
                            WebkitUserSelect: 'text',
                            MozUserSelect: 'text',
                            msUserSelect: 'text',
                            position: 'relative'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '6px'
                            }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#6b7280', flexShrink: '0' }}>
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path>
                              </svg>
                              <span style={{
                                fontSize: '12px',
                                color: '#6b7280',
                                fontWeight: '500'
                              }}>Attached highlight</span>
                            </div>
                            <div style={{
                              fontStyle: 'italic',
                              pointerEvents: 'none',
                              margin: '0',
                              color: '#6b7280',
                              paddingLeft: '22px'
                            }}>
                              "The transformer model achieves state-of-the-art performance by using self-attention mechanisms to process entire sequences simultaneously"
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Message from Priya */}
                      <div style={{
                        marginBottom: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start'
                      }}>
                        <div style={{
                          marginBottom: '4px',
                          fontSize: '13px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>
                          <span style={{
                            fontWeight: '600',
                            color: '#1f2937',
                            marginRight: '6px'
                          }}>Priya</span>
                          <span style={{
                            fontSize: '12px',
                            color: '#6b7280'
                          }}>10:28 AM</span>
                        </div>
                          <div style={{
                            fontSize: '14px',
                            backgroundColor: '#f3f4f6',
                            color: '#111827',
                            lineHeight: '1.5',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            display: 'inline-block',
                            maxWidth: '80%'
                          }}>
                            That's a great find! The parallel processing advantage is huge
                          </div>
                      </div>
                    </div>
                    </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Text on White Card */}
              <div style={{
                marginTop: '16px'
              }}>
                {/* Header */}
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#1a1a1a',
                  marginBottom: '12px',
                  textAlign: 'center'
                }}>
                  Collaborative Chat
                </h3>
                
                {/* Description */}
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  margin: '0',
                  textAlign: 'center'
                }}>
                  Link annotations directly from your chat.
                </p>
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  marginTop: '8px',
                  textAlign: 'center'
                }}>
                  Share insights with real-time messages.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row - 2 Big Panels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginTop: '24px'
        }}>
          {/* Middle Left - Big Panel */}
          <div style={{
            background: 'rgb(255, 255, 255)',
            borderRadius: '24px',
            padding: '12px',
            boxShadow: 'rgba(0, 0, 0, 0.08) 0px 4px 20px',
            border: '1px solid rgb(241, 245, 249)'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}>
              {/* Grey Background Container (fixed height, scroll like Annotation Hub) */}
              <div style={{
                background: 'rgb(247, 247, 247)',
                borderRadius: '16px',
                padding: '16px',
                height: '359px',
                margin: '0px',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative'
              }}>
                {/* Export Modal */}
                {showExportModal && (
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(8px)',
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
                          background: '#ffffff',
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
                          background: '#f3f4f6',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          color: '#374151',
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
                
                {/* Export Success Toast */}
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

                {/* Import Modal */}
                {showImportModal && (
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(8px)',
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
                      {/* Title Bar */}
                      <div style={{
                        height: '32px',
                        background: '#f8f9fa',
                        borderBottom: '1px solid #e5e7eb',
                        borderRadius: '8px 8px 0 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f57' }}></div>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }}></div>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#28ca42' }}></div>
                        </div>
                        <h3 style={{
                          margin: '0',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#111827',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>
                          Select File to Import
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

                      {/* macOS Toolbar */}
                      <div style={{
                        background: '#f6f6f6',
                        borderBottom: '1px solid #d0d0d0',
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          {/* Navigation Buttons */}
                          <div style={{
                            display: 'flex',
                            gap: '4px'
                          }}>
                            <button style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              border: '1px solid #d0d0d0',
                              background: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'background 0.1s ease'
                            }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M15 18l-6-6 6-6"/>
                              </svg>
                            </button>
                            <button style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              border: '1px solid #d0d0d0',
                              background: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'background 0.1s ease'
                            }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 18l6-6-6-6"/>
                              </svg>
                            </button>
                          </div>
                          
                          {/* Breadcrumb */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            color: '#6e6e6e',
                            marginLeft: '48px'
                          }}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.7 }}>
                              <path d="M1.5 2A1.5 1.5 0 000 3.5v9A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0014.5 4H7.914a1.5 1.5 0 01-1.06-.44L5.5 2.207A1.5 1.5 0 004.44 1.5H1.5z"/>
                            </svg>
                            <span>Documents</span>
                            <span style={{ color: '#b0b0b0', margin: '0 2px' }}>›</span>
                            <span>ML Projects</span>
                            <span style={{ color: '#b0b0b0', margin: '0 2px' }}>›</span>
                            <span>Annotations</span>
                          </div>
                        </div>
                        
                        {/* View Options */}
                        <div style={{
                          display: 'flex',
                          gap: '4px'
                        }}>
                          <button style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            background: '#d8d8d8',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'background 0.1s ease'
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="3" y="3" width="7" height="7" rx="1"/>
                              <rect x="14" y="3" width="7" height="7" rx="1"/>
                              <rect x="3" y="14" width="7" height="7" rx="1"/>
                              <rect x="14" y="14" width="7" height="7" rx="1"/>
                            </svg>
                          </button>
                          <button style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            background: '#ffffff',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'background 0.1s ease'
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="3" y="5" width="18" height="2" rx="1"/>
                              <rect x="3" y="11" width="18" height="2" rx="1"/>
                              <rect x="3" y="17" width="18" height="2" rx="1"/>
                            </svg>
                          </button>
                          <button style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            background: '#ffffff',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'background 0.1s ease'
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="3" y="3" width="5" height="18" rx="1"/>
                              <rect x="10" y="3" width="5" height="18" rx="1"/>
                              <rect x="17" y="3" width="4" height="18" rx="1"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* macOS File Grid */}
                      <div style={{ 
                        padding: '16px',
                        background: '#ffffff',
                        height: '165px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '12px',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        {[
                          { name: 'testing.json', size: '1.2 MB', preview: '{\n "id": 1,\n "name": "test"\n "data": []\n}' },
                          { name: 'annotations.json', size: '856 KB', preview: '{\n "annotations"\n  "version": 2\n  "labels": [\n   "cat",\n}' },
                          { name: 'concepts.json', size: '624 KB', preview: '{\n "concepts":\n  "items": [\n   "ml",\n   "ai"\n}' },
                          { name: 'models.json', size: '2.1 MB', preview: '{\n "models": [\n  "resnet50",\n  "bert"\n ]\n}' },
                          { name: 'datasets.json', size: '945 KB', preview: '{\n "datasets":\n  "train": 1000,\n  "test": 200\n}' },
                          { name: 'config.json', size: '312 KB', preview: '{\n "config":\n  "epochs": 100,\n  "lr": 0.001\n}' }
                        ].map((file, index) => (
                          <div
                            key={file.name}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              cursor: index < 3 ? 'pointer' : 'default',
                              padding: '4px 4px 2px 4px',
                              borderRadius: '6px',
                              transition: 'background 0.08s ease',
                              background: selectedFile === file.name ? '#f3f4f6' : 'transparent',
                              opacity: index >= 3 ? 0.6 : 1,
                              transform: index >= 3 ? 'translateY(-10px)' : 'translateY(0)',
                              pointerEvents: index >= 3 ? 'none' : 'auto'
                            }}
                          >
                            {/* macOS File Icon */}
                            <div style={{
                              width: '40px',
                              height: '48px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: '4px'
                            }}>
                              <div style={{
                                width: '40px',
                                height: '48px',
                                background: 'white',
                                border: '1px solid #c8c8c8',
                                borderRadius: '2px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                fontSize: '7px',
                                color: '#666',
                                fontWeight: '600',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                position: 'relative',
                                paddingBottom: '4px',
                                overflow: 'hidden'
                              }}>
                                {/* JSON Preview */}
                                <div style={{
                                  position: 'absolute',
                                  top: '2px',
                                  left: '3px',
                                  right: '3px',
                                  fontSize: '4px',
                                  lineHeight: '5px',
                                  color: '#888',
                                  fontFamily: 'Courier New, monospace',
                                  fontWeight: '400',
                                  textAlign: 'left',
                                  whiteSpace: 'pre'
                                }}>
                                  {file.preview}
                                </div>
                                {/* File Type Label */}
                                <span style={{
                                  position: 'relative',
                                  zIndex: 1,
                                  background: 'white',
                                  padding: '2px 6px',
                                  borderRadius: '2px'
                                }}>
                                  JSON
                                </span>
                                {/* Folded Corner */}
                                <div style={{
                                  position: 'absolute',
                                  top: '-1px',
                                  right: '-1px',
                                  width: '0',
                                  height: '0',
                                  borderStyle: 'solid',
                                  borderWidth: '0 8px 8px 0',
                                  borderColor: 'transparent #e8e8e8 transparent transparent',
                                  borderTopRightRadius: '2px',
                                  zIndex: 2
                                }}></div>
                              </div>
                            </div>
                            
                            {/* Filename */}
                            <div style={{
                              fontSize: '12px',
                              color: selectedFile === file.name ? '#374151' : '#000000',
                              textAlign: 'center',
                              marginBottom: '2px',
                              fontWeight: selectedFile === file.name ? '500' : '400',
                              wordBreak: 'break-word'
                            }}>
                              {file.name}
                            </div>
                            
                            {/* File Size */}
                            <div style={{
                              fontSize: '10px',
                              color: selectedFile === file.name ? '#6b7280' : '#86868b',
                              textAlign: 'center'
                            }}>
                              {file.size}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div style={{
                        background: '#f8f9fa',
                        borderTop: '1px solid #e5e7eb',
                        padding: '8px 12px',
                        borderRadius: '0 0 8px 8px',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '6px'
                      }}>
                        <button style={{
                          padding: '4px 10px',
                          background: '#ffffff',
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
                          background: selectedFile ? '#f3f4f6' : '#f3f4f6',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          color: selectedFile ? '#374151' : '#9ca3af',
                          cursor: selectedFile ? 'pointer' : 'not-allowed',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          transition: 'all 0.15s ease'
                        }}>
                          {isImporting ? 'Importing...' : 'Import'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Import Success Toast */}
                {showImportToast && (
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
                      47 annotations imported successfully!
                    </span>
                  </div>
                )}

                {/* AI Chat Simulation with Annotation History Data */}
                {showAIChat && (
                  <div style={{
                    position: 'absolute',
                    inset: '0px',
                    background: 'rgb(247, 247, 247)',
                    borderRadius: '16px',
                    padding: '25px',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 1000
                  }}>
                    <div style={{
                      width: '100%',
                      height: '100%',
                      background: 'rgb(255, 255, 255)',
                      border: '1px solid rgb(229, 231, 235)',
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden'
                    }}>
                      {/* Chat Demo Header Bar */}
                      <div style={{
                        background: '#f8f9fa',
                        borderBottom: '1px solid #e5e7eb',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f57' }}></div>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }}></div>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#28ca42' }}></div>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontFamily: '"Inter", "Inter Fallback", sans-serif',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151'
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                          </svg>
                          Team Discussion
                        </div>
                        <div style={{ width: '40px' }}></div>
                      </div>

                      {/* Chat Messages - Using exact annotation history data */}
                      <div style={{
                        flex: 1,
                        padding: '16px',
                        paddingBottom: '0',
                        marginBottom: '0',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        scrollBehavior: 'auto'
                      }}>
                        {/* User Message */}
                        <div style={{ padding: '0 1rem', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'flex-end', position: 'relative', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: '0' }}>
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
                            <div style={{ padding: '1rem', background: '#ffffff', borderRadius: '2rem', borderBottomRightRadius: '5px', color: '#0A0A0A', display: 'inline-block', width: '100%', position: 'relative', marginTop: '4px' }}>
                              <div style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                Can you explain the key concepts in <span 
                                  className="PhrazeHighlight has-annotations" 
                                  data-label="Technology" 
                                  data-label-type="AI, Data Science"
                                  data-user="Alex Kim"
                                  data-highlight-id="demo-1"
                                >machine learning</span>?
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* AI Messages - Using exact annotation history selected text */}
                        <div style={{ padding: '0', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'flex-start', position: 'relative', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: '0' }}>
                            <div style={{ fontSize: '0.8rem', marginBottom: '8px', fontWeight: '500', color: '#555', textAlign: 'left', paddingRight: '0rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-start' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '600', color: 'white', border: '1px solid #475569' }}>
                                P
                              </div>
                              <span>phraze</span>
                            </div>
                            <div style={{ padding: '0rem', background: 'transparent', borderRadius: '0.5rem', color: '#0A0A0A', display: 'inline-block', width: '100%', position: 'relative', marginTop: '4px' }}>
                              <div style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'normal' }}>
                                Machine learning involves several key concepts. First, <span 
                                  className="PhrazeHighlight has-annotations" 
                                  data-label="Algorithm" 
                                  data-label-type="Neural Network, Supervised"
                                  data-user="Phraze"
                                  data-position="above"
                                  data-highlight-id="demo-2"
                                  style={{
                                    background: highlightedText === 'convolutional neural networks' ? '#fef3c7' : 'transparent'
                                  }}
                                >convolutional neural networks</span> are the core methods used to train models. These algorithms learn patterns from data to make predictions or decisions.
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ padding: '0', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'flex-start', position: 'relative', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: '0' }}>
                            <div style={{ fontSize: '0.8rem', marginBottom: '8px', fontWeight: '500', color: '#555', textAlign: 'left', paddingRight: '0rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-start' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '600', color: 'white', border: '1px solid #475569' }}>
                                P
                              </div>
                              <span>phraze</span>
                            </div>
                            <div style={{ padding: '0rem', background: 'transparent', borderRadius: '0.5rem', color: '#0A0A0A', display: 'inline-block', width: '100%', position: 'relative', marginTop: '4px' }}>
                              <div style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'normal' }}>
                                Another crucial aspect is <span 
                                  className="PhrazeHighlight has-annotations" 
                                  data-label="Training Method" 
                                  data-label-type="Gradient Descent"
                                  data-user="Phraze"
                                  data-position="above"
                                  data-highlight-id="demo-3"
                                  style={{
                                    background: highlightedText === 'backpropagation optimizes weights' ? '#fef3c7' : 'transparent'
                                  }}
                                >backpropagation optimizes weights</span>. This involves cleaning, transforming, and preparing your data before feeding it into the model. Quality data preprocessing often determines the success of your ML project.
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ padding: '0', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'flex-start', position: 'relative', marginBottom: '2rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', paddingLeft: '0' }}>
                            <div style={{ fontSize: '0.8rem', marginBottom: '8px', fontWeight: '500', color: '#555', textAlign: 'left', paddingRight: '0rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-start' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '600', color: 'white', border: '1px solid #475569' }}>
                                P
                              </div>
                              <span>phraze</span>
                            </div>
                            <div style={{ padding: '0rem', background: 'transparent', borderRadius: '0.5rem', color: '#0A0A0A', display: 'inline-block', width: '100%', position: 'relative', marginTop: '4px' }}>
                              <div style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'normal' }}>
                                Finally, <span 
                                  className="PhrazeHighlight has-annotations" 
                                  data-label="Methodology" 
                                  data-label-type="Feature Selection, Engineering"
                                  data-user="Phraze"
                                  data-position="above"
                                  data-highlight-id="demo-4"
                                  style={{
                                    background: highlightedText === 'feature engineering techniques' ? '#fef3c7' : 'transparent'
                                  }}
                                >feature engineering techniques</span> help you create meaningful input variables that improve model performance. This includes selecting relevant features, creating new ones, and removing noise from your dataset.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Chat Input */}
                      <div style={{
                        paddingTop: '0.15rem',
                        padding: '0.15rem 1.5rem 1.5rem 1.5rem',
                        marginTop: '0',
                        background: 'transparent'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          border: '1px solid rgba(0,0,0,0.15)',
                          borderRadius: '12px',
                          background: '#fff',
                          width: '100%',
                          maxWidth: '850px',
                          margin: '0 auto'
                        }}>
                          <button type="button" style={{
                            background: 'none',
                            border: 'none',
                            padding: '0.75rem 1rem',
                            color: '#6b7280',
                            cursor: 'default'
                          }} disabled>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                              <circle cx="8.5" cy="8.5" r="1.5"></circle>
                              <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                          </button>
                          <textarea rows="1" style={{
                            flex: 1,
                            padding: '0.9rem 0.5rem',
                            border: 'none',
                            resize: 'none',
                            outline: 'none',
                            background: '#fff',
                            fontSize: '14px',
                            fontFamily: '"Inter", "Inter Fallback", sans-serif'
                          }} placeholder="Write a message..." disabled></textarea>
                          <button type="button" style={{
                            background: 'none',
                            border: 'none',
                            padding: '0.75rem 1rem',
                            cursor: 'not-allowed',
                            opacity: 0.5
                          }} disabled>
                            <svg viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" style={{ width: '20px', height: '20px', transform: 'rotate(90deg)' }}>
                              <path d="M12 19V5M5 12l7-7 7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Imported Annotations List */}
            {showAnnotationHistory && (
              <div style={{
                position: 'absolute',
                inset: '0px',
                background: 'rgb(247, 247, 247)',
                borderRadius: '16px',
                padding: '25px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1000
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: 'rgb(255, 255, 255)',
                  border: '1px solid rgb(229, 231, 235)',
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                      <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid rgb(229, 231, 235)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'rgb(255, 255, 255)'
                      }}>
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: '2px solid rgb(209, 213, 219)',
                          background: 'rgb(255, 255, 255)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: 'rgb(55, 65, 81)',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>
                          Select All
                        </span>
                      </div>
                      <div style={{
                        flex: '1 1 0%',
                        overflowY: 'hidden',
                        padding: '16px',
                        pointerEvents: 'none',
                        scrollbarWidth: 'none'
                      }}>
                        <div style={{
                          padding: '12px 20px',
                          borderBottom: '1px solid rgb(229, 231, 235)',
                          background: 'rgb(248, 249, 250)',
                          display: 'flex',
                          gap: '14px'
                        }}>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            marginTop: '2px',
                            borderRadius: '4px',
                            border: '2px solid rgb(209, 213, 219)',
                            background: 'rgb(255, 255, 255)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <div style={{ flex: '1 1 0%', minWidth: '0px' }}>
                             <div style={{
                               fontSize: '13px',
                               color: 'rgb(107, 114, 128)',
                               fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                               marginBottom: '6px'
                             }}>
                               <span style={{ fontWeight: '600' }}>Selected Text:</span> <span style={{ color: 'rgb(55, 65, 81)', fontStyle: 'italic' }}>machine learning algorithms</span>
                             </div>
                             <div style={{
                               fontSize: '13px',
                               color: 'rgb(107, 114, 128)',
                               fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                               marginBottom: '6px'
                             }}>
                               <span style={{ fontWeight: '600' }}>Label:</span> <span style={{ color: 'rgb(55, 65, 81)' }}>Technology</span>
                             </div>
                             <div style={{
                               fontSize: '13px',
                               color: 'rgb(107, 114, 128)',
                               fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                               display: 'flex',
                               alignItems: 'center',
                               gap: '6px',
                               flexWrap: 'wrap'
                             }}>
                               <span style={{ fontWeight: '600' }}>Label Type(s):</span>
                               <span style={{ color: 'rgb(55, 65, 81)' }}>AI, Data Science</span>
                             </div>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            flexShrink: 0
                          }}>
                            <div style={{
                              display: 'flex',
                              gap: '4px',
                              alignItems: 'center'
                            }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                background: 'rgb(243, 244, 246)',
                                transition: 'background 0.2s',
                                position: 'relative'
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                  <path d="M15 5l3 3" />
                                </svg>
                              </div>
                               <div style={{
                                 width: '32px',
                                 height: '32px',
                                 display: 'flex',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 borderRadius: '6px',
                                 background: 'rgb(243, 244, 246)',
                                 transition: 'background 0.2s'
                               }}>
                                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                   <circle cx="12" cy="12" r="10" />
                                   <line x1="12" y1="16" x2="12" y2="12" />
                                   <line x1="12" y1="8" x2="12.01" y2="8" />
                                 </svg>
                               </div>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                background: 'rgb(254, 242, 242)',
                                transition: 'background 0.2s',
                                position: 'relative'
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </div>
                            </div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: 'rgb(156, 163, 175)',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              minWidth: '20px',
                              textAlign: 'right',
                              paddingTop: '6px'
                            }}>
                              1
                            </div>
                          </div>
                        </div>
                        <div style={{
                          padding: '12px 20px',
                          borderBottom: '1px solid rgb(229, 231, 235)',
                          background: 'rgb(255, 255, 255)',
                          display: 'flex',
                          gap: '14px'
                        }}>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            marginTop: '2px',
                            borderRadius: '4px',
                            border: '2px solid rgb(209, 213, 219)',
                            background: 'rgb(255, 255, 255)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <div style={{ flex: '1 1 0%', minWidth: '0px' }}>
                             <div style={{
                               fontSize: '13px',
                               color: 'rgb(107, 114, 128)',
                               fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                               marginBottom: '6px'
                             }}>
                               <span style={{ fontWeight: '600' }}>Selected Text:</span> <span style={{ color: 'rgb(55, 65, 81)', fontStyle: 'italic' }}>data preprocessing pipeline</span>
                             </div>
                             <div style={{
                               fontSize: '13px',
                               color: 'rgb(107, 114, 128)',
                               fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                               marginBottom: '6px'
                             }}>
                               <span style={{ fontWeight: '600' }}>Label:</span> <span style={{ color: 'rgb(55, 65, 81)' }}>Process</span>
                             </div>
                             <div style={{
                               fontSize: '13px',
                               color: 'rgb(107, 114, 128)',
                               fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                               display: 'flex',
                               alignItems: 'center',
                               gap: '6px',
                               flexWrap: 'wrap'
                             }}>
                               <span style={{ fontWeight: '600' }}>Label Type(s):</span>
                               <span style={{ color: 'rgb(55, 65, 81)' }}>ETL, Data Engineering</span>
                             </div>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            flexShrink: 0
                          }}>
                            <div style={{
                              display: 'flex',
                              gap: '4px',
                              alignItems: 'center'
                            }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                background: 'rgb(243, 244, 246)',
                                transition: 'background 0.2s',
                                position: 'relative'
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                  <path d="M15 5l3 3" />
                                </svg>
                              </div>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                background: 'rgb(243, 244, 246)',
                                transition: 'background 0.2s',
                                position: 'relative'
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="16" x2="12" y2="12" />
                                  <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                              </div>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                background: 'rgb(254, 242, 242)',
                                transition: 'background 0.2s',
                                position: 'relative'
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </div>
                            </div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: 'rgb(156, 163, 175)',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              minWidth: '20px',
                              textAlign: 'right',
                              paddingTop: '6px'
                            }}>
                              2
                            </div>
                          </div>
                        </div>
                        <div style={{
                          padding: '12px 20px',
                          background: 'rgba(248, 249, 250, 0.12)',
                          backdropFilter: 'blur(35px)',
                          border: '1px solid rgba(255, 255, 255, 0.5)',
                          display: 'flex',
                          gap: '14px',
                          opacity: 0.35
                        }}>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            marginTop: '2px',
                            borderRadius: '4px',
                            border: '2px solid rgb(209, 213, 219)',
                            background: 'rgb(248, 249, 250)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <div style={{ flex: '1 1 0%', minWidth: '0px' }}>
                             <div style={{
                               fontSize: '13px',
                               color: 'rgb(107, 114, 128)',
                               fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                               marginBottom: '6px'
                             }}>
                               <span style={{ fontWeight: '600' }}>Selected Text:</span> <span style={{ color: 'rgb(55, 65, 81)', fontStyle: 'italic' }}>feature engineering techniques</span>
                             </div>
                             <div style={{
                               fontSize: '13px',
                               color: 'rgb(107, 114, 128)',
                               fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                               marginBottom: '6px'
                             }}>
                               <span style={{ fontWeight: '600' }}>Label:</span> <span style={{ color: 'rgb(55, 65, 81)' }}>Methodology</span>
                             </div>
                             <div style={{
                               fontSize: '13px',
                               color: 'rgb(107, 114, 128)',
                               fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                               display: 'flex',
                               alignItems: 'center',
                               gap: '6px',
                               flexWrap: 'wrap'
                             }}>
                               <span style={{ fontWeight: '600' }}>Label Type(s):</span>
                               <span style={{ color: 'rgb(55, 65, 81)' }}>Feature Selection, Engineering</span>
                             </div>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            flexShrink: 0
                          }}>
                            <div style={{
                              display: 'flex',
                              gap: '4px',
                              alignItems: 'center'
                            }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                background: 'rgb(243, 244, 246)',
                                transition: 'background 0.2s'
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                  <path d="M15 5l3 3" />
                                </svg>
                              </div>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                background: 'rgb(243, 244, 246)'
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="16" x2="12" y2="12" />
                                  <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                              </div>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                background: 'rgb(254, 242, 242)'
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </div>
                            </div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: 'rgb(156, 163, 175)',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              minWidth: '20px',
                              textAlign: 'right',
                              paddingTop: '6px'
                            }}>
                              3
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                <div style={{
                    width: '100%',
                    background: 'transparent',
                  display: 'flex',
                    alignItems: 'stretch',
                  justifyContent: 'center',
                    padding: '10px',
                    pointerEvents: 'none',
                    margin: '0 auto',
                  height: '100%'
                }}>
                    <div style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      padding: '16px',
                      paddingTop: '30px',
                      pointerEvents: 'none',
                      overflowY: 'auto',
                      height: '100%',
                      scrollbarWidth: 'none', // Firefox
                      msOverflowStyle: 'none', // IE/Edge
                      WebkitScrollbar: { display: 'none' } // Webkit browsers
                    }}
                    ref={scrollRef}>
                      {/* Header */}
                      
                      <p style={{
                        margin: 0,
                        marginBottom: '16px',
                        fontSize: '12px',
                        color: '#71717a',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        lineHeight: '1.5'
                      }}>
                        Export your annotations to a file for backup or sharing, or import previously exported annotation data.
                      </p>

                      {/* Action Buttons */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px',
                        marginBottom: '20px'
                      }}>
                        <div style={{
                          padding: '12px 16px',
                          background: exportButtonClicked ? '#f1f5f9' : '#f8fafc',
                          border: exportButtonClicked ? '1px solid #e2e8f0' : '1px solid #e2e8f0',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'all 0.15s ease',
                          transform: exportButtonClicked ? 'scale(0.96)' : 'scale(1)'
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                          background: importButtonClicked ? '#f1f5f9' : '#f8fafc',
                          border: importButtonClicked ? '1px solid #e2e8f0' : '1px solid #e2e8f0',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'all 0.15s ease',
                          transform: importButtonClicked ? 'scale(0.96)' : 'scale(1)'
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

                      {/* Share Section */}
                      <p style={{
                        margin: 0,
                        marginBottom: '10px',
                        fontSize: '12px',
                        color: '#71717a',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        lineHeight: '1.5'
                      }}>
                        Share your annotations with others using a unique link.
                      </p>

                      <div style={{
                        padding: '12px 16px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                          Share and View
                        </span>
                      </div>

                      {/* Recent Exports */}
                      <div style={{ marginTop: '20px' }}>
                        <h3 style={{
                          margin: 0,
                          marginBottom: '12px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#64748b',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase'
                        }}>
                          Recent Exports
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {[
                            { name: 'ml-annotations-2024.json', date: '2 hours ago', size: '1.2 MB' },
                            { name: 'dataset-labels.json', date: 'Yesterday', size: '856 KB' },
                            { name: 'training-notes.json', date: '3 days ago', size: '324 KB' }
                          ].map((file, index) => (
                            <div
                              key={index}
                              style={{
                                padding: '10px 12px',
                                background: '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: '#18181b',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                    letterSpacing: '-0.01em',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {file.name}
                                  </div>
                                  <div style={{
                                    fontSize: '10px',
                                    color: '#a1a1aa',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                    marginTop: '2px'
                                  }}>
                                    {file.date} · {file.size}
                                  </div>
                                </div>
                              </div>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Text on White Card */}
              <div style={{
                marginTop: '16px'
              }}>
                {/* Header */}
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#1a1a1a',
                  marginBottom: '12px',
                  textAlign: 'center'
                }}>
                  Import and Export Options
                </h3>
                
                {/* Description */}
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  margin: '0',
                  textAlign: 'center'
                }}>
                  Import JSON files and sync annotations across any account.
                </p>
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  marginTop: '8px',
                  textAlign: 'center'
                }}>
                  Export your data via email, download, or copy JSON.
                </p>
              </div>
            </div>
          </div>

          {/* Middle Right - Big Panel */}
          <div style={{
            background: 'rgb(255, 255, 255)',
            borderRadius: '24px',
            padding: '12px',
            boxShadow: 'rgba(0, 0, 0, 0.08) 0px 4px 20px',
            border: '1px solid rgb(241, 245, 249)'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}>
              {/* Grey Background Container (fixed height, scroll like Import/Export) */}
              <div style={{
                background: 'rgb(247, 247, 247)',
                borderRadius: '16px',
                padding: '16px',
                height: '359px',
                margin: '0px',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                <div style={{
                    width: '100%', 
                    maxWidth: '100%',
                  display: 'flex',
                    alignItems: 'flex-start',
                  justifyContent: 'center',
                    padding: '10px 10px 0px',
                    pointerEvents: 'auto',
                  height: '100%'
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
                      {/* Header with Select All */}
                      <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: '#ffffff'
                      }}>
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: '2px solid #d1d5db',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: '#374151',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>
                          Select All
                        </span>
                      </div>

                      {/* Static List */}
                      <div style={{
                        flex: 1,
                        overflowY: 'hidden',
                        padding: '16px',
                        pointerEvents: 'none',
                        scrollbarWidth: 'none', // Firefox
                        msOverflowStyle: 'none', // IE/Edge
                        WebkitScrollbar: { display: 'none' } // Webkit browsers
                      }}>
                        {/* Annotation 1 */}
                        <div style={{
                          padding: '12px 20px',
                          borderBottom: '1px solid #e5e7eb',
                          background: '#f8f9fa',
                          display: 'flex',
                          gap: '14px'
                        }}>
                          {/* Checkbox */}
                          <div style={{
                            width: '18px',
                            height: '18px',
                            marginTop: '2px',
                            borderRadius: '4px',
                            border: '2px solid #d1d5db',
                            background: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '13px',
                              color: '#6b7280',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              marginBottom: '6px'
                            }}>
                              <span style={{ fontWeight: 600 }}>Selected Text:</span> <span style={{ color: '#374151', fontStyle: 'italic' }}>convolutional neural networks</span>
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: '#6b7280',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              marginBottom: '6px'
                            }}>
                              <span style={{ fontWeight: 600 }}>Label:</span> <span style={{ color: '#374151' }}>Algorithm</span>
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: '#6b7280',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexWrap: 'wrap'
                            }}>
                              <span style={{ fontWeight: 600 }}>Label Type(s):</span>
                              <span style={{ color: '#374151' }}>
                                Neural Network, Supervised
                              </span>
                            </div>
                          </div>

                          {/* Actions and Number */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            flexShrink: 0
                          }}>
                            <div style={{
                              display: 'flex',
                              gap: '4px',
                              alignItems: 'center'
                            }}>
                              <div 
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '6px',
                                  background: hoveredTooltip === 'highlight-1' ? '#e5e7eb' : '#f3f4f6',
                                  transition: 'background 0.2s',
                                  position: 'relative'
                                }}
                                onMouseEnter={() => setHoveredTooltip('highlight-1')}
                                onMouseLeave={() => setHoveredTooltip(null)}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                  <path d="M15 5l3 3" />
                                </svg>
                                {hoveredTooltip === 'highlight-1' && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: '0',
                                    transform: 'translateX(10px)',
                                    background: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: '#374151',
                                    whiteSpace: 'nowrap',
                                    zIndex: 1000,
                                    marginTop: '8px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                    minWidth: '200px',
                                    textAlign: 'center'
                                  }}>
                                    <div style={{
                                      position: 'absolute',
                                      bottom: '100%',
                                      right: '20px',
                                      transform: 'translateX(0)',
                                      width: 0,
                                      height: 0,
                                      borderLeft: '6px solid transparent',
                                      borderRight: '6px solid transparent',
                                      borderBottom: '6px solid #ffffff'
                                    }}></div>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Jump to Annotation</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Click to navigate to this highlight in the original chat</div>
                                  </div>
                                )}
                              </div>
                              <div 
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '6px',
                                  background: hoveredTooltip === 'info-1' ? '#e5e7eb' : '#f3f4f6',
                                  transition: 'background 0.2s',
                                  position: 'relative'
                                }}
                                onMouseEnter={() => setHoveredTooltip('info-1')}
                                onMouseLeave={() => setHoveredTooltip(null)}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="16" x2="12" y2="12" />
                                  <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                {hoveredTooltip === 'info-1' && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: '0',
                                    transform: 'translateX(10px)',
                                    background: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: '#374151',
                                    whiteSpace: 'nowrap',
                                    zIndex: 1000,
                                    marginTop: '8px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                    minWidth: '200px',
                                    textAlign: 'center'
                                  }}>
                                    <div style={{
                                      position: 'absolute',
                                      bottom: '100%',
                                      right: '20px',
                                      transform: 'translateX(0)',
                                      width: 0,
                                      height: 0,
                                      borderLeft: '6px solid transparent',
                                      borderRight: '6px solid transparent',
                                      borderBottom: '6px solid #ffffff'
                                    }}></div>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Annotation Details</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>View more insights and metadata about this annotation</div>
                                  </div>
                                )}
                              </div>
                              <div 
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '6px',
                                  background: hoveredTooltip === 'delete-1' ? '#fecaca' : '#fef2f2',
                                  transition: 'background 0.2s',
                                  position: 'relative'
                                }}
                                onMouseEnter={() => setHoveredTooltip('delete-1')}
                                onMouseLeave={() => setHoveredTooltip(null)}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                {hoveredTooltip === 'delete-1' && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: '0',
                                    transform: 'translateX(10px)',
                                    background: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: '#374151',
                                    whiteSpace: 'nowrap',
                                    zIndex: 1000,
                                    marginTop: '8px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                    minWidth: '200px',
                                    textAlign: 'center'
                                  }}>
                                    <div style={{
                                      position: 'absolute',
                                      bottom: '100%',
                                      right: '20px',
                                      transform: 'translateX(0)',
                                      width: 0,
                                      height: 0,
                                      borderLeft: '6px solid transparent',
                                      borderRight: '6px solid transparent',
                                      borderBottom: '6px solid #ffffff'
                                    }}></div>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Delete Highlight</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Remove this highlight from the chat permanently</div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: '#9ca3af',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              minWidth: '20px',
                              textAlign: 'right',
                              paddingTop: '6px'
                            }}>
                              1
                            </div>
                          </div>
                        </div>

                        {/* Annotation 2 */}
                        <div style={{
                          padding: '12px 20px',
                          borderBottom: '1px solid #e5e7eb',
                          background: '#ffffff',
                          display: 'flex',
                          gap: '14px'
                        }}>
                          {/* Checkbox */}
                          <div style={{
                            width: '18px',
                            height: '18px',
                            marginTop: '2px',
                            borderRadius: '4px',
                            border: '2px solid #d1d5db',
                            background: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '13px',
                              color: '#6b7280',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              marginBottom: '6px'
                            }}>
                              <span style={{ fontWeight: 600 }}>Selected Text:</span> <span style={{ color: '#374151', fontStyle: 'italic' }}>backpropagation optimizes weights</span>
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: '#6b7280',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              marginBottom: '6px'
                            }}>
                              <span style={{ fontWeight: 600 }}>Label:</span> <span style={{ color: '#374151' }}>Training Method</span>
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: '#6b7280',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexWrap: 'wrap'
                            }}>
                              <span style={{ fontWeight: 600 }}>Label Type(s):</span>
                              <span style={{ color: '#374151' }}>
                                Gradient Descent
                              </span>
                            </div>
                          </div>

                          {/* Actions and Number */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            flexShrink: 0
                          }}>
                            <div style={{
                              display: 'flex',
                              gap: '4px',
                              alignItems: 'center'
                            }}>
                              <div 
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '6px',
                                  background: hoveredTooltip === 'highlight-2' ? '#e5e7eb' : '#f3f4f6',
                                  transition: 'background 0.2s',
                                  position: 'relative'
                                }}
                                onMouseEnter={() => setHoveredTooltip('highlight-2')}
                                onMouseLeave={() => setHoveredTooltip(null)}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                  <path d="M15 5l3 3" />
                                </svg>
                                {hoveredTooltip === 'highlight-2' && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: '0',
                                    transform: 'translateX(0)',
                                    background: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: '#374151',
                                    whiteSpace: 'nowrap',
                                    zIndex: 1000,
                                    marginTop: '8px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                    minWidth: '200px',
                                    textAlign: 'center'
                                  }}>
                                    <div style={{
                                      position: 'absolute',
                                      bottom: '100%',
                                      right: '20px',
                                      transform: 'translateX(0)',
                                      width: 0,
                                      height: 0,
                                      borderLeft: '6px solid transparent',
                                      borderRight: '6px solid transparent',
                                      borderBottom: '6px solid #ffffff'
                                    }}></div>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Jump to Annotation</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Click to navigate to this highlight in the original chat</div>
                                  </div>
                                )}
                              </div>
                              <div 
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '6px',
                                  background: hoveredTooltip === 'info-2' ? '#e5e7eb' : '#f3f4f6',
                                  transition: 'background 0.2s',
                                  position: 'relative'
                                }}
                                onMouseEnter={() => setHoveredTooltip('info-2')}
                                onMouseLeave={() => setHoveredTooltip(null)}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="16" x2="12" y2="12" />
                                  <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                {hoveredTooltip === 'info-2' && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: '0',
                                    transform: 'translateX(0)',
                                    background: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: '#374151',
                                    whiteSpace: 'nowrap',
                                    zIndex: 1000,
                                    marginTop: '8px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                    minWidth: '200px',
                                    textAlign: 'center'
                                  }}>
                                    <div style={{
                                      position: 'absolute',
                                      bottom: '100%',
                                      right: '20px',
                                      transform: 'translateX(0)',
                                      width: 0,
                                      height: 0,
                                      borderLeft: '6px solid transparent',
                                      borderRight: '6px solid transparent',
                                      borderBottom: '6px solid #ffffff'
                                    }}></div>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Annotation Details</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>View more insights and metadata about this annotation</div>
                                  </div>
                                )}
                              </div>
                              <div 
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '6px',
                                  background: hoveredTooltip === 'delete-2' ? '#fecaca' : '#fef2f2',
                                  transition: 'background 0.2s',
                                  position: 'relative'
                                }}
                                onMouseEnter={() => setHoveredTooltip('delete-2')}
                                onMouseLeave={() => setHoveredTooltip(null)}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                {hoveredTooltip === 'delete-2' && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: '0',
                                    transform: 'translateX(0)',
                                    background: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: '#374151',
                                    whiteSpace: 'nowrap',
                                    zIndex: 1000,
                                    marginTop: '8px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                    minWidth: '200px',
                                    textAlign: 'center'
                                  }}>
                                    <div style={{
                                      position: 'absolute',
                                      bottom: '100%',
                                      right: '20px',
                                      transform: 'translateX(0)',
                                      width: 0,
                                      height: 0,
                                      borderLeft: '6px solid transparent',
                                      borderRight: '6px solid transparent',
                                      borderBottom: '6px solid #ffffff'
                                    }}></div>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Delete Highlight</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Remove this highlight from the chat permanently</div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: '#9ca3af',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              minWidth: '20px',
                              textAlign: 'right',
                              paddingTop: '6px'
                            }}>
                              2
                            </div>
                          </div>
                        </div>

                        {/* Annotation 3 */}
                        <div style={{
                          padding: '12px 20px',
                          background: 'rgba(248, 249, 250, 0.12)',
                          backdropFilter: 'blur(35px)',
                          border: '1px solid rgba(255, 255, 255, 0.5)',
                          display: 'flex',
                          gap: '14px',
                          opacity: 0.35
                        }}>
                          {/* Checkbox */}
                          <div style={{
                            width: '18px',
                            height: '18px',
                            marginTop: '2px',
                            borderRadius: '4px',
                            border: '2px solid #d1d5db',
                            background: '#f8f9fa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '13px',
                              color: '#6b7280',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              marginBottom: '6px'
                            }}>
                              <span style={{ fontWeight: 600 }}>Selected Text:</span> <span style={{ color: '#374151', fontStyle: 'italic' }}>overfitting occurs when model</span>
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: '#6b7280',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              marginBottom: '6px'
                            }}>
                              <span style={{ fontWeight: 600 }}>Label:</span> <span style={{ color: '#374151' }}>Model Issue</span>
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: '#6b7280',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexWrap: 'wrap'
                            }}>
                              <span style={{ fontWeight: 600 }}>Label Type(s):</span>
                              <span style={{ color: '#374151' }}>
                                Overfitting, Bias-Variance
                              </span>
                            </div>
                          </div>

                          {/* Actions and Number */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            flexShrink: 0
                          }}>
                            <div style={{
                              display: 'flex',
                              gap: '4px',
                              alignItems: 'center'
                            }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                background: '#f3f4f6',
                                transition: 'background 0.2s'
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                  <path d="M15 5l3 3" />
                                </svg>
                              </div>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                background: '#f3f4f6'
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="16" x2="12" y2="12" />
                                  <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                              </div>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                background: '#fef2f2'
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </div>
                            </div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: '#9ca3af',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              minWidth: '20px',
                              textAlign: 'right',
                              paddingTop: '6px'
                            }}>
                              3
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Text on White Card */}
              <div style={{
                marginTop: '16px'
              }}>
                {/* Header */}
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#1a1a1a',
                  marginBottom: '12px',
                  textAlign: 'center'
                }}>
                  Annotation History
                </h3>
                
                {/* Description */}
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  margin: '0',
                  textAlign: 'center'
                }}>
                  View your annotations and manage highlights with ease.
                </p>
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  marginTop: '8px',
                  textAlign: 'center'
                }}>
                  Delete highlights or remove all annotations completely.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row - 3 Small Panels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: '24px',
          marginTop: '24px'
        }}>
          {/* Bottom Left - Small Panel */}
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #f1f5f9',
            minHeight: '480px',
            maxHeight: '480px'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}>
              {/* Grey Background Container */}
              <div style={{
                background: 'rgb(247, 247, 247)',
                borderRadius: '16px',
                padding: '24px',
                height: '75%',
                margin: '0px'
              }}>
                 {/* Unique Chat Interface */}
                <div style={{
                   width: '100%',
                   height: '100%',
                   background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
                   borderRadius: '16px',
                  display: 'flex',
                   flexDirection: 'column',
                   overflow: 'hidden',
                   border: '1px solid #e2e8f0',
                   boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                   position: 'relative'
                 }}>
                   {/* Animated Background Pattern */}
                   <div style={{
                     position: 'absolute',
                     top: 0,
                     left: 0,
                     right: 0,
                     bottom: 0,
                     background: `
                       radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
                       radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.2) 0%, transparent 50%),
                       radial-gradient(circle at 40% 60%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)
                     `,
                     pointerEvents: 'none',
                     zIndex: 1
                   }}></div>
                   
                   {/* Floating Particles */}
                   <div style={{
                     position: 'absolute',
                     top: '15%',
                     right: '10%',
                     width: '4px',
                     height: '4px',
                     background: 'rgba(255, 255, 255, 0.6)',
                     borderRadius: '50%',
                     boxShadow: '0 0 6px rgba(255, 255, 255, 0.8)',
                     zIndex: 1
                   }}></div>
                   <div style={{
                     position: 'absolute',
                     top: '60%',
                     left: '8%',
                     width: '3px',
                     height: '3px',
                     background: 'rgba(255, 255, 255, 0.4)',
                     borderRadius: '50%',
                     boxShadow: '0 0 4px rgba(255, 255, 255, 0.6)',
                     zIndex: 1
                   }}></div>
                   <div style={{
                     position: 'absolute',
                     top: '80%',
                     right: '20%',
                     width: '2px',
                     height: '2px',
                     background: 'rgba(255, 255, 255, 0.5)',
                     borderRadius: '50%',
                     boxShadow: '0 0 3px rgba(255, 255, 255, 0.7)',
                     zIndex: 1
                   }}></div>
                   {/* Messages */}
                   <div style={{
                     flex: 1,
                     padding: '8px',
                     display: 'flex',
                     flexDirection: 'column',
                     gap: '10px',
                  justifyContent: 'center',
                     position: 'relative',
                     zIndex: 2
                   }}>
                     {/* User Message */}
                     <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                       <div style={{
                         background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                         borderRadius: '20px',
                         borderBottomRightRadius: '6px',
                         padding: '14px 18px',
                         maxWidth: '80%',
                         fontSize: '14px',
                         lineHeight: '1.5',
                         color: '#374151',
                         border: '1px solid #e5e7eb',
                         boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                         position: 'relative'
                       }}>
                        Can you explain <span style={{ 
                          backgroundColor: '#fef3c7', 
                          padding: '2px 4px', 
                          borderRadius: '4px',
                          fontWeight: '500'
                        }}>machine learning</span>?
                      </div>
                    </div>

                    {/* AI Response */}
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        maxWidth: '85%'
                      }}>
                        <div style={{
                          fontSize: '0.8rem',
                          marginBottom: '8px',
                          fontWeight: '500',
                          color: '#555',
                          textAlign: 'left',
                          paddingRight: '0rem',
                          display: 'flex',
                  alignItems: 'center',
                          gap: '0.5rem',
                          justifyContent: 'flex-start',
                          paddingLeft: '16px'
                        }}>
                          <span>phraze</span>
                          <div style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.5rem',
                            fontWeight: '600',
                            color: 'white',
                            border: '1px solid #475569'
                          }}>P</div>
                        </div>
                         <div style={{
                           background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)',
                           borderRadius: '20px',
                           borderBottomLeftRadius: '6px',
                           padding: '16px 20px',
                           fontSize: '14px',
                           lineHeight: '1.5',
                           color: '#374151',
                           border: '1px solid rgba(229, 231, 235, 0.5)',
                           boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                           backdropFilter: 'blur(10px)',
                           position: 'relative'
                         }}>
                          <span style={{ 
                            backgroundColor: '#dbeafe', 
                            padding: '2px 4px', 
                            borderRadius: '4px',
                            fontWeight: '500'
                          }}>Machine learning</span> is a subset of AI that enables computers to learn and make decisions from data. Key concepts include <span style={{ 
                            backgroundColor: '#dcfce7', 
                            padding: '2px 4px', 
                            borderRadius: '4px',
                            fontWeight: '500'
                          }}>neural networks</span>, <span style={{ 
                            backgroundColor: '#fce7f3', 
                            padding: '2px 4px', 
                            borderRadius: '4px',
                            fontWeight: '500'
                          }}>algorithms</span>, and <span style={{ 
                            backgroundColor: '#fef3c7', 
                            padding: '2px 4px', 
                            borderRadius: '4px',
                            fontWeight: '500'
                          }}>data preprocessing</span> techniques.
                        </div>
                      </div>
                    </div>

                  </div>
                  
                   {/* Legend */}
                   <div style={{
                     padding: '8px 10px',
                     borderTop: '1px solid rgba(229, 231, 235, 0.3)',
                     background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.8) 100%)',
                     borderRadius: '0 0 16px 16px',
                     position: 'relative',
                     zIndex: 2,
                     backdropFilter: 'blur(20px)',
                     boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                   }}>
                     <div style={{
                       display: 'flex',
                       flexDirection: 'row',
                       gap: '12px',
                       alignItems: 'center',
                       justifyContent: 'center',
                       flexWrap: 'wrap'
                     }}>
                       <div style={{
                         display: 'flex',
                         alignItems: 'center',
                         gap: '4px',
                         fontSize: '11px',
                         color: '#6b7280'
                       }}>
                         <div style={{
                           width: '10px',
                           height: '10px',
                           backgroundColor: '#fef3c7',
                           borderRadius: '2px'
                         }}></div>
                         <span>Technology</span>
                       </div>
                       <div style={{
                         display: 'flex',
                         alignItems: 'center',
                         gap: '4px',
                         fontSize: '11px',
                         color: '#6b7280'
                       }}>
                         <div style={{
                           width: '10px',
                           height: '10px',
                           backgroundColor: '#dbeafe',
                           borderRadius: '2px'
                         }}></div>
                         <span>AI Concepts</span>
                       </div>
                       <div style={{
                         display: 'flex',
                         alignItems: 'center',
                         gap: '4px',
                         fontSize: '11px',
                         color: '#6b7280'
                       }}>
                         <div style={{
                           width: '10px',
                           height: '10px',
                           backgroundColor: '#dcfce7',
                           borderRadius: '2px'
                         }}></div>
                         <span>Algorithms</span>
                       </div>
                       <div style={{
                         display: 'flex',
                         alignItems: 'center',
                         gap: '4px',
                         fontSize: '11px',
                         color: '#6b7280'
                       }}>
                         <div style={{
                           width: '10px',
                           height: '10px',
                           backgroundColor: '#fce7f3',
                           borderRadius: '2px'
                         }}></div>
                         <span>Methods</span>
                       </div>
                     </div>
                   </div>
                </div>
              </div>
              
              {/* Text on White Card */}
              <div style={{
                marginTop: '15px'
              }}>
                {/* Header */}
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#1a1a1a',
                  marginBottom: '8px',
                  textAlign: 'center'
                }}>
                  Chat Annotation
                </h3>
                
                {/* Description */}
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  margin: '0',
                  textAlign: 'center'
                }}>
                  Highlight and add labels to annotate your chat.
                </p>
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  marginTop: '8px',
                  textAlign: 'center'
                }}>
                  Organize your thoughts with custom tags and notes.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Right - Wide Panel (spans 2 positions) */}
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #f1f5f9',
            minHeight: '480px',
            maxHeight: '480px'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}>
              {/* Grey Background Container for Chat Demo */}
              <div style={{
                background: 'rgb(247, 247, 247)',
                borderRadius: '16px',
                padding: '16px',
                height: '75%',
                margin: '0px'
              }}>
                {/* Chat Demo with exact styles from the HTML */}
                <div style={{
                  height: '100%',
                  overflowY: 'hidden',
                  padding: '8px',
                  pointerEvents: 'none'
                }}>
                  {/* First message */}
                  <div style={{
                    padding: '0px 1rem',
                    margin: '0px',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    position: 'relative',
                    zIndex: 10,
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      maxWidth: '85%'
                    }}>
                      <div style={{
                        fontSize: '0.8rem',
                        marginBottom: '6px',
                        fontWeight: '500',
                        color: 'rgb(85, 85, 85)',
                        textAlign: 'right',
                        paddingRight: '0px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        justifyContent: 'flex-end'
                      }}>
                        <img src={getImagePath('maya.png')} alt="Jin Liner" style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1px solid rgb(203, 213, 225)'
                        }} />
                        <span>Jin Liner</span>
                      </div>
                      <div style={{
                        padding: '0.75rem 1.25rem 1.25rem',
                        background: 'rgb(255, 255, 255)',
                        borderRadius: '2rem 2rem 5px',
                        color: 'rgb(10, 10, 10)',
                        display: 'inline-block',
                        width: '100%',
                        position: 'relative',
                        marginTop: '2px',
                        textAlign: 'left'
                      }}>
                        <div style={{
                          fontSize: '0.9rem',
                          lineHeight: '1.4',
                          whiteSpace: 'pre-wrap'
                        }}>
                          <span style={{
                            position: 'relative',
                            display: 'inline-block'
                          }}>
                            <span style={{
                              position: 'relative',
                              zIndex: 15
                            }}>
                              Hey! I'm trying to build a machine learning model for image recognition. Any tips on getting started?
                            </span>
                            <div style={{
                              position: 'absolute',
                              inset: '0px',
                              backgroundColor: 'rgb(254, 240, 138)',
                              width: '100%',
                              zIndex: 6
                            }}></div>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* phraze P's response */}
                  <div style={{
                    padding: '0px 1rem',
                    margin: '0px',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'flex-start',
                    position: 'relative',
                    zIndex: 1,
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      maxWidth: '85%'
                    }}>
                      <div style={{
                        fontSize: '0.8rem',
                        marginBottom: '6px',
                        fontWeight: '500',
                        color: 'rgb(85, 85, 85)',
                        textAlign: 'left',
                        paddingRight: '0rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        justifyContent: 'flex-start'
                      }}>
                        <span>phraze</span>
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: 'rgb(100, 116, 139)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.6rem',
                          fontWeight: '600',
                          color: 'white',
                          border: '1px solid rgb(71, 85, 105)'
                        }}>
                          P
                        </div>
                      </div>
                      <div style={{
                        padding: '0px 0px 0.5rem',
                        background: '#ffffff',
                        borderRadius: '0.5rem',
                        color: 'rgb(10, 10, 10)',
                        display: 'inline-block',
                        width: '100%',
                        position: 'relative',
                        marginTop: '2px',
                        textAlign: 'left'
                      }}>
                        <div style={{
                          fontSize: '0.9rem',
                          lineHeight: '1.4',
                          whiteSpace: 'normal'
                        }}>
                          Great question! For image recognition, I'd recommend starting with <span style={{
                            position: 'relative',
                            display: 'inline-block'
                          }}>
                            <span style={{
                              position: 'relative',
                              zIndex: 15
                            }}>
                              TensorFlow or PyTorch
                            </span>
                            <div style={{
                              position: 'absolute',
                              inset: '0px',
                              backgroundColor: 'rgb(254, 240, 138)',
                              width: '100%',
                              zIndex: 6
                            }}></div>
                          </span>. Begin with pre-trained models like <span style={{
                            position: 'relative',
                            display: 'inline-block'
                          }}>
                            <span style={{
                              position: 'relative',
                              zIndex: 15
                            }}>
                              ResNet or VGG
                            </span>
                            <div style={{
                              position: 'absolute',
                              inset: '0px',
                              backgroundColor: 'rgb(254, 240, 138)',
                              width: '100%',
                              zIndex: 6
                            }}></div>
                          </span>, then fine-tune them on your specific dataset.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Alex Chen's message */}
                  <div style={{
                    padding: '0px 1rem',
                    margin: '0px',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    position: 'relative',
                    zIndex: 1,
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      maxWidth: '85%'
                    }}>
                      <div style={{
                        fontSize: '0.8rem',
                        marginBottom: '6px',
                        fontWeight: '500',
                        color: 'rgb(85, 85, 85)',
                        textAlign: 'right',
                        paddingRight: '0px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        justifyContent: 'flex-end'
                      }}>
                        <img src={getImagePath('alex.png')} alt="Alex Chen" style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1px solid rgb(203, 213, 225)'
                        }} />
                        <span>Alex Chen</span>
                      </div>
                      <div style={{
                        padding: '0.75rem 1.25rem 1.25rem',
                        background: 'rgb(255, 255, 255)',
                        borderRadius: '2rem 2rem 5px',
                        color: 'rgb(10, 10, 10)',
                        display: 'inline-block',
                        width: '100%',
                        position: 'relative',
                        marginTop: '2px',
                        textAlign: 'left'
                      }}>
                        <div style={{
                          fontSize: '0.9rem',
                          lineHeight: '1.4',
                          whiteSpace: 'pre-wrap'
                        }}>
                          I started with <span style={{
                            position: 'relative',
                            display: 'inline-block'
                          }}>
                            <span style={{
                              position: 'relative',
                              zIndex: 15
                            }}>
                              TensorFlow
                            </span>
                            <div style={{
                              position: 'absolute',
                              inset: '0px',
                              backgroundColor: 'rgb(254, 240, 138)',
                              width: '100%',
                              zIndex: 6
                            }}></div>
                          </span> too! The transfer learning approach saved me weeks of training time.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Response to Alex Chen */}
                  <div style={{
                    padding: '0px 1rem',
                    margin: '0px',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'flex-start',
                    position: 'relative',
                    zIndex: 1,
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      maxWidth: '85%'
                    }}>
                      <div style={{
                        fontSize: '0.8rem',
                        marginBottom: '6px',
                        fontWeight: '500',
                        color: 'rgb(85, 85, 85)',
                        textAlign: 'left',
                        paddingRight: '0rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        justifyContent: 'flex-start'
                      }}>
                        <span>phraze</span>
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: 'rgb(100, 116, 139)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.6rem',
                          fontWeight: '600',
                          color: 'white',
                          border: '1px solid rgb(71, 85, 105)'
                        }}>
                          P
                        </div>
                      </div>
                      <div style={{
                        padding: '0px 0px 0.5rem',
                        background: '#ffffff',
                        borderRadius: '0.5rem',
                        color: 'rgb(10, 10, 10)',
                        display: 'inline-block',
                        width: '100%',
                        position: 'relative',
                        marginTop: '2px',
                        textAlign: 'left'
                      }}>
                        <div style={{
                          fontSize: '0.9rem',
                          lineHeight: '1.4',
                          whiteSpace: 'normal'
                        }}>
                          That's excellent! Transfer learning is indeed a game-changer. Since you're working with medical images, I'd recommend looking into architectures specifically designed for medical imaging like <span style={{
                            position: 'relative',
                            display: 'inline-block'
                          }}>
                            <span style={{
                              position: 'relative',
                              zIndex: 15
                            }}>
                              DenseNet or EfficientNet
                            </span>
                            <div style={{
                              position: 'absolute',
                              inset: '0px',
                              backgroundColor: 'rgb(254, 240, 138)',
                              width: '100%',
                              zIndex: 6
                            }}></div>
                          </span>. They handle the fine details in medical scans much better than general-purpose models.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Jin Liner's final message */}
                  <div style={{
                    padding: '0px 1rem',
                    margin: '0px',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    position: 'relative',
                    zIndex: 1,
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      maxWidth: '85%'
                    }}>
                      <div style={{
                        fontSize: '0.8rem',
                        marginBottom: '6px',
                        fontWeight: '500',
                        color: 'rgb(85, 85, 85)',
                        textAlign: 'right',
                        paddingRight: '0px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        justifyContent: 'flex-end'
                      }}>
                        <img src={getImagePath('maya.png')} alt="Jin Liner" style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1px solid rgb(203, 213, 225)'
                        }} />
                        <span>Jin Liner</span>
                      </div>
                      <div style={{
                        padding: '0.75rem 1.25rem 1.25rem',
                        background: 'rgb(255, 255, 255)',
                        borderRadius: '2rem 2rem 5px',
                        color: 'rgb(10, 10, 10)',
                        display: 'inline-block',
                        width: '100%',
                        position: 'relative',
                        marginTop: '2px',
                        textAlign: 'left'
                      }}>
                        <div style={{
                          fontSize: '0.9rem',
                          lineHeight: '1.4',
                          whiteSpace: 'pre-wrap'
                        }}>
                          <span style={{
                            position: 'relative',
                            display: 'inline-block'
                          }}>
                            <span style={{
                              position: 'relative',
                              zIndex: 15
                            }}>
                              @alex I'm working with medical images. Should I use a different architecture?
                            </span>
                            <div style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: '0px',
                              transform: 'translateY(-2px) scale(0.98)',
                              opacity: 0,
                              transition: 'opacity 240ms, transform 240ms',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              background: 'rgba(255, 255, 255, 0.85)',
                              backdropFilter: 'saturate(180%) blur(4px)',
                              border: '1px solid rgb(229, 231, 235)',
                              borderRadius: '9999px',
                              padding: '6px 10px',
                              boxShadow: 'rgba(0, 0, 0, 0.06) 0px 6px 20px',
                              zIndex: 26
                            }}>
                              <span style={{
                                fontSize: '12px',
                                color: 'rgb(107, 114, 128)'
                              }}>
                                Label:
                              </span>
                              <span style={{
                                fontSize: '12px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                background: 'rgb(236, 254, 255)',
                                color: 'rgb(14, 116, 144)',
                                border: '1px solid rgb(165, 243, 252)',
                                fontWeight: '600'
                              }}>
                                Medical
                              </span>
                              <span style={{
                                fontSize: '12px',
                                color: 'rgb(107, 114, 128)'
                              }}>
                                User:
                              </span>
                              <span style={{
                                fontSize: '12px',
                                color: 'rgb(107, 114, 128)',
                                fontWeight: '600'
                              }}>
                                Jin Liner
                              </span>
                            </div>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Alex Chen's reply to Jin Liner */}
                  <div style={{
                    padding: '0px 1rem',
                    margin: '0px',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    position: 'relative',
                    zIndex: 1,
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      maxWidth: '85%'
                    }}>
                      <div style={{
                        fontSize: '0.8rem',
                        marginBottom: '6px',
                        fontWeight: '500',
                        color: 'rgb(85, 85, 85)',
                        textAlign: 'right',
                        paddingRight: '0px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        justifyContent: 'flex-end'
                      }}>
                        <img src={getImagePath('alex.png')} alt="Alex Chen" style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1px solid rgb(203, 213, 225)'
                        }} />
                        <span>Alex Chen</span>
                      </div>
                      <div style={{
                        padding: '0.75rem 1.25rem 1.25rem',
                        background: 'rgb(255, 255, 255)',
                        borderRadius: '2rem 2rem 5px',
                        color: 'rgb(10, 10, 10)',
                        display: 'inline-block',
                        width: '100%',
                        position: 'relative',
                        marginTop: '2px',
                        textAlign: 'left'
                      }}>
                        <div style={{
                          fontSize: '0.9rem',
                          lineHeight: '1.4',
                          whiteSpace: 'pre-wrap'
                        }}>
                          @maya For medical images, definitely consider <span style={{
                            position: 'relative',
                            display: 'inline-block'
                          }}>
                            <span style={{
                              position: 'relative',
                              zIndex: 15
                            }}>
                              U-Net or ResNet-50
                            </span>
                            <div style={{
                              position: 'absolute',
                              inset: '0px',
                              backgroundColor: 'rgb(254, 240, 138)',
                              width: '100%',
                              zIndex: 6
                            }}></div>
                          </span>. They're proven performers in medical imaging. Also, make sure to use proper data augmentation techniques since medical datasets are often smaller.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Text on White Card */}
              <div style={{
                marginTop: '15px'
              }}>
                {/* Header */}
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#1a1a1a',
                  marginBottom: '8px',
                  textAlign: 'center'
                }}>
                  Team Collaboration
                </h3>
                
                {/* Description */}
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  margin: '0',
                  textAlign: 'center'
                }}>
                  Multiple people can chat, annotate, and revisit their annotations in a thread
                </p>
                <p style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#666',
                  lineHeight: '1.5',
                  marginTop: '8px',
                  textAlign: 'center'
                }}>
                  Build knowledge together with shared insights and feedback.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer
        backgroundImageSrc="/pedals.jpg"
        headlineLine1="Get the full walkthrough"
        headlineLine2="in a live demo."
        showTypography={true}
      />
    </main>
  );
}
 