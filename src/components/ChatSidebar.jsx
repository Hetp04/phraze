import { useState, useEffect } from 'react';
import { getMainCompanyEmail, currentUsername, initUsernameFetcher, getFirebaseData, saveFirebaseData, updateProfilePicture, acceptProjectInviteCode, showToast, getUIState, setUIState, removeUIState } from '../funcs';
import ShareModal from './ShareModal';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';

import { ref, onValue, off, remove, set } from 'firebase/database';
import { database, auth } from '../firebase-init';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useExtension } from "../context/ExtensionContext";
import { useRef } from 'react';
import { getImagePath } from '../utils/assetPaths';
import SidebarProfileDropdown from './SidebarProfileDropdown';
import { listenToUserPresenceCanonical, getPresenceColor, getPresenceLabel } from '../utils/presence';
import { listenToMultipleMissedCounts } from '../utils/missedMessages';

// Smooth CSS transitions - only width and specific properties
const sidebarAnimationStyles = `
  .sidebar-transition {
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: left center;
  }
  
  .profile-smooth-transition {
    transition: opacity 0.3s ease, visibility 0.3s ease !important;
  }
  
  .expand-button-smooth {
    transition: opacity 0.3s ease, visibility 0.3s ease;
    opacity: 1;
  }
`;

// Inject styles into document head
if (typeof document !== 'undefined' && !document.getElementById('sidebar-animations')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'sidebar-animations';
  styleSheet.textContent = sidebarAnimationStyles;
  document.head.appendChild(styleSheet);
}

