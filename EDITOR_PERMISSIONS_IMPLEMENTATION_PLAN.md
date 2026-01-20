# Editor Permissions Implementation Plan

## Overview

Allow project owners to control specific actions that editors can perform. By default, all permissions are enabled, but owners can selectively disable certain actions for editors.

## Proposed Permission Structure

### Permissions to Control

1. **createHighlights** - Create new text highlights
2. **createAnnotations** - Create new annotations (labels, codes, notes) on highlights
3. **modifyAnnotations** - Modify existing annotations
4. **deleteAnnotations** - Delete annotations
5. **deleteHighlights** - Delete highlights

## Database Structure

### Option 1: Store permissions per member (Recommended)
**Path**: `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}`

**Structure**:
```json
{
  "role": "editor",
  "joinedAt": "2025-01-15T10:30:00.000Z",
  "email": "user@example.com",
  "permissions": {
    "createHighlights": true,
    "createAnnotations": true,
    "modifyAnnotations": true,
    "deleteAnnotations": true,
    "deleteHighlights": true
  }
}
```

**Default**: If `permissions` field is missing, all permissions default to `true` (backward compatibility)

**Owner**: Owners always have all permissions (no `permissions` field needed, they have full access)

### Option 2: Store permissions at project level (Alternative)
Store a default permission set per project, but this is less flexible for per-user control.

**We'll go with Option 1 for flexibility.**

## Implementation Steps

### Step 1: Database Structure & Helper Functions
- [ ] Create helper function to check permissions
- [ ] Create helper function to get user permissions (with defaults)
- [ ] Update member creation/update to include default permissions

### Step 2: Admin Panel UI - Permission Management
- [ ] Add permission checkboxes to admin panel modal (for editors only)
- [ ] Display permissions section when managing members
- [ ] Allow toggling permissions (with save functionality)
- [ ] Show visual indicators for enabled/disabled permissions

### Step 3: Permission Checks in Code
- [ ] Add permission check to highlight creation (`saveHighlight`)
- [ ] Add permission check to annotation creation (`addSelectedTextEntry`, `addOptionToAnnotation`)
- [ ] Add permission check to annotation modification (update functions)
- [ ] Add permission check to annotation deletion (`deleteAnnotationByIndex`, `deleteKey`)
- [ ] Add permission check to highlight deletion (if exists)

### Step 4: UI Restrictions
- [ ] Disable/hide highlight creation UI when `createHighlights` is false
- [ ] Disable/hide annotation buttons when `createAnnotations` is false
- [ ] Disable/hide edit buttons when `modifyAnnotations` is false
- [ ] Disable/hide delete buttons when `deleteAnnotations` is false
- [ ] Show appropriate tooltips/messages when actions are disabled

### Step 5: Real-Time Permission Updates
- [ ] Add listener for permission changes
- [ ] Update UI immediately when permissions change
- [ ] Show toast notifications when permissions are revoked

### Step 6: Firebase Rules (Security)
- [ ] Update Firebase rules to check permissions for writes
- [ ] Ensure highlights writes check `createHighlights` permission
- [ ] Ensure annotation writes check appropriate permissions
- [ ] Ensure annotation deletes check `deleteAnnotations` permission

## Permission Checking Helper Function

```javascript
// Get user permissions with defaults
async function getUserPermissions(userEmail, companyEmail, projectId) {
  // Owners always have all permissions
  if (isProjectOwner(userEmail, companyEmail)) {
    return {
      createHighlights: true,
      createAnnotations: true,
      modifyAnnotations: true,
      deleteAnnotations: true,
      deleteHighlights: true
    };
  }

  // Get member data
  const memberPath = `Companies/${companyEmail}/projects/${projectId}/members/${userEmail.replace(/\./g, ',')}`;
  const memberData = await getFirebaseData(memberPath);
  
  if (!memberData || !memberData.permissions) {
    // Default: all permissions enabled (backward compatibility)
    return {
      createHighlights: true,
      createAnnotations: true,
      modifyAnnotations: true,
      deleteAnnotations: true,
      deleteHighlights: true
    };
  }

  return memberData.permissions;
}

// Check specific permission
async function hasPermission(userEmail, companyEmail, projectId, permissionName) {
  const permissions = await getUserPermissions(userEmail, companyEmail, projectId);
  return permissions[permissionName] === true;
}
```

## Firebase Rules Updates

### Highlights Writes
```json
"highlights": {
  "$highlightId": {
    ".write": "auth.uid != null && (
      root.child('Companies').child($companyId).child('projects').child($projectId).child('members').child(auth.token.email.replace('.', ',')).child('permissions').child('createHighlights').val() == true ||
      root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId
    )"
  }
}
```

### Annotation History Writes
```json
"annotationHistory": {
  ".write": "auth.uid != null && (
    root.child('Companies').child($companyId).child('projects').child($projectId).child('members').child(auth.token.email.replace('.', ',')).child('permissions').child('createAnnotations').val() == true ||
    root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId
  )"
}
```

## UI Components

### Permission Checkbox Component
```javascript
<PermissionToggle
  permission="createAnnotations"
  label="Create Annotations"
  description="Allow user to create new annotations"
  enabled={member.permissions?.createAnnotations ?? true}
  onChange={(enabled) => updatePermission(member.email, 'createAnnotations', enabled)}
/>
```

## Testing Checklist

- [ ] Owner can toggle permissions for editors
- [ ] Permissions persist in Firebase
- [ ] Permissions update in real-time
- [ ] Disabled permissions prevent actions in UI
- [ ] Disabled permissions prevent writes in Firebase (security)
- [ ] Default permissions work for existing members
- [ ] Owners always have all permissions
- [ ] Viewers are not affected (they have no permissions anyway)

