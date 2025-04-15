// DOM elements
const providerSelect = document.getElementById('provider');
const modelInput = document.getElementById('model');
const apiKeyInput = document.getElementById('api-key');
const systemPromptTextarea = document.getElementById('system-prompt');
const saveButton = document.getElementById('save-button');
const resetPromptButton = document.getElementById('reset-prompt-button');
const successMessage = document.getElementById('success-message');

let DEFAULT_SYSTEM_PROMPT = '';

// Load default system prompt from file
fetch('default_prompt.txt')
  .then(response => response.text())
  .then(text => {
    DEFAULT_SYSTEM_PROMPT = text;
    loadSettings();
  })
  .catch(error => {
    console.error('Error loading default prompt:', error);
    DEFAULT_SYSTEM_PROMPT = 'This page has a clickbait title. You have been provided the content of the page in order to succinctly answer the clickbait title. Provide an answer that is at most one sentence long.';
    loadSettings();
  });

// Load saved settings
function loadSettings() {
  chrome.storage.sync.get({
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: '',
    systemPrompt: DEFAULT_SYSTEM_PROMPT
  }, (items) => {
    providerSelect.value = items.provider;
    modelInput.value = items.model;
    apiKeyInput.value = items.apiKey;
    systemPromptTextarea.value = items.systemPrompt;
    
    // Set placeholder based on provider
    updateModelPlaceholder();
  });
}

// Save settings
function saveSettings() {
  chrome.storage.sync.set({
    provider: providerSelect.value,
    model: modelInput.value,
    apiKey: apiKeyInput.value,
    systemPrompt: systemPromptTextarea.value || DEFAULT_SYSTEM_PROMPT
  }, () => {
    showSuccessMessage();
  });
}

// Reset system prompt to default
function resetSystemPrompt() {
  systemPromptTextarea.value = DEFAULT_SYSTEM_PROMPT;
  // Show a brief success message
  successMessage.textContent = 'System prompt reset to default!';
  showSuccessMessage();
}

// Update model placeholder based on selected provider
function updateModelPlaceholder() {
  if (providerSelect.value === 'openai') {
    modelInput.placeholder = 'Enter model ID (e.g., gpt-4o-mini)';
  } else {
    modelInput.placeholder = 'Enter model ID (e.g., claude-3-5-haiku-20241022)';
  }
}

// Show success message for a few seconds
function showSuccessMessage() {
  successMessage.style.display = 'block';
  setTimeout(() => {
    successMessage.style.display = 'none';
    // Reset success message text to default after hiding
    successMessage.textContent = 'Settings saved successfully!';
  }, 3000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // We'll load settings once the default prompt is loaded
  
  // Set up other event listeners
  providerSelect.addEventListener('change', updateModelPlaceholder);
  saveButton.addEventListener('click', saveSettings);
  resetPromptButton.addEventListener('click', resetSystemPrompt);
  
  // Restore default system prompt if it's empty
  systemPromptTextarea.addEventListener('blur', () => {
    if (!systemPromptTextarea.value.trim()) {
      systemPromptTextarea.value = DEFAULT_SYSTEM_PROMPT;
    }
  });
});