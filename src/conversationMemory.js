const Conversation = require('../models/Conversation');
const Session = require('../models/Session');

class ConversationMemory {
  constructor() {
    this.maxContextMessages = parseInt(process.env.MAX_CONTEXT_MESSAGES) || 10;
    this.memoryCache = new Map(); // In-memory cache for active sessions
  }

  async getSessionContext(sessionId) {
    try {
      // Check cache first
      if (this.memoryCache.has(sessionId)) {
        const cached = this.memoryCache.get(sessionId);
        // Refresh cache if it's older than 5 minutes
        if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
          return cached.context;
        }
      }

      // Get context from database
      const messages = await Conversation.getContextMessages(sessionId, this.maxContextMessages);
      const session = await Session.findById(sessionId);
      
      const context = {
        sessionId,
        messages,
        sessionMetadata: session?.metadata || {},
        lastActivity: session?.updated_at,
        messageCount: messages.length,
        userPreferences: this.extractUserPreferences(messages),
        conversationSummary: await this.generateConversationSummary(messages)
      };

      // Cache the context
      this.memoryCache.set(sessionId, {
        context,
        timestamp: Date.now()
      });

      return context;
    } catch (error) {
      console.error('Error getting session context:', error);
      return {
        sessionId,
        messages: [],
        sessionMetadata: {},
        lastActivity: null,
        messageCount: 0,
        userPreferences: {},
        conversationSummary: ''
      };
    }
  }

  async updateSessionContext(sessionId, newMessage, sender) {
    try {
      // Add message to database
      await Conversation.addMessage(sessionId, newMessage, sender);
      
      // Update cache
      if (this.memoryCache.has(sessionId)) {
        const cached = this.memoryCache.get(sessionId);
        cached.context.messages.push({
          role: sender === 'user' ? 'user' : 'assistant',
          content: newMessage,
          timestamp: new Date().toISOString(),
          type: 'text'
        });
        
        // Keep only the most recent messages in context
        if (cached.context.messages.length > this.maxContextMessages) {
          cached.context.messages = cached.context.messages.slice(-this.maxContextMessages);
        }
        
        cached.context.messageCount++;
        cached.timestamp = Date.now();
      }

      // Update session activity
      await Session.update(sessionId, {
        is_active: true
      });

    } catch (error) {
      console.error('Error updating session context:', error);
      throw error;
    }
  }

  extractUserPreferences(messages) {
    const preferences = {
      preferredLanguage: 'en',
      communicationStyle: 'formal',
      topicInterests: [],
      issueCategories: []
    };

    const userMessages = messages.filter(msg => msg.role === 'user');
    
    // Analyze communication style
    const informalIndicators = ['hey', 'yeah', 'nah', 'gonna', 'wanna', 'cool', 'awesome'];
    const formalIndicators = ['please', 'thank you', 'could you', 'would you', 'i would like'];
    
    let informalCount = 0;
    let formalCount = 0;

    userMessages.forEach(msg => {
      const lowerContent = msg.content.toLowerCase();
      informalIndicators.forEach(indicator => {
        if (lowerContent.includes(indicator)) informalCount++;
      });
      formalIndicators.forEach(indicator => {
        if (lowerContent.includes(indicator)) formalCount++;
      });
    });

    preferences.communicationStyle = informalCount > formalCount ? 'informal' : 'formal';

    // Extract topic interests and issue categories
    const topicKeywords = {
      'technical': ['api', 'code', 'programming', 'development', 'integration', 'error'],
      'billing': ['payment', 'invoice', 'subscription', 'charge', 'billing', 'refund'],
      'account': ['login', 'password', 'account', 'profile', 'settings', 'access'],
      'general': ['help', 'support', 'question', 'information', 'how to']
    };

    Object.keys(topicKeywords).forEach(topic => {
      const keywords = topicKeywords[topic];
      const mentions = userMessages.reduce((count, msg) => {
        const lowerContent = msg.content.toLowerCase();
        return count + keywords.reduce((keywordCount, keyword) => {
          return keywordCount + (lowerContent.includes(keyword) ? 1 : 0);
        }, 0);
      }, 0);

      if (mentions > 0) {
        preferences.topicInterests.push(topic);
        preferences.issueCategories.push(topic);
      }
    });

    return preferences;
  }

  async generateConversationSummary(messages) {
    if (messages.length === 0) {
      return 'New conversation - no messages yet';
    }

    const userMessages = messages.filter(msg => msg.role === 'user');
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');

    // Simple rule-based summary
    if (userMessages.length === 1 && assistantMessages.length <= 1) {
      return 'Initial customer inquiry';
    }

    // Identify main topics discussed
    const topics = this.identifyMainTopics(messages);
    const topicsStr = topics.length > 0 ? topics.join(', ') : 'general inquiry';

    if (messages.length > 8) {
      return `Extended conversation about ${topicsStr} - ${userMessages.length} customer messages, ${assistantMessages.length} bot responses`;
    } else {
      return `Discussion about ${topicsStr} - ongoing conversation`;
    }
  }

  identifyMainTopics(messages) {
    const topicKeywords = {
      'billing': ['payment', 'invoice', 'subscription', 'charge', 'billing', 'refund', 'credit card'],
      'technical support': ['error', 'bug', 'not working', 'broken', 'issue', 'problem', 'api'],
      'account management': ['login', 'password', 'account', 'profile', 'settings', 'access'],
      'product inquiry': ['features', 'how to', 'tutorial', 'guide', 'documentation'],
      'service inquiry': ['hours', 'contact', 'support', 'help', 'assistance']
    };

    const topicCounts = {};
    const allText = messages.map(msg => msg.content.toLowerCase()).join(' ');

    Object.keys(topicKeywords).forEach(topic => {
      const keywords = topicKeywords[topic];
      const count = keywords.reduce((total, keyword) => {
        return total + (allText.split(keyword).length - 1);
      }, 0);
      if (count > 0) {
        topicCounts[topic] = count;
      }
    });

    // Return topics sorted by frequency
    return Object.keys(topicCounts)
      .sort((a, b) => topicCounts[b] - topicCounts[a])
      .slice(0, 3);
  }

  async getRelevantContext(sessionId, query) {
    try {
      const context = await this.getSessionContext(sessionId);
      
      // Filter messages that might be relevant to the current query
      const relevantMessages = this.findRelevantMessages(context.messages, query);
      
      return {
        ...context,
        relevantMessages,
        queryContext: this.analyzeQueryContext(query, context)
      };
    } catch (error) {
      console.error('Error getting relevant context:', error);
      return null;
    }
  }

  findRelevantMessages(messages, query) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(' ').filter(word => word.length > 2);
    
    return messages
      .map(msg => ({
        ...msg,
        relevance: this.calculateMessageRelevance(msg.content, queryWords)
      }))
      .filter(msg => msg.relevance > 0.2)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);
  }

  calculateMessageRelevance(messageContent, queryWords) {
    const messageLower = messageContent.toLowerCase();
    const messageWords = messageLower.split(' ').filter(word => word.length > 2);
    
    let relevanceScore = 0;
    queryWords.forEach(queryWord => {
      if (messageLower.includes(queryWord)) {
        relevanceScore += 1;
      }
      messageWords.forEach(messageWord => {
        if (messageWord.includes(queryWord) || queryWord.includes(messageWord)) {
          relevanceScore += 0.5;
        }
      });
    });
    
    return Math.min(relevanceScore / queryWords.length, 1);
  }

  analyzeQueryContext(query, context) {
    return {
      isFollowUp: this.isFollowUpQuestion(query, context.messages),
      relatedToPrevious: this.isRelatedToPreviousMessages(query, context.messages.slice(-3)),
      userStyle: context.userPreferences.communicationStyle,
      mainTopics: context.userPreferences.topicInterests
    };
  }

  isFollowUpQuestion(query, messages) {
    const followUpIndicators = ['also', 'and', 'what about', 'how about', 'additionally', 'furthermore'];
    const queryLower = query.toLowerCase();
    
    return followUpIndicators.some(indicator => queryLower.includes(indicator)) && messages.length > 2;
  }

  isRelatedToPreviousMessages(query, recentMessages) {
    if (recentMessages.length === 0) return false;
    
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    const recentText = recentMessages.map(msg => msg.content.toLowerCase()).join(' ');
    
    const commonWords = queryWords.filter(word => recentText.includes(word));
    return commonWords.length / queryWords.length > 0.3;
  }

  clearSessionCache(sessionId) {
    this.memoryCache.delete(sessionId);
  }

  // Cleanup old cache entries
  cleanupCache() {
    const now = Date.now();
    const maxAge = 15 * 60 * 1000; // 15 minutes
    
    this.memoryCache.forEach((value, key) => {
      if (now - value.timestamp > maxAge) {
        this.memoryCache.delete(key);
      }
    });
  }
}

// Setup periodic cache cleanup
const conversationMemory = new ConversationMemory();
setInterval(() => {
  conversationMemory.cleanupCache();
}, 5 * 60 * 1000); // Run every 5 minutes

module.exports = conversationMemory;