// Configuration for X Reply Extension

const CONFIG = {
  // Supabase Configuration (loaded from environment or hardcoded for this project)
  SUPABASE_URL: 'https://twflzxstgnxwpzzdywqa.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3Zmx6eHN0Z254d3B6emR5d3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODcyMDIsImV4cCI6MjA4MzU2MzIwMn0.VeNP_lUDiMtEzOYgvudHRKlqfm9GpTj7CYs9cchA2XU',
  SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3Zmx6eHN0Z254d3B6emR5d3FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk4NzIwMiwiZXhwIjoyMDgzNTYzMjAyfQ.1bSXJ6p8FAp2tsRF2Xvew2GIXvL-b7ly4Y0Fii5tGpQ',

  // OpenAI Configuration (for embeddings) - User enters via extension settings
  OPENAI_API_KEY: '',
  OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',

  // OpenRouter Configuration (for Claude replies) - User enters via extension settings
  OPENROUTER_API_KEY: '',
  OPENROUTER_MODEL: 'anthropic/claude-sonnet-4.5',

  // Default user ID for tweets
  DEFAULT_USER_ID: 'default_user'
};

// Make CONFIG available globally for service worker
if (typeof self !== 'undefined') {
  self.CONFIG = CONFIG;
}
