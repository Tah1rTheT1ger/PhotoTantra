// Function to convert Base64 to a Blob for downloading
function base64ToBlob(base64, contentType = 'application/octet-stream') {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
}

// This script listens for download requests from the popup and handles them.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Check if the message is a download request
    if (message.action === 'download' || message.action === 'downloadZip') {
        const { base64, filename } = message.payload;
        
        // Determine the correct header for the data URL
        const contentType = message.action === 'downloadZip' ? 'application/zip' : 'image/jpeg';
        const dataUrl = `data:${contentType};base64,${base64}`;

        // Use the chrome.downloads API to trigger the download
        chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: true // This will prompt the user where to save the file
        });
        
        // Return true to indicate that this is an asynchronous operation.
        return true;
    }
});