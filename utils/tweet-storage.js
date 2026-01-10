// IndexedDB storage for tweets - stores raw tweets locally with no size limits

const DB_NAME = 'XReplyExtension';
const DB_VERSION = 1;
const TWEETS_STORE = 'tweets';
const PROFILES_STORE = 'profiles';

class TweetStorage {
  constructor() {
    this.db = null;
  }

  // Initialize the database
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store for raw tweets
        if (!db.objectStoreNames.contains(TWEETS_STORE)) {
          const tweetsStore = db.createObjectStore(TWEETS_STORE, { keyPath: 'id', autoIncrement: true });
          tweetsStore.createIndex('profileId', 'profileId', { unique: false });
          tweetsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store for profiles metadata
        if (!db.objectStoreNames.contains(PROFILES_STORE)) {
          const profilesStore = db.createObjectStore(PROFILES_STORE, { keyPath: 'id' });
          profilesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  // Save a batch of tweets for a profile
  async saveTweets(profileId, tweets) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TWEETS_STORE], 'readwrite');
      const store = transaction.objectStore(TWEETS_STORE);

      // Clear existing tweets for this profile first
      const index = store.index('profileId');
      const clearRequest = index.openCursor(IDBKeyRange.only(profileId));

      clearRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        // Now add new tweets
        const addTransaction = this.db.transaction([TWEETS_STORE], 'readwrite');
        const addStore = addTransaction.objectStore(TWEETS_STORE);

        tweets.forEach((tweet, index) => {
          const tweetData = {
            profileId,
            text: typeof tweet === 'string' ? tweet : tweet.text || tweet.full_text || JSON.stringify(tweet),
            timestamp: Date.now(),
            order: index
          };
          addStore.add(tweetData);
        });

        addTransaction.oncomplete = () => resolve(tweets.length);
        addTransaction.onerror = () => reject(addTransaction.error);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Get all tweets for a profile
  async getTweets(profileId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TWEETS_STORE], 'readonly');
      const store = transaction.objectStore(TWEETS_STORE);
      const index = store.index('profileId');
      const request = index.getAll(IDBKeyRange.only(profileId));

      request.onsuccess = () => {
        const tweets = request.result.sort((a, b) => a.order - b.order);
        resolve(tweets.map(t => t.text));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get a random sample of tweets for prompting
  async getSampleTweets(profileId, count = 20) {
    const allTweets = await this.getTweets(profileId);

    if (allTweets.length <= count) {
      return allTweets;
    }

    // Get a diverse sample - mix of random and recent
    const shuffled = [...allTweets].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // Get tweets that might be relevant to a topic (simple keyword matching)
  async getRelevantTweets(profileId, context, count = 10) {
    const allTweets = await this.getTweets(profileId);

    if (!context || allTweets.length <= count) {
      return allTweets.slice(0, count);
    }

    // Extract keywords from context (simple approach)
    const contextWords = context.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Score tweets by relevance
    const scored = allTweets.map(tweet => {
      const tweetLower = tweet.toLowerCase();
      let score = 0;
      contextWords.forEach(word => {
        if (tweetLower.includes(word)) score += 1;
      });
      return { tweet, score };
    });

    // Sort by score and get top matches
    scored.sort((a, b) => b.score - a.score);

    // Get mix of relevant + random for diversity
    const relevant = scored.slice(0, Math.floor(count / 2)).map(s => s.tweet);
    const remaining = scored.slice(Math.floor(count / 2)).map(s => s.tweet);
    const randomPicks = remaining.sort(() => Math.random() - 0.5).slice(0, count - relevant.length);

    return [...relevant, ...randomPicks];
  }

  // Save profile metadata
  async saveProfile(profile) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([PROFILES_STORE], 'readwrite');
      const store = transaction.objectStore(PROFILES_STORE);
      const request = store.put(profile);

      request.onsuccess = () => resolve(profile.id);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all profiles
  async getProfiles() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([PROFILES_STORE], 'readonly');
      const store = transaction.objectStore(PROFILES_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get a specific profile
  async getProfile(profileId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([PROFILES_STORE], 'readonly');
      const store = transaction.objectStore(PROFILES_STORE);
      const request = store.get(profileId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Delete a profile and its tweets
  async deleteProfile(profileId) {
    await this.init();

    // Delete tweets first
    await new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TWEETS_STORE], 'readwrite');
      const store = transaction.objectStore(TWEETS_STORE);
      const index = store.index('profileId');
      const request = index.openCursor(IDBKeyRange.only(profileId));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    // Then delete profile
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([PROFILES_STORE], 'readwrite');
      const store = transaction.objectStore(PROFILES_STORE);
      const request = store.delete(profileId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get stats about stored data
  async getStats() {
    await this.init();

    const profiles = await this.getProfiles();
    let totalTweets = 0;

    for (const profile of profiles) {
      const tweets = await this.getTweets(profile.id);
      totalTweets += tweets.length;
    }

    return {
      profileCount: profiles.length,
      totalTweets,
      profiles: profiles.map(p => ({ id: p.id, name: p.name, createdAt: p.createdAt }))
    };
  }

  // Export all data as JSON (for backup)
  async exportData() {
    const profiles = await this.getProfiles();
    const exportData = [];

    for (const profile of profiles) {
      const tweets = await this.getTweets(profile.id);
      exportData.push({
        profile,
        tweets
      });
    }

    return exportData;
  }

  // Import data from JSON backup
  async importData(data) {
    for (const item of data) {
      await this.saveProfile(item.profile);
      await this.saveTweets(item.profile.id, item.tweets);
    }
  }

  // Set active profile
  async setActiveProfile(profileId) {
    await chrome.storage.local.set({ activeProfileId: profileId });
  }

  // Get active profile ID
  async getActiveProfileId() {
    const result = await chrome.storage.local.get(['activeProfileId']);
    return result.activeProfileId || null;
  }

  // Get active profile with tweets
  async getActiveProfileWithTweets() {
    const profileId = await this.getActiveProfileId();
    if (!profileId) return null;

    const profile = await this.getProfile(profileId);
    if (!profile) return null;

    const tweets = await this.getTweets(profileId);
    return { profile, tweets };
  }
}

// Export singleton instance
const tweetStorage = new TweetStorage();

// Make available globally for content scripts and popup
if (typeof window !== 'undefined') {
  window.tweetStorage = tweetStorage;
}

// For service worker / background script
if (typeof self !== 'undefined') {
  self.tweetStorage = tweetStorage;
}
