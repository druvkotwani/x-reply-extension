// Popup JavaScript for X Reply Extension

document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
  setupEventListeners();
  loadSettings();
  loadUserData(); // Load usernames, tweet sources, and style profiles
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

  document.getElementById('upload-tweets-btn').addEventListener('click', uploadTweets);
  document.getElementById('generate-style-btn').addEventListener('click', generateStyleProfile);

  // Tweet source dropdown
  document.getElementById('tweet-source-select').addEventListener('change', (e) => {
    chrome.storage.sync.set({ selectedTweetSource: e.target.value });
  });

  // Style profile dropdown
  document.getElementById('style-profile-select').addEventListener('change', async (e) => {
    const profileId = e.target.value;
    if (profileId) {
      await chrome.runtime.sendMessage({
        action: 'setActiveStyleProfile',
        data: { profileId: parseInt(profileId) }
      });
    } else {
      await chrome.storage.sync.remove('activeStyleProfileId');
    }
  });
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

// Load all user data (usernames, tweet sources, style profiles)
async function loadUserData() {
  try {
    // Get all usernames
    const usernamesResponse = await chrome.runtime.sendMessage({ action: 'getAllUsernames' });
    const usernames = usernamesResponse.success ? usernamesResponse.data : [];

    // Get all style profiles
    const profilesResponse = await chrome.runtime.sendMessage({ action: 'getAllStyleProfiles', data: {} });
    const allProfiles = profilesResponse.success ? profilesResponse.data : [];

    // Get stored selections
    const storage = await chrome.storage.sync.get(['selectedTweetSource', 'activeStyleProfileId']);

    // Populate Tweet Source dropdown
    const tweetSourceSelect = document.getElementById('tweet-source-select');
    if (usernames.length === 0) {
      tweetSourceSelect.innerHTML = '<option value="">No tweets uploaded</option>';
    } else {
      // Check if stored selection is still valid
      const validUsernames = usernames.map(u => u.username);
      const storedIsValid = storage.selectedTweetSource && validUsernames.includes(storage.selectedTweetSource);
      const selectedUsername = storedIsValid ? storage.selectedTweetSource : usernames[0].username;

      tweetSourceSelect.innerHTML = usernames.map(u =>
        `<option value="${u.username}" ${selectedUsername === u.username ? 'selected' : ''}>@${u.username} (${u.tweetCount} tweets)</option>`
      ).join('');

      // Save selection if it changed or wasn't set
      if (!storedIsValid) {
        chrome.storage.sync.set({ selectedTweetSource: selectedUsername });
      }
    }

    // Populate Style Profile dropdown (grouped by username)
    const styleProfileSelect = document.getElementById('style-profile-select');
    if (allProfiles.length === 0) {
      styleProfileSelect.innerHTML = '<option value="">No style profiles</option>';
    } else {
      // Group profiles by user_id
      const profilesByUser = {};
      for (const profile of allProfiles) {
        const userId = profile.user_id || 'default_user';
        if (!profilesByUser[userId]) profilesByUser[userId] = [];
        profilesByUser[userId].push(profile);
      }

      let optionsHtml = '<option value="">No style (use examples only)</option>';
      for (const [userId, profiles] of Object.entries(profilesByUser)) {
        optionsHtml += `<optgroup label="@${userId}">`;
        for (const profile of profiles) {
          const date = new Date(profile.created_at).toLocaleDateString();
          const selected = storage.activeStyleProfileId === profile.id ? 'selected' : '';
          optionsHtml += `<option value="${profile.id}" ${selected}>${profile.tweet_count} tweets · ${date}</option>`;
        }
        optionsHtml += '</optgroup>';
      }
      styleProfileSelect.innerHTML = optionsHtml;
    }

    // Populate User Management list
    const userList = document.getElementById('user-list');
    if (usernames.length === 0) {
      userList.innerHTML = '<p class="help-text">No users yet. Upload tweets to get started.</p>';
    } else {
      userList.innerHTML = usernames.map(u => `
        <div class="profile-item" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="profile-name">@${u.username}</div>
            <div class="profile-meta">${u.tweetCount} tweets</div>
          </div>
          <button class="btn-danger-small delete-user-btn" data-username="${u.username}">Delete</button>
        </div>
      `).join('');

      // Add delete handlers
      userList.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteUserData(btn.dataset.username));
      });
    }

  } catch (error) {
    console.error('Failed to load user data:', error);
  }
}

// Delete all data for a specific user
async function deleteUserData(username) {
  if (!confirm(`Delete all tweets and style profiles for @${username}? This cannot be undone.`)) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'deleteUserData',
      data: { username }
    });

    if (response.success) {
      showNotification(`Deleted all data for @${username}`, 'success');
      loadUserData(); // Refresh
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showNotification('Failed to delete: ' + error.message, 'error');
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

  // Get username from input
  const usernameInput = document.getElementById('upload-username');
  const username = usernameInput.value.trim().replace('@', ''); // Remove @ if present

  if (!username) {
    showNotification('Please enter a username', 'error');
    usernameInput.focus();
    return;
  }

  const uploadBtn = document.getElementById('upload-tweets-btn');
  const progressContainer = document.getElementById('upload-progress');
  const progressText = progressContainer.querySelector('.progress-text');

  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Processing...';
  progressContainer.hidden = false;
  progressText.textContent = `Processing ${window.pendingTweets.length} tweets for @${username}...`;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'uploadTweets',
      data: {
        tweets: window.pendingTweets,
        userId: username
      }
    });

    if (response.success) {
      showNotification(`Uploaded ${response.data.count} tweets for @${username}`, 'success');
      window.pendingTweets = null;
      document.getElementById('upload-result').hidden = true;
      usernameInput.value = ''; // Clear input
      loadUserData(); // Refresh user list and dropdowns
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


// Generate style profile for selected tweet source
async function generateStyleProfile() {
  const generateBtn = document.getElementById('generate-style-btn');

  // Get selected tweet source
  const tweetSourceSelect = document.getElementById('tweet-source-select');
  const selectedUsername = tweetSourceSelect.value;

  if (!selectedUsername) {
    showNotification('No tweet source selected. Upload tweets first.', 'error');
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = `Analyzing @${selectedUsername}...`;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeStyleProfile',
      data: { userId: selectedUsername }
    });

    if (!response) {
      throw new Error('No response from service worker. Try reloading the extension.');
    }

    if (response.success) {
      showNotification(`Style profile created for @${selectedUsername}!`, 'success');
      loadUserData(); // Refresh dropdowns
    } else {
      throw new Error(response.error || 'Unknown error occurred');
    }
  } catch (error) {
    console.error('Style profile generation failed:', error);
    showNotification('Failed: ' + error.message, 'error');
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
