

import { showToast, sendMessageToAllTabs, getUserEmail, getCurrentProject, sendRuntimeMessage, listenerFirebaseData } from '../frames.js';
import { hideAllSubFrames, showFrame } from './utils.js';
import { toggleProfileMenuDisplay, showForm } from './login.js';
import { isOnWebsite } from '../globalVariables.js';


console.warn('-- partials > auth.js --');


// *** Global Vars ***
var globalUser = null;
// let firebaseKeyList = ["videoSavedNotes", "annotationHistory", "savedNotes", "voiceSavedNotes", "customLabelsAndCodes"];
window.signupUser = false;
window.signupE = '';
window.signupP = '';

/**
 * AuthGate - Central Authentication and Profile State Manager
 * Prevents race conditions and ensures proper state synchronization
 */
class AuthGate {
    constructor() {
        this.authReady = false;
        this.profileReady = false;
        this.currentUser = null;
        this.profileData = null;
        this.authListeners = [];
        this.profileListeners = [];
        this.routeListeners = [];
        this.initializationPromise = null;
        
        // Initialize immediately
        this.initialize();
    }

    async initialize() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = new Promise((resolve) => {
            // Set up Firebase auth state listener
            if (typeof firebase !== 'undefined' && firebase.auth) {
                firebase.auth().onAuthStateChanged(async (user) => {
                    console.log('[AuthGate] Auth state changed:', user ? user.email : 'null');
                    
                    this.currentUser = user;
                    this.authReady = true;
                    
                    if (user) {
                        // User is logged in - fetch profile data
                        await this.fetchProfileData(user);
                    } else {
                        // User is logged out - clear profile data
                        this.clearProfileData();
                    }
                    
                    // Notify listeners
                    this.notifyAuthListeners(user);
                    this.notifyRouteListeners();
                    
                    resolve();
                });
            } else {
                // Fallback for environments without Firebase
                this.authReady = true;
                this.profileReady = true;
                resolve();
            }
        });

        return this.initializationPromise;
    }

    async fetchProfileData(user) {
        try {
            console.log('[AuthGate] Fetching profile data for:', user.email);
            this.profileReady = false;
            
            // Prepare profile data from Firebase user
            this.profileData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                username: null, // Will be fetched from database
                companyEmail: null
            };

            // Update profile UI immediately with available data
            if (typeof window.updateProfileUI === 'function') {
                window.updateProfileUI(user);
            }

            // Fetch additional user data from database
            const fetchPromise = new Promise((resolve) => {
                sendRuntimeMessage({
                    action: 'fetchUserData',
                    userEmail: user.email
                }, (response) => {
                    if (response && response.success && response.data) {
                        const { name, email, ...rest } = response.data;
                        this.profileData.username = name;
                        this.profileData.databaseData = rest;
                        
                        console.log('[AuthGate] Profile data fetched:', { name, email });
                        
                        // Update UI elements with database data
                        this.updateUserUIElements(name, email);
                        
                        // Update profile picture if needed
                        if (user.photoURL) {
                            this.storeProfilePicture(user.photoURL);
                        }
                    }
                    
                    this.profileReady = true;
                    this.notifyProfileListeners(this.profileData);
                    resolve();
                });
            });

            // Set timeout to ensure we don't wait forever
            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => {
                    console.warn('[AuthGate] Profile fetch timeout, continuing anyway');
                    this.profileReady = true;
                    this.notifyProfileListeners(this.profileData);
                    resolve();
                }, 5000); // 5 second timeout
            });

            await Promise.race([fetchPromise, timeoutPromise]);
            
        } catch (error) {
            console.error('[AuthGate] Error fetching profile data:', error);
            this.profileReady = true; // Set ready even on error to prevent blocking
            this.notifyProfileListeners(this.profileData);
        }
    }

    clearProfileData() {
        console.log('[AuthGate] Clearing profile data');
        this.profileData = null;
        this.profileReady = true;
        this.currentUser = null; // Ensure current user is cleared
        
        // Clear UI immediately
        if (typeof window.clearProfileUI === 'function') {
            window.clearProfileUI();
        }
        
        // Clear stored data
        this.clearStoredUserData();
        
        this.notifyProfileListeners(null);
        this.notifyAuthListeners(null); // Notify auth listeners that user is logged out
    }

    clearStoredUserData() {
        // Clear localStorage
        localStorage.removeItem('userProfilePicture');
        localStorage.removeItem('profilePictureTimestamp');
        localStorage.removeItem('googleAccessToken');
        localStorage.removeItem('tokenTimestamp');
        localStorage.removeItem('currentUser');
        
        // Clear Chrome storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.remove([
                'userProfilePicture', 
                'profilePictureTimestamp',
                'googleAccessToken',
                'tokenTimestamp',
                'authInfo'
            ]);
        }
        
        // Clear global variables
        window.globalUser = null;
        globalUser = null;
    }

    updateUserUIElements(name, email) {
        try {
            // Update username elements
            const usernameElements = document.getElementsByClassName('username-value');
            Array.from(usernameElements).forEach(element => {
                element.textContent = name || email || '';
            });

            // Update email elements
            const emailElements = document.getElementsByClassName('email-value');
            Array.from(emailElements).forEach(element => {
                element.textContent = email || '';
            });

            // Update header username
            const headerUsernameElement = document.getElementById('header-username');
            if (headerUsernameElement) {
                headerUsernameElement.textContent = name || email || '';
            }

            // Update main user email display
            const mainUserEmailElement = document.getElementById("main-user-email");
            if (mainUserEmailElement) {
                const displayName = name || this.currentUser?.displayName || email;
                mainUserEmailElement.innerHTML = `<a class="email-link">${displayName}</a>`;
            }

        } catch (error) {
            console.error('[AuthGate] Error updating UI elements:', error);
        }
    }

    storeProfilePicture(imageUrl) {
        if (typeof window.storeProfilePicture === 'function') {
            window.storeProfilePicture(imageUrl);
        }
    }

    // Listener management
    onAuthReady(callback) {
        if (this.authReady) {
            callback(this.currentUser);
        } else {
            this.authListeners.push(callback);
        }
    }

    onProfileReady(callback) {
        if (this.profileReady) {
            callback(this.profileData);
        } else {
            this.profileListeners.push(callback);
        }
    }

    onRouteReady(callback) {
        if (this.authReady) {
            callback(this.currentUser, this.profileData);
        } else {
            this.routeListeners.push(callback);
        }
    }

    notifyAuthListeners(user) {
        this.authListeners.forEach(callback => {
            try {
                callback(user);
            } catch (error) {
                console.error('[AuthGate] Error in auth listener:', error);
            }
        });
        this.authListeners = [];
    }

    notifyProfileListeners(profileData) {
        this.profileListeners.forEach(callback => {
            try {
                callback(profileData);
            } catch (error) {
                console.error('[AuthGate] Error in profile listener:', error);
            }
        });
        this.profileListeners = [];
    }

    notifyRouteListeners() {
        this.routeListeners.forEach(callback => {
            try {
                callback(this.currentUser, this.profileData);
            } catch (error) {
                console.error('[AuthGate] Error in route listener:', error);
            }
        });
        this.routeListeners = [];
    }

    // Route guard - only proceed if auth is ready
    guardRoute(callback) {
        this.onRouteReady(callback);
    }

    // Get current state
    isAuthenticated() {
        return this.authReady && !!this.currentUser;
    }

    getUser() {
        return this.currentUser;
    }

    getProfileData() {
        return this.profileData;
    }

    isReady() {
        return this.authReady && this.profileReady;
    }
}

// Create global AuthGate instance
window.authGate = new AuthGate();


/**
 *  <h3>Frame Views</h3>
 *
 *  <h3>Firebase Methods</h3>
 *  1. fetchUserData - This code fetches data from firebase
 */
// Only control the nav in the login and sign in features
function hideNav() {
    hideAllSubFrames();
    showFrame("main-sub-frame");
    showFrame("main-login-icon-sub-frame");
}

