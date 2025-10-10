const llmService = require('./llmService');
const faqService = require('./faqService');
const escalationService = require('./escalationService');
const conversationMemory = require('./conversationMemory');
const Session = require('../models/Session');
const Conversation = require('../models/Conversation');

class BotService {
  constructor() {
    this.botName = process.env.BOT_NAME || 'CustomerSupportBot';
    this.confidenceThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.7;
  }

  async processMessage(sessionId, userMessage, userId = null) {
    try {
      // Ensure session exists
      let session = await Session.findById(sessionId);
      if (!session) {
        session = await Session.create(userId);
        sessionId = session.id;
      }

      // Get conversation context
      const context = await conversationMemory.getRelevantContext(sessionId, userMessage);
      
      // Store user message
      await conversationMemory.updateSessionContext(sessionId, userMessage, 'user');

      // Get conversation history for escalation analysis
      const conversationHistory = await Conversation.getConversationHistory(sessionId, 20);

      // Check if escalation is needed
      const escalationAnalysis = escalationService.shouldEscalate(
        userMessage, 
        conversationHistory
      );

      // If escalation is needed, handle it
      if (escalationAnalysis.should_escalate) {
        return await this.handleEscalation(sessionId, userMessage, escalationAnalysis, context);
      }

      // Try to find FAQ match first
      const faqMatch = await faqService.findBestMatch(userMessage);
      
      if (faqMatch && faqMatch.confidence > 0.4) {
        const response = await this.generateFAQResponse(faqMatch, context);
        await conversationMemory.updateSessionContext(sessionId, response.message, 'bot');
        
        await Conversation.addMessage(sessionId, response.message, 'bot', 'faq', faqMatch.confidence);
        
        return {
          sessionId,
          message: response.message,
          type: 'faq',
          confidence: faqMatch.confidence,
          source: 'faq_database',
          faq_matched: {
            question: faqMatch.question,
            category: faqMatch.category
          },
          context: {
            conversation_summary: context?.conversationSummary,
            user_preferences: context?.userPreferences
          },
          metadata: {
            processing_time: Date.now() - Date.now(),
            message_count: context?.messageCount || 0
          }
        };
      }

      // Generate LLM response with context
      const contextMessages = context ? context.messages.slice(-5) : [];
      const llmResponse = await llmService.generateResponse(userMessage, contextMessages);
      
      // Store bot response
      await conversationMemory.updateSessionContext(sessionId, llmResponse.response, 'bot');
      
      await Conversation.addMessage(sessionId, llmResponse.response, 'bot', 'text', llmResponse.confidence);

      // Check if response confidence is too low - might need escalation
      if (llmResponse.confidence < 0.4) {
        const lowConfidenceMessage = this.generateLowConfidenceResponse(userMessage);
        await conversationMemory.updateSessionContext(sessionId, lowConfidenceMessage, 'bot');
        await Conversation.addMessage(sessionId, lowConfidenceMessage, 'bot', 'text', 0.3);
      }

      return {
        sessionId,
        message: llmResponse.response,
        type: 'llm_response',
        confidence: llmResponse.confidence,
        source: llmResponse.source,
        context: {
          conversation_summary: context?.conversationSummary,
          user_preferences: context?.userPreferences,
          relevant_messages: context?.relevantMessages?.length || 0
        },
        metadata: {
          processing_time: Date.now() - Date.now(),
          message_count: context?.messageCount || 0,
          context_used: contextMessages.length
        }
      };

    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorResponse = "I apologize, but I'm experiencing technical difficulties at the moment. Please try again in a few moments, or I can connect you with a human agent for immediate assistance.";
      
      try {
        await conversationMemory.updateSessionContext(sessionId, errorResponse, 'bot');
        await Conversation.addMessage(sessionId, errorResponse, 'bot', 'error', 0.1);
      } catch (dbError) {
        console.error('Error storing error response:', dbError);
      }

      return {
        sessionId,
        message: errorResponse,
        type: 'error',
        confidence: 0.1,
        source: 'error_handler',
        error: true
      };
    }
  }

