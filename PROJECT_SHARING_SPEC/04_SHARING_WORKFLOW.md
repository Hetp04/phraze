# Project-Level Sharing: Sharing Workflow (User A)

## Overview

This document describes the complete workflow when User A (project owner) shares a project with another user. The workflow uses the ShareModal component (same as chat sharing) to generate and display invite codes.

---

## Step 1: User is on a Project

**Context:**
- User A is logged in and viewing a project (e.g., "Marketing")
- The project is displayed in the main interface
- User A has full access to this project (they own it or are a member)

**UI State:**
- Project name is visible in the header/sidebar
- Project data (chats, highlights, etc.) is loaded and displayed
- User A can interact with all project features

---

## Step 2: User Clicks Share Button

**Location Options:**
The share button should be accessible from the project view. Possible locations:
- A share icon/button in the project header/toolbar
- A share option in a project menu/dropdown
- A share button in the project sidebar
- A share icon next to the project name in the project selector

**Action:**
- User A clicks the share button
- This should trigger opening the ShareModal component

**Implementation Note:**
- The share button should pass the current `projectId` to the ShareModal
- Example: `<ShareModal isOpen={true} onClose={handleClose} projectId="Marketing" />`

---

## Step 3: ShareModal Opens

**Component:** The same `ShareModal` component used for sharing chats should be used here.

