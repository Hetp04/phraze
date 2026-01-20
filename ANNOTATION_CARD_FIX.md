# Annotation Card Display Fix

## Problem Summary

The annotation card (class: `phraze-unified-annotation-card PhrazeMark active`) had two issues:

1. **Required Two Actions**: The card only appeared after:
   - Highlighting text
   - Then clicking on the highlighted text
   
2. **Premature Disappearance**: The card would disappear when `loadHighlights()` executed because it was clearing all annotation cards

## Root Cause

The `loadHighlights()` function was calling `clearHighlights()` which removed ALL annotation cards (including active ones) whenever highlights were reloaded. This happened immediately after creating a new highlight.

## Solution Implemented

### 1. Modified `clearHighlights()` (Lines 604-631)

**Before**: Simply removed all annotation cards
**After**: 
- Stores IDs of active annotation cards before clearing
- Saves them to `window.phrazeActiveAnnotationCardIds` for later restoration
- Still removes all cards, but preserves the information about which ones were active

```javascript
// Store active annotation card IDs before clearing
const activeCardIds = [];
const annotationCards = document.querySelectorAll('.phraze-unified-annotation-card.active');
annotationCards.forEach(card => {
  const highlightId = card.dataset.highlightId;
  if (highlightId) {
    activeCardIds.push(highlightId);
  }
});

// Store the active IDs globally so loadHighlights can access them
window.phrazeActiveAnnotationCardIds = activeCardIds;
```

### 2. Modified `saveHighlight()` (Lines 566-603)

**Before**: Called `loadHighlights()` without parameters
**After**: Passes the newly created highlight ID to `loadHighlights()`

```javascript
// Pass the newly created highlight ID so it can be shown immediately
loadHighlights(false, globalHighlightID);
```

### 3. Modified `loadHighlights()` (Lines 2063-2073 and 2245-2295)

**Before**: 
- Function signature: `loadHighlights(showAllLabelsAndCodes = false)`
- Did not restore active state of annotation cards

**After**: 
- Function signature: `loadHighlights(showAllLabelsAndCodes = false, newHighlightId = null)`
- Retrieves previously active card IDs
- Adds newly created highlight ID to the active list
- After creating each annotation card, checks if it should be active
- If active, immediately applies active styling and positions the card

```javascript
// Get previously active card IDs from window
const previouslyActiveCardIds = window.phrazeActiveAnnotationCardIds || [];

// Add the newly created highlight ID to the active list
if (newHighlightId) {
  previouslyActiveCardIds.push(newHighlightId);
}

// Later, when creating annotation cards...
const shouldBeActive = previouslyActiveCardIds.includes(highlight.id);

if (shouldBeActive) {
  annotationCard.classList.add('active');
  annotationCard.style.opacity = 1;
  annotationCard.style.pointerEvents = "auto";
  // Position the card
  requestAnimationFrame(() => {
    updateFloaterPosition(annotationCard, containerSpan);
  });
}
```

## Expected Behavior After Fix

1. ✅ Annotation card appears **immediately** after highlighting text (no click required)
2. ✅ Card remains visible even when `loadHighlights()` executes
3. ✅ Previously active annotation cards are restored after `loadHighlights()` runs
4. ✅ Card only closes when user clicks the X/close button

## Testing Instructions

1. Open the Demonstration page
2. Select some text
3. Click the yellow highlight button
4. **Verify**: Annotation card should appear immediately without requiring an additional click
5. Add a label or code (which triggers `loadHighlights()`)
6. **Verify**: Annotation card should remain visible
7. Click the X button on the card
8. **Verify**: Card should close

## Files Modified

- `/Users/hetpatel/Desktop/phraze-main 2/src/utils/highlighting.js`
  - `clearHighlights()` function
  - `saveHighlight()` function  
  - `loadHighlights()` function

## Backward Compatibility

✅ All existing calls to `loadHighlights()` continue to work with default parameters
✅ The function preserves active cards even when called without the new parameter
✅ No breaking changes to the API

