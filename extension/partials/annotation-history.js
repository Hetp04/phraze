import { showFrame, hideAllSubFrames } from "./utils.js";
import { getLocalStorageData, callSetItem, mainMenu, callGetItem, sendMessageToAllTabs, getUserEmail, getCurrentProject, sendRuntimeMessage, listenerFirebaseData } from "../frames.js";
import { StatisticsManager } from './statistics.js';
import { ensureChartLoaded } from '../lib/chart-loader.js';
import { getMainCompanyEmail, isUserLoggedIn2 } from './auth.js';
import { labelMap, codeMap, isOnWebsite } from "../globalVariables.js";

const addButtons = true; //Should buttons be added to each annotation row that allow editing

// Create a single instance of StatisticsManager
const statisticsManager = new StatisticsManager();

const frame2 = "Annotation History";

const typeMapping = ["Label", "Code"];
const filterByType = "annotation-history-search-filter-by-type";
const filterByKeys = "annotation-history-search-filter-by-keys";
const filterByOptions = "annotation-history-search-filter-by-options";

var searchedValue = ["", ""];

// Initialize mappings - will be populated when data is loaded
let customCodeMap = {};
let customLabelMap = {};
let noteMap = {};

const codeMapping = {
    ...codeMap,
    ...customCodeMap
}

const labelMapping = {
    ...labelMap,
    ...customLabelMap
}

// Add these constants for chart colors
const CHART_COLORS = {
    Sentiment: {
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgb(54, 162, 235)'
    },
    Tone: {
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgb(75, 192, 192)'
    },
    Intent: {
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgb(255, 99, 132)'
    },
    Emotion: {
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgb(153, 102, 255)'
    },
    Priority: {
        backgroundColor: 'rgba(255, 159, 64, 0.6)',
        borderColor: 'rgb(255, 159, 64)'
    },
    Politeness: {
        backgroundColor: 'rgba(255, 205, 86, 0.6)',
        borderColor: 'rgb(255, 205, 86)'
    },
    Agreement: {
        backgroundColor: 'rgba(201, 203, 207, 0.6)',
        borderColor: 'rgb(201, 203, 207)'
    },
    Relevance: {
        backgroundColor: 'rgba(111, 205, 205, 0.6)',
        borderColor: 'rgb(111, 205, 205)'
    }
};

let labelChart = null; // Store chart instance

async function processAnnotationData() {
    console.log('Starting to process annotation data...');

    let annotationHistory = null;
    if (await isUserLoggedIn2()) {
        const companyEmail = await getMainCompanyEmail();
        const projectName = await getCurrentProject();
        annotationHistory = await new Promise((resolve) => {
            sendRuntimeMessage({
                action: "getFirebaseData",
                path: `Companies/${companyEmail}/projects/${projectName}/annotationHistory`
            }, response => {
                if (response && response.success && response.data) {
                    resolve(response.data);
                } else {
                    resolve(null);
                }
            });
        });
    }
    else {
        annotationHistory = await callGetItem('annotationHistory');
    }

    if (!annotationHistory) {
        console.log('No annotation history found in localStorage');
        return {};
    }

    try {
        const annotations = JSON.parse(annotationHistory);
        console.log('Raw annotations:', annotations);

        const labelCounts = {};

        // Process each annotation group
        annotations.forEach((annotationGroup, groupIndex) => {
            // Extract key, type, and options from the group
            const key = annotationGroup.find(item => item.key)?.key;
            const type = annotationGroup.find(item => item.type)?.type;
            const optionsObj = annotationGroup.find(item => item.options);
            const options = optionsObj ? optionsObj.options : [];

            // Process if it's a label type annotation
            if (type?.toLowerCase() === 'label' && key && options) {
                if (!labelCounts[key]) {
                    labelCounts[key] = {};
                }

                // Handle both array and single string options
                const optionArray = Array.isArray(options) ? options : [options];

                optionArray.forEach(option => {
                    labelCounts[key][option] = (labelCounts[key][option] || 0) + 1;
                });

                console.log(`Processed annotation group ${groupIndex}:`, {
                    key: key,
                    type: type,
                    options: optionArray,
                    counts: labelCounts[key]
                });
            }
        });

        console.log('Final label counts:', labelCounts);
        return labelCounts;

    } catch (error) {
        console.error('Error processing annotation data:', error);
        return {};
    }
}

function createLabelChart(labelData) {
    try {
        console.log('Creating chart with data:', labelData);

        if (Object.keys(labelData).length === 0) {
            throw new Error('No label data available to display');
        }

        const ctx = document.getElementById('labelStatisticsChart').getContext('2d');

        if (labelChart) {
            labelChart.destroy();
        }

        // Define consistent colors for each option type
        const optionColors = {
            // Sentiment colors
            Positive: 'rgba(54, 162, 235, 0.8)',   // Blue
            Negative: 'rgba(255, 99, 132, 0.8)',   // Red
            Neutral: 'rgba(201, 203, 207, 0.8)',   // Grey

            // Emotion colors
            Happy: 'rgba(75, 192, 192, 0.8)',      // Teal
            Sad: 'rgba(153, 102, 255, 0.8)',       // Purple
            Angry: 'rgba(255, 159, 64, 0.8)',      // Orange
            Surprised: 'rgba(255, 205, 86, 0.8)',   // Yellow

            // Priority colors
            High: 'rgba(255, 99, 132, 0.8)',       // Red
            Medium: 'rgba(255, 205, 86, 0.8)',      // Yellow
            Low: 'rgba(75, 192, 192, 0.8)',        // Teal

            // Agreement colors
            Agree: 'rgba(75, 192, 192, 0.8)',      // Teal
            Disagree: 'rgba(255, 99, 132, 0.8)',   // Red

            // Relevance colors
            Relevant: 'rgba(75, 192, 192, 0.8)',   // Teal
            Irrelevant: 'rgba(255, 99, 132, 0.8)'  // Red
        };

        // Prepare data structure
        const labels = Object.keys(labelData);
        const datasets = [];

        // Get all unique options across all labels
        const allOptions = new Set();
        labels.forEach(label => {
            Object.keys(labelData[label]).forEach(option => {
                allOptions.add(option);
            });
        });

        // Create datasets for each option
        Array.from(allOptions).forEach(option => {
            datasets.push({
                label: option,
                data: labels.map(label => labelData[label][option] || 0),
                backgroundColor: optionColors[option] || `hsl(${Math.random() * 360}, 70%, 60%)`,
                borderColor: 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                borderRadius: 4
            });
        });

        labelChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Label Categories',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: false
                        },
                        // Add these properties to better control bar positioning
                        offset: true,
                        ticks: {
                            autoSkip: false,
                            maxRotation: 0,
                            padding: 8  // Add padding to prevent label clipping
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Annotations',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            stepSize: 1,
                            padding: 8  // Add padding to prevent label clipping
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'center',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12
                            },
                            filter: function (legendItem, data) {
                                // Only show legend items for options that have data
                                return data.datasets[legendItem.datasetIndex].data.some(value => value > 0);
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Label Distribution Statistics',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: {
                            top: 10,
                            bottom: 30
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => {
                                return `Category: ${tooltipItems[0].label}`;
                            },
                            label: (context) => {
                                const value = context.parsed.y;
                                if (value === 0) return null;
                                return `${context.dataset.label}: ${value} annotations`;
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        left: 20,
                        right: 20,
                        top: 30,  // Increased from 20 to prevent text clipping at top
                        bottom: 30  // Increased from 20 to prevent text clipping at bottom
                    }
                },
                barPercentage: 1.0,    // Increased from 0.8 - makes bars thicker
                categoryPercentage: 0.8, // Decreased from 0.9 - controls group width
            }
        });
    } catch (error) {
        console.error('Error creating chart:', error);
        alert('Error creating chart: ' + error.message);
    }
}

function annotationHistory() {
    console.log(`-- annotationHistory() --`)
    hideAllSubFrames();
    showFrame("annotation-history-sub-frame-label");
    showFrame("annotation-history-sub-frame-table");
    // populate table
    populateAnnotationHistoryTable();
    showFrame("annotation-history-sub-frame-search");
    showFrame("annotation-history-sub-frame-import-export");
  //  showFrame("annotation-history-sub-frame-button");

    // Initialize pill filters
    initializePillFilters();
    updatePillCounts();
    
    // Update mappings with current data
    updateMappings();

    getFormData();
}

