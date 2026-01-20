/**
 *  MAIN MENU  <p>
 *      A. Annotation System
 *        1. Add Label
 *        2. Add Code
 *        3. Note Board
 *        4. Voice Annotation
 *        5. Back <br>
 *      B. Annotation History <br>
 *      C. Clear Data
 */

// Import the function from utils.js
import { hideFrame, customFrameMenu, showFrame, showFrameLabel, showFrameAndDisplay, hideAllSubFrames } from './partials/utils.js';
import { isUserLoggedIn, saveUserKeysToDatabase, getAllUserDataDatabase, getMainCompanyEmail, isUserLoggedIn2, setCurrentProject } from './partials/auth.js';
import { createObject, deleteItemByKey, updateObjectByKey } from './partials/local-storage.js';
import { getTextURL } from "./partials/highlight.js";
import { StatisticsManager } from './partials/statistics.js';
import { FrequentlyUsedManager } from './partials/frequently-used.js';
import { toggleProfileMenuDisplay, showForm } from './partials/login.js';
import { ProjectManager } from './partials/project-manager.js';
import { isOnWebsite } from './globalVariables.js'

// import { resolve } from 'chart.js/helpers';

var fileUploadInstantReturn = null;

export function sendMessageToAllTabs(message) {
    if (isOnWebsite) {
        window.parent.postMessage(message, "*");
    } else {
        chrome.tabs.query({}, function (tabs) {
            for (let tab of tabs) {
                chrome.tabs.sendMessage(tab.id, message);
            }
        });
    }
}

export function sendRuntimeMessage(message, response) {
    if (isOnWebsite) {
        message.requestID = new Date().toISOString();
        window.parent.postMessage(message, "*");
        if (response) {
            function handleRuntimeMessage(event) {
                if (event.data.requestID == message.requestID) {
                    response({ success: true, data: event.data.data });
                    window.removeEventListener('message', handleRuntimeMessage);
                }
            }
            window.addEventListener('message', handleRuntimeMessage);
        }
    } else {
        chrome.runtime.sendMessage(message, response);
    }
}

var pathToFunctionMap = new Map();
export function listenerFirebaseData(path, func) {
    pathToFunctionMap.set(path, func);
    sendRuntimeMessage({
        action: "listenerFirebaseData",
        path: path
    }, response => {
        if (response && response.success) {
            console.log("Firebase listener set up successfully");
        } else {
            console.error("Failed to set up Firebase listener");
        }
    });
}

export function removeFirebaseListener(path) {
    pathToFunctionMap.delete(path);
    sendRuntimeMessage({
        action: "removeFirebaseListener",
        path: path
    }, response => {
        if (response && response.success) {
            console.log("Firebase listener removed successfully");
        } else {
            console.error("Failed to remove Firebase listener");
        }
    });
}

async function handleIframeMessages(event) {
    if (event.data.action == "changeProject") {
        setCurrentProject(localStorage.getItem("currentProject"));
    }
    else if (event.data.action == "updateSelectedText") {
        selectedText = event.data.text || "";
        SELECTED_TEXT = selectedText;
    }
    else if (event.data.action == "firebaseDataChanged") {
        console.log('📨 Frames (iframe): Received firebaseDataChanged for path:', event.data.path);
        if (pathToFunctionMap.has(event.data.path)) {
            console.log('✅ Frames (iframe): Calling callback for path:', event.data.path);
            pathToFunctionMap.get(event.data.path)(event.data.path, event.data.data);
        } else {
            console.warn('⚠️ Frames (iframe): No callback registered for path:', event.data.path);
        }
    }
    else if (event.data.action == "downloadFullPageScreenshot") {
        downloadScreenshot(event.data.dataUrl);
    }
    else if (event.data.action == "screenshotShortcut") {

        let index = event.data.type;
        var manualLoggingDiv = document.getElementById("screenshot-options-message");
        if (manualLoggingDiv.style.display == "block") { //Manual logging category has already been selected

        }
        else {
            var list = document.getElementById("category-list");
            //Need to manually add a category first
            if (list.childNodes.length == 0) {
                document.getElementById("category-input").value = "Default";
                document.getElementById("add-category-btn").click();
                currentCategory = "Default";
                showScreenshotOptions(currentCategory);
            }
            else {
                list.childNodes[0].click(); //Select the first category
            }
        }
        if (index == "0") {
            document.getElementById("capture-visible").click();
        }
        else if (index == "1") {
            document.getElementById("capture-area").click();
        }
        else if (index == "2") {
            document.getElementById("capture-fullpage").click();
        }
    }
}

window.addEventListener('message', handleIframeMessages);

if (isOnWebsite) {
    document.getElementById("project-selector").style.display = "none";
    document.getElementById("main-header").style.display = "none";
}
else {
    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        if (request.action == "firebaseDataChanged") {
            console.log('📨 Frames: Received firebaseDataChanged for path:', request.path);
            if (pathToFunctionMap.has(request.path)) {
                console.log('✅ Frames: Calling callback for path:', request.path);
                pathToFunctionMap.get(request.path)(request.path, request.data);
            } else {
                console.warn('⚠️ Frames: No callback registered for path:', request.path);
            }
        }
    });
}

// Add project management functions
export function     getCurrentProject() {
    if(localStorage.getItem("sharedCurrentProject"))
    {
        return localStorage.getItem("sharedCurrentProject");
    }

    const result = localStorage.getItem('currentProject');
    return result || 'default';
}

/**
 * Shows a toast notification message
 * @param {string} message - The message to display
 * @param {string} type - The type of toast ('success' or 'error')
 */
