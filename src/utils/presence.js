/**
 * Real-Time Presence System - Simplified and Robust
 * 
 * Key improvements:
 * - Single source of truth for status computation
 * - Proper synchronization to avoid race conditions
 * - Reliable stale detection
 * - Clean separation of concerns
 */

import { database, auth } from "../firebase-init";
import {
  ref,
  child,
  set,
  update,
  remove,
  onDisconnect,
  onValue,
  off,
  get,
} from "firebase/database";

/* ----------------------------- CONFIG ----------------------------- */

const CONFIG = {
  IDLE_THRESHOLD_MS: 10 * 60 * 1000, // 10 minutes
  STALE_THRESHOLD_MS: 30 * 60 * 1000, // 30 minutes after idle becomes stale
  HEARTBEAT_INTERVAL_MS: 10 * 1000, // 10 seconds
  DISCONNECT_GRACE_MS: 45 * 1000, // 45 seconds
  ACTIVITY_THROTTLE_MS: 2 * 1000, // 2 seconds
  LEADER_HEARTBEAT_MS: 2 * 1000, // leader announces itself every 2s
  LEADER_STALE_MS: 7 * 1000, // if we stop hearing leader, take over
};

const SESSION_TTL_MS =
  CONFIG.DISCONNECT_GRACE_MS + CONFIG.HEARTBEAT_INTERVAL_MS * 2;

/* ----------------------------- STATE ----------------------------- */

let sessionId = null;
let userEmailPath = null;
let sessionBaseRef = null;
let userPresenceRef = null;
let canonicalRef = null;
let serverOffsetMs = 0;
let isInitialized = false;
let isConnected = false;

// Leader election
let bc = null;
let isLeader = false;
let lastLeaderPingAt = 0;
let leaderPingTimer = null;

// Timers
let heartbeatTimer = null;
let canonicalTimer = null;

// Leader sessions listener (proper RTDB cleanup)
let leaderSessionsRef = null;
let leaderSessionsCb = null;

// Local activity
let lastLocalInteractionAt = 0;
let lastActivityWriteAt = 0;

// Cleanup functions
let unsubscribeConnected = null;
let unsubscribeServerOffset = null;
let removeActivityListeners = null;

/* ----------------------------- HELPERS ----------------------------- */

function safeEmailPath(email) {
  return email.replace(/\./g, ",");
}

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Subscribe to server time offset - keeps it updated in real-time
 * This is critical for accurate TTL/staleness calculations
 */
function subscribeServerOffset() {
  const offsetRef = ref(database, ".info/serverTimeOffset");
  return onValue(
    offsetRef,
    (snap) => {
      serverOffsetMs = snap.exists() ? snap.val() : 0;
    },
    () => {
      // On error, fall back to local time
      serverOffsetMs = 0;
    }
  );
}

/**
 * One-time initialization of server offset (for backward compatibility)
 */
async function initServerOffset() {
  try {
    const offsetRef = ref(database, ".info/serverTimeOffset");
    const snap = await get(offsetRef);
    serverOffsetMs = snap.exists() ? snap.val() : 0;
  } catch (error) {
    console.warn('[Presence] Could not read server time offset, using local time:', error.message);
    serverOffsetMs = 0;
  }
}

function serverNow() {
  return Date.now() + serverOffsetMs;
}

/**
 * Compute presence status from sessions data
 * This is the single source of truth for status computation
 */
