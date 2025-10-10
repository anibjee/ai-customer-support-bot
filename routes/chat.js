const express = require('express');
const router = express.Router();
const botService = require('../src/botService');
const Session = require('../models/Session');
const Conversation = require('../models/Conversation');
const { v4: uuidv4 } = require('uuid');

// Start new chat session
router.post('/session', async (req, res) => {
  try {
    const { user_id, metadata } = req.body;
    
    const session = await Session.create(user_id, metadata || {});
    
    res.json({
      success: true,
      data: {
        session_id: session.id,
        message: "Hello! I'm your customer support assistant. How can I help you today?",
        created_at: session.created_at
      }
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create chat session',
      message: error.message
    });
  }
});

// Send message to bot
router.post('/message', async (req, res) => {
  try {
    const { session_id, message, user_id } = req.body;
    
    if (!session_id || !message) {
      return res.status(400).json({
        success: false,
        error: 'session_id and message are required'
      });
    }

    const response = await botService.processMessage(session_id, message, user_id);
    
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      message: error.message
    });
  }
});

// Get conversation history
router.get('/session/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50 } = req.query;
    
    const messages = await Conversation.getConversationHistory(sessionId, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        session_id: sessionId,
        messages: messages,
        count: messages.length
      }
    });
  } catch (error) {
    console.error('Error getting conversation history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation history',
      message: error.message
    });
  }
});

// Get session summary
router.get('/session/:sessionId/summary', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const summary = await botService.getSessionSummary(sessionId);
    
    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting session summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session summary',
      message: error.message
    });
  }
});

// End chat session
router.post('/session/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const result = await botService.endSession(sessionId);
    
    res.json({
      success: true,
      data: {
        ...result,
        message: "Thank you for using our customer support. Your session has been ended."
      }
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end session',
      message: error.message
    });
  }
});

// Get active sessions (for admin/monitoring)
router.get('/sessions', async (req, res) => {
  try {
    const { active_only = true } = req.query;
    
    const sessions = await botService.getAllSessions(active_only === 'true');
    
    res.json({
      success: true,
      data: {
        sessions,
        count: sessions.length
      }
    });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sessions',
      message: error.message
    });
  }
});

// Health check for chat service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'chat',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;