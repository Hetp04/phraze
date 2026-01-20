# Firebase Rules Security Testing Guide

## Overview
This guide helps you test the Firebase rules security fixes to ensure everything still works correctly.

---

## Prerequisites

1. **Two or more user accounts** (to test sharing between users)
   - User A: Project owner
   - User B: Regular user (to accept invites)
   - User C: Member with share permission (optional)

2. **Firebase Console access** (to verify data and check for errors)

3. **Browser Developer Tools** (to check console logs and network requests)

---

## Test 1: Invite Code Generation (Owner)

### Setup
- Log in as **User A** (project owner)
- Navigate to a project you own
- Open the Share Modal (click "Share Project" in chat title dropdown)

### Steps
1. Click "Generate Invite Code" button
2. Verify code is generated (8 characters, uppercase)
3. Copy the code (save it for Test 2)
4. Check Firebase Console: `inviteCodes/{code}`
   - Should see: `type: "project"`, `projectId`, `companyEmail`, `createdBy`, `createdAt`, `expiresAt`

### Expected Results
- ✅ Code generates successfully
- ✅ Code appears in modal
- ✅ Code is saved to Firebase with all required fields
- ✅ `expiresAt` field exists and is ~30 days in the future
- ✅ No console errors

---

## Test 2: Invite Code Generation (Member with Share Permission)

### Setup
- **User A** shares project with **User C** and grants `share` permission
- Log in as **User C**
- Navigate to the shared project
- Open Share Modal

### Steps
1. Click "Generate Invite Code" button
2. Verify code is generated
3. Check Firebase Console: `inviteCodes/{code}`
   - Verify `companyEmail` is **User A's company** (not User C's)
   - Verify `createdBy` is **User C's email**

### Expected Results
- ✅ Code generates successfully
- ✅ Code is for the **owner's company**, not the member's company
- ✅ Code is saved correctly
- ✅ No permission errors

---

## Test 3: Invite Code Generation (Member WITHOUT Share Permission)

### Setup
- **User A** shares project with **User C** but does NOT grant `share` permission
- Log in as **User C**
- Navigate to the shared project

### Steps
1. Check if "Share Project" button appears in chat title dropdown
2. If button appears, try to generate a code

### Expected Results
- ✅ "Share Project" button should NOT appear (or should be hidden)
- ✅ If you try to generate via code, should get error: "You do not have permission to share this project"
- ✅ No code is created in Firebase

---

## Test 4: Invite Code Acceptance (Valid Code)

### Setup
- **User A** generates a code (from Test 1)
- Log in as **User B** (different user, different company)
- Navigate to "Shared Projects" tab or accept code page

### Steps
1. Enter the invite code from Test 1
2. Click "Join Project" or "Accept Invite"
3. Wait for processing
4. Check Firebase Console:
   - `Companies/{ownerCompany}/projects/{projectId}/members/{userBEmail}` should exist
   - `emailToSharedProjects/{userBEmail}/{ownerCompany}/{projectId}` should exist
   - `inviteCodes/{code}` should be **deleted** (single-use)

### Expected Results
- ✅ Code is accepted successfully
- ✅ User B is added as member
- ✅ Reverse mapping is created
- ✅ Original invite code is deleted
- ✅ User B can see the project in "Shared Projects" tab
- ✅ Success toast message appears

---

## Test 5: Invite Code Acceptance (Expired Code)

### Setup
- Manually create an expired code in Firebase Console:
  ```json
  {
    "type": "project",
    "projectId": "TestProject",
    "companyEmail": "owner@example,com",
    "createdBy": "owner@example.com",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "expiresAt": "2024-01-02T00:00:00.000Z"  // Past date
  }
  ```
- Log in as **User B**

### Steps
1. Enter the expired code
2. Try to accept it

### Expected Results
- ✅ Error message: "This invite code has expired"
- ✅ Code is automatically deleted from Firebase
- ✅ User is NOT added to project

---

## Test 6: Invite Code Acceptance (Invalid Code)

### Setup
- Log in as **User B**

### Steps
1. Enter a random code that doesn't exist (e.g., "INVALID1")
2. Try to accept it

### Expected Results
- ✅ Error message: "Invalid or expired invite code"
- ✅ No Firebase writes occur
- ✅ User is NOT added to any project

---

## Test 7: Unauthorized Code Creation (Security Test)

