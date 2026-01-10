# X Reply Extension

A Chrome extension that generates AI-powered Twitter/X replies using your past tweets as context. It uses semantic search to find relevant tweets and generates replies that match your writing style.

## How It Works

1. **Upload your tweets** - Import your tweet history under a username
2. **Generate embeddings** - OpenAI converts tweets to vector embeddings
3. **Store in Supabase** - Tweets + embeddings stored in pgvector database
4. **Semantic search** - When replying, finds your most relevant past tweets
5. **AI generates reply** - Claude uses your tweets as context to match your style

## Setup

### 1. Install the Extension

1. Download/extract the extension folder
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the folder

### 2. Get API Keys

**OpenAI** (for embeddings):
- Get key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

**OpenRouter** (for AI replies):
- Get key from [openrouter.ai/keys](https://openrouter.ai/keys)

### 3. Configure Extension

1. Click extension icon → Settings tab
2. Enter your **OpenRouter API Key**
3. Enter your **OpenAI API Key**

## Usage

### Upload Tweets

1. Go to **Upload Tweets** tab
2. Enter a **username** (tweets will be stored under this)
3. Drag & drop or select your tweet JSON/CSV file
4. Click **Upload & Process** - this generates embeddings and stores them

### Select Tweet Source

1. In **Settings** tab, select which user's tweets to use from the **Tweet Source** dropdown
2. Optionally select a **Style Profile** for additional style matching

### Generate Style Profile

1. Select a user from Tweet Source dropdown
2. Click **Generate Style Profile** - AI analyzes tweets and creates a writing style guide

### Generate Replies on Twitter

1. Go to Twitter/X
2. Click on any tweet
3. Click the **AI Reply** button (appears near the reply box)
4. Choose from generated reply suggestions
5. Click to copy, then paste into reply box

## File Formats

**JSON:**
```json
["Tweet text here", "Another tweet", "Third tweet"]
```
or
```json
[{"text": "Tweet here"}, {"text": "Another tweet"}]
```

**CSV:**
```csv
tweet_text
"Your tweet here"
"Another tweet"
```

## Multi-User Support

- Upload tweets for different users (e.g., @user1, @user2)
- Switch between users via Tweet Source dropdown
- Each user can have their own style profiles
- Delete user data from User Management section

## Tech Stack

- **Frontend**: Chrome Extension (Manifest V3)
- **Database**: Supabase (PostgreSQL + pgvector)
- **Embeddings**: OpenAI text-embedding-3-small
- **AI Replies**: OpenRouter (Claude claude-3-5-haiku-20241022)
