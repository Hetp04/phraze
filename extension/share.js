import { labelMap, codeMap, isOnWebsite } from "./globalVariables.js"
const addButtons = false; //Should buttons be added to each annotation row that allow editing

var searchedValue = ["", ""];

const { customCodeMap, customLabelMap, noteMap } = testingStorageReturns();

const codeMapping = {
    ...codeMap,
    ...customCodeMap
}

const labelMapping = {
    ...labelMap,
    ...customLabelMap
}

function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        uid: params.get('uid'),
        project: params.get('project'),
        companyEmail: params.get('companyEmail')
    };
}

var email = getQueryParams().uid.replace('.', ',');
var project = getQueryParams().project;
var companyEmail = getQueryParams().companyEmail.replace('.', ',');

function getCurrentProject() {
    return project;
}
function getMainCompanyEmail() {
    return companyEmail;
}

// Set up Firebase data listener
sendRuntimeMessage({
    action: "listenerFirebaseData",
    path: `Companies/${companyEmail}/projects/${project}/annotationHistory`
}, response => {
    if (response && response.success) {
        console.log("Firebase listener set up successfully");
    } else {
        console.error("Failed to set up Firebase listener");
    }
});

var currentFirebaseData = "";
// Add listener for Firebase data changes
if (!isOnWebsite)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "firebaseDataChanged" &&
            message.path === `Companies/${companyEmail}/projects/${project}/annotationHistory`) {
            // Store the updated data and refresh the table
            if (message.data) {
                currentFirebaseData = message.data;
                populateAnnotationHistoryTable();
            }
        }
        return true;
    });

async function populateAnnotationHistoryTable() {
    console.log("Populating annotation history table");
    const tableContainer = document.getElementById("sub-frame-annotation-table");
    if (!tableContainer) {
        console.error("Table container not found");
        return;
    }

    // Populate the table with data
    tableContainer.innerHTML = await parseHistoryData("");
    tableContainer.style.display = "block"; // Ensure table is visible


    // Add search functionality
    const searchInput = document.getElementById('annotation-history-search-input');
    if (searchInput) {
        searchInput.removeEventListener('input', handleSearchInput); // Remove any existing listener
        searchInput.addEventListener('input', handleSearchInput);
    }
}

