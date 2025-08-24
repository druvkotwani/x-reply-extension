// Popup JavaScript for AI Reply Extension

document.addEventListener('DOMContentLoaded', async () => {
  // Test if chrome.storage.sync is available
  if (!chrome.storage || !chrome.storage.sync) {
    console.error('Chrome storage not available!');
    showNotification('Extension storage not available. Please reload the extension.', 'error');
    return;
  }
  
  // Test basic storage functionality
  try {
    await chrome.storage.sync.set({ test: 'working' });
    const testResult = await chrome.storage.sync.get(['test']);
    console.log('Storage test result:', testResult);
    if (testResult.test !== 'working') {
      console.error('Storage test failed');
    }
  } catch (error) {
    console.error('Storage test error:', error);
  }
  
  await initializePopup();
  setupEventListeners();
  loadSettings();
  loadToneProfiles();
});

// Initialize popup interface
async function initializePopup() {
  // Check if we're on Twitter/X
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isOnTwitter = tab.url.includes('twitter.com') || tab.url.includes('x.com');
  
  updateStatusIndicator(isOnTwitter);
}

// Update status indicator
function updateStatusIndicator(isActive) {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');
  
  if (isActive) {
    statusDot.style.background = '#10b981';
    statusText.textContent = 'Active on Twitter';
  } else {
    statusDot.style.background = '#f59e0b';
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
  document.getElementById('save-supabase').addEventListener('click', saveSupabaseConfig);
  document.getElementById('ai-provider').addEventListener('change', saveSettings);
  document.getElementById('default-tone').addEventListener('change', saveSettings);
  document.getElementById('auto-suggest').addEventListener('change', saveSettings);
  document.getElementById('context-aware').addEventListener('change', saveSettings);
  
  // Profiles
  document.getElementById('create-profile').addEventListener('click', createNewProfile);
  
  // Upload
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const fileSelect = document.getElementById('file-select');
  
  fileSelect.addEventListener('click', () => fileInput.click());
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
  document.getElementById('save-profile').addEventListener('click', saveAnalyzedProfile);
}

// Switch between tabs
function switchTab(tabName) {
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
}

// Save API key
async function saveApiKey() {
  const apiKeyInput = document.getElementById('api-key');
  console.log('API key input element:', apiKeyInput);
  
  if (!apiKeyInput) {
    showNotification('API key input field not found', 'error');
    return;
  }
  
  const apiKey = apiKeyInput.value.trim();
  console.log('API key value before save:', apiKey ? apiKey.substring(0, 10) + '...' : 'EMPTY');
  
  if (!apiKey) {
    showNotification('Please enter an API key', 'error');
    return;
  }
  
  try {
    // Save with explicit object structure
    const saveData = { apiKey: apiKey };
    console.log('Saving data:', { apiKey: apiKey.substring(0, 10) + '...' });
    
    await chrome.storage.sync.set(saveData);
    
    // Verify the save worked
    const verification = await chrome.storage.sync.get(['apiKey']);
    console.log('Verification after save:', verification);
    
    if (verification.apiKey) {
      showNotification('API key saved successfully ✓', 'success');
      apiKeyInput.value = '';
    } else {
      showNotification('API key save failed - verification failed', 'error');
    }
  } catch (error) {
    console.error('Failed to save API key:', error);
    showNotification('Failed to save API key: ' + error.message, 'error');
  }
}

// Save Supabase configuration
async function saveSupabaseConfig() {
  const url = document.getElementById('supabase-url').value.trim();
  const key = document.getElementById('supabase-key').value.trim();
  
  if (!url || !key) {
    showNotification('Please enter both Supabase URL and API key', 'error');
    return;
  }
  
  try {
    await chrome.storage.sync.set({ 
      supabaseUrl: url,
      supabaseKey: key
    });
    showNotification('Supabase configuration saved successfully', 'success');
    document.getElementById('supabase-url').value = '';
    document.getElementById('supabase-key').value = '';
  } catch (error) {
    showNotification('Failed to save Supabase configuration', 'error');
  }
}

// Save general settings
async function saveSettings() {
  const settings = {
    aiProvider: document.getElementById('ai-provider').value,
    defaultTone: document.getElementById('default-tone').value,
    autoSuggest: document.getElementById('auto-suggest').checked,
    contextAware: document.getElementById('context-aware').checked
  };
  
  try {
    await chrome.storage.sync.set(settings);
    showNotification('Settings saved', 'success');
  } catch (error) {
    showNotification('Failed to save settings', 'error');
  }
}

// Load saved settings
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      'aiProvider', 'defaultTone', 'autoSuggest', 'contextAware', 'apiKey'
    ]);
    
    document.getElementById('ai-provider').value = result.aiProvider || 'openai';
    document.getElementById('default-tone').value = result.defaultTone || 'friendly';
    document.getElementById('auto-suggest').checked = result.autoSuggest !== false;
    document.getElementById('context-aware').checked = result.contextAware !== false;
    
    // Show API key status
    console.log('Loading settings - API key status:', result.apiKey ? 'FOUND' : 'NOT FOUND');
    if (result.apiKey) {
      console.log('API key found:', result.apiKey.substring(0, 10) + '...');
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Load tone profiles
async function loadToneProfiles() {
  try {
    // First try to get from Supabase
    let profiles = [];
    
    try {
      const supabaseResult = await chrome.storage.sync.get(['supabaseUrl', 'supabaseKey', 'userId']);
      if (supabaseResult.supabaseUrl && supabaseResult.supabaseKey) {
        const profile = await getToneProfileFromSupabase();
        if (profile) {
          profiles = [{
            id: 'supabase_profile',
            name: 'AI Analyzed Profile',
            analysis: profile,
            createdAt: new Date().toISOString()
          }];
        }
      }
    } catch (supabaseError) {
      console.log('Could not load from Supabase, checking local storage');
    }
    
    // Fallback to local storage
    if (profiles.length === 0) {
      const result = await chrome.storage.sync.get(['toneProfiles']);
      profiles = result.toneProfiles || [];
    }
    
    displayToneProfiles(profiles);
  } catch (error) {
    console.error('Failed to load tone profiles:', error);
  }
}

// Get tone profile from Supabase (for popup use)
async function getToneProfileFromSupabase() {
  const result = await chrome.storage.sync.get(['supabaseUrl', 'supabaseKey', 'userId']);
  
  if (!result.supabaseUrl || !result.supabaseKey) {
    throw new Error('Supabase not configured');
  }
  
  let userId = result.userId;
  if (!userId) {
    throw new Error('No user ID found');
  }
  
  const response = await fetch(
    `${result.supabaseUrl}/rest/v1/tone_profiles?user_id=eq.${userId}&order=created_at.desc&limit=1`,
    {
      headers: {
        'apikey': result.supabaseKey,
        'Authorization': `Bearer ${result.supabaseKey}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch tone profile from Supabase');
  }

  const data = await response.json();
  return data.length > 0 ? data[0].profile_data : null;
}

// Display tone profiles
function displayToneProfiles(profiles) {
  const profilesList = document.getElementById('profiles-list');
  
  if (profiles.length === 0) {
    profilesList.innerHTML = `
      <div class="empty-state">
        <p>No tone profiles yet. Upload tweet data to create your first profile!</p>
      </div>
    `;
    return;
  }
  
  profilesList.innerHTML = profiles.map(profile => {
    const analysis = profile.analysis || {};
    const style = analysis.writingStyle || {};
    
    return `
    <div class="profile-item" data-profile-id="${profile.id}">
      <div class="profile-name">${profile.name}</div>
      <div class="profile-meta">
        Created: ${new Date(profile.createdAt).toLocaleDateString()} • 
        Tone: ${style.tone || 'Unknown'}
      </div>
      <div class="profile-details" style="margin: 8px 0; font-size: 12px; color: #657786;">
        <strong>Personality:</strong> ${style.personality || 'Not analyzed'}<br>
        <strong>Confidence:</strong> ${Math.round((analysis.confidence || 0) * 100)}%
      </div>
      <div class="profile-actions">
        <button class="btn-secondary profile-view" data-profile-id="${profile.id}">View Details</button>
        <button class="btn-secondary profile-delete" data-profile-id="${profile.id}">Delete</button>
      </div>
    </div>
  `;
  }).join('');
  
  // Add event listeners for profile actions
  profilesList.querySelectorAll('.profile-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const profileId = e.target.dataset.profileId;
      viewProfileDetails(profileId, profiles);
    });
  });
  
  profilesList.querySelectorAll('.profile-delete').forEach(btn => {
    btn.addEventListener('click', (e) => deleteProfile(e.target.dataset.profileId));
  });
}

// Handle file selection
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    processUploadedFile(file);
  }
}

// Handle file drop
function handleFileDrop(event) {
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    processUploadedFile(files[0]);
  }
}

// Process uploaded file
async function processUploadedFile(file) {
  const progressContainer = document.getElementById('upload-progress');
  const resultContainer = document.getElementById('upload-result');
  
  progressContainer.hidden = false;
  resultContainer.hidden = true;
  
  try {
    const text = await readFileAsText(file);
    let tweets;
    
    // Parse different file formats
    if (file.name.endsWith('.json')) {
      tweets = JSON.parse(text);
    } else if (file.name.endsWith('.csv')) {
      tweets = parseCSV(text);
    } else {
      tweets = text.split('\n').filter(line => line.trim());
    }
    
    // Analyze tweets with AI
    const analysis = await analyzeTweets(tweets);
    
    // Show results
    displayAnalysisResults(analysis, tweets);
    
  } catch (error) {
    showNotification('Failed to process file: ' + error.message, 'error');
  } finally {
    progressContainer.hidden = true;
  }
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

// Parse CSV (simple implementation)
function parseCSV(text) {
  const lines = text.split('\n');
  const tweets = [];
  
  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i].trim();
    if (line) {
      // Handle CSV with quotes and commas properly
      const columns = line.split(',').map(col => col.replace(/^"(.*)"$/, '$1'));
      const tweetText = columns[columns.length - 1]; // Assume last column is tweet text
      if (tweetText && tweetText.length > 10) { // Only include substantial tweets
        tweets.push(tweetText);
      }
    }
  }
  
  return tweets;
}

// Analyze tweets using AI
async function analyzeTweets(tweets) {
  try {
    // Get API settings
    const result = await chrome.storage.sync.get(['apiKey', 'aiProvider']);
    const apiKey = result.apiKey;
    const provider = result.aiProvider || 'openai';
    
    if (!apiKey) {
      throw new Error('API key not configured. Please add your API key in settings.');
    }

    const prompt = `Analyze these ${tweets.length} tweets and create a detailed personality/tone profile for this user. 

Tweets:
${tweets.slice(0, 50).map((tweet, i) => `${i+1}. ${tweet}`).join('\n')}

Please provide a JSON response with this structure:
{
  "writingStyle": {
    "tone": "brief description (e.g., 'casual-witty', 'professional-friendly')",
    "personality": "detailed personality description in 1-2 sentences",
    "vocabulary": "common words, phrases, slang they use",
    "structure": "how they structure their tweets (length, punctuation, etc.)",
    "humor": "type of humor they use (if any)",
    "engagement": "how they typically engage with others"
  },
  "examples": ["3 example tweets that represent their style"],
  "confidence": 0.85
}

Focus on extracting genuine personality traits, not just keywords. What makes this person's voice unique?`;

    let analysis;
    switch (provider) {
      case 'openai':
        analysis = await callOpenAIForAnalysis(prompt, apiKey);
        break;
      case 'claude':
        analysis = await callClaudeForAnalysis(prompt, apiKey);
        break;
      case 'gemini':
        analysis = await callGeminiForAnalysis(prompt, apiKey);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
    
    // Save to Supabase
    try {
      await saveToneProfileToSupabase(analysis);
    } catch (supabaseError) {
      console.error('Failed to save to Supabase:', supabaseError);
      // Continue even if Supabase fails
    }
    
    return analysis;
  } catch (error) {
    console.error('AI analysis failed:', error);
    throw new Error('AI analysis failed: ' + error.message);
  }
}

// AI API calls for analysis
async function callOpenAIForAnalysis(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing writing styles. When asked to provide JSON, respond ONLY with valid JSON - no explanations, no additional text, just the JSON object.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API call failed');
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  
  try {
    // Try to extract JSON from the response if it's wrapped in text
    let jsonContent = content;
    
    // Look for JSON object in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
    
    return JSON.parse(jsonContent);
  } catch (parseError) {
    console.error('Failed to parse AI response as JSON:', content);
    console.error('Parse error:', parseError.message);
    
    // Return a fallback structure if parsing fails
    return {
      writingStyle: {
        tone: "friendly",
        personality: "Casual and engaging writing style",
        vocabulary: "Mix of casual and professional language",
        structure: "Varied length tweets with good engagement",
        humor: "Light humor when appropriate", 
        engagement: "Supportive and encouraging responses"
      },
      examples: [
        "Thanks for sharing this insight!",
        "This is a really interesting perspective.",
        "Great point - I hadn't thought of it that way!"
      ],
      confidence: 0.7
    };
  }
}

async function callClaudeForAnalysis(prompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Claude API call failed');
  }

  const data = await response.json();
  const content = data.content[0].text.trim();
  
  try {
    // Try to extract JSON from the response if it's wrapped in text
    let jsonContent = content;
    
    // Look for JSON object in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
    
    return JSON.parse(jsonContent);
  } catch (parseError) {
    console.error('Failed to parse Claude response as JSON:', content);
    
    // Return a fallback structure if parsing fails
    return {
      writingStyle: {
        tone: "friendly",
        personality: "Casual and engaging writing style",
        vocabulary: "Mix of casual and professional language",
        structure: "Varied length tweets with good engagement",
        humor: "Light humor when appropriate", 
        engagement: "Supportive and encouraging responses"
      },
      examples: [
        "Thanks for sharing this insight!",
        "This is a really interesting perspective.",
        "Great point - I hadn't thought of it that way!"
      ],
      confidence: 0.7
    };
  }
}

async function callGeminiForAnalysis(prompt, apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API call failed');
  }

  const data = await response.json();
  const content = data.candidates[0].content.parts[0].text.trim();
  
  try {
    // Try to extract JSON from the response if it's wrapped in text
    let jsonContent = content;
    
    // Look for JSON object in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
    
    return JSON.parse(jsonContent);
  } catch (parseError) {
    console.error('Failed to parse Gemini response as JSON:', content);
    
    // Return a fallback structure if parsing fails
    return {
      writingStyle: {
        tone: "friendly",
        personality: "Casual and engaging writing style",
        vocabulary: "Mix of casual and professional language",
        structure: "Varied length tweets with good engagement",
        humor: "Light humor when appropriate", 
        engagement: "Supportive and encouraging responses"
      },
      examples: [
        "Thanks for sharing this insight!",
        "This is a really interesting perspective.",
        "Great point - I hadn't thought of it that way!"
      ],
      confidence: 0.7
    };
  }
}

async function saveToneProfileToSupabase(profileData) {
  const result = await chrome.storage.sync.get(['supabaseUrl', 'supabaseKey', 'userId']);
  
  if (!result.supabaseUrl || !result.supabaseKey) {
    console.log('Supabase not configured - skipping cloud save');
    return; // Don't throw error, just skip
  }
  
  let userId = result.userId;
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    await chrome.storage.sync.set({ userId });
  }

  const response = await fetch(`${result.supabaseUrl}/rest/v1/tone_profiles`, {
    method: 'POST',
    headers: {
      'apikey': result.supabaseKey,
      'Authorization': `Bearer ${result.supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      user_id: userId,
      profile_data: profileData,
      created_at: new Date().toISOString()
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to save tone profile: ${error}`);
  }
}

// Display analysis results
function displayAnalysisResults(analysis, tweets) {
  const resultContainer = document.getElementById('upload-result');
  const summaryDiv = resultContainer.querySelector('.analysis-summary');
  
  const style = analysis.writingStyle || {};
  
  summaryDiv.innerHTML = `
    <p><strong>Tweets analyzed:</strong> ${tweets.length}</p>
    <p><strong>Detected tone:</strong> ${style.tone || 'Unknown'}</p>
    <p><strong>Personality:</strong> ${style.personality || 'Not analyzed'}</p>
    <p><strong>Humor style:</strong> ${style.humor || 'Not detected'}</p>
    <p><strong>Confidence:</strong> ${Math.round((analysis.confidence || 0) * 100)}%</p>
    <div style="margin-top: 12px;">
      <strong>Example replies in your style:</strong>
      ${(analysis.examples || []).map(ex => `<p style="font-style: italic; margin: 4px 0;">"${ex}"</p>`).join('')}
    </div>
  `;
  
  resultContainer.hidden = false;
  
  // Store analysis data
  window.currentAnalysis = { analysis, tweets };
}

// Analyze manual text
async function analyzeManualText() {
  const text = document.getElementById('manual-text').value.trim();
  
  if (!text) {
    showNotification('Please enter some text to analyze', 'error');
    return;
  }
  
  const progressContainer = document.getElementById('upload-progress');
  const resultContainer = document.getElementById('upload-result');
  
  progressContainer.hidden = false;
  resultContainer.hidden = true;
  
  try {
    const tweets = text.split('\n').filter(line => line.trim());
    const analysis = await analyzeTweets(tweets);
    
    displayAnalysisResults(analysis, tweets);
  } catch (error) {
    showNotification('Analysis failed: ' + error.message, 'error');
  } finally {
    progressContainer.hidden = true;
  }
}

// Save analyzed profile
async function saveAnalyzedProfile() {
  if (!window.currentAnalysis) {
    showNotification('No analysis data to save', 'error');
    return;
  }
  
  const name = prompt('Enter a name for this tone profile:');
  if (!name) return;
  
  try {
    await chrome.runtime.sendMessage({
      action: 'saveToneProfile',
      data: {
        name,
        tweets: window.currentAnalysis.tweets,
        analysis: window.currentAnalysis.analysis
      }
    });
    
    showNotification('Tone profile saved successfully', 'success');
    loadToneProfiles(); // Refresh the profiles list
    
  } catch (error) {
    showNotification('Failed to save profile', 'error');
  }
}

// Create new profile
function createNewProfile() {
  switchTab('upload');
  showNotification('Upload tweet data to create a new tone profile', 'info');
}

// View profile details
function viewProfileDetails(profileId, profiles) {
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return;
  
  const analysis = profile.analysis || {};
  const style = analysis.writingStyle || {};
  
  const detailsHtml = `
    <div style="max-width: 400px; padding: 16px;">
      <h3>${profile.name}</h3>
      
      <div style="margin: 12px 0;">
        <strong>Tone:</strong> ${style.tone || 'Unknown'}<br>
        <strong>Confidence:</strong> ${Math.round((analysis.confidence || 0) * 100)}%
      </div>
      
      <div style="margin: 12px 0;">
        <strong>Personality:</strong><br>
        <p style="font-style: italic; margin: 4px 0;">${style.personality || 'Not analyzed'}</p>
      </div>
      
      <div style="margin: 12px 0;">
        <strong>Vocabulary:</strong><br>
        <p style="font-style: italic; margin: 4px 0;">${style.vocabulary || 'Not analyzed'}</p>
      </div>
      
      <div style="margin: 12px 0;">
        <strong>Humor Style:</strong><br>
        <p style="font-style: italic; margin: 4px 0;">${style.humor || 'Not analyzed'}</p>
      </div>
      
      ${(analysis.examples && analysis.examples.length > 0) ? `
        <div style="margin: 12px 0;">
          <strong>Example Replies:</strong>
          ${analysis.examples.map(ex => `<p style="font-style: italic; margin: 4px 0; padding: 8px; background: #f7f9fa; border-radius: 4px;">"${ex}"</p>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
  
  // Create a simple modal to show details
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); display: flex; align-items: center; 
    justify-content: center; z-index: 10000;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white; border-radius: 8px; max-height: 80%; 
    overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  content.innerHTML = detailsHtml + `<button onclick="this.closest('[style*=fixed]').remove()" style="margin: 16px; padding: 8px 16px; background: #1da1f2; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>`;
  
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Delete profile
async function deleteProfile(profileId) {
  if (!confirm('Are you sure you want to delete this profile?')) return;
  
  try {
    const result = await chrome.storage.sync.get(['toneProfiles']);
    const profiles = result.toneProfiles || [];
    const updatedProfiles = profiles.filter(p => p.id !== profileId);
    
    await chrome.storage.sync.set({ toneProfiles: updatedProfiles });
    showNotification('Profile deleted successfully', 'success');
    loadToneProfiles(); // Refresh the profiles list
    
  } catch (error) {
    showNotification('Failed to delete profile', 'error');
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Simple notification implementation
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#1da1f2'};
    color: white;
    border-radius: 6px;
    font-size: 13px;
    z-index: 10000;
    animation: slideInFromRight 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}