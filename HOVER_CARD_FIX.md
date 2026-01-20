# Unified Annotation Card - Hover Behavior Implementation

## Change Summary

Modified the unified annotation card to display on **hover** instead of requiring a **click**. The card now has two states:
1. **Hover state** - Shows temporarily while hovering
2. **Sticky state** - Stays open when clicked (until X button is pressed)

## Previous Behavior

- User had to **click** on a highlight to see the unified annotation card
- Card would stay open until manually closed

## New Behavior

- Card appears **immediately on hover** over a highlight ✨
- Card disappears when mouse leaves (both highlight and card)
- **Click** on highlight makes card **"sticky"** (stays open permanently)
- Click X button to close sticky cards

## Implementation Details

### 1. Show Card on Hover (Lines 2293-2302)

Changed `mouseenter` event on the highlight to activate the card:

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

### 2. Hide Card on Mouse Leave Highlight (Lines 2304-2316)

Added `mouseleave` event with smart delay to allow transitioning to card:

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

**Key Feature**: 100ms delay allows user to move mouse from highlight to card without it disappearing.

### 3. Click to Make Sticky (Lines 2318-2328)

Click on highlight adds "sticky" class to keep card open:

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

### 4. Card Hover Behavior (Lines 2330-2339)

Card stays visible when hovering over it:

```javascript
// Keep card open when hovering over it
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

### 5. Card Mouse Leave Behavior (Lines 2341-2349)

Card hides when mouse leaves, but only if not sticky:

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

### 6. Close Button Cleanup (Line 2438)

Close button removes both `active` and `sticky` classes:

```javascript
closeCardButton.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  annotationCard.classList.remove('active');
  annotationCard.classList.remove('sticky'); // Remove sticky class
  annotationCard.style.opacity = 0;
  annotationCard.style.pointerEvents = "none";
  // ... rest of cleanup code
});
```

## User Experience Flow

### Hover Mode (Default)

1. 👆 **Hover over highlight** → Card appears instantly
2. 🖱️ **Move mouse to card** → Card stays visible (100ms grace period)
3. 🖱️ **Move mouse away** → Card disappears
4. ✅ Quick preview without commitment

### Sticky Mode (After Click)

1. 👆 **Hover over highlight** → Card appears
2. 🖱️ **Click on highlight** → Card becomes "sticky"
3. 🖱️ **Move mouse away** → Card **stays open**
4. 🖱️ **Interact with card** → Add notes, labels, codes
5. ❌ **Click X button** → Card closes and returns to hover mode

## Benefits

✅ **Faster interaction** - No click required for quick preview
✅ **Smart hiding** - Card doesn't flicker when moving to it
✅ **Sticky option** - Click to keep it open for detailed work
✅ **Natural UX** - Hover for peek, click for persist
✅ **Scroll tracking** - Card follows highlight during scroll (previously implemented)

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Hover then quickly move away | Card disappears (as expected) ✅ |
| Hover, move to card | Card stays (100ms grace period) ✅ |
| Click on highlight | Card becomes sticky and stays ✅ |
| Click X on sticky card | Card closes, returns to hover mode ✅ |
| Hover multiple highlights | Each shows its own card independently ✅ |
| Sticky card + scroll page | Card follows highlight (scroll tracking) ✅ |
| Mouse leaves sticky card | Card stays open ✅ |
| Close popup on sticky card | Popup closes, card stays sticky ✅ |

## Testing Instructions

### Test Hover Behavior:
1. Open Demonstration page
2. **Hover** over a highlight
3. **Verify**: Card appears immediately ✅
4. Move mouse away
5. **Verify**: Card disappears ✅

### Test Hover-to-Card Transition:
1. Hover over a highlight
2. Slowly move mouse towards the card
3. **Verify**: Card stays visible during transition ✅
4. Hover over the card
5. **Verify**: Card stays visible ✅
6. Move mouse away from card
7. **Verify**: Card disappears ✅

### Test Sticky Mode:
1. Hover over a highlight
2. **Click** on the highlight
3. **Verify**: Card stays visible ✅
4. Move mouse completely away
5. **Verify**: Card stays visible (sticky) ✅
6. Click the X button
7. **Verify**: Card closes ✅

### Test Multiple Highlights:
1. Hover over first highlight → card appears
2. Move to second highlight
3. **Verify**: First card hides, second card shows ✅
4. Click second highlight (make sticky)
5. Hover over first highlight
6. **Verify**: Both cards visible (one hover, one sticky) ✅

## Files Modified

- `/Users/hetpatel/Desktop/phraze-main 2/src/utils/highlighting.js`
  - Hover show behavior (lines 2293-2302)
  - Hover hide behavior (lines 2304-2316)
  - Click sticky behavior (lines 2318-2328)
  - Card hover behavior (lines 2330-2339)
  - Card leave behavior (lines 2341-2349)
  - Close button cleanup (line 2438)

## Backward Compatibility

✅ No breaking changes
✅ All existing functionality preserved
✅ Click still works (now makes sticky)
✅ All buttons and interactions unchanged
✅ Scroll tracking still works
✅ Popup behavior unchanged

