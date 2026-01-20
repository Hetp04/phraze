# Project-Level Sharing: ChatSidebar Component Specification

## Overview

This document specifies how to modify the `ChatSidebar` component to support the "Shared Projects" tab, loading shared projects, and accepting invite codes.

---

## Current ChatSidebar

**Location:** `src/components/ChatSidebar.jsx`

**Current Features:**
- Project dropdown/selector
- "Private Projects" tab (or similar)
- List of user's own projects
- Project creation functionality

---

## Required Modifications

### 1. Add Shared Projects Tab

**Tab Structure:**
- Two tabs: "Private Projects" (default) and "Shared Projects"
- Tabs should be clearly labeled and switchable
- Use existing tab styling/component if available

**Implementation:**
```javascript
const [projectTab, setProjectTab] = useState('private'); // 'private' or 'shared'

// Tab buttons
<div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
  <button
    onClick={() => setProjectTab('private')}
    style={{
      padding: '8px 16px',
      background: projectTab === 'private' ? '#111827' : 'transparent',
      color: projectTab === 'private' ? '#ffffff' : '#6b7280',
      border: 'none',
      borderRadius: '8px 8px 0 0',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: 600
    }}
  >
    Private Projects
  </button>
  <button
    onClick={() => setProjectTab('shared')}
    style={{
      padding: '8px 16px',
      background: projectTab === 'shared' ? '#111827' : 'transparent',
      color: projectTab === 'shared' ? '#ffffff' : '#6b7280',
      border: 'none',
      borderRadius: '8px 8px 0 0',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: 600
    }}
  >
    Shared Projects
  </button>
</div>
```

### 2. Add Shared Projects State

**State Variables:**
```javascript
const [sharedProjects, setSharedProjects] = useState([]);
const [inviteCodeInput, setInviteCodeInput] = useState('');
```

- `sharedProjects`: Array of shared project objects
- `inviteCodeInput`: String for the invite code input field

### 3. Load Shared Projects

**useEffect Hook:**
```javascript
useEffect(() => {
  const loadSharedProjects = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) return;
    
    try {
      const userEmailPath = user.email.replace(/\./g, ',');
      const sharedProjectsData = await getFirebaseData(`emailToSharedProjects/${userEmailPath}`);
      
      if (sharedProjectsData) {
        const shared = [];
        // sharedProjectsData structure: { companyEmail: { projectId: {...} } }
        for (const [ownerCompany, projects] of Object.entries(sharedProjectsData)) {
          for (const [projectId, projectInfo] of Object.entries(projects)) {
            shared.push({
              projectId,
              ownerCompany,
              ...projectInfo
            });
          }
        }
        setSharedProjects(shared);
        console.log('Loaded shared projects:', shared);
      } else {
        setSharedProjects([]);
      }
    } catch (err) {
      console.error('Failed to load shared projects:', err);
      setSharedProjects([]);
    }
  };
  
  if (isLoggedIn) {
    loadSharedProjects();
  }
}, [isLoggedIn]);
```

**When to Load:**
- On component mount
- When user logs in
- After accepting an invite (page reload handles this)

### 4. Shared Projects Tab Content

**If `sharedProjects.length === 0` (No shared projects):**

**Display:**
```javascript
<div style={{ padding: '20px 12px', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
  <p style={{ margin: '0 0 16px 0' }}>No shared projects yet</p>
  
  {/* Join a shared project section */}
  <div style={{
    padding: '12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#fafafa',
    marginTop: '12px'
  }}>
    <div style={{
      fontSize: '0.85rem',
      fontWeight: 600,
      marginBottom: '8px',
      color: '#374151'
    }}>
      Join a shared project
    </div>
    <input
      type="text"
      value={inviteCodeInput}
      onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
      placeholder="Enter invite code"
      style={{
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '13px',
        marginBottom: '8px',
        boxSizing: 'border-box'
      }}
    />
    <button
      onClick={handleAcceptInvite}
      style={{
        width: '100%',
        background: '#111827',
        color: '#ffffff',
        border: 'none',
        padding: '10px 12px',
        borderRadius: '8px',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer'
      }}
    >
      Join Project
    </button>
  </div>
</div>
```

**If `sharedProjects.length > 0` (Has shared projects):**

**Display:**
```javascript
<div style={{ padding: '12px' }}>
  {/* Join a shared project section (same as above, at top) */}
  
  {/* Shared projects list */}
  <div style={{ marginTop: '12px' }}>
    <div style={{
      fontSize: '0.75rem',
      fontWeight: 600,
      color: '#6b7280',
      padding: '8px 4px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    }}>
      Shared with you
    </div>
    {sharedProjects.map((proj) => (
      <button
        key={`${proj.ownerCompany}-${proj.projectId}`}
        onClick={() => handleSelectSharedProject(proj)}
        style={{
          width: '100%',
          background: 'transparent',
          color: '#111',
          border: 'none',
          outline: 'none',
          padding: '10px 12px',
          fontSize: '0.9rem',
          textAlign: 'left',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          position: 'relative'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        {selectedProject === proj.projectId && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.25">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
        <span style={{ flex: 1 }}>{proj.projectId}</span>
        <span style={{
          fontSize: '0.7rem',
          color: '#9ca3af',
          background: '#f3f4f6',
          padding: '2px 6px',
          borderRadius: '4px'
        }}>
          shared
        </span>
      </button>
    ))}
  </div>
</div>
```

