console.log('Background script loaded');

chrome.runtime.onInstalled.addListener(function() {
  console.log('Extension installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in background script:', request.action);
  if (request.action === "capture") {
    console.log('Capturing visible tab');
    chrome.tabs.captureVisibleTab(null, {format: "png"}, (dataUrl) => {
      console.log('Tab captured, sending response');
      sendResponse({dataUrl: dataUrl});
    });
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === "download") {
    console.log('Downloading image, data URL length:', request.dataUrl.length);
    chrome.downloads.download({
      url: request.dataUrl,
      filename: "full_page_screenshot.png",
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download error:', chrome.runtime.lastError);
        sendResponse({success: false, error: chrome.runtime.lastError.message});
      } else {
        console.log('Download started with id:', downloadId);
        sendResponse({success: true, downloadId: downloadId});
      }
    });
    return true; // Indicates that the response is sent asynchronously
  }
});