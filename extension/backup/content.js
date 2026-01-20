
console.warn('-- content.js --');

// Todo ↘ Monitor authentication state
// auth.onAuthStateChanged((user) => {
//     if (user) {
//         console.log('User is signed in:', user);
//     } else {
//         console.log('No user is signed in.');
//     }
// });


// Todo ↘ Highlighter code
/**
 * "run_at": "document_idle"
 * - You want to apply highlights or modify user interactions after the page is completely ready for user interaction
 */
let highlights = {};

chrome.storage.sync.get('highlights', (data) => {
    highlights = data.highlights[window.location.href] || {};
    applyHighlights();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('msg', message);
    if (message.action === "highlight") {
        console.log('highlight clicked!');
        highlightSelection();
    }
});

/**
 * Highlights selected text on a webpage
 * - Stores the highlighted text and its XPath in chrome.storage.sync for persistence.
 * - Highlights are stored in chrome.storage.sync with the URL of the page as the key, allowing for different highlights on different pages.
 */
function highlightSelection() {
    console.warn('--- highlightSelection() ---');
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
        const range = selection.getRangeAt(0);
        const newHighlight = document.createElement('span');
        newHighlight.className = 'extension-highlight';
        newHighlight.textContent = selection.toString();
        range.deleteContents();
        range.insertNode(newHighlight);

        const highlightId = Date.now().toString();
        highlights[highlightId] = {
            text: selection.toString(),
            xpath: getXPath(newHighlight)
        };


        chrome.storage.sync.set({
            highlights: {
                ...highlights,
                [window.location.href]: highlights
            }
        });
    }
}
function getXPath(element) {
    if (element.id !== '')
        return 'id("' + element.id + '")';
    if (element === document.body)
        return element.tagName;

    let ix = 0;
    const siblings = element.parentNode.childNodes;
    for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling === element)
            return getXPath(element.parentNode) + '/' + element.tagName + '[' + (ix + 1) + ']';
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName)
            ix++;
    }
}

/**
 * Re-applies previously stored highlights on the webpage.
 */
function applyHighlights() {
    console.warn('--- applyHighlights() ---');
    Object.values(highlights).forEach(highlight => {
        const range = document.createRange();
        const node = getElementByXPath(highlight.xpath);
        if (node) {
            range.selectNodeContents(node);
            const newHighlight = document.createElement('span');
            newHighlight.className = 'extension-highlight';
            newHighlight.textContent = highlight.text;
            range.deleteContents();
            range.insertNode(newHighlight);
        }
    });
}

/**
 * Finds an element by its XPath.
 */
function getElementByXPath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

// Test code
// JSON data with highlights


