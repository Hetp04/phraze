import { showFrame, hideAllSubFrames } from './partials/utils.js';
import { getUserName, getMainCompanyEmail, isUserLoggedIn2 } from './partials/auth.js';
import { mainMenu, showToast, callGetItem, sendRuntimeMessage, getUserEmail, getCurrentProject, listenerFirebaseData, removeFirebaseListener } from './frames.js';
import { isOnWebsite } from './globalVariables.js';
import { showEmojiPicker, closeEmojiPicker } from './emoji-picker-init.js';

function showContactList() {
    document.getElementById("contacts-panel-outer").style.display = "flex";
    // document.getElementById("contacts-panel-chooser").style.display = "block";
    // document.getElementById("contacts-panel-messages").style.display = "none";
    document.getElementById("topics-panel").style.width = "50%";
}

async function setCurrentTopic(topic, type, overrideLabel) {
    currentTopic = topic;
    var headerText = "Current Topic: ";
    
    // If this is a groq chat topic, extract and set the chat ID
    if (topic && topic.startsWith("groqChats-")) {
        const chatIdFromTopic = topic.replace("groqChats-", "");
        if (chatIdFromTopic) {
            currentChatId = chatIdFromTopic;
            console.log('[setCurrentTopic] Set currentChatId from topic:', currentChatId);
        }
    }
    
    // Reset the entire messaging state to prevent showing old messages
    resetMessagingState();
    
    if (topic == "general") {
        document.getElementById("messaging-header-right").innerHTML = `${headerText}<b>General</b>`;
    }
    else if (type == "groqChats") {
        // If overrideLabel is provided, use it directly (e.g., when title is updated)
        if (overrideLabel) {
            document.getElementById("messaging-header-right").innerHTML = `${headerText}<b>${overrideLabel}</b>`;
        } else {
            // Otherwise, fetch from Firebase
        var companyEmail = await getMainCompanyEmail();
        var currentProject = await getCurrentProject();
        sendRuntimeMessage({
            action: "getFirebaseData",
            path: `Companies/${companyEmail}/projects/${currentProject}/${currentTopic.replace("-", "/")}/title`
        }, response => {
            if (response && response.success && response.data) {
                document.getElementById("messaging-header-right").innerHTML = `${headerText}<b>${response.data}</b>`;
            }
        });
        }
    }
    else if (type == "manualLogs") {
        document.getElementById("messaging-header-right").innerHTML = `${headerText}<b>${overrideLabel}</b>`;
    }
}

// Helper function to format time in iMessage style
function formatTime(date) {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
        // Today - show time only
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
        // Yesterday
        return 'Yesterday ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else {
        // Other days - show date and time
        return date.toLocaleDateString([], {
            month: 'short',
            day: 'numeric'
        }) + ' ' + date.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
        });
    }
}

// Helper function to format "last reply" time in Slack-like style
function formatLastReplyTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    // Very recent (less than 1 minute)
    if (diffMins < 1) {
        return 'just now';
    }
    
    // Recent (less than 1 hour) - show minutes
    if (diffMins < 60) {
        return `${diffMins}m ago`;
    }
    
    // Today (less than 24 hours)
    if (date.toDateString() === now.toDateString()) {
        const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return `today at ${timeString}`;
    }
    
    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return `yesterday at ${timeString}`;
    }
    
    // Older (show date and time)
    const dateString = date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
    });
    const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${dateString} at ${timeString}`;
}

// Helper function to format date and time for reply cards
function formatDateTime(date) {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    
    if (date.toDateString() === now.toDateString()) {
        // Today - show "Today" and time
        return `Today ${timeString}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
        // Yesterday
        return `Yesterday ${timeString}`;
    } else {
        // Other days - show full date and time
        const dateString = date.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
        return `${dateString} ${timeString}`;
    }
}

async function createMessageElement(message, email) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    
    // Check if this comment is from the current user
    const isMyMessage = message.email === email;
    if (isMyMessage) {
        div.classList.add('my-comment');
    }

    const text = message.text;
    // Ensure we have a consistent messageId - prioritize messageId, then timestamp, then generate new
    let messageId = message.messageId;
    if (!messageId) {
        if (message.timestamp) {
            // Convert timestamp to string if it's a number
            messageId = message.timestamp.toString();
        } else {
            messageId = Date.now().toString();
        }
    }
    
    console.log('Message ID resolved:', messageId, 'from message:', message);
    
    // Add data attribute for easy finding
    div.setAttribute('data-message-id', messageId);

    const editedText = message.editedAt ? ' (edited)' : '';
    // Only show scheduled label if this is the sender's message (my message)
    const scheduledLabel = (message.isScheduled && isMyMessage) ? ' <span class="scheduled-send-label">Scheduled</span>' : '';
    const editIcon = isMyMessage ? `<span class="edit-icon" data-message-id="${messageId}" title="Edit message">✎</span>` : '';
    
    // Create reply context HTML if this message is a reply - integrated into message content
    const replyContextHtml = message.replyTo ? `
        <div class="message-reply-context">
            <div class="reply-context-header">
                <span class="reply-context-author">${message.replyTo.author}</span>
                <span class="reply-context-time">${formatTime(new Date(message.replyTo.timestamp))}</span>
            </div>
            <div class="reply-context-content">${message.replyTo.text}</div>
        </div>
    ` : '';
    
    div.innerHTML = `
        <div class="comment-header">
            <span class="comment-author">${isMyMessage ? 'You' : message.name}</span>
            <span class="comment-time">${formatTime(new Date(message.timestamp))}${editedText}${scheduledLabel}</span>
        </div>
        <div class="comment-text" data-message-id="${messageId}">
            ${replyContextHtml}
        </div>
        <div class="edit-controls" data-message-id="${messageId}" style="display: none;">
            <div class="edit-editor" data-message-id="${messageId}">
                <div class="edit-content" data-message-id="${messageId}" contenteditable="true">${text}</div>
                <div class="rich-text-toolbar edit-toolbar" data-message-id="${messageId}">
                    <button class="icon-btn rich-text-btn" data-action="bold" title="Bold" aria-label="Bold"><span class="icon-bold">B</span></button>
                    <button class="icon-btn rich-text-btn" data-action="italic" title="Italic" aria-label="Italic"><span class="icon-italic">I</span></button>
                    <button class="icon-btn rich-text-btn" data-action="underline" title="Underline" aria-label="Underline"><span class="icon-underline">U</span></button>
                    <div class="text-color-dropdown">
                        <button class="icon-btn rich-text-btn text-color-toggle" title="Text Color" aria-label="Text Color">
                            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15V8a3 3 0 0 1 6 0v7m-6-4h6M5 19h14"/></svg>
                        </button>
                        <div class="text-color-options">
                            <button class="color-option" data-action="textColor" data-color="red" title="Red" style="background-color: #dc2626;"></button>
                            <button class="color-option" data-action="textColor" data-color="blue" title="Blue" style="background-color: #2563eb;"></button>
                            <button class="color-option" data-action="textColor" data-color="green" title="Green" style="background-color: #16a34a;"></button>
                        </div>
                    </div>
                    <div class="highlight-dropdown">
                        <button class="icon-btn rich-text-btn highlight-toggle" title="Highlight" aria-label="Highlight">
                            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2.5 1a.5.5 0 0 1 .5.5v3a.5.5 0 0 0 .5.5h9.002a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 1 1 0v3a1.5 1.5 0 0 1-1.001 1.415V7a2 2 0 0 1-2 2H11l.003 1.74a1.5 1.5 0 0 1-.69 1.265l-4.54 2.916a.5.5 0 0 1-.77-.421V9H5a2 2 0 0 1-2-2V5.915A1.5 1.5 0 0 1 2 4.5v-3a.5.5 0 0 1 .5-.5Zm3.503 8v4.585l3.77-2.422a.5.5 0 0 0 .23-.421L10 9H6.003ZM4 7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6H4v1Z"/></svg>
                        </button>
                        <div class="highlight-colors">
                            <button class="color-option" data-action="highlight" data-color="yellow" title="Yellow highlight" style="background-color: #ffeb3b;"></button>
                            <button class="color-option" data-action="highlight" data-color="green" title="Green highlight" style="background-color: #4caf50;"></button>
                            <button class="color-option" data-action="highlight" data-color="blue" title="Blue highlight" style="background-color: #2196f3;"></button>
                            <button class="color-option" data-action="highlight" data-color="none" title="Remove highlight" style="background-color: #ffffff; border: 2px solid #ccc;">×</button>
                        </div>
                    </div>
                    <div class="font-size-dropdown">
                        <button class="icon-btn rich-text-btn font-size-toggle" title="Font size" aria-label="Font size">
                            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11.245 15h-6.49l-2 5H.6L7 4h2l6.4 16h-2.155l-2-5Zm-.8-2L8 6.885L5.554 13h4.891ZM21 12.535V12h2v8h-2v-.535a4 4 0 1 1 0-6.93ZM19 18a2 2 0 1 0 0-4a2 2 0 0 0 0 4Z"/></svg>
                        </button>
                        <div class="font-size-options">
                            <button class="size-option" data-action="fontSize" data-size="small" title="Small">S</button>
                            <button class="size-option" data-action="fontSize" data-size="normal" title="Normal">M</button>
                            <button class="size-option" data-action="fontSize" data-size="large" title="Large">L</button>
                        </div>
                    </div>
                    <button class="icon-btn rich-text-btn" data-action="bulletList" title="Bulleted list" aria-label="Bulleted list">
                        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="4" r="1.3" fill="currentColor"/><rect x="6" y="3.2" width="7" height="1.6" rx="0.8" fill="currentColor"/><circle cx="3" cy="8" r="1.3" fill="currentColor"/><rect x="6" y="7.2" width="7" height="1.6" rx="0.8" fill="currentColor"/><circle cx="3" cy="12" r="1.3" fill="currentColor"/><rect x="6" y="11.2" width="7" height="1.6" rx="0.8" fill="currentColor"/></svg>
                    </button>
                    <button class="icon-btn rich-text-btn" data-action="numberedList" title="Numbered list" aria-label="Numbered list">
                        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><text x="1" y="5" font-size="5" font-family="sans-serif">1</text><rect x="6" y="3.2" width="7" height="1.6" rx="0.8" fill="currentColor"/><text x="1" y="9" font-size="5" font-family="sans-serif">2</text><rect x="6" y="7.2" width="7" height="1.6" rx="0.8" fill="currentColor"/><text x="1" y="13" font-size="5" font-family="sans-serif">3</text><rect x="6" y="11.2" width="7" height="1.6" rx="0.8" fill="currentColor"/></svg>
                    </button>
                </div>
                <div class="editor-toolbar-bottom">
                    <div class="toolbar-right">
                        <button class="icon-btn edit-rich-text-toggle" data-message-id="${messageId}" title="Formatting" aria-label="Formatting"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#000000"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7V5H5v2m7-2v14m0 0h-2m2 0h2"/></svg></button>
                        <button class="icon-btn edit-cancel-btn" data-message-id="${messageId}" title="Cancel" aria-label="Cancel"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
                        <button class="icon-btn edit-save-btn" data-message-id="${messageId}" title="Save" aria-label="Save"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                    </div>
                </div>
            </div>
        </div>
        <div class="emoji-toolbar" data-message-id="${messageId}">
            <span class="emoji-option" data-emoji="👍" data-message-id="${messageId}">👍</span>
            <span class="emoji-option" data-emoji="❤️" data-message-id="${messageId}">❤️</span>
            <span class="emoji-option" data-emoji="😂" data-message-id="${messageId}">😂</span>
            <span class="emoji-option" data-emoji="😮" data-message-id="${messageId}">😮</span>
            <span class="emoji-option" data-emoji="🙂" data-message-id="${messageId}">🙂</span>
            <span class="reply-icon" data-message-id="${messageId}" title="Reply to message">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor">
                    <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m5.608 12.526l7.04-6.454C13.931 4.896 16 5.806 16 7.546V11c13 0 11 16 11 16s-4-10-11-10v3.453c0 1.74-2.069 2.65-3.351 1.475l-7.04-6.454a2 2 0 0 1 0-2.948Z"/>
                </svg>
            </span>
            ${!message.threadId ? `<span class="thread-icon" data-message-id="${messageId}" title="Start thread">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    <path d="M13 8H7"/>
                    <path d="M17 12H7"/>
                </svg>
            </span>` : ''}
            <span class="pin-icon" data-message-id="${messageId}" title="${message.isPinned ? 'Unpin message' : 'Pin message'}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${message.isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 17v5"/>
                    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1a1 1 0 0 1 1 1v3.76Z"/>
                </svg>
            </span>
            <span class="delete-icon" data-message-id="${messageId}" title="Delete message">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
            </span>
            ${editIcon}
        </div>
        <div class="reactions-display" data-message-id="${messageId}"></div>
        <div class="thread-count-display" data-message-id="${messageId}" style="display: none;"></div>
    `;

    // Set the message text with HTML rendering
    const commentTextElement = div.querySelector('.comment-text');
    if (message.replyTo) {
        // If this is a reply, the reply context is already in the HTML, just add the message text after it
        commentTextElement.innerHTML = commentTextElement.innerHTML + text;
    } else {
        // If this is not a reply, just set the text normally
        commentTextElement.innerHTML = text;
    }
    
    // Set up emoji toolbar events immediately
    console.log('Setting up emoji toolbar for message:', messageId, 'with reactions:', message.reactions);
    setupEmojiToolbarEvents(div, messageId);
    
    // Set up edit functionality
    setupEditFunctionality(div, messageId, isMyMessage, message);
    
    // Set up reply functionality
    setupReplyFunctionality(div, messageId, message);
    
    // Set up thread functionality
    setupThreadFunctionality(div, messageId, message);
    
    // Set up delete functionality
    setupDeleteFunctionality(div, messageId, message);
    
    // Set up pin functionality
    setupPinFunctionality(div, messageId, message);
    
    // Update reactions display
    updateReactionsDisplay(div, message.reactions || {});
    
    // Update thread count display if available
    if (message.threadCount !== undefined) {
        updateThreadCountDisplay(div, message.threadCount, message.lastReplyTimestamp);
    }

    return div;
}

function setupEditFunctionality(messageElement, messageId, isMyMessage, message) {
    if (!isMyMessage) return; // Only allow editing own messages
    
    const editIcon = messageElement.querySelector('.edit-icon');
    const commentText = messageElement.querySelector('.comment-text');
    const editControls = messageElement.querySelector('.edit-controls');
    const editToolbar = messageElement.querySelector('.edit-toolbar');
    const editContent = messageElement.querySelector('.edit-content');
    const richTextToggle = messageElement.querySelector('.edit-rich-text-toggle');
    const saveBtn = messageElement.querySelector('.edit-save-btn');
    const cancelBtn = messageElement.querySelector('.edit-cancel-btn');
    const richTextBtns = messageElement.querySelectorAll('.rich-text-btn');
    const boldBtn = messageElement.querySelector('.rich-text-btn[data-action="bold"]');
    const italicBtn = messageElement.querySelector('.rich-text-btn[data-action="italic"]');
    const underlineBtn = messageElement.querySelector('.rich-text-btn[data-action="underline"]');
    const bulletBtn = messageElement.querySelector('.rich-text-btn[data-action="bulletList"]');
    const numberedBtn = messageElement.querySelector('.rich-text-btn[data-action="numberedList"]');
    
    if (!editIcon || !commentText || !editControls || !editContent || !saveBtn || !cancelBtn || !richTextToggle) {
        console.error('Edit elements not found for message:', messageId);
        return;
    }
    
    let originalText = message.text;
    let isEditing = false;
    let isRichTextMode = false;
    let savedSelectionRange = null;
    const highlightToggleBtn = messageElement.querySelector('.highlight-toggle');
    const fontSizeToggleBtn = messageElement.querySelector('.font-size-toggle');

    const colorMap = { yellow: '#ffeb3b', green: '#4caf50', blue: '#2196f3' };

    function toRgb(color) {
        const probe = document.createElement('span');
        probe.style.color = color;
        document.body.appendChild(probe);
        const rgb = getComputedStyle(probe).color;
        document.body.removeChild(probe);
        return rgb;
    }

    const colorMapRgb = Object.fromEntries(Object.entries(colorMap).map(([k,v]) => [k, toRgb(v)]));

    function getSelectedHtml() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return '';
        const range = sel.getRangeAt(0).cloneContents();
        const div = document.createElement('div');
        div.appendChild(range);
        return div.innerHTML;
    }

    function applyHighlightColor(hex) {
        editContent.focus();
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) return; // No text selected
        
        // Use hiliteColor for highlighting (background color)
        try {
            document.execCommand('styleWithCSS', false, true);
            if (document.queryCommandSupported('hiliteColor')) {
                document.execCommand('hiliteColor', false, hex);
            } else {
                document.execCommand('backColor', false, hex);
            }
        } catch (e) {
            // Fallback: wrap selection in span with background color
            const selectedHtml = range.toString();
            if (selectedHtml) {
                const span = document.createElement('span');
                span.style.backgroundColor = hex;
                span.textContent = selectedHtml;
                range.deleteContents();
                range.insertNode(span);
                
                // Clear selection and place cursor after span
                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.setStartAfter(span);
                newRange.collapse(true);
                selection.addRange(newRange);
            }
        }
        
        editContent.focus();
        updateToolbarState();
    }

    function applyTextColor(hex) {
        editContent.focus();
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) return; // No text selected
        
        // Always use span-based approach to ensure only text color is applied
        const selectedText = range.toString();
        if (selectedText) {
            const span = document.createElement('span');
            span.style.color = hex;
            span.style.backgroundColor = ''; // Explicitly ensure no background
            span.style.background = ''; // Explicitly ensure no background
            span.textContent = selectedText;
            
            range.deleteContents();
            range.insertNode(span);
            
            // Clear selection and place cursor after span
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.setStartAfter(span);
            newRange.collapse(true);
            selection.addRange(newRange);
        }
        
        editContent.focus();
        updateToolbarState();
    }

    function applyListFormatting(listType) {
        if (!editContent) {
            console.error('editContent not available');
            return;
        }
        
        editContent.focus();
        
        const selection = window.getSelection();
        let range;
        
        // Ensure we have a valid range within the edit content
        if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
            // Check if the range is within editContent
            if (!editContent.contains(range.commonAncestorContainer)) {
                range = document.createRange();
                range.setStart(editContent, 0);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        } else {
            range = document.createRange();
            range.setStart(editContent, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        // First try the standard execCommand
        try {
            const command = listType === 'ul' ? 'insertUnorderedList' : 'insertOrderedList';
            document.execCommand('styleWithCSS', false, true);
            const success = document.execCommand(command, false, null);
            
            if (success) {
                editContent.focus();
                updateToolbarState();
                return;
            }
        } catch (e) {
            console.log('execCommand failed, using fallback:', e);
        }

        // Fallback: Manual list creation
        try {
            const listElement = document.createElement(listType);
            const listItem = document.createElement('li');
            
            if (range.collapsed) {
                // No selection - create new list with empty item
                listItem.textContent = 'List item'; // Add placeholder text that can be edited
                listElement.appendChild(listItem);
                
                // Insert the list at cursor position
                range.insertNode(listElement);
                
                // Place cursor inside the list item and select all text for easy editing
                const newRange = document.createRange();
                newRange.selectNodeContents(listItem);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else {
                // Selected text - wrap in list item
                const selectedContent = range.extractContents();
                listItem.appendChild(selectedContent);
                listElement.appendChild(listItem);
                
                range.insertNode(listElement);
                
                // Place cursor at end of list item
                const newRange = document.createRange();
                newRange.selectNodeContents(listItem);
                newRange.collapse(false);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
            
            editContent.focus();
            updateToolbarState();
        } catch (e) {
            console.error('Manual list creation failed:', e);
        }
    }

    function updateToolbarState() {
        // reflect current selection formatting
        try {
            const bold = document.queryCommandState('bold');
            const italic = document.queryCommandState('italic');
            const underline = document.queryCommandState('underline');
            
            // Check for lists by examining the DOM structure around cursor
            const selection = window.getSelection();
            let ulist = false, olist = false;
            
            if (selection.rangeCount > 0) {
                let node = selection.getRangeAt(0).commonAncestorContainer;
                // Walk up the DOM to find list elements
                while (node && node !== editContent) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'UL') {
                            ulist = true;
                            break;
                        } else if (node.tagName === 'OL') {
                            olist = true;
                            break;
                        }
                    }
                    node = node.parentNode;
                }
            }
            
            const backCol = document.queryCommandValue('backColor') || document.queryCommandValue('hiliteColor');
            const fSize = document.queryCommandValue('fontSize');

            if (boldBtn) boldBtn.classList.toggle('active', !!bold);
            if (italicBtn) italicBtn.classList.toggle('active', !!italic);
            if (underlineBtn) underlineBtn.classList.toggle('active', !!underline);
            if (bulletBtn) bulletBtn.classList.toggle('active', !!ulist);
            if (numberedBtn) numberedBtn.classList.toggle('active', !!olist);

            // highlight active if matches any of our palette colors
            const isHighlight = backCol && Object.values(colorMapRgb).includes(backCol);
            if (highlightToggleBtn) highlightToggleBtn.classList.toggle('active', !!isHighlight);

            // font size active if not default (3 on legacy scale)
            const isSized = fSize && fSize !== '3';
            if (fontSizeToggleBtn) fontSizeToggleBtn.classList.toggle('active', !!isSized);
        } catch (e) {
            // ignore
        }
    }

    function saveSelection() {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            savedSelectionRange = selection.getRangeAt(0);
        }
    }

    function restoreSelection() {
        if (savedSelectionRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(savedSelectionRange);
        }
    }
    
    // Enter edit mode
    function enterEditMode() {
        if (isEditing) return;
        isEditing = true;
        
        commentText.style.display = 'none';
        editControls.style.display = 'block';
        // keep toolbar reserved height but hidden until toggled
        editToolbar.classList.remove('visible');
        // mark message item as editing to hide emoji toolbar
        messageElement.classList.add('is-editing');
        editContent.innerHTML = originalText;
        editContent.focus();
        try { document.execCommand('styleWithCSS', false, true); } catch (e) { /* ignore */ }
        // track selection while typing/selecting
        editContent.addEventListener('keyup', saveSelection);
        editContent.addEventListener('mouseup', saveSelection);
        editContent.addEventListener('keyup', updateToolbarState);
        editContent.addEventListener('mouseup', updateToolbarState);
    }
    
    // Exit edit mode
    function exitEditMode() {
        if (!isEditing) return;
        isEditing = false;
        
        commentText.style.display = 'block';
        editControls.style.display = 'none';
        editToolbar.classList.remove('visible');
        // remove editing state
        messageElement.classList.remove('is-editing');
        const editorContainer = messageElement.querySelector('.edit-editor');
        editorContainer.classList.remove('has-rich-toolbar');
        editContent.innerHTML = originalText;
        isRichTextMode = false;
        richTextToggle.classList.remove('active');
        // Reset all rich text button states
        richTextBtns.forEach(btn => btn.classList.remove('active'));
    }
    
    // Toggle rich text toolbar (without changing layout height)
    function toggleRichTextToolbar() {
        isRichTextMode = !isRichTextMode;
        const editorContainer = messageElement.querySelector('.edit-editor');
        if (isRichTextMode) {
            editToolbar.classList.add('visible');
            richTextToggle.classList.add('active');
            editorContainer.classList.add('has-rich-toolbar');
        } else {
            editToolbar.classList.remove('visible');
            richTextToggle.classList.remove('active');
            editorContainer.classList.remove('has-rich-toolbar');
        }
    }
    
    // Apply rich text formatting
    function applyRichTextFormatting(action, button) {
        console.log('Applying rich text formatting:', action, button);
        
        if (!editContent) {
            console.error('editContent not available for formatting');
            return;
        }
        
        // Use execCommand on contenteditable for WYSIWYG behavior
        editContent.focus();
        
        // Ensure we have a selection or cursor position
        const selection = window.getSelection();
        if (!selection.rangeCount && editContent.contains(document.activeElement)) {
            const range = document.createRange();
            range.setStart(editContent, 0);
            range.collapse(true);
            selection.addRange(range);
        }
        
        restoreSelection();
        
        // Handle button active state - but don't toggle for list buttons as they work differently
        if (!button.classList.contains('color-option') && 
            !button.classList.contains('size-option') &&
            action !== 'bulletList' &&
            action !== 'numberedList') {
            button.classList.toggle('active');
        }
        
        // Enable rich styling with CSS
        document.execCommand('styleWithCSS', false, true);
        
        switch (action) {
            case 'bold':
                document.execCommand('bold', false, null);
                break;
            case 'italic':
                document.execCommand('italic', false, null);
                break;
            case 'underline':
                document.execCommand('underline', false, null);
                break;
            case 'textColor': {
                const color = button.dataset.color;
                const colors = { red: '#dc2626', blue: '#2563eb', green: '#16a34a' };
                applyTextColor(colors[color] || color || '#000000');
                break;
            }
            case 'bulletList':
                console.log('Applying bullet list formatting');
                applyListFormatting('ul');
                break;
            case 'numberedList':
                console.log('Applying numbered list formatting');
                applyListFormatting('ol');
                break;
            case 'highlight': {
                const color = button.dataset.color;
                if (color === 'none') {
                    // Remove highlight
                    applyHighlightColor('transparent');
                } else {
                    const colors = { yellow: '#ffeb3b', green: '#4caf50', blue: '#2196f3' };
                    applyHighlightColor(colors[color] || color || '#fff59d');
                }
                break;
            }
            case 'fontSize': {
                const size = button.dataset.size;
                const sizeMap = { small: '2', normal: '3', large: '5' }; // 1-7 scale
                document.execCommand('fontSize', false, sizeMap[size] || '3');
                break;
            }
            default:
                console.warn('Unknown formatting action:', action);
        }
        
        // Maintain focus and update toolbar state
        editContent.focus();
        updateToolbarState();
    }
    
    // Save edited message
    async function saveEdit() {
        const newText = editContent.innerHTML.trim();
        if (!newText) {
            alert('Message cannot be empty');
            return;
        }
        
        if (newText === originalText) {
            exitEditMode();
            return;
        }
        
        try {
            await updateMessageInFirebase(messageId, newText);
            originalText = newText;
            commentText.innerHTML = newText; // render HTML formatting
            exitEditMode();
        } catch (error) {
            console.error('Error saving edit:', error);
            alert('Failed to save edit. Please try again.');
        }
    }
    
    // Event listeners
    editIcon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        enterEditMode();
    });
    
    richTextToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleRichTextToolbar();
    });
    
    // Rich text button listeners
    console.log('Setting up rich text button listeners, found buttons:', richTextBtns.length);
    richTextBtns.forEach((btn, index) => {
        console.log(`Setting up button ${index}:`, btn.dataset.action, btn);
        btn.addEventListener('mousedown', (e) => { // mousedown to avoid losing selection
            e.preventDefault();
            e.stopPropagation();
            const action = btn.dataset.action;
            console.log('Rich text button clicked:', action);
            applyRichTextFormatting(action, btn);
        });
    });
    
    // Highlight dropdown functionality
    const highlightToggle = messageElement.querySelector('.highlight-toggle');
    const highlightDropdown = messageElement.querySelector('.highlight-dropdown');
    const colorOptions = messageElement.querySelectorAll('.color-option');
    
    if (highlightToggle && highlightDropdown) {
        highlightToggle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            highlightDropdown.classList.toggle('open');
        });
        
        colorOptions.forEach(option => {
            option.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                applyRichTextFormatting('highlight', option);
                highlightDropdown.classList.remove('open');
            });
        });
    }
    
    // Text color dropdown functionality
    const textColorToggle = messageElement.querySelector('.text-color-toggle');
    const textColorDropdown = messageElement.querySelector('.text-color-dropdown');
    const textColorOptions = messageElement.querySelectorAll('.text-color-options .color-option');
    
    if (textColorToggle && textColorDropdown) {
        textColorToggle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            textColorDropdown.classList.toggle('open');
        });
        
        textColorOptions.forEach(option => {
            option.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                applyRichTextFormatting('textColor', option);
                textColorDropdown.classList.remove('open');
            });
        });
    }
    
    // Font size dropdown functionality
    const fontSizeToggle = messageElement.querySelector('.font-size-toggle');
    const fontSizeDropdown = messageElement.querySelector('.font-size-dropdown');
    const sizeOptions = messageElement.querySelectorAll('.size-option');
    
    if (fontSizeToggle && fontSizeDropdown) {
        fontSizeToggle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fontSizeDropdown.classList.toggle('open');
        });
        
        sizeOptions.forEach(option => {
            option.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                applyRichTextFormatting('fontSize', option);
                fontSizeDropdown.classList.remove('open');
            });
        });
    }
    
    // Note: Global dropdown close handler is set up elsewhere
    
    saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveEdit();
    });
    
    cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        exitEditMode();
    });
    
    // Keyboard shortcuts
    editContent.addEventListener('keydown', (e) => {
        // Save: Ctrl/Cmd+Enter
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
            return;
        }
        // Cancel: Escape
        if (e.key === 'Escape') {
            e.preventDefault();
            exitEditMode();
            return;
        }
        // Toggle Ordered List: Ctrl/Cmd+Shift+7
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '7') {
            e.preventDefault();
            applyListFormatting('ol');
            return;
        }
        // Toggle Unordered List: Ctrl/Cmd+Shift+8
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '8') {
            e.preventDefault();
            applyListFormatting('ul');
            return;
        }
        // Markdown-style triggers at start of line: "- ", "* ", "1. "
        if (e.key === ' ') {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            const container = range.startContainer;
            if (container && container.nodeType === Node.TEXT_NODE) {
                const text = container.textContent || '';
                const cursorIndex = range.startOffset;
                const before = text.slice(0, cursorIndex);
                if (before === '-' || before === '*') {
                    e.preventDefault();
                    const rest = text.slice(cursorIndex);
                    container.textContent = rest;
                    const newRange = document.createRange();
                    newRange.setStart(container, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                    applyListFormatting('ul');
                    return;
                }
                if (/^\d+\.$/.test(before)) {
                    e.preventDefault();
                    const rest = text.slice(cursorIndex);
                    container.textContent = rest;
                    const newRange = document.createRange();
                    newRange.setStart(container, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                    applyListFormatting('ol');
                    return;
                }
            }
        }
        // Default Enter: allow newline
    });
    
    // Auto-resize textarea on input
    // no textarea autosize needed for contenteditable
}

