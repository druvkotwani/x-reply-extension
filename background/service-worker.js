// Background service worker for X Reply Extension
// Uses semantic search with embeddings (like Claude Projects)

// Import utilities
importScripts('../utils/config.js');
importScripts('../utils/openai-embeddings.js');
importScripts('../utils/supabase-client.js');

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('X Reply Extension installed');
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'generateReplies':
      generateAIReplies(request.data)
        .then(response => sendResponse({ success: true, data: response }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'generateCustomReply':
      generateCustomReply(request.data)
        .then(response => sendResponse({ success: true, data: response }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'uploadTweets':
      uploadTweetsWithEmbeddings(request.data)
        .then(response => sendResponse({ success: true, data: response }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'getTweetCount':
      supabaseClient.getTweetCount(request.data?.userId)
        .then(count => sendResponse({ success: true, data: count }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'deleteTweets':
      supabaseClient.deleteUserTweets(request.data?.userId)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'analyzeStyleProfile':
      analyzeStyleProfile(request.data)
        .then(response => sendResponse({ success: true, data: response }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'getStyleProfile':
      supabaseClient.getStyleProfile(request.data?.userId, request.data?.profileId)
        .then(profile => sendResponse({ success: true, data: profile }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'getAllStyleProfiles':
      supabaseClient.getAllStyleProfiles(request.data?.userId)
        .then(profiles => sendResponse({ success: true, data: profiles }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'setActiveStyleProfile':
      chrome.storage.sync.set({ activeStyleProfileId: request.data.profileId })
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'saveCopiedReply':
      saveCopiedReply(request.data)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'getAllUsernames':
      supabaseClient.getAllUsernames()
        .then(usernames => sendResponse({ success: true, data: usernames }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'deleteUserData':
      deleteUserData(request.data.username)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
  }
});

// Delete all data for a specific username (tweets + style profiles)
async function deleteUserData(username) {
  await supabaseClient.deleteUserTweetsByUsername(username);
  await supabaseClient.deleteStyleProfilesByUsername(username);
  return true;
}

// Save a copied reply to database with embedding (for learning)
async function saveCopiedReply(data) {
  const { reply } = data;

  if (!reply || reply.length < 5) {
    console.log('Reply too short to save');
    return;
  }

  try {
    // Get selected tweet source from storage
    const storage = await chrome.storage.sync.get(['selectedTweetSource']);
    const selectedTweetSource = storage.selectedTweetSource;

    if (!selectedTweetSource) {
      console.log('No tweet source selected, skipping save');
      return;
    }

    console.log(`Saving copied reply to @${selectedTweetSource}'s tweets...`);

    // Generate embedding for the reply
    const embedding = await openaiEmbeddings.getEmbedding(reply);

    // Save to Supabase with the selected user
    await supabaseClient.insertTweet(reply, embedding, selectedTweetSource);

    console.log('Reply saved successfully!');
  } catch (error) {
    console.error('Failed to save reply:', error);
    throw error;
  }
}

// Upload tweets with embeddings to Supabase
async function uploadTweetsWithEmbeddings(data) {
  const { tweets, userId } = data;

  console.log(`Starting upload of ${tweets.length} tweets...`);

  try {
    // Step 1: Generate embeddings in batches
    console.log('Step 1: Generating embeddings...');
    const tweetsWithEmbeddings = await openaiEmbeddings.processTweetsWithEmbeddings(tweets);
    console.log(`Generated ${tweetsWithEmbeddings.length} embeddings`);

    // Step 2: Upload to Supabase in smaller batches (50 at a time to avoid timeouts)
    console.log('Step 2: Uploading to Supabase...');
    const batchSize = 50;
    let uploaded = 0;

    for (let i = 0; i < tweetsWithEmbeddings.length; i += batchSize) {
      const batch = tweetsWithEmbeddings.slice(i, i + batchSize);
      console.log(`Uploading batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(tweetsWithEmbeddings.length/batchSize)}...`);

      await supabaseClient.insertTweetsBatch(batch, userId);
      uploaded += batch.length;
    }

    console.log(`Successfully uploaded ${uploaded} tweets to Supabase`);
    return { count: uploaded };

  } catch (error) {
    console.error('Upload failed at step:', error);
    throw error;
  }
}

// Analyze tweets and create style profile
async function analyzeStyleProfile(data) {
  const { userId } = data || {};

  console.log('Starting style profile analysis...');

  try {
    // Get all tweets
    const tweets = await supabaseClient.getAllTweetContents(userId, 1000);

    if (!tweets || tweets.length === 0) {
      throw new Error('No tweets found to analyze.');
    }

    console.log(`Total tweets available: ${tweets.length}`);

    // Get API key
    let apiKey = CONFIG.OPENROUTER_API_KEY;
    if (!apiKey) {
      const result = await chrome.storage.sync.get(['openrouterApiKey']);
      apiKey = result.openrouterApiKey;
    }

    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    // Use first 200 tweets (oldest/original) for style analysis
    const sampleTweets = tweets.slice(0, 200);

    console.log(`Analyzing ${sampleTweets.length} original tweets...`);

    const analysisPrompt = `Analyze these ${sampleTweets.length} tweets and create a detailed writing style profile. Extract patterns, not just observations.

TWEETS:
${sampleTweets.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

---

Create a comprehensive style profile in this exact JSON format:
{
  "tone": {
    "primary": "main tone (e.g., sarcastic, direct, friendly)",
    "secondary": "secondary tone",
    "formality": "casual/formal/mixed"
  },
  "sentence_structure": {
    "avg_length": "short/medium/long",
    "style": "description of sentence patterns",
    "fragments": true/false
  },
  "vocabulary": {
    "common_words": ["list", "of", "frequently", "used", "words"],
    "slang": ["any", "slang", "terms"],
    "filler_words": ["like", "actually", "etc"],
    "technical_level": "low/medium/high"
  },
  "punctuation": {
    "periods": "always/sometimes/rarely",
    "exclamations": "frequency",
    "ellipsis": "usage pattern",
    "capitalization": "normal/lowercase/mixed"
  },
  "emoji_usage": {
    "frequency": "never/rare/moderate/frequent",
    "common_emojis": ["list", "if", "any"]
  },
  "engagement_patterns": {
    "how_they_agree": "typical agreement phrase/pattern",
    "how_they_disagree": "typical disagreement pattern",
    "how_they_joke": "humor style",
    "how_they_add_insight": "pattern for adding thoughts"
  },
  "topics": ["main", "topics", "they", "discuss"],
  "unique_phrases": ["any", "signature", "phrases"],
  "personality_traits": ["inferred", "traits"],
  "writing_rules": [
    "Rule 1: specific rule like 'Never capitalize I'",
    "Rule 2: another pattern",
    "Rule 3: etc"
  ]
}

Return ONLY valid JSON, no markdown or explanation.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'chrome-extension://x-reply-extension',
        'X-Title': 'X Reply Extension'
      },
      body: JSON.stringify({
        model: CONFIG.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Style analysis failed');
    }

    const result = await response.json();
    let profileContent = result.choices[0].message.content.trim();

    // Parse JSON from response
    if (profileContent.includes('```json')) {
      const match = profileContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) profileContent = match[1];
    } else if (profileContent.includes('```')) {
      const match = profileContent.match(/```\s*([\s\S]*?)\s*```/);
      if (match) profileContent = match[1];
    }

    const profile = JSON.parse(profileContent.trim());

    // Save to Supabase
    await supabaseClient.saveStyleProfile(profile, tweets.length, userId);

    console.log('Style profile created and saved!');
    return { profile, tweetCount: tweets.length };

  } catch (error) {
    console.error('Style analysis failed:', error);
    throw error;
  }
}

// Generate AI replies using style profile + semantic search
async function generateAIReplies(data) {
  const { originalTweet, thread, isThread } = data;

  try {
    // Get selected tweet source and style profile from storage
    const storage = await chrome.storage.sync.get(['selectedTweetSource', 'activeStyleProfileId']);
    const selectedTweetSource = storage.selectedTweetSource;
    const activeProfileId = storage.activeStyleProfileId;

    // Check if user has tweets for the selected source
    if (!selectedTweetSource) {
      throw new Error('No tweet source selected. Please select a user in extension settings.');
    }

    const tweetCount = await supabaseClient.getTweetCount(selectedTweetSource);
    if (tweetCount === 0) {
      throw new Error(`No tweets found for @${selectedTweetSource}. Please upload tweets first.`);
    }

    // 1. Get style profile (if exists) - use active profile if set
    const styleProfileData = activeProfileId
      ? await supabaseClient.getStyleProfile(null, activeProfileId)
      : null;
    const styleProfile = styleProfileData?.profile;

    // 2. Generate embedding for the tweet being replied to
    const queryEmbedding = await openaiEmbeddings.getEmbedding(originalTweet);

    // 3. Semantic search for similar tweets from selected user (fewer needed if we have style profile)
    const numTweets = styleProfile ? 10 : 25;
    const similarTweets = await supabaseClient.searchSimilarTweets(queryEmbedding, numTweets, selectedTweetSource);

    if (!similarTweets || similarTweets.length === 0) {
      throw new Error(`Could not find relevant tweets for @${selectedTweetSource}.`);
    }

    // 4. Generate replies using Claude via OpenRouter (with thread context if available)
    const replies = await callOpenRouterWithProfile(
      originalTweet,
      similarTweets.map(t => t.content),
      styleProfile,
      isThread ? thread : null
    );

    return replies;

  } catch (error) {
    console.error('AI reply generation failed:', error);
    throw error;
  }
}

// Call OpenRouter API (Claude) for reply generation
async function callOpenRouter(originalTweet, tweetExamples) {
  // Get API key from storage or config
  let apiKey = CONFIG.OPENROUTER_API_KEY;

  if (!apiKey) {
    const result = await chrome.storage.sync.get(['openrouterApiKey']);
    apiKey = result.openrouterApiKey;
  }

  if (!apiKey) {
    throw new Error('OpenRouter API key not configured. Please add it in settings.');
  }

  const systemPrompt = `You are an expert at mimicking writing styles on Twitter/X. You study how a person writes and generate replies that sound EXACTLY like them.

Study these example tweets carefully - notice:
- Word choices, slang, vocabulary
- Sentence structure and length
- Punctuation, capitalization, emoji usage
- Tone (sarcastic, sincere, funny, direct, etc.)
- How they engage with different topics

Your replies must be indistinguishable from their actual tweets.`;

  const userPrompt = `Here are ${tweetExamples.length} example tweets showing how this person writes:

${tweetExamples.map((tweet, i) => `${i + 1}. "${tweet}"`).join('\n')}

---

Generate 4-5 different reply options to this tweet:

"${originalTweet}"

Requirements:
- Each reply must match the person's EXACT writing style from the examples
- Each option should have a different angle/approach (e.g., agreeing, challenging, adding insight, being playful, being direct)
- Keep the length similar to their typical tweets
- Be contextually appropriate

Return as JSON in this exact format:
{
  "replies": [
    {
      "label": "Agreeing, adding insight",
      "text": "The actual reply text here"
    },
    {
      "label": "More direct/challenging",
      "text": "Another reply option"
    },
    {
      "label": "Playful/witty",
      "text": "Third reply option"
    },
    {
      "label": "Builder perspective",
      "text": "Fourth reply option"
    },
    {
      "label": "Short and punchy",
      "text": "Fifth reply option"
    }
  ]
}

Return ONLY the JSON, no other text.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'chrome-extension://x-reply-extension',
      'X-Title': 'X Reply Extension'
    },
    body: JSON.stringify({
      model: CONFIG.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenRouter API call failed');
  }

  const data = await response.json();
  return parseReplyResponse(data.choices[0].message.content);
}

// Call OpenRouter with style profile
async function callOpenRouterWithProfile(originalTweet, tweetExamples, styleProfile, thread = null) {
  let apiKey = CONFIG.OPENROUTER_API_KEY;
  if (!apiKey) {
    const result = await chrome.storage.sync.get(['openrouterApiKey']);
    apiKey = result.openrouterApiKey;
  }

  if (!apiKey) {
    throw new Error('OpenRouter API key not configured.');
  }

  // Build system prompt based on whether we have a style profile
  let systemPrompt;

  if (styleProfile) {
    // Use style profile for better consistency
    systemPrompt = `You write Twitter replies in this person's style. Here's their writing DNA:

TONE: ${styleProfile.tone?.primary || 'direct'}, ${styleProfile.tone?.secondary || ''} (${styleProfile.tone?.formality || 'casual'})

SENTENCE STYLE: ${styleProfile.sentence_structure?.style || 'varies'}
- Length: ${styleProfile.sentence_structure?.avg_length || 'medium'}
- Uses fragments: ${styleProfile.sentence_structure?.fragments ? 'yes' : 'no'}

VOCABULARY:
- Common words: ${styleProfile.vocabulary?.common_words?.join(', ') || 'none identified'}
- Slang (use sparingly, max 1 per reply): ${styleProfile.vocabulary?.slang?.join(', ') || 'none'}
- Technical level: ${styleProfile.vocabulary?.technical_level || 'medium'}

PUNCTUATION:
- Periods: ${styleProfile.punctuation?.periods || 'normal'}
- Capitalization: ${styleProfile.punctuation?.capitalization || 'normal'}

EMOJIS: ${styleProfile.emoji_usage?.frequency || 'rare'}${styleProfile.emoji_usage?.common_emojis?.length > 0 ? ` (uses: ${styleProfile.emoji_usage.common_emojis.join(' ')})` : ''}

ENGAGEMENT PATTERNS:
- Agreement: ${styleProfile.engagement_patterns?.how_they_agree || 'varies'}
- Disagreement: ${styleProfile.engagement_patterns?.how_they_disagree || 'varies'}
- Humor: ${styleProfile.engagement_patterns?.how_they_joke || 'varies'}

SIGNATURE PHRASES (use max 1 across ALL replies, not in every reply): ${styleProfile.unique_phrases?.join(', ') || 'none'}

KEY RULES (pick 2-3 relevant ones per reply, not all):
${styleProfile.writing_rules?.slice(0, 10).map(r => `- ${r}`).join('\n') || '- Follow the patterns above'}

IMPORTANT:
- Each reply must be UNIQUE and DIFFERENT from the others
- Do NOT copy phrases directly from the example tweets
- Be CREATIVE while matching the overall vibe/tone
- Vary your sentence starters across replies`;
  } else {
    // Fallback to original prompt without profile
    systemPrompt = `You are an expert at mimicking writing styles on Twitter/X. Study the example tweets carefully and generate replies that sound EXACTLY like the person wrote them.`;
  }

  // Build thread context if available
  let threadContext = '';
  if (thread && thread.length > 1) {
    threadContext = `
CONVERSATION THREAD (you're replying to the last message):
${thread.map((t, i) => `${i + 1}. ${t.handle || t.author}: "${t.text}"`).join('\n')}

---

`;
  }

  const userPrompt = `Reference examples for tone/style (don't copy these):
${tweetExamples.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

---

${threadContext}${thread && thread.length > 1 ? 'Reply to the LAST message in the thread above' : `Tweet to reply to:
"${originalTweet}"`}

Generate 5 DIFFERENT reply options. Each must:
- Have a completely different angle and approach
- NOT reuse phrases from the examples above
- Sound natural for this specific tweet context
- Match the overall tone/vibe (not exact phrases)
${thread && thread.length > 1 ? '- Be contextually aware of the FULL conversation thread\n- Can reference earlier points in the thread' : ''}

LENGTH IS CONTEXTUAL - decide based on the tweet:
- Simple tweet = short reply (1-3 sentences)
- Complex topic = can be longer if needed
- Dumb question = keep it short, just the question
- Ragebait = punchy, not essays
- Don't make everything long. Short replies often hit harder.

Reply types needed:
1. Agreeing/adding insight
2. Challenging/contrarian take
3. Dumb question (short, seemingly stupid but thought-provoking question)
4. Thoughtful perspective (can be longer if topic warrants it)
5. Ragebait (punchy controversial hot take, not an essay)

Return JSON only:
{
  "replies": [
    {"label": "Agreeing", "text": "..."},
    {"label": "Contrarian", "text": "..."},
    {"label": "Dumb question", "text": "..."},
    {"label": "Thoughtful", "text": "..."},
    {"label": "Ragebait", "text": "..."}
  ]
}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'chrome-extension://x-reply-extension',
      'X-Title': 'X Reply Extension'
    },
    body: JSON.stringify({
      model: CONFIG.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenRouter API call failed');
  }

  const data = await response.json();
  return parseReplyResponse(data.choices[0].message.content);
}

// Parse the reply response
function parseReplyResponse(content) {
  const trimmed = content.trim();
  let jsonContent = trimmed;

  // Remove markdown code blocks if present
  if (trimmed.includes('```json')) {
    const match = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) jsonContent = match[1];
  } else if (trimmed.includes('```')) {
    const match = trimmed.match(/```\s*([\s\S]*?)\s*```/);
    if (match) jsonContent = match[1];
  }

  try {
    const parsed = JSON.parse(jsonContent.trim());

    if (parsed.replies && Array.isArray(parsed.replies)) {
      return parsed.replies;
    }

    // Handle if it's just an array
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse reply response:', content);
  }

  // Fallback with labeled format
  return [
    { label: 'Friendly', text: 'Thanks for sharing this perspective!' },
    { label: 'Thoughtful', text: 'This is an interesting point to consider.' },
    { label: 'Engaging', text: 'I\'d love to hear more about your thoughts on this.' },
    { label: 'Direct', text: 'Solid take.' }
  ];
}

// Generate custom reply with semantic context
async function generateCustomReply(data) {
  const { originalTweet, customPrompt } = data;

  try {
    let apiKey = CONFIG.OPENROUTER_API_KEY;
    if (!apiKey) {
      const result = await chrome.storage.sync.get(['openrouterApiKey']);
      apiKey = result.openrouterApiKey;
    }

    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    // Get selected tweet source from storage
    const storageData = await chrome.storage.sync.get(['selectedTweetSource']);
    const selectedTweetSource = storageData.selectedTweetSource;

    // Get semantic context if available
    let contextPrompt = '';
    try {
      if (selectedTweetSource) {
        const tweetCount = await supabaseClient.getTweetCount(selectedTweetSource);
        if (tweetCount > 0) {
          const queryEmbedding = await openaiEmbeddings.getEmbedding(originalTweet + ' ' + customPrompt);
          const similarTweets = await supabaseClient.searchSimilarTweets(queryEmbedding, 15, selectedTweetSource);

          if (similarTweets && similarTweets.length > 0) {
            contextPrompt = `\n\nHere are examples of how this person writes:\n${similarTweets.slice(0, 10).map((t, i) => `${i + 1}. "${t.content}"`).join('\n')}\n\nMatch their exact writing style.`;
          }
        }
      }
    } catch (e) {
      console.log('Could not get context for custom reply:', e);
    }

    const systemPrompt = contextPrompt
      ? `You mimic writing styles perfectly. ${contextPrompt}`
      : 'You generate engaging Twitter replies.';

    const userPrompt = `Tweet to reply to: "${originalTweet}"

User's instruction: "${customPrompt}"

Generate a single reply that follows the instruction${contextPrompt ? ' and matches the writing style from examples' : ''}.

Return ONLY the reply text, nothing else.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'chrome-extension://x-reply-extension',
        'X-Title': 'X Reply Extension'
      },
      body: JSON.stringify({
        model: CONFIG.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenRouter API call failed');
    }

    const responseData = await response.json();
    return responseData.choices[0].message.content.trim().replace(/^["']|["']$/g, '');

  } catch (error) {
    console.error('Custom reply failed:', error);
    throw error;
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.url?.includes('twitter.com') || tab.url?.includes('x.com')) {
    console.log('Extension active on Twitter/X');
  } else {
    chrome.tabs.create({ url: 'popup/popup.html' });
  }
});
