# Project-Level Sharing: ShareModal Component Specification

## Overview

This document specifies how to modify the existing `ShareModal` component to support project-level sharing. The same component is used for both chat sharing (existing) and project sharing (new).

---

## Current ShareModal

**Location:** `src/components/ShareModal.jsx`

**Current Props:**
- `isOpen`: Boolean - Controls modal visibility
- `onClose`: Function - Called when modal should close

**Current Behavior:**
- Shows "Share Chat" title
- Has mode toggle: "Collaborative (sync)" and "Private copy (independent)"
- Shows list of users (Jin Liner, Alex Kim, Paige Lamar) in collaborative mode
- Shows email input in private mode

---

## Required Modifications

### 1. Props Update

**New Props:**
```javascript
ShareModal({ isOpen, onClose, projectId })
```

- `projectId`: Optional string. If provided, the modal is in "project sharing" mode. If not provided, it's in "chat sharing" mode (existing behavior).

### 2. State Variables

**Add to ShareModal:**
```javascript
const [inviteCode, setInviteCode] = useState(null);
const [isGenerating, setIsGenerating] = useState(false);
```

- `inviteCode`: String | null - Stores the generated invite code
- `isGenerating`: Boolean - Tracks if code generation is in progress

### 3. Conditional Rendering Logic

**If `projectId` is provided (Project Sharing Mode):**

#### 3.1 Title

**Change:**
- From: "Share Chat"
- To: `"Share Project: {projectId}"`

**Implementation:**
```javascript
<h2 id="share-modal-title" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
  {projectId ? `Share Project: ${projectId}` : 'Share Chat'}
</h2>
```

#### 3.2 Mode Toggle

**Behavior:**
- Still show both buttons: "Collaborative (sync)" and "Private copy (independent)"
- When `projectId` is provided, only "Collaborative (sync)" is functional
- "Private copy (independent)" can be disabled or hidden (optional)

**Optional Implementation:**
- Hide "Private copy" button when `projectId` is provided
- Or disable it and show tooltip: "Private copy not available for projects"

#### 3.3 Content (when `shareMode === 'collaborative'`)

**If `inviteCode` is null (No code generated yet):**

**Display:**
1. **Information Box:**
   ```javascript
   <div style={{
     padding: 12,
     background: '#f9fafb',
     border: '1px solid #e5e7eb',
     borderRadius: 8,
     fontSize: 13,
     color: '#374151',
     lineHeight: 1.4
   }}>
     <div style={{ fontWeight: 600, marginBottom: 4 }}>
       Share this project
     </div>
     <div>
       Generate an invite code to share this project with others. Each code can be used once.
     </div>
   </div>
   ```

2. **Generate Button:**
   ```javascript
   <button
     type="button"
     onClick={handleGenerateCode}
     disabled={isGenerating}
     style={{
       width: '100%',
       padding: '12px 16px',
       background: isGenerating ? '#9ca3af' : '#10a37f',
       color: '#ffffff',
       border: 'none',
       borderRadius: 8,
       fontSize: 13,
       fontWeight: 600,
       cursor: isGenerating ? 'not-allowed' : 'pointer',
       transition: 'background 150ms ease',
       marginTop: 12
     }}
   >
     {isGenerating ? 'Generating...' : 'Generate Invite Code'}
   </button>
   ```

**If `inviteCode` is set (Code generated):**

**Display:**
1. **Code Display Box:**
   ```javascript
   <div style={{
     padding: 12,
     background: '#ffffff',
     border: '2px solid #10a37f',
     borderRadius: 8
   }}>
     <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
       INVITE CODE
     </div>
     <div style={{
       display: 'flex',
       alignItems: 'center',
       gap: 8,
       padding: '10px 12px',
       background: '#f3f4f6',
       borderRadius: 6,
       marginBottom: 8
     }}>
       <code style={{
         flex: 1,
         fontSize: 16,
         fontWeight: 700,
         fontFamily: 'monospace',
         color: '#111827',
         letterSpacing: '2px'
       }}>
         {inviteCode}
       </code>
       <button
         type="button"
         onClick={handleCopyCode}
         style={{
           background: '#10a37f',
           color: '#ffffff',
           border: 'none',
           borderRadius: 6,
           padding: '6px 12px',
           fontSize: 11,
           fontWeight: 600,
           cursor: 'pointer',
           whiteSpace: 'nowrap'
         }}
       >
         Copy
       </button>
     </div>
     <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
       Share this code with team members. They can use it to join your project.
     </p>
   </div>
   ```

