// Define and export your function

// Import the function from _utils.js
import { addSelectedTextEntry, deleteOptionByKey, deleteKey, onClickKeyLabels, callGetItem } from '../frames.js';


export function customFrameMenu2(userText, item, type) {

    // const item  = extractOriginalItem(originalItem);

    console.log(`-- customFrameMenu(userText = ${userText}, key = ${item.key}, type = ${type}) --`);

    hideAllSubFrames();
    showFrame(`custom-${type}-sub-frame-2-custom-label`);
    showFrame(`custom-${type}-sub-frame-2-custom`);
    showFrame(`custom-${type}-sub-frame-2-custom-options`);
    showCustomFrameMenuOptions(userText, item, type);
    showFrame(`custom-${type}-sub-frame-2-custom-delete`);
    showFrame(`custom-${type}-sub-frame-2-custom-button`);
}

export async function customFrameMenu(userText, key, type) {
    console.warn(`-- customFrameMenu(userText = ${userText}, key = ${key}, type = ${type}) --`);

    // Fetch the latest data for this specific key
    let itemValue = null;
    try {
        const customObjectResult = await callGetItem("customLabelsAndCodes");
        const customObject = Object.values(customObjectResult || {})[0] || {};
        if (customObject && customObject.hasOwnProperty(key)) {
            itemValue = customObject[key];
            console.log(`customFrameMenu: Fetched value for key '${key}':`, JSON.stringify(itemValue));
        } else {
            console.error(`customFrameMenu: Could not find data for key '${key}' in customObject.`);
            // Optionally show an error to the user or handle appropriately
            return; // Exit if data not found
        }
    } catch (error) {
        console.error(`customFrameMenu: Error fetching customLabelsAndCodes:`, error);
        return; // Exit on error
    }

    // Construct the item object needed by showCustomFrameMenuOptions
    const item = { key: key, value: itemValue };

    hideAllSubFrames();
    showFrame(`custom-${type}-sub-frame-2-custom-label-div`);
    showFrame(`custom-${type}-sub-frame-2-custom`);
    showFrame(`custom-${type}-sub-frame-2-custom-options`);
    showCustomFrameMenuOptions(userText, item, type); // Pass the newly fetched item
    showFrame(`custom-${type}-sub-frame-2-custom-delete`);
    showFrame(`custom-${type}-sub-frame-2-custom-button`);
}

var currentOptions = [];

