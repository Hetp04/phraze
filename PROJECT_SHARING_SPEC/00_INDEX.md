# Project-Level Sharing Specification - Index

## Overview

This directory contains the complete specification for implementing project-level sharing, split into multiple focused documents for easier reference.

---

## Document Structure

### 01_OVERVIEW_AND_PRINCIPLES.md
**Purpose:** High-level overview and core principles
**Read this first** to understand the fundamental concepts and goals of the system.

**Key Topics:**
- Core principle: Project-level access control
- Key differences from old system
- Summary of the entire system

---

### 02_DATABASE_STRUCTURE.md
**Purpose:** Complete database structure and data paths
**Reference this** when implementing Firebase data operations.

**Key Topics:**
- Project membership storage
- Reverse mapping for quick lookup
- Invite codes storage
- Company ownership (unchanged)
- Email path notation

---

### 03_FIREBASE_RULES.md
**Purpose:** Complete Firebase security rules
**Reference this** when updating `database.rules.json`.

**Key Topics:**
- Projects listing restriction
- Individual project access rules
- Members node access rules
- Shared projects reverse mapping rules
- Invite codes access rules
- Complete rules example
- Testing rules

---

### 04_SHARING_WORKFLOW.md
**Purpose:** Complete workflow for User A (sharing a project)
**Reference this** when implementing the sharing UI and functions.

**Key Topics:**
- User clicks share button
- ShareModal opens
- Modal content for project sharing
- Generate invite code function
- Copy code to clipboard
- Complete flow diagram

---

### 05_ACCEPTING_WORKFLOW.md
**Purpose:** Complete workflow for User B (accepting an invite)
**Reference this** when implementing the accepting UI and functions.

**Key Topics:**
- User receives invite code
- Navigate to Shared Projects tab
- Enter invite code
- Accept invite code function
- Page reloads and user sees shared project
- Complete flow diagram

---

### 06_SHAREMODAL_SPECIFICATION.md
**Purpose:** Detailed specification for ShareModal component
**Reference this** when modifying `src/components/ShareModal.jsx`.

**Key Topics:**
- Props update (add projectId)
- State variables
- Conditional rendering logic
- Handler functions
- Complete conditional rendering structure
- Styling consistency
- Testing checklist

---

### 07_CHATSIDEBAR_SPECIFICATION.md
**Purpose:** Detailed specification for ChatSidebar component
**Reference this** when modifying `src/components/ChatSidebar.jsx`.

**Key Topics:**
- Add Shared Projects tab
- Add state variables
- Load shared projects
- Shared Projects tab content
- Handler functions
- Project creation adds owner membership
- Complete tab rendering structure
- Testing checklist

---

### 08_DATA_LOADING_AND_CONTEXT.md
**Purpose:** How to handle data loading and context switching
**Reference this** when implementing project selection and data loading.

**Key Topics:**
- Project context types (private vs shared)
- When user selects a private project
- When user selects a shared project
- Helper function: Get current project path
- Real-time synchronization
- Switching between projects
- Best practices

---

### 09_ERROR_HANDLING.md
**Purpose:** All error scenarios and how to handle them
**Reference this** when implementing error handling in functions and UI.

**Key Topics:**
- Invalid invite code
- Wrong invite type
- Self-invite attempt
- Already a member
- Code already used
- Network/Firebase errors
- Missing project ID
- User not authenticated
- Company email not resolved
- Malformed invite code data
- Error handling best practices
- Error recovery

---

### 10_TESTING_SCENARIOS.md
**Purpose:** Comprehensive testing scenarios
**Reference this** when testing the implementation.

**Key Topics:**
- 15 detailed test scenarios
- Expected results for each scenario
- Testing checklist
- Manual testing steps

---

### 11_IMPLEMENTATION_CHECKLIST.md
**Purpose:** Step-by-step implementation guide
**Reference this** when implementing the system.