// Use event delegation for reply icons to handle dynamically added messages
function setupReplyEventDelegation() {
    // Remove any existing delegation to avoid duplicates
    const messagesList = document.getElementById('messages-list');
    if (!messagesList) return;
    
    // Remove existing event listener if it exists
    if (messagesList.dataset.replyDelegationAdded === 'true') {
        return;
    }
    
    messagesList.addEventListener('click', (e) => {
        // Check if clicked element is a reply icon
        const replyIcon = e.target.closest('.reply-icon');
        if (!replyIcon) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const messageId = replyIcon.dataset.messageId;
        if (!messageId) {
            console.error('No message ID found on reply icon');
            return;
        }
        
        console.log('Reply icon clicked for message:', messageId);
        
        // Visual feedback
        replyIcon.style.transform = 'scale(0.9)';
        setTimeout(() => {
            replyIcon.style.transform = 'scale(1)';
        }, 100);
        
        // Find the message element and get the message data
        const messageElement = replyIcon.closest('.comment-item');
        if (!messageElement) {
            console.error('Message element not found for reply icon');
            return;
        }
        
        // Get message data from the element's data attributes or reconstruct it
        const message = {
            messageId: messageId,
            name: messageElement.querySelector('.comment-author')?.textContent || 'Unknown',
            text: messageElement.querySelector('.comment-text')?.textContent || '',
            timestamp: messageElement.dataset.timestamp || new Date().toISOString(),
            email: messageElement.dataset.email || ''
        };
        
        // Create reply card and populate chat input
        createReplyCard(message);
        
        // Focus the message input
        const messageInput = document.getElementById('new-message');
        if (messageInput) {
            messageInput.focus();
        }
    });
    
    messagesList.dataset.replyDelegationAdded = 'true';
    console.log('Reply event delegation set up');
}

function setupReplyFunctionality(messageElement, messageId, message) {
    // Add data attributes to the message element for event delegation
    messageElement.dataset.messageId = messageId;
    messageElement.dataset.timestamp = message.timestamp;
    messageElement.dataset.email = message.email;
    
    // Set up event delegation (only once)
    setupReplyEventDelegation();
}

// Use event delegation for thread icons to handle dynamically added messages
function setupThreadEventDelegation() {
    const messagesList = document.getElementById('messages-list');
    if (!messagesList) return;
    
    // Remove existing event listener if it exists
    if (messagesList.dataset.threadDelegationAdded === 'true') {
        return;
    }
    
    messagesList.addEventListener('click', (e) => {
        // Check if clicked element is a thread icon or thread count
        const threadIcon = e.target.closest('.thread-icon');
        const threadCount = e.target.closest('.thread-count-display');
        
        if (!threadIcon && !threadCount) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const target = threadIcon || threadCount;
        const messageId = target.dataset.messageId;
        if (!messageId) {
            console.error('No message ID found on thread element');
            return;
        }
        
        console.log('Thread icon/count clicked for message:', messageId);
        
        // Find the message element and get the message data
        const messageElement = target.closest('.comment-item');
        if (!messageElement) {
            console.error('Message element not found for thread icon');
            return;
        }
        
        // Get message data from the element - preserve HTML to show attachments
        const commentTextElement = messageElement.querySelector('.comment-text');
        const messageText = commentTextElement?.textContent || '';
        const messageHtml = commentTextElement?.innerHTML || '';
        
        const message = {
            messageId: messageId,
            name: messageElement.querySelector('.comment-author')?.textContent || 'Unknown',
            text: messageText,
            html: messageHtml, // Preserve HTML to show attachments
            email: messageElement.dataset.email || '',
            timestamp: messageElement.dataset.timestamp || new Date().toISOString()
        };
        
        console.log('📎 Opening thread for message with HTML:', {
            messageId,
            hasHtml: !!messageHtml,
            htmlLength: messageHtml.length
        });
        
        // Open thread panel
        openThreadPanel(message);
    });
    
    messagesList.dataset.threadDelegationAdded = 'true';
    console.log('Thread event delegation set up');
}

function setupThreadFunctionality(messageElement, messageId, message) {
    // Add data attributes to the message element for event delegation
    messageElement.dataset.messageId = messageId;
    messageElement.dataset.timestamp = message.timestamp;
    messageElement.dataset.email = message.email;
    
    // Set up event delegation (only once)
    setupThreadEventDelegation();
}

function setupDeleteFunctionality(messageElement, messageId, message) {
    // Add data attributes to the message element for event delegation
    messageElement.dataset.messageId = messageId;
    messageElement.dataset.timestamp = message.timestamp;
    messageElement.dataset.email = message.email;
    
    // Set up event delegation (only once)
    setupDeleteEventDelegation();
}

function setupPinFunctionality(messageElement, messageId, message) {
    // Add data attributes to the message element for event delegation
    messageElement.dataset.messageId = messageId;
    messageElement.dataset.timestamp = message.timestamp;
    messageElement.dataset.email = message.email;
    
    // Update pin icon state if message is pinned
    const pinIcon = messageElement.querySelector('.pin-icon');
    if (pinIcon && message.isPinned) {
        pinIcon.classList.add('pinned');
        pinIcon.title = 'Unpin message';
    }
    
    // Set up event delegation (only once)
    setupPinEventDelegation();
}

// Set up event delegation for delete icon clicks
function setupDeleteEventDelegation() {
    const messagesList = document.getElementById('messages-list');
    const threadRepliesList = document.getElementById('thread-replies-list');
    
    // Set up for main messages list
    if (messagesList && messagesList.dataset.deleteDelegationAdded !== 'true') {
        messagesList.addEventListener('click', async (e) => {
            const deleteIcon = e.target.closest('.delete-icon');
            if (!deleteIcon) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const messageId = deleteIcon.dataset.messageId;
            if (!messageId) {
                console.error('Delete icon clicked but no messageId found');
                return;
            }
            
            // Find the message element
            const messageElement = deleteIcon.closest('.comment-item');
            if (!messageElement) {
                console.error('Delete icon clicked but message element not found');
                return;
            }
            
            console.log('🗑️ Deleting message:', messageId);
            
            // Delete the message
            await deleteMessageFromFirebase(messageId, messageElement);
        });
        
        messagesList.dataset.deleteDelegationAdded = 'true';
        console.log('Delete event delegation set up for main messages');
    }
    
    // Set up for thread replies list
    if (threadRepliesList && threadRepliesList.dataset.deleteDelegationAdded !== 'true') {
        threadRepliesList.addEventListener('click', async (e) => {
            const deleteIcon = e.target.closest('.delete-icon');
            if (!deleteIcon) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const messageId = deleteIcon.dataset.messageId;
            if (!messageId) {
                console.error('Delete icon clicked but no messageId found');
                return;
            }
            
            // Find the message element
            const messageElement = deleteIcon.closest('.comment-item');
            if (!messageElement) {
                console.error('Delete icon clicked but message element not found');
                return;
            }
            
            console.log('🗑️ Deleting thread message:', messageId);
            
            // Delete the message
            await deleteMessageFromFirebase(messageId, messageElement);
        });
        
        threadRepliesList.dataset.deleteDelegationAdded = 'true';
        console.log('Delete event delegation set up for thread replies');
    }
}

// Set up event delegation for pin icon clicks
function setupPinEventDelegation() {
    const messagesList = document.getElementById('messages-list');
    const threadRepliesList = document.getElementById('thread-replies-list');
    
    // Set up for main messages list
    if (messagesList && messagesList.dataset.pinDelegationAdded !== 'true') {
        messagesList.addEventListener('click', async (e) => {
            const pinIcon = e.target.closest('.pin-icon');
            if (!pinIcon) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const messageId = pinIcon.dataset.messageId;
            if (!messageId) {
                console.error('Pin icon clicked but no messageId found');
                return;
            }
            
            // Find the message element
            const messageElement = pinIcon.closest('.comment-item');
            if (!messageElement) {
                console.error('Pin icon clicked but message element not found');
                return;
            }
            
            const isPinned = pinIcon.classList.contains('pinned');
            console.log(isPinned ? '📌 Unpinning message:' : '📌 Pinning message:', messageId);
            
            // Toggle pin status
            await toggleMessagePin(messageId, !isPinned, messageElement);
        });
        
        messagesList.dataset.pinDelegationAdded = 'true';
        console.log('Pin event delegation set up for main messages');
    }
    
    // Set up for thread replies list
    if (threadRepliesList && threadRepliesList.dataset.pinDelegationAdded !== 'true') {
        threadRepliesList.addEventListener('click', async (e) => {
            const pinIcon = e.target.closest('.pin-icon');
            if (!pinIcon) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const messageId = pinIcon.dataset.messageId;
            if (!messageId) {
                console.error('Pin icon clicked but no messageId found');
                return;
            }
            
            // Find the message element
            const messageElement = pinIcon.closest('.comment-item');
            if (!messageElement) {
                console.error('Pin icon clicked but message element not found');
                return;
            }
            
            const isPinned = pinIcon.classList.contains('pinned');
            console.log(isPinned ? '📌 Unpinning thread message:' : '📌 Pinning thread message:', messageId);
            
            // Toggle pin status
            await toggleMessagePin(messageId, !isPinned, messageElement);
        });
        
        threadRepliesList.dataset.pinDelegationAdded = 'true';
        console.log('Pin event delegation set up for thread replies');
    }
}

// Toggle message pin status
async function toggleMessagePin(messageId, pinStatus, messageElement) {
    try {
        const companyEmail = await getMainCompanyEmail();
        const currentProject = await getCurrentProject();
        const emailPair = await getEmailPair(currentlyChattingWith);
        
        if (!companyEmail || !currentProject || !emailPair) {
            console.error('[Pin] Missing required data:', { companyEmail, currentProject, emailPair });
            return;
        }
        
        const messagesPath = `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
        
        // Get all messages to find the correct Firebase key
        return new Promise((resolve, reject) => {
            sendRuntimeMessage({
                action: "getFirebaseData",
                path: messagesPath
            }, async (response) => {
                if (!response || !response.success || !response.data) {
                    console.error('[Pin] Failed to fetch messages:', response?.error);
                    reject(new Error('Failed to fetch messages'));
                    return;
                }
                
                const messages = response.data;
                let targetMessageKey = null;
                let targetMessage = null;
                
                // Find the message with matching messageId
                for (const [key, message] of Object.entries(messages)) {
                    if (message && (
                        message.messageId === messageId ||
                        message.timestamp === messageId ||
                        key === messageId ||
                        (message.timestamp && message.timestamp.toString() === messageId) ||
                        (message.messageId && message.messageId.toString() === messageId)
                    )) {
                        targetMessageKey = key;
                        targetMessage = message;
                        break;
                    }
                }
                
                if (!targetMessageKey || !targetMessage) {
                    console.error('[Pin] Message not found:', messageId);
                    reject(new Error('Message not found'));
                    return;
                }
                
                // Update message with pin status
                targetMessage.isPinned = pinStatus;
                if (pinStatus) {
                    targetMessage.pinnedAt = new Date().toISOString();
                } else {
                    delete targetMessage.pinnedAt;
                }
                
                const messagePath = `${messagesPath}/${targetMessageKey}`;
                console.log('[Pin] Updating message pin status at path:', messagePath, 'pinStatus:', pinStatus);
                
                sendRuntimeMessage({
                    action: "saveFirebaseData",
                    path: messagePath,
                    data: targetMessage
                }, (updateResponse) => {
                    if (updateResponse && updateResponse.success) {
                        console.log('[Pin] ✅ Message pin status updated successfully:', messageId, pinStatus);
                        
                        // Update UI immediately
                        const pinIcon = messageElement?.querySelector('.pin-icon');
                        if (pinIcon) {
                            if (pinStatus) {
                                pinIcon.classList.add('pinned');
                                pinIcon.title = 'Unpin message';
                            } else {
                                pinIcon.classList.remove('pinned');
                                pinIcon.title = 'Pin message';
                            }
                        }
                        
                        resolve(updateResponse);
                    } else {
                        console.error('[Pin] ❌ Failed to update pin status:', updateResponse?.error);
                        reject(new Error(updateResponse?.error || 'Failed to update pin status'));
                    }
                });
            });
        });
    } catch (error) {
        console.error('[Pin] Error toggling pin status:', error);
    }
}

// Toggle pinned messages view
function togglePinnedMessagesView() {
    const messagesList = document.getElementById('messages-list');
    if (!messagesList) return;
    
    const pinButton = document.getElementById('message-pin-button');
    const isShowingPinned = messagesList.dataset.showingPinned === 'true';
    
    if (isShowingPinned) {
        // Show all messages
        messagesList.dataset.showingPinned = 'false';
        if (pinButton) pinButton.classList.remove('active');
        loadMessages(); // Reload all messages
    } else {
        // Show only pinned messages
        messagesList.dataset.showingPinned = 'true';
        if (pinButton) pinButton.classList.add('active');
        showPinnedMessages();
    }
}

// Format date for timeline header
function formatTimelineDate(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (messageDate.getTime() === today.getTime()) {
        return 'Today';
    } else if (messageDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    } else {
        // Check if it's within the last 7 days
        const daysDiff = Math.floor((today - messageDate) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 7) {
            return date.toLocaleDateString([], { weekday: 'long' });
        } else {
            // Show full date
            return date.toLocaleDateString([], {
                month: 'long',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    }
}

// Create timeline date header
function createTimelineDateHeader(dateString) {
    const header = document.createElement('div');
    header.className = 'timeline-date-header';
    header.innerHTML = `
        <div class="timeline-date-content">
            <span class="timeline-date-text">${dateString}</span>
        </div>
    `;
    return header;
}

// Show only pinned messages
async function showPinnedMessages() {
    const messagesList = document.getElementById('messages-list');
    if (!messagesList) return;
    
    try {
        const companyEmail = await getMainCompanyEmail();
        const currentProject = await getCurrentProject();
        const emailPair = await getEmailPair(currentlyChattingWith);
        
        if (!companyEmail || !currentProject || !emailPair) {
            console.error('[Pin] Missing required data for showing pinned messages');
            return;
        }
        
        // Format company email for Firebase paths (replace dots with commas)
        const formattedCompanyEmail = (companyEmail || '').replace(/\./g, ',');
        
        const messagesPath = `Companies/${formattedCompanyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
        
        sendRuntimeMessage({
            action: "getFirebaseData",
            path: messagesPath
        }, async (response) => {
            if (!response || !response.success || !response.data) {
                console.error('[Pin] Failed to fetch messages for pinned view');
                return;
            }
            
            const allMessages = response.data;
            const userEmail = await getUserEmail();
            
            // Filter for pinned messages only (excluding thread replies)
            const pinnedMessages = Object.values(allMessages).filter(msg => 
                msg && msg.isPinned && !msg.threadId
            );
            
            // Sort by original message timestamp (when message was sent, oldest first)
            pinnedMessages.sort((a, b) => {
                const timeA = new Date(a.timestamp).getTime();
                const timeB = new Date(b.timestamp).getTime();
                return timeA - timeB;
            });
            
            // Clear current messages
            messagesList.innerHTML = '';
            
            if (pinnedMessages.length === 0) {
                messagesList.innerHTML = '<div class="no-messages-container"><i class="fas fa-thumbtack" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px;"></i><span class="no-messages-text">No pinned messages</span><span class="no-messages-subtitle">Pin important messages to find them quickly</span></div>';
                return;
            }
            
            // Group messages by date
            const messagesByDate = {};
            pinnedMessages.forEach(message => {
                const messageDate = new Date(message.timestamp);
                const dateKey = messageDate.toDateString();
                
                if (!messagesByDate[dateKey]) {
                    messagesByDate[dateKey] = [];
                }
                messagesByDate[dateKey].push(message);
            });
            
            // Get sorted date keys (oldest first)
            const sortedDateKeys = Object.keys(messagesByDate).sort((a, b) => {
                return new Date(a) - new Date(b);
            });
            
            // Render messages grouped by date with timeline headers
            for (const dateKey of sortedDateKeys) {
                const messages = messagesByDate[dateKey];
                const dateHeader = createTimelineDateHeader(formatTimelineDate(new Date(dateKey)));
                messagesList.appendChild(dateHeader);
                
                for (const message of messages) {
                    const messageElement = await createMessageElement(message, userEmail);
                    messagesList.appendChild(messageElement);
                }
            }
            
            // Scroll to top
            messagesList.scrollTop = 0;
        });
    } catch (error) {
        console.error('[Pin] Error showing pinned messages:', error);
    }
}

// Delete message from Firebase
async function deleteMessageFromFirebase(messageId, messageElement) {
    try {
        const companyEmail = await getMainCompanyEmail();
        const currentProject = await getCurrentProject();
        const emailPair = await getEmailPair(currentlyChattingWith);
        
        if (!companyEmail || !currentProject || !emailPair) {
            console.error('[Delete] Missing required data:', { companyEmail, currentProject, emailPair });
            alert('Error: Missing required information to delete message.');
            return;
        }
        
        const messagesPath = `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
        
        // First, get all messages to find the correct Firebase key
        return new Promise((resolve, reject) => {
            sendRuntimeMessage({
                action: "getFirebaseData",
                path: messagesPath
            }, async (response) => {
                if (!response || !response.success || !response.data) {
                    console.error('[Delete] Failed to fetch messages:', response?.error);
                    alert('Error: Failed to fetch messages. Please try again.');
                    reject(new Error('Failed to fetch messages'));
                    return;
                }
                
                const messages = response.data;
                let targetMessageKey = null;
                
                // Find the message with matching messageId
                for (const [key, message] of Object.entries(messages)) {
                    if (message && (
                        message.messageId === messageId ||
                        message.timestamp === messageId ||
                        key === messageId ||
                        (message.timestamp && message.timestamp.toString() === messageId) ||
                        (message.messageId && message.messageId.toString() === messageId)
                    )) {
                        targetMessageKey = key;
                        break;
                    }
                }
                
                if (!targetMessageKey) {
                    console.error('[Delete] Message not found:', messageId);
                    alert('Error: Message not found. It may have already been deleted.');
                    reject(new Error('Message not found'));
                    return;
                }
                
                // Delete the message by setting it to null
                const messagePath = `${messagesPath}/${targetMessageKey}`;
                console.log('[Delete] Deleting message at path:', messagePath);
                
                sendRuntimeMessage({
                    action: "saveFirebaseData",
                    path: messagePath,
                    data: null // Setting to null deletes the node
                }, (deleteResponse) => {
                    if (deleteResponse && deleteResponse.success) {
                        console.log('[Delete] ✅ Message deleted successfully:', messageId);
                        // The Firebase listener will automatically update the UI
                        // But we can also remove it from DOM immediately for better UX
                        if (messageElement && messageElement.parentNode) {
                            messageElement.style.transition = 'opacity 0.3s ease';
                            messageElement.style.opacity = '0';
                            setTimeout(() => {
                                messageElement.remove();
                            }, 300);
                        }
                        resolve(deleteResponse);
                    } else {
                        console.error('[Delete] ❌ Failed to delete message:', deleteResponse?.error);
                        alert('Error: Failed to delete message. Please try again.');
                        reject(new Error(deleteResponse?.error || 'Failed to delete message'));
                    }
                });
            });
        });
    } catch (error) {
        console.error('[Delete] Error deleting message:', error);
        alert('Error: An unexpected error occurred while deleting the message.');
    }
}

function updateThreadCountDisplay(messageElement, count, lastReplyTimestamp) {
    if (!messageElement) {
        console.warn('updateThreadCountDisplay: messageElement is null');
        return;
    }
    
    const threadCountDisplay = messageElement.querySelector('.thread-count-display');
    if (!threadCountDisplay) {
        console.warn('updateThreadCountDisplay: thread-count-display element not found');
        return;
    }
    
    const messageId = messageElement.dataset.messageId;
    console.log(`Updating thread count for message ${messageId}: ${count}${lastReplyTimestamp ? ', last reply: ' + lastReplyTimestamp : ''}`);
    
    if (count > 0) {
        threadCountDisplay.style.display = 'inline-flex';
        threadCountDisplay.style.visibility = 'visible';
        
        // Format last reply time if available
        let lastReplyText = '';
        if (lastReplyTimestamp) {
            try {
                const lastReplyDate = new Date(lastReplyTimestamp);
                lastReplyText = ` • Last reply ${formatLastReplyTime(lastReplyDate)}`;
            } catch (e) {
                console.warn('Failed to format last reply timestamp:', e);
            }
        }
        
        threadCountDisplay.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                <path d="M13 8H7"/>
                <path d="M17 12H7"/>
            </svg>
            <span>${count} ${count === 1 ? 'reply' : 'replies'}${lastReplyText}</span>
        `;
        console.log(`Thread count display updated and made visible for message ${messageId}`);
    } else {
        threadCountDisplay.style.display = 'none';
        threadCountDisplay.style.visibility = 'hidden';
    }
}

// Thread Panel Functions
async function openThreadPanel(parentMessage) {
    // Set thread context
    currentThreadContext = String(parentMessage.messageId);
    currentReplyContext = null; // Clear reply context (mutual exclusivity)
    
    // Reset thread panel state when opening a new thread
    threadPanelInitialized = false;
    lastRenderedThreadReplies = [];
    
    // Get chat container
    const chatContainer = document.getElementById('contacts-panel-messages');
    if (!chatContainer) {
        console.error('Chat container not found');
        return;
    }
    
    // Hide main chat
    const messagesList = document.getElementById('messages-list');
    const addCommentSection = chatContainer.querySelector('.add-comment-section');
    if (messagesList) messagesList.style.display = 'none';
    if (addCommentSection) addCommentSection.style.display = 'none';
    
    // Get or create thread panel
    let threadPanel = document.getElementById('thread-panel');
    if (!threadPanel) {
        threadPanel = document.createElement('div');
        threadPanel.id = 'thread-panel';
        threadPanel.style.display = 'none';
        chatContainer.appendChild(threadPanel);
    }
    
    // Show thread panel
    threadPanel.style.display = 'flex';
    
    // Load thread messages
    await loadThreadMessages(currentThreadContext, parentMessage);
}

async function closeThreadPanel() {
    // Save draft before closing (if there's content)
    const threadInput = document.getElementById('thread-message-input');
    if (threadInput && currentThreadContext) {
        const content = threadInput.textContent || threadInput.innerText || '';
        if (content.trim()) {
            // Save draft before closing
            await saveDraft(content, 'thread', currentThreadContext);
        } else {
            // Clear draft if empty
            await clearDraft('thread', currentThreadContext);
        }
    }
    
    // Clear thread context
    currentThreadContext = null;
    
    // Clear reply card if it exists
    removeReplyCard();
    
    // Remove thread listener if active
    if (currentThreadListenerPath) {
        removeFirebaseListener(currentThreadListenerPath);
        currentThreadListenerPath = "";
    }
    
    // Hide thread panel
    const threadPanel = document.getElementById('thread-panel');
    if (threadPanel) {
        threadPanel.style.display = 'none';
    }
    
    // Show main chat
    const chatContainer = document.getElementById('contacts-panel-messages');
    if (chatContainer) {
        const messagesList = document.getElementById('messages-list');
        const addCommentSection = chatContainer.querySelector('.add-comment-section');
        if (messagesList) messagesList.style.display = 'block';
        if (addCommentSection) addCommentSection.style.display = 'block';
    }
    
    // Reset thread panel state
    threadPanelInitialized = false;
    lastRenderedThreadReplies = [];
    
    // Force a full reload by clearing the cached HTML
    // This ensures we fetch fresh data from Firebase when returning from thread view
    console.log('🔄 Clearing cached HTML to force fresh reload of main chat');
    previousMessagesHTML = "";
    
    // Reload messages to update thread counts and fetch any new messages
    loadMessages();
}

// Store last thread message IDs to detect changes (per thread)
let lastThreadMessageIds = new Set();
let currentThreadIdForTracking = null;

async function loadThreadMessages(threadId, parentMessage) {
    if (!threadId || !parentMessage) {
        console.error('Invalid thread ID or parent message');
        return;
    }
    
    const companyEmail = await getMainCompanyEmail();
    const currentProject = await getCurrentProject();
    const emailPair = await getEmailPair(currentlyChattingWith);
    
    // Format company email for Firebase paths (replace dots with commas)
    const formattedCompanyEmail = (companyEmail || '').replace(/\./g, ',');
    
    const messagesPath = `Companies/${formattedCompanyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
    
    // Remove existing listener if any
    if (currentThreadListenerPath) {
        removeFirebaseListener(currentThreadListenerPath);
    }
    
    currentThreadListenerPath = messagesPath;
    
    // Reset tracking when switching to a different thread
    if (currentThreadIdForTracking !== threadId) {
        console.log('🔄 Switching to new thread, resetting tracking');
        lastThreadMessageIds = new Set();
        currentThreadIdForTracking = threadId;
    }
    
    // Get user email for rendering
    const userEmail = await getUserEmail();
    
    // Helper function to process and render thread messages
    const processThreadMessages = (data) => {
        let allMessages = data ? Object.values(data) : [];
        
        // Extract messageId from Firebase key if not present
        if (data) {
            Object.entries(data).forEach(([firebaseKey, msg]) => {
                if (msg && !msg.messageId) {
                    msg.messageId = String(firebaseKey);
                }
            });
        }
        
        // Filter for messages in this thread
        const threadReplies = allMessages.filter(msg => 
            msg && String(msg.threadId) === String(threadId)
        );
        
        // Sort by timestamp (oldest first)
        threadReplies.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeA - timeB;
        });
        
        // Check if thread messages actually changed
        const currentIds = new Set(threadReplies.map(m => String(m.messageId || m.timestamp)));
        const hasChanges = currentIds.size !== lastThreadMessageIds.size || 
                          [...currentIds].some(id => !lastThreadMessageIds.has(id));
        
        // Always render on first load (when lastThreadMessageIds is empty) or when changes detected
        const isFirstLoad = lastThreadMessageIds.size === 0;
        const shouldRender = hasChanges || isFirstLoad;
        
        console.log(`🔍 Thread check: replies=${threadReplies.length}, currentIds=${currentIds.size}, lastIds=${lastThreadMessageIds.size}, hasChanges=${hasChanges}, isFirstLoad=${isFirstLoad}, shouldRender=${shouldRender}`);
        
        // Always render on first load, or when there are changes
        if (shouldRender) {
            console.log(`🧵 Rendering thread panel: ${lastThreadMessageIds.size} -> ${currentIds.size}${isFirstLoad ? ' (first load)' : ''}`);
            lastThreadMessageIds = currentIds;
            
            // Render thread panel
            const threadPanel = document.getElementById('thread-panel');
            if (threadPanel && currentThreadContext === threadId) {
                console.log('✅ Calling renderThreadPanel with', threadReplies.length, 'replies');
                renderThreadPanel(threadPanel, parentMessage, threadReplies, userEmail);
            } else {
                console.warn('⚠️ Cannot render: threadPanel=', !!threadPanel, 'currentThreadContext=', currentThreadContext, 'threadId=', threadId);
            }
        } else {
            console.log('🔇 Thread replies unchanged, skipping re-render');
        }
    };
    
    // Set up Firebase listener for real-time updates FIRST
    // This ensures we get updates, but we'll handle initial render separately
    listenerFirebaseData(messagesPath, async (path, data) => {
        if (path === messagesPath && currentThreadContext === threadId) {
            // Skip if this is the initial load (we'll handle that separately)
            if (lastThreadMessageIds.size === 0 && !threadPanelInitialized) {
                console.log('🔇 Skipping listener callback - initial load will be handled by fetch');
                return;
            }
            processThreadMessages(data);
        }
    });
    
    // Fetch initial data immediately to show existing replies
    // This ensures the panel renders immediately with the parent message and any existing replies
    sendRuntimeMessage({
        action: "getFirebaseData",
        path: messagesPath
    }, async (response) => {
        if (currentThreadContext === threadId) {
            if (response && response.success) {
                console.log('📥 Fetched initial thread messages, data:', response.data ? 'exists' : 'null');
                
                // Process the initial data
                let allMessages = response.data ? Object.values(response.data) : [];
                
                // Extract messageId from Firebase key if not present
                if (response.data) {
                    Object.entries(response.data).forEach(([firebaseKey, msg]) => {
                        if (msg && !msg.messageId) {
                            msg.messageId = String(firebaseKey);
                        }
                    });
                }
                
                // Filter for messages in this thread
                const threadReplies = allMessages.filter(msg => 
                    msg && String(msg.threadId) === String(threadId)
                );
                
                // Sort by timestamp (oldest first)
                threadReplies.sort((a, b) => {
                    const timeA = new Date(a.timestamp).getTime();
                    const timeB = new Date(b.timestamp).getTime();
                    return timeA - timeB;
                });
                
                console.log(`📊 Initial thread load: ${threadReplies.length} replies found`);
                
                // Always render on initial load
                const threadPanel = document.getElementById('thread-panel');
                if (threadPanel && currentThreadContext === threadId) {
                    console.log('✅ Rendering thread panel with initial data');
                    renderThreadPanel(threadPanel, parentMessage, threadReplies, userEmail);
                    
                    // Update tracking after initial render
                    lastThreadMessageIds = new Set(threadReplies.map(m => String(m.messageId || m.timestamp)));
                }
            } else {
                console.warn('⚠️ Failed to fetch initial thread messages:', response);
                // Still render the panel even if fetch fails, so user can see the parent message
                const threadPanel = document.getElementById('thread-panel');
                if (threadPanel && currentThreadContext === threadId) {
                    console.log('🎨 Rendering thread panel with empty replies (fetch failed)');
                    renderThreadPanel(threadPanel, parentMessage, [], userEmail);
                }
            }
        }
    });
}

// Store the last rendered thread replies to avoid full re-renders
let lastRenderedThreadReplies = [];
let threadPanelInitialized = false;

async function renderThreadPanel(threadPanel, parentMessage, threadReplies, userEmail) {
    console.log('🎨 renderThreadPanel called:', {
        hasPanel: !!threadPanel,
        parentMessageId: parentMessage?.messageId,
        repliesCount: threadReplies?.length || 0,
        initialized: threadPanelInitialized
    });
    
    // If panel hasn't been initialized, create the full structure
    const isInitializing = !threadPanelInitialized || !threadPanel.querySelector('.thread-panel-container');
    
    if (isInitializing) {
        console.log('🏗️ Initializing thread panel structure');
        threadPanel.innerHTML = `
            <div class="thread-panel-container">
                <div class="thread-panel-header">
                    <button class="thread-back-button" title="Back to chat">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <span class="thread-panel-title">Thread</span>
                </div>
                <div class="thread-panel-content">
                    <div class="thread-parent-message">
                        <div class="thread-parent-header">
                            <span class="thread-parent-author">${parentMessage.name || 'Unknown'}</span>
                            <span class="thread-parent-time">${formatTime(new Date(parentMessage.timestamp))}</span>
                        </div>
                        <div class="thread-parent-text">${parentMessage.html || parentMessage.text || ''}</div>
                    </div>
                    <div class="thread-replies-container" id="thread-replies-list">
                        ${threadReplies.length === 0 ? '<div class="no-messages-text" style="text-align: center; color: #9ca3af; padding: 20px;">No replies yet. Start the conversation!</div>' : ''}
                    </div>
                </div>
                <div class="thread-input-section">
                    <div class="add-comment-section thread-input-container">
                        <div class="comment-input-container">
                            <div class="input-with-send">
                                <div id="thread-message-input" class="comment-input" contenteditable="true" placeholder="Reply in thread..."></div>
                                <div class="editor-toolbar-bottom">
                                    <div class="toolbar-right">
                                        <button id="thread-emoji-toggle" class="icon-btn emoji-toggle-btn" title="Emoji" aria-label="Emoji">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                                <line x1="15" y1="9" x2="15.01" y2="9"></line>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <button id="thread-send-button" class="comment-button primary" title="Send">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Set up event handlers
        const backButton = threadPanel.querySelector('.thread-back-button');
        if (backButton) {
            backButton.addEventListener('click', closeThreadPanel);
        }
        
        // Set up thread input
        setupThreadInput();
        
        // Load draft for this thread
        const threadInput = document.getElementById('thread-message-input');
        if (threadInput && currentThreadContext) {
            const draftContent = await loadDraft('thread', currentThreadContext);
            if (draftContent) {
                threadInput.textContent = draftContent;
                threadInput.innerText = draftContent;
            }
        }
        
        threadPanelInitialized = true;
        lastRenderedThreadReplies = [];
    }
    
    // Now handle rendering replies
    const repliesList = threadPanel.querySelector('#thread-replies-list');
    if (repliesList) {
        // Remove "no messages" placeholder if it exists and we have replies
        const placeholder = repliesList.querySelector('.no-messages-text');
        if (placeholder && threadReplies.length > 0) {
            placeholder.remove();
        }
        
        // If initializing, render ALL replies. Otherwise, only add new ones
        if (isInitializing) {
            console.log(`🎨 Rendering ${threadReplies.length} initial thread reply(ies)`);
            repliesList.innerHTML = ''; // Clear placeholder if any
            
            // Render all initial replies
            for (const reply of threadReplies) {
                const replyElement = await createMessageElement(reply, userEmail);
                repliesList.appendChild(replyElement);
            }
            
            // Set up delete event delegation for thread replies
            setupDeleteEventDelegation();
            
            // Set up pin event delegation for thread replies
            setupPinEventDelegation();
            
            // Scroll to bottom after initial render
            if (repliesList.lastChild) {
                setTimeout(() => {
                    repliesList.lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 100);
            }
        } else {
            // Incremental update - only add new replies
            const existingReplyIds = lastRenderedThreadReplies.map(r => String(r.messageId || r.timestamp));
            
            // Find new replies that aren't already rendered
            const newReplies = threadReplies.filter(reply => {
                const replyId = String(reply.messageId || reply.timestamp);
                return !existingReplyIds.includes(replyId);
            });
            
            if (newReplies.length > 0) {
                console.log(`➕ Adding ${newReplies.length} new thread reply(ies) smoothly`);
                
                // Append only the new replies
                for (const reply of newReplies) {
                    const replyElement = await createMessageElement(reply, userEmail);
                    repliesList.appendChild(replyElement);
                }
                
                // Set up delete event delegation for thread replies (in case it wasn't set up yet)
                setupDeleteEventDelegation();
                
                // Set up pin event delegation for thread replies (in case it wasn't set up yet)
                setupPinEventDelegation();
                
                // Smooth scroll to the last new reply
                if (repliesList.lastChild) {
                    repliesList.lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
            } else {
                console.log('🔇 No new thread replies to add');
            }
        }
        
        // Update our tracking
        lastRenderedThreadReplies = threadReplies;
    }
}

function setupThreadInput() {
    const threadInput = document.getElementById('thread-message-input');
    const threadSendBtn = document.getElementById('thread-send-button');
    const threadEmojiToggle = document.getElementById('thread-emoji-toggle');
    
    if (!threadInput || !threadSendBtn) return;
    
    // Check if listener already added
    if (threadSendBtn.dataset.listenerAdded === 'true') {
        return;
    }
    
    // Setup emoji picker for thread input
    if (threadEmojiToggle) {
        threadEmojiToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle emoji picker
            const existingPicker = document.getElementById('emoji-picker-container');
            if (existingPicker) {
                closeEmojiPicker();
                threadEmojiToggle.classList.remove('active');
            } else {
                showEmojiPicker(threadEmojiToggle, threadInput, (emoji) => {
                    // Insert emoji into input
                    const selection = window.getSelection();
                    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
                    
                    if (range && threadInput.contains(range.commonAncestorContainer)) {
                        range.deleteContents();
                        const textNode = document.createTextNode(emoji);
                        range.insertNode(textNode);
                        range.setStartAfter(textNode);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } else {
                        // Fallback: append emoji
                        threadInput.focus();
                        if (threadInput.childNodes.length > 0) {
                            const lastNode = threadInput.childNodes[threadInput.childNodes.length - 1];
                            if (lastNode.nodeType === Node.TEXT_NODE) {
                                lastNode.textContent += emoji;
                            } else {
                                threadInput.appendChild(document.createTextNode(emoji));
                            }
                        } else {
                            threadInput.textContent = emoji;
                        }
                        
                        // Move cursor to end
                        const range = document.createRange();
                        range.selectNodeContents(threadInput);
                        range.collapse(false);
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                    
                    threadInput.dispatchEvent(new Event('input'));
                    threadEmojiToggle.classList.remove('active');
                });
                threadEmojiToggle.classList.add('active');
            }
        });
    }
    
    // Send button click handler
    threadSendBtn.addEventListener('click', async () => {
        const text = threadInput.textContent || threadInput.innerText;
        if (!text || !text.trim()) return;
        
        // Store text before clearing
        const messageText = text.trim();
        
        // Clear input immediately for better UX
        threadInput.textContent = '';
        threadInput.innerText = '';
        
        // Post message (will use currentThreadContext)
        await postNewMessage(messageText, false);
        
        // Clear thread draft after successful send
        if (currentThreadContext) {
            await clearDraft('thread', currentThreadContext);
        }
    });
    
    // Enter key handler
    threadInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            threadSendBtn.click();
        }
    });
    
    // Auto-save thread draft as user types
    threadInput.addEventListener('input', () => {
        autoSaveThreadDraft(threadInput);
    });
    
    // Set placeholder
    threadInput.addEventListener('focus', () => {
        if (!threadInput.textContent && !threadInput.innerText) {
            threadInput.setAttribute('data-placeholder', 'Reply in thread...');
        }
    });
    
    threadInput.addEventListener('blur', () => {
        threadInput.removeAttribute('data-placeholder');
    });
    
    threadSendBtn.dataset.listenerAdded = 'true';
}

