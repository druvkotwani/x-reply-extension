// OpenAI Embeddings API for X Reply Extension
// Converts text to vector embeddings for semantic search

const openaiEmbeddings = {
  // Get API key from storage or config
  async getApiKey() {
    let apiKey = CONFIG.OPENAI_API_KEY;
    if (!apiKey) {
      const result = await chrome.storage.sync.get(['openaiApiKey']);
      apiKey = result.openaiApiKey;
    }
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please add it in extension settings.');
    }
    return apiKey;
  },

  // Generate embedding for a single text
  async getEmbedding(text) {
    const apiKey = await this.getApiKey();

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CONFIG.OPENAI_EMBEDDING_MODEL,
        input: text
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate embedding');
    }

    const data = await response.json();
    return data.data[0].embedding;
  },

  // Generate embeddings for multiple texts (batch)
  // OpenAI supports up to 2048 inputs per request
  async getEmbeddingsBatch(texts, batchSize = 100) {
    const apiKey = await this.getApiKey();
    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: CONFIG.OPENAI_EMBEDDING_MODEL,
          input: batch
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to generate embeddings batch');
      }

      const data = await response.json();

      // Sort by index to maintain order
      const sortedEmbeddings = data.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);

      allEmbeddings.push(...sortedEmbeddings);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return allEmbeddings;
  },

  // Process tweets and return with embeddings
  async processTweetsWithEmbeddings(tweets, onProgress = null) {
    const results = [];
    const batchSize = 50;

    for (let i = 0; i < tweets.length; i += batchSize) {
      const batch = tweets.slice(i, i + batchSize);
      const embeddings = await this.getEmbeddingsBatch(batch);

      for (let j = 0; j < batch.length; j++) {
        results.push({
          content: batch[j],
          embedding: embeddings[j]
        });
      }

      // Report progress if callback provided
      if (onProgress) {
        onProgress(Math.min(i + batchSize, tweets.length), tweets.length);
      }
    }

    return results;
  }
};

// Make available globally for service worker
if (typeof self !== 'undefined') {
  self.openaiEmbeddings = openaiEmbeddings;
}
