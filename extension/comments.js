// // Import any required modules
// import { showFrame, hideAllSubFrames } from './partials/utils.js';
// import { getCurrentProject, getUserEmail, getMainCompanyEmail, isUserLoggedIn2 } from './partials/auth.js';
// import { mainMenu, showToast } from './frames.js';
// import { labelMap, codeMap } from "./globalVariables.js"
// import { generateAIRecommendation, formatAIRecommendationHTML } from './partials/groq-api.js';


// // Display all annotations like annotation history and allow other users to suggest edits (different labels/codes)
// document.addEventListener('DOMContentLoaded', function () {
//     // Get DOM elements
//     const commentsButton = document.getElementById('Comments');
//     const backButton = document.getElementById('Back-comments');
//     const commentsFrame = document.querySelector('.frame:has(#comments-sub-frame)');
//     const mainFrame = document.querySelector('.frame:has(#main-sub-frame)');

//     // New elements
//     const annotationSearch = document.getElementById('annotation-search');
//     const annotationsSort = document.getElementById('annotations-sort');
//     const createAnnotationBtn = document.getElementById('create-annotation-btn');
//     const addImageButton = document.getElementById('add-image');

//     // Create a hidden file input for image uploads
//     const imageFileInput = document.createElement('input');
//     imageFileInput.type = 'file';
//     imageFileInput.accept = 'image/*';
//     imageFileInput.style.display = 'none';
//     imageFileInput.id = 'comment-image-input';
//     document.body.appendChild(imageFileInput);

//     // Add click event listener to Comments button
//     commentsButton.addEventListener('click', async function () {
//         console.log("Comments 1");
//         if(await isUserLoggedIn2()) {
//             console.log("Comments 2");
//             hideAllSubFrames();
//             showFrame("comments-sub-frame-label");
//             showFrame("comments-landing-sub-frame");
//             // if(localStorage.getItem('currentProfile')) {
//             //     showFrame("comments-sub-frame-label");
//             //     showFrame("comments-landing-sub-frame");
//             // }
//             // else{
//             //     showFrame("choose-profile-sub-frame");
//             //     populateProfiles();
//             // }
//             loadAnnotations('newest');
//         }
//         else{
//             showToast("You must be logged in to use comments", 'error')
//         }
//     });

//     // Update back button listener to use mainMenu()
//     backButton?.addEventListener('click', function () {
//         mainMenu();
//         if (window.currentAnnotationId != null) {
//             window.currentAnnotationId = null;
//             document.getElementById("Comments").click();
//         }
//     });

//     // Add new event listeners
//     annotationSearch?.addEventListener('input', debounce(function (e) {
//         filterAnnotations(e.target.value);
//     }, 300));

//     annotationsSort?.addEventListener('change', function () {
//         loadAnnotations(this.value);
//     });

//     createAnnotationBtn?.addEventListener('click', function () {
//         // Implement navigation to annotation creation
//         console.log('Create new annotation');
//     });

//     // Initialize comments functionality
//     initializeComments();

//     // Add event listener for the add-image button
//     addImageButton?.addEventListener('click', function() {
//         imageFileInput.click();
//     });

//     // Add event listener for file selection
//     imageFileInput?.addEventListener('change', async function() {
//         if (this.files && this.files[0]) {
//             try {
//                 const imageFile = this.files[0];
//                 const imageInfo = await uploadImageToFirebase(imageFile);
//                 addImageToComment(imageInfo);
//                 this.value = ''; // Reset the input
//             } catch (error) {
//                 console.error('Error uploading image:', error);
//                 showToast('Failed to upload image. Please try again.', 'error');
//             }
//         }
//     });
// });

// // Function to upload image to Firebase
// async function uploadImageToFirebase(file) {
//     return new Promise((resolve, reject) => {
//         const reader = new FileReader();
//         reader.onload = async function(e) {
//             try {
//                 const imageData = e.target.result;
//                 const projectName = await getCurrentProject();
//                 const companyEmail = await getMainCompanyEmail();
//                 const imageId = `comment_img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
//                 // Prepare image data
//                 const fileData = {
//                     data: imageData,
//                     name: file.name,
//                     type: file.type,
//                     size: file.size,
//                     uploadedAt: new Date().toISOString()
//                 };
                
//                 // Save to Firebase
//                 chrome.runtime.sendMessage({
//                     action: "saveFirebaseData",
//                     path: `Companies/${companyEmail}/projects/${projectName}/commentImages/${window.currentAnnotationId}/${imageId}`,
//                     data: fileData
//                 }, response => {
//                     if (!response || !response.success) {
//                         console.error('Firebase image upload error:', response?.error);
//                         reject(new Error('Failed to upload image to Firebase'));
//                         return;
//                     }
                    
//                     // Return the reference to the image
//                     resolve({
//                         id: imageId,
//                         url: imageData
//                     });
//                 });
//             } catch (error) {
//                 console.error('Error in file reader:', error);
//                 reject(error);
//             }
//         };
//         reader.onerror = reject;
//         reader.readAsDataURL(file);
//     });
// }

// // Function to add image to comment input
// function addImageToComment(imageInfo) {
//     const newCommentInput = document.getElementById('new-comment');
//     if (!newCommentInput) return;
    
//     // If there's already text, add a newline before the image
//     if (newCommentInput.value.trim() !== '') {
//         newCommentInput.value += '\n';
//     }
    
//     // Add the image marker with its ID to the comment text
//     // This will be parsed when displaying the comment
//     newCommentInput.value += `[IMAGE:${imageInfo.id}]`;
    
