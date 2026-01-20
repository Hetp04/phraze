# Messages Component - Detailed Functionality Explanation & Profile Picture Flickering Fix

## Overview
The `Messages.jsx` component is a comprehensive real-time messaging interface that handles 1-on-1 private conversations and project-wide "everyone" messages. It provides features like message editing, replying, searching, presence indicators, and profile picture display.

## Core Functionality

### 1. **Component Structure & State Management**

The component manages extensive state for:
- **Contacts**: List of users/contacts available for messaging
- **Messages**: Real-time messages for the currently selected contact/topic
- **UI State**: Search terms, editing state, reply state, hover states, etc.
- **Presence**: Real-time online/offline status for each contact
- **Profile Pictures**: Dynamic profile images that update in real-time

**Key State Variables:**
```javascript
const [contacts, setContacts] = useState([]);
const [messages, setMessages] = useState([]);
const [selectedContact, setSelectedContact] = useState(null);
const [contactStatuses, setContactStatuses] = useState({});
const [editingMessage, setEditingMessage] = useState(null);
const [replyingTo, setReplyingTo] = useState(null);
```

**Key Refs:**
```javascript
const profilePicListeners = useRef([]); // Firebase listeners for profile picture updates
const messagesListenerRef = useRef(null); // Firebase listener for messages
const presenceListeners = useRef({}); // Presence status listeners
const contactsEmailKeys = useRef(new Set()); // Track which contacts have listeners
```

### 2. **Company Email Resolution**

