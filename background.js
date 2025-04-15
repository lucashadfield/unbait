// Import Readability library
try {
    importScripts('lib/Readability.js');
  } catch (error) {
    console.error('Failed to load Readability.js:', error);
    // We'll handle this error in our extraction function
  }
  
  // Create context menu item when extension is installed
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'resolve-clickbait',
      title: 'UnBait this link',
      contexts: ['link']
    });
  });
  
  // Listen for context menu clicks
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'resolve-clickbait') {
      resolveClickbait(info.linkUrl, tab);
    }
  });
  
  // Main function to resolve clickbait
  async function resolveClickbait(url, sourceTab) {
    // Generate a unique request ID
    const requestId = url;
    
    try {
      // Check if the source tab still exists before sending messages
      const tabExists = await checkTabExists(sourceTab.id);
      if (!tabExists) {
        console.log('Source tab no longer exists, aborting request');
        return;
      }
      
      // Send a message to show loading state
      try {
        await sendTabMessage(sourceTab.id, {
          action: 'showLoading',
          data: { url: requestId }
        });
      } catch (error) {
        console.log('Failed to send loading message, tab may have been closed');
        return;
      }
  
      // Get extension settings
      const settings = await getSettings();
      
      // Open the link in a background tab
      let newTab;
      try {
        newTab = await chrome.tabs.create({ url, active: false });
      } catch (error) {
        console.error('Error creating tab:', error);
        sendTabMessageSafe(sourceTab.id, {
          action: 'showError',
          data: { url: requestId, error: 'Failed to open link in background tab' }
        });
        return;
      }
      
      // Wait for the tab to finish loading
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Tab loading timed out after 30 seconds'));
          }, 30000);
          
          chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === newTab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      } catch (error) {
        console.error('Error waiting for tab to load:', error);
        await sendTabMessageSafe(sourceTab.id, {
          action: 'showError',
          data: { url: requestId, error: 'Page took too long to load' }
        });
        try { await chrome.tabs.remove(newTab.id); } catch (e) {}
        return;
      }
      
      // Extract content using Readability
      let content;
      try {
        content = await extractContent(newTab.id);
      } catch (error) {
        console.error('Error extracting content:', error);
        await sendTabMessageSafe(sourceTab.id, {
          action: 'showError',
          data: { url: requestId, error: 'Failed to extract content from page' }
        });
        try { await chrome.tabs.remove(newTab.id); } catch (e) {}
        return;
      }
      
      // Close the background tab
      try {
        await chrome.tabs.remove(newTab.id);
      } catch (error) {
        console.error('Error closing tab:', error);
        // Continue anyway
      }
      
      // Get response from LLM API
      let response;
      try {
        response = await queryLLM(content, settings);
      } catch (error) {
        console.error('API error:', error);
        await sendTabMessageSafe(sourceTab.id, {
          action: 'showError',
          data: { url: requestId, error: error.message || 'API request failed' }
        });
        return;
      }
      
      // Check if the source tab still exists
      const sourceTabStillExists = await checkTabExists(sourceTab.id);
      if (!sourceTabStillExists) {
        console.log('Source tab closed during processing, abandoning result');
        return;
      }
      
      // Send the result to the original tab
      await sendTabMessageSafe(sourceTab.id, {
        action: 'showResult',
        data: { url: requestId, result: response }
      });
      
    } catch (error) {
      console.error('Error in resolveClickbait:', error);
      // Try to send error message to original tab if it still exists
      await sendTabMessageSafe(sourceTab.id, {
        action: 'showError',
        data: { url: requestId, error: error.message || 'Unknown error occurred' }
      });
    }
  }
  
  // Check if a tab exists
  async function checkTabExists(tabId) {
    try {
      await chrome.tabs.get(tabId);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // Safely send a message to a tab, handling potential errors
  async function sendTabMessageSafe(tabId, message) {
    try {
      if (await checkTabExists(tabId)) {
        await sendTabMessage(tabId, message);
      }
    } catch (error) {
      console.log(`Failed to send message to tab ${tabId}:`, error);
    }
  }
  
  // Send a message to a tab with proper promise handling
  function sendTabMessage(tabId, message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Extract content from page using Readability
  async function extractContent(tabId) {
    try {
      // Execute script in the tab to get document content
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          try {
            // Create a clone of the document
            const documentClone = document.cloneNode(true);
            
            // Use Readability to parse the content
            let article;
            try {
              article = new Readability(documentClone).parse();
            } catch (error) {
              // If Readability fails, fallback to a simple extraction
              return {
                title: document.title || "Unknown Title",
                content: document.body.innerText.substring(0, 50000) || "Failed to extract content",
                url: document.URL
              };
            }
            
            // Ensure article exists and has the required properties
            if (!article || !article.title || !article.textContent) {
              return {
                title: document.title || "Unknown Title",
                content: document.body.innerText.substring(0, 50000) || "Failed to extract content",
                url: document.URL
              };
            }
            
            return {
              title: article.title,
              content: article.textContent,
              url: document.URL
            };
          } catch (error) {
            // Last resort fallback
            return {
              title: document.title || "Unknown Title",
              content: "Failed to extract content: " + error.message,
              url: document.URL || "Unknown URL"
            };
          }
        }
      });
      
      if (!result || !result.result || !result.result.title) {
        return {
          title: "Unknown Title",
          content: "Failed to extract content from page",
          url: "Unknown URL"
        };
      }
      
      return result.result;
    } catch (error) {
      // Provide default values when extraction fails
      return {
        title: "Error",
        content: "Content extraction failed: " + error.message,
        url: "Unknown URL"
      };
    }
  }
  
  // Query the selected LLM API with the content
  async function queryLLM(content, settings) {
    try {
      const { provider, model, apiKey, systemPrompt } = settings;
      
      if (!apiKey) {
        throw new Error('API key not configured. Please add it in the extension settings.');
      }
      
      if (provider === 'openai') {
        return await queryOpenAI(content, model, apiKey, systemPrompt);
      } else if (provider === 'anthropic') {
        return await queryAnthropic(content, model, apiKey, systemPrompt);
      } else {
        throw new Error('Invalid API provider selected');
      }
    } catch (error) {
      throw new Error('API request failed: ' + error.message);
    }
  }
  
  // Query the OpenAI API
  async function queryOpenAI(content, model, apiKey, systemPrompt) {
    // Make sure we have valid content
    if (!content || !content.title || !content.content) {
      throw new Error('Failed to extract content from the page properly');
    }
  
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Title: ${content.title}\n\nContent: ${content.content}` }
        ],
        temperature: 0.3,
        max_tokens: 100
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Unknown error');
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  // Query the Anthropic API
  async function queryAnthropic(content, model, apiKey, systemPrompt) {
    // Make sure we have valid content
    if (!content || !content.title || !content.content) {
      throw new Error('Failed to extract content from the page properly');
    }
  
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-haiku-20240307',
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Title: ${content.title}\n\nContent: ${content.content}` }
        ],
        max_tokens: 100,
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Unknown error');
    }
    
    const data = await response.json();
    return data.content[0].text;
  }
  
  // Get extension settings from storage
  async function getSettings() {
    // First load the default prompt from file
    let defaultPrompt;
    try {
      const response = await fetch('default_prompt.txt');
      defaultPrompt = await response.text();
    } catch (error) {
      console.error('Error loading default prompt:', error);
      defaultPrompt = 'This page has a clickbait title. You have been provided the content of the page in order to succinctly answer the clickbait title. Provide an answer that is at most one sentence long.';
    }
    
    const defaultSettings = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: '',
      systemPrompt: defaultPrompt
    };
    
    try {
      const result = await chrome.storage.sync.get(defaultSettings);
      return result;
    } catch (error) {
      console.error('Error getting settings:', error);
      return defaultSettings;
    }
  }