async function parseHistoryData(filterText) {
    console.log(`-- parseLocalStorageData(filterText = ${filterText}) --`);

    var projectName = await getCurrentProject();
    var companyEmail = await getMainCompanyEmail();
    return new Promise((resolve, reject) => {
        sendRuntimeMessage({
            action: "getFirebaseData",
            path: `Companies/${companyEmail}/projects/${projectName}/annotationHistory`
        }, response => {
            if (response && response.success && response.data) {
                // Parse the Firebase data string into an array
                let data = [{
                    key: "annotationHistory", value: { "annotationHistory": response.data }
                }]
                resolve(getTableHTML(data, filterText));
            } else {
                resolve(getTableHTML([], filterText)); // Empty data if no response
            }
        });
    });

}
function getTableHTML(dataList, filterText = "", projectName = "") {
    var annotation = "annotationHistory";
    if (projectName != "") {
        annotation = projectName + "/" + annotation;
    }
    let count = 1;
    let annotationHistoryRow = "";

    // Add select all checkbox header
    annotationHistoryRow += `
        <div class="annotation-history-header">
            <label class="checkbox-container">
                <input type="checkbox" id="select-all-entries" checked>
                <span class="checkmark"></span>
                Select All
            </label>
        </div>
    `;

    // Ensure dataList is an array
    if (!Array.isArray(dataList)) {
        console.error('|getTableHTML| dataList is not an array:', dataList);
        return annotationHistoryRow;
    }

    console.log('|getTableHTML| dataList', dataList);
    dataList.forEach(entry => {
        console.log('|getTableHTML| entry', entry);
        // Skip this entry if a type filter is selected and doesn't match
        // if (typeFilter && entry.key === annotation) {
        //     const jsonData = JSON.parse(entry.value);
        //     const hasMatchingType = jsonData.some(item => 
        //         item.some(subItem => 
        //             subItem.type && subItem.type.toLowerCase() === typeFilter.toLowerCase()
        //         )
        //     );
        //     if (!hasMatchingType) {
        //         return;
        //     }
        // }

        if (entry.key == annotation) {
            console.log("Share entry ", entry);
            const jsonObject = entry.value;

            // Check if filterText starts with ? and extract type filter
            var typeFilterFromSearch = [];
            var keyFilterFromSearch = [];
            var optionFilterFromSearch = [];
            // Check for type filter (?type) and key filter (!key) anywhere in the search terms
            const searchParts = filterText.split(' ');
            const remainingParts = [];

            searchParts.forEach(part => {
                if (part.startsWith('?')) {
                    typeFilterFromSearch.push(part.substring(1).trim().toLowerCase());
                } else if (part.startsWith('!')) {
                    keyFilterFromSearch.push(part.substring(1).trim().toLowerCase());
                } else if (part.startsWith('#')) {
                    optionFilterFromSearch.push(part.substring(1).trim().toLowerCase());
                } else {
                    remainingParts.push(part);
                }
            });

            // Update filterText to only contain non-filter terms
            filterText = remainingParts.join(' ').trim();
            JSON.parse(Object.values(jsonObject)[0]).forEach((innerArray, outerIndex) => {
                let text = '';
                let key = '';
                let type = '';
                let url = '#';
                let options = '';

                innerArray.forEach(item => {
                    text = item.hasOwnProperty('userText') ? item.userText : text;
                    key = item.hasOwnProperty('key') ? item.key : key;
                    type = item.hasOwnProperty('type') ? item.type : type;
                    url = item.hasOwnProperty('url') ? item.url : url;
                    options = item.hasOwnProperty('options') ? item.options : options;
                });

                // Convert lowercase to cap
                let capType = '';
                switch (type.toLowerCase()) {
                    case 'label':
                        capType = 'Label';
                        break;
                    case 'note':
                        capType = 'Note';
                        break;
                    default:
                        capType = 'Code';
                        break;
                }



                const searchTerms = filterText.split(' ').map(term => term.trim()).filter(term => term && term != '');

                // Check if the item matches any of the OR conditions
                var matchesSearch = searchTerms.length === 0 || searchTerms.some(term =>
                    text.toLowerCase().includes(term.toLowerCase()) ||
                    key.toLowerCase().includes(term.toLowerCase()) ||
                    options.toString().toLowerCase().includes(term.toLowerCase())
                );

                // Skip if type filter is specified and doesn't match
                var matchesSearch2 = typeFilterFromSearch.length === 0 || typeFilterFromSearch.some(term =>
                    type.toLowerCase().includes(term.toLowerCase())
                );

                if (!matchesSearch2)
                    matchesSearch = false;

                // Skip if key filter is specified and doesn't match
                matchesSearch2 = keyFilterFromSearch.length === 0 || keyFilterFromSearch.some(term =>
                    key.toLowerCase().includes(term.toLowerCase())
                );
                if (!matchesSearch2)
                    matchesSearch = false;

                // Skip if option filter is specified and doesn't match
                matchesSearch2 = optionFilterFromSearch.length === 0 || optionFilterFromSearch.some(term =>
                    options.some(option =>
                        option.toLowerCase().includes(term.toLowerCase())
                    )
                );

                if (!matchesSearch2)
                    matchesSearch = false;

                // Check if the item matches the search filter
                if (matchesSearch) {
                    let rowBGColor = count % 2 === 0 ? 'frame-color-lite-gray' : 'frame-color-dark-gray';
                    let rowBorderColor = 'frame-border-blue';

                    annotationHistoryRow += `<section id="annotation-row-${outerIndex}" class="sub-frame-annotation-table-row ${rowBGColor}">
                        <div class="annotation-history-checkbox">
                            <label class="checkbox-container">
                                <input type="checkbox" class="entry-checkbox" data-index="${outerIndex}" checked>
                                <span class="checkmark"></span>
                            </label>
                        </div>
                        <div id="" class="annotation-history-search-content p-3 ${rowBorderColor}">
                            <p id=""><strong>Selected Text: </strong><a>${text}</a></p>
                            <p id=""><strong>${capType}: </strong> ${key}</p>
                            <div id="" class="annotation-icon-container">
                                <p><strong>${capType} Type(s): </strong>${options}</p>`;
                    if (addButtons) {
                        annotationHistoryRow +=
                            `<div class="icon-container">
                                <a href="${url}" id="goToHighlights-${count}" class="annotation-icon" title="Go to highlight" aria-label="${url}" ${url === '#' ? 'onclick="return false;"' : ''}>
                                    <i class="fa-solid fa-highlighter" style="color: #626262;"></i>
                                </a>
                                <a href="${url}-+-${text}" id="clearHighlight-${count}" class="annotation-icon" aria-label="Clear Highlight" title="Clear highlight">
                                    <i class="fa-solid fa-eraser" style="color: navyblue;"></i>
                                </a>
                                <a href="#" id="clearAllHighlights-${count}" class="annotation-icon" aria-label="Clear All Highlights" title="Clear all highlights">
                                    <i class="fa-solid fa-trash" style="color: #626262;"></i>
                                </a>
                                <a href="#" id="deleteEntry-${outerIndex}" class="annotation-icon" aria-label="Delete Entry" title="Delete entry">
                                    <i class="fa-solid fa-broom" style="color: #626262;"></i>
                                </a>
                            </div>`
                    }
                    annotationHistoryRow += `</div>
                        </div>
                        <div id="" class="annotation-history-search-index ${rowBorderColor}">
                            <p id="" class="annotation-history-row-index">${count}</p>
                        </div>
                    </section>`;
                    count++;
                }
            });
        }
    });

    return annotationHistoryRow;
}


