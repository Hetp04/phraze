async function captureFullPage(tab) {
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
    });

    const { totalHeight, viewportHeight } = await chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" });

    const screenshots = [];
    for (let y = 0; y < totalHeight; y += viewportHeight) {
        await chrome.tabs.sendMessage(tab.id, { action: "scrollTo", y });
        await new Promise(r => setTimeout(r, 500)); // wait for scroll
        const dataUrl = await new Promise(resolve => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, resolve);
        });
        screenshots.push({ y, dataUrl });
    }

    // Create stitched image
    const firstImg = await loadImage(screenshots[0].dataUrl);
    const canvas = new OffscreenCanvas(firstImg.width, totalHeight);
    const ctx = canvas.getContext("2d");

    for (const shot of screenshots) {
        const img = await loadImage(shot.dataUrl);
        ctx.drawImage(img, 0, shot.y);
    }

    const finalBlob = await canvas.convertToBlob();
    const url = URL.createObjectURL(finalBlob);

    // Download
    chrome.downloads.download({
        url,
        filename: "fullpage-screenshot.png"
    });
}

function loadImage(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = dataUrl;
    });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === "startCapture") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            captureFullPage(tabs[0]);
        });
    }
});

document.getElementById("ConversationLogging").addEventListener('click', function (e) {
    console.log("clicked");
    // captureFullPage()
});