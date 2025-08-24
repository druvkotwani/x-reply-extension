// Content script to detect Twitter reply sections and inject AI reply icon
let aiReplyButtons = new Set();

// Observer to watch for DOM changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      addAIReplyButtons();
    }
  });
});

// Start observing when page loads
window.addEventListener('load', () => {
  addAIReplyButtons();
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});

// Also run immediately in case page is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addAIReplyButtons);
} else {
  addAIReplyButtons();
}

function addAIReplyButtons() {
  // Only target the reply compose area, not the tweet action buttons
  const replyComposeAreas = document.querySelectorAll('[data-testid="tweetTextarea_0"]');
  
  replyComposeAreas.forEach((textarea) => {
    const replyContainer = textarea.closest('[role="textbox"]')?.parentElement?.parentElement;
    if (replyContainer && !replyContainer.querySelector('.ai-reply-button')) {
      // Find the Reply button in this compose area
      const replyButton = replyContainer.querySelector('button[data-testid="tweetButtonInline"]');
      if (replyButton) {
        addAIReplyButton(replyButton);
      }
    }
  });
  
  // Fallback: Look for reply buttons specifically in compose areas
  const composeContainers = document.querySelectorAll('[data-testid="toolBar"]');
  composeContainers.forEach((toolbar) => {
    const replyButton = toolbar.querySelector('button[data-testid="tweetButtonInline"]');
    if (replyButton && !toolbar.querySelector('.ai-reply-button')) {
      const replyText = replyButton.querySelector('span');
      if (replyText && replyText.textContent.trim() === 'Reply') {
        addAIReplyButton(replyButton);
      }
    }
  });
}

