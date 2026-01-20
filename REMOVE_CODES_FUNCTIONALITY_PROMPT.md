# Detailed Prompt: Remove All Codes Functionality

## Overview
Remove all codes-related functionality from the codebase. The application should only use labels, not codes. This includes removing codes from:
- Annotation popup
- Unified annotation card (hover card)
- Advanced search overlay filters
- Chat input commands (@code)
- All related state, functions, and UI components

## Files to Modify

### 1. `/src/utils/highlighting.js`

#### Remove from `createUnifiedAnnotationCard` function:
- **Location**: Around line 2780-2979
- **Remove**:
  - Codes section creation (lines creating `codesSection`, `codesContainer`)
  - `codePills` array initialization and population
  - All code-related annotation parsing (checking for `type.toLowerCase() == "code"`)
  - Code pills rendering loop (creating code pill elements with delete arrows)
  - Code header creation (`if (codePills.length > 0)`)
  - `cardHeader.appendChild(codesSection)` line
- **Keep**: Only labels section and labels pills

#### Remove from `updateAnnotationCard` function:
- **Location**: Around line 4260-4456
- **Remove**:
  - `codesContainer` querySelector and related code
  - `codePills` array
  - Code-related annotation parsing
  - Code pills rendering
  - Code empty state check
- **Keep**: Only labels container and labels pills

#### Remove from annotation popup creation:
- **Location**: Around line 1636-1721
- **Remove**: Entire codes section creation block including:
  - `popupCodesSection` element creation
  - `codesHeader`, `codesToggleBtn`, `codesDropdown` elements
  - `codeMap` object with code categories
  - Code dropdown population logic
  - "Create Custom Code" option
  - `selectedCodesContainer` creation
  - `loadCustomCodesIntoDropdown` call
  - All code dropdown event listeners
  - The commented line `// annotationPopup.appendChild(popupCodesSection);`
- **Note**: The `selectedCodesContainer` variable should remain as `null` (already initialized)

### 2. `/src/components/AdvancedSearchOverlay.jsx`

#### Remove constants:
- **Location**: Around line 923-948
- **Remove**: Entire `CODE_GROUPS` constant object

#### Remove state variables:
- **Location**: Around line 988-996
- **Remove**:
  - `isCodeDropdownOpen`
  - `selectedCodes`
  - `customCodes`
  - `chatIdToCodes`
- **Update**: Change `contentTypeFilter` comment from `'all', 'code', 'labels', 'notes'` to `'all', 'labels', 'notes'`

#### Remove functions:
- **Location**: Around line 72-94
- **Remove**: Entire `checkHighlightMatchesCodes` function

- **Location**: Around line 1895-1904
- **Remove**: `toggleCodeDropdown` and `handleCodeSelect` functions

#### Update functions:
- **Location**: Around line 97-154
- **Update `checkHighlightMatchesFilters`**:
  - Remove `selectedCodes` parameter
  - Remove all code-related logic
  - Only check labels matching

- **Location**: Around line 191-250
- **Update `applySpotlightToMatchingHighlights`**:
  - Remove `selectedCodes` parameter
  - Remove `hasCodes` check
  - Only use `selectedLabels`

- **Location**: Around line 1039-1157
- **Update `chatMatchesFilters`**:
  - Remove `selectedCodes` parameter
  - Remove all code matching logic
  - Only check label matching

- **Location**: Around line 433
- **Update `MessageContentWithHighlights` component**:
  - Remove `selectedCodes` prop and parameter
  - Remove code-related logic from the component

#### Remove UI elements:
- **Location**: Around line 2316-2321
- **Remove**: `{ value: 'code', label: 'Code', ... }` from filter buttons array

- **Location**: Around line 2328-2391
- **Remove**: Code button rendering and all code-related button logic

- **Location**: Around line 2538-2680
- **Remove**: Entire codes dropdown JSX block (`{option.value === 'code' && isCodeDropdownOpen && ...}`)

- **Location**: Around line 2529-2730
- **Remove**: All `visibleCodes` references from breadcrumb filter bar
- **Remove**: Code segments rendering
- **Update**: Only show labels in the filter bar

