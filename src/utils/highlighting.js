
import { saveFirebaseData, getFirebaseData } from "../funcs.js"
import { hasPermission, isPermissionEnabled } from "./permissions.js";

//New handmade algorithm (AI was making faulty highlighting algorithms)

//----------------------------Webpage edits--------------------------------
async function isUserLoggedIn() {
  return true;
}

function getUserEmail() {
  var user = JSON.parse(localStorage.getItem("currentUser"));
  return user.email.replace('.', ',');
}

// Get user email in dot format (for permission checks)
function getUserEmailDotFormat() {
  var user = JSON.parse(localStorage.getItem("currentUser"));
  return user ? user.email : null;
}

function getCurrentUserMeta() {
  try {
    const u = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const email = u && u.email ? String(u.email) : '';
    if (!email) return null;
    const firstName = u && u.firstName ? String(u.firstName) : '';
    const lastName = u && u.lastName ? String(u.lastName) : '';
    const fallbackName = u && u.name ? String(u.name) : '';
    const name = `${firstName} ${lastName}`.trim() || fallbackName || email.split('@')[0];
    return { email, firstName, lastName, name, ts: new Date().toISOString() };
  } catch (_) {
    return null;
  }
}

function upsertModifiedBy(entryArr, userMeta) {
  if (!Array.isArray(entryArr) || !userMeta || !userMeta.email) return;
  const email = String(userMeta.email).toLowerCase();
  let obj = entryArr.find((o) => o && Object.prototype.hasOwnProperty.call(o, 'modifiedBy'));
  if (!obj) {
    entryArr.push({ modifiedBy: [userMeta] });
    return;
  }
  const arr = Array.isArray(obj.modifiedBy) ? obj.modifiedBy : [];
  const next = arr.filter((m) => m && m.email && String(m.email).toLowerCase() !== email);
  next.unshift(userMeta);
  obj.modifiedBy = next.slice(0, 8);
}

var mainCompanyEmail = "";
export function getMainCompanyEmail() {
 // if (mainCompanyEmail)
  //  return mainCompanyEmail;
  return localStorage.getItem("companyEmail");
}

export function setMainCompanyEmail(email) {
  mainCompanyEmail = email;
}

function getCurrentProject() {
  var project = localStorage.getItem("currentProject");
  if (project)
    return project;
  return 'default';
}

async function saveFunc(value) {
  const companyEmail = await getResolvedCompanyEmail();
  const projectName = getCurrentProject();
  const path = `Companies/${companyEmail}/projects/${projectName}/highlights`;
  // Removed excessive logging
  // console.log("[saveFunc] Saving highlights to path:", path, "count:", Array.isArray(value) ? value.length : 'N/A');
  try {
    await saveFirebaseData(path, value);
    // console.log("[saveFunc] Successfully saved highlights to:", path);
    return true;
  } catch (error) {
    console.error('[saveFunc] Failed to save highlights:', error);
    
    // Check if it's a permission error
    const isPermissionError = error?.message?.includes('Permission denied') || 
                              error?.code === 'PERMISSION_DENIED';
    
    if (isPermissionError) {
      showToast('Unable to save highlight - you may not have permission for this project', 'error');
    } else {
      showToast('Failed to save highlight - please try again', 'error');
    }
    
    return false;
  }
}
//----------------------------END Webpage edits--------------------------------

export async function loadFunc() {
  const companyEmail = await getResolvedCompanyEmail();
  if (!companyEmail) {
    // Return empty array instead of throwing - user might not be logged in yet
    // console.log('[loadFunc] No company email found, returning empty highlights');
    return [];
  }
  const projectName = await getCurrentProject();
  const path = `Companies/${companyEmail}/projects/${projectName}/highlights`;
  // Removed excessive logging
  // console.log("[loadFunc] Loading highlights from path:", path);
  try {
    const data = await getFirebaseData(path);
    // console.log("[loadFunc] Loaded highlights:", Array.isArray(data) ? data.length : 0, "from:", path);
    return data;
  } catch (e) {
    // console.warn("[loadFunc] Failed to load highlights (likely permissions or missing). Returning empty list.", e?.message || e);
    return [];
  }
}

/**
 * Loads a profile picture for a highlight from Firebase
 * @param {HTMLImageElement} imgElement - The image element to set the profile picture
 * @param {string} userEmail - The email of the user who created the highlight
 * @param {string} companyEmail - The company email for the Firebase path (fallback)
 */