function computeStatusFromSessions(sessions) {
  const now = serverNow();
  
  // Explicitly handle null, undefined, empty objects, or falsy values
  if (!sessions || typeof sessions !== 'object' || Object.keys(sessions).length === 0) {
    return "offline";
  }

  const sessionList = Object.values(sessions).filter(Boolean);
  if (sessionList.length === 0) {
    return "offline";
  }

  // Check if any session is alive (has recent heartbeat)
  const anyAlive = sessionList.some((s) => {
    if (!s || typeof s.lastHeartbeatAt !== "number") return false;
    return now - s.lastHeartbeatAt <= SESSION_TTL_MS;
  });

  if (!anyAlive) {
    return "offline";
  }

  // Status chain: Active → Idle → Stale → Offline
  // Use the BEST (most active) status across all alive sessions
  // If ANY session is active, user is active
  // If ANY session is idle (but none active), user is idle
  // If ANY session is stale (but none active/idle), user is stale
  // Only offline if NO sessions are alive
  
  let bestStatus = null; // Track best status found
  
  for (const s of sessionList) {
    if (!s || typeof s.lastActiveAt !== "number") continue;
    
    const timeSinceActivity = now - s.lastActiveAt;
    let sessionStatus = null;
    
    if (timeSinceActivity < CONFIG.IDLE_THRESHOLD_MS) {
      // Active: recent activity (< 20 seconds)
      sessionStatus = "active";
    } else if (timeSinceActivity < CONFIG.STALE_THRESHOLD_MS) {
      // Idle: no recent activity but within idle window (20s - 60s)
      sessionStatus = "idle";
    } else {
      // Stale: been inactive for a long time but still connected (>= 60s)
      sessionStatus = "stale";
    }
    
    // Track best (most active) status
    // Priority: active > idle > stale > offline
    if (sessionStatus === "active") {
      return "active"; // Best possible, can return immediately
    } else if (sessionStatus === "idle" && (bestStatus === null || bestStatus === "stale")) {
      bestStatus = "idle";
    } else if (sessionStatus === "stale" && bestStatus === null) {
      bestStatus = "stale";
    }
  }
  
  // If we found a status, return it; otherwise all sessions are offline
  return bestStatus || "offline";
}

/**
 * Get the most recent lastSeenAt from sessions
 */
function getLastSeenAtFromSessions(sessions) {
  if (!sessions || typeof sessions !== 'object') {
    return serverNow();
  }

  const sessionList = Object.values(sessions).filter(Boolean);
  if (sessionList.length === 0) {
    return serverNow();
  }

  const maxHeartbeat = sessionList.reduce((max, s) => {
    if (s && typeof s.lastHeartbeatAt === "number") {
      return Math.max(max, s.lastHeartbeatAt);
    }
    return max;
  }, 0);

  return maxHeartbeat > 0 ? maxHeartbeat : serverNow();
}

function setCanonicalStatus(status, lastSeenAt) {
  if (!canonicalRef) return Promise.resolve();
  
  const now = serverNow();
  return update(canonicalRef, {
    status,
    lastSeenAt: lastSeenAt ?? now,
    updatedAt: now,
  }).catch((err) => {
    console.warn('[Presence] Error updating canonical status:', err.message);
  });
}

/* ----------------------------- LEADER ELECTION ----------------------------- */

function startLeaderElection() {
  if (typeof BroadcastChannel === "undefined") {
    becomeLeader();
    return;
  }

  bc = new BroadcastChannel("presence_leader_v1");
  lastLeaderPingAt = Date.now();

  bc.onmessage = (e) => {
    const msg = e.data;
    if (!msg || msg.type !== "leader_ping") return;
    if (msg.userEmailPath !== userEmailPath) return;

    lastLeaderPingAt = Date.now();

    if (isLeader && msg.sessionId !== sessionId) {
      if (msg.sessionId < sessionId) {
        stopBeingLeader();
      }
    }
  };

  leaderPingTimer = setInterval(() => {
    const now = Date.now();
    const leaderIsStale = now - lastLeaderPingAt > CONFIG.LEADER_STALE_MS;

    if (!isLeader && leaderIsStale) {
      becomeLeader();
    }

    if (isLeader && bc) {
      bc.postMessage({
        type: "leader_ping",
        userEmailPath,
        sessionId,
        t: now,
      });
    }
  }, CONFIG.LEADER_HEARTBEAT_MS);
}

