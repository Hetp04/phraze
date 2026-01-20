document.addEventListener('DOMContentLoaded', async () => {
    // Get the last screenshot from storage
    const { lastScreenshot } = await chrome.storage.local.get('lastScreenshot');
    
    if (lastScreenshot) {
        // Display the screenshot
        document.getElementById('screenshot-preview').src = lastScreenshot.data;
        
        // Save button handler
        document.getElementById('save-screenshot').addEventListener('click', () => {
            // Create a download link
            const link = document.createElement('a');
            link.download = `screenshot-${new Date().toISOString()}.png`;
            link.href = lastScreenshot.data;
            link.click();
        });
        
        // Discard button handler
        document.getElementById('discard-screenshot').addEventListener('click', () => {
            // Clear the screenshot from storage
            chrome.storage.local.remove('lastScreenshot', () => {
                window.close();
            });
        });
    }
}); 