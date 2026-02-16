import React, { useState, useEffect, useRef } from 'react';
import { database, auth } from '../firebase-init';
import { ref, onValue, off, get, set, update, query, orderByChild, equalTo } from 'firebase/database';
import { getFirebaseData, getMainCompanyEmail } from '../funcs';
import { listenToUserPresenceCanonical, getPresenceColor, getPresenceLabel } from '../utils/presence';
import { listenToContactMissedCounts, clearMissedMessagesForContact } from '../utils/missedMessages';
import {
  FamilyDrawerContent,
  FamilyDrawerRoot,
} from '@/components/ui/family-drawer';

// Helper function to get resolved company email (supports shared projects)
const getResolvedCompanyEmail = async () => {
  // Check for shared project first (when viewing another user's shared project)
  const sharedCompanyEmail = localStorage.getItem("sharedCompanyEmail");
  const sharedProjectId = localStorage.getItem("sharedProjectId");
  const currentProject = localStorage.getItem("currentProject") || 'default';

  // Only use sharedCompanyEmail if the current project matches the stored shared project
  if (sharedCompanyEmail && sharedProjectId && sharedProjectId === currentProject) {
    return sharedCompanyEmail.replace(/\./g, ',');
  }

  // Try local cache for user's own company
  const companyEmail = localStorage.getItem("companyEmail");
  if (companyEmail) {
    return companyEmail.replace(/\./g, ',');
  }

  try {
    // Fallback: map current user email to company in Firebase
    const userEmail = auth.currentUser?.email;
    if (userEmail) {
      const mapped = userEmail.replace(/\./g, ',');
      const emailToCompanyPath = `emailToCompanyDirectory/${mapped}`;
      const companyEmail = await getFirebaseData(emailToCompanyPath);
      if (companyEmail) {
        const mappedCompany = companyEmail.replace(/\./g, ',');
        try { localStorage.setItem("companyEmail", mappedCompany); } catch (_) { }
        return mappedCompany;
      }
    }
  } catch (_) { }

  return null;
};

