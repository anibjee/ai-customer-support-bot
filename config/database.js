const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const dbPath = process.env.DATABASE_URL || './database.sqlite';
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
        } else {
          console.log('Connected to SQLite database.');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const tables = [
        // Sessions table for tracking user sessions
        `CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT 1,
          metadata JSON
        )`,
        
        // Conversations table for storing chat messages
        `CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT,
          message TEXT NOT NULL,
          sender TEXT NOT NULL, -- 'user' or 'bot'
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          message_type TEXT DEFAULT 'text', -- 'text', 'escalation', 'faq'
          confidence_score REAL,
          FOREIGN KEY (session_id) REFERENCES sessions (id)
        )`,
        
        // FAQs table for storing frequently asked questions
        `CREATE TABLE IF NOT EXISTS faqs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          keywords TEXT, -- comma-separated keywords for matching
          category TEXT,
          priority INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // Escalations table for tracking when queries need human intervention
        `CREATE TABLE IF NOT EXISTS escalations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT,
          reason TEXT,
          status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved'
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          resolved_at DATETIME,
          FOREIGN KEY (session_id) REFERENCES sessions (id)
        )`
      ];

      let completed = 0;
      tables.forEach((sql) => {
        this.db.run(sql, (err) => {
          if (err) {
            console.error('Error creating table:', err.message);
            reject(err);
            return;
          }
          completed++;
          if (completed === tables.length) {
            this.seedFAQs().then(resolve).catch(reject);
          }
        });
      });
    });
  }

  async seedFAQs() {
    return new Promise((resolve, reject) => {
      // Check if FAQs already exist
      this.db.get('SELECT COUNT(*) as count FROM faqs', (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row.count > 0) {
          resolve(); // FAQs already seeded
          return;
        }

        // Seed initial FAQs
        const faqs = [
          {
            question: "What are your business hours?",
            answer: "Our customer support is available 24/7. For sales inquiries, our team is available Monday-Friday, 9 AM - 6 PM EST.",
            keywords: "hours,time,available,when,open,closed",
            category: "general",
            priority: 1
          },
          {
            question: "How can I reset my password?",
            answer: "To reset your password: 1) Go to the login page, 2) Click 'Forgot Password', 3) Enter your email address, 4) Check your email for reset instructions.",
            keywords: "password,reset,forgot,login,access",
            category: "account",
            priority: 2
          },
          {
            question: "What payment methods do you accept?",
            answer: "We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers for enterprise customers.",
            keywords: "payment,credit card,paypal,billing,pay",
            category: "billing",
            priority: 2
          },
          {
            question: "How do I cancel my subscription?",
            answer: "To cancel your subscription: 1) Log into your account, 2) Go to Settings > Subscription, 3) Click 'Cancel Subscription', 4) Follow the confirmation steps.",
            keywords: "cancel,subscription,stop,end,terminate",
            category: "billing",
            priority: 1
          },
          {
            question: "Do you offer refunds?",
            answer: "Yes, we offer a 30-day money-back guarantee for all new subscriptions. Contact our support team to process your refund request.",
            keywords: "refund,money back,return,guarantee",
            category: "billing",
            priority: 2
          }
        ];

        let completed = 0;
        faqs.forEach((faq) => {
          this.db.run(
            'INSERT INTO faqs (question, answer, keywords, category, priority) VALUES (?, ?, ?, ?, ?)',
            [faq.question, faq.answer, faq.keywords, faq.category, faq.priority],
            (err) => {
              if (err) {
                console.error('Error seeding FAQ:', err.message);
                reject(err);
                return;
              }
              completed++;
              if (completed === faqs.length) {
                console.log(`Seeded ${faqs.length} FAQs`);
                resolve();
              }
            }
          );
        });
      });
    });
  }

  getDb() {
    return this.db;
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = new Database();