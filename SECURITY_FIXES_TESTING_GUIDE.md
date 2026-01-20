# Security Fixes Testing Guide

## Overview
This guide explains what can be tested with **existing accounts** vs what requires **new accounts**.

---

## ✅ **Can Test with Existing Accounts**

### 1. **Race Condition Fix** ✅
- **What to test:** Multiple users accepting the same code simultaneously
- **Existing accounts:** ✅ YES - Use 2-3 existing accounts
- **How:**
  1. User A generates a code
  2. User B and User C try to accept the same code at the same time
  3. Only one should succeed, others should get "code already used" error

### 2. **Transactional Guarantees (Error Handling)** ✅
- **What to test:** Partial failure cleanup
- **Existing accounts:** ✅ YES - Use existing accounts
- **How:** 
  - Hard to test naturally (requires network failure)
  - Can simulate by temporarily breaking Firebase rules
  - Or check logs for cleanup messages

### 3. **Firebase Rules Security** ✅
- **What to test:** Unauthorized access attempts
- **Existing accounts:** ✅ YES - Use existing accounts
- **How:**
  1. User A (not owner/member) tries to create invite code → Should fail
  2. User B (member without share permission) tries to generate code → Should fail
  3. User C (owner) generates code → Should succeed

### 4. **Owner Company Validation** ✅
- **What to test:** Verifying owner company exists
- **Existing accounts:** ✅ YES - Use existing accounts
- **How:**
  - Normal acceptance should work
  - Can manually delete company in Firebase to test error handling

### 5. **Expiration Check** ✅
- **What to test:** Expired codes are rejected
- **Existing accounts:** ✅ YES - Use existing accounts
- **How:**
  1. Generate a code
  2. Manually edit it in Firebase Console to set `expiresAt` to past date
  3. Try to accept → Should show "expired" error

### 6. **Permission Checks** ✅
- **What to test:** Share button visibility and permission checks
- **Existing accounts:** ✅ YES - Use existing accounts
- **How:**
  1. Owner → Should see "Share Project" button
  2. Member with share permission → Should see "Share Project" button
  3. Member without share permission → Should NOT see button

### 7. **Rate Limiting (Code Generation)** ✅
- **What to test:** Rate limit enforcement
- **Existing accounts:** ✅ YES - But need to clear localStorage
- **How:**
  1. Generate 10 codes (should work)
  2. Try 11th code → Should show rate limit error
  3. Or clear localStorage: `localStorage.removeItem('inviteCodeGen_...')` to reset

### 8. **Rate Limiting (Code Acceptance)** ✅
- **What to test:** Rate limit for acceptance attempts
- **Existing accounts:** ✅ YES - But need to clear localStorage
- **How:**
  1. Try accepting invalid codes 10 times
  2. 11th attempt → Should show rate limit error
  3. Or clear: `localStorage.removeItem('inviteCodeAccept_...')` to reset

### 9. **Audit Logging** ✅
- **What to test:** Logs appear in console
- **Existing accounts:** ✅ YES - Use existing accounts
- **How:**
  1. Generate a code → Check console for `[AUDIT] Invite code generated`
  2. Accept a code → Check console for `[AUDIT] Invite code accepted`

### 10. **Overly Permissive Rules Fix** ✅
- **What to test:** Restricted access to sharedChats, Notifications, UserRequests
- **Existing accounts:** ✅ YES - Use existing accounts
- **How:**
  1. User A tries to read User B's notifications → Should fail
  2. User A tries to write to User B's sharedChats → Should fail
  3. User A can only access their own data

---

## ⚠️ **Requires New Accounts (or Special Setup)**

### 1. **New User Signup with Invite Code** ⚠️
- **What to test:** Complete signup flow with invite code
- **New account needed:** ✅ YES - Need to create new account
- **Why:** Can't test signup flow with existing accounts
- **Alternative:** Use incognito/private window with new email

### 2. **Pending Invites (New User)** ⚠️
- **What to test:** Email invite to non-existent user
- **New account needed:** ✅ YES - Need email that doesn't have account
- **Why:** Tests the pending invite flow
- **Alternative:** Use a test email you control but haven't signed up