**Modal Configuration:**
- **Title:** "Share Project: {projectName}" (e.g., "Share Project: Marketing")
- **Mode Toggle:** Should show "Collaborative (sync)" and "Private copy (independent)" options
- **For Project Sharing:** Only "Collaborative (sync)" mode is relevant (private copy doesn't make sense for projects)

**Props:**
- `isOpen={true}` - Modal is visible
- `onClose={handleClose}` - Function to close modal
- `projectId="Marketing"` - The project being shared

---

## Step 4: Modal Content for Project Sharing

**When `shareMode === 'collaborative'` and `projectId` is provided:**

Instead of showing the list of users (Jin Liner, Alex Kim, Paige Lamar), the modal should show:

### 4.1 Information Section

**Content:**
- A brief explanation: "Generate an invite code to share this project with others. Each code can be used once."

**Styling:**
- Light gray background (#f9fafb)
- Border: 1px solid #e5e7eb
- Rounded corners: 8px
- Padding: 12px
- Font size: 13px
- Color: #374151
- Line height: 1.4

### 4.2 Invite Code Generation State

**If no code has been generated yet (`inviteCode === null`):**

**Display:**
- Show "Generate Invite Code" button

**Button Styling:**
- Background: #10a37f (green)
- Color: #ffffff (white text)
- Full width: 100%
- Padding: 12px 16px
- Border radius: 8px
- Font size: 13px
- Font weight: 600
- Cursor: pointer
- Transition: background 150ms ease

**Button States:**
- Normal: Green background
- Hover: Slightly darker green
- Disabled (while generating): #9ca3af (gray), cursor: not-allowed

**Action:**
- When clicked: Call `generateProjectInviteCode(projectId)`
- Set `isGenerating` to true
- Show loading state on button ("Generating...")
- After completion, set `isGenerating` to false
- Update `inviteCode` state with the generated code

**If a code has been generated (`inviteCode !== null`):**

**Display:**
- Code display box with the generated code
- "Copy" button next to the code
- Helper text below the code

**Code Display Box Styling:**
- Background: #ffffff
- Border: 2px solid #10a37f (green)
- Border radius: 8px
- Padding: 12px
- Display: flex
- Align items: center
- Gap: 8px

**Code Text Styling:**
- Font family: monospace
- Font size: 16px
- Font weight: 700
- Letter spacing: 2px
- Color: #111827
- Flex: 1

**Copy Button Styling:**
- Background: #10a37f
- Color: #ffffff
- Border: none
- Border radius: 6px
- Padding: 6px 12px
- Font size: 11px
- Font weight: 600
- Cursor: pointer
- White space: nowrap

**Helper Text:**
- Text: "Share this code with team members. They can use it to join your project."
- Font size: 11px
- Color: #6b7280
- Margin: 0
- Position: Below the code display box

### 4.3 Bottom Actions

**Cancel Button:**
- Always visible on the left side
- Background: #ffffff
- Color: #111827
- Border: 1px solid #d1d5db
- Border radius: 10px
- Padding: 7px 12px
- Font size: 12px
- Font weight: 600
- Cursor: pointer

**Action Button (Right Side):**
- **If `inviteCode` is null:** Show "Generate Code" button (or "Share" button)
- **If `inviteCode` is set:** Show "Done" button

**Done Button Styling:**
- Background: #111827
- Color: #ffffff
- Border: 1px solid #111827
- Border radius: 10px
- Padding: 7px 12px
- Font size: 12px
- Font weight: 700
- Cursor: pointer

**Action:**
- When "Done" is clicked, close the modal
- When "Cancel" is clicked, close the modal (and optionally clear the generated code)

---

## Step 5: Generate Invite Code Function

**Function Name:** `generateProjectInviteCode(projectId)`

**Location:** `src/funcs.js`

**Process:**

1. **Validate Input:**
   - Check that `projectId` is provided and is a string
   - If not: Show error toast "No project selected to share" and return null

2. **Check Authentication:**
   - Get `auth.currentUser`
   - If no user: Show error toast "User not authenticated" and return null

3. **Get Company Email:**
   - Get from `localStorage.getItem('companyEmail')`
   - Or fetch from `emailToCompanyDirectory/{userEmail}`
   - If not found: Show error toast "Could not resolve company" and return null
   - Convert to Firebase path format (dots → commas)

4. **Generate Code:**
   - Generate an 8-character random code
   - Format: Alphanumeric, uppercase (A-Z, 0-9)
   - Example: "ABC123XY"
   - Ensure uniqueness (check if code already exists in Firebase, regenerate if needed)

5. **Save to Firebase:**
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

6. **Update ShareModal State:**
   - Return the generated code
   - ShareModal should update its `inviteCode` state
   - This triggers the UI to show the code display instead of the generate button

7. **Optional: Auto-Copy to Clipboard:**
   - Try to copy code to clipboard automatically
   - Use `navigator.clipboard.writeText(code)`
   - If successful: Show toast "Invite code copied to clipboard"
   - If fails: No error (user can copy manually)

**Error Handling:**
- Show toast error if projectId is missing
- Show toast error if user is not authenticated
- Show toast error if company email cannot be resolved
- Show toast error if Firebase save fails
- Log all errors to console for debugging

**Return Value:**
- Returns the generated code string on success
- Returns null on error

---

## Step 6: Copy Code to Clipboard

**When user clicks "Copy" button:**

1. **Copy to Clipboard:**
   - Use `navigator.clipboard.writeText(inviteCode)`
   - If successful: Show success toast "Invite code copied to clipboard"
   - If fails: Try legacy copy method

2. **Legacy Copy Method (Fallback):**
   - Create a temporary textarea element
   - Set value to the code
   - Select the text
   - Execute `document.execCommand('copy')`
   - Remove the textarea
   - Show toast "Code copied to clipboard"

3. **Visual Feedback:**
   - Optionally change button text to "Copied!" temporarily
   - Revert after 2 seconds

---

## Step 7: User Shares Code Manually

**After code is generated:**

- User A copies the code (either automatically or via "Copy" button)
- User A shares the code with User B via:
  - Email
  - Slack/Teams message
  - Direct message
  - Any other communication method
- The code is a simple string (e.g., "ABC123XY")

**No automatic sharing mechanism** - the code must be shared manually by the user.

---

## Complete Flow Diagram

```
User A on Project "Marketing"
    ↓
Clicks Share Button
    ↓
ShareModal Opens (with projectId="Marketing")
    ↓
User sees "Generate Invite Code" button
    ↓
User clicks "Generate Invite Code"
    ↓
generateProjectInviteCode("Marketing") called
    ↓
Code generated: "ABC123XY"
    ↓
Saved to Firebase: inviteCodes/ABC123XY
    ↓
Modal shows code display with "Copy" button
    ↓
User clicks "Copy" (or code auto-copied)
    ↓
Code copied to clipboard
    ↓
User shares code with User B (email/Slack/etc.)
    ↓
User clicks "Done"
    ↓
Modal closes
```

---

## UI States Summary

1. **Initial State:** Generate button visible, no code
2. **Generating State:** Button shows "Generating...", disabled
3. **Code Generated State:** Code displayed, Copy button visible, Done button visible
4. **Copied State:** (Optional) Copy button shows "Copied!" temporarily

---

## Integration Points

**ShareModal Component:**
- Needs `projectId` prop
- Needs `inviteCode` state
- Needs `isGenerating` state
- Needs to call `generateProjectInviteCode` function
- Needs to handle copy to clipboard

**Share Button:**
- Needs to be placed in project view
- Needs to open ShareModal with `projectId`
- Can be in header, sidebar, or project menu