The component uses `getResolvedCompanyEmail()` to determine which company's data to access:
- Checks for shared projects (when viewing another user's shared project)
- Falls back to user's own company email
- Handles email formatting (dots to commas for Firebase paths)

### 3. **Contact Loading & Management**

**Contact Loading Process:**
1. Fetches project members from Firebase
2. Creates contact objects with email, name, profileImage, etc.
3. Sets up real-time listeners for profile picture updates
4. Sets up presence listeners for online/offline status

**Contact Structure:**
```javascript
{
  email: "user@example.com",
  emailKey: "user,example,com", // Firebase-formatted email
  name: "User Name",
  firstName: "User",
  lastName: "Name",
  profileImage: "https://...",
  userCompanyEmail: "company,example,com", // Contact's company
  isEveryone: false // Special contact for project-wide messages
}
```

**Real-time Profile Picture Updates:**
- Each contact has a Firebase listener on `Companies/{userCompanyEmail}/users/{emailKey}`
- When profile picture changes in Firebase, the contact is updated in real-time
- Uses `contactsEmailKey` dependency to prevent infinite loops (only re-runs when set of contacts changes)

### 4. **Message Loading & Real-time Updates**

**Message Loading (`loadMessagesForContact`):**
1. Validates user is a project member (security check)
2. Determines message path based on conversation type:
   - **1-on-1 messages**: `privateMessages/{emailPair}/{ownerCompany}/{projectId}/{topic}`
   - **Everyone messages**: `Companies/{companyEmail}/securedProjects/{projectId}/messages/{topic}/everyone`
3. Sets up Firebase `onValue` listener for real-time updates
4. Handles legacy paths for backward compatibility
5. Filters out thread replies (only shows main messages)
6. Sorts messages by timestamp (oldest first)
7. Auto-scrolls to bottom when new messages arrive

**Message Structure:**
```javascript
{
  messageId: "unique-id",
  text: "Message content",
  email: "sender@example.com",
  name: "Sender Name",
  timestamp: 1234567890,
  editedAt: 1234567891, // If message was edited
  replyTo: { // If replying to another message
    messageId: "original-id",
    name: "Original Sender",
    text: "Original message",
    timestamp: 1234567880
  }
}
```

**Real-time Message Updates:**
- Firebase listener fires whenever messages are added/updated/deleted
- Messages are merged with existing messages (prevents duplicates)
- Updates contact preview with latest message
- Auto-scrolls to bottom on new messages

### 5. **Message Rendering**

**Message Display Logic:**
- Messages are grouped by sender and time (if same sender within 2 minutes)
- Date separators shown for different days
- Timestamps shown if 5+ minutes gap between messages
- Current user's messages aligned right (blue), others aligned left (gray)
- Profile pictures shown for non-current-user messages (when not grouped)

**Message Features:**
- **Hover Toolbar**: Reply, Copy (own messages), Edit (own messages)
- **Reply Functionality**: Click reply to quote and respond to a message
- **Edit Functionality**: Edit own messages (shows "edited" indicator)
- **Message Search**: Search within current conversation with highlight
- **Date Separators**: Visual separators for different days

### 6. **Profile Picture Display**

**Where Profile Pictures Are Shown:**
1. **Contact List (Left Sidebar)**: Shows contact avatars with presence indicators
2. **Chat Header**: Shows selected contact's avatar and name
3. **Individual Messages**: Shows sender's avatar (for non-current-user messages, when not grouped)

**Profile Picture Rendering Logic:**
```javascript
// Example from contact list (line ~3462)
{contact.profileImage ? (
  <img 
    src={contact.profileImage} 
    alt={contact.name}
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
  // Show initials with colored background
)}
```

**Fallback Behavior:**
- If `profileImage` exists, show image
- If image fails to load (`onError`), hide image (shows colored background with initials)
- If no `profileImage`, show colored circle with initials
- Background color based on email hash: `hsl(${email.charCodeAt(0) * 10 % 360}, 65%, 65%)`

### 7. **Presence System**

- Real-time online/offline status for each contact
- Uses `listenToUserPresenceCanonical` utility
- Shows colored indicator dot on contact avatars
- Updates in real-time as users come online/offline

### 8. **Message Composer**

**Features:**
- Auto-expanding textarea (grows with content, max 200px)
- Reply preview (shows quoted message when replying)
- Edit mode indicator (shows when editing a message)
- Plus menu for additional actions
- Send button (or Enter key)

**Composer Reset:**
- Resets to single-line height when input is cleared
- Resets when message is sent
- Resets when edit/reply is cancelled

## Current Issue: Profile Picture Flickering

### Problem Description
Profile pictures in the Messages component flicker between the initial icon (colored circle with initials) and the actual profile image. This happens:
- When typing messages
- When new chats open
- During real-time message updates
- When profile pictures update from Firebase

### Root Cause Analysis

1. **Frequent Re-renders**: 
   - Real-time Firebase listeners trigger frequent state updates
   - Each state update causes component re-render
   - Profile pictures re-render on every update

2. **No Image Caching/Pre-loading**:
   - Unlike Activity.jsx (which has `loadedImagesRef`), Messages.jsx doesn't cache loaded images
   - Each re-render attempts to load images from scratch
   - Browser may show fallback (initials) while image loads

3. **Profile Picture Lookup**:
   - Messages reference contacts by email
   - Profile pictures come from `contacts` array
   - When contacts update, messages re-render
   - No persistent tracking of which images are already loaded

4. **Image Loading Race Condition**:
   - Image `src` is set immediately
   - Browser needs time to load/decode image
   - During this time, fallback (initials) may be visible
   - Once loaded, image appears, causing flicker

5. **Real-time Updates**:
   - Profile picture listeners update contacts in real-time
   - Each update triggers re-render
   - Messages re-render when contacts change
   - Images re-attempt to load on each render

### Solution Approach

Implement a similar solution to Activity.jsx:

1. **Image Caching with useRef**:
   ```javascript
   const loadedImagesRef = useRef(new Set()); // Persist across re-renders
   const [loadedImages, setLoadedImages] = useState(new Set()); // For UI updates
   const [failedImages, setFailedImages] = useState(new Set()); // Track failures
   ```

2. **Pre-load Images**:
   - When contacts are loaded, pre-load all profile images
   - Mark images as loaded in `loadedImagesRef` when they successfully load
   - Check `loadedImagesRef` before showing fallback

3. **Image Loading Logic**:
   ```javascript
   // Only show fallback if:
   // - No profileImage exists, OR
   // - Image explicitly failed to load AND not in loadedImagesRef
   
   const shouldShowFallback = !profileImage || 
     (failedImages.has(profileImage) && !loadedImagesRef.current.has(profileImage));
   ```

4. **onLoad/onError Handlers**:
   ```javascript
   onLoad={() => {
     loadedImagesRef.current.add(profileImage);
     setLoadedImages(prev => new Set(prev).add(profileImage));
     setFailedImages(prev => {
       const newSet = new Set(prev);
       newSet.delete(profileImage);
       return newSet;
     });
   }}
   onError={() => {
     setFailedImages(prev => new Set(prev).add(profileImage));
   }}
   ```

5. **Opacity Transition**:
   ```javascript
   // Show image with opacity 1 if loaded or not failed
   // Show fallback only if explicitly needed
   style={{
     opacity: (profileImage && !failedImages.has(profileImage)) ? 1 : 0,
     transition: 'opacity 0.2s ease'
   }}
   ```

6. **Debounce Real-time Updates** (if needed):
   - If updates are too frequent, debounce the `setContacts` calls
   - Batch multiple profile picture updates together

### Implementation Locations

1. **Contact List Avatars** (line ~3422-3476):
   - Add image caching logic
   - Pre-load images when contacts are loaded

2. **Chat Header Avatar** (line ~1772-1822):
   - Add image caching for selected contact
   - Pre-load when contact is selected

3. **Message Avatars** (if messages show avatars):
   - Look up profile picture from contacts by email
   - Use cached image state
   - Pre-load images for all message senders

4. **Profile Picture Listeners** (line ~439-525):
   - Pre-load images when profile pictures update
   - Update `loadedImagesRef` when images load

### Testing Checklist

- [ ] Profile pictures don't flicker when typing messages
- [ ] Profile pictures don't flicker when new chats open
- [ ] Profile pictures don't flicker during real-time updates
- [ ] Profile pictures load smoothly on initial render
- [ ] Fallback initials show correctly when image fails
- [ ] Fallback initials show correctly when no profile image exists
- [ ] Profile pictures update smoothly when changed in Firebase
- [ ] No performance degradation from image caching
- [ ] Works for both 1-on-1 and "everyone" messages
- [ ] Works for contacts in sidebar and chat header

## Additional Features

### Message Search
- Search within current conversation
- Highlight matching text
- Navigate between matches (Enter/Shift+Enter)
- Escape to close search

### Message Editing
- Edit own messages (shows "edited" indicator)
- Cancel edit to revert
- Update timestamp preserved

### Message Replies
- Reply to any message (quote original)
- Reply preview in composer
- Click to jump to original message

### Contact Profile View
- Click contact avatar/name to view profile
- Shows contact details, presence status
- Can navigate back to messages

## Firebase Paths

**Contacts:**
- `Companies/{companyEmail}/projects/{projectId}/members/{userEmail}`
- `Companies/{userCompanyEmail}/users/{emailKey}` (for profile pictures)

**Messages:**
- 1-on-1: `privateMessages/{emailPair}/{ownerCompany}/{projectId}/{topic}`
- Everyone: `Companies/{companyEmail}/securedProjects/{projectId}/messages/{topic}/everyone`

**Presence:**
- Uses `listenToUserPresenceCanonical` utility (internal path management)

## Security Considerations

1. **Project Membership Check**: Verifies user is project member before loading messages
2. **Firebase Rules**: Relies on Firebase security rules for path access
3. **Email Pairing**: Uses `getEmailPair` to ensure proper message path construction
4. **Owner Company**: Includes owner company in private message paths for rule validation

## Performance Considerations

1. **Listener Cleanup**: All Firebase listeners are properly cleaned up on unmount
2. **Contact Email Key**: Uses stable dependency to prevent infinite loops
3. **Message Merging**: Uses Map to prevent duplicate messages
4. **Auto-scroll**: Debounced to prevent excessive scrolling

## Dependencies

- `react`: Component framework
- `firebase/database`: Real-time database
- `../firebase-init`: Firebase initialization
- `../funcs`: Utility functions (getFirebaseData, getMainCompanyEmail)
- `../utils/presence`: Presence system utilities
