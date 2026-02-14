
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

export async function loadRegionAnnotations() {
  const projectName = await getCurrentProject();
  const localKey = `phraze_regionAnnotations__${String(projectName || 'default')}`;

  const readLocal = () => {
    try {
      const raw = localStorage.getItem(localKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return Object.values(parsed);
      return [];
    } catch (_) {
      return [];
    }
  };

  const normalizeRemote = (data) => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') return Object.values(data);
    return [];
  };

  try {
    const companyEmail = await getResolvedCompanyEmail();
    if (!companyEmail) {
      return readLocal();
    }
    const path = `Companies/${companyEmail}/projects/${projectName}/regionAnnotations`;
    const data = await getFirebaseData(path);
    const normalized = normalizeRemote(data);
    // Cache a local copy as a fallback (helps if auth is flaky).
    try { localStorage.setItem(localKey, JSON.stringify(normalized)); } catch (_) {}
    return normalized;
  } catch (_) {
    return readLocal();
  }
}

async function saveRegionAnnotationsList(list) {
  const safe = Array.isArray(list) ? list : [];
  try {
    const projectName = await getCurrentProject();
    const localKey = `phraze_regionAnnotations__${String(projectName || 'default')}`;
    try { localStorage.setItem(localKey, JSON.stringify(safe)); } catch (_) {}
  } catch (_) {}
  await saveRegionFunc(safe);
  return safe;
}

export async function upsertRegionAnnotation(region) {
  if (!region || !region.id) return null;
  const id = String(region.id);
  let list = await loadRegionAnnotations();
  const idx = list.findIndex(r => r && String(r.id) === id);
  if (idx >= 0) list[idx] = { ...list[idx], ...region, id };
  else list.push({ ...region, id });
  await saveRegionAnnotationsList(list);
  return list.find(r => r && String(r.id) === id) || null;
}

export async function updateRegionAnnotation(regionId, patch) {
  if (!regionId) return null;
  const id = String(regionId);
  let list = await loadRegionAnnotations();
  const idx = list.findIndex(r => r && String(r.id) === id);
  if (idx < 0) return null;
  const next = { ...list[idx], ...(patch || {}), id };
  list[idx] = next;
  await saveRegionAnnotationsList(list);
  return next;
}

async function addNoteToRegionStorage(regionId, noteHtml) {
  if (!regionId || !noteHtml) return;
  const id = String(regionId);
  const region = await updateRegionAnnotation(id, {});
  if (!region) throw new Error(`Region annotation with id "${id}" not found.`);
  const notes = Array.isArray(region.notes) ? region.notes.slice() : [];
  notes.push(noteHtml);
  await updateRegionAnnotation(id, { notes, updatedAt: new Date().toISOString() });
}

async function removeNoteFromRegionStorage(regionId, noteHtml) {
  if (!regionId || !noteHtml) return;
  const id = String(regionId);
  const list = await loadRegionAnnotations();
  const region = list.find(r => r && String(r.id) === id);
  if (!region) throw new Error(`Region annotation with id "${id}" not found.`);
  const notes = Array.isArray(region.notes) ? region.notes.slice() : [];
  const idx = notes.indexOf(noteHtml);
  if (idx > -1) notes.splice(idx, 1);
  await updateRegionAnnotation(id, { notes, updatedAt: new Date().toISOString() });
}

