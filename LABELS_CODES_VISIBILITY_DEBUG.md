# Labels and Codes Visibility on Unified Annotation Card - Debug

## Issue

User reports that labels and codes are not visible on the unified annotation card when hovering over highlights. They should be able to see previously added labels and codes immediately when hovering, not just after saving new annotations.

## Current Implementation

The unified annotation card IS already set up to display labels and codes from the annotation history. The code at **lines 1557-1605** in `createUnifiedAnnotationCard()`:

1. ✅ Gets annotations from `window.highlightsToAnnotationsMap`
2. ✅ Extracts labels and codes from annotations
3. ✅ Creates label pills and code pills
4. ✅ Appends them to the card

## Possible Root Causes

### 1. Annotations Not Being Loaded from Firebase
The annotation history may not be loading from Firebase properly, causing the map to be empty.

### 2. Highlight ID Mismatch
Annotations may be stored with different highlight IDs than what's on the current highlights, causing no matches.

###3. Timing Issue
The annotations map may not be populated yet when cards are created (though this seems unlikely given the async/await flow).

### 4. Data Format Issue
The annotation history data structure may not match what the code expects.

## Debug Logging Added

I've added comprehensive console logging to help diagnose the issue:

### Location 1: `getHighlightAnnotations()` (Lines 108-130)

```javascript
console.log(`🔍 Searching annotations for highlight ID: ${id} in history with ${annotationHistory.length} entries`);
// ... search logic ...
console.log(`✅ Found matching annotation for highlight ${id}:`, annotation); // When found
console.log(`❌ No annotations found for highlight ${id}`); // When not found
```

**What to check:**
- How many annotation history entries exist?
- Are any annotations found for specific highlight IDs?
- What do the annotation objects look like?

### Location 2: `loadHighlights()` (Lines 2230-2231)

```javascript
console.log('🗺️ Annotations map created with', Object.keys(highlightsToAnnotationsMap).length, 'highlights');
console.log('🗺️ Map contents:', highlightsToAnnotationsMap);
```

**What to check:**
- Is the map being created with the expected number of highlights?
- What highlight IDs are in the map?
- What does the map data structure look like?

### Location 3: `createUnifiedAnnotationCard()` (Lines 1564-1580)

```javascript
console.log(`📊 Found annotations for highlight ${highlight.id}:`, annotations);
console.log(`🏷️ Added labels:`, options); // For each label
console.log(`💻 Added codes:`, options); // For each code
console.log(`⚠️ No annotations found in map for highlight ${highlight.id}`); // When none found
console.log('📋 Current map keys:', Object.keys(window.highlightsToAnnotationsMap || {}));
```

**What to check:**
- Are annotations found for specific highlights when cards are created?
- Are labels and codes being extracted from annotations?
- Does the highlight ID match any keys in the map?

## How to Debug

### Step 1: Add a Highlight with Label/Code
1. Open the Demonstration page
2. Highlight some text
3. Add a label (e.g., "Sentiment: Positive")
4. Add a code (e.g., "Quality: High")
5. Save the annotation

### Step 2: Check Annotation Saving Logs
Look in the console for:
- Messages about saving to annotation history
- Highlight ID being used
- Labels and codes being saved

### Step 3: Reload the Page
After adding annotations, reload the page to trigger `loadHighlights()`.

### Step 4: Check Map Creation Logs
Look for:
```
🗺️ Annotations map created with X highlights
🗺️ Map contents: {...}
```

**Questions to answer:**
- How many highlights have annotations?
- Does your highlight ID appear in the map?
- What does the annotation data look like?

### Step 5: Hover Over the Highlight
Hover over the highlight you annotated.

Look for:
```
📊 Found annotations for highlight XXXXX
🏷️ Added labels: [...]
💻 Added codes: [...]
```

**OR:**
```
⚠️ No annotations found in map for highlight XXXXX
📋 Current map keys: [...]
```

**Questions to answer:**
- Is the highlight ID in the card creation matching the highlight ID in the map?
- Are labels and codes being found and added?

## Expected Log Flow (When Working Correctly)

```
1. On page load:
   🔍 Searching annotations for highlight ID: 1234567890 in history with 5 entries
   ✅ Found matching annotation for highlight 1234567890: [...]
   🗺️ Annotations map created with 3 highlights
   🗺️ Map contents: { "1234567890": [...], ... }

2. On hover (card creation):
   📊 Found annotations for highlight 1234567890: [...]
   🏷️ Added labels: ["Sentiment: Positive"]
   💻 Added codes: ["Quality: High"]
```

## Potential Fixes Based on Findings

### If: No annotations in history
**Problem:** Annotations aren't being saved to Firebase
**Fix:** Check annotation saving logic, Firebase permissions

### If: Highlight ID mismatch
**Problem:** Saved annotations have different IDs than loaded highlights
**Fix:** Ensure consistent ID generation and storage

### If: Map is empty but annotations exist
**Problem:** `getAnnotationHistory()` not loading properly
**Fix:** Check Firebase data structure, loading logic

### If: Map has data but cards don't show it
**Problem:** Card creation timing or map access issue
**Fix:** Ensure map is populated before cards are created

## Quick Test

Open the browser console and run:
```javascript
// Check if map exists and has data
console.log('Map exists:', !!window.highlightsToAnnotationsMap);
console.log('Map keys:', Object.keys(window.highlightsToAnnotationsMap || {}));
console.log('Map contents:', window.highlightsToAnnotationsMap);

// Manually call refresh
await window.refreshAnnotationsMap();
```

## Files Modified

- `/Users/hetpatel/Desktop/phraze-main 2/src/utils/highlighting.js`
  - Added logging in `getHighlightAnnotations()` (lines 108-130)
  - Added logging in `loadHighlights()` (lines 2230-2231)
  - Added logging in `createUnifiedAnnotationCard()` (lines 1564-1580)

## Next Steps

1. Test with the new logging
2. Share the console output
3. Based on the logs, we can pinpoint the exact issue and apply the appropriate fix

The code structure for displaying labels and codes IS correct - we just need to find out why the data isn't flowing through as expected!