document.getElementById(frame2).addEventListener("click", () => {
    console.log("Annotation History button clicked");

    // First hide all sub frames
    hideAllSubFrames();

    // Then show all required components in order
    showFrame("annotation-history-sub-frame-label");
    showFrame("annotation-history-sub-frame-table");

    // Populate the table with data
    populateAnnotationHistoryTable();

    // Show the search section
    showFrame("annotation-history-sub-frame-search");

    // Show import/export section
    showFrame("annotation-history-sub-frame-import-export");

    // Show any buttons
  //  showFrame("annotation-history-sub-frame-button");

    // Initialize filters
    initializePillFilters();
    updatePillCounts();
    
    // Update mappings with current data
    updateMappings();

    // Load form data
    getFormData();
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

// SEARCH CODE
document.getElementById("annotation-history-search-form").addEventListener("submit", async function (event) {
    console.log("Search Button was clicked!");

    var inputValue = document.getElementById("annotation-history-search-input").value;
    var searched = searchedValue[1];

    if (inputValue) {
        if (searched.toString() !== "") {
            console.warn(`\ncheck point 1\ninput value: =  ${inputValue}\nsearched value: =  ${searched}`);
            document.getElementById("sub-frame-annotation-table").innerHTML = parseSearchData(inputValue, searchedValue);
        } else {
            console.warn(`\ncheck point 5\ninput value: =  ${inputValue}\nsearched value: =  ${searched}`);
            document.getElementById("sub-frame-annotation-table").innerHTML = await parseHistoryData(inputValue);
        }
    }

    else {
        console.log(`cp 6\nInput value is empty`);
        document.getElementById("sub-frame-annotation-table").innerHTML = await parseHistoryData(inputValue);
    }

    console.log("Form submission prevented.");
    event.preventDefault();
});

// search without a filter
async function parseHistoryData(filterText) {
    console.log(`-- parseLocalStorageData(filterText = ${filterText}) --`);

    var data = null;
    var projectName = await getCurrentProject();
    var companyEmail = await getMainCompanyEmail();
    if (await isUserLoggedIn2()) {
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
    else {
        console.log("Local storage | " + projectName);
        data = await getLocalStorageData();
        return getTableHTML(data.dataList, filterText, projectName);
    }
}

//projectName should only be defined for when we're getting data from localStorage
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
            
            // Parse the annotation history and ensure it's an array
            let parsedAnnotations;
            try {
                parsedAnnotations = JSON.parse(Object.values(jsonObject)[0]);
                if (!Array.isArray(parsedAnnotations)) {
                    console.error('|getTableHTML| Parsed annotations is not an array:', parsedAnnotations);
                    return;
                }
            } catch (error) {
                console.error('|getTableHTML| Error parsing annotations:', error);
                return;
            }
            
            parsedAnnotations.forEach((innerArray, outerIndex) => {
                // Ensure innerArray is actually an array
                if (!Array.isArray(innerArray)) {
                    console.warn('|getTableHTML| innerArray is not an array:', innerArray);
                    return;
                }
                
                let text = '';
                let key = '';
                let type = '';
                let url = '#';
                let options = '';
                let highlightID = '';

                innerArray.forEach(item => {
                    text = item.hasOwnProperty('userText') ? item.userText : text;
                    key = item.hasOwnProperty('key') ? item.key : key;
                    type = item.hasOwnProperty('type') ? item.type : type;
                    url = item.hasOwnProperty('url') ? item.url : url;
                    options = item.hasOwnProperty('options') ? item.options : options;
                    highlightID = item.hasOwnProperty('highlightID') ? item.highlightID : highlightID;
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
                
                console.log(`Type filtering: type="${type}", typeFilterFromSearch=${JSON.stringify(typeFilterFromSearch)}, matchesSearch2=${matchesSearch2}`);

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
                                <a href="${url}-+-${text}" id="clearHighlight-${count}" data-highlightid="${highlightID}" class="annotation-icon" aria-label="Clear Highlight" title="Clear highlight">
                                    <i class="fa-solid fa-eraser" style="color: navyblue;"></i>
                                </a>
                                <a href="#" id="clearAllHighlights-${count}" class="annotation-icon" aria-label="Clear All Highlights" title="Clear all highlights" style="display: none;">
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

    // Check if we have any annotations and show/hide empty state accordingly
    const hasAnnotations = annotationHistoryRow.includes('annotation-history-search-index');
    const emptyState = document.getElementById('annotation-empty-state');
    
    if (emptyState) {
        if (hasAnnotations) {
            emptyState.style.display = 'none';
        } else {
            emptyState.style.display = 'block';
        }
    }

    return annotationHistoryRow;
}

// search with filters
async function parseSearchData(inputText, filteredText) {
    console.warn(`parseSearchData(inputText = ${inputText}, filteredText = ${filteredText})`);

    let annotation = "annotationHistory";
    let key = '';
    let text = '';
    let type = '';
    let options = '';
    let annotationHistoryRow = "";
    let count = 1;
    let searchedBy = "";   // searched by types
    let isTypeEqualToFilter = "";   // checks if type is equal to filter
    let filter = ""; // the options chosen my the user
    let capType = "";
    const { dataList } = await getLocalStorageData();

    dataList.forEach(entry => {
        if (entry.key == annotation) {
            const jsonObject = JSON.parse(entry.value);

            jsonObject.forEach(innerArray => {
                innerArray.forEach(item => {
                    text = item.hasOwnProperty('userText') ? item.userText : text;
                    key = item.hasOwnProperty('key') ? item.key : key;
                    type = item.hasOwnProperty('type') ? item.type : type;
                    options = item.hasOwnProperty('options') ? item.options : options;
                });

                filter = filteredText[1];

                switch (filteredText[0].toLowerCase()) {
                    case "options":
                        searchedBy = "searched by options";
                        break;
                    case "keys":
                        searchedBy = "searched by keys";
                        break;
                    default:
                        searchedBy = "searched by types";
                }

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

                let rowBGColor = count % 2 === 0 ? 'frame-color-lite-gray' : 'frame-color-dark-gray';
                let rowBorderColor = 'frame-border-blue';

                // Todo - reduce code
                if (searchedBy == "searched by types" && compareTypeAndFilter(type, filter)) {

                    isTypeEqualToFilter = checkIsTypeEqualToFilter(type, filter);

                    if (text && text.toLowerCase().includes(inputText.toLowerCase()) && isTypeEqualToFilter) {
                        annotationHistoryRow += `<section id="" class="sub-frame-annotation-table-row ${rowBGColor}">
                                    <div id="" class="annotation-history-search-content p-3 ${rowBorderColor}">
                                        <p id=""><strong>Selected Text: </strong><a>${text}</a></p>
                                        <p id=""><strong>${capType}: </strong> ${key}</p>
                                        <p id=""><strong>${capType} Type(s): </strong>${options}</p>
                                    </div>
                                    <div id="" class="annotation-history-search-index ${rowBorderColor}">
                                        <p id="" class="annotation-history-row-index">${count}</p>
                                    </div>
                                </section>`;
                        count++;
                    }
                }

                // Key(s)
                else if (searchedBy == "searched by keys" && compareTypeAndFilter(key, filter)) {

                    isTypeEqualToFilter = checkIsTypeEqualToFilter(key, filter);

                    if (text.toLowerCase().includes(inputText.toLowerCase()) && isTypeEqualToFilter) {
                        annotationHistoryRow += `<section id="" class="sub-frame-annotation-table-row ${rowBGColor}">
                                    <div id="" class="annotation-history-search-content p-3 ${rowBorderColor}">
                                        <p id=""><strong>Selected Text: </strong><a>${text}</a></p>
                                        <p id=""><strong>${capType}: </strong> ${key}</p>
                                        <p id=""><strong>${capType} Type(s): </strong>${options}</p>
                                    </div>
                                    <div id="" class="annotation-history-search-index ${rowBorderColor}">
                                        <p id="" class="annotation-history-row-index">${count}</p>
                                    </div>
                                </section>`;
                        count++;
                    }
                }

                // Option(s)
                else if (searchedBy == "searched by options" && compareOptionsAndFilter(options, filter)) {

                    isTypeEqualToFilter = checkIsOptionsEqualToFilter(options, filter);

                    if (text.toLowerCase().includes(inputText.toLowerCase()) && isTypeEqualToFilter) {
                        annotationHistoryRow += `<section id="" class="sub-frame-annotation-table-row ${rowBGColor}">
                                    <div id="" class="annotation-history-search-content p-3 ${rowBorderColor}">
                                        <p id=""><strong>Selected Text: </strong><a>${text}</a></p>
                                        <p id=""><strong>${capType}: </strong> ${key}</p>
                                        <p id=""><strong>${capType} Type(s): </strong>${options}</p>
                                    </div>
                                    <div id="" class="annotation-history-search-index ${rowBorderColor}">
                                        <p id="" class="annotation-history-row-index">${count}</p>
                                    </div>
                                </section>`;
                        count++;
                    }
                }

                else {
                    console.warn(`\ncheck point 10\ntype = ${type}\nkey = ${key}\noptions = ${options}\nselected filter = ${filter}`);
                }
            });
        }
    });
    
    // Check if we have any annotations and show/hide empty state accordingly
    const hasAnnotations = annotationHistoryRow.includes('annotation-history-search-index');
    const emptyState = document.getElementById('annotation-empty-state');
    
    if (emptyState) {
        if (hasAnnotations) {
            emptyState.style.display = 'none';
        } else {
            emptyState.style.display = 'block';
        }
    }
    
    // console.warn(`${searchedBy} = ${filteredText[1]}`);
    return annotationHistoryRow;
}

// Function to download data as a JSON file
function downloadObjectAsJson(exportObj, exportName) {
    console.log(`downloadObjectAsJson(exportObj = ${exportObj}, exportName = ${exportName})`);
    const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(exportObj));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showToast(`${exportName}.json saved to downloads folder`, 'success');
}

// Function to collect all annotation data
async function collectAnnotationData() {
    console.log(`collectAnnotationData()`);
    let annotationData = [];
    annotationData = await callGetItem("annotationHistory");
    annotationData.highlights = await callGetItem("highlights");
    // const { dataList } = await getLocalStorageData();

    // dataList.forEach((entry) => {
    //     if (entry.key === "annotationHistory") {
    //         const jsonObject = JSON.parse(entry.value);
    //         // Filter only selected entries
    //         const selectedCheckboxes = document.querySelectorAll('.entry-checkbox:checked');
    //         const selectedIndices = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.index));

    //         annotationData = jsonObject.filter((_, index) => selectedIndices.includes(index));
    //     }
    // });

    return annotationData;
}

// Update the export button click handler
document.getElementById("annotation-history-export").addEventListener("click", function () {
    // Show the modal
    document.querySelector('.export-modal-overlay').style.display = 'block';
    document.querySelector('.export-modal-buttons').style.display = 'flex';
    //Just skip to clicking the working download option for now
    // document.getElementById("continue-download").click();
    // showToast(`Annotation downloaded to your device's "Downloads" folder`, "success");
});

// Close modal when clicking the close button
document.querySelector('.export-modal-close').addEventListener('click', function () {
    document.querySelector('.export-modal-overlay').style.display = 'none';
    document.getElementById('export-share-form').classList.remove('show');
});

// Close modal when clicking outside
document.querySelector('.export-modal-overlay').addEventListener('click', function (e) {
    if (e.target === this) {
        this.style.display = 'none';
        document.getElementById('export-share-form').classList.remove('show');
    }
});

// Continue Download button
document.getElementById('continue-download').addEventListener('click', async function () {
    const dataToExport = await collectAnnotationData();
    downloadObjectAsJson(dataToExport, "AnnotationHistory");
    document.querySelector('.export-modal-overlay').style.display = 'none';
});

// Share File button
document.getElementById('share-file').addEventListener('click', function () {
    document.getElementById('qr-code-container').style.display = 'none';
    document.getElementById('export-share-form').classList.add('show');
    document.querySelector('.export-modal-buttons').style.display = 'none';
});

// Add this function to show toast notifications
function showToast(message, type = 'success') {
    // Remove any existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.backgroundColor = type === 'success' ? '#10a37f' : '#dc2626'; // OpenAI green or error red
    toast.style.color = '#ffffff'; // Force white text
    toast.textContent = message;

    // Add to document
    document.body.appendChild(toast);

    // Force reflow
    toast.offsetHeight;

    // Show toast
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove toast after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Update the form submission handler
document.addEventListener('DOMContentLoaded', function () {
    const exportShareForm = document.getElementById('export-share-form');

    if (exportShareForm) {
        exportShareForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Get form data
            const firstName = document.getElementById('share-first-name').value;
            const lastName = document.getElementById('share-last-name').value;
            const recipientEmail = document.getElementById('share-email').value;
            const description = document.getElementById('share-description').value;

            // Get annotation data
            const annotationData = collectAnnotationData();

            try {
                // Show loading state
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

                // Format the annotation data as a nicely formatted JSON string
                const formattedJson = JSON.stringify(annotationData, null, 2);

                // Create FormData object
                const formData = new FormData();
                formData.append('access_key', '1dcbec9d-b197-4df3-9ff5-8bb3f9e5e2c2');
                formData.append('from_name', `${firstName} ${lastName}`);
                formData.append('email', recipientEmail);
                formData.append('subject', 'Shared Annotation Data');
                formData.append('message', `${description}\n\nAnnotation Data:\n\n${formattedJson}`);

                // Send the request
                const response = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                console.log('Web3Forms response:', result);

                if (result.success) {
                    showToast('Annotation data shared successfully!', 'success');
                    document.querySelector('.export-modal-overlay').style.display = 'none';
                    exportShareForm.reset();
                    document.getElementById('export-share-form').classList.remove('show');
                } else {
                    throw new Error(result.message || 'Failed to send data');
                }
            } catch (error) {
                console.error('Error sharing annotation data:', error);
                showToast(error.message || 'Failed to share annotation data. Please try again.', 'error');
            } finally {
                const submitButton = e.target.querySelector('button[type="submit"]');
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
            }
        });
    }
});

document.getElementById('file-input').addEventListener('change', function (event) {
    console.log(`annotation-history-import`);
    const file = event.target.files[0]; // Get the file from the input

    console.log(`file = ${JSON.stringify(file)}`);
    if (file) {
        const reader = new FileReader();
        reader.onload = async function (evt) {
            const data = evt.target.result; // Read the content of the file
            try {
                const json = JSON.parse(data); // Parse JSON data
                let highlights = json.highlights;
                delete json.highlights;
                var values = Object.values(json);
                var value = values[0] || [];
                // Here you would typically integrate this data into your application's state or local storage
                // updateLocalStorageData(json); // This function needs to be defined to handle the updating of local storage
                await callSetItem("annotationHistory", value);
                populateAnnotationHistoryTable(); // Refresh the table display

                values = Object.values(highlights);
                value = values[0] || [];
                await callSetItem("highlights", value);

                console.log('Import successful');
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        };
        reader.readAsText(file); // Read the file as a text string
    }
    // Reset the input value to allow the same file to be selected again
    event.target.value = '';
});

function updateLocalStorageData(data) {
    // Assuming the key for storing annotation history is 'annotationHistory'
    // localStorage.setItem('annotationHistory', JSON.stringify(data)); // Convert array to JSON string and store
    callSetItem('annotationHistory', JSON.stringify(data));
}

// UTILs Functions
function checkIsTypeEqualToFilter(type, filter) {
    console.log(`-- checkIsTypeEqualToFilter(type = ${type}, filter = ${filter}) --`);
    // Convert type to lowercase
    const typeLower = type.toLowerCase();
    // console.log(`typeLower = ${typeLower}`);

    // Convert filter to a lowercase string and split into an array
    const filterArray = filter.toString().toLowerCase().split(',');
    // console.log(`filterArray = ${filterArray}`);

    // Check if typeLower matches any value in
    // console.log(`result = ${filterArray.some(filterValue => typeLower === filterValue.trim())}`);
    return filterArray.some(filterValue => typeLower === filterValue.trim());
}

function checkIsOptionsEqualToFilter(type, filter) {
    console.info(`-- checkIsOptionsEqualToFilter(type = ${type}, filter = ${filter}) --`);

    // // Convert type to lowercase
    // const typeLower = type.toString().toLowerCase();
    // console.log(`typeLower = ${typeLower}`);

    // Convert type to lowercase and split into an array
    const typeLowerArray = type.toString().toLowerCase().split(',');
    // console.log(`typeLowerArray = ${typeLowerArray}`)

    // Convert filter to a lowercase string and split into an array
    // const filterArray = filter.toString().toLowerCase().split(',');
    const filterArray = filter.toString().toLowerCase().split(',')
        .map(item => item.split('-')[1].trim());
    // console.log(`filterArray = ${filterArray}`);

    // Check if typeLower matches any value in
    // console.log(`result = ${filterArray.some(filterValue => typeLower === filterValue.trim())}`);
    // return filterArray.some(filterValue => typeLower === filterValue.trim());

    // Check if any value in typeLowerArray matches any value in filterArray
    const result = filterArray.some(filterValue => typeLowerArray.includes(filterValue));
    // console.log(`result = ${result}`);
    return result;
}

function compareTypeAndFilter(type, filter) {
    console.log(`-- compareTypeAndFilter(type = ${type}, filter = ${filter}) --`);

    // Convert type to lowercase
    const typeLower = type.toLowerCase();
    // console.log(`typeLower = ${typeLower}`);

    // Convert filter to a lowercase string and split into an array
    const filterArray = filter.toString().toLowerCase().split(',');
    // console.log(`filterArray     = ${filterArray}`);
    // console.log(`filterArray len = ${filterArray.length}`);

    // Loop through filterArray and check if typeLower matches any value
    for (let i = 0; i < filterArray.length; i++) {
        if (typeLower == filterArray[i].trim()) {
            // console.error(`\ncheck point er1\nfilterArray[i].trim() = ${filterArray[i].trim()}\ntypeLower = ${typeLower}`);
            return true;
        } else {
            // console.error(`\ncheck point er2\nfilterArray[i].trim() = ${filterArray[i].trim()}\ntypeLower = ${typeLower}`);
        }
    }

    return false;
}

function compareOptionsAndFilter(type, filter) {
    console.warn(`-- compareOptionsAndFilter(type = ${type}, filter = ${filter}) --`);

    // Matches in the storage
    const typeArray = type.toString().toLowerCase().split(',');
    // console.log(`typeArray       = ${typeArray}`);
    // console.log(`typeArray len   = ${typeArray.length}`);

    // User selections
    const filterArray = filter.toString().toLowerCase().split(',')
        .map(item => item.split('-')[1].trim());
    // console.log(`filterArray     = ${filterArray}`);
    // console.log(`filterArray len = ${filterArray.length}`);

    // Collect all matching elements
    const matches = [];

    // Loop through typeArray and filterArray and check if any typeArray element matches any filterArray element
    for (let i = 0; i < typeArray.length; i++) {
        for (let j = 0; j < filterArray.length; j++) {
            if (typeArray[i] === filterArray[j]) {
                // console.error(`\ncheck point er1\ntypeArray[i] = ${typeArray[i]}\nfilterArray[j] = ${filterArray[j]}\ntrue`);
                matches.push(typeArray[i]);
            } else {
                // console.log(`\ncheck point er2\ntypeArray[i] = ${typeArray[i]}\nfilterArray[j] = ${filterArray[j]}\nfalse`);
            }
        }
    }
    // console.log(`Matches: ${matches}`);
    return matches.length > 0;
}

// Old dropdown functions removed - now using pill system
function getFormData() {
    console.log(`-- getFormData() --`);
    // might be better to pass filter Types as a param
    const formSearchData = ["annotation-history-search-form"];
    formSearchData.forEach(id => {
        console.log(`form data = ${document.getElementById(id)}`);
    });
}

// Old dropdown functions removed - now using pill system

// Old dropdown functions removed - now using pill system

// Todo Delete entry
async function deleteAnnotationByIndex(index) {
    console.log(`--- deleteAnnotationByIndex(${index}) ---`);
    // Get the annotation history from localStorage
    var annotationHistory = null;
    var projectName = await getCurrentProject();
    var companyEmail = await getMainCompanyEmail();
    if (await isUserLoggedIn2()) {
        // Convert sendRuntimeMessage to a Promise
        annotationHistory = await new Promise((resolve) => {
            sendRuntimeMessage({
                action: "getFirebaseData",
                path: `Companies/${companyEmail}/projects/${projectName}/annotationHistory`
            }, response => {
                if (response && response.success && response.data) {
                    resolve(response.data);
                } else {
                    resolve(null);
                }
            });
        });
        annotationHistory = JSON.parse(annotationHistory);
    }
    else {
        annotationHistory = JSON.parse(Object.values(await chrome.storage.local.get(`${projectName}/annotationHistory`))[0]);
    }

    if (!annotationHistory) {
        console.error("No annotation history found");
        return;
    }

    // Check if the index is within bounds
    if (index < 0 || index >= annotationHistory.length) {
        console.error("Index out of bounds.");
        return;
    }
    // Get the id from the annotation at the current index
    const annotationId = annotationHistory[index].find(item => item.id)?.id;
    if (!annotationId) {
        console.error("Could not find id for annotation at index", index);
        return;
    }

    // Remove the item at the specified index
    annotationHistory.splice(index, 1);

    if (await isUserLoggedIn2()) {
        var projectName = await getCurrentProject();
        var companyEmail = await getMainCompanyEmail();

        sendRuntimeMessage({
            action: "saveFirebaseData",
            path: `Companies/${companyEmail}/projects/${projectName}/comments/${annotationId}`,
            data: null
        }, response => {
        });

        sendRuntimeMessage({
            action: "saveFirebaseData",
            path: `Companies/${companyEmail}/projects/${projectName}/commentImages/${annotationId}`,
            data: null
        }, response => {
        });

        // Wait for the save to complete
        await new Promise((resolve) => {
            sendRuntimeMessage({
                action: "saveFirebaseData",
                path: `Companies/${companyEmail}/projects/${projectName}/annotationHistory`,
                data: JSON.stringify(annotationHistory)
            }, response => {
                resolve(response);
            });
        });
    }
    else {
        // Update the annotation history in localStorage
        chrome.storage.local.set({ [`${projectName}/annotationHistory`]: JSON.stringify(annotationHistory) });
    }

    console.log(`Entry at index ${index} deleted successfully.`);

    // Add this line after the deletion
    document.dispatchEvent(new Event('annotationUpdated'));
    sendMessageToAllTabs({
        action: "reloadHighlights"
    });
    await populateAnnotationHistoryTable();
}

// Todo - Debugging
async function testingStorageReturns() {
    console.log(`-- testingStorageReturns() --`);

    let { dataList } = await getLocalStorageData();

    var projects = {};
    if (!isOnWebsite) {
        projects = await chrome.storage.local.get("projects");
        if (projects.projects != undefined)
            projects = projects.projects;
    }

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

// Function to update the global mappings
async function updateMappings() {
    try {
        const { customCodeMap: newCustomCodeMap, customLabelMap: newCustomLabelMap, noteMap: newNoteMap } = await testingStorageReturns();
        
        // Update global mappings
        customCodeMap = newCustomCodeMap;
        customLabelMap = newCustomLabelMap;
        noteMap = newNoteMap;
        
        // Update the combined mappings
        Object.assign(codeMapping, codeMap, customCodeMap);
        Object.assign(labelMapping, labelMap, customLabelMap);
        
        console.log('Mappings updated:', { customCodeMap, customLabelMap, noteMap });
        
        // Update the pill filters with new data
        updateKeysDropdown();
        
    } catch (error) {
        console.error('Error updating mappings:', error);
    }
}

// Attach event listener to the document
document.addEventListener('click', async function (event) {
    if (event.target.closest('a[id^="clearHighlight-"]')) {
        // Prevent the default link behavior
        event.preventDefault();
        var button = event.target.closest('a');
        var highlightID = button.dataset.highlightid;

        let highlights = Object.values(await callGetItem("highlights") || []);
        if (highlights.length > 0)
            highlights = highlights[0];

        let highlightRemoved = false;
        if (highlights && highlights.length > 0)
            for (let i = 0; i < highlights.length; ++i) {
                if (highlights[i].id == highlightID) {
                    highlights.splice(i, 1);
                    await callSetItem("highlights", highlights);
                    sendMessageToAllTabs({
                        action: "reloadHighlights"
                    });
                    highlightRemoved = true;
                    showToast("Found and removed highlight", 'success');
                    break;
                }
            }

        if (!highlightRemoved)
            showToast("Could not find highlight", 'error');

        // Get the count from the ID
        // const count = event.target.closest('a').id.replace('clearHighlight-', '');
        // const targetLinkId = `clearHighlight-${count}`;
        // console.log('targetLinkId: ', targetLinkId);

        // // Get the target link element
        // const targetLinkElement = document.getElementById(targetLinkId);

        // if (targetLinkElement) {
        //     console.log('targetLinkElement: ', targetLinkElement);
        //     console.log('targetLinkElement.href: ', targetLinkElement.href);
        //     const hrefValue = targetLinkElement.href;
        //     let [url, userText = ''] = hrefValue.split('-+-'); // Destructuring with default for userText
        //     userText = userText.replace(/%20/g, ' ');
        //     console.log('url:', url);
        //     console.log('userText:', userText);
        //     clearHighlightsByURL(count, url, userText);
        // } else {
        //     console.warn(`Element with ID "${targetLinkId}" not found.`);
        // }
    }
    // Check if the clicked element is the clearAllHighlights link
    else if (event.target.closest('a[id^="clearAllHighlights-"]')) {
        // Prevent the default link behavior
        event.preventDefault();
        // Get the count from the ID
        // const count = event.target.closest('a').id.replace('clearAllHighlights-', '');
        // const targetLinkId = `goToHighlights-${count}`;

        // // Get the target link element
        // const targetLinkElement = document.getElementById(targetLinkId);
        // console.log('targetLinkId: ', targetLinkId);
        // console.log('targetLinkElement: ', targetLinkElement);

        // if (targetLinkElement) {
        //     const url = targetLinkElement.href; // Get the href from the link element
        //     console.log('url: ', url);
        //     // Call your method and pass the count and the URL
        //     clearHighlightsByURL(count, url, "");
        // } else {
        //     console.log(`Element with ID ${targetLinkId} not found`);
        // }
    }

    if (event.target.closest('a[id^="deleteEntry-"]')) {
        event.preventDefault();
        const deleteIndex = event.target.closest('a').id.replace('deleteEntry-', '');
        console.log('delete', deleteIndex);
        deleteAnnotationByIndex(deleteIndex); // Deletes the third entry (index starts from 0)
        annotationHistory();
    }

});

// Your method to handle the clear action
function clearAllHighlights(count) {
    console.info(`Clear all highlights for count: ${count}`);
    // Add your logic here
}

function addAnnotation(/* your parameters */) {
    // Your existing code for adding annotations...

    // After successfully adding the annotation:
    document.dispatchEvent(new Event('annotationUpdated'));
}

document.addEventListener('click', function (event) {
    if (event.target.closest('a[id^="goToHighlights-"]')) {
        event.preventDefault();
        const url = event.target.closest('a').getAttribute('href');
        if (url && url !== '#') {
            // Send message to background script to navigate to the URL
            chrome.tabs.create({ url: url });
        }
    }
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

// Update the search form submit handler to prevent default form submission
function initializeSearchForm() {
    const searchForm = document.getElementById('annotation-history-search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent form submission
        });
    }
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', () => {
    parseHistoryData();
    initializeSearchForm();
});

// Add this with your other event listeners
document.getElementById('annotation-history-header-back').addEventListener('click', function () {
    // Use the same functionality as your existing back button
  //  document.getElementById('annotation-history-back').click();
});

// Add this near your other event listeners
document.getElementById('view-label-statistics').addEventListener('click', async function () {
    try {
        await ensureChartLoaded();
        const labelData = await processAnnotationData();

        if (Object.keys(labelData).length === 0) {
            alert('No label data available. Please create some annotations first.');
            return;
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'chart-overlay';
        document.body.appendChild(overlay);

        // Show chart container
        const chartContainer = document.getElementById('statistics-chart-container');
        chartContainer.style.display = 'flex';

        // Create and display chart
        createLabelChart(labelData);
    } catch (error) {
        console.error('Error displaying statistics:', error);
        alert('Error displaying statistics: ' + error.message);
    }
});

// Add close button handler
document.getElementById('close-statistics').addEventListener('click', function () {
    const chartContainer = document.getElementById('statistics-chart-container');
    chartContainer.style.display = 'none';

    // Remove overlay
    const overlay = document.querySelector('.chart-overlay');
    if (overlay) {
        overlay.remove();
    }
});

// Update chart when annotation history changes
document.addEventListener('annotationUpdated', async function () {
    if (document.getElementById('statistics-chart-container').style.display !== 'none') {
        const labelData = await processAnnotationData();
        createLabelChart(labelData);
    }
});

// Add this function to process code data
async function processCodeData() {
    console.log('Processing code data...');
    var values = null;
    if (await isUserLoggedIn2()) {
        const companyEmail = await getMainCompanyEmail();
        const projectName = await getCurrentProject();
        values = await new Promise((resolve) => {
            sendRuntimeMessage({
                action: "getFirebaseData",
                path: `Companies/${companyEmail}/projects/${projectName}/annotationHistory`
            }, response => {
                if (response && response.success && response.data) {
                    resolve(response.data);
                } else {
                    resolve(null);
                }
            });
        });
    }
    else {
        values = await callGetItem('annotationHistory');
    }
    if (!values) return {};

    try {
        const annotations = JSON.parse(values);
        const codeData = {};

        // Process annotations first to discover all codes and their types
        annotations.forEach(annotationGroup => {
            const keyObj = annotationGroup.find(item => item.key);
            const typeObj = annotationGroup.find(item => item.type);
            const optionsObj = annotationGroup.find(item => item.options);

            if (keyObj && typeObj && optionsObj && typeObj.type.toLowerCase() === 'code') {
                const key = keyObj.key;
                const options = optionsObj.options;

                // Initialize the code category if it doesn't exist
                if (!codeData[key]) {
                    codeData[key] = {};
                }

                // Count each option
                if (Array.isArray(options)) {
                    options.forEach(option => {
                        if (!codeData[key][option]) {
                            codeData[key][option] = 0;
                        }
                        codeData[key][option]++;
                    });
                }
            }
        });

        console.log('Discovered code data:', codeData);
        return codeData;

    } catch (error) {
        console.error('Error processing code data:', error);
        return {};
    }
}

// Update the createCodeChart function
function createCodeChart(codeData) {
    try {
        console.log('Creating code chart with data:', codeData);

        if (Object.keys(codeData).length === 0) {
            throw new Error('No code data available to display');
        }

        const ctx = document.getElementById('codeStatisticsChart').getContext('2d');

        if (window.codeChart) {
            window.codeChart.destroy();
        }

        // Generate colors dynamically based on the number of unique types
        function generateColors(count) {
            const colors = [];
            for (let i = 0; i < count; i++) {
                colors.push(`hsl(${(i * 360) / count}, 70%, 60%)`);
            }
            return colors;
        }

        // Prepare data structure
        const labels = Object.keys(codeData);
        const datasets = [];

        // Get all unique code types across all codes
        const allCodeTypes = new Set();
        labels.forEach(code => {
            Object.keys(codeData[code]).forEach(type => {
                allCodeTypes.add(type);
            });
        });

        // Generate colors for all code types
        const colors = generateColors(allCodeTypes.size);

        // Create datasets for each code type
        Array.from(allCodeTypes).forEach((type, index) => {
            datasets.push({
                label: type,
                data: labels.map(code => codeData[code][type] || 0),
                backgroundColor: colors[index],
                borderColor: 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                borderRadius: 4
            });
        });

        window.codeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets.map(dataset => ({
                    ...dataset,
                    // Remove individual bar thickness settings
                    barThickness: undefined,
                    maxBarThickness: undefined
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Code Categories',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 45,
                            padding: 8  // Add padding to prevent label clipping
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Annotations',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            stepSize: 1,
                            padding: 8  // Add padding to prevent label clipping
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'center',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12
                            },
                            filter: function (legendItem, data) {
                                return data.datasets[legendItem.datasetIndex].data.some(value => value > 0);
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Code Distribution Statistics',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: {
                            top: 10,
                            bottom: 30
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => {
                                return `Category: ${tooltipItems[0].label}`;
                            },
                            label: (context) => {
                                const value = context.parsed.y;
                                if (value === 0) return null;
                                return `${context.dataset.label}: ${value} annotations`;
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        left: 20,
                        right: 20,
                        top: 30,  // Increased from 20 to prevent text clipping at top
                        bottom: 30  // Increased from 20 to prevent text clipping at bottom
                    }
                },
                // Add these at the root level of options
                barPercentage: 0.9,    // Controls the width of the bars relative to the category
                categoryPercentage: 0.8 // Controls the width of all bars in a category
            }
        });

        console.log('Chart created successfully');
    } catch (error) {
        console.error('Error creating code chart:', error);
        alert('Error creating chart: ' + error.message);
    }
}

// Add event listener for the View Code Statistics button
document.getElementById('view-code-statistics').addEventListener('click', async function () {
    try {
        await ensureChartLoaded();
        const codeData = await processCodeData();

        if (Object.keys(codeData).length === 0) {
            alert('No code data available. Please create some annotations first.');
            return;
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'chart-overlay';
        document.body.appendChild(overlay);

        // Show chart container
        const chartContainer = document.getElementById('code-statistics-chart-container');
        chartContainer.style.display = 'flex';

        // Create and display chart
        createCodeChart(codeData);
    } catch (error) {
        console.error('Error displaying statistics:', error);
        alert('Error displaying statistics: ' + error.message);
    }
});

// Add close button handler for code statistics
document.getElementById('close-code-statistics').addEventListener('click', function () {
    const chartContainer = document.getElementById('code-statistics-chart-container');
    chartContainer.style.display = 'none';

    // Remove overlay
    const overlay = document.querySelector('.chart-overlay');
    if (overlay) {
        overlay.remove();
    }
});

// Update chart when annotation history changes
document.addEventListener('annotationUpdated', async function () {
    if (document.getElementById('code-statistics-chart-container').style.display !== 'none') {
        const codeData = await processCodeData();
        createCodeChart(codeData);
    }
});

// Add this event listener for the import button
document.getElementById('annotation-history-import').addEventListener('click', function () {
    document.getElementById('file-input').click();
});

// Add this function to generate and display the QR code
async function shortenUrlWithBitly(data) {
    try {
        // First, create a JSON blob
        const jsonString = JSON.stringify(data);
        const blobResponse = await fetch('https://jsonblob.com/api/jsonBlob', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: jsonString
        });

        if (!blobResponse.ok) {
            throw new Error('Failed to create JSON blob');
        }

        // Get the JSON blob URL from the Location header
        const blobUrl = blobResponse.headers.get('Location');

        if (!blobUrl) {
            throw new Error('No blob URL received');
        }

        // Now shorten the URL with TinyURL instead of Bitly
        const response = await fetch(`https://api.tinyurl.com/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer Zcv8buxUUlP53OwVW7ucnDwS4EsE0m9ex9ZGerP0vjhR9bNxiv17uOnkaPak`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "url": blobUrl,
                "domain": "tinyurl.com"
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('TinyURL API Error:', errorData);
            throw new Error(`Failed to shorten URL: ${errorData.message || 'Unknown error'}`);
        }

        const result = await response.json();
        return {
            shortUrl: result.data.tiny_url, // TinyURL returns the shortened URL in this format
            originalUrl: blobUrl
        };
    } catch (error) {
        console.error('Error shortening URL:', error);
        throw error;
    }
}

async function generateQRCode(data) {
    try {
        if (typeof QRCode === 'undefined') {
            throw new Error('QR Code library not loaded properly');
        }

        const qrContainer = document.getElementById('qr-code');
        qrContainer.innerHTML = '<div class="loading">Generating QR code...</div>';

        // Get shortened URL and original URL from Bitly
        const { shortUrl } = await shortenUrlWithBitly(data);

        // Clear previous QR code
        qrContainer.innerHTML = '';

        // Generate new QR code with the shortened URL
        new QRCode(qrContainer, {
            text: shortUrl,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });

        // Add only the shortened URL below the QR code
        const urlContainer = document.createElement('div');
        urlContainer.style.textAlign = 'center';
        urlContainer.style.marginTop = '10px';

        // Add shortened URL
        const shortUrlDisplay = document.createElement('p');
        shortUrlDisplay.textContent = `Short URL: ${shortUrl}`;
        shortUrlDisplay.style.wordBreak = 'break-all';
        urlContainer.appendChild(shortUrlDisplay);

        qrContainer.appendChild(urlContainer);

        // Center the QR code using CSS
        qrContainer.style.display = 'flex';
        qrContainer.style.justifyContent = 'center';
        qrContainer.style.alignItems = 'center';
        qrContainer.style.flexDirection = 'column';

    } catch (error) {
        console.error('Error generating QR code:', error);
        showToast('Error generating QR code: ' + error.message, 'error');

        const qrContainer = document.getElementById('qr-code');
        if (qrContainer) {
            qrContainer.innerHTML = '<div class="error">Failed to generate QR code. Please try again.</div>';
        }
    }
}

// Update the QR code button handler
document.getElementById('show-qr').addEventListener('click', function () {
    try {
        const dataToExport = collectAnnotationData();
        if (!dataToExport || dataToExport.length === 0) {
            showToast('No annotation data to export', 'error');
            return;
        }

        // Hide the share form if it's visible
        document.getElementById('export-share-form').classList.remove('show');

        // Show the QR code container
        document.getElementById('qr-code-container').style.display = 'block';

        // Generate the QR code
        generateQRCode(dataToExport);
    } catch (error) {
        console.error('Error showing QR code:', error);
        showToast('Error generating QR code. Please try again.', 'error');
    }
});

// Update the share file button handler to hide QR code when showing share form
document.getElementById('share-file').addEventListener('click', function () {
    document.getElementById('qr-code-container').style.display = 'none';
    document.getElementById('export-share-form').classList.add('show');
});

// Update the close modal handler
document.querySelector('.export-modal-close').addEventListener('click', function () {
    document.querySelector('.export-modal-overlay').style.display = 'none';
    document.getElementById('export-share-form').classList.remove('show');
    document.getElementById('qr-code-container').style.display = 'none';
});

// Update the overlay click handler
document.querySelector('.export-modal-overlay').addEventListener('click', function (e) {
    if (e.target === this) {
        this.style.display = 'none';
        document.getElementById('export-share-form').classList.remove('show');
        document.getElementById('qr-code-container').style.display = 'none';
    }
});

// Add checkbox event handlers
document.addEventListener('DOMContentLoaded', function () {
    // Handle select all checkbox
    document.addEventListener('change', function (e) {
        if (e.target && e.target.id === 'select-all-entries') {
            const checkboxes = document.querySelectorAll('.entry-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
        }
    });

    // Handle individual checkbox changes
    document.addEventListener('change', function (e) {
        if (e.target && e.target.classList.contains('entry-checkbox')) {
            updateSelectAllCheckbox();
        }
    });
});

// Update select all checkbox state based on individual checkboxes
function updateSelectAllCheckbox() {
    const checkboxes = document.querySelectorAll('.entry-checkbox');
    const selectAllCheckbox = document.getElementById('select-all-entries');
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
    const someChecked = Array.from(checkboxes).some(checkbox => checkbox.checked);

    if (selectAllCheckbox) {
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;
    }
}

// Add copy JSON button handler
document.getElementById('copy-json').addEventListener('click', async function () {
    try {
        const dataToExport = await collectAnnotationData();
        if (!dataToExport || dataToExport.length === 0) {
            showToast('No annotation data to export', 'error');
            return;
        }

        // Convert to formatted JSON string with 2 spaces indentation
        const formattedJson = JSON.stringify(dataToExport, null, 2);

        // Copy to clipboard
        navigator.clipboard.writeText(formattedJson).then(() => {
            showToast('JSON copied to clipboard!', 'success');
        }).catch((error) => {
            console.error('Error copying to clipboard:', error);
            showToast('Failed to copy JSON to clipboard', 'error');
        });
    } catch (error) {
        console.error('Error copying JSON:', error);
        showToast('Error copying JSON data', 'error');
    }
});

document.getElementById('Back2').addEventListener('click', function () {
    console.log("Showing main menu from annotation history back");
    mainMenu();
});

document.getElementById('share-annotations').addEventListener('click', async function () {
    // Check if user is logged in
    if (await isUserLoggedIn2()) {
        const userId = await getUserEmail();
        const projectName = await getCurrentProject();
        var companyEmail = await getMainCompanyEmail();
        try {
            // Get the user's ID and create a shareable link
            const shareableLink = `chrome-extension://mjppefinnbejkeainagjnlhhbecemidp/share.html?uid=${userId}&project=${projectName}&companyEmail=${companyEmail}`;

            // Copy link to clipboard
            navigator.clipboard.writeText(shareableLink).then(() => {
                showToast('Share link copied to clipboard!', 'success');
            }).catch((error) => {
                console.error('Error copying to clipboard:', error);
                showToast('Failed to copy share link', 'error');
            });
        } catch (error) {
            console.error('Error generating share link:', error);
            showToast('Error generating share link', 'error');
        }
    }
    else {
        showToast('Please login to share annotations', 'error');
    }
});

function updateFilterPath() {
    // Get the selected values from button filters
    const selectedTypeButtons = document.querySelectorAll('.filter-button[data-type].active');
    const selectedKeyButtons = document.querySelectorAll('.filter-button[data-key].active');
    const selectedOptionButtons = document.querySelectorAll('.filter-button[data-option].active');

    // Get the filter path display element
    const filterPathDiv = document.getElementById('annotation-history-filter-path');

    if (!filterPathDiv) {
        console.error('Filter path display element not found');
        return;
    }

    // Get selected values from buttons
    const selectedTypes = Array.from(selectedTypeButtons).map(button => button.getAttribute('data-value')).filter(Boolean);
    const selectedKeys = Array.from(selectedKeyButtons).map(button => button.getAttribute('data-key')).filter(Boolean);
    const selectedOptions = Array.from(selectedOptionButtons).map(button => button.getAttribute('data-option')).filter(Boolean);

    // Build the path array with only non-empty values
    const pathParts = [...selectedTypes, ...selectedKeys, ...selectedOptions].filter(part => part);

    // Join the parts with slashes
    const pathString = pathParts.join('/');

    // Update the display
    filterPathDiv.textContent = pathString;
    filterPathDiv.title = pathString; // Add tooltip for long paths
}

// Add event listeners to the pills
function initializeFilterPathListeners() {
    // No longer needed since we're using pills instead of dropdowns
    // The pill event listeners are handled in initializePillFilters()
    console.log('Filter path listeners initialized for pill system');
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    initializeFilterPathListeners();
    updateFilterPath(); // Initialize the path display
    setTimeout(async function () {
        if (await isUserLoggedIn2()) {
            var projectName = await getCurrentProject();
            var companyEmail = await getMainCompanyEmail();
            listenerFirebaseData(`Companies/${companyEmail}/projects/${projectName}/annotationHistory`, function () {
                populateAnnotationHistoryTable();
            });
        }
    }, 3000);
});

// Pill Filter Functions
function initializePillFilters() {
    console.log('Initializing dropdown filters');
    
    // Add a small delay to ensure DOM is ready
    setTimeout(() => {
        // Initialize dropdown functionality
        initDropdown('typeDropdown', 'typeMenu');
        
        // Set default state - only show first level (Type filter)
        clearKeysAndOptions();
    }, 100);
}

function initDropdown(buttonId, menuId) {
    const button = document.getElementById(buttonId);
    const menu = document.getElementById(menuId);
    
    if (!button || !menu) return;
    
    // Remove existing event listeners to prevent duplicates
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    const items = menu.querySelectorAll('.dropdown-item');
    const buttonText = newButton.querySelector('span');

    newButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Close other dropdowns
        document.querySelectorAll('.dropdown-menu').forEach(m => {
            if (m !== menu) m.classList.remove('active');
        });
        document.querySelectorAll('.dropdown-button').forEach(b => {
            if (b !== newButton) b.classList.remove('active');
        });

        // Toggle current dropdown
        menu.classList.toggle('active');
        newButton.classList.toggle('active');
    });

    items.forEach(item => {
        // Remove existing listeners
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
        
        newItem.addEventListener('click', () => {
            // Remove selected from all items
            menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('selected'));
            
            // Add selected to clicked item
            newItem.classList.add('selected');
            
            // Update button text
            buttonText.textContent = newItem.textContent;
            buttonText.classList.remove('placeholder');
            buttonText.classList.add('selected-value');
            
            // Close dropdown
            menu.classList.remove('active');
            newButton.classList.remove('active');

            // Handle the selection based on dropdown type
            if (buttonId === 'typeDropdown') {
                handleTypeSelection(newItem.dataset.value);
            } else if (buttonId === 'keysDropdown') {
                handleKeySelection(newItem.dataset.value);
            } else if (buttonId === 'optionsDropdown') {
                handleOptionSelection(newItem.dataset.value);
            }
        });
    });
}

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('active');
    });
    document.querySelectorAll('.dropdown-button').forEach(button => {
        button.classList.remove('active');
    });
});

