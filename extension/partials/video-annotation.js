
import { SELECTED_TEXT, callSetItem, callGetItem } from '../frames.js'
import { hideFrame, customFrameMenu, showFrame, showFrameLabel, showFrameAndDisplay, hideAllSubFrames} from './utils.js';

var currVideoNoteIndex;

const videoMain = ["VideoAnnotation", "video-board-cancel"];
videoMain.forEach(id => {
    document.getElementById(id).addEventListener("click", () => {
        console.log(`videoMain ID = ${id}`);
        // hideAllSubFrames();
        // showFrame("video-sub-frame-label");
        // showFrame("video-sub-frame-2");
        // showFrame("video-sub-frame-3");
        showVideoAnnotations();

    });
});

function showVideoAnnotations() {
    console.log(`-- showVideoAnnotations() --`);
    hideAllSubFrames();
    showFrame("video-sub-frame-label");
    showFrame("video-sub-frame-2");
    showFrame("video-sub-frame-3");

    // document.getElementById("videoPopup").style.display = "block"; // Show video player
    // document.getElementById("video").style.display = "block"; // Show video player
    // document.getElementById("btnVideoUpload").style.display = "block";
    // document.getElementById("btnVideoAddNote").style.display = "block";
    // document.getElementById("video-buttons").style.display = "";
    // document.getElementById("videoNoteboard").style.display = "block";
    //
    // document.getElementById("video__richTextEditor").style.display = "none";
    // document.getElementById("video__saveNote").style.display = "none";
    // document.getElementById("video__voiceRecordBtn").style.display = "none";
    // document.getElementById("video__back").style.display = "none";

    updateVideoNoteboard();
}

document.getElementById("videoUploader").addEventListener("change", function (event) {

        const file = event.target.files[0];
        console.log(`file = ${JSON.stringify(file)}`);

        if (file) {
            console.log(`file = ${file}`);
            const url = URL.createObjectURL(file);
            document.getElementById("video").src = url;
        }

        event.target.value = '';
});

async function updateVideoNoteboard() {
    console.log(`-- updateVideoNoteboard() --`);

    const notes = JSON.parse(await callGetItem("videoSavedNotes")) || [];
    // const notes = JSON.parse(localStorage.getItem("videoSavedNotes")) || [];
    const noteboard = document.getElementById("videoNoteboard");
    noteboard.innerHTML = ""; // Clear existing notes

    notes.forEach((entry, index) => {
        const noteDiv = createVideoNoteElement(entry, index);
        noteboard.appendChild(noteDiv);
    });
}

// Function to truncate text
function truncateText(text, length) {
    if (text.length <= length) {
        return text;
    }
    return text.slice(0, length) + "...";
}

function createVideoNoteElement(entry, index) {
    const noteDiv = document.createElement("div");
    noteDiv.classList.add("note"); // Add 'note' class for styling

    // Display truncated content with "Read More" button
    noteDiv.innerHTML = entry.noteContent;
    var nContent = noteDiv.innerText;
    const truncatedContent =
        nContent.length > 230 ? truncateText(nContent, 230) : entry.noteContent;

    noteDiv.innerHTML = `
    <strong>Selected Text:</strong> ${entry.selectedText}<br>
	<strong>Video Stamp:</strong> ${formatTime(entry.timestamp)}<br>
    <strong>Note:</strong> <span id="videoNoteContent-${index}">${truncatedContent}</span>
	<div style="margin-top:25px">
    ${
        nContent.length > 230
            ? `<button id="videoReadMore-${index}" class="note-panel-button">Read More</button>`
            : ""
    }
	<button id="videoEditNote-${index}" class="note-panel-button">Edit Note</button>
    <button id="videoDeleteNote-${index}" class="note-panel-button">Delete</button>
  `;
    if (nContent.length > 230) {
        noteDiv
            .querySelector(`#videoReadMore-${index}`)
            .addEventListener("click", () => {
                expandVideoNote(index);
            });
    }
    noteDiv
        .querySelector(`#videoEditNote-${index}`)
        .addEventListener("click", () => {
            editVideoNote(index);
        });
    noteDiv
        .querySelector(`#videoDeleteNote-${index}`)
        .addEventListener("click", () => {
            deleteVideoNote(index); // Pass the index to the delete function
        });

    return noteDiv;
}

// keys
const videoSavedNotesKey = "videoSavedNotes";

async function expandVideoNote(index) {
    const fullContent = JSON.parse(await callGetItem("videoSavedNotes"))[index]
        .noteContent;
    // const fullContent = JSON.parse(localStorage.getItem("videoSavedNotes"))[index]
    //     .noteContent;
    document.getElementById(`videoNoteContent-${index}`).innerHTML = fullContent;
    document.getElementById(`videoReadMore-${index}`).style.display = "none";
}