#### Update useEffect hooks:
- **Location**: Around line 999-1006
- **Update**: Remove `setSelectedCodes([])` and `setIsCodeDropdownOpen(false)`

- **Location**: Around line 2019-2131
- **Update**: Remove all code-related mapping logic from the Firebase listener
  - Remove `highlightIdToCodes` object
  - Remove `nextChatToCodes` object
  - Remove `finalizedCodes` object
  - Remove `setChatIdToCodes` call
  - Only keep labels mapping

- **Location**: Around line 2157-2187
- **Remove**: Entire `useEffect` hook for custom codes updates

- **Location**: Around line 2189-2219
- **Update**: Remove code dropdown close logic, only keep label dropdown

#### Update useMemo hooks:
- **Location**: Around line 1160-1189
- **Update `filteredChats`**: Remove `selectedCodes` from dependencies and filter logic

- **Location**: Around line 1192-1233
- **Remove**: Entire `visibleCodes` useMemo hook

#### Update other references:
- **Location**: Throughout the file
- **Remove**: All references to `selectedCodes`, `visibleCodes`, `handleCodeSelect`, `CODE_GROUPS`
- **Update**: All function calls that pass `selectedCodes` to remove that parameter

### 3. `/src/pages/Demonstration.jsx`

#### Remove constants:
- **Location**: Around line 165-171
- **Remove**: Entire `CODE_GROUPS` constant object

#### Remove from AVAILABLE_COMMANDS:
- **Location**: Around line 150-155
- **Remove**: `{ command: 'code', description: 'Add a code to your message (e.g., @code: Question)', icon: 'fas fa-code' }`

#### Remove state variables:
- **Location**: Around line 194-203
- **Remove**:
  - `codeState` useState hook
  - `codePopupRef` useRef
  - `customCodes` useState

#### Remove functions:
- **Location**: Around line 233-256
- **Remove**: Entire `processCustomCodesData` function

- **Location**: Around line 490-450
- **Remove**: Entire `getFilteredCodes` function

- **Location**: Around line 889-839
- **Remove**: Entire `insertCode` function

- **Location**: Around line 1007-1071
- **Remove**: Entire `handleCodeKeyDown` function

#### Update functions:
- **Location**: Around line 258-352
- **Update `setupCustomLabelsListener` useEffect**:
  - Remove all `processCustomCodesData` calls
  - Remove all `CODE_GROUPS` references
  - Remove all `setCustomCodes` calls
  - Remove all `setCodeState` calls
  - Only process labels data

- **Location**: Around line 327-338
- **Update `handleCustomLabelsUpdate`**:
  - Remove `processCustomCodesData` call
  - Update console.log message to remove "Code" reference

- **Location**: Around line 598-651
- **Update `handleInputChange`**:
  - Remove entire `@code` detection block (codeMatch logic)
  - Remove code popup state updates
  - Remove code popup closing logic
  - Only keep `@label` and `@mention` detection

- **Location**: Around line 842-936
- **Update `insertCommand`**:
  - Remove entire `else if (command === 'code')` block

#### Remove UI elements:
- **Location**: Around line 1409-1615
- **Remove**: Entire code popup JSX block (`{codeState.isOpen && ...}`)
  - This includes the entire popup div with all code rendering logic
  - Code categories rendering
  - Custom codes rendering
  - Keyboard shortcuts hint

#### Update keyboard handlers:
- **Location**: Around line 2035-2063
- **Update `onKeyDown` handler**:
  - Remove code popup navigation block
  - Remove `codeState.isOpen` check from Enter key condition

- **Location**: Around line 2143
- **Update ghost text display**:
  - Remove `codeState.isOpen ? codeState.ghostText :` from ternary
  - Only show `labelState.isOpen ? labelState.ghostText : mentionState.ghostText`

### 4. `/src/App.css` (Optional Cleanup)

#### Remove CSS (optional - won't break anything if left):
- **Location**: Around line 1098-1207
- **Remove**: All `.codes-section`, `.codes-header`, `.codes-toggle-btn`, `.codes-dropdown`, `.selected-codes-container`, `.code-pill` styles
- **Note**: These can be left as they won't affect functionality if the elements don't exist

