// Supabase Client for X Reply Extension
// Uses REST API directly for vector similarity search

const supabaseClient = {
  // Insert a tweet with its embedding
  async insertTweet(content, embedding, userId = null) {
    // Use service key for write operations
    const serviceKey = CONFIG.SUPABASE_SERVICE_KEY || CONFIG.SUPABASE_ANON_KEY;

    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/tweets`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        content: content,
        embedding: embedding,
        user_id: userId || CONFIG.DEFAULT_USER_ID
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to insert tweet: ${error}`);
    }

    return true;
  },

  // Insert multiple tweets with embeddings (batch)
  async insertTweetsBatch(tweets, userId = null) {
    // Use service key for write operations (bypasses RLS)
    const serviceKey = CONFIG.SUPABASE_SERVICE_KEY || CONFIG.SUPABASE_ANON_KEY;

    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/tweets`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(tweets.map(t => ({
        content: t.content,
        embedding: t.embedding,
        user_id: userId || CONFIG.DEFAULT_USER_ID
      })))
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to insert tweets batch: ${error}`);
    }

    return true;
  },

  // Search for similar tweets using vector similarity
  async searchSimilarTweets(queryEmbedding, matchCount = 20, userId = null) {
    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/rpc/match_tweets`, {
      method: 'POST',
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query_embedding: queryEmbedding,
        match_count: matchCount,
        filter_user_id: userId
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to search tweets: ${error}`);
    }

    return await response.json();
  },

  // Get all tweets for a user (without embeddings for display)
  async getTweetsByUser(userId) {
    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/tweets?user_id=eq.${encodeURIComponent(userId || CONFIG.DEFAULT_USER_ID)}&select=id,content,created_at&order=created_at.desc`,
      {
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get tweets: ${error}`);
    }

    return await response.json();
  },

  // Get tweet count for a user
  async getTweetCount(userId) {
    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/tweets?user_id=eq.${encodeURIComponent(userId || CONFIG.DEFAULT_USER_ID)}&select=id`,
      {
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'Prefer': 'count=exact',
          'Range-Unit': 'items',
          'Range': '0-0'
        }
      }
    );

    if (!response.ok) {
      return 0;
    }

    const count = response.headers.get('content-range');
    if (count) {
      const match = count.match(/\/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }

    return 0;
  },

  // Delete all tweets for a user
  async deleteUserTweets(userId) {
    // Use service key for delete operations
    const serviceKey = CONFIG.SUPABASE_SERVICE_KEY || CONFIG.SUPABASE_ANON_KEY;

    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/tweets?user_id=eq.${encodeURIComponent(userId || CONFIG.DEFAULT_USER_ID)}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete tweets: ${error}`);
    }

    return true;
  },

  // Check if user has tweets
  async hasUserTweets(userId) {
    const count = await this.getTweetCount(userId);
    return count > 0;
  },

  // ========== STYLE PROFILE FUNCTIONS ==========

  // Save style profile
  async saveStyleProfile(profile, tweetCount, userId = null) {
    const serviceKey = CONFIG.SUPABASE_SERVICE_KEY || CONFIG.SUPABASE_ANON_KEY;

    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/style_profiles`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: userId || CONFIG.DEFAULT_USER_ID,
        profile: profile,
        tweet_count: tweetCount
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to save style profile: ${error}`);
    }

    return true;
  },

  // Get latest style profile for user (or specific one by ID)
  async getStyleProfile(userId = null, profileId = null) {
    let url;
    if (profileId) {
      url = `${CONFIG.SUPABASE_URL}/rest/v1/style_profiles?id=eq.${profileId}`;
    } else {
      url = `${CONFIG.SUPABASE_URL}/rest/v1/style_profiles?user_id=eq.${encodeURIComponent(userId || CONFIG.DEFAULT_USER_ID)}&order=created_at.desc&limit=1`;
    }

    const response = await fetch(url, {
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.length > 0 ? data[0] : null;
  },

  // Get ALL style profiles (optionally filter by user)
  async getAllStyleProfiles(userId = null) {
    // If userId is provided, filter by it. Otherwise, get ALL profiles.
    const url = userId
      ? `${CONFIG.SUPABASE_URL}/rest/v1/style_profiles?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`
      : `${CONFIG.SUPABASE_URL}/rest/v1/style_profiles?order=created_at.desc`;

    const response = await fetch(url, {
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      return [];
    }

    return await response.json();
  },

  // Get all unique usernames (user_ids) with tweet counts
  async getAllUsernames() {
    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/tweets?select=user_id`,
      {
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!response.ok) {
      return [];
    }

    const tweets = await response.json();

    // Count tweets per user
    const userCounts = {};
    for (const tweet of tweets) {
      const userId = tweet.user_id || 'default_user';
      userCounts[userId] = (userCounts[userId] || 0) + 1;
    }

    // Convert to array format
    return Object.entries(userCounts).map(([username, count]) => ({
      username,
      tweetCount: count
    })).sort((a, b) => b.tweetCount - a.tweetCount);
  },

  // Delete tweets for a specific username
  async deleteUserTweetsByUsername(username) {
    const serviceKey = CONFIG.SUPABASE_SERVICE_KEY || CONFIG.SUPABASE_ANON_KEY;

    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/tweets?user_id=eq.${encodeURIComponent(username)}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete tweets: ${error}`);
    }

    return true;
  },

  // Delete style profiles for a specific username
  async deleteStyleProfilesByUsername(username) {
    const serviceKey = CONFIG.SUPABASE_SERVICE_KEY || CONFIG.SUPABASE_ANON_KEY;

    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/style_profiles?user_id=eq.${encodeURIComponent(username)}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete style profiles: ${error}`);
    }

    return true;
  },

  // Get all tweet contents for analysis (no embeddings)
  async getAllTweetContents(userId = null, limit = 1000) {
    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/tweets?user_id=eq.${encodeURIComponent(userId || CONFIG.DEFAULT_USER_ID)}&select=content&limit=${limit}`,
      {
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get tweets: ${error}`);
    }

    const tweets = await response.json();
    return tweets.map(t => t.content);
  }
};

// Make available globally for service worker
if (typeof self !== 'undefined') {
  self.supabaseClient = supabaseClient;
}
