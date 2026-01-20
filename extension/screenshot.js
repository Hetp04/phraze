import { sendRuntimeMessage, getUserEmail, getCurrentProject} from './frames.js';
import { getMainCompanyEmail, isUserLoggedIn } from './partials/auth.js';

async function callGetItem(key, prefixProjectName = true) {
    console.warn(`-- callGetItem(key = ${key}) --`);
    var companyEmail = await getMainCompanyEmail();
    var projectName = await getCurrentProject();
    // firebase get
    if (await isUserLoggedIn()) {
        if (prefixProjectName)
            key = `Companies/${companyEmail}/projects/${projectName}/${key}`;
        // console.log(`${key} exists in firebaseKeyList`);
        // getUserDataDatabase(key);
        return new Promise(async (resolve, reject) => {
            sendRuntimeMessage({
                action: "getFirebaseData",
                path: `Companies/${companyEmail}/projects/${projectName}/${key}`
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

document.addEventListener('DOMContentLoaded', async () => {
    // Load existing categories
    await loadCategories();

    // Add event listeners
    document.getElementById('screenshot_add_new').addEventListener('click', addNewCategory);
    document.getElementById('screenshot_use_existing').addEventListener('click', useExistingCategory);
});

async function loadCategories() {
    let categories = Object.values(await callGetItem('manualLoggingCategories') || []);
    console.log(categories);
    if(categories.length > 0)
        categories = categories[0];


    const select = document.getElementById('screenshot_existing_categories');
    select.innerHTML = '';

    for(let category of Object.keys(categories)) {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    }
    // categories.forEach(([key, value]) => {
    //     const option = document.createElement('option');
    //     option.value = key;
    //     option.textContent = key;
    //     select.appendChild(option);
    // });

}

function addNewCategory() {
    const input = document.getElementById('screenshot_new_categories');
    const category = input.value.trim();

    if (!category) {
        return;
    }

    chrome.storage.local.get('screenshotCategories', (result) => {
        const categories = result.screenshotCategories || [];
        if (!categories.includes(category)) {
            categories.push(category);
            chrome.storage.local.set({ screenshotCategories: categories }, () => {
                loadCategories(categories);
                input.value = '';
                proceedWithScreenshot(category);
            });
        } else {
            proceedWithScreenshot(category);
        }
    });
}

function useExistingCategory() {
    const select = document.getElementById('screenshot_existing_categories');
    const category = select.value;
    if (category) {
        proceedWithScreenshot(category);
    }
}

function proceedWithScreenshot(category) {
    // Get the selected text from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const selectedText = urlParams.get('text');

    sendRuntimeMessage({
        action: 'proceedWithScreenshot',
        category: category
    }, () => {
        // Pass both category and selected text to popup.html
        const url = chrome.runtime.getURL(
            `popup.html?category=${encodeURIComponent(category)}&text=${encodeURIComponent(selectedText)}`
        );
        chrome.windows.create({
            url: url,
            type: 'popup',
            width: 800,
            height: 1080
        });

        window.close();
    });
}

