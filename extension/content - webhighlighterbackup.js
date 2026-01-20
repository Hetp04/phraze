//Not using this anymore because it can't handle dynamically generated pages since it highlights a set range no matter what is on the page
//https://github.com/alienzhou/web-highlighter
import Highlighter from 'web-highlighter';

// Initialize the highlighter with auto-initialization disabled
const highlighter = new Highlighter({
    exceptSelectors: ['#label-adder-indicator'], // Exclude our indicator from highlighting
    enable: true,
    wrapTag: 'mark', // Use semantic HTML5 mark tag
    style: {
        className: 'web-highlighter'
    },
    splitType: 'unified' // Use unified highlights instead of split elements
});

// Add our styles to the document
const style = document.createElement('style');
style.textContent = `
    [data-highlight-id] {
        background-color: yellow !important;
        color: black !important;
        padding: 2px !important;
        margin: 2px !important;
        border-radius: 3px !important;
        cursor: pointer !important;
        display: inline !important;
        position: relative !important;
        z-index: 1 !important;
    }
    
    [data-highlight-id]:hover {
        background-color: #ffeb3b !important;
    }

    /* Hide empty highlight elements */
    [data-highlight-id]:empty {
        display: none !important;
    }
`;
document.head.appendChild(style);

// Add event listeners for debugging
highlighter.on(Highlighter.event.CREATE, ({ sources }) => {
    console.log('Highlight CREATE event:', sources);
});

highlighter.on(Highlighter.event.HOVER, ({ id }) => {
    console.log('Highlight HOVER event:', id);
});

highlighter.on(Highlighter.event.ERROR, (error) => {
    console.error('Highlight ERROR event:', error);
});

// Track last storage operation time
let lastStorageUpdate = 0;
const MIN_STORAGE_INTERVAL = 60000; // Minimum 1 minute between storage operations

console.warn('==========================================');
console.warn('CONTENT.JS LOADED - CHECK YOUR CONSOLE!');
console.warn('==========================================');

// Add a small indicator element to the page to visually confirm script execution
(function () {
    try {
        const indicator = document.createElement('div');
        indicator.style.position = 'fixed';
        indicator.style.top = '0';
        indicator.style.right = '0';
        indicator.style.backgroundColor = 'rgba(255,0,0,0.7)';
        indicator.style.color = 'white';
        indicator.style.padding = '5px';
        indicator.style.zIndex = '9999';
        indicator.style.fontSize = '12px';
        indicator.textContent = 'Label Adder Extension Active';
        indicator.id = 'label-adder-indicator';
        // Only add if it doesn't exist yet
        if (!document.getElementById('label-adder-indicator')) {
            document.body.appendChild(indicator);
            // Auto-remove after 5 seconds
            setTimeout(() => {
                indicator.remove();
            }, 5000);
        }
    } catch (e) {
        console.error('Error creating indicator:', e);
    }
})();

// Store highlights in chrome.storage.sync with rate limiting
async function saveHighlight(sources) {
    const now = Date.now();
    console.log('saveHighlight', sources);

    const url = window.location.href;

    if (await isUserLoggedIn()) {
        // Save to Firebase if user is logged in
        const companyEmail = await getMainCompanyEmail();
        if (!companyEmail) {
            console.error('No company email found');
            return;
        }

        // Get existing highlights first
        chrome.runtime.sendMessage({
            action: "getFirebaseData",
            path: `Companies/${companyEmail}/highlights/${url}`
        }, (response) => {
            const existingHighlights = response?.success && response?.data ? response.data : [];

            // Add new highlights
            sources.forEach(source => {
                const highlight = {
                    id: source.id,
                    text: source.text,
                    startMeta: source.startMeta,
                    endMeta: source.endMeta,
                    timestamp: now
                };
                existingHighlights.push(highlight);
            });

            // Save back to Firebase
            chrome.runtime.sendMessage({
                action: "saveFirebaseData",
                path: `Companies/${companyEmail}/highlights/${url}`,
                data: existingHighlights
            }, (response) => {
                if (response?.success) {
                    lastStorageUpdate = now;
                    // Set current highlight for other extension features
                    if (sources.length > 0) {
                        setCurrentURL(sources[0].text, url);
                    }
                } else {
                    console.error('Failed to save highlights to Firebase:', response?.error);
                }
            });
        });
    } else {
        // Fallback to chrome.storage if not logged in
        chrome.storage.sync.get({ highlights: {} }, (data) => {
            const highlights = data.highlights;
            if (!highlights[url]) {
                highlights[url] = [];
            }

            sources.forEach(source => {
                const highlight = {
                    id: source.id,
                    text: source.text,
                    startMeta: source.startMeta,
                    endMeta: source.endMeta
                };
                highlights[url].push(highlight);
            });

            chrome.storage.sync.set({ highlights }, () => {
                lastStorageUpdate = now;
                if (sources.length > 0) {
                    setCurrentURL(sources[0].text, url);
                }
            });
        });
    }
}

