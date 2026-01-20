import { SELECTED_TEXT, callSetItem, callGetItem, showToast } from '../frames.js';
import { hideFrame, customFrameMenu, showFrame, showFrameLabel, showFrameAndDisplay, hideAllSubFrames } from './utils.js';


async function getNotes() {
    var notes = Object.values(await callGetItem("savedNotes") || []);
    if(notes.length > 0)
        notes = notes[0];
    return notes;
}

var currNoteIndex;
const noteMain = ["note-board-cancel"];
// const noteMain = ["Note", "note-board-cancel"];
noteMain.forEach(id => {
    document.getElementById(id).addEventListener("click", () => {
        console.log(`noteMain ID = ${id}`);
        updateNoteboard();

    });
});


// Update the noteboard with truncated content
async function updateNoteboard() {
    console.log('-- updateNoteboard() --');

    hideAllSubFrames();

    // note (toolbar, editor, output-display)
    showFrame("note-sub-frame-label");
    showFrame("note-sub-frame");
    showFrame("noteboard");

    // buttons
    showFrame("note-sub-frame-save-note");
    showFrame("note-sub-frame-voice-note");
    showFrame("note-sub-frame-back-note");

    // hidden initially
    // showFrame("note-sub-frame-update-note");
    // showFrame("note-sub-frame-cancel-note");

    let notes = await getNotes();
    // const notes = JSON.parse(await callGetItemDB("savedNotes")) || [];


    const noteboard = document.getElementById("noteboard");


    noteboard.innerHTML = ""; // Clear existing notes


    notes.forEach((entry, index) => {
        const noteDiv = createNoteElement(entry, index);
        noteboard.appendChild(noteDiv);
    });

    // clear editor
    document.getElementById("textEditorOutput").innerHTML = '';
}

function createNoteElement(entry, index) {
    console.log(`-- createNoteElement(entry = ${entry}, index = ${index}) --`);

    const noteDiv = document.createElement("div");
    noteDiv.classList.add("note"); // Add 'note' class for styling

    // Display truncated content with "Read More" button
    noteDiv.innerHTML = entry.noteContent;
    var nContent = noteDiv.innerText;

    const truncatedContent = nContent.length > 230 ? truncateText(nContent, 230) : entry.noteContent;

    // the readLess button is hidden here.
    // might be better to change the name of the readMore button instead of add a read less button
    noteDiv.innerHTML = `
        <strong>Selected Text:</strong> ${entry.SELECTED_TEXT}<br>
        <strong>Note:</strong> <span id="noteContent-${index}">${truncatedContent}</span>
        <div style="margin-top:25px">
            ${nContent.length > 230 ? `<button id="readMore-${index}" class="note-panel-button">Read More</button>` : ""}
            <button id="readLess-${index}" class="note-panel-button" style="display: none;">Read Less</button>
            <button id="editNote-${index}" class="note-panel-button icon-only">
                <i class="far fa-edit"></i>
            </button>
            <button id="deleteNote-${index}" class="note-panel-button icon-only">
                <i class="far fa-trash-alt"></i>
            </button>
        </div>
    `;

    if (nContent.length > 230) {
        noteDiv.querySelector(`#readMore-${index}`)
            .addEventListener("click", () => {
                expandNote(index);
            });
    }

    noteDiv.querySelector(`#editNote-${index}`).addEventListener("click", () => {
        editNote(index);
    });

    noteDiv
        .querySelector(`#deleteNote-${index}`)
        .addEventListener("click", () => {
            deleteTextNote(index);
        });

    return noteDiv;
}
function truncateText(text, length) {
    if (text.length <= length) {
        return text;
    }
    return text.slice(0, length) + "...";
}
async function expandNote(index) {

    const fullContent = (await getNotes())[index].noteContent;
    document.getElementById(`noteContent-${index}`).innerHTML = fullContent;
    // hide read more
    document.getElementById(`readMore-${index}`).style.display = "none";
    // show read less
    document.getElementById(`readLess-${index}`).style.display = "";

    document.getElementById(`readLess-${index}`).addEventListener("click", () => {
        // will restart to original view
        updateNoteboard();
    });
}