export function showToast(message, type) {
    // Remove any existing toasts
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast with animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Hide and remove toast after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Create an instance of StatisticsManager if you haven't already
const statisticsManager = new StatisticsManager();

// Initialize the FrequentlyUsedManager
const frequentlyUsedManager = new FrequentlyUsedManager();

// Add this at the top of frames.js, outside any functions
let currentCategory = '';

// Create a single instance of ProjectManager that can be used throughout
const projectManager = new ProjectManager();

// Load saved data when the page loads
document.addEventListener('DOMContentLoaded', async () => {

    // --- Add Migration Logic ---
    // try {
    //     const customDataRaw = await callGetItem("customLabelsAndCodes", false); // Get raw data without project prefix for migration check
    //     if (customDataRaw) {
    //         let customData = Object.values(customDataRaw)[0];
    //         // Check if it's an array (old format)
    //         if (Array.isArray(customData)) {
    //             console.log("Migrating customLabelsAndCodes format...");
    //             const newFormat = {};
    //             customData.forEach(item => {
    //                 const key = Object.keys(item)[0];
    //                 if (key && item[key] && Array.isArray(item[key]) && item[key].length === 2) {
    //                     // Check if the structure matches the expected old format
    //                     const optionsObj = item[key].find(obj => obj.hasOwnProperty('options'));
    //                     const keyTypeObj = item[key].find(obj => obj.hasOwnProperty('keyType'));

    //                     if (optionsObj && keyTypeObj) {
    //                         newFormat[key] = {
    //                             options: optionsObj.options || [],
    //                             keyType: keyTypeObj.keyType
    //                         };
    //                     } else {
    //                         console.warn(`Skipping migration for item with unexpected structure: ${key}`);
    //                     }
    //                 } else {
    //                     console.warn(`Skipping migration for item with unexpected structure: ${key}`);
    //                 }
    //             });
    //             // Save the converted data (using the correct project-prefixed key via callSetItem)
    //             await callSetItem("customLabelsAndCodes", newFormat);
    //             console.log("Migration complete.");
    //         }
    //     }
    // } catch (error) {
    //     console.error("Error during customLabelsAndCodes migration:", error);
    // }
    // --- End Migration Logic ---

    var projectInitialized = localStorage.getItem("initialized");
    if (projectInitialized == null) {
        localStorage.setItem("currentProject", "default");
        if (!isOnWebsite)
            chrome.storage.local.set({ "projects": { "default": { name: "default" } } });
        localStorage.setItem("initialized", "true");
    }
    console.log("Initialized", projectInitialized);

    console.log('Loading frequently used data...');
    frequentlyUsedManager.loadSavedData();
    if (isOnWebsite) {
        hideSplashScreen();
    }
    else {
        let splashScreenTimer;
        const getStartedBtn = document.querySelector('.get-started-btn');
        const continueBtn = document.querySelector('.continue-btn');

        if (getStartedBtn) {
            getStartedBtn.addEventListener('click', () => {
                // Clear the timer immediately
                if (splashScreenTimer) {
                    clearTimeout(splashScreenTimer);
                    splashScreenTimer = null;
                }

                // Pre-set signup tab before animation starts
                const loginBtn = document.getElementById('loginBtn');
                const signupBtn = document.getElementById('signupBtn');
                if (loginBtn) loginBtn.classList.remove('active');
                if (signupBtn) signupBtn.classList.add('active');

                // Hide login form and show signup form before animation
                showForm('loginForm');

                hideSplashScreen();
                // Delay showing the profile menu until after the slide animation
                setTimeout(() => {
                    toggleProfileMenuDisplay();
                }, 700);
            });
        }

        if (continueBtn) {
            continueBtn.addEventListener('click', async () => {
                // Clear the timer immediately
                if (splashScreenTimer) {
                    clearTimeout(splashScreenTimer);
                    splashScreenTimer = null;
                }

                hideSplashScreen();
                console.log("Showing main menu from continue button");
                
                // Ensure AuthGate is initialized before proceeding
                if (window.authGate) {
                    await window.authGate.initialize();
                }
                
                mainMenu();
            });
        }

        // Set the timer but store the timeout ID
        splashScreenTimer = setTimeout(async () => {
            // Only proceed if the timer hasn't been cleared
            if (splashScreenTimer) {
                hideSplashScreen();
                console.log("Showing main menu from splash screen timer");
                
                // Ensure AuthGate is initialized before proceeding
                if (window.authGate) {
                    await window.authGate.initialize();
                }
                
                mainMenu();
            }
        }, 8000);
    }
    // Show current project toast notification
    let projectName = getCurrentProject();
    setTimeout(() => {
        showToast(`Current Project: ${projectName}`, 'success');
    }, 3000);
    var projectsData = null;
    if (await isUserLoggedIn2()) {
        // Get user's email and fetch their projects
        const companyEmail = await getMainCompanyEmail();
        projectsData = await new Promise((resolve) => {
            sendRuntimeMessage({
                action: "getFirebaseData",
                path: `Companies/${companyEmail}/projects`
            }, response => {
                if (response && response.success && response.data) {
                    resolve(response.data);
                }
                resolve(null);
            });
        });
    }
    else {
        projectsData = await chrome.storage.local.get("projects");
        if (projectsData.projects != undefined)
            projectsData = projectsData.projects;
    }
    const projectsHeaderEl = document.getElementById("projects-header");
    if (projectsHeaderEl) {
        if (projectsData == null || Object.keys(projectsData).length < 2) {
            projectsHeaderEl.style.display = "none";
        } else {
            projectsHeaderEl.style.display = "";
        }
    }
    const projectsContainer = document.getElementById('project-flexbox');
    if (!projectsContainer) return; // guard against null per error report
    projectsContainer.innerHTML = ''; // Clear existing content
    // Add default project if it doesn't exist
    // Ensure projectsData is an object, not a string
    if (projectsData == null || typeof projectsData !== 'object' || Array.isArray(projectsData)) {
        projectsData = {};
    }
    // If it's a string, try to parse it
    if (typeof projectsData === 'string') {
        try {
            projectsData = JSON.parse(projectsData);
        } catch (e) {
            projectsData = {};
        }
    }
    if (!projectsData.hasOwnProperty('default')) {
        projectsData['default'] = {
            name: 'default',
            createdAt: new Date().toISOString()
        };
    }
    // Create project boxes
    Object.keys(projectsData).forEach(projectId => {
        if (Object.keys(projectsData).length > 1) {
            const project = projectsData[projectId];
            const projectBox = document.createElement('div');
            projectBox.style.cssText = `
                        width: 150px;
                        height: 75px;
                        margin: 10px;
                        padding: 15px;
                        background: white;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        cursor: pointer;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        transition: all 0.2s ease;
                    `;

            // Project name
            const projectName = document.createElement('h3');
            projectName.textContent = project.name || "Default";
            if (project.name === 'default') {
                projectName.textContent = 'Default Project';
            }
            projectName.style.cssText = `
                        margin: 0;
                        font-size: 16px;
                        font-weight: 500;
                        text-align: center;
                        color: #1f2937;
                    `;
            projectBox.appendChild(projectName);

            // Hover effect
            projectBox.onmouseover = () => {
                projectBox.style.transform = 'translateY(-2px)';
                projectBox.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            };
            projectBox.onmouseout = () => {
                projectBox.style.transform = 'translateY(0)';
                projectBox.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            };

            // Click handler
            projectBox.onclick = async () => {
                try {
                    await projectManager.switchProject(project.name);
                    // Refresh projects display after switch
                    await projectManager.loadProjects();
                } catch (error) {
                    console.error('Error switching project:', error);
                    showToast('Failed to switch project', 'error');
                }
            };

            projectsContainer.appendChild(projectBox);
        }
    });
});

// Add this to your existing event listeners where labels are added
document.addEventListener('labelAdded', (event) => {
    console.log('Label added:', event.detail);
    frequentlyUsedManager.recordUsage('label', event.detail.label, event.detail.isCustom);
    frequentlyUsedManager.saveData();
});

// Add this to your existing event listeners where codes are added
document.addEventListener('codeAdded', (event) => {
    console.log('Code added:', event.detail);
    frequentlyUsedManager.recordUsage('code', event.detail.code, event.detail.isCustom);
    frequentlyUsedManager.saveData();
});

export async function mainMenu() {
    console.log(`-- mainMenu() --`)
    hideAllSubFrames();
    if (await isUserLoggedIn2()) {
        console.log(`Showing main subframe nav`)
        showFrame("main-sub-frame-nav"); // profile dropdown
    }
    else {
        console.log(`Hiding main subframe nav - user not logged in`);
        
        // Clear any stale UI elements that might still be showing user data
        const headerUsernameElement = document.getElementById('header-username');
        if (headerUsernameElement) {
            headerUsernameElement.textContent = '';
        }
        
        const mainUserEmailElement = document.getElementById("main-user-email");
        if (mainUserEmailElement) {
            mainUserEmailElement.innerHTML = '';
        }
        
        // Clear username and email elements
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
        
        // Clear profile UI function if available
        if (typeof window.clearProfileUI === 'function') {
            window.clearProfileUI();
        }
    }
    showFrame("main-sub-frame");
    showFrame("main-login-icon-sub-frame");
}

/**
 * Frame 1 - Add Label (directly from main menu)
 * Frame 1 - Annotation History
 * - See _annotation-history.js <p>
 *
 * Frame 1 - Clear Data
 */
const type1 = "Label";

// Label button directly from main menu
document.getElementById("Label").addEventListener("click", () => {
    // Hide splash screen immediately if it's still showing
    const splashScreen = document.getElementById('splash-screen');
    const mainContent = document.getElementById('main-content');
    
    if (splashScreen && mainContent) {
        // Force hide splash screen immediately (no animation delay)
        splashScreen.style.display = 'none';
        splashScreen.classList.remove('slide-out');
        
        // Ensure main content is visible
        mainContent.style.display = 'block';
        mainContent.style.opacity = '1';
        document.body.style.overflow = 'auto';
    }
    
    hideAllSubFrames();
    showFrame(`predefined-${type1.toLowerCase()}-sub-frame-label`);

    // Show appropriate descriptions
    showFrame('predefined-labels-description');
    showFrame('custom-labels-description');

    showFrame(`predefined-${type1.toLowerCase()}-sub-frame`);
    showFrame(`predefined-${type1.toLowerCase()}-sub-frame-button`);

    var button = document.getElementById("Toggle Custom Labels");
    if (button && button.toggle != null && button.toggle == false) {
        button.click();
    }
});

const clearData = "Clear Data";
document.getElementById(clearData).addEventListener("click", async () => {
    var projectName = await getCurrentProject();
    var companyEmail = await getMainCompanyEmail();
    if (await isUserLoggedIn2()) {
        sendRuntimeMessage({
            action: "saveFirebaseData",
            path: `Companies/${companyEmail}/projects/${projectName}`,
            data: []
        });
    }
    else {
        localStorage.clear();
        // Clear all data from chrome.storage.local
        chrome.storage.local.clear(() => {
            if (chrome.runtime.lastError) {
                console.error('Error clearing storage:', chrome.runtime.lastError);
                showToast('Failed to clear data', 'error');
            } else {
                // Dispatch event to update statistics
                document.dispatchEvent(new Event('annotationUpdated'));

                // Reset statistics directly
                statisticsManager.resetStats();

                showToast('All data cleared successfully', 'success');
            }

        });
    }
});

/**
 * Frame 2 - Annotation System > Add Annotation Type
 * Note: Label button is now handled directly from main menu above
 */
// const type3 = "Note";

/**
 * Frame 3 - Annotation System > Add Annotation Type > Add Annotation SubType
 */
const option1 = type1.toLowerCase();
const idMappings = {
    "Sentiment": { AnnotationType: option1, DisplayName: "sentiment-display" },
    "Tone": { AnnotationType: option1, DisplayName: "tone-display" },
    "Intent": { AnnotationType: option1, DisplayName: "intent-display" },
    "Emotion": { AnnotationType: option1, DisplayName: "emotion-display" },
    "Priority": { AnnotationType: option1, DisplayName: "priority-display" },
    "Politeness": { AnnotationType: option1, DisplayName: "politeness-display" },
    "Agreement": { AnnotationType: option1, DisplayName: "agreement-display" },
    "Relevance": { AnnotationType: option1, DisplayName: "relevance-display" },
    "Toggle Custom Labels": { AnnotationType: option1, DisplayName: "toggle-custom-labels-display" },
    "Add Custom Label": { AnnotationType: option1, DisplayName: "add-custom-label-display" }

    // add more as needed
};

function annotationSystemSubFrameOptions() {
    console.log(`-- annotationSystemSubFrameOptions() --`)

    let option = option1;
    let optionCap = type1;
    Object.keys(idMappings).forEach(buttonId => {
        document.getElementById(buttonId).addEventListener("click", () => {
            var button = document.getElementById(buttonId);
            if (button.toggle == null) {
                button.toggle = true;
            }
            const annotationType = idMappings[buttonId].AnnotationType;

            if (buttonId == `Toggle Custom ${optionCap}s`) {
                if (button.toggle) {
                    showFrame(`custom-${option}-sub-frame`);
                    changeLabels(buttonId, "Close Custom Panel");
                    console.warn('onClickCustomLabels 1', option);
                    onClickCustomLabels(option);
                    button.toggle = false;
                } else {
                    hideAllSubFrames();
                    showFrame(`predefined-${option}-sub-frame-label`);

                    showFrame(`predefined-${option}s-description`);
                    showFrame(`custom-${option}s-description`);

                    showFrame(`predefined-${option}-sub-frame`);
                    showFrame(`predefined-${option}-sub-frame-button`);
                    changeLabels(buttonId, `Add Custom ${optionCap}s`); // ??
                    button.toggle = true;
                }
            } else {
                hideAllSubFrames();
                if (buttonId == `Add Custom ${optionCap}` || buttonId == `Add Custom ${optionCap} Name`) {
                    // subframe for clicking the custom buttons
                    showFrame(`custom-${option}-sub-frame-1-custom`);
                    showFrame(`custom-${option}-sub-frame-1-button`)
                } else {
                    // subframe for  clicking the predefined buttons
                    showFrameLabel(`predefined-${option}-sub-frame-1-label`, buttonId);
                    showFrame(`predefined-${option}-sub-frame-1-label-div`);

                    showFrameAndDisplay(`predefined-${option}-sub-frame-1`, idMappings[buttonId].DisplayName, buttonId, optionCap, selectedText); // needs key, type
                    showFrame(`predefined-${option}-sub-frame-1-button`)
                    console.log(`buttonId = ${buttonId}`);
                    console.log(`annotationType = ${annotationType}`);
                }
            }

        });
    });
}


/**
 * Back Buttons <br>
 * 1. Back
 * 2. annotation-history-back
 * 3. label-back
 * 4. code-back
 * 5. note-board-back
 * 6. voice-annotation-back
 * 7. video-annotation-back
 * 8. etc
 */

const backTypesMain = ["annotation-history-header-back"];
backTypesMain.forEach(id => {
    document.getElementById(id).addEventListener("click", () => {
        console.log("Showing main menu from annotation-history-header-back");
        mainMenu();
    });
});

function addBackButtonClickListener(annotation, type, ver) {
    console.log(`-- addBackButtonClickListener(annotation = ${annotation}, type = ${type}, ver = ${ver}) --`)
    document.getElementById(`${annotation}-${type}-${ver}-button`).addEventListener("click", () => {
        typeFrame(annotation, type);
    });

}


/**
 * OK Buttons  - Adding custom entries into the list<br>
 * 1. Input Keys
 * 2. Input Key Options/Values
 */

const okButtons = ["custom-label-ok"];
okButtons.forEach(id => {
    document.getElementById(id).addEventListener("click", async () => {
        console.warn(`-- ok button clicked --`);
        let option = option1;
        let optionCap = type1;

        let userInput = document.getElementById(`custom-${option}-input`).value;
        const errorElement = document.getElementById(`custom-${option}-error`);

        if (!userInput || userInput.trim() === '') {
            console.log(`user input is empty`);
            if (errorElement) errorElement.innerHTML = `Custom ${optionCap} cannot be empty`;
        } else {
            userInput = userInput.trim(); // Trim whitespace
            console.warn(`**** start ****`);
            let customObjectResult = await callGetItem("customLabelsAndCodes");
            let customObject = Object.values(customObjectResult || {})[0] || {};

            console.log("Current custom object:", customObject);

            // Ensure customObject is an object
            if (typeof customObject !== 'object' || Array.isArray(customObject)) {
                console.warn('customLabelsAndCodes is not an object, resetting.');
                customObject = {};
            }

            // Check if the key already exists
            if (customObject.hasOwnProperty(userInput)) {
                console.warn("Found key:", userInput);
                if (errorElement) errorElement.innerHTML = `Custom ${optionCap} '${userInput}' Already Exists`;
                console.log(`key = ${userInput} exist`);
            } else {
                console.warn("Key not found, creating:", userInput);
                if (errorElement) errorElement.innerHTML = ""; // Clear previous error

                // Add the new item to the object
                customObject[userInput] = { options: [], keyType: option };

                // Save the updated object
                await callSetItem("customLabelsAndCodes", customObject);
                console.log("Saved new custom object:", customObject);

                // Clear the input field and update UI
                document.getElementById(`custom-${option}-input`).value = "";
                await populateCustomContent(`custom-${option}s-container`, option); // Repopulate to show the new item
                // typeFrame('custom', option); // typeFrame might need adjustment depending on exact UI flow
                await onClickCustomLabels(option); // Re-attach listeners
                document.getElementById("custom-label-1-button").click();
            }
            console.warn(`**** end ****`);
        }
    });
});

const okOptionButtons = ["custom-label-ok-2"];
okOptionButtons.forEach(id => {
    document.getElementById(id).addEventListener("click", () => {
        let option = option1;
        let optionCap = type1;

        let key = document.getElementById(`custom-${option}-key`).innerText;
        let keyOption = document.getElementById(`custom-${option}-input-2`).value;
        updateValueByKey(key, keyOption, option);
        // updateValueByKey2("customLabelsAndCodes", key, keyOption, option);
    });
});


// ???
function typeFrame(annotation, type) {
    console.log(`-- typeFrame(${annotation}, ${type}) --`);

    let capType = "Label";

    hideAllSubFrames();
    if (annotation == 'predefined') {
        showFrame(`predefined-${type}-sub-frame-label`);
        showFrame(`predefined-${type}-sub-frame`);
        showFrame(`predefined-${type}-sub-frame-button`);
        // Show descriptions for labels
        if (type === 'label') {
            showFrame('predefined-labels-description');
            showFrame('custom-labels-description');
        }
    } else {
        showFrame(`predefined-${type}-sub-frame-label`);
        showFrame(`predefined-${type}-sub-frame`);
        showFrame(`predefined-${type}-sub-frame-button`);
        showFrame(`custom-${type}-sub-frame`);
        // Show descriptions for labels
        if (type === 'label') {
            showFrame('predefined-labels-description');
            showFrame('custom-labels-description');
        }
        changeLabels(`Toggle Custom ${capType}s`, "Close Custom Panel");
    }
}


/**
 * GET
 */
export async function getLocalStorageData() {
    const idMapping = new Map();
    const dataList = [];

    // Use Promise.all with map instead of forEach
    if (!isOnWebsite)
        await Promise.all((await chrome.storage.local.getKeys()).map(async key => {
            console.log("Annotation History | " + key);
            let value = await callGetItem(key, false);
            idMapping.set(key, value);
            dataList.push({ key: key, value: value });
        }));

    return { idMapping, dataList };
}

export async function updateValueByKey(key, keyOption, type) {
    console.log(`-- updateValueByKey(key = ${key} , keyOption = ${keyOption}, type = ${type}) --`);

    let errMsg1 = `Custom ${type} ${keyOption} already exist`;
    let errMsg2 = `Custom ${type} cannot be empty`;
    let errMsg3 = `Max 3 Options Allowed`;

    let customErrorId = `custom-${type}-error-2`;
    let customInputId = `custom-${type}-input-2`;

    let emptyInput = "";
    let userInput = document.getElementById(customInputId);
    let userError = document.getElementById(customErrorId);

    let minLen = 0;
    let maxLen = 3;

    let customObjectResult = await callGetItem("customLabelsAndCodes");
    let customObject = Object.values(customObjectResult || {})[0] || {};

    if (!customObject || typeof customObject !== 'object' || Array.isArray(customObject) || !customObject.hasOwnProperty(key)) {
        console.error(`Custom object not found or key '${key}' does not exist.`);
        userError.innerHTML = `Error: Could not find custom ${type} '${key}'`;
        return;
    }

    let itemData = customObject[key]; // Access data directly by key

    console.warn('itemData', itemData);
    console.warn('itemData.options', itemData.options);
    console.warn('Array.isArray(itemData.options)', Array.isArray(itemData.options));

    // clear error
    userError.innerHTML = emptyInput;

    // Check if the options array exists
    if (itemData && Array.isArray(itemData.options)) {

        // Check if newValue exists in options (case-insensitive)
        let exists = itemData.options.some(item => item.toLowerCase() === keyOption.toLowerCase());

        if (exists) {
            userError.innerHTML = errMsg1;
            userInput.value = emptyInput;
        } else if (keyOption.trim() === emptyInput) {
            userError.innerHTML = errMsg2;
            userInput.value = emptyInput;
        } else if (itemData.options.length < maxLen) {
            itemData.options.push(keyOption.trim());

            // Save the entire updated customObject
            await callSetItem("customLabelsAndCodes", customObject);

            // Clear input
            userInput.value = emptyInput;

            console.warn('customFrameMenu() 2', { key: key, value: itemData });
            // Pass only the key string, not the whole object
            customFrameMenu(selectedText, key, type);

        } else {
            userError.innerHTML = errMsg3;
            userInput.value = emptyInput;
        }
    } else {
        // Options array not found or not an array. Initialize it.
        console.warn(`Options array not found for key '${key}'. Initializing.`);
        if (itemData) { // Ensure itemData itself exists (it should have keyType)
            itemData.options = []; // Create the options array

            // Now try adding the option again (respecting maxLen and emptiness check)
            if (keyOption.trim() === emptyInput) {
                userError.innerHTML = errMsg2;
                userInput.value = emptyInput;
            } else if (itemData.options.length < maxLen) { // Check length again (will be 0)
                itemData.options.push(keyOption.trim());

                // Save the entire updated customObject
                await callSetItem("customLabelsAndCodes", customObject);

                // Clear input
                userInput.value = emptyInput;

                console.warn('customFrameMenu() 2 after initializing options', { key: key, value: itemData });
                // Pass only the key string, not the whole object
                customFrameMenu(selectedText, key, type);
            } else {
                // This case should be theoretically impossible if maxLen >= 1, but added for safety
                userError.innerHTML = errMsg3;
                userInput.value = emptyInput;
            }
        } else {
            console.error(`itemData for key '${key}' is unexpectedly missing when trying to initialize options.`);
            userError.innerHTML = `Error: Data structure error for '${key}'`;
        }
    }
}



async function addOptionToAnnotation(userText, key, type, option, index) {
    console.log(`-- addOptionToAnnotation(userText = ${userText}, option = ${option}) --`);

    let values = await callGetItem('annotationHistory');
    if (!values) {
        console.log("No annotation history found.");
        return;
    }

    let annotationHistory = JSON.parse(Object.values(values)[0]);
    const entry = annotationHistory[index];

    if (!entry) {
        console.log("No entry found with the specified userText.");
        return;
    }

    const optionsObj = entry.find(obj => obj.options !== undefined);

    if (optionsObj.options.includes(option)) {
        window.alert(`Option already exists\n${type} Type: ${option}`);
        return;
    }

    if (optionsObj.options.length < 3) {
        optionsObj.options.push(option);
        callSetItem('annotationHistory', JSON.stringify(annotationHistory));
        window.alert(`Added Label\nText: ${userText}\n${type}: ${key}\n${type} Type: ${option}`);
    } else {
        window.alert(`Can only add a max of 3 ${type} Types`);
        return;
    }

    // Update statistics after adding option
    document.dispatchEvent(new Event('annotationUpdated'));
}


// Todo - Fixed
export async function deleteOptionByKey(key, option, type) {
    console.warn(`-- deleteOptionByKey(key = ${key} , option = ${option}, type = ${type}) --`);

    let customObjectResult = await callGetItem("customLabelsAndCodes");
    let customObject = Object.values(customObjectResult || {})[0] || {};

    if (!customObject || typeof customObject !== 'object' || Array.isArray(customObject) || !customObject.hasOwnProperty(key)) {
        console.error(`Custom object not found or key '${key}' does not exist.`);
        return;
    }

    let itemData = customObject[key];

    if (itemData && Array.isArray(itemData.options)) {
        const optionIndex = itemData.options.findIndex(item => item.toLowerCase() === option.toLowerCase());

        if (optionIndex !== -1) {
            // Remove the value using splice
            itemData.options.splice(optionIndex, 1);

            // Save the updated customObject
            await callSetItem("customLabelsAndCodes", customObject);

            // Reload custom method page - use key instead of object
            console.warn(`customFrameMenu() 3 called with key = ${key}`);
            customFrameMenu(selectedText, key, type);
        } else {
            console.warn(`Option '${option}' not found in key '${key}'`);
        }
    } else {
        console.error(`Options array not found for key '${key}'`);
    }
}
export async function deleteKey(key, type) {
    console.warn(`-- deleteKey(key = ${key}, type = ${type}) --`);

    let customObjectResult = await callGetItem("customLabelsAndCodes");
    let customObject = Object.values(customObjectResult || {})[0] || {};

    if (!customObject || typeof customObject !== 'object' || Array.isArray(customObject) || !customObject.hasOwnProperty(key)) {
        console.error(`Custom object not found or key '${key}' does not exist.`);
        return;
    }

    // Delete the key directly from the object
    delete customObject[key];

    // Save the updated object
    await callSetItem("customLabelsAndCodes", customObject);

    // Update the UI
    await populateCustomContent(`custom-${type}s-container`, type);
    typeFrame("custom", type); // Review if typeFrame needs changes
    // The populateCustomContent calls onClickKeyLabels and onClickCustomLabels internally
}


async function deleteAnnotationEntryByUserText(userText) {
    console.log(`-- deleteAnnotationEntryByUserText(userText = ${userText}) --`);

    // Retrieve the current annotation history from localStorage
    // let values = localStorage.getItem('annotationHistory');
    let values = await callGetItem('annotationHistory');

    if (!values) {
        console.log("No annotation history found.");
        return;
    }

    // Parse the JSON string back into an array
    let annotationHistory = JSON.parse(values);

    // Find the index of the entry with the matching userText
    const index = annotationHistory.findIndex(annotation =>
        annotation.some(entry => entry.userText === userText)
    );

    if (index === -1) {
        console.log("No entry found with the specified userText.");
        return;
    }

    // Remove the specified index from the array
    annotationHistory.splice(index, 1);

    // Convert the updated array to a JSON string
    const annotationHistoryString = JSON.stringify(annotationHistory);

    // Store the updated JSON string back to localStorage
    // localStorage.setItem("annotationHistory", annotationHistoryString);
    callSetItem("annotationHistory", annotationHistoryString);

    console.log(`Entry with userText "${userText}" deleted.`);
}


/**
 * MISC
 */
function changeLabels(buttonId, newLabel) {
    console.log(`-- changeLabels(buttonId = ${buttonId}, newLabel = ${newLabel}) --`);
    document.getElementById(buttonId).innerHTML = `
        <i class="fas fa-plus" style="color: #626262;"></i>
        <span class="p-2">${newLabel}</span>
    `;
}
function addCustomButton(containerId, buttonId, buttonName, icon, type) {
    console.log(`-- addCustomButton(containerId = ${containerId}, key = ${buttonId}, type = ${type}) --`);

    document.getElementById(containerId).innerHTML += `
    <button class="frame-button-1 delete-key-container">
        <div id="custom-${type}-item-${buttonId}">
            <i class="fas fa-plus" style="color: blue;"></i>
            <span class="p-2">${buttonName}</span>
        </div>
        <span id="li-key-icon-${type}-${buttonId}" class="delete-option">x</span>
    </button>
`;
    // onClickCustomLabels(type);
}



/**
 * This method populates the custom key buttons
 * @param containerId
 * @param type
 */
async function populateCustomContent(containerId, type) {
    console.log(`-- populateCustomContent(${containerId}, type = ${type})`)

    // clear first to avoid overlap
    document.getElementById(containerId).innerHTML = "";

    let customObject = Object.values(await callGetItem("customLabelsAndCodes") || {})[0] || {}; // Get the object, default to empty {} if null/undefined

    if (customObject && typeof customObject === 'object' && !Array.isArray(customObject)) {
        Object.entries(customObject).forEach(([key, value]) => {
            // value should now be { options: [], keyType: '...' }
            const keyType = value.keyType;
            if (keyType == type) {
                addCustomButton(containerId, key, key, "", type);
            }
        });
        // We should call onClickKeyLabels after populating
        onClickKeyLabels(type);
    } else {
        console.log(`customObject is not in the expected format or doesn't exist`);
    }
    onClickCustomLabels(type); // This still needs refactoring below
}

var labelButtonEventListenersAdded = new Set();
async function onClickCustomLabels(type) {
    console.warn(`-- onClickCustomLabels(type = ${type}) --`);

    let customObjectResult = await callGetItem("customLabelsAndCodes");
    let customObject = Object.values(customObjectResult || {})[0] || {};

    // Added logging here:
    console.log(`onClickCustomLabels: Fetched customObjectResult:`, JSON.stringify(customObjectResult));
    console.log(`onClickCustomLabels: Extracted customObject:`, JSON.stringify(customObject));

    if (customObject && typeof customObject === 'object' && !Array.isArray(customObject)) {
        Object.entries(customObject).forEach(([key, value]) => {
            const elementId = `custom-${type}-item-${key}`;
            const button = document.getElementById(elementId);

            if (button) {
                if (!labelButtonEventListenersAdded.has(button)) {
                    console.log(`onClickCustomLabels: Adding listener for key: ${key}`); // Log only the key
                    // Pass only the key and type now
                    button.addEventListener('click', () => customFrameMenu(selectedText, key, type));
                    labelButtonEventListenersAdded.add(button);
                } else {
                    // console.log(`Event listener already added for ${elementId}`);
                }
            } else {
                // console.log(`Element with id ${elementId} not found.`);
            }
        });
    } else {
        console.warn('customObject is not in the expected format or is empty in onClickCustomLabels');
    }
}

var deleteButtonEventListenersAdded = new Set();
export async function onClickKeyLabels(type) {
    console.warn(`-- onClickKeyLabels(type = ${type}) --`);

    let customObject = Object.values(await callGetItem("customLabelsAndCodes") || {})[0] || {};

    if (customObject && typeof customObject === 'object' && !Array.isArray(customObject)) {
        Object.keys(customObject).forEach(key => {
            const deleteElementId = `li-key-icon-${type}-${key}`;
            const deleteButton = document.getElementById(deleteElementId);

            if (deleteButton) {
                if (!deleteButtonEventListenersAdded.has(deleteButton)) {
                    deleteButton.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent the parent click handler
                        console.log('delete clicked for key:', key)
                        deleteKey(key, type);
                    });
                    deleteButtonEventListenersAdded.add(deleteButton);
                } else {
                    // console.log(`Delete listener already added for ${deleteElementId}`);
                }
            } else {
                // console.log(`Delete Element with id ${deleteElementId} not found.`);
            }
        });
    } else {
        console.warn('customObject is not in the expected format or is empty for onClickKeyLabels');
    }
}