//     // Store the image URL in session storage for immediate display
//     sessionStorage.setItem(`image_${imageInfo.id}`, imageInfo.url);
    
//     // Trigger the input event to resize the textarea
//     newCommentInput.dispatchEvent(new Event('input'));
    
//     // Focus the textarea again
//     newCommentInput.focus();
// }

// function initializeComments() {
//     const commentsList = document.getElementById('comments-list');
//     const addCommentButton = document.getElementById('add-comment');
//     const newCommentInput = document.getElementById('new-comment');
//     const commentsSort = document.getElementById('comments-sort');
//     const aiButton = document.getElementById('ai-suggest');

//     // Auto-resize functionality for textarea
//     if (newCommentInput) {
//         newCommentInput.addEventListener('input', function() {
//             // Reset height to auto to get the correct scrollHeight
//             this.style.height = 'auto';
//             // Set the height to match content (plus a little extra padding)
//             this.style.height = (this.scrollHeight) + 'px';
//         });

//         // Add keyboard event handling for Enter key
//         newCommentInput.addEventListener('keydown', function(e) {
//             // Shift+Enter allows for new line
//             if (e.key === 'Enter' && e.shiftKey) {
//                 // Default behavior will insert a new line, no need to do anything
//                 return;
//             }
//             // Regular Enter should submit the comment
//             else if (e.key === 'Enter') {
//                 e.preventDefault();
//                 const commentText = this.value.trim();
//                 if (commentText) {
//                     postNewComment(commentText);
//                     this.value = ''; // Clear input after posting
//                     this.style.height = 'auto'; // Reset height
                    
//                     // Hide AI recommendation panel if visible
//                     const aiRecommendationPanel = document.getElementById('ai-recommendation-panel');
//                     if (aiRecommendationPanel) {
//                         aiRecommendationPanel.style.display = 'none';
//                     }
//                 }
//             }
//         });
//     }

//     // Add event listener for posting new comments
//     addCommentButton?.addEventListener('click', function () {
//         const commentText = newCommentInput.value.trim();
//         if (commentText) {
//             postNewComment(commentText);
//             newCommentInput.value = ''; // Clear input after posting
//             newCommentInput.style.height = 'auto'; // Reset height
            
//             // Hide AI recommendation panel if visible
//             const aiRecommendationPanel = document.getElementById('ai-recommendation-panel');
//             if (aiRecommendationPanel) {
//                 aiRecommendationPanel.style.display = 'none';
//             }
//         }
//     });

//     // Add event listener for AI suggestions
//     aiButton?.addEventListener('click', async function() {
//         // Show loading state
//         aiButton.disabled = true;
//         aiButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
//         try {
//             // Get the current annotation data
//             const annotationData = await getCurrentAnnotationData();
//             if (!annotationData) {
//                 showToast('Could not retrieve annotation data', 'error');
//                 return;
//             }
            
//             // Get previous comments
//             const comments = await getAnnotationComments();
            
//             // Generate AI recommendation
//             const aiResponse = await generateAIRecommendation(annotationData, comments);
            
//             if (aiResponse.success) {
//                 displayAIRecommendation(aiResponse.recommendation);
//             } else {
//                 showToast('Failed to generate AI recommendation: ' + aiResponse.error, 'error');
//             }
//         } catch (error) {
//             console.error('Error generating AI recommendation:', error);
//             showToast('An error occurred while generating AI recommendation', 'error');
//         } finally {
//             // Reset button state
//             aiButton.disabled = false;
//             aiButton.innerHTML = '<i class="fas fa-robot"></i>';
//         }
//     });

//     // Add event listener for sorting comments
//     commentsSort?.addEventListener('change', function () {
//         loadComments(this.value);
//     });

//     // Initial load of comments
//     //loadComments('newest');
// }

// async function postNewComment(text) {
//     try {
//         // Get current user info from storage
//         const authInfo = await chrome.storage.local.get('authInfo');
//         if (!authInfo.authInfo) {
//             alert('Please log in to post comments');
//             return;
//         }
        
//         var userName = await getUserName();
//         const comment = {
//             text: text,
//             userId: authInfo.authInfo.uid,
//             userName: userName,
//             timestamp: new Date().toISOString(),
//             replies: [],
//             isNew: true // Mark as new for animation purposes
//         };

//         // Save to Firebase through background script
//         var projectName = await getCurrentProject();
//         var companyEmail = await getMainCompanyEmail();
//         chrome.runtime.sendMessage({
//             action: "saveFirebaseData",
//             path: `Companies/${companyEmail}/projects/${projectName}/comments/${window.currentAnnotationId}/${Date.now()}`,
//             data: comment
//         }, async response => {
//             if (!response || !response.success) {
//                 console.error('Error saving comment:', response?.error);
//                 alert('Failed to post comment. Please try again.');
//                 return;
//             }

//             // Get current sort order
//             const commentsSort = document.getElementById('comments-sort');
//             const currentSortOrder = commentsSort ? commentsSort.value : 'newest';
            
//             // Reload and resort all comments
//             await loadComments(currentSortOrder);
            
//             // Find the new comment and scroll to it
//             const commentsList = document.getElementById('comments-list');
//             if (commentsList && commentsList.lastChild) {
//                 commentsList.lastChild.scrollIntoView({ behavior: 'smooth' });
//             }
//         });

//     } catch (error) {
//         console.error('Error posting comment:', error);
//         alert('Failed to post comment. Please try again.');
//     }
// }

