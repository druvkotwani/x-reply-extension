# AI Reply Extension for Twitter/X

A Chrome browser extension that generates contextually appropriate Twitter/X replies by analyzing your writing style and tone.

## Setup Instructions

### 1. Install the Extension

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the extension folder

### 2. Get an AI API Key

Choose one provider and get an API key:

**OpenAI (Recommended)**

- Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Create an API key
- Uses GPT-4o-mini model

**Anthropic Claude**

- Go to [console.anthropic.com](https://console.anthropic.com/)
- Create an API key
- Uses Claude 3 Haiku model

**Google Gemini**

- Go to [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
- Create an API key
- Uses Gemini Pro model

### 3. Setup Supabase (Optional)

If you want to save your tone profile and reply history:

1. Create account at [supabase.com](https://supabase.com/)
2. Create a new project
3. Go to Settings → API
4. Copy your Project URL and anon/public key
5. In the SQL Editor, run:

```sql
CREATE TABLE tone_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE replies_history (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  original_tweet TEXT NOT NULL,
  user_reply TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Configure the Extension

1. Click the extension icon in Chrome
2. Go to **Settings** tab
3. Add your AI API key
4. Add Supabase URL and key (if using)
5. Choose your AI provider

### 5. Create Your Writing Profile

1. Go to **Upload** tab
2. Upload your tweet data as:
   - JSON file from Twitter export
   - CSV file with tweets
   - Plain text (one tweet per line)
3. Click **Analyze Text**
4. Save the analyzed profile

## How to Use

1. Go to Twitter/X
2. Click on any tweet to reply
3. Look for the blue "AI" button next to Reply
4. Click it to see 3 reply suggestions
5. Copy any suggestion you like
6. Paste into the reply box

## File Formats Supported

**JSON:**

```json
[{ "text": "Your tweet here" }, { "text": "Another tweet" }]
```

**CSV:**

```csv
username,date,tweet_text
user,2024-01-01,"Your tweet here"
```

**Text:**

```
Your tweet here
Another tweet here
```

That's it! The extension will learn your writing style and generate replies that match your tone.