// Load and apply stored highlights with rate limiting
async function loadStoredHighlights() {
    
    highlighter.removeAll();
    console.log('loadStoredHighlights');
    const now = Date.now();
    const url = window.location.href;

    if (await isUserLoggedIn()) {
        // Load from Firebase if user is logged in
        const companyEmail = await getMainCompanyEmail();
        if (!companyEmail) {
            console.error('No company email found');
            return;
        }

        chrome.runtime.sendMessage({
            action: "getFirebaseData",
            path: `Companies/${companyEmail}/highlights/${url}`
        }, (response) => {
            if (response?.success && response?.data) {
                const urlHighlights = response.data;
                urlHighlights.forEach(highlight => {
                    try {
                        highlighter.fromStore(
                            highlight.startMeta,
                            highlight.endMeta,
                            highlight.id,
                            highlight.text
                        );
                    } catch (error) {
                        console.warn('Failed to load highlight:', error);
                    }
                });
                lastStorageUpdate = now;
                // Clean up any empty highlights after loading
                setTimeout(cleanupEmptyHighlights, 100);
            } else {
                console.log('No highlights found in Firebase or error:', response?.error);
            }
        });
    } else {
        // Fallback to chrome.storage if not logged in
        chrome.storage.sync.get({ highlights: {} }, (data) => {
            const urlHighlights = data.highlights[url] || [];
            urlHighlights.forEach(highlight => {
                console.log('highlight', highlight);
                try {
                    highlighter.fromStore(
                        highlight.startMeta,
                        highlight.endMeta,
                        highlight.id,
                        highlight.text
                    );
                } catch (error) {
                    console.warn('Failed to load highlight:', error);
                }
            });
            lastStorageUpdate = now;
        });
    }
    setTimeout(loadStoredHighlights, 3000);
}

// Handle highlight creation
function handleHighlight(text, color) {
    if (!text) {
        return;
    }

    // Get the current selection
    const selection = window.getSelection();

    if (selection.rangeCount === 0) {
        return;
    }

    const range = selection.getRangeAt(0);

    // Create highlight at the selected range
    try {
        const result = highlighter.fromRange(range);
    } catch (error) {
        console.error('Error creating highlight:', error);
    }
}

// Clear all highlights
async function clearAllHighlights() {
    highlighter.removeAll();

    const url = window.location.href;

    if (await isUserLoggedIn()) {
        // Clear from Firebase if user is logged in
        const companyEmail = await getMainCompanyEmail();
        if (!companyEmail) {
            console.error('No company email found');
            return;
        }

        chrome.runtime.sendMessage({
            action: "saveFirebaseData",
            path: `Companies/${companyEmail}/highlights/${url}`,
            data: null
        }, (response) => {
            if (!response?.success) {
                console.error('Failed to clear highlights from Firebase:', response?.error);
            }
        });
    } else {
        // Clear from chrome.storage if not logged in
        chrome.storage.sync.get({ highlights: {} }, (data) => {
            const highlights = data.highlights;
            if (highlights[url]) {
                delete highlights[url];
                chrome.storage.sync.set({ highlights });
            }
        });
    }
}

