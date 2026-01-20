# Project-Level Sharing System - Complete Specification

## Overview

This document provides an **extremely detailed specification** for implementing a project-level sharing system that replaces the existing company-level invite functionality. The new system allows users to share **individual projects** with other users via invite codes, while maintaining strict access control so that invited users can **only access the specific shared project** and nothing else from the owner's company.

---

## Core Principle: Project-Level Access Control

### The Fundamental Rule

**A user can only access a project if they are either:**
1. **The owner** of the company that owns the project (their `emailToCompanyDirectory` points to that company)
2. **An explicit member** of that specific project (listed in `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}`)

**A user CANNOT access a project if:**
- They are not the owner AND not a member
- They belong to a different company (even if they're in the same company, they still need explicit membership for non-owned projects)

### Why This Matters

This ensures that when User A shares "Project X" with User B:
- User B gets access **ONLY** to "Project X"
- User B does **NOT** get access to User A's other projects ("Project Y", "Project Z", etc.)
- User B does **NOT** become part of User A's company
- User B remains in their own company (`emailToCompanyDirectory` stays unchanged)
- User B can collaborate in real-time on "Project X" with User A

---

## Database Structure

### 1. Project Membership Storage

**Path:** `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}`

**Structure:**
```json
{
  "role": "owner" | "member",
  "joinedAt": "2025-11-29T12:00:00.000Z",
  "email": "user@example.com"
}
```

**Purpose:** This is the **source of truth** for who has access to a project. When a user accepts a project invite, they are added here as a `member` with `role: "member"`. The project creator is automatically added as `role: "owner"`.

**Access Rules:**
- Users can read their own membership entry
- Users can write their own membership entry (for accepting invites)
- Project owners can read/write all memberships

### 2. Reverse Mapping for Quick Lookup

**Path:** `emailToSharedProjects/{userEmail}/{ownerCompany}/{projectId}`

**Structure:**
```json
{
  "projectId": "Marketing",
  "ownerCompany": "owner@example,com",
  "joinedAt": "2025-11-29T12:00:00.000Z"
}
```

**Purpose:** This allows the UI to quickly list all projects shared with a user without querying every company. When a user accepts an invite, an entry is created here. This is used to populate the "Shared Projects" tab in the UI.

**Access Rules:**
- Users can only read/write their own entries under `emailToSharedProjects/{theirEmail}`

### 3. Invite Codes Storage

**Path:** `inviteCodes/{code}`

**Structure:**
```json
{
  "type": "project",
  "projectId": "Marketing",
  "companyEmail": "owner@example,com",
  "createdBy": "owner@example.com",
  "createdAt": "2025-11-29T12:00:00.000Z"
}
```

**Purpose:** Stores single-use invite codes. When a project owner generates a code, it's saved here. When a user accepts the code, it's deleted (single-use).

**Access Rules:**
- Anyone can read invite codes (to validate them)
- Authenticated users can write invite codes (to create them)

### 4. Company Ownership (Unchanged)

**Path:** `emailToCompanyDirectory/{userEmail}`

**Structure:**
```json
"owner@example,com"
```

**Purpose:** Maps a user's email to their company email. This determines which company they "own" and which projects they can access by default (all projects in their company).

**Critical Note:** This should **NEVER** be changed when accepting project invites. Users stay in their own company.

---

## Firebase Database Rules

### Projects Listing Restriction

**Rule:** Users can only list projects from their own company.

**Implementation:**
```json
"projects": {
  ".read": "auth.uid != null && root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId",
  ".write": "auth.uid != null && root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId"
}
```

**Why:** This prevents users from seeing all projects in other companies. They can only see projects in their own company by default.

### Individual Project Access

**Rule:** Users can access a specific project if they are either:
- The owner of the company (via `emailToCompanyDirectory`)
- A member of the project (via `members/{userEmail}`)

**Implementation:**
```json
"$projectId": {
  "groqChats": {
    ".read": "auth.uid != null && (root.child('Companies').child($companyId).child('projects').child($projectId).child('members').child(auth.token.email.replace('.', ',')).exists() || root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId)",
    ".write": "auth.uid != null && (root.child('Companies').child($companyId).child('projects').child($projectId).child('members').child(auth.token.email.replace('.', ',')).exists() || root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId)"
  },
  "highlights": { /* same rule */ },
  "annotationHistory": { /* same rule */ },
  "categoriesImages": { /* same rule */ },
  "customLabelsAndCodes": { /* same rule */ },
  "manualLoggingCategories": { /* same rule */ }
}
```

**Why:** This enforces that project data (chats, highlights, annotations, etc.) can only be accessed by owners or explicit members.

### Members Node Access

**Rule:** Users can read their own membership and write their own membership (to accept invites).

**Implementation:**
```json
"members": {
  "$userEmail": {
    ".read": "auth.uid != null",
    ".write": "auth.uid != null && auth.token.email.replace('.', ',') == $userEmail"
  }
}
```

**Why:** Allows users to accept invites by writing their own membership entry.

### Shared Projects Reverse Mapping

**Rule:** Users can only read/write their own entries.

**Implementation:**
```json
"emailToSharedProjects": {
  "$userEmail": {
    ".read": "auth.uid != null && auth.token.email.replace('.', ',') == $userEmail",
    "$company": {
      "$project": {
        ".write": "auth.uid != null && auth.token.email.replace('.', ',') == $userEmail"
      }
    }
  }
}
```

**Why:** Users need to write their own entries when accepting invites, and read them to list shared projects.

---

## User Workflow: Sharing a Project

### Step 1: User is on a Project

- User A is logged in and viewing a project (e.g., "Marketing")
- The project is displayed in the main interface
- User A has full access to this project (they own it or are a member)

### Step 2: User Clicks Share Button

**Location:** The share button should be accessible from the project view. This could be:
- A share icon/button in the project header/toolbar
- A share option in a project menu/dropdown
- A share button in the project sidebar

**Action:** User A clicks the share button.

### Step 3: ShareModal Opens

**Component:** The same `ShareModal` component used for sharing chats should be used here.

**Modal Configuration:**
- **Title:** "Share Project: {projectName}" (e.g., "Share Project: Marketing")
- **Mode Toggle:** Should show "Collaborative (sync)" and "Private copy (independent)" options
- **For Project Sharing:** Only "Collaborative (sync)" mode is relevant (private copy doesn't make sense for projects)

### Step 4: Modal Content for Project Sharing

**When `shareMode === 'collaborative'` and `projectId` is provided:**

Instead of showing the list of users (Jin Liner, Alex Kim, Paige Lamar), the modal should show:

1. **Information Section:**
   - A brief explanation: "Generate an invite code to share this project with others. Each code can be used once."
   - Styling: Light gray background, border, rounded corners, padding

2. **Invite Code Generation:**
   - If no code has been generated yet:
     - Show a button: "Generate Invite Code"
     - Button style: Green background (#10a37f), white text, full width, padding, rounded corners
     - When clicked: Generate the code (see function below)
   - If a code has been generated:
     - Display the code prominently in a monospace font, large size, with letter spacing
     - Show a "Copy" button next to the code
     - Show helper text: "Share this code with team members. They can use it to join your project."
     - Code should be in a highlighted box (green border, white background)

3. **Bottom Actions:**
   - "Cancel" button (left side)
   - "Done" button (right side, replaces "Share" when code is generated)
   - When "Done" is clicked, close the modal

### Step 5: Generate Invite Code Function

**Function Name:** `generateProjectInviteCode(projectId)`

**Process:**
1. Validate that `projectId` is provided and is a string
2. Check that user is authenticated (`auth.currentUser`)
3. Get the user's company email (from `localStorage.getItem('companyEmail')` or from `emailToCompanyDirectory`)
4. Generate an 8-character random code (alphanumeric, uppercase)
5. Save to Firebase:
   - Path: `inviteCodes/{code}`
   - Data:
     ```json
     {
       "type": "project",
       "projectId": projectId,
       "companyEmail": companyEmail,
       "createdBy": user.email,
       "createdAt": new Date().toISOString()
     }
     ```
6. Update the ShareModal state to show the generated code
7. Optionally copy the code to clipboard automatically

**Error Handling:**
- Show toast error if projectId is missing
- Show toast error if user is not authenticated
- Show toast error if company email cannot be resolved
- Show toast error if Firebase save fails

### Step 6: Copy Code to Clipboard

**When user clicks "Copy" button:**
1. Copy the generated code to clipboard using `navigator.clipboard.writeText(code)`
2. Show success toast: "Invite code copied to clipboard"
3. Fallback: If clipboard API fails, use legacy copy method

### Step 7: User Shares Code Manually

- User A copies the code (either automatically or via "Copy" button)
- User A shares the code with User B via:
  - Email
  - Slack/Teams message
  - Direct message
  - Any other communication method
- The code is a simple string (e.g., "ABC123XY")

---

## User Workflow: Accepting a Project Invite

### Step 1: User Receives Invite Code

- User B receives the invite code from User A (e.g., "ABC123XY")
- User B is logged into the application

### Step 2: User Navigates to Shared Projects Tab

**Location:** In the project dropdown/sidebar, there should be a "Shared Projects" tab (separate from "Private Projects" tab).

**UI:**
- Tab button: "Shared Projects"
- When clicked, shows the Shared Projects view

### Step 3: Shared Projects Tab Content

**If user has no shared projects yet:**
- Show empty state: "No shared projects yet"
- Show a section: "Join a shared project"
- Show an input field: "Enter invite code"
- Show a button: "Join Project" or "Accept Invite"

**If user has shared projects:**
- Show list of shared projects (see below)
- Also show the "Join a shared project" section above the list

### Step 4: User Enters Invite Code

- User B types the code into the input field (e.g., "ABC123XY")
- User B clicks "Join Project" button

### Step 5: Accept Invite Code Function

**Function Name:** `acceptProjectInviteCode(inviteCode)`

**Process:**
1. Validate that `inviteCode` is provided and not empty
2. Check that user is authenticated
3. Show loading toast: "Processing invite code..."
4. Fetch invite code data from Firebase:
   - Path: `inviteCodes/{inviteCode}`
   - If not found: Show error "Invalid or expired invite code" and return
5. Validate invite code type:
   - Check that `inviteData.type === 'project'`
   - If not: Show error "This code is not a project invite" and return
6. Extract data:
   - `ownerCompanyEmail` = `inviteData.companyEmail` (with dots replaced by commas)
   - `projectId` = `inviteData.projectId`
7. Get current user's email path:
   - `userEmailPath` = `user.email.replace(/\./g, ',')`
8. Get current user's company:
   - `userCompanyEmail` = from `localStorage.getItem('companyEmail')` or `emailToCompanyDirectory`
9. Validate user is not self-inviting:
   - If `userCompanyEmail === ownerCompanyEmail`: Show error "You cannot accept an invite to your own project" and return
10. Check if already a member:
    - Fetch: `Companies/{ownerCompanyEmail}/projects/{projectId}/members/{userEmailPath}`
    - If exists: Show error "You are already a member of this project" and return
11. Add user as member:
    - Path: `Companies/{ownerCompanyEmail}/projects/{projectId}/members/{userEmailPath}`
    - Data:
      ```json
      {
        "role": "member",
        "joinedAt": new Date().toISOString(),
        "email": user.email
      }
      ```
12. Create reverse mapping:
    - Path: `emailToSharedProjects/{userEmailPath}/{ownerCompanyEmail}/{projectId}`
    - Data:
      ```json
      {
        "projectId": projectId,
        "ownerCompany": ownerCompanyEmail,
        "joinedAt": new Date().toISOString()
      }
      ```
13. Delete the invite code (single-use):
    - Path: `inviteCodes/{inviteCode}`
    - Set to `null`
14. Show success toast: "Successfully joined project! Reloading..."
15. Reload the page after 1 second:
    - `setTimeout(() => window.location.reload(), 1000)`

**Error Handling:**
- Show toast errors for all validation failures
- Show toast error if Firebase operations fail
- Log errors to console for debugging

### Step 6: Page Reloads and User Sees Shared Project

After reload:
1. The `emailToSharedProjects` data is fetched
2. The shared project appears in the "Shared Projects" tab
3. User B can click on the project to view it
4. User B now has real-time access to the project data

---

## UI Components: ShareModal Modifications

### Props

**Current:** `ShareModal({ isOpen, onClose })`

**New:** `ShareModal({ isOpen, onClose, projectId })`

- `projectId`: Optional string. If provided, the modal is in "project sharing" mode. If not provided, it's in "chat sharing" mode (existing behavior).

### State Variables

Add to ShareModal:
- `inviteCode`: String | null - Stores the generated invite code
- `isGenerating`: Boolean - Tracks if code generation is in progress

### Conditional Rendering Logic

**If `projectId` is provided:**

1. **Title:** Change from "Share Chat" to `"Share Project: {projectId}"`

2. **Mode Toggle:** 
   - Still show both buttons, but when `projectId` is provided, only "Collaborative (sync)" is functional
   - "Private copy (independent)" can be disabled or hidden (optional)

3. **Content (when `shareMode === 'collaborative'`):**
   - **If `inviteCode` is null:**
     - Show information box explaining project sharing
     - Show "Generate Invite Code" button
     - When clicked: Call `generateProjectInviteCode(projectId)`, set `isGenerating` to true, then false after completion
   - **If `inviteCode` is set:**
     - Show the code in a prominent display box
     - Show "Copy" button next to the code
     - Show helper text below the code

4. **Bottom Actions:**
   - "Cancel" button (always visible)
   - If `inviteCode` is null: Show "Generate Code" button (or "Share" button)
   - If `inviteCode` is set: Show "Done" button

**If `projectId` is not provided:**
- Use existing chat sharing behavior (no changes)

---

## UI Components: ChatSidebar Modifications

### Shared Projects Tab

**Location:** In the project dropdown, add a second tab: "Shared Projects"

**Tab Structure:**
- Two tabs: "Private Projects" (default) and "Shared Projects"
- Tabs should be clearly labeled and switchable

### Loading Shared Projects

**useEffect Hook:**
- When component mounts and user is logged in, fetch shared projects
- Path: `emailToSharedProjects/{userEmailPath}`
- Structure returned: `{ companyEmail: { projectId: {...} } }`
- Transform to array: `[{ projectId, ownerCompany, ...projectInfo }]`
- Store in state: `sharedProjects`

### Shared Projects Tab Content

**If `sharedProjects.length === 0`:**
- Show empty state message: "No shared projects yet"
- Show "Join a shared project" section:
  - Input field: "Enter invite code"
  - Button: "Join Project"
  - When button clicked: Call `acceptProjectInviteCode(inputValue)`

**If `sharedProjects.length > 0`:**
- Show "Join a shared project" section at the top (same as above)
- Show section header: "Shared with you"
- List all shared projects:
  - Each project as a button/clickable item
  - Display project name
  - Display "shared" badge/indicator
  - When clicked: Set as `selectedProject`, close dropdown, trigger `onProjectChange`

### Project Selection Logic

**When user selects a shared project:**
1. Set `selectedProject` to the project ID
2. Update `localStorage` if needed to track current project context
3. Close the dropdown
4. Call `onProjectChange(projectId)` if provided
5. The main app should load data from: `Companies/{ownerCompany}/projects/{projectId}/`

**Important:** The app needs to track which company a shared project belongs to. This can be done by:
- Storing `sharedCompanyEmail` in localStorage when a shared project is selected
- Or passing the owner company along with the project ID

---

## Data Loading: Project Context Switching

### When User Selects a Private Project

- Load from: `Companies/{userCompanyEmail}/projects/{projectId}/`
- Use `localStorage.getItem('companyEmail')` to get company email
- Clear any `sharedCompanyEmail` from localStorage

### When User Selects a Shared Project

- Load from: `Companies/{ownerCompany}/projects/{projectId}/`
- Get `ownerCompany` from the `sharedProjects` array entry
- Store `sharedCompanyEmail` in localStorage (optional, for tracking)
- The Firebase listeners should point to the correct path

### Real-Time Synchronization

**Both users (owner and member) read/write to the same path:**
- `Companies/{ownerCompany}/projects/{projectId}/groqChats/`
- `Companies/{ownerCompany}/projects/{projectId}/highlights/`
- `Companies/{ownerCompany}/projects/{projectId}/annotationHistory/`
- etc.

**Firebase Realtime Database listeners:**
- Should be set up to listen to the correct company/project path
- When switching between private and shared projects, listeners should be updated
- Changes made by one user should appear in real-time for all members

---

## Removing Old Company-Level Invite System

### Functions to Keep (Unchanged)

- `inviteAccount()` - Keep for backward compatibility, but consider deprecating
- `handleUseInviteCode()` - Keep for backward compatibility, but consider deprecating

### Functions to Add

- `generateProjectInviteCode(projectId)` - New function for project invites
- `acceptProjectInviteCode(inviteCode)` - New function for accepting project invites

### UI Elements to Remove/Disable

**Option 1: Remove Completely**
- Remove "Invite Account" button from profile dropdown
- Remove "Use Invite Code" input from profile dropdown
- Remove invite code field from signup form

**Option 2: Keep but Disable**
- Keep UI elements but disable them
- Show tooltip: "Company-level invites are deprecated. Use project-level sharing instead."

**Recommendation:** Remove completely to avoid confusion.

---

## Error Scenarios and Handling

### Invalid Invite Code
- **Scenario:** User enters a code that doesn't exist in Firebase
- **Error Message:** "Invalid or expired invite code"
- **Action:** Clear input, allow retry

### Wrong Invite Type
- **Scenario:** User enters a company-level invite code (if those still exist)
- **Error Message:** "This code is not a project invite"
- **Action:** Clear input, allow retry

### Self-Invite Attempt
- **Scenario:** User tries to accept an invite to their own project
- **Error Message:** "You cannot accept an invite to your own project"
- **Action:** Clear input, show message

### Already a Member
- **Scenario:** User tries to accept an invite they've already accepted
- **Error Message:** "You are already a member of this project"
- **Action:** Clear input, show message, optionally navigate to the project

### Code Already Used
- **Scenario:** User enters a code that was already used (deleted from Firebase)
- **Error Message:** "Invalid or expired invite code" (same as invalid code)
- **Action:** Clear input, allow retry

### Network/Firebase Errors
- **Scenario:** Firebase operation fails (network error, permission denied, etc.)
- **Error Message:** "Failed to accept invite. Please try again."
- **Action:** Log error to console, allow retry

---

## Testing Scenarios

### Scenario 1: Basic Project Sharing
1. User A creates a project "Marketing"
2. User A clicks share button, ShareModal opens
3. User A clicks "Generate Invite Code"
4. Code is generated and displayed (e.g., "ABC123XY")
5. User A copies code and shares with User B
6. User B enters code in "Shared Projects" tab
7. User B successfully joins project
8. User B sees "Marketing" in Shared Projects tab
9. User B can access project data in real-time

### Scenario 2: Multiple Projects, One Shared
1. User A has projects: "Marketing", "Engineering", "Sales"
2. User A shares only "Marketing" with User B
3. User B accepts invite
4. **Verify:** User B sees ONLY "Marketing" in Shared Projects
5. **Verify:** User B does NOT see "Engineering" or "Sales"
6. **Verify:** User B's Private Projects show their own projects (unchanged)

### Scenario 3: Real-Time Collaboration
1. User A and User B are both viewing "Marketing" project
2. User A creates a new chat/groqChat
3. **Verify:** Chat appears immediately for User B
4. User B adds a highlight
5. **Verify:** Highlight appears immediately for User A

### Scenario 4: Single-Use Code
1. User A generates code "ABC123XY"
2. User B accepts code successfully
3. User C tries to use the same code "ABC123XY"
4. **Verify:** User C gets "Invalid or expired invite code" error

### Scenario 5: Self-Invite Prevention
1. User A generates code for their own project
2. User A tries to accept their own code (from different account or same account)
3. **Verify:** Error message shown, invite not processed

### Scenario 6: Already Member Prevention
1. User B accepts invite to "Marketing"
2. User B tries to accept the same invite again (if code still exists)
3. **Verify:** Error message "You are already a member of this project"

### Scenario 7: Project Access After Accepting
1. User B accepts invite to "Marketing"
2. User B navigates to "Marketing" project
3. **Verify:** User B can read all project data (groqChats, highlights, etc.)
4. **Verify:** User B can write/create new data (chats, highlights, etc.)
5. **Verify:** Firebase rules allow access (check in Firebase Console)

### Scenario 8: Database Rules Enforcement
1. User B accepts invite to User A's "Marketing" project
2. User B tries to access User A's "Engineering" project directly (by manipulating URL or Firebase path)
3. **Verify:** Firebase rules block access (403 error or no data returned)

---

## Implementation Checklist

### Backend Functions (funcs.js)
- [ ] Implement `generateProjectInviteCode(projectId)`
- [ ] Implement `acceptProjectInviteCode(inviteCode)`
- [ ] Add error handling and toast notifications
- [ ] Ensure single-use code deletion
- [ ] Add validation for self-invites
- [ ] Add validation for already-member checks

### ShareModal Component
- [ ] Add `projectId` prop
- [ ] Add `inviteCode` state
- [ ] Add `isGenerating` state
- [ ] Modify title to show project name when `projectId` is provided
- [ ] Add conditional rendering for project sharing mode
- [ ] Add "Generate Invite Code" button
- [ ] Add code display with copy functionality
- [ ] Update bottom actions ("Done" vs "Share")
- [ ] Integrate with `generateProjectInviteCode` function

### ChatSidebar Component
- [ ] Add "Shared Projects" tab
- [ ] Add `sharedProjects` state
- [ ] Add useEffect to load shared projects from `emailToSharedProjects`
- [ ] Add "Join a shared project" section with input and button
- [ ] Add list of shared projects with click handlers
- [ ] Integrate with `acceptProjectInviteCode` function
- [ ] Handle project selection for shared projects
- [ ] Track owner company for shared projects

### Database Rules (database.rules.json)
- [ ] Verify projects listing is restricted to company owners
- [ ] Verify individual project access checks membership OR ownership
- [ ] Verify members node allows users to write their own entry
- [ ] Verify emailToSharedProjects allows users to read/write their own entries
- [ ] Verify inviteCodes allows global read and authenticated write
- [ ] Test rules in Firebase Console Rules Playground

### Project Creation
- [ ] Ensure new projects automatically add creator as `role: "owner"` in members node
- [ ] Verify project creation doesn't break existing functionality

### UI/UX Polish
- [ ] Add loading states for code generation
- [ ] Add loading states for invite acceptance
- [ ] Add success/error toast messages
- [ ] Style shared projects list consistently
- [ ] Add "shared" badge/indicator on shared projects
- [ ] Ensure modal animations work correctly
- [ ] Test on mobile/responsive layouts

### Testing
- [ ] Test all scenarios listed above
- [ ] Test error handling
- [ ] Test Firebase rules enforcement
- [ ] Test real-time synchronization
- [ ] Test with multiple users simultaneously
- [ ] Test edge cases (empty states, network errors, etc.)

### Documentation
- [ ] Update user-facing documentation
- [ ] Add inline code comments
- [ ] Document Firebase structure
- [ ] Document API functions

---

## Key Differences from Old System

### Old System (Company-Level)
- User joins entire company
- User gets access to ALL projects in that company
- User's `emailToCompanyDirectory` changes to the new company
- Data migration happens
- User loses access to their original company's projects

### New System (Project-Level)
- User stays in their own company
- User gets access to ONLY the specific shared project
- User's `emailToCompanyDirectory` remains unchanged
- No data migration
- User keeps access to their own company's projects
- User can be a member of multiple projects from different companies

---

## Security Considerations

1. **Invite codes should be sufficiently random** (8 characters alphanumeric is acceptable, but consider longer for production)
2. **Single-use enforcement** is critical - codes must be deleted after use
3. **Firebase rules** are the primary security mechanism - they must be correctly configured
4. **Validation** should happen on both client and server (Firebase rules)
5. **Self-invite prevention** prevents accidental or malicious company access
6. **Already-member checks** prevent duplicate memberships and code reuse attempts

---

## Future Enhancements (Optional)

1. **Invite code expiration** - Add `expiresAt` timestamp to invite codes
2. **Role-based permissions** - Different roles (viewer, editor, admin) with different access levels
3. **Invite code management** - UI to view/revoke generated codes
4. **Email notifications** - Send email when user is invited to a project
5. **Project member list** - UI to see who has access to a project
6. **Remove member** - Ability to remove members from a project
7. **Transfer ownership** - Ability to transfer project ownership
8. **Project settings** - UI to manage project sharing settings

---

## Summary

This specification defines a complete project-level sharing system that:

1. **Replaces** company-level invites with project-specific invites
2. **Uses ShareModal** (same component as chat sharing) for generating and displaying invite codes
3. **Enforces strict access control** via Firebase rules and membership tracking
4. **Maintains user company ownership** - users stay in their own company
5. **Enables real-time collaboration** on shared projects
6. **Provides clear UI/UX** for both sharing and accepting invites

The system is designed to be secure, scalable, and user-friendly while maintaining backward compatibility where possible.
