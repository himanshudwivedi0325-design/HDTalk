const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const n8nService = require('../services/n8nService');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * 1. Public: Get n8n integration status & health
 * GET /api/n8n/status
 */
router.get('/status', (req, res) => {
  try {
    const status = n8nService.getN8nStatus();
    res.json({
      success: true,
      service: 'HDTalk n8n Automation Engine',
      ...status
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
        name: req.user.name,
        email: req.user.email
      },
      message: 'Test webhook event dispatched from HDTalk diagnostics'
    };

    const result = await n8nService.sendWebhook(testPayload);
    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      message: 'Webhook test executed successfully.',
      latencyMs,
      endpoint: config.N8N_WEBHOOK_URL || '(Internal autonomous engine)',
      mode: config.N8N_WEBHOOK_URL ? 'External n8n Instance' : 'Built-in Smart Automation Engine',
      webhookResponse: result || { status: 'Delivered (fallback response)' }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 3. Public: Download/View pre-packaged n8n workflow definition
 * GET /api/n8n/workflow
 */
router.get('/workflow', (req, res) => {
  try {
    const workflowPath = path.join(__dirname, '../../../hdtalk-automation-workflow.json');
    if (fs.existsSync(workflowPath)) {
      const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
      res.json(workflowData);
    } else {
      res.status(404).json({ success: false, message: 'Workflow schema file not found.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