const pageDisplay = async function (userData) {
    console.log('-- pageDisplay(userData) --');
    console.log('userData', userData);

    if (userData == false) {
        // document.querySelector('section.logged-out').style.display = '';
        document.querySelector('section.logged-in').style.display = 'none';
        console.log('userData is false');
    } else {
        // document.querySelector('section.logged-out').style.display = 'none';
        document.querySelector('section.logged-in').style.display = '';
        console.log('userData is true');

        const companyEmail = await getMainCompanyEmail();
        if (userData.email.replace(".", ",") == companyEmail) {
            document.getElementById('invite-account-dropdown-item').style.display = '';
        }
    }
}
export function showProfile() {
    console.warn(`-- showProfile() --`);

    // Get fresh user data directly from Firebase Auth instead of using guardRoute
    if (typeof firebase !== 'undefined' && firebase.auth) {
        const currentUser = firebase.auth().currentUser;
        
        if (currentUser) {
            console.warn('-- Fresh Firebase user --', currentUser);

            // Update profile UI immediately with current user data
            updateProfileUI(currentUser);

            // Update main user email display immediately with fresh data
            const displayName = currentUser.displayName || currentUser.email;
            const mainUserEmailElement = document.getElementById("main-user-email");
            
            if (mainUserEmailElement) {
                mainUserEmailElement.innerHTML = `<a class="email-link">${displayName}</a>`;
            }

            // Set up a listener for the fetchUserDataComplete message
            const fetchDataListener = function (message) {
                console.log("Received message:", message);

                if (message.action === "fetchUserDataComplete" && message.userEmail === currentUser.email) {
                    // Remove the listener once we've received the response
                    chrome.runtime.onMessage.removeListener(fetchDataListener);

                    console.warn('-- customLabel --');

                    if (message.success) {
                        const fetchResponse = message;
                        const { name, email } = fetchResponse.data;

                        // Update all username-value elements
                        const usernameElements = document.getElementsByClassName('username-value');
                        Array.from(usernameElements).forEach(element => {
                            element.textContent = name;
                        });

                        // Update all email-value elements
                        const emailElements = document.getElementsByClassName('email-value');
                        Array.from(emailElements).forEach(element => {
                            element.textContent = email;
                        });

                        // Update main user email with database username if available
                        if (name && mainUserEmailElement) {
                            mainUserEmailElement.innerHTML = `<a class="email-link">${name}</a>`;
                        }

                        // for loop
                        let firebaseKeyList = ["videoSavedNotes", "annotationHistory", "savedNotes", "voiceSavedNotes", "customLabelsAndCodes"];
                        // callSetItem("customLabel", JSON.stringify(cl));
                        console.warn('name', name);
                        if (name) {
                            console.warn('name1', name)
                            // show profile info
                            //document.getElementById('flag-username').style.display = 'none';
                            document.getElementById('flag-profile').style.display = '';
                        } else {
                            console.warn('name2', name)
                            // prompt user to create a username
                            //document.getElementById('flag-username').style.display = '';
                            document.getElementById('flag-profile').style.display = 'none';
                        }
                    } else {
                        console.error('Error fetching user data:', message.error);
                    }
                }
            };

            // Add the listener
            chrome.runtime.onMessage.addListener(fetchDataListener);

            // Todo ↘ This code fetches data from firebase ( fetchUserData )
            sendRuntimeMessage({ action: 'fetchUserData', userEmail: currentUser.email }, (response) => {
                console.log("Initial fetchUserData response:", response);

                // If we get an immediate error, handle it
                if (response && response.success === false) {
                    // Remove the listener since we're handling the error here
                    chrome.runtime.onMessage.removeListener(fetchDataListener);
                    console.error('Error fetching user data:', response.error);
                }

                // If we get a processing status, just wait for the fetchUserDataComplete message
                if (response && response.status === "processing") {
                    console.log("Data fetch processing, waiting for completion...");
                }

                // If we don't get a response at all, handle that error
                if (!response) {
                    // Remove the listener since we're handling the error here
                    chrome.runtime.onMessage.removeListener(fetchDataListener);
                    console.error('No response received from the server. Please try again.');
                }
            });

        } else {
            console.log('No current user detected in Firebase Auth!');
            
            // Clear profile UI if no user
            const mainUserEmailElement = document.getElementById("main-user-email");
            if (mainUserEmailElement) {
                mainUserEmailElement.innerHTML = '';
            }
            
            // Hide profile sections
            if (document.getElementById('flag-profile')) {
                document.getElementById('flag-profile').style.display = 'none';
            }
        }
    } else {
        console.error('Firebase not available!');
    }
}

//  AUTHENTICATION Methods
// Todo ↘ LOGOUT
document.getElementById('profile-logout-btn').addEventListener('click', function () {
    console.log('Logout initiated - clearing UI immediately');
    
    // Clear profile UI immediately on logout to prevent race conditions
    if (typeof window.clearProfileUI === 'function') {
        window.clearProfileUI();
    }
    
    // Clear AuthGate state immediately
    if (window.authGate) {
        window.authGate.currentUser = null;
        window.authGate.clearProfileData();
    }
    
    // Clear global user immediately
    window.globalUser = null;
    globalUser = null;
    
    // Clear header username and profile elements immediately
    const headerUsernameElement = document.getElementById('header-username');
    if (headerUsernameElement) {
        headerUsernameElement.textContent = '';
    }
    
    const mainUserEmailElement = document.getElementById("main-user-email");
    if (mainUserEmailElement) {
        mainUserEmailElement.innerHTML = '';
    }
    
    // Hide profile elements immediately
    const profileElements = document.querySelectorAll('.username-value, .email-value');
    profileElements.forEach(element => {
        element.textContent = '';
    });
    
    // Hide profile images and show default icons
    const profileImages = document.querySelectorAll('#profile-image, #header-profile-image');
    const defaultIcons = document.querySelectorAll('#default-icon, #header-default-icon');
    
    profileImages.forEach(img => {
        img.style.display = 'none';
        img.src = '';
    });
    
    defaultIcons.forEach(icon => {
        icon.style.display = 'block';
    });
    
    sendRuntimeMessage({ command: "auth-logout" }, (response) => {
        console.log(`1. Cleaning up profile`);
        // firebaseKeyList.forEach(key => {
        //     callRemoveItem(key);
        // });

        // Dispatch logout event to reset statistics
        document.dispatchEvent(new Event('userLoggedOut'));

        console.log(`2. Logging out`);

        // Don't reload the entire app, just reset the UI
        // mainMenu();
        // pageDisplay(false);

        // Clear any stored user data
        window.globalUser = null;

        // Show login form
        // toggleProfileMenuDisplay();
        window.location.reload();
    });
});

// Todo ↘ SIGNUP
document.querySelector('.signup-area input[type="button"]').addEventListener('click', function () {
    var inviteCode = document.getElementById('invite-code').value;
    var username = document.getElementById('signup-username').value;
    var email = document.getElementById('signup-email').value;
    var pass = document.querySelector('#signup-password').value;

    if (inviteCode.length != 8 && inviteCode.length != 0) {
        showToast("Invalid invite code", "error");
        return;
    }
    // Check if invite code exists
    sendRuntimeMessage({
        action: "getFirebaseData",
        path: `inviteCodes/${inviteCode}`
    }, (response) => {
        if (inviteCode.length == 8 && response.data == null) {
            showToast("Invalid invite code", "error");
            return;
        }
        var companyEmail = email.replace(".", ",");

        if (response.data) {
            companyEmail = response.data.companyEmail;
            //Delete invite code
            sendRuntimeMessage({
                action: "saveFirebaseData",
                path: `inviteCodes/${inviteCode}`,
                data: null
            }, (response) => {

            });
        }

        console.log("Company email ", companyEmail);
        // Clear previous error messages
        handleFormError('', 'signup-error');

        // Check password strength before allowing signup
        const strengthResult = checkPasswordStrength(pass);
        if (strengthResult.strength === 'weak') {
            handleFormError('Please choose a stronger password', 'signup-error');
            return;
        }

        // Show loading indicator or disable button
        const signupButton = document.querySelector('.signup-area input[type="button"]');
        signupButton.value = "Signing up...";
        signupButton.disabled = true;

        window.signupUser = true;
        window.signupU = username;
        window.signupE = email;
        window.signupP = pass;

        console.log("Sending signup request for:", email);

        // Set up a listener for the signupComplete message
        const signupCompleteListener = function (message) {
            console.log("Received message:", message);

            if (message.action === "signupComplete") {
                // Remove the listener once we've received the response

                // Re-enable button
                signupButton.value = "Sign Up";
                signupButton.disabled = false;

                if (message.success) {
                    chrome.runtime.onMessage.removeListener(signupCompleteListener);
                    console.log("Signup successful!");
                    alert(`Signup successful!`);

                    // Initialize user data
                    initUserData(message.user);

                    // Show new display
                    toggleProfileMenuDisplay();
                    window.location.reload();
                } else {
                    console.error("Signup error:", message.error);
                    handleFormError(message.error || "Signup failed", 'signup-error');
                }
            }
        };

        // Add the listener
        chrome.runtime.onMessage.addListener(signupCompleteListener);

        sendRuntimeMessage({ command: "auth-signup", u: username, e: email, p: pass, companyEmail: companyEmail }, (response) => {
            console.log("Initial signup response received:", response);

            // If we get an immediate error, handle it
            if (response && response.status === "error") {
                // Remove the listener since we're handling the error here
                chrome.runtime.onMessage.removeListener(signupCompleteListener);

                // Re-enable button
                signupButton.value = "Sign Up";
                signupButton.disabled = false;

                console.error("Signup error:", response.message);
                handleFormError(response.message || "Signup failed", 'signup-error');
            }

            // If we get a processing status, just wait for the signupComplete message
            if (response && response.status === "processing") {
                console.log("Signup processing, waiting for completion...");
            }

            // If we don't get a response at all, handle that error
            if (!response) {
                // Remove the listener since we're handling the error here
                chrome.runtime.onMessage.removeListener(signupCompleteListener);

                // Re-enable button
                signupButton.value = "Sign Up";
                signupButton.disabled = false;

                handleFormError("No response received from the server. Please try again.", 'signup-error');
            }
        });
    });
});

document.getElementById("forgot-password").addEventListener('click', function () {
    showForm('forgotPasswordForm');
});

