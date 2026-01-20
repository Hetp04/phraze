# Project-Level Sharing: Implementation Checklist

## Overview

This checklist provides a step-by-step guide for implementing the project-level sharing system. Follow this order to ensure all dependencies are met.

---

## Phase 1: Database Structure and Rules

### 1.1 Update Firebase Rules
- [ ] Read `03_FIREBASE_RULES.md`
- [ ] Update `database.rules.json` with project-level access rules
- [ ] Add rules for `projects` listing restriction
- [ ] Add rules for individual project data access (groqChats, highlights, etc.)
- [ ] Add rules for `members` node
- [ ] Add rules for `emailToSharedProjects`
- [ ] Add rules for `inviteCodes`
- [ ] Test rules in Firebase Console Rules Playground
- [ ] Deploy rules to Firebase

**Files to Modify:**
- `database.rules.json`

**Reference:** `03_FIREBASE_RULES.md`

---

## Phase 2: Core Functions

### 2.1 Generate Project Invite Code Function
- [ ] Read `04_SHARING_WORKFLOW.md` (Step 5)
- [ ] Add `generateProjectInviteCode(projectId)` to `src/funcs.js`
- [ ] Validate input (projectId)
- [ ] Check authentication
- [ ] Get company email
- [ ] Generate 8-character code (alphanumeric, uppercase)
- [ ] Ensure uniqueness (check Firebase)
- [ ] Save to `inviteCodes/{code}` with correct structure
- [ ] Return code string
- [ ] Handle errors with toast messages

**Files to Modify:**
- `src/funcs.js`

**Reference:** `04_SHARING_WORKFLOW.md`

### 2.2 Accept Project Invite Code Function
- [ ] Read `05_ACCEPTING_WORKFLOW.md` (Step 5)
- [ ] Add `acceptProjectInviteCode(inviteCode)` to `src/funcs.js`
- [ ] Validate input (inviteCode)
- [ ] Check authentication
- [ ] Fetch invite code from Firebase
- [ ] Validate code exists
- [ ] Validate type === "project"
- [ ] Extract ownerCompanyEmail and projectId
- [ ] Check self-invite prevention
- [ ] Check already member
- [ ] Add user to members node
- [ ] Create reverse mapping in emailToSharedProjects
- [ ] Delete invite code (single-use)
- [ ] Show success toast
- [ ] Reload page after 1 second
- [ ] Handle all error scenarios

**Files to Modify:**
- `src/funcs.js`

**Reference:** `05_ACCEPTING_WORKFLOW.md`, `09_ERROR_HANDLING.md`

---

## Phase 3: ShareModal Component

### 3.1 Update ShareModal Props
- [ ] Read `06_SHAREMODAL_SPECIFICATION.md`
- [ ] Add `projectId` prop to ShareModal
- [ ] Update prop types/documentation

**Files to Modify:**
- `src/components/ShareModal.jsx`

**Reference:** `06_SHAREMODAL_SPECIFICATION.md`

### 3.2 Add State Variables
- [ ] Add `inviteCode` state (useState)
- [ ] Add `isGenerating` state (useState)

**Files to Modify:**
- `src/components/ShareModal.jsx`

### 3.3 Update Title
- [ ] Conditionally change title based on projectId
- [ ] Show "Share Project: {projectId}" when projectId provided
- [ ] Show "Share Chat" when projectId not provided

**Files to Modify:**
- `src/components/ShareModal.jsx`

### 3.4 Update Content for Project Sharing
- [ ] Add conditional rendering for projectId
- [ ] Show information box when no code
- [ ] Show "Generate Invite Code" button when no code
- [ ] Show code display box when code generated
- [ ] Show "Copy" button next to code
- [ ] Show helper text below code

**Files to Modify:**
- `src/components/ShareModal.jsx`

**Reference:** `06_SHAREMODAL_SPECIFICATION.md`

### 3.5 Add Handler Functions
- [ ] Add `handleGenerateCode` function
- [ ] Call `generateProjectInviteCode` from funcs.js
- [ ] Update state with generated code
- [ ] Optionally auto-copy to clipboard
- [ ] Add `handleCopyCode` function
- [ ] Copy code to clipboard
- [ ] Show success toast

**Files to Modify:**
- `src/components/ShareModal.jsx`

### 3.6 Update Bottom Actions
- [ ] Show "Done" button when code generated
- [ ] Show "Generate Code" button when no code
- [ ] Handle modal close

**Files to Modify:**
- `src/components/ShareModal.jsx`

### 3.7 Test ShareModal
- [ ] Test chat sharing (no projectId) - should work as before
- [ ] Test project sharing (with projectId) - should show new UI
- [ ] Test code generation
- [ ] Test code copying
- [ ] Test modal close

**Files to Modify:**
- `src/components/ShareModal.jsx`

**Reference:** `10_TESTING_SCENARIOS.md`

---

