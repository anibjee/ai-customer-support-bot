const express = require('express');
const router = express.Router();
const escalationService = require('../src/escalationService');

// Get all escalations or by status
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    
    const escalations = await escalationService.getAllEscalations(status);
    
    res.json({
      success: true,
      data: {
        escalations,
        count: escalations.length,
        status_filter: status || 'all'
      }
    });
  } catch (error) {
    console.error('Error getting escalations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get escalations',
      message: error.message
    });
  }
});

// Get specific escalation
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const escalation = await escalationService.getEscalation(parseInt(id));
    
    if (!escalation) {
      return res.status(404).json({
        success: false,
        error: 'Escalation not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        escalation
      }
    });
  } catch (error) {
    console.error('Error getting escalation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get escalation',
      message: error.message
    });
  }
});

// Update escalation status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolved_by } = req.body;
    
    if (!status || !['pending', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Valid status is required (pending, in_progress, resolved)'
      });
    }
    
    const result = await escalationService.updateEscalationStatus(
      parseInt(id), 
      status, 
      resolved_by
    );
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Escalation not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        message: 'Escalation status updated successfully',
        escalation_id: parseInt(id),
        new_status: status,
        changes: result.changes
      }
    });
  } catch (error) {
    console.error('Error updating escalation status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update escalation status',
      message: error.message
    });
  }
});

// Get escalations for a specific session
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const escalations = await escalationService.getSessionEscalations(sessionId);
    
    res.json({
      success: true,
      data: {
        session_id: sessionId,
        escalations,
        count: escalations.length
      }
    });
  } catch (error) {
    console.error('Error getting session escalations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session escalations',
      message: error.message
    });
  }
});

// Analyze if a message should be escalated (utility endpoint)
router.post('/analyze', async (req, res) => {
  try {
    const { message, conversation_history = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    const analysis = escalationService.shouldEscalate(message, conversation_history);
    
    res.json({
      success: true,
      data: {
        message,
        analysis,
        should_escalate: analysis.should_escalate,
        reason: analysis.reason,
        priority: analysis.priority,
        confidence: analysis.confidence
      }
    });
  } catch (error) {
    console.error('Error analyzing escalation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze escalation',
      message: error.message
    });
  }
});

// Get escalation statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await escalationService.getEscalationStats();
    
    res.json({
      success: true,
      data: {
        stats,
        period: 'last_30_days'
      }
    });
  } catch (error) {
    console.error('Error getting escalation stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get escalation statistics',
      message: error.message
    });
  }
});

// Simulate escalation process (for testing)
router.post('/simulate', async (req, res) => {
  try {
    const { session_id, reason, priority = 'medium' } = req.body;
    
    if (!session_id || !reason) {
      return res.status(400).json({
        success: false,
        error: 'session_id and reason are required'
      });
    }
    
    const escalation = await escalationService.createEscalation(
      session_id,
      reason,
      priority
    );
    
    const escalationType = escalationService.determineEscalationType ? 
      escalationService.determineEscalationType(reason) : 'human_request';
    
    const message = escalationService.generateEscalationMessage(escalationType);
    
    res.status(201).json({
      success: true,
      data: {
        message: 'Escalation created successfully',
        escalation,
        escalation_message: message,
        escalation_type: escalationType
      }
    });
  } catch (error) {
    console.error('Error simulating escalation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate escalation',
      message: error.message
    });
  }
});

module.exports = router;