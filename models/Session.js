const { v4: uuidv4 } = require('uuid');
const database = require('../config/database');

class Session {
  static async create(userId = null, metadata = {}) {
    return new Promise((resolve, reject) => {
      const sessionId = uuidv4();
      const db = database.getDb();
      
      const sql = 'INSERT INTO sessions (id, user_id, metadata) VALUES (?, ?, ?)';
      const params = [sessionId, userId, JSON.stringify(metadata)];
      
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          id: sessionId,
          user_id: userId,
          metadata: metadata,
          created_at: new Date().toISOString(),
          is_active: true
        });
      });
    });
  }

  static async findById(sessionId) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'SELECT * FROM sessions WHERE id = ?';
      
      db.get(sql, [sessionId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (row) {
          row.metadata = JSON.parse(row.metadata || '{}');
        }
        resolve(row);
      });
    });
  }

  static async update(sessionId, data) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const updates = [];
      const params = [];
      
      if (data.metadata) {
        updates.push('metadata = ?');
        params.push(JSON.stringify(data.metadata));
      }
      
      if (data.is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(data.is_active);
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(sessionId);
      
      const sql = `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`;
      
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ changes: this.changes });
      });
    });
  }

  static async getActiveSessions() {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'SELECT * FROM sessions WHERE is_active = 1 ORDER BY updated_at DESC';
      
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        const sessions = rows.map(row => ({
          ...row,
          metadata: JSON.parse(row.metadata || '{}')
        }));
        resolve(sessions);
      });
    });
  }

  static async endSession(sessionId) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'UPDATE sessions SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      db.run(sql, [sessionId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = Session;