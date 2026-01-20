# Project-Level Sharing: Accepting Workflow (User B)

## Overview

This document describes the complete workflow when User B (invited user) accepts a project invite code. The workflow involves entering the code in the "Shared Projects" tab and being added as a member to the specific project.

---

## Step 1: User Receives Invite Code

**Context:**
- User B receives the invite code from User A (e.g., "ABC123XY")
- Code was shared via email, Slack, direct message, etc.
- User B is logged into the application

**Code Format:**
- 8 characters, alphanumeric, uppercase
- Example: "ABC123XY", "XYZ789AB", etc.

---

## Step 2: User Navigates to Shared Projects Tab

**Location:** In the project dropdown/sidebar, there should be a "Shared Projects" tab (separate from "Private Projects" tab).

**UI Structure:**
- Tab buttons: "Private Projects" (default) and "Shared Projects"
- Tabs should be clearly labeled and switchable
- When "Shared Projects" tab is clicked, it shows the Shared Projects view

**Tab Styling:**
- Similar to existing tab styling
- Active tab should be highlighted
- Inactive tab should be muted

---

## Step 3: Shared Projects Tab Content

**If user has no shared projects yet (`sharedProjects.length === 0`):**

**Display:**
1. **Empty State Message:**
   - Text: "No shared projects yet"
   - Styling: Centered, muted color (#6b7280), padding

2. **Join a Shared Project Section:**
   - Section header: "Join a shared project" (optional)
   - Input field: "Enter invite code"
   - Button: "Join Project" or "Accept Invite"
   - Styling: Card-like container with border, padding, rounded corners

**If user has shared projects (`sharedProjects.length > 0`):**

**Display:**
1. **Join a Shared Project Section** (at the top, same as above)

2. **Shared Projects List:**
   - Section header: "Shared with you"
   - List of shared projects (see below)
   - Each project as a clickable item

---

## Step 4: User Enters Invite Code

**Input Field:**
- Placeholder: "Enter invite code"
- Type: text
- Styling: Standard input field with border, padding, rounded corners
- Max length: 8 characters (or allow longer for flexibility)
- Auto-uppercase: Optional (convert to uppercase on input)

**Button:**
- Text: "Join Project" or "Accept Invite"
- Styling: Primary button style (dark background, white text)
- Disabled state: While processing

**Action:**
- User B types the code into the input field (e.g., "ABC123XY")
- User B clicks "Join Project" button
- This triggers `acceptProjectInviteCode(inviteCode)` function

---

## Step 5: Accept Invite Code Function

**Function Name:** `acceptProjectInviteCode(inviteCode)`

**Location:** `src/funcs.js`

**Process:**

### 5.1 Validation

1. **Validate Input:**
   - Check that `inviteCode` is provided and not empty
   - Trim whitespace: `inviteCode.trim()`
   - If empty: Show error "Please enter an invite code" and return false

2. **Check Authentication:**
   - Get `auth.currentUser`
   - If no user: Show error "User not authenticated" and return false

### 5.2 Fetch Invite Code Data

3. **Show Loading:**
   - Show toast: "Processing invite code..."
   - Disable the "Join Project" button
   - Show loading spinner (optional)

4. **Fetch from Firebase:**
   - Path: `inviteCodes/{inviteCode}`
   - If not found: Show error "Invalid or expired invite code" and return false

### 5.3 Validate Invite Code Type

5. **Check Type:**
   - Check that `inviteData.type === 'project'`
   - If not: Show error "This code is not a project invite" and return false

### 5.4 Extract Data

6. **Extract Information:**
   - `ownerCompanyEmail` = `inviteData.companyEmail` (already in comma notation)
   - `projectId` = `inviteData.projectId`
   - Validate both exist, if not: Show error "Malformed invite code" and return false

### 5.5 Get Current User Info

7. **Get User Email Path:**
   - `userEmailPath` = `user.email.replace(/\./g, ',')`
   - Example: `user@example.com` → `user@example,com`

8. **Get User's Company:**
   - From `localStorage.getItem('companyEmail')`
   - Or fetch from `emailToCompanyDirectory/{userEmailPath}`
   - Convert to comma notation if needed

### 5.6 Validate Self-Invite Prevention

9. **Check Self-Invite:**
   - If `userCompanyEmail === ownerCompanyEmail`: 
     - Show error "You cannot accept an invite to your own project"
     - Return false

### 5.7 Check Already Member

10. **Check Existing Membership:**
    - Fetch: `Companies/{ownerCompanyEmail}/projects/{projectId}/members/{userEmailPath}`
    - If exists: 
      - Show error "You are already a member of this project"
      - Return false

### 5.8 Add User as Member

11. **Add Membership:**
    - Path: `Companies/{ownerCompanyEmail}/projects/{projectId}/members/{userEmailPath}`
    - Data:
      ```json
      {
        "role": "member",
        "joinedAt": new Date().toISOString(),
        "email": user.email
      }
      ```
    - Save to Firebase

### 5.9 Create Reverse Mapping

12. **Create Reverse Mapping:**
    - Path: `emailToSharedProjects/{userEmailPath}/{ownerCompanyEmail}/{projectId}`
    - Data:
      ```json
      {
        "projectId": projectId,
        "ownerCompany": ownerCompanyEmail,
        "joinedAt": new Date().toISOString()
      }
      ```
    - Save to Firebase

### 5.10 Delete Invite Code (Single-Use)

13. **Delete Code:**
    - Path: `inviteCodes/{inviteCode}`
    - Set to `null` (delete)
    - This ensures the code can only be used once

### 5.11 Success and Reload

14. **Show Success:**
    - Show toast: "Successfully joined project! Reloading..."

15. **Reload Page:**
    - Wait 1 second: `setTimeout(() => window.location.reload(), 1000)`
    - This ensures the new shared project is loaded and displayed

**Error Handling:**
- Show toast errors for all validation failures
- Show toast error if Firebase operations fail
- Log errors to console for debugging
- Re-enable the "Join Project" button on error

**Return Value:**
- Returns `true` on success
- Returns `false` on error

---

## Step 6: Page Reloads and User Sees Shared Project

**After reload:**

1. **Fetch Shared Projects:**
   - Component fetches from `emailToSharedProjects/{userEmailPath}`
   - Transforms nested object into array
   - Updates `sharedProjects` state

2. **Display Shared Project:**
   - The shared project appears in the "Shared Projects" tab
   - Project name is displayed
   - "shared" badge/indicator is shown

3. **User Can Access Project:**
   - User B can click on the project to view it
   - User B now has real-time access to the project data
   - User B can read/write project data (chats, highlights, etc.)

---

## Shared Projects List Display

**When `sharedProjects.length > 0`:**

**List Structure:**
- Each project as a button/clickable item
- Display project name
- Display "shared" badge/indicator
- Show owner company info (optional)

**Item Styling:**
- Width: 100%
- Background: transparent
- Border: none
- Padding: 10px 12px
- Font size: 0.9rem
- Text align: left
- Border radius: 8px
- Cursor: pointer
- Display: flex
- Align items: center
- Gap: 8px

**Hover State:**
- Background: #f5f5f5

**Selected State:**
- Show checkmark icon if project is currently selected
- Highlight background

**Click Action:**
- Set as `selectedProject`
- Close dropdown
- Trigger `onProjectChange(projectId)` if provided
- Load project data from correct company path

---

## Complete Flow Diagram

```
User B receives code "ABC123XY"
    ↓
User B navigates to "Shared Projects" tab
    ↓
User B sees "Enter invite code" input
    ↓
User B types "ABC123XY" and clicks "Join Project"
    ↓
acceptProjectInviteCode("ABC123XY") called
    ↓
Validate input and authentication
    ↓
Fetch inviteCodes/ABC123XY from Firebase
    ↓
Validate type === "project"
    ↓
Extract ownerCompanyEmail and projectId
    ↓
Check user is not self-inviting
    ↓
Check user is not already a member
    ↓
Add user to members node
    ↓
Create reverse mapping in emailToSharedProjects
    ↓
Delete invite code (single-use)
    ↓
Show success toast
    ↓
Reload page after 1 second
    ↓
Page reloads, fetches shared projects
    ↓
Shared project appears in "Shared Projects" tab
    ↓
User B can click project to view it
```

---

## Error Scenarios

See `09_ERROR_HANDLING.md` for detailed error scenarios and handling.

**Quick Reference:**
- Invalid code → "Invalid or expired invite code"
- Wrong type → "This code is not a project invite"
- Self-invite → "You cannot accept an invite to your own project"
- Already member → "You are already a member of this project"
- Network error → "Failed to accept invite. Please try again."

---

## Integration Points

**ChatSidebar Component:**
- Needs "Shared Projects" tab
- Needs `sharedProjects` state
- Needs useEffect to load shared projects
- Needs input field and button for entering codes
- Needs list display for shared projects
- Needs to call `acceptProjectInviteCode` function

**Project Selection:**
- When user clicks a shared project, need to track the owner company
- Load data from: `Companies/{ownerCompany}/projects/{projectId}/`
- Update Firebase listeners to point to correct path
