console.log('content.js loaded and executed');

function captureFullPage() {
  console.log('captureFullPage function called');
  return new Promise((resolve, reject) => {
    const fullHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );

    console.log('Full height:', fullHeight);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewportWidth;
    canvas.height = fullHeight;

    let capturedHeight = 0;
    const maxRetries = 3;

    function captureScrolledPage(scrollTop = 0, retryCount = 0) {
      console.log('Capturing at scroll position:', scrollTop);
      window.scrollTo(0, scrollTop);

      setTimeout(() => {
        console.log('Sending capture message to background script');
        chrome.runtime.sendMessage({action: "capture"}, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error:', chrome.runtime.lastError);
            if (retryCount < maxRetries) {
              console.log(`Retrying capture (${retryCount + 1}/${maxRetries})...`);
              setTimeout(() => captureScrolledPage(scrollTop, retryCount + 1), 1000);
            } else {
              reject(chrome.runtime.lastError);
            }
            return;
          }
          console.log('Received capture response from background script');
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, scrollTop);
            capturedHeight += viewportHeight;
            const progress = Math.min((capturedHeight / fullHeight) * 100, 100);
            chrome.runtime.sendMessage({
              action: "updateProgress",
              progress: progress,
              status: `Captured ${Math.round(capturedHeight)}px of ${fullHeight}px`
            });
            if (scrollTop + viewportHeight < fullHeight) {
              captureScrolledPage(scrollTop + viewportHeight);
            } else {
              console.log('Capture complete, resolving promise with data URL length:', canvas.toDataURL().length);
              resolve(canvas.toDataURL());
            }
          };
          img.onerror = (error) => {
            console.error('Error loading image:', error);
            if (retryCount < maxRetries) {
              console.log(`Retrying capture (${retryCount + 1}/${maxRetries})...`);
              setTimeout(() => captureScrolledPage(scrollTop, retryCount + 1), 1000);
            } else {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, scrollTop, canvas.width, viewportHeight);
              capturedHeight += viewportHeight;
              const progress = Math.min((capturedHeight / fullHeight) * 100, 100);
              chrome.runtime.sendMessage({
                action: "updateProgress",
                progress: progress,
                status: `Captured ${Math.round(capturedHeight)}px of ${fullHeight}px (with errors)`
              });
              if (scrollTop + viewportHeight < fullHeight) {
                captureScrolledPage(scrollTop + viewportHeight);
              } else {
                console.log('Capture complete (with errors), resolving promise with data URL length:', canvas.toDataURL().length);
                resolve(canvas.toDataURL());
              }
            }
          };
          img.src = response.dataUrl;
        });
      }, 500);
    }

    captureScrolledPage();
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content script:', request);
  if (request.action === "check") {
    sendResponse({status: "loaded"});
    return false;
  } else if (request.action === "captureFullPage") {
    console.log('Capturing full page');
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Capture timed out')), 300000); // 5 minutes timeout
    });

    Promise.race([captureFullPage(), timeoutPromise])
      .then((dataUrl) => {
        console.log('Full page captured, sending response with data URL length:', dataUrl.length);
        sendResponse({dataUrl: dataUrl});
      })
      .catch((error) => {
        console.error('Error capturing full page:', error);
        sendResponse({error: error.message});
      });

    return true; // Indicates that the response is sent asynchronously
  }
});