// SEARCH CODE
document.getElementById("annotation-history-search-form").addEventListener("click", function (event) {
    console.log("Search Button was clicked!");

    // var inputValue = document.getElementById("annotation-history-search-input").value;
    // var searched = searchedValue[1];

    // if (inputValue) {
    //     if (searched.toString() !== "") {
    //         console.warn(`\ncheck point 1\ninput value: =  ${inputValue}\nsearched value: =  ${searched}`);
    //         document.getElementById("sub-frame-annotation-table").innerHTML = parseSearchData(inputValue, searchedValue);
    //     } else {
    //         console.warn(`\ncheck point 5\ninput value: =  ${inputValue}\nsearched value: =  ${searched}`);
    //         document.getElementById("sub-frame-annotation-table").innerHTML = parseFirebaseData(inputValue);
    //     }
    // }

    // else {
    //     console.log(`cp 6\nInput value is empty`);
    //     document.getElementById("sub-frame-annotation-table").innerHTML = parseFirebaseData(inputValue);
    // }
});

// Add this function to handle real-time search
async function handleSearchInput(e) {
    var searchText = "";
    if (e) {
        searchText = e.target.value.toLowerCase();
    }
    else {
        searchText = document.getElementById("annotation-history-search-input").value.toLowerCase();
    }
    console.log("Searching for:", searchText);

    // Clear the table and repopulate with filtered data
    document.getElementById("sub-frame-annotation-table").innerHTML = await parseHistoryData(searchText);
}

// 1. Pass Type, object, id
function createSelectFilter(selectType, selectMap, id, includeKeys = false) {
    console.log(`function createSelectFilter(selectType = ${selectType}, selectMap, id = ${id}, includeKeys = ${includeKeys})`);

    let subId = `floatingSelect-${selectType.toLowerCase()}`;

    let idElement = document.getElementById(id);

    // Select the label element within the container with the specific 'for' attribute
    let labelElement = idElement.querySelector(`label[for="${subId}"]`);

    // Update the text inside the label element
    if (labelElement) {
        labelElement.innerHTML = `Search By ${selectType}:`;
    }

    let subIdElement = idElement.querySelector(`#${subId}`);

    if (subIdElement) {
        let optionsHtml = `<option class="p-1" value="" selected>-- Select Type --</option>`;

        if (!includeKeys) {
            // Populate the select options based on the selectMap array
            selectMap.forEach((item, index) => {
                optionsHtml += `<option id="${index + 1}-${item}" class="p-1" value="${item}">${item}</option>`;
            });
        } else if (includeKeys && id == filterByKeys) {
            // When Type is clicked
            let index = 0;
            for (let key in selectMap) {
                if (selectMap.hasOwnProperty(key)) {
                    optionsHtml += `<option id="${index + 1}-${key}" class="p-1" value="${key}">${key}</option>`;
                    index++;
                }
            }
        } else {
            // When key is clicked
            for (let key in selectMap) {
                if (selectMap.hasOwnProperty(key)) {
                    selectMap[key].forEach((item, index) => {
                        let value = includeKeys ? `${key}-${item}` : item;
                        optionsHtml += `<option id="${index + 1}-${item}" class="p-1" value="${value}">${item}</option>`;
                    });
                }
            }
        }

        // Set the innerHTML of the select element
        subIdElement.innerHTML = optionsHtml;

        // Add the onchange event listener
        // this is where the search info will be stores options will be check first if empty move up to keys then types.
        // There will be an identify for all when submitting.
        subIdElement.onchange = function () {
            let selectedOptions = Array.from(subIdElement.selectedOptions).map(option => option.value);

            if (id === filterByType) {
                console.log(`handler for types`);
                // let selectedOptions = Array.from(subIdElement.selectedOptions).map(option => option.value);
                let filterTypes = [filterByKeys];
                handleOptionChange(selectedOptions, { labelMapping, codeMapping }, filterByKeys, filterTypes);
                console.log(`type values = ${selectedOptions}`);
                searchedValue = ["Types", selectedOptions];
            }
            else if (id === filterByKeys) {
                console.log(`handler for keys`);
                // let selectedOptions = Array.from(subIdElement.selectedOptions).map(option => option.value);
                let filterTypes = [filterByOptions];
                handleOptionChange2(selectedOptions, { labelMapping, codeMapping }, filterByOptions, filterTypes);
                console.log(`key values = ${selectedOptions}`);
                searchedValue = ["Keys", selectedOptions];
            }
            else {
                console.log(`Gather options selected here`);
                console.log(`option values = ${selectedOptions}`);
                searchedValue = ["Options", selectedOptions];
                // Get the selected type from the type dropdown
            }
            const selectedType = Array.from(document.getElementById('floatingSelect-type').selectedOptions).map(option => option.value).filter(value => value !== '').join(" ?");
            const selectedKey = Array.from(document.getElementById('floatingSelect-keys').selectedOptions).map(option => option.value).filter(value => value !== '').join(" !");
            selectedOptions = selectedOptions.map(option => option.split('-')[1]).filter(value => value && value != '').join(" #");
            var selectedTypeString = "";
            var selectedKeyString = "";
            var selectedOptionsString = "";
            if (selectedType) {
                selectedTypeString = "?" + selectedType + " ";
            }
            if (selectedKey) {
                selectedKeyString = "!" + selectedKey + " ";
            }
            if (selectedOptions) {
                selectedOptionsString = "#" + selectedOptions;
            }
            document.getElementById("annotation-history-search-input").value = selectedTypeString + selectedKeyString + selectedOptionsString;
            handleSearchInput();
        };
    }
}