// async function loadComments(sortBy) {
//     if (await isUserLoggedIn2()) {
//         try {
//             const commentsList = document.getElementById('comments-list');
//             commentsList.innerHTML = ''; // Clear existing comments

//             // Get comments through background script
//             var projectName = await getCurrentProject();
//             var companyEmail = await getMainCompanyEmail();
//             const userName = await getUserName();
//             chrome.runtime.sendMessage({
//                 action: "getFirebaseData",
//                 path: `Companies/${companyEmail}/projects/${projectName}/comments/${window.currentAnnotationId}`
//             }, response => {
//                 if (!response || !response.success) {
//                     console.error('Error loading comments:', response?.error);
//                     // alert('Failed to load comments. Please try again.');
//                     return;
//                 }

//                 const comments = response.data ? Object.values(response.data) : [];

//                 // Sort comments based on selection
//                 switch (sortBy) {
//                     case 'newest':
//                         comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
//                         break;
//                     case 'oldest':
//                         comments.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
//                         break;
//                 }

//                 // Create and append comment elements
//                 comments.forEach(comment => {
//                     const commentElement = createCommentElement(comment, userName);
//                     commentsList.appendChild(commentElement);
//                 });
//             });

//         } catch (error) {
//             console.error('Error loading comments:', error);
//             // alert('Failed to load comments. Please try again.');
//         }
//     }
// }

// function createCommentElement(comment, userName) {
//     const div = document.createElement('div');
//     div.className = 'comment-item';
//     // Check if this comment is from the current user
//     const isMyComment = comment.userName === userName;
//     if (isMyComment) {
//         div.classList.add('my-comment');
//     }

//     // Parse text for image markers and render them
//     const commentText = processCommentText(comment.text);

//     div.innerHTML = `
//         <div class="comment-header">
//             <span class="comment-author">${isMyComment ? 'You' : comment.userName}</span>
//             <span class="comment-time">${formatTime(new Date(comment.timestamp))}</span>
//         </div>
//         <div class="comment-text">${commentText}</div>
//     `;

//     // For newly posted comments, we want them to animate immediately
//     // without the staggered delay of loaded comments
//     if (comment.isNew) {
//         div.style.animationDelay = '0s';
//     }

//     return div;
// }

// // Process comment text to replace image markers with actual images
// function processCommentText(text) {
//     // First replace newlines with HTML line breaks
//     let processedText = text.replace(/\n/g, '<br>');
    
//     // Look for image markers in the format [IMAGE:imageId]
//     return processedText.replace(/\[IMAGE:([^\]]+)\]/g, (match, imageId) => {
//         // Try to get the image from session storage first
//         const cachedImage = sessionStorage.getItem(`image_${imageId}`);
//         if (cachedImage) {
//             return `<img src="${cachedImage}" class="comment-image" alt="Attached image" onclick="window.open('${cachedImage}', '_blank')">`;
//         }
        
//         // If not in session storage, we need to fetch it from Firebase
//         // For now, show a placeholder and initiate loading
//         setTimeout(() => loadImageForComment(imageId), 0);
//         return `<div class="image-placeholder" data-image-id="${imageId}">
//                   <i class="fas fa-image"></i>
//                   <span>Loading image...</span>
//                 </div>`;
//     });
// }

// // Function to load image from Firebase for display in comments
// async function loadImageForComment(imageId) {
//     try {
//         const projectName = await getCurrentProject();
//         const companyEmail = await getMainCompanyEmail();
        
//         chrome.runtime.sendMessage({
//             action: "getFirebaseData",
//             path: `Companies/${companyEmail}/projects/${projectName}/commentImages/${window.currentAnnotationId}/${imageId}`
//         }, response => {
//             if (!response || !response.success) {
//                 console.error('Error loading image:', response?.error);
//                 // Update placeholder to show error
//                 document.querySelectorAll(`.image-placeholder[data-image-id="${imageId}"]`).forEach(placeholder => {
//                     placeholder.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>Failed to load image</span>';
//                 });
//                 return;
//             }
            
//             if (response.data && response.data.data) {
//                 // Store in session storage for future use
//                 sessionStorage.setItem(`image_${imageId}`, response.data.data);
                
//                 // Replace all placeholders for this image with the actual image
//                 document.querySelectorAll(`.image-placeholder[data-image-id="${imageId}"]`).forEach(placeholder => {
//                     const img = document.createElement('img');
//                     img.src = response.data.data;
//                     img.className = 'comment-image';
//                     img.alt = 'Attached image';
//                     img.onclick = () => window.open(response.data.data, '_blank');
//                     placeholder.parentNode.replaceChild(img, placeholder);
//                 });
//             }
//         });
//     } catch (error) {
//         console.error('Error loading image from Firebase:', error);
//     }
// }

// // Helper function to format time in iMessage style
// function formatTime(date) {
//     const now = new Date();
//     const yesterday = new Date(now);
//     yesterday.setDate(yesterday.getDate() - 1);
    
//     if (date.toDateString() === now.toDateString()) {
//         // Today - show time only
//         return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
//     } else if (date.toDateString() === yesterday.toDateString()) {
//         // Yesterday
//         return 'Yesterday ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
//     } else {
//         // Other days - show date and time
//         return date.toLocaleDateString([], { 
//             month: 'short', 
//             day: 'numeric' 
//         }) + ' ' + date.toLocaleTimeString([], { 
//             hour: 'numeric', 
//             minute: '2-digit'
//         });
//     }
// }