async function loadHighlightProfilePicture(imgElement, userEmail, companyEmail) {
  if (!userEmail || userEmail === 'local') {
    return; // Skip if no valid email
  }

  // Normalize email format (replace . with , for Firebase path)
  const userEmailFormatted = userEmail.replace(/\./g, ',');
  const displayEmail = userEmail.replace(/,/g, '.'); // For display/fallback
  
  let profilePicData = null;
  
  try {
    // First, try to get the user's own company email from emailToCompanyDirectory
    // This is needed because profile pics are stored under the user's OWN company, not the project's company
    const userCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${userEmailFormatted}`);
    
    if (userCompanyEmail) {
      // Fetch profile picture from user's own company
      profilePicData = await getFirebaseData(`Companies/${userCompanyEmail}/users/${userEmailFormatted}/profileImage`);
    }
    
    // If not found in user's own company, try the provided company email as fallback
    if (!profilePicData && companyEmail && companyEmail !== 'local') {
      const fallbackPath = `Companies/${companyEmail}/users/${userEmailFormatted}/profileImage`;
      profilePicData = await getFirebaseData(fallbackPath);
    }
  } catch (e) {
    console.warn('Error fetching profile picture for:', displayEmail, e);
  }
  
  if (profilePicData) {
    // Set the profile picture
    imgElement.src = profilePicData;
    imgElement.style.display = 'block';
    imgElement.style.width = '28px';
    imgElement.style.height = '28px';
    imgElement.style.borderRadius = '50%';
    imgElement.style.objectFit = 'cover';
    
    // Handle image load error - show fallback initial
    imgElement.onerror = () => {
      showFallbackInitial(imgElement, displayEmail);
    };
  } else {
    // No profile picture found - show fallback initial letter
    showFallbackInitial(imgElement, displayEmail);
  }
}

/**
 * Shows a fallback initial letter avatar when no profile picture is available
 * @param {HTMLImageElement} imgElement - The image element to replace with initial
 * @param {string} email - The email to use for initial letter
 */
function showFallbackInitial(imgElement, email) {
  // Hide the img element
  imgElement.style.display = 'none';
  
  // Check if fallback already exists
  if (imgElement.nextElementSibling && imgElement.nextElementSibling.classList.contains('profile-initial-fallback')) {
    return; // Already has fallback
  }
  
  // Create a fallback div with the initial letter
  const fallbackDiv = document.createElement('div');
  fallbackDiv.className = 'profile-initial-fallback';
  const initial = email.charAt(0).toUpperCase();
  // Generate a consistent color based on email
  const hue = email.charCodeAt(0) * 10 % 360;
  
  fallbackDiv.style.cssText = `
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: hsl(${hue}, 60%, 70%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
  `;
  fallbackDiv.textContent = initial;
  
  // Insert after the img element
  imgElement.parentNode.insertBefore(fallbackDiv, imgElement.nextSibling);
}

 function mergeAnnotationHistoryEntries(input) {
   const history = Array.isArray(input) ? input : [];
   const result = [];
   const seen = new Map();
   let didMerge = false;

   const getVal = (entryArr, key) => {
     if (!Array.isArray(entryArr)) return null;
     const obj = entryArr.find((o) => o && Object.prototype.hasOwnProperty.call(o, key));
     return obj ? obj[key] : null;
   };

   for (const entry of history) {
     if (!Array.isArray(entry)) continue;

     const type = getVal(entry, 'type');
     const key = getVal(entry, 'key');
     const userText = getVal(entry, 'userText');
     const url = getVal(entry, 'url');
     const highlightID = getVal(entry, 'highlightID');

     const mergeKey = `${String(highlightID || '')}||${String(type || '')}||${String(key || '')}||${String(userText || '')}||${String(url || '')}`;

     if (!seen.has(mergeKey)) {
       const cloned = entry.map((o) => (o && typeof o === 'object' ? { ...o } : o));
       const idx = result.length;
       result.push(cloned);
       seen.set(mergeKey, idx);
       continue;
     }

     didMerge = true;
     const existing = result[seen.get(mergeKey)];
     const existingOptions = getVal(existing, 'options');
     const incomingOptions = getVal(entry, 'options');

     const mergedOptions = Array.from(
       new Set([
         ...(Array.isArray(existingOptions) ? existingOptions : []),
         ...(Array.isArray(incomingOptions) ? incomingOptions : [])
       ].filter(Boolean).map(String))
     );

     const existingOptionsObjIndex = existing.findIndex((o) => o && Object.prototype.hasOwnProperty.call(o, 'options'));
     if (existingOptionsObjIndex >= 0) {
       existing[existingOptionsObjIndex] = { options: mergedOptions };
     } else {
       existing.push({ options: mergedOptions });
     }

     const existingTs = getVal(existing, 'timestamp');
     const incomingTs = getVal(entry, 'timestamp');
     if (incomingTs && (!existingTs || String(incomingTs) > String(existingTs))) {
       const tsIdx = existing.findIndex((o) => o && Object.prototype.hasOwnProperty.call(o, 'timestamp'));
       if (tsIdx >= 0) existing[tsIdx] = { timestamp: incomingTs };
       else existing.push({ timestamp: incomingTs });
     }
   }

   return { history: result, _didMerge: didMerge };
 }

async function getAnnotationHistory() {
  // Prefer Firebase (project-scoped) when logged in
  try {
    if (await isUserLoggedIn()) {
      const companyEmail = await getResolvedCompanyEmail();
      const projectName = getCurrentProject();
      if (companyEmail && projectName) {
        const path = `Companies/${companyEmail}/projects/${projectName}/annotationHistory`;
        const data = await getFirebaseData(path);
        if (data) {
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data);
              const merged = mergeAnnotationHistoryEntries(parsed);
              if (!window.__phrazeHistoryMigrated && merged._didMerge) {
                window.__phrazeHistoryMigrated = true;
                try { await saveFirebaseData(path, JSON.stringify(merged.history)); } catch (_) {}
              }
              return merged.history;
            } catch (_) {}
          }
          const merged = mergeAnnotationHistoryEntries(data);
          if (!window.__phrazeHistoryMigrated && merged._didMerge) {
            window.__phrazeHistoryMigrated = true;
            try { await saveFirebaseData(path, JSON.stringify(merged.history)); } catch (_) {}
          }
          return merged.history;
        }
      }
    }
  } catch (e) {
    console.warn('Falling back to local annotationHistory due to error:', e);
  }
  // Fallback to local storage
  let data = await callGetItem("annotationHistory");
  if (data == null) data = {};
  const values = Object.values(data);
  if (!values.length || !values[0] || values[0].length === 0) return [];
  const merged = mergeAnnotationHistoryEntries(values[0]);
  if (!window.__phrazeHistoryMigrated && merged._didMerge) {
    window.__phrazeHistoryMigrated = true;
    try { await callSetItem("annotationHistory", JSON.stringify(merged.history)); } catch (_) {}
  }
  return merged.history;
}

async function getHighlightAnnotations(id) {
  let annotationHistory = await getAnnotationHistory();
  var annotations = [];
  
  // Ensure annotationHistory is an array
  if (!Array.isArray(annotationHistory)) {
    console.warn('annotationHistory is not an array:', annotationHistory);
    return annotations;
  }
  
  // Removed excessive logging - was causing thousands of console messages
  // console.log(`🔍 Searching annotations for highlight ID: ${id} in history with ${annotationHistory.length} entries`);
  
  for (var annotation of annotationHistory) {
    // Ensure annotation is an array
    if (!Array.isArray(annotation)) {
      // console.warn('annotation is not an array:', annotation);
      continue;
    }
    
    for (var property of annotation) {
      if (property && property.highlightID) {
        if (property.highlightID === id) {
          // console.log(`✅ Found matching annotation for highlight ${id}:`, annotation);
          annotations.push(annotation);
          break; // Found the match, no need to continue
        }
      }
    }
  }
  
  // Removed excessive logging
  // if (annotations.length === 0) {
  //   console.log(`❌ No annotations found for highlight ${id}`);
  // }
  
  return annotations;
}

export async function getHighlightAnnotationsMap(highlights) {
  var highlightsToAnnotationsMap = {};
  if (highlights)
    for (let highlight of highlights) {
      highlightsToAnnotationsMap[highlight.id] = await getHighlightAnnotations(highlight.id);
    }
  return highlightsToAnnotationsMap;
}

function getGlobalHighlightID() {
  return localStorage.getItem("globalHighlightID");
}


async function callGetItem(key, prefixProjectName = true) {
  // Removed excessive logging - was causing thousands of console messages
  // console.warn(`-- callGetItem(key = ${key}) --`);
  var companyEmail = await getResolvedCompanyEmail();
  var projectName = await getCurrentProject();
  var path = `Companies/${companyEmail}/projects/${projectName}/${key}`;
  var data1 = await getFirebaseData(path);
  if (prefixProjectName)
    key = projectName + "/" + key;
  let data2 = { [key]: data1 };
  return data2;
}

// Resolve company email for highlights paths - checks for shared projects first
async function getResolvedCompanyEmail() {
  // Check for shared project first (when viewing another user's shared project)
  const sharedCompanyEmail = localStorage.getItem("sharedCompanyEmail");
  const sharedProjectId = localStorage.getItem("sharedProjectId");
  const currentProject = getCurrentProject();
  
  // Only use sharedCompanyEmail if the current project matches the stored shared project
  // DON'T clear localStorage here - let ChatSidebar manage that when user explicitly changes projects
  if (sharedCompanyEmail && sharedProjectId && sharedProjectId === currentProject) {
    console.log("[getResolvedCompanyEmail] Using sharedCompanyEmail:", sharedCompanyEmail, "for shared project:", currentProject);
    return sharedCompanyEmail.replace(/\./g, ',');
  } else if (sharedCompanyEmail && sharedProjectId && sharedProjectId !== currentProject) {
    // Project mismatch - don't use shared email for this project, but DON'T clear localStorage
    // The user might navigate back to the shared project later
    // Only log warning in debug mode to reduce console noise
    // console.log("[getResolvedCompanyEmail] Project mismatch - sharedProjectId:", sharedProjectId, "currentProject:", currentProject, "- using user's own company");
  }
  
  // Try local cache for user's own company
  let companyEmail = getMainCompanyEmail();
  if (companyEmail) {
    // Removed excessive logging - was causing hundreds of console messages per page load
    // console.log("[getResolvedCompanyEmail] Using user's own company:", companyEmail, "for project:", currentProject);
    return companyEmail.replace(/\./g, ',');
  }

  try {
    // Fallback: map current user email to company in Firebase
    const user = JSON.parse(localStorage.getItem("currentUser"));
    const rawEmail = user && user.email ? user.email : null;
    if (!rawEmail) return null;
    const emailKey = rawEmail.replace('.', ',');
    const mapped = await getFirebaseData(`emailToCompanyDirectory/${emailKey}`);
    if (mapped) {
      try { localStorage.setItem("companyEmail", mapped); } catch (_) {}
      setMainCompanyEmail(mapped);
      console.log("[getResolvedCompanyEmail] Fetched company from Firebase:", mapped, "for project:", currentProject);
      return mapped.replace(/\./g, ',');
    }
  } catch (_) {}

  console.log("[getResolvedCompanyEmail] No company email found!");
  return null;
}

/**
 * Positions an element within the viewport bounds
 * @param {HTMLElement} element - The element to position
 * @param {Object} options - Positioning options
 * @param {number} options.preferredLeft - Preferred left position (in pixels)
 * @param {number} options.preferredTop - Preferred top position (in pixels)
 * @param {Object} options.referenceRect - Optional reference rectangle for relative positioning
 * @param {string} options.position - 'fixed' or 'absolute' (default: 'fixed')
 */
function positionElementInViewport(element, options = {}) {
  const { preferredLeft, preferredTop, referenceRect, position = 'fixed' } = options;
  
  // Safety check: ensure element exists and is in the DOM
  if (!element || !element.parentNode && element !== document.body) {
    console.warn('positionElementInViewport: element not in DOM, skipping positioning');
    return;
  }
  
  // Store original display state
  const originalDisplay = element.style.display;
  const originalVisibility = element.style.visibility;
  
  // Ensure element is visible to get dimensions
  if (element.style.display === 'none') {
    element.style.display = 'block';
    element.style.visibility = 'hidden';
  }
  
  // Get popup dimensions (force a reflow to ensure accurate measurements)
  // Wrap in try-catch to handle cases where element is being removed
  let popupRect;
  let popupWidth = 400; // Fallback width from CSS
  let popupHeight = 300; // Fallback height estimate
  
  try {
    popupRect = element.getBoundingClientRect();
    popupWidth = popupRect.width || 400;
    popupHeight = popupRect.height || 300;
    
    // Additional safety check: if dimensions are 0 and element should be visible, it might be detached
    if (popupWidth === 0 && popupHeight === 0 && element.style.display !== 'none') {
      // Element might be detached, use fallback dimensions
      popupWidth = 400;
      popupHeight = 300;
    }
  } catch (e) {
    console.warn('positionElementInViewport: error getting element dimensions, using fallback', e);
    // Use fallback dimensions if getBoundingClientRect fails
  }
  
  // Restore original visibility state if we changed it (only if element is still valid)
  try {
    if (originalDisplay === 'none' && element.parentNode) {
      element.style.display = originalDisplay;
      element.style.visibility = originalVisibility;
    }
  } catch (e) {
    console.warn('positionElementInViewport: error restoring visibility state', e);
  }
  
  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Calculate preferred position (prioritize preferredLeft/preferredTop if provided)
  let left, top;
  
  if (preferredLeft !== undefined && preferredTop !== undefined) {
    // Use preferred positions as starting point (left edge of popup)
    left = preferredLeft;
    top = preferredTop;
  } else if (referenceRect && position === 'fixed') {
    // Use referenceRect to calculate position relative to element
    left = referenceRect.left + (referenceRect.width / 2) - (popupWidth / 2);
    top = referenceRect.top - popupHeight - 10; // Position above by default
  } else {
    // Center in viewport as fallback
    left = (viewportWidth - popupWidth) / 2;
    top = (viewportHeight - popupHeight) / 2;
  }
  
  // Ensure popup stays within viewport bounds
  const padding = 16; // Minimum padding from viewport edges
  
  // Adjust horizontal position
  if (left < padding) {
    left = padding;
  } else if (left + popupWidth > viewportWidth - padding) {
    left = Math.max(padding, viewportWidth - popupWidth - padding);
  }
  
  // Adjust vertical position - prioritize staying close to reference if provided
  if (top < padding) {
    // If too close to top, try to fit it below reference or at top
    if (referenceRect) {
      const spaceBelow = viewportHeight - referenceRect.bottom;
      const spaceAbove = referenceRect.top;
      
      // Check which side has more space
      if (spaceBelow >= popupHeight + padding) {
        // Position below reference
        top = referenceRect.bottom + 10;
      } else if (spaceAbove >= popupHeight + padding) {
        // Try above if below doesn't fit but above does
        top = referenceRect.top - popupHeight - 10;
        if (top < padding) {
          top = padding;
        }
      } else {
        // Neither side has enough space, use whichever has more
        if (spaceBelow > spaceAbove) {
          top = Math.max(padding, referenceRect.bottom + 10);
        } else {
          top = Math.min(viewportHeight - popupHeight - padding, referenceRect.top - popupHeight - 10);
          if (top < padding) {
            top = padding;
          }
        }
      }
    } else {
      top = padding;
    }
  } else if (top + popupHeight > viewportHeight - padding) {
    // If popup would be cut off at bottom
    const maxTop = viewportHeight - popupHeight - padding;
    
    if (referenceRect) {
      // Try to position on the side with more space
      const spaceAbove = referenceRect.top;
      const spaceBelow = viewportHeight - referenceRect.bottom;
      
      if (spaceAbove >= popupHeight + padding && spaceAbove > spaceBelow) {
        // Position above the reference element (if it fits better)
        top = referenceRect.top - popupHeight - 10;
        // Ensure it doesn't go above viewport
        if (top < padding) {
          top = padding;
        }
      } else if (spaceBelow >= popupHeight + padding) {
        // Try below if above doesn't work
        top = referenceRect.bottom + 10;
        if (top + popupHeight > viewportHeight - padding) {
          top = maxTop;
        }
      } else {
        // Neither side has enough space, use the maximum available
        top = Math.max(padding, maxTop);
      }
    } else {
      // No reference, just move it up to fit
      top = Math.max(padding, maxTop);
    }
  }
  
  // Apply positioning (only if element is still in DOM)
  try {
    if (element.parentNode || element === document.body) {
      element.style.position = position;
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      element.style.transform = 'none'; // Remove any transform that might interfere
      
      // Restore display if we changed it
      if (originalDisplay === 'none') {
        element.style.display = 'block';
      }
    }
  } catch (e) {
    console.warn('positionElementInViewport: error applying positioning', e);
  }
}

function sanitizeFirebasePath(url) {
  // Replace characters that are not allowed in Firebase paths
  return url.replace(/[.#$\/\[\]]/g, '_');
}
/**
 * Updates the annotation card position to be above the highlight
 * @param {HTMLElement} annotationCard - The annotation card element
 * @param {HTMLElement} container - The highlight container element
 */
function updateFloaterPosition(annotationCard, container, yOffset = 0) {
  // Get the mark element
  const mark = container.querySelector('mark[id="PhrazeHighlight"]');
  if (!mark) return;

  // Find the first text node inside the mark
  let textNode = null;
  for (let node of mark.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      textNode = node;
      break;
    }
  }
  if (!textNode) return;

  const text = textNode.textContent;
  const newlineIdx = text.indexOf('\n');
  const endIdx = newlineIdx === -1 ? text.length : newlineIdx;

  // Create a range for the text before the first newline
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, endIdx);
  const rect = range.getBoundingClientRect();
  const cardRect = annotationCard.getBoundingClientRect();

  // Calculate position
  let left = rect.x + rect.width / 2;
  let top = rect.y - (cardRect.height - 1) + yOffset;
  
  // Check if card would be cut off at the top
  const viewportTop = 20; // Leave 20px margin from top
  if (top < viewportTop) {
    // Position card below the highlighted text instead
   // top = rect.y + rect.height + 10; // 10px below the highlight
  }
  
  // Ensure card is not cut off at the left edge
  const viewportLeft = 20; // Leave 20px margin from left
  if (left < viewportLeft) {
    left = viewportLeft;
  }
  
  // Ensure card is not cut off at the right edge
  const viewportRight = window.innerWidth - 20;
  if (left + cardRect.width > viewportRight) {
    left = viewportRight - cardRect.width;
  }
  
  // Update annotation card position
  annotationCard.style.left = `${left}px`;
  annotationCard.style.top = `${top}px`;
}

/**
 * Delete a highlight from storage (Firebase or local).
 * @param {string} url - The sanitized URL key.
 * @param {string} id - The id of the highlight to delete
 */
async function deleteHighlightFromStorage(id) {
  // Security: Layer 2 - Action - Check permission to delete annotations
  // Note: Deleting a highlight also deletes its annotations, so we check deleteAnnotations permission
  const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
  const annotationPerms = typeof window !== 'undefined' ? window.currentUserPermissions : null;
  const isOwner = currentUserRole === 'owner';
  const canDeleteAnnotations = isOwner || (annotationPerms && annotationPerms.deleteAnnotations === true);
    
  if (!canDeleteAnnotations && currentUserRole !== 'viewer') {
      if (typeof showToast === 'function') {
      showToast('You do not have permission to delete annotations', 'error');
    } else if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast('You do not have permission to delete annotations', 'error');
      }
    throw new Error('Permission denied: You do not have permission to delete annotations');
  }
  
  // First delete the highlight
  const highlights_data = await loadFunc("highlights");
  // Filter out the highlight to delete
  const updated_highlights = highlights_data.filter(h => h.id !== id);
  saveFunc(updated_highlights);

  if (await isUserLoggedIn()) {

    // 2. Delete related annotation history entries
    const projectName = await getCurrentProject();
    // Use getResolvedCompanyEmail to support shared projects (already retrieved above)
    const annotationPath = `Companies/${resolvedCompanyEmail}/projects/${projectName}/annotationHistory`;

    // Get current annotation history
    var data = await getFirebaseData(annotationPath);

    if (data) {
      // Make sure annotationHistory is an array
      let annotationHistory = data;

      // If it's a string (JSON), parse it
      if (typeof annotationHistory === 'string') {
        try {
          annotationHistory = JSON.parse(annotationHistory);
        } catch (e) {
          console.error('Error parsing annotation history:', e);
        }
      }

      // Ensure it's an array before filtering
      if (Array.isArray(annotationHistory)) {
        // Filter out annotations with matching userText
        const updatedHistory = annotationHistory.filter(annotationEntry => {
          // Find the userText object in the array
          const userTextObj = annotationEntry.find(item => item.highlightID !== undefined);
          // Only keep entries where userText doesn't match the deleted highlight
          return !userTextObj || userTextObj.highlightID !== id;
        });

        // Save the updated annotation history back to Firebase
        saveFirebaseData(annotationPath, JSON.stringify(updatedHistory));

        console.log(`Deleted ${annotationHistory.length - updatedHistory.length} annotation entries for highlight: "${id}"`);
      } else {
        console.warn('Annotation history is not an array:', annotationHistory);
      }
    }
  } else {
    // 2. Delete related annotation history entries
    const projectName = await getCurrentProject();
    const historyData = await callGetItem("annotationHistory");

    if (historyData && historyData[`${projectName}/annotationHistory`]) {
      // Get the annotation history
      let annotationHistory;
      try {
        // Try to parse as JSON string
        annotationHistory = JSON.parse(historyData[`${projectName}/annotationHistory`]);
      } catch (e) {
        // If parsing fails, use as is
        console.error('Error parsing annotation history:', e);
        annotationHistory = historyData[`${projectName}/annotationHistory`];
      }

      // Ensure it's an array before filtering
      if (Array.isArray(annotationHistory)) {
        // Filter out annotations with matching userText
        const updatedHistory = annotationHistory.filter(annotationEntry => {
          // Find the userText object in the array
          const userTextObj = annotationEntry.find(item => item.highlightID !== undefined);
          // Only keep entries where userText doesn't match the deleted highlight
          return !userTextObj || userTextObj.highlightID !== id;
        });

        // Save the updated annotation history back to local storage
        let project = await getCurrentProject();
        chrome.storage.local.set({ [project + "/annotationHistory"]: JSON.stringify(updatedHistory) });

        console.log(`Deleted ${annotationHistory.length - updatedHistory.length} annotation entries for highlight: "${id}"`);
      } else {
        console.warn('Annotation history is not an array:', annotationHistory);
      }
    }
  }
}

// Add this new async function to handle saving the note
/**
 * Adds a note to the correct highlight in storage (Firebase or local).
 * @param {string} highlightedText - The text content of the highlight to find.
 * @param {string} noteText - The text of the note to add.
 */
async function addNoteToStorage(id, noteText) {
  // Security: Check permission before modifying annotations
  // Note: createAnnotations covers both creating and modifying annotations
  const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
  const annotationPerms = typeof window !== 'undefined' ? window.currentUserPermissions : null;
  const isOwner = currentUserRole === 'owner';
  const canCreateAnnotations = isOwner || (annotationPerms && annotationPerms.createAnnotations === true);
  
  if (!canCreateAnnotations && currentUserRole !== 'viewer') {
    // Only check for non-viewers (viewers are already blocked elsewhere)
    throw new Error('Permission denied: You do not have permission to create/modify annotations');
  }
  
  if (await isUserLoggedIn()) {
    // --- Firebase Logic ---
    const highlights_data = await loadFunc();

    // Find the highlight and add the note
    let updated = false;
    const updated_highlights = highlights_data.map(h => {
      // Using includes might be safer if whitespace is an issue, but exact match is simpler first
      if (h.id === id) {
        if (!h.notes) h.notes = []; // Ensure notes array exists
        h.notes.push(noteText);
        updated = true;
      }
      return h;
    });

    if (!updated) throw new Error(`Highlight with id "${id}" not found.`);

    saveFunc(updated_highlights);

    try {
      const me = getCurrentUserMeta();
      if (me) {
        const annotationHistory = await getAnnotationHistory();
        if (Array.isArray(annotationHistory) && annotationHistory.length > 0) {
          let didChange = false;
          annotationHistory.forEach((entry) => {
            if (!Array.isArray(entry)) return;
            const hidObj = entry.find((obj) => obj && Object.prototype.hasOwnProperty.call(obj, 'highlightID'));
            const hid = hidObj && hidObj.highlightID !== undefined ? String(hidObj.highlightID) : '';
            if (hid && String(hid) === String(id)) {
              upsertModifiedBy(entry, me);
              didChange = true;
            }
          });
          if (didChange) {
            await callSetItem('annotationHistory', JSON.stringify(annotationHistory));
            document.dispatchEvent(new Event('annotationUpdated'));
          }
        }
      }
    } catch (_) {}

  } else {
    // --- Local Storage Logic --- 
    var all_highlights = await loadFunc("highlights");

    // if (!all_highlights[url]) {
    //     throw new Error(`No highlights found for URL ${url} in local storage.`);
    // }

    let updated = false;

    all_highlights = all_highlights.map(h => {
      // Using includes might be safer if whitespace is an issue, but exact match is simpler first
      if (h.id === id) {
        if (!h.notes) h.notes = []; // Ensure notes array exists
        h.notes.push(noteText);
        updated = true;
      }
      return h;
    });

    if (!updated) throw new Error(`Highlight with id "${id}" not found locally.`);
    await saveFunc(all_highlights);
  }
}

/**
 * Removes a note from the correct highlight in storage (Firebase or local).
 * @param {string} id - The id of the highlight to find
 * @param {string} noteText - The text of the note to remove.
 */
async function removeNoteFromStorage(id, noteText) {
  // Security: Check permission before modifying annotations
  // Note: createAnnotations covers both creating and modifying annotations
  const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
  const annotationPerms = typeof window !== 'undefined' ? window.currentUserPermissions : null;
  const isOwner = currentUserRole === 'owner';
  const canCreateAnnotations = isOwner || (annotationPerms && annotationPerms.createAnnotations === true);
  
  if (!canCreateAnnotations && currentUserRole !== 'viewer') {
    // Only check for non-viewers (viewers are already blocked elsewhere)
    throw new Error('Permission denied: You do not have permission to create/modify annotations');
  }
  
  const url = sanitizeFirebasePath(window.location.href);

  if (await isUserLoggedIn()) {
    // --- Firebase Logic --- 

    const highlights_data = await loadFunc();
    let updated = false;

    const updated_highlights = highlights_data.map(h => {
      if (h.id === id && h.notes) {
        const noteIndex = h.notes.indexOf(noteText);
        if (noteIndex > -1) {
          h.notes.splice(noteIndex, 1);
          updated = true;
        }
      }
      return h;
    });

    if (!updated) throw new Error(`Note "${noteText}" for highlight "${id}" not found.`);

    saveFunc(highlights_data);

    try {
      const me = getCurrentUserMeta();
      if (me) {
        const annotationHistory = await getAnnotationHistory();
        if (Array.isArray(annotationHistory) && annotationHistory.length > 0) {
          let didChange = false;
          annotationHistory.forEach((entry) => {
            if (!Array.isArray(entry)) return;
            const hidObj = entry.find((obj) => obj && Object.prototype.hasOwnProperty.call(obj, 'highlightID'));
            const hid = hidObj && hidObj.highlightID !== undefined ? String(hidObj.highlightID) : '';
            if (hid && String(hid) === String(id)) {
              upsertModifiedBy(entry, me);
              didChange = true;
            }
          });
          if (didChange) {
            await callSetItem('annotationHistory', JSON.stringify(annotationHistory));
            document.dispatchEvent(new Event('annotationUpdated'));
          }
        }
      }
    } catch (_) {}

  } else {
    // --- Local Storage Logic --- 
    var all_highlights = await loadFunc("highlights");

    let updated = false;

    all_highlights = all_highlights.map(h => {
      if (h.id === id && h.notes) {
        const noteIndex = h.notes.indexOf(noteText);
        if (noteIndex > -1) {
          h.notes.splice(noteIndex, 1);
          updated = true;
        }
      }
      return h;
    });

    if (!updated) throw new Error(`Note "${noteText}" for highlight "${id}" not found locally.`);

    await saveFunc(all_highlights);
  }
}






//Returns a map of node->[[text node index, start, end], [...], ...]
function getHighlightedTextNodeRanges() {
  const selection = window.getSelection();
  const result = new Map();

  if (!selection.rangeCount) return result;

  const range = selection.getRangeAt(0);

  const treeWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ALL,  // Only look at text nodes
    {
      acceptNode: function (node) {
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node = treeWalker.currentNode;
  while (node) {
    if (node.nodeType != Node.TEXT_NODE && !isNodeAHighlight(node)) {
      let collectedText = [];
      var lastWasPhrazeHighlight = false;
      var currentTextNodeIndex = 0;
      var currentLength = 0;
      var lastWasTextNode = false;

      //If a text node is found, add it to the array
      //If a phraze mark is found, should add it to the last item in the array or make a new item
      //If something else is found, increment the textNodeIndex
      for (const child2 of node.childNodes) {
        var child = child2;
        if (isNodeAHighlight(child) && child.childNodes && child.childNodes.length > 0)
          child = child.childNodes[0]; //Redirect to mark element in highlight span
        
        // Skip if child is undefined or null
        if (!child) continue;
        
        // Direct text nodes
        if (
          isNodeAHighlight(child) &&
          range.intersectsNode(child)
        ) {
          lastWasPhrazeHighlight = true;
          if (child.childNodes) {
          for (let textNode of child.childNodes) {
              if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            const subRange = range.cloneRange();
            subRange.selectNodeContents(textNode);
            if (textNode === range.startContainer) subRange.setStart(textNode, range.startOffset);
            if (textNode === range.endContainer) subRange.setEnd(textNode, range.endOffset);
            if (currentLength > 0 && collectedText.length > 0)
              collectedText[collectedText.length - 1][2] += subRange.toString().length;
            else
              collectedText.push([currentTextNodeIndex, currentLength + subRange.startOffset, currentLength + subRange.endOffset]);
              }
            }
          }
        }
        else if (child.nodeType === Node.TEXT_NODE && range.intersectsNode(child)) {
          const subRange = range.cloneRange();
          subRange.selectNodeContents(child);
          if (child === range.startContainer) subRange.setStart(child, range.startOffset);
          if (child === range.endContainer) subRange.setEnd(child, range.endOffset);
          if (lastWasPhrazeHighlight)
            collectedText[collectedText.length - 1][2] += subRange.toString().length;
          else
            collectedText.push([currentTextNodeIndex, currentLength + subRange.startOffset, currentLength + subRange.endOffset]);
          // collectedText.push(subRange.toString());
          lastWasPhrazeHighlight = false;
        }

        if (child.nodeType === Node.TEXT_NODE || isNodeAHighlight(child)) {
          currentLength += child.textContent.length;
          lastWasTextNode = true;
        } else {
          if (lastWasTextNode) {
            lastWasPhrazeHighlight = false;
            currentTextNodeIndex += 1;
            currentLength = 0;
            lastWasTextNode = false;
          }
        }

      }

      if (collectedText.length > 0) {
        result.set(node, collectedText);
      }

    }
    node = treeWalker.nextNode();
  }
  return result;
}

function getImmediateTextInNode(node) {
  var text = "";
  for (var child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent;
    }
    else if (isNodeAHighlight(child) && child.tagName === "SPAN") {
      text += child.childNodes[0].textContent; //Get text from <mark> inside the span container
    }
  }
  return text;
}

function getFilteredTextContent(node) {
  var text = "";
  for (var child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent;
    }
    else if (isNodeAHighlight(child) && child.tagName === "SPAN") {
      text += child.childNodes[0].textContent; //Get text from <mark> inside the span container
    }
    else {
      text += getFilteredTextContent(child);
    }
  }
  return text;
}

// Highlight color helpers
function getDefaultHighlightColor() {
  try {
    const hex = localStorage.getItem('phrazeLastHighlightColorHex') || '#FFF176';
    const name = localStorage.getItem('phrazeLastHighlightColorName') || 'yellow';
    return { hex, name };
  } catch (_) {
    return { hex: '#FFF176', name: 'yellow' };
  }
}

// Hydrate local default color from Firebase (cross-device preference)
let defaultColorHydrated = false;
async function hydrateDefaultHighlightColorFromFirebase() {
  if (defaultColorHydrated) return;
  try {
    const companyEmail = await getResolvedCompanyEmail();
    // SECURITY: Don't make Firebase requests if companyEmail is null (user not authenticated)
    if (!companyEmail) {
      return; // User not logged in yet, skip hydration
    }
    const projectName = getCurrentProject();
    if (!projectName) {
      return; // No project selected yet, skip hydration
    }
    const path = `Companies/${companyEmail}/projects/${projectName}/defaultHighlightColor`;
    const remote = await getFirebaseData(path);
    if (remote && remote.hex) {
      try {
        localStorage.setItem('phrazeLastHighlightColorHex', remote.hex);
        localStorage.setItem('phrazeLastHighlightColorName', remote.name || 'yellow');
      } catch (_) {}
    }
  } catch (_) { /* ignore */ }
  defaultColorHydrated = true;
}

// Kick off hydration as soon as possible (but it will check for auth first)
(async () => { try { await hydrateDefaultHighlightColorFromFirebase(); } catch (_) {} })();


function applyHighlightColorToMarks(highlightId, colorHex) {
  try {
    const selector = `mark.PhrazeHighlight[data-highlight-id="${highlightId}"]`;
    document.querySelectorAll(selector).forEach(el => {
      el.style.setProperty('--highlight-color', colorHex);
    });
  } catch (e) {
    console.warn('Failed to apply color to marks', e);
  }
}

export async function saveHighlight(chatID = null) {
  // Check if user is a viewer - viewers cannot create highlights
  const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
  if (currentUserRole === 'viewer') {
    console.warn('Viewers cannot create highlights');
    if (typeof showToast === 'function') {
      showToast('Viewers cannot create highlights', 'error');
    }
    return;
  }
  
  // Removed excessive logging
  // console.log("Saving highlight", window.location.href);
  
  // If chatID not provided, try to get it from localStorage
  if (!chatID) {
    try {
      chatID = localStorage.getItem('phraze_currentChatId') || null;
    } catch (_) {}
  }
  
  // console.log("Chat ID", chatID);
  var collectedRanges = getHighlightedTextNodeRanges();
  var globalHighlightID = getGlobalHighlightID();
  const highlightIdStr = String(globalHighlightID);
  const { hex: defaultHex, name: defaultName } = getDefaultHighlightColor();
  
  // Use getResolvedCompanyEmail to support shared projects
  const resolvedCompanyEmail = await getResolvedCompanyEmail();
  
  var highlight = {
    id: highlightIdStr,
    userEmail: getUserEmail(),
    companyEmail: resolvedCompanyEmail,
    textNodes: [],
    url: window.location.href,
    chatID: chatID,
    color: defaultHex,
    colorName: defaultName
  };
  for (const [node, ranges] of collectedRanges) {
    var parentText = "";
    if (node.parentNode) {
      parentText = getFilteredTextContent(node.parentNode);
    }
    highlight.textNodes.push(
      {
        parentText: parentText,
        wholeText: getImmediateTextInNode(node),
        highlightedRanges: ranges,
        elementTag: node.tagName
      }
    )
  }
  if (!highlight.textNodes || highlight.textNodes.length == 0)
    return;

  var highlights = await loadFunc("highlights") || [];
  highlights.push(highlight);
  await saveFunc(highlights);

  // Always keep the new highlight's popup open so the user can annotate immediately
  // console.log('🆕 Creating new highlight with ID:', globalHighlightID);
  // Keep the annotation popup open for this new highlight until user closes or saves annotation
  try {
    if (!window.phrazeKeepPopupOpenIds) window.phrazeKeepPopupOpenIds = new Set();
    window.phrazeKeepPopupOpenIds.add(highlightIdStr);
  } catch (_) {}
  
  // Ensure this new highlight is NOT in the permanently closed set
  if (window.phrazePermanentlyClosedPopups && window.phrazePermanentlyClosedPopups.has(highlightIdStr)) {
    console.log('⚠️ Removing new highlight from permanently closed set:', highlightIdStr);
    window.phrazePermanentlyClosedPopups.delete(highlightIdStr);
  }
  
  // Load highlights to render the new highlight and show the annotation popup
  loadHighlights(false, highlightIdStr);
}

export function clearHighlights() {
  // Removed excessive logging
  // console.log("unified clearing highlights");
  
  // Store active annotation card IDs AND visible popup IDs before clearing
  const activeCardIds = [];
  
  // Check for active unified cards - BUT skip cards whose popups are permanently closed
  const annotationCards = document.querySelectorAll('.phraze-unified-annotation-card.active');
  annotationCards.forEach(card => {
    const highlightId = card.dataset.highlightId;
    if (highlightId) {
      // Skip if this highlight's popup is permanently closed (user clicked "Add Annotation")
      const isPermanentlyClosed = window.phrazePermanentlyClosedPopups && window.phrazePermanentlyClosedPopups.has(highlightId);
      if (!isPermanentlyClosed) {
      activeCardIds.push(highlightId);
      }
    }
  });
  
  // Check for visible annotation popups (display is not 'none')
  // BUT skip popups that are permanently closed
  const annotationPopups = document.querySelectorAll('.annotation-popup[data-highlight-id]');
  annotationPopups.forEach(popup => {
    const highlightId = popup.dataset.highlightId;
    const isPermanentlyClosed = (window.phrazePermanentlyClosedPopups && window.phrazePermanentlyClosedPopups.has(highlightId)) || 
                               popup.dataset.permanentlyClosed === 'true';
    
    if (highlightId && popup.style.display !== 'none' && !isPermanentlyClosed) {
      // Add to active list if not already there
      if (!activeCardIds.includes(highlightId)) {
        activeCardIds.push(highlightId);
      }
    }
  });
  
  // Store the active IDs globally so loadHighlights can access them
  window.phrazeActiveAnnotationCardIds = activeCardIds;
  
  const marks = document.querySelectorAll('.phraze-highlight-container');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.childNodes[0].textContent), mark);
    parent.normalize();
  });

  const allAnnotationCards = document.querySelectorAll('.phraze-unified-annotation-card');
  allAnnotationCards.forEach(card => {
    // Cleanup scroll listener before removing
    if (card._scrollCleanup) {
      card._scrollCleanup();
    }
    card.remove();
  });
  
  // Also remove all annotation popups
  const allAnnotationPopups = document.querySelectorAll('.annotation-popup');
  allAnnotationPopups.forEach(popup => {
    popup.remove();
  });
}



/**
 * Creates a unified annotation card that combines toolbar and comments dropdown
 * @param {Object} highlight - The highlight data object
 * @param {HTMLElement} containerSpan - The highlight container element
 * @returns {HTMLElement} The unified annotation card element
 */
/**
 * Handles deletion and update of annotations when user removes labels/codes from popup
 * @param {string} highlightedText - The highlighted text
 * @param {string} highlightId - The highlight ID
 * @param {Array} selectedLabels - Array of {type, value} objects for labels in popup
 */
async function handleAnnotationDeletions(highlightedText, highlightId, selectedLabels) {
  try {
    const annotationHistory = await getAnnotationHistory();
    if (!Array.isArray(annotationHistory) || annotationHistory.length === 0) {
      return; // No existing annotations, nothing to delete
    }
    
    const url = window.location.href;
    let updated = false;
    let hasDeletions = false; // Track if we actually need to delete anything
    
    // First pass: Check if there are any deletions needed
    for (let i = annotationHistory.length - 1; i >= 0; i--) {
      const entry = annotationHistory[i];
      if (!Array.isArray(entry)) continue;
      
      // Extract annotation data
      const entryUserText = entry.find(item => item.userText)?.userText || '';
      const entryKey = entry.find(item => item.key)?.key || '';
      const entryType = entry.find(item => item.type)?.type || '';
      const entryUrl = entry.find(item => item.url)?.url || '';
      const entryHighlightId = entry.find(item => item.highlightID)?.highlightID || '';
      const optionsObj = entry.find(item => item.options);
      const entryOptions = optionsObj?.options || [];
      
      // Only process annotations for this highlight
      if (entryUserText !== highlightedText || entryUrl !== url || entryHighlightId !== highlightId) {
        continue;
      }
      
      if (entryType.toLowerCase() === 'label') {
        // Check if this label type exists in selectedLabels
        const selectedForType = selectedLabels.filter(l => l.type === entryKey);
        const selectedValues = selectedForType.map(l => l.value);
        
        if (selectedValues.length === 0) {
          // All labels of this type were removed - deletion needed
          hasDeletions = true;
          break;
        } else {
          // Some labels may have been removed - check if any options were removed
          const removedOptions = entryOptions.filter(opt => !selectedValues.includes(opt));
          if (removedOptions.length > 0) {
            hasDeletions = true;
            break;
          }
        }
      } else if (entryType.toLowerCase() === 'code') {
        // Similar logic for codes if needed
      }
    }
    
    // Only check delete permission if we actually need to delete something
    if (hasDeletions) {
  const userEmail = getUserEmailDotFormat();
  const companyEmail = await getResolvedCompanyEmail();
  const projectId = getCurrentProject();
  
  if (userEmail && companyEmail && projectId) {
    const companyEmailDotFormat = companyEmail.replace(/,/g, '.');
    const hasDeletePermission = await hasPermission(userEmail, companyEmailDotFormat, projectId, 'deleteAnnotations');
    
    if (!hasDeletePermission) {
      if (typeof showToast === 'function') {
        showToast('You do not have permission to delete annotations in this project', 'error');
      }
      return; // Exit early if permission denied
    }
  }
    }
    
    // Second pass: Actually perform deletions (only if we have permission or no deletions needed)
    for (let i = annotationHistory.length - 1; i >= 0; i--) {
      const entry = annotationHistory[i];
      if (!Array.isArray(entry)) continue;
      
      // Extract annotation data
      const entryUserText = entry.find(item => item.userText)?.userText || '';
      const entryKey = entry.find(item => item.key)?.key || '';
      const entryType = entry.find(item => item.type)?.type || '';
      const entryUrl = entry.find(item => item.url)?.url || '';
      const entryHighlightId = entry.find(item => item.highlightID)?.highlightID || '';
      const optionsObj = entry.find(item => item.options);
      const entryOptions = optionsObj?.options || [];
      
      // Only process annotations for this highlight
      if (entryUserText !== highlightedText || entryUrl !== url || entryHighlightId !== highlightId) {
        continue;
      }
      
      if (entryType.toLowerCase() === 'label') {
        // Check if this label type exists in selectedLabels
        const selectedForType = selectedLabels.filter(l => l.type === entryKey);
        const selectedValues = selectedForType.map(l => l.value);
        
        if (selectedValues.length === 0) {
          // All labels of this type were removed - delete the entire annotation entry
          annotationHistory.splice(i, 1);
          updated = true;
        } else {
          // Some labels may have been removed - update the options array
          const removedOptions = entryOptions.filter(opt => !selectedValues.includes(opt));
          if (removedOptions.length > 0) {
            // Remove options that are no longer selected
            optionsObj.options = entryOptions.filter(opt => selectedValues.includes(opt));
            updated = true;
          }
        }
      } else if (entryType.toLowerCase() === 'code') {
        // Similar logic for codes if needed
      }
    }
    
    // Save updated annotation history if changes were made
    if (updated) {
      try {
        const me = getCurrentUserMeta();
        if (me) {
          for (let i = 0; i < annotationHistory.length; i++) {
            const entry = annotationHistory[i];
            if (!Array.isArray(entry)) continue;
            const hidObj = entry.find(item => item && Object.prototype.hasOwnProperty.call(item, 'highlightID'));
            const entryHighlightId = hidObj && hidObj.highlightID !== undefined ? String(hidObj.highlightID) : '';
            const urlObj = entry.find(item => item && Object.prototype.hasOwnProperty.call(item, 'url'));
            const entryUrl = urlObj && urlObj.url ? String(urlObj.url) : '';
            const userTextObj = entry.find(item => item && Object.prototype.hasOwnProperty.call(item, 'userText'));
            const entryUserText = userTextObj && userTextObj.userText ? String(userTextObj.userText) : '';
            if (entryHighlightId === String(highlightId) && entryUrl === url && entryUserText === String(highlightedText)) {
              upsertModifiedBy(entry, me);
            }
          }
        }
      } catch (_) {}
      const annotationKey = "annotationHistory";
      const annotationHistoryString = JSON.stringify(annotationHistory);
      await callSetItem(annotationKey, annotationHistoryString);
      console.log('Annotation deletions/updates saved successfully');
      document.dispatchEvent(new Event('annotationUpdated'));
    }
  } catch (error) {
    console.error('Error handling annotation deletions:', error);
  }
}

/**
 * Deletes a single label or code option from an annotation
 * @param {string} highlightedText - The highlighted text
 * @param {string} highlightId - The highlight ID
 * @param {string} key - The label/code key (e.g., "Sentiment", "Intent")
 * @param {string} value - The option value to delete (e.g., "Positive", "Request")
 * @param {string} type - The type ("label" or "code")
 */
async function deleteSingleAnnotationOption(highlightedText, highlightId, key, value, type) {
  // Check permission to delete annotations (can delete entire entry if last option removed)
  const userEmail = getUserEmailDotFormat();
  const companyEmail = await getResolvedCompanyEmail();
  const projectId = getCurrentProject();
  
  if (userEmail && companyEmail && projectId) {
    const companyEmailDotFormat = companyEmail.replace(/,/g, '.');
    const hasDeletePermission = await hasPermission(userEmail, companyEmailDotFormat, projectId, 'deleteAnnotations');
    
    if (!hasDeletePermission) {
      if (typeof showToast === 'function') {
        showToast('You do not have permission to delete annotations in this project', 'error');
      }
      return; // Exit early if permission denied
    }
  }
  
  try {
    const annotationHistory = await getAnnotationHistory();
    if (!Array.isArray(annotationHistory) || annotationHistory.length === 0) {
      return;
    }
    
    const url = window.location.href;
    let updated = false;
    
    // Find and update the annotation entry
    for (let i = 0; i < annotationHistory.length; i++) {
      const entry = annotationHistory[i];
      if (!Array.isArray(entry)) continue;
      
      // Extract annotation data
      const entryUserText = entry.find(item => item.userText)?.userText || '';
      const entryKey = entry.find(item => item.key)?.key || '';
      const entryType = entry.find(item => item.type)?.type || '';
      const entryUrl = entry.find(item => item.url)?.url || '';
      const entryHighlightId = entry.find(item => item.highlightID)?.highlightID || '';
      const optionsObj = entry.find(item => item.options);
      const entryOptions = optionsObj?.options || [];
      
      // Check if this is the annotation we want to modify
      if (entryUserText === highlightedText && 
          entryUrl === url && 
          entryHighlightId === highlightId &&
          entryKey === key &&
          entryType.toLowerCase() === type.toLowerCase() &&
          entryOptions.includes(value)) {
        
        // Remove the specific option
        const optionIndex = entryOptions.indexOf(value);
        if (optionIndex > -1) {
          entryOptions.splice(optionIndex, 1);
          updated = true;
          
          // If no options remain, delete the entire annotation entry
          if (entryOptions.length === 0) {
            annotationHistory.splice(i, 1);
          }
        }
        break; // Found and updated, no need to continue
      }
    }
    
    // Save updated annotation history if changes were made
    if (updated) {
      try {
        const me = getCurrentUserMeta();
        if (me) {
          const url = window.location.href;
          for (let i = 0; i < annotationHistory.length; i++) {
            const entry = annotationHistory[i];
            if (!Array.isArray(entry)) continue;
            const entryUserText = entry.find(item => item && Object.prototype.hasOwnProperty.call(item, 'userText'))?.userText || '';
            const entryKey = entry.find(item => item && Object.prototype.hasOwnProperty.call(item, 'key'))?.key || '';
            const entryType = entry.find(item => item && Object.prototype.hasOwnProperty.call(item, 'type'))?.type || '';
            const entryUrl = entry.find(item => item && Object.prototype.hasOwnProperty.call(item, 'url'))?.url || '';
            const entryHighlightId = entry.find(item => item && Object.prototype.hasOwnProperty.call(item, 'highlightID'))?.highlightID || '';
            if (String(entryUserText) === String(highlightedText) && String(entryUrl) === String(url) && String(entryHighlightId) === String(highlightId) && String(entryKey) === String(key) && String(entryType).toLowerCase() === String(type).toLowerCase()) {
              upsertModifiedBy(entry, me);
              break;
            }
          }
        }
      } catch (_) {}
      const annotationKey = "annotationHistory";
      const annotationHistoryString = JSON.stringify(annotationHistory);
      await callSetItem(annotationKey, annotationHistoryString);
      console.log(`Deleted ${type} option: ${key}: ${value}`);
      document.dispatchEvent(new Event('annotationUpdated'));
      
      // Refresh the annotations map
      await refreshAnnotationsMap();
    }
  } catch (error) {
    console.error('Error deleting annotation option:', error);
  }
}

/**
 * Loads existing annotations (labels and notes) into the popup for editing
 * @param {Object} highlight - The highlight object
 * @param {HTMLElement} selectedLabelsContainer - Container for selected labels
 * @param {HTMLElement} richTextDiv - Rich text editor div for notes
 * @param {HTMLElement} canvas - Canvas element for drawing
 * @param {HTMLElement} canvasContainer - Container for canvas
 * @param {HTMLElement} toolbar - Rich text toolbar
 * @param {HTMLElement} textModeBtn - Text mode button
 * @param {HTMLElement} canvasModeBtn - Canvas mode button
 * @param {Object} modeRef - Reference object to update annotation mode
 */
async function loadExistingAnnotationsIntoPopup(highlight, selectedLabelsContainer, richTextDiv, canvas, canvasContainer, toolbar, textModeBtn, canvasModeBtn, modeRef) {
  // Clear existing content
  if (selectedLabelsContainer) {
    selectedLabelsContainer.innerHTML = '';
  }
  if (richTextDiv) {
    richTextDiv.innerHTML = '';
  }
  
  // Load labels and codes from window.highlightsToAnnotationsMap
  if (window.highlightsToAnnotationsMap && window.highlightsToAnnotationsMap[highlight.id]) {
    const annotations = window.highlightsToAnnotationsMap[highlight.id];
    for (var annotation of annotations) {
      const type = annotation.find(item => item.type)?.type || '';
      const key = annotation.find(item => item.key)?.key || '';
      const options = annotation.find(item => item.options)?.options || [];
      
      if (type.toLowerCase() === "label" && selectedLabelsContainer) {
        options.forEach(option => {
          // Add as pill with format "Key: Value"
          addSelectedLabel(option, key, selectedLabelsContainer, false);
        });
      }
    }
  }
  
  // Load notes from highlight.notes array
  if (highlight.notes && Array.isArray(highlight.notes) && highlight.notes.length > 0) {
    // Reload highlight from storage to get latest notes
    try {
      const highlights = await loadFunc() || [];
      const updatedHighlight = highlights.find(h => h.id === highlight.id);
      if (updatedHighlight && updatedHighlight.notes && Array.isArray(updatedHighlight.notes) && updatedHighlight.notes.length > 0) {
        // Separate text notes from canvas images
        const textNotes = [];
        const canvasNotes = [];
        
        updatedHighlight.notes.forEach(note => {
          if (note.includes('data:image/')) {
            canvasNotes.push(note);
          } else {
            textNotes.push(note);
          }
        });
        
        // Load text notes into rich text editor
        if (textNotes.length > 0 && richTextDiv) {
          richTextDiv.innerHTML = textNotes.join('<br><br>');
        }
        
        // Load canvas image into canvas (load the most recent one)
        if (canvasNotes.length > 0 && canvas) {
          const lastCanvasNote = canvasNotes[canvasNotes.length - 1];
          const imgMatch = lastCanvasNote.match(/src="([^"]*data:image\/[^"]+)"/);
          if (imgMatch && imgMatch[1]) {
            const img = new Image();
            img.onload = () => {
              const ctx = canvas.getContext('2d');
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              if (canvas._canvasStrokes) {
                canvas._canvasStrokes = [];
              }
            };
            img.src = imgMatch[1];
          }
        }
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      // Fallback to highlight.notes if reload fails
      if (highlight.notes && Array.isArray(highlight.notes) && highlight.notes.length > 0) {
        // Separate text and canvas notes
        const textNotes = [];
        const canvasNotes = [];
        
        highlight.notes.forEach(note => {
          if (note.includes('data:image/')) {
            canvasNotes.push(note);
          } else {
            textNotes.push(note);
          }
        });
        
        // Load text notes
        if (textNotes.length > 0 && richTextDiv) {
          richTextDiv.innerHTML = textNotes.join('<br><br>');
        }
        
        // Load canvas
        if (canvasNotes.length > 0 && canvas) {
          const lastCanvasNote = canvasNotes[canvasNotes.length - 1];
          const imgMatch = lastCanvasNote.match(/src="([^"]*data:image\/[^"]+)"/);
          if (imgMatch && imgMatch[1]) {
            const img = new Image();
            img.onload = () => {
              const ctx = canvas.getContext('2d');
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              if (canvas._canvasStrokes) {
                canvas._canvasStrokes = [];
              }
            };
            img.src = imgMatch[1];
          }
        }
      }
    }
  }
}

export async function createUnifiedAnnotationCard(highlight, containerSpan) {
  // Create the unified card container
  const annotationCard = document.createElement('div');
  annotationCard.className = 'phraze-unified-annotation-card PhrazeMark';
  annotationCard.style.position = 'absolute';
  annotationCard.style.zIndex = '1000000000';
  annotationCard.dataset.highlightId = highlight.id; // Add data attribute for easy lookup

  // Create the annotation popup for adding new notes
  const annotationPopup = document.createElement('div');
  annotationPopup.className = 'annotation-popup PhrazeMark';
  annotationPopup.style.display = 'none';
  annotationPopup.style.position = 'fixed';
  annotationPopup.style.zIndex = '1000000001';
  annotationPopup.dataset.highlightId = highlight.id; // Add data attribute to link popup to highlight
  
  // Check if this popup should be permanently closed from the start
  if (window.phrazePermanentlyClosedPopups && window.phrazePermanentlyClosedPopups.has(highlight.id)) {
    annotationPopup.dataset.permanentlyClosed = 'true';
    annotationPopup.style.display = 'none';
    annotationPopup.style.visibility = 'hidden';
    annotationPopup.style.opacity = '0';
    annotationPopup.style.pointerEvents = 'none';
  }

  // Create close button
  const closeButton = document.createElement('button');
  closeButton.className = 'annotation-close-btn';
  closeButton.innerHTML = '&times;';
  closeButton.title = 'Close';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '16px';
  closeButton.style.right = '16px';
  closeButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation(); // Prevent other handlers from firing
    
    // Mark as permanently closed
    annotationPopup.dataset.permanentlyClosed = 'true';
    if (!window.phrazePermanentlyClosedPopups) {
      window.phrazePermanentlyClosedPopups = new Set();
    }
    window.phrazePermanentlyClosedPopups.add(highlight.id);
    if (window.phrazeKeepPopupOpenIds) {
      window.phrazeKeepPopupOpenIds.delete(highlight.id);
    }
    
    // Close popup
    annotationPopup.style.display = 'none';
    annotationPopup.style.visibility = 'hidden';
    annotationPopup.style.opacity = '0';
    annotationPopup.style.pointerEvents = 'none';
    
    // Enable hover behavior on the container span after popup closes
    if (containerSpan._enableHover) {
      containerSpan._enableHover();
    }
    
    // Remove this highlight ID from the active list to prevent reopening
    if (window.phrazeActiveAnnotationCardIds) {
      const index = window.phrazeActiveAnnotationCardIds.indexOf(highlight.id);
      if (index > -1) {
        window.phrazeActiveAnnotationCardIds.splice(index, 1);
      }
    }
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
  
  // Create header text - check if highlight has existing annotations
  const hasExistingAnnotations = window.highlightsToAnnotationsMap && 
    window.highlightsToAnnotationsMap[highlight.id] && 
    window.highlightsToAnnotationsMap[highlight.id].length > 0;
  const headerText = document.createElement('span');
  headerText.textContent = hasExistingAnnotations ? 'Update Annotations' : 'Add Annotation';
  headerText.style.letterSpacing = '-0.025em';
  headerText.style.marginTop = '2px';
  
  headerSection.appendChild(annotationIcon);
  headerSection.appendChild(headerText);

  // Spacer to push color control to the right
  const headerSpacer = document.createElement('div');
  headerSpacer.style.flex = '1';
  headerSection.appendChild(headerSpacer);

  // Color picker (compact swatch + expandable palette)
  const colorWrapper = document.createElement('div');
  colorWrapper.style.position = 'relative';
  colorWrapper.style.display = 'inline-block';
  colorWrapper.style.userSelect = 'none';
  colorWrapper.setAttribute('role', 'button');
  colorWrapper.setAttribute('tabindex', '0');
  colorWrapper.setAttribute('aria-label', 'Select highlight color');

  const currentColor = (highlight && highlight.color) ? highlight.color : getDefaultHighlightColor().hex;
  const currentColorName = (highlight && highlight.colorName) ? highlight.colorName : getDefaultHighlightColor().name;

  const swatch = document.createElement('div');
  swatch.style.width = '18px';
  swatch.style.height = '18px';
  swatch.style.borderRadius = '50%';
  swatch.style.border = '1px solid #d1d5db';
  swatch.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
  swatch.style.background = currentColor;
  swatch.title = `Highlight color: ${currentColorName}`;

  const palette = document.createElement('div');
  palette.style.position = 'static';
  palette.style.background = '#ffffff';
  palette.style.border = '1px solid #e5e7eb';
  palette.style.borderRadius = '8px';
  palette.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)';
  palette.style.padding = '8px';
  palette.style.display = 'none';
  palette.style.width = '100%';
  palette.style.boxSizing = 'border-box';
  palette.style.marginTop = '8px';
  palette.setAttribute('role', 'menu');

  const presets = [
    { name: 'yellow', hex: '#FFF176' },
    { name: 'blue', hex: '#90CAF9' },
    { name: 'green', hex: '#A5D6A7' },
    { name: 'red', hex: '#EF9A9A' },
    { name: 'purple', hex: '#CE93D8' },
    { name: 'orange', hex: '#FFCC80' }
  ];

  function selectColor(hex, name) {
    // Check if user is a viewer - viewers cannot change default highlight color
    const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
    if (currentUserRole === 'viewer') {
      if (typeof showToast === 'function') {
        showToast('Viewers cannot change default highlight color', 'error');
      }
      return;
    }
    
    try {
      // Update in-memory object
      highlight.color = hex;
      highlight.colorName = name;

      // Update swatch
      swatch.style.background = hex;
      swatch.title = `Highlight color: ${name}`;

      // Apply to DOM marks
      applyHighlightColorToMarks(highlight.id, hex);

      // Persist last selected color
      try {
        localStorage.setItem('phrazeLastHighlightColorHex', hex);
        localStorage.setItem('phrazeLastHighlightColorName', name);
      } catch (_) { /* ignore */ }

      // Save preference to Firebase for cross-device persistence
      (async () => {
        try {
          await callSetItem('defaultHighlightColor', { hex, name }, true);
        } catch (e) { /* ignore */ }
      })();

      // Persist to Firebase (update the highlight entry)
      (async () => {
        try {
          let all = await loadFunc() || [];
          const idx = all.findIndex(h => h && h.id === highlight.id);
          if (idx >= 0) {
            all[idx].color = hex;
            all[idx].colorName = name;
            await saveFunc(all);
          }
        } catch (err) {
          console.warn('Failed saving color to Firebase', err);
        }
      })();
    } finally {
      palette.style.display = 'none';
    }
  }

  // Build grid
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(6, 24px)';
  grid.style.gap = '8px';
  grid.style.justifyContent = 'end';

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
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectColor(hex, name);
    });
    grid.appendChild(btn);
  });

  palette.appendChild(grid);
  colorWrapper.appendChild(swatch);
  headerSection.appendChild(palette);

  function togglePalette() {
    palette.style.display = palette.style.display === 'none' ? 'block' : 'none';
  }
  colorWrapper.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePalette();
  });
  colorWrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePalette();
    }
  });

  document.addEventListener('click', (e) => {
    if (!colorWrapper.contains(e.target)) {
      palette.style.display = 'none';
    }
  });

  headerSection.appendChild(colorWrapper);

  annotationPopup.appendChild(headerSection);

  // Create selected text preview section
  const selectedTextSection = document.createElement('div');
  selectedTextSection.style.marginBottom = '16px';
  
  const selectedTextLabel = document.createElement('div');
  selectedTextLabel.textContent = 'Selected text:';
  selectedTextLabel.style.fontSize = '14px';
  selectedTextLabel.style.fontWeight = '500';
  selectedTextLabel.style.color = '#6b7280';
  selectedTextLabel.style.marginBottom = '8px';
  selectedTextSection.appendChild(selectedTextLabel);
  
  const selectedTextPreview = document.createElement('div');
  selectedTextPreview.style.padding = '12px';
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
  
  // Get the highlighted text from the highlight object
  let highlightedText = '';
  if (highlight && highlight.textNodes && highlight.textNodes.length > 0) {
    // Extract text from the first text node's highlighted ranges
    const firstTextNode = highlight.textNodes[0];
    if (firstTextNode.wholeText && firstTextNode.highlightedRanges && firstTextNode.highlightedRanges.length > 0) {
      const range = firstTextNode.highlightedRanges[0];
      if (range.length >= 3) {
        const start = range[1];
        const end = range[2];
        highlightedText = firstTextNode.wholeText.substring(start, end);
      }
    }
  }
  
  // Fallback: try to get from DOM if highlight object doesn't have the text
  if (!highlightedText) {
    const mark = containerSpan.querySelector('mark[id="PhrazeHighlight"]');
    if (mark) {
      highlightedText = mark.textContent;
    } else {
      // Last resort: try to get text from the container itself
      highlightedText = containerSpan.textContent || containerSpan.innerText || '';
    }
  }
  
  selectedTextPreview.textContent = highlightedText;
  selectedTextSection.appendChild(selectedTextPreview);
  annotationPopup.appendChild(selectedTextSection);

  // Always create labels section for all highlights (enables editing)
  let selectedLabelsContainer = null;
  
  // Create labels section for all highlights
  {
    // Removed excessive logging
    // console.log('Creating labels section for highlight');
    const popupLabelsSection = document.createElement('div');
    popupLabelsSection.className = 'labels-section';
    
    const labelsHeader = document.createElement('div');
    labelsHeader.className = 'labels-header';
    labelsHeader.textContent = 'Labels:';
    popupLabelsSection.appendChild(labelsHeader);
    
    const labelsToggleBtn = document.createElement('button');
    labelsToggleBtn.className = 'labels-toggle-btn';
    labelsToggleBtn.innerHTML = 'Add Label <span>&#9662;</span>';
    popupLabelsSection.appendChild(labelsToggleBtn);
    
    const labelsDropdown = document.createElement('div');
    labelsDropdown.className = 'labels-dropdown';
    labelsDropdown.style.display = 'none';
    
    // Populate dropdown with labels from labelMap (top 4 categories only)
    const labelMap = {
      Sentiment: ['Positive', 'Neutral', 'Negative'],
      Tone: ['Professional', 'Casual', 'Friendly', 'Critical'],
      Intent: ['Question', 'Statement', 'Request', 'Feedback'],
      Emotion: ['Happy', 'Frustrated', 'Confused', 'Satisfied']
    };
    
    Object.entries(labelMap).forEach(([labelType, options]) => {
      const labelTypeDiv = document.createElement('div');
      labelTypeDiv.className = 'label-type-header';
      labelTypeDiv.textContent = labelType;
      labelsDropdown.appendChild(labelTypeDiv);
      
      options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'label-option';
        optionDiv.textContent = option;
        optionDiv.addEventListener('click', () => {
          addSelectedLabel(option, labelType, selectedLabelsContainer);
          labelsDropdown.style.display = 'none';
          labelsToggleBtn.innerHTML = 'Add Label <span>&#9662;</span>';
        });
        labelsDropdown.appendChild(optionDiv);
      });
    });
    
    // Add "Create Custom Label" option at the bottom - only for owners/editors
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
    createCustomLabelDiv.addEventListener('click', () => {
      showCreateCustomModal('label', labelsDropdown, selectedLabelsContainer, labelsToggleBtn);
    });
    labelsDropdown.appendChild(createCustomLabelDiv);
    }
    
    popupLabelsSection.appendChild(labelsDropdown);
    
    // Selected labels container
    selectedLabelsContainer = document.createElement('div');
    selectedLabelsContainer.className = 'selected-labels-container';
    popupLabelsSection.appendChild(selectedLabelsContainer);
    
    // Load and add custom labels after container is created
    await loadCustomLabelsIntoDropdown(labelsDropdown, selectedLabelsContainer, labelsToggleBtn);
    
    // Toggle dropdown
    labelsToggleBtn.addEventListener('click', () => {
      const isVisible = labelsDropdown.style.display !== 'none';
      labelsDropdown.style.display = isVisible ? 'none' : 'block';
      labelsToggleBtn.innerHTML = isVisible ? 'Add Label <span>&#9662;</span>' : 'Add Label <span>&#9652;</span>';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!popupLabelsSection.contains(e.target)) {
        labelsDropdown.style.display = 'none';
        labelsToggleBtn.innerHTML = 'Add Label <span>&#9662;</span>';
      }
    });
    
    annotationPopup.appendChild(popupLabelsSection);
  }

  // Create annotation header below selected text
  const annotationHeader = document.createElement('div');
  annotationHeader.textContent = 'Annotation:';
  annotationHeader.style.fontSize = '14px';
  annotationHeader.style.fontWeight = '500';
  annotationHeader.style.color = '#6b7280';
  annotationHeader.style.marginBottom = '8px';
  
  annotationPopup.appendChild(annotationHeader);

  // Create rich text toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'annotation-toolbar';
  toolbar.style.display = 'flex';
  toolbar.style.gap = '4px';
  toolbar.style.marginBottom = '8px';
  toolbar.style.alignItems = 'center';
  
  // Bold button
  const boldBtn = document.createElement('button');
  boldBtn.type = 'button';
  boldBtn.className = 'toolbar-btn';
  boldBtn.innerHTML = '<i class="fas fa-bold"></i>';
  boldBtn.title = 'Bold';
  boldBtn.style.cssText = `
    width: 28px;
    height: 28px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #374151;
    transition: all 0.15s ease;
  `;
  
  // Italic button
  const italicBtn = document.createElement('button');
  italicBtn.type = 'button';
  italicBtn.className = 'toolbar-btn';
  italicBtn.innerHTML = '<i class="fas fa-italic"></i>';
  italicBtn.title = 'Italic';
  italicBtn.style.cssText = boldBtn.style.cssText;
  
  // Color picker button
  const colorBtn = document.createElement('button');
  colorBtn.type = 'button';
  colorBtn.className = 'toolbar-btn';
  colorBtn.innerHTML = '<i class="fa fa-palette"></i>';
  colorBtn.title = 'Text Color';
  colorBtn.style.cssText = boldBtn.style.cssText;
  
  // Hidden color input
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.style.display = 'none';
  colorInput.value = '#000000';
  
  // Add buttons to toolbar
  toolbar.appendChild(boldBtn);
  toolbar.appendChild(italicBtn);
  toolbar.appendChild(colorBtn);
  toolbar.appendChild(colorInput);
  
  // Image upload button
  const imageBtn = document.createElement('button');
  imageBtn.type = 'button';
  imageBtn.className = 'toolbar-btn';
  imageBtn.innerHTML = '<i class="fas fa-image"></i>';
  imageBtn.title = 'Upload Image';
  imageBtn.style.cssText = boldBtn.style.cssText;
  
  // Hidden file input for image upload
  const imageInput = document.createElement('input');
  imageInput.type = 'file';
  imageInput.accept = 'image/*';
  imageInput.style.display = 'none';
  
  // Add image button and input to toolbar
  toolbar.appendChild(imageBtn);
  toolbar.appendChild(imageInput);
  
  // Create contenteditable div instead of textarea for rich text
  const richTextDiv = document.createElement('div');
  richTextDiv.contentEditable = true;
  richTextDiv.className = 'annotation-richtext';
  richTextDiv.style.cssText = `
    width: 100%;
    min-height: 80px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 8px;
    font-size: 14px;
    font-family: inherit;
    line-height: 1.4;
    background-color: white;
    color: #374151;
    outline: none;
    transition: border-color 0.2s ease;
    overflow-y: auto;
  `;
  
  // Set placeholder text
  richTextDiv.setAttribute('data-placeholder', 'Share your insights, questions, or observations');
  
  // Add focus/blur events
  richTextDiv.addEventListener('focus', () => {
    richTextDiv.style.borderColor = '#3b82f6';
  });
  
  richTextDiv.addEventListener('blur', () => {
    richTextDiv.style.borderColor = '#e5e7eb';
  });
  
  // Handle paste to strip formatting and paste as plain text
  richTextDiv.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  });
  
  // Add toolbar event listeners
  boldBtn.addEventListener('click', () => {
    document.execCommand('bold', false, null);
    richTextDiv.focus();
  });
  
  italicBtn.addEventListener('click', () => {
    document.execCommand('italic', false, null);
    richTextDiv.focus();
  });
  
  colorBtn.addEventListener('click', () => {
    colorInput.click();
  });
  
  colorInput.addEventListener('change', () => {
    document.execCommand('foreColor', false, colorInput.value);
    richTextDiv.focus();
  });
  
  // Image upload functionality
  imageBtn.addEventListener('click', () => {
    imageInput.click();
  });
  
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const img = document.createElement('img');
        img.src = event.target.result;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.maxHeight = '200px';
        img.style.borderRadius = '4px';
        img.style.margin = '4px 0';
        img.style.display = 'block';
        
        // Insert image at cursor position or at end
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
        } else {
          richTextDiv.appendChild(img);
        }
        
        // Add a line break after image
        const br = document.createElement('br');
        img.parentNode.insertBefore(br, img.nextSibling);
        
        // Force a re-render of the content
        richTextDiv.innerHTML = richTextDiv.innerHTML;
        
        richTextDiv.focus();
        
        console.log('Image inserted:', img.outerHTML);
        console.log('Rich text content:', richTextDiv.innerHTML);
      };
      reader.readAsDataURL(file);
    }
    // Reset file input
    imageInput.value = '';
  });
  
  // Hover effects for toolbar buttons
  [boldBtn, italicBtn, colorBtn, imageBtn].forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = '#f3f4f6';
      btn.style.borderColor = '#9ca3af';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = 'white';
      btn.style.borderColor = '#d1d5db';
    });
  });
  
  // Mode toggle (Text/Canvas)
  let annotationMode = 'text'; // 'text' or 'canvas'
  const modeRef = { current: 'text' }; // Reference object for mode sharing
  const modeToggleContainer = document.createElement('div');
  modeToggleContainer.style.cssText = `
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
    align-items: center;
  `;
  
  const textModeBtn = document.createElement('button');
  textModeBtn.type = 'button';
  textModeBtn.textContent = 'Text';
  textModeBtn.style.cssText = `
    padding: 6px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid #e5e7eb;
    background: #f3f4f6;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
  `;
  
  const canvasModeBtn = document.createElement('button');
  canvasModeBtn.type = 'button';
  canvasModeBtn.textContent = 'Canvas';
  canvasModeBtn.style.cssText = `
    padding: 6px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid #e5e7eb;
    background: white;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s ease;
  `;
  
  const updateModeButtons = () => {
    if (annotationMode === 'text' || modeRef.current === 'text') {
      textModeBtn.style.background = '#f3f4f6';
      textModeBtn.style.color = '#374151';
      canvasModeBtn.style.background = 'white';
      canvasModeBtn.style.color = '#9ca3af';
    } else {
      textModeBtn.style.background = 'white';
      textModeBtn.style.color = '#9ca3af';
      canvasModeBtn.style.background = '#f3f4f6';
      canvasModeBtn.style.color = '#374151';
    }
  };
  
  textModeBtn.addEventListener('click', () => {
    annotationMode = 'text';
    modeRef.current = 'text';
    canvas.dataset.annotationMode = 'text';
    updateModeButtons();
    richTextDiv.style.display = 'block';
    toolbar.style.display = 'flex';
    canvasContainer.style.display = 'none';
    richTextDiv.focus();
  });
  
  canvasModeBtn.addEventListener('click', () => {
    annotationMode = 'canvas';
    modeRef.current = 'canvas';
    canvas.dataset.annotationMode = 'canvas';
    updateModeButtons();
    richTextDiv.style.display = 'none';
    toolbar.style.display = 'none';
    canvasContainer.style.display = 'block';
  });
  
  modeToggleContainer.appendChild(textModeBtn);
  modeToggleContainer.appendChild(canvasModeBtn);
  
  // Create canvas container
  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = `
    display: none;
    margin-bottom: 8px;
  `;
  
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  canvas.style.cssText = `
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    cursor: crosshair;
    background-color: rgba(255, 255, 255, 0.9);
    display: block;
    margin: 0 auto;
    width: 100%;
    max-width: 400px;
  `;
  
  // Canvas drawing state
  let isDrawing = false;
  let canvasStrokes = [];
  let currentStroke = [];
  const strokeColor = '#ff6b6b';
  const strokeWidth = 3;
  
  // Store canvas state on canvas element for access in loading function
  canvas.dataset.annotationMode = 'text';
  canvas._canvasStrokes = canvasStrokes;
  
  // Canvas drawing functions
  const getMousePos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };
  
  const startCanvasDrawing = (e) => {
    isDrawing = true;
    const pos = getMousePos(e);
    currentStroke = [pos];
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };
  
  const drawOnCanvas = (e) => {
    if (!isDrawing) return;
    const pos = getMousePos(e);
    currentStroke.push(pos);
    const ctx = canvas.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };
  
  const stopCanvasDrawing = () => {
    if (!isDrawing) return;
    isDrawing = false;
    if (currentStroke.length > 1) {
      canvasStrokes.push([...currentStroke]);
      canvas._canvasStrokes = canvasStrokes;
    }
    currentStroke = [];
  };
  
  const clearCanvas = () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvasStrokes = [];
    canvas._canvasStrokes = canvasStrokes;
    currentStroke = [];
  };
  
  const redrawCanvas = () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    
    canvasStrokes.forEach(stroke => {
      if (stroke.length > 1) {
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        stroke.forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      }
    });
  };
  
  // Canvas event listeners
  canvas.addEventListener('mousedown', startCanvasDrawing);
  canvas.addEventListener('mousemove', drawOnCanvas);
  canvas.addEventListener('mouseup', stopCanvasDrawing);
  canvas.addEventListener('mouseleave', stopCanvasDrawing);
  
  // Canvas toolbar
  const canvasToolbar = document.createElement('div');
  canvasToolbar.style.cssText = `
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-bottom: 8px;
  `;
  
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear';
  clearBtn.style.cssText = `
    padding: 6px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: white;
    color: #374151;
    cursor: pointer;
    font-size: 12px;
  `;
  clearBtn.addEventListener('click', clearCanvas);
  canvasToolbar.appendChild(clearBtn);
  
  canvasContainer.appendChild(canvasToolbar);
  canvasContainer.appendChild(canvas);

  // Add mode toggle, toolbar, rich text div, and canvas container to popup
  annotationPopup.appendChild(modeToggleContainer);
  annotationPopup.appendChild(toolbar);
  annotationPopup.appendChild(richTextDiv);
  annotationPopup.appendChild(canvasContainer);

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'button-container';

  // Create Save button
  const addAnnotationButton = document.createElement('button');
  addAnnotationButton.className = 'add-annotation-button';
  
  // Check permissions for creating/modifying annotations
  const annotationPerms = typeof window !== 'undefined' ? window.currentUserPermissions : null;
  const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
  
  // Owners always have all permissions, editors need explicit permissions
  const isOwner = currentUserRole === 'owner';
  const isEditor = currentUserRole === 'editor';
  
  const canCreateAnnotations = isOwner || (isEditor && annotationPerms && isPermissionEnabled(annotationPerms, 'createAnnotations'));
  const canDeleteAnnotations = isOwner || (isEditor && annotationPerms && isPermissionEnabled(annotationPerms, 'deleteAnnotations'));
  // createAnnotations covers both creating and modifying annotations (they're the same operation in Firebase)
  const canAnnotate = canCreateAnnotations;
  
  if (!canAnnotate) {
    addAnnotationButton.style.display = 'none'; // Hide button if no permission
  }
  
  // Create save icon
  const saveIcon = document.createElement('span');
  saveIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32"><path fill="currentColor" d="M5 7.5A2.5 2.5 0 0 1 7.5 5H9v4.5a2.5 2.5 0 0 0 2.5 2.5h8A2.5 2.5 0 0 0 22 9.5V5.04a2.5 2.5 0 0 1 1.318.692l2.95 2.95A2.5 2.5 0 0 1 27 10.45V24.5a2.5 2.5 0 0 1-2 2.45V18.5a2.5 2.5 0 0 0-2.5-2.5h-13A2.5 2.5 0 0 0 7 18.5v8.45a2.5 2.5 0 0 1-2-2.45zM9 27v-8.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5V27zM20 5v4.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5V5zM7.5 3A4.5 4.5 0 0 0 3 7.5v17A4.5 4.5 0 0 0 7.5 29h17a4.5 4.5 0 0 0 4.5-4.5V10.45a4.5 4.5 0 0 0-1.318-3.182l-2.95-2.95A4.5 4.5 0 0 0 21.55 3z"/></svg>';
  
  addAnnotationButton.appendChild(saveIcon);
  // Use same check as header - show "Add" for new highlights, "Update" for existing
  const buttonText = hasExistingAnnotations ? ' Update Annotations' : ' Add Annotation';
  addAnnotationButton.appendChild(document.createTextNode(buttonText));

  // Add Annotation button click handler (handles notes, labels, and codes)
  addAnnotationButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation(); // Prevent other handlers from firing
    
    // Double-check permission before processing annotation
    if (!canAnnotate) {
      if (typeof showToast === 'function') {
        showToast('You do not have permission to ' + (hasExistingAnnotations ? 'modify' : 'create') + ' annotations', 'error');
      }
      return;
    }
    
    // Prevent multiple simultaneous operations
    if (window.phrazeProcessingAnnotation) {
      console.log('Already processing annotation, ignoring click');
      return;
    }
    window.phrazeProcessingAnnotation = true;
    
    console.log(hasExistingAnnotations ? 'Update Annotations button clicked' : 'Add Annotation button clicked');
    
    // IMMEDIATELY mark popup as permanently closed BEFORE any async operations
    // This prevents the popup from reappearing when Firebase listeners fire
    annotationPopup.dataset.permanentlyClosed = 'true';
    if (!window.phrazePermanentlyClosedPopups) {
      window.phrazePermanentlyClosedPopups = new Set();
    }
    window.phrazePermanentlyClosedPopups.add(highlight.id);
    if (window.phrazeKeepPopupOpenIds) {
      window.phrazeKeepPopupOpenIds.delete(highlight.id);
    }
    
    // Also mark ALL popups with this highlight ID as permanently closed (in case they get recreated)
    const allExistingPopups = document.querySelectorAll(`.annotation-popup[data-highlight-id="${highlight.id}"]`);
    allExistingPopups.forEach(popup => {
      popup.dataset.permanentlyClosed = 'true';
    });
    
    // Remove from active list immediately
    if (window.phrazeActiveAnnotationCardIds) {
      const index = window.phrazeActiveAnnotationCardIds.indexOf(highlight.id);
      if (index > -1) {
        window.phrazeActiveAnnotationCardIds.splice(index, 1);
      }
    }
    
    // CRITICAL: Remove from active card IDs to prevent popup from showing again
    // This ensures that even if loadHighlights is called again, it won't treat this as a new highlight
    // The active card IDs list is used to determine shouldBeActive, so removing it prevents popup from showing
    if (window.phrazeActiveAnnotationCardIds) {
      const prevIndex = window.phrazeActiveAnnotationCardIds.indexOf(highlight.id);
      if (prevIndex > -1) {
        window.phrazeActiveAnnotationCardIds.splice(prevIndex, 1);
      }
    }
    
    // Close popup immediately (visually)
    annotationPopup.style.display = 'none';
    annotationPopup.style.visibility = 'hidden';
    annotationPopup.style.opacity = '0';
    annotationPopup.style.pointerEvents = 'none';
    
    // Also close any popup with this highlight ID (in case it's been recreated)
    const allPopups = document.querySelectorAll(`.annotation-popup[data-highlight-id="${highlight.id}"]`);
    allPopups.forEach(popup => {
      popup.style.display = 'none';
      popup.style.visibility = 'hidden';
      popup.style.opacity = '0';
      popup.style.pointerEvents = 'none';
      popup.dataset.permanentlyClosed = 'true';
    });
    
    // Set highlight ID to ensure annotations are saved with correct ID
    localStorage.setItem('globalHighlightID', highlight.id);
    
    // Get the highlighted text
    let highlightedText = '';
    if (highlight && highlight.textNodes && highlight.textNodes.length > 0) {
      const firstTextNode = highlight.textNodes[0];
      if (firstTextNode.wholeText && firstTextNode.highlightedRanges && firstTextNode.highlightedRanges.length > 0) {
        const range = firstTextNode.highlightedRanges[0];
        if (range.length >= 3) {
          const start = range[1];
          const end = range[2];
          highlightedText = firstTextNode.wholeText.substring(start, end);
        }
      }
    }
    
    // Fallback: try to get from DOM
    if (!highlightedText) {
      const mark = containerSpan.querySelector('mark[id="PhrazeHighlight"]');
      if (mark) {
        highlightedText = mark.textContent;
      }
    }
    
    if (!highlightedText) {
      console.error('Could not determine highlighted text');
      window.phrazeProcessingAnnotation = false;
      return;
    }

    // Get note content - collect both text and canvas
    const notesToSave = [];
    
    // Add text note if it exists
    const textContent = richTextDiv.innerHTML.trim();
    if (textContent) {
      notesToSave.push(textContent);
    }
    
    // Add canvas drawing if it has content
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let hasDrawing = false;
      
      // Check if there are any non-white/non-transparent pixels
      for (let i = 0; i < imageData.data.length; i += 4) {
        const a = imageData.data[i + 3];
        if (a > 0) {
          hasDrawing = true;
          break;
        }
      }
      
      if (hasDrawing) {
        const canvasDataUrl = canvas.toDataURL('image/png');
        notesToSave.push(`<img src="${canvasDataUrl}" alt="Canvas drawing" style="max-width: 100%; height: auto;" />`);
      }
    }
    
    // Combine all notes
    let noteText = notesToSave.join('<br><br>');
    
    const selectedLabels = [];
    
    // Get selected labels from the container
    if (selectedLabelsContainer) {
      const labelTags = selectedLabelsContainer.querySelectorAll('.selected-label-tag');
      labelTags.forEach(tag => {
        const labelText = tag.textContent.replace('×', '').trim(); // Remove the × button text
        const [labelType, labelValue] = labelText.split(': ');
        if (labelType && labelValue) {
          selectedLabels.push({ type: labelType, value: labelValue });
        }
      });
    }
    
    console.log('Updating annotations with:', { noteText, selectedLabels });
    
    // FIRST: Handle deletions - remove annotations that were removed from popup
    await handleAnnotationDeletions(highlightedText, highlight.id, selectedLabels);
    
    // Save new labels (only those that don't already exist)
    if (selectedLabels.length > 0) {
      try {
        // Get existing annotations to check for duplicates
        const annotationHistory = await getAnnotationHistory();
        const existingLabelKeys = new Set();
        
        annotationHistory.forEach(entry => {
          if (!Array.isArray(entry)) return;
          const entryUserText = entry.find(item => item.userText)?.userText || '';
          const entryKey = entry.find(item => item.key)?.key || '';
          const entryType = entry.find(item => item.type)?.type || '';
          const entryUrl = entry.find(item => item.url)?.url || '';
          const entryHighlightId = entry.find(item => item.highlightID)?.highlightID || '';
          const entryOptions = entry.find(item => item.options)?.options || [];
          
          if (entryUserText === highlightedText && 
              entryUrl === window.location.href && 
              entryHighlightId === highlight.id &&
              entryType.toLowerCase() === 'label') {
            entryOptions.forEach(opt => {
              existingLabelKeys.add(`${entryKey}: ${opt}`);
            });
          }
        });
        
        // Save each label that doesn't already exist
        for (const labelData of selectedLabels) {
          const labelKey = `${labelData.type}: ${labelData.value}`;
          if (!existingLabelKeys.has(labelKey)) {
            await addSelectedTextEntry(highlightedText, labelData.type, 'label', labelData.value);
            // console.log(`Label saved: ${labelData.type} - ${labelData.value}`);
            } else {
            // console.log(`Label already exists, skipping: ${labelKey}`);
          }
        }
      } catch (error) {
        console.error('Failed to save labels:', error);
      }
    }
    
    // Handle notes - replace all notes with the new content
    try {
      // Get current notes from storage
      const highlights = await loadFunc() || [];
      const currentHighlight = highlights.find(h => h.id === highlight.id);
      
      if (noteText) {
        // If there's note text, save it as a single note (or split by <br><br> if multiple)
        const noteParts = noteText.split('<br><br>').filter(part => part.trim());
        if (noteParts.length > 0) {
          // Delete all existing notes first
          if (currentHighlight && currentHighlight.notes && Array.isArray(currentHighlight.notes)) {
            for (const oldNote of currentHighlight.notes) {
              try {
                await removeNoteFromStorage(highlight.id, oldNote);
              } catch (err) {
                console.warn('Error removing old note:', err);
              }
            }
          }
          
          // Add new notes
          for (const notePart of noteParts) {
            await addNoteToStorage(highlight.id, notePart.trim());
          }
        }
      } else {
        // If note text is empty, delete all existing notes
        if (currentHighlight && currentHighlight.notes && Array.isArray(currentHighlight.notes)) {
          for (const oldNote of currentHighlight.notes) {
            try {
              await removeNoteFromStorage(highlight.id, oldNote);
            } catch (err) {
              console.warn('Error removing note:', err);
            }
          }
        }
      }
      // console.log('Notes updated successfully');
    } catch (error) {
      console.error('Failed to update notes:', error);
    }
    
    // Note: Popup was already closed at the start of this handler to prevent race conditions
    
    // Update the card DOM directly and immediately with the new annotations
    // This ensures the brief preview shows the UPDATED content, not old content
    const labelsContainer = annotationCard.querySelector('.labels-container');
    const notesList = annotationCard.querySelector('.phraze-note-list');
    
    if (labelsContainer) {
      // Clear existing labels
      labelsContainer.innerHTML = '';
      
      // Add updated label pills directly to DOM with delete arrows
      selectedLabels.forEach(({ type, value }) => {
        const labelPill = document.createElement('span');
        labelPill.className = 'label-pill';
        labelPill.style.position = 'relative';
        labelPill.style.paddingRight = '18px';
        applyUnifiedLabelPillStyle(labelPill, type);
        
        const textSpan = document.createElement('span');
        textSpan.textContent = `${type}: ${value}`;
        labelPill.appendChild(textSpan);
        
        const deleteArrow = document.createElement('button');
        deleteArrow.innerHTML = '×';
        deleteArrow.type = 'button';
        deleteArrow.style.cssText = `
          position: absolute;
          right: 2px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          font-size: 10px;
          cursor: pointer;
          padding: 0;
          width: 12px;
          height: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9ca3af;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s ease, color 0.15s ease;
        `;
        
        labelPill.addEventListener('mouseenter', () => {
          deleteArrow.style.opacity = '1';
          deleteArrow.style.visibility = 'visible';
        });
        labelPill.addEventListener('mouseleave', () => {
          deleteArrow.style.opacity = '0';
          deleteArrow.style.visibility = 'hidden';
        });
        deleteArrow.addEventListener('mouseenter', () => deleteArrow.style.color = '#dc2626');
        deleteArrow.addEventListener('mouseleave', () => deleteArrow.style.color = '#9ca3af');
        deleteArrow.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (highlightedText) {
            await deleteSingleAnnotationOption(highlightedText, highlight.id, type, value, 'label');
            await updateAnnotationCard(highlight.id);
          }
        });
        
        labelPill.appendChild(deleteArrow);
        labelsContainer.appendChild(labelPill);
      });
      
      console.log('Card DOM updated directly with', selectedLabels.length, 'labels');
    }
    
    // Update notes list directly if noteText was provided
        if (notesList) {
      notesList.innerHTML = '';
      if (noteText) {
        const noteParts = noteText.split('<br><br>').filter(part => part.trim());
        noteParts.forEach(notePart => {
          const listItem = document.createElement('li');
          listItem.style.display = 'flex';

          const textSpan = document.createElement('span');
          textSpan.className = 'phraze-note-text PhrazeMark';
          textSpan.innerHTML = notePart.trim();
          listItem.appendChild(textSpan);

          const deleteButton = document.createElement('button');
          deleteButton.className = 'phraze-note-delete-btn PhrazeMark';
          deleteButton.innerHTML = '&times;';
          deleteButton.title = 'Delete note';
          deleteButton.style.flexShrink = '0';
          deleteButton.style.background = '#eee';
          deleteButton.style.border = '1px solid #ccc';
          deleteButton.style.color = '#777';
          deleteButton.style.borderRadius = '50%';
          deleteButton.style.width = '16px';
          deleteButton.style.height = '16px';
          deleteButton.style.fontSize = '10px';
          deleteButton.style.lineHeight = '14px';
          deleteButton.style.textAlign = 'center';
          deleteButton.style.cursor = 'pointer';
          deleteButton.style.padding = '0';
          deleteButton.style.marginLeft = '5px';

          deleteButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
              await removeNoteFromStorage(highlight.id, notePart.trim());
              listItem.remove();
              console.log('Note deleted successfully');
            } catch (error) {
              console.error('Failed to delete note:', error);
            }
          });

          listItem.appendChild(deleteButton);
          notesList.appendChild(listItem);
        });
      }
    }
    
    // Clear the form
    richTextDiv.innerHTML = '';
    if (selectedLabelsContainer) {
      selectedLabelsContainer.innerHTML = '';
    }
    
    // Mark this highlight to keep its card visible even through loadHighlights reloads
    // This survives Firebase listener triggers
    // We DON'T show the card immediately - let loadHighlights() show it after Firebase updates
    // This prevents showing it twice (once without color, once with color)
    if (!window.phrazeShowCardUntil) {
      window.phrazeShowCardUntil = {};
    }
    // Keep the card visible for 4.5 seconds from now
    // The extra 0.5s accounts for Firebase update delay, ensuring card stays visible for full 4s after it appears
    window.phrazeShowCardUntil[highlight.id] = Date.now() + 4500;
    
    // Refresh annotations map in the background
    // loadHighlights() will be triggered by Firebase and will show the card with updated color
    refreshAnnotationsMap().then(() => {
      // After refresh completes, update the card if it exists
      updateAnnotationCard(highlight.id);
      
      // Ensure popup stays closed after annotation is saved (in case Firebase listeners tried to reopen it)
      // This is a critical safeguard - mark ALL popups with this ID as permanently closed
      const allPopups = document.querySelectorAll(`.annotation-popup[data-highlight-id="${highlight.id}"]`);
      allPopups.forEach(popup => {
        popup.style.display = 'none';
        popup.style.visibility = 'hidden';
        popup.style.opacity = '0';
        popup.style.pointerEvents = 'none';
        popup.dataset.permanentlyClosed = 'true';
      });
      
      // Also ensure the Set tracking is updated
      if (!window.phrazePermanentlyClosedPopups) {
        window.phrazePermanentlyClosedPopups = new Set();
      }
      window.phrazePermanentlyClosedPopups.add(highlight.id);
    }).catch(err => {
      console.error('Error refreshing annotations map:', err);
    });
    
    // Clear processing flag after a short delay
    setTimeout(() => {
      window.phrazeProcessingAnnotation = false;
      
      // Final safeguard: ensure popup is still closed
      // Check both the Set and the DOM attribute to be thorough
      const isInClosedSet = window.phrazePermanentlyClosedPopups && window.phrazePermanentlyClosedPopups.has(highlight.id);
      const allPopups = document.querySelectorAll(`.annotation-popup[data-highlight-id="${highlight.id}"]`);
      allPopups.forEach(popup => {
        // If it's in the Set OR marked in DOM, keep it closed
        if (isInClosedSet || popup.dataset.permanentlyClosed === 'true') {
          popup.style.display = 'none';
          popup.style.visibility = 'hidden';
          popup.style.opacity = '0';
          popup.style.pointerEvents = 'none';
          popup.dataset.permanentlyClosed = 'true';
        }
      });
    }, 500);
    
    // Auto-hide after 4.5 seconds (gives user time to see the changes)
    // This timeout is a backup - loadHighlights() cleanup will also handle hiding expired cards
    setTimeout(() => {
      // Remove from the "show card" tracking
      if (window.phrazeShowCardUntil) {
        delete window.phrazeShowCardUntil[highlight.id];
      }
      
      // Find the card by highlight ID (it might have been recreated by loadHighlights)
      const cardToHide = document.querySelector(`.phraze-unified-annotation-card[data-highlight-id="${highlight.id}"]`);
      
      // Auto-hide card after preview (only if not being hovered)
      if (cardToHide && !cardToHide.matches(':hover')) {
        cardToHide.classList.remove('active');
        cardToHide.style.opacity = '0';
        cardToHide.style.pointerEvents = 'none';
        cardToHide.style.visibility = 'hidden';
      }
    }, 4500);
  });

  buttonContainer.appendChild(addAnnotationButton);
  annotationPopup.appendChild(buttonContainer);

  // Add popup to body
  document.body.appendChild(annotationPopup);

  // Store popup reference on card for easier access
  annotationCard._annotationPopup = annotationPopup;
  // Store container span reference for repositioning during resize
  annotationCard._containerSpan = containerSpan;

  // Create the unified card content
  // Header section with profile and username
  const cardHeader = document.createElement('div');
  cardHeader.className = 'annotation-card-header';
  
  // Profile section
  const profileSection = document.createElement('div');
  profileSection.className = 'profile-section';
  profileSection.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  
  // Profile image
  const profileImg = document.createElement('img');
  profileImg.alt = '';
  profileImg.className = 'profile-image';
  profileImg.style.cssText = `
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background-color: #e5e7eb;
  `;
  
  const displayEmail = highlight.userEmail ? highlight.userEmail.replace(/,/g, '.') : 'User';
  
  if (highlight.userEmail) {
    // Load profile picture from Firebase
    loadHighlightProfilePicture(profileImg, highlight.userEmail, highlight.companyEmail);
  } else {
    // No email - show default avatar fallback
    showFallbackInitial(profileImg, 'User');
  }
  
  // Username
  const username = document.createElement('span');
  username.className = 'username';
  username.style.cssText = `
    font-size: 13px;
    color: #374151;
    font-weight: 500;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
  username.textContent = displayEmail;
  
  profileSection.appendChild(profileImg);
  profileSection.appendChild(username);
  cardHeader.appendChild(profileSection);
  
  // Spacer and color control for unified card header
  const cardHeaderSpacer = document.createElement('div');
  cardHeaderSpacer.style.flex = '1';
  cardHeader.appendChild(cardHeaderSpacer);

  // Right side container for color selector
  const rightSideContainer = document.createElement('div');
  rightSideContainer.style.display = 'flex';
  rightSideContainer.style.flexDirection = 'column';
  rightSideContainer.style.alignItems = 'flex-start';
  rightSideContainer.style.gap = '6px';


  const cardColorWrapper = document.createElement('div');
  cardColorWrapper.style.position = 'relative';
  cardColorWrapper.style.display = 'inline-block';
  cardColorWrapper.style.userSelect = 'none';
  cardColorWrapper.setAttribute('role', 'button');
  cardColorWrapper.setAttribute('tabindex', '0');
  cardColorWrapper.setAttribute('aria-label', 'Select highlight color');

  const cardSwatch = document.createElement('div');
  cardSwatch.style.width = '14px';
  cardSwatch.style.height = '14px';
  cardSwatch.style.borderRadius = '50%';
  cardSwatch.style.border = '1px solid #d1d5db';
  cardSwatch.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
  cardSwatch.style.background = (highlight && highlight.color) ? highlight.color : getDefaultHighlightColor().hex;

  const cardPalette = document.createElement('div');
  cardPalette.style.position = 'static';
  cardPalette.style.background = '#ffffff';
  cardPalette.style.border = '1px solid #e5e7eb';
  cardPalette.style.borderRadius = '8px';
  cardPalette.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)';
  cardPalette.style.padding = '8px';
  cardPalette.style.display = 'none';
  cardPalette.style.width = '100%';
  cardPalette.style.boxSizing = 'border-box';
  cardPalette.style.marginTop = '8px';

  const cardGrid = document.createElement('div');
  cardGrid.style.display = 'grid';
  cardGrid.style.gridTemplateColumns = 'repeat(6, 24px)';
  cardGrid.style.gap = '8px';
  ;
  [{ name: 'yellow', hex: '#FFF176' }, { name: 'blue', hex: '#90CAF9' }, { name: 'green', hex: '#A5D6A7' }, { name: 'red', hex: '#EF9A9A' }, { name: 'purple', hex: '#CE93D8' }, { name: 'orange', hex: '#FFCC80' }].forEach(({ name, hex }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.width = '24px';
    btn.style.height = '24px';
    btn.style.borderRadius = '50%';
    btn.style.border = '1px solid #d1d5db';
    btn.style.background = hex;
    btn.style.cursor = 'pointer';
    btn.setAttribute('aria-label', `Select ${name} highlight color`);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Check if user is a viewer - viewers cannot change default highlight color
      const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
      if (currentUserRole === 'viewer') {
        if (typeof showToast === 'function') {
          showToast('Viewers cannot change default highlight color', 'error');
        }
        return;
      }
      
      highlight.color = hex;
      highlight.colorName = name;
      cardSwatch.style.background = hex;
      applyHighlightColorToMarks(highlight.id, hex);
      try {
        localStorage.setItem('phrazeLastHighlightColorHex', hex);
        localStorage.setItem('phrazeLastHighlightColorName', name);
      } catch (_) {}
      (async () => {
        try { await callSetItem('defaultHighlightColor', { hex, name }, true); } catch (_) {}
      })();
      (async () => {
        try {
          let all = await loadFunc() || [];
          const idx = all.findIndex(h => h && h.id === highlight.id);
          if (idx >= 0) {
            all[idx].color = hex;
            all[idx].colorName = name;
            await saveFunc(all);
          }
        } catch (err) { console.warn('Failed saving color to Firebase', err); }
      })();
      cardPalette.style.display = 'none';
    });
    cardGrid.appendChild(btn);
  });

  cardPalette.appendChild(cardGrid);
  cardColorWrapper.appendChild(cardSwatch);
  rightSideContainer.appendChild(cardPalette);
  cardColorWrapper.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    cardPalette.style.display = cardPalette.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', (e) => {
    if (!cardColorWrapper.contains(e.target)) {
      cardPalette.style.display = 'none';
    }
  });

  rightSideContainer.appendChild(cardColorWrapper);
  cardHeader.appendChild(rightSideContainer);
  
  // Labels section
  const labelsSection = document.createElement('div');
  labelsSection.className = 'labels-section';
  
  const labelsContainer = document.createElement('div');
  labelsContainer.className = 'labels-container';
  labelsSection.appendChild(labelsContainer);
  
  // Get annotations for this highlight
  let labelPills = [];
  
  // Try to get annotations from the global map first
  if (window.highlightsToAnnotationsMap && window.highlightsToAnnotationsMap[highlight.id]) {
    const annotations = window.highlightsToAnnotationsMap[highlight.id];
    // Removed excessive logging - was causing thousands of console messages
    // console.log(`📊 Found annotations for highlight ${highlight.id}:`, annotations);
    for (var annotation of annotations) {
      const type = annotation.find(item => item.type)?.type || '';
      const key = annotation.find(item => item.key)?.key || '';
      const options = annotation.find(item => item.options)?.options || [];
      if (type.toLowerCase() == "label") {
        // Format as "Key: Value"
        options.forEach(option => {
          labelPills.push({ key, value: option });
        });
        // Removed excessive logging
        // console.log(`🏷️ Added labels:`, options);
      }
    }
  } else {
    // Removed excessive logging
    // console.log(`⚠️ No annotations found in map for highlight ${highlight.id}`);
    // console.log('📋 Current map keys:', Object.keys(window.highlightsToAnnotationsMap || {}));
  }
  
  // Fallback: try to get annotations directly from the highlight object if it has them
  if (highlight.annotations) {
    for (var annotation of highlight.annotations) {
      const type = annotation.find(item => item.type)?.type || '';
      const key = annotation.find(item => item.key)?.key || '';
      const options = annotation.find(item => item.options)?.options || [];
      if (type.toLowerCase() == "label") {
        // Format as "Key: Value"
        options.forEach(option => {
          labelPills.push({ key, value: option });
        });
      }
    }
  }
  
  // Create label pills with "Key: Value" format and delete arrow on hover
  labelPills.forEach(({ key, value }) => {
    const labelPill = document.createElement('span');
    labelPill.className = 'label-pill';
    labelPill.style.position = 'relative';
    labelPill.style.paddingRight = '18px';
    applyUnifiedLabelPillStyle(labelPill, key);
    
    const textSpan = document.createElement('span');
    textSpan.textContent = `${key}: ${value}`;
    labelPill.appendChild(textSpan);
    
    const deleteArrow = document.createElement('button');
    deleteArrow.innerHTML = '×';
    deleteArrow.type = 'button';
    deleteArrow.style.cssText = `
      position: absolute;
      right: 2px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      font-size: 14px;
      cursor: pointer;
      padding: 0;
      width: 16px;
      height: 16px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, color 0.15s ease;
    `;
    
    labelPill.addEventListener('mouseenter', () => {
      deleteArrow.style.opacity = '1';
      deleteArrow.style.visibility = 'visible';
    });
    labelPill.addEventListener('mouseleave', () => {
      deleteArrow.style.opacity = '0';
      deleteArrow.style.visibility = 'hidden';
    });
    deleteArrow.addEventListener('mouseenter', () => deleteArrow.style.color = '#dc2626');
    deleteArrow.addEventListener('mouseleave', () => deleteArrow.style.color = '#9ca3af');
    deleteArrow.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (highlightedText) {
        await deleteSingleAnnotationOption(highlightedText, highlight.id, key, value, 'label');
        await updateAnnotationCard(highlight.id);
      }
    });
    
    labelPill.appendChild(deleteArrow);
    labelsContainer.appendChild(labelPill);
  });
  
  // Add conditional headers if content exists
  if (labelPills.length > 0) {
    const labelsHeader = document.createElement('div');
    labelsHeader.className = 'conditional-header';
    labelsHeader.textContent = 'Labels';
    labelsSection.insertBefore(labelsHeader, labelsContainer);
  }
  
  cardHeader.appendChild(labelsSection);
  annotationCard.appendChild(cardHeader);
  
  // Notes section
  const notesSection = document.createElement('div');
  notesSection.className = 'notes-section';
  
  const notesList = document.createElement('ul');
  notesList.className = 'phraze-note-list PhrazeMark';
  
  // Helper function to create a list item with text and delete button
  const createListItem = (noteText) => {
    const listItem = document.createElement('li');

    const textSpan = document.createElement('span');
    textSpan.className = 'phraze-note-text PhrazeMark';
    textSpan.innerHTML = noteText; // Use innerHTML to render HTML tags
    listItem.appendChild(textSpan);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'phraze-note-delete-btn PhrazeMark';
    deleteButton.innerHTML = '&times;';
    deleteButton.title = 'Delete note';
    listItem.appendChild(deleteButton);

    deleteButton.addEventListener('click', async (e) => {
    e.stopPropagation();
      try {
        await removeNoteFromStorage(highlight.id, noteText);
        listItem.remove();
        const noteIndex = highlight.notes.indexOf(noteText);
        if (noteIndex > -1) {
          highlight.notes.splice(noteIndex, 1);
        }
        console.log('Note deleted successfully');
      } catch (error) {
        console.error('Failed to delete note:', error);
        alert(`Failed to delete note: ${error.message}`);
      }
    });

    return listItem;
  };

  // Populate the list with existing notes from the highlight object
  if (highlight.notes && Array.isArray(highlight.notes)) {
    highlight.notes.forEach(noteText => {
      notesList.appendChild(createListItem(noteText));
    });
  }
  
  notesSection.appendChild(notesList);
  annotationCard.appendChild(notesSection);
  
  // Footer section with action buttons
  const cardFooter = document.createElement('div');
  cardFooter.className = 'annotation-card-footer';
  
  // Add note button (green +) - hide for viewers and users without createAnnotations permission
  const addNoteButton = document.createElement('button');
  addNoteButton.className = 'add-note-btn';
  addNoteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 11h-6V5a1 1 0 0 0-2 0v6H5a1 1 0 0 0 0 2h6v6a1 1 0 0 0 2 0v-6h6a1 1 0 0 0 0-2Z"/></svg>';
  addNoteButton.title = 'Add note';
  
  // Check permissions for add note button (re-check here to ensure variables are in scope)
  // createAnnotations covers both creating and modifying annotations
  const currentUserRoleForButton = typeof window !== 'undefined' ? window.currentUserRole : null;
  const annotationPermsForButton = typeof window !== 'undefined' ? window.currentUserPermissions : null;
  const isOwnerForButton = currentUserRoleForButton === 'owner';
  const isEditorForButton = currentUserRoleForButton === 'editor';
  const canCreateAnnotationsForButton = isOwnerForButton || (isEditorForButton && annotationPermsForButton && isPermissionEnabled(annotationPermsForButton, 'createAnnotations'));
  
  if (currentUserRoleForButton === 'viewer' || !canCreateAnnotationsForButton) {
    addNoteButton.style.display = 'none'; // Hide for viewers and users without createAnnotations permission
  }
  
  addNoteButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check permission before opening popup
    const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
    const annotationPerms = typeof window !== 'undefined' ? window.currentUserPermissions : null;
    const isOwner = currentUserRole === 'owner';
    const canCreateAnnotations = isOwner || (annotationPerms && annotationPerms.createAnnotations === true);
    
    if (!canCreateAnnotations) {
      // Show error toast if available
      if (typeof showToast === 'function') {
        showToast('You do not have permission to create annotations', 'error');
      } else if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast('You do not have permission to create annotations', 'error');
      }
      return;
    }
    
    // Clear the permanentlyClosed flag to allow popup to reopen
    annotationPopup.dataset.permanentlyClosed = 'false';
    if (window.phrazePermanentlyClosedPopups) {
      window.phrazePermanentlyClosedPopups.delete(highlight.id);
    }
    
    // Set global highlight ID to ensure annotations are saved with correct ID
    localStorage.setItem('globalHighlightID', highlight.id);
    
    // Load existing annotations into the popup
    await loadExistingAnnotationsIntoPopup(highlight, selectedLabelsContainer, richTextDiv, canvas, canvasContainer, toolbar, textModeBtn, canvasModeBtn, modeRef);
    
    // Ensure unified card stays open
    annotationCard.classList.add('active');
    annotationCard.style.opacity = 1;
    annotationCard.style.pointerEvents = "auto";
    
    // Position popup near the button (viewport-aware)
    const buttonRect = addNoteButton.getBoundingClientRect();
    // Calculate preferred position: center horizontally on button, above it
    // We'll center it on the button center, but the function will adjust if it doesn't fit
    const buttonCenterX = buttonRect.left + (buttonRect.width / 2);
    const popupWidth = 400; // From CSS: .annotation-popup width: 400px
    const preferredLeft = buttonCenterX - (popupWidth / 2); // Center popup on button
    const preferredTop = buttonRect.top - 350; // Position above button with some space
    
    positionElementInViewport(annotationPopup, {
      preferredLeft: preferredLeft,
      preferredTop: preferredTop,
      referenceRect: buttonRect,
      position: 'fixed'
    });
    
    // Show popup (clear both display and visibility)
    annotationPopup.style.display = 'block';
    annotationPopup.style.visibility = 'visible';
    annotationPopup.style.opacity = '1';
    annotationPopup.style.pointerEvents = 'auto';
    richTextDiv.focus();
  });

  // Attach to chat button (blue paperclip) - hide for viewers
  const attachButton = document.createElement('button');
  attachButton.className = 'attach-highlight-btn';
  attachButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 26 26"><path fill="currentColor" d="M19.719 2.063a3.96 3.96 0 0 0-1.157.218c-1.499.505-2.785 1.66-4.062 2.938l-8.25 8.25c-.733.733-1.298 1.627-1.469 2.687a3.694 3.694 0 0 0 1.063 3.188a3.691 3.691 0 0 0 3.25 1.031c1.058-.19 1.944-.757 2.625-1.438l9.062-9.062a1 1 0 1 0-1.406-1.406l-9.063 9.062c-.43.43-1.024.779-1.562.875c-.538.096-.996.035-1.5-.468c-.525-.525-.581-.966-.5-1.47c.081-.503.397-1.084.906-1.593l8.25-8.25c1.21-1.209 2.367-2.13 3.281-2.438c.915-.307 1.571-.241 2.625.813c.788.787 1.626 1.497 1.844 2.219c.11.36.11.72-.125 1.312c-.234.592-.745 1.402-1.718 2.375c-4.148 4.15-7.332 7.332-9.063 9.063c-1.537 1.537-2.989 2.563-4.281 2.843c-1.293.281-2.52-.018-4.125-1.625c-1.607-1.607-2.169-3.163-2-4.78c.168-1.618 1.153-3.373 2.969-5.188c2.196-2.196 6.78-6.406 6.78-6.406a1 1 0 1 0-1.343-1.47S6.158 7.5 3.875 9.782C1.852 11.804.578 13.978.344 16.22c-.234 2.24.674 4.455 2.594 6.375s3.992 2.61 5.937 2.187c1.945-.422 3.63-1.755 5.281-3.406c1.731-1.73 4.915-4.913 9.063-9.063c1.1-1.1 1.812-2.083 2.187-3.03c.375-.949.39-1.884.157-2.657c-.467-1.545-1.72-2.408-2.344-3.031c-.716-.716-1.508-1.168-2.313-1.375a4.315 4.315 0 0 0-1.187-.156z"/></svg>';
  attachButton.title = 'Attach to chat';
  if (currentUserRole === 'viewer') {
    attachButton.style.display = 'none'; // Hide for viewers
  } else {
    attachButton.style.display = 'none'; // Hidden by default (will be shown by updateAttachButtonVisibility if in chat)
  }

  // Function to check if user is actually chatting with a person
  function isInActiveChat() {
    // Check if we're in an iframe (extension context)
    const isInExtension = window !== window.parent;
    
    if (isInExtension) {
      // Try to access parent window's messaging variables
      try {
        if (window.parent && window.parent.currentlyChattingWith && window.parent.currentlyChattingWith !== "") {
          console.log('Found active chat:', window.parent.currentlyChattingWith);
          return true;
        }
      } catch (e) {
        console.log('Cannot access parent window variables:', e);
      }
      
      // Fallback: check for messaging elements
      const contactsPanel = document.getElementById('contacts-panel-messages');
      const messageInput = document.getElementById('message-input');
      const contactName = document.getElementById('contact-img-name');
      
      // Check if we're in a chat (contacts panel visible, message input exists, contact name shown)
      if (contactsPanel && contactsPanel.style.display === 'flex' && 
          messageInput && contactName && contactName.textContent.trim() !== '') {
        console.log('Found chat elements - user is in chat');
        return true;
      }
    }
    
    return false;
  }

  // Show/hide attach button based on chat status
  function updateAttachButtonVisibility() {
    // Never show attach button for viewers
    if (currentUserRole === 'viewer') {
      attachButton.style.display = 'none';
      return;
    }
    
    // For now, always show the button so you can test it
    attachButton.style.display = 'inline-block';
    // Removed excessive logging - only log if needed for debugging
    // console.log('Attach button should be visible now');
    
    // TODO: Implement proper chat detection later
    // const isInChat = isInActiveChat();
    // if (isInChat) {
    //   attachButton.style.display = 'inline-block';
    //   console.log('User is in chat - showing attach button');
    // } else {
    //   attachButton.style.display = 'none';
    //   console.log('User not in chat - hiding attach button');
    // }
  }

  // Initial check
  updateAttachButtonVisibility();

  // Check periodically for chat status changes
  setInterval(updateAttachButtonVisibility, 2000);

  // Attach button click handler
  attachButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // Get the highlighted text
      let highlightedText = '';
      if (highlight && highlight.textNodes && highlight.textNodes.length > 0) {
        const firstTextNode = highlight.textNodes[0];
        if (firstTextNode.wholeText && firstTextNode.highlightedRanges && firstTextNode.highlightedRanges.length > 0) {
          const range = firstTextNode.highlightedRanges[0];
          if (range.length >= 3) {
            const start = range[1];
            const end = range[2];
            highlightedText = firstTextNode.wholeText.substring(start, end);
          }
        }
      }
      
      if (highlightedText.trim()) {
        try {
          window.dispatchEvent(new Event('phraze:openCustomSidebarMessages'));
        } catch (_) {}

        try {
          window.dispatchEvent(
            new CustomEvent('phraze:attachHighlightToMessaging', {
              detail: {
                text: highlightedText.trim(),
                highlightId: highlight?.id || null
              }
            })
          );
        } catch (dispatchError) {
          console.error('Failed to dispatch highlight attach event:', dispatchError);
        }

        if (typeof showToast === 'function') {
          showToast('Highlight attached to messaging!', 'success');
        } else {
          console.log('Highlight attached to messaging!');
        }
        
        // Keep the annotation card open after attaching
        // annotationCard.style.display = 'none';
        // annotationCard.classList.remove('active');
      } else {
        if (typeof showToast === 'function') {
          showToast('No text to attach', 'error');
        } else {
          console.log('No text to attach');
          alert('No text to attach');
        }
      }
    } catch (error) {
      console.error('Error attaching highlight:', error);
      if (typeof showToast === 'function') {
        showToast('Failed to attach highlight', 'error');
      } else {
        console.log('Failed to attach highlight');
        alert('Failed to attach highlight');
      }
    }
  });

  // Delete highlight button (red X) - only show if user has deleteAnnotations permission
  const deleteButton = document.createElement('button');
  deleteButton.className = 'delete-highlight-btn';
  deleteButton.innerHTML = '&#10005;';
  deleteButton.title = 'Delete highlight';
  
  // Security: Layer 1 - UI - Check if user has permission to delete annotations
  // Owners always have all permissions, editors need explicit permissions
  if (currentUserRole === 'viewer' || !canDeleteAnnotations) {
    deleteButton.style.display = 'none'; // Hide button if no permission
  }

  deleteButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Security: Layer 2 - Action - Check permission before delete action
    // Re-check permissions in case they changed
    const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
    const annotationPerms = typeof window !== 'undefined' ? window.currentUserPermissions : null;
    const isOwner = currentUserRole === 'owner';
    const canDeleteAnnotations = isOwner || (annotationPerms && annotationPerms.deleteAnnotations === true);
    
    if (!canDeleteAnnotations && currentUserRole !== 'viewer') {
      if (typeof showToast === 'function') {
        showToast('You do not have permission to delete annotations', 'error');
      } else if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast('You do not have permission to delete annotations', 'error');
      }
      return;
    }

    try {
      // Delete the highlight from storage (which also deletes annotations)
      await deleteHighlightFromStorage(highlight.id);

      // Remove the annotation card and popup
      annotationCard.remove();
      annotationPopup.remove();

      // Replace the container with the original text
      if (containerSpan.parentNode) {
        var parentNode = containerSpan.parentNode;
        const mark = containerSpan.querySelector('mark[id="PhrazeHighlight"]');
        if (mark) {
          containerSpan.parentNode.insertBefore(document.createTextNode(mark.textContent), containerSpan);
          containerSpan.remove();
        // Normalize parent to combine adjacent text nodes
        parentNode.normalize();
        }
      }
    } catch (error) {
      console.error('Error deleting highlight:', error);
    }
  });

  cardFooter.appendChild(addNoteButton);
  cardFooter.appendChild(attachButton);
  cardFooter.appendChild(deleteButton);
  annotationCard.appendChild(cardFooter);
  
  // Check if card has canvas drawings/images (only these cards should be resizable)
  const hasCanvasImages = highlight.notes && Array.isArray(highlight.notes) && 
                          highlight.notes.some(note => note.includes('data:image/'));
  
  // Add resize handle only if card has canvas images
  if (hasCanvasImages) {
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'card-resize-handle';
    resizeHandle.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 50%, #9ca3af 50%);
      border-bottom-right-radius: 8px;
      z-index: 1000000001;
      opacity: 0.6;
      transition: opacity 0.2s ease;
    `;
    
    // Store original dimensions
    const originalWidth = 280;
    const originalHeight = annotationCard.offsetHeight || 200;
    
    // Capture actual dimensions after render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const actualWidth = annotationCard.offsetWidth || 280;
        const actualHeight = annotationCard.offsetHeight || 200;
        resizeHandle.dataset.originalWidth = actualWidth.toString();
        resizeHandle.dataset.originalHeight = actualHeight.toString();
      });
    });
    
    resizeHandle.dataset.originalWidth = originalWidth.toString();
    resizeHandle.dataset.originalHeight = originalHeight.toString();
    
    // Resize state
    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    
    // Mouse enter/leave handlers
    annotationCard.addEventListener('mouseenter', () => {
      if (!isResizing && resizeHandle) {
        resizeHandle.style.opacity = '1';
      }
    });
    
    annotationCard.addEventListener('mouseleave', () => {
      if (!isResizing && resizeHandle) {
        resizeHandle.style.opacity = '0.6';
      }
    });
    
    // Resize start
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = annotationCard.offsetWidth;
      startHeight = annotationCard.offsetHeight;
      
      // Make card sticky during resize
      annotationCard.classList.add('active');
      annotationCard.classList.add('sticky');
      annotationCard.style.display = '';
      annotationCard.style.visibility = 'visible';
      annotationCard.style.opacity = '1';
      annotationCard.style.pointerEvents = 'auto';
      
      // Prevent other highlights from interfering
      window.phrazeIsResizingCard = true;
      window.phrazeResizingCardId = highlight.id;
      
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'nwse-resize';
    });
    
    // Resize during drag
    const handleResize = (e) => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      // Get original dimensions
      const origWidth = parseFloat(resizeHandle.dataset.originalWidth) || 280;
      const origHeight = parseFloat(resizeHandle.dataset.originalHeight) || 200;
      
      // Calculate limits (can grow, cannot shrink below original)
      const minWidth = origWidth;
      const maxWidth = origWidth + 50;
      const minHeight = origHeight;
      const maxHeight = origHeight + 100;
      
      // Calculate new size
      const proposedWidth = startWidth + deltaX;
      const proposedHeight = startHeight + deltaY;
      
      // Clamp to limits
      const newWidth = Math.max(minWidth, Math.min(maxWidth, proposedWidth));
      const newHeight = Math.max(minHeight, Math.min(maxHeight, proposedHeight));
      
      // Apply new dimensions
      annotationCard.style.width = `${newWidth}px`;
      annotationCard.style.height = `${newHeight}px`;
      annotationCard.style.minWidth = `${newWidth}px`;
      annotationCard.style.maxWidth = `${newWidth}px`;
      annotationCard.style.minHeight = `${newHeight}px`;
      annotationCard.style.maxHeight = `${newHeight}px`;
      
      // Update notes list height
      const notesList = annotationCard.querySelector('.phraze-note-list');
      if (notesList) {
        const availableHeight = Math.max(100, newHeight - 250);
        notesList.style.maxHeight = `${availableHeight}px`;
        notesList.style.overflowY = 'auto';
      }
      
      // Reposition card to stay above highlight
      const highlightId = annotationCard.dataset.highlightId;
      const containerSpan = annotationCard._containerSpan || 
                            (highlightId ? document.querySelector(`.phraze-highlight-container[data-highlight-id="${highlightId}"]`) : null);
      if (containerSpan && typeof updateFloaterPosition === 'function') {
        requestAnimationFrame(() => {
          updateFloaterPosition(annotationCard, containerSpan);
        });
      }
    };
    
    // Resize end
    const handleResizeEnd = () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // Clear resize flag
        window.phrazeIsResizingCard = false;
        window.phrazeResizingCardId = null;
        
        // Restore handle opacity
        if (resizeHandle) {
          resizeHandle.style.opacity = '0.6';
        }
        
        // Keep card sticky after resize
        annotationCard.classList.add('active');
        annotationCard.classList.add('sticky');
        annotationCard.style.display = '';
        annotationCard.style.visibility = 'visible';
        annotationCard.style.opacity = '1';
        annotationCard.style.pointerEvents = 'auto';
        
        // Final reposition
        const highlightId = annotationCard.dataset.highlightId;
        const containerSpan = annotationCard._containerSpan || 
                              (highlightId ? document.querySelector(`.phraze-highlight-container[data-highlight-id="${highlightId}"]`) : null);
        if (containerSpan && typeof updateFloaterPosition === 'function') {
          requestAnimationFrame(() => {
            updateFloaterPosition(annotationCard, containerSpan);
          });
        }
      }
    };
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
    
    annotationCard.appendChild(resizeHandle);
    
    // Store container span reference
    annotationCard._containerSpan = containerSpan;
  }
  
  // Close popup when clicking outside (but not when clicking on the unified card)
  const handlePopupClick = (e) => {
    // Only handle if popup is still open and not permanently closed
    if (annotationPopup.dataset.permanentlyClosed === 'true' || annotationPopup.style.display === 'none') {
      document.removeEventListener('click', handlePopupClick);
      return;
    }
    
    const isClickOnPopupSystem = annotationPopup.contains(e.target) || 
                                addNoteButton.contains(e.target) ||
                                e.target.closest('.annotation-popup') ||
                                e.target.closest('.add-note-btn');
    
    if (!isClickOnPopupSystem) {
      // Mark as permanently closed
      annotationPopup.dataset.permanentlyClosed = 'true';
      if (!window.phrazePermanentlyClosedPopups) {
        window.phrazePermanentlyClosedPopups = new Set();
      }
      window.phrazePermanentlyClosedPopups.add(highlight.id);
      
      // Close popup
      annotationPopup.style.display = 'none';
      annotationPopup.style.visibility = 'hidden';
      annotationPopup.style.opacity = '0';
      annotationPopup.style.pointerEvents = 'none';
      
      // Enable hover behavior on the container span after popup closes
      if (containerSpan._enableHover) {
        containerSpan._enableHover();
      }
      
      // Remove this highlight ID from the active list to prevent reopening
      if (window.phrazeActiveAnnotationCardIds) {
        const index = window.phrazeActiveAnnotationCardIds.indexOf(highlight.id);
        if (index > -1) {
          window.phrazeActiveAnnotationCardIds.splice(index, 1);
        }
      }
      
      // Remove this event listener after closing
      document.removeEventListener('click', handlePopupClick);
    }
  };
  
  // Use capture phase to handle before other handlers
  document.addEventListener('click', handlePopupClick, true);

  return annotationCard;
}

function isNodeAHighlight(node) {
  return node && node.classList && node.classList.contains("PhrazeMark");
}

/**
 * Loads highlights into provided text and returns HTML with highlights applied
 * @param {string} text - The text to apply highlights to
 * @param {string} chatId - Optional chat ID to filter highlights
 * @returns {Promise<string>} HTML string with highlights applied
 */
export async function loadHighlightsForText(text, chatId = null) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  try {
    const highlights = await loadFunc() || [];
    
    // Filter highlights by chatId if provided
    const relevantHighlights = chatId 
      ? highlights.filter(h => h.chatID === chatId)
      : highlights;

    if (relevantHighlights.length === 0) {
      return text;
    }

    let highlightedText = text;
    const highlightRanges = [];

    // Find all highlight ranges in the text
    for (const highlight of relevantHighlights) {
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

    return highlightedText;
  } catch (error) {
    console.error('Error loading highlights for text:', error);
    return text;
  }
}

// Global flag to prevent concurrent loadHighlights calls
let isLoadingHighlights = false;

export async function loadHighlights(showAllLabelsAndCodes = false, newHighlightId = null) {
  // Prevent concurrent calls - if already loading, skip this call
  if (isLoadingHighlights) {
    return;
  }
  
  isLoadingHighlights = true;
  try {
    // Clean up expired "show card" entries and hide any cards that should have expired
    if (window.phrazeShowCardUntil) {
      const now = Date.now();
      for (const [highlightId, expireTime] of Object.entries(window.phrazeShowCardUntil)) {
        if (now >= expireTime) {
          // Time expired - hide the card and remove from tracking
          const expiredCard = document.querySelector(`.phraze-unified-annotation-card[data-highlight-id="${highlightId}"]`);
          if (expiredCard && !expiredCard.matches(':hover')) {
            expiredCard.classList.remove('active');
            expiredCard.style.opacity = '0';
            expiredCard.style.pointerEvents = 'none';
            expiredCard.style.visibility = 'hidden';
          }
          delete window.phrazeShowCardUntil[highlightId];
        }
      }
    }
    
    // Fetch first to avoid visible gap between clear and re-render
    const highlights = await loadFunc() || [];
    // Now clear existing marks/cards in one batch
  clearHighlights();
  // Migration: ensure default color for highlights without color
  try {
    let migrated = false;
    for (const h of highlights) {
      if (h && !h.color) {
        h.color = '#FFF176';
        h.colorName = 'yellow';
        migrated = true;
      }
    }
    if (migrated) {
      await saveFunc(highlights);
    }
  } catch (_) { /* ignore */ }
  
  // Get previously active card IDs captured during clearHighlights
  const previouslyActiveCardIds = window.phrazeActiveAnnotationCardIds || [];
  
  // Add the newly created highlight ID to the active list
  if (newHighlightId) {
    previouslyActiveCardIds.push(newHighlightId);
  }
  const treeWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ALL,  // Only look at text nodes
    {
      acceptNode: function (node) {
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  //Temporarily remove any highlights that are completely covered by other larger highlights, otherwise the larger one won't have the 2nd half show up
  for (var highlight1 of highlights) {
    for (var highlight2 of highlights) {
      if (highlight1 == highlight2)
        continue;
      var inc2 = 0;
      while (inc2 < highlight2.textNodes.length) {
        var inc1 = 0;
        while (inc1 < highlight1.textNodes.length) {
          var textNode1 = highlight1.textNodes[inc1];
          var textNode2 = highlight2.textNodes[inc2];
          if (
            textNode1.parentText == textNode2.parentText &&
            textNode1.wholeText == textNode2.wholeText &&
            textNode1.elementTag == textNode2.elementTag
          ) {
            for (var range2 of textNode2.highlightedRanges) {
              var break1 = false;
              for (var range1 of textNode1.highlightedRanges) {
                //Highlight2 is totally overlapping highlight1
                //Delete it for now, better solution may come later
                if (range2[0] == range1[0] && range2[1] <= range1[1] && range2[2] >= range1[2]) {
                  highlight1.textNodes.splice(inc1, 1);
                  inc1 -= 1;
                  break1 = true;
                  break;
                }
              }
              if (break1)
                break;
            }
          }
          inc1 += 1;
        }
        inc2 += 1;
      }
    }
  }

  var finalNodes = new Map();
  let node = treeWalker.currentNode;
  while (node) {
  

    if (node.nodeType != Node.TEXT_NODE) {
      for (const highlight of highlights) {
        for (const textNode of highlight.textNodes) {
          var text = getImmediateTextInNode(node);
          var parentText = "";
          if (node.parentNode)
            parentText = node.parentNode.textContent;
          if (node.tagName == textNode.elementTag && text == textNode.wholeText && parentText == textNode.parentText) {
           // console.log('Found matching text node 2', textNode);
            for (let highlightedRange of textNode.highlightedRanges) { //Temporarily packing in the highlight so that we can link each range to the highlight it came from
              if (highlightedRange.length == 3)
                highlightedRange.push(highlight)
            }
        

            if (finalNodes.has(node))
              finalNodes.set(node, finalNodes.get(node).concat(textNode.highlightedRanges));
            else
              finalNodes.set(node, textNode.highlightedRanges);
          }
       
        }
        
      }
    }
    node = treeWalker.nextNode();
  }

  function getTextNode(node, index) {
    var index2 = 0;
    for (const child of node.childNodes) {
      if (child.nodeType == Node.TEXT_NODE) {
        if (index2 == index)
          return child;
        index2 += 1;
      }
    }
    return null;
  }

  let highlightsToAnnotationsMap = await getHighlightAnnotationsMap(highlights);
  // Make it globally accessible for the unified annotation card
  window.highlightsToAnnotationsMap = highlightsToAnnotationsMap;
  // Removed excessive logging
  // console.log('🗺️ Annotations map created with', Object.keys(highlightsToAnnotationsMap).length, 'highlights');
  // console.log('🗺️ Map contents:', highlightsToAnnotationsMap);
  for (const [node, ranges2] of finalNodes) {
    var ranges = ranges2.sort((a, b) => ((b[0] - a[0]) * 1000000000 + (b[1] - a[1])));
    var lastRange = null;
    for (const range of ranges) {
      var textNodeIndex = range[0];
      var start = range[1];
      var end = range[2];
      var highlight = range[3]; //Temporarily packed in from above so that we can link each range to the highlight it came from

      if (lastRange) {
        var lastTextNodeIndex = lastRange[0];
        var lastStart = lastRange[1];
        // var lastEnd = lastRange[2];
        if (lastTextNodeIndex == textNodeIndex && lastStart < end) { //Need to truncate the highlight
          end = lastStart;
          if (end <= start)
            continue;
        }
      }

      var textNode = getTextNode(node, textNodeIndex);
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        // Defensive bounds checking to avoid IndexSizeError
        let textLen = textNode.textContent ? textNode.textContent.length : 0;
        if (textLen === 0) {
          continue;
        }
        let safeStart = Math.max(0, Math.min(start, textLen));
        let safeEnd = Math.max(0, Math.min(end, textLen));
        if (safeEnd <= safeStart) {
          continue; // nothing to highlight
        }

        var highlightedSegment = textNode;
        // Split at end first to preserve indices for start
        if (safeEnd < textLen) {
          // Bounds are already clamped above
          textNode.splitText(safeEnd);
        }
        if (safeStart > 0) {
          highlightedSegment = textNode.splitText(safeStart);
        }
        if (!highlightedSegment || highlightedSegment.textContent.length === 0) {
          continue;
        }

          // Create container span
          const containerSpan = document.createElement('span');
          containerSpan.className = 'phraze-highlight-container PhrazeMark unselectable';

          // Create the highlight mark
          const mark = document.createElement('mark');
          mark.id = "PhrazeHighlight";
          mark.className = "PhrazeHighlight PhrazeMark selectable";
          mark.dataset.highlightId = highlight.id; // Add data attribute for navigation
          // Apply dynamic highlight color via CSS variable
          const colorHex = (highlight && highlight.color) ? highlight.color : '#F3F068';
          mark.style.setProperty('--highlight-color', colorHex);
          if (highlight && highlight.colorName) {
            mark.dataset.colorName = highlight.colorName;
          }


          var annotations = highlightsToAnnotationsMap[highlight.id];
          var labels = "";
          var notes = "";
          if (annotations)
            for (var annotation of annotations) {
              const type = annotation.find(item => item.type)?.type || '';
              const options = annotation.find(item => item.options)?.options || [];
              if (type.toLowerCase() == "label") {
                if (labels == "")
                  labels = "Labels: ";
                else
                  labels += " | ";
                labels += options.join(', ');
              }
            }

          if (highlight.notes) {
            if (labels != "")
              notes += "<br>";
            for (let i = 0; i < highlight.notes.length; ++i) {
              if (i != 0)
                notes += "<br>";
              notes += `-${highlight.notes[i]}`;
            }
          }

          // Create the unified annotation card
          const annotationCard = await createUnifiedAnnotationCard(highlight, containerSpan);
          
          // Check if this card should be active (either newly created or previously active)
        // IMPORTANT: Never activate a popup that has been permanently closed
        const isPermanentlyClosed = window.phrazePermanentlyClosedPopups && window.phrazePermanentlyClosedPopups.has(highlight.id);
        const keepOpen = !isPermanentlyClosed && (window.phrazeKeepPopupOpenIds && window.phrazeKeepPopupOpenIds.has(highlight.id));
        
        // Check if highlight already has annotations - if it does, don't treat it as "new" that needs popup
        const hasAnnotations = (window.highlightsToAnnotationsMap && window.highlightsToAnnotationsMap[highlight.id] && window.highlightsToAnnotationsMap[highlight.id].length > 0) ||
                               (highlight.notes && Array.isArray(highlight.notes) && highlight.notes.length > 0);
        
        // Check if this is a new highlight (just created) - prioritize showing popup for new highlights
        const isNewHighlight = newHighlightId === highlight.id || previouslyActiveCardIds.includes(highlight.id) || keepOpen;
        
        // Only treat as "shouldBeActive" (needs popup) if:
        // 1. Not permanently closed
        // 2. Is a new highlight (in active list OR should keep open OR matches newHighlightId)
        // 3. Does NOT already have annotations (if it has annotations, user already saved them, don't show popup again)
        const shouldBeActive = !isPermanentlyClosed && !hasAnnotations && isNewHighlight;
          
        // Check if this card should stay visible (user just added/updated annotation)
        const now = Date.now();
        const showUntil = window.phrazeShowCardUntil && window.phrazeShowCardUntil[highlight.id];
        const shouldShowCard = showUntil && now < showUntil;
        
        // Clean up expired entry if found
        if (showUntil && now >= showUntil) {
          delete window.phrazeShowCardUntil[highlight.id];
        }
        
        // If card should be shown (after annotation), make it visible
        if (shouldShowCard) {
          annotationCard.classList.add('active');
          annotationCard.style.display = '';
          annotationCard.style.visibility = 'visible';
          annotationCard.style.opacity = '1';
          annotationCard.style.pointerEvents = 'auto';
          
          // Position the card
          requestAnimationFrame(() => {
            updateFloaterPosition(annotationCard, containerSpan);
          });
        } else if (showUntil && now >= showUntil) {
          // Explicitly hide if timestamp expired (shouldn't happen due to cleanup above, but safety check)
          annotationCard.classList.remove('active');
          annotationCard.style.opacity = '0';
          annotationCard.style.pointerEvents = 'none';
          annotationCard.style.visibility = 'hidden';
        }
          // Explicitly hide the unified card for new highlights (only show popup)
        else if (shouldBeActive) {
            annotationCard.classList.remove('active');
            annotationCard.classList.remove('sticky');
            annotationCard.style.opacity = '0';
            annotationCard.style.pointerEvents = 'none';
            annotationCard.style.visibility = 'hidden';
            // Don't set display: none - keep it in the DOM so hover can work
          }
          
          // Flag to track if hover should be disabled (when popup is open)
        let hoverEnabled = !shouldBeActive || shouldShowCard; // Enable hover if card is being shown
          
          // Function to enable hover behavior (called when popup closes)
          containerSpan._enableHover = () => {
            hoverEnabled = true;
            // Ensure card can be shown on hover (restore visibility properties)
            if (annotationCard.style.display === 'none') {
              annotationCard.style.display = '';
            }
            annotationCard.style.visibility = '';
          };
          
          // Show annotation card on hover (only if hover is enabled)
          containerSpan.addEventListener('mouseenter', () => {
            if (!hoverEnabled) return; // Skip if popup is open
            
            // Don't interfere if a card is currently being resized
            if (window.phrazeIsResizingCard) {
              return;
            }
            
            // Unpin all sticky cards when hovering over any highlight
            const allStickyCards = document.querySelectorAll('.phraze-unified-annotation-card.sticky');
            allStickyCards.forEach(card => {
              // Don't unpin the card that's being resized
              const cardId = card.dataset.highlightId;
              if (window.phrazeIsResizingCard && window.phrazeResizingCardId === cardId) {
                return; // Skip this card, it's being resized
              }
              
              card.classList.remove('sticky');
              // Only hide if it's not the current card
              if (card !== annotationCard) {
                card.classList.remove('active');
                card.style.opacity = 0;
                card.style.pointerEvents = "none";
              }
            });
            
            annotationCard.classList.add('active');
            // Ensure card is visible and can be interacted with
            annotationCard.style.display = '';
            annotationCard.style.visibility = 'visible';
            annotationCard.style.opacity = 1;
            annotationCard.style.pointerEvents = "auto";
            // Update position immediately
            requestAnimationFrame(() => {
              updateFloaterPosition(annotationCard, containerSpan);
            });
          });
          
          // Hide annotation card when mouse leaves (unless hovering over the card itself or it's sticky)
          containerSpan.addEventListener('mouseleave', (e) => {
            if (!hoverEnabled) return; // Skip if popup is open
            
            // Small delay to allow mouse to move to the card
            setTimeout(() => {
              // Don't hide if card is sticky (pinned)
              if (annotationCard.classList.contains('sticky')) return;
              
              // Check if mouse is over the annotation card
              const isHoveringCard = annotationCard.matches(':hover');
              if (!isHoveringCard) {
                annotationCard.classList.remove('active');
                annotationCard.style.opacity = 0;
                annotationCard.style.pointerEvents = "none";
              }
            }, 100);
          });

          // Keep card open when clicking on highlight (make it sticky)
          containerSpan.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click handler from closing
            
            // Close any other sticky cards before opening this one
            const otherStickyCards = document.querySelectorAll('.phraze-unified-annotation-card.sticky');
            otherStickyCards.forEach(card => {
              if (card !== annotationCard) {
                card.classList.remove('active');
                card.classList.remove('sticky');
                card.style.opacity = 0;
                card.style.pointerEvents = "none";
              }
            });
            
            annotationCard.classList.add('active');
            annotationCard.classList.add('sticky'); // Add sticky class to keep it open
            annotationCard.style.display = '';
            annotationCard.style.visibility = 'visible';
            annotationCard.style.opacity = 1;
            annotationCard.style.pointerEvents = "auto";
            // Update position immediately when activated
            requestAnimationFrame(() => {
              updateFloaterPosition(annotationCard, containerSpan);
            });
          });
          
          // Keep card open when hovering over it (but don't change sticky state)
          annotationCard.addEventListener('mouseenter', () => {
            // Only make active if not already active from sticky state
            if (!annotationCard.classList.contains('active')) {
              annotationCard.classList.add('active');
              annotationCard.style.display = '';
              annotationCard.style.visibility = 'visible';
              annotationCard.style.opacity = 1;
              annotationCard.style.pointerEvents = "auto";
            }
            // Update position immediately when hovering
            requestAnimationFrame(() => {
              updateFloaterPosition(annotationCard, containerSpan);
            });
          });
          
          // Hide card when mouse leaves it (unless it's sticky from being clicked)
          annotationCard.addEventListener('mouseleave', () => {
            // Only hide if not sticky (not clicked to keep open)
            if (!annotationCard.classList.contains('sticky')) {
              annotationCard.classList.remove('active');
              annotationCard.style.opacity = 0;
              annotationCard.style.pointerEvents = "none";
            }
          });
          
  // Keep card open when interacting with it
  annotationCard.addEventListener('click', (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation(); // Prevent other handlers from firing
    // Keep the card open and sticky when clicking inside it
    annotationCard.classList.add('sticky');
  });
          
          // Add scroll listener to update position when page scrolls
          const updateCardPositionOnScroll = () => {
            // Only update if card is active/visible
            if (annotationCard.classList.contains('active')) {
              requestAnimationFrame(() => {
                updateFloaterPosition(annotationCard, containerSpan);
              });
            }
          };
          
          // Add scroll event listeners to window and any scrollable parent elements
          window.addEventListener('scroll', updateCardPositionOnScroll, true);
          
          // Store cleanup function on the card for later removal
          annotationCard._scrollCleanup = () => {
            window.removeEventListener('scroll', updateCardPositionOnScroll, true);
          };

        // Surround the highlighted text safely
        if (!highlightedSegment.parentNode) {
          // If node is detached, skip this highlight safely
          continue;
        }
          const range = document.createRange();
          range.selectNode(highlightedSegment);
          range.surroundContents(mark);
          range.selectNode(mark);
          range.surroundContents(containerSpan);
          // Add the annotation card to the body
          document.body.appendChild(annotationCard);
          
          // Show popup immediately after card is added to DOM (if this is a new highlight)
          // CRITICAL: Only show popup if this is truly a NEW highlight (no annotations yet) AND not permanently closed
          if (shouldBeActive) {
            // Check permission before showing popup
            const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
            const annotationPerms = typeof window !== 'undefined' ? window.currentUserPermissions : null;
            const isOwner = currentUserRole === 'owner';
            const canCreateAnnotations = isOwner || (annotationPerms && annotationPerms.createAnnotations === true);
            
            // Check if this popup is permanently closed - check multiple sources to be thorough
            const isPermanentlyClosed = (window.phrazePermanentlyClosedPopups && window.phrazePermanentlyClosedPopups.has(highlight.id)) || 
                                       (annotationCard._annotationPopup && annotationCard._annotationPopup.dataset.permanentlyClosed === 'true');
            
            // Also check if any popup with this highlight ID is marked as permanently closed
            const anyPopupClosed = document.querySelectorAll(`.annotation-popup[data-highlight-id="${highlight.id}"][data-permanently-closed="true"]`).length > 0;
            
            // Check if highlight already has annotations - if it does, don't show popup (user already annotated it)
            const hasAnnotations = (window.highlightsToAnnotationsMap && window.highlightsToAnnotationsMap[highlight.id] && window.highlightsToAnnotationsMap[highlight.id].length > 0) ||
                                   (highlight.notes && Array.isArray(highlight.notes) && highlight.notes.length > 0);
            
            // Only show popup if:
            // 1. User has permission
            // 2. Popup is not permanently closed
            // 3. Highlight doesn't already have annotations (if it does, user already annotated it)
            if (canCreateAnnotations && !isPermanentlyClosed && !anyPopupClosed && !hasAnnotations) {
              // Add a small delay to ensure all DOM operations complete
              requestAnimationFrame(() => {
                const annotationPopup = annotationCard._annotationPopup;
                
                // Double-check that it's not permanently closed (race condition protection)
                const stillClosed = (window.phrazePermanentlyClosedPopups && window.phrazePermanentlyClosedPopups.has(highlight.id)) ||
                                   (annotationPopup && annotationPopup.dataset.permanentlyClosed === 'true');
                
                if (annotationPopup && !stillClosed && annotationPopup.dataset.permanentlyClosed !== 'true') {
                  // Position popup as close as possible to the highlight (viewport-aware)
                  // Safety check: ensure containerSpan is still in the DOM
                  let highlightRect = null;
                  try {
                    if (containerSpan && containerSpan.parentNode) {
                      highlightRect = containerSpan.getBoundingClientRect();
                    }
                  } catch (e) {
                    console.warn('Error getting highlight position, using center fallback', e);
                  }
                  
                  if (highlightRect) {
                    const popupWidth = 400; // From CSS: .annotation-popup width: 400px
                    const spacing = 10; // Spacing between highlight and popup
                    
                    // Try to position above the highlight first, centered horizontally
                    let preferredLeft = highlightRect.left + (highlightRect.width / 2) - (popupWidth / 2);
                    let preferredTop = highlightRect.top - spacing; // Start above highlight
                    
                    positionElementInViewport(annotationPopup, {
                      preferredLeft: preferredLeft,
                      preferredTop: preferredTop,
                      referenceRect: highlightRect,
                      position: 'fixed'
                    });
                  } else {
                    // Fallback: center in viewport if we can't get highlight position
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    positionElementInViewport(annotationPopup, {
                      preferredLeft: viewportWidth / 2,
                      preferredTop: viewportHeight / 2,
                      position: 'fixed'
                    });
                  }
                  
                  annotationPopup.style.display = 'block';
                  annotationPopup.style.visibility = 'visible';
                  annotationPopup.style.opacity = '1';
                  annotationPopup.style.pointerEvents = 'auto';
                  
                  // Focus on the rich text div for immediate typing
                  requestAnimationFrame(() => {
                    const richTextDiv = annotationPopup.querySelector('[contenteditable="true"]');
                    if (richTextDiv) {
                      richTextDiv.focus();
                    }
                  });
                } else {
                  // Ensure permanently closed popups stay hidden
                  if (annotationPopup) {
                  annotationPopup.style.display = 'none';
                  annotationPopup.style.visibility = 'hidden';
                  annotationPopup.style.opacity = '0';
                  annotationPopup.style.pointerEvents = 'none';
                    annotationPopup.dataset.permanentlyClosed = 'true';
                  }
                }
              });
            }
          }
          
          // Add document-level click handler to close sticky cards when clicking outside
          // Store the handler so we can remove it later if needed
          const documentClickHandler = (e) => {
            // Only handle PhrazeMark elements to avoid interfering with other page elements
            if (!e.target.closest('.PhrazeMark') && !e.target.classList.contains('PhrazeMark')) {
              // Check if the card is sticky and visible
              if (annotationCard.classList.contains('sticky')) {
                // Check if click was outside both the highlight and the card
                const clickedOnHighlight = containerSpan.contains(e.target);
                const clickedOnCard = annotationCard.contains(e.target);
                const clickedOnPopup = e.target.closest('.annotation-popup');
                
                if (!clickedOnHighlight && !clickedOnCard && !clickedOnPopup) {
                  // Close this sticky card
                  annotationCard.classList.remove('active');
                  annotationCard.classList.remove('sticky');
                  annotationCard.style.opacity = 0;
                  annotationCard.style.pointerEvents = "none";
                }
              }
            }
          };
          
          // Add the click handler to document with capture to handle before other handlers
          document.addEventListener('click', documentClickHandler, true);
          
          // Store cleanup function to remove the document click handler
          const originalScrollCleanup = annotationCard._scrollCleanup;
          annotationCard._scrollCleanup = () => {
            if (originalScrollCleanup) originalScrollCleanup();
            document.removeEventListener('click', documentClickHandler, true);
          };
          
          // Add X button to close the unified card
          const closeCardButton = document.createElement('button');
          closeCardButton.innerHTML = '&times;';
          closeCardButton.title = 'Close annotation card';
          closeCardButton.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background-color: #f3f4f6;
            border: none;
            color: #6b7280;
            width: 20px;
            height: 20px;
            font-size: 14px;
            line-height: 18px;
            border-radius: 3px;
            cursor: pointer;
            z-index: 1000000002;
          `;
          
          closeCardButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            annotationCard.classList.remove('active');
            annotationCard.classList.remove('sticky'); // Remove sticky class
            annotationCard.style.opacity = 0;
            annotationCard.style.pointerEvents = "none";
            
            // Also close the annotation popup if it's open
            const annotationPopup = annotationCard._annotationPopup;
            if (annotationPopup) {
              annotationPopup.style.display = 'none';
            }
            
            // Remove this highlight ID from the active list to prevent reopening
            if (window.phrazeActiveAnnotationCardIds) {
              const index = window.phrazeActiveAnnotationCardIds.indexOf(highlight.id);
              if (index > -1) {
                window.phrazeActiveAnnotationCardIds.splice(index, 1);
              }
            }
          });
          
          annotationCard.appendChild(closeCardButton);
          
          // Add event listener to detect when card is hidden or destroyed
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const currentStyle = annotationCard.style.opacity;
                if (currentStyle === '0' || currentStyle === '') {
                //  console.log('🔍 Unified annotation card was hidden (opacity changed to 0)');
                 // console.trace('Stack trace for card hiding:');
                }
              }
              if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                for (let node of mutation.removedNodes) {
                  if (node === annotationCard) {
                //    console.log('🔍 Unified annotation card was destroyed/removed from DOM');
               //     console.trace('Stack trace for card destruction:');
                  }
                }
              }
            });
          });
          
          // Start observing the card for changes
          observer.observe(annotationCard, {
            attributes: true,
            childList: true,
            subtree: false,
            attributeFilter: ['style', 'class']
          });
          
          // Also observe the parent to detect removal
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });


      }
      lastRange = range;
    }
  }
  
    try {
      const sel = window.getSelection();
      if (sel && sel.removeAllRanges) {
        sel.removeAllRanges();
      }
    } catch (e) {
      // Ignore errors in environments where selection API is not available
    }
  } catch (error) {
    console.error('Error in loadHighlights:', error);
  } finally {
    // Always reset the loading flag, even if an error occurred
    isLoadingHighlights = false;
  }
}

