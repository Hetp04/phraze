import { mainMenu } from "../frames.js";
import { showFrame, hideAllSubFrames } from "./utils.js";
import { showProfile, isUserLoggedIn, hidePasswordPanel, verifyCurrentPassword, updateUserPassword } from "./auth.js";

// Wrap initialization code in a function to avoid illegal return statement
function initializeLoginComponents() {
    const userIconButton = document.getElementById("userIcon");
    if (!userIconButton)
        return;
    userIconButton.addEventListener("click", toggleProfileMenuDisplay);

    const settingsIconButton = document.getElementById("userSettings");
    settingsIconButton.addEventListener("click", showSettingsDisplay);

    const backIconButton = document.getElementById("userBackIcon");
    backIconButton.addEventListener("click", () => {
        hideAllSubFrames();
        console.log("Showing main menu from backIcon");
        mainMenu();
    });

    const backSettingsButton = document.getElementById("backSettings");
    backSettingsButton.addEventListener("click", mainMenu);

    document.getElementById('loginBtn').addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        showForm('loginForm');
        this.classList.add('active');
        document.getElementById('signupBtn').classList.remove('active');
    });

    document.getElementById('signupBtn').addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        showForm('signupForm');
        this.classList.add('active');
        document.getElementById('loginBtn').classList.remove('active');
    });

    document.getElementById("create-an-account").addEventListener('click', function (e) {
        document.getElementById('signupBtn').click();
    });

    document.addEventListener('DOMContentLoaded', () => {
        // ... existing code ...

        setupPasswordChangeHandlers();
    });

}

export function showForm(id) {
    document.getElementById('loginForm').classList.remove('active-form');
    document.getElementById('signupForm').classList.remove('active-form');
    document.getElementById('forgotPasswordForm').classList.remove('active-form');

    document.getElementById(id).classList.add('active-form');
}

// Call the initialization function
initializeLoginComponents();

export function toggleProfileMenuDisplay() {
    console.log('-- toggleMainMenuDisplay() -- ')
    hideAllSubFrames();
    showFrame("login-controller");
    isUserLoggedIn((user) => {
        if (user) {
            showProfile();
            showFrame("profile-sub-frame");
            document.getElementById('flag-profile').style.display = '';
        } else {
            showFrame("auth-sub-frame");
            const loginBtn = document.getElementById('loginBtn');
            const signupBtn = document.getElementById('signupBtn');
            if (signupBtn.classList.contains('active')) {
                showForm('signupForm');
            } else {
                showForm('loginForm');
            }
        }
    });
    showFrame("login-icon-back-sub-frame");
}

function showSettingsDisplay() {
    console.log('-- showSettingsDisplay() -- ')
    hideAllSubFrames();
    showFrame("settings-sub-frame");
    showFrame("settings-icon-back-sub-frame");
}



export function showPasswordChangePanel() {
    const passwordEditPanel = document.getElementById('password-edit-panel');
    const changePasswordBtn = document.getElementById('change-password');

    if (changePasswordBtn && passwordEditPanel) {
        changePasswordBtn.classList.add('active');
        passwordEditPanel.classList.add('active');
        document.getElementById('current-password')?.focus();
    }
}

function setupPasswordChangeHandlers() {
    const changePasswordBtn = document.getElementById('change-password');
    const cancelBtn = document.querySelector('#password-edit-panel .cancel-btn');

    // Show panel when clicking change password button
    changePasswordBtn?.addEventListener('click', showPasswordChangePanel);

    // Hide panel when clicking cancel
    cancelBtn?.addEventListener('click', hidePasswordPanel);

    // Hide panel when clicking outside
    document.addEventListener('click', (e) => {
        const passwordEditPanel = document.getElementById('password-edit-panel');
        if (passwordEditPanel?.classList.contains('active') &&
            !passwordEditPanel.contains(e.target) &&
            !changePasswordBtn?.contains(e.target)) {
            hidePasswordPanel();
        }
    });

    // Hide panel on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('password-edit-panel')?.classList.contains('active')) {
            hidePasswordPanel();
        }
    });
}