async function becomeLeader() {
  if (isLeader) return;
  
  isLeader = true;
  
  // Set initial canonical status by computing from actual sessions (not forcing "active")
  try {
    const sessionsSnap = await get(child(userPresenceRef, "sessions"));
    const sessions = sessionsSnap.exists() ? sessionsSnap.val() : null;
    const status = computeStatusFromSessions(sessions);
    const lastSeenAt = getLastSeenAtFromSessions(sessions);
    await setCanonicalStatus(status, lastSeenAt);
  } catch (e) {
    console.warn('[Presence] Could not set initial canonical status:', e.message);
  }
  
  // Start sessions listener to update canonical when sessions change
  startLeaderSessionsListener();
  
  startHeartbeat();
  startCanonicalTick();
}

function stopBeingLeader() {
  if (!isLeader) return;
  isLeader = false;
  stopHeartbeat();
  stopCanonicalTick();
  stopLeaderSessionsListener();
}

function stopLeaderElection() {
  stopBeingLeader();
  if (leaderPingTimer) {
    clearInterval(leaderPingTimer);
    leaderPingTimer = null;
  }
  if (bc) {
    try {
      bc.close();
    } catch (_) {}
    bc = null;
  }
}

/* ----------------------------- ACTIVITY ----------------------------- */

export function reportActivity() {
  if (!isInitialized) return;

  lastLocalInteractionAt = serverNow();

  if (!isLeader || !sessionBaseRef) return;

  const now = serverNow();
  if (now - lastActivityWriteAt < CONFIG.ACTIVITY_THROTTLE_MS) return;

  lastActivityWriteAt = now;
  update(sessionBaseRef, { lastActiveAt: now }).catch(() => {});
}

/* ----------------------------- HEARTBEAT ----------------------------- */