/**
 * Refreshes the unified annotation cards to show updated labels and codes
 */
function refreshAnnotationCards() {
  // Remove all existing annotation cards
  console.log("unified refreshing annotation cards");
  const existingCards = document.querySelectorAll('.phraze-unified-annotation-card');
  existingCards.forEach(card => card.remove());
  
  // Reload highlights to recreate the cards with updated annotations
  loadHighlights();
}

 function getUnifiedLabelColorStyle(labelType) {
   const builtIn = {
     sentiment: { bg: '#ecfdf5', border: '#34d399', text: '#065f46' },
     tone: { bg: '#eff6ff', border: '#60a5fa', text: '#1d4ed8' },
     intent: { bg: '#fff7ed', border: '#fb923c', text: '#9a3412' },
     emotion: { bg: '#fdf2f8', border: '#f472b6', text: '#9d174d' }
   };

   const custom = { bg: '#f5f3ff', border: '#a78bfa', text: '#5b21b6' };

   const normalized = String(labelType || '').trim().toLowerCase();
   const isBuiltIn = Object.prototype.hasOwnProperty.call(builtIn, normalized);
   const style = isBuiltIn ? builtIn[normalized] : custom;
   return style;
 }

 function applyUnifiedLabelPillStyle(el, labelType) {
   if (!el) return;
   const { bg, border, text } = getUnifiedLabelColorStyle(labelType);
   el.style.backgroundColor = bg;
   el.style.border = `1px solid ${border}`;
   el.style.color = text;
 }