function handleTypeSelection(value) {
    console.log(`Type selected: ${value}`);
    
    // Hide options when type changes
    const optionsContainer = document.getElementById('optionsMenu');
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
        const filterContainer = optionsContainer.closest('.filter-container');
        if (filterContainer) {
            filterContainer.classList.add('hidden');
        }
    }
    
    // Update keys dropdown based on selected type
    updateKeysDropdown(value);
    
    // Update search input and trigger filtering
    updateSearchInput();
}

function handleKeySelection(value) {
    console.log(`Key selected: ${value}`);
    
    // Update options dropdown based on selected keys
    updateOptionsDropdown();
    
    // Update search input and trigger filtering
    updateSearchInput();
}

function handleOptionSelection(value) {
    console.log(`Option selected: ${value}`);
    
    // Update search input and trigger filtering
    updateSearchInput();
}

function clearKeysAndOptions() {
    // Hide keys container
    const keysContainer = document.getElementById('keysMenu');
    if (keysContainer) {
        keysContainer.innerHTML = '';
        const filterContainer = keysContainer.closest('.filter-container');
        if (filterContainer) {
            filterContainer.classList.add('hidden');
        }
    }
    
    // Hide options container
    const optionsContainer = document.getElementById('optionsMenu');
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
        const filterContainer = optionsContainer.closest('.filter-container');
        if (filterContainer) {
            filterContainer.classList.add('hidden');
        }
    }
}