async function editNote(index) {
    let fullContent = (await getNotes())[index].noteContent;
    console.log(`fullContent = ${fullContent}`);
    document.getElementById("textEditorOutput").innerHTML = fullContent;
    const noteboard = document.getElementById("noteboard");
    noteboard.innerHTML = ""; // Clear existing notes
    currNoteIndex = index;
    // hideButton("saveNote");
    // showButton("updateNote");
    hideAllSubFrames();
    // note (toolbar, editor, output-display)
    showFrame("note-sub-frame");
    showFrame("noteboard");

    showFrame("note-sub-frame-update-note");
    showFrame("note-sub-frame-voice-note");
    showFrame("note-sub-frame-cancel-note");
}

async function deleteTextNote(index) {
    let notes = await getNotes();
    if (!notes || index >= notes.length) return; // If no notes or index out of range, exit function

    // Remove the note at the specified index
    notes.splice(index, 1);
    // Update the local storage with the new notes array
    // localStorage.setItem("savedNotes", JSON.stringify(notes));
    callSetItem("savedNotes", notes);
    // Refresh the display of notes
    updateNoteboard();
}

////


document.getElementById("updateNote").addEventListener("click", async function () {
    if (currNoteIndex > -1) {
        const noteContent = document.getElementById("textEditorOutput").innerHTML; // Get the content from the rich text editor

        // Save the note to local storage
        let notes = await getNotes();
        notes[currNoteIndex].noteContent = noteContent;

        // Save both note content and selected text
        callSetItem("savedNotes", notes);
        // localStorage.setItem("savedNotes", JSON.stringify(notes));

        // Call to update the noteboard
        updateNoteboard();
        // hideButton("updateNote");
        // showButton("saveNote");

        hideAllSubFrames()
        // note (toolbar, editor, output-display)
        showFrame("note-sub-frame");
        showFrame("noteboard");

        showFrame("note-sub-frame-save-note");
        showFrame("note-sub-frame-back-note");
        showFrame("note-sub-frame-voice-note");
        // hidden initially
        // showFrame("note-sub-frame-update-note")
        // showFrame("note-sub-frame-cancel-not



    }
});

document.getElementById("saveNote").addEventListener("click", async function () {
    const noteContent = document.getElementById("textEditorOutput").innerHTML; // Get the content from the rich text editor

    // Save the note to local storage
    let notes = await getNotes();
    // Save both note content and selected text
    notes.push({ noteContent, SELECTED_TEXT });
    callSetItem("savedNotes", notes);
    // localStorage.setItem("savedNotes", JSON.stringify(notes));
    console.log("selected text: " + SELECTED_TEXT);
    console.log("noteContent: " + noteContent);

    // Call to update the noteboard
    updateNoteboard();
});



// toolbar methods

document
    .getElementById("fontFamilySelector")
    .addEventListener("change", function () {
        document.execCommand("fontName", false, this.value);
    });
document.getElementById('textColor').addEventListener('change', function () {
    document.execCommand('foreColor', false, this.value);
});

// HIGHLIGHTER
let highlightActive = false; // State to track if highlight mode is active
let selectedColor = ""; // Store the selected color for toggling

// Apply highlight to the selected range
function applyHighlight(range, color) {
    const span = document.createElement("span");
    span.style.backgroundColor = color;
    range.surroundContents(span);
}
// Toggle highlight mode on click of the highlighter button
document
    .getElementById("highlighterButton")
    .addEventListener("click", function () {
        highlightActive = !highlightActive; // Toggle the highlight mode
        this.classList.toggle("active", highlightActive); // Visually indicate if highlight mode is active

        if (highlightActive) {
            document.getElementById("highlightColor").click(); // Open color picker if mode is activated
        } else {
            removeHighlights(); // Disable highlighting by removing all highlights
        }
    });