## Phase 4: ChatSidebar Component

### 4.1 Add Shared Projects Tab
- [ ] Read `07_CHATSIDEBAR_SPECIFICATION.md`
- [ ] Add tab state: `projectTab` ('private' | 'shared')
- [ ] Add tab buttons: "Private Projects" and "Shared Projects"
- [ ] Style tabs appropriately
- [ ] Handle tab switching

**Files to Modify:**
- `src/components/ChatSidebar.jsx`

**Reference:** `07_CHATSIDEBAR_SPECIFICATION.md`

### 4.2 Add State Variables
- [ ] Add `sharedProjects` state (useState, array)
- [ ] Add `inviteCodeInput` state (useState, string)

**Files to Modify:**
- `src/components/ChatSidebar.jsx`

### 4.3 Load Shared Projects
- [ ] Add useEffect to load shared projects on mount
- [ ] Fetch from `emailToSharedProjects/{userEmailPath}`
- [ ] Transform nested object into array
- [ ] Update `sharedProjects` state
- [ ] Handle errors

**Files to Modify:**
- `src/components/ChatSidebar.jsx`

**Reference:** `07_CHATSIDEBAR_SPECIFICATION.md`, `02_DATABASE_STRUCTURE.md`

### 4.4 Add Shared Projects Tab Content
- [ ] Show empty state when no shared projects
- [ ] Show "Join a shared project" section
- [ ] Add invite code input field
- [ ] Add "Join Project" button
- [ ] Show shared projects list when projects exist
- [ ] Display each project as clickable item
- [ ] Show "shared" badge on projects

**Files to Modify:**
- `src/components/ChatSidebar.jsx`

**Reference:** `07_CHATSIDEBAR_SPECIFICATION.md`

### 4.5 Add Handler Functions
- [ ] Add `handleAcceptInvite` function
- [ ] Call `acceptProjectInviteCode` from funcs.js
- [ ] Clear input on success
- [ ] Handle errors
- [ ] Add `handleSelectSharedProject` function
- [ ] Set selected project
- [ ] Store owner company in localStorage
- [ ] Trigger project change callback

**Files to Modify:**
- `src/components/ChatSidebar.jsx`

**Reference:** `07_CHATSIDEBAR_SPECIFICATION.md`, `08_DATA_LOADING_AND_CONTEXT.md`

### 4.6 Update Project Creation
- [ ] Add owner membership when creating project
- [ ] Save to `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}`
- [ ] Set role to "owner"
- [ ] Set joinedAt timestamp

**Files to Modify:**
- `src/components/ChatSidebar.jsx`

**Reference:** `07_CHATSIDEBAR_SPECIFICATION.md`

### 4.7 Test ChatSidebar
- [ ] Test tab switching
- [ ] Test loading shared projects
- [ ] Test empty state
- [ ] Test accepting invite
- [ ] Test shared projects list
- [ ] Test selecting shared project
- [ ] Test project creation adds owner

**Files to Modify:**
- `src/components/ChatSidebar.jsx`

**Reference:** `10_TESTING_SCENARIOS.md`

---

## Phase 5: Data Loading and Context

### 5.1 Create Helper Function
- [ ] Read `08_DATA_LOADING_AND_CONTEXT.md`
- [ ] Add `getCurrentProjectPath(projectId)` helper function
- [ ] Check for `sharedCompanyEmail` in localStorage
- [ ] Return correct path based on project type

**Files to Modify:**
- `src/funcs.js` or appropriate utility file

**Reference:** `08_DATA_LOADING_AND_CONTEXT.md`

### 5.2 Update Project Selection
- [ ] Update project selection handlers
- [ ] Store `sharedCompanyEmail` when selecting shared project
- [ ] Clear `sharedCompanyEmail` when selecting private project
- [ ] Update Firebase listeners to use correct path

**Files to Modify:**
- `src/components/ChatSidebar.jsx`
- `src/App.jsx` (or wherever project data is loaded)

**Reference:** `08_DATA_LOADING_AND_CONTEXT.md`

### 5.3 Update Firebase Listeners
- [ ] Update listeners to use `getCurrentProjectPath`
- [ ] Cleanup old listeners when switching projects
- [ ] Setup new listeners for current project
- [ ] Test real-time synchronization

**Files to Modify:**
- `src/App.jsx` (or wherever listeners are set up)

**Reference:** `08_DATA_LOADING_AND_CONTEXT.md`

### 5.4 Test Context Switching
- [ ] Test switching from private to shared project
- [ ] Test switching from shared to private project
- [ ] Test data loads from correct paths
- [ ] Test listeners update correctly
- [ ] Test no data mixing

**Reference:** `10_TESTING_SCENARIOS.md`

---

## Phase 6: Disable Old Company-Level Invites