async function saveRegionFunc(value) {
  const companyEmail = await getResolvedCompanyEmail();
  const projectName = getCurrentProject();
  if (!companyEmail) {
    // Local fallback already handled by saveRegionAnnotationsList.
    return true;
  }
  const path = `Companies/${companyEmail}/projects/${projectName}/regionAnnotations`;
  try {
    await saveFirebaseData(path, value);
    return true;
  } catch (error) {
    console.error('[saveRegionFunc] Failed to save region annotations:', error);
    // Local fallback already handled by saveRegionAnnotationsList.
    try {
      const isPermissionError = error?.message?.includes('Permission denied') || error?.code === 'PERMISSION_DENIED';
      if (isPermissionError) {
        showToast('Unable to save region annotation - you may not have permission for this project', 'error');
      } else {
        showToast('Failed to save region annotation - please try again', 'error');
      }
    } catch (_) {}
    return false;
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

function getPhrazeHeaderBottomOffset() {
  try {
    const candidates = [
      document.querySelector('.app-header'),
      document.querySelector('header'),
      document.querySelector('[data-project-dropdown="header"]')
    ].filter(Boolean);

    for (const el of candidates) {
      const cs = window.getComputedStyle(el);
      const isPinned = cs.position === 'fixed' || cs.position === 'sticky';
      const top = Number.parseFloat(cs.top || '0') || 0;
      if (!isPinned) continue;
      if (top !== 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect && rect.bottom > 0) return rect.bottom;
    }
  } catch (_) {}
  return 0;
}

function getPhrazeHighlightScrollContainer(container) {
  try {
    if (!container || typeof container.closest !== 'function') return null;
    const chat = container.closest('#chatMessagesDiv');
    if (chat) return chat;
  } catch (_) {}
  return null;
}

// --- Popup/Card state helpers (single source of truth) ---
function phrazeEnsureGlobalSet(key) {
  try {
    if (typeof window === 'undefined') return null;
    if (!window[key]) window[key] = new Set();
    return window[key];
  } catch (_) {
    return null;
  }
}

function phrazeNormalizeHighlightId(id) {
  try { return String(id); } catch (_) { return id; }
}

function phrazeSetKeepPopupOpen(highlightId) {
  const set = phrazeEnsureGlobalSet('phrazeKeepPopupOpenIds');
  if (!set) return;
  set.add(phrazeNormalizeHighlightId(highlightId));
}

function phrazeClearKeepPopupOpen(highlightId) {
  try {
    if (window.phrazeKeepPopupOpenIds) window.phrazeKeepPopupOpenIds.delete(phrazeNormalizeHighlightId(highlightId));
  } catch (_) {}
}

function phrazeSetPermanentlyClosed(highlightId, popupEl = null) {
  const set = phrazeEnsureGlobalSet('phrazePermanentlyClosedPopups');
  if (set) set.add(phrazeNormalizeHighlightId(highlightId));
  try { if (popupEl && popupEl.dataset) popupEl.dataset.permanentlyClosed = 'true'; } catch (_) {}
}

function phrazeClearPermanentlyClosed(highlightId, popupEl = null) {
  try {
    if (window.phrazePermanentlyClosedPopups) window.phrazePermanentlyClosedPopups.delete(phrazeNormalizeHighlightId(highlightId));
  } catch (_) {}
  try { if (popupEl && popupEl.dataset) popupEl.dataset.permanentlyClosed = 'false'; } catch (_) {}
}

function phrazeRemoveFromActiveIds(highlightId) {
  try {
    if (!window.phrazeActiveAnnotationCardIds) return;
    const idx = window.phrazeActiveAnnotationCardIds.indexOf(phrazeNormalizeHighlightId(highlightId));
    if (idx > -1) window.phrazeActiveAnnotationCardIds.splice(idx, 1);
  } catch (_) {}
}

function phrazeHidePopupElement(popupEl) {
  if (!popupEl) return;
  // Reset any nested UI state (eg labels dropdown) before hiding so it doesn't "remember" open state.
  try {
    if (typeof popupEl._phrazeResetLabelsDropdown === 'function') {
      popupEl._phrazeResetLabelsDropdown();
    }
  } catch (_) {}
  popupEl.style.display = 'none';
  popupEl.style.visibility = 'hidden';
  popupEl.style.opacity = '0';
  popupEl.style.pointerEvents = 'none';
}

export function phrazeHideAnyOtherPopups(exceptPopupEl = null) {
  try {
    const popups = document.querySelectorAll('.annotation-popup');
    popups.forEach(p => {
      if (!p || p === exceptPopupEl) return;
      if (p.style.display === 'none') return;
      try { p.classList.remove('sticky'); } catch (_) {}
      try { p.classList.remove('active'); } catch (_) {}
      phrazeHidePopupElement(p);
    });
  } catch (_) {}
}

export function phrazeShowPopupElement(popupEl) {
  if (!popupEl) return;
  popupEl.style.display = 'block';
  popupEl.style.visibility = 'visible';
  popupEl.style.opacity = '1';
  popupEl.style.pointerEvents = 'auto';
  try { popupEl.setAttribute('aria-hidden', 'false'); } catch (_) {}
}

function setPinnedCardPlacement(annotationCard, container, anchorRect, cardRect, yOffset = 0) {
  try {
    if (!annotationCard || !container) return;
    if (!(annotationCard.classList && annotationCard.classList.contains('sticky'))) return;
    if (annotationCard.dataset && annotationCard.dataset.pinnedPlacement) return;

    const padding = 12;
    const spacing = 8;
    const headerBottom = getPhrazeHeaderBottomOffset();
    const minTopPadding = Math.max(padding, headerBottom + padding);

    const aboveTop = anchorRect.top - cardRect.height - spacing + yOffset;
    const placement = aboveTop < minTopPadding ? 'below' : 'above';
    annotationCard.dataset.pinnedPlacement = placement;
  } catch (_) {}
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function getHoverCardCandidateRect(leftCenter, top, width, height) {
  const left = leftCenter - width / 2;
  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    width,
    height
  };
}

function getActivePinnedCardRects(excludeCard) {
  const cards = Array.from(document.querySelectorAll('.annotation-popup.sticky, .phraze-unified-annotation-card.sticky.active'));
  return cards
    .filter((c) => c && c !== excludeCard && c.offsetParent !== null)
    .map((c) => ({ el: c, rect: c.getBoundingClientRect() }))
    .filter(({ rect }) => rect && rect.width > 0 && rect.height > 0);
}

function getActiveUnifiedCardRects(excludeCard) {
  const cards = Array.from(document.querySelectorAll('.annotation-popup, .phraze-unified-annotation-card.active'));
  return cards
    .filter((c) => c && c !== excludeCard && c.offsetParent !== null)
    .map((c) => ({ el: c, rect: c.getBoundingClientRect() }))
    .filter(({ rect }) => rect && rect.width > 0 && rect.height > 0);
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

  const isSticky = annotationCard.classList && annotationCard.classList.contains('sticky');
  annotationCard.style.position = isSticky ? 'absolute' : 'fixed';

  // If this card was opened via hover and we want it to stay pinned to that exact pixel
  // position for the duration of the hover, respect the frozen coordinates.
  try {
    if (!isSticky && annotationCard._phrazeHoverFreeze && annotationCard._phrazeHoverFreeze.container === container) {
      const frozenLeft = annotationCard._phrazeHoverFreeze.left;
      const frozenTop = annotationCard._phrazeHoverFreeze.top;
      if (Number.isFinite(frozenLeft) && Number.isFinite(frozenTop)) {
        annotationCard.style.left = `${frozenLeft}px`;
        annotationCard.style.top = `${frozenTop}px`;
        return;
      }
    }
  } catch (_) {}

  const highlightId = container.dataset && container.dataset.highlightId ? container.dataset.highlightId : (mark.dataset ? mark.dataset.highlightId : null);
  let anchorRect = null;
  if (highlightId) {
    const marks = document.querySelectorAll(`.PhrazeHighlight[data-highlight-id="${highlightId}"]`);
    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;
    let sawAny = false;
    for (const m of marks) {
      const rects = m.getClientRects();
      for (const r of rects) {
        sawAny = true;
        minLeft = Math.min(minLeft, r.left);
        minTop = Math.min(minTop, r.top);
        maxRight = Math.max(maxRight, r.right);
        maxBottom = Math.max(maxBottom, r.bottom);
      }
    }
    if (sawAny) {
      anchorRect = {
        left: minLeft,
        top: minTop,
        right: maxRight,
        bottom: maxBottom,
        width: Math.max(0, maxRight - minLeft),
        height: Math.max(0, maxBottom - minTop)
      };
    }
  }

  if (!anchorRect) {
    const rectFallback = mark.getBoundingClientRect();
    anchorRect = {
      left: rectFallback.left,
      top: rectFallback.top,
      right: rectFallback.right,
      bottom: rectFallback.bottom,
      width: rectFallback.width,
      height: rectFallback.height
    };
  }

  const cardRect = annotationCard.getBoundingClientRect();
  const padding = 12;
  const spacing = 6;
  const headerBottom = getPhrazeHeaderBottomOffset();
  const minTopPadding = Math.max(padding, headerBottom + padding);

  let left = (anchorRect.left + anchorRect.right) / 2;
  const minLeftCenter = padding + (cardRect.width / 2);
  const maxLeftCenter = window.innerWidth - padding - (cardRect.width / 2);
  left = Math.max(minLeftCenter, Math.min(left, maxLeftCenter));

  // Decide pinned placement once (at pin-time) and keep it stable.
  // Hover cards can still auto-flip.
  setPinnedCardPlacement(annotationCard, container, anchorRect, cardRect, yOffset);

  const pinnedPlacement = (annotationCard.dataset && annotationCard.dataset.pinnedPlacement) ? annotationCard.dataset.pinnedPlacement : null;

  const topAbove = anchorRect.top - cardRect.height - spacing + yOffset;
  const topBelow = anchorRect.bottom + spacing + yOffset;
  let top = topAbove;

  if (isSticky && (pinnedPlacement === 'below' || pinnedPlacement === 'above')) {
    top = pinnedPlacement === 'below' ? topBelow : topAbove;
  } else {
    // Hover behavior: choose above/below based on which ends up closest after viewport clamping.
    const clampTop = (t) => Math.max(minTopPadding, Math.min(t, window.innerHeight - padding - cardRect.height));
    const aboveClamped = clampTop(topAbove);
    const belowClamped = clampTop(topBelow);

    // Distances to anchor after clamping (smaller = closer)
    const distAbove = Math.abs((aboveClamped + cardRect.height) - anchorRect.top);
    const distBelow = Math.abs(belowClamped - anchorRect.bottom);

    // If above would be forced down a lot (eg header), below is often closer and feels better.
    top = distBelow < distAbove ? belowClamped : aboveClamped;
  }

  // Hover-open cards should stay visible within the viewport.
  // Pinned (sticky) cards should remain anchored to the highlight in the document and scroll away naturally.
  if (!isSticky) {
    top = Math.max(minTopPadding, Math.min(top, window.innerHeight - padding - cardRect.height));

    // Collision avoidance: try to avoid overlapping other open unified cards,
    // but never push the card an extreme distance away from its highlight.
    // If avoiding collision would move it too far, prefer a small horizontal nudge or accept minimal overlap.
    const baseTop = top;
    const maxOffsetFromAnchor = 90;
    const minAllowedTop = Math.max(minTopPadding, baseTop - maxOffsetFromAnchor);
    const maxAllowedTop = Math.min(window.innerHeight - padding - cardRect.height, baseTop + maxOffsetFromAnchor);

    const otherRects = getActiveUnifiedCardRects(annotationCard);
    if (otherRects.length > 0) {
      const minLeftCenter = padding + (cardRect.width / 2);
      const maxLeftCenter = window.innerWidth - padding - (cardRect.width / 2);

      const findCollisionAt = (candidateLeftCenter, candidateTop) => {
        const candidate = getHoverCardCandidateRect(candidateLeftCenter, candidateTop, cardRect.width, cardRect.height);
        return otherRects.find(({ rect }) => rectsOverlap(candidate, rect));
      };

      // First: try to keep the card at the anchor Y, and resolve collisions by moving sideways.
      // This prevents the card from getting pushed far down when there is available side space.
      const nudge = 28;
      const leftCandidates = [
        (anchorRect.left + anchorRect.right) / 2,
        anchorRect.left + (cardRect.width / 2),
        anchorRect.right - (cardRect.width / 2),
        left + nudge,
        left - nudge,
        left + nudge * 2,
        left - nudge * 2
      ]
        .map((x) => Math.max(minLeftCenter, Math.min(x, maxLeftCenter)))
        .filter((x, idx, arr) => arr.indexOf(x) === idx);

      for (const candLeft of leftCandidates) {
        if (!findCollisionAt(candLeft, top)) {
          left = candLeft;
          break;
        }
      }

      const maxIterations = 8;
      for (let i = 0; i < maxIterations; i++) {
        const candidate = getHoverCardCandidateRect(left, top, cardRect.width, cardRect.height);
        const collision = otherRects.find(({ rect }) => rectsOverlap(candidate, rect));
        if (!collision) break;

        const belowTop = collision.rect.bottom + spacing;
        const aboveTop = collision.rect.top - cardRect.height - spacing;

        const boundedBelowTop = Math.max(minAllowedTop, Math.min(belowTop, maxAllowedTop));
        const boundedAboveTop = Math.max(minAllowedTop, Math.min(aboveTop, maxAllowedTop));

        const canGoDown = boundedBelowTop + cardRect.height <= window.innerHeight - padding;
        const canGoUp = boundedAboveTop >= minTopPadding;

        const distDown = Math.abs(boundedBelowTop - baseTop);
        const distUp = Math.abs(boundedAboveTop - baseTop);

        // Prefer the move that stays closer to the anchor.
        if (canGoDown && (!canGoUp || distDown <= distUp)) {
          top = boundedBelowTop;
        } else if (canGoUp) {
          top = boundedAboveTop;
        } else {
          // As a last resort, clamp to viewport edge.
          top = Math.max(minTopPadding, Math.min(top, window.innerHeight - padding - cardRect.height));
          break;
        }

        // After a vertical adjustment, re-try a small set of horizontal candidates at the new Y.
        for (const candLeft of leftCandidates) {
          if (!findCollisionAt(candLeft, top)) {
            left = candLeft;
            break;
          }
        }
      }

      // Final clamp after collision resolution.
      top = Math.max(minTopPadding, Math.min(top, window.innerHeight - padding - cardRect.height));
    }

    annotationCard.style.left = `${left}px`;
    annotationCard.style.top = `${top}px`;
  } else {
    const scrollContainer = getPhrazeHighlightScrollContainer(container);

    if (scrollContainer) {
      // Ensure the pinned card is mounted inside the scroll container so it scrolls/clips with messages.
      if (annotationCard.parentNode !== scrollContainer) {
        try {
          scrollContainer.appendChild(annotationCard);
        } catch (_) {}
      }
      try {
        const cs = window.getComputedStyle(scrollContainer);
        if (cs.position === 'static') {
          scrollContainer.style.position = 'relative';
        }
      } catch (_) {}

      const clampPinned = (l, t) => {
        const sr = scrollContainer;
        const sl = sr.scrollLeft || 0;
        const st = sr.scrollTop || 0;
        const pad = 12;
        const rectNow = annotationCard.getBoundingClientRect();
        const w = rectNow.width || cardRect.width || 400;
        const h = rectNow.height || cardRect.height || 300;
        const maxL = Math.max(pad, (sr.clientWidth || 0) - w - pad) + sl;
        const maxT = Math.max(pad, (sr.clientHeight || 0) - h - pad) + st;
        return {
          left: Math.max(pad + sl, Math.min(l, maxL)),
          top: Math.max(pad + st, Math.min(t, maxT))
        };
      };

      // If pinned position was already computed, keep it fixed relative to the scroll container.
      try {
        if (annotationCard._phrazePinnedStaticPos && annotationCard._phrazePinnedStaticPos.container === scrollContainer) {
          const clamped = clampPinned(annotationCard._phrazePinnedStaticPos.left, annotationCard._phrazePinnedStaticPos.top);
          annotationCard.style.left = `${clamped.left}px`;
          annotationCard.style.top = `${clamped.top}px`;
          annotationCard._phrazePinnedStaticPos = { container: scrollContainer, left: clamped.left, top: clamped.top };
          return;
        }
      } catch (_) {}

      // Apply one-time freeze captured at pin-time.
      try {
        if (annotationCard._phrazePinFreeze && annotationCard._phrazePinFreeze.container === scrollContainer) {
          const clamped = clampPinned(annotationCard._phrazePinFreeze.left, annotationCard._phrazePinFreeze.top);
          annotationCard.style.left = `${clamped.left}px`;
          annotationCard.style.top = `${clamped.top}px`;
          annotationCard._phrazePinnedStaticPos = { container: scrollContainer, left: clamped.left, top: clamped.top };
          annotationCard._phrazePinFreeze = null;
          return;
        }
      } catch (_) {}

      // Fallback: convert the computed viewport position to scroll-container coordinates once.
      const containerRect = scrollContainer.getBoundingClientRect();
      const rawLocalLeft = left - containerRect.left + (scrollContainer.scrollLeft || 0);
      const rawLocalTop = top - containerRect.top + (scrollContainer.scrollTop || 0);

      // Clamp within the scroll container so the card never ends up behind sidebars/offscreen.
      // (This can happen when `left` is viewport-clamped but the scroll container is not full-width.)
      const cardRectNow = annotationCard.getBoundingClientRect();
      const cardW = cardRectNow.width || cardRect.width || 400;
      const cardH = cardRectNow.height || cardRect.height || 300;
      const pad = 12;
      const maxLeft = Math.max(pad, (scrollContainer.clientWidth || 0) - cardW - pad) + (scrollContainer.scrollLeft || 0);
      const maxTop = Math.max(pad, (scrollContainer.clientHeight || 0) - cardH - pad) + (scrollContainer.scrollTop || 0);
      const localLeft = Math.max(pad + (scrollContainer.scrollLeft || 0), Math.min(rawLocalLeft, maxLeft));
      const localTop = Math.max(pad + (scrollContainer.scrollTop || 0), Math.min(rawLocalTop, maxTop));

      annotationCard.style.left = `${localLeft}px`;
      annotationCard.style.top = `${localTop}px`;
      try {
        annotationCard._phrazePinnedStaticPos = { container: scrollContainer, left: localLeft, top: localTop };
      } catch (_) {}
    } else {
      // Fallback: position relative to the document.
      const docLeft = left + window.scrollX;
      const docTop = top + window.scrollY;
      annotationCard.style.left = `${docLeft}px`;
      annotationCard.style.top = `${docTop}px`;
    }
  }
}

function scheduleFloaterPositionUpdate(annotationCard, container, yOffset = 0) {
  if (!annotationCard || !container) return;
  if (annotationCard._phrazePositionRaf) return;
  annotationCard._phrazePositionRaf = requestAnimationFrame(() => {
    annotationCard._phrazePositionRaf = null;
    updateFloaterPosition(annotationCard, container, yOffset);
  });
}

function scheduleHoverFreezePositionUpdate(annotationCard, container, yOffset = 0) {
  if (!annotationCard || !container) return;
  if (annotationCard.classList && annotationCard.classList.contains('sticky')) {
    scheduleFloaterPositionUpdate(annotationCard, container, yOffset);
    return;
  }

  // Clear any prior freeze and compute a fresh position once.
  try {
    annotationCard._phrazeHoverFreeze = null;
  } catch (_) {}

  scheduleFloaterPositionUpdate(annotationCard, container, yOffset);

  // After the position is applied (next frame), freeze it so it doesn't shift.
  if (annotationCard._phrazeHoverFreezeRaf) return;
  annotationCard._phrazeHoverFreezeRaf = requestAnimationFrame(() => {
    annotationCard._phrazeHoverFreezeRaf = null;
    try {
      if (annotationCard.classList && annotationCard.classList.contains('sticky')) return;
      const left = Number.parseFloat(annotationCard.style.left || '');
      const top = Number.parseFloat(annotationCard.style.top || '');
      if (Number.isFinite(left) && Number.isFinite(top)) {
        annotationCard._phrazeHoverFreeze = { container, left, top };
      }
    } catch (_) {}
  });
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

// Listen once for toolbar-driven highlight color updates (existing highlights)
let phrazeHighlightColorChangeListenerBound = false;
function bindPhrazeHighlightColorChangeListener() {
  if (phrazeHighlightColorChangeListenerBound) return;
  phrazeHighlightColorChangeListenerBound = true;
  try {
    document.addEventListener('phraze:request-highlight-color-change', async (e) => {
      try {
        const detail = e && e.detail ? e.detail : null;
        if (!detail || !detail.highlightId || !detail.hex) return;

        const highlightId = String(detail.highlightId);
        const hex = String(detail.hex);
        const name = detail.name ? String(detail.name) : null;

        // Update UI immediately
        applyHighlightColorToMarks(highlightId, hex);

        // Persist to stored highlights
        let highlights = await loadFunc() || [];
        let updated = false;
        highlights = highlights.map(h => {
          if (h && String(h.id) === highlightId) {
            updated = true;
            return { ...h, color: hex, colorName: name || h.colorName || 'yellow' };
          }
          return h;
        });
        if (updated) {
          await saveFunc(highlights);
        }
      } catch (_) {}
    });
  } catch (_) {}
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
    phrazeSetKeepPopupOpen(highlightIdStr);
  } catch (_) {}
  
  // Ensure this new highlight is NOT in the permanently closed set
  if (window.phrazePermanentlyClosedPopups && window.phrazePermanentlyClosedPopups.has(highlightIdStr)) {
    phrazeClearPermanentlyClosed(highlightIdStr);
  }
  
  // Load highlights to render the new highlight and show the annotation popup
  await loadHighlights(false, highlightIdStr);
}

export function clearHighlights() {
  // Removed excessive logging
  // console.log("unified clearing highlights");
  
  // Store active annotation card IDs AND visible popup IDs before clearing
  const activeCardIds = [];
  
  // Capture visible popups/cards (so loadHighlights can restore them after refresh)
  const visiblePopups = document.querySelectorAll('.annotation-popup[data-highlight-id]');
  visiblePopups.forEach(popup => {
    const highlightId = popup.dataset.highlightId;
    const isPermanentlyClosed = (window.phrazePermanentlyClosedPopups && window.phrazePermanentlyClosedPopups.has(highlightId)) ||
                               popup.dataset.permanentlyClosed === 'true';
    if (highlightId && popup.style.display !== 'none' && !isPermanentlyClosed) {
      if (!activeCardIds.includes(highlightId)) activeCardIds.push(highlightId);
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

  const allAnnotationPopups = document.querySelectorAll('.annotation-popup');
  allAnnotationPopups.forEach(popup => popup.remove());
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
  
  const isRegion = Boolean(highlight && highlight._phrazeAnnotationSource === 'region');
  const regionId = isRegion ? String(highlight._phrazeRegionId || highlight.id || '') : '';

  // Region-backed labels
  if (isRegion && regionId && selectedLabelsContainer) {
    try {
      const regions = await loadRegionAnnotations();
      const region = Array.isArray(regions) ? regions.find(r => r && String(r.id) === regionId) : null;
      const labels = region && Array.isArray(region.labels) ? region.labels : [];
      labels.forEach((labelObj) => {
        try {
          const type = labelObj && labelObj.type ? String(labelObj.type) : '';
          const value = labelObj && labelObj.value ? String(labelObj.value) : '';
          if (type && value) addSelectedLabel(value, type, selectedLabelsContainer, false);
        } catch (_) {}
      });
    } catch (_) {}
  }

  // Highlight-backed labels
  if (!isRegion) {
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
  }
  
  // Load notes from highlight.notes array
  if (!isRegion && highlight.notes && Array.isArray(highlight.notes) && highlight.notes.length > 0) {
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
        
        // Do NOT pre-fill the rich text editor with existing notes.
        // We want the editor to always start empty when the popup opens,
        // so users can add a fresh note instead of editing old ones.
        if (richTextDiv) {
          richTextDiv.innerHTML = '';
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
        
        // Do NOT pre-fill the rich text editor with existing notes.
        // We want the editor to always start empty when the popup opens.
        if (richTextDiv) {
          richTextDiv.innerHTML = '';
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

export async function createUnifiedAnnotationCard(highlight, containerSpan, opts = {}) {
  const annotationSource = (opts && opts.type === 'region') ? 'region' : 'highlight';
  try {
    if (highlight && typeof highlight === 'object') {
      highlight._phrazeAnnotationSource = annotationSource;
      if (annotationSource === 'region') {
        highlight._phrazeRegionId = String(opts.regionId || highlight.id || '');
      }
    }
  } catch (_) {}

  // Create the unified annotation popup (single interface, no separate card)
  const annotationPopup = document.createElement('div');
  annotationPopup.className = 'annotation-popup PhrazeMark anno-update-ui';
  annotationPopup.style.display = 'none';
  annotationPopup.style.position = 'fixed';
  annotationPopup.style.zIndex = '1300';
  annotationPopup.dataset.highlightId = highlight.id; // Add data attribute to link popup to highlight
  try {
    annotationPopup.dataset.annotationType = annotationSource;
    if (annotationSource === 'region') annotationPopup.dataset.regionId = String(opts.regionId || highlight.id || '');
  } catch (_) {}

  // Interaction guard for hover-previews:
  // when user is scrolling/clicking inside the popup (esp. labels dropdown), do not allow hover-close timers to hide it.
  annotationPopup._phrazePreventHoverCloseUntil = 0;
  annotationPopup._phrazeLabelsDropdownOpen = false;
  annotationPopup._phrazeIgnoreScrollHideUntil = 0;
  const phrazeMarkInteracting = (ms = 800) => {
    try {
      annotationPopup._phrazePreventHoverCloseUntil = Date.now() + ms;
    } catch (_) {}
  };
  const phrazeIgnoreScrollHideBriefly = (ms = 250) => {
    try {
      annotationPopup._phrazeIgnoreScrollHideUntil = Date.now() + ms;
    } catch (_) {}
  };
  annotationPopup.addEventListener('pointerdown', () => phrazeMarkInteracting(1200), true);
  annotationPopup.addEventListener('focusin', () => phrazeMarkInteracting(1500), true);
  // Wheel-lock: while hovering a non-pinned popup, block underlying page/chat scroll
  // so the hover card doesn't "follow" the viewport. Allow the labels dropdown itself to scroll.
  annotationPopup.addEventListener('wheel', (e) => {
    phrazeMarkInteracting(1500);
    // If pinned, allow normal page/chat scroll behavior.
    if (annotationPopup.classList.contains('sticky')) return;
    // If the wheel event is inside the dropdown and it can scroll, allow it.
    const dropdown = annotationPopup.querySelector('.labels-dropdown');
    if (dropdown && dropdown.style.display !== 'none' && dropdown.contains(e.target)) {
      try {
        const canScroll = dropdown.scrollHeight > dropdown.clientHeight;
        if (canScroll) {
          return; // allow dropdown scrolling
        }
      } catch (_) {}
    }
    // Otherwise, prevent the underlying container from scrolling while hovering the popup.
    phrazeIgnoreScrollHideBriefly(250);
    try { e.preventDefault(); } catch (_) {}
    try { e.stopPropagation(); } catch (_) {}
  }, { capture: true, passive: false });
  
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
  closeButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation(); // Prevent other handlers from firing
    
    // Close (do NOT permanently close; allow hover/click to reopen)
    phrazeClearPermanentlyClosed(highlight.id, annotationPopup);
    phrazeClearKeepPopupOpen(highlight.id);
    
    // Close popup
    phrazeHidePopupElement(annotationPopup);
    
    // Enable hover behavior on the container span after popup closes
    if (window.phrazeEnableHoverForHighlightId && window.phrazeEnableHoverForHighlightId[highlight.id]) {
      window.phrazeEnableHoverForHighlightId[highlight.id]();
    } else if (containerSpan._enableHover) {
      containerSpan._enableHover();
    }
    
    // Remove this highlight ID from the active list to prevent reopening
    phrazeRemoveFromActiveIds(highlight.id);
  });

  // Create header section - simplified Zotero-style
  const headerSection = document.createElement('div');
  headerSection.className = 'modal-header';
  
  const headerText = document.createElement('span');
  headerText.className = 'modal-title';

  const hasExistingAnnotations = () => {
    try {
      if (annotationSource === 'region') {
        const cached = annotationPopup._phrazeRegionCached;
        const hasLabels = Boolean(cached && Array.isArray(cached.labels) && cached.labels.length > 0);
        const hasNotes = Boolean(cached && Array.isArray(cached.notes) && cached.notes.length > 0);
        return hasLabels || hasNotes;
      }
      const hasLabels = Boolean(
        window.highlightsToAnnotationsMap &&
          window.highlightsToAnnotationsMap[highlight.id] &&
          window.highlightsToAnnotationsMap[highlight.id].length > 0
      );
      const hasNotes = Boolean(Array.isArray(highlight.notes) && highlight.notes.length > 0);
      return hasLabels || hasNotes;
    } catch (_) {
      return false;
    }
  };

  const updateHeaderTitle = () => {
    try {
      headerText.textContent = hasExistingAnnotations() ? 'Update Annotations' : 'Add Annotations';
    } catch (_) {}
  };

  annotationPopup._phrazeUpdateHeaderTitle = updateHeaderTitle;
  updateHeaderTitle();
  
  headerSection.appendChild(headerText);
  // Put the close button INSIDE the header (prevents duplicate X / weird absolute positioning)
  headerSection.appendChild(closeButton);
  annotationPopup.appendChild(headerSection);

  // Body wrapper (matches `anno-update-folder/styles.css`)
  // Create this early so sub-sections (labels/editor/etc) can append immediately without leaking vars.
  const modalBody = document.createElement('div');
  modalBody.className = 'modal-body';

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

    // Helper to reset dropdown UI state so it doesn't persist across open/close cycles.
    annotationPopup._phrazeResetLabelsDropdown = () => {
      try { labelsDropdown.style.display = 'none'; } catch (_) {}
      try { labelsDropdown.style.left = ''; } catch (_) {}
      try { labelsDropdown.style.right = ''; } catch (_) {}
      try { labelsDropdown.style.top = ''; } catch (_) {}
      try { annotationPopup._phrazeLabelsDropdownOpen = false; } catch (_) {}
      try { labelsToggleBtn.innerHTML = 'Add Label <span>&#9662;</span>'; } catch (_) {}
    };
    
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
          try { annotationPopup._phrazeResetLabelsDropdown(); } catch (_) {
            labelsDropdown.style.display = 'none';
            labelsToggleBtn.innerHTML = 'Add Label <span>&#9662;</span>';
            annotationPopup._phrazeLabelsDropdownOpen = false;
          }
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
      annotationPopup._phrazeLabelsDropdownOpen = !isVisible;
      phrazeMarkInteracting(!isVisible ? 4000 : 1200);
      if (!isVisible) phrazeIgnoreScrollHideBriefly(600);

      // If the dropdown is opened, flip it to the left if it would overflow off-screen.
      if (!isVisible) {
        try {
          labelsDropdown.style.right = '';
          labelsDropdown.style.left = '';
          // Force layout so we can measure
          const dropdownRect = labelsDropdown.getBoundingClientRect();
          const popupRect = annotationPopup.getBoundingClientRect();
          const gap = 18;
          const yOffset = -14;
          const desiredLeft = popupRect.right + gap;
          const overflowRight = desiredLeft + dropdownRect.width > window.innerWidth - 8;
          if (overflowRight) {
            // open to the left
            labelsDropdown.style.left = 'auto';
            labelsDropdown.style.right = `calc(100% + ${gap}px)`;
            labelsDropdown.style.top = `${yOffset}px`;
          } else {
            // open to the right
            labelsDropdown.style.right = 'auto';
            labelsDropdown.style.left = `calc(100% + ${gap}px)`;
            labelsDropdown.style.top = `${yOffset}px`;
          }
        } catch (_) {}
      }
    });
    
    // Global (single) outside-click handler to close any open labels dropdowns.
    // Avoids registering one `document.click` listener per highlight/popup (memory/perf leak).
    if (typeof window !== 'undefined' && !window._phrazeLabelsDropdownOutsideClickBound) {
      window._phrazeLabelsDropdownOutsideClickBound = true;
      document.addEventListener('click', (e) => {
        try {
          const popups = document.querySelectorAll('.annotation-popup');
          popups.forEach(popup => {
            if (!popup || popup.style.display === 'none') return;
            if (typeof popup._phrazeResetLabelsDropdown !== 'function') return;
            const dropdown = popup.querySelector('.labels-dropdown');
            if (!dropdown || dropdown.style.display === 'none') return;
            const labelsSection = popup.querySelector('.labels-section');
            if (labelsSection && labelsSection.contains(e.target)) return; // click inside labels area
            popup._phrazeResetLabelsDropdown();
          });
        } catch (_) {}
      }, true);
    }
    
    // Prevent scroll chaining: when user scrolls the dropdown, NEVER let the chat/page scroll,
    // otherwise the hover-preview scroll handler will hide the card.
    labelsDropdown.addEventListener('wheel', (e) => {
      phrazeMarkInteracting(2500);
      phrazeIgnoreScrollHideBriefly(300);
      try { e.stopPropagation(); } catch (_) {}

      // If pinned, allow normal scrolling behavior.
      if (annotationPopup.classList.contains('sticky')) return;

      // Always prevent default and manually scroll the dropdown to avoid momentum scroll chaining.
      try { e.preventDefault(); } catch (_) {}

      try {
        // deltaMode: 0=pixel, 1=line, 2=page
        const multiplier = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? labelsDropdown.clientHeight : 1;
        labelsDropdown.scrollTop += (e.deltaY * multiplier);
      } catch (_) {}
    }, { capture: true, passive: false });

    // Append into modal body now (avoids `popupLabelsSection` scope bugs)
    modalBody.appendChild(popupLabelsSection);
  }

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

  let addNoteToolbarButton = null;

  const setNotesToolbarEnabled = (enabled) => {
    try {
      [boldBtn, italicBtn, colorBtn, imageBtn].forEach(btn => {
        btn.disabled = !enabled;
        btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      });
      if (addNoteToolbarButton) {
        addNoteToolbarButton.disabled = !enabled;
        addNoteToolbarButton.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      }
    } catch (_) {}
  };

  const richTextHasContent = () => {
    try {
      const html = String(richTextDiv.innerHTML || '').trim();
      if (!html) return false;
      const text = String(richTextDiv.textContent || '').replace(/\s+/g, '').trim();
      const hasImg = richTextDiv.querySelector && richTextDiv.querySelector('img');
      return Boolean(text) || Boolean(hasImg);
    } catch (_) {
      return false;
    }
  };

  // Default to disabled for simplicity; enable once user starts typing.
  setNotesToolbarEnabled(false);
  richTextDiv.addEventListener('input', () => {
    setNotesToolbarEnabled(richTextHasContent());
  });
  
  // Text-only mode (no Text/Canvas toggle)
  const modeRef = { current: 'text' }; // kept for compatibility with shared loader signature
  const textModeBtn = null;
  const canvasModeBtn = null;
  
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

  // Editor container (matches anno-update-folder design)
  const editorContainer = document.createElement('div');
  editorContainer.className = 'editor-container';
  editorContainer.appendChild(richTextDiv);
  editorContainer.appendChild(toolbar);
  modalBody.appendChild(editorContainer);

  const popupNotesSection = document.createElement('div');
  popupNotesSection.className = 'notes-section';

  const popupNotesList = document.createElement('ul');
  popupNotesList.className = 'phraze-note-list PhrazeMark';

  const renderPopupNotes = async () => {
    try {
      popupNotesList.innerHTML = '';

      let notes = [];
      if (annotationSource === 'region') {
        const regionId = String(opts.regionId || highlight.id || '');
        const regions = await loadRegionAnnotations();
        const region = Array.isArray(regions) ? regions.find(r => r && String(r.id) === regionId) : null;
        try { annotationPopup._phrazeRegionCached = region; } catch (_) {}
        notes = (region && Array.isArray(region.notes)) ? region.notes : [];
      } else {
        const highlights = await loadFunc() || [];
        const current = highlights.find(h => h.id === highlight.id);
        notes = (current && Array.isArray(current.notes)) ? current.notes : (Array.isArray(highlight.notes) ? highlight.notes : []);
      }

      const createListItem = (noteText) => {
        const listItem = document.createElement('li');

        const textSpan = document.createElement('span');
        textSpan.className = 'phraze-note-text PhrazeMark';
        textSpan.innerHTML = noteText;
        listItem.appendChild(textSpan);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'phraze-note-delete-btn PhrazeMark';
        deleteButton.innerHTML = '&times;';
        deleteButton.title = 'Delete note';
        listItem.appendChild(deleteButton);

        deleteButton.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            if (annotationSource === 'region') {
              await removeNoteFromRegionStorage(String(opts.regionId || highlight.id || ''), noteText);
            } else {
              await removeNoteFromStorage(highlight.id, noteText);
            }
            try {
              if (Array.isArray(highlight.notes)) {
                const noteIndex = highlight.notes.indexOf(noteText);
                if (noteIndex > -1) highlight.notes.splice(noteIndex, 1);
              }
            } catch (_) {}
            await renderPopupNotes();
            try {
              if (annotationPopup && typeof annotationPopup._phrazeUpdateHeaderTitle === 'function') {
                annotationPopup._phrazeUpdateHeaderTitle();
              }
            } catch (_) {}
          } catch (error) {
            console.error('Failed to delete note:', error);
            if (typeof showToast === 'function') {
              showToast(`Failed to delete note: ${error.message}`, 'error');
            }
          }
        });

        return listItem;
      };

      notes
        .filter(n => typeof n === 'string' && n.trim() && !n.includes('data:image/'))
        .forEach(noteText => {
          popupNotesList.appendChild(createListItem(noteText));
        });
    } catch (error) {
      console.error('Error rendering popup notes:', error);
    }
  };

  addNoteToolbarButton = document.createElement('button');
  addNoteToolbarButton.type = 'button';
  addNoteToolbarButton.className = 'toolbar-note-btn';
  addNoteToolbarButton.textContent = 'Add note';
  addNoteToolbarButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const noteHtml = (richTextDiv && typeof richTextDiv.innerHTML === 'string') ? richTextDiv.innerHTML.trim() : '';
    if (!noteHtml) return;

    try {
      if (annotationSource === 'region') {
        await addNoteToRegionStorage(String(opts.regionId || highlight.id || ''), noteHtml);
      } else {
        await addNoteToStorage(highlight.id, noteHtml);
      }
      try {
        if (!Array.isArray(highlight.notes)) highlight.notes = [];
        highlight.notes.push(noteHtml);
      } catch (_) {}
      try { richTextDiv.innerHTML = ''; } catch (_) {}
      try { setNotesToolbarEnabled(false); } catch (_) {}
      await renderPopupNotes();
      try {
        if (annotationPopup && typeof annotationPopup._phrazeUpdateHeaderTitle === 'function') {
          annotationPopup._phrazeUpdateHeaderTitle();
        }
      } catch (_) {}
      document.dispatchEvent(new Event('annotationUpdated'));
    } catch (error) {
      console.error('Failed to add note:', error);
      if (typeof showToast === 'function') {
        showToast(`Failed to add note: ${error.message}`, 'error');
      }
    }
  });

  toolbar.insertBefore(addNoteToolbarButton, toolbar.firstChild);
  setNotesToolbarEnabled(richTextHasContent());

  // Expose a reset helper because the popup DOM persists across opens and there are multiple open paths.
  annotationPopup._phrazeResetNotesUI = () => {
    try { richTextDiv.innerHTML = ''; } catch (_) {}
    try { setNotesToolbarEnabled(false); } catch (_) {}
  };

  popupNotesSection.appendChild(popupNotesList);
  modalBody.appendChild(popupNotesSection);
  // Keep canvas container in DOM (hidden) for backwards-compat notes, but no toggle to show it
  modalBody.appendChild(canvasContainer);
  annotationPopup.appendChild(modalBody);

  await renderPopupNotes();

  // (wheel handling is done above with a non-passive capture listener)

  // Footer wrapper (matches `anno-update-folder/styles.css`)
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'modal-footer button-container';

  // Create Save button
  const addAnnotationButton = document.createElement('button');
  addAnnotationButton.className = 'add-annotation-button update-btn';
  
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
  // Always show "Add Annotation" (simplified UI)
  addAnnotationButton.appendChild(document.createTextNode(' Add Annotation'));

  // Add Annotation button click handler (handles notes, labels, and codes)
  addAnnotationButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation(); // Prevent other handlers from firing
    
    // Double-check permission before processing annotation
    if (!canAnnotate) {
      if (typeof showToast === 'function') {
        showToast('You do not have permission to ' + (hasExistingAnnotations() ? 'modify' : 'create') + ' annotations', 'error');
      }
      return;
    }
    
    // Prevent multiple simultaneous operations
    if (window.phrazeProcessingAnnotation) {
      console.log('Already processing annotation, ignoring click');
      return;
    }
    window.phrazeProcessingAnnotation = true;
    
    console.log(hasExistingAnnotations() ? 'Update Annotations button clicked' : 'Add Annotation button clicked');

    // Close popup immediately (visually) to avoid flicker / duplicate opens while saving,
    // but do NOT permanently close it (user must be able to reopen it later).
    phrazeClearKeepPopupOpen(highlight.id);
    phrazeClearPermanentlyClosed(highlight.id, annotationPopup);
    phrazeRemoveFromActiveIds(highlight.id);
    phrazeHidePopupElement(annotationPopup);

    // Close any other popup elements for the same highlight ID (defensive)
    try {
      const allPopups = document.querySelectorAll(`.annotation-popup[data-highlight-id="${highlight.id}"]`);
      allPopups.forEach(popup => {
        phrazeClearPermanentlyClosed(highlight.id, popup);
        phrazeHidePopupElement(popup);
      });
    } catch (_) {}
    
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

    // Notes are saved via the toolbar "Add note" action, not via the Add Annotation button.
    let noteText = '';
    
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
    
    if (annotationSource === 'region') {
      try {
        const regionId = String(opts.regionId || highlight.id || '');
        await updateRegionAnnotation(regionId, { labels: selectedLabels, updatedAt: new Date().toISOString() });
        try {
          const regions = await loadRegionAnnotations();
          const region = Array.isArray(regions) ? regions.find(r => r && String(r.id) === regionId) : null;
          annotationPopup._phrazeRegionCached = region;
        } catch (_) {}
      } catch (error) {
        console.error('Failed to save region labels:', error);
      }
    } else {
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
      
      // Notes are intentionally not modified here.
      
      // Refresh annotations map so the next hover/click shows updated labels/notes.
      try {
        await refreshAnnotationsMap({ force: true });
      } catch (err) {
        console.warn('Error refreshing annotations map:', err);
      }
    }
    
    // Clear processing flag after a short delay
    setTimeout(() => {
      window.phrazeProcessingAnnotation = false;
    }, 500);

    // Re-enable hover immediately after save (some paths temporarily disable it for the "new highlight" flow)
    try {
      if (window.phrazeEnableHoverForHighlightId && window.phrazeEnableHoverForHighlightId[highlight.id]) {
        window.phrazeEnableHoverForHighlightId[highlight.id]();
      } else if (containerSpan && containerSpan._enableHover) {
        containerSpan._enableHover();
      }
    } catch (_) {}
  });

  buttonContainer.appendChild(addAnnotationButton);
  annotationPopup.appendChild(buttonContainer);

  // Add popup to body
  document.body.appendChild(annotationPopup);

  // Store container span reference for repositioning
  annotationPopup._containerSpan = containerSpan;

  // Close popup when clicking outside
  const handlePopupClick = (e) => {
    // Only handle if popup is still open
    if (annotationPopup.style.display === 'none') {
      document.removeEventListener('click', handlePopupClick);
      return;
    }

    // If the user pinned this card, don't close it on outside clicks.
    if (annotationPopup.classList && annotationPopup.classList.contains('sticky')) {
      return;
    }

    // Clicking the related highlight should NOT count as an outside click (it is used to pin).
    const clickedOnThisHighlight = e.target && typeof e.target.closest === 'function'
      ? e.target.closest(`.phraze-highlight-container[data-highlight-id="${highlight.id}"]`)
      : null;
    
    const closestPopup = (e.target && typeof e.target.closest === 'function')
      ? e.target.closest('.annotation-popup')
      : null;

    // If user clicked another highlight while this popup is open, the click can land on the popup
    // (overlapping UI) and never reach the highlight. Detect the intended highlight and replay.
    const clickedHighlightContainer = (e.target && typeof e.target.closest === 'function')
      ? e.target.closest('.phraze-highlight-container[data-highlight-id]')
      : null;
    const clickedHighlightId = clickedHighlightContainer && clickedHighlightContainer.dataset
      ? clickedHighlightContainer.dataset.highlightId
      : null;
    const isDifferentHighlightClick = !!(clickedHighlightId && clickedHighlightId !== String(highlight.id));

    const isClickOnPopupSystem = annotationPopup.contains(e.target) ||
                                closestPopup ||
                                clickedOnThisHighlight;
    
    if (!isClickOnPopupSystem) {
      // Close popup (do NOT permanently close; allow hover/click to reopen)
      phrazeHidePopupElement(annotationPopup);

      // Clear "keep open" (new highlight flow) and re-enable hover for this highlight.
      try {
        phrazeClearPermanentlyClosed(highlight.id, annotationPopup);
      } catch (_) {}
      try {
        phrazeClearPermanentlyClosed(highlight.id, annotationPopup);
      } catch (_) {}
      try {
        phrazeClearKeepPopupOpen(highlight.id);
      } catch (_) {}
      try {
        if (window.phrazeEnableHoverForHighlightId && window.phrazeEnableHoverForHighlightId[highlight.id]) {
          window.phrazeEnableHoverForHighlightId[highlight.id]();
        } else if (containerSpan && containerSpan._enableHover) {
          containerSpan._enableHover();
        }
      } catch (_) {}
      
      // Remove this highlight ID from the active list to prevent reopening
      phrazeRemoveFromActiveIds(highlight.id);
      
      // Remove this event listener after closing
      document.removeEventListener('click', handlePopupClick);

      // If the user was trying to switch to another highlight, replay the click so the other
      // highlight opens immediately (no extra "random click" needed).
      if (isDifferentHighlightClick && clickedHighlightContainer && !window._phrazeReplayingHighlightClick) {
        window._phrazeReplayingHighlightClick = true;
        requestAnimationFrame(() => {
          try {
            clickedHighlightContainer.click();
          } catch (_) {}
          window._phrazeReplayingHighlightClick = false;
        });
      }
    }
  };
  
  // Use capture phase to handle before other handlers
  document.addEventListener('click', handlePopupClick, true);

  return annotationPopup;
}