document.getElementById("sendForgotPassword").addEventListener('click', function () {
    var email = document.getElementById("forgotPasswordEmail").value;

    if (!email) {
        handleFormError("Please enter your email address", 'forgot-password-error');
        return;
    }

    // Show loading state
    const sendButton = document.getElementById("sendForgotPassword");
    const originalText = sendButton.textContent;
    sendButton.textContent = "Sending...";
    sendButton.disabled = true;

    // Send password reset request to Firebase
    sendRuntimeMessage({
        command: "auth-reset-password",
        email: email
    }, (response) => {
        // Reset button state
        sendButton.textContent = originalText;
        sendButton.disabled = false;

        if (response && response.success) {
            showToast("Password reset email sent! Please check your inbox.", "success");
            // Hide the forgot password form

            showForm("loginForm");
        } else {
            const errorMessage = response?.error || "Failed to send reset email. Please try again.";
            handleFormError(errorMessage, 'forgot-password-error');
        }
    });
});

document.getElementById("googleSignIn").addEventListener('click', function () {
    // const provider = new firebase.auth.GoogleAuthProvider();

    // firebase.auth().signInWithPopup(provider)
    //     .then((result) => {
    //         const user = result.user;
    //         // user.email, user.uid, etc.
    //     }).catch((error) => {
    //         // Handle Errors
    //         console.error(error);
    //     });

    const redirectUri = chrome.identity.getRedirectURL();
    // const clientID = "310393035448-k1g7ij96hncu3ac89mr50v04qlc67vv2.apps.googleusercontent.com";
    const clientID = "143602089096-qa3trhh8adjio1dfv85p44is3dbetaad.apps.googleusercontent.com";
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientID}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=profile%20email%20https://www.googleapis.com/auth/userinfo.profile`;

    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, function (redirectUrl) {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            return;
        }

        const url = new URL(redirectUrl);
        const accessToken = new URLSearchParams(url.hash.substring(1)).get('access_token');

        const credential = firebase.auth.GoogleAuthProvider.credential(null, accessToken);
        firebase.auth().signInWithCredential(credential)
            .then(result => {
                console.log("Signed in:", result.user);
                
                // Store the access token for future use
                storeAccessToken(accessToken);
                
                // Update profile UI with user data
                updateProfileUI(result.user);
                
                // Also fetch additional profile data from Google People API
                fetchUserProfilePicture(accessToken);
                
                sendRuntimeMessage({ command: "google-signin" });
                window.location.reload();
            })
            .catch(error => {
                console.error("Firebase sign-in failed:", error);
                showToast(error, 'error');
            });
    });
});

/**
 * Fetch user profile picture using Google People API
 * @param {string} accessToken - The OAuth access token
 */
