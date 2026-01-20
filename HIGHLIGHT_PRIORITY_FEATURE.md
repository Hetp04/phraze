# Highlight Priority Feature

## Overview

The Highlight Priority feature allows users to categorize and organize their highlights by importance level. When selecting text to highlight, users can quickly assign a priority level (High, Medium, or Low) directly from the selection toolbar before creating the highlight.

## Feature Description

### Priority Levels

The feature supports three priority levels:

- **High Priority** (H) - Red badge (#EF5350)
  - For urgent, critical, or highly important content
  - Use when the highlighted text requires immediate attention
  
- **Medium Priority** (M) - Orange badge (#FFA726)
  - For moderately important content
  - Use when the highlighted text is important but not urgent
  
- **Low Priority** (L) - Green badge (#66BB6A)
  - For reference material or less urgent content
  - Use when the highlighted text is informational but doesn't require immediate action

### User Interface

#### Selection Toolbar

When a user selects text on a page, a floating toolbar appears with the following options:

1. **Color Picker** - Circular swatch to choose highlight color
2. **Priority Buttons** - Three compact buttons labeled H, M, L
3. **Pen Icon** - Creates the highlight with selected color and priority

The priority buttons appear between the color picker and the pen icon. Each button displays:
- A single letter (H, M, or L)
- Color-coded text matching the priority level
- Visual feedback when selected (highlighted background and colored border)

#### Priority Selection Behavior

- **Click to Select**: Clicking a priority button selects that priority level
- **Click to Deselect**: Clicking the same button again removes the priority
- **Single Selection**: Only one priority level can be active at a time
- **Visual Feedback**: Selected priority shows a tinted background (20% opacity) and colored border
- **Persistent Selection**: The last selected priority is remembered in localStorage for quick reuse

#### Unified Annotation Card

Once a highlight is created with a priority, the unified annotation card displays:
- A **priority badge** next to the user's profile picture
- The badge shows the priority letter (H, M, or L) in the appropriate color
- Badge styling matches the toolbar button colors for consistency

## Technical Implementation

### Data Storage

#### LocalStorage (Device-Specific)
- `phrazeLastPriority`: Stores the last selected priority level for quick reuse
  - Values: `'high'`, `'medium'`, `'low'`, or `''` (empty string if no priority)
- `phrazePendingPriority`: Temporary storage for priority during highlight creation
  - Set when pen icon is clicked, cleared after highlight is saved

#### Firebase (Cross-Device Persistent)

Priority is stored as part of the highlight object in Firebase:

**Path**: `Companies/{companyEmail}/projects/{projectName}/highlights`

**Highlight Object Structure**:
```javascript
{
  id: timestamp,
  userEmail: string,
  companyEmail: string,
  textNodes: array,
  url: string,
  chatID: string,
  color: string,        // Hex color code
  colorName: string,    // Semantic color name
  priority: string      // 'high', 'medium', 'low', or undefined
}
```

### Key Functions

#### `saveHighlight(chatID)`
- Reads `phrazePendingPriority` from localStorage
- Adds `priority` field to highlight object if set
- Saves complete highlight object to Firebase
- Clears `phrazePendingPriority` after saving

#### Priority Selection in Toolbar
- Created dynamically in `handleSelectionChange` (Demonstration.jsx)
- Three buttons with toggle behavior
- Updates `phrazeLastPriority` in localStorage for persistence
- Sets `phrazePendingPriority` when highlight is created

#### Priority Display in Annotation Card
- Checks `highlight.priority` property
- Renders priority badge if priority exists
- Styled with matching colors to toolbar buttons

## User Workflow

### Creating a Highlight with Priority

1. **Select Text**: User highlights text on the page
2. **Selection Toolbar Appears**: Toolbar shows color picker, priority buttons, and pen icon
3. **Choose Priority** (optional):
   - Click H, M, or L button to set priority
   - Button highlights to show selection
   - Can click again to deselect
4. **Choose Color** (optional):
   - Click color swatch to open palette
   - Select desired highlight color
5. **Create Highlight**: Click pen icon
   - Highlight is created with selected color and priority
   - Priority is saved to Firebase
   - Annotation popup appears for additional annotations

### Viewing Priority

1. **Hover over Highlight**: Unified annotation card appears
2. **See Priority Badge**: Badge displays next to user profile
   - Shows H, M, or L in appropriate color
   - Tooltip shows full priority name on hover

### Changing Priority

Currently, priority can only be set during highlight creation. To change priority:
1. Delete the existing highlight (if needed)
2. Recreate the highlight with the desired priority

*Future enhancement: Add priority editing in the annotation card*

## Visual Design

### Priority Colors

- **High**: Red (#EF5350) - Associated with urgency and importance
- **Medium**: Orange (#FFA726) - Balanced importance level
- **Low**: Green (#66BB6A) - Calm, informational tone

### Button Styling

- **Default State**: White background, gray border, colored text
- **Selected State**: Tinted background (color at 20% opacity), colored border matching text color
- **Size**: 24px × 24px for consistency with color picker
- **Font**: 11px, bold (600 weight) for clear visibility

### Badge Styling

- **Size**: 20px × 20px (slightly smaller than toolbar buttons)
- **Shape**: Rounded rectangle (4px border radius)
- **Styling**: Matches selected button appearance
- **Position**: Inline with profile section in card header

## Cross-Device Synchronization

Priority is fully synchronized across devices:

1. **On Creation**: Priority is saved to Firebase immediately
2. **On Load**: Highlights load with their priority from Firebase
3. **Display**: Priority badge appears on all devices viewing the highlight
4. **User Preference**: Last selected priority is device-specific (localStorage) but priority on highlights is universal

## Use Cases

### 1. Research and Note-Taking
- **High**: Key findings, critical insights
- **Medium**: Important supporting information
- **Low**: Background context, reference material

### 2. Project Management
- **High**: Action items, deadlines, blockers
- **Medium**: Nice-to-have improvements
- **Low**: Future considerations, ideas

### 3. Content Review
- **High**: Critical errors, major changes needed
- **Medium**: Suggested improvements
- **Low**: Minor suggestions, style notes

### 4. Collaborative Analysis
- **High**: Issues requiring immediate team discussion
- **Medium**: Points for follow-up meeting
- **Low**: Personal notes, references

## Future Enhancements

Potential improvements for the priority feature:

1. **Priority Filtering**: Filter highlights by priority level in search/overview
2. **Priority Sorting**: Sort highlights by priority in annotation lists
3. **Priority Editing**: Change priority after highlight creation via annotation card
4. **Priority Statistics**: View distribution of priorities across highlights
5. **Custom Priority Levels**: Allow users to define custom priority levels
6. **Priority-Based Notifications**: Remind users about high-priority highlights
7. **Bulk Priority Assignment**: Change priority for multiple highlights at once
8. **Priority Search**: Search/filter by priority in advanced search
9. **Priority Badge on Highlight**: Visual indicator on the highlighted text itself
10. **Priority Export**: Include priority in exported annotation reports

## Accessibility

### Keyboard Navigation
- Priority buttons support keyboard focus
- Tab navigation moves through priority buttons
- Enter/Space toggles priority selection

### Screen Reader Support
- `aria-label` attributes on all priority buttons: "Set {Priority Level} Priority"
- Priority badge includes title attribute with full description
- Priority level is announced when selected

### Visual Indicators
- Color coding provides visual distinction (with text labels as backup)
- High contrast between button colors and backgrounds
- Clear visual feedback on selection state

## Troubleshooting

### Priority Not Saving
- Check browser console for Firebase errors
- Verify user is logged in and has write permissions
- Ensure `phrazePendingPriority` is set before clicking pen icon

### Priority Not Displaying
- Verify highlight object includes `priority` field in Firebase
- Check that priority value is one of: 'high', 'medium', 'low'
- Clear browser cache and reload page

### Priority Not Persisting Across Devices
- Verify Firebase connection is active
- Check that same company email and project are used on both devices
- Ensure highlights are loading from Firebase (not localStorage fallback)

## Related Features

- **Highlight Colors**: Similar selection mechanism in toolbar
- **Labels & Codes**: Additional categorization options in annotation popup
- **Unified Annotation Card**: Display location for priority badge

## Files Modified

- `src/pages/Demonstration.jsx`: Priority button UI in selection toolbar
- `src/utils/highlighting.js`: 
  - Priority saving in `saveHighlight()`
  - Priority display in `createUnifiedAnnotationCard()`
  - Priority persistence and Firebase integration

