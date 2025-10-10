require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Import database and initialize
const database = require('../config/database');

// Import routes
const chatRoutes = require('../routes/chat');
const faqRoutes = require('../routes/faq');
const escalationRoutes = require('../routes/escalation');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 
    ['https://your-domain.com'] : 
    ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'ai-customer-support-bot',
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/escalation', escalationRoutes);

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'AI Customer Support Bot API',
    version: '1.0.0',
    documentation: {
      chat: {
        'POST /api/chat/session': 'Start new chat session',
        'POST /api/chat/message': 'Send message to bot',
        'GET /api/chat/session/:id/history': 'Get conversation history',
        'GET /api/chat/session/:id/summary': 'Get session summary',
        'POST /api/chat/session/:id/end': 'End chat session',
        'GET /api/chat/sessions': 'Get all sessions',
        'GET /api/chat/health': 'Chat service health check'
      },
      faq: {
        'GET /api/faq': 'Get all FAQs',
        'GET /api/faq/search': 'Search FAQs',
        'POST /api/faq/match': 'Find best FAQ match',
        'GET /api/faq/categories': 'Get FAQ categories',
        'POST /api/faq': 'Create new FAQ (admin)',
        'PUT /api/faq/:id': 'Update FAQ (admin)',
        'DELETE /api/faq/:id': 'Delete FAQ (admin)'
      },
      escalation: {
        'GET /api/escalation': 'Get all escalations',
        'GET /api/escalation/:id': 'Get specific escalation',
        'PUT /api/escalation/:id/status': 'Update escalation status',
        'GET /api/escalation/session/:id': 'Get session escalations',
        'POST /api/escalation/analyze': 'Analyze escalation need',
        'GET /api/escalation/stats/overview': 'Get escalation statistics',
        'POST /api/escalation/simulate': 'Simulate escalation (testing)'
      }
    },
    examples: {
      start_session: {
        method: 'POST',
        url: '/api/chat/session',
        body: { user_id: 'optional_user_id', metadata: {} }
      },
      send_message: {
        method: 'POST',
        url: '/api/chat/message',
        body: { session_id: 'session_uuid', message: 'Hello, I need help' }
      },
      search_faq: {
        method: 'GET',
        url: '/api/faq/search?q=password reset&limit=5'
      }
    }
  });
});

// Serve chat interface at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// 404 handler for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && !req.route) {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      available_endpoints: [
        'GET /api',
        'GET /health',
        'POST /api/chat/session',
        'POST /api/chat/message',
        'GET /api/faq',
        'GET /api/escalation'
      ]
    });
  } else {
    next();
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('🔄 Initializing database...');
    await database.init();
    console.log('✅ Database initialized successfully');
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 AI Customer Support Bot is running on port ${PORT}`);
      console.log(`📱 Chat Interface: http://localhost:${PORT}`);
      console.log(`📖 API Documentation: http://localhost:${PORT}/api`);
      console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      if (process.env.HF_API_KEY && process.env.HF_API_KEY !== 'your_hugging_face_api_key_here') {
        console.log('🤖 Hugging Face LLM: Enabled');
      } else if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_compatible_key_here') {
        console.log('🤖 OpenAI-compatible LLM: Enabled');
      } else {
        console.log('🤖 LLM: Using fallback responses (configure API keys for full functionality)');
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('📴 SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('💤 Server closed');
        database.close();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('📴 SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('💤 Server closed');
        database.close();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;