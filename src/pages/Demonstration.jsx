import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { auth, database } from '../firebase-init';
import { ref, onValue, off, get, set } from 'firebase/database';
import ChatSidebar from '../components/ChatSidebar';
import ShareModal from '../components/ShareModal';
import AccountSettingsModal from '../components/AccountSettingsModal';
// Import our new groqClient service
import { getFirebaseData, saveFirebaseData, isLoggedIn, showToast, getMainCompanyEmail, getProjectCompanyEmail } from '../funcs';
import { useLocation, useNavigate } from 'react-router-dom';
import { listenToUserPresence, getPresenceColor, getPresenceLabel } from '../utils/presence';
import { reportTyping, stopTyping, initializeTypingForConversation, listenToTyping, formatTypingIndicator } from '../utils/typing';
import { loadHighlights, setMainCompanyEmail, saveHighlight, clearHighlights, loadHighlightsForText, createUnifiedAnnotationCard } from '../utils/highlighting';
import { DEFAULT_PERMISSIONS } from '../utils/permissionConstants';
// import { initContactsPanel, setMessagingUserEmail, setMessagingUserName, setMessagingCurrentProject, setFirebaseFunctions } from '../utils/messaging';
import { useExtension } from "../context/ExtensionContext";
import { useAuth } from "../context/AuthContext";
import html2canvas from 'html2canvas';
import AdvancedSearchOverlay from '../components/AdvancedSearchOverlay';
import { getImagePath } from '../utils/assetPaths';
import Activity from '../components/Activity';
import Messages from '../components/Messages';


// Import Groq SDK
import Groq from 'groq-sdk';
import waveformSvg from '../../extension/img/waveform.svg';
import { BsNutFill } from 'react-icons/bs';
import { HiShieldCheck, HiPencil, HiEye, HiSearch, HiX, HiTrash } from 'react-icons/hi';
import { HiOutlineShieldCheck, HiOutlinePencil, HiOutlineEye, HiOutlineTrash } from 'react-icons/hi';

// Groq API configuration
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
// const GROQ_MODEL = "llama3-8b-8192"; // Easily changeable model variable
// const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"; // Easily changeable model variable

// Feature flag: Toggle share button visibility (change to true to show the share button)
const SHARE_BUTTON_ENABLED = false;

// Initialize Groq client - will be set up inside component
let groq = null;

// Helper function to sanitize URL for Firebase path
function sanitizeFirebasePath(url) {
  // Basic sanitization: replace forbidden characters with underscores
  // More robust sanitization might be needed depending on expected URLs
  return url.replace(/[.#$\/\\\[\\\]]/g, '_');
}

// Helper function to get the correct Firebase path for a chat based on public/private status
// SECURITY: Private chats are stored in a separate path that's server-enforced to be owner-only
function getChatBasePath(companyEmail, projectId, chatId, isPrivate, userEmail) {
  const formattedCompanyEmail = companyEmail.replace(/\./g, ',');
  if (isPrivate && userEmail) {
    const userEmailFormatted = userEmail.replace(/\./g, ',');
    return `Companies/${formattedCompanyEmail}/projects/${projectId}/privateChats/${userEmailFormatted}/${chatId}`;
  }
  return `Companies/${formattedCompanyEmail}/projects/${projectId}/groqChats/${chatId}`;
}

// Login Modal Component
function AuthModal({ onClose, onGuestContinue }) {
  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        <div className="auth-modal-header">
          <h2>Sign in to Phraze</h2>
          <button className="close-modal-btn" onClick={onClose}>×</button>
        </div>
        <div className="auth-modal-content">
          <p>Sign in to access all features of Phraze, including saving and sharing your annotations.</p>
          <div className="auth-modal-buttons">
            <a href="/auth" className="auth-modal-signin">Sign In / Sign Up</a>
            <button onClick={onGuestContinue} className="auth-modal-guest">Continue as Guest</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fuzzy search helper - calculates similarity score between two strings
function fuzzyMatch(str, query) {
  if (!query) return { matches: true, score: 0 };
  
  str = str.toLowerCase();
  query = query.toLowerCase();
  
  // Exact match
  if (str === query) return { matches: true, score: 100 };
  
  // Starts with query
  if (str.startsWith(query)) return { matches: true, score: 90 };
  
  // Contains query
  if (str.includes(query)) return { matches: true, score: 70 };
  
  // Initials match (e.g., "js" matches "John Smith")
  const words = str.split(/\s+/);
  const initials = words.map(w => w.charAt(0)).join('');
  if (initials.startsWith(query)) return { matches: true, score: 60 };
  
  // Fuzzy match - allows for typos
  // Simple Levenshtein-based approach: check if edit distance is small enough
  const maxDistance = Math.floor(query.length / 3) + 1;
  
  // Check if any substring of str matches with small edit distance
  for (let i = 0; i <= str.length - query.length + maxDistance; i++) {
    const substr = str.substring(i, i + query.length + maxDistance);
    const distance = levenshteinDistance(substr.substring(0, query.length + 1), query);
    if (distance <= maxDistance) {
      return { matches: true, score: 50 - distance * 10 };
    }
  }
  
  // Check each word individually
  for (const word of words) {
    if (word.length >= query.length - 1) {
      const distance = levenshteinDistance(word.substring(0, query.length + 1), query);
      if (distance <= maxDistance) {
        return { matches: true, score: 40 - distance * 10 };
      }
    }
  }
  
  return { matches: false, score: 0 };
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Available commands list
const AVAILABLE_COMMANDS = [
  { command: 'help', description: 'Show all available commands', icon: 'fas fa-circle-question' },
  { command: 'label', description: 'Add a label to your message (e.g., @label: Positive)', icon: 'fas fa-tag' },
  { command: 'everyone', description: 'Mention all team members in this chat', icon: 'fas fa-users' }
];

// Label groups (predefined labels)
const LABEL_GROUPS = {
  'Sentiment': ['Positive', 'Neutral', 'Negative'],
  'Tone': ['Professional', 'Casual', 'Friendly', 'Critical'],
  'Intent': ['Question', 'Statement', 'Request', 'Feedback'],
  'Emotion': ['Happy', 'Frustrated', 'Confused', 'Satisfied']
};

// Helper function to generate user initials from firstName and lastName (consistent with SidebarProfileDropdown)
function getUserInitialsFromName(firstName, lastName, fallbackName) {
  const firstInitial = firstName && firstName.trim() ? firstName.trim()[0].toUpperCase() : '';
  const lastInitial = lastName && lastName.trim() ? lastName.trim()[0].toUpperCase() : '';
  
  if (firstInitial && lastInitial) {
    return firstInitial + lastInitial;
  } else if (firstInitial) {
    return firstInitial + firstInitial;
  } else if (fallbackName) {
    // Fallback to email prefix (before @) if it's an email, otherwise first 2 characters
    const emailPrefix = fallbackName.includes('@') ? fallbackName.split('@')[0] : fallbackName;
    return emailPrefix.substring(0, 2).toUpperCase();
  }
  return 'U';
}

// Helper function to generate user initials from display name string (for backward compatibility)
function getUserInitials(userDisplayName) {
  if (!userDisplayName) return 'U';
  
  const names = userDisplayName.trim().split(' ');
  if (names.length === 1) {
    return names[0].substring(0, 2).toUpperCase();
  }
  return (names[0][0] + names[names.length - 1][0]).toUpperCase();
}

// Component to render quoted message content with highlights
function QuotedMessageContent({ quote, isPreview = false }) {
  const contentRef = useRef(null);
  const [highlightedContent, setHighlightedContent] = useState(quote.content || '');
  
  useEffect(() => {
    const applyHighlights = async () => {
      if (!quote.highlights || quote.highlights.length === 0) {
        setHighlightedContent(quote.content || '');
        return;
      }
      
      try {
        // Apply highlights directly from quote.highlights array
        let highlightedText = quote.content || '';
        const highlightRanges = [];
        
        // Find all highlight ranges in the text
        for (const highlight of quote.highlights) {
          if (!highlight.textNodes || highlight.textNodes.length === 0) continue;
          
          for (const textNode of highlight.textNodes) {
            if (!textNode.highlightedRanges || textNode.highlightedRanges.length === 0) continue;
            
            // Get the highlighted text from the ranges
            for (const range of textNode.highlightedRanges) {
              if (range.length >= 3) {
                const start = range[1];
                const end = range[2];
                const highlightedSegment = textNode.wholeText.substring(start, end);
                
                // Find this segment in our text
                const segmentIndex = highlightedText.indexOf(highlightedSegment);
                if (segmentIndex !== -1) {
                  highlightRanges.push({
                    start: segmentIndex,
                    end: segmentIndex + highlightedSegment.length,
                    highlight: highlight,
                    text: highlightedSegment
                  });
                }
              }
            }
          }
        }
        
        // Sort ranges by start position (descending to avoid index shifting)
        highlightRanges.sort((a, b) => b.start - a.start);
        
        // Apply highlights from end to beginning to avoid index shifting
        for (const range of highlightRanges) {
          const before = highlightedText.substring(0, range.start);
          const colorAttr = (range.highlight && range.highlight.color) ? ` style="--highlight-color: ${range.highlight.color}"` : '';
          const highlighted = `<mark class="PhrazeHighlight PhrazeMark selectable" data-highlight-id="${range.highlight.id}"${colorAttr}>${range.text}</mark>`;
          const after = highlightedText.substring(range.end);
          
          highlightedText = before + highlighted + after;
        }
        
        setHighlightedContent(highlightedText);
        
        // After content is set, create annotation cards for each highlight (only in sent messages, not preview)
        if (contentRef.current && !isPreview) {
          // Wait for DOM to update - use requestAnimationFrame for better timing
          requestAnimationFrame(() => {
            setTimeout(async () => {
              // Set up annotation map in window for createUnifiedAnnotationCard
              if (!window.highlightsToAnnotationsMap) {
                window.highlightsToAnnotationsMap = {};
              }
              
              // Add annotations to the map
              if (quote.annotationsMap) {
                Object.keys(quote.annotationsMap).forEach(highlightId => {
                  window.highlightsToAnnotationsMap[highlightId] = quote.annotationsMap[highlightId];
                });
              }
              
              // Find all highlight marks in the content (scoped to this component)
              const highlightMarks = contentRef.current.querySelectorAll('mark[data-highlight-id]');
              
              // Process each highlight mark
              for (const mark of highlightMarks) {
                const highlightId = mark.getAttribute('data-highlight-id');
                if (highlightId && quote.highlights) {
                  const highlight = quote.highlights.find(h => h.id === highlightId);
                  if (highlight) {
                    // Check if container already exists
                    let containerSpan = mark.parentElement;
                    if (!containerSpan || !containerSpan.classList.contains('phraze-highlight-container')) {
                      // Create container span for the highlight
                      containerSpan = document.createElement('span');
                      containerSpan.className = 'phraze-highlight-container PhrazeMark unselectable';
                      containerSpan.style.position = 'relative';
                      containerSpan.style.display = 'inline';
                      
                      // Wrap the mark with the container
                      mark.parentNode.insertBefore(containerSpan, mark);
                      containerSpan.appendChild(mark);
                    }
                    
                    // Check if annotation card already exists (scoped to this container)
                    const existingCard = containerSpan.querySelector(`.phraze-unified-annotation-card[data-highlight-id="${highlightId}"]`);
                    if (!existingCard) {
                      // Ensure containerSpan is positioned relative for absolute positioning of card
                      if (window.getComputedStyle(containerSpan).position === 'static') {
                        containerSpan.style.position = 'relative';
                      }
                      
                      // Create unified annotation card
                      try {
                        const annotationCard = await createUnifiedAnnotationCard(highlight, containerSpan);
                        
                        // For quoted messages, move card to containerSpan and position it correctly
                        if (annotationCard && containerSpan) {
                          // Wait for card to be in DOM
                          setTimeout(() => {
                            const mark = containerSpan.querySelector(`mark[data-highlight-id="${highlightId}"]`);
                            if (mark && annotationCard && containerSpan) {
                              // Remove from body if it was added there
                              if (annotationCard.parentNode === document.body) {
                                document.body.removeChild(annotationCard);
                              }
                              
                              // Append to containerSpan for proper relative positioning
                              if (annotationCard.parentNode !== containerSpan) {
                                containerSpan.appendChild(annotationCard);
                              }
                              
                              // Ensure containerSpan has relative positioning
                              if (window.getComputedStyle(containerSpan).position === 'static') {
                                containerSpan.style.position = 'relative';
                              }
                              
                              // Position the card directly above the highlight
                              const updateCardPosition = () => {
                                const markRect = mark.getBoundingClientRect();
                                const containerRect = containerSpan.getBoundingClientRect();
                                const cardRect = annotationCard.getBoundingClientRect();
                                
                                // Calculate position relative to containerSpan
                                const cardWidth = cardRect.width || 320;
                                const cardHeight = cardRect.height || 200;
                                
                                // Center horizontally on the highlight
                                const left = (markRect.left - containerRect.left) + (markRect.width / 2) - (cardWidth / 2);
                                
                                // Position above the highlight with 8px spacing
                                let top = (markRect.top - containerRect.top) - cardHeight - 8;
                                
                                // If card would go above container, position below instead
                                if (top < 0) {
                                  top = (markRect.bottom - containerRect.top) + 8;
                                }
                                  
                                // Ensure card doesn't go outside container bounds
                                const minLeft = -20; // Allow slight overflow
                                const maxLeft = containerRect.width - cardWidth + 20;
                                const finalLeft = Math.max(minLeft, Math.min(left, maxLeft));
                                
                              // Set position (absolute relative to containerSpan)
                              annotationCard.style.position = 'absolute';
                              annotationCard.style.left = `${finalLeft}px`;
                              annotationCard.style.top = `${top}px`;
                              annotationCard.style.transform = 'none';
                              annotationCard.style.boxShadow = 'none'; // Remove shadow for quoted message cards
                              };
                              
                              // Initial positioning
                              requestAnimationFrame(() => {
                                updateCardPosition();
                                
                                // Override the updateFloaterPosition to use our relative positioning
                                if (typeof updateFloaterPosition === 'function') {
                                  // Store original and override
                                  annotationCard._customUpdatePosition = updateCardPosition;
                                  
                                  // Update on scroll/hover
                                  const updateOnScroll = () => {
                                    if (annotationCard.classList.contains('active')) {
                                      updateCardPosition();
                                    }
                                  };
                                  
                                  window.addEventListener('scroll', updateOnScroll, true);
                                  containerSpan.addEventListener('mouseenter', updateCardPosition);
                                }
                              });
                            }
                          }, 150);
                        }
                      } catch (error) {
                        console.error(`Error creating annotation card for highlight ${highlightId}:`, error);
                      }
                    }
                  }
                }
              }
            }, 300); // Increased timeout for better reliability
          });
        }
      } catch (error) {
        console.error('Error applying highlights to quoted message:', error);
        setHighlightedContent(quote.content || '');
      }
    };
    
    applyHighlights();
  }, [quote.content, quote.highlights, quote.chatID, quote.annotationsMap, isPreview]);
  
  return (
    <div 
      ref={contentRef}
      dangerouslySetInnerHTML={{ __html: highlightedContent }}
      style={{
        fontSize: '0.875rem',
        color: '#4b5563',
        fontWeight: '500'
      }}
    />
  );
}

// Separate component for the input form
function MessageInput({ inputValue, setInputValue, handleSubmit, isLoading, textareaRef, handleImageUpload, imagePreview, clearImagePreview, isExtensionSidebarVisible, setIsExtensionSidebarVisible, isSharedView, currentUser, projectMembers, isPublicChat, recentMentions = [], onMentionUsed, currentUserRole, messages = [], conversationId, quotedMessages = [], onRemoveQuotedMessage, expandedQuotesPreview, setExpandedQuotesPreview }) {
  const fileInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speechObj, setSpeechObj] = useState(null);
  const [isScreenshotShortcutsVisible, setIsScreenshotShortcutsVisible] = useState(false);
  
  // Typing indicator integration
  const typingTimeoutRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);
  
  // Initialize typing for conversation when conversationId changes
  useEffect(() => {
    if (conversationId && auth.currentUser) {
      initializeTypingForConversation(conversationId);
    }
    
    return () => {
      // Clean up typing when leaving conversation
      if (conversationId) {
        stopTyping(conversationId);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (stopTypingTimeoutRef.current) {
        clearTimeout(stopTypingTimeoutRef.current);
      }
    };
  }, [conversationId]);
  
  // Mention popup state
  const [mentionState, setMentionState] = useState({
    isOpen: false,
    query: '',
    selectedIndex: 0,
    ghostText: '', // Inline hint text
    mode: 'members' // 'members', 'commands', or 'help'
  });
  const mentionPopupRef = useRef(null);
  const inputContainerRef = useRef(null);
  
  // Label popup state
  const [labelState, setLabelState] = useState({
    isOpen: false,
    query: '',
    selectedIndex: 0,
    ghostText: '',
    allLabels: [] // Will store all labels (predefined + custom)
  });
  const labelPopupRef = useRef(null);
  const [customLabels, setCustomLabels] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const shadowRef = useRef(null);
  
  // Check if mentions should be enabled (only for public/shared chats)
  const isMentionEnabled = isPublicChat && projectMembers && projectMembers.length > 0;

  // Helper function to process custom labels data and update state
  const processCustomLabelsData = (customData) => {
    if (!customData || typeof customData !== 'object') {
      // Fallback to predefined labels only
      const allPredefinedLabels = Object.values(LABEL_GROUPS).flat();
      setCustomLabels([]);
      setLabelState(prev => ({ ...prev, allLabels: allPredefinedLabels }));
      return;
    }
    
    const labels = [];
    Object.entries(customData).forEach(([labelType, data]) => {
      if (data && data.keyType === 'label' && Array.isArray(data.options)) {
        labels.push(...data.options);
      }
    });
    
    setCustomLabels(labels);
    
    // Combine with predefined labels
    const allPredefinedLabels = Object.values(LABEL_GROUPS).flat();
    const allLabels = [...allPredefinedLabels, ...labels];
    setLabelState(prev => ({ ...prev, allLabels }));
  };

  // Load custom labels from Firebase/storage with real-time updates
  useEffect(() => {
    let listenerRef = null;
    let unsubscribe = () => {};
    
    const setupCustomLabelsListener = async () => {
      try {
        const { getFirebaseData } = await import('../funcs');
        const { getCurrentProject } = await import('../utils/highlighting');
        const firebaseDb = await import('firebase/database');
        const { ref, onValue, off } = firebaseDb;
        const { database } = await import('../firebase-init');
        
        // Get company email and project
        const companyEmail = localStorage.getItem('companyEmail') || localStorage.getItem('sharedCompanyEmail');
        const projectName = getCurrentProject?.() || localStorage.getItem('currentProject') || 'default';
        
        if (companyEmail && database) {
          const formattedCompanyEmail = companyEmail.replace(/\./g, ',');
          const customLabelsPath = `Companies/${formattedCompanyEmail}/projects/${projectName}/customLabelsAndCodes`;
          
          // Set up Firebase real-time listener
          listenerRef = ref(database, customLabelsPath);
          
          const handleValueChange = (snapshot) => {
            const customData = snapshot.val();
            // Removed excessive console.log for performance
            processCustomLabelsData(customData);
          };
          
          onValue(listenerRef, handleValueChange);
          
          // Initial load
          const customData = await getFirebaseData(customLabelsPath);
          processCustomLabelsData(customData);
          
          unsubscribe = () => {
            if (listenerRef) {
              off(listenerRef, 'value', handleValueChange);
              listenerRef = null;
            }
          };
        } else {
          // Fallback to localStorage/extension storage if no Firebase
          if (typeof window !== 'undefined' && window.callGetItem) {
            try {
              const result = await window.callGetItem('customLabelsAndCodes');
              if (result) {
                const data = Object.values(result)[0] || {};
                processCustomLabelsData(data);
              } else {
                // Initialize with predefined labels only
                const allPredefinedLabels = Object.values(LABEL_GROUPS).flat();
                setCustomLabels([]);
                setLabelState(prev => ({ ...prev, allLabels: allPredefinedLabels }));
              }
            } catch (e) {
              console.warn('Could not load custom labels from extension storage:', e);
              // Initialize with predefined labels only
              const allPredefinedLabels = Object.values(LABEL_GROUPS).flat();
              setCustomLabels([]);
              setLabelState(prev => ({ ...prev, allLabels: allPredefinedLabels }));
            }
          } else {
            // Initialize with predefined labels only
            const allPredefinedLabels = Object.values(LABEL_GROUPS).flat();
            setCustomLabels([]);
            setLabelState(prev => ({ ...prev, allLabels: allPredefinedLabels }));
          }
        }
      } catch (error) {
        console.error('Error setting up custom labels listener:', error);
        // Fallback to predefined labels only
        const allPredefinedLabels = Object.values(LABEL_GROUPS).flat();
        setCustomLabels([]);
        setLabelState(prev => ({ ...prev, allLabels: allPredefinedLabels }));
      }
    };
    
    setupCustomLabelsListener();
    
    // Also listen for custom events (from extension or other sources)
    const handleCustomLabelsUpdate = (e) => {
      try {
        const customData = e?.detail?.data || e?.detail;
        if (customData) {
          // Removed console.log for performance
          processCustomLabelsData(customData);
        }
      } catch (error) {
        console.error('Error handling custom labels update event:', error);
      }
    };
    
    // Listen for custom label updates from extension or other components
    window.addEventListener('phraze:custom-labels-updated', handleCustomLabelsUpdate);
    window.addEventListener('phraze:custom-labels-and-codes-updated', handleCustomLabelsUpdate);
    
    // Cleanup
    return () => {
      unsubscribe();
      window.removeEventListener('phraze:custom-labels-updated', handleCustomLabelsUpdate);
      window.removeEventListener('phraze:custom-labels-and-codes-updated', handleCustomLabelsUpdate);
    };
  }, []); // Set up once, but listener will update when Firebase changes

  // Also update when localStorage currentProject changes
  useEffect(() => {
    const handleStorageChange = () => {
      // Re-trigger the listener setup by updating state
      const allPredefinedLabels = Object.values(LABEL_GROUPS).flat();
      // This will cause the label state to refresh
      setLabelState(prev => ({ ...prev, allLabels: [...allPredefinedLabels, ...prev.allLabels.filter(l => !allPredefinedLabels.includes(l))] }));
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom project change events
    window.addEventListener('phraze:project-changed', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('phraze:project-changed', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!event.target.closest('#showScreenshotShortcutsButton'))
        setIsScreenshotShortcutsVisible(false);
      // Close mention popup on outside click (but not if clicking inside the popup)
      if (!event.target.closest('.mention-popup') && event.target !== textareaRef.current) {
        setMentionState(prev => {
          if (prev.isOpen) {
            return { ...prev, isOpen: false };
          }
          return prev;
        });
      }
      // Close label popup on outside click
      if (!event.target.closest('.label-popup') && event.target !== textareaRef.current) {
        setLabelState(prev => {
          if (prev.isOpen) {
            return { ...prev, isOpen: false };
          }
          return prev;
        });
      }
    };
    
    document.addEventListener("click", handleOutsideClick);
    
    // Close mention/label popup on Esc key
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setMentionState(prev => {
          if (prev.isOpen) {
            return { ...prev, isOpen: false };
        }
          return prev;
        });
        setLabelState(prev => {
          if (prev.isOpen) {
            return { ...prev, isOpen: false };
        }
          return prev;
        });
      }
    };
    document.addEventListener('keydown', handleEsc);
    
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Filter commands based on query and chat type
  // In private chats, exclude 'everyone' command
  const filteredCommands = AVAILABLE_COMMANDS.filter(cmd => {
    // In private chats, exclude 'everyone' command
    if (!isMentionEnabled && cmd.command === 'everyone') return false;
    if (!mentionState.query) return true;
    return cmd.command.toLowerCase().startsWith(mentionState.query.toLowerCase());
  });

  // Helper function to filter labels based on query
  const getFilteredLabels = (query) => {
    if (!query) {
      return labelState.allLabels;
    }
    
    const queryLower = query.toLowerCase();
    return labelState.allLabels.filter(label => 
      label.toLowerCase().includes(queryLower) || 
      label.toLowerCase().startsWith(queryLower)
    );
  };

  // Filter and sort members based on mention query with fuzzy search and recent mentions priority
  const { matchedMembers, allMembersWithMatch } = (() => {
    if (!projectMembers || projectMembers.length === 0) {
      return { matchedMembers: [], allMembersWithMatch: [] };
    }
    
    const query = mentionState.query.toLowerCase();
    const membersWithScores = [];
    
    projectMembers.forEach(member => {
      // Use fuzzy matching for name and email
      const nameMatch = fuzzyMatch(member.name, query);
      const emailMatch = fuzzyMatch(member.email, query);
      
      // Take the best score
      const bestScore = Math.max(nameMatch.score, emailMatch.score);
      const isMatch = nameMatch.matches || emailMatch.matches;
      
      // Boost score for recently mentioned users
      let recentBoost = 0;
      const recentIndex = recentMentions.findIndex(email => email === member.email);
      if (recentIndex !== -1) {
        // More recent = higher boost (recentMentions[0] is most recent)
        recentBoost = 30 - recentIndex * 5; // 30, 25, 20, 15, 10, 5...
      }
      
      membersWithScores.push({
        ...member,
        isMatch,
        score: bestScore + recentBoost,
        isRecent: recentIndex !== -1
      });
    });
    
    // Sort by score (descending), then by recent mentions
    membersWithScores.sort((a, b) => {
      if (a.isMatch && !b.isMatch) return -1;
      if (!a.isMatch && b.isMatch) return 1;
      return b.score - a.score;
    });
    
    const matched = membersWithScores.filter(m => m.isMatch);
    const unmatched = membersWithScores.filter(m => !m.isMatch);
    
    return {
      matchedMembers: matched,
      allMembersWithMatch: [...matched, ...unmatched]
    };
  })();

  // Calculate ghost text (inline hint) based on first matched member or command
  const getGhostText = (query, mode) => {
    if (mode === 'commands' || mode === 'help') {
      // Ghost text for commands
      const cmdList = mode === 'help' ? AVAILABLE_COMMANDS : filteredCommands;
      if (cmdList.length > 0) {
        const firstCmd = cmdList[0];
        if (!query || query === '') {
          // No query - show full command name
          return firstCmd.command;
        } else if (firstCmd.command.toLowerCase().startsWith(query.toLowerCase())) {
          // Query matches - show remaining part
          return firstCmd.command.substring(query.length);
        } else {
          // Query doesn't match start but command is shown - show full name
          return firstCmd.command;
        }
      }
      return '';
    }
    
    // Ghost text for members
    if (matchedMembers.length === 0) return '';
    const firstMatch = matchedMembers[0];
    const name = firstMatch.name;
    
    if (!query || query === '') {
      // No query - show full name
      return name;
    } else if (name.toLowerCase().startsWith(query.toLowerCase())) {
    // If name starts with query, show the rest as ghost text
      return name.substring(query.length);
    } else {
      // Query doesn't match start but member is shown - show full name
      return name;
    }
  };

  // Handle input change and detect @ mentions and @label: commands
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Typing indicator: report typing when user types
    if (conversationId && value.trim().length > 0) {
      // Clear any pending stop typing timeout
      if (stopTypingTimeoutRef.current) {
        clearTimeout(stopTypingTimeoutRef.current);
        stopTypingTimeoutRef.current = null;
      }
      
      // Report typing (throttled internally)
      reportTyping(conversationId);
      
      // Set timeout to stop typing if input becomes empty
      stopTypingTimeoutRef.current = setTimeout(() => {
        // Check current input value (may have changed)
        const currentValue = textareaRef.current?.value || '';
        if (!currentValue.trim()) {
          stopTyping(conversationId);
        }
      }, 1500); // Stop typing after 1.5 seconds of no input (reduced from 2s)
    } else if (conversationId && value.trim().length === 0) {
      // Input is empty, stop typing immediately
      if (stopTypingTimeoutRef.current) {
        clearTimeout(stopTypingTimeoutRef.current);
      }
      stopTypingTimeoutRef.current = setTimeout(() => {
        stopTyping(conversationId);
      }, 500); // Stop typing after 0.5 seconds when input is cleared (reduced from 1s)
    }
    
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    
    // Check if we're in a @label or @label: context
    const labelMatchColon = textBeforeCursor.match(/@label:\s*([^\s\n]*)$/);
    const labelMatchNoColon = textBeforeCursor.match(/@label([:\s\n]|$)/);
    const labelMatch = labelMatchColon || labelMatchNoColon;
    
    if (labelMatch) {
      // Extract query - if it's @label:query, use query; if it's @label, use empty string
      const query = labelMatchColon ? labelMatchColon[1] : '';
      
      // Filter labels based on query
      const filtered = getFilteredLabels(query);
      
      // Get ghost text (first matching label)
      let ghostText = '';
      if (filtered.length > 0 && query) {
        const firstMatch = filtered[0];
        if (firstMatch.toLowerCase().startsWith(query.toLowerCase())) {
          ghostText = firstMatch.substring(query.length);
        }
      } else if (filtered.length > 0 && !query) {
        // If no query, show ghost text for first label (just the label name, no colon)
        ghostText = ' ' + filtered[0];
      }
      
      setLabelState({
        isOpen: true,
        query: query,
        selectedIndex: 0,
        ghostText: ghostText,
        allLabels: labelState.allLabels
      });
      
      // Close mention popup if open
      if (mentionState.isOpen) {
        setMentionState(prev => ({ ...prev, isOpen: false }));
      }
      return;
    } else {
      // Close label popup if not in @label context
      if (labelState.isOpen) {
        setLabelState(prev => ({ ...prev, isOpen: false }));
      }
    }
    
    // Check if we're in a mention context (@...)
    // Match @ followed by any characters until space, newline, or end of string
    const mentionMatch = textBeforeCursor.match(/@([^\s\n]*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1];
      
      // Determine mode based on query
      let mode = 'members';
      
      // If query is "help" or starts with "help", always show help mode with all commands
      if (query.toLowerCase() === 'help' || query.toLowerCase().startsWith('help')) {
        mode = 'help';
        // When entering help mode, we want to clear the query so it shows all commands
        // and start at index 0 (everyone)
        // But we need to handle this after getting ghost text
      } 
      // If query matches a command (like "everyone"), show commands mode
      // For private chats, only check commands that are available (label, code, help)
      else if (AVAILABLE_COMMANDS.some(cmd => {
        // In private chats, skip 'everyone' command check
        if (!isMentionEnabled && cmd.command === 'everyone') return false;
        return cmd.command.toLowerCase().startsWith(query.toLowerCase());
      })) {
        // Check if it could be a command vs a member name
        const couldBeCommand = AVAILABLE_COMMANDS.some(cmd => {
          // In private chats, skip 'everyone' command check
          if (!isMentionEnabled && cmd.command === 'everyone') return false;
          return cmd.command.toLowerCase().startsWith(query.toLowerCase());
        });
        const couldBeMember = isMentionEnabled && projectMembers.some(m => 
          m.name.toLowerCase().startsWith(query.toLowerCase()) || 
          m.email.toLowerCase().startsWith(query.toLowerCase())
        );
        
        // Prioritize commands if query matches a command better than a member
        if (couldBeCommand && !couldBeMember) {
          mode = 'commands';
        }
      }
      
      // If query is empty:
      // - In public chats: show members (with commands section at top)
      // - In private chats: show commands mode
      if (query === '') {
        mode = isMentionEnabled ? 'members' : 'commands';
      }
      
      // For private chats, only allow commands and help modes (not members)
      if (!isMentionEnabled && mode === 'members') {
        setMentionState(prev => ({ ...prev, isOpen: false, ghostText: '' }));
        return;
      }
      
      // For help mode, always start at index 0 and show first command as ghost text
      let finalQuery = query;
      let finalSelectedIndex = 0;
      let finalGhostText = '';
      let shouldUpdateInput = false;
      
      if (mode === 'help') {
        // In help mode, ignore the query and always show all commands starting at index 0
        // If they typed @help, replace it with just @ in the input
        if (query.toLowerCase() === 'help') {
          shouldUpdateInput = true;
        }
        finalQuery = '';
        finalSelectedIndex = 0;
        // Get first command excluding 'help' (and 'everyone' in private chats)
        const availableHelpCommands = AVAILABLE_COMMANDS.filter(cmd => {
          if (cmd.command === 'help') return false;
          if (!isMentionEnabled && cmd.command === 'everyone') return false;
          return true;
        });
        const firstCmd = availableHelpCommands[0];
        finalGhostText = firstCmd ? firstCmd.command : '';
      } else {
        finalGhostText = getGhostText(query, mode);
      }
      
      // Update input if entering help mode by typing @help
      if (shouldUpdateInput && textareaRef.current) {
        const cursorPos = textareaRef.current.selectionStart;
        const textBeforeCursor = inputValue.substring(0, cursorPos);
        const textAfterCursor = inputValue.substring(cursorPos);
        
        // Find the @ symbol
        const atIndex = textBeforeCursor.lastIndexOf('@');
        if (atIndex !== -1) {
          const newText = inputValue.substring(0, atIndex + 1) + textAfterCursor;
          setInputValue(newText);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.setSelectionRange(atIndex + 1, atIndex + 1);
            }
          }, 0);
        }
      }
      
      setMentionState({
        isOpen: true,
        query: finalQuery,
        selectedIndex: finalSelectedIndex,
        ghostText: finalGhostText,
        mode: mode
      });
    } else {
      setMentionState(prev => ({ ...prev, isOpen: false, ghostText: '', mode: 'members' }));
    }
  };

  // Insert selected mention into input
  const insertMention = (member) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = inputValue.substring(0, cursorPos);
    const textAfterCursor = inputValue.substring(cursorPos);
    
    // Find the @ mention to replace (match any characters after @)
    const mentionMatch = textBeforeCursor.match(/@([^\s\n]*)$/);
    if (mentionMatch) {
      const mentionStart = cursorPos - mentionMatch[0].length;
      const newText = 
        inputValue.substring(0, mentionStart) + 
        `@${member.name} ` + 
        textAfterCursor;
      
      setInputValue(newText);
      setMentionState(prev => ({ ...prev, isOpen: false, ghostText: '', mode: 'members' }));
      
      // Track this mention for recent mentions
      if (onMentionUsed && member.email) {
        onMentionUsed(member.email);
      }
      
      // Set cursor position after the inserted mention
      setTimeout(() => {
        const newCursorPos = mentionStart + `@${member.name} `.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }
  };

  // Insert selected label into input
  const insertLabel = (label) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = inputValue.substring(0, cursorPos);
    const textAfterCursor = inputValue.substring(cursorPos);
    
    // Find the @label or @label: command to replace
    const labelMatchColon = textBeforeCursor.match(/@label:\s*([^\s\n]*)$/);
    const labelMatchNoColon = textBeforeCursor.match(/@label([:\s\n]|$)/);
    const labelMatch = labelMatchColon || labelMatchNoColon;
    
    if (labelMatch) {
      const labelStart = cursorPos - labelMatch[0].length;
      const prefixText = inputValue.substring(0, labelStart);
      
      // Always insert with a space after the colon and after the label
      const insertionText = `@label: ${label} `;
      
      // Check if we need a space before (if there's text before and it doesn't end with space or newline)
      let spaceBefore = '';
      if (prefixText.length > 0) {
        const lastChar = prefixText.charAt(prefixText.length - 1);
        if (lastChar !== ' ' && lastChar !== '\n' && lastChar !== '') {
          spaceBefore = ' ';
        }
      }
      
      // Check if there's already a space after (to avoid double spaces)
      let spaceAfter = ' ';
      if (textAfterCursor.length > 0 && textAfterCursor.charAt(0) === ' ') {
        spaceAfter = '';
      }
      
      const newText = prefixText + spaceBefore + insertionText + spaceAfter + (textAfterCursor.trimStart());
      
      setInputValue(newText);
      setLabelState(prev => ({ ...prev, isOpen: false, ghostText: '' }));
      
      // Set cursor position after the inserted label (after the space)
      setTimeout(() => {
        const newCursorPos = prefixText.length + spaceBefore.length + insertionText.length + spaceAfter.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }
  };

  // Insert command into input
  const insertCommand = (command) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = inputValue.substring(0, cursorPos);
    const textAfterCursor = inputValue.substring(cursorPos);
    
    // Find the @ mention to replace
    const mentionMatch = textBeforeCursor.match(/@([^\s\n]*)$/);
    if (mentionMatch) {
      const mentionStart = cursorPos - mentionMatch[0].length;
      
      // Handle @everyone command
      if (command === 'everyone') {
        const newText = 
          inputValue.substring(0, mentionStart) + 
          `@everyone ` + 
          textAfterCursor;
        
        setInputValue(newText);
        setMentionState(prev => ({ ...prev, isOpen: false, ghostText: '', mode: 'members' }));
        
        setTimeout(() => {
          const newCursorPos = mentionStart + `@everyone `.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        }, 0);
      }
      // Handle @label command - insert @label: and open label popup
      else if (command === 'label') {
        const newText = 
          inputValue.substring(0, mentionStart) + 
          `@label: ` + 
          textAfterCursor;
        
        setInputValue(newText);
        setMentionState(prev => ({ ...prev, isOpen: false, ghostText: '', mode: 'members' }));
        
        // Open label popup
        setTimeout(() => {
          const newCursorPos = mentionStart + `@label: `.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          
          // Trigger label popup by simulating the input change
          const filtered = getFilteredLabels('');
          let ghostText = '';
          if (filtered.length > 0) {
            ghostText = ' ' + filtered[0];
          }
          
          setLabelState({
            isOpen: true,
            query: '',
            selectedIndex: 0,
            ghostText: ghostText,
            allLabels: labelState.allLabels
          });
          
          textarea.focus();
        }, 0);
      }
      // Handle @help command - remove "help" and show help popup with first command as ghost text
      else if (command === 'help') {
        // Replace @help (or partial @h, @he, etc.) with just @
        const newText = 
          inputValue.substring(0, mentionStart) + 
          '@' + 
          textAfterCursor;
        
        setInputValue(newText);
        
        // Set ghost text to first command (excluding help and 'everyone' in private chats)
        const availableHelpCommands = AVAILABLE_COMMANDS.filter(cmd => {
          if (cmd.command === 'help') return false;
          if (!isMentionEnabled && cmd.command === 'everyone') return false;
          return true;
        });
        const firstCmd = availableHelpCommands[0];
        const ghostText = firstCmd ? firstCmd.command : '';
        
        // Use setTimeout to set state after the click event has fully processed
        setTimeout(() => {
        setMentionState({
          isOpen: true,
          query: '',
            selectedIndex: 0, // Start at first command
          ghostText: ghostText,
          mode: 'help'
        });
        
          // Position cursor right after @
          const newCursorPos = mentionStart + 1;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        }, 10);
      }
    }
  };

  // Accept ghost text suggestion (Tab to autocomplete)
  const acceptGhostText = () => {
    if (!mentionState.ghostText) return false;
    
    if (mentionState.mode === 'commands' && filteredCommands.length > 0) {
      insertCommand(filteredCommands[mentionState.selectedIndex]?.command || filteredCommands[0].command);
      return true;
    }
    
    if (matchedMembers.length === 0) return false;
    const selectedMember = matchedMembers[mentionState.selectedIndex] || matchedMembers[0];
    insertMention(selectedMember);
    return true;
  };

  // Get current list items based on mode
  const getCurrentListItems = () => {
    if (mentionState.mode === 'help') {
      // Filter out 'help' command from the list when showing help menu
      // In private chats, also filter out 'everyone' command
      return AVAILABLE_COMMANDS.filter(cmd => {
        if (cmd.command === 'help') return false;
        if (!isMentionEnabled && cmd.command === 'everyone') return false;
        return true;
      });
    }
    if (mentionState.mode === 'commands') {
      return filteredCommands;
    }
    return matchedMembers;
  };

  // Handle keyboard navigation in label popup
  const handleLabelKeyDown = (e) => {
    if (!labelState.isOpen) return;
    
    const filtered = getFilteredLabels(labelState.query);
    if (filtered.length === 0) return;
    
    const itemCount = filtered.length;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = (labelState.selectedIndex + 1) % itemCount;
      let newGhostText = '';
      
      if (filtered[newIndex]) {
        const label = filtered[newIndex];
        // If no query, show full label with space prefix (no colon, since @label: already has it)
        if (!labelState.query) {
          newGhostText = ' ' + label;
        } else if (label.toLowerCase().startsWith(labelState.query.toLowerCase())) {
          newGhostText = label.substring(labelState.query.length);
        }
      }
      
      setLabelState(prev => ({ ...prev, selectedIndex: newIndex, ghostText: newGhostText }));
      setTimeout(() => {
        const selectedElement = labelPopupRef.current?.querySelector(`[data-label-index="${newIndex}"]`);
        selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = labelState.selectedIndex === 0 ? itemCount - 1 : labelState.selectedIndex - 1;
      let newGhostText = '';
      
      if (filtered[newIndex]) {
        const label = filtered[newIndex];
        // If no query, show full label with space prefix (no colon, since @label: already has it)
        if (!labelState.query) {
          newGhostText = ' ' + label;
        } else if (label.toLowerCase().startsWith(labelState.query.toLowerCase())) {
          newGhostText = label.substring(labelState.query.length);
        }
      }
      
      setLabelState(prev => ({ ...prev, selectedIndex: newIndex, ghostText: newGhostText }));
      setTimeout(() => {
        const selectedElement = labelPopupRef.current?.querySelector(`[data-label-index="${newIndex}"]`);
        selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Accept ghost text
      const filtered = getFilteredLabels(labelState.query);
      if (filtered.length > 0) {
        const selectedLabel = filtered[labelState.selectedIndex] || filtered[0];
        insertLabel(selectedLabel);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const filtered = getFilteredLabels(labelState.query);
      if (filtered[labelState.selectedIndex]) {
        insertLabel(filtered[labelState.selectedIndex]);
      }
    }
  };

  // Handle keyboard navigation in mention popup
  const handleMentionKeyDown = (e) => {
    if (!mentionState.isOpen) return;
    
    const currentItems = getCurrentListItems();
    if (currentItems.length === 0 && mentionState.mode !== 'help') return;
    
    const itemCount = mentionState.mode === 'help' ? getCurrentListItems().length : currentItems.length;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = (mentionState.selectedIndex + 1) % itemCount;
      let newGhostText = '';
      
      // If in help mode, also update the input to show just @ with selected command as ghost text
      if (mentionState.mode === 'help') {
        const availableCommands = getCurrentListItems();
        if (availableCommands[newIndex]) {
          const commandName = availableCommands[newIndex].command;
          newGhostText = commandName;
          
          // Update input to show just @ (remove any existing text after @)
          if (textareaRef.current) {
            const cursorPos = textareaRef.current.selectionStart;
            const textBeforeCursor = inputValue.substring(0, cursorPos);
            const textAfterCursor = inputValue.substring(cursorPos);
            
            // Find the @ symbol
            const atIndex = textBeforeCursor.lastIndexOf('@');
            if (atIndex !== -1) {
              const newText = inputValue.substring(0, atIndex + 1) + textAfterCursor;
              setInputValue(newText);
              setTimeout(() => {
                textareaRef.current.setSelectionRange(atIndex + 1, atIndex + 1);
              }, 0);
            }
          }
        }
      } else if (mentionState.mode === 'members' && matchedMembers[newIndex]) {
        const memberName = matchedMembers[newIndex].name;
        if (!mentionState.query || mentionState.query === '') {
          // No query - show full name
          newGhostText = memberName;
        } else if (memberName.toLowerCase().startsWith(mentionState.query.toLowerCase())) {
          // Query matches - show remaining part
          newGhostText = memberName.substring(mentionState.query.length);
        } else {
          // Query doesn't match start but member is shown - show full name
          newGhostText = memberName;
        }
      } else if (mentionState.mode === 'commands' && filteredCommands[newIndex]) {
        const commandName = filteredCommands[newIndex].command;
        if (!mentionState.query || mentionState.query === '') {
          // No query - show full command name
          newGhostText = commandName;
        } else if (commandName.toLowerCase().startsWith(mentionState.query.toLowerCase())) {
          // Query matches - show remaining part
          newGhostText = commandName.substring(mentionState.query.length);
        } else {
          // Query doesn't match start but command is shown - show full name
          newGhostText = commandName;
        }
      }
      
      setMentionState(prev => ({ ...prev, selectedIndex: newIndex, ghostText: newGhostText }));
      setTimeout(() => {
        const selectedElement = mentionPopupRef.current?.querySelector(`[data-mention-index="${newIndex}"]`);
        selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = mentionState.selectedIndex === 0 ? itemCount - 1 : mentionState.selectedIndex - 1;
      let newGhostText = '';
      
      // If in help mode, also update the input to show just @ with selected command as ghost text
      if (mentionState.mode === 'help') {
        const availableCommands = getCurrentListItems();
        if (availableCommands[newIndex]) {
          const commandName = availableCommands[newIndex].command;
          newGhostText = commandName;
          
          // Update input to show just @ (remove any existing text after @)
          if (textareaRef.current) {
            const cursorPos = textareaRef.current.selectionStart;
            const textBeforeCursor = inputValue.substring(0, cursorPos);
            const textAfterCursor = inputValue.substring(cursorPos);
            
            // Find the @ symbol
            const atIndex = textBeforeCursor.lastIndexOf('@');
            if (atIndex !== -1) {
              const newText = inputValue.substring(0, atIndex + 1) + textAfterCursor;
              setInputValue(newText);
              setTimeout(() => {
                textareaRef.current.setSelectionRange(atIndex + 1, atIndex + 1);
              }, 0);
            }
          }
        }
      } else if (mentionState.mode === 'members' && matchedMembers[newIndex]) {
        const memberName = matchedMembers[newIndex].name;
        if (!mentionState.query || mentionState.query === '') {
          // No query - show full name
          newGhostText = memberName;
        } else if (memberName.toLowerCase().startsWith(mentionState.query.toLowerCase())) {
          // Query matches - show remaining part
          newGhostText = memberName.substring(mentionState.query.length);
        } else {
          // Query doesn't match start but member is shown - show full name
          newGhostText = memberName;
        }
      } else if (mentionState.mode === 'commands' && filteredCommands[newIndex]) {
        const commandName = filteredCommands[newIndex].command;
        if (!mentionState.query || mentionState.query === '') {
          // No query - show full command name
          newGhostText = commandName;
        } else if (commandName.toLowerCase().startsWith(mentionState.query.toLowerCase())) {
          // Query matches - show remaining part
          newGhostText = commandName.substring(mentionState.query.length);
        } else {
          // Query doesn't match start but command is shown - show full name
          newGhostText = commandName;
        }
      }
      
      setMentionState(prev => ({ ...prev, selectedIndex: newIndex, ghostText: newGhostText }));
      setTimeout(() => {
        const selectedElement = mentionPopupRef.current?.querySelector(`[data-mention-index="${newIndex}"]`);
        selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (mentionState.mode === 'help') {
        // In help mode, Tab selects the command
        const availableCommands = getCurrentListItems();
        const cmd = availableCommands[mentionState.selectedIndex];
        if (cmd) insertCommand(cmd.command);
      } else {
        acceptGhostText();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (mentionState.mode === 'commands' || mentionState.mode === 'help') {
        const cmd = mentionState.mode === 'help' 
          ? getCurrentListItems()[mentionState.selectedIndex]
          : filteredCommands[mentionState.selectedIndex];
        if (cmd) insertCommand(cmd.command);
      } else if (matchedMembers[mentionState.selectedIndex]) {
        insertMention(matchedMembers[mentionState.selectedIndex]);
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // State Logic: Determine if we should be in Expanded or Compact mode
  useEffect(() => {
    const hasNewLine = inputValue.includes('\n');
    
    // Heuristic: If text is long enough, it likely wraps in compact mode (which has big padding).
    // To prevent jitter, we keep it expanded if it's moderately long.
    // Compact mode text width is narrow (~500px). 60 chars is a safe threshold.
    const isLong = inputValue.length > 60; 
    
    const shouldBeExpanded = hasNewLine || isLong;

    if (shouldBeExpanded !== isExpanded) {
      setIsExpanded(shouldBeExpanded);
    }
  }, [inputValue, isExpanded]);

  // View Logic: specific height handling to ensure smooth animation
  useLayoutEffect(() => {
    // We use a shadow element to measure the exact target height.
    // This avoids the issue where the real textarea reports the wrong scrollHeight
    // because it is currently animating its padding.
    if (isExpanded && shadowRef.current && textareaRef.current) {
      // Reset shadow height to get accurate measurement
      shadowRef.current.style.height = 'auto';
      const targetHeight = shadowRef.current.scrollHeight;
      // Use the measured height directly, but ensure it's reasonable
      const newHeight = Math.min(Math.max(targetHeight, 40), 200);
      textareaRef.current.style.height = `${newHeight}px`;
    } else if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }
  }, [inputValue, isExpanded]);

  //0 = Capture Visible Part
  //1 = Capture Selected Area
  //2 = Capture Full Page
  function screenshotShortcut(index) {
    // Ensure extension sidebar is visible and loaded
    if (!isExtensionSidebarVisible) {
      setIsExtensionSidebarVisible(true);
      document.getElementById("sidebar-iframe").src = "extension/popup.html";
      // Wait for iframe to load before sending message
      setTimeout(() => {
        try {
          document.getElementById("sidebar-iframe").contentWindow.postMessage({ action: "screenshotShortcut", type: index }, "*");
        } catch (error) {
          console.error("Error sending screenshot message:", error);
        }
      }, 1000);
    } else {
      try {
        document.getElementById("sidebar-iframe").contentWindow.postMessage({ action: "screenshotShortcut", type: index }, "*");
      } catch (error) {
        console.error("Error sending screenshot message:", error);
      }
    }
    // Close the dropdown after clicking
    setIsScreenshotShortcutsVisible(false);
  }

  async function downloadFullPageScreenshot() {
    if (currentUserRole === 'viewer') return;
    try {
      const filename = `fullpage-screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;

      const originalUnifiedCardInlineStyles = new Map();

      const prepareUnifiedCardsForScreenshot = async (rootDoc, includeScrollOffsets = false) => {
        try {
          const cards = Array.from(rootDoc.querySelectorAll('.phraze-unified-annotation-card'));
          // Ensure cards are visible so they have measurable dimensions
          cards.forEach((card) => {
            try {
              if (rootDoc === document && !originalUnifiedCardInlineStyles.has(card)) {
                originalUnifiedCardInlineStyles.set(card, card.getAttribute('style'));
              }
              card.classList.add('active');
              card.style.display = '';
              card.style.visibility = 'visible';
              card.style.opacity = '1';
              card.style.pointerEvents = 'auto';
            } catch (e) {
              // best-effort
            }
          });

          // Wait a frame so layout settles before measuring
          await new Promise((resolve) => requestAnimationFrame(resolve));

          const scrollX = includeScrollOffsets ? (window.scrollX || 0) : 0;
          const scrollY = includeScrollOffsets ? (window.scrollY || 0) : 0;

          cards.forEach((card) => {
            try {
              const highlightId = card?.dataset?.highlightId;
              if (!highlightId) return;

              // Highlight mark has data-highlight-id set in highlighting.js
              const mark = rootDoc.querySelector(`mark.PhrazeHighlight[data-highlight-id="${highlightId}"]`);
              if (!mark) return;

              const rect = mark.getBoundingClientRect();
              // Card must be visible to measure height
              const cardRect = card.getBoundingClientRect();
              if (!cardRect || !cardRect.height) return;

              const left = rect.left + rect.width / 2 + scrollX;
              const top = rect.top + scrollY - cardRect.height - 8;

              card.style.position = 'absolute';
              card.style.left = `${left}px`;
              card.style.top = `${Math.max(0, top)}px`;
              card.style.transform = 'translateX(-50%)';
            } catch (e) {
              // best-effort
            }
          });

          // Another frame to apply positions before capture
          await new Promise((resolve) => requestAnimationFrame(resolve));
        } catch (e) {
          // best-effort
        }
      };

      // Force all unified annotation cards to show before screenshot (like startCapture flow)
      await loadHighlights(true);

      // Make + position all unified annotation cards for screenshot
      await prepareUnifiedCardsForScreenshot(document, true);

      // Ensure fonts/layout are ready before capture
      if (document.fonts && typeof document.fonts.ready?.then === 'function') {
        await document.fonts.ready;
      }

      const docEl = document.documentElement;
      const bodyEl = document.body;
      const fullWidth = Math.max(
        docEl?.scrollWidth || 0,
        docEl?.offsetWidth || 0,
        bodyEl?.scrollWidth || 0,
        bodyEl?.offsetWidth || 0,
        window.innerWidth
      );
      const fullHeight = Math.max(
        docEl?.scrollHeight || 0,
        docEl?.offsetHeight || 0,
        bodyEl?.scrollHeight || 0,
        bodyEl?.offsetHeight || 0,
        window.innerHeight
      );

      // If the app uses nested scrolling (e.g., chat list), document/body scrollHeight may be only the viewport.
      // Include the nested scroll height + its offset so the screenshot includes the entire chat.
      let computedFullHeight = fullHeight;
      const chatMessagesDiv = document.getElementById('chatMessagesDiv');
      if (chatMessagesDiv && chatMessagesDiv.scrollHeight > chatMessagesDiv.clientHeight) {
        const rect = chatMessagesDiv.getBoundingClientRect();
        const topOffset = rect.top + window.scrollY;
        computedFullHeight = Math.max(computedFullHeight, topOffset + chatMessagesDiv.scrollHeight + 32);
      }

      const captureUiButtonMetrics = (el) => {
        try {
          if (!el) return null;
          const cs = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            width: `${Math.ceil(r.width)}px`,
            height: `${Math.ceil(r.height)}px`,
            padding: cs.padding,
            border: cs.border,
            borderRadius: cs.borderRadius,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            color: cs.color,
            backgroundColor: cs.backgroundColor,
            lineHeight: cs.lineHeight
          };
        } catch (e) {
          return null;
        }
      };

      const findButtonByExactText = (text) => {
        try {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find((b) => (b.textContent || '').trim() === text) || null;
        } catch (e) {
          return null;
        }
      };

      const uiButtonMetrics = {
        annotate: captureUiButtonMetrics(findButtonByExactText('Annotate')),
        sidebar: captureUiButtonMetrics(findButtonByExactText('Sidebar')),
        modelToggle: captureUiButtonMetrics(document.querySelector('.model-dropdown-container button')),
        privacyPublic: captureUiButtonMetrics(findButtonByExactText('Public')),
        privacyPrivate: captureUiButtonMetrics(findButtonByExactText('Private'))
      };

      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scale: window.devicePixelRatio || 1,
        // Explicitly force full-page dimensions (prevents cropped images)
        width: fullWidth,
        height: computedFullHeight,
        x: 0,
        y: 0,
        windowWidth: fullWidth,
        windowHeight: computedFullHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          // IMPORTANT: only modify the cloned DOM so the live UI is unchanged.
          try {
            // Ensure the top-level page can grow to full height
            const body = clonedDoc.body;
            const html = clonedDoc.documentElement;
            if (body) body.style.overflow = 'visible';
            if (html) html.style.overflow = 'visible';

            // Force solid white base in the cloned DOM so UI elements don't look translucent in the capture.
            if (body) body.style.backgroundColor = '#ffffff';
            if (html) html.style.backgroundColor = '#ffffff';

            // Force root nodes to full size in clone so html2canvas has real layout to paint
            if (body) {
              body.style.width = `${fullWidth}px`;
              body.style.height = `${computedFullHeight}px`;
            }
            if (html) {
              html.style.width = `${fullWidth}px`;
              html.style.height = `${computedFullHeight}px`;
            }

            // Expand nested scroll containers so their full contents render into the screenshot.
            // This is crucial for UIs where the main content area scrolls inside a fixed layout.
            const all = clonedDoc.querySelectorAll('*');
            all.forEach((el) => {
              try {
                // Only expand elements that actually scroll
                if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {
                  const cs = clonedDoc.defaultView?.getComputedStyle(el);
                  if (!cs) return;
                  const overflowY = cs.overflowY;
                  const overflowX = cs.overflowX;
                  const shouldExpandY = overflowY === 'auto' || overflowY === 'scroll';
                  const shouldExpandX = overflowX === 'auto' || overflowX === 'scroll';

                  if (shouldExpandY) {
                    el.style.overflowY = 'visible';
                    el.style.height = `${el.scrollHeight}px`;
                    el.style.maxHeight = 'none';
                  }
                  if (shouldExpandX) {
                    el.style.overflowX = 'visible';
                    el.style.width = `${el.scrollWidth}px`;
                    el.style.maxWidth = 'none';
                  }
                }
              } catch (e) {
                // best-effort
              }
            });
        } catch (e) {
          // best-effort
        }

        try {
          // Normalize the Activity / Messages toggle in the sidebar (clone-only)
          // For this specific toggle, most styling is inline; in the clone that can render with artifacts.
          // Strip inline styles for the wrapper + buttons, then re-apply a stable "pill + buttons" style.
          const dv = clonedDoc.defaultView;
          const sidebarToggleButtons = Array.from(clonedDoc.querySelectorAll('button')).filter((btn) => {
            const text = (btn.textContent || '').trim();
            return text === 'Activity' || text === 'Messages';
          });

          if (sidebarToggleButtons.length > 0) {
            const parentContainer = sidebarToggleButtons[0].parentElement;
            const activeByText = {};
            const btnLayoutByText = {};
            const parentLayout = {};
            const setImp = (el, prop, value) => {
              try {
                el?.style?.setProperty(prop, value, 'important');
              } catch (e) {
                // best-effort
              }
            };
            const annotateMetrics = uiButtonMetrics?.annotate;

            sidebarToggleButtons.forEach((btn) => {
              const text = (btn.textContent || '').trim();
              const cs = dv?.getComputedStyle(btn);

              // Detect which side is active before stripping inline styles.
              // Active side has a non-transparent background in the live UI.
              const bg = cs?.backgroundColor;
              activeByText[text] = !!(bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent');

              // Preserve layout metrics that affect html2canvas painting.
              btnLayoutByText[text] = {
                height: cs?.height,
                padding: cs?.padding,
                borderRadius: cs?.borderRadius,
                fontSize: cs?.fontSize,
                fontWeight: cs?.fontWeight,
                lineHeight: cs?.lineHeight
              };
            });

            const normalizedToggleHeight = (() => {
              try {
                const annotateH = annotateMetrics?.height;
                const annotateN = typeof annotateH === 'string' ? parseFloat(annotateH) : NaN;
                if (Number.isFinite(annotateN) && annotateN > 0) return `${Math.ceil(annotateN)}px`;

                const heights = sidebarToggleButtons
                  .map((btn) => {
                    const t = (btn.textContent || '').trim();
                    const h = btnLayoutByText[t]?.height;
                    const n = typeof h === 'string' ? parseFloat(h) : NaN;
                    return Number.isFinite(n) ? n : null;
                  })
                  .filter((n) => n != null);

                const maxH = heights.length ? Math.max(...heights) : null;
                // Fallback: if layout heights are missing, use the wrapper's min-height or a sane default.
                if (maxH && maxH > 0) return `${Math.ceil(maxH)}px`;
                const wrapperMin = typeof parentLayout.minHeight === 'string' ? parseFloat(parentLayout.minHeight) : NaN;
                if (Number.isFinite(wrapperMin) && wrapperMin > 0) return `${Math.ceil(wrapperMin)}px`;
                return '50px';
              } catch (e) {
                return '50px';
              }
            })();

            if (parentContainer) {
              const pcs = dv?.getComputedStyle(parentContainer);
              parentLayout.width = pcs?.width;
              parentLayout.margin = pcs?.margin;
              parentLayout.minHeight = pcs?.minHeight;
              parentLayout.boxSizing = pcs?.boxSizing;
              parentLayout.borderRadius = pcs?.borderRadius;
              parentLayout.padding = pcs?.padding;
              parentLayout.gap = pcs?.gap;

              // Remove inline styles in clone, then rebuild deterministic styles.
              try {
                parentContainer.removeAttribute('style');
              } catch (e) {
                // best-effort
              }

              sidebarToggleButtons.forEach((btn) => {
                try {
                  btn.removeAttribute('style');
                } catch (e) {
                  // best-effort
                }
              });

              // Re-apply pill wrapper styles (match the toggle pattern used elsewhere)
              setImp(parentContainer, 'display', 'flex');
              setImp(parentContainer, 'align-items', 'center');
              if (parentLayout.width) setImp(parentContainer, 'width', parentLayout.width);
              if (parentLayout.margin) setImp(parentContainer, 'margin', parentLayout.margin);
              if (parentLayout.minHeight) setImp(parentContainer, 'min-height', parentLayout.minHeight);
              if (parentLayout.boxSizing) setImp(parentContainer, 'box-sizing', parentLayout.boxSizing);
              setImp(parentContainer, 'background', '#f3f4f6');
              setImp(parentContainer, 'background-color', '#f3f4f6');
              setImp(parentContainer, 'background-image', 'none');
              setImp(parentContainer, 'border-radius', parentLayout.borderRadius || '10px');
              setImp(parentContainer, 'padding', parentLayout.padding || '5px');
              setImp(parentContainer, 'gap', parentLayout.gap || '4px');
              setImp(parentContainer, 'border', 'none');
              setImp(parentContainer, 'outline', 'none');
              setImp(parentContainer, 'box-shadow', 'none');
              setImp(parentContainer, 'opacity', '1');
              setImp(parentContainer, 'filter', 'none');
              setImp(parentContainer, 'backdrop-filter', 'none');
              setImp(parentContainer, '-webkit-backdrop-filter', 'none');
              setImp(parentContainer, 'mix-blend-mode', 'normal');
              setImp(parentContainer, 'isolation', 'isolate');

              const activeText = activeByText.Activity ? 'Activity' : activeByText.Messages ? 'Messages' : 'Activity';

              // Re-apply button styles (Public/Private style: both visible, active selected)
              sidebarToggleButtons.forEach((btn) => {
                const text = (btn.textContent || '').trim();
                const layout = btnLayoutByText[text] || {};
                const isActive = text === activeText;
                const desiredRadius = annotateMetrics?.borderRadius || layout.borderRadius || '12px';
                const desiredPadding = annotateMetrics?.padding || layout.padding || '10px 14px';
                const desiredFontSize = annotateMetrics?.fontSize || layout.fontSize || '0.875rem';
                const desiredFontWeight = '600';
                const desiredLineHeight = annotateMetrics?.lineHeight || layout.lineHeight || null;
                const desiredTextColor = isActive ? (annotateMetrics?.color || '#111111') : '#6b7280';
                const desiredBg = isActive ? '#ffffff' : 'transparent';

                setImp(btn, 'flex', '1 1 0%');
                setImp(btn, 'padding', desiredPadding);
                // Toggle segments inside the pill should not have an outer border.
                setImp(btn, 'border', 'none');
                setImp(btn, 'outline', 'none');
                setImp(btn, 'border-radius', desiredRadius);
                setImp(btn, 'background', desiredBg);
                setImp(btn, 'background-color', desiredBg);
                setImp(btn, 'background-image', 'none');
                setImp(btn, 'color', desiredTextColor);
                setImp(btn, 'font-weight', desiredFontWeight);
                setImp(btn, 'font-size', desiredFontSize);
                if (desiredLineHeight) setImp(btn, 'line-height', desiredLineHeight);
                setImp(btn, 'height', normalizedToggleHeight);
                setImp(btn, 'cursor', 'default');
                setImp(btn, 'transition', 'none');
                setImp(btn, 'box-shadow', 'none');
                setImp(btn, 'opacity', '1');
                setImp(btn, 'filter', 'none');
                setImp(btn, 'transform', 'none');
                setImp(btn, 'backdrop-filter', 'none');
                setImp(btn, '-webkit-backdrop-filter', 'none');
                setImp(btn, 'appearance', 'none');
                setImp(btn, '-webkit-appearance', 'none');
                setImp(btn, 'mix-blend-mode', 'normal');
                setImp(btn, 'isolation', 'isolate');

                setImp(btn, 'display', 'flex');
                setImp(btn, 'align-items', 'center');
                setImp(btn, 'justify-content', 'center');
                setImp(btn, 'gap', '8px');

                // Strip any artifacts from descendants (svg/spans) inside the toggle.
                const inner = Array.from(btn.querySelectorAll('*'));
                inner.forEach((el) => {
                  setImp(el, 'filter', 'none');
                  setImp(el, 'backdrop-filter', 'none');
                  setImp(el, '-webkit-backdrop-filter', 'none');
                  setImp(el, 'box-shadow', 'none');
                  setImp(el, 'outline', 'none');
                  setImp(el, 'transform', 'none');
                  setImp(el, 'opacity', '1');
                });
              });
            }
          }

          // Ensure unified annotation cards are visible + positioned in the cloned DOM
          const cards = Array.from(clonedDoc.querySelectorAll('.phraze-unified-annotation-card'));
          cards.forEach((card) => {
            try {
              // html2canvas does not reliably render backdrop-filter / translucent backgrounds.
              // Force the top "Annotate" / "Sidebar" toggle buttons to paint like the live UI.
              const candidateButtons = Array.from(clonedDoc.querySelectorAll('button'));
              candidateButtons.forEach((btn) => {
                const label = (btn.textContent || '').trim();
                if (label !== 'Annotate' && label !== 'Sidebar' && label !== 'Public' && label !== 'Private') return;

                const metrics =
                  label === 'Annotate'
                    ? uiButtonMetrics?.annotate
                    : label === 'Sidebar'
                      ? uiButtonMetrics?.sidebar
                      : label === 'Public'
                        ? uiButtonMetrics?.privacyPublic
                        : uiButtonMetrics?.privacyPrivate;
                if (metrics) {
                  btn.style.width = metrics.width;
                  btn.style.height = metrics.height;
                  btn.style.padding = metrics.padding;
                  btn.style.border = metrics.border;
                  btn.style.borderRadius = metrics.borderRadius;
                  btn.style.fontSize = metrics.fontSize;
                  btn.style.fontWeight = metrics.fontWeight;
                  btn.style.lineHeight = metrics.lineHeight;
                }

                if (label === 'Annotate') {
                  btn.style.fontWeight = '600';
                }

                // Match the live UI's selected/unselected background, but force it to be opaque (no alpha)
                const desiredBg =
                  metrics?.backgroundColor && metrics.backgroundColor !== 'rgba(0, 0, 0, 0)' && metrics.backgroundColor !== 'transparent'
                    ? metrics.backgroundColor
                    : 'transparent';
                btn.style.background = desiredBg;
                btn.style.backgroundColor = desiredBg;
                btn.style.backgroundImage = 'none';
                btn.style.boxShadow = 'none';
                btn.style.mixBlendMode = 'normal';
                btn.style.isolation = 'isolate';
                // Preserve live computed color when possible (Public/Private inactive uses gray)
                btn.style.color = metrics?.color || '#111827';
                btn.style.opacity = '1';
                btn.style.backdropFilter = 'none';
                btn.style.webkitBackdropFilter = 'none';
                btn.style.filter = 'none';
                btn.style.transform = 'none';

                // Sometimes the visual background is applied to a wrapper; ensure it also paints.
                const parent = btn.parentElement;
                if (parent) {
                  const pcs = clonedDoc.defaultView?.getComputedStyle(parent);
                  if (pcs && (pcs.backdropFilter && pcs.backdropFilter !== 'none')) {
                    parent.style.backdropFilter = 'none';
                    parent.style.webkitBackdropFilter = 'none';
                  }
                  if (pcs && (pcs.backgroundColor === 'rgba(0, 0, 0, 0)' || pcs.backgroundColor === 'transparent')) {
                    parent.style.background = 'transparent';
                    parent.style.backgroundColor = 'transparent';
                  }

                  // Public/Private toggle lives inside a pill wrapper with gray background; force it to paint solid.
                  if (label === 'Public' || label === 'Private') {
                    parent.style.background = '#f3f4f6';
                    parent.style.backgroundColor = '#f3f4f6';
                    parent.style.backgroundImage = 'none';
                    parent.style.opacity = '1';
                    parent.style.filter = 'none';
                    parent.style.backdropFilter = 'none';
                    parent.style.webkitBackdropFilter = 'none';
                  }

                  // If buttons live in a header wrapper with translucent background, force it to solid white.
                  const grand = parent.parentElement;
                  if (grand) {
                    const gcs = clonedDoc.defaultView?.getComputedStyle(grand);
                    if (gcs && gcs.backgroundColor && gcs.backgroundColor !== 'rgba(0, 0, 0, 0)' && gcs.backgroundColor !== 'transparent') {
                      grand.style.backgroundColor = '#ffffff';
                      grand.style.backgroundImage = 'none';
                      grand.style.backdropFilter = 'none';
                      grand.style.webkitBackdropFilter = 'none';
                      grand.style.filter = 'none';
                      grand.style.opacity = '1';
                    }
                  }
                }
              });

              // Also force the model selection dropdown (top-left) to use solid white backgrounds.
              const modelDropdownContainers = Array.from(clonedDoc.querySelectorAll('.model-dropdown-container'));
              modelDropdownContainers.forEach((container) => {
                try {
                  // Strip dropdown inline styles in the clone to avoid html2canvas rendering artifacts.
                  // Keep the container positioning intact (it's what places the control in the header).
                  container.style.backdropFilter = 'none';
                  container.style.webkitBackdropFilter = 'none';

                  const dropdownEls = Array.from(container.querySelectorAll('*'));
                  dropdownEls.forEach((el) => {
                    try {
                      el.removeAttribute('style');
                    } catch (e) {
                      // best-effort
                    }
                  });

                  const toggleBtn = container.querySelector('button');
                  if (toggleBtn) {
                    toggleBtn.style.backgroundColor = '#ffffff';
                    toggleBtn.style.border = '1px solid #e5e7eb';
                    toggleBtn.style.borderRadius = '12px';
                    toggleBtn.style.padding = '8px 12px';
                    toggleBtn.style.color = '#111827';
                    if (uiButtonMetrics?.modelToggle) {
                      toggleBtn.style.width = uiButtonMetrics.modelToggle.width;
                      toggleBtn.style.height = uiButtonMetrics.modelToggle.height;
                      toggleBtn.style.padding = uiButtonMetrics.modelToggle.padding;
                      toggleBtn.style.border = uiButtonMetrics.modelToggle.border;
                      toggleBtn.style.borderRadius = uiButtonMetrics.modelToggle.borderRadius;
                      toggleBtn.style.fontSize = uiButtonMetrics.modelToggle.fontSize;
                      toggleBtn.style.fontWeight = uiButtonMetrics.modelToggle.fontWeight;
                      toggleBtn.style.lineHeight = uiButtonMetrics.modelToggle.lineHeight;
                    }
                    toggleBtn.style.display = 'flex';
                    toggleBtn.style.alignItems = 'center';
                    toggleBtn.style.justifyContent = 'space-between';
                    toggleBtn.style.gap = '8px';
                    toggleBtn.style.lineHeight = '1';
                    toggleBtn.style.boxShadow = 'none';
                    toggleBtn.style.transform = 'none';
                    toggleBtn.style.backdropFilter = 'none';
                    toggleBtn.style.webkitBackdropFilter = 'none';

                    const labelSpan = toggleBtn.querySelector('span');
                    if (labelSpan) {
                      labelSpan.style.display = 'inline-block';
                      labelSpan.style.whiteSpace = 'nowrap';
                    }

                    const arrowSvg = toggleBtn.querySelector('svg');
                    if (arrowSvg) {
                      arrowSvg.style.display = 'block';
                      arrowSvg.style.flexShrink = '0';
                    }
                  }

                  // Dropdown menu is rendered as an absolutely positioned div under the toggle button.
                  const menuDivs = Array.from(container.querySelectorAll('div'));
                  menuDivs.forEach((menu) => {
                    const mcs = clonedDoc.defaultView?.getComputedStyle(menu);
                    if (!mcs) return;
                    const isMenu = mcs.position === 'absolute' && (mcs.top === '100%' || menu.style.top === '100%');
                    if (!isMenu) return;

                    menu.style.backgroundColor = '#ffffff';
                    menu.style.border = '1px solid #e5e7eb';
                    menu.style.borderRadius = '12px';
                    menu.style.boxShadow = 'none';
                    menu.style.backdropFilter = 'none';
                    menu.style.webkitBackdropFilter = 'none';
                    menu.style.overflow = 'hidden';

                    // Normalize option buttons inside the menu.
                    const optionButtons = Array.from(menu.querySelectorAll('button'));
                    optionButtons.forEach((b, idx) => {
                      b.style.width = '100%';
                      b.style.backgroundColor = '#ffffff';
                      b.style.border = 'none';
                      b.style.textAlign = 'left';
                      b.style.padding = '10px 12px';
                      b.style.color = '#111827';
                      b.style.boxShadow = 'none';
                      b.style.transform = 'none';
                      b.style.borderBottom = idx < optionButtons.length - 1 ? '1px solid #f3f4f6' : 'none';
                    });
                  });
                } catch (e) {
                  // best-effort
                }
              });
            } catch (e) {
              // best-effort
            }

            try {
              const clonedMarks = clonedDoc.querySelectorAll('mark.PhrazeHighlight');
              clonedMarks.forEach((originalMark) => {
                if (!originalMark.childNodes || originalMark.childNodes.length === 0) return;
                const textNode = originalMark.childNodes[0];
                const textContent = textNode.textContent || '';
                if (!textContent) return;

                const range = clonedDoc.createRange();
                const newRanges = [];
                let rangeStart = 0;
                for (let i = 0; i < textContent.length; ++i) {
                  range.setStart(textNode, 0);
                  range.setEnd(textNode, i + 1);
                  const lineIndex = range.getClientRects().length - 1;
                  if (newRanges.length === lineIndex) {
                    newRanges.push([rangeStart, i]);
                    rangeStart = i;
                  }
                }
                newRanges.splice(0, 1);
                if (rangeStart < textContent.length) {
                  newRanges.push([rangeStart, textContent.length]);
                }

                const parent = originalMark.parentNode;
                if (!parent) return;
                newRanges.forEach((r) => {
                  const mark = clonedDoc.createElement('mark');
                  try {
                    // Preserve highlight metadata + user-selected color (e.g. --highlight-color)
                    if (originalMark.className) mark.className = originalMark.className;
                    Array.from(originalMark.attributes || []).forEach((attr) => {
                      if (attr && attr.name && attr.name !== 'id') {
                        mark.setAttribute(attr.name, attr.value);
                      }
                    });
                    if (originalMark.style && originalMark.style.cssText) {
                      mark.style.cssText = originalMark.style.cssText;
                    }
                  } catch (e) {
                    // best-effort
                  }
                  mark.textContent = textContent.slice(r[0], r[1]);
                  parent.insertBefore(mark, originalMark);
                });
                parent.removeChild(originalMark);
              });
            } catch (e) {
              // best-effort
            }

            try {
              // Ensure unified annotation cards are visible + positioned in the cloned DOM
              const cards = Array.from(clonedDoc.querySelectorAll('.phraze-unified-annotation-card'));
              cards.forEach((card) => {
                try {
                  // html2canvas tends to exaggerate shadows / backdrop blur; keep cards crisp in the capture.
                  card.style.boxShadow = 'none';
                  card.style.filter = 'none';
                  card.style.backdropFilter = 'none';
                  card.style.webkitBackdropFilter = 'none';
                  if (!card.style.backgroundColor || card.style.backgroundColor === 'transparent' || card.style.backgroundColor === 'rgba(0, 0, 0, 0)') {
                    card.style.backgroundColor = '#ffffff';
                  }

                  card.classList.add('active');
                  card.style.display = '';
                  card.style.visibility = 'visible';
                  card.style.opacity = '1';
                  card.style.pointerEvents = 'auto';
                } catch (e) {
                  // best-effort
                }
              });

              cards.forEach((card) => {
                try {
                  const highlightId = card?.dataset?.highlightId;
                  if (!highlightId) return;
                  const mark = clonedDoc.querySelector(`mark.PhrazeHighlight[data-highlight-id="${highlightId}"]`);
                  if (!mark) return;
                  const rect = mark.getBoundingClientRect();
                  const cardRect = card.getBoundingClientRect();
                  if (!cardRect || !cardRect.height) return;

                  const left = rect.left + rect.width / 2;
                  const top = rect.top - cardRect.height - 8;

                  card.style.position = 'absolute';
                  card.style.left = `${left}px`;
                  card.style.top = `${Math.max(0, top)}px`;
                  card.style.transform = 'translateX(-50%)';
                } catch (e) {
                  // best-effort
                }
              });
            } catch (e) {
              // best-effort
            }

            });
          } catch (e) {
            // best-effort
          }
        }
      });

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      // Restore unified annotation cards to their original state after screenshot
      const cardsToRestore = document.querySelectorAll('.phraze-unified-annotation-card');
      cardsToRestore.forEach(card => {
        try {
          const oldStyle = originalUnifiedCardInlineStyles.get(card);
          if (oldStyle === null || oldStyle === undefined) {
            card.removeAttribute('style');
          } else {
            card.setAttribute('style', oldStyle);
          }
        } catch (e) {
          // best-effort
        }
        // Only hide cards that weren't sticky (clicked to stay open)
        if (!card.classList.contains('sticky')) {
          card.classList.remove('active');
          card.style.opacity = '0';
          card.style.pointerEvents = 'none';
          card.style.visibility = 'hidden';
        }
      });
    } catch (error) {
      console.error('Failed to capture full page screenshot:', error);
      try {
        showToast('Failed to take screenshot.', 'error');
      } catch (e) {
        // ignore
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        position: 'relative'
      }}
    >
      {/* Image preview area */}
      {imagePreview && (
        <div style={{
          marginBottom: '0.5rem',
          position: 'relative',
          maxWidth: '200px'
        }}>
          <img
            src={imagePreview}
            alt="Preview"
            style={{
              maxWidth: '100%',
              borderRadius: '0.5rem',
              border: '1px solid rgba(0,0,0,0.1)'
            }}
          />
          <button
            type="button"
            onClick={clearImagePreview}
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              background: 'rgba(0,0,0,0.6)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            aria-label="Remove image"
          >
            ✕
          </button>
        </div>
      )}

      {isSharedView && !currentUser && (
        <div style={{
          padding: '0.5rem',
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
          color: '#6b7280',
          backgroundColor: '#f9fafb',
          borderRadius: '0.5rem',
          textAlign: 'center'
        }}>
          Please log in to reply to this shared chat.
        </div>
      )}
      <div 
        ref={inputContainerRef}
        style={{
          position: 'relative',
          width: '100%',
          backgroundColor: '#fff',
          borderRadius: '24px',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: '#e5e7eb',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          padding: '12px',
          transition: 'box-shadow 0.3s ease-in-out, border-color 0.3s ease-in-out',
          opacity: currentUserRole === 'viewer' ? 0.5 : 1,
          cursor: currentUserRole === 'viewer' ? 'not-allowed' : 'default',
          userSelect: currentUserRole === 'viewer' ? 'none' : 'auto'
        }}
        onMouseEnter={(e) => {
          if (currentUserRole !== 'viewer') {
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)';
            e.currentTarget.style.borderColor = '#d1d5db';
          }
        }}
        onMouseLeave={(e) => {
          if (currentUserRole !== 'viewer') {
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
            e.currentTarget.style.borderColor = '#e5e7eb';
          }
        }}
        onFocus={(e) => {
          if (currentUserRole !== 'viewer') {
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0, 0, 0, 0.05)';
          }
        }}
        onBlur={(e) => {
          if (currentUserRole !== 'viewer') {
            e.currentTarget.style.borderColor = '#e5e7eb';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
          }
        }}
      >
        {/* SHADOW TEXTAREA FOR MEASUREMENT */}
        <textarea
          ref={shadowRef}
          value={inputValue}
          readOnly
          rows={1}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: -50,
            visibility: 'hidden',
            width: '100%',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '16px',
            lineHeight: '1.625',
            resize: 'none',
            padding: '8px', // Matches textarea padding
            boxSizing: 'border-box'
          }}
        />
        {/* Label Popup - positioned above the input */}
        {labelState.isOpen && (
          <div
            ref={labelPopupRef}
            className="label-popup"
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '0',
              marginBottom: '8px',
              backgroundColor: 'white',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '12px',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
              zIndex: 10000,
              maxHeight: '280px',
              overflowY: 'auto',
              minWidth: '300px',
              maxWidth: '360px',
              padding: '6px'
            }}
          >
            {/* Labels List */}
            {(() => {
              const filtered = getFilteredLabels(labelState.query);
              if (filtered.length === 0) {
                return (
                  <div style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    color: '#9ca3af',
                    fontSize: '13px'
                  }}>
                    No labels found matching "{labelState.query}"
                  </div>
                );
              }
              
              // Group labels by category (predefined groups first, then custom)
              const predefinedLabels = [];
              const customLabelsList = [];
              
              filtered.forEach(label => {
                let isPredefined = false;
                Object.values(LABEL_GROUPS).forEach(groupLabels => {
                  if (groupLabels.includes(label)) {
                    isPredefined = true;
                  }
                });
                
                if (isPredefined) {
                  predefinedLabels.push(label);
                } else {
                  customLabelsList.push(label);
                }
              });
              
              // Group predefined labels by category
              const labelsByCategory = {};
              predefinedLabels.forEach(label => {
                Object.entries(LABEL_GROUPS).forEach(([category, labels]) => {
                  if (labels.includes(label)) {
                    if (!labelsByCategory[category]) {
                      labelsByCategory[category] = [];
                    }
                    labelsByCategory[category].push(label);
                  }
                });
              });
              
              // Build flat array for indexing
              const allDisplayedLabels = [];
              Object.values(labelsByCategory).forEach(catLabels => {
                allDisplayedLabels.push(...catLabels);
              });
              allDisplayedLabels.push(...customLabelsList);
              
              let itemIndex = 0;
              
              return (
                <>
                  {/* Predefined Labels by Category */}
                  {Object.entries(labelsByCategory).map(([category, labels]) => (
                    <div key={category}>
                      <div style={{
                        padding: '6px 12px 8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid #f3f4f6',
                        marginBottom: '4px',
                        marginTop: itemIndex > 0 ? '8px' : '0'
                      }}>
                        {category}
                      </div>
                      {labels.map((label) => {
                        const indexInFiltered = filtered.indexOf(label);
                        itemIndex++;
                        return (
                          <div
                            key={label}
                            data-label-index={indexInFiltered}
                            onClick={() => insertLabel(label)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderRadius: '8px',
                              backgroundColor: indexInFiltered === labelState.selectedIndex ? '#f3f4f6' : 'transparent',
                              transition: 'background-color 0.1s ease'
                            }}
                            onMouseEnter={() => {
                              const idx = filtered.indexOf(label);
                              if (idx !== -1) {
                                let newGhostText = '';
                                if (!labelState.query) {
                                  newGhostText = ' ' + label;
                                } else if (label.toLowerCase().startsWith(labelState.query.toLowerCase())) {
                                  newGhostText = label.substring(labelState.query.length);
                                }
                                setLabelState(prev => ({ ...prev, selectedIndex: idx, ghostText: newGhostText }));
                              }
                            }}
                          >
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#111827'
                            }}>
                              {label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    ))}
                  
                  {/* Custom Labels */}
                  {customLabelsList.length > 0 && (
                    <>
                      <div style={{
                        padding: '6px 12px 8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid #f3f4f6',
                        marginBottom: '4px',
                        marginTop: itemIndex > 0 ? '8px' : '0'
                      }}>
                        Custom Labels
                      </div>
                      {customLabelsList.map((label) => {
                        const indexInFiltered = filtered.indexOf(label);
                        const displayIndex = itemIndex++;
                        return (
                          <div
                            key={label}
                            data-label-index={indexInFiltered}
                            onClick={() => insertLabel(label)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderRadius: '8px',
                              backgroundColor: indexInFiltered === labelState.selectedIndex ? '#f3f4f6' : 'transparent',
                              transition: 'background-color 0.1s ease'
                            }}
                            onMouseEnter={() => {
                              const idx = filtered.indexOf(label);
                              if (idx !== -1) {
                                let newGhostText = '';
                                if (!labelState.query) {
                                  newGhostText = ' ' + label;
                                } else if (label.toLowerCase().startsWith(labelState.query.toLowerCase())) {
                                  newGhostText = label.substring(labelState.query.length);
                                }
                                setLabelState(prev => ({ ...prev, selectedIndex: idx, ghostText: newGhostText }));
                              }
                            }}
                          >
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#111827'
                            }}>
                              {label}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                  
                  {/* Keyboard shortcuts hint */}
                  <div style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    color: '#9ca3af',
                    borderTop: '1px solid #f3f4f6',
                    marginTop: '4px',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    <span><kbd style={{ padding: '2px 4px', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '10px' }}>↑↓</kbd> navigate</span>
                    <span><kbd style={{ padding: '2px 4px', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '10px' }}>Tab</kbd> complete</span>
                    <span><kbd style={{ padding: '2px 4px', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '10px' }}>Enter</kbd> select</span>
                  </div>
                </>
              );
            })()}
          </div>
        )}
        
        {/* Mention Popup - positioned above the input */}
        {/* Show popup when it's open */}
        {mentionState.isOpen && (
          <div
            ref={mentionPopupRef}
            className="mention-popup"
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '0',
              marginBottom: '8px',
              backgroundColor: 'white',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '12px',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
              zIndex: 10000,
              maxHeight: '280px',
              overflowY: 'auto',
              minWidth: '300px',
              maxWidth: '360px',
              padding: '6px'
            }}
          >
            {/* Help Mode - Show all available commands */}
            {mentionState.mode === 'help' && (
              <>
                <div style={{
                  padding: '6px 12px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '1px solid #f3f4f6',
                  marginBottom: '4px'
                }}>
                  Available Commands
                </div>
                {getCurrentListItems().map((cmd, index) => (
                  <div
                    key={cmd.command}
                    data-mention-index={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      insertCommand(cmd.command);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      backgroundColor: index === mentionState.selectedIndex ? '#f3f4f6' : 'transparent',
                      transition: 'background-color 0.1s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      setMentionState(prev => ({ ...prev, selectedIndex: index, ghostText: cmd.command }));
                    }}
                    onMouseLeave={(e) => {
                      if (index !== mentionState.selectedIndex) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <i className={cmd.icon} style={{ fontSize: '16px', color: '#6b7280' }}></i>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#111827'
                      }}>
                        @{cmd.command}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280'
                      }}>
                        {cmd.description}
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  color: '#9ca3af',
                  borderTop: '1px solid #f3f4f6',
                  marginTop: '4px',
                  display: 'flex',
                  gap: '12px'
                }}>
                  <span><kbd style={{ padding: '2px 4px', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '10px' }}>↑↓</kbd> navigate</span>
                  <span><kbd style={{ padding: '2px 4px', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '10px' }}>Enter</kbd> select</span>
                  <span><kbd style={{ padding: '2px 4px', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '10px' }}>Esc</kbd> close</span>
                </div>
              </>
            )}

            {/* Commands Mode - Show filtered commands */}
            {mentionState.mode === 'commands' && filteredCommands.length > 0 && (
              <>
                <div style={{
                  padding: '6px 12px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '1px solid #f3f4f6',
                  marginBottom: '4px'
                }}>
                  Commands
                </div>
                {filteredCommands.map((cmd, index) => (
                  <div
                    key={cmd.command}
                    data-mention-index={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      insertCommand(cmd.command);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      backgroundColor: index === mentionState.selectedIndex ? '#f3f4f6' : 'transparent',
                      transition: 'background-color 0.1s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      setMentionState(prev => ({ ...prev, selectedIndex: index }));
                    }}
                    onMouseLeave={(e) => {
                      if (index !== mentionState.selectedIndex) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <i className={cmd.icon} style={{ fontSize: '16px', color: '#6b7280' }}></i>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#111827'
                      }}>
                        @{cmd.command}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280'
                      }}>
                        {cmd.description}
                      </div>
                    </div>
                  </div>
                ))}
                    <div style={{
                  padding: '6px 12px',
                      fontSize: '11px',
                      color: '#9ca3af',
                  borderTop: '1px solid #f3f4f6',
                  marginTop: '4px',
                          display: 'flex',
                  gap: '12px'
                }}>
                  <span><kbd style={{ padding: '2px 4px', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '10px' }}>↑↓</kbd> navigate</span>
                  <span><kbd style={{ padding: '2px 4px', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '10px' }}>Enter</kbd> select</span>
                  <span><kbd style={{ padding: '2px 4px', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '10px' }}>Esc</kbd> close</span>
                          </div>
                  </>
                )}
                
            {/* Members Mode - Show team members */}
            {mentionState.mode === 'members' && matchedMembers.length > 0 && (
              <>
                {/* Team Members section - at top */}
                <div style={{
                  padding: '6px 12px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '1px solid #f3f4f6',
                  marginBottom: '4px'
                }}>
                  {recentMentions.length > 0 && !mentionState.query ? 'Recent & Team Members' : 'Team Members'}
                </div>
                {matchedMembers.map((member, index) => (
                  <div
                    key={member.email}
                    data-mention-index={index}
                    onClick={() => insertMention(member)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      backgroundColor: index === mentionState.selectedIndex ? '#f3f4f6' : 'transparent',
                      transition: 'background-color 0.1s ease',
                      opacity: member.isMatch ? 1 : 0.4
                    }}
                    onMouseEnter={() => {
                      if (member.isMatch) {
                        const newGhostText = member.name.toLowerCase().startsWith(mentionState.query.toLowerCase())
                          ? member.name.substring(mentionState.query.length)
                          : '';
                        setMentionState(prev => ({ ...prev, selectedIndex: index, ghostText: newGhostText }));
                      }
                    }}
                  >
                    {/* Profile Picture */}
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      backgroundColor: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      position: 'relative'
                    }}>
                      {member.profilePic ? (
                        <img
                          src={member.profilePic}
                          alt={member.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fallback = e.target.nextElementSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div style={{
                        display: member.profilePic ? 'none' : 'flex',
                        width: '100%',
                        height: '100%',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: `hsl(${member.email.charCodeAt(0) * 10 % 360}, 60%, 70%)`,
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        {(() => {
                          // Use firstName and lastName initials only (no email fallback)
                          const firstInitial = member.firstName && member.firstName.trim() ? member.firstName.trim()[0].toUpperCase() : '';
                          const lastInitial = member.lastName && member.lastName.trim() ? member.lastName.trim()[0].toUpperCase() : '';
                          
                          if (firstInitial && lastInitial) {
                            return firstInitial + lastInitial;
                          } else if (firstInitial) {
                            return firstInitial + firstInitial;
                          }
                          return 'U';
                        })()}
                      </div>
                    </div>
                    
                    {/* Name and Email */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#111827',
                        marginBottom: '1px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {member.name}
                        {member.isRecent && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: '600',
                            color: '#6366f1',
                            backgroundColor: '#eef2ff',
                            padding: '2px 5px',
                            borderRadius: '4px'
                          }}>
                            Recent
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#9ca3af',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {member.email}
                      </div>
                    </div>
                    
                    {/* Owner badge */}
                    {member.role === 'owner' && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        color: '#059669',
                        backgroundColor: '#d1fae5',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        flexShrink: 0
                      }}>
                        Owner
                      </span>
                    )}
                  </div>
                ))}
                
                {/* Commands section at bottom when no query or query could match commands */}
                {(!mentionState.query || filteredCommands.length > 0) && (
                  <>
                    <div style={{
                      padding: '6px 12px 8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: '1px solid #f3f4f6',
                      marginBottom: '4px',
                      marginTop: '8px'
                    }}>
                      Commands
                    </div>
                    {filteredCommands.map((cmd, cmdIndex) => (
                      <div
                        key={cmd.command}
                        onClick={(e) => {
                          e.stopPropagation();
                          insertCommand(cmd.command);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          transition: 'background-color 0.1s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <i className={cmd.icon} style={{ fontSize: '16px', color: '#6b7280' }}></i>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#111827'
                          }}>
                            @{cmd.command}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#6b7280'
                          }}>
                            {cmd.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                
                <div style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  color: '#9ca3af',
                  borderTop: '1px solid #f3f4f6',
                  marginTop: '4px',
                  display: 'flex',
                  gap: '12px'
                }}>
                  <span><kbd style={{ padding: '2px 4px', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '10px' }}>↑↓</kbd> navigate</span>
                  <span><kbd style={{ padding: '2px 4px', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '10px' }}>Tab</kbd> complete</span>
                  <span><kbd style={{ padding: '2px 4px', backgroundColor: '#f3f4f6', borderRadius: '3px', fontSize: '10px' }}>Enter</kbd> select</span>
                </div>
              </>
            )}

            {/* No results message */}
            {mentionState.mode === 'members' && matchedMembers.length === 0 && mentionState.query && (
              <div style={{
                padding: '16px 12px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '13px'
              }}>
                No members found matching "{mentionState.query}"
                <div style={{ marginTop: '8px', fontSize: '12px' }}>
                  Try <span style={{ color: '#3b82f6', cursor: 'pointer' }} onClick={() => setMentionState(prev => ({ ...prev, mode: 'help' }))}>@help</span> for available commands
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          style={{ display: 'none' }}
        />

        {/* Input Area - Flex Column Layout */}
        <div style={{
                display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {/* Quoted Messages Preview - Rendered Conditionally Above Textarea */}
          {quotedMessages && quotedMessages.length > 0 && (
            <div style={{
              marginBottom: '8px',
              padding: expandedQuotesPreview && quotedMessages.length > 1 ? '0' : '0',
              borderRadius: '8px',
              overflow: 'visible'
            }}>
              {/* First quoted message (always visible) */}
              {quotedMessages[0] && (
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '10px 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  borderRadius: '8px',
                  borderLeft: '3px solid rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s ease-in-out',
                  marginBottom: expandedQuotesPreview && quotedMessages.length > 1 ? '6px' : '0'
                }}>
                  <div style={{
                    flex: 1,
                    minWidth: 0,
                    paddingRight: '24px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: 'rgba(0, 0, 0, 0.5)',
                        lineHeight: '1.3'
                      }}>
                        {quotedMessages[0].role === 'user' ? (quotedMessages[0].userDisplayName || 'You') : 'Phraze'}
                      </div>
                      {quotedMessages.length > 1 && !expandedQuotesPreview && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedQuotesPreview(true);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0',
                            color: 'rgba(0, 0, 0, 0.4)',
                            fontSize: '0.75rem',
                            fontWeight: '400',
                            textDecoration: 'underline',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'rgba(0, 0, 0, 0.6)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'rgba(0, 0, 0, 0.4)';
                          }}
                        >
                          +{quotedMessages.length - 1} more
                        </button>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: 'rgba(0, 0, 0, 0.7)',
                      fontWeight: '400',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: expandedQuotesPreview ? 'normal' : 'nowrap',
                      lineHeight: '1.4'
                    }}>
                      <QuotedMessageContent quote={quotedMessages[0]} isPreview={true} />
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveQuotedMessage(quotedMessages[0].timestamp || quotedMessages[0].originalIndex || quotedMessages[0].messageId)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: 'rgba(0, 0, 0, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      width: '18px',
                      height: '18px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.3)';
                    }}
                    title="Remove quote"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              )}
              
              {/* Additional quoted messages (shown when expanded) */}
              {quotedMessages.length > 1 && expandedQuotesPreview && (
                <>
                  {quotedMessages.slice(1).map((quotedMsg, idx) => {
                    const msgId = quotedMsg.timestamp || quotedMsg.originalIndex || quotedMsg.messageId;
                    return (
                      <div key={msgId || idx} style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'flex-start',
                        padding: '10px 12px',
                        marginTop: '6px',
                        border: '1px solid rgba(0, 0, 0, 0.05)',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        borderLeft: '3px solid rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.2s ease-in-out'
                      }}>
                        <div style={{
                          flex: 1,
                          minWidth: 0,
                          paddingRight: '24px'
                        }}>
                          <div style={{
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            color: 'rgba(0, 0, 0, 0.5)',
                            marginBottom: '4px',
                            lineHeight: '1.3'
                          }}>
                            {quotedMsg.role === 'user' ? (quotedMsg.userDisplayName || 'You') : 'Phraze'}
                          </div>
                          <div style={{
                            fontSize: '0.8125rem',
                            color: 'rgba(0, 0, 0, 0.7)',
                            fontWeight: '400',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            lineHeight: '1.4'
                          }}>
                            <QuotedMessageContent quote={quotedMsg} isPreview={true} />
                          </div>
                        </div>
                        <button
                          onClick={() => onRemoveQuotedMessage(msgId)}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            color: 'rgba(0, 0, 0, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            width: '18px',
                            height: '18px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)';
                            e.currentTarget.style.color = 'rgba(0, 0, 0, 0.6)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'rgba(0, 0, 0, 0.3)';
                          }}
                          title="Remove quote"
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setExpandedQuotesPreview(false)}
                    style={{
                      marginTop: '6px',
                      padding: '4px 8px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'rgba(0, 0, 0, 0.4)',
                      fontSize: '0.75rem',
                      fontWeight: '400',
                      textDecoration: 'underline',
                      transition: 'color 0.2s',
                      alignSelf: 'flex-start'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.4)';
                    }}
                  >
                    Show less
                  </button>
                </>
              )}
            </div>
          )}

          {/* Textarea */}
        <textarea
          id="groq_chat_textarea"
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
            onBlur={() => {
              // Stop typing when user leaves the input field
              if (conversationId) {
                if (stopTypingTimeoutRef.current) {
                  clearTimeout(stopTypingTimeoutRef.current);
                }
                stopTyping(conversationId);
              }
            }}
          onKeyDown={(e) => {
            // Handle label popup navigation
            if (labelState.isOpen) {
              handleLabelKeyDown(e);
              if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab') {
                return;
              }
            }
            
            // Handle mention popup navigation
            if (mentionState.isOpen) {
              handleMentionKeyDown(e);
              if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab') {
                return;
              }
            }
            
            if (e.key === 'Enter' && !e.shiftKey && !mentionState.isOpen && !labelState.isOpen) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
            placeholder={quotedMessages && quotedMessages.length > 0 ? "Reply to message" + (quotedMessages.length > 1 ? 's' : '') + "..." : (currentUserRole === 'viewer' ? 'View Only Mode - Cannot send messages' : (messages.length === 0 ? 'How can I help you today?' : 'Message Phraze...'))}
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#111827',
            resize: 'none',
            fontSize: '16px',
              lineHeight: '1.5',
            fontFamily: 'inherit',
              padding: '8px',
              minHeight: '32px',
              maxHeight: '200px',
              overflowY: inputValue.length > 100 ? 'auto' : 'hidden',
            cursor: currentUserRole === 'viewer' ? 'not-allowed' : 'text',
            boxSizing: 'border-box'
          }}
          rows={1}
          disabled={isLoading || (isSharedView && !currentUser) || currentUserRole === 'viewer'}
        />

          {/* Footer Actions */}
          <div style={{
          display: 'flex',
            alignItems: 'center',
          justifyContent: 'space-between',
            padding: '4px'
          }}>
            {/* Left Icons */}
            <div style={{
              display: 'flex',
          alignItems: 'center',
              gap: '12px',
              color: '#9ca3af'
            }}>
            {/* Image upload button */}
            <button
              type="button"
              onClick={triggerFileInput}
                disabled={(isSharedView && !currentUser) || currentUserRole === 'viewer'}
              style={{
                  background: 'transparent',
                border: 'none',
                cursor: (isSharedView && !currentUser) || currentUserRole === 'viewer' ? 'not-allowed' : 'pointer',
                  padding: '8px',
                color: (isSharedView && !currentUser) || currentUserRole === 'viewer' ? '#cbd5e1' : '#9ca3af',
                  borderRadius: '50%',
                  transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                  justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = '#4b5563';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = (isSharedView && !currentUser) || currentUserRole === 'viewer' ? '#cbd5e1' : '#9ca3af';
              }}
                title="Upload Image"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="9" cy="9" r="2"></circle>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
              </svg>
            </button>

            {/* Microphone button */}
            <button
              type="button"
              onClick={function () {
              if (isRecording && speechObj) {
                try {
                  speechObj.stop();
                } catch (e) {
                  console.warn('Error stopping recognition:', e);
                }
                setIsRecording(false);
                setSpeechObj(null);
              } else {
                function speechToText() {
                  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                    alert('Speech recognition is not supported in your browser.');
                    return;
                  }
                  setIsRecording(true);
                  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                  const recognition = new SpeechRecognition();
                  setSpeechObj(recognition);
                      recognition.continuous = true;
                      recognition.interimResults = true;
                      recognition.lang = navigator.language || 'en-US';
                      recognition.maxAlternatives = 1;
                      let finalTranscript = inputValue;
                      let isProcessing = false;
                  recognition.addEventListener("result", (e) => {
                        if (isProcessing) return;
                    isProcessing = true;
                    let interimTranscript = '';
                    let newFinalTranscript = '';
                    for (let i = e.resultIndex; i < e.results.length; i++) {
                      const result = e.results[i];
                      const transcript = result[0].transcript;
                      if (result.isFinal) {
                        const capitalized = transcript.charAt(0).toUpperCase() + transcript.slice(1);
                        newFinalTranscript += capitalized + ' ';
                      } else {
                        interimTranscript += transcript;
                      }
                    }
                    const updatedText = finalTranscript + newFinalTranscript + interimTranscript;
                    setInputValue(updatedText.trim());
                    const textarea = document.getElementById("groq_chat_textarea");
                    if (textarea) {
                      textarea.value = updatedText.trim();
                          requestAnimationFrame(() => {
                            const scrollTop = textarea.scrollTop;
                      textarea.style.height = 'auto';
                            const newHeight = Math.max(44, Math.min(textarea.scrollHeight, 200));
                      textarea.style.height = `${newHeight}px`;
                            textarea.scrollTop = scrollTop;
                          });
                    }
                    if (newFinalTranscript) {
                      finalTranscript += newFinalTranscript;
                    }
                    isProcessing = false;
                  });
                  recognition.addEventListener("error", (e) => {
                    console.warn('Speech recognition error:', e.error);
                        if (e.error === 'not-allowed' || e.error === 'audio-capture') {
                          alert('Microphone permission denied. Please enable microphone access in your browser settings.');
                        setIsRecording(false);
                        setSpeechObj(null);
                        }
                      });
                  recognition.addEventListener("end", () => {
                    if (isRecording) {
                      setTimeout(() => {
                        if (isRecording && speechObj === recognition) {
                          try {
                            recognition.start();
                          } catch (e) {
                            console.warn('Error restarting recognition:', e);
                            setIsRecording(false);
                            setSpeechObj(null);
                          }
                        }
                      }, 100);
                    }
                  });
                  navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(() => {
                      try {
                        recognition.start();
                      } catch (e) {
                        console.error('Error starting recognition:', e);
                        setIsRecording(false);
                        setSpeechObj(null);
                        alert('Could not start speech recognition. Please check your microphone permissions.');
                      }
                    })
                    .catch((err) => {
                      console.error('Microphone access error:', err);
                      setIsRecording(false);
                      setSpeechObj(null);
                      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        alert('Microphone permission denied. Please enable microphone access in your browser settings.');
                      } else {
                        alert('Could not access microphone. Please check your microphone connection and permissions.');
                      }
                    });
                }
                speechToText();
              }
            }}
                disabled={(isSharedView && !currentUser) || currentUserRole === 'viewer'}
              style={{
                  background: 'transparent',
                border: 'none',
                cursor: (isSharedView && !currentUser) || currentUserRole === 'viewer' ? 'not-allowed' : 'pointer',
                  padding: '8px',
                color: (isSharedView && !currentUser) || currentUserRole === 'viewer' ? '#cbd5e1' : '#9ca3af',
                  borderRadius: '50%',
                  transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                  justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = '#4b5563';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = (isSharedView && !currentUser) || currentUserRole === 'viewer' ? '#cbd5e1' : '#9ca3af';
              }}
              title="Voice Input"
            >
            {isRecording ? (
                  <img src={waveformSvg} alt="Recording..." className="waveform-animated" style={{ width: 20, height: 20 }} />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            )}
          </button>

            {/* Camera button */}
              {isLoggedIn && (
              <button
                id="showScreenshotShortcutsButton"
                type="button"
                  onClick={() => setIsScreenshotShortcutsVisible(!isScreenshotShortcutsVisible)}
                  disabled={currentUserRole === 'viewer'}
                style={{
                    background: 'transparent',
                  border: 'none',
                  cursor: currentUserRole === 'viewer' ? 'not-allowed' : 'pointer',
                    padding: '8px',
                  color: currentUserRole === 'viewer' ? '#cbd5e1' : '#9ca3af',
                    borderRadius: '50%',
                    transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                    justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.color = '#4b5563';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = currentUserRole === 'viewer' ? '#cbd5e1' : '#9ca3af';
                }}
                  title="Use Camera"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                </svg>
              </button>
              )}
          </div>

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={(!inputValue.trim() && !imagePreview) || isLoading || (isSharedView && !currentUser) || currentUserRole === 'viewer'}
              style={{
                background: (inputValue.trim() || imagePreview) && !isLoading && !(isSharedView && !currentUser) && currentUserRole !== 'viewer' ? '#000000' : '#e5e7eb',
                color: (inputValue.trim() || imagePreview) && !isLoading && !(isSharedView && !currentUser) && currentUserRole !== 'viewer' ? '#ffffff' : '#9ca3af',
                border: 'none',
                cursor: (!inputValue.trim() && !imagePreview) || isLoading || (isSharedView && !currentUser) || currentUserRole === 'viewer' ? 'not-allowed' : 'pointer',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: (inputValue.trim() || imagePreview) && !isLoading && !(isSharedView && !currentUser) && currentUserRole !== 'viewer' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
              }}
              onMouseEnter={(e) => {
                if ((inputValue.trim() || imagePreview) && !isLoading && !(isSharedView && !currentUser) && currentUserRole !== 'viewer') {
                  e.currentTarget.style.backgroundColor = '#1f2937';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                if ((inputValue.trim() || imagePreview) && !isLoading && !(isSharedView && !currentUser) && currentUserRole !== 'viewer') {
                  e.currentTarget.style.backgroundColor = '#000000';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
              title="Send message"
          >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
        </div>
        </div>

      </div>

      {isScreenshotShortcutsVisible &&
          <div
            style={{
              position: 'absolute',
              background: 'white',
              bottom: '50px',
              borderRadius: '10px',
              border: '1px solid gray',
              padding: '1rem'
            }}
          >
            <button
              onClick={
                function () {
                  screenshotShortcut(0);
                }
              }
              class="groqScreenshotButton nav-link">
              <i class="fas fa-desktop"></i>
              &nbsp;&nbsp;Capture Visible Part
            </button><br></br>
            <button
              onClick={
                function () {
                  screenshotShortcut(1);
                }
              }
              class="groqScreenshotButton nav-link">
              <i class="fas fa-crop-alt"></i>
              &nbsp;&nbsp;Capture Selected Area
            </button><br></br>
            <button
              onClick={
                function () {
                  setIsScreenshotShortcutsVisible(false);
                  downloadFullPageScreenshot();
                }
              }
              class="groqScreenshotButton nav-link">
              <i class="fas fa-window-maximize"></i>
              &nbsp;&nbsp;Capture Full Page
            </button>
          </div>
        }

      {currentUserRole === 'viewer' && (
        <div style={{
          textAlign: 'center',
          marginTop: '0.5rem'
        }}>
          <p style={{
            fontSize: '0.75rem',
            color: '#9ca3af',
            margin: 0
          }}>
            Chat functionality is currently unavailable.
          </p>
        </div>
      )}
    </form >
  );
}

// Separate component for disclaimer
const DisclaimerMessage = () => (
  <p style={{
    marginTop: '1.5rem',
    textAlign: 'center',
    fontSize: '0.75rem',
    color: '#9ca3af',
    fontWeight: '300',
    letterSpacing: '0.025em',
    opacity: 0.8
  }}>
    Phraze can make mistakes. Consider checking important information.
  </p>
);

export default function Demonstration({ currentProject, onProjectChange, setCurrentProject }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [overrideShowHighlights, setOverrideShowHighlights] = useState(false);
  const [currentChat, setCurrentChat] = useState(null);
  const [currentChatID, setCurrentChatID] = useState(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [editingMessageContent, setEditingMessageContent] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isSharedView, setIsSharedView] = useState(false);
  const [sharedCompanyEmail, setSharedCompanyEmail] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(500);
  const [prevSidebarWidth, setPrevSidebarWidth] = useState(500);
  const CUSTOM_SIDEBAR_DEFAULT_WIDTH = 480; // Normal/default width
  const [isCustomSidebarVisible, setIsCustomSidebarVisible] = useState(false);
  const [customSidebarWidth, setCustomSidebarWidth] = useState(CUSTOM_SIDEBAR_DEFAULT_WIDTH);
  const [prevCustomSidebarWidth, setPrevCustomSidebarWidth] = useState(CUSTOM_SIDEBAR_DEFAULT_WIDTH);
  const [customSidebarActiveTab, setCustomSidebarActiveTab] = useState('activity'); // 'activity' or 'messages'
  const [isActivityExpanded, setIsActivityExpanded] = useState(false);
  
  const [companyEmail, setCompanyEmail] = useState(localStorage.getItem("companyEmail") || '');
  // const [chatHighlights, setChatHighlights] = useState([]); // State for highlights
  // const [annotationHistoryData, setAnnotationHistoryData] = useState(null); // State for parsed history
  const [originalSanitizedUrl, setOriginalSanitizedUrl] = useState(null); // State for original URL
  const [showAuthModal, setShowAuthModal] = useState(false); // State for authentication modal
  const [selectedModel, setSelectedModel] = useState("meta-llama/llama-4-scout-17b-16e-instruct"); // State for selected model
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false); // State for dropdown visibility
  const [tryAgainDropdownOpen, setTryAgainDropdownOpen] = useState(null); // State for try again dropdown (stores message index)
  const [copiedMessages, setCopiedMessages] = useState(new Set()); // State to track recently copied messages
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const editTextareaRef = useRef(null);
  const messageRefs = useRef({}); // Ref to hold message bubble DOM nodes
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { isInsideExtension, setIsInsideExtension } = useExtension();
  const { userProfile } = useAuth();
  const [isLibraryVisible, setIsLibraryVisible] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [allChats, setAllChats] = useState([]);
  const [allSharedChats, setAllSharedChats] = useState([]);
  const [chatMode, setChatMode] = useState('public'); // Track current chat mode from sidebar - default to public to match ChatSidebar
  const [projectMembers, setProjectMembers] = useState([]); // Members of the current project (for public chats)
  const [projectMemberCount, setProjectMemberCount] = useState(0); // Track member count for messaging tab state
  const [showAllMembers, setShowAllMembers] = useState(false); // State for "View More" modal
  const [selectedMemberEmail, setSelectedMemberEmail] = useState(null); // Selected member for detail view
  const [memberSearchTerm, setMemberSearchTerm] = useState(''); // Search term for members modal
  const [memberDetails, setMemberDetails] = useState({}); // Store detailed member info (bio, username, etc.)
  const [memberPresence, setMemberPresence] = useState({}); // Store member presence status ('active' | 'idle' | 'offline')
  const memberPresenceListenersRef = useRef(new Map()); // Track presence listeners for cleanup (email -> cleanup function)
  const [showMobileMemberDetails, setShowMobileMemberDetails] = useState(false); // For mobile responsive design
  const [showAdminPanel, setShowAdminPanel] = useState(false); // State for admin panel modal
  const [typingUsers, setTypingUsers] = useState([]); // Store typing users for current conversation
  const typingListenerRef = useRef(null); // Track typing listener cleanup function
  const [quotedMessages, setQuotedMessages] = useState([]); // Store quoted messages for reply (array for multi-select)
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false); // Track if Shift key is held for multi-select
  const [expandedQuotesPreview, setExpandedQuotesPreview] = useState(false); // Track if quote preview is expanded
  const [expandedQuotesInMessages, setExpandedQuotesInMessages] = useState(new Set()); // Track which messages have expanded quotes
  const [adminPanelMembers, setAdminPanelMembers] = useState([]); // Members data for admin panel
  const adminPanelProfilePicListenersRef = useRef(new Map()); // Track which member emails we're listening to (email -> unsubscribe function)
  const [adminSearchQuery, setAdminSearchQuery] = useState(''); // Search query for admin panel
  const [adminRoleFilter, setAdminRoleFilter] = useState(null); // Role filter: 'owner' | 'editor' | 'viewer' | null (all)
  const [editingMember, setEditingMember] = useState(null); // Member being edited in permissions modal
  const profilePicListenersRef = useRef([]); // Store Firebase listeners for cleanup
  const [messageSenderProfiles, setMessageSenderProfiles] = useState(new Map()); // Cache profile pictures for message senders (for private chats)
  const messageSenderProfileListenersRef = useRef(new Map()); // Track profile picture listeners for message senders
  const [recentMentions, setRecentMentions] = useState([]); // Track recently mentioned users (emails)
  const [isProjectOwner, setIsProjectOwner] = useState(false); // Track if current user is project owner
  const [isProjectShared, setIsProjectShared] = useState(false); // Track if project is shared
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false); // Track dropdown open state
  const [currentUserRole, setCurrentUserRole] = useState(null); // Track current user's role: 'owner' | 'editor' | 'viewer' | null
  const previousUserRoleRef = useRef(null); // Track previous role to detect changes
  const [showShareModal, setShowShareModal] = useState(false); // State for ShareModal
  const [shareModalProjectId, setShareModalProjectId] = useState(null); // Project ID for ShareModal
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false); // State for AccountSettingsModal
  const [canShare, setCanShare] = useState(false); // Track if current user can share project
  const [sharePermissionLoading, setSharePermissionLoading] = useState(true); // Track loading state for share permission

  const projectCompanyId = getProjectCompanyEmail();

  // Handler to track recent mentions
  const handleMentionUsed = (email) => {
    setRecentMentions(prev => {
      // Remove email if it already exists, then add to front
      const filtered = prev.filter(e => e !== email);
      // Keep only last 10 recent mentions
      return [email, ...filtered].slice(0, 10);
    });
  };

  // Callback to receive chat data from ChatSidebar
  const handleChatsUpdate = (chats, sharedChats) => {
    setAllChats(chats);
    setAllSharedChats(sharedChats);
  };

  // Callback to receive chat mode from ChatSidebar
  const handleChatModeChange = (mode) => {
    setChatMode(mode);
  };

  // Add state for contacts panel visibility
  const [isExtensionSidebarVisible, setIsExtensionSidebarVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      setIsCustomSidebarVisible(true);
      setCustomSidebarActiveTab('messages');
    };

    window.addEventListener('phraze:openCustomSidebarMessages', handler);
    return () => window.removeEventListener('phraze:openCustomSidebarMessages', handler);
  }, []);

  // Only clear activeMessagingContext when user explicitly navigates away from messaging
  // (e.g., switches to Activity tab in custom sidebar). Don't interfere with main messaging interface.
  useEffect(() => {
    // Only apply this logic when custom sidebar is actually visible
    if (!isCustomSidebarVisible) return;
    
    const shouldClear = customSidebarActiveTab !== 'messages';
    if (!shouldClear) return;

    try {
      const userEmail = auth.currentUser?.email;
      if (!userEmail) return;
      const userKey = String(userEmail).replace(/\./g, ',').toLowerCase();
      const ctxRef = ref(database, `activeMessagingContext/${userKey}`);
      set(ctxRef, null);

      if (window.__phrazeActiveMessagingContext) {
        window.__phrazeActiveMessagingContext = {
          projectId: null,
          chatId: null,
          contactEmail: null,
          isConversationOpen: false,
        };
      }
    } catch (_) {
      // Best-effort
    }
  }, [isCustomSidebarVisible, customSidebarActiveTab]);

  // Share link modal state
  const [shareLinkModalOpen, setShareLinkModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareMode, setShareMode] = useState('chat'); // 'chat' or 'project'
  const [inviteCode, setInviteCode] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [pendingShareData, setPendingShareData] = useState(null); // Stores share data until user confirms

  // Auto-scroll management
  const chatMessagesContainerRef = useRef(null);
  const CHAT_CANVAS_WIDTH = 800;
  const [chatCanvasScale, setChatCanvasScale] = useState(1);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  const location = useLocation(); // Use useLocation hook
  const navigate = useNavigate(); // Use useNavigate hook

  // Available models
  const availableModels = [
    { value: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Phraze v1", description: "Great for most questions" },
    { value: "llama3-8b-8192", label: "Phraze Fast", description: "Good for everyday conversations" },
    { value: "mixtral-8x7b-32768", label: "Phraze Plus", description: "Best for complex tasks" }
  ];

  // Initialize Groq client
  useEffect(() => {
    const initGroq = async () => {
      try {
        const GROQ_API_KEY = await getFirebaseData('groq_api_key');
        if (GROQ_API_KEY) {
          groq = new Groq({
            apiKey: GROQ_API_KEY,
            dangerouslyAllowBrowser: true
          });
        }
      } catch (error) {
        console.error('Error initializing Groq client:', error);
      }
    };
    initGroq();
  }, []);

  // Fetch project members and member count for messaging tab state
  // Always fetch member count (even for private chats) to determine messaging availability
  useEffect(() => {
    // Get the company email for the project (outside async function so it's accessible for real-time listener)
        const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
        const targetCompanyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
        
    const fetchProjectMembersAndCount = async () => {
      try {
        if (!targetCompanyEmail || !currentProject) {
          setProjectMembers([]);
          setProjectMemberCount(0);
          return;
        }

        // Fetch members from Firebase - always fetch to get member count
        const membersPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/members`;
        const membersData = await getFirebaseData(membersPath);
        
        if (!membersData) {
          setProjectMembers([]);
          setProjectMemberCount(0);
          return;
        }

        // Calculate member count - always needed for messaging tab state
        const memberCount = Object.keys(membersData).length;
        setProjectMemberCount(memberCount);
        console.log('Project member count:', memberCount);

        // Check if project is shared and determine user role
        // Always check this, even if no currentChat (for new chats)
        if (auth.currentUser && auth.currentUser.email) {
          const currentUserEmail = auth.currentUser.email.replace(/\./g, ',');
          const currentUserMember = membersData[currentUserEmail];
          
          // Project is shared if it has more than 1 member (owner + others)
          const isShared = memberCount > 1;
          setIsProjectShared(isShared);
          
          // Check if current user is owner or recipient
          // If sharedCompanyEmail is set, we're viewing a shared project from another company, so user is not owner
          let isOwner = false;
          if (!sharedCompanyEmail) {
            // Not viewing a shared project - check if user owns the company that owns the project
            const userCompanyEmail = localStorage.getItem('companyEmail');
            if (userCompanyEmail) {
              // Normalize both emails for comparison (handle both comma and dot formats)
              const normalizedUserCompany = userCompanyEmail.replace(/\./g, ',');
              const normalizedTargetCompany = targetCompanyEmail.replace(/\./g, ',');
              if (normalizedUserCompany === normalizedTargetCompany) {
                // User owns the company, so they're the project owner
                isOwner = true;
              }
            }
          }
          
          if (!isOwner && currentUserMember) {
            // Check if user is in members list with owner role
            isOwner = currentUserMember.role === 'owner';
          }
          
          setIsProjectOwner(isOwner);
        } else {
          // User not logged in
          setIsProjectShared(false);
          setIsProjectOwner(false);
        }

        // Fetch detailed member data for:
        // 1. Shared projects (even when no chat selected) - show on "How can I help you today?" screen
        // 2. Public chats (in any project)
        // Don't fetch for private chats
        const isSharedProject = memberCount > 1;
        if (currentChat && currentChat.isPublic === false) {
          // Private chat - don't show members
          setProjectMembers([]);
          return;
        }
        // If not a shared project and no public chat, don't fetch members
        if (!isSharedProject && (!currentChat || currentChat.isPublic === false)) {
          setProjectMembers([]);
          return;
        }

        // Convert members object to array and fetch profile pictures and names
        const memberEmails = Object.keys(membersData).map(emailPath => emailPath.replace(/,/g, '.'));
        const membersWithData = await Promise.all(
          memberEmails.map(async (email) => {
            const emailFormatted = email.replace(/\./g, ',');
            const memberInfo = membersData[emailFormatted] || {};
            
            // Try to get profile picture and name from the user's OWN company
            let profilePic = null;
            let userName = null;
            let userCompanyEmail = null;
            
            try {
              // First, get the user's own company email from emailToCompanyDirectory
              userCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${emailFormatted}`);
              
              if (userCompanyEmail) {
                // Fetch profile picture, name, firstName, and lastName from user's own company
                const [picData, userData] = await Promise.all([
                  getFirebaseData(`Companies/${userCompanyEmail}/users/${emailFormatted}/profileImage`).catch(() => null),
                  getFirebaseData(`Companies/${userCompanyEmail}/users/${emailFormatted}`).catch(() => null)
                ]);
                
                profilePic = picData || null;
                // Use name field, or construct from firstName/lastName, or fallback to email prefix
                userName = userData?.name || (userData?.firstName && userData?.lastName 
                  ? `${userData.firstName} ${userData.lastName}` 
                  : userData?.firstName || email.split('@')[0]);
              }
              
              // If not found in user's company, try the project owner's company as fallback
              if (!profilePic || !userName) {
                const [picData, userData] = await Promise.all([
                  getFirebaseData(`Companies/${targetCompanyEmail}/users/${emailFormatted}/profileImage`).catch(() => null),
                  getFirebaseData(`Companies/${targetCompanyEmail}/users/${emailFormatted}`).catch(() => null)
                ]);
                
                if (!profilePic) profilePic = picData || null;
                if (!userName) {
                  userName = userData?.name || (userData?.firstName && userData?.lastName 
                    ? `${userData.firstName} ${userData.lastName}` 
                    : userData?.firstName || email.split('@')[0]);
                }
              }
            } catch (e) {
              console.warn('Could not fetch user data for:', email, e);
              userName = email.split('@')[0]; // Fallback to email prefix
            }

            // Fetch firstName and lastName for consistent initials generation
            let firstName = null;
            let lastName = null;
            try {
              if (userCompanyEmail) {
                const userData = await getFirebaseData(`Companies/${userCompanyEmail}/users/${emailFormatted}`).catch(() => null);
                firstName = userData?.firstName || null;
                lastName = userData?.lastName || null;
              }
              if (!firstName || !lastName) {
                const userData = await getFirebaseData(`Companies/${targetCompanyEmail}/users/${emailFormatted}`).catch(() => null);
                if (!firstName) firstName = userData?.firstName || null;
                if (!lastName) lastName = userData?.lastName || null;
              }
            } catch (e) {
              // Ignore errors, use null values
            }

            return {
              email,
              name: userName || email.split('@')[0],
              firstName: firstName || null,
              lastName: lastName || null,
              role: memberInfo.role || 'member',
              joinedAt: memberInfo.joinedAt,
              profilePic: profilePic || null,
              userCompanyEmail: userCompanyEmail || targetCompanyEmail
            };
          })
        );

        setProjectMembers(membersWithData);
        // Removed console.log for performance
        
        // Clean up old listeners
        profilePicListenersRef.current.forEach(({ ref: refToClean, listener }) => {
          off(refToClean, 'value', listener);
        });
        profilePicListenersRef.current = [];
        
        // Clean up old presence listeners
        memberPresenceListenersRef.current.forEach((cleanup) => {
          if (typeof cleanup === 'function') {
            cleanup();
          }
        });
        memberPresenceListenersRef.current.clear();
        
        // Set up real-time listeners for profile picture and user data updates after members are fetched
        if (membersWithData.length > 0) {
          membersWithData.forEach((member) => {
            const emailFormatted = member.email.replace(/\./g, ',');
            
            // Set up listener for profile picture
            const profilePicPath = `Companies/${member.userCompanyEmail}/users/${emailFormatted}/profileImage`;
            const profilePicRef = ref(database, profilePicPath);
            
            const profilePicListener = onValue(profilePicRef, (snapshot) => {
              const newProfilePic = snapshot.val();
              setProjectMembers(prev => prev.map(m => 
                m.email === member.email 
                  ? { ...m, profilePic: newProfilePic || null }
                  : m
              ));
            });
            
            // Set up listener for user data (firstName, lastName, name) to update initials
            const userDataPath = `Companies/${member.userCompanyEmail}/users/${emailFormatted}`;
            const userDataRef = ref(database, userDataPath);
            
            const userDataListener = onValue(userDataRef, (snapshot) => {
              const userData = snapshot.val();
              if (userData) {
                // Update firstName, lastName, and name in state
                const updatedFirstName = userData.firstName || null;
                const updatedLastName = userData.lastName || null;
                const updatedName = userData.name || (updatedFirstName && updatedLastName 
                  ? `${updatedFirstName} ${updatedLastName}` 
                  : updatedFirstName || member.email.split('@')[0]);
                
                setProjectMembers(prev => prev.map(m => 
                  m.email === member.email 
                    ? { 
                        ...m, 
                        firstName: updatedFirstName,
                        lastName: updatedLastName,
                        name: updatedName
                      }
                    : m
                ));
              }
            });
            
            // Store both listeners for cleanup
            profilePicListenersRef.current.push({ ref: profilePicRef, listener: profilePicListener });
            profilePicListenersRef.current.push({ ref: userDataRef, listener: userDataListener });
            
            // Set up presence listener for this member using new presence system
            // Clean up existing listener for this member if any
            if (memberPresenceListenersRef.current.has(member.email)) {
              const cleanup = memberPresenceListenersRef.current.get(member.email);
              if (typeof cleanup === 'function') {
                cleanup();
            }
            }
            
            // Use the new presence system that tracks sessions and computes presence
            const cleanupPresence = listenToUserPresence(member.email, (presence) => {
              setMemberPresence(prev => ({
                ...prev,
                [member.email]: presence // 'active' | 'idle' | 'offline'
              }));
            });
            
            memberPresenceListenersRef.current.set(member.email, cleanupPresence);
          });
        }
      } catch (error) {
        console.error('Error fetching project members:', error);
        setProjectMembers([]);
        setProjectMemberCount(0);
      }
    };

    fetchProjectMembersAndCount();
    
    // Set up real-time listener for project members to update sharing status dynamically
    let membersListenerRef = null;
    let membersUnsubscribe = null;
    
    if (targetCompanyEmail && currentProject) {
      const membersPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/members`;
      membersListenerRef = ref(database, membersPath);
      
      membersUnsubscribe = onValue(membersListenerRef, async (snapshot) => {
        const membersData = snapshot.val();
        
        if (!membersData) {
          setProjectMemberCount(0);
          setIsProjectShared(false);
          setIsProjectOwner(false);
          setProjectMembers([]);
          return;
        }

        const memberCount = Object.keys(membersData).length;
        setProjectMemberCount(memberCount);

        // Update project sharing status dynamically
        if (auth.currentUser && auth.currentUser.email) {
          const currentUserEmail = auth.currentUser.email.replace(/\./g, ',');
          const currentUserMember = membersData[currentUserEmail];
          
          const isShared = memberCount > 1;
          setIsProjectShared(isShared);
          
          // Check if current user is owner or recipient
          // If sharedCompanyEmail is set, we're viewing a shared project from another company, so user is not owner
          const currentSharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
          let isOwner = false;
          if (!currentSharedCompanyEmail) {
            // Not viewing a shared project - check if user owns the company that owns the project
            const userCompanyEmail = localStorage.getItem('companyEmail');
            if (userCompanyEmail) {
              // Normalize both emails for comparison (handle both comma and dot formats)
              const normalizedUserCompany = userCompanyEmail.replace(/\./g, ',');
              const normalizedTargetCompany = targetCompanyEmail.replace(/\./g, ',');
              if (normalizedUserCompany === normalizedTargetCompany) {
                // User owns the company, so they're the project owner
                isOwner = true;
              }
            }
          }
          
          if (!isOwner && currentUserMember) {
            // Check if user is in members list with owner role
            isOwner = currentUserMember.role === 'owner';
          }
          
          setIsProjectOwner(isOwner);
          
          // Read share permission and calculate canShare
          setSharePermissionLoading(true);
          try {
            let sharePermission = false;
            if (isOwner) {
              // Owners always have share permission
              sharePermission = true;
            } else if (currentUserMember) {
              // Check permissions.share for non-owners
              const permissions = currentUserMember.permissions;
              sharePermission = permissions && permissions.share === true;
            }
            setCanShare(sharePermission);
          } catch (error) {
            console.error('Error reading share permission:', error);
            setCanShare(false);
          } finally {
            setSharePermissionLoading(false);
          }
        } else {
          setIsProjectShared(false);
          setIsProjectOwner(false);
          setCanShare(false);
          setSharePermissionLoading(false);
        }

        // Update projectMembers array dynamically when members are added/removed
        // Only update if project is shared or if there's a public chat
        const isSharedProject = memberCount > 1;
        if (currentChat && currentChat.isPublic === false) {
          // Private chat - don't update members
          return;
        }
        if (!isSharedProject && (!currentChat || currentChat.isPublic === false)) {
          // Not a shared project and no public chat - don't update members
          return;
        }

        // Fetch detailed member data for new/updated members
        const memberEmails = Object.keys(membersData).map(emailPath => emailPath.replace(/,/g, '.'));
        const membersWithData = await Promise.all(
          memberEmails.map(async (email) => {
            const emailFormatted = email.replace(/\./g, ',');
            const memberInfo = membersData[emailFormatted] || {};
            
            // Try to get profile picture and name from the user's OWN company
            let profilePic = null;
            let userName = null;
            let firstName = null;
            let lastName = null;
            let userCompanyEmail = null;
            
            try {
              // First, get the user's own company email from emailToCompanyDirectory
              userCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${emailFormatted}`);
              
              if (userCompanyEmail) {
                // Fetch profile picture and name from user's own company
                const [picData, userData] = await Promise.all([
                  getFirebaseData(`Companies/${userCompanyEmail}/users/${emailFormatted}/profileImage`).catch(() => null),
                  getFirebaseData(`Companies/${userCompanyEmail}/users/${emailFormatted}`).catch(() => null)
                ]);
                
                profilePic = picData || null;
                // Use name field, or construct from firstName/lastName, or fallback to email prefix
                userName = userData?.name || (userData?.firstName && userData?.lastName 
                  ? `${userData.firstName} ${userData.lastName}` 
                  : userData?.firstName || email.split('@')[0]);
                firstName = userData?.firstName || null;
                lastName = userData?.lastName || null;
              }
              
              // If not found in user's company, try the project owner's company as fallback
              if (!profilePic || !userName || !firstName || !lastName) {
                const [picData, userData] = await Promise.all([
                  getFirebaseData(`Companies/${targetCompanyEmail}/users/${emailFormatted}/profileImage`).catch(() => null),
                  getFirebaseData(`Companies/${targetCompanyEmail}/users/${emailFormatted}`).catch(() => null)
                ]);
                
                if (!profilePic) profilePic = picData || null;
                if (!userName) {
                  userName = userData?.name || (userData?.firstName && userData?.lastName 
                    ? `${userData.firstName} ${userData.lastName}` 
                    : userData?.firstName || email.split('@')[0]);
                }
                if (!firstName) firstName = userData?.firstName || null;
                if (!lastName) lastName = userData?.lastName || null;
              }
            } catch (e) {
              console.warn('Could not fetch user data for:', email, e);
              userName = email.split('@')[0];
            }

            return {
              email,
              name: userName || email.split('@')[0],
              firstName: firstName || null,
              lastName: lastName || null,
              role: memberInfo.role || 'member',
              joinedAt: memberInfo.joinedAt,
              profilePic: profilePic || null,
              userCompanyEmail: userCompanyEmail || targetCompanyEmail
            };
          })
        );

        // Clean up old profile picture listeners
        profilePicListenersRef.current.forEach(({ ref: refToClean, listener }) => {
          off(refToClean, 'value', listener);
        });
        profilePicListenersRef.current = [];

        // Update projectMembers state
        setProjectMembers(membersWithData);

        // Set up real-time listeners for profile picture and user data updates
        // Also ensure current user is included in presence tracking
        const currentUserEmail = auth.currentUser?.email;
        if (currentUserEmail && !membersWithData.find(m => m.email === currentUserEmail)) {
          // Add current user to members list if not already there (for presence tracking)
          membersWithData.push({
            email: currentUserEmail,
            name: userProfile?.username || currentUserEmail.split('@')[0],
            firstName: userProfile?.firstName || null,
            lastName: userProfile?.lastName || null,
            role: 'owner', // Default role for current user
            profilePic: userProfile?.profileImage || null,
            userCompanyEmail: targetCompanyEmail
          });
        }
        
        if (membersWithData.length > 0) {
          membersWithData.forEach((member) => {
            const emailFormatted = member.email.replace(/\./g, ',');
            
            // Set up listener for profile picture
            const profilePicPath = `Companies/${member.userCompanyEmail}/users/${emailFormatted}/profileImage`;
            const profilePicRef = ref(database, profilePicPath);
            
            const profilePicListener = onValue(profilePicRef, (snapshot) => {
              const newProfilePic = snapshot.val();
              setProjectMembers(prev => prev.map(m => 
                m.email === member.email 
                  ? { ...m, profilePic: newProfilePic || null }
                  : m
              ));
            });
            
            // Set up listener for user data (firstName, lastName, name) to update initials
            const userDataPath = `Companies/${member.userCompanyEmail}/users/${emailFormatted}`;
            const userDataRef = ref(database, userDataPath);
            
            const userDataListener = onValue(userDataRef, (snapshot) => {
              const userData = snapshot.val();
              if (userData) {
                // Update firstName, lastName, and name in state
                const updatedFirstName = userData.firstName || null;
                const updatedLastName = userData.lastName || null;
                const updatedName = userData.name || (updatedFirstName && updatedLastName 
                  ? `${updatedFirstName} ${updatedLastName}` 
                  : updatedFirstName || member.email.split('@')[0]);
                
                setProjectMembers(prev => prev.map(m => 
                  m.email === member.email 
                    ? { 
                        ...m, 
                        firstName: updatedFirstName,
                        lastName: updatedLastName,
                        name: updatedName
                      }
                    : m
                ));
              }
            });
            
            // Store both listeners for cleanup
            profilePicListenersRef.current.push({ ref: profilePicRef, listener: profilePicListener });
            profilePicListenersRef.current.push({ ref: userDataRef, listener: userDataListener });
            
            // Set up presence listener for this member using new presence system
            // Clean up existing listener for this member if any
            if (memberPresenceListenersRef.current.has(member.email)) {
              const cleanup = memberPresenceListenersRef.current.get(member.email);
              if (typeof cleanup === 'function') {
                cleanup();
            }
            }
            
            // Use the new presence system that tracks sessions and computes presence
            const cleanupPresence = listenToUserPresence(member.email, (presence) => {
              setMemberPresence(prev => ({
                ...prev,
                [member.email]: presence // 'active' | 'idle' | 'offline'
              }));
            });
            
            memberPresenceListenersRef.current.set(member.email, cleanupPresence);
          });
        }
      });
    }
    
    // Return cleanup function
    return () => {
      if (membersUnsubscribe && membersListenerRef) {
        off(membersListenerRef, 'value', membersUnsubscribe);
      }
      profilePicListenersRef.current.forEach(({ ref: refToClean, listener }) => {
        off(refToClean, 'value', listener);
      });
      profilePicListenersRef.current = [];
      
      // Clean up presence listeners
      memberPresenceListenersRef.current.forEach((cleanup) => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
      memberPresenceListenersRef.current.clear();
    };
  }, [currentChat?.id, currentChat?.isPublic, currentProject, auth.currentUser]);

  // Initialize selected member when modal opens (admin view)
  useEffect(() => {
    if (showAllMembers && isProjectOwner && projectMembers.length > 0) {
      // Reset mobile state when modal opens
      setShowMobileMemberDetails(false);
      // If a member is already selected (e.g., from clicking profile icon), fetch their details
      if (selectedMemberEmail) {
        const selectedMember = projectMembers.find(m => m.email === selectedMemberEmail);
        if (selectedMember && !memberDetails[selectedMemberEmail]) {
          fetchMemberDetails(selectedMemberEmail, selectedMember.userCompanyEmail || companyEmail);
        }
        return; // Don't override the selection
      }
      // Find current user to select by default
      const currentUserMember = projectMembers.find(m => auth.currentUser?.email === m.email);
      if (currentUserMember) {
        setSelectedMemberEmail(currentUserMember.email);
        // Fetch details for current user
        fetchMemberDetails(currentUserMember.email, currentUserMember.userCompanyEmail || companyEmail);
      } else {
        // Select first member if current user not found
        setSelectedMemberEmail(projectMembers[0].email);
        fetchMemberDetails(projectMembers[0].email, projectMembers[0].userCompanyEmail || companyEmail);
      }
    }
  }, [showAllMembers, isProjectOwner, projectMembers.length]);

  // Initialize selected member when modal opens (recipients view) - show own profile by default
  useEffect(() => {
    if (showAllMembers && !isProjectOwner && projectMembers.length > 0) {
      // Reset mobile state when modal opens
      setShowMobileMemberDetails(false);
      // If a member is already selected (e.g., from clicking profile icon), fetch their details
      if (selectedMemberEmail) {
        const selectedMember = projectMembers.find(m => m.email === selectedMemberEmail);
        if (selectedMember && !memberDetails[selectedMemberEmail]) {
          fetchMemberDetails(selectedMemberEmail, selectedMember.userCompanyEmail || companyEmail);
        }
        return; // Don't override the selection
      }
      // Find current user to select by default
      const currentUserMember = projectMembers.find(m => auth.currentUser?.email === m.email);
      if (currentUserMember) {
        // Always set to current user when modal opens for recipients
        setSelectedMemberEmail(currentUserMember.email);
        // Fetch details for current user
        fetchMemberDetails(currentUserMember.email, currentUserMember.userCompanyEmail || companyEmail);
      } else if (projectMembers.length > 0) {
        // Select first member if current user not found
        setSelectedMemberEmail(projectMembers[0].email);
        fetchMemberDetails(projectMembers[0].email, projectMembers[0].userCompanyEmail || companyEmail);
      }
    }
  }, [showAllMembers, isProjectOwner, projectMembers.length]);

  // Function to fetch member details (bio, username)
  const fetchMemberDetails = async (email, userCompanyEmail) => {
    if (!email || memberDetails[email]) return; // Already loaded
    
    try {
      const emailFormatted = email.replace(/\./g, ',');
      const companyEmailFormatted = (userCompanyEmail || companyEmail).replace(/\./g, ',');
      const userPath = `Companies/${companyEmailFormatted}/users/${emailFormatted}`;
      
      const [userData, bioData] = await Promise.all([
        getFirebaseData(userPath).catch(() => null),
        getFirebaseData(`${userPath}/bio`).catch(() => null)
      ]);
      
      setMemberDetails(prev => ({
        ...prev,
        [email]: {
          username: userData?.name || email.split('@')[0],
          bio: bioData || userData?.bio || null
        }
      }));
    } catch (error) {
      console.error('Error fetching member details:', error);
    }
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showAllMembers) return;
      if (e.key === 'Escape') {
        setShowAllMembers(false);
        setSelectedMemberEmail(null);
        setMemberSearchTerm('');
        setShowMobileMemberDetails(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAllMembers]);

  // Detect Shift key for multi-select mode (only when not typing in input fields)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Shift key (left or right) - use both key and shiftKey for reliability
      const isShiftKey = e.key === 'Shift' || e.key === 'ShiftLeft' || e.key === 'ShiftRight';
      
      if (isShiftKey || (e.shiftKey && !isMultiSelectMode)) {
        // Check if user is typing in an input field
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable ||
          activeElement.getAttribute('contenteditable') === 'true'
        );
        
        // Only activate multi-select mode if NOT typing
        if (!isTyping) {
          setIsMultiSelectMode(true);
        }
      }
    };
    
    const handleKeyUp = (e) => {
      // Check for Shift key (left or right) - use both key and shiftKey for reliability
      const isShiftKey = e.key === 'Shift' || e.key === 'ShiftLeft' || e.key === 'ShiftRight';
      
      if (isShiftKey) {
        setIsMultiSelectMode(false);
      } else if (!e.shiftKey && isMultiSelectMode) {
        // Fallback: if shiftKey is false but we're in multi-select mode, reset it
        setIsMultiSelectMode(false);
      }
    };
    
    // Reset on window blur (when user clicks outside or switches tabs)
    const handleBlur = () => {
      setIsMultiSelectMode(false);
    };
    
    // Reset on mouse down outside (as a backup)
    const handleMouseDown = (e) => {
      // Check if clicking on a quote button - if so, don't reset
      const quoteButton = e.target.closest('button[title*="Quote message"]');
      if (!quoteButton) {
        // Small delay to allow keyup to fire first
        setTimeout(() => {
          // Double-check if Shift is actually still pressed
          if (!e.shiftKey) {
            setIsMultiSelectMode(false);
          }
        }, 50);
      }
    };
    
    // Also reset when clicking anywhere (except quote buttons) after a short delay
    const handleClick = (e) => {
      const quoteButton = e.target.closest('button[title*="Quote message"]');
      if (!quoteButton) {
        // Check if Shift is actually pressed
        setTimeout(() => {
          if (!e.shiftKey) {
            setIsMultiSelectMode(false);
          }
        }, 100);
      }
    };
    
    // Reset when quotes are cleared or message is sent
    const handleQuoteChange = () => {
      // Small delay to check if Shift is still pressed
      setTimeout(() => {
        // If no quotes selected, likely Shift was released
        if (quotedMessages.length === 0) {
          setIsMultiSelectMode(false);
        }
      }, 200);
    };
    
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);
  
  // Reset multi-select mode when quotes are cleared
  useEffect(() => {
    if (quotedMessages.length === 0) {
      setIsMultiSelectMode(false);
    }
  }, [quotedMessages.length]);

  // Real-time listener for View Members modal - updates members list when modal is open
  useEffect(() => {
    if (!showAllMembers || !isProjectShared) return;

    const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
    const targetCompanyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
    
    if (!targetCompanyEmail || !currentProject) return;

    const membersPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/members`;
    const membersRef = ref(database, membersPath);
    
    const membersListener = onValue(membersRef, async (snapshot) => {
      const membersData = snapshot.val();
      
      if (!membersData) {
        setProjectMembers([]);
        return;
      }

      // Convert members object to array and fetch profile pictures and names
      const memberEmails = Object.keys(membersData).map(emailPath => emailPath.replace(/,/g, '.'));
      
      // Ensure current user is included in the list for presence tracking
      const currentUserEmail = auth.currentUser?.email;
      if (currentUserEmail && !memberEmails.includes(currentUserEmail)) {
        memberEmails.push(currentUserEmail);
      }
      
      const membersWithData = await Promise.all(
        memberEmails.map(async (email) => {
          const emailFormatted = email.replace(/\./g, ',');
          const memberInfo = membersData[emailFormatted] || {};
          
          // Try to get profile picture and name from the user's OWN company
          let profilePic = null;
          let userName = null;
          let firstName = null;
          let lastName = null;
          let userCompanyEmail = null;
          
          try {
            // First, get the user's own company email from emailToCompanyDirectory
            userCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${emailFormatted}`);
            
            if (userCompanyEmail) {
              // Fetch profile picture and name from user's own company
              const [picData, userData] = await Promise.all([
                getFirebaseData(`Companies/${userCompanyEmail}/users/${emailFormatted}/profileImage`).catch(() => null),
                getFirebaseData(`Companies/${userCompanyEmail}/users/${emailFormatted}`).catch(() => null)
              ]);
              
              profilePic = picData || null;
              userName = userData?.name || email.split('@')[0];
              firstName = userData?.firstName || null;
              lastName = userData?.lastName || null;
            }
            
            // If not found in user's company, try the project owner's company as fallback
            if (!profilePic || !userName || !firstName || !lastName) {
              const [picData, userData] = await Promise.all([
                getFirebaseData(`Companies/${targetCompanyEmail}/users/${emailFormatted}/profileImage`).catch(() => null),
                getFirebaseData(`Companies/${targetCompanyEmail}/users/${emailFormatted}`).catch(() => null)
              ]);
              
              if (!profilePic) profilePic = picData || null;
              if (!userName) userName = userData?.name || email.split('@')[0];
              if (!firstName) firstName = userData?.firstName || null;
              if (!lastName) lastName = userData?.lastName || null;
            }
          } catch (e) {
            console.warn('Could not fetch user data for:', email, e);
            userName = email.split('@')[0];
          }

          return {
            email,
            name: userName || email.split('@')[0],
            firstName: firstName || null,
            lastName: lastName || null,
            role: memberInfo.role || 'member',
            joinedAt: memberInfo.joinedAt,
            profilePic: profilePic || null,
            userCompanyEmail: userCompanyEmail || targetCompanyEmail
          };
        })
      );

      setProjectMembers(membersWithData);
      
      // Set up presence listeners for all members (including current user)
      if (membersWithData.length > 0) {
        // Clean up old presence listeners first
        memberPresenceListenersRef.current.forEach((cleanup) => {
          if (typeof cleanup === 'function') {
            cleanup();
          }
        });
        memberPresenceListenersRef.current.clear();
        
        // Set up presence listeners for all members
        membersWithData.forEach((member) => {
          // Set up presence listener for this member
          const cleanupPresence = listenToUserPresence(member.email, (presence) => {
            setMemberPresence(prev => ({
              ...prev,
              [member.email]: presence // 'active' | 'idle' | 'offline'
            }));
          });
          
          memberPresenceListenersRef.current.set(member.email, cleanupPresence);
        });
      }
    });

    return () => {
      off(membersRef, 'value', membersListener);
      // Clean up presence listeners when modal closes
      memberPresenceListenersRef.current.forEach((cleanup) => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
      memberPresenceListenersRef.current.clear();
    };
  }, [showAllMembers, isProjectShared, currentProject, auth.currentUser]);

  // Real-time listener for Admin Panel - loads members with permissions
  useEffect(() => {
    if (!showAdminPanel) return;

    // Allow loading if user is project owner OR if they own the company
    const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
    const targetCompanyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
    const userCompanyEmail = localStorage.getItem('companyEmail');
    
    // Check if user owns the company (owner may not be in members list yet)
    const isCompanyOwner = userCompanyEmail && !sharedCompanyEmail && 
      userCompanyEmail.replace(/\./g, ',') === targetCompanyEmail?.replace(/\./g, ',');
    
    // Only allow access if project owner or company owner
    if (!isProjectOwner && !isCompanyOwner) {
      console.log('[AdminPanel] Access denied - not project owner or company owner');
      return;
    }
    
    if (!targetCompanyEmail || !currentProject) return;
    
    console.log('[AdminPanel] Loading members for project:', currentProject);

    const membersRef = ref(database, `Companies/${targetCompanyEmail}/projects/${currentProject}/members`);
    
    const membersListener = onValue(membersRef, async (snapshot) => {
      const data = snapshot.val();
      
      // Get owner email - the company email is typically the owner's email
      const ownerEmailFormatted = targetCompanyEmail.replace(/\./g, ',');
      const ownerEmail = targetCompanyEmail.replace(/,/g, '.');
      
      // Check if owner is already in members list
      const ownerInMembers = data && data[ownerEmailFormatted];
      
      // Convert members object to array and fetch profile pictures
      const membersArray = await Promise.all(
        Object.entries(data || {}).map(async ([emailKey, memberData]) => {
          const email = emailKey.replace(/,/g, '.');
          
          // Get user's company email for profile picture lookup
          const userCompanyEmail = await getFirebaseData(
            `emailToCompanyDirectory/${emailKey}`
          ).catch(() => targetCompanyEmail);
          
          // Fetch profile picture - use same logic as ChatSidebar
          const profilePic = await getFirebaseData(
            `Companies/${userCompanyEmail}/users/${emailKey}/profileImage`
          ).catch(() => null);
          
          // Use null if no picture found (initials will be used as fallback)
          const finalProfilePic = profilePic || null;
          
          // Get user name, firstName, and lastName
          const userData = await getFirebaseData(
            `Companies/${userCompanyEmail}/users/${emailKey}`
          ).catch(() => null);
          
          const userName = userData?.name || (userData?.firstName && userData?.lastName 
            ? `${userData.firstName} ${userData.lastName}` 
            : userData?.firstName || email);
          const firstName = userData?.firstName || null;
          const lastName = userData?.lastName || null;

          // Set default permissions if not present
          const defaultPermissions = {
            createHighlights: true,
            createAnnotations: true,
            modifyAnnotations: true,
            deleteAnnotations: true,
            share: true
          };

          const memberRole = memberData.role || 'editor';
          
          // Format joined date
          let joinedDate = '—';
          if (memberData.joinedAt) {
            const date = new Date(memberData.joinedAt);
            joinedDate = date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            });
          }
          
          return {
            email,
            name: userName || email,
            firstName: firstName || null,
            lastName: lastName || null,
            role: memberRole,
            profilePic: finalProfilePic,
            userCompanyEmail: userCompanyEmail || targetCompanyEmail,
            joinedAt: memberData.joinedAt || null,
            joinedDate: joinedDate,
            permissions: memberRole === 'owner' 
              ? defaultPermissions 
              : (memberRole === 'viewer' 
                ? null 
                : (memberData.permissions || defaultPermissions))
          };
        })
      );

      // If owner is not in members list, add them
      if (!ownerInMembers) {
        try {
          // Fetch owner's profile picture and name - use same logic as ChatSidebar
          const ownerProfilePic = await getFirebaseData(
            `Companies/${targetCompanyEmail}/users/${ownerEmailFormatted}/profileImage`
          ).catch(() => null);
          
          // Use default profile if no picture found
          const finalOwnerProfilePic = ownerProfilePic || null;
          
          const ownerUserData = await getFirebaseData(
            `Companies/${targetCompanyEmail}/users/${ownerEmailFormatted}`
          ).catch(() => null);
          
          const ownerName = ownerUserData?.name || (ownerUserData?.firstName && ownerUserData?.lastName 
            ? `${ownerUserData.firstName} ${ownerUserData.lastName}` 
            : ownerUserData?.firstName || ownerEmail);
          const ownerFirstName = ownerUserData?.firstName || null;
          const ownerLastName = ownerUserData?.lastName || null;
          
          // Get project creation date as joined date
          const projectData = await getFirebaseData(
            `Companies/${targetCompanyEmail}/projects/${currentProject}`
          ).catch(() => null);
          
          let joinedDate = '—';
          if (projectData?.createdAt) {
            const date = new Date(projectData.createdAt);
            joinedDate = date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            });
          }
          
          const defaultPermissions = {
            createHighlights: true,
            createAnnotations: true,
            modifyAnnotations: true,
            deleteAnnotations: true,
            share: true
          };
          
          membersArray.push({
            email: ownerEmail,
            name: ownerName || ownerEmail,
            firstName: ownerFirstName || null,
            lastName: ownerLastName || null,
            role: 'owner',
            profilePic: finalOwnerProfilePic,
            userCompanyEmail: targetCompanyEmail,
            joinedAt: projectData?.createdAt || null,
            joinedDate: joinedDate,
            permissions: defaultPermissions
          });
        } catch (error) {
          console.warn('Error fetching owner data for admin panel:', error);
        }
      }

      // Sort: owners first, then by name
      membersArray.sort((a, b) => {
        if (a.role === 'owner' && b.role !== 'owner') return -1;
        if (a.role !== 'owner' && b.role === 'owner') return 1;
        return a.name.localeCompare(b.name);
      });

      setAdminPanelMembers(membersArray);
    });

    return () => {
      off(membersRef, 'value', membersListener);
    };
  }, [showAdminPanel, isProjectOwner, currentProject, auth.currentUser]);

  // Real-time listener for profile picture updates in admin panel
  useEffect(() => {
    // Check if user should have access (same logic as main admin panel listener)
    const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
    const targetCompanyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
    const userCompanyEmail = localStorage.getItem('companyEmail');
    const isCompanyOwner = userCompanyEmail && !sharedCompanyEmail && 
      userCompanyEmail.replace(/\./g, ',') === targetCompanyEmail?.replace(/\./g, ',');
    
    if (!showAdminPanel || (!isProjectOwner && !isCompanyOwner) || adminPanelMembers.length === 0) {
      // Clean up all listeners when panel is closed
      adminPanelProfilePicListenersRef.current.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (e) {
          console.warn('Error unsubscribing from profile picture listener:', e);
        }
      });
      adminPanelProfilePicListenersRef.current.clear();
      return;
    }
    
    if (!targetCompanyEmail) return;

    // Get current member emails
    const currentMemberEmails = new Set(adminPanelMembers.map(m => m.email));
    
    // Remove listeners for members no longer in the list
    adminPanelProfilePicListenersRef.current.forEach((unsubscribe, email) => {
      if (!currentMemberEmails.has(email)) {
        try {
          unsubscribe();
        } catch (e) {
          console.warn('Error unsubscribing from profile picture listener:', e);
        }
        adminPanelProfilePicListenersRef.current.delete(email);
      }
    });

    // Set up listeners for new members (those not already being listened to)
    adminPanelMembers.forEach((member) => {
      // Skip if we're already listening to this member
      if (adminPanelProfilePicListenersRef.current.has(member.email)) return;

      const emailFormatted = member.email.replace(/\./g, ',');
      
      // Use the member's stored userCompanyEmail, or fetch it
      const userCompanyEmail = member.userCompanyEmail || targetCompanyEmail;
      
      // Set up listener for profile picture
      const profilePicPath = `Companies/${userCompanyEmail}/users/${emailFormatted}/profileImage`;
      const profilePicRef = ref(database, profilePicPath);
      
      const unsubscribeProfilePic = onValue(profilePicRef, (snapshot) => {
        const newProfilePic = snapshot.val();
        const finalProfilePic = newProfilePic || null;
        
        // Update the member's profile picture in state
        setAdminPanelMembers(prev => 
          prev.map(m => 
            m.email === member.email 
              ? { ...m, profilePic: finalProfilePic }
              : m
          )
        );
      });
      
      // Set up listener for user data (firstName, lastName, name) to update initials
      const userDataPath = `Companies/${userCompanyEmail}/users/${emailFormatted}`;
      const userDataRef = ref(database, userDataPath);
      
      const unsubscribeUserData = onValue(userDataRef, (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
          // Update firstName, lastName, and name in state
          const updatedFirstName = userData.firstName || null;
          const updatedLastName = userData.lastName || null;
          const updatedName = userData.name || (updatedFirstName && updatedLastName 
            ? `${updatedFirstName} ${updatedLastName}` 
            : updatedFirstName || member.email.split('@')[0]);
          
          setAdminPanelMembers(prev => 
            prev.map(m => 
              m.email === member.email 
                ? { 
                    ...m, 
                    firstName: updatedFirstName,
                    lastName: updatedLastName,
                    name: updatedName
                  }
                : m
            )
          );
        }
      });
      
      // Store both unsubscribers as a combined function
      const combinedUnsubscribe = () => {
        unsubscribeProfilePic();
        unsubscribeUserData();
      };
      
      adminPanelProfilePicListenersRef.current.set(member.email, combinedUnsubscribe);
    });

    // Also listen for custom profileImageUpdated event
    const handleProfileImageUpdate = (event) => {
      if (event.detail && event.detail.imageUrl) {
        // If userEmail is provided, update specific user
        if (event.detail.userEmail) {
          const updatedEmail = event.detail.userEmail.replace(/\./g, ',');
          setAdminPanelMembers(prev => 
            prev.map(m => {
              const memberEmailFormatted = m.email.replace(/\./g, ',');
              if (memberEmailFormatted === updatedEmail) {
                return { ...m, profilePic: event.detail.imageUrl };
              }
              return m;
            })
          );
        } else {
          // If no userEmail, update current user's profile picture
          const currentUser = auth.currentUser;
          if (currentUser && currentUser.email) {
            const currentUserEmailFormatted = currentUser.email.replace(/\./g, ',');
            setAdminPanelMembers(prev => 
              prev.map(m => {
                const memberEmailFormatted = m.email.replace(/\./g, ',');
                if (memberEmailFormatted === currentUserEmailFormatted) {
                  return { ...m, profilePic: event.detail.imageUrl };
                }
                return m;
              })
            );
          }
        }
      }
    };
    
    window.addEventListener('profileImageUpdated', handleProfileImageUpdate);

    return () => {
      // Clean up all profile picture listeners
      adminPanelProfilePicListenersRef.current.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (e) {
          console.warn('Error unsubscribing from profile picture listener:', e);
        }
      });
      adminPanelProfilePicListenersRef.current.clear();
      window.removeEventListener('profileImageUpdated', handleProfileImageUpdate);
    };
  }, [showAdminPanel, isProjectOwner, adminPanelMembers.map(m => m.email).join(',')]);

  // Real-time listener for current user's role - updates when role changes
  useEffect(() => {
    if (!auth.currentUser || !auth.currentUser.email) {
      setCurrentUserRole(null);
      return;
    }

    const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
    const targetCompanyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
    
    if (!targetCompanyEmail || !currentProject) {
      setCurrentUserRole(null);
      return;
    }

    const currentUserEmail = auth.currentUser.email.replace(/\./g, ',');
    const memberPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/members/${currentUserEmail}`;
    const memberRef = ref(database, memberPath);
    
    const unsubscribe = onValue(memberRef, (snapshot) => {
      const memberData = snapshot.val();
      
      let role = null;
      if (memberData && memberData.role) {
        role = memberData.role;
        const previousRole = previousUserRoleRef.current;
        
        // Show toast notification when role changes (but not on initial load)
        if (previousRole !== null && previousRole !== role) {
          if (role === 'viewer') {
            const eyeIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.9;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            showToast('View Only Mode', 'info', 5000, eyeIcon);
          } else if (role === 'editor') {
            const pencilIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            showToast('Editor Mode', 'success', 5000, pencilIcon);
          }
        }
        
        previousUserRoleRef.current = role;
        setCurrentUserRole(role);
        // Set window variable for highlighting.js to access
        if (typeof window !== 'undefined') {
          window.currentUserRole = role;
          // Update annotation card buttons when role changes
          if (typeof window.updateAnnotationCardButtonsVisibility === 'function') {
            window.updateAnnotationCardButtonsVisibility();
          }
        }
        
        // Set up permissions based on role and member data
        if (role === 'owner') {
          // Owners always have all permissions
          if (typeof window !== 'undefined') {
            window.currentUserPermissions = DEFAULT_PERMISSIONS;
          }
        } else if (memberData && memberData.permissions && typeof memberData.permissions === 'object') {
          // Merge member permissions with defaults
          if (typeof window !== 'undefined') {
            window.currentUserPermissions = {
              ...DEFAULT_PERMISSIONS,
              ...memberData.permissions
            };
          }
        } else {
          // Default permissions if none specified
          if (typeof window !== 'undefined') {
            window.currentUserPermissions = DEFAULT_PERMISSIONS;
          }
        }
      } else {
        // Check if user owns the company
        const normalizedTargetCompany = targetCompanyEmail.replace(/\./g, ',');
        getFirebaseData(`emailToCompanyDirectory/${currentUserEmail}`).then(userCompanyEmail => {
          if (userCompanyEmail) {
            const normalizedUserCompany = userCompanyEmail.replace(/\./g, ',');
            if (normalizedUserCompany === normalizedTargetCompany) {
              role = 'owner';
            } else {
              // Default to editor for backward compatibility
              role = 'editor';
            }
          } else {
            // Default to editor for backward compatibility
            role = 'editor';
          }
          
          const previousRole = previousUserRoleRef.current;
          // Show toast notification when role changes (but not on initial load)
          if (previousRole !== null && previousRole !== role) {
            if (role === 'viewer') {
            const eyeIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            showToast('View Only Mode', 'info', 5000, eyeIcon);
            } else if (role === 'editor') {
            const pencilIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            showToast('Editor Mode', 'success', 5000, pencilIcon);
            }
          }
          
          previousUserRoleRef.current = role;
          setCurrentUserRole(role);
          // Set window variable for highlighting.js to access
          if (typeof window !== 'undefined') {
            window.currentUserRole = role;
            // Update annotation card buttons when role changes
            if (typeof window.updateAnnotationCardButtonsVisibility === 'function') {
              window.updateAnnotationCardButtonsVisibility();
            }
          }
          
          // Set up permissions based on role
          if (role === 'owner') {
            // Owners always have all permissions
            if (typeof window !== 'undefined') {
              window.currentUserPermissions = DEFAULT_PERMISSIONS;
            }
          } else {
            // For non-owners, check member data for permissions
            getFirebaseData(memberPath).then(memberData => {
              if (memberData && memberData.permissions && typeof memberData.permissions === 'object') {
                // Merge member permissions with defaults
                if (typeof window !== 'undefined') {
                  window.currentUserPermissions = {
                    ...DEFAULT_PERMISSIONS,
                    ...memberData.permissions
                  };
                }
              } else {
                // Default permissions if none specified
                if (typeof window !== 'undefined') {
                  window.currentUserPermissions = DEFAULT_PERMISSIONS;
                }
              }
            }).catch(() => {
              // Default permissions on error
              if (typeof window !== 'undefined') {
                window.currentUserPermissions = DEFAULT_PERMISSIONS;
              }
            });
          }
        }).catch(() => {
          // If we can't determine, default to editor
          role = 'editor';
          const previousRole = previousUserRoleRef.current;
          // Show toast notification when role changes (but not on initial load)
          if (previousRole !== null && previousRole !== role) {
            if (role === 'viewer') {
            const eyeIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            showToast('View Only Mode', 'info', 5000, eyeIcon);
            } else if (role === 'editor') {
            const pencilIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            showToast('Editor Mode', 'success', 5000, pencilIcon);
            }
          }
          
          previousUserRoleRef.current = role;
          setCurrentUserRole(role);
          if (typeof window !== 'undefined') {
            window.currentUserRole = role;
            // Update annotation card buttons when role changes
            if (typeof window.updateAnnotationCardButtonsVisibility === 'function') {
              window.updateAnnotationCardButtonsVisibility();
            }
          }
        });
      }
      
      // Set window variable for highlighting.js to access
      if (typeof window !== 'undefined' && role) {
        const previousRole = previousUserRoleRef.current;
        // Show toast notification when role changes (but not on initial load)
        if (previousRole !== null && previousRole !== role) {
          if (role === 'viewer') {
            const eyeIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.9;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            showToast('View Only Mode', 'info', 5000, eyeIcon);
          } else if (role === 'editor') {
            const pencilIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            showToast('Editor Mode', 'success', 5000, pencilIcon);
          }
        }
        
        previousUserRoleRef.current = role;
        window.currentUserRole = role;
        // Update annotation card buttons when role changes
        if (typeof window.updateAnnotationCardButtonsVisibility === 'function') {
          window.updateAnnotationCardButtonsVisibility();
        }
        
        // Set up permissions based on role
        if (role === 'owner') {
          // Owners always have all permissions
          if (typeof window !== 'undefined') {
            window.currentUserPermissions = DEFAULT_PERMISSIONS;
          }
        } else {
          // For non-owners, get member data to check permissions
          getFirebaseData(memberPath).then(memberData => {
            if (memberData && memberData.permissions && typeof memberData.permissions === 'object') {
              // Merge member permissions with defaults
              if (typeof window !== 'undefined') {
                window.currentUserPermissions = {
                  ...DEFAULT_PERMISSIONS,
                  ...memberData.permissions
                };
              }
            } else {
              // Default permissions if none specified
              if (typeof window !== 'undefined') {
                window.currentUserPermissions = DEFAULT_PERMISSIONS;
              }
            }
          }).catch(() => {
            // Default permissions on error
            if (typeof window !== 'undefined') {
              window.currentUserPermissions = DEFAULT_PERMISSIONS;
            }
          });
        }
      }
    });

    // Set up real-time permission listener
    let permissionsUnsubscribe = null;
    if (auth.currentUser && targetCompanyEmail && currentProject) {
      const currentUserEmail = auth.currentUser.email.replace(/\./g, ',');
      const targetCompanyEmailFormatted = targetCompanyEmail.replace(/\./g, ',');
      const permissionsPath = `Companies/${targetCompanyEmailFormatted}/projects/${currentProject}/members/${currentUserEmail}/permissions`;
      const permissionsRef = ref(database, permissionsPath);
      
      permissionsUnsubscribe = onValue(permissionsRef, (snapshot) => {
        const permissionsData = snapshot.val();
        const currentRole = typeof window !== 'undefined' ? window.currentUserRole : null;
        
        if (currentRole === 'owner') {
          // Owners always have all permissions
          if (typeof window !== 'undefined') {
            window.currentUserPermissions = DEFAULT_PERMISSIONS;
          }
        } else if (permissionsData && typeof permissionsData === 'object') {
          // Merge permissions with defaults
          if (typeof window !== 'undefined') {
            window.currentUserPermissions = {
              ...DEFAULT_PERMISSIONS,
              ...permissionsData
            };
          }
        } else {
          // Default permissions if none specified
          if (typeof window !== 'undefined') {
            window.currentUserPermissions = DEFAULT_PERMISSIONS;
          }
        }
        
        // Update button visibility when permissions change
        if (typeof window !== 'undefined' && typeof window.updateAnnotationCardButtonsVisibility === 'function') {
          window.updateAnnotationCardButtonsVisibility();
        }
      }, (error) => {
        console.error('Error listening to permissions:', error);
        // Default permissions on error
        if (typeof window !== 'undefined') {
          window.currentUserPermissions = DEFAULT_PERMISSIONS;
        }
        // Update button visibility even on error
        if (typeof window !== 'undefined' && typeof window.updateAnnotationCardButtonsVisibility === 'function') {
          window.updateAnnotationCardButtonsVisibility();
        }
      });
    }

    return () => {
      unsubscribe();
      if (permissionsUnsubscribe) {
        permissionsUnsubscribe();
      }
    };
  }, [currentProject, auth.currentUser]);

  // Refresh profile pictures on common actions (switching chats, typing messages, etc.)
  useEffect(() => {
    if (currentChat?.isPublic && projectMembers.length > 0) {
      // Refresh profile pictures when chat changes
      const refreshProfilePics = async () => {
        const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
        const targetCompanyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
        
        if (!targetCompanyEmail) return;
        
        const updatedMembers = await Promise.all(
          projectMembers.map(async (member) => {
            try {
              const emailFormatted = member.email.replace(/\./g, ',');
              const profilePic = await getFirebaseData(
                `Companies/${member.userCompanyEmail}/users/${emailFormatted}/profileImage`
              ).catch(() => null);
              
              return {
                ...member,
                profilePic: profilePic || null
              };
            } catch (e) {
              return member;
            }
          })
        );
        
        setProjectMembers(updatedMembers);
      };
      
      refreshProfilePics();
    }
  }, [currentChat?.id, inputValue]); // Refresh when chat changes or user types

  // Update messaging tab state when chat privacy or member count changes
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10;
    let timeoutId = null;
    
    const updateMessagingTab = () => {
      const iframe = document.getElementById('sidebar-iframe');
      if (iframe && iframe.contentWindow && typeof iframe.contentWindow.updateMessagingTabState === 'function') {
        const isPublic = currentChat ? currentChat.isPublic : true; // Default to public if no chat
        console.log('[Messaging Tab] Updating state:', { isPublic, projectMemberCount, chatId: currentChat?.id });
        iframe.contentWindow.updateMessagingTabState(isPublic, projectMemberCount);
      } else if (isExtensionSidebarVisible && retryCount < maxRetries) {
        // Iframe not ready yet, retry after a short delay
        retryCount++;
        timeoutId = setTimeout(updateMessagingTab, 200);
      }
    };
    
    // Only update if sidebar is visible
    if (isExtensionSidebarVisible) {
      updateMessagingTab();
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [currentChat?.id, currentChat?.isPublic, projectMemberCount, isExtensionSidebarVisible]);

  // Check if user is authenticated and show modal if not
  useEffect(() => {
    const checkAuth = () => {
      const user = auth.currentUser;
      if (!user && !sessionStorage.getItem('guestMode')) {
        setShowAuthModal(true);
      }
    };
    // Check auth status when component mounts
    checkAuth();

    // Also listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user && !sessionStorage.getItem('guestMode')) {
        setShowAuthModal(true);
      } else {
        setShowAuthModal(false);
      }

    if (!user)
    {
      setMessages([]);
      setCurrentChat(null);
      // debug log removed
      setInputValue('');
      clearImagePreview();
      setEditingMessageIndex(null);
      setEditingMessageContent('');
      setIsSharedView(false); // Reset shared view state explicitly
      
      const url = new URL(window.location.href);

    url.search = ''; 

    window.history.pushState({}, '', url.toString()); // Update the URL without a page reload

    
    }
    });

    return () => unsubscribe();
  }, []);

  // Handler for continuing as guest
  const handleGuestContinue = () => {
    sessionStorage.setItem('guestMode', 'true');
    setShowAuthModal(false);
  };

  // Helper to ensure messageRefs object is updated correctly
  const setMessageRef = (index, element) => {
    if (element) {
      messageRefs.current[index] = element;
    } else {
      delete messageRefs.current[index];
    }
  };

  const scrollToBottom = (behavior = 'auto') => {
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
      } catch (_) {
        // Fallback in case smooth scrolling is not supported
        messagesEndRef.current.scrollIntoView();
      }
    }
  };

  // Track user scroll position to decide whether to auto-scroll
  useEffect(() => {
    const container = chatMessagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      // Enable auto-scroll if near the bottom; disable when user scrolls up
      setIsAutoScrollEnabled(distanceFromBottom < 120);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    // Initialize state based on initial position
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const container = chatMessagesContainerRef.current;
    if (!container) return undefined;

    const compute = () => {
      const w = Number(container.clientWidth) || 0;
      // keep a small gutter so the canvas never touches the edges
      const available = Math.max(0, w - 24);
      const next = Math.min(1, CHAT_CANVAS_WIDTH > 0 ? (available / CHAT_CANVAS_WIDTH) : 1);
      setChatCanvasScale(Number.isFinite(next) && next > 0 ? next : 1);
    };

    compute();

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => compute());
      ro.observe(container);
    }
    window.addEventListener('resize', compute);

    return () => {
      window.removeEventListener('resize', compute);
      if (ro) ro.disconnect();
    };
  }, []);

  // Scroll to bottom when messages change if user hasn't scrolled up
  useEffect(() => {
    if (messages.length > 0 && isAutoScrollEnabled) {
      scrollToBottom('smooth');
    }
  }, [messages, isAutoScrollEnabled]);

  // Also follow loading state (e.g., streaming/loading bubble)
  useEffect(() => {
    if (isAutoScrollEnabled && (isLoading || !isLoading)) {
      // Trigger on any loading change to keep view pinned
      scrollToBottom('smooth');
    }
  }, [isLoading, isAutoScrollEnabled]);

  // Ensure highlights get chatID in Firebase when missing (no extension edits)
  useEffect(() => {
    const selectedChatId = currentChatID || (currentChat && currentChat.id) || null;
    try { localStorage.setItem('phraze_currentChatId', selectedChatId || ''); } catch (_) {}
    if (!selectedChatId) return;

    let cancelled = false;
    const backfill = async () => {
      try {
        // Use shared company email if viewing a shared project, otherwise use own company
        const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
        const companyEmailPath = sharedCompanyEmail || localStorage.getItem('companyEmail');
        const projectName = localStorage.getItem('currentProject') || 'default';
        if (!companyEmailPath) return;

        // Format email for Firebase (periods -> commas)
        const formattedEmail = companyEmailPath.replace(/\./g, ',');
        const path = `Companies/${formattedEmail}/projects/${projectName}/highlights`;
        const highlights = (await getFirebaseData(path)) || [];
        if (!Array.isArray(highlights) || highlights.length === 0) return;

        let mutated = false;
        const updated = highlights.map(h => {
          if (h && !h.chatID) {
            mutated = true;
            return { ...h, chatID: selectedChatId };
          }
          return h;
        });

        if (!cancelled && mutated) {
          await saveFirebaseData(path, updated);
          try { console.log('[Phraze] Backfilled chatID on', updated.filter(h => h.chatID === selectedChatId).length, 'highlights for chat:', selectedChatId); } catch (_) {}
        }
      } catch (err) {
        console.error('[Phraze] Error backfilling chatID:', err);
      }
    };

    // Run backfill once when chat changes, then periodically
    backfill();
    const id = setInterval(backfill, 5000); // Check every 5 seconds
    return () => { cancelled = true; clearInterval(id); };
  }, [currentChatID, currentChat]);

  useEffect(() => {
    // Check if we should restore a shared project context on mount
    const storedProject = localStorage.getItem('currentProject');
    const storedSharedProjectId = localStorage.getItem('sharedProjectId');
    const storedSharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
    
    // If we have a stored shared project that matches, use that instead of the default
    if (storedProject && storedSharedProjectId && storedProject === storedSharedProjectId && storedSharedCompanyEmail) {
      console.log("[Demonstration] Restoring shared project on mount:", storedProject, "with company:", storedSharedCompanyEmail);
      // Let ChatSidebar handle the restoration via onProjectChange callback
      // Don't call handleProjectChange with 'default' - wait for the correct project
      if (currentProject === storedProject) {
        handleProjectChange(currentProject);
      }
      // Don't overwrite localStorage with potentially wrong value
      return;
    }
    
    handleProjectChange(currentProject);
    localStorage.setItem("currentProject", currentProject);
  }, [currentProject]);

  // Effect 1: Set initial shared state based ONLY on initial URL params
  useEffect(() => {
    // Removed console.log for performance
    
    const params = new URLSearchParams(location.search);
    const sharedId = params.get('share');
    const companyEmailParam = params.get('companyEmail');
    const projectParam = params.get('project');

    // Removed console.log for performance

    if (sharedId && companyEmailParam && projectParam) {
      // Removed console.log for performance
      setIsSharedView(true);
      // Removed console.log for performance
      localStorage.setItem("companyEmail", companyEmailParam);
      setSharedCompanyEmail(companyEmailParam);
      setCurrentProject(projectParam);
      loadSharedChat(sharedId, companyEmailParam);
      // No need to navigate away, keep params for refresh
    } else {
      // Removed console.log for performance
    }
    // No 'else' block here. isSharedView defaults to false and is only set true here,
    // or reset explicitly by clearChats.
  }, []); // Empty dependency array: Run only once on mount

  // Effect 2: Handle chat clearing (separate from initial load)
  useEffect(() => {
    const handleClearChats = () => {
      console.log("Clearing chat state...");
      setMessages([]);
      setCurrentChat(null);
      // debug log removed
      setInputValue('');
      clearImagePreview();
      setEditingMessageIndex(null);
      setEditingMessageContent('');
      setIsSharedView(false); // Reset shared view state explicitly
      setSharedCompanyEmail(null);
      // setChatHighlights([]);
      // setAnnotationHistoryData(null);
    };

    //Called from extension when showing groq chats in the messaging system in the extension popup window
    async function handleExtensionMessages(event) {
      if (event.data.action == "Show Highlights") {
        setOverrideShowHighlights(true);
        setSharedCompanyEmail(event.data.companyEmail);
      }
      else if (event.data.action == "Show Sidebar") {
        setIsSidebarCollapsed(false);
      }
      else if (event.data.action == "Inside Extension") {
        handleProjectChange(event.data.currentProject);
        setIsSidebarCollapsed(false);
        setIsInsideExtension(true);
      }
      else if (event.data.action == "getFirebaseData") {
        var data = await getFirebaseData(event.data.path);
        document.getElementById("sidebar-iframe").contentWindow.postMessage({ requestID: event.data.requestID, data: data }, "*");
      }
      else if (event.data.action == "saveFirebaseData") {
        await saveFirebaseData(event.data.path, event.data.data);
        document.getElementById("sidebar-iframe").contentWindow.postMessage({ requestID: event.data.requestID, data: "Saved" }, "*");
      }
      else if (event.data.action == "listenerFirebaseData") {

        const firebaseDb = await import('firebase/database');
        const { ref, onValue, off } = firebaseDb;
        const { database } = await import('../firebase-init'); // Get database instance
        let listenerRef = ref(database, event.data.path);

        // Define the callback for onValue
        const handleValueChange = (snapshot) => {

          document.getElementById("sidebar-iframe").contentWindow.postMessage(
            {
              action: "firebaseDataChanged",
              path: event.data.path,
              data: snapshot.val()
            },
            "*");
        };
        // Attach the listener
        onValue(listenerRef, handleValueChange);
      }
      else if (event.data.action == "removeFirebaseListener") {
        const firebaseDb = await import('firebase/database');
        const { ref, onValue, off } = firebaseDb;
        const { database } = await import('../firebase-init'); // Get database instance
        let path = event.data.path;
        const myRef = ref(database, path);
        off(myRef); // Removes all listeners for this ref
      }
      else if (event.data.action == "startCapture") {

        showToast("Capturing full page...", "info");
        setPrevSidebarWidth(sidebarWidth);
        setSidebarWidth(0);
        // setIsContactsPanelVisible(false);

        setTimeout(async function () {

          //For debugging errors with html2canvas breaking
          // document.querySelectorAll('*').forEach(el => {
          //   try {
          //     getComputedStyle(el).transform;
          //   } catch (e) {
          //     console.warn('Error computing style for element:', el, e);
          //   }
          // });

          // var ele = document.getElementById("mainChatInterface");
          var messagesDiv = document.getElementById("chatMessagesDiv");
          const captureWidth = Math.max(messagesDiv.scrollWidth, messagesDiv.clientWidth);
          const captureHeight = Math.max(messagesDiv.scrollHeight, messagesDiv.clientHeight);
          messagesDiv.style.overflowY = "unset";

          await loadHighlights(true);

          setTimeout(function () {
            let rect = messagesDiv.getBoundingClientRect();

            let eles = document.getElementsByClassName("PhrazeHighlight-data-preview");
            for (let ele of eles) {
              messagesDiv.appendChild(ele);
              ele.style.left = `${parseFloat(ele.style.left) - rect.left}px`;
              ele.style.top = `${(parseFloat(ele.style.top) - rect.top) + 60}px`;
              // if (ele.childNodes && ele.childNodes[0].textContent.trim() != "")
              //   ele.style.opacity = 1;
            }

            eles = document.getElementsByClassName("phraze-note-dropdown");
            for (let ele of eles) {
              ele.classList.remove("visible");
            }

            // document.querySelectorAll('.PhrazeHighlight-data-preview').forEach(el => {
            //   const rect = el.getBoundingClientRect();
            //   el.style.top = `${rect.top + window.scrollY}px`;
            //   el.style.left = `${rect.left + window.scrollX}px`;
            // });


            html2canvas(messagesDiv, {
              useCORS: true,
              // Force full container dimensions so we don't accidentally crop to a highlight <mark>.
              width: captureWidth,
              height: captureHeight,
              windowWidth: captureWidth,
              windowHeight: captureHeight,
              x: 0,
              y: 0,
              scrollX: 0,
              scrollY: 0,
              ignoreElements: (el) => {
                return el.id === "groqChatInputDiv";
              },
              onclone: (clonedDoc) => {
                // Ensure the cloned chat container is expanded to include all text before/after highlights.
                try {
                  const clonedMessagesDiv = clonedDoc.getElementById('chatMessagesDiv');
                  if (clonedMessagesDiv) {
                    clonedMessagesDiv.style.overflow = 'visible';
                    clonedMessagesDiv.style.overflowX = 'visible';
                    clonedMessagesDiv.style.overflowY = 'visible';
                    clonedMessagesDiv.style.width = `${captureWidth}px`;
                    clonedMessagesDiv.style.height = `${captureHeight}px`;
                    clonedMessagesDiv.style.maxWidth = 'none';
                    clonedMessagesDiv.style.maxHeight = 'none';
                  }
                  if (clonedDoc.body) {
                    clonedDoc.body.style.overflow = 'visible';
                  }
                  if (clonedDoc.documentElement) {
                    clonedDoc.documentElement.style.overflow = 'visible';
                  }
                } catch (e) {
                  // best-effort
                }

                const clonedMarks = clonedDoc.querySelectorAll('mark.PhrazeHighlight');

                //Break up multi line marks because html2canvas does not render them properly
                clonedMarks.forEach(originalMark => {
                  if (originalMark.childNodes.length == 0)
                    return;
                  var textNode = originalMark.childNodes[0];
                  var textContent = textNode.textContent;
                  var newRanges = [];
                  var range = document.createRange();
                  var rangeStart = 0;
                  for (let i = 0; i < textContent.length; ++i) {
                    range.setStart(textNode, 0);
                    range.setEnd(textNode, (i + 1));
                    var lineIndex = (range.getClientRects().length - 1);
                    if (newRanges.length == lineIndex) {
                      newRanges.push([rangeStart, i]);
                      rangeStart = i;
                    }
                  }
                  newRanges.splice(0, 1);

                  if (rangeStart < textContent.length) {
                    newRanges.push([rangeStart, textContent.length]);
                  }

                  var parent = originalMark.parentNode;
                  // Insert new marks before removing the original
                  newRanges.forEach(function (range) {
                    var mark = document.createElement('mark');
                    try {
                      // Preserve highlight metadata + user-selected color (e.g. --highlight-color)
                      if (originalMark.className) mark.className = originalMark.className;
                      Array.from(originalMark.attributes || []).forEach((attr) => {
                        if (attr && attr.name && attr.name !== 'id') {
                          mark.setAttribute(attr.name, attr.value);
                        }
                      });
                      if (originalMark.style && originalMark.style.cssText) {
                        mark.style.cssText = originalMark.style.cssText;
                      }
                    } catch (e) {
                      // best-effort
                    }
                    mark.textContent = textContent.slice(range[0], range[1]);
                    parent.insertBefore(mark, originalMark);
                  });
                  parent.removeChild(originalMark);
                });
              }
            }).then(async canvas => {
              setSidebarWidth(prevSidebarWidth);

              let eles = document.getElementsByClassName("PhrazeHighlight-data-preview");
              for (let i = eles.length - 1; i >= 0; --i) {
                let ele = eles[i];
                ele.style.opacity = 0;
                document.body.appendChild(ele);
              }
              // eles = document.getElementsByClassName("phraze-note-dropdown");
              // for (let ele of eles) {
              //   ele.style.display = "flex";
              // }

              messagesDiv.style.overflowY = "auto";

              const blob = await new Promise(resolve => canvas.toBlob(resolve));
              const url = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              document.getElementById("sidebar-iframe").contentWindow.postMessage({ action: "downloadFullPageScreenshot", dataUrl: url }, "*");
              // document.body.appendChild(canvas);
            });

          }, 1000);
        }, 1000);

        // function findDeepestScrollable(element) {
        //   let deepest = element;
        //   let maxDepth = -1;

        //   function dfs(node, depth) {
        //     if (node.nodeType !== 1) return; // Only element nodes
        //     const style = window.getComputedStyle(node);
        //     const isScrollable = (
        //       (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') &&
        //       node.scrollHeight > node.clientHeight + 2
        //     );
        //     if (isScrollable && depth > maxDepth) {
        //       deepest = node;
        //       maxDepth = depth;
        //     }
        //     for (let child of node.children) {
        //       dfs(child, depth + 1);
        //     }
        //   }

        //   dfs(document.body, 0);
        //   return deepest;
        // }

        // // Get page dimensions
        // function getPageInfo() {
        //   let deepestWindow = findDeepestScrollable(document.body);
        //   let totalHeight, viewportHeight;
        //   totalHeight = Math.max(
        //     deepestWindow.clientHeight,
        //     deepestWindow.scrollHeight,
        //     deepestWindow.offsetHeight
        //   );
        //   viewportHeight = window.innerHeight;

        //   return { totalHeight, viewportHeight };
        // }

        // function innerMostWindowScrollTo(y) {
        //   const deepestScrollable = findDeepestScrollable(document.body);
        //   if (deepestScrollable) {
        //     deepestScrollable.scrollTop = y;
        //   } else {
        //     window.scrollTo(0, y);
        //   }

        //   //Manually call mouse enter on each container to update the message bubble location
        //   var containers = document.getElementsByClassName("phraze-highlight-container");
        //   for (let container of containers) {
        //     const event = new MouseEvent("mouseenter", {
        //       bubbles: false, // must be false for mouseenter
        //       cancelable: true,
        //       view: window
        //     });
        //     container.dispatchEvent(event);
        //   }
        // }

        // // chrome.tabs.sendMessage(tab.id, { action: "showAllLabelsCodes" });
        // var eles = document.getElementsByClassName("PhrazeHighlight-data-preview");
        // for (let ele of eles) {
        //   if (ele.childNodes && ele.childNodes[0].textContent.trim() != "")
        //     ele.style.opacity = 1;
        // }

        // // let response = await chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" });
        // let response = getPageInfo();
        // if (!response)
        //   return;
        // const { totalHeight, viewportHeight } = response;
        // const screenshots = [];
        // for (let y = 0; y < totalHeight; y += viewportHeight) {
        //   // await chrome.tabs.sendMessage(tab.id, { action: "scrollTo", y });
        //   innerMostWindowScrollTo(y);
        //   await new Promise(r => setTimeout(r, 750)); // wait for scroll
        //   const dataUrl = await new Promise(resolve => {
        //     chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, resolve);
        //   });
        //   screenshots.push({ y, dataUrl });
        // }

        // chrome.tabs.sendMessage(tab.id, { action: "stitchScreenshots", screenshots: screenshots }, (response) => { });
      }
      else if (event.data.action == "resizeSidebarToFull") {
        if (sidebarWidth != 0)
          setPrevSidebarWidth(sidebarWidth);
        setSidebarWidth(window.viewport.segments[0].width - 50);
      }
      else if (event.data.action == "resizeSidebarToPrevious") {
        setSidebarWidth(prevSidebarWidth);
      }
      else if (event.data.action == "resizeSidebarToZero") {
        setPrevSidebarWidth(sidebarWidth);
        setSidebarWidth(0);
      }
    }

    window.addEventListener('message', handleExtensionMessages);
    window.addEventListener('clearChats', handleClearChats);

    return () => {
      window.removeEventListener('message', handleExtensionMessages);
      window.removeEventListener('clearChats', handleClearChats);
    };
  }, []); // Setup listener once

  useEffect(() => {
    let eles = document.getElementsByClassName("phraze-highlight-toolbar");
    for (let ele of eles) {
      ele.style.opacity = "0";
    }

  }, [sidebarWidth, isExtensionSidebarVisible]);

  // Toggle chat between public and private
  const handleToggleChatPrivacy = async () => {
    if (!currentChat || !currentChat.id) {
      showToast("No chat selected", "error");
      return;
    }

    try {
      // Use shared company email if viewing a shared project, otherwise use own company
      const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
      const companyEmailPath = sharedCompanyEmail || localStorage.getItem('companyEmail');
      if (!companyEmailPath) {
        showToast("Company email not found", "error");
        return;
      }

      // NOTE: Privacy toggle is now handled by ChatSidebar which manages 
      // moving chats between secure paths (privateChats vs groqChats)
      // This function should not be called directly - use the sidebar menu instead
      showToast("Please use the chat menu in the sidebar to change privacy", "info");
      console.warn("togglePin called directly - privacy should be managed via ChatSidebar");
    } catch (error) {
      console.error("Error toggling chat privacy:", error);
      showToast("Failed to update chat privacy", "error");
    }
  };

  // Handle chat selection from sidebar
  const handleChatSelect = (selectedChat) => {
    if (isInsideExtension) {
      setIsSidebarCollapsed(true);
    }
    // Make sure we update the current chat with the latest data
    setCurrentChat(selectedChat);
    // debug log removed
    setIsLibraryVisible(false);
    if (selectedChat) {
      setIsSharedView(selectedChat.originalId != null)
      setSharedCompanyEmail(selectedChat.companyEmail)

      // Send message to extension popup (parent window)
      window.parent.postMessage({ action: "activeChat", id: selectedChat.id, currentProject: currentProject }, "*");
      
      // Also send message directly to sidebar iframe to update messaging topic
      const sidebarIframe = document.getElementById('sidebar-iframe');
      if (sidebarIframe && sidebarIframe.contentWindow) {
        sidebarIframe.contentWindow.postMessage({
          action: "updateMessagingTopic",
          chatId: selectedChat.id,
          chatTitle: selectedChat.title || 'Untitled Chat'
        }, "*");
      }
      
      if (selectedChat.originalId) {
        async function fetchOriginalMessages() {
          if (selectedChat.companyEmail) {
            let path = `Companies/${selectedChat.companyEmail}/projects/${currentProject}/groqChats/${selectedChat.originalId}/messages`;
            var messages = await getFirebaseData(`Companies/${selectedChat.companyEmail}/projects/${currentProject}/groqChats/${selectedChat.originalId}/messages`);
            const chatMessages = Array.isArray(messages || [])
              ? messages
              : Object.values(messages);
            setMessages(chatMessages);
          }
        }
        fetchOriginalMessages();
      }
      else {
        // Convert messages object to array if needed
        if (selectedChat) {
          // Check if messages exist and handle null/undefined
          if (selectedChat.messages) {
        const chatMessages = Array.isArray(selectedChat.messages)
            ? selectedChat.messages
            : Object.values(selectedChat.messages);
          setMessages(chatMessages);
          } else {
            // Messages are stored separately in Firebase - fetch them directly
            // Don't clear messages yet to avoid flickering
            async function fetchMessages() {
              try {
                const isPrivate = selectedChat.isPublic === false;
                const userEmail = auth.currentUser?.email;
                const companyEmailPath = localStorage.getItem('companyEmail')?.replace(/\./g, ',') || 
                                        localStorage.getItem('sharedCompanyEmail');
                
                if (companyEmailPath) {
                  const chatBasePath = getChatBasePath(companyEmailPath, currentProject, selectedChat.id, isPrivate, userEmail);
                  const messages = await getFirebaseData(`${chatBasePath}/messages`);
                  if (messages) {
                    const chatMessages = Array.isArray(messages) ? messages : Object.values(messages);
                    setMessages(chatMessages);
                  } else {
            setMessages([]);
          }
                } else {
                  setMessages([]);
                }
              } catch (error) {
                console.error("Error fetching messages:", error);
                setMessages([]);
              }
            }
            fetchMessages();
          }
        }
      }
    } else {
      // New chat - clear messages
      setMessages([]);
    }
  };

  // Navigate to a specific annotation history entry (chat + highlight)
  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail || {};
      const targetChatId = detail.chatID;
      const targetHighlightId = detail.highlightID;

      if (!targetChatId && !targetHighlightId) return;

      // Find chat by id or originalId (shared)
      const candidates = ([]
        .concat(Array.isArray(allChats) ? allChats : [])
        .concat(Array.isArray(allSharedChats) ? allSharedChats : []));

      const foundChat = candidates.find((c) => {
        if (!c) return false;
        return c.id === targetChatId || c.originalId === targetChatId;
      });

      if (foundChat) {
        handleChatSelect(foundChat);
      }

      // Wait for the chat content/highlights to render before scrolling
      setTimeout(() => {
        if (!targetHighlightId) return;
        const mark = document.querySelector(`mark[data-highlight-id="${targetHighlightId}"]`);
        if (mark) {
          mark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          const originalShadow = mark.style.boxShadow;
          mark.style.boxShadow = '0 0 0 2px #3b82f6';
          setTimeout(() => {
            mark.style.boxShadow = originalShadow;
          }, 1500);
        }
      }, foundChat ? 700 : 200);
    };

    window.addEventListener('navigateToAnnotationHistoryEntry', handler);
    return () => window.removeEventListener('navigateToAnnotationHistoryEntry', handler);
  }, [allChats, allSharedChats]);

  // Fetch and listen to profile pictures for message senders (for private chats where they're not in projectMembers)
  useEffect(() => {
    if (!messages || messages.length === 0) {
      // Clean up listeners if no messages
      messageSenderProfileListenersRef.current.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (e) {
          console.warn('Error unsubscribing from message sender profile listener:', e);
        }
      });
      messageSenderProfileListenersRef.current.clear();
      setMessageSenderProfiles(new Map());
      return;
    }

    // Extract unique sender emails from messages
    const uniqueSenderEmails = new Set();
    messages.forEach(message => {
      if (message.role === 'user' && message.senderEmail) {
        uniqueSenderEmails.add(message.senderEmail);
      }
    });

    // Clean up listeners for senders no longer in messages
    messageSenderProfileListenersRef.current.forEach((unsubscribe, email) => {
      if (!uniqueSenderEmails.has(email)) {
        try {
          unsubscribe();
        } catch (e) {
          console.warn('Error unsubscribing from message sender profile listener:', e);
        }
        messageSenderProfileListenersRef.current.delete(email);
        
        // Remove from cache
        setMessageSenderProfiles(prev => {
          const newMap = new Map(prev);
          newMap.delete(email);
          return newMap;
        });
      }
    });

    // Fetch and set up listeners for each unique sender
    uniqueSenderEmails.forEach(async (senderEmail) => {
      // Skip if already listening
      if (messageSenderProfileListenersRef.current.has(senderEmail)) {
        return;
      }

      // Skip if already in projectMembers (they're handled there)
      const normalizeEmail = (email) => email?.toLowerCase().replace(/\./g, ',');
      const senderEmailNormalized = normalizeEmail(senderEmail);
      const isInProjectMembers = projectMembers.some(m => normalizeEmail(m.email) === senderEmailNormalized);
      
      if (isInProjectMembers) {
        return; // Profile pic is already available via projectMembers
      }

      try {
        // Get user's company email
        const senderEmailFormatted = senderEmail.replace(/\./g, ',');
        const userCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${senderEmailFormatted}`).catch(() => null);
        
        if (!userCompanyEmail) {
          return; // Can't fetch without company email
        }

        // Fetch initial profile picture and user data (firstName, lastName, name)
        const [profilePic, userData] = await Promise.all([
          getFirebaseData(`Companies/${userCompanyEmail}/users/${senderEmailFormatted}/profileImage`).catch(() => null),
          getFirebaseData(`Companies/${userCompanyEmail}/users/${senderEmailFormatted}`).catch(() => null)
        ]);

        // Store profile data (pic, firstName, lastName, name)
        setMessageSenderProfiles(prev => {
          const newMap = new Map(prev);
          const existingData = newMap.get(senderEmail) || {};
          newMap.set(senderEmail, {
            profilePic: profilePic || existingData.profilePic || null,
            firstName: userData?.firstName || existingData.firstName || null,
            lastName: userData?.lastName || existingData.lastName || null,
            name: userData?.name || existingData.name || null
          });
          return newMap;
        });

        // Set up real-time listener for profile picture updates
        const profilePicPath = `Companies/${userCompanyEmail}/users/${senderEmailFormatted}/profileImage`;
        const profilePicRef = ref(database, profilePicPath);
        
        // Also set up listener for user data updates (firstName, lastName, name)
        const userDataPath = `Companies/${userCompanyEmail}/users/${senderEmailFormatted}`;
        const userDataRef = ref(database, userDataPath);
        
        const unsubscribeUserData = onValue(userDataRef, async (snapshot) => {
          const userData = snapshot.val();
          if (userData) {
            setMessageSenderProfiles(prev => {
              const newMap = new Map(prev);
              const existingData = newMap.get(senderEmail) || {};
              newMap.set(senderEmail, {
                ...existingData,
                firstName: userData.firstName || existingData.firstName || null,
                lastName: userData.lastName || existingData.lastName || null,
                name: userData.name || existingData.name || null
              });
              return newMap;
            });
          }
        });
        
        const unsubscribe = onValue(profilePicRef, (snapshot) => {
          const newProfilePic = snapshot.val();
          setMessageSenderProfiles(prev => {
            const newMap = new Map(prev);
            const existingData = newMap.get(senderEmail) || {};
            if (newProfilePic) {
              newMap.set(senderEmail, {
                ...existingData,
                profilePic: newProfilePic
              });
            } else {
              newMap.set(senderEmail, {
                ...existingData,
                profilePic: null
              });
            }
            return newMap;
          });
        });
        
        // Store both unsubscribers
        const combinedUnsubscribe = () => {
          unsubscribe();
          unsubscribeUserData();
        };
        
        messageSenderProfileListenersRef.current.set(senderEmail, combinedUnsubscribe);

      } catch (error) {
        console.error(`Error fetching profile picture for ${senderEmail}:`, error);
      }
    });

    // Cleanup function
    return () => {
      messageSenderProfileListenersRef.current.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (e) {
          console.warn('Error unsubscribing from message sender profile listener:', e);
        }
      });
      messageSenderProfileListenersRef.current.clear();
    };
  }, [messages, projectMembers]);

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    setImageFile(file);

    // Create a preview URL
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Clear image preview
  const clearImagePreview = () => {
    setImagePreview(null);
    setImageFile(null);
  };

  const handleSubmit = async (e) => {
    console.log('handleSubmit', currentChat);
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if ((!inputValue.trim() && !imagePreview) || isLoading) return;
    
    // Stop typing indicator when sending message
    if (currentChat?.id) {
      stopTyping(currentChat.id);
    }

    // Detect leading @mention that matches an EXACT username currently in the chat.
    // Partial names should not count.
    // Also detect @everyone and mentions of project members.
    const trimmedStart = (inputValue || '').trimStart();
    let isMentionDirected = false;
    if (trimmedStart.startsWith('@')) {
      // Check for @everyone command first
      if (/^@everyone(?:\s|$)/.test(trimmedStart)) {
        isMentionDirected = true;
      } else {
        // Check for project member mentions (for public chats)
        if (currentChat?.isPublic && projectMembers && projectMembers.length > 0) {
          const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          for (const member of projectMembers) {
            if (member.name) {
              const re = new RegExp(`^@${escapeRegExp(member.name)}(?:\\s|$)`);
              if (re.test(trimmedStart)) {
                isMentionDirected = true;
                break;
              }
            }
          }
        }
        
        // If not a project member mention, check for username mentions from chat
        if (!isMentionDirected) {
          const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const usernameSet = new Set();
          // Add current user's name from userProfile or auth
          if (userProfile?.firstName && userProfile?.lastName) {
            usernameSet.add(`${userProfile.firstName} ${userProfile.lastName}`);
          } else if (userProfile?.username) {
            usernameSet.add(userProfile.username);
          } else if (auth.currentUser && auth.currentUser.displayName) {
            usernameSet.add(auth.currentUser.displayName);
          }
          for (const m of messages) {
            if (m.role === 'user' && m.userDisplayName) {
              usernameSet.add(m.userDisplayName);
            }
          }
          for (const name of usernameSet) {
            const re = new RegExp(`^@${escapeRegExp(name)}(?:\\s|$)`);
            if (re.test(trimmedStart)) {
              isMentionDirected = true;
              break;
            }
          }
        }
      }
    }



    let userMessageContent = inputValue;
    let messageType = 'text';
    let imageUrl = null;

    // If there's an image, upload it to Firebase Storage (simplified here)
    if (imageFile) {
      try {
        // In a real implementation, you would upload to Firebase here
        // For now, we'll just use the data URL as is
        imageUrl = imagePreview; // This would be a Firebase Storage URL in production
        messageType = 'image';

        // If there's also text, combine them
        if (inputValue.trim()) {
          messageType = 'image_text';
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        return;
      }
    }

    // Create user message object for display in the UI
    // Get display name from userProfile (firstName + lastName) or fallback to auth displayName or email
    const getUserDisplayName = () => {
      if (userProfile?.firstName && userProfile?.lastName) {
        return `${userProfile.firstName} ${userProfile.lastName}`;
      }
      if (userProfile?.username) {
        return userProfile.username;
      }
      if (auth.currentUser?.displayName) {
        return auth.currentUser.displayName;
      }
      if (auth.currentUser?.email) {
        return auth.currentUser.email.split('@')[0];
      }
      return 'User';
    };
    
    // Create quotedMessages array for Firebase storage (supporting multiple quotes with highlights)
    const quotedMessagesForFirebase = quotedMessages && quotedMessages.length > 0
      ? quotedMessages.map(qm => ({
          content: qm.content || '',
          role: qm.role || 'user',
          userDisplayName: qm.userDisplayName || qm.senderEmail?.split('@')[0] || 'User',
          timestamp: (qm.timestamp && typeof qm.timestamp === 'number') ? qm.timestamp : Date.now(),
          chatID: qm.chatID || null,
          highlights: qm.highlights || [],
          annotationsMap: qm.annotationsMap || {}
        }))
      : null;
    
    // For backward compatibility, also include single quotedMessage if only one quote
    const quotedMessageForFirebase = quotedMessages && quotedMessages.length === 1
      ? quotedMessagesForFirebase[0]
      : null;
    
    const userMessage = {
      role: 'user',
      messageId: (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : (`m_${Date.now()}_${Math.random().toString(16).slice(2)}`),
      content: userMessageContent,
      type: messageType,
      userDisplayName: getUserDisplayName(),
      senderEmail: auth.currentUser?.email, // Store sender email for profile picture lookup
      quotedMessage: quotedMessageForFirebase, // Single quote for backward compatibility
      quotedMessages: quotedMessagesForFirebase // Array of quotes for multi-select support
    };

    // Log for debugging - quotedMessages are saved to Firebase as part of userMessage
    if (quotedMessagesForFirebase) {
      console.log('[QuotedMessages] Saving', quotedMessagesForFirebase.length, 'quoted message(s) to Firebase:', quotedMessagesForFirebase);
    }

    // If there's an image, add the imageUrl to the message
    if (imageUrl) {
      userMessage.imageUrl = imageUrl;
    }

    // Add user message to state
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    clearImagePreview();
    setQuotedMessages([]); // Clear quoted messages after sending
    setExpandedQuotesPreview(false); // Reset expanded state
    setIsMultiSelectMode(false); // Reset multi-select mode after sending

    // If this is a leading @mention, don't call AI but still save to Firebase
    if (isMentionDirected) {
      // Save the mention message to Firebase without calling AI
      try {
        import('../funcs').then(async module => {
          try {
            const saveFirebaseData = module.saveFirebaseData;
            const getFirebaseData = module.getFirebaseData;
            const generateUniqueId = module.generateUniqueId || (() => Date.now().toString());

            // Get current user from Firebase Auth
            const currentUser = auth.currentUser;
            console.log('currentUser', currentUser);
            
            if (currentUser && currentUser.email) {
              // Use getProjectCompanyEmail which checks for shared projects first
              // This function already checks localStorage for sharedCompanyEmail
              let companyEmailPath = getProjectCompanyEmail();
              
              // Fallback to user's company if not found
              if (!companyEmailPath) {
              let email = currentUser.email.replace(/\./g, ',');
                companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${email}`);
              }
              
              // Ensure company email is formatted correctly (dots to commas)
              if (companyEmailPath) {
                companyEmailPath = companyEmailPath.replace(/\./g, ',');
              }

              console.log('Using company path for mention:', companyEmailPath);
              if (companyEmailPath) {
                let chatId = currentChat ? currentChat.id : null;
                
                // For shared chats, use the original ID to save to the original chat
                // Check if we have a sharedCompanyEmail which indicates we're in a shared project
                const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
                if (currentChat && (currentChat.isShared || currentChat.originalId)) {
                  chatId = currentChat.originalId || chatId;
                } else if (sharedCompanyEmail && currentChat) {
                  // If we're in a shared project and have a chat, use the chat ID as-is
                  chatId = currentChat.id;
                }
                
                console.log('currentChat', currentChat);
                console.log('sharedChat', chatId);
                console.log('isShared:', currentChat ? currentChat.isShared : false);
                console.log('sharedCompanyEmail from localStorage:', sharedCompanyEmail);
                console.log('Final companyEmailPath:', companyEmailPath);
                
                // If we don't have a current chat or it doesn't have an ID, create a new one
                if (!currentChat || !chatId) {
                  // Generate a new unique ID for the chat
                  const newChatId = generateUniqueId();

                  // Create a title from the first user message
                  const newTitle = userMessage.content.length > 30
                    ? `${userMessage.content.substring(0, 27)}...`
                    : userMessage.content || 'Mention Chat';

                  // Create a new chat in Firebase - respect chatMode for public/private
                  const shouldBePublic = chatMode !== 'private';
                  const newChat = {
                    id: newChatId,
                    title: newTitle,
                    timestamp: Date.now(),
                    messages: [userMessage],
                    isPublic: shouldBePublic, // Based on chatMode - private mode creates private chats
                    ownerId: auth.currentUser?.email, // Track who created the chat
                  };
                  
                  // Also set privateUser for backward compatibility
                  if (auth.currentUser && auth.currentUser.email) {
                    newChat.privateUser = auth.currentUser.email;
                  }

                  console.log('[Demonstration] Creating chat with chatMode:', chatMode, 'isPublic:', shouldBePublic);

                  // Save the new chat to Firebase - use secure path for private chats
                  const chatPath = getChatBasePath(companyEmailPath, currentProject, newChatId, !shouldBePublic, auth.currentUser?.email);
                  console.log('[Demonstration] Creating new chat at path:', chatPath);
                  await saveFirebaseData(chatPath, newChat);

                  // Update local state with the new chat
                  setCurrentChat(newChat);
                  // debug log removed

                  console.log("Created new chat for mention:", newChat);
                } else {
                  // If we already have a chat, update it with the new message
                  const updatedMessages = [...messages, userMessage];
                  // Use the correct path based on chat's public/private status
                  // For shared chats, they're always in groqChats (not private)
                  const isPrivate = currentChat && currentChat.isPublic === false && !currentChat.isShared;
                  const firebasePath = getChatBasePath(companyEmailPath, currentProject, chatId, isPrivate, auth.currentUser?.email) + '/messages';
                  console.log("Saving mention to Firebase path:", firebasePath);
                  console.log("Updated messages:", updatedMessages);
                  await saveFirebaseData(firebasePath, updatedMessages);

                  console.log("Updated existing chat with mention message");
                }
              } else {
                console.warn("Company email path not found for user:", email);
              }
            } else {
              console.warn("No authenticated user found or user email missing");
            }
          } catch (innerError) {
            console.error("Error updating Firebase data for mention:", innerError);
          }
        }).catch(importError => {
          console.error("Error importing funcs module for mention:", importError);
        });
      } catch (outerError) {
        console.error("Error in Firebase update block for mention:", outerError);
      }
      
      setIsLoading(false);
      setTimeout(() => { textareaRef.current?.focus(); }, 0);
      return;
    }

    setIsLoading(true);
    try {
      // Create messages array with proper format for Groq API
      let apiMessages = [];

      // Check if any message contains an image
      const hasImage = imageUrl || messages.some(msg => msg.imageUrl);

      // Only add system message if there are no images
      if (!hasImage) {
        apiMessages.push({
          role: "system",
          content: "You are a helpful assistant called Phraze. "
        });
      }

      // Format previous messages for the API
      for (const msg of messages) {
        if (msg.role === 'user') {
          if (msg.imageUrl) {
            // Message with image and text
            const contentArray = [];

            if (msg.content.trim()) {
              contentArray.push({
                type: "text",
                text: msg.content
              });
            }

            contentArray.push({
              type: "image_url",
              image_url: {
                url: msg.imageUrl
              }
            });

            apiMessages.push({
              role: "user",
              content: contentArray
            });
          } else {
            // Text-only user message
            apiMessages.push({
              role: "user",
              content: msg.content
            });
          }
        } else if (msg.role === 'assistant') {
          // Assistant message (always text)
          apiMessages.push({
            role: "assistant",
            content: msg.content
          });
        }
      }

      // Add the current user message
      if (imageUrl) {
        const contentArray = [];

        if (userMessageContent.trim()) {
          contentArray.push({
            type: "text",
            text: userMessageContent
          });
        }

        contentArray.push({
          type: "image_url",
          image_url: {
            url: imageUrl
          }
        });

        apiMessages.push({
          role: "user",
          content: contentArray
        });
      } else {
        apiMessages.push({
          role: "user",
          content: userMessageContent
        });
      }

      // Call Groq API with the new SDK format
      const chatCompletion = await groq.chat.completions.create({
        messages: apiMessages,
        model: selectedModel,
        temperature: 1,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
        stop: null
      });

      const assistantMessage = {
        role: 'assistant',
        messageId: (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : (`m_${Date.now()}_${Math.random().toString(16).slice(2)}`),
        content: chatCompletion.choices[0].message.content,
        userDisplayName: 'phraze'
      };

      // Add the assistant's response to the messages
      const updatedMessages = [...messages, userMessage, assistantMessage];
      setMessages(updatedMessages);

      console.log(currentChat);

      try {
        import('../funcs').then(async module => {
          try {
            const saveFirebaseData = module.saveFirebaseData;
            const getFirebaseData = module.getFirebaseData;
            const generateUniqueId = module.generateUniqueId || (() => Date.now().toString());

            // Get current user from Firebase Auth
            const currentUser = auth.currentUser;
            console.log('currentUser', currentUser);
            
            if (currentUser && currentUser.email) {
              // Use getProjectCompanyEmail which checks for shared projects first
              // This function already checks localStorage for sharedCompanyEmail
              let companyEmailPath = getProjectCompanyEmail();
              
              // Fallback to user's company if not found
              if (!companyEmailPath) {
              let email = currentUser.email.replace(/\./g, ',');
                companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${email}`);
              }
              
              // Ensure company email is formatted correctly (dots to commas)
              if (companyEmailPath) {
                companyEmailPath = companyEmailPath.replace(/\./g, ',');
              }

              console.log('Using company path for image chat:', companyEmailPath);
              if (companyEmailPath) {
                let chatId = currentChat ? currentChat.id : null;
                
                // For shared chats, use the original ID to save to the original chat
                // Check if we have a sharedCompanyEmail which indicates we're in a shared project
                const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
                if (currentChat && (currentChat.isShared || currentChat.originalId)) {
                  chatId = currentChat.originalId || chatId;
                } else if (sharedCompanyEmail && currentChat) {
                  // If we're in a shared project and have a chat, use the chat ID as-is
                  // The chat should already be in the shared company's groqChats
                  chatId = currentChat.id;
                }
                
                console.log('currentChat', currentChat);
                console.log('sharedChat', chatId);
                console.log('isShared:', currentChat ? currentChat.isShared : false);
                console.log('sharedCompanyEmail from localStorage:', sharedCompanyEmail);
                console.log('Final companyEmailPath:', companyEmailPath);
                
                // If we don't have a current chat or it doesn't have an ID, create a new one
                if (!currentChat || !chatId) {
                  // Generate a new unique ID for the chat
                  const newChatId = generateUniqueId();

                  // Create a title from the first user message
                  const newTitle = userMessage.content.length > 30
                    ? `${userMessage.content.substring(0, 27)}...`
                    : userMessage.content || 'Image Chat';

                  // Create a new chat in Firebase - respect chatMode for public/private
                  const shouldBePublic = chatMode !== 'private';
                  // Verify quotedMessage is included in messages being saved to Firebase
                  const messagesWithQuoted = updatedMessages.filter(m => m.quotedMessage);
                  if (messagesWithQuoted.length > 0) {
                    console.log(`[QuotedMessage] Creating new chat with ${messagesWithQuoted.length} message(s) containing quotedMessage - saved to Firebase`);
                  }
                  const newChat = {
                    id: newChatId,
                    title: newTitle,
                    timestamp: Date.now(),
                    messages: updatedMessages, // quotedMessage is included in each message object and saved to Firebase
                    isPublic: shouldBePublic, // Based on chatMode - private mode creates private chats
                    ownerId: auth.currentUser?.email, // Track who created the chat
                  };
                  
                  // Also set privateUser for backward compatibility
                  if (auth.currentUser && auth.currentUser.email) {
                    newChat.privateUser = auth.currentUser.email;
                  }

                  console.log('[Demonstration] Creating chat with chatMode:', chatMode, 'isPublic:', shouldBePublic);

                  // Save the new chat to Firebase - use secure path for private chats
                  const chatPath = getChatBasePath(companyEmailPath, currentProject, newChatId, !shouldBePublic, auth.currentUser?.email);
                  console.log('[Demonstration] Creating new chat at path:', chatPath);
                  await saveFirebaseData(chatPath, newChat);

                  // Update local state with the new chat
                  setCurrentChat(newChat);

                  console.log("Created new chat:", newChat);
                } else {
                  // If we already have a chat, update it as before
                  // Use the correct path based on chat's public/private status
                  // For shared chats, they're always in groqChats (not private)
                  const isPrivate = currentChat && currentChat.isPublic === false && !currentChat.isShared;
                  const chatBasePath = getChatBasePath(companyEmailPath, currentProject, chatId, isPrivate, auth.currentUser?.email);
                  const firebasePath = chatBasePath + '/messages';
                  console.log("Saving to Firebase path:", firebasePath);
                  console.log("Updated messages:", updatedMessages);
                  // Verify quotedMessage is included in messages being saved to Firebase
                  const messagesWithQuoted = updatedMessages.filter(m => m.quotedMessage);
                  if (messagesWithQuoted.length > 0) {
                    console.log(`[QuotedMessage] Saving ${messagesWithQuoted.length} message(s) with quotedMessage to Firebase at path: ${firebasePath}`);
                  }
                  await saveFirebaseData(firebasePath, updatedMessages);

                  console.log("Company email path", companyEmailPath);
                  // Update title if it's a new chat with default title
                  if (currentChat.title === 'New Chat') {
                    // Create a title from the first user message
                    const newTitle = userMessage.content.length > 30
                      ? `${userMessage.content.substring(0, 27)}...`
                      : userMessage.content || 'Image Chat';

                    await saveFirebaseData(chatBasePath + '/title', newTitle);

                    // Update local state
                    const updatedChat = {
                      ...currentChat,
                      title: newTitle
                    };
                    setCurrentChat(updatedChat);
                    // debug log removed
                    
                    // Send message to sidebar iframe to update messaging topic with new title
                    const sidebarIframe = document.getElementById('sidebar-iframe');
                    if (sidebarIframe && sidebarIframe.contentWindow) {
                      sidebarIframe.contentWindow.postMessage({
                        action: "updateMessagingTopic",
                        chatId: chatId,
                        chatTitle: newTitle
                      }, "*");
                    }
                  }
                }
              } else {
                console.warn("Company email path not found for user:", email);
              }
            } else {
              console.warn("No authenticated user found or user email missing");
            }
          } catch (innerError) {
            console.error("Error updating Firebase data:", innerError);
          }
        }).catch(importError => {
          console.error("Error importing funcs module:", importError);
        });
      } catch (outerError) {
        console.error("Error in Firebase update block:", outerError);
      }
    } catch (error) {
      console.error('Error calling Groq API:', error);
      // Add error message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request.',
        userDisplayName: 'Phraze'
      }]);
    } finally {
      setIsLoading(false);

      // Focus the textarea after response is received
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  // Handle message deletion
  const handleDeleteMessage = async (indexToDelete) => {
    if (!currentChat || !currentChat.id) return;

    try {
      // Create a new array without the deleted message
      const updatedMessages = messages.filter((_, index) => index !== indexToDelete);
      setMessages(updatedMessages);

      // Update Firebase
      import('../funcs').then(async module => {
        try {
          const saveFirebaseData = module.saveFirebaseData;
          const getFirebaseData = module.getFirebaseData;

          // Get current user from Firebase Auth
          const currentUser = auth.currentUser;
          if (currentUser && currentUser.email) {
            const email = currentUser.email.replace(/\./g, ',');
            const companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${email}`);

            if (companyEmailPath) {
              // Update the messages in Firebase - use correct path based on chat's public/private status
              const isPrivate = currentChat.isPublic === false;
              const chatBasePath = getChatBasePath(companyEmailPath, currentProject, currentChat.id, isPrivate, currentUser.email);
              await saveFirebaseData(chatBasePath + '/messages', updatedMessages);
              console.log("Message deleted successfully");
            }
          }
        } catch (error) {
          console.error("Error deleting message:", error);
        }
      });
    } catch (error) {
      console.error("Error in delete message function:", error);
    }
  };

  // Start editing a message
  const handleStartEditing = (index, content) => {
    var width = document.getElementById("message-content" + index).offsetWidth;
    if (width < 300) {
      width = 300;
    }
    setEditingMessageIndex(index);
    setEditingMessageContent(content);
    setTimeout(() => {
      if (editTextareaRef.current) {
        editTextareaRef.current.focus();
        editTextareaRef.current.style.height = 'inherit';
        editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
        editTextareaRef.current.style.width = width + "px";
      }
    }, 0);
  };

  // Cancel editing a message
  const handleCancelEditing = () => {
    setEditingMessageIndex(null);
    setEditingMessageContent('');
  };

  // Handle quoting a message (supports multi-select with Shift key)
  const handleQuoteMessage = async (message, index, event) => {
    const isShiftPressed = event?.shiftKey || false;
    const messageId = message.timestamp || message.originalIndex || index;
    
    // Fetch highlights and annotations for this message
    let highlights = [];
    let annotationsMap = {};
    
    try {
      // Get the chatID from the message or current chat
      const chatID = message.chatID || currentChat?.id || currentChatID;
      
      if (chatID) {
        // Get company email and project
        const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
        const companyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
        const projectName = localStorage.getItem('currentProject') || 'default';
        
        if (companyEmail) {
          const formattedEmail = companyEmail.replace(/\./g, ',');
          const highlightsPath = `Companies/${formattedEmail}/projects/${projectName}/highlights`;
          const annotationHistoryPath = `Companies/${formattedEmail}/projects/${projectName}/annotationHistory`;
          
          // Fetch highlights for this chat
          const allHighlights = await getFirebaseData(highlightsPath) || [];
          
          // Normalize chatID for flexible matching (handles "chat_" prefix)
          const normalizeChatId = (id) => {
            if (!id) return null;
            const str = String(id).trim();
            if (!str) return null;
            return str.startsWith('chat_') ? str.substring(5) : str;
          };
          
          const normalizedMessageChatId = normalizeChatId(chatID);
          const messageContent = message.content || '';
          
          // Filter highlights by chatID and verify text content matches
          highlights = allHighlights.filter(h => {
            if (!h || !h.chatID) return false;
            
            const normalizedHighlightChatId = normalizeChatId(h.chatID);
            
            // Check if chatID matches (with normalization)
            const chatIdMatches = 
              h.chatID === chatID ||
              normalizedHighlightChatId === normalizedMessageChatId ||
              h.chatID === normalizedMessageChatId ||
              chatID === normalizedHighlightChatId;
            
            if (!chatIdMatches) return false;
            
            // Verify that the highlight's text content matches the message content
            if (h.textNodes && h.textNodes.length > 0) {
              // Check if any textNode's wholeText appears in the message content
              const hasMatchingText = h.textNodes.some(textNode => {
                const wholeText = textNode?.wholeText || '';
                return wholeText && messageContent.includes(wholeText);
              });
              return hasMatchingText;
            }
            
            return true; // If no textNodes, include it (backward compatibility)
          });
          
          // Fetch annotations for these highlights
          if (highlights.length > 0) {
            const annotationHistory = await getFirebaseData(annotationHistoryPath) || [];
            const highlightIds = highlights.map(h => h.id);
            
            // Build annotations map
            for (const annotation of annotationHistory) {
              if (!Array.isArray(annotation)) continue;
              for (const property of annotation) {
                if (property && property.highlightID && highlightIds.includes(property.highlightID)) {
                  if (!annotationsMap[property.highlightID]) {
                    annotationsMap[property.highlightID] = [];
                  }
                  annotationsMap[property.highlightID].push(annotation);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching highlights/annotations for quoted message:', error);
    }
    
    setQuotedMessages(prev => {
      // Check if message is already quoted
      const isAlreadyQuoted = prev.some(qm => 
        (qm.timestamp || qm.originalIndex) === messageId
      );
      
      if (isAlreadyQuoted) {
        // Remove if already quoted (toggle behavior)
        return prev.filter(qm => 
          (qm.timestamp || qm.originalIndex) !== messageId
        );
      }
      
      // Create quoted message with highlights and annotations
      const quotedMessage = {
        ...message,
        originalIndex: index,
        messageId: messageId,
        chatID: message.chatID || currentChat?.id || currentChatID,
        highlights: highlights,
        annotationsMap: annotationsMap
      };
      
      // If Shift is pressed, add to selection
      if (isShiftPressed) {
        return [...prev, quotedMessage];
      } else {
        // Without Shift, replace all with this single quote
        return [quotedMessage];
      }
    });
    
    // Focus the input area
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  // Handle removing a specific quoted message
  const handleRemoveQuotedMessage = (messageId) => {
    if (messageId === undefined) {
      // Remove all if no specific ID provided (backward compatibility)
      setQuotedMessages([]);
      setIsMultiSelectMode(false); // Reset when all quotes removed
    } else {
      setQuotedMessages(prev => {
        const updated = prev.filter(qm => (qm.timestamp || qm.originalIndex || qm.messageId) !== messageId);
        // Reset multi-select mode if no quotes left
        if (updated.length === 0) {
          setIsMultiSelectMode(false);
        }
        return updated;
      });
    }
  };

  // Handle removing all quoted messages
  const handleRemoveAllQuotedMessages = () => {
    setQuotedMessages([]);
    setIsMultiSelectMode(false); // Reset when all quotes removed
  };

  // Copy message content to clipboard with visual feedback
  const handleCopyMessage = async (content, messageIndex) => {
    try {
      await navigator.clipboard.writeText(content);
      
      // Show checkmark feedback
      setCopiedMessages(prev => new Set(prev).add(messageIndex));
      
      // Revert back to copy icon after 2 seconds
      setTimeout(() => {
        setCopiedMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(messageIndex);
          return newSet;
        });
      }, 2000);
      
      console.log('Message copied to clipboard');
    } catch (error) {
      console.error('Failed to copy message:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      // Show checkmark feedback even for fallback
      setCopiedMessages(prev => new Set(prev).add(messageIndex));
      
      setTimeout(() => {
        setCopiedMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(messageIndex);
          return newSet;
        });
      }, 2000);
    }
  };



  // Handle branching chat at specific message
  const handleBranchChat = async (assistantMessageIndex) => {
    console.log("🔄 Branch chat clicked for message index:", assistantMessageIndex);
    
    if (isLoading) {
      console.log("❌ Cannot branch - loading in progress");
      return;
    }
    
    try {
      // Close dropdown
      setTryAgainDropdownOpen(null);
      
      // Get all messages up to and including the clicked message
      const branchedMessages = messages.slice(0, assistantMessageIndex + 1);
      console.log("📋 Messages to branch:", branchedMessages.length, "out of", messages.length);
      
      // Import the generateUniqueId function
      const { generateUniqueId, getFirebaseData, saveFirebaseData } = await import('../funcs');
      const { auth } = await import('../firebase-init');
      
      // Generate a unique ID for the new branched chat
      const branchedChatId = generateUniqueId();
      console.log("🆔 Generated branch chat ID:", branchedChatId);
      
      // Create a title based on the original chat title or first message
      const originalTitle = currentChat?.title || 'New Chat';
      const branchedTitle = `Branch - ${originalTitle}`;
      console.log("📝 Branch title:", branchedTitle);
      
      // Create the new branched chat object (private by default)
      const branchedChat = {
        id: branchedChatId,
        title: branchedTitle,
        timestamp: Date.now(),
        messages: branchedMessages,
        branchedFrom: {
          chatId: currentChat?.id,
          chatTitle: originalTitle,
          branchPoint: assistantMessageIndex,
          branchedAt: Date.now()
        }
      };
      
      // Set as private by default
      const user = auth.currentUser;
      if (user && user.email) {
        branchedChat.privateUser = user.email;
      }
      
      console.log("🌿 Created branch chat object:", branchedChat);
      
      // Save the branched chat to Firebase
      console.log("👤 Current user:", user?.email);
      
      if (user) {
        const userEmail = user.email.replace(/\./g, ',');
        const companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${userEmail}`);
        console.log("🏢 Company email path:", companyEmailPath);
        
        if (companyEmailPath) {
          // Branched chats inherit the privacy status of the source chat
          const isPrivate = currentChat && currentChat.isPublic === false;
          const firebasePath = getChatBasePath(companyEmailPath, currentProject, branchedChatId, isPrivate, user.email);
          console.log("💾 Saving to Firebase path:", firebasePath, isPrivate ? '(PRIVATE - secure path)' : '(PUBLIC)');
          
          await saveFirebaseData(firebasePath, branchedChat);
          console.log("✅ Successfully saved branched chat to Firebase");
          
          // Switch to the new branched chat
          setCurrentChat(branchedChat);
          // debug log removed
          setMessages(branchedMessages);
          
          console.log("🔄 Switched to branched chat:", branchedChat);
        } else {
          console.error("❌ Company email path not found");
        }
      } else {
        console.error("❌ User not authenticated");
      }
    } catch (error) {
      console.error("❌ Error creating branched chat:", error);
    }
  };

  // Handle Try Again dropdown actions
  const handleTryAgainAction = async (assistantMessageIndex, action, customPrompt = '') => {
    if (isLoading) return;
    
    setIsLoading(true);
    setTryAgainDropdownOpen(null); // Close dropdown
    
    try {
      // Find the user message that preceded this assistant message
      let userMessageIndex = -1;
      for (let i = assistantMessageIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          userMessageIndex = i;
          break;
        }
      }
      
      if (userMessageIndex === -1) {
        console.error('Could not find user message to regenerate response');
        setIsLoading(false);
        return;
      }
      
      // Remove the assistant message and any messages after it
      const updatedMessages = messages.slice(0, assistantMessageIndex);
      setMessages(updatedMessages);
      
      // Get the user message content
      const originalUserMessage = messages[userMessageIndex];
      let modifiedUserMessage = originalUserMessage.content;
      
      // Modify the user message based on the action
      switch (action) {
        case 'add_details':
          modifiedUserMessage = `${originalUserMessage.content}\n\nPlease provide more detailed information and elaborate on the key points.`;
          break;
        case 'more_concise':
          modifiedUserMessage = `${originalUserMessage.content}\n\nPlease provide a more concise and brief response.`;
          break;
        case 'try_again':
        default:
          // Keep original message for regular try again
          break;
      }
      
      // Create messages array for API call
      let apiMessages = [];
      
      // Check if any message contains an image
      const hasImage = updatedMessages.some(msg => msg.imageUrl);
      
      // Only add system message if there are no images
      if (!hasImage) {
        apiMessages.push({
          role: "system",
          content: "You are a helpful assistant called Phraze."
        });
      }
      
      // Format messages for the API, using modified user message for the last one
      for (let i = 0; i < updatedMessages.length; i++) {
        const msg = updatedMessages[i];
        
        if (msg.role === 'user') {
          const messageContent = (i === userMessageIndex) ? modifiedUserMessage : msg.content;
          
          if (msg.imageUrl) {
            // Message with image and text
            const contentArray = [];

            if (messageContent.trim()) {
              contentArray.push({
                type: "text",
                text: messageContent
              });
            }

            contentArray.push({
              type: "image_url",
              image_url: {
                url: msg.imageUrl
              }
            });

            apiMessages.push({
              role: "user",
              content: contentArray
            });
          } else {
            // Text-only user message
            apiMessages.push({
              role: "user",
              content: messageContent
            });
          }
        } else if (msg.role === 'assistant') {
          // Assistant message (always text)
          apiMessages.push({
            role: "assistant",
            content: msg.content
          });
        }
      }

      // Call Groq API with the new SDK format
      const chatCompletion = await groq.chat.completions.create({
        messages: apiMessages,
        model: selectedModel,
        temperature: 1,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
        stop: null
      });

      const assistantMessage = {
        role: 'assistant',
        content: chatCompletion.choices[0].message.content,
        userDisplayName: 'phraze'
      };

      // Add the assistant's response to the messages
      const newMessages = [...updatedMessages, assistantMessage];
      setMessages(newMessages);

      // Update Firebase if user is logged in
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.email && currentChat && currentChat.id) {
        import('../funcs').then(async module => {
          try {
            const saveFirebaseData = module.saveFirebaseData;
            const getFirebaseData = module.getFirebaseData;
            
            const email = currentUser.email.replace(/\./g, ',');
            const companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${email}`);
            
            if (companyEmailPath) {
              let chatId = currentChat.id;
              // For shared chats, use the original ID to save to the original chat
              if (currentChat.isShared) {
                chatId = currentChat.originalId;
              }
              // Use correct path based on chat's public/private status
              const isPrivate = currentChat.isPublic === false && !currentChat.isShared;
              const chatBasePath = getChatBasePath(companyEmailPath, currentProject, chatId, isPrivate, currentUser.email);
              await saveFirebaseData(chatBasePath + '/messages', newMessages);
              console.log("Updated Firebase with try again action response");
            }
          } catch (error) {
            console.error("Error updating Firebase data:", error);
          }
        });
      }

    } catch (error) {
      console.error('Error regenerating response:', error);
      // Add the original assistant message back if there was an error
      setMessages(prevMessages => [...prevMessages, messages[assistantMessageIndex]]);
    } finally {
      setIsLoading(false);
    }
  };

  // Try again - regenerate AI response for the last user message
  const handleTryAgain = async (assistantMessageIndex) => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Find the user message that preceded this assistant message
      let userMessageIndex = -1;
      for (let i = assistantMessageIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          userMessageIndex = i;
          break;
        }
      }
      
      if (userMessageIndex === -1) {
        console.error('Could not find user message to regenerate response');
        setIsLoading(false);
        return;
      }
      
      // Remove the assistant message and any messages after it
      const updatedMessages = messages.slice(0, assistantMessageIndex);
      setMessages(updatedMessages);
      
      // Get the user message content
      const userMessage = messages[userMessageIndex];
      
      // Create messages array for API call
      let apiMessages = [];
      
      // Check if any message contains an image
      const hasImage = updatedMessages.some(msg => msg.imageUrl);
      
      // Only add system message if there are no images
      if (!hasImage) {
        apiMessages.push({
          role: "system",
          content: "You are a helpful assistant called Phraze."
        });
      }
      
      // Format messages for the API
      for (const msg of updatedMessages) {
        if (msg.role === 'user') {
          if (msg.imageUrl) {
            const contentArray = [];
            if (msg.content.trim()) {
              contentArray.push({
                type: "text",
                text: msg.content
              });
            }
            contentArray.push({
              type: "image_url",
              image_url: {
                url: msg.imageUrl
              }
            });
            apiMessages.push({
              role: "user",
              content: contentArray
            });
          } else {
            apiMessages.push({
              role: "user",
              content: msg.content
            });
          }
        } else if (msg.role === 'assistant') {
          apiMessages.push({
            role: "assistant",
            content: msg.content
          });
        }
      }
      
      // Call Groq API
      const chatCompletion = await groq.chat.completions.create({
        messages: apiMessages,
        model: selectedModel,
        temperature: 1,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
        stop: null
      });
      
      const assistantMessage = {
        role: 'assistant',
        content: chatCompletion.choices[0].message.content,
        userDisplayName: 'phraze'
      };
      
      // Add the new assistant response
      const newMessages = [...updatedMessages, assistantMessage];
      setMessages(newMessages);
      
      // Update Firebase if user is logged in
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.email && currentChat && currentChat.id) {
        import('../funcs').then(async module => {
          try {
            const saveFirebaseData = module.saveFirebaseData;
            const getFirebaseData = module.getFirebaseData;
            
            const email = currentUser.email.replace(/\./g, ',');
            const companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${email}`);
            
            if (companyEmailPath) {
              // Use correct path based on chat's public/private status
              const isPrivate = currentChat.isPublic === false;
              const chatBasePath = getChatBasePath(companyEmailPath, currentProject, currentChat.id, isPrivate, currentUser.email);
              await saveFirebaseData(chatBasePath + '/messages', newMessages);
            }
          } catch (error) {
            console.error("Error updating Firebase data:", error);
          }
        });
      }
      
    } catch (error) {
      console.error('Error regenerating AI response:', error);
      // Restore the original messages on error
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  };

  // Save the edited message and regenerate AI response
  const handleSaveEdit = async (indexToEdit) => {
    if (editingMessageContent.trim() === '') return;

    setIsLoading(true);

    // Find the next assistant message after the edited user message
    const nextAssistantIndex = messages.findIndex((msg, idx) =>
      idx > indexToEdit && msg.role === 'assistant'
    );

    // Create a new array with messages up to the edited one
    let updatedMessages = [...messages];
    updatedMessages[indexToEdit] = { ...updatedMessages[indexToEdit], content: editingMessageContent };

    // If there's an assistant message afterward, remove it (and any following messages)
    if (nextAssistantIndex !== -1) {
      updatedMessages = updatedMessages.slice(0, nextAssistantIndex);
    }

    // Update messages state first
    setMessages(updatedMessages);

    try {
      // Create messages array with proper format for Groq API
      let apiMessages = [];

      // Check if any message contains an image
      const hasImage = updatedMessages.some(msg => msg.imageUrl);

      // Only add system message if there are no images
      if (!hasImage) {
        apiMessages.push({
          role: "system",
          content: "You are a helpful assistant called Phraze."
        });
      }

      // Format messages for the API
      for (const msg of updatedMessages) {
        if (msg.role === 'user') {
          if (msg.imageUrl) {
            // Message with image and text
            const contentArray = [];

            if (msg.content.trim()) {
              contentArray.push({
                type: "text",
                text: msg.content
              });
            }

            contentArray.push({
              type: "image_url",
              image_url: {
                url: msg.imageUrl
              }
            });

            apiMessages.push({
              role: "user",
              content: contentArray
            });
          } else {
            // Text-only user message
            apiMessages.push({
              role: "user",
              content: msg.content
            });
          }
        } else if (msg.role === 'assistant') {
          // Assistant message (always text)
          apiMessages.push({
            role: "assistant",
            content: msg.content
          });
        }
      }

      // Call Groq API with the new SDK format
      const chatCompletion = await groq.chat.completions.create({
        messages: apiMessages,
        model: selectedModel,
        temperature: 1,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
        stop: null
      });

      const assistantMessage = {
        role: 'assistant',
        content: chatCompletion.choices[0].message.content,
        userDisplayName: 'phraze'
      };

      // Add the assistant's response to the messages
      const newMessages = [...updatedMessages, assistantMessage];
      setMessages(newMessages);

      // Update Firebase
      import('../funcs').then(async module => {
        try {
          const saveFirebaseData = module.saveFirebaseData;
          const getFirebaseData = module.getFirebaseData;

          const currentUser = auth.currentUser;
          if (currentUser && currentUser.email && currentChat && currentChat.id) {
            const email = currentUser.email.replace(/\./g, ',');
            const companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${email}`);

            if (companyEmailPath) {
              // Use correct path based on chat's public/private status
              const isPrivate = currentChat.isPublic === false;
              const chatBasePath = getChatBasePath(companyEmailPath, currentProject, currentChat.id, isPrivate, currentUser.email);
              await saveFirebaseData(chatBasePath + '/messages', newMessages);
            }
          }
        } catch (error) {
          console.error("Error updating Firebase data:", error);
        }
      });

    } catch (error) {
      console.error('Error calling Groq API:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request.',
        userDisplayName: 'Phraze'
      }]);
    } finally {
      setIsLoading(false);
      setEditingMessageIndex(null);
      setEditingMessageContent('');
    }
  };

  // Auto-resize edit textarea
  useEffect(() => {
    const textarea = editTextareaRef.current;
    if (textarea) {
      textarea.style.height = 'inherit';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [editingMessageContent]);

  // Function to load shared chat data directly
  const loadSharedChat = async (sharedId, companyEmail) => {
    console.log("🚀 Starting loadSharedChat:", { sharedId, companyEmail });
    setIsLoading(true); // Start loading
    try {
      const { getFirebaseData } = await import('../funcs');
      const sharedChatPath = `sharedChats/${sharedId}`;
      console.log("🔍 Fetching shared chat from:", sharedChatPath);
      const sharedChatData = await getFirebaseData(sharedChatPath);

      console.log("🔍 Firebase response:", sharedChatData);

      if (sharedChatData && companyEmail) {
        // Convert messages object to array if needed
        const chatMessages = Array.isArray(sharedChatData.messages)
          ? sharedChatData.messages
          : Object.values(sharedChatData.messages || {});

        console.log("🔍 Processed messages:", chatMessages);

        // Set current chat state
        setCurrentChat({
          id: sharedId,
          title: sharedChatData.title,
          companyEmail: companyEmail,
          timestamp: sharedChatData.timestamp,
          originalId: sharedChatData.originalId,
          isShared: true
        });
        // debug log removed
        setMessages(chatMessages);
        console.log("✅ Successfully loaded shared chat data:", sharedChatData);
        setOriginalSanitizedUrl(sharedChatData.originalSanitizedUrl || null); // Set original URL state
        console.log("🔍 Original sanitized URL:", sharedChatData.originalSanitizedUrl);

      } else {
        if (!sharedChatData) console.error("❌ Shared chat not found for ID:", sharedId);
        if (!companyEmail) console.error("❌ Shared company email not available when loading chat.");
        showToast("Shared chat or company info not found.", "error");
        setCurrentChat(null);
        // debug log removed
        setMessages([]);
        // setChatHighlights([]);
        // setAnnotationHistoryData(null);
      }
    } catch (error) {
      console.error("❌ Error loading shared chat:", error);
      showToast("Error loading shared chat.", "error");
      setCurrentChat(null);
      // debug log removed
      setMessages([]);
      // setChatHighlights([]);
      // setAnnotationHistoryData(null);
    } finally {
      setIsLoading(false); // Stop loading regardless of outcome
      console.log("🏁 loadSharedChat completed");
    }
  };

  //Listen for selection changes to show highlight icon
  useEffect(() => {
    let isCreatingToolbar = false;
    
    function removeAllHighlightButtons() {
      // Do not remove if user is interacting with the toolbar (prevents flicker on click)
      if (window.phrazeToolbarInteracting) return;
      var buttons = document.querySelectorAll(".HighlightPopup");
      for (let button of buttons) {
        button.remove();
      }
      // Reset creation flag
      isCreatingToolbar = false;
    }

    const handleSelectionChange = () => {
      // Don't show highlight toolbar for viewers
      if (currentUserRole === 'viewer') {
        removeAllHighlightButtons();
        return;
      }
      
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        // Check if selection is within the search modal preview - if so, ignore it
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (range) {
          const container = range.commonAncestorContainer;
          const previewContainer = document.getElementById('searchPreviewMessages');
          if (previewContainer && (previewContainer.contains(container) || previewContainer === container)) {
            // Selection is in search preview - clear it and don't show highlight toolbar
            selection.removeAllRanges();
            removeAllHighlightButtons();
            return;
          }
          
          // Check if selection is within the main chat area
          const chatMessagesDiv = document.getElementById('chatMessagesDiv');
          if (chatMessagesDiv) {
            // For large block selections, check both start and end containers
            // This handles cases where selection spans multiple elements
            let startElement = range.startContainer;
            while (startElement && startElement.nodeType !== 1) {
              startElement = startElement.parentElement;
            }
            
            let endElement = range.endContainer;
            while (endElement && endElement.nodeType !== 1) {
              endElement = endElement.parentElement;
            }
            
            // Get the actual element from commonAncestorContainer
            let element = container;
            while (element && element.nodeType !== 1) {
              element = element.parentElement;
            }
            
            // If element is null, try startContainer as fallback
            if (!element && startElement) {
              element = startElement;
            }
            
            // Check if ANY of the containers (start, end, or common ancestor) is within chat area
            // This is important for large block selections that span multiple elements
            const isStartInChat = startElement && chatMessagesDiv.contains(startElement);
            const isEndInChat = endElement && chatMessagesDiv.contains(endElement);
            const isElementInChat = element && chatMessagesDiv.contains(element);
            
            // If none of the containers are in the chat area, don't show toolbar
            if (!isStartInChat && !isEndInChat && !isElementInChat) {
              // Selection is outside chat area - don't show toolbar
              removeAllHighlightButtons();
              return;
            }
            // If at least one container is in chat area, allow toolbar to show
          }
          // If chatMessagesDiv doesn't exist, allow toolbar to show (fallback)
        }
        
        // Prevent multiple simultaneous toolbar creations
        if (isCreatingToolbar) {
          return;
        }
        
        // Clear any existing toolbars first
        removeAllHighlightButtons();
        
        // Create toolbar immediately (no debounce for instant appearance)
        isCreatingToolbar = true;
        
        // Use requestAnimationFrame for smooth instant creation
        requestAnimationFrame(() => {
          // Double-check selection still exists (might have been cleared)
          const currentSelection = window.getSelection();
          if (!currentSelection || currentSelection.toString().length === 0) {
            isCreatingToolbar = false;
            return;
          }
          
          // Preserve the user's selection so toolbar interactions don't collapse it
          try {
            if (currentSelection.rangeCount > 0) {
              window.phrazeSavedSelectionRange = currentSelection.getRangeAt(0).cloneRange();
            }
          } catch (_) {}
          
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

          // Mark we are interacting when pointer is inside the toolbar
          toolbar.addEventListener('mouseenter', () => { window.phrazeToolbarInteracting = true; });
          toolbar.addEventListener('mouseleave', () => { window.phrazeToolbarInteracting = false; });
          toolbar.addEventListener('mousedown', (e) => { window.phrazeToolbarInteracting = true; e.preventDefault(); });
          toolbar.addEventListener('mouseup', () => { setTimeout(() => { window.phrazeToolbarInteracting = false; }, 100); });

          // Color swatch (toggles palette)
          const swatch = document.createElement('div');
          swatch.style.width = '18px';
          swatch.style.height = '18px';
          swatch.style.borderRadius = '50%';
          swatch.style.border = '1px solid #d1d5db';
          swatch.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
          const lastHex = localStorage.getItem('phrazeLastHighlightColorHex') || '#FFF176';
          swatch.style.background = lastHex;
          swatch.title = 'Choose highlight color';

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
            // Prevent selection collapse while clicking palette
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
              // Restore the selection so user doesn't have to re-select text
              try {
                const sel = window.getSelection();
                if (window.phrazeSavedSelectionRange && sel) {
                  sel.removeAllRanges();
                  sel.addRange(window.phrazeSavedSelectionRange);
                }
              } catch (_) {}
            });
            grid.appendChild(btn);
          });
          palette.appendChild(grid);

          function togglePalette() {
            palette.style.display = palette.style.display === 'none' ? 'block' : 'none';
          }
          swatch.addEventListener('mousedown', (e) => { e.preventDefault(); });
          swatch.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePalette();
            // Restore the selection so user doesn't have to re-select text
            try {
              const sel = window.getSelection();
              if (window.phrazeSavedSelectionRange && sel) {
                sel.removeAllRanges();
                sel.addRange(window.phrazeSavedSelectionRange);
              }
            } catch (_) {}
          });
          document.addEventListener('click', (e) => {
            if (!toolbar.contains(e.target)) {
              palette.style.display = 'none';
            }
          });

          // Pen button (create highlight with current color)
          const penBtn = document.createElement('button');
          penBtn.style.width = '30px';
          penBtn.style.height = '30px';
          penBtn.style.borderRadius = '9999px';
          penBtn.style.border = '0px';
          penBtn.style.background = '#f3f4f6';
          penBtn.style.cursor = 'pointer';
          penBtn.innerHTML = `<i class="fas fa-pen"></i>`;
          penBtn.addEventListener('click', async (e) => {
            // Restore the saved selection before saving the highlight
            try {
              const sel = window.getSelection();
              if (window.phrazeSavedSelectionRange && sel) {
                sel.removeAllRanges();
                sel.addRange(window.phrazeSavedSelectionRange);
              }
            } catch (_) {}
            const globalID = Date.now();
            localStorage.setItem('globalHighlightID', globalID);
            localStorage.setItem('currentUrl', window.location.href);
            localStorage.setItem('selectedText', window.getSelection().toString());
            document.getElementById('sidebar-iframe').contentWindow.postMessage({ action: 'updateSelectedText', text: window.getSelection().toString() }, '*');
            await saveHighlight(currentChatID || currentChat?.id);
            removeAllHighlightButtons();
          });

          toolbar.appendChild(swatch);
          toolbar.appendChild(penBtn);
          toolbar.appendChild(palette);

          // Get selection range for positioning - handle both forward and backward selections
          try {
            const range = currentSelection.getRangeAt(0);
            let rect = range.getBoundingClientRect();
            
            // For large block selections, getBoundingClientRect might return invalid dimensions
            // Fallback: use startContainer's position if rect is invalid
            if (!rect || rect.width === 0 || rect.height === 0) {
              const startElement = range.startContainer.nodeType === 1 
                ? range.startContainer 
                : range.startContainer.parentElement;
              if (startElement) {
                rect = startElement.getBoundingClientRect();
              }
            }
            
            // If rect is still invalid, try to get from a visible text node
            if (!rect || rect.width === 0 || rect.height === 0) {
              // Find first visible text node in selection
              const walker = document.createTreeWalker(
                range.commonAncestorContainer,
                NodeFilter.SHOW_TEXT,
                {
                  acceptNode: (node) => {
                    const nodeRange = document.createRange();
                    nodeRange.selectNodeContents(node);
                    return range.intersectsNode(node) 
                      ? NodeFilter.FILTER_ACCEPT 
                      : NodeFilter.FILTER_REJECT;
                  }
                }
              );
              const firstTextNode = walker.nextNode();
              if (firstTextNode && firstTextNode.parentElement) {
                rect = firstTextNode.parentElement.getBoundingClientRect();
              }
            }
            
            // Final fallback: use center of viewport if rect is still invalid
            if (!rect || rect.width === 0 || rect.height === 0) {
              rect = {
                left: window.innerWidth / 2,
                top: window.innerHeight / 2,
                width: 0,
                height: 0
              };
            }
            
            const toolbarWidth = 120; // width for color swatch and pen button
            
            // Calculate center position - works for both directions
            const centerX = rect.left + (rect.width / 2);
            const leftPos = centerX - (toolbarWidth / 2);
            
            // Ensure toolbar stays within viewport
            const viewportWidth = window.innerWidth;
            const finalLeft = Math.max(10, Math.min(leftPos, viewportWidth - toolbarWidth - 10));
            
            toolbar.style.left = `${finalLeft}px`;
            toolbar.style.top = `${rect.top + window.scrollY - 40}px`;
            
            // Ensure toolbar doesn't go above viewport
            if (rect.top < 50) {
              toolbar.style.top = `${rect.bottom + window.scrollY + 10}px`;
            }
            
            document.body.appendChild(toolbar);
            isCreatingToolbar = false;
          } catch (err) {
            // If positioning fails, try to show toolbar at a default position
            console.warn('Toolbar positioning error:', err);
            try {
              toolbar.style.left = `${window.innerWidth / 2 - 75}px`;
              toolbar.style.top = `${window.scrollY + 100}px`;
              document.body.appendChild(toolbar);
              isCreatingToolbar = false;
            } catch (fallbackErr) {
              // If even fallback fails, remove toolbar
              toolbar.remove();
              isCreatingToolbar = false;
            }
          }
        });
      }
      else {
        // console.log('No selection');
        if (!window.phrazeToolbarInteracting) {
          removeAllHighlightButtons();
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    // Also listen for mouseup to handle selection completion (especially for double-click and large blocks)
    const handleMouseUp = () => {
      // Don't show highlight toolbar for viewers
      if (currentUserRole === 'viewer') {
        removeAllHighlightButtons();
        return;
      }
      
      // Small delay to let selectionchange fire first, then check if toolbar should appear
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.toString().length === 0) {
          if (!window.phrazeToolbarInteracting) {
            removeAllHighlightButtons();
          }
        } else {
          // If there's a selection but no toolbar, trigger toolbar creation
          // This handles cases where selectionchange didn't fire (like double-click or large blocks)
          const existingToolbar = document.querySelector('.HighlightPopup');
          if (!existingToolbar && !isCreatingToolbar) {
            // Re-check selection is valid and in chat area (using same improved logic)
            const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            if (range) {
              const container = range.commonAncestorContainer;
              const previewContainer = document.getElementById('searchPreviewMessages');
              if (previewContainer && (previewContainer.contains(container) || previewContainer === container)) {
                return; // Don't show in search preview
              }
              
              const chatMessagesDiv = document.getElementById('chatMessagesDiv');
              if (chatMessagesDiv) {
                // Use same improved logic for large block selections
                let startElement = range.startContainer;
                while (startElement && startElement.nodeType !== 1) {
                  startElement = startElement.parentElement;
                }
                
                let endElement = range.endContainer;
                while (endElement && endElement.nodeType !== 1) {
                  endElement = endElement.parentElement;
                }
                
                let element = container;
                while (element && element.nodeType !== 1) {
                  element = element.parentElement;
                }
                
                const isStartInChat = startElement && chatMessagesDiv.contains(startElement);
                const isEndInChat = endElement && chatMessagesDiv.contains(endElement);
                const isElementInChat = element && chatMessagesDiv.contains(element);
                
                if (isStartInChat || isEndInChat || isElementInChat) {
                  // Valid selection in chat area - trigger toolbar creation
                  handleSelectionChange();
                }
              } else {
                // If chatMessagesDiv doesn't exist, still try to show toolbar
                handleSelectionChange();
              }
            }
          }
        }
      }, 50); // Slightly longer delay to ensure selection is stable after double-click or large block selection
    };
    document.addEventListener('mouseup', handleMouseUp);
    
    // Also listen for dblclick to ensure double-click selections are handled
    const handleDoubleClick = () => {
      // Don't show highlight toolbar for viewers
      if (currentUserRole === 'viewer') {
        removeAllHighlightButtons();
        return;
      }
      
      // Double-click creates selection, wait a bit then check
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          const existingToolbar = document.querySelector('.HighlightPopup');
          if (!existingToolbar && !isCreatingToolbar) {
            handleSelectionChange();
          }
        }
      }, 100);
    };
    document.addEventListener('dblclick', handleDoubleClick);

    // Cleanup
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('dblclick', handleDoubleClick);
      removeAllHighlightButtons();
    };
  }, [currentUserRole]);

  // Effect 4: Listen for real-time highlight updates from Firebase
  useEffect(() => {
    let unsubscribeFunctions = []; // Array to store all unsubscribe functions
    let highlightReloadTimeout = null; // Debounce timeout for highlight reloads
    let isReloadingHighlights = false; // Flag to prevent concurrent reloads

    const setupListener = async () => {
      if (((isSharedView || overrideShowHighlights) && sharedCompanyEmail) || isLoggedIn) {
        try {
          // Dynamically import Firebase database functions
          const firebaseDb = await import('firebase/database');
          const { ref, onValue } = firebaseDb;
          const { database } = await import('../firebase-init'); // Get database instance
          
          // Check for shared project first (from localStorage or state)
          let companyEmail = localStorage.getItem('sharedCompanyEmail') || sharedCompanyEmail;
          if (!companyEmail) {
            companyEmail = localStorage.getItem("companyEmail");
          }
          
          // For shared chats, ensure we're listening to the correct company
          if (currentChat && currentChat.isShared && currentChat.companyEmail) {
            companyEmail = currentChat.companyEmail;
            console.log("[Listener] Using shared company email for listener:", companyEmail);
          }
          
          console.log("[Listener] Using company email:", companyEmail, "sharedCompanyEmail from localStorage:", localStorage.getItem('sharedCompanyEmail'));
          
          // Ensure companyEmail has all periods replaced with commas for Firebase paths
          if (companyEmail) {
            companyEmail = companyEmail.replace(/\./g, ',');
          }

          // Read currentProject from localStorage to avoid stale closure issues
          // This ensures we always use the most up-to-date project, especially after refresh
          const activeProject = localStorage.getItem('currentProject') || currentProject || 'default';
          
          // Listen ONLY to highlight-related nodes (avoid triggering on chat message changes)
          const highlightsPath = `Companies/${companyEmail}/projects/${activeProject}/highlights`;
          const annotationHistoryPath = `Companies/${companyEmail}/projects/${activeProject}/annotationHistory`;
          const customLabelsPath = `Companies/${companyEmail}/projects/${activeProject}/customLabelsAndCodes`;
          const defaultColorPath = `Companies/${companyEmail}/projects/${activeProject}/defaultHighlightColor`;

          // Removed console.log for performance
          const listenerRef1 = ref(database, highlightsPath);
          const listenerRefAH = ref(database, annotationHistoryPath);
          const listenerRefCL = ref(database, customLabelsPath);
          const listenerRefDC = ref(database, defaultColorPath);

          // Debounce and deduplicate highlight reloads to prevent excessive calls
          const handleHighlightsChange = () => {
            // Clear any pending reload
            if (highlightReloadTimeout) {
              clearTimeout(highlightReloadTimeout);
            }
            
            // Debounce: wait 100ms before reloading (allows multiple rapid updates to batch)
            highlightReloadTimeout = setTimeout(async () => {
              // Prevent concurrent reloads
              if (isReloadingHighlights) {
                return;
              }
              
              isReloadingHighlights = true;
              try {
                // console.log("[Listener] Highlights-related data changed - reloading highlights");
                await loadHighlights();
              } finally {
                isReloadingHighlights = false;
              }
            }, 100);
          };

          // Store unsubscribe functions
          unsubscribeFunctions.push(onValue(listenerRef1, handleHighlightsChange));
          unsubscribeFunctions.push(onValue(listenerRefAH, handleHighlightsChange));
          unsubscribeFunctions.push(onValue(listenerRefCL, handleHighlightsChange));
          unsubscribeFunctions.push(onValue(listenerRefDC, handleHighlightsChange));

          // Set up message listener based on current chat's path (public vs private)
          // Private chats are stored in a separate secure path
          const isPrivateChat = currentChat && currentChat.isPublic === false;
          const userEmailFormatted = auth.currentUser?.email?.replace(/\./g, ',');
          
          // Determine the correct path and whether we're listening to a specific chat
          let messagePath;
          let isSpecificChatPath = false;
          
          if (isPrivateChat && userEmailFormatted && !currentChat?.isShared) {
            // Private chat - listen to secure path (specific chat)
            messagePath = `Companies/${companyEmail}/projects/${activeProject}/privateChats/${userEmailFormatted}/${currentChat.id}`;
            isSpecificChatPath = true;
          } else if (currentChat) {
            // Public or shared chat - listen to specific chat in groqChats path
            const targetChatId = currentChat.isShared && currentChat.originalId ? currentChat.originalId : currentChat.id;
            messagePath = `Companies/${companyEmail}/projects/${activeProject}/groqChats/${targetChatId}`;
            isSpecificChatPath = true;
          } else {
            // No current chat - listen to full groqChats collection for any updates
            messagePath = `Companies/${companyEmail}/projects/${activeProject}/groqChats`;
            isSpecificChatPath = false;
          }
          
          const listenerRef2 = ref(database, messagePath);

          // Define the callback for onValue for messages
          const handleValueChange2 = (snapshot) => {
            if (!currentChat) {
              return; // Don't clear messages when currentChat is null - might be a stale callback
            }
            
            const snapshotVal = snapshot.val();
            
            if (!snapshotVal) {
              // No data at this path - but don't clear if we already have messages locally
              // This prevents race conditions where save happens but read is stale
              return;
            }
            
            let chatData;
            
            if (isSpecificChatPath) {
              // We're listening to a specific chat path - snapshotVal IS the chat data directly
              chatData = snapshotVal;
            } else {
              // We're listening to the full groqChats collection - extract the specific chat
              const targetChatId = currentChat.isShared && currentChat.originalId ? currentChat.originalId : currentChat.id;
              chatData = snapshotVal[targetChatId];
            }
            
            if (chatData && chatData.messages) {
                  const chatMessages = Array.isArray(chatData.messages)
                    ? chatData.messages
                    : Object.values(chatData.messages);
              // Only update messages if Firebase has equal or more messages than local
              // This prevents overwriting local state with stale Firebase data
              setMessages(prevMessages => {
                if (chatMessages.length >= prevMessages.length) {
                  return chatMessages;
                }
                return prevMessages;
              });
              
                  setTimeout(() => {
                    loadHighlights();
                  }, 50);
            }
            // If chatData exists but no messages, keep current local messages
            // Don't reset to empty - that causes the "How can I help?" screen to flash
          };

          // Attach the listener and store unsubscribe function
          unsubscribeFunctions.push(onValue(listenerRef2, handleValueChange2));

        } catch (error) {
          console.error("[Listener] Error setting up Firebase listener:", error);
        }
      }
    };

    setupListener();
    
    // Cleanup function: unsubscribe all listeners and clear timeouts
    return () => {
      // Clear any pending highlight reload
      if (highlightReloadTimeout) {
        clearTimeout(highlightReloadTimeout);
        highlightReloadTimeout = null;
      }
      
      unsubscribeFunctions.forEach(unsubscribe => {
        try {
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
        } catch (err) {
          console.warn('[Listener] Error unsubscribing listener:', err);
        }
      });
      unsubscribeFunctions = [];
    };
    async function updateEmail(){
      if(currentChat) {
    if (currentChat.isShared) {
   //   localStorage.setItem('companyEmail', sharedCompanyEmail);
          //   console.log('companyEmail', sharedCompanyEmail);
        } else {
     // localStorage.setItem('companyEmail', await getMainCompanyEmail());
      console.log('companyEmail', localStorage.getItem('companyEmail'));
    }
  }
  }
    updateEmail();
    
    // Cleanup function: Remove listener when dependencies change or component unmounts
    // (Cleanup is handled in the return statement above)
  }, [isSharedView, currentChat, sharedCompanyEmail, originalSanitizedUrl, isInsideExtension, currentProject, isLoggedIn]); // Dependencies

  // Handle project dropdown toggle
  const handleProjectDropdownToggle = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setProjectDropdownOpen(prev => !prev);
  };

  // Reset dropdown when chat changes
  useEffect(() => {
    setProjectDropdownOpen(false);
  }, [currentChat?.id]);
  
  // Set up typing indicator listener for current conversation
  useEffect(() => {
    // Clean up previous listener
    if (typingListenerRef.current) {
      typingListenerRef.current();
      typingListenerRef.current = null;
    }
    
    // Only listen if we have a conversation ID
    if (!currentChat?.id) {
      setTypingUsers([]);
      return;
    }
    
    // Set up typing listener
    const cleanup = listenToTyping(currentChat.id, (users) => {
      // Filter out current user from typing list (compare by uid)
      const currentUserId = auth.currentUser?.uid;
      const otherTypingUsers = users.filter(user => user.userId !== currentUserId);
      setTypingUsers(otherTypingUsers);
    });
    
    typingListenerRef.current = cleanup;
    
    return () => {
      if (typingListenerRef.current) {
        typingListenerRef.current();
        typingListenerRef.current = null;
      }
      setTypingUsers([]);
    };
  }, [currentChat?.id, projectMembers]);

  // Handle manage members (opens admin panel modal)
  const handleManageMembers = () => {
    setProjectDropdownOpen(false);
    setShowAdminPanel(true);
  };

  // Handle rename chat
  const handleRenameChat = async () => {
    if (!currentChat) {
      showToast("No chat selected", "info");
      return;
    }

    const newTitle = window.prompt("Enter new chat name:", currentChat.title || "Untitled Chat");
    if (!newTitle || newTitle.trim() === "" || newTitle === currentChat.title) {
      return;
    }

    try {
      const { saveFirebaseData } = await import('../funcs');
      
      // Get company email for the project
      const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
      const targetCompanyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
      
      if (!targetCompanyEmail || !currentProject) {
        showToast("Could not find project information", "error");
        return;
      }

      // Determine if chat is private or public
      const isPrivateChat = currentChat.isPublic === false;
      
      // Get the correct Firebase path
      const chatBasePath = getChatBasePath(
        targetCompanyEmail,
        currentProject,
        currentChat.id,
        isPrivateChat,
        auth.currentUser?.email
      );
      
      await saveFirebaseData(`${chatBasePath}/title`, newTitle.trim());
      
      // Update current chat state
      setCurrentChat({
        ...currentChat,
        title: newTitle.trim()
      });
      
      showToast("Chat renamed successfully", "success");
      setProjectDropdownOpen(false);
    } catch (error) {
      console.error("Error renaming chat:", error);
      showToast("Failed to rename chat", "error");
    }
  };

  // Handle view members (opens members list modal)
  const handleViewMembers = () => {
    setProjectDropdownOpen(false);
    setShowAllMembers(true);
    setSelectedMemberEmail(null);
    setMemberSearchTerm('');
    setShowMobileMemberDetails(false); // Reset mobile state when opening modal
  };

  // Handle permission update for a member - saves entire permissions object
  const handlePermissionUpdate = async (memberEmail, permissionsObject) => {
    try {
      const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
      const targetCompanyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
      
      if (!targetCompanyEmail || !currentProject) {
        showToast("Could not find project information", "error");
        return;
      }

      // Find the member to check their role
      const member = adminPanelMembers.find(m => m.email === memberEmail);
      if (!member || member.role !== 'editor') {
        showToast("Permissions can only be set for Editor roles", "error");
        return;
      }

      const formattedEmail = memberEmail.replace(/\./g, ',');
      
      // Ensure all permissions are explicitly set with boolean values
      // Missing permissions default to false
      // Note: modifyAnnotations has been merged into createAnnotations
      const completePermissions = {
        createHighlights: permissionsObject.createHighlights ?? false,
        createAnnotations: permissionsObject.createAnnotations ?? false,
        deleteAnnotations: permissionsObject.deleteAnnotations ?? false,
        share: permissionsObject.share ?? false
      };
      
      // Cleanup: Remove modifyAnnotations if it exists in old data
      // We'll explicitly remove it from Firebase by not including it in the update
      
      // Save entire permissions object to Firebase (this will overwrite and remove modifyAnnotations)
      const permissionsPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/members/${formattedEmail}/permissions`;
      await saveFirebaseData(permissionsPath, completePermissions);
      
      // Update local state
      setAdminPanelMembers(prev => prev.map(m => {
        if (m.email === memberEmail) {
          return {
            ...m,
            permissions: completePermissions
          };
        }
        return m;
      }));
      
      showToast(`Permissions updated for ${memberEmail}`, "success");
    } catch (error) {
      console.error("Error updating permissions:", error);
      showToast("Failed to update permissions", "error");
    }
  };

  // Toggle permission in permissions modal
  const togglePermission = (permissionKey) => {
    if (!editingMember) return;
    
    // Ignore modifyAnnotations - it's been merged into createAnnotations
    if (permissionKey === 'modifyAnnotations') {
      console.warn('modifyAnnotations has been merged into createAnnotations. Ignoring toggle.');
      return;
    }
    
    // Ensure permissions object exists and has all keys
    const currentPermissions = editingMember.permissions || {};
    
    // Toggle the specific permission
    // Note: modifyAnnotations has been merged into createAnnotations, so we don't include it
    const newPermissions = {
      createHighlights: currentPermissions.createHighlights ?? false,
      createAnnotations: currentPermissions.createAnnotations ?? false,
      deleteAnnotations: currentPermissions.deleteAnnotations ?? false,
      share: currentPermissions.share ?? false,
      [permissionKey]: !(currentPermissions[permissionKey] ?? false)
    };
    
    const updatedMember = { ...editingMember, permissions: newPermissions };
    setEditingMember(updatedMember);
    
    // Update real state immediately
    setAdminPanelMembers(prev => prev.map(m => m.email === editingMember.email ? updatedMember : m));
    
    // Save entire permissions object to Firebase
    handlePermissionUpdate(editingMember.email, newPermissions);
  };

  // Handle role change for a member (Editor <-> Viewer)
  const handleRoleChange = async (memberEmail, newRole) => {
    try {
      const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
      const targetCompanyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
      
      if (!targetCompanyEmail || !currentProject) {
        showToast("Could not find project information", "error");
        return;
      }

      const formattedEmail = memberEmail.replace(/\./g, ',');
      const rolePath = `Companies/${targetCompanyEmail}/projects/${currentProject}/members/${formattedEmail}/role`;
      
      await saveFirebaseData(rolePath, newRole);
      
      // If changing to editor, set default permissions
      if (newRole === 'editor') {
        const permissionsPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/members/${formattedEmail}/permissions`;
        await saveFirebaseData(permissionsPath, DEFAULT_PERMISSIONS);
      } else if (newRole === 'viewer') {
        // Remove permissions for viewers
        const permissionsPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/members/${formattedEmail}/permissions`;
        await saveFirebaseData(permissionsPath, null);
      }
      
      // Update local state
      setAdminPanelMembers(prev => prev.map(member => {
        if (member.email === memberEmail) {
          const updatedMember = {
            ...member,
            role: newRole
          };
          
          // Update permissions based on role
          // Note: modifyAnnotations has been merged into createAnnotations
          if (newRole === 'editor') {
            updatedMember.permissions = {
              createHighlights: true,
              createAnnotations: true,
              deleteAnnotations: true,
              share: true
            };
          } else {
            updatedMember.permissions = null;
          }
          
          return updatedMember;
        }
        return member;
      }));
      
      showToast(`Role updated to ${newRole} for ${memberEmail}`, "success");
    } catch (error) {
      console.error("Error updating role:", error);
      showToast("Failed to update role", "error");
    }
  };

  // Handle leave project
  const handleLeaveProject = async () => {
    if (!auth.currentUser || !auth.currentUser.email) {
      showToast("Please log in to leave project", "info");
      return;
    }

    if (!window.confirm("Are you sure you want to leave this project? You will lose access to all chats and data in this project.")) {
      return;
    }

    try {
      const { deleteFirebaseData, getFirebaseData } = await import('../funcs');
      
      // Get company email for the project
      const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
      const targetCompanyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
      
      if (!targetCompanyEmail || !currentProject) {
        showToast("Could not find project information", "error");
        return;
      }

      const currentUserEmail = auth.currentUser.email.replace(/\./g, ',');
      
      // Remove user from project members
      const memberPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/members/${currentUserEmail}`;
      await deleteFirebaseData(memberPath);
      
      // Remove reverse mapping
      const reverseMappingPath = `emailToSharedProjects/${currentUserEmail}/${targetCompanyEmail}/${currentProject}`;
      await deleteFirebaseData(reverseMappingPath);
      
      // Clear shared project data from localStorage
      localStorage.removeItem('sharedCompanyEmail');
      localStorage.removeItem('sharedProjectId');
      
      // Switch to default project or first available project
      handleProjectChange('default');
      
      showToast("You have left the project", "success");
      setProjectDropdownOpen(false);
    } catch (error) {
      console.error("Error leaving project:", error);
      showToast("Failed to leave project", "error");
    }
  };

  // Handle delete chat
  const handleDeleteChat = async () => {
    if (!currentChat || !currentChat.id) {
      showToast("No chat selected", "error");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this chat?")) {
      return;
    }

    try {
      const { remove } = await import('firebase/database');
      const { ref } = await import('firebase/database');
      
      // Get company email for the project
      const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
      const targetCompanyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
      
      if (!targetCompanyEmail || !currentProject) {
        showToast("Could not find project information", "error");
        return;
      }

      // Determine if chat is private or public
      const isPrivateChat = currentChat.isPublic === false;
      
      // Get the correct Firebase path
      let chatRef;
      if (isPrivateChat && auth.currentUser?.email) {
        const userEmailFormatted = auth.currentUser.email.replace(/\./g, ',');
        const targetCompanyEmailFormatted = targetCompanyEmail.replace(/\./g, ',');
        chatRef = ref(database, `Companies/${targetCompanyEmailFormatted}/projects/${currentProject}/privateChats/${userEmailFormatted}/${currentChat.id}`);
      } else {
        const targetCompanyEmailFormatted = targetCompanyEmail.replace(/\./g, ',');
        chatRef = ref(database, `Companies/${targetCompanyEmailFormatted}/projects/${currentProject}/groqChats/${currentChat.id}`);
      }

      await remove(chatRef);
      
      // Clear current chat and create a new one
      setCurrentChat(null);
      setMessages([]);
      setInputValue('');
      
      showToast("Chat deleted successfully", "success");
    } catch (error) {
      console.error("Error deleting chat:", error);
      showToast("Failed to delete chat", "error");
    }
    
    setProjectDropdownOpen(false);
  };

  // Handle sharing a chat
  const handleShareChat = async (chatToShare) => {
    if (!chatToShare || !chatToShare.id) return;

    // Ensure user is logged in (already handled by the button click, but good practice here)
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      showToast("Please log in to share chats", "info");
      return;
    }

    try {
      // Import necessary functions
      const { generateUniqueId, saveFirebaseData, showToast, getFirebaseData } = await import('../funcs');

      // Get company email path
      const userEmail = currentUser.email.replace(/\./g, ',');
      const companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${userEmail}`);

      if (!companyEmailPath) {
        console.error("Company email path not found for user:", currentUser.email);
        showToast("Could not find company information to generate share link.", "error");
        return;
      }

      // Get the sanitized URL where highlights were likely created
      const sourceUrl = window.location.href; // Assuming sharing happens on the page with highlights
      const sanitizedSourceUrl = sanitizeFirebasePath(sourceUrl);

      // Create a copy of the chat data including highlights and source URL
      const sharedChatData = {
        title: chatToShare.title,
        // messages: chatToShare.messages,
        timestamp: Date.now(),
        originalId: chatToShare.id,
        // highlights: highlightsToShare,
        originalSanitizedUrl: sanitizedSourceUrl, // Add the source URL
        companyEmail: companyEmailPath,
        project: currentProject,
        id: chatToShare.id
      };

      // Save the shared chat to a public location in Firebase
      const shareId = generateUniqueId(12);
      await saveFirebaseData(`sharedChats/${shareId}`, sharedChatData);

      // Store the share data temporarily until user confirms in the modal
      setPendingShareData({
        shareId,
        chatToShare,
        companyEmailPath,
        currentUser,
        originalChatPath: `Companies/${companyEmailPath}/projects/${currentProject}/groqChats/${chatToShare.id}`,
        sharedChatData
      });

      // Create the shareable URL with company email
      // For HashRouter, we need to put the query params after the hash
      const shareableUrl = `${window.location.origin}/#/demonstration?share=${shareId}&companyEmail=${encodeURIComponent(companyEmailPath)}&project=${encodeURIComponent(currentProject)}`;

      // Set the share link and open the modal
      setShareLink(shareableUrl);
      setShareLinkModalOpen(true);

    } catch (error) {
      console.error("Error sharing chat:", error);
      const { showToast } = await import('../funcs');
      showToast("Failed to create shareable link", "error");
    }
  };

  // Function to confirm sharing and add isShared flag to original chat
  const confirmSharing = async () => {
    if (!pendingShareData) return;

    try {
      const { getFirebaseData, saveFirebaseData } = await import('../funcs');
      const { shareId, originalChatPath, currentUser } = pendingShareData;

      // Add shared flag to the original chat in Firebase
      const originalChatData = await getFirebaseData(originalChatPath);
      
      if (originalChatData) {
        const updatedChatData = {
          ...originalChatData,
          isShared: true,
          sharedAt: Date.now(),
          shareId: shareId
        };
        await saveFirebaseData(originalChatPath, updatedChatData);
        console.log('✅ Added shared flag to original chat:', pendingShareData.chatToShare.id);

        // Add sender to sharedPeople list
        const sharedPeoplePath = `${originalChatPath}/sharedPeople`;
        const existingSharedPeople = await getFirebaseData(sharedPeoplePath) || {};
        
        // Add current user to shared people list if not already present
        if (!existingSharedPeople[currentUser.email]) {
          // Get sender name from userProfile or fallback
          const senderName = (userProfile?.firstName && userProfile?.lastName) 
            ? `${userProfile.firstName} ${userProfile.lastName}`
            : (userProfile?.username || currentUser.displayName || currentUser.email.split('@')[0]);
          
          const senderData = {
            email: currentUser.email,
            name: senderName,
            addedAt: Date.now(),
            addedBy: 'sender'
          };
          
          await saveFirebaseData(`${sharedPeoplePath}/${currentUser.email.replace(/\./g, ',')}`, senderData);
          console.log('✅ Added sender to sharedPeople list:', currentUser.email);
        }
      }

      // Clear pending share data
      setPendingShareData(null);
    } catch (error) {
      console.error("Error confirming sharing:", error);
      const { showToast } = await import('../funcs');
      showToast("Failed to confirm sharing", "error");
    }
  };

  // Handle sending share notification via email
  const handleSendEmailShare = async () => {
    if (!shareEmail || !shareEmail.trim()) {
      showToast("Please enter an email address", "error");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shareEmail)) {
      showToast("Please enter a valid email address", "error");
      return;
    }

    if (!shareLink) {
      showToast("No share link available", "error");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      showToast("Please log in to share chats", "info");
      return;
    }

    // Check if the recipient email is in the same company (only if chat is not private)
    if (!currentChat?.privateUser) {
      try {
        const { getFirebaseData } = await import('../funcs');
        
        // Get current user's company email
        const currentUserEmail = currentUser.email.replace(/\./g, ',');
        const currentUserCompany = await getFirebaseData(`emailToCompanyDirectory/${currentUserEmail}`);
        
        // Get recipient's company email
        const recipientEmail = shareEmail.replace(/\./g, ',');
        const recipientCompany = await getFirebaseData(`emailToCompanyDirectory/${recipientEmail}`);
        
        // Check if both users are in the same company
        if (currentUserCompany && recipientCompany && 
            currentUserCompany.replace(/\./g, ',') === recipientCompany.replace(/\./g, ',')) {
          showToast("Cannot share a public chat with someone in the same company.Move the chat to private and share it again", "error");
          return;
        }
      } catch (error) {
        console.error("Error checking company membership:", error);
        // Continue with sharing if we can't check company membership
      }
    }

    try {
      const { generateUniqueId, saveFirebaseData, showToast, getFirebaseData } = await import('../funcs');

      // Create notification for recipient
      const recipientEmail = shareEmail.replace(/\./g, ',');
      const senderEmailFormatted = currentUser.email.replace(/\./g, ',');
      const notificationId = generateUniqueId(12);

      // Extract public shareId (if any) from shareLink
      const publicShareId = shareLink.match(/share=([^&]+)/)?.[1];

      // Get sender name from userProfile or fallback
      const senderDisplayName = (userProfile?.firstName && userProfile?.lastName) 
        ? `${userProfile.firstName} ${userProfile.lastName}`
        : (userProfile?.username || currentUser.displayName || currentUser.email);

      // Build base notification data
      const baseNotificationData = {
        senderEmail: currentUser.email,
        senderName: senderDisplayName,
        chatTitle: currentChat?.title || 'Untitled Chat',
        timestamp: Date.now(),
        notificationId
      };

      if (false) { // Private mode removed - chats are private by default
        // Private copy: write under Notifications/{email}/copiedChats/{notificationId}
        // Point shareId to the original groq chat path
        let targetCompanyEmail = null;
        try {
          // Prefer currentChat.companyEmail when in shared context; otherwise resolve via user mapping
          if (currentChat && currentChat.companyEmail) {
            targetCompanyEmail = currentChat.companyEmail;
          } else {
            const emailForLookup = currentUser.email.replace(/\./g, ',');
            targetCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${emailForLookup}`);
          }
        } catch (_) {}

        const originalChatId = currentChat?.originalId || currentChat?.id;
        const originalPath = targetCompanyEmail && originalChatId
          ? `Companies/${targetCompanyEmail}/projects/${currentProject}/groqChats/${originalChatId}`
          : null;

        const notificationData = {
          ...baseNotificationData,
          type: 'copied',
          // Provide a shareId that is a path to the original groq chat (per requirement)
          shareId: originalPath || '',
        };

        await saveFirebaseData(`Notifications/${recipientEmail}/copiedChats/${notificationId}`, notificationData);
      } else {
        // Collaborative/public share: existing behavior under sharedChats
        const notificationData = {
          ...baseNotificationData,
          shareLink,
          shareId: publicShareId
        };
        await saveFirebaseData(`Notifications/${recipientEmail}/sharedChats/${notificationId}`, notificationData);
      }

      // Confirm sharing and add isShared flag to original chat
      await confirmSharing();

      // Create shared contact relationship (bidirectional) for chat shares
      if (shareMode === 'chat') {
        // Use contact's email as key to prevent duplicates when sharing multiple chats with same person
        
        // Add receiver as shared contact for sender (key = recipient's formatted email)
        const senderContactData = {
        email: shareEmail,
        name: shareEmail.split('@')[0], // Use email prefix as default name
        sharedChats: {
          [publicShareId]: {
            chatId: publicShareId,
            chatTitle: currentChat.title || 'Untitled Chat',
            timestamp: Date.now()
          }
        },
        addedBy: 'sender',
        lastSharedTimestamp: Date.now()
      };
      
        // Check if contact already exists and merge shared chats
        const existingSenderContact = await getFirebaseData(`SharedContacts/${senderEmailFormatted}/${recipientEmail}`);
        if (existingSenderContact && existingSenderContact.sharedChats) {
          senderContactData.sharedChats = {
            ...existingSenderContact.sharedChats,
            [publicShareId]: senderContactData.sharedChats[publicShareId]
          };
        }
        
        await saveFirebaseData(`SharedContacts/${senderEmailFormatted}/${recipientEmail}`, senderContactData);

        // Add sender as shared contact for receiver (key = sender's formatted email)
        // Use the same senderDisplayName calculated above
        const receiverContactData = {
        email: currentUser.email,
        name: senderDisplayName,
        sharedChats: {
          [publicShareId]: {
            chatId: publicShareId,
            chatTitle: currentChat.title || 'Untitled Chat',
            timestamp: Date.now()
          }
        },
        addedBy: 'receiver',
        lastSharedTimestamp: Date.now()
      };
      
        // Check if contact already exists and merge shared chats
        const existingReceiverContact = await getFirebaseData(`SharedContacts/${recipientEmail}/${senderEmailFormatted}`);
        if (existingReceiverContact && existingReceiverContact.sharedChats) {
          receiverContactData.sharedChats = {
            ...existingReceiverContact.sharedChats,
            [publicShareId]: receiverContactData.sharedChats[publicShareId]
          };
        }
        
        await saveFirebaseData(`SharedContacts/${recipientEmail}/${senderEmailFormatted}`, receiverContactData);
      }

      showToast("Share notification sent successfully!", "success");
      setShareEmail(''); // Clear the email input
    } catch (error) {
      console.error("Error sending email share:", error);
      showToast("Failed to send share notification", "error");
    }
  };

  //Contacts sidebar
  useEffect(() => {
    const initMessages = async () => {
      // if (!isInsideExtension && isContactsPanelVisible && auth && auth.currentUser && auth.currentUser.email) {
      //   setMessagingUserEmail(auth.currentUser.email)
      //   setMessagingUserName(auth.currentUser.displayName)
      //   setMessagingCurrentProject(currentProject);
      //   const firebaseDb = await import('firebase/database');
      //   const { database } = await import('../firebase-init'); // Get database instance
      //   const { ref, onValue, off } = firebaseDb;
      //   setFirebaseFunctions(ref, onValue, off, database);

      //   var currentTopic = "general";
      //   if (currentChat)
      //     currentTopic = `groqChats-${currentChat.id}`;
      //   initContactsPanel(currentTopic);
      // }
    };

    initMessages();

    // let listenerRef = null;
    // let unsubscribe = () => { }; // Function to detach listener

    // const setupListener = async () => {
    //   if (!isInsideExtension && isContactsPanelVisible && auth && auth.currentUser && auth.currentUser.email) {
    //     try {
    //       setMessagingUserEmail(auth.currentUser.email)
    //       setMessagingUserName(auth.currentUser.displayName)
    //       setMessagingCurrentProject(currentProject);
    //       const firebaseDb = await import('firebase/database');
    //       const { database } = await import('../firebase-init'); // Get database instance
    //       const { ref, onValue, off } = firebaseDb;

    //       var currentTopic = "general";
    //       if (currentChat)
    //         currentTopic = `groqChats/${currentChat.id}`;
    //       initContactsPanel(currentTopic);
    //       var mainCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${auth.currentUser.email.replace(".", ",")}`);
    //       // Dynamically import Firebase database functions

    //       //Does not go all the way down to /highlights so that we can also reload labels and codes for the highlights, which are in /annotationHistory
    //       const messagesPath = `Companies/${mainCompanyEmail}/messages`;
    //       console.log("[Listener] Setting up listener for path:", messagesPath);
    //       listenerRef = ref(database, messagesPath);

    //       // Define the callback for onValue
    //       const handleValueChange = (snapshot) => {
    //         console.log("Website loading messages");
    //         loadMessages(ref, onValue, off);
    //       };

    //       // Attach the listener
    //       onValue(listenerRef, handleValueChange);


    //       // Set the cleanup function
    //       unsubscribe = () => {
    //         if (listenerRef) {
    //           console.log("[Listener] Detaching listener from path:", messagesPath);
    //           off(listenerRef, 'value', handleValueChange); // Detach specific callback
    //           listenerRef = null;
    //         }
    //       };

    //     } catch (error) {
    //       console.error("[Listener] Error setting up Firebase listener:", error);
    //     }
    //   }
    // };



    // setupListener();

    // Cleanup function: Remove listener when dependencies change or component unmounts
    // return () => {
    //   unsubscribe();
    // };
  }, [isExtensionSidebarVisible]);

  // Add a handler for project change
  const handleProjectChange = (newProject) => {
    setCurrentChat(null);

    // debug log removed
    setMessages([]);
    setIsExtensionSidebarVisible(false);
    setCurrentProject(newProject);

    // Check for sharedCompanyEmail in localStorage
    // ChatSidebar is responsible for setting/clearing this when user selects projects
    const storedSharedCompany = localStorage.getItem('sharedCompanyEmail');
    
    if (storedSharedCompany) {
      // Removed console.log for performance
      setSharedCompanyEmail(storedSharedCompany);
      setIsSharedView(true);
      setMainCompanyEmail(storedSharedCompany);
    } else {
      // Removed console.log for performance
      setSharedCompanyEmail(null);
      setIsSharedView(false);
    }
    
    // Reload highlights after project change to ensure correct data is loaded
    // Removed console.log for performance
    loadHighlights();
  };



  useEffect(() => {
    if (currentChat) {
      // debug log removed
      setCurrentChatID(currentChat.id);
    } else {
      // debug log removed
      setCurrentChatID(null);
    }
  }, [currentChat]);
  



  // Handle clicking outside the model dropdown, try again dropdown, and drawing canvas
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isModelDropdownOpen && !event.target.closest('.model-dropdown-container')) {
        setIsModelDropdownOpen(false);
      }
      if (tryAgainDropdownOpen !== null && !event.target.closest('.try-again-dropdown-container')) {
        setTryAgainDropdownOpen(null);
      }
      // Close project dropdown when clicking outside
      if (projectDropdownOpen && !event.target.closest('[data-project-dropdown]')) {
        setProjectDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelDropdownOpen, tryAgainDropdownOpen, projectDropdownOpen]);

  // Separate useEffect for scroll prevention
  useEffect(() => {
    const preventScroll = (e) => {
      e.preventDefault();
    };

    if (tryAgainDropdownOpen !== null) {
      // Prevent scrolling with multiple methods
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // Also prevent wheel and touch events
      document.addEventListener('wheel', preventScroll, { passive: false });
      document.addEventListener('touchmove', preventScroll, { passive: false });
    } else {
      // Restore scrolling
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      
      document.removeEventListener('wheel', preventScroll);
      document.removeEventListener('touchmove', preventScroll);
    }

    return () => {
      // Cleanup on unmount
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.removeEventListener('wheel', preventScroll);
      document.removeEventListener('touchmove', preventScroll);
    };
  }, [tryAgainDropdownOpen]);

  useEffect(() => {
    const resizer = document.getElementById('sidebar-resizer');
    //Overlay is needed because resizing event does not fire when mouse is over the iframe
    const overlay = document.getElementById('sidebar-overlay');

    if (!resizer || !overlay) return;

    let isResizing = false;

    function resize(e) {
      if (!isResizing) return;

      const containerRect = document.body.getBoundingClientRect();
      setSidebarWidth(Math.min(Math.abs(e.clientX - containerRect.right), window.viewport.segments[0].width - 50));
    }

    function stopResizing() {
      isResizing = false;
      // Remove the event listeners
      overlay.style.display = 'none';
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
    }

    const handleMouseDown = function (e) {
      isResizing = true;
      // Add event listeners to the document to capture mouse movements globally
      overlay.style.display = 'block';
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', stopResizing);
    };

    resizer.addEventListener('mousedown', handleMouseDown);

    return () => {
      resizer.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
    };
  }, [isExtensionSidebarVisible])

  // Reset custom sidebar width to default when it opens
  useEffect(() => {
    if (isCustomSidebarVisible) {
      setCustomSidebarWidth(CUSTOM_SIDEBAR_DEFAULT_WIDTH);
    }
  }, [isCustomSidebarVisible]);

  // Custom sidebar resizer
  useEffect(() => {
    const customResizer = document.getElementById('custom-sidebar-resizer');
    const overlay = document.getElementById('sidebar-overlay');

    if (!customResizer || !overlay) return;

    let isResizing = false;

    function resize(e) {
      if (!isResizing) return;

      const containerRect = document.body.getBoundingClientRect();
      const newWidth = Math.abs(e.clientX - containerRect.right);
      // Enforce minimum width (cannot be smaller than default width)
      const minWidth = CUSTOM_SIDEBAR_DEFAULT_WIDTH;
      const maxWidth = window.viewport.segments[0].width - 50;
      setCustomSidebarWidth(Math.max(minWidth, Math.min(newWidth, maxWidth)));
    }

    function stopResizing() {
      isResizing = false;
      overlay.style.display = 'none';
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
    }

    const handleMouseDown = function (e) {
      isResizing = true;
      overlay.style.display = 'block';
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', stopResizing);
    };

    customResizer.addEventListener('mousedown', handleMouseDown);

    return () => {
      customResizer.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
    };
  }, [isCustomSidebarVisible])

  
  useEffect(() => {
    async function populateLibrary() {
      if (isLibraryVisible) {
        var companyEmail = await getMainCompanyEmail();
        var project = currentProject;
        var images = await getFirebaseData(`Companies/${companyEmail}/projects/${project}/categoriesImages`);
        var categories = Object.keys(images);
        var div = document.getElementById("library-div");
        for (let category of categories) {
          var inlineDiv = document.createElement("div");
          // inlineDiv.style.display = "inline-block";
          // inlineDiv.style.border = "1px solid lightgray";
          // inlineDiv.style.borderRadius = "10px";
          inlineDiv.style.margin = "5px";
          var header = document.createElement("h2");
          header.style.fontWeight = 500;
          header.style.margin = "20px";
          header.textContent = category;
          var break_ = document.createElement("br");
          // inlineDiv.append(header);
          inlineDiv.append(break_);

          var imageValues = Object.values(images[category]["images"]);
          for (let image of imageValues) {
            if (!image.data)
              continue;
            var imgDiv = document.createElement("div");
            imgDiv.style.margin = "5px";
            imgDiv.style.cursor = "pointer";
            imgDiv.style.display = "inline-block";
            var imgOverlay = document.createElement("div");
            imgOverlay.className = "img-overlay";
            imgOverlay.style.background = "linear-gradient(0deg, #00000066, transparent)";
            imgOverlay.style.position = "absolute";
            imgOverlay.style.width = "250px";
            imgOverlay.style.height = "250px";
            imgOverlay.textContent = category;
            imgOverlay.style.paddingTop = "200px";
            imgOverlay.style.paddingLeft = "10px";
            imgOverlay.style.color = "white";
            var img = document.createElement("img");
            img.style.width = "250px";
            img.style.height = "250px";
            img.style.objectFit = "cover";
            img.style.objectPosition = "center";
            // img.style.border = "1px solid lightgray";
            // img.style.borderRadius = "10px";
            img.src = image.data;

            function expandImage() {
              var overlay = document.getElementById("img-fullscreen");
              overlay.style.display = "";
              overlay.src = image.data;
            }

            imgOverlay.onclick = expandImage;
            imgDiv.append(imgOverlay);
            imgDiv.append(img);
            inlineDiv.append(imgDiv);
          }
          div.append(inlineDiv);
        }
      }
    }

    populateLibrary();
  }, [isLibraryVisible]);

  return (
    <>
      <div style={{ display: 'flex', height: '100vh' }}>
        <ChatSidebar
          onChatSelect={handleChatSelect}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          currentProject={currentProject}
          onProjectChange={onProjectChange}
          isLibraryVisible={isLibraryVisible}
          setIsLibraryVisible={setIsLibraryVisible}
          setIsExtensionSidebarVisible={setIsExtensionSidebarVisible}
          showSearchOverlay={showSearchOverlay}
          currentChat={currentChat}
          setShowSearchOverlay={setShowSearchOverlay}
          onChatsUpdate={handleChatsUpdate}
          onChatModeChange={handleChatModeChange}
        />
        <main
          id="mainChatInterface"
          className="chat-interface" style={{
            flex: 1,
            display: isLibraryVisible ? 'none' : 'flex',
            flexDirection: 'column',
            marginTop: 0,
            background: 'rgb(249, 248, 246)',
            position: 'relative',
            paddingTop: '10px'
          }}>
          {/* Authentication Modal */}
          {showAuthModal && (
            <AuthModal
              onClose={() => setShowAuthModal(false)}
              onGuestContinue={handleGuestContinue}
            />
          )}

          {/* Header bar - always visible */}
             <div style={{
            padding: '0.75rem 1rem 1rem 1rem',
               textAlign: 'center',
               display: 'flex',
               flexDirection: 'column',
               justifyContent: 'center',
               alignItems: 'center',
            position: 'relative',
            gap: '0.5rem'
          }} data-project-dropdown="header">
            {/* Title with conditional dropdown */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
               position: 'relative'
             }}>
              <h1 style={{
                fontSize: '1.125rem',
                fontWeight: '400',
                color: '#202123',
                margin: 0,
                padding: 0
              }}>
                {currentChat && currentChat.title 
                  ? currentChat.title 
                  : (currentProject === 'default' ? 'Default Project' : currentProject)
                }
              </h1>
              
              {/* Dropdown arrow - only for shared projects and public chats (not private chats) */}
              {isProjectShared && auth.currentUser && (!currentChat || currentChat.isPublic !== false) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleProjectDropdownToggle(e);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6b7280',
                    transition: 'all 0.2s ease',
                    pointerEvents: 'auto',
                    zIndex: 1001
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = '#111827';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = '#6b7280';
                  }}
                  data-project-dropdown="toggle"
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
                    style={{
                      transform: projectDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              )}

              {/* Dropdown menu - only for shared projects and public chats (not private chats) */}
              {projectDropdownOpen && isProjectShared && auth.currentUser && (!currentChat || currentChat.isPublic !== false) && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: '0.5rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  padding: '8px',
                  minWidth: '200px',
                  zIndex: 1000
                }} data-project-dropdown="menu">
                  {/* Owner options */}
                  {isProjectOwner && (
                    <>
                      <button
                        onClick={handleManageMembers}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.9rem',
                          color: '#1f2937',
                          textAlign: 'left',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                        }}
                        data-project-dropdown="item"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <span>Manage Members</span>
                      </button>
                      
                      <button
                        onClick={handleViewMembers}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.9rem',
                          color: '#1f2937',
                          textAlign: 'left',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                        }}
                        data-project-dropdown="item"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        <span>View Members</span>
                      </button>
                      
                      {/* Share Project button - only shown when user has share permission */}
                      {!sharePermissionLoading && canShare && (
                      <button
                        onClick={() => {
                          setProjectDropdownOpen(false);
                          setShareModalProjectId(currentProject);
                          setShowShareModal(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.9rem',
                          color: '#1f2937',
                          textAlign: 'left',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                        }}
                        data-project-dropdown="item"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="18" cy="5" r="3"></circle>
                          <circle cx="6" cy="12" r="3"></circle>
                          <circle cx="18" cy="19" r="3"></circle>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        <span>Share Project</span>
                      </button>
                      )}
                      
                      <button
                        onClick={() => {
                          if (!currentChat) {
                            showToast("No chat selected", "info");
                            return;
                          }
                          handleDeleteChat();
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.9rem',
                          color: '#dc2626',
                          textAlign: 'left',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#fee2e2';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                        }}
                        data-project-dropdown="item"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>Delete Chat</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          if (!currentChat) {
                            showToast("No chat selected", "info");
                            return;
                          }
                          handleRenameChat();
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.9rem',
                          color: '#1f2937',
                          textAlign: 'left',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                        }}
                        data-project-dropdown="item"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>Rename Chat</span>
                      </button>
                    </>
                  )}

                  {/* Recipient options */}
                  {!isProjectOwner && (
                    <>
                      <button
                        onClick={handleViewMembers}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.9rem',
                          color: '#1f2937',
                          textAlign: 'left',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                        }}
                        data-project-dropdown="item"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        <span>View Members</span>
                      </button>
                      
                      {/* Share Project button - only shown when user has share permission */}
                      {!sharePermissionLoading && canShare && (
                        <button
                          onClick={() => {
                            setProjectDropdownOpen(false);
                            setShareModalProjectId(currentProject);
                            setShowShareModal(true);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.9rem',
                            color: '#1f2937',
                            textAlign: 'left',
                            transition: 'background 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#f3f4f6';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'transparent';
                          }}
                          data-project-dropdown="item"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                          </svg>
                          <span>Share Project</span>
                        </button>
                      )}
                      
                      <button
                        onClick={() => {
                          if (!currentChat) {
                            showToast("No chat selected", "info");
                            return;
                          }
                          handleDeleteChat();
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.9rem',
                          color: '#dc2626',
                          textAlign: 'left',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#fee2e2';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                        }}
                        data-project-dropdown="item"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>Delete Chat</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          if (!currentChat) {
                            showToast("No chat selected", "info");
                            return;
                          }
                          handleRenameChat();
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.9rem',
                          color: '#1f2937',
                          textAlign: 'left',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                        }}
                        data-project-dropdown="item"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>Rename Chat</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Share button - only visible when chat has messages (positioned absolutely) */}
            {SHARE_BUTTON_ENABLED && currentChat && messages.length > 0 && !isInsideExtension && (
                 <button
                   onClick={() => {
                     if (!auth.currentUser) {
                       showToast("Please log in to share chats", "info");
                       return;
                     }
                     
                     // Check if this is a shared chat from sharedChats path (received from someone else)
                     // Disable sharing only for chats that have originalId (from sharedChats path) and are not from the sender
                     if (currentChat.originalId && !currentChat.isSender) {
                       showToast("Only the original creator can share this chat", "error");
                       return;
                     }
                     
                     handleShareChat(currentChat);
                   }}
                   style={{
                     position: 'absolute',
                     right: '10rem',
                     background: (currentChat.originalId && !currentChat.isSender) ? '#f3f4f6' : 'white',
                     border: '1px solid rgba(0,0,0,0.08)',
                     borderRadius: '12px',
                     padding: '0.625rem 1rem',
                     fontSize: '0.875rem',
                     color: (currentChat.originalId && !currentChat.isSender) ? '#9ca3af' : '#1f2937',
                     cursor: (currentChat.originalId && !currentChat.isSender) ? 'not-allowed' : 'pointer',
                     minWidth: 'auto',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     gap: '0.5rem',
                     transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                     boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                     outline: 'none',
                     fontWeight: '500',
                     opacity: (currentChat.originalId && !currentChat.isSender) ? 0.6 : 1
                   }}
                   onMouseEnter={(e) => {
                     if (!(currentChat.originalId && !currentChat.isSender)) {
                       e.target.style.borderColor = 'rgba(0,0,0,0.15)';
                       e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                       e.target.style.transform = 'translateY(-1px)';
                     }
                   }}
                   onMouseLeave={(e) => {
                     if (!(currentChat.originalId && !currentChat.isSender)) {
                       e.target.style.borderColor = 'rgba(0,0,0,0.08)';
                       e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                       e.target.style.transform = 'translateY(0)';
                     }
                   }}
                   title={
                     (currentChat.originalId && !currentChat.isSender) 
                       ? "Only the original creator can share this chat"
                       : "Share this chat"
                   }
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256">
                     <path fill="currentColor" d="m237.66 106.35l-80-80A8 8 0 0 0 144 32v40.35c-25.94 2.22-54.59 14.92-78.16 34.91c-28.38 24.08-46.05 55.11-49.76 87.37a12 12 0 0 0 20.68 9.58c11-11.71 50.14-48.74 107.24-52V192a8 8 0 0 0 13.66 5.65l80-80a8 8 0 0 0 0-11.3ZM160 172.69V144a8 8 0 0 0-8-8c-28.08 0-55.43 7.33-81.29 21.8a196.17 196.17 0 0 0-36.57 26.52c5.8-23.84 20.42-46.51 42.05-64.86C99.41 99.77 127.75 88 152 88a8 8 0 0 0 8-8V51.32L220.69 112Z"/>
                   </svg>
                   <span style={{ fontWeight: '500' }}>Share</span>
                 </button>
               )}

               {/* Model selection dropdown - always visible */}
               {!isInsideExtension && (
                 <div style={{
                   position: 'absolute',
                   left: '1.5rem',
                   zIndex: 1000
                 }} className="model-dropdown-container">
                   <button
                     onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                     style={{
                       background: 'white',
                       border: '1px solid rgba(0,0,0,0.08)',
                       borderRadius: '12px',
                       padding: '0.625rem 1rem',
                       fontSize: '0.875rem',
                       color: '#1f2937',
                       cursor: 'pointer',
                       minWidth: '140px',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'space-between',
                       gap: '0.5rem',
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
                       {availableModels.find(m => m.value === selectedModel)?.label}
                     </span>
                     <svg 
                       width="16" 
                       height="16" 
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
                       width: '320px'
                     }}>
                       {availableModels.map((model, index) => (
                         <button
                           key={model.value}
                           onClick={() => {
                             setSelectedModel(model.value);
                             setIsModelDropdownOpen(false);
                           }}
                           style={{
                             width: '100%',
                             padding: '0.875rem 1.25rem',
                             background: selectedModel === model.value ? 'rgb(245, 243, 240)' : 'transparent',
                             border: 'none',
                             textAlign: 'left',
                             cursor: 'pointer',
                             transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                             borderBottom: index < availableModels.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                             display: 'flex',
                             flexDirection: 'column',
                             gap: '0.375rem'
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
                               fontSize: '0.875rem',
                               letterSpacing: '-0.01em'
                             }}>
                               {model.label}
                             </span>
                             {selectedModel === model.value && (
                               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#3b82f6' }}>
                                 <polyline points="20,6 9,17 4,12"></polyline>
                               </svg>
                             )}
                           </div>
                           <span style={{
                             fontSize: '0.75rem',
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
               )}

               {/* Project Members Avatars - visible for shared projects with members, but not for private chats */}
               {isProjectShared && projectMembers.length > 0 && !isInsideExtension && (!currentChat || currentChat.isPublic !== false) && (
                 <div style={{
                   position: 'absolute',
                   left: '12rem',
                   display: 'flex',
                   alignItems: 'center',
                   gap: '4px',
                   zIndex: 999
                 }}>
                   <div style={{
                     display: 'flex',
                     alignItems: 'center'
                   }}>
                     {projectMembers.slice(0, 5).map((member, index) => (
                       <div
                         key={member.email}
                         onClick={() => {
                           setShowAllMembers(true);
                           setSelectedMemberEmail(member.email);
                           setMemberSearchTerm('');
                           setShowMobileMemberDetails(false);
                           // Fetch member details if not already loaded
                           if (!memberDetails[member.email]) {
                             fetchMemberDetails(member.email, member.userCompanyEmail || companyEmail);
                           }
                         }}
                         style={{
                           width: '32px',
                           height: '32px',
                           borderRadius: '50%',
                           border: '2px solid white',
                           marginLeft: index === 0 ? 0 : '-8px',
                           overflow: 'hidden',
                           backgroundColor: '#e5e7eb',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                           zIndex: projectMembers.length - index,
                           cursor: 'pointer',
                           position: 'relative',
                           transition: 'transform 0.2s'
                         }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.transform = 'scale(1.1)';
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.transform = 'scale(1)';
                         }}
                         title={`${member.name}${member.role === 'owner' ? ' (Owner)' : ''}`}
                      >
                        {/* Profile picture - always render img tag if URL exists */}
                        <img
                          src={member.profilePic || ''}
                          alt={member.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: member.profilePic ? 'block' : 'none'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            // Show the fallback initial
                            const fallback = e.target.nextElementSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                          onLoad={(e) => {
                            // Make sure image is visible if it loads successfully
                            e.target.style.display = 'block';
                            // Hide the fallback
                            const fallback = e.target.nextElementSibling;
                            if (fallback) fallback.style.display = 'none';
                          }}
                        />
                        {/* Fallback initial letter */}
                        <div style={{
                          display: member.profilePic ? 'none' : 'flex',
                          width: '100%',
                          height: '100%',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: `hsl(${member.email.charCodeAt(0) * 10 % 360}, 60%, 70%)`,
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          position: 'absolute',
                          top: 0,
                          left: 0
                        }}>
                          {(() => {
                            // Use firstName and lastName initials only (no email fallback)
                            const firstInitial = member.firstName && member.firstName.trim() ? member.firstName.trim()[0].toUpperCase() : '';
                            const lastInitial = member.lastName && member.lastName.trim() ? member.lastName.trim()[0].toUpperCase() : '';
                            
                            if (firstInitial && lastInitial) {
                              return firstInitial + lastInitial;
                            } else if (firstInitial) {
                              return firstInitial + firstInitial;
                            }
                            return 'U';
                          })()}
                        </div>
                      </div>
                    ))}
                     {projectMembers.length > 5 && (
                       <button
                         onClick={() => {
                           setShowAllMembers(true);
                           setSelectedMemberEmail(null);
                           setMemberSearchTerm('');
                           setShowMobileMemberDetails(false);
                         }}
                         style={{
                           width: '32px',
                           height: '32px',
                           borderRadius: '50%',
                           border: '2px solid white',
                           marginLeft: '-8px',
                           backgroundColor: '#374151',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                           color: 'white',
                           fontSize: '11px',
                           fontWeight: '600',
                           zIndex: 0,
                           cursor: 'pointer',
                           padding: 0,
                           outline: 'none'
                         }}
                         title={`View all ${projectMembers.length} members`}
                         onMouseEnter={(e) => {
                           e.target.style.backgroundColor = '#4b5563';
                         }}
                         onMouseLeave={(e) => {
                           e.target.style.backgroundColor = '#374151';
                         }}
                       >
                         +{projectMembers.length - 5}
                       </button>
                     )}
                   </div>
                 </div>
               )}

              {/* View All Members Modal - New Design (Admin Only) - REMOVED: Using unified modal below */}
              {false && showAllMembers && isProjectOwner && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 50,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(17, 24, 39, 0.4)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    padding: '16px',
                    transition: 'opacity 0.3s'
                  }}
                  onClick={() => {
                    setShowAllMembers(false);
                    setSelectedMemberEmail(null);
                    setMemberSearchTerm('');
                    setShowMobileMemberDetails(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowAllMembers(false);
                      setSelectedMemberEmail(null);
                      setMemberSearchTerm('');
                      setShowMobileMemberDetails(false);
                    }
                  }}
                >
                  {/* Modal Card */}
                  <div
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                      width: '100%',
                      maxWidth: '900px',
                      height: '60vh',
                      maxHeight: '650px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'row',
                      border: '1px solid rgba(17, 24, 39, 0.05)',
                      animation: 'fadeIn 0.2s ease-out'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* LEFT PANEL (List) */}
                    <div
                      style={{
                        display: (showMobileMemberDetails && window.innerWidth < 768) ? 'none' : 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'white',
                        borderRight: '1px solid #f3f4f6',
                        height: '100%',
                        width: '100%',
                        maxWidth: '38%',
                        transition: 'all 0.3s'
                      }}
                    >
                      {/* Header */}
                      <div style={{ padding: '16px 0', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 16px' }}>
                          <h2 style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#111827',
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            Project Members
                            <span style={{
                              backgroundColor: '#f3f4f6',
                              color: '#4b5563',
                              fontSize: '12px',
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '9999px'
                            }}>
                              {projectMembers.length}
                            </span>
                          </h2>
                        </div>
                        
                        {/* Search Input */}
                        <div style={{ position: 'relative', margin: '0 16px' }}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{
                              position: 'absolute',
                              left: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: '#9ca3af',
                              pointerEvents: 'none'
                            }}
                          >
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                          </svg>
                          <input
                            type="text"
                            placeholder="Search people..."
                            value={memberSearchTerm}
                            onChange={(e) => setMemberSearchTerm(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '12px 12px 12px 36px',
                              border: 'none',
                              backgroundColor: '#f3f4f6',
                              borderRadius: '8px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(229, 231, 235, 0.5)',
                              boxSizing: 'border-box'
                            }}
                            onFocus={(e) => {
                              e.target.style.backgroundColor = '#f3f4f6';
                            }}
                            onBlur={(e) => {
                              e.target.style.backgroundColor = '#f3f4f6';
                            }}
                          />
                        </div>
                      </div>

                      {/* List */}
                      <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '8px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        {(() => {
                          const lowerTerm = memberSearchTerm.toLowerCase();
                          const filtered = projectMembers.filter(m => {
                            const fullName = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
                            const email = m.email.toLowerCase();
                            const name = m.name.toLowerCase();
                            return fullName.includes(lowerTerm) || email.includes(lowerTerm) || name.includes(lowerTerm);
                          });

                          // Sort: Current user first, then alphabetical
                          const sorted = filtered.sort((a, b) => {
                            const isCurrentA = auth.currentUser?.email === a.email;
                            const isCurrentB = auth.currentUser?.email === b.email;
                            if (isCurrentA) return -1;
                            if (isCurrentB) return 1;
                            const nameA = (a.firstName || a.name || '').toLowerCase();
                            const nameB = (b.firstName || b.name || '').toLowerCase();
                            return nameA.localeCompare(nameB);
                          });

                          return sorted.length > 0 ? (
                            sorted.map((member) => {
                              const isSelected = selectedMemberEmail === member.email;
                              const isCurrentUser = auth.currentUser?.email === member.email;
                              const firstInitial = member.firstName && member.firstName.trim() ? member.firstName.trim()[0].toUpperCase() : '';
                              const lastInitial = member.lastName && member.lastName.trim() ? member.lastName.trim()[0].toUpperCase() : '';
                              const initials = firstInitial && lastInitial ? firstInitial + lastInitial : 
                                            firstInitial ? firstInitial + firstInitial : 
                                            (member.name || 'U').substring(0, 2).toUpperCase();
                              
                              // Role pill colors
                              const roleColors = {
                                owner: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
                                editor: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
                                member: { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' },
                                viewer: { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' }
                              };
                              const roleColor = roleColors[member.role] || roleColors.member;
                              const roleLabel = member.role === 'owner' ? 'Owner' : member.role === 'editor' ? 'Editor' : 'Viewer';

                              return (
                                <div
                                  key={member.email}
                                  onClick={() => {
                                    setSelectedMemberEmail(member.email);
                                    // Only hide left panel on mobile devices
                                    if (window.innerWidth < 768) {
                                      setShowMobileMemberDetails(true);
                                    }
                                    // Fetch member details if not already loaded
                                    if (!memberDetails[member.email]) {
                                      fetchMemberDetails(member.email, member.userCompanyEmail || companyEmail);
                                    }
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px',
                                    margin: '0 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    backgroundColor: isSelected ? '#f3f4f6' : 'transparent',
                                    boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(229, 231, 235, 0.5)' : 'none'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.backgroundColor = '#f9fafb';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      setSelectedMemberEmail(member.email);
                                      if (window.innerWidth < 768) {
                                        setShowMobileMemberDetails(true);
                                      }
                                      if (!memberDetails[member.email]) {
                                        fetchMemberDetails(member.email, member.userCompanyEmail || companyEmail);
                                      }
                                    }
                                  }}
                                >
                                  {/* Avatar */}
                                  <div style={{ position: 'relative', flexShrink: 0 }}>
                                    {member.profilePic ? (
                                      <img
                                        src={member.profilePic}
                                        alt={member.name}
                                        style={{
                                          width: '42px',
                                          height: '42px',
                                          borderRadius: '50%',
                                          objectFit: 'cover',
                                          border: '1px solid #e5e7eb',
                                          display: 'block'
                                        }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          const fallback = e.target.nextElementSibling;
                                          if (fallback) fallback.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <div
                                      style={{
                                        display: member.profilePic ? 'none' : 'flex',
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '16px',
                                        fontWeight: '500',
                                        border: '1px solid #e5e7eb',
                                        backgroundColor: `hsl(${member.email.charCodeAt(0) * 10 % 360}, 60%, 70%)`,
                                        color: 'white',
                                        textTransform: 'uppercase'
                                      }}
                                    >
                                      {(() => {
                                        const firstInitial = member.firstName && member.firstName.trim() ? member.firstName.trim()[0].toUpperCase() : '';
                                        const lastInitial = member.lastName && member.lastName.trim() ? member.lastName.trim()[0].toUpperCase() : '';
                                        if (firstInitial && lastInitial) {
                                          return firstInitial + lastInitial;
                                        } else if (firstInitial) {
                                          return firstInitial + firstInitial;
                                        }
                                        return 'U';
                                      })()}
                                    </div>
                                    {isCurrentUser && (
                                      <div style={{
                                        position: 'absolute',
                                        bottom: '-4px',
                                        right: '-4px',
                                        width: '16px',
                                        height: '16px',
                                        backgroundColor: '#10b981',
                                        border: '2px solid white',
                                        borderRadius: '50%'
                                      }} title="You" />
                                    )}
                                  </div>

                                  {/* Text Info */}
                                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                      <span style={{
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        color: isSelected ? '#111827' : '#374151',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        flex: 1,
                                        minWidth: 0,
                                        textAlign: 'left'
                                      }}>
                                        {isCurrentUser ? 'You' : `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name}
                                      </span>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '2px 8px',
                                        borderRadius: '9999px',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        border: `1px solid ${roleColor.border}`,
                                        backgroundColor: roleColor.bg,
                                        color: roleColor.text,
                                        marginLeft: '8px',
                                        transform: 'scale(0.9)',
                                        transformOrigin: 'right',
                                        flexShrink: 0
                                      }}>
                                        {roleLabel}
                                      </span>
                                    </div>
                                    <span style={{
                                      fontSize: '12px',
                                      color: '#9ca3af',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      marginTop: '2px',
                                      textAlign: 'left'
                                    }}>
                                      {member.email}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '160px',
                              color: '#9ca3af'
                            }}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, marginBottom: '8px' }}>
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                              </svg>
                              <p style={{ fontSize: '14px', margin: 0 }}>No members found</p>
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* Footer gradient hint */}
                      <div style={{ height: '16px', background: 'linear-gradient(to top, white, transparent)', flexShrink: 0 }} />
                    </div>

                    {/* RIGHT PANEL (Details) - Desktop */}
                    <div
                      style={{
                        display: selectedMemberEmail ? 'flex' : 'none',
                        flexDirection: 'column',
                        backgroundColor: 'white',
                        height: '100%',
                        width: '100%',
                        maxWidth: '62%',
                        position: 'relative',
                        transition: 'all 0.3s'
                      }}
                      className="member-details-panel"
                    >
                      {/* Close Button (Desktop Only) */}
                      <button
                        onClick={() => {
                          setShowAllMembers(false);
                          setSelectedMemberEmail(null);
                          setMemberSearchTerm('');
                          setShowMobileMemberDetails(false);
                        }}
                        style={{
                          display: 'flex',
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          zIndex: 10,
                          padding: '8px',
                          color: '#9ca3af',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = '#4b5563';
                          e.target.style.backgroundColor = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = '#9ca3af';
                          e.target.style.backgroundColor = 'transparent';
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>

                      {selectedMemberEmail && (() => {
                        const member = projectMembers.find(m => m.email === selectedMemberEmail);
                        if (!member) return null;
                        
                        const isCurrentUser = auth.currentUser?.email === member.email;
                        const firstInitial = member.firstName && member.firstName.trim() ? member.firstName.trim()[0].toUpperCase() : '';
                        const lastInitial = member.lastName && member.lastName.trim() ? member.lastName.trim()[0].toUpperCase() : '';
                        const initials = firstInitial && lastInitial ? firstInitial + lastInitial : 
                                      firstInitial ? firstInitial + firstInitial : 
                                      (member.name || 'U').substring(0, 2).toUpperCase();
                        const details = memberDetails[member.email] || {};
                        const roleColors = {
                          owner: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
                          editor: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
                          member: { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' },
                          viewer: { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' }
                        };
                        const roleColor = roleColors[member.role] || roleColors.member;
                        const roleLabel = member.role === 'owner' ? 'Owner' : member.role === 'editor' ? 'Editor' : 'Viewer';
                        const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name;
                        const username = details.username || member.name || member.email.split('@')[0];
                        const bio = details.bio || null;
                        const joinedDate = member.joinedAt ? new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown';

                        return (
                          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: 'white' }}>
                            <div style={{ flex: 1, padding: '24px 40px', overflowY: 'auto' }}>
                              {/* Header Section: Avatar & Primary Info */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingBottom: '32px' }}>
                                <div style={{ position: 'relative', marginBottom: '20px', cursor: 'default' }}>
                                  {member.profilePic ? (
                                    <img
                                      src={member.profilePic}
                                      alt={username}
                                      style={{
                                        width: '112px',
                                        height: '112px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                        border: '4px solid white'
                                      }}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        const fallback = e.target.nextElementSibling;
                                        if (fallback) fallback.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div style={{
                                    display: member.profilePic ? 'none' : 'flex',
                                    width: '96px',
                                    height: '96px',
                                    borderRadius: '50%',
                                    backgroundColor: `hsl(${member.email.charCodeAt(0) * 10 % 360}, 60%, 70%)`,
                                    color: 'white',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '32px',
                                    fontWeight: '600',
                                    textTransform: 'uppercase',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    border: '4px solid white'
                                  }}>
                                    {(() => {
                                      const firstInitial = member.firstName && member.firstName.trim() ? member.firstName.trim()[0].toUpperCase() : '';
                                      const lastInitial = member.lastName && member.lastName.trim() ? member.lastName.trim()[0].toUpperCase() : '';
                                      if (firstInitial && lastInitial) {
                                        return firstInitial + lastInitial;
                                      } else if (firstInitial) {
                                        return firstInitial + firstInitial;
                                      }
                                      return 'U';
                                    })()}
                                  </div>
                                  <div style={{ position: 'absolute', bottom: '4px', right: '4px', transform: 'translate(4px, 4px)' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '2px 8px',
                                      borderRadius: '9999px',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      borderWidth: '2px',
                                      borderStyle: 'solid',
                                      borderColor: 'white',
                                      backgroundColor: roleColor.bg,
                                      color: roleColor.text,
                                      boxShadow: '0 0 0 2px ' + roleColor.border
                                    }}>
                                      {roleLabel}
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                <h2 style={{
                                  fontSize: '24px',
                                  fontWeight: '700',
                                  color: '#111827',
                                  letterSpacing: '-0.025em',
                                  margin: 0
                                }}>
                                  {fullName}
                                </h2>
                                </div>
                                <p style={{
                                  color: '#6b7280',
                                  fontWeight: '500',
                                  marginTop: '4px',
                                  margin: 0
                                }}>
                                  @{username}
                                </p>
                              </div>

                              {/* Content Grid */}
                              <div style={{ maxWidth: '448px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
                                {/* About Section */}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{
                                      marginTop: '2px',
                                      padding: '8px',
                                      backgroundColor: '#f3f4f6',
                                      borderRadius: '6px',
                                      flexShrink: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#6b7280' }}>
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                      </svg>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'left' }}>
                                      <h3 style={{
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: '#9ca3af',
                                        letterSpacing: '0.05em',
                                        marginBottom: '4px',
                                        margin: 0,
                                        textAlign: 'left'
                                      }}>
                                        About
                                      </h3>
                                      {bio ? (
                                        <p style={{
                                          fontSize: '14px',
                                          color: '#374151',
                                          lineHeight: '1.625',
                                          whiteSpace: 'pre-line',
                                          margin: 0,
                                          textAlign: 'left'
                                        }}>
                                          {bio}
                                        </p>
                                      ) : (
                                        <p style={{
                                          fontSize: '14px',
                                          color: '#9ca3af',
                                          fontStyle: 'italic',
                                          margin: 0,
                                          textAlign: 'left'
                                        }}>
                                          No bio provided.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Contact & Meta Section */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{
                                      padding: '8px',
                                      backgroundColor: '#f3f4f6',
                                      borderRadius: '6px',
                                      flexShrink: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#6b7280' }}>
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                        <polyline points="22,6 12,13 2,6"></polyline>
                                      </svg>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'left' }}>
                                      <h3 style={{
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: '#9ca3af',
                                        letterSpacing: '0.05em',
                                        marginBottom: '2px',
                                        margin: 0,
                                        textAlign: 'left'
                                      }}>
                                        Email Address
                                      </h3>
                                      <p style={{
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        color: '#111827',
                                        userSelect: 'all',
                                        margin: 0,
                                        textAlign: 'left'
                                      }}>
                                        {member.email}
                                      </p>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{
                                      padding: '8px',
                                      backgroundColor: '#f3f4f6',
                                      borderRadius: '6px',
                                      flexShrink: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#6b7280' }}>
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                      </svg>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'left' }}>
                                      <h3 style={{
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: '#9ca3af',
                                        letterSpacing: '0.05em',
                                        marginBottom: '2px',
                                        margin: 0,
                                        textAlign: 'left'
                                      }}>
                                        Joined
                                      </h3>
                                      <p style={{
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        color: '#111827',
                                        margin: 0,
                                        textAlign: 'left'
                                      }}>
                                        {joinedDate}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Permissions / Actions Card */}
                                <div style={{ marginTop: '24px', paddingTop: '20px' }}>
                                  {isCurrentUser ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.currentTarget.blur();
                                        setShowAllMembers(false);
                                        setShowAccountSettingsModal(true);
                                      }}
                                      style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        padding: '12px',
                                        backgroundColor: '#111827',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                        outline: 'none'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.backgroundColor = '#1f2937';
                                        e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = '#111827';
                                        e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                      }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                      </svg>
                                      <span>Edit Profile</span>
                                    </button>
                                  ) : (
                                    <div style={{
                                      backgroundColor: '#f9fafb',
                                      borderRadius: '12px',
                                      padding: '16px',
                                      border: '1px solid #f3f4f6',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '16px'
                                    }}>
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                      }}>
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px'
                                        }}>
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#6b7280' }}>
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                          </svg>
                                          <span style={{
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            color: '#374151'
                                          }}>
                                            Access Level
                                          </span>
                                        </div>
                                        {isProjectOwner ? (
                                          <select
                                            defaultValue={roleLabel}
                                            onChange={(e) => {
                                              // Handle role change
                                              console.log('Role changed to:', e.target.value);
                                            }}
                                            style={{
                                              backgroundColor: 'white',
                                              border: '1px solid #e5e7eb',
                                              color: '#111827',
                                              fontSize: '14px',
                                              borderRadius: '8px',
                                              padding: '6px 12px',
                                              cursor: 'pointer',
                                              outline: 'none'
                                            }}
                                            onFocus={(e) => {
                                              e.target.style.borderColor = '#111827';
                                            }}
                                            onBlur={(e) => {
                                              e.target.style.borderColor = '#e5e7eb';
                                            }}
                                          >
                                            <option value="Owner">Owner</option>
                                            <option value="Editor">Editor</option>
                                            <option value="Viewer">Viewer</option>
                                          </select>
                                        ) : (
                                          <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '2px 8px',
                                            borderRadius: '9999px',
                                            fontSize: '12px',
                                            fontWeight: '500',
                                            border: `1px solid ${roleColor.border}`,
                                            backgroundColor: roleColor.bg,
                                            color: roleColor.text
                                          }}>
                                            {roleLabel}
                                          </span>
                                        )}
                                      </div>
                                      
                                      {isProjectOwner && (
                                        <div style={{
                                          paddingTop: '12px',
                                          borderTop: '1px solid rgba(229, 231, 235, 0.6)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between'
                                        }}>
                                          <span style={{
                                            fontSize: '12px',
                                            color: '#6b7280'
                                          }}>
                                            Remove from project
                                          </span>
                                          <button
                                            onClick={() => {
                                              // Handle remove member
                                              console.log('Remove member:', member.email);
                                            }}
                                            style={{
                                              fontSize: '12px',
                                              fontWeight: '500',
                                              color: '#dc2626',
                                              backgroundColor: '#fef2f2',
                                              padding: '6px 12px',
                                              borderRadius: '8px',
                                              border: 'none',
                                              cursor: 'pointer',
                                              transition: 'all 0.2s',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}
                                            onMouseEnter={(e) => {
                                              e.target.style.color = '#b91c1c';
                                              e.target.style.backgroundColor = '#fee2e2';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.target.style.color = '#dc2626';
                                              e.target.style.backgroundColor = '#fef2f2';
                                            }}
                                          >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <polyline points="3 6 5 6 21 6"></polyline>
                                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                            Remove
                                          </button>
                                        </div>
                                      )}
                                      {!isProjectOwner && (
                                        <p style={{
                                          fontSize: '12px',
                                          color: '#9ca3af',
                                          fontStyle: 'italic',
                                          marginTop: '8px',
                                          margin: 0
                                        }}>
                                          Only owners can manage access permissions.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Message Button for Other Users */}
                                {!isCurrentUser && (
                                  <div style={{ marginTop: '24px', paddingTop: '20px' }}>
                                    <button
                                      onClick={() => {
                                        // Open message/chat with this user
                                        console.log('Message user clicked', member.email);
                                      }}
                                      style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        padding: '12px',
                                        backgroundColor: '#111827',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.backgroundColor = '#1f2937';
                                        e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = '#111827';
                                        e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                      }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                      </svg>
                                      <span>Message</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {!selectedMemberEmail && (
                        <div style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#9ca3af'
                        }}>
                          Select a member to view details
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* View All Members Modal - Unified View (Same for Owner and Shared Users) */}
              {showAllMembers && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 50,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(17, 24, 39, 0.4)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    padding: '16px',
                    transition: 'opacity 0.3s'
                  }}
                  onClick={() => {
                    setShowAllMembers(false);
                    setSelectedMemberEmail(null);
                    setMemberSearchTerm('');
                    setShowMobileMemberDetails(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowAllMembers(false);
                      setSelectedMemberEmail(null);
                      setMemberSearchTerm('');
                      setShowMobileMemberDetails(false);
                    }
                  }}
                >
                  {/* Modal Card */}
                  <div
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                      width: '100%',
                      maxWidth: '900px',
                      height: '60vh',
                      maxHeight: '650px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'row',
                      border: '1px solid rgba(17, 24, 39, 0.05)',
                      animation: 'fadeIn 0.2s ease-out'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* LEFT PANEL (List) */}
                    <div
                      style={{
                        display: (showMobileMemberDetails && window.innerWidth < 768) ? 'none' : 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'white',
                        borderRight: '1px solid #f3f4f6',
                        height: '100%',
                        width: '100%',
                        maxWidth: '38%',
                        transition: 'all 0.3s'
                      }}
                    >
                      {/* Header */}
                      <div style={{ padding: '20px 0', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                        padding: '0 20px'
                    }}>
                      <h2 style={{
                        margin: 0,
                          fontSize: '18px',
                        fontWeight: '600',
                        color: '#111827'
                      }}>
                          {isProjectOwner ? 'Project Members' : 'Members'}
                      </h2>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          color: '#4b5563',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                        }}>
                          {projectMembers.length}
                        </span>
                      </div>
                        {/* Search Input */}
                        <div style={{ position: 'relative', margin: '0 20px' }}>
                          <input
                            type="text"
                            placeholder={isProjectOwner ? "Search people..." : "Search members..."}
                            value={memberSearchTerm}
                            onChange={(e) => setMemberSearchTerm(e.target.value)}
                        style={{
                              width: '100%',
                              padding: '12px 12px 12px 36px',
                          border: 'none',
                              borderRadius: '8px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s',
                              backgroundColor: '#f3f4f6',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(229, 231, 235, 0.5)',
                              boxSizing: 'border-box'
                            }}
                            onFocus={(e) => {
                          e.target.style.backgroundColor = '#f3f4f6';
                        }}
                            onBlur={(e) => {
                              e.target.style.backgroundColor = '#f3f4f6';
                            }}
                          />
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{
                              position: 'absolute',
                              left: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: '#9ca3af'
                            }}
                          >
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                          </svg>
                    </div>
                      </div>

                      {/* Members List */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                        {projectMembers
                          .filter(member => {
                            if (!memberSearchTerm) return true;
                            const searchLower = memberSearchTerm.toLowerCase();
                            const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name;
                            return name.toLowerCase().includes(searchLower) || member.email.toLowerCase().includes(searchLower);
                          })
                          .sort((a, b) => {
                            // Sort: Current user first, then alphabetical
                            const isCurrentA = auth.currentUser?.email === a.email;
                            const isCurrentB = auth.currentUser?.email === b.email;
                            if (isCurrentA && !isCurrentB) return -1;
                            if (!isCurrentA && isCurrentB) return 1;
                            
                            // Then alphabetical by name
                            const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || '';
                            const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.name || '';
                            return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
                          })
                          .map((member) => {
                            const isSelected = selectedMemberEmail === member.email;
                            const isCurrentUser = auth.currentUser?.email === member.email;
                            
                            // Role pill colors
                            const roleColors = {
                              owner: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
                              editor: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
                              member: { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' },
                              viewer: { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' }
                            };
                            const roleColor = roleColors[member.role] || roleColors.member;
                            const roleLabel = member.role === 'owner' ? 'Owner' : member.role === 'editor' ? 'Editor' : 'Viewer';
                            
                            return (
                        <div
                          key={`${member.email}-${memberPresence[member.email] || 'offline'}`}
                                onClick={() => {
                                  setSelectedMemberEmail(member.email);
                                  if (window.innerWidth < 768) {
                                    setShowMobileMemberDetails(true);
                                  }
                                  if (!memberDetails[member.email]) {
                                    fetchMemberDetails(member.email, member.userCompanyEmail || companyEmail);
                                  }
                                }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                                  margin: '0 20px',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  backgroundColor: isSelected ? '#f3f4f6' : 'transparent',
                                  boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(229, 231, 235, 0.5)' : 'none'
                          }}
                          onMouseEnter={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.backgroundColor = '#f9fafb';
                                  }
                          }}
                          onMouseLeave={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }
                                }}
                              >
                                {/* Avatar */}
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                  {member.profilePic ? (
                                    <img
                                      src={member.profilePic}
                                      alt={member.name}
                                      style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '1px solid #e5e7eb',
                                        display: 'block'
                                      }}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        const fallback = e.target.nextElementSibling;
                                        if (fallback) fallback.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    style={{
                                      display: member.profilePic ? 'none' : 'flex',
                                      width: '42px',
                                      height: '42px',
                                      borderRadius: '50%',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '14px',
                                      fontWeight: '500',
                                      border: '1px solid #e5e7eb',
                                      backgroundColor: `hsl(${member.email.charCodeAt(0) * 10 % 360}, 60%, 70%)`,
                                      color: 'white',
                                      textTransform: 'uppercase'
                                    }}
                                  >
                                    {(() => {
                                      const firstInitial = member.firstName && member.firstName.trim() ? member.firstName.trim()[0].toUpperCase() : '';
                                      const lastInitial = member.lastName && member.lastName.trim() ? member.lastName.trim()[0].toUpperCase() : '';
                                      if (firstInitial && lastInitial) {
                                        return firstInitial + lastInitial;
                                      } else if (firstInitial) {
                                        return firstInitial + firstInitial;
                                      }
                                      return 'U';
                                    })()}
                                  </div>
                                  {/* Presence Status Indicator */}
                          <div style={{
                                    position: 'absolute',
                                    bottom: '-2px',
                                    right: '0px',
                                    width: '14px',
                                    height: '14px',
                            borderRadius: '50%',
                                    backgroundColor: getPresenceColor(memberPresence[member.email] || 'offline'),
                                    border: '2px solid white',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                  }} title={getPresenceLabel(memberPresence[member.email] || 'offline')} />
                                </div>

                                {/* Text Info */}
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                    <span style={{
                                      fontSize: '14px',
                                      fontWeight: '500',
                                      color: isSelected ? '#111827' : '#374151',
                            overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      flex: 1,
                                      minWidth: 0,
                                      textAlign: 'left'
                                    }}>
                                      {isCurrentUser ? 'You' : (() => {
                                        const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim();
                                        return fullName || member.name;
                                      })()}
                                    </span>
                                    <span style={{
                                      display: 'inline-flex',
                            alignItems: 'center',
                                      padding: '2px 8px',
                                      borderRadius: '9999px',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      border: `1px solid ${roleColor.border}`,
                                      backgroundColor: roleColor.bg,
                                      color: roleColor.text,
                                      marginLeft: '8px',
                                      transform: 'scale(0.9)',
                                      transformOrigin: 'right',
                            flexShrink: 0
                          }}>
                                      {roleLabel}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: '12px',
                                    color: '#9ca3af',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    marginTop: '2px',
                                    textAlign: 'left'
                                  }}>
                                    {member.email}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      
                      {/* Footer gradient hint */}
                      <div style={{ height: '16px', background: 'linear-gradient(to top, white, transparent)', flexShrink: 0 }} />
                    </div>

                    {/* RIGHT PANEL (Details) - Desktop */}
                    <div
                      style={{
                        display: selectedMemberEmail ? 'flex' : 'none',
                        flexDirection: 'column',
                        backgroundColor: 'white',
                        height: '100%',
                        width: '100%',
                        maxWidth: '62%',
                        position: 'relative',
                        transition: 'all 0.3s'
                      }}
                      className="member-details-panel"
                    >
                      {/* Close Button (Desktop Only) */}
                      <button
                        onClick={() => {
                          setShowAllMembers(false);
                          setSelectedMemberEmail(null);
                          setMemberSearchTerm('');
                          setShowMobileMemberDetails(false);
                        }}
                        style={{
                          display: 'flex',
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          zIndex: 10,
                          padding: '8px',
                          color: '#9ca3af',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = '#4b5563';
                          e.target.style.backgroundColor = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = '#9ca3af';
                          e.target.style.backgroundColor = 'transparent';
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>

                      {selectedMemberEmail && (() => {
                        const member = projectMembers.find(m => m.email === selectedMemberEmail);
                        if (!member) return null;
                        
                        const isCurrentUser = auth.currentUser?.email === member.email;
                        const details = memberDetails[member.email] || {};
                        const roleColors = {
                          owner: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
                          editor: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
                          member: { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' },
                          viewer: { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' }
                        };
                        const roleColor = roleColors[member.role] || roleColors.member;
                        const roleLabel = member.role === 'owner' ? 'Owner' : member.role === 'editor' ? 'Editor' : 'Viewer';
                        const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name;
                        const username = details.username || member.name || member.email.split('@')[0];
                        const bio = details.bio || null;
                        const joinedDate = member.joinedAt ? new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown';

                        return (
                          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: 'white' }}>
                            <div style={{ flex: 1, padding: '24px 40px', overflowY: 'auto' }}>
                              {/* Header Section: Avatar & Primary Info */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingBottom: '32px' }}>
                                <div style={{ position: 'relative', marginBottom: '20px', cursor: 'default' }}>
                            {member.profilePic ? (
                              <img
                                src={member.profilePic}
                                      alt={username}
                                style={{
                                        width: '112px',
                                        height: '112px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                        border: '4px solid white'
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  const fallback = e.target.nextElementSibling;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div style={{
                              display: member.profilePic ? 'none' : 'flex',
                                    width: '96px',
                                    height: '96px',
                                    borderRadius: '50%',
                              backgroundColor: `hsl(${member.email.charCodeAt(0) * 10 % 360}, 60%, 70%)`,
                              color: 'white',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '32px',
                              fontWeight: '600',
                                    textTransform: 'uppercase',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    border: '4px solid white'
                            }}>
                              {(() => {
                                const firstInitial = member.firstName && member.firstName.trim() ? member.firstName.trim()[0].toUpperCase() : '';
                                const lastInitial = member.lastName && member.lastName.trim() ? member.lastName.trim()[0].toUpperCase() : '';
                                if (firstInitial && lastInitial) {
                                  return firstInitial + lastInitial;
                                } else if (firstInitial) {
                                  return firstInitial + firstInitial;
                                }
                                return 'U';
                              })()}
                            </div>
                                  <div style={{ position: 'absolute', bottom: '4px', right: '4px', transform: 'translate(4px, 4px)' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '2px 8px',
                                      borderRadius: '9999px',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      borderWidth: '2px',
                                      borderStyle: 'solid',
                                      borderColor: 'white',
                                      backgroundColor: roleColor.bg,
                                      color: roleColor.text,
                                      boxShadow: '0 0 0 2px ' + roleColor.border
                                    }}>
                                      {roleLabel}
                                    </span>
                          </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                  <h2 style={{
                                    fontSize: '24px',
                                    fontWeight: '700',
                                    color: '#111827',
                                    letterSpacing: '-0.025em',
                                    margin: 0
                                  }}>
                                    {fullName}
                                  </h2>
                                </div>
                                <p style={{
                                  color: '#6b7280',
                                  fontWeight: '500',
                                  marginTop: '4px',
                                  margin: 0
                                }}>
                                  @{username}
                                </p>
                              </div>

                              {/* Content Grid */}
                              <div style={{ maxWidth: '448px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
                                {/* About Section */}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{
                                      marginTop: '2px',
                                      padding: '8px',
                                      backgroundColor: '#f3f4f6',
                                      borderRadius: '6px',
                                      flexShrink: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#6b7280' }}>
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                      </svg>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'left' }}>
                                      <h3 style={{
                                        fontSize: '12px',
                              fontWeight: '600',
                                        color: '#9ca3af',
                                        letterSpacing: '0.05em',
                                        marginBottom: '4px',
                                        margin: 0,
                                        textAlign: 'left'
                                      }}>
                                        About
                                      </h3>
                                      {bio ? (
                                        <p style={{
                                          fontSize: '14px',
                                          color: '#374151',
                                          lineHeight: '1.625',
                                          whiteSpace: 'pre-line',
                                          margin: 0,
                                          textAlign: 'left'
                                        }}>
                                          {bio}
                                        </p>
                                      ) : (
                                        <p style={{
                                          fontSize: '14px',
                                          color: '#9ca3af',
                                          fontStyle: 'italic',
                                          margin: 0,
                                          textAlign: 'left'
                                        }}>
                                          No bio provided.
                                        </p>
                                      )}
                            </div>
                                  </div>
                                </div>

                                {/* Contact & Meta Section */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{
                                      padding: '8px',
                                      backgroundColor: '#f3f4f6',
                                      borderRadius: '6px',
                                      flexShrink: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#6b7280' }}>
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                        <polyline points="22,6 12,13 2,6"></polyline>
                                      </svg>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'left' }}>
                                      <h3 style={{
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: '#9ca3af',
                                        letterSpacing: '0.05em',
                                        marginBottom: '2px',
                                        margin: 0,
                                        textAlign: 'left'
                                      }}>
                                        Email Address
                                      </h3>
                                      <p style={{
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        color: '#111827',
                                        userSelect: 'all',
                                        margin: 0,
                                        textAlign: 'left'
                            }}>
                              {member.email}
                                      </p>
                            </div>
                          </div>

                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{
                                      padding: '8px',
                                      backgroundColor: '#f3f4f6',
                                      borderRadius: '6px',
                                      flexShrink: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#6b7280' }}>
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                      </svg>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'left' }}>
                                      <h3 style={{
                                        fontSize: '12px',
                              fontWeight: '600',
                                        color: '#9ca3af',
                                        letterSpacing: '0.05em',
                                        marginBottom: '2px',
                                        margin: 0,
                                        textAlign: 'left'
                                      }}>
                                        Joined
                                      </h3>
                                      <p style={{
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        color: '#111827',
                                        margin: 0,
                                        textAlign: 'left'
                                      }}>
                                        {joinedDate}
                                      </p>
                        </div>
                                  </div>
                                </div>

                                {/* Edit Profile Button for Current User */}
                                <div style={{ marginTop: '24px', paddingTop: '20px' }}>
                                  {isCurrentUser ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.currentTarget.blur();
                                        setShowAllMembers(false);
                                        setShowAccountSettingsModal(true);
                                      }}
                                      style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        padding: '12px',
                                        backgroundColor: '#111827',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                        outline: 'none'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.backgroundColor = '#1f2937';
                                        e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = '#111827';
                                        e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                      }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                      </svg>
                                      <span>Edit Profile</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        // Open message/chat with this user
                                        console.log('Message user clicked', member.email);
                                      }}
                                      style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        padding: '12px',
                                        backgroundColor: '#111827',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.backgroundColor = '#1f2937';
                                        e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = '#111827';
                                        e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                      }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                      </svg>
                                      <span>Message</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {!selectedMemberEmail && (
                        <div style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#9ca3af'
                        }}>
                          Select a member to view details
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Panel Modal - Table-based ChatGPT Style */}
              {showAdminPanel && isProjectOwner && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      backdropFilter: 'blur(4px)',
                      WebkitBackdropFilter: 'blur(4px)',
                      zIndex: 10000
                    }}
                    onClick={() => {
                      setShowAdminPanel(false);
                      setEditingMember(null);
                    }}
                  />
                  <div
                    style={{
                      position: 'fixed',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: '#fafafa',
                      color: '#353740',
                      width: '90%',
                      maxWidth: '1024px',
                      maxHeight: '90vh',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      zIndex: 10001,
                      borderRadius: '8px',
                      boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Container */}
                    <div style={{
                      padding: '40px 32px',
                      overflowY: 'auto',
                      flex: 1
                    }}>
                      {/* Stats Cards */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '24px',
                        marginBottom: '16px',
                        paddingBottom: '16px',
                        borderBottom: '1px solid #f7f7f8',
                        flexWrap: 'nowrap',
                        whiteSpace: 'nowrap'
                      }}>
                        {[
                          { 
                            label: 'Owners', 
                            value: adminPanelMembers.filter(m => m.role === 'owner').length,
                            Icon: HiOutlineShieldCheck
                          },
                          { 
                            label: 'Editors', 
                            value: adminPanelMembers.filter(m => m.role === 'editor').length,
                            Icon: HiOutlinePencil
                          },
                          { 
                            label: 'Viewers', 
                            value: adminPanelMembers.filter(m => m.role === 'viewer').length,
                            Icon: HiOutlineEye
                          },
                        ].map((stat, idx) => (
                          <div key={idx} style={{
                            backgroundColor: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexShrink: 0
                          }}>
                            <div style={{
                              color: '#8e8ea0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <stat.Icon size={16} />
                            </div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontFamily: 'system-ui, -apple-system, sans-serif'
                            }}>
                              <span style={{
                                fontSize: '14px',
                                fontWeight: '400',
                                color: '#8e8ea0'
                              }}>
                                {stat.value}
                              </span>
                              <span style={{
                                fontSize: '14px',
                                color: '#8e8ea0',
                                fontWeight: '400'
                              }}>
                                {stat.label}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Main Content Area */}
                      <div style={{
                        backgroundColor: 'white',
                        border: '1px solid rgba(229, 231, 235, 0.6)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                      }}>
                        {/* Toolbar */}
                        <div style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          backgroundColor: 'white',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{
                            position: 'relative',
                            maxWidth: '384px',
                            width: '100%',
                            flex: '0 1 300px'
                          }}>
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '12px',
                              transform: 'translateY(-50%)',
                              pointerEvents: 'none',
                              color: '#9ca3af',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <HiSearch size={16} />
                            </div>
                            <input
                              type="text"
                              style={{
                                display: 'block',
                                width: '100%',
                                paddingLeft: '40px',
                                paddingRight: '12px',
                                paddingTop: '6px',
                                paddingBottom: '6px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                backgroundColor: 'transparent',
                                fontSize: '14px',
                                color: '#353740',
                                outline: 'none',
                                transition: 'all 0.2s',
                                lineHeight: '20px'
                              }}
                              placeholder="Search users..."
                              value={adminSearchQuery}
                              onChange={(e) => setAdminSearchQuery(e.target.value)}
                              onFocus={(e) => {
                                e.target.style.borderColor = '#10a37f';
                                e.target.style.boxShadow = '0 0 0 1px #10a37f';
                              }}
                              onBlur={(e) => {
                                e.target.style.borderColor = '#e5e7eb';
                                e.target.style.boxShadow = 'none';
                              }}
                            />
                          </div>
                          {/* Role Filters */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexShrink: 0,
                            marginLeft: 'auto'
                          }}>
                            {['owner', 'editor', 'viewer'].map((role) => {
                              const roleColors = {
                                owner: {
                                  bg: '#f0f4ff',
                                  border: '#e0e7ff',
                                  text: '#6366f1'
                                },
                                editor: {
                                  bg: '#eff6ff',
                                  border: '#dbeafe',
                                  text: '#2563eb'
                                },
                                viewer: {
                                  bg: '#fffbeb',
                                  border: '#fef3c7',
                                  text: '#d97706'
                                }
                              };
                              
                              const colors = roleColors[role];
                              const isActive = adminRoleFilter === role;
                              
                              return (
                                <button
                                  key={role}
                                  onClick={() => setAdminRoleFilter(adminRoleFilter === role ? null : role)}
                                  style={{
                                    padding: '4px 12px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    color: isActive ? colors.text : '#8e8ea0',
                                    backgroundColor: isActive ? colors.bg : 'transparent',
                                    border: '1px solid',
                                    borderColor: isActive ? colors.border : 'transparent',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textTransform: 'capitalize',
                                    fontFamily: 'system-ui, -apple-system, sans-serif'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isActive) {
                                      e.target.style.backgroundColor = colors.bg;
                                      e.target.style.borderColor = colors.border;
                                      e.target.style.color = colors.text;
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isActive) {
                                      e.target.style.backgroundColor = 'transparent';
                                      e.target.style.borderColor = 'transparent';
                                      e.target.style.color = '#8e8ea0';
                                    }
                                  }}
                                >
                                  {role}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Table */}
                        <div style={{ 
                          overflowX: 'auto',
                          overflowY: 'auto',
                          maxHeight: '350px'
                        }}>
                          <table style={{
                            width: '100%',
                            borderCollapse: 'separate',
                            borderSpacing: 0
                          }}>
                            <thead style={{ backgroundColor: 'rgba(249, 250, 251, 0.5)' }}>
                              <tr>
                                <th style={{
                                  padding: '12px 24px',
                                  textAlign: 'left',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  color: '#6b7280',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}>
                                  User
                                </th>
                                <th style={{
                                  padding: '12px 24px',
                                  textAlign: 'left',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  color: '#6b7280',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}>
                                  Role
                                </th>
                                <th style={{
                                  padding: '12px 24px',
                                  textAlign: 'left',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  color: '#6b7280',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}>
                                  Permissions
                                </th>
                                <th style={{
                                  padding: '12px 24px',
                                  textAlign: 'left',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  color: '#6b7280',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}>
                                  Joined
                                </th>
                                <th style={{
                                  padding: '12px 24px',
                                  textAlign: 'right',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  color: '#6b7280',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}>
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody style={{ backgroundColor: 'white' }}>
                              {adminPanelMembers
                                .filter(member => {
                                  // Search filter
                                  const query = adminSearchQuery.toLowerCase();
                                  const matchesSearch = member.name.toLowerCase().includes(query) || 
                                         member.email.toLowerCase().includes(query);
                                  
                                  // Role filter
                                  const matchesRole = adminRoleFilter === null || member.role === adminRoleFilter;
                                  
                                  return matchesSearch && matchesRole;
                                })
                                .map((member) => {
                                  const activePerms = member.permissions 
                                    ? Object.values(member.permissions).filter(Boolean).length 
                                    : 0;
                                  
                                  return (
                                    <tr 
                                      key={member.email}
                                      style={{
                                        transition: 'background-color 0.2s',
                                        cursor: 'pointer'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#f9fafb';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'white';
                                      }}
                                    >
                                      <td style={{
                                        padding: '14px 24px',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                          {member.profilePic ? (
                                            <img
                                              src={member.profilePic}
                                              alt={member.name}
                                              onError={(e) => {
                                                e.target.style.display = 'none';
                                                const fallback = e.target.nextElementSibling;
                                                if (fallback) fallback.style.display = 'flex';
                                              }}
                                              style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                marginRight: '12px',
                                                display: 'block',
                                                border: '1px solid #e5e7eb'
                                              }}
                                            />
                                          ) : null}
                                          <div
                                            style={{
                                              width: '32px',
                                              height: '32px',
                                              borderRadius: '50%',
                                              backgroundColor: `hsl(${member.email.charCodeAt(0) * 10 % 360}, 60%, 70%)`,
                                              display: member.profilePic ? 'none' : 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: '12px',
                                              fontWeight: '600',
                                              color: 'white',
                                              textTransform: 'uppercase',
                                              marginRight: '12px'
                                            }}
                                          >
                                            {(() => {
                                              // Use firstName and lastName initials only (no email fallback)
                                              const firstInitial = member.firstName && member.firstName.trim() ? member.firstName.trim()[0].toUpperCase() : '';
                                              const lastInitial = member.lastName && member.lastName.trim() ? member.lastName.trim()[0].toUpperCase() : '';
                                              
                                              if (firstInitial && lastInitial) {
                                                return firstInitial + lastInitial;
                                              } else if (firstInitial) {
                                                return firstInitial + firstInitial;
                                              }
                                              return 'U';
                                            })()}
                                          </div>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                              fontSize: '14px',
                                              fontWeight: '500',
                                              color: '#202123',
                                              textAlign: 'left'
                                            }}>
                                              {member.name}
                                            </div>
                                            <div style={{
                                              fontSize: '12px',
                                              color: '#6b7280',
                                              textAlign: 'left'
                                            }}>
                                              {member.email}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td style={{
                                        padding: '14px 24px',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'left'
                                      }}>
                                        <div style={{ position: 'relative', display: 'inline-block' }}>
                                          {member.role === 'owner' ? (
                                            <span style={{
                                              fontSize: '12px',
                                              fontWeight: '500',
                                              padding: '4px 12px',
                                              borderRadius: '8px',
                                              backgroundColor: '#f0f4ff',
                                              border: '1px solid #e0e7ff',
                                              color: '#6366f1',
                                              fontFamily: 'system-ui, -apple-system, sans-serif'
                                            }}>
                                              Owner
                                            </span>
                                          ) : (
                                            <select
                                              value={member.role || 'editor'}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                handleRoleChange(member.email, e.target.value);
                                              }}
                                              style={{
                                                appearance: 'none',
                                                display: 'block',
                                                width: '112px',
                                                paddingLeft: '12px',
                                                paddingRight: '32px',
                                                paddingTop: '4px',
                                                paddingBottom: '4px',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: '500',
                                                border: '1px solid',
                                                backgroundColor: member.role === 'editor' ? '#eff6ff' : '#fffbeb',
                                                borderColor: member.role === 'editor' ? '#dbeafe' : '#fef3c7',
                                                color: member.role === 'editor' ? '#2563eb' : '#d97706',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                outline: 'none',
                                                fontFamily: 'system-ui, -apple-system, sans-serif'
                                              }}
                                              onFocus={(e) => {
                                                e.target.style.boxShadow = '0 0 0 2px rgba(37, 99, 235, 0.2)';
                                              }}
                                              onBlur={(e) => {
                                                e.target.style.boxShadow = 'none';
                                              }}
                                            >
                                              <option value="editor">Editor</option>
                                              <option value="viewer">Viewer</option>
                                            </select>
                                          )}
                                          {member.role !== 'owner' && (
                                            <span style={{
                                              position: 'absolute',
                                              right: '8px',
                                              top: '50%',
                                              transform: 'translateY(-50%)',
                                              pointerEvents: 'none',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center'
                                            }}>
                                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 20 20" style={{ display: 'block' }}>
                                                <path fill={member.role === 'editor' ? '#2563eb' : '#d97706'} d="M10.103 12.778L16.81 6.08a.69.69 0 0 1 .99.012a.726.726 0 0 1-.012 1.012l-7.203 7.193a.69.69 0 0 1-.985-.006L2.205 6.72a.727.727 0 0 1 0-1.01a.69.69 0 0 1 .99 0l6.908 7.068Z"/>
                                              </svg>
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td style={{
                                        padding: '14px 24px',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'left'
                                      }}>
                                        {member.role === 'editor' && member.permissions ? (
                                          <button
                                            onClick={() => {
                                              // Normalize permissions to ensure all keys are present
                                              const normalizedPermissions = {
                                                createHighlights: member.permissions.createHighlights ?? false,
                                                createAnnotations: member.permissions.createAnnotations ?? false,
                                                modifyAnnotations: member.permissions.modifyAnnotations ?? false,
                                                deleteAnnotations: member.permissions.deleteAnnotations ?? false,
                                                share: member.permissions.share ?? false
                                              };
                                              setEditingMember({ ...member, permissions: normalizedPermissions });
                                            }}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px',
                                              fontSize: '14px',
                                              color: '#6b7280',
                                              backgroundColor: 'transparent',
                                              border: 'none',
                                              cursor: 'pointer',
                                              transition: 'color 0.2s',
                                              padding: 0
                                            }}
                                            onMouseEnter={(e) => {
                                              e.target.style.color = '#10a37f';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.target.style.color = '#6b7280';
                                            }}
                                          >
                                            <div style={{ display: 'flex', gap: '2px' }}>
                                              {[...Array(5)].map((_, i) => (
                                                <div
                                                  key={i}
                                                  style={{
                                                    height: '6px',
                                                    width: '6px',
                                                    borderRadius: '50%',
                                                    backgroundColor: i < activePerms ? '#10a37f' : '#e5e7eb'
                                                  }}
                                                />
                                              ))}
                                            </div>
                                            <span style={{
                                              fontSize: '12px',
                                              fontWeight: '500',
                                              textDecoration: 'underline',
                                              textDecorationColor: 'transparent',
                                              transition: 'text-decoration-color 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                              e.target.style.textDecorationColor = '#10a37f';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.target.style.textDecorationColor = 'transparent';
                                            }}
                                            >
                                              Edit
                                            </span>
                                          </button>
                                        ) : (
                                          <span style={{ color: '#9ca3af', fontSize: '14px' }}>—</span>
                                        )}
                                      </td>
                                      <td style={{
                                        padding: '14px 24px',
                                        whiteSpace: 'nowrap',
                                        fontSize: '14px',
                                        color: '#6b7280',
                                        textAlign: 'left'
                                      }}>
                                        {member.joinedDate || '—'}
                                      </td>
                                      <td style={{
                                        padding: '14px 24px',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'right',
                                        fontSize: '14px',
                                        fontWeight: '500'
                                      }}>
                                        <button
                                          onClick={() => {
                                            if (window.confirm('Remove this user from the workspace?')) {
                                              // TODO: Implement delete functionality
                                              showToast('Delete functionality coming soon', 'info');
                                            }
                                          }}
                                          style={{
                                            color: '#9ca3af',
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'color 0.2s',
                                            padding: '4px',
                                            fontSize: '15px'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.target.style.color = '#dc2626';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.target.style.color = '#9ca3af';
                                          }}
                                        >
                                          <HiOutlineTrash size={15} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Permissions Modal */}
                  {editingMember && (
                    <div
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(4px)',
                        WebkitBackdropFilter: 'blur(4px)',
                        zIndex: 10002,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px'
                      }}
                      onClick={() => setEditingMember(null)}
                    >
                      <div
                        style={{
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                          maxWidth: '448px',
                          width: '100%',
                          overflow: 'hidden',
                          border: '1px solid rgba(243, 244, 246, 1)',
                          animation: 'fadeIn 0.2s ease-out',
                          transform: 'scale(0.95)',
                          transition: 'transform 0.2s'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{
                          padding: '20px',
                          borderBottom: '1px solid #f3f4f6',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: 'white'
                        }}>
                          <div>
                            <h3 style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#111827',
                              margin: 0
                            }}>
                              Permissions
                            </h3>
                            <p style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              margin: '2px 0 0 0'
                            }}>
                              Access controls for <span style={{ fontWeight: '500' }}>{editingMember.name}</span>
                            </p>
                          </div>
                          <button
                            onClick={() => setEditingMember(null)}
                            style={{
                              color: '#9ca3af',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'color 0.2s',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.color = '#4b5563';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.color = '#9ca3af';
                            }}
                          >
                            <HiX size={18} />
                          </button>
                        </div>

                        <div style={{
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '20px'
                        }}>
                          {[
                            { key: 'createHighlights', label: 'Create Highlights', desc: 'Can create new text highlights.' },
                            { key: 'createAnnotations', label: 'Create/Modify Annotations', desc: 'Can create and edit annotations.' },
                            { key: 'deleteAnnotations', label: 'Delete Annotations', desc: 'Can remove annotations.' },
                            { key: 'share', label: 'Share', desc: 'Can share projects with others.' }
                          ].map((permission) => (
                            <div key={permission.key} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}>
                              <div style={{
                                textAlign: 'left',
                                flex: 1
                              }}>
                                <p style={{
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  color: '#111827',
                                  margin: 0,
                                  textAlign: 'left'
                                }}>
                                  {permission.label}
                                </p>
                                <p style={{
                                  fontSize: '12px',
                                  color: '#6b7280',
                                  margin: '2px 0 0 0',
                                  textAlign: 'left'
                                }}>
                                  {permission.desc}
                                </p>
                              </div>
                              <button
                                onClick={() => togglePermission(permission.key)}
                                style={{
                                  position: 'relative',
                                  display: 'inline-flex',
                                  height: '20px',
                                  width: '36px',
                                  alignItems: 'center',
                                  borderRadius: '9999px',
                                  transition: 'background-color 0.2s',
                                  outline: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  backgroundColor: editingMember.permissions?.[permission.key] ? '#10a37f' : '#e5e7eb',
                                  boxShadow: '0 0 0 2px transparent',
                                  transition: 'all 0.2s'
                                }}
                                onFocus={(e) => {
                                  e.target.style.boxShadow = '0 0 0 2px rgba(0, 0, 0, 0.1)';
                                }}
                                onBlur={(e) => {
                                  e.target.style.boxShadow = '0 0 0 2px transparent';
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    height: '14px',
                                    width: '14px',
                                    borderRadius: '50%',
                                    backgroundColor: 'white',
                                    transform: editingMember.permissions?.[permission.key] ? 'translateX(16px)' : 'translateX(2px)',
                                    transition: 'transform 0.2s',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                                  }}
                                />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div style={{
                          padding: '12px 20px',
                          backgroundColor: 'rgba(249, 250, 251, 0.5)',
                          borderTop: '1px solid #f3f4f6',
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '8px'
                        }}>
                          <button
                            onClick={() => setEditingMember(null)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'white',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#374151',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = 'white';
                            }}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

               {/* Annotate and Sidebar buttons - always visible */}
               <div style={{
                 position: 'absolute',
                 right: '1.5rem',
                 display: 'flex',
                 gap: '0.5rem',
                 alignItems: 'center'
               }}>
                   <button
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '0.625rem 1rem',
                      fontSize: '0.875rem',
                      color: '#111827',
                      cursor: 'pointer',
                      minWidth: 'auto',
                      display: 'none',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      outline: 'none',
                      fontWeight: '500'
                    }}
                    onClick={() => {
                      if (isLoggedIn) {
                         setIsExtensionSidebarVisible(v => !v)
                         document.getElementById("sidebar-iframe").src = "extension/popup.html";
                       }
                       else
                         showToast("Must be logged in to use extension features", "error");
                     }
                     }
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256">
                       <path fill="currentColor" d="M240 100.68a15.86 15.86 0 0 0-4.69-11.31l-68.68-68.69a16 16 0 0 0-22.63 0l-28.43 28.43l-58 21.77a16.06 16.06 0 0 0-10.22 12.35L24.11 222.68A8 8 0 0 0 32 232a8.4 8.4 0 0 0 1.32-.11l139.44-23.24a16 16 0 0 0 12.35-10.17l21.77-58L235.31 112a15.87 15.87 0 0 0 4.69-11.32Zm-69.87 92.19L55.32 212l47.37-47.37a28 28 0 1 0-11.32-11.32L44 200.7L63.13 85.86L118 65.29L190.7 138ZM104 140a12 12 0 1 1 12 12a12 12 0 0 1-12-12Zm96-15.32L131.31 56l24-24L224 100.68Z"/>
                     </svg>
                     <span style={{ fontWeight: '500' }}>Annotate</span>
                   </button>
                   <button
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '0.625rem 1rem',
                      fontSize: '0.875rem',
                      color: '#111827',
                      cursor: 'pointer',
                      minWidth: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      outline: 'none',
                      fontWeight: '500'
                    }}
                    onClick={() => {
                      setIsCustomSidebarVisible(v => !v);
                    }}
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                       <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                       <line x1="9" y1="3" x2="9" y2="21"></line>
                     </svg>
                     <span style={{ fontWeight: '500' }}>Sidebar</span>
                   </button>
                 </div>
             </div>

          {/* Welcome Screen with Input at Top (shown when no messages) */}

          {/* Welcome Screen with Input at Top (shown when no messages) */}
          {
            messages.length === 0 && (
              <div style={{
                flex: '1 1 0%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '80vh',
                width: '100%',
                maxWidth: '800px',
                margin: '0 auto',
                padding: '0 2rem'
              }}>
                <h1 style={{
                  fontSize: 'clamp(1.875rem, 4vw + 1rem, 2.25rem)',
                  fontWeight: '500',
                  color: '#111827',
                  marginBottom: '2.5rem',
                  letterSpacing: '-0.025em',
                  textAlign: 'center',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }}>
                  How can I help you today?
                </h1>

                {/* Input form at the top when no messages */}
                <div style={{ width: '100%' }}>
                  {/* Typing Indicator - Above Welcome Input */}
                  {typingUsers.length > 0 && (
                    <div className="typing-indicator-container" style={{
                      padding: '0.5rem 0 0.25rem',
                      paddingLeft: '1.5rem',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      marginBottom: '0.5rem',
                      maxWidth: '800px',
                      margin: '0 auto 0.5rem auto'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        fontWeight: 400,
                        lineHeight: '1.4',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>
                          {(() => {
                            // Build user map for display names (uid -> name/email)
                            // Match typing users with projectMembers by email
                            const userMap = {};
                            if (typingUsers.length > 0 && projectMembers && projectMembers.length > 0) {
                              typingUsers.forEach(user => {
                                if (user.email) {
                                  // Find member by email (case-insensitive)
                                  const member = projectMembers.find(m => 
                                    m.email && m.email.toLowerCase() === user.email.toLowerCase()
                                  );
                                  if (member) {
                                    userMap[user.userId] = {
                                      name: member.name || (member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.email),
                                      email: member.email
                                    };
                                  }
                                }
                              });
                            }
                            return formatTypingIndicator(typingUsers, userMap);
                          })()}
                        </span>
                        <span style={{
                          display: 'inline-block',
                          width: '20px',
                          textAlign: 'left',
                          marginLeft: '2px'
                        }}>
                          <span className="typing-dot">.</span>
                          <span className="typing-dot">.</span>
                          <span className="typing-dot">.</span>
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <MessageInput
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    handleSubmit={handleSubmit}
                    isLoading={isLoading}
                    textareaRef={textareaRef}
                    handleImageUpload={handleImageUpload}
                    imagePreview={imagePreview}
                    clearImagePreview={clearImagePreview}
                    isExtensionSidebarVisible={isExtensionSidebarVisible}
                    setIsExtensionSidebarVisible={setIsExtensionSidebarVisible}
                    isSharedView={isSharedView}
                    currentUser={auth.currentUser}
                    projectMembers={projectMembers}
                    isPublicChat={currentChat?.isPublic}
                    recentMentions={recentMentions}
                    conversationId={currentChat?.id}
                    onMentionUsed={handleMentionUsed}
                    currentUserRole={currentUserRole}
                    quotedMessages={quotedMessages}
                    onRemoveQuotedMessage={handleRemoveQuotedMessage}
                    expandedQuotesPreview={expandedQuotesPreview}
                    setExpandedQuotesPreview={setExpandedQuotesPreview}
                  />
                  <p style={{
                    marginTop: '1.5rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: '#9ca3af',
                    fontWeight: '300',
                    letterSpacing: '0.025em',
                    opacity: 0.8
                  }}>
                    Phraze can make mistakes. Consider checking important information.
                  </p>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  maxWidth: '600px',
                  margin: '0 auto',
                  marginTop: '2rem'
                }}>
                  {/* {[
                  'Explain quantum computing',
                  'Write a thank you note',
                  'Debug my Python code',
                  'Plan a vacation'
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setInputValue(suggestion)}
                    style={{
                      padding: '1rem',
                      background: '#f9fafb',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '0.75rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: '#374151',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      ':hover': {
                        background: '#f3f4f6',
                        borderColor: 'rgba(0,0,0,0.2)'
                      }
                    }}
                  >
                    {suggestion}
                  </button>
                ))} */}
                </div>
              </div>
            )
          }


          {/* Chat Messages */}
          <div
            id="chatMessagesDiv"
            data-cursor-container="chat"
            key={currentChat ? currentChat.id : 'new-chat'}
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              background: 'rgb(249, 248, 246)'
            }}
            ref={chatMessagesContainerRef}
          >
            <div
              id="chatCanvas"
              data-canvas-scale={chatCanvasScale}
              style={{
                width: `${CHAT_CANVAS_WIDTH}px`,
                margin: '0 auto',
                padding: '10px 0 2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                zoom: chatCanvasScale,
                transformOrigin: 'top center'
              }}
            >
              {messages.map((message, index) => (
                                <div
                    key={message?.messageId || message?.id || index}
                    data-cursor-anchor-id={(message?.messageId || message?.id) ? String(message.messageId || message.id) : undefined}
                    style={{
                      padding: '0 1rem',
                      maxWidth: `${800}px`,
                      margin: '0 auto',
                      width: '100%',
                      display: 'flex',
                      justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                      position: 'relative'
                    }}
                  >
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  maxWidth: '85%',
                  paddingLeft: message.role === 'user' ? '0' : '0'
                }}>
                  {/* Username display with profile icon */}
                  {(() => {
                    // Helper to normalize email for comparison
                    const normalizeEmail = (email) => email?.toLowerCase().replace(/\./g, ',');
                    
                    // Find sender member if message has senderEmail
                    const senderEmailNormalized = message.senderEmail ? normalizeEmail(message.senderEmail) : null;
                    const senderMember = senderEmailNormalized 
                      ? projectMembers.find(m => normalizeEmail(m.email) === senderEmailNormalized)
                      : null;
                    
                    // Get profile picture and name - prioritize projectMembers, then cache, then message data
                    let senderProfilePic = null;
                    let senderName = message.userDisplayName || 'User';
                    let senderFirstName = null;
                    let senderLastName = null;
                    
                    if (senderMember) {
                      // For public chats - use projectMembers data
                      senderProfilePic = senderMember.profilePic || null;
                      senderName = senderMember.name || message.userDisplayName || 'User';
                      senderFirstName = senderMember.firstName || null;
                      senderLastName = senderMember.lastName || null;
                    } else if (message.senderEmail) {
                      // For private chats - use cached profile data
                      const cachedProfile = messageSenderProfiles.get(message.senderEmail);
                      if (cachedProfile) {
                        senderProfilePic = cachedProfile.profilePic || null;
                        senderName = cachedProfile.name || message.userDisplayName || 'User';
                        senderFirstName = cachedProfile.firstName || null;
                        senderLastName = cachedProfile.lastName || null;
                      }
                    }
                    
                    return (
                  <div style={{ 
                    fontSize: '0.8rem', 
                    marginBottom: '8px', 
                    fontWeight: '500',
                    color: '#555',
                    textAlign: message.role === 'user' ? 'right' : 'left',
                    paddingRight: message.role === 'user' ? '0' : '0rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    {message.role === 'user' && (
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: '#e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        fontWeight: '600',
                        color: '#334155',
                            border: '1px solid #cbd5e1',
                            overflow: 'hidden',
                            position: 'relative'
                      }}>
                            {senderProfilePic ? (
                              <img
                                src={senderProfilePic}
                                alt={senderName}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              getUserInitialsFromName(senderFirstName, senderLastName, message.senderEmail?.split('@')[0] || senderName)
                            )}
                      </div>
                    )}
                        <span>{message.role === 'user' ? senderName : 'Phraze'}</span>
                    {message.role === 'assistant' && (
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        fontWeight: '600',
                        color: 'white',
                        border: '1px solid #475569'
                      }}>
                        P
                      </div>
                    )}
                  </div>
                    );
                  })()}
                                     <div
                     className="message-bubble"
                     style={{
                       padding: message.role === 'user' ? '1rem': '0rem',
                       background: message.role === 'user' ? '#ffffff' : 'transparent',
                       borderRadius: message.role === 'user' ? '2rem' : '0.5rem',
                       borderBottomRightRadius: message.role === 'user' ? '5px' : '0.5rem',
                       color: '#0A0A0A',
                       display: 'inline-block',
                       width: '100%',
                       position: 'relative',
                       marginTop: '4px'
                     }}
                   >
                  {/* Edit Mode for User Messages */}
                  {message.role === 'user' && editingMessageIndex === index ? (
                    <div style={{
                      position: 'relative',
                      width: '100%' // Ensure the container takes full width of parent
                    }}>
                      <textarea
                        ref={editTextareaRef}
                        value={editingMessageContent}
                        onChange={(e) => setEditingMessageContent(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          lineHeight: '1.5',
                          resize: 'none',
                          outline: 'none',
                          fontFamily: 'inherit',
                          backgroundColor: '#f9f9f9',
                          boxSizing: 'border-box' // Ensure padding is included in width calculation
                        }}

                        disabled={!auth.currentUser}
                        rows={1}
                      />
                      <div style={{
                        marginTop: '0.5rem',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '0.5rem'
                      }}>
                        <button
                          onClick={handleCancelEditing}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: 'rgb(235, 235, 235)',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(index)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: 'rgb(235, 235, 235)',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            color: 'black',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}
                        >
                          Save & Update
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Message Content with Image Support */}
                      <div
                        id={"message-content" + index}
                        ref={(el) => setMessageRef(index, el)}
                        style={{
                          fontSize: '1rem',
                          lineHeight: '1.5',
                          whiteSpace: message.role === 'assistant' ? 'normal' : 'pre-wrap'
                        }}>
                        {/* Display quoted messages if present */}
                        {(() => {
                          // Support both old single quotedMessage and new quotedMessages array
                          const quotes = message.quotedMessages || (message.quotedMessage ? [message.quotedMessage] : []);
                          
                          if (quotes.length === 0) return null;
                          
                          // Use state to track expanded state per message
                          const expandedKey = `expanded-quotes-${index}`;
                          const isExpanded = expandedQuotesInMessages.has(expandedKey);
                          
                          return (
                            <div style={{
                              marginBottom: message.content ? '0.75rem' : 0,
                              padding: '0',
                              borderRadius: '8px',
                              overflow: 'visible'
                            }}>
                              {/* First quoted message (always visible) */}
                              {quotes[0] && (
                                <div style={{
                                  padding: '10px 12px',
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid rgba(0, 0, 0, 0.05)',
                                  borderRadius: '8px',
                                  borderLeft: '3px solid rgba(0, 0, 0, 0.1)',
                                  fontSize: '0.8125rem',
                                  color: 'rgba(0, 0, 0, 0.7)',
                                  marginBottom: isExpanded && quotes.length > 1 ? '6px' : '0'
                                }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '4px'
                                  }}>
                                    <div style={{
                                      fontSize: '0.75rem',
                                      fontWeight: '500',
                                      color: 'rgba(0, 0, 0, 0.5)',
                                      lineHeight: '1.3'
                                    }}>
                                      {quotes[0].role === 'user' ? (quotes[0].userDisplayName || 'You') : 'Phraze'}
                                    </div>
                                    {quotes.length > 1 && !isExpanded && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedQuotesInMessages(prev => {
                                            const newSet = new Set(prev);
                                            newSet.add(expandedKey);
                                            return newSet;
                                          });
                                        }}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          cursor: 'pointer',
                                          padding: '0',
                                          color: 'rgba(0, 0, 0, 0.4)',
                                          fontSize: '0.75rem',
                                          fontWeight: '400',
                                          textDecoration: 'underline',
                                          transition: 'color 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.color = 'rgba(0, 0, 0, 0.6)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.color = 'rgba(0, 0, 0, 0.4)';
                                        }}
                                      >
                                        +{quotes.length - 1} more
                                      </button>
                                    )}
                                  </div>
                                  <div style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: isExpanded ? 'block' : '-webkit-box',
                                    WebkitLineClamp: isExpanded ? 'none' : 2,
                                    WebkitBoxOrient: isExpanded ? 'horizontal' : 'vertical',
                                    lineHeight: '1.4',
                                    color: 'rgba(0, 0, 0, 0.7)',
                                    fontWeight: '400'
                                  }}>
                                    <QuotedMessageContent quote={quotes[0]} isPreview={false} />
                                  </div>
                                </div>
                              )}
                              
                              {/* Additional quoted messages */}
                              {quotes.length > 1 && isExpanded && (
                                <>
                                  {quotes.slice(1).map((quote, idx) => (
                                    <div key={idx} style={{
                                      padding: '10px 12px',
                                      marginTop: '6px',
                                      border: '1px solid rgba(0, 0, 0, 0.05)',
                                      borderRadius: '8px',
                                      backgroundColor: '#f8fafc',
                                      borderLeft: '3px solid rgba(0, 0, 0, 0.1)',
                                      fontSize: '0.8125rem',
                                      color: 'rgba(0, 0, 0, 0.7)'
                                    }}>
                                      <div style={{
                                        fontSize: '0.75rem',
                                        fontWeight: '500',
                                        color: 'rgba(0, 0, 0, 0.5)',
                                        marginBottom: '4px',
                                        lineHeight: '1.3'
                                      }}>
                                        {quote.role === 'user' ? (quote.userDisplayName || 'You') : 'Phraze'}
                                      </div>
                                      <div style={{
                                        lineHeight: '1.4',
                                        wordBreak: 'break-word',
                                        color: 'rgba(0, 0, 0, 0.7)',
                                        fontWeight: '400'
                                      }}>
                                        <QuotedMessageContent quote={quote} isPreview={false} />
                                      </div>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => {
                                      setExpandedQuotesInMessages(prev => {
                                        const newSet = new Set(prev);
                                        newSet.delete(expandedKey);
                                        return newSet;
                                      });
                                    }}
                                    style={{
                                      marginTop: '6px',
                                      padding: '4px 8px',
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: 'rgba(0, 0, 0, 0.4)',
                                      fontSize: '0.75rem',
                                      fontWeight: '400',
                                      textDecoration: 'underline',
                                      transition: 'color 0.2s',
                                      alignSelf: 'flex-start'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.6)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.4)';
                                    }}
                                  >
                                    Show less
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })()}
                        {/* Display image if present */}
                        {message.imageUrl && (
                          <div style={{ marginBottom: message.content ? '0.75rem' : 0 }}>
                            <img
                              src={message.imageUrl}
                              alt="User uploaded"
                              style={{
                                maxWidth: '100%',
                                borderRadius: '0.5rem',
                                maxHeight: '300px'
                              }}
                            />
                          </div>
                        )}
                        {/* Display text content */}
                        {message.content}
                      </div>

                      {/* Edit and Copy buttons for user messages */}
                      {message.role === 'user' && !editingMessageIndex && (
                        <div
                          className="message-actions"
                          style={{
                            position: 'absolute',
                            left: '-120px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            display: 'flex',
                            gap: '8px',
                            opacity: 0,
                            transition: 'opacity 0.2s'
                          }}
                        >
                          <button
                            onClick={() => handleCopyMessage(message.content, index)}
                            style={{
                              background: 'rgba(240, 240, 240, 0.8)',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.5rem',
                              borderRadius: '50%',
                              color: '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px'
                            }}
                            title="Copy message"
                          >
                            {copiedMessages.has(index) ? (
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                <polyline points="20,6 9,17 4,12"></polyline>
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleStartEditing(index, message.content)}
                            style={{
                              background: 'rgba(240, 240, 240, 0.8)',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.5rem',
                              borderRadius: '50%',
                              color: '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px'
                            }}
                            title="Edit message"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleQuoteMessage(message, index, e)}
                            style={{
                              background: isMultiSelectMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(240, 240, 240, 0.8)',
                              border: isMultiSelectMode ? '1px solid #3b82f6' : 'none',
                              cursor: 'pointer',
                              padding: '0.5rem',
                              borderRadius: '50%',
                              color: isMultiSelectMode ? '#3b82f6' : '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px',
                              transition: 'all 0.2s'
                            }}
                            title={isMultiSelectMode ? "Quote message (multi-select mode)" : "Quote message (hold Shift for multi-select)"}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
                              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* AI action buttons for assistant messages */}
                      {message.role === 'assistant' && !editingMessageIndex && (
                        <div
                          className="ai-message-actions"
                          style={{
                            marginTop: '8px',
                            display: 'flex',
                            gap: '8px',
                            opacity: 1,
                            justifyContent: 'flex-start'
                          }}
                        >
                          <button
                            onClick={() => handleCopyMessage(message.content, index)}
                            style={{
                              background: 'rgba(240, 240, 240, 0.8)',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.5rem',
                              borderRadius: '50%',
                              color: '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px'
                            }}
                            title="Copy message"
                          >
                            {copiedMessages.has(index) ? (
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                <polyline points="20,6 9,17 4,12"></polyline>
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={(e) => handleQuoteMessage(message, index, e)}
                            style={{
                              background: isMultiSelectMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(240, 240, 240, 0.8)',
                              border: isMultiSelectMode ? '1px solid #3b82f6' : 'none',
                              cursor: 'pointer',
                              padding: '0.5rem',
                              borderRadius: '50%',
                              color: isMultiSelectMode ? '#3b82f6' : '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px',
                              transition: 'all 0.2s'
                            }}
                            title={isMultiSelectMode ? "Quote message (multi-select mode)" : "Quote message (hold Shift for multi-select)"}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
                              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
                            </svg>
                          </button>
                          <div style={{ position: 'relative' }} className="try-again-dropdown-container">
                            <button
                              onClick={() => setTryAgainDropdownOpen(tryAgainDropdownOpen === index ? null : index)}
                              style={{
                                background: 'rgba(240, 240, 240, 0.8)',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0.5rem',
                                borderRadius: '50%',
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px'
                              }}
                              title="Try again options"
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                              </svg>
                            </button>
                            
                            {tryAgainDropdownOpen === index && (
                              <div 
                                style={{
                                  position: 'absolute',
                                  left: '0',
                                  background: 'white',
                                  border: '1px solid rgba(0,0,0,0.08)',
                                  borderRadius: '12px',
                                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                  overflow: 'hidden',
                                  zIndex: 1001,
                                  backdropFilter: 'blur(8px)',
                                  WebkitBackdropFilter: 'blur(8px)',
                                  width: '200px',
                                  animation: 'fadeIn 0.2s ease-out'
                                }}
                                ref={(el) => {
                                  if (el) {
                                    // Get the button element (previous sibling)
                                    const button = el.previousElementSibling;
                                    if (button) {
                                      const buttonRect = button.getBoundingClientRect();
                                      const dropdownHeight = 240; // Height for 4 items (60px each)
                                      const viewportHeight = window.innerHeight;
                                      const spaceBelow = viewportHeight - buttonRect.bottom;
                                      const spaceAbove = buttonRect.top;
                                      
                                      // Check if there's enough space below
                                      if (spaceBelow < dropdownHeight + 30) { // 30px buffer
                                        // Position above button if there's space above
                                        if (spaceAbove > dropdownHeight + 30) {
                                          el.style.bottom = '100%';
                                          el.style.top = 'auto';
                                          el.style.marginBottom = '0.5rem';
                                          el.style.marginTop = '0';
                                          el.style.maxHeight = 'none';
                                          el.style.overflowY = 'visible';
                                        } else {
                                          // If not enough space above or below, position to fit in viewport
                                          const availableSpace = Math.max(spaceBelow, spaceAbove);
                                          if (availableSpace === spaceBelow) {
                                            // Position below but constrain height
                                            el.style.top = '100%';
                                            el.style.bottom = 'auto';
                                            el.style.marginTop = '0.5rem';
                                            el.style.marginBottom = '0';
                                            el.style.maxHeight = `${spaceBelow - 30}px`;
                                            el.style.overflowY = 'auto';
                                          } else {
                                            // Position above but constrain height
                                            el.style.bottom = '100%';
                                            el.style.top = 'auto';
                                            el.style.marginBottom = '0.5rem';
                                            el.style.marginTop = '0';
                                            el.style.maxHeight = `${spaceAbove - 30}px`;
                                            el.style.overflowY = 'auto';
                                          }
                                        }
                                      } else {
                                        // Position below button (default - enough space)
                                        el.style.top = '100%';
                                        el.style.bottom = 'auto';
                                        el.style.marginTop = '0.5rem';
                                        el.style.marginBottom = '0';
                                        el.style.maxHeight = 'none';
                                        el.style.overflowY = 'visible';
                                      }
                                    }
                                  }
                                }}
                              >
                                <button
                                  onClick={() => handleTryAgainAction(index, 'try_again')}
                                  style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    color: '#334155'
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                    <polyline points="23 4 23 10 17 10"></polyline>
                                    <polyline points="1 20 1 14 7 14"></polyline>
                                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                                  </svg>
                                  Try again
                                </button>
                                
                                <button
                                  onClick={() => handleTryAgainAction(index, 'add_details')}
                                  style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    color: '#334155'
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
                                  </svg>
                                  Add details
                                </button>
                                
                                <button
                                  onClick={() => handleTryAgainAction(index, 'more_concise')}
                                  style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    color: '#334155'
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                    <path d="M8 9h8m-8 4h6"></path>
                                  </svg>
                                  More concise
                                </button>
                                
                                <button
                                  onClick={() => handleBranchChat(index)}
                                  style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    color: '#334155'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = '#f8fafc';
                                    e.target.style.color = '#1e293b';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'transparent';
                                    e.target.style.color = '#334155';
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                    <path d="M6 3v12"></path>
                                    <circle cx="18" cy="6" r="3"></circle>
                                    <circle cx="18" cy="18" r="3"></circle>
                                    <path d="M18 9a9 9 0 0 1-9 9"></path>
                                  </svg>
                                  Branch in new chat
                                </button>
                                
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  </div>
                </div>
              </div>
            ))}


            {isLoading && (
              <div style={{
                padding: '0 1rem',
                maxWidth: '800px',
                margin: '0 auto',
                width: '100%'
              }}>
                <div style={{
                  padding: '1rem',
                  background: 'transparent',
                  borderRadius: '0.5rem',
                  color: '#0A0A0A',
                  display: 'inline-block'
                }}>
                  <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Branch Label - Horizontal Line at Bottom */}
            {currentChat?.branchedFrom && (
              <div style={{
                padding: '2rem 0 1rem',
                maxWidth: '800px',
                margin: '0 auto',
                width: '100%'
              }}>
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: '#d1d5db',
                    transform: 'translateY(-50%)'
                  }}></div>
                  <span style={{
                    backgroundColor: 'rgb(249, 248, 246)',
                    padding: '0 1rem',
                    fontSize: '0.875rem',
                    color: '#9ca3af',
                    fontStyle: 'italic',
                    position: 'relative',
                    zIndex: 1
                  }}>
                    Branch - {currentChat.branchedFrom.chatTitle}
                  </span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          </div>

          {/* Typing Indicator - Above Input Area */}
          {typingUsers.length > 0 && (
            <div className="typing-indicator-container" style={{
              padding: '0.5rem 1rem 0.25rem',
              paddingLeft: '1.5rem',
              maxWidth: '800px',
              margin: '0 auto',
              width: '100%',
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                fontWeight: 400,
                lineHeight: '1.4',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>
                  {(() => {
                    // Build user map for display names (uid -> name/email)
                    // Look up emails from Users node and match with projectMembers
                    const userMap = {};
                    if (typingUsers.length > 0 && projectMembers && projectMembers.length > 0) {
                      // Create email -> member map for quick lookup
                      const emailToMember = new Map();
                      projectMembers.forEach(member => {
                        if (member.email) {
                          emailToMember.set(member.email.toLowerCase(), member);
                        }
                      });
                      
                      // For each typing user, match by email (now stored in typing node)
                      typingUsers.forEach(user => {
                        if (user.email) {
                          const member = emailToMember.get(user.email.toLowerCase());
                          if (member) {
                            userMap[user.userId] = {
                              name: member.name || (member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.email),
                              email: member.email
                            };
                          } else {
                            // Fallback: use email as name if member not found
                            userMap[user.userId] = {
                              name: user.email,
                              email: user.email
                            };
                          }
                        } else {
                          // Fallback: use uid if no email available
                          userMap[user.userId] = {
                            name: user.userId,
                            email: null
                          };
                        }
                      });
                    }
                    return formatTypingIndicator(typingUsers, userMap);
                  })()}
                </span>
                <span style={{
                  display: 'inline-block',
                  width: '20px',
                  textAlign: 'left',
                  marginLeft: '2px'
                }}>
                  <span className="typing-dot typing-dot-1">.</span>
                  <span className="typing-dot typing-dot-2">.</span>
                  <span className="typing-dot typing-dot-3">.</span>
                </span>
              </div>
            </div>
          )}

          {/* Input Area at Bottom (only shown when there are messages) */}
          {
            messages.length > 0 && (
              <div
                id="groqChatInputDiv"
                style={{
                  padding: '1.5rem',
                  background: 'rgb(249, 248, 246)'
                }}>
                <MessageInput
                  inputValue={inputValue}
                  setInputValue={setInputValue}
                  handleSubmit={handleSubmit}
                  isLoading={isLoading}
                  textareaRef={textareaRef}
                  handleImageUpload={handleImageUpload}
                  imagePreview={imagePreview}
                  clearImagePreview={clearImagePreview}
                  isExtensionSidebarVisible={isExtensionSidebarVisible}
                  setIsExtensionSidebarVisible={setIsExtensionSidebarVisible}
                  isSharedView={isSharedView}
                  currentUser={auth.currentUser}
                  projectMembers={projectMembers}
                  isPublicChat={currentChat?.isPublic}
                  recentMentions={recentMentions}
                  conversationId={currentChat?.id}
                  onMentionUsed={handleMentionUsed}
                  currentUserRole={currentUserRole}
                  messages={messages}
                  quotedMessages={quotedMessages}
                  onRemoveQuotedMessage={handleRemoveQuotedMessage}
                  expandedQuotesPreview={expandedQuotesPreview}
                  setExpandedQuotesPreview={setExpandedQuotesPreview}
                />
                <DisclaimerMessage />
              </div>
            )
          }
        </main>

        {
          isLibraryVisible && (
            <div
              id="library-div"
              style={{
                flex: "1 1 0%",
                background: "rgb(249, 248, 246)",
                position: "relative",
                overflowX: "hidden",
                overflowY: "auto",
                marginTop: "70px"
              }}></div>
          )
        }

        <img id="img-fullscreen"
          onClick={
            function () {
              document.getElementById("img-fullscreen").style.display = "none";
            }
          }
          style={{ display: "none", background: "#000000aa", objectFit: "contain", position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh", zIndex: 9999, cursor: "pointer" }}>
        </img>

        <div id="sidebar-overlay"
          style={{ display: "none", position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh", zIndex: 9999, cursor: "ew-resize" }}>
        </div>
        {
          !isInsideExtension && (
            <div style={{ display: 'flex', flexDirection: 'row' }}>



              
              <div id="sidebar-resizer" style={{ 
  display: isExtensionSidebarVisible ? 'flex' : 'none', 
  width: "4px", 
  height: 'calc(100% - 67px)', 
  marginTop: '67px', 
  cursor: 'ew-resize', 
  backgroundColor: 'rgba(0, 0, 0, 0.05)',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)'
}} onMouseEnter={(e) => {
  if (!e.target.classList.contains('dragging')) {
    e.target.style.width = '8px';
    e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    e.target.style.backdropFilter = 'blur(12px)';
  }
}} onMouseLeave={(e) => {
  if (!e.target.classList.contains('dragging')) {
    e.target.style.width = '4px';
    e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
    e.target.style.backdropFilter = 'blur(8px)';
  }
}} onMouseDown={(e) => {
  e.target.classList.add('dragging');
  e.target.style.width = '8px';
  e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.15)';
  e.target.style.backdropFilter = 'blur(16px)';
}} onMouseUp={(e) => {
  e.target.classList.remove('dragging');
  e.target.style.width = '8px';
  e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
  e.target.style.backdropFilter = 'blur(12px)';
}}>
  <div style={{
    width: '2px',
    height: '60px',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: '1px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative'
  }} onMouseEnter={(e) => {
    if (!e.target.parentElement.classList.contains('dragging')) {
      e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      e.target.style.transform = 'scaleY(1.2)';
      e.target.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.2)';
    }
  }} onMouseLeave={(e) => {
    if (!e.target.parentElement.classList.contains('dragging')) {
      e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
      e.target.style.transform = 'scaleY(1)';
      e.target.style.boxShadow = 'none';
    }
  }}>
  </div>
</div>

              <iframe 
                id="sidebar-iframe" 
                allow="display-capture" 
                style={{ display: isExtensionSidebarVisible ? 'block' : 'none', borderRight: 0, width: sidebarWidth + 'px', height: '100%', backgroundColor: 'white' }}
                onLoad={() => {
                  if (isExtensionSidebarVisible) {
                    const iframe = document.getElementById('sidebar-iframe');
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    
                    // Create section container
                    const sectionContainer = iframeDoc.createElement('div');
                    sectionContainer.style.cssText = `
                      display: flex;
                      flex-direction: row;
                      width: 100%;
                      height: 65px;
                      gap: 0;
                      box-sizing: border-box;
                      position: relative;
                      background: #fafafa;
                      border: 1px solid #f0f0f0;
                      border-radius: 12px;
                      margin: 3px;
                      padding: 3px;
                    `;
                    
                    // Extension section
                    const extensionSection = iframeDoc.createElement('div');
                    extensionSection.innerHTML = `
                      <div style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="margin-right: 12px; color: #6b7280;">
                          <path fill="currentColor" d="M240 100.68a15.86 15.86 0 0 0-4.69-11.31l-68.68-68.69a16 16 0 0 0-22.63 0l-28.43 28.43l-58 21.77a16.06 16.06 0 0 0-10.22 12.35L24.11 222.68A8 8 0 0 0 32 232a8.4 8.4 0 0 0 1.32-.11l139.44-23.24a16 16 0 0 0 12.35-10.17l21.77-58L235.31 112a15.87 15.87 0 0 0 4.69-11.32Zm-69.87 92.19L55.32 212l47.37-47.37a28 28 0 1 0-11.32-11.32L44 200.7L63.13 85.86L118 65.29L190.7 138ZM104 140a12 12 0 1 1 12 12a12 12 0 0 1-12-12Zm96-15.32L131.31 56l24-24L224 100.68Z"/>
                        </svg>
                        <span style="font-size: 14px; font-weight: 600; color: #1f2937; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.01em;">Annotate</span>
                      </div>
                    `;
                    extensionSection.style.cssText = `
                      flex: 1;
                      background: #fefefe;
                      border-right: 1px solid #f0f0f0;
                      cursor: pointer;
                      transition: all 0.15s ease;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      position: relative;
                      border-radius: 8px;
                      margin: 3px;
                    `;
                    extensionSection.onmouseenter = () => {
                      // Only change background if not active
                      if (!extensionSection.classList.contains('active')) {
                        extensionSection.style.background = '#f8f8f8';
                      }
                    };
                    extensionSection.onmouseleave = () => {
                      // Only change background if not active
                      if (!extensionSection.classList.contains('active')) {
                        extensionSection.style.background = '#fefefe';
                      }
                    };
                    extensionSection.onclick = () => {
                      console.log("Extension section clicked");
                      
                                   // Remove active state from Messages section and reset its background
             messagesSection.classList.remove('active');
             messagesSection.style.background = '#fefefe';
                      
                                   // Add active state to Extension section
             extensionSection.classList.add('active');
             extensionSection.style.background = '#f2f2f2';
                      
                      // Find and click the back-messaging button in the extension
                      const backButton = iframeDoc.getElementById('Back-messaging');
                      if (backButton) {
                        backButton.click();
                      } else {
                        console.log("Back-messaging button not found in extension");
                      }
                    };
                    
                    // Messages section
                    const messagesSection = iframeDoc.createElement('div');
                    messagesSection.innerHTML = `
                      <div style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style="margin-right: 12px; color: #6b7280;">
                          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                        </svg>
                        <span style="font-size: 14px; font-weight: 600; color: #1f2937; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.01em;">Messages</span>
                      </div>
                    `;
                    messagesSection.style.cssText = `
                      flex: 1;
                      background: #fefefe;
                      cursor: pointer;
                      transition: all 0.15s ease;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      position: relative;
                      border-radius: 8px;
                      margin: 3px;
                    `;
                    messagesSection.onmouseenter = () => {
                      // Only change background if not active
                      if (!messagesSection.classList.contains('active')) {
                        messagesSection.style.background = '#f8f8f8';
                      }
                    };
                    messagesSection.onmouseleave = () => {
                      // Only change background if not active
                      if (!messagesSection.classList.contains('active')) {
                        messagesSection.style.background = '#fefefe';
                      }
                    };
                    messagesSection.onclick = (e) => {
                      // Check if messaging tab is disabled using both attribute and iframe function
                      const iframe = document.getElementById('sidebar-iframe');
                      const isDisabledViaFunction = iframe && iframe.contentWindow && typeof iframe.contentWindow.isMessagingTabDisabled === 'function' && iframe.contentWindow.isMessagingTabDisabled();
                      const isDisabledViaAttribute = messagesSection.getAttribute('data-disabled') === 'true';
                      
                      if (isDisabledViaAttribute || isDisabledViaFunction) {
                        console.log("Messages section is disabled - click prevented", { isDisabledViaAttribute, isDisabledViaFunction });
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      
                      console.log("Messages section clicked");
                      
                                   // Remove active state from Extension section and reset its background
             extensionSection.classList.remove('active');
             extensionSection.style.background = '#fefefe';
                      
                                   // Add active state to Messages section
             messagesSection.classList.add('active');
             messagesSection.style.background = '#f2f2f2';
                      
                      // Find and click the messaging button in the extension
                      const messagingButton = iframeDoc.getElementById('Messaging');
                      if (messagingButton) {
                        messagingButton.click();
                      } else {
                        console.log("Messaging button not found in extension");
                      }
                    };
                    
                    // Create tooltip element for messaging tab
                    const messagingTooltip = iframeDoc.createElement('div');
                    messagingTooltip.id = 'messaging-tooltip';
                    messagingTooltip.style.cssText = `
                      position: absolute;
                      bottom: 100%;
                      left: 50%;
                      transform: translateX(-50%);
                      background: #1f2937;
                      color: white;
                      padding: 8px 12px;
                      border-radius: 6px;
                      font-size: 12px;
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                      white-space: nowrap;
                      opacity: 0;
                      visibility: hidden;
                      transition: opacity 0.2s ease, visibility 0.2s ease;
                      z-index: 1000;
                      margin-bottom: 8px;
                      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    `;
                    
                    // Add text span to tooltip
                    const tooltipText = iframeDoc.createElement('span');
                    tooltipText.id = 'messaging-tooltip-text';
                    messagingTooltip.appendChild(tooltipText);
                    
                    // Add arrow to tooltip
                    const tooltipArrow = iframeDoc.createElement('div');
                    tooltipArrow.style.cssText = `
                      position: absolute;
                      top: 100%;
                      left: 50%;
                      transform: translateX(-50%);
                      border-width: 6px;
                      border-style: solid;
                      border-color: #1f2937 transparent transparent transparent;
                    `;
                    messagingTooltip.appendChild(tooltipArrow);
                    messagesSection.appendChild(messagingTooltip);
                    
                    // Track disabled state in a variable for reliable access
                    let isMessagingDisabled = false;
                    
                    // Store getter for disabled state on iframe.contentWindow
                    iframe.contentWindow.isMessagingTabDisabled = () => isMessagingDisabled;
                    
                    // Function to update messaging tab state based on chat privacy and member count
                    const updateMessagingTabState = (isPublic, memberCount = 0) => {
                      const isPrivate = isPublic === false;
                      const hasOnlyOneMember = memberCount <= 1;
                      const shouldDisable = isPrivate || hasOnlyOneMember;
                      
                      console.log('updateMessagingTabState called:', 'isPublic=' + isPublic, 'memberCount=' + memberCount, 'isPrivate=' + isPrivate, 'hasOnlyOneMember=' + hasOnlyOneMember, 'shouldDisable=' + shouldDisable);
                      
                      // Update the shared disabled state variable
                      isMessagingDisabled = shouldDisable;
                      
                      if (shouldDisable) {
                        // Disable the messaging tab
                        messagesSection.style.opacity = '0.5';
                        messagesSection.style.cursor = 'not-allowed';
                        messagesSection.setAttribute('data-disabled', 'true');
                        
                        // Set tooltip message based on reason
                        let tooltipMessage = '';
                        if (isPrivate) {
                          tooltipMessage = 'You can only send messages for public chats';
                        } else if (hasOnlyOneMember) {
                          tooltipMessage = 'You can only send messages when the project has multiple members';
                        }
                        const tooltipTextEl = iframeDoc.getElementById('messaging-tooltip-text');
                        if (tooltipTextEl) {
                          tooltipTextEl.textContent = tooltipMessage;
                        }
                        
                        // Update hover handlers for disabled state
                        messagesSection.onmouseenter = () => {
                          messagingTooltip.style.opacity = '1';
                          messagingTooltip.style.visibility = 'visible';
                        };
                        messagesSection.onmouseleave = () => {
                          messagingTooltip.style.opacity = '0';
                          messagingTooltip.style.visibility = 'hidden';
                        };
                        
                        // If currently on Messaging tab, switch to Annotation tab
                        if (messagesSection.classList.contains('active')) {
                          console.log('Messaging tab is active but disabled - switching to Annotation tab');
                          
                          // Remove active state from Messages section
                          messagesSection.classList.remove('active');
                          messagesSection.style.background = '#fefefe';
                          
                          // Add active state to Extension section
                          extensionSection.classList.add('active');
                          extensionSection.style.background = '#f2f2f2';
                          
                          // Click the back-messaging button to return to annotation view
                          const backButton = iframeDoc.getElementById('Back-messaging');
                          if (backButton) {
                            backButton.click();
                          }
                        }
                      } else {
                        // Enable the messaging tab
                        messagesSection.style.opacity = '1';
                        messagesSection.style.cursor = 'pointer';
                        messagesSection.removeAttribute('data-disabled');
                        
                        // Hide tooltip
                        messagingTooltip.style.opacity = '0';
                        messagingTooltip.style.visibility = 'hidden';
                        
                        // Restore normal hover handlers
                        messagesSection.onmouseenter = () => {
                          if (!messagesSection.classList.contains('active')) {
                            messagesSection.style.background = '#f8f8f8';
                          }
                        };
                        messagesSection.onmouseleave = () => {
                          if (!messagesSection.classList.contains('active')) {
                            messagesSection.style.background = '#fefefe';
                          }
                        };
                      }
                    };
                    
                    // Store the function on iframe.contentWindow for external access
                    iframe.contentWindow.updateMessagingTabState = updateMessagingTabState;
                    
                    // Set Extension as default active section
                    extensionSection.classList.add('active');
                    extensionSection.style.background = '#e5e7eb';
                    
                    // Add sections to container
                    sectionContainer.appendChild(extensionSection);
                    sectionContainer.appendChild(messagesSection);
                    
                    // Insert at the top of the iframe body
                    if (iframeDoc.body) {
                      iframeDoc.body.insertBefore(sectionContainer, iframeDoc.body.firstChild);
                    }
                    
                    // Initialize messaging tab state immediately after creation
                    // This ensures the tab is properly disabled/enabled on first load
                    setTimeout(() => {
                      const isPublic = currentChat ? currentChat.isPublic : true;
                      updateMessagingTabState(isPublic, projectMemberCount);
                    }, 100);
                    
                    // Update the current topic in the extension when iframe loads
                    if (currentChat && !currentChat.isShared) {
                      setTimeout(() => {
                        iframe.contentWindow.postMessage({
                          action: "updateMessagingTopic",
                          chatId: currentChat.id,
                          chatTitle: currentChat.title
                        }, "*");
                      }, 1000); // Small delay to ensure extension is fully loaded
                    }
                  }
                }}
              >
              </iframe>
            </div>
          )
        }

        {/* Custom Sidebar */}
        {
          !isInsideExtension && (
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              <div id="custom-sidebar-resizer" style={{ 
                display: isCustomSidebarVisible ? 'flex' : 'none', 
                width: "3px", 
                height: 'calc(100% - 67px)', 
                marginTop: '67px', 
                cursor: 'ew-resize', 
                backgroundColor: '#e5e7eb',
                position: 'relative'
              }} onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#d1d5db';
              }} onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#e5e7eb';
              }}>
              </div>

              <div 
                id="custom-sidebar" 
                style={{ 
                  display: isCustomSidebarVisible ? 'flex' : 'none', 
                  flexDirection: 'column',
                  borderRight: 0, 
                  width: customSidebarWidth + 'px',
                  minWidth: CUSTOM_SIDEBAR_DEFAULT_WIDTH + 'px',
                  height: '100%', 
                  backgroundColor: 'white',
                  overflow: 'hidden'
                }}
              >
                {/* Toggle sections container - matching public/private toggle style */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgb(243, 244, 246)',
                  borderRadius: '10px',
                  padding: '5px',
                  gap: '4px',
                  width: 'calc(100% - 24px)',
                  margin: '12px',
                  boxSizing: 'border-box',
                  minHeight: '50px'
                }}>
                  {/* Activity section */}
                  <button
                    onClick={() => setCustomSidebarActiveTab('activity')}
                    style={{
                      flex: '1 1 0%',
                      padding: '10px 14px',
                      border: 'none',
                      borderRadius: '8px',
                      background: customSidebarActiveTab === 'activity' ? 'rgb(255, 255, 255)' : 'transparent',
                      color: customSidebarActiveTab === 'activity' ? 'rgb(17, 17, 17)' : 'rgb(107, 114, 128)',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: '0.2s',
                      boxShadow: customSidebarActiveTab === 'activity' ? 'rgba(0, 0, 0, 0.1) 0px 1px 3px' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <HiSearch size={18} style={{ color: 'inherit' }} />
                    <span>Activity</span>
                  </button>

                  {/* Messages section */}
                  <button
                    onClick={() => setCustomSidebarActiveTab('messages')}
                    style={{
                      flex: '1 1 0%',
                      padding: '10px 14px',
                      border: 'none',
                      borderRadius: '8px',
                      background: customSidebarActiveTab === 'messages' ? 'rgb(255, 255, 255)' : 'transparent',
                      color: customSidebarActiveTab === 'messages' ? 'rgb(17, 17, 17)' : 'rgb(107, 114, 128)',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: '0.2s',
                      boxShadow: customSidebarActiveTab === 'messages' ? 'rgba(0, 0, 0, 0.1) 0px 1px 3px' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <HiPencil size={18} style={{ color: 'inherit' }} />
                    <span>Messages</span>
                  </button>
                </div>

                {/* Content area for Activity and Messages */}
                <div style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: '0'
                }}>
                  {customSidebarActiveTab === 'activity' && (
                    <Activity 
                      currentProject={currentProject} 
                      onViewMember={(memberEmail, userCompanyEmail) => {
                        const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
                        const targetCompanyEmail = sharedCompanyEmail || companyEmail;
                        setShowAllMembers(true);
                        setSelectedMemberEmail(memberEmail);
                        setMemberSearchTerm('');
                        setShowMobileMemberDetails(false);
                        if (!memberDetails[memberEmail]) {
                          fetchMemberDetails(memberEmail, userCompanyEmail || targetCompanyEmail);
                        }
                      }}
                      isExpanded={isActivityExpanded}
                      onToggleExpand={() => setIsActivityExpanded(!isActivityExpanded)}
                    />
                  )}
                  {customSidebarActiveTab === 'messages' && (
                    <Messages currentProject={currentProject} currentChat={currentChat} />
                  )}
                </div>
              </div>
            </div>
          )
        }

        {false && (
          <div id="contacts-panel-outer" className="messaging-panel" style={{ display: isExtensionSidebarVisible ? 'block' : 'none', borderRight: 0, width: '400px', marginTop: '67px', backgroundColor: 'white' }}>
            <div style={{ display: "block", width: "100%" }}>
              <span className="messaging-header" id="messaging-header-right"><b>Choose Contact</b></span>
              <div id="contacts-panel-chooser" style={{ display: 'block', width: '100%' }}>
                <div id="contacts-panel">
                  {/* <!-- Contacts will be dynamically inserted here --> */}
                </div>
              </div>
              <div id="contacts-panel-messages" className="messages-list"
                style={{ display: 'none', position: 'relative', height: 800, paddingBottom: 75 }}>
                <div>
                  <button id="messages-back" className="back-button" style={{ marginTop: 0 }}>
                    <i className="fa-solid fa-angle-left"></i>
                  </button>
                  <div style={{ position: 'absolute', right: '40%', top: 13 }} className="center-under-img">
                    <img id="contact-img"
                      className="contact-avatar"></img>
                    <span className="comment-header" style={{ color: 'black', fontWeight: 600 }} id="contact-img-name">Name goes here</span>
                  </div>
                </div>
                <div id="messages-list" style={{ overflow: 'scroll', overflowX: 'hidden', height: '100%' }}>
                  {/* <!--Will be dynamically populated in messaging.js--> */}
                </div>
                {/* <!-- Chat input area --> */}
                <div className="add-comment-section" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                  <div className="comment-input-container">
                    <div className="comment-input-wrapper">
                      <textarea id="new-message" placeholder="Write a comment..." className="comment-input"
                        rows="1"
                        style={{
                          fontFamily: '"Glacial Indifference", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}></textarea>
                      <button id="add-message" className="comment-button primary" style={{ marginRight: 13 }}>
                        <i className="fas fa-arrow-up"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div >

      {/* Advanced Search Overlay */}
      <AdvancedSearchOverlay
        isOpen={showSearchOverlay}
        onClose={() => setShowSearchOverlay(false)}
        chats={allChats}
        sharedChats={allSharedChats}
        companyEmail={companyEmail}
        currentProject={currentProject}
        onChatSelect={handleChatSelect}
        chatMode={chatMode}
      />

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          isOpen={true}
          onClose={() => {
            setShowShareModal(false);
            setShareModalProjectId(null);
          }}
          projectId={shareModalProjectId}
        />
      )}

      {/* Account Settings Modal */}
      {showAccountSettingsModal && (
        <AccountSettingsModal
          isOpen={true}
          onClose={() => {
            setShowAccountSettingsModal(false);
          }}
        />
      )}

      {/* Share Link Modal */}
      {shareLinkModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => {
            setShareLinkModalOpen(false);
            // Clear pending share data if user cancels without confirming
            setPendingShareData(null);
            // Reset invite code and mode
            setInviteCode('');
            setShareMode('chat');
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              width: '600px',
              maxWidth: '90vw',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827'
              }}>
                Share
              </h2>
              <button
                onClick={() => {
                  setShareLinkModalOpen(false);
                  // Clear pending share data if user cancels without confirming
                  setPendingShareData(null);
                  // Reset invite code and mode
                  setInviteCode('');
                  setShareMode('chat');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '4px',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Mode Toggle */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex', 
                background: '#f3f4f6', 
                borderRadius: 8, 
                padding: 2,
                border: '1px solid #e5e7eb',
                gap: 2
              }}>
                <button
                  type="button"
                  onClick={() => setShareMode('chat')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: shareMode === 'chat' ? '#ffffff' : 'transparent',
                    color: shareMode === 'chat' ? '#111827' : '#6b7280',
                    boxShadow: shareMode === 'chat' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 150ms ease'
                  }}
                  title="Share this specific chat with others"
                >
                  Share this chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShareMode('project');
                    setInviteCode('');
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: shareMode === 'project' ? '#ffffff' : 'transparent',
                    color: shareMode === 'project' ? '#111827' : '#6b7280',
                    boxShadow: shareMode === 'project' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 150ms ease'
                  }}
                  title="Share entire project - invite team members to see all public chats"
                >
                  Share entire project
                </button>
              </div>
            </div>

            {/* Conditional Content Based on Mode */}
            {shareMode === 'chat' ? (
              <>
                <p style={{
                  margin: '0 0 16px 0',
                  fontSize: '14px',
                  color: '#6b7280',
                  lineHeight: '1.5'
                }}>
                  A public link to your chat has been created. Manage previously shared chats at any time via Settings.
                </p>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  <span style={{
                    flex: 1,
                    fontSize: '14px',
                    color: '#374151',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace'
                  }}>
                    {shareLink.substring(0, shareLink.lastIndexOf('/') + 13)}...
                  </span>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareLink);
                        showToast("Link copied to clipboard!", "success");
                        // Confirm sharing and add isShared flag to original chat
                        await confirmSharing();
                      } catch (error) {
                        console.error("Failed to copy:", error);
                        showToast("Failed to copy link", "error");
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: '#111827',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#1f2937'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#111827'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy link
                  </button>
                </div>

                {/* Email input and send section */}
                <div style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Share via email
                  </label>
                  <div style={{
                    display: 'flex',
                    gap: '8px'
                  }}>
                    <input
                      type="email"
                      placeholder="Enter email address"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSendEmailShare();
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        fontSize: '14px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                    <button
                      onClick={handleSendEmailShare}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#111827',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#1f2937'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#111827'}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </>
            ) : null}
            
            {/* Share Entire Project Mode - Invite Code */}
            {shareMode === 'project' && (
              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <div style={{ 
                  padding: 12, 
                  background: '#f0f9ff', 
                  border: '1px solid #bae6fd', 
                  borderRadius: 8,
                  fontSize: 13,
                  color: '#0c4a6e',
                  lineHeight: 1.4,
                  marginBottom: '16px'
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Invite team members to your project</div>
                  <div>Share this invite code to add people to your entire project. They'll see all public chats and can collaborate with you.</div>
                </div>
                
                {inviteCode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                      Invite Code
                    </label>
                    <div style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center'
                    }}>
                      <input
                        type="text"
                        value={inviteCode}
                        readOnly
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: 8,
                          fontSize: 14,
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          background: '#f9fafb',
                          color: '#111827',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(inviteCode);
                            showToast('Invite code copied to clipboard', 'success');
                          } catch (err) {
                            // Fallback for older browsers
                            const textArea = document.createElement('textarea');
                            textArea.value = inviteCode;
                            document.body.appendChild(textArea);
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                            showToast('Invite code copied to clipboard', 'success');
                          }
                        }}
                        style={{
                          padding: '8px 12px',
                          background: '#111827',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Copy
                      </button>
                    </div>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
                      Share this code with team members. They can use it to join your project.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsGeneratingCode(true);
                      try {
                        // Generate invite code
                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                        let newCode = '';
                        for (let i = 0; i < 8; i++) {
                          newCode += chars.charAt(Math.floor(Math.random() * chars.length));
                        }
                        
                        const companyEmail = await getMainCompanyEmail();
                        if (!companyEmail) {
                          showToast('Failed to get company information', 'error');
                          return;
                        }
                        
                        await saveFirebaseData(`inviteCodes/${newCode}`, {
                          companyEmail: companyEmail,
                          createdAt: new Date().toISOString()
                        });
                        
                        setInviteCode(newCode);
                        showToast('Invite code generated', 'success');
                      } catch (error) {
                        console.error('Error generating invite code:', error);
                        showToast('Failed to generate invite code', 'error');
                      } finally {
                        setIsGeneratingCode(false);
                      }
                    }}
                    disabled={isGeneratingCode}
                    style={{
                      padding: '10px 16px',
                      background: isGeneratingCode ? '#9ca3af' : '#111827',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: isGeneratingCode ? 'not-allowed' : 'pointer',
                      transition: 'background 150ms ease',
                      width: '100%'
                    }}
                  >
                    {isGeneratingCode ? 'Generating...' : 'Generate Invite Code'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* Add CSS to make message actions visible on hover */
const styleTag = document.createElement('style');
styleTag.innerHTML = `
      /* Hide scrollbars but keep scrolling functionality for entire page */
      * {
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE and Edge */
      }
      *::-webkit-scrollbar {
        display: none; /* Chrome, Safari, Opera */
      }
      
      .message-actions {
        opacity: 0;
  }
      .message-bubble:hover .message-actions {
        opacity: 1 !important;
      }
      .ai-message-actions {
        opacity: 1 !important;
      }

      /* Auth Modal Styles */
      .auth-modal-overlay {
        position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
  }

      .auth-modal {
        background-color: white;
      border-radius: 8px;
      width: 90%;
      max-width: 500px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      overflow: hidden;
  }

      .auth-modal-header {
        padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #eee;
  }

      .auth-modal-header h2 {
        margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
  }

      .close-modal-btn {
        background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
  }

      .auth-modal-content {
        padding: 20px;
  }

      .auth-modal-content p {
        margin-bottom: 20px;
      color: #555;
      line-height: 1.5;
  }

      .auth-modal-buttons {
        display: flex;
      flex-direction: column;
      gap: 12px;
  }

      .auth-modal-signin {
        padding: 12px 20px;
      background-color: #10a37f;
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      transition: background-color 0.2s;
  }

      .auth-modal-signin:hover {
        background-color: #0d8c6c;
  }

      .auth-modal-guest {
        padding: 12px 20px;
      background-color: transparent;
      color: #555;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
  }

      .auth-modal-guest:hover {
        background-color: #f5f5f5;
  }
      `;
document.head.appendChild(styleTag);

/* Add CSS for waveform animation */
const styleTag2 = document.createElement('style');
styleTag2.innerHTML += `\n.waveform-animated {\n  animation: waveformScale 1s infinite linear;\n}\n@keyframes waveformScale {\n  0% { transform: scale(1); }\n  50% { transform: scale(1.25); }\n  100% { transform: scale(1); }\n}`;
document.head.appendChild(styleTag2); 

/* Add CSS for typing indicator animations */
const typingIndicatorStyle = document.createElement('style');
typingIndicatorStyle.innerHTML = `
  @keyframes typingIndicatorFadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes typingDots {
    0%, 20% {
      opacity: 0.3;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.3;
    }
  }
  
  .typing-indicator-container {
    animation: typingIndicatorFadeIn 0.2s ease-out;
  }
  
  .typing-dot {
    display: inline-block;
    animation: typingDots 1.4s infinite;
  }
  
  .typing-dot-1 {
    animation-delay: 0s;
  }
  
  .typing-dot-2 {
    animation-delay: 0.2s;
  }
  
  .typing-dot-3 {
    animation-delay: 0.4s;
  }
`;
document.head.appendChild(typingIndicatorStyle);