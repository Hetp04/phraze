// Emoji picker initialization for vanilla JS extension
// This file will be loaded as a module

let emojiPickerRoot = null;
let emojiPickerContainer = null;
let outsideClickHandler = null;

export function initEmojiPicker() {
    // Dynamic import of React and emoji-picker-react
    return Promise.all([
        import('react'),
        import('react-dom/client'),
        import('emoji-picker-react')
    ]).then(([React, ReactDOM, EmojiPickerReact]) => {
        const { createRoot } = ReactDOM;
        // Handle different export formats
        const EmojiPicker = EmojiPickerReact.default || EmojiPickerReact.EmojiPicker || EmojiPickerReact;
        
        return {
            React,
            createRoot,
            EmojiPicker
        };
    });
}

export function showEmojiPicker(buttonElement, inputElement, onEmojiClick) {
    // Close existing picker if open
    closeEmojiPicker();
    
    initEmojiPicker().then(({ React, createRoot, EmojiPicker }) => {
        // Create container
        emojiPickerContainer = document.createElement('div');
        emojiPickerContainer.id = 'emoji-picker-container';
        emojiPickerContainer.style.position = 'absolute';
        emojiPickerContainer.style.bottom = '100%';
        emojiPickerContainer.style.left = '0';
        emojiPickerContainer.style.marginBottom = '8px';
        emojiPickerContainer.style.zIndex = '10000';
        
        // Find the input container
        const inputContainer = inputElement.closest('.input-with-send') || 
                               inputElement.closest('.comment-input-container') || 
                               inputElement.parentElement;
        
        if (!inputContainer) {
            console.error('Could not find input container');
            return;
        }
        
        // Make container relatively positioned if not already
        const containerPosition = window.getComputedStyle(inputContainer).position;
        if (containerPosition === 'static') {
            inputContainer.style.position = 'relative';
        }
        
        // Insert container
        inputContainer.appendChild(emojiPickerContainer);
        
        // Create React root and render
        emojiPickerRoot = createRoot(emojiPickerContainer);
        
        emojiPickerRoot.render(
            React.createElement(EmojiPicker, {
                onEmojiClick: (emojiData) => {
                    onEmojiClick(emojiData.emoji);
                    closeEmojiPicker();
                },
                width: 350,
                height: 400,
                previewConfig: {
                    showPreview: false
                },
                skinTonesDisabled: true,
                searchDisabled: false
            })
        );
        
        // Wait a bit for the emoji picker to render, then apply styles
        setTimeout(() => {
            // Add custom CSS to fix search bar styling and hide skin tone picker
            const style = document.createElement('style');
            style.id = 'emoji-picker-custom-styles';
            style.textContent = `
            /* Modern, OpenAI-like search bar design */
            #emoji-picker-container .epr-search-container input,
            #emoji-picker-container input[type="text"],
            #emoji-picker-container .epr-search {
                padding-left: 40px !important;
                padding-right: 12px !important;
                padding-top: 10px !important;
                padding-bottom: 10px !important;
                box-sizing: border-box !important;
                border: none !important;
                outline: none !important;
                border-radius: 8px !important;
                font-size: 14px !important;
                color: #202123 !important;
                width: 100% !important;
                transition: background 0.2s ease !important;
            }
            
            #emoji-picker-container .epr-search-container input:focus,
            #emoji-picker-container input[type="text"]:focus,
            #emoji-picker-container .epr-search:focus {
                background: #ffffff !important;
                box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05) !important;
            }
            
            /* Position search icon properly - moved up more */
            #emoji-picker-container .epr-icn-search,
            #emoji-picker-container div.epr-icn-search,
            #emoji-picker-container div.epr-icn-search.epr_-9drodb,
            #emoji-picker-container .epr-search-container .epr-icn-search,
            #emoji-picker-container .epr-search-container svg,
            #emoji-picker-container .epr-search-container .epr-icn {
                position: absolute !important;
                left: 12px !important;
                right: auto !important;
                top: 18px !important;
                transform: none !important;
                pointer-events: none !important;
                width: 16px !important;
                height: 16px !important;
                color: #8e8ea0 !important;
            }
            
            /* More specific targeting with all possible class combinations */
            #emoji-picker-container div[class*="epr-icn-search"] {
                position: absolute !important;
                left: 12px !important;
                right: auto !important;
                top: 18px !important;
                transform: none !important;
                pointer-events: none !important;
                width: 16px !important;
                height: 16px !important;
                color: #8e8ea0 !important;
            }
            
            /* Ensure search container is positioned relatively */
            #emoji-picker-container .epr-search-container {
                position: relative !important;
                margin-bottom: 8px !important;
            }
            
            /* Hide skin tone picker */
            #emoji-picker-container .epr-skin-tones-list,
            #emoji-picker-container .epr-emoji-category-label:has(+ .epr-skin-tones-list),
            #emoji-picker-container [class*="skin-tone"],
            #emoji-picker-container [class*="skinTone"] {
                display: none !important;
            }
            
            /* Modern placeholder styling */
            #emoji-picker-container .epr-search-container input::placeholder {
                color: #8e8ea0 !important;
                padding-left: 0 !important;
                margin-left: 0 !important;
            }
        `;
            document.head.appendChild(style);
        }, 100);
        
        // Close on outside click
        outsideClickHandler = (event) => {
            if (emojiPickerContainer && !emojiPickerContainer.contains(event.target)) {
                const emojiToggle = event.target.closest('.emoji-toggle-btn, #main-emoji-toggle, #thread-emoji-toggle');
                if (!emojiToggle) {
                    closeEmojiPicker();
                }
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', outsideClickHandler);
        }, 0);
    }).catch(err => {
        console.error('Error showing emoji picker:', err);
    });
}

export function closeEmojiPicker() {
    if (emojiPickerRoot) {
        emojiPickerRoot.unmount();
        emojiPickerRoot = null;
    }
    
    if (emojiPickerContainer) {
        emojiPickerContainer.remove();
        emojiPickerContainer = null;
    }
    
    if (outsideClickHandler) {
        document.removeEventListener('click', outsideClickHandler);
        outsideClickHandler = null;
    }
    
    // Remove custom styles
    const customStyle = document.getElementById('emoji-picker-custom-styles');
    if (customStyle) {
        customStyle.remove();
    }
    
    // Remove active state from emoji buttons
    document.querySelectorAll('.emoji-toggle-btn, #main-emoji-toggle, #thread-emoji-toggle').forEach(btn => {
        btn.classList.remove('active');
    });
}
