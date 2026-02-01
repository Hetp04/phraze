import { useEffect, useRef, useState } from 'react';
import { getImagePath } from '../utils/assetPaths';

// Add style for hiding scrollbar
if (typeof document !== 'undefined' && !document.getElementById('hide-scrollbar-style')) {
  const style = document.createElement('style');
  style.id = 'hide-scrollbar-style';
  style.textContent = '.hide-scrollbar::-webkit-scrollbar { display: none; }';
  document.head.appendChild(style);
}

// Add style for highlight animation
if (typeof document !== 'undefined' && !document.getElementById('highlight-animation-style')) {
  const style = document.createElement('style');
  style.id = 'highlight-animation-style';
  style.textContent = `
    @keyframes highlightRevealTopToBottom {
      0% {
        clip-path: inset(100% 0 0 0);
        background-color: transparent;
      }
      100% {
        clip-path: inset(0% 0 0 0);
        background-color: var(--highlight-color, #FFF176);
      }
    }
    .auto-highlight-animation {
      position: relative;
      display: inline;
    }
    .auto-highlight-animation.animating {
      animation: highlightRevealTopToBottom 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      --highlight-color: var(--anim-color);
    }
  `;
  document.head.appendChild(style);
}

// Static Chat Demo Component for second card (no animations)
function StaticChatDemo({ isActive = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('groq-llama-3.1-70b');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  
  const fakeChats = [
    { id: '1', title: 'AI Model Architecture', timestamp: Date.now() },
    { id: '2', title: 'TensorFlow Best Practices', timestamp: Date.now() - 86400000 },
    { id: '3', title: 'Machine Learning Tips', timestamp: Date.now() - 172800000 },
    { id: '4', title: 'Neural Network Design', timestamp: Date.now() - 259200000 },
    { id: '5', title: 'Deep Learning Fundamentals', timestamp: Date.now() - 345600000 },
    { id: '6', title: 'Data Preprocessing Techniques', timestamp: Date.now() - 432000000 },
    { id: '7', title: 'Model Evaluation Metrics', timestamp: Date.now() - 518400000 },
  ];

  const availableModels = [
    { value: 'groq-llama-3.1-70b', label: 'Phraze v1', description: 'Fast and efficient' },
    { value: 'groq-llama-3.1-8b', label: 'Phraze v2', description: 'Balanced performance' },
  ];

  // Static messages - already displayed
  const staticMessages = [
    { role: 'user', content: 'What are the best practices for training neural networks?', isTyping: false },
    { role: 'assistant', content: 'Great question! A few best practices:\n\n1) Clean, balanced data\n2) Normalize/standardize inputs\n3) Tune learning rate with scheduling\n4) Use regularization (dropout/L2/early stopping)\n5) Try different batch sizes\n6) Start simple, iterate the architecture', isTyping: false },
    { role: 'user', content: 'How do I prevent overfitting?', isTyping: false },
    { role: 'assistant', content: 'Common strategies to reduce overfitting:\n\n• Dropout (e.g., 0.2–0.5)\n• Data augmentation\n• Early stopping on validation\n• L1/L2 regularization\n• Cross-validation\n• Reduce model complexity', isTyping: false }
  ];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isModelDropdownOpen && !e.target.closest('.model-dropdown-container')) {
        setIsModelDropdownOpen(false);
      }
    };
    if (isModelDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isModelDropdownOpen]);

  // Return the same structure as ChatSidebarDemo but with static messages (no animations)
  // We'll reuse ChatSidebarDemo but pass a prop to make it static and blur the sidebar
  return <ChatSidebarDemo isActive={isActive} isStatic={true} staticMessages={staticMessages} blurSidebar={true} />;
}

function CollaborateChatDemo({ isActive = false }) {
  // Static messages - same as StaticChatDemo, showing the final state with highlights
  const staticMessages = [
    { role: 'user', content: 'What are the best practices for training neural networks?', isTyping: false },
    { role: 'assistant', content: 'Great question! A few best practices:\n\n1) Clean, balanced data\n2) Normalize/standardize inputs\n3) Tune learning rate with scheduling\n4) Use regularization (dropout/L2/early stopping)\n5) Try different batch sizes\n6) Start simple, iterate the architecture', isTyping: false },
    { role: 'user', content: 'How do I prevent overfitting?', isTyping: false },
    { role: 'assistant', content: 'Common strategies to reduce overfitting:\n\n• Dropout (e.g., 0.2–0.5)\n• Data augmentation\n• Early stopping on validation\n• L1/L2 regularization\n• Cross-validation\n• Reduce model complexity', isTyping: false }
  ];

  // Return ChatSidebarDemo with blurSidebar=true, focusHeader=true, and showFinalState=true
  // This will show the chat with highlights and annotation card, with header focused
  return <ChatSidebarDemo isActive={isActive} isStatic={true} staticMessages={staticMessages} blurSidebar={true} focusHeader={true} showFinalState={true} />;
}