/**
 * Updates a specific annotation card with new labels and notes without recreating it
 * @param {string} highlightId - The ID of the highlight to update
 */
async function updateAnnotationCard(highlightId) {
  const card = document.querySelector(`[data-highlight-id="${highlightId}"]`);
  if (!card) return;
  
  // Get the labels container
  const labelsContainer = card.querySelector('.labels-container');
  if (!labelsContainer) return;
  
  // Clear existing labels
  labelsContainer.innerHTML = '';
  
  // Get updated annotations for this highlight
  const labelPills = [];
  
  if (window.highlightsToAnnotationsMap && window.highlightsToAnnotationsMap[highlightId]) {
    const annotations = window.highlightsToAnnotationsMap[highlightId];
    for (var annotation of annotations) {
      const type = annotation.find(item => item.type)?.type || '';
      const key = annotation.find(item => item.key)?.key || '';
      const options = annotation.find(item => item.options)?.options || [];
      
      if (type.toLowerCase() == "label") {
        // Format as "Key: Value"
        options.forEach(option => {
          labelPills.push({ key, value: option });
        });
      }
    }
  }
  
  // Get highlighted text for deletion
  let highlightedText = '';
  try {
    const highlights = await loadFunc() || [];
    const highlight = highlights.find(h => h.id === highlightId);
    if (highlight && highlight.textNodes && highlight.textNodes.length > 0) {
      const firstTextNode = highlight.textNodes[0];
      if (firstTextNode.wholeText && firstTextNode.highlightedRanges && firstTextNode.highlightedRanges.length > 0) {
        const range = firstTextNode.highlightedRanges[0];
        if (range.length >= 3) {
          const start = range[1];
          const end = range[2];
          highlightedText = firstTextNode.wholeText.substring(start, end);
        }
      }
    }
  } catch (err) {
    console.warn('Could not get highlighted text for deletion:', err);
  }
  
  if (!highlightedText && card) {
    const containerSpan = card.closest('.phraze-highlight-container') || 
                         document.querySelector(`mark[data-highlight-id="${highlightId}"]`)?.closest('span');
    if (containerSpan) {
      const mark = containerSpan.querySelector('mark[id="PhrazeHighlight"]');
      if (mark) {
        highlightedText = mark.textContent;
      }
    }
  }
  
  // Create label pills with "Key: Value" format and delete arrow on hover
  labelPills.forEach(({ key, value }) => {
    const labelPill = document.createElement('span');
    labelPill.className = 'label-pill';
    labelPill.style.position = 'relative';
    labelPill.style.paddingRight = '18px';
    applyUnifiedLabelPillStyle(labelPill, key);
    
    const textSpan = document.createElement('span');
    textSpan.textContent = `${key}: ${value}`;
    labelPill.appendChild(textSpan);
    
    const deleteArrow = document.createElement('button');
    deleteArrow.innerHTML = '×';
    deleteArrow.type = 'button';
    deleteArrow.style.cssText = `
      position: absolute;
      right: 2px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      font-size: 14px;
      cursor: pointer;
      padding: 0;
      width: 16px;
      height: 16px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, color 0.15s ease;
    `;
    
    labelPill.addEventListener('mouseenter', () => {
      deleteArrow.style.opacity = '1';
      deleteArrow.style.visibility = 'visible';
    });
    labelPill.addEventListener('mouseleave', () => {
      deleteArrow.style.opacity = '0';
      deleteArrow.style.visibility = 'hidden';
    });
    deleteArrow.addEventListener('mouseenter', () => deleteArrow.style.color = '#dc2626');
    deleteArrow.addEventListener('mouseleave', () => deleteArrow.style.color = '#9ca3af');
    deleteArrow.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (highlightedText) {
        await deleteSingleAnnotationOption(highlightedText, highlightId, key, value, 'label');
        await updateAnnotationCard(highlightId);
      }
    });
    
    labelPill.appendChild(deleteArrow);
    labelsContainer.appendChild(labelPill);
  });
  
  // Show empty state for labels if none exist
  if (labelPills.length === 0) {
    labelsContainer.innerHTML = '';
  }
  
  // Update notes list
  const notesList = card.querySelector('.phraze-note-list');
  if (notesList) {
    // Clear existing notes
    notesList.innerHTML = '';
    
    // Reload notes from storage
    try {
      const highlights = await loadFunc() || [];
      const highlight = highlights.find(h => h.id === highlightId);
      
      if (highlight && highlight.notes && Array.isArray(highlight.notes) && highlight.notes.length > 0) {
        // Helper function to create a list item with text and delete button
        const createListItem = (noteText) => {
          const listItem = document.createElement('li');
          
          const textSpan = document.createElement('span');
          textSpan.className = 'phraze-note-text PhrazeMark';
          textSpan.innerHTML = noteText; // Use innerHTML to render HTML tags
          listItem.appendChild(textSpan);
          
          const deleteButton = document.createElement('button');
          deleteButton.className = 'phraze-note-delete-btn PhrazeMark';
          deleteButton.innerHTML = '&times;';
          deleteButton.title = 'Delete note';
          deleteButton.style.flexShrink = '0';
          deleteButton.style.background = '#eee';
          deleteButton.style.border = '1px solid #ccc';
          deleteButton.style.color = '#777';
          deleteButton.style.borderRadius = '50%';
          deleteButton.style.width = '16px';
          deleteButton.style.height = '16px';
          deleteButton.style.fontSize = '10px';
          deleteButton.style.lineHeight = '14px';
          deleteButton.style.textAlign = 'center';
          deleteButton.style.cursor = 'pointer';
          deleteButton.style.padding = '0';
          deleteButton.style.marginLeft = '5px';
          
          deleteButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
              await removeNoteFromStorage(highlightId, noteText);
              listItem.remove();
              const noteIndex = highlight.notes.indexOf(noteText);
              if (noteIndex > -1) {
                highlight.notes.splice(noteIndex, 1);
              }
              console.log('Note deleted successfully');
            } catch (error) {
              console.error('Failed to delete note:', error);
            }
          });
          
          listItem.appendChild(deleteButton);
          return listItem;
        };
        
        // Add each note as a list item
        highlight.notes.forEach(noteText => {
          const listItem = createListItem(noteText);
          notesList.appendChild(listItem);
        });
      }
      
      // Update resize handle visibility based on canvas images (after notes are loaded)
      const resizeHandle = card.querySelector('.card-resize-handle');
      let hasCanvasImages = false;
      
      if (highlight && highlight.notes && Array.isArray(highlight.notes)) {
        hasCanvasImages = highlight.notes.some(note => note.includes('data:image/'));
      }
      
      // Show/hide resize handle based on canvas images
      if (resizeHandle) {
        if (hasCanvasImages) {
          resizeHandle.style.display = 'block';
          resizeHandle.style.opacity = '0.6';
          resizeHandle.style.pointerEvents = 'auto';
          resizeHandle.style.cursor = 'nwse-resize';
        } else {
          resizeHandle.style.display = 'none';
          resizeHandle.style.opacity = '0';
          resizeHandle.style.pointerEvents = 'none';
          resizeHandle.style.cursor = 'default';
        }
      }
    } catch (error) {
      console.error('Error updating notes in card:', error);
    }
  } else {
    // No notes list, check if resize handle should be hidden
    const resizeHandle = card.querySelector('.card-resize-handle');
    if (resizeHandle) {
      resizeHandle.style.display = 'none';
      resizeHandle.style.opacity = '0';
      resizeHandle.style.pointerEvents = 'none';
    }
  }
}