// // Add new functions for handling annotations
// async function loadAnnotations(sortBy) {
//     try {
//         const annotationsList = document.querySelector('.annotations-list');
//         const noAnnotationsMessage = document.querySelector('.no-annotations-message');
//         annotationsList.innerHTML = '';

//         const projectName = await getCurrentProject();
//         var companyEmail = await getMainCompanyEmail();

//         // Get annotations from storage
//         chrome.runtime.sendMessage({
//             action: "getFirebaseData",
//             path: `Companies/${companyEmail}/projects/${projectName}/annotationHistory`
//         }, response => {
//             if (!response || !response.success) {
//                 console.error('Error loading annotations:', response?.error);
//                 showNoAnnotationsMessage();
//                 return;
//             }

//             // Parse the string data into an array
//             const annotations = response.data ? JSON.parse(response.data) : [];

//             if (annotations.length === 0) {
//                 showNoAnnotationsMessage();
//                 return;
//             }

//             // Sort annotations
//             annotations.sort((a, b) => {
//                 const aTimestamp = a.find(item => item.timestamp)?.timestamp;
//                 const bTimestamp = b.find(item => item.timestamp)?.timestamp;

//                 switch (sortBy) {
//                     case 'newest':
//                         return new Date(bTimestamp) - new Date(aTimestamp);
//                     case 'oldest':
//                         return new Date(aTimestamp) - new Date(bTimestamp);
//                     default:
//                         return 0;
//                 }
//             });

//             // Create and append annotation elements
//             annotations.forEach((annotation, index) => {
//                 const element = createAnnotationElement(annotation);
//                 annotationsList.appendChild(element);
//             });

//             noAnnotationsMessage.style.display = 'none';
//             annotationsList.style.display = 'flex';
//         });
//     } catch (error) {
//         console.error('Error loading annotations:', error);
//         showNoAnnotationsMessage();
//     }
// }

// function createAnnotationElement(annotation) {
//     const div = document.createElement('div');
//     div.className = 'annotation-item';
    
//     // Extract relevant information from the annotation array
//     const id = annotation.find(item => item.id)?.id || '';
//     div.dataset.id = id;
//     const userText = annotation.find(item => item.userText)?.userText || '';
//     const key = annotation.find(item => item.key)?.key || '';
//     const type = annotation.find(item => item.type)?.type || '';
//     const options = annotation.find(item => item.options)?.options || [];
//     const url = annotation.find(item => item.url)?.url || '';
//     const timestamp = annotation.find(item => item.timestamp)?.timestamp;

//     div.innerHTML = `
//         <div class="annotation-content">
//             <div class="annotation-header">
//                 <div class="annotation-metadata">
//                     <span class="annotation-tag">${key}</span>
//                     <span class="annotation-tag-separator">•</span>
//                     <span class="annotation-tag-value">${options.join(', ')}</span>
//                 </div>
//                 <span class="annotation-date">${new Date(timestamp).toLocaleDateString()}</span>
//             </div>
//             <div class="selected-text">"${userText}"</div>
//             <div class="annotation-footer">
//                 <div class="annotation-type">${type}</div>
//                 <span class="annotation-url">${url ? new URL(url).hostname : ''}</span>
//             </div>
//         </div>
//     `;

//     div.addEventListener('click', () => navigateToComments(id));
//     return div;
// }

// // Modify the navigateToComments function to store the annotation ID
// function navigateToComments(annotationId) {
//     console.log("Annotation ID ", annotationId);
//     hideAllSubFrames();
//     showFrame("comments-sub-frame-label");
//     showFrame("comments-sub-frame");

//     // Store the current annotation ID globally so we can reference it later
//     window.currentAnnotationId = annotationId;

//     // Get the clicked annotation data
//     const annotationItem = document.querySelector(`.annotation-item[data-id="${annotationId}"]`);
//     const selectedText = annotationItem.querySelector('.selected-text').textContent;
//     const key = annotationItem.querySelector('.annotation-tag').textContent;
//     const value = annotationItem.querySelector('.annotation-tag-value').textContent;
//     const type = annotationItem.querySelector('.annotation-type').textContent;
//     const url = annotationItem.querySelector('.annotation-url').textContent;
//     const date = annotationItem.querySelector('.annotation-date').textContent;

//     // Clear existing content
//     const commentsHeader = document.querySelector('.comments-header');
//     commentsHeader.innerHTML = '';

//     // Create and append annotation details
//     const annotationDetails = document.createElement('div');
//     annotationDetails.className = 'annotation-details';
//     annotationDetails.innerHTML = `
//         <div class="annotation-details-text">${selectedText}</div>
//         <div class="annotation-details-metadata">
//             <div class="details-left">
//                 <span class="details-tag">${key}</span>
//                 <span class="details-separator">•</span>
//                 <span class="details-value">${value}</span>
//                 <span class="details-type">${type}</span>
//             </div>
//             <div class="details-right">
//                 <span class="details-url">${url}</span>
//                 <span class="details-separator">•</span>
//                 <span class="details-date">${date}</span>
//             </div>
//         </div>
//     `;
//     commentsHeader.appendChild(annotationDetails);

//     const searchSection = document.createElement("div");
//     searchSection.className = 'search-section';
//     searchSection.innerHTML = '<input type="text" id="comment-label-search" placeholder="Search for and add a label, code, etc.">';
//     commentsHeader.appendChild(searchSection);