function updateKeysDropdown(selectedType = null) {
    const keysMenu = document.getElementById('keysMenu');
    if (!keysMenu) {
        console.error('keysMenu element not found!');
        return;
    }
    
    console.log('updateKeysDropdown called with:', { selectedType });
    console.log('Available mappings:', { labelMapping, codeMapping });
    
    // Show the keys section
    const filterContainer = keysMenu.closest('.filter-container');
    if (filterContainer) {
        filterContainer.classList.remove('hidden');
    }
    
    // Clear existing keys items
    keysMenu.innerHTML = '';
    
    let keysToShow = {};
    
    if (selectedType === 'label') {
        keysToShow = labelMapping;
    } else if (selectedType === 'code') {
        keysToShow = codeMapping;
    } else if (selectedType === 'all' || !selectedType) {
        keysToShow = { ...labelMapping, ...codeMapping };
    }
    
    console.log('Keys to show:', keysToShow);
    
    // Create dropdown items for each key
    Object.keys(keysToShow).forEach(key => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.setAttribute('data-value', key);
        item.textContent = key;
        
        keysMenu.appendChild(item);
    });
    
    // Re-initialize the keys dropdown with a small delay
    setTimeout(() => {
        initDropdown('keysDropdown', 'keysMenu');
    }, 10);
    
    // Update total count
    const totalCount = Object.keys(keysToShow).length;
    const totalElement = keysMenu.closest('.filter-container').querySelector('.filter-total');
    if (totalElement) {
        totalElement.textContent = `Total: ${totalCount}`;
    }
}

