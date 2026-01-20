# Editor and Viewer Roles Implementation

## Overview

This document specifies the implementation of role-based access control for project members. Members can have two roles: **Editor** and **Viewer**. Editors have full access to create annotations and engage in chats, while Viewers have read-only access and can only view content.

---

## Role Definitions

### Editor Role
- **Full Access**: Can perform all actions
- **Annotations**: Can create, edit, and delete annotations
- **Chat**: Can send messages, engage in conversations, and interact with the AI
- **All Features**: Has access to all interactive features

### Viewer Role
- **Read-Only Access**: Can only view content, cannot modify anything
- **Annotations**: Cannot create, edit, or delete annotations
- **Chat**: Cannot send messages or engage in conversations
- **Viewing Only**: Can view:
  - Unified annotation cards
  - Annotation popups
  - Chat messages
  - All visual content
  - Project data

---

## Implementation Requirements

### 1. Role Storage

**Location**: `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}`

**Structure**:
```json
{
  "role": "editor" | "viewer" | "owner",
  "joinedAt": "2025-01-15T10:30:00.000Z",
  "email": "user@example.com"
}
```

**Default Role**: When a recipient accepts a project invite, they are automatically assigned the `"editor"` role.

---

### 2. Role Detection

**Current User's Role**: Determine the current user's role in the active project:

1. Check if user is the project owner (owns the company that owns the project)
   - If yes: Full access (equivalent to Editor)
2. Check `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}` for role
   - `"owner"`: Full access
   - `"editor"`: Full access
   - `"viewer"`: Read-only access
   - `undefined` or `null`: Default to `"editor"` (for backward compatibility)

**State Variable**: Add `currentUserRole` state in `Demonstration.jsx`:
```javascript
const [currentUserRole, setCurrentUserRole] = useState(null); // 'owner' | 'editor' | 'viewer' | null
```

**Update Logic**: Update `currentUserRole` in the same `useEffect` that determines `isProjectOwner` and `isProjectShared`, ensuring it updates in real-time when project members change.

---

### 3. UI Restrictions for Viewers

#### 3.1 Chat Input Restrictions

**Location**: `MessageInput` component and chat input area in `Demonstration.jsx`

**Implementation**:
- Disable the message input field when `currentUserRole === 'viewer'`
- Disable the send button when `currentUserRole === 'viewer'`
- Show a tooltip or message: "Viewers cannot send messages"
- Style the input field to appear disabled (grayed out, cursor: not-allowed)

**Code Pattern**:
```javascript
const isViewer = currentUserRole === 'viewer';
const isReadOnly = isViewer;

// In MessageInput component or chat input area:
<input
  disabled={isReadOnly}
  placeholder={isReadOnly ? "Viewers cannot send messages" : "Type your message..."}
  style={{
    opacity: isReadOnly ? 0.6 : 1,
    cursor: isReadOnly ? 'not-allowed' : 'text',
    backgroundColor: isReadOnly ? '#f3f4f6' : 'white'
  }}
/>

<button
  disabled={isReadOnly}
  style={{
    opacity: isReadOnly ? 0.5 : 1,
    cursor: isReadOnly ? 'not-allowed' : 'pointer'
  }}
>
  Send
</button>
```

#### 3.2 Annotation Creation Restrictions

**Location**: Annotation creation handlers in `Demonstration.jsx`

**Actions to Disable for Viewers**:
- Creating new annotations (highlighting text)
- Editing existing annotations
- Deleting annotations
- Attaching highlights to annotations
- Creating annotation cards

**Implementation**:
- Add role check before all annotation creation/editing functions
- Show toast message: "Viewers cannot create or edit annotations"
- Prevent event handlers from executing when `currentUserRole === 'viewer'`

**Code Pattern**:
```javascript
const handleCreateAnnotation = (e) => {
  if (currentUserRole === 'viewer') {
    showToast("Viewers cannot create annotations", "info");
    return;
  }
  // ... existing annotation creation logic
};

const handleEditAnnotation = (annotationId) => {
  if (currentUserRole === 'viewer') {
    showToast("Viewers cannot edit annotations", "info");
    return;
  }
  // ... existing annotation editing logic
};

const handleDeleteAnnotation = (annotationId) => {
  if (currentUserRole === 'viewer') {
    showToast("Viewers cannot delete annotations", "info");
    return;
  }
  // ... existing annotation deletion logic
};
```

#### 3.3 Annotation UI Elements to Disable

**Elements to Disable/Hide for Viewers**:
- Annotation creation buttons
- Edit annotation buttons/controls
- Delete annotation buttons
- Annotation input fields
- "Add annotation" buttons
- Highlight attachment controls

**Elements to Keep Visible (Read-Only)**:
- Unified annotation cards (view only)
- Annotation popups (view only)
- Existing annotations (display only)
- Annotation highlights (visual display only)

**Implementation**:
```javascript
// Conditionally render edit/delete buttons
{currentUserRole !== 'viewer' && (
  <button onClick={handleEditAnnotation}>Edit</button>
)}

{currentUserRole !== 'viewer' && (
  <button onClick={handleDeleteAnnotation}>Delete</button>
)}
```

#### 3.4 Other Interactive Features to Disable

**Features to Disable for Viewers**:
- Model selection dropdown (cannot change AI model)
- Annotate button (if it triggers annotation creation)
- Any other interactive controls that modify content

**Features to Keep Enabled**:
- Viewing chat history
- Viewing annotations
- Scrolling through content
- Opening/closing modals (for viewing)
- Navigation between chats

---

### 4. Real-Time Role Updates

**Requirement**: When a project owner changes a member's role from Editor to Viewer (or vice versa), the affected user's UI should update in real-time without requiring a page refresh.

