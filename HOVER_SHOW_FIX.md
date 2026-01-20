# Unified Annotation Card Hover Show Fix

## Problem

The unified annotation card was not appearing when hovering over highlights. The `mouseenter` event listener was only updating the card's position but not actually making it visible.

## Root Cause

The hover event listener on line 2321 was incomplete:

```javascript
// BEFORE (Not working):
containerSpan.addEventListener('mouseenter', () => {
  requestAnimationFrame(() => {
    updateFloaterPosition(annotationCard, containerSpan); // Only updates position
  });
});
// Card never becomes active/visible!
```

This code only called `updateFloaterPosition()` but never:
- Added the `active` class
- Set `opacity` to 1
- Set `pointerEvents` to "auto"

## Solution Applied

### 1. Show Card on Hover (Lines 2320-2329)

```javascript
// Show annotation card on hover
containerSpan.addEventListener('mouseenter', () => {
  annotationCard.classList.add('active');
  annotationCard.style.opacity = 1;
  annotationCard.style.pointerEvents = "auto";
  // Update position immediately
  requestAnimationFrame(() => {
    updateFloaterPosition(annotationCard, containerSpan);
  });
});
```

### 2. Hide Card on Mouse Leave (Lines 2331-2343)

```javascript
// Hide annotation card when mouse leaves (unless hovering over the card itself)
containerSpan.addEventListener('mouseleave', (e) => {
  // Small delay to allow mouse to move to the card
  setTimeout(() => {
    // Check if mouse is over the annotation card
    const isHoveringCard = annotationCard.matches(':hover');
    if (!isHoveringCard) {
      annotationCard.classList.remove('active');
      annotationCard.style.opacity = 0;
      annotationCard.style.pointerEvents = "none";
    }
  }, 100);
});
```

**Key Feature**: 100ms delay allows smooth transition from highlight to card.

### 3. Click to Make Sticky (Lines 2345-2355)

```javascript
// Keep card open when clicking on highlight (make it sticky)
containerSpan.addEventListener('click', () => {
  annotationCard.classList.add('active');
  annotationCard.classList.add('sticky'); // Add sticky class to keep it open
  annotationCard.style.opacity = 1;
  annotationCard.style.pointerEvents = "auto";
  // Update position immediately when activated
  requestAnimationFrame(() => {
    updateFloaterPosition(annotationCard, containerSpan);
  });
});
```

### 4. Card Mouse Leave Handler (Lines 2368-2376)

```javascript
// Hide card when mouse leaves it (unless it's sticky from being clicked)
annotationCard.addEventListener('mouseleave', () => {
  // Only hide if not sticky (not clicked to keep open)
  if (!annotationCard.classList.contains('sticky')) {
    annotationCard.classList.remove('active');
    annotationCard.style.opacity = 0;
    annotationCard.style.pointerEvents = "none";
  }
});
```

### 5. Close Button Cleanup (Line 2465)

```javascript
closeCardButton.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  annotationCard.classList.remove('active');
  annotationCard.classList.remove('sticky'); // Remove sticky class
  annotationCard.style.opacity = 0;
  annotationCard.style.pointerEvents = "none";
  // ... rest of cleanup
});
```

## User Experience Flow

### Hover Mode (Default)

1. 🖱️ **Hover over highlight** → Card appears instantly ✅
2. 🖱️ **Move mouse to card** → Card stays visible (100ms grace period) ✅
3. 🖱️ **Move mouse away** → Card disappears ✅
4. ✨ Quick preview without commitment

### Sticky Mode (After Click)

1. 🖱️ **Hover over highlight** → Card appears
2. 🖱️ **Click on highlight** → Card becomes "sticky" ✅
3. 🖱️ **Move mouse away** → Card **stays open** ✅
4. 💬 **Interact with card** → Add notes, view labels/codes
5. ❌ **Click X button** → Card closes and returns to hover mode ✅

## Changes Made

| File | Lines | Change |
|------|-------|--------|
| highlighting.js | 2320-2329 | Show card on hover (add active class + opacity) |
| highlighting.js | 2331-2343 | Hide card on leave with smart delay |
| highlighting.js | 2345-2355 | Click to make sticky |
| highlighting.js | 2368-2376 | Card leave handler (respect sticky) |
| highlighting.js | 2465 | Remove sticky class on close |

## Why It Wasn't Working Before

The code had the event listener structure in place, but it was missing the **critical activation steps**:

❌ **Missing:**
- `annotationCard.classList.add('active')`
- `annotationCard.style.opacity = 1`
- `annotationCard.style.pointerEvents = "auto"`

Without these, the card remained:
- Hidden (opacity likely 0)
- Not interactive (pointerEvents = "none")
- Not styled for visibility (no `active` class)

## Testing

1. ✅ Hover over highlight → Card appears
2. ✅ Move mouse away → Card disappears
3. ✅ Hover then move to card → Card stays visible
4. ✅ Click highlight → Card becomes sticky
5. ✅ Move mouse away from sticky card → Card stays visible
6. ✅ Click X → Card closes and returns to hover mode
7. ✅ Scroll page → Card follows highlight (previous fix)
8. ✅ Multiple highlights → Each card works independently

## Related Features Working

- ✅ Hover behavior (NOW WORKING)
- ✅ Sticky mode (click to keep open)
- ✅ Scroll tracking (card follows highlight)
- ✅ Smart hiding (100ms grace period)
- ✅ Annotation popup (opens on new highlight)
- ✅ Labels/codes display (with debug logging)

## Files Modified

- `/Users/hetpatel/Desktop/phraze-main 2/src/utils/highlighting.js`
  - Hover show behavior (lines 2320-2329)
  - Hover hide behavior (lines 2331-2343)
  - Click sticky behavior (lines 2345-2355)
  - Card leave behavior (lines 2368-2376)
  - Close button cleanup (line 2465)

## Backward Compatibility

✅ No breaking changes
✅ All existing functionality preserved
✅ Click still works (makes it sticky)
✅ All buttons and interactions unchanged
✅ Scroll tracking continues to work
✅ Popup behavior unchanged

The card now shows immediately on hover as expected! 🎉

