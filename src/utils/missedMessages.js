import { database, auth } from '../firebase-init';
import { ref, onValue, off, set, get } from 'firebase/database';

/**
 * Missed Messages Notification System
 * Tracks missed messages per chat and provides badge counts
 */

// Get the current user's email
const getCurrentUserEmail = () => {
  return auth.currentUser?.email;
};

// Get the user's chat state path
const getUserChatStatePath = (userEmail, chatId) => {
  if (!userEmail || !chatId) return null;
  const formattedEmail = userEmail.replace(/\./g, ',');
  return `userChatState/${formattedEmail}/${chatId}`;
};

const contactKeyFromEmail = (email) => {
  if (!email) return null;
  if (email === 'everyone') return 'everyone';
  return String(email).replace(/\./g, ',');
};

export const getMissedMessageCountForContact = async (chatId, contactEmail) => {
  const userEmail = getCurrentUserEmail();
  const contactKey = contactKeyFromEmail(contactEmail);
  if (!userEmail || !chatId || !contactKey) return 0;

  const path = getUserChatStatePath(userEmail, chatId);
  if (!path) return 0;

  try {
    const snapshot = await get(ref(database, `${path}/contacts/${contactKey}/missedCount`));
    return snapshot.exists() ? snapshot.val() : 0;
  } catch (error) {
    console.error('Error getting missed message count for contact:', error);
    return 0;
  }
};

export const setMissedMessageCountForContact = async (chatId, contactEmail, count) => {
  const userEmail = getCurrentUserEmail();
  const contactKey = contactKeyFromEmail(contactEmail);
  if (!userEmail || !chatId || !contactKey) return;

  const path = getUserChatStatePath(userEmail, chatId);
  if (!path) return;

  try {
    await set(ref(database, `${path}/contacts/${contactKey}/missedCount`), count);
  } catch (error) {
    console.error('Error setting missed message count for contact:', error);
  }
};

const recomputeAndPersistChatMissedSum = async (chatId) => {
  const userEmail = getCurrentUserEmail();
  if (!userEmail || !chatId) return;

  const path = getUserChatStatePath(userEmail, chatId);
  if (!path) return;

  try {
    const snapshot = await get(ref(database, `${path}/contacts`));
    const contacts = snapshot.exists() ? snapshot.val() : {};
    const sum = Object.values(contacts || {}).reduce((acc, v) => acc + (v?.missedCount || 0), 0);
    await set(ref(database, `${path}/missedCount`), sum);
    return sum;
  } catch (error) {
    console.error('Error recomputing chat missed sum:', error);
    return 0;
  }
};

export const clearMissedMessagesForContact = async (chatId, contactEmail) => {
  const userEmail = getCurrentUserEmail();
  const contactKey = contactKeyFromEmail(contactEmail);
  if (!userEmail || !chatId || !contactKey) return;

  const path = getUserChatStatePath(userEmail, chatId);
  if (!path) return;

  try {
    await set(ref(database, `${path}/contacts/${contactKey}`), {
      missedCount: 0,
      lastReadMessageId: null,
      lastReadTime: Date.now()
    });
    const newSum = await recomputeAndPersistChatMissedSum(chatId);
    return newSum;
  } catch (error) {
    console.error('Error clearing missed messages for contact:', error);
  }
};

// Get missed message count for a specific chat
export const getMissedMessageCount = async (chatId) => {
  const userEmail = getCurrentUserEmail();
  if (!userEmail || !chatId) return 0;
  
  const path = getUserChatStatePath(userEmail, chatId);
  if (!path) return 0;
  
  try {
    const snapshot = await get(ref(database, `${path}/missedCount`));
    return snapshot.exists() ? snapshot.val() : 0;
  } catch (error) {
    console.error('Error getting missed message count:', error);
    return 0;
  }
};

// Set missed message count for a specific chat
export const setMissedMessageCount = async (chatId, count) => {
  const userEmail = getCurrentUserEmail();
  if (!userEmail || !chatId) return;
  
  const path = getUserChatStatePath(userEmail, chatId);
  if (!path) return;
  
  try {
    await set(ref(database, `${path}/missedCount`), count);
  } catch (error) {
    console.error('Error setting missed message count:', error);
  }
};

// Clear missed messages for a chat (when chat is opened)
export const clearMissedMessages = async (chatId) => {
  const userEmail = getCurrentUserEmail();
  if (!userEmail || !chatId) return;
  
  const path = getUserChatStatePath(userEmail, chatId);
  if (!path) return;
  
  try {
    await set(ref(database, path), {
      missedCount: 0,
      lastReadMessageId: null,
      lastReadTime: Date.now()
    });
  } catch (error) {
    console.error('Error clearing missed messages:', error);
  }
};

export const listenToContactMissedCounts = (chatId, callback) => {
  const userEmail = getCurrentUserEmail();
  if (!userEmail || !chatId) return null;

  const path = getUserChatStatePath(userEmail, chatId);
  if (!path) return null;

  const contactsRef = ref(database, `${path}/contacts`);
  const listener = onValue(contactsRef, (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() : {};
    const counts = {};
    Object.entries(data || {}).forEach(([contactKey, v]) => {
      counts[contactKey] = v?.missedCount || 0;
    });
    callback(counts);
  });

  return () => off(contactsRef, 'value', listener);
};

// Listen to missed message count changes for a chat
export const listenToMissedMessageCount = (chatId, callback) => {
  const userEmail = getCurrentUserEmail();
  if (!userEmail || !chatId) return null;
  
  const path = getUserChatStatePath(userEmail, chatId);
  if (!path) return null;
  
  const missedCountRef = ref(database, `${path}/missedCount`);
  
  const listener = onValue(missedCountRef, (snapshot) => {
    const count = snapshot.exists() ? snapshot.val() : 0;
    callback(count);
  });
  
  return () => off(missedCountRef, 'value', listener);
};

// Listen to missed message counts for multiple chats
export const listenToMultipleMissedCounts = (chatIds, callback) => {
  const userEmail = getCurrentUserEmail();
  if (!userEmail || !chatIds || chatIds.length === 0) return null;
  
  const formattedEmail = userEmail.replace(/\./g, ',');
  const basePath = `userChatState/${formattedEmail}`;
  
  const listener = onValue(ref(database, basePath), (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() : {};
    const counts = {};
    
    chatIds.forEach(chatId => {
      counts[chatId] = data[chatId]?.missedCount || 0;
    });
    
    callback(counts);
  });
  
  return () => off(ref(database, basePath), 'value', listener);
};

// Check if a message should be counted as missed
export const shouldCountAsMissed = (message, currentChatId) => {
  const userEmail = getCurrentUserEmail();
  if (!userEmail || !message) return false;
  
  // Don't count own messages
  if (message.email === userEmail) return false;
  
  // Don't count messages in currently opened chat
  // (This will be handled by the component that tracks current chat)
  return true;
};