//     // Add comments section header
//     const commentsSection = document.createElement('div');
//     commentsSection.className = 'comments-section';
//     commentsSection.innerHTML = `
//         <div class="comments-controls">
//             <h3>Comments</h3>
//             <div class="comments-filter">
//                 <select id="comments-sort" class="form-select">
//                     <option value="newest">Newest First</option>
//                     <option value="oldest">Oldest First</option>
//                 </select>
//             </div>
//         </div>
//     `;
//     commentsHeader.appendChild(commentsSection);

//     // Add the comments list and input area
//     const commentsContainer = document.createElement('div');
//     commentsContainer.className = 'comments-container';
//     commentsContainer.innerHTML = `
//         <div id="comments-list" class="comments-list">
//             <!-- Comments will be dynamically populated here -->
//         </div>
//         <div class="add-comment-section">
//             <div class="comment-input-container">
//                 <div class="comment-input-wrapper">
//                     <button id="add-image" class="image-button">
//                         <i class="fas fa-camera"></i>
//                     </button>
//                     <button id="ai-suggest" class="ai-button" title="Get AI suggestions">
//                         <i class="fas fa-robot"></i>
//                     </button>
//                     <textarea id="new-comment" placeholder="Write a comment... (Shift+Enter for new line)" class="comment-input" rows="1"></textarea>
//                     <button id="add-comment" class="comment-button primary">
//                         <i class="fas fa-arrow-up"></i>
//                     </button>
//                 </div>
//             </div>
//         </div>
//     `;
//     // commentsFrame.querySelector('#comments-sub-frame').appendChild(commentsContainer);

//     loadAnnotationComments('newest', annotationId);
//     initializeComments();
    
//     // Set up the comment label search functionality
//     setupCommentLabelSearch();
// }

// function showNoAnnotationsMessage() {
//     const annotationsList = document.querySelector('.annotations-list');
//     const noAnnotationsMessage = document.querySelector('.no-annotations-message');

//     annotationsList.style.display = 'none';
//     noAnnotationsMessage.style.display = 'block';
// }

// function filterAnnotations(searchTerm) {
//     const items = document.querySelectorAll('.annotation-item');
//     const noAnnotationsMessage = document.querySelector('.no-annotations-message');
//     let hasVisibleItems = false;

//     items.forEach(item => {
//         const text = item.textContent.toLowerCase();
//         const isVisible = text.includes(searchTerm.toLowerCase());
//         item.style.display = isVisible ? 'block' : 'none';
//         if (isVisible) hasVisibleItems = true;
//     });

//     noAnnotationsMessage.style.display = hasVisibleItems ? 'none' : 'block';
// }

// // Utility function for debouncing search input
// function debounce(func, wait) {
//     let timeout;
//     return function executedFunction(...args) {
//         const later = () => {
//             clearTimeout(timeout);
//             func(...args);
//         };
//         clearTimeout(timeout);
//         timeout = setTimeout(later, wait);
//     };
// }

// // Update existing loadComments function to accept annotationId
// async function loadAnnotationComments(sortBy, annotationId) {
//     try {
//         const commentsList = document.getElementById('comments-list');
//         commentsList.innerHTML = ''; // Clear existing comments

//         // Get comments through background script
//         var projectName = await getCurrentProject();
//         var userName = await getUserName();
//         var companyEmail = await getMainCompanyEmail();
//         chrome.runtime.sendMessage({
//             action: "getFirebaseData",
//             path: `Companies/${companyEmail}/projects/${projectName}/comments/${window.currentAnnotationId}`
//         }, response => {
//             if (!response || !response.success) {
//                 console.error('Error loading comments:', response?.error);
//                 // alert('Failed to load comments. Please try again.');
//                 return;
//             }

//             const comments = response.data ? Object.values(response.data) : [];

//             // Sort comments based on selection
//             switch (sortBy) {
//                 case 'newest':
//                     comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
//                     break;
//                 case 'oldest':
//                     comments.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
//                     break;
//             }

//             // Filter comments for specific annotation
//             if (annotationId) {
//                 // Filter logic here
//             }

//             // Create and append comment elements
//             comments.forEach(comment => {
//                 const commentElement = createCommentElement(comment, userName);
//                 commentsList.appendChild(commentElement);
//             });
//         });

//     } catch (error) {
//         console.error('Error loading comments:', error);
//         // alert('Failed to load comments. Please try again.');
//     }
// }

// // async function populateProfiles() {
// //     const userEmail = await getUserEmail();
// //     const profileList = document.getElementById('profiles-list');
// //     chrome.runtime.sendMessage({
// //         action: "getFirebaseData",
// //         path: `Users/${userEmail}/profiles`
// //     }, function (response) {
// //         if (response.success) {
// //             const profilesArray = Object.values(response.data);
// //             profileList.innerHTML = '';
// //             profilesArray.forEach(profile => {
// //                 const profileItem = document.createElement('button');
// //                 profileItem.textContent = profile.name;
// //                 profileItem.addEventListener('click', () => {
// //                     localStorage.setItem('currentProfile', JSON.stringify(profile));
// //                     hideAllSubFrames();
// //                     showFrame("comments-sub-frame-label");
// //                     showFrame("comments-landing-sub-frame");
// //                     // showFrame("main-sub-frame");
// //                     // showFrame("main-sub-frame-nav"); // profile dropdown
// //                 });
// //                 profileList.appendChild(profileItem);
// //             });
// //         }
// //         else {
// //             profileList.innerHTML = '<p>No profiles found</p>';
// //         }
// //     })
// // }