/**
 * Selected Text code.
 * @type {string}
 */

var selectedText = '';

export var SELECTED_TEXT;

document.addEventListener("DOMContentLoaded", function () {
    console.log('-- new selected text --');
    const urlParams = new URLSearchParams(window.location.search);
    selectedText = urlParams.get("text");
    console.log("Selected Text:", decodeURIComponent(selectedText));
    SELECTED_TEXT = selectedText;

    if(isOnWebsite) {
        var text = localStorage.getItem("selectedText");
        if(text) {
            selectedText = text;
            SELECTED_TEXT = text;
        }
    }
    // window.alert(`Added Label\nText = ${selectedText}`);
    // addSelectedTextEntry(selectedText, "Sentiment", "label", "Sad");
    // Listen for updates from background.js when text changes
    if (!isOnWebsite)
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === "updateText") {
                // Update the text in the popup
                console.log("Updating text in the popup. New text:", message.newText);
                selectedText = message.newText;
                SELECTED_TEXT = message.newText;
                if (document.getElementById('textDisplay') != null)
                    document.getElementById('textDisplay').innerText = message.newText;  // Assuming there's an element with id 'textDisplay'
            }
            else if (message.action == "downloadFullPageScreenshot") {
                downloadScreenshot(message.dataUrl);
            }
            else if (message.action == "saveUser") {
                if (message.currentUser)
                    localStorage.setItem('currentUser', JSON.stringify(message.currentUser));
                else
                    localStorage.removeItem('currentUser');
            }
        });
});

