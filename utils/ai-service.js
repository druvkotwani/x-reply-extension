// AI Service for tone analysis and reply generation

class AIService {
  constructor() {
    this.apiKey = null;
    this.provider = 'openai'; // default to OpenAI
  }

  // Initialize with API key and provider
  async init() {
    const result = await chrome.storage.sync.get(['apiKey', 'aiProvider']);
    this.apiKey = result.apiKey;
    this.provider = result.aiProvider || 'openai';

    if (!this.apiKey) {
      throw new Error('API key not configured. Please add your API key in settings.');
    }
  }

  // Analyze tweets to create detailed tone profile
  async analyzeTweets(tweets) {
    await this.init();

    const prompt = `Analyze these ${tweets.length} tweets and create a detailed personality/tone profile for this user. 

Tweets:
${tweets.slice(0, 50).map((tweet, i) => `${i + 1}. ${tweet}`).join('\n')}

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

    try {
      const response = await this.callAI(prompt);
      return JSON.parse(response);
    } catch (error) {
      console.error('AI analysis failed:', error);
      throw new Error('Failed to analyze tweets. Please try again.');
    }
  }

  // Generate replies based on original tweet and tone profile
  async generateReplies(originalTweet, toneProfile, replyHistory = []) {
    await this.init();

    const recentReplies = replyHistory.slice(-5); // Last 5 replies for context

    const prompt = `Generate 3 unique, contextual replies to this tweet using the user's writing style.

Original Tweet: "${originalTweet}"

User's Writing Style:
- Tone: ${toneProfile.writingStyle.tone}
- Personality: ${toneProfile.writingStyle.personality}
- Vocabulary: ${toneProfile.writingStyle.vocabulary}
- Structure: ${toneProfile.writingStyle.structure}
- Humor: ${toneProfile.writingStyle.humor}
- Engagement: ${toneProfile.writingStyle.engagement}

Example tweets in their style:
${toneProfile.examples.map(ex => `- ${ex}`).join('\n')}

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

    try {
      const response = await this.callAI(prompt);
      return JSON.parse(response);
    } catch (error) {
      console.error('Reply generation failed:', error);
      throw new Error('Failed to generate replies. Please try again.');
    }
  }

  // Generate custom reply based on user instruction
  async generateCustomReply(originalTweet, instruction, toneProfile) {
    await this.init();

    const prompt = `Generate a reply to this tweet based on the specific instruction, while maintaining the user's writing style.

Original Tweet: "${originalTweet}"
User Instruction: "${instruction}"

User's Writing Style:
- Tone: ${toneProfile.writingStyle.tone}
- Personality: ${toneProfile.writingStyle.personality}
- Vocabulary: ${toneProfile.writingStyle.vocabulary}
- Structure: ${toneProfile.writingStyle.structure}

Create a reply that follows their instruction while staying true to their personality and writing style.

Return ONLY the reply text, no quotes or extra formatting.`;

    try {
      return await this.callAI(prompt);
    } catch (error) {
      console.error('Custom reply generation failed:', error);
      throw new Error('Failed to generate custom reply. Please try again.');
    }
  }

  // Make API call to AI provider
  async callAI(prompt) {
    switch (this.provider) {
      case 'openai':
        return await this.callOpenAI(prompt);
      case 'claude':
        return await this.callClaude(prompt);
      case 'gemini':
        return await this.callGemini(prompt);
      default:
        throw new Error(`Unsupported AI provider: ${this.provider}`);
    }
  }

  // OpenAI API call
  async callOpenAI(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cost-effective model
        messages: [
          {
            role: 'system',
            content: 'You are an AI writing assistant trained to generate tweets in the exact tone and style of a specific creator. You have access to a file containing ~2,000 of their real tweets — this file is your reference for understanding their writing style, tone, and structure. Whenever I send you an image or describe a moment (from a movie, book, or real life), your task is to write a tweet-length caption that fits that scene but uses the same style as the original creator. Make the output feel authentic — matching their use of language, rhythm, emotional depth, and tweet formatting. Always keep it concise, evocative, and aligned with how the creator typically expresses thoughts.'
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
    return data.choices[0].message.content.trim();
  }

  // Claude API call (Anthropic)
  async callClaude(prompt) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Cost-effective model
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
    return data.content[0].text.trim();
  }

  // Gemini API call (Google)
  async callGemini(prompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`, {
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
    return data.candidates[0].content.parts[0].text.trim();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
} else {
  window.AIService = AIService;
}