### 5. Handle Accept Invite

**Function:**
```javascript
const handleAcceptInvite = async () => {
  const code = inviteCodeInput.trim();
  if (!code) {
    showToast('Please enter an invite code', 'error');
    return;
  }
  
  try {
    const { acceptProjectInviteCode } = await import('../funcs');
    const success = await acceptProjectInviteCode(code);
    if (success) {
      setInviteCodeInput(''); // Clear input
      // Page will reload after acceptProjectInviteCode completes
    }
  } catch (err) {
    console.error('Failed to accept invite:', err);
    showToast('Failed to accept invite', 'error');
  }
};
```

### 6. Handle Select Shared Project

**Function:**
```javascript
const handleSelectSharedProject = (proj) => {
  // Set selected project
  setSelectedProject(proj.projectId);
  
  // Store owner company for data loading
  localStorage.setItem('sharedCompanyEmail', proj.ownerCompany);
  localStorage.setItem('currentProject', proj.projectId);
  
  // Close dropdown if open
  setDropdownOpen(false);
  
  // Trigger project change callback
  if (onProjectChange) {
    onProjectChange(proj.projectId);
  }
  
  // The main app should load data from:
  // Companies/{proj.ownerCompany}/projects/{proj.projectId}/
};
```

### 7. Project Creation - Add Owner Membership

**When creating a new project, automatically add creator as owner:**

```javascript
const handleCreateNewProject = async (projectName) => {
  // ... existing project creation code ...
  
  // After project is created, add creator as owner member
  try {
    const userEmailPath = (auth.currentUser?.email || '').replace(/\./g, ',');
    if (userEmailPath && auth.currentUser?.email) {
      const memberRef = ref(database, `Companies/${companyEmail}/projects/${projectName}/members/${userEmailPath}`);
      await set(memberRef, { 
        role: 'owner', 
        joinedAt: new Date().toISOString(),
        email: auth.currentUser.email
      });
      console.log(`Added creator as owner member of project: ${projectName}`);
    }
  } catch (e) {
    console.warn('Failed to add project owner membership', e);
  }
  
  // ... rest of project creation code ...
};
```

---

## Complete Tab Rendering Structure

```javascript
{/* Tabs */}
<div style={{ /* tab container styles */ }}>
  <button onClick={() => setProjectTab('private')}>Private Projects</button>
  <button onClick={() => setProjectTab('shared')}>Shared Projects</button>
</div>

{/* Tab Content */}
{projectTab === 'private' && (
  <div>
    {/* Existing private projects list */}
    {projects.map((proj) => (
      // ... existing project item ...
    ))}
  </div>
)}

{projectTab === 'shared' && (
  <div>
    {/* Join section */}
    <div>
      <input value={inviteCodeInput} onChange={...} />
      <button onClick={handleAcceptInvite}>Join Project</button>
    </div>
    
    {/* Shared projects list */}
    {sharedProjects.length > 0 && (
      <div>
        <div>Shared with you</div>
        {sharedProjects.map((proj) => (
          <button onClick={() => handleSelectSharedProject(proj)}>
            {proj.projectId}
            <span>shared</span>
          </button>
        ))}
      </div>
    )}
  </div>
)}
```

---

## Import Requirements

**Add to imports:**
```javascript
import { getFirebaseData, showToast } from '../funcs';
import { ref, set } from 'firebase/database';
import { database } from '../firebase-init'; // or wherever database is imported
```

**Dynamic import for acceptProjectInviteCode:**
```javascript
const { acceptProjectInviteCode } = await import('../funcs');
```

---

## State Management

**Initial State:**
- `sharedProjects`: []
- `inviteCodeInput`: ''
- `projectTab`: 'private'

**After Loading Shared Projects:**
- `sharedProjects`: Array of project objects

**After Accepting Invite:**
- Page reloads (handled by `acceptProjectInviteCode`)
- Shared projects reload on mount

**When Selecting Shared Project:**
- `selectedProject`: projectId
- `localStorage.setItem('sharedCompanyEmail', ownerCompany)`
- `localStorage.setItem('currentProject', projectId)`

---

## Data Loading Context

**When user selects a private project:**
- Load from: `Companies/{userCompanyEmail}/projects/{projectId}/`
- Clear `sharedCompanyEmail` from localStorage

**When user selects a shared project:**
- Load from: `Companies/{ownerCompany}/projects/{projectId}/`
- Get `ownerCompany` from `sharedProjects` array or localStorage
- Store `sharedCompanyEmail` in localStorage

See `08_DATA_LOADING_AND_CONTEXT.md` for more details.

---

## Testing Checklist

- [ ] "Shared Projects" tab appears
- [ ] Tab switching works
- [ ] Shared projects load on mount
- [ ] Empty state shows when no shared projects
- [ ] "Join a shared project" section appears
- [ ] Invite code input accepts text
- [ ] "Join Project" button calls acceptProjectInviteCode
- [ ] Shared projects list displays correctly
- [ ] Clicking shared project selects it
- [ ] Owner company is tracked correctly
- [ ] Project creation adds owner membership
