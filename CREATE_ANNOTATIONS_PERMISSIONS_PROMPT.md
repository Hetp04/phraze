# Cursor Prompt: Implement Create Annotations Permission-Based Functionality

## Context
The application has a permission system where project members (owners, editors, viewers) have granular permissions stored in Firebase. One of these permissions is `createAnnotations`, which should control whether users can create new annotations on highlights.

Currently, the annotation popup appears after highlighting regardless of permissions. We need to implement permission-based control so that:
1. When `createAnnotations` is `false`, the annotation popup should NOT appear after highlighting
2. When `createAnnotations` is `true`, the annotation popup should appear normally
3. The permission check should work in real-time (when permissions change in Firebase, the behavior should update without refresh)

## Current Permission System Structure

### Permission Constants
- File: `src/utils/permissionConstants.js`
- `DEFAULT_PERMISSIONS` object contains: `createHighlights`, `createAnnotations`, `modifyAnnotations`, `deleteAnnotations`, `deleteHighlights`
- All default to `true`

### Permission Storage
- Permissions are stored in Firebase at: `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}/permissions`
- Structure: `{ createAnnotations: true/false, modifyAnnotations: true/false, ... }`
- Owners bypass all permission checks (they have all permissions by default)
- Editors must have explicit permissions enabled
- Viewers cannot create annotations (already implemented)

### Window Variables
- `window.currentUserRole` - stores current user's role ('owner', 'editor', 'viewer')
- `window.currentUserPermissions` - should store the user's permissions object (needs to be set up in real-time)

## Implementation Requirements

### 1. Set Up Real-Time Permission Updates in Demonstration.jsx

**Location**: `src/pages/Demonstration.jsx`

**Task**: Add a Firebase listener that updates `window.currentUserPermissions` in real-time when member permissions change.

**Requirements**:
- Listen to the member's permission path: `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}/permissions`
- When permissions change, update `window.currentUserPermissions` with the new values
- Merge with `DEFAULT_PERMISSIONS` to ensure all permission keys exist
- If user is owner, set all permissions to `true` (use `DEFAULT_PERMISSIONS`)
- If permissions object doesn't exist, use `DEFAULT_PERMISSIONS`
- Add this listener inside the existing member listener setup (around line 2995-3010)

**Example structure**:
```javascript
// Inside the onValue listener for member data
if (memberData.permissions && typeof memberData.permissions === 'object') {
  window.currentUserPermissions = {
    ...DEFAULT_PERMISSIONS,
    ...memberData.permissions
  };
} else if (role === 'owner') {
  window.currentUserPermissions = DEFAULT_PERMISSIONS;
} else {
  window.currentUserPermissions = DEFAULT_PERMISSIONS;
}
```

### 2. Add Permission Check in loadHighlights Function

**Location**: `src/utils/highlighting.js`, function `loadHighlights` (around line 4000-4050)

**Task**: Before showing the annotation popup for a new highlight, check if the user has `createAnnotations` permission.

**Requirements**:
- Check `window.currentUserRole` - if 'owner', allow (bypass check)
- If 'editor' or 'viewer', check `window.currentUserPermissions.createAnnotations`
- If permission is `false`, do NOT show the annotation popup
- Do NOT mark the popup as "permanently closed" - this allows it to show again if permission is re-enabled
- Simply return early without showing the popup

**Code location**: Look for where the annotation popup is created for new highlights (search for "annotation-popup" creation or "permanentlyClosed" logic)

**Example logic**:
```javascript
// Check permission before showing popup
const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
const annotationPerms = typeof window !== 'undefined' ? window.currentUserPermissions : null;
const isOwner = currentUserRole === 'owner';
const canCreateAnnotations = isOwner || (annotationPerms && annotationPerms.createAnnotations === true);

if (!canCreateAnnotations) {
  // Don't show popup, but don't mark as permanently closed
  return; // Exit early, don't create popup
}
```

### 3. Add Permission Check in Add Note Button Handler

**Location**: `src/utils/highlighting.js`, find the "Add Note" button click handler (around line 2875-2900)

**Task**: When user clicks "Add Note" button on an annotation card, check if they have permission to create annotations.

**Requirements**:
- Check if user has `createAnnotations` permission
- If no permission, show error toast: "You do not have permission to create annotations"
- Prevent the annotation popup from opening if permission is denied

**Example**:
```javascript
addNoteButton.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  // Check permission
  const currentUserRole = typeof window !== 'undefined' ? window.currentUserRole : null;
  const annotationPerms = typeof window !== 'undefined' ? window.currentUserPermissions : null;
  const isOwner = currentUserRole === 'owner';
  const canCreateAnnotations = isOwner || (annotationPerms && annotationPerms.createAnnotations === true);
  
  if (!canCreateAnnotations) {
    if (typeof showToast === 'function') {
      showToast('You do not have permission to create annotations', 'error');
    }
    return;
  }
  
  // ... rest of existing code
});
```

### 4. Import Required Dependencies

**Location**: `src/pages/Demonstration.jsx` (top of file)

**Task**: Ensure `DEFAULT_PERMISSIONS` is imported from `src/utils/permissionConstants.js`

**Check**: Verify this import exists:
```javascript
import { DEFAULT_PERMISSIONS } from '../utils/permissionConstants';
```

### 5. Import Permission Utilities in highlighting.js

**Location**: `src/utils/highlighting.js` (top of file)

**Task**: Ensure permission checking utilities are imported

**Check**: Verify this import exists:
```javascript
import { isPermissionEnabled } from "./permissions.js";
```

## Testing Checklist

After implementation, verify:

1. **Owner**: Can always create annotations (popup shows after highlighting)
2. **Editor with createAnnotations: true**: Can create annotations (popup shows)
3. **Editor with createAnnotations: false**: Cannot create annotations (popup does NOT show after highlighting)
4. **Editor with createAnnotations: false → true**: When permission is toggled to true, new highlights should show popup
5. **Viewer**: Cannot create annotations (already implemented, should remain)
6. **Real-time updates**: When owner changes editor's permission in Firebase, the behavior should update immediately without page refresh

## Key Files to Modify

1. `src/pages/Demonstration.jsx` - Add real-time permission listener
2. `src/utils/highlighting.js` - Add permission checks in:
   - `loadHighlights` function (where popup is created for new highlights)
   - Add Note button click handler
   - Any other places where annotation popup is triggered

## Important Notes

- **DO NOT** mark popups as "permanently closed" when permission is false - this prevents them from showing when permission is re-enabled
- **DO** check permissions in real-time using `window.currentUserPermissions`
- **DO** allow owners to bypass all permission checks
- **DO** ensure the permission listener is set up when the component mounts and cleaned up on unmount
- **DO** merge permissions with `DEFAULT_PERMISSIONS` to ensure all keys exist

## Expected Behavior Flow

1. User highlights text
2. Highlight is saved to Firebase
3. `loadHighlights` is called with the new highlight ID
4. Before creating annotation popup, check `window.currentUserPermissions.createAnnotations`
5. If permission is `false` (and user is not owner), skip popup creation
6. If permission is `true` (or user is owner), create and show popup
7. When permission changes in Firebase, listener updates `window.currentUserPermissions`
8. Next highlight will use the updated permissions

## Implementation Priority

1. **High Priority**: Set up real-time permission listener in `Demonstration.jsx`
2. **High Priority**: Add permission check in `loadHighlights` before popup creation
3. **Medium Priority**: Add permission check in Add Note button handler
4. **Low Priority**: Add helpful error messages/toasts when permission is denied