// Function to handle the change event for the select element
function handleOptionChange(values, mapping, id, filterTypes) {
    console.log(`-- handleOptionChange(values = ${values}, selectMap, id = ${id}, filterTypes = ${filterTypes}) --`);

    const { codeMapping, labelMapping } = mapping;
    const combinedMapping = { ...codeMapping, ...labelMapping };

    // use only for keys
    if (values.length > 0) {
        values.forEach(value => {
            if (values.length > 1) {
                ;

                showDropdownFilter(filterTypes);
                createSelectFilter("Keys", combinedMapping, id, true);
                let len = Object.keys(combinedMapping).length;
                document.getElementById('total-count').textContent = `Total: ${len}`;

            } else {
                if (value === "Code") {
                    // Add the custom code mapping
                    const codeMappingAll = { ...codeMapping };

                    let len = Object.keys(codeMapping).length;
                    document.getElementById('total-count').textContent = `Total: ${len}`;
                    showDropdownFilter(filterTypes);
                    createSelectFilter("Keys", codeMapping, id, true);
                }
                else if (value === "Label") {
                    let len = Object.keys(labelMapping).length;
                    document.getElementById('total-count').textContent = `Total: ${len}`;
                    showDropdownFilter(filterTypes);
                    createSelectFilter("Keys", labelMapping, id, true);
                }
                else if (value === "Note") {
                    let len = Object.keys(noteMap).length;
                    document.getElementById('total-count').textContent = `Total: ${len}`;
                    showDropdownFilter(filterTypes);
                    createSelectFilter("Keys", noteMap, id, true);
                }
                else {
                    console.log(`Select Type was selected`);
                    let resetFilterTypes = [filterByKeys, filterByOptions];
                    hideDropdownFilter(resetFilterTypes);
                }
            }
        });

    } else {
        console.log(`values is empty`);
        hideDropdownFilter(filterTypes);
    }
}

function handleOptionChange2(values, mapping, id, filterTypes) {
    console.log(`-- handleOptionChange2(values = ${values}, selectMap, id = ${id}, filterTypes = ${filterTypes}) --`);

    const { codeMapping, labelMapping } = mapping;
    const combinedMapping = { ...codeMapping, ...labelMapping };

    let item = "";
    // use only for keys
    if (values.length > 0) {
        console.log(`len2 = ${values.length}`);
        values.forEach(value => {
            if (values.length > 1) {
                if (value === "") {
                    console.log(`cp #1 --select type-- was selected with value`);
                } else {
                    // Combine the mappings
                    // const combinedMapping = { ...codeMapping, ...labelMapping };

                    console.warn(`searching multiple keys in the combine and return the options`);
                    item = {
                        ...item,
                        [value]: combinedMapping[value]
                    };
                    console.warn(`item = ${JSON.stringify({ ...item })}`);
                    console.warn(`item len = ${Object.keys(item[value]).length}`);
                    let totalOptions = 0;

                    for (const key in item) {
                        if (item.hasOwnProperty(key)) {
                            totalOptions += item[key].length;
                        }
                    }
                    console.warn(totalOptions);
                    document.getElementById('total-count-options').textContent = `Total: ${totalOptions}`;
                    showDropdownFilter(filterTypes);
                    createSelectFilter("Options", item, id, true);
                }

            } else {
                if (value === "") {
                    console.log(`cp #1 --select type-- was selected`);
                    let resetFilterTypes = [filterByOptions];
                    hideDropdownFilter(resetFilterTypes);
                } else {
                    let len = Object.keys(combinedMapping[value]).length;
                    document.getElementById('total-count-options').textContent = `Total: ${len}`;
                    showDropdownFilter(filterTypes);
                    createSelectFilter("Options", { [value]: combinedMapping[value] }, id, true);
                }
            }
        });

    } else {
        console.log(`cp #3 value is empty`);
        hideDropdownFilter(filterTypes);
    }
}