function updateOptionsDropdown() {
    const optionsMenu = document.getElementById('optionsMenu');
    if (!optionsMenu) return;
    
    // Clear existing options items
    optionsMenu.innerHTML = '';
    
    // Get selected keys
    const selectedKeyItems = document.querySelectorAll('#keysMenu .dropdown-item.selected');
    const selectedKeys = Array.from(selectedKeyItems).map(item => item.getAttribute('data-value'));
    
    if (selectedKeys.length === 0) {
        // No keys selected, hide options
        const filterContainer = optionsMenu.closest('.filter-container');
        if (filterContainer) {
            filterContainer.classList.add('hidden');
        }
        return;
    }
    
    // Show the options section
    const filterContainer = optionsMenu.closest('.filter-container');
    if (filterContainer) {
        filterContainer.classList.remove('hidden');
    }
    
    // Get options for selected keys
    const allOptions = new Set();
    
    selectedKeys.forEach(key => {
        // Get options from both labelMapping and codeMapping
        const labelOptions = labelMapping[key] || [];
        const codeOptions = codeMapping[key] || [];
        
        [...labelOptions, ...codeOptions].forEach(option => {
            if (option) {
                allOptions.add(option);
            }
        });
    });
    
    // Create dropdown items for each option
    Array.from(allOptions).forEach(option => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.setAttribute('data-value', option);
        item.textContent = option;
        
        optionsMenu.appendChild(item);
    });
    
    // Re-initialize the options dropdown with a small delay
    setTimeout(() => {
        initDropdown('optionsDropdown', 'optionsMenu');
    }, 10);
    
    // Update total count
    const totalOptions = allOptions.size;
    const totalElement = optionsMenu.closest('.filter-container').querySelector('.filter-total');
    if (totalElement) {
        totalElement.textContent = `Total: ${totalOptions}`;
    }
}