let currentReplyContext = null;
let currentThreadContext = null; // Stores the parent message ID when replying in a thread
let currentThreadListenerPath = ""; // Tracks Firebase listener path for cleanup
let searchOverlay = null; // Search overlay element
let searchResults = []; // Current search results
let selectedSearchResultIndex = -1; // Currently selected result index
let searchDebounceTimer = null; // Debounce timer for search input
let draftSaveTimer = null; // Debounce timer for draft auto-save
let threadDraftSaveTimer = null; // Debounce timer for thread draft auto-save

function createReplyCard(originalMessage) {
    // Remove existing reply card if present
    removeReplyCard();
    
    const commentInputContainer = document.querySelector('.comment-input-container');
    if (!commentInputContainer) {
        console.error('Comment input container not found');
        return;
    }
    
    // Store reply context for when message is sent
    currentReplyContext = {
        messageId: originalMessage.messageId || originalMessage.timestamp,
        author: originalMessage.name,
        text: originalMessage.text,
        timestamp: originalMessage.timestamp
    };
    
    // Create reply card HTML - Compact two line design
    const replyCard = document.createElement('div');
    replyCard.className = 'reply-card';
    replyCard.innerHTML = `
        <div class="reply-card-header">
            <div class="reply-card-info">
                <span class="reply-card-author">${originalMessage.name}</span>
                <span class="reply-card-time">${formatDateTime(new Date(originalMessage.timestamp))}</span>
            </div>
            <button class="reply-card-close" title="Remove reply">×</button>
        </div>
        <div class="reply-card-content">${stripHtmlTags(originalMessage.text)}</div>
    `;
    
    // Add close functionality
    const closeBtn = replyCard.querySelector('.reply-card-close');
    closeBtn.addEventListener('click', removeReplyCard);
    
    // Add reply card to input container
    commentInputContainer.classList.add('has-reply');
    commentInputContainer.insertBefore(replyCard, commentInputContainer.firstChild);
}

function removeReplyCard() {
    const existingReplyCard = document.querySelector('.reply-card');
    if (existingReplyCard) {
        existingReplyCard.remove();
    }
    
    const commentInputContainer = document.querySelector('.comment-input-container');
    if (commentInputContainer) {
        commentInputContainer.classList.remove('has-reply');
    }
    
    currentReplyContext = null;
}

function stripHtmlTags(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
}

// ===== MESSAGE SEARCH FEATURE =====

// Create search overlay UI
function createSearchOverlay() {
    if (searchOverlay) return searchOverlay;
    
    searchOverlay = document.createElement('div');
    searchOverlay.id = 'message-search-overlay';
    searchOverlay.innerHTML = `
        <div class="search-overlay-backdrop" id="search-backdrop"></div>
        <div class="search-overlay-container">
            <div class="search-header">
                <div class="search-input-wrapper">
                    <svg class="search-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <input 
                        type="text" 
                        class="search-input" 
                        id="search-input" 
                        placeholder="Search messages in this conversation..." 
                        autocomplete="off"
                    />
                    <button class="search-close-btn" id="search-close-btn" title="Close search" type="button">
                        <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="search-results-container" id="search-results-container">
                <div class="search-empty-state">
                    <p>Search your messages</p>
                    <p class="search-hint">Press <kbd>Esc</kbd> to close • <kbd>↑</kbd><kbd>↓</kbd> to navigate • <kbd>Enter</kbd> to select</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(searchOverlay);
    
    // Add event listeners
    const backdrop = searchOverlay.querySelector('#search-backdrop');
    const searchInput = searchOverlay.querySelector('#search-input');
    const closeBtn = searchOverlay.querySelector('#search-close-btn');
    
    // Close on backdrop click
    backdrop.addEventListener('click', closeSearch);
    
    // Close button click
    closeBtn.addEventListener('click', closeSearch);
    
    // Input event - real-time search with debouncing
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query === '') {
            showEmptyState();
            searchResults = [];
            selectedSearchResultIndex = -1;
        } else {
            performSearch(query);
        }
    });
    
    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeSearch();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateSearchResults(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateSearchResults(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedSearchResultIndex >= 0 && selectedSearchResultIndex < searchResults.length) {
                selectSearchResult(selectedSearchResultIndex);
            }
        }
    });
    
    // Inject search styles
    injectSearchStyles();
    
    return searchOverlay;
}

// Inject search styles - Modern ChatGPT-like design
function injectSearchStyles() {
    if (document.getElementById('message-search-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'message-search-styles';
    style.textContent = `
        #message-search-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 10000;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            backdrop-filter: blur(8px);
        }
        
        #message-search-overlay.active {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        
        .search-overlay-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(4px);
        }
        
        .search-overlay-container {
            position: relative;
            width: 95%;
            max-width: 800px;
            margin-top: auto;
            margin-bottom: auto;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 25px 100px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
            overflow: hidden;
            z-index: 10001;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            animation: searchFadeIn 0.2s ease-out;
        }
        
        @keyframes searchFadeIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .search-header {
            padding: 24px 32px;
            border-bottom: none;
            background: transparent;
        }
        
        .search-input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            height: 40px;
            --icon-vertical-offset: -5px;
        }
        
        #message-search-overlay .search-icon {
            position: absolute;
            left: 12px;
            color: #9ca3af;
            pointer-events: none;
            width: 16px;
            height: 16px;
            z-index: 1;
            top: 50%;
            transform: translateY(-50%);
            margin-top: var(--icon-vertical-offset);
            flex-shrink: 0;
            overflow: hidden;
        }
        
        #message-search-overlay .search-input {
            width: 100%;
            padding: 0 40px 0 48px !important;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            outline: none;
            transition: all 0.2s ease;
            background: #ffffff;
            color: #1f2937;
            font-weight: 400;
            line-height: 40px;
            height: 40px;
            box-sizing: border-box;
        }
        
        #message-search-overlay .search-input:focus {
            border-color: #10a37f;
            background: #ffffff;
            box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.1);
        }
        
        #message-search-overlay .search-input::placeholder {
            color: #9ca3af;
            font-weight: 400;
        }
        
        #message-search-overlay .search-close-btn {
            position: absolute;
            right: 6px;
            padding: 4px;
            background: transparent;
            border: none;
            cursor: pointer;
            color: #6b7280;
            border-radius: 4px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            top: 50%;
            transform: translateY(-50%);
            margin-top: var(--icon-vertical-offset);
        }
        
        #message-search-overlay .search-close-btn:hover {
            background-color: #f3f4f6;
            color: #374151;
        }
        
        #message-search-overlay .search-close-btn svg {
            width: 14px;
            height: 14px;
        }
        
        .search-results-container {
            flex: 1;
            overflow-y: auto;
            max-height: calc(80vh - 140px);
            padding: 8px 0;
        }
        
        .search-results-container::-webkit-scrollbar {
            width: 8px;
        }
        
        .search-results-container::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .search-results-container::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 4px;
        }
        
        .search-results-container::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
        }
        
        .search-empty-state {
            padding: 80px 32px;
            text-align: center;
            color: #9ca3af;
        }
        
        .search-empty-state p {
            margin: 12px 0;
            font-size: 15px;
            line-height: 1.6;
            color: #6b7280;
        }
        
        .search-empty-state p:first-child {
            font-size: 17px;
            font-weight: 500;
            color: #374151;
        }
        
        .search-hint {
            font-size: 13px;
            color: #9ca3af;
            margin-top: 24px;
        }
        
        .search-hint kbd {
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 4px 8px;
            font-size: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Monaco, monospace;
            color: #6b7280;
            font-weight: 500;
            margin: 0 2px;
        }
        
        .search-result-item {
            padding: 20px 32px;
            border-bottom: none;
            cursor: pointer;
            transition: background-color 0.15s ease;
            margin: 0 8px;
            border-radius: 10px;
        }
        
        .search-result-item:hover,
        .search-result-item.selected {
            background-color: #f9fafb;
        }
        
        .search-result-item.selected {
            background-color: #f0fdf4;
        }
        
        .search-result-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 10px;
        }
        
        .search-result-author {
            font-weight: 600;
            font-size: 15px;
            color: #111827;
            letter-spacing: -0.01em;
        }
        
        .search-result-time {
            font-size: 13px;
            color: #9ca3af;
            font-weight: 400;
        }
        
        .search-result-preview {
            font-size: 15px;
            color: #4b5563;
            line-height: 1.6;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            margin-top: 4px;
        }
        
        .search-result-preview mark {
            background-color: #fef08a;
            color: #713f12;
            padding: 2px 4px;
            border-radius: 4px;
            font-weight: 500;
        }
        
        .search-result-count {
            padding: 16px 32px;
            border-bottom: none;
            font-size: 14px;
            color: #6b7280;
            background-color: transparent;
            font-weight: 500;
            border-bottom: 1px solid #f3f4f6;
            margin: 0 8px 8px 8px;
        }
    `;
    document.head.appendChild(style);
}

// Open search overlay
function openSearch() {
    if (!searchOverlay) {
        createSearchOverlay();
    }
    
    const searchInput = searchOverlay.querySelector('#search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    
    searchOverlay.classList.add('active');
    showEmptyState();
    searchResults = [];
    selectedSearchResultIndex = -1;
    
    // Focus the search input after a brief delay to ensure modal is visible
    setTimeout(() => {
        if (searchInput) {
            searchInput.focus();
        }
    }, 100);
}

// Close search overlay
function closeSearch() {
    if (searchOverlay) {
        const searchInput = searchOverlay.querySelector('#search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        searchOverlay.classList.remove('active');
        searchResults = [];
        selectedSearchResultIndex = -1;
        
        // Clear debounce timer
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = null;
        }
    }
}

// Show empty state
function showEmptyState() {
    const container = document.getElementById('search-results-container');
    if (container) {
        container.innerHTML = `
            <div class="search-empty-state">
                <p>Search your messages</p>
                <p class="search-hint">Press <kbd>Esc</kbd> to close • <kbd>↑</kbd><kbd>↓</kbd> to navigate • <kbd>Enter</kbd> to select</p>
            </div>
        `;
    }
}

// Perform search
async function performSearch(query) {
    if (!query || query.trim().length === 0) {
        showEmptyState();
        return;
    }
    
    // Clear previous debounce timer
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    
    // Debounce search input
    searchDebounceTimer = setTimeout(async () => {
        const searchTerm = query.toLowerCase().trim();
        
        // Get all messages from the current conversation
        const messagesList = document.getElementById('messages-list');
        if (!messagesList) {
            console.warn('Messages list not found');
            return;
        }
        
        const messageElements = messagesList.querySelectorAll('.comment-item');
        const results = [];
        
        messageElements.forEach((element) => {
            const messageId = element.dataset.messageId;
            const authorElement = element.querySelector('.comment-author');
            const timeElement = element.querySelector('.comment-time');
            const textElement = element.querySelector('.comment-text');
            
            if (!textElement) return;
            
            // Get message text (strip HTML for searching)
            const messageText = stripHtmlTags(textElement.innerHTML || textElement.textContent || '').toLowerCase();
            const authorName = (authorElement?.textContent || '').toLowerCase();
            const timestamp = timeElement?.textContent || '';
            
            // Search in message text and author name
            if (messageText.includes(searchTerm) || authorName.includes(searchTerm)) {
                const fullText = stripHtmlTags(textElement.innerHTML || textElement.textContent || '');
                const author = authorElement?.textContent || 'Unknown';
                
                // Find match positions for highlighting
                const matchIndex = fullText.toLowerCase().indexOf(searchTerm);
                let preview = fullText;
                
                // Create preview with context
                if (matchIndex >= 0) {
                    const start = Math.max(0, matchIndex - 50);
                    const end = Math.min(fullText.length, matchIndex + searchTerm.length + 50);
                    preview = fullText.substring(start, end);
                    if (start > 0) preview = '...' + preview;
                    if (end < fullText.length) preview = preview + '...';
                }
                
                results.push({
                    messageId: messageId,
                    author: author,
                    timestamp: timestamp,
                    preview: preview,
                    fullText: fullText,
                    element: element
                });
            }
        });
        
        // Update results
        searchResults = results;
        selectedSearchResultIndex = -1;
        
        // Display results
        displaySearchResults(results, searchTerm);
    }, 300); // 300ms debounce
}

// Display search results
function displaySearchResults(results, searchTerm) {
    const container = document.getElementById('search-results-container');
    if (!container) return;
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="search-empty-state">
                <p>No messages found</p>
                <p>No messages match "${searchTerm}"</p>
                <p class="search-hint">Try different keywords</p>
            </div>
        `;
        return;
    }
    
    const countHtml = `<div class="search-result-count">${results.length} ${results.length === 1 ? 'message found' : 'messages found'}</div>`;
    
    const resultsHtml = results.map((result, index) => {
        const highlightedPreview = highlightMatches(result.preview, searchTerm);
        return `
            <div class="search-result-item" data-index="${index}" data-message-id="${result.messageId}">
                <div class="search-result-header">
                    <span class="search-result-author">${result.author}</span>
                    <span class="search-result-time">${result.timestamp}</span>
                </div>
                <div class="search-result-preview">${highlightedPreview}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = countHtml + resultsHtml;
    
    // Add click handlers
    container.querySelectorAll('.search-result-item').forEach((item, index) => {
        item.addEventListener('click', () => {
            selectSearchResult(index);
        });
    });
}

// Highlight search matches
function highlightMatches(text, searchTerm) {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// Escape regex special characters
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Navigate search results with arrow keys
function navigateSearchResults(direction) {
    if (searchResults.length === 0) return;
    
    selectedSearchResultIndex += direction;
    
    if (selectedSearchResultIndex < 0) {
        selectedSearchResultIndex = searchResults.length - 1;
    } else if (selectedSearchResultIndex >= searchResults.length) {
        selectedSearchResultIndex = 0;
    }
    
    // Update UI
    const container = document.getElementById('search-results-container');
    if (container) {
        container.querySelectorAll('.search-result-item').forEach((item, index) => {
            item.classList.toggle('selected', index === selectedSearchResultIndex);
        });
        
        // Scroll selected item into view
        const selectedItem = container.querySelector(`.search-result-item[data-index="${selectedSearchResultIndex}"]`);
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
}

// Select and navigate to search result
function selectSearchResult(index) {
    if (index < 0 || index >= searchResults.length) return;
    
    const result = searchResults[index];
    
    // Close search
    closeSearch();
    
    // Navigate to message
    navigateToMessage(result.messageId, result.element);
}

// Navigate to message in conversation
function navigateToMessage(messageId, element = null) {
    if (!element) {
        // Find element if not provided
        const messagesList = document.getElementById('messages-list');
        if (!messagesList) return;
        
        element = messagesList.querySelector(`[data-message-id="${messageId}"]`);
        if (!element) return;
    }
    
    // Scroll to element
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Highlight briefly
    element.style.backgroundColor = '#fef08a';
    setTimeout(() => {
        element.style.backgroundColor = '';
        element.style.transition = 'background-color 0.5s ease';
    }, 2000);
    
    // Remove transition after animation
    setTimeout(() => {
        element.style.transition = '';
    }, 2500);
}

// Setup keyboard shortcut (Cmd/Ctrl+K)
function setupSearchKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
        // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
        if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !e.shiftKey) {
            // Don't trigger if user is typing in an input
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.contentEditable === 'true')) {
                // Allow if in messaging area and not in search
                const isInMessaging = activeElement.closest('#contacts-panel-messages');
                if (isInMessaging && !activeElement.closest('#message-search-overlay')) {
                    e.preventDefault();
                    openSearch();
                }
            } else {
                e.preventDefault();
                openSearch();
            }
        }
    });
}

// Create and add search button to header
function addSearchButtonToHeader() {
    // Check if button already exists
    if (document.getElementById('message-search-button')) {
        return;
    }
    
    // Find the header area (where contact name is displayed)
    const headerArea = document.querySelector('#contacts-panel-messages > div:first-child');
    if (!headerArea) {
        // Retry after a short delay if header isn't ready
        setTimeout(addSearchButtonToHeader, 500);
        return;
    }
    
    // Create search button
    const searchButton = document.createElement('button');
    searchButton.id = 'message-search-button';
    searchButton.className = 'message-search-header-btn';
    searchButton.title = 'Search messages (Cmd/Ctrl+K)';
    searchButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
        </svg>
    `;
    
    // Add click handler
    searchButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSearch();
    });
    
    // Create pin button
    const pinButton = document.createElement('button');
    pinButton.id = 'message-pin-button';
    pinButton.className = 'message-pin-header-btn';
    pinButton.title = 'View pinned messages';
    pinButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 17v5"/>
            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1a1 1 0 0 1 1 1v3.76Z"/>
        </svg>
    `;
    
    // Add click handler for pin button
    pinButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePinnedMessagesView();
    });
    
    // Position buttons in header (on the right side)
    const contactInfoDiv = headerArea.querySelector('.center-under-img');
    if (contactInfoDiv) {
        // Add buttons after contact info, positioned absolutely
        headerArea.style.position = 'relative';
        headerArea.appendChild(pinButton);
        headerArea.appendChild(searchButton);
    } else {
        // Fallback: add at end of header area
        headerArea.appendChild(pinButton);
        headerArea.appendChild(searchButton);
    }
    
    // Inject header button styles
    injectSearchHeaderButtonStyles();
}

// Inject styles for search header button
function injectSearchHeaderButtonStyles() {
    if (document.getElementById('search-header-button-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'search-header-button-styles';
    style.textContent = `
        #message-search-button {
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            width: 32px;
            height: 32px;
            padding: 6px;
            background: none;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            color: #6b7280;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
        }
        
        #message-search-button:hover {
            background-color: #f3f4f6;
            color: #374151;
        }
        
        #message-search-button:active {
            background-color: #e5e7eb;
            transform: translateY(-50%) scale(0.95);
        }
        
        #message-search-button svg {
            width: 16px;
            height: 16px;
        }
        
        #message-pin-button {
            position: absolute;
            right: 56px;
            top: 50%;
            transform: translateY(-50%);
            width: 32px;
            height: 32px;
            padding: 6px;
            background: none;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            color: #6b7280;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
        }
        
        #message-pin-button:hover {
            background-color: #f3f4f6;
            color: #374151;
        }
        
        #message-pin-button:active {
            background-color: #e5e7eb;
            transform: translateY(-50%) scale(0.95);
        }
        
        #message-pin-button svg {
            width: 16px;
            height: 16px;
        }
        
        #message-pin-button.active {
            color: #10a37f;
        }
    `;
    document.head.appendChild(style);
}

// Initialize search on page load
setupSearchKeyboardShortcut();

// Add search button to header when messages panel is shown
// Call this function when displaying messages
const originalShowMessages = function() {
    // This will be called when messages panel is displayed
    setTimeout(addSearchButtonToHeader, 100);
};

// Monitor when messages panel is shown
const observer = new MutationObserver(() => {
    const messagesPanel = document.getElementById('contacts-panel-messages');
    if (messagesPanel && messagesPanel.style.display !== 'none') {
        addSearchButtonToHeader();
        // Restore drafts when panel becomes visible
        setTimeout(() => restoreDrafts(), 300);
    }
});

// Start observing when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const messagesPanel = document.getElementById('contacts-panel-messages');
        if (messagesPanel) {
            observer.observe(messagesPanel, { attributes: true, attributeFilter: ['style'] });
            // Also check immediately
            if (messagesPanel.style.display !== 'none') {
                addSearchButtonToHeader();
                // Restore drafts when panel is visible on load
                setTimeout(() => restoreDrafts(), 500);
            }
        }
        // Also restore drafts after a delay to ensure everything is initialized
        setTimeout(() => restoreDrafts(), 2000);
    });
} else {
    const messagesPanel = document.getElementById('contacts-panel-messages');
    if (messagesPanel) {
        observer.observe(messagesPanel, { attributes: true, attributeFilter: ['style'] });
        if (messagesPanel.style.display !== 'none') {
            addSearchButtonToHeader();
            // Restore drafts when panel is visible
            setTimeout(() => restoreDrafts(), 500);
        }
    }
    // Also restore drafts after a delay to ensure everything is initialized
    setTimeout(() => restoreDrafts(), 2000);
}

async function updateMessageInFirebase(messageId, newText) {
    try {
        const userEmail = await getUserEmail();
        const companyEmail = await getMainCompanyEmail();
        const currentProject = await getCurrentProject();
        const emailPair = await getEmailPair(currentlyChattingWith);
        
        const messagesPath = `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
        
        return new Promise((resolve, reject) => {
            sendRuntimeMessage({
                action: "getFirebaseData",
                path: messagesPath
            }, async response => {
                if (response && response.success && response.data) {
                    const messages = response.data;
                    let targetMessage = null;
                    let targetMessageKey = null;
                    
                    // Find the message with matching messageId
                    for (const [key, message] of Object.entries(messages)) {
                        if (message.messageId === messageId || 
                            message.timestamp === messageId || 
                            key === messageId ||
                            (message.timestamp && message.timestamp.toString() === messageId) ||
                            (message.messageId && message.messageId.toString() === messageId)) {
                            targetMessage = message;
                            targetMessageKey = key;
                            break;
                        }
                    }
                    
                    if (targetMessage && targetMessageKey) {
                        // Update message with new text and editedAt timestamp
                        targetMessage.text = newText;
                        targetMessage.editedAt = new Date().toISOString();
                        
                        const messagePath = `${messagesPath}/${targetMessageKey}`;
                        
                        sendRuntimeMessage({
                            action: "saveFirebaseData",
                            path: messagePath,
                            data: targetMessage
                        }, updateResponse => {
                            if (updateResponse && updateResponse.success) {
                                console.log('Message updated successfully in Firebase');
                                resolve();
                            } else {
                                console.error('Failed to update message:', updateResponse?.error);
                                reject(new Error('Failed to update message in Firebase'));
                            }
                        });
                    } else {
                        reject(new Error('Message not found for editing'));
                    }
                } else {
                    reject(new Error('Failed to get messages from Firebase'));
                }
            });
        });
    } catch (error) {
        console.error('Error updating message:', error);
        throw error;
    }
}

function setupEmojiToolbarEvents(messageElement, messageId) {
    console.log('Setting up emoji toolbar events for message:', messageId);
    const emojiOptions = messageElement.querySelectorAll('.emoji-option');
    console.log('Found emoji options:', emojiOptions.length);
    
    emojiOptions.forEach((option, index) => {
        console.log(`Setting up emoji option ${index}:`, option.dataset.emoji, 'for message:', messageId);
        
        // Check if event listener already exists to avoid duplicates
        if (option.dataset.listenerAdded === 'true') {
            console.log('Event listener already exists for option:', option.dataset.emoji);
            return;
        }
        
        // Add click listener with proper error handling
        option.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const emoji = option.dataset.emoji;
            const currentMessageId = option.dataset.messageId;
            console.log('Emoji clicked:', emoji, 'for message:', currentMessageId);
            
            // Visual feedback
            option.style.transform = 'scale(0.9)';
            setTimeout(() => {
                option.style.transform = 'scale(1)';
            }, 100);
            
            try {
                await toggleReaction(currentMessageId, emoji);
            } catch (error) {
                console.error('Error toggling reaction:', error);
                // Reset visual state on error
                option.style.transform = 'scale(1)';
            }
        });
        
        // Hover effects
        option.addEventListener('mouseenter', () => {
            option.style.transform = 'scale(1.1)';
        });
        
        option.addEventListener('mouseleave', () => {
            option.style.transform = 'scale(1)';
        });
        
        // Mark as having listener to prevent duplicates
        option.dataset.listenerAdded = 'true';
    });
}

