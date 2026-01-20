# Project-Level Sharing: Error Handling

## Overview

This document describes all error scenarios that can occur during project sharing and how to handle them gracefully.

---

## Error Scenarios

### 1. Invalid Invite Code

**Scenario:** User enters a code that doesn't exist in Firebase.

**When It Happens:**
- User enters a random string
- User enters a code that was already used (deleted)
- User enters a typo

**Detection:**
```javascript
const inviteData = await getFirebaseData(`inviteCodes/${inviteCode}`);
if (!inviteData) {
  // Code doesn't exist
}
```

**Error Message:** "Invalid or expired invite code"

**User Action:**
- Clear input field
- Allow user to retry
- Show error toast

**Implementation:**
```javascript
showToast('Invalid or expired invite code', 'error');
setInviteCodeInput(''); // Clear input
```

---

### 2. Wrong Invite Type

**Scenario:** User enters a company-level invite code (if those still exist) instead of a project invite code.

**When It Happens:**
- User confuses company invite with project invite
- Old invite codes from deprecated system

**Detection:**
```javascript
if (inviteData.type !== 'project') {
  // Wrong type
}
```

**Error Message:** "This code is not a project invite"

**User Action:**
- Clear input field
- Show explanation: "This code is for company access. Please use a project invite code."
- Allow user to retry

**Implementation:**
```javascript
showToast('This code is not a project invite', 'error');
setInviteCodeInput('');
```

---

### 3. Self-Invite Attempt

**Scenario:** User tries to accept an invite to their own project.

**When It Happens:**
- User accidentally generates code for their own project
- User tries to test the system with their own code

**Detection:**
```javascript
const userCompanyEmail = await getMainCompanyEmail();
if (userCompanyEmail === ownerCompanyEmail) {
  // Self-invite
}
```

**Error Message:** "You cannot accept an invite to your own project"

**User Action:**
- Clear input field
- Show message explaining they already have access
- Optionally navigate to the project

**Implementation:**
```javascript
showToast('You cannot accept an invite to your own project', 'error');
setInviteCodeInput('');
```

---

### 4. Already a Member

**Scenario:** User tries to accept an invite they've already accepted.