function handleTypePillClick(event) {
    const button = event.currentTarget;
    const type = button.getAttribute('data-type');
    const value = button.getAttribute('data-value');
    
    console.log(`Type button clicked: ${type}, value: ${value}`);
    
    // Remove active class from all type buttons
    document.querySelectorAll('.filter-button[data-type]').forEach(b => {
        b.classList.remove('active');
    });
    
    // Add active class to clicked button
    button.classList.add('active');
    
    // Hide options when type changes
    const optionsContainer = document.getElementById('options-pill-container');
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
        const filterContainer = optionsContainer.closest('.filter-container');
        if (filterContainer) {
            filterContainer.classList.add('hidden');
        }
    }
    
    // Show keys section and update keys buttons based on selected type
    updateKeysPills(type, value);
    
    // Update search input and trigger filtering
    updateSearchInput();
}

function updateKeysPills(selectedType = null, selectedValue = null) {
    const keysContainer = document.getElementById('keys-pill-container');
    if (!keysContainer) return;
    
    console.log('updateKeysPills called with:', { selectedType, selectedValue });
    console.log('Available mappings:', { labelMapping, codeMapping });
    
    // Show the keys section
    const filterContainer = keysContainer.closest('.filter-container');
    if (filterContainer) {
        filterContainer.classList.remove('hidden');
    }
    
    // Clear existing keys buttons
    keysContainer.innerHTML = '';
    
    let keysToShow = {};
    
    if (selectedType === 'Label') {
        keysToShow = labelMapping;
    } else if (selectedType === 'Code') {
        keysToShow = codeMapping;
    } else if (selectedType === 'All' || !selectedType) {
        keysToShow = { ...labelMapping, ...codeMapping };
    }
    
    console.log('Keys to show:', keysToShow);
    
    // Create buttons for each key
    Object.keys(keysToShow).forEach(key => {
        const button = document.createElement('button');
        button.className = 'filter-button';
        button.setAttribute('data-key', key);
        button.textContent = key;
        
        button.addEventListener('click', handleKeyPillClick);
        keysContainer.appendChild(button);
    });
    
    // Update total count
    const totalCount = Object.keys(keysToShow).length;
    const totalElement = keysContainer.parentElement.querySelector('.filter-total');
    if (totalElement) {
        totalElement.textContent = `Total: ${totalCount}`;
    }
    
    // Update key counts
    updateKeyCounts();
}