// // document.addEventListener('DOMContentLoaded', async () => {
// //     const createProfileBtn = document.getElementById('create-profile-btn');
// //     const changeProfileBtn = document.getElementById('change-profile-btn');
// //     const newProfileName = document.getElementById('new-profile-name');
// //     const newProfileRole = document.getElementById('new-profile-role');
// //     const newProfileInputGroup = document.getElementById('new-profile-input-group');
// //     const userEmail = await getUserEmail();

// //     createProfileBtn.addEventListener("click", () => {
// //         if (newProfileName.value == '') {
// //             newProfileInputGroup.style.display = 'block';
// //         }
// //         else {
// //             var data = {
// //                 name: newProfileName.value,
// //                 role: newProfileRole.value
// //             }
// //             chrome.runtime.sendMessage({
// //                 action: "saveFirebaseData",
// //                 path: `Users/${userEmail}/profiles/${newProfileName.value}`,
// //                 data: data
// //             });
// //             localStorage.setItem('currentProfile', JSON.stringify(data));
// //             hideAllSubFrames();
// //             showFrame("comments-sub-frame-label");
// //             showFrame("comments-landing-sub-frame");
// //             // showFrame("main-sub-frame");
// //             // showFrame("main-sub-frame-nav"); // profile dropdown
// //         }
// //     });

// //     changeProfileBtn.addEventListener("click", () => {
// //         localStorage.removeItem('currentProfile');
// //         hideAllSubFrames();
// //         showFrame("choose-profile-sub-frame");
// //         populateProfiles();
// //     });
// // });

// // Get username from Firebase database
// export async function getUserName() {
//     try {
//         // Get user email and company email
//         const userEmail = await getUserEmail();
//         const companyEmail = await getMainCompanyEmail();
        
//         if (!userEmail || !companyEmail) return null;

//         // Get username from Firebase
//         return new Promise((resolve, reject) => {
//             chrome.runtime.sendMessage({
//                 action: "getFirebaseData",
//                 path: `Companies/${companyEmail}/users/${userEmail}/name`
//             }, (response) => {
//                 if (response && response.success) {
//                     resolve(response.data);
//                 } else {
//                     console.error('Error getting username:', response?.error || 'Unknown error');
//                     resolve(null); // Resolve with null instead of rejecting
//                 }
//             });
//         });
//     } catch (error) {
//         console.error('Error in getUserName:', error);
//         return null;
//     }
// }

// // Display search results based on input
// function displaySearchResults(searchTerm, resultsContainer) {
//     // Clear previous results
//     resultsContainer.innerHTML = '';
    
//     if (!searchTerm) {
//         resultsContainer.style.display = 'none';
//         return;
//     }

//     const matches = findMatches(searchTerm);
    
//     if (matches.length === 0) {
//         resultsContainer.style.display = 'none';
//         return;
//     }

//     // Create and append result items
//     matches.forEach(match => {
//         const resultItem = document.createElement('div');
//         resultItem.className = 'search-result-item';
//         resultItem.style.cursor = 'pointer'; // Add pointer cursor
        
//         // Display category and value
//         resultItem.innerHTML = `
//             <div class="result-category">${match.category}</div>
//             <div class="result-value">${match.value}</div>
//             <div class="result-type">${match.type}</div>
//         `;
        
//         // Add click handler
//         resultItem.addEventListener('click', async () => {
//             // Instead of creating a new annotation, update the existing one
//             await updateAnnotationWithLabel(
//                 window.currentAnnotationId, 
//                 match.category, 
//                 match.type.toLowerCase(), 
//                 match.value
//             );
            
//             // Show confirmation toast
//             showToast(`Added ${match.type}: ${match.category} • ${match.value}`, 'success');
            
//             // Clear and hide results
//             resultsContainer.innerHTML = '';
//             resultsContainer.style.display = 'none';
            
//             // Clear the search input
//             document.getElementById('comment-label-search').value = '';
//         });
        
//         resultsContainer.appendChild(resultItem);
//     });
    
//     resultsContainer.style.display = 'block';
// }

// // Find matches in labelMap and codeMap
// function findMatches(searchTerm) {
//     const matches = [];
    
//     // Search in labelMap
//     Object.entries(labelMap).forEach(([category, values]) => {
//         // Match category
//         if (category.toLowerCase().includes(searchTerm)) {
//             values.forEach(value => {
//                 matches.push({
//                     type: 'Label',
//                     category,
//                     value
//                 });
//             });
//         } else {
//             // Match values
//             values.forEach(value => {
//                 if (value.toLowerCase().includes(searchTerm)) {
//                     matches.push({
//                         type: 'Label',
//                         category,
//                         value
//                     });
//                 }
//             });
//         }
//     });
    
//     // Search in codeMap
//     Object.entries(codeMap).forEach(([category, values]) => {
//         // Match category
//         if (category.toLowerCase().includes(searchTerm)) {
//             values.forEach(value => {
//                 matches.push({
//                     type: 'Code',
//                     category,
//                     value
//                 });
//             });
//         } else {
//             // Match values
//             values.forEach(value => {
//                 if (value.toLowerCase().includes(searchTerm)) {
//                     matches.push({
//                         type: 'Code',
//                         category,
//                         value
//                     });
//                 }
//             });
//         }
//     });
    
//     return matches;
// }

// // Add search result functionality for comment label search
// function setupCommentLabelSearch() {
//     const searchInput = document.getElementById('comment-label-search');
//     if (!searchInput) return;

