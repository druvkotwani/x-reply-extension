// Background service worker for X Reply Extension

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('X Reply Extension installed');
    // Set default settings
    chrome.storage.sync.set({
      toneProfiles: [],
      defaultTone: 'friendly',
      aiProvider: 'openai'
    });
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'generateReplies':
      generateAIReplies(request.data)
        .then(response => sendResponse({ success: true, data: response }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response

    case 'getToneProfile':
      getToneProfile()
        .then(profile => sendResponse({ success: true, data: profile }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'saveReply':
      saveReplyToHistory(request.data)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'generateCustomReply':
      generateCustomReply(request.data)
        .then(response => sendResponse({ success: true, data: response }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
  }
});

// All AI and Supabase functionality is inlined below to avoid import issues

// Generate AI replies using stored tone profile
async function generateAIReplies(data) {
  const { originalTweet, toneProfile } = data;

  try {
    // Get recent reply history for context
    let replyHistory = [];
    try {
      replyHistory = await getReplyHistoryFromSupabase(5);
    } catch (error) {
      console.log('Could not fetch reply history:', error);
    }

    const replies = await callAIForReplies(originalTweet, toneProfile, replyHistory);
    return replies;
  } catch (error) {
    console.error('AI reply generation failed:', error);
    throw error;
  }
}

// Call AI API for reply generation
async function callAIForReplies(originalTweet, toneProfile, replyHistory = []) {
  // Get API settings
  const result = await chrome.storage.sync.get(['apiKey', 'aiProvider']);
  const apiKey = result.apiKey;
  const provider = result.aiProvider || 'openai';

  if (!apiKey) {
    throw new Error('API key not configured. Please add your API key in settings.');
  }

  const recentReplies = replyHistory.slice(-5);

  const prompt = `Generate 3 unique, contextual replies to this tweet using the user's writing style.

Original Tweet: "${originalTweet}"

User's Writing Style:
- Tone: ${toneProfile.writingStyle?.tone || 'friendly'}
- Personality: ${toneProfile.writingStyle?.personality || 'casual and friendly'}
- Vocabulary: ${toneProfile.writingStyle?.vocabulary || 'casual internet language'}
- Structure: ${toneProfile.writingStyle?.structure || 'short and direct'}
- Humor: ${toneProfile.writingStyle?.humor || 'light and positive'}
- Engagement: ${toneProfile.writingStyle?.engagement || 'supportive and encouraging'}

Example tweets in their style:
${(toneProfile.examples || []).map(ex => `- ${ex}`).join('\n')}

${recentReplies.length > 0 ? `Recent replies they've made:
${recentReplies.map(r => `- ${r.user_reply}`).join('\n')}` : ''}

Requirements:
- Match their exact tone and personality
- Be contextually appropriate to the original tweet
- Vary the responses (don't make them too similar)
- Keep the length similar to their typical style
- Use their vocabulary and humor style

Return ONLY a JSON array of 3 strings, no other text:
["reply1", "reply2", "reply3"]`;

  switch (provider) {
    case 'openai':
      return await callOpenAI(prompt, apiKey);
    case 'claude':
      return await callClaude(prompt, apiKey);
    case 'gemini':
      return await callGemini(prompt, apiKey);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

// OpenAI API call
async function callOpenAI(prompt, apiKey) {
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
          content: 'You are an expert at generating replies that match specific personalities. When asked to provide JSON, respond with ONLY the JSON array - no markdown, no explanations, no code blocks, just the pure JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API call failed');
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();

  // Extract JSON from markdown code blocks or other wrappers
  let jsonContent = content;

  // Remove markdown code blocks
  if (content.includes('```json')) {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }
  } else if (content.includes('```')) {
    const jsonMatch = content.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }
  } else {
    // Look for JSON array or object
    const arrayMatch = content.match(/\[\s*"[\s\S]*?\]/);
    const objectMatch = content.match(/\{\s*"[\s\S]*?\}/);

    if (arrayMatch) {
      jsonContent = arrayMatch[0];
    } else if (objectMatch) {
      jsonContent = objectMatch[0];
    }
  }

  try {
    return JSON.parse(jsonContent.trim());
  } catch (parseError) {
    console.error('Failed to parse OpenAI response:', content);
    console.error('Extracted content:', jsonContent);

    // Return fallback replies
    return [
      "That's an interesting perspective!",
      "Thanks for sharing this!",
      "Great point - I appreciate your thoughts on this."
    ];
  }
}

// Claude API call
async function callClaude(prompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
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

  // Extract JSON from markdown code blocks or other wrappers
  let jsonContent = content;

  // Remove markdown code blocks
  if (content.includes('```json')) {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }
  } else if (content.includes('```')) {
    const jsonMatch = content.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }
  } else {
    // Look for JSON array or object
    const arrayMatch = content.match(/\[\s*"[\s\S]*?\]/);
    const objectMatch = content.match(/\{\s*"[\s\S]*?\}/);

    if (arrayMatch) {
      jsonContent = arrayMatch[0];
    } else if (objectMatch) {
      jsonContent = objectMatch[0];
    }
  }

  try {
    return JSON.parse(jsonContent.trim());
  } catch (parseError) {
    console.error('Failed to parse Claude response:', content);
    console.error('Extracted content:', jsonContent);

    // Return fallback replies
    return [
      "That's an interesting perspective!",
      "Thanks for sharing this!",
      "Great point - I appreciate your thoughts on this."
    ];
  }
}

// Gemini API call
async function callGemini(prompt, apiKey) {
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
        maxOutputTokens: 500
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API call failed');
  }

  const data = await response.json();
  const content = data.candidates[0].content.parts[0].text.trim();

  // Extract JSON from markdown code blocks or other wrappers
  let jsonContent = content;

  // Remove markdown code blocks
  if (content.includes('```json')) {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }
  } else if (content.includes('```')) {
    const jsonMatch = content.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }
  } else {
    // Look for JSON array or object
    const arrayMatch = content.match(/\[\s*"[\s\S]*?\]/);
    const objectMatch = content.match(/\{\s*"[\s\S]*?\}/);

    if (arrayMatch) {
      jsonContent = arrayMatch[0];
    } else if (objectMatch) {
      jsonContent = objectMatch[0];
    }
  }

  try {
    return JSON.parse(jsonContent.trim());
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', content);
    console.error('Extracted content:', jsonContent);

    // Return fallback replies
    return [
      "That's an interesting perspective!",
      "Thanks for sharing this!",
      "Great point - I appreciate your thoughts on this."
    ];
  }
}

// Get tone profile from Supabase
async function getToneProfile() {
  try {
    const profile = await getToneProfileFromSupabase();
    return profile;
  } catch (error) {
    console.log('No tone profile found (this is normal if Supabase not configured):', error.message);
    return null; // Return null instead of throwing error
  }
}

// Save reply to history for learning
async function saveReplyToHistory(data) {
  const { originalTweet, userReply } = data;

  try {
    await saveReplyToSupabase(originalTweet, userReply);
  } catch (error) {
    console.error('Failed to save reply:', error);
    // Don't throw error - reply saving is optional
  }
}

// Generate custom reply based on user instruction
async function generateCustomReply(data) {
  const { originalTweet, customPrompt } = data;

  try {
    // Get tone profile for context
    let toneProfile = null;
    try {
      toneProfile = await getToneProfileFromSupabase();
    } catch (error) {
      console.log('No tone profile available for custom reply');
    }

    // Get API settings
    const result = await chrome.storage.sync.get(['apiKey', 'aiProvider']);
    const apiKey = result.apiKey;
    const provider = result.aiProvider || 'openai';

    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const prompt = `Generate a reply to this tweet based on the specific instruction, while maintaining the user's writing style if available.

Original Tweet: "${originalTweet}"
User Instruction: "${customPrompt}"

${toneProfile ? `User's Writing Style:
- Tone: ${toneProfile.writingStyle?.tone || 'friendly'}
- Personality: ${toneProfile.writingStyle?.personality || 'casual and friendly'}
- Vocabulary: ${toneProfile.writingStyle?.vocabulary || 'casual language'}` : 'No specific writing style available - use a friendly, engaging tone.'}

Create a reply that follows their instruction while staying true to their personality and writing style.

Return ONLY the reply text, no quotes or extra formatting.`;

    let customReply;
    switch (provider) {
      case 'openai':
        customReply = await callOpenAIForCustomReply(prompt, apiKey);
        break;
      case 'claude':
        customReply = await callClaudeForCustomReply(prompt, apiKey);
        break;
      case 'gemini':
        customReply = await callGeminiForCustomReply(prompt, apiKey);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    return customReply;
  } catch (error) {
    console.error('Custom reply generation failed:', error);
    throw error;
  }
}

// Custom reply AI calls (return plain text, not JSON)
async function callOpenAIForCustomReply(prompt, apiKey) {
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
          content: 'You are a helpful assistant that generates social media replies. Return only the reply text without quotes or formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API call failed');
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function callClaudeForCustomReply(prompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
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
  return data.content[0].text.trim();
}

async function callGeminiForCustomReply(prompt, apiKey) {
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
        maxOutputTokens: 200
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API call failed');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text.trim();
}

// Supabase functions
async function getSupabaseConfig() {
  const result = await chrome.storage.sync.get(['supabaseUrl', 'supabaseKey', 'userId']);

  if (!result.supabaseUrl || !result.supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  let userId = result.userId;
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    await chrome.storage.sync.set({ userId });
  }

  return {
    url: result.supabaseUrl,
    key: result.supabaseKey,
    userId: userId
  };
}

async function getToneProfileFromSupabase() {
  const { url, key, userId } = await getSupabaseConfig();

  const response = await fetch(
    `${url}/rest/v1/tone_profiles?user_id=eq.${userId}&order=created_at.desc&limit=1`,
    {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch tone profile from Supabase');
  }

  const data = await response.json();
  return data.length > 0 ? data[0].profile_data : null;
}

async function getReplyHistoryFromSupabase(limit = 5) {
  try {
    const { url, key, userId } = await getSupabaseConfig();

    const response = await fetch(
      `${url}/rest/v1/replies_history?user_id=eq.${userId}&order=timestamp.desc&limit=${limit}`,
      {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch reply history');
    }

    return await response.json();
  } catch (error) {
    console.error('Reply history fetch error:', error);
    return [];
  }
}

async function saveReplyToSupabase(originalTweet, userReply) {
  const { url, key, userId } = await getSupabaseConfig();

  const response = await fetch(`${url}/rest/v1/replies_history`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      user_id: userId,
      original_tweet: originalTweet,
      user_reply: userReply,
      timestamp: new Date().toISOString()
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to save reply: ${error}`);
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Open extension popup or settings page
  if (tab.url.includes('twitter.com') || tab.url.includes('x.com')) {
    // Extension will work through content script on Twitter
    console.log('Extension active on Twitter/X');
  } else {
    // Open settings page for other sites
    chrome.tabs.create({ url: 'popup/popup.html' });
  }
});