async function toggleReaction(messageId, emoji) {
    try {
        console.log('Toggle reaction called for:', messageId, emoji);
        
        const userEmail = await getUserEmail();
        const companyEmail = await getMainCompanyEmail();
        const currentProject = await getCurrentProject();
        const emailPair = await getEmailPair(currentlyChattingWith);
        
        console.log('User email:', userEmail, 'Company:', companyEmail, 'Project:', currentProject, 'Email pair:', emailPair);
        
        // Get all messages to find the one with matching messageId
        const messagesPath = `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
        
        console.log('Messages path:', messagesPath);
        
        sendRuntimeMessage({
            action: "getFirebaseData",
            path: messagesPath
        }, async response => {
            console.log('Firebase response:', response);
            
            if (response && response.success && response.data) {
                const messages = response.data;
                let targetMessage = null;
                let targetMessageKey = null;
                
                console.log('All messages:', messages);
                
                // Find the message with matching messageId - improved matching logic
                let found = false;
                for (const [key, message] of Object.entries(messages)) {
                    console.log('Checking message:', key, 'messageId:', message.messageId, 'timestamp:', message.timestamp, 'against:', messageId);
                    
                    // Try multiple ways to match the message
                    if (message.messageId === messageId || 
                        message.timestamp === messageId || 
                        key === messageId ||
                        (message.timestamp && message.timestamp.toString() === messageId) ||
                        (message.messageId && message.messageId.toString() === messageId) ||
                        (key && key.toString() === messageId) ||
                        (message.messageId && message.messageId.toString() === messageId.toString()) ||
                        (message.timestamp && message.timestamp.toString() === messageId.toString())) {
                        targetMessage = message;
                        targetMessageKey = key;
                        console.log('Found target message:', targetMessage, 'with key:', targetMessageKey);
                        found = true;
                        break;
                    }
                }
                
                // If still not found, try a more flexible approach
                if (!found) {
                    console.log('Trying flexible message matching...');
                    for (const [key, message] of Object.entries(messages)) {
                        // Check if any part of the messageId matches
                        if (message.messageId && message.messageId.includes(messageId) ||
                            messageId.includes(message.messageId) ||
                            (message.timestamp && message.timestamp.toString().includes(messageId)) ||
                            messageId.includes(message.timestamp.toString())) {
                            targetMessage = message;
                            targetMessageKey = key;
                            console.log('Found target message with flexible matching:', targetMessage, 'with key:', targetMessageKey);
                            break;
                        }
                    }
                }
                
                if (targetMessage && targetMessageKey) {
                    // Initialize reactions if they don't exist
                    if (!targetMessage.reactions) {
                        targetMessage.reactions = {};
                    }
                    if (!targetMessage.reactions[emoji]) {
                        targetMessage.reactions[emoji] = {};
                    }
                    
                    console.log('Current reactions:', targetMessage.reactions);
                    
                    // Toggle reaction
                    if (targetMessage.reactions[emoji][userEmail]) {
                        // Remove reaction
                        delete targetMessage.reactions[emoji][userEmail];
                        console.log('Removed reaction for user:', userEmail);
                        // Remove emoji key if no reactions left
                        if (Object.keys(targetMessage.reactions[emoji]).length === 0) {
                            delete targetMessage.reactions[emoji];
                            console.log('Removed empty emoji key:', emoji);
                        }
                    } else {
                        // Add reaction
                        targetMessage.reactions[emoji][userEmail] = true;
                        console.log('Added reaction for user:', userEmail);
                    }
                    
                    console.log('Updated reactions:', targetMessage.reactions);
                    
                    // Update message in Firebase
                    const messagePath = `${messagesPath}/${targetMessageKey}`;
                    console.log('Saving to path:', messagePath);
                    
                    sendRuntimeMessage({
                        action: "saveFirebaseData",
                        path: messagePath,
                        data: targetMessage
                    }, updateResponse => {
                        console.log('Save response:', updateResponse);
                        if (updateResponse && updateResponse.success) {
                            console.log('Reaction updated successfully in Firebase');
                            
                            // Update the UI immediately
                            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                            if (messageElement) {
                                console.log('Updating reactions display for message:', messageId);
                                updateReactionsDisplay(messageElement, targetMessage.reactions);
                                
                                console.log('Updating emoji toolbar selection for message:', messageId);
                                updateEmojiToolbarSelection(messageElement, emoji, userEmail, targetMessage.reactions);
                            } else {
                                console.error('Message element not found for ID:', messageId);
                            }
                            
                        } else {
                            console.error('Failed to update reaction:', updateResponse?.error);
                        }
                    });
                } else {
                    console.error('Target message not found for messageId:', messageId);
                }
            } else {
                console.error('Failed to get messages from Firebase:', response);
            }
        });
        
    } catch (error) {
        console.error('Error toggling reaction:', error);
    }
}

function updateReactionsDisplay(messageElement, reactions) {
    if (!messageElement) return;
    
    const reactionsDisplay = messageElement.querySelector('.reactions-display');
    if (!reactionsDisplay) return;
    
    // Clear existing reactions
    reactionsDisplay.innerHTML = '';
    
    // Add reactions that have users
    if (reactions && typeof reactions === 'object') {
        const emojis = ['👍', '❤️', '😂', '😮', '🙂'];
        emojis.forEach(emoji => {
            if (reactions[emoji] && Object.keys(reactions[emoji]).length > 0) {
                const count = Object.keys(reactions[emoji]).length;
                const reactionSpan = document.createElement('span');
                reactionSpan.className = 'reaction-item';
                reactionSpan.dataset.emoji = emoji;
                reactionSpan.dataset.messageId = messageElement.dataset.messageId;
                reactionSpan.textContent = `${emoji} ${count}`;
                reactionSpan.title = 'Click to see who reacted';
                
                // Add click event to show who reacted
                reactionSpan.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showReactionDetails(messageElement.dataset.messageId, emoji, e);
                });
                
                reactionsDisplay.appendChild(reactionSpan);
            }
        });
    }
}

function updateEmojiToolbarSelection(messageElement, emoji, userEmail, reactions) {
    if (!messageElement) return;
    
    const emojiOption = messageElement.querySelector(`[data-emoji="${emoji}"]`);
    if (!emojiOption) return;
    
    // Update selection state
    if (reactions[emoji] && reactions[emoji][userEmail]) {
        emojiOption.classList.add('selected');
    } else {
        emojiOption.classList.remove('selected');
    }
}

async function showReactionDetails(messageId, emoji, event) {
    try {
        const companyEmail = await getMainCompanyEmail();
        const currentProject = await getCurrentProject();
        const emailPair = await getEmailPair(currentlyChattingWith);
        
        // Format company email for Firebase paths (replace dots with commas)
        const formattedCompanyEmail = (companyEmail || '').replace(/\./g, ',');
        
        const messagesPath = `Companies/${formattedCompanyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
        
        sendRuntimeMessage({
            action: "getFirebaseData",
            path: messagesPath
        }, async response => {
            if (response && response.success && response.data) {
                const messages = response.data;
                let targetMessage = null;
                
                // Find the message with matching messageId
                for (const [key, message] of Object.entries(messages)) {
                    if (message.messageId === messageId || message.timestamp === messageId) {
                        targetMessage = message;
                        break;
                    }
                }
                
                if (targetMessage && targetMessage.reactions && targetMessage.reactions[emoji]) {
                    const reactors = Object.keys(targetMessage.reactions[emoji]);
                    const reactorNames = [];
                    
                    // Get names for each reactor
                    for (const reactorEmail of reactors) {
                        const userName = await getUserNameFromEmail(reactorEmail);
                        reactorNames.push(userName || reactorEmail);
                    }
                    
                    // Show tooltip with reactor names
                    showReactionTooltip(emoji, reactorNames, event);
                }
            }
        });
        
    } catch (error) {
        console.error('Error showing reaction details:', error);
    }
}

async function getUserNameFromEmail(email) {
    try {
        const companyEmail = await getMainCompanyEmail();
        const userPath = `Companies/${companyEmail}/users/${email}`;
        
        return new Promise((resolve) => {
            sendRuntimeMessage({
                action: "getFirebaseData",
                path: userPath
            }, response => {
                if (response && response.success && response.data && response.data.name) {
                    resolve(response.data.name);
                } else {
                    resolve(email);
                }
            });
        });
    } catch (error) {
        console.error('Error getting user name:', error);
        return email;
    }
}

function showReactionTooltip(emoji, reactorNames, event) {
    // Remove existing tooltip
    const existingTooltip = document.querySelector('.reaction-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'reaction-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-header">${emoji} Reacted by:</div>
        <div class="tooltip-content">
            ${reactorNames.join(', ')}
        </div>
    `;
    
    // Position tooltip near the cursor
    tooltip.style.position = 'fixed';
    tooltip.style.left = (event.clientX + 10) + 'px';
    tooltip.style.top = (event.clientY - 60) + 'px';
    tooltip.style.zIndex = '10000';
    
    document.body.appendChild(tooltip);
    
    // Auto-remove tooltip after 3 seconds
    setTimeout(() => {
        if (tooltip.parentNode) {
            tooltip.remove();
        }
    }, 3000);
    
    // Remove tooltip on click outside
    document.addEventListener('click', function removeTooltip() {
        if (tooltip.parentNode) {
            tooltip.remove();
        }
        document.removeEventListener('click', removeTooltip);
    });
}

async function getEmailPair(otherEmail) {
    otherEmail = otherEmail.replace(".", ",");
    var userEmail = await getUserEmail();
    var emailPair = "";
    if (otherEmail == "everyone")
        emailPair = "everyone";
    else {
        if (userEmail < otherEmail)
            emailPair = userEmail + "-" + otherEmail;
        else
            emailPair = otherEmail + "-" + userEmail;
    }
    return emailPair;
}

// ===== DOCUMENT MANAGEMENT FUNCTIONS =====

// Store for document data (in-memory cache)
const documentCache = {};

// Helper: Get file icon based on extension
function getFileIconForMessage(ext) {
    const upperExt = ext.toUpperCase();
    
    // Audio files - Purple
    const audioIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
    if (['MP3', 'WAV', 'M4A', 'FLAC', 'AAC', 'OGG', 'WMA', 'AIFF'].includes(upperExt)) return audioIcon;
    
    // Video files - Pink
    const videoIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
    if (['MP4', 'MOV', 'AVI', 'MKV', 'WEBM', 'FLV', 'WMV', 'MPEG', 'MPG'].includes(upperExt)) return videoIcon;
    
    // Image files - Cyan
    const imageIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    if (['JPG', 'JPEG', 'PNG', 'GIF', 'SVG', 'WEBP', 'BMP', 'ICO', 'TIFF'].includes(upperExt)) return imageIcon;
    
    // Code files - Yellow/Amber
    const codeIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
    if (['JS', 'TS', 'JSX', 'TSX', 'PY', 'JAVA', 'CPP', 'C', 'H', 'CS', 'PHP', 'RB', 'GO', 'RS', 'SWIFT', 'KT', 'HTML', 'CSS', 'SCSS', 'LESS', 'JSON', 'XML', 'YAML', 'YML', 'SQL', 'SH', 'BASH'].includes(upperExt)) return codeIcon;
    
    // Archive files - Brown/Gray
    const archiveIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#78716c" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ', 'BZ2', 'XZ', 'ISO'].includes(upperExt)) return archiveIcon;
    
    // Markdown - Indigo
    const markdownIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9v6M10 9v6M10 12h4M14 9v6"/></svg>`;
    if (['MD', 'MARKDOWN'].includes(upperExt)) return markdownIcon;
    
    // Document icons with original colors
    const icons = {
        'PDF': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`,
        'DOC': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`,
        'DOCX': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`,
        'TXT': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`,
        'RTF': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`,
        'PPT': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><circle cx="10" cy="13" r="2"/><path d="M20 17c0 1.5-1.5 2-3 2s-3-.5-3-2 1.5-2 3-2 3 .5 3 2z"/></svg>`,
        'PPTX': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><circle cx="10" cy="13" r="2"/><path d="M20 17c0 1.5-1.5 2-3 2s-3-.5-3-2 1.5-2 3-2 3 .5 3 2z"/></svg>`,
        'XLS': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M8 13v4"/><path d="M12 13v4"/><path d="M16 13v4"/><path d="M8 17h8"/></svg>`,
        'XLSX': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M8 13v4"/><path d="M12 13v4"/><path d="M16 13v4"/><path d="M8 17h8"/></svg>`,
        'CSV': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M8 13v4"/><path d="M12 13v4"/><path d="M16 13v4"/><path d="M8 17h8"/></svg>`,
        'ODT': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`,
        'ODS': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M8 13v4"/><path d="M12 13v4"/><path d="M16 13v4"/><path d="M8 17h8"/></svg>`,
        'ODP': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><circle cx="10" cy="13" r="2"/><path d="M20 17c0 1.5-1.5 2-3 2s-3-.5-3-2 1.5-2 3-2 3 .5 3 2z"/></svg>`
    };
    
    return icons[upperExt] || `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`;
}

// Helper: Format file size
function formatFileSizeForMessage(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Create document message HTML
function createDocumentMessageHTML(doc) {
    // Store in cache for preview/download
    documentCache[doc.id] = doc;
    
    const fileIcon = getFileIconForMessage(doc.extension);
    const fileSize = formatFileSizeForMessage(doc.size);
    const timeFormatted = new Date(doc.timestamp).toLocaleString();
    
    return `
        <div class="document-message-card" data-doc-id="${doc.id}">
            <div class="document-msg-header">
                <div class="document-msg-icon">${fileIcon}</div>
                <div class="document-msg-info">
                    <div class="document-msg-name" title="${doc.name}">${doc.name}</div>
                    <div class="document-msg-meta">
                        <span class="document-msg-type">${doc.extension}</span>
                        <span class="document-msg-size">${fileSize}</span>
                        <span class="document-msg-time">${timeFormatted}</span>
                    </div>
                </div>
            </div>
            <div class="document-msg-actions">
                <button class="document-msg-btn preview-doc-msg-btn" onclick="window.previewDocumentMessage('${doc.id}')" title="Preview">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5c-7.633 0-9.927 6.617-9.948 6.684L1.946 12l.105.316C2.073 12.383 4.367 19 12 19s9.927-6.617 9.948-6.684l.106-.316l-.105-.316C21.927 11.617 19.633 5 12 5zm0 11c-2.206 0-4-1.794-4-4s1.794-4 4-4s4 1.794 4 4s-1.794 4-4 4z"/><path d="M12 10c-1.084 0-2 .916-2 2s.916 2 2 2s2-.916 2-2s-.916-2-2-2z"/></svg>
                    Preview
                </button>
                <button class="document-msg-btn download-doc-msg-btn" onclick="window.downloadDocumentMessage('${doc.id}')" title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-5-5l1.41-1.41L11 12.17V4h2v8.17l2.59-2.58L17 11l-5 5zm5-6h2v10H5V10h2v8h10v-8z"/></svg>
                    Download
                </button>
            </div>
        </div>
    `;
}

// Save document to Firebase
async function saveDocumentToFirebase(doc) {
    return new Promise(async (resolve, reject) => {
        try {
            const companyEmail = await getMainCompanyEmail();
            const userEmail = currentlyChattingWith;
            const currentProj = await getCurrentProject();
            
            if (!companyEmail) {
                console.error('[Document] No company email found');
                reject(new Error('No company email found'));
                return;
            }

            const emailPair = await getEmailPair(userEmail);
            const documentPath = `Companies/${companyEmail}/securedProjects/${currentProj}/documents/${currentTopic}/${emailPair}/${doc.id}`;
            
            const userEmailFormatted = (await getUserEmail()).replace('.', ',');
            
            console.log('[Document] Saving to Firebase:', doc.name, 'at path:', documentPath);
            
            // Use sendRuntimeMessage for extension context
            sendRuntimeMessage({
                action: "saveFirebaseData",
                path: documentPath,
                data: {
                    id: doc.id,
                    name: doc.name,
                    type: doc.type,
                    size: doc.size,
                    extension: doc.extension,
                    dataUrl: doc.dataUrl,
                    timestamp: doc.timestamp,
                    uploadedBy: userEmailFormatted
                }
            }, response => {
                if (response && response.success) {
                    console.log('[Document] ✅ Saved to Firebase:', doc.name);
                    resolve(response);
                } else {
                    console.error('[Document] ❌ Failed to save:', response?.error);
                    reject(new Error(response?.error || 'Failed to save document'));
                }
            });
        } catch (error) {
            console.error('[Document] Error saving to Firebase:', error);
            reject(error);
        }
    });
}

// Preview document in new Chrome tab
window.previewDocumentMessage = function(docId) {
    const doc = documentCache[docId];
    if (!doc) {
        console.error('[Document] Not found in cache:', docId);
        
        // Try to fetch from Firebase
        (async () => {
            const companyEmail = await getMainCompanyEmail();
            const userEmail = currentlyChattingWith;
            const currentProj = await getCurrentProject();
            const emailPair = await getEmailPair(userEmail);
            const documentPath = `Companies/${companyEmail}/securedProjects/${currentProj}/documents/${currentTopic}/${emailPair}/${docId}`;
            
            sendRuntimeMessage({ action: "getFirebaseData", path: documentPath }, response => {
                if (response && response.success && response.data) {
                    documentCache[docId] = response.data;
                    window.previewDocumentMessage(docId);
                } else {
                    alert('Document not found. It may have been deleted.');
                }
            });
        })();
        return;
    }
    
    // Convert data URL to blob for better handling of large files
    if (doc.dataUrl) {
        try {
            // Extract base64 data and mime type from data URL
            const arr = doc.dataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            
            // Create blob and object URL
            const blob = new Blob([u8arr], { type: mime });
            const blobUrl = URL.createObjectURL(blob);
            
            // Open in new tab
            const newTab = window.open(blobUrl, '_blank');
            
            // Clean up the blob URL after a delay (to allow the tab to load)
            setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
            }, 1000);
            
            console.log('[Document] Opened in new tab:', doc.name);
        } catch (error) {
            console.error('[Document] Error creating preview:', error);
            alert('Error opening preview. Try downloading the file instead.');
        }
    } else {
        alert('Preview not available for this file type.');
    }
};

// Download document
window.downloadDocumentMessage = function(docId) {
    const doc = documentCache[docId];
    if (!doc) {
        console.error('[Document] Not found in cache:', docId);
        
        // Try to fetch from Firebase
        (async () => {
            const companyEmail = await getMainCompanyEmail();
            const userEmail = currentlyChattingWith;
            const currentProj = await getCurrentProject();
            const emailPair = await getEmailPair(userEmail);
            const documentPath = `Companies/${companyEmail}/securedProjects/${currentProj}/documents/${currentTopic}/${emailPair}/${docId}`;
            
            sendRuntimeMessage({ action: "getFirebaseData", path: documentPath }, response => {
                if (response && response.success && response.data) {
                    documentCache[docId] = response.data;
                    window.downloadDocumentMessage(docId);
                } else {
                    alert('Document not found. It may have been deleted.');
                }
            });
        })();
        return;
    }
    
    const a = document.createElement('a');
    a.href = doc.dataUrl;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    console.log('[Document] Downloaded:', doc.name);
};

// Load documents into cache from messages
async function loadDocumentsIntoCache() {
    try {
        const messagesList = document.getElementById('messages-list');
        if (!messagesList) {
            console.log('[Document] Messages list not found');
            return;
        }
        
        // Find all document cards in messages
        const documentCards = messagesList.querySelectorAll('.document-message-card[data-doc-id]');
        if (documentCards.length === 0) {
            console.log('[Document] No document cards found in messages');
            return;
        }
        
        console.log(`[Document] Loading ${documentCards.length} documents into cache...`);
        
        const companyEmail = await getMainCompanyEmail();
        if (!companyEmail) {
            console.error('[Document] No company email found');
            return;
        }
        
        const userEmail = currentlyChattingWith;
        if (!userEmail) {
            console.error('[Document] No user email found');
            return;
        }
        
        const currentProj = await getCurrentProject();
        if (!currentProj) {
            console.error('[Document] No current project found');
            return;
        }
        
        if (!currentTopic) {
            console.error('[Document] No current topic found');
            return;
        }
        
        const emailPair = await getEmailPair(userEmail);
        
        // Load each document from Firebase
        const loadPromises = [];
        for (const card of documentCards) {
            const docId = card.dataset.docId;
            
            // Skip if already cached
            if (documentCache[docId]) {
                console.log(`[Document] Already cached: ${docId}`);
                continue;
            }
            
            const documentPath = `Companies/${companyEmail}/securedProjects/${currentProj}/documents/${currentTopic}/${emailPair}/${docId}`;
            console.log(`[Document] Fetching from path: ${documentPath}`);
            
            // Create a promise for each document fetch
            const loadPromise = new Promise((resolve) => {
                sendRuntimeMessage({ action: "getFirebaseData", path: documentPath }, response => {
                    if (response && response.success && response.data) {
                        documentCache[docId] = response.data;
                        console.log(`[Document] ✅ Cached: ${response.data.name} (${docId})`);
                    } else {
                        console.error(`[Document] ❌ Failed to load document ${docId}:`, response?.error || 'No data returned');
                        // Try alternative path (reverse email pair order)
                        const reverseEmailPair = emailPair.split('-').reverse().join('-');
                        const altPath = `Companies/${companyEmail}/securedProjects/${currentProj}/documents/${currentTopic}/${reverseEmailPair}/${docId}`;
                        console.log(`[Document] Trying alternative path: ${altPath}`);
                        sendRuntimeMessage({ action: "getFirebaseData", path: altPath }, altResponse => {
                            if (altResponse && altResponse.success && altResponse.data) {
                                documentCache[docId] = altResponse.data;
                                console.log(`[Document] ✅ Cached from alternative path: ${altResponse.data.name} (${docId})`);
                            } else {
                                console.error(`[Document] ❌ Alternative path also failed for ${docId}`);
                            }
                            resolve();
                        });
                        return;
                    }
                    resolve();
                });
            });
            loadPromises.push(loadPromise);
        }
        
        // Wait for all documents to load
        await Promise.all(loadPromises);
        console.log(`[Document] Finished loading ${loadPromises.length} documents into cache`);
    } catch (error) {
        console.error('[Document] Error loading into cache:', error);
    }
}

// ===== END DOCUMENT MANAGEMENT FUNCTIONS =====

// ===== DRAFT MANAGEMENT FUNCTIONS =====

/**
 * Get the Firebase path for storing drafts
 * @param {string} type - 'main' or 'thread'
 * @param {string} threadId - Optional thread ID for thread drafts
 * @returns {Promise<string>} Firebase path for the draft
 */
async function getDraftPath(type = 'main', threadId = null) {
    const companyEmail = await getMainCompanyEmail();
    const currentProject = await getCurrentProject();
    const emailPair = await getEmailPair(currentlyChattingWith);
    const userEmail = await getUserEmail();
    
    if (type === 'thread' && threadId) {
        return `Companies/${companyEmail}/securedProjects/${currentProject}/drafts/${currentTopic}/${emailPair}/thread/${threadId}/${userEmail}`;
    } else {
        return `Companies/${companyEmail}/securedProjects/${currentProject}/drafts/${currentTopic}/${emailPair}/main/${userEmail}`;
    }
}

/**
 * Save draft to Firebase
 * @param {string} content - Draft content (HTML)
 * @param {string} type - 'main' or 'thread'
 * @param {string} threadId - Optional thread ID for thread drafts
 */
async function saveDraft(content, type = 'main', threadId = null) {
    try {
        if (!currentlyChattingWith || !currentTopic) {
            console.log('[Draft] Skipping save - no active chat or topic', { currentlyChattingWith, currentTopic });
            return;
        }
        
        const draftPath = await getDraftPath(type, threadId);
        console.log('[Draft] Saving draft to path:', draftPath);
        
        // Only save if there's actual content
        if (!content || !content.trim()) {
            // If empty, clear the draft
            console.log('[Draft] Content is empty, clearing draft');
            await clearDraft(type, threadId);
            return;
        }
        
        const draftData = {
            content: content,
            timestamp: new Date().toISOString(),
            type: type,
            threadId: threadId || null
        };
        
        sendRuntimeMessage({
            action: "saveFirebaseData",
            path: draftPath,
            data: draftData
        }, (response) => {
            if (response && response.success) {
                console.log('[Draft] ✅ Draft saved successfully:', draftPath, 'Content length:', content.length);
            } else {
                console.error('[Draft] ❌ Failed to save draft:', response?.error);
            }
        });
    } catch (error) {
        console.error('[Draft] Error saving draft:', error);
    }
}

/**
 * Load draft from Firebase
 * @param {string} type - 'main' or 'thread'
 * @param {string} threadId - Optional thread ID for thread drafts
 * @returns {Promise<string|null>} Draft content or null
 */
async function loadDraft(type = 'main', threadId = null) {
    try {
        if (!currentlyChattingWith || !currentTopic) {
            return null;
        }
        
        const draftPath = await getDraftPath(type, threadId);
        
        return new Promise((resolve) => {
            sendRuntimeMessage({
                action: "getFirebaseData",
                path: draftPath
            }, (response) => {
                if (response && response.success && response.data && response.data.content) {
                    console.log('[Draft] ✅ Draft loaded:', draftPath, 'Content length:', response.data.content.length);
                    resolve(response.data.content);
                } else {
                    console.log('[Draft] No draft found at path:', draftPath, 'Response:', response);
                    resolve(null);
                }
            });
        });
    } catch (error) {
        console.error('[Draft] Error loading draft:', error);
        return null;
    }
}

/**
 * Clear draft from Firebase
 * @param {string} type - 'main' or 'thread'
 * @param {string} threadId - Optional thread ID for thread drafts
 */
async function clearDraft(type = 'main', threadId = null) {
    try {
        if (!currentlyChattingWith || !currentTopic) {
            return;
        }
        
        const draftPath = await getDraftPath(type, threadId);
        
        sendRuntimeMessage({
            action: "saveFirebaseData",
            path: draftPath,
            data: null // Setting to null deletes the node
        }, (response) => {
            if (response && response.success) {
                console.log('[Draft] ✅ Draft cleared:', draftPath);
            } else {
                console.error('[Draft] ❌ Failed to clear draft:', response?.error);
            }
        });
    } catch (error) {
        console.error('[Draft] Error clearing draft:', error);
    }
}

/**
 * Auto-save draft with debouncing (for main chat)
 * @param {HTMLElement} inputElement - The input element
 */
function autoSaveDraft(inputElement) {
    if (draftSaveTimer) {
        clearTimeout(draftSaveTimer);
    }
    
    draftSaveTimer = setTimeout(async () => {
        const content = inputElement.innerHTML || inputElement.textContent || '';
        if (content && content.trim()) {
            console.log('[Draft] Auto-saving draft (main chat)...');
            await saveDraft(content, 'main');
            // Also save active chat state when draft is saved
            saveActiveChatState();
        }
    }, 2000); // Save after 2 seconds of no typing
}

/**
 * Auto-save draft with debouncing (for thread input)
 * @param {HTMLElement} inputElement - The input element
 */
function autoSaveThreadDraft(inputElement) {
    if (threadDraftSaveTimer) {
        clearTimeout(threadDraftSaveTimer);
    }
    
    threadDraftSaveTimer = setTimeout(async () => {
        if (!currentThreadContext) return;
        const content = inputElement.textContent || inputElement.innerText || '';
        await saveDraft(content, 'thread', currentThreadContext);
    }, 2000); // Save after 2 seconds of no typing
}

/**
 * Restore drafts for active chat and thread (if any)
 * Called on page load, extension reopen, or when messaging panel becomes visible
 */
async function restoreDrafts() {
    try {
        console.log('[Draft] Attempting to restore drafts...', {
            currentlyChattingWith,
            currentTopic,
            messagesPanelVisible: document.getElementById('contacts-panel-messages')?.style.display !== 'none'
        });
        
        // Try to restore active chat state from localStorage if not set
        if ((!currentlyChattingWith || currentlyChattingWith === "" || !currentTopic)) {
            console.log('[Draft] No active chat state, trying to restore from localStorage...');
            const restored = await restoreActiveChatState();
            if (!restored) {
                console.log('[Draft] No active chat to restore drafts for');
                return;
            }
        }
        
        // Check if messages panel is visible
        const messagesPanel = document.getElementById('contacts-panel-messages');
        if (!messagesPanel || messagesPanel.style.display === 'none') {
            console.log('[Draft] Messages panel not visible, skipping draft restoration');
            return;
        }
        
        // Check if thread panel is open
        const threadPanel = document.getElementById('thread-panel');
        const isThreadOpen = threadPanel && threadPanel.style.display !== 'none' && currentThreadContext;
        
        if (isThreadOpen) {
            // Restore thread draft
            const threadInput = document.getElementById('thread-message-input');
            if (threadInput && currentThreadContext) {
                const draftContent = await loadDraft('thread', currentThreadContext);
                if (draftContent) {
                    threadInput.textContent = draftContent;
                    threadInput.innerText = draftContent;
                    console.log('[Draft] ✅ Thread draft restored:', draftContent.substring(0, 50));
                } else {
                    console.log('[Draft] No thread draft found');
                }
            }
        } else {
            // Restore main chat draft
            const newMessageInput = document.getElementById('new-message');
            if (newMessageInput) {
                const draftContent = await loadDraft('main');
                if (draftContent) {
                    newMessageInput.innerHTML = draftContent;
                    // Trigger auto-resize
                    setTimeout(() => {
                        newMessageInput.dispatchEvent(new Event('input'));
                    }, 100);
                    console.log('[Draft] ✅ Main chat draft restored:', draftContent.substring(0, 50));
                } else {
                    console.log('[Draft] No main chat draft found');
                }
            } else {
                console.log('[Draft] Input element not found');
            }
        }
    } catch (error) {
        console.error('[Draft] Error restoring drafts:', error);
    }
}

// ===== END DRAFT MANAGEMENT FUNCTIONS =====

async function postNewMessage(text, isScheduled = false) {
    try {
        // Check if this is a document message (contains document-message-card)
        const isDocumentMessage = text && text.includes('document-message-card');
        
        // Clean up the text content - remove unwanted line breaks but preserve formatting
        // Skip cleaning for document messages to preserve HTML structure
        if (text && !isDocumentMessage) {
            // Remove empty lines and normalize line breaks
            text = text.replace(/<br\s*\/?>/gi, ' ').replace(/\n/g, ' ').replace(/\r/g, '');
            // Clean up multiple spaces
            text = text.replace(/\s+/g, ' ').trim();
        }
        
        if (currentlyChattingWith == "")
            return;

        var companyEmail = await getMainCompanyEmail();
        var userEmail = await getUserEmail();
        var userName = await getUserName();
        
        // Create a consistent timestamp for both messageId and Firebase key
        const timestamp = Date.now();
        const message = {
            text: text,
            email: userEmail,
            name: userName,
            timestamp: new Date(timestamp).toISOString(),
            messageId: timestamp.toString(),
            reactions: {},
            editedAt: null,
            isScheduled: isScheduled
        };
        
        // Add reply context if replying to a message
        if (currentReplyContext) {
            message.replyTo = {
                messageId: currentReplyContext.messageId,
                author: currentReplyContext.author,
                text: stripHtmlTags(currentReplyContext.text),
                timestamp: currentReplyContext.timestamp
            };
        }
        
        // Add threadId if replying in a thread
        if (currentThreadContext) {
            message.threadId = String(currentThreadContext);
            // Clear reply context when in thread (mutual exclusivity)
            currentReplyContext = null;
        }

        // Save to Firebase through background script
        var companyEmail = await getMainCompanyEmail();
        var currentProject = await getCurrentProject();
        var emailPair = await getEmailPair(currentlyChattingWith);
        
        // Format company email for Firebase paths (replace dots with commas)
        const formattedCompanyEmail = (companyEmail || '').replace(/\./g, ',');
        
        // Use privateMessages path for 1-on-1 conversations (truly private, cross-company)
        // Use company path for "everyone" messages (project-wide announcements)
        let firebasePath;
        if (emailPair === 'everyone') {
            // Project-wide messages stay in company path
            firebasePath = `Companies/${formattedCompanyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}/${timestamp}`;
        } else {
            // Private 1-on-1 messages go to neutral privateMessages path (independent of company ownership)
            firebasePath = `privateMessages/${emailPair}/${currentProject}/${currentTopic}/${timestamp}`;
        }
        
        console.log('Saving message with ID:', timestamp, 'to path:', firebasePath);
        console.log('Current topic:', currentTopic, 'Current project:', currentProject, 'Email pair:', emailPair);
        
        sendRuntimeMessage({
            action: "saveFirebaseData",
            path: firebasePath,
            data: message
        }, async response => {
            if (!response || !response.success) {
                console.error('Error saving message:', response?.error);
                alert('Failed to post comment. Please try again.');
                return;
            }

            console.log('Message saved successfully - Firebase listener will update UI automatically');
            // Clear reply card after successful send
            removeReplyCard();
            // Don't call loadMessages() here - the Firebase listener will fire automatically
            // and update the UI. This ensures real-time updates work for both users.
            // The listener callback will handle:
            // - Adding new messages
            // - Updating thread counts
            // - Updating reactions
            // Refresh contact previews to show the new message
            await refreshContactPreviews();
        });

    } catch (error) {
        console.error('Error posting message:', error);
        alert('Failed to post message. Please try again.');
    }
}

var currentMessagesPath = "";
async function loadMessages() {
    if (currentlyChattingWith == "")
        return;
    if (currentTopic == "")
        return;

    var companyEmail = await getMainCompanyEmail();
    var currentProject = await getCurrentProject();
    var emailPair = await getEmailPair(currentlyChattingWith);
    // Format company email for Firebase paths (replace dots with commas)
    const formattedCompanyEmail = (companyEmail || '').replace(/\./g, ',');
    
    // Use privateMessages path for 1-on-1 conversations (truly private, cross-company)
    // Use company path for "everyone" messages (project-wide announcements)
    var newPath;
    if (emailPair === 'everyone') {
        // Project-wide messages stay in company path
        newPath = `Companies/${formattedCompanyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
    } else {
        // Private 1-on-1 messages go to neutral privateMessages path (independent of company ownership)
        newPath = `privateMessages/${emailPair}/${currentProject}/${currentTopic}`;
    }
    
    let list = document.getElementById("messages-list");
    if (newPath == currentMessagesPath && previousMessagesHTML) {
        // Path is the same AND we have cached HTML - restore it for quick display
        // Listener is already active and will update in real-time
        list.innerHTML = previousMessagesHTML;
        console.log('📌 Path unchanged, listener should already be active for:', newPath);
        return; // Don't set up a new listener, the existing one should handle updates
    }
    else {
        if (currentMessagesPath != "")
            removeFirebaseListener(currentMessagesPath);

        currentMessagesPath = newPath;

        listenerFirebaseData(currentMessagesPath, async (path, data) => {
            // Always process updates, even if path check fails (defensive programming)
            if (path !== currentMessagesPath) {
                console.warn('⚠️ Listener path mismatch. Expected:', currentMessagesPath, 'Got:', path);
                // Still process if it's close enough (might be a timing issue)
                if (!path.includes(currentMessagesPath) && !currentMessagesPath.includes(path)) {
                    return; // Completely different path, ignore
                }
            }
            
            console.log('🔥 Firebase listener FIRED for path:', path);
            console.log('📊 Data received - keys:', data ? Object.keys(data).length : 0, 'messages');
            
            var list = document.getElementById("messages-list");
            if (!list) {
                console.warn('⚠️ Messages list not found, skipping update');
                return;
            }
            
            var userEmail = await getUserEmail();
            let allMessages = data ? Object.values(data) : [];
            console.log('📨 Total messages (including thread replies):', allMessages.length);
            
            // Extract messageId from Firebase key if not present
            if (data) {
                Object.entries(data).forEach(([firebaseKey, msg]) => {
                    if (msg && !msg.messageId) {
                        msg.messageId = String(firebaseKey);
                    }
                });
            }
            
            // Calculate thread counts and last reply timestamps from ALL messages (including thread replies)
            const threadCounts = {};
            const threadLastReplyTimestamps = {};
            allMessages.forEach((msg) => {
                if (msg && msg.threadId) {
                    const parentMsgId = String(msg.threadId);
                    threadCounts[parentMsgId] = (threadCounts[parentMsgId] || 0) + 1;
                    
                    // Track the most recent reply timestamp for each thread
                    const replyTimestamp = msg.timestamp ? new Date(msg.timestamp).getTime() : 0;
                    const currentLastReply = threadLastReplyTimestamps[parentMsgId];
                    if (!currentLastReply || replyTimestamp > currentLastReply) {
                        threadLastReplyTimestamps[parentMsgId] = replyTimestamp;
                    }
                }
            });
            
            console.log('🧵 Thread counts calculated:', threadCounts);
            console.log('🕒 Last reply timestamps calculated:', threadLastReplyTimestamps);
            
            // Filter out thread messages from main chat (only show non-thread messages)
            let messages = allMessages.filter(msg => !msg.threadId);
            console.log('💬 Main chat messages (excluding thread replies):', messages.length);
            
            // Sort messages: pinned first (by pinnedAt), then regular messages (by timestamp)
            messages.sort((a, b) => {
                const aPinned = a.isPinned ? 1 : 0;
                const bPinned = b.isPinned ? 1 : 0;
                
                // If one is pinned and the other isn't, pinned comes first
                if (aPinned !== bPinned) {
                    return bPinned - aPinned;
                }
                
                // If both are pinned, sort by pinnedAt (most recent first)
                if (aPinned && bPinned) {
                    const timeA = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
                    const timeB = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
                    return timeB - timeA;
                }
                
                // If neither is pinned, sort by timestamp (oldest first)
                const timeA = new Date(a.timestamp).getTime();
                const timeB = new Date(b.timestamp).getTime();
                return timeA - timeB;
            });
            
            // Add threadCount and lastReplyTimestamp to each message
            messages.forEach(msg => {
                const msgId = String(msg.messageId || msg.timestamp);
                msg.threadCount = threadCounts[msgId] || 0;
                const lastReplyTime = threadLastReplyTimestamps[msgId];
                if (lastReplyTime) {
                    msg.lastReplyTimestamp = new Date(lastReplyTime).toISOString();
                }
                if (msg.threadCount > 0) {
                    console.log(`✅ Message ${msgId} has ${msg.threadCount} thread replies${msg.lastReplyTimestamp ? ', last reply: ' + msg.lastReplyTimestamp : ''}`);
                }
            });
            
            // Add fake conversation for Mike Johnson about vectorization in machine learning
            console.log("Checking fake conversation for:", currentlyChattingWith);
            console.log("Current messages length:", messages.length);
            
            if (currentlyChattingWith === "mike,johnson@company,com" || currentlyChattingWith === "mike.johnson@company.com") {
                console.log("Loading fake conversation for Mike Johnson");
                const fakeMessages = [
                    {
                        messageId: Date.now() - 1800000, // 30 minutes ago
                        timestamp: Date.now() - 1800000,
                        text: "Hey! I've been working on some vectorization techniques for our ML pipeline. Have you had a chance to look at the new embedding models?",
                        userEmail: "mike.johnson@company.com",
                        userName: "Mike Johnson"
                    },
                    {
                        messageId: Date.now() - 1750000, // 29 minutes ago
                        timestamp: Date.now() - 1750000,
                        text: "I've been experimenting with different vectorization approaches. The TF-IDF baseline is giving us decent results, but I think we can do better with word2vec or even BERT embeddings.",
                        userEmail: userEmail,
                        userName: await getUserName()
                    },
                    {
                        messageId: Date.now() - 1700000, // 28 minutes ago
                        timestamp: Date.now() - 1700000,
                        text: "BERT embeddings would be interesting! The contextual understanding could really help with our text classification tasks. Have you tried any pre-trained models like sentence-transformers?",
                        userEmail: "mike.johnson@company.com",
                        userName: "Mike Johnson"
                    },
                    {
                        messageId: Date.now() - 1650000, // 27 minutes ago
                        timestamp: Date.now() - 1650000,
                        text: "Yes! I've been using sentence-transformers with the 'all-MiniLM-L6-v2' model. It's surprisingly fast and gives great semantic similarity scores. The dimensionality reduction is also much cleaner than traditional approaches.",
                        userEmail: userEmail,
                        userName: await getUserName()
                    },
                    {
                        messageId: Date.now() - 1600000, // 26 minutes ago
                        timestamp: Date.now() - 1600000,
                        text: "That's awesome! How are you handling the vector storage? Are you using something like FAISS for similarity search, or are you doing brute force comparisons?",
                        userEmail: "mike.johnson@company.com",
                        userName: "Mike Johnson"
                    },
                    {
                        messageId: Date.now() - 1550000, // 25 minutes ago
                        timestamp: Date.now() - 1550000,
                        text: "I'm actually using FAISS with the IndexFlatIP for inner product similarity. The performance is great for our dataset size. Have you tried any of the approximate nearest neighbor methods?",
                        userEmail: userEmail,
                        userName: await getUserName()
                    },
                    {
                        messageId: Date.now() - 1500000, // 24 minutes ago
                        timestamp: Date.now() - 1500000,
                        text: "Not yet, but I'm planning to experiment with IndexIVFFlat for larger datasets. The trade-off between accuracy and speed is something I want to optimize. Do you have any benchmarks on the vectorization quality?",
                        userEmail: "mike.johnson@company.com",
                        userName: "Mike Johnson"
                    },
                    {
                        messageId: Date.now() - 1450000, // 23 minutes ago
                        timestamp: Date.now() - 1450000,
                        text: "I've been using cosine similarity and getting around 0.85-0.92 for semantically similar documents. The clustering results are much more coherent than with TF-IDF. Want to collaborate on setting up some A/B tests?",
                        userEmail: userEmail,
                        userName: await getUserName()
                    },
                    {
                        messageId: Date.now() - 1400000, // 22 minutes ago
                        timestamp: Date.now() - 1400000,
                        text: "Absolutely! A/B testing would be perfect. We could compare the traditional bag-of-words approach against the transformer embeddings on our classification pipeline. I'll set up the infrastructure and we can run parallel experiments.",
                        userEmail: "mike.johnson@company.com",
                        userName: "Mike Johnson"
                    },
                    {
                        messageId: Date.now() - 1350000, // 21 minutes ago
                        timestamp: Date.now() - 1350000,
                        text: "Perfect! I'll prepare the baseline TF-IDF implementation and we can compare metrics like precision, recall, and processing time. Should we also test different vector dimensions to find the sweet spot?",
                        userEmail: userEmail,
                        userName: await getUserName()
                    }
                ];
                
                messages = fakeMessages;
                console.log("Fake messages loaded:", messages.length, "messages");
            }
            
            // Check what messages we currently have vs what we should have
            const existingMessageIds = Array.from(list.querySelectorAll('.comment-item')).map(el => el.dataset.messageId);
            const newMessageIds = messages.map(msg => String(msg.messageId || msg.timestamp));
            
            // Find messages that are new (not in existing list)
            const newMessages = messages.filter(msg => {
                const msgId = String(msg.messageId || msg.timestamp);
                return !existingMessageIds.includes(msgId);
            });
            
            // Find messages that were removed (in existing but not in new)
            const removedMessageIds = existingMessageIds.filter(id => !newMessageIds.includes(id));
            
            // Check if we need a full reload (only if messages were removed or if this is the first load)
            const needsFullReload = existingMessageIds.length === 0 || removedMessageIds.length > 0;
            
            console.log(`📊 Message diff: ${existingMessageIds.length} existing, ${newMessages.length} new, ${removedMessageIds.length} removed`);
            
            // Store previous thread counts to detect changes
            const previousThreadCounts = {};
            list.querySelectorAll('.comment-item').forEach(el => {
                const msgId = el.dataset.messageId;
                if (msgId) {
                    const countEl = el.querySelector('.thread-count-display');
                    if (countEl && countEl.style.display !== 'none') {
                        const countText = countEl.textContent || '';
                        const match = countText.match(/(\d+)/);
                        previousThreadCounts[msgId] = match ? parseInt(match[1]) : 0;
                    } else {
                        previousThreadCounts[msgId] = 0;
                    }
                }
            });
            
            // Function to update all thread counts (used in all branches)
            const updateAllThreadCounts = () => {
                let threadCountsChanged = false;
                messages.forEach(message => {
                    const msgId = String(message.messageId || message.timestamp);
                    const newCount = message.threadCount || 0;
                    const oldCount = previousThreadCounts[msgId] || 0;
                    
                    if (newCount !== oldCount) {
                        threadCountsChanged = true;
                        console.log(`Thread count changed for message ${msgId}: ${oldCount} -> ${newCount}`);
                    }
                    
                    const existingElement = list.querySelector(`[data-message-id="${msgId}"]`);
                    if (existingElement) {
                        // Update reactions if changed
                        if (message.reactions) {
                            updateReactionsDisplay(existingElement, message.reactions);
                        }
                        // ALWAYS update thread count (even if it's the same, to ensure it's visible)
                        if (message.threadCount !== undefined) {
                            updateThreadCountDisplay(existingElement, message.threadCount, message.lastReplyTimestamp);
                        }
                    }
                });
                
                if (threadCountsChanged) {
                    console.log('Thread counts updated in real-time');
                }
            };
            
            if (needsFullReload) {
                console.log('🔄 Full reload needed - clearing and rebuilding messages');
                list.innerHTML = "";
                
                for (var message of messages) {
                    const messageElement = await createMessageElement(message, userEmail);
                    list.appendChild(messageElement);
                }
                
                // Update thread counts after full reload
                updateAllThreadCounts();
                
                // Scroll to bottom smoothly
                if (list && list.lastChild) {
                    list.lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
            } else if (newMessages.length > 0) {
                console.log(`➕ Adding ${newMessages.length} new message(s) smoothly`);
                
                // Add only the new messages without scrolling until all are added
                for (var message of newMessages) {
                    const messageElement = await createMessageElement(message, userEmail);
                    list.appendChild(messageElement);
                }
                
                // ALWAYS update thread counts for ALL messages (in case new thread replies were added)
                // This is critical - thread replies are filtered out, so we need to update counts
                updateAllThreadCounts();
                
                // Smooth scroll to the last new message only once
                if (list && list.lastChild) {
                    list.lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
            } else {
                // No new main chat messages - only update thread counts if they changed
                updateAllThreadCounts();
            }

            if (messages.length == 0)
                list.innerHTML = "<div class='no-messages-container'><i class='fas fa-comments' style='font-size: 48px; color: #d1d5db; margin-bottom: 16px;'></i><span class='no-messages-text'>No messages found</span><span class='no-messages-subtitle'>Start a conversation by sending the first message</span></div>";

            previousMessagesHTML = list.innerHTML;
            
            // Load documents into cache for preview/download
            await loadDocumentsIntoCache();
            
            // Refresh contact previews when messages are loaded
            await refreshContactPreviews();
        });
    }

    // Fetch actual profile image from Firebase instead of using default
    const contactImgElement = document.getElementById("contact-img");
    if (contactImgElement && currentlyChattingWith && currentlyChattingWith !== "everyone") {
        try {
            const companyEmail = await getMainCompanyEmail();
            if (companyEmail) {
                // currentlyChattingWith is already formatted with commas, but ensure dots are replaced
                const userEmailFormatted = currentlyChattingWith.replace(/\./g, ',');
                const firebasePath = `Companies/${companyEmail}/users/${userEmailFormatted}/profileImage`;
                
                sendRuntimeMessage({
                    action: "getFirebaseData",
                    path: firebasePath
                }, (response) => {
                    if (response && response.success && response.data) {
                        contactImgElement.src = response.data;
                        // Update currentImg for consistency
                        currentImg = response.data;
                    } else {
                        // Fallback to passed image or default
                        contactImgElement.src = currentImg || 'img/default-profile.png';
                    }
                });
            } else {
                // Fallback if company email not found
                contactImgElement.src = currentImg || 'img/default-profile.png';
            }
        } catch (error) {
            console.error('Error fetching profile image from Firebase:', error);
            // Fallback to passed image or default
            contactImgElement.src = currentImg || 'img/default-profile.png';
        }
    } else {
        // For "everyone" or if element not found, use passed image or default
        if (contactImgElement) {
            if (currentlyChattingWith === "everyone") {
                contactImgElement.src = 'img/default-group.png';
            } else {
                contactImgElement.src = currentImg || 'img/default-profile.png';
            }
        }
    }
    
    document.getElementById("contact-img-name").innerHTML = currentName;
    
    // Add click handler to profile image
    const contactImg = document.getElementById("contact-img");
    if (contactImg) {
        // Remove any existing click listeners to prevent duplicates
        contactImg.removeEventListener('click', showContactProfilePage);
        // Add the click handler
        contactImg.addEventListener('click', function() {
            console.log('Profile image clicked, opening profile page...');
            showContactProfilePage();
        });
    }
}

var currentlyChattingWith = "";
var currentImg = "";
var currentName = "";
let previousMessagesHTML = "";

// Save active chat state to localStorage
function saveActiveChatState() {
    try {
        if (currentlyChattingWith && currentTopic) {
            localStorage.setItem('phraze_activeChat', JSON.stringify({
                email: currentlyChattingWith,
                img: currentImg,
                name: currentName,
                topic: currentTopic
            }));
            console.log('[Draft] Saved active chat state to localStorage');
        }
    } catch (error) {
        console.error('[Draft] Error saving active chat state:', error);
    }
}

// Restore active chat state from localStorage
async function restoreActiveChatState() {
    try {
        const savedState = localStorage.getItem('phraze_activeChat');
        if (savedState) {
            const state = JSON.parse(savedState);
            if (state.email && state.topic) {
                currentlyChattingWith = state.email;
                currentImg = state.img || '';
                currentName = state.name || '';
                // IMPORTANT: Only restore topic if currentTopic is empty or "general"
                // If currentTopic is already set to a groq chat, preserve it
                if (currentTopic === "" || currentTopic === "general" || !currentTopic) {
                currentTopic = state.topic;
                    // If it's a groq chat topic, extract the chat ID
                    if (state.topic && state.topic.startsWith("groqChats-")) {
                        const chatIdFromTopic = state.topic.replace("groqChats-", "");
                        if (chatIdFromTopic) {
                            currentChatId = chatIdFromTopic;
                        }
                    }
                }
                console.log('[Draft] Restored active chat state from localStorage:', state, 'Final topic:', currentTopic);
                return true;
            }
        }
    } catch (error) {
        console.error('[Draft] Error restoring active chat state:', error);
    }
    return false;
}

async function openChatWith(email, img, name) {
    // Add search button to header when opening a chat
    setTimeout(addSearchButtonToHeader, 100);
    
    let list = document.getElementById("messages-list");
    list.innerHTML = "";
    currentlyChattingWith = email.replace(".", ",");
    currentImg = img;
    currentName = name.replace(",", ".");
    
    // IMPORTANT: Preserve currentTopic - don't reset it when opening a chat
    // The currentTopic should already be set correctly (e.g., "groqChats-chat_xxx")
    // Only override if it's empty or if we need to extract from the topic string
    
    // If currentTopic is a groq chat topic, extract the chat ID and set currentChatId
    if (currentTopic && currentTopic.startsWith("groqChats-")) {
        const chatIdFromTopic = currentTopic.replace("groqChats-", "");
        if (chatIdFromTopic && !currentChatId) {
            currentChatId = chatIdFromTopic;
            console.log('[openChatWith] Extracted chat ID from topic:', currentChatId);
        }
    }
    
    // If currentTopic is empty or "general", try to restore from localStorage or currentChatId
    if (currentTopic === "" || currentTopic === "general") {
        // First, try to restore from currentChatId if available
        if (currentChatId) {
            currentTopic = "groqChats-" + currentChatId;
            console.log('[openChatWith] Restored groq chat topic from currentChatId:', currentTopic);
        } else {
            // Try to restore from localStorage
            try {
                const savedState = localStorage.getItem('phraze_activeChat');
                if (savedState) {
                    const state = JSON.parse(savedState);
                    if (state.topic && state.topic !== "general" && state.topic.startsWith("groqChats-")) {
                        currentTopic = state.topic;
                        // Extract chat ID from the topic
                        const chatIdFromTopic = state.topic.replace("groqChats-", "");
                        if (chatIdFromTopic) {
                            currentChatId = chatIdFromTopic;
                        }
                        console.log('[openChatWith] Restored topic from localStorage:', currentTopic);
                    } else if (currentTopic === "") {
                        // Only set to general if topic is truly empty and not a groq chat
                        currentTopic = "general";
                    }
                } else if (currentTopic === "") {
                    currentTopic = "general";
                }
            } catch (e) {
                console.warn('[openChatWith] Could not restore topic from localStorage:', e);
                if (currentTopic === "") {
                    currentTopic = "general";
                }
            }
        }
    }
    // If currentTopic already has a value (like "groqChats-chat_xxx"), preserve it - DO NOT OVERRIDE
    
    console.log('[openChatWith] Opening chat with:', email, 'Current topic:', currentTopic, 'Current chat ID:', currentChatId);
    
    // Save active chat state to localStorage
    saveActiveChatState();
    
    document.getElementById("contacts-panel-chooser").style.display = "none";
    document.getElementById("contacts-panel-messages").style.display = "flex";
    // Hide the search bar when opening a chat
    document.getElementById("messaging-search").style.display = "none";
    await loadMessages();
    
    // Load draft for this chat
    const newMessageInput = document.getElementById('new-message');
    if (newMessageInput) {
        const draftContent = await loadDraft('main');
        if (draftContent) {
            newMessageInput.innerHTML = draftContent;
            // Trigger auto-resize
            setTimeout(() => {
                newMessageInput.dispatchEvent(new Event('input'));
            }, 100);
        }
    }
    
    // Process any pending scheduled messages for this contact
    if (typeof processPendingScheduledMessages === 'function') {
        await processPendingScheduledMessages();
    }
}

// Helper function to extract message preview text, handling attachments
function extractMessagePreview(message) {
    if (!message || !message.text) {
        return "No messages yet";
    }
    
    const messageHtml = message.text.trim();
    let preview = "";
    
    // Check for image attachments BEFORE removing HTML tags
    // Match class="image-attachment" or class='image-attachment' (but not image-attachment-inner)
    // Also handle escaped quotes in stored HTML
    const imagePattern = /class\s*=\s*["']image-attachment["']/gi;
    const imageMatches = messageHtml.match(imagePattern);
    const imageCount = imageMatches ? imageMatches.length : 0;
    
    // Check for document attachments BEFORE removing HTML tags
    const documentPattern = /class\s*=\s*["']document-message-card["']/gi;
    const documentMatches = messageHtml.match(documentPattern);
    const documentCount = documentMatches ? documentMatches.length : 0;
    
    // Try to extract document names from document-message-card
    let documentNames = [];
    if (documentCount > 0) {
        const docNameMatches = messageHtml.match(/<div[^>]*class="[^"]*document-msg-name[^"]*"[^>]*title="([^"]+)"[^>]*>/gi);
        if (docNameMatches) {
            docNameMatches.forEach(match => {
                const nameMatch = match.match(/title="([^"]+)"/);
                if (nameMatch && nameMatch[1]) {
                    documentNames.push(nameMatch[1]);
                }
            });
        }
        // Fallback: try to extract from inner text
        if (documentNames.length === 0) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = messageHtml;
            const docNameElements = tempDiv.querySelectorAll('.document-msg-name');
            docNameElements.forEach(el => {
                const name = el.textContent || el.getAttribute('title') || '';
                if (name) documentNames.push(name);
            });
        }
    }
    
    // Build attachment previews
    const attachmentPreviews = [];
    
    // Handle attached highlights - check for HTML highlight cards
    if (messageHtml.includes("Attached highlight")) {
        const highlightMatch = messageHtml.match(/<div[^>]*>.*?Attached highlight.*?<div[^>]*>.*?"([^"]+)"<\/div>/s);
        if (highlightMatch && highlightMatch[1]) {
            attachmentPreviews.push(highlightMatch[1].trim());
        } else {
            const simpleMatch = messageHtml.match(/Attached highlight[:\s]*(.+)/);
            if (simpleMatch && simpleMatch[1]) {
                attachmentPreviews.push(simpleMatch[1].trim());
            } else {
                attachmentPreviews.push("Attached highlight");
            }
        }
    }
    
    if (imageCount > 0) {
        if (imageCount === 1) {
            attachmentPreviews.push("Image");
        } else {
            attachmentPreviews.push(`${imageCount} Images`);
        }
    }
    
    if (documentCount > 0) {
        if (documentCount === 1 && documentNames.length > 0) {
            // Show document name if available
            const docName = documentNames[0];
            const truncatedName = docName.length > 30 ? docName.substring(0, 30) + "..." : docName;
            attachmentPreviews.push(truncatedName);
        } else if (documentCount === 1) {
            attachmentPreviews.push("Document");
        } else {
            attachmentPreviews.push(`${documentCount} Documents`);
        }
    }
    
    // Extract plain text (remove HTML tags)
    let plainText = messageHtml.replace(/<[^>]*>/g, '').trim();
    
    // Combine previews
    if (attachmentPreviews.length > 0) {
        if (plainText) {
            // If there's both text and attachments, show attachments first, then text
            preview = attachmentPreviews.join(", ") + " • " + plainText;
        } else {
            // Only attachments, no text
            preview = attachmentPreviews.join(", ");
        }
    } else if (plainText) {
        // Only text, no attachments
        preview = plainText;
    } else {
        // No text, no attachments, no highlights
        preview = "No messages yet";
    }
    
    // Truncate long messages to approximately 100 characters
    if (preview.length > 100) {
        preview = preview.substring(0, 100) + "...";
    }
    
    return preview;
}

// SwipeableContactRow component for swipe-to-delete functionality
function createSwipeableContactRow(name, email, profileImage, message) {
    const container = document.createElement('div');
    container.className = 'swipeable-contact-container';
    
    const swipeableRow = document.createElement('div');
    swipeableRow.className = 'swipeable-contact-row';
    
    const contactBtn = document.createElement('button');
    contactBtn.className = 'contact-btn';
    
    const tableStyle = "style='background-color: unset; border: unset;'";
    const imgSrc = profileImage || 'img/default-profile.png';
    
    // Special handling for "Everyone" - use SVG instead of image
    let avatarHtml;
    if (email === "everyone") {
        avatarHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 48 48" class="contact-avatar">
            <path fill="currentColor" d="M11.5 11a3.5 3.5 0 1 1 7 0a3.5 3.5 0 0 1-7 0ZM15 5a6 6 0 1 0 0 12a6 6 0 0 0 0-12Zm14.5 6a3.5 3.5 0 1 1 7 0a3.5 3.5 0 0 1-7 0ZM33 5a6 6 0 1 0 0 12a6 6 0 0 0 0-12ZM4 22.446A3.446 3.446 0 0 1 7.446 19h9.624a7.947 7.947 0 0 0-.93 2.5H7.446a.946.946 0 0 0-.946.946v.429c0 .27.003 1.933 1.019 3.505c.896 1.388 2.723 2.92 6.684 3.102a5.469 5.469 0 0 0-2.464 2.223c-3.222-.632-5.18-2.203-6.32-3.968C4 25.54 4 23.27 4 22.877v-.43Zm29.797 7.036a5.469 5.469 0 0 1 2.464 2.223c3.222-.632 5.18-2.203 6.32-3.968C44 25.54 44 23.27 44 22.877v-.43A3.446 3.446 0 0 0 40.554 19H30.93c.44.763.76 1.605.93 2.5h8.694c.522 0 .946.424.946.946v.429c0 .27-.003 1.933-1.019 3.505c-.896 1.388-2.723 2.92-6.684 3.102ZM24 19.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7ZM18 23a6 6 0 1 1 12 0a6 6 0 0 1-12 0Zm-5 11.446A3.446 3.446 0 0 1 16.446 31h15.108A3.446 3.446 0 0 1 35 34.446v.431c0 .394 0 2.663-1.419 4.86C32.098 42.033 29.233 44 24 44s-8.098-1.967-9.581-4.263C13 37.54 13 35.27 13 34.877v-.43Zm3.446-.946a.946.946 0 0 0-.946.946v.429c0 .27.003 1.933 1.019 3.505c.954 1.478 2.964 3.12 7.481 3.12c4.517 0 6.527-1.642 7.481-3.12c1.016-1.572 1.019-3.235 1.019-3.505v-.429a.946.946 0 0 0-.946-.946H16.446Z"/>
        </svg>`;
    } else {
        avatarHtml = `<img src="${imgSrc}" class="contact-avatar" />`;
    }
    
    // Process message text for preview using helper function
    let messagePreview = extractMessagePreview(message);
    let messageTime = "";
    
    // Format timestamp
    if (message && message.timestamp) {
        messageTime = formatTime(new Date(message.timestamp));
    }
    
    contactBtn.innerHTML = `
        ${avatarHtml}
        <table>
            <tr ${tableStyle}>
                <td ${tableStyle}><span class="contact-name">${name.replace(",", ".")}</span></td><td class='contact-footer' style='text-align: right;'>${messageTime}</td>
            </tr>
            <tr ${tableStyle}>
            <td ${tableStyle} class='contact-footer' style='max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-top: 0;'>
            ${messagePreview}
            </td>
            </tr>
        </table>
    `;
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'contact-delete-btn';
    deleteBtn.innerHTML = 'Delete';
    deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
            await hideContactAndRemoveRow(email, container);
            console.log("Contact hidden:", email);
        } catch (err) {
            console.error('Failed to hide contact', email, err);
        }
    };
    
    // Assemble the swipeable row
    swipeableRow.appendChild(contactBtn);
    swipeableRow.appendChild(deleteBtn);
    container.appendChild(swipeableRow);
    
    // Add swipe functionality
    addSwipeFunctionality(swipeableRow, container);
    
    // Set up click handler for opening chat (suppressed if swiped open or just dragged)
    contactBtn.addEventListener('click', (e) => {
        const isOpen = swipeableRow.dataset.open === 'true';
        const justDragged = swipeableRow.dataset.justDragged === 'true';
        if (isOpen || justDragged) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        openChatWith(email, imgSrc, name);
    });
    
    return container;
}

// Add swipe functionality to a contact row
function addSwipeFunctionality(swipeableRow, container) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let startTime = 0;
    let initialOffset = 0; // starting translateX at gesture start
    let currentOffset = 0; // live translateX during gesture
    swipeableRow.dataset.open = 'false';
    swipeableRow.dataset.justDragged = 'false';

    const getOffsetFromTransform = () => {
        const t = swipeableRow.style.transform || '';
        const match = t.match(/translateX\(([-0-9.]+)px\)/);
        if (match) return parseFloat(match[1]);
        return 0;
    };

    const clampOffset = (offset) => Math.min(0, Math.max(-80, offset));
    
    // Touch events
    swipeableRow.addEventListener('touchstart', (e) => {
        if (!e.touches || e.touches.length === 0) return;
        startX = e.touches[0].clientX;
        startTime = Date.now();
        isDragging = true;
        swipeableRow.style.transition = 'none';
        initialOffset = getOffsetFromTransform();
    }, { passive: true });

    swipeableRow.addEventListener('touchmove', (e) => {
        if (!isDragging || !e.touches || e.touches.length === 0) return;
        currentX = e.touches[0].clientX;
        const deltaX = currentX - startX;
        currentOffset = clampOffset(initialOffset + deltaX);
        swipeableRow.style.transform = `translateX(${currentOffset}px)`;
    }, { passive: true });

    swipeableRow.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        const deltaTime = Date.now() - startTime;
        swipeableRow.style.transition = 'transform 0.3s ease';
        // Decide based on currentOffset rather than raw delta to support closing fully
        if (Math.abs(currentOffset - initialOffset) > 10 || deltaTime < 200) {
            if (currentOffset <= -40) {
                swipeableRow.style.transform = 'translateX(-80px)';
                swipeableRow.dataset.open = 'true';
            } else {
                swipeableRow.style.transform = 'translateX(0)';
                swipeableRow.dataset.open = 'false';
            }
        } else {
            // Small movement - treat as tap, don't open delete button
            swipeableRow.style.transform = 'translateX(0)';
            swipeableRow.dataset.open = 'false';
        }
        // Suppress the synthetic click that follows touchend after a drag
        swipeableRow.dataset.justDragged = 'true';
        setTimeout(() => { swipeableRow.dataset.justDragged = 'false'; }, 250);
    }, { passive: true });
    
    
    // Mouse events for desktop testing - only for drag, not click
    let mouseDownX = 0;
    let mouseDownTime = 0;
    let hasMouseMoved = false;

    const onMouseMove = (e) => {
        if (!mouseDownX) return;
        const deltaX = e.clientX - mouseDownX;
        hasMouseMoved = Math.abs(deltaX) > 5; // Start tracking movement after 5px
        if (hasMouseMoved) {
            if (!isDragging) {
                isDragging = true;
                startX = mouseDownX;
                startTime = mouseDownTime;
                currentX = e.clientX;
                swipeableRow.style.transition = 'none';
                initialOffset = getOffsetFromTransform();
            }
            currentX = e.clientX;
            currentOffset = clampOffset(initialOffset + (currentX - startX));
            swipeableRow.style.transform = `translateX(${currentOffset}px)`;
        }
    };

    const endMouseDrag = (clientX) => {
        const deltaTime = Date.now() - mouseDownTime;
        swipeableRow.style.transition = 'transform 0.3s ease';
        if (isDragging && hasMouseMoved) {
            // Decide based on currentOffset to allow full close
            if (currentOffset <= -40) {
                swipeableRow.style.transform = 'translateX(-80px)';
                swipeableRow.dataset.open = 'true';
            } else {
                swipeableRow.style.transform = 'translateX(0)';
                swipeableRow.dataset.open = 'false';
            }
            // Suppress the click that may follow a drag end
            swipeableRow.dataset.justDragged = 'true';
            setTimeout(() => { swipeableRow.dataset.justDragged = 'false'; }, 250);
        } else {
            // Treat as click/tap
            swipeableRow.style.transform = 'translateX(0)';
            swipeableRow.dataset.open = 'false';
        }
        // Cleanup and reset
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        mouseDownX = 0;
        mouseDownTime = 0;
        hasMouseMoved = false;
        isDragging = false;
    };

    const onMouseUp = (e) => {
        if (!mouseDownX) return;
        endMouseDrag(e.clientX);
    };

    swipeableRow.addEventListener('mousedown', (e) => {
        mouseDownX = e.clientX;
        mouseDownTime = Date.now();
        hasMouseMoved = false;
        // Attach document-level listeners so releasing outside still ends drag
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
    
    // Do not auto-close on outside click; row stays until user swipes back
}

// Hide a contact for current user and remove row from UI
async function hideContactAndRemoveRow(contactEmail, rowContainer) {
    // Sanitize keys
    const companyEmail = await getMainCompanyEmail();
    let me = await getUserEmail();
    if (me) me = me.replace('.', ',');
    let contactKey = (contactEmail || '').replace('.', ',');

    const path = `Companies/${companyEmail}/hiddencontacts/${me}/${contactKey}`;
    // Persist hidden flag (no project prefix)
    await new Promise((resolve) => {
        sendRuntimeMessage({
            action: "saveFirebaseData",
            path,
            data: true,
        }, () => resolve());
    });

    // Remove from UI
    if (rowContainer && rowContainer.parentElement) {
        rowContainer.parentElement.removeChild(rowContainer);
    }
}

// Render a contact button (now uses SwipeableContactRow)
function createContactButton(name, email, profileImage, message) {
    return createSwipeableContactRow(name, email, profileImage, message);
}

// Main function to load contacts
async function loadContactsPanel() {
    const contactsPanel = document.getElementById('contacts-panel');
    if (!contactsPanel) return;
    
    // Increment the request ID to track this load operation
    loadContactsPanelRequestId++;
    const currentRequestId = loadContactsPanelRequestId;
    
    // Clear the panel completely
    contactsPanel.innerHTML = '';

    // Add "Everyone" button

    let companyEmail = await getMainCompanyEmail();
    let currentProject = await getCurrentProject();
    // Format company email for Firebase paths (replace dots with commas)
    const formattedCompanyEmailForPath = (companyEmail || '').replace(/\./g, ',');
    let everyoneMessages = Object.values(await callGetItem(`Companies/${formattedCompanyEmailForPath}/securedProjects/${currentProject}/messages/${currentTopic}/everyone`, false) || []);
    if (everyoneMessages.length > 0)
        everyoneMessages = everyoneMessages[0];
    var message = { timestamp: Date.now(), text: "" };
    if (everyoneMessages != null) {
        var userMessages = Object.values(everyoneMessages);
        var length = userMessages.length;
        if (length > 0)
            message = userMessages[length - 1];
    }
    
    // Check if this request is still current before adding Everyone button
    if (currentRequestId !== loadContactsPanelRequestId) {
        console.log('[loadContactsPanel] Request cancelled - newer load in progress');
        return;
    }
    
    contactsPanel.appendChild(createContactButton("Everyone", "everyone", "img/default-group.png", message));

    // Get current user email - getUserEmail returns comma-separated format, convert to dot format for comparison
    const userEmail1Raw = await getUserEmail();
    const userEmail1 = (userEmail1Raw || '').replace(/,/g, '.'); // Convert to dot format for comparison

    // Fetch project members from the project-specific path
    // Path: Companies/{companyEmail}/projects/{projectName}/members
    // Use the same formatted email we used above
    const membersPath = `Companies/${formattedCompanyEmailForPath}/projects/${currentProject}/members`;
    
    sendRuntimeMessage({
        action: "getFirebaseData",
        path: membersPath
    }, async (response) => {
        // Check if this request is still current before processing
        if (currentRequestId !== loadContactsPanelRequestId) {
            console.log('[loadContactsPanel] Response ignored - newer load in progress');
            return;
        }
        
        if (!response || !response.success || !response.data) {
            // Check again before modifying DOM
            if (currentRequestId !== loadContactsPanelRequestId) return;
            contactsPanel.innerHTML += '<div class="error">Failed to load contacts.</div>';
            return;
        }
        
        // Process members sequentially to avoid race conditions
        const processContacts = async () => {
            // Load hidden contacts for current user once and unwrap callGetItem's shape { [path]: value }
            const userEmail1Key = (userEmail1 || '').replace(/\./g, ',');
            const hiddenPath = `Companies/${formattedCompanyEmailForPath}/hiddencontacts/${userEmail1Key}`;
            const hiddenWrapper = await callGetItem(hiddenPath, false) || {};
            const hidden = hiddenWrapper && hiddenWrapper[hiddenPath] ? hiddenWrapper[hiddenPath] : {};
            console.log("Hidden contacts (unwrapped):", hidden);
            const isHidden = (email) => !!hidden[(email || '').replace(/\./g, ',')];
            let realContactCount = 0;
            
            // The owner's email is the company email itself
            // Ensure companyEmail is in dot format (getMainCompanyEmail might return comma format)
            let ownerEmail = companyEmail ? companyEmail.replace(/,/g, '.') : null;
            
            console.log('[loadContactsPanel] Company email (owner):', ownerEmail);
            
            // Create a set of member emails to check if owner is already in the list
            const memberEmails = new Set();
            for (const [emailKey] of Object.entries(response.data)) {
                memberEmails.add(emailKey.replace(/,/g, '.').toLowerCase());
            }
            
            console.log('[loadContactsPanel] Member emails:', Array.from(memberEmails));
            console.log('[loadContactsPanel] Owner in members?', ownerEmail ? memberEmails.has(ownerEmail.toLowerCase()) : 'N/A');
            
            // Add owner to contacts FIRST (before processing members) to avoid race condition cancellations
            if (ownerEmail && !memberEmails.has(ownerEmail.toLowerCase())) {
                const normalizedOwnerEmail = ownerEmail.toLowerCase().trim();
                const normalizedUserEmail1 = (userEmail1 || '').toLowerCase().trim();
                const isOwnerCurrentUser = normalizedOwnerEmail === normalizedUserEmail1;
                
                if (!isOwnerCurrentUser && !isHidden(ownerEmail)) {
                    // Fetch owner's profile data
                    let ownerName = ownerEmail.split('@')[0];
                    let ownerProfileImage = null;
                    
                    try {
                        const ownerEmailKey = ownerEmail.replace(/\./g, ',');
                        const ownerUserPath = `Companies/${formattedCompanyEmailForPath}/users/${ownerEmailKey}`;
                        const ownerUserData = await new Promise((resolve) => {
                    sendRuntimeMessage({
                        action: "getFirebaseData",
                                path: ownerUserPath
                            }, (ownerUserResponse) => {
                                if (ownerUserResponse && ownerUserResponse.success && ownerUserResponse.data) {
                                    resolve(ownerUserResponse.data);
                        } else {
                            resolve(null);
                        }
                    });
                });
                
                        if (ownerUserData) {
                            if (ownerUserData.name) {
                                ownerName = ownerUserData.name;
                            }
                            if (ownerUserData.profileImage) {
                                ownerProfileImage = ownerUserData.profileImage;
                    }
                }
            } catch (e) {
                        console.warn('Could not fetch owner user data:', e);
            }
            
                    // Get latest message for owner
                    var ownerMessage = { timestamp: Date.now(), text: "" };
                    var ownerEmailPair = await getEmailPair(ownerEmail);
                    let ownerMessages = Object.values(await callGetItem(`Companies/${formattedCompanyEmailForPath}/securedProjects/${currentProject}/messages/${currentTopic}/${ownerEmailPair}`, false) || []);
                    if (ownerMessages.length > 0)
                        ownerMessages = ownerMessages[0];
                    if (ownerMessages != null) {
                        var ownerUserMessages = Object.values(ownerMessages);
                        var ownerLength = ownerUserMessages.length;
                        if (ownerLength > 0)
                            ownerMessage = ownerUserMessages[ownerLength - 1];
                    }
                    
                    // Check before appending owner contact
                    if (currentRequestId === loadContactsPanelRequestId) {
                        contactsPanel.appendChild(
                            createContactButton(ownerName, ownerEmail, ownerProfileImage, ownerMessage)
                        );
                        realContactCount++;
                        console.log('[loadContactsPanel] Owner contact added:', ownerEmail);
                    }
                }
            }
            
            // Process each member in the project
            for (const [emailKey, memberInfo] of Object.entries(response.data)) {
                // Convert Firebase key format (comma-separated) back to email format
                let userEmail2 = emailKey.replace(/,/g, '.');
                const memberEmailKey = emailKey; // Keep the comma-separated format for Firebase paths
                
                // Normalize emails for comparison (lowercase, trim)
                const normalizedUserEmail1 = (userEmail1 || '').toLowerCase().trim();
                const normalizedEmailKey = userEmail2.toLowerCase().trim();
                
                // Check if this member is the current user - compare both emailKey and memberInfo.email
                const memberEmail = (memberInfo && memberInfo.email) ? memberInfo.email.toLowerCase().trim() : null;
                const isCurrentUser = normalizedUserEmail1 === normalizedEmailKey || 
                                     (memberEmail && normalizedUserEmail1 === memberEmail);
                
                // Don't show yourself
                if (isCurrentUser) {
                    console.log("Skipping current user in contact list:", userEmail2);
                    continue;
                }
                
                // Skip hidden contacts
                console.log("Checking if", userEmail2 , "is hidden =>", isHidden(userEmail2));
                if (isHidden(userEmail2))
                    continue;
                
                // Use member info if available
                if (memberInfo && memberInfo.email) {
                    userEmail2 = memberInfo.email;
                }
                
                // Fetch user profile data (name, profileImage) from the users path
                // The users path is the source of truth for usernames
                let userName = userEmail2.split('@')[0]; // Default to email prefix
                let profileImage = null;
                
                // Fetch user profile data from Firebase first (this is the source of truth)
                try {
                    const userPath = `Companies/${formattedCompanyEmailForPath}/users/${memberEmailKey}`;
                    const userData = await new Promise((resolve) => {
                        sendRuntimeMessage({
                            action: "getFirebaseData",
                            path: userPath
                        }, (userResponse) => {
                            if (userResponse && userResponse.success && userResponse.data) {
                                resolve(userResponse.data);
                            } else {
                                resolve(null);
                            }
                        });
                    });
                    
                    if (userData) {
                        // Prioritize userData.name from users path (source of truth)
                        if (userData.name) {
                            userName = userData.name;
                        }
                        if (userData.profileImage) {
                            profileImage = userData.profileImage;
                        }
                    }
                } catch (e) {
                    console.warn('Could not fetch user data for:', userEmail2, e);
                }
                
                // Fallback to memberInfo.name only if userData.name was not found
                if (userName === userEmail2.split('@')[0] && memberInfo && memberInfo.name) {
                    userName = memberInfo.name;
                }
                
                // Get latest message for this contact (check both privateMessages and company paths)
                var message = { timestamp: Date.now(), text: "" };
                var emailPair = await getEmailPair(userEmail2);
                
                // Check privateMessages path first (newer, truly private)
                let privateMessages = await callGetItem(`privateMessages/${emailPair}/${currentProject}/${currentTopic}`, false) || {};
                let privateMessagesArray = Object.values(privateMessages);
                if (privateMessagesArray.length > 0) {
                    // Sort by timestamp and get latest
                    privateMessagesArray.sort((a, b) => {
                        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                        return timeB - timeA; // Descending
                    });
                    message = privateMessagesArray[0];
                } else {
                    // Fallback to company path (for backward compatibility with old messages)
                    let messages = Object.values(await callGetItem(`Companies/${formattedCompanyEmailForPath}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`, false) || []);
                    if (messages.length > 0)
                        messages = messages[0];
                    if (messages != null) {
                        var userMessages = Object.values(messages);
                        var length = userMessages.length;
                        if (length > 0)
                            message = userMessages[length - 1];
                    }
                }
                
                // Check again before appending contact (another load might have started)
                if (currentRequestId !== loadContactsPanelRequestId) {
                    console.log('[loadContactsPanel] Contact append cancelled - newer load in progress');
                    return; // Exit the loop early since this load is stale
                }
                
                contactsPanel.appendChild(
                    createContactButton(userName, userEmail2, profileImage, message)
                );
                realContactCount++;
            }
            
            // Final check before adding "no contacts" message
            if (currentRequestId !== loadContactsPanelRequestId) {
                console.log('[loadContactsPanel] No contacts message cancelled - newer load in progress');
                return;
            }
            
            if (realContactCount === 0) {
                contactsPanel.innerHTML += '<div style="padding: 20px; text-align: center; color: #9ca3af;">No contacts found in this project.</div>';
            }
        };
        
        processContacts();
    });
}

// Function to completely reset messaging state
function resetMessagingState() {
    // Clear current chat state
    currentlyChattingWith = "";
    currentImg = "";
    currentName = "";
    // NOTE: We do NOT clear currentTopic here - it should be preserved when switching contacts
    // Only setCurrentTopic() should change currentTopic
    
    // Clear the messages panel
    const messagesList = document.getElementById('messages-list');
    if (messagesList) {
        messagesList.innerHTML = '';
    }
    
    // Clear the contacts panel
    const contactsPanel = document.getElementById('contacts-panel');
    if (contactsPanel) {
        contactsPanel.innerHTML = '';
    }
    
    // Show the contacts chooser and hide messages panel
    const contactsPanelChooser = document.getElementById('contacts-panel-chooser');
    const contactsPanelMessages = document.getElementById('contacts-panel-messages');
    if (contactsPanelChooser) contactsPanelChooser.style.display = 'block';
    if (contactsPanelMessages) contactsPanelMessages.style.display = 'none';
    
    // Show the search bar
    const messagingSearch = document.getElementById('messaging-search');
    if (messagingSearch) messagingSearch.style.display = 'block';
}

// Function to refresh contact previews when new messages arrive
async function refreshContactPreviews() {
    const contactsPanel = document.getElementById('contacts-panel');
    if (!contactsPanel) return;
    
    const contactButtons = contactsPanel.querySelectorAll('.contact-btn');
    
    for (const button of contactButtons) {
        // Get the contact email from the button's onclick handler
        const onclickAttr = button.getAttribute('onclick');
        if (!onclickAttr) continue;
        
        // Extract email from the onclick handler
        const emailMatch = onclickAttr.match(/openChatWith\(['"]([^'"]+)['"]/);
        if (!emailMatch) continue;
        
        const contactEmail = emailMatch[1];
        const contactName = button.querySelector('.contact-name')?.textContent || '';
        const profileImage = button.querySelector('.contact-avatar')?.src || 'img/default-profile.png';
        
        // Get the latest message for this contact
        let message = { timestamp: Date.now(), text: "" };
        
        if (contactEmail === "everyone") {
            let companyEmail = await getMainCompanyEmail();
            let currentProject = await getCurrentProject();
            // Format company email for Firebase paths (replace dots with commas)
            const formattedCompanyEmail = (companyEmail || '').replace(/\./g, ',');
            let everyoneMessages = Object.values(await callGetItem(`Companies/${formattedCompanyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/everyone`, false) || []);
            if (everyoneMessages.length > 0)
                everyoneMessages = everyoneMessages[0];
            if (everyoneMessages != null) {
                var userMessages = Object.values(everyoneMessages);
                var length = userMessages.length;
                if (length > 0)
                    message = userMessages[length - 1];
            }
        } else {
            let companyEmail = await getMainCompanyEmail();
            let currentProject = await getCurrentProject();
            var emailPair = await getEmailPair(contactEmail);
            // Format company email for Firebase paths (replace dots with commas)
            const formattedCompanyEmail = (companyEmail || '').replace(/\./g, ',');
            let messages = Object.values(await callGetItem(`Companies/${formattedCompanyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`, false) || []);
            if (messages.length > 0)
                messages = messages[0];
            if (messages != null) {
                var userMessages = Object.values(messages);
                var length = userMessages.length;
                if (length > 0)
                    message = userMessages[length - 1];
            }
        }
        
        // Update the button with new message preview
        const tableStyle = "style='background-color: unset; border: unset;'";
        const imgSrc = profileImage || 'img/default-profile.png';
        
        // Special handling for "Everyone" - use SVG instead of image
        let avatarHtml;
        if (contactEmail === "everyone") {
            avatarHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 48 48" class="contact-avatar">
                <path fill="currentColor" d="M11.5 11a3.5 3.5 0 1 1 7 0a3.5 3.5 0 0 1-7 0ZM15 5a6 6 0 1 0 0 12a6 6 0 0 0 0-12Zm14.5 6a3.5 3.5 0 1 1 7 0a3.5 3.5 0 0 1-7 0ZM33 5a6 6 0 1 0 0 12a6 6 0 0 0 0-12ZM4 22.446A3.446 3.446 0 0 1 7.446 19h9.624a7.947 7.947 0 0 0-.93 2.5H7.446a.946.946 0 0 0-.946.946v.429c0 .27.003 1.933 1.019 3.505c.896 1.388 2.723 2.92 6.684 3.102a5.469 5.469 0 0 0-2.464 2.223c-3.222-.632-5.18-2.203-6.32-3.968C4 25.54 4 23.27 4 22.877v-.43Zm29.797 7.036a5.469 5.469 0 0 1 2.464 2.223c3.222-.632 5.18-2.203 6.32-3.968C44 25.54 44 23.27 44 22.877v-.43A3.446 3.446 0 0 0 40.554 19H30.93c.44.763.76 1.605.93 2.5h8.694c.522 0 .946.424.946.946v.429c0 .27-.003 1.933-1.019 3.505c-.896 1.388-2.723 2.92-6.684 3.102ZM24 19.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7ZM18 23a6 6 0 1 1 12 0a6 6 0 0 1-12 0Zm-5 11.446A3.446 3.446 0 0 1 16.446 31h15.108A3.446 3.446 0 0 1 35 34.446v.431c0 .394 0 2.663-1.419 4.86C32.098 42.033 29.233 44 24 44s-8.098-1.967-9.581-4.263C13 37.54 13 35.27 13 34.877v-.43Zm3.446-.946a.946.946 0 0 0-.946.946v.429c0 .27.003 1.933 1.019 3.505c.954 1.478 2.964 3.12 7.481 3.12c4.517 0 6.527-1.642 7.481-3.12c1.016-1.572 1.019-3.235 1.019-3.505v-.429a.946.946 0 0 0-.946-.946H16.446Z"/>
            </svg>`;
        } else {
            avatarHtml = `<img src="${imgSrc}" class="contact-avatar" />`;
        }
        
        // Process message text for preview using helper function
        let messagePreview = extractMessagePreview(message);
        let messageTime = "";
        
        // Format timestamp
        if (message && message.timestamp) {
            messageTime = formatTime(new Date(message.timestamp));
        }
        
        button.innerHTML = `
            ${avatarHtml}
            <table>
                <tr ${tableStyle}>
                    <td ${tableStyle}><span class="contact-name">${contactName.replace(",", ".")}</span></td><td class='contact-footer' style='text-align: right;'>${messageTime}</td>
                </tr>
                <tr ${tableStyle}>
                <td ${tableStyle} class='contact-footer' style='max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-top: 0;'>
                ${messagePreview}
                </td>
                </tr>
            </table>
        `;
        
        // Preserve the onclick handler
        button.onclick = () => openChatWith(contactEmail, imgSrc, contactName);
    }
}

var currentChatId = null;
var currentTopic = "";
var loadContactsPanelRequestId = 0; // Track the latest load request to prevent duplicate contacts
setCurrentTopic("general");
document.addEventListener('DOMContentLoaded', async function () {
    setTimeout(function () {
        loadContactsPanel();
    }, 3000);
    
    // Restore active chat state and drafts after contacts panel is loaded
    setTimeout(async () => {
        await restoreActiveChatState();
        await restoreDrafts();
    }, 3500);
    
    // Save draft immediately before page unload
    window.addEventListener('beforeunload', () => {
        const newMessageInput = document.getElementById('new-message');
        if (newMessageInput && currentlyChattingWith && currentTopic) {
            const content = newMessageInput.innerHTML || newMessageInput.textContent || '';
            if (content && content.trim()) {
                // Use synchronous storage for beforeunload
                saveDraft(content, 'main');
                saveActiveChatState();
            }
        }
    });
    
    const messagingButton = document.getElementById('Messaging');
    const backButton = document.getElementById('Back-messaging');
    const GroqChats_button = document.getElementById("topics-Groq Chats");
    // const VideoAnnotations_button = document.getElementById("topics-Video Annotations");
    // const VoiceAnnotations_button = document.getElementById("topics-Voice Annotations");
    const ManualLogs_button = document.getElementById("topics-Manual Logs");
    const ManualLogs_back_button = document.getElementById("topic-Manual Logs-back");

    const GroqChats_back_button = document.getElementById("topic-Groq Chats-back");

    messagingButton.addEventListener('click', async function () {
        if (await isUserLoggedIn2()) {
            hideAllSubFrames();
            showFrame("messaging-sub-frame-label");
            showFrame("messaging-sub-frame");
        }
        else {
            showToast("You must be logged in to use messaging", 'error')
        }
    });

    backButton?.addEventListener('click', function () {
        console.log("Showing main menu from messaging back");
        mainMenu();
    });

    function hideTopics() {
        document.getElementById("choose-topic").style.display = "none";
        document.getElementById("topic-Groq Chats-div").style.display = "none";
        // document.getElementById("topic-Video Annotations-div").style.display = "none";
        // document.getElementById("topic-Voice Annotations-div").style.display = "none";
        document.getElementById("topic-Manual Logs-div").style.display = "none";
        // hideContactList();
    }

    // function showTopics() {
    //     document.getElementById("choose-topic").style.display = "none";
    //     document.getElementById("topic-Groq Chats-div").style.display = "none";
    //     document.getElementById("topic-Video Annotations-div").style.display = "none";
    //     document.getElementById("topic-Voice Annotations-div").style.display = "none";
    //     document.getElementById("topic-Manual Logs-div").style.display = "none";
    // }

    // var openContactsButton = document.getElementById("openContactsButton");
    // var closeContactsButton = document.getElementById("closeContactsButton");
    // // Hide both buttons by default
    // openContactsButton.style.display = "none";
    // closeContactsButton.style.display = "none";

    // // Helper to hide both
    // function hideContactsPanelButtons() {
    //     openContactsButton.style.display = "none";
    //     closeContactsButton.style.display = "none";
    // }
    // // Helper to show open button only
    // function showOpenContactsButton() {
    //     openContactsButton.style.display = "block";
    //     closeContactsButton.style.display = "none";
    // }

    GroqChats_button.addEventListener('click', async function () {
        hideTopics();
        document.getElementById("topic-Groq Chats-div").style.display = "block";
        var currentProject = await getCurrentProject();
        setTimeout(function () {
            var iframe = document.getElementById("groq-iframe");
            iframe.contentWindow.postMessage({ action: "Inside Extension", currentProject: currentProject }, "*");
        }, 0);
        // Show open contacts button for Groq Chats
        // showOpenContactsButton();
        // loadGroqChatsList();
    });

    GroqChats_back_button.addEventListener('click', function () {
        setCurrentTopic("general");
        loadContactsPanel();
        loadMessages();
        var iframe = document.getElementById("groq-iframe");
        iframe.contentWindow.postMessage({ action: "Show Sidebar" }, "*");
        hideTopics();
        document.getElementById("choose-topic").style.display = "block";
        // Hide both contacts panel buttons when leaving Groq Chats
        // hideContactsPanelButtons();
    });

    // VideoAnnotations_button.addEventListener('click', function () {
    // hideTopics();
    // });
    // VoiceAnnotations_button.addEventListener('click', function () {
    // hideTopics();
    // });
    ManualLogs_button.addEventListener('click', async function () {
        hideTopics();
        document.getElementById("topic-Manual Logs-div").style.display = "block";
        var manualLogCategoriesDiv = document.getElementById("topic-Manual Logs-categories");
        var manualLogsDiv = document.getElementById("topic-Manual Logs-logs");
        manualLogCategoriesDiv.style.display = "block";
        manualLogCategoriesDiv.innerHTML = "";
        manualLogsDiv.style.display = "none";
        var categories = Object.values(await callGetItem("categoriesImages") || []);
        if (categories.length > 0)
            categories = Object.keys(categories[0]);
        else
            manualLogCategoriesDiv.innerHTML = "<div>No categories found</div>";
        for (let category of categories) {
            let categoryButton = document.createElement('div');
            categoryButton.className = "category-item";
            categoryButton.style.cursor = 'pointer';
            let categoryKey = category;
            categoryButton.innerHTML = `<span class="category-name">${categoryKey}</span>`;
            categoryButton.addEventListener('click', async function () {
                manualLogCategoriesDiv.style.display = "none";
                manualLogsDiv.style.display = "block";
                manualLogsDiv.innerHTML = "";

                var logs = Object.values(await callGetItem(`categoriesImages/${categoryKey}/images`) || []);
                if (logs.length > 0)
                    logs = Object.values(logs[0]);
                for (let log of logs) {
                    let logButton = document.createElement('div');
                    logButton.style.borderRadius = "10px";
                    let timestamp = formatTime(new Date(log.timestamp));
                    logButton.innerHTML = `
                    <div class="catalog-card"><img src="${log.data}" alt="contact.png" style="padding-bottom: 20px;">
                    <div class="catalog-note-preview">Selected Text: ${log.selectedText}<br>${log.note}</div><div class="catalog-card-bottom"><div class="catalog-timestamp">${timestamp}</div>
                    </div></div>
                    `;
                    logButton.addEventListener('click', async function () {
                        var topicText = log.selectedText + " " + timestamp;
                        // if (log.selectedText.trim() != "") {
                        //     topicText = log.selectedText;
                        // }
                        // if (log.note.trim() != "") {
                        //     if (topicText != "")
                        //         topicText += "<br>";
                        //     topicText += log.note;
                        // }
                        setCurrentTopic(`categoriesImages-images-${log.imageId}`, "manualLogs", topicText);
                        loadContactsPanel();
                        loadMessages();
                        for (let otherButton of manualLogsDiv.childNodes) {
                            otherButton.style.border = "";
                        }
                        logButton.style.border = "solid 4px gray";
                    });

                    manualLogsDiv.appendChild(logButton);
                }
                // setCurrentTopic(`categoriesImages/${categoryKey}`)
            });
            manualLogCategoriesDiv.appendChild(categoryButton);
        }
    });

    ManualLogs_back_button.addEventListener('click', function () {
        var manualLogCategoriesDiv = document.getElementById("topic-Manual Logs-categories");
        setCurrentTopic("general");
        loadContactsPanel();
        loadMessages();
        hideTopics();
        document.getElementById("choose-topic").style.display = "block";
        if (manualLogCategoriesDiv.style.display == "none") {
            ManualLogs_button.click(); //Allows user to go back to the categories from the logs list, instead of skipping back to the main topics menu
        }
        // Hide both contacts panel buttons when leaving Manual Logs
        // hideContactsPanelButtons();
    });

    const addMessageButton = document.getElementById('add-message');
    const newMessageInput = document.getElementById('new-message');

    // Inject styles for improved message UI
    (function ensureMessageSpacingStyles() {
        if (document.getElementById('message-spacing-styles')) return;
        const style = document.createElement('style');
        style.id = 'message-spacing-styles';
        style.textContent = `
        .comment-item {
            position: relative !important;
            margin: 0;
            width: 100%;
            box-sizing: border-box;
            padding: 8px 12px;
            background: transparent;
            border-radius: 8px;
            border: 1px solid transparent;
            transition: all 0.2s ease;
        }
        
        .comment-item:hover {
            background: #fafafa;
            border-color: #f0f0f0;
            border-radius: 12px;
        }
        
        /* Main chat messages use gap: 8px in the container for better spacing */
        #messages-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        #messages-list .comment-item {
            margin: 0 !important;
        }
        
        /* Exclude timeline headers from gap spacing */
        #messages-list .timeline-date-header {
            margin: 0 !important;
        }
        
        /* Ensure consistent spacing between all messages regardless of user */
        #messages-list .comment-item:not(:last-child) {
            margin-bottom: 0 !important;
        }
        
        .comment-header {
            font-size: 11px;
            color: #6b7280;
            margin: 0 0 8px 0;
            font-weight: 500;
            display: flex;
            justify-content: space-between;
            gap: 8px;
            align-items: baseline;
        }
        
        .comment-header-right {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .comment-author {
            color: #6b7280;
            font-size: 11px;
            font-weight: 500;
        }
        
        .comment-time {
            color: #6b7280;
            font-size: 11px;
        }
        
        .comment-text {
            padding: 10px 14px;
            border-radius: 8px;
            line-height: 1.5;
            max-width: 100%;
            box-shadow: none;
            margin: 0 0 8px 0;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .comment-item:not(.my-comment) .comment-text {
            background-color: #f8f9fa;
            color: #111827;
            margin-bottom: 0 !important;
        }
        
        .comment-item.my-comment .comment-text {
            background-color: #e3f2fd;
            color: #111827;
            margin-bottom: 0 !important;
        }
        
        /* Ensure no extra spacing on emoji toolbar or other elements */
        .comment-item .emoji-toolbar {
            margin: 6px 0 0 0 !important;
            padding: 0 !important;
        }
        
        /* Ensure reactions display doesn't add extra spacing */
        .reactions-display {
            margin: 4px 0 0 0 !important;
        }
        
        .comment-input-container {
            background: #ffffff;
            border-top: none;
            padding: 8px 16px;
            box-sizing: border-box;
            width: 100%;
            margin-top: 20px;
            position: relative;
            display: flex;
            flex-direction: column;
        }
        
        .comment-input-container::before {
            content: '';
            position: absolute;
            top: -20px;
            left: 0;
            right: 0;
            height: 1px;
            background-color: #e5e7eb;
        }
        
        /* Hide scrollbar for messages list */
        #messages-list {
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* Internet Explorer 10+ */
        }
        
        #messages-list::-webkit-scrollbar {
            display: none; /* WebKit browsers (Chrome, Safari, Edge) */
        }
        
        /* Add padding below header bar (back button, profile pic, search icon) */
        #contacts-panel-messages > div:first-child {
            padding-bottom: 16px;
            margin-bottom: 8px;
        }
        
        /* Add top padding to messages list for extra spacing */
        #messages-list {
            padding-top: 8px;
        }
        
        .comment-input {
            padding: 0.75rem 0.5rem;
            min-height: 48px;
            border: none;
            border-radius: 0.75rem;
            background-color: #ffffff;
            transition: all 0.2s ease;
            width: 100%;
            box-sizing: border-box;
            word-wrap: break-word;
            overflow-wrap: break-word;
            font-size: 1rem;
            line-height: 1.5;
            outline: none;
            font-family: inherit;
            resize: none;
            height: 48px;
        }
        
        .input-with-send {
            display: flex;
            align-items: center;
            position: relative;
            border: 1px solid rgba(0,0,0,0.1);
            border-radius: 0.75rem;
            background-color: #fff;
            padding-right: 0.5rem;
        }
        
        .comment-input:focus {
            outline: none;
        }
        
        .comment-button.primary {
            background-color: #f1f5f9;
            color: #475569;
            border: 1px solid #e2e8f0;
            height: 44px;
            width: 44px;
            border-radius: 8px;
            transition: all 0.2s ease;
        }
        
        .comment-button.primary:hover {
            background-color: #e2e8f0;
            color: #374151;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        /* Emoji Toolbar Styles */
        .emoji-toolbar {
            display: none;
            position: absolute;
            top: -2px;
            left: 0;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 6px 10px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
            white-space: nowrap;
            align-items: center;
            gap: 4px;
        }
        
        .comment-item:hover .emoji-toolbar {
            display: flex !important;
            opacity: 1 !important;
        }
        
        /* Position toolbar for sender's messages */
        .comment-item.my-comment .emoji-toolbar {
            left: auto;
            right: 0;
        }
        /* Hide emoji toolbar entirely while editing */
        .comment-item.is-editing .emoji-toolbar {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
        
        .emoji-option {
            cursor: pointer;
            font-size: 18px;
            padding: 4px 6px;
            margin: 0 2px;
            border-radius: 50%;
            transition: all 0.2s ease;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            display: inline-block;
            position: relative;
            z-index: 1001;
            background-color: transparent;
        }
        
        .emoji-option:hover {
            background-color: #f1f5f9;
            transform: scale(1.1);
        }
        
        .emoji-option.selected {
            background-color: #f1f5f9;
            color: #475569;
            border: 1px solid #d1d5db;
        }
        
        /* Reactions Display */
        .reactions-display {
            margin: 8px 12px 0 12px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        
        .reaction-item {
            display: inline-block;
            background-color: #f3f4f6;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .reaction-item:hover {
            background-color: #e5e7eb;
            transform: scale(1.05);
        }
        
        /* Tooltip Styles */
        .reaction-tooltip {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-size: 14px;
            max-width: 300px;
        }
        
        .tooltip-header {
            font-weight: 600;
            margin-bottom: 8px;
            color: #374151;
        }
        
        .tooltip-content {
            color: #6b7280;
            line-height: 1.4;
        }
        
        /* Edit functionality styles */
        .edit-icon {
            cursor: pointer;
            font-size: 16px;
            padding: 4px 6px;
            margin: 0 2px;
            border-radius: 50%;
            transition: all 0.2s ease;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            display: inline-block;
            position: relative;
            z-index: 1001;
            background-color: transparent;
            color: #6b7280;
        }
        
        .edit-icon:hover {
            background-color: #f1f5f9;
            transform: scale(1.1);
            color: #374151;
        }
        
        /* Reply Icon Styles */
        .reply-icon {
            cursor: pointer;
            font-size: 16px;
            padding: 4px 6px;
            margin: 0 2px;
            border-radius: 50%;
            transition: all 0.2s ease;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            display: inline-block;
            position: relative;
            z-index: 1001;
            background-color: transparent;
            color: #6b7280;
        }
        
        .reply-icon:hover {
            background-color: #f1f5f9;
            transform: scale(1.1);
            color: #374151;
        }
        
        .edit-controls {
            margin: 4px 8px 8px 8px;
            width: calc(100% - 16px);
            max-width: none;
            box-sizing: border-box;
        }
        .edit-editor { position: relative; }
        .editor-toolbar-bottom {
            position: absolute;
            right: 8px;
            bottom: 8px;
            display: flex;
            align-items: center;
        }
        .toolbar-right {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        /* Emoji button styles */
        .emoji-toggle-btn {
            width: 36px;
            height: 36px;
            padding: 0;
            border: none;
            background: none;
            color: #6b7280;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: color 0.15s ease;
            cursor: pointer;
        }
        
        .emoji-toggle-btn:hover {
            color: #374151;
        }
        
        .emoji-toggle-btn.active {
            color: #111827;
        }
        
        .emoji-toggle-btn svg {
            width: 20px;
            height: 20px;
        }
        
        .rich-text-toolbar {
            position: absolute;
            left: 8px;
            top: 8px;
            display: none;
            align-items: center;
            gap: 4px;
            padding: 8px;
            margin-bottom: 8px;
            background-color: #fafafa;
            border: 1px solid #e1e5e9;
            border-radius: 3px;
            z-index: 9999;
            min-width: 120px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .rich-text-toolbar.visible { display: flex; }
        .icon-bold { font-weight: 700; }
        .icon-italic { font-style: italic; }
        .icon-underline { text-decoration: underline; }
        
        /* Dropdown containers */
        .highlight-dropdown, .font-size-dropdown, .text-color-dropdown {
            position: relative;
            display: inline-block;
        }
        
        .highlight-colors, .font-size-options, .text-color-options {
            position: absolute;
            top: 100%;
            left: 0;
            background: white;
            border: 1px solid #e1e5e9;
            border-radius: 4px;
            padding: 4px;
            display: none;
            gap: 2px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 1000;
        }
        
        .highlight-dropdown.open .highlight-colors,
        .font-size-dropdown.open .font-size-options,
        .text-color-dropdown.open .text-color-options {
            display: flex;
        }
        
        .color-option, .size-option {
            width: 20px;
            height: 20px;
            border: 1px solid #ddd;
            border-radius: 3px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.15s ease;
        }
        
        .color-option:hover, .size-option:hover {
            transform: scale(1.1);
            border-color: #999;
        }
        
        .size-option {
            background: white;
            color: #000;
            min-width: 20px;
        }
        
        .edit-toolbar {
            display: none;
            align-items: center;
            gap: 4px;
            padding: 8px;
            margin-bottom: 8px;
            background-color: #fafafa;
            border: 1px solid #e1e5e9;
            border-radius: 3px;
            z-index: 9999;
            min-width: 120px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .edit-toolbar.visible { display: flex !important; }
        
        .icon-btn,
        .rich-text-btn {
            width: 24px;
            height: 24px;
            padding: 0;
            border: none;
            border-radius: 4px;
            background-color: transparent;
            color: #000000;
            font-size: 14px;
            line-height: 1;
            cursor: pointer;
            transition: color 0.15s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        
        .rich-text-btn:hover,
        .icon-btn:hover { 
            color: #0078d4; 
        }
        
        .rich-text-btn.active,
        .icon-btn.active {
            color: #0078d4;
        }
        
        .edit-content {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            min-height: 120px;
            padding: 12px 14px;
            border: 1px solid #e1e5e9;
            border-radius: 3px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            outline: none;
            background-color: #ffffff;
            transition: border-color 0.15s ease, padding-top 0.15s ease;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .edit-editor.has-rich-toolbar .edit-content {
            padding-top: 65px;
        }
        .edit-content:focus { border-color: #8bb4de; }
        
        .edit-buttons {
            display: flex;
            gap: 4px;
            margin-top: 6px;
            justify-content: flex-end;
            align-items: center;
        }
        
        .edit-rich-text-toggle, .edit-save-btn, .edit-cancel-btn { width: 24px; height: 24px; }
        
        .edit-rich-text-toggle {
            font-size: 11px;
            font-weight: 600;
            margin-right: 4px;
        }
        
        .edit-rich-text-toggle:hover { color: #0078d4; }
        
        .edit-rich-text-toggle.active { color: #0078d4; }
        
        .edit-save-btn { font-size: 14px; color: #000000; }
        
        .edit-save-btn:hover { color: #107c10; }
        
        .edit-cancel-btn { font-size: 14px; color: #000000; }
        
        .edit-cancel-btn:hover { color: #d13438; }
        
        /* List styling for message content and editor */
        .comment-text ul, .comment-text ol, .edit-content ul, .edit-content ol {
            margin: 8px 0;
            padding-left: 20px;
            list-style-position: outside;
        }
        
        .comment-text ul, .edit-content ul {
            list-style-type: disc;
        }
        
        .comment-text ol, .edit-content ol {
            list-style-type: decimal;
        }
        
        .comment-text li, .edit-content li {
            margin: 4px 0;
            line-height: 1.4;
            list-style-position: outside;
        }
        
        /* Ensure nested lists have proper indentation */
        .comment-text ul ul, .comment-text ol ul, .edit-content ul ul, .edit-content ol ul {
            list-style-type: circle;
        }
        
        .comment-text ul ul ul, .comment-text ol ul ul, .edit-content ul ul ul, .edit-content ol ul ul {
            list-style-type: square;
        }
        
        /* Reply Card Styles - Compact Design */
        .reply-card {
            background-color: #f3f4f6;
            border: none;
            border-left: 2px solid #3b82f6;
            border-radius: 4px;
            margin-bottom: 6px;
            padding: 6px 8px;
            position: relative;
            min-height: auto;
        }
        
        .reply-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2px;
        }
        
        .reply-card-info {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .reply-card-author {
            font-weight: 600;
            color: #3b82f6;
            font-size: 14px;
        }
        
        .reply-card-time {
            color: #6b7280;
            font-size: 11px;
        }
        
        .reply-card-content {
            color: #4b5563;
            font-size: 14px;
            line-height: 1.4;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .reply-card-close {
            position: absolute;
            top: 6px;
            right: 6px;
            background: none !important;
            border: none;
            color: #6b7280;
            cursor: pointer;
            font-size: 12px;
            padding: 0;
            margin: 0;
            border-radius: 0;
            transition: color 0.2s ease;
            line-height: 1;
            font-weight: 400;
            outline: none;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .reply-card-close:hover {
            background: none !important;
            color: #374151;
        }
        
        .reply-card-close:focus {
            background: none !important;
            outline: none;
        }
        
        .comment-input-container.has-reply {
            padding-top: 6px;
        }
        
        /* Message Reply Context Styles - Integrated into message content */
        .message-reply-context {
            background-color: rgba(59, 130, 246, 0.05);
            border: none;
            border-left: 2px solid #3b82f6;
            margin: 0 0 8px 0;
            padding: 6px 8px;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .reply-context-header {
            display: flex;
            align-items: center;
            margin-bottom: 2px;
            gap: 18px;
        }
        
        .reply-context-author {
            font-weight: 600;
            color: #3b82f6;
            font-size: 14px;
            flex-shrink: 0;
        }
        
        .reply-context-time {
            color: #6b7280;
            font-size: 11px;
            flex-shrink: 0;
        }
        
        .reply-context-content {
            color: #6b7280;
            font-size: 14px;
            line-height: 1.4;
            max-height: 40px;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        
        /* Ensure messages list container respects boundaries */
        #messages-list {
            width: 100%;
            box-sizing: border-box;
            padding: 0 8px;
        }
        
        /* Fix main chat input area */
        .add-comment-section {
            width: 100% !important;
            box-sizing: border-box !important;
            left: 0 !important;
            right: 0 !important;
            position: absolute !important;
            bottom: -40px !important;
            padding-bottom: 0 !important;
            margin-bottom: 0 !important;
            height: auto !important;
        }
        
        /* Thread Panel Styles */
        #thread-panel {
            display: none;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #ffffff;
            flex-direction: column;
            z-index: 1000;
        }
        
        .thread-panel-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
        }
        
        .thread-panel-header {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid #e5e7eb;
            gap: 12px;
        }
        
        .thread-back-button {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6b7280;
            border-radius: 4px;
            transition: background-color 0.2s ease;
        }
        
        .thread-back-button:hover {
            background-color: #f3f4f6;
            color: #374151;
        }
        
        .thread-panel-title {
            font-size: 16px;
            font-weight: 600;
            color: #111827;
        }
        
        .thread-panel-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }
        
        .thread-parent-message {
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .thread-parent-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 8px;
        }
        
        .thread-parent-author {
            font-weight: 600;
            color: #111827;
            font-size: 14px;
        }
        
        .thread-parent-time {
            color: #6b7280;
            font-size: 12px;
        }
        
        .thread-parent-text {
            color: #374151;
            font-size: 14px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .thread-replies-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 0;
        }
        
        /* Ensure thread messages have same spacing as regular messages */
        /* Regular messages use gap: 8px in .messages-list, so remove margin to avoid double spacing */
        .thread-replies-container .comment-item {
            margin: 0 !important;
        }
        
        .thread-input-section {
            border-top: 1px solid #e5e7eb;
            background: #ffffff;
        }
        
        .thread-input-container {
            position: relative !important;
            bottom: auto !important;
        }
        
        /* Thread Icon Styles */
        .thread-icon {
            cursor: pointer;
            font-size: 16px;
            padding: 4px 6px;
            margin: 0 2px;
            border-radius: 50%;
            transition: all 0.2s ease;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            display: inline-block;
            position: relative;
            z-index: 1001;
            background-color: transparent;
            color: #6b7280;
        }
        
        .thread-icon:hover {
            background-color: #f1f5f9;
            transform: scale(1.1);
            color: #374151;
        }
        
        .delete-icon {
            cursor: pointer;
            font-size: 16px;
            padding: 4px 6px;
            margin: 0 2px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #6b7280;
            transition: all 0.2s ease;
            vertical-align: middle;
        }
        
        .delete-icon svg {
            width: 16px;
            height: 16px;
        }
        
        .delete-icon:hover {
            background-color: #fee2e2;
            transform: scale(1.1);
            color: #dc2626;
        }
        
        .pin-icon {
            cursor: pointer;
            font-size: 16px;
            padding: 4px 6px;
            margin: 0 2px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #6b7280;
            transition: all 0.2s ease;
            vertical-align: middle;
        }
        
        .pin-icon svg {
            width: 16px;
            height: 16px;
        }
        
        .pin-icon:hover {
            background-color: #fef3c7;
            transform: scale(1.1);
            color: #f59e0b;
        }
        
        .pin-icon.pinned {
            color: #f59e0b;
        }
        
        .pin-icon.pinned svg {
            fill: currentColor;
        }
        
        /* Thread Count Display Styles - Minimal inline like Slack */
        .thread-count-display {
            display: none;
            align-items: center;
            margin: 4px 0 0 0;
            padding: 0;
            color: #9ca3af;
            font-size: 12px;
            font-weight: 400;
            cursor: pointer;
            transition: color 0.15s ease;
            width: fit-content;
            background: none;
            border: none;
            line-height: 1.4;
        }
        
        .thread-count-display:hover {
            color: #6b7280;
            text-decoration: underline;
        }
        
        .thread-count-display svg {
            flex-shrink: 0;
            margin-right: 4px;
            color: #9ca3af;
            vertical-align: baseline;
            width: 12px;
            height: 12px;
            display: inline-block;
        }
        
        .thread-count-display:hover svg {
            color: #6b7280;
        }
        
        .thread-count-display span {
            display: inline;
            vertical-align: baseline;
        }
        
        /* Make thread count more prominent when visible */
        .comment-item:has(.thread-count-display[style*="flex"]) {
            position: relative;
        }
        
        /* Timeline Date Header for Pinned Messages */
        .timeline-date-header {
            margin: 24px 0 12px 0;
            padding: 0 12px;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .timeline-date-content {
            display: inline-flex;
            align-items: center;
            padding: 6px 16px;
            background: #f9fafb;
            border-radius: 20px;
            border: 1px solid #e5e7eb;
        }
        
        .timeline-date-text {
            font-size: 13px;
            font-weight: 600;
            color: #6b7280;
            letter-spacing: 0.01em;
        }
        `;
        document.head.appendChild(style);
    })();

    // Auto-resize functionality for contenteditable div
    if (newMessageInput) {
        function autoResizeInput() {
            // Check if we have the rich toolbar active
            const wrapper = document.querySelector('.input-with-send');
            const hasRichToolbar = wrapper && wrapper.classList.contains('has-rich-toolbar');
            
            // Set height to auto first to get accurate scrollHeight
            newMessageInput.style.height = 'auto';
            
            // Calculate the appropriate height based on content
            const scrollHeight = newMessageInput.scrollHeight;
            const minHeight = hasRichToolbar ? 104 : 44; // Different min heights for different modes
            const finalHeight = Math.max(scrollHeight, minHeight);
            
            // Set the height to grow with content
            newMessageInput.style.height = finalHeight + 'px';
            
            // Remove any max-height constraints to allow unlimited growth
            newMessageInput.style.maxHeight = 'none';
            newMessageInput.style.overflowY = 'hidden'; // Never show scrollbar
        }
        
        // Auto-resize on input
        newMessageInput.addEventListener('input', (e) => {
            autoResizeInput();
            // Auto-save draft as user types
            autoSaveDraft(newMessageInput);
        });
        
        // Auto-resize on paste
        newMessageInput.addEventListener('paste', () => {
            // Delay to allow paste content to be processed
            setTimeout(autoResizeInput, 10);
        });
        
        // Auto-resize on keyup (for backspace/delete)
        newMessageInput.addEventListener('keyup', autoResizeInput);
        
        // Auto-resize on keydown (for immediate feedback on Enter)
        newMessageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                // Delay to allow newline to be added first
                setTimeout(autoResizeInput, 5);
            }
        });
        
        // Auto-resize on focus (in case content changed while not focused)
        newMessageInput.addEventListener('focus', autoResizeInput);
        
        // Initial resize
        setTimeout(autoResizeInput, 100);

        // Add keyboard event handling for Enter key
        newMessageInput.addEventListener('keydown', function (e) {
            // Send on Ctrl/Cmd+Enter
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                let text = this.innerHTML.trim();
                
                // Check if there's a highlight attachment
                if (this.dataset.highlightAttachment === 'true') {
                    const highlightText = this.dataset.highlightText;
                    if (highlightText) {
                        // Include highlight in the message
                        const highlightCard = `<div style="background: #f7f7f8; border: 1px solid #e5e7eb; border-left: 3px solid #6b7280; border-radius: 8px; padding: 12px 16px; margin: 8px 0; font-size: 14px; line-height: 1.4; color: #374151; text-align: left; display: block; width: 100%; user-select: text; -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; position: relative;" contenteditable="false" onkeydown="return false;" onpaste="return false;" oncut="return false;" oncontextmenu="return false;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #6b7280; flex-shrink: 0;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path></svg><span style="font-size: 12px; color: #6b7280; font-weight: 500;">Attached highlight</span></div><div style="font-style: italic; pointer-events: none; margin: 0; color: #6b7280; padding-left: 22px;">"${highlightText}"</div></div>`;
                        
                        if (text) {
                            text = highlightCard + '<br><br>' + text;
                        } else {
                            text = highlightCard;
                        }
                    }
                }
                
                if (text) {
                    postNewMessage(text);
                    this.innerHTML = ''; // Clear input after posting
                    this.style.height = '44px'; // Reset height
                    // Clear highlight data
                    delete this.dataset.highlightAttachment;
                    delete this.dataset.highlightText;
                    // Remove highlight card from UI
                    const highlightCard = this.parentElement.querySelector('.highlight-attachment');
                    if (highlightCard) {
                        highlightCard.remove();
                    }
                    // Trigger resize to ensure proper reset
                    setTimeout(() => this.dispatchEvent(new Event('input')), 10);
                    // Clear draft after successful send
                    clearDraft('main');
                }
                return;
            }
            // Allow Enter and Shift+Enter to create new lines
        // But clean up content when sending
        });
    }

    // Add event listener for posting new comments (with optional image attachments)
    addMessageButton?.addEventListener('click', async function () {
        let text = newMessageInput.innerHTML.trim();

        // Include highlight card if present
        if (newMessageInput.dataset.highlightAttachment === 'true') {
            const highlightText = newMessageInput.dataset.highlightText;
            if (highlightText) {
                const highlightCard = `<div style="background: #f7f7f8; border: 1px solid #e5e7eb; border-left: 3px solid #6b7280; border-radius: 8px; padding: 12px 16px; margin: 8px 0; font-size: 14px; line-height: 1.4; color: #374151; text-align: left; display: block; width: 100%; user-select: text; -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; position: relative;" contenteditable="false" onkeydown="return false;" onpaste="return false;" oncut="return false;" oncontextmenu="return false;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #6b7280; flex-shrink: 0;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path></svg><span style="font-size: 12px; color: #6b7280; font-weight: 500;">Attached highlight</span></div><div style="font-style: italic; pointer-events: none; margin: 0; color: #6b7280; padding-left: 22px;">"${highlightText}"</div></div>`;
                text = text ? highlightCard + '<br><br>' + text : highlightCard;
            }
        }

        // Parse image attachments from dataset
        let images = [];
        try {
            if (newMessageInput.dataset.imageAttachments) {
                images = JSON.parse(newMessageInput.dataset.imageAttachments);
            }
        } catch (_) {
            images = [];
        }

        // Parse document attachments from dataset
        let documents = [];
        try {
            if (newMessageInput.dataset.documentAttachments) {
                documents = JSON.parse(newMessageInput.dataset.documentAttachments);
            }
        } catch (_) {
            documents = [];
        }

        if (!text && images.length === 0 && documents.length === 0) return; // require either text, images, or documents

        // Send images as separate messages (so they render full-width)
        if (images.length > 0) {
            images.forEach(img => {
                const imgHtml = `<div class=\"image-attachment\"><div class=\"image-attachment-inner\"><img src=\"${img.dataUrl}\" alt=\"${img.name}\" /></div></div>`;
                postNewMessage(imgHtml);
            });
        }

        // Send documents as separate formatted messages with preview/download buttons
        if (documents.length > 0) {
            // Process documents sequentially to ensure each is saved before sending
            for (const doc of documents) {
                // Save document to Firebase first and wait for it to complete
                await saveDocumentToFirebase(doc);
                
                // Create document message HTML
                const docHtml = createDocumentMessageHTML(doc);
                await postNewMessage(docHtml);
            }
        }

        if (text) {
            postNewMessage(text);
        }

        // Cleanup input and any previews
        newMessageInput.innerHTML = '';
        newMessageInput.style.height = '44px';
        delete newMessageInput.dataset.highlightAttachment;
        delete newMessageInput.dataset.highlightText;
        delete newMessageInput.dataset.imageAttachments;
        delete newMessageInput.dataset.documentAttachments;
        const parent = newMessageInput.parentElement;
        parent?.parentElement?.querySelectorAll('.image-attachment')?.forEach(el => el.remove());
        parent?.parentElement?.querySelectorAll('.document-attachment')?.forEach(el => el.remove());
        const highlightCardEl = parent?.parentElement?.querySelector('.highlight-attachment');
        if (highlightCardEl) highlightCardEl.remove();
        setTimeout(() => newMessageInput.dispatchEvent(new Event('input')), 10);
        
        // Clear draft after successful send
        await clearDraft('main');
    });

    // Initialize rich text functionality for main chat input
    function initializeMainChatRichText() {
        const mainRichTextToggle = document.getElementById('main-rich-text-toggle');
        const mainChatToolbar = document.getElementById('main-chat-toolbar');
        
        console.log('Rich text elements found:', { toggle: mainRichTextToggle, toolbar: mainChatToolbar });
        
        if (mainRichTextToggle && mainChatToolbar) {
            let isRichTextVisible = false;
            
            mainRichTextToggle.addEventListener('click', function(e) {
                console.log('Rich text toggle clicked!');
                isRichTextVisible = !isRichTextVisible;
                this.classList.toggle('active', isRichTextVisible);
                mainChatToolbar.classList.toggle('visible', isRichTextVisible);
                console.log('Toolbar visible:', isRichTextVisible, 'Classes:', mainChatToolbar.className);
                const wrapper = document.querySelector('.input-with-send');
                if (wrapper) {
                    wrapper.classList.toggle('has-rich-toolbar', isRichTextVisible);
                }
                
                // When toggling, enforce correct input height behavior
                if (isRichTextVisible) {
                    // Opening rich text: ensure resize
                    newMessageInput.style.maxHeight = '';
                    newMessageInput.style.overflowY = '';
                    setTimeout(() => autoResizeInput(), 10);
                } else {
                    // Closing rich text: force reset to compact size
                    // Remove any fixed heights and let it collapse
                    newMessageInput.style.height = '';
                    newMessageInput.style.maxHeight = 'none';
                    newMessageInput.style.overflowY = 'hidden';
                    
                    // Force collapse by setting to minimum height first
                    setTimeout(() => {
                        newMessageInput.style.height = '44px'; // Reset to minimum
                        // Then let autoResize handle the content-based height
                        setTimeout(() => {
                            autoResizeInput();
                        }, 5);
                    }, 10);
                }
                
                newMessageInput.focus();
            });
            
            // Apply formatting using execCommand
            mainChatToolbar.addEventListener('click', function(e) {
                const btn = e.target.closest('.rich-text-btn');
                if (!btn) return;
                
                const action = btn.dataset.action;
                newMessageInput.focus();
                
                // Ensure we have a selection or cursor position
                const selection = window.getSelection();
                if (!selection.rangeCount && newMessageInput.contains(document.activeElement)) {
                    const range = document.createRange();
                    range.setStart(newMessageInput, 0);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
                
                try {
                    document.execCommand('styleWithCSS', false, true);
                } catch (e) {
                    // Ignore if execCommand is not supported
                }
                
                switch (action) {
                    case 'bold':
                        document.execCommand('bold', false, null);
                        break;
                    case 'italic':
                        document.execCommand('italic', false, null);
                        break;
                    case 'underline':
                        document.execCommand('underline', false, null);
                        break;
                    case 'bulletList':
                        document.execCommand('insertUnorderedList', false, null);
                        break;
                    case 'numberedList':
                        document.execCommand('insertOrderedList', false, null);
                        break;
                }
                
                newMessageInput.focus();
            });
            
            // Handle dropdown toggles
            const dropdownToggles = mainChatToolbar.querySelectorAll('.text-color-toggle, .highlight-toggle, .font-size-toggle');
            dropdownToggles.forEach(toggle => {
                toggle.addEventListener('click', function(e) {
                    e.preventDefault();
                    const dropdown = this.parentElement;
                    dropdown.classList.toggle('open');
                });
            });
            
            // Handle color options
            const colorOptions = mainChatToolbar.querySelectorAll('.color-option');
            colorOptions.forEach(option => {
                option.addEventListener('click', function(e) {
                    e.preventDefault();
                    const action = this.dataset.action;
                    const color = this.dataset.color;
                    const dropdown = this.closest('.dropdown');
                    
                    if (dropdown) {
                        dropdown.classList.remove('open');
                    }
                    
                    newMessageInput.focus();
                    
                    // Ensure we have a selection or cursor position
                    const selection = window.getSelection();
                    if (!selection.rangeCount && newMessageInput.contains(document.activeElement)) {
                        const range = document.createRange();
                        range.setStart(newMessageInput, 0);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                    
                    try {
                        document.execCommand('styleWithCSS', false, true);
                    } catch (e) {
                        // Ignore if execCommand is not supported
                    }
                    
                    if (action === 'textColor') {
                        if (color === 'red') document.execCommand('foreColor', false, '#dc2626');
                        else if (color === 'blue') document.execCommand('foreColor', false, '#2563eb');
                        else if (color === 'green') document.execCommand('foreColor', false, '#16a34a');
                    } else if (action === 'highlight') {
                        if (color === 'none') {
                            document.execCommand('backColor', false, 'transparent');
                        } else if (color === 'yellow') document.execCommand('backColor', false, '#ffeb3b');
                        else if (color === 'blue') document.execCommand('backColor', false, '#4caf50');
                        else if (color === 'green') document.execCommand('backColor', false, '#4caf50');
                    }
                    
                    newMessageInput.focus();
                });
            });
            
            // Handle font size options
            const sizeOptions = mainChatToolbar.querySelectorAll('.size-option');
            sizeOptions.forEach(option => {
                option.addEventListener('click', function(e) {
                    e.preventDefault();
                    const size = this.dataset.size;
                    const dropdown = this.closest('.font-size-dropdown');
                    
                    if (dropdown) {
                        dropdown.classList.remove('open');
                    }
                    
                    newMessageInput.focus();
                    
                    // Ensure we have a selection or cursor position
                    const selection = window.getSelection();
                    if (!selection.rangeCount && newMessageInput.contains(document.activeElement)) {
                        const range = document.createRange();
                        range.setStart(newMessageInput, 0);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                    
                    try {
                        document.execCommand('styleWithCSS', false, true);
                        const sizeMap = { small: '2', normal: '3', large: '5' };
                        document.execCommand('fontSize', false, sizeMap[size] || '3');
                    } catch (e) {
                        // Ignore if execCommand is not supported
                    }
                    
                    newMessageInput.focus();
                });
            });
        } else {
            console.log('Rich text elements not found, retrying in 100ms...');
            setTimeout(initializeMainChatRichText, 100);
        }
    }
    
    // Try to initialize immediately, and retry if needed
    initializeMainChatRichText();
    
    // Initialize emoji picker for main chat
    function initializeMainChatEmojiPicker() {
        const mainEmojiToggle = document.getElementById('main-emoji-toggle');
        const newMessageInput = document.getElementById('new-message');
        
        if (mainEmojiToggle && newMessageInput) {
            mainEmojiToggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Toggle emoji picker
                const existingPicker = document.getElementById('emoji-picker-container');
                if (existingPicker) {
                    closeEmojiPicker();
                    mainEmojiToggle.classList.remove('active');
                } else {
                    showEmojiPicker(mainEmojiToggle, newMessageInput, (emoji) => {
                        // Insert emoji into input
                        const selection = window.getSelection();
                        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
                        
                        if (range && newMessageInput.contains(range.commonAncestorContainer)) {
                            range.deleteContents();
                            const textNode = document.createTextNode(emoji);
                            range.insertNode(textNode);
                            range.setStartAfter(textNode);
                            range.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        } else {
                            // Fallback: append emoji
                            newMessageInput.focus();
                            if (newMessageInput.childNodes.length > 0) {
                                const lastNode = newMessageInput.childNodes[newMessageInput.childNodes.length - 1];
                                if (lastNode.nodeType === Node.TEXT_NODE) {
                                    lastNode.textContent += emoji;
                                } else {
                                    newMessageInput.appendChild(document.createTextNode(emoji));
                                }
                            } else {
                                newMessageInput.textContent = emoji;
                            }
                            
                            // Move cursor to end
                            const range = document.createRange();
                            range.selectNodeContents(newMessageInput);
                            range.collapse(false);
                            const selection = window.getSelection();
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                        
                        newMessageInput.dispatchEvent(new Event('input'));
                        mainEmojiToggle.classList.remove('active');
                    });
                    mainEmojiToggle.classList.add('active');
                }
            });
        } else {
            setTimeout(initializeMainChatEmojiPicker, 100);
        }
    }
    
    initializeMainChatEmojiPicker();
    
    // Global dropdown close handler for main chat toolbar
    document.addEventListener('click', (e) => {
        const mainChatToolbar = document.getElementById('main-chat-toolbar');
        if (!mainChatToolbar) return;
        
        // Close highlight dropdowns when clicking outside
        const highlightDropdowns = mainChatToolbar.querySelectorAll('.highlight-dropdown');
        highlightDropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
        
        // Close text color dropdowns when clicking outside
        const textColorDropdowns = mainChatToolbar.querySelectorAll('.text-color-dropdown');
        textColorDropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
        
        // Close font size dropdowns when clicking outside  
        const fontSizeDropdowns = mainChatToolbar.querySelectorAll('.font-size-dropdown');
        fontSizeDropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    });

    document.getElementById("messages-back").addEventListener('click', function () {
        // Reset messaging state and reload contacts
        resetMessagingState();
        loadContactsPanel();
        // showContactList();
    });

    // openContactsButton.addEventListener('click', function () {
    //     showContactList();
    //     openContactsButton.style.display = "none";
    //     closeContactsButton.style.display = "block";
    // });
    // closeContactsButton.addEventListener('click', function () {
    //     hideContactList();
    //     closeContactsButton.style.display = "none";
    //     openContactsButton.style.display = "block";
    // });



    window.addEventListener('message', async function (event) {
        if (event.data.action === "activeChat") {
            currentChatId = event.data.id;
            setCurrentTopic("groqChats-" + currentChatId, "groqChats");
            loadContactsPanel();
            loadMessages();
            var iframe = document.getElementById("groq-iframe");
            var companyEmail = await getMainCompanyEmail();
            iframe.contentWindow.postMessage({ action: "Show Highlights", companyEmail: companyEmail }, "*");
        }
        else if (event.data.action === "updateMessagingTopic") {
            // Update the current topic when a Groq chat is selected from the chat sidebar
            const chatId = event.data.chatId;
            const chatTitle = event.data.chatTitle;
            setCurrentTopic("groqChats-" + chatId, "groqChats", chatTitle);
            loadContactsPanel();
            loadMessages();
            console.log("Updated messaging topic to:", "groqChats-" + chatId, "for chat:", chatTitle);
        }
    });

    // Function to filter contacts based on search term
    function filterContacts(searchTerm) {
        const contactButtons = document.querySelectorAll('.contact-btn');
        
        contactButtons.forEach(button => {
            const contactName = button.querySelector('.contact-name').textContent.toLowerCase();
            const contactEmail = button.querySelector('.contact-footer').textContent.toLowerCase();
            
            if (searchTerm === '' || contactName.includes(searchTerm) || contactEmail.includes(searchTerm)) {
                button.style.display = 'flex';
            } else {
                button.style.display = 'none';
            }
        });
    }
    
    showContactList();
    
    // Add search functionality
    const searchInput = document.getElementById('messaging-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            filterContacts(searchTerm);
        });
    }
    
    // Global emoji event listener as a fallback
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('emoji-option')) {
            const emoji = e.target.dataset.emoji;
            const messageId = e.target.dataset.messageId;
            
            if (emoji && messageId) {
                console.log('Global emoji click caught:', emoji, 'for message:', messageId);
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    await toggleReaction(messageId, emoji);
                } catch (error) {
                    console.error('Error in global emoji handler:', error);
                }
            }
        }
    });
    
    // Global dropdown close handler
    document.addEventListener('click', (e) => {
        // Close highlight dropdowns when clicking outside
        const highlightDropdowns = document.querySelectorAll('.highlight-dropdown');
        highlightDropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
        
        // Close text color dropdowns when clicking outside
        const textColorDropdowns = document.querySelectorAll('.text-color-dropdown');
        textColorDropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
        
        // Close font size dropdowns when clicking outside  
        const fontSizeDropdowns = document.querySelectorAll('.font-size-dropdown');
        fontSizeDropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    });
    
    const resizer = document.getElementById('messaging-resizer');
    const topicsPanel = document.getElementById('topics-panel');
    const contactsPanelOuter = document.getElementById('contacts-panel-outer');
    const container = document.getElementById('messaging-sub-frame'); // The parent container
    //Overlay is needed because resizing event does not fire when mouse is over the iframe
    const overlay = document.getElementById('iframe-overlay');

    let isResizing = false;

    resizer.addEventListener('mousedown', function (e) {
        isResizing = true;
        // Add event listeners to the document to capture mouse movements globally
        overlay.style.display = 'block';
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResizing);
    });

    function resize(e) {
        console.log(isResizing);
        if (!isResizing) return;

        const containerRect = container.getBoundingClientRect();
        const newTopicsWidth = e.clientX - containerRect.left;
        const totalWidth = containerRect.width;

        // Calculate new widths, ensuring minimum width and not exceeding total width
        // Adjust minWidth as needed
        const minWidth = 238;

        let topicsPanelWidth = Math.max(minWidth, newTopicsWidth);
        topicsPanelWidth = Math.min(topicsPanelWidth, totalWidth - minWidth);
        const contactsPanelWidth = totalWidth - topicsPanelWidth;

        // Update the styles
        topicsPanel.style.width = topicsPanelWidth + 'px';
        contactsPanelOuter.style.width = contactsPanelWidth + 'px';
    }

    function stopResizing() {
        isResizing = false;
        // Remove the event listeners
        overlay.style.display = 'none';
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResizing);
    }

    // Ensure no accidental highlight on editor root when focusing
    newMessageInput.addEventListener('focus', () => {
        // Clear any inline background applied to the root contenteditable
        newMessageInput.style.backgroundColor = 'transparent';
        try {
            document.execCommand('styleWithCSS', false, true);
            // Make sure default typing does not carry a background highlight
            document.execCommand('backColor', false, 'transparent');
        } catch (e) {
            // execCommand may not be supported in some contexts; ignore
        }
    });

    // Paste as plain text to avoid importing background/highlight styles
    newMessageInput.addEventListener('paste', (e) => {
        const clipboard = e.clipboardData || window.clipboardData;
        if (!clipboard) return;
        const text = clipboard.getData('text/plain');
        if (typeof text === 'string') {
            e.preventDefault();
            document.execCommand('insertText', false, text);
            setTimeout(() => autoResizeInput(), 0);
        }
    });

    // Keep existing formatting features; do not force background changes on focus
    newMessageInput.addEventListener('focus', () => { /* no-op */ });
});