const Messages = ({ currentProject, currentChat }) => {
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTopic, setCurrentTopic] = useState('general');
  const [topicTitle, setTopicTitle] = useState('General');
  const [selectedContact, setSelectedContact] = useState(null); // Track selected contact for profile view
  const [showProfilePage, setShowProfilePage] = useState(false); // Track if profile page is shown
  const [contactStatuses, setContactStatuses] = useState({}); // Track presence status for each contact
  const [inputValue, setInputValue] = useState(''); // Track input text for adaptive icon behavior
  const [attachedHighlight, setAttachedHighlight] = useState(null); // { text: string, highlightId?: string|null }
  const [composerBlocks, setComposerBlocks] = useState([]); // [{ type: 'text'|'code', text: string }]
  const [composerMode, setComposerMode] = useState('text'); // 'text' | 'code'
  const [showPlusMenu, setShowPlusMenu] = useState(false); // Track if plus menu is open
  const [messages, setMessages] = useState([]); // Store messages for current chat (main messages only)
  const [allMessages, setAllMessages] = useState([]); // Store all messages including thread replies
  const [isLoadingMessages, setIsLoadingMessages] = useState(false); // Loading state for messages
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track initial message load
  const [contactMissedCounts, setContactMissedCounts] = useState({}); // Track missed counts for each contact
  const [missedSinceTs, setMissedSinceTs] = useState(null);
  const [messageSearchTerm, setMessageSearchTerm] = useState(''); // Search term for messages
  const [messageSearchResults, setMessageSearchResults] = useState([]); // Indices of matching messages
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1); // Current highlighted match
  const [showMessageSearch, setShowMessageSearch] = useState(false); // Show/hide message search bar
  const messageSearchRefs = useRef({}); // Refs for scrolling to matched messages
  const messageSearchInputRef = useRef(null); // Ref for message search input
  const plusMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const loadContactsPanelRequestId = useRef(0);
  const profilePicListeners = useRef([]);
  const contactsEmailKeys = useRef(new Set()); // Track which contacts have listeners
  const presenceListeners = useRef({}); // Track presence listeners for cleanup
  const messagesListenerRef = useRef(null); // Track Firebase messages listener for selected chat
  const messagePreviewListeners = useRef({}); // Track message preview listeners for all contacts
  const messagesEndRef = useRef(null); // Ref for auto-scrolling to bottom
  const messagesScrollContainerRef = useRef(null); // Ref for scroll container (preserve scroll on thread nav)
  const currentMessagesPathRef = useRef(''); // Track current messages path
  const composerBoxRef = useRef(null); // Ref for message composer container (for height reset)
  const composerTextareaRef = useRef(null); // Ref for message composer textarea (for height reset)
  const wasComposerFocusedRef = useRef(false);
  const lastAutoClearedMissedRef = useRef(null); // Track last (chatId:contactKey) we auto-cleared
  const activeCtxOpRef = useRef(0); // Guard against stale async publishes
  const lastPublishedActiveCtxKeyRef = useRef(null); // De-dupe non-heartbeat publishes
  const groupAvatarListenersRef = useRef(new Map());
  const groupAvatarListenerMetaRef = useRef(new Map());
  const [hoveredMessageId, setHoveredMessageId] = useState(null); // Track which message is being hovered
  const [editingMessage, setEditingMessage] = useState(null); // Track which message is being edited (stores the full message object)
  const [replyingTo, setReplyingTo] = useState(null); // Track which message is being replied to

  const hoverClearTimeoutRef = useRef(null);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedGroupEmails, setSelectedGroupEmails] = useState(() => new Set());
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [groupMembershipTick, setGroupMembershipTick] = useState(0);
  const [groupAvatarCache, setGroupAvatarCache] = useState({}); // { [emailKey]: { profileImage, firstName, lastName, name } }
  const modalOpRef = useRef(0);

  const renderGroupDrawer = () => {
    const close = () => setShowGroupModal(false);

    const toggleMember = (email) => {
      const normalized = String(email || '').trim();
      if (!normalized) return;
      const me = String(auth.currentUser?.email || '').trim().toLowerCase();
      if (me && normalized.toLowerCase() === me) return;
      setSelectedGroupEmails((prev) => {
        const next = new Set(prev);
        if (next.has(normalized)) next.delete(normalized);
        else next.add(normalized);
        return next;
      });
    };

    const selectedCount = selectedGroupEmails?.size || 0;
    const canCreate = selectedCount >= 1;

    const filtered = (Array.isArray(groupMembers) ? groupMembers : [])
      .filter((m) => {
        const s = String(groupSearch || '').toLowerCase().trim();
        if (!s) return true;
        const name = `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.name || '';
        return name.toLowerCase().includes(s) || String(m.email || '').toLowerCase().includes(s);
      })
      .filter((m) => {
        const me = String(auth.currentUser?.email || '').trim().toLowerCase();
        const email = String(m?.email || '').trim().toLowerCase();
        if (!me || !email) return true;
        return email !== me;
      })
      .sort((a, b) => {
        const isCurrentA = auth.currentUser?.email === a.email;
        const isCurrentB = auth.currentUser?.email === b.email;
        if (isCurrentA && !isCurrentB) return -1;
        if (!isCurrentA && isCurrentB) return 1;
        const emailA = String(a.email || '').toLowerCase();
        const emailB = String(b.email || '').toLowerCase();
        return emailA.localeCompare(emailB);
      });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <header style={{
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: '12px',
          paddingRight: '12px',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0
        }}>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="New Group"
            style={{
              fontSize: '19px',
              fontWeight: 600,
              color: '#111827',
              margin: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              padding: 0,
              flex: 1,
              minWidth: 0,
            }}
          />
          <button onClick={close} aria-label="Close" title="Close" style={{
            width: '36px', height: '36px', borderRadius: '10px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#6b7280',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div style={{ padding: '10px 12px 12px 12px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ marginBottom: '10px', color: '#6b7280', fontSize: '12px' }}>
            {selectedCount} selected
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search members..."
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 10px 10px 36px',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                outline: 'none',
                backgroundColor: '#f3f4f6',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(229, 231, 235, 0.5)',
                boxSizing: 'border-box',
              }}
            />
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                pointerEvents: 'none',
              }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
        </div>

        <div style={{ padding: '10px 6px 10px 6px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {loadingGroup ? (
            <div style={{ padding: '10px 6px', color: '#6b7280', fontSize: '14px' }}>Loading members...</div>
          ) : (!filtered.length ? (
            <div style={{ padding: '18px 12px', color: '#6b7280', fontSize: '14px' }}>No members found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 6px' }}>
              {filtered.map((member) => {
                const isCurrentUser = auth.currentUser?.email === member.email;
                const isSelected = selectedGroupEmails?.has(member.email);
                return (
                  <div
                    key={member.email}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 8px',
                      borderRadius: '10px',
                      backgroundColor: isSelected ? '#f3f4f6' : 'transparent',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onClick={() => toggleMember(member.email)}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {member.profilePic ? (
                        <img src={member.profilePic} alt={member.name} style={{
                          width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e5e7eb', display: 'block'
                        }} onError={(e) => { e.target.style.display = 'none'; const fallback = e.target.nextElementSibling; if (fallback) fallback.style.display = 'flex'; }} />
                      ) : null}
                      <div style={{
                        display: member.profilePic ? 'none' : 'flex', width: '40px', height: '40px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: '600', border: '1px solid #e5e7eb',
                        backgroundColor: `hsl(${String(member.email || 'U').charCodeAt(0) * 10 % 360}, 60%, 70%)`, color: 'white', textTransform: 'uppercase'
                      }}>
                        {(() => {
                          const firstInitial = member.firstName && member.firstName.trim() ? member.firstName.trim()[0].toUpperCase() : '';
                          const lastInitial = member.lastName && member.lastName.trim() ? member.lastName.trim()[0].toUpperCase() : '';
                          if (firstInitial && lastInitial) return firstInitial + lastInitial;
                          if (firstInitial) return firstInitial + firstInitial;
                          const n = String(member.name || '').trim();
                          if (n) return n.charAt(0).toUpperCase();
                          return 'U';
                        })()}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          fontSize: '14px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1
                        }}>
                          {member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.name}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {member.email}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '10px 12px', borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
          <button
            onClick={async () => {
              if (!canCreate) return;
              try {
                const userEmail = auth.currentUser?.email;
                if (!userEmail) {
                  alert('You must be logged in to create a group chat.');
                  return;
                }

                const companyEmail = await getResolvedCompanyEmail();
                if (!companyEmail) {
                  alert('Unable to determine company email');
                  return;
                }

                const topic = String(currentTopic || 'general');

                const name = String(groupName || '').trim() || 'New Group';
                const createdByKey = String(userEmail).replace(/\./g, ',').toLowerCase();

                const selectedEmails = Array.from(selectedGroupEmails || new Set())
                  .map((e) => String(e || '').trim())
                  .filter(Boolean);

                // Always ensure creator is included
                if (!selectedEmails.some((e) => e.toLowerCase() === userEmail.toLowerCase())) {
                  selectedEmails.push(userEmail);
                }

                if (selectedEmails.length < 2) {
                  alert('Select at least 1 other member.');
                  return;
                }

                const members = {};
                selectedEmails.forEach((email) => {
                  const k = String(email).replace(/\./g, ',').toLowerCase();
                  if (k) members[k] = true;
                });

                const groupId = `gc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

                const groupPayload = {
                  name,
                  createdAt: { '.sv': 'timestamp' },
                  updatedAt: { '.sv': 'timestamp' },
                  createdBy: createdByKey,
                  members,
                  lastMessage: null,
                };

                // Only create the group record from the client.
                // Membership fan-out is handled by Cloud Functions (topicGroupChatMembership is client read-only).
                await set(
                  ref(database, `Companies/${companyEmail}/topicGroupChats/${topic}/${groupId}`),
                  groupPayload
                );
                close();
              } catch (e) {
                console.error('Failed to create group chat:', e);
                alert('Failed to create group chat.');
              }
            }}
            disabled={!canCreate}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #e5e7eb',
              backgroundColor: canCreate ? '#f9fafb' : '#f3f4f6',
              color: canCreate ? '#111827' : '#9ca3af',
              cursor: canCreate ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              if (!canCreate) return;
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              if (!canCreate) return;
              e.currentTarget.style.backgroundColor = '#f9fafb';
            }}
          >
            Create group chat
          </button>
        </div>
      </div>
    );
  };

  const [activeThread, setActiveThread] = useState(null); // { threadId, parentMessageId }
  const [threadMetas, setThreadMetas] = useState({}); // { [threadId]: { parentMessageId, createdAt, createdByEmail } }
  const threadMetaListenerRef = useRef(null);
  const mainScrollTopRef = useRef(0);
  const mainDraftRef = useRef('');
  const threadDraftRef = useRef('');

  const [reschedulingScheduledMessage, setReschedulingScheduledMessage] = useState(null); // { scheduledId, scheduled }

  const QUICK_REACTIONS = ['👍', '❤️', '😀'];

  const blocksToPlainText = (blocks) => {
    try {
      if (!Array.isArray(blocks)) return '';
      return blocks
        .map((b) => {
          if (!b || typeof b !== 'object') return '';
          const t = String(b.text || '');
          return t;
        })
        .join('\n')
        .trim();
    } catch (_) {
      return '';
    }
  };

  const getMessageBlocks = (message) => {
    if (!message) return null;
    if (Array.isArray(message.blocks) && message.blocks.length > 0) {
      return message.blocks
        .filter((b) => b && typeof b === 'object')
        .map((b) => ({ type: b.type === 'code' ? 'code' : 'text', text: String(b.text || '') }));
    }
    return null;
  };

  const commitComposerBlock = (mode, text) => {
    const normalized = String(text || '');
    if (!normalized) return;
    setComposerBlocks((prev) => [...(Array.isArray(prev) ? prev : []), { type: mode === 'code' ? 'code' : 'text', text: normalized }]);
  };

  const toggleComposerMode = (nextMode) => {
    const mode = nextMode === 'code' ? 'code' : 'text';
    if (mode === composerMode) return;
    commitComposerBlock(composerMode, inputValue);
    setInputValue('');
    setComposerMode(mode);
  };

  const cancelHoverClear = () => {
    try {
      if (hoverClearTimeoutRef.current) {
        clearTimeout(hoverClearTimeoutRef.current);
        hoverClearTimeoutRef.current = null;
      }
    } catch (_) { }
  };

  const scheduleHoverClear = () => {
    cancelHoverClear();
    hoverClearTimeoutRef.current = setTimeout(() => {
      setHoveredMessageId(null);
      hoverClearTimeoutRef.current = null;
    }, 120);
  };

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleValidationMessage, setScheduleValidationMessage] = useState('');
  const [scheduledDrafts, setScheduledDrafts] = useState([]);
  const scheduleIntervalRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getContactDisplayName = (contact) => {
    if (!contact) return '';
    const first = (contact.firstName || '').trim();
    const last = (contact.lastName || '').trim();
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    if (contact.name && String(contact.name).trim()) return String(contact.name).trim();
    if (contact.email && String(contact.email).trim()) return String(contact.email).trim();
    return '';
  };

  const openDataUrlInNewTab = (dataUrl) => {
    if (!dataUrl) return;
    try {
      const arr = String(dataUrl).split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const bstr = atob(arr[1] || '');
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (_) {
      window.open(dataUrl, '_blank');
    }
  };

  const getMessageBasePathForActiveContact = async () => {
    if (!selectedContact || !currentProject || !currentTopic) return null;
    const companyEmail = await getResolvedCompanyEmail();
    if (!companyEmail) return null;

    if (selectedContact.isGroupChat && selectedContact.groupId) {
      return {
        companyEmail,
        emailPair: null,
        basePath: `Companies/${companyEmail}/topicGroupChatMessages/${currentTopic}/${selectedContact.groupId}`
      };
    }

    const contactEmail = selectedContact.isEveryone ? 'everyone' : (selectedContact.email || selectedContact.emailKey?.replace(/,/g, '.'));
    if (!contactEmail) return null;

    const emailPair = await getEmailPair(contactEmail);
    if (!emailPair) return null;

    return {
      companyEmail,
      emailPair,
      basePath: emailPair === 'everyone'
        ? `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`
        : `privateMessages/${emailPair}/${companyEmail}/${currentProject}/${currentTopic}`
    };
  };

  const toggleReaction = async (message, emoji) => {
    if (!message || !emoji) return;

    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      alert('You must be logged in to react to messages');
      return;
    }

    try {
      const ctx = await getMessageBasePathForActiveContact();
      if (!ctx?.basePath) return;

      const messageId = String(message.messageId);
      if (!messageId) return;

      const userKey = userEmail.replace(/\./g, ',');
      const existing = Boolean(message.reactions && message.reactions[emoji] && message.reactions[emoji][userKey]);

      const reactionPath = `${ctx.basePath}/${messageId}/reactions/${emoji}/${userKey}`;
      await update(ref(database, ctx.basePath), {
        [`${messageId}/reactions/${emoji}/${userKey}`]: existing ? null : true
      });
    } catch (e) {
      console.error('Error toggling reaction:', e);
    }
  };

  const getScheduleStorageKey = async () => {
    const userEmail = auth.currentUser?.email;
    const companyEmail = await getResolvedCompanyEmail();
    return `phraze:scheduleDrafts:${companyEmail || 'unknown'}:${userEmail || 'unknown'}`;
  };

  const loadScheduledDrafts = async () => {
    try {
      const key = await getScheduleStorageKey();
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  };

  const persistScheduledDrafts = async (drafts) => {
    try {
      const key = await getScheduleStorageKey();
      localStorage.setItem(key, JSON.stringify(drafts || []));
    } catch (_) {
      // Best-effort
    }
  };

  const getScheduleTargetContext = async () => {
    const companyEmail = await getResolvedCompanyEmail();
    const contactEmail = selectedContact?.isEveryone
      ? 'everyone'
      : (selectedContact?.email || selectedContact?.emailKey?.replace(/,/g, '.'));
    const emailPair = contactEmail ? await getEmailPair(contactEmail) : null;
    return {
      companyEmail,
      projectId: currentProject || null,
      topic: currentTopic || null,
      contactEmail,
      emailPair,
    };
  };

  const openScheduleModalWithDefaults = async () => {
    if (!selectedContact) {
      alert('Please select a contact to chat with first.');
      return;
    }
    if (!inputValue.trim()) {
      alert('Please enter a message to schedule.');
      return;
    }

    const now = new Date();
    const defaultTime = new Date(now.getTime() + 60 * 60 * 1000);
    setScheduleDate(defaultTime.toISOString().split('T')[0]);
    setScheduleTime(defaultTime.toTimeString().slice(0, 5));
    setScheduleValidationMessage('');
    setShowScheduleModal(true);
  };

  const openRescheduleModal = (scheduledId, scheduled) => {
    if (!scheduledId || !scheduled?.scheduledAt) return;
    try {
      const d = new Date(Number(scheduled.scheduledAt));
      setReschedulingScheduledMessage({ scheduledId, scheduled });
      setScheduleDate(d.toISOString().split('T')[0]);
      setScheduleTime(d.toTimeString().slice(0, 5));
      setScheduleValidationMessage('');
      setShowScheduleModal(true);
    } catch (_) {
      // Best-effort
    }
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setScheduleValidationMessage('');
  };

  const validateScheduleTime = (nextDate = scheduleDate, nextTime = scheduleTime) => {
    if (!nextDate || !nextTime) {
      setScheduleValidationMessage('');
      return { ok: true, scheduledAt: null };
    }
    const scheduledDateTime = new Date(`${nextDate}T${nextTime}`);
    const now = new Date();
    if (scheduledDateTime <= now) {
      setScheduleValidationMessage('Please select a future date and time.');
      return { ok: false, scheduledAt: scheduledDateTime.getTime() };
    }
    setScheduleValidationMessage('');
    return { ok: true, scheduledAt: scheduledDateTime.getTime() };
  };

  const formatScheduledForLabel = (ms) => {
    if (!ms || Number.isNaN(Number(ms))) return '';
    try {
      const d = new Date(Number(ms));
      const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      return `Scheduled for ${date} at ${time}`;
    } catch (_) {
      return '';
    }
  };

  const sendScheduledDraftNow = async (draft) => {
    const timestamp = Date.now();
    const userEmail = auth.currentUser?.email;
    if (!userEmail) throw new Error('Not logged in');

    let userName = userEmail.split('@')[0];
    try {
      const companyEmail = await getResolvedCompanyEmail();
      if (companyEmail) {
        const userEmailFormatted = userEmail.replace(/\./g, ',');
        const userData = await getFirebaseData(`Companies/${companyEmail}/users/${userEmailFormatted}`);
        if (userData?.name) userName = userData.name;
        else if (userData?.firstName && userData?.lastName) userName = `${userData.firstName} ${userData.lastName}`;
      }
    } catch (_) {
      // Best-effort
    }

    const message = {
      text: String(draft.text || ''),
      email: userEmail,
      name: userName,
      timestamp: new Date(timestamp).toISOString(),
      messageId: String(timestamp),
      reactions: {},
      editedAt: null,
      isScheduled: false,
      replyTo: null,
      scheduledMeta: {
        scheduledId: draft.id,
        scheduledAt: draft.scheduledAt || null,
      },
    };

    let messagePath;
    if (String(draft.emailPair) === 'everyone') {
      messagePath = `Companies/${draft.companyEmail}/securedProjects/${draft.projectId}/messages/${draft.topic}/${draft.emailPair}/${timestamp}`;
    } else {
      const ownerCompany = draft.ownerCompany || draft.companyEmail;
      messagePath = `privateMessages/${draft.emailPair}/${ownerCompany}/${draft.projectId}/${draft.topic}/${timestamp}`;
    }

    await set(ref(database, messagePath), message);
  };

  const processDueScheduledDrafts = async (forceContextMatch = false) => {
    const now = Date.now();
    const drafts = await loadScheduledDrafts();
    if (!drafts.length) return;

    const ctx = await getScheduleTargetContext();

    const updated = [...drafts];
    for (let i = 0; i < updated.length; i += 1) {
      const d = updated[i];
      if (!d || d.status !== 'scheduled') continue;
      const scheduledAt = Number(d.scheduledAt || 0);
      if (!scheduledAt || scheduledAt > now) continue;

      const contextMatches = Boolean(
        ctx.companyEmail &&
        ctx.projectId &&
        ctx.topic &&
        ctx.emailPair &&
        d.companyEmail === ctx.companyEmail &&
        d.projectId === ctx.projectId &&
        d.topic === ctx.topic &&
        d.emailPair === ctx.emailPair
      );

      if (forceContextMatch && !contextMatches) {
        continue;
      }

      try {
        updated[i] = { ...d, status: 'sending' };
        await persistScheduledDrafts(updated);
        setScheduledDrafts(updated);

        await sendScheduledDraftNow(updated[i]);

        updated[i] = { ...updated[i], status: 'sent', sentAt: Date.now() };
        await persistScheduledDrafts(updated);
        setScheduledDrafts(updated);
      } catch (e) {
        updated[i] = {
          ...updated[i],
          status: 'failed',
          error: String(e && e.message ? e.message : e),
          failedAt: Date.now(),
        };
        await persistScheduledDrafts(updated);
        setScheduledDrafts(updated);
      }
    }
  };

  const handleConfirmSchedule = async () => {
    const { ok, scheduledAt } = validateScheduleTime();
    if (!ok || !scheduledAt) return;

    const ctx = await getScheduleTargetContext();
    if (!ctx.companyEmail || !ctx.projectId || !ctx.topic || !ctx.emailPair) {
      setScheduleValidationMessage('Unable to determine chat context.');
      return;
    }

    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      setScheduleValidationMessage('You must be logged in.');
      return;
    }

    let userName = userEmail.split('@')[0];
    try {
      const companyEmail = await getResolvedCompanyEmail();
      if (companyEmail) {
        const userEmailFormatted = userEmail.replace(/\./g, ',');
        const userData = await getFirebaseData(`Companies/${companyEmail}/users/${userEmailFormatted}`);
        if (userData?.name) userName = userData.name;
        else if (userData?.firstName && userData?.lastName) userName = `${userData.firstName} ${userData.lastName}`;
      }
    } catch (_) {
      // Best-effort
    }

    const baseEmailKey = userEmail.replace(/\./g, ',');
    const targetScheduledId = reschedulingScheduledMessage?.scheduledId
      ? reschedulingScheduledMessage.scheduledId
      : `${baseEmailKey}-${Date.now()}`;

    const scheduledMessage = reschedulingScheduledMessage?.scheduled
      ? {
        ...reschedulingScheduledMessage.scheduled,
        scheduledAt,
        // preserve createdAt (for immediate placement), fall back if missing
        createdAt: reschedulingScheduledMessage.scheduled.createdAt || Date.now(),
        // keep auth-owned fields consistent
        createdByEmail: userEmail,
        email: userEmail,
        name: userName,
        projectId: ctx.projectId,
        topic: ctx.topic,
        emailPair: ctx.emailPair,
        ownerCompany: ctx.companyEmail,
        isScheduled: true,
      }
      : {
        text: inputValue,
        email: userEmail,
        name: userName,
        scheduledAt,
        createdAt: Date.now(),
        createdByEmail: userEmail,
        projectId: ctx.projectId,
        topic: ctx.topic,
        emailPair: ctx.emailPair,
        ownerCompany: ctx.companyEmail,
        isScheduled: true,
        replyTo: replyingTo ? { messageId: replyingTo.messageId, text: replyingTo.text, name: replyingTo.name, email: replyingTo.email } : null,
      };

    try {
      await set(ref(database, `scheduledMessages/${targetScheduledId}`), scheduledMessage);
      if (!reschedulingScheduledMessage) {
        setInputValue('');
      }
      setScheduleValidationMessage(`Message scheduled for ${new Date(scheduledAt).toLocaleString()}`);
      setReplyingTo(null);
      setReschedulingScheduledMessage(null);
      setTimeout(() => {
        closeScheduleModal();
      }, 1500);
    } catch (err) {
      console.error('Failed to schedule message:', err);
      setScheduleValidationMessage('Failed to schedule message. Please try again.');
    }
  };

  useEffect(() => {
    const init = async () => {
      const drafts = await loadScheduledDrafts();
      setScheduledDrafts(drafts);
    };
    init();
  }, []);

  useEffect(() => {
    if (scheduleIntervalRef.current) {
      clearInterval(scheduleIntervalRef.current);
      scheduleIntervalRef.current = null;
    }

    scheduleIntervalRef.current = setInterval(() => {
      processDueScheduledDrafts(false);
    }, 30000);

    processDueScheduledDrafts(false);

    return () => {
      if (scheduleIntervalRef.current) {
        clearInterval(scheduleIntervalRef.current);
        scheduleIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject, currentTopic, selectedContact]);

  useEffect(() => {
    processDueScheduledDrafts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProfilePage]);

  useEffect(() => {
    const openHandler = () => setShowGroupModal(true);
    window.addEventListener('phraze:createGroupChat', openHandler);
    return () => window.removeEventListener('phraze:createGroupChat', openHandler);
  }, []);

  useEffect(() => {
    if (!showGroupModal) return;

    modalOpRef.current += 1;
    const opId = modalOpRef.current;

    setGroupSearch('');
    setGroupName('');
    setSelectedGroupEmails(new Set());
    setLoadingGroup(true);

    let unsub = null;
    const cleanup = () => { try { if (unsub) unsub(); } catch (_) { } };

    const load = async () => {
      try {
        const companyEmail = await getResolvedCompanyEmail();
        const projectName = currentProject || (localStorage.getItem('currentProject') || 'default');
        if (!companyEmail) {
          setGroupMembers([]);
          setLoadingGroup(false);
          return;
        }

        const membersPath = `Companies/${companyEmail}/projects/${projectName}/members`;
        const membersRef = ref(database, membersPath);

        const handle = async (snap) => {
          if (modalOpRef.current !== opId) return;
          const data = snap.val();
          if (!data) {
            setGroupMembers([]);
            setLoadingGroup(false);
            return;
          }

          const enriched = await Promise.all(
            Object.keys(data).map(async (emailKey) => {
              const email = emailKey.replace(/,/g, '.');
              const memberInfo = data[emailKey] || {};
              let profilePic = null;
              let userName = email.split('@')[0];
              let firstName = null;
              let lastName = null;
              let userCompanyEmail = companyEmail;

              try {
                userCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${emailKey}`) || companyEmail;
                const [pic, userData] = await Promise.all([
                  getFirebaseData(`Companies/${userCompanyEmail}/users/${emailKey}/profileImage`).catch(() => null),
                  getFirebaseData(`Companies/${userCompanyEmail}/users/${emailKey}`).catch(() => null)
                ]);
                if (pic) profilePic = pic;
                if (userData) {
                  firstName = userData.firstName || null;
                  lastName = userData.lastName || null;
                  userName = userData.name || (firstName && lastName ? `${firstName} ${lastName}` : firstName || email.split('@')[0]);
                }
              } catch (_) { }

              return {
                email,
                name: userName,
                firstName,
                lastName,
                role: memberInfo.role || 'member',
                profilePic,
                userCompanyEmail
              };
            })
          );

          setGroupMembers(enriched);
          setLoadingGroup(false);
        };

        unsub = onValue(membersRef, handle);
      } catch (_) {
        setGroupMembers([]);
        setLoadingGroup(false);
      }
    };

    load();
    return () => cleanup();
  }, [showGroupModal, currentProject]);

  const sendAttachmentFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    // Do not change how normal text sending works; attachments are sent as standalone messages.
    if (!selectedContact || !currentProject || !currentTopic) {
      alert('Open a conversation before attaching a file.');
      return;
    }

    if (selectedContact.isGroupChat) {
      alert('File attachments are not supported in group chats yet.');
      return;
    }

    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      alert('You must be logged in to send files');
      return;
    }

    let userName = userEmail.split('@')[0];
    try {
      const companyEmail = await getResolvedCompanyEmail();
      if (companyEmail) {
        const userEmailFormatted = userEmail.replace(/\./g, ',');
        const userData = await getFirebaseData(`Companies/${companyEmail}/users/${userEmailFormatted}`);
        if (userData && userData.name) {
          userName = userData.name;
        } else if (userData && userData.firstName && userData.lastName) {
          userName = `${userData.firstName} ${userData.lastName}`;
        }
      }
    } catch (_) {
      // Best-effort
    }

    const companyEmail = await getResolvedCompanyEmail();
    if (!companyEmail) {
      alert('Unable to determine company email');
      return;
    }

    const contactEmail = selectedContact.isEveryone ? 'everyone' : (selectedContact.email || selectedContact.emailKey?.replace(/,/g, '.'));
    if (!contactEmail) {
      alert('Unable to determine contact email');
      return;
    }

    const emailPair = await getEmailPair(contactEmail);
    if (!emailPair) {
      alert('Failed to create email pair');
      return;
    }

    // Membership check (same as text send)
    const userEmailFormatted = userEmail.replace(/\./g, ',');
    const membershipPath = `Companies/${companyEmail}/projects/${currentProject}/members/${userEmailFormatted}`;
    const membershipRef = ref(database, membershipPath);
    const membershipSnapshot = await get(membershipRef);
    if (!membershipSnapshot.exists()) {
      alert('You must be a project member to send files.');
      return;
    }

    const readAsDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('File read failed'));
      reader.readAsDataURL(file);
    });

    for (const file of files) {
      const dataUrl = await readAsDataUrl(file);
      const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const extension = String(file.name || '').includes('.')
        ? String(file.name).split('.').pop().toUpperCase()
        : 'FILE';

      // Save doc data (mirrors extension approach)
      const docPath = `Companies/${companyEmail}/securedProjects/${currentProject}/documents/${currentTopic}/${emailPair}/${docId}`;
      await set(ref(database, docPath), {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        extension,
        dataUrl,
        timestamp: Date.now(),
        uploadedBy: userEmailFormatted
      });

      // Post a standalone message that references the document
      const timestamp = Date.now();
      const message = {
        text: '',
        email: userEmail,
        name: userName,
        timestamp: new Date(timestamp).toISOString(),
        messageId: timestamp.toString(),
        reactions: {},
        editedAt: null,
        isScheduled: false,
        replyTo: null,
        attachment: {
          type: 'document',
          docId,
          name: file.name,
          extension,
          size: file.size,
          mime: file.type || 'application/octet-stream'
        }
      };

      const messagesPath = emailPair === 'everyone'
        ? `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}/${timestamp}`
        : `privateMessages/${emailPair}/${companyEmail}/${currentProject}/${currentTopic}/${timestamp}`;
      await set(ref(database, messagesPath), message);
    }
  };

  const getContactMissedCount = (contact) => {
    if (!contact) return 0;
    if (contact.isEveryone || contact.email === 'everyone') {
      return contactMissedCounts['everyone'] || 0;
    }
    const key = (contact.email || '').replace(/\./g, ',').toLowerCase();
    return contactMissedCounts[key] || 0;
  };

  const getActiveContactEmail = () => {
    if (!showProfilePage || !selectedContact) return null;
    if (selectedContact.isEveryone) return 'everyone';
    return selectedContact.email || selectedContact.emailKey?.replace(/,/g, '.');
  };

  useEffect(() => {
    activeCtxOpRef.current += 1;
    const opId = activeCtxOpRef.current;

    // Expose what the user is actively viewing so global listeners can avoid counting
    // messages as "missed" when the conversation is already open.
    const chatId = currentChat?.id || null;
    const projectId = currentProject || null;
    const contactEmail = getActiveContactEmail();

    // Also publish to Firebase so server-side listeners (Cloud Functions) can suppress
    // missed-count increments while this exact conversation is open.
    const publish = async (forceClear = false, forceWrite = false) => {
      try {
        if (activeCtxOpRef.current !== opId) return;
        const userEmail = auth.currentUser?.email;
        if (!userEmail) return;
        const userKey = userEmail.replace(/\./g, ',').toLowerCase();
        const ctxRef = ref(database, `activeMessagingContext/${userKey}`);

        const shouldPublish = Boolean(!forceClear && chatId && contactEmail);

        // Avoid redundant writes on state transitions (heartbeat uses forceWrite=true)
        const contactKey = shouldPublish
          ? String(contactEmail).replace(/\./g, ',').toLowerCase()
          : null;
        const nextKey = shouldPublish
          ? `${projectId || ''}|${chatId}|${contactKey}`
          : '__cleared__';
        if (!forceWrite && lastPublishedActiveCtxKeyRef.current === nextKey) return;
        lastPublishedActiveCtxKeyRef.current = nextKey;

        if (shouldPublish) {
          await set(ctxRef, {
            projectId: projectId || null,
            chatId,
            contactKey,
            updatedAt: Date.now()
          });
        } else {
          await set(ctxRef, null);
        }
      } catch (_) {
        // Best-effort only
      }
    };

    let heartbeatInterval = null;

    const syncContext = async () => {
      if (activeCtxOpRef.current !== opId) return;
      const visible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      const shouldSuppress = Boolean(chatId && contactEmail && visible);

      window.__phrazeActiveMessagingContext = {
        projectId,
        chatId,
        contactEmail,
        isConversationOpen: shouldSuppress
      };

      if (shouldSuppress) {
        await publish(false);
        if (!heartbeatInterval) {
          heartbeatInterval = setInterval(() => {
            publish(false, true);
          }, 30000);
        }
      } else {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        await publish(true);
      }
    };

    const onVisibilityChange = () => {
      syncContext();
    };

    syncContext();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    const onPageHide = () => {
      publish(true);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', onPageHide);
      window.addEventListener('beforeunload', onPageHide);
    }

    return () => {
      // Prevent stale async publishes from this effect instance.
      activeCtxOpRef.current += 1;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onPageHide);
        window.removeEventListener('beforeunload', onPageHide);
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      // Best-effort Firebase cleanup (must not depend on opId guard)
      try {
        const userEmail = auth.currentUser?.email;
        if (userEmail) {
          const userKey = userEmail.replace(/\./g, ',').toLowerCase();
          const ctxRef = ref(database, `activeMessagingContext/${userKey}`);
          set(ctxRef, null);
        }
      } catch (_) {
        // Best-effort only
      }

      // Best-effort cleanup
      if (window.__phrazeActiveMessagingContext?.chatId === chatId) {
        window.__phrazeActiveMessagingContext = { projectId: null, chatId: null, contactEmail: null, isConversationOpen: false };
      }
    };
  }, [currentProject, currentChat?.id, showProfilePage, selectedContact]);

  // If the user is actively viewing a specific conversation (visible),
  // ensure we clear any lingering missed counts for that contact so badges don't
  // remain while the user is reading the thread.
  useEffect(() => {
    const chatId = currentChat?.id || null;
    const contactEmail = getActiveContactEmail();

    const visible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    const isActivelyViewing = Boolean(chatId && contactEmail && visible);

    if (!isActivelyViewing) return;

    const contactKey = String(contactEmail).replace(/\./g, ',').toLowerCase();
    const dedupeKey = `${chatId}:${contactKey}`;
    if (lastAutoClearedMissedRef.current === dedupeKey) return;
    lastAutoClearedMissedRef.current = dedupeKey;

    clearMissedMessagesForContact(chatId, contactEmail);
  }, [currentChat?.id, showProfilePage, selectedContact]);

  const resetComposerLayout = () => {
    const box = composerBoxRef.current;
    const ta = composerTextareaRef.current;

    const isCode = composerMode === 'code';

    if (ta) {
      // Back to default feel
      ta.style.height = '24px';
      ta.style.overflowY = 'hidden';
      ta.scrollTop = 0;
    }
    if (box) {
      // Clear any imperative overrides; composer sizing is controlled via React styles.
      box.style.height = '';
      box.style.maxHeight = '';
    }
  };

  // Whenever input is cleared (send/cancel/edit/etc), revert composer to single-line height.
  useEffect(() => {
    if (!inputValue.trim()) {
      resetComposerLayout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, composerMode]);

  useEffect(() => {
    const handler = () => {
      setShowProfilePage(false);
      setSelectedContact(null);
    };

    window.addEventListener('phraze:showContactsPanel', handler);
    return () => window.removeEventListener('phraze:showContactsPanel', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      try {
        const text = e?.detail?.text ? String(e.detail.text) : '';
        const highlightId = e?.detail?.highlightId || null;
        if (!text.trim()) return;

        setAttachedHighlight({ text: text.trim(), highlightId });

        // Avoid forcing focus (blinking cursor) when the intent is just to attach.
        // Only keep focus if the user was already typing in the composer.
        if (!wasComposerFocusedRef.current) {
          try {
            requestAnimationFrame(() => composerTextareaRef.current?.blur());
          } catch (_) { }
        }
      } catch (_) { }
    };

    window.addEventListener('phraze:attachHighlightToMessaging', handler);
    return () => window.removeEventListener('phraze:attachHighlightToMessaging', handler);
  }, []);

  // When editing starts, properly size the textarea to fit the message (with max limits)
  useEffect(() => {
    if (editingMessage && composerTextareaRef.current && composerBoxRef.current) {
      const textarea = composerTextareaRef.current;
      const container = composerBoxRef.current;

      // Reset height to auto to get accurate scrollHeight
      textarea.style.height = 'auto';

      const maxTextareaHeight = 128;
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(scrollHeight, maxTextareaHeight);
      textarea.style.height = `${newHeight}px`;

      // Keep the composer container height stable; only resize the textarea.
      // Long previews (reply/attached highlight) scroll within their own area.
      try {
        container.style.height = '';
      } catch (_) { }

      // Enable scrolling if content exceeds max
      if (scrollHeight > maxTextareaHeight) {
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.overflowY = 'hidden';
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMessage]);

  // Format time helper (similar to extension)
  const formatTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const messageDate = new Date(date);

    if (messageDate.toDateString() === now.toDateString()) {
      return messageDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday ' + messageDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else {
      return messageDate.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
      }) + ' ' + messageDate.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  };

  // Format timestamp for reply preview (e.g., "12/19/2025 11:28 PM")
  const formatReplyTimestamp = (date) => {
    if (!date) return '';
    const messageDate = new Date(date);
    return messageDate.toLocaleDateString([], {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }) + ' ' + messageDate.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Format date for separator (e.g., "Today", "Yesterday", "Monday, January 15")
  const formatDateSeparator = (date) => {
    if (!date) return '';
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const messageDate = new Date(date);

    if (messageDate.toDateString() === now.toDateString()) {
      return 'Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      // Check if it's within the last week
      const daysDiff = Math.floor((now - messageDate) / (1000 * 60 * 60 * 24));
      if (daysDiff < 7) {
        return messageDate.toLocaleDateString([], { weekday: 'long' });
      } else {
        return messageDate.toLocaleDateString([], {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
      }
    }
  };

  // Check if two dates are on different days
  const isDifferentDay = (date1, date2) => {
    if (!date1 || !date2) return true;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.toDateString() !== d2.toDateString();
  };

  // Highlight search term in text
  const highlightText = (text, searchTerm, isActive = false) => {
    if (!searchTerm || !text) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} style={{
          backgroundColor: isActive ? '#FFD700' : '#FFEB3B', // Darker yellow for active match
          color: '#000000',
          padding: '2px 0',
          borderRadius: '2px',
          fontWeight: 500
        }}>
          {part}
        </mark>
      ) : part
    );
  };

  // Extract message preview helper with sender prefix (Slack-style)
  const extractMessagePreview = (message, contact) => {
    if (!message) return null;

    const messageBlocks = getMessageBlocks(message);
    const previewSourceText = messageBlocks ? blocksToPlainText(messageBlocks) : (message.text ? String(message.text) : '');
    if (!previewSourceText) return null;

    const userEmail = auth.currentUser?.email;
    const isCurrentUser = message.email === userEmail;

    // Get sender name
    let senderName = 'You';
    if (!isCurrentUser) {
      // Try to get sender name from message or contact
      if (message.name) {
        // Extract first name from full name
        const nameParts = message.name.split(' ');
        senderName = nameParts[0] || message.name;
      } else if (contact && contact.name) {
        const nameParts = contact.name.split(' ');
        senderName = nameParts[0] || contact.name;
      } else {
        senderName = message.email?.split('@')[0] || 'Unknown';
      }
    }

    // Process message text
    let text = previewSourceText;
    // Remove HTML tags if any
    const plainText = text.replace(/<[^>]*>/g, '');
    // Remove line breaks and normalize whitespace
    const normalizedText = plainText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Return object with sender and text
    return {
      sender: senderName,
      text: normalizedText,
      isCurrentUser
    };
  };

  const getMessageSenderDisplayName = (message) => {
    if (!message) return '';
    if (message.name && String(message.name).trim()) return String(message.name).trim();
    const email = message.email;
    if (email) {
      const match = contacts.find((c) => c && !c.isEveryone && String(c.email).toLowerCase() === String(email).toLowerCase());
      if (match) return getContactDisplayName(match);
      return String(email).split('@')[0] || '';
    }
    return '';
  };

  const getMessageSenderProfileImage = (message) => {
    if (!message) return null;
    if (message.profileImage && String(message.profileImage).trim()) return String(message.profileImage).trim();
    const email = message.email;
    if (!email) return null;

    const normalizedEmail = String(email).toLowerCase();
    const normalizedCurrentUserEmail = String(auth.currentUser?.email || '').toLowerCase();

    const match = contacts.find((c) => c && !c.isEveryone && String(c.email).toLowerCase() === normalizedEmail);
    if (match?.profileImage) return match.profileImage;

    const emailKey = String(normalizedEmail).replace(/\./g, ',');
    const cached = emailKey && groupAvatarCache ? groupAvatarCache[String(emailKey).toLowerCase()] : null;
    if (cached?.profileImage) return cached.profileImage;

    if (normalizedEmail && normalizedEmail === normalizedCurrentUserEmail) {
      return auth.currentUser?.photoURL || null;
    }

    return null;
  };

  const getCurrentUserDisplayName = () => {
    const userEmail = auth.currentUser?.email;
    if (!userEmail) return 'You';
    const match = contacts.find((c) => c && !c.isEveryone && String(c.email).toLowerCase() === String(userEmail).toLowerCase());
    if (match) return getContactDisplayName(match);
    return auth.currentUser?.displayName || 'You';
  };

  // Get email pair helper (matches extension implementation)
  const getEmailPair = async (otherEmail) => {
    if (!otherEmail) {
      console.error('getEmailPair: otherEmail is undefined');
      return null;
    }

    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      console.error('getEmailPair: userEmail is undefined');
      return null;
    }

    const otherEmailFormatted = otherEmail.replace(/\./g, ',');
    const userEmailFormatted = userEmail.replace(/\./g, ',');

    if (otherEmail === 'everyone') {
      return 'everyone';
    }

    if (userEmailFormatted < otherEmailFormatted) {
      return `${userEmailFormatted}-${otherEmailFormatted}`;
    } else {
      return `${otherEmailFormatted}-${userEmailFormatted}`;
    }
  };

  // Helper to get latest message from either privateMessages or company path
  const getLatestMessage = async (emailPair, companyEmail, projectId, topic) => {
    if (emailPair === 'everyone') {
      // Everyone messages only in company path
      const path = `Companies/${companyEmail}/securedProjects/${projectId}/messages/${topic}/${emailPair}`;
      const messageRef = ref(database, path);
      const snapshot = await get(messageRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const messages = Object.values(data);
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && typeof lastMessage === 'object') {
            const userMessages = Object.values(lastMessage);
            if (userMessages.length > 0) {
              return userMessages[userMessages.length - 1];
            }
          }
        }
      }
      return null;
    }

    // For 1-on-1 messages, check privateMessages first (newer, truly private)
    // SECURITY: New path includes ownerCompany for Firebase rule validation
    const privatePath = `privateMessages/${emailPair}/${companyEmail}/${projectId}/${topic}`;
    const privateRef = ref(database, privatePath);
    const privateSnapshot = await get(privateRef);

    if (privateSnapshot.exists()) {
      const privateData = privateSnapshot.val();
      const messages = Object.values(privateData);
      if (messages.length > 0) {
        // Sort by timestamp and get latest
        messages.sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA; // Descending
        });
        return messages[0];
      }
    }

    // Legacy path without ownerCompany (for backward compatibility with old messages)
    const legacyPrivatePath = `privateMessages/${emailPair}/${projectId}/${topic}`;
    const legacyPrivateRef = ref(database, legacyPrivatePath);
    const legacyPrivateSnapshot = await get(legacyPrivateRef);

    if (legacyPrivateSnapshot.exists()) {
      const legacyData = legacyPrivateSnapshot.val();
      const messages = Object.values(legacyData);
      if (messages.length > 0) {
        messages.sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA;
        });
        return messages[0];
      }
    }

    // Fallback to company path (for very old messages stored in company path)
    const companyPath = `Companies/${companyEmail}/securedProjects/${projectId}/messages/${topic}/${emailPair}`;
    const companyRef = ref(database, companyPath);
    const companySnapshot = await get(companyRef);

    if (companySnapshot.exists()) {
      const companyData = companySnapshot.val();
      const messages = Object.values(companyData);
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && typeof lastMessage === 'object') {
          const userMessages = Object.values(lastMessage);
          if (userMessages.length > 0) {
            return userMessages[userMessages.length - 1];
          }
        }
      }
    }

    return null;
  };

  // Determine current topic based on currentChat
  // Use stable values to avoid infinite loops
  const chatId = currentChat?.id;
  const chatTitle = currentChat?.title;

  useEffect(() => {
    console.log('[Messages] currentChat changed:', { chatId, chatTitle });

    // Reset initial load state when chat changes
    setIsInitialLoad(true);

    // Navigation only: when switching chats, always return to the contacts list panel.
    // Do not clear missed counts here; counts are cleared only when a specific contact is opened.
    setShowProfilePage(false);
    setSelectedContact(null);

    if (chatId) {
      // If it's a groq chat, use groqChats-{chatId} format
      const topic = `groqChats-${chatId}`;
      console.log('[Messages] Setting topic to:', topic);

      // Only update if it's different to avoid unnecessary re-renders
      setCurrentTopic(prevTopic => {
        if (prevTopic !== topic) {
          return topic;
        }
        return prevTopic;
      });

      // Immediately set title from currentChat if available (for instant display)
      // This ensures we show the chat title right away, not "General"
      const newTitle = chatTitle || 'Untitled';
      setTopicTitle(prevTitle => {
        if (prevTitle !== newTitle) {
          return newTitle;
        }
        return prevTitle;
      });

      // Fetch the chat title from Firebase (may be more up-to-date)
      const fetchChatTitle = async () => {
        try {
          const companyEmail = await getResolvedCompanyEmail();
          if (!companyEmail || !currentProject) {
            return;
          }

          const formattedCompanyEmailForPath = companyEmail;
          // Replace "-" with "/" in topic for Firebase path: groqChats-{id} -> groqChats/{id}
          const topicPath = topic.replace("-", "/");
          const chatPath = `Companies/${formattedCompanyEmailForPath}/projects/${currentProject}/${topicPath}/title`;

          const chatTitleRef = ref(database, chatPath);
          const chatTitleSnapshot = await get(chatTitleRef);

          if (chatTitleSnapshot.exists()) {
            const title = chatTitleSnapshot.val();
            setTopicTitle(prevTitle => prevTitle !== title ? title : prevTitle);
          }
        } catch (error) {
          console.error('[Messages] Error fetching chat title:', error);
        }
      };

      fetchChatTitle();
    } else {
      // Default to general only if there's truly no chat
      setCurrentTopic(prevTopic => prevTopic !== 'general' ? 'general' : prevTopic);
      setTopicTitle(prevTitle => prevTitle !== 'General' ? 'General' : prevTitle);
    }
  }, [chatId, chatTitle, currentProject]); // Use stable values instead of the whole currentChat object

  useEffect(() => {
    if (!chatId) {
      setContactMissedCounts({});
      return;
    }

    const cleanup = listenToContactMissedCounts(chatId, (counts) => {
      setContactMissedCounts(counts || {});
    });

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [chatId]);

  // Set up real-time profile picture listeners
  // Use a stable key based on contact emails to avoid infinite loops
  const contactsEmailKey = contacts
    .filter(c => !c.isEveryone && c.emailKey && c.userCompanyEmail)
    .map(c => c.email)
    .sort()
    .join(',');

  useEffect(() => {
    if (contacts.length === 0) {
      // Clean up all listeners if no contacts
      profilePicListeners.current.forEach(({ ref: refToClean, listener }) => {
        off(refToClean, 'value', listener);
      });
      profilePicListeners.current = [];
      contactsEmailKeys.current.clear();
      return;
    }

    // Create a set of current contact email keys
    const currentEmailKeys = new Set(
      contacts
        .filter(c => !c.isEveryone && c.emailKey && c.userCompanyEmail)
        .map(c => c.email)
    );

    // Remove listeners for contacts that no longer exist
    profilePicListeners.current = profilePicListeners.current.filter(({ email, ref: refToClean, listener }) => {
      if (!currentEmailKeys.has(email)) {
        off(refToClean, 'value', listener);
        contactsEmailKeys.current.delete(email);
        return false;
      }
      return true;
    });

    // Add listeners for new contacts
    contacts.forEach((contact) => {
      if (contact.isEveryone || !contact.emailKey || !contact.userCompanyEmail) return;

      // Skip if listener already exists
      if (contactsEmailKeys.current.has(contact.email)) return;

      // Use the contact's specific company email (not the resolved one)
      const userPath = `Companies/${contact.userCompanyEmail}/users/${contact.emailKey}`;
      const userRef = ref(database, userPath);

      const listener = onValue(userRef, (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
          // Backfill full name into Firebase when first/last exist.
          // Best-effort and non-destructive.
          const fn = userData.firstName ? String(userData.firstName).trim() : '';
          const ln = userData.lastName ? String(userData.lastName).trim() : '';
          if (fn && ln) {
            const fullName = `${fn} ${ln}`.trim();
            const currentName = userData.name ? String(userData.name).trim() : '';
            if (fullName && currentName !== fullName) {
              try {
                update(userRef, { name: fullName });
              } catch (_) {
                // Best-effort
              }
            }
          }

          // Only update if data actually changed to prevent infinite loops
          setContacts(prev => prev.map(c => {
            if (c.email === contact.email) {
              const newProfileImage = Object.prototype.hasOwnProperty.call(userData, 'profileImage')
                ? (userData.profileImage || null)
                : c.profileImage;
              const newFirstName = userData.firstName || c.firstName;
              const newLastName = userData.lastName || c.lastName;
              const newName = userData.name || (newFirstName && newLastName
                ? `${newFirstName} ${newLastName}`
                : newFirstName || c.name);

              // Only update if something actually changed
              if (c.profileImage !== newProfileImage ||
                c.firstName !== newFirstName ||
                c.lastName !== newLastName ||
                c.name !== newName) {
                return {
                  ...c,
                  profileImage: newProfileImage,
                  firstName: newFirstName,
                  lastName: newLastName,
                  name: newName
                };
              }
            }
            return c;
          }));
        }
      });

      profilePicListeners.current.push({ email: contact.email, ref: userRef, listener });
      contactsEmailKeys.current.add(contact.email);
    });

    return () => {
      // Cleanup is handled above when contacts change
    };
  }, [contactsEmailKey]); // Only depend on email keys string, not full contact objects

  // Set up presence status listeners for contacts
  useEffect(() => {
    // Clean up old listeners
    Object.values(presenceListeners.current).forEach(cleanup => {
      if (cleanup) cleanup();
    });
    presenceListeners.current = {};

    // Set up listeners for each contact
    contacts.forEach((contact) => {
      if (contact.isEveryone || !contact.email) return;

      const email = contact.email;
      const cleanup = listenToUserPresenceCanonical(email, (status) => {
        setContactStatuses(prev => ({
          ...prev,
          [email]: status
        }));
      });

      presenceListeners.current[email] = cleanup;
    });

    return () => {
      // Cleanup all presence listeners
      Object.values(presenceListeners.current).forEach(cleanup => {
        if (cleanup) cleanup();
      });
      presenceListeners.current = {};
    };
  }, [contacts]);

  // Close plus menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target)) {
        setShowPlusMenu(false);
      }
    };

    if (showPlusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPlusMenu]);

  // Load contacts panel
  useEffect(() => {
    if (!currentProject) {
      return;
    }

    // Use 'general' as default if currentTopic is not set
    const topicToUse = currentTopic || 'general';

    const loadContacts = async () => {
      loadContactsPanelRequestId.current++;
      const currentRequestId = loadContactsPanelRequestId.current;
      setIsLoading(true);

      try {
        const companyEmail = await getResolvedCompanyEmail();
        if (!companyEmail) {
          setIsLoading(false);
          return;
        }

        const formattedCompanyEmailForPath = companyEmail; // Already formatted with commas
        const userEmail = auth.currentUser?.email || '';
        const userEmailFormatted = userEmail.replace(/\./g, ',');

        const contactsList = [];

        // Add "Everyone" contact
        const everyonePath = `Companies/${formattedCompanyEmailForPath}/securedProjects/${currentProject}/messages/${topicToUse}/everyone`;
        const everyoneRef = ref(database, everyonePath);
        const everyoneSnapshot = await get(everyoneRef);
        let everyoneMessage = { timestamp: Date.now(), text: '' };

        if (everyoneSnapshot.exists()) {
          const everyoneData = everyoneSnapshot.val();
          const messages = Object.values(everyoneData);
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && typeof lastMessage === 'object') {
              const userMessages = Object.values(lastMessage);
              if (userMessages.length > 0) {
                everyoneMessage = userMessages[userMessages.length - 1];
              }
            }
          }
        }

        if (currentRequestId === loadContactsPanelRequestId.current) {
          contactsList.push({
            name: 'Everyone',
            email: 'everyone',
            profileImage: null,
            firstName: null,
            lastName: null,
            message: everyoneMessage,
            isEveryone: true,
            emailKey: null
          });
        }

        // Add topic-scoped group chats for the current user
        try {
          if (currentRequestId !== loadContactsPanelRequestId.current) return;
          if (userEmailFormatted) {
            const membershipIndexPath = `Companies/${formattedCompanyEmailForPath}/topicGroupChatMembership/${topicToUse}/${userEmailFormatted.toLowerCase()}`;
            const membershipIndexSnap = await get(ref(database, membershipIndexPath));
            const groupIds = membershipIndexSnap.exists() ? Object.keys(membershipIndexSnap.val() || {}) : [];
            if (groupIds.length > 0) {
              const groupSnaps = await Promise.all(
                groupIds.map((groupId) => get(ref(database, `Companies/${formattedCompanyEmailForPath}/topicGroupChats/${topicToUse}/${groupId}`)))
              );

              groupSnaps.forEach((snap, idx) => {
                if (currentRequestId !== loadContactsPanelRequestId.current) return;
                if (!snap.exists()) return;
                const group = snap.val() || {};
                const groupId = groupIds[idx];

                const membersObj = group.members && typeof group.members === 'object' ? group.members : {};
                const memberKeys = Object.keys(membersObj);
                const previewKeys = memberKeys
                  .filter((k) => k && String(k).toLowerCase() !== String(userEmailFormatted).toLowerCase())
                  .slice(0, 3);

                contactsList.push({
                  name: group.name || 'Group chat',
                  email: `group:${groupId}`,
                  profileImage: null,
                  firstName: null,
                  lastName: null,
                  message: group.lastMessage || null,
                  isEveryone: false,
                  emailKey: null,
                  isGroupChat: true,
                  groupId,
                  memberPreviewKeys: previewKeys,
                });
              });
            }
          }
        } catch (e) {
          console.warn('Error loading group chats:', e);
        }

        // Fetch project members
        const membersPath = `Companies/${formattedCompanyEmailForPath}/projects/${currentProject}/members`;
        const membersRef = ref(database, membersPath);
        const membersSnapshot = await get(membersRef);

        if (!membersSnapshot.exists()) {
          if (currentRequestId === loadContactsPanelRequestId.current) {
            setContacts(contactsList);
            setIsLoading(false);
          }
          return;
        }

        const membersData = membersSnapshot.val();
        const userEmail1 = userEmail.toLowerCase().trim();

        // Load hidden contacts
        const hiddenPath = `Companies/${formattedCompanyEmailForPath}/hiddencontacts/${userEmailFormatted}`;
        const hiddenRef = ref(database, hiddenPath);
        const hiddenSnapshot = await get(hiddenRef);
        const hidden = hiddenSnapshot.exists() ? hiddenSnapshot.val() : {};
        const isHidden = (email) => {
          const emailKey = email.replace(/\./g, ',');
          return !!hidden[emailKey];
        };

        // Get owner email (company email) - companyEmail is already comma-formatted, convert to dots
        const ownerEmail = formattedCompanyEmailForPath.replace(/,/g, '.');
        const memberEmails = new Set();
        for (const [emailKey] of Object.entries(membersData)) {
          memberEmails.add(emailKey.replace(/,/g, '.').toLowerCase());
        }

        // Add owner if not in members and not current user
        if (ownerEmail && !memberEmails.has(ownerEmail.toLowerCase())) {
          const normalizedOwnerEmail = ownerEmail.toLowerCase().trim();
          if (normalizedOwnerEmail !== userEmail1 && !isHidden(ownerEmail)) {
            // Fetch owner user data - owner belongs to the company email
            const ownerEmailKey = ownerEmail.replace(/\./g, ',');
            let ownerUserCompanyEmail = formattedCompanyEmailForPath; // Owner is part of the company

            // Try to get owner's actual company (in case they're from a different company)
            try {
              const ownerCompanyEmail = await getFirebaseData(`emailToCompanyDirectory/${ownerEmailKey}`);
              if (ownerCompanyEmail) {
                ownerUserCompanyEmail = ownerCompanyEmail.replace(/\./g, ',');
              }
            } catch (e) {
              // Use default company email
            }

            const ownerUserPath = `Companies/${ownerUserCompanyEmail}/users/${ownerEmailKey}`;
            const ownerUserRef = ref(database, ownerUserPath);
            const ownerUserSnapshot = await get(ownerUserRef);

            let ownerName = ownerEmail.split('@')[0];
            let ownerProfileImage = null;
            let ownerFirstName = null;
            let ownerLastName = null;

            if (ownerUserSnapshot.exists()) {
              const ownerUserData = ownerUserSnapshot.val();
              if (ownerUserData.name) ownerName = ownerUserData.name;
              if (ownerUserData.profileImage) ownerProfileImage = ownerUserData.profileImage;
              if (ownerUserData.firstName) ownerFirstName = ownerUserData.firstName;
              if (ownerUserData.lastName) ownerLastName = ownerUserData.lastName;
            }

            // Get latest message for owner
            const ownerEmailPair = await getEmailPair(ownerEmail);
            let ownerMessage = { timestamp: Date.now(), text: 'No messages yet' };

            if (ownerEmailPair) {
              const latestMsg = await getLatestMessage(ownerEmailPair, formattedCompanyEmailForPath, currentProject, topicToUse);
              if (latestMsg) {
                ownerMessage = latestMsg;
              }
            }

            if (currentRequestId === loadContactsPanelRequestId.current) {
              contactsList.push({
                name: ownerName,
                email: ownerEmail,
                profileImage: ownerProfileImage,
                firstName: ownerFirstName,
                lastName: ownerLastName,
                message: ownerMessage,
                emailKey: ownerEmailKey,
                userCompanyEmail: ownerUserCompanyEmail
              });
            }
          }
        }

        // Process each member
        for (const [emailKey, memberInfo] of Object.entries(membersData)) {
          if (currentRequestId !== loadContactsPanelRequestId.current) break;

          let userEmail2 = emailKey.replace(/,/g, '.');
          const normalizedEmailKey = userEmail2.toLowerCase().trim();
          const memberEmail = (memberInfo && memberInfo.email) ? memberInfo.email.toLowerCase().trim() : null;
          const isCurrentUser = userEmail1 === normalizedEmailKey || (memberEmail && userEmail1 === memberEmail);

          if (isCurrentUser || isHidden(userEmail2)) continue;

          if (memberInfo && memberInfo.email) {
            userEmail2 = memberInfo.email;
          }

          // Fetch user profile data - determine user's company
          let userName = userEmail2.split('@')[0];
          let profileImage = null;
          let firstName = null;
          let lastName = null;
          let userCompanyEmail = formattedCompanyEmailForPath; // Default to current company

          try {
            // First, try to get the user's actual company
            const userCompanyEmailFromDir = await getFirebaseData(`emailToCompanyDirectory/${emailKey}`);
            if (userCompanyEmailFromDir) {
              userCompanyEmail = userCompanyEmailFromDir.replace(/\./g, ',');
            }

            // Then fetch user data from their company
            const userPath = `Companies/${userCompanyEmail}/users/${emailKey}`;
            const userRef = ref(database, userPath);
            const userSnapshot = await get(userRef);

            if (userSnapshot.exists()) {
              const userData = userSnapshot.val();
              if (userData.name) userName = userData.name;
              if (userData.profileImage) profileImage = userData.profileImage;
              if (userData.firstName) firstName = userData.firstName;
              if (userData.lastName) lastName = userData.lastName;
            }
          } catch (e) {
            console.warn('Could not fetch user data for:', userEmail2, e);
          }

          // Fallback to memberInfo.name
          if (userName === userEmail2.split('@')[0] && memberInfo && memberInfo.name) {
            userName = memberInfo.name;
          }

          // Get latest message (check both privateMessages and company paths)
          const emailPair = await getEmailPair(userEmail2);
          if (!emailPair) continue; // Skip if email pair creation failed

          let message = null; // Will be set to actual message or remain null for "No messages yet"
          const latestMsg = await getLatestMessage(emailPair, formattedCompanyEmailForPath, currentProject, topicToUse);
          if (latestMsg) {
            message = latestMsg;
          }

          // Legacy code path for old message structure (keep for backward compatibility)
          if (!message) {
            const messagesPath = `Companies/${formattedCompanyEmailForPath}/securedProjects/${currentProject}/messages/${topicToUse}/${emailPair}`;
            const messagesRef = ref(database, messagesPath);
            const messagesSnapshot = await get(messagesRef);

            if (messagesSnapshot.exists()) {
              const messagesData = messagesSnapshot.val();
              if (messagesData && typeof messagesData === 'object') {
                // Convert Firebase object to array of messages
                const messagesArray = Object.entries(messagesData).map(([key, msg]) => {
                  // Extract messageId from Firebase key if not present
                  if (msg && !msg.messageId) {
                    msg.messageId = String(key);
                  }
                  return msg;
                });

                // Filter out thread replies (only show main messages)
                const mainMessages = messagesArray.filter(msg => !msg.threadId);

                if (mainMessages.length > 0) {
                  // Sort by timestamp to get the most recent message
                  mainMessages.sort((a, b) => {
                    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return timeB - timeA; // Most recent first
                  });

                  // Get the most recent message
                  message = mainMessages[0];
                }
              }
            }
          }

          if (currentRequestId === loadContactsPanelRequestId.current) {
            contactsList.push({
              name: userName,
              email: userEmail2,
              profileImage: profileImage,
              firstName: firstName,
              lastName: lastName,
              message: message,
              emailKey: emailKey,
              userCompanyEmail: userCompanyEmail
            });
          }
        }

        if (currentRequestId === loadContactsPanelRequestId.current) {
          setContacts(contactsList);
          setIsLoading(false);

          // Set up real-time message preview listeners for all contacts
          setupMessagePreviewListeners(contactsList);
        }
      } catch (error) {
        console.error('Error loading contacts:', error);
        setIsLoading(false);
      }
    };

    loadContacts();
  }, [currentProject, currentTopic, groupMembershipTick]);

  // When group chat membership changes for this topic, refresh contacts so new group chats appear.
  useEffect(() => {
    if (!currentProject || !currentTopic) return;

    const userEmail = auth.currentUser?.email;
    if (!userEmail) return;

    let unsub = null;
    const start = async () => {
      try {
        const companyEmail = await getResolvedCompanyEmail();
        if (!companyEmail) return;
        const userKey = String(userEmail).replace(/\./g, ',').toLowerCase();
        const topic = String(currentTopic || 'general');
        const membershipPath = `Companies/${companyEmail}/topicGroupChatMembership/${topic}/${userKey}`;
        const membershipRef = ref(database, membershipPath);

        const listener = () => {
          setGroupMembershipTick((t) => t + 1);
        };
        unsub = onValue(membershipRef, listener);
      } catch (_) {
        // Best-effort
      }
    };

    start();
    return () => {
      try { if (typeof unsub === 'function') unsub(); } catch (_) { }
    };
  }, [currentProject, currentTopic, auth.currentUser?.email]);

  // Fetch profile pictures for group chat avatar stacks (same logic as contacts/activity)
  useEffect(() => {
    if (!currentProject || !currentTopic) return;

    const userEmail = auth.currentUser?.email;
    if (!userEmail) return;

    let cancelled = false;
    const run = async () => {
      try {
        const groupContacts = (Array.isArray(contacts) ? contacts : []).filter((c) => c && c.isGroupChat && Array.isArray(c.memberPreviewKeys));
        if (!groupContacts.length) return;

        const needed = new Set();
        groupContacts.forEach((c) => {
          (c.memberPreviewKeys || []).forEach((k) => {
            const key = String(k || '').toLowerCase();
            if (!key) return;
            if (!groupAvatarCache || !groupAvatarCache[key]) needed.add(key);
          });
        });

        const keys = Array.from(needed);
        if (!keys.length) return;

        const fetched = await Promise.all(
          keys.map(async (emailKey) => {
            try {
              const companyFromDir = await getFirebaseData(`emailToCompanyDirectory/${emailKey}`);
              const userCompanyEmail = (companyFromDir ? String(companyFromDir) : null)
                ? String(companyFromDir).replace(/\./g, ',')
                : null;

              const companyToUse = userCompanyEmail || (await getResolvedCompanyEmail());
              if (!companyToUse) return [emailKey, null];

              const [pic, userData] = await Promise.all([
                getFirebaseData(`Companies/${companyToUse}/users/${emailKey}/profileImage`).catch(() => null),
                getFirebaseData(`Companies/${companyToUse}/users/${emailKey}`).catch(() => null),
              ]);

              const profileImage = (userData && userData.profileImage) ? userData.profileImage : pic;
              return [emailKey, {
                profileImage: profileImage || null,
                firstName: userData?.firstName || null,
                lastName: userData?.lastName || null,
                name: userData?.name || null,
              }];
            } catch (_) {
              return [emailKey, null];
            }
          })
        );

        if (cancelled) return;
        setGroupAvatarCache((prev) => {
          const next = { ...(prev || {}) };
          fetched.forEach(([k, v]) => {
            if (!k || !v) return;
            next[String(k).toLowerCase()] = v;
          });
          return next;
        });
      } catch (_) {
        // Best-effort
      }
    };

    run();
    return () => { cancelled = true; };
  }, [contacts, currentProject, currentTopic, auth.currentUser?.email]);

  useEffect(() => {
    if (!currentProject || !currentTopic) return;

    let cancelled = false;

    const collectKeys = () => {
      const keys = new Set();

      (Array.isArray(contacts) ? contacts : [])
        .filter((c) => c && c.isGroupChat && Array.isArray(c.memberPreviewKeys))
        .forEach((c) => {
          (c.memberPreviewKeys || []).forEach((k) => {
            const key = String(k || '').toLowerCase();
            if (key) keys.add(key);
          });
        });

      if (selectedContact && selectedContact.isGroupChat && Array.isArray(selectedContact.memberPreviewKeys)) {
        (selectedContact.memberPreviewKeys || []).forEach((k) => {
          const key = String(k || '').toLowerCase();
          if (key) keys.add(key);
        });
      }

      if (selectedContact && (selectedContact.isGroupChat || selectedContact.isEveryone)) {
        (Array.isArray(allMessages) ? allMessages : []).forEach((m) => {
          const e = m && m.email ? String(m.email).toLowerCase() : '';
          if (!e) return;
          const key = e.replace(/\./g, ',');
          if (key) keys.add(String(key).toLowerCase());
        });
      }

      return Array.from(keys);
    };

    const ensureListeners = async () => {
      try {
        const keys = collectKeys();

        const keep = new Set(keys);
        Array.from(groupAvatarListenersRef.current.keys()).forEach((k) => {
          if (!keep.has(k)) {
            try {
              const unsub = groupAvatarListenersRef.current.get(k);
              if (typeof unsub === 'function') unsub();
            } catch (_) { }
            groupAvatarListenersRef.current.delete(k);
            groupAvatarListenerMetaRef.current.delete(k);
          }
        });

        const companyEmailResolved = await getResolvedCompanyEmail();
        if (!companyEmailResolved) return;

        await Promise.all(
          keys.map(async (emailKey) => {
            const k = String(emailKey || '').toLowerCase();
            if (!k) return;
            if (groupAvatarListenersRef.current.has(k)) return;

            try {
              const companyFromDir = await getFirebaseData(`emailToCompanyDirectory/${k}`);
              const companyToUse = companyFromDir
                ? String(companyFromDir).replace(/\./g, ',')
                : companyEmailResolved;

              if (!companyToUse) return;

              const userRef = ref(database, `Companies/${companyToUse}/users/${k}`);
              groupAvatarListenerMetaRef.current.set(k, { companyToUse });

              const unsub = onValue(userRef, (snapshot) => {
                if (cancelled) return;
                const userData = snapshot.val() || null;

                setGroupAvatarCache((prev) => {
                  const next = { ...(prev || {}) };
                  const profileImage = userData && Object.prototype.hasOwnProperty.call(userData, 'profileImage')
                    ? (userData.profileImage || null)
                    : null;

                  next[k] = {
                    profileImage,
                    firstName: userData?.firstName || null,
                    lastName: userData?.lastName || null,
                    name: userData?.name || null,
                  };
                  return next;
                });
              });

              groupAvatarListenersRef.current.set(k, unsub);
            } catch (_) {
              // Best-effort
            }
          })
        );
      } catch (_) {
        // Best-effort
      }
    };

    ensureListeners();

    return () => {
      cancelled = true;

      try {
        groupAvatarListenersRef.current.forEach((unsub) => {
          try {
            if (typeof unsub === 'function') unsub();
          } catch (_) { }
        });
        groupAvatarListenersRef.current.clear();
        groupAvatarListenerMetaRef.current.clear();
      } catch (_) {
        // Best-effort
      }
    };
  }, [contacts, selectedContact?.email, selectedContact?.groupId, selectedContact?.isGroupChat, selectedContact?.isEveryone, currentProject, currentTopic, auth.currentUser?.email, allMessages]);

  // Filter contacts based on search
  const filteredContacts = contacts.filter(contact => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      contact.name.toLowerCase().includes(searchLower) ||
      contact.email.toLowerCase().includes(searchLower) ||
      (contact.message && contact.message.text && contact.message.text.toLowerCase().includes(searchLower))
    );
  });

  const handleContactClick = async (contact) => {
    if (!contact) return;

    const chatId = currentChat?.id;
    if (chatId && auth.currentUser?.email) {
      try {
        const userEmail = auth.currentUser.email;
        const contactEmail = contact.isEveryone
          ? 'everyone'
          : (contact?.email || contact?.emailKey?.replace(/,/g, '.'));

        if (contactEmail) {
          const userKey = String(userEmail).replace(/\./g, ',').toLowerCase();
          const contactKey = String(contactEmail).replace(/\./g, ',').toLowerCase();
          const lastReadRef = ref(database, `userChatState/${userKey}/${chatId}/contacts/${contactKey}/lastReadTime`);
          const snap = await get(lastReadRef);
          setMissedSinceTs(snap.exists() ? Number(snap.val() || 0) : null);
        } else {
          setMissedSinceTs(null);
        }
      } catch (_) {
        setMissedSinceTs(null);
      }

      if (contact?.email || contact?.isEveryone || contact?.emailKey) {
        try {
          await clearMissedMessagesForContact(chatId, contact.isEveryone ? 'everyone' : (contact.email || contact.emailKey?.replace(/,/g, '.')));
        } catch (_) {
          // Best-effort
        }
      }
    } else {
      setMissedSinceTs(null);
    }

    setSelectedContact(contact);
    setShowProfilePage(true);
    setActiveThread(null);

    // Reset composer state when switching contacts
    setComposerBlocks([]);
    setComposerMode('text');

    // Reset input when switching contacts (but don't stomp main draft when in a thread)
    if (!activeThread?.threadId) {
      setInputValue('');
      mainDraftRef.current = '';
      threadDraftRef.current = '';
    } else {
      mainDraftRef.current = '';
      threadDraftRef.current = '';
    }

    setShowPlusMenu(false); // Reset plus menu state
    setAttachedHighlight(null);
    loadMessagesForContact(contact);
  };

  // Load messages for a contact
  const loadMessagesForContact = async (contact) => {
    if (!contact || !currentProject || !currentTopic) return;

    try {
      setIsLoadingMessages(true);
      const userEmail = auth.currentUser?.email;
      if (!userEmail) {
        console.error('loadMessagesForContact: User not logged in');
        setIsLoadingMessages(false);
        return;
      }

      // Topic-scoped group chats
      if (contact.isGroupChat && contact.groupId) {
        const companyEmail = await getResolvedCompanyEmail();
        if (!companyEmail) {
          console.error('loadMessagesForContact(group): Company email is undefined');
          setIsLoadingMessages(false);
          return;
        }

        const userEmailFormatted = String(userEmail).replace(/\./g, ',').toLowerCase();
        const membershipIndexPath = `Companies/${companyEmail}/topicGroupChatMembership/${currentTopic}/${userEmailFormatted}/${contact.groupId}`;
        const membershipSnap = await get(ref(database, membershipIndexPath));
        if (!membershipSnap.exists()) {
          alert('You do not have access to this group chat.');
          setIsLoadingMessages(false);
          return;
        }

        const messagesPath = `Companies/${companyEmail}/topicGroupChatMessages/${currentTopic}/${contact.groupId}`;
        const threadsMetaPath = `Companies/${companyEmail}/topicGroupChatThreads/${currentTopic}/${contact.groupId}`;

        // Clean up previous listeners
        if (messagesListenerRef.current) {
          off(messagesListenerRef.current.ref, 'value', messagesListenerRef.current.listener);
          if (messagesListenerRef.current.secondary) {
            off(messagesListenerRef.current.secondary.ref, 'value', messagesListenerRef.current.secondary.listener);
          }
          if (messagesListenerRef.current.legacy) {
            off(messagesListenerRef.current.legacy.ref, 'value', messagesListenerRef.current.legacy.listener);
          }
          if (messagesListenerRef.current.scheduled) {
            off(messagesListenerRef.current.scheduled.ref, 'value', messagesListenerRef.current.scheduled.listener);
          }
          messagesListenerRef.current = null;
        }

        if (threadMetaListenerRef.current) {
          off(threadMetaListenerRef.current.ref, 'value', threadMetaListenerRef.current.listener);
          threadMetaListenerRef.current = null;
        }

        const messagesRef = ref(database, messagesPath);
        const listener = (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const messagesArray = Object.entries(data).map(([key, msg]) => {
              if (msg && !msg.messageId) msg.messageId = String(key);
              return msg;
            });

            setAllMessages(() => {
              const merged = messagesArray
                .filter(Boolean)
                .sort((a, b) => {
                  const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                  const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                  return timeA - timeB;
                });
              return merged;
            });

            const mainMessages = messagesArray.filter((msg) => msg && !msg.threadId);
            mainMessages.sort((a, b) => {
              const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
              const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
              return timeA - timeB;
            });

            setMessages(mainMessages);
            setIsLoadingMessages(false);
            if (isInitialLoad) setIsInitialLoad(false);
            if (mainMessages.length > 0) {
              updateContactMessagePreview(contact, mainMessages[mainMessages.length - 1]);
            }
            setTimeout(() => {
              if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          } else {
            setMessages([]);
            setAllMessages([]);
            setIsLoadingMessages(false);
          }
        };

        onValue(messagesRef, listener);
        messagesListenerRef.current = { ref: messagesRef, listener };

        const metaRef = ref(database, threadsMetaPath);
        const metaListener = (snapshot) => {
          setThreadMetas(snapshot.val() || {});
        };
        onValue(metaRef, metaListener);
        threadMetaListenerRef.current = { ref: metaRef, listener: metaListener };
        return;
      }

      // Validate contact email
      const contactEmail = contact.isEveryone ? 'everyone' : (contact.email || contact.emailKey?.replace(/,/g, '.'));
      if (!contactEmail) {
        console.error('loadMessagesForContact: Contact email is undefined', contact);
        setIsLoadingMessages(false);
        return;
      }

      const companyEmail = await getResolvedCompanyEmail();
      if (!companyEmail) {
        console.error('loadMessagesForContact: Company email is undefined');
        setIsLoadingMessages(false);
        return;
      }

      // Security: Verify user is a project member before loading messages
      const userEmailFormatted = userEmail.replace(/\./g, ',');
      const membershipPath = `Companies/${companyEmail}/projects/${currentProject}/members/${userEmailFormatted}`;
      const membershipRef = ref(database, membershipPath);
      try {
        const membershipSnapshot = await get(membershipRef);
        if (!membershipSnapshot.exists()) {
          console.error('loadMessagesForContact: User is not a project member', {
            membershipPath,
            userEmail,
            companyEmail,
            currentProject
          });
          alert('You must be a project member to view messages. Please contact the project owner to be added.');
          setIsLoadingMessages(false);
          return;
        }
      } catch (membershipError) {
        console.error('loadMessagesForContact: Error checking membership', membershipError);
        alert('Unable to verify project membership. Please try again.');
        setIsLoadingMessages(false);
        return;
      }

      const emailPair = await getEmailPair(contactEmail);
      if (!emailPair) {
        console.error('loadMessagesForContact: Failed to get email pair');
        setIsLoadingMessages(false);
        return;
      }

      // Thread meta path for this conversation
      const threadsMetaPath = emailPair === 'everyone'
        ? `Companies/${companyEmail}/securedProjects/${currentProject}/messageThreads/${currentTopic}/${emailPair}`
        : `privateMessageThreads/${emailPair}/${companyEmail}/${currentProject}/${currentTopic}`;

      // Use privateMessages path for 1-on-1 conversations (truly private, cross-company)
      // Use company path for "everyone" messages (project-wide announcements)
      // SECURITY: Include ownerCompany in path for Firebase rules to verify specific project membership
      let messagesPath;
      let legacyMessagesPath = null; // For backward compatibility with old messages
      if (emailPair === 'everyone') {
        // Project-wide messages stay in company path
        messagesPath = `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
      } else {
        // Private 1-on-1 messages include ownerCompany for Firebase rule validation
        // Path: privateMessages/{emailPair}/{ownerCompany}/{projectId}/{topic}/{messageId}
        messagesPath = `privateMessages/${emailPair}/${companyEmail}/${currentProject}/${currentTopic}`;
        // Legacy path for backward compatibility (old messages without ownerCompany)
        legacyMessagesPath = `privateMessages/${emailPair}/${currentProject}/${currentTopic}`;
      }

      // Clean up previous listeners
      if (messagesListenerRef.current) {
        off(messagesListenerRef.current.ref, 'value', messagesListenerRef.current.listener);
        if (messagesListenerRef.current.secondary) {
          off(messagesListenerRef.current.secondary.ref, 'value', messagesListenerRef.current.secondary.listener);
        }
        if (messagesListenerRef.current.legacy) {
          off(messagesListenerRef.current.legacy.ref, 'value', messagesListenerRef.current.legacy.listener);
        }
        if (messagesListenerRef.current.scheduled) {
          off(messagesListenerRef.current.scheduled.ref, 'value', messagesListenerRef.current.scheduled.listener);
        }
        messagesListenerRef.current = null;
      }

      if (threadMetaListenerRef.current) {
        off(threadMetaListenerRef.current.ref, 'value', threadMetaListenerRef.current.listener);
        threadMetaListenerRef.current = null;
      }

      // Set up listeners for both paths (privateMessages and company path for backward compatibility)
      const setupListener = (path, isPrimary) => {
        const messagesRef = ref(database, path);
        const listener = (snapshot) => {
          const data = snapshot.val();
          if (data) {
            // Convert Firebase object to array
            const messagesArray = Object.entries(data).map(([key, msg]) => {
              // Extract messageId from Firebase key if not present
              if (msg && !msg.messageId) {
                msg.messageId = String(key);
              }
              return msg;
            });

            // Missed counts are tracked globally from ChatSidebar listeners.
            // Messages view should not increment missed counts to avoid double counting.

            setAllMessages((prevAll) => {
              const messageMap = new Map();
              prevAll.forEach((m) => {
                if (m && m.messageId) messageMap.set(m.messageId, m);
              });
              messagesArray.forEach((m) => {
                if (m && m.messageId) messageMap.set(m.messageId, m);
              });
              const merged = Array.from(messageMap.values());
              return merged.sort((a, b) => {
                const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return timeA - timeB;
              });
            });

            // Filter out thread replies (only show main messages)
            const mainMessages = messagesArray.filter(msg => !msg.threadId);

            // Sort by timestamp (oldest first)
            mainMessages.sort((a, b) => {
              const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
              const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
              return timeA - timeB;
            });

            setMessages(prevMessages => {
              // Create a map to store the latest version of each message
              const messageMap = new Map();

              // First, add all previous messages to the map
              prevMessages.forEach(msg => {
                if (msg && msg.messageId) {
                  messageMap.set(msg.messageId, msg);
                }
              });

              // Then, update with messages from Firebase (these will overwrite old versions)
              mainMessages.forEach(msg => {
                if (msg && msg.messageId) {
                  messageMap.set(msg.messageId, msg);
                }
              });

              // Convert map back to array and sort
              const unique = Array.from(messageMap.values());
              return unique.sort((a, b) => {
                const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return timeA - timeB;
              });
            });
            setIsLoadingMessages(false);

            // Mark initial load as complete after first load
            if (isInitialLoad) {
              setIsInitialLoad(false);
            }

            // Update contact preview with the latest message (real-time updates)
            if (mainMessages.length > 0) {
              const latestMessage = mainMessages[mainMessages.length - 1];
              updateContactMessagePreview(contact, latestMessage);
            }

            // Auto-scroll to bottom after messages load
            setTimeout(() => {
              if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }, 100);
          } else if (isPrimary) {
            // Only clear messages if primary path is empty
            setMessages([]);
            setAllMessages([]);
            setIsLoadingMessages(false);
          }
        };

        onValue(messagesRef, listener);
        return { ref: messagesRef, listener };
      };

      // Set up listener for primary path (new path with ownerCompany)
      const primaryListener = setupListener(messagesPath, true);
      messagesListenerRef.current = primaryListener;

      // For 1-on-1 messages, also listen to legacy paths for backward compatibility
      if (emailPair !== 'everyone') {
        // Legacy path without ownerCompany (for old messages)
        const legacyListener = legacyMessagesPath ? setupListener(legacyMessagesPath, false) : null;
        // Company path (for very old messages stored in company path)
        const companyPath = `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
        const companyListener = setupListener(companyPath, false);
        // Store all listeners for cleanup
        messagesListenerRef.current = {
          ref: primaryListener.ref,
          listener: primaryListener.listener,
          secondary: companyListener,
          legacy: legacyListener
        };
      } else {
        messagesListenerRef.current = primaryListener;
      }

      // Set up listener for scheduled messages for this chat
      const currentUserEmail = auth.currentUser?.email;
      if (currentUserEmail && companyEmail && currentProject && currentTopic && emailPair) {
        const scheduledBaseRef = ref(database, 'scheduledMessages');
        const scheduledQuery = query(
          scheduledBaseRef,
          orderByChild('createdByEmail'),
          equalTo(currentUserEmail)
        );

        const scheduledListener = (snapshot) => {
          const allScheduled = snapshot.val() || {};
          const scheduledForThisChat = [];

          for (const scheduledId of Object.keys(allScheduled)) {
            const scheduled = allScheduled[scheduledId];
            if (
              scheduled &&
              scheduled.projectId === currentProject &&
              scheduled.topic === currentTopic &&
              scheduled.emailPair === emailPair
            ) {
              scheduledForThisChat.push({
                ...scheduled,
                scheduledId,
                messageId: `scheduled-${scheduledId}`,
                timestamp: new Date(scheduled.createdAt || scheduled.scheduledAt).toISOString(),
                isScheduled: true,
              });
            }
          }

          setMessages(prevMessages => {
            const withoutScheduled = prevMessages.filter(m => !m.isScheduled);
            const combined = [...withoutScheduled, ...scheduledForThisChat];
            return combined.sort((a, b) => {
              const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
              const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
              return timeA - timeB;
            });
          });
        };

        onValue(scheduledQuery, scheduledListener);

        // Store scheduled listener for cleanup
        if (messagesListenerRef.current.secondary) {
          messagesListenerRef.current.scheduled = { ref: scheduledQuery, listener: scheduledListener };
        } else {
          messagesListenerRef.current = {
            ref: primaryListener.ref,
            listener: primaryListener.listener,
            scheduled: { ref: scheduledQuery, listener: scheduledListener }
          };
        }
      }

      // Thread metadata listener (for threads with 0 replies)
      const metaRef = ref(database, threadsMetaPath);
      const metaListener = (snapshot) => {
        setThreadMetas(snapshot.val() || {});
      };
      onValue(metaRef, metaListener);
      threadMetaListenerRef.current = { ref: metaRef, listener: metaListener };
    } catch (error) {
      console.error('Error loading messages:', error);
      setIsLoadingMessages(false);
    }
  };

  // Send message (or update if editing)
  const handleSendMessage = async () => {
    const workingBlocks = Array.isArray(composerBlocks) ? composerBlocks : [];
    const hasNonEmptyBlock = workingBlocks.some((b) => String(b?.text || '').trim());
    const hasCurrentText = Boolean(String(inputValue || '').trim());
    if ((!hasNonEmptyBlock && !hasCurrentText) || !selectedContact || !currentProject || !currentTopic) return;

    // Topic-scoped group chat send
    if (selectedContact.isGroupChat && selectedContact.groupId) {
      try {
        const userEmail = auth.currentUser?.email;
        if (!userEmail) {
          alert('You must be logged in to send messages');
          return;
        }

        const companyEmail = await getResolvedCompanyEmail();
        if (!companyEmail) {
          alert('Unable to determine company email');
          return;
        }

        const userKey = String(userEmail).replace(/\./g, ',').toLowerCase();
        const membershipIndexPath = `Companies/${companyEmail}/topicGroupChatMembership/${currentTopic}/${userKey}/${selectedContact.groupId}`;
        const membershipSnap = await get(ref(database, membershipIndexPath));
        if (!membershipSnap.exists()) {
          alert('You do not have access to this group chat.');
          return;
        }

        // Get user name
        let userName = userEmail.split('@')[0];
        try {
          const userEmailFormatted = userEmail.replace(/\./g, ',');
          const userData = await getFirebaseData(`Companies/${companyEmail}/users/${userEmailFormatted}`);
          if (userData && userData.name) userName = userData.name;
          else if (userData && userData.firstName && userData.lastName) userName = `${userData.firstName} ${userData.lastName}`;
        } catch (_) { }

        const blocksToSend = [...workingBlocks];
        if (hasCurrentText) {
          blocksToSend.push({ type: composerMode === 'code' ? 'code' : 'text', text: String(inputValue || '') });
        }
        const messagePlainText = blocksToPlainText(blocksToSend);

        const timestamp = Date.now();
        const message = {
          text: messagePlainText,
          blocks: blocksToSend,
          email: userEmail,
          name: userName,
          timestamp: new Date(timestamp).toISOString(),
          messageId: String(timestamp),
          reactions: {},
          editedAt: null,
          isScheduled: false,
          attachment: attachedHighlight && attachedHighlight.text ? { type: 'highlight', text: attachedHighlight.text, highlightId: attachedHighlight.highlightId || null } : null,
          replyTo: replyingTo ? {
            messageId: replyingTo.messageId,
            text: replyingTo.text,
            name: replyingTo.name,
            email: replyingTo.email
          } : null,
          threadId: activeThread?.threadId || null,
          threadParentId: activeThread?.parentMessageId || null
        };

        const messagesPath = `Companies/${companyEmail}/topicGroupChatMessages/${currentTopic}/${selectedContact.groupId}/${timestamp}`;
        await set(ref(database, messagesPath), message);

        const lastMessage = {
          text: messagePlainText,
          timestamp: message.timestamp,
          email: userEmail,
          name: userName,
        };
        await Promise.all([
          set(
            ref(database, `Companies/${companyEmail}/topicGroupChats/${currentTopic}/${selectedContact.groupId}/lastMessage`),
            lastMessage
          ),
          set(
            ref(database, `Companies/${companyEmail}/topicGroupChats/${currentTopic}/${selectedContact.groupId}/updatedAt`),
            Date.now()
          ),
        ]);

        setInputValue('');
        setComposerBlocks([]);
        setReplyingTo(null);
        setEditingMessage(null);
        setAttachedHighlight(null);
        updateContactMessagePreview(selectedContact, message);
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      } catch (error) {
        console.error('Error sending group message:', error);
        alert('Failed to send message. Please try again.');
      }
      return;
    }

    const blocksToSend = [...workingBlocks];
    if (hasCurrentText) {
      blocksToSend.push({ type: composerMode === 'code' ? 'code' : 'text', text: String(inputValue || '') });
    }

    const messagePlainText = blocksToPlainText(blocksToSend);

    // If editing, update the message instead of sending new one
    if (editingMessage) {
      await handleUpdateMessage(editingMessage, messagePlainText);
      return;
    }

    try {
      const userEmail = auth.currentUser?.email;
      if (!userEmail) {
        alert('You must be logged in to send messages');
        return;
      }

      // Get user name from Firebase (same as extension)
      let userName = userEmail.split('@')[0]; // Fallback
      try {
        const companyEmailForName = await getResolvedCompanyEmail();
        if (companyEmailForName) {
          const userEmailFormatted = userEmail.replace(/\./g, ',');
          const userData = await getFirebaseData(`Companies/${companyEmailForName}/users/${userEmailFormatted}`);
          if (userData && userData.name) {
            userName = userData.name;
          } else if (userData && userData.firstName && userData.lastName) {
            userName = `${userData.firstName} ${userData.lastName}`;
          }
        }
      } catch (e) {
        console.warn('Could not fetch user name, using fallback:', e);
      }

      const companyEmail = await getResolvedCompanyEmail();
      if (!companyEmail) {
        alert('Unable to determine company email');
        return;
      }

      const contactEmail = selectedContact.isEveryone ? 'everyone' : (selectedContact.email || selectedContact.emailKey?.replace(/,/g, '.'));
      if (!contactEmail) {
        console.error('handleSendMessage: Contact email is undefined', selectedContact);
        alert('Unable to determine contact email');
        return;
      }

      const emailPair = await getEmailPair(contactEmail);
      if (!emailPair) {
        console.error('handleSendMessage: Failed to get email pair');
        alert('Failed to create email pair');
        return;
      }

      const timestamp = Date.now();
      const message = {
        text: messagePlainText,
        blocks: blocksToSend,
        email: userEmail,
        name: userName,
        timestamp: new Date(timestamp).toISOString(),
        messageId: String(timestamp),
        reactions: {},
        editedAt: null,
        isScheduled: false,
        attachment: attachedHighlight && attachedHighlight.text ? { type: 'highlight', text: attachedHighlight.text, highlightId: attachedHighlight.highlightId || null } : null,
        replyTo: replyingTo ? {
          messageId: replyingTo.messageId,
          text: replyingTo.text,
          name: replyingTo.name,
          email: replyingTo.email
        } : null,
        threadId: activeThread?.threadId || null,
        threadParentId: activeThread?.parentMessageId || null
      };

      // Membership check (same as original send)
      const userEmailFormatted = userEmail.replace(/\./g, ',');
      const membershipPath = `Companies/${companyEmail}/projects/${currentProject}/members/${userEmailFormatted}`;
      const membershipRef = ref(database, membershipPath);
      const membershipSnapshot = await get(membershipRef);
      if (!membershipSnapshot.exists()) {
        alert('You must be a project member to send messages. Please contact the project owner to be added.');
        return;
      }

      const messagesPath = emailPair === 'everyone'
        ? `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}/${timestamp}`
        : `privateMessages/${emailPair}/${companyEmail}/${currentProject}/${currentTopic}/${timestamp}`;

      await set(ref(database, messagesPath), message);

      // Clear input and reply state
      setInputValue('');
      setComposerBlocks([]);
      setReplyingTo(null);
      setEditingMessage(null);
      setAttachedHighlight(null);

      // Update contact preview in the contacts list
      updateContactMessagePreview(selectedContact, message);

      // Auto-scroll to bottom
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleUpdateMessage = async (message, newText) => {
    if (!message || !selectedContact || !currentProject || !currentTopic) return;

    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      alert('You must be logged in to edit messages');
      return;
    }

    if (message.email !== userEmail) {
      alert('You can only edit your own messages');
      return;
    }

    try {
      const companyEmail = await getResolvedCompanyEmail();
      if (!companyEmail) {
        alert('Unable to determine company email');
        return;
      }

      if (selectedContact.isGroupChat && selectedContact.groupId) {
        const messageId = String(message.messageId);
        const messagePath = `Companies/${companyEmail}/topicGroupChatMessages/${currentTopic}/${selectedContact.groupId}/${messageId}`;
        const updatedMessage = {
          ...message,
          text: String(newText || '').trim(),
          editedAt: new Date().toISOString()
        };
        await set(ref(database, messagePath), updatedMessage);
        setInputValue('');
        setEditingMessage(null);
        return;
      }

      const contactEmail = selectedContact.isEveryone ? 'everyone' : (selectedContact.email || selectedContact.emailKey?.replace(/,/g, '.'));
      if (!contactEmail) {
        alert('Unable to determine contact email');
        return;
      }

      const emailPair = await getEmailPair(contactEmail);
      if (!emailPair) {
        alert('Failed to create email pair');
        return;
      }

      const userEmailFormatted = userEmail.replace(/\./g, ',');
      const membershipPath = `Companies/${companyEmail}/projects/${currentProject}/members/${userEmailFormatted}`;
      const membershipSnapshot = await get(ref(database, membershipPath));
      if (!membershipSnapshot.exists()) {
        alert('You must be a project member to edit messages.');
        return;
      }

      const messageId = String(message.messageId);
      const messagePath = emailPair === 'everyone'
        ? `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}/${messageId}`
        : `privateMessages/${emailPair}/${companyEmail}/${currentProject}/${currentTopic}/${messageId}`;

      const updatedMessage = {
        ...message,
        text: String(newText || '').trim(),
        editedAt: new Date().toISOString()
      };

      await set(ref(database, messagePath), updatedMessage);

      setInputValue('');
      setEditingMessage(null);
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Failed to edit message. Please try again.');
    }
  };

  const openThread = async (parentMessage) => {
    if (!parentMessage || !selectedContact || !currentProject || !currentTopic) return;

    mainDraftRef.current = inputValue;
    try {
      if (messagesScrollContainerRef.current) {
        mainScrollTopRef.current = messagesScrollContainerRef.current.scrollTop;
      }
    } catch (_) { }

    setEditingMessage(null);
    setReplyingTo(null);

    const threadId = String(parentMessage.messageId);
    setActiveThread({ threadId, parentMessageId: String(parentMessage.messageId) });
    setInputValue(threadDraftRef.current || '');

    try {
      const companyEmail = await getResolvedCompanyEmail();
      if (!companyEmail) return;

      if (selectedContact.isGroupChat && selectedContact.groupId) {
        const metaPath = `Companies/${companyEmail}/topicGroupChatThreads/${currentTopic}/${selectedContact.groupId}/${threadId}`;
        const metaRef = ref(database, metaPath);
        const existing = await get(metaRef);
        if (!existing.exists()) {
          await set(metaRef, {
            parentMessageId: threadId,
            createdAt: Date.now(),
            createdByEmail: auth.currentUser?.email || null
          });
        }
        return;
      }

      const contactEmail = selectedContact.isEveryone ? 'everyone' : (selectedContact.email || selectedContact.emailKey?.replace(/,/g, '.'));
      const emailPair = await getEmailPair(contactEmail);
      if (!companyEmail || !emailPair) return;
      const metaPath = emailPair === 'everyone'
        ? `Companies/${companyEmail}/securedProjects/${currentProject}/messageThreads/${currentTopic}/${emailPair}/${threadId}`
        : `privateMessageThreads/${emailPair}/${companyEmail}/${currentProject}/${currentTopic}/${threadId}`;
      const metaRef = ref(database, metaPath);
      const existing = await get(metaRef);
      if (!existing.exists()) {
        await set(metaRef, {
          parentMessageId: threadId,
          createdAt: Date.now(),
          createdByEmail: auth.currentUser?.email || null
        });
      }
    } catch (_) {
      // Best-effort
    }

    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      }
    }, 0);
  };

  const closeThread = () => {
    threadDraftRef.current = inputValue;
    setEditingMessage(null);
    setReplyingTo(null);
    setActiveThread(null);
    setInputValue(mainDraftRef.current || '');

    setTimeout(() => {
      try {
        if (messagesScrollContainerRef.current) {
          messagesScrollContainerRef.current.scrollTop = mainScrollTopRef.current || 0;
        }
      } catch (_) { }
    }, 0);
  };

  // Update contact message preview in the contacts list
  const updateContactMessagePreview = (contact, newMessage) => {
    if (!contact || !newMessage) return;

    setContacts(prevContacts => {
      return prevContacts.map(c => {
        // Match by email or emailKey
        const isMatch = c.email === contact.email ||
          (contact.emailKey && c.emailKey === contact.emailKey) ||
          (contact.isEveryone && c.isEveryone);

        if (isMatch) {
          return {
            ...c,
            message: newMessage // Update with the new message
          };
        }
        return c;
      });
    });
  };

  // Set up real-time message preview listeners for all contacts
  const setupMessagePreviewListeners = async (contactsList) => {
    // Clean up existing listeners first
    Object.values(messagePreviewListeners.current).forEach((listeners) => {
      // Handle new structure with primary/secondary
      if (listeners.primary) {
        if (listeners.primary.ref && listeners.primary.listener) {
          off(listeners.primary.ref, 'value', listeners.primary.listener);
        }
      }
      if (listeners.secondary) {
        if (listeners.secondary.ref && listeners.secondary.listener) {
          off(listeners.secondary.ref, 'value', listeners.secondary.listener);
        }
      }
      // Handle old structure (backward compatibility)
      if (listeners.ref && listeners.listener) {
        off(listeners.ref, 'value', listeners.listener);
      }
    });
    messagePreviewListeners.current = {};

    if (!contactsList || contactsList.length === 0) return;
    if (!currentProject || !currentTopic) return;

    const userEmail = auth.currentUser?.email;
    if (!userEmail) return;

    const companyEmail = await getResolvedCompanyEmail();
    if (!companyEmail) return;

    // Set up listener for each contact
    for (const contact of contactsList) {
      if (contact.isEveryone) continue; // Skip "everyone" for now

      if (contact.isGroupChat && contact.groupId) {
        try {
          const groupMetaRef = ref(database, `Companies/${companyEmail}/topicGroupChats/${currentTopic}/${contact.groupId}/lastMessage`);
          const groupListener = (snapshot) => {
            const lastMessage = snapshot.val();
            if (lastMessage && typeof lastMessage === 'object') {
              updateContactMessagePreview(contact, lastMessage);
            }
          };
          onValue(groupMetaRef, groupListener);
          messagePreviewListeners.current[`group:${contact.groupId}`] = { primary: { ref: groupMetaRef, listener: groupListener } };
        } catch (error) {
          console.error(`Error setting up group preview listener for ${contact.groupId}:`, error);
        }
        continue;
      }

      try {
        const contactEmail = contact.email || contact.emailKey?.replace(/,/g, '.');
        if (!contactEmail) continue;

        const emailPair = await getEmailPair(contactEmail);
        if (!emailPair) continue;

        // Use privateMessages path for 1-on-1 conversations (truly private, cross-company)
        // Use company path for "everyone" messages (project-wide announcements)
        // SECURITY: Include ownerCompany in path for Firebase rules to verify specific project membership
        let primaryPath;
        let secondaryPath = null;
        let legacyPath = null;
        if (emailPair === 'everyone') {
          primaryPath = `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
        } else {
          // New secure path with ownerCompany
          primaryPath = `privateMessages/${emailPair}/${companyEmail}/${currentProject}/${currentTopic}`;
          // Legacy path without ownerCompany (for backward compatibility)
          legacyPath = `privateMessages/${emailPair}/${currentProject}/${currentTopic}`;
          // Company path (for very old messages)
          secondaryPath = `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
        }

        // Store latest message from both paths
        let latestMessageFromPaths = null;

        const updatePreviewFromData = (data, isPrimary) => {
          if (data) {
            // Convert Firebase object to array
            const messagesArray = Object.entries(data).map(([key, msg]) => {
              if (msg && !msg.messageId) {
                msg.messageId = String(key);
              }
              return msg;
            });

            // Filter out thread replies
            const mainMessages = messagesArray.filter(msg => !msg.threadId);

            if (mainMessages.length > 0) {
              // Sort by timestamp to get the most recent
              mainMessages.sort((a, b) => {
                const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return timeB - timeA; // Most recent first
              });

              const latest = mainMessages[0];
              // Update if this is newer than what we have
              if (!latestMessageFromPaths ||
                (latest.timestamp && latestMessageFromPaths.timestamp &&
                  new Date(latest.timestamp).getTime() > new Date(latestMessageFromPaths.timestamp).getTime())) {
                latestMessageFromPaths = latest;
                updateContactMessagePreview(contact, latest);
              }
            }
          }
        };

        // Set up listener for primary path (new secure path with ownerCompany)
        const primaryRef = ref(database, primaryPath);
        const primaryListener = (snapshot) => {
          updatePreviewFromData(snapshot.val(), true);
        };
        onValue(primaryRef, primaryListener);

        const listeners = { primary: { ref: primaryRef, listener: primaryListener } };

        // Set up listener for legacy path (old messages without ownerCompany)
        if (legacyPath) {
          const legacyRef = ref(database, legacyPath);
          const legacyListener = (snapshot) => {
            updatePreviewFromData(snapshot.val(), false);
          };
          onValue(legacyRef, legacyListener);
          listeners.legacy = { ref: legacyRef, listener: legacyListener };
        }

        // Set up listener for secondary path (very old messages in company path)
        if (secondaryPath) {
          const secondaryRef = ref(database, secondaryPath);
          const secondaryListener = (snapshot) => {
            updatePreviewFromData(snapshot.val(), false);
          };
          onValue(secondaryRef, secondaryListener);
          listeners.secondary = { ref: secondaryRef, listener: secondaryListener };
        }

        messagePreviewListeners.current[contactEmail] = listeners;
      } catch (error) {
        console.error(`Error setting up message preview listener for ${contact.email}:`, error);
      }
    }
  };

  // Handle back button - return to contacts list
  const handleBackClick = () => {
    setShowProfilePage(false);
    setSelectedContact(null);
    setInputValue(''); // Reset input when going back
    setComposerBlocks([]);
    setComposerMode('text');
    setShowPlusMenu(false); // Reset plus menu state
    setShowMessageSearch(false); // Hide message search
    setMessageSearchTerm(''); // Clear message search
    setMessageSearchResults([]);
    setCurrentMatchIndex(-1);

    // Clean up messages listeners (primary, secondary, and legacy)
    if (messagesListenerRef.current) {
      off(messagesListenerRef.current.ref, 'value', messagesListenerRef.current.listener);
      messagesListenerRef.current = null;
    }
    setMessages([]);
    currentMessagesPathRef.current = '';
  };

  // Scroll to a specific match
  const scrollToMatch = (index) => {
    if (index < 0 || index >= messageSearchResults.length) return;
    const messageIndex = messageSearchResults[index];
    const messageId = messages[messageIndex]?.messageId || messageIndex;
    const messageRef = messageSearchRefs.current[messageId];
    if (messageRef) {
      messageRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Navigate to next match
  const goToNextMatch = () => {
    if (messageSearchResults.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % messageSearchResults.length;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(nextIndex);
  };

  // Navigate to previous match
  const goToPreviousMatch = () => {
    if (messageSearchResults.length === 0) return;
    const prevIndex = currentMatchIndex <= 0
      ? messageSearchResults.length - 1
      : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIndex);
    scrollToMatch(prevIndex);
  };

  // Search messages (secure - only searches already loaded messages)
  useEffect(() => {
    const trimmedSearch = messageSearchTerm.trim();
    if (!trimmedSearch || !messages.length) {
      setMessageSearchResults([]);
      setCurrentMatchIndex(-1);
      return;
    }

    // Normalize search term: remove extra whitespace and convert to lowercase
    const searchLower = trimmedSearch.toLowerCase().replace(/\s+/g, ' ').trim();

    const results = messages
      .map((message, index) => {
        if (!message.text) return { message, index, matches: false };

        // Normalize message text: remove extra whitespace for better matching
        const messageText = message.text.toLowerCase().replace(/\s+/g, ' ').trim();

        // Security: Only search in message text (already filtered by Firebase rules)
        // Check for substring match in normalized text
        const matches = messageText.includes(searchLower);

        return { message, index, matches };
      })
      .filter(result => result.matches)
      .map(result => result.index);

    setMessageSearchResults(results);
    if (results.length > 0) {
      setCurrentMatchIndex(0);
      // Scroll to first match
      setTimeout(() => {
        scrollToMatch(0);
      }, 100);
    } else {
      setCurrentMatchIndex(-1);
    }
  }, [messageSearchTerm, messages]);

  // Reload messages when topic or selected contact changes
  useEffect(() => {
    if (showProfilePage && selectedContact && currentTopic && currentProject) {
      loadMessagesForContact(selectedContact);
    }
  }, [currentTopic, currentProject, showProfilePage, selectedContact?.email]);

  // Cleanup all listeners on unmount or when contacts/project/topic changes
  useEffect(() => {
    return () => {
      // Clean up selected chat listener
      if (messagesListenerRef.current) {
        off(messagesListenerRef.current.ref, 'value', messagesListenerRef.current.listener);
        messagesListenerRef.current = null;
      }

      // Clean up all message preview listeners
      Object.values(messagePreviewListeners.current).forEach((listeners) => {
        // Handle new structure with primary/secondary/legacy
        if (listeners.primary) {
          if (listeners.primary.ref && listeners.primary.listener) {
            off(listeners.primary.ref, 'value', listeners.primary.listener);
          }
        }
        if (listeners.legacy) {
          if (listeners.legacy.ref && listeners.legacy.listener) {
            off(listeners.legacy.ref, 'value', listeners.legacy.listener);
          }
        }
        if (listeners.secondary) {
          if (listeners.secondary.ref && listeners.secondary.listener) {
            off(listeners.secondary.ref, 'value', listeners.secondary.listener);
          }
        }
        // Handle old structure (backward compatibility)
        if (listeners.ref && listeners.listener) {
          off(listeners.ref, 'value', listeners.listener);
        }
      });
      messagePreviewListeners.current = {};
    };
  }, [currentProject, currentTopic]);

  // Profile Page View
  if (showProfilePage && selectedContact) {
    const contactStatus = contactStatuses[selectedContact.email] || 'offline';
    const statusLabel = getPresenceLabel(contactStatus);
    const hasText = inputValue.trim().length > 0;
    const shouldShowIcons = true; // Always show icons

    const isThreadView = Boolean(activeThread?.threadId);
    const threadParentMessage = isThreadView
      ? (allMessages.find((m) => m && m.messageId === activeThread.threadId) || messages.find((m) => m && m.messageId === activeThread.threadId) || null)
      : null;
    const threadReplies = isThreadView
      ? allMessages.filter((m) => m && m.threadId === activeThread.threadId)
        .sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB;
        })
      : [];
    const visibleMessages = isThreadView ? threadReplies : messages;

    const composerExpandedHeight = '200px';
    const composerCollapsedHeight = '104px';
    const highlightPreviewMaxHeight = '148px';
    const composerBottomReservePx = 58;
    const highlightMaxHeightInComposer = `calc(${composerExpandedHeight} - ${composerBottomReservePx}px)`;

    const composerBoxStyle = {
      flex: 1,
      minWidth: 0,
      position: 'relative',
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      overflow: 'hidden',
      flexShrink: 0
    };

    const previewsWrapStyle = {
      overflowX: 'hidden',
      overflowY: 'hidden',
      // Reserve space below for textarea + footer controls.
      maxHeight: attachedHighlight?.text ? highlightMaxHeightInComposer : '96px',
      marginBottom: '6px',
      flexShrink: 0,
      flex: 1,
      minHeight: 0
    };

    const attachedHighlightCardStyle = {
      padding: '10px 12px',
      backgroundColor: '#f7f7f8',
      border: '1px solid #e5e7eb',
      borderLeft: '3px solid #6b7280',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      flexShrink: 0,
      marginBottom: replyingTo ? '10px' : 0,
      maxHeight: '100%',
      overflowY: 'auto',
      scrollbarWidth: 'thin'
    };

    return (
      <div className="messages-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <style>{`
          /* Hide scrollbars but keep scrolling functionality for Messages component */
          .messages-container * {
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
          }
          .messages-container *::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera */
          }

          .schedule-modal {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.35);
            z-index: 9999;
          }

          .schedule-modal-content {
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            width: 100%;
            max-width: 320px;
            border: 1px solid #f0f0f0;
            overflow: visible;
          }

          .schedule-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px 12px 20px;
            border-bottom: 1px solid #f5f5f5;
            position: relative;
            background: #ffffff;
            border-radius: 12px 12px 0 0;
          }

          .schedule-modal-title {
            font-size: 13px;
            font-weight: 600;
            color: #8a8a8a;
            letter-spacing: -0.01em;
          }

          .schedule-modal-close {
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            cursor: pointer;
            padding: 8px;
            border-radius: 8px;
            color: #b0b0b0;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
          }

          .schedule-modal-close:hover {
            background: #f8f8f8;
            color: #9a9a9a;
          }

          .schedule-modal-body {
            padding: 16px 20px;
            background: #ffffff;
          }

          .schedule-modal-footer {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            padding: 12px 20px 16px 20px;
            border-top: 1px solid #f5f5f5;
            background: #ffffff;
            border-radius: 0 0 12px 12px;
          }

          .schedule-datetime-section {
            display: flex;
            gap: 10px;
          }

          .schedule-label {
            display: block;
            font-size: 12px;
            color: #b0b0b0;
            font-weight: 500;
            margin-bottom: 6px;
          }

          .schedule-input {
            padding: 10px 12px;
            border: 1px solid #e8e8e8;
            border-radius: 8px;
            font-size: 13px;
            background: #ffffff;
            color: #8a8a8a;
            transition: all 0.2s ease;
            width: 100%;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            outline: none;
          }

          .schedule-input:focus {
            outline: none;
            border-color: #b0b0b0;
            box-shadow: 0 0 0 2px rgba(176, 176, 176, 0.1);
          }

          .schedule-btn {
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
            min-width: 70px;
          }

          .schedule-btn-cancel {
            background: #f8f8f8;
            color: #9a9a9a;
            border: 1px solid #e8e8e8;
          }

          .schedule-btn-cancel:hover {
            background: #f0f0f0;
            color: #8a8a8a;
            border-color: #d8d8d8;
          }

          .schedule-btn-confirm {
            background: #a0a0a0;
            color: #ffffff;
            font-weight: 500;
          }

          .schedule-btn-confirm:hover {
            background: #909090;
          }

          .schedule-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .schedule-validation-message {
            padding: 8px 12px;
            border-radius: 8px;
            margin-top: 12px;
            font-size: 12px;
            font-weight: 500;
          }
        `}</style>
        <div style={{
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: '#ffffff'
        }}>
          {/* Microsoft Teams Style Header */}
          <div style={{
            padding: '8px 16px',
            borderBottom: '1px solid #edebe9',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#ffffff',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            minHeight: '56px'
          }}>
            {/* Left: Back Button */}
            <button
              onClick={isThreadView ? closeThread : handleBackClick}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#323130',
                padding: '8px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.1s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                width: '32px',
                height: '32px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f2f1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={isThreadView ? 'Back to messages' : 'Back'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Center: Avatar + Name + Presence */}
            <div
              onClick={() => handleContactClick(selectedContact)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                minWidth: 0
              }}
            >
              {/* Avatar with Presence Indicator */}
              <div style={{
                position: 'relative',
                flexShrink: 0
              }}>
                {selectedContact.isEveryone ? (
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#edebe9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 48 48"
                      style={{ color: '#605e5c' }}
                    >
                      <path fill="currentColor" d="M11.5 11a3.5 3.5 0 1 1 7 0a3.5 3.5 0 0 1-7 0ZM15 5a6 6 0 1 0 0 12a6 6 0 0 0 0-12Zm14.5 6a3.5 3.5 0 1 1 7 0a3.5 3.5 0 0 1-7 0ZM33 5a6 6 0 1 0 0 12a6 6 0 0 0 0-12ZM4 22.446A3.446 3.446 0 0 1 7.446 19h9.624a7.947 7.947 0 0 0-.93 2.5H7.446a.946.946 0 0 0-.946.946v.429c0 .27.003 1.933 1.019 3.505c.896 1.388 2.723 2.92 6.684 3.102a5.469 5.469 0 0 0-2.464 2.223c-3.222-.632-5.18-2.203-6.32-3.968C4 25.54 4 23.27 4 22.877v-.43Zm29.797 7.036a5.469 5.469 0 0 1 2.464 2.223c3.222-.632 5.18-2.203 6.32-3.968C44 25.54 44 23.27 44 22.877v-.43A3.446 3.446 0 0 0 40.554 19H30.93c.44.763.76 1.605.93 2.5h8.694c.522 0 .946.424.946.946v.429c0 .27-.003 1.933-1.019 3.505c-.896 1.388-2.723 2.92-6.684 3.102ZM24 19.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7ZM18 23a6 6 0 1 1 12 0a6 6 0 0 1-12 0Zm-5 11.446A3.446 3.446 0 0 1 16.446 31h15.108A3.446 3.446 0 0 1 35 34.446v.431c0 .394 0 2.663-1.419 4.86C32.098 42.033 29.233 44 24 44s-8.098-1.967-9.581-4.263C13 37.54 13 35.27 13 34.877v-.431Z" />
                    </svg>
                  </div>
                ) : selectedContact.isGroupChat ? (
                  <div style={{ width: '48px', height: '48px', position: 'relative', flexShrink: 0 }}>
                    {(() => {
                      const keys = Array.isArray(selectedContact.memberPreviewKeys) ? selectedContact.memberPreviewKeys : [];
                      const stack = keys.slice(0, 3);
                      const size = 30;
                      const offsets = [0, 12, 24];
                      const colors = ['#e5e7eb', '#d1d5db', '#cbd5e1'];

                      if (stack.length === 0) {
                        return (
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            backgroundColor: '#f3f4f6',
                            border: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6b7280',
                            fontWeight: 700
                          }}>
                            G
                          </div>
                        );
                      }

                      return (
                        <div style={{ width: '48px', height: '48px', position: 'relative' }}>
                          {stack.map((k, i) => {
                            const emailKey = String(k || '').toLowerCase();
                            const cached = groupAvatarCache ? groupAvatarCache[emailKey] : null;
                            const displayName = cached?.name || `${cached?.firstName || ''} ${cached?.lastName || ''}`.trim() || String(emailKey).replace(/,/g, '.');
                            const initials = (() => {
                              const first = String(cached?.firstName || '').trim();
                              const last = String(cached?.lastName || '').trim();
                              if (first && last) return (first[0] + last[0]).toUpperCase();
                              if (displayName) {
                                const parts = String(displayName).trim().split(' ').filter(Boolean);
                                if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                                return String(displayName).charAt(0).toUpperCase();
                              }
                              return 'U';
                            })();
                            const profileImage = cached?.profileImage || null;

                            return (
                              <div
                                key={`${selectedContact.groupId || selectedContact.email}-header-stack-${k}-${i}`}
                                style={{
                                  position: 'absolute',
                                  left: offsets[i],
                                  top: offsets[i] / 2,
                                  width: `${size}px`,
                                  height: `${size}px`,
                                  borderRadius: '50%',
                                  backgroundColor: '#e5e7eb',
                                  border: '2px solid #ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  boxSizing: 'border-box',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                                title={displayName}
                              >
                                {profileImage ? (
                                  <img
                                    src={profileImage}
                                    alt={displayName}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    onError={(e) => {
                                      try {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling;
                                        if (fallback) fallback.style.display = 'flex';
                                      } catch (_) { }
                                    }}
                                    onLoad={(e) => {
                                      try {
                                        e.currentTarget.style.display = 'block';
                                        const fallback = e.currentTarget.nextElementSibling;
                                        if (fallback) fallback.style.display = 'none';
                                      } catch (_) { }
                                    }}
                                  />
                                ) : null}
                                <div style={{
                                  display: profileImage ? 'none' : 'flex',
                                  width: '100%',
                                  height: '100%',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: `hsl(${String(emailKey || 'U').charCodeAt(0) * 10 % 360}, 60%, 70%)`,
                                  color: 'white',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  lineHeight: '1',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0
                                }}>
                                  {initials}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div
                    title={selectedContact.name}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      border: '1px solid #edebe9',
                      overflow: 'hidden',
                      backgroundColor: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={selectedContact.profileImage || ''}
                      alt={selectedContact.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: selectedContact.profileImage ? 'block' : 'none'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                      onLoad={(e) => {
                        e.currentTarget.style.display = 'block';
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) fallback.style.display = 'none';
                      }}
                    />
                    <div style={{
                      display: selectedContact.profileImage ? 'none' : 'flex',
                      width: '100%',
                      height: '100%',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: `hsl(${String(selectedContact.email || 'U').charCodeAt(0) * 10 % 360}, 60%, 70%)`,
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      position: 'absolute',
                      top: 0,
                      left: 0
                    }}>
                      {(() => {
                        const firstInitial = selectedContact.firstName && selectedContact.firstName.trim()
                          ? selectedContact.firstName.trim()[0].toUpperCase()
                          : '';
                        const lastInitial = selectedContact.lastName && selectedContact.lastName.trim()
                          ? selectedContact.lastName.trim()[0].toUpperCase()
                          : '';
                        if (firstInitial && lastInitial) {
                          return firstInitial + lastInitial;
                        } else if (firstInitial) {
                          return firstInitial + firstInitial;
                        }
                        return 'U';
                      })()}
                    </div>
                  </div>
                )}
                {/* Presence Status Indicator - uses same contactStatus as text below */}
                {!selectedContact.isEveryone && !selectedContact.isGroupChat && (
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '0px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: getPresenceColor(contactStatus),
                    border: '2px solid white',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }} title={statusLabel} />
                )}
              </div>

              {/* Name and Presence Text */}
              <div style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2px'
              }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#111827',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {isThreadView ? 'Thread' : (selectedContact ? getContactDisplayName(selectedContact) : 'Messages')}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {isThreadView
                    ? (threadParentMessage?.name || threadParentMessage?.email?.split('@')[0] || 'Parent message')
                    : (selectedContact?.isEveryone
                      ? 'Project-wide announcements'
                      : (contactStatuses[selectedContact?.emailKey] || { status: 'offline', lastSeenAt: null }).label)
                  }
                </div>
              </div>
            </div>

            {/* Right: Action Icons */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0
            }}>
              {/* Search Icon */}
              <button
                onClick={() => {
                  setShowMessageSearch(!showMessageSearch);
                  if (!showMessageSearch) {
                    setTimeout(() => {
                      if (messageSearchInputRef.current) {
                        messageSearchInputRef.current.focus();
                      }
                    }, 100);
                  } else {
                    setMessageSearchTerm('');
                    setMessageSearchResults([]);
                    setCurrentMatchIndex(-1);
                  }
                }}
                style={{
                  background: showMessageSearch ? '#f3f2f1' : 'transparent',
                  border: 'none',
                  color: showMessageSearch ? '#323130' : '#605e5c',
                  padding: '8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background-color 0.1s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px'
                }}
                onMouseEnter={(e) => {
                  if (!showMessageSearch) {
                    e.currentTarget.style.backgroundColor = '#f3f2f1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showMessageSearch) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                title="Search messages"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </button>

              {/* More Options Icon */}
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#605e5c',
                  padding: '8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background-color 0.1s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f2f1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="More options"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </button>
            </div>
          </div>

          {showScheduleModal && (
            <div
              className="schedule-modal"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeScheduleModal();
              }}
            >
              <div className="schedule-modal-content">
                <div className="schedule-modal-header">
                  <span className="schedule-modal-title">Schedule Message</span>
                  <button className="schedule-modal-close" onClick={closeScheduleModal} title="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>

                <div className="schedule-modal-body">
                  <div className="schedule-datetime-section">
                    <div style={{ flex: 1 }}>
                      <label className="schedule-label" htmlFor="schedule-date">Date</label>
                      <input
                        id="schedule-date"
                        type="date"
                        className="schedule-input"
                        value={scheduleDate}
                        onChange={(e) => {
                          const v = e.target.value;
                          setScheduleDate(v);
                          validateScheduleTime(v, scheduleTime);
                        }}
                        required
                      />
                    </div>

                    <div style={{ flex: 1 }}>
                      <label className="schedule-label" htmlFor="schedule-time">Time</label>
                      <input
                        id="schedule-time"
                        type="time"
                        className="schedule-input"
                        value={scheduleTime}
                        onChange={(e) => {
                          const v = e.target.value;
                          setScheduleTime(v);
                          validateScheduleTime(scheduleDate, v);
                        }}
                        required
                      />
                    </div>
                  </div>

                  {scheduleValidationMessage ? (
                    <div
                      className="schedule-validation-message"
                      style={{
                        display: 'block',
                        backgroundColor: scheduleValidationMessage.startsWith('Message scheduled') ? '#ecfdf5' : '#fef2f2',
                        color: scheduleValidationMessage.startsWith('Message scheduled') ? '#065f46' : '#b91c1c',
                        border: scheduleValidationMessage.startsWith('Message scheduled') ? '1px solid #a7f3d0' : '1px solid #fecaca'
                      }}
                    >
                      {scheduleValidationMessage}
                    </div>
                  ) : null}
                </div>

                <div className="schedule-modal-footer">
                  <button className="schedule-btn schedule-btn-cancel" onClick={closeScheduleModal}>
                    Cancel
                  </button>
                  <button
                    className="schedule-btn schedule-btn-confirm"
                    onClick={handleConfirmSchedule}
                    disabled={(() => {
                      if (!scheduleDate || !scheduleTime) return false;
                      const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
                      return scheduledDateTime <= new Date();
                    })()}
                  >
                    Schedule
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Message Search Bar */}
          {showMessageSearch && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0
            }}>
              <div style={{
                position: 'relative',
                flex: 1,
                display: 'flex',
                alignItems: 'center'
              }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af',
                    pointerEvents: 'none',
                    zIndex: 1
                  }}
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input
                  ref={messageSearchInputRef}
                  type="text"
                  placeholder="Search messages..."
                  value={messageSearchTerm}
                  onChange={(e) => setMessageSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (e.shiftKey) {
                        goToPreviousMatch();
                      } else {
                        goToNextMatch();
                      }
                    } else if (e.key === 'Escape') {
                      setShowMessageSearch(false);
                      setMessageSearchTerm('');
                      setMessageSearchResults([]);
                      setCurrentMatchIndex(-1);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 36px',
                    border: 'none',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(229, 231, 235, 0.5)',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }}
                  onBlur={(e) => {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }}
                />
              </div>
              {messageSearchResults.length > 0 && (
                <div style={{
                  fontSize: '13px',
                  color: '#605e5c',
                  whiteSpace: 'nowrap',
                  paddingRight: '8px'
                }}>
                  {currentMatchIndex + 1} of {messageSearchResults.length}
                </div>
              )}
            </div>
          )}

          {/* Messages content area */}
          <div
            ref={messagesScrollContainerRef}
            style={{
              flex: '1 1 auto',
              padding: '16px 12px',
              overflowY: 'auto',
              backgroundColor: '#ffffff',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              position: 'relative'
            }}>
            {isThreadView && threadParentMessage && (
              <div style={{
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                backgroundColor: '#fafafa',
                marginBottom: '12px'
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  {threadParentMessage.name || threadParentMessage.email?.split('@')[0] || 'User'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', color: '#111827' }}>
                  {threadParentMessage.text || ''}
                </div>
              </div>
            )}

            {isLoadingMessages ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                flex: 1,
                padding: '60px 20px',
                minHeight: 0
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  border: '3px solid #e5e7eb',
                  borderTopColor: '#0078d4',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '16px'
                }}></div>
                <div style={{
                  color: '#6b7280',
                  fontSize: '15px',
                  fontWeight: 500
                }}>
                  Loading messages...
                </div>
              </div>
            ) : visibleMessages.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                flex: '1 1 auto',
                padding: '60px 20px',
                minHeight: 0,
                textAlign: 'center'
              }}>
                {/* Message Icon */}
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px'
                }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>

                {/* Main Message */}
                <div style={{
                  color: '#111827',
                  fontSize: '18px',
                  fontWeight: 600,
                  marginBottom: '8px'
                }}>
                  {isThreadView ? 'No replies yet' : 'No messages yet'}
                </div>

                {/* Subtitle */}
                <div style={{
                  color: '#6b7280',
                  fontSize: '14px',
                  maxWidth: '320px',
                  lineHeight: '1.5',
                  marginBottom: '24px'
                }}>
                  {isThreadView ? 'Be the first to reply in this thread' : 'Start the conversation by sending a message below'}
                </div>

                {/* Hint */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#9ca3af',
                  fontSize: '12px',
                  padding: '8px 12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px'
                }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>Type your message in the input below</span>
                </div>
              </div>
            ) : messageSearchTerm && messageSearchResults.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                flex: 1,
                padding: '60px 20px',
                textAlign: 'center'
              }}>
                {/* Search Icon */}
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                </div>

                {/* Main Message */}
                <div style={{
                  color: '#111827',
                  fontSize: '17px',
                  fontWeight: 600,
                  marginBottom: '8px'
                }}>
                  No messages found
                </div>

                {/* Search Term */}
                <div style={{
                  color: '#6b7280',
                  fontSize: '14px',
                  maxWidth: '320px',
                  lineHeight: '1.5'
                }}>
                  No messages match <span style={{ fontWeight: 600, color: '#374151' }}>"{messageSearchTerm}"</span>
                </div>
              </div>
            ) : (
              (() => {
                const currentUserEmail = auth.currentUser?.email;
                const hasMissedSince = typeof missedSinceTs === 'number' && !Number.isNaN(missedSinceTs);
                const missedDividerIndex = (hasMissedSince && currentUserEmail)
                  ? messages.findIndex((m) => {
                    if (!m?.timestamp) return false;
                    if (m.email === currentUserEmail) return false;
                    const ts = new Date(m.timestamp).getTime();
                    return ts > missedSinceTs;
                  })
                  : -1;

                return visibleMessages.map((message, index) => {
                  const isCurrentUser = message.email === auth.currentUser?.email;
                  const messageDate = message.timestamp ? new Date(message.timestamp) : null;
                  const messageId = message.messageId || index;
                  const isMatch = messageSearchResults.includes(index);
                  const isCurrentMatch = isMatch && currentMatchIndex >= 0 && messageSearchResults[currentMatchIndex] === index;
                  const isHovered = hoveredMessageId === messageId;
                  const isBeingEdited = editingMessage?.messageId === messageId;
                  const isPendingScheduled = Boolean(message.isScheduled && isCurrentUser);

                  // Check if we should show timestamp (show for first message or if time gap is significant)
                  const prevMessage = index > 0 ? visibleMessages[index - 1] : null;
                  const prevMessageDate = prevMessage?.timestamp ? new Date(prevMessage.timestamp) : null;
                  const showTimestamp = !prevMessageDate ||
                    (messageDate && prevMessageDate &&
                      (messageDate.getTime() - prevMessageDate.getTime() > 5 * 60 * 1000)); // 5 minutes gap

                  // Check if we should show date separator (different day from previous message)
                  const showDateSeparator = index === 0 || (messageDate && prevMessageDate && isDifferentDay(messageDate, prevMessageDate));

                  // Check if this message is part of a group (same sender as previous message)
                  const prevIsCurrentUser = prevMessage?.email === auth.currentUser?.email;
                  const isGrouped = prevMessage &&
                    prevIsCurrentUser === isCurrentUser &&
                    !showDateSeparator &&
                    (!showTimestamp || (messageDate && prevMessageDate &&
                      (messageDate.getTime() - prevMessageDate.getTime() <= 2 * 60 * 1000))); // 2 minutes for grouping

                  return (
                    <React.Fragment key={messageId}>
                      {!isThreadView && missedDividerIndex >= 0 && index === missedDividerIndex && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          width: '100%',
                          margin: '12px 0',
                          padding: '0 12px'
                        }}>
                          <div style={{ flex: 1, height: '1px', backgroundColor: '#fecaca' }}></div>
                          <div style={{
                            padding: '0 12px',
                            fontSize: '12px',
                            color: '#991b1b',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                          }}>
                            Missed messages
                          </div>
                          <div style={{ flex: 1, height: '1px', backgroundColor: '#fecaca' }}></div>
                        </div>
                      )}
                      {/* Date Separator */}
                      {!isThreadView && showDateSeparator && messageDate && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          width: '100%',
                          margin: '16px 0',
                          padding: '0 12px'
                        }}>
                          <div style={{
                            flex: 1,
                            height: '1px',
                            backgroundColor: '#e5e7eb'
                          }}></div>
                          <div style={{
                            padding: '0 12px',
                            fontSize: '12px',
                            color: '#6b7280',
                            fontWeight: 500,
                            whiteSpace: 'nowrap'
                          }}>
                            {formatDateSeparator(messageDate)}
                          </div>
                          <div style={{
                            flex: 1,
                            height: '1px',
                            backgroundColor: '#e5e7eb'
                          }}></div>
                        </div>
                      )}

                      <div
                        ref={(el) => {
                          if (el) {
                            messageSearchRefs.current[messageId] = el;
                          }
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isCurrentUser ? 'flex-end' : 'flex-start',
                          width: '100%',
                          padding: '0 12px',
                          boxSizing: 'border-box',
                          marginBottom: isGrouped ? '2px' : '8px',
                          marginTop: showTimestamp && prevMessage ? '10px' : '0px',
                          scrollMarginTop: '80px',
                          position: 'relative'
                        }}
                      >
                        {/* Timestamp above message */}
                        {showTimestamp && messageDate && !selectedContact?.isEveryone && !selectedContact?.isGroupChat && !(message.isScheduled && isCurrentUser) && (
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            marginBottom: '8px',
                            padding: 0,
                            textAlign: isCurrentUser ? 'right' : 'left',
                            fontVariantNumeric: 'tabular-nums',
                            alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
                            maxWidth: '78%'
                          }}>
                            {formatTime(messageDate)}
                          </div>
                        )}

                        {message.isScheduled && isCurrentUser && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: '#c2410c',
                            backgroundColor: '#fff7ed',
                            border: '1px solid #ffedd5',
                            borderRadius: '999px',
                            padding: '2px 8px',
                            marginBottom: '6px'
                          }}>
                            {formatScheduledForLabel(message.scheduledAt)}
                          </div>
                        )}

                        {(() => {
                          const userKey = (auth.currentUser?.email || '').replace(/\./g, ',');
                          const reactionEntries = (!message.isScheduled ? QUICK_REACTIONS
                            .map((emoji) => {
                              const users = (message.reactions && message.reactions[emoji]) ? message.reactions[emoji] : null;
                              const count = users ? Object.keys(users).length : 0;
                              return { emoji, count, hasReacted: Boolean(users && users[userKey]) };
                            })
                            .filter((x) => x.count > 0) : []);

                          return (
                            <div style={{
                              display: 'flex',
                              flexDirection: isCurrentUser ? 'row-reverse' : 'row',
                              alignItems: 'flex-end',
                              justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
                              gap: '10px',
                              maxWidth: '78%',
                              alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
                              marginBottom: reactionEntries.length > 0 ? '16px' : 0
                            }}>
                              {(selectedContact?.isEveryone || selectedContact?.isGroupChat) && !isCurrentUser && (
                                <div style={{
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: '50%',
                                  backgroundColor: !isGrouped && getMessageSenderProfileImage(message)
                                    ? 'transparent'
                                    : `hsl(${String((isCurrentUser ? auth.currentUser?.email : message.email) || 'u').charCodeAt(0) * 10 % 360}, 65%, 65%)`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  border: '1px solid #e5e7eb',
                                  flexShrink: 0,
                                  visibility: isGrouped ? 'hidden' : 'visible'
                                }}>
                                  {!isGrouped && getMessageSenderProfileImage(message) ? (
                                    <img
                                      src={getMessageSenderProfileImage(message)}
                                      alt={(isCurrentUser ? getCurrentUserDisplayName() : getMessageSenderDisplayName(message)) || 'User'}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <span style={{
                                      color: '#ffffff',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      letterSpacing: '0.4px',
                                      textTransform: 'uppercase',
                                      lineHeight: '1'
                                    }}>
                                      {(() => {
                                        const n = isCurrentUser ? getCurrentUserDisplayName() : getMessageSenderDisplayName(message);
                                        if (n) {
                                          const parts = String(n).trim().split(' ').filter(Boolean);
                                          if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                                          return String(n).charAt(0).toUpperCase();
                                        }
                                        const e = String((isCurrentUser ? auth.currentUser?.email : message.email) || 'U');
                                        return e.charAt(0).toUpperCase();
                                      })()}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div
                                style={{
                                  position: 'relative',
                                  width: '100%',
                                  maxWidth: '100%',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: isCurrentUser ? 'flex-end' : 'flex-start',
                                  minWidth: 0
                                }}
                                onMouseEnter={() => {
                                  cancelHoverClear();
                                  setHoveredMessageId(messageId);
                                }}
                                onMouseLeave={() => {
                                  scheduleHoverClear();
                                }}
                              >
                                {(selectedContact?.isEveryone || selectedContact?.isGroupChat) && !isGrouped && (
                                  <div style={{
                                    fontSize: '12px',
                                    fontWeight: 400,
                                    color: '#6b7280',
                                    marginBottom: '4px',
                                    textAlign: isCurrentUser ? 'right' : 'left',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'normal'
                                  }}>
                                    <span style={{
                                      fontWeight: 400,
                                      color: '#6b7280'
                                    }}>
                                      {isCurrentUser
                                        ? (getMessageSenderDisplayName(message) || getCurrentUserDisplayName() || 'User')
                                        : (getMessageSenderDisplayName(message) || 'User')}
                                    </span>
                                    <span style={{
                                      fontWeight: 400,
                                      color: '#6b7280',
                                      marginLeft: '8px'
                                    }}>
                                      {messageDate && formatTime(messageDate)}
                                    </span>
                                  </div>
                                )}
                                <div
                                  style={{
                                    padding: '8px 14px',
                                    borderRadius: isGrouped ? (isCurrentUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px') : '12px',
                                    backgroundColor: isPendingScheduled
                                      ? '#fff7ed'
                                      : (isCurrentUser ? (isBeingEdited ? '#e0e0e0' : '#0078d4') : '#f3f4f6'),
                                    border: isPendingScheduled ? '1px solid #ffedd5' : 'none',
                                    color: isPendingScheduled
                                      ? '#111827'
                                      : (isCurrentUser ? '#ffffff' : '#111827'),
                                    fontSize: '14px',
                                    lineHeight: '1.4',
                                    wordWrap: 'break-word',
                                    display: 'inline-block',
                                    position: 'relative',
                                    opacity: isBeingEdited ? 0.6 : 1,
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  {/* Reply Preview - show if this message is a reply */}
                                  {message.replyTo && (
                                    <div
                                      style={{
                                        marginBottom: '10px',
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => {
                                        // Scroll to the replied message
                                        const repliedMessage = visibleMessages.find(m => m.messageId === message.replyTo.messageId);
                                        if (repliedMessage) {
                                          const repliedIndex = visibleMessages.indexOf(repliedMessage);
                                          if (messageSearchRefs.current[repliedMessage.messageId || repliedIndex]) {
                                            messageSearchRefs.current[repliedMessage.messageId || repliedIndex].scrollIntoView({
                                              behavior: 'smooth',
                                              block: 'center'
                                            });
                                          }
                                        }
                                      }}
                                      title="Click to jump to original message"
                                    >
                                      {/* Label row */}
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        letterSpacing: '0.2px',
                                        color: isCurrentUser ? 'rgba(255, 255, 255, 0.85)' : '#6b7280',
                                        marginBottom: '6px'
                                      }}>
                                        <svg
                                          width="12"
                                          height="12"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          style={{
                                            color: isCurrentUser ? 'rgba(255, 255, 255, 0.75)' : '#9ca3af',
                                            flexShrink: 0
                                          }}
                                        >
                                          <polyline points="9 17 4 12 9 7"></polyline>
                                          <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                                        </svg>
                                        <span style={{ whiteSpace: 'nowrap' }}>
                                          Replying to {message.replyTo.name || message.replyTo.email?.split('@')[0] || 'User'}
                                        </span>
                                      </div>

                                      {/* Quoted block */}
                                      <div style={{
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        border: isCurrentUser ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(0, 0, 0, 0.06)',
                                        backgroundColor: isCurrentUser ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.04)',
                                        borderLeft: isCurrentUser ? '3px solid rgba(255, 255, 255, 0.35)' : '3px solid rgba(17, 24, 39, 0.18)'
                                      }}>
                                        <div style={{
                                          fontSize: '12px',
                                          fontWeight: 600,
                                          color: isCurrentUser ? 'rgba(255, 255, 255, 0.9)' : '#374151',
                                          marginBottom: '2px',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {message.replyTo.name || message.replyTo.email?.split('@')[0] || 'User'}
                                        </div>
                                        <div style={{
                                          fontSize: '12px',
                                          color: isCurrentUser ? 'rgba(255, 255, 255, 0.78)' : '#6b7280',
                                          lineHeight: '1.35',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {message.replyTo.text}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {message.attachment?.type === 'highlight' && message.attachment?.text && (
                                    <div
                                      style={{
                                        display: 'block',
                                        marginBottom: (message.attachment?.type === 'document' && message.attachment?.docId) || message.text ? '8px' : 0,
                                        backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.12)' : '#f7f7f8',
                                        border: isCurrentUser ? '1px solid rgba(255,255,255,0.18)' : '1px solid #e5e7eb',
                                        borderLeft: isCurrentUser ? '3px solid rgba(255,255,255,0.55)' : '3px solid #6b7280',
                                        borderRadius: '10px',
                                        padding: '10px 12px'
                                      }}
                                    >
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        color: isCurrentUser ? 'rgba(255,255,255,0.9)' : '#6b7280',
                                        marginBottom: '6px'
                                      }}>
                                        <span style={{ lineHeight: 1 }}>📎</span>
                                        <span>Attached highlight</span>
                                      </div>
                                      <div style={{
                                        fontSize: '13px',
                                        lineHeight: 1.45,
                                        color: isCurrentUser ? 'rgba(255,255,255,0.9)' : '#374151',
                                        fontStyle: 'italic',
                                        whiteSpace: 'pre-wrap'
                                      }}>
                                        {`"${String(message.attachment.text)}"`}
                                      </div>
                                    </div>
                                  )}

                                  {message.attachment?.type === 'document' && message.attachment?.docId && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.12)' : '#ffffff',
                                        border: isCurrentUser ? '1px solid rgba(255,255,255,0.18)' : '1px solid #e5e7eb',
                                        cursor: 'pointer',
                                        marginBottom: message.text ? '8px' : 0
                                      }}
                                      onClick={async () => {
                                        try {
                                          const companyEmail = await getResolvedCompanyEmail();
                                          const contactEmail = selectedContact?.isEveryone
                                            ? 'everyone'
                                            : (selectedContact?.email || selectedContact?.emailKey?.replace(/,/g, '.'));
                                          if (!companyEmail || !currentProject || !currentTopic || !contactEmail) return;
                                          const emailPair = await getEmailPair(contactEmail);
                                          if (!emailPair) return;
                                          const docPath = `Companies/${companyEmail}/securedProjects/${currentProject}/documents/${currentTopic}/${emailPair}/${message.attachment.docId}`;
                                          const snap = await get(ref(database, docPath));
                                          if (snap.exists()) {
                                            const doc = snap.val();
                                            if (doc?.dataUrl) openDataUrlInNewTab(doc.dataUrl);
                                          }
                                        } catch (_) {
                                          // Best-effort
                                        }
                                      }}
                                    >
                                      <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.18)' : '#f3f4f6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: isCurrentUser ? 'rgba(255,255,255,0.9)' : '#374151'
                                      }}>
                                        {(message.attachment.extension || 'FILE').slice(0, 4)}
                                      </div>
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{
                                          fontSize: '13px',
                                          fontWeight: 600,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {message.attachment.name || 'Attachment'}
                                        </div>
                                        <div style={{
                                          fontSize: '12px',
                                          opacity: isCurrentUser ? 0.85 : 0.7
                                        }}>
                                          {(message.attachment.extension || 'FILE')} • {formatFileSize(message.attachment.size)}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Toolbar - show for all messages on hover */}
                                  {isHovered && !isBeingEdited && (!message.isScheduled || (isCurrentUser && message.scheduledId)) && (
                                    <div style={{
                                      position: 'absolute',
                                      top: '-40px',
                                      right: isCurrentUser ? 0 : 'auto',
                                      left: isCurrentUser ? 'auto' : 0,
                                      display: 'flex',
                                      gap: '2px',
                                      backgroundColor: '#ffffff',
                                      border: '1px solid #e5e7eb',
                                      borderRadius: '12px',
                                      padding: '6px',
                                      zIndex: 10,
                                      opacity: 1
                                    }}
                                      onMouseEnter={() => {
                                        cancelHoverClear();
                                        setHoveredMessageId(messageId);
                                      }}
                                      onMouseLeave={() => {
                                        scheduleHoverClear();
                                      }}
                                    >
                                      {message.isScheduled && isCurrentUser && message.scheduledId && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openRescheduleModal(message.scheduledId, message);
                                          }}
                                          style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '6px 8px',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#6b7280',
                                            transition: 'all 0.15s ease',
                                            minWidth: '32px',
                                            height: '32px'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                                            e.currentTarget.style.color = '#374151';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.color = '#6b7280';
                                          }}
                                          title="Reschedule"
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <polyline points="12 6 12 12 16 14"></polyline>
                                          </svg>
                                        </button>
                                      )}

                                      {!message.isScheduled && QUICK_REACTIONS.map((emoji) => {
                                        const userKey = (auth.currentUser?.email || '').replace(/\./g, ',');
                                        const hasReacted = Boolean(message.reactions && message.reactions[emoji] && message.reactions[emoji][userKey]);
                                        return (
                                          <button
                                            key={emoji}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleReaction(message, emoji);
                                            }}
                                            style={{
                                              background: hasReacted ? '#f3f4f6' : 'transparent',
                                              border: 'none',
                                              cursor: 'pointer',
                                              padding: '6px 8px',
                                              borderRadius: '6px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              color: '#111827',
                                              transition: 'all 0.15s ease',
                                              minWidth: '32px',
                                              height: '32px',
                                              fontSize: '16px',
                                              lineHeight: 1
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.backgroundColor = hasReacted ? '#e5e7eb' : '#f3f4f6';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.backgroundColor = hasReacted ? '#f3f4f6' : 'transparent';
                                            }}
                                            title={`React ${emoji}`}
                                          >
                                            {emoji}
                                          </button>
                                        );
                                      })}

                                      {!message.isScheduled && (
                                        <>
                                          {/* Thread Button - available for all messages */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openThread(message);
                                            }}
                                            style={{
                                              background: 'transparent',
                                              border: 'none',
                                              cursor: 'pointer',
                                              padding: '6px 8px',
                                              borderRadius: '6px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              color: '#6b7280',
                                              transition: 'all 0.15s ease',
                                              minWidth: '32px',
                                              height: '32px'
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.backgroundColor = '#f3f4f6';
                                              e.currentTarget.style.color = '#374151';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.backgroundColor = 'transparent';
                                              e.currentTarget.style.color = '#6b7280';
                                            }}
                                            title="Thread"
                                          >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
                                            </svg>
                                          </button>

                                          {/* Reply Button - available for all messages */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              startReply(message);
                                            }}
                                            style={{
                                              background: 'transparent',
                                              border: 'none',
                                              cursor: 'pointer',
                                              padding: '6px 8px',
                                              borderRadius: '6px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              color: '#6b7280',
                                              transition: 'all 0.15s ease',
                                              minWidth: '32px',
                                              height: '32px'
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.backgroundColor = '#f3f4f6';
                                              e.currentTarget.style.color = '#374151';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.backgroundColor = 'transparent';
                                              e.currentTarget.style.color = '#6b7280';
                                            }}
                                            title="Reply"
                                          >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <polyline points="9 17 4 12 9 7"></polyline>
                                              <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                                            </svg>
                                          </button>

                                          {/* Copy Button - only for current user's messages */}
                                          {isCurrentUser && (
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                  await navigator.clipboard.writeText(message.text || '');
                                                  // Show temporary feedback
                                                  const btn = e.currentTarget;
                                                  const originalTitle = btn.getAttribute('title');
                                                  btn.setAttribute('title', 'Copied!');
                                                  setTimeout(() => {
                                                    btn.setAttribute('title', originalTitle);
                                                  }, 2000);
                                                } catch (err) {
                                                  console.error('Failed to copy:', err);
                                                }
                                              }}
                                              style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '6px 8px',
                                                borderRadius: '6px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#6b7280',
                                                transition: 'all 0.15s ease',
                                                minWidth: '32px',
                                                height: '32px'
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                                e.currentTarget.style.color = '#374151';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = '#6b7280';
                                              }}
                                              title="Copy message"
                                            >
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                              </svg>
                                            </button>
                                          )}

                                          {/* Edit Button - only for current user's messages */}
                                          {isCurrentUser && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                startEditMessage(message);
                                              }}
                                              style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '6px 8px',
                                                borderRadius: '6px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#6b7280',
                                                transition: 'all 0.15s ease',
                                                minWidth: '32px',
                                                height: '32px'
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                                e.currentTarget.style.color = '#374151';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = '#6b7280';
                                              }}
                                              title="Edit"
                                            >
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 20h9"></path>
                                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                                              </svg>
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}

                                  <div style={{ whiteSpace: 'pre-wrap' }}>
                                    {(() => {
                                      const blocks = getMessageBlocks(message);
                                      if (!blocks) {
                                        const t = message.text || '';
                                        return messageSearchTerm && String(t).toLowerCase().includes(messageSearchTerm.toLowerCase())
                                          ? highlightText(String(t), messageSearchTerm, isCurrentMatch)
                                          : t;
                                      }

                                      return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                          {blocks.map((b, idx) => {
                                            const content = String(b.text || '');
                                            if (b.type === 'code') {
                                              return (
                                                <div
                                                  key={`${messageId}-block-${idx}`}
                                                  style={{
                                                    backgroundColor: '#0b1220',
                                                    border: '1px solid rgba(148, 163, 184, 0.25)',
                                                    borderRadius: '10px',
                                                    padding: '10px 12px',
                                                    overflowX: 'auto'
                                                  }}
                                                >
                                                  <pre style={{
                                                    margin: 0,
                                                    whiteSpace: 'pre',
                                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                                    fontSize: '13px',
                                                    lineHeight: '1.55',
                                                    color: '#e5e7eb'
                                                  }}>
                                                    {content}
                                                  </pre>
                                                </div>
                                              );
                                            }

                                            return (
                                              <div key={`${messageId}-block-${idx}`} style={{ whiteSpace: 'pre-wrap' }}>
                                                {messageSearchTerm && content.toLowerCase().includes(messageSearchTerm.toLowerCase())
                                                  ? highlightText(content, messageSearchTerm, isCurrentMatch)
                                                  : content}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  {!isThreadView && (() => {
                                    const threadId = message.messageId;
                                    const replyCountFromMsgs = allMessages.filter((m) => m && m.threadId === threadId).length;
                                    const metaExists = Boolean(threadMetas && threadMetas[threadId]);
                                    const replyCount = replyCountFromMsgs;
                                    if (!metaExists && replyCount <= 0) return null;

                                    return (
                                      <div
                                        onClick={() => openThread(message)}
                                        style={{
                                          marginTop: '8px',
                                          fontSize: '12px',
                                          fontWeight: 600,
                                          color: isCurrentUser ? 'rgba(255, 255, 255, 0.9)' : '#2563eb',
                                          cursor: 'pointer',
                                          userSelect: 'none'
                                        }}
                                        title="Open thread"
                                      >
                                        {replyCount > 0 ? `${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}` : 'Thread'}
                                      </div>
                                    );
                                  })()}
                                  {message.editedAt && (
                                    <div style={{
                                      fontSize: '10px',
                                      marginTop: '4px',
                                      opacity: 0.6,
                                      fontStyle: 'italic'
                                    }}>
                                      (edited)
                                    </div>
                                  )}

                                  {reactionEntries.length > 0 && (
                                    <div style={{
                                      position: 'absolute',
                                      right: '10px',
                                      bottom: '-16px',
                                      display: 'flex',
                                      gap: '6px',
                                      flexWrap: 'nowrap',
                                      pointerEvents: 'auto'
                                    }}>
                                      {reactionEntries.map(({ emoji, count, hasReacted }) => (
                                        <button
                                          key={emoji}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleReaction(message, emoji);
                                          }}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '3px 8px',
                                            borderRadius: '999px',
                                            backgroundColor: hasReacted ? '#eef2ff' : 'rgba(255, 255, 255, 0.96)',
                                            border: hasReacted ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid rgba(0, 0, 0, 0.10)',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            color: '#111827',
                                            lineHeight: 1,
                                            transform: 'translateY(0px)',
                                            transition: 'transform 120ms ease, background-color 120ms ease'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-1px) scale(1.03)';
                                            if (!hasReacted) e.currentTarget.style.backgroundColor = '#f9fafb';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0px) scale(1)';
                                            e.currentTarget.style.backgroundColor = hasReacted ? '#eef2ff' : 'rgba(255, 255, 255, 0.96)';
                                          }}
                                          title="Toggle reaction"
                                        >
                                          <span style={{ fontSize: '14px', lineHeight: 1 }}>{emoji}</span>
                                          <span style={{ fontWeight: 600, color: '#6b7280' }}>{count}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </React.Fragment>
                  );
                });
              })()
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar - Professional ChatGPT-style */}
          <div style={{
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            flexShrink: 0,
            flexGrow: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            width: '100%',
            // Let the composer grow upward (the composer box itself already has a maxHeight)
            overflow: 'visible'
          }}>
            {/* Edit Mode Indicator */}
            {editingMessage && (
              <div style={{
                padding: '8px 16px',
                backgroundColor: '#fef3c7',
                borderBottom: '1px solid #fde68a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: '#92400e'
              }}>
                <span>✏️ Editing message</span>
                <button
                  onClick={cancelEdit}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#92400e',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textDecoration: 'underline',
                    padding: '4px 8px'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            <div style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '0px',
              position: 'relative'
            }}>
              {/* Message Input Field - Full Width */}
              <div
                ref={composerBoxRef}
                style={{
                  ...composerBoxStyle,
                  // Let the composer grow upwards with content, but cap it to keep footer controls visible.
                  minHeight: composerCollapsedHeight,
                  maxHeight: (attachedHighlight?.text || replyingTo) ? composerExpandedHeight : composerCollapsedHeight,
                  height: (attachedHighlight?.text || replyingTo) ? composerExpandedHeight : composerCollapsedHeight
                }}>
                {/* Previews area (scrolls independently so footer icons stay visible) */}
                {(attachedHighlight?.text || replyingTo) && (
                  <div
                    style={previewsWrapStyle}
                  >
                    {attachedHighlight && attachedHighlight.text && (
                      <div style={attachedHighlightCardStyle}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px'
                        }}>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#6b7280',
                            fontSize: '12px',
                            fontWeight: 700
                          }}>
                            <span style={{ lineHeight: 1 }}>📎</span>
                            <span>Attached highlight</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAttachedHighlight(null)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#9ca3af',
                              cursor: 'pointer',
                              padding: '0 4px',
                              fontSize: '16px',
                              lineHeight: 1
                            }}
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                        <div style={{
                          fontSize: '13px',
                          lineHeight: 1.4,
                          color: '#374151',
                          fontStyle: 'italic',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {`"${attachedHighlight.text}"`}
                        </div>
                      </div>
                    )}

                    {/* Reply Preview Indicator - Inside Chat Box */}
                    {replyingTo && (
                      <div style={{
                        padding: '10px 12px',
                        backgroundColor: '#fafafa',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        flexShrink: 0
                      }}>
                        {/* Top Row: Sender name + timestamp | Close button */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flex: 1,
                            minWidth: 0
                          }}>
                            <span style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              color: '#111827'
                            }}>
                              {replyingTo.name || replyingTo.email?.split('@')[0] || 'User'}
                            </span>
                            {replyingTo.timestamp && (
                              <span style={{
                                fontSize: '12px',
                                color: '#9ca3af',
                                fontWeight: 400
                              }}>
                                {formatReplyTimestamp(replyingTo.timestamp)}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={cancelReply}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#9ca3af',
                              cursor: 'pointer',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              fontSize: '18px',
                              lineHeight: '1',
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f3f4f6';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            title="Cancel reply"
                          >
                            ×
                          </button>
                        </div>

                        {/* Bottom Row: Quoted message text */}
                        <div style={{
                          fontSize: '13px',
                          color: '#6b7280',
                          lineHeight: '1.4',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          paddingRight: '24px'
                        }}>
                          {replyingTo.text}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{
                  padding: '0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  flexShrink: 0,
                  marginTop: 'auto'
                }}>
                  <div
                    style={composerMode === 'code' ? {
                      backgroundColor: '#0b1220',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      boxSizing: 'border-box',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center'
                    } : undefined}
                  >
                    <textarea
                      ref={composerTextareaRef}
                      className="messages-textarea"
                      placeholder={editingMessage ? "Edit your message..." : replyingTo ? "Type your reply..." : (attachedHighlight?.text ? "" : "Message")}
                      value={inputValue}
                      autoCorrect={composerMode === 'code' ? 'off' : 'on'}
                      autoCapitalize={composerMode === 'code' ? 'none' : 'sentences'}
                      spellCheck={composerMode !== 'code'}
                      onFocus={() => {
                        wasComposerFocusedRef.current = true;
                      }}
                      onBlur={() => {
                        wasComposerFocusedRef.current = false;
                      }}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setInputValue(nextValue);

                        // If input is empty, snap back to the compact single-line composer immediately.
                        if (!nextValue.trim()) {
                          resetComposerLayout();
                          return;
                        }
                        const textarea = e.target;
                        textarea.style.height = 'auto';
                        const maxTextareaHeight = 128; // leave room for footer row inside the box
                        const maxContainerHeight = 220;
                        const scrollHeight = textarea.scrollHeight;
                        const newHeight = Math.min(scrollHeight, maxTextareaHeight);
                        textarea.style.height = `${newHeight}px`;

                        if (scrollHeight > maxTextareaHeight) {
                          textarea.style.overflowY = 'auto';
                        } else {
                          textarea.style.overflowY = 'hidden';
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (hasText) {
                            handleSendMessage();
                          }
                        }
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        fontSize: '15px',
                        fontFamily: composerMode === 'code' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : 'system-ui, -apple-system, sans-serif',
                        color: composerMode === 'code' ? '#e5e7eb' : '#111827',
                        caretColor: composerMode === 'code' ? '#e5e7eb' : '#111827',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: 0,
                        lineHeight: '1.5',
                        padding: 0,
                        margin: 0,
                        overflowX: 'hidden',
                        overflowY: 'auto',
                        maxHeight: '128px',
                        minHeight: '24px'
                      }}
                      rows={1}
                    />
                  </div>

                  {/* Footer Icons Row - Inside Text Box */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '6px',
                    flexShrink: 0
                  }}>
                    {composerMode === 'code' && (
                      <div style={{
                        marginRight: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        backgroundColor: '#fff7ed',
                        border: '1px solid #ffedd5',
                        color: '#c2410c',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        <span>Code block</span>
                        <button
                          type="button"
                          onClick={() => toggleComposerMode('text')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#c2410c',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: '14px',
                            lineHeight: '1'
                          }}
                          title="Exit code mode"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {/* Plus Icon (Attachments) with Menu */}
                    <div ref={plusMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="*/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          sendAttachmentFiles(e.target?.files);
                          setShowPlusMenu(false);
                          if (e.target) e.target.value = '';
                        }}
                      />
                      <button
                        onClick={() => {
                          setShowPlusMenu(!showPlusMenu);
                        }}
                        style={{
                          background: showPlusMenu ? '#f3f4f6' : 'transparent',
                          border: 'none',
                          color: showPlusMenu ? '#374151' : '#6b7280',
                          padding: '6px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          if (!showPlusMenu) {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.color = '#374151';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!showPlusMenu) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#6b7280';
                          }
                        }}
                        title="More options"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </button>

                      {/* Plus Menu Dropdown */}
                      <div
                        className="plus-menu"
                        style={{
                          position: 'absolute',
                          right: 0,
                          bottom: '44px',
                          width: '220px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '10px',
                          boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                          padding: '6px',
                          zIndex: 50,
                          display: showPlusMenu ? 'block' : 'none'
                        }}
                      >
                        {/* Attach File Option */}
                        <button
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#111827',
                            fontSize: '14px',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowPlusMenu(false);
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ flexShrink: 0, color: '#6b7280' }}
                          >
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.82l8.49-8.48" />
                          </svg>
                          <span>Attach file</span>
                        </button>

                        {/* Code Block Option */}
                        <button
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#111827',
                            fontSize: '14px',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => {
                            setShowPlusMenu(false);
                            toggleComposerMode('code');
                            try {
                              setTimeout(() => composerTextareaRef.current?.focus(), 0);
                            } catch (_) { }
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ flexShrink: 0, color: '#6b7280' }}
                          >
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                          </svg>
                          <span>Code block</span>
                        </button>

                        {/* Schedule Send Option - Always show */}
                        <button
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#111827',
                            fontSize: '14px',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => {
                            setShowPlusMenu(false);
                            openScheduleModalWithDefaults();
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ flexShrink: 0, color: '#6b7280' }}
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          <span>Schedule send</span>
                        </button>
                      </div>
                    </div>

                    {/* Microphone Icon */}
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#6b7280',
                        padding: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#6b7280';
                      }}
                      title="Voice message"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" y1="19" x2="12" y2="23"></line>
                        <line x1="8" y1="23" x2="16" y2="23"></line>
                      </svg>
                    </button>

                    {/* Rich Text Icon */}
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#6b7280',
                        padding: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#6b7280';
                      }}
                      title="Rich text"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 20h16"></path>
                        <path d="M6 16l6-12 6 12"></path>
                        <path d="M8 12h8"></path>
                      </svg>
                    </button>

                    {/* Send Icon */}
                    <button
                      onClick={handleSendMessage}
                      disabled={!hasText}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: hasText ? '#111827' : '#6b7280',
                        padding: '6px',
                        borderRadius: '6px',
                        cursor: hasText ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        flexShrink: 0,
                        opacity: hasText ? 1 : 0.6
                      }}
                      onMouseEnter={(e) => {
                        if (hasText) {
                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                          e.currentTarget.style.color = '#111827';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (hasText) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#111827';
                        }
                      }}
                      title="Send"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Contacts List View
  return (
    <div className="messages-container" style={{
      padding: '12px',
      paddingBottom: '72px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative'
    }}>
      {/* Topic Header */}
      <div style={{
        display: 'flex',
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          backgroundColor: '#f3f4f6',
          borderRadius: '20px',
          fontSize: '13px',
          color: '#374151'
        }}>
          <span style={{ color: '#6b7280', fontWeight: 500 }}>Topic:</span>
          <span style={{ fontWeight: 600, color: '#111827' }}>{topicTitle}</span>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{
        position: 'relative',
        marginBottom: '12px'
      }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9ca3af',
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 12px 12px 36px',
            border: 'none',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            fontSize: '14px',
            outline: 'none',
            transition: 'all 0.2s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(229, 231, 235, 0.5)',
            boxSizing: 'border-box'
          }}
          onFocus={(e) => {
            e.target.style.backgroundColor = '#f3f4f6';
          }}
          onBlur={(e) => {
            e.target.style.backgroundColor = '#f3f4f6';
          }}
        />
      </div>

      {/* Contacts List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0'
      }}>
        {isLoading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px 20px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e5e7eb',
              borderTopColor: '#0078d4',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px'
            }}></div>
            <div style={{
              color: '#6b7280',
              fontSize: '15px',
              fontWeight: 500
            }}>
              Loading contacts...
            </div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px 20px',
            textAlign: 'center'
          }}>
            {/* Contacts Icon */}
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>

            {/* Main Message */}
            <div style={{
              color: '#111827',
              fontSize: '17px',
              fontWeight: 600,
              marginBottom: '8px'
            }}>
              {searchTerm ? 'No contacts found' : 'No contacts in this project'}
            </div>

            {/* Subtitle */}
            <div style={{
              color: '#6b7280',
              fontSize: '14px',
              maxWidth: '280px',
              lineHeight: '1.5'
            }}>
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Contacts will appear here when they join this project'}
            </div>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <button
              key={contact.email}
              onClick={() => handleContactClick(contact)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                borderBottom: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {/* Avatar */}
              {contact.isEveryone ? (
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 48 48"
                    style={{
                      color: '#6b7280'
                    }}
                  >
                    <path fill="currentColor" d="M11.5 11a3.5 3.5 0 1 1 7 0a3.5 3.5 0 0 1-7 0ZM15 5a6 6 0 1 0 0 12a6 6 0 0 0 0-12Zm14.5 6a3.5 3.5 0 1 1 7 0a3.5 3.5 0 0 1-7 0ZM33 5a6 6 0 1 0 0 12a6 6 0 0 0 0-12ZM4 22.446A3.446 3.446 0 0 1 7.446 19h9.624a7.947 7.947 0 0 0-.93 2.5H7.446a.946.946 0 0 0-.946.946v.429c0 .27.003 1.933 1.019 3.505c.896 1.388 2.723 2.92 6.684 3.102a5.469 5.469 0 0 0-2.464 2.223c-3.222-.632-5.18-2.203-6.32-3.968C4 25.54 4 23.27 4 22.877v-.43Zm29.797 7.036a5.469 5.469 0 0 1 2.464 2.223c3.222-.632 5.18-2.203 6.32-3.968C44 25.54 44 23.27 44 22.877v-.43A3.446 3.446 0 0 0 40.554 19H30.93c.44.763.76 1.605.93 2.5h8.694c.522 0 .946.424.946.946v.429c0 .27-.003 1.933-1.019 3.505c-.896 1.388-2.723 2.92-6.684 3.102ZM24 19.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7ZM18 23a6 6 0 1 1 12 0a6 6 0 0 1-12 0Zm-5 11.446A3.446 3.446 0 0 1 16.446 31h15.108A3.446 3.446 0 0 1 35 34.446v.431c0 .394 0 2.663-1.419 4.86C32.098 42.033 29.233 44 24 44s-8.098-1.967-9.581-4.263C13 37.54 13 35.27 13 34.877v-.431Z" />
                  </svg>
                </div>
              ) : contact.isGroupChat ? (
                <div style={{ width: '40px', height: '40px', position: 'relative', flexShrink: 0 }}>
                  {(() => {
                    const keys = Array.isArray(contact.memberPreviewKeys) ? contact.memberPreviewKeys : [];
                    const stack = keys.slice(0, 3);
                    const size = 24;
                    const offsets = [0, 12, 24];
                    const colors = ['#e5e7eb', '#d1d5db', '#cbd5e1'];
                    if (stack.length === 0) {
                      return (
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '14px',
                          backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#6b7280', fontWeight: 700
                        }}>
                          G
                        </div>
                      );
                    }

                    return (
                      <div style={{ width: '40px', height: '40px', position: 'relative' }}>
                        {stack.map((k, i) => (
                          (() => {
                            const emailKey = String(k || '').toLowerCase();
                            const cached = groupAvatarCache ? groupAvatarCache[emailKey] : null;
                            const displayName = cached?.name || `${cached?.firstName || ''} ${cached?.lastName || ''}`.trim() || String(emailKey).replace(/,/g, '.');
                            const initials = (() => {
                              const first = String(cached?.firstName || '').trim();
                              const last = String(cached?.lastName || '').trim();
                              if (first && last) return (first[0] + last[0]).toUpperCase();
                              if (displayName) {
                                const parts = String(displayName).trim().split(' ').filter(Boolean);
                                if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                                return String(displayName).charAt(0).toUpperCase();
                              }
                              return 'U';
                            })();
                            const profileImage = cached?.profileImage || null;

                            return (
                              <div
                                key={`${contact.groupId || contact.email}-stack-${k}-${i}`}
                                style={{
                                  position: 'absolute',
                                  left: offsets[i],
                                  top: offsets[i] / 2,
                                  width: `${size}px`,
                                  height: `${size}px`,
                                  borderRadius: '50%',
                                  backgroundColor: '#e5e7eb',
                                  border: '2px solid #ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  boxSizing: 'border-box',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                }}
                                title={displayName}
                              >
                                {profileImage ? (
                                  <img
                                    src={profileImage}
                                    alt={displayName}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    onError={(e) => {
                                      try {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling;
                                        if (fallback) fallback.style.display = 'flex';
                                      } catch (_) { }
                                    }}
                                    onLoad={(e) => {
                                      try {
                                        e.currentTarget.style.display = 'block';
                                        const fallback = e.currentTarget.nextElementSibling;
                                        if (fallback) fallback.style.display = 'none';
                                      } catch (_) { }
                                    }}
                                  />
                                ) : null}
                                <div style={{
                                  display: profileImage ? 'none' : 'flex',
                                  width: '100%',
                                  height: '100%',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: `hsl(${String(emailKey || 'U').charCodeAt(0) * 10 % 360}, 60%, 70%)`,
                                  color: 'white',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0
                                }}>
                                  {initials}
                                </div>
                              </div>
                            );
                          })()
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{
                  position: 'relative',
                  flexShrink: 0
                }}>
                  <div
                    title={contact.name}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      backgroundColor: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={contact.profileImage || ''}
                      alt={contact.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: contact.profileImage ? 'block' : 'none'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                      onLoad={(e) => {
                        e.currentTarget.style.display = 'block';
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) fallback.style.display = 'none';
                      }}
                    />
                    <div style={{
                      display: contact.profileImage ? 'none' : 'flex',
                      width: '100%',
                      height: '100%',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: `hsl(${String(contact.email || 'U').charCodeAt(0) * 10 % 360}, 60%, 70%)`,
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      position: 'absolute',
                      top: 0,
                      left: 0
                    }}>
                      {(() => {
                        const firstInitial = contact.firstName && contact.firstName.trim()
                          ? contact.firstName.trim()[0].toUpperCase()
                          : '';
                        const lastInitial = contact.lastName && contact.lastName.trim()
                          ? contact.lastName.trim()[0].toUpperCase()
                          : '';
                        if (firstInitial && lastInitial) {
                          return firstInitial + lastInitial;
                        } else if (firstInitial) {
                          return firstInitial + firstInitial;
                        }
                        return 'U';
                      })()}
                    </div>
                  </div>
                  {/* Presence Status Indicator */}
                  {contactStatuses[contact.email] && !contact.isGroupChat && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '0px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: getPresenceColor(contactStatuses[contact.email]),
                      border: '2px solid white',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }} title={getPresenceLabel(contactStatuses[contact.email])} />
                  )}
                </div>
              )}

              {/* Contact Info */}
              <div style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '4px',
                paddingRight: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: '8px'
                }}>
                  <span style={{
                    fontWeight: 600,
                    color: '#111827',
                    fontSize: '15px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1.3'
                  }}>
                    {getContactDisplayName(contact)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {getContactMissedCount(contact) > 0 && (
                      <span
                        style={{
                          backgroundColor: '#ef4444',
                          color: 'white',
                          borderRadius: '10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          minWidth: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: '1'
                        }}
                      >
                        {getContactMissedCount(contact) > 99 ? '99+' : getContactMissedCount(contact)}
                      </span>
                    )}
                    {contact.message && contact.message.timestamp && (
                      <span style={{
                        fontSize: '11px',
                        color: '#9ca3af',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        fontWeight: 400,
                        lineHeight: '1.3',
                        fontVariantNumeric: 'tabular-nums',
                        minWidth: '96px',
                        textAlign: 'right',
                        display: 'inline-block'
                      }}>
                        {formatTime(contact.message.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
                {contact.message && contact.message.text ? (() => {
                  const preview = extractMessagePreview(contact.message, contact);
                  if (!preview) {
                    return (
                      <div style={{
                        fontSize: '13px',
                        color: '#9ca3af',
                        fontStyle: 'italic',
                        lineHeight: '1.4'
                      }}>
                        No messages yet
                      </div>
                    );
                  }

                  // Truncate text to 50 characters
                  const truncatedText = preview.text.length > 50
                    ? preview.text.substring(0, 50) + '...'
                    : preview.text;

                  return (
                    <div style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: '1.4',
                      fontWeight: 400
                    }}>
                      <span style={{ fontWeight: 500, color: '#4b5563' }}>
                        {preview.sender}:
                      </span>{' '}
                      <span style={{ fontWeight: 400, color: '#6b7280' }}>
                        {truncatedText}
                      </span>
                    </div>
                  );
                })() : (
                  <div style={{
                    fontSize: '13px',
                    color: '#9ca3af',
                    fontStyle: 'italic',
                    lineHeight: '1.4'
                  }}>
                    No messages yet
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <FamilyDrawerRoot
        open={showGroupModal}
        onOpenChange={(next) => setShowGroupModal(Boolean(next))}
      >
        <FamilyDrawerContent scope="parent" zIndexBase={30} maxHeight="70%" showBackdrop={false} captureOutsideClicks={true}>
          {renderGroupDrawer()}
        </FamilyDrawerContent>
      </FamilyDrawerRoot>

      <button
        onClick={() => {
          try {
            window.dispatchEvent(new CustomEvent('phraze:createGroupChat'));
          } catch (_) { }
        }}
        aria-label="Create group chat"
        title="Create group chat"
        style={{
          position: 'absolute',
          right: '14px',
          bottom: '14px',
          width: '44px',
          height: '44px',
          borderRadius: '9999px',
          border: '1px solid rgba(229, 231, 235, 1)',
          background: '#ffffff',
          boxShadow: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 20,
          color: '#111827'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
  );
};

export default Messages;