### 3. **First-Time Code Acceptance** ⚠️
- **What to test:** User accepting code for first time
- **New account needed:** ⚠️ OPTIONAL - Can use existing account that hasn't accepted codes
- **Why:** Tests the full acceptance flow from scratch
- **Alternative:** Use existing account that's never accepted an invite

### 4. **Self-Invite Prevention** ⚠️
- **What to test:** User can't accept invite to own project
- **New account needed:** ❌ NO - Can test with existing accounts
- **How:**
  1. User A generates code for their own project
  2. User A tries to accept it → Should fail with "own project" error

---

## 🧪 **Quick Testing Checklist (Existing Accounts)**

### Test 1: Race Condition
- [ ] User A generates code
- [ ] User B and User C both try to accept simultaneously
- [ ] Only one succeeds, others get error

### Test 2: Permission Checks
- [ ] Owner can generate codes ✅
- [ ] Member with share permission can generate codes ✅
- [ ] Member without share permission cannot generate codes ✅
- [ ] "Share Project" button visibility matches permissions ✅

### Test 3: Firebase Rules
- [ ] Unauthorized user cannot create codes ✅
- [ ] Unauthorized user cannot delete codes ✅
- [ ] Unauthorized user cannot create pending invites ✅
- [ ] Users can only access their own notifications/sharedChats ✅

### Test 4: Expiration
- [ ] Create expired code in Firebase Console
- [ ] Try to accept → Should show "expired" error ✅

### Test 5: Rate Limiting
- [ ] Generate 10 codes → Should work ✅
- [ ] Try 11th code → Should show rate limit error ✅
- [ ] Try accepting 10 invalid codes → Should show rate limit ✅

### Test 6: Error Handling
- [ ] Check console for cleanup messages on errors
- [ ] Verify no orphaned data in Firebase

---

## 🆕 **Testing That Requires New Accounts**

### Test 1: Complete Signup Flow
- [ ] Create new account with invite code
- [ ] Verify user is added to project automatically
- [ ] Verify reverse mapping is created

### Test 2: Pending Invites
- [ ] Send email invite to non-existent user
- [ ] Verify pending invite is created
- [ ] New user signs up with invite token
- [ ] Verify user is added to project

### Test 3: First-Time Acceptance
- [ ] New user accepts invite code
- [ ] Verify all steps complete successfully
- [ ] Verify project appears in shared projects

---

## 💡 **Pro Tips for Testing**

### Use Browser DevTools
1. **Clear localStorage for rate limiting:**
   ```javascript
   // In console
   localStorage.removeItem('inviteCodeGen_company@example,com_projectId');
   localStorage.removeItem('inviteCodeAccept_user@example,com');
   ```

2. **Manually create expired code:**
   ```javascript
   // In Firebase Console or via code
   // Set expiresAt to past date
   ```

3. **Test Firebase rules directly:**
   ```javascript
   // In console
   import { getDatabase, ref, set } from 'firebase/database';
   const db = getDatabase();
   // Try unauthorized operations
   ```

### Use Multiple Browser Windows
- Open 2-3 windows with different accounts
- Test race conditions by clicking simultaneously
- Test permission checks with different user roles

### Use Incognito Mode
- Test new user signup without creating actual new accounts
- Use temporary emails or test accounts

---

## 📊 **Summary**

**Can test with existing accounts:** ~90% of security fixes
- ✅ Race condition
- ✅ Transactional guarantees
- ✅ Firebase rules
- ✅ Permission checks
- ✅ Expiration
- ✅ Rate limiting (with localStorage clearing)
- ✅ Audit logging
- ✅ Error handling

**Requires new accounts:** ~10% of tests
- ⚠️ Complete signup flow
- ⚠️ Pending invites (new users)
- ⚠️ First-time acceptance (optional)

**Recommendation:** 
- Use **existing accounts** for most testing
- Create **1-2 new test accounts** for signup flow testing
- Use **incognito mode** for additional test scenarios

---

## 🚀 **Quick Start Testing**

1. **With 2 existing accounts:**
   - Test race condition ✅
   - Test permission checks ✅
   - Test Firebase rules ✅
   - Test rate limiting (clear localStorage first) ✅

2. **With 1 new account:**
   - Test complete signup flow ✅
   - Test pending invites ✅
   - Test first-time acceptance ✅

**You can test almost everything with existing accounts!** Only the signup flow requires new accounts.