//Manual logging images path:
// categoriesImages
// ABC
// images
// img_1748371264492_au3i9s1na
// data
// :
// "data:image/png;base64,iVBORw0KGgoAAAA
// imageId
// :
// "img_1748371264492_au3i9s1na"
// name
// :
// "contactButtons.png"
// note
// :
// "Note goes here"
// selectedText
// :
// "help"
// size
// :
// 274424
// timestamp
// :
// "2025-05-27T18:41:04.482Z"
// type
// :
// "image/png"

//Manual logging categories path:
// manualLoggingCategories
// ABC
// createdAt
// :
// "2025-05-27T18:40:55.603Z"
// name
// :
// "ABC"

// ================================
// SCHEDULE SEND FUNCTIONALITY
// ================================

// Global variables for scheduled messages
let scheduledMessages = new Map();
let scheduleCheckInterval = null;

// Initialize schedule send system
function initializeScheduleSend() {
    loadScheduledMessages();
    startScheduleChecker();
    setupScheduleModalEventListeners();
}

// Load scheduled messages from storage
async function loadScheduledMessages() {
    try {
        // Use the same Firebase path structure as other data
        const companyEmail = await getMainCompanyEmail();
        const currentProject = await getCurrentProject();
        const firebasePath = `Companies/${companyEmail}/projects/${currentProject}/scheduledMessages`;

        const response = await new Promise((resolve) => {
            sendRuntimeMessage({
                action: "getFirebaseData",
                path: firebasePath
            }, response => {
                resolve(response);
            });
        });

        if (response && response.success && response.data) {
            scheduledMessages = new Map(JSON.parse(response.data));
            console.log('Loaded scheduled messages from Firebase:', scheduledMessages.size);
        } else {
            // Fallback to localStorage
            const stored = localStorage.getItem('scheduledMessages');
            if (stored) {
                scheduledMessages = new Map(JSON.parse(stored));
                console.log('Loaded scheduled messages from localStorage:', scheduledMessages.size);
            }
        }
    } catch (error) {
        console.error('Error loading scheduled messages:', error);
        // Fallback to localStorage
        try {
            const stored = localStorage.getItem('scheduledMessages');
            if (stored) {
                scheduledMessages = new Map(JSON.parse(stored));
                console.log('Loaded scheduled messages from localStorage fallback:', scheduledMessages.size);
            }
        } catch (localError) {
            console.error('Error loading from localStorage:', localError);
            scheduledMessages = new Map();
        }
    }
}

