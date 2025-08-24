// Tone Analysis Utility for Tweet Data Processing

class ToneAnalyzer {
  constructor() {
    this.sentimentWords = {
      positive: ['great', 'awesome', 'love', 'excellent', 'amazing', 'fantastic', 'wonderful', 'perfect', 'brilliant', 'outstanding'],
      negative: ['hate', 'terrible', 'awful', 'horrible', 'worst', 'disgusting', 'pathetic', 'useless', 'disappointing', 'frustrating'],
      neutral: ['okay', 'fine', 'normal', 'average', 'standard', 'typical', 'regular', 'usual', 'common', 'ordinary']
    };
    
    this.toneIndicators = {
      casual: ['lol', 'haha', 'omg', 'tbh', 'ngl', 'fr', 'bruh', 'lmao', 'smh', 'ikr'],
      professional: ['regarding', 'pursuant', 'furthermore', 'therefore', 'consequently', 'moreover', 'nevertheless', 'accordingly'],
      friendly: ['thanks', 'please', 'appreciate', 'welcome', 'glad', 'happy', 'excited', 'looking forward', 'hope', 'wish'],
      witty: ['ironic', 'sarcasm', 'obviously', 'clearly', 'apparently', 'supposedly', 'allegedly', 'technically', 'literally'],
      supportive: ['help', 'support', 'encourage', 'believe', 'understand', 'empathy', 'care', 'there for you', 'you got this']
    };
  }
  
  // Main analysis function
  analyzeTweets(tweets) {
    if (!Array.isArray(tweets) || tweets.length === 0) {
      throw new Error('Invalid tweets data');
    }
    
    const cleanTweets = this.preprocessTweets(tweets);
    const analysis = {
      totalTweets: cleanTweets.length,
      avgLength: this.calculateAverageLength(cleanTweets),
      sentiment: this.analyzeSentiment(cleanTweets),
      tone: this.analyzeTone(cleanTweets),
      keywords: this.extractKeywords(cleanTweets),
      writingStyle: this.analyzeWritingStyle(cleanTweets),
      confidence: 0,
      replyTemplates: this.generateReplyTemplates(cleanTweets)
    };
    
    // Calculate confidence score
    analysis.confidence = this.calculateConfidence(analysis, cleanTweets);
    
    return analysis;
  }
  
  // Preprocess tweets (clean and filter)
  preprocessTweets(tweets) {
    return tweets
      .map(tweet => {
        if (typeof tweet === 'object' && tweet.text) {
          return tweet.text;
        }
        return typeof tweet === 'string' ? tweet : '';
      })
      .filter(tweet => tweet.trim().length > 0)
      .map(tweet => this.cleanTweet(tweet));
  }
  
  // Clean individual tweet
  cleanTweet(tweet) {
    return tweet
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/@\w+/g, '') // Remove mentions
      .replace(/#\w+/g, '') // Remove hashtags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  
  // Calculate average tweet length
  calculateAverageLength(tweets) {
    const totalWords = tweets.reduce((acc, tweet) => {
      return acc + tweet.split(/\s+/).filter(word => word.length > 0).length;
    }, 0);
    
    return Math.round(totalWords / tweets.length);
  }
  
  // Analyze sentiment
  analyzeSentiment(tweets) {
    const sentimentScores = { positive: 0, negative: 0, neutral: 0 };
    
    tweets.forEach(tweet => {
      const words = tweet.toLowerCase().split(/\s+/);
      let tweetSentiment = { positive: 0, negative: 0, neutral: 0 };
      
      words.forEach(word => {
        Object.keys(this.sentimentWords).forEach(sentiment => {
          if (this.sentimentWords[sentiment].includes(word)) {
            tweetSentiment[sentiment]++;
          }
        });
      });
      
      // Determine dominant sentiment for this tweet
      const dominantSentiment = Object.keys(tweetSentiment).reduce((a, b) => 
        tweetSentiment[a] > tweetSentiment[b] ? a : b
      );
      
      if (tweetSentiment[dominantSentiment] > 0) {
        sentimentScores[dominantSentiment]++;
      } else {
        sentimentScores.neutral++;
      }
    });
    
    // Return dominant sentiment
    return Object.keys(sentimentScores).reduce((a, b) => 
      sentimentScores[a] > sentimentScores[b] ? a : b
    );
  }
  
  // Analyze tone
  analyzeTone(tweets) {
    const toneScores = {};
    
    // Initialize scores
    Object.keys(this.toneIndicators).forEach(tone => {
      toneScores[tone] = 0;
    });
    
    tweets.forEach(tweet => {
      const words = tweet.toLowerCase().split(/\s+/);
      
      Object.keys(this.toneIndicators).forEach(tone => {
        this.toneIndicators[tone].forEach(indicator => {
          if (words.includes(indicator) || tweet.toLowerCase().includes(indicator)) {
            toneScores[tone]++;
          }
        });
      });
    });
    
    // Return dominant tone or default to friendly
    const dominantTone = Object.keys(toneScores).reduce((a, b) => 
      toneScores[a] > toneScores[b] ? a : b
    );
    
    return toneScores[dominantTone] > 0 ? dominantTone : 'friendly';
  }
  
  // Extract common keywords
  extractKeywords(tweets) {
    const wordFreq = {};
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'was', 'with', 'for', 'an', 'be', 'or', 'in', 'that', 'have', 'it', 'not', 'you', 'he', 'she', 'they', 'we', 'i', 'me', 'my', 'his', 'her', 'their', 'our']);
    