#### 3.4 Bottom Actions

**Cancel Button:**
- Always visible on the left side
- Same styling as existing

**Action Button (Right Side):**
- **If `inviteCode` is null:** Show "Generate Code" button (or "Share" button)
- **If `inviteCode` is set:** Show "Done" button

**Implementation:**
```javascript
<button
  type="button"
  onClick={inviteCode ? onClose : handleGenerateCode}
  style={{ /* existing button styles */ }}
>
  {inviteCode ? 'Done' : (shareMode === 'collaborative' ? (projectId && !inviteCode ? 'Generate Code' : 'Share') : 'Send Copy')}
</button>
```

**If `projectId` is not provided (Chat Sharing Mode):**
- Use existing chat sharing behavior (no changes)

---

## Handler Functions

### handleGenerateCode

```javascript
const handleGenerateCode = async () => {
  if (!projectId) {
    showToast('No project selected', 'error');
    return;
  }
  
  setIsGenerating(true);
  try {
    const { generateProjectInviteCode } = await import('../funcs');
    const code = await generateProjectInviteCode(projectId);
    if (code) {
      setInviteCode(code);
      // Optionally auto-copy to clipboard
      try {
        await navigator.clipboard.writeText(code);
        showToast('Invite code copied to clipboard', 'success');
      } catch (err) {
        // Clipboard failed, but code is still generated
      }
    }
  } catch (err) {
    console.error('Failed to generate invite code:', err);
    showToast('Failed to generate invite code', 'error');
  } finally {
    setIsGenerating(false);
  }
};
```

### handleCopyCode

```javascript
const handleCopyCode = async () => {
  if (!inviteCode) return;
  try {
    await navigator.clipboard.writeText(inviteCode);
    showToast('Invite code copied to clipboard', 'success');
  } catch (err) {
    // Fallback to legacy copy
    const textarea = document.createElement('textarea');
    textarea.value = inviteCode;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Code copied to clipboard', 'success');
  }
};
```

---

## Complete Conditional Rendering Structure

```javascript
{shareMode === 'collaborative' ? (
  projectId ? (
    /* Project sharing - show invite code UI */
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {inviteCode ? (
        /* Code generated - show code display */
        <div style={{ /* code display box styles */ }}>
          {/* Code display */}
        </div>
      ) : (
        /* No code - show generate button */
        <>
          <div style={{ /* info box styles */ }}>
            {/* Info text */}
          </div>
          <button onClick={handleGenerateCode}>
            Generate Invite Code
          </button>
        </>
      )}
    </div>
  ) : (
    /* Chat sharing - existing user list */
    <div style={{ display: 'grid', rowGap: 10 }}>
      {users.map((u) => (
        /* Existing user card */
      ))}
    </div>
  )
) : (
  /* Private mode - existing email input */
  <div>
    {/* Existing private mode content */}
  </div>
)}
```

---

## Import Requirements

**Add to imports:**
```javascript
import { showToast } from '../funcs';
```

**Dynamic import for generateProjectInviteCode:**
```javascript
const { generateProjectInviteCode } = await import('../funcs');
```

---

## State Management

**Initial State:**
- `inviteCode`: null
- `isGenerating`: false

**When Generate Button Clicked:**
- `isGenerating`: true
- Call `generateProjectInviteCode`
- On success: `inviteCode`: code string, `isGenerating`: false
- On error: `isGenerating`: false, show error

**When Modal Closes:**
- Optionally reset `inviteCode` to null (or keep it for next open)
- Reset `isGenerating` to false

---

## Styling Consistency

**Maintain existing modal styling:**
- Same background, border, border-radius
- Same padding, spacing
- Same button styles (where applicable)
- Same animation/transition effects

**New elements should match:**
- Use existing color palette (#10a37f for primary actions)
- Use existing font sizes and weights
- Use existing spacing (12px, 16px, etc.)

---

## Testing Checklist

- [ ] Modal opens with projectId prop
- [ ] Title changes to "Share Project: {projectId}"
- [ ] Generate button appears when no code
- [ ] Generate button shows loading state
- [ ] Code displays after generation
- [ ] Copy button copies code to clipboard
- [ ] Done button appears after code generation
- [ ] Modal closes on Cancel
- [ ] Modal closes on Done
- [ ] Existing chat sharing still works (when projectId not provided)