// Save scheduled messages to storage
async function saveScheduledMessages() {
    try {
        const serialized = JSON.stringify(Array.from(scheduledMessages.entries()));
        
        // Use the same Firebase path structure as other data
        const companyEmail = await getMainCompanyEmail();
        const currentProject = await getCurrentProject();
        const firebasePath = `Companies/${companyEmail}/projects/${currentProject}/scheduledMessages`;

        await sendRuntimeMessage({
            action: "saveFirebaseData",
            path: firebasePath,
            data: serialized
        });
        
        console.log('Saved scheduled messages to Firebase successfully');
    } catch (error) {
        console.error('Error saving scheduled messages to Firebase:', error);
        // Fallback to localStorage
        try {
            const serialized = JSON.stringify(Array.from(scheduledMessages.entries()));
            localStorage.setItem('scheduledMessages', serialized);
            console.log('Saved scheduled messages to localStorage as fallback');
        } catch (localError) {
            console.error('Error saving to localStorage:', localError);
        }
    }
}

// Open the schedule send modal
function openScheduleSendModal() {
    // Check if we're in a chat
    if (!currentlyChattingWith || currentlyChattingWith === "") {
        alert('Please select a contact to chat with first.');
        return;
    }

    const modal = document.getElementById('schedule-send-modal');
    if (!modal) {
        console.error('Schedule modal not found');
        return;
    }

    // Get message content
    const messageInput = document.getElementById('new-message');
    let messageText = messageInput ? messageInput.innerHTML.trim() : '';
    
    // Check attachments
    let hasHighlightAttachment = false;
    let highlightText = '';
    if (messageInput && messageInput.dataset.highlightAttachment === 'true') {
        hasHighlightAttachment = true;
        highlightText = messageInput.dataset.highlightText || '';
    }
    let hasImageAttachments = false;
    try {
        if (messageInput && messageInput.dataset.imageAttachments) {
            const imgs = JSON.parse(messageInput.dataset.imageAttachments);
            hasImageAttachments = Array.isArray(imgs) && imgs.length > 0;
        }
    } catch (_) { hasImageAttachments = false; }
    
    let hasDocumentAttachments = false;
    try {
        if (messageInput && messageInput.dataset.documentAttachments) {
            const docs = JSON.parse(messageInput.dataset.documentAttachments);
            hasDocumentAttachments = Array.isArray(docs) && docs.length > 0;
        }
    } catch (_) { hasDocumentAttachments = false; }
    
    // Allow scheduling with text OR any attachment
    if (!messageText && !hasHighlightAttachment && !hasImageAttachments && !hasDocumentAttachments) {
        alert('Please enter a message or attach a file to schedule.');
        return;
    }
    
    // Build the full message content including highlight if present
    let fullMessageContent = messageText;
    if (hasHighlightAttachment && highlightText) {
        const highlightCard = `<div style="background: #f7f7f8; border: 1px solid #e5e7eb; border-left: 3px solid #6b7280; border-radius: 8px; padding: 12px 16px; margin: 8px 0; font-size: 14px; line-height: 1.4; color: #374151; text-align: left; display: block; width: 100%; user-select: text; -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; position: relative;" contenteditable="false" onkeydown="return false;" onpaste="return false;" oncut="return false;" oncontextmenu="return false;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #6b7280; flex-shrink: 0;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path></svg><span style="font-size: 12px; color: #6b7280; font-weight: 500;">Attached highlight</span></div><div style="font-style: italic; pointer-events: none; margin: 0; color: #6b7280; padding-left: 22px;">"${highlightText}"</div></div>`;
        
        if (messageText) {
            fullMessageContent = highlightCard + '<br><br>' + messageText;
        } else {
            fullMessageContent = highlightCard;
        }
    }



    // Set default date/time (1 hour from now)
    const now = new Date();
    const defaultTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    
    const dateInput = document.getElementById('schedule-date');
    const timeInput = document.getElementById('schedule-time');
    
    if (dateInput) {
        dateInput.value = defaultTime.toISOString().split('T')[0];
    }
    if (timeInput) {
        timeInput.value = defaultTime.toTimeString().slice(0, 5);
    }

    // Clear validation message
    const validationMessage = document.getElementById('schedule-validation-message');
    if (validationMessage) {
        validationMessage.style.display = 'none';
    }

    // Show modal
    modal.style.display = 'flex';
}

