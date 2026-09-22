const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const n8nService = require('../services/n8nService');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const { n8nAskLimiter } = require('../middleware/rateLimiter');

/**
 * 1. Admin-only: Get n8n integration status & health
 * GET /api/n8n/status
 * Note: Internal webhook URLs are strictly scrubbed to prevent infrastructure disclosure
 */
router.get('/status', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const status = n8nService.getN8nStatus();
    // Ensure internal webhook URL is never leaked
    const { webhookUrl, ...safeStatus } = status;
    res.json({
      success: true,
      service: 'HDTalk n8n Automation Engine',
      ...safeStatus
    });
  } catch (err) {
    console.error('[n8n] Status check error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve n8n service status.' });
  }
});

/**
 * 2. Authenticated: Trigger a test webhook dispatch
 * POST /api/n8n/test
 */
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const startTime = Date.now();
    const testPayload = {
      event: 'test_ping',
      timestamp: new Date().toISOString(),
      triggeredBy: {
        id: req.user.id,
        name: req.user.name
      },
      message: 'Test webhook event dispatched from HDTalk diagnostics'
    };

    const result = await n8nService.sendWebhook(testPayload);
    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      message: 'Webhook test executed successfully.',
      latencyMs,
      mode: config.N8N_WEBHOOK_URL ? 'External n8n Instance' : 'Built-in Smart Automation Engine',
      webhookResponse: result || { status: 'Delivered (fallback response)' }
    });
  } catch (err) {
    console.error('[n8n] Webhook test error:', err.message);
    res.status(500).json({ success: false, message: 'Webhook test failed. Please check n8n service connectivity.' });
  }
});

const validate = require('../middleware/validate');
const { n8nSchemas } = require('../validation/schemas');

/**
 * 3. Authenticated: Interactive AI Chatbot Query for Help & Support
 * POST /api/n8n/ask
 * Protected by authMiddleware + dedicated rate limiter: 10 requests per 10 minutes
 */
router.post('/ask', authMiddleware, n8nAskLimiter, validate(n8nSchemas.ask), async (req, res) => {
  try {
    const { question, senderName } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Question cannot be empty.' });
    }

    const payload = {
      event: 'ai_chat_query',
      timestamp: new Date().toISOString(),
      data: {
        query: question.trim(),
        sender: {
          name: senderName || 'User',
          email: 'support@hdtalk.ai'
        }
      }
    };

    let reply = null;
    let mode = 'Built-in Smart Automation Engine';

    if (config.N8N_ENABLED && config.N8N_WEBHOOK_URL) {
      const webhookRes = await n8nService.sendWebhook(payload);
      if (webhookRes && (webhookRes.reply || webhookRes.message || webhookRes.output)) {
        reply = webhookRes.reply || webhookRes.message || webhookRes.output;
        mode = 'External n8n Workflow Cluster';
      }
    }

    if (!reply) {
      reply = n8nService.generateSmartAIResponse(question, senderName || 'User');
    }

    res.json({
      success: true,
      answer: reply,
      mode,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[n8n] Ask endpoint error:', err.message);
    res.status(500).json({ success: false, message: 'AI assistant is temporarily unavailable. Please try again later.' });
  }
});

/**
 * 4. Authenticated: Download/View pre-packaged n8n workflow definition
 * GET /api/n8n/workflow
 * SEC-7 FIX: Requires authentication — internal automation topology should not be public
 */
router.get('/workflow', authMiddleware, (req, res) => {
  try {
    const workflowPath = path.join(__dirname, '../../../hdtalk-automation-workflow.json');
    if (fs.existsSync(workflowPath)) {
      const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
      res.json(workflowData);
    } else {
      res.status(404).json({ success: false, message: 'Workflow schema file not found.' });
    }
  } catch (err) {
    console.error('[n8n] Workflow download error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve workflow definition.' });
  }
});

module.exports = router;
