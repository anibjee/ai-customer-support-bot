const database = require('../config/database');

class EscalationService {
  constructor() {
    this.escalationKeywords = (process.env.ESCALATION_KEYWORDS || 'human,agent,manager,escalate,speak to someone').split(',').map(k => k.trim().toLowerCase());
  }

  async createEscalation(sessionId, reason, priority = 'medium') {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'INSERT INTO escalations (session_id, reason, status) VALUES (?, ?, ?)';
      const params = [sessionId, reason, 'pending'];

      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          id: this.lastID,
          session_id: sessionId,
          reason,
          status: 'pending',
          priority,
          created_at: new Date().toISOString()
        });
      });
    });
  }

  async getEscalation(escalationId) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'SELECT * FROM escalations WHERE id = ?';

      db.get(sql, [escalationId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  async getSessionEscalations(sessionId) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'SELECT * FROM escalations WHERE session_id = ? ORDER BY created_at DESC';

      db.all(sql, [sessionId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async updateEscalationStatus(escalationId, status, resolvedBy = null) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      let sql, params;

      if (status === 'resolved') {
        sql = 'UPDATE escalations SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?';
        params = [status, escalationId];
      } else {
        sql = 'UPDATE escalations SET status = ? WHERE id = ?';
        params = [status, escalationId];
      }

      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ changes: this.changes });
      });
    });
  }

  async getAllEscalations(status = null) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      let sql = `
        SELECT e.*, s.user_id, s.created_at as session_created
        FROM escalations e
        LEFT JOIN sessions s ON e.session_id = s.id
      `;
      let params = [];

      if (status) {
        sql += ' WHERE e.status = ?';
        params.push(status);
      }

      sql += ' ORDER BY e.created_at DESC';

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  shouldEscalate(message, conversationHistory = [], previousEscalations = []) {
    const lowerMessage = message.toLowerCase();
    
    // Check for direct escalation requests
    const hasEscalationKeyword = this.escalationKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    if (hasEscalationKeyword) {
      return {
        should_escalate: true,
        reason: 'Customer explicitly requested human assistance',
        priority: 'high',
        confidence: 0.9
      };
    }

    // Check for repeated issues (customer asking the same thing multiple times)
    const recentMessages = conversationHistory.slice(-6).filter(msg => msg.sender === 'user');
    if (recentMessages.length >= 3) {
      const messageTexts = recentMessages.map(msg => msg.message.toLowerCase());
      const similarities = [];
      
      for (let i = 0; i < messageTexts.length - 1; i++) {
        for (let j = i + 1; j < messageTexts.length; j++) {
          const similarity = this.calculateTextSimilarity(messageTexts[i], messageTexts[j]);
          similarities.push(similarity);
        }
      }
      
      const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
      if (avgSimilarity > 0.6) {
        return {
          should_escalate: true,
          reason: 'Customer repeating similar questions - may need human assistance',
          priority: 'medium',
          confidence: 0.7
        };
      }
    }

    // Check for frustration indicators
    const frustrationIndicators = [
      'frustrated', 'annoyed', 'angry', 'upset', 'disappointed',
      'not working', 'broken', 'terrible', 'awful', 'useless',
      'waste of time', 'ridiculous', 'stupid', 'horrible'
    ];

    const hasFrustration = frustrationIndicators.some(indicator => 
      lowerMessage.includes(indicator)
    );

    if (hasFrustration) {
      return {
        should_escalate: true,
        reason: 'Customer showing signs of frustration',
        priority: 'high',
        confidence: 0.8
      };
    }

    // Check for complex technical issues
    const technicalKeywords = [
      'api error', 'server error', '500 error', '404 error',
      'database', 'integration', 'webhook', 'authentication',
      'ssl', 'certificate', 'timeout', 'connection failed'
    ];

    const hasTechnicalIssue = technicalKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    if (hasTechnicalIssue && conversationHistory.length > 2) {
      return {
        should_escalate: true,
        reason: 'Complex technical issue detected',
        priority: 'medium',
        confidence: 0.6
      };
    }

    // Check for billing/payment issues
    const billingKeywords = [
      'billing', 'payment', 'charge', 'refund', 'subscription',
      'invoice', 'credit card', 'paypal', 'transaction'
    ];

    const hasBillingIssue = billingKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    if (hasBillingIssue) {
      return {
        should_escalate: true,
        reason: 'Billing/payment related inquiry',
        priority: 'high',
        confidence: 0.8
      };
    }

    // Check conversation length - if it's getting too long without resolution
    if (conversationHistory.length > 10) {
      const userMessages = conversationHistory.filter(msg => msg.sender === 'user').length;
      const botMessages = conversationHistory.filter(msg => msg.sender === 'bot').length;
      
      if (userMessages > 5 && botMessages > 5) {
        return {
          should_escalate: true,
          reason: 'Extended conversation without resolution',
          priority: 'medium',
          confidence: 0.6
        };
      }
    }

    return {
      should_escalate: false,
      reason: 'Query within bot capabilities',
      priority: 'low',
      confidence: 0.3
    };
  }

  calculateTextSimilarity(text1, text2) {
    const words1 = text1.split(' ').filter(word => word.length > 2);
    const words2 = text2.split(' ').filter(word => word.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = Math.max(words1.length, words2.length);
    
    return commonWords.length / totalWords;
  }

  generateEscalationMessage(escalationType, customerName = 'Customer') {
    const messages = {
      'human_request': `I understand you'd like to speak with a human agent. Let me connect you with one of our support specialists who can provide more personalized assistance.`,
      
      'technical_issue': `I see you're experiencing a technical issue that may require specialized support. I'm connecting you with our technical support team who can provide more detailed assistance.`,
      
      'billing_issue': `For billing and payment related matters, I'll connect you with our billing support team who can access your account details and provide accurate information about your charges and payments.`,
      
      'frustration': `I apologize that we haven't been able to resolve your concern to your satisfaction. Let me connect you with a senior support agent who can provide more comprehensive assistance.`,
      
      'complex_query': `Your inquiry requires more detailed attention than I can provide. I'm escalating your case to our specialist team who can give you the thorough support you deserve.`,
      
      'extended_conversation': `I want to ensure you get the best possible help. Since we've been discussing this for a while, let me connect you with a human agent who can provide more personalized assistance.`
    };

    return messages[escalationType] || messages['human_request'];
  }

  async getEscalationStats() {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = `
        SELECT 
          COUNT(*) as total_escalations,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
          AVG(JULIANDAY(COALESCE(resolved_at, 'now')) - JULIANDAY(created_at)) as avg_resolution_time_days
        FROM escalations
        WHERE created_at >= datetime('now', '-30 days')
      `;

      db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }
}

module.exports = new EscalationService();