async function fetchUserProfilePicture(accessToken) {
    try {
        console.log('Fetching user profile picture...');
        
        // Make request to Google People API
       const response = await fetch('https://people.googleapis.com/v1/people/me?personFields=photos,names', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const userData = await response.json();
        console.log('Google People API response:', userData);

        // Extract profile picture URL
        if (userData.photos && userData.photos.length > 0) {
            const profilePicUrl = userData.photos[0].url;
            console.log('Profile picture URL:', profilePicUrl);
            
            // Update profile picture in the UI
            updateProfilePicture(profilePicUrl);
            
            // Store profile picture URL in local storage or Firebase
            storeProfilePicture(profilePicUrl);
            
            return profilePicUrl;
        } else {
            console.log('No profile picture found');
            return null;
        }
        
    } catch (error) {
        console.error('Error fetching profile picture:', error);
        showToast('Failed to fetch profile picture: ' + error.message, 'error');
        return null;
    }
}

/**
 * Robust Profile Avatar Controller
 * Handles profile picture display, fallbacks, and cleanup across account switches
 */
(function() {
    let previousObjectUrl = null;

    function cacheBust(url) {
        if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}t=${Date.now()}`;
    }

    function revokePreviousObjectUrl() {
        if (previousObjectUrl && previousObjectUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previousObjectUrl);
            previousObjectUrl = null;
        }
    }

    function showDefault() {
        const img = document.getElementById('profile-image');
        const svg = document.getElementById('default-profile-icon');
        const header = document.getElementById('header-default-icon');
        const headerProfileImage = document.getElementById('header-profile-image');

        revokePreviousObjectUrl();

        // Reset main profile image
        if (img) {
            img.removeAttribute('src');
            img.style.display = 'none';
            img.onload = null;
            img.onerror = null;
        }
        
        // Show default SVG icon
        if (svg) {
            svg.style.display = 'block';
        }

        // Reset header profile image
        if (headerProfileImage) {
            headerProfileImage.removeAttribute('src');
            headerProfileImage.style.display = 'none';
            headerProfileImage.onload = null;
            headerProfileImage.onerror = null;
        }

        // Reset header to default icon
        if (header) {
            header.style.backgroundImage = '';
            header.style.width = '';
            header.style.height = '';
            header.style.borderRadius = '';
            header.style.display = '';
            header.classList.add('fa-regular', 'fa-user');
            header.classList.remove('fa-solid');
            header.textContent = '';
        }

        // Also update any other profile picture elements
        const otherProfilePics = document.querySelectorAll('.profile-pic, .user-avatar, #user-profile-pic, #dynamic-profile-pic');
        otherProfilePics.forEach(element => {
            if (element.tagName === 'IMG') {
                element.removeAttribute('src');
                element.style.display = 'none';
            } else {
                element.style.backgroundImage = '';
            }
        });

        console.log('Profile UI reset to default state');
    }

    function showImage(finalUrl) {
        const img = document.getElementById('profile-image');
        const svg = document.getElementById('default-profile-icon');
        const header = document.getElementById('header-default-icon');
        const headerProfileImage = document.getElementById('header-profile-image');
        
        if (!img) {
            console.warn('Profile image element not found');
            return;
        }

        // Set up success handler
        img.onload = function() {
            img.style.display = 'block';
            if (svg) svg.style.display = 'none';

            // Update header profile image if it exists
            if (headerProfileImage) {
                headerProfileImage.src = finalUrl;
                headerProfileImage.style.display = 'block';
                if (header) header.style.display = 'none';
            } else if (header) {
                // Use header as background image
                header.classList.remove('fa-regular', 'fa-user');
                header.classList.add('fa-solid');
                header.style.backgroundImage = `url("${finalUrl}")`;
                header.style.backgroundSize = 'cover';
                header.style.backgroundPosition = 'center';
                header.style.borderRadius = '50%';
                header.style.display = 'inline-block';
                header.style.width = '24px';
                header.style.height = '24px';
                header.textContent = '';
            }

            // Update other profile elements
            const otherProfilePics = document.querySelectorAll('.profile-pic, .user-avatar, #user-profile-pic');
            otherProfilePics.forEach(element => {
                if (element.tagName === 'IMG') {
                    element.src = finalUrl;
                    element.style.display = 'block';
                    element.alt = 'User Profile Picture';
                } else {
                    element.style.backgroundImage = `url(${finalUrl})`;
                    element.style.backgroundSize = 'cover';
                    element.style.backgroundPosition = 'center';
                }
            });

            console.log('Profile picture loaded and displayed:', finalUrl);
        };

        // Set up error handler - fallback to default
        img.onerror = function() {
            console.warn('Failed to load profile picture:', finalUrl);
            showDefault();
        };

        // Start loading the image
        img.src = finalUrl;
    }

    // Public API - Clear profile UI (call on logout)
    window.clearProfileUI = function() {
        console.log('Clearing profile UI...');
        showDefault();
        
        // Clear all username and email elements
        const headerUsernameElement = document.getElementById('header-username');
        if (headerUsernameElement) {
            headerUsernameElement.textContent = '';
        }
        
        const mainUserEmailElement = document.getElementById("main-user-email");
        if (mainUserEmailElement) {
            mainUserEmailElement.innerHTML = '';
        }
        
        // Clear all profile elements
        const profileElements = document.querySelectorAll('.username-value, .email-value');
        profileElements.forEach(element => {
            element.textContent = '';
        });
        
        // Hide profile images and show default icons
        const profileImages = document.querySelectorAll('#profile-image, #header-profile-image');
        const defaultIcons = document.querySelectorAll('#default-icon, #header-default-icon');
        
        profileImages.forEach(img => {
            img.style.display = 'none';
            img.src = '';
        });
        
        defaultIcons.forEach(icon => {
            icon.style.display = 'block';
        });
        
        // Clear stored profile data
        localStorage.removeItem('userProfilePicture');
        localStorage.removeItem('profilePictureTimestamp');
        localStorage.removeItem('googleAccessToken');
        localStorage.removeItem('tokenTimestamp');
        localStorage.removeItem('currentUser');
        
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.remove([
                'userProfilePicture', 
                'profilePictureTimestamp',
                'googleAccessToken',
                'tokenTimestamp',
                'authInfo'
            ]);
        }
    };

    // Public API - Update profile UI (call on login or user change)
    window.updateProfileUI = async function(user) {
        console.log('Updating profile UI for user:', user);
        
        if (!user) {
            showDefault();
            return;
        }

        // Get profile picture URL from user object
        let rawUrl = '';
        if (user.photoURL) {
            rawUrl = user.photoURL.trim();
        } else if (user.picture) {
            rawUrl = user.picture.trim();
        } else if (user.avatar_url) {
            rawUrl = user.avatar_url.trim();
        }

        if (!rawUrl) {
            console.log('No profile picture URL found for user');
            showDefault();
            return;
        }

        try {
            // Simple path: use cache-busted URL
            const finalUrl = cacheBust(rawUrl);
            showImage(finalUrl);
            
            // Store the profile picture for future use
            storeProfilePicture(finalUrl);
            
        } catch (error) {
            console.error('Error updating profile UI:', error);
            showDefault();
        }
    };

    // Legacy function for backward compatibility
    window.updateProfilePicture = function(imageUrl) {
        if (!imageUrl) {
            showDefault();
            return;
        }
        
        try {
            const finalUrl = cacheBust(imageUrl);
            showImage(finalUrl);
            storeProfilePicture(finalUrl);
        } catch (error) {
            console.error('Error in updateProfilePicture:', error);
            showDefault();
        }
    };

})();

/**
 * Store profile picture URL for future use
 * @param {string} imageUrl - The profile picture URL
 */
function storeProfilePicture(imageUrl) {
    try {
        // Store in Chrome extension storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ 
                userProfilePicture: imageUrl,
                profilePictureTimestamp: Date.now()
            });
        }

        // Store in localStorage as backup
        localStorage.setItem('userProfilePicture', imageUrl);
        localStorage.setItem('profilePictureTimestamp', Date.now().toString());

        // You can also store in Firebase if needed
        // storeProfilePictureInFirebase(imageUrl);
        
        console.log('Profile picture URL stored');
    } catch (error) {
        console.error('Error storing profile picture:', error);
    }
}

/**
 * Load stored profile picture on page load
 */
function loadStoredProfilePicture() {
    try {
        // Check if user is currently logged in first
        isUserLoggedIn((user) => {
            if (user) {
                // User is logged in, use their current profile data
                updateProfileUI(user);
            } else {
                // No user logged in, ensure UI shows default state
                clearProfileUI();
            }
        });
        
        // Legacy fallback: try to get from stored picture data
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['userProfilePicture', 'profilePictureTimestamp'], (result) => {
                if (result.userProfilePicture) {
                    // Check if the stored picture is not too old (e.g., 24 hours)
                    const oneDayInMs = 24 * 60 * 60 * 1000;
                    const isRecent = result.profilePictureTimestamp && 
                                   (Date.now() - result.profilePictureTimestamp) < oneDayInMs;
                    
                    if (isRecent) {
                        updateProfilePicture(result.userProfilePicture);
                    }
                }
            });
        } else {
            // Fallback to localStorage
            const storedUrl = localStorage.getItem('userProfilePicture');
            const timestamp = localStorage.getItem('profilePictureTimestamp');
            
            if (storedUrl && timestamp) {
                const oneDayInMs = 24 * 60 * 60 * 1000;
                const isRecent = (Date.now() - parseInt(timestamp)) < oneDayInMs;
                
                if (isRecent) {
                    updateProfilePicture(storedUrl);
                }
            }
        }
    } catch (error) {
        console.error('Error loading stored profile picture:', error);
    }
}

/**
 * Fetch profile picture for already authenticated user
 * This can be called when the user is already signed in
 */
async function fetchProfilePictureForCurrentUser() {
    try {
        // Check if we have a stored access token
        const storedToken = localStorage.getItem('googleAccessToken');
        
        if (storedToken) {
            await fetchUserProfilePicture(storedToken);
        } else {
            console.log('No stored access token found. User may need to re-authenticate.');
        }
    } catch (error) {
        console.error('Error fetching profile picture for current user:', error);
    }
}

/**
 * Store the access token for future use
 * @param {string} accessToken - The OAuth access token
 */
function storeAccessToken(accessToken) {
    try {
        // Store in Chrome extension storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ 
                googleAccessToken: accessToken,
                tokenTimestamp: Date.now()
            });
        }

        // Store in localStorage as backup
        localStorage.setItem('googleAccessToken', accessToken);
        localStorage.setItem('tokenTimestamp', Date.now().toString());
        
        console.log('Access token stored');
    } catch (error) {
        console.error('Error storing access token:', error);
    }
}

// Load stored profile picture when the page loads
document.addEventListener('DOMContentLoaded', loadStoredProfilePicture);

// Export functions for use in other parts of the application
window.fetchUserProfilePicture = fetchUserProfilePicture;
window.fetchProfilePictureForCurrentUser = fetchProfilePictureForCurrentUser;
window.updateProfilePicture = updateProfilePicture;

// Todo ↘ LOGIN
document.querySelector('.login-area input[type="button"]').addEventListener('click', function () {
    var email = document.querySelector('.login-area input[type="text"]').value;
    var pass = document.querySelector('.login-area input[type="password"]').value;

    sendRuntimeMessage({ command: "auth-login", e: email, p: pass }, (response) => {
        // Check if response is undefined or null
        if (!response) {
            handleFormError("No response received from the server. Please try again.", 'login-error');
            return;
        }

        // Check for type and status properties
        if (response.type === "result") {
            if (response.status === "error") {
                try {
                    // Try to parse the error message if it's a string
                    if (typeof response.message === 'string') {
                        // Check if it's a JSON string
                        if (response.message.startsWith('{')) {
                            const errorObj = JSON.parse(response.message);
                            handleFormError(errorObj.error.message || "Login failed", 'login-error');
                        } else {
                            // It's a regular string
                            handleFormError(response.message, 'login-error');
                        }
                    } else {
                        // It's already an object
                        handleFormError(response.message || "Login failed", 'login-error');
                    }
                } catch (e) {
                    // If parsing fails, just display the raw message
                    handleFormError(response.message || "Login failed", 'login-error');
                }
                pageDisplay(response.data);
            } else if (response.status === "success") {
                // Reload the app
                window.location.reload();
                // Initialize user data
                // initUserData(response.data);
                // hideAllSubFrames();
                // mainMenu();
            }
        } else {
            // Fallback for unexpected response format
            handleFormError("Unexpected response format. Please try again.", 'login-error');
        }
    });
});


/**
 * UTILS
 * @param callback
 */
export function isUserLoggedIn(callback) {
    if (isOnWebsite)
        return localStorage.getItem('currentUser') != null;

    // Use AuthGate for consistent state management
    window.authGate.onAuthReady((user) => {
        if (user) {
            globalUser = user;
            callback(user);
        } else {
            console.warn('User is not logged in');
            const navElement = document.getElementById('main-sub-frame-nav');
            if (navElement) {
                navElement.style.display = 'none';
            }
            callback(null);
        }
    });
}
function initUserData(user) {
    console.warn(`-- initUserData(user)--`);
    console.log("Initializing user data for:", user.email);

    sendRuntimeMessage({
        action: 'fetchUserData',
        userEmail: user.email
    }, (fetchResponse) => {
        console.log("fetchUserData response:", fetchResponse);

        if (fetchResponse && fetchResponse.success) {
            if (fetchResponse.data) {
                const { name, email, ...rest } = fetchResponse.data;
                console.log("User data retrieved:", { name, email });

                // Update UI elements with user data
                updateUserUIElements(name, email);

                // Dispatch login event to update statistics
                document.dispatchEvent(new Event('userLoggedIn'));
            } else {
                console.log("No user data found, this might be a new user");
                // For new users, we might want to show a profile setup screen
                // or use default values

                // Update UI with email only
                updateUserUIElements('', user.email);

                // Dispatch login event with isNewUser flag
                document.dispatchEvent(new CustomEvent('userLoggedIn', {
                    detail: { isNewUser: true }
                }));
            }
        } else {
            console.error('Error fetching user data:', fetchResponse?.error || 'Unknown error');
            // Still update UI with basic user info from auth
            updateUserUIElements('', user.email);
        }
    });
}

// Helper function to update UI elements with user data
function updateUserUIElements(name, email) {
    // Update username elements if name is available
    if (name) {
        const usernameElements = document.getElementsByClassName('username-value');
        Array.from(usernameElements).forEach(element => {
            element.textContent = name;
        });

        // Show profile info, hide username prompt
        // if (document.getElementById('flag-username')) {
        //     document.getElementById('flag-username').style.display = 'none';
        // }
        if (document.getElementById('flag-profile')) {
            document.getElementById('flag-profile').style.display = '';
        }
    } else {
        // Show username prompt, hide profile info
        // if (document.getElementById('flag-username')) {
        //     document.getElementById('flag-username').style.display = '';
        // }
        if (document.getElementById('flag-profile')) {
            document.getElementById('flag-profile').style.display = 'none';
        }
    }

    // Update email elements
    const emailElements = document.getElementsByClassName('email-value');
    Array.from(emailElements).forEach(element => {
        element.textContent = email;
    });
}

// Move validateUsername outside of DOMContentLoaded and make it self-executing
(function setupUsernameValidation() {
    document.addEventListener('DOMContentLoaded', () => {
        return;
       // const flagUsernameDiv = document.getElementById("flag-username");
        if (!flagUsernameDiv) return;

        const submitBtn = flagUsernameDiv.querySelector(".submit-btn");
        const usernameInput = flagUsernameDiv.querySelector('input[type="text"]');
        const errorSpan = document.getElementById('username-error');

        // Add click event listener to the button
        submitBtn.addEventListener("click", (event) => {
            event.preventDefault();
            console.log("Create button clicked"); // Debug log

            const username = usernameInput.value.trim();
            const usernamePattern = /^[a-zA-Z0-9_-]{6,}$/;

            if (!username) {
                handleFormError("Username cannot be empty", 'username-error');
                return;
            }

            if (usernamePattern.test(username)) {
                errorSpan.textContent = '';
                handleValidUsername(username);
                usernameInput.value = '';
            } else {
                const msg = "Invalid username. It must be at least 6 characters and can only contain letters, numbers, underscores (_), or dashes (-).";
                handleFormError(msg, 'username-error');
            }
        });

        // Also add enter key support
        usernameInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitBtn.click();
            }
        });
    });
})();

function handleValidUsername(username) {
    console.warn(`-- handleValidUsername(username = ${username}) --`);

    // Get the current user's email
    const emailLink = document.getElementById("main-user-email").querySelector(".email-link");
    if (!emailLink) {
        console.error("Email link element not found");
        handleFormError("An error occurred. Please try again.", 'username-error');
        return;
    }

    const emailContent = emailLink.textContent;
    console.log("Attempting to update username:", username); // Debug log

    // Set up a listener for the usernameUpdateComplete message
    const usernameUpdateListener = async function (message) {
        console.log("Received message:", message);

        if (message.action === "usernameUpdateComplete") {
            // Remove the listener once we've received the response
            chrome.runtime.onMessage.removeListener(usernameUpdateListener);

            if (message.success) {
                console.log("Username update successful!");

                // Set up a listener for the saveUserDataComplete message
                // const saveDataListener = function(dataMessage) {
                // console.log("Received data message:", dataMessage);

                // if (dataMessage.action === "saveUserDataComplete") {
                // Remove the listener once we've received the response
                // chrome.runtime.onMessage.removeListener(saveDataListener);

                // Save to default project in Firebase
                const companyEmail = await getMainCompanyEmail();
                const userEmail = await getUserEmail();
                if (userEmail == companyEmail) {
                    sendRuntimeMessage({
                        action: "saveFirebaseData",
                        path: `Companies/${companyEmail}/projects/default`,
                        data: {
                            name: "default",
                            created: new Date().toISOString()
                        }
                    }, function (response) {
                        if (!response || !response.success) {
                            console.error("Error saving to Firebase:", response?.error);
                            handleFormError(response?.error || "Failed to save username. Please try again.", 'username-error');
                        }
                    });
                }


                // if (dataMessage.success) {
                console.log("Database update successful!");

                // Update UI
                document.getElementById("main-user-email").innerHTML = `<a class="email-link">${username}</a>`;
                document.getElementById('flag-username').style.display = 'none';
                document.getElementById('flag-profile').style.display = '';

                // Show profile after successful update
                // showProfile();
                //     } else {
                //         console.error("Database update error:", dataMessage.error);
                //         handleFormError(dataMessage.error || "Failed to update profile. Please try again.", 'username-error');
                //     }
                // }
                // };

                // Add the saveDataListener
                // chrome.runtime.onMessage.addListener(saveDataListener);

                // Update the database profile
                // sendRuntimeMessage({
                //     action: 'saveUserData',
                //     userEmail: emailContent,
                //     userData: {
                //         name: username,
                //         email: emailContent
                //     },
                //     projectName: await getCurrentProject()
                // }, function(response) {
                //     console.log("Initial saveUserData response:", response);

                //     // If we get an immediate error, handle it
                //     if (response && response.success === false) {
                //         // Remove the listener since we're handling the error here
                //         chrome.runtime.onMessage.removeListener(saveDataListener);
                //         handleFormError(response.error || "Failed to update profile. Please try again.", 'username-error');
                //     }

                //     // If we don't get a response at all, handle that error
                //     if (!response) {
                //         // Remove the listener since we're handling the error here
                //         chrome.runtime.onMessage.removeListener(saveDataListener);
                //         handleFormError("No response received from the server. Please try again.", 'username-error');
                //     }
                // });
            } else {
                console.error("Username update error:", message.error);
                handleFormError(message.error || "Failed to update username. Please try again.", 'username-error');
            }
        }
    };

    // Add the listener
    chrome.runtime.onMessage.addListener(usernameUpdateListener);

    // First update Firebase Auth display name
    sendRuntimeMessage({
        command: "auth-username",
        newDisplayName: username
    }, function (response) {
        console.log("Initial username update response:", response); // Debug log

        // If we get an immediate error, handle it
        if (response && response.status === "error") {
            // Remove the listener since we're handling the error here
            chrome.runtime.onMessage.removeListener(usernameUpdateListener);
            handleFormError(response.message || "Failed to update username. Please try again.", 'username-error');
        }

        // If we get a processing status, just wait for the usernameUpdateComplete message
        if (response && response.status === "processing") {
            console.log("Username update processing, waiting for completion...");
        }

        // If we don't get a response at all, handle that error
        if (!response) {
            // Remove the listener since we're handling the error here
            chrome.runtime.onMessage.removeListener(usernameUpdateListener);
            handleFormError("No response received from the server. Please try again.", 'username-error');
        }
    });
}

function handleFormError(msg, id) {
    console.warn(`-- handleFormError(msg, id) --`);
    document.getElementById(id).innerHTML = msg;
}
function clearFormError(msg) {
    console.warn(`-- clearFormError(msg, id) --`);
    document.getElementById('login-error').innerHTML = msg;
}

//  Add Username
// document.addEventListener("DOMContentLoaded", () => {
//     const flagUsernameDiv = document.getElementById("flag-username");
//     const submitBtn = flagUsernameDiv.querySelector(".submit-btn");
//
//     // Add click event listener to the button
//     submitBtn.addEventListener("click", (event) => {
//         event.preventDefault(); // Prevent any default form submission
//
//         const usernameInput = flagUsernameDiv.querySelector('input[type="text"]');
//         const usernamePattern = /^[a-zA-Z0-9_-]{6,}$/;
//
//         if (usernamePattern.test(usernameInput.value)) {
//             // Pass the username to another function
//             handleValidUsername(usernameInput.value);
//             usernameInput.value = ''; // Clear the input field
//         } else {
//             const msg = "Invalid username. It must be more than 5 characters and can only contain letters, numbers, underscores (_), or dashes (-).";
//             handleFormError(msg, 'username-error');
//         }
//     });
// });



// Todo ↘ Firebase ???
export function saveUserKeysToDatabase(key, value, prefixProjectName = true) {
    console.warn(`-- saveUserKeysToDatabase(key = ${key}, value = ${value}) --`)
    return new Promise((resolve, reject) => {
        isUserLoggedIn(async (user) => {
            if (user) {
                console.log('saveUserKeysToDatabase ↘ user', user);
                // Prepare the user data with dynamic key
                let data = { [key]: value };
                console.log('data', data);

                // Set up a listener for the saveUserDataComplete message
                const saveDataListener = function (message) {
                    console.log("Received message in saveUserKeysToDatabase:", message);

                    if (message.action === "saveUserDataComplete" && message.userEmail === user.email) {
                        // Remove the listener once we've received the response
                        chrome.runtime.onMessage.removeListener(saveDataListener);

                        if (message.success) {
                            console.log('User data saved successfully.');
                            resolve(true);
                        } else {
                            console.error('Error saving user data:', message.error);
                            reject(new Error(message.error || 'Failed to save user data'));
                        }
                    }
                };

                // Add the listener
                chrome.runtime.onMessage.addListener(saveDataListener);

                // Todo ↘ This code fetches data from firbase ( saveUserData )
                sendRuntimeMessage(
                    {
                        action: 'saveUserData',
                        userEmail: user.email,
                        userData: data,
                        projectName: await getCurrentProject(),
                        prefixProjectName: prefixProjectName
                    },
                    (response) => {
                        // If we get an immediate error, handle it
                        if (response && response.success === false) {
                            // Remove the listener since we're handling the error here
                            chrome.runtime.onMessage.removeListener(saveDataListener);
                            reject(new Error(response.error || 'Failed to save user data'));
                        }

                        // If we don't get a response at all, handle that error
                        if (!response) {
                            // Remove the listener since we're handling the error here
                            chrome.runtime.onMessage.removeListener(saveDataListener);
                            reject(new Error('No response received from the server'));
                        }
                    });
            } else {
                console.log('No user detected!');
                reject(new Error('No user logged in'));
            }
        });
    });
}

export function getAllUserDataDatabase() {
    console.warn(`-- getAllUserDataDatabase()--`);
    return new Promise((resolve, reject) => {
        isUserLoggedIn((user) => {
            if (user) {
                // Set up a listener for the fetchUserDataComplete message
                const fetchDataListener = function (message) {
                    console.log("Received message in getAllUserDataDatabase:", message);

                    if (message.action === "fetchUserDataComplete" && message.userEmail === user.email) {
                        // Remove the listener once we've received the response
                        chrome.runtime.onMessage.removeListener(fetchDataListener);

                        if (message.success) {
                            const { name, email, ...rest } = message.data;
                            console.log('getAllUserDataDatabase: data received');
                            resolve(rest);
                        } else {
                            console.error('Error fetching user data:', message.error);
                            reject(new Error(message.error || 'Failed to fetch user data'));
                        }
                    }
                };

                // Add the listener
                chrome.runtime.onMessage.addListener(fetchDataListener);

                // Todo ↘ This code fetches data from firbase ( fetchUserData )
                sendRuntimeMessage({ action: 'fetchUserData', userEmail: user.email }, (response) => {
                    // If we get an immediate error, handle it
                    if (response && response.success === false) {
                        // Remove the listener since we're handling the error here
                        chrome.runtime.onMessage.removeListener(fetchDataListener);
                        reject(new Error(response.error || 'Failed to fetch user data'));
                    }

                    // If we don't get a response at all, handle that error
                    if (!response) {
                        // Remove the listener since we're handling the error here
                        chrome.runtime.onMessage.removeListener(fetchDataListener);
                        reject(new Error('No response received from the server'));
                    }
                });
            } else {
                console.log('No user detected!');
                reject(new Error('No user logged in'));
            }
        });
    });
}




// sendMessage This will run automatically
// checks to see whether to show the nav.
// sendRuntimeMessage({ command: "user-auth" }, (response) => {
//     console.log(`dp 1`);
//     pageDisplay(response);
// });

// *** Listen for messages
if (!isOnWebsite)
    chrome.runtime.onMessage.addListener((message, sender, resp) => {
        console.log('message', message);
        console.log('sender', sender);
        console.log('resp', resp);

        if (message.command === "auth-username") {
            // Update Firebase Auth display name
            sendRuntimeMessage({
                action: 'updateAuthDisplayName',
                newDisplayName: message.newDisplayName
            }, (response) => {
                if (response && response.success) {
                    resp({ status: "success" });
                } else {
                    resp({
                        status: "error",
                        message: response?.error || "Failed to update display name"
                    });
                }
            });
            return true; // Keep the message channel open for async response
        }

        if (message.action === "saveUserData") {
            // Save to Firebase database
            sendRuntimeMessage({
                action: 'updateUserProfile',
                userEmail: message.userEmail,
                userData: message.userData
            }, (response) => {
                if (response && response.success) {
                    resp({ success: true });
                } else {
                    resp({
                        success: false,
                        error: response?.error || "Failed to save user data"
                    });
                }
            });
            return true; // Keep the message channel open for async response
        }
    });


// Todo ↘ ONLOAD Functions
document.addEventListener('DOMContentLoaded', () => {
    console.warn(`Note App loading...`);
    let loggedIn = false;
    let userData = false;

    // Set up profile picture upload handlers
    setupProfilePictureUpload();

    // Set up invite account handler
    setupInviteAccountHandler();

    isUserLoggedIn((user) => {
        console.log('user 1', user);
        if (user) {
            loggedIn = true;
            userData = user;
            console.log('is user logged in: ', loggedIn);
            const { displayName, email } = user; // only works when username is set
            if (displayName !== '' && displayName !== undefined && displayName !== null) {
                // use username
                console.log('displayName: ', displayName);
                document.getElementById("main-user-email").innerHTML = `<a class="email-link">${displayName}</a>`;
            } else {
                // use email if username has not been set
                console.log('email: ', email);
                document.getElementById("main-user-email").innerHTML = `<a class="email-link">${email}</a>`;
            }

            // Now that the user is logged in, run the dependent functions
            if (loggedIn) {
                console.log('User is logged in, running dependent functions.');
                // Get all user data and reload
                initUserData(userData);
                // Initialize onclick handler on reload
                // validateUsername();
                // Display menu on reload
                console.log('pageDisplay 0');
                pageDisplay(userData);
            }
        }
    });
});

// Helper function to generate a random alphanumeric code
function generateRandomCode(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Function to handle invite account functionality
function setupInviteAccountHandler() {
    const inviteAccountBtn = document.getElementById('invite-account-dropdown-item');
    if (!inviteAccountBtn) return;

    inviteAccountBtn.addEventListener('click', async function () {
        try {
            // Show loading indicator on the button
            const originalContent = this.innerHTML;
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color: #626262;"></i><p>Generating code...</p>';
            this.style.pointerEvents = 'none';

            // Generate a random 8-character alphanumeric code
            const code = generateRandomCode(8);

            // Get company email
            const companyEmail = await getMainCompanyEmail();
            if (!companyEmail) {
                showToast('Error: Could not determine company email', 'error');
                // Reset button
                this.innerHTML = originalContent;
                this.style.pointerEvents = 'auto';
                return;
            }

            // Save to Firebase
            sendRuntimeMessage({
                action: "saveFirebaseData",
                path: `inviteCodes/${code}`,
                data: {
                    companyEmail: companyEmail,
                    createdAt: new Date().toISOString()
                }
            }, async (response) => {
                // Reset button
                this.innerHTML = originalContent;
                this.style.pointerEvents = 'auto';

                if (response && response.success) {
                    // Copy to clipboard
                    try {
                        await navigator.clipboard.writeText(code);
                        showToast(`Invitation code "${code}" copied to clipboard!`, 'success');
                    } catch (err) {
                        console.error('Failed to copy code to clipboard:', err);
                        showToast(`Code created: ${code} (copy manually)`, 'success');
                    }
                } else {
                    console.error('Error saving invite code to Firebase:', response?.error);
                    showToast('Failed to create invitation code', 'error');
                }
            });
        } catch (error) {
            console.error('Error creating invitation code:', error);
            showToast('An error occurred. Please try again.', 'error');
            // Reset button in case of error
            if (this.style.pointerEvents === 'none') {
                this.innerHTML = '<i class="fa-solid fa-user-plus" style="color: #626262;"></i><p>Invite Account</p>';
                this.style.pointerEvents = 'auto';
            }
        }
    });
}

// Separate function to handle profile picture setup
async function setupProfilePictureUpload() {
    const profileInput = document.getElementById('profile-picture-input');
    const profileImage = document.getElementById('profile-image');
    const defaultIcon = document.getElementById('default-profile-icon');

    if (!profileInput || !profileImage || !defaultIcon) {
        console.error('Profile picture elements not found');
        return;
    }

    // Load existing profile picture on initial load
    loadProfileImageFromFirebase();

    profileInput.addEventListener('change', function (e) {
        console.log('File input change detected'); // Debug log
        const file = e.target.files[0];

        if (file) {
            console.log('File selected:', file.name); // Debug log

            // Validate file type
            if (!file.type.match('image.*')) {
                console.error('File is not an image');
                return;
            }

            const reader = new FileReader();

            reader.onload = function (event) {
                console.log('File read successfully'); // Debug log

                profileImage.src = event.target.result;
                console.log('profileImage.src', profileImage.src);
                profileImage.style.display = 'block';
                defaultIcon.style.display = 'none';

                // Update header profile image as well
                const headerProfileImage = document.getElementById('header-profile-image');
                const headerDefaultIcon = document.getElementById('header-default-icon');

                if (headerProfileImage && headerDefaultIcon) {
                    headerProfileImage.src = event.target.result;
                    console.log('headerProfileImage.src', headerProfileImage.src);
                    headerProfileImage.style.display = 'block';
                    headerDefaultIcon.style.display = 'none';
                }

                // Save to Firebase
                saveProfileImageToFirebase(file);
            };

            reader.onerror = function (error) {
                console.error('Error reading file:', error);
            };

            reader.readAsDataURL(file);
        }
    });

    let mainCompanyEmail = await getMainCompanyEmail();
    let email = await getUserEmail();
    let path = `Companies/${mainCompanyEmail}/users/${email}/profileImage`;
    listenerFirebaseData(path, function (path, data) {
        if(localStorage.getItem('userProfilePicture') == null){
            profileImage.src = data;
        }
        console.log('profileImage.src', profileImage.src);
    });

    path = `Companies/${mainCompanyEmail}/users/${email}/name`;
    listenerFirebaseData(path, function (path, data) {
        const usernameElements = document.getElementsByClassName('username-value');
        Array.from(usernameElements).forEach(element => {
            element.textContent = data;
        });
    });
}

// Function to load the profile image from Firebase
export async function loadProfileImageFromFirebase() {
    console.log('Attempting to load profile image from Firebase...');
    const profileImage = document.getElementById('profile-image');
    const defaultIcon = document.getElementById('default-profile-icon');
    const headerProfileImage = document.getElementById('header-profile-image');
    const headerDefaultIcon = document.getElementById('header-default-icon');
    const headerUsername = document.getElementById('header-username');

    console.log('profileImage.src', profileImage.src);


    if (!profileImage || !defaultIcon) {
        console.error('Profile image or default icon elements not found for loading.');
        return;
    }

    isUserLoggedIn(async (user) => {
        if (user) {
            const userEmailFormatted = user.email.replace('.', ',');
            let companyEmail = null;

            try {
                companyEmail = await getMainCompanyEmail();
                if (!companyEmail) {
                    console.warn('Could not determine company email. Cannot load profile image.');
                    // Keep default icon visible
                    profileImage.style.display = 'none';
                    defaultIcon.style.display = 'block';
                    return;
                }
            } catch (error) {
                console.error('Error fetching company email for loading profile image:', error);
                // Keep default icon visible
                profileImage.style.display = 'none';
                defaultIcon.style.display = 'block';
                return;
            }

            // Also update the header username if available
            if (headerUsername) {
                // Try to get the username from Firebase
                sendRuntimeMessage({
                    action: 'getFirebaseData',
                    path: `Companies/${companyEmail}/users/${userEmailFormatted}/name`
                }, (nameResponse) => {
                    if (nameResponse && nameResponse.success && nameResponse.data) {
                        headerUsername.textContent = nameResponse.data;
                    } else if (user.displayName) {
                        headerUsername.textContent = user.displayName;
                    } else {
                        headerUsername.textContent = user.email;
                    }
                });
            }

            const firebasePath = `Companies/${companyEmail}/users/${userEmailFormatted}/profileImage`;

            sendRuntimeMessage({
                action: 'getFirebaseData',
                path: firebasePath
            }, (response) => {
                if(profileImage.src !== '' && profileImage.src !== null && profileImage.src !== undefined){
                    console.log('Profile image already loaded');
                    return;
                }
                if (response && response.success && response.data) {
                    console.log('Profile image data found in Firebase.');
                    profileImage.src = response.data; // Set the image source to the base64 data
                    console.log('profileImage.src', profileImage.src);
                    profileImage.style.display = 'block';
                    defaultIcon.style.display = 'none';

                    // Update header profile image as well
                    if (headerProfileImage && headerDefaultIcon) {
                        headerProfileImage.src = response.data;
                        headerProfileImage.style.display = 'block';
                        headerDefaultIcon.style.display = 'none';
                    }
                } else {
                    console.log('No profile image found in Firebase or error fetching:', response?.error);
                    // Ensure default icon is shown if no image exists
                    profileImage.style.display = 'none';
                    defaultIcon.style.display = 'block';

                    // Update header profile image as well
                    if (headerProfileImage && headerDefaultIcon) {
                        headerProfileImage.style.display = 'none';
                        headerDefaultIcon.style.display = 'none';
                    }
                }
            });
        } else {
            console.log('User not logged in, cannot load profile image.');
            // Ensure default icon is shown if user is not logged in
            profileImage.style.display = 'none';
            defaultIcon.style.display = 'block';

            // Update header profile image as well
            if (headerProfileImage && headerDefaultIcon) {
                headerProfileImage.style.display = 'none';
                headerDefaultIcon.style.display = 'block';
            }
        }
    });
}

// Update the Firebase save function
function saveProfileImageToFirebase(file) {
    isUserLoggedIn(async (user) => {
        if (user) {
            console.log('Attempting to save image to Firebase for user:', user.email);

            const userEmailFormatted = user.email.replace('.', ',');
            let companyEmail = null; // Initialize companyEmail

            // Get the main company email first
            try {
                companyEmail = await getMainCompanyEmail();
                if (!companyEmail) {
                    console.error('Error: Could not determine company email. Cannot save profile image.');
                    showToast('Failed to save profile image: Company email not found.', 'error');
                    return; // Stop execution if company email is not found
                }
            } catch (error) {
                console.error('Error fetching company email:', error);
                showToast('Failed to save profile image: Error getting company info.', 'error');
                return; // Stop execution on error
            }

            // Convert file to base64 for sending through sendRuntimeMessage
            const reader = new FileReader();
            reader.onload = function (e) {
                const base64Image = e.target.result;
                const firebasePath = `Companies/${companyEmail}/users/${userEmailFormatted}/profileImage`;

                sendRuntimeMessage({
                    action: 'saveFirebaseData',
                    path: firebasePath,
                    data: base64Image
                }, (response) => {
                    if (response && response.success) {
                        console.log('Profile image saved successfully via saveFirebaseData');
                        showToast('Profile image updated!', 'success');

                        //Refreshes the profile picture icons above the highlights
                        sendMessageToAllTabs({
                            action: "reloadHighlights"
                        });
                    } else {
                        console.error('Error saving profile image via saveFirebaseData:', response?.error || 'Unknown error');
                        showToast('Failed to save profile image.', 'error');
                    }
                });
            };

            reader.onerror = function (error) {
                console.error('Error converting file to base64:', error);
                showToast('Error processing image file.', 'error');
            };

            reader.readAsDataURL(file);
        } else {
            console.error('Cannot save profile image: No user logged in.');
            showToast('Please log in to save your profile image.', 'error');
        }
    });
}

// Add this function to handle Firebase Auth display name updates
function updateAuthDisplayName(newDisplayName) {
    return new Promise((resolve, reject) => {
        isUserLoggedIn((user) => {
            if (user) {
                // Update Firebase Auth display name
                user.updateProfile({
                    displayName: newDisplayName
                }).then(() => {
                    // Successfully updated display name
                    resolve({ success: true });
                }).catch((error) => {
                    console.error('Error updating display name:', error);
                    reject({
                        success: false,
                        error: error.message
                    });
                });
            } else {
                reject({
                    success: false,
                    error: 'No user logged in'
                });
            }
        });
    });
}

// Add this to your existing message listener
if (!isOnWebsite)
    chrome.runtime.onMessage.addListener((message, sender, resp) => {
        if (message.action === 'updateAuthDisplayName') {
            updateAuthDisplayName(message.newDisplayName)
                .then(response => {
                    resp(response);
                })
                .catch(error => {
                    resp(error);
                });
            return true; // Keep the message channel open for async response
        }
        // ... your other message handlers
    });

// Add these functions near the top with other exports
export function hidePasswordPanel() {
    const passwordEditPanel = document.getElementById('password-edit-panel');
    const changePasswordBtn = document.getElementById('change-password');
    const currentPassword = document.getElementById('current-password');
    const newPassword = document.getElementById('new-password');
    const repeatPassword = document.getElementById('repeat-password');
    const verifyBtn = passwordEditPanel.querySelector('.verify-btn');
    const okBtn = passwordEditPanel.querySelector('.ok-btn');
    const newPasswordFields = passwordEditPanel.querySelector('.new-password-fields');

    // Reset all form fields
    currentPassword.value = '';
    newPassword.value = '';
    repeatPassword.value = '';
    currentPassword.disabled = false;

    // Reset UI state
    changePasswordBtn.classList.remove('active');
    passwordEditPanel.classList.remove('active');
    verifyBtn.style.display = '';
    verifyBtn.classList.remove('loading');
    verifyBtn.disabled = false;
    okBtn.style.display = 'none';
    newPasswordFields.style.display = 'none';

    // Clear any error messages
    const errorDiv = passwordEditPanel.querySelector('.password-error');
    if (errorDiv) {
        errorDiv.remove();
    }
}

// Add this function to handle password verification
export function verifyCurrentPassword(email, password) {
    return new Promise((resolve, reject) => {
        sendRuntimeMessage({
            command: "verify-password",
            email: email,
            password: password
        }, (response) => {
            if (response.success) {
                resolve(true);
            } else {
                reject(new Error(response.error || 'Password verification failed'));
            }
        });
    });
}

// Add this function to handle password updates
export function updateUserPassword(newPassword) {
    return new Promise((resolve, reject) => {
        sendRuntimeMessage({
            command: "update-password",
            newPassword: newPassword
        }, (response) => {
            if (response.success) {
                resolve(true);
            } else {
                reject(new Error(response.error || 'Password update failed'));
            }
        });
    });
}

// Add this near the top of the file with other exports
export function checkPasswordStrength(password) {
    const criteria = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    // Calculate score based on met criteria
    const score = Object.values(criteria).filter(Boolean).length;

    // Determine strength level
    let strength = 'weak';
    if (score >= 4) strength = 'strong';
    else if (score >= 2) strength = 'medium';

    return {
        strength,
        criteria
    };
}

// Add this function to update the UI based on password strength
function updatePasswordStrengthUI(result) {
    const meterFill = document.querySelector('.strength-meter-fill');
    const strengthText = document.querySelector('.strength-text');
    const suggestions = document.querySelectorAll('.suggestion-item');

    // Update strength meter
    meterFill.className = 'strength-meter-fill ' + result.strength;
    strengthText.textContent = result.strength;

    // Update suggestions
    suggestions.forEach(item => {
        const requirement = item.dataset.requirement;
        const icon = item.querySelector('i');

        if (result.criteria[requirement]) {
            item.classList.remove('unmet');
            item.classList.add('met');
            icon.className = 'fas fa-check-circle';
        } else {
            item.classList.remove('met');
            item.classList.add('unmet');
            icon.className = 'fas fa-circle';
        }
    });
}

// Update the DOMContentLoaded event listener for password strength
document.addEventListener('DOMContentLoaded', () => {
    const signupPassword = document.getElementById('signup-password');
    const strengthMeter = document.querySelector('.password-strength-meter');

    if (signupPassword && strengthMeter) {
        // Initially hide the strength meter
        strengthMeter.style.display = 'none';

        // Show meter on focus
        signupPassword.addEventListener('focus', () => {
            strengthMeter.style.display = 'block';
        });

        // Hide meter on blur if empty
        signupPassword.addEventListener('blur', () => {
            if (!signupPassword.value) {
                strengthMeter.style.display = 'none';
            }
        });

        // Update strength on input
        signupPassword.addEventListener('input', (e) => {
            const result = checkPasswordStrength(e.target.value);
            updatePasswordStrengthUI(result);
            // Keep meter visible while there's input
            strengthMeter.style.display = 'block';
        });
    }
});

// Add these functions to handle data migration and clearing

async function clearLocalStorageOnLogin() {
    // Save temporary copy of data
    const tempData = {
        annotationHistory: await chrome.storage.local.get('annotationHistory'),
        customLabelsAndCodes: await chrome.storage.local.get('customLabelsAndCodes'),
        // Add other important data keys here
    };

    // Clear all local storage
    localStorage.clear();

    return tempData;
}

async function handleUserLogin(user) {
    // First, get existing local data before clearing
    const localData = await clearLocalStorageOnLogin();

    // If there's existing data, ask user what to do with it
    if (localData.annotationHistory || localData.customLabelsAndCodes) {
        const keepData = confirm(
            "Would you like to keep your existing annotations and transfer them to your account? " +
            "Click OK to keep and merge with your account data, or Cancel to start fresh."
        );

        if (keepData) {
            // Merge with user's cloud data
            mergeDataWithCloud(localData, user.email);
        }
        // If user chooses not to keep data, it's already cleared
    }

    // Load user's data from cloud
    loadUserData(user.email);
}

async function mergeDataWithCloud(localData, userEmail) {
    try {
        // Get existing cloud data
        const cloudData = await getAllUserDataDatabase(userEmail);

        // Merge annotation history
        if (localData.annotationHistory) {
            const localAnnotations = JSON.parse(localData.annotationHistory);
            const cloudAnnotations = cloudData.annotationHistory ? JSON.parse(cloudData.annotationHistory) : [];

            // Combine arrays and remove duplicates
            const mergedAnnotations = [...cloudAnnotations, ...localAnnotations];

            // Save merged data back to cloud and local storage
            await saveUserKeysToDatabase(userEmail, {
                annotationHistory: JSON.stringify(mergedAnnotations)
            });
            chrome.storage.local.set({ 'annotationHistory': JSON.stringify(mergedAnnotations) });
        }

        // Handle other data types similarly
        if (localData.customLabelsAndCodes) {
            // Merge custom labels and codes
            const localCustom = JSON.parse(localData.customLabelsAndCodes);
            const cloudCustom = cloudData.customLabelsAndCodes ? JSON.parse(cloudData.customLabelsAndCodes) : [];

            const mergedCustom = [...cloudCustom, ...localCustom];

            await saveUserKeysToDatabase(userEmail, {
                customLabelsAndCodes: JSON.stringify(mergedCustom)
            });
            chrome.storage.local.set({ 'customLabelsAndCodes': JSON.stringify(mergedCustom) });
        }
    } catch (error) {
        console.error('Error merging data:', error);
        showToast('Error merging data. Some data may be lost.', 'error');
    }
}

async function loadUserData(userEmail) {
    try {
        const userData = await getAllUserDataDatabase(userEmail);

        // Load data into localStorage
        if (userData.annotationHistory) {
            chrome.storage.local.set({ 'annotationHistory': userData.annotationHistory });
        }
        if (userData.customLabelsAndCodes) {
            chrome.storage.local.set({ 'customLabelsAndCodes': userData.customLabelsAndCodes });
        }
        // Add other data types as needed

    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading your data. Please try logging in again.', 'error');
    }
}

// Update your existing login handler to use these functions
export async function onLoginSuccess(user) {
    await handleUserLogin(user);
    // ... rest of your login success code
}

// Add a logout handler if you don't have one
export function onLogout() {
    // Clear local storage
    localStorage.clear();
    // ... rest of your logout code
}

// Add this function to your auth.js
export function handleNewUserSignup(userEmail) {
    // Dispatch event with isNewUser flag
    document.dispatchEvent(new CustomEvent('userLoggedIn', {
        detail: {
            isNewUser: true,
            userEmail: userEmail
        }
    }));
}

// Modify your existing signup function
export function signUp(email, password) {
    sendRuntimeMessage({
        command: "signup",
        email: email,
        password: password
    }, function (response) {
        if (response.success) {
            // Call the new handler for new user signup
            handleNewUserSignup(email);

            // Update UI and other existing logic...
            updateUIForLoggedInUser(response.user);
        } else {
            console.error('Signup failed:', response.error);
            // Handle error...
        }
    });
}

// Modify your existing login function
export function login(email, password) {
    sendRuntimeMessage({
        command: "login",
        email: email,
        password: password
    }, function (response) {
        if (response.success) {
            // Regular login event without isNewUser flag
            document.dispatchEvent(new CustomEvent('userLoggedIn', {
                detail: {
                    isNewUser: false,
                    userEmail: email
                }
            }));

            // Update UI and other existing logic...
            updateUIForLoggedInUser(response.user);
        } else {
            console.error('Login failed:', response.error);
            // Handle error...
        }
    });
}

export async function setCurrentProject(projectName) {
    try {
        localStorage.setItem("currentProject", projectName);
        return true;
    } catch (error) {
        console.error('Error setting current project:', error);
        return false;
    }
}

export async function getUserName() {
    try {
        // const result = await chrome.storage.local.get('authInfo');
        const result = firebase.auth().currentUser;
        if (result && result.displayName) {
            return result.displayName;
        }
        return null;
    } catch (error) {
        console.error('Error getting user name:', error);
        return null;
    }
}

export async function getMainCompanyEmail() {
    // Always check for sharedCompanyEmail first (when viewing a shared project)
    // This ensures messages are saved to the project owner's company, not the current user's
    try {
        // Try to access localStorage - works in iframe/website context
        if (typeof localStorage !== 'undefined') {
            const sharedCompanyEmail = localStorage.getItem("sharedCompanyEmail");
            const sharedProjectId = localStorage.getItem("sharedProjectId");
            const currentProject = localStorage.getItem("currentProject");
            
            // Only use sharedCompanyEmail if we're viewing that specific shared project
            if (sharedCompanyEmail && sharedProjectId && currentProject && sharedProjectId === currentProject) {
                return sharedCompanyEmail;
        }
        }
    } catch (e) {
        // localStorage might not be accessible in some contexts, continue to fallback
    }
    
    if (isOnWebsite) {
        return localStorage.getItem("companyEmail");
}
    
    try {
        const email = await getUserEmail();
        if (!email) return null;

        console.log("emailToCompanyDirectory/" + email.replace(".", ","));
        return new Promise((resolve, reject) => {
            sendRuntimeMessage({
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

export async function isUserLoggedIn2() {
    if (isOnWebsite)
        return localStorage.getItem('currentUser') != null;

    try {
        // Use AuthGate for consistent state checking
        await window.authGate.initialize();
        return window.authGate.isAuthenticated();
    } catch (error) {
        console.error('Error checking login status:', error);
        return false;
    }
}

document.getElementById("password-verify-btn").addEventListener('click', async () => {
    const passwordEditPanel = document.getElementById('password-edit-panel');
    const currentPassword = document.getElementById("current-password");
    const newPasswordFields = passwordEditPanel.querySelector('.new-password-fields');
    const verifyBtn = passwordEditPanel.querySelector('.verify-btn');
    const okBtn = passwordEditPanel.querySelector('.ok-btn');
    const errorDiv = passwordEditPanel.querySelector('.password-error') || (() => {
        const div = document.createElement('div');
        div.className = 'password-error';
        passwordEditPanel.appendChild(div);
        return div;
    })();
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    // Disable verify button and show loading
    verifyBtn.disabled = true;
    verifyBtn.classList.add('loading');

    // Get user email
    let email = null;
    try {
        email = await getUserEmail();
        if (!email) throw new Error('Could not get user email');
    } catch (e) {
        errorDiv.textContent = 'Error: Could not get user email.';
        errorDiv.style.display = 'block';
        verifyBtn.disabled = false;
        verifyBtn.classList.remove('loading');
        return;
    }

    // Verify current password
    verifyCurrentPassword(email.replace(/,/g, '.'), currentPassword.value)
        .then(() => {
            // Success: show new password fields and ok button
            currentPassword.disabled = true;
            newPasswordFields.style.display = '';
            okBtn.style.display = '';
            verifyBtn.style.display = 'none';
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        })
        .catch((err) => {
            errorDiv.textContent = err.message || 'Incorrect current password.';
            errorDiv.style.display = 'block';
        })
        .finally(() => {
            verifyBtn.disabled = false;
            verifyBtn.classList.remove('loading');
        });
});

// Add handler for ok-btn to update password
const passwordEditPanel = document.getElementById('password-edit-panel');
if (passwordEditPanel) {
    const okBtn = passwordEditPanel.querySelector('.ok-btn');
    if (okBtn) {
        okBtn.addEventListener('click', async () => {
            const newPassword = document.getElementById("new-password");
            const repeatPassword = document.getElementById("repeat-password");
            const currentPassword = document.getElementById("current-password");
            const errorDiv = passwordEditPanel.querySelector('.password-error') || (() => {
                const div = document.createElement('div');
                div.className = 'password-error';
                passwordEditPanel.appendChild(div);
                return div;
            })();
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';

            // Validate new password fields
            if (!newPassword.value || !repeatPassword.value) {
                errorDiv.textContent = 'Please enter and repeat your new password.';
                errorDiv.style.display = 'block';
                return;
            }
            if (newPassword.value !== repeatPassword.value) {
                errorDiv.textContent = 'New passwords do not match.';
                errorDiv.style.display = 'block';
                return;
            }
            // Check password strength
            const strengthResult = checkPasswordStrength(newPassword.value);
            if (strengthResult.strength === 'weak') {
                errorDiv.textContent = 'Please choose a stronger password.';
                errorDiv.style.display = 'block';
                return;
            }
            // Update password
            okBtn.disabled = true;
            okBtn.textContent = 'Updating...';
            updateUserPassword(newPassword.value)
                .then(() => {
                    showToast('Password updated successfully!', 'success');
                    hidePasswordPanel();
                })
                .catch((err) => {
                    errorDiv.textContent = err.message || 'Failed to update password.';
                    errorDiv.style.display = 'block';
                })
                .finally(() => {
                    okBtn.disabled = false;
                    okBtn.textContent = 'Change Password';
                });
        });
    }
}
