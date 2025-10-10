const database = require('../config/database');

class FAQService {
  constructor() {
    this.confidenceThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.7;
  }

  async searchFAQs(query, limit = 5) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = `
        SELECT *, 
               (CASE 
                 WHEN LOWER(question) LIKE LOWER(?) THEN 10
                 WHEN LOWER(answer) LIKE LOWER(?) THEN 8
                 WHEN LOWER(keywords) LIKE LOWER(?) THEN 6
                 ELSE 0 
               END) as relevance_score
        FROM faqs 
        WHERE relevance_score > 0
        ORDER BY priority DESC, relevance_score DESC, id ASC
        LIMIT ?
      `;

      const searchPattern = `%${query}%`;
      const params = [searchPattern, searchPattern, searchPattern, limit];

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  calculateSimilarity(query, faq) {
    const queryLower = query.toLowerCase();
    const questionLower = faq.question.toLowerCase();
    const keywordsLower = (faq.keywords || '').toLowerCase();
    
    // Simple keyword matching
    const queryWords = queryLower.split(' ').filter(word => word.length > 2);
    let matches = 0;

    queryWords.forEach(word => {
      if (questionLower.includes(word)) matches += 2;
      if (keywordsLower.includes(word)) matches += 1;
    });

    // Calculate similarity score (0-1)
    const maxPossibleMatches = queryWords.length * 2;
    return maxPossibleMatches > 0 ? matches / maxPossibleMatches : 0;
  }

  async findBestMatch(query) {
    try {
      const faqs = await this.searchFAQs(query, 10);
      
      if (faqs.length === 0) {
        return null;
      }

      // Calculate similarity scores for more precise matching
      const scoredFAQs = faqs.map(faq => ({
        ...faq,
        similarity_score: this.calculateSimilarity(query, faq)
      }));

      // Sort by similarity score and relevance
      scoredFAQs.sort((a, b) => {
        if (a.similarity_score !== b.similarity_score) {
          return b.similarity_score - a.similarity_score;
        }
        return b.relevance_score - a.relevance_score;
      });

      const bestMatch = scoredFAQs[0];
      
      // Return match only if it meets confidence threshold
      if (bestMatch.similarity_score >= this.confidenceThreshold * 0.5) {
        return {
          ...bestMatch,
          confidence: bestMatch.similarity_score,
          matched_query: query
        };
      }

      return null;
    } catch (error) {
      console.error('Error finding FAQ match:', error);
      return null;
    }
  }

  async getAllFAQs(category = null) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      let sql = 'SELECT * FROM faqs';
      let params = [];

      if (category) {
        sql += ' WHERE category = ?';
        params.push(category);
      }

      sql += ' ORDER BY priority DESC, category ASC, id ASC';

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async addFAQ(question, answer, keywords = '', category = 'general', priority = 0) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'INSERT INTO faqs (question, answer, keywords, category, priority) VALUES (?, ?, ?, ?, ?)';
      const params = [question, answer, keywords, category, priority];

      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          id: this.lastID,
          question,
          answer,
          keywords,
          category,
          priority
        });
      });
    });
  }

  async updateFAQ(id, data) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const updates = [];
      const params = [];

      if (data.question) {
        updates.push('question = ?');
        params.push(data.question);
      }
      
      if (data.answer) {
        updates.push('answer = ?');
        params.push(data.answer);
      }
      
      if (data.keywords !== undefined) {
        updates.push('keywords = ?');
        params.push(data.keywords);
      }
      
      if (data.category) {
        updates.push('category = ?');
        params.push(data.category);
      }
      
      if (data.priority !== undefined) {
        updates.push('priority = ?');
        params.push(data.priority);
      }

      if (updates.length === 0) {
        resolve({ changes: 0 });
        return;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE faqs SET ${updates.join(', ')} WHERE id = ?`;

      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ changes: this.changes });
      });
    });
  }

  async deleteFAQ(id) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'DELETE FROM faqs WHERE id = ?';

      db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ deletedCount: this.changes });
      });
    });
  }

  async getFAQCategories() {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      const sql = 'SELECT DISTINCT category, COUNT(*) as count FROM faqs GROUP BY category ORDER BY category';

      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }
}

module.exports = new FAQService();