### 6.1 Remove Company Invite from Signup
- [ ] Read `05_ACCEPTING_WORKFLOW.md`
- [ ] Remove invite code fields from signup forms
- [ ] Remove company-level invite handling in `firebaseCreateAccount`
- [ ] Ensure signup doesn't process company invites

**Files to Modify:**
- `src/pages/Auth.jsx`
- `src/funcs.js` (firebaseCreateAccount function)

### 6.2 Remove Company Invite UI
- [ ] Remove "Invite Account" button from profile dropdown
- [ ] Remove "Use Invite Code" section from profile dropdown
- [ ] Or disable these features (hide them)

**Files to Modify:**
- `src/components/SidebarProfileDropdown.jsx`

### 6.3 Test Old System Disabled
- [ ] Verify company invites don't work during signup
- [ ] Verify company invite UI is removed/disabled
- [ ] Verify users can only use project-level invites

---

## Phase 7: Error Handling

### 7.1 Implement Error Handling
- [ ] Read `09_ERROR_HANDLING.md`
- [ ] Add error handling to `generateProjectInviteCode`
- [ ] Add error handling to `acceptProjectInviteCode`
- [ ] Show user-friendly error messages
- [ ] Log errors to console
- [ ] Handle all error scenarios

**Files to Modify:**
- `src/funcs.js`
- `src/components/ShareModal.jsx`
- `src/components/ChatSidebar.jsx`

**Reference:** `09_ERROR_HANDLING.md`

### 7.2 Test Error Scenarios
- [ ] Test invalid invite code
- [ ] Test wrong invite type
- [ ] Test self-invite
- [ ] Test already member
- [ ] Test network errors
- [ ] Test missing project ID
- [ ] Test not authenticated
- [ ] Test company email not resolved

**Reference:** `10_TESTING_SCENARIOS.md`

---

## Phase 8: Testing

### 8.1 Functional Testing
- [ ] Read `10_TESTING_SCENARIOS.md`
- [ ] Test all scenarios from testing document
- [ ] Verify generate invite code works
- [ ] Verify accept invite code works
- [ ] Verify real-time collaboration works
- [ ] Verify project switching works
- [ ] Verify Firebase rules enforcement

**Reference:** `10_TESTING_SCENARIOS.md`

### 8.2 UI Testing
- [ ] Test ShareModal UI for projects
- [ ] Test Shared Projects tab
- [ ] Test empty states
- [ ] Test error toasts
- [ ] Test success toasts
- [ ] Test all button interactions

### 8.3 Integration Testing
- [ ] Test no regression in chat sharing
- [ ] Test no regression in private projects
- [ ] Test multiple shared projects
- [ ] Test projects from different companies
- [ ] Test page reload persistence

### 8.4 Security Testing
- [ ] Verify users can only access projects they're members of
- [ ] Verify users cannot access other projects
- [ ] Verify invite codes are single-use
- [ ] Verify self-invite is prevented
- [ ] Test Firebase rules in Rules Playground

---

## Phase 9: Documentation and Cleanup

### 9.1 Code Comments
- [ ] Add comments to new functions
- [ ] Add comments to complex logic
- [ ] Document function parameters and return values

### 9.2 Remove Debug Code
- [ ] Remove console.log statements (or keep for debugging)
- [ ] Remove test code
- [ ] Clean up unused imports

### 9.3 Final Review
- [ ] Review all changes
- [ ] Ensure consistency with existing code style
- [ ] Verify all imports are correct
- [ ] Verify no broken references

---

## Implementation Order Summary

1. **Database Rules** (Phase 1) - Foundation for security
2. **Core Functions** (Phase 2) - Backend logic
3. **ShareModal** (Phase 3) - Sharing UI
4. **ChatSidebar** (Phase 4) - Accepting UI
5. **Data Loading** (Phase 5) - Context switching
6. **Disable Old System** (Phase 6) - Cleanup
7. **Error Handling** (Phase 7) - User experience
8. **Testing** (Phase 8) - Verification
9. **Documentation** (Phase 9) - Maintenance

---

## Quick Reference

**Key Files to Modify:**
- `database.rules.json` - Firebase rules
- `src/funcs.js` - Core functions
- `src/components/ShareModal.jsx` - Sharing UI
- `src/components/ChatSidebar.jsx` - Accepting UI
- `src/pages/Auth.jsx` - Remove company invites
- `src/components/SidebarProfileDropdown.jsx` - Remove company invite UI
- `src/App.jsx` - Update data loading (if needed)

**Key Functions to Implement:**
- `generateProjectInviteCode(projectId)`
- `acceptProjectInviteCode(inviteCode)`
- `getCurrentProjectPath(projectId)` (helper)

**Key State Variables:**
- `sharedProjects` (array)
- `inviteCode` (string | null)
- `projectTab` ('private' | 'shared')

**Key Firebase Paths:**
- `inviteCodes/{code}`
- `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}`
- `emailToSharedProjects/{userEmail}/{ownerCompany}/{projectId}`