async function getGlobalHighlightID() {
    if (isOnWebsite)
        return localStorage.getItem("globalHighlightID");

    return new Promise((resolve, reject) => {
        sendRuntimeMessage({ action: "getGlobalHighlightID" }, function (response) {
            if (response && response.success) {
                resolve(response.data);
            } else {
                console.error('Error getting global highlight ID:', response.error);
                return resolve(null);
            }
        });
    });
}

async function getHighlightByID(id) {
    let highlights = Object.values(await callGetItem("highlights") || []);
    if (highlights.length > 0)
        highlights = highlights[0];

    if (highlights && highlights.length > 0)
        for (let highlight of highlights) {
            if (highlight.id == id)
                return highlight;
        }

    return null;
}

// Todo ↘ Here is where you will add sub-keys to the AnnotationHistory parent key
// Add and entry like the following  [{selectedText} {key} {key options} {key type}]
export async function addSelectedTextEntry(userText, key, type, option) {
    console.warn(`-- addSelectedTextEntry(text = ${userText}, key = ${key}, type = ${type}, option = ${option}) --`);

    // Check if this is a custom label/code using the renamed function
    const isCustom = await isCustomItem(key, type);
    console.log(`Is ${type} "${key}" custom?:`, isCustom);

    const annotationKey = "annotationHistory";
    let compositeExist = false;

    console.warn('Getting URL...');
    let url = "";

    try {
        const result = await getTextURL(userText);
        if (result) {
            url = result;
            console.log('Text matches! URL:', url);
        } else {
            console.log('Text does not match or no highlight found.');
        }
    } catch (error) {
        console.error('Error retrieving URL:', error);
    }

    var globalHighlightID = await getGlobalHighlightID();
    var highlight = await getHighlightByID(globalHighlightID);
    if (highlight)
        url = highlight.url;

    const annotation = [
        { "id": Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) },
        { "userText": userText },
        { "key": key },
        { "type": type },
        { "options": [option] },
        { "url": url },
        { "timestamp": new Date().toISOString() },
        { "highlightID": globalHighlightID }
    ];

    // Add this after creating the annotation but before saving it
    // Dispatch events for frequently used tracking
    if (type.toLowerCase() === 'label') {
        const event = new CustomEvent('labelAdded', {
            detail: {
                label: key,
                isCustom: isCustom
            }
        });
        document.dispatchEvent(event);
    } else if (type.toLowerCase() === 'code') {
        const event = new CustomEvent('codeAdded', {
            detail: {
                code: key,
                isCustom: isCustom
            }
        });
        document.dispatchEvent(event);
    }

    let annUserText = "";
    let annKey = "";
    let annType = "";
    let annUrl = "";
    let count = 1;

    // Retrieve the current annotation history from localStorage
    let annotationHistory = await getAnnotationHistory();
    let annotationIndex = "";
    // Parse existing values if present
    if (annotationHistory.length > 0) {

        annotationHistory.forEach((subArray, index) => {
            annotationIndex = index;
            subArray.forEach((entry) => {
                if (entry.key) annKey = entry.key;
                if (entry.type) annType = entry.type;
                if (entry.userText) annUserText = entry.userText;
                if (entry.url) annUrl = entry.url;
            });

            if (annUserText === userText && annKey === key && annType === type && annUrl === url) {
                compositeExist = true;
            } else {
                compositeExist = false;
            }
            console.warn('compositeExist: ', compositeExist);
            count++;
        });

        if (compositeExist) {
            addOptionToAnnotation(userText, key, type, option, annotationIndex);
        } else {
            annotationHistory.push(annotation);
            const annotationHistoryString = JSON.stringify(annotationHistory);
            callSetItem(annotationKey, annotationHistoryString);
            window.alert(`Added Label\nText: ${userText}\n${type}: ${key}\n${type} Type: ${option}`);
        }
    } else {
        console.log(`No values found. Creating new annotationKey: ${annotationKey}`);
        annotationHistory.push(annotation);
        const annotationHistoryString = JSON.stringify(annotationHistory);
        callSetItem(annotationKey, annotationHistoryString);
        console.log("New entry added.");
        window.alert(`Added Label\nText: ${userText}\n${type}: ${key}\n${type} Type: ${option}`);
    }

    // Update statistics after adding annotation
    document.dispatchEvent(new Event('annotationUpdated'));
}

// Rename to be more generic and handle both labels and codes
async function isCustomItem(key, type) {
    const customDataResult = await callGetItem('customLabelsAndCodes');
    const customObject = Object.values(customDataResult || {})[0] || {};

    // Check if the item exists in customLabelsAndCodes and matches the type
    if (customObject && customObject.hasOwnProperty(key)) {
        const itemData = customObject[key];
        return itemData.keyType && itemData.keyType.toLowerCase() === type.toLowerCase();
    }
    return false;
}

// util function for setItems(key, value)
// This function will allow me to just place the firebase code just here instead of in 8 places
// Todo ↘ Make this global
// let firebaseKeyList = ["videoSavedNotes", "annotationHistory", "savedNotes", "voiceSavedNotes", "customLabelsAndCodes"];

export async function callSetItem(key, value, prefixProjectName = true) {
    console.warn(`-- callSetItem(key = ${key}, value = ${value}} --`);

    if (key == "annotationHistory") {
        console.log("Sending reload highlights message");
        sendMessageToAllTabs({
            action: "reloadHighlights"
        });
    }


    if (await isUserLoggedIn2()) {
        if (prefixProjectName)
            key = `Companies/${await getMainCompanyEmail()}/projects/${await getCurrentProject()}/${key}`;

        sendRuntimeMessage({
            action: "saveFirebaseData",
            path: key,
            data: value,
        });
        // saveUserKeysToDatabase(key, value, prefixProjectName);
    } else {
        if (prefixProjectName)
            key = await getCurrentProject() + "/" + key;
        chrome.storage.local.set({ [key]: value });
    }
}

export async function getAnnotationHistory() {
    let data = await callGetItem("annotationHistory");
    if (data == null)
        data = {};
    var values = Object.values(data);
    if (values.length == 0)
        return [];
    if (values[0].length == 0)
        return [];
    return values[0];
}

export async function callGetItem(key, prefixProjectName = true) {
    console.warn(`-- callGetItem(key = ${key}) --`);

    var companyEmail = await getMainCompanyEmail();
    var projectName = await getCurrentProject();

    // firebase get
    if (await isUserLoggedIn2()) {
        if (prefixProjectName)
            key = `Companies/${companyEmail}/projects/${projectName}/${key}`;
        return new Promise(async (resolve, reject) => {
            sendRuntimeMessage({
                action: "getFirebaseData",
                path: key
            }, response => {
                if (response && response.success && response.data) {
                    let data = { [key]: response.data };
                    resolve(data);
                } else {
                    console.log(`${key} does not exist in firebaseKeyList`);
                    resolve(null);  // Use resolve instead of reject for missing data
                }
            });
        });
    } else {
        if (prefixProjectName)
            key = projectName + "/" + key;
        return Promise.resolve(await chrome.storage.local.get(key));  // Wrap synchronous call in Promise
    }
}

/**
 * Run methods at start of code
 */
console.log("Showing main menu from code loaded");
mainMenu();
annotationSystemSubFrameOptions();
// annotationSystemSubFrame(type3); // Note

addBackButtonClickListener("predefined", "label", "1");
addBackButtonClickListener("custom", "label", "1");
addBackButtonClickListener("custom", "label", "2");

// onClickCustomLabels("code");
// onClickCustomLabels("label");

setTimeout(function () {
    populateCustomContent("custom-labels-container", "label");
}, 3000);
// deleteAnnotationEntryByUserText("Routing Fundamentals");
// onClickKeyLabels("label");
// onClickKeyLabels("code");

// Todo -
//deleteItemByKey();

function hideSplashScreen() {
    const splashScreen = document.getElementById('splash-screen');
    const mainContent = document.getElementById('main-content');

    if (!splashScreen || !mainContent) return;

    // Show main content before starting animation
    mainContent.style.display = 'block';
    mainContent.style.opacity = '0';

    // Force a browser reflow
    void mainContent.offsetHeight;

    // Start both animations
    requestAnimationFrame(() => {
        splashScreen.classList.add('slide-out');
        mainContent.classList.add('slide-in');

        // Clean up after animation completes
        setTimeout(() => {
            splashScreen.style.display = 'none';
            document.body.style.overflow = 'auto';
            mainContent.style.opacity = '1';
        }, 800);
    });
}

// Add this event listener for the back arrow button
document.getElementById('Back-5').addEventListener('click', () => {
    hideAllSubFrames();
    mainMenu(); // Navigate back to main menu
});

// Find the event listener for predefined label back button and update it
document.getElementById('predefined-label-1-button').addEventListener('click', () => {
    hideAllSubFrames();
    // Show only the predefined label section
    showFrame("predefined-label-sub-frame-label");
    showFrame("predefined-label-sub-frame");
    showFrame("predefined-labels-description");
    showFrame("custom-labels-description");
    showFrame("predefined-label-sub-frame-button");
});

// Similarly update the custom label back button
document.getElementById('custom-label-1-button').addEventListener('click', () => {
    hideAllSubFrames();
    // Show only the predefined label section
    showFrame("predefined-label-sub-frame-label");
    showFrame("predefined-label-sub-frame");
    showFrame("predefined-labels-description");
    showFrame("custom-labels-description");
    showFrame("predefined-label-sub-frame-button");
});


// Add this near the top with other event listeners
// document.querySelector('.get-started-btn').addEventListener('click', () => {
//     hideSplashScreen();
//     toggleProfileMenuDisplay(); // Reuse the same function used by profile icon
// });

// Add this new event listener for continue button
// document.querySelector('.continue-btn').addEventListener('click', () => {
//     hideSplashScreen();
//     console.log("Showing main menu from continue-btn");
//     mainMenu(); // Goes directly to main menu
// });

document.getElementById('change-username').addEventListener('click', async () => {
    // Prompt for new username
    const newUsername = prompt('Enter your new username:');
    if (!newUsername) return; // Cancelled

    // Validate username (at least 6 chars, only letters, numbers, _ or -)
    // const usernamePattern = /^[a-zA-Z0-9_-]{6,}$/;
    // if (!usernamePattern.test(newUsername)) {
    //     showToast('Invalid username. Must be at least 6 characters and only contain letters, numbers, _ or -.', 'error');
    //     return;
    // }

    // Update Firebase Auth displayName
    const usernameUpdateListener = async function (message) {
        if (message.action === "usernameUpdateComplete") {
            chrome.runtime.onMessage.removeListener(usernameUpdateListener);
            if (message.success) {
                // Update in database at users/user/name
                let companyEmail = await getMainCompanyEmail();
                let userEmail = await getUserEmail();
                if (!companyEmail || !userEmail) {
                    showToast('Error: Could not determine user or company email.', 'error');
                    return;
                }
                // Save to Firebase at Companies/{companyEmail}/users/{userEmail}/name
                sendRuntimeMessage({
                    action: "saveFirebaseData",
                    path: `Companies/${companyEmail}/users/${userEmail}/name`,
                    data: newUsername
                }, function (response) {
                    if (response && response.success) {
                        // Update UI
                        const usernameElements = document.getElementsByClassName('username-value');
                        Array.from(usernameElements).forEach(element => {
                            element.textContent = newUsername;
                        });
                        showToast('Username updated successfully!', 'success');
                    } else {
                        showToast('Failed to update username in database.', 'error');
                    }
                });
            } else {
                showToast(message.error || 'Failed to update username.', 'error');
            }
        }
    };
    chrome.runtime.onMessage.addListener(usernameUpdateListener);
    sendRuntimeMessage({
        command: "auth-username",
        newDisplayName: newUsername
    }, function (response) {
        if (response && response.status === "error") {
            chrome.runtime.onMessage.removeListener(usernameUpdateListener);
            showToast(response.message || 'Failed to update username.', 'error');
        }
        if (!response) {
            chrome.runtime.onMessage.removeListener(usernameUpdateListener);
            showToast('No response from server. Please try again.', 'error');
        }
    });
});

// Add this with the other event listeners
document.addEventListener('DOMContentLoaded', function () {
    // Find the back button in the custom label creation screen
    const customLabelBackBtn = document.querySelector('#custom-label-sub-frame-1-custom .back-icon-button-5');

    if (customLabelBackBtn) {
        customLabelBackBtn.addEventListener('click', () => {
            // Hide the custom label creation screen
            hideAllSubFrames();

            // Show the main labels screen components
            showFrame("predefined-label-sub-frame-label");
            showFrame("predefined-label-sub-frame");
            showFrame("predefined-labels-description");
            showFrame("custom-labels-description");
            showFrame("predefined-label-sub-frame-button");
            showFrame("custom-label-sub-frame");

            // Reset any error messages and input fields
            const errorElement = document.getElementById('custom-label-error');
            const inputElement = document.getElementById('custom-label-input');
            if (errorElement) errorElement.textContent = '';
            if (inputElement) inputElement.value = '';
        });
    }
});

