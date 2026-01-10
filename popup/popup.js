// Popup JavaScript for X Reply Extension

document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
  setupEventListeners();
  loadSettings();
  loadTweetStatus();
  loadStyleProfileStatus();
  loadApiKeyStatus();
});

// Initialize popup interface
async function initializePopup() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isOnTwitter = tab?.url?.includes('twitter.com') || tab?.url?.includes('x.com');
    updateStatusIndicator(isOnTwitter);
  } catch (error) {
    console.log('Could not get active tab:', error);
    updateStatusIndicator(false);
  }
}

// Update status indicator
function updateStatusIndicator(isActive) {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');

  if (isActive) {
    statusDot.style.background = '#4ade80';
    statusText.textContent = 'Active on X';
  } else {
    statusDot.style.background = '#6b7280';
    statusText.textContent = 'Ready';
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Tab navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Settings
  document.getElementById('save-api-key').addEventListener('click', saveApiKey);
  document.getElementById('save-openrouter').addEventListener('click', saveOpenRouterKey);
  document.getElementById('delete-openai').addEventListener('click', deleteOpenAIKey);
  document.getElementById('delete-openrouter').addEventListener('click', deleteOpenRouterKey);

  // Upload
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const fileSelect = document.getElementById('file-select');

  fileSelect.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  uploadArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFileDrop(e);
  });

  document.getElementById('analyze-text').addEventListener('click', analyzeManualText);
  document.getElementById('upload-tweets-btn').addEventListener('click', uploadTweets);
  document.getElementById('delete-tweets-btn').addEventListener('click', deleteTweets);
  document.getElementById('generate-style-btn').addEventListener('click', generateStyleProfile);
}

// Switch between tabs
function switchTab(tabName) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
}

// Save OpenAI API key (for embeddings)
async function saveApiKey() {
  const apiKeyInput = document.getElementById('api-key');
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showNotification('Please enter an API key', 'error');
    return;
  }

  try {
    await chrome.storage.sync.set({ openaiApiKey: apiKey });
    showNotification('OpenAI API key saved', 'success');
    apiKeyInput.value = '';
    loadApiKeyStatus(); // Refresh status
  } catch (error) {
    showNotification('Failed to save API key', 'error');
  }
}

// Save OpenRouter API key (for Claude replies)
async function saveOpenRouterKey() {
  const apiKeyInput = document.getElementById('openrouter-key');
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showNotification('Please enter an API key', 'error');
    return;
  }

  try {
    await chrome.storage.sync.set({ openrouterApiKey: apiKey });
    showNotification('OpenRouter API key saved', 'success');
    apiKeyInput.value = '';
    loadApiKeyStatus(); // Refresh status
  } catch (error) {
    showNotification('Failed to save API key', 'error');
  }
}

// Delete OpenAI API key
async function deleteOpenAIKey() {
  try {
    await chrome.storage.sync.remove('openaiApiKey');
    showNotification('OpenAI API key deleted', 'success');
    document.getElementById('api-key').placeholder = 'sk-...';
    loadApiKeyStatus();
  } catch (error) {
    showNotification('Failed to delete API key', 'error');
  }
}

// Delete OpenRouter API key
async function deleteOpenRouterKey() {
  try {
    await chrome.storage.sync.remove('openrouterApiKey');
    showNotification('OpenRouter API key deleted', 'success');
    document.getElementById('openrouter-key').placeholder = 'sk-or-v1-...';
    loadApiKeyStatus();
  } catch (error) {
    showNotification('Failed to delete API key', 'error');
  }
}

