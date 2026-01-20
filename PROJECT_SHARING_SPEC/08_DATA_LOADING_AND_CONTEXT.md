# Project-Level Sharing: Data Loading and Context Switching

## Overview

This document describes how the application should handle loading project data when switching between private projects and shared projects, and how to maintain the correct Firebase path context.

---

## Project Context Types

### Private Project
- Belongs to the user's own company
- Path: `Companies/{userCompanyEmail}/projects/{projectId}/`
- User is the owner (via `emailToCompanyDirectory`)

### Shared Project
- Belongs to another user's company
- Path: `Companies/{ownerCompany}/projects/{projectId}/`
- User is a member (via `members/{userEmail}`)

---

## When User Selects a Private Project

### Context Setup

1. **Get User's Company:**
   ```javascript
   const userCompanyEmail = localStorage.getItem('companyEmail');
   // Or fetch from emailToCompanyDirectory if not in localStorage
   ```

2. **Clear Shared Context:**
   ```javascript
   localStorage.removeItem('sharedCompanyEmail');
   ```

3. **Set Current Project:**
   ```javascript
   localStorage.setItem('currentProject', projectId);
   ```

### Data Loading Path

**Base Path:**
```
Companies/{userCompanyEmail}/projects/{projectId}/
```

**Data Paths:**
- Chats: `Companies/{userCompanyEmail}/projects/{projectId}/groqChats/`
- Highlights: `Companies/{userCompanyEmail}/projects/{projectId}/highlights/`
- Annotations: `Companies/{userCompanyEmail}/projects/{projectId}/annotationHistory/`
- Categories: `Companies/{userCompanyEmail}/projects/{projectId}/categoriesImages/`
- Labels: `Companies/{userCompanyEmail}/projects/{projectId}/customLabelsAndCodes/`
- Manual Logging: `Companies/{userCompanyEmail}/projects/{projectId}/manualLoggingCategories/`

### Firebase Listeners

**Setup:**
```javascript
const projectPath = `Companies/${userCompanyEmail}/projects/${projectId}`;

// Listen to chats
const chatsRef = ref(database, `${projectPath}/groqChats`);
onValue(chatsRef, (snapshot) => {
  // Update chats state
});

// Listen to highlights
const highlightsRef = ref(database, `${projectPath}/highlights`);
onValue(highlightsRef, (snapshot) => {
  // Update highlights state
});

// ... other listeners
```

---

## When User Selects a Shared Project

### Context Setup

1. **Get Owner Company:**
   ```javascript
   // From sharedProjects array
   const sharedProject = sharedProjects.find(p => p.projectId === projectId);
   const ownerCompany = sharedProject.ownerCompany;
   
   // Or from localStorage if already stored
   const ownerCompany = localStorage.getItem('sharedCompanyEmail');
   ```

2. **Store Shared Context:**
   ```javascript
   localStorage.setItem('sharedCompanyEmail', ownerCompany);
   localStorage.setItem('currentProject', projectId);
   ```

3. **Track Project Type:**
   ```javascript
   localStorage.setItem('projectType', 'shared'); // Optional, for tracking
   ```

### Data Loading Path

**Base Path:**
```
Companies/{ownerCompany}/projects/{projectId}/
```

**Data Paths:**
- Chats: `Companies/{ownerCompany}/projects/{projectId}/groqChats/`
- Highlights: `Companies/{ownerCompany}/projects/{projectId}/highlights/`
- Annotations: `Companies/{ownerCompany}/projects/{projectId}/annotationHistory/`
- Categories: `Companies/{ownerCompany}/projects/{projectId}/categoriesImages/`
- Labels: `Companies/{ownerCompany}/projects/{projectId}/customLabelsAndCodes/`
- Manual Logging: `Companies/{ownerCompany}/projects/{projectId}/manualLoggingCategories/`

### Firebase Listeners

**Setup:**
```javascript
const projectPath = `Companies/${ownerCompany}/projects/${projectId}`;

// Listen to chats
const chatsRef = ref(database, `${projectPath}/groqChats`);
onValue(chatsRef, (snapshot) => {
  // Update chats state
});

// Listen to highlights
const highlightsRef = ref(database, `${projectPath}/highlights`);
onValue(highlightsRef, (snapshot) => {
  // Update highlights state
});

// ... other listeners
```

**Important:** The listeners point to the owner's company path, not the user's company path.

---

## Helper Function: Get Current Project Path

**Create a utility function to get the correct project path:**

```javascript
function getCurrentProjectPath(projectId) {
  const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
  
  if (sharedCompanyEmail) {
    // Shared project
    return `Companies/${sharedCompanyEmail}/projects/${projectId}`;
  } else {
    // Private project
    const userCompanyEmail = localStorage.getItem('companyEmail');
    return `Companies/${userCompanyEmail}/projects/${projectId}`;
  }
}
```

**Usage:**
```javascript
const projectPath = getCurrentProjectPath(selectedProject);
const chatsRef = ref(database, `${projectPath}/groqChats`);
```

---

## Real-Time Synchronization

### Both Users Read/Write to Same Path