//     // Create results container if it doesn't exist
//     let resultsContainer = document.getElementById('label-search-results');
//     if (!resultsContainer) {
//         resultsContainer = document.createElement('div');
//         resultsContainer.id = 'label-search-results';
//         resultsContainer.className = 'search-results-container';
//         // Add some basic styles for the search results container
//         resultsContainer.style.position = 'absolute';
//         resultsContainer.style.zIndex = '1000';
//         resultsContainer.style.backgroundColor = '#fff';
//         resultsContainer.style.border = '1px solid #ddd';
//         resultsContainer.style.borderRadius = '4px';
//         resultsContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
//         resultsContainer.style.maxHeight = '300px';
//         resultsContainer.style.overflowY = 'auto';
//         resultsContainer.style.width = '100%';
//         searchInput.parentNode.appendChild(resultsContainer);
//     }

//     // Add event listener for input changes
//     searchInput.addEventListener('input', debounce(function() {
//         const searchTerm = searchInput.value.trim().toLowerCase();
//         displaySearchResults(searchTerm, resultsContainer);
//     }, 300));

//     // Close results when clicking outside
//     document.addEventListener('click', function(e) {
//         if (e.target !== searchInput && !resultsContainer.contains(e.target)) {
//             resultsContainer.innerHTML = '';
//             resultsContainer.style.display = 'none';
//         }
//     });
// }

// // Add some CSS to style the search results items
// document.addEventListener('DOMContentLoaded', function() {
//     const style = document.createElement('style');
//     style.textContent = `
//         .search-results-container {
//             display: none;
//         }
//         .search-result-item {
//             padding: 10px;
//             border-bottom: 1px solid #eee;
//             display: flex;
//             justify-content: space-between;
//             align-items: center;
//         }
//         .search-result-item:hover {
//             background-color: #f5f5f5;
//         }
//         .result-category {
//             font-weight: bold;
//         }
//         .result-value {
//             color: #666;
//         }
//         .result-type {
//             background-color: #e0e0e0;
//             padding: 2px 6px;
//             border-radius: 4px;
//             font-size: 0.8em;
//         }
//     `;
//     document.head.appendChild(style);
// });

// // Export functions if needed
// export { initializeComments, postNewComment, loadComments, loadAnnotations };

// // New function to update an existing annotation with a new label or code
// async function updateAnnotationWithLabel(annotationId, category, type, value) {
//     try {
//         const projectName = await getCurrentProject();
//         const companyEmail = await getMainCompanyEmail();
        
//         // Get the current annotations from storage
//         const annotations = await new Promise((resolve) => {
//             chrome.runtime.sendMessage({
//                 action: "getFirebaseData",
//                 path: `Companies/${companyEmail}/projects/${projectName}/annotationHistory`
//             }, response => {
//                 if (response && response.success && response.data) {
//                     resolve(JSON.parse(response.data));
//                 } else {
//                     resolve([]);
//                 }
//             });
//         });
        
//         // Find the annotation by ID instead of by index
//         const annotationIndex = annotations.findIndex(ann => {
//             const idObj = ann.find(item => item.id);
//             return idObj && idObj.id === annotationId;
//         });
        
//         if (annotationIndex === -1) {
//             console.error(`Annotation with ID ${annotationId} not found`);
//             showToast('Annotation not found', 'error');
//             return;
//         }
        
//         const annotation = annotations[annotationIndex];
        
//         // Find the existing key and options objects in the annotation
//         const keyIndex = annotation.findIndex(item => item.key === category);
//         const typeIndex = annotation.findIndex(item => item.type === type);
//         const optionsIndex = annotation.findIndex(item => item.options);
        
//         if (keyIndex !== -1 && typeIndex !== -1 && optionsIndex !== -1) {
//             // If the same key and type already exist, add the new value to options if not already there
//             if (!annotation[optionsIndex].options.includes(value)) {
//                 annotation[optionsIndex].options.push(value);
//             }
//         } else {
//             // If this is a new key/type, we need to add the new objects
//             if (keyIndex === -1) {
//                 // Add the key object
//                 annotation.push({
//                     key: category
//                 });
//             }
            
//             if (typeIndex === -1) {
//                 // Add the type object
//                 annotation.push({
//                     type: type
//                 });
//             }
            
//             if (optionsIndex === -1) {
//                 // Add options object
//                 annotation.push({
//                     options: [value]
//                 });
//             } else {
//                 // If options exist but not for this key/type, we need to replace them
//                 // This is a simplification - in a real implementation you would need
//                 // to be more careful about updating the right options for the right key/type
//                 annotation[optionsIndex].options.push(value);
//             }
//         }
        
//         // Save the updated annotations back to storage
//         await new Promise((resolve) => {
//             chrome.runtime.sendMessage({
//                 action: "saveFirebaseData",
//                 path: `Companies/${companyEmail}/projects/${projectName}/annotationHistory`,
//                 data: JSON.stringify(annotations)
//             }, response => {
//                 resolve(response);
//             });
//         });
        
//         // Update the UI to reflect changes
//         const annotationItem = document.querySelector(`.annotation-item[data-id="${annotationId}"]`);
//         if (annotationItem) {
//             // If we're on the annotations list page, update the display
//             const tagElement = annotationItem.querySelector('.annotation-tag');
//             const tagValueElement = annotationItem.querySelector('.annotation-tag-value');
//             const typeElement = annotationItem.querySelector('.annotation-type');
            
//             if (tagElement && tagValueElement && typeElement) {
//                 // Only update if this is the main label/code type
//                 if (type === typeElement.textContent.toLowerCase()) {
//                     if (tagElement.textContent === category) {
//                         // If the category matches, update the values
//                         const options = annotation.find(item => item.options)?.options || [];
//                         tagValueElement.textContent = options.join(', ');
//                     }
//                 }
//             }
//         }
        