// Load and display API key status
async function loadApiKeyStatus() {
  try {
    const result = await chrome.storage.sync.get(['openaiApiKey', 'openrouterApiKey']);
    const apiWarning = document.getElementById('api-warning');

    // OpenRouter status
    const openrouterStatus = document.getElementById('openrouter-status');
    const deleteOpenrouterBtn = document.getElementById('delete-openrouter');
    const hasOpenRouter = !!result.openrouterApiKey;

    if (hasOpenRouter) {
      const maskedKey = result.openrouterApiKey.substring(0, 12) + '...' + result.openrouterApiKey.slice(-4);
      openrouterStatus.innerHTML = `✓ Key set: <code>${maskedKey}</code>`;
      openrouterStatus.className = 'api-key-status set';
      deleteOpenrouterBtn.style.display = 'inline-block';
    } else {
      openrouterStatus.innerHTML = '✗ No key set';
      openrouterStatus.className = 'api-key-status not-set';
      deleteOpenrouterBtn.style.display = 'none';
    }

    // OpenAI status
    const openaiStatus = document.getElementById('openai-status');
    const deleteOpenaiBtn = document.getElementById('delete-openai');
    const hasOpenAI = !!result.openaiApiKey;

    if (hasOpenAI) {
      const maskedKey = result.openaiApiKey.substring(0, 8) + '...' + result.openaiApiKey.slice(-4);
      openaiStatus.innerHTML = `✓ Key set: <code>${maskedKey}</code>`;
      openaiStatus.className = 'api-key-status set';
      deleteOpenaiBtn.style.display = 'inline-block';
    } else {
      openaiStatus.innerHTML = '✗ No key set';
      openaiStatus.className = 'api-key-status not-set';
      deleteOpenaiBtn.style.display = 'none';
    }

    // Show warning if either key is missing
    if (!hasOpenRouter || !hasOpenAI) {
      apiWarning.style.display = 'block';
    } else {
      apiWarning.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to load API key status:', error);
  }
}

// Load saved settings
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['openaiApiKey', 'openrouterApiKey']);
    // Keys are stored but not displayed for security
    if (result.openaiApiKey) {
      document.getElementById('api-key').placeholder = 'Enter new key to replace';
    }
    if (result.openrouterApiKey) {
      document.getElementById('openrouter-key').placeholder = 'Enter new key to replace';
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Load tweet status from Supabase
async function loadTweetStatus() {
  const statusContainer = document.getElementById('tweet-status');
  const deleteBtn = document.getElementById('delete-tweets-btn');

  // Hide delete button during loading
  deleteBtn.style.display = 'none';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTweetCount' });

    if (response.success && response.data > 0) {
      statusContainer.innerHTML = `
        <div class="status-card success">
          <span class="status-icon">✓</span>
          <div>
            <strong>${response.data} tweets</strong> stored with embeddings
            <p style="font-size: 11px; color: #9ca3af; margin-top: 4px;">Ready for semantic search</p>
          </div>
        </div>
      `;
      deleteBtn.style.display = 'block';
    } else {
      statusContainer.innerHTML = `
        <div class="status-card empty">
          <span class="status-icon">○</span>
          <div>
            <strong>No tweets uploaded</strong>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 4px;">Upload your tweets to enable AI replies</p>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to load tweet status:', error);
    statusContainer.innerHTML = `
      <div class="status-card empty">
        <span class="status-icon">○</span>
        <div>
          <strong>No tweets uploaded</strong>
          <p style="font-size: 11px; color: #9ca3af; margin-top: 4px;">Upload your tweets to enable AI replies</p>
        </div>
      </div>
    `;
  }
}

// Handle file selection
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) processUploadedFile(file);
}

// Handle file drop
function handleFileDrop(event) {
  const files = event.dataTransfer.files;
  if (files.length > 0) processUploadedFile(files[0]);
}

// Process uploaded file
async function processUploadedFile(file) {
  const progressContainer = document.getElementById('upload-progress');
  const resultContainer = document.getElementById('upload-result');

  progressContainer.hidden = false;
  resultContainer.hidden = true;

  try {
    const text = await readFileAsText(file);
    let tweets = [];

    // Parse different file formats
    if (file.name.endsWith('.json')) {
      const data = JSON.parse(text);
      tweets = extractTweetsFromJSON(data);
    } else if (file.name.endsWith('.csv')) {
      tweets = parseCSV(text);
    } else {
      tweets = text.split('\n').filter(line => line.trim().length > 10);
    }

    if (tweets.length === 0) {
      throw new Error('No tweets found in file');
    }

    // Store the parsed tweets temporarily
    window.pendingTweets = tweets;

    // Display results
    displayUploadResults(tweets);

  } catch (error) {
    showNotification('Failed to process file: ' + error.message, 'error');
  } finally {
    progressContainer.hidden = true;
  }
}

// Extract tweets from various JSON formats
function extractTweetsFromJSON(data) {
  let tweets = [];

  // If it's an array
  if (Array.isArray(data)) {
    tweets = data.map(item => {
      if (typeof item === 'string') return item;
      // Twitter archive format
      if (item.tweet) return item.tweet.full_text || item.tweet.text;
      // Direct tweet object
      return item.full_text || item.text || item.content || JSON.stringify(item);
    });
  }
  // If it's an object with a tweets array
  else if (data.tweets) {
    tweets = extractTweetsFromJSON(data.tweets);
  }
  // If it's a single tweet
  else if (data.text || data.full_text) {
    tweets = [data.full_text || data.text];
  }

  // Filter out retweets, replies, and very short tweets
  return tweets.filter(tweet => {
    if (!tweet || typeof tweet !== 'string') return false;
    if (tweet.startsWith('RT @')) return false; // Skip retweets
    if (tweet.length < 10) return false; // Skip very short
    return true;
  });
}

// Parse CSV
function parseCSV(text) {
  const lines = text.split('\n');
  const tweets = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      // Handle quoted CSV
      const match = line.match(/"([^"]+)"/);
      const tweetText = match ? match[1] : line.split(',').pop();
      if (tweetText && tweetText.length > 10 && !tweetText.startsWith('RT @')) {
        tweets.push(tweetText);
      }
    }
  }

  return tweets;
}

// Read file as text
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Display upload results
function displayUploadResults(tweets) {
  const resultContainer = document.getElementById('upload-result');
  const summaryDiv = resultContainer.querySelector('.analysis-summary');

  // Show sample tweets
  const sampleTweets = tweets.slice(0, 5);

  summaryDiv.innerHTML = `
    <p><strong>Tweets found:</strong> ${tweets.length}</p>
    <div style="margin-top: 12px;">
      <strong>Sample tweets:</strong>
      ${sampleTweets.map(t => `<p style="font-size: 11px; color: #9ca3af; margin: 6px 0; padding: 8px; background: #0f0f16; border-radius: 4px; border-left: 2px solid #d4a574;">"${t.slice(0, 100)}${t.length > 100 ? '...' : ''}"</p>`).join('')}
    </div>
    <p style="margin-top: 12px; font-size: 11px; color: #6b7280;">
      Click "Upload & Process" to generate embeddings and store in Supabase.
      This will take ~1-2 minutes for ${tweets.length} tweets.
    </p>
  `;

  resultContainer.hidden = false;
}

// Upload tweets with embeddings
async function uploadTweets() {
  if (!window.pendingTweets || window.pendingTweets.length === 0) {
    showNotification('No tweets to upload', 'error');
    return;
  }

  const uploadBtn = document.getElementById('upload-tweets-btn');
  const progressContainer = document.getElementById('upload-progress');
  const progressText = progressContainer.querySelector('.progress-text');

  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Processing...';
  progressContainer.hidden = false;
  progressText.textContent = `Processing ${window.pendingTweets.length} tweets with embeddings...`;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'uploadTweets',
      data: {
        tweets: window.pendingTweets
      }
    });

    if (response.success) {
      showNotification(`Uploaded ${response.data.count} tweets with embeddings`, 'success');
      window.pendingTweets = null;
      document.getElementById('upload-result').hidden = true;
      loadTweetStatus();
    } else {
      throw new Error(response.error);
    }

  } catch (error) {
    console.error('Upload failed:', error);
    showNotification('Failed to upload tweets: ' + error.message, 'error');
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload & Process';
    progressContainer.hidden = true;
  }
}

// Delete all tweets
async function deleteTweets() {
  if (!confirm('Delete all stored tweets? This cannot be undone.')) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({ action: 'deleteTweets' });

    if (response.success) {
      showNotification('All tweets deleted', 'success');
      loadTweetStatus();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showNotification('Failed to delete tweets: ' + error.message, 'error');
  }
}

// Analyze manual text
async function analyzeManualText() {
  const text = document.getElementById('manual-text').value.trim();

  if (!text) {
    showNotification('Please enter some text', 'error');
    return;
  }

  const tweets = text.split('\n').filter(line => line.trim().length > 10);

  if (tweets.length === 0) {
    showNotification('No valid tweets found', 'error');
    return;
  }

  window.pendingTweets = tweets;
  displayUploadResults(tweets);
}

// Load style profile status
async function loadStyleProfileStatus() {
  const statusContainer = document.getElementById('style-profile-status');
  const generateBtn = document.getElementById('generate-style-btn');

  try {
    // Get all profiles
    const response = await chrome.runtime.sendMessage({ action: 'getAllStyleProfiles', data: {} });
    const storage = await chrome.storage.sync.get(['activeStyleProfileId']);
    const activeProfileId = storage.activeStyleProfileId;

    if (response && response.success && response.data && response.data.length > 0) {
      const profiles = response.data;
      const activeProfile = activeProfileId
        ? profiles.find(p => p.id === activeProfileId) || profiles[0]
        : profiles[0];

      const createdDate = new Date(activeProfile.created_at).toLocaleDateString();

      statusContainer.innerHTML = `
        <div class="status-card success">
          <span class="status-icon">✓</span>
          <div>
            <strong>Style profile active</strong>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 4px;">
              Based on ${activeProfile.tweet_count} tweets · Created ${createdDate}
            </p>
          </div>
        </div>
        ${profiles.length > 1 ? `
          <div style="margin-top: 12px;">
            <label style="font-size: 11px; color: #6b7280; display: block; margin-bottom: 6px;">SELECT PROFILE</label>
            <select id="profile-selector" style="width: 100%; padding: 8px 10px; background: #0f0f16; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #e4e4e7; font-family: 'Geist Mono', monospace; font-size: 12px;">
              ${profiles.map(p => `
                <option value="${p.id}" ${p.id === activeProfile.id ? 'selected' : ''}>
                  ${p.tweet_count} tweets · ${new Date(p.created_at).toLocaleDateString()}
                </option>
              `).join('')}
            </select>
          </div>
        ` : ''}
      `;

      // Add change handler for profile selector
      const selector = statusContainer.querySelector('#profile-selector');
      if (selector) {
        selector.addEventListener('change', async (e) => {
          const profileId = parseInt(e.target.value);
          await chrome.runtime.sendMessage({
            action: 'setActiveStyleProfile',
            data: { profileId }
          });
          showNotification('Style profile switched!', 'success');
        });
      }

      generateBtn.textContent = 'Generate New Profile';
    } else {
      statusContainer.innerHTML = `
        <div class="status-card empty">
          <span class="status-icon">○</span>
          <div>
            <strong>No style profile</strong>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 4px;">Generate to improve reply quality</p>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to load style profile status:', error);
  }
}

// Generate style profile
async function generateStyleProfile() {
  const generateBtn = document.getElementById('generate-style-btn');
  const statusContainer = document.getElementById('style-profile-status');

  generateBtn.disabled = true;
  generateBtn.textContent = 'Analyzing...';

  statusContainer.innerHTML = `
    <div class="status-card empty">
      <span class="status-icon" style="animation: pulse 1s infinite;">◉</span>
      <div>
        <strong>Analyzing your writing style...</strong>
        <p style="font-size: 11px; color: #9ca3af; margin-top: 4px;">This takes ~30 seconds</p>
      </div>
    </div>
  `;

  try {
    const response = await chrome.runtime.sendMessage({ action: 'analyzeStyleProfile', data: {} });

    if (!response) {
      throw new Error('No response from service worker. Try reloading the extension.');
    }

    if (response.success) {
      showNotification('Style profile created!', 'success');
      loadStyleProfileStatus();
    } else {
      throw new Error(response.error || 'Unknown error occurred');
    }
  } catch (error) {
    console.error('Style profile generation failed:', error);
    showNotification('Failed: ' + error.message, 'error');
    loadStyleProfileStatus();
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Style Profile';
  }
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    padding: 10px 16px;
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#4ade80' : '#d4a574'};
    color: ${type === 'success' ? '#0d0d14' : '#fff'};
    border-radius: 6px;
    font-size: 12px;
    font-family: 'Geist Mono', monospace;
    z-index: 10000;
    animation: slideIn 0.2s ease-out;
  `;

  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}
