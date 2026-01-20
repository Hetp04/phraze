# Slack-Style Real-Time User Presence System

## Overview

A comprehensive, server-authoritative presence system that tracks user activity across multiple sessions (tabs/browsers) and displays accurate Active, Idle, and Offline states.

## Features

✅ **Multi-Session Support**: Tracks multiple concurrent sessions (tabs/browsers)  
✅ **Activity Detection**: Monitors mouse, keyboard, focus, visibility, clicks, and scrolls  
✅ **Idle Detection**: Automatically transitions to Idle after 10 minutes of inactivity  
✅ **Heartbeat System**: Maintains connection health with 5-second heartbeats  
✅ **Grace Period**: 60-second grace period prevents flicker on disconnects  
✅ **Real-Time Updates**: Instant presence propagation to all connected clients  
✅ **Three States**: Active (Green), Idle (Yellow), Offline (Gray)

## Architecture

### Data Structure

```
presence/
  {userEmail}/
    sessions/
      {sessionId}/
        sessionId: string
        userId: string
        userEmail: string
        connectedAt: timestamp
        lastHeartbeatAt: timestamp
        lastActiveAt: timestamp
        status: 'active'
```

### State Computation Logic

**Active** → At least one session is connected AND has activity within 10 minutes  
**Idle** → At least one session is connected BUT no activity within 10 minutes  
**Offline** → All sessions disconnected AND grace period expired

### Session Aggregation Rules

1. **ANY session Active** → User is **Active**
2. **ANY session Connected** (but idle) → User is **Idle**
3. **NO sessions alive** → User is **Offline**

## Implementation Files

### 1. `src/utils/presence.js`
Core presence utility module containing:
- Session management
- Activity detection (mouse, keyboard, focus, visibility)
- Heartbeat system
- Presence computation logic
- Firebase integration

**Key Functions:**
- `initializePresence()` - Start presence tracking for current session
- `cleanupPresence()` - Clean up session on logout/close
- `reportActivity()` - Report user interaction
- `listenToUserPresence(email, callback)` - Listen to user's presence changes
- `computeUserPresence(sessionsData)` - Compute presence from sessions
- `getPresenceColor(presence)` - Get color for UI (green/yellow/gray)
- `getPresenceLabel(presence)` - Get label for UI (Active/Idle/Offline)

### 2. `src/context/AuthContext.jsx`
Integrated presence initialization:
- Initializes presence on user login
- Cleans up presence on user logout
- Automatically handles session lifecycle

### 3. `src/pages/Demonstration.jsx`
Updated to use new presence system:
- Replaced old binary (online/offline) tracking
- Now tracks three states (active/idle/offline)
- UI displays correct colors based on presence state

## Configuration

```javascript
const CONFIG = {
  IDLE_THRESHOLD_MS: 10 * 60 * 1000,      // 10 minutes
  HEARTBEAT_INTERVAL_MS: 5 * 1000,        // 5 seconds
  DISCONNECT_GRACE_PERIOD_MS: 60 * 1000,  // 60 seconds
  ACTIVITY_DEBOUNCE_MS: 1000,             // 1 second
};
```

## Activity Detection

The system tracks the following user interactions:
- **Mouse movement** - Any mouse movement
- **Keyboard input** - Any key press
- **Window focus** - Window/tab gains focus
- **Page visibility** - Tab becomes visible
- **Click events** - Any click
- **Scroll events** - Scrolling (debounced to 500ms)

## State Transitions

```
OFFLINE (Gray)
    ↓
[Connection established]
    ↓
ACTIVE (Green)
    ↓
[No activity for 10 minutes]
    ↓
IDLE (Yellow)
    ↓
[User interaction detected]
    ↓
ACTIVE (Green)
```

## Edge Cases Handled

✅ Multiple open tabs - Each tab maintains its own session  
✅ Multiple browsers - Each browser maintains separate sessions  
✅ Page refreshes - New session created, old one cleaned up  
✅ Browser crashes - Grace period prevents immediate offline status  
✅ Network drops - Heartbeat detects disconnection after grace period  
✅ Tab hidden - Visibility API detects when tab becomes hidden  
✅ Reconnection - New session created without status flicker

## Usage Example

```javascript
import { listenToUserPresence, getPresenceColor } from '../utils/presence';

// Listen to a user's presence
const cleanup = listenToUserPresence('user@example.com', (presence) => {
  console.log('User presence:', presence); // 'active' | 'idle' | 'offline'
  const color = getPresenceColor(presence); // '#10b981' | '#f59e0b' | '#9ca3af'
  
  // Update UI
  updatePresenceIndicator(color, presence);
});

// Cleanup when done
cleanup();
```

## UI Integration

The presence indicator in the members list now shows:
- 🟢 **Green dot** - User is Active
- 🟡 **Yellow dot** - User is Idle
- ⚪ **Gray dot** - User is Offline

The indicator is positioned at the bottom-right of each member's profile picture.

## Future Enhancements

For true server-authoritative presence, consider:
1. **Cloud Functions**: Move aggregation logic to Firebase Cloud Functions
2. **Automatic Cleanup**: Add Cloud Function to clean up stale sessions
3. **Presence History**: Track presence changes over time
4. **Custom Idle Thresholds**: Allow users to configure idle timeout
5. **Do Not Disturb**: Add manual status override

## Testing

To test the presence system:
1. Open multiple tabs/browsers with the same user
2. Interact with the page (move mouse, type, etc.)
3. Wait 10+ minutes without activity to see Idle state
4. Close all tabs to see Offline state
5. Verify presence updates in real-time across all clients

## Notes

- Presence is computed client-side for now (can be moved to Cloud Functions)
- Sessions are automatically cleaned up on disconnect
- Activity is debounced to prevent excessive Firebase writes
- Heartbeat ensures connection health is monitored continuously
