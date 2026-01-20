# Feature Request: Enable Annotation Editing for Existing Highlights

## Overview
Currently, users can only add annotations (labels, codes, and notes) when a highlight is first created. This feature request enables users to edit annotations for existing highlights by clicking the plus icon on the unified annotation card.

## Current Behavior

### Unified Annotation Card
- A card that appears when hovering over or clicking on a highlight
- Displays existing labels, codes, and notes for that highlight
- Has a plus icon button that currently only works for newly created highlights
- Shows labels and codes in the format "Key: Value" (e.g., "Intent: Request")

### Annotation Popup
- A modal popup that appears when users want to add annotations
- Contains:
  - Labels section with dropdowns to select label types and values
  - Codes section with dropdowns to select code types and values
  - Rich text editor for notes
  - "Add Annotation" button to save annotations

### Current Limitations
1. The plus icon on the unified card only opens the popup for newly created highlights (`isFreshHighlight` flag)
2. Existing highlights cannot have their annotations edited
3. The popup doesn't pre-populate with existing annotations when opened for existing highlights
4. The unified card doesn't update instantly after saving annotations

## Desired Behavior

### 1. Enable Editing for All Highlights
- **Remove the `isFreshHighlight` restriction**: The plus icon should open the annotation popup for ANY highlight, not just newly created ones
- **Always show labels and codes sections**: The popup should always display the labels and codes sections, regardless of whether the highlight is new or existing

### 2. Pre-populate Popup with Existing Annotations
When the user clicks the plus icon on an existing highlight's unified card:
- **Load existing labels**: Show all existing labels as pills in the `selectedLabelsContainer`
- **Load existing codes**: Show all existing codes as pills in the `selectedCodesContainer`
- **Load existing notes**: Display all existing notes in the rich text editor (`richTextDiv`), separated by double line breaks to preserve formatting
- **Format**: Labels and codes should appear as pills with the format "Key: Value" (e.g., "Intent: Request")

### 3. Update Button Text
- Change the "Add Annotation" button text to "Update Annotations" to reflect that users can now add, modify, or remove annotations
- Update the popup header text from "Add Annotation" to "Update Annotations"

### 4. Handle Annotation Deletions
When a user removes a label or code pill from the popup and clicks "Update Annotations":
- **Delete removed annotations**: Any labels or codes that were removed from the popup should be deleted from Firebase
- **Update existing annotations**: If only some options are removed from a label/code type, update the options array instead of deleting the entire entry
- **Prevent duplicates**: Don't re-add annotations that already exist

### 5. Instant Unified Card Update
After the user clicks "Update Annotations":
- **Save annotations to Firebase**: Save all labels, codes, and notes to Firebase with the correct `highlightID`
- **Refresh annotations map**: Update `window.highlightsToAnnotationsMap` with the latest data from Firebase
- **Update unified card instantly**: The unified card should immediately reflect the updated annotations (new labels, codes, notes, and removed items)
- **Show quick preview**: The unified card should briefly appear (auto-hide after ~1 second) to give the user a quick glimpse of the update
- **No page refresh needed**: All updates should happen without requiring a page refresh

## Technical Requirements

### File to Modify
- `src/utils/highlighting.js`

### Key Functions to Modify

#### 1. `createUnifiedAnnotationCard(highlight, containerSpan)`
- **Location**: Around line 1100-1300
- **Changes needed**:
  - Remove the `isFreshHighlight` check that conditionally creates labels and codes sections
  - Always create labels and codes sections for all highlights
  - Ensure the plus icon (`addNoteButton`) opens the popup for all highlights

#### 2. Plus Icon Click Handler (`addNoteButton.addEventListener('click', ...)`)
- **Location**: Around line 2200-2250
- **Changes needed**:
  - Clear the `permanentlyClosed` flag to allow popup to reopen
  - Set `localStorage.setItem('globalHighlightID', highlight.id)` to ensure annotations are saved with correct ID
  - Call a function to load existing annotations into the popup (see below)
  - Show the popup and focus the rich text editor

#### 3. Create `loadExistingAnnotationsIntoPopup()` Function
- **New function to create**
- **Purpose**: Load existing annotations from the unified card into the popup
- **Implementation**:
  ```javascript
  async function loadExistingAnnotationsIntoPopup() {
    // Clear existing content
    selectedLabelsContainer.innerHTML = '';
    selectedCodesContainer.innerHTML = '';
    richTextDiv.innerHTML = '';
    
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
        else if (type.toLowerCase() === "code" && selectedCodesContainer) {
          options.forEach(option => {
            // Add as pill with format "Key: Value"
            addSelectedCode(option, key, selectedCodesContainer, false);
          });
        }
      }
    }
    
    // Load notes from highlight.notes array
    if (highlight.notes && Array.isArray(highlight.notes) && highlight.notes.length > 0) {
      const combinedNotes = highlight.notes.join('<br><br>');
      richTextDiv.innerHTML = combinedNotes;
    }
  }
  ```

