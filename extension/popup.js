


import { isUserLoggedIn, getUserName } from './partials/auth.js';
import { showFrame, hideAllSubFrames } from './partials/utils.js';
import { showProfile } from './partials/auth.js';
import { isOnWebsite } from './globalVariables.js';
import './partials/annotation-history.js';
import './messaging.js';
import './partials/voice-annotation.js'
// Initialize statistics manager
// const statisticsManager = new StatisticsManager();
// statisticsManager.startPeriodicUpdates();

// Initialize project manager
// const projectManager = new ProjectManager();

// Add this to your existing event listeners where labels/codes are added
// document.addEventListener('labelAdded', async () => {
//     await statisticsManager.recordAnnotation('label');
// });

// document.addEventListener('codeAdded', async () => {
//     await statisticsManager.recordAnnotation('code');
// });

/**
 * Router Guard - Handles navigation based on auth state
 */
class RouterGuard {
    constructor() {
        this.currentRoute = null;
        this.pendingNavigation = null;
    }

    // Guard route navigation until auth is ready
    guardedNavigate(targetRoute, callback) {
        console.log('[RouterGuard] Guarded navigate to:', targetRoute);
        
        window.authGate.guardRoute((user, profileData) => {
            console.log('[RouterGuard] Auth ready, user:', user ? user.email : 'null');
            
            if (user) {
                // User is authenticated, proceed to target route or profile
                this.navigateToProfile(user, profileData, callback);
            } else {
                // User is not authenticated, show login
                this.navigateToAuth(callback);
            }
        });
    }

    navigateToProfile(user, profileData, callback) {
        console.log('[RouterGuard] Navigating to profile for:', user.email);
        this.currentRoute = 'profile';
        
        // Ensure profile UI is ready before showing
        if (profileData || window.authGate.isReady()) {
            callback('profile', user, profileData);
        } else {
            // Wait for profile to be ready
            window.authGate.onProfileReady((profileData) => {
                callback('profile', user, profileData);
            });
        }
    }

    navigateToAuth(callback) {
        console.log('[RouterGuard] Navigating to auth (login)');
        this.currentRoute = 'auth';
        callback('auth', null, null);
    }

    // Handle profile icon tap with idempotent behavior
    handleProfileIconTap() {
        console.log('[RouterGuard] Profile icon tapped');
        
        this.guardedNavigate('profile', (route, user, profileData) => {
            if (route === 'profile') {
                showProfileSettings(user, profileData);
            } else if (route === 'auth') {
                showAuthScreen();
            }
        });
    }
}

// Function to update the header username display
async function updateHeaderUsername() {
    try {
        const headerUsernameElement = document.getElementById('header-username');
        if (!headerUsernameElement) return;

        // Use AuthGate for consistent state
        window.authGate.onProfileReady((profileData) => {
            if (profileData) {
                const displayName = profileData.username || profileData.displayName || profileData.email;
                headerUsernameElement.textContent = displayName || '';
            } else {
                headerUsernameElement.textContent = '';
            }
        });

    } catch (error) {
        console.error("Error updating header username:", error);
    }
}

// Show profile settings page
function showProfileSettings(user, profileData) {
    console.log('[RouterGuard] Showing profile settings');
    
    // Hide auth frames
    hideAllSubFrames();
    
    // Show profile frames
    showFrame("profile-sub-frame");
    showFrame("auth-sub-frame");
    
    // Update profile display with latest data
    if (typeof updateProfileUI === 'function') {
        updateProfileUI(user);
    }
    
    // Show profile information
    if (typeof showProfile === 'function') {
        showProfile();
    }
}

// Show authentication screen
function showAuthScreen() {
    console.log('[RouterGuard] Showing auth screen');
    
    // Clear any existing profile state
    if (typeof clearProfileUI === 'function') {
        clearProfileUI();
    }
    
    // Hide all frames
    hideAllSubFrames();
    
    // Show login controller
    showFrame("login-controller");
}

// Create global router guard instance
const routerGuard = new RouterGuard();

// Connect the new profile page buttons to the existing functionality
document.addEventListener('DOMContentLoaded', function () {
    console.log('[Popup] DOM loaded, initializing...');
    
    // Initialize AuthGate and wait for auth state
    initializeApp();
});

async function initializeApp() {
    try {
        console.log('[Popup] Initializing app...');
        
        // Wait for AuthGate to be ready
        await window.authGate.initialize();
        
        // Set up UI and event listeners
        setupEventListeners();
        
        // Update header username
        updateHeaderUsername();
        
        // Determine initial route based on auth state
        routerGuard.guardedNavigate('initial', (route, user, profileData) => {
            console.log('[Popup] Initial route determined:', route);
            
            if (route === 'profile') {
                // User is authenticated, show profile by default
                showProfileSettings(user, profileData);
            } else {
                // User is not authenticated, show login
                showAuthScreen();
            }
        });
        
    } catch (error) {
        console.error('[Popup] Error initializing app:', error);
        // Fallback to login screen on error
        showAuthScreen();
    }
}

function setupEventListeners() {
    const profileLogoutBtn = document.getElementById('profile-logout-btn');
    const profileInviteAccountBtn = document.getElementById('profile-invite-account-btn');

    // Listen for auth state changes to update the username
    if (!isOnWebsite) {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === "usernameUpdateComplete" && message.success) {
                updateHeaderUsername();
            }
        });
    }

    // Set up profile icon tap handler
    const profileIcon = document.querySelector('.profile-icon, .profile-picture-placeholder, #profile-image-container');
    if (profileIcon) {
        profileIcon.addEventListener('click', function(e) {
            e.preventDefault();
            routerGuard.handleProfileIconTap();
        });
    }

    // Set up main user email tap handler (if it exists)
    const mainUserEmail = document.getElementById('main-user-email');
    if (mainUserEmail) {
        mainUserEmail.addEventListener('click', function(e) {
            e.preventDefault();
            routerGuard.handleProfileIconTap();
        });
    }

    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener('click', function () {
            // Trigger the same functionality as the original logout button
            const originalLogoutBtn = document.querySelector('.logged-in .dropdown-item');
            if (originalLogoutBtn) {
                originalLogoutBtn.click();
            }
        });
    }

    if (profileInviteAccountBtn) {
        profileInviteAccountBtn.addEventListener('click', function () {
            // Trigger the same functionality as the original invite account button
            const originalInviteBtn = document.getElementById('invite-account-dropdown-item');
            if (originalInviteBtn) {
                originalInviteBtn.click();
            }
        });
    }
}

// Additional code to ensure dropdown never appears on home screen
document.addEventListener('DOMContentLoaded', function () {
    // Override the toggle functionality to prevent the dropdown from showing
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
        // Remove any existing click listeners
        const newToggle = dropdownToggle.cloneNode(true);
        dropdownToggle.parentNode.replaceChild(newToggle, dropdownToggle);
    }

    // Ensure the dropdown menu never appears
    const dropdownMenu = document.querySelector('.nav-dropdown-menu');
    if (dropdownMenu) {
    // Override the display style with !important
    dropdownMenu.style.cssText = 'display: none !important; visibility: hidden !important;';
    }


});