  async handleEscalation(sessionId, userMessage, escalationAnalysis, context) {
    try {
      // Create escalation record
      const escalation = await escalationService.createEscalation(
        sessionId, 
        escalationAnalysis.reason,
        escalationAnalysis.priority
      );

      // Generate appropriate escalation message
      const escalationType = this.determineEscalationType(escalationAnalysis.reason);
      const escalationMessage = escalationService.generateEscalationMessage(escalationType);
      
      // Add escalation information to message
      const fullMessage = `${escalationMessage}\n\n🎫 Escalation Ticket: #${escalation.id}\n📞 A human agent will be with you shortly. Your current wait time is approximately 2-5 minutes.`;
      
      // Store escalation message
      await conversationMemory.updateSessionContext(sessionId, fullMessage, 'bot');
      await Conversation.addMessage(sessionId, fullMessage, 'bot', 'escalation', escalationAnalysis.confidence);

      return {
        sessionId,
        message: fullMessage,
        type: 'escalation',
        confidence: escalationAnalysis.confidence,
        source: 'escalation_service',
        escalation: {
          id: escalation.id,
          reason: escalationAnalysis.reason,
          priority: escalationAnalysis.priority,
          status: 'pending'
        },
        context: {
          conversation_summary: context?.conversationSummary,
          user_preferences: context?.userPreferences
        },
        metadata: {
          escalation_type: escalationType,
          message_count: context?.messageCount || 0
        }
      };

    } catch (error) {
      console.error('Error handling escalation:', error);
      
      const fallbackMessage = "I understand you need additional assistance. While I'm having trouble creating your support ticket right now, please know that your inquiry is important to us. You can also contact our support team directly at support@company.com or call (555) 123-4567.";
      
      return {
        sessionId,
        message: fallbackMessage,
        type: 'escalation_error',
        confidence: 0.5,
        source: 'fallback',
        error: true
      };
    }
  }

  determineEscalationType(reason) {
    const reasonLower = reason.toLowerCase();
    
    if (reasonLower.includes('human') || reasonLower.includes('agent')) {
      return 'human_request';
    } else if (reasonLower.includes('billing') || reasonLower.includes('payment')) {
      return 'billing_issue';
    } else if (reasonLower.includes('technical') || reasonLower.includes('error')) {
      return 'technical_issue';
    } else if (reasonLower.includes('frustration') || reasonLower.includes('frustrated')) {
      return 'frustration';
    } else if (reasonLower.includes('complex')) {
      return 'complex_query';
    } else if (reasonLower.includes('extended') || reasonLower.includes('conversation')) {
      return 'extended_conversation';
    }
    
    return 'human_request';
  }

  async generateFAQResponse(faqMatch, context) {
    const userStyle = context?.userPreferences?.communicationStyle || 'formal';
    
    let response = faqMatch.answer;
    
    // Personalize response based on user communication style
    if (userStyle === 'informal') {
      response = this.makeResponseInformal(response);
    }
    
    // Add helpful follow-up
    response += "\n\nIs there anything else I can help you with regarding this topic?";
    
    return {
      message: response,
      faq_id: faqMatch.id,
      category: faqMatch.category
    };
  }

  makeResponseInformal(response) {
    return response
      .replace(/You can/g, "You can just")
      .replace(/Please/g, "Just")
      .replace(/Thank you/g, "Thanks")
      .replace(/\. /g, ". 😊 ");
  }

  generateLowConfidenceResponse(userMessage) {
    return `I want to make sure I give you accurate information about "${userMessage}". Let me connect you with one of our specialists who can provide you with detailed assistance. Alternatively, you can browse our help documentation or try rephrasing your question.`;
  }

  async getSessionSummary(sessionId) {
    try {
      const context = await conversationMemory.getSessionContext(sessionId);
      const summary = await Conversation.getConversationSummary(sessionId);
      const escalations = await escalationService.getSessionEscalations(sessionId);
      
      return {
        session_id: sessionId,
        conversation_summary: context.conversationSummary,
        message_stats: summary,
        user_preferences: context.userPreferences,
        escalations: escalations,
        last_activity: context.lastActivity,
        status: escalations.some(e => e.status === 'pending') ? 'escalated' : 'active'
      };
    } catch (error) {
      console.error('Error getting session summary:', error);
      return null;
    }
  }

  async endSession(sessionId) {
    try {
      // Generate conversation summary
      const context = await conversationMemory.getSessionContext(sessionId);
      const summary = await llmService.summarizeConversation(context.messages);
      
      // End session in database
      await Session.endSession(sessionId);
      
      // Update session metadata with summary
      await Session.update(sessionId, {
        metadata: {
          ...context.sessionMetadata,
          final_summary: summary,
          ended_at: new Date().toISOString(),
          total_messages: context.messageCount
        }
      });
      
      // Clear from memory cache
      conversationMemory.clearSessionCache(sessionId);
      
      return {
        sessionId,
        summary,
        message_count: context.messageCount,
        ended_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }

  async getAllSessions(active_only = false) {
    try {
      if (active_only) {
        return await Session.getActiveSessions();
      } else {
        // This would need to be implemented in Session model
        return await Session.getActiveSessions(); // For now, return active only
      }
    } catch (error) {
      console.error('Error getting sessions:', error);
      return [];
    }
  }
}

module.exports = new BotService();