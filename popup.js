(function() {
  console.log('popup.js loaded and executed');
})();

function injectContentScriptIfNeeded(tab, callback) {
  chrome.tabs.sendMessage(tab.id, {action: "check"}, function(response) {
    if (chrome.runtime.lastError) {
      chrome.tabs.executeScript(tab.id, {file: "content.js"}, function() {
        if (chrome.runtime.lastError) {
          console.error('Failed to inject content script:', chrome.runtime.lastError);
          callback(false);
        } else {
          console.log('Content script injected successfully');
          callback(true);
        }
      });
    } else {
      callback(true);
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup DOM fully loaded');
  var captureBtn = document.getElementById('captureBtn');
  var progressBar = document.getElementById('progressBar');
  var progressText = document.getElementById('progressText');
  var statusText = document.getElementById('statusText');

  if (captureBtn) {
    console.log('Capture button found');
    captureBtn.addEventListener('click', function() {
      console.log('Capture button clicked');
      progressBar.style.width = '0%';
      progressText.textContent = '0%';
      progressBar.parentElement.style.display = 'block';
      captureBtn.disabled = true;
      statusText.textContent = 'Preparing to capture...';

      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        injectContentScriptIfNeeded(tabs[0], function(injected) {
          if (!injected) {
            alert('Failed to inject content script. Please refresh the page and try again.');
            captureBtn.disabled = false;
            progressBar.parentElement.style.display = 'none';
            statusText.textContent = 'Error: Failed to inject content script';
            return;
          }
          console.log('Sending message to content script');
          statusText.textContent = 'Starting capture...';
          chrome.tabs.sendMessage(tabs[0].id, {action: "captureFullPage"}, function(response) {
            captureBtn.disabled = false;
            progressBar.parentElement.style.display = 'none';

            if (chrome.runtime.lastError) {
              console.error('Error:', chrome.runtime.lastError);
              alert('An error occurred: ' + chrome.runtime.lastError.message);
              statusText.textContent = 'Error: ' + chrome.runtime.lastError.message;
              return;
            }
            if (response && response.error) {
              console.error('Error from content script:', response.error);
              alert('An error occurred: ' + response.error);
              statusText.textContent = 'Error: ' + response.error;
              return;
            }
            console.log('Received response from content script:', response ? 'Data URL length: ' + response.dataUrl.length : 'No response');
            if (response && response.dataUrl) {
              console.log('Sending download message to background script');
              statusText.textContent = 'Preparing download...';
              chrome.runtime.sendMessage({
                action: "download",
                dataUrl: response.dataUrl
              }, function(downloadResponse) {
                console.log('Received download response:', downloadResponse);
                if (downloadResponse && downloadResponse.success) {
                  alert('Screenshot saved successfully!');
                  statusText.textContent = 'Screenshot saved successfully!';
                } else {
                  alert('Failed to save screenshot: ' + ((downloadResponse && downloadResponse.error) || 'Unknown error'));
                  statusText.textContent = 'Error: Failed to save screenshot';
                }
              });
            } else {
              console.error('No dataUrl in response');
              alert('Failed to capture screenshot: No image data received');
              statusText.textContent = 'Error: No image data received';
            }
          });
        });
      });
    });
  } else {
    console.error('Capture button not found');
  }

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "updateProgress") {
      progressBar.style.width = request.progress + '%';
      progressText.textContent = Math.round(request.progress) + '%';
      statusText.textContent = request.status || 'Capturing...';
    }
  });
});