// Supabase client for storing tone profiles and reply history

class SupabaseClient {
  constructor() {
    this.url = null;
    this.key = null;
    this.userId = null;
  }

  // Initialize with Supabase credentials
  async init() {
    const result = await chrome.storage.sync.get(['supabaseUrl', 'supabaseKey', 'userId']);
    this.url = result.supabaseUrl;
    this.key = result.supabaseKey;
    this.userId = result.userId || this.generateUserId();

    if (!this.url || !this.key) {
      throw new Error('Supabase credentials not configured. Please add your Supabase URL and API key in settings.');
    }

    // Store userId if it was generated
    if (!result.userId) {
      await chrome.storage.sync.set({ userId: this.userId });
    }
  }

  // Generate a unique user ID
  generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Save tone profile to Supabase
  async saveToneProfile(profileData) {
    await this.init();

    try {
      const response = await fetch(`${this.url}/rest/v1/tone_profiles`, {
        method: 'POST',
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_id: this.userId,
          profile_data: profileData,
          created_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to save tone profile: ${error}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Supabase save error:', error);
      throw error;
    }
  }

  // Get latest tone profile
  async getToneProfile() {
    await this.init();

    try {
      const response = await fetch(
        `${this.url}/rest/v1/tone_profiles?user_id=eq.${this.userId}&order=created_at.desc&limit=1`,
        {
          headers: {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch tone profile');
      }

      const data = await response.json();
      return data.length > 0 ? data[0].profile_data : null;
    } catch (error) {
      console.error('Supabase fetch error:', error);
      throw error;
    }
  }

  // Save reply to history
  async saveReply(originalTweet, userReply) {
    await this.init();

    try {
      const response = await fetch(`${this.url}/rest/v1/replies_history`, {
        method: 'POST',
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_id: this.userId,
          original_tweet: originalTweet,
          user_reply: userReply,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Failed to save reply:', error);
        // Don't throw error for reply saving - it's not critical
      }
    } catch (error) {
      console.error('Reply save error:', error);
      // Silently fail - reply history is nice to have but not essential
    }
  }

  // Get recent reply history
  async getReplyHistory(limit = 10) {
    await this.init();

    try {
      const response = await fetch(
        `${this.url}/rest/v1/replies_history?user_id=eq.${this.userId}&order=timestamp.desc&limit=${limit}`,
        {
          headers: {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch reply history');
      }

      return await response.json();
    } catch (error) {
      console.error('Reply history fetch error:', error);
      return []; // Return empty array if fetch fails
    }
  }

  // Update tone profile with new data
  async updateToneProfile(profileData) {
    await this.init();

    try {
      // First get the existing profile ID
      const existing = await fetch(
        `${this.url}/rest/v1/tone_profiles?user_id=eq.${this.userId}&order=created_at.desc&limit=1`,
        {
          headers: {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`
          }
        }
      );

      const existingData = await existing.json();

      if (existingData.length > 0) {
        // Update existing profile
        const response = await fetch(
          `${this.url}/rest/v1/tone_profiles?id=eq.${existingData[0].id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': this.key,
              'Authorization': `Bearer ${this.key}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              profile_data: profileData,
              updated_at: new Date().toISOString()
            })
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update tone profile');
        }
      } else {
        // Create new profile if none exists
        await this.saveToneProfile(profileData);
      }

      return { success: true };
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }

  // Delete all user data (for privacy)
  async deleteUserData() {
    await this.init();

    try {
      // Delete tone profiles
      await fetch(`${this.url}/rest/v1/tone_profiles?user_id=eq.${this.userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`
        }
      });

      // Delete reply history
      await fetch(`${this.url}/rest/v1/replies_history?user_id=eq.${this.userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`
        }
      });

      // Clear local user ID
      await chrome.storage.sync.remove(['userId']);

      return { success: true };
    } catch (error) {
      console.error('Data deletion error:', error);
      throw error;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SupabaseClient;
} else {
  window.SupabaseClient = SupabaseClient;
}