const express = require('express');
const router = express.Router();
const faqService = require('../src/faqService');

// Get all FAQs or by category
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    
    const faqs = await faqService.getAllFAQs(category);
    
    res.json({
      success: true,
      data: {
        faqs,
        count: faqs.length,
        category: category || 'all'
      }
    });
  } catch (error) {
    console.error('Error getting FAQs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get FAQs',
      message: error.message
    });
  }
});

// Search FAQs
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    const results = await faqService.searchFAQs(q, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        query: q,
        results,
        count: results.length
      }
    });
  } catch (error) {
    console.error('Error searching FAQs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search FAQs',
      message: error.message
    });
  }
});

// Find best match for a query
router.post('/match', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const match = await faqService.findBestMatch(query);
    
    if (!match) {
      return res.json({
        success: true,
        data: {
          query,
          match: null,
          message: 'No suitable FAQ match found'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        query,
        match
      }
    });
  } catch (error) {
    console.error('Error finding FAQ match:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find FAQ match',
      message: error.message
    });
  }
});

// Get FAQ categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await faqService.getFAQCategories();
    
    res.json({
      success: true,
      data: {
        categories,
        count: categories.length
      }
    });
  } catch (error) {
    console.error('Error getting FAQ categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get FAQ categories',
      message: error.message
    });
  }
});

// Add new FAQ (admin endpoint)
router.post('/', async (req, res) => {
  try {
    const { question, answer, keywords, category, priority } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        error: 'Question and answer are required'
      });
    }

    const faq = await faqService.addFAQ(
      question,
      answer,
      keywords || '',
      category || 'general',
      priority || 0
    );
    
    res.status(201).json({
      success: true,
      data: {
        message: 'FAQ created successfully',
        faq
      }
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create FAQ',
      message: error.message
    });
  }
});

// Update FAQ (admin endpoint)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const result = await faqService.updateFAQ(parseInt(id), updateData);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        message: 'FAQ updated successfully',
        changes: result.changes
      }
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update FAQ',
      message: error.message
    });
  }
});

// Delete FAQ (admin endpoint)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await faqService.deleteFAQ(parseInt(id));
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        message: 'FAQ deleted successfully',
        deleted_count: result.deletedCount
      }
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete FAQ',
      message: error.message
    });
  }
});

module.exports = router;