async function editVideoNote(index) {
    const fullContent = JSON.parse(await callGetItem("videoSavedNotes"))[index]
        .noteContent;
    // let fullContent = JSON.parse(localStorage.getItem("videoSavedNotes"))[index]
    //     .noteContent;
    document.getElementById("video__textEditorOutput").innerHTML = fullContent;
    currVideoNoteIndex = index;
    showVideoNoteEditor(true);
}

function showVideoNoteEditor(isUpdate) {
    console.log(`-- showVideoNoteEditor(isUpdate = ${isUpdate}) --`);
    hideAllSubFrames();
    showFrame("video-sub-frame-label");
    showFrame("video__richTextEditor");

    // document.getElementById("video").style.display = "none";
    // document.getElementById("video-buttons").style.display = "none";
    // document.getElementById("videoNoteboard").style.display = "none";

    // document.getElementById("videoPopup").style.display = "block";
    // document.getElementById("video__richTextEditor").style.display = "block";
    document.getElementById("video__textEditorOutput").innerHTML = "";

    if (isUpdate) {
        document.getElementById("video__updateNote").style.display = "";
        document.getElementById("video__saveNote").style.display = "none";
    } else {
        document.getElementById("video__saveNote").style.display = "";
        document.getElementById("video__updateNote").style.display = "none";
    }

    // document.getElementById("video-board-cancel").style.display = "block";
    // document.getElementById("video__voiceRecordBtn").style.display = "block";
    // document.getElementById("video__back").style.display = "block";

    let texteditorbuttons = document.getElementsByClassName(
        "video__textEditortool--btn"
    );
    for (let btn of texteditorbuttons) {
        btn.style.display = "block";
    }
}

async function deleteVideoNote(index) {

    let notes = JSON.parse(await callGetItem("videoSavedNotes"));
    // let notes = JSON.parse(localStorage.getItem("videoSavedNotes"));
    if (!notes || index >= notes.length) return; // If no notes or index out of range, exit function

    // Remove the note at the specified index
    notes.splice(index, 1);
    // Update the local storage with the new notes array
    // localStorage.setItem("videoSavedNotes", JSON.stringify(notes));
    callSetItem("videoSavedNotes", JSON.stringify(notes));
    // Update the display of notes
    updateVideoNoteboard();
}


// document.getElementById("video__back").addEventListener("click", () => {
//     // Call to update the noteboard
//     showVideoAnnotations();
// });
document.getElementById("video__saveNote").addEventListener("click", async () => {
    const noteContent = document.getElementById("video__textEditorOutput").innerHTML; // Get the content from the rich text editor

    // Save the note to local storage

    // await callGetItem(key)
    let notes = await callGetItem("videoSavedNotes");
    // let notes = localStorage.getItem("videoSavedNotes");
    if (notes) {
        notes = JSON.parse(notes);
    } else {
        notes = [];
    }

    const currentTime = document.getElementById("video").currentTime;
    // Save both note content and selected text
    notes.push({
        noteContent,
        selectedText: SELECTED_TEXT,
        timestamp: currentTime,
    });
    // localStorage.setItem("videoSavedNotes", JSON.stringify(notes));
    callSetItem("videoSavedNotes", JSON.stringify(notes));

    // Call to update the noteboard
    showVideoAnnotations();
});
document.getElementById("video__updateNote").addEventListener("click", async () => {
    console.log(`currVideoNoteIndex = ${currVideoNoteIndex}`);

    if (currVideoNoteIndex > -1) {
        const noteContent = document.getElementById(
            "video__textEditorOutput"
        ).innerHTML; // Get the content from the rich text editor

        // Save the note to local storage
        let notes = JSON.parse(await callGetItem("videoSavedNotes"));
        // let notes = JSON.parse(localStorage.getItem("videoSavedNotes"));
        notes[currVideoNoteIndex].noteContent = noteContent;

        // Save both note content and selected text
        // localStorage.setItem("videoSavedNotes", JSON.stringify(notes));
        callSetItem("videoSavedNotes", JSON.stringify(notes));
    }
    // Call to update the noteboard
    showVideoAnnotations();
});

document.getElementById("video__voiceRecordBtn").addEventListener("click", () => {
        speechToText("video");
    });
document.getElementById("btnVideoUpload").addEventListener("click", () => {
    console.log(`btnVideoUpload`);
    document.getElementById("videoUploader").click();
});
document.getElementById("videoUploader").style.display = "none"; // Show upload button


document.getElementById("btnVideoAddNote").addEventListener("click", () => {
    showVideoNoteEditor(false);
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

const speechToText = (target) => {
    console.log(`Debug VOICE-TO-TEXT here`);
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
