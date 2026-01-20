# Annotation Card Scroll Position Fix

## Problem

The unified annotation card (`.phraze-unified-annotation-card`) was not staying attached to its highlighted text when the user scrolled the page. Although it had `position: absolute` and the `updateFloaterPosition()` function existed, there was no mechanism to update the position during scroll events.

## Root Cause

The `updateFloaterPosition()` function was only being called:
1. On `mouseenter` of the highlight (line 2275)
2. When initially activating the card (line 2316)

There were **no scroll event listeners** to continuously update the card position as the page scrolled.

## Solution Implemented

### 1. Added Scroll Event Listener (Lines 2299-2315)

Added a scroll event listener that updates the card position whenever the page scrolls:

```javascript
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
```

**Key Features:**
- ✅ Uses `requestAnimationFrame` for smooth, optimized updates
- ✅ Only updates when card is active (has `.active` class)
- ✅ Uses capture phase (`true`) to catch all scroll events
- ✅ Stores cleanup function for proper memory management

### 2. Added Cleanup on Card Removal (Lines 642-649)

Modified `clearHighlights()` to properly remove scroll listeners before removing cards:

```javascript
const allAnnotationCards = document.querySelectorAll('.phraze-unified-annotation-card');
allAnnotationCards.forEach(card => {
  // Cleanup scroll listener before removing
  if (card._scrollCleanup) {
    card._scrollCleanup();
  }
  card.remove();
});
```

### 3. Added Position Updates on User Interactions

Updated position immediately when card becomes active through user interactions:

**On Click** (Lines 2284-2291):
```javascript
containerSpan.addEventListener('click', () => {
  annotationCard.classList.add('active');
  annotationCard.style.opacity = 1;
  annotationCard.style.pointerEvents = "auto";
  // Update position immediately when activated
  requestAnimationFrame(() => {
    updateFloaterPosition(annotationCard, containerSpan);
  });
});
```

**On Hover** (Lines 2295-2303):
```javascript
annotationCard.addEventListener('mouseenter', () => {
  annotationCard.classList.add('active');
  annotationCard.style.opacity = 1;
  annotationCard.style.pointerEvents = "auto";
  // Update position immediately when hovering
  requestAnimationFrame(() => {
    updateFloaterPosition(annotationCard, containerSpan);
  });
});
```

## How It Works

1. **Card Created**: When a highlight is loaded, an annotation card is created and a scroll listener is attached
2. **User Scrolls**: The scroll event fires → checks if card is active → if yes, updates position using `updateFloaterPosition()`
3. **Card Closed**: When user clicks X, card loses `.active` class → scroll handler stops updating (but listener remains for if card is reactivated)
4. **Cards Cleared**: When `clearHighlights()` is called, all scroll listeners are properly removed before cards are deleted

## Performance Optimizations

✅ **`requestAnimationFrame`**: Ensures position updates are synchronized with browser repaints (60fps)
✅ **Active Check**: Only updates position when card is visible (`.active` class)
✅ **Event Capture**: Uses capture phase to catch scroll events from all scrollable elements
✅ **Proper Cleanup**: Removes event listeners when cards are destroyed to prevent memory leaks

## Expected Behavior After Fix

1. ✅ Highlight text → annotation popup opens
2. ✅ Unified card appears near the highlight
3. ✅ **Scroll the page → card stays attached to highlight** (FIXED)
4. ✅ Card follows the highlight smoothly without jitter
5. ✅ Close the card → scroll listener stops updating
6. ✅ Multiple cards can be open and all track properly

## Testing Instructions

1. Open the Demonstration page
2. Highlight some text (annotation popup opens)
3. Close the annotation popup (unified card should be visible)
4. **Scroll the page up and down**
5. **Verify**: The unified card should stay positioned near its highlight
6. Click on another highlight to activate another card
7. **Scroll again**
8. **Verify**: All active cards should track their highlights
9. Close a card with the X button
10. **Verify**: Card hides properly and stops tracking

## Files Modified

- `/Users/hetpatel/Desktop/phraze-main 2/src/utils/highlighting.js`
  - Added scroll listener creation (lines 2299-2315)
  - Added cleanup in `clearHighlights()` (lines 643-647)
  - Added position update on click (lines 2288-2291)
  - Added position update on hover (lines 2299-2302)

## Backward Compatibility

✅ No breaking changes
✅ All existing functionality preserved
✅ Scroll listeners are properly cleaned up
✅ Performance is optimized with RAF and active checks

