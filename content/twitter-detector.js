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

// Run periodically to catch dynamic content
setInterval(addAIReplyButtons, 2000);

function addAIReplyButtons() {
  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.id) {
    // Stop the observer if context is invalidated
    observer.disconnect();
    return;
  }

  // Find all toolbars with Reply buttons
  const toolbars = document.querySelectorAll('[data-testid="toolBar"]');

  toolbars.forEach((toolbar) => {
    // Skip if we already added a button to this toolbar
    if (toolbar.querySelector('.ai-reply-button')) {
      return;
    }

    // Find the Reply button
    const replyButton = toolbar.querySelector('button[data-testid="tweetButtonInline"]');
    if (!replyButton) {
      return;
    }

    // Verify it's a Reply button (not Post/Tweet)
    const buttonText = replyButton.textContent.trim().toLowerCase();
    if (buttonText !== 'reply') {
      return;
    }

    addAIReplyButton(replyButton, toolbar);
  });
}

function addAIReplyButton(replyButton, toolbar) {
  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.id) {
    console.log('Extension context invalidated, skipping button injection');
    return;
  }

  // Create AI reply button
  const aiButton = document.createElement('button');
  aiButton.className = 'ai-reply-button';
  aiButton.type = 'button';

  // Use the extension icon
  const iconUrl = chrome.runtime.getURL('assets/icons/icon16.png');
  aiButton.innerHTML = `
    <img src="${iconUrl}" width="16" height="16" alt="AI Reply">
  `;

  // Terminal dark theme styling
  aiButton.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 12px;
    padding: 0;
    width: 36px;
    height: 36px;
    background: #1a1a24;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 9999;
    position: relative;
    flex-shrink: 0;
  `;

  // Hover effects - shiny gradient
  aiButton.addEventListener('mouseenter', () => {
    aiButton.style.background = 'linear-gradient(135deg, #3a3a4a 0%, #2a2a3a 50%, #4a4a5a 100%)';
    aiButton.style.borderColor = 'rgba(255, 255, 255, 0.25)';
    aiButton.style.boxShadow = '0 0 12px rgba(255, 255, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
  });

  aiButton.addEventListener('mouseleave', () => {
    aiButton.style.background = '#1a1a24';
    aiButton.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    aiButton.style.boxShadow = 'none';
  });

  // Click handler
  aiButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showAIReplyPopup(replyButton);
  });

  // Insert the button next to the Reply button
  const replyButtonContainer = replyButton.parentElement;
  if (replyButtonContainer) {
    replyButtonContainer.style.display = 'flex';
    replyButtonContainer.style.alignItems = 'center';
    replyButtonContainer.appendChild(aiButton);
  }

  // Mark that we've added the button
  aiReplyButtons.add(aiButton);
  console.log('AI Reply button added to toolbar');
}

// Extract full conversation thread from the page
function extractConversationThread() {
  const thread = [];

  // Find all tweet articles in the conversation
  const tweetArticles = document.querySelectorAll('article[data-testid="tweet"]');

  tweetArticles.forEach((article) => {
    // Get author name
    const authorElement = article.querySelector('[data-testid="User-Name"]');
    let author = 'Unknown';
    let handle = '';

    if (authorElement) {
      // Get display name
      const nameSpan = authorElement.querySelector('span');
      if (nameSpan) {
        author = nameSpan.textContent.trim();
      }
      // Get handle (@username)
      const handleLink = authorElement.querySelector('a[href*="/"]');
      if (handleLink) {
        const href = handleLink.getAttribute('href');
        handle = href ? '@' + href.split('/').pop() : '';
      }
    }

    // Get tweet text
    const tweetTextElement = article.querySelector('[data-testid="tweetText"]');
    const tweetText = tweetTextElement ? tweetTextElement.textContent.trim() : '';

    if (tweetText) {
      thread.push({
        author: author,
        handle: handle,
        text: tweetText
      });
    }
  });

  // Determine if this is a real thread/conversation or just a main tweet with replies
  // A real thread has back-and-forth conversation (at least 2 tweets with different authors talking to each other)
  // OR the same author continuing their own thread

  let isRealThread = false;

  if (thread.length > 1) {
    // Check if it's a conversation (multiple people talking) or just main tweet + random replies
    // Look for the "Replying to" indicator which appears above the reply composer
    const replyingToElement = document.querySelector('[data-testid="reply"]') ||
                              document.querySelector('div[dir="ltr"]:has(> a[href*="/"])');

    // Check if tweets form a chain (each replies to the previous)
    // In a single tweet view, the main tweet is first, then unrelated replies below the composer
    // In a thread view, tweets are connected and appear above the composer

    // Simple heuristic: if first tweet and second tweet share context (one replies to another),
    // OR if we're viewing a reply (URL contains /status/ and there's content before the main tweet)

    // For now, check if the tweets appear BEFORE the reply composer (thread) vs AFTER (just replies to main)
    const replyComposer = document.querySelector('[data-testid="tweetTextarea_0"]');

    if (replyComposer) {
      // Get tweets that appear BEFORE the reply composer (these form the thread)
      const threadTweets = [];

      for (const article of tweetArticles) {
        // Check if this article comes before the reply composer in the DOM
        const comparison = article.compareDocumentPosition(replyComposer);
        if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
          // Article is before composer - part of the thread
          const tweetTextElement = article.querySelector('[data-testid="tweetText"]');
          const authorElement = article.querySelector('[data-testid="User-Name"]');

          if (tweetTextElement) {
            let handle = '';
            if (authorElement) {
              const handleLink = authorElement.querySelector('a[href*="/"]');
              if (handleLink) {
                const href = handleLink.getAttribute('href');
                handle = href ? '@' + href.split('/').pop() : '';
              }
            }

            threadTweets.push({
              author: authorElement?.querySelector('span')?.textContent?.trim() || 'Unknown',
              handle: handle,
              text: tweetTextElement.textContent.trim()
            });
          }
        }
      }

      // If there's more than one tweet before the composer, it's a thread
      if (threadTweets.length > 1) {
        isRealThread = true;
        // Return only the thread tweets, not the replies below
        return {
          thread: threadTweets,
          lastTweet: threadTweets[threadTweets.length - 1].text,
          isThread: true
        };
      }
    }
  }

  // Return single tweet (not a thread)
  const mainTweet = thread.length > 0 ? thread[0] : { author: '', handle: '', text: '' };
  return {
    thread: [mainTweet],
    lastTweet: mainTweet.text,
    isThread: false
  };
}

function showAIReplyPopup(replyButton) {
  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.id) {
    alert('Extension was updated. Please refresh the page.');
    return;
  }

  // Inject Geist Mono font if not already present
  if (!document.querySelector('link[href*="Geist+Mono"]')) {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(fontLink);
  }

  // Remove any existing popup
  const existingPopup = document.querySelector('.ai-reply-popup');
  if (existingPopup) {
    existingPopup.remove();
  }

  // Extract the full conversation thread
  const threadData = extractConversationThread();
  const tweetText = threadData.lastTweet; // The tweet being replied to

  // Build thread HTML for display
  let threadHTML = '';
  if (threadData.isThread && threadData.thread.length > 1) {
    threadHTML = `
      <div class="thread-context">
        <strong>Conversation Thread (${threadData.thread.length} tweets)</strong>
        <div class="thread-list">
          ${threadData.thread.map((t, i) => `
            <div class="thread-item ${i === threadData.thread.length - 1 ? 'replying-to' : ''}">
              <span class="thread-author">${t.handle || t.author}</span>
              <p class="thread-text">${t.text.substring(0, 150)}${t.text.length > 150 ? '...' : ''}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    threadHTML = `
      <div class="tweet-context">
        <strong>Replying to</strong>
        <p>${tweetText || 'Could not extract tweet text.'}</p>
      </div>
    `;
  }

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'ai-reply-popup';
  popup.innerHTML = `
    <div class="ai-popup-overlay"></div>
    <div class="ai-popup-content">
      <div class="ai-popup-header">
        <h3>AI Reply</h3>
        <button class="ai-popup-close">&times;</button>
      </div>
      <div class="ai-popup-body">
        ${threadHTML}
        <div class="ai-suggestions">
          <h4>Suggested Replies</h4>
          <div class="ai-loading">
            <div class="ai-loading-spinner"></div>
            <span class="ai-loading-text">Generating replies...</span>
          </div>
        </div>
        <div class="manual-input">
          <h4>Custom Request</h4>
          <textarea placeholder="Describe how you want to reply..." id="custom-prompt"></textarea>
          <button class="generate-custom">Generate Custom Reply</button>
          <div class="custom-result" style="margin-top: 12px; display: none;">
            <h4>Custom Reply</h4>
            <div class="custom-reply-text"></div>
            <button class="copy-custom-reply">Copy</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Close popup handlers
  popup.querySelector('.ai-popup-close').addEventListener('click', () => popup.remove());
  popup.querySelector('.ai-popup-overlay').addEventListener('click', () => popup.remove());

  // Close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      popup.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

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
            copyCustomBtn.textContent = 'Copied!';

            // Show "Add to Tweets" button if not already shown
            if (!customResult.querySelector('.add-to-tweets-custom')) {
              const addButton = document.createElement('button');
              addButton.className = 'add-to-tweets-custom';
              addButton.textContent = 'Add to Tweets';
              addButton.style.cssText = `
                margin-left: 8px;
                padding: 6px 12px;
                background: transparent;
                border: 1px solid #4ade80;
                color: #4ade80;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                font-family: 'Geist Mono', monospace;
                transition: all 0.2s ease;
              `;

              addButton.addEventListener('mouseenter', () => {
                addButton.style.background = '#4ade80';
                addButton.style.color = '#0d0d14';
              });

              addButton.addEventListener('mouseleave', () => {
                addButton.style.background = 'transparent';
                addButton.style.color = '#4ade80';
              });

              addButton.addEventListener('click', async () => {
                addButton.textContent = 'Saving...';
                addButton.disabled = true;

                try {
                  await chrome.runtime.sendMessage({
                    action: 'saveCopiedReply',
                    data: { reply: response.data }
                  });
                  addButton.textContent = 'Added!';
                  addButton.style.background = '#4ade80';
                  addButton.style.color = '#0d0d14';
                  console.log('Custom reply saved to database for learning');
                } catch (error) {
                  console.log('Failed to save custom reply:', error);
                  addButton.textContent = 'Failed';
                  addButton.style.borderColor = '#ef4444';
                  addButton.style.color = '#ef4444';
                }
              });

              copyCustomBtn.parentNode.appendChild(addButton);
            }

            setTimeout(() => {
              copyCustomBtn.textContent = 'Copy';
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

  // Generate initial suggestions with thread context
  generateReplySuggestions(tweetText, popup, threadData);
}

async function generateReplySuggestions(tweetText, popup, threadData = null) {
  const suggestionsContainer = popup.querySelector('.ai-suggestions');

  try {
    // Build request data with thread context if available
    const requestData = {
      originalTweet: tweetText
    };

    // Add thread context if it's a conversation
    if (threadData && threadData.isThread && threadData.thread.length > 1) {
      requestData.thread = threadData.thread;
      requestData.isThread = true;
    }

    // Send to service worker
    const response = await chrome.runtime.sendMessage({
      action: 'generateReplies',
      data: requestData
    });

    if (response.success) {
      displaySuggestions(response.data, popup, tweetText);
    } else {
      throw new Error(response.error);
    }

  } catch (error) {
    console.error('Failed to generate replies:', error);

    const errorMessage = error.message.includes('No tweet profile')
      ? 'Upload your tweets first in the extension settings.'
      : error.message.includes('API key')
        ? 'Add your API key in the extension settings.'
        : error.message;

    suggestionsContainer.innerHTML = `
      <h4>Suggested Replies</h4>
      <p style="color: #ef4444; font-size: 12px;">${errorMessage}</p>
      <p style="font-size: 11px; color: #6b7280; margin-top: 8px;">
        Click the extension icon to configure.
      </p>
    `;
  }
}

// Display suggestions in the popup
function displaySuggestions(suggestions, popup, tweetText) {
  const suggestionsContainer = popup.querySelector('.ai-suggestions');
  suggestionsContainer.innerHTML = '<h4>Suggested Replies</h4>';

  suggestions.forEach((suggestion, index) => {
    const suggestionDiv = document.createElement('div');
    suggestionDiv.className = 'suggestion-item';

    // Handle both new format (object with label/text) and old format (string)
    const label = suggestion.label || `Option ${index + 1}`;
    const text = suggestion.text || suggestion;

    suggestionDiv.innerHTML = `
      <div class="suggestion-label">Option ${index + 1} (${label}):</div>
      <p class="suggestion-text">${text}</p>
      <button class="copy-suggestion" data-suggestion="${text.replace(/"/g, '&quot;')}">Copy</button>
    `;
    suggestionsContainer.appendChild(suggestionDiv);
  });

  // Add click handlers for copy buttons
  popup.querySelectorAll('.copy-suggestion').forEach(button => {
    button.addEventListener('click', async (e) => {
      const suggestionItem = e.target.closest('.suggestion-item');
      const suggestion = e.target.dataset.suggestion;

      try {
        // Copy to clipboard
        await navigator.clipboard.writeText(suggestion);

        // Visual feedback
        e.target.textContent = 'Copied!';

        // Show "Add to Tweets" button if not already shown
        if (!suggestionItem.querySelector('.add-to-tweets')) {
          const addButton = document.createElement('button');
          addButton.className = 'add-to-tweets';
          addButton.textContent = 'Add to Tweets';
          addButton.style.cssText = `
            margin-left: 8px;
            padding: 6px 12px;
            background: transparent;
            border: 1px solid #4ade80;
            color: #4ade80;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            font-family: 'Geist Mono', monospace;
            transition: all 0.2s ease;
          `;

          addButton.addEventListener('mouseenter', () => {
            addButton.style.background = '#4ade80';
            addButton.style.color = '#0d0d14';
          });

          addButton.addEventListener('mouseleave', () => {
            addButton.style.background = 'transparent';
            addButton.style.color = '#4ade80';
          });

          addButton.addEventListener('click', async () => {
            addButton.textContent = 'Saving...';
            addButton.disabled = true;

            try {
              await chrome.runtime.sendMessage({
                action: 'saveCopiedReply',
                data: { reply: suggestion }
              });
              addButton.textContent = 'Added!';
              addButton.style.borderColor = '#4ade80';
              addButton.style.background = '#4ade80';
              addButton.style.color = '#0d0d14';
              console.log('Reply saved to database for learning');
            } catch (saveError) {
              console.log('Could not save reply:', saveError);
              addButton.textContent = 'Failed';
              addButton.style.borderColor = '#ef4444';
              addButton.style.color = '#ef4444';
            }
          });

          e.target.parentNode.appendChild(addButton);
        }

        // Reset copy button after 2 seconds
        setTimeout(() => {
          e.target.textContent = 'Copy';
        }, 2000);

      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    });
  });
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