/**
 * Refreshes the annotation data for all cards without recreating them
 */
function refreshAnnotationData() {
  // Get all annotation cards
  const cards = document.querySelectorAll('.phraze-unified-annotation-card');
  
  cards.forEach(card => {
    const highlightId = card.dataset.highlightId;
    if (highlightId) {
      updateAnnotationCard(highlightId);
    }
  });
}

/**
 * Updates button visibility on all annotation cards based on current user role
 */
function updateAnnotationCardButtonsVisibility() {
  const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
  const isViewer = currentUserRole === 'viewer';
  const annotationPerms = typeof window !== 'undefined' ? window.currentUserPermissions : null;
  const isOwner = currentUserRole === 'owner';
  // createAnnotations covers both creating and modifying annotations
  const canCreateAnnotations = isOwner || (annotationPerms && annotationPerms.createAnnotations === true);
  const canDeleteAnnotations = isOwner || (annotationPerms && annotationPerms.deleteAnnotations === true);
  
  // Get all annotation cards
  const cards = document.querySelectorAll('.phraze-unified-annotation-card');
  
  cards.forEach(card => {
    // Find the add note button (+ icon)
    const addNoteButton = card.querySelector('.add-note-btn');
    if (addNoteButton) {
      if (isViewer || !canCreateAnnotations) {
        addNoteButton.style.display = 'none';
      } else {
        addNoteButton.style.display = ''; // Show (use default display)
      }
    }
    
    // Find the delete button (X icon)
    const deleteButton = card.querySelector('.delete-highlight-btn');
    if (deleteButton) {
      if (isViewer || !canDeleteAnnotations) {
        deleteButton.style.display = 'none';
      } else {
        deleteButton.style.display = ''; // Show (use default display)
      }
    }
    
    // Find the attach button (paperclip icon)
    const attachButton = card.querySelector('.attach-highlight-btn');
    if (attachButton) {
      if (isViewer) {
        attachButton.style.display = 'none';
      } else {
        // For non-viewers, let updateAttachButtonVisibility handle it
        // But ensure it's not hidden if it should be visible
        const currentRole = typeof window !== 'undefined' ? window.currentUserRole : null;
        if (currentRole !== 'viewer') {
          // Check if we're in a chat (for now, always show for non-viewers as per existing logic)
          attachButton.style.display = 'inline-block';
        }
      }
    }
  });
}

