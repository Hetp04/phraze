# Interactive Onboarding Demo - Phase 1 Detailed Implementation Plan

## Overview
Phase 1 is the **Sample Chat UI** phase. This phase displays a sample conversation between the user and Phraze with exact styling matching the current application (`Demonstration.jsx`). Users can see the chat interface and prepare to interact with it in subsequent phases.

**IMPORTANT**: This document contains extremely detailed specifications for Phase 1 only, including exact HTML structures, CSS values, and implementation details.

---

## Phase 1: Sample Chat UI - Complete Specification

### Goal
Display a sample chat conversation with **exact** styling from `Demonstration.jsx`, including user profile images/initials and message bubbles that match the production app pixel-perfect.

---

## 1. Sample Messages Data Structure

```javascript
const SAMPLE_MESSAGES = [
  {
    id: 1,
    role: 'assistant',
    content: 'I can help you with that! What specific API are you trying to integrate?',
    senderName: 'Phraze'
  },
  {
    id: 2,
    role: 'user',
    content: 'Weather API - keeps returning 401 errors. Where should I put the API key?',
    senderName: 'You'
  },
  {
    id: 3,
    role: 'assistant',
    content: 'Create a .env file and add VITE_WEATHER_API_KEY=your_key. Access it with import.meta.env.VITE_WEATHER_API_KEY. Never commit the key - add .env to .gitignore!',
    senderName: 'Phraze'
  }
];
```

---

## 2. Component Structure & Layout

### 2.1 Outer Container
```jsx
<div className="onboarding-demo-container" style={{
  minHeight: '100vh',
  background: '#fbfbfb',
  padding: '2rem',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
}}>
```

### 2.2 Progress Bar Section
```jsx
<div className="onboarding-progress-bar" style={{
  maxWidth: '1200px',
  margin: '0 auto 2rem'
}}>
  <div className="progress-header" style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem'
  }}>
    <span className="progress-text" style={{
      fontSize: '14px',
      fontWeight: '500',
      color: '#6b7280'
    }}>Step 1 of 5</span>
  </div>
  <div className="progress-track" style={{
    height: '4px',
    backgroundColor: '#e5e7eb',
    borderRadius: '2px',
    overflow: 'hidden'
  }}>
    <div 
      className="progress-fill" 
      style={{ 
        width: '20%',
        height: '100%',
        background: 'linear-gradient(90deg, #10a37f, #0d8c6e)',
        transition: 'width 0.3s ease'
      }}
    />
  </div>
</div>
```

### 2.3 Main Content Container
```jsx
<div className="onboarding-demo-content" style={{
  maxWidth: '1200px',
  margin: '0 auto',
  background: 'white',
  borderRadius: '16px',
  padding: '2rem',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
}}>
```

### 2.4 Header Section
```jsx
<div className="demo-header" style={{
  textAlign: 'center',
  marginBottom: '2rem'
}}>
  <h1 style={{
    fontSize: '2rem',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '0.5rem'
  }}>Learn How to Annotate</h1>
  <p style={{
    color: '#6b7280',
    fontSize: '1rem'
  }}>Follow these steps to master highlighting, annotating, and sharing</p>
</div>
```

### 2.5 Messages Container
```jsx
<div 
  ref={messagesContainerRef}
  className="onboarding-messages-container"
  style={{
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem',
    background: '#f9fafb',
    borderRadius: '12px',
    minHeight: '400px'
  }}
>
  {/* Messages will be mapped here */}
</div>
```

---

## 3. Message Row Structure (EXACT Match from Demonstration.jsx)

### 3.1 Main Message Container
```jsx
<div
  key={message.id}
  style={{
    padding: message.role === 'user' ? '0 1rem' : '0',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
    position: 'relative',
    marginBottom: '1.5rem'
  }}
>
```

### 3.2 Message Wrapper
```jsx
<div style={{ 
  display: 'flex', 
  flexDirection: 'column', 
  maxWidth: '85%',
  paddingLeft: message.role === 'user' ? '0' : '0'
}}>
```

---

## 4. Username Header with Avatar (EXACT Match from Demonstration.jsx)

### 4.1 Header Container
```jsx
<div style={{ 
  fontSize: '0.8rem', 
  marginBottom: '8px', 
  fontWeight: '500',
  color: '#555',
  textAlign: message.role === 'user' ? 'right' : 'left',
  paddingRight: message.role === 'user' ? '0' : '0rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
}}>
```

### 4.2 User Avatar (Only for user messages)
```jsx
{message.role === 'user' && (
  <div style={{
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.6rem',
    fontWeight: '600',
    color: '#334155',
    border: '1px solid #cbd5e1',
    overflow: 'hidden',
    position: 'relative'
  }}>
    {profileImage ? (
      <img
        src={profileImage}
        alt="You"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
    ) : (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: avatarColor,
        color: 'white',
        fontSize: '0.6rem',
        fontWeight: '600'
      }}>
        {userInitials}
      </div>
    )}
  </div>
)}
```