function ChatSidebarDemo({ isActive, isStatic = false, staticMessages = [], blurSidebar = false, focusHeader = false, showFinalState = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('groq-llama-3.1-70b');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const rightPanelRef = useRef(null);
  
  const [highlights, setHighlights] = useState([]); // Store highlights: [{ messageIndex, start, end, color }]
  
  // Set highlights when showFinalState is true and panel is active
  useEffect(() => {
    if (showFinalState && isActive && staticMessages && staticMessages[3]) {
      const text = staticMessages[3].content;
      // Highlight the entire message content (same as previous card but static)
      const fullLength = text.length;
      
      // Only set highlights if they don't already exist to prevent infinite loops
      setHighlights(prev => {
        const existingHighlight = prev.find(h => 
          h.messageIndex === 3 && 
          h.start === 0 && 
          h.end === fullLength
        );
        if (existingHighlight) return prev; // Already set, don't update
        
        return [{
          messageIndex: 3, // Last assistant message
          start: 0,
          end: fullLength, // Highlight entire message
          color: '#FFF176'
        }];
      });
    } else if (!showFinalState || !isActive) {
      // Clear highlights when panel is inactive or showFinalState is false
      setHighlights(prev => {
        if (prev.length === 0) return prev; // Already cleared, don't update
        return [];
      });
    }
  }, [showFinalState, isActive]); // Removed staticMessages from dependencies to prevent infinite loop
  const messageRefs = useRef({});
  const autoHighlightTimerRef = useRef(null);
  const highlightTimersRef = useRef([]); // Track all highlight animation timers
  const [isAnimating, setIsAnimating] = useState(false);
  const [highlightingInProgress, setHighlightingInProgress] = useState(false);
  const prevIsActiveRef = useRef(false);
  const [restartKey, setRestartKey] = useState(0);
  const restartFunctionRef = useRef(null);
  
  // Fake chats data
  const fakeChats = [
    { id: '1', title: 'AI Model Architecture', timestamp: Date.now() },
    { id: '2', title: 'TensorFlow Best Practices', timestamp: Date.now() - 86400000 },
    { id: '3', title: 'Machine Learning Tips', timestamp: Date.now() - 172800000 },
    { id: '4', title: 'Neural Network Design', timestamp: Date.now() - 259200000 },
    { id: '5', title: 'Deep Learning Fundamentals', timestamp: Date.now() - 345600000 },
    { id: '6', title: 'Data Preprocessing Techniques', timestamp: Date.now() - 432000000 },
    { id: '7', title: 'Model Evaluation Metrics', timestamp: Date.now() - 518400000 },
  ];

  const availableModels = [
    { value: 'groq-llama-3.1-70b', label: 'Phraze v1', description: 'Fast and efficient' },
    { value: 'groq-llama-3.1-8b', label: 'Phraze v2', description: 'Balanced performance' },
  ];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Animated conversation state
  const [messages, setMessages] = useState(isStatic ? staticMessages : []);
  const [showWelcome, setShowWelcome] = useState(isStatic ? false : true);
  const [isTyping, setIsTyping] = useState(false);
  const [welcomeInputValue, setWelcomeInputValue] = useState('');
  const [chatInputValue, setChatInputValue] = useState('');
  const messagesContainerRef = useRef(null);
  const animationTimerRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const welcomeTypingIntervalRef = useRef(null);
  const chatTypingIntervalRef = useRef(null);

  const typeMessage = (text, role, onDone) => {
    // Clear any existing typing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }
    
    setIsTyping(true);
    setMessages((prev) => [...prev, { role, content: '', isTyping: true }]);
    let index = 0;
    typingIntervalRef.current = setInterval(() => {
      index += 1;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role, content: text.slice(0, index), isTyping: true };
        return next;
      });
      if (index >= text.length) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
        setIsTyping(false);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role, content: text, isTyping: false };
          return next;
        });
        if (onDone) onDone();
      }
    }, 18);
  };

  useEffect(() => {
    messagesContainerRef.current?.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  // Type text into welcome input box
  const typeWelcomeInput = (text, onDone) => {
    if (welcomeTypingIntervalRef.current) {
      clearInterval(welcomeTypingIntervalRef.current);
    }
    
    let index = 0;
    setWelcomeInputValue('');
    welcomeTypingIntervalRef.current = setInterval(() => {
      index += 1;
      setWelcomeInputValue(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(welcomeTypingIntervalRef.current);
        welcomeTypingIntervalRef.current = null;
        if (onDone) onDone();
      }
    }, 18);
  };

  // Type text into bottom chat input box
  const typeChatInput = (text, onDone) => {
    if (chatTypingIntervalRef.current) {
      clearInterval(chatTypingIntervalRef.current);
    }
    
    let index = 0;
    setChatInputValue('');
    chatTypingIntervalRef.current = setInterval(() => {
      index += 1;
      setChatInputValue(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(chatTypingIntervalRef.current);
        chatTypingIntervalRef.current = null;
        if (onDone) onDone();
      }
    }, 18);
  };

  // Restart function to completely reset and restart animation
  const handleRestart = () => {
    // Clear all timers
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    if (welcomeTypingIntervalRef.current) {
      clearInterval(welcomeTypingIntervalRef.current);
      welcomeTypingIntervalRef.current = null;
    }
    if (chatTypingIntervalRef.current) {
      clearInterval(chatTypingIntervalRef.current);
      chatTypingIntervalRef.current = null;
    }
    if (autoHighlightTimerRef.current) {
      clearTimeout(autoHighlightTimerRef.current);
      autoHighlightTimerRef.current = null;
    }
    highlightTimersRef.current.forEach(timer => {
      if (typeof timer === 'function') {
        timer(); // Call cleanup function for animation frames
      } else if (timer) {
        clearTimeout(timer);
      }
    });
    highlightTimersRef.current = [];
    
    // Clear selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    window.phrazeSavedSelectionRange = null;
    
    // Remove any toolbars, popups, and cards
    const toolbars = document.querySelectorAll('.HighlightPopup');
    toolbars.forEach(toolbar => toolbar.remove());
    const annotationPopups = document.querySelectorAll('.annotation-popup-demo');
    annotationPopups.forEach(popup => popup.remove());
    const unifiedCards = document.querySelectorAll('.unified-annotation-card-demo');
    unifiedCards.forEach(card => card.remove());
    
    // Reset state
    setMessages(isStatic ? staticMessages : []);
    setShowWelcome(isStatic ? false : true);
    setIsTyping(false);
    setWelcomeInputValue('');
    setChatInputValue('');
    setHighlights([]);
    setIsAnimating(false);
    setHighlightingInProgress(false);
    prevIsActiveRef.current = false;
    
    // Trigger restart by incrementing key
    setRestartKey(prev => prev + 1);
  };
  
  // Store restart function in ref for parent access
  useEffect(() => {
    if (!isStatic) {
      restartFunctionRef.current = handleRestart;
    }
  }, [isStatic, staticMessages]);

  // Reset and restart animation when card becomes active (skip if static)
  useEffect(() => {
    if (isStatic) return; // Don't run animations for static version
    if (isActive) {
      // Clear any existing timers and intervals
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      if (welcomeTypingIntervalRef.current) {
        clearInterval(welcomeTypingIntervalRef.current);
        welcomeTypingIntervalRef.current = null;
      }
      if (chatTypingIntervalRef.current) {
        clearInterval(chatTypingIntervalRef.current);
        chatTypingIntervalRef.current = null;
      }
      
      // Reset state
      setMessages([]);
      setShowWelcome(true);
      setIsTyping(false);
      setWelcomeInputValue('');
      setChatInputValue('');
      
      // Start animation after a short delay
      animationTimerRef.current = setTimeout(() => {
        const firstMessage = 'What are the best practices for training neural networks?';
        typeWelcomeInput(firstMessage, () => {
          // After typing in welcome box, wait a bit then hide welcome and continue
          setTimeout(() => {
            setShowWelcome(false);
            // Add the user message to the messages array
            setMessages([{ role: 'user', content: firstMessage, isTyping: false }]);
            setTimeout(() => {
              typeMessage('Great question! A few best practices:\n\n1) Clean, balanced data\n2) Normalize/standardize inputs\n3) Tune learning rate with scheduling\n4) Use regularization (dropout/L2/early stopping)\n5) Try different batch sizes\n6) Start simple, iterate the architecture', 'assistant', () => {
                setTimeout(() => {
                  const secondUserMessage = 'How do I prevent overfitting?';
                  typeChatInput(secondUserMessage, () => {
                    setTimeout(() => {
                      setChatInputValue('');
                      setMessages((prev) => [...prev, { role: 'user', content: secondUserMessage, isTyping: false }]);
                      setTimeout(() => {
                        typeMessage('Common strategies to reduce overfitting:\n\n• Dropout (e.g., 0.2–0.5)\n• Data augmentation\n• Early stopping on validation\n• L1/L2 regularization\n• Cross-validation\n• Reduce model complexity', 'assistant');
                      }, 500);
                    }, 300);
                  });
                }, 700);
              });
            }, 300);
          }, 500);
        });
      }, 900);
    }
    
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
      if (welcomeTypingIntervalRef.current) {
        clearInterval(welcomeTypingIntervalRef.current);
      }
      if (chatTypingIntervalRef.current) {
        clearInterval(chatTypingIntervalRef.current);
      }
    };
  }, [isActive, restartKey]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isModelDropdownOpen && !e.target.closest('.model-dropdown-container')) {
        setIsModelDropdownOpen(false);
      }
    };
    if (isModelDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isModelDropdownOpen]);

  // Helper function to render message content with highlights
  const renderMessageWithHighlights = (messageIndex, content) => {
    const messageHighlights = highlights.filter(h => h.messageIndex === messageIndex);
    
    if (messageHighlights.length === 0) {
      return <span>{content}</span>;
    }

    // Sort highlights by start position
    const sortedHighlights = [...messageHighlights].sort((a, b) => a.start - b.start);
    
    // Build array of text segments and highlights
    const parts = [];
    let lastIndex = 0;
    
    sortedHighlights.forEach((highlight) => {
      // Add text before highlight
      if (highlight.start > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, highlight.start)
        });
      }
      
      // Add highlighted text
      parts.push({
        type: 'highlight',
        content: content.substring(highlight.start, highlight.end),
        color: highlight.color
      });
      
      lastIndex = highlight.end;
    });
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex)
      });
    }
    
    // Find the index of the first highlight for animation
    const firstHighlightIndex = parts.findIndex(p => p.type === 'highlight');
    
    return parts.map((part, idx) => {
      if (part.type === 'highlight') {
        // Check if this is the first highlight and animation is in progress
        const isNewHighlight = highlightingInProgress && idx === firstHighlightIndex;
        
        return (
          <span
            key={idx}
            className={`auto-highlight-animation ${isNewHighlight ? 'animating' : ''}`}
            style={{
              backgroundColor: part.color,
              padding: '2px 0',
              borderRadius: '2px',
              position: 'relative',
              display: 'inline',
              ...(isNewHighlight ? {
                '--anim-color': part.color
              } : {})
            }}
          >
            {part.content}
          </span>
        );
      }
      return <span key={idx}>{part.content}</span>;
    });
  };

  // Restart function for static demo (highlighting animation)
  const handleStaticRestart = () => {
    // Clear all timers
    if (autoHighlightTimerRef.current) {
      clearTimeout(autoHighlightTimerRef.current);
      autoHighlightTimerRef.current = null;
    }
    highlightTimersRef.current.forEach(timer => {
      if (typeof timer === 'function') {
        timer(); // Call cleanup function for animation frames
      } else if (timer) {
        clearTimeout(timer);
      }
    });
    highlightTimersRef.current = [];
    
    // Clear selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    window.phrazeSavedSelectionRange = null;
    
    // Remove any toolbars, popups, and cards
    const toolbars = document.querySelectorAll('.HighlightPopup');
    toolbars.forEach(toolbar => toolbar.remove());
    const annotationPopups = document.querySelectorAll('.annotation-popup-demo');
    annotationPopups.forEach(popup => popup.remove());
    const unifiedCards = document.querySelectorAll('.unified-annotation-card-demo');
    unifiedCards.forEach(card => card.remove());
    
    // Reset state (but preserve highlights if showFinalState is true)
    if (!showFinalState) {
      setHighlights([]);
    }
    setIsAnimating(false);
    setHighlightingInProgress(false);
    prevIsActiveRef.current = false;
    
    // Trigger restart by incrementing key
    setRestartKey(prev => prev + 1);
  };
  
  // Store restart function in ref for parent access
  useEffect(() => {
    if (isStatic) {
      restartFunctionRef.current = handleStaticRestart;
    } else {
      restartFunctionRef.current = handleRestart;
    }
  }, [isStatic, staticMessages]);

  // Show unified annotation card for final state (third panel - Collaborate & Share)
  useEffect(() => {
    if (!showFinalState || !isActive) {
      // Clean up when panel is inactive
      if (rightPanelRef.current) {
        rightPanelRef.current.querySelectorAll('.unified-annotation-card-demo').forEach(card => card.remove());
      }
      return;
    }
    
    const root = rightPanelRef.current;
    if (!root) return;
    
    // Wait for this panel's DOM to be ready
    const showCard = () => {
      setTimeout(() => {
        // Scope to this panel only
        const messageContainer = root.querySelector('[data-message-index="3"]');
        if (!messageContainer) {
          setTimeout(showCard, 100);
          return;
        }

        // Ensure the container is positioned
        root.style.position = root.style.position || 'relative';

        // Remove any existing unified cards within this panel
        root.querySelectorAll('.unified-annotation-card-demo').forEach(card => card.remove());

        // Helper function to get image path
        const getImagePath = (filename) => {
          try {
            return require(`../../public/assets/${filename}`);
          } catch (error) {
            return `https://api.dicebear.com/7.x/notionists/svg?seed=${filename.split('.')[0]}&backgroundColor=ffdfbf`;
          }
        };

        // Create unified annotation card - using exact same styles as second panel
        const annotationCard = document.createElement('div');
        annotationCard.className = 'unified-annotation-card-demo active';
        annotationCard.style.position = 'absolute';
        annotationCard.style.zIndex = '1000000000';
        annotationCard.style.backgroundColor = 'white';
        annotationCard.style.borderRadius = '8px';
        annotationCard.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.12)';
        annotationCard.style.border = '1px solid #e5e7eb';
        annotationCard.style.padding = '12px';
        annotationCard.style.minWidth = '240px';
        annotationCard.style.maxWidth = '240px';
        annotationCard.style.width = '240px';
        annotationCard.style.opacity = '1';
        annotationCard.style.transition = 'opacity 0.3s ease';
        annotationCard.style.visibility = 'visible';
        annotationCard.style.pointerEvents = 'auto';
        annotationCard.style.display = 'block';
        annotationCard.style.transform = 'none';

        // Create card header
        const cardHeader = document.createElement('div');
        cardHeader.className = 'annotation-card-header';
        cardHeader.style.display = 'flex';
        cardHeader.style.flexDirection = 'column';
        cardHeader.style.alignItems = 'flex-start';
        cardHeader.style.marginBottom = '12px';
        cardHeader.style.gap = '8px';
        cardHeader.style.minWidth = '0';

        // Create profile section
        const profileSection = document.createElement('div');
        profileSection.className = 'profile-section';
        profileSection.style.display = 'flex';
        profileSection.style.alignItems = 'center';
        profileSection.style.gap = '6px';
        profileSection.style.flexShrink = '0';
        profileSection.style.minWidth = '0';

        // Profile image
        const profileImg = document.createElement('img');
        profileImg.className = 'profile-image';
        profileImg.src = getImagePath('alex.png');
        profileImg.alt = '';
        profileImg.style.width = '28px';
        profileImg.style.height = '28px';
        profileImg.style.borderRadius = '50%';
        profileImg.style.objectFit = 'cover';
        profileImg.style.border = '1px solid #e5e7eb';

        // Username
        const username = document.createElement('span');
        username.className = 'username';
        username.textContent = 'alex';
        username.style.fontSize = '13px';
        username.style.fontWeight = '600';
        username.style.color = '#374151';
        username.style.whiteSpace = 'nowrap';
        username.style.lineHeight = '1.2';

        profileSection.appendChild(profileImg);
        profileSection.appendChild(username);
        cardHeader.appendChild(profileSection);

        // Create labels section
        const labelsSection = document.createElement('div');
        labelsSection.className = 'labels-section';
        labelsSection.style.width = '100%';
        labelsSection.style.marginBottom = '4px';
        labelsSection.style.minHeight = '16px';
        labelsSection.style.boxSizing = 'border-box';

        // Labels header
        const labelsHeader = document.createElement('div');
        labelsHeader.className = 'section-header';
        labelsHeader.textContent = 'Labels';
        labelsHeader.style.fontSize = '11px';
        labelsHeader.style.fontWeight = '600';
        labelsHeader.style.color = '#6b7280';
        labelsHeader.style.letterSpacing = '0.05em';
        labelsHeader.style.marginBottom = '8px';
        labelsHeader.style.paddingBottom = '4px';
        labelsHeader.style.borderBottom = '1px solid rgba(0, 0, 0, 0.06)';
        labelsHeader.style.height = '20px';
        labelsHeader.style.lineHeight = '20px';
        labelsSection.appendChild(labelsHeader);

        // Labels container
        const labelsContainer = document.createElement('div');
        labelsContainer.className = 'labels-container';
        labelsContainer.style.display = 'flex';
        labelsContainer.style.flexWrap = 'wrap';
        labelsContainer.style.gap = '2px';
        labelsContainer.style.width = '100%';
        labelsContainer.style.alignItems = 'flex-start';
        labelsContainer.style.maxWidth = '100%';
        labelsContainer.style.overflow = 'hidden';
        labelsContainer.style.minHeight = '16px';
        labelsContainer.style.boxSizing = 'border-box';

        // Add Reinforcement label pill
        const labelPill = document.createElement('span');
        labelPill.className = 'label-pill';
        labelPill.textContent = 'Reinforcement';
        labelPill.style.padding = '3px 6px';
        labelPill.style.borderRadius = '8px';
        labelPill.style.fontSize = '10px';
        labelPill.style.fontWeight = '700';
        labelPill.style.textTransform = 'lowercase';
        labelPill.style.whiteSpace = 'nowrap';
        labelPill.style.display = 'inline-flex';
        labelPill.style.alignItems = 'center';
        labelPill.style.gap = '3px';
        labelPill.style.lineHeight = '1';
        labelPill.style.maxWidth = '100%';
        labelPill.style.overflow = 'hidden';
        labelPill.style.textOverflow = 'ellipsis';
        labelPill.style.flexShrink = '1';
        labelPill.style.minWidth = '0';
        labelPill.style.backgroundColor = '#f0f4ff';
        labelPill.style.color = '#4b5563';
        labelPill.style.border = '1px solid #d1d5db';
        labelsContainer.appendChild(labelPill);
        labelsSection.appendChild(labelsContainer);
        cardHeader.appendChild(labelsSection);
        annotationCard.appendChild(cardHeader);

        // Create card footer
        const cardFooter = document.createElement('div');
        cardFooter.className = 'annotation-card-footer';
        cardFooter.style.display = 'flex';
        cardFooter.style.justifyContent = 'space-between';
        cardFooter.style.alignItems = 'center';
        cardFooter.style.marginTop = '8px';
        cardFooter.style.paddingTop = '8px';
        cardFooter.style.borderTop = '1px solid #e5e7eb';

        // Add note button (plus icon)
        const addNoteBtn = document.createElement('button');
        addNoteBtn.className = 'add-note-btn';
        addNoteBtn.setAttribute('title', 'Add note');
        addNoteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 11h-6V5a1 1 0 0 0-2 0v6H5a1 1 0 0 0 0 2h6v6a1 1 0 0 0 2 0v-6h6a1 1 0 0 0 0-2Z"></path></svg>';
        cardFooter.appendChild(addNoteBtn);

        // Attach highlight button (paperclip icon)
        const attachBtn = document.createElement('button');
        attachBtn.className = 'attach-highlight-btn';
        attachBtn.setAttribute('title', 'Attach to chat');
        attachBtn.style.display = 'inline-block';
        attachBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 26 26"><path fill="currentColor" d="M19.719 2.063a3.96 3.96 0 0 0-1.157.218c-1.499.505-2.785 1.66-4.062 2.938l-8.25 8.25c-.733.733-1.298 1.627-1.469 2.687a3.694 3.694 0 0 0 1.063 3.188a3.691 3.691 0 0 0 3.25 1.031c1.058-.19 1.944-.757 2.625-1.438l9.062-9.062a1 1 0 1 0-1.406-1.406l-9.063 9.062c-.43.43-1.024.779-1.562.875c-.538.096-.996.035-1.5-.468c-.525-.525-.581-.966-.5-1.47c.081-.503.397-1.084.906-1.593l8.25-8.25c1.21-1.209 2.367-2.13 3.281-2.438c.915-.307 1.571-.241 2.625.813c.788.787 1.626 1.497 1.844 2.219c.11.36.11.72-.125 1.312c-.234.592-.745 1.402-1.718 2.375c-4.148 4.15-7.332 7.332-9.063 9.063c-1.537 1.537-2.989 2.563-4.281 2.843c-1.293.281-2.52-.018-4.125-1.625c-1.607-1.607-2.169-3.163-2-4.78c.168-1.618 1.153-3.373 2.969-5.188c2.196-2.196 6.78-6.406 6.78-6.406a1 1 0 1 0-1.343-1.47S6.158 7.5 3.875 9.782C1.852 11.804.578 13.978.344 16.22c-.234 2.24.674 4.455 2.594 6.375s3.992 2.61 5.937 2.187c1.945-.422 3.63-1.755 5.281-3.406c1.731-1.73 4.915-4.913 9.063-9.063c1.1-1.1 1.812-2.083 2.187-3.03c.375-.949.39-1.884.157-2.657c-.467-1.545-1.72-2.408-2.344-3.031c-.716-.716-1.508-1.168-2.313-1.375a4.315 4.315 0 0 0-1.187-.156z"></path></svg>';
        cardFooter.appendChild(attachBtn);

        // Delete highlight button (x icon)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-highlight-btn';
        deleteBtn.setAttribute('title', 'Delete highlight');
        deleteBtn.textContent = '✕';
        cardFooter.appendChild(deleteBtn);

        annotationCard.appendChild(cardHeader);
        annotationCard.appendChild(cardFooter);

        // Position the card with fixed coordinates
        annotationCard.style.left = '339.5px';
        annotationCard.style.top = '210px';
        annotationCard.style.transform = 'none';

        // Append to this panel
        root.appendChild(annotationCard);
      }, 300);
    };
    
    showCard();
    
    return () => {
      if (rightPanelRef.current) {
        rightPanelRef.current.querySelectorAll('.unified-annotation-card-demo').forEach(card => card.remove());
      }
    };
  }, [showFinalState, isActive]);

  // Auto-highlight animation for static demo
  useEffect(() => {
    if (!isStatic) return;
    if (!messages.length) return;
    
    // Only run when transitioning from inactive to active
    const wasActive = prevIsActiveRef.current;
    const isNowActive = isActive;
    prevIsActiveRef.current = isActive;

    // Only trigger animation when panel becomes active (transition from false to true)
    if (!isNowActive || wasActive) {
      // If panel becomes inactive, clear all timers and reset
      if (!isNowActive && wasActive) {
        if (autoHighlightTimerRef.current) {
          clearTimeout(autoHighlightTimerRef.current);
          autoHighlightTimerRef.current = null;
        }
        // Clear all highlight timers
        highlightTimersRef.current.forEach(timer => {
          if (timer) clearTimeout(timer);
        });
        highlightTimersRef.current = [];
        // Clear selection
        const selection = window.getSelection();
        selection.removeAllRanges();
        window.phrazeSavedSelectionRange = null;
        setIsAnimating(false);
        setHighlightingInProgress(false);
        // Reset highlights when panel becomes inactive
        setHighlights([]);
      }
      return;
    }

    // Find the strategies message
    const strategiesMessageIndex = messages.findIndex(
      msg => msg.role === 'assistant' && 
      (msg.content.includes('strategies') || msg.content.includes('overfitting'))
    );

    if (strategiesMessageIndex === -1) return;

    // Clear any existing timers
    if (autoHighlightTimerRef.current) {
      clearTimeout(autoHighlightTimerRef.current);
    }
    // Clear all highlight timers
    highlightTimersRef.current.forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    highlightTimersRef.current = [];
    // Clear selection
    const selection = window.getSelection();
    selection.removeAllRanges();
    window.phrazeSavedSelectionRange = null;

    // Reset highlights when panel becomes active
    setHighlights([]);
    setIsAnimating(false);
    setHighlightingInProgress(false);

    // Wait a bit after panel becomes active, then start animation
    const startDelay = 2000; // 2 seconds delay
    setIsAnimating(true);

    autoHighlightTimerRef.current = setTimeout(() => {
      const message = messages[strategiesMessageIndex];
      const messageContent = message.content;

      // Find the start and end of the entire section to highlight as one continuous highlight
      const startText = 'Common strategies to reduce overfitting:';
      const endText = 'Reduce model complexity';
      
      const startIndex = messageContent.indexOf(startText);
      if (startIndex === -1) return;
      
      // Find the end - look for the last bullet point
      const lastBulletText = `• ${endText}`;
      let endIndex = messageContent.indexOf(lastBulletText);
      if (endIndex === -1) {
        // Try without bullet
        endIndex = messageContent.indexOf(endText);
        if (endIndex !== -1) {
          endIndex = endIndex + endText.length;
        }
      } else {
        endIndex = endIndex + lastBulletText.length;
      }
      
      if (endIndex === -1 || endIndex <= startIndex) return;

      const totalLength = endIndex - startIndex;
      const animationDuration = 1500; // 1.5 seconds for smooth, natural selection
      let animationStartTime = null;
      let animationFrameId = null;

      // Phase 1: Progressive left-to-right selection animation using requestAnimationFrame
      const selectionTimer = setTimeout(() => {
        // Find the message element in the DOM
        const messageContainer = document.querySelector(`[data-message-index="${strategiesMessageIndex}"]`);
        if (!messageContainer) return;

        const messageTextElement = messageContainer.querySelector('[data-message-text]');
        if (!messageTextElement) return;

        // Function to create a range for a given end position
        const createRangeForPosition = (startPos, endPos) => {
          const range = document.createRange();
          
          // Walk through the DOM to find the correct text nodes
          const walker = document.createTreeWalker(
            messageTextElement,
            NodeFilter.SHOW_TEXT,
            null
          );

          let currentPos = 0;
          let startNode = null;
          let startOffset = 0;
          let endNode = null;
          let endOffset = 0;

          let node;
          while (node = walker.nextNode()) {
            const nodeLength = node.textContent.length;
            
            // Check if start position is in this node
            if (!startNode && currentPos + nodeLength >= startPos) {
              startNode = node;
              startOffset = startPos - currentPos;
            }
            
            // Check if current end position is in this node
            if (!endNode && currentPos + nodeLength >= endPos) {
              endNode = node;
              endOffset = endPos - currentPos;
              break;
            }
            
            currentPos += nodeLength;
          }

          if (startNode && endNode) {
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            return range;
          }
          return null;
        };

        // Smooth easing function (ease-in-out cubic for natural feel)
        const easeInOutCubic = (t) => {
          return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };

        // Progressive selection animation using requestAnimationFrame for smoothness
        const animateSelection = (timestamp) => {
          if (!animationStartTime) {
            animationStartTime = timestamp;
          }

          const elapsed = timestamp - animationStartTime;
          const progress = Math.min(elapsed / animationDuration, 1);
          
          // Use smooth easing function for natural selection feel
          const easedProgress = easeInOutCubic(progress);
          const currentEndIndex = startIndex + Math.floor(totalLength * easedProgress);

          // Create range for current position
          const range = createRangeForPosition(startIndex, currentEndIndex);
          
          if (range) {
            // Apply selection - this will trigger the toolbar to appear
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
          }

          if (progress < 1) {
            // Continue animation
            animationFrameId = requestAnimationFrame(animateSelection);
          } else {
            // Animation complete, save the final range for later use
            const finalRange = createRangeForPosition(startIndex, endIndex);
            if (finalRange) {
              window.phrazeSavedSelectionRange = finalRange.cloneRange();
            }
            
            // Phase 2: Wait for toolbar to appear AFTER selection completes, then click pen icon
            const toolbarWaitTimer = setTimeout(() => {
              startToolbarAnimation();
            }, 1500); // Wait 1.5 seconds after selection completes
            highlightTimersRef.current.push(toolbarWaitTimer);
          }
        };

        // Start the smooth selection animation
        animationFrameId = requestAnimationFrame(animateSelection);
        
        // Store animation frame ID for cleanup
        if (animationFrameId) {
          highlightTimersRef.current.push(() => {
            if (animationFrameId) {
              cancelAnimationFrame(animationFrameId);
            }
          });
        }

        // Function to show annotation popup
        const showAnnotationPopup = () => {
          // Remove any existing annotation popups
          const existingPopups = document.querySelectorAll('.annotation-popup-demo');
          existingPopups.forEach(popup => popup.remove());

          // Get the highlighted text
          const highlightedText = messageContent.substring(startIndex, endIndex);
          
          // Extract just the first part before the colon or first line for preview
          const previewText = highlightedText.split(':')[0] + '...';

          // Find the message element in the DOM
          const messageContainer = document.querySelector(`[data-message-index="${strategiesMessageIndex}"]`);
          if (!messageContainer) return;

          // Find the right panel container (75% width chat area)
          let rightPanel = messageContainer.closest('[style*="width: 75%"]') || 
                            messageContainer.closest('[style*="width:75%"]');
          
          if (!rightPanel) {
            // Fallback: try to find by structure
            let parent = messageContainer.parentElement;
            while (parent && parent !== document.body) {
              const style = window.getComputedStyle(parent);
              if (style.width === '75%' || parent.style.width === '75%') {
                rightPanel = parent;
                break;
              }
              parent = parent.parentElement;
            }
          }

          // Create the annotation popup
          const annotationPopup = document.createElement('div');
          annotationPopup.className = 'annotation-popup annotation-popup-demo';
          annotationPopup.style.position = 'absolute';
          annotationPopup.style.zIndex = '1000000001';
          annotationPopup.style.backgroundColor = '#fbfbfb';
          annotationPopup.style.border = '1px solid #e5e7eb';
          annotationPopup.style.borderRadius = '12px';
          annotationPopup.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
          annotationPopup.style.padding = '20px';
          annotationPopup.style.width = '360px';
          annotationPopup.style.maxWidth = '360px';
          annotationPopup.style.opacity = '0';
          annotationPopup.style.transition = 'opacity 0.3s ease';

          // Create close button
          const closeButton = document.createElement('button');
          closeButton.className = 'annotation-close-btn';
          closeButton.innerHTML = '&times;';
          closeButton.title = 'Close';
          closeButton.style.position = 'absolute';
          closeButton.style.top = '16px';
          closeButton.style.right = '16px';
          closeButton.style.background = 'none';
          closeButton.style.border = 'none';
          closeButton.style.fontSize = '20px';
          closeButton.style.color = '#9ca3af';
          closeButton.style.cursor = 'pointer';
          closeButton.style.padding = '4px';
          closeButton.style.borderRadius = '4px';
          closeButton.style.width = '24px';
          closeButton.style.height = '24px';
          closeButton.style.display = 'flex';
          closeButton.style.alignItems = 'center';
          closeButton.style.justifyContent = 'center';
          closeButton.style.transition = 'all 0.2s ease';
          closeButton.addEventListener('click', () => {
            annotationPopup.style.opacity = '0';
            setTimeout(() => annotationPopup.remove(), 300);
          });
          closeButton.addEventListener('mouseenter', () => {
            closeButton.style.backgroundColor = '#f3f4f6';
            closeButton.style.color = '#6b7280';
          });
          closeButton.addEventListener('mouseleave', () => {
            closeButton.style.backgroundColor = 'transparent';
            closeButton.style.color = '#9ca3af';
          });
          annotationPopup.appendChild(closeButton);

          // Create header section
          const headerSection = document.createElement('div');
          headerSection.style.display = 'flex';
          headerSection.style.alignItems = 'center';
          headerSection.style.justifyContent = 'flex-start';
          headerSection.style.gap = '10px';
          headerSection.style.marginTop = '-8px';
          headerSection.style.marginBottom = '24px';
          headerSection.style.paddingBottom = '16px';
          headerSection.style.borderBottom = '2px solid #e5e7eb';
          headerSection.style.fontSize = '14px';
          headerSection.style.fontWeight = '500';
          headerSection.style.color = '#6b7280';

          // Create annotation icon
          const annotationIcon = document.createElement('span');
          annotationIcon.style.display = 'flex';
          annotationIcon.style.alignItems = 'center';
          annotationIcon.style.justifyContent = 'center';
          annotationIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" color="currentColor"><path d="m14.6 20.474l-6.966 1.293c-1.336.248-2.004.372-2.389-.012c-.384-.385-.26-1.053-.012-2.39L6.526 12.4c.208-1.117.311-1.675.68-2.013c.368-.337 1.041-.403 2.388-.535C10.892 9.725 12.12 9.28 13.4 8l5.6 5.6c-1.28 1.28-1.725 2.508-1.853 3.806c-.131 1.347-.197 2.02-.535 2.389c-.337.368-.896.471-2.012.679"/><path d="M13 16.21a2.66 2.66 0 0 1-1.474-.736m0 0A2.66 2.66 0 0 1 10.79 14m.736 1.474L6 21m7.5-13c.633-.934 1.99-2.839 3.261-2.99c.868-.104 1.586.615 3.023 2.052l.154.154c1.437 1.437 2.156 2.155 2.052 3.023c-.151 1.27-2.056 2.628-2.99 3.261M5 8V2M2 5h6"/></g></svg>';

          // Create header text
          const headerText = document.createElement('span');
          headerText.textContent = 'Add Annotation';
          headerText.style.letterSpacing = '-0.025em';
          headerText.style.marginTop = '2px';

          headerSection.appendChild(annotationIcon);
          headerSection.appendChild(headerText);

          // Spacer to push color control to the right
          const headerSpacer = document.createElement('div');
          headerSpacer.style.flex = '1';
          headerSection.appendChild(headerSpacer);

          // Color picker (compact swatch)
          const colorWrapper = document.createElement('div');
          colorWrapper.style.position = 'relative';
          colorWrapper.style.display = 'inline-block';
          colorWrapper.style.userSelect = 'none';

          const swatch = document.createElement('div');
          swatch.style.width = '18px';
          swatch.style.height = '18px';
          swatch.style.borderRadius = '50%';
          swatch.style.border = '1px solid #d1d5db';
          swatch.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
          swatch.style.background = '#FFF176';
          swatch.title = 'Highlight color: yellow';

          colorWrapper.appendChild(swatch);
          headerSection.appendChild(colorWrapper);
          annotationPopup.appendChild(headerSection);

          // Create selected text preview section
          const selectedTextSection = document.createElement('div');
          selectedTextSection.style.marginBottom = '12px';

          const selectedTextLabel = document.createElement('div');
          selectedTextLabel.textContent = 'Selected text:';
          selectedTextLabel.style.fontSize = '13px';
          selectedTextLabel.style.fontWeight = '500';
          selectedTextLabel.style.color = '#6b7280';
          selectedTextLabel.style.marginBottom = '6px';
          selectedTextSection.appendChild(selectedTextLabel);

          const selectedTextPreview = document.createElement('div');
          selectedTextPreview.style.padding = '8px';
          selectedTextPreview.style.backgroundColor = '#f8f9fa';
          selectedTextPreview.style.border = '1px solid #e9ecef';
          selectedTextPreview.style.borderRadius = '8px';
          selectedTextPreview.style.fontSize = '14px';
          selectedTextPreview.style.color = '#495057';
          selectedTextPreview.style.lineHeight = '1.4';
          selectedTextPreview.style.maxHeight = '100px';
          selectedTextPreview.style.overflowY = 'auto';
          selectedTextPreview.style.wordWrap = 'break-word';
          selectedTextPreview.style.fontStyle = 'italic';
          selectedTextPreview.style.width = '100%';
          selectedTextPreview.style.boxSizing = 'border-box';
          selectedTextPreview.style.overflowWrap = 'break-word';
          selectedTextPreview.style.wordBreak = 'break-word';
          selectedTextPreview.textContent = previewText;
          selectedTextSection.appendChild(selectedTextPreview);
          annotationPopup.appendChild(selectedTextSection);

          // Create labels section
          const labelsSection = document.createElement('div');
          labelsSection.className = 'labels-section';
          labelsSection.style.marginBottom = '12px';

          const labelsHeader = document.createElement('div');
          labelsHeader.className = 'labels-header';
          labelsHeader.textContent = 'Labels:';
          labelsHeader.style.fontSize = '14px';
          labelsHeader.style.fontWeight = '500';
          labelsHeader.style.color = '#6b7280';
          labelsHeader.style.marginBottom = '8px';
          labelsSection.appendChild(labelsHeader);

          const labelsToggleBtn = document.createElement('button');
          labelsToggleBtn.className = 'labels-toggle-btn';
          labelsToggleBtn.innerHTML = 'Add Label <span>&#9662;</span>';
          labelsToggleBtn.style.width = '100%';
          labelsToggleBtn.style.padding = '8px 12px';
          labelsToggleBtn.style.background = 'white';
          labelsToggleBtn.style.border = '1px solid #e5e7eb';
          labelsToggleBtn.style.borderRadius = '6px';
          labelsToggleBtn.style.fontSize = '14px';
          labelsToggleBtn.style.color = '#374151';
          labelsToggleBtn.style.cursor = 'pointer';
          labelsToggleBtn.style.display = 'flex';
          labelsToggleBtn.style.alignItems = 'center';
          labelsToggleBtn.style.justifyContent = 'space-between';
          labelsToggleBtn.style.transition = 'all 0.2s ease';
          labelsToggleBtn.addEventListener('mouseenter', () => {
            labelsToggleBtn.style.backgroundColor = '#f9fafb';
            labelsToggleBtn.style.borderColor = '#d1d5db';
          });
          labelsToggleBtn.addEventListener('mouseleave', () => {
            labelsToggleBtn.style.backgroundColor = 'white';
            labelsToggleBtn.style.borderColor = '#e5e7eb';
          });

          const labelsDropdown = document.createElement('div');
          labelsDropdown.className = 'labels-dropdown';
          labelsDropdown.style.position = 'relative';
          labelsDropdown.style.background = 'white';
          labelsDropdown.style.border = '1px solid #e5e7eb';
          labelsDropdown.style.borderRadius = '6px';
          labelsDropdown.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
          labelsDropdown.style.zIndex = '1000';
          labelsDropdown.style.maxHeight = '200px';
          labelsDropdown.style.overflowY = 'auto';
          labelsDropdown.style.marginTop = '2px';
          labelsDropdown.style.display = 'none';

          const labelMap = {
            'ALGORITHM': ['Supervised', 'Unsupervised', 'Reinforcement'],
            'Neural Network': [],
            'Decision Tree': [],
            'Random Forest': []
          };

          Object.entries(labelMap).forEach(([labelType, options]) => {
            if (options.length > 0) {
              const labelTypeDiv = document.createElement('div');
              labelTypeDiv.className = 'label-type-header';
              labelTypeDiv.textContent = labelType;
              labelTypeDiv.style.padding = '8px 12px';
              labelTypeDiv.style.fontSize = '12px';
              labelTypeDiv.style.fontWeight = '600';
              labelTypeDiv.style.color = '#6b7280';
              labelTypeDiv.style.backgroundColor = '#f9fafb';
              labelTypeDiv.style.borderBottom = '1px solid #e5e7eb';
              labelTypeDiv.style.textTransform = 'uppercase';
              labelTypeDiv.style.letterSpacing = '0.05em';
              labelsDropdown.appendChild(labelTypeDiv);

              options.forEach(option => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'label-option';
                optionDiv.textContent = option;
                optionDiv.style.padding = '8px 12px';
                optionDiv.style.cursor = 'pointer';
                optionDiv.style.fontSize = '14px';
                optionDiv.style.color = '#374151';
                optionDiv.style.transition = 'background-color 0.2s ease';
                optionDiv.addEventListener('click', () => {
                  addSelectedLabelToDemo(option, labelType, selectedLabelsContainer);
                  labelsDropdown.style.display = 'none';
                  labelsToggleBtn.innerHTML = 'Add Label <span>&#9662;</span>';
                });
                optionDiv.addEventListener('mouseenter', () => {
                  optionDiv.style.backgroundColor = '#f3f4f6';
                });
                optionDiv.addEventListener('mouseleave', () => {
                  optionDiv.style.backgroundColor = 'transparent';
                });
                labelsDropdown.appendChild(optionDiv);
              });
            }
          });

          // Only show "Create new label" option for owners/editors
          const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
          const isOwnerOrEditor = currentUserRole === 'owner' || currentUserRole === 'editor';
          
          if (isOwnerOrEditor) {
          const createCustomLabelDiv = document.createElement('div');
          createCustomLabelDiv.className = 'create-custom-option';
          createCustomLabelDiv.textContent = 'Create new label';
          createCustomLabelDiv.style.padding = '8px 12px';
          createCustomLabelDiv.style.cursor = 'pointer';
          createCustomLabelDiv.style.borderTop = '1px solid #e5e7eb';
          createCustomLabelDiv.style.color = '#6b7280';
          createCustomLabelDiv.style.transition = 'background-color 0.2s ease';
          createCustomLabelDiv.addEventListener('click', () => {
            labelsDropdown.style.display = 'none';
            labelsToggleBtn.innerHTML = 'Add Label <span>&#9662;</span>';
          });
          createCustomLabelDiv.addEventListener('mouseenter', () => {
            createCustomLabelDiv.style.backgroundColor = '#f9fafb';
          });
          createCustomLabelDiv.addEventListener('mouseleave', () => {
            createCustomLabelDiv.style.backgroundColor = 'transparent';
          });
          labelsDropdown.appendChild(createCustomLabelDiv);
          }

          labelsSection.appendChild(labelsToggleBtn);
          labelsSection.appendChild(labelsDropdown);

          const selectedLabelsContainer = document.createElement('div');
          selectedLabelsContainer.className = 'selected-labels-container';
          selectedLabelsContainer.style.marginTop = '8px';
          selectedLabelsContainer.style.display = 'flex';
          selectedLabelsContainer.style.flexWrap = 'wrap';
          selectedLabelsContainer.style.gap = '4px';
          labelsSection.appendChild(selectedLabelsContainer);

          labelsToggleBtn.addEventListener('click', () => {
            const isVisible = labelsDropdown.style.display !== 'none';
            labelsDropdown.style.display = isVisible ? 'none' : 'block';
            labelsToggleBtn.innerHTML = isVisible ? 'Add Label <span>&#9662;</span>' : 'Add Label <span>&#9652;</span>';
          });

          document.addEventListener('click', (e) => {
            if (!labelsSection.contains(e.target)) {
              labelsDropdown.style.display = 'none';
              labelsToggleBtn.innerHTML = 'Add Label <span>&#9662;</span>';
            }
          });

          annotationPopup.appendChild(labelsSection);

          // Create codes section

          // Create annotation header
          const annotationHeader = document.createElement('div');
          annotationHeader.textContent = 'Annotation:';
          annotationHeader.style.fontSize = '14px';
          annotationHeader.style.fontWeight = '500';
          annotationHeader.style.color = '#6b7280';
          annotationHeader.style.marginBottom = '8px';
          annotationPopup.appendChild(annotationHeader);

          // Create textarea for notes
          const textarea = document.createElement('textarea');
          textarea.style.width = '100%';
          textarea.style.minHeight = '80px';
          textarea.style.padding = '12px';
          textarea.style.border = '1px solid #d1d5db';
          textarea.style.borderRadius = '8px';
          textarea.style.fontSize = '14px';
          textarea.style.fontFamily = 'inherit';
          textarea.style.resize = 'vertical';
          textarea.style.boxSizing = 'border-box';
          textarea.style.marginBottom = '16px';
          textarea.style.color = '#374151';
          textarea.style.backgroundColor = 'white';
          textarea.style.transition = 'all 0.2s ease';
          textarea.placeholder = 'Add your annotation here...';
          textarea.addEventListener('focus', () => {
            textarea.style.outline = 'none';
            textarea.style.borderColor = '#d1d5db';
            textarea.style.backgroundColor = 'white';
          });
          annotationPopup.appendChild(textarea);

          // Create button container
          const buttonContainer = document.createElement('div');
          buttonContainer.className = 'button-container';
          buttonContainer.style.display = 'flex';
          buttonContainer.style.gap = '12px';
          buttonContainer.style.justifyContent = 'flex-end';
          buttonContainer.style.alignItems = 'center';

          // Create Save button
          const saveButton = document.createElement('button');
          saveButton.className = 'add-annotation-button save-button';
          saveButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" style="margin-right: 8px;"><path fill="currentColor" d="M5 7.5A2.5 2.5 0 0 1 7.5 5H9v4.5a2.5 2.5 0 0 0 2.5 2.5h8A2.5 2.5 0 0 0 22 9.5V5.04a2.5 2.5 0 0 1 1.318.692l2.95 2.95A2.5 2.5 0 0 1 27 10.45V24.5a2.5 2.5 0 0 1-2 2.45V18.5a2.5 2.5 0 0 0-2.5-2.5h-13A2.5 2.5 0 0 0 7 18.5v8.45a2.5 2.5 0 0 1-2-2.45zM9 27v-8.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5V27zM20 5v4.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5V5zM7.5 3A4.5 4.5 0 0 0 3 7.5v17A4.5 4.5 0 0 0 7.5 29h17a4.5 4.5 0 0 0 4.5-4.5V10.45a4.5 4.5 0 0 0-1.318-3.182l-2.95-2.95A4.5 4.5 0 0 0 21.55 3z"/></svg> Add Annotation';
          saveButton.style.flex = '1';
          saveButton.style.padding = '10px 18px';
          saveButton.style.border = '1px solid #d1d5db';
          saveButton.style.borderRadius = '6px';
          saveButton.style.fontSize = '13px';
          saveButton.style.fontWeight = '400';
          saveButton.style.cursor = 'pointer';
          saveButton.style.transition = 'all 0.15s ease';
          saveButton.style.display = 'flex';
          saveButton.style.alignItems = 'center';
          saveButton.style.justifyContent = 'flex-start';
          saveButton.style.gap = '8px';
          saveButton.style.height = '38px';
          saveButton.style.lineHeight = '1';
          saveButton.style.backgroundColor = '#ffffff';
          saveButton.style.color = '#000000';
          saveButton.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
          saveButton.addEventListener('click', () => {
            annotationPopup.style.opacity = '0';
            setTimeout(() => annotationPopup.remove(), 300);
          });
          saveButton.addEventListener('mouseenter', () => {
            saveButton.style.backgroundColor = '#f8fafc';
            saveButton.style.borderColor = '#9ca3af';
            saveButton.style.transform = 'translateY(-1px)';
            saveButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          });
          saveButton.addEventListener('mouseleave', () => {
            saveButton.style.backgroundColor = '#ffffff';
            saveButton.style.borderColor = '#d1d5db';
            saveButton.style.transform = 'translateY(0)';
            saveButton.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
          });
          buttonContainer.appendChild(saveButton);
          annotationPopup.appendChild(buttonContainer);

          // Add popup to the right panel container (or message container as fallback)
          const container = rightPanel || messageContainer;
          container.style.position = 'relative'; // Ensure container is positioned
          container.appendChild(annotationPopup);

          // Position the popup with fixed coordinates
          annotationPopup.style.left = '285px';
          annotationPopup.style.top = '60px';

          // Fade in the popup
          setTimeout(() => {
            annotationPopup.style.opacity = '1';
            
            // After popup appears, animate clicking labels and selecting Reinforcement
            setTimeout(() => {
              // Phase 1: Hover effect on labels toggle button
              labelsToggleBtn.style.transition = 'all 0.2s ease';
              labelsToggleBtn.style.backgroundColor = '#f9fafb';
              labelsToggleBtn.style.borderColor = '#d1d5db';
              
              setTimeout(() => {
                // Click to open dropdown
                labelsToggleBtn.click();
                
                // Phase 2: Wait for dropdown to appear, then select Reinforcement
                setTimeout(() => {
                  // Find the Reinforcement option in the dropdown
                  const reinforcementOption = Array.from(labelsDropdown.querySelectorAll('.label-option')).find(
                    option => option.textContent.trim() === 'Reinforcement'
                  );
                  
                  if (reinforcementOption) {
                    // Hover effect on Reinforcement option
                    reinforcementOption.style.backgroundColor = '#f3f4f6';
                    
                    setTimeout(() => {
                      // Click on Reinforcement option
                      reinforcementOption.click();
                      
                      // After option is added, close popup and show unified card
                      setTimeout(() => {
                        // Close the popup
                        annotationPopup.style.opacity = '0';
                        setTimeout(() => {
                          annotationPopup.remove();
                          
                          // Show unified annotation card
                          showUnifiedAnnotationCard(strategiesMessageIndex, startIndex, endIndex);
                        }, 300);
                      }, 500); // Wait 500ms to see the label added
                    }, 600); // Wait 600ms before clicking to see the hover effect
                  }
                }, 400); // Wait 400ms for dropdown to appear and be visible
              }, 600); // Wait 600ms before clicking toggle to see hover effect
            }, 1000); // Wait 1 second after popup appears
          }, 50);
        };

        // Function to show unified annotation card after popup closes
        const showUnifiedAnnotationCard = (messageIndex, startIdx, endIdx) => {
          // Remove any existing unified cards
          const existingCards = document.querySelectorAll('.unified-annotation-card-demo');
          existingCards.forEach(card => card.remove());

          // Find the message element in the DOM
          const messageContainer = document.querySelector(`[data-message-index="${messageIndex}"]`);
          if (!messageContainer) return;

          // Find the right panel container (75% width chat area)
          let rightPanel = messageContainer.closest('[style*="width: 75%"]') || 
                            messageContainer.closest('[style*="width:75%"]');
          
          if (!rightPanel) {
            // Fallback: try to find by structure
            let parent = messageContainer.parentElement;
            while (parent && parent !== document.body) {
              const style = window.getComputedStyle(parent);
              if (style.width === '75%' || parent.style.width === '75%') {
                rightPanel = parent;
                break;
              }
              parent = parent.parentElement;
            }
          }

          const container = rightPanel || messageContainer;
          container.style.position = 'relative'; // Ensure container is positioned

          // Create unified annotation card
          const annotationCard = document.createElement('div');
          annotationCard.className = 'unified-annotation-card-demo active';
          annotationCard.style.position = 'absolute';
          annotationCard.style.zIndex = '1000000000';
          annotationCard.style.backgroundColor = 'white';
          annotationCard.style.borderRadius = '8px';
          annotationCard.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.12)';
          annotationCard.style.border = '1px solid #e5e7eb';
          annotationCard.style.padding = '12px';
          annotationCard.style.minWidth = '240px';
          annotationCard.style.maxWidth = '240px';
          annotationCard.style.width = '240px';
          annotationCard.style.opacity = '1';
          annotationCard.style.transition = 'opacity 0.3s ease';
          annotationCard.style.visibility = 'visible';
          annotationCard.style.pointerEvents = 'auto';
          annotationCard.style.display = 'block';
          annotationCard.style.transform = 'none'; // Override any transform from CSS

          // Create card header
          const cardHeader = document.createElement('div');
          cardHeader.className = 'annotation-card-header';
          cardHeader.style.display = 'flex';
          cardHeader.style.flexDirection = 'column';
          cardHeader.style.alignItems = 'flex-start';
          cardHeader.style.marginBottom = '12px';
          cardHeader.style.gap = '8px';
          cardHeader.style.minWidth = '0';

          // Create profile section
          const profileSection = document.createElement('div');
          profileSection.className = 'profile-section';
          profileSection.style.display = 'flex';
          profileSection.style.alignItems = 'center';
          profileSection.style.gap = '6px';
          profileSection.style.flexShrink = '0';
          profileSection.style.minWidth = '0';

          // Profile image
          const profileImg = document.createElement('img');
          profileImg.className = 'profile-image';
          profileImg.src = 'https://api.dicebear.com/7.x/notionists/svg?seed=User&backgroundColor=ffdfbf';
          profileImg.alt = '';
          profileImg.style.width = '28px';
          profileImg.style.height = '28px';
          profileImg.style.borderRadius = '50%';
          profileImg.style.objectFit = 'cover';
          profileImg.style.border = '1px solid #e5e7eb';

          // Username
          const username = document.createElement('span');
          username.className = 'username';
          username.textContent = 'You';
          username.style.fontSize = '13px';
          username.style.fontWeight = '600';
          username.style.color = '#374151';
          username.style.whiteSpace = 'nowrap';
          username.style.lineHeight = '1.2';

          profileSection.appendChild(profileImg);
          profileSection.appendChild(username);
          cardHeader.appendChild(profileSection);

          // Create labels section
          const labelsSection = document.createElement('div');
          labelsSection.className = 'labels-section';
          labelsSection.style.width = '100%';
          labelsSection.style.marginBottom = '4px';
          labelsSection.style.minHeight = '16px';
          labelsSection.style.boxSizing = 'border-box';

          // Labels header
          const labelsHeader = document.createElement('div');
          labelsHeader.className = 'section-header';
          labelsHeader.textContent = 'Labels';
          labelsHeader.style.fontSize = '11px';
          labelsHeader.style.fontWeight = '600';
          labelsHeader.style.color = '#6b7280';
          labelsHeader.style.letterSpacing = '0.05em';
          labelsHeader.style.marginBottom = '8px';
          labelsHeader.style.paddingBottom = '4px';
          labelsHeader.style.borderBottom = '1px solid rgba(0, 0, 0, 0.06)';
          labelsHeader.style.height = '20px';
          labelsHeader.style.lineHeight = '20px';
          labelsSection.appendChild(labelsHeader);

          // Labels container
          const labelsContainer = document.createElement('div');
          labelsContainer.className = 'labels-container';
          labelsContainer.style.display = 'flex';
          labelsContainer.style.flexWrap = 'wrap';
          labelsContainer.style.gap = '2px';
          labelsContainer.style.width = '100%';
          labelsContainer.style.alignItems = 'flex-start';
          labelsContainer.style.maxWidth = '100%';
          labelsContainer.style.overflow = 'hidden';
          labelsContainer.style.minHeight = '16px';
          labelsContainer.style.boxSizing = 'border-box';

          // Add Reinforcement label pill
          const labelPill = document.createElement('span');
          labelPill.className = 'label-pill';
          labelPill.textContent = 'Reinforcement';
          labelPill.style.padding = '3px 6px';
          labelPill.style.borderRadius = '8px';
          labelPill.style.fontSize = '10px';
          labelPill.style.fontWeight = '700';
          labelPill.style.textTransform = 'lowercase';
          labelPill.style.whiteSpace = 'nowrap';
          labelPill.style.display = 'inline-flex';
          labelPill.style.alignItems = 'center';
          labelPill.style.gap = '3px';
          labelPill.style.lineHeight = '1';
          labelPill.style.maxWidth = '100%';
          labelPill.style.overflow = 'hidden';
          labelPill.style.textOverflow = 'ellipsis';
          labelPill.style.flexShrink = '1';
          labelPill.style.minWidth = '0';
          labelPill.style.backgroundColor = '#f0f4ff';
          labelPill.style.color = '#4b5563';
          labelPill.style.border = '1px solid #d1d5db';
          labelsContainer.appendChild(labelPill);
          labelsSection.appendChild(labelsContainer);
          cardHeader.appendChild(labelsSection);

          // Create card footer
          const cardFooter = document.createElement('div');
          cardFooter.className = 'annotation-card-footer';
          cardFooter.style.display = 'flex';
          cardFooter.style.justifyContent = 'space-between';
          cardFooter.style.alignItems = 'center';
          cardFooter.style.marginTop = '8px';
          cardFooter.style.paddingTop = '8px';
          cardFooter.style.borderTop = '1px solid #e5e7eb';

          // Add note button (plus icon)
          const addNoteBtn = document.createElement('button');
          addNoteBtn.className = 'add-note-btn';
          addNoteBtn.setAttribute('title', 'Add note');
          addNoteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 11h-6V5a1 1 0 0 0-2 0v6H5a1 1 0 0 0 0 2h6v6a1 1 0 0 0 2 0v-6h6a1 1 0 0 0 0-2Z"></path></svg>';
          cardFooter.appendChild(addNoteBtn);

          // Attach highlight button (paperclip icon)
          const attachBtn = document.createElement('button');
          attachBtn.className = 'attach-highlight-btn';
          attachBtn.setAttribute('title', 'Attach to chat');
          attachBtn.style.display = 'inline-block';
          attachBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 26 26"><path fill="currentColor" d="M19.719 2.063a3.96 3.96 0 0 0-1.157.218c-1.499.505-2.785 1.66-4.062 2.938l-8.25 8.25c-.733.733-1.298 1.627-1.469 2.687a3.694 3.694 0 0 0 1.063 3.188a3.691 3.691 0 0 0 3.25 1.031c1.058-.19 1.944-.757 2.625-1.438l9.062-9.062a1 1 0 1 0-1.406-1.406l-9.063 9.062c-.43.43-1.024.779-1.562.875c-.538.096-.996.035-1.5-.468c-.525-.525-.581-.966-.5-1.47c.081-.503.397-1.084.906-1.593l8.25-8.25c1.21-1.209 2.367-2.13 3.281-2.438c.915-.307 1.571-.241 2.625.813c.788.787 1.626 1.497 1.844 2.219c.11.36.11.72-.125 1.312c-.234.592-.745 1.402-1.718 2.375c-4.148 4.15-7.332 7.332-9.063 9.063c-1.537 1.537-2.989 2.563-4.281 2.843c-1.293.281-2.52-.018-4.125-1.625c-1.607-1.607-2.169-3.163-2-4.78c.168-1.618 1.153-3.373 2.969-5.188c2.196-2.196 6.78-6.406 6.78-6.406a1 1 0 1 0-1.343-1.47S6.158 7.5 3.875 9.782C1.852 11.804.578 13.978.344 16.22c-.234 2.24.674 4.455 2.594 6.375s3.992 2.61 5.937 2.187c1.945-.422 3.63-1.755 5.281-3.406c1.731-1.73 4.915-4.913 9.063-9.063c1.1-1.1 1.812-2.083 2.187-3.03c.375-.949.39-1.884.157-2.657c-.467-1.545-1.72-2.408-2.344-3.031c-.716-.716-1.508-1.168-2.313-1.375a4.315 4.315 0 0 0-1.187-.156z"></path></svg>';
          cardFooter.appendChild(attachBtn);

          // Delete highlight button (x icon)
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'delete-highlight-btn';
          deleteBtn.setAttribute('title', 'Delete highlight');
          deleteBtn.textContent = '✕';
          cardFooter.appendChild(deleteBtn);

          annotationCard.appendChild(cardHeader);
          annotationCard.appendChild(cardFooter);

          // Add card to container
          container.appendChild(annotationCard);

          // Position the card with fixed coordinates
          annotationCard.style.left = '339.5px';
          annotationCard.style.top = '210px';
          annotationCard.style.transform = 'none';

          // Card is already visible (opacity set to 1 above)
          // No fade-in needed since it should stay visible
        };

        // Helper function to add selected label to demo popup
        const addSelectedLabelToDemo = (label, labelType, container) => {
          if (!container) return;
          
          // Check if label already exists
          const existingLabels = container.querySelectorAll('.selected-label-tag');
          for (let existingLabel of existingLabels) {
            const labelText = existingLabel.textContent.replace('×', '').trim();
            if (labelText === `${labelType}: ${label}`) {
              return; // Label already exists
            }
          }
          
          const labelTag = document.createElement('div');
          labelTag.className = 'selected-label-tag';
          labelTag.style.background = '#e5e7eb';
          labelTag.style.color = '#374151';
          labelTag.style.padding = '4px 8px';
          labelTag.style.borderRadius = '12px';
          labelTag.style.fontSize = '12px';
          labelTag.style.fontWeight = '500';
          labelTag.style.whiteSpace = 'nowrap';
          labelTag.style.lineHeight = '1.2';
          labelTag.style.display = 'flex';
          labelTag.style.alignItems = 'center';
          labelTag.style.gap = '4px';
          labelTag.style.maxWidth = '200px';
          labelTag.style.overflow = 'hidden';
          labelTag.style.textOverflow = 'ellipsis';
          labelTag.style.flexShrink = '0';
          labelTag.style.minWidth = 'fit-content';
          labelTag.innerHTML = `${labelType}: ${label}<button style="background: none; border: none; color: #6b7280; cursor: pointer; font-size: 14px; width: 16px; height: 16px; margin-left: 4px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.15s ease;">&times;</button>`;
          
          const removeBtn = labelTag.querySelector('button');
          removeBtn.addEventListener('click', () => {
            labelTag.remove();
          });
          removeBtn.addEventListener('mouseenter', () => {
            removeBtn.style.backgroundColor = '#d1d5db';
            removeBtn.style.color = '#374151';
          });
          removeBtn.addEventListener('mouseleave', () => {
            removeBtn.style.backgroundColor = 'transparent';
            removeBtn.style.color = '#6b7280';
          });
          
          container.appendChild(labelTag);
        };


        // Function to handle toolbar and pen button animation (called after selection completes)
        const startToolbarAnimation = () => {
          // Wait a moment to ensure toolbar is fully rendered
          setTimeout(() => {
            // Find the toolbar
            const toolbar = document.querySelector('.HighlightPopup');
            if (toolbar) {
              // Show annotation popup right after toolbar appears
              setTimeout(() => {
                showAnnotationPopup();
              }, 500); // Small delay after toolbar appears
            // Find the pen button - it's the last button in the toolbar (after swatch)
            const buttons = toolbar.querySelectorAll('button');
            const penBtn = buttons[buttons.length - 1]; // Last button is the pen
            
            if (penBtn && penBtn.querySelector('svg')) {
              // Phase 3: Show visual feedback - make pen button darker to show it's being hovered/ready
              setTimeout(() => {
                const originalBg = penBtn.style.background;
                const originalTransform = penBtn.style.transform;
                const originalBoxShadow = penBtn.style.boxShadow;
                
                // Hover effect - darker background
                penBtn.style.background = '#e5e7eb'; // Lighter gray for hover
                penBtn.style.transition = 'all 0.3s ease';
                
                // Phase 4: Clicking animation effect - press down
                setTimeout(() => {
                  // Press down effect
                  penBtn.style.background = '#9ca3af'; // Darker gray
                  penBtn.style.transform = 'scale(0.85)';
                  penBtn.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
                  
                  // Phase 5: Release and click
                  setTimeout(() => {
                    // Release effect
                    penBtn.style.transform = 'scale(1)';
                    penBtn.style.boxShadow = originalBoxShadow || 'none';
                    
                    // Small delay before actual click
                    setTimeout(() => {
                      // Trigger the click event - THIS is when the highlight should be applied
                      penBtn.click();
                      
                      // Keep toolbar visible after highlight is applied (don't remove it)
                      
                      // Set flag to indicate highlight is being applied (after a tiny delay to ensure state update)
                      setTimeout(() => {
                        setHighlightingInProgress(true);
                      }, 50);
                      
                      // Reset button style after click
                      setTimeout(() => {
                        penBtn.style.background = originalBg;
                        penBtn.style.transform = originalTransform;
                        
                        // Phase 6: Stop highlight animation after it completes, then stop overall animation
                        setTimeout(() => {
                          setHighlightingInProgress(false);
                          setTimeout(() => {
                            setIsAnimating(false);
                          }, 200);
                        }, 800); // Wait for highlight reveal animation to complete (0.8s)
                      }, 400);
                    }, 200); // Brief pause after release before click
                  }, 300); // Hold pressed state for 300ms
                }, 2000); // Wait 2 seconds to show hover state before clicking animation
              }, 2000); // Wait 2 seconds to show toolbar before highlighting button
            } else {
              // If toolbar/pen button not found, apply highlight directly
              const highlightColor = '#FFF176'; // Yellow
              setHighlights(prev => {
                const filtered = prev.filter(h => 
                  !(h.messageIndex === strategiesMessageIndex && 
                    ((h.start <= startIndex && h.end > startIndex) || 
                     (h.start < endIndex && h.end >= endIndex) ||
                     (h.start >= startIndex && h.end <= endIndex)))
                );
                return [...filtered, {
                  messageIndex: strategiesMessageIndex,
                  start: startIndex,
                  end: endIndex,
                  color: highlightColor
                }].sort((a, b) => {
                  if (a.messageIndex !== b.messageIndex) return a.messageIndex - b.messageIndex;
                  return a.start - b.start;
                });
              });
              setIsAnimating(false);
            }
          } else {
            // If toolbar not found, apply highlight directly
            const highlightColor = '#FFF176'; // Yellow
            setHighlights(prev => {
              const filtered = prev.filter(h => 
                !(h.messageIndex === strategiesMessageIndex && 
                  ((h.start <= startIndex && h.end > startIndex) || 
                   (h.start < endIndex && h.end >= endIndex) ||
                   (h.start >= startIndex && h.end <= endIndex)))
              );
              return [...filtered, {
                messageIndex: strategiesMessageIndex,
                start: startIndex,
                end: endIndex,
                color: highlightColor
              }].sort((a, b) => {
                if (a.messageIndex !== b.messageIndex) return a.messageIndex - b.messageIndex;
                return a.start - b.start;
              });
            });
            setIsAnimating(false);
          }
          }, 100); // Small delay to ensure toolbar is rendered
        };
      }, 0); // Start selection immediately
      highlightTimersRef.current.push(selectionTimer);
    }, startDelay);
    highlightTimersRef.current.push(autoHighlightTimerRef.current);

    return () => {
      if (autoHighlightTimerRef.current) {
        clearTimeout(autoHighlightTimerRef.current);
      }
      // Clear all highlight timers (including animation frames)
      highlightTimersRef.current.forEach(timer => {
        if (typeof timer === 'function') {
          timer(); // Call cleanup function for animation frames
        } else if (timer) {
          clearTimeout(timer);
        }
      });
      highlightTimersRef.current = [];
      // Clear selection
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      window.phrazeSavedSelectionRange = null;
      // Remove any toolbars
      const toolbars = document.querySelectorAll('.HighlightPopup');
      toolbars.forEach(toolbar => toolbar.remove());
      window.phrazeToolbarInteracting = false;
      // Remove any annotation popups
      const annotationPopups = document.querySelectorAll('.annotation-popup-demo');
      annotationPopups.forEach(popup => popup.remove());
      // Remove any unified annotation cards
      const unifiedCards = document.querySelectorAll('.unified-annotation-card-demo');
      unifiedCards.forEach(card => card.remove());
    };
  }, [isStatic, messages, isActive, restartKey]);

  // Highlighting functionality for static demo (second card)
  useEffect(() => {
    // Only enable highlighting for static demo
    if (!isStatic) return;

    function removeAllHighlightButtons() {
      if (window.phrazeToolbarInteracting) return;
      const buttons = document.querySelectorAll(".HighlightPopup");
      for (let button of buttons) {
        button.remove();
      }
    }

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        // Check if selection is within a highlightable message
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (!range) return;

        // Find the message element containing the selection
        let messageElement = range.commonAncestorContainer;
        while (messageElement && messageElement.nodeType !== 1) {
          messageElement = messageElement.parentElement;
        }
        if (!messageElement) return;

        // Check if this is an assistant message with strategies/overfitting
        const messageContainer = messageElement.closest('[data-message-index]');
        if (!messageContainer) return;

        const messageIndex = parseInt(messageContainer.getAttribute('data-message-index'));
        const message = messages[messageIndex];
        
        if (!message || message.role !== 'assistant') return;
        if (!message.content.includes('strategies') && !message.content.includes('overfitting')) return;

        removeAllHighlightButtons();
        
        // Preserve selection
        try {
          if (selection.rangeCount > 0) {
            window.phrazeSavedSelectionRange = selection.getRangeAt(0).cloneRange();
          }
        } catch (_) {}

        // Create toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'HighlightPopup';
        toolbar.style.position = 'absolute';
        toolbar.style.display = 'flex';
        toolbar.style.alignItems = 'center';
        toolbar.style.gap = '8px';
        toolbar.style.padding = '6px 8px';
        toolbar.style.background = '#ffffff';
        toolbar.style.border = '1px solid #e5e7eb';
        toolbar.style.borderRadius = '9999px';
        toolbar.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)';
        toolbar.style.zIndex = '1000000002';
        toolbar.style.opacity = '1';
        toolbar.style.transition = 'none';

        // Mark interaction state
        toolbar.addEventListener('mouseenter', () => { window.phrazeToolbarInteracting = true; });
        toolbar.addEventListener('mouseleave', () => { window.phrazeToolbarInteracting = false; });
        toolbar.addEventListener('mousedown', (e) => { window.phrazeToolbarInteracting = true; e.preventDefault(); });
        toolbar.addEventListener('mouseup', () => { setTimeout(() => { window.phrazeToolbarInteracting = false; }, 100); });

        // Color swatch
        const swatch = document.createElement('div');
        swatch.style.width = '18px';
        swatch.style.height = '18px';
        swatch.style.borderRadius = '50%';
        swatch.style.border = '1px solid #d1d5db';
        swatch.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
        const lastHex = localStorage.getItem('phrazeLastHighlightColorHex') || '#FFF176';
        swatch.style.background = lastHex;
        swatch.title = 'Choose highlight color';

        // Color palette
        const palette = document.createElement('div');
        palette.style.position = 'absolute';
        palette.style.top = '36px';
        palette.style.left = '0px';
        palette.style.background = '#ffffff';
        palette.style.border = '1px solid #e5e7eb';
        palette.style.borderRadius = '8px';
        palette.style.padding = '8px';
        palette.style.display = 'none';
        palette.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)';

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(6, 24px)';
        grid.style.gap = '8px';
        const presets = [
          { name: 'yellow', hex: '#FFF176' },
          { name: 'blue', hex: '#90CAF9' },
          { name: 'green', hex: '#A5D6A7' },
          { name: 'red', hex: '#EF9A9A' },
          { name: 'purple', hex: '#CE93D8' },
          { name: 'orange', hex: '#FFCC80' }
        ];
        presets.forEach(({ name, hex }) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.style.width = '24px';
          btn.style.height = '24px';
          btn.style.borderRadius = '50%';
          btn.style.border = '1px solid #d1d5db';
          btn.style.background = hex;
          btn.style.cursor = 'pointer';
          btn.setAttribute('aria-label', `Select ${name} highlight color`);
          btn.addEventListener('mousedown', (e) => { e.preventDefault(); });
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              localStorage.setItem('phrazeLastHighlightColorHex', hex);
              localStorage.setItem('phrazeLastHighlightColorName', name);
            } catch (_) {}
            swatch.style.background = hex;
            palette.style.display = 'none';
          });
          grid.appendChild(btn);
        });
        palette.appendChild(grid);

        function togglePalette() {
          palette.style.display = palette.style.display === 'none' ? 'block' : 'none';
        }
        swatch.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          togglePalette();
        });
        document.addEventListener('click', (e) => {
          if (!toolbar.contains(e.target)) {
            palette.style.display = 'none';
          }
        });


        // Pen button
        const penBtn = document.createElement('button');
        penBtn.style.width = '30px';
        penBtn.style.height = '30px';
        penBtn.style.borderRadius = '9999px';
        penBtn.style.border = '0px';
        penBtn.style.background = '#f3f4f6';
        penBtn.style.cursor = 'pointer';
        penBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style="width: 14px; height: 14px;"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>`;
        
        // Store references in closure for pen button click handler
        const currentMessageIndex = messageIndex;
        const currentMessage = message;
        const currentMessageElement = messageElement;
        
        // Declare toolbar timeout variable for auto-hide
        let toolbarTimeout = null;
        
        penBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Restore selection
          try {
            const sel = window.getSelection();
            if (window.phrazeSavedSelectionRange && sel) {
              sel.removeAllRanges();
              sel.addRange(window.phrazeSavedSelectionRange);
            }
          } catch (_) {}

          // Get selected text and range
          const selection = window.getSelection();
          if (!selection.rangeCount && !window.phrazeSavedSelectionRange) return;
          
          const range = window.phrazeSavedSelectionRange || selection.getRangeAt(0);
          const selectedText = range.toString();
          if (!selectedText) return;

          // Find the message element and get text offsets
          const messageContainer = currentMessageElement.closest('[data-message-index]');
          if (!messageContainer) return;
          
          const messageTextElement = messageContainer.querySelector('[data-message-text]');
          if (!messageTextElement) return;

          // Calculate start and end positions in the original text
          // The textContent of the message element should match the original message content
          // (highlights are just spans with background colors, text content is unchanged)
          const preRange = document.createRange();
          preRange.selectNodeContents(messageTextElement);
          preRange.setEnd(range.startContainer, range.startOffset);
          const textBeforeSelection = preRange.toString();
          
          let start = textBeforeSelection.length;
          let end = start + selectedText.length;
          
          // Validate that the selected text matches what we expect at this position in original message
          // If there's a mismatch (e.g., due to whitespace differences), try to find it
          const expectedText = currentMessage.content.substring(start, end);
          if (expectedText.trim() !== selectedText.trim()) {
            // Try to find the selected text in the original message
            const originalIndex = currentMessage.content.indexOf(selectedText);
            if (originalIndex !== -1) {
              start = originalIndex;
              end = originalIndex + selectedText.length;
            }
          }

          // Get selected color
          const selectedColor = swatch.style.background || '#FFF176';

          // Add highlight
          const newHighlight = {
            messageIndex: currentMessageIndex,
            start,
            end,
            color: selectedColor
          };

          setHighlights(prev => {
            // Check for overlaps and merge if needed
            const filtered = prev.filter(h => 
              !(h.messageIndex === currentMessageIndex && 
                ((h.start <= start && h.end > start) || 
                 (h.start < end && h.end >= end) ||
                 (h.start >= start && h.end <= end)))
            );
            return [...filtered, newHighlight].sort((a, b) => {
              if (a.messageIndex !== b.messageIndex) return a.messageIndex - b.messageIndex;
              return a.start - b.start;
            });
          });

          // Clear selection
          selection.removeAllRanges();
          // Clear any toolbar timeout before removing
          if (toolbarTimeout) {
            clearTimeout(toolbarTimeout);
            toolbarTimeout = null;
          }
          removeAllHighlightButtons();
        });

        toolbar.appendChild(swatch);
        toolbar.appendChild(penBtn);
        toolbar.appendChild(palette);

        // Find the right panel container (75% width chat area) to append toolbar to
        let rightPanel = messageElement.closest('[style*="width: 75%"]') || 
                          messageElement.closest('[style*="width:75%"]') ||
                          document.querySelector('[data-chat-panel]');
        
        if (!rightPanel) {
          // Fallback: try to find by structure
          let parent = messageElement.parentElement;
          while (parent && parent !== document.body) {
            const style = window.getComputedStyle(parent);
            if (style.width === '75%' || parent.style.width === '75%') {
              rightPanel = parent;
              break;
            }
            parent = parent.parentElement;
          }
        }

        const container = rightPanel || document.body;
        container.style.position = 'relative'; // Ensure container is positioned

        // Position toolbar relative to container
        const rect = range.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const toolbarWidth = 150;
        
        // Calculate position relative to container
        const relativeLeft = rect.x - containerRect.x + (rect.width / 2) - (toolbarWidth / 2);
        const relativeTop = rect.y - containerRect.y - 40;
        
        toolbar.style.left = `${relativeLeft}px`;
        toolbar.style.top = `${relativeTop}px`;
        toolbar.style.position = 'absolute';
        
        container.appendChild(toolbar);

        // Don't auto-hide toolbar - keep it visible
        // Removed auto-hide timeout and mouse leave handlers
      } else {
        if (!window.phrazeToolbarInteracting) {
          removeAllHighlightButtons();
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      removeAllHighlightButtons();
    };
  }, [isStatic, messages]);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'row',
      overflow: 'hidden',
      pointerEvents: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none'
    }}>
      {/* Replay button - positioned in bottom left corner to avoid UI elements */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (restartFunctionRef.current) {
            restartFunctionRef.current();
          }
        }}
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          zIndex: 10000,
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          border: '2px solid #d1d5db',
          backgroundColor: '#f9fafb',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'all 0.2s ease',
          pointerEvents: 'auto',
          opacity: 0.9
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f3f4f6';
          e.currentTarget.style.borderColor = '#9ca3af';
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#f9fafb';
          e.currentTarget.style.borderColor = '#d1d5db';
          e.currentTarget.style.opacity = '0.9';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Replay animation"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
          <path d="M21 3v5h-5"></path>
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
          <path d="M3 21v-5h5"></path>
        </svg>
      </button>
      {/* Left Sidebar - 25% width */}
      <div style={{
        width: '25%',
        height: '100%',
        background: '#ffffff',
        borderRight: '1px solid rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        pointerEvents: 'none',
        userSelect: 'none'
      }}>
        {/* Logo */}
        <div style={{ 
          padding: '12px 12px 0', 
          display: 'flex', 
          justifyContent: 'flex-start', 
          marginBottom: '12px',
          opacity: blurSidebar ? 0.3 : 1,
          filter: blurSidebar ? 'grayscale(100%) blur(0.5px)' : 'none',
          transition: 'opacity 0.3s ease, filter 0.3s ease'
        }}>
          <img 
            src={getImagePath('star.png')} 
            alt="Logo" 
            style={{ 
              width: '28px', 
              height: '28px',
              objectFit: 'contain',
              imageRendering: 'crisp-edges',
              filter: 'none',
              marginLeft: '4px'
            }} 
          />
        </div>

        {/* Public/Private Toggle */}
        <div style={{ 
          padding: '16px 12px 12px 12px',
          opacity: blurSidebar ? 0.3 : 1,
          filter: blurSidebar ? 'grayscale(100%) blur(0.5px)' : 'none',
          transition: 'opacity 0.3s ease, filter 0.3s ease'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f3f4f6',
            borderRadius: '10px',
            padding: '4px',
            gap: '4px'
          }}>
            <button
              style={{
                flex: 1,
                padding: '6px 10px',
                border: 'none',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#111',
                fontWeight: '600',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              Public
            </button>
            <button
              style={{
                flex: 1,
                padding: '6px 10px',
                border: 'none',
                borderRadius: '8px',
                background: 'transparent',
                color: '#6b7280',
                fontWeight: '500',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Private
            </button>
          </div>
        </div>

        {/* Primary actions */}
        <div style={{ 
          padding: '12px 12px 6px 12px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '6px',
          opacity: blurSidebar ? 0.3 : 1,
          filter: blurSidebar ? 'grayscale(100%) blur(0.5px)' : 'none',
          transition: 'opacity 0.3s ease, filter 0.3s ease'
        }}>
          {/* Search button */}
          <button
            onClick={() => setIsSearching(!isSearching)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 10px',
              borderRadius: '10px',
              border: 'none',
              background: isSearching ? '#f5f5f5' : 'transparent',
              color: '#111',
              cursor: 'pointer',
              justifyContent: 'flex-start'
            }}
            onMouseEnter={(e) => { if (!isSearching) e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
            onMouseLeave={(e) => { if (!isSearching) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '14px', height: '14px', minWidth: '14px', minHeight: '14px', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <span style={{ fontWeight: 500, fontSize: '0.8rem', color: '#111' }}>Search</span>
          </button>
          {/* New Chat button */}
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 10px',
              borderRadius: '10px',
              border: 'none',
              background: 'transparent',
              color: '#111',
              cursor: 'pointer',
              justifyContent: 'flex-start'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '14px', height: '14px', minWidth: '14px', minHeight: '14px', flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            <span style={{ fontWeight: 500, fontSize: '0.8rem', color: '#111' }}>Chat</span>
          </button>
          {/* Library button */}
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 10px',
              borderRadius: '10px',
              border: 'none',
              background: 'transparent',
              color: '#111',
              cursor: 'pointer',
              justifyContent: 'flex-start'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 14, height: 14, flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            <span style={{ fontWeight: 500, fontSize: '0.8rem', color: '#111' }}>Library</span>
          </button>
        </div>

        {/* Search Input (only visible when searching) */}
        {isSearching && (
          <div style={{
            padding: '0 1rem 1rem',
            opacity: blurSidebar ? 0.3 : 1,
            filter: blurSidebar ? 'grayscale(100%)' : 'none',
            transition: 'opacity 0.3s ease, filter 0.3s ease'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'white',
              borderRadius: '8px',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              padding: '0 0.5rem'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#666666', marginRight: '0.5rem' }}>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                style={{
                  border: 'none',
                  padding: '0.6rem 0.5rem 0.6rem 0',
                  outline: 'none',
                  width: '100%',
                  fontSize: '0.75rem'
                }}
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setIsSearching(false); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.25rem'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#666666' }}>
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chat History */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          padding: '0 12px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* History header with icon */}
          <div style={{
            margin: '0 0 8px 0',
            opacity: blurSidebar ? 0.3 : 1,
            filter: blurSidebar ? 'grayscale(100%)' : 'none',
            transition: 'opacity 0.3s ease, filter 0.3s ease'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 10px',
              borderRadius: '10px',
              border: 'none',
              background: 'transparent',
              color: '#111'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 14, height: 14 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span style={{ fontWeight: 500, fontSize: '0.8rem', color: '#111' }}>History</span>
            </div>
          </div>

          {/* Timeline vertical line - positioned to match actual sidebar */}
          <div style={{
            position: 'absolute',
            top: '40px',
            bottom: 0,
            left: '33px', // Moved slightly to the right
            width: '1px',
            background: '#e5e7eb',
            opacity: blurSidebar ? 0.2 : 1,
            transition: 'opacity 0.3s ease'
          }} />

          {/* Chats list with proper indent to match timeline */}
          <div style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            marginLeft: '32px', // historyTextLeft (40px) - 8px = 32px to align with History text
            paddingRight: '12px',
            position: 'relative'
          }}>
            {fakeChats.map((chat, index) => {
              const isCurrentChat = index === 0;
              const shouldBlur = blurSidebar && !isCurrentChat;
              
              return (
                <div
                  key={chat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '4px 8px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    margin: '0px',
                    background: 'transparent',
                    opacity: shouldBlur ? 0.3 : 1,
                    filter: shouldBlur ? 'grayscale(100%) blur(0.5px)' : 'none',
                    transition: 'background-color 0.2s, opacity 0.3s ease, filter 0.3s ease',
                    position: 'relative',
                    zIndex: isCurrentChat ? 10 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!shouldBlur) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                      const menu = e.currentTarget.querySelector('.chat-item-menu');
                      if (menu) menu.style.visibility = 'visible';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!shouldBlur) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      const menu = e.currentTarget.querySelector('.chat-item-menu');
                      if (menu) menu.style.visibility = 'hidden';
                    }
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    minWidth: 0
                  }}>
                    <span
                      title={chat.title}
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '0.75rem',
                        color: 'rgb(17, 17, 17)'
                      }}
                    >
                      {chat.title}
                    </span>
                  </div>
                  <div
                    className="chat-item-menu"
                    style={{
                      position: 'relative',
                      flexShrink: 0,
                      visibility: 'hidden'
                    }}
                  >
                    <button
                      aria-label="Chat menu"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.25">
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right side - 75% width - Reserved for fake chat */}
      <div ref={rightPanelRef} style={{
        width: '75%',
        height: '100%',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        pointerEvents: isStatic ? 'auto' : 'none',
        userSelect: isStatic ? 'text' : 'none'
      }}>
        {/* Header bar with model selection, chat name, annotate, and share */}
        <div style={{
          padding: '1rem',
          textAlign: 'center',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          borderBottom: '1px solid #e5e7eb',
          opacity: focusHeader ? 1 : (blurSidebar ? 0.3 : 1),
          filter: focusHeader ? 'none' : (blurSidebar ? 'grayscale(100%) blur(0.5px)' : 'none'),
          transition: 'opacity 0.3s ease, filter 0.3s ease, box-shadow 0.3s ease',
          boxShadow: focusHeader ? '0 4px 12px rgba(0, 0, 0, 0.08)' : 'none',
          zIndex: focusHeader ? 10 : 'auto',
          background: focusHeader ? '#ffffff' : 'transparent'
        }}>
          {/* Chat name/title - centered */}
          <h2 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: '500',
            color: '#1f2937'
          }}>
            {fakeChats[0].title}
          </h2>

          {/* Model selection dropdown - left side */}
          <div 
            className="model-dropdown-container"
            style={{
              position: 'absolute',
              left: '1.5rem',
              zIndex: 1000
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsModelDropdownOpen(!isModelDropdownOpen);
              }}
              style={{
                background: 'white',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '12px',
                padding: '0.5rem 0.8rem',
                fontSize: '0.75rem',
                color: '#1f2937',
                cursor: 'pointer',
                minWidth: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.4rem',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                outline: 'none',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = 'rgba(0,0,0,0.15)';
                e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = 'rgba(0,0,0,0.08)';
                e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                e.target.style.transform = 'translateY(0)';
              }}
              title="Select AI model"
            >
              <span style={{ fontWeight: '500' }}>
                {availableModels.find(m => m.value === selectedModel)?.label || 'Phraze v1'}
              </span>
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                style={{
                  transform: isModelDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: '0.6'
                }}
              >
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </button>
            
            {isModelDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                right: '0',
                marginTop: '0.5rem',
                background: 'white',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                overflow: 'hidden',
                zIndex: 1001,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                width: '280px'
              }}>
                {availableModels.map((model, index) => (
                  <button
                    key={model.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedModel(model.value);
                      setIsModelDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.7rem 1rem',
                      background: selectedModel === model.value ? 'rgb(245, 243, 240)' : 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                      borderBottom: index < availableModels.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedModel !== model.value) {
                        e.target.style.background = 'rgb(249, 248, 246)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedModel !== model.value) {
                        e.target.style.background = 'transparent';
                      }
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%'
                    }}>
                      <span style={{
                        fontWeight: selectedModel === model.value ? '600' : '500',
                        color: selectedModel === model.value ? '#0f172a' : '#334155',
                        fontSize: '0.75rem',
                        letterSpacing: '-0.01em'
                      }}>
                        {model.label}
                      </span>
                      {selectedModel === model.value && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#3b82f6' }}>
                          <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.65rem',
                      color: '#64748b',
                      lineHeight: '1.3',
                      fontWeight: '400'
                    }}>
                      {model.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Share button - right side */}
          <button
            style={{
              position: 'absolute',
              right: '8rem',
              background: 'white',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '12px',
              padding: '0.5rem 0.8rem',
              fontSize: '0.75rem',
              color: '#1f2937',
              cursor: 'pointer',
              minWidth: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              outline: 'none',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = 'rgba(0,0,0,0.15)';
              e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = 'rgba(0,0,0,0.08)';
              e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
              e.target.style.transform = 'translateY(0)';
            }}
            title="Share this chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256">
              <path fill="currentColor" d="m237.66 106.35l-80-80A8 8 0 0 0 144 32v40.35c-25.94 2.22-54.59 14.92-78.16 34.91c-28.38 24.08-46.05 55.11-49.76 87.37a12 12 0 0 0 20.68 9.58c11-11.71 50.14-48.74 107.24-52V192a8 8 0 0 0 13.66 5.65l80-80a8 8 0 0 0 0-11.3ZM160 172.69V144a8 8 0 0 0-8-8c-28.08 0-55.43 7.33-81.29 21.8a196.17 196.17 0 0 0-36.57 26.52c5.8-23.84 20.42-46.51 42.05-64.86C99.41 99.77 127.75 88 152 88a8 8 0 0 0 8-8V51.32L220.69 112Z"/>
            </svg>
            <span style={{ fontWeight: '500' }}>Share</span>
          </button>

          {/* Annotate button - right side */}
          <button
            style={{
              background: 'white',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '12px',
              padding: '0.5rem 0.8rem',
              fontSize: '0.75rem',
              color: '#1f2937',
              cursor: 'pointer',
              minWidth: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              outline: 'none',
              fontWeight: '500',
              position: 'absolute',
              right: '1.5rem'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = 'rgba(0,0,0,0.15)';
              e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = 'rgba(0,0,0,0.08)';
              e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
              e.target.style.transform = 'translateY(0)';
            }}
            title="Annotate"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256">
              <path fill="currentColor" d="M240 100.68a15.86 15.86 0 0 0-4.69-11.31l-68.68-68.69a16 16 0 0 0-22.63 0l-28.43 28.43l-58 21.77a16.06 16.06 0 0 0-10.22 12.35L24.11 222.68A8 8 0 0 0 32 232a8.4 8.4 0 0 0 1.32-.11l139.44-23.24a16 16 0 0 0 12.35-10.17l21.77-58L235.31 112a15.87 15.87 0 0 0 4.69-11.32Zm-69.87 92.19L55.32 212l47.37-47.37a28 28 0 1 0-11.32-11.32L44 200.7L63.13 85.86L118 65.29L190.7 138ZM104 140a12 12 0 1 1 12 12a12 12 0 0 1-12-12Zm96-15.32L131.31 56l24-24L224 100.68Z"/>
            </svg>
            <span style={{ fontWeight: '500' }}>Annotate</span>
          </button>
        </div>

        {/* Chat content area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          background: 'rgb(249, 248, 246)',
          minHeight: 0
        }}>
          {/* Welcome Screen with Input (shown when no messages) */}
          {showWelcome && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              width: '100%',
              maxWidth: '600px',
              padding: '0 1.5rem',
              zIndex: 1
            }}>
              <h1 style={{
                fontSize: '1.5rem',
                marginTop: 0,
                marginBottom: '1.5rem',
                color: 'rgb(32, 33, 35)',
                fontFamily: 'inherit'
              }}>
                How can I help you today?
              </h1>

              {/* Input form */}
              <div style={{ marginBottom: '1.5rem', padding: '0 1rem' }}>
                <form
                  onSubmit={(e) => { e.preventDefault(); }}
                  style={{
                    maxWidth: '800px',
                    margin: '0 auto',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '0.75rem',
                    backgroundColor: '#fff',
                    paddingRight: '0.5rem'
                  }}>
                    {/* Image upload button */}
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.5rem 0.4rem',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Upload image"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                        padding: '0.5rem 0.4rem',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '0.2rem'
                      }}
                      title="Speak"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="2" width="6" height="12" rx="3" />
                        <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                        <line x1="8" y1="22" x2="16" y2="22" />
                      </svg>
                    </button>

                    <textarea
                      placeholder="Message Phraze..."
                      value={welcomeInputValue}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.3rem 0.5rem 0.3rem',
                        border: 'none',
                        borderRadius: '0.6rem',
                        fontSize: '0.8rem',
                        lineHeight: '1.4',
                        resize: 'none',
                        maxHeight: '150px',
                        outline: 'none',
                        backgroundColor: '#fff',
                        fontFamily: 'inherit',
                        overflowY: 'auto',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                      }}
                      rows={1}
                      disabled
                    />
                    <button
                      type="submit"
                      disabled
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'not-allowed',
                        opacity: 0.5,
                        transition: 'opacity 0.2s',
                        padding: '0.15rem'
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="black"
                        strokeWidth="2"
                        style={{
                          width: '14px',
                          height: '14px',
                          transform: 'rotate(90deg)',
                          color: '#10a37f'
                        }}
                      >
                        <path d="M12 19V5M5 12l7-7 7 7" />
                      </svg>
                    </button>
                  </div>
                </form>
                
                {/* Disclaimer */}
                <div style={{
                  textAlign: 'center',
                  fontSize: '0.65rem',
                  color: '#6b7280',
                  marginTop: '0.5rem'
                }}>
                  Phraze can make mistakes. Consider checking important information.
                </div>
              </div>
            </div>
          )}

{/* Messages area */}
{!showWelcome && (
  <div ref={messagesContainerRef} style={{
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    minHeight: 0,
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    pointerEvents: isStatic ? 'auto' : 'none',
    userSelect: isStatic ? 'text' : 'none'
  }} className="hide-scrollbar">
            {messages.map((msg, index) => {
              const isHighlightable = (isStatic || showFinalState) && msg.role === 'assistant' && 
                (msg.content.includes('strategies') || msg.content.includes('overfitting'));
              
              return (
              <div
                key={index}
                  data-message-index={index}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  padding: '0 0.5rem'
                }}
              >
                <div style={{
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  {/* Username and avatar */}
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: '#555',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    {msg.role === 'assistant' && (
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        color: '#fff'
                      }}>P</div>
                    )}
                    <span>{msg.role === 'user' ? 'User' : 'phraze'}</span>
                    {msg.role === 'user' && (
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        color: '#334155'
                      }}>U</div>
                    )}
                  </div>
                  
                  {/* Message bubble */}
                    <div 
                      data-message-text
                      style={{
                    padding: '0.75rem 1rem',
                    background: msg.role === 'user' ? '#ffffff' : 'transparent',
                    borderRadius: msg.role === 'user' ? '1.5rem' : '0.5rem',
                    borderBottomRightRadius: msg.role === 'user' ? '5px' : '0.5rem',
                    color: '#0A0A0A',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                        boxShadow: msg.role === 'user' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                        userSelect: isHighlightable ? 'text' : 'none',
                        WebkitUserSelect: isHighlightable ? 'text' : 'none',
                        MozUserSelect: isHighlightable ? 'text' : 'none',
                        msUserSelect: isHighlightable ? 'text' : 'none'
                      }}
                    >
                      {isHighlightable ? renderMessageWithHighlights(index, msg.content) : msg.content}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
          )}

          {/* Bottom input area - only show when messages exist */}
          {!showWelcome && (
          <div style={{
            padding: '1rem',
            display: 'flex',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: blurSidebar ? 0.3 : 1,
            filter: blurSidebar ? 'grayscale(100%)' : 'none',
            transition: 'opacity 0.3s ease, filter 0.3s ease'
          }}>
            <form
              onSubmit={(e) => { e.preventDefault(); }}
              style={{
                maxWidth: '800px',
                width: '100%',
                margin: '0 auto',
                position: 'relative'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '0.75rem',
                backgroundColor: '#fff',
                paddingRight: '0.5rem'
              }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.5rem 0.4rem',
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Upload image"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                </button>

                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.5rem 0.4rem',
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.2rem'
                  }}
                  title="Speak"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="8" y1="22" x2="16" y2="22" />
                  </svg>
                </button>

                <textarea
                  placeholder="Message Phraze..."
                  value={chatInputValue}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.3rem 0.5rem 0.3rem',
                    border: 'none',
                    borderRadius: '0.6rem',
                    fontSize: '0.8rem',
                    lineHeight: '1.4',
                    resize: 'none',
                    maxHeight: '150px',
                    outline: 'none',
                    backgroundColor: '#fff',
                    fontFamily: 'inherit',
                    overflowY: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                  rows={1}
                  disabled
                />
                <button
                  type="submit"
                  disabled
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'not-allowed',
                    opacity: 0.5,
                    transition: 'opacity 0.2s',
                    padding: '0.15rem'
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="black"
                    strokeWidth="2"
                    style={{
                      width: '14px',
                      height: '14px',
                      transform: 'rotate(90deg)',
                      color: '#10a37f'
                    }}
                  >
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const sectionRef = useRef(null);
  const headerRef = useRef(null);
  const [progress, setProgress] = useState(0); // 0 -> first card, 1 -> last card
  const [isLocked, setIsLocked] = useState(false);
  const touchStartYRef = useRef(0);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false);
  const panelHeight = isMobile ? 420 : 520;
  // Edge hysteresis to avoid instantly unlocking at the first/last card
  const WHEEL_EDGE_THRESHOLD = 220; // pixels of scroll delta to unlock at edges (wheel)
  const TOUCH_EDGE_THRESHOLD = 80; // pixels of finger movement to unlock at edges (touch)
  const edgeStateRef = useRef({ side: null, accum: 0 }); // side: 'start' | 'end' | null

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 900);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper: determine if section should be active (only when user is at bottom near footer)
  const isSectionInView = () => {
    const sectionEl = sectionRef.current;
    if (!sectionEl) return false;
    
    // Get scroll position and document dimensions
    const scrollY = window.scrollY || window.pageYOffset;
    const documentHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;
    
    // Calculate how far from bottom of page we are
    const distanceFromBottom = documentHeight - (scrollY + windowHeight);
    
    // Get section position
    const rect = sectionEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Only activate when user is at the very bottom of page (footer area)
    // Start strictly when the bottom is reached (no early activation)
    const atFooter = distanceFromBottom <= 0;
    
    // Section must be visible in viewport
    // When at footer, the section (which comes before footer) should still be visible
    // Section top should be in viewport (above bottom edge) and section should extend into viewport
    const sectionVisible = rect.top < viewportHeight && rect.bottom > viewportHeight * 0.1;
    
    // Only activate when we're at the footer AND section is still visible
    return atFooter && sectionVisible;
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const handleWheel = (e) => {
    if (!isSectionInView()) return;
    const deltaY = e.deltaY;
    const atStart = progress <= 0;
    const atEnd = progress >= 1;
    const wantScrollDown = deltaY > 0;
    const wantScrollUp = deltaY < 0;

    // Edge hysteresis accumulation to keep user on first/last card briefly
    let edgeUnlockReady = false;
    if (atStart && wantScrollUp) {
      if (edgeStateRef.current.side !== 'start') {
        edgeStateRef.current.side = 'start';
        edgeStateRef.current.accum = 0;
      }
      edgeStateRef.current.accum += Math.abs(deltaY);
      if (edgeStateRef.current.accum >= WHEEL_EDGE_THRESHOLD) {
        edgeUnlockReady = true;
        edgeStateRef.current.side = null;
        edgeStateRef.current.accum = 0;
      }
    } else if (atEnd && wantScrollDown) {
      if (edgeStateRef.current.side !== 'end') {
        edgeStateRef.current.side = 'end';
        edgeStateRef.current.accum = 0;
      }
      edgeStateRef.current.accum += Math.abs(deltaY);
      if (edgeStateRef.current.accum >= WHEEL_EDGE_THRESHOLD) {
        edgeUnlockReady = true;
        edgeStateRef.current.side = null;
        edgeStateRef.current.accum = 0;
      }
    } else {
      // Reset accumulation when moving away from an edge
      edgeStateRef.current.side = null;
      edgeStateRef.current.accum = 0;
    }

    // Decide if we should capture the scroll to drive cards
    const shouldLock =
      !edgeUnlockReady &&
      (
        (progress > 0 && progress < 1) ||
        (atStart && (wantScrollDown || wantScrollUp)) ||
        (atEnd && (wantScrollUp || wantScrollDown))
      );

    if (!shouldLock) {
      setIsLocked(false);
      return; // allow page to scroll normally
    }

    // Use the wheel input to drive animation
    e.preventDefault();
    setIsLocked(true);

    const speed = 0.0005; // Slightly faster but still controlled
    // Do not move beyond edges when overscrolling into them; just accumulate
    const effectiveDelta =
      (atStart && wantScrollUp) || (atEnd && wantScrollDown) ? 0 : deltaY;
    
    // Cap the progress change to prevent skipping cards
    const desiredChange = effectiveDelta * speed;
    const maxChange = 0.01; // Max 1% progress change per scroll event
    const cappedChange = Math.sign(desiredChange) * Math.min(Math.abs(desiredChange), maxChange);
    
    const next = clamp(progress + cappedChange, 0, 1);
    setProgress(next);
  };

  const handleTouchStart = (e) => {
    if (!isSectionInView()) return;
    if (e.touches && e.touches.length > 0) {
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (!isSectionInView()) return;
    if (!(e.touches && e.touches.length > 0)) return;
    const currentY = e.touches[0].clientY;
    const deltaY = touchStartYRef.current - currentY; // positive = swipe up (scroll down)

    const atStart = progress <= 0;
    const atEnd = progress >= 1;
    const wantScrollDown = deltaY > 0;
    const wantScrollUp = deltaY < 0;

    // Edge hysteresis accumulation (touch)
    let edgeUnlockReady = false;
    if (atStart && wantScrollUp) {
      if (edgeStateRef.current.side !== 'start') {
        edgeStateRef.current.side = 'start';
        edgeStateRef.current.accum = 0;
      }
      edgeStateRef.current.accum += Math.abs(deltaY);
      if (edgeStateRef.current.accum >= TOUCH_EDGE_THRESHOLD) {
        edgeUnlockReady = true;
        edgeStateRef.current.side = null;
        edgeStateRef.current.accum = 0;
      }
    } else if (atEnd && wantScrollDown) {
      if (edgeStateRef.current.side !== 'end') {
        edgeStateRef.current.side = 'end';
        edgeStateRef.current.accum = 0;
      }
      edgeStateRef.current.accum += Math.abs(deltaY);
      if (edgeStateRef.current.accum >= TOUCH_EDGE_THRESHOLD) {
        edgeUnlockReady = true;
        edgeStateRef.current.side = null;
        edgeStateRef.current.accum = 0;
      }
    } else {
      edgeStateRef.current.side = null;
      edgeStateRef.current.accum = 0;
    }

    const shouldLock =
      !edgeUnlockReady &&
      (
        (progress > 0 && progress < 1) ||
        (atStart && (wantScrollDown || wantScrollUp)) ||
        (atEnd && (wantScrollUp || wantScrollDown))
      );

    if (!shouldLock) {
      setIsLocked(false);
      return;
    }

    e.preventDefault();
    setIsLocked(true);

    const speed = 0.001; // Slightly faster but still controlled
    const effectiveDelta =
      (atStart && wantScrollUp) || (atEnd && wantScrollDown) ? 0 : deltaY;
    
    // Cap the progress change to prevent skipping cards
    const desiredChange = effectiveDelta * speed;
    const maxChange = 0.015; // Max 1.5% progress change per touch event
    const cappedChange = Math.sign(desiredChange) * Math.min(Math.abs(desiredChange), maxChange);
    
    const next = clamp(progress + cappedChange, 0, 1);
    setProgress(next);
  };

  useEffect(() => {
    // Attach global listeners only while the section could be active
    const wheelListener = (e) => {
      // Must use non-passive to be able to preventDefault
      handleWheel(e);
    };
    const touchStartListener = (e) => handleTouchStart(e);
    const touchMoveListener = (e) => handleTouchMove(e);

    window.addEventListener('wheel', wheelListener, { passive: false });
    window.addEventListener('touchstart', touchStartListener, { passive: true });
    window.addEventListener('touchmove', touchMoveListener, { passive: false });

    return () => {
      window.removeEventListener('wheel', wheelListener);
      window.removeEventListener('touchstart', touchStartListener);
      window.removeEventListener('touchmove', touchMoveListener);
    };
  }, [progress]);

  const activeIndex = Math.round(progress * 2);

  const labels = [
    {
      title: 'Start with a single conversation',
      desc:
        'Begin by having a conversation with an AI assistant. Ask questions, get responses, and build your knowledge base through natural dialogue.'
    },
    {
      title: 'Annotate and organize',
      desc:
        'Highlight important parts, add labels, codes, and notes to individual messages. Organize your insights as they happen, making conversations searchable and actionable.'
    },
    {
      title: 'Collaborate and share',
      desc:
        "Share conversations with your team. Multiple collaborators can add annotations, provide feedback, and build on each other's insights—all in real time."
    }
  ];

  const jumpToIndex = (idx) => {
    const target = idx / 2;
    setProgress(target);
  };

  const cardStyle = (idx) => {
    const distance = idx - progress * 2; // 0 centered at idx, +/- for others
    const translateY = distance * 120; // percentage of container height
    const abs = Math.abs(distance);
    const opacity = clamp(1 - abs, 0, 1);
    const scale = 1 - Math.min(0.06, abs * 0.06);
    const z = 100 - Math.round(abs * 10);

    return {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: `translate(-50%, -50%) translateY(${translateY}%) scale(${scale})`,
      transition: 'transform 200ms ease-out, opacity 200ms ease-out',
      width: 'calc(100% - 48px)', // equal 24px margin left/right inside panel
      height: 'calc(100% - 48px)', // equal 24px margin top/bottom inside panel
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
      borderRadius: '16px',
      opacity,
      zIndex: z,
      display: idx === 0 ? 'block' : 'flex',
      alignItems: idx === 0 ? 'stretch' : 'center',
      justifyContent: idx === 0 ? 'stretch' : 'center',
      color: '#1f2937',
      fontSize: '16px',
      fontWeight: 500,
      overflow: 'hidden'
    };
  };

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '80px 20px',
        borderTop: '1px solid rgba(0,0,0,0.05)'
      }}
    >
      <div ref={headerRef} style={{ marginBottom: '24px' }}>
        <p className="small-text" style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
          How it works
        </p>
        <h2 style={{ 
          fontSize: '1.7rem',
          fontWeight: 600,
          color: 'rgb(26, 26, 26)',
          marginBottom: '1rem',
          marginTop: 0,
          fontFamily: '"Glacial Indifference", sans-serif',
          letterSpacing: '-0.025em'
        }}>
          Scroll to preview the flow
        </h2>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '24px',
          alignItems: 'flex-start'
        }}
      >
        {/* Left: sticky nav */}
        <div
          style={{
            position: isMobile ? 'relative' : 'sticky',
            top: isMobile ? '0px' : '100px',
            alignSelf: 'flex-start',
            minWidth: isMobile ? 'auto' : '360px',
            width: isMobile ? '100%' : '420px',
            minHeight: isMobile ? 'auto' : `${panelHeight}px`
          }}
        >
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', height: isMobile ? 'auto' : '100%' }}>
            {labels.map((item, idx) => {
              const isActive = idx === activeIndex;
              return (
                <li key={item.title} style={{ flex: isMobile ? 'unset' : 1, minHeight: isMobile ? 'auto' : 0 }}>
                  <button
                    onClick={() => jumpToIndex(idx)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid ' + (isActive ? '#111827' : '#e5e7eb'),
                      background: isActive ? '#111827' : '#ffffff',
                      color: isActive ? '#ffffff' : '#111827',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                      height: isMobile ? 'auto' : '100%'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 600 }}>
                        {item.title}
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          lineHeight: 1.5,
                          fontWeight: 500,
                          color: isActive ? '#E5E7EB' : '#6b7280'
                        }}
                      >
                        {item.desc}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right: animated cards */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            minHeight: `${panelHeight}px`,
            height: `${panelHeight}px`,
            overflow: 'hidden',
            borderRadius: '16px',
            background: 'linear-gradient(to bottom right, #f9fafb, #f3f4f6)'
          }}
        >
          {/* Three cards with content */}
          <div style={cardStyle(0)}>
            <ChatSidebarDemo isActive={progress === 0} />
          </div>
          <div style={cardStyle(1)}>
              <StaticChatDemo isActive={activeIndex === 1} />
          </div>
          <div style={cardStyle(2)}>
              <CollaborateChatDemo isActive={activeIndex === 2} />
          </div>

          {/* Hint overlay removed per request */}
        </div>
      </div>
    </section>
  );
}


