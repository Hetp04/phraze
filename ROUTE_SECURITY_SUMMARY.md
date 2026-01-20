# Route Security & State Management Summary

## Overview
This document outlines the comprehensive route protection and state management system implemented in the Phraze application.

## Authentication States

### Core States (App.jsx - AuthRedirectHandler)
1. **authChecked** - Has Firebase auth initialization completed?
2. **isAuthenticated** - Is there a logged-in user?
3. **whitelistChecked** - Have we verified whitelist status?
4. **onboardingChecked** - Have we verified onboarding completion?
5. **onboardingCompleted** - Has the user completed onboarding?

### Race Condition Prevention
- **checkInProgressRef** - Prevents multiple simultaneous auth checks
- **profileFetchedRef** (Navbar) - Prevents duplicate profile fetches

## Route Categories

### 1. Truly Public Routes (No Auth Required)
- `/` - Home page
- `/features` - Features page
- `/about` - About page
- `/contact` - Contact page
- `/terms` - Terms of service
- `/privacy` - Privacy policy
- `/cookies` - Cookie policy

### 2. Protected Routes (Require Auth + Whitelist + Onboarding)
- `/demonstration` - Main app
- `/profile` - User profile

### 3. Auth-Only Routes
- `/auth` - Login/Signup (only for non-authenticated users)
- `/onboarding` - Onboarding flow (only for authenticated users who haven't completed it)
- `/access-denied` - Whitelist waiting page

## Security Rules

### For Authenticated Users:
1. ✅ **Cannot access `/auth`** - Redirected to `/demonstration`
2. ✅ **Cannot access `/onboarding` if completed** - Redirected to `/demonstration`
3. ✅ **Cannot access protected routes without whitelist** - Redirected to `/access-denied`
4. ✅ **Cannot access protected routes without completing onboarding** - Redirected to `/onboarding`
5. ✅ **Can access truly public routes (including home `/`)** - Always allowed, no forced redirects

### For Non-Authenticated Users:
1. ✅ **Cannot access `/demonstration`** - Redirected to `/auth`
2. ✅ **Cannot access `/profile`** - Redirected to `/auth`
3. ✅ **Cannot access `/onboarding`** - Redirected to `/auth`
4. ✅ **Can access `/auth`** - Login/Signup page
5. ✅ **Can access truly public routes** - Always allowed

## Render Guards (Prevent Flash)

### Blocking Conditions:
- **Block ALL routes** until `authChecked === true`
- **Block authenticated routes** until `whitelistChecked === true`
- **Block protected routes** until `onboardingChecked === true`
- **Block `/auth`** for authenticated users (will redirect)
- **Block `/onboarding`** for users who completed it (will redirect)
- **Block protected routes** for users without completed onboarding (will redirect)
- **Block `/onboarding` and protected routes** for non-authenticated users (will redirect)

### Result:
- **No flash of wrong pages** - pages don't render until all checks pass
- **Smooth redirects** - users see blank screen briefly, then correct page
- **Professional UX** - no visual glitches or unauthorized page views

## User Flows

### New User Signup (Email/Password):
1. Visit `/` or `/auth`
2. Fill first name, last name, email, password
3. Submit → Account created
4. → Whitelist check
5. → If whitelisted: `/onboarding`
6. → If not whitelisted: `/access-denied`
7. Complete onboarding → `/demonstration`

### New User Signup (Google):
1. Visit `/` or `/auth`
2. Click "Sign in with Google"
3. Google popup → Account created
4. firstName/lastName extracted from Google displayName
5. → Whitelist check
6. → If whitelisted: `/onboarding`
7. → If not whitelisted: `/access-denied`
8. Complete onboarding → `/demonstration`

### Existing User Login (Email/Password):
1. Visit `/` or `/auth`
2. Enter credentials
3. → Whitelist check
4. → Onboarding check
5. → If completed: `/demonstration`
6. → If not completed: `/onboarding`

### Existing User Login (Google):
1. Visit `/` or `/auth`
2. Click "Sign in with Google"
3. → Check if user exists in `emailToCompanyDirectory`
4. → If exists: Fetch user data
5. → Check onboarding status
6. → If completed: `/demonstration`
7. → If not completed: `/onboarding`
8. **Does NOT call finishSignUp** (prevents overwriting data)

### Logged-In User Navigation:
- ✅ Can visit public pages (`/`, `/features`, `/about`, etc.) - **No forced redirects from home page**
- ✅ Can visit `/demonstration` and `/profile` (if onboarding completed)
- ❌ **Cannot** visit `/auth` (auto-redirected to `/demonstration`)
- ❌ **Cannot** visit `/onboarding` if completed (auto-redirected to `/demonstration`)
- ❌ **Cannot** visit protected routes without completing onboarding (redirected to `/onboarding`)

## Profile Picture & Avatar System

### Initials Logic (Consistent Everywhere):
1. **First priority:** firstName + lastName initials (e.g., "John Doe" → "JD")
2. **Second priority:** If only firstName, use first letter twice (e.g., "John" → "JJ")
3. **Fallback:** Email initials (e.g., "user@email.com" → "US")

### Color Logic (Consistent Everywhere):
```javascript
backgroundColor: `hsl(${(email.charCodeAt(0) * 10) % 360}, 60%, 70%)`
```
- **Always based on email** for consistency
- Same user = same color everywhere

### Profile Picture Priority:
1. **Custom uploaded image** (if exists in Firebase)
2. **Initials avatar** (if no custom image)
3. **Never uses Google photos** (removed completely)

### Components Using Avatars:
- Navbar → ProfileDropdown
- ChatSidebar → SidebarProfileDropdown
- AccountSettingsModal
- Onboarding page
- Demonstration page (chat messages)

## Data Storage

### Firebase Structure:
```
Companies/
  {companyEmail}/
    users/
      {userEmail}/
        name: "username"
        firstName: "John"
        lastName: "Doe"
        email: "user@example.com"
        bio: "User bio"
        profileImage: "data:image/png;base64,..."
        onboardingCompleted: true
        createdAt: "2024-01-01T00:00:00.000Z"
```

### Key Fields:
- **name** - Username (for display)
- **firstName** - User's first name (from signup or Google)
- **lastName** - User's last name (from signup or Google)
- **profileImage** - Base64 encoded custom uploaded image (optional)
- **onboardingCompleted** - Boolean flag for onboarding status

## Security Best Practices Implemented

1. ✅ **No unauthorized route access** - All routes properly protected
2. ✅ **No flash of protected content** - Render guards prevent premature rendering
3. ✅ **Race condition prevention** - Refs prevent duplicate checks
4. ✅ **Proper state management** - Clear separation of concerns
5. ✅ **Existing user detection** - Google sign-in doesn't overwrite data
6. ✅ **Consistent avatar system** - Same initials and colors everywhere
7. ✅ **No Google photo leakage** - Completely removed from app
8. ✅ **Profile picture persistence** - Uploaded images saved to Firebase
9. ✅ **Whitelist enforcement** - Non-whitelisted users cannot access app
10. ✅ **Onboarding enforcement** - Users must complete onboarding before accessing app
11. ✅ **Navbar whitelist check** - Non-whitelisted users see login button, not profile dropdown

## Testing Checklist

### As Non-Authenticated User:
- [ ] Can access public routes (/, /features, /about, etc.)
- [ ] Can access /auth
- [ ] Cannot access /demonstration (redirected to /auth)
- [ ] Cannot access /profile (redirected to /auth)
- [ ] Cannot access /onboarding (redirected to /auth)

### As Authenticated, Whitelisted, Onboarding-Incomplete User:
- [ ] Can access public routes
- [ ] Cannot access /auth (redirected to /demonstration or /onboarding)
- [ ] Can access /onboarding
- [ ] Cannot access /demonstration (redirected to /onboarding)
- [ ] Cannot access /profile (redirected to /onboarding)

### As Authenticated, Whitelisted, Onboarding-Complete User:
- [ ] Can access public routes
- [ ] Cannot access /auth (redirected to /demonstration)
- [ ] Cannot access /onboarding (redirected to /demonstration)
- [ ] Can access /demonstration
- [ ] Can access /profile
- [ ] Sees consistent avatar (same initials, same color) everywhere

### As Authenticated, Non-Whitelisted User:
- [ ] Can access public routes
- [ ] Cannot access /auth (redirected to /demonstration)
- [ ] Can access /access-denied
- [ ] Cannot access /demonstration (redirected to /access-denied)
- [ ] Cannot access /profile (redirected to /access-denied)
- [ ] Cannot access /onboarding (redirected to /access-denied)
- [ ] **Navbar shows "Login" button** (not profile dropdown) - user is not approved yet

## Known Issues & Limitations

### Browser Warnings (Non-Critical):
- **Cross-Origin-Opener-Policy warnings** during Google sign-in popup - These are normal Firebase Auth warnings and don't affect functionality

### Future Improvements:
- Consider adding loading spinner during auth checks instead of blank screen
- Consider adding error boundary for better error handling
- Consider adding session timeout handling
- Consider adding "remember me" functionality