**Profile Image Priority:**
1. First: `userProfileImage` prop (from username screen upload)
2. Second: `userProfile?.profileImage` from AuthContext
3. Fallback: Show initials with avatar color

### 4.3 Username Text
```jsx
<span>{message.role === 'user' ? 'You' : 'Phraze'}</span>
```

### 4.4 Phraze Avatar (Only for assistant messages)
```jsx
{message.role === 'assistant' && (
  <div style={{
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#64748b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.6rem',
    fontWeight: '600',
    color: 'white',
    border: '1px solid #475569'
  }}>
    P
  </div>
)}
```

---

## 5. Message Bubble (EXACT Match from Demonstration.jsx)

### 5.1 Bubble Container
```jsx
<div
  className="message-bubble"
  style={{
    padding: message.role === 'user' ? '1rem' : '0rem',
    background: message.role === 'user' ? '#ffffff' : 'transparent',
    borderRadius: message.role === 'user' ? '2rem' : '0.5rem',
    borderBottomRightRadius: message.role === 'user' ? '5px' : '0.5rem',
    color: '#0A0A0A',
    display: 'inline-block',
    width: '100%',
    position: 'relative',
    marginTop: '4px'
  }}
>
```

### 5.2 Message Content
```jsx
<div
  style={{
    fontSize: '1rem',
    lineHeight: '1.5',
    whiteSpace: message.role === 'assistant' ? 'normal' : 'pre-wrap'
  }}
>
  {message.content}
</div>
```

**Important Notes:**
- User messages: `whiteSpace: 'pre-wrap'` (preserves line breaks)
- Assistant messages: `whiteSpace: 'normal'`
- User messages have `padding: '1rem'`
- Assistant messages have `padding: '0rem'`

---

## 6. Helper Functions

### 6.1 Get User Initials
```javascript
function getUserInitialsFromName(firstName, lastName, fallback = '') {
  const firstInitial = firstName && firstName.trim() ? firstName.trim()[0].toUpperCase() : '';
  const lastInitial = lastName && lastName.trim() ? lastName.trim()[0].toUpperCase() : '';
  
  if (firstInitial && lastInitial) {
    return firstInitial + lastInitial;
  } else if (firstInitial) {
    return firstInitial + firstInitial;
  } else if (fallback) {
    return fallback.substring(0, 2).toUpperCase();
  }
  return 'U';
}
```

### 6.2 Get Avatar Color (Matches Onboarding.jsx)
```javascript
const getAvatarColor = (str) => {
  if (!str) return `hsl(0, 60%, 70%)`;
  return `hsl(${str.charCodeAt(0) * 10 % 360}, 60%, 70%)`;
};
```

---

## 7. Tooltip (Phase 1 Only)

```jsx
<div
  className="onboarding-tooltip"
  style={{
    position: 'fixed',
    bottom: '100px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10003,
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    padding: '12px 16px',
    maxWidth: '300px'
  }}
>
  <div className="tooltip-content">
    <p style={{
      margin: 0,
      fontSize: '14px',
      color: '#374151',
      lineHeight: '1.5'
    }}>
      Welcome! Let's learn how to annotate. First, highlight some text in a Phraze message by selecting it.
    </p>
  </div>
</div>
```

---

## 8. Component Props & Data Flow

### 8.1 Props Received
```javascript
{
  onComplete: Function,           // Called when demo completes
  userProfileImage: String,       // Base64 data URL or URL from username screen
  userFirstName: String,          // First name from username screen
  userLastName: String,           // Last name from username screen
  userEmail: String               // User's email address
}
```

### 8.2 Data Resolution Priority
```javascript
// Get profile data - prioritize props, then context
const profileImage = userProfileImage || userProfile?.profileImage;
const firstName = userFirstName || userProfile?.firstName || '';
const lastName = userLastName || userProfile?.lastName || '';
const email = userEmail || userProfile?.email || '';

// Get user initials
const userInitials = getUserInitialsFromName(firstName, lastName, email?.split('@')[0] || 'You');

// Get avatar color
const avatarColor = getAvatarColor(email);
```

---

## 9. Integration with Onboarding.jsx

### 9.1 Rendering from Onboarding.jsx
After username step completion:
```jsx
{showInteractiveDemo && usernameCompleted && (
  <InteractiveOnboardingDemo 
    onComplete={handleDemoComplete}
    userProfileImage={avatarPreview}
    userFirstName={firstName}
    userLastName={lastName}
    userEmail={userEmail}
  />
)}
```

### 9.2 Onboarding.jsx State Management
```javascript
const [showInteractiveDemo, setShowInteractiveDemo] = useState(false);
const [usernameCompleted, setUsernameCompleted] = useState(false);

// In handleComplete (username step):
setUsernameCompleted(true);
setShowInteractiveDemo(true);
setLoading(false);

// DON'T save onboardingCompleted to Firebase until demo completes
```

