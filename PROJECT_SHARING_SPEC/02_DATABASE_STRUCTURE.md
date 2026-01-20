# Project-Level Sharing: Database Structure

## Overview

This document describes all Firebase Realtime Database paths and data structures used for project-level sharing.

---

## 1. Project Membership Storage

**Path:** `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}`

**Structure:**
```json
{
  "role": "owner" | "member",
  "joinedAt": "2025-11-29T12:00:00.000Z",
  "email": "user@example.com"
}
```

**Purpose:** This is the **source of truth** for who has access to a project. When a user accepts a project invite, they are added here as a `member` with `role: "member"`. The project creator is automatically added as `role: "owner"`.

**Access Rules:**
- Users can read their own membership entry
- Users can write their own membership entry (for accepting invites)
- Project owners can read/write all memberships

**Example:**
```
Companies/owner@example,com/projects/Marketing/members/invited@example,com
  role: "member"
  joinedAt: "2025-11-29T12:00:00.000Z"
  email: "invited@example.com"
```

---

## 2. Reverse Mapping for Quick Lookup

**Path:** `emailToSharedProjects/{userEmail}/{ownerCompany}/{projectId}`

**Structure:**
```json
{
  "projectId": "Marketing",
  "ownerCompany": "owner@example,com",
  "joinedAt": "2025-11-29T12:00:00.000Z"
}
```

**Purpose:** This allows the UI to quickly list all projects shared with a user without querying every company. When a user accepts an invite, an entry is created here. This is used to populate the "Shared Projects" tab in the UI.

**Access Rules:**
- Users can only read/write their own entries under `emailToSharedProjects/{theirEmail}`

**Example:**
```
emailToSharedProjects/invited@example,com/owner@example,com/Marketing
  projectId: "Marketing"
  ownerCompany: "owner@example,com"
  joinedAt: "2025-11-29T12:00:00.000Z"
```

**Data Structure Returned:**
When fetching `emailToSharedProjects/{userEmail}`, Firebase returns:
```json
{
  "owner@example,com": {
    "Marketing": {
      "projectId": "Marketing",
      "ownerCompany": "owner@example,com",
      "joinedAt": "2025-11-29T12:00:00.000Z"
    }
  }
}
```

This needs to be transformed into an array for the UI:
```javascript
[
  {
    projectId: "Marketing",
    ownerCompany: "owner@example,com",
    joinedAt: "2025-11-29T12:00:00.000Z"
  }
]
```

---

## 3. Invite Codes Storage

**Path:** `inviteCodes/{code}`

**Structure:**
```json
{
  "type": "project",
  "projectId": "Marketing",
  "companyEmail": "owner@example,com",
  "createdBy": "owner@example.com",
  "createdAt": "2025-11-29T12:00:00.000Z"
}
```

**Purpose:** Stores single-use invite codes. When a project owner generates a code, it's saved here. When a user accepts the code, it's deleted (single-use).

**Access Rules:**
- Anyone can read invite codes (to validate them)
- Authenticated users can write invite codes (to create them)

**Example:**
```
inviteCodes/ABC123XY
  type: "project"
  projectId: "Marketing"
  companyEmail: "owner@example,com"
  createdBy: "owner@example.com"
  createdAt: "2025-11-29T12:00:00.000Z"
```

**Important Notes:**
- Codes are 8 characters, alphanumeric, uppercase
- Codes are single-use (deleted after acceptance)
- `type: "project"` distinguishes from company-level invites
- `companyEmail` uses comma notation (dots replaced by commas)

---

## 4. Company Ownership (Unchanged)

**Path:** `emailToCompanyDirectory/{userEmail}`

**Structure:**
```json
"owner@example,com"
```

**Purpose:** Maps a user's email to their company email. This determines which company they "own" and which projects they can access by default (all projects in their company).

**Critical Note:** This should **NEVER** be changed when accepting project invites. Users stay in their own company.

**Example:**
```
emailToCompanyDirectory/user@example,com
  Value: "user@example,com"
```

**Important:**
- When User B accepts a project invite from User A, User B's `emailToCompanyDirectory` entry remains unchanged
- User B stays in their own company
- User B only gains access to the specific shared project via the `members` node

---

## Data Flow Summary

### When User A Shares a Project:
1. Generate code: `ABC123XY`
2. Save to: `inviteCodes/ABC123XY` with project info

### When User B Accepts Invite:
1. Read: `inviteCodes/ABC123XY` to get project info
2. Write: `Companies/{ownerCompany}/projects/{projectId}/members/{userEmail}` (add as member)
3. Write: `emailToSharedProjects/{userEmail}/{ownerCompany}/{projectId}` (reverse mapping)
4. Delete: `inviteCodes/ABC123XY` (single-use)

### When User B Views Shared Projects:
1. Read: `emailToSharedProjects/{userEmail}` to get all shared projects
2. Transform nested object into array for UI display

### When User B Accesses Shared Project Data:
1. Read: `Companies/{ownerCompany}/projects/{projectId}/groqChats/...`
2. Read: `Companies/{ownerCompany}/projects/{projectId}/highlights/...`
3. Firebase rules check: Is user a member? (via `members/{userEmail}`)

---

## Email Path Notation

**Important:** Firebase Realtime Database doesn't allow dots (`.`) in keys, so email addresses are converted:
- `user@example.com` → `user@example,com` (dots replaced with commas)

**Conversion Functions:**
- To Firebase path: `email.replace(/\./g, ',')`
- From Firebase path: `emailPath.replace(/,/g, '.')`

**Examples:**
- `owner@example.com` → `owner@example,com`
- `user.name@company.co.uk` → `user,name@company,co,uk`