**When It Happens:**
- User enters the same code twice
- User was already added as a member manually
- Code was used by another user but still exists (shouldn't happen with single-use)

**Detection:**
```javascript
const existingMember = await getFirebaseData(
  `Companies/${ownerCompanyEmail}/projects/${projectId}/members/${userEmailPath}`
);
if (existingMember) {
  // Already a member
}
```

**Error Message:** "You are already a member of this project"

**User Action:**
- Clear input field
- Show message
- Optionally navigate to the project in Shared Projects tab

**Implementation:**
```javascript
showToast('You are already a member of this project', 'error');
setInviteCodeInput('');
// Optionally: Navigate to shared project
```

---

### 5. Code Already Used

**Scenario:** User enters a code that was already used (deleted from Firebase).

**When It Happens:**
- Code was used by another user
- Code was used by the same user in a different session
- Code expired and was cleaned up

**Detection:**
- Same as "Invalid Invite Code" (code doesn't exist)

**Error Message:** "Invalid or expired invite code"

**User Action:**
- Clear input field
- Allow user to retry
- Show error toast

**Note:** This is handled the same as invalid code since the code no longer exists.

---

### 6. Network/Firebase Errors

**Scenario:** Firebase operation fails due to network issues, permission denied, etc.

**When It Happens:**
- Network connection lost
- Firebase service unavailable
- Permission denied (shouldn't happen with correct rules)
- Timeout

**Detection:**
```javascript
try {
  await saveFirebaseData(...);
} catch (err) {
  // Firebase error
  console.error('Firebase error:', err);
}
```

**Error Message:** "Failed to accept invite. Please try again."

**User Action:**
- Show error toast
- Keep input field value (so user doesn't lose the code)
- Allow user to retry
- Log error to console for debugging

**Implementation:**
```javascript
catch (err) {
  console.error('Failed to accept invite:', err);
  showToast('Failed to accept invite. Please try again.', 'error');
  // Don't clear input - user can retry
}
```

---

### 7. Missing Project ID

**Scenario:** User tries to generate invite code but no project is selected.

**When It Happens:**
- ShareModal opened without projectId prop
- ProjectId is null/undefined
- ProjectId is empty string

**Detection:**
```javascript
if (!projectId || typeof projectId !== 'string') {
  // Missing project ID
}
```

**Error Message:** "No project selected to share"

**User Action:**
- Close modal or show error
- User should select a project first

**Implementation:**
```javascript
showToast('No project selected to share', 'error');
```

---

### 8. User Not Authenticated

**Scenario:** User tries to generate or accept invite but is not logged in.

**When It Happens:**
- Session expired
- User logged out
- Auth state not initialized

**Detection:**
```javascript
const user = auth.currentUser;
if (!user || !user.email) {
  // Not authenticated
}
```

**Error Message:** "User not authenticated"

**User Action:**
- Redirect to login page
- Show error toast

**Implementation:**
```javascript
showToast('User not authenticated', 'error');
// Optionally redirect to login
window.location.href = '/#/auth';
```

---

### 9. Company Email Not Resolved

**Scenario:** Cannot determine user's company email when generating invite code.

**When It Happens:**
- localStorage doesn't have companyEmail
- emailToCompanyDirectory entry missing
- Data corruption

**Detection:**
```javascript
const companyEmail = await getMainCompanyEmail();
if (!companyEmail) {
  // Company email not found
}
```

**Error Message:** "Could not resolve company"

**User Action:**
- Show error
- Log error for debugging
- User may need to refresh or re-login

**Implementation:**
```javascript
showToast('Could not resolve company', 'error');
console.error('Company email not found for user:', user.email);
```

---

### 10. Malformed Invite Code Data

**Scenario:** Invite code exists but has missing or invalid data.

**When It Happens:**
- Data corruption
- Old invite code format
- Manual database manipulation

**Detection:**
```javascript
if (!inviteData.projectId || !inviteData.companyEmail) {
  // Malformed data
}
```

**Error Message:** "Malformed invite code"

**User Action:**
- Clear input
- Allow retry
- Log error for debugging

**Implementation:**
```javascript
showToast('Malformed invite code', 'error');
console.error('Invalid invite code data:', inviteData);
setInviteCodeInput('');
```

---

## Error Handling Best Practices

### 1. Always Show User-Friendly Messages

**Bad:**
```javascript
catch (err) {
  console.error(err);
  // No user feedback
}
```

**Good:**
```javascript
catch (err) {
  console.error('Error details:', err);
  showToast('Failed to accept invite. Please try again.', 'error');
}
```

### 2. Don't Lose User Input on Recoverable Errors

**Bad:**
```javascript
catch (err) {
  setInviteCodeInput(''); // User loses their code
  showToast('Error', 'error');
}
```

**Good:**
```javascript
catch (err) {
  // Keep input value so user can retry
  showToast('Failed to accept invite. Please try again.', 'error');
}
```

### 3. Clear Input Only on Success or Non-Retryable Errors

**Clear input when:**
- Invite accepted successfully
- Invalid code (user should enter different code)
- Wrong type (user should enter different code)

**Keep input when:**
- Network error (user can retry same code)
- Temporary Firebase error

### 4. Log Errors for Debugging

**Always log:**
- Error object
- Context (user email, project ID, invite code)
- Timestamp

**Example:**
```javascript
catch (err) {
  console.error('acceptProjectInviteCode error:', {
    error: err,
    inviteCode: inviteCode,
    userEmail: user.email,
    timestamp: new Date().toISOString()
  });
  showToast('Failed to accept invite. Please try again.', 'error');
}
```

### 5. Provide Actionable Error Messages

**Bad:**
- "Error occurred"
- "Something went wrong"

**Good:**
- "Invalid or expired invite code"
- "You are already a member of this project"
- "Failed to accept invite. Please try again."

### 6. Handle Edge Cases

**Examples:**
- Empty strings
- Whitespace-only input
- Very long strings
- Special characters
- Null/undefined values

**Validation:**
```javascript
const trimmed = (inviteCode || '').trim();
if (!trimmed) {
  showToast('Please enter an invite code', 'error');
  return false;
}
```

---

## Error Recovery

### Automatic Retry

**For network errors:**
```javascript
let retries = 0;
const maxRetries = 3;

async function acceptWithRetry(inviteCode) {
  try {
    return await acceptProjectInviteCode(inviteCode);
  } catch (err) {
    if (retries < maxRetries && err.code === 'network-error') {
      retries++;
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      return acceptWithRetry(inviteCode);
    }
    throw err;
  }
}
```

### Manual Retry

**Show retry button:**
```javascript
const [retryAvailable, setRetryAvailable] = useState(false);

catch (err) {
  showToast('Failed to accept invite', 'error');
  setRetryAvailable(true);
}

// In UI
{retryAvailable && (
  <button onClick={() => handleAcceptInvite()}>
    Retry
  </button>
)}
```

---

## Error UI States

### Loading State
- Show spinner
- Disable buttons
- Show "Processing..." message

### Error State
- Show error toast
- Enable buttons
- Keep input value (if retryable)
- Show error message

### Success State
- Show success toast
- Clear input
- Reload page (for invite acceptance)
- Close modal (for code generation)

---

## Testing Error Scenarios

**Test each error scenario:**
1. Enter invalid code → Should show "Invalid or expired invite code"
2. Enter wrong type code → Should show "This code is not a project invite"
3. Self-invite → Should show "You cannot accept an invite to your own project"
4. Already member → Should show "You are already a member of this project"
5. Network error → Should show "Failed to accept invite. Please try again."
6. Missing project ID → Should show "No project selected to share"
7. Not authenticated → Should show "User not authenticated"