/**
 * Refreshes the highlightsToAnnotationsMap with latest annotation data
 * This function can be called from the extension popup
 */
async function refreshAnnotationsMap() {
  try {
    // Skip if currently processing annotation to avoid conflicts
    if (window.phrazeProcessingAnnotation) {
      // console.log('Skipping refresh - annotation processing in progress');
      return;
    }
    
    // Get all highlights
    const highlights = await loadFunc() || [];
    
    // Get updated annotation map
    const newAnnotationsMap = await getHighlightAnnotationsMap(highlights);
    
    // Update the global map
    window.highlightsToAnnotationsMap = newAnnotationsMap;
    
    // Refresh all annotation cards
    refreshAnnotationData();
    
    console.log('Annotations map refreshed successfully');
  } catch (error) {
    console.error('Error refreshing annotations map:', error);
  }
}

// Make the function globally accessible so the extension can call it
window.refreshAnnotationsMap = refreshAnnotationsMap;

// Make the button visibility update function globally accessible
window.updateAnnotationCardButtonsVisibility = updateAnnotationCardButtonsVisibility;

// Listen for messages from the extension popup
window.addEventListener('message', async (event) => {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) return;
  
  if (event.data.action === 'annotationUpdated') {
    // console.log('Received annotation update from extension, refreshing...');
    await refreshAnnotationsMap();
  }
});

