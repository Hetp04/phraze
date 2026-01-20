# Interactive Onboarding Demo - Phase 1 Detailed Plan

## Overview
Phase 1 is the **Sample Chat UI** phase. This phase displays a sample conversation between the user and Phraze with exact styling matching the current application. Users can see the chat interface and prepare to interact with it in subsequent phases.

## Phase 1: Sample Chat UI

### Goal
Display a sample chat conversation with exact styling from `Demonstration.jsx`, including user profile images/initials and message bubbles that match the production app.

### Requirements

#### 1. Sample Messages Structure
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

#### 2. Container Structure (Exact Match from Demonstration.jsx)

**Main Message Container:**
```jsx
<div style={{
  padding: message.role === 'user' ? '0 1rem' : '0',
  maxWidth: '800px',
  margin: '0 auto',
  width: '100%',
  display: 'flex',
  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
  position: 'relative',
  marginBottom: '1.5rem'
}}>
```

**Message Wrapper:**
```jsx
<div style={{ 
  display: 'flex', 
  flexDirection: 'column', 
  maxWidth: '85%',
  paddingLeft: message.role === 'user' ? '0' : '0'
}}>
```

#### 3. Username Header (Exact Match from Demonstration.jsx)

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

#### 4. User Profile Avatar/Initials

**For User Messages:**
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
        backgroundColor: avatarColor, // Use getAvatarColor(userEmail)
        color: 'white',
        fontSize: '0.6rem',
        fontWeight: '600'
      }}>
        {userInitials} {/* From getUserInitialsFromName(firstName, lastName, email) */}
      </div>
    )}
  </div>
)}
```

**For Assistant Messages (Phraze):**
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

#### 5. Message Bubble (Exact Match from Demonstration.jsx)

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
  <div
    style={{
      fontSize: '1rem',
      lineHeight: '1.5',
      whiteSpace: message.role === 'assistant' ? 'normal' : 'pre-wrap'
    }}
  >
    {message.content}
  </div>
</div>
```

#### 6. Profile Data Handling

**Get profile data from props (passed from Onboarding.jsx):**
- `userProfileImage` - The uploaded profile image (base64 data URL or URL)
- `userFirstName` - First name from username screen
- `userLastName` - Last name from username screen  
- `userEmail` - User's email address

**Fallback to AuthContext if props not available:**
- `userProfile?.profileImage`
- `userProfile?.firstName`
- `userProfile?.lastName`
- `userProfile?.email`

**Helper Functions Needed:**

```javascript
// Get user initials from firstName and lastName
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

// Get avatar color based on email (matches Onboarding.jsx)
const getAvatarColor = (str) => {
  if (!str) return `hsl(0, 60%, 70%)`;
  return `hsl(${str.charCodeAt(0) * 10 % 360}, 60%, 70%)`;
};
```

#### 7. Layout Structure

**Outer Container:**
```jsx
<div className="onboarding-demo-container" style={{
  minHeight: '100vh',
  background: '#fbfbfb',
  padding: '2rem',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
}}>
```

**Progress Bar Section:**
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

**Main Content Container:**
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

**Header Section:**
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

**Messages Container:**
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
  {/* Messages mapped here */}
</div>
```

#### 8. Tooltip (Phase 1 Only)

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

### Implementation Notes

1. **No Interaction in Phase 1**: This phase is display-only. Text selection and highlighting will be implemented in Phase 2.

2. **Exact Style Matching**: All styles must match `Demonstration.jsx` exactly, including:
   - Font sizes
   - Colors
   - Spacing (padding, margins, gaps)
   - Border radius values
   - Box shadows

3. **Profile Image Priority**:
   - First: Use `userProfileImage` prop (from username screen upload)
   - Second: Use `userProfile?.profileImage` from AuthContext
   - Fallback: Show initials with avatar color

4. **CSS Classes**: Use the same CSS class names as in `Demonstration.jsx`:
   - `message-bubble` (ensure this class exists in your CSS)

5. **Responsive Design**: Ensure messages container max-width matches (800px for messages, 1200px for outer container)

6. **Integration Point**: This component will be rendered from `Onboarding.jsx` after the username step is completed, receiving props:
   ```jsx
   <InteractiveOnboardingDemo 
     onComplete={handleDemoComplete}
     userProfileImage={avatarPreview}
     userFirstName={firstName}
     userLastName={lastName}
     userEmail={userEmail}
   />
   ```

### Success Criteria

- ✅ Sample messages display correctly with exact styling from `Demonstration.jsx`
- ✅ User profile image appears in user messages (if uploaded)
- ✅ User initials appear with correct avatar color (if no image)
- ✅ Phraze messages show "P" avatar
- ✅ Message bubbles have correct styling (white for user, transparent for assistant)
- ✅ Progress bar shows "Step 1 of 5" with 20% fill
- ✅ Tooltip displays welcome message
- ✅ All spacing, colors, and typography match production app exactly

### Future Phases Reference

For reference, here are the exact HTML structures that will be needed in future phases:

#### Highlight Toolbar (Phase 2)
```html
<div class="HighlightPopup" style="position: absolute; display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: rgb(255, 255, 255); border: 1px solid rgb(229, 231, 235); border-radius: 9999px; box-shadow: rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px; z-index: 1000000002; opacity: 1; transition: none;">
  <div title="Choose highlight color" style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid rgb(209, 213, 219); box-shadow: rgba(0, 0, 0, 0.06) 0px 1px 2px; background: rgb(206, 147, 216);"></div>
  <button style="width: 30px; height: 30px; border-radius: 9999px; border: 0px; background: rgb(243, 244, 246); cursor: pointer;">
    <i class="fas fa-pen"></i>
  </button>
  <div style="position: absolute; top: 36px; left: 0px; background: rgb(255, 255, 255); border: 1px solid rgb(229, 231, 235); border-radius: 8px; padding: 8px; display: none; box-shadow: rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px;">
    <div style="display: grid; grid-template-columns: repeat(6, 24px); gap: 8px;">
      <button type="button" aria-label="Select yellow highlight color" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgb(209, 213, 219); background: rgb(255, 241, 118); cursor: pointer;"></button>
      <button type="button" aria-label="Select blue highlight color" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgb(209, 213, 219); background: rgb(144, 202, 249); cursor: pointer;"></button>
      <button type="button" aria-label="Select green highlight color" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgb(209, 213, 219); background: rgb(165, 214, 167); cursor: pointer;"></button>
      <button type="button" aria-label="Select red highlight color" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgb(209, 213, 219); background: rgb(239, 154, 154); cursor: pointer;"></button>
      <button type="button" aria-label="Select purple highlight color" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgb(209, 213, 219); background: rgb(206, 147, 216); cursor: pointer;"></button>
      <button type="button" aria-label="Select orange highlight color" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgb(209, 213, 219); background: rgb(255, 204, 128); cursor: pointer;"></button>
    </div>
  </div>
</div>
```

#### Annotation Popup (Phase 3)
See the detailed HTML structure provided in the user's message - this is the full annotation popup with all its components including color picker, labels dropdown, rich text editor, etc.

#### Unified Annotation Card (Phase 4)
See the detailed HTML structure provided in the user's message - this is the unified card that appears below highlights with profile section, labels, notes, and footer buttons.

### File Structure

```
src/
  pages/
    InteractiveOnboardingDemo.jsx  (Main component)
    InteractiveOnboardingDemo.css  (Component-specific styles)
    Onboarding.jsx                 (Parent component that renders demo)
```
