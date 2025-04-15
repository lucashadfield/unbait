// Store the clicked position
let lastClickPosition = { x: 0, y: 0 };
// Use a Map to track multiple popups by URL
let activePopups = new Map();
// Track canceled requests
let canceledRequests = new Set();

// Listen for clicks to store position
document.addEventListener('mousedown', function(event) {
  if (event.button === 2) { // Right click
    lastClickPosition = { x: event.clientX, y: event.clientY };
  }
});

// Listen for clicks anywhere on the document to close result popups
document.addEventListener('click', function(event) {
  // Handle clicks to close popups
  let clickedInsidePopup = false;
  
  activePopups.forEach((popup, url) => {
    const isLoadingPopup = popup.classList.contains('loading-popup');
    
    // Check if clicked inside this popup
    if (popup.contains(event.target)) {
      clickedInsidePopup = true;
      
      // If it's a close button, remove the popup and cancel the request
      if (event.target.classList.contains('close-button')) {
        // Add URL to canceled requests
        canceledRequests.add(url);
        
        // Remove the popup
        popup.remove();
        activePopups.delete(url);
      }
    } else if (!isLoadingPopup) {
      // For result popups: if clicked outside, close them
      // Loading popups should only close with the close button
      popup.remove();
      activePopups.delete(url);
    }
  });
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, data } = message;
  
  // Check if this request was canceled
  if (canceledRequests.has(data.url)) {
    // If it's a result or error for a canceled request, ignore it
    if (action === 'showResult' || action === 'showError') {
      canceledRequests.delete(data.url); // Clean up
      sendResponse({ status: "canceled" });
      return true;
    }
  }
  
  switch (action) {
    case 'showLoading':
      showPopup('loading', data.url);
      break;
    case 'showResult':
      showPopup('result', data.url, data.result);
      break;
    case 'showError':
      showPopup('error', data.url, data.error);
      break;
  }
  
  // Always send a response to prevent "message channel closed" errors
  sendResponse({ status: "success" });
  return true;
});

// Format bold text in the content
function formatBoldText(text) {
  // Escape HTML characters first to prevent XSS attacks
  const escapedText = escapeHTML(text);
  
  // Replace **text** with <strong>text</strong>
  return escapedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

// Escape HTML to prevent XSS
function escapeHTML(text) {
  const element = document.createElement('div');
  element.textContent = text;
  return element.innerHTML;
}

// Create and show the popup
function showPopup(type, url, content = '') {
  let popup, contentElement;
  
  // Check if popup for this URL already exists
  if (activePopups.has(url)) {
    // Update existing popup
    popup = activePopups.get(url);
    
    // Remove loading class if this is a result or error
    if (type === 'result' || type === 'error') {
      popup.classList.remove('loading-popup');
      
      // Remove close button if exists
      const closeButtonContainer = popup.querySelector('.close-button-container');
      if (closeButtonContainer) {
        closeButtonContainer.remove();
      }
    }
    
    contentElement = popup.querySelector('.unbait-content');
    
    // Clear existing content
    contentElement.innerHTML = '';
  } else {
    // Create new popup
    popup = document.createElement('div');
    popup.className = 'unbait-popup';
    popup.dataset.url = url;
    
    // Add loading class for loading popups
    if (type === 'loading') {
      popup.classList.add('loading-popup');
    }
    
    // Position the popup at the right-click position
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    popup.style.position = 'absolute';
    popup.style.left = `${lastClickPosition.x + scrollX}px`;
    popup.style.top = `${lastClickPosition.y + scrollY}px`;
    
    // Create content element
    contentElement = document.createElement('div');
    contentElement.className = 'unbait-content';
    popup.appendChild(contentElement);
    
    // Add the popup to the page
    document.body.appendChild(popup);
    
    // Store the popup in our map
    activePopups.set(url, popup);
    
    // Adjust position if popup would go off-screen
    const rect = popup.getBoundingClientRect();
    
    if (rect.right > window.innerWidth + scrollX) {
      popup.style.left = `${window.innerWidth + scrollX - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight + scrollY) {
      popup.style.top = `${window.innerHeight + scrollY - rect.height - 10}px`;
    }
  }
  
  // Update content based on type
  if (type === 'loading') {
    // Create spinner container
    const spinnerContainer = document.createElement('div');
    spinnerContainer.className = 'unbait-spinner';
    
    // Add SVG spinner
    spinnerContainer.innerHTML = `
      <svg class="spinner-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <style>
          .spinner {
            transform-origin: center;
            animation: rotate 1.8s linear infinite;
          }
          
          .arc {
            fill: none;
            stroke: #0a2440;
            stroke-width: 15%;
            stroke-linecap: round;
          }
          
          .dot {
            fill: #e01d2e;
          }
          
          @keyframes rotate {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        </style>
        
        <g class="spinner">
          <!-- Blue Arc -->
          <circle class="arc" cx="50%" cy="50%" r="30%" stroke-dasharray="130 190" />
          
          <!-- Red Dot -->
          <circle class="dot" cx="50%" cy="12.5%" r="9%" transform="rotate(10, 50, 50)" />
        </g>
      </svg>
    `;
    
    contentElement.appendChild(spinnerContainer);
    
    // Create a container for the text and close button
    const textContainer = document.createElement('span');
    textContainer.className = 'close-button-container';
    
    // Add text
    textContainer.appendChild(document.createTextNode('UnBaiting link...'));
    
    // Add close button inline
    const closeButton = document.createElement('span');
    closeButton.className = 'close-button';
    closeButton.innerHTML = '&times;';
    textContainer.appendChild(closeButton);
    
    contentElement.appendChild(textContainer);
  } else if (type === 'result') {
    // Process markdown-style bold text (**text**)
    // Create a new div for formatted content to avoid flex layout issues
    const resultContainer = document.createElement('div');
    resultContainer.className = 'result-content';
    const formattedContent = formatBoldText(content);
    resultContainer.innerHTML = formattedContent;
    contentElement.appendChild(resultContainer);
  } else if (type === 'error') {
    contentElement.textContent = `Error: ${content}`;
    contentElement.className += ' unbait-error';
  }
}