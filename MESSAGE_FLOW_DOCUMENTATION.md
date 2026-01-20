# Message Flow Documentation - Extension Sidebar

## Overview
This document explains how messages are currently sent and received from the extension sidebar, and where they are saved in Firebase.

## Message Sending Flow

### 1. User Sends a Message
When a user types and sends a message in the extension sidebar:

**Location:** `extension/messaging.js` - `postNewMessage()` function (line 4108)

### 2. Message Creation
The message object is created with the following structure:
```javascript
{
    text: text,                    // Message content
    email: userEmail,              // Sender's email
    name: userName,                // Sender's name
    timestamp: ISO timestamp,      // When message was sent
    messageId: timestamp,          // Unique message ID
    reactions: {},                // Emoji reactions
    editedAt: null,               // Edit timestamp if edited
    isScheduled: false,           // Whether message is scheduled
    replyTo: {...},              // Optional: reply context
    threadId: String              // Optional: thread ID if replying in thread
}
```

### 3. Firebase Path Construction
The Firebase path is constructed as follows:

**Location:** `extension/messaging.js` - line 4168

```javascript
const formattedCompanyEmail = (companyEmail || '').replace(/\./g, ',');
const firebasePath = `Companies/${formattedCompanyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}/${timestamp}`;
```

**Path Structure:**
- `Companies/{companyEmail}` - Company identifier (dots replaced with commas)
- `securedProjects/{currentProject}` - Current project name
- `messages/{currentTopic}` - Current topic (e.g., "general", "groqChats-{chatId}")
- `{emailPair}` - Pair of user emails (sorted alphabetically, e.g., "user1,com-user2,com")
- `{timestamp}` - Message timestamp (used as unique key)

**Example Path:**
```
Companies/company,example,com/securedProjects/myProject/messages/general/user1,com-user2,com/1704067200000
```

### 4. Saving to Firebase
The message is saved via the background script:

**Location:** `extension/messaging.js` - line 4173

```javascript
sendRuntimeMessage({
    action: "saveFirebaseData",
    path: firebasePath,
    data: message
}, async response => {
    // Handle response
});
```

**Background Script Handler:**
**Location:** `extension/background.js` - line 439

The background script receives the message and saves it to Firebase:
```javascript
if (message.action === "saveFirebaseData") {
    const path = message.path;
    const data = message.data;
    const dataRef = firebase.database().ref(path);
    dataRef.set(data)
        .then(() => {
            sendResponse({ success: true });
        })
        .catch(error => {
            sendResponse({ success: false, error: error.message });
        });
}
```

## Message Receiving Flow

### 1. Setting Up Firebase Listener
When a user opens a chat, a Firebase real-time listener is set up:

**Location:** `extension/messaging.js` - `loadMessages()` function (line 4204)

### 2. Listener Registration
The listener is registered using:

**Location:** `extension/messaging.js` - line 4230

```javascript
listenerFirebaseData(currentMessagesPath, async (path, data) => {
    // Handle incoming messages
});
```

**Helper Function:**
**Location:** `extension/frames.js` - line 59

```javascript
export function listenerFirebaseData(path, func) {
    pathToFunctionMap.set(path, func);
    sendRuntimeMessage({
        action: "listenerFirebaseData",
        path: path
    }, response => {
        // Handle response
    });
}
```

### 3. Background Script Listener Setup
The background script sets up the Firebase listener:

**Location:** `extension/background.js` - line 371

```javascript
if (message.action === "listenerFirebaseData") {
    const path = message.path;
    const dataRef = firebase.database().ref(path);
    
    const listenerCallback = (snapshot) => {
        sendMessageToAllTabs({
            action: "firebaseDataChanged",
            path: path,
            data: snapshot.val()
        });
    };
    
    dataRef.on('value', listenerCallback);
}
```

### 4. Receiving Updates
When Firebase data changes, the background script broadcasts to all tabs:

**Location:** `extension/frames.js` - line 95

```javascript
else if (event.data.action == "firebaseDataChanged") {
    if (pathToFunctionMap.has(event.data.path)) {
        pathToFunctionMap.get(event.data.path)(event.data.path, event.data.data);
    }
}
```

### 5. Message Processing
The callback function processes the received data:

**Location:** `extension/messaging.js` - line 4230-4518

The listener callback:
1. Extracts all messages from Firebase data
2. Filters out thread replies (only shows main messages)
3. Sorts messages (pinned first, then by timestamp)
4. Calculates thread counts
5. Updates the UI with new messages
6. Handles incremental updates (only adds new messages, doesn't reload all)

## Firebase Database Structure

### Full Path Structure
```
Companies/
  {companyEmail}/                    // Company email (dots → commas)
    securedProjects/
      {projectName}/                 // Current project
        messages/
          {topic}/                   // Topic: "general" or "groqChats-{chatId}"
            {emailPair}/             // User pair: "user1,com-user2,com" or "everyone"
              {timestamp}/           // Message timestamp (unique key)
                text: "..."
                email: "..."
                name: "..."
                timestamp: "..."
                messageId: "..."
                reactions: {...}
                editedAt: null
                replyTo: {...}        // Optional
                threadId: "..."      // Optional
```

### Special Cases

#### 1. "Everyone" Messages
For group messages to everyone:
- `emailPair` = `"everyone"`
- Path: `Companies/{companyEmail}/securedProjects/{project}/messages/{topic}/everyone/{timestamp}`

#### 2. Groq Chat Messages
For messages in Groq chats:
- `topic` = `"groqChats-{chatId}"` (e.g., "groqChats-123456")
- Path: `Companies/{companyEmail}/securedProjects/{project}/messages/groqChats-{chatId}/{emailPair}/{timestamp}`

#### 3. Thread Replies
Thread replies are stored at the same path but with a `threadId` field:
- Same path structure as regular messages
- `threadId` field contains the parent message's `messageId`
- Filtered out from main chat view (only shown in thread view)

## Key Functions

### Sending Messages
- **`postNewMessage(text, isScheduled)`** - Creates and saves a new message
  - Location: `extension/messaging.js:4108`

### Receiving Messages
- **`loadMessages()`** - Sets up Firebase listener and loads messages
  - Location: `extension/messaging.js:4204`
- **`listenerFirebaseData(path, callback)`** - Registers a Firebase listener
  - Location: `extension/frames.js:59`

### Firebase Operations
- **`sendRuntimeMessage()`** - Sends message to background script
  - Location: `extension/frames.js:40`
- **Background script handlers** - Handle Firebase operations
  - Location: `extension/background.js:371, 439`

## Real-time Updates

The system uses Firebase Realtime Database listeners to automatically update the UI when:
- New messages are sent
- Messages are edited
- Reactions are added/removed
- Thread replies are added
- Messages are pinned/unpinned

The listener callback in `loadMessages()` handles all these updates incrementally, only adding new messages to the UI without full reloads.

## Email Pair Formatting

Email pairs are created by:
1. Replacing dots with commas in both emails
2. Sorting alphabetically
3. Joining with a hyphen: `{email1}-{email2}`

**Example:**
- User 1: `user1@example.com` → `user1,example,com`
- User 2: `user2@example.com` → `user2,example,com`
- Pair: `user1,example,com-user2,example,com`

This ensures the same path is used regardless of which user initiates the conversation.
