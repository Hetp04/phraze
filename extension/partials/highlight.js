import { isOnWebsite } from "../globalVariables.js";
console.warn('-- highlight.js --');



// use this function
export function getTextURL(text) {
    if (isOnWebsite)
        return localStorage.getItem("currentUrl");

    console.warn(`--- getTextURL(${text}) ---`);
    return new Promise((resolve, reject) => {
        // Retrieve all stored data
        chrome.storage.sync.get('currentHighlight', (data) => {
            if (chrome.runtime.lastError) {
                console.error('Error retrieving data:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                // console.log('Retrieved data:', data);

                const { currentHighlight } = data;
                if (currentHighlight) {
                    const { selectedText, url } = currentHighlight;
                    // console.log('Selected Text:', selectedText);
                    // console.log('URL:', url);

                    // Check if the selectedText matches the provided text
                    if (selectedText === text) {
                        resolve(url);  // Resolve with the URL if text matches
                    } else {
                        resolve(null);  // Resolve with null if text doesn't match
                    }
                } else {
                    console.warn('No currentHighlight found.');
                    resolve(null);  // Resolve with null if no highlight exists
                }
            }
        });
    });
}