function handleKeyPillClick(event) {
    const button = event.currentTarget;
    const key = button.getAttribute('data-key');
    
    console.log(`Key button clicked: ${key}`);
    
    // Toggle active state
    button.classList.toggle('active');
    
    // Update options buttons based on selected keys
    updateOptionsPills();
    
    // Update search input and trigger filtering
    updateSearchInput();
}

function updateSearchInput() {
    const selectedTypeItems = document.querySelectorAll('#typeMenu .dropdown-item.selected');
    const selectedKeyItems = document.querySelectorAll('#keysMenu .dropdown-item.selected');
    const selectedOptionItems = document.querySelectorAll('#optionsMenu .dropdown-item.selected');
    
    console.log('Selected items:', {
        types: selectedTypeItems.length,
        keys: selectedKeyItems.length,
        options: selectedOptionItems.length
    });
    
    let filterString = '';
    let filterPathItems = [];
    
    // Add type filters
    selectedTypeItems.forEach(item => {
        const value = item.getAttribute('data-value');
        if (value && value !== 'all') {
            filterString += `?${value} `;
            filterPathItems.push({
                type: 'type',
                label: 'Type',
                value: value,
                display: value
            });
        }
    });
    
    // Add key filters
    selectedKeyItems.forEach(item => {
        const key = item.getAttribute('data-value');
        if (key) {
            filterString += `!${key} `;
            filterPathItems.push({
                type: 'key',
                label: 'Key',
                value: key,
                display: key
            });
        }
    });
    
    // Add option filters
    selectedOptionItems.forEach(item => {
        const option = item.getAttribute('data-value');
        if (option) {
            filterString += `#${option} `;
            filterPathItems.push({
                type: 'option',
                label: 'Option',
                value: option,
                display: option
            });
        }
    });
    
    console.log('Filter string:', filterString.trim());
    console.log('About to trigger filtering with:', filterString.trim());
    
    // Update search input (keep empty for user input)
    const searchInput = document.getElementById('annotation-history-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Update filter path bar
    updateFilterPathBar(filterPathItems);
    
    // Trigger filtering with the filter string
    if (filterString.trim()) {
        console.log('Calling handleSearchInput with filter string:', filterString.trim());
        handleSearchInput({ target: { value: filterString.trim() } });
    } else {
        console.log('Calling handleSearchInput with empty string');
        handleSearchInput({ target: { value: '' } });
    }
    
    updateFilterPath(); // Update the filter path display
}

function updateFilterPathBar(filterPathItems) {
    const filterPathBar = document.getElementById('filter-path-bar');
    if (!filterPathBar) return;
    
    // Clear existing items
    filterPathBar.innerHTML = '';
    
    if (filterPathItems.length === 0) {
        filterPathBar.style.display = 'none';
        return;
    }
    
    // Show the filter path bar
    filterPathBar.style.display = 'flex';
    
    // Create filter path items
    filterPathItems.forEach(item => {
        const pathItem = document.createElement('div');
        pathItem.className = `filter-path-item filter-path-${item.type}`;
        
        pathItem.innerHTML = `
            <span class="filter-path-label">${item.label}:</span>
            <span class="filter-path-value">${item.display}</span>
        `;
        
        filterPathBar.appendChild(pathItem);
    });
    
    // Add clear all button
    const clearButton = document.createElement('div');
    clearButton.className = 'filter-path-clear';
    clearButton.textContent = 'Clear All';
    clearButton.addEventListener('click', clearAllFilters);
    filterPathBar.appendChild(clearButton);
}

function clearAllFilters() {
    // Clear all dropdown selections
    document.querySelectorAll('.dropdown-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Reset dropdown button text to placeholders
    const typeButton = document.getElementById('typeDropdown');
    if (typeButton) {
        const buttonText = typeButton.querySelector('span');
        buttonText.textContent = 'Select type...';
        buttonText.classList.add('placeholder');
        buttonText.classList.remove('selected-value');
    }
    
    const keysButton = document.getElementById('keysDropdown');
    if (keysButton) {
        const buttonText = keysButton.querySelector('span');
        buttonText.textContent = 'Select key...';
        buttonText.classList.add('placeholder');
        buttonText.classList.remove('selected-value');
    }
    
    const optionsButton = document.getElementById('optionsDropdown');
    if (optionsButton) {
        const buttonText = optionsButton.querySelector('span');
        buttonText.textContent = 'Select option...';
        buttonText.classList.add('placeholder');
        buttonText.classList.remove('selected-value');
    }
    
    // Hide keys and options sections
    clearKeysAndOptions();
    
    // Clear filter path bar
    updateFilterPathBar([]);
    
    // Clear search and refresh table
    const searchInput = document.getElementById('annotation-history-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    handleSearchInput({ target: { value: '' } });
}

async function updatePillCounts() {
    try {
        const { dataList } = await getLocalStorageData();
        const annotation = "annotationHistory";
        
        let labelCount = 0;
        let codeCount = 0;
        const keyCounts = {};
        
        dataList.forEach(entry => {
            if (entry.key === annotation) {
                const jsonObject = entry.value;
                const parsedAnnotations = JSON.parse(Object.values(jsonObject)[0]);
                
                parsedAnnotations.forEach(innerArray => {
                    innerArray.forEach(item => {
                        const type = item.type || '';
                        const key = item.key || '';
                        
                        if (type.toLowerCase() === 'label') {
                            labelCount++;
                        } else if (type.toLowerCase() === 'code') {
                            codeCount++;
                        }
                        
                        if (key) {
                            keyCounts[key] = (keyCounts[key] || 0) + 1;
                        }
                    });
                });
            }
        });
        
        // Update type counts
        const labelCountElement = document.getElementById('label-count');
        const codeCountElement = document.getElementById('code-count');
        
        if (labelCountElement) labelCountElement.textContent = labelCount;
        if (codeCountElement) codeCountElement.textContent = codeCount;
        
        // Update key counts
        Object.keys(keyCounts).forEach(key => {
            const countElement = document.querySelector(`[data-key="${key}"]`);
            if (countElement) {
                countElement.textContent = keyCounts[key];
            }
        });
        
    } catch (error) {
        console.error('Error updating pill counts:', error);
    }
}

function updateOptionsPills() {
    const optionsContainer = document.getElementById('options-pill-container');
    if (!optionsContainer) return;
    
    // Clear existing options buttons
    optionsContainer.innerHTML = '';
    
    // Get selected keys
    const selectedKeyButtons = document.querySelectorAll('.filter-button[data-key].active');
    const selectedKeys = Array.from(selectedKeyButtons).map(button => button.getAttribute('data-key'));
    
    if (selectedKeys.length === 0) {
        // No keys selected, hide options
        const filterContainer = optionsContainer.closest('.filter-container');
        if (filterContainer) {
            filterContainer.classList.add('hidden');
        }
        return;
    }
    
    // Show the options section
    const filterContainer = optionsContainer.closest('.filter-container');
    if (filterContainer) {
        filterContainer.classList.remove('hidden');
    }
    
    // Get options for selected keys
    const allOptions = new Set();
    
    selectedKeys.forEach(key => {
        // Get options from both labelMapping and codeMapping
        const labelOptions = labelMapping[key] || [];
        const codeOptions = codeMapping[key] || [];
        
        [...labelOptions, ...codeOptions].forEach(option => {
            if (option) {
                allOptions.add(option);
            }
        });
    });
    
    // Create buttons for each option
    Array.from(allOptions).forEach(option => {
        const button = document.createElement('button');
        button.className = 'filter-button';
        button.setAttribute('data-option', option);
        button.textContent = option;
        
        button.addEventListener('click', handleOptionPillClick);
        optionsContainer.appendChild(button);
    });
    
    // Update total count
    const totalOptions = allOptions.size;
    const totalElement = optionsContainer.parentElement.querySelector('.filter-total');
    if (totalElement) {
        totalElement.textContent = `Total: ${totalOptions}`;
    }
}

function handleOptionPillClick(event) {
    const button = event.currentTarget;
    const option = button.getAttribute('data-option');
    
    console.log(`Option button clicked: ${option}`);
    
    // Toggle active state
    button.classList.toggle('active');
    
    // Update search input and trigger filtering
    updateSearchInput();
}