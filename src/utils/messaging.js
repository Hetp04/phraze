// import { saveFirebaseData, getFirebaseData } from "../../extension/funcs.js"

// var currentUserEmail = "";
// export function setMessagingUserEmail(email) {
//     currentUserEmail = email.replace(".", ",")
// }

// function getUserEmail() {
//     return currentUserEmail;
// }

// var currentUserName = "";
// export function setMessagingUserName(username) {
//     currentUserName = username;
// }

// function getUserName() {
//     return currentUserName;
// }

// async function getMainCompanyEmail() {
//     return await getFirebaseData(`emailToCompanyDirectory/${getUserEmail()}`);
// }

// var currentProject = "";
// export function setMessagingCurrentProject(p) {
//     currentProject = p;
// }

// function getCurrentProject() {
//     return currentProject;
// }


// let firebase_ref = null;
// let firebase_onValue = null;
// let firebase_off = null;
// let firebase_database = null;
// let listenerRef = null;
// export function setFirebaseFunctions(ref, onValue, off, database) {
//     firebase_ref = ref;
//     firebase_onValue = onValue;
//     firebase_off = off;
//     firebase_database = database;
// }

// const handleValueChange = (snapshot) => {
//     var emailPair = getEmailPair(currentlyChattingWith);
//     if (snapshot.key != emailPair) return;

//     // loadMessages();
//     var list = document.getElementById("messages-list");
//     list.innerHTML = "";
//     var userEmail = getUserEmail();
//     let messages = snapshot.val() ? Object.values(snapshot.val()) : [];
//     for (var message of messages) {
//         list.appendChild(createMessageElement(message, userEmail));
//     }
//     // Find the new comment and scroll to it
//     if (list && list.lastChild) {
//         list.lastChild.scrollIntoView(false);
//     }

//     if (messages.length == 0)
//         list.innerHTML = "<span class='messaging-header'>No messages found</span>";

//     previousMessagesHTML = list.innerHTML;
// };

// function setFirebaseListener(path) {
//     listenerRef = firebase_ref(firebase_database, path);
//     firebase_onValue(listenerRef, handleValueChange);
// }

// function removeFirebaseListener(path) {
//     if (listenerRef) {
//         firebase_off(listenerRef, 'value', handleValueChange);
//     }
// }

// async function setCurrentTopic(topic) {
//     currentTopic = topic;
//     var currentProject = await getCurrentProject();
//     var ele = document.getElementById("messaging-header-right");
//     if (!ele)
//         return;
//     var headerText = "Current Topic: ";
//     if (topic == "general") {
//         ele.innerHTML = `${headerText}<b>General</b>`;
//     }
//     else {
//         var companyEmail = await getMainCompanyEmail();
//         var currentProject = await getCurrentProject();
//         var title = await getFirebaseData(`Companies/${companyEmail}/projects/${currentProject}/${currentTopic.replace("-", "/")}/title`);
//         ele.innerHTML = `${headerText}<b>${title}</b>`;
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

// function createMessageElement(message, email) {
//     const div = document.createElement('div');
//     div.className = 'comment-item';
//     // Check if this comment is from the current user
//     const isMyMessage = message.email === email;
//     if (isMyMessage) {
//         div.classList.add('my-comment');
//     }

//     const text = message.text;

//     div.innerHTML = `
//         <div class="comment-header">
//             <span class="comment-author">${isMyMessage ? 'You' : message.name}</span>
//             <span class="comment-time">${formatTime(new Date(message.timestamp))}</span>
//         </div>
//         <div class="comment-text">${text}</div>
//     `;

//     return div;
// }

// function getEmailPair(otherEmail) {
//     otherEmail = otherEmail.replace(".", ",");
//     var userEmail = getUserEmail();
//     var emailPair = "";
//     if (otherEmail == "everyone")
//         emailPair = "everyone";
//     else {
//         if (userEmail < otherEmail)
//             emailPair = userEmail + "-" + otherEmail;
//         else
//             emailPair = otherEmail + "-" + userEmail;
//     }
//     return emailPair;
// }

