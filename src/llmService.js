const axios = require('axios');

class LLMService {
  constructor() {
    this.hfApiKey = process.env.HF_API_KEY;
    this.hfModel = process.env.HF_MODEL || 'microsoft/DialoGPT-medium';
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.openaiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.botName = process.env.BOT_NAME || 'CustomerSupportBot';
    this.confidenceThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.7;
  }

  async generateResponse(message, context = [], useOpenAI = false) {
    try {
      if (useOpenAI && this.openaiApiKey && this.openaiApiKey !== 'your_openai_compatible_key_here') {
        return await this.generateOpenAIResponse(message, context);
      } else if (this.hfApiKey && this.hfApiKey !== 'your_hugging_face_api_key_here') {
        return await this.generateHuggingFaceResponse(message, context);
      } else {
        // Fallback to rule-based response
        return await this.generateFallbackResponse(message, context);
      }
    } catch (error) {
      console.error('Error generating LLM response:', error.message);
      return await this.generateFallbackResponse(message, context);
    }
  }

  async generateHuggingFaceResponse(message, context = []) {
    const apiUrl = `https://api-inference.huggingface.co/models/${this.hfModel}`;
    
    // Build conversation history for context
    let conversationText = '';
    context.forEach(msg => {
      if (msg.role === 'user') {
        conversationText += `User: ${msg.content}\n`;
      } else {
        conversationText += `${this.botName}: ${msg.content}\n`;
      }
    });
    conversationText += `User: ${message}\n${this.botName}:`;

    const response = await axios.post(
      apiUrl,
      {
        inputs: conversationText,
        parameters: {
          max_new_tokens: 150,
          temperature: 0.7,
          return_full_text: false,
          do_sample: true
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.hfApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data && response.data[0] && response.data[0].generated_text) {
      const generatedText = response.data[0].generated_text.trim();
      return {
        response: generatedText,
        confidence: 0.8,
        source: 'huggingface'
      };
    } else {
      throw new Error('Invalid response format from Hugging Face API');
    }
  }

  async generateOpenAIResponse(message, context = []) {
    const messages = [
      {
        role: 'system',
        content: `You are ${this.botName}, a helpful customer support assistant. You provide accurate, friendly, and professional responses to customer inquiries. If you cannot answer a question with confidence, suggest escalating to a human agent.`
      },
      ...context,
      {
        role: 'user',
        content: message
      }
    ];

    const response = await axios.post(
      `${this.openaiBaseUrl}/chat/completions`,
      {
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 150,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data && response.data.choices && response.data.choices[0]) {
      return {
        response: response.data.choices[0].message.content.trim(),
        confidence: 0.9,
        source: 'openai'
      };
    } else {
      throw new Error('Invalid response format from OpenAI API');
    }
  }

  async generateFallbackResponse(message, context = []) {
    // Simple rule-based fallback responses
    const lowerMessage = message.toLowerCase();
    
    // Greeting patterns
    if (lowerMessage.match(/^(hi|hello|hey|good (morning|afternoon|evening))/)) {
      return {
        response: `Hello! I'm ${this.botName}, your customer support assistant. How can I help you today?`,
        confidence: 0.9,
        source: 'fallback'
      };
    }

    // Gratitude patterns
    if (lowerMessage.match(/(thank you|thanks|appreciate)/)) {
      return {
        response: "You're welcome! Is there anything else I can help you with today?",
        confidence: 0.9,
        source: 'fallback'
      };
    }

    // Goodbye patterns
    if (lowerMessage.match(/(bye|goodbye|see you|have a good)/)) {
      return {
        response: "Thank you for contacting us! Have a great day, and don't hesitate to reach out if you need any further assistance.",
        confidence: 0.9,
        source: 'fallback'
      };
    }

    // Default response
    return {
      response: "I understand you're asking about something, but I'd like to make sure I give you the most accurate information. Could you please rephrase your question or provide more details? If you need immediate assistance, I can connect you with a human agent.",
      confidence: 0.3,
      source: 'fallback'
    };
  }

  async summarizeConversation(messages) {
    try {
      if (!messages || messages.length === 0) {
        return 'No conversation to summarize.';
      }

      const conversationText = messages
        .map(msg => `${msg.role === 'user' ? 'Customer' : 'Agent'}: ${msg.content}`)
        .join('\n');

      if (this.openaiApiKey && this.openaiApiKey !== 'your_openai_compatible_key_here') {
        const response = await axios.post(
          `${this.openaiBaseUrl}/chat/completions`,
          {
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'Summarize this customer support conversation in 2-3 sentences, highlighting the main issue and resolution status.'
              },
              {
                role: 'user',
                content: conversationText
              }
            ],
            max_tokens: 100,
            temperature: 0.3
          },
          {
            headers: {
              'Authorization': `Bearer ${this.openaiApiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        return response.data.choices[0].message.content.trim();
      } else {
        // Simple fallback summary
        const userMessages = messages.filter(m => m.role === 'user').length;
        const assistantMessages = messages.filter(m => m.role === 'assistant').length;
        return `Conversation with ${userMessages} customer messages and ${assistantMessages} agent responses. Recent discussion about customer inquiry.`;
      }
    } catch (error) {
      console.error('Error summarizing conversation:', error.message);
      return 'Unable to generate conversation summary.';
    }
  }

  async suggestNextAction(lastMessage, conversationHistory) {
    const lowerMessage = lastMessage.toLowerCase();
    
    // Check for escalation indicators
    const escalationKeywords = (process.env.ESCALATION_KEYWORDS || 'human,agent,manager,escalate,speak to someone').split(',');
    const needsEscalation = escalationKeywords.some(keyword => 
      lowerMessage.includes(keyword.trim().toLowerCase())
    );

    if (needsEscalation) {
      return {
        action: 'escalate',
        reason: 'Customer requested human assistance',
        priority: 'high'
      };
    }

    // Check for complex technical issues
    if (lowerMessage.match(/(error|bug|not working|broken|issue|problem)/) && 
        conversationHistory.length > 4) {
      return {
        action: 'escalate',
        reason: 'Complex technical issue requiring human support',
        priority: 'medium'
      };
    }

    // Check for billing/payment issues
    if (lowerMessage.match(/(billing|payment|charge|refund|cancel|subscription)/)) {
      return {
        action: 'escalate',
        reason: 'Billing/payment issue',
        priority: 'high'
      };
    }

    return {
      action: 'continue',
      reason: 'Standard inquiry within bot capabilities',
      priority: 'low'
    };
  }
}

module.exports = new LLMService();