**Implementation**:
- Add a Firebase listener in `useEffect` that watches `Companies/{companyEmail}/projects/{projectId}/members/{currentUserEmail}`
- When the role changes, update `currentUserRole` state
- The UI will automatically re-render with appropriate restrictions/enablements

**Code Pattern**:
```javascript
useEffect(() => {
  if (!auth.currentUser || !targetCompanyEmail || !currentProject) {
    setCurrentUserRole(null);
    return;
  }

  const currentUserEmail = auth.currentUser.email.replace(/\./g, ',');
  const memberPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/members/${currentUserEmail}`;
  
  const memberRef = ref(database, memberPath);
  const unsubscribe = onValue(memberRef, (snapshot) => {
    const memberData = snapshot.val();
    if (memberData && memberData.role) {
      setCurrentUserRole(memberData.role);
    } else {
      // Check if user owns the company
      getFirebaseData(`emailToCompanyDirectory/${currentUserEmail}`).then(userCompanyEmail => {
        if (userCompanyEmail && userCompanyEmail === targetCompanyEmail) {
          setCurrentUserRole('owner');
        } else {
          setCurrentUserRole('editor'); // Default
        }
      });
    }
  });

  return () => {
    unsubscribe();
  };
}, [targetCompanyEmail, currentProject, auth.currentUser]);
```

---

### 5. Role Change Functionality (Admin Panel)

**Location**: Member role dropdown in the admin panel modal

**Implementation**: Update the onClick handlers for "Editor" and "Viewer" options in the dropdown:

```javascript
const handleRoleChange = async (memberEmail, newRole) => {
  try {
    const memberEmailPath = memberEmail.replace(/\./g, ',');
    const memberPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/members/${memberEmailPath}`;
    
    // Get current member data
    const currentMemberData = await getFirebaseData(memberPath);
    
    // Update role
    await saveFirebaseData(memberPath, {
      ...currentMemberData,
      role: newRole
    });
    
    showToast(`Member role updated to ${newRole}`, "success");
    setMemberRoleDropdownOpen(null);
    
    // Update local state
    setProjectMembers(prev => 
      prev.map(m => 
        m.email === memberEmail 
          ? { ...m, role: newRole }
          : m
      )
    );
  } catch (error) {
    console.error("Error updating member role:", error);
    showToast("Failed to update member role", "error");
  }
};
```

**Update Dropdown Buttons**:
```javascript
<button
  onClick={(e) => {
    e.stopPropagation();
    handleRoleChange(member.email, 'editor');
  }}
>
  Editor
</button>

<button
  onClick={(e) => {
    e.stopPropagation();
    handleRoleChange(member.email, 'viewer');
  }}
>
  Viewer
</button>
```

---

### 6. Visual Indicators

**Add Role Badge**: Display the user's role next to their name/avatar in the members list:
- "Owner" badge (green) - already implemented
- "Editor" badge (blue) - optional, for clarity
- "Viewer" badge (gray) - optional, for clarity

**Disabled State Styling**: Ensure all disabled elements have consistent styling:
- Reduced opacity (0.5-0.6)
- Cursor: not-allowed
- Grayed out background
- Tooltip explaining why it's disabled

---

### 7. Error Handling

**Scenarios to Handle**:
1. User's role is changed while they're actively using the app
   - Solution: Real-time listener updates UI immediately
2. User tries to perform restricted action
   - Solution: Show informative toast message
3. Role update fails in Firebase
   - Solution: Show error toast, revert UI state
4. User's role is removed (they're no longer a member)
   - Solution: Redirect to default project or show access denied message

---

### 8. Testing Checklist

- [ ] Editor can send messages
- [ ] Viewer cannot send messages (input disabled)
- [ ] Editor can create annotations
- [ ] Viewer cannot create annotations (shows toast)
- [ ] Editor can edit annotations
- [ ] Viewer cannot edit annotations (buttons hidden/disabled)
- [ ] Editor can delete annotations
- [ ] Viewer cannot delete annotations (buttons hidden/disabled)
- [ ] Viewer can view annotation cards
- [ ] Viewer can view annotation popups
- [ ] Role changes update in real-time without refresh
- [ ] Owner can change member roles in admin panel
- [ ] Role changes persist in Firebase
- [ ] UI restrictions apply immediately after role change
- [ ] Default role for new members is "editor"
- [ ] Project owners have full access regardless of role field

---

### 9. Files to Modify

1. **`src/pages/Demonstration.jsx`**:
   - Add `currentUserRole` state
   - Add real-time listener for role updates
   - Add role checks to all annotation handlers
   - Disable chat input for viewers
   - Conditionally render edit/delete buttons based on role
   - Implement `handleRoleChange` function

2. **`src/funcs.js`**:
   - Already updated: Default role is "editor" when accepting invites

3. **Admin Panel Modal** (in `Demonstration.jsx`):
   - Update dropdown onClick handlers to call `handleRoleChange`
   - Add visual role badges (optional)

---

### 10. Implementation Order

1. Add `currentUserRole` state and real-time listener
2. Implement role detection logic (owner check + member role check)
3. Add role checks to chat input (disable for viewers)
4. Add role checks to annotation creation handlers
5. Add role checks to annotation edit/delete handlers
6. Implement `handleRoleChange` function in admin panel
7. Update dropdown buttons to call `handleRoleChange`
8. Add visual indicators and disabled styling
9. Test all scenarios
10. Handle edge cases and errors

---

## Summary

This implementation ensures that:
- **Editors** have full access to create annotations and engage in chats
- **Viewers** can only view content (annotations, chats, cards) but cannot modify anything
- Role changes update in real-time without page refresh
- The UI clearly indicates when actions are restricted
- Project owners maintain full access regardless of role assignment