// Add this function to update the profile info display
function updateProfileInfo(username, email) {
    const usernameElement = document.querySelector('.username-value');
    const emailElement = document.querySelector('.email-value');

    if (usernameElement) {
        usernameElement.textContent = username;
    }
    if (emailElement) {
        emailElement.textContent = email;
    }
}

// Call this when loading the profile info
document.addEventListener('DOMContentLoaded', () => {
    // Replace with your actual way of getting user info
    const username = ""; // Example
    const email = ""; // Example
    updateProfileInfo(username, email);
});

// Add this near your other DOMContentLoaded event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching functionality
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.add('active');

            // Show corresponding content
            const tabId = tab.getAttribute('data-tab');
            const content = document.getElementById(tabId);
            if (content) {
                content.classList.add('active');
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const manualLoggingBtn = document.getElementById('manual-logging');
    const conversationLoggingBtn = document.getElementById('conversation-logging');
    const manualMessage = document.getElementById('manual-logging-message');
    const conversationMessage = document.getElementById('conversation-logging-message');
    const settingsContainer = document.getElementById('settings-sub-frame');
    const backButtons = document.querySelectorAll('.back-to-settings');
    const noteButton = document.getElementById("Note");

    // Function to show message
    function showMessage(messageElement) {
        if (settingsContainer) settingsContainer.style.display = 'none';
        if (messageElement) messageElement.style.display = 'block';
    }

    // Function to hide message
    function hideMessage(messageElement) {
        if (messageElement) messageElement.style.display = 'none';
        // settingsContainer.style.display = 'block';
    }

    //Moving manual logging functionality to where note board button is
    if (noteButton) {
    noteButton.addEventListener('click', () => {
        renderCategories();
        showMessage(manualMessage);
    });
    }

    // Add click handlers for the buttons
    if (manualLoggingBtn) {
    manualLoggingBtn.addEventListener('click', () => {
        renderCategories();
        showMessage(manualMessage);
    });
    }

    if (conversationLoggingBtn) {
    conversationLoggingBtn.addEventListener('click', () => {
        showMessage(conversationMessage);
    });
    }

    // Add click handlers for back buttons
    if (backButtons && backButtons.length > 0) {
    backButtons.forEach(button => {
            if (button) {
        button.addEventListener('click', () => {
            hideMessage(manualMessage);
            hideMessage(conversationMessage);
        });
            }
    });
    }
});

document.addEventListener('DOMContentLoaded', function () {
    // ... existing code ...

    // Manual Logging Category Management
    const categoryInput = document.getElementById('category-input');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const categoryList = document.getElementById('category-list');

    // Load existing categories
    let categories = [];  // Initialize empty array
    renderCategories();


    function saveCategories(categories, oldRename, newRename, deletedCategory) {
        // First check if user is logged in
        isUserLoggedIn2().then(async (isLoggedIn) => {
            if (isLoggedIn) {
                let companyEmail = await getMainCompanyEmail();
                // Get user ID from storage
                const authResult = firebase.auth().currentUser;
                if (authResult) {

                    // Save categories to Firebase through background script
                    // Convert categories array to object with metadata
                    const categoriesObject = {};
                    categories.forEach(category => {
                        categoriesObject[category] = {
                            name: category,
                            createdAt: new Date().toISOString()
                        };
                    });

                    // Handle category renames and deletions in categoriesImages
                    if (oldRename && newRename) {
                        // Get reference to the old category path and update it
                        let projectName = await getCurrentProject();
                        sendRuntimeMessage({
                            action: "getFirebaseData",
                            path: `Companies/${companyEmail}/projects/${projectName}/categoriesImages/${oldRename}`
                        }, response => {
                            if (response && response.success && response.data) {
                                // Save data under new category name
                                sendRuntimeMessage({
                                    action: "saveFirebaseData",
                                    path: `Companies/${companyEmail}/projects/${projectName}/categoriesImages/${newRename}`,
                                    data: response.data
                                });
                                // Delete old category path
                                sendRuntimeMessage({
                                    action: "saveFirebaseData",
                                    path: `Companies/${companyEmail}/projects/${projectName}/categoriesImages/${oldRename}`,
                                    data: null
                                });
                            }
                        });
                    }

                    if (deletedCategory) {
                        // Delete the category path and all its images
                        var projectName = await getCurrentProject();
                        sendRuntimeMessage({
                            action: "saveFirebaseData",
                            path: `Companies/${companyEmail}/projects/${projectName}/categoriesImages/${deletedCategory}`,
                            data: null
                        });
                    }
                    var projectName = await getCurrentProject();
                    sendRuntimeMessage({
                        action: "saveFirebaseData",
                        path: `Companies/${companyEmail}/projects/${projectName}/manualLoggingCategories`,
                        data: categoriesObject
                    }, response => {
                        if (response && response.success) {
                            renderCategories();
                            showToast('Categories saved successfully', 'success');
                        } else {
                            console.error('Failed to save categories to Firebase:', response?.error);
                            showToast('Failed to save categories', 'error');
                        }
                    });
                }
            } else {
                // Save to local storage if not logged in
                chrome.storage.local.set({ 'manualLoggingCategories': categories }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Error saving categories:', chrome.runtime.lastError);
                        showToast('Failed to save categories', 'error');
                    } else {
                        showToast('Categories saved successfully', 'success');
                    }
                });
            }
        });
        renderCategories();
    }

    // Handle category actions (edit/delete)
    categoryList.addEventListener('click', (e) => {
        const btn = e.target.closest('.category-action-btn');
        if (!btn) return;

        const index = parseInt(btn.dataset.index);

        // Check if user is logged in
        isUserLoggedIn2().then(async (isLoggedIn) => {
            if (isLoggedIn) {
                // Get user ID from storage
                const authResult = firebase.auth().currentUser;
                if (authResult) {
                    var projectName = await getCurrentProject();
                    var companyEmail = await getMainCompanyEmail();
                    // Get categories from Firebase through background script
                    sendRuntimeMessage({
                        action: "getFirebaseData",
                        path: `Companies/${companyEmail}/projects/${projectName}/manualLoggingCategories`
                    }, response => {
                        if (response && response.success && response.data) {
                            // Convert Firebase object to array of category names
                            const categories = Object.entries(response.data).map(([key, value]) => value.name);

                            // Handle the category action with Firebase data
                            if (btn.classList.contains('delete')) {
                                const deletedCategory = categories[index];
                                categories.splice(index, 1);
                                saveCategories(categories, null, null, deletedCategory);
                            } else if (btn.classList.contains('edit')) {
                                const newName = prompt('Enter new category name:', categories[index]);
                                if (newName && newName.trim() && !categories.includes(newName.trim())) {
                                    const oldName = categories[index];
                                    categories[index] = newName.trim();
                                    saveCategories(categories, oldName, categories[index], null);
                                }
                            }
                        } else {
                            console.error('Failed to fetch categories from Firebase:', response?.error);
                        }
                    });
                }
            }
            else {
                // Fall back to local storage if not logged in or no auth info
                chrome.storage.local.get('manualLoggingCategories', (result) => {
                    let categories = result.manualLoggingCategories || [];

                    if (btn.classList.contains('delete')) {
                        const deletedCategory = categories[index];
                        categories.splice(index, 1);
                        saveCategories(categories, null, null, deletedCategory);
                    } else if (btn.classList.contains('edit')) {
                        const newName = prompt('Enter new category name:', categories[index]);
                        if (newName && newName.trim() && !categories.includes(newName.trim())) {
                            const oldName = categories[index];
                            categories[index] = newName.trim();
                            saveCategories(categories, oldName, categories[index], null);
                        }
                    }
                });
            }
        });
    });

    // Category list click handler
    categoryList.addEventListener('click', function (e) {
        // First check if we clicked an action button - if so, ignore the click
        if (e.target.closest('.category-action-btn')) {
            return;
        }

        const categoryItem = e.target.closest('.category-item');
        if (categoryItem) {
            const categoryName = categoryItem.querySelector('.category-name').textContent;
            showScreenshotOptions(categoryName);
        }
    });

    // Add category with redirect
    addCategoryBtn.addEventListener('click', async () => {
        const categoryName = categoryInput.value.trim();
        if (categoryName == "")
            return;
        if (await isUserLoggedIn2()) {
            // Get user ID from storage
            const authResult = firebase.auth().currentUser;
            var projectName = await getCurrentProject();
            var companyEmail = await getMainCompanyEmail();
            if (authResult) {
                // Save category to Firebase through background script
                sendRuntimeMessage({
                    action: "saveFirebaseData",
                    path: `Companies/${companyEmail}/projects/${projectName}/manualLoggingCategories/${categoryName}`,
                    data: {
                        name: categoryName,
                        createdAt: new Date().toISOString()
                    }
                }, response => {
                    if (response && response.success) {
                        categoryInput.value = '';
                        renderCategories();
                        showToast('Category added successfully', 'success');
                    } else {
                        console.error('Failed to add category:', response?.error);
                        showToast('Failed to add category', 'error');
                    }
                });
            }
        } else {
            // Save to local storage if not logged in
            chrome.storage.local.get('manualLoggingCategories', (result) => {
                let categories = result.manualLoggingCategories || [];
                if (categoryName && !categories.includes(categoryName)) {
                    categories.push(categoryName);
                    chrome.storage.local.set({ manualLoggingCategories: categories }, () => {
                        categoryInput.value = '';
                        renderCategories();
                        showToast('Category added successfully', 'success');
                    });
                } else if (categories.includes(categoryName)) {
                    showToast('Category already exists!', 'error');
                }
            });
        }
    });

    // Update the showScreenshotOptions function to store the current category
    let currentCategory = ''; // Add this at the top of your file with other variables

    function showScreenshotOptions(categoryName) {
        // Store the current category
        currentCategory = categoryName;

        document.getElementById('manual-logging-message').style.display = 'none';
        const screenshotOptions = document.getElementById('screenshot-options-message');
        screenshotOptions.style.display = 'block';

        // Update header to include category name
        screenshotOptions.querySelector('h2').textContent = `Screenshot Options - ${categoryName}`;

        // Clear existing catalog
        const existingCatalog = document.querySelector('.catalog-section');
        if (existingCatalog) {
            existingCatalog.remove();
        }

        // Create new catalog section
        createCatalogSection();

        // Set up the upload button click handler
        const uploadButton = document.getElementById('upload-image');
        if (uploadButton) {
            uploadButton.onclick = () => {
                const fileInput = document.getElementById('screenshot-file-input');
                fileInput.click();
            };
        }

        updateImageGrid(categoryName);

        const addNoteButton = document.getElementById('add-manual-log-plain');
        if (addNoteButton) {
            addNoteButton.onclick = () => {
                let fileData = {
                    data: "",
                    imageId: Date.now(),
                    name: "",
                    notes: "",
                    size: 0,
                    timestamp: new Date().toISOString(),
                    type: ""
                };
                let newLog = addImageToGrid(fileData, false);
                let editButton = newLog.querySelector(".catalog-edit-btn");
                editButton.click();
            };
        }
    }


    // Update the file input change handler
    document.getElementById('screenshot-file-input').addEventListener('change', async function () {
        if (this.files && this.files[0]) {
            const file = this.files[0];

            try {
                const reader = new FileReader();
                reader.onload = async function (e) {
                    const fileData = {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        data: e.target.result,
                        note: "",
                        timestamp: new Date().toISOString()
                    };

                    if (fileUploadInstantReturn) {
                        fileUploadInstantReturn(fileData);
                        fileUploadInstantReturn = null;
                        return;
                    }

                    // Check if user is logged in
                    if (await isUserLoggedIn2()) {
                        // Get user ID from storage
                        const authResult = firebase.auth().currentUser;
                        if (authResult) {
                            // Save image to Firebase through background script
                            const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                            var projectName = await getCurrentProject();
                            var companyEmail = await getMainCompanyEmail();
                            fileData.imageId = imageId;
                            sendRuntimeMessage({
                                action: "saveFirebaseData",
                                // Generate a unique ID for the image
                                path: `Companies/${companyEmail}/projects/${projectName}/categoriesImages/${currentCategory}/images/${imageId}`,
                                data: fileData
                            }, response => {
                                if (!response || !response.success) {
                                    console.error('Firebase save error:', response?.error);
                                    showToast('Failed to save to cloud', 'error');
                                }
                            });
                        }
                    } else {
                        // Use the stored category name for local storage
                        const storageKey = `catalog_${currentCategory}`;
                        const result = await chrome.storage.local.get(storageKey);
                        const images = result[storageKey] || [];
                        images.unshift(fileData);
                        await chrome.storage.local.set({ [storageKey]: images });
                    }

                    // Update UI
                    updateImageGrid(currentCategory);
                    showToast('Upload successful', 'success');
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('Upload error:', error);
                showToast('Upload failed', 'error');
            } finally {
                // Clear the input
                this.value = '';
            }
        }
    });

    // Back button from screenshot options to manual logging
    document.querySelector('.back-to-manual-logging').addEventListener('click', () => {
        document.getElementById('screenshot-options-message').style.display = 'none';
        document.getElementById('manual-logging-message').style.display = 'block';
    });

    var toggleScreenshotButton = document.getElementById("take-screenshot");
    if (isOnWebsite) {
        toggleScreenshotButton.style.display = "";
        document.getElementById('capture-visible').style.display = "none";
        document.getElementById('capture-area').style.display = "none";
        document.getElementById('capture-fullpage').style.display = "none";
    }

    toggleScreenshotButton.addEventListener('click', () => {
        if (toggleScreenshotButton.style.height == "86px") {
            document.getElementById('capture-visible').style.display = "";
            document.getElementById('capture-area').style.display = "";
            document.getElementById('capture-fullpage').style.display = "";
            toggleScreenshotButton.style.height = "40px";
        }
        else {
            document.getElementById('capture-visible').style.display = "none";
            document.getElementById('capture-area').style.display = "none";
            document.getElementById('capture-fullpage').style.display = "none";
            toggleScreenshotButton.style.height = "86px";
        }
    });


    // Update the screenshot button handlers
    document.getElementById('capture-visible').addEventListener('click', async () => {
        captureScreen('window');  // For capturing specific windows
    });

    document.getElementById('capture-area').addEventListener('click', async () => {
        captureAreaScreenshot();
    });

    document.getElementById('capture-fullpage').addEventListener('click', async () => {
        sendRuntimeMessage({ action: "startCapture" });
    });

    // document.getElementById('upload-image').addEventListener('click', () => {
    //     const fileInput = document.getElementById('screenshot-file-input');
    //     fileInput.click();
    // });
});

