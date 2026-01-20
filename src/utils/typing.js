/**
 * Real-Time Typing Indicator System - Slack-style
 * 
 * Features:
 * - Ephemeral typing indicators (auto-expire via TTL)
 * - Throttled writes (max once per TYPING_THROTTLE_MS)
 * - Auto-cleanup on disconnect
 * - Server time offset for consistent TTL calculations
 * - Multi-tab support (latest wins)
 */

import { database, auth } from "../firebase-init";
import {
  ref,
  set,
  remove,
  onDisconnect,
  onValue,
  off,
  get,
} from "firebase/database";

/* ----------------------------- CONFIG ----------------------------- */

const CONFIG = {
  TYPING_THROTTLE_MS: 2000, // Max write frequency while typing
  TYPING_TTL_MS: 2500, // How long a typing indicator is considered valid (reduced for faster disappearance)
  EVICT_INTERVAL_MS: 200, // How often to check for expired typers (more frequent for faster updates)
};

/* ----------------------------- STATE ----------------------------- */

let serverOffsetMs = 0;
let typingNodesRef = new Map(); // conversationId -> { ref, onDisconnectCleanup }
let typingListenersRef = new Map(); // conversationId -> { callback, evictInterval, typingRef }
let lastTypingWriteAt = new Map(); // conversationId -> timestamp
let isTypingActive = new Map(); // conversationId -> boolean
let isConnected = false;

// Server offset subscription
let unsubscribeServerOffset = null;
let unsubscribeConnected = null;
let connectedRef = null;

/* ----------------------------- HELPERS ----------------------------- */

/**
 * Subscribe to server time offset - keeps it updated in real-time
 * This is critical for accurate TTL calculations
 */
function subscribeServerOffset() {
  const offsetRef = ref(database, ".info/serverTimeOffset");
  const callback = (snap) => {
    serverOffsetMs = snap.exists() ? snap.val() : 0;
  };
  onValue(offsetRef, callback);
  return () => {
    off(offsetRef, "value", callback);
  };
}

/**
 * One-time initialization of server offset
 */
async function initServerOffset() {
  try {
    const offsetRef = ref(database, ".info/serverTimeOffset");
    const snap = await get(offsetRef);
    serverOffsetMs = snap.exists() ? snap.val() : 0;
  } catch (error) {
    console.warn('[Typing] Could not read server time offset, using local time:', error.message);
    serverOffsetMs = 0;
  }
}

function serverNow() {
  return Date.now() + serverOffsetMs;
}

/**
 * Get current user ID (use uid, not email)
 */
function getCurrentUserId() {
  const user = auth.currentUser;
  if (!user?.uid) return null;
  return user.uid;
}

/**
 * Register onDisconnect for typing node (only when connected)
 */
function registerOnDisconnectForTyping(typingRef, conversationId) {
  if (!isConnected || !typingRef) return;
  
  try {
    onDisconnect(typingRef).remove().catch((err) => {
      console.warn('[Typing] Error setting onDisconnect:', err.message);
    });
  } catch (error) {
    console.warn('[Typing] Error registering onDisconnect:', error.message);
  }
}

/* ----------------------------- INITIALIZATION ----------------------------- */

/**
 * Initialize typing system (call once on app startup)
 */
export async function initializeTyping() {
  // Subscribe to server offset for real-time updates
  unsubscribeServerOffset = subscribeServerOffset();
  // Also do one-time init for immediate use
  await initServerOffset();
  
  // Watch .info/connected to register onDisconnect reliably
  connectedRef = ref(database, ".info/connected");
  const connectedCallback = (snap) => {
    const connected = snap.val();
    isConnected = connected === true;
    
    // When connected, register onDisconnect for all active typing nodes
    if (isConnected) {
      typingNodesRef.forEach((nodeData, conversationId) => {
        if (nodeData.ref) {
          registerOnDisconnectForTyping(nodeData.ref, conversationId);
        }
      });
    }
  };
  onValue(connectedRef, connectedCallback);
  unsubscribeConnected = () => {
    if (connectedRef) {
      off(connectedRef, "value", connectedCallback);
    }
  };
}

/**
 * Cleanup typing system (call on app shutdown)
 */