function startHeartbeat() {
  if (!isLeader || !sessionBaseRef) return;

  if (heartbeatTimer) clearInterval(heartbeatTimer);

  heartbeatTimer = setInterval(() => {
    if (!isLeader || !sessionBaseRef) return;
    const now = serverNow();
    update(sessionBaseRef, { lastHeartbeatAt: now }).catch(() => {});
  }, CONFIG.HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/* ----------------------------- LEADER: SESSIONS LISTENER (NO POLL) ----------------------------- */

function startLeaderSessionsListener() {
  if (!userPresenceRef || leaderSessionsCb) return;

  leaderSessionsRef = child(userPresenceRef, "sessions");

  leaderSessionsCb = async (snap) => {
    if (!isLeader) return;
    const sessions = snap.exists() ? snap.val() : null;
    // Cache for tick to use (no Firebase reads needed)
    cachedSessionsForTick = sessions;
    const status = computeStatusFromSessions(sessions);
    const lastSeenAt = getLastSeenAtFromSessions(sessions);
    await setCanonicalStatus(status, lastSeenAt);
  };

  onValue(leaderSessionsRef, leaderSessionsCb);
}

function stopLeaderSessionsListener() {
  if (leaderSessionsRef && leaderSessionsCb) {
    off(leaderSessionsRef, "value", leaderSessionsCb);
  }
  leaderSessionsRef = null;
  leaderSessionsCb = null;
}

/* ----------------------------- CANONICAL TICK (LEADER ONLY) ----------------------------- */

/**
 * Leader tick that recomputes from cached sessions (handles TTL transitions)
 * No Firebase reads - uses cached sessions from listener
 */
let cachedSessionsForTick = null;

function startCanonicalTick() {
  if (canonicalTimer) clearInterval(canonicalTimer);

  // Tick recomputes from cached sessions (updated by listener)
  // This handles TTL-based transitions (active -> idle -> offline) even when sessions don't change
  canonicalTimer = setInterval(() => {
    if (!isLeader) return;
    // Use cached sessions to recompute (handles TTL transitions)
    const status = computeStatusFromSessions(cachedSessionsForTick);
    const lastSeenAt = getLastSeenAtFromSessions(cachedSessionsForTick);
    setCanonicalStatus(status, lastSeenAt).catch(() => {});
  }, 1000); // Check every 1 second for TTL transitions
}

function stopCanonicalTick() {
  if (canonicalTimer) {
    clearInterval(canonicalTimer);
    canonicalTimer = null;
  }
  cachedSessionsForTick = null;
}

/* ----------------------------- ACTIVITY LISTENERS ----------------------------- */

function setupActivityListeners() {
  const onMove = () => reportActivity();
  const onKey = () => reportActivity();
  const onClick = () => reportActivity();
  const onFocus = () => reportActivity();
  const onVisibility = () => {
    if (document.visibilityState === "visible") reportActivity();
  };

  document.addEventListener("mousemove", onMove, { passive: true });
  document.addEventListener("keydown", onKey, { passive: true });
  document.addEventListener("click", onClick, { passive: true });
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);

  let scrollT = null;
  const onScroll = () => {
    if (scrollT) clearTimeout(scrollT);
    scrollT = setTimeout(() => reportActivity(), 300);
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("click", onClick);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("scroll", onScroll);
    if (scrollT) clearTimeout(scrollT);
  };
}

/* ----------------------------- INIT / CLEANUP ----------------------------- */

/**
 * Register onDisconnect for session removal only
 * Canonical should be computed from sessions by leader, not forced offline by one tab
 */
function registerOnDisconnectForSession(sessionRef) {
  // Only remove THIS session on disconnect.
  // Canonical should be computed from sessions, not forced offline by one tab.
  return onDisconnect(sessionRef).remove();
}

export async function initializePresence() {
  const user = auth.currentUser;
  if (!user?.email) return;

  // Subscribe to server offset for real-time updates
  unsubscribeServerOffset = subscribeServerOffset();
  // Also do one-time init for immediate use
  await initServerOffset();

  sessionId = generateSessionId();
  userEmailPath = safeEmailPath(user.email);

  userPresenceRef = ref(database, `presence/${userEmailPath}`);
  canonicalRef = ref(database, `presence/${userEmailPath}/canonical`);
  sessionBaseRef = ref(database, `presence/${userEmailPath}/sessions/${sessionId}`);

  const now = serverNow();

  // Create session
  await set(sessionBaseRef, {
    sessionId,
    userId: user.uid,
    userEmail: user.email,
    connectedAt: now,
    lastHeartbeatAt: now,
    lastActiveAt: now,
  });

  // Listen to .info/connected and register onDisconnect when connected
  const connectedRef = ref(database, ".info/connected");
  unsubscribeConnected = onValue(connectedRef, (snap) => {
    const connected = snap.val();
    isConnected = connected === true;
    
    if (isConnected && sessionBaseRef) {
      // Only remove session on disconnect - canonical computed from sessions by leader
      registerOnDisconnectForSession(sessionBaseRef).catch((err) => {
        console.warn('[Presence] Error setting onDisconnect:', err.message);
      });
    }
  });

  isInitialized = true;
  lastLocalInteractionAt = now;
  lastActivityWriteAt = 0;

  removeActivityListeners = setupActivityListeners();
  startLeaderElection();
  reportActivity();
}

export async function cleanupPresence() {
  if (!isInitialized) return;

  stopLeaderElection();

  if (unsubscribeConnected) {
    unsubscribeConnected();
    unsubscribeConnected = null;
  }

  if (unsubscribeServerOffset) {
    unsubscribeServerOffset();
    unsubscribeServerOffset = null;
  }

  if (sessionBaseRef) {
    try {
      await remove(sessionBaseRef);
    } catch (_) {}
  }

  if (removeActivityListeners) {
    removeActivityListeners();
    removeActivityListeners = null;
  }

  sessionId = null;
  userEmailPath = null;
  sessionBaseRef = null;
  userPresenceRef = null;
  canonicalRef = null;
  isInitialized = false;
  isConnected = false;
  
  // Clean up leader sessions listener
  stopLeaderSessionsListener();
}

/* ----------------------------- VIEWER SUBSCRIBE ----------------------------- */

/**
 * Viewers subscribe to both canonical and sessions nodes
 * - Sessions are PRIMARY source of truth (real-time via onDisconnect)
 * - Canonical is fallback (only if sessions unreadable or not loaded yet)
 * - Uses proper RTDB cleanup with off()
 */
export function listenToUserPresenceCanonical(userEmail, callback) {
  if (!userEmail) return () => {};

  const p = safeEmailPath(userEmail);
  const canonR = ref(database, `presence/${p}/canonical`);
  const sessR = ref(database, `presence/${p}/sessions`);

  // Initialize all state variables BEFORE any callbacks that might use them
  let sessionsLoaded = false;
  let sessionsErrored = false;
  let sessionsData = null;

  let canonicalLoaded = false;
  let canonicalData = null;

  let lastStatus = "offline";
  let first = true;

  // Define helper functions BEFORE any callbacks that might use them
  function computeFromCanonicalIfFresh() {
    const now = serverNow();
    if (!canonicalLoaded || !canonicalData) return "offline";

    const lastSeenAt = typeof canonicalData.lastSeenAt === "number" ? canonicalData.lastSeenAt : 0;
    const updatedAt = typeof canonicalData.updatedAt === "number" ? canonicalData.updatedAt : 0;
    const mostRecent = Math.max(lastSeenAt, updatedAt);

    if (!mostRecent) return "offline";
    if (now - mostRecent > SESSION_TTL_MS) return "offline";

    return canonicalData.status || "offline";
  }

  function computeCurrent() {
    // PRIMARY: sessions (real-time truth) - ALWAYS check first if loaded
    if (sessionsLoaded && !sessionsErrored) {
      // Explicitly check for null/empty - when user closes tab, sessionsData becomes null
      if (sessionsData === null || (typeof sessionsData === 'object' && Object.keys(sessionsData).length === 0)) {
        return "offline";
      }
      return computeStatusFromSessions(sessionsData);
    }

    // fallback: canonical (if sessions unreadable)
    if (sessionsErrored) {
      return computeFromCanonicalIfFresh();
    }

    // if sessions not loaded yet, use canonical if available to avoid "flash offline"
    if (canonicalLoaded) {
      return computeFromCanonicalIfFresh();
    }

    return lastStatus;
  }

  function emitIfChanged() {
    const s = computeCurrent();
    // Always emit on first call, then only when status actually changes
    if (first || s !== lastStatus) {
      if (s !== lastStatus) {
        console.log(`[Presence] Status changed for ${userEmail}: ${lastStatus} -> ${s}`);
      }
      first = false;
      lastStatus = s;
      callback(s, canonicalData || null);
    }
  }

  // Keep offset updated for TTL checks - CRITICAL for accurate stale detection
  const offsetR = ref(database, ".info/serverTimeOffset");
  const offsetCb = (snap) => {
    const newOffset = snap.exists() ? snap.val() : 0;
    if (newOffset !== serverOffsetMs) {
      serverOffsetMs = newOffset;
      // When offset changes, recompute status immediately (time calculations might change)
      emitIfChanged();
    } else {
      serverOffsetMs = newOffset;
    }
  };
  onValue(offsetR, offsetCb);

  const canonicalCb = (snap) => {
    canonicalLoaded = true;
    canonicalData = snap.val();
    emitIfChanged();
  };

  const sessionsCb = (snap) => {
    sessionsLoaded = true;
    sessionsErrored = false;
    // When user closes tab, snap.exists() is false, so sessionsData becomes null
    // When user comes back, snap.exists() is true and contains new session
    const newSessionsData = snap.exists() ? snap.val() : null;
    
    // Log for debugging
    const oldSessionCount = sessionsData ? Object.keys(sessionsData).length : 0;
    const newSessionCount = newSessionsData ? Object.keys(newSessionsData).length : 0;
    
    if (oldSessionCount !== newSessionCount || sessionsData !== newSessionsData) {
      console.log(`[Presence] Sessions changed for ${userEmail}:`, 
        sessionsData ? oldSessionCount + ' sessions' : 'null',
        '->',
        newSessionsData ? newSessionCount + ' sessions' : 'null'
      );
    }
    
    // Store old state before updating
    const hadSessions = sessionsData && Object.keys(sessionsData).length > 0;
    const wasOffline = lastStatus === "offline";
    
    // Update sessions data
    sessionsData = newSessionsData;
    
    // Check if user came back (went from no sessions to having sessions)
    const nowHasSessions = newSessionsData && Object.keys(newSessionsData).length > 0;
    const userCameBack = !hadSessions && nowHasSessions;
    
    // CRITICAL: Always recompute and emit when sessions change
    // This catches: user coming back online, user going offline, new sessions added
    // We MUST recompute because sessionsData has changed
    const newStatus = computeCurrent();
    
    // Always emit on first call OR when status changes OR when user comes back
    if (first || newStatus !== lastStatus || userCameBack) {
      if (newStatus !== lastStatus || userCameBack) {
        console.log(`[Presence] Status update from sessions change for ${userEmail}: ${lastStatus} -> ${newStatus}`, 
          userCameBack ? '(user came back online)' : '');
      }
      first = false;
      lastStatus = newStatus;
      callback(newStatus, canonicalData || null);
    }
  };

  const sessionsErrCb = (err) => {
    console.warn("[Presence] sessions listener error:", err?.message || err);
    sessionsErrored = true;
    sessionsLoaded = false;
    sessionsData = null;
    emitIfChanged();
  };

  onValue(canonR, canonicalCb);
  onValue(sessR, sessionsCb, sessionsErrCb);

  // Initial check after a brief delay to let listeners fire
  const initialTimeout = setTimeout(() => {
    emitIfChanged();
  }, 100);

  // Additional check after a longer delay to catch cases where presence
  // is initialized after the listener is set up (race condition fix)
  const retryTimeout = setTimeout(() => {
    emitIfChanged();
  }, 2000); // 2 second delay to ensure presence system is initialized

  // CRITICAL: Continuous check to catch TTL-based transitions (active -> idle -> offline)
  // This ensures status updates even when Firebase doesn't fire events
  // Also catches when user comes back online after being offline
  // Check every 500ms for faster updates
  const checkInterval = setInterval(() => {
    // Always recompute from latest sessionsData (not cached status)
    // This catches:
    // 1. TTL transitions (active -> idle -> offline)
    // 2. User coming back online (sessions reappear) - CRITICAL for your use case
    // 3. Stale sessions that should be marked offline
    // 
    // IMPORTANT: We recompute every time, not just when status changes,
    // because sessionsData might have changed but status computation might
    // have been wrong due to stale server offset or timing issues
    const currentStatus = computeCurrent();
    if (first || currentStatus !== lastStatus) {
      if (currentStatus !== lastStatus) {
        console.log(`[Presence] Status update from continuous check for ${userEmail}: ${lastStatus} -> ${currentStatus}`);
        console.log(`[Presence] Sessions data:`, sessionsData ? `${Object.keys(sessionsData).length} sessions` : 'null');
      }
      first = false;
      lastStatus = currentStatus;
      callback(currentStatus, canonicalData || null);
    }
  }, 500);

  return () => {
    try {
      off(canonR, "value", canonicalCb);
      off(sessR, "value", sessionsCb);
      off(offsetR, "value", offsetCb);
      clearTimeout(initialTimeout);
      clearTimeout(retryTimeout);
      clearInterval(checkInterval);
    } catch (_) {}
  };
}

/**
 * Compatibility wrapper
 */
export function listenToUserPresence(userEmail, callback) {
  return listenToUserPresenceCanonical(userEmail, (presence) => callback(presence));
}

/* ----------------------------- UI HELPERS ----------------------------- */

export function getPresenceColor(presence) {
  if (presence === "active") return "#10b981"; // green - actively interacting
  if (presence === "idle") return "#f59e0b"; // yellow - still connected, short inactivity
  if (presence === "stale") return "#f97316"; // orange - still connected, prolonged inactivity
  return "#ef4444"; // red - offline/not here (no connection)
}

export function getPresenceLabel(presence) {
  if (presence === "active") return "Active";
  if (presence === "idle") return "Idle";
  if (presence === "stale") return "Away";
  return "Offline";
}