function showCustomFrameMenuOptions(userText, item, type){
    console.warn(`-- showCustomFrameMenuOptions(userText = ${userText}, key = ${item.key}, type = ${type}) --`);

    console.log('item passed to showCustomFrameMenuOptions', JSON.stringify(item)); // Add detailed logging

    let capType = "Label";

    console.log('item.key', item.key);
    console.log('item.value', item.value);

    // Safely access options, defaulting to an empty array if structure is wrong
    const optionsArray = (item.value && Array.isArray(item.value.options)) ? item.value.options : [];
    console.log('Extracted optionsArray:', optionsArray);

    // Create the HTML string
    let htmlString = 'Options:<ol>';
    // Check if optionsArray is indeed an array before iterating (extra safety)
    if (Array.isArray(optionsArray)) {
        optionsArray.forEach(option => {
            htmlString += `<li id="li-icon-${option}-2" class="li-container pt-2 pb-2 pe-4">
            <span>${option}</span>
            <span id="li-icon-${option}" class="delete-option">x</span>
            </li>`;
        });
    } else {
        console.error('optionsArray is not an array after check! Should not happen.', optionsArray);
    }
    htmlString += '</ol>';

    let deleteButton = `<button id="custom-${type}-2-delete-${item.key}" class="frame-button frame-button-delete">
        <i class="fa fa-solid fa-trash" style="color: #626262;"></i>
        <span>Delete</span>
        </button>`;


    document.getElementById(`custom-${type}-sub-frame-2-custom-delete`).innerHTML = deleteButton;
    let deleteButtonClicked = document.getElementById(`custom-${type}-2-delete-${item.key}`);

    // Todo ↘ Options Delete Button
    deleteButtonClicked.addEventListener("click", () => {
        // update type later
        console.log('delete 222 clicked for key:', item.key);
        deleteKey(item.key, type);
    });


// Set the generated HTML string as the innerHTML of the target element
    const optionsContainerId = `custom-${type}-sub-frame-2-custom-options`;
    const optionsContainer = document.getElementById(optionsContainerId);
    console.log(`Targeting options container: #${optionsContainerId}`); // Log target ID
    console.log('Generated HTML:', htmlString); // Log the HTML

    if (optionsContainer) {
        optionsContainer.innerHTML = htmlString;
        console.log('Successfully set innerHTML for options container.');
    } else {
        console.error(`Options container element not found: #${optionsContainerId}`);
    }

    document.getElementById(`custom-${type}-sub-frame-2-custom-label`).innerHTML = `<h3 id="custom-${type}-key" class="py-2">${item.key}</h3>`

    // Re-attach listeners for the newly created options
    if (Array.isArray(optionsArray)) {
        optionsArray.forEach(option => {
            let clickedDeleteOption = document.getElementById(`li-icon-${option}`);
            if (clickedDeleteOption) {
                clickedDeleteOption.addEventListener("click", (e) => {
                    // Prevent event bubbling up to the li element
                    e.stopPropagation();
                    console.log(`Delete option clicked: ${option} for key: ${item.key}`);
                    deleteOptionByKey(item.key, option, type);
                });
            }

            let clickedSelectOption = document.getElementById(`li-icon-${option}-2`);
            if (clickedSelectOption) {
                clickedSelectOption.addEventListener("click", async (e) => {
                    // Only trigger if the li element itself was clicked, not if the delete button was clicked
                    if (e.target.classList.contains('delete-option') || e.target.parentNode.classList.contains('delete-option')) {
                        return; // Exit if clicking on delete button or its children
                    }
                    console.log(`Select option clicked: ${option} for key: ${item.key}`);
                    await addSelectedTextEntry(userText, item.key, type, option);
                });
            }
        });
    }
}




/**
 * These methods hide the subframes
 * @param id
 */
export function hideFrame(id) {
    document.getElementById(id).style.display = "none";
}
export function showFrame(id) {
    if(document.getElementById(id)){
        document.getElementById(id).style.display = "flex";
    }else{
        console.error(`${id} doesn't exist`)
    }
}
export function showFrameLabel(id, label){
    document.getElementById(id).innerText = label;
}
export function showFrameAndDisplay(frameId, displayId, key, type, selectedText) {
    console.log(`-- showFrameAndDisplay(${frameId}, ${displayId}, key = ${key}, type = ${type}), text = ${selectedText} --`);
    // needs key, keyOption, type
    // Get the frame element by ID
    document.getElementById(frameId).style.display = "flex";

    let myFrame = document.getElementById(frameId);

    for (let i = 0; i < myFrame.children.length; i++) {
        let child = myFrame.children[i];

        if(child.id !== displayId){
            child.style.display = "none";
        }
        if(child.id == displayId ){
            child.style.display = "";


            // Get the parent element by its ID
            const parentElement = document.getElementById(displayId);
            console.log(`parentElement = ${parentElement.innerHTML}`);

            // Get all buttons with the class 'frame-button-1' within the parent element
            const buttons = parentElement.querySelectorAll('.frame-button-1');

            buttons.forEach(button => {
                button.onclick = handleClick(key, type, selectedText);
            });
        }
    }
}

// Function to handle button click
function handleClick(key, type, selectedText) {
    console.log(`handleClick(key = ${key}, type = ${type}, selectedText = ${selectedText})`)
    return async function (event) {
        const keyOption = event.target.id;
        await addSelectedTextEntry(selectedText, key, type, keyOption);
    };
}

export function hideAllSubFrames() {
    const subFrames = document.querySelectorAll(".sub-frame");
    subFrames.forEach((subFrame) => {
        subFrame.style.display = "none";
    });
}

// Nav Dropdown
document.addEventListener('DOMContentLoaded', function () {
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.nav-dropdown-menu');

    dropdownToggle.addEventListener('click', function () {
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', function (e) {
        if (!dropdownToggle.contains(e.target)) {
            dropdownMenu.style.display = 'none';
        }
    });
});