// async function postNewMessage(text) {
//     try {
//         if (currentlyChattingWith == "")
//             return;

//         var companyEmail = await getMainCompanyEmail();
//         var userEmail = await getUserEmail();
//         var userName = await getUserName();
//         const message = {
//             text: text,
//             email: userEmail,
//             name: userName,
//             timestamp: new Date().toISOString()
//         };

//         // Save to Firebase through background script
//         var companyEmail = await getMainCompanyEmail();
//         var currentProject = await getCurrentProject();
//         var emailPair = await getEmailPair(currentlyChattingWith);
//         await saveFirebaseData(`Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}/${Date.now()}`, message);
//         await loadMessages();

//     } catch (error) {
//         console.error('Error posting message:', error);
//         alert('Failed to post message. Please try again.');
//     }
// }

// var currentMessagesPath = "";
// export async function loadMessages() {
//     if (currentlyChattingWith == "")
//         return;
//     if (currentTopic == "")
//         return;

//     var companyEmail = await getMainCompanyEmail();
//     var currentProject = await getCurrentProject();
//     var emailPair = await getEmailPair(currentlyChattingWith);
//     var newPath = `Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`;
//     let list = document.getElementById("messages-list");
//     if (newPath == currentMessagesPath) {
//         list.innerHTML = previousMessagesHTML; //Need to do this to get quick responsive messages, otherwise messages from another chat will appear for a half second in the newly opened chat
//     }
//     else {
//         if (currentMessagesPath != "")
//             removeFirebaseListener(currentMessagesPath);

//         currentMessagesPath = newPath;

//         setFirebaseListener(currentMessagesPath);
//     }

//     document.getElementById("contact-img").src = currentImg;
//     document.getElementById("contact-img-name").innerHTML = currentName;
// }

// var currentlyChattingWith = "";
// var currentImg = "";
// var currentName = "";
// var previousMessagesHTML = "";
// async function openChatWith(email, img, name) {
//     let list = document.getElementById("messages-list");
//     list.innerHTML = "";
//     currentlyChattingWith = email.replace(".", ",");
//     currentImg = img;
//     currentName = name.replace(",", ".");
//     document.getElementById("contacts-panel-chooser").style.display = "none";
//     document.getElementById("contacts-panel-messages").style.display = "flex";
//     await loadMessages();
// }

// // Render a contact button
// function createContactButton(name, email, profileImage, message) {
//     const btn = document.createElement('button');
//     const imgSrc = profileImage || 'src/images/default-profile.png';
//     const fontfamily = 'font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
//     btn.className = 'contact-btn';
//     btn.innerHTML = `
//         <img src="${imgSrc}" class="contact-avatar" />
//         <table style='background-color: unset; border: unset; width: 100%; ${fontfamily}'>
//             <tr style='height: 40px;'>
//                 <td style='float: left;'><span class="contact-name">${name.replace(",", ".")}</span></td><td class='contact-footer' style='text-align: right;'>${formatTime(new Date(message.timestamp))}</td>
//             </tr>
//             <tr style='height: 40px;'>
//             <td class='contact-footer' style='text-align: left;'>
//             ${message.text}
//             </td>
//             </tr>
//         </table>
//     `;
//     btn.onclick = () => openChatWith(email, imgSrc, name); // Implement this function
//     return btn;
// }

// // Main function to load contacts
// var contactsPanelLoading = false;
// async function loadContactsPanel() {
//     if (contactsPanelLoading)
//         return;
//     contactsPanelLoading = true;
//     const contactsPanel = document.getElementById('contacts-panel');
//     contactsPanel.innerHTML = '';

//     // Add "Everyone" button

//     let companyEmail = await getMainCompanyEmail();
//     let currentProject = await getCurrentProject();
//     let everyoneMessages = await getFirebaseData(`Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/everyone`);
//     if (everyoneMessages && everyoneMessages.length > 0)
//         everyoneMessages = everyoneMessages[0];
//     var message = { timestamp: Date.now(), text: "" };
//     if (everyoneMessages != null) {
//         var userMessages = Object.values(everyoneMessages);
//         var length = userMessages.length;
//         if (length > 0)
//             message = userMessages[length - 1];
//     }
//     contactsPanel.appendChild(createContactButton("Everyone", "everyone", "src/images/default-group.png", message));