// Shared screen capture function
async function captureScreen(sourceType, addNewNote = true) {
    try {
        let streamId = "";
        if (!isOnWebsite) {
            streamId = await new Promise((resolve) => {
                chrome.desktopCapture.chooseDesktopMedia(
                    Array.isArray(sourceType) ? sourceType : [sourceType],
                    null,
                    (streamId) => resolve(streamId)
                );
            });

            if (!streamId) {
                console.log('No stream selected');
                return;
            }
        }

        let stream;
        if (isOnWebsite) {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        } else {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: streamId
                    }
                }
            });
        }
        const video = document.createElement('video');
        video.srcObject = stream;
        await new Promise(resolve => video.onloadedmetadata = resolve);
        video.play();

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        stream.getTracks().forEach(track => track.stop());

        // Convert to base64 and trigger download
        const screenshot = canvas.toDataURL('image/png');
        if (addNewNote)
            downloadScreenshot(screenshot);
        return screenshot;

    } catch (error) {
        console.error('Screenshot failed:', error);
        alert('Failed to capture screenshot. Please try again.');
    }
    return null;
}


// Add this new function to handle downloads
async function downloadScreenshot(dataUrl) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const categoryName = currentCategory;

    try {
        const fileData = {
            name: `screenshot-${timestamp}.png`,
            type: 'image/png',
            size: dataUrl.length,
            data: dataUrl,
            notes: "",
            timestamp: new Date().toISOString()
        };

        // Ensure catalog section exists
        if (!document.querySelector('.catalog-section')) {
            createCatalogSection();
        }

        // Check if user is logged in
        // const authInfo = await chrome.storage.local.get('authInfo');
        if (await isUserLoggedIn2()) {
            // User is logged in, save to Firebase via background messaging
            var projectName = await getCurrentProject();
            var companyEmail = await getMainCompanyEmail();
            try {
                const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                fileData.imageId = imageId;
                sendRuntimeMessage({
                    action: "saveFirebaseData",
                    // Generate a unique ID for the image
                    path: `Companies/${companyEmail}/projects/${projectName}/categoriesImages/${currentCategory}/images/${imageId}`,
                    data: fileData
                }, response => {
                    if (!response || !response.success) {
                        console.error('Firebase save error:', response?.error);
                        showToast('Failed to save to cloud', 'error');
                    }
                });
            } catch (error) {
                console.error('Error saving to Firebase:', error);
            }
        } else {
            // Not logged in, save to local storage only
            const storageKey = `catalog_${categoryName}`;
            const result = await chrome.storage.local.get(storageKey);
            const images = result[storageKey] || [];
            images.unshift(fileData);
            await chrome.storage.local.set({ [storageKey]: images });
        }

        // Add image to grid immediately
        // addImageToGrid(fileData, false);
        updateImageGrid(categoryName);

        // Show success toast
        showToast('Screenshot saved successfully', 'success');

        // Download the file
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `screenshot-${timestamp}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        sendRuntimeMessage({ action: "refocusWindow" });
    } catch (error) {
        console.error('Error saving screenshot:', error);
        showToast('Failed to save screenshot', 'error');
    }
}

// Add these styles to your existing style.css
const styles = `
.toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    opacity: 0;
    transition: all 0.3s ease;
    z-index: 2000;
}

.toast.show {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
}

.toast.toast-success {
    background-color: #10b981;
}

.toast.toast-error {
    background-color: #ef4444;
}

.category-action-btn.upload {
    color: #288b47;
}

.category-action-btn.upload:hover {
    background-color: #ecfdf5;
}
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Add this after the screenshot-file-input event listener

async function captureAreaScreenshot(addNewNote = true, resolveFunction) {

    if (isOnWebsite)
        window.parent.postMessage({ action: "resizeSidebarToZero" }, "*");

    try {
        // First let user select which screen/window/tab to capture
        let streamId;
        if (!isOnWebsite) {
            streamId = await new Promise((resolve) => {
                chrome.desktopCapture.chooseDesktopMedia(
                    ['screen', 'window', 'tab'],
                    null,
                    (streamId) => resolve(streamId)
                );
            });

            if (!streamId) {
                console.log('No stream selected');
                return;
            }
        }

        let stream = null;
        // Get the stream
        if (isOnWebsite) {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        } else {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: streamId
                    }
                }
            });
        }

        // Create video element and play the stream
        const video = document.createElement('video');
        video.srcObject = stream;
        await new Promise(resolve => video.onloadedmetadata = resolve);
        video.play();

        // Create a canvas to draw the initial frame
        const initialCanvas = document.createElement('canvas');
        initialCanvas.width = video.videoWidth;
        initialCanvas.height = video.videoHeight;
        const ctx = initialCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        // Stop the stream after getting the frame
        stream.getTracks().forEach(track => track.stop());

        // Create selection container
        const selectionContainer = document.createElement('div');
        selectionContainer.id = 'selection-container';
        selectionContainer.style.position = 'fixed';
        selectionContainer.style.top = '0';
        selectionContainer.style.left = '0';
        selectionContainer.style.width = '100vw';
        selectionContainer.style.height = '100vh';
        selectionContainer.style.zIndex = '9999';
        selectionContainer.style.overflow = 'auto';

        // Create image wrapper
        const imageWrapper = document.createElement('div');
        imageWrapper.style.position = 'relative';
        imageWrapper.style.width = video.videoWidth + 'px';
        imageWrapper.style.height = video.videoHeight + 'px';

        // Add the captured frame as background
        const imageUrl = initialCanvas.toDataURL();
        imageWrapper.style.backgroundImage = `url(${imageUrl})`;
        imageWrapper.style.backgroundSize = '100% 100%';
        selectionContainer.appendChild(imageWrapper);

        // Create selection box
        const selectionBox = document.createElement('div');
        selectionBox.className = 'selection-area';
        imageWrapper.appendChild(selectionBox);

        document.body.appendChild(selectionContainer);

        // Add selection functionality
        let isSelecting = false;
        let startX, startY;

        imageWrapper.addEventListener('mousedown', (e) => {
            isSelecting = true;
            const rect = imageWrapper.getBoundingClientRect();
            startX = e.pageX - rect.left;
            startY = e.pageY - rect.top;

            selectionBox.style.left = startX + 'px';
            selectionBox.style.top = startY + 'px';
            selectionBox.style.width = '0';
            selectionBox.style.height = '0';
            selectionBox.style.display = 'block';
        });

        imageWrapper.addEventListener('mousemove', (e) => {
            if (!isSelecting) return;

            const rect = imageWrapper.getBoundingClientRect();
            const currentX = e.pageX - rect.left;
            const currentY = e.pageY - rect.top;

            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);

            selectionBox.style.left = Math.min(startX, currentX) + 'px';
            selectionBox.style.top = Math.min(startY, currentY) + 'px';
            selectionBox.style.width = width + 'px';
            selectionBox.style.height = height + 'px';

            selectionBox.setAttribute('data-dimensions', `${width}px × ${height}px`);
        });

        imageWrapper.addEventListener('mouseup', async () => {
            if (!isSelecting) return;
            isSelecting = false;

            const rect = imageWrapper.getBoundingClientRect();
            const scaleX = video.videoWidth / rect.width;
            const scaleY = video.videoHeight / rect.height;

            const x = parseInt(selectionBox.style.left) * scaleX;
            const y = parseInt(selectionBox.style.top) * scaleY;
            const width = parseInt(selectionBox.style.width) * scaleX;
            const height = parseInt(selectionBox.style.height) * scaleY;

            // Create a new canvas for the selected area
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');

            context.drawImage(
                initialCanvas,
                x,
                y,
                width,
                height,
                0,
                0,
                width,
                height
            );

            // Convert to base64 and trigger download
            const screenshot = canvas.toDataURL('image/png');
            if (addNewNote)
                downloadScreenshot(screenshot);
            if (resolveFunction)
                resolveFunction(screenshot);
            // Remove the selection container
            document.body.removeChild(selectionContainer);

            if (isOnWebsite)
                window.parent.postMessage({ action: "resizeSidebarToPrevious" }, "*");
        });

        if (isOnWebsite)
            window.parent.postMessage({ action: "resizeSidebarToFull" }, "*");

    } catch (error) {
        console.error('Screenshot failed:', error);
        const selectionContainer = document.getElementById('selection-container');
        if (selectionContainer) {
            document.body.removeChild(selectionContainer);
        }
        alert('Failed to capture screenshot. Please try again.');

        if (isOnWebsite)
            window.parent.postMessage({ action: "resizeSidebarToPrevious" }, "*");
    }
}

function createCatalogSection() {
    let catalogSection = document.querySelector('.catalog-section');
    if (!catalogSection) {
        catalogSection = document.createElement('div');
        catalogSection.className = 'catalog-section';

        const catalogTitle = document.createElement('h3');
        catalogTitle.className = 'catalog-title';
        catalogTitle.textContent = 'Catalog';

        const catalogGrid = document.createElement('div');
        catalogGrid.className = 'catalog-grid';

        catalogSection.appendChild(catalogTitle);
        catalogSection.appendChild(catalogGrid);

        // Insert after screenshot options content
        const screenshotOptionsContent = document.querySelector('.screenshot-options-content');
        if (screenshotOptionsContent) {
            screenshotOptionsContent.appendChild(catalogSection);
        }
    }
    return catalogSection;
}