**Owner (User A) and Member (User B) both access:**
- `Companies/{ownerCompany}/projects/{projectId}/groqChats/`
- `Companies/{ownerCompany}/projects/{projectId}/highlights/`
- `Companies/{ownerCompany}/projects/{projectId}/annotationHistory/`
- etc.

### Firebase Realtime Database Listeners

**Setup listeners when project is selected:**
```javascript
useEffect(() => {
  if (!selectedProject) return;
  
  const projectPath = getCurrentProjectPath(selectedProject);
  
  // Setup all listeners
  const chatsRef = ref(database, `${projectPath}/groqChats`);
  const highlightsRef = ref(database, `${projectPath}/highlights`);
  // ... other refs
  
  const unsubscribeChats = onValue(chatsRef, (snapshot) => {
    const data = snapshot.val();
    setChats(data || {});
  });
  
  const unsubscribeHighlights = onValue(highlightsRef, (snapshot) => {
    const data = snapshot.val();
    setHighlights(data || {});
  });
  
  // ... other listeners
  
  // Cleanup
  return () => {
    unsubscribeChats();
    unsubscribeHighlights();
    // ... cleanup other listeners
  };
}, [selectedProject]);
```

### Changes Appear in Real-Time

**When User A creates a chat:**
1. Write to: `Companies/{ownerCompany}/projects/{projectId}/groqChats/{chatId}`
2. Firebase rules allow (User A is owner)
3. User B's listener receives update
4. User B's UI updates automatically

**When User B adds a highlight:**
1. Write to: `Companies/{ownerCompany}/projects/{projectId}/highlights/{highlightId}`
2. Firebase rules allow (User B is member)
3. User A's listener receives update
4. User A's UI updates automatically

---

## Switching Between Projects

### From Private to Shared

**Process:**
1. User selects shared project
2. Store `sharedCompanyEmail` in localStorage
3. Update Firebase listeners to point to owner's company path
4. Load data from owner's company path
5. UI updates with shared project data

### From Shared to Private

**Process:**
1. User selects private project
2. Remove `sharedCompanyEmail` from localStorage
3. Update Firebase listeners to point to user's company path
4. Load data from user's company path
5. UI updates with private project data

### Listener Cleanup

**Important:** Always cleanup old listeners before setting up new ones:

```javascript
useEffect(() => {
  // Cleanup previous listeners
  const cleanup = () => {
    // Unsubscribe all listeners
  };
  
  // Setup new listeners for current project
  const setup = () => {
    const projectPath = getCurrentProjectPath(selectedProject);
    // ... setup listeners
  };
  
  cleanup();
  setup();
  
  return cleanup;
}, [selectedProject]);
```

---

## Project Selection State

### Tracking Current Project

**localStorage Keys:**
- `currentProject`: Current project ID
- `sharedCompanyEmail`: Owner company (if shared project)
- `companyEmail`: User's own company (always present)

**State Variables:**
- `selectedProject`: Current project ID
- `projectType`: 'private' | 'shared' (optional, can be inferred from `sharedCompanyEmail`)

### Determining Project Type

**Function:**
```javascript
function isSharedProject(projectId) {
  const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
  if (!sharedCompanyEmail) return false;
  
  // Check if current project is in sharedProjects array
  const sharedProjects = getSharedProjects(); // From state or fetch
  return sharedProjects.some(p => p.projectId === projectId);
}
```

---

## Error Handling

### Invalid Project Path

**Scenario:** User tries to access a project they don't have access to.

**Handling:**
- Firebase rules will deny access
- Listener will receive null/error
- Show error message: "You don't have access to this project"
- Redirect to project list

### Missing Company Email

**Scenario:** `sharedCompanyEmail` is missing when accessing shared project.

**Handling:**
- Fetch from `emailToSharedProjects` to get owner company
- Store in localStorage
- Retry data loading

### Network Errors

**Scenario:** Firebase connection fails.

**Handling:**
- Show error message
- Retry connection
- Allow user to switch projects

---

## Best Practices

1. **Always cleanup listeners** when switching projects
2. **Store context in localStorage** for persistence across page reloads
3. **Validate access** before setting up listeners (check membership)
4. **Handle errors gracefully** with user-friendly messages
5. **Update UI immediately** when project context changes
6. **Use helper functions** to get correct project paths
7. **Track project type** to show appropriate UI (shared badge, etc.)

---

## Implementation Example

**Complete project selection handler:**

```javascript
const handleProjectSelect = async (projectId, isShared = false) => {
  // Determine company email
  let companyEmail;
  if (isShared) {
    const sharedProject = sharedProjects.find(p => p.projectId === projectId);
    companyEmail = sharedProject.ownerCompany;
    localStorage.setItem('sharedCompanyEmail', companyEmail);
  } else {
    companyEmail = localStorage.getItem('companyEmail');
    localStorage.removeItem('sharedCompanyEmail');
  }
  
  // Set current project
  setSelectedProject(projectId);
  localStorage.setItem('currentProject', projectId);
  
  // Setup Firebase listeners
  const projectPath = `Companies/${companyEmail}/projects/${projectId}`;
  setupProjectListeners(projectPath);
  
  // Trigger callback
  if (onProjectChange) {
    onProjectChange(projectId);
  }
};
```