    tweets.forEach(tweet => {
      const words = tweet.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
      
      words.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      });
    });
    
    // Return top 10 keywords
    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }
  
  // Analyze writing style
  analyzeWritingStyle(tweets) {
    let totalWords = 0;
    let questions = 0;
    let exclamations = 0;
    
    tweets.forEach(tweet => {
      const words = tweet.split(/\s+/).filter(w => w.length > 0);
      totalWords += words.length;
      
      questions += (tweet.match(/\?/g) || []).length;
      exclamations += (tweet.match(/!/g) || []).length;
    });
    
    return {
      avgWordsPerTweet: Math.round(totalWords / tweets.length),
      questionRatio: Math.round((questions / tweets.length) * 100),
      exclamationRatio: Math.round((exclamations / tweets.length) * 100)
    };
  }
  
  // Generate reply templates based on analyzed style
  generateReplyTemplates(tweets) {
    const templates = {
      agreement: [],
      question: [],
      supportive: [],
      witty: []
    };
    
    // Analyze patterns to create templates
    tweets.forEach(tweet => {
      const lower = tweet.toLowerCase();
      
      if (lower.includes('great') || lower.includes('awesome') || lower.includes('love')) {
        templates.agreement.push("That's exactly what I was thinking!");
      }
      
      if (lower.includes('?')) {
        templates.question.push("Interesting question! What made you think about this?");
      }
      
      if (lower.includes('help') || lower.includes('support')) {
        templates.supportive.push("I totally understand where you're coming from.");
      }
      
      if (lower.includes('lol') || lower.includes('haha')) {
        templates.witty.push("Haha, you're absolutely right about that!");
      }
    });
    
    return templates;
  }
  
  // Calculate confidence score
  calculateConfidence(analysis, tweets) {
    let confidence = 0.5; // Base confidence
    
    // More tweets = higher confidence
    if (tweets.length >= 50) confidence += 0.3;
    else if (tweets.length >= 20) confidence += 0.2;
    else if (tweets.length >= 10) confidence += 0.1;
    
    // Clear patterns increase confidence
    if (analysis.keywords.length > 5) confidence += 0.1;
    if (analysis.writingStyle.avgWordsPerTweet > 0) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
  
  // Generate contextual reply using stored analysis
  generateContextualReply(originalTweet, analysis) {
    const replies = [];
    const tone = analysis.tone;
    const sentiment = analysis.sentiment;
    
    // Base replies by tone
    const toneReplies = {
      casual: [
        "Totally agree with this!",
        "Haha yeah, exactly!",
        "This is so true tbh"
      ],
      professional: [
        "Thank you for sharing this insight.",
        "This is a valuable perspective.",
        "I appreciate your thoughtful analysis."
      ],
      friendly: [
        "Thanks for sharing this!",
        "I really appreciate your thoughts on this.",
        "This is such a great point!"
      ],
      witty: [
        "Well played! Couldn't agree more.",
        "Absolutely brilliant observation.",
        "You've nailed it perfectly here!"
      ],
      supportive: [
        "I'm here for this perspective!",
        "You've got such a good point here.",
        "Really glad you shared this!"
      ]
    };
    
    // Get base replies for the detected tone
    const baseReplies = toneReplies[tone] || toneReplies.friendly;
    
    // Add context-aware elements
    if (originalTweet.includes('?')) {
      replies.push("Great question! " + baseReplies[0]);
    } else {
      replies.push(...baseReplies);
    }
    
    return replies.slice(0, 3); // Return top 3 replies
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToneAnalyzer;
} else {
  window.ToneAnalyzer = ToneAnalyzer;
}