export function cleanupTyping() {
  // Stop all typing for all conversations
  typingNodesRef.forEach((nodeData, conversationId) => {
    stopTyping(conversationId);
  });
  
  // Clean up all listeners
  typingListenersRef.forEach((listenerData, conversationId) => {
    if (listenerData.callback && listenerData.typingRef) {
      off(listenerData.typingRef, "value", listenerData.callback);
    }
    if (listenerData.evictInterval) {
      clearInterval(listenerData.evictInterval);
    }
  });
  typingListenersRef.clear();
  
  // Clean up server offset subscription
  if (unsubscribeServerOffset) {
    unsubscribeServerOffset();
    unsubscribeServerOffset = null;
  }
  
  // Clean up connected listener
  if (unsubscribeConnected) {
    unsubscribeConnected();
    unsubscribeConnected = null;
  }
  
  // Reset state
  typingNodesRef.clear();
  lastTypingWriteAt.clear();
  isTypingActive.clear();
  isConnected = false;
}

/* ----------------------------- SENDER FUNCTIONS ----------------------------- */

/**
 * Initialize typing for a conversation (call when entering a conversation)
 */
export async function initializeTypingForConversation(conversationId) {
  if (!conversationId) return;
  
  const userId = getCurrentUserId();
  if (!userId) return;
  
  // If already initialized, skip
  if (typingNodesRef.has(conversationId)) return;
  
  const typingRef = ref(database, `typing/${conversationId}/${userId}`);
  
  typingNodesRef.set(conversationId, {
    ref: typingRef,
  });
  
  // Register onDisconnect if already connected
  if (isConnected) {
    registerOnDisconnectForTyping(typingRef, conversationId);
  }
}

/**
 * Report that user is typing (call on input change/keydown)
 * Throttled to max once per TYPING_THROTTLE_MS
 */
export async function reportTyping(conversationId) {
  if (!conversationId) return;
  
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn('[Typing] Cannot report typing: user not authenticated');
    return;
  }
  
  // Initialize if not already done
  if (!typingNodesRef.has(conversationId)) {
    await initializeTypingForConversation(conversationId);
  }
  
  const nodeData = typingNodesRef.get(conversationId);
  if (!nodeData) return;
  
  const now = serverNow();
  const lastWrite = lastTypingWriteAt.get(conversationId) || 0;
  const timeSinceLastWrite = now - lastWrite;
  
  // If we just wrote recently, skip (throttle)
  if (timeSinceLastWrite < CONFIG.TYPING_THROTTLE_MS && isTypingActive.get(conversationId)) {
    return;
  }
  
  // Mark as active
  isTypingActive.set(conversationId, true);
  
  // Ensure onDisconnect is registered
  if (isConnected && nodeData.ref) {
    registerOnDisconnectForTyping(nodeData.ref, conversationId);
  }
  
  try {
    // Write typing indicator with server time
    // Include email for display name matching (since Users node is keyed by email, not uid)
    const userEmail = auth.currentUser?.email;
    await set(nodeData.ref, {
      t: now, // Server time for accurate TTL
      email: userEmail || null, // Email for display name lookup
    });
    
    lastTypingWriteAt.set(conversationId, now);
  } catch (error) {
    console.warn('[Typing] Error reporting typing:', error.message);
  }
}

/**
 * Stop typing indicator (call on send, blur, or when input becomes empty)
 */
export async function stopTyping(conversationId) {
  if (!conversationId) return;
  
  const userId = getCurrentUserId();
  if (!userId) return;
  
  const nodeData = typingNodesRef.get(conversationId);
  if (!nodeData) return;
  
  // Mark as inactive
  isTypingActive.set(conversationId, false);
  
  try {
    // Remove typing indicator
    await remove(nodeData.ref);
  } catch (error) {
    console.warn('[Typing] Error stopping typing:', error.message);
  }
}

/**
 * Cleanup typing for a conversation (call when leaving conversation)
 */
export async function cleanupTypingForConversation(conversationId) {
  if (!conversationId) return;
  
  // Stop typing if active
  await stopTyping(conversationId);
  
  // Remove node data
  typingNodesRef.delete(conversationId);
  lastTypingWriteAt.delete(conversationId);
  isTypingActive.delete(conversationId);
}

/* ----------------------------- RECEIVER FUNCTIONS ----------------------------- */

/**
 * Listen to typing indicators for a conversation
 * @param {string} conversationId - The conversation ID
 * @param {function} callback - Called with array of typing users: [{ userId (uid), name?, email? }]
 * @returns cleanup function
 */