// Also listen for storage changes (for when annotations are saved)
window.addEventListener('storage', async (event) => {
  if (event.key && event.key.includes('annotationHistory')) {
    console.log('Annotation history changed in storage, refreshing...');
    await refreshAnnotationsMap();
  }
});

// Set up periodic refresh as a fallback (every 2 seconds)
let refreshInterval = null;

function startPeriodicRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  
  refreshInterval = setInterval(async () => {
    // Skip if currently processing annotation to avoid conflicts
    if (window.phrazeProcessingAnnotation) {
      return;
    }
    
    // Only refresh if there are annotation cards visible
    const visibleCards = document.querySelectorAll('.phraze-unified-annotation-card.active');
    if (visibleCards.length > 0) {
      await refreshAnnotationsMap();
    }
  }, 2000);
}

// Listen for role changes and update button visibility
let lastKnownRole = null;
function watchForRoleChanges() {
  const checkRole = () => {
    const currentRole = typeof window !== 'undefined' ? window.currentUserRole : null;
    
    // If role changed, update button visibility on all cards
    if (currentRole !== lastKnownRole) {
      lastKnownRole = currentRole;
      updateAnnotationCardButtonsVisibility();
    }
  };
  
  // Check immediately
  checkRole();
  
  // Check periodically (every 500ms for responsive updates)
  setInterval(checkRole, 500);
}

// Start watching for role changes when the module loads
if (typeof window !== 'undefined') {
  // Wait a bit for window.currentUserRole to be set
  setTimeout(() => {
    watchForRoleChanges();
  }, 1000);
}

function stopPeriodicRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Start periodic refresh when the page loads
document.addEventListener('DOMContentLoaded', () => {
  startPeriodicRefresh();
});

// Stop periodic refresh when the page is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPeriodicRefresh();
  } else {
    startPeriodicRefresh();
  }
});

// Listen for annotation updates from the extension
document.addEventListener('annotationUpdated', () => {
  console.log('Annotation updated, refreshing annotation data...');
  refreshAnnotationsMap();
});

// Listen for label and code additions
document.addEventListener('labelAdded', () => {
  console.log('Label added, refreshing annotation data...');
  refreshAnnotationsMap();
});

document.addEventListener('codeAdded', () => {
  console.log('Code added, refreshing annotation data...');
  refreshAnnotationsMap();
});

/**
 * Adds a selected label to the selected labels container - added without touching existing functionality
 * @param {string} label - The label value
 * @param {string} labelType - The label type (e.g., "Sentiment", "Tone")
 * @param {HTMLElement} container - The container to add the label to
 * @param {boolean} showToastOnDuplicate - Whether to show toast when duplicate is detected (default: true)
 */
function addSelectedLabel(label, labelType, container, showToastOnDuplicate = true) {
  // Check if container exists
  if (!container) {
    console.error('Container is null in addSelectedLabel');
    showToast('Error: Container not found', 'error');
    return;
  }
  
  // Check if label already exists in the popup container
  const existingLabels = container.querySelectorAll('.selected-label-tag');
  for (let existingLabel of existingLabels) {
    const labelText = existingLabel.textContent.replace('×', '').trim();
    if (labelText === `${labelType}: ${label}`) {
      // Show toast error message only if requested
      if (showToastOnDuplicate) {
        showToast(`Label "${labelType}: ${label}" has already been added to this annotation.`, 'error');
      }
      return; // Label already exists in popup
    }
  }
  
  // Check if label already exists on the view card (annotation card)
  const annotationCard = container.closest('.annotation-popup')?.parentElement?.querySelector('.phraze-unified-annotation-card');
  if (annotationCard) {
    const viewCardLabels = annotationCard.querySelectorAll('.label-pill');
    for (let viewCardLabel of viewCardLabels) {
      const viewCardLabelText = viewCardLabel.textContent.trim();
      if (viewCardLabelText === label) {
        // Show toast error message
        if (showToastOnDuplicate) {
          showToast(`Label "${labelType}: ${label}" already exists on the view card.`, 'error');
        }
        return; // Label already exists on view card
      }
    }
  }
  
  const labelTag = document.createElement('div');
  labelTag.className = 'selected-label-tag';
  labelTag.innerHTML = `${labelType}: ${label}<button>&times;</button>`;
  applyUnifiedLabelPillStyle(labelTag, labelType);
  
  // Add remove functionality
  const removeBtn = labelTag.querySelector('button');
  removeBtn.addEventListener('click', () => {
    labelTag.remove();
  });
  
  container.appendChild(labelTag);
}

/**
 * Loads existing labels for a highlight into the selected labels container - added without touching existing functionality
 * @param {Object} highlight - The highlight object
 * @param {HTMLElement} container - The container to add existing labels to
 */
async function loadExistingLabels(highlight, container) {
  try {
    // Clear existing labels first to prevent duplicates
    container.innerHTML = '';
    
    // Get the highlighted text
    let highlightedText = '';
    if (highlight && highlight.textNodes && highlight.textNodes.length > 0) {
      const firstTextNode = highlight.textNodes[0];
      if (firstTextNode.highlightedRanges && firstTextNode.highlightedRanges.length > 0) {
        const range = firstTextNode.highlightedRanges[0];
        if (range.length >= 3) {
          const start = range[1];
          const end = range[2];
          highlightedText = firstTextNode.wholeText.substring(start, end);
        }
      }
    }
    
    // Fallback: try to get from DOM
    if (!highlightedText) {
      const mark = container.closest('.phraze-highlight-container')?.querySelector('mark[id="PhrazeHighlight"]');
      if (mark) {
        highlightedText = mark.textContent;
      }
    }
    
    console.log('Loading existing labels for text:', highlightedText);
    
    if (highlightedText) {
      // Get annotations from annotation history for this text
      const annotationHistory = await getAnnotationHistory();
      console.log('Found annotation history:', annotationHistory);
      
      annotationHistory.forEach(annotation => {
        // Handle the array structure of annotations
        const userText = annotation.find(item => item.userText)?.userText || '';
        const type = annotation.find(item => item.type)?.type || '';
        const key = annotation.find(item => item.key)?.key || '';
        const options = annotation.find(item => item.options)?.options || [];
        
        console.log('Processing annotation:', { userText, type, key, options });
        
        // Check if this annotation matches our highlighted text and is a label
        if (userText === highlightedText && type.toLowerCase() === 'label' && options.length > 0) {
          console.log('Adding existing label:', key, options);
          options.forEach(labelValue => {
            addSelectedLabel(labelValue, key, container, false); // Don't show toast when loading existing labels
          });
        }
      });
    }
  } catch (error) {
    console.error('Error loading existing labels:', error);
  }
}

/**
 * Adds a selected text entry to the annotation history (same as extension) - added without touching existing functionality
 * @param {string} userText - The selected text
 * @param {string} key - The label/code key (e.g., "Sentiment", "Tone")
 * @param {string} type - The type ("label" or "code")
 * @param {string} option - The specific option (e.g., "Positive", "Formal")
 */