function isNodeAHighlight(node) {
  return node && node.classList && node.classList.contains("PhrazeMark");
}

/**
 * Loads highlights into provided text and returns HTML with highlights applied
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

    // Reset notes controls before hydrating (popup DOM persists across opens)
    // Keep editor empty and disable toolbar + Add note until user types.
    try {
      if (annotationPopup && typeof annotationPopup._phrazeResetNotesUI === 'function') {
        annotationPopup._phrazeResetNotesUI();
      }
    } catch (_) {}
    
    // Load existing annotations into the popup
    await loadExistingAnnotationsIntoPopup(highlight, selectedLabelsContainer, richTextDiv, canvas, canvasContainer, toolbar, textModeBtn, canvasModeBtn, modeRef);

    // Ensure header title reflects the latest stored labels/notes when opening.
    try {
      if (annotationPopup && typeof annotationPopup._phrazeUpdateHeaderTitle === 'function') {
        annotationPopup._phrazeUpdateHeaderTitle();
      }
    } catch (_) {}

    // Reset notes controls every time the popup opens (popup DOM persists across opens)
    // Keep editor empty and disable toolbar + Add note until user types.
    try {
      if (annotationPopup && typeof annotationPopup._phrazeResetNotesUI === 'function') {
        annotationPopup._phrazeResetNotesUI();
      }
    } catch (_) {}
    
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
    
    const closestPopup = (e.target && typeof e.target.closest === 'function')
      ? e.target.closest('.annotation-popup')
      : null;
    const closestAddNoteBtn = (e.target && typeof e.target.closest === 'function')
      ? e.target.closest('.add-note-btn')
      : null;

    const clickedHighlightContainer = (e.target && typeof e.target.closest === 'function')
      ? e.target.closest('.phraze-highlight-container[data-highlight-id]')
      : null;
    const clickedHighlightId = clickedHighlightContainer && clickedHighlightContainer.dataset
      ? clickedHighlightContainer.dataset.highlightId
      : null;
    const isDifferentHighlightClick = !!(clickedHighlightId && clickedHighlightId !== String(highlight.id));

    const isClickOnPopupSystem = annotationPopup.contains(e.target) ||
                                addNoteButton.contains(e.target) ||
                                closestPopup ||
                                closestAddNoteBtn;
    
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
      if (window.phrazeEnableHoverForHighlightId && window.phrazeEnableHoverForHighlightId[highlight.id]) {
        window.phrazeEnableHoverForHighlightId[highlight.id]();
      } else if (containerSpan._enableHover) {
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

      // If user was clicking another highlight while this popup was open, replay the click so
      // the target highlight opens immediately (avoids the "click somewhere random" workaround).
      if (isDifferentHighlightClick && clickedHighlightContainer && !window._phrazeReplayingHighlightClick) {
        window._phrazeReplayingHighlightClick = true;
        requestAnimationFrame(() => {
          try {
            clickedHighlightContainer.click();
          } catch (_) {}
          window._phrazeReplayingHighlightClick = false;
        });
      }
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
  try { bindPhrazeHighlightColorChangeListener(); } catch (_) {}
  // Prevent concurrent calls - if already loading, skip this call
  if (isLoadingHighlights) {
    // Queue the latest request so new highlights / state changes aren't dropped.
    // This commonly happens right after creating a highlight (saveHighlight -> loadHighlights)
    // while a periodic refresh is already in progress.
    try {
      window._phrazePendingLoadHighlights = { showAllLabelsAndCodes, newHighlightId };
    } catch (_) {}
    return;
  }
  
  isLoadingHighlights = true;
  try {
    // Clean up expired "show card" entries and hide any cards that should have expired
    if (window.phrazeShowCardUntil) {
      const now = Date.now();
      for (const [highlightId, expireTime] of Object.entries(window.phrazeShowCardUntil)) {
        if (now >= expireTime) {
          // Time expired - hide the popup and remove from tracking
          const expiredCard = document.querySelector(`.annotation-popup[data-highlight-id="${highlightId}"]`);
          if (expiredCard && !expiredCard.matches(':hover')) {
            expiredCard.classList.remove('active');
            expiredCard.classList.remove('sticky');
            phrazeHidePopupElement(expiredCard);
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

  // Shared hover/card state across multi-line highlight fragments
  if (!window.phrazeUnifiedCardByHighlightId) {
    window.phrazeUnifiedCardByHighlightId = {};
  }
  if (!window.phrazeHoverStateByHighlightId) {
    window.phrazeHoverStateByHighlightId = {};
  }
  if (!window.phrazeEnableHoverForHighlightId) {
    window.phrazeEnableHoverForHighlightId = {};
  }

  if (!window.phrazeUnifiedGlobalHandlersInstalled) {
    window.phrazeUnifiedGlobalHandlersInstalled = true;

    const hideInstantly = (card) => {
      if (!card) return;
      const prevTransition = card.style.transition;
      card.style.transition = 'none';
      card.classList.remove('active');
      card.classList.remove('sticky');
      card.style.opacity = 0;
      card.style.pointerEvents = 'none';
      card.style.visibility = 'hidden';
      card.setAttribute('aria-hidden', 'true');
      void card.offsetHeight;
      requestAnimationFrame(() => {
        card.style.transition = prevTransition;
      });
    };

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const popups = document.querySelectorAll('.annotation-popup[data-highlight-id]');
      popups.forEach(popup => {
        if (popup.classList.contains('sticky')) return;
        const trigger = popup._lastTriggerEl;
        popup.classList.remove('active');
        popup.classList.remove('sticky');
        phrazeHidePopupElement(popup);
        if (trigger && trigger.focus) {
          try { trigger.focus(); } catch (_) {}
        }
      });
    }, true);
  }

  for (const [node, ranges2] of finalNodes) {
    var ranges = ranges2.sort((a, b) => ((b[0] - a[0]) * 1000000000 + (b[1] - a[1])));
    var lastRange = null;
    for (const range of ranges) {
      var textNodeIndex = range[0];
      var start = range[1];
      var end = range[2];
      // IMPORTANT: must be block-scoped so event handlers close over the correct highlight
      // (using `var` here can cause all hover/click handlers to reference the last highlight).
      const highlight = range[3]; //Temporarily packed in from above so that we can link each range to the highlight it came from

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
          containerSpan.dataset.highlightId = highlight.id;

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

          // Create/reuse the unified annotation card per highlight ID
          let annotationCard = window.phrazeUnifiedCardByHighlightId[highlight.id];
          if (!annotationCard || !document.body.contains(annotationCard)) {
            annotationCard = await createUnifiedAnnotationCard(highlight, containerSpan);
            window.phrazeUnifiedCardByHighlightId[highlight.id] = annotationCard;
          }
          
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
          
          const hoverState = window.phrazeHoverStateByHighlightId[highlight.id] || {
            overSegments: 0,
            overCard: false,
            hideTimeout: null,
            // Hover/click should always be able to open the unified popup.
            // The "new highlight" flow is handled by `shouldBeActive` (auto-open), not by disabling hover.
            hoverEnabled: true
          };
          // If this hoverState object already existed from an earlier render, it may have hoverEnabled=false.
          // Force it back on so highlights are immediately interactive after creating/saving.
          hoverState.hoverEnabled = true;
          window.phrazeHoverStateByHighlightId[highlight.id] = hoverState;

          // Function to enable hover behavior (called when popup closes)
          containerSpan._enableHover = () => {
            hoverState.hoverEnabled = true;
            if (annotationCard.style.display === 'none') {
              annotationCard.style.display = '';
            }
            annotationCard.style.visibility = '';
          };

          // Allow popup close buttons (inside card creation) to enable hover for ALL fragments of this highlight
          window.phrazeEnableHoverForHighlightId[highlight.id] = () => {
            hoverState.hoverEnabled = true;
          };

          // Source-of-truth hover check across multi-line fragments.
          // This avoids `overSegments` getting stuck > 0 due to missed mouseleave events.
          const isAnyFragmentHovered = () => {
            try {
              return document.querySelectorAll(`.phraze-highlight-container[data-highlight-id="${highlight.id}"]:hover`).length > 0;
            } catch (_) {
              return false;
            }
          };

          // Source-of-truth hover check for the popup itself (includes descendants like the labels dropdown).
          const isCardHovered = () => {
            try {
              return !!(annotationCard && annotationCard.matches && annotationCard.matches(':hover'));
            } catch (_) {
              return false;
            }
          };

          const clearHideTimeout = () => {
            if (hoverState.hideTimeout) {
              clearTimeout(hoverState.hideTimeout);
              hoverState.hideTimeout = null;
            }
          };

          const scheduleHide = () => {
            clearHideTimeout();
            hoverState.hideTimeout = setTimeout(() => {
              if (annotationCard.classList.contains('sticky')) return;
              // If user is actively interacting with the popup (eg scrolling labels dropdown), do not auto-hide.
              try {
                if (annotationCard._phrazeLabelsDropdownOpen) return;
                if (annotationCard._phrazePreventHoverCloseUntil && Date.now() < annotationCard._phrazePreventHoverCloseUntil) return;
              } catch (_) {}
              const activeEl = document.activeElement;
              if (activeEl && annotationCard.contains(activeEl)) {
                return;
              }
              const segmentsHovered = isAnyFragmentHovered();
              const cardHoveredNow = isCardHovered();
              if (!segmentsHovered && !hoverState.overCard && !cardHoveredNow) {
                annotationCard.classList.remove('active');
                annotationCard.style.opacity = 0;
                annotationCard.style.pointerEvents = "none";
                annotationCard.style.visibility = 'hidden';
                annotationCard.setAttribute('aria-hidden', 'true');
                // If this hover preview temporarily hid a pinned card, restore it now.
                try {
                  const hiddenPinned = annotationCard._phrazeTempHiddenPinnedCards;
                  if (hiddenPinned && Array.isArray(hiddenPinned) && hiddenPinned.length > 0) {
                    hiddenPinned.forEach((pinnedCard) => {
                      try {
                        if (!pinnedCard) return;
                        if (!pinnedCard.classList || !pinnedCard.classList.contains('sticky')) return;
                        pinnedCard.classList.add('active');
                        pinnedCard.style.display = '';
                        pinnedCard.style.visibility = 'visible';
                        pinnedCard.style.opacity = 1;
                        pinnedCard.style.pointerEvents = 'auto';
                        pinnedCard.setAttribute('aria-hidden', 'false');
                      } catch (_) {}
                    });
                  }
                } catch (_) {}
                try { annotationCard._phrazeTempHiddenPinnedCards = []; } catch (_) {}
              }
            }, 220);
          };

          const hideCardInstantly = (card) => {
            if (!card) return;
            try {
              if (typeof card._phrazeResetLabelsDropdown === 'function') {
                card._phrazeResetLabelsDropdown();
              }
            } catch (_) {}
            const prevTransition = card.style.transition;
            card.style.transition = 'none';
            card.classList.remove('active');
            card.style.opacity = 0;
            card.style.pointerEvents = "none";
            card.style.visibility = 'hidden';
            card.setAttribute('aria-hidden', 'true');
            void card.offsetHeight;
            requestAnimationFrame(() => {
              card.style.transition = prevTransition;
            });
          };

          const hideCardSoftly = (card, durationMs = 120) => {
            if (!card) return;
            try {
              if (typeof card._phrazeResetLabelsDropdown === 'function') {
                card._phrazeResetLabelsDropdown();
              }
            } catch (_) {}
            const token = (card._phrazeHideAnimToken = (card._phrazeHideAnimToken || 0) + 1);
            const prevTransition = card.style.transition;
            card.style.transition = `opacity ${durationMs}ms ease, transform ${durationMs}ms ease`;
            card.style.opacity = 0;
            card.style.pointerEvents = "none";
            card.style.transform = 'translateY(-2px)';
            window.setTimeout(() => {
              if (!card) return;
              if (card._phrazeHideAnimToken !== token) return; // cancelled by a re-open
              card.classList.remove('active');
              card.style.visibility = 'hidden';
              card.setAttribute('aria-hidden', 'true');
              // restore previous transition to avoid accumulating inline styles
              card.style.transition = prevTransition;
            }, durationMs);
          };

          const hydratePopupFromExistingData = async () => {
            try {
              if (annotationCard._phrazeHydratingExisting) return;
              annotationCard._phrazeHydratingExisting = true;

              const selectedLabelsContainer = annotationCard.querySelector('.selected-labels-container');
              const richTextDiv = annotationCard.querySelector('[contenteditable="true"]');
              const canvas = annotationCard.querySelector('canvas');
              const canvasContainer = annotationCard.querySelector('.canvas-container');
              const toolbar = annotationCard.querySelector('.annotation-toolbar');
              const textModeBtn = annotationCard.querySelector('.text-mode-btn');
              const canvasModeBtn = annotationCard.querySelector('.canvas-mode-btn');
              const modeRef = { current: 'text' };

              // Reset notes controls before hydrating (card DOM persists across opens)
              try {
                if (annotationCard && typeof annotationCard._phrazeResetNotesUI === 'function') {
                  annotationCard._phrazeResetNotesUI();
                }
              } catch (_) {}

              // Ensure the header reflects whether we are adding or updating.
              try {
                if (annotationCard && typeof annotationCard._phrazeUpdateHeaderTitle === 'function') {
                  annotationCard._phrazeUpdateHeaderTitle();
                }
              } catch (_) {}

              await loadExistingAnnotationsIntoPopup(
                highlight,
                selectedLabelsContainer,
                richTextDiv,
                canvas,
                canvasContainer,
                toolbar,
                textModeBtn,
                canvasModeBtn,
                modeRef
              );

              // Reset notes controls on open (popup DOM persists across opens)
              try {
                if (annotationCard && typeof annotationCard._phrazeResetNotesUI === 'function') {
                  annotationCard._phrazeResetNotesUI();
                }
              } catch (_) {}

              // Re-evaluate after hydration in case labels/notes changed.
              try {
                if (annotationCard && typeof annotationCard._phrazeUpdateHeaderTitle === 'function') {
                  annotationCard._phrazeUpdateHeaderTitle();
                }
              } catch (_) {}
            } catch (err) {
              console.warn('Failed to hydrate popup from existing annotations', err);
            } finally {
              try { annotationCard._phrazeHydratingExisting = false; } catch (_) {}
            }
          };

          const showCardAsHover = () => {
            if (!hoverState.hoverEnabled) return;
            if (window.phrazeIsResizingCard) return;

            // If this card is already pinned, just keep it visible.
            if (annotationCard.classList.contains('sticky')) {
              clearHideTimeout();
              annotationCard.classList.add('active');
              annotationCard.style.display = '';
              annotationCard.style.visibility = 'visible';
              annotationCard.style.opacity = 1;
              annotationCard.style.pointerEvents = 'auto';
              annotationCard.setAttribute('aria-hidden', 'false');
              return;
            }

            // If some other card is pinned, temporarily hide it while this hover preview is visible.
            try {
              const pinnedVisible = Array.from(document.querySelectorAll('.annotation-popup.sticky'))
                .filter((el) => el && el !== annotationCard)
                .filter((el) => el.style.display !== 'none' && window.getComputedStyle(el).display !== 'none');
              if (pinnedVisible.length > 0) {
                annotationCard._phrazeTempHiddenPinnedCards = pinnedVisible;
                pinnedVisible.forEach((pinnedCard) => {
                  try {
                    hideCardInstantly(pinnedCard);
                    // Keep it sticky so it restores as pinned.
                    pinnedCard.classList.add('sticky');
                  } catch (_) {}
                });
              } else {
                annotationCard._phrazeTempHiddenPinnedCards = [];
              }
            } catch (_) {
              try { annotationCard._phrazeTempHiddenPinnedCards = []; } catch (_) {}
            }

            const openCards = document.querySelectorAll('.annotation-popup');
            openCards.forEach(card => {
              if (card === annotationCard) return;
              const isVisible = card.style.display !== 'none' && window.getComputedStyle(card).display !== 'none';
              if (!isVisible) return;
              if (card.classList && card.classList.contains('sticky')) return; // never close pinned on hover
              hideCardInstantly(card);
              card.classList.remove('sticky');
            });

            clearHideTimeout();
            // Treat hover as boolean rather than a counter (counter can desync across fragments).
            hoverState.overSegments = 1;
            annotationCard.classList.add('active');
            annotationCard.style.display = '';
            annotationCard.style.visibility = 'visible';
            annotationCard.style.opacity = 1;
            annotationCard.style.pointerEvents = 'auto';
            annotationCard.style.transform = 'translateY(0px)';
            annotationCard._phrazeHideAnimToken = (annotationCard._phrazeHideAnimToken || 0) + 1;
            annotationCard.setAttribute('aria-hidden', 'false');

            if (!(annotationCard._phrazeHoverFreeze && annotationCard._phrazeHoverFreeze.container === containerSpan)) {
              scheduleHoverFreezePositionUpdate(annotationCard, containerSpan);
            }

            // Ensure labels/notes are loaded when opening.
            void hydratePopupFromExistingData();
          };

          const openCardNonSticky = (e) => {
            try { if (e) e.stopPropagation(); } catch (_) {}
            clearHideTimeout();
            hoverState.overSegments = Math.max(hoverState.overSegments, 1);
            hoverState.overCard = true;

            const openCards = document.querySelectorAll('.annotation-popup');
            openCards.forEach(card => {
              if (card === annotationCard) return;
              const isVisible = card.style.display !== 'none' && window.getComputedStyle(card).display !== 'none';
              if (!isVisible) return;
              // Only allow one popup open at a time.
              hideCardInstantly(card);
              card.classList.remove('sticky');
            });

            annotationCard.classList.add('active');
            annotationCard.classList.remove('sticky');
            annotationCard.style.display = '';
            annotationCard.style.visibility = 'visible';
            annotationCard.style.opacity = 1;
            annotationCard.style.pointerEvents = 'auto';
            annotationCard.setAttribute('aria-hidden', 'false');

            void hydratePopupFromExistingData();
            scheduleFloaterPositionUpdate(annotationCard, containerSpan);
          };

          const togglePinned = (e) => {
            try { if (e) e.stopPropagation(); } catch (_) {}
            clearHideTimeout();

            const isPinned = annotationCard.classList.contains('sticky');
            if (isPinned) {
              annotationCard.classList.remove('sticky');
              // Keep it visible (acts like opened), but no longer pinned.
              annotationCard.classList.add('active');
              annotationCard.style.display = '';
              annotationCard.style.visibility = 'visible';
              annotationCard.style.opacity = 1;
              annotationCard.style.pointerEvents = 'auto';
              annotationCard.setAttribute('aria-hidden', 'false');
              scheduleFloaterPositionUpdate(annotationCard, containerSpan);
              return;
            }

            // Only allow one popup open at a time.
            try {
              const openCards = document.querySelectorAll('.annotation-popup');
              openCards.forEach(card => {
                if (card === annotationCard) return;
                const isVisible = card.style.display !== 'none' && window.getComputedStyle(card).display !== 'none';
                if (!isVisible) return;
                hideCardInstantly(card);
                card.classList.remove('sticky');
              });
            } catch (_) {}

            annotationCard.classList.add('active');
            annotationCard.classList.add('sticky');
            annotationCard.style.display = '';
            annotationCard.style.visibility = 'visible';
            annotationCard.style.opacity = 1;
            annotationCard.style.pointerEvents = 'auto';
            annotationCard.setAttribute('aria-hidden', 'false');

            void hydratePopupFromExistingData();

            try {
              const scrollContainer = getPhrazeHighlightScrollContainer(containerSpan);
              const rect = annotationCard.getBoundingClientRect();
              if (scrollContainer) {
                const containerRect = scrollContainer.getBoundingClientRect();
                const localLeft = rect.left - containerRect.left + (scrollContainer.scrollLeft || 0);
                const localTop = rect.top - containerRect.top + (scrollContainer.scrollTop || 0);
                annotationCard._phrazePinFreeze = { container: scrollContainer, left: localLeft, top: localTop };
                annotationCard._phrazePinnedStaticPos = { container: scrollContainer, left: localLeft, top: localTop };
              } else {
                annotationCard._phrazePinnedStaticPos = null;
              }
            } catch (_) {}

            try { annotationCard._phrazeHoverFreeze = null; } catch (_) {}
            scheduleFloaterPositionUpdate(annotationCard, containerSpan);
          };

          // Click-only UX:
          // - single click opens (non-pinned)
          // - double click toggles pin
          containerSpan._phrazeClickTimer = null;
          containerSpan._phrazeLastOpenAt = 0;
          containerSpan.addEventListener('click', (e) => {
            // Sync clicked highlight color into the fixed top toolbar.
            try {
              document.dispatchEvent(new CustomEvent('phraze:active-highlight-changed', {
                detail: {
                  highlightId: String(highlight && highlight.id ? highlight.id : containerSpan.dataset.highlightId),
                  hex: (highlight && highlight.color) ? highlight.color : undefined,
                  name: (highlight && highlight.colorName) ? highlight.colorName : undefined
                }
              }));
            } catch (_) {}

            // Delay to allow dblclick to cancel the single-click action.
            if (containerSpan._phrazeClickTimer) {
              clearTimeout(containerSpan._phrazeClickTimer);
              containerSpan._phrazeClickTimer = null;
            }
            containerSpan._phrazeClickTimer = setTimeout(() => {
              containerSpan._phrazeClickTimer = null;
              try {
                const now = Date.now();
                const isOpen = annotationCard.classList.contains('active') &&
                  annotationCard.style.visibility !== 'hidden' &&
                  annotationCard.style.opacity !== '0';
                const isPinned = annotationCard.classList.contains('sticky');
                const recentlyOpened = containerSpan._phrazeLastOpenAt && (now - containerSpan._phrazeLastOpenAt) <= 2200;

                // If user clicks again shortly after opening (and it's not pinned yet), pin it.
                if (isOpen && !isPinned && recentlyOpened) {
                  togglePinned(e);
                  return;
                }

                openCardNonSticky(e);
                containerSpan._phrazeLastOpenAt = now;
              } catch (_) {
                openCardNonSticky(e);
              }
            }, 220);
          });

          containerSpan.addEventListener('dblclick', (e) => {
            if (containerSpan._phrazeClickTimer) {
              clearTimeout(containerSpan._phrazeClickTimer);
              containerSpan._phrazeClickTimer = null;
            }
            togglePinned(e);
          });
          
          // Add scroll listener to update position when page scrolls
          const updateCardPositionOnScroll = () => {
            // Only update if card is active/visible
            if (annotationCard.classList.contains('active')) {
              // Pinned cards are locked to their pinned position; they scroll naturally with the chat container.
              // Hover-preview cards should NOT follow while scrolling; hide them immediately.
              if (!annotationCard.classList.contains('sticky')) {
                // If we're actively scrolling the labels dropdown, ignore scroll-hide briefly.
                // This prevents the hover card from closing when tiny scroll events leak through.
                try {
                  if (annotationCard._phrazeIgnoreScrollHideUntil && Date.now() < annotationCard._phrazeIgnoreScrollHideUntil) {
                    return;
                  }
                } catch (_) {}
                // Give a small grace period on scroll so it doesn't feel like it "snaps" closed.
                // We debounce so continuous scrolling doesn't repeatedly close/reopen; it closes shortly after scroll stops.
                try {
                  if (annotationCard._phrazeScrollHideTimeout) {
                    clearTimeout(annotationCard._phrazeScrollHideTimeout);
                  }
                  annotationCard._phrazeScrollHideTimeout = setTimeout(() => {
                    try {
                      annotationCard._phrazeHoverFreeze = null;
                    } catch (_) {}
                    try {
                      hoverState.overSegments = 0;
                      hoverState.overCard = false;
                    } catch (_) {}
                    hideCardSoftly(annotationCard, 120);
                  }, 35);
                  return;
                } catch (_) {}
                try {
                  annotationCard._phrazeHoverFreeze = null;
                } catch (_) {}
                try {
                  hoverState.overSegments = 0;
                  hoverState.overCard = false;
                } catch (_) {}
                hideCardSoftly(annotationCard, 120);
              }
            }
          };
          
          const chatScrollContainer = getPhrazeHighlightScrollContainer(containerSpan);

          // Add scroll event listeners to window and the chat scroll container (internal scrolling).
          // IMPORTANT: bind at most once per popup (multi-line highlights create multiple fragments).
          if (!annotationCard._phrazeScrollListenersBound) {
            annotationCard._phrazeScrollListenersBound = true;
            window.addEventListener('scroll', updateCardPositionOnScroll, true);
            window.addEventListener('resize', updateCardPositionOnScroll, true);
            if (chatScrollContainer) {
              chatScrollContainer.addEventListener('scroll', updateCardPositionOnScroll, { passive: true });
              annotationCard._phrazeScrollContainer = chatScrollContainer;
            }
            
            // Store cleanup function on the card for later removal
            annotationCard._scrollCleanup = () => {
              window.removeEventListener('scroll', updateCardPositionOnScroll, true);
              window.removeEventListener('resize', updateCardPositionOnScroll, true);
              const sc = annotationCard._phrazeScrollContainer;
              if (sc) {
                try { sc.removeEventListener('scroll', updateCardPositionOnScroll); } catch (_) {}
              }
            };
          }

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

          containerSpan.setAttribute('role', 'button');
          containerSpan.setAttribute('aria-haspopup', 'dialog');
          containerSpan.tabIndex = 0;
          if (!containerSpan._phrazeKbBound) {
            containerSpan._phrazeKbBound = true;
            containerSpan.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                containerSpan.click();
              }
            });
          }
          // Add the annotation card to the body
          if (!annotationCard.parentNode) {
            document.body.appendChild(annotationCard);
          }
          
          // Show popup immediately after card is added to DOM (if this is a new highlight)
          // CRITICAL: Only show popup if this is truly a NEW highlight (no annotations yet) AND not permanently closed
          if (shouldBeActive) {
            // Check if this popup is permanently closed - check multiple sources to be thorough
            const existingPopup = document.querySelector(`.annotation-popup[data-highlight-id="${highlight.id}"]`);
            const isPermanentlyClosed = (window.phrazePermanentlyClosedPopups && window.phrazePermanentlyClosedPopups.has(highlight.id)) || 
                                       (existingPopup && existingPopup.dataset.permanentlyClosed === 'true');
            
            // Also check if any popup with this highlight ID is marked as permanently closed
            const anyPopupClosed = document.querySelectorAll(`.annotation-popup[data-highlight-id="${highlight.id}"][data-permanently-closed="true"]`).length > 0;
            
            // Check if highlight already has annotations - if it does, don't show popup (user already annotated it)
            const hasAnnotations = (window.highlightsToAnnotationsMap && window.highlightsToAnnotationsMap[highlight.id] && window.highlightsToAnnotationsMap[highlight.id].length > 0) ||
                                   (highlight.notes && Array.isArray(highlight.notes) && highlight.notes.length > 0);
            
            // Only show popup if:
            // 1. Popup is not permanently closed
            // 2. Highlight doesn't already have annotations (if it does, user already annotated it)
            //
            // Even if user can't "create annotations", we still show the popup UI; the Save button is already hidden
            // via permission checks in `createUnifiedAnnotationCard()`. This prevents the confusing "can't open at all"
            // state right after creating a highlight.
            if (!isPermanentlyClosed && !anyPopupClosed && !hasAnnotations) {
              // Add a small delay to ensure all DOM operations complete
              requestAnimationFrame(() => {
                // Query for the popup directly using its data attribute
                const annotationPopup = document.querySelector(`.annotation-popup[data-highlight-id="${highlight.id}"]`);
                
                // Double-check that it's not permanently closed (race condition protection)
                const stillClosed = (window.phrazePermanentlyClosedPopups && window.phrazePermanentlyClosedPopups.has(highlight.id)) ||
                                   (annotationPopup && annotationPopup.dataset.permanentlyClosed === 'true');
                
                if (annotationPopup && !stillClosed && annotationPopup.dataset.permanentlyClosed !== 'true') {
                  // Close ALL other open popups first (Zotero behavior: only one popup at a time)
                  const allPopups = document.querySelectorAll('.annotation-popup');
                  allPopups.forEach(popup => {
                    // Skip if this is the popup we're about to open
                    if (popup.dataset.highlightId === highlight.id) return;
                    
                    // Check if popup is currently visible (check multiple ways)
                    const isVisible = popup.style.display === 'block' || 
                                     popup.style.display !== 'none' ||
                                     popup.style.opacity !== '0' ||
                                     window.getComputedStyle(popup).display !== 'none';
                    
                    if (!isVisible) return;
                    // Skip if this is the popup we're about to open
                    if (popup.dataset.highlightId === highlight.id) return;
                    
                    // Close other popups (do NOT permanently close; user can reopen)
                    phrazeHidePopupElement(popup);
                    const otherHighlightId = popup.dataset.highlightId;
                    if (otherHighlightId) {
                      phrazeClearPermanentlyClosed(otherHighlightId, popup);
                      phrazeClearKeepPopupOpen(otherHighlightId);
                      phrazeRemoveFromActiveIds(otherHighlightId);
                    }
                  });

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
          
          // Add document-level click handler to close sticky cards when clicking outside.
          // IMPORTANT: bind at most once per popup (multi-line highlights create multiple fragments).
          // Also, treat ANY fragment of this highlight as "clicked on highlight" (not just the current containerSpan).
          if (!annotationCard._phrazeStickyOutsideClickBound) {
            annotationCard._phrazeStickyOutsideClickBound = true;
            const documentClickHandler = (e) => {
              // Only handle non-Phraze clicks to avoid interfering with other page elements
              const targetEl = (e && e.target && e.target.nodeType === 1) ? e.target : null;
              const targetClosest = (targetEl && typeof targetEl.closest === 'function') ? targetEl.closest.bind(targetEl) : null;
              const targetHasClass = (targetEl && targetEl.classList) ? targetEl.classList.contains.bind(targetEl.classList) : () => false;
              if (!targetClosest || (!targetClosest('.PhrazeMark') && !targetHasClass('PhrazeMark'))) {
                if (!annotationCard.classList.contains('sticky')) return;
                const clickedOnAnyHighlightFragment = targetClosest ? !!targetClosest(`.phraze-highlight-container[data-highlight-id="${highlight.id}"]`) : false;
                const clickedOnCard = annotationCard.contains(e.target);
                const clickedOnPopup = targetClosest ? targetClosest('.annotation-popup') : null;
                if (!clickedOnAnyHighlightFragment && !clickedOnCard && !clickedOnPopup) {
                  annotationCard.classList.remove('active');
                  annotationCard.classList.remove('sticky');
                  try {
                    if (annotationCard.dataset) {
                      delete annotationCard.dataset.pinnedPlacement;
                    }
                  } catch (_) {}
                  annotationCard.style.opacity = 0;
                  annotationCard.style.pointerEvents = "none";
                }
              }
            };

            // Add the click handler to document with capture to handle before other handlers
            document.addEventListener('click', documentClickHandler, true);

            // Store cleanup function to remove the document click handler (chain with existing)
            const originalScrollCleanup = annotationCard._scrollCleanup;
            annotationCard._scrollCleanup = () => {
              if (originalScrollCleanup) originalScrollCleanup();
              document.removeEventListener('click', documentClickHandler, true);
            };
          }
          
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
    // If something queued another load while we were running, replay it now (latest-wins).
    try {
      const pending = window._phrazePendingLoadHighlights;
      if (pending) {
        window._phrazePendingLoadHighlights = null;
        // Fire-and-forget; this function already guards re-entrancy.
        void loadHighlights(pending.showAllLabelsAndCodes, pending.newHighlightId);
      }
    } catch (_) {}
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
async function refreshAnnotationsMap(options = {}) {
  try {
    const { force = false } = options || {};
    // Skip if currently processing annotation to avoid conflicts
    if (!force && window.phrazeProcessingAnnotation) {
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
    
    // Only refresh if there are annotation popups visible
    const visibleCards = document.querySelectorAll('.annotation-popup.active');
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