# Project-Level Sharing: Testing Scenarios

## Overview

This document provides comprehensive testing scenarios to verify that the project-level sharing system works correctly.

---

## Test Scenario 1: Generate Invite Code

### Setup
- User A is logged in
- User A is viewing project "Marketing"
- User A owns the company

### Steps
1. User A clicks share button/icon
2. ShareModal opens with title "Share Project: Marketing"
3. User A sees "Generate Invite Code" button
4. User A clicks "Generate Invite Code"
5. Code is generated (e.g., "ABC123XY")
6. Code is displayed in modal
7. Code is saved to Firebase: `inviteCodes/ABC123XY`

### Expected Results
- ✅ Modal shows correct title
- ✅ Generate button appears
- ✅ Code is generated (8 characters, uppercase, alphanumeric)
- ✅ Code is displayed in code box
- ✅ Code is saved to Firebase with correct data:
  - `type: "project"`
  - `projectId: "Marketing"`
  - `companyEmail: "owner@example,com"`
  - `createdBy: "owner@example.com"`
- ✅ Copy button appears
- ✅ Code can be copied to clipboard

---

## Test Scenario 2: Accept Invite Code (New User)

### Setup
- User B is logged in
- User B has their own company
- User B has no shared projects yet
- User A has generated code "ABC123XY" for project "Marketing"

### Steps
1. User B navigates to "Shared Projects" tab
2. User B sees "No shared projects yet" message
3. User B sees "Join a shared project" section
4. User B enters "ABC123XY" in input field
5. User B clicks "Join Project"
6. System validates code
7. System adds User B as member
8. System creates reverse mapping
9. System deletes invite code
10. Page reloads
11. User B sees "Marketing" in Shared Projects tab

### Expected Results
- ✅ "Shared Projects" tab is visible
- ✅ Empty state shows correctly
- ✅ Input field accepts code
- ✅ Code is validated successfully
- ✅ User B is added to `Companies/{ownerCompany}/projects/Marketing/members/{userBEmail}`
- ✅ Reverse mapping created: `emailToSharedProjects/{userBEmail}/{ownerCompany}/Marketing`
- ✅ Invite code is deleted from Firebase
- ✅ Success toast appears
- ✅ Page reloads after 1 second
- ✅ "Marketing" appears in Shared Projects list
- ✅ User B can access project "Marketing"
- ✅ User B's `emailToCompanyDirectory` is unchanged (still points to their own company)

---

## Test Scenario 3: Access Shared Project Data

### Setup
- User B has accepted invite to project "Marketing"
- User B is viewing the Shared Projects tab
- Project "Marketing" is listed

### Steps
1. User B clicks on project "Marketing"
2. System loads data from owner's company path
3. User B sees project data (chats, highlights, etc.)
4. User B creates a new chat
5. User A (owner) sees the new chat appear in real-time

### Expected Results
- ✅ Project "Marketing" is clickable
- ✅ Data loads from: `Companies/{ownerCompany}/projects/Marketing/`
- ✅ Chats are displayed
- ✅ Highlights are displayed
- ✅ User B can create new chats
- ✅ User B can add highlights
- ✅ Changes appear in real-time for User A
- ✅ Firebase rules allow User B to read/write

---

## Test Scenario 4: Real-Time Collaboration

### Setup
- User A and User B both have access to project "Marketing"
- Both users are viewing the project

### Steps
1. User A creates a chat message
2. User B sees the chat appear automatically
3. User B adds a highlight
4. User A sees the highlight appear automatically
5. User A adds an annotation
6. User B sees the annotation appear automatically

### Expected Results
- ✅ Changes from User A appear in User B's UI in real-time
- ✅ Changes from User B appear in User A's UI in real-time
- ✅ No page refresh needed
- ✅ Firebase listeners work correctly
- ✅ Data is synchronized correctly

---

## Test Scenario 5: Invalid Invite Code

### Setup
- User B is logged in
- User B navigates to Shared Projects tab

### Steps
1. User B enters "INVALID" in invite code input
2. User B clicks "Join Project"
3. System tries to fetch code from Firebase
4. Code doesn't exist

### Expected Results
- ✅ Error toast: "Invalid or expired invite code"
- ✅ Input field is cleared (or kept for retry, depending on implementation)
- ✅ User B can try again

---

## Test Scenario 6: Self-Invite Prevention

### Setup
- User A is logged in
- User A owns project "Marketing"
- User A generates code "ABC123XY" for "Marketing"

### Steps
1. User A navigates to Shared Projects tab
2. User A enters "ABC123XY" (their own code)
3. User A clicks "Join Project"
4. System checks if user is owner

### Expected Results
- ✅ Error toast: "You cannot accept an invite to your own project"
- ✅ User A is not added as a member (already owner)
- ✅ Code is not deleted
- ✅ Input field is cleared

---

## Test Scenario 7: Already a Member

### Setup
- User B has already accepted invite to "Marketing"
- User B is a member of the project

### Steps
1. User B receives the same code again (or tries to use it)
2. User B enters the code
3. User B clicks "Join Project"
4. System checks existing membership

### Expected Results
- ✅ Error toast: "You are already a member of this project"
- ✅ User B is not added again
- ✅ Input field is cleared
- ✅ Project already appears in Shared Projects list

---

## Test Scenario 8: Single-Use Code

### Setup
- User A generates code "ABC123XY"
- User B accepts the code successfully

### Steps
1. User C receives the same code "ABC123XY"
2. User C enters the code
3. User C clicks "Join Project"
4. System tries to fetch code from Firebase
5. Code doesn't exist (was deleted after User B used it)

### Expected Results
- ✅ Error toast: "Invalid or expired invite code"
- ✅ User C cannot use the code
- ✅ Code was deleted after first use
- ✅ Only one user can use each code