function addImageToGrid(fileData, addToTop = false) {
    let catalogGrid = document.querySelector('.catalog-grid');
    if (!catalogGrid) {
        const catalogSection = createCatalogSection();
        catalogGrid = catalogSection.querySelector('.catalog-grid');
    }

    // Create image card
    const card = document.createElement('div');
    card.className = 'catalog-card';

    // Create image container for scroll and zoom
    const imgContainer = document.createElement('div');
    imgContainer.className = 'catalog-img-container';
    imgContainer.style.overflowY = 'auto';
    imgContainer.style.overflowX = 'auto';
    imgContainer.style.maxHeight = '350px'; // or adjust as needed
    imgContainer.style.background = '#f8fafc';

    // Create image element
    const img = document.createElement('img');
    img.dataset.originalWidth = "670";
    img.style.width = "670px";
    img.style.paddingBottom = '20px';
    img.src = fileData.data;
    img.alt = fileData.name;
    img.style.transition = 'transform 0.2s';
    img.style.display = fileData.name == '' ? 'none' : '';
    img.dataset.zoom = '1';


    // Add image to container
    imgContainer.appendChild(img);

    // Pinch-to-zoom support (trackpad gesture)
    img.addEventListener('wheel', function (e) {
        if (e.ctrlKey) {
            e.preventDefault();
            let zoom = parseFloat(img.dataset.zoom || '1');
            // e.deltaY < 0 means zoom in, > 0 means zoom out
            if (e.deltaY < 0) {
                zoom = Math.min(zoom + 0.1, 4);
            } else {
                zoom = Math.max(zoom - 0.1, 0.2);
            }
            img.dataset.zoom = zoom;
            img.style.width = parseFloat(img.dataset.originalWidth) * zoom + "px";
        }
    }, { passive: false });

    // --- Zoom Buttons ---
    const zoomBtnContainer = document.createElement('div');
    zoomBtnContainer.className = 'zoom-btn-container';
    zoomBtnContainer.style.position = 'relative';
    zoomBtnContainer.style.top = '0px';
    zoomBtnContainer.style.left = '310px';
    zoomBtnContainer.style.display = 'flex';
    zoomBtnContainer.style.flexDirection = 'row';
    zoomBtnContainer.style.gap = '10px';
    zoomBtnContainer.style.zIndex = '10';

    // Helper to create a round button
    function createZoomBtn(icon, aria, onClick) {
        const btn = document.createElement('button');
        btn.className = 'zoom-btn';
        btn.setAttribute('aria-label', aria);
        btn.innerHTML = icon;
        btn.style.width = '40px';
        btn.style.height = '40px';
        btn.style.borderRadius = '50%';
        btn.style.border = 'none';
        btn.style.background = 'rgba(255,255,255,0.95)';
        btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.fontSize = '20px';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'background 0.2s';
        btn.style.opacity = 0.5;
        btn.addEventListener('mouseenter', () => btn.style.background = '#e0e7ef');
        btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,0.95)');
        btn.addEventListener('click', onClick);
        return btn;
    }
    // Zoom in
    const zoomInBtn = createZoomBtn('<i class="fas fa-search-plus"></i>', 'Zoom in', () => {
        let zoom = parseFloat(img.dataset.zoom || '1');
        zoom = Math.min(zoom + 0.3, 4);
        img.dataset.zoom = zoom;
        img.style.width = parseFloat(img.dataset.originalWidth) * zoom + "px";
    });
    // Zoom out
    const zoomOutBtn = createZoomBtn('<i class="fas fa-search-minus"></i>', 'Zoom out', () => {
        let zoom = parseFloat(img.dataset.zoom || '1');
        zoom = Math.max(zoom - 0.3, 0.2);
        img.dataset.zoom = zoom;
        img.style.width = parseFloat(img.dataset.originalWidth) * zoom + "px";
    });
    zoomBtnContainer.appendChild(zoomOutBtn);
    zoomBtnContainer.appendChild(zoomInBtn);
    // --- End Zoom Buttons ---

    // Create note preview section
    const notePreview = document.createElement('div');
    notePreview.className = 'catalog-note-preview';

    // Load existing note if it exists
    if (fileData.note) {
        notePreview.innerHTML = "Selected Text: " + fileData.selectedText + "<br>" + fileData.note;
    } else {
        notePreview.textContent = 'No note added';
        notePreview.classList.add('no-note');
    }

    // Create bottom section for timestamp and edit icon
    const bottomSection = document.createElement('div');
    bottomSection.className = 'catalog-card-bottom';

    // Create timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'catalog-timestamp';
    timestamp.textContent = new Date(fileData.timestamp).toLocaleString();

    // Create edit note button
    const editButton = document.createElement('button');
    editButton.className = 'catalog-edit-btn';
    editButton.style.width = "50px";
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.title = 'Edit Note';

    // Keep all the existing edit button functionality
    editButton.addEventListener('click', () => {
        // Hide all main elements
        const elementsToHide = [
            '.manual-logging-content',
            '.screenshot-options-content',
            '.category-section',
            '.category-history',
            '.feature-description',
            '.screenshot-buttons',
            '.catalog-section',
            '.temp-message-header'
        ];

        elementsToHide.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
            });
        });

        // Create header container
        const headerContainer = document.createElement('div');
        headerContainer.className = 'temp-message-header';

        // Create and show back button
        const backButton = document.createElement('button');
        backButton.className = 'back-to-catalog';
        backButton.innerHTML = '<i class="fas fa-arrow-left"></i>';

        // Create title
        const title = document.createElement('h2');
        title.textContent = 'Add Note';

        // Add elements to header
        headerContainer.appendChild(backButton);
        headerContainer.appendChild(title);

        // Create note editor container
        const noteEditorContainer = document.createElement('div');
        noteEditorContainer.className = 'note-editor-container';

        // Create toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'textEditortool-list';
        toolbar.innerHTML = `
            <button type="button" data-command="removeFormat" class="textEditortool--btn">
                <i class="fas fa-eraser"></i>
            </button>
            <button type="button" data-command="createLink" class="textEditortool--btn">
                <i class="fas fa-link"></i>
            </button>
            <button type="button" data-command="justifyLeft" class="textEditortool--btn">
                <i class="fas fa-align-left"></i>
            </button>
            <button type="button" data-command="justifyCenter" class="textEditortool--btn">
                <i class="fas fa-align-center"></i>
            </button>
            <button type="button" data-command="bold" class="textEditortool--btn">
                <i class="fas fa-bold"></i>
            </button>
            <button type="button" data-command="italic" class="textEditortool--btn">
                <i class="fas fa-italic"></i>
            </button>
            <button type="button" data-command="underline" class="textEditortool--btn">
                <i class="fas fa-underline"></i>
            </button>
            <button type="button" data-command="insertOrderedList" class="textEditortool--btn">
                <i class="fas fa-list-ol"></i>
            </button>
            <button type="button" data-command="insertUnorderedList" class="textEditortool--btn">
                <i class="fas fa-list-ul"></i>
            </button>
            <select class="textEditortool--btn" id="fontSizeSelector">
                <option value="1">10 pt</option>
                <option value="2">12 pt</option>
                <option value="3">14 pt</option>
                <option value="4">16 pt</option>
                <option value="5">18 pt</option>
                <option value="6">20 pt</option>
                <option value="7">22 pt</option>
            </select>
            <button id="addImageToLog-captureVisiblePart" class="textEditortool--btn" title="Image from Capture Visible Part"><i class="fas fa-desktop"></i></button>
            <button id="addImageToLog-captureCrop" class="textEditortool--btn" title="Image from Capture Selected Area"><i class="fas fa-crop-alt"></i></button>
            <button id="addImageToLog-upload" class="textEditortool--btn" title="Image from Upload"><i class="fas fa-upload"></i></button>
        `;

        // Add handlers for the new select elements
        const fontSizeSelector = toolbar.querySelector('#fontSizeSelector');

        fontSizeSelector.addEventListener('change', () => {
            document.execCommand('fontSize', false, fontSizeSelector.value);
        });

        // Update the link button handler
        toolbar.querySelector('[data-command="createLink"]').addEventListener('click', () => {
            const url = prompt('Enter the URL:', 'http://');
            if (url) {
                document.execCommand('createLink', false, url);
            }
        });

        toolbar.querySelector('#addImageToLog-captureVisiblePart').addEventListener('click', async () => {
            let data = await captureScreen('window', false);
            fileData.data = data;
            fileData.type = "image/png";
            fileData.size = data.length;
            fileData.name = `screenshot-${fileData.timestamp}.png`;
            showToast('Image successfully added', 'success');
            let imgPreview = document.getElementById("note-img-preview");
            if (imgPreview) {
                imgPreview.style.display = "block";
                imgPreview.src = fileData.data;
            }
        });

        toolbar.querySelector('#addImageToLog-captureCrop').addEventListener('click', async () => {
            function resolved(data) {
                fileData.data = data;
                fileData.type = "image/png";
                fileData.size = data.length;
                fileData.name = `screenshot-${fileData.timestamp}.png`;
                showToast('Image successfully added', 'success');
                let imgPreview = document.getElementById("note-img-preview");
                if (imgPreview) {
                    imgPreview.style.display = "block";
                    imgPreview.src = fileData.data;
                }
            }

            captureAreaScreenshot(false, resolved);
        });

        toolbar.querySelector('#addImageToLog-upload').addEventListener('click', () => {
            fileUploadInstantReturn = function (fileData2) {
                fileData.data = fileData2.data;
                fileData.type = fileData2.type;
                fileData.size = fileData2.size;
                fileData.name = fileData2.name;
                showToast('Image successfully added', 'success');
                let imgPreview = document.getElementById("note-img-preview");
                if (imgPreview) {
                    imgPreview.style.display = "block";
                    imgPreview.src = fileData.data;
                }
            }
            const fileInput = document.getElementById('screenshot-file-input');
            fileInput.click();
        });

        // Create editor
        const editor = document.createElement('div');
        editor.id = 'screenshot-note-editor';
        editor.className = 'note-editor';
        editor.contentEditable = true;

        // Load existing note content if it exists
        if (fileData.note) {
            editor.innerHTML = fileData.note;
        }
        console.log('fileData', fileData);

        // Create save button
        const saveButton = document.createElement('button');
        saveButton.className = 'save-note-btn';
        saveButton.innerHTML = '<i class="fas fa-save"></i> Save Note';

        // Add click handlers for toolbar buttons
        toolbar.querySelectorAll('.textEditortool--btn').forEach(button => {
            button.addEventListener('click', () => {
                const command = button.getAttribute('data-command');
                document.execCommand(command, false, null);
            });
        });

        // Add save functionality
        saveButton.addEventListener('click', async () => {
            if (await isUserLoggedIn2()) {
                const noteContent = editor.innerHTML;
                const header = document.querySelector('.temp-message-header h2');
                const categoryMatch = header.textContent.match(/Screenshot Options - (.+)/);
                currentCategory = categoryMatch ? categoryMatch[1] : currentCategory;

                if (!currentCategory) {
                    showToast('Error: No category selected', 'error');
                    return;
                }

                try {
                    var projectName = await getCurrentProject();
                    var companyEmail = await getMainCompanyEmail();
                    // Update Firebase with the new note content
                    sendRuntimeMessage({
                        action: "saveFirebaseData",
                        path: `Companies/${companyEmail}/projects/${projectName}/categoriesImages/${currentCategory}/images/${fileData.imageId}`,
                        data: {
                            ...fileData,
                            note: noteContent,
                            selectedText: SELECTED_TEXT
                        }
                    }, response => {
                        if (!response || !response.success) {
                            console.error('Firebase save error:', response?.error);
                            showToast('Failed to save to cloud', 'error');
                            return;
                        }

                        // Update the note preview
                        notePreview.innerHTML = noteContent;
                        notePreview.classList.remove('no-note');

                        showToast('Note saved successfully', 'success');

                        // Return to previous screen
                        backButton.click();
                        updateImageGrid(currentCategory);
                    });

                } catch (error) {
                    console.error('Error saving note:', error);
                    showToast('Failed to save note', 'error');
                }
            }
            else {
                const header = document.querySelector('.temp-message-header h2');
                const categoryMatch = header.textContent.match(/Screenshot Options - (.+)/);
                currentCategory = categoryMatch ? categoryMatch[1] : currentCategory;

                if (!currentCategory) {
                    showToast('Error: No category selected', 'error');
                    return;
                }

                const noteContent = editor.innerHTML;
                const storageKey = `catalog_${currentCategory}`;

                try {
                    const result = await chrome.storage.local.get(storageKey);
                    const images = result[storageKey] || [];
                    const imageIndex = images.findIndex(img => img.data === fileData.data);

                    if (imageIndex !== -1) {
                        images[imageIndex].note = noteContent;
                        images[imageIndex].selectedText = SELECTED_TEXT;
                        await chrome.storage.local.set({ [storageKey]: images });

                        // Update the note preview
                        notePreview.innerHTML = noteContent;
                        notePreview.classList.remove('no-note');

                        showToast('Note saved successfully', 'success');

                        // Return to previous screen
                        backButton.click();
                        updateImageGrid(currentCategory);
                    }
                } catch (error) {
                    console.error('Error saving note:', error);
                    showToast('Failed to save note', 'error');
                }
            }
        });

        // Add elements to note editor container
        var imgPreview = document.createElement("img");
        if (fileData.data) {
            imgPreview.src = fileData.data;
            imgPreview.style.display = "block";
        }
        else {
            imgPreview.style.display = "none";
        }
        imgPreview.style.width = "100px";
        imgPreview.style.maxHeight = "100px";
        imgPreview.style.width = "auto";
        imgPreview.style.objectFit = "cover";
        imgPreview.style.objectPosition = "top";
        imgPreview.style.border = "1px solid black";
        imgPreview.style.borderRadius = "5px";
        imgPreview.id = "note-img-preview";

        noteEditorContainer.appendChild(imgPreview);
        noteEditorContainer.appendChild(toolbar);
        noteEditorContainer.appendChild(editor);
        noteEditorContainer.appendChild(saveButton);

        // Add everything to the page
        const container = document.querySelector('.screenshot-options-content');
        container.parentNode.insertBefore(headerContainer, container);
        container.parentNode.insertBefore(noteEditorContainer, container);

        // Update back button click handler
        backButton.addEventListener('click', () => {
            headerContainer.remove();
            noteEditorContainer.remove();

            // Show all previously hidden elements
            elementsToHide.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    element.style.display = '';
                });
            });
        });
    });


    const deleteButton = document.createElement('button');
    deleteButton.className = 'catalog-delete-btn';
    deleteButton.style.width = "50px";
    deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
    deleteButton.title = 'Delete Note';

    deleteButton.addEventListener('click', async () => {
        await callSetItem(`categoriesImages/${currentCategory}/images/${fileData.imageId}`, null);
        updateImageGrid(currentCategory);
    });

    // Add elements to bottom section
    bottomSection.appendChild(timestamp);
    bottomSection.appendChild(editButton);
    bottomSection.appendChild(deleteButton);
    bottomSection.appendChild(zoomBtnContainer);

    // Add elements to card in order
    card.appendChild(imgContainer);
    card.appendChild(bottomSection);
    card.appendChild(notePreview);

    // Add card to grid at the beginning
    if (addToTop) {
        catalogGrid.insertBefore(card, catalogGrid.firstChild);
    } else {
        catalogGrid.appendChild(card);
    }
    return card;
}