**Key Topics:**
- Phase 1: Database Structure and Rules
- Phase 2: Core Functions
- Phase 3: ShareModal Component
- Phase 4: ChatSidebar Component
- Phase 5: Data Loading and Context
- Phase 6: Disable Old Company-Level Invites
- Phase 7: Error Handling
- Phase 8: Testing
- Phase 9: Documentation and Cleanup
- Implementation order summary
- Quick reference

---

### 12_SECURITY_AND_FUTURE.md
**Purpose:** Security considerations and future enhancements
**Reference this** for security best practices and potential improvements.

**Key Topics:**
- Firebase rules enforcement
- Invite code security
- Membership validation
- Data access control
- Authentication and authorization
- Input validation
- Future enhancements (10 potential features)
- Security best practices
- Implementation priority

---

## Quick Start Guide

### For Implementation:
1. Start with **01_OVERVIEW_AND_PRINCIPLES.md** to understand the system
2. Follow **11_IMPLEMENTATION_CHECKLIST.md** step by step
3. Reference specific documents as needed:
   - **03_FIREBASE_RULES.md** for database rules
   - **06_SHAREMODAL_SPECIFICATION.md** for ShareModal
   - **07_CHATSIDEBAR_SPECIFICATION.md** for ChatSidebar
   - **04_SHARING_WORKFLOW.md** and **05_ACCEPTING_WORKFLOW.md** for workflows

### For Understanding:
1. Read **01_OVERVIEW_AND_PRINCIPLES.md** first
2. Read **02_DATABASE_STRUCTURE.md** to understand data structure
3. Read **03_FIREBASE_RULES.md** to understand security
4. Read **04_SHARING_WORKFLOW.md** and **05_ACCEPTING_WORKFLOW.md** for user flows

### For Testing:
1. Use **10_TESTING_SCENARIOS.md** as your test plan
2. Reference **09_ERROR_HANDLING.md** for error scenarios
3. Use **11_IMPLEMENTATION_CHECKLIST.md** Phase 8 for testing checklist

---

## File Locations

**Specification Files:**
- All files in: `PROJECT_SHARING_SPEC/`

**Code Files to Modify:**
- `database.rules.json` - Firebase rules
- `src/funcs.js` - Core functions
- `src/components/ShareModal.jsx` - Sharing UI
- `src/components/ChatSidebar.jsx` - Accepting UI
- `src/pages/Auth.jsx` - Remove company invites
- `src/components/SidebarProfileDropdown.jsx` - Remove company invite UI
- `src/App.jsx` - Update data loading (if needed)

---

## Key Functions to Implement

1. **`generateProjectInviteCode(projectId)`**
   - Reference: `04_SHARING_WORKFLOW.md` (Step 5)
   - Location: `src/funcs.js`

2. **`acceptProjectInviteCode(inviteCode)`**
   - Reference: `05_ACCEPTING_WORKFLOW.md` (Step 5)
   - Location: `src/funcs.js`

3. **`getCurrentProjectPath(projectId)`** (helper)
   - Reference: `08_DATA_LOADING_AND_CONTEXT.md`
   - Location: `src/funcs.js` or utility file

---

## Key State Variables

**ShareModal:**
- `inviteCode`: String | null
- `isGenerating`: Boolean

**ChatSidebar:**
- `sharedProjects`: Array
- `inviteCodeInput`: String
- `projectTab`: 'private' | 'shared'

---

## Key Firebase Paths

- `inviteCodes/{code}` - Invite codes storage
- `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}` - Project memberships
- `emailToSharedProjects/{userEmail}/{ownerCompany}/{projectId}` - Reverse mapping

---

## Notes

- All documents are self-contained but cross-reference each other
- Each document focuses on a specific aspect of the system
- Use the index to find the right document for your current task
- Follow the implementation checklist for step-by-step guidance

---

## Questions?

If you need clarification on any part of the specification:
1. Check the relevant document in this directory
2. Review the examples and code snippets provided
3. Refer to the testing scenarios for expected behavior
4. Check the error handling document for edge cases