// Close the schedule send modal
function closeScheduleSendModal() {
    const modal = document.getElementById('schedule-send-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Setup modal event listeners
function setupScheduleModalEventListeners() {
    // Close button
    const closeBtn = document.getElementById('close-schedule-modal');
    const cancelBtn = document.getElementById('cancel-schedule');
    const confirmBtn = document.getElementById('confirm-schedule');
    const modal = document.getElementById('schedule-send-modal');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeScheduleSendModal);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeScheduleSendModal);
    }

    if (modal) {
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                closeScheduleSendModal();
            }
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', handleScheduleConfirm);
    }

    // Real-time validation
    const dateInput = document.getElementById('schedule-date');
    const timeInput = document.getElementById('schedule-time');

    if (dateInput) {
        dateInput.addEventListener('change', validateScheduleTime);
    }
    if (timeInput) {
        timeInput.addEventListener('change', validateScheduleTime);
    }
}

// Validate scheduled time
function validateScheduleTime() {
    const dateInput = document.getElementById('schedule-date');
    const timeInput = document.getElementById('schedule-time');
    const validationMessage = document.getElementById('schedule-validation-message');
    const confirmBtn = document.getElementById('confirm-schedule');

    if (!dateInput || !timeInput || !validationMessage || !confirmBtn) return;

    const selectedDate = dateInput.value;
    const selectedTime = timeInput.value;

    if (!selectedDate || !selectedTime) {
        validationMessage.style.display = 'none';
        confirmBtn.disabled = false;
        return;
    }

    const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}`);
    const now = new Date();

    if (scheduledDateTime <= now) {
        validationMessage.textContent = 'Please select a future date and time.';
        validationMessage.className = 'schedule-validation-message error';
        validationMessage.style.display = 'block';
        confirmBtn.disabled = true;
    } else {
        validationMessage.style.display = 'none';
        confirmBtn.disabled = false;
    }
}

// Update a scheduled message in the chat to show its status
function updateScheduledMessageInChat(messageId, status) {
    try {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;

        const scheduledLabel = messageElement.querySelector('.scheduled-send-label');
        if (scheduledLabel) {
            if (status === 'sent') {
                // Remove the scheduled label completely to make it a regular message
                scheduledLabel.remove();
            } else if (status === 'sending') {
                scheduledLabel.textContent = 'Sending...';
                scheduledLabel.style.backgroundColor = '#f59e0b'; // Orange for sending
            } else if (status === 'failed') {
                scheduledLabel.textContent = 'Failed';
                scheduledLabel.style.backgroundColor = '#ef4444'; // Red for failed
            }
        }

        console.log(`Updated scheduled message ${messageId} status to: ${status}`);
    } catch (error) {
        console.error('Error updating scheduled message in chat:', error);
    }
}

// Display a scheduled message immediately in the chat
async function displayScheduledMessage(scheduledMessage) {
    try {
        const userEmail = await getUserEmail();
        const userName = await getUserName();
        
        // Create a message object for display (similar to postNewMessage structure)
        const displayMessage = {
            text: scheduledMessage.text, // This already includes the full content with highlights
            email: userEmail,
            name: userName,
            timestamp: new Date().toISOString(),
            messageId: scheduledMessage.id,
            reactions: {},
            editedAt: null,
            isScheduled: true, // Mark as scheduled for the label
            scheduledTime: scheduledMessage.scheduledTime,
            status: 'scheduled',
            hasHighlightAttachment: scheduledMessage.hasHighlightAttachment,
            highlightText: scheduledMessage.highlightText
        };

        // Create the message element
        const messageElement = await createMessageElement(displayMessage, userEmail);
        
        // Add it to the messages list
        const messagesList = document.getElementById('messages-list');
        if (messagesList) {
            messagesList.appendChild(messageElement);
            
            // Scroll to the bottom to show the new message
            messagesList.scrollTop = messagesList.scrollHeight;
        }

        console.log('Scheduled message displayed in chat:', scheduledMessage.id);
    } catch (error) {
        console.error('Error displaying scheduled message:', error);
    }
}

// Handle schedule confirmation
async function handleScheduleConfirm() {
    const dateInput = document.getElementById('schedule-date');
    const timeInput = document.getElementById('schedule-time');
    const messageInput = document.getElementById('new-message');
    const validationMessage = document.getElementById('schedule-validation-message');

    if (!dateInput || !timeInput || !messageInput) {
        console.error('Required elements not found');
        return;
    }

    const selectedDate = dateInput.value;
    const selectedTime = timeInput.value;
    let messageText = messageInput.innerHTML.trim();
    
    // Check if there's a highlight attachment
    let hasHighlightAttachment = false;
    let highlightText = '';
    if (messageInput.dataset.highlightAttachment === 'true') {
        hasHighlightAttachment = true;
        highlightText = messageInput.dataset.highlightText || '';
    }
    
    // Allow scheduling with just a highlight attachment (no text required)
    if (!selectedDate || !selectedTime || (!messageText && !hasHighlightAttachment)) {
        if (validationMessage) {
            validationMessage.textContent = 'Please fill in all required fields.';
            validationMessage.className = 'schedule-validation-message error';
            validationMessage.style.display = 'block';
        }
        return;
    }
    
    // Build the full message content including highlight if present
    let fullMessageContent = messageText;
    if (hasHighlightAttachment && highlightText) {
        const highlightCard = `<div style="background: #f7f7f8; border: 1px solid #e5e7eb; border-left: 3px solid #6b7280; border-radius: 8px; padding: 12px 16px; margin: 8px 0; font-size: 14px; line-height: 1.4; color: #374151; text-align: left; display: block; width: 100%; user-select: text; -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; position: relative;" contenteditable="false" onkeydown="return false;" onpaste="return false;" oncut="return false;" oncontextmenu="return false;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #6b7280; flex-shrink: 0;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path></svg><span style="font-size: 12px; color: #6b7280; font-weight: 500;">Attached highlight</span></div><div style="font-style: italic; pointer-events: none; margin: 0; color: #6b7280; padding-left: 22px;">"${highlightText}"</div></div>`;
        
        if (messageText) {
            fullMessageContent = highlightCard + '<br><br>' + messageText;
        } else {
            fullMessageContent = highlightCard;
        }
    }

    const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}`);
    const now = new Date();

    if (scheduledDateTime <= now) {
        if (validationMessage) {
            validationMessage.textContent = 'Please select a future date and time.';
            validationMessage.className = 'schedule-validation-message error';
            validationMessage.style.display = 'block';
        }
        return;
    }

    try {
        // Create scheduled message object
        const scheduledMessage = {
            id: Date.now().toString(),
            text: fullMessageContent, // Use full content including highlights
            scheduledTime: scheduledDateTime.toISOString(),
            recipient: currentlyChattingWith,
            recipientName: currentName,
            recipientImg: currentImg,
            createdAt: now.toISOString(),
            status: 'scheduled', // scheduled, sent, cancelled
            hasHighlightAttachment: hasHighlightAttachment,
            highlightText: highlightText
        };

        // Store the scheduled message
        scheduledMessages.set(scheduledMessage.id, scheduledMessage);
        await saveScheduledMessages();

        // Immediately display the scheduled message in the chat
        await displayScheduledMessage(scheduledMessage);

        // Clear the message input
        messageInput.innerHTML = '';
        messageInput.style.height = '44px';

        // Clear highlight data if present
        if (hasHighlightAttachment) {
            delete messageInput.dataset.highlightAttachment;
            delete messageInput.dataset.highlightText;
            
            // Remove highlight card from UI if present
            const highlightCard = messageInput.parentElement.querySelector('.highlight-attachment');
            if (highlightCard) {
                highlightCard.remove();
            }
        }

        // Show success message
        if (validationMessage) {
            validationMessage.textContent = `Message scheduled for ${scheduledDateTime.toLocaleString()}`;
            validationMessage.className = 'schedule-validation-message success';
            validationMessage.style.display = 'block';
        }

        // Close modal after a short delay
        setTimeout(() => {
            closeScheduleSendModal();
        }, 1500);

        console.log('Message scheduled successfully:', scheduledMessage);

    } catch (error) {
        console.error('Error scheduling message:', error);
        if (validationMessage) {
            validationMessage.textContent = 'Failed to schedule message. Please try again.';
            validationMessage.className = 'schedule-validation-message error';
            validationMessage.style.display = 'block';
        }
    }
}

// Start the schedule checker
function startScheduleChecker() {
    if (scheduleCheckInterval) {
        clearInterval(scheduleCheckInterval);
    }

    // Check every 30 seconds for scheduled messages
    scheduleCheckInterval = setInterval(checkScheduledMessages, 30000);
    
    // Also check immediately on startup
    checkScheduledMessages();
}

// Check for scheduled messages that are ready to send
async function checkScheduledMessages() {
    const now = new Date();
    const messagesToSend = [];

    for (const [id, message] of scheduledMessages) {
        if (message.status === 'scheduled') {
            const scheduledTime = new Date(message.scheduledTime);
            if (scheduledTime <= now) {
                messagesToSend.push({ id, message });
            }
        }
    }

    for (const { id, message } of messagesToSend) {
        try {
            await sendScheduledMessage(id, message);
        } catch (error) {
            console.error(`Error sending scheduled message ${id}:`, error);
        }
    }
}

// Send a scheduled message
async function sendScheduledMessage(id, message) {
    console.log('Sending scheduled message:', id, message);

    // Update message status to sending
    message.status = 'sending';
    scheduledMessages.set(id, message);
    await saveScheduledMessages();

    try {
        // Check if we're still chatting with the same person
        if (currentlyChattingWith !== message.recipient) {
            console.log('Switching to recipient for scheduled message:', message.recipient);
            // We need to switch to the correct chat context
            // For now, we'll store this for later processing
            message.status = 'pending_context_switch';
            scheduledMessages.set(id, message);
            await saveScheduledMessages();
            return;
        }

        // Update the existing scheduled message in the chat to show it was sent
        updateScheduledMessageInChat(id, 'sent');

        // Send the message using the existing postNewMessage function
        // Don't pass the scheduled flag - this should be a regular message for the recipient
        await postNewMessage(message.text, false);

        // Update message status to sent
        message.status = 'sent';
        message.sentAt = new Date().toISOString();
        scheduledMessages.set(id, message);
        await saveScheduledMessages();

        console.log('Scheduled message sent successfully:', id);

    } catch (error) {
        console.error('Error sending scheduled message:', error);
        
        // Update message status to failed
        message.status = 'failed';
        message.error = error.message;
        scheduledMessages.set(id, message);
        await saveScheduledMessages();
    }
}

// Process pending messages when chat context changes
async function processPendingScheduledMessages() {
    const pendingMessages = [];
    
    for (const [id, message] of scheduledMessages) {
        if (message.status === 'pending_context_switch' && message.recipient === currentlyChattingWith) {
            pendingMessages.push({ id, message });
        }
    }

    for (const { id, message } of pendingMessages) {
        try {
            await sendScheduledMessage(id, message);
        } catch (error) {
            console.error(`Error sending pending scheduled message ${id}:`, error);
        }
    }
}

// Initialize schedule send when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeScheduleSend();
});

// Contact Profile Page Functions
function showContactProfilePage() {
    const profilePage = document.getElementById('contact-profile-page');
    const messagingInterface = document.getElementById('messaging-sub-frame');
    
    if (!profilePage) {
        console.log('Profile page not found');
        return;
    }

    // Update profile page content with current contact information
    const profileImg = document.getElementById('profile-page-img');
    const profileName = document.getElementById('profile-page-name');
    const profileEmail = document.getElementById('profile-page-email');
    const contactEmail = document.getElementById('contact-email');

    if (profileImg && currentImg) {
        profileImg.src = currentImg;
    }
    if (profileName && currentName) {
        profileName.textContent = currentName;
    }
    if (profileEmail && currentlyChattingWith) {
        profileEmail.textContent = currentlyChattingWith;
    }
    if (contactEmail && currentlyChattingWith) {
        contactEmail.textContent = currentlyChattingWith;
    }

    // Setup back button event listener
    setupBackButton();

    // Hide messaging interface and show profile page
    if (messagingInterface) {
        messagingInterface.style.display = 'none';
    }
    
    profilePage.style.display = 'block';
    console.log('Profile page displayed');
}

function setupBackButton() {
    const backButton = document.getElementById('back-to-messages');
    console.log('Setting up back button:', backButton);
    
    if (backButton) {
        // Remove any existing event listeners
        const newBackButton = backButton.cloneNode(true);
        backButton.parentNode.replaceChild(newBackButton, backButton);
        
        // Add new event listener
        newBackButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Back button clicked!');
            hideContactProfilePage();
        });
        
        console.log('Back button event listener attached');
    } else {
        console.log('Back button not found!');
    }
}

// Global function for showing content panels
function showContent(contentType) {
    // Remove active class from all pills
    const allPills = document.querySelectorAll('.content-pill');
    allPills.forEach(pill => pill.classList.remove('active'));
    
    // Add active class to clicked pill
    const activePill = document.querySelector(`[data-content="${contentType}"]`);
    if (activePill) {
        activePill.classList.add('active');
    }
    
    // Hide all content panels
    const allPanels = document.querySelectorAll('.content-panel');
    allPanels.forEach(panel => panel.classList.remove('active'));
    
    // Show selected content panel
    const activePanel = document.getElementById(`${contentType}-panel`);
    if (activePanel) {
        activePanel.classList.add('active');
    }
    
    console.log(`Switched to ${contentType} content`);
}

function hideContactProfilePage() {
    console.log('hideContactProfilePage called');
    const profilePage = document.getElementById('contact-profile-page');
    const messagingInterface = document.getElementById('messaging-sub-frame');
    
    console.log('Elements found:', { profilePage, messagingInterface });
    
    if (!profilePage) {
        console.log('Profile page not found');
        return;
    }

    // Hide profile page and show messaging interface
    profilePage.style.display = 'none';
    console.log('Profile page hidden');
    
    if (messagingInterface) {
        messagingInterface.style.display = 'flex';
        console.log('Messaging interface shown');
    } else {
        console.log('Messaging interface not found');
    }
}

// Also initialize when the messaging module loads
if (typeof window !== 'undefined') {
    // Make functions globally available
    window.openScheduleSendModal = openScheduleSendModal;
    window.closeScheduleSendModal = closeScheduleSendModal;
    window.processPendingScheduledMessages = processPendingScheduledMessages;
    window.showContactProfilePage = showContactProfilePage;
    window.hideContactProfilePage = hideContactProfilePage;
}