export default function ChatSidebar({ onChatSelect, isCollapsed, setIsCollapsed, currentProject, onProjectChange, isLibraryVisible, setIsLibraryVisible, setIsExtensionSidebarVisible, showSearchOverlay, setShowSearchOverlay, onChatsUpdate, currentChat, onChatModeChange }) {
  const { userProfile, isAuthenticated } = useAuth();
  
  // Use context data for current user
  const userDisplayName = userProfile.username || '';
  const firstName = userProfile.firstName || '';
  const lastName = userProfile.lastName || '';
  const isLoggedIn = isAuthenticated;
  const [chats, setChats] = useState([]);
  const [sharedChats, setSharedChats] = useState([]);
  const [companyEmail, setCompanyEmail] = useState('');
  const [sharedPeopleProfilePics, setSharedPeopleProfilePics] = useState({});
  const sharedPeopleProfilePicListenersRef = useRef(new Map()); // Track profile picture listeners (email -> unsubscribe function)
  const [sharedChatsWithPeople, setSharedChatsWithPeople] = useState({});
  const [sharedPeoplePresence, setSharedPeoplePresence] = useState({}); // Store presence status for shared people
  const sharedPeoplePresenceListenersRef = useRef(new Map()); // Track presence listeners (email -> cleanup function)
  const [missedMessageCounts, setMissedMessageCounts] = useState({}); // Track missed message counts per chat
  const missedMessageListenerRef = useRef(null); // Track missed message listener cleanup
  const [projects, setProjects] = useState([]);
  const [sharedProjects, setSharedProjects] = useState([]);
  const globalMessageListenersRef = useRef(new Map()); // Track global message listeners for all chats
  const globalMessageInitialLoadRef = useRef(new Map()); // chatId -> boolean
  const globalMessageSeenIdsRef = useRef(new Map()); // chatId -> Set(messageId)
  const globalPrivateSourceInitialLoadRef = useRef(new Map()); // sourceKey -> boolean
  const globalProjectListenersRef = useRef(new Map()); // key -> cleanup

  const isActiveConversationOpen = (projectId, chatId, fromEmail) => {
    try {
      const ctx = window.__phrazeActiveMessagingContext;
      if (!ctx || !ctx.isConversationOpen) return false;

      // If both sides have a projectId, require it to match.
      if (ctx.projectId && projectId && String(ctx.projectId) !== String(projectId)) return false;
      if (!ctx.chatId || ctx.chatId !== chatId) return false;
      if (!ctx.contactEmail || !fromEmail) return false;

      // Normalize: compare raw emails (Messages uses raw emails, missed uses comma format elsewhere)
      const a = String(ctx.contactEmail).toLowerCase();
      const b = String(fromEmail).toLowerCase();
      return a === b;
    } catch (_) {
      return false;
    }
  };

  // Notify parent component when chats change
  useEffect(() => {
    if (onChatsUpdate && typeof onChatsUpdate === 'function') {
      onChatsUpdate(chats, sharedChats);
    }
    // Removed excessive logging
    // console.log('useEffect', chats);
  }, [chats, sharedChats, onChatsUpdate]);

  // Listen to missed message counts globally (independent of chats/sharedChats state)
  useEffect(() => {
    // Clean up previous listener
    if (missedMessageListenerRef.current) {
      missedMessageListenerRef.current();
      missedMessageListenerRef.current = null;
    }

    if (!isLoggedIn) {
      setMissedMessageCounts({});
      return;
    }

    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      setMissedMessageCounts({});
      return;
    }

    const userEmailKey = String(userEmail).replace(/\./g, ',');
    const baseRef = ref(database, `userChatState/${userEmailKey}`);

    const listener = onValue(baseRef, (snapshot) => {
      const data = snapshot.exists() ? snapshot.val() : {};
      const counts = {};
      Object.entries(data || {}).forEach(([chatId, v]) => {
        counts[chatId] = v?.missedCount || 0;
      });
      setMissedMessageCounts(counts);
    });

    missedMessageListenerRef.current = () => off(baseRef, 'value', listener);

    return () => {
      if (missedMessageListenerRef.current) {
        missedMessageListenerRef.current();
        missedMessageListenerRef.current = null;
      }
    };
  }, [isLoggedIn]);

  // Set up global message listeners for all chats to detect new messages.
  // NOTE: In this app, chat sidebar rows correspond to a topic like `groqChats-{chatId}`.
  // Messages can exist in:
  // - Everyone thread: Companies/{companyEmail}/securedProjects/{projectId}/messages/{topic}/everyone
  // - 1:1 threads: privateMessages/{emailPair}/{ownerCompany}/{projectId}/{topic}
  useEffect(() => {
    // Cleanup existing listeners first
    globalMessageListenersRef.current.forEach((cleanup) => cleanup());
    globalMessageListenersRef.current.clear();
    globalMessageInitialLoadRef.current.clear();
    globalMessageSeenIdsRef.current.clear();
    globalPrivateSourceInitialLoadRef.current.clear();
    globalProjectListenersRef.current.forEach((cleanup) => cleanup());
    globalProjectListenersRef.current.clear();

    if (!isLoggedIn) {
      return;
    }

    const userEmail = auth.currentUser?.email;
    if (!userEmail) return;

    const userCompanyEmailFromStorage = localStorage.getItem('companyEmail');
    const userCompanyEmailPath = (userCompanyEmailFromStorage || '').replace(/\./g, ',');
    if (!userCompanyEmailPath) return;

    const userEmailFormatted = userEmail.replace(/\./g, ',');
    const discoveredChatIdsByProject = new Map(); // projectKey -> Set(chatId)
    const privateUnsubsByProject = new Map(); // projectKey -> Map(key, unsub)

    const upsertProjectChatId = (projectKey, chatId) => {
      if (!projectKey || !chatId) return;
      const setRef = discoveredChatIdsByProject.get(projectKey) || new Set();
      setRef.add(chatId);
      discoveredChatIdsByProject.set(projectKey, setRef);
    };

    const cleanupPrivateListenersForProject = (projectKey) => {
      const m = privateUnsubsByProject.get(projectKey);
      if (!m) return;
      m.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
      m.clear();
    };

    const setupEveryoneListener = (ownerCompany, projectId, chatId) => {
      const listenerKey = `everyone:${ownerCompany}:${projectId}:${chatId}`;
      if (globalMessageListenersRef.current.has(listenerKey)) return;

      const topic = `groqChats-${chatId}`;
      const messagesPath = `Companies/${ownerCompany}/securedProjects/${projectId}/messages/${topic}/everyone`;
      const messagesRef = ref(database, messagesPath);

      const listener = (snapshot) => {
        const data = snapshot.val();
        const seenSetKey = listenerKey;

        const prevSeen = globalMessageSeenIdsRef.current.get(seenSetKey) || new Set();
        const nextSeen = new Set(prevSeen);

        if (snapshot.exists() && data && typeof data === 'object') {
          Object.entries(data).forEach(([messageId, msg]) => {
            const seenKey = `e:${String(messageId)}`;
            nextSeen.add(seenKey);

            const isInitialLoad = globalMessageInitialLoadRef.current.get(seenSetKey) !== false;
            if (isInitialLoad) return;

            const isNew = !prevSeen.has(seenKey);
            const isFromOtherUser = msg?.email && msg.email !== userEmail;
            if (isNew && isFromOtherUser) {
              // No-op: missed counts are incremented server-side (Cloud Functions)
              // to support offline accumulation and prevent double counting.
            }
          });
        }

        globalMessageSeenIdsRef.current.set(seenSetKey, nextSeen);
        if (globalMessageInitialLoadRef.current.get(seenSetKey) !== false) {
          globalMessageInitialLoadRef.current.set(seenSetKey, false);
        }
      };

      const unsubscribe = onValue(messagesRef, listener);
      globalMessageListenersRef.current.set(listenerKey, () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      });
    };

    const accessibleProjects = [];
    (projects || []).forEach((projectId) => {
      if (!projectId) return;
      accessibleProjects.push({ ownerCompany: userCompanyEmailPath, projectId, projectKey: `own:${userCompanyEmailPath}:${projectId}` });
    });
    (sharedProjects || []).forEach((p) => {
      if (!p?.projectId || !p?.ownerCompany) return;
      const ownerCompany = String(p.ownerCompany).replace(/\./g, ',');
      accessibleProjects.push({ ownerCompany, projectId: p.projectId, projectKey: `shared:${ownerCompany}:${p.projectId}` });
    });

    // Fallback: ensure we at least attach to current project context immediately
    // even if projects/sharedProjects state hasn't loaded yet.
    const lsCurrentProject = localStorage.getItem('currentProject') || '';
    if (lsCurrentProject) {
      accessibleProjects.push({
        ownerCompany: userCompanyEmailPath,
        projectId: lsCurrentProject,
        projectKey: `ls:own:${userCompanyEmailPath}:${lsCurrentProject}`
      });
    }
    const lsSharedProjectId = localStorage.getItem('sharedProjectId') || '';
    const lsSharedCompanyEmail = localStorage.getItem('sharedCompanyEmail') || '';
    if (lsSharedProjectId && lsSharedCompanyEmail) {
      const ownerCompany = String(lsSharedCompanyEmail).replace(/\./g, ',');
      accessibleProjects.push({
        ownerCompany,
        projectId: lsSharedProjectId,
        projectKey: `ls:shared:${ownerCompany}:${lsSharedProjectId}`
      });
    }

    // Deduplicate
    const seenProj = new Set();
    const uniqueProjects = [];
    accessibleProjects.forEach((p) => {
      if (!p?.projectKey || seenProj.has(p.projectKey)) return;
      seenProj.add(p.projectKey);
      uniqueProjects.push(p);
    });

    // Discover chats per project and attach everyone listeners
    uniqueProjects.forEach(({ ownerCompany, projectId, projectKey }) => {
      const groqChatsRef = ref(database, `Companies/${ownerCompany}/projects/${projectId}/groqChats`);
      const unsubscribeGroq = onValue(groqChatsRef, (snap) => {
        const data = snap.val() || {};
        if (!data || typeof data !== 'object') return;
        Object.keys(data).forEach((chatId) => {
          upsertProjectChatId(projectKey, chatId);
          setupEveryoneListener(ownerCompany, projectId, chatId);
        });
      });
      globalProjectListenersRef.current.set(`groq:${projectKey}`, () => {
        if (typeof unsubscribeGroq === 'function') unsubscribeGroq();
      });
    });

    // 1:1 private messages live under privateMessages/{emailPair}/... and are not chat-specific.
    // We CANNOT read privateMessages root due to rules (permission denied). Instead, derive
    // relevant emailPairs from project membership and listen only to those paths.
    const computeEmailPair = (otherEmailFormatted) => {
      if (!otherEmailFormatted) return null;
      if (otherEmailFormatted === 'everyone') return 'everyone';
      return userEmailFormatted < otherEmailFormatted
        ? `${userEmailFormatted}-${otherEmailFormatted}`
        : `${otherEmailFormatted}-${userEmailFormatted}`;
    };

    // Private message listeners per project membership (owned projects only for now).
    // We derive emailPairs from each project's members and attach listeners at:
    // privateMessages/{emailPair}/{ownerCompany}/{projectId}/{topic}
    uniqueProjects.forEach(({ ownerCompany, projectId, projectKey }) => {
        const membersRef = ref(database, `Companies/${ownerCompany}/projects/${projectId}/members`);
        const unsubscribeMembers = onValue(membersRef, (membersSnap) => {
          cleanupPrivateListenersForProject(projectKey);
          const membersData = membersSnap.val();
          if (!membersSnap.exists() || !membersData || typeof membersData !== 'object') return;

          const projectPrivateMap = privateUnsubsByProject.get(projectKey) || new Map();
          privateUnsubsByProject.set(projectKey, projectPrivateMap);

          const memberEmailsFormatted = Object.keys(membersData);
          memberEmailsFormatted.forEach((memberEmailFormatted) => {
            if (!memberEmailFormatted || memberEmailFormatted === userEmailFormatted) return;
            const emailPair = computeEmailPair(memberEmailFormatted);
            if (!emailPair) return;

            const secureBasePath = `privateMessages/${emailPair}/${ownerCompany}/${projectId}`;
            const legacyBasePath = `privateMessages/${emailPair}/${projectId}`;

            [secureBasePath, legacyBasePath].forEach((basePath, idx) => {
              const baseRef = ref(database, basePath);
              const sourceKey = `p:${projectKey}:${emailPair}:${idx}`;
              const listener = (snap) => {
                const baseData = snap.val() || {};
                if (typeof baseData !== 'object') {
                  if (globalPrivateSourceInitialLoadRef.current.get(sourceKey) !== false) {
                    globalPrivateSourceInitialLoadRef.current.set(sourceKey, false);
                  }
                  return;
                }

                Object.entries(baseData).forEach(([topicKey, topicMessages]) => {
                  if (typeof topicKey !== 'string' || !topicKey.startsWith('groqChats-')) return;
                  const cid = topicKey.replace('groqChats-', '');
                  const allowedSet = discoveredChatIdsByProject.get(projectKey) || new Set();
                  if (!cid || !allowedSet.has(cid)) return;

                  const prevSeen = globalMessageSeenIdsRef.current.get(sourceKey + ':' + cid) || new Set();
                  const nextSeen = new Set(prevSeen);

                  if (topicMessages && typeof topicMessages === 'object') {
                    Object.entries(topicMessages).forEach(([messageId, msg]) => {
                      const seenKey = `${sourceKey}:${String(messageId)}`;
                      nextSeen.add(seenKey);

                      const isInitialLoad = globalPrivateSourceInitialLoadRef.current.get(sourceKey) !== false;
                      if (isInitialLoad) return;

                      const isNew = !prevSeen.has(seenKey);
                      const isFromOtherUser = msg?.email && msg.email !== userEmail;
                      if (isNew && isFromOtherUser) {
                        // No-op: missed counts are incremented server-side (Cloud Functions)
                        // to support offline accumulation and prevent double counting.
                      }
                    });
                  }

                  globalMessageSeenIdsRef.current.set(sourceKey + ':' + cid, nextSeen);
                });

                if (globalPrivateSourceInitialLoadRef.current.get(sourceKey) !== false) {
                  globalPrivateSourceInitialLoadRef.current.set(sourceKey, false);
                }
              };

              const unsubscribePrivate = onValue(baseRef, listener);
              projectPrivateMap.set(`${emailPair}:${idx}`, () => {
                if (typeof unsubscribePrivate === 'function') unsubscribePrivate();
              });
            });
          });
        });

        globalProjectListenersRef.current.set(`members:${projectKey}`, () => {
          if (typeof unsubscribeMembers === 'function') unsubscribeMembers();
          cleanupPrivateListenersForProject(projectKey);
        });
      });

    return () => {
      globalMessageListenersRef.current.forEach((cleanup) => cleanup());
      globalMessageListenersRef.current.clear();
      globalMessageInitialLoadRef.current.clear();
      globalMessageSeenIdsRef.current.clear();
      globalPrivateSourceInitialLoadRef.current.clear();
      globalProjectListenersRef.current.forEach((cleanup) => cleanup());
      globalProjectListenersRef.current.clear();
      privateUnsubsByProject.forEach((_, projectKey) => cleanupPrivateListenersForProject(projectKey));
      privateUnsubsByProject.clear();
    };
  }, [isLoggedIn, projects, sharedProjects]);

  // Function to fetch profile pictures for shared people
  const fetchSharedPeopleProfilePics = async (sharedPeople) => {
    console.log('🚀 fetchSharedPeopleProfilePics called with:', sharedPeople);
    if (!sharedPeople || Object.keys(sharedPeople).length === 0) {
      console.log('❌ fetchSharedPeopleProfilePics - Early return: no shared people');
      return;
    }
    
    const profilePics = {};
    const emails = Object.keys(sharedPeople);
    console.log('📧 Emails to fetch profile pics for:', emails);
    
    // sharedPeople is an object, so we need to get the keys (emails)
    for (const email of emails) {
      console.log(`🔄 Fetching profile pic for: ${email}`);
      try {
        // Get company email for this user
        const userEmailFormatted = email.replace(/\./g, ',');
        console.log(`🔄 Formatted email: ${userEmailFormatted}`);
        
        const companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${userEmailFormatted}`);
        console.log(`🔄 Company email path for ${email}:`, companyEmailPath);
        
        if (companyEmailPath) {
          // Fetch profile image
          const imageData = await getFirebaseData(`Companies/${companyEmailPath}/users/${userEmailFormatted}/profileImage`);
          console.log(`🔄 Profile image data for ${email}:`, imageData ? 'FOUND' : 'NOT FOUND');
          // Only set if we have actual image data - don't overwrite with default
          if (imageData) {
            profilePics[email] = imageData;
          }
          // If no imageData, don't set anything - let it use existing value or default in render
        } else {
          console.log(`❌ No company email path found for ${email}`);
        }
      } catch (error) {
        console.error(`❌ Error fetching profile picture for ${email}:`, error);
      }
    }
    console.log('✅ Final profilePics object:', profilePics);
    // Only update state if we have new profile pictures to add
    if (Object.keys(profilePics).length > 0) {
      setSharedPeopleProfilePics(prev => {
        // Only merge in new values
        const newState = { ...prev };
        Object.keys(profilePics).forEach(email => {
          if (profilePics[email]) {
            newState[email] = profilePics[email];
          }
        });
        console.log('✅ Updated sharedPeopleProfilePics state:', newState);
        return newState;
      });
      
      // Set up real-time listeners for profile picture updates
      // Use Promise.all to set up all listeners in parallel
      Promise.all(
        Object.keys(profilePics).map(async (email) => {
          // Skip if we're already listening to this email
          if (sharedPeopleProfilePicListenersRef.current.has(email)) {
            return;
          }
          
          // Only set up listener if we have a valid profile picture (meaning we found their company)
          if (profilePics[email]) {
            try {
              const userEmailFormatted = email.replace(/\./g, ',');
              const companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${userEmailFormatted}`);
              
              if (companyEmailPath) {
                const profilePicPath = `Companies/${companyEmailPath}/users/${userEmailFormatted}/profileImage`;
                const profilePicRef = ref(database, profilePicPath);
                
                const unsubscribe = onValue(profilePicRef, (snapshot) => {
                  const newProfilePic = snapshot.val();
                  if (newProfilePic) {
                    console.log(`🔄 Real-time profile pic update for ${email}`);
                    setSharedPeopleProfilePics(prev => ({
                      ...prev,
                      [email]: newProfilePic
                    }));
                  }
                });
                
                sharedPeopleProfilePicListenersRef.current.set(email, unsubscribe);
              }
            } catch (error) {
              console.error(`❌ Error setting up profile picture listener for ${email}:`, error);
            }
          }
        })
      );
    }
  };

  // Function to fetch sharedPeople data and current title for shared chats from sharedChats path
  const fetchSharedPeopleForChat = async (chat) => {
    if (chat.isShared && !chat.isSender && chat.companyEmail && chat.project && chat.originalId) {
      try {
        const originalChatPath = `Companies/${chat.companyEmail}/projects/${chat.project}/groqChats/${chat.originalId}`;
        
        // Fetch both sharedPeople and current title from original chat
        const [sharedPeopleData, originalChatData] = await Promise.all([
          getFirebaseData(`${originalChatPath}/sharedPeople`),
          getFirebaseData(originalChatPath)
        ]);
        
        if (sharedPeopleData) {
          console.log(`✅ Fetched sharedPeople for chat ${chat.id}:`, sharedPeopleData);
          setSharedChatsWithPeople(prev => ({
            ...prev,
            [chat.id]: sharedPeopleData
          }));
          
          // Also fetch profile pictures for these shared people
          fetchSharedPeopleProfilePics(sharedPeopleData);
        } else {
          console.log(`❌ No sharedPeople found for chat ${chat.id}`);
        }
        
        // Update the chat title with the current title from the original chat
        if (originalChatData && originalChatData.title && originalChatData.title !== chat.title) {
          console.log(`🔄 Updating title for chat ${chat.id}: "${chat.title}" → "${originalChatData.title}"`);
          setSharedChats(prev => prev.map(c => 
            c.id === chat.id 
              ? { ...c, title: originalChatData.title }
              : c
          ));
        }
      } catch (error) {
        console.error(`❌ Error fetching sharedPeople for chat ${chat.id}:`, error);
      }
    }
  };

  const openChatAndClearMissed = (chatId, isShared = false) => {
    // Navigation only: do NOT clear missed counts from the sidebar.
    // Counts are cleared only when a specific contact is opened inside Messages.
    openChat(chatId, isShared);
  };

  // Fetch profile pictures when shared chats change
  useEffect(() => {
    // Collect all unique emails from all shared chats
    const allSharedPeopleEmails = new Set();
    
    sharedChats.forEach(chat => {
      // For company shared chats (isSender: true), use existing sharedPeople
      if (chat.isSender && chat.sharedPeople && Object.keys(chat.sharedPeople).length > 0) {
        Object.keys(chat.sharedPeople).forEach(email => allSharedPeopleEmails.add(email));
        fetchSharedPeopleProfilePics(chat.sharedPeople);
      }
      
      // For shared chats from sharedChats path (isSender: false or undefined), fetch sharedPeople
      if (!chat.isSender && chat.isShared) {
        fetchSharedPeopleForChat(chat);
      }
    });
    
    // Clean up listeners for emails that are no longer in any shared chat
    sharedPeopleProfilePicListenersRef.current.forEach((unsubscribe, email) => {
      if (!allSharedPeopleEmails.has(email)) {
        unsubscribe();
        sharedPeopleProfilePicListenersRef.current.delete(email);
      }
    });
    
    // Cleanup function
    return () => {
      // Clean up all listeners on unmount
      sharedPeopleProfilePicListenersRef.current.forEach((unsubscribe) => {
        unsubscribe();
      });
      sharedPeopleProfilePicListenersRef.current.clear();
    };
  }, [sharedChats]);

  // Set up presence listeners for all shared people
  useEffect(() => {
    // Collect all unique emails from all shared chats and sharedChatsWithPeople
    const allSharedPeopleEmails = new Set();
    
    // Collect from sharedChats
    sharedChats.forEach(chat => {
      if (chat.isSender && chat.sharedPeople && Object.keys(chat.sharedPeople).length > 0) {
        Object.keys(chat.sharedPeople).forEach(email => allSharedPeopleEmails.add(email));
      }
    });
    
    // Collect from sharedChatsWithPeople
    Object.values(sharedChatsWithPeople).forEach(sharedPeople => {
      if (sharedPeople && typeof sharedPeople === 'object') {
        Object.keys(sharedPeople).forEach(email => allSharedPeopleEmails.add(email));
      }
    });
    
    // Clean up presence listeners for emails that are no longer in any shared chat
    sharedPeoplePresenceListenersRef.current.forEach((cleanup, email) => {
      if (!allSharedPeopleEmails.has(email)) {
        if (typeof cleanup === 'function') {
          cleanup();
        }
        sharedPeoplePresenceListenersRef.current.delete(email);
        // Remove from presence state
        setSharedPeoplePresence(prev => {
          const next = { ...prev };
          delete next[email];
          return next;
        });
      }
    });
    
    // Set up presence listeners for new shared people
    allSharedPeopleEmails.forEach(email => {
      // Skip if we're already listening to this email
      if (sharedPeoplePresenceListenersRef.current.has(email)) {
        return;
      }
      
      // Set up presence listener
      const cleanupPresence = listenToUserPresenceCanonical(email, (presence) => {
        setSharedPeoplePresence(prev => ({
          ...prev,
          [email]: presence // 'active' | 'idle' | 'stale' | 'offline'
        }));
      });
      
      sharedPeoplePresenceListenersRef.current.set(email, cleanupPresence);
    });
    
    // Cleanup function
    return () => {
      // Clean up all presence listeners on unmount
      sharedPeoplePresenceListenersRef.current.forEach((cleanup) => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
      sharedPeoplePresenceListenersRef.current.clear();
    };
  }, [sharedChats, sharedChatsWithPeople]);

  const [editingChatId, setEditingChatId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  // Project related state
  const [selectedProject, setSelectedProject] = useState(currentProject || 'default');
  // Ref to store the unsubscribe function for the chats listener
  const chatsListenerUnsubscribeRef = useRef(null);
  const [projectTab, setProjectTab] = useState('private'); // 'private' or 'shared'
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [mySharedExpanded, setMySharedExpanded] = useState(true); // Expandable section for projects I own
  const [joinedExpanded, setJoinedExpanded] = useState(true); // Expandable section for projects shared with me
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareModalProjectId, setShareModalProjectId] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { isInsideExtension } = useExtension();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const dropdownContentRef = useRef(null);
  const selectedProjectRef = useRef(null);
  const [profileImage, setProfileImage] = useState(null);
  const [menuOpenForChatId, setMenuOpenForChatId] = useState(null);
  const [hoveredChatId, setHoveredChatId] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [animationState, setAnimationState] = useState('idle'); // 'idle', 'collapsing', 'expanding'
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  // New Project Modal state
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  // Chat mode state (public/private) - default to 'public' so shared project chats are visible
  const [chatModeInternal, setChatModeInternal] = useState('public');
  const prevChatModeRef = useRef(chatModeInternal);
  // Track if current project is shared
  const [isCurrentProjectShared, setIsCurrentProjectShared] = useState(false);
  // Track previous shared projects to detect new additions
  const previousSharedProjectsRef = useRef(new Set());
  
  // Wrapper for setChatMode
  const chatMode = chatModeInternal;
  const setChatMode = (newMode) => {
    setChatModeInternal(newMode);
  };

  // Notify parent when chatMode changes
  useEffect(() => {
    if (onChatModeChange && typeof onChatModeChange === 'function') {
      onChatModeChange(chatMode);
    }
  }, [chatMode, onChatModeChange]);
  
  // Privacy warning dialog state
  const [privacyWarning, setPrivacyWarning] = useState(null); // { chat, action: 'moveToPublic' | 'moveToPrivate', message }
  const [createCopyBeforePrivate, setCreateCopyBeforePrivate] = useState(false); // Option to create a copy before making private

  // Track if a project switch is in progress to prevent race conditions
  const projectSwitchInProgressRef = useRef(false);
  
  // Track current user's role for viewer mode restrictions
  const [currentUserRole, setCurrentUserRole] = useState(null); // 'owner' | 'editor' | 'viewer' | null
  
  // Real-time listener for current user's role - updates when role changes
  useEffect(() => {
    if (!auth.currentUser || !auth.currentUser.email) {
      setCurrentUserRole(null);
      return;
    }

    const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
    const targetCompanyEmail = sharedCompanyEmail || localStorage.getItem('companyEmail');
    
    if (!targetCompanyEmail || !currentProject) {
      setCurrentUserRole(null);
      return;
    }

    const currentUserEmail = auth.currentUser.email.replace(/\./g, ',');
    const memberPath = `Companies/${targetCompanyEmail}/projects/${currentProject}/members/${currentUserEmail}`;
    const memberRef = ref(database, memberPath);
    
    const unsubscribe = onValue(memberRef, (snapshot) => {
      const memberData = snapshot.val();
      
      let role = null;
      if (memberData && memberData.role) {
        role = memberData.role;
        setCurrentUserRole(role);
      } else {
        // Check if user owns the company
        const normalizedTargetCompany = targetCompanyEmail.replace(/\./g, ',');
        getFirebaseData(`emailToCompanyDirectory/${currentUserEmail}`).then(userCompanyEmail => {
          if (userCompanyEmail) {
            const normalizedUserCompany = userCompanyEmail.replace(/\./g, ',');
            if (normalizedUserCompany === normalizedTargetCompany) {
              role = 'owner';
              setCurrentUserRole('owner');
            } else {
              // Default to editor for backward compatibility
              role = 'editor';
              setCurrentUserRole('editor');
            }
          } else {
            // Default to editor for backward compatibility
            role = 'editor';
            setCurrentUserRole('editor');
          }
        }).catch(() => {
          // If we can't determine, default to editor
          role = 'editor';
          setCurrentUserRole('editor');
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentProject, auth.currentUser]);
  
  // Helper function to check if a project is a shared project
  // This includes:
  // 1. Projects shared WITH the user (sharedProjectId in localStorage)
  // 2. Projects OWNED by the user that have members (isCurrentProjectShared = true when projectId matches selectedProject)
  // 3. Projects in sharedProjects array with isOwner: true
  const isProjectShared = (projectId) => {
    if (!projectId) return false;
    
    // Check if it's a received shared project
    const sharedProjectId = localStorage.getItem('sharedProjectId');
    const isReceivedSharedProject = sharedProjectId && sharedProjectId === projectId;
    
    // Check if it's an owned shared project (has members with role 'member')
    // Only check isCurrentProjectShared if we're checking the currently selected project
    const isOwnedSharedProject = projectId === selectedProject && isCurrentProjectShared;
    
    // Check if project is in sharedProjects array (created from shared tab or has members)
    const isInSharedProjectsList = sharedProjects.some(p => 
      p.projectId === projectId && p.isOwner === true
    );
    
    return isReceivedSharedProject || isOwnedSharedProject || isInSharedProjectsList;
  };

  // Centralized function for switching to a private project
  // This prevents race conditions by ensuring all state updates happen atomically
  const switchToPrivateProject = async (projectId) => {
    if (projectSwitchInProgressRef.current) {
      console.warn('[ChatSidebar] Project switch already in progress, ignoring');
      return;
    }
    projectSwitchInProgressRef.current = true;
    
    try {
      if (companyEmail) {
        const userEmail = companyEmail.replace(/,/g, '.');
        // Clear shared project context FIRST before setting new project
        await removeUIState(userEmail, 'sharedCompanyEmail');
        await removeUIState(userEmail, 'sharedProjectId');
        await setUIState(userEmail, 'currentProject', projectId);
      }
      
      // Also update localStorage for backward compatibility
      localStorage.removeItem('sharedCompanyEmail');
      localStorage.removeItem('sharedProjectId');
      localStorage.setItem('currentProject', projectId);
      
      // Update local state
      setSelectedProject(projectId);
      
      // Clear UI state
      setChats([]);
      setSharedChats([]);
      if (onChatSelect) {
        onChatSelect(null);
      }
      
      // Close dropdown
      setDropdownOpen(false);
      
      // Notify parent
      if (onProjectChange) {
        onProjectChange(projectId);
      }
    } finally {
      // Reset flag after a small delay to allow state to settle
      setTimeout(() => {
        projectSwitchInProgressRef.current = false;
      }, 100);
    }
  };
  
  // Centralized function for switching to a shared project
  const switchToSharedProject = async (projectId, ownerCompany) => {
    if (projectSwitchInProgressRef.current) {
      console.warn('[ChatSidebar] Project switch already in progress, ignoring');
      return;
    }
    projectSwitchInProgressRef.current = true;
    
    try {
      if (companyEmail) {
        const userEmail = companyEmail.replace(/,/g, '.');
        // Set shared project context atomically
        await setUIState(userEmail, 'sharedCompanyEmail', ownerCompany);
        await setUIState(userEmail, 'sharedProjectId', projectId);
        await setUIState(userEmail, 'currentProject', projectId);
      }
      
      // Also update localStorage for backward compatibility
      localStorage.setItem('sharedCompanyEmail', ownerCompany);
      localStorage.setItem('sharedProjectId', projectId);
      localStorage.setItem('currentProject', projectId);
      
      // Automatically switch to public mode for shared projects
      // This ensures all public chats created in the project are visible to all members
      setChatMode('public');
      
      // Update local state
      setSelectedProject(projectId);
      
      // Clear UI state
      setChats([]);
      setSharedChats([]);
      if (onChatSelect) {
        onChatSelect(null);
      }
      
      // Close dropdown
      setDropdownOpen(false);
      
      // Notify parent
      if (onProjectChange) {
        onProjectChange(projectId);
      }
    } finally {
      // Reset flag after a small delay to allow state to settle
      setTimeout(() => {
        projectSwitchInProgressRef.current = false;
      }, 100);
    }
  };

  // Handle accepting invite code
  const handleAcceptInvite = async () => {
    const code = inviteCodeInput.trim().toUpperCase(); // Convert to uppercase for database lookup
    if (!code) {
      showToast('Please enter an invite code', 'error');
      return;
    }
    
    try {
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

  // Handle selecting a shared project
  const handleSelectSharedProject = (proj) => {
    // Use centralized function - it handles all the localStorage and state updates
    switchToSharedProject(proj.projectId, proj.ownerCompany);
  };

  // Restore shared project context on mount
  useEffect(() => {
    const restoreProjectContext = async () => {
      if (!companyEmail) return;
      
      const userEmail = companyEmail.replace(/,/g, '.');
      
      // Check for pending shared project
      const pendingSharedProject = await getUIState(userEmail, 'pendingSharedProject');
      
      if (pendingSharedProject && pendingSharedProject.projectId && pendingSharedProject.ownerCompany) {
        await removeUIState(userEmail, 'pendingSharedProject');
        await setUIState(userEmail, 'sharedCompanyEmail', pendingSharedProject.ownerCompany);
        await setUIState(userEmail, 'sharedProjectId', pendingSharedProject.projectId);
        await setUIState(userEmail, 'currentProject', pendingSharedProject.projectId);
        
        // Also update localStorage for immediate use (backward compatibility)
        localStorage.setItem('sharedCompanyEmail', pendingSharedProject.ownerCompany);
        localStorage.setItem('sharedProjectId', pendingSharedProject.projectId);
        localStorage.setItem('currentProject', pendingSharedProject.projectId);
        
        setChatMode('public');
        setSelectedProject(pendingSharedProject.projectId);
        
        if (onProjectChange) {
          setTimeout(() => onProjectChange(pendingSharedProject.projectId), 100);
        }
        return;
      }
      
      // Restore existing shared project context
      const storedProject = await getUIState(userEmail, 'currentProject');
      const storedSharedProjectId = await getUIState(userEmail, 'sharedProjectId');
      const storedSharedCompanyEmail = await getUIState(userEmail, 'sharedCompanyEmail');
      
      // Also check localStorage as fallback
      const localProject = localStorage.getItem('currentProject');
      const localSharedId = localStorage.getItem('sharedProjectId');
      const localSharedCompany = localStorage.getItem('sharedCompanyEmail');
      
      const finalProject = storedProject || localProject;
      const finalSharedId = storedSharedProjectId || localSharedId;
      const finalSharedCompany = storedSharedCompanyEmail || localSharedCompany;
      
      if (finalProject && finalSharedId && finalProject === finalSharedId && finalSharedCompany) {
        // Sync to localStorage for backward compatibility
        localStorage.setItem('currentProject', finalProject);
        localStorage.setItem('sharedProjectId', finalSharedId);
        localStorage.setItem('sharedCompanyEmail', finalSharedCompany);
        
        setChatMode('public');
        setSelectedProject(finalProject);
        
        if (onProjectChange && finalProject !== currentProject) {
          setTimeout(() => onProjectChange(finalProject), 100);
        }
      }
    };
    
    if (companyEmail) {
      restoreProjectContext();
    }
  }, [companyEmail]);

  // Sync selectedChatId with currentChat prop
  useEffect(() => {
    if (currentChat && currentChat.id) {
      setSelectedChatId(currentChat.id);
    } else {
      setSelectedChatId(null);
    }
  }, [currentChat]);

  // Effect to handle mode switching - clear current chat if it doesn't belong to new mode (only for shared projects)
  useEffect(() => {
    // Only run when chatMode actually changes (not on initial mount or when other deps change)
    if (prevChatModeRef.current === chatMode) return;
    prevChatModeRef.current = chatMode;
    
    // Check if we're in a shared project (only relevant for shared projects)
    const sharedProjectId = localStorage.getItem('sharedProjectId');
    const isSharedProject = sharedProjectId && sharedProjectId === selectedProject;
    
    // Skip this logic entirely for private projects (they show all chats regardless)
    if (!isSharedProject) return;
    
    // Skip if no current chat
    if (!currentChat || !onChatSelect || !auth.currentUser) return;
    
    // Check if current chat belongs to the current mode
    // Use isPublic field to determine if chat is private (NOT privateUser, which is now always set for ownership)
    const isCurrentlyPrivate = currentChat.isPublic === false;
    const belongsToCurrentMode = 
      (chatMode === 'private' && isCurrentlyPrivate && currentChat.privateUser === auth.currentUser.email) ||
      (chatMode === 'public' && !isCurrentlyPrivate);
    
    // If current chat doesn't belong to the new mode, switch or clear it
    if (!belongsToCurrentMode) {
      // Try to find the first available chat in the new mode
      // Note: We use isPublic field, NOT privateUser (which is now always set for ownership tracking)
      const visibleChats = chats.filter(chat => {
        if (chatMode === 'public') {
          return chat.isPublic !== false;
        } else {
          return chat.isPublic === false && chat.privateUser && chat.privateUser === auth.currentUser.email;
        }
      });
      
      if (visibleChats.length > 0) {
        // Switch to the first available chat in the new mode
        const newChat = visibleChats[0];
        setHoveredChatId(null); // Clear hover state
        setSelectedChatId(newChat.id); // Update selectedChatId immediately
        onChatSelect(newChat);
      } else {
        // No chats available in new mode, clear current chat
        setHoveredChatId(null); // Clear hover state
        setSelectedChatId(null); // Clear selectedChatId
        onChatSelect(null);
      }
    }
  }, [chatMode, currentChat, chats, onChatSelect, selectedProject]); // Include selectedProject in deps

  // Simple collapse function - everything happens simultaneously
  const handleAnimatedCollapse = () => {
    setIsCollapsed(true);
  };

  // Simple expand function - everything happens simultaneously
  const handleAnimatedExpand = (event) => {
    setIsCollapsed(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (!event.target.closest || !event.target.closest('.chat-item-menu')) {
        setMenuOpenForChatId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Initialize the username fetcher if not already initialized
    initUsernameFetcher();
    
    // Name is now loaded from context - no need to fetch

    // Check login status
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
    
      if (user) {
        // isLoggedIn is now from context
        try {
          // Get company email for the user
          const userEmail = user.email.replace(/\./g, ',');
          const companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${userEmail}`);
          
          // Fetch name immediately on auth - only use userData.name, not username
          if (companyEmailPath) {
            const userData = await getFirebaseData(`Companies/${companyEmailPath}/users/${userEmail}`);
            // firstName, lastName, and userDisplayName are now from context
          }

          if (companyEmailPath) {
            localStorage.setItem("currentUser", JSON.stringify({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName
            }));
            setCompanyEmail(companyEmailPath);
            if(await getMainCompanyEmail() !== companyEmailPath)
            {
              localStorage.setItem("companyEmail", companyEmailPath);

            }
            
            // Validate stored project exists for this user, reset to 'default' if not
            const storedProject = localStorage.getItem('currentProject');
            let activeProject = 'default';
            
            if (storedProject && storedProject !== 'default') {
              // Check if this project exists for the current user
              // Check for project metadata (name, createdAt, etc.) to confirm it exists
              const projectMetadataPath = `Companies/${companyEmailPath}/projects/${storedProject}/name`;
              const projectName = await getFirebaseData(projectMetadataPath);
              
              // Also check if it's a shared project that the user has access to
              const sharedProjectId = localStorage.getItem('sharedProjectId');
              const isSharedProject = sharedProjectId === storedProject;
              
              if (projectName || isSharedProject) {
                // Project exists (has a name) or it's a valid shared project, use it
                activeProject = storedProject;
              } else {
                // Project doesn't exist for this user, reset to default
                console.log(`[ChatSidebar] Stored project "${storedProject}" doesn't exist for user, resetting to "default"`);
                activeProject = 'default';
                localStorage.setItem('currentProject', 'default');
                // Also clear shared project context if it was set
                localStorage.removeItem('sharedCompanyEmail');
                localStorage.removeItem('sharedProjectId');
              }
            } else {
              // No stored project or it's 'default', use 'default'
              activeProject = 'default';
              localStorage.setItem('currentProject', 'default');
            }
            
            // Update state if needed
            if (currentProject !== activeProject && onProjectChange) {
              onProjectChange(activeProject);
            }
            
            // Set up listener for chats - use shared company email if viewing a shared project
            const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
            const companyEmailForChats = sharedCompanyEmail ? sharedCompanyEmail.replace(/\./g, ',') : companyEmailPath;
            
            // Cleanup old listener if it exists
            if (chatsListenerUnsubscribeRef.current) {
              chatsListenerUnsubscribeRef.current();
              chatsListenerUnsubscribeRef.current = null;
            }
            const unsubscribe = loadUserChats(companyEmailForChats, activeProject);
            chatsListenerUnsubscribeRef.current = unsubscribe;
            
            // Check for shared chat notifications
            checkForNotifications(user.email);

            console.log('Checking for copied chat notifications', user.email);
            // Check for copied chat notifications
            checkForCopiedNotifications(user.email);
          }
        } catch (error) {
          console.error("Error fetching company email:", error);
        }
      } else {
        // isLoggedIn is now from context
        setChats([]);
        localStorage.removeItem("currentUser");
        // Clear project context on sign out to prevent cross-user contamination
        localStorage.removeItem('currentProject');
        localStorage.removeItem('sharedCompanyEmail');
        localStorage.removeItem('sharedProjectId');
      //  localStorage.removeItem("companyEmail");
      //  console.log("Removed companyEmail");
        setSharedChats([]);
        localStorage.removeItem('accessedSharedChats');

      }
    });

    // Check for shared chat in URL
    const params = new URLSearchParams(location.search);
    const sharedId = params.get('share');
    

    if (sharedId) {
      loadSharedChat(sharedId);
    }

    // Load all shared chats that have been accessed before
    loadAllSharedChats();

    return () => {
      // Cleanup handled by auth state change
      unsubscribe();
    };
  }, [userDisplayName, location.search, currentProject]);

  useEffect(() => {
    if (!isLoggedIn) return;
    
    const user = auth.currentUser;
    if (!user || !user.email) return;
    
    const userEmailPath = user.email.replace(/\./g, ',');
    let companyEmailPath = null;
    const memberListeners = new Map(); // Track member listeners for cleanup
    const unsubscribeFunctions = []; // Track all unsubscribe functions
    const projectStatusMap = new Map(); // Track project status: 'private' or 'shared'
    
    // Helper function to check if a project is shared (has members OTHER than owner)
    const checkIfProjectIsShared = (membersData) => {
      if (!membersData || Object.keys(membersData).length === 0) {
        return false;
      }
      // A project is shared if it has members that are NOT owners:
      // 1. Members with role 'member', 'editor', or 'viewer' (explicit roles), OR
      // 2. Members without a role property (legacy members without roles - these are shared members)
      // Owners have role='owner', so we exclude those
      return Object.values(membersData).some(member => {
        // If member has no role property at all, it's a legacy shared member
        if (!member || typeof member !== 'object') return false;
        if (!member.hasOwnProperty('role')) return true; // Legacy member without role = shared
        // If member has a role, check if it's a non-owner role
        return ['member', 'editor', 'viewer'].includes(member.role);
      });
    };
    
    // Helper function to update project lists atomically
    const updateProjectLists = (companyEmail) => {
      if (!companyEmail) return; // Don't update if company email not available yet
      
      const privateProjects = [];
      const ownedSharedProjects = [];
      
      projectStatusMap.forEach((isShared, projectId) => {
        if (isShared) {
          // Shared projects (with members) go to sharedProjects array
          ownedSharedProjects.push({
            projectId: projectId,
            ownerCompany: companyEmail,
            isOwner: true,
            joinedAt: new Date().toISOString()
          });
        } else {
          // Only truly private projects (no members) go to projects array
          privateProjects.push(projectId);
        }
      });
      
      // Private projects: only those WITHOUT members
      setProjects(privateProjects.length > 0 ? privateProjects : ['default']);
      
      // Update shared projects: includes BOTH owned shared and received shared
      setSharedProjects(prevShared => {
        const receivedShared = prevShared.filter(p => p.isOwner === false);
        const allShared = [...ownedSharedProjects, ...receivedShared];
        
        // Deduplicate
        const unique = [];
        const seen = new Set();
        allShared.forEach(p => {
          const key = `${p.projectId}-${p.ownerCompany}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(p);
          }
        });
        
        return unique;
      });
    };
    
    // Helper function to set up member listener for a project
    const setupMemberListener = (projectId, companyEmail) => {
      if (memberListeners.has(projectId)) return; // Already listening
      
      const membersRef = ref(database, `Companies/${companyEmail}/projects/${projectId}/members`);
      
      const unsubscribe = onValue(membersRef, (snapshot) => {
        const membersData = snapshot.val();
        const isShared = checkIfProjectIsShared(membersData);
        
        // Update status map
        projectStatusMap.set(projectId, isShared);
        
        // Update project lists (pass companyEmail to ensure it's available)
        updateProjectLists(companyEmail);
      });
      
      memberListeners.set(projectId, unsubscribe);
      unsubscribeFunctions.push(unsubscribe);
    };
    
    // Helper function to remove member listener for a project
    const removeMemberListener = (projectId) => {
      const unsubscribe = memberListeners.get(projectId);
      if (unsubscribe) {
        unsubscribe();
        memberListeners.delete(projectId);
        projectStatusMap.delete(projectId);
      }
    };
    
    // 1. Get company email and set up projects listener
    getFirebaseData(`emailToCompanyDirectory/${userEmailPath}`)
      .then(companyPath => {
        companyEmailPath = companyPath;
        setCompanyEmail(companyPath);
        
        if (companyPath) {
          const projectsRef = ref(database, `Companies/${companyPath}/projects`);
          
          const unsubscribeProjects = onValue(projectsRef, (snapshot) => {
            const projectsData = snapshot.val();
            
            if (!projectsData || Object.keys(projectsData).length === 0) {
              // No projects, clear everything
              memberListeners.forEach((unsub, projectId) => {
                removeMemberListener(projectId);
              });
              projectStatusMap.clear();
              setProjects(['default']);
              return;
            }
            
            const currentProjectIds = new Set(Object.keys(projectsData));
            const previousProjectIds = new Set(projectStatusMap.keys());
            
            // Remove listeners for projects that no longer exist
            previousProjectIds.forEach(projectId => {
              if (!currentProjectIds.has(projectId)) {
                removeMemberListener(projectId);
              }
            });
            
            // Set up listeners for new projects
            currentProjectIds.forEach(projectId => {
              if (!previousProjectIds.has(projectId)) {
                // New project - set up listener and initial status
                setupMemberListener(projectId, companyPath);
                // Initial status will be set by the listener callback
              }
            });
            
            // Update lists after a brief delay to let listeners initialize
            // The listeners fire immediately, but this ensures all are set up
            setTimeout(() => updateProjectLists(companyPath), 50);
          });
          
          unsubscribeFunctions.push(unsubscribeProjects);
        }
      })
      .catch(err => {
        console.error('Failed to get company email:', err);
      });
    
    // 2. Set up listener for shared projects (emailToSharedProjects)
    const sharedProjectsRef = ref(database, `emailToSharedProjects/${userEmailPath}`);
    
    const unsubscribeShared = onValue(sharedProjectsRef, (snapshot) => {
      const sharedProjectsData = snapshot.val();
      const receivedShared = [];
      
      console.log('[ChatSidebar] emailToSharedProjects data received:', sharedProjectsData);
      
      if (sharedProjectsData) {
        // sharedProjectsData structure: { companyEmail: { projectId: {...} } }
        for (const [ownerCompany, projects] of Object.entries(sharedProjectsData)) {
          if (projects && typeof projects === 'object') {
            for (const [projectId, projectInfo] of Object.entries(projects)) {
              if (projectInfo && typeof projectInfo === 'object') {
                receivedShared.push({
                  projectId: projectInfo.projectId || projectId,
                  ownerCompany: projectInfo.ownerCompany || ownerCompany,
                  isOwner: false, // These are projects shared with the user
                  joinedAt: projectInfo.joinedAt, // Keep joinedAt for sorting
                  ...projectInfo
                });
              }
            }
          }
        }
      }
      
      console.log('[ChatSidebar] Parsed receivedShared projects:', receivedShared);
      
      // Check for any projects the user is a member of that aren't in emailToSharedProjects
      // This helps fix cases where the inviter couldn't write due to permissions
      if (receivedShared.length > 0) {
        // We have some shared projects, but we should also check if there are any memberships
        // that aren't reflected here. However, this is complex to do efficiently.
        // For now, the listener will pick up new additions automatically.
      }
      
      // Merge with owned shared projects
      setSharedProjects(prevShared => {
        // Get owned shared projects (those with isOwner: true)
        const ownedShared = prevShared.filter(p => p.isOwner === true);
        
        // Combine owned and received, deduplicating
        const allShared = [...ownedShared, ...receivedShared];
        const unique = [];
        const seen = new Set();
        allShared.forEach(p => {
          const key = `${p.projectId}-${p.ownerCompany}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(p);
          }
        });
        
        // Track current shared project keys for debugging / deduping
        const currentProjectKeys = new Set(unique.map(p => `${p.projectId}-${p.ownerCompany}`));
        previousSharedProjectsRef.current = currentProjectKeys;
        
        console.log('[ChatSidebar] Updated sharedProjects state:', unique);
        
        return unique;
      });
    });
    
    unsubscribeFunctions.push(unsubscribeShared);
    
    // Helper function to sync a project membership to emailToSharedProjects
    // This is called when we detect the user is a member of a project that's not in their emailToSharedProjects
    // This fixes cases where the inviter couldn't write due to Firebase permission rules
    const syncProjectToSharedProjects = async (projectId, ownerCompanyEmail) => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser || !currentUser.email) return;
        
        const userEmailPath = currentUser.email.replace(/\./g, ',');
        
        // Check if already exists
        const existingEntry = await getFirebaseData(
          `emailToSharedProjects/${userEmailPath}/${ownerCompanyEmail}/${projectId}`
        );
        
        if (existingEntry) {
          // Already exists, no need to create
          return;
        }
        
        // Check if user is actually a member
        const memberData = await getFirebaseData(
          `Companies/${ownerCompanyEmail}/projects/${projectId}/members/${userEmailPath}`
        );
        
        if (memberData) {
          // User is a member, create the entry
          const sharedProjectData = {
            projectId: projectId,
            ownerCompany: ownerCompanyEmail,
            joinedAt: memberData.joinedAt || new Date().toISOString(),
            invitedBy: memberData.invitedBy || 'system'
          };
          
          await saveFirebaseData(
            `emailToSharedProjects/${userEmailPath}/${ownerCompanyEmail}/${projectId}`,
            sharedProjectData
          );
          
          console.log(`[ChatSidebar] Synced project ${projectId} to emailToSharedProjects`);
        }
      } catch (error) {
        console.error('Error syncing project to shared projects:', error);
      }
    };
    
    // Cleanup function
    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
      memberListeners.forEach(unsub => unsub());
      memberListeners.clear();
      projectStatusMap.clear();
    };

    let listenerRef = null;
    let unsubscribe = () => { }; // Function to detach listener

    const setupListener = async () => {
      if (!isInsideExtension && auth && auth.currentUser && auth.currentUser.email) {
        try {
          var mainCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${auth.currentUser.email.replace(".", ",")}`);
          // Dynamically import Firebase database functions
          const firebaseDb = await import('firebase/database');
          const { ref, onValue, off } = firebaseDb;
          const { database } = await import('../firebase-init'); // Get database instance

          //Does not go all the way down to /highlights so that we can also reload labels and codes for the highlights, which are in /annotationHistory
          const projectsPath = `Companies/${mainCompanyEmail}/projects`;
          console.log("[Listener] Setting up listener for path:", projectsPath);
          listenerRef = ref(database, projectsPath);

          // Define the callback for onValue
          const handleValueChange = (snapshot) => {
            fetchProjects();
          };

          // Attach the listener
          onValue(listenerRef, handleValueChange);


          // Set the cleanup function
          unsubscribe = () => {
            if (listenerRef) {
              console.log("[Listener] Detaching listener from path:", projectsPath);
              off(listenerRef, 'value', handleValueChange); // Detach specific callback
              listenerRef = null;
            }
          };

        } catch (error) {
          console.error("[Listener] Error setting up Firebase listener:", error);
        }
      }
    };

    setupListener();

    // Cleanup function: Remove listener when dependencies change or component unmounts
    return () => {
      unsubscribe();
    };

  }, [isLoggedIn]);

  // Update selected project when currentProject prop changes
  useEffect(() => {
    setSelectedProject(currentProject || 'default');
  }, [currentProject]);

  // Auto-scroll to selected project when dropdown opens
  useEffect(() => {
    if (dropdownOpen && selectedProjectRef.current && dropdownContentRef.current) {
      // Use setTimeout to ensure the DOM has rendered
      setTimeout(() => {
        selectedProjectRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }, 100);
    }
  }, [dropdownOpen, selectedProject]);

  // Check if current project is shared (either received shared project or owned project with members)
  useEffect(() => {
    if (!isLoggedIn || !selectedProject || selectedProject === 'default') {
      setIsCurrentProjectShared(false);
      return;
    }

    // Check if it's a received shared project
    const sharedProjectId = localStorage.getItem('sharedProjectId');
    if (sharedProjectId && sharedProjectId === selectedProject) {
      setIsCurrentProjectShared(true);
      return;
    }

    // For owned projects, set up a real-time listener to check members
    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      setIsCurrentProjectShared(false);
      return;
    }

    const userEmailPath = userEmail.replace(/\./g, ',');
    let companyEmailPath = null;
    let unsubscribe = null;

    const setupListener = async () => {
      try {
        companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${userEmailPath}`);
        
        if (!companyEmailPath) {
          setIsCurrentProjectShared(false);
          return;
        }

        // Set up real-time listener for project members
        const membersRef = ref(database, `Companies/${companyEmailPath}/projects/${selectedProject}/members`);
        
        unsubscribe = onValue(membersRef, (snapshot) => {
          const membersData = snapshot.val();
          
          // A project is shared if it has members OTHER than the owner
          if (membersData && Object.keys(membersData).length > 0) {
            const hasNonOwnerMembers = Object.values(membersData).some(member => {
              // If member has no role property at all, it's a legacy shared member
              if (!member || typeof member !== 'object') return false;
              if (!member.hasOwnProperty('role')) return true; // Legacy member = shared
              // If member has a role, check if it's a non-owner role
              return ['member', 'editor', 'viewer'].includes(member.role);
            });
            setIsCurrentProjectShared(hasNonOwnerMembers);
          } else {
            setIsCurrentProjectShared(false);
          }
        });
      } catch (error) {
        console.error('Error setting up project sharing status listener:', error);
        setIsCurrentProjectShared(false);
      }
    };

    setupListener();

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [selectedProject, isLoggedIn]);

  // Reload chats when project changes (handles shared projects)
  useEffect(() => {
    if (!isLoggedIn || !currentProject) {
      // Clear chats if not logged in or no project
      setChats([]);
      setSharedChats([]);
      if (onChatSelect) {
        onChatSelect(null); // Clear current chat selection
      }
      return;
    }
    
    // Immediately clear chats when project changes to prevent showing old project's chats
    // Project changed - clearing chats
    setChats([]);
    setSharedChats([]);
    if (onChatSelect) {
      onChatSelect(null); // Clear current chat selection
    }
    
    // Cleanup old listener if it exists
    if (chatsListenerUnsubscribeRef.current) {
      // Cleaning up old chats listener
      chatsListenerUnsubscribeRef.current();
      chatsListenerUnsubscribeRef.current = null;
    }
    
    // Get the correct company email (shared or own)
    const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
    const userCompanyEmail = localStorage.getItem('companyEmail');
    const companyEmailToUse = sharedCompanyEmail || userCompanyEmail;
    
    if (companyEmailToUse) {
      // Reloading chats for project
      const unsubscribe = loadUserChats(companyEmailToUse.replace(/\./g, ','), currentProject);
      chatsListenerUnsubscribeRef.current = unsubscribe;
    }
    
    // Cleanup function: unsubscribe when project changes or component unmounts
    return () => {
      if (chatsListenerUnsubscribeRef.current) {
        // Cleanup: Unsubscribing chats listener
        chatsListenerUnsubscribeRef.current();
        chatsListenerUnsubscribeRef.current = null;
      }
    };
  }, [currentProject, isLoggedIn]);

  const handleProjectChange = (e) => {
    const newProject = e.target.value;
    // Use centralized function to prevent race conditions
    switchToPrivateProject(newProject);
  };

  // Function to create a new project
  const handleCreateNewProject = async () => {
    if (!newProjectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    try {
      const companyEmail = await getMainCompanyEmail();
      const projectName = newProjectName.trim();
      const user = auth.currentUser;
      
      if (!user || !user.email) {
        alert('User not authenticated');
        return;
      }
      
      // Check if project already exists
      if (projects.includes(projectName)) {
        alert('A project with this name already exists');
        return;
      }

      const companyEmailPath = companyEmail.replace(/\./g, ',');
      const userEmailPath = user.email.replace(/\./g, ',');

      // Create the project in Firebase
      await saveFirebaseData(`Companies/${companyEmailPath}/projects/${projectName}`, {
        name: projectName,
        createdAt: new Date().toISOString()
      });

      // Add creator as owner member
      await saveFirebaseData(
        `Companies/${companyEmailPath}/projects/${projectName}/members/${userEmailPath}`,
        {
          role: 'owner',
          joinedAt: new Date().toISOString(),
          email: user.email
        }
      );

      // Update local projects list
      const updatedProjects = [...projects, projectName];
      setProjects(updatedProjects);
      
      // Close modal and reset form first (before switching project)
      setShowNewProjectModal(false);
      setNewProjectName('');
      
      // Use centralized function to switch to the new project
      // This handles clearing shared context and all state updates
      switchToPrivateProject(projectName);

      // Notify extension about the new project
      if (window.parent) {
        window.parent.postMessage({
          action: "projectCreated",
          projectName: projectName
        }, "*");
      }

      console.log(`Created new project: ${projectName}`);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Error creating project. Please try again.');
    }
  };

  // Helper function to compare chat arrays for meaningful changes
  // Returns true if arrays have different visible content
  const hasChatsChanged = (prevChats, newChats) => {
    if (prevChats.length !== newChats.length) return true;
    
    // Create maps for quick lookup
    const prevMap = new Map(prevChats.map(c => [c.id, c]));
    
    for (const newChat of newChats) {
      const prevChat = prevMap.get(newChat.id);
      if (!prevChat) return true; // New chat added
      
      // Check if relevant fields changed (title, timestamp, messages count, isPublic)
      if (prevChat.title !== newChat.title ||
          prevChat.timestamp !== newChat.timestamp ||
          prevChat.isPublic !== newChat.isPublic ||
          (prevChat.messages?.length || 0) !== (newChat.messages?.length || 0)) {
        return true;
      }
    }
    
    return false;
  };

  // Function to load user chats from Firebase
  // Returns unsubscribe function for cleanup
  // NOW LOADS FROM TWO SEPARATE PATHS FOR SECURITY:
  // - groqChats: Public chats (all project members can read)
  // - privateChats/$userEmail: Private chats (only owner can read - server enforced)
  const loadUserChats = (companyEmailPath, projectId) => {
    // Get current user email for private chat path
    const currentUserEmail = auth.currentUser?.email;
    const userEmailFormatted = currentUserEmail ? currentUserEmail.replace(/\./g, ',') : null;
    
    // Arrays to hold unsubscribe functions
    const unsubscribeFunctions = [];
    
    // Shared state to merge public and private chats
    let publicChatsData = [];
    let privateChatsData = [];
    let sharedChatsData = [];
    
    // Function to update the merged chat state
    const updateMergedChats = () => {
      // Merge public and private chats, avoiding duplicates
      const allChats = [...publicChatsData];
      privateChatsData.forEach(privateChat => {
        if (!allChats.some(c => c.id === privateChat.id)) {
          allChats.push(privateChat);
        }
      });
      
      const sortedChats = allChats.sort((a, b) => b.timestamp - a.timestamp);
      const sortedSharedChats = sharedChatsData.sort((a, b) => (b.accessedAt || b.timestamp) - (a.accessedAt || a.timestamp));
      
      // Only update state if the visible chats have actually changed
      setChats(prevChats => {
        if (hasChatsChanged(prevChats, sortedChats)) {
          return sortedChats;
        }
        return prevChats;
      });
      
      // Update shared chats list by merging with existing shared chats
      setSharedChats(prev => {
        const filteredPrev = prev.filter(existingChat => 
          !sortedSharedChats.some(newSharedChat => newSharedChat.id === existingChat.id)
        );
        
        const merged = [...filteredPrev];
        sortedSharedChats.forEach(newSharedChat => {
          if (!merged.some(existing => existing.id === newSharedChat.id)) {
            merged.push(newSharedChat);
          }
        });
        
        const newMerged = merged.sort((a, b) => (b.accessedAt || b.timestamp) - (a.accessedAt || a.timestamp));
        
        if (hasChatsChanged(prev, newMerged)) {
          return newMerged;
        }
        return prev;
      });
    };
    
    // 1. Listen to PUBLIC chats (groqChats path - all project members can read)
    const publicChatsRef = ref(database, `Companies/${companyEmailPath}/projects/${projectId}/groqChats`);
    const unsubscribePublic = onValue(publicChatsRef, (snapshot) => {
      const chatsArray = [];
      const sharedChatsArray = [];
      
      if (snapshot.exists()) {
        const chatsData = snapshot.val();
        
        Object.entries(chatsData).forEach(([id, chat]) => {
          const chatObj = {
            id,
            title: chat.title || 'Untitled Chat',
            timestamp: chat.timestamp || Date.now(),
            isPublic: true, // Mark as public
            storagePath: 'groqChats', // Track where it's stored for operations
            ...chat
          };

          // If chat has isShared flag, move it to shared chats section
          if (chat.isShared) {
            sharedChatsArray.push({
              ...chatObj,
              isShared: true,
              accessedAt: chat.sharedAt || chat.timestamp,
              isSender: true
            });
          } else {
            chatsArray.push(chatObj);
          }
        });
      }
      
      publicChatsData = chatsArray;
      sharedChatsData = sharedChatsArray;
      updateMergedChats();
    });
    unsubscribeFunctions.push(unsubscribePublic);
    
    // 2. Listen to PRIVATE chats (privateChats/$userEmail path - only owner can read, server enforced)
    if (userEmailFormatted) {
      const privateChatsRef = ref(database, `Companies/${companyEmailPath}/projects/${projectId}/privateChats/${userEmailFormatted}`);
      const unsubscribePrivate = onValue(privateChatsRef, (snapshot) => {
        const chatsArray = [];
        
        if (snapshot.exists()) {
          const chatsData = snapshot.val();
          
          Object.entries(chatsData).forEach(([id, chat]) => {
            const chatObj = {
              id,
              title: chat.title || 'Untitled Chat',
              timestamp: chat.timestamp || Date.now(),
              isPublic: false, // Mark as private
              privateUser: currentUserEmail,
              storagePath: 'privateChats', // Track where it's stored for operations
              ...chat
            };
            
            chatsArray.push(chatObj);
          });
        }
        
        privateChatsData = chatsArray;
        updateMergedChats();
      });
      unsubscribeFunctions.push(unsubscribePrivate);
    }
    
    // Return combined unsubscribe function
    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  };

  // Function to load a specific shared chat
  const loadSharedChat = async (sharedId) => {
    try {
      const sharedChatData = await getFirebaseData(`sharedChats/${sharedId}`);

      if (sharedChatData) {
        // Get current user email for Firebase path
        const currentUser = auth.currentUser;
        if (!currentUser || !currentUser.email) {
          console.error("User not authenticated");
          return;
        }

        const userEmail = currentUser.email.replace(/\./g, ',');
        
        // Save the shared chat to Firebase under user's accessed shared chats
        const userSharedChatData = {
          ...sharedChatData,
          id: sharedId,
          isShared: true,
          accessedAt: Date.now()
        };

        console.log('path', `sharedChats/${userEmail}/${sharedId}`);
        await saveFirebaseData(`sharedChats/${userEmail}/${sharedId}`, userSharedChatData);

        // Delete the original shared chat entry to prevent duplication
        try {
          const { deleteFirebaseData } = await import('../funcs');
          await deleteFirebaseData(`sharedChats/${sharedId}`);
          console.log('✅ Deleted original shared chat entry:', sharedId);
        } catch (error) {
          console.error('❌ Error deleting original shared chat entry:', error);
        }

        // Add recipient to sharedPeople list in the original chat
        if (sharedChatData.companyEmail && sharedChatData.project && sharedChatData.originalId) {
          const originalChatPath = `Companies/${sharedChatData.companyEmail}/projects/${sharedChatData.project}/groqChats/${sharedChatData.originalId}`;
          const sharedPeoplePath = `${originalChatPath}/sharedPeople`;
          const existingSharedPeople = await getFirebaseData(sharedPeoplePath) || {};
          
          // Add current user to shared people list if not already present
          const userEmailKey = currentUser.email.replace(/\./g, ',');
          if (!existingSharedPeople[userEmailKey]) {
            const recipientData = {
              email: currentUser.email,
              name: currentUser.displayName || currentUser.email.split('@')[0],
              addedAt: Date.now(),
              addedBy: 'recipient'
            };
            
            await saveFirebaseData(`${sharedPeoplePath}/${userEmailKey}`, recipientData);
            console.log('Added recipient to sharedPeople list:', currentUser.email);
          }
        }

        // Add the ID to the shared chat data for reference
        const sharedChat = { ...sharedChatData, id: sharedId, isShared: true };

        // Update shared chats list
        setSharedChats(prev => {
          const exists = prev.some(chat => chat.id === sharedId);
          if (!exists) {
            return [...prev, sharedChat].sort((a, b) => b.timestamp - a.timestamp);
          }
          return prev;
        });

        // Select the shared chat automatically
        if (onChatSelect && typeof onChatSelect === 'function') {
          onChatSelect(sharedChat);
        }

        // Remove the share parameter from URL to prevent reloading the same chat
        navigate('/demonstration', { replace: true });
      }
    } catch (error) {
      console.error("Error loading shared chat:", error);
    }
  };

  // Function to load all previously accessed shared chats
  const loadAllSharedChats = async () => {
    try {
      // Get current user email for Firebase path
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        console.log("User not authenticated, skipping shared chat loading");
        return;
      }

      const userEmail = currentUser.email.replace(/\./g, ',');
      
      // Load all shared chats from Firebase under user's accessed shared chats
      const userSharedChatsData = await getFirebaseData(`sharedChats/${userEmail}`);
      
      if (!userSharedChatsData) {
        console.log("No shared chats found for user");
        return;
      }

      const loadedSharedChats = [];

      // Convert object to array and process each shared chat
      for (const [sharedId, sharedChatData] of Object.entries(userSharedChatsData)) {
        if (sharedChatData) {
          loadedSharedChats.push({
            ...sharedChatData,
            id: sharedId,
            isShared: true
          });
        }
      }

      // Update state with sorted shared chats
      if (loadedSharedChats.length > 0) {
        setSharedChats(loadedSharedChats.sort((a, b) => (b.accessedAt || b.timestamp) - (a.accessedAt || a.timestamp)));
      }
    } catch (error) {
      console.error("Error loading all shared chats:", error);
    }
  };

  // Function to check for and process shared chat notifications
  const checkForNotifications = async (userEmail) => {
    try {
      const { showToast, deleteFirebaseData } = await import('../funcs');
      
      // Format email for Firebase path (replace dots with commas)
      const formattedEmail = userEmail.replace(/\./g, ',');
      const notificationsPath = `Notifications/${formattedEmail}/sharedChats`;
      
      // Get all notifications for this user
      const notifications = await getFirebaseData(notificationsPath);
      
      if (!notifications) {
        return; // No notifications
      }

      // Process each notification
      const notificationIds = Object.keys(notifications);
      
      for (const notificationId of notificationIds) {
        const notification = notifications[notificationId];
        
        // Extract share ID from the share link
        const shareIdMatch = notification.shareLink.match(/share=([^&]+)/);
        if (!shareIdMatch) {
          console.error("Could not extract share ID from link:", notification.shareLink);
          continue;
        }
        
        const shareId = shareIdMatch[1];
        
        // Load the shared chat
        const sharedChatData = await getFirebaseData(`sharedChats/${shareId}`);
        
        if (sharedChatData) {
          // Save the shared chat to Firebase under user's accessed shared chats
          const userSharedChatData = {
            ...sharedChatData,
            id: shareId,
            isShared: true,
            accessedAt: Date.now()
          };

          console.log('path', `sharedChats/${formattedEmail}/${shareId}`);
          await saveFirebaseData(`sharedChats/${formattedEmail}/${shareId}`, userSharedChatData);
          
          // Delete the original shared chat entry to prevent duplication
          try {
            const { deleteFirebaseData } = await import('../funcs');
            await deleteFirebaseData(`sharedChats/${shareId}`);
            console.log('✅ Deleted original shared chat entry from notification:', shareId);
          } catch (error) {
            console.error('❌ Error deleting original shared chat entry from notification:', error);
          }
          
          // Add recipient to sharedPeople list in the original chat
          if (sharedChatData.companyEmail && sharedChatData.project && sharedChatData.originalId) {
            const originalChatPath = `Companies/${sharedChatData.companyEmail}/projects/${sharedChatData.project}/groqChats/${sharedChatData.originalId}`;
            const sharedPeoplePath = `${originalChatPath}/sharedPeople`;
            const existingSharedPeople = await getFirebaseData(sharedPeoplePath) || {};
            
            // Add current user to shared people list if not already present
            const userEmailKey = userEmail.replace(/\./g, ',');
            if (!existingSharedPeople[userEmailKey]) {
              const recipientData = {
                email: userEmail,
                name: userEmail.split('@')[0], // Use email prefix as default name
                addedAt: Date.now(),
                addedBy: 'recipient'
              };
              
              await saveFirebaseData(`${sharedPeoplePath}/${userEmailKey}`, recipientData);
              console.log('Added recipient to sharedPeople list:', userEmail);
            }
          }
          
          // Add to shared chats list
          const sharedChat = { ...sharedChatData, id: shareId, isShared: true };
          setSharedChats(prev => {
            const exists = prev.some(chat => chat.id === shareId);
            if (!exists) {
              return [...prev, sharedChat].sort((a, b) => b.timestamp - a.timestamp);
            }
            return prev;
          });
          
          // Show toast notification
          const senderName = notification.senderName || notification.senderEmail;
          const chatTitle = notification.chatTitle || 'a chat';
          showToast(`${senderName} shared ${chatTitle} with you!`, 'success', 4000);
        }
        
        // Delete the notification after processing
        await deleteFirebaseData(`${notificationsPath}/${notificationId}`);
      }
    } catch (error) {
      console.error("Error checking for notifications:", error);
    }
  };

  // Function to check for and process copied chat notifications
  const checkForCopiedNotifications = async (userEmail) => {
    try {
      const { showToast, deleteFirebaseData, generateUniqueId } = await import('../funcs');

      // Format email for Firebase path (replace dots with commas)
      const formattedEmail = userEmail.replace(/\./g, ',');
      const notificationsPath = `Notifications/${formattedEmail}/copiedChats`;

      // Get all notifications for this user
      const notifications = await getFirebaseData(notificationsPath);

      if (!notifications) {
        return; // No notifications
      }

      // Ensure we have current user's company email
      let targetCompanyEmail = companyEmail;
      if (!targetCompanyEmail) {
        const email = auth.currentUser?.email?.replace(/\./g, ',');
        if (email) {
          targetCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${email}`);
          setCompanyEmail(targetCompanyEmail || '');
        }
      }
      if (!targetCompanyEmail || !currentProject) {
        console.warn('Missing company email or project while processing copied notifications');
        return;
      }

      const notificationIds = Object.keys(notifications);
      for (const notificationId of notificationIds) {
        const notification = notifications[notificationId];
        const originalPath = notification?.shareId; // path to original groq chat
        if (!originalPath || typeof originalPath !== 'string') {
          console.error('Invalid original chat path in copied notification:', notification);
          await deleteFirebaseData(`${notificationsPath}/${notificationId}`);
          continue;
        }

        // Immediately delete the notification to avoid duplicate processing
        try {
          await deleteFirebaseData(`${notificationsPath}/${notificationId}`);
        } catch (delErr) {
          console.warn('Failed to delete copied notification immediately:', delErr);
        }

        // Fetch original chat and messages
        const originalChat = await getFirebaseData(originalPath);
        const originalMessages = await getFirebaseData(`${originalPath}/messages`);

        if (!originalChat && !originalMessages) {
          console.warn('Original chat not found for path:', originalPath);
          await deleteFirebaseData(`${notificationsPath}/${notificationId}`);
          continue;
        }

        // Create a new chat in the current user's space
        const newChatId = `chat_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const newChat = {
          title: (originalChat && originalChat.title) || notification?.chatTitle || 'Untitled Chat',
          timestamp: Date.now(),
          messages: Array.isArray(originalChat?.messages) ? originalChat.messages : (Array.isArray(originalMessages) ? originalMessages : []),
          // Mark copied chats as private for the current user
          privateUser: auth.currentUser && auth.currentUser.email ? auth.currentUser.email : undefined
        };

        console.log('Path', `Companies/${targetCompanyEmail}/projects/${currentProject}/groqChats/${newChatId}`);
        try {
          await saveFirebaseData(`Companies/${targetCompanyEmail}/projects/${currentProject}/groqChats/${newChatId}`, newChat);

          // Also copy related annotations from the source chat into the current user's annotation history
          try {
            // Parse the original path: Companies/{company}/projects/{project}/groqChats/{chatId}
            const match = originalPath.match(/^Companies\/([^/]+)\/projects\/([^/]+)\/groqChats\/([^/]+)$/);
            const sourceCompany = match ? match[1] : null;
            const sourceProject = match ? match[2] : null;
            const sourceChatId = match ? match[3] : null;

            if (sourceCompany && sourceProject && sourceChatId) {
              // Load source annotation history
              let sourceHistory = await getFirebaseData(`Companies/${sourceCompany}/projects/${sourceProject}/annotationHistory`);
              if (typeof sourceHistory === 'string') {
                try { sourceHistory = JSON.parse(sourceHistory); } catch (_) { sourceHistory = []; }
              }
              if (!Array.isArray(sourceHistory)) sourceHistory = [];

              // Filter entries that belong to this chat via chatID key
              const relevant = sourceHistory.filter((entry) => {
                if (!Array.isArray(entry)) return false;
                const chatIdObj = entry.find((obj) => obj && Object.prototype.hasOwnProperty.call(obj, 'chatID'));
                return chatIdObj && chatIdObj.chatID === sourceChatId;
              });

              if (relevant.length > 0) {
                // Load current user's annotation history for merge
                let targetHistory = await getFirebaseData(`Companies/${targetCompanyEmail}/projects/${currentProject}/annotationHistory`);
                if (typeof targetHistory === 'string') {
                  try { targetHistory = JSON.parse(targetHistory); } catch (_) { targetHistory = []; }
                }
                if (!Array.isArray(targetHistory)) targetHistory = [];

                // Build set of existing IDs to dedupe
                const existingIds = new Set();
                for (const entry of targetHistory) {
                  if (Array.isArray(entry)) {
                    const idObj = entry.find((obj) => obj && Object.prototype.hasOwnProperty.call(obj, 'id'));
                    if (idObj && typeof idObj.id === 'string') existingIds.add(idObj.id);
                  }
                }

                // Clone and update entries
                const merged = [...targetHistory];
                for (const entry of relevant) {
                  const cloned = entry.map((obj) => ({ ...obj }));
                  // Update chatID to new chat id
                  const chatIdObj = cloned.find((obj) => obj && Object.prototype.hasOwnProperty.call(obj, 'chatID'));
                  if (chatIdObj) chatIdObj.chatID = newChatId; else cloned.push({ chatID: newChatId });

                  // Ensure unique id
                  let idObj = cloned.find((obj) => obj && Object.prototype.hasOwnProperty.call(obj, 'id'));
                  if (!idObj || typeof idObj.id !== 'string' || existingIds.has(idObj.id)) {
                    const newId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                    if (idObj) idObj.id = newId; else cloned.unshift({ id: newId });
                  }

                  // Add if not already present
                  idObj = cloned.find((obj) => obj && Object.prototype.hasOwnProperty.call(obj, 'id'));
                  if (idObj && typeof idObj.id === 'string' && !existingIds.has(idObj.id)) {
                    existingIds.add(idObj.id);
                    merged.push(cloned);
                  }
                }

                // Save merged annotation history (as JSON string for consistency)
                await saveFirebaseData(`Companies/${targetCompanyEmail}/projects/${currentProject}/annotationHistory`, JSON.stringify(merged));
              }
            }
          } catch (annErr) {
            console.error('Error copying annotations for copied chat:', annErr);
          }

          // Also copy related highlights from the source chat into the current user's highlights
          try {
            const match = originalPath.match(/^Companies\/([^/]+)\/projects\/([^/]+)\/groqChats\/([^/]+)$/);
            const sourceCompany = match ? match[1] : null;
            const sourceProject = match ? match[2] : null;
            const sourceChatId = match ? match[3] : null;

            if (sourceCompany && sourceProject && sourceChatId) {
              // Load source highlights array
              let sourceHighlights = await getFirebaseData(`Companies/${sourceCompany}/projects/${sourceProject}/highlights`);
              if (!Array.isArray(sourceHighlights)) sourceHighlights = [];

              // Filter to those matching sourceChatId
              const relevantHighlights = sourceHighlights.filter((h) => h && h.chatID === sourceChatId);

              if (relevantHighlights.length > 0) {
                // Load target highlights
                let targetHighlights = await getFirebaseData(`Companies/${targetCompanyEmail}/projects/${currentProject}/highlights`);
                if (!Array.isArray(targetHighlights)) targetHighlights = [];

                // Build set of existing highlight ids to dedupe
                const existingHighlightIds = new Set((targetHighlights || []).map((h) => h && h.id).filter(Boolean));

                const mergedHighlights = [...targetHighlights];
                for (const h of relevantHighlights) {
                  const cloned = { ...h };
                  cloned.chatID = newChatId;
                  // Ensure unique id if conflict
                  if (!cloned.id || existingHighlightIds.has(cloned.id)) {
                    cloned.id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                  }
                  if (!existingHighlightIds.has(cloned.id)) {
                    existingHighlightIds.add(cloned.id);
                    mergedHighlights.push(cloned);
                  }
                }

                // Save merged highlights
                await saveFirebaseData(`Companies/${targetCompanyEmail}/projects/${currentProject}/highlights`, mergedHighlights);
              }
            }
          } catch (hlErr) {
            console.error('Error copying highlights for copied chat:', hlErr);
          }

          // Optionally select the new chat if on this page
          if (onChatSelect && typeof onChatSelect === 'function') {
            onChatSelect({ id: newChatId, ...newChat });
          }

          const senderName = notification?.senderName || notification?.senderEmail || 'Someone';
          showToast(`${senderName} sent you a private copy. It was added to your chats.`, 'success', 4000);
        } catch (err) {
          console.error('Error saving copied chat:', err);
        }

        // Notification already deleted above
      }
    } catch (error) {
      console.error('Error checking for copied notifications:', error);
    }
  };

  // Function to create a new chat
  const createNewChat = async () => {
    // Check if user is a viewer - viewers cannot create chats
    if (currentUserRole === 'viewer') {
      if (typeof showToast === 'function') {
        showToast('Viewers cannot create new chats', 'error');
      }
      return;
    }
    
    if (!isLoggedIn || !companyEmail) {
      console.error("User is not logged in or company email not found");
      return;
    }

    // Use shared company email if viewing a shared project, otherwise use user's own
    const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
    const sharedProjectId = localStorage.getItem('sharedProjectId');
    const activeProject = localStorage.getItem('currentProject') || currentProject || 'default';
    
    // Only use sharedCompanyEmail if we're actually viewing that shared project
    let targetCompanyEmail = companyEmail;
    if (sharedCompanyEmail && sharedProjectId && sharedProjectId === activeProject) {
      targetCompanyEmail = sharedCompanyEmail; // Already in comma format from localStorage
    } else {
      // Ensure user's own company email is in comma format for Firebase paths
      targetCompanyEmail = companyEmail.replace(/\./g, ',');
    }

    // Check if we're in a shared project
    const isSharedProject = sharedCompanyEmail && sharedProjectId && sharedProjectId === activeProject;
    
    // Respect the user's chatMode choice - private chats stay private even in shared projects
    // Private chats in shared projects are only visible to the creator
    const shouldBePublic = chatMode !== 'private';
    
    // createNewChat - mode determined by chatMode
    
    const chatId = `chat_${Date.now()}`;
    const newChat = {
      title: 'New Chat',
      timestamp: Date.now(),
      messages: [],
      ownerId: auth.currentUser?.email, // Track who created the chat
      isPublic: shouldBePublic, // Based on chatMode - private mode creates private chats
    };

    // Add privateUser field for ownership tracking
    if (auth.currentUser && auth.currentUser.email) {
      newChat.privateUser = auth.currentUser.email;
    }
    
    // Creating chat with privacy settings applied
    
    // Determine the correct path based on public/private status
    // PUBLIC chats: groqChats (all project members can read)
    // PRIVATE chats: privateChats/$userEmail (only owner can read - SERVER ENFORCED)
    let chatPath;
    if (shouldBePublic) {
      chatPath = `Companies/${targetCompanyEmail}/projects/${activeProject}/groqChats/${chatId}`;
      console.log('Creating PUBLIC chat at:', chatPath, isSharedProject ? '(in shared project)' : '');
    } else {
      const userEmailFormatted = auth.currentUser.email.replace(/\./g, ',');
      chatPath = `Companies/${targetCompanyEmail}/projects/${activeProject}/privateChats/${userEmailFormatted}/${chatId}`;
      console.log('Creating PRIVATE chat at:', chatPath, '(SERVER-ENFORCED SECURITY)');
    }

    try {
      await saveFirebaseData(chatPath, newChat);

      // Instead of navigating, call the prop function to update the current chat
      if (onChatSelect && typeof onChatSelect === 'function') {
        const createdChat = {
          id: chatId,
          ...newChat
        };
        onChatSelect(createdChat);
        
        // Send message to extension to update current topic for messaging (same as when opening existing chat)
        // Use a small delay to ensure the iframe is ready and handleChatSelect has processed
        setTimeout(() => {
          const sidebarIframe = document.getElementById('sidebar-iframe');
          if (sidebarIframe && sidebarIframe.contentWindow) {
            sidebarIframe.contentWindow.postMessage({
              action: "updateMessagingTopic",
              chatId: chatId,
              chatTitle: createdChat.title || 'Untitled Chat'
            }, "*");
            // Sent updateMessagingTopic for new chat
          } else {
            console.warn('[ChatSidebar] Sidebar iframe not found when trying to send updateMessagingTopic');
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error creating new chat:", error);
    }
  };

  // Function to open a chat
  const openChat = (chatId, isShared = false) => {
    // Set the selected chat ID
    setSelectedChatId(chatId);
    
    // Find the chat in the appropriate list
    const chatList = isShared ? sharedChats : chats;
    const selectedChat = chatList.find(chat => chat.id === chatId);

    if (selectedChat && onChatSelect && typeof onChatSelect === 'function') {
      onChatSelect(selectedChat);
      
      // Send message to extension to update current topic for messaging
      if (!isShared) {
        const sidebarIframe = document.getElementById('sidebar-iframe');
        if (sidebarIframe && sidebarIframe.contentWindow) {
          sidebarIframe.contentWindow.postMessage({
            action: "updateMessagingTopic",
            chatId: chatId,
            chatTitle: selectedChat.title
          }, "*");
        }
      }
    }
  };

  // Function to delete a chat
  const deleteChat = async (event, chatId) => {
    event.stopPropagation(); // Prevent the chat from being opened

    if (!isLoggedIn || !companyEmail) {
      console.error("User is not logged in or company email not found");
      return;
    }

    if (window.confirm("Are you sure you want to delete this chat?")) {
      try {
        // Use shared company email if viewing a shared project, otherwise use user's own
        const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
        const sharedProjectId = localStorage.getItem('sharedProjectId');
        const activeProject = localStorage.getItem('currentProject') || currentProject || 'default';
        
        let targetCompanyEmail;
        if (sharedCompanyEmail && sharedProjectId && sharedProjectId === activeProject) {
          targetCompanyEmail = sharedCompanyEmail; // Already in comma format
        } else {
          targetCompanyEmail = companyEmail.replace(/\./g, ','); // Ensure comma format
        }
        
        // Find the chat to determine if it's public or private
        const chatToDelete = chats.find(c => c.id === chatId);
        const isPrivateChat = chatToDelete && chatToDelete.isPublic === false;
        
        // Remove the chat from the correct Firebase path
        let chatRef;
        if (isPrivateChat && auth.currentUser?.email) {
          // Private chat - stored in secure privateChats path
          const userEmailFormatted = auth.currentUser.email.replace(/\./g, ',');
          chatRef = ref(database, `Companies/${targetCompanyEmail}/projects/${activeProject}/privateChats/${userEmailFormatted}/${chatId}`);
          console.log('[deleteChat] Deleting PRIVATE chat from secure path');
        } else {
          // Public chat - stored in groqChats path
          chatRef = ref(database, `Companies/${targetCompanyEmail}/projects/${activeProject}/groqChats/${chatId}`);
          console.log('[deleteChat] Deleting PUBLIC chat');
        }
        await remove(chatRef);

        // If this was the currently selected chat, create a new one
        const selectedChat = chats.find(chat => chat.id === chatId);
        if (selectedChat && onChatSelect && typeof onChatSelect === 'function') {
          // If there are other chats, select the first one
          if (chats.length > 1) {
            const nextChat = chats.find(chat => chat.id !== chatId);
            if (nextChat) {
              onChatSelect(nextChat);
            }
          } else {
            // If this was the only chat, create a new one
            createNewChat();
          }
        }
      } catch (error) {
        console.error("Error deleting chat:", error);
      }
    }
  };

  // Function to start editing a chat title
  const startEditing = (event, chatId, currentTitle) => {
    event.stopPropagation(); // Prevent the chat from being opened
    setEditingChatId(chatId);
    setEditValue(currentTitle);
  };

  // Function to handle input changes
  const handleEditInputChange = (event) => {
    setEditValue(event.target.value);
  };

  // Function to save the edited chat title
  const saveEditedChatTitle = async (event, chatId) => {
    event.preventDefault();
    event.stopPropagation();

    if (!editValue.trim()) {
      setEditValue('Untitled Chat');
    }

    if (!isLoggedIn || !companyEmail) {
      console.error("User is not logged in or company email not found");
      return;
    }

    try {
      // Use shared company email if viewing a shared project, otherwise use user's own
      const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
      const sharedProjectId = localStorage.getItem('sharedProjectId');
      const activeProject = localStorage.getItem('currentProject') || currentProject || 'default';
      
      let targetCompanyEmail;
      if (sharedCompanyEmail && sharedProjectId && sharedProjectId === activeProject) {
        targetCompanyEmail = sharedCompanyEmail; // Already in comma format
      } else {
        targetCompanyEmail = companyEmail.replace(/\./g, ','); // Ensure comma format
      }
      
      // Find the chat to determine if it's public or private
      const chatToUpdate = chats.find(c => c.id === chatId);
      const isPrivateChat = chatToUpdate && chatToUpdate.isPublic === false;
      
      // Update the chat title in the correct Firebase path
      let titlePath;
      if (isPrivateChat && auth.currentUser?.email) {
        const userEmailFormatted = auth.currentUser.email.replace(/\./g, ',');
        titlePath = `Companies/${targetCompanyEmail}/projects/${activeProject}/privateChats/${userEmailFormatted}/${chatId}/title`;
      } else {
        titlePath = `Companies/${targetCompanyEmail}/projects/${activeProject}/groqChats/${chatId}/title`;
      }
      await saveFirebaseData(titlePath, editValue.trim());

      // Find the chat and update the title in the parent component
      const updatedChat = chats.find(chat => chat.id === chatId);
      if (updatedChat && onChatSelect && typeof onChatSelect === 'function') {
        // Create a new object with the updated title
        const updatedChatWithNewTitle = {
          ...updatedChat,
          title: editValue.trim()
        };

        // Notify the parent component about the title change
        onChatSelect(updatedChatWithNewTitle);
        
        // Also send message directly to sidebar iframe to update messaging topic with new title
        // This ensures the topic header updates immediately even if handleChatSelect doesn't send it
        const sidebarIframe = document.getElementById('sidebar-iframe');
        if (sidebarIframe && sidebarIframe.contentWindow) {
          sidebarIframe.contentWindow.postMessage({
            action: "updateMessagingTopic",
            chatId: chatId,
            chatTitle: editValue.trim()
          }, "*");
          console.log('[ChatSidebar] Sent updateMessagingTopic for title change:', chatId, editValue.trim());
        }
      }

      // Exit edit mode
      setEditingChatId(null);
    } catch (error) {
      console.error("Error renaming chat:", error);
    }
  };

  // Function to handle keydown events in the edit input
  const handleEditKeyDown = (event, chatId) => {
    if (event.key === 'Enter') {
      saveEditedChatTitle(event, chatId);
    } else if (event.key === 'Escape') {
      // Cancel editing
      setEditingChatId(null);
    }
  };

  // Function to handle clicking outside of the input to save
  const handleEditBlur = (event, chatId) => {
    saveEditedChatTitle(event, chatId);
  };

  // Function to handle search input changes
  const handleSearchInputChange = (event) => {
    setSearchQuery(event.target.value);
    performSearch(event.target.value);
  };

  // Function to perform the search
  const performSearch = (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const lowerCaseQuery = query.toLowerCase();

    // Search through chat titles and messages in both regular and shared chats
    const results = [...chats, ...sharedChats].filter(chat => {
      // Search in title
      const titleMatch = chat.title.toLowerCase().includes(lowerCaseQuery);

      // Search in messages
      let messageMatch = false;
      if (chat.messages && Array.isArray(chat.messages)) {
        messageMatch = chat.messages.some(message =>
          message.content && message.content.toLowerCase().includes(lowerCaseQuery)
        );
      }

      return titleMatch || messageMatch;
    });

    setSearchResults(results);
  };

  // Function to clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  // Function to toggle search mode
  const toggleSearch = () => {
    setIsSearching(!isSearching);
    if (!isSearching) {
      setSearchQuery('');
      setSearchResults([]);
      setIsCollapsed(false);
    }
  };

  // Function to show privacy warning dialog
  const toggleChatPrivacy = (event, chat) => {
    event.stopPropagation(); // Prevent the chat from being opened
    setMenuOpenForChatId(null); // Close the menu

    // Check current privacy state using isPublic field (NOT privateUser, which is now always set for ownership)
    const isCurrentlyPrivate = chat.isPublic === false;
    const chatTitle = chat.title || chat.name || 'this chat';
    
    if (isCurrentlyPrivate) {
      // Moving to public - show warning
      setPrivacyWarning({
        chat: chat,
        action: 'moveToPublic',
        message: `Are you sure you want to make "${chatTitle}" public? Once public, all team members in this project will be able to view and access this chat.`
      });
    } else {
      // Moving to private - show warning
      setPrivacyWarning({
        chat: chat,
        action: 'moveToPrivate',
        message: `Are you sure you want to make "${chatTitle}" private? Once private, only you will be able to see this chat. Other team members will no longer have access to it.`
      });
    }
  };

  // Function to actually perform the privacy change (called after user confirms)
  const confirmPrivacyChange = async () => {
    if (!privacyWarning || !privacyWarning.chat) {
      return;
    }

    const { chat, action } = privacyWarning;
    setPrivacyWarning(null); // Close dialog

    try {
      const { showToast } = await import('../funcs');
      
      // Use shared company email if viewing a shared project, otherwise use user's own
      // This matches the logic in createNewChat to ensure we're accessing the correct path
      const sharedCompanyEmail = localStorage.getItem('sharedCompanyEmail');
      const sharedProjectId = localStorage.getItem('sharedProjectId');
      const activeProject = localStorage.getItem('currentProject') || currentProject || 'default';
      
      let targetCompanyEmail;
      if (sharedCompanyEmail && sharedProjectId && sharedProjectId === activeProject) {
        // We're in a shared project - use the shared project owner's company email
        targetCompanyEmail = sharedCompanyEmail; // Already in comma format from localStorage
      } else {
        // We're in our own project - use our own company email
      const companyEmailPath = await getMainCompanyEmail();
      if (!companyEmailPath) {
        console.error("Company email not found");
        showToast("Company email not found", "error");
        return;
        }
        targetCompanyEmail = companyEmailPath.replace(/\./g, ','); // Ensure comma format
      }

      // Determine current storage location based on chat's isPublic status
      const user = auth.currentUser;
      const userEmailFormatted = user?.email ? user.email.replace(/\./g, ',') : null;
      
      // Check if the chat is currently private (stored in secure path)
      const isCurrentlyPrivate = chat.isPublic === false;
      
      let sourcePath;
      if (isCurrentlyPrivate && userEmailFormatted) {
        sourcePath = `Companies/${targetCompanyEmail}/projects/${activeProject}/privateChats/${userEmailFormatted}/${chat.id}`;
      } else {
        sourcePath = `Companies/${targetCompanyEmail}/projects/${activeProject}/groqChats/${chat.id}`;
      }
      
      // Get current chat data from Firebase
      const chatData = await getFirebaseData(sourcePath);
      const messagesData = await getFirebaseData(`${sourcePath}/messages`);
      const drawingsData = await getFirebaseData(`${sourcePath}/drawings`);
      
      if (!chatData) {
        console.error("Chat not found at path:", sourcePath);
        showToast("Chat not found", "error");
        return;
      }

      if (action === 'moveToPublic') {
        // Moving PRIVATE -> PUBLIC
        // This requires MOVING the chat from privateChats to groqChats path
        if (!userEmailFormatted) {
          showToast("User not authenticated", "error");
          return;
        }
        
        const publicPath = `Companies/${targetCompanyEmail}/projects/${activeProject}/groqChats/${chat.id}`;
        const privatePath = `Companies/${targetCompanyEmail}/projects/${activeProject}/privateChats/${userEmailFormatted}/${chat.id}`;
        
        // Create the chat in the public path
        const updatedChat = { ...chatData, isPublic: true };
        delete updatedChat.storagePath; // Remove internal tracking field
        await saveFirebaseData(publicPath, updatedChat);
        
        // Copy messages and drawings to new path
        if (messagesData) {
          await saveFirebaseData(`${publicPath}/messages`, messagesData);
        }
        if (drawingsData) {
          await saveFirebaseData(`${publicPath}/drawings`, drawingsData);
        }
        
        // Delete from the private path
        const privateRef = ref(database, privatePath);
        await remove(privateRef);
        
        console.log('[confirmPrivacyChange] Moved chat from PRIVATE to PUBLIC path');
        
        // Switch to public mode to follow the chat
        setChatMode('public');
        
        // Clear annotation popup state to prevent stale popups from appearing
        window.phrazeActiveAnnotationCardIds = [];
        window.phrazeKeepPopupOpenIds = new Set();
        
        // Update currentChat if it's the one being toggled
        if (currentChat && currentChat.id === chat.id) {
          onChatSelect({ ...currentChat, isPublic: true, storagePath: 'groqChats' });
        }
        
        showToast("Chat moved to Public. Switching to Public chats...", "success");
        console.log("Chat moved to Public (server-secured path change)");
      } else if (action === 'moveToPrivate') {
        // Moving PUBLIC -> PRIVATE
        if (!user || !user.email) {
          console.error("User not authenticated");
          showToast("User not authenticated", "error");
          return;
        }
        
        // Check if user wants to create a copy instead of moving
        if (createCopyBeforePrivate) {
          // Create a private copy and keep the original public
          try {
            const copiedChat = await createChatCopy(chat, targetCompanyEmail, activeProject);
            
            console.log('[confirmPrivacyChange] copiedChat returned:', copiedChat);
            
            // Reset the checkbox
            setCreateCopyBeforePrivate(false);
            
            // The original chat stays public, so we don't modify it
            // DON'T manually add to local state - the Firebase listener will pick it up
            // This prevents duplicate key errors
            
            // Switch to private mode to show the new copied chat
            console.log('[confirmPrivacyChange] Switching to private mode');
            setChatMode('private');
            
            // Clear annotation popup state to prevent stale popups from appearing in new chat
            window.phrazeActiveAnnotationCardIds = [];
            window.phrazeKeepPopupOpenIds = new Set();
            
            // Select the new copied chat after a small delay to allow Firebase listener to pick it up
            setTimeout(() => {
              if (onChatSelect && typeof onChatSelect === 'function') {
                console.log('[confirmPrivacyChange] Selecting copied chat:', copiedChat.id);
                onChatSelect(copiedChat);
              }
            }, 300);
            
            showToast("Private copy created! Switching to Private chats...", "success");
            console.log("Created private copy of chat, original remains public");
          } catch (copyError) {
            console.error("Error creating chat copy:", copyError);
            showToast("Failed to create private copy", "error");
          }
        } else {
          // Move the chat from PUBLIC to PRIVATE path (server-secured)
          const publicPath = `Companies/${targetCompanyEmail}/projects/${activeProject}/groqChats/${chat.id}`;
          const privatePath = `Companies/${targetCompanyEmail}/projects/${activeProject}/privateChats/${userEmailFormatted}/${chat.id}`;
          
          // Create the chat in the private path (server-secured)
          const updatedChat = { ...chatData, isPublic: false, privateUser: user.email };
          delete updatedChat.storagePath; // Remove internal tracking field
          await saveFirebaseData(privatePath, updatedChat);
          
          // Copy messages and drawings to new path
          if (messagesData) {
            await saveFirebaseData(`${privatePath}/messages`, messagesData);
          }
          if (drawingsData) {
            await saveFirebaseData(`${privatePath}/drawings`, drawingsData);
          }
          
          // Delete from the public path
          const publicRef = ref(database, publicPath);
          await remove(publicRef);
          
          console.log('[confirmPrivacyChange] Moved chat from PUBLIC to PRIVATE path (server-secured)');
          
          // Switch to private mode to follow the chat
          
          // Clear annotation popup state to prevent stale popups from appearing
          window.phrazeActiveAnnotationCardIds = [];
          window.phrazeKeepPopupOpenIds = new Set();
        
          // Update currentChat if it's the one being toggled
          if (currentChat && currentChat.id === chat.id) {
            onChatSelect({ ...currentChat, isPublic: false, privateUser: user.email, storagePath: 'privateChats' });
          }
        
          showToast("Chat moved to Private (secured). Switching to Private chats...", "success");
          console.log("Chat moved to Private (server-secured path change)");
        }
        
        // Reset the checkbox state
        setCreateCopyBeforePrivate(false);
      }
    } catch (error) {
      console.error("Error toggling chat privacy:", error);
      try {
        const { showToast } = await import('../funcs');
        showToast("Failed to update chat privacy", "error");
      } catch (e) {
        console.error("Failed to show error toast:", e);
      }
    }
  };

  // Function to cancel privacy change
  const cancelPrivacyChange = () => {
    setPrivacyWarning(null);
    setCreateCopyBeforePrivate(false); // Reset the checkbox
  };

  // Function to create a full copy of a chat (including messages, highlights, annotations, etc.)
  const createChatCopy = async (sourceChat, targetCompanyEmail, activeProject) => {
    // Check if user is a viewer - viewers cannot create chat copies
    if (currentUserRole === 'viewer') {
      const { showToast } = await import('../funcs');
      showToast('Viewers cannot create chat copies', 'error');
      throw new Error('Viewers cannot create chat copies');
    }
    
    const { showToast } = await import('../funcs');
    
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error("User not authenticated");
      }

      // Generate new chat ID
      const newChatId = `chat_${Date.now()}`;
      const chatTitle = sourceChat.title || sourceChat.name || 'Untitled Chat';
      
      // Get the source chat path
      const sourceChatPath = `Companies/${targetCompanyEmail}/projects/${activeProject}/groqChats/${sourceChat.id}`;
      
      // Fetch the full chat data including messages
      const sourceChatData = await getFirebaseData(sourceChatPath);
      const sourceMessages = await getFirebaseData(`${sourceChatPath}/messages`);
      const sourceDrawings = await getFirebaseData(`${sourceChatPath}/drawings`);
      
      if (!sourceChatData) {
        throw new Error("Source chat not found");
      }

      // Create the new chat object as a private copy (remove messages array to avoid duplication)
      const { messages: _, ...chatDataWithoutMessages } = sourceChatData;
      
      // IMPORTANT: Explicitly delete fields from source to ensure private copy is truly independent
      delete chatDataWithoutMessages.isPublic;
      delete chatDataWithoutMessages.privateUser;
      delete chatDataWithoutMessages.ownerId;
      delete chatDataWithoutMessages.id; // Remove old ID to ensure new ID is used
      
      const newChat = {
        ...chatDataWithoutMessages,
        title: chatTitle, // Keep the same name without "(Copy)" suffix
        timestamp: Date.now(),
        ownerId: user.email,
        isPublic: false, // Make it private - completely independent
        privateUser: user.email, // Set ownership to current user
        copiedFrom: sourceChat.id, // Track the source for reference only
        copiedAt: new Date().toISOString()
        // Note: messages property is intentionally omitted - messages are stored separately in /messages path
      };
      
      console.log('[createChatCopy] Creating private copy with isPublic:', newChat.isPublic, 'privateUser:', newChat.privateUser);

      // Save the new chat to the SECURE private path (SERVER-ENFORCED SECURITY)
      // Private chats are stored at: privateChats/$userEmail/$chatId
      // Only the owner can read/write this path - enforced by Firebase rules
      const userEmailFormatted = user.email.replace(/\./g, ',');
      const newChatPath = `Companies/${targetCompanyEmail}/projects/${activeProject}/privateChats/${userEmailFormatted}/${newChatId}`;
      console.log('[createChatCopy] Saving private chat to SECURE path:', newChatPath);
      await saveFirebaseData(newChatPath, newChat);
      console.log('[createChatCopy] Chat saved successfully to secure private path');

      // Copy messages separately if they exist (this ensures they're in the /messages path, not in chat object)
      if (sourceMessages) {
        // Deep clone messages to ensure they're completely independent
        const copiedMessages = JSON.parse(JSON.stringify(sourceMessages));
        await saveFirebaseData(`${newChatPath}/messages`, copiedMessages);
      } else {
        // Initialize with empty messages array to ensure chat is independent
        await saveFirebaseData(`${newChatPath}/messages`, {});
      }

      // Copy drawings if they exist
      if (sourceDrawings) {
        const copiedDrawings = JSON.parse(JSON.stringify(sourceDrawings));
        await saveFirebaseData(`${newChatPath}/drawings`, copiedDrawings);
      }

      // Copy related highlights and create mapping for annotation updates
      const highlightIdMapping = {}; // Map old highlight ID -> new highlight ID
      
      try {
        let sourceHighlights = await getFirebaseData(`Companies/${targetCompanyEmail}/projects/${activeProject}/highlights`);
        if (Array.isArray(sourceHighlights) && sourceHighlights.length > 0) {
          // Filter highlights that belong to this chat
          const relevantHighlights = sourceHighlights.filter(h => h && h.chatID === sourceChat.id);
          
          if (relevantHighlights.length > 0) {
            // Clone highlights with new IDs and new chatID
            const newHighlights = relevantHighlights.map(h => {
              const newHighlightId = `${h.id}_copy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
              // Store mapping for annotation updates
              highlightIdMapping[h.id] = newHighlightId;
              
              return {
              ...h,
                id: newHighlightId,
              chatID: newChatId,
              copiedFrom: h.id
              };
            });

            // Merge with existing highlights
            const allHighlights = [...sourceHighlights, ...newHighlights];
            await saveFirebaseData(`Companies/${targetCompanyEmail}/projects/${activeProject}/highlights`, allHighlights);
          }
        }
      } catch (hlErr) {
        console.warn('Error copying highlights:', hlErr);
      }

      // Copy related annotations with proper highlightID mapping
      try {
        let sourceAnnotations = await getFirebaseData(`Companies/${targetCompanyEmail}/projects/${activeProject}/annotationHistory`);
        if (typeof sourceAnnotations === 'string') {
          try { sourceAnnotations = JSON.parse(sourceAnnotations); } catch (_) { sourceAnnotations = []; }
        }
        
        if (Array.isArray(sourceAnnotations) && sourceAnnotations.length > 0) {
          // Filter annotations that belong to this chat
          const relevantAnnotations = sourceAnnotations.filter(entry => {
            if (!Array.isArray(entry)) return false;
            const chatIdObj = entry.find(obj => obj && Object.prototype.hasOwnProperty.call(obj, 'chatID'));
            return chatIdObj && chatIdObj.chatID === sourceChat.id;
          });

          if (relevantAnnotations.length > 0) {
            // Clone annotations with new IDs, new chatID, and mapped highlightID
            const newAnnotations = relevantAnnotations.map(entry => {
              const cloned = entry.map(obj => ({ ...obj }));
              // Update chatID
              const chatIdObj = cloned.find(obj => obj && Object.prototype.hasOwnProperty.call(obj, 'chatID'));
              if (chatIdObj) chatIdObj.chatID = newChatId;
              
              // Update highlightID to match the NEW highlight ID (using mapping)
              const highlightIdObj = cloned.find(obj => obj && Object.prototype.hasOwnProperty.call(obj, 'highlightID'));
              if (highlightIdObj && highlightIdObj.highlightID) {
                // Use the mapped new highlight ID if available, otherwise generate new one
                if (highlightIdMapping[highlightIdObj.highlightID]) {
                  highlightIdObj.highlightID = highlightIdMapping[highlightIdObj.highlightID];
                } else {
                  // Fallback: generate new ID if mapping not found
                highlightIdObj.highlightID = `${highlightIdObj.highlightID}_copy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
              }
              }
              
              // Generate new unique ID for annotation entry
              const idObj = cloned.find(obj => obj && Object.prototype.hasOwnProperty.call(obj, 'id'));
              if (idObj) {
                idObj.id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
              } else {
                cloned.unshift({ id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) });
              }
              return cloned;
            });

            // Merge with existing annotations
            const allAnnotations = [...sourceAnnotations, ...newAnnotations];
            await saveFirebaseData(`Companies/${targetCompanyEmail}/projects/${activeProject}/annotationHistory`, JSON.stringify(allAnnotations));
          }
        }
      } catch (annErr) {
        console.warn('Error copying annotations:', annErr);
      }

      const returnedChat = { id: newChatId, ...newChat };
      console.log(`[createChatCopy] Created private copy of chat with ID: ${returnedChat.id}`);
      return returnedChat;
    } catch (error) {
      console.error("Error creating chat copy:", error);
      throw error;
    }
  };

  // Function to remove a shared chat from the list (doesn't delete it from Firebase)
  const removeSharedChat = (event, chatId) => {
    event.stopPropagation(); // Prevent the chat from being opened

    if (window.confirm("Remove this shared chat from your list? This won't delete it completely.")) {
      try {
        // Remove the chat ID from local storage
        const storedSharedChats = JSON.parse(localStorage.getItem('accessedSharedChats') || '[]');
        const updatedSharedChats = storedSharedChats.filter(id => id !== chatId);
        localStorage.setItem('accessedSharedChats', JSON.stringify(updatedSharedChats));

        // Remove from state
        setSharedChats(prev => prev.filter(chat => chat.id !== chatId));

        // If this was the currently selected chat, select another one
        const nextChat = sharedChats.find(chat => chat.id !== chatId) ||
          chats.length > 0 ? chats[0] : null;

        if (nextChat && onChatSelect && typeof onChatSelect === 'function') {
          onChatSelect(nextChat);
        } else if (onChatSelect && typeof onChatSelect === 'function') {
          // No chats left, clear the selection
          onChatSelect(null);
        }
      } catch (error) {
        console.error("Error removing shared chat:", error);
      }
    }
  };

  // Fetch profile picture when auth state is ready
  useEffect(() => {
    const fetchProfilePictureOnAuth = async () => {
      // Set up one-time auth check to get initial profile picture
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
          // Removed console.log for performance
          const email = user.email.replace('.', ',');
          const companyEmailPath = await getFirebaseData(`emailToCompanyDirectory/${email}`);
          
          if (companyEmailPath) {
            const imageData = await getFirebaseData(`Companies/${companyEmailPath}/users/${email}/profileImage`);
            
            if (imageData) {
              // Removed console.log for performance
              setProfileImage(imageData);
            }
          }
        }
        // Unsubscribe after first call
        unsubscribe();
      });
    };
    
    fetchProfilePictureOnAuth();
  }, []);

  useEffect(() => {
    updateProfilePicture(function (data) {
      // Removed console.log for performance
      if (data) {
        setProfileImage(data);
      }
    }, "ChatSidebar");
    
    // Listen for custom profileImageUpdated event
    const handleProfileImageUpdate = (event) => {
      // Removed console.log for performance
      if (event.detail && event.detail.imageUrl) {
        setProfileImage(event.detail.imageUrl);
      }
    };
    
    window.addEventListener('profileImageUpdated', handleProfileImageUpdate);
    
    return () => {
      window.removeEventListener('profileImageUpdated', handleProfileImageUpdate);
    };
  }, []);

  // Utility: group chats by month with "Today" section first
  const groupChatsByMonth = (chatArray) => {
    const groups = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    const isToday = (ts) => {
      const chatDate = new Date(ts);
      const chatDay = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());
      return chatDay.getTime() === today.getTime();
    };
    
    const isYesterday = (ts) => {
      const chatDate = new Date(ts);
      const chatDay = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());
      return chatDay.getTime() === yesterday.getTime();
    };
    
    const getMonthKey = (ts) => {
      const d = new Date(ts);
      return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    };

    chatArray.forEach((c) => {
      let key;
      if (isToday(c.timestamp)) {
        key = 'Today';
      } else if (isYesterday(c.timestamp)) {
        key = 'Yesterday';
      } else {
        key = getMonthKey(c.timestamp);
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    // Sort groups: Today first, Yesterday second, then by month order (current back to earlier)
    const order = Object.keys(groups).sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;
      
      // For months, sort by actual date (most recent first)
      const getMonthDate = (monthKey) => {
        const [month, year] = monthKey.split(' ');
        return new Date(`${month} 1, ${year}`);
      };
      
      return getMonthDate(b) - getMonthDate(a);
    });

    return { groups, order };
  };

  // Determine if we are on the Demonstration page
  const isDemonstrationPage = location.pathname === '/demonstration';

  // Groq-style minimal sidebar for Demonstration page only
  if (isDemonstrationPage) {
    // Check if we're in a shared project
    const isSharedProject = isProjectShared(selectedProject);
    
    // Filter chats based on public/private mode (only for shared projects)
    // Note: We use isPublic field, NOT privateUser (which is now always set for ownership tracking)
    const visibleChats = chats.filter(chat => {
      // For private projects, show all chats
      if (!isSharedProject) {
        return true;
      }
      
      // For shared projects, respect the public/private toggle
      if (chatMode === 'public') {
        // Show public chats (isPublic !== false means public, including undefined for backward compatibility)
        return chat.isPublic !== false;
      } else {
        // Show private chats that belong to current user
        const isPrivate = chat.isPublic === false;
        const isOwned = chat.privateUser && auth.currentUser && chat.privateUser === auth.currentUser.email;
        return isPrivate && isOwned;
      }
    });
    const { groups, order } = groupChatsByMonth(visibleChats);
    return (
      <>
        {/* Privacy Warning Dialog */}
        {privacyWarning && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10001
            }}
            onClick={cancelPrivacyChange}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '24px',
                width: '600px',
                maxWidth: '90vw',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                border: '1px solid #e5e7eb'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#202123',
                letterSpacing: '-0.01em'
              }}>
                {privacyWarning.action === 'moveToPublic' ? 'Make Chat Public?' : 'Make Chat Private?'}
              </h3>
              <div style={{
                backgroundColor: '#f7f7f8',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
                border: '1px solid #e5e7eb'
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#565869',
                  lineHeight: '1.6'
                }}>
                  {privacyWarning.action === 'moveToPublic' ? (
                    <>
                      Are you sure you want to make{' '}
                      <span style={{
                        display: 'inline-block',
                        backgroundColor: '#ffffff',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: '500',
                        color: '#202123',
                        border: '1px solid #d1d5db',
                        margin: '0 3px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        fontSize: '13px'
                      }}>
                        "{privacyWarning.chat?.title || privacyWarning.chat?.name || 'this chat'}"
                      </span>
                      {' '}public? Once public, all team members in this project will be able to view and access this chat.
                    </>
                  ) : (
                    <>
                      Are you sure you want to make{' '}
                      <span style={{
                        display: 'inline-block',
                        backgroundColor: '#ffffff',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: '500',
                        color: '#202123',
                        border: '1px solid #d1d5db',
                        margin: '0 3px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        fontSize: '13px'
                      }}>
                        "{privacyWarning.chat?.title || privacyWarning.chat?.name || 'this chat'}"
                      </span>
                      {' '}private? Once private, only you will be able to see this chat. Other team members will no longer have access to it.
                    </>
                  )}
                </p>
              </div>
              
              {/* Copy option - only show when moving to private */}
              {privacyWarning.action === 'moveToPrivate' && (
                <div style={{
                  backgroundColor: '#f0f9ff',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px',
                  border: '1px solid #bae6fd'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#0369a1'
                  }}>
                    <input
                      type="checkbox"
                      checked={createCopyBeforePrivate}
                      onChange={(e) => setCreateCopyBeforePrivate(e.target.checked)}
                      style={{
                        width: '18px',
                        height: '18px',
                        marginTop: '2px',
                        cursor: 'pointer',
                        accentColor: '#0284c7'
                      }}
                    />
                    <div>
                      <span style={{ fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                        Create a private copy instead
                      </span>
                      <span style={{ fontSize: '13px', color: '#0c4a6e', lineHeight: '1.5' }}>
                        Keep the original chat public for your team, and create a private copy for yourself. 
                        All messages, highlights, annotations, labels, and codes will be duplicated.
                      </span>
                    </div>
                  </label>
                </div>
              )}
              
              <div style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={cancelPrivacyChange}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#565869',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#f7f7f8';
                    e.target.style.borderColor = '#c5c5d2';
                    e.target.style.color = '#202123';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.color = '#565869';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPrivacyChange}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: createCopyBeforePrivate && privacyWarning.action === 'moveToPrivate' ? '#0284c7' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    minWidth: '100px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = createCopyBeforePrivate && privacyWarning.action === 'moveToPrivate' ? '#0369a1' : '#2563eb';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = createCopyBeforePrivate && privacyWarning.action === 'moveToPrivate' ? '#0284c7' : '#3b82f6';
                  }}
                >
                  {createCopyBeforePrivate && privacyWarning.action === 'moveToPrivate' ? 'Create Copy' : 'OK'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div 
          className="sidebar-transition"
          style={{
            width: !isInsideExtension ? (isCollapsed ? '60px' : '300px') : (isCollapsed ? '60px' : '100%'),
            height: '100vh',
            background: '#ffffff',
            borderRight: '1px solid rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            minWidth: isCollapsed ? '60px' : '300px',
            maxWidth: !isInsideExtension ? (isCollapsed ? '60px' : '300px') : (isCollapsed ? '60px' : '100%')
          }}>
        {/* Logo section - always visible when logged in */}
        {isLoggedIn && projects.length > 0 && (
          <div style={{ padding: '12px 12px 0', display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-start', marginBottom: '12px' }}>
            <img 
              src={getImagePath('star.png')} 
              alt="Logo" 
              style={{ 
                width: '34px', 
                height: '34px',
                objectFit: 'contain',
                imageRendering: 'crisp-edges',
                filter: 'none',
                marginLeft: isCollapsed ? '0' : '4px'
              }} 
            />
          </div>
        )}

        {/* Projects section - transforms from icon to dropdown */}
        {isLoggedIn && projects.length > 0 && (
          <div style={{ padding: '12px 12px 0' }}>
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', 
                  justifyContent: isCollapsed ? 'center' : 'space-between', gap: '8px',
                  border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 10px', 
                  background: '#fff', color: '#111', cursor: 'pointer'
                }}
                onClick={() => {
                  if (isCollapsed) {
                    setIsCollapsed(false);
                  } else {
                    // Make dropdown context-aware: determine correct tab based on current project
                    // Check if current project is a received shared project (in sharedProjects array)
                    const sharedProjectId = localStorage.getItem('sharedProjectId');
                    const isReceivedSharedProject = (sharedProjectId && sharedProjectId === selectedProject) ||
                      sharedProjects.some(proj => proj.projectId === selectedProject);
                    
                    // Set the appropriate tab based on whether it's a shared project
                    // Check if project is in sharedProjects array (either owned with members OR received)
                    const isInSharedList = sharedProjects.some(proj => proj.projectId === selectedProject);
                    
                    if (isReceivedSharedProject || isInSharedList) {
                      setProjectTab('shared');
                    } else {
                      setProjectTab('private');
                    }
                    setDropdownOpen((open) => !open);
                  }
                }}
                type="button"
                title={isCollapsed ? (selectedProject === 'default' ? 'Default Project' : selectedProject) : ''}
              >
                {isCollapsed ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z"></path>
                    <path d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z"></path>
                  </svg>
                ) : (
                  <>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Icon indicator for project sharing status */}
                      {isCurrentProjectShared ? (
                        // Shared project icon (Users/Group icon)
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" style={{ flexShrink: 0 }}>
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                      ) : (
                        // Private project icon (Lock icon)
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" style={{ flexShrink: 0 }}>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      )}
                      {selectedProject === 'default' ? 'Default Project' : selectedProject}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2">
                      <path d="M7 10l5 5 5-5z"/>
                    </svg>
                  </>
                )}
              </button>
              {!isCollapsed && dropdownOpen && (
                <div ref={dropdownContentRef} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 10px 24px rgba(0,0,0,0.10)', zIndex: 100, padding: '12px', maxHeight: '480px', overflowY: 'auto' }}>
                  {/* Tab buttons */}
                  <div style={{ 
                    display: 'flex', 
                    background: '#f3f4f6', 
                    borderRadius: '8px', 
                    padding: '3px',
                    marginBottom: '8px',
                    gap: '2px'
                  }}>
                    <button
                      onClick={() => setProjectTab('private')}
                      type="button"
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        fontWeight: projectTab === 'private' ? 600 : 500,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        background: projectTab === 'private' ? '#ffffff' : 'transparent',
                        color: projectTab === 'private' ? '#111827' : '#6b7280',
                        boxShadow: projectTab === 'private' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 150ms ease'
                      }}
                    >
                      Private Projects
                    </button>
                    <button
                      onClick={() => setProjectTab('shared')}
                      type="button"
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        fontWeight: projectTab === 'shared' ? 600 : 500,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        background: projectTab === 'shared' ? '#ffffff' : 'transparent',
                        color: projectTab === 'shared' ? '#111827' : '#6b7280',
                        boxShadow: projectTab === 'shared' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 150ms ease'
                      }}
                    >
                      Shared Projects
                    </button>
                  </div>

                  {/* Private Projects Tab */}
                  {projectTab === 'private' && (
                    <>
                      {projects.map((proj) => (
                        <div
                          key={proj}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            width: '100%'
                          }}
                        >
                          <div
                            ref={selectedProject === proj ? selectedProjectRef : null}
                            onClick={() => switchToPrivateProject(proj)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                switchToPrivateProject(proj);
                              }
                            }}
                            style={{
                              flex: 1,
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
                              transition: 'background 0.18s'
                            }}
                            onMouseEnter={(e) => { 
                              e.currentTarget.style.backgroundColor = '#f5f5f5';
                            }}
                            onMouseLeave={(e) => { 
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            {selectedProject === proj && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.25">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                            <span>{proj === 'default' ? 'Default Project' : proj}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setShareModalProjectId(proj);
                              setShowShareModal(true);
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                            type="button"
                            style={{
                              background: '#f3f4f6',
                              border: '1px solid #e5e7eb',
                              padding: '6px 8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                              color: '#6b7280',
                              marginLeft: '4px',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => { 
                              e.currentTarget.style.backgroundColor = '#e5e7eb';
                              e.currentTarget.style.color = '#111827';
                            }}
                            onMouseLeave={(e) => { 
                              e.currentTarget.style.backgroundColor = '#f3f4f6';
                              e.currentTarget.style.color = '#6b7280';
                            }}
                            title="Share project"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <circle cx="18" cy="5" r="3"/>
                              <circle cx="6" cy="12" r="3"/>
                              <circle cx="18" cy="19" r="3"/>
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                      {/* New Project Option */}
                      <div style={{ borderTop: '1px solid rgba(0,0,0,0.10)', margin: '4px 0' }}></div>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          setShowNewProjectModal(true);
                        }}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          color: '#374151',
                          border: 'none',
                          outline: 'none',
                          padding: '10px 16px',
                          fontSize: '0.95rem',
                          fontWeight: 500,
                          textAlign: 'left',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'background 0.18s, color 0.18s',
                          margin: '2px 0'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New Project
                      </button>
                    </>
                  )}

                  {/* Shared Projects Tab */}
                  {projectTab === 'shared' && (
                    <>
                      {/* Join a shared project section */}
                      <div style={{
                        padding: '16px 12px 12px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        background: '#fafafa',
                        marginBottom: sharedProjects.length > 0 ? '12px' : '0'
                      }}>
                        <div style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          marginBottom: '16px',
                          color: '#374151'
                        }}>
                          Join a shared project
                        </div>
                        <input
                          type="text"
                          value={inviteCodeInput}
                          onChange={(e) => {
                            const val = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
                            setInviteCodeInput(val);
                          }}
                          placeholder="Enter invite code"
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                            marginBottom: '16px',
                            boxSizing: 'border-box',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && inviteCodeInput.trim()) {
                              handleAcceptInvite();
                            }
                          }}
                        />
                        <button
                          onClick={handleAcceptInvite}
                          disabled={!inviteCodeInput.trim()}
                          style={{
                            width: '100%',
                            background: inviteCodeInput.trim() ? '#111827' : '#d1d5db',
                            color: '#ffffff',
                            border: 'none',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: inviteCodeInput.trim() ? 'pointer' : 'not-allowed'
                          }}
                        >
                          Join Project
                        </button>
                      </div>

                      {/* Shared projects list - Grouped with expandable sections */}
                      {sharedProjects.length > 0 && (() => {
                        const ownedShared = sharedProjects.filter(p => p.isOwner);
                        const receivedShared = sharedProjects.filter(p => !p.isOwner);
                        
                        return (
                          <div style={{ marginTop: sharedProjects.length > 0 ? '8px' : '0' }}>
                            {/* My Shared Projects Section */}
                            {ownedShared.length > 0 && (
                              <div style={{ marginBottom: '12px' }}>
                                <button
                                  onClick={() => setMySharedExpanded(!mySharedExpanded)}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '8px 4px',
                                    cursor: 'pointer',
                                    color: '#374151',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    textAlign: 'left'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = '#374151'}
                                >
                                  <span>My Shared</span>
                                  <svg 
                                    width="14" 
                                    height="14" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2"
                                    style={{
                                      transform: mySharedExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                      transition: 'transform 0.2s'
                                    }}
                                  >
                                    <polyline points="6 9 12 15 18 9"/>
                                  </svg>
                                </button>
                                {mySharedExpanded && (
                                  <div style={{ marginTop: '4px' }}>
                                    {ownedShared.map((proj) => (
                                      <div
                                        key={`${proj.ownerCompany}-${proj.projectId}`}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          width: '100%'
                                        }}
                                      >
                                        <div
                                          ref={selectedProject === proj.projectId ? selectedProjectRef : null}
                                          onClick={() => {
                                            if (proj.isOwner) {
                                              // If user owns this shared project, still treat it as a shared project
                                              // (stay in shared tab, just switch to this project)
                                              switchToPrivateProject(proj.projectId);
                                            } else {
                                              // If shared with user by someone else, use shared project handler
                                              handleSelectSharedProject(proj);
                                            }
                                          }}
                                          role="button"
                                          tabIndex={0}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              if (proj.isOwner) {
                                                switchToPrivateProject(proj.projectId);
                                              } else {
                                                handleSelectSharedProject(proj);
                                              }
                                            }
                                          }}
                                          style={{
                                            flex: 1,
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
                                          <span style={{ flex: 1 }}>{proj.projectId === 'default' ? 'Default Project' : proj.projectId}</span>
                                          {proj.isOwner && (
                                            <span style={{
                                              fontSize: '0.7rem',
                                              color: '#059669',
                                              background: '#d1fae5',
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              fontWeight: 600
                                            }}>
                                              Owner
                                            </span>
                                          )}
                                        </div>
                                        {proj.isOwner && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              setShareModalProjectId(proj.projectId);
                                              setShowShareModal(true);
                                            }}
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                            }}
                                            type="button"
                                            style={{
                                              background: '#f3f4f6',
                                              border: '1px solid #e5e7eb',
                                              padding: '4px 6px',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              borderRadius: '4px',
                                              color: '#6b7280',
                                              marginLeft: '4px',
                                              flexShrink: 0
                                            }}
                                            onMouseEnter={(e) => { 
                                              e.currentTarget.style.backgroundColor = '#e5e7eb';
                                              e.currentTarget.style.color = '#111827';
                                            }}
                                            onMouseLeave={(e) => { 
                                              e.currentTarget.style.backgroundColor = '#f3f4f6';
                                              e.currentTarget.style.color = '#6b7280';
                                            }}
                                            title="Share project"
                                          >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                              <circle cx="18" cy="5" r="3"/>
                                              <circle cx="6" cy="12" r="3"/>
                                              <circle cx="18" cy="19" r="3"/>
                                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Joined Projects Section */}
                            {receivedShared.length > 0 && (
                              <div>
                                <button
                                  onClick={() => setJoinedExpanded(!joinedExpanded)}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '8px 4px',
                                    cursor: 'pointer',
                                    color: '#374151',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    textAlign: 'left'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = '#374151'}
                                >
                                  <span>Joined</span>
                                  <svg 
                                    width="14" 
                                    height="14" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2"
                                    style={{
                                      transform: joinedExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                      transition: 'transform 0.2s'
                                    }}
                                  >
                                    <polyline points="6 9 12 15 18 9"/>
                                  </svg>
                                </button>
                                {joinedExpanded && (
                                  <div style={{ marginTop: '4px' }}>
                                    {receivedShared.map((proj) => (
                                      <button
                                        key={`${proj.ownerCompany}-${proj.projectId}`}
                                        ref={selectedProject === proj.projectId ? selectedProjectRef : null}
                                        onClick={() => {
                                          handleSelectSharedProject(proj);
                                        }}
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
                                        <span style={{ flex: 1 }}>{proj.projectId === 'default' ? 'Default Project' : proj.projectId}</span>
                                        <span style={{
                                          fontSize: '0.7rem',
                                          color: '#9ca3af',
                                          background: '#f3f4f6',
                                          padding: '2px 6px',
                                          borderRadius: '4px'
                                        }}>
                                          Shared
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {sharedProjects.length === 0 && (
                        <div style={{ 
                          padding: '20px 12px', 
                          textAlign: 'center', 
                          color: '#6b7280',
                          fontSize: '0.85rem'
                        }}>
                          <p style={{ margin: '0 0 16px 0' }}>No shared projects yet</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
          </div>
        </div>
      )}

        {/* Public/Private Toggle - ONLY show for Shared Projects, NOT for Private Projects */}
        {!isCollapsed && (() => {
          // Check if we're currently viewing a shared project
          const isSharedProject = isProjectShared(selectedProject);
          
          // CRITICAL: Only show toggle for shared projects
          // Private projects should NOT have this toggle (they show all chats)
          if (!isSharedProject) {
            return null; // Hide toggle for private projects
          }
          
          // Show toggle only for shared projects
          return (
            <div style={{ padding: '16px 12px 12px 12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: '#f3f4f6',
                borderRadius: '10px',
                padding: '4px',
                gap: '4px'
              }}>
                <button
                  onClick={() => setChatMode('public')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '8px',
                    background: chatMode === 'public' ? '#ffffff' : 'transparent',
                    color: chatMode === 'public' ? '#111' : '#6b7280',
                    fontWeight: chatMode === 'public' ? '600' : '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: chatMode === 'public' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Public
                </button>
                <button
                  onClick={() => setChatMode('private')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '8px',
                    background: chatMode === 'private' ? '#ffffff' : 'transparent',
                    color: chatMode === 'private' ? '#111' : '#6b7280',
                    fontWeight: chatMode === 'private' ? '600' : '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: chatMode === 'private' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Private
                </button>
              </div>
            </div>
          );
        })()}

        {/* Primary actions - transforms from icon to full buttons */}
        <div style={{ padding: '12px 12px 6px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Search button */}
          <button
            onClick={() => setShowSearchOverlay(true)}
            id="search-button"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              border: 'none', background: 'transparent', color: '#111', 
              cursor: 'pointer',
              justifyContent: isCollapsed ? 'center' : 'flex-start'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            onMouseDown={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
            onMouseUp={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
            title={isCollapsed ? "Search" : ""}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            {!isCollapsed && <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#111' }}>Search</span>}
          </button>
          <button
            onClick={() => { setIsLibraryVisible(false); createNewChat(); }}
            disabled={!isLoggedIn || currentUserRole === 'viewer'}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              border: 'none', background: 'transparent', 
              color: (!isLoggedIn || currentUserRole === 'viewer') ? '#9ca3af' : '#111', 
              cursor: (!isLoggedIn || currentUserRole === 'viewer') ? 'not-allowed' : 'pointer',
              opacity: (!isLoggedIn || currentUserRole === 'viewer') ? 0.5 : 1,
              justifyContent: isCollapsed ? 'center' : 'flex-start'
            }}
            onMouseEnter={(e) => { 
              if (isLoggedIn && currentUserRole !== 'viewer') {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            onMouseDown={(e) => { 
              if (isLoggedIn && currentUserRole !== 'viewer') {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }
            }}
            onMouseUp={(e) => { 
              if (isLoggedIn && currentUserRole !== 'viewer') {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }
            }}
            title={currentUserRole === 'viewer' ? "View Only Mode: You cannot create new chats. Contact the project owner to request editor access." : (isCollapsed ? "New Chat" : "Create a new chat")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            {!isCollapsed && <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#111' }}>Chat</span>}
          </button>
          {!isCollapsed && (
            <button
              onClick={() => { setIsLibraryVisible(true); setIsExtensionSidebarVisible(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                border: 'none', background: 'transparent', color: '#111', cursor: 'pointer'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              onMouseDown={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
              onMouseUp={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 16, height: 16 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#111' }}>Library</span>
            </button>
          )}
        </div>

        {/* Spacer to center profile section when collapsed */}
        {isCollapsed && <div style={{ flex: 1 }} />}

        {/* History or Search Results */}
        {!isCollapsed && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
            {!searchQuery && (
              <>
                {/* User Chats Section */}
                {(() => {
                  // Check if we're currently viewing a shared project
                  const isSharedProject = isProjectShared(selectedProject);
                  
                  // Filter chats based on public/private mode
                  // Note: We use isPublic field, NOT privateUser (which is now always set for ownership tracking)
                  const filteredChats = chats.filter(chat => {
                    // For private projects, show all chats (no filtering)
                    if (!isSharedProject) {
                      return true;
                    }
                    
                    // For shared projects, respect the public/private toggle
                    if (chatMode === 'public') {
                      // Show public chats (isPublic !== false means public, including undefined for backward compatibility)
                      return chat.isPublic !== false;
                    } else {
                      // Show private chats that belong to current user
                      return chat.isPublic === false && chat.privateUser && auth.currentUser && chat.privateUser === auth.currentUser.email;
                    }
                  });

                  // Deduplicate chats by ID to prevent duplicate keys (do this early so both sections can use it)
                  const uniqueChatsMap = new Map();
                  filteredChats.forEach(chat => {
                    if (!uniqueChatsMap.has(chat.id)) {
                      uniqueChatsMap.set(chat.id, chat);
                    }
                  });
                  const deduplicatedChats = Array.from(uniqueChatsMap.values());

                  if (deduplicatedChats.length === 0 && (!sharedChats || sharedChats.length === 0)) {
                    // Check if we're in a shared project for empty state messaging
                    const isSharedProject = isProjectShared(selectedProject);
                    
                    return (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                        </svg>
                        <p style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '8px' }}>
                          {isSharedProject 
                            ? (chatMode === 'public' ? 'No public chats yet' : 'No private chats yet')
                            : 'No chats yet'}
                        </p>
                        <p style={{ fontSize: '0.85rem' }}>
                          {isSharedProject
                            ? (chatMode === 'public' 
                                ? 'Create a new chat to get started' 
                                : 'Switch to Private mode and create a chat')
                            : 'Create a new chat to get started'}
                        </p>
                      </div>
                    );
                  }

                  const rowPaddingX = 12; // padding-left of the history header row
                  const iconSize = 18;
                  const gap = 10;
                  const historyTextLeft = rowPaddingX + iconSize + gap; // left position of History text
                  const indent = historyTextLeft - 8; // offset by chat row left padding (8px)
                  const lineLeft = 12 + rowPaddingX - 4; // nudge slightly left under the icon
                  const lineTop = 40; // start just under the icon
                  
                  const { groups, order } = groupChatsByMonth(deduplicatedChats);
                  
                  return (
                      <div style={{ position: 'relative', marginBottom: '24px' }}>
                        <div style={{ margin: '0 0 8px 0' }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            width: '100%', padding: '10px 12px', borderRadius: '10px',
                            border: 'none', background: 'transparent', color: '#111'
                          }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 18, height: 18 }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#111' }}>History</span>
                          </div>
                        </div>
                        <div style={{ position: 'absolute', top: `${lineTop}px`, bottom: 0, left: `${lineLeft}px`, width: '1px', background: '#e5e7eb' }} />
                        <div style={{ marginLeft: `${indent}px` }}>
                          {order.map((label) => (
                            <div key={label} style={{ marginBottom: '0' }}>
                              <div style={{ color: '#111', fontSize: '0.8rem', margin: '4px 0 6px 0', paddingLeft: '8px', fontWeight: 600 }}>{label}</div>
                              {groups[label].map((chat) => (
                                <div
                                  key={chat.id}
                                  onClick={() => openChatAndClearMissed(chat.id)}
                                  onMouseEnter={() => setHoveredChatId(chat.id)}
                                  onMouseLeave={() => setHoveredChatId(null)}
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    gap: '8px', padding: '4px 8px', borderRadius: '10px', cursor: 'pointer',
                                    margin: '2px 0', 
                                    background: selectedChatId === chat.id ? '#e5e7eb' : (hoveredChatId === chat.id ? '#f5f5f5' : 'transparent'),
                                    transition: 'background-color 0.2s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    {editingChatId === chat.id ? (
                                      <form onSubmit={(e) => saveEditedChatTitle(e, chat.id)} onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                                        <input type="text" value={editValue} onChange={handleEditInputChange} onKeyDown={(e) => handleEditKeyDown(e, chat.id)} onBlur={(e) => handleEditBlur(e, chat.id)} autoFocus style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.9rem', background: '#fff' }} />
                                      </form>
                                    ) : (
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem', color: '#111' }} title={chat.title}>{chat.title}</span>
                                    )}

                                    {/* Missed message badge */}
                                    {(() => {
                                      const count = missedMessageCounts[chat.id] || 0;
                                      return count > 0;
                                    })() && (
                                      <span
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Navigation only: do NOT clear missed counts when clicking the badge
                                          window.dispatchEvent(new Event('phraze:openCustomSidebarMessages'));
                                          openChat(chat.id);
                                          window.dispatchEvent(new Event('phraze:showContactsPanel'));
                                        }}
                                        style={{
                                          backgroundColor: '#ef4444',
                                          color: 'white',
                                          borderRadius: '999px',
                                          fontSize: '0.75rem',
                                          fontWeight: '600',
                                          padding: '3px 8px',
                                          height: '18px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          lineHeight: '1',
                                          flexShrink: 0,
                                          cursor: 'pointer',
                                          pointerEvents: 'auto',
                                          zIndex: 2
                                        }}
                                      >
                                        {(() => {
                                          const raw = missedMessageCounts[chat.id] || 0;
                                          const displayCount = raw > 99 ? '99+' : String(raw);
                                          const suffix = raw === 1 ? 'message' : 'messages';
                                          return `${displayCount} ${suffix}`;
                                        })()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="chat-item-menu" style={{ position: 'relative', flexShrink: 0, width: '28px', height: '28px', visibility: (currentUserRole !== 'viewer' && (hoveredChatId === chat.id || menuOpenForChatId === chat.id)) ? 'visible' : 'hidden' }} onClick={(e) => e.stopPropagation()}>
                                    {currentUserRole !== 'viewer' && (
                                      <>
                                        <button onClick={() => setMenuOpenForChatId(menuOpenForChatId === chat.id ? null : chat.id)} style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer' }} aria-label="Chat menu">
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.25"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                                        </button>
                                        {menuOpenForChatId === chat.id && (
                                          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 6px 20px rgba(0,0,0,0.08)', zIndex: 10, minWidth: '160px' }}>
                                            <button onClick={() => { setEditingChatId(chat.id); setEditValue(chat.title); setMenuOpenForChatId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.25"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M14.06 4.94l3.75 3.75"/></svg>
                                              <span>Rename</span>
                                            </button>
                                            <button onClick={(e) => toggleChatPrivacy(e, chat)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
                                              {/* Use isPublic field to determine privacy state, NOT privateUser (which is always set for ownership) */}
                                              {chat.isPublic === false ? (
                                                <>
                                                  {/* Chat is private - show option to make public */}
                                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.25"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                                                  <span>Move to Public</span>
                                                </>
                                              ) : (
                                                <>
                                                  {/* Chat is public (isPublic is true or undefined) - show option to make private */}
                                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.25"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                                  <span>Move to Private</span>
                                                </>
                                              )}
                                            </button>
                                            <button onClick={(e) => { deleteChat(e, chat.id); setMenuOpenForChatId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.25"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 12-2h4a2 2 0 0 12 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                              <span>Delete</span>
                                            </button>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                })()}

                {/* Shared Chats Section */}
                {sharedChats.length > 0 && (() => {
                  // Check if we're in a shared project
                  const isSharedProject = isProjectShared(selectedProject);
                  
                  // Get deduplicatedChats from parent scope (defined in User Chats Section)
                  const filteredChatIds = new Set();
                  chats.filter(chat => {
                    // For private projects, include all chats
                    if (!isSharedProject) {
                      return true;
                    }
                    
                    // For shared projects, respect the public/private toggle
                    if (chatMode === 'public') {
                      return chat.isPublic !== false;
                    } else {
                      return chat.isPublic === false && chat.privateUser && auth.currentUser && chat.privateUser === auth.currentUser.email;
                    }
                  }).forEach(chat => {
                    if (!filteredChatIds.has(chat.id)) {
                      filteredChatIds.add(chat.id);
                    }
                  });
                  
                  // Deduplicate shared chats and exclude those already in filteredChats
                  const uniqueSharedChats = sharedChats.filter(chat => !filteredChatIds.has(chat.id));
                  
                  // Further deduplicate by ID in case of duplicates within sharedChats
                  const sharedChatsMap = new Map();
                  uniqueSharedChats.forEach(chat => {
                    if (!sharedChatsMap.has(chat.id)) {
                      sharedChatsMap.set(chat.id, chat);
                    }
                  });
                  const deduplicatedSharedChats = Array.from(sharedChatsMap.values());
                  
                  if (deduplicatedSharedChats.length === 0) return null;
                  
                  return (
                  <div style={{ position: 'relative' }}>
                    <div style={{ margin: '0 0 8px 0' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                        border: 'none', background: 'transparent', color: '#111'
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2">
                          <circle cx="18" cy="5" r="3"></circle>
                          <circle cx="6" cy="12" r="3"></circle>
                          <circle cx="18" cy="19" r="3"></circle>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#111' }}>Shared</span>
                      </div>
                    </div>
                    <div style={{ paddingLeft: '20px' }}>
                        {deduplicatedSharedChats.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => openChatAndClearMissed(chat.id, true)}
                          onMouseEnter={() => setHoveredChatId(chat.id)}
                          onMouseLeave={() => setHoveredChatId(null)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: '8px', padding: '4px 8px', borderRadius: '10px', cursor: 'pointer',
                            margin: '2px 0', 
                            background: selectedChatId === chat.id ? '#e5e7eb' : (hoveredChatId === chat.id ? '#f5f5f5' : 'transparent'),
                            transition: 'background-color 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem', color: '#111' }} title={chat.title}>{chat.title}</span>
                            
                            {/* Profile pictures for shared people in collapsed view */}
                            {chat.isShared && chat.sharedPeople && Object.keys(chat.sharedPeople).length > 0 && (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '2px',
                                marginLeft: 'auto',
                                flexShrink: 0
                              }}>
                                {Object.keys(chat.sharedPeople).slice(0, 2).map((email, index) => {
                                  const presence = sharedPeoplePresence[email] || 'offline';
                                  return (
                                  <div
                                      key={`${email}-${presence}`}
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '50%',
                                      overflow: 'hidden',
                                      border: '1px solid #E5E7EB',
                                      position: 'relative',
                                      marginLeft: index > 0 ? '-3px' : '0',
                                      zIndex: Object.keys(chat.sharedPeople).length - index
                                    }}
                                      title={`${email} - ${getPresenceLabel(presence)}`}
                                  >
                                    <img
                                      src={sharedPeopleProfilePics[email] || ''}
                                      alt={email}
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'block'
                                      }}
                                      onError={(e) => {
                                        // Hide broken image if no custom avatar is available
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                      {/* Presence Status Indicator */}
                                      <div style={{
                                        position: 'absolute',
                                        bottom: '-2px',
                                        right: '0px',
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        backgroundColor: getPresenceColor(presence),
                                        border: '1.5px solid white',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                      }} title={getPresenceLabel(presence)} />
                                  </div>
                                  );
                                })}
                                {Object.keys(chat.sharedPeople).length > 2 && (
                                  <div
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '50%',
                                      backgroundColor: '#F3F4F6',
                                      border: '1px solid #E5E7EB',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '8px',
                                      color: '#6B7280',
                                      marginLeft: '-3px',
                                      zIndex: 0
                                    }}
                                    title={`+${Object.keys(chat.sharedPeople).length - 2} more`}
                                  >
                                    +{Object.keys(chat.sharedPeople).length - 2}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {currentUserRole !== 'viewer' && (
                            <button 
                              onClick={(e) => removeSharedChat(e, chat.id)} 
                              style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer' }} 
                              title="Remove from list"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })()}

              </>
            )}

            {/* Search results */}
            {searchQuery && (
              <div>
                {searchResults.length > 0 ? (
                  searchResults.map((chat) => (
                    <div key={chat.id} onClick={() => openChatAndClearMissed(chat.id, chat.isShared)} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      gap: '8px', 
                      padding: '10px 12px', 
                      borderRadius: '10px', 
                      cursor: 'pointer', 
                      border: '1px solid #f2f2f2', 
                      background: selectedChatId === chat.id ? '#e5e7eb' : '#fafafa', 
                      margin: '6px 0',
                      transition: 'background-color 0.2s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2">
                          {chat.isShared ? (
                            <>
                              <circle cx="18" cy="5" r="3"></circle>
                              <circle cx="6" cy="12" r="3"></circle>
                              <circle cx="18" cy="19" r="3"></circle>
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </>
                          ) : (
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          )}
                        </svg>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem', color: '#111' }}>{chat.title}</span>
                        
                        {/* Profile pictures for shared people in collapsed view */}
                        {chat.isShared && chat.sharedPeople && Object.keys(chat.sharedPeople).length > 0 && (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '2px',
                            marginLeft: 'auto',
                            flexShrink: 0
                          }}>
                            {Object.keys(chat.sharedPeople).slice(0, 2).map((email, index) => {
                              const presence = sharedPeoplePresence[email] || 'offline';
                              return (
                              <div
                                  key={`${email}-${presence}`}
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  border: '1px solid #E5E7EB',
                                  position: 'relative',
                                  marginLeft: index > 0 ? '-3px' : '0',
                                  zIndex: Object.keys(chat.sharedPeople).length - index
                                }}
                                  title={`${email} - ${getPresenceLabel(presence)}`}
                              >
                                <img
                                  src={sharedPeopleProfilePics[email] || ''}
                                  alt={email}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'block'
                                  }}
                                  onError={(e) => {
                                    // Hide broken image if no custom avatar is available
                                    e.target.style.display = 'none';
                                  }}
                                />
                                  {/* Presence Status Indicator */}
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '-2px',
                                    right: '0px',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: getPresenceColor(presence),
                                    border: '1.5px solid white',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                  }} title={getPresenceLabel(presence)} />
                              </div>
                              );
                            })}
                            {Object.keys(chat.sharedPeople).length > 2 && (
                              <div
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  backgroundColor: '#F3F4F6',
                                  border: '1px solid #E5E7EB',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '8px',
                                  color: '#6B7280',
                                  marginLeft: '-3px',
                                  zIndex: 0
                                }}
                                title={`+${Object.keys(chat.sharedPeople).length - 2} more`}
                              >
                                +{Object.keys(chat.sharedPeople).length - 2}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {currentUserRole !== 'viewer' && (
                        <button onClick={(e) => chat.isShared ? removeSharedChat(e, chat.id) : deleteChat(e, chat.id)} style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer' }} title={chat.isShared ? 'Remove from list' : 'Delete chat'}>
                          {chat.isShared ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          )}
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: '#666', fontSize: '0.9rem' }}>No matching chats found.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* User Section */}
        <SidebarProfileDropdown
          userEmail={companyEmail}
          username={userDisplayName}
          firstName={firstName}
          lastName={lastName}
          isLoggedIn={isLoggedIn}
          profileImage={profileImage}
          isCollapsed={isCollapsed}
          className="profile-smooth-transition"
          rightAddon={!isCollapsed ? (
            <button onClick={handleAnimatedCollapse} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#111', padding: '6px'
            }} aria-label="Collapse sidebar">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#000000">
                <path fill="none" stroke="#000000" strokeWidth="2" d="m12 18l-6-6l6-6m6 12l-6-6l6-6"/>
              </svg>
            </button>
          ) : null}
          onLogout={async () => {
            // Clear local storage
            localStorage.removeItem("currentUser");
            localStorage.removeItem("companyEmail");
            console.log("Removed companyEmail");  
            
            // Clear component state
            setCompanyEmail('');
            setChats([]);
            setSharedChats([]);
            localStorage.removeItem('accessedSharedChats');
            
            // Sign out (AuthContext will handle state updates)
            await auth.signOut();
            
            if (onChatSelect && typeof onChatSelect === 'function') {
              onChatSelect(null);
            }
          }}
        />

        {/* Expand button for collapsed state - positioned below profile */}
        {isCollapsed && (
          <div 
            className="expand-button-smooth"
            style={{
              padding: '0.5rem',
              display: 'flex',
              justifyContent: 'center'
            }}>
            <button
              onClick={handleAnimatedExpand}
              style={{
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                color: '#666666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: '8px'
              }}
              title="Expand sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#000000">
                <path fill="none" stroke="#000000" strokeWidth="2" d="m12 18l6-6l-6-6M6 18l6-6l-6-6"/>
              </svg>
            </button>
          </div>
        )}

        {/* New Project Modal */}
        {showNewProjectModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              width: '480px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827'
                }}>
                  Project name
                </h2>
                <button
                  onClick={() => {
                    setShowNewProjectModal(false);
                    setNewProjectName('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: '4px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '10px',
                  backgroundColor: 'white'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={{ marginRight: '8px' }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Copenhagen Trip"
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      fontSize: '14px',
                      color: '#111827',
                      backgroundColor: 'transparent'
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateNewProject();
                      }
                    }}
                    autoFocus
                  />
                </div>
              </div>

              {/* Category Examples */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap'
                }}>
                  {[
                    { 
                      name: 'Investing', 
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="1" x2="12" y2="23"/>
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                      ), 
                      color: '#10a37f' 
                    },
                    { 
                      name: 'Homework', 
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                      ), 
                      color: '#3b82f6' 
                    },
                    { 
                      name: 'Writing', 
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9"/>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                      ), 
                      color: '#8b5cf6' 
                    },
                    { 
                      name: 'Health', 
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                      ), 
                      color: '#ef4444' 
                    },
                    { 
                      name: 'Travel', 
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                          <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
                          <line x1="12" y1="22.08" x2="12" y2="12"/>
                        </svg>
                      ), 
                      color: '#f59e0b' 
                    }
                  ].map((category) => (
                    <button
                      key={category.name}
                      onClick={() => setNewProjectName(category.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 10px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '16px',
                        backgroundColor: 'white',
                        color: '#374151',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <span style={{ color: category.color, marginTop: '2px' }}>{category.icon}</span>
                      <span>{category.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Informational Text */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px'
                }}>
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={{ marginTop: '2px' }}>
                   <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1z"/>
                   <path d="M12 2C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
                 </svg>
                <p style={{
                  margin: 0,
                  fontSize: '12px',
                  color: '#6b7280',
                  lineHeight: '1.4'
                }}>
                  Projects keep chats, files, and custom instructions in one place. Use them for ongoing work, or just to keep things tidy.
                </p>
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={handleCreateNewProject}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    background: '#374151',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4b5563';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#374151';
                  }}
                >
                  Create project
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Share Modal - Demonstration layout */}
      {showShareModal && (
        <ShareModal
          isOpen={true}
          onClose={() => {
            setShowShareModal(false);
            setShareModalProjectId(null);
          }}
          projectId={shareModalProjectId}
        />
      )}
    </>
    );
  }

  // Default (non-Demonstration) layout remains unchanged below
  return (
    <div style={{
      width: !isInsideExtension ? (isCollapsed ? '60px' : '280px') : (isCollapsed ? '60px' : '100%'),
      height: '100vh',
      background: '#F5F5F5',
      borderRight: '1px solid rgba(0, 0, 0, 0.1)',
      transition: 'all 0.3s ease',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
    }}>
      {/* Control Buttons */}
      {(
        <div style={{
          padding: '1rem',
          display: 'flex',
          flexDirection: isCollapsed ? 'column' : 'row',
          gap: isCollapsed ? '0.5rem' : '1rem',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          alignItems: isCollapsed ? 'center' : 'stretch',
          marginTop: isCollapsed ? '1.5rem' : '0'
        }}>
          <div style={{ marginLeft: '-11.3px' }}>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={{
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                color: '#666666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                ':hover': {
                  color: '#333333'
                }
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#000000" style={{ marginTop: '3px' }}>
                {isCollapsed
                  ? <path fill="none" stroke="#000000" strokeWidth="2" d="m12 18l6-6l-6-6M6 18l6-6l-6-6" />
                  : <path fill="none" stroke="#000000" strokeWidth="2" d="m12 18l-6-6l6-6m6 12l-6-6l6-6" />
                }
              </svg>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: isCollapsed ? 'column' : 'row', gap: isCollapsed ? '0.5rem' : '0.5rem', alignItems: 'center', width: isCollapsed ? '100%' : 'auto', justifyContent: isCollapsed ? 'center' : 'flex-start', marginRight: '-9px' }}>
            <button
              onClick={createNewChat}
              disabled={!isLoggedIn || currentUserRole === 'viewer'}
              style={{
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                color: (!isLoggedIn || currentUserRole === 'viewer') ? '#AAAAAA' : '#666666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (!isLoggedIn || currentUserRole === 'viewer') ? 'not-allowed' : 'pointer',
                opacity: (!isLoggedIn || currentUserRole === 'viewer') ? 0.5 : 1,
                transition: 'all 0.2s',
                ':hover': {
                  color: (!isLoggedIn || currentUserRole === 'viewer') ? '#AAAAAA' : '#333333'
                }
              }}
              title={currentUserRole === 'viewer' ? "View Only Mode: You cannot create new chats. Contact the project owner to request editor access." : "Create a new chat"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M12 18v-6" />
                <path d="M9 15h6" />
              </svg>
            </button>
            <button
              onClick={() => setShowSearchOverlay(true)}
              style={{
                padding: '0.5rem',
                background: isSearching ? '#E0E0E0' : 'none',
                border: 'none',
                color: '#666666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderRadius: '4px',
                ':hover': {
                  color: '#333333',
                  background: '#E0E0E0'
                }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {!isCollapsed && isLibraryVisible &&
        <button
          onClick={
            function () {
              setIsLibraryVisible(false);
            }
          }
          className="nav-link"
          style={{ margin: "15px", marginTop: "0px", cursor: "pointer" }}
        >Chats</button>
      }
      {!isCollapsed && !isLibraryVisible &&
        <button
          onClick={
            function () {
              setIsLibraryVisible(true);
              setIsExtensionSidebarVisible(false);
            }
          }
          className="nav-link"
          style={{ margin: "15px", marginTop: "0px", cursor: "pointer" }}
        >Library</button>
      }

      {/* Project Selection Section */}
      {isLoggedIn && projects.length > 0 && !isCollapsed && (
        <div style={{
          padding: '0 1rem 1rem',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: '600',
            color: '#666',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            padding: '0 0.5rem'
          }}>
            Project
          </div>
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              className="sidebar-project-dropdown"
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(0, 0, 0, 0.10)',
                background: '#fff',
                fontWeight: 500,
                fontSize: '0.95rem',
                color: '#2c3e50',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                outline: 'none',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'box-shadow 0.18s, border-color 0.18s, background 0.18s',
                position: 'relative'
              }}
              onClick={() => {
                // Make dropdown context-aware: determine correct tab based on current project
                // Check if current project is a received shared project (in sharedProjects array)
                const sharedProjectId = localStorage.getItem('sharedProjectId');
                const isReceivedSharedProject = (sharedProjectId && sharedProjectId === selectedProject) ||
                  sharedProjects.some(proj => proj.projectId === selectedProject);
                
                // Set the appropriate tab based on whether it's a shared project
                // Check if project is in sharedProjects array (either owned with members OR received)
                const isInSharedList = sharedProjects.some(proj => proj.projectId === selectedProject);
                
                if (isReceivedSharedProject || isInSharedList) {
                  setProjectTab('shared');
                } else {
                  setProjectTab('private');
                }
                setDropdownOpen((open) => !open);
              }}
              type="button"
            >
              <span style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Icon indicator for project sharing status */}
                {isCurrentProjectShared ? (
                  // Shared project icon (Users/Group icon)
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                ) : (
                  // Private project icon (Lock icon)
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                )}
                {selectedProject === 'default' ? 'Default Project' : selectedProject}
              </span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: '100%',
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.10)',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                zIndex: 100,
                padding: '4px 0',
                marginTop: '2px',
                maxHeight: '220px',
                overflowY: 'auto'
              }}>
                {projects.map((proj) => (
                  <button
                    key={proj}
                    onClick={() => switchToPrivateProject(proj)}
                    style={{
                      width: '100%',
                      background: selectedProject === proj ? '#f0f4fa' : 'transparent',
                      color: selectedProject === proj ? '#1a2533' : '#2c3e50',
                      border: 'none',
                      outline: 'none',
                      padding: '10px 16px',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      textAlign: 'left',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background 0.18s, color 0.18s',
                      margin: '2px 0'
                    }}
                  >
                    {selectedProject === proj && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2533" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {proj === 'default' ? 'Default Project' : proj}
                  </button>
                ))}
                {/* New Project Option */}
                <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }}></div>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setShowNewProjectModal(true);
                  }}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    color: '#374151',
                    border: 'none',
                    outline: 'none',
                    padding: '10px 16px',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    textAlign: 'left',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background 0.18s, color 0.18s',
                    margin: '2px 0'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  New Project
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Input (only visible when searching) */}
      {!isCollapsed && isSearching && (
        <div style={{
          padding: '0 1rem 1rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'white',
            borderRadius: '8px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            padding: '0 0.5rem'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#666666', marginRight: '0.5rem' }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              placeholder="Search chats..."
              style={{
                border: 'none',
                padding: '0.75rem 0.5rem 0.75rem 0',
                outline: 'none',
                width: '100%',
                fontSize: '0.875rem'
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.25rem'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#666666' }}>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chat History */}
      {!isCollapsed && (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {/* Regular Chats Section */}
          {isLoggedIn && chats.length > 0 && !isSearching && (
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#666',
                marginBottom: '0.5rem',
                padding: '0 0.5rem'
              }}>
                YOUR CHATS
              </div>

              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => openChatAndClearMissed(chat.id)}
                  style={{
                    padding: '0.875rem',
                    background: '#EBEBEB',
                    border: '1px solid rgba(0, 0, 0, 0.05)',
                    borderRadius: '0.75rem',
                    color: '#333333',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    marginBottom: '0.5rem',
                    width: '100%'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden', width: '100%' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgba(0, 0, 0, 0.5)', flexShrink: 0 }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {editingChatId === chat.id ? (
                      <form
                        onSubmit={(e) => saveEditedChatTitle(e, chat.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%' }}
                      >
                        <input
                          type="text"
                          value={editValue}
                          onChange={handleEditInputChange}
                          onKeyDown={(e) => handleEditKeyDown(e, chat.id)}
                          onBlur={(e) => handleEditBlur(e, chat.id)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                            background: 'white'
                          }}
                        />
                      </form>
                    ) : (
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'text',
                          fontSize: '0.95rem'
                        }}
                        onClick={(e) => startEditing(e, chat.id, chat.title)}
                        title="Click to edit"
                      >
                        {chat.title}
                      </span>
                    )}
                  </div>
                    {currentUserRole !== 'viewer' && (
                      <button
                        onClick={(e) => deleteChat(e, chat.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#666',
                          opacity: 0.7,
                          cursor: 'pointer',
                          borderRadius: '4px',
                          transition: 'all 0.2s',
                          flexShrink: 0
                        }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                        onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
                        title="Delete chat"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    )}
                </div>
              ))}
            </div>
          )}

          {/* Shared Chats Section */}
          {sharedChats.length > 0 && !isSearching && (
            <div style={{ marginTop: chats.length > 0 ? '1.5rem' : '0' }}>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#666',
                marginBottom: '0.5rem',
                padding: '0 0.5rem'
              }}>
                SHARED CHATS
              </div>

              {sharedChats.map((chat) => {
                console.log('🎯 RENDERING SHARED CHAT:', chat.title || chat.name, 'ID:', chat.id);
                console.log('🎯 CHAT OBJECT:', chat);
                console.log('🎯 CHAT.SHAREDPEOPLE:', chat.sharedPeople);
                console.log('🎯 CHAT.SHAREDPEOPLE TYPE:', typeof chat.sharedPeople);
                console.log('🎯 CHAT.SHAREDPEOPLE KEYS:', chat.sharedPeople ? Object.keys(chat.sharedPeople) : 'NO SHAREDPEOPLE');
                return (
                <div
                  key={chat.id}
                  onClick={() => openChatAndClearMissed(chat.id, true)}
                  style={{
                    padding: '0.875rem',
                    background: selectedChatId === chat.id ? '#d1d5db' : '#EBEBEB',
                    border: '1px solid rgba(0, 0, 0, 0.05)',
                    borderRadius: '0.75rem',
                    color: '#333333',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    marginBottom: '0.5rem',
                    width: '100%'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden', width: '100%' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgba(0, 0, 0, 0.5)', flexShrink: 0 }}>
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {chat.title}
                    </span>
                    
                    {/* Profile pictures for shared people */}
                    {(() => {
                      console.log('🔍 RENDERING CHECK - Chat:', chat.title || chat.name);
                      console.log('🔍 chat.sharedPeople exists:', !!chat.sharedPeople);
                      console.log('🔍 chat.sharedPeople:', chat.sharedPeople);
                      console.log('🔍 Object.keys(chat.sharedPeople).length:', Object.keys(chat.sharedPeople || {}).length);
                      console.log('🔍 sharedPeopleProfilePics:', sharedPeopleProfilePics);
                      
                      // ALWAYS show a test indicator to see if this section is being reached
                      console.log('🧪 TEST: Profile pictures section is being reached for chat:', chat.title || chat.name);
                      
                      // Check if this is a shared chat from sharedChats path or company shared chat
                      let sharedPeopleData = chat.sharedPeople;
                      
                      // If this is a shared chat from sharedChats path, use the fetched sharedPeople data
                      if (chat.isShared && !chat.isSender) {
                        console.log('🔍 MAIN - This is a shared chat from sharedChats path');
                        sharedPeopleData = sharedChatsWithPeople[chat.id] || chat.sharedPeople || {};
                        console.log('🔍 MAIN - Using sharedChatsWithPeople data:', sharedPeopleData);
                      }
                      
                      if (sharedPeopleData && Object.keys(sharedPeopleData).length > 0) {
                        console.log('✅ CONDITION PASSED - Will render profile pictures');
                        const emails = Object.keys(sharedPeopleData);
                        console.log('✅ Emails to render:', emails);
                        emails.forEach(email => {
                          console.log(`✅ Profile pic for ${email}:`, sharedPeopleProfilePics[email] || 'NOT FOUND');
                        });
                        
                        return (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '2px',
                            marginLeft: 'auto',
                            flexShrink: 0
                          }}>
                            {emails.slice(0, 3).map((email, index) => {
                              console.log(`🖼️ RENDERING PROFILE PIC for ${email}, index: ${index}`);
                              const presence = sharedPeoplePresence[email] || 'offline';
                              return (
                                <div
                                  key={`${email}-${presence}`}
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    border: '1px solid #E5E7EB',
                                    position: 'relative',
                                    marginLeft: index > 0 ? '-4px' : '0',
                                    zIndex: emails.length - index
                                  }}
                                  title={`${email} - ${getPresenceLabel(presence)}`}
                                >
                                  <img
                                    src={sharedPeopleProfilePics[email] || ''}
                                    alt={email}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      display: 'block'
                                    }}
                                    onError={(e) => {
                                      console.log(`❌ IMAGE LOAD ERROR for ${email}`);
                                      e.target.style.display = 'none';
                                    }}
                                    onLoad={() => {
                                      console.log(`✅ IMAGE LOADED SUCCESSFULLY for ${email}`);
                                    }}
                                  />
                                  {/* Presence Status Indicator */}
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '-2px',
                                    right: '0px',
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    backgroundColor: getPresenceColor(presence),
                                    border: '2px solid white',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                  }} title={getPresenceLabel(presence)} />
                                </div>
                              );
                            })}
                            {emails.length > 3 && (
                              <div
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  backgroundColor: '#F3F4F6',
                                  border: '1px solid #E5E7EB',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                  color: '#6B7280',
                                  marginLeft: '-4px',
                                  zIndex: 0
                                }}
                                title={`+${emails.length - 3} more`}
                              >
                                +{emails.length - 3}
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        console.log('❌ CONDITION FAILED - Will NOT render profile pictures');
                        console.log('❌ Reason: chat.sharedPeople:', chat.sharedPeople);
                        console.log('❌ Reason: Object.keys length:', Object.keys(chat.sharedPeople || {}).length);
                        
                        // Show a test indicator even when condition fails
                        return (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '2px',
                            marginLeft: 'auto',
                            flexShrink: 0,
                            backgroundColor: 'red',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            color: 'white'
                          }}>
                            NO SHARED PEOPLE
                          </div>
                        );
                      }
                    })()}
                  </div>
                    {currentUserRole !== 'viewer' && (
                      <button
                        onClick={(e) => removeSharedChat(e, chat.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#666',
                          opacity: 0.7,
                          cursor: 'pointer',
                          borderRadius: '4px',
                          transition: 'all 0.2s',
                          flexShrink: 0
                        }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                        onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
                        title="Remove from list"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    )}
                </div>
                );
              })}
            </div>
          )}

          {/* Search Results */}
          {isSearching && searchQuery && (
            <div>
              {searchResults.length > 0 ? (
                searchResults.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => openChatAndClearMissed(chat.id, chat.isShared)}
                    style={{
                      padding: '0.875rem',
                      background: '#EBEBEB',
                      border: '1px solid rgba(0, 0, 0, 0.05)',
                      borderRadius: '0.75rem',
                      color: '#333333',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      marginBottom: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden', width: '100%' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgba(0, 0, 0, 0.5)', flexShrink: 0 }}>
                        {chat.isShared ? (
                          <>
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                          </>
                        ) : (
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        )}
                      </svg>
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {chat.title}
                        {chat.messages && Array.isArray(chat.messages) &&
                          chat.messages.some(message =>
                            message.content && message.content.toLowerCase().includes(searchQuery.toLowerCase())
                          ) && (
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#666',
                              marginTop: '0.25rem',
                              fontStyle: 'italic'
                            }}>
                              {chat.messages.filter(message =>
                                message.content && message.content.toLowerCase().includes(searchQuery.toLowerCase())
                              ).length} matching messages
                            </div>
                          )
                        }
                      </span>
                    </div>
                    {currentUserRole !== 'viewer' && (
                      <button
                        onClick={(e) => chat.isShared ? removeSharedChat(e, chat.id) : deleteChat(e, chat.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#666',
                          opacity: 0.7,
                          cursor: 'pointer',
                          borderRadius: '4px',
                          transition: 'all 0.2s',
                          flexShrink: 0
                        }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                        onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
                        title={chat.isShared ? "Remove from list" : "Delete chat"}
                      >
                        {chat.isShared ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem 0',
                  color: '#666666',
                  fontSize: '0.875rem'
                }}>
                  No matching chats found.
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {(!isLoggedIn || (chats.length === 0 && sharedChats.length === 0)) && !isSearching && (
            <div style={{
              textAlign: 'center',
              padding: '2rem 0',
              color: '#666666',
              fontSize: '0.875rem'
            }}>
              {!isLoggedIn
                ? "Please log in to see your chats."
                : "No chats yet. Click the new chat button to get started."}
            </div>
          )}
        </div>
      )}

      {/* User Section */}
      <SidebarProfileDropdown
        userEmail={companyEmail}
        username={userDisplayName}
        firstName={firstName}
        lastName={lastName}
        isLoggedIn={isLoggedIn}
        profileImage={profileImage}
        onLogout={async () => {
          // Clear local storage
          localStorage.removeItem("currentUser");
          localStorage.removeItem("companyEmail");
          localStorage.removeItem("currentProject");
          localStorage.removeItem("sharedCompanyEmail");
          localStorage.removeItem("sharedProjectId");
          console.log("Removed companyEmail and project context");
          
          // Clear component state
          setCompanyEmail('');
          setChats([]);
          setSharedChats([]);
          
          // Sign out (AuthContext will handle state updates)
          await auth.signOut();
          localStorage.removeItem('accessedSharedChats');
          if (onChatSelect && typeof onChatSelect === 'function') {
            onChatSelect(null); // Clear selected chat
          }
        }}
      />

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '400px',
            maxWidth: '90vw',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827'
              }}>
                Create New Project
              </h2>
              <button
                onClick={() => {
                  setShowNewProjectModal(false);
                  setNewProjectName('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Project Name
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateNewProject();
                  }
                }}
                autoFocus
              />
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowNewProjectModal(false);
                  setNewProjectName('');
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewProject}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#10a37f',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          isOpen={true}
          onClose={() => {
            setShowShareModal(false);
            setShareModalProjectId(null);
          }}
          projectId={shareModalProjectId}
        />
      )}
      </div>
  );
} 