// Add these styles to your catalogStyles
const catalogStyles = `
.catalog-section {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid #e2e8f0;
}

.catalog-title {
    font-size: 18px;
    font-weight: 500;
    color: var(--color-dark-grey);
    margin-bottom: 16px;
}

.catalog-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 16px;
}

.catalog-card {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: all 0.2s ease;
    width: 100%;
    display: flex;
    flex-direction: column;
    position: relative; /* Add this so .zoom-btn-container is positioned relative to card */
}

.catalog-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.catalog-img-container {
    position: relative;
    overflow-y: auto;
    overflow-x: auto;
    max-height: 350px;
    background: #f8fafc;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
}

.img {
    height: auto;
    transition: transform 0.2s;
    display: block;
}

.zoom-btn-container {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 10;
    pointer-events: auto;
}

.zoom-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.95);
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    cursor: pointer;
    transition: background 0.2s;
}
.zoom-btn:hover {
    background: #e0e7ef;
}

.catalog-timestamp {
    padding: 12px;
    font-size: 12px;
    color: var(--color-grey);
    text-align: left;
    border-top: 1px solid #e2e8f0;
}

.catalog-card-bottom {
    display: flex;
    justify-content: start;
    align-items: center;
    padding: 12px;
    border-top: 1px solid #e2e8f0;
}

.catalog-timestamp {
    font-size: 12px;
    color: var(--color-grey);
}

.catalog-edit-btn {
    background: none;
    border: none;
    color: var(--color-grey);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.catalog-edit-btn:hover {
    color: #288b47;
    background-color: #ecfdf5;
}

.catalog-edit-btn i {
    font-size: 14px;
}

.catalog-delete-btn {
    background: none;
    border: none;
    color: var(--color-grey);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.catalog-delete-btn:hover {
    color:rgb(139, 40, 40);
    background-color:rgb(253, 236, 238);
}

.catalog-delete-btn i {
    font-size: 14px;
}
`;

// Add catalog styles to document
const catalogStyleSheet = document.createElement('style');
catalogStyleSheet.textContent = catalogStyles;
document.head.appendChild(catalogStyleSheet);

// Add this to load existing images when the page loads

// document.addEventListener('DOMContentLoaded', async () => {
//     try {
//         const result = await chrome.storage.local.get('catalogImages');
//         if (result.catalogImages && result.catalogImages.length > 0) {
//             createCatalogSection();
//             result.catalogImages.forEach(fileData => {
//                 addImageToGrid(fileData, true);
//             });
//         }
//     } catch (error) {
//         console.error('Error loading catalog images:', error);
//     }
// });

// Add this function if it doesn't exist
function showScreenshotOptions(categoryName) {
    const screenshotOptionsMessage = document.getElementById('screenshot-options-message');
    const manualLoggingMessage = document.getElementById('manual-logging-message');

    // Update header to show category
    const header = screenshotOptionsMessage.querySelector('h2');
    header.textContent = `Screenshot Options - ${categoryName}`;

    // Store the category name
    currentCategory = categoryName;

    manualLoggingMessage.style.display = 'none';
    screenshotOptionsMessage.style.display = 'block';
}

// Update the category click handler in frames.js
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...

    // Add category click handler
    document.getElementById('category-list').addEventListener('click', (e) => {
        const categoryItem = e.target.closest('.category-item');
        if (categoryItem) {
            const categoryName = categoryItem.querySelector('.category-name').textContent;
            currentCategory = categoryName; // Set the current category
            // showScreenshotOptions(categoryName);
        }
    });
});

// Add this debug function to frames.js
async function debugViewStorage() {
    const allStorage = await chrome.storage.local.get(null);
    console.log('All Storage:', allStorage);

    // Look specifically for catalog entries
    Object.keys(allStorage).forEach(key => {
        if (key.startsWith('catalog_')) {
            console.log(`\nCategory: ${key.replace('catalog_', '')}`);
            console.log('Contents:', allStorage[key]);
        }
    });
}

// Add a debug button to view storage
document.addEventListener('DOMContentLoaded', () => {
    // Add debug button after the save button
    const debugButton = document.createElement('button');
    debugButton.className = 'note-panel-button';
    debugButton.innerHTML = '<i class="fas fa-bug"></i> View Storage';
    debugButton.addEventListener('click', debugViewStorage);

    // Add it to the note editor container
    const noteEditorContainer = document.querySelector('.note-editor-container');
    if (noteEditorContainer) {
        noteEditorContainer.appendChild(debugButton);
    }
});

function updateImageGrid(categoryName) {
    // Remove existing catalog section if it exists
    const existingCatalog = document.querySelector('.catalog-section');
    if (existingCatalog) {
        existingCatalog.remove();
    }

    // Create fresh catalog section
    createCatalogSection();
    // Check if user is logged in and fetch images from Firebase
    // First check if user is logged in
    isUserLoggedIn2().then(async (isLoggedIn) => {
        if (isLoggedIn) {
            // Get user ID from storage
            const authResult = firebase.auth().currentUser;
            if (authResult) {
                var companyEmail = await getMainCompanyEmail();
                var projectName = await getCurrentProject();
                // Request images from Firebase through background script
                sendRuntimeMessage({
                    action: "getFirebaseData",
                    path: `Companies/${companyEmail}/projects/${projectName}/categoriesImages/${categoryName}/images`
                }, response => {
                    if (response && response.success && response.data) {
                        // Convert object of objects to array
                        const imagesArray = Object.values(response.data);

                        // Add each image from Firebase to the grid
                        imagesArray.forEach(imageData => {
                            addImageToGrid(imageData, true);
                        });
                    } else {
                        console.error('Failed to fetch images from Firebase:', response?.error);
                    }
                });
            }
        } else {
            // Load existing images for this category from local storage
            chrome.storage.local.get(`catalog_${categoryName}`, (result) => {
                const categoryImages = result[`catalog_${categoryName}`] || [];
                if (categoryImages.length > 0) {
                    categoryImages.forEach(fileData => {
                        addImageToGrid(fileData, true);
                    });
                }
            });
        }
    });
    isUserLoggedIn2().then(async (isLoggedIn) => {
        if (isLoggedIn) {
            // Get user ID from storage
            const authResult = firebase.auth().currentUser;
            if (authResult) {
                // Request images from Firebase through background script
                // sendRuntimeMessage({
                //     action: "getImages",
                //     userId: authResult.authInfo.uid,
                //     categoryName: categoryName
                // }, response => {
                //     if (response && response.success && response.images) {
                //         // Add each image from Firebase to the grid
                //         response.images.forEach(imageData => {
                //             addImageToGrid(imageData, true);
                //         });
                //     } else {
                //         console.error('Failed to fetch images from Firebase:', response?.error);
                //     }
                // });
            }
        }
        else {
            // Load existing images for this category
            chrome.storage.local.get(`catalog_${categoryName}`, (result) => {
                const categoryImages = result[`catalog_${categoryName}`] || [];
                if (categoryImages.length > 0) {
                    categoryImages.forEach(fileData => {
                        addImageToGrid(fileData, true);
                    });
                }
            });
        }
    });


}

function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        category: params.get('category')
    };
}

// Example usage
const queryParams = getQueryParams();
if (queryParams.category != null) {
    hideSplashScreen();
    document.getElementById('userSettings').click();
    setTimeout(async () => {
        document.getElementById('manual-logging').click();
        if (!navigateToCategory(queryParams.category)) {
            document.getElementById('category-input').value = queryParams.category;
            document.getElementById('add-category-btn').click();
        }
        setTimeout(() => {
            navigateToCategory(queryParams.category);
            captureAreaScreenshot();
        }, 1000);
    }, 250);
}

function findCategory(categoryName) {
    // Get all category items
    const categoryItems = document.querySelectorAll('.category-item');

    // Iterate through each category item
    for (const item of categoryItems) {
        // Find the category-name span within this item
        const categoryNameSpan = item.querySelector('.category-name');

        // If we found the span and its text matches our search
        if (categoryNameSpan && categoryNameSpan.textContent.trim() === categoryName) {
            return item; // Return the found category item
        }
    }

    return null; // Return null if category not found
}

// Example usage:
function navigateToCategory(categoryName) {
    const categoryItem = findCategory(categoryName);
    if (categoryItem) {
        // Simulate a click on the category
        categoryItem.click();
        return true;
    } else {
        console.warn(`Category "${categoryName}" not found`);
        return false;
    }
}

// Add this with your other button event listeners
// document.getElementById("Back2").addEventListener("click", () => {
//     hideAllSubFrames();
//     mainMenu();
// });

// Add this with your other button event listeners
const backNoteButton = document.getElementById("Back-note");
if (backNoteButton) {
    backNoteButton.addEventListener("click", () => {
    hideAllSubFrames();
    mainMenu(); // Navigate back to main menu
});
}

// Add this with your other button event listeners
const videoAnnotationBackButton = document.getElementById("video-annotation-back");
if (videoAnnotationBackButton) {
    videoAnnotationBackButton.addEventListener("click", () => {
    hideAllSubFrames();
    mainMenu(); // Navigate back to main menu
});
}

// Add this with your other event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize toggle state from storage
    if (!isOnWebsite)
        chrome.storage.sync.get('manualLoggingEnabled', ({ manualLoggingEnabled }) => {
            // If manualLoggingEnabled is undefined (first time), set it to true
            if (manualLoggingEnabled === undefined) {
                chrome.storage.sync.set({ manualLoggingEnabled: true });
                document.getElementById('manual-logging-toggle').checked = true;
            } else {
                document.getElementById('manual-logging-toggle').checked = manualLoggingEnabled;
            }
        });

    // Add toggle event listener
    if (!isOnWebsite) {
        const manualLoggingToggle = document.getElementById('manual-logging-toggle');
        if (manualLoggingToggle) {
            manualLoggingToggle.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            chrome.storage.sync.set({ manualLoggingEnabled: isEnabled });
        });
        }
    }
});

async function renderCategories() {
    const result = firebase.auth().currentUser;
    if (await isUserLoggedIn2()) {
        var projectName = await getCurrentProject();
        var companyEmail = await getMainCompanyEmail();
        // User is logged in, get categories from Firebase
        sendRuntimeMessage({
            action: "getFirebaseData",
            path: `Companies/${companyEmail}/projects/${projectName}/manualLoggingCategories`
        }, (response) => {
            if (response && response.success) {
                // Convert Firebase object to array of category names
                const categories = [];
                for (let key in response.data) {
                    if (response.data[key].name) {
                        categories.push(response.data[key].name);
                    }
                }
                renderCategories2(categories);
            }
        });
    } else {
        // User not logged in, use local storage
        chrome.storage.local.get('manualLoggingCategories', (result) => {
            const categories = result.manualLoggingCategories || [];
            renderCategories2(categories);
        });
    }
}

function renderCategories2(categories) {
    const categoryList = document.getElementById('category-list');
    categoryList.innerHTML = '';
    categories.forEach((category, index) => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item';
        categoryItem.innerHTML = `
            <span class="category-name">${category}</span>
            <div class="category-actions">
                <button class="category-action-btn upload" data-index="${index}">
                    <i class="fas fa-upload"></i>
                </button>
                <button class="category-action-btn edit" data-index="${index}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="category-action-btn delete" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        categoryList.appendChild(categoryItem);

        // Add file input for this category
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*,.pdf,.doc,.docx,.txt';
        fileInput.style.display = 'none';
        fileInput.id = `file-input-${index}`;
        categoryItem.appendChild(fileInput);

        // Add upload functionality
        const uploadBtn = categoryItem.querySelector('.upload');

        uploadBtn.addEventListener('click', (e) => {
            uploadBtn.parentElement.click();
            document.getElementById('upload-image').click();
        });

    });
}

export async function getUserEmail() {
    if (firebase.auth().currentUser)
        return firebase.auth().currentUser.email.replace(".", ",");
    try {
        const result = localStorage.getItem('currentUser');
        if (result) {
            let user = JSON.parse(result);
            return user.email.replace('.', ',');
        }
        return null;
    } catch (error) {
        console.error('Error getting user email:', error);
        return null;
    }
}
//Allows calling function from the developer console
window.getUserEmail = getUserEmail;
window.callGetItem = callGetItem;