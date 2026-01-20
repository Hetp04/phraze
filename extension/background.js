const isOnWebsite = false; //Set to true to disallow any calls to chrome API, which throw errors when the extension is loaded as an iframe on the website

function sendMessageToAllTabs(message) {
    chrome.tabs.query({}, function (tabs) {
        for (let tab of tabs) {
            chrome.tabs.sendMessage(tab.id, message);
        }
    });
}

function sendRuntimeMessage(message, response) {
    chrome.runtime.sendMessage(message, response);
}

try {

    let mainCompanyEmail = null;
    let currentWindow = null;
    /**
     * SETUP Firebase
     */
    self.importScripts(
        'firebase/firebase-app.js',
        'firebase/firebase-auth.js',
        'firebase/firebase-database.js',
        'firebase-init.js'
    );

    const database = self.firebaseDB;

    // Global variable to store the main company email

    // Set up auth state change listener to update mainCompanyEmail
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // chrome.storage.local.set({ authInfo: user });
            // User is signed in
            console.log("Auth state changed: User signed in");
            try {
                const userEmail = user.email.replace(".", ",");
                mainCompanyEmail = await database.ref(`emailToCompanyDirectory/${userEmail}`).once('value').then(snapshot => snapshot.val());
                console.log("Updated mainCompanyEmail on auth state change:", mainCompanyEmail);
            } catch (error) {
                console.error("Error updating mainCompanyEmail on auth state change:", error);
            }
        } else {
            // User is signed out
            // chrome.storage.local.set({ authInfo: false });
            console.log("Auth state changed: User signed out");
            mainCompanyEmail = null;
        }
        //Need to delay this until frames.js is loaded
        setTimeout(function () {
            sendRuntimeMessage({
                action: "saveUser",
                currentUser: user ? {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName
                } : null
            });
        }, 2000);
        console.log("Sending reload highlights message");
        sendMessageToAllTabs({
            action: "reloadHighlights"
        });
    });

    let isPopupOpen = false; // Flag to track popup state

    // Todo ↘ move to another file in the future
    function fetchUserData(userEmail) {

        userEmail = userEmail.replace(".", ",");
        console.warn(`-- fetchUserData(userEmail = ${userEmail}) --`);
        return new Promise(async (resolve, reject) => {
            try {
                if (!mainCompanyEmail) {
                    console.warn("Company email not found for user:", userEmail);
                    // For new users, we'll use their own email as the company email
                    // This is a simplified approach - you might need to adjust based on your app's logic

                    // First check if the user exists in the Users directory
                    const userDirectRef = database.ref(`Users/${userEmail}`);
                    const userSnapshot = await userDirectRef.once('value');

                    if (userSnapshot.exists()) {
                        resolve(userSnapshot.val());
                        return;
                    }

                    // If not found in Users directory, check if they exist in their own company directory
                    const selfCompanyRef = database.ref(`Companies/${mainCompanyEmail}/users/${userEmail}`);
                    const selfSnapshot = await selfCompanyRef.once('value');

                    if (selfSnapshot.exists()) {
                        resolve(selfSnapshot.val());
                        return;
                    }

                    // If not found anywhere, return null
                    console.log("No data available for user:", userEmail);
                    resolve(null);
                    return;
                }

                // Create a reference to the specific user in the Firebase Realtime Database
                const userRef = database.ref(`Companies/${mainCompanyEmail}/users/${userEmail}`);

                // Fetch the data from the database
                const snapshot = await userRef.once('value');

                // Check if data exists for the given userId
                if (snapshot.exists()) {
                    // Resolve the promise with the user data if it exists
                    resolve(snapshot.val());
                } else {
                    // Log a message and resolve with null if no data is found
                    console.log("No data available for user:", userEmail);
                    resolve(null); // Resolve with null if no data is found
                }
            } catch (error) {
                // Log any errors that occur during the data fetch
                console.error("Error fetching data:", error);
                // Reject the promise with the error if an issue occurs
                reject(error); // Reject the promise if an error occurs
            }
        });
    }

    // function saveMultipleUsers(userId, data) {
    //     console.warn(`-- saveMultipleUsers(userId = ${userId}, data = ${data}) --`);
    //     return new Promise((resolve, reject) => {
    //         // Create a reference to the 'Users' node in the Firebase Realtime Database
    //         const userRef = database.ref(`Users`);

    //         // Create an object where userId is the key and data is the value to be updated
    //         const updates = {};
    //         updates[userId] = data;

    //         // Update the database with the new data
    //         userRef.update(updates)
    //             .then(() => {
    //                 // Resolve the promise if the update is successful
    //                 resolve();
    //             })
    //             .catch((error) => {
    //                 // Reject the promise with the error if the update fails
    //                 reject(error);
    //             });
    //     });
    // }

    function saveUserData(userEmail, userData, projectName) {
        console.warn(`-- saveUserData(userEmail = ${userEmail}, projectName = ${projectName}) --`);
        return new Promise(async (resolve, reject) => {
            try {
                if (!mainCompanyEmail) {
                    console.error("Company email not found for user:", userEmail);
                    reject(new Error("Company email not found"));
                    return;
                }

                // Create a reference to the specific user in the Firebase Realtime Database
                const userRef = database.ref(`Companies/${mainCompanyEmail}/projects/${projectName}`);

                // Save the user data to the database
                await userRef.update(userData);

                // Log a success message when data is successfully saved
                console.log("User data successfully saved for:", userEmail);
                resolve(true); // Resolve the promise indicating success
            } catch (error) {
                // Log any errors that occur during the save operation
                console.error("Error saving data:", error);
                reject(error); // Reject the promise if an error occurs
            }
        });
    }

    /** Todo ↘ chrome.runtime.onInstaller
     * - Add an event listener that triggers when the extension is installed
     */
    if (!isOnWebsite)
        chrome.runtime.onInstalled.addListener(() => {
            console.warn(`chrome.runtime.onInstalled.addListener()`);

            // Create parent menu item
            chrome.contextMenus.create({
                id: "addLabel",
                title: "Add New Label",
                contexts: ["selection"],
            });

            // Create submenu item for screenshot
            chrome.contextMenus.create({
                id: "takeScreenshot",
                parentId: "addLabel", // This makes it a submenu of addLabel
                title: "Take Screenshot",
                contexts: ["selection"],
            });
            chrome.contextMenus.create({
                id: "addLabelSubmenu",
                parentId: "addLabel", // This makes it a submenu of addLabel
                title: "Add New Label",
                contexts: ["selection"],
            });


            console.log("Reloading all tabs..., required to get content script running on open tabs");
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach((t) => {
                    // Avoid reloading the special chrome:// pages or extension pages
                    if (t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://')) {
                        try {
                            chrome.tabs.reload(t.id);
                        } catch (error) {
                            console.error(`Error reloading tab ${t.id}:`, error);
                        }
                    }
                });
            });
        });

    // let isPopupOpen = false; // Flag to track popup state

    /** Todo ↘ `chrome.contextMenus.onClicked`
     * - `chrome.contextMenus.create` determined what id is passed to `info` object
     * - When user highlights & right-clicks text
     * - They will see `Add New Label` in the menu
     * - Once clicked this listener will execute
     * - `info` obj will hold :
     *      - title = `Add New Label`
     *      - id = `addLabel`
     */

    if (!isOnWebsite) {
        var globalHighlightID = "none";
        const addLabel = "addLabelSubmenu";
        const takeScreenshot = "takeScreenshot";
        chrome.contextMenus.onClicked.addListener((info, tab) => {
            console.warn('chrome.contextMenus.onClicked.addListener((info)');
            console.warn('info : ', info);

            // Handle the original addLabel functionality
            if (info.menuItemId === addLabel) {
                console.log('info.menuItemId =', info.menuItemId);
                // Highlight the selected text - always execute this
                //  If key highlightColor does not exist, it sets default value 'yellow'.
                globalHighlightID = Date.now();

                chrome.storage.sync.get({ highlightColor: 'yellow' }, (data) => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "highlight",
                        text: info.selectionText,
                        color: data.highlightColor,
                        highlightID: globalHighlightID
                    });
                });

                console.log('globalHighlightID =', globalHighlightID);

                // Check if popup is already open and open it only if it's not
                if (!isPopupOpen) {
                    isPopupOpen = true; // Set popup state to open

                    // Execute a script in the context of the current tab to open the popup
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        // Open the popup
                        function: openPopup,
                        args: [info.selectionText],
                    });

                    // Optionally, reset the flag when the popup is closed
                    chrome.windows.onRemoved.addListener(() => {
                        // Reset popup state when a window is closed
                        isPopupOpen = false;
                    });
                }
                else {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        // Open the popup
                        function: alreadyOpenPopup,
                        args: [info.selectionText],
                    });
                }
            }
            // Handle the new takeScreenshot functionality
            else if (info.menuItemId === takeScreenshot) {
                // Highlight the selected text first
                chrome.storage.sync.get({ highlightColor: 'yellow' }, (data) => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "highlight",
                        text: info.selectionText,
                        color: data.highlightColor
                    });
                });


                // Open the screenshot category selector popup with the selected text as a parameter
                chrome.windows.create({
                    url: chrome.runtime.getURL("screenshot.html") + `?text=${encodeURIComponent(info.selectionText)}`,
                    type: "popup",
                    width: 450,
                    height: 250
                });
            }
        });
    }

    function openPopup(selectedText) {
        console.warn(`-- openPopup(selectedText = ${selectedText}) --`);
        sendRuntimeMessage({
            action: "openPopup",
            text: selectedText
        });
    }
    function alreadyOpenPopup(selectedText) {
        console.warn(`-- alreadyOpenPopup(${selectedText}) --`);
        sendRuntimeMessage({
            action: "alreadyOpenPopup",
            text: selectedText
        });
    }

    async function doesFirebaseKeyExist(key) {
        const dataRef = firebase.database().ref(key);
        return new Promise(async (resolve, reject) => {
            // Set up the listener
            dataRef.on('value', (snapshot) => {
                resolve(snapshot.val() != null);
            }, (error) => {
                console.error("Error checking firebase key", error);
                reject(error);
            });
        });
    }

    if (!isOnWebsite)
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            return handleMessage(message, sender, sendResponse);
        });

    function handleMessage(message, sender, sendResponse) {
        // Todo ↘ chrome.runtime.onMessage -
        console.warn(`chrome.runtime.onMessage.addListener((message, sender, sendResponse)`);
        console.warn('message', message);
        console.warn('sender', sender);
        console.warn('sendResponse', sendResponse);
        if (message.action == "isUserLoggedIn") {
            let result = firebase.auth().currentUser;
            sendResponse({
                success: true,
                result: !!(result)
            });
            return true; // Required for async sendResponse
        }

        if (message.action == "getUserEmail") {
            let result = firebase.auth().currentUser;
            sendResponse({
                success: true,
                result: result.email
            });
            return true;
        }

        // Handle setting up a Firebase data listener
        if (message.action === "listenerFirebaseData") {
            const path = message.path;
            // Get reference to the specified path in Firebase
            const dataRef = firebase.database().ref(path);
            // Remove any existing listener first to avoid duplicates
            dataRef.off('value');
            
            // Set up the listener
            const listenerCallback = (snapshot) => {
                console.log('🔥 Background: Firebase data changed for path:', path, 'Keys:', snapshot.val() ? Object.keys(snapshot.val()).length : 0);
                sendMessageToAllTabs({
                    action: "firebaseDataChanged",
                    path: path,
                    data: snapshot.val()
                });
            };
            
            dataRef.on('value', listenerCallback, (error) => {
                console.error("Error in Firebase listener:", error);
            });
            
            console.log('✅ Background: Firebase listener set up for path:', path);

            // Let the caller know the listener was set up
            sendResponse({
                success: true
            });

            return true; // Required for async sendResponse
        }
        // Remove a Firebase data listener
        if (message.action === "removeFirebaseListener") {
            const path = message.path;
            // Get reference to the specified path in Firebase
            const dataRef = firebase.database().ref(path);
            // Remove all 'value' listeners at this path
            dataRef.off('value');
            sendResponse({
                success: true
            });
            return true;
        }
        // Handle getting data from Firebase
        if (message.action === "getFirebaseData") {
            const path = message.path;

            // Get reference to the specified path in Firebase
            const dataRef = firebase.database().ref(path);

            // Get snapshot of data at path
            dataRef.once('value')
                .then(snapshot => {
                    sendResponse({
                        success: true,
                        data: snapshot.val()
                    });
                })
                .catch(error => {
                    console.error("Error getting data from Firebase:", error);
                    sendResponse({
                        success: false,
                        error: error.message
                    });
                });

            return true; // Required for async sendResponse
        }
        // Handle saving data to Firebase
        if (message.action === "saveFirebaseData") {
            const path = message.path;
            const data = message.data;

            // Get reference to the specified path in Firebase
            const dataRef = firebase.database().ref(path);

            // Save data at path
            dataRef.set(data)
                .then(() => {
                    sendResponse({
                        success: true
                    });
                })
                .catch(error => {
                    console.error("Error saving data to Firebase:", error);
                    console.error("Path: ", path);
                    console.error("Data: ", data);
                    sendResponse({
                        success: false,
                        error: error.message
                    });
                });

            return true; // Required for async sendResponse
        }

        // Handle signupComplete message forwarding
        if (message.action === "signupComplete") {
            // This is just a pass-through to make sure the message gets to all listeners
            console.log("Forwarding signupComplete message");
            return false; // Don't keep the message port open, just let it propagate
        }

        // Handle usernameUpdateComplete message forwarding
        if (message.action === "usernameUpdateComplete") {
            // This is just a pass-through to make sure the message gets to all listeners
            console.log("Forwarding usernameUpdateComplete message");
            return false; // Don't keep the message port open, just let it propagate
        }

        // Handle saveUserDataComplete message forwarding
        if (message.action === "saveUserDataComplete") {
            // This is just a pass-through to make sure the message gets to all listeners
            console.log("Forwarding saveUserDataComplete message");
            return false; // Don't keep the message port open, just let it propagate
        }

        // Handle fetchUserDataComplete message forwarding
        if (message.action === "fetchUserDataComplete") {
            // This is just a pass-through to make sure the message gets to all listeners
            console.log("Forwarding fetchUserDataComplete message");
            return false; // Don't keep the message port open, just let it propagate
        }
        if (message.action === "startCapture") {
            if (!isOnWebsite)
                chrome.tabs.query({ active: true }, (tabs) => {
                    if (tabs && tabs.length > 0)
                        captureFullPage(tabs[0]);
                });
            return true;
        }

        if (message.action === "openPopup") {
            console.log('message.action', message.action);
            chrome.windows.create({
                url: chrome.runtime.getURL("popup.html") + `?text=${encodeURIComponent(message.text)}`,
                type: "popup",
                width: 800,
                height: 1080,
            }, function (win) {
                currentWindow = win;
            });
        }

        if (message.action === "alreadyOpenPopup") {
            console.log('message.action', message.action);
            sendRuntimeMessage({
                action: "updateText",
                newText: message.text
            }, (response) => {
                console.log("Message sent to popup: ", response);
            });
        }

        if (message.action === "refocusWindow") {
            if (!isOnWebsite)
                if (currentWindow) {
                    chrome.windows.update(currentWindow.id, { focused: true });
                }
        }

        if (message.action === "downloadFile") {
            if (!isOnWebsite)
                chrome.downloads.download({
                    url: message.url,
                    filename: message.filename
                });
        }

        // User authentication state
        if (message.command === "user-auth") {
            // Get the current user directly instead of using onAuthStateChanged
            const user = firebase.auth().currentUser;
            if (user) {
                // User is signed in.
                sendResponse({ type: "result", status: "success", data: user });
            } else {
                // No user is signed in.
                sendResponse({ type: "result", status: "error", data: false });
            }
            return true;
        }

        // Logout
        if (message.command === "auth-logout") {
            firebase.auth().signOut().then(function () {
                // User logged out...
                // chrome.storage.local.set({ authInfo: false });
                sendResponse({ type: "result", status: "success", data: false });
            }).catch(function (error) {
                // Logout error...
                sendResponse({ type: "result", status: "error", data: false, message: error });
            });

            return true; // Required for async sendResponse
        }

        if (message.command === "auth-reset-password") {
            firebase.auth().sendPasswordResetEmail(message.email)
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    console.error('Password reset error:', error);
                    sendResponse({
                        success: false,
                        error: error.message || "Failed to send password reset email"
                    });
                });
            return true; // Required for async sendResponse
        }

        // Login
        if (message.command === "auth-login") {
            firebase.auth().signInWithEmailAndPassword(message.e, message.p)
                .then(function (userCredential) {
                    var user = userCredential.user;

                    // Fetch user-specific data after successful login
                    fetchUserData(user.email).then((userData) => {
                        sendResponse({ type: "result", status: "success", data: user, userData: userData });
                    }).catch((error) => {
                        // Handle error in fetching user data
                        sendResponse({ type: "result", status: "success", data: user, userData: null, message: "Failed to fetch user data" });
                    });
                })
                .catch(function (error) {
                    // Handle login error
                    sendResponse({ type: "result", status: "error", data: false, message: error.message });
                });

            return true; // Required for async sendResponse
        }

        // Add Username
        if (message.command === "auth-username") {
            const user = firebase.auth().currentUser;
            if (user) {
                // Send an immediate acknowledgment to keep the message port open
                sendResponse({ status: "processing", message: "Processing username update..." });

                user.updateProfile({
                    displayName: message.newDisplayName  // Use the display name from the message
                }).then(function () {
                    console.log("Display name updated successfully!");
                    // Update the user's name in the Firebase Realtime Database
                    const userRef = database.ref(`Companies/${mainCompanyEmail}/users/${user.email.replace('.', ',')}`);
                    userRef.update({ name: message.newDisplayName })
                        .then(() => {
                            // Send success notification using chrome.runtime.sendMessage
                            sendRuntimeMessage({
                                action: "usernameUpdateComplete",
                                success: true,
                                user: user
                            });

                            console.log("Username update success notification sent");
                        })
                        .catch(error => {
                            console.error("Error updating database:", error);

                            // Send error notification
                            sendRuntimeMessage({
                                action: "usernameUpdateComplete",
                                success: false,
                                error: "Failed to update database: " + error.message
                            });
                        });
                }).catch(function (error) {
                    console.error("Error updating display name:", error.message);

                    // Send error notification
                    sendRuntimeMessage({
                        action: "usernameUpdateComplete",
                        success: false,
                        error: error.message
                    });
                });

                // Return true to indicate asynchronous response
                return true;
            } else {
                console.error("No user is currently logged in.");
                sendResponse({ status: "error", message: "No user is currently logged in." });
            }
        }

        async function proceedWithSignup(user, username, companyEmail) {
            if (user) {
                if (user.emailVerified) {
                    console.log("Proceeding with signup");
                    let email = user.email;
                    if (!username)
                        username = user.displayName;
                    if (!companyEmail)
                        companyEmail = email;
                    user.updateProfile({
                        displayName: username
                    }).then(() => {
                        console.log("Display name set successfully");
                        // chrome.storage.local.set({ authInfo: user });
                    });

                    // Store user info in local storage
                    // chrome.storage.local.set({ authInfo: user });

                    // For new users, we'll use a default company email or create a new entry
                    const userEmail = email.replace(".", ",");
                    companyEmail = companyEmail.replace(".", ",");
                    var userRegistered = await doesFirebaseKeyExist(`emailToCompanyDirectory/${userEmail}`);
                    // Set a default company email (the user's own email)
                    if (userRegistered) {
                        sendRuntimeMessage({
                            action: "signupComplete",
                            success: true,
                            user: user
                        });
                    }
                    else {
                        firebase.database().ref(`emailToCompanyDirectory/${userEmail}`).set(companyEmail)
                            .then(() => {
                                // Store the company email in the global variable
                                mainCompanyEmail = companyEmail;
                                console.log("Stored main company email:", mainCompanyEmail);

                                console.log("Using company email:", mainCompanyEmail);

                                // Initialize user data in the database
                                const userRef = database.ref(`Companies/${mainCompanyEmail}/users/${userEmail}`);

                                // setting info into the database
                                return userRef.set({
                                    name: username,
                                    email: email,
                                    createdAt: new Date().toISOString()
                                });
                            })
                            .then(() => {
                                console.log("User data initialized in database");

                                // Send a message to the popup to notify of successful signup
                                sendRuntimeMessage({
                                    action: "signupComplete",
                                    success: true,
                                    user: user
                                });

                                console.log("Signup success notification sent");
                            })
                            .catch(error => {
                                console.error("Error during signup:", error);
                                // If there's an error, clean up
                                if (user) {
                                    user.delete().catch(deleteError => {
                                        console.error("Error deleting user after failed signup:", deleteError);
                                    });
                                }

                                // Send error notification
                                sendRuntimeMessage({
                                    action: "signupComplete",
                                    success: false,
                                    error: error.message || "Signup failed"
                                });
                            });
                    }
                } else {
                    // Email not verified yet, show message to user
                    sendRuntimeMessage({
                        action: "signupComplete",
                        success: false,
                        error: "Please verify your email address before proceeding. Check your inbox for the verification link."
                    });
                }
            }
        }

        if (message.command == "google-signin") {
            proceedWithSignup(firebase.auth().currentUser, null, null);
        }

        // Sign Up
        if (message.command === "auth-signup") {
            // When you create a user with firebase.auth().createUserWithEmailAndPassword(message.e, message.p),
            // Firebase handles the storage of the user's email and password securely on its servers.
            // The password is never stored or exposed in plain text; it is securely hashed before being stored.

            // First, send an immediate acknowledgment to keep the message port open
            sendResponse({ type: "result", status: "processing", message: "Processing signup..." });

            let username = message.u;
            firebase.auth().createUserWithEmailAndPassword(message.e, message.p)
                .then(function (userCredential) {
                    var user = userCredential.user;
                    console.log("User created successfully:", user.email);

                    // Send verification email
                    user.sendEmailVerification()
                        .then(() => {
                            console.log("Verification email sent successfully");

                            // Set up a listener for auth state changes to check verification
                            const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                                proceedWithSignup(user, username, message.companyEmail);
                            });

                            // Set up token refresh interval to check verification status
                            const checkVerificationInterval = setInterval(() => {
                                console.log("Running interval");
                                user.reload().then(() => {
                                    console.log(user.emailVerified);
                                    if (user.emailVerified) {
                                        // Email is verified, clear interval and trigger auth state change
                                        clearInterval(checkVerificationInterval);
                                        unsubscribe(); // Remove the auth state listener
                                        proceedWithSignup(user, username, message.companyEmail);
                                        // Force a token refresh to trigger auth state change
                                        // user.getIdToken(true).then(() => {
                                        //     // The auth state change listener will handle the rest
                                        //     console.log("Email verified, proceeding with signup");
                                        // });
                                    }
                                }).catch((error) => {
                                    console.error("Error checking verification status:", error);
                                });
                            }, 5000); // Check every 5 seconds

                            // Clear interval after 5 minutes (300000 ms) if verification hasn't happened
                            setTimeout(() => {
                                clearInterval(checkVerificationInterval);
                                if (!user.emailVerified) {
                                    console.log("Verification check timeout - user still not verified");
                                }
                            }, 300000);

                        })
                        .catch((error) => {
                            console.error("Error sending verification email:", error);
                            sendRuntimeMessage({
                                action: "signupComplete",
                                success: false,
                                error: "Failed to send verification email: " + error.message
                            });
                        });
                })
                .catch(function (error) {
                    // Sign up error
                    console.error("Firebase auth signup error:", error);

                    // Send error notification
                    sendRuntimeMessage({
                        action: "signupComplete",
                        success: false,
                        error: error.message
                    });
                });

            return true; // Required for async sendResponse
        }

        // Firebase
        if (message.action === 'fetchUserData') {
            console.warn('-- action ↘ fetchUserData --');
            console.warn(message);

            // Send an immediate acknowledgment to keep the message port open
            sendResponse({ success: true, status: "processing", message: "Processing data fetch..." });

            console.log('About to call fetchUserData');
            fetchUserData(message.userEmail)
                .then(userData => {
                    // Send the actual data using a separate message
                    sendRuntimeMessage({
                        action: "fetchUserDataComplete",
                        success: true,
                        data: userData,
                        userEmail: message.userEmail
                    });
                    console.log('User data fetched successfully, notification sent');
                })
                .catch(error => {
                    // Send error notification
                    sendRuntimeMessage({
                        action: "fetchUserDataComplete",
                        success: false,
                        error: error.message,
                        userEmail: message.userEmail
                    });
                    console.error('Error fetching user data:', error.message);
                });

            return true; // Keeps the listener open for async response
        }

        if (message.action === 'saveUserData') {
            console.warn('-- action ↘ saveUserData --');
            const userEmail = message.userEmail;
            const userData = message.userData;
            const projectName = message.projectName;
            const prefixProjectName = message.prefixProjectName;
            // const userData = { name: 'Lebron', team: 'Lakers', number: 23 };

            console.warn(message);

            // Send an immediate acknowledgment to keep the message port open
            sendResponse({ success: true, status: "processing", message: "Processing data save..." });

            console.log('About to call saveUserData');
            saveUserData(userEmail, userData, projectName).then(() => {
                // Send success notification using chrome.runtime.sendMessage
                sendRuntimeMessage({
                    action: "saveUserDataComplete",
                    success: true,
                    userEmail: userEmail,
                    projectName: projectName,
                    prefixProjectName: prefixProjectName
                });
                console.log('User data saved successfully, notification sent');
            }).catch((error) => {
                // Send error notification
                sendRuntimeMessage({
                    action: "saveUserDataComplete",
                    success: false,
                    error: error.message,
                    userEmail: userEmail,
                    projectName: projectName,
                    prefixProjectName: prefixProjectName
                });
                console.error('Error saving user data:', error.message);
            });
            return true; // Keeps the listener open for async response
        }

        // Add this to your existing message listener
        if (message.command === "verify-password") {
            const auth = firebase.auth();
            const user = auth.currentUser;

            if (!user) {
                sendResponse({ success: false, error: "No user is currently logged in" });
                return;
            }

            // Create credentials with email and password
            const credential = firebase.auth.EmailAuthProvider.credential(
                message.email,
                message.password
            );

            // Reauthenticate
            user.reauthenticateWithCredential(credential)
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    sendResponse({ success: false, error: error.message });
                });

            return true; // Keep the message channel open for async response
        }

        if (message.command === "update-password") {
            const auth = firebase.auth();
            const user = auth.currentUser;

            if (!user) {
                sendResponse({ success: false, error: "No user is currently logged in" });
                return;
            }

            // Update password
            user.updatePassword(message.newPassword)
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    sendResponse({ success: false, error: error.message });
                });

            return true; // Keep the message channel open for async response
        }

        if (message.action === 'migrateGuestData') {
            // const { userEmail, tempData } = message;

            // // Send an immediate acknowledgment
            // sendResponse({ success: true, status: "processing", message: "Processing data migration..." });

            // // Reference to the user's data in Firebase
            // const userRef = database.ref(`Companies/${mainCompanyEmail}/users/${userEmail.replace('.', ',')}`);

            // // Save the migrated data
            // userRef.update({
            //     annotationHistory: tempData.annotationHistory ? JSON.parse(tempData.annotationHistory) : null,
            //     voiceSavedNotes: tempData.voiceSavedNotes ? JSON.parse(tempData.voiceSavedNotes) : null,
            //     videoSavedNotes: tempData.videoSavedNotes ? JSON.parse(tempData.videoSavedNotes) : null,
            //     savedNotes: tempData.savedNotes ? JSON.parse(tempData.savedNotes) : null
            // })
            //     .then(() => {
            //         sendRuntimeMessage({
            //             action: "migrateGuestDataComplete",
            //             success: true
            //         });
            //     })
            //     .catch(error => {
            //         console.error('Error migrating data:', error);
            //         sendRuntimeMessage({
            //             action: "migrateGuestDataComplete",
            //             success: false,
            //             error: error.message
            //         });
            //     });

            return true; // Keep the message channel open for async response
        }

        // Add this to your message listener
        if (message.action === 'proceedWithScreenshot') {
            // Store the category
            if (!isOnWebsite)
                chrome.storage.local.set({ currentScreenshotCategory: message.category }, () => {
                    // Then proceed with screenshot capture
                    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: "captureScreenshot",
                            category: message.category
                        });
                        // Send response back to screenshot.js to trigger navigation
                        sendResponse({ success: true });
                    });
                });
            return true; // Keep the message channel open for async response
        }

        // Add a listener to get the main company email
        if (message.action === 'getMainCompanyEmail') {
            console.log('Returning mainCompanyEmail:', mainCompanyEmail);
            sendResponse({ success: true, mainCompanyEmail: mainCompanyEmail });
            return true;
        }

        if (message.action === 'getGlobalHighlightID') {
            sendResponse({ success: true, data: globalHighlightID });
            return true;
        }

        return true;
    }

    // Initialize context menu items
    let takeScreenshotSubmenu = null;

    // Function to create or remove the screenshot menu item
    function updateScreenshotMenuItem(isEnabled) {
        // Remove existing menu item if it exists
        if (takeScreenshotSubmenu) {
            chrome.contextMenus.remove(takeScreenshotSubmenu);
            takeScreenshotSubmenu = null;
        }

        // Create new menu item if enabled
        if (isEnabled) {
            takeScreenshotSubmenu = chrome.contextMenus.create({
                id: "takeScreenshot",
                parentId: "addLabel",
                title: "Take Screenshot",
                contexts: ["selection"]
            });
        }
    }

    // Listen for changes to the manual logging toggle
    if (!isOnWebsite) {
        chrome.storage.sync.get('manualLoggingEnabled', ({ manualLoggingEnabled }) => {
            updateScreenshotMenuItem(manualLoggingEnabled);
        });

        // Listen for changes to the toggle state
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.manualLoggingEnabled) {
                updateScreenshotMenuItem(changes.manualLoggingEnabled.newValue);
            }
        });
    }
} catch (e) {
    // Handle any errors
    console.log(e);
}

async function captureFullPage(tab) {
    chrome.tabs.sendMessage(tab.id, { action: "showAllLabelsCodes" });
    let response = await chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" });
    if (!response)
        return;
    const { totalHeight, viewportHeight } = response;
    const screenshots = [];
    for (let y = 0; y < totalHeight; y += viewportHeight) {
        await chrome.tabs.sendMessage(tab.id, { action: "scrollTo", y });
        await new Promise(r => setTimeout(r, 750)); // wait for scroll
        const dataUrl = await new Promise(resolve => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, resolve);
        });
        screenshots.push({ y, dataUrl });
    }

    chrome.tabs.sendMessage(tab.id, { action: "stitchScreenshots", screenshots: screenshots }, (response) => {
        // chrome.downloads.download({
        //     url: response.url,
        //     filename: "fullpage-screenshot.png"
        // });
    });
}