#### 4. "Update Annotations" Button Click Handler (`addAnnotationButton.addEventListener('click', ...)`)
- **Location**: Around line 1500-2000
- **Changes needed**:
  - **Set highlight ID**: `localStorage.setItem('globalHighlightID', highlight.id)` before saving
  - **Get highlighted text**: Extract the highlighted text from the highlight object or DOM
  - **Handle deletions**: 
    - Get all existing annotations for this highlight from Firebase
    - Compare with what's in the popup (selectedLabels, selectedCodes)
    - Delete any annotations that were removed from the popup
    - Update options arrays if only some options were removed
  - **Save new annotations**: Use `addSelectedTextEntry()` to save new labels and codes
  - **Save notes**: Use `addNoteToStorage()` to save notes
  - **Refresh and update**: 
    - Call `refreshAnnotationsMap()` to update the global map
    - Call `updateAnnotationCard(highlight.id)` to update the unified card
    - Show the card briefly (auto-hide after 1 second)
  - **Remove direct DOM manipulation**: Don't directly add labels/codes/notes to the card - let `updateAnnotationCard()` handle it

#### 5. `updateAnnotationCard(highlightId)` Function
- **Location**: Around line 3300-3500
- **Changes needed**:
  - Make it `async` if it isn't already
  - Clear existing labels, codes, AND notes from the card
  - Read from `window.highlightsToAnnotationsMap` to get latest labels and codes
  - Format labels and codes as "Key: Value" (e.g., "Intent: Request")
  - Re-populate labels and codes containers
  - Load notes from `highlight.notes` array (reload from storage to get latest)
  - Re-populate notes list with delete buttons for each note

#### 6. `refreshAnnotationsMap()` Function
- **Location**: Around line 3500-3600
- **Changes needed**:
  - Ensure it properly awaits `refreshAnnotationData()`
  - Make sure `refreshAnnotationData()` awaits `updateAnnotationCard()` calls

### Data Flow

1. **User clicks plus icon** → Popup opens → `loadExistingAnnotationsIntoPopup()` loads existing data
2. **User modifies annotations** → Adds/removes labels, codes, or notes in popup
3. **User clicks "Update Annotations"** → 
   - Save annotations to Firebase
   - Delete removed annotations from Firebase
   - Refresh `window.highlightsToAnnotationsMap`
   - Update unified card with `updateAnnotationCard()`
   - Show card briefly (auto-hide after 1 second)

### Important Notes

1. **Don't modify state management**: Don't change how `window.highlightsToAnnotationsMap` is created or managed globally
2. **Don't modify core highlighting**: Don't change how highlights are created or stored
3. **Single source of truth**: Always read from Firebase/storage, not from DOM
4. **Format consistency**: Labels and codes should always display as "Key: Value" on the unified card
5. **No duplicates**: Check for existing annotations before adding new ones
6. **Instant updates**: The unified card should update immediately after saving, without page refresh
7. **Firebase rules**: The existing Firebase rules should be sufficient - no changes needed

### Testing Checklist

- [ ] Plus icon opens popup for existing highlights
- [ ] Popup pre-populates with existing labels, codes, and notes
- [ ] Labels and codes appear as pills in popup
- [ ] Notes appear in rich text editor
- [ ] "Update Annotations" button saves changes
- [ ] Removed labels/codes are deleted from Firebase
- [ ] Unified card updates instantly after saving
- [ ] Unified card shows updated annotations correctly
- [ ] Unified card auto-hides after 1 second
- [ ] No duplicates appear on unified card
- [ ] Format is "Key: Value" for labels and codes
- [ ] Notes are preserved with HTML formatting

## Implementation Priority

1. **High Priority**: Enable editing for all highlights, pre-populate popup, instant card update
2. **Medium Priority**: Handle deletions, update button text
3. **Low Priority**: Auto-hide preview, formatting improvements

## Edge Cases to Handle

1. **No existing annotations**: Popup should open empty
2. **All annotations removed**: Should delete all annotations from Firebase
3. **Partial removal**: Should update options array, not delete entire entry
4. **Network delays**: Should handle Firebase write delays gracefully
5. **Multiple rapid clicks**: Should prevent duplicate saves
6. **Card already visible**: Should update in place, not create duplicate cards