---

## Test Scenario 9: Switch Between Private and Shared Projects

### Setup
- User B has their own project "MyProject"
- User B has shared project "Marketing" from User A

### Steps
1. User B selects "MyProject" (private)
2. Data loads from User B's company
3. User B switches to "Marketing" (shared)
4. Data loads from User A's company
5. User B switches back to "MyProject"
6. Data loads from User B's company again

### Expected Results
- ✅ Private project loads from correct path
- ✅ Shared project loads from correct path
- ✅ Context switches correctly (localStorage)
- ✅ Firebase listeners are updated correctly
- ✅ No data mixing between projects

---

## Test Scenario 10: Project Creation Adds Owner Membership

### Setup
- User A is logged in
- User A creates a new project

### Steps
1. User A creates project "NewProject"
2. System creates project in Firebase
3. System automatically adds User A as owner member

### Expected Results
- ✅ Project is created
- ✅ User A is added to `Companies/{userACompany}/projects/NewProject/members/{userAEmail}`
- ✅ Membership has `role: "owner"`
- ✅ User A can access the project
- ✅ Project appears in Private Projects list

---

## Test Scenario 11: Multiple Shared Projects from Different Companies

### Setup
- User B is logged in
- User A shares "Marketing" with User B
- User C (different company) shares "Engineering" with User B

### Steps
1. User B accepts invite from User A
2. User B accepts invite from User C
3. User B navigates to Shared Projects tab
4. User B sees both projects listed

### Expected Results
- ✅ Both projects appear in Shared Projects list
- ✅ Projects are from different companies
- ✅ User B can access both projects
- ✅ Switching between projects loads correct company data
- ✅ Reverse mapping contains both entries

---

## Test Scenario 12: Firebase Rules Enforcement

### Setup
- User B is a member of "Marketing" from User A's company
- User B is NOT a member of "Engineering" from User A's company

### Steps
1. User B tries to access "Marketing" data
2. User B tries to access "Engineering" data
3. Check Firebase rules

### Expected Results
- ✅ User B can read/write "Marketing" data (is a member)
- ✅ User B cannot read/write "Engineering" data (not a member)
- ✅ Firebase rules deny access to "Engineering"
- ✅ Error is handled gracefully

---

## Test Scenario 13: ShareModal for Chat vs Project

### Setup
- User A is logged in
- User A can share chats and projects

### Steps
1. User A opens ShareModal for a chat (no projectId)
2. Modal shows "Share Chat" title
3. Modal shows user list (collaborative mode)
4. User A closes modal
5. User A opens ShareModal for project "Marketing" (with projectId)
6. Modal shows "Share Project: Marketing" title
7. Modal shows invite code generation UI

### Expected Results
- ✅ Chat sharing works as before (no regression)
- ✅ Project sharing shows correct UI
- ✅ Title changes based on projectId prop
- ✅ Content changes based on projectId prop
- ✅ Both modes work independently

---

## Test Scenario 14: Network Error Handling

### Setup
- User B is logged in
- Network connection is unstable

### Steps
1. User B enters valid invite code
2. User B clicks "Join Project"
3. Network request fails
4. Error is caught and handled

### Expected Results
- ✅ Error toast: "Failed to accept invite. Please try again."
- ✅ Input field value is kept (user can retry)
- ✅ Error is logged to console
- ✅ User B can retry the operation

---

## Test Scenario 15: Page Reload Persistence

### Setup
- User B has accepted invite to "Marketing"
- User B is viewing "Marketing" project

### Steps
1. User B refreshes the page
2. Page reloads
3. System checks localStorage for project context
4. System loads shared projects
5. System restores project view

### Expected Results
- ✅ Shared projects are loaded on mount
- ✅ "Marketing" appears in Shared Projects list
- ✅ Project context is restored if stored in localStorage
- ✅ Data loads from correct company path

---

## Testing Checklist

### Functional Tests
- [ ] Generate invite code works
- [ ] Accept invite code works
- [ ] Invalid code shows error
- [ ] Self-invite is prevented
- [ ] Already member shows error
- [ ] Single-use code works
- [ ] Shared projects load correctly
- [ ] Project switching works
- [ ] Real-time collaboration works
- [ ] Firebase rules enforce access

### UI Tests
- [ ] ShareModal shows correct title
- [ ] ShareModal shows correct content for projects
- [ ] Shared Projects tab appears
- [ ] Empty state shows correctly
- [ ] Shared projects list displays
- [ ] Invite code input works
- [ ] Copy button works
- [ ] Error toasts appear
- [ ] Success toasts appear

### Integration Tests
- [ ] Chat sharing still works (no regression)
- [ ] Private projects still work (no regression)
- [ ] Project creation works
- [ ] Owner membership is added on creation
- [ ] Multiple shared projects work
- [ ] Context switching works
- [ ] Page reload persistence works

### Security Tests
- [ ] Users can only access projects they're members of
- [ ] Users cannot access other projects in same company
- [ ] Invite codes are single-use
- [ ] Self-invite is prevented
- [ ] Firebase rules are enforced

---

## Manual Testing Steps

1. **Setup Test Environment:**
   - Create two test accounts (User A and User B)
   - User A creates a project
   - User B has their own company

2. **Test Sharing Flow:**
   - User A generates invite code
   - User B accepts invite code
   - Verify User B can access project
   - Verify User A can see User B's changes

3. **Test Error Cases:**
   - Try invalid codes
   - Try self-invite
   - Try already-used codes
   - Test network errors

4. **Test Edge Cases:**
   - Multiple shared projects
   - Projects from different companies
   - Switching between projects
   - Page reloads

5. **Verify Security:**
   - Check Firebase rules
   - Verify access restrictions
   - Test unauthorized access attempts