function addAIReplyButton(replyButton) {
  // Create AI reply button
  const aiButton = document.createElement('button');
  aiButton.className = 'ai-reply-button';
  
  // Use the extension icon instead of SVG + text
  const iconUrl = chrome.runtime.getURL('assets/icons/icon16.png');
  aiButton.innerHTML = `
    <img src="${iconUrl}" width="16" height="16" alt="AI Reply" style="filter: brightness(0) invert(1);">
  `;
  
  aiButton.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
    padding: 0;
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
    backdrop-filter: blur(20px);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 9999;
    position: relative;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2), 
                0 2px 8px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.3);
  `;
  
  // Hover effects
  aiButton.addEventListener('mouseenter', () => {
    aiButton.style.transform = 'scale(1.1) translateY(-1px)';
    aiButton.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1))';
    aiButton.style.boxShadow = `
      0 8px 25px rgba(0, 0, 0, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.4)
    `;
  });
  
  aiButton.addEventListener('mouseleave', () => {
    aiButton.style.transform = 'scale(1) translateY(0)';
    aiButton.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))';
    aiButton.style.boxShadow = `
      0 4px 15px rgba(0, 0, 0, 0.2),
      0 2px 8px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.3)
    `;
  });
  
  // Click handler
  aiButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showAIReplyPopup(replyButton);
  });
  
  // Insert after the reply button
  if (replyButton.parentElement) {
    replyButton.parentElement.insertBefore(aiButton, replyButton.nextSibling);
  }
  
  // Mark that we've added the button to this section
  aiReplyButtons.add(aiButton);
}

function showAIReplyPopup(replyButton) {
  // Remove any existing popup
  const existingPopup = document.querySelector('.ai-reply-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Get tweet context - look for the original tweet text
  let tweetText = '';
  
  // First, try to find the tweet text by going up the DOM tree
  let currentElement = replyButton;
  while (currentElement && currentElement !== document.body) {
    // Look for tweet text in the current level
    const tweetTextElement = currentElement.querySelector('[data-testid="tweetText"]');
    if (tweetTextElement) {
      tweetText = tweetTextElement.textContent.trim();
      break;
    }
    currentElement = currentElement.parentElement;
  }
  
  // Fallback: Look for any tweet text in the visible area
  if (!tweetText) {
    const allTweetTexts = document.querySelectorAll('[data-testid="tweetText"]');
    
    // Get the last visible tweet text (most likely the one being replied to)
    for (let i = allTweetTexts.length - 1; i >= 0; i--) {
      const element = allTweetTexts[i];
      if (element.offsetParent !== null) { // Check if visible
        tweetText = element.textContent.trim();
        break;
      }
    }
  }
  
  // Detect current theme (dark mode on Twitter/X)
  const isDarkMode = document.documentElement.style.colorScheme === 'dark' || 
                     document.body.style.backgroundColor.includes('rgb(0, 0, 0)') ||
                     getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)' ||
                     window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'ai-reply-popup';
  if (isDarkMode) {
    popup.classList.add('dark-theme');
  }
  popup.innerHTML = `
    <div class="ai-popup-content">
      <div class="ai-popup-header">
        <h3>AI Reply Suggestions</h3>
        <button class="ai-popup-close">&times;</button>
      </div>
      <div class="ai-popup-body">
        <div class="tweet-context">
          <strong>Original Tweet:</strong>
          <p>"${tweetText || 'Could not extract tweet text. Please check the console for debugging.'}"</p>
          ${!tweetText ? '<p style="color: #ff6b6b; font-size: 12px;">Debug: No tweet text found. Check browser console for details.</p>' : ''}
        </div>
        <div class="ai-suggestions">
          <h4>Suggested Replies:</h4>
          <div class="suggestion-item">
            <p>Generating AI replies...</p>
          </div>
        </div>
        <div class="manual-input">
          <h4>Custom Request:</h4>
          <textarea placeholder="Describe how you want to reply..." id="custom-prompt"></textarea>
          <button class="generate-custom">Generate Custom Reply</button>
          <div class="custom-result" style="margin-top: 12px; display: none;">
            <h4>Custom Reply:</h4>
            <div class="custom-reply-text" style="padding: 12px; background: #f7f9fa; border-radius: 8px; margin: 8px 0;"></div>
            <button class="copy-custom-reply">📋 Copy Custom Reply</button>
          </div>
        </div>
      </div>
    </div>
    <div class="ai-popup-overlay"></div>
  `;
  
  document.body.appendChild(popup);
  
  // Close popup handlers
  popup.querySelector('.ai-popup-close').addEventListener('click', () => popup.remove());
  popup.querySelector('.ai-popup-overlay').addEventListener('click', () => popup.remove());
  
  // Custom reply generation
  popup.querySelector('.generate-custom').addEventListener('click', async () => {
    const customPrompt = popup.querySelector('#custom-prompt').value.trim();
    if (!customPrompt) {
      alert('Please enter a custom request');
      return;
    }
    
    const customButton = popup.querySelector('.generate-custom');
    const originalText = customButton.textContent;
    customButton.textContent = 'Generating...';
    customButton.disabled = true;
    
    try {
      // Send custom request to background script
      const response = await chrome.runtime.sendMessage({
        action: 'generateCustomReply',
        data: {
          originalTweet: tweetText,
          customPrompt: customPrompt
        }
      });
      
      if (response.success) {
        const customResult = popup.querySelector('.custom-result');
        const customReplyText = popup.querySelector('.custom-reply-text');
        
        customReplyText.textContent = response.data;
        customResult.style.display = 'block';
        
        // Add copy functionality for custom reply
        const copyCustomBtn = popup.querySelector('.copy-custom-reply');
        copyCustomBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(response.data);
            copyCustomBtn.innerHTML = '✅ Copied!';
            copyCustomBtn.style.background = '#10b981';
            
            // Save custom reply to database for learning
            try {
              await chrome.runtime.sendMessage({
                action: 'saveReply',
                data: {
                  originalTweet: tweetText,
                  userReply: response.data
                }
              });
              console.log('Custom reply saved to database for learning');
            } catch (error) {
              console.log('Failed to save custom reply to history:', error);
            }
            
            setTimeout(() => {
              copyCustomBtn.innerHTML = '📋 Copy Custom Reply';
              copyCustomBtn.style.background = '';
            }, 2000);
          } catch (error) {
            console.error('Failed to copy custom reply:', error);
          }
        };
      } else {
        alert('Failed to generate custom reply: ' + response.error);
      }
    } catch (error) {
      console.error('Custom reply generation failed:', error);
      alert('Failed to generate custom reply');
    } finally {
      customButton.textContent = originalText;
      customButton.disabled = false;
    }
  });
  
  // Generate initial suggestions
  generateReplySuggestions(tweetText, popup);
}

async function generateReplySuggestions(tweetText, popup) {
  const suggestionsContainer = popup.querySelector('.ai-suggestions');
  suggestionsContainer.innerHTML = '<h4>Suggested Replies:</h4><p>Generating AI replies...</p>';
  
  try {
    // First try to get tone profile from Supabase
    let toneProfile = null;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getToneProfile'
      });
      
      if (response.success) {
        toneProfile = response.data;
      }
    } catch (supabaseError) {
      console.log('No Supabase profile found, using fallback');
    }
    
    let suggestions = [];
    
    if (toneProfile) {
      // Use AI with stored tone profile
      const response = await chrome.runtime.sendMessage({
        action: 'generateReplies',
        data: {
          originalTweet: tweetText,
          toneProfile: toneProfile
        }
      });
      
      if (response.success) {
        suggestions = response.data;
      } else {
        throw new Error(response.error);
      }
    } else {
      // Use default tone-based replies
      const defaultTone = (await chrome.storage.sync.get(['defaultTone'])).defaultTone || 'friendly';
      suggestions = generateDefaultReplies(tweetText, defaultTone);
    }
    
    // Display suggestions
    displaySuggestions(suggestions, popup, tweetText);
    
  } catch (error) {
    console.error('Failed to generate replies:', error);
    suggestionsContainer.innerHTML = `
      <h4>Suggested Replies:</h4>
      <p style="color: #ff6b6b;">Failed to generate AI replies: ${error.message}</p>
      <p style="font-size: 12px; color: #657786;">Make sure you've configured your AI API key and uploaded a tone profile.</p>
    `;
  }
}

// Display suggestions in the popup
function displaySuggestions(suggestions, popup, tweetText) {
  const suggestionsContainer = popup.querySelector('.ai-suggestions');
  suggestionsContainer.innerHTML = '<h4>Suggested Replies:</h4>';
  
  suggestions.forEach((suggestion) => {
    const suggestionDiv = document.createElement('div');
    suggestionDiv.className = 'suggestion-item';
    suggestionDiv.innerHTML = `
      <p>${suggestion}</p>
      <button class="copy-suggestion" data-suggestion="${suggestion}">
        📋 Copy to Clipboard
      </button>
    `;
    suggestionsContainer.appendChild(suggestionDiv);
  });
  
  // Add click handlers for copy buttons
  popup.querySelectorAll('.copy-suggestion').forEach(button => {
    button.addEventListener('click', async (e) => {
      const suggestion = e.target.dataset.suggestion;
      
      try {
        // Copy to clipboard
        await navigator.clipboard.writeText(suggestion);
        
        // Visual feedback
        const originalText = e.target.innerHTML;
        e.target.innerHTML = '✅ Copied!';
        e.target.style.background = '#10b981';
        
        // Reset button after 2 seconds
        setTimeout(() => {
          e.target.innerHTML = originalText;
          e.target.style.background = '';
        }, 2000);
        
        // Save the reply to history for learning when copied
        try {
          await chrome.runtime.sendMessage({
            action: 'saveReply',
            data: {
              originalTweet: tweetText,
              userReply: suggestion
            }
          });
          console.log('Reply saved to database for learning');
        } catch (error) {
          console.log('Failed to save reply to history:', error);
        }
        
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        
        // Fallback: show the text for manual copying
        const textArea = document.createElement('textarea');
        textArea.value = suggestion;
        textArea.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 300px; height: 100px; z-index: 10001; background: white; border: 2px solid #1da1f2; padding: 10px; border-radius: 8px;';
        textArea.readOnly = true;
        document.body.appendChild(textArea);
        textArea.select();
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = 'position: fixed; top: calc(50% + 60px); left: 50%; transform: translateX(-50%); z-index: 10002; padding: 8px 16px; background: #1da1f2; color: white; border: none; border-radius: 4px; cursor: pointer;';
        closeBtn.onclick = () => {
          document.body.removeChild(textArea);
          document.body.removeChild(closeBtn);
        };
        document.body.appendChild(closeBtn);
        
        e.target.innerHTML = '📋 Copy Manually';
      }
    });
  });
}

// Generate replies based on stored tone profile
function generateRepliesFromProfile(tweetText, analysis) {
  const tone = analysis.tone;
  
  const toneReplies = {
    casual: [
      "Totally agree with this!",
      "Haha yeah, exactly what I was thinking!",
      "This is so true tbh"
    ],
    professional: [
      "Thank you for sharing this valuable insight.",
      "This is a thoughtful perspective on the matter.",
      "I appreciate your analysis of this topic."
    ],
    friendly: [
      "Thanks for sharing this!",
      "I really appreciate your thoughts on this.",
      "This is such a great point!"
    ],
    witty: [
      "Well played! Couldn't agree more.",
      "Absolutely brilliant observation here.",
      "You've nailed it perfectly!"
    ],
    supportive: [
      "I'm totally here for this perspective!",
      "You've got such a good point here.",
      "Really glad you shared this insight!"
    ]
  };
  
  let baseReplies = toneReplies[tone] || toneReplies.friendly;
  
  // Customize based on tweet content
  if (tweetText.includes('?')) {
    baseReplies[0] = "Great question! " + baseReplies[0];
  }
  
  return baseReplies;
}

// Generate default replies when no tone profile exists
function generateDefaultReplies(tweetText, defaultTone) {
  const defaultReplies = {
    casual: [
      "This is so relatable!",
      "Exactly what I was thinking!",
      "Totally agree with this!"
    ],
    professional: [
      "Thank you for sharing this insight.",
      "This is a valuable perspective.",
      "I appreciate your thoughtful analysis."
    ],
    friendly: [
      "Thanks for sharing this!",
      "This really resonates with me!",
      "Great point you've made here!"
    ],
    witty: [
      "Absolutely brilliant!",
      "You've nailed it perfectly!",
      "Couldn't agree more with this!"
    ],
    supportive: [
      "I'm here for this!",
      "You've got a great point!",
      "Really appreciate you sharing this!"
    ]
  };
  
  return defaultReplies[defaultTone] || defaultReplies.friendly;
}

function insertReplyText(text) {
  // Find the reply text area and insert the suggestion
  const replyTextarea = document.querySelector('[data-testid="tweetTextarea_0"]') ||
                       document.querySelector('div[contenteditable="true"]');
  
  if (replyTextarea) {
    if (replyTextarea.tagName === 'TEXTAREA') {
      replyTextarea.value = text;
      replyTextarea.focus();
    } else {
      replyTextarea.textContent = text;
      replyTextarea.focus();
    }
    
    // Trigger input event to notify Twitter
    const event = new Event('input', { bubbles: true });
    replyTextarea.dispatchEvent(event);
  }
}