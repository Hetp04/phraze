# Security Analysis: Share Permission Implementation

## Current Approach

The current implementation relies on `localStorage` to determine which company email to use when generating invite codes or sending email invites:

```javascript
const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
const sharedProjectId = localStorage.getItem('sharedProjectId');
const currentProject = localStorage.getItem('currentProject');

if (sharedCompanyEmail && sharedProjectId && currentProject && sharedProjectId === projectId) {
    companyEmail = sharedCompanyEmail; // Uses owner's company
} else {
    companyEmail = localStorage.getItem('companyEmail'); // Uses user's own company
}
```

## Security Gaps & Vulnerabilities

### 🔴 **CRITICAL: Client-Side localStorage Manipulation**

**Issue:** All security decisions are based on client-controlled `localStorage` values.

**Attack Vector:**
1. Attacker opens browser console
2. Sets: `localStorage.setItem('sharedCompanyEmail', 'victim@company.com')`
3. Sets: `localStorage.setItem('sharedProjectId', 'victim-project')`
4. Sets: `localStorage.setItem('currentProject', 'victim-project')`
5. Opens ShareModal and generates invite code
6. **Result:** Invite code is created for victim's project, even though attacker has no access

**Impact:**
- ✅ **Mitigated by Firebase Rules:** Firebase rules prevent actual member addition
- ❌ **Still Problematic:** Creates invalid invite codes, wastes resources, confuses users

### 🟡 **MEDIUM: No Membership Verification**

**Issue:** Code doesn't verify user is actually a member before using `sharedCompanyEmail`.

**Attack Scenario:**
- User A is member of Project X (Company A)
- User A manipulates localStorage to point to Project Y (Company B)
- User A generates invite code for Project Y
- **Result:** Invalid invite code created, but Firebase rules prevent actual damage

### 🟡 **MEDIUM: No Permission Verification**

**Issue:** Code doesn't verify user has `share` permission before allowing actions.

**Attack Scenario:**
- User A is member but doesn't have `share` permission
- User A manipulates localStorage to bypass permission check
- User A generates invite code
- **Result:** Firebase rules should block, but client-side allows attempt

### 🟢 **LOW: Race Condition**

**Issue:** `localStorage` values can change between check and use.

**Scenario:**
- Code checks `sharedCompanyEmail` at time T1
- User switches projects (localStorage changes) at time T2
- Code uses old value at time T3
- **Result:** Minor issue, unlikely to be exploited

## Current Protection Mechanisms

### ✅ **Firebase Rules Protection**

The Firebase rules DO provide protection:

```json
"$userEmail": {
  ".write": "auth.uid != null && (
    auth.token.email.replace('.', ',') == $userEmail ||  // Own record
    root.child('emailToCompanyDirectory').child(...).val() == $companyId ||  // Owner
    (root.child('Companies').child($companyId).child('projects').child($projectId)
     .child('members').child(auth.token.email.replace('.', ',')).exists() && 
     root.child('Companies').child($companyId).child('projects').child($projectId)
     .child('members').child(auth.token.email.replace('.', ',')).child('permissions')
     .child('share').val() == true)  // Member with share permission
  )"
}
```

**What This Means:**
- ✅ Attacker cannot actually add members to projects they don't have access to
- ✅ Firebase rules enforce membership and permission checks server-side
- ❌ But attacker can still create invalid invite codes and waste resources

### ✅ **Invite Code Validation**

When someone accepts an invite code:
- Code validates the invite code exists
- Code checks if user is already a member
- Code checks self-invite prevention
- **Result:** Invalid codes fail gracefully

## Recommended Security Improvements

### 1. **Server-Side Verification (Recommended)**

Add verification before using `sharedCompanyEmail`:

```javascript
// Verify user is member and has share permission
const companyEmailPath = sharedCompanyEmail.replace(/\./g, ',');
const memberData = await getFirebaseData(
  `Companies/${companyEmailPath}/projects/${projectId}/members/${userEmailPath}`
);

if (!memberData) {
  // Not a member - fall back to user's own company
  companyEmail = localStorage.getItem('companyEmail');
} else {
  // Verify share permission
  const hasSharePermission = 
    memberData.permissions?.share === true || 
    memberData.role === 'owner' ||
    !memberData.permissions; // Default permissions include share
  
  if (hasSharePermission) {
    companyEmail = sharedCompanyEmail;
  } else {
    showToast('You do not have permission to share this project', 'error');
    return null;
  }
}
```

**Pros:**
- ✅ Verifies membership server-side
- ✅ Verifies permissions server-side
- ✅ Prevents invalid invite code creation
- ✅ Better user experience (clear error messages)

**Cons:**
- ❌ Additional Firebase read operation (minor performance cost)
- ❌ Slightly more complex code

### 2. **Project Existence Verification**

Verify project exists under the company:

```javascript
const projectExists = await getFirebaseData(
  `Companies/${companyEmailPath}/projects/${projectId}`
);

if (!projectExists) {
  showToast('Project not found', 'error');
  return null;
}
```

**Pros:**
- ✅ Prevents attacks on non-existent projects
- ✅ Catches data inconsistencies

**Cons:**
- ❌ Additional Firebase read

### 3. **Firebase Functions (Most Secure)**

Move invite code generation to Firebase Cloud Functions:

**Pros:**
- ✅ Server-side execution (cannot be manipulated)
- ✅ Direct access to Firebase (no client-side checks needed)
- ✅ Can enforce all security rules

**Cons:**
- ❌ Requires Firebase Functions setup
- ❌ More complex architecture
- ❌ Additional latency

## Risk Assessment

### Current Risk Level: **MEDIUM**

**Why:**
- ✅ Firebase rules prevent actual data breaches
- ❌ Client-side manipulation can create invalid data
- ❌ Wastes Firebase resources
- ❌ Poor user experience (invalid codes)

### With Recommended Fixes: **LOW**

**Why:**
- ✅ Server-side verification prevents invalid operations
- ✅ Clear error messages for users
- ✅ Firebase rules still provide backup protection

## Recommended Action Plan

1. **Immediate (High Priority):**
   - Add membership verification before using `sharedCompanyEmail`
   - Add permission verification before allowing share actions
   - Add project existence verification

2. **Short-term (Medium Priority):**
   - Add error logging for security violations
   - Add rate limiting for invite code generation
   - Add validation for invite code format

3. **Long-term (Low Priority):**
   - Consider moving to Firebase Functions for critical operations
   - Add audit logging for all share actions
   - Add monitoring for suspicious patterns

## Conclusion

The current approach has **moderate security gaps** but is **protected by Firebase rules**. The main issues are:
1. Client-side localStorage manipulation
2. No server-side verification
3. Potential for invalid data creation

**Recommendation:** Implement server-side verification (Option 1) to close these gaps while maintaining good performance and user experience.
