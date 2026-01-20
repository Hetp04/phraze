# Project Admin Dropdown Feature - Implementation Prompt

## Overview

Add a header bar at the top of the main chat interface that displays the chat/project name with a conditional dropdown menu. The dropdown provides different options based on the project type and user role.

## Header Bar Location

The header bar should be positioned at the top of the main chat interface (in `Demonstration.jsx`), above the chat messages area. It should always be visible, even when no chat is selected (showing the "How can I help you?" screen).

## Header Bar Structure

### Always Visible Elements

1. **Title Display**
   - If a chat is selected: Show `currentChat.title`
   - If no chat is selected: Show project name (`currentProject === 'default' ? 'Default Project' : currentProject`)

2. **Dropdown Arrow** (conditional)
   - Only show dropdown arrow for shared projects
   - Hide dropdown arrow for private projects
   - Arrow should rotate 180 degrees when dropdown is open

3. **Additional Buttons** (conditional, positioned absolutely)
   - Share button (only when chat has messages)
   - Model selection dropdown (only when chat has messages)
   - Project members avatars (only for public chats with members)

## Dropdown States and Content

### State 1: Private Projects
**Condition**: Project is NOT shared (user owns the project and it has no members with role 'member')

**UI Behavior**:
- Show project/chat name
- NO dropdown arrow
- NO dropdown menu
- Just the title text

**Visual**: `Project Name` (no arrow, no dropdown)

---

### State 2: Shared Projects - Owner
**Condition**: 
- Project IS shared (has members with role 'member' OR current user is a member)
- Current user's role in project members is 'owner'

**UI Behavior**:
- Show chat/project name
- Show dropdown arrow (clickable)
- When clicked, show dropdown menu with:
  1. **Manage Projects** (with gear icon)
     - Opens admin panel modal for managing project members and roles
  2. **Share Chat** (with share icon)
     - Only visible if chat has messages
     - Opens share chat modal
  3. **Delete Chat** (with trash icon)
     - Only visible if chat exists
     - Deletes the current chat with confirmation

**Visual**: `Chat Name [▼]` → Dropdown shows:
```
┌─────────────────────┐
│ ⚙️ Manage Projects  │
│ 🔗 Share Chat       │
│ 🗑️ Delete Chat      │
└─────────────────────┘
```

---

### State 3: Shared Projects - Recipient
**Condition**:
- Project IS shared (has members with role 'member' OR current user is a member)
- Current user's role in project members is 'member' (not 'owner')

**UI Behavior**:
- Show chat/project name
- Show dropdown arrow (clickable)
- When clicked, show dropdown menu with:
  1. **View Members** (with users/group icon)
     - Opens modal showing all project members with their roles
  2. **Delete Chat** (with trash icon)
     - Only visible if chat exists
     - Deletes the current chat (only their own chat, not shared chats from others)

**Visual**: `Chat Name [▼]` → Dropdown shows:
```
┌─────────────────────┐
│ 👥 View Members     │
│ 🗑️ Delete Chat      │
└─────────────────────┘
```

## Implementation Details

### State Detection Logic

1. **Check if project is shared**:
   ```javascript
   // Fetch members from: Companies/{companyEmail}/projects/{projectId}/members
   // Project is shared if:
   // - Has more than 1 member (owner + others), OR
   // - Current user is a member (role === 'member')
   const isProjectShared = totalMembers > 1 || isCurrentUserMember;
   ```

2. **Check if user is owner**:
   ```javascript
   // Get current user's email (formatted with commas)
   const currentUserEmail = auth.currentUser.email.replace(/\./g, ',');
   const currentUserMember = membersData[currentUserEmail];
   const isProjectOwner = currentUserMember && currentUserMember.role === 'owner';
   ```

3. **Check if user is recipient**:
   ```javascript
   const isProjectRecipient = currentUserMember && currentUserMember.role === 'member';
   ```

### Dropdown Menu Styling

- Position: Absolute, centered below the title
- Background: White
- Border: 1px solid #e5e7eb
- Border radius: 8px
- Box shadow: 0 4px 12px rgba(0, 0, 0, 0.15)
- Padding: 8px
- Min width: 200px
- Z-index: 1000

### Dropdown Menu Items

Each menu item should:
- Have hover effect (background: #f3f4f6)
- Display icon on the left (16x16px)
- Display text label
- Have proper spacing (padding: 10px 12px)
- Be clickable and close dropdown on click
- Have appropriate onClick handlers

### Click Outside Handler

- Close dropdown when clicking outside the dropdown area
- Use `data-project-dropdown` attribute to identify dropdown elements
- Add to existing click outside handler in useEffect

## File to Modify

- `src/pages/Demonstration.jsx`
  - Add state variables for dropdown
  - Add logic to detect project sharing status and user role
  - Modify header bar section (around line 5470)
  - Add dropdown menu JSX
  - Add click outside handler

## State Variables Needed

```javascript
const [isProjectOwner, setIsProjectOwner] = useState(false);
const [isProjectShared, setIsProjectShared] = useState(false);
const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
```

## Functions to Implement

1. **Check Project Status** (in `fetchProjectMembersAndCount` useEffect):
   - Determine if project is shared
   - Determine if current user is owner or recipient
   - Update state accordingly

2. **Handle Dropdown Toggle**:
   - Toggle `projectDropdownOpen` state
   - Prevent event propagation

3. **Handle Menu Actions**:
   - `handleManageProjects()` - Open admin panel modal
   - `handleShareChat()` - Open share chat modal (existing)
   - `handleDeleteChat()` - Delete current chat
   - `handleViewMembers()` - Open members list modal

## Visual Design

### Dropdown Arrow
- Size: 16x16px
- Color: #6b7280 (grey)
- Hover: #111827 (dark grey)
- Rotation: 180deg when open
- Smooth transition: 0.2s ease

### Menu Items
- Icon: 16x16px, left-aligned
- Text: 0.9rem, left-aligned
- Gap between icon and text: 8px
- Hover background: #f3f4f6
- Border radius: 6px

## Edge Cases to Handle

1. **No chat selected**: Show project name, no dropdown (private) or show dropdown if shared
2. **User not logged in**: No dropdown, just title
3. **Loading state**: Don't show dropdown until members data is loaded
4. **Chat has no messages**: Hide "Share Chat" option
5. **Shared chat from others**: Recipients can only delete their own chats, not shared chats they received

## Testing Scenarios

1. Private project → Should show title only, no dropdown
2. Shared project as owner → Should show dropdown with Manage Projects, Share Chat, Delete Chat
3. Shared project as recipient → Should show dropdown with View Members, Delete Chat
4. No chat selected → Should show project name
5. Click outside dropdown → Should close dropdown
6. Click dropdown arrow → Should toggle dropdown

## Notes

- The header bar should always be visible (even on "How can I help you?" screen)
- Use existing `handleShareChat` function for share functionality
- Use existing chat deletion logic for delete functionality
- Admin panel modal will be implemented separately
- Members view modal will be implemented separately
