# Messages Component - Data Usage Summary

## Current Status: READ-ONLY (No Firebase Writes Yet)

The Messages component currently only **reads** from Firebase and localStorage. It does **not write** anything yet.

---

## Firebase Reads (What We're Reading)

### 1. Chat Title
- **Path**: `Companies/{companyEmail}/projects/{projectName}/groqChats/{chatId}/title`
- **Purpose**: Display the current chat's title in the topic header
- **When**: When `currentChat` changes

### 2. Messages (Last Message Preview)
- **Path**: `Companies/{companyEmail}/securedProjects/{projectName}/messages/{topic}/{emailPair}`
- **Purpose**: Get the last message for each contact to show in the contact list
- **Topics**: 
  - `general` (default)
  - `groqChats-{chatId}` (when a specific chat is selected)
- **When**: When loading contacts or when topic changes

### 3. Project Members
- **Path**: `Companies/{companyEmail}/projects/{projectName}/members`
- **Purpose**: Get list of all members in the current project to show as contacts
- **When**: When loading contacts

### 4. User Profiles
- **Path**: `Companies/{companyEmail}/users/{userEmail}`
- **Purpose**: Get user's name, firstName, lastName, profileImage
- **When**: 
  - Initial load (for each contact)
  - Real-time updates (via listeners) for profile picture changes

### 5. Hidden Contacts
- **Path**: `Companies/{companyEmail}/hiddencontacts/{userEmail}`
- **Purpose**: Filter out contacts that the user has hidden
- **When**: When loading contacts

### 6. Company Email Mapping
- **Path**: `emailToCompanyDirectory/{userEmail}`
- **Purpose**: Map user email to company email (fallback if not in localStorage)
- **When**: When resolving company email

---

## localStorage Usage

### READ Operations:

1. **`sharedCompanyEmail`**
   - **Purpose**: Company email when viewing a shared project
   - **Used in**: `getResolvedCompanyEmail()` helper

2. **`sharedProjectId`**
   - **Purpose**: Project ID when viewing a shared project
   - **Used in**: `getResolvedCompanyEmail()` helper to verify it matches current project

3. **`currentProject`**
   - **Purpose**: Current project name
   - **Used in**: `getResolvedCompanyEmail()` helper and for Firebase paths

4. **`companyEmail`**
   - **Purpose**: Cached company email for the logged-in user
   - **Used in**: `getResolvedCompanyEmail()` helper (primary source)

### WRITE Operations:

1. **`companyEmail`**
   - **When**: When we fetch it from Firebase (`emailToCompanyDirectory`) and it's not in localStorage
   - **Purpose**: Cache it for future use (performance optimization)

---

## What We're NOT Doing Yet (Future Implementation)

### Firebase Writes (Not Implemented):
- ❌ **Sending Messages**: `Companies/{companyEmail}/securedProjects/{projectName}/messages/{topic}/{emailPair}/{timestamp}`
- ❌ **Saving Drafts**: `Companies/{companyEmail}/securedProjects/{projectName}/drafts/{topic}/{emailPair}/main/{userEmail}`
- ❌ **Hiding Contacts**: `Companies/{companyEmail}/hiddencontacts/{userEmail}/{contactEmail}`
- ❌ **Updating Chat Titles**: `Companies/{companyEmail}/projects/{projectName}/groqChats/{chatId}/title`

### localStorage Writes (Not Needed):
- We only write `companyEmail` as a cache optimization
- No other localStorage writes needed

---

## Summary

**Current State**: The Messages component is **READ-ONLY**. It displays:
- Contact list from project members
- Last message previews per chat/topic
- Chat titles
- User profile information

**No Writes Needed Yet**: We don't need to write anything to Firebase until we implement:
1. Sending messages functionality
2. Draft saving functionality
3. Contact hiding functionality

**localStorage**: Only used for reading configuration (company email, project info) and caching company email for performance.
