const database = require('../config/database');

class Conversation {
  static async addMessage(sessionId, message, sender, messageType = 'text', confidenceScore = null) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'INSERT INTO conversations (session_id, message, sender, message_type, confidence_score) VALUES (?, ?, ?, ?, ?)';
      const params = [sessionId, message, sender, messageType, confidenceScore];
      
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          id: this.lastID,
          session_id: sessionId,
          message,
          sender,
          message_type: messageType,
          confidence_score: confidenceScore,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  static async getConversationHistory(sessionId, limit = 50) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'SELECT * FROM conversations WHERE session_id = ? ORDER BY timestamp ASC LIMIT ?';
      
      db.all(sql, [sessionId, limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  static async getRecentMessages(sessionId, limit = 10) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'SELECT * FROM conversations WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?';
      
      db.all(sql, [sessionId, limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        // Reverse to get chronological order
        resolve(rows.reverse());
      });
    });
  }

  static async getContextMessages(sessionId, maxMessages = 10) {
    const messages = await this.getRecentMessages(sessionId, maxMessages);
    return messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.message,
      timestamp: msg.timestamp,
      type: msg.message_type
    }));
  }

  static async deleteConversation(sessionId) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'DELETE FROM conversations WHERE session_id = ?';
      
      db.run(sql, [sessionId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ deletedCount: this.changes });
      });
    });
  }

  static async getMessagesByType(sessionId, messageType) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'SELECT * FROM conversations WHERE session_id = ? AND message_type = ? ORDER BY timestamp ASC';
      
      db.all(sql, [sessionId, messageType], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  static async getConversationSummary(sessionId) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = `
        SELECT 
          COUNT(*) as total_messages,
          SUM(CASE WHEN sender = 'user' THEN 1 ELSE 0 END) as user_messages,
          SUM(CASE WHEN sender = 'bot' THEN 1 ELSE 0 END) as bot_messages,
          MIN(timestamp) as first_message,
          MAX(timestamp) as last_message,
          AVG(confidence_score) as avg_confidence
        FROM conversations 
        WHERE session_id = ?
      `;
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }
}

module.exports = Conversation;