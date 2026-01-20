# Annotation Popup Reopen Prevention Fix

## Problem

The annotation popup (`.annotation-popup`) was reopening even after the user closed it, whenever `loadHighlights()` was called again (e.g., when adding a label or code). 

### Root Cause

The highlight ID was being added to `window.phrazeActiveAnnotationCardIds` when the popup opened, but was **not being removed** when the popup was closed. This caused the popup to reopen when `loadHighlights()` ran because it checked if the highlight ID was in the active list.

**Flow of the bug:**
1. User highlights text → Popup opens → Highlight ID added to `window.phrazeActiveAnnotationCardIds`
2. User closes popup (X button or click outside) → **ID NOT removed from active list** ❌
3. User adds a label/code → `loadHighlights()` is called
4. Code checks `previouslyActiveCardIds.includes(highlight.id)` → Finds the ID → **Popup reopens unwantedly** ❌

## Solution

Added cleanup code to **remove the highlight ID from the active list** whenever the annotation popup is closed, in all three close scenarios:

### 1. Popup Close Button (X) - Lines 690-700

```javascript
closeButton.addEventListener('click', () => {
  annotationPopup.style.display = 'none';
  
  // Remove this highlight ID from the active list to prevent reopening
  if (window.phrazeActiveAnnotationCardIds) {
    const index = window.phrazeActiveAnnotationCardIds.indexOf(highlight.id);
    if (index > -1) {
      window.phrazeActiveAnnotationCardIds.splice(index, 1);
    }
  }
});
```

### 2. Click Outside Popup - Lines 2001-2020

```javascript
const handlePopupClick = (e) => {
  const isClickOnPopupSystem = annotationPopup.contains(e.target) || 
                              addNoteButton.contains(e.target);
  
  if (!isClickOnPopupSystem) {
    annotationPopup.style.display = 'none';
    
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
```

### 3. Unified Card Close Button - Lines 2405-2425

When the unified card is closed, also close the popup and remove from active list:

```javascript
closeCardButton.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  annotationCard.classList.remove('active');
  annotationCard.style.opacity = 0;
  annotationCard.style.pointerEvents = "none";
  
  // Also close the annotation popup if it's open
  const annotationPopup = document.querySelector(`.annotation-popup[data-highlight-id="${highlight.id}"]`);
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
```

## Expected Behavior After Fix

### ✅ Correct Flow:
1. User highlights text → Popup opens → Highlight ID added to active list
2. User closes popup (any method) → **Highlight ID removed from active list** ✅
3. User adds a label/code → `loadHighlights()` is called
4. Code checks `previouslyActiveCardIds.includes(highlight.id)` → **ID not found** → Popup stays closed ✅

### Scenarios Covered:

| Scenario | Popup Behavior | Active List |
|----------|---------------|-------------|
| Click popup X button | Closes | ID removed ✅ |
| Click outside popup | Closes | ID removed ✅ |
| Click unified card X | Both close | ID removed ✅ |
| `loadHighlights()` called after closing | Stays closed | ID not in list ✅ |
| Save annotation & popup closes | Stays closed | ID removed on close ✅ |

## Key Points

✅ **All close methods** now remove the highlight ID from the active list
✅ **Prevents unwanted reopening** when `loadHighlights()` is called
✅ **Unified card close button** also closes the popup and cleans up
✅ **Consistent behavior** across all close interactions
✅ **No memory leaks** - proper cleanup on all close paths

## Testing Instructions

1. Open Demonstration page
2. Highlight some text (popup opens)
3. **Close the popup** using the X button
4. Add a label or code to another highlight (triggers `loadHighlights()`)
5. **Verify**: First popup should **NOT reopen** ✅
6. Repeat with closing via clicking outside
7. **Verify**: Popup should **NOT reopen** ✅
8. Highlight text, close unified card with its X button
9. Add another highlight
10. **Verify**: Previous popup should **NOT reopen** ✅

## Files Modified

- `/Users/hetpatel/Desktop/phraze-main 2/src/utils/highlighting.js`
  - Popup close button handler (lines 690-700)
  - Click outside handler (lines 2006-2015)
  - Unified card close button (lines 2405-2425)

## Backward Compatibility

✅ No breaking changes
✅ All existing functionality preserved
✅ Only affects popup reopening behavior
✅ Properly cleans up active ID list in all scenarios