## Step-by-Step Removal Process

### Step 1: Remove from Annotation Popup
1. Open `src/utils/highlighting.js`
2. Find the annotation popup creation (around line 1636)
3. Remove the entire codes section block (lines 1636-1721)
4. Ensure `selectedCodesContainer` remains `null` (already initialized)

### Step 2: Remove from Unified Annotation Card
1. In `src/utils/highlighting.js`, find `createUnifiedAnnotationCard` function
2. Remove codes section creation (around line 2780-2786)
3. Remove `codePills` array initialization
4. Remove code parsing from annotations (both from map and highlight object)
5. Remove code pills rendering loop
6. Remove code header creation
7. Remove `cardHeader.appendChild(codesSection)`
8. In `updateAnnotationCard` function, remove all code-related code

### Step 3: Remove from Advanced Search Overlay
1. Open `src/components/AdvancedSearchOverlay.jsx`
2. Remove `CODE_GROUPS` constant
3. Remove code-related state variables
4. Remove `checkHighlightMatchesCodes` function
5. Remove `toggleCodeDropdown` and `handleCodeSelect` functions
6. Update `checkHighlightMatchesFilters` to only use labels
7. Update `applySpotlightToMatchingHighlights` to only use labels
8. Update `chatMatchesFilters` to only use labels
9. Remove "Codes" filter button from the array
10. Remove codes dropdown JSX
11. Remove `visibleCodes` useMemo
12. Update all useEffect hooks to remove code logic
13. Remove all `selectedCodes` references

### Step 4: Remove from Chat Input
1. Open `src/pages/Demonstration.jsx`
2. Remove `CODE_GROUPS` constant
3. Remove `@code` from `AVAILABLE_COMMANDS`
4. Remove `codeState`, `codePopupRef`, `customCodes` state
5. Remove `processCustomCodesData` function
6. Remove `getFilteredCodes` function
7. Remove `insertCode` function
8. Remove `handleCodeKeyDown` function
9. Update `setupCustomLabelsListener` to remove all code processing
10. Update `handleInputChange` to remove `@code` detection
11. Update `insertCommand` to remove `@code` handling
12. Remove code popup JSX
13. Update keyboard handlers to remove code navigation
14. Update ghost text display to remove code state

### Step 5: Verification
1. Search for any remaining references:
   ```bash
   grep -r "selectedCodes\|visibleCodes\|handleCodeSelect\|CODE_GROUPS\|codeState\|codePopupRef\|getFilteredCodes\|insertCode\|processCustomCodesData" src/
   ```
2. Check for any code-related UI elements in JSX
3. Verify no linter errors
4. Test the application to ensure:
   - Annotation popup only shows labels
   - Unified annotation card only shows labels
   - Advanced search only has labels filter
   - Chat input doesn't respond to `@code` command

## Important Notes

1. **Don't remove `selectedCodesContainer` variable declaration** - it's initialized as `null` and the code already handles null checks
2. **Don't remove code-related CSS** - it won't break anything, but you can clean it up if desired
3. **Be careful with function signatures** - when removing parameters, update all call sites
4. **Check for any code-related data in Firebase** - the code may still exist in the database, but the UI won't display it
5. **Test thoroughly** - especially the annotation popup, unified card, and search overlay

## Search Patterns to Find All References

Use these grep patterns to find all code-related code:
- `selectedCodes`
- `visibleCodes`
- `handleCodeSelect`
- `CODE_GROUPS`
- `codeState`
- `codePopupRef`
- `getFilteredCodes`
- `insertCode`
- `processCustomCodesData`
- `codes-section`
- `codes-container`
- `codePills`
- `@code`
- `type.toLowerCase() == "code"` or `type.toLowerCase() === "code"`

## Expected Result

After removal:
- ✅ Annotation popup only has labels dropdown
- ✅ Unified annotation card only shows labels pills
- ✅ Advanced search overlay only has labels filter
- ✅ Chat input only responds to `@label` command (not `@code`)
- ✅ No code-related state, functions, or UI components remain
- ✅ Application works with labels only