async function addSelectedTextEntry(userText, key, type, option) {
  // Removed excessive logging
  // console.log(`-- addSelectedTextEntry(text = ${userText}, key = ${key}, type = ${type}, option = ${option}) --`);

  const annotationKey = "annotationHistory";
  let compositeExist = false;

  // Get the global highlight ID (stable identifier for grouping)
  var globalHighlightID = getGlobalHighlightID();

  let highlightOwnerEmail = '';
  try {
    const highlights = await loadFunc();
    const h = (Array.isArray(highlights) ? highlights : []).find((x) => x && String(x.id) === String(globalHighlightID));
    if (h && h.userEmail) highlightOwnerEmail = String(h.userEmail);
  } catch (_) {}

  let createdBy = null;
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const email = highlightOwnerEmail
      ? String(highlightOwnerEmail).replace(/,/g, '.')
      : (currentUser && currentUser.email ? String(currentUser.email) : null);
    const firstName = currentUser && currentUser.firstName ? String(currentUser.firstName) : '';
    const lastName = currentUser && currentUser.lastName ? String(currentUser.lastName) : '';
    const fallbackName = currentUser && currentUser.name ? String(currentUser.name) : '';
    const name = `${firstName} ${lastName}`.trim() || fallbackName || (email ? email.split('@')[0] : '');
    if (email) {
      createdBy = { email, firstName, lastName, name };
    }
  } catch (_) {
    createdBy = null;
  }

  let modifierMeta = null;
  try {
    const me = getCurrentUserMeta();
    if (me && me.email && createdBy && createdBy.email && String(me.email).toLowerCase() !== String(createdBy.email).toLowerCase()) {
      modifierMeta = me;
    }
  } catch (_) {
    modifierMeta = null;
  }

  // Get the current URL
  let url = window.location.href;
  
  // Get the current chat id (set by the app when chat changes)
  let currentChatId = null;
  try {
    currentChatId = localStorage.getItem('phraze_currentChatId') || null;
  } catch (_) {}

  const annotation = [
    { "id": Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) },
    { "userText": userText },
    { "key": key },
    { "type": type },
    { "options": [option] },
    { "url": url },
    { "timestamp": new Date().toISOString() },
    { "highlightID": globalHighlightID },
    { "chatID": currentChatId },
    ...(createdBy ? [{ "createdBy": createdBy }] : []),
    ...(modifierMeta ? [{ "modifiedBy": [modifierMeta] }] : [])
  ];

  let annUserText = "";
  let annKey = "";
  let annType = "";
  let annUrl = "";
  let annHighlightID = "";
  let count = 1;

  // Retrieve the current annotation history from localStorage
  let annotationHistory = await getAnnotationHistory();
  let annotationIndex = -1;
  
  // Parse existing values if present
  if (annotationHistory.length > 0) {
    for (let index = 0; index < annotationHistory.length; index++) {
      const subArray = annotationHistory[index];
      if (!Array.isArray(subArray)) continue;

      annUserText = "";
      annKey = "";
      annType = "";
      annUrl = "";
      annHighlightID = "";

      subArray.forEach((entry) => {
        if (entry && entry.key) annKey = entry.key;
        if (entry && entry.type) annType = entry.type;
        if (entry && entry.userText) annUserText = entry.userText;
        if (entry && entry.url) annUrl = entry.url;
        if (entry && entry.highlightID !== undefined) annHighlightID = entry.highlightID;
      });

      const highlightMatch = annHighlightID && globalHighlightID && String(annHighlightID) === String(globalHighlightID);
      const compositeMatch = annUserText === userText && annKey === key && annType === type && annUrl === url;
      if ((highlightMatch && annKey === key && annType === type && annUrl === url) || compositeMatch) {
        compositeExist = true;
        annotationIndex = index;
        break;
      }
      count++;
    }

    if (compositeExist) {
      // Security: Check createAnnotations permission before modifying existing annotation
      // Note: createAnnotations covers both creating and modifying annotations
      const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
      const annotationPerms = typeof window !== 'undefined' ? window.currentUserPermissions : null;
      const isOwner = currentUserRole === 'owner';
      const canCreate = isOwner || (annotationPerms && annotationPerms.createAnnotations === true);
      
      if (!canCreate && currentUserRole !== 'viewer') {
        throw new Error('Permission denied: You do not have permission to create/modify annotations');
      }
      // Add option to existing annotation
      addOptionToAnnotation(userText, key, type, option, annotationIndex);
    } else {
      // Security: Check createAnnotations permission before creating new annotation
      const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
      const annotationPerms = typeof window !== 'undefined' ? window.currentUserPermissions : null;
      const isOwner = currentUserRole === 'owner';
      const canCreate = isOwner || (annotationPerms && annotationPerms.createAnnotations === true);
      
      if (!canCreate && currentUserRole !== 'viewer') {
        throw new Error('Permission denied: You do not have permission to create annotations');
      }
      // Add new annotation
      annotationHistory.push(annotation);
      const annotationHistoryString = JSON.stringify(annotationHistory);
      await callSetItem(annotationKey, annotationHistoryString);
      // console.log(`Added ${type}\nText: ${userText}\n${type}: ${key}\n${type} Type: ${option}`);
    }
  } else {
    // Check permission to create annotations (new annotation when history is empty)
    const userEmail = getUserEmailDotFormat();
    const companyEmail = await getResolvedCompanyEmail();
    const projectId = getCurrentProject();
    
    if (userEmail && companyEmail && projectId) {
      const companyEmailDotFormat = companyEmail.replace(/,/g, '.');
      const hasCreatePermission = await hasPermission(userEmail, companyEmailDotFormat, projectId, 'createAnnotations');
      
      if (!hasCreatePermission) {
        if (typeof showToast === 'function') {
          showToast('You do not have permission to create annotations in this project', 'error');
        }
        return; // Exit early if permission denied
      }
    }
    
    // console.log(`No values found. Creating new annotationKey: ${annotationKey}`);
    annotationHistory.push(annotation);
    const annotationHistoryString = JSON.stringify(annotationHistory);
    await callSetItem(annotationKey, annotationHistoryString);
    // console.log("New entry added.");
    // console.log(`Added ${type}\nText: ${userText}\n${type}: ${key}\n${type} Type: ${option}`);
  }

  // Dispatch event for annotation updates
  document.dispatchEvent(new Event('annotationUpdated'));
  
  // Dispatch detailed event for statistics manager
  document.dispatchEvent(new CustomEvent('annotationAdded', {
    detail: {
      type: type,
      timestamp: new Date().toISOString(),
      key: key,
      option: option
    }
  }));
}

/**
 * Adds an option to an existing annotation - added without touching existing functionality
 * @param {string} userText - The selected text
 * @param {string} key - The label/code key
 * @param {string} type - The type ("label" or "code")
 * @param {string} option - The specific option
 * @param {number} index - The annotation index
 */
async function addOptionToAnnotation(userText, key, type, option, index) {
  // Check permission to create/modify annotations (adding option to existing annotation)
  // Note: createAnnotations covers both creating and modifying annotations
  const userEmail = getUserEmailDotFormat();
  const companyEmail = await getResolvedCompanyEmail();
  const projectId = getCurrentProject();
  
  if (userEmail && companyEmail && projectId) {
    const companyEmailDotFormat = companyEmail.replace(/,/g, '.');
    const hasCreatePermission = await hasPermission(userEmail, companyEmailDotFormat, projectId, 'createAnnotations');
    
    if (!hasCreatePermission) {
      if (typeof showToast === 'function') {
        showToast('You do not have permission to create/modify annotations in this project', 'error');
      }
      return; // Exit early if permission denied
    }
  }
  
  console.log(`-- addOptionToAnnotation(userText = ${userText}, option = ${option}) --`);

  let values = await callGetItem('annotationHistory');
  if (!values) {
    console.log("No annotation history found.");
    return;
  }

  let annotationHistory = JSON.parse(Object.values(values)[0]);
  const entry = annotationHistory[index];

  if (!entry) {
    console.log("No entry found with the specified userText.");
    return;
  }

  const optionsObj = entry.find(obj => obj.options !== undefined);

  if (optionsObj.options.includes(option)) {
    console.log(`Option already exists\n${type} Type: ${option}`);
    return;
  }

  if (optionsObj.options.length < 3) {
    optionsObj.options.push(option);

    try {
      const me = getCurrentUserMeta();
      if (me) upsertModifiedBy(entry, me);
    } catch (_) {}

    await callSetItem('annotationHistory', JSON.stringify(annotationHistory));
    console.log(`Added ${type}\nText: ${userText}\n${type}: ${key}\n${type} Type: ${option}`);
    
    // Dispatch events for statistics updates
    document.dispatchEvent(new Event('annotationUpdated'));
    document.dispatchEvent(new CustomEvent('annotationAdded', {
      detail: {
        type: type,
        timestamp: new Date().toISOString(),
        key: key,
        option: option
      }
    }));
  } else {
    console.log(`Can only add a max of 3 ${type} Types`);
    return;
  }

  // Update statistics after adding option
  document.dispatchEvent(new Event('annotationUpdated'));
}

/**
 * Sets an item in storage (Firebase with localStorage fallback) - added without touching existing functionality
 * @param {string} key - The storage key
 * @param {any} value - The value to store
 * @param {boolean} prefixProjectName - Whether to prefix with project name
 */
// Track failed sync attempts for retry mechanism
const pendingSyncItems = new Map();
const SYNC_RETRY_DELAY = 5000; // 5 seconds
const MAX_SYNC_RETRIES = 3;

async function callSetItem(key, value, prefixProjectName = true, showErrorToast = true) {
  // Removed excessive logging - was causing console noise
  // console.warn(`-- callSetItem(key = ${key}, value = ${value}) --`);

  try {
    // Use getResolvedCompanyEmail to support shared projects
    var companyEmail = await getResolvedCompanyEmail();
    var projectName = await getCurrentProject();
    var path = `Companies/${companyEmail}/projects/${projectName}/${key}`;
    // console.log(`[callSetItem] Saving to path: ${path}`);
    await saveFirebaseData(path, value);
    // console.log(`Successfully saved ${key} to Firebase`);
    
    // Clear from pending sync if it was there
    pendingSyncItems.delete(key);
    
    return true; // Success
  } catch (error) {
    console.error(`Firebase save failed for ${key}:`, error);
    
    // Check if it's a permission error
    const isPermissionError = error?.message?.includes('Permission denied') || 
                              error?.code === 'PERMISSION_DENIED';
    
    if (isPermissionError && showErrorToast) {
      showToast('Unable to save - you may not have permission for this project', 'error');
    } else if (showErrorToast) {
      // Show user-friendly error for other sync failures
      const friendlyKey = key.includes('annotationHistory') ? 'annotations' : 
                          key.includes('highlights') ? 'highlights' : key;
      showToast(`Saving ${friendlyKey} locally - will sync when connection is restored`, 'warning');
    }
    
    // Fallback to localStorage
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // console.log(`Successfully saved ${key} to localStorage`);
      
      // Add to pending sync for retry
      if (!pendingSyncItems.has(key)) {
        pendingSyncItems.set(key, {
          value,
          retries: 0,
          prefixProjectName
        });
        // Schedule retry
        scheduleRetrySync(key);
      }
      
      return false; // Saved locally but not synced
    } catch (localError) {
      console.error(`Error saving ${key} to localStorage:`, localError);
      if (showErrorToast) {
        showToast('Failed to save data - please try again', 'error');
      }
      throw localError;
    }
  }
}

// Schedule a retry sync for a pending item
function scheduleRetrySync(key) {
  setTimeout(async () => {
    const item = pendingSyncItems.get(key);
    if (!item) return; // Already synced or removed
    
    if (item.retries >= MAX_SYNC_RETRIES) {
      console.warn(`Max retries reached for ${key}, giving up sync`);
      pendingSyncItems.delete(key);
      return;
    }
    
    item.retries++;
    
    try {
      const companyEmail = await getResolvedCompanyEmail();
      const projectName = await getCurrentProject();
      const path = `Companies/${companyEmail}/projects/${projectName}/${key}`;
      await saveFirebaseData(path, item.value);
      
      // Success - remove from pending
      pendingSyncItems.delete(key);
      showToast('Data synced successfully', 'success');
    } catch (error) {
      // Still failing, schedule another retry
      scheduleRetrySync(key);
    }
  }, SYNC_RETRY_DELAY);
}

/**
 * Shows a toast notification - added without touching existing functionality
 * @param {string} message - The message to display
 * @param {string} type - The type of toast ('success', 'error', 'warning', 'info')
 */
function showToast(message, type = 'info') {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast-notification');
  existingToasts.forEach(toast => toast.remove());
  
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.style.cssText = `
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    font-size: 14px;
    font-weight: 500;
    max-width: 300px;
    word-wrap: break-word;
    animation: slideIn 0.3s ease-out;
    transform: translateX(100%);
  `;
  
  toast.textContent = message;
  
  // Add slide-in animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 10);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, 4000);
  
  // Allow manual close on click
  toast.addEventListener('click', () => {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  });
}

/**
 * Loads custom labels into the dropdown
 */
async function loadCustomLabelsIntoDropdown(dropdown, selectedContainer, toggleBtn) {
  try {
    const customData = await getCustomData();
    if (customData && Object.keys(customData).length > 0) {
      // Find the create custom option to insert before it
      const createCustomOption = dropdown.querySelector('.create-custom-option');
      
      // Add custom labels section header
      const customHeaderDiv = document.createElement('div');
      customHeaderDiv.className = 'label-type-header';
      customHeaderDiv.textContent = 'Custom Labels';
      
      if (createCustomOption) {
        dropdown.insertBefore(customHeaderDiv, createCustomOption);
      } else {
        dropdown.appendChild(customHeaderDiv);
      }
      
      // Add each custom label type and its options
      Object.entries(customData).forEach(([labelType, data]) => {
        if (data.keyType === 'label' && data.options && data.options.length > 0) {
          // Add the label type header
          const labelTypeDiv = document.createElement('div');
          labelTypeDiv.className = 'label-type-header';
          labelTypeDiv.textContent = labelType;
          
          if (createCustomOption) {
            dropdown.insertBefore(labelTypeDiv, createCustomOption);
          } else {
            dropdown.appendChild(labelTypeDiv);
          }
          
          // Add the options for this label type
          data.options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'label-option';
            optionDiv.textContent = option;
            optionDiv.addEventListener('click', () => {
              addSelectedLabel(option, labelType, selectedContainer);
              dropdown.style.display = 'none';
              toggleBtn.innerHTML = 'Add Label <span>&#9662;</span>';
            });
            
            if (createCustomOption) {
              dropdown.insertBefore(optionDiv, createCustomOption);
            } else {
              dropdown.appendChild(optionDiv);
            }
          });
        }
      });
    }
  } catch (error) {
    console.error('Error loading custom labels:', error);
  }
}

/**
 * Gets custom data from storage
 */
async function getCustomData() {
  try {
    // Prefer project-scoped Firebase path for shared sync
    if (await isUserLoggedIn()) {
      const companyEmail = await getResolvedCompanyEmail();
      const projectName = getCurrentProject();
      if (companyEmail && projectName) {
        const path = `Companies/${companyEmail}/projects/${projectName}/customLabelsAndCodes`;
        const data = await getFirebaseData(path);
        if (data) {
          // Data is expected to be an object { labels: [...], codes: [...] } or similar
          return data;
        }
      }
    }
  } catch (e) {
    console.warn('Falling back to local customLabelsAndCodes due to error:', e);
          }
  // Fallbacks
  try {
    if (typeof window !== 'undefined' && window.callGetItem) {
      const result = await window.callGetItem('customLabelsAndCodes');
      return result ? Object.values(result)[0] || {} : {};
    }
    if (typeof callGetItem === 'function') {
      const result = await callGetItem('customLabelsAndCodes');
      return result ? Object.values(result)[0] || {} : {};
    }
  } catch (error) {
    console.error('Error getting custom data:', error);
  }
    return {};
}

/**
 * Saves custom data to storage
 */
async function saveCustomData(data) {
  try {
    // Save to Firebase (project-scoped) for shared sync
    if (await isUserLoggedIn()) {
      const companyEmail = await getResolvedCompanyEmail();
      const projectName = getCurrentProject();
      if (companyEmail && projectName) {
        const path = `Companies/${companyEmail}/projects/${projectName}/customLabelsAndCodes`;
        await saveFirebaseData(path, data);
        return;
      }
    }
  } catch (error) {
    console.warn('Failed to save custom data to Firebase, will fallback:', error);
  }
  // Fallbacks
    if (typeof window !== 'undefined' && window.callSetItem) {
      await window.callSetItem('customLabelsAndCodes', data);
      return;
    }
    if (typeof callSetItem === 'function') {
      await callSetItem('customLabelsAndCodes', data);
      return;
    }
    throw new Error('No storage method available');
}

/**
 * Shows modal to create custom label or code
 */
function showCreateCustomModal(type, dropdown, selectedContainer, toggleBtn) {
  // Check if user is a viewer - viewers cannot create custom labels/codes
  const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
  if (currentUserRole === 'viewer') {
    console.warn('Viewers cannot create custom labels/codes');
    if (typeof showToast === 'function') {
      showToast('Viewers cannot create custom labels/codes', 'error');
    }
    return;
  }
  
  // Create modal backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000000002;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 16px;
    padding: 32px;
    width: 480px;
    max-width: 95vw;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    border: 1px solid #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  `;
  
  // Modal content
  modal.innerHTML = `
    <div style="margin-bottom: 28px;">
      <h2 style="
        margin: 0 0 8px 0; 
        font-size: 20px; 
        font-weight: 600; 
        color: #1f2937;
        line-height: 1.2;
      ">Create ${type}</h2>
      <p style="
        margin: 0; 
        font-size: 14px; 
        color: #6b7280;
        line-height: 1.4;
      ">Add a custom ${type} type with up to 3 options</p>
    </div>
    
    <div style="margin-bottom: 24px;">
      <label style="
        display: block; 
        margin-bottom: 8px; 
        font-size: 14px; 
        font-weight: 500;
        color: #374151;
      ">${type.charAt(0).toUpperCase() + type.slice(1)} name</label>
      <input type="text" id="customTypeName" placeholder="e.g., Customer Satisfaction" style="
        width: 100%; 
        padding: 12px 16px; 
        border: 2px solid #f3f4f6; 
        border-radius: 10px; 
        font-size: 14px; 
        box-sizing: border-box;
        transition: border-color 0.2s ease;
        font-family: inherit;
      ">
    </div>
    
    <div style="margin-bottom: 32px;">
      <div style="
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        margin-bottom: 12px;
      ">
        <label style="
          font-size: 14px; 
          font-weight: 500;
          color: #374151;
        ">Options</label>
        <span style="
          font-size: 12px; 
          color: #9ca3af;
          background: #f9fafb;
          padding: 2px 8px;
          border-radius: 6px;
        ">Max 3</span>
      </div>
      <div id="optionsContainer" style="margin-bottom: 16px;">
        <input type="text" class="option-input" placeholder="Option 1" style="
          width: 100%; 
          padding: 12px 16px; 
          border: 2px solid #f3f4f6; 
          border-radius: 10px; 
          font-size: 14px; 
          box-sizing: border-box;
          margin-bottom: 12px;
          transition: border-color 0.2s ease;
          font-family: inherit;
        ">
      </div>
      <button type="button" id="addOptionBtn" style="
        background: #f9fafb; 
        border: 2px solid #f3f4f6; 
        border-radius: 8px; 
        padding: 8px 16px; 
        font-size: 13px; 
        cursor: pointer;
        color: #6b7280;
        font-weight: 500;
        transition: all 0.2s ease;
        font-family: inherit;
      ">+ Add option</button>
    </div>
    
    <div style="
      display: flex; 
      gap: 16px; 
      justify-content: flex-end;
      padding-top: 24px;
      border-top: 1px solid #f3f4f6;
    ">
      <button type="button" id="cancelBtn" style="
        padding: 12px 24px; 
        border: 2px solid #f3f4f6; 
        border-radius: 10px; 
        background: #f9fafb; 
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: #374151;
        transition: all 0.2s ease;
        font-family: inherit;
        min-width: 120px;
      ">Cancel</button>
      <button type="button" id="createBtn" style="
        padding: 12px 24px; 
        border: 2px solid #e5e7eb; 
        border-radius: 10px; 
        background: #f3f4f6; 
        color: #1f2937; 
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
        font-family: inherit;
        min-width: 120px;
      ">Create ${type}</button>
    </div>
  `;
  
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  
  // Add event listeners
  const typeNameInput = modal.querySelector('#customTypeName');
  const optionsContainer = modal.querySelector('#optionsContainer');
  const addOptionBtn = modal.querySelector('#addOptionBtn');
  const cancelBtn = modal.querySelector('#cancelBtn');
  const createBtn = modal.querySelector('#createBtn');
  
  // Add option functionality
  addOptionBtn.addEventListener('click', () => {
    const currentOptions = optionsContainer.querySelectorAll('.option-input');
    if (currentOptions.length < 3) {
      const newInput = document.createElement('input');
      newInput.type = 'text';
      newInput.className = 'option-input';
      newInput.placeholder = `Option ${currentOptions.length + 1}`;
      newInput.style.cssText = `
        width: 100%; 
        padding: 12px 16px; 
        border: 2px solid #f3f4f6; 
        border-radius: 10px; 
        font-size: 14px; 
        box-sizing: border-box;
        margin-bottom: 12px;
        transition: border-color 0.2s ease;
        font-family: inherit;
      `;
      optionsContainer.appendChild(newInput);
      
      if (currentOptions.length === 2) {
        addOptionBtn.style.display = 'none';
      }
    }
  });
  
  // Cancel button
  cancelBtn.addEventListener('click', () => {
    backdrop.remove();
  });
  
  // Create button
  createBtn.addEventListener('click', async () => {
    const typeName = typeNameInput.value.trim();
    const optionInputs = optionsContainer.querySelectorAll('.option-input');
    const options = Array.from(optionInputs)
      .map(input => input.value.trim())
      .filter(value => value !== '');
    
    if (!typeName) {
      showToast('Please enter a type name', 'error');
      return;
    }
    
    if (options.length === 0) {
      showToast('Please enter at least one option', 'error');
      return;
    }
    
    try {
      // Get existing custom data
      const customData = await getCustomData();
      
      // Check if type already exists
      if (customData[typeName]) {
        showToast(`${type} type "${typeName}" already exists`, 'error');
        return;
      }
      
      // Add new custom type
      customData[typeName] = {
        keyType: type,
        options: options
      };
      
      // Save to storage
      await saveCustomData(customData);
      
      // Close modal
      backdrop.remove();
      
      // Refresh dropdown
      await refreshDropdown(type, dropdown, selectedContainer, toggleBtn);
      
      showToast(`Custom ${type} "${typeName}" created successfully!`, 'success');
      
    } catch (error) {
      console.error('Error creating custom item:', error);
      showToast('Error creating custom item', 'error');
    }
  });
  
  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      backdrop.remove();
    }
  });
  
  // Focus on type name input
  typeNameInput.focus();
}

/**
 * Refreshes the dropdown with updated custom data
 */
async function refreshDropdown(type, dropdown, selectedContainer, toggleBtn) {
  // Clear existing dropdown content
  dropdown.innerHTML = '';
  
  if (type === 'label') {
    // Reload custom labels
    await loadCustomLabelsIntoDropdown(dropdown, selectedContainer, toggleBtn);
    
    // Re-add predefined labels (top 4 categories only)
    const labelMap = {
      Sentiment: ['Positive', 'Neutral', 'Negative'],
      Tone: ['Professional', 'Casual', 'Friendly', 'Critical'],
      Intent: ['Question', 'Statement', 'Request', 'Feedback'],
      Emotion: ['Happy', 'Frustrated', 'Confused', 'Satisfied']
    };
    
    Object.entries(labelMap).forEach(([labelType, options]) => {
      const labelTypeDiv = document.createElement('div');
      labelTypeDiv.className = 'label-type-header';
      labelTypeDiv.textContent = labelType;
      dropdown.appendChild(labelTypeDiv);
      
      options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'label-option';
        optionDiv.textContent = option;
        optionDiv.addEventListener('click', () => {
          addSelectedLabel(option, labelType, selectedContainer);
          dropdown.style.display = 'none';
          toggleBtn.innerHTML = 'Add Label <span>&#9662;</span>';
        });
        dropdown.appendChild(optionDiv);
      });
    });
    
    // Re-add create custom option - only for owners/editors
    const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
    const isOwnerOrEditor = currentUserRole === 'owner' || currentUserRole === 'editor';
    
    if (isOwnerOrEditor) {
    const createCustomDiv = document.createElement('div');
    createCustomDiv.className = 'create-custom-option';
    createCustomDiv.textContent = '+ Create Custom Label';
    createCustomDiv.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      border-top: 1px solid #e5e7eb;
      font-weight: bold;
      color: #3b82f6;
    `;
    createCustomDiv.addEventListener('click', () => {
      showCreateCustomModal('label', dropdown, selectedContainer, toggleBtn);
    });
    dropdown.appendChild(createCustomDiv);
    }
  }
}