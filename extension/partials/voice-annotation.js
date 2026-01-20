import { SELECTED_TEXT, callSetItem, callGetItem } from '../frames.js';
import { hideFrame, customFrameMenu, showFrame, showFrameLabel, showFrameAndDisplay, hideAllSubFrames } from './utils.js';
import { removeHighlights, applyOrRemoveHighlights, speechToText } from './note.js';

var currVoiceNoteIndex;

async function getVoiceNotes() {
    let notes = Object.values(await callGetItem(`voiceLogs/${currentVoiceLog}/voiceSavedNotes`) || []);
    if (notes.length > 0)
        notes = JSON.parse(notes[0]);
    return notes;
}

function truncateText(text, length) {
    if (text.length <= length) {
        return text;
    }
    return text.slice(0, length) + "...";
}

var currentVoiceLog = null;
// --- Audio File List Logic ---
async function listVoiceAudioFiles() {
    hideAllSubFrames();
    const audioFileListDiv = document.getElementById('voiceAudioFileList');
    const container = document.getElementById('voiceAudioFileListContainer');
    container.innerHTML = '<div>Loading audio files...</div>';
    audioFileListDiv.style.display = 'block';

    let audioFiles = Object.values(await callGetItem("voiceLogs") || []);
    if (audioFiles.length > 0)
        audioFiles = audioFiles[0];
    // const audioFiles = dataList.filter(item => item.key.includes('voiceLogs/'));
    if (audioFiles.length === 0) {
        container.innerHTML = '<div>No audio files found. Please upload one.</div>';
        return;
    }
    container.innerHTML = '';
    for (let [key, value] of Object.entries(audioFiles)) {
        const btn = document.createElement('button');
        btn.classList.add('voiceBtns');
        btn.classList.add('voiceFileBtn');
        btn.style.margin = '8px 0';
        btn.innerHTML = `<img style="width: 24px;" src="img/waveform.svg"></img><span style="display: flex; flex-grow: 1;">${value.name}</span>`;
        btn.style.height = "50px";
        btn.style.width = "100%";
        btn.style.margin = "0px";
        btn.onclick = async () => {
            if (deleteBtn.dataset.wasClicked === "true") { //Need to check for delete button click since it will trigger both buttons normally
                deleteBtn.dataset.wasClicked = "false";
                return;
            }

            currentVoiceLog = key;
            // Hide the audio file list
            audioFileListDiv.style.display = 'none';
            // Load the audio file into wavesurfer
            let data = value && value.data ? value.data : (typeof value === 'string' ? JSON.parse(value).data : null);
            if (data) {
                const blob = dataURLtoBlob(data);
                const blobUrl = URL.createObjectURL(blob);
                wavesurfer.load(blobUrl);
            }
            // Show the annotation UI
            hideAllSubFrames();
            showFrame('voice-sub-frame-label');
            showFrame('small-rectangles');
            showFrame('voiceNoteboard');
            showVoiceAnnotations();
            document.getElementById('voiceAnnotationRectangle').style.display = 'block';
            document.getElementById('audio-control').style.display = 'flex';
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "voiceFileDeleteBtn";
        deleteBtn.innerHTML = `<i class="fas fa-trash"></i>`;
        deleteBtn.onclick = async () => {
            deleteBtn.dataset.wasClicked = "true";
            await callSetItem(`voiceLogs/${key}`, null);
            listVoiceAudioFiles();
        };
        btn.appendChild(deleteBtn);
        container.appendChild(btn);
    }
}

document.getElementById("VoiceAnnotation").addEventListener("click", () => {
    listVoiceAudioFiles();
    showFrame('voice-sub-frame-label');
});

document.getElementById("voice-board-cancel").addEventListener("click", () => {
    hideAllSubFrames();
    showFrame("voice-sub-frame-label");
    showFrame("small-rectangles");
    showFrame("voiceNoteboard");
    showVoiceAnnotations();
    document.getElementById("voiceAnnotationRectangle").style.display = "block";
    document.getElementById("audio-control").style.display = "flex";
});

document.getElementById("voice-back-btn").addEventListener("click", () => {
    if (document.getElementById("voiceAudioFileList").style.display == "none") {
        document.getElementById("VoiceAnnotation").click(); //Go back to voice log list
    }
    else {
        hideAllSubFrames();
        showFrame("annotation-system-sub-frame");
    }
});

function showVoiceAnnotations() {
    console.log(`-- showVoiceAnnotations() -- `);

    document.getElementById("voice__richTextEditor").style.display = "none";
    document.getElementById("voice__voiceRecordBtn").style.display = "none";
    document.getElementById("voice__saveNote").style.display = "none";
    // document.getElementById("voice__back").style.display = "none";
    // hideAllButtons(); // Assuming this function hides all other elements

    // document.getElementById("voiceAnnotationSection").style.display = "block"; // Show the rectangle
    // document.getElementById("voiceAnnotationRectangle").style.display = "block";
    document.getElementById("voiceNoteboard").style.display = "block";
    document.getElementById("small-rectangles").style.display = "block";
    document.getElementById("btnBack").style.display = "block";
    document.getElementById("btnVolume").style.display = "block";
    document.getElementById("btnPlay").style.display = "block";
    document.getElementById("btnPause").style.display = "block";
    document.getElementById("btnForward").style.display = "block";
    document.getElementById("btnAudioUpload").style.display = "block";
    document.getElementById("btnAddNote").style.display = "block";
    document.getElementById("voice-back-btn").style.display = "block";

    updateVoiceNoteboard();
}

async function updateVoiceNoteboard() {
    console.log(`-- updateVoiceNoteboard() --`);

    let notesData = await getVoiceNotes();
    const notes = Array.isArray(notesData) ? notesData : [];
    const noteboard = document.getElementById("voiceNoteboard");
    noteboard.innerHTML = ""; // Clear existing notes

    notes.forEach((entry, index) => {
        const noteDiv = createVoiceNoteElement(entry, index);
        noteboard.appendChild(noteDiv);
    });
}

function createVoiceNoteElement(entry, index) {
    // Create card container
    const card = document.createElement('div');
    card.className = 'catalog-card';

    // Create note preview section
    const notePreview = document.createElement('div');
    notePreview.className = 'catalog-note-preview';
    notePreview.style.maxHeight = '100px';
    notePreview.style.overflow = 'hidden';
    notePreview.style.position = 'relative';
    notePreview.style.marginBottom = '0';
    notePreview.style.paddingBottom = '0';
    notePreview.style.whiteSpace = 'pre-line';
    notePreview.style.wordBreak = 'break-word';
    notePreview.style.display = 'block';

    // Truncate note content if too long
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = entry.noteContent;
    const plainText = tempDiv.innerText;
    const truncatedContent =
        plainText.length > 230 ? truncateText(plainText, 230) : entry.noteContent;

    // Compose preview HTML
    notePreview.innerHTML =
        `<strong>Selected Text:</strong> ${entry.selectedText || ''}<br>` +
        `<strong>Note:</strong> <span id="voiceNoteContent-${index}">${truncatedContent}</span>`;

    // Read More button (if needed)
    let readMoreBtn = null;
    if (plainText.length > 230) {
        readMoreBtn = document.createElement('button');
        readMoreBtn.id = `voiceReadMore-${index}`;
        readMoreBtn.className = 'note-panel-button voice-read-more-btn';
        readMoreBtn.style.width = '100%';
        readMoreBtn.style.margin = '8px 0 0 0';
        readMoreBtn.style.display = 'block';
        readMoreBtn.innerHTML = 'Read More <i class="fas fa-chevron-down"></i>';
        readMoreBtn.addEventListener('click', async () => {
            // Expand preview to show all text, remove scrollbars
            const fullContent = (await getVoiceNotes())[index].noteContent;
            document.getElementById(`voiceNoteContent-${index}`).innerHTML = fullContent;
            notePreview.style.maxHeight = 'none';
            notePreview.style.overflow = 'visible';
            readMoreBtn.style.display = 'none';
        });
    }

    // Create bottom section for timestamp and actions
    const bottomSection = document.createElement('div');
    bottomSection.className = 'catalog-card-bottom';

    // Timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'catalog-timestamp';
    timestamp.textContent = formatTime(entry.timestamp);
    timestamp.style.width = "50px";

    // Edit button
    const editButton = document.createElement('button');
    editButton.className = 'catalog-edit-btn';
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.title = 'Edit Note';
    editButton.style.width = "50px";
    editButton.addEventListener('click', () => editVoiceNote(index));

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'catalog-delete-btn';
    deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
    deleteButton.title = 'Delete Note';
    deleteButton.style.width = "50px";
    deleteButton.addEventListener('click', () => deleteVoiceNote(index, card));

    // Add elements to bottom section
    bottomSection.appendChild(timestamp);
    bottomSection.appendChild(editButton);
    bottomSection.appendChild(deleteButton);

    // Add elements to card
    card.appendChild(notePreview);
    if (readMoreBtn) card.appendChild(readMoreBtn);
    card.appendChild(bottomSection);

    return card;
}

// Function to expand the note
async function expandVoiceNote(index) {
    const fullContent = (await getVoiceNotes())[index].noteContent;
    // const fullContent = JSON.parse(localStorage.getItem("voiceSavedNotes"))[index]
    //     .noteContent;
    document.getElementById(`voiceNoteContent-${index}`).innerHTML = fullContent;
    document.getElementById(`voiceReadMore-${index}`).style.display = "none";
}

async function editVoiceNote(index) {
    const fullContent = (await getVoiceNotes())[index].noteContent;
    // let fullContent = JSON.parse(localStorage.getItem("voiceSavedNotes"))[index]
    //     .noteContent;
    currVoiceNoteIndex = index;
    showVoiceNoteEditor(true);
    document.getElementById("voice__textEditorOutput").innerHTML = fullContent;
}

function showVoiceNoteEditor(isUpdate) {
    hideAllSubFrames();
    showFrame("voice-sub-frame-label");
    showFrame("voice__richTextEditor");
    showVoiceAnnotations()

    // document.getElementById("voiceAnnotationRectangle").style.display = "none";
    document.getElementById("voiceNoteboard").style.display = "none";
    document.getElementById("small-rectangles").style.display = "none";

    document.getElementById("voice__richTextEditor").style.display = "block";
    document.getElementById("voice__textEditorOutput").innerHTML = "";

    if (isUpdate) {
        document.getElementById("voice__updateNote").style.display = "";
        document.getElementById("voice__saveNote").style.display = "none";
    } else {
        document.getElementById("voice__saveNote").style.display = "";
        document.getElementById("voice__updateNote").style.display = "none";
    }

    document.getElementById("voice__voiceRecordBtn").style.display = "block";
    document.getElementById("voice-board-cancel").style.display = "block";

    let texteditorbuttons = document.getElementsByClassName(
        "voice__textEditortool--btn"
    );
    for (let btn of texteditorbuttons) {
        btn.style.display = "block";
    }
}

async function deleteVoiceNote(index) {
    let notes = await getVoiceNotes();
    // let notes = JSON.parse(localStorage.getItem("voiceSavedNotes"));
    if (!notes || index >= notes.length) return; // If no notes or index out of range, exit function

    // Remove the note at the specified index
    notes.splice(index, 1);
    // Update the local storage with the new notes array
    // localStorage.setItem("voiceSavedNotes", JSON.stringify(notes));
    callSetItem(`voiceLogs/${currentVoiceLog}/voiceSavedNotes`, JSON.stringify(notes));
    // Update the display of notes
    updateVoiceNoteboard();
}


const notesData = await getVoiceNotes();
const notes = Array.isArray(notesData) ? notesData : [];
// const notes = JSON.parse(localStorage.getItem("voiceSavedNotes")) || [];
const noteboard = document.getElementById("voiceNoteboard");
noteboard.innerHTML = ""; // Clear existing notes

notes.forEach((entry, index) => {
    const noteDiv = createVoiceNoteElement(entry, index);
    noteboard.appendChild(noteDiv);
});

document.querySelectorAll('.voice__textEditortool--btn').forEach(button => {
    button.addEventListener('click', () => {
        const command = button.getAttribute('data-command');
        if (command == "createlink") {
            const url = prompt('Enter the URL:', 'http://');
            if (url) {
                document.execCommand('createLink', false, url);
            }
        }
        else
            document.execCommand(command, false, null);
    });
});

// voice__
// document.getElementById("voice__back").addEventListener("click", () => {
//     // Call to update the noteboard
//     showVoiceAnnotations();
// });
document.getElementById("voice__saveNote").addEventListener("click", async () => {
    const noteContent = document.getElementById("voice__textEditorOutput").innerHTML; // Get the content from the rich text editor

    // Save the note to local storage
    let notes = await getVoiceNotes();
    const currentTime = wavesurfer.getCurrentTime();
    // Save both note content and selected text
    notes.push({
        noteContent,
        selectedText: SELECTED_TEXT,
        timestamp: currentTime,
    });
    // localStorage.setItem("voiceSavedNotes", JSON.stringify(notes));
    callSetItem(`voiceLogs/${currentVoiceLog}/voiceSavedNotes`, JSON.stringify(notes));

    // Call to update the noteboard
    showVoiceAnnotations();
    document.getElementById('voiceAnnotationRectangle').style.display = 'block';
});


document.getElementById("voice__updateNote").addEventListener("click", async () => {
    if (currVoiceNoteIndex > -1) {
        const noteContent = document.getElementById(
            "voice__textEditorOutput"
        ).innerHTML; // Get the content from the rich text editor

        // Save the note to local storage
        let notes = await getVoiceNotes();
        // let notes = JSON.parse(localStorage.getItem("voiceSavedNotes"));
        notes[currVoiceNoteIndex].noteContent = noteContent;

        // Save both note content and selected text
        // localStorage.setItem("voiceSavedNotes", JSON.stringify(notes));
        callSetItem(`voiceLogs/${currentVoiceLog}/voiceSavedNotes`, JSON.stringify(notes));

        // Call to update the noteboard
        showVoiceAnnotations();
        document.getElementById('voiceAnnotationRectangle').style.display = 'block';
    }
});

document.getElementById("voice__voiceRecordBtn").addEventListener("click", () => {
    speechToText("voice");
});
document.getElementById("btnAudioUpload").addEventListener("click", () => {
    let audioInput = document.getElementById("audioInput");
    // audioInput.files = null;
    audioInput.click();
});
document.getElementById("btnAddNote").addEventListener("click", () => {
    showVoiceNoteEditor(false);
});




// TOOLBAR
// Voice TEXT COLOUR
document.getElementById("voice__colorPickerButton").addEventListener("click", function () {
    document.getElementById("voice__textColor").click(); // Simulate click on hidden color input
});
document.getElementById("voice__textColor").addEventListener("change", function () {
    document.execCommand("foreColor", false, this.value); // Change text color
    document.querySelector("#colorPickerButton .fa-palette").style.color =
        this.value; // Change icon color
});

// Voice FONT
document.getElementById("voice__fontSizeSelector").addEventListener("change", function () {
    document.execCommand("fontSize", false, this.value);
});
document.getElementById("voice__fontFamilySelector").addEventListener("change", function () {
    document.execCommand("fontName", false, this.value);
});

// // HIGHLIGHTER
let highlightActive = false; // State to track if highlight mode is active
let selectedColor = ""; // Store the selected color for toggling

// Toggle highlight mode on click of the highlighter button
document.getElementById("voice__highlighterButton").addEventListener("click", function () {
    // highlightActive = !highlightActive; // Toggle the highlight mode
    // this.classList.toggle("active", highlightActive); // Visually indicate if highlight mode is active

    // if (highlightActive) {
    document.getElementById("voice__highlightColor").click(); // Open color picker if mode is activated
    // } else {
    //     removeHighlights(); // Disable highlighting by removing all highlights
    // }
});

// Listen for color changes to apply or remove highlighting
document.getElementById("voice__highlightColor").addEventListener("change", function () {
    console.log(this.value);
    document.execCommand("backColor", false, this.value); // Change text color
    // selectedColor = this.value; // Update the current color
    // document.querySelector("#highlighterButton .fa-highlighter").style.color =
    //     selectedColor; // Change the icon color
    // applyOrRemoveHighlights(); // Apply or remove highlights based on the active state
});

document.getElementById("voice__highlighterButton").addEventListener("change", function () {
    if (!highlightActive) {
        this.style.color = "black"; // Revert the icon color when not active
    }
});


// utils
function formatTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${pad(minutes)}:${pad(seconds)}`;
}
function pad(number) {
    return number < 10 ? "0" + number : number;
}


// wavesurfer code
var wavesurfer = null;

/** NEW VERSION **/
wavesurfer = WaveSurfer.create({
    container: "#audiowave",
    waveColor: "#D3D3D3",
    progressColor: "#1e594f",
    height: 150,
    responsive: true,
    hideScrollbar: false,
    cursorColor: "#5df9de",
    cursorWidth: 2,
    barWidth: 1,
    barGap: 1.5,
    skipLength: 5,
});

// Load the file
// document
//     .getElementById("audioInput")
//     .addEventListener("change", function (event) {
//         const file = event.target.files[0];
//         if (file) {
//             const audioURL = URL.createObjectURL(file);
//             wavesurfer.load(audioURL).then(() => {
//                 // Load time
//                 const currentTime = wavesurfer.getCurrentTime();
//                 const totalDuration = wavesurfer.getDuration();
//                 const displayTime =
//                     formatTime(currentTime) + "/" + formatTime(totalDuration);
//                 document.getElementById("timeDisplay").textContent = displayTime;
//             });
//         }
//     });

// Event listener for updating time display
wavesurfer.on("audioprocess", function () {
    const currentTime = wavesurfer.getCurrentTime();
    const totalDuration = wavesurfer.getDuration();
    const displayTime =
        formatTime(currentTime) + "/" + formatTime(totalDuration);
    document.getElementById("timeDisplay").textContent = displayTime;
});

wavesurfer.on("seek", function () {
    const currentTime = wavesurfer.getCurrentTime();
    const totalDuration = wavesurfer.getDuration();
    const displayTime =
        formatTime(currentTime) + "/" + formatTime(totalDuration);
    document.getElementById("timeDisplay").textContent = displayTime;
});


function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

document.getElementById("audioInput").addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
        // document.getElementById("voiceAnnotationRectangle").style.display = "block";
        // document.getElementById("audio-control").style.display = "flex";

        // const audioURL = URL.createObjectURL(file);
        // wavesurfer.load(audioURL);
        // Show annotation rectangle, audiowave, audio controls, hide info
        // document.getElementById('audiowave').style.display = 'block';

        var reader = new FileReader();
        reader.onload = async function (e) {
            var voiceData = {
                id: Date.now(),
                data: e.target.result, // This is the Data URL
                name: file.name // Add the filename
            };
            await callSetItem(`voiceLogs/${voiceData.id}`, voiceData);
            //Simulate clicking to this menu again
            document.getElementById("VoiceAnnotation").click();
            // const blob = dataURLtoBlob(voiceData.data);
            // const blobUrl = URL.createObjectURL(blob);
            // wavesurfer.load(blobUrl);
        };
        reader.readAsDataURL(file);
    }
    event.target.value = "";
});

// Audio buttons
$("#btnPause").on("click", function () {
    wavesurfer.playPause();
});

$("#btnPlay").on("click", function () {
    wavesurfer.playPause();
});

$("#btnBack").on("click", function () {
    wavesurfer.skip(-10);
});

$("#btnForward").on("click", function () {
    wavesurfer.skip(10);
});

var oldVolume = 0;

var volumeButton = document.getElementById("btnVolume");
$("#btnVolume").on("click", function () {
    if (wavesurfer.getVolume() === 0) {
        wavesurfer.setVolume(1);
        volumeButton.children[0].classList.remove("fa-volume-off");
        volumeButton.children[0].classList.add("fa-volume-up");
    } else {
        wavesurfer.setVolume(0);
        volumeButton.children[0].classList.remove("fa-volume-up");
        volumeButton.children[0].classList.add("fa-volume-off");
    }
});

$(".btn-stop").on("click", function () {
    wavesurfer.stop();
});
/** END OF NEW VERSION **/