export function listenToTyping(conversationId, callback) {
  if (!conversationId || !callback) {
    return () => {};
  }
  
  const typingRef = ref(database, `typing/${conversationId}`);
  
  // Keep server offset updated for TTL checks
  if (!unsubscribeServerOffset) {
    unsubscribeServerOffset = subscribeServerOffset();
  }
  
  let typingUsers = new Map(); // userId -> { userId, t (timestamp) }
  let evictInterval = null;
  
  // Function to evict expired typers
  const evictExpired = () => {
    const now = serverNow();
    let hasChanges = false;
    
    typingUsers.forEach((userData, userId) => {
      const timestamp = typeof userData.t === 'number' ? userData.t : 0;
      if (now - timestamp > CONFIG.TYPING_TTL_MS) {
        typingUsers.delete(userId);
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      emitTypingUsers();
    }
  };
  
  // Function to emit current typing users
  const emitTypingUsers = () => {
    const now = serverNow();
    const users = Array.from(typingUsers.values())
      .filter(userData => {
        const timestamp = typeof userData.t === 'number' ? userData.t : 0;
        return now - timestamp <= CONFIG.TYPING_TTL_MS;
      })
      .map(userData => ({
        userId: userData.userId,
        name: userData.name,
        email: userData.email,
      }));
    
    callback(users);
  };
  
  // Listen to typing changes
  const typingCallback = (snap) => {
    if (!snap.exists()) {
      typingUsers.clear();
      emitTypingUsers();
      return;
    }
    
    const typingData = snap.val();
    const now = serverNow();
    
    // Diff and update typing users map (optimize: only update changed users)
    const currentUserIds = new Set(typingUsers.keys());
    const newUserIds = new Set(Object.keys(typingData || {}));
    
    // Remove users that are no longer typing
    currentUserIds.forEach(userId => {
      if (!newUserIds.has(userId)) {
        typingUsers.delete(userId);
      }
    });
    
    // Add/update users that are typing
    Object.keys(typingData || {}).forEach((userId) => {
      const userTypingData = typingData[userId];
      if (!userTypingData) return;
      
      // Get timestamp (should be a number from serverNow())
      const timestamp = typeof userTypingData.t === 'number' ? userTypingData.t : now;
      
      // Only include if not expired
      if (now - timestamp <= CONFIG.TYPING_TTL_MS) {
        const existing = typingUsers.get(userId);
        // Only update if timestamp changed (avoid unnecessary re-renders)
        if (!existing || existing.t !== timestamp) {
          typingUsers.set(userId, {
            userId,
            t: timestamp,
            email: userTypingData.email || null, // Email from typing node for display name matching
          });
        }
      } else {
        // Remove if expired
        typingUsers.delete(userId);
      }
    });
    
    emitTypingUsers();
  };
  
  const errorCallback = (error) => {
    console.warn('[Typing] Error listening to typing indicators:', error.message);
    typingUsers.clear();
    emitTypingUsers();
  };
  
  onValue(typingRef, typingCallback, errorCallback);
  
  // Set up eviction interval
  evictInterval = setInterval(evictExpired, CONFIG.EVICT_INTERVAL_MS);
  
  // Store listener data (store callback for proper cleanup)
  typingListenersRef.set(conversationId, {
    callback: typingCallback,
    typingRef,
    evictInterval,
  });
  
  // Return cleanup function
  return () => {
    if (typingRef && typingCallback) {
      off(typingRef, "value", typingCallback);
    }
    if (evictInterval) {
      clearInterval(evictInterval);
    }
    typingListenersRef.delete(conversationId);
  };
}

/* ----------------------------- UI HELPERS ----------------------------- */

/**
 * Format typing indicator text (Slack-style)
 * @param {Array} typingUsers - Array of { userId (uid), name?, email? }
 * @param {Object} userMap - Optional map of userId (uid) -> { name, email } for display names
 * @returns {string} Formatted text like "Alex is typing..." or "Alex and 2 others are typing..."
 */
export function formatTypingIndicator(typingUsers, userMap = {}) {
  if (!typingUsers || typingUsers.length === 0) {
    return null;
  }
  
  // Get display names
  const names = typingUsers.map(user => {
    if (userMap[user.userId]) {
      return userMap[user.userId].name || userMap[user.userId].email || user.userId;
    }
    return user.name || user.email || user.userId;
  });
  
  if (names.length === 1) {
    return `${names[0]} is typing`;
  } else if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing`;
  } else {
    return `${names[0]} and ${names.length - 1} others are typing`;
  }
}