//         // Update the details in the comments view if we're there
//         const detailsTag = document.querySelector('.details-tag');
//         const detailsValue = document.querySelector('.details-value');
//         const detailsType = document.querySelector('.details-type');
        
//         if (detailsTag && detailsValue && detailsType) {
//             if (detailsTag.textContent === category && 
//                 detailsType.textContent.toLowerCase() === type) {
//                 // Update the displayed values
//                 const options = annotation.find(item => item.options)?.options || [];
//                 detailsValue.textContent = options.join(', ');
//             }
//         }
        
//         // Trigger an annotation updated event
//         document.dispatchEvent(new Event('annotationUpdated'));
        
//         return true;
//     } catch (error) {
//         console.error('Error updating annotation:', error);
//         showToast('Failed to update annotation', 'error');
//         return false;
//     }
// }

// // Function to get the current annotation data
// async function getCurrentAnnotationData() {
//     if (!window.currentAnnotationId) {
//         console.error('No current annotation ID');
//         return null;
//     }
    
//     try {
//         const projectName = await getCurrentProject();
//         const companyEmail = await getMainCompanyEmail();
        
//         return new Promise((resolve, reject) => {
//             chrome.runtime.sendMessage({
//                 action: "getFirebaseData",
//                 path: `Companies/${companyEmail}/projects/${projectName}/annotationHistory`
//             }, response => {
//                 if (response && response.success && response.data) {
//                     try {
//                         const annotations = JSON.parse(response.data);
//                         // Find the annotation with the matching ID
//                         const annotation = annotations.find(anno => {
//                             const idObj = anno.find(item => item.id);
//                             return idObj && idObj.id === window.currentAnnotationId;
//                         });
                        
//                         if (annotation) {
//                             resolve(annotation);
//                         } else {
//                             console.error('Annotation not found with ID:', window.currentAnnotationId);
//                             resolve(null);
//                         }
//                     } catch (error) {
//                         console.error('Error parsing annotation data:', error);
//                         reject(error);
//                     }
//                 } else {
//                     console.error('Error fetching annotation data:', response?.error);
//                     reject(new Error('Failed to fetch annotation data'));
//                 }
//             });
//         });
//     } catch (error) {
//         console.error('Error in getCurrentAnnotationData:', error);
//         return null;
//     }
// }

// // Function to get comments for the current annotation
// async function getAnnotationComments() {
//     if (!window.currentAnnotationId) {
//         return [];
//     }
    
//     try {
//         const projectName = await getCurrentProject();
//         const companyEmail = await getMainCompanyEmail();
        
//         return new Promise((resolve, reject) => {
//             chrome.runtime.sendMessage({
//                 action: "getFirebaseData",
//                 path: `Companies/${companyEmail}/projects/${projectName}/comments/${window.currentAnnotationId}`
//             }, response => {
//                 if (response && response.success && response.data) {
//                     const comments = Object.values(response.data);
//                     resolve(comments);
//                 } else {
//                     resolve([]);
//                 }
//             });
//         });
//     } catch (error) {
//         console.error('Error fetching comments:', error);
//         return [];
//     }
// }

// // Function to display AI recommendation
// function displayAIRecommendation(recommendation) {
//     // Get or create the AI recommendation panel
//     let aiRecommendationPanel = document.getElementById('ai-recommendation-panel');
    
//     if (!aiRecommendationPanel) {
//         aiRecommendationPanel = document.createElement('div');
//         aiRecommendationPanel.id = 'ai-recommendation-panel';
//         aiRecommendationPanel.className = 'ai-recommendation-panel';
        
//         // Insert it before the comment input container
//         const commentInputContainer = document.querySelector('.comment-input-container');
//         commentInputContainer.parentNode.insertBefore(aiRecommendationPanel, commentInputContainer);
//     }
    
//     // Format the recommendation as HTML
//     const recommendationHTML = formatAIRecommendationHTML(recommendation);
    
//     // Create the content with accept/reject buttons
//     aiRecommendationPanel.innerHTML = `
//         <div class="ai-recommendation-content">
//             <div class="ai-recommendation-header">
//                 <h3><i class="fas fa-robot"></i> AI Suggestion</h3>
//                 <div class="ai-recommendation-actions">
//                     <button id="accept-ai-recommendation" class="ai-action-button accept">
//                         <i class="fas fa-check"></i> Accept
//                     </button>
//                     <button id="reject-ai-recommendation" class="ai-action-button reject">
//                         <i class="fas fa-times"></i> Reject
//                     </button>
//                 </div>
//             </div>
//             <div class="ai-recommendation-body">
//                 ${recommendationHTML}
//             </div>
//         </div>
//     `;
    
//     // Show the panel
//     aiRecommendationPanel.style.display = 'block';
    
//     // Add event listeners for accept/reject buttons
//     document.getElementById('accept-ai-recommendation').addEventListener('click', function() {
//         // Get the recommendation text
//         const recommendationText = document.querySelector('.ai-recommendation-body').innerText;
        
//         // Add to comment input
//         const newCommentInput = document.getElementById('new-comment');
//         newCommentInput.value = recommendationText;
//         newCommentInput.dispatchEvent(new Event('input')); // Trigger resize
        
//         // Hide the panel
//         aiRecommendationPanel.style.display = 'none';
//     });
    
//     document.getElementById('reject-ai-recommendation').addEventListener('click', function() {
//         // Just hide the panel
//         aiRecommendationPanel.style.display = 'none';
//     });
// }