//     // Get company email
//     const userEmail1 = await getUserEmail();

//     // Fetch all keys under Companies/companyEmail

//     var usersData = await getFirebaseData(`Companies/${companyEmail}/users`);
//     if (!usersData) {
//         contactsPanel.innerHTML += '<div class="error">Failed to load contacts.</div>';
//         contactsPanelLoading = false;
//         return;
//     }

//     // Loop through keys and find users
//     Object.entries(usersData).forEach(async ([key, value]) => {
//         // Get user info (name, email, profileImage)
//         let userEmail2 = value?.email || key;
//         userEmail2 = userEmail2.replace(".", ",");
//         const userName = value?.name || userEmail2;
//         const profileImage = value?.profileImage;
//         // Don't show yourself
//         if (userEmail1 === userEmail2)
//             return;
//         var message = { timestamp: Date.now(), text: "" };
//         var emailPair = await getEmailPair(userEmail2);
//         let messages = await getFirebaseData(`Companies/${companyEmail}/securedProjects/${currentProject}/messages/${currentTopic}/${emailPair}`);
//         if (messages.length > 0)
//             messages = messages[0];
//         if (messages != null) {
//             var userMessages = Object.values(messages);
//             var length = userMessages.length;
//             if (length > 0)
//                 message = userMessages[length - 1];
//         }
//         contactsPanel.appendChild(
//             createContactButton(userName, userEmail2, profileImage, message)
//         );
//     });

//     contactsPanelLoading = false;
// }

// var currentChatId = null;
// var currentTopic = "";
// setCurrentTopic("general");
// export function initContactsPanel(currentTopic) {
//     loadContactsPanel();
//     const addMessageButton = document.getElementById('add-message');
//     const newMessageInput = document.getElementById('new-message');
//     setCurrentTopic(currentTopic);

//     newMessageInput.addEventListener('input', function () {
//         // Reset height to auto to get the correct scrollHeight
//         this.style.height = 'auto';
//         // Set the height to match content (plus a little extra padding)
//         this.style.height = (this.scrollHeight) + 'px';
//     });

//     // Add keyboard event handling for Enter key
//     newMessageInput.addEventListener('keydown', function (e) {
//         // Shift+Enter allows for new line
//         if (e.key === 'Enter' && e.shiftKey) {
//             // Default behavior will insert a new line, no need to do anything
//             return;
//         }
//         // Regular Enter should submit the comment
//         else if (e.key === 'Enter') {
//             e.preventDefault();
//             const text = this.value.trim();
//             if (text) {
//                 postNewMessage(text);
//                 this.value = ''; // Clear input after posting
//                 this.style.height = 'auto'; // Reset height
//             }
//         }
//     });

//     // Add event listener for posting new comments
//     addMessageButton?.addEventListener('click', function () {
//         const text = newMessageInput.value.trim();
//         if (text) {
//             postNewMessage(text);
//             newMessageInput.value = ''; // Clear input after posting
//             newMessageInput.style.height = 'auto'; // Reset height
//         }
//     });

//     document.getElementById("messages-back").addEventListener('click', function () {
//         loadContactsPanel();
//         document.getElementById("contacts-panel-chooser").style.display = "block";
//         document.getElementById("contacts-panel-messages").style.display = "none";
//         // showContactList();
//     });


//     window.addEventListener('message', async function (event) {
//         if (event.data.action === "activeChat") {
//             currentChatId = event.data.id;
//             currentProject = event.data.currentProject;
//             setCurrentTopic("groqChats-" + currentChatId);
//             loadContactsPanel();
//             loadMessages();
//             // var iframe = document.getElementById("groq-iframe");
//             // var companyEmail = await getMainCompanyEmail();
//             // iframe.contentWindow.postMessage({ action: "Show Highlights", companyEmail: companyEmail }, "*");
//         }
//     });
// }