// Clear specific highlight
async function clearHighlight(url, text) {
    // Find and remove the specific highlight from DOM
    const highlights = highlighter.getDoms();
    highlights.forEach(h => {
        if (h.textContent === text) {
            highlighter.remove(h.dataset.highlightId);
        }
    });

    if (await isUserLoggedIn()) {
        // Clear from Firebase if user is logged in
        const companyEmail = await getMainCompanyEmail();
        if (!companyEmail) {
            console.error('No company email found');
            return;
        }

        chrome.runtime.sendMessage({
            action: "getFirebaseData",
            path: `Companies/${companyEmail}/highlights/${url}`
        }, (response) => {
            if (response?.success && response?.data) {
                const highlights = response.data.filter(h => h.text !== text);

                chrome.runtime.sendMessage({
                    action: "saveFirebaseData",
                    path: `Companies/${companyEmail}/highlights/${url}`,
                    data: highlights
                }, (saveResponse) => {
                    if (!saveResponse?.success) {
                        console.error('Failed to update highlights in Firebase:', saveResponse?.error);
                    }
                });
            }
        });
    } else {
        // Clear from chrome.storage if not logged in
        chrome.storage.sync.get({ highlights: {} }, (data) => {
            if (data.highlights[url]) {
                data.highlights[url] = data.highlights[url].filter(h => h.text !== text);
                chrome.storage.sync.set({ highlights: data.highlights });
            }
        });
    }
}

// Set current URL for other extension features
function setCurrentURL(selectedText, url) {
    chrome.storage.sync.remove('currentHighlight', () => {
        const currentHighlight = { selectedText, url };
        chrome.storage.sync.set({ currentHighlight });
    });
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received in content.js:', request);

    switch (request.action) {
        case 'highlight':
            console.log('highlight', request);
            canSave = true;
            handleHighlight(request.text, request.color);
            break;

        // case 'getHighlights':
        //     const highlights = highlighter.getDoms().map(dom => ({
        //         text: dom.textContent,
        //         id: dom.dataset.highlightId
        //     }));
        //     sendResponse({ highlights });
        //     return true;

        // case 'clearHighlights':
        //     clearAllHighlights();
        //     break;

        // case 'clearSpecificHighlight':
        //     clearHighlight(request.url, request.text);
        //     sendResponse({ status: "Highlight cleared", receivedText: request.text });
        //     break;

        // default:
        //     console.log('Invalid action:', request.action);
    }
});

var canSave = false;
// Listen for highlight creation
highlighter.on(Highlighter.event.CREATE, ({ sources }) => {
    if (canSave) {
        canSave = false;
        saveHighlight(sources);
    }
});

// Load stored highlights when the page loads
// document.addEventListener('DOMContentLoaded', () => {
setTimeout(loadStoredHighlights, 500);
// });

// Clean up empty highlight elements
function cleanupEmptyHighlights() {
    const emptyHighlights = document.querySelectorAll('[data-highlight-id]:empty');
    emptyHighlights.forEach(el => el.remove());
}

// observer.observe(document.body, { 
//     childList: true, 
//     subtree: true,
//     characterData: true // Add this to catch text changes
// });

async function isUserLoggedIn() {
    try {
        const result = await chrome.storage.local.get('authInfo');
        return !!(result);
    } catch (error) {
        console.error('Error checking login status:', error);
        return false;
    }
}

async function getMainCompanyEmail() {
    try {
        const email = await getUserEmail();
        if (!email) return null;

        console.log("emailToCompanyDirectory/" + email.replace(".", ","));
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: "getFirebaseData",
                path: `emailToCompanyDirectory/${email.replace(".", ",")}`
            }, (response) => {
                if (response && response.success) {
                    resolve(response.data);
                } else {
                    console.error('Error getting company email:', response?.error || 'Unknown error');
                    resolve(null); // Resolve with null instead of rejecting to prevent errors
                }
            });
        });
    } catch (error) {
        console.error('Error getting company email:', error);
        return null;
    }
}

async function getUserEmail() {
    try {
        const result = await chrome.storage.local.get('authInfo');
        if (result.authInfo && result.authInfo.email) {
            return result.authInfo.email.replace('.', ',');
        }
        return null;
    } catch (error) {
        console.error('Error getting user email:', error);
        return null;
    }
}