---

## 10. CSS Requirements

### 10.1 Required CSS Class
Ensure `.message-bubble` class exists in your CSS (should already exist from Demonstration.jsx).

### 10.2 Component-Specific CSS
Create `InteractiveOnboardingDemo.css`:
```css
.onboarding-demo-container {
  min-height: 100vh;
  background: #fbfbfb;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.onboarding-progress-bar {
  max-width: 1200px;
  margin: 0 auto 2rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-text {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
}

.progress-track {
  height: 4px;
  background-color: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10a37f, #0d8c6e);
  transition: width 0.3s ease;
}

.onboarding-demo-content {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.demo-header {
  text-align: center;
  margin-bottom: 2rem;
}

.demo-header h1 {
  font-size: 2rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.5rem;
}

.demo-header p {
  color: #6b7280;
  font-size: 1rem;
}

.onboarding-messages-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  background: #f9fafb;
  border-radius: 12px;
  min-height: 400px;
}

.onboarding-tooltip {
  position: fixed;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  padding: 12px 16px;
  max-width: 300px;
  z-index: 10002;
}

.tooltip-content p {
  margin: 0;
  font-size: 14px;
  color: #374151;
  line-height: 1.5;
}
```

---

## 11. Success Criteria

- ✅ Sample messages display correctly with exact styling from `Demonstration.jsx`
- ✅ User profile image appears in user messages (if uploaded)
- ✅ User initials appear with correct avatar color (if no image)
- ✅ Phraze messages show "P" avatar with correct styling
- ✅ Message bubbles have correct styling (white for user, transparent for assistant)
- ✅ User messages are right-aligned with white background and rounded corners
- ✅ Assistant messages are left-aligned with transparent background
- ✅ Progress bar shows "Step 1 of 5" with 20% fill
- ✅ Tooltip displays welcome message at bottom center
- ✅ All spacing, colors, and typography match production app exactly
- ✅ Font sizes, padding, margins, gaps all match `Demonstration.jsx` pixel-perfect
- ✅ Avatar sizes (20px), borders, colors all match exactly

---

## 12. Important Implementation Notes

1. **No Interaction in Phase 1**: This phase is display-only. Text selection and highlighting will be implemented in Phase 2.

2. **Exact Style Matching**: All styles must match `Demonstration.jsx` exactly:
   - Font sizes: `0.8rem` (username), `1rem` (message content), `0.6rem` (avatar initials)
   - Colors: `#555` (username), `#0A0A0A` (message text), `#ffffff` (user bubble), `transparent` (assistant bubble)
   - Spacing: `8px` (marginBottom for username), `1.5rem` (marginBottom for messages), `0.5rem` (gap for flex items)
   - Border radius: `2rem` (user bubble), `0.5rem` (assistant bubble), `5px` (borderBottomRightRadius for user)
   - Avatar: `20px` width/height, `50%` borderRadius, specific background colors

3. **Profile Image Handling**:
   - Always check for `profileImage` first (from props or context)
   - If image fails to load, hide the image element (using `onError`)
   - Fallback to initials with avatar color

4. **Responsive Design**: 
   - Messages container: `max-width: 800px`
   - Outer container: `max-width: 1200px`
   - Message wrapper: `max-width: 85%`

5. **CSS Classes**: Use existing `.message-bubble` class from your app's CSS

6. **File Structure**:
   ```
   src/
     pages/
       InteractiveOnboardingDemo.jsx  (Main component)
       InteractiveOnboardingDemo.css  (Component-specific styles)
       Onboarding.jsx                 (Parent component)
   ```

---

## 13. Future Phases Reference

For future implementation, here are the exact HTML structures provided:

### Highlight Toolbar (Phase 2)
See user-provided HTML structure - includes color picker, highlight button, and color palette dropdown.

### Annotation Popup (Phase 3)
See user-provided HTML structure - includes header, selected text display, labels dropdown, annotation editor, and Add Annotation button.

### Unified Annotation Card (Phase 4)
See user-provided HTML structure - includes profile section, color indicator, labels section, notes section, and footer with action buttons.

These structures should be referenced when implementing subsequent phases, but are not needed for Phase 1.

---

## 14. Testing Checklist

- [ ] Messages render in correct order
- [ ] User messages are right-aligned with white background
- [ ] Assistant messages are left-aligned with transparent background
- [ ] Profile image displays correctly when provided
- [ ] Initials display correctly when no image (with correct color)
- [ ] Avatar colors are consistent and match expected values
- [ ] Message text wraps correctly
- [ ] Progress bar shows correct step and percentage
- [ ] Tooltip appears and is positioned correctly
- [ ] All spacing matches Demonstration.jsx exactly
- [ ] All colors match Demonstration.jsx exactly
- [ ] All font sizes match Demonstration.jsx exactly
- [ ] Component receives props correctly from Onboarding.jsx
- [ ] Component handles missing profile data gracefully
