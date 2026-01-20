import React, { useState, useEffect, useMemo, useRef } from 'react';
import { loadHighlights, loadHighlightsForText, loadFunc, setMainCompanyEmail, clearHighlights, createUnifiedAnnotationCard, getHighlightAnnotationsMap } from '../utils/highlighting';
import { ref, remove } from 'firebase/database';
import { database, auth } from '../firebase-init';
import { saveFirebaseData, getFirebaseData } from '../funcs';

// Helper function to get the correct Firebase path for a chat based on public/private status
function getChatBasePath(companyEmail, projectId, chatId, isPrivate, userEmail) {
  const formattedCompanyEmail = companyEmail.replace(/\./g, ',');
  if (isPrivate && userEmail) {
    const userEmailFormatted = userEmail.replace(/\./g, ',');
    return `Companies/${formattedCompanyEmail}/projects/${projectId}/privateChats/${userEmailFormatted}/${chatId}`;
  }
  return `Companies/${formattedCompanyEmail}/projects/${projectId}/groqChats/${chatId}`;
}

// Function to navigate to a specific highlight in the main chat
const navigateToHighlightInMainChat = (highlightId, chat, onChatSelect) => {
  if (!chat || !highlightId) return;
  
  // Close the search overlay first
  const overlay = document.querySelector('[style*="position: fixed"][style*="z-index: 999999"]');
  if (overlay) {
    overlay.click(); // This will trigger the onClose handler
  }
  
  // If onChatSelect is provided, use it to load the chat first
  if (onChatSelect && typeof onChatSelect === 'function') {
    onChatSelect(chat);
  }
  
  // Wait for the overlay to close and chat to load, then navigate to the highlight
  setTimeout(() => {
    // Find the highlight element in the main chat
    const highlightElement = document.querySelector(`mark[data-highlight-id="${highlightId}"]`);
    
    if (highlightElement) {
      // Scroll the highlight into view
      highlightElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
      
      // Add a temporary visual indicator
      const originalStyle = highlightElement.style.backgroundColor;
      highlightElement.style.backgroundColor = '#ffff99';
      highlightElement.style.transition = 'background-color 0.3s ease';
      highlightElement.style.boxShadow = '0 0 0 2px #007bff';
      
      // Remove the temporary indicator after 3 seconds
      setTimeout(() => {
        highlightElement.style.backgroundColor = originalStyle;
        highlightElement.style.boxShadow = '';
      }, 3000);
    } else {
      console.log('Highlight not found in main chat:', highlightId);
      // Try to find any highlight container with this ID as fallback
      const containerElement = document.querySelector(`.phraze-highlight-container [data-highlight-id="${highlightId}"]`);
      if (containerElement) {
        containerElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  }, 500); // Wait longer for chat to load
};

// Helper function to check if a highlight matches the selected filters (labels)
const checkHighlightMatchesFilters = (highlightId, selectedLabels) => {
  if (!highlightId) return false;
  
  const hasLabels = selectedLabels && selectedLabels.length > 0;
  
  // If no filters selected, don't match
  if (!hasLabels) return false;
  
  // Load annotation mapping if not available
  if (!window.highlightsToAnnotationsMap) {
    return false;
  }
  
  const annotations = window.highlightsToAnnotationsMap[highlightId];
  if (!annotations || !Array.isArray(annotations) || annotations.length === 0) {
    return false;
  }
  
  // Normalize selected values
  const normalizedLabels = hasLabels ? selectedLabels.map(l => String(l).trim().toLowerCase()).filter(Boolean) : [];
  
  // Extract all labels from annotations
  const highlightLabels = new Set();
  
  for (const annotation of annotations) {
    const type = annotation.find(item => item.type)?.type || '';
    const options = annotation.find(item => item.options)?.options || [];
    const normalizedType = String(type).trim().toLowerCase();
    
    if (normalizedType === 'label') {
      options.forEach(opt => {
        if (opt) highlightLabels.add(String(opt).trim().toLowerCase());
      });
    }
  }
  
  // Check matching logic
  let matchesLabels = !hasLabels; // If no labels selected, consider it a match
  
  if (hasLabels) {
    matchesLabels = normalizedLabels.some(selectedLabel => highlightLabels.has(selectedLabel));
  }
  
  return matchesLabels;
};

// Helper function to apply temporary spotlight styling to matching highlights
const applySpotlightStyling = (mark, containerSpan, duration = 3000) => {
  // Store original styles if not already stored
  if (!mark.dataset.originalBackgroundColor) {
    const computedStyle = window.getComputedStyle(mark);
    mark.dataset.originalBackgroundColor = computedStyle.backgroundColor || '';
    mark.dataset.originalBoxShadow = computedStyle.boxShadow || 'none';
  }
  
  // Add spotlight class to the mark element
  mark.classList.add('spotlight-highlight');
  
  // Apply inline styles for the spotlight effect with turquoise color
  // Using turquoise #30D5C8 that won't conflict with typical highlight colors
  mark.style.cssText += `
    background-color: #30D5C8 !important;
    box-shadow: 0 0 8px rgba(48, 213, 200, 0.4) !important;
    border-radius: 2px !important;
    transition: background-color 0.5s ease, box-shadow 0.5s ease;
  `;
  
  // Remove spotlight after duration and restore original color
  setTimeout(() => {
    mark.classList.remove('spotlight-highlight');
    // Restore original styles
    const originalBg = mark.dataset.originalBackgroundColor;
    const originalShadow = mark.dataset.originalBoxShadow;
    
    if (originalBg && originalBg !== 'rgba(0, 0, 0, 0)' && originalBg !== 'transparent') {
      mark.style.backgroundColor = originalBg;
    } else {
      // If no original color, remove the inline style to use CSS variable
      mark.style.backgroundColor = '';
    }
    
    if (originalShadow && originalShadow !== 'none') {
      mark.style.boxShadow = originalShadow;
    } else {
      mark.style.boxShadow = '';
    }
    
    // Clean up stored data
    delete mark.dataset.originalBackgroundColor;
    delete mark.dataset.originalBoxShadow;
  }, duration);
};

// Function to apply spotlight to matching highlights in the main chat view
const applySpotlightToMatchingHighlights = async (chatId, selectedLabels) => {
  // Check if any filters are active
  const hasLabels = selectedLabels && selectedLabels.length > 0;
  
  if (!hasLabels) {
    return; // No filters active, no spotlight needed
  }
  
  // Wait for chat to load and user to see the page
  // Use a longer delay (3.5 seconds) to ensure chat is fully loaded and user can see the page first
  setTimeout(async () => {
    try {
      // Load annotation mapping if not already available
      if (!window.highlightsToAnnotationsMap) {
        // Try to load highlights and build the mapping
        const highlights = await loadFunc() || [];
        if (highlights.length > 0) {
          window.highlightsToAnnotationsMap = await getHighlightAnnotationsMap(highlights);
        }
      }
      
      // Find all highlight marks in the main chat view
      const highlightMarks = document.querySelectorAll('mark[data-highlight-id]');
      
      if (highlightMarks.length === 0) {
        // No highlights found, try again after a short delay
        setTimeout(() => {
          const retryMarks = document.querySelectorAll('mark[data-highlight-id]');
          if (retryMarks.length > 0) {
            applySpotlightToMatchingHighlights(chatId, selectedLabels);
          }
        }, 500);
        return;
      }
      
      // Find matching highlights and apply spotlight one at a time
      const matchingHighlights = [];
      let matchCount = 0;
      
      highlightMarks.forEach((mark) => {
        const highlightId = mark.getAttribute('data-highlight-id');
        if (!highlightId) return;
        
        // Check if this highlight matches the filters
        const matches = checkHighlightMatchesFilters(highlightId, selectedLabels);
        
        if (matches) {
          // Store matching highlight for sequential spotlight and scroll
          matchingHighlights.push(mark);
          matchCount++;
        } else {
          // Remove spotlight from non-matching highlights
          mark.classList.remove('spotlight-highlight');
          // Reset styles if they were previously spotlighted
          if (mark.style.backgroundColor === 'rgb(48, 213, 200)' || mark.style.backgroundColor === '#30D5C8' || mark.style.backgroundColor === '#30d5c8') {
            mark.style.backgroundColor = '';
            mark.style.boxShadow = '';
          }
        }
      });
      
      // Process highlights one at a time with delays
      if (matchingHighlights.length > 0) {
        let currentIndex = 0;
        let previousMark = null;
        
        const processNextHighlight = () => {
          if (currentIndex >= matchingHighlights.length) {
            // Remove spotlight from the last highlight when done
            if (previousMark) {
              previousMark.classList.remove('spotlight-highlight');
              if (previousMark.dataset.originalBackgroundColor) {
                const originalBg = previousMark.dataset.originalBackgroundColor;
                const originalShadow = previousMark.dataset.originalBoxShadow;
                if (originalBg && originalBg !== 'rgba(0, 0, 0, 0)' && originalBg !== 'transparent') {
                  previousMark.style.backgroundColor = originalBg;
                } else {
                  previousMark.style.backgroundColor = '';
                }
                if (originalShadow && originalShadow !== 'none') {
                  previousMark.style.boxShadow = originalShadow;
                } else {
                  previousMark.style.boxShadow = '';
                }
                delete previousMark.dataset.originalBackgroundColor;
                delete previousMark.dataset.originalBoxShadow;
              }
            }
            return; // Done processing all highlights
          }
          
          // Remove spotlight from previous highlight before moving to next
          if (previousMark) {
            previousMark.classList.remove('spotlight-highlight');
            if (previousMark.dataset.originalBackgroundColor) {
              const originalBg = previousMark.dataset.originalBackgroundColor;
              const originalShadow = previousMark.dataset.originalBoxShadow;
              if (originalBg && originalBg !== 'rgba(0, 0, 0, 0)' && originalBg !== 'transparent') {
                previousMark.style.backgroundColor = originalBg;
              } else {
                previousMark.style.backgroundColor = '';
              }
              if (originalShadow && originalShadow !== 'none') {
                previousMark.style.boxShadow = originalShadow;
              } else {
                previousMark.style.boxShadow = '';
              }
              delete previousMark.dataset.originalBackgroundColor;
              delete previousMark.dataset.originalBoxShadow;
            }
          }
          
          const mark = matchingHighlights[currentIndex];
          const containerSpan = mark.closest('.phraze-highlight-container') || mark.parentElement;
          
          // Store original styles if not already stored
          if (!mark.dataset.originalBackgroundColor) {
            const computedStyle = window.getComputedStyle(mark);
            mark.dataset.originalBackgroundColor = computedStyle.backgroundColor || '';
            mark.dataset.originalBoxShadow = computedStyle.boxShadow || 'none';
          }
          
          // Apply spotlight to this highlight only (manually, no auto-removal)
          mark.classList.add('spotlight-highlight');
          mark.style.cssText += `
            background-color: #30D5C8 !important;
            box-shadow: 0 0 8px rgba(48, 213, 200, 0.4) !important;
            border-radius: 2px !important;
            transition: background-color 0.5s ease, box-shadow 0.5s ease;
          `;
          
          previousMark = mark;
          
          // Scroll to this highlight
          setTimeout(() => {
            mark.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }, 200);
          
          // Move to next highlight after delay (8 seconds to see this one properly)
          currentIndex++;
          if (currentIndex < matchingHighlights.length) {
            setTimeout(processNextHighlight, 8000);
          } else {
            // Last highlight - remove spotlight after duration
            setTimeout(() => {
              if (previousMark) {
                previousMark.classList.remove('spotlight-highlight');
                if (previousMark.dataset.originalBackgroundColor) {
                  const originalBg = previousMark.dataset.originalBackgroundColor;
                  const originalShadow = previousMark.dataset.originalBoxShadow;
                  if (originalBg && originalBg !== 'rgba(0, 0, 0, 0)' && originalBg !== 'transparent') {
                    previousMark.style.backgroundColor = originalBg;
                  } else {
                    previousMark.style.backgroundColor = '';
                  }
                  if (originalShadow && originalShadow !== 'none') {
                    previousMark.style.boxShadow = originalShadow;
                  } else {
                    previousMark.style.boxShadow = '';
                  }
                  delete previousMark.dataset.originalBackgroundColor;
                  delete previousMark.dataset.originalBoxShadow;
                }
              }
            }, 8000);
          }
        };
        
        // Start processing after a delay to let user see the chat first
        setTimeout(processNextHighlight, 1000);
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Spotlight] Applied spotlight to ${matchCount} matching highlights in chat ${chatId}`);
      }
    } catch (error) {
      console.error('[Spotlight] Error applying spotlight to highlights:', error);
    }
  }, 4000); // Wait 4 seconds for chat to load and user to see the page first
};

// Component to render message content with highlights applied
/**
 * Helper function to safely load and parse highlights from Firebase
 * Handles both array and object formats, filters out null/invalid entries
 */
const loadHighlightsSafely = async (companyEmail, currentProject) => {
  try {
    // Format email for Firebase (periods -> commas)
    const formattedEmail = companyEmail ? companyEmail.replace(/\./g, ',') : null;
    
    if (!formattedEmail || !currentProject) {
      console.warn('[Preview] Missing companyEmail or currentProject for loading highlights');
      return [];
    }
    
    // Temporarily set context
    const originalCompanyEmail = localStorage.getItem("companyEmail");
    const originalProject = localStorage.getItem("currentProject");
    
    try {
      localStorage.setItem("companyEmail", formattedEmail);
      setMainCompanyEmail(formattedEmail);
      localStorage.setItem("currentProject", currentProject);
      
      // Load from Firebase
      const highlightsData = await loadFunc();
      
      // Handle both array and object formats from Firebase
      let highlights = [];
      if (Array.isArray(highlightsData)) {
        highlights = highlightsData.filter(h => h != null && typeof h === 'object');
      } else if (highlightsData && typeof highlightsData === 'object') {
        highlights = Object.values(highlightsData).filter(h => h != null && typeof h === 'object');
      }
      
      return highlights;
    } finally {
      // Restore original context
      if (originalCompanyEmail !== null) {
        localStorage.setItem("companyEmail", originalCompanyEmail);
        setMainCompanyEmail(originalCompanyEmail);
      } else {
        localStorage.removeItem("companyEmail");
      }
      if (originalProject !== null) {
        localStorage.setItem("currentProject", originalProject);
      } else {
        localStorage.removeItem("currentProject");
      }
    }
  } catch (error) {
    console.error('[Preview] Error loading highlights from Firebase:', error);
    return [];
  }
};

const MessageContentWithHighlights = ({ content, chatId, selectedLabels = [], companyEmail = null, currentProject = null }) => {
  const [highlightedContent, setHighlightedContent] = useState(content);
  const contentRef = useRef(null);

  useEffect(() => {
    const applyHighlights = async () => {
      if (!content) {
        setHighlightedContent('');
        return;
      }
      
      // Validate required parameters
      if (!chatId) {
        setHighlightedContent(content);
        return;
      }
      
      if (!companyEmail || !currentProject) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Preview] Missing companyEmail or currentProject, cannot load highlights');
        }
        setHighlightedContent(content);
        return;
      }
      
      try {
        // Normalize chatId for flexible matching (handles "chat_" prefix differences)
        const normalizeChatId = (id) => {
          if (!id) return null;
          const str = String(id).trim();
          if (!str) return null;
          // Remove "chat_" prefix if present, return normalized ID
          return str.startsWith('chat_') ? str.substring(5) : str;
        };
        
        const normalizedChatId = normalizeChatId(chatId);
        if (!normalizedChatId) {
          console.warn('[Preview] Invalid chatId after normalization');
          setHighlightedContent(content);
          return;
        }
        
        // Load highlights from Firebase using the safe helper function
        const allHighlights = await loadHighlightsSafely(companyEmail, currentProject);
        
        if (allHighlights.length === 0) {
          // No highlights to process
          setHighlightedContent(content);
          return;
        }
        
        // Robust chatId matching function
        const doesChatIdMatch = (highlightChatId, searchChatId, normalizedSearchId) => {
          if (!highlightChatId) return false;
          
          const highlightIdStr = String(highlightChatId).trim();
          const searchIdStr = String(searchChatId).trim();
          
          if (!highlightIdStr || !searchIdStr) return false;
          
          // 1. Exact string match
          if (highlightIdStr === searchIdStr) return true;
          
          // 2. Normalized comparison (handles "chat_" prefix)
          const normalizedHighlightId = normalizeChatId(highlightChatId);
          if (normalizedHighlightId && normalizedSearchId && normalizedHighlightId === normalizedSearchId) {
            return true;
          }
          
          // 3. Try with/without prefix variations
          if (highlightIdStr === normalizedSearchId || highlightIdStr === `chat_${normalizedSearchId}`) {
            return true;
          }
          if (searchIdStr === normalizedHighlightId || searchIdStr === `chat_${normalizedHighlightId}`) {
            return true;
          }
          
          // 4. Case-insensitive comparison as fallback
          if (highlightIdStr.toLowerCase() === searchIdStr.toLowerCase()) {
            return true;
          }
          
          return false;
        };
        
        // Filter highlights to ONLY include those that match this specific chatId
        // Exclude highlights without chatID to prevent cross-chat highlighting
        const relevantHighlights = allHighlights.filter(h => {
          // STRICT: Exclude highlights without chatID (prevents cross-chat highlighting)
          if (!h || !h.chatID) {
            return false;
          }
          
          return doesChatIdMatch(h.chatID, chatId, normalizedChatId);
        });
          
        // Debug logging (only in development)
        if (process.env.NODE_ENV === 'development' && chatId) {
          const highlightsWithoutChatId = allHighlights.filter(h => !h || !h.chatID).length;
          const highlightsWithChatId = allHighlights.filter(h => h && h.chatID).length;
          
          console.log(`[Preview] ChatId: ${chatId} (normalized: ${normalizedChatId})`);
          console.log(`[Preview] Total highlights: ${allHighlights.length} (with chatID: ${highlightsWithChatId}, without: ${highlightsWithoutChatId})`);
          console.log(`[Preview] Relevant highlights for this chat: ${relevantHighlights.length}`);
        }
        
        // If we have relevant highlights, manually apply them
        // (since loadHighlightsForText does strict matching, we need to work around it)
        let highlighted = content;
        
        if (relevantHighlights.length > 0) {
          // Additional verification: ensure all highlights are valid and match chatId
          const verifiedHighlights = relevantHighlights.filter(h => {
            // Validate highlight structure
            if (!h || !h.id || !h.chatID) {
              return false;
            }
            
            // Re-verify chatId match using the same robust matching function
            return doesChatIdMatch(h.chatID, chatId, normalizedChatId);
          });
          
          if (verifiedHighlights.length === 0) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`[Preview] ⚠️ All ${relevantHighlights.length} highlights failed verification - not applying any`);
            }
            highlighted = content;
          } else {
              // Manually apply highlights similar to loadHighlightsForText logic
              // First, get clean text (strip any existing HTML/highlights to avoid duplication)
              let cleanText = content;
              if (content.includes('<mark') || content.includes('<Mark')) {
                // Content already has highlights, extract plain text
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = content;
                cleanText = tempDiv.textContent || tempDiv.innerText || content;
              }
              
              let highlightedText = cleanText;
              const highlightRanges = [];
              const usedPositions = new Set(); // Track used positions to prevent duplicates
              
              for (const highlight of verifiedHighlights) {
                if (!highlight.textNodes || highlight.textNodes.length === 0) continue;
                
                for (const textNode of highlight.textNodes) {
                  if (!textNode.highlightedRanges || textNode.highlightedRanges.length === 0) continue;
                  
                  // CRITICAL: Only apply highlights if the wholeText from the highlight matches
                  // the content we're displaying. This prevents cross-chat highlighting.
                  // The wholeText should be the original message content where the highlight was created.
                  const originalMessageText = textNode.wholeText || '';
                  
                  // Check if this original message text appears in our content
                  // We need to match the full context, not just individual words
                  if (!cleanText.includes(originalMessageText)) {
                    // If the full original message isn't in our content, skip this highlight
                    // This prevents highlighting words that appear in different messages/chats
                    continue;
                  }
                  
                  for (const range of textNode.highlightedRanges) {
                    if (range.length >= 3) {
                      const start = range[1];
                      const end = range[2];
                      const highlightedSegment = textNode.wholeText.substring(start, end);
                      
                      // Find this segment within the original message text context
                      // First, find where the original message text appears in our content
                      const messageStartIndex = cleanText.indexOf(originalMessageText);
                      if (messageStartIndex === -1) {
                        continue; // Original message not found, skip
                      }
                      
                      // Calculate the absolute position of the highlight within our content
                      const segmentIndex = messageStartIndex + start;
                      const segmentEnd = segmentIndex + highlightedSegment.length;
                      
                      // Verify the segment matches at this position
                      const actualSegment = cleanText.substring(segmentIndex, segmentEnd);
                      if (actualSegment !== highlightedSegment) {
                        continue; // Segment doesn't match at this position, skip
                      }
                      
                      // Check if this position is already used (prevent duplicate highlights)
                      const positionKey = `${segmentIndex}-${segmentEnd}`;
                      if (!usedPositions.has(positionKey)) {
                        usedPositions.add(positionKey);
                        highlightRanges.push({
                          start: segmentIndex,
                          end: segmentEnd,
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
              
            highlighted = highlightedText;
            if (process.env.NODE_ENV === 'development') {
              console.log(`[Preview] ✅ Applied ${highlightRanges.length} highlight ranges from ${verifiedHighlights.length} verified highlights`);
            }
          }
        } else {
          highlighted = content;
        }
        
        setHighlightedContent(highlighted);
        
        // Set up hover handlers for annotation cards after content is rendered
        setTimeout(() => {
          setupAnnotationCardHovers();
        }, 100);
      } catch (error) {
        console.error('[Preview] Error applying highlights to content:', error);
        setHighlightedContent(content);
      }
    };

    applyHighlights();
  }, [content, chatId, selectedLabels, companyEmail, currentProject]);

  const setupAnnotationCardHovers = async () => {
    if (!contentRef.current) return;

    const highlightMarks = contentRef.current.querySelectorAll('.PhrazeHighlight[data-highlight-id]');
    
    for (const mark of highlightMarks) {
      if (mark.hasAttribute('data-hover-setup')) continue;
      
      // Create a container span for the highlight
      const containerSpan = document.createElement('span');
      containerSpan.className = 'phraze-highlight-container PhrazeMark unselectable';
      containerSpan.style.position = 'relative';
      containerSpan.style.display = 'inline';
      
      // Wrap the mark with the container
      mark.parentNode.insertBefore(containerSpan, mark);
      containerSpan.appendChild(mark);
      
      // Get highlight data
      const highlightId = mark.dataset.highlightId;
      if (!highlightId) continue;
      
      // Temporarily set context for loading highlights
      const originalCompanyEmail = localStorage.getItem("companyEmail");
      const originalProject = localStorage.getItem("currentProject");
      
      if (companyEmail) {
        localStorage.setItem("companyEmail", companyEmail);
        setMainCompanyEmail(companyEmail);
      }
      if (currentProject) {
        localStorage.setItem("currentProject", currentProject);
      }
      
      let highlights = [];
      try {
        highlights = await loadFunc() || [];
      } finally {
        // Restore original context
        if (originalCompanyEmail !== null) {
          localStorage.setItem("companyEmail", originalCompanyEmail);
          setMainCompanyEmail(originalCompanyEmail);
        } else if (companyEmail) {
          localStorage.removeItem("companyEmail");
        }
        if (originalProject !== null) {
          localStorage.setItem("currentProject", originalProject);
        } else if (currentProject) {
          localStorage.removeItem("currentProject");
        }
      }
      
      const highlight = highlights.find(h => h.id === highlightId);
      
      if (!highlight) continue;
      
      // Ensure annotation mapping is loaded
      if (!window.highlightsToAnnotationsMap) {
        window.highlightsToAnnotationsMap = await getHighlightAnnotationsMap(highlights);
      }
      
      // Create annotation card
      const annotationCard = await createUnifiedAnnotationCard(highlight, containerSpan);
      
      // Append card to the search preview container instead of body for proper positioning
      const previewContainer = document.getElementById('searchPreviewMessages');
      if (previewContainer) {
        previewContainer.appendChild(annotationCard);
        // Set position relative to container
        annotationCard.style.position = 'absolute';
      } else {
        document.body.appendChild(annotationCard);
      }
      
      // Initially hide the card
      annotationCard.style.opacity = '0';
      annotationCard.style.pointerEvents = 'none';
      annotationCard.style.visibility = 'visible';
      annotationCard.style.display = '';
      
      // Apply spotlight styling if this highlight matches selected filters (labels)
      // Add a delay so it doesn't appear too quickly in the preview
      const hasLabels = selectedLabels && selectedLabels.length > 0;
      if (hasLabels) {
        const highlightMatchesFilters = checkHighlightMatchesFilters(highlight.id, selectedLabels);
        if (highlightMatchesFilters) {
          // Delay the spotlight in preview so it's more noticeable, and make it temporary (2 seconds)
          setTimeout(() => {
            applySpotlightStyling(mark, containerSpan, 2000);
          }, 800);
        }
      }
      
      // Set up hover handlers with robust gap handling
      let hideTimeout = null;
      let isMouseOverHighlight = false;
      let isMouseOverCard = false;
      
      const updateCardPosition = () => {
        if (!annotationCard || !containerSpan) return;
        
        const container = previewContainer || document.body;
        const containerRect = container.getBoundingClientRect();
        const spanRect = containerSpan.getBoundingClientRect();
        
        // Calculate position relative to container
        const left = spanRect.left - containerRect.left + (spanRect.width / 2);
        let top = spanRect.top - containerRect.top - 10;
        
        // Adjust if card would go above container
        if (top < 20) {
          top = spanRect.top - containerRect.top + spanRect.height + 10;
        }
        
        annotationCard.style.left = `${left}px`;
        annotationCard.style.top = `${top}px`;
      };
      
      const showCard = () => {
        // Clear any pending hide timeout
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        
        // Close any other open cards
        const openCards = document.querySelectorAll('.phraze-unified-annotation-card.active');
        openCards.forEach(card => {
          if (card !== annotationCard) {
            card.classList.remove('active');
            card.style.opacity = '0';
            card.style.pointerEvents = 'none';
          }
        });
        
        // Update position and show this card
        updateCardPosition();
        annotationCard.classList.add('active');
        annotationCard.style.opacity = '1';
        annotationCard.style.pointerEvents = 'auto';
        annotationCard.style.zIndex = '1000000000';
        isMouseOverHighlight = true;
      };
      
      const scheduleHideCard = () => {
        // Clear any existing timeout
        if (hideTimeout) {
          clearTimeout(hideTimeout);
        }
        
        // Schedule hide with a delay to handle gaps between highlight segments
        hideTimeout = setTimeout(() => {
          if (!isMouseOverHighlight && !isMouseOverCard) {
            annotationCard.classList.remove('active');
            annotationCard.style.opacity = '0';
            annotationCard.style.pointerEvents = 'none';
          }
        }, 200); // 200ms delay to handle gaps between highlight segments
      };
      
      const hideCard = () => {
        isMouseOverHighlight = false;
        if (!isMouseOverCard) {
          scheduleHideCard();
        }
      };
      
      // Add event listeners to the highlight container
      containerSpan.addEventListener('mouseenter', showCard);
      containerSpan.addEventListener('mouseleave', hideCard);
      
      // Update position on scroll/resize
      const updatePosition = () => {
        if (annotationCard.classList.contains('active')) {
          updateCardPosition();
        }
      };
      
      const scrollContainer = previewContainer?.parentElement || window;
      scrollContainer.addEventListener('scroll', updatePosition, { passive: true });
      window.addEventListener('resize', updatePosition);
      
      // Store cleanup function
      containerSpan._cleanupCard = () => {
        scrollContainer.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
      };
      
      // Add event listeners to the annotation card
      annotationCard.addEventListener('mouseenter', () => {
        // Clear any pending hide timeout
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        
        isMouseOverCard = true;
        annotationCard.classList.add('active');
        annotationCard.style.opacity = '1';
        annotationCard.style.pointerEvents = 'auto';
        updateCardPosition();
      });
      
      annotationCard.addEventListener('mouseleave', () => {
        isMouseOverCard = false;
        if (!isMouseOverHighlight) {
          scheduleHideCard();
        }
      });
      
      // Mark as setup
      mark.setAttribute('data-hover-setup', 'true');
    }
  };

  return (
    <div 
      ref={contentRef}
      dangerouslySetInnerHTML={{ __html: highlightedContent }}
      style={{ 
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        position: 'relative'
      }}
    />
  );
};

const AdvancedSearchOverlay = ({ 
  isOpen, 
  onClose, 
  chats = [], 
  sharedChats = [],
  companyEmail = '',
  currentProject = '',
  onChatSelect = null,
  chatMode = 'private'
}) => {
  const [showAnnotationHistory, setShowAnnotationHistory] = useState(false);
  
  // Match the annotation popup labelMap (top 4 categories only)
  const LABEL_GROUPS = {
    'Sentiment': [
      'Positive',
      'Neutral',
      'Negative'
    ],
    'Tone': [
      'Professional',
      'Casual',
      'Friendly',
      'Critical'
    ],
    'Intent': [
      'Question',
      'Statement',
      'Request',
      'Feedback'
    ],
    'Emotion': [
      'Happy',
      'Frustrated',
      'Confused',
      'Satisfied'
    ]
  };
  const [activeChat, setActiveChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredChatId, setHoveredChatId] = useState(null);
  const [persistentHoverId, setPersistentHoverId] = useState(null);
  const [currentHighlightIndex, setCurrentHighlightIndex] = useState(0);
  const [availableHighlights, setAvailableHighlights] = useState([]);
  const [messageTypeFilter, setMessageTypeFilter] = useState({
    showUser: true,
    showAssistant: true
  });
  const [contentTypeFilter, setContentTypeFilter] = useState('all'); // 'all', 'labels', 'notes'
  const [isLabelDropdownOpen, setIsLabelDropdownOpen] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [customLabels, setCustomLabels] = useState([]);
  const [chatIdToLabels, setChatIdToLabels] = useState({});

  // Reset filters when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedLabels([]);
      setIsLabelDropdownOpen(false);
    }
  }, [isOpen]);

  // Combine all chats and sort by timestamp, then filter by chat mode (only for shared projects)
  const allChats = useMemo(() => {
    const combined = [...chats, ...sharedChats];
    
    // Check if we're in a shared project
    const sharedProjectId = localStorage.getItem('sharedProjectId');
    const isSharedProject = sharedProjectId && sharedProjectId === currentProject;
    
    // Filter based on chat mode (public/private) only for shared projects
    const filtered = combined.filter(chat => {
      // For private projects, show all chats
      if (!isSharedProject) {
        return true;
      }
      
      // For shared projects, respect the public/private toggle
      if (chatMode === 'public') {
        // Show chats that don't have privateUser field (public chats)
        return !chat.privateUser;
      } else {
        // Show chats that have privateUser field matching current user (private chats)
        return chat.privateUser && auth.currentUser && chat.privateUser === auth.currentUser.email;
      }
    });
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [chats, sharedChats, chatMode, currentProject]);


  // Helper function to check if a chat matches selected labels
  // Uses case-insensitive matching with trimmed whitespace
  const chatMatchesFilters = (chat, selectedLabels) => {
    const hasLabels = selectedLabels && selectedLabels.length > 0;
    
    // If no filters selected, match all
    if (!hasLabels) return true;
    
    // Normalize selected values
    const normalizedLabels = hasLabels ? selectedLabels.map(l => String(l).trim().toLowerCase()).filter(Boolean) : [];
    
    // Check if chat matches labels
    let matchesLabels = !hasLabels; // If no labels selected, consider it a match
    if (hasLabels) {
      matchesLabels = false; // Start as false, will be set to true if any label matches
      
      // Primary: Check annotation-based mapping
      const chatId = chat?.id || chat?.originalId;
      if (chatId) {
        const mappedLabels = chatIdToLabels?.[chat.id] || chatIdToLabels?.[chat.originalId];
        
        if (Array.isArray(mappedLabels) && mappedLabels.length > 0) {
          const normalizedMappedLabels = mappedLabels.map(l => String(l).trim().toLowerCase());
          // Check if ANY selected label matches ANY mapped label (OR logic)
          if (normalizedLabels.some(selectedLabel => normalizedMappedLabels.includes(selectedLabel))) {
            matchesLabels = true;
          }
        }
      }
      
      // Fallback: Check chat-level tags
      if (!matchesLabels) {
        const chatTags = []
          .concat(chat?.labels || [])
          .concat(chat?.tags || [])
          .map(x => String(x).trim().toLowerCase());
        // Check if ANY selected label matches ANY chat tag (OR logic)
        if (normalizedLabels.some(selectedLabel => chatTags.includes(selectedLabel))) {
          matchesLabels = true;
        }
      }
      
      // Fallback: Check message-level tags
      if (!matchesLabels) {
        const messagesArray = Array.isArray(chat.messages)
          ? chat.messages
          : chat.messages ? Object.values(chat.messages) : [];
        for (const msg of messagesArray) {
          const msgTags = []
            .concat(msg?.labels || [])
            .concat(msg?.tags || [])
            .map(x => String(x).trim().toLowerCase());
          // Check if ANY selected label matches ANY message tag (OR logic)
          if (normalizedLabels.some(selectedLabel => msgTags.includes(selectedLabel))) {
            matchesLabels = true;
            break;
          }
        }
      }
    }
    
    // OR logic within each type: any selected label matches
    return matchesLabels;
  };

  // Filter chats based on search query and selected code/label options
  const filteredChats = useMemo(() => {
    let result = allChats;

    // Text search filter
    const query = (searchQuery || '').trim().toLowerCase();
    if (query) {
      result = result.filter(chat => {
        const titleMatch = chat.title?.toLowerCase().includes(query);
        const messagesArray = Array.isArray(chat.messages)
          ? chat.messages
          : chat.messages ? Object.values(chat.messages) : [];
        const messageMatch = messagesArray?.some(msg => (msg?.content || '').toLowerCase().includes(query));
        return titleMatch || messageMatch;
      });
    }

    // Code and/or Label selection filter
    // Scenario A: Only codes selected - show chats with any selected code (OR logic)
    // Scenario B: Only labels selected - show chats with any selected label (OR logic)
    // Scenario C: Both codes AND labels selected - show chats with at least one code AND at least one label (AND logic)
    // Scenario D: Nothing selected - show all chats
    const hasLabels = selectedLabels && selectedLabels.length > 0;
    
    if (hasLabels) {
      result = result.filter(chat => chatMatchesFilters(chat, selectedLabels));
    }

    return result;
  }, [allChats, searchQuery, selectedLabels, chatIdToLabels]);

  const visibleLabels = useMemo(() => {
    if (!selectedLabels || selectedLabels.length === 0) return [];
    if (filteredChats.length === 0) return [];
    
    return selectedLabels.filter(label => {
      const normalizedLabel = String(label).trim().toLowerCase();
      return filteredChats.some(chat => {
        // Check mapped labels
        const chatId = chat?.id || chat?.originalId;
        if (chatId) {
          const mappedLabels = chatIdToLabels?.[chat.id] || chatIdToLabels?.[chat.originalId];
          if (Array.isArray(mappedLabels) && mappedLabels.length > 0) {
            const normalizedMappedLabels = mappedLabels.map(l => String(l).trim().toLowerCase());
            if (normalizedMappedLabels.includes(normalizedLabel)) return true;
          }
        }
        
        // Check chat-level tags
        const chatTags = []
          .concat(chat?.codes || [])
          .concat(chat?.labels || [])
          .concat(chat?.tags || [])
          .map(x => String(x).trim().toLowerCase());
        if (chatTags.includes(normalizedLabel)) return true;
        
        // Check message-level tags
        const messagesArray = Array.isArray(chat.messages)
          ? chat.messages
          : chat.messages ? Object.values(chat.messages) : [];
        for (const msg of messagesArray) {
          const msgTags = []
            .concat(msg?.codes || [])
            .concat(msg?.labels || [])
            .concat(msg?.tags || [])
            .map(x => String(x).trim().toLowerCase());
          if (msgTags.includes(normalizedLabel)) return true;
        }
        
        return false;
      });
    });
  }, [selectedLabels, filteredChats, chatIdToLabels]);

  // Check for missing labels and show toast notification
  useEffect(() => {
    const hasLabels = selectedLabels && selectedLabels.length > 0;
    if (hasLabels) {
      checkAndShowMissingLabelsToast();
    }
  }, [allChats, selectedLabels]);

  // Function to check which selected labels are missing from all chats
  const checkAndShowMissingLabelsToast = () => {
    const missingItems = [];
    const hasLabels = selectedLabels && selectedLabels.length > 0;
    
    // Check labels
    if (hasLabels) {
      const lowerSelectedLabels = selectedLabels.map(label => String(label).trim().toLowerCase());
      for (const selectedLabel of lowerSelectedLabels) {
        let labelExists = false;
        
        // Check all chats for this label
        for (const chat of allChats) {
          // Check mapped labels first
          const mappedLabels = chatIdToLabels?.[chat?.id] || chatIdToLabels?.[chat?.originalId];
          if (Array.isArray(mappedLabels) && mappedLabels.length > 0) {
            const lowered = mappedLabels.map(x => String(x).trim().toLowerCase());
            if (lowered.includes(selectedLabel)) {
              labelExists = true;
              break;
            }
          }
          
          // Check chat-level tags
          const chatTags = []
            .concat(chat?.labels || [])
            .concat(chat?.tags || [])
            .map(x => String(x).trim().toLowerCase());
          if (chatTags.includes(selectedLabel)) {
            labelExists = true;
            break;
          }
          
          // Check message content and tags
          const messagesArray = Array.isArray(chat.messages)
            ? chat.messages
            : chat.messages ? Object.values(chat.messages) : [];
          for (const msg of messagesArray) {
            const text = String(msg?.content || '').toLowerCase();
            if (text.includes(selectedLabel)) {
              labelExists = true;
              break;
            }
            const msgTags = []
              .concat(msg?.labels || [])
              .concat(msg?.tags || [])
              .map(x => String(x).trim().toLowerCase());
            if (msgTags.includes(selectedLabel)) {
              labelExists = true;
              break;
            }
          }
          
          if (labelExists) break;
        }
        
        // If label doesn't exist in any chat, add it to missing items
        if (!labelExists) {
          missingItems.push(selectedLabel);
        }
      }
    }
    
    // Show toast if there are missing labels
    if (missingItems.length > 0) {
      showMissingLabelsToast(missingItems);
    }
  };

  // Function to show toast notification for missing labels
  const showMissingLabelsToast = (missingLabels) => {
    // Remove any existing missing codes toast
    const existingToast = document.querySelector('.missing-codes-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.missing-codes-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'missing-codes-toast-container';
      toastContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000000001;
        pointer-events: none;
      `;
      document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'missing-codes-toast';
    toast.style.cssText = `
      background: #fef2f2;
      border: 1px solid #ef4444;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      pointer-events: auto;
      animation: slideUpIn 0.3s ease-out;
    `;
    
    const missingCodesText = missingCodes.length === 1 
      ? `Code "${missingCodes[0]}" not found in any chats`
      : `Codes not found in any chats: ${missingCodes.map(code => `"${code}"`).join(', ')}`;
    
    toast.innerHTML = `
      <div style="font-size: 14px; color: #dc2626; font-weight: 500; line-height: 1.4;">
        ${missingCodesText}
      </div>
    `;
    
    // Add CSS animation
    if (!document.querySelector('#missing-codes-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'missing-codes-toast-styles';
      style.textContent = `
        @keyframes slideUpIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideUpOut 0.3s ease-in forwards';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 300);
      }
    }, 8000);
    
    // Add slide out animation
    if (!document.querySelector('#missing-codes-toast-slide-out-styles')) {
      const style = document.createElement('style');
      style.id = 'missing-codes-toast-slide-out-styles';
      style.textContent = `
        @keyframes slideUpOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-20px);
          }
        }
      `;
      document.head.appendChild(style);
    }
  };

  // Group chats by date
  const groupedChats = useMemo(() => {
    const groups = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'This Month': [],
      'Older': []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    filteredChats.forEach(chat => {
      const chatDate = new Date(chat.timestamp);
      
      if (chatDate >= today) {
        groups['Today'].push(chat);
      } else if (chatDate >= yesterday) {
        groups['Yesterday'].push(chat);
      } else if (chatDate >= weekAgo) {
        groups['This Week'].push(chat);
      } else if (chatDate >= monthAgo) {
        groups['This Month'].push(chat);
      } else {
        groups['Older'].push(chat);
      }
    });

    // Remove empty groups
    return Object.entries(groups).filter(([_, chats]) => chats.length > 0);
  }, [filteredChats]);

  // Format date for display
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get user initials for profile display
  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Find all highlights in the current chat preview
  // TODO: This is not working correctly
  const findHighlightsInPreview = () => {
    if (!activeChat) return [];
    
    const previewContainer = document.getElementById('searchPreviewMessages');
    if (!previewContainer) return [];
    
    const highlights = previewContainer.querySelectorAll('mark[data-highlight-id]');
    return Array.from(highlights).map((highlight, index) => ({
      element: highlight,
      id: highlight.dataset.highlightId,
      index
    }));
  };

  // Navigate to a specific highlight
  const navigateToHighlight = (index) => {
    if (availableHighlights.length === 0) return;
    
    const targetIndex = Math.max(0, Math.min(index, availableHighlights.length - 1));
    const highlight = availableHighlights[targetIndex];
    
    if (highlight && highlight.element) {
      // Reset all highlights to default color
      availableHighlights.forEach(h => {
        if (h.element) {
          h.element.style.setProperty('background-color', '', 'important');
        }
      });
      
      // Highlight the current one with a different color
      highlight.element.style.setProperty('background-color', '#ffd54f', 'important');
      
      // Scroll highlight into view
      highlight.element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });
      
      setCurrentHighlightIndex(targetIndex);
    }
  };

  // Navigate up (previous highlight)
  const navigateUp = () => {
    if (availableHighlights.length === 0) return;
    const newIndex = currentHighlightIndex > 0 ? currentHighlightIndex - 1 : availableHighlights.length - 1;
    navigateToHighlight(newIndex);
    animateArrowButton('up');
  };

  // Navigate down (next highlight)
  const navigateDown = () => {
    if (availableHighlights.length === 0) return;
    const newIndex = currentHighlightIndex < availableHighlights.length - 1 ? currentHighlightIndex + 1 : 0;
    navigateToHighlight(newIndex);
    animateArrowButton('down');
  };

  // Animate arrow button when pressed
  const animateArrowButton = (direction) => {
    const button = document.getElementById(`arrow-${direction}`);
    
    if (button) {
      button.style.fontWeight = 'bold';
      button.style.backgroundColor = '#f5f5f5';
      
      setTimeout(() => {
        button.style.fontWeight = 'normal';
        button.style.backgroundColor = 'transparent';
      }, 200);
    }
  };


  // Keep highlight project context aligned
  useEffect(() => {
    if (!isOpen) return;
    try {
      if (currentProject) {
        localStorage.setItem('currentProject', currentProject);
      }
    } catch (_) {}
  }, [isOpen, currentProject]);

  // Clear persistent hover when overlay closes and reset filters when opening
  useEffect(() => {
    if (!isOpen) {
      setPersistentHoverId(null);
      setHoveredChatId(null);
      setCurrentHighlightIndex(0);
      setAvailableHighlights([]);
    } else {
      // Reset filters to default when modal opens
      setMessageTypeFilter({
        showUser: true,
        showAssistant: true
      });
    }
  }, [isOpen]);

  // Listen for live changes to annotation history/highlights to refresh mapping
  useEffect(() => {
    if (!isOpen) return;
    const onAnn = () => {
    };
    document.addEventListener('annotationUpdated', onAnn);
    window.addEventListener('storage', onAnn);
    return () => {
      document.removeEventListener('annotationUpdated', onAnn);
      window.removeEventListener('storage', onAnn);
    };
  }, [isOpen]);

  // Update highlights when active chat changes
  useEffect(() => {
    if (activeChat) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const highlights = findHighlightsInPreview();
        setAvailableHighlights(highlights);
        setCurrentHighlightIndex(0);
        
        // Reset all highlight colors
        availableHighlights.forEach(h => {
          if (h.element) {
            h.element.style.setProperty('background-color', '', 'important');
          }
        });
      }, 100);
    } else {
      setAvailableHighlights([]);
      setCurrentHighlightIndex(0);
    }
  }, [activeChat]);

  // Keyboard shortcuts for highlight navigation
  useEffect(() => {
    if (!isOpen || availableHighlights.length === 0) return;

    const handleKeyDown = (event) => {
      // Only handle arrow keys when not typing in input fields
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        navigateUp();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        navigateDown();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, availableHighlights, currentHighlightIndex]);


  // Apply highlights to the preview messages, mirroring main chat
  useEffect(() => {
    if (!isOpen) return;
    // Mark body so global CSS can target unified cards appended to <body>
    try { document.body.classList.add('phraze-search-overlay-open'); } catch (_) {}
    // Prefer the chat's companyEmail if present (e.g., shared chats), else fallback to prop
    try {
      const emailForHighlights = activeChat?.companyEmail || companyEmail || null;
      if (emailForHighlights) {
        setMainCompanyEmail(emailForHighlights);
      }
    } catch (_) {}

    // Allow DOM to paint before applying highlights
    const id = requestAnimationFrame(() => {
      try {
        // Inject view-only styles for unified annotation card in search preview
        let styleTag = document.getElementById('phraze-search-preview-card-style');
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = 'phraze-search-preview-card-style';
          styleTag.textContent = `
            /* Keep smooth but fast transitions in search overlay */
            #searchPreviewMessages .phraze-unified-annotation-card,
            body.phraze-search-overlay-open .phraze-unified-annotation-card { transition: opacity 120ms ease, transform 120ms ease !important; animation: none !important; }
            /* Both container-scoped and body-scoped rules to catch cards appended to <body> */
            #searchPreviewMessages .phraze-unified-annotation-card .add-note-btn,
            #searchPreviewMessages .phraze-unified-annotation-card .delete-highlight-btn,
            #searchPreviewMessages .phraze-unified-annotation-card .phraze-note-delete-btn,
            #searchPreviewMessages .phraze-unified-annotation-card .labels-toggle-btn,
            #searchPreviewMessages .phraze-unified-annotation-card .annotation-close-btn,
            #searchPreviewMessages .phraze-unified-annotation-card button[title="Close annotation card"],
            #searchPreviewMessages .annotation-popup,
            body.phraze-search-overlay-open .phraze-unified-annotation-card .add-note-btn,
            body.phraze-search-overlay-open .phraze-unified-annotation-card .delete-highlight-btn,
            body.phraze-search-overlay-open .phraze-unified-annotation-card .phraze-note-delete-btn,
            body.phraze-search-overlay-open .phraze-unified-annotation-card .labels-toggle-btn,
            body.phraze-search-overlay-open .phraze-unified-annotation-card .annotation-close-btn,
            body.phraze-search-overlay-open .phraze-unified-annotation-card button[title="Close annotation card"],
            body.phraze-search-overlay-open .annotation-popup { display: none !important; }

            #searchPreviewMessages .phraze-unified-annotation-card .label-option,
            #searchPreviewMessages .phraze-unified-annotation-card .create-custom-option,
            body.phraze-search-overlay-open .phraze-unified-annotation-card .label-option,
            body.phraze-search-overlay-open .phraze-unified-annotation-card .create-custom-option { display: none !important; }

            #searchPreviewMessages .phraze-unified-annotation-card button,
            #searchPreviewMessages .phraze-unified-annotation-card .delete-highlight-btn,
            #searchPreviewMessages .phraze-unified-annotation-card .phraze-note-delete-btn,
            body.phraze-search-overlay-open .phraze-unified-annotation-card button,
            body.phraze-search-overlay-open .phraze-unified-annotation-card .delete-highlight-btn,
            body.phraze-search-overlay-open .phraze-unified-annotation-card .phraze-note-delete-btn { pointer-events: none !important; }

            /* Disable text selection and highlight creation in search preview */
            #searchPreviewMessages,
            #searchPreviewMessages * {
              user-select: none !important;
              -webkit-user-select: none !important;
              -moz-user-select: none !important;
              -ms-user-select: none !important;
              cursor: default !important;
            }

            /* Allow text selection only for existing highlights (for viewing) */
            #searchPreviewMessages .PhrazeHighlight {
              user-select: text !important;
              -webkit-user-select: text !important;
              -moz-user-select: text !important;
              -ms-user-select: text !important;
            }
          `;
          document.head.appendChild(styleTag);
        }


        // Re-parent preview bubbles into the search preview container
        const container = document.getElementById('searchPreviewMessages');
        if (container) {
          // Prevent text selection and highlight creation in preview
          const preventSelection = (e) => {
            // Prevent text selection
            if (e.type === 'selectstart' || e.type === 'mousedown') {
              const target = e.target;
              // Allow selection only on existing highlights (for viewing annotation cards)
              if (!target.closest('.PhrazeHighlight')) {
                e.preventDefault();
                return false;
              }
            }
          };
          
          container.addEventListener('selectstart', preventSelection);
          container.addEventListener('mousedown', preventSelection);
          
          const rect = container.getBoundingClientRect();
          const previews = document.getElementsByClassName('PhrazeHighlight-data-preview');
          for (let ele of previews) {
            container.appendChild(ele);
            // Offset position into container space
            const left = parseFloat(ele.style.left || '0');
            const top = parseFloat(ele.style.top || '0');
            if (!Number.isNaN(left) && !Number.isNaN(top)) {
              ele.style.left = `${left - rect.left}px`;
              ele.style.top = `${top - rect.top}px`;
            }
            // Make visible if it has content
            if (ele.childNodes && ele.childNodes[0] && ele.childNodes[0].textContent.trim() !== '') {
              ele.style.opacity = 1;
            }
          }

          // Enable hover-to-show unified card only within search preview
          function positionCardRelativeToContainer(cardEl, highlightContainerEl, rootEl) {
            if (!cardEl || !highlightContainerEl || !rootEl) return;
            const markEl = highlightContainerEl.querySelector('mark[id="PhrazeHighlight"]') || highlightContainerEl;
            const markRect = markEl.getBoundingClientRect();
            const rootRect = rootEl.getBoundingClientRect();
            const cardRect = cardEl.getBoundingClientRect();
            let left = markRect.left - rootRect.left + (markRect.width / 2);
            let top = markRect.top - rootRect.top - (cardRect.height - 1);
            if (top < 20) {
              top = markRect.top - rootRect.top + markRect.height + 10;
            }
            cardEl.style.position = 'absolute';
            cardEl.style.left = `${left}px`;
            cardEl.style.top = `${top}px`;
            if (cardEl.parentElement !== rootEl) {
              rootEl.appendChild(cardEl);
            }
          }

          function attachHoverHandlers(root) {
            const containers = root.getElementsByClassName('phraze-highlight-container');
            const attached = container._phrazeHoverHandlers || [];
            for (let c of containers) {
              if (c._phrazeHoverBound) continue;
              const onEnter = () => {
                // Immediately close any existing active cards to avoid overlap/lag
                const openCards = document.querySelectorAll('.phraze-unified-annotation-card.active');
                for (let card of openCards) {
                  card.classList.remove('active');
                  card.style.opacity = 0;
                  card.style.pointerEvents = 'none';
                }
                // Position card (library listens to mouseenter) and open it via synthetic click
              //  c.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                c.dispatchEvent(new MouseEvent('click', { bubbles: true }));

                // Reposition the active card relative to the preview container and keep it synced on scroll
                requestAnimationFrame(() => {
                  const activeCard = document.querySelector('.phraze-unified-annotation-card.active');
                  if (activeCard) {
                    positionCardRelativeToContainer(activeCard, c, container);
                    const scrollArea = container.parentElement || container;
                    const sync = () => positionCardRelativeToContainer(activeCard, c, container);
                    // Allow interaction over the card; close when leaving the card
                    const onCardEnter = () => { activeCard._phrazeHovering = true; };
                    const onCardLeave = () => {
                      activeCard._phrazeHovering = false;
                      activeCard.classList.remove('active');
                      activeCard.style.opacity = 0;
                      activeCard.style.pointerEvents = 'none';
                      try { (activeCard._phrazeScrollArea || scrollArea).removeEventListener('scroll', activeCard._phrazeSync); } catch (_) {}
                      try { window.removeEventListener('resize', activeCard._phrazeSync); } catch (_) {}
                      activeCard.removeEventListener('mouseenter', onCardEnter);
                      activeCard.removeEventListener('mouseleave', onCardLeave);
                      activeCard._phrazeSync = undefined;
                      activeCard._phrazeScrollArea = undefined;
                    };
                    activeCard.addEventListener('mouseenter', onCardEnter);
                    activeCard.addEventListener('mouseleave', onCardLeave);
                    activeCard._phrazeSync = sync;
                    scrollArea.addEventListener('scroll', sync, { passive: true });
                    window.addEventListener('resize', sync, { passive: true });
                    activeCard._phrazeScrollArea = scrollArea;
                  }
                });
              };
              const onLeave = () => {
                // Hide any active unified cards when leaving this highlight
                const cards = document.querySelectorAll('.phraze-unified-annotation-card.active');
                for (let card of cards) {
                  // If cursor moved to the card itself, keep it; otherwise close
                  if (!card._phrazeHovering) {
                    card.classList.remove('active');
                    card.style.opacity = 0;
                    card.style.pointerEvents = 'none';
                    if (card._phrazeSync) {
                      try { (card._phrazeScrollArea || container).removeEventListener('scroll', card._phrazeSync); } catch (_) {}
                      try { window.removeEventListener('resize', card._phrazeSync); } catch (_) {}
                      card._phrazeSync = undefined;
                      card._phrazeScrollArea = undefined;
                    }
                  }
                }
              };
              const onClick = (e) => {
                // Block only real user clicks; allow synthetic clicks from onEnter
                if (e.isTrusted) {
                  e.stopPropagation();
                  e.preventDefault();
                  
                  // Check if this is a highlight navigation click
                  const highlightId = c.querySelector('mark[data-highlight-id]')?.dataset?.highlightId;
                  if (highlightId) {
                    navigateToHighlightInMainChat(highlightId, activeChat, onChatSelect);
                  }
                }
              };
              c.addEventListener('mouseenter', onEnter);
              c.addEventListener('mouseleave', onLeave);
              c.addEventListener('click', onClick, true);
              c._phrazeHoverBound = true;
              attached.push([c, onEnter, onLeave, onClick]);
            }
            container._phrazeHoverHandlers = attached;
          }

          // Initial attach
          attachHoverHandlers(container);

          // Observe for highlights created after initial pass
          if (!container._phrazeHoverObserver) {
            const observer = new MutationObserver((mutations) => {
              for (const m of mutations) {
                if (m.addedNodes && m.addedNodes.length > 0) {
                  attachHoverHandlers(container);
                }
              }
            });
            observer.observe(container, { childList: true, subtree: true });
            container._phrazeHoverObserver = observer;
          }
        }
      } catch (e) {
        // no-op
      }
    });
    return () => {
      cancelAnimationFrame(id);
      // Remove view-only styles when overlay closes
      try {
        const styleTag = document.getElementById('phraze-search-preview-card-style');
        if (styleTag) styleTag.remove();
      } catch (_) {}
      try { document.body.classList.remove('phraze-search-overlay-open'); } catch (_) {}
      const container = document.getElementById('searchPreviewMessages');
      if (container && container._phrazeHoverHandlers) {
        for (const [c, onEnter, onLeave, onClick] of container._phrazeHoverHandlers) {
          try {
            c.removeEventListener('mouseenter', onEnter);
            c.removeEventListener('mouseleave', onLeave);
            c.removeEventListener('click', onClick, true);
          } catch (_) {}
        }
        container._phrazeHoverHandlers = undefined;
        if (container._phrazeHoverObserver) {
          try { container._phrazeHoverObserver.disconnect(); } catch (_) {}
          container._phrazeHoverObserver = undefined;
        }
        // Clean scroll/resize sync on any remaining cards just in case
        const cards = document.querySelectorAll('.phraze-unified-annotation-card');
        for (let card of cards) {
          if (card._phrazeSync) {
            try { (card._phrazeScrollArea || container).removeEventListener('scroll', card._phrazeSync); } catch (_) {}
            try { window.removeEventListener('resize', card._phrazeSync); } catch (_) {}
            card._phrazeSync = undefined;
            card._phrazeScrollArea = undefined;
          }
        }
      }
    };
  }, [isOpen, activeChat]);

  // Build chatId -> codes and chatId -> labels maps by joining annotationHistory (codes/labels per highlightID) with highlights (highlightID -> chatID)
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        // Fetch from Firebase directly for reliability
        // Use shared company email if viewing a shared project, otherwise use own company
        const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
        const companyEmailPath = sharedCompanyEmail || localStorage.getItem('companyEmail');
        const projectName = currentProject || localStorage.getItem('currentProject') || 'default';
        if (!companyEmailPath) return;

        // Format for Firebase (periods -> commas)
        const formattedCompanyEmail = companyEmailPath.replace(/\./g, ',');
        const annPath = `Companies/${formattedCompanyEmail}/projects/${projectName}/annotationHistory`;
        const highlightsPath = `Companies/${formattedCompanyEmail}/projects/${projectName}/highlights`;
        let annotationHistory = await getFirebaseData(annPath);
        let highlightsList = await getFirebaseData(highlightsPath);

        // Normalize
        if (typeof annotationHistory === 'string') {
          try { annotationHistory = JSON.parse(annotationHistory); } catch (_) { annotationHistory = []; }
        }
        if (!Array.isArray(annotationHistory)) annotationHistory = [];
        if (!Array.isArray(highlightsList)) highlightsList = [];

        // Build mappings: highlightID -> codes and highlightID -> labels
        // Only store option values, not key names
        const highlightIdToCodes = {};
        const highlightIdToLabels = {};
        
        for (const entry of annotationHistory) {
          if (!Array.isArray(entry)) continue;
          let highlightID = null;
          let type = '';
          let options = [];
          
          for (const obj of entry) {
            if (obj && typeof obj === 'object') {
              if (obj.highlightID) highlightID = obj.highlightID;
              if (obj.type) type = obj.type;
              if (obj.options) options = Array.isArray(obj.options) ? obj.options : [];
            }
          }
          
          if (highlightID && options.length > 0) {
            const normalizedType = String(type).toLowerCase().trim();
            
            if (normalizedType === 'code') {
              if (!highlightIdToCodes[highlightID]) highlightIdToCodes[highlightID] = new Set();
              // Only store option values, not key names
              for (const opt of options) {
                if (opt) {
                  const trimmedOpt = String(opt).trim();
                  if (trimmedOpt) highlightIdToCodes[highlightID].add(trimmedOpt);
                }
              }
            } else if (normalizedType === 'label') {
              if (!highlightIdToLabels[highlightID]) highlightIdToLabels[highlightID] = new Set();
              // Only store option values, not key names
              for (const opt of options) {
                if (opt) {
                  const trimmedOpt = String(opt).trim();
                  if (trimmedOpt) highlightIdToLabels[highlightID].add(trimmedOpt);
                }
              }
            }
          }
        }

        // Map highlightID -> chatID using highlights data
        const nextChatToCodes = {};
        const nextChatToLabels = {};
        
        for (const h of highlightsList) {
          const hid = h?.id;
          const cid = h?.chatID;
          if (!hid || !cid) continue;
          
          // Map codes
          const codesSet = highlightIdToCodes[hid];
          if (codesSet && codesSet.size > 0) {
            if (!nextChatToCodes[cid]) nextChatToCodes[cid] = new Set();
            for (const code of codesSet) nextChatToCodes[cid].add(code);
          }
          
          // Map labels
          const labelsSet = highlightIdToLabels[hid];
          if (labelsSet && labelsSet.size > 0) {
            if (!nextChatToLabels[cid]) nextChatToLabels[cid] = new Set();
            for (const label of labelsSet) nextChatToLabels[cid].add(label);
          }
        }

        // Convert Sets to Arrays
        const finalizedCodes = {};
        for (const [cid, setCodes] of Object.entries(nextChatToCodes)) {
          finalizedCodes[cid] = Array.from(setCodes);
        }
        
        const finalizedLabels = {};
        for (const [cid, setLabels] of Object.entries(nextChatToLabels)) {
          finalizedLabels[cid] = Array.from(setLabels);
        }
        
        setChatIdToLabels(finalizedLabels);
      } catch (e) {
        try { console.warn('[AdvancedSearch] Failed building chatIdToLabels from Firebase', e); } catch (_) {}
        setChatIdToLabels({});
      }
    })();
  }, [isOpen, currentProject]);

  
  // UI-only: Label dropdown handlers
  const toggleLabelDropdown = (e) => {
    e?.stopPropagation?.();
    setContentTypeFilter('labels');
    setIsLabelDropdownOpen((prev) => !prev);
  };

  const handleLabelSelect = (label) => {
    setSelectedLabels((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
  };


  // Close the label dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e) => {
      try {
        const labelMenu = document.getElementById('phraze-label-dropdown');
        const labelBtn = document.getElementById('phraze-label-pill');
        
        // Close label dropdown if clicking outside
        if (labelMenu && labelBtn) {
          if (!labelMenu.contains(e.target) && !labelBtn.contains(e.target)) {
            setIsLabelDropdownOpen(false);
          }
        }
      } catch (_) {
        setIsLabelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isOpen]);

  // Function to start editing a chat title
  const startEditing = (event, chatId, currentTitle) => {
    event.stopPropagation();
    setEditingChatId(chatId);
    setEditValue(currentTitle);
  };

  // Function to handle input changes
  const handleEditInputChange = (event) => {
    setEditValue(event.target.value);
  };

  // Function to save the edited chat title
  const saveEditedChatTitle = async (event, chatId) => {
    event.stopPropagation();
    
    if (!editValue.trim()) {
      setEditValue('Untitled Chat');
    }

    try {
      // Find the chat to determine if it's public or private
      const allChatsArr = [...(chats || []), ...(sharedChats || [])];
      const chatToUpdate = allChatsArr.find(c => c.id === chatId);
      const isPrivate = chatToUpdate && chatToUpdate.isPublic === false;
      
      // Update the chat title in the correct Firebase path
      const chatBasePath = getChatBasePath(companyEmail, currentProject, chatId, isPrivate, auth.currentUser?.email);
      await saveFirebaseData(chatBasePath + '/title', editValue.trim());
      
      // Exit edit mode
      setEditingChatId(null);
      
      // Update the active chat if it's the one being edited
      if (activeChat?.id === chatId) {
        setActiveChat({ ...activeChat, title: editValue.trim() });
      }
    } catch (error) {
      console.error("Error renaming chat:", error);
    }
  };

  // Function to handle keydown events in the edit input
  const handleEditKeyDown = (event, chatId) => {
    if (event.key === 'Enter') {
      saveEditedChatTitle(event, chatId);
    } else if (event.key === 'Escape') {
      setEditingChatId(null);
    }
  };

  // Function to handle clicking outside of the input to save
  const handleEditBlur = (event, chatId) => {
    saveEditedChatTitle(event, chatId);
  };

  // Function to delete a chat
  const deleteChat = async (event, chatId) => {
    event.stopPropagation();

    if (window.confirm("Are you sure you want to delete this chat?")) {
      try {
        // Find the chat to determine if it's public or private
        const allChatsArr = [...(chats || []), ...(sharedChats || [])];
        const chatToDelete = allChatsArr.find(c => c.id === chatId);
        const isPrivate = chatToDelete && chatToDelete.isPublic === false;
        
        // Remove the chat from the correct Firebase path
        const chatBasePath = getChatBasePath(companyEmail, currentProject, chatId, isPrivate, auth.currentUser?.email);
        const chatRef = ref(database, chatBasePath);
        await remove(chatRef);
        
        // Clear active chat if it was the deleted one
        if (activeChat?.id === chatId) {
          setActiveChat(null);
        }
      } catch (error) {
        console.error("Error deleting chat:", error);
      }
    }
  };

  // Function to handle chat selection
  const handleChatClick = (chat) => {
    if (onChatSelect && typeof onChatSelect === 'function') {
      onChatSelect(chat);
      
      // Apply spotlight to matching highlights if filters are active
      const hasLabels = selectedLabels && selectedLabels.length > 0;
      
      if (hasLabels) {
        const chatId = chat?.id || chat?.originalId;
        if (chatId) {
          applySpotlightToMatchingHighlights(chatId, selectedLabels);
        }
      }
      
      onClose(); // Close the search modal
    }
  };

  // Get chat preview content using exact message styles
  const getChatPreview = (chat) => {
    if (!chat.messages || chat.messages.length === 0) {
      return (
        <div style={{
          textAlign: 'center',
          color: '#666',
          fontSize: '14px',
          padding: '40px 20px'
        }}>
          No messages in this chat
        </div>
      );
    }

    // Convert messages object to array if needed
    const messages = Array.isArray(chat.messages) 
      ? chat.messages 
      : chat.messages ? Object.values(chat.messages) : [];

    // Don't filter messages - just show/hide them based on filter state
    return messages.map((message, index) => {
      // Determine if this message should be hidden
      const shouldHide = (message.role === 'user' && !messageTypeFilter.showUser) || 
                        (message.role === 'assistant' && !messageTypeFilter.showAssistant);

      return (
      <div
        key={index}
        style={{
          padding: message.role === 'user' ? '0 1rem' : '0',
          maxWidth: '800px',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
          position: 'relative',
          marginBottom: '1rem',
          visibility: shouldHide ? 'hidden' : 'visible'
        }}
      >
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          maxWidth: '85%',
          paddingLeft: message.role === 'user' ? '0' : '0'
        }}>
          {/* Username display with profile icon */}
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
                border: '1px solid #cbd5e1'
              }}>
                {getUserInitials(message.userDisplayName)}
              </div>
            )}
            <span>{message.role === 'user' ? (message.userDisplayName || 'User') : 'phraze'}</span>
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
            {/* Message Content */}
            <div
              style={{
                fontSize: '1rem',
                lineHeight: '1.5',
                whiteSpace: message.role === 'assistant' ? 'normal' : 'pre-wrap'
              }}>
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
              {/* Display text content with highlights applied */}
              <MessageContentWithHighlights 
                content={message.content} 
                chatId={chat.id}
                selectedLabels={selectedLabels}
                companyEmail={chat.companyEmail || companyEmail || null}
                currentProject={currentProject || 'default'}
              />
            </div>
          </div>
        </div>
      </div>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backdropFilter: 'blur(4px)',
        backgroundColor: 'rgba(0, 0, 0, 0.15)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '98vw',
          maxWidth: '1600px',
          height: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          overflow: 'hidden',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          id="advanced-search-overlay-close-button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            zIndex: 20
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#333';
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#666';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          ×
        </button>

        {/* Search Input and Filter Toggle */}
        <div style={{
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          height: '120px',
          padding: '20px 20px 20px 20px',
          borderBottom: '1px solid #e5e5e5',
          backgroundColor: '#ffffff',
          zIndex: '10',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0',
              border: 'none',
              borderRadius: '0',
              fontSize: '16px',
              outline: 'none',
              backgroundColor: 'transparent'
            }}
          />
          
          {/* Content Type Filter Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: '500',
              color: '#666',
              marginRight: '4px'
            }}>
              Filter:
            </span>
            
            {/* Segmented Control - Professional Design */}
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center',
              backgroundColor: '#f9fafb',
              borderRadius: '9999px',
              padding: '2px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              position: 'relative'
            }}>
              {[
                { value: 'all', label: 'All', activeBg: '#ffffff', activeColor: '#6b7280', inactiveColor: '#6b7280', hoverBg: '#f3f4f6' },
                { value: 'labels', label: 'Labels', activeBg: 'rgba(16, 185, 129, 0.1)', activeColor: '#10b981', inactiveColor: '#6b7280', hoverBg: 'rgba(16, 185, 129, 0.05)' },
                { value: 'notes', label: 'Notes', activeBg: 'rgba(245, 158, 11, 0.1)', activeColor: '#f59e0b', inactiveColor: '#6b7280', hoverBg: 'rgba(245, 158, 11, 0.05)' }
              ].map((option, index, array) => {
                const isFirst = index === 0;
                const isLast = index === array.length - 1;
                const isActive = contentTypeFilter === option.value;
                
                return (
                  <div key={option.value} style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      id={option.value === 'labels' ? 'phraze-label-pill' : undefined}
                      onClick={(e) => {
                        if (option.value === 'labels') {
                          toggleLabelDropdown(e);
                        } else {
                          setContentTypeFilter(option.value);
                          setIsLabelDropdownOpen(false);
                        }
                      }}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                        backgroundColor: isActive ? option.activeBg : 'transparent',
                        color: isActive ? option.activeColor : option.inactiveColor,
                        outline: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: (option.value === 'code' || option.value === 'labels') ? '6px' : '0px',
                        position: 'relative',
                        whiteSpace: 'nowrap',
                        boxShadow: isActive ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = option.hoverBg;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {option.label}
                      {option.value === 'labels' && (
                        <span style={{
                          fontSize: '11px',
                          color: isActive ? option.activeColor : option.inactiveColor,
                          opacity: 0.85,
                          fontWeight: '500'
                        }}>
                          {visibleLabels.length > 0 ? `(${visibleLabels.length})` : ''}
                        </span>
                      )}
                    </button>

                    {/* Labels Dropdown */}
                    {option.value === 'labels' && isLabelDropdownOpen && (
                    <div
                      id="phraze-label-dropdown"
                      style={{
                        position: 'absolute',
                        top: '36px',
                        left: 0,
                        zIndex: 50,
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 10px 20px rgba(0,0,0,0.08)',
                        padding: '8px',
                        minWidth: '320px',
                        maxHeight: '320px',
                        overflowY: 'auto'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {Object.entries(LABEL_GROUPS).map(([group, items]) => (
                        <div key={group} style={{ marginBottom: '6px' }}>
                          <div className="label-type-header" style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#6b7280',
                            textTransform: 'none'
                          }}>
                            {group}
                          </div>
                          {items.map((label) => {
                            const checked = selectedLabels.includes(label);
                            return (
                              <label
                                key={label}
                                className="label-option"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  backgroundColor: checked ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                                  color: '#374151'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = checked ? 'rgba(16, 185, 129, 0.12)' : '#f9fafb'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = checked ? 'rgba(16, 185, 129, 0.08)' : 'transparent'; }}
                                onClick={(e) => {
                                  // Prevent event from bubbling to parent dropdown
                                  e.stopPropagation();
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleLabelSelect(label);
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                  style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '13px' }}>{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      ))}

                      {/* Custom Labels section (read-only; live updates via event/localStorage) */}
                      <div className="label-type-header" style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#6b7280',
                        borderTop: '1px solid #e5e7eb',
                        marginTop: '8px'
                      }}>
                        Custom Labels
                      </div>
                      {customLabels && customLabels.length > 0 ? (
                        customLabels.map((label) => {
                          const checked = selectedLabels.includes(label);
                          return (
                            <label
                              key={label}
                              className="label-option"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                userSelect: 'none',
                                backgroundColor: checked ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                                color: '#374151'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = checked ? 'rgba(16, 185, 129, 0.12)' : '#f9fafb'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = checked ? 'rgba(16, 185, 129, 0.08)' : 'transparent'; }}
                              onClick={(e) => {
                                // Only handle if clicking on label text, not checkbox
                                if (e.target.type === 'checkbox') {
                                  e.stopPropagation();
                                  return;
                                }
                                e.preventDefault();
                                e.stopPropagation();
                                handleLabelSelect(label);
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleLabelSelect(label);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '13px' }}>{label}</span>
                            </label>
                          );
                        })
                      ) : (
                        <div style={{
                          padding: '8px 12px',
                          fontSize: '12px',
                          color: '#9ca3af'
                        }}>
                          No custom labels yet
                        </div>
                      )}
                    </div>
                    )}

                          </div>
                );
              })}
            </div>

            {/* Breadcrumb-style Filter Bar */}
            {visibleLabels.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0',
                marginTop: '0',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}>
                {/* Filter Path Container */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0'
                }}>
                  {/* Filter type segment - Labels or Codes */}
                  {visibleLabels.length > 0 && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 12px',
                        backgroundColor: '#f3f4f6',
                        color: '#6b7280',
                        fontSize: '13px',
                        fontWeight: '500',
                        border: '1px solid rgba(0, 0, 0, 0.08)',
                        borderRight: 'none',
                        borderTopLeftRadius: '9999px',
                        borderBottomLeftRadius: '9999px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Labels
                    </div>
                  )}
                  {/* Labels segments */}
                  {visibleLabels.map((label, index) => {
                    const isLast = index === visibleLabels.length - 1;
                    return (
                      <div
                        key={`label-${label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLabelSelect(label);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 12px',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          color: 'rgba(16, 185, 129, 1)',
                          fontSize: '13px',
                          fontWeight: '500',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          borderRight: isLast ? '1px solid rgba(16, 185, 129, 0.25)' : 'none',
                          marginLeft: '-1px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'background-color 0.15s ease',
                          position: 'relative',
                          zIndex: visibleLabels.length - index,
                          borderTopRightRadius: isLast ? '9999px' : '0',
                          borderBottomRightRadius: isLast ? '9999px' : '0'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.18)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.12)';
                        }}
                      >
                        {label}
                      </div>
                    );
                  })}

                </div>
              </div>
            )}

            {/* Annotation History Button */}
            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={() => {
                  setShowAnnotationHistory(true);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Annotation History
              </button>
            </div>
          </div>
        </div>

        {/* Conditional Content: Annotation History or Normal Search */}
        {showAnnotationHistory ? (
          /* Annotation History View */
          <div style={{
            width: '100%',
            height: 'calc(100% - 120px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            backgroundColor: '#ffffff'
          }}>
            {/* Back Button */}
            <button
              onClick={() => setShowAnnotationHistory(false)}
              style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'rgba(0, 0, 0, 0.05)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back to Search
            </button>

            {/* Empty State */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              maxWidth: '500px'
            }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#374151',
                margin: '24px 0 12px 0',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}>
                Annotation History
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                lineHeight: '1.6',
                margin: '0',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}>
                This is the annotation history page. Feature coming soon!
              </p>
            </div>
          </div>
        ) : (
          /* Normal Search Content */
          <>
        {/* Left Panel - Chat List */}
        <div style={{
          width: (filteredChats.length === 0 && selectedLabels.length > 0) ? '100%' : '40%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          paddingBottom: '60px',
          paddingTop: '120px'
        }}>

          {/* Chat List */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '0',
            borderRight: '1px solid #e5e5e5'
          }}>
            {groupedChats.length === 0 ? (
              selectedLabels.length > 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  height: '100%',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '24px'
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      <line x1="9" y1="10" x2="15" y2="10"></line>
                      <line x1="9" y1="14" x2="15" y2="14"></line>
                    </svg>
                  </div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#111827',
                    margin: '0 0 8px 0',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    No conversations found
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    margin: '0',
                    maxWidth: '400px',
                    lineHeight: '1.5',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    No conversations match your selected filters. Try adjusting your filters or search query.
                  </p>
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#666',
                  fontSize: '14px'
                }}>
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </div>
              )
            ) : (
              groupedChats.map(([groupName, groupChats], groupIndex) => (
                <div key={groupName} style={{ marginBottom: '8px' }}>
                  <div style={{
                    padding: '12px 16px 6px 16px',
                    fontSize: '11px',
                    fontWeight: '500',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    backgroundColor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>{groupName}</span>
                    {groupIndex === 0 && visibleLabels.length > 0 && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        backgroundColor: '#f3f4f6',
                        color: '#6b7280',
                        fontSize: '13px',
                        fontWeight: '500',
                        borderRadius: '9999px',
                        border: '1px solid rgba(0, 0, 0, 0.08)',
                        whiteSpace: 'nowrap',
                        textTransform: 'none'
                      }}>
                        chats: {filteredChats.length}
                      </div>
                    )}
                  </div>
                  {groupChats.map((chat) => (
                    <div
                      key={chat.id}
                      style={{
                        padding: '8px 16px',
                        margin: '2px 8px',
                        cursor: 'pointer',
                        backgroundColor: (hoveredChatId === chat.id || persistentHoverId === chat.id) ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        minHeight: '40px',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={() => {
                        setActiveChat(chat);
                        setHoveredChatId(chat.id);
                        setPersistentHoverId(chat.id);
                       
                      }}
                      onMouseLeave={() => setHoveredChatId(null)}
                      onClick={() => handleChatClick(chat)}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {editingChatId === chat.id ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={handleEditInputChange}
                            onKeyDown={(e) => handleEditKeyDown(e, chat.id)}
                            onBlur={(e) => handleEditBlur(e, chat.id)}
                            autoFocus
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              fontSize: '14px',
                              background: '#fff',
                              outline: 'none'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '400',
                            color: '#374151',
                            lineHeight: '1.4',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {chat.title || 'Untitled Chat'}
                          </div>
                        )}
                        {chat.isShared && (
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            marginTop: '1px'
                          }}>
                            Shared
                          </div>
                        )}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {(hoveredChatId === chat.id || persistentHoverId === chat.id) && !chat.isShared ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                          }}>
                            <button
                              onClick={(e) => startEditing(e, chat.id, chat.title)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#666',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                transition: 'all 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              title="Rename chat"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
                                <path d="M14.06 4.94l3.75 3.75"/>
                              </svg>
                            </button>
                            <button
                              onClick={(e) => deleteChat(e, chat.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#666',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                transition: 'all 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              title="Delete chat"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div style={{
                            fontSize: '12px',
                            color: '#9ca3af',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            fontWeight: '400'
                          }}>
                            {formatDate(chat.timestamp)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Chat Preview */}
        {(filteredChats.length > 0 || selectedLabels.length === 0) && (
        <div style={{
          width: '60%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          paddingBottom: '60px',
          paddingTop: '120px'
        }}>

          {/* Message Type Filter UI */}
          {activeChat && (
            <div style={{
              padding: '12px 20px 12px 20px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              display: 'flex',
              gap: '24px',
              alignItems: 'center',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              {/* Filters Label */}
              <div style={{ 
                fontWeight: '500', 
                color: '#666',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                height: '32px',
                paddingTop: '0.9px'
              }}>
                Filters:
              </div>
              
              {/* Pill Toggle Buttons */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '-11px' }}>
                <button
                  onClick={() => setMessageTypeFilter(prev => ({
                    ...prev,
                    showUser: !prev.showUser
                  }))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s ease',
                    backgroundColor: messageTypeFilter.showUser ? 'rgba(0, 0, 0, 0.06)' : '#f3f4f6',
                    color: messageTypeFilter.showUser ? '#374151' : '#6b7280',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!messageTypeFilter.showUser) {
                      e.currentTarget.style.backgroundColor = '#e5e7eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!messageTypeFilter.showUser) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                    }
                  }}
                >
                  User
                </button>
                
                <button
                  onClick={() => setMessageTypeFilter(prev => ({
                    ...prev,
                    showAssistant: !prev.showAssistant
                  }))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s ease',
                    backgroundColor: messageTypeFilter.showAssistant ? 'rgba(0, 0, 0, 0.06)' : '#f3f4f6',
                    color: messageTypeFilter.showAssistant ? '#374151' : '#6b7280',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!messageTypeFilter.showAssistant) {
                      e.currentTarget.style.backgroundColor = '#e5e7eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!messageTypeFilter.showAssistant) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                    }
                  }}
                >
                  Assistant
                </button>
              </div>
              
              {/* Message Filter Counter */}
              <div style={{ 
                fontSize: '13px', 
                color: '#6b7280',
                marginLeft: 'auto',
                backgroundColor: '#f3f4f6',
                padding: '6px 12px',
                borderRadius: '9999px',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'inherit',
                fontWeight: '500'
              }}>
                <span style={{ 
                  fontSize: '13px', 
                  color: '#666', 
                  fontWeight: '500'
                }}>
                  Messages
                </span>
                <span style={{ 
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: '400',
                  color: '#333',
                  transform: 'translateY(1px)'
                }}>
                  {(() => {
                    if (!activeChat.messages) return '0/0';
                    
                    const messages = Array.isArray(activeChat.messages) 
                      ? activeChat.messages 
                      : Object.values(activeChat.messages);
                    const visibleCount = messages.filter(message => {
                      if (message.role === 'user' && !messageTypeFilter.showUser) return false;
                      if (message.role === 'assistant' && !messageTypeFilter.showAssistant) return false;
                      return true;
                    }).length;
                    return `${visibleCount}/${messages.length}`;
                  })()}
                </span>
              </div>
            </div>
          )}

          {activeChat ? (
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px',
              position: 'relative'
            }}>
              
              <div id="searchPreviewMessages" style={{ position: 'relative', minHeight: '100%' }}>
                {getChatPreview(activeChat)}
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              fontSize: '16px'
            }}>
              Hover over a conversation to preview it
            </div>
          )}
        </div>
        )}

        {/* Bottom Section */}
        <div style={{
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '0',
          height: '60px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e5e5e5',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 20px'
        }}>
          {/* Highlight Navigation */}
          {availableHighlights.length > 0 && (
            <div style={{ 
              fontSize: '13px', 
              color: '#6b7280',
              backgroundColor: '#f3f4f6',
              padding: '6px 16px',
              borderRadius: '20px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'inherit',
              fontWeight: '500'
            }}>
              <span style={{ 
                fontWeight: '500'
              }}>
                Highlights
              </span>
              <span style={{ 
                fontFamily: 'monospace',
                fontSize: '13px',
                fontWeight: '400',
                color: '#333'
              }}>
                {currentHighlightIndex + 1}/{availableHighlights.length}
              </span>
              
              <div 
                id="arrow-container"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: '6px',
                  padding: '2px 4px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #e0e0e0',
                  transition: 'background-color 0.2s ease'
                }}>
                <button
                  id="arrow-up"
                  onClick={navigateUp}
                  disabled={availableHighlights.length === 0}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: availableHighlights.length > 0 ? 'pointer' : 'not-allowed',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: availableHighlights.length > 0 ? '#333' : '#ccc',
                    fontSize: '12px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (availableHighlights.length > 0) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  ↑
                </button>
                
                <div style={{
                  width: '1px',
                  height: '12px',
                  backgroundColor: '#e0e0e0',
                  margin: '0 3px'
                }}></div>
                
                <button
                  id="arrow-down"
                  onClick={navigateDown}
                  disabled={availableHighlights.length === 0}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: availableHighlights.length > 0 ? 'pointer' : 'not-allowed',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: availableHighlights.length > 0 ? '#333' : '#ccc',
                    fontSize: '12px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (availableHighlights.length > 0) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  ↓
                </button>
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
};

export default AdvancedSearchOverlay;