function hideDropdownFilter(filterTypes) {
    console.log(`-- hideDropdownFilter(filterTypes = ${filterTypes}) --`);

    // might be better to pass filter Types as a param
    filterTypes.forEach(id => {
        document.getElementById(id).style.display = "none"
    });
}

function getFormData() {
    console.log(`-- getFormData() --`);
    // might be better to pass filter Types as a param
    const formSearchData = ["annotation-history-search-form"];
    formSearchData.forEach(id => {
        console.log(`form data = ${document.getElementById(id)}`);
    });
}

async function testingStorageReturns() {
    console.log(`-- testingStorageReturns() --`);

    let { dataList } = await getLocalStorageData();

    var projects = await chrome.storage.local.get("projects");
    if (projects.projects != undefined)
        projects = projects.projects;

    // console.info(`${JSON.stringify(getLocalStorageData())}`);
    // console.info(`dataList = ${JSON.stringify(dataList)}`);

    var excludeList = ["initialized", "projects", "authInfo", "currentProject", "highlights", "annotationHistory"];
    Object.keys(projects).forEach(project => {
        excludeList.push(project + "/videoSavedNotes");
        excludeList.push(project + "/annotationHistory");
        excludeList.push(project + "/savedNotes");
        excludeList.push(project + "/voiceLogs");
        excludeList.push(project + "/customLabelsAndCodes");
    });


    const data = dataList
        .filter(item => !excludeList.includes(item.key))
        .reduce((acc, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {});

    const customCodeMap = {};
    const customLabelMap = {};
    const noteMap = {};

    // Iterate over the keys in the `data` object
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            // Parse the value property to convert it into a JavaScript object
            const parsedValue = data[key];
            console.log("parsedValue | ", parsedValue);

            // Extract the options and keyType from the parsedValue
            const options = parsedValue[0].options;
            const keyType = parsedValue[1].keyType;

            // Fill the appropriate mapping object based on the keyType
            if (keyType === 'code') {
                customCodeMap[key] = options;
            } else if (keyType === 'label') {
                customLabelMap[key] = options;
            } else if (keyType === 'note') {
                noteMap[key] = options;
            }
        }
    }
    // console.log('customCodeMap:', customCodeMap);
    // console.log('customLabelMap:', customLabelMap);
    // console.log('noteMap:', noteMap);
    return { customCodeMap, customLabelMap, noteMap };
}


export async function getLocalStorageData() {
    const idMapping = new Map();
    const dataList = [];

    // Use Promise.all with map instead of forEach
    await Promise.all((await chrome.storage.local.getKeys()).map(async key => {
        console.log("Annotation History | " + key);
        let value = await callGetItem(key, false);
        idMapping.set(key, value);
        dataList.push({ key: key, value: value });
    }));

    return { idMapping, dataList };
}

function showDropdownFilter(filterTypes) {
    console.log(`-- showDropdownFilter(filterTypes = ${filterTypes}) --`);

    // might be better to pass filter Types as a param
    filterTypes.forEach(id => {
        document.getElementById(id).style.display = ""
    });
}

async function callGetItem(key) {
    return await chrome.storage.local.get(key);
}

const filterByType = "annotation-history-search-filter-by-type";
const filterByKeys = "annotation-history-search-filter-by-keys";
const filterByOptions = "annotation-history-search-filter-by-options";
const typeMapping = ["Label", "Code"];

function annotationHistory() {
    console.log(`-- annotationHistory() --`)
    populateAnnotationHistoryTable();
    let filterTypes = [filterByKeys, filterByOptions];
    hideDropdownFilter(filterTypes);
    createSelectFilter("Type", typeMapping, filterByType);

    getFormData();
}

annotationHistory();