export function removeHighlights() {
    document
        .querySelectorAll('span[style*="background-color"]')
        .forEach((span) => {
            const parent = span.parentNode;
            while (span.firstChild) parent.insertBefore(span.firstChild, span);
            parent.removeChild(span);
        });
}
document
    .getElementById("highlightColor")
    .addEventListener("change", function () {
        selectedColor = this.value; // Update the current color
        document.querySelector("#highlighterButton .fa-highlighter").style.color =
            selectedColor; // Change the icon color
        applyOrRemoveHighlights(); // Apply or remove highlights based on the active state
    });
// Apply or remove highlights based on the toggle state
export function applyOrRemoveHighlights() {
    const selection = window.getSelection();
    if (!selection.isCollapsed && highlightActive) {
        const range = selection.getRangeAt(0);
        applyHighlight(range, selectedColor);
    } else if (!highlightActive) {
        removeHighlights();
    }
}
document
    .getElementById("fontSizeSelector")
    .addEventListener("change", function () {
        document.execCommand("fontSize", false, this.value);
    });
document
    .getElementById("colorPickerButton")
    .addEventListener("click", function () {
        document.getElementById("textColor").click(); // Simulate click on hidden color input
    });
let output = document.getElementById("textEditoroutput");
let texteditorbuttons = document.getElementsByClassName("textEditortool--btn");
for (let btn of texteditorbuttons) {
    btn.addEventListener("click", () => {
        let cmd = btn.dataset["command"];
        if (cmd === "createlink") {
            let url = prompt("Enter the link here: ", "http://");
            document.execCommand(cmd, false, url);
        } else {
            document.execCommand(cmd, false, null);
        }
    });
}
document.getElementById("textColor").addEventListener("change", function () {
    document.execCommand("foreColor", false, this.value); // Change text color
    document.querySelector("#colorPickerButton .fa-palette").style.color =
        this.value; // Change icon color
});
// voice-to-text
// Speech to Text handler for .voiceRecordBtns
export const speechToText = (target) => {
    console.log(`Debug VOICE-TO-TEXT here`);
    
    showToast("Begin talking in 2...", "info");
    setTimeout(function () {
      showToast("Begin talking in 1...", "info");
      setTimeout(function () {
        showToast("Begin talking now", "success");
      }, 1000);
    }, 1000);

    var speech = true;
    window.SpeechRecognition = window.webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.interimResults = true;

    const element =
        target != "" ? `${target}__textEditorOutput` : "textEditorOutput";
    console.log(element);
    recognition.addEventListener("result", (e) => {
        const transcript = Array.from(e.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join("");

        document.getElementById(element).innerHTML = transcript;
        console.log(transcript);
    });

    if (speech == true) {
        recognition.start();
    }
    console.log(`speech = ${speech}`);
};

document.getElementById("voiceRecordBtn").addEventListener("click", () => {
    speechToText("");
});


// utils
function hideAllButtons() {
    const buttons = document.querySelectorAll("button");
    buttons.forEach((button) => {
        button.style.display = "none";
    });

    // document.getElementById("videoPopup").style.display = "none"; // Show video player
    // document.getElementById("videoUploader").style.display = "none"; // Show upload button

    const h3s = document.querySelectorAll("h3");
    h3s.forEach((h3) => {
        h3.style.display = "none";
    });

    const inputs = document.querySelectorAll("input");
    inputs.forEach((input) => {
        input.style.display = "none";
    });
}

function showButton(id) {
    // if (id == "Label" || id == "Annotation History Div") showButton("Back");
    document.getElementById(id).style.display = "";
    document.getElementById("customPostion").style.left = "370px";
}
function hideButton(id) {
    document.getElementById(id).style.display = "none";
}