### Setup
- Log in as **User B** (who is NOT a member of any project)
- Open browser console

### Steps
1. Try to manually create an invite code via Firebase SDK:
   ```javascript
   // In browser console
   import { getDatabase, ref, set } from 'firebase/database';
   const db = getDatabase();
   const codeRef = ref(db, 'inviteCodes/TESTCODE1');
   await set(codeRef, {
     type: 'project',
     projectId: 'SomeProject',
     companyEmail: 'owner@example,com',
     createdBy: 'userB@example.com',
     createdAt: new Date().toISOString()
   });
   ```

### Expected Results
- ✅ Firebase rules should **reject** the write
- ✅ Error in console: Permission denied
- ✅ Code is NOT created in Firebase
- ✅ This proves unauthorized users cannot create codes

---

## Test 8: Unauthorized Code Deletion (Security Test)

### Setup
- **User A** generates a valid code
- Log in as **User B** (different user, not a member)

### Steps
1. Try to manually delete the code via Firebase SDK:
   ```javascript
   // In browser console
   import { getDatabase, ref, remove } from 'firebase/database';
   const db = getDatabase();
   const codeRef = ref(db, 'inviteCodes/{VALID_CODE}');
   await remove(codeRef);
   ```

### Expected Results
- ✅ Firebase rules should **reject** the delete
- ✅ Error: Permission denied
- ✅ Code still exists in Firebase
- ✅ This proves unauthorized users cannot delete codes

---

## Test 9: Pending Invites Creation (Email Invite)

### Setup
- Log in as **User A** (project owner)
- Navigate to a project
- Open Share Modal

### Steps
1. Enter an email address of a user who doesn't have an account yet
2. Click "Send Invite"
3. Check Firebase Console: `pendingInvites/{emailPath}/{inviteToken}`

### Expected Results
- ✅ Pending invite is created successfully
- ✅ Contains: `email`, `projectId`, `ownerCompany`, `invitedBy`, `invitedAt`, `status: "pending"`
- ✅ User is redirected to signup page with invite token

---

## Test 10: Pending Invites Creation (Member with Share Permission)

### Setup
- **User A** shares project with **User C** and grants `share` permission
- Log in as **User C**
- Navigate to shared project
- Open Share Modal

### Steps
1. Enter an email address
2. Click "Send Invite"
3. Check Firebase Console: `pendingInvites/{emailPath}/{inviteToken}`
   - Verify `ownerCompany` is **User A's company** (not User C's)

### Expected Results
- ✅ Pending invite is created successfully
- ✅ `ownerCompany` is the **project owner's company**, not the member's
- ✅ No permission errors

---

## Test 11: Unauthorized Pending Invite Creation (Security Test)

### Setup
- Log in as **User B** (not a member of any project)
- Open browser console

### Steps
1. Try to manually create a pending invite:
   ```javascript
   // In browser console
   import { getDatabase, ref, set } from 'firebase/database';
   const db = getDatabase();
   const inviteRef = ref(db, 'pendingInvites/test@example,com/FAKETOKEN');
   await set(inviteRef, {
     email: 'test@example.com',
     projectId: 'SomeProject',
     ownerCompany: 'owner@example,com',
     invitedBy: 'userB@example.com',
     invitedAt: new Date().toISOString(),
     status: 'pending'
   });
   ```

### Expected Results
- ✅ Firebase rules should **reject** the write
- ✅ Error: Permission denied
- ✅ Pending invite is NOT created
- ✅ This proves unauthorized users cannot create pending invites

---

## Test 12: Expiration Validation in Rules

### Setup
- Log in as **User A**
- Generate a code
- Check Firebase Console

### Steps
1. Try to manually update the code with invalid `expiresAt`:
   ```javascript
   // In browser console
   import { getDatabase, ref, set } from 'firebase/database';
   const db = getDatabase();
   const codeRef = ref(db, 'inviteCodes/{VALID_CODE}');
   await set(codeRef, {
     type: 'project',
     projectId: 'TestProject',
     companyEmail: 'owner@example,com',
     createdBy: 'owner@example.com',
     createdAt: new Date().toISOString(),
     expiresAt: 12345  // Invalid: should be string or number, but this is wrong format
   });
   ```

### Expected Results
- ✅ Firebase rules should validate `expiresAt` format
- ✅ If invalid format, write should be rejected (or validated)
- ✅ Rules ensure `expiresAt` is either a string or number

---

## Test 13: Code Read Access (For Acceptance)

### Setup
- **User A** generates a code
- Log in as **User B** (different user, not yet a member)

### Steps
1. Try to read the code via Firebase SDK:
   ```javascript
   // In browser console
   import { getDatabase, ref, get } from 'firebase/database';
   const db = getDatabase();
   const codeRef = ref(db, 'inviteCodes/{VALID_CODE}');
   const snapshot = await get(codeRef);
   console.log(snapshot.val());
   ```

### Expected Results
- ✅ Code can be read (needed for acceptance flow)
- ✅ This is intentional - users need to read codes to accept them
- ✅ Enumeration risk is low (codes are random, hard to guess)

---

## Test 14: Multiple Code Generation (Rate Limiting)

### Setup
- Log in as **User A**
- Navigate to a project

### Steps
1. Generate 10+ invite codes in quick succession
2. Check if rate limiting kicks in (if implemented client-side)

### Expected Results
- ✅ First 10 codes generate successfully (if rate limit is 10/day)
- ✅ After limit, should show rate limit error (if implemented)
- ✅ Note: Rate limiting is client-side, so can be bypassed, but provides basic protection

---

## Test 15: Share Button Visibility

### Setup
- **User A** shares project with **User C**
- Test different permission scenarios

### Steps
1. **As Owner (User A):**
   - ✅ "Share Project" button should appear
2. **As Member with Share Permission (User C):**
   - ✅ "Share Project" button should appear
3. **As Member WITHOUT Share Permission:**
   - ✅ "Share Project" button should NOT appear

### Expected Results
- ✅ Button visibility matches permissions correctly
- ✅ No disabled buttons (should be hidden, not disabled)

---

## Common Issues & Troubleshooting

### Issue: "Permission denied" errors
- **Check:** Firebase rules are deployed correctly
- **Check:** User is authenticated
- **Check:** User has correct permissions in Firebase

### Issue: Codes not generating
- **Check:** Browser console for errors
- **Check:** User is a member of the project
- **Check:** User has `share` permission (if not owner)

### Issue: Codes not accepting
- **Check:** Code hasn't expired
- **Check:** Code hasn't been used already (single-use)
- **Check:** User is not already a member
- **Check:** Code exists in Firebase Console

### Issue: Pending invites not working
- **Check:** Email path is correct (dots replaced with commas)
- **Check:** User has share permission
- **Check:** `ownerCompany` is correct

---

## Verification Checklist

After running all tests, verify:

- [ ] Owners can generate codes
- [ ] Members with share permission can generate codes
- [ ] Members without share permission cannot generate codes
- [ ] Codes can be accepted by other users
- [ ] Expired codes are rejected
- [ ] Invalid codes are rejected
- [ ] Unauthorized users cannot create codes (Firebase rules block)
- [ ] Unauthorized users cannot delete codes (Firebase rules block)
- [ ] Pending invites work correctly
- [ ] Unauthorized users cannot create pending invites (Firebase rules block)
- [ ] Share button visibility matches permissions
- [ ] Codes are single-use (deleted after acceptance)
- [ ] Expiration validation works (client-side)
- [ ] All Firebase rules are enforced server-side

---

## Firebase Console Checks

After testing, verify in Firebase Console:

1. **inviteCodes path:**
   - Codes have `expiresAt` field
   - Codes are deleted after use
   - Only authorized users can create codes

2. **pendingInvites path:**
   - Invites have correct `ownerCompany`
   - Only authorized users can create invites

3. **Companies/{company}/projects/{project}/members path:**
   - Members are added correctly
   - Permissions are set correctly

4. **emailToSharedProjects path:**
   - Reverse mappings are created correctly

---

## Notes

- **Client-side checks** provide UX and resource management
- **Firebase rules** provide ultimate server-side security
- **Expiration checks** happen client-side (Firebase rules validate format only)
- **Rate limiting** is client-side (can be bypassed, but provides basic protection)
- **Read access** to invite codes is intentionally open (needed for acceptance)

---

## Next Steps

If all tests pass:
1. ✅ Security fixes are working correctly
2. ✅ Functionality is preserved
3. ✅ Unauthorized access is blocked

If any tests fail:
1. Check Firebase rules syntax
2. Check client-side code for errors
3. Verify user permissions in Firebase
4. Check browser console for detailed error messages
