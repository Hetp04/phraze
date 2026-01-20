# Project-Level Sharing: Firebase Database Rules

## Overview

This document describes all Firebase Realtime Database security rules required for project-level sharing. These rules enforce that users can only access projects they own or are explicitly members of.

---

## 1. Projects Listing Restriction

**Rule:** Users can only list projects from their own company.

**Path:** `Companies/{companyId}/projects`

**Implementation:**
```json
"projects": {
  ".read": "auth.uid != null && root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId",
  ".write": "auth.uid != null && root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId"
}
```

**Why:** This prevents users from seeing all projects in other companies. They can only see projects in their own company by default.

**What This Means:**
- User A can list projects in their own company
- User A cannot list projects in User B's company
- User A can still access specific shared projects (via individual project access rules below)

---

## 2. Individual Project Access

**Rule:** Users can access a specific project if they are either:
- The owner of the company (via `emailToCompanyDirectory`)
- A member of the project (via `members/{userEmail}`)

**Path:** `Companies/{companyId}/projects/{projectId}/groqChats`, `highlights`, `annotationHistory`, etc.

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

**What This Means:**
- User A (owner) can access all their company's projects
- User B (member) can access only the specific project they're a member of
- User B cannot access other projects in User A's company
- Both User A and User B can read/write to the shared project in real-time

**Rule Breakdown:**
- `root.child('Companies').child($companyId).child('projects').child($projectId).child('members').child(auth.token.email.replace('.', ',')).exists()` - Checks if user is a member
- `root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId` - Checks if user owns the company

---

## 3. Members Node Access

**Rule:** Users can read their own membership and write their own membership (to accept invites).

**Path:** `Companies/{companyId}/projects/{projectId}/members/{userEmail}`

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

**What This Means:**
- User B can write their own entry when accepting an invite
- User B can read their own entry to check membership status
- User B cannot write other users' membership entries
- Project owners can read all members (via the project-level read rule)

---

## 4. Shared Projects Reverse Mapping

**Rule:** Users can only read/write their own entries.

**Path:** `emailToSharedProjects/{userEmail}`

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

**What This Means:**
- User B can read `emailToSharedProjects/{userBEmail}` to see all their shared projects
- User B can write to `emailToSharedProjects/{userBEmail}/{company}/{project}` when accepting an invite
- User B cannot read/write other users' entries

---

## 5. Invite Codes Access

**Path:** `inviteCodes/{code}`

**Implementation:**
```json
"inviteCodes": {
  ".read": "true",
  ".write": "auth.uid != null"
}
```

**Why:** 
- Anyone can read invite codes (to validate them during acceptance)
- Only authenticated users can create invite codes

**What This Means:**
- User B can read an invite code to validate it
- User A can create invite codes
- User B cannot create invite codes (must be authenticated, but this is fine)

---

## Complete Rules Example

Here's how the rules work together:

```json
{
  "rules": {
    "Companies": {
      "$companyId": {
        "projects": {
          ".read": "auth.uid != null && root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId",
          ".write": "auth.uid != null && root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId",
          "$projectId": {
            "members": {
              "$userEmail": {
                ".read": "auth.uid != null",
                ".write": "auth.uid != null && auth.token.email.replace('.', ',') == $userEmail"
              }
            },
            "groqChats": {
              ".read": "auth.uid != null && (root.child('Companies').child($companyId).child('projects').child($projectId).child('members').child(auth.token.email.replace('.', ',')).exists() || root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId)",
              ".write": "auth.uid != null && (root.child('Companies').child($companyId).child('projects').child($projectId).child('members').child(auth.token.email.replace('.', ',')).exists() || root.child('emailToCompanyDirectory').child(auth.token.email.replace('.', ',')).val() == $companyId)"
            }
            // ... other project data paths with same rule
          }
        }
      }
    },
    "emailToSharedProjects": {
      "$userEmail": {
        ".read": "auth.uid != null && auth.token.email.replace('.', ',') == $userEmail",
        "$company": {
          "$project": {
            ".write": "auth.uid != null && auth.token.email.replace('.', ',') == $userEmail"
          }
        }
      }
    },
    "inviteCodes": {
      ".read": "true",
      ".write": "auth.uid != null"
    }
  }
}
```

---

## Testing Rules

**Test in Firebase Console Rules Playground:**

1. **Test: Owner can list their own projects**
   - User: `owner@example.com`
   - Path: `Companies/owner@example,com/projects`
   - Expected: ✅ Read allowed

2. **Test: Member cannot list owner's projects**
   - User: `member@example.com`
   - Path: `Companies/owner@example,com/projects`
   - Expected: ❌ Read denied

3. **Test: Member can access shared project data**
   - User: `member@example.com`
   - Path: `Companies/owner@example,com/projects/Marketing/groqChats`
   - Expected: ✅ Read allowed (if member exists)

4. **Test: Member cannot access other projects**
   - User: `member@example.com`
   - Path: `Companies/owner@example,com/projects/Engineering/groqChats`
   - Expected: ❌ Read denied (if not a member)

5. **Test: User can write their own membership**
   - User: `member@example.com`
   - Path: `Companies/owner@example,com/projects/Marketing/members/member@example,com`
   - Expected: ✅ Write allowed

6. **Test: User cannot write others' membership**
   - User: `member@example.com`
   - Path: `Companies/owner@example,com/projects/Marketing/members/other@example,com`
   - Expected: ❌ Write denied
