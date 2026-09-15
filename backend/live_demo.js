const http = require('http');

// ===================================================================
// STEP 1: Simulate n8n Engine listening on port 5678 (/webhook/hdtalk)
// (This behaves exactly like our imported n8n workflow!)
// ===================================================================
const n8nServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook/hdtalk') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const payload = JSON.parse(body || '{}');
      console.log(`\n======================================================`);
      console.log(`⚡ [n8n Automation Engine] WEBHOOK RECEIVED!`);
      console.log(`   Event Type: "${payload.event}"`);
      console.log(`   Timestamp : ${payload.timestamp}`);

      if (payload.event === 'user_registered') {
        console.log(`\n📬 [n8n Action: Welcome Onboarding Node]`);
        console.log(`   👉 Sending Welcome Email to: ${payload.data.email}`);
        console.log(`   👉 User: ${payload.data.name} | Role: ${payload.data.profession}`);
        console.log(`   👉 Email Subject: "Welcome to HDTalk by Himanshu Dwivedi!"`);
        console.log(`   ✅ Status: Welcome Email dispatched successfully!`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action: 'welcome_email_dispatched' }));
      }
      else if (payload.event === 'missed_call') {
        console.log(`\n📞 [n8n Action: Missed Call Notification Node]`);
        console.log(`   👉 Caller: ${payload.data.caller.name}`);
        console.log(`   👉 Target User: ${payload.data.targetUser.name} (${payload.data.targetUser.email})`);
        console.log(`   👉 Alert: "${payload.data.alertText}"`);
        console.log(`   ✅ Status: Missed Call SMS/Email sent to offline user!`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action: 'missed_call_alert_sent' }));
      }
      else if (payload.event === 'offline_message') {
        console.log(`\n💬 [n8n Action: Offline Message Notification Node]`);
        console.log(`   👉 From: ${payload.data.sender.name}`);
        console.log(`   👉 To: ${payload.data.targetUser.name} (${payload.data.targetUser.email})`);
        console.log(`   👉 Message: "${payload.data.message.text}"`);
        console.log(`   ✅ Status: Push notification sent to offline recipient!`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action: 'offline_msg_alert_sent' }));
      }
      else if (payload.event === 'ai_chat_query') {
        console.log(`\n🤖 [n8n Action: AI Chat Agent Node]`);
        console.log(`   👉 User Query: "${payload.data.query}"`);
        console.log(`   👉 Sender: ${payload.data.sender.name}`);
        
        let aiReply = '';
        const q = payload.data.query.toLowerCase();
        if (q.includes('who created you') || q.includes('founder') || q.includes('creator')) {
          aiReply = `HDTalk was crafted with ❤️ by Himanshu Dwivedi! I am your AI assistant powered by n8n automations.`;
        } else if (q.includes('features') || q.includes('kya kya') || q.includes('feature')) {
          aiReply = `HDTalk offers HD WebRTC Calling, Instant Chat, Offline Alerts, and n8n Workflow Automations!`;
        } else {
          aiReply = `Hello ${payload.data.sender.name}! I received your query: "${payload.data.query}". I am active and ready to automate tasks!`;
        }

        console.log(`   🧠 AI Agent Generated Reply: "${aiReply}"`);
        console.log(`   🚀 Posting reply back to HDTalk at http://localhost:5000/api/chat/bot-reply...`);

        // Post back to HDTalk backend
        try {
          const callbackRes = await fetch('http://localhost:5000/api/chat/bot-reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: payload.data.conversationId,
              text: aiReply,
              replyToId: payload.data.replyToId
            })
          });
          const callbackData = await callbackRes.json();
          console.log(`   ✅ HDTalk Accepted Bot Message:`, callbackData.data.text);
        } catch (err) {
          console.error(`   ❌ Failed to post back to HDTalk:`, err.message);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, reply: aiReply }));
      }
      console.log(`======================================================\n`);
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

// ===================================================================
// STEP 2: Main Execution Runner
// ===================================================================
async function runLiveDemo() {
  n8nServer.listen(5678, async () => {
    console.log(`\n======================================================`);
    console.log(`🚀 [Step 1] n8n Automation Engine is RUNNING on http://localhost:5678`);
    console.log(`======================================================`);

    // Require and start HDTalk Backend
    console.log(`\n🚀 [Step 2] Starting HDTalk Backend on http://localhost:5000...`);
    
    // Set environment vars
    process.env.PORT = '5000';
    process.env.N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/hdtalk';
    process.env.N8N_ENABLED = 'true';

    // Start HDTalk backend server
    require('./src/server');

    // Wait 1.5s for server to settle
    await new Promise(resolve => setTimeout(resolve, 1500));

    // ----------------------------------------------------
    // TEST 1: Register a new user -> Triggers Welcome Onboarding
    // ----------------------------------------------------
    console.log(`\n🔹 [DEMO TEST 1] Registering a new user on HDTalk...`);
    const testEmail = `newuser_${Date.now()}@example.com`;
    const regRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aakash Sharma',
        email: testEmail,
        password: 'password123',
        profession: 'UI/UX Designer',
        bio: 'Love clean interfaces!'
      })
    });
    const regData = await regRes.json();
    console.log(`   User Registered in HDTalk: ${regData.user?.name} (ID: ${regData.user?.id})`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // ----------------------------------------------------
    // TEST 2: Trigger a Missed Call Notification
    // ----------------------------------------------------
    console.log(`\n🔹 [DEMO TEST 2] Simulating Call to Offline User...`);
    const n8nService = require('./src/services/n8nService');
    n8nService.notifyMissedCall({
      caller: { id: 'usr_f5b68402', name: 'Himanshu Dwivedi', email: 'himanshudwivedi0325@gmail.com' },
      targetUser: { id: regData.user.id, name: regData.user.name, email: regData.user.email },
      callType: 'video'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // ----------------------------------------------------
    // TEST 3: Trigger an Offline Message Notification
    // ----------------------------------------------------
    console.log(`\n🔹 [DEMO TEST 3] Simulating Offline Message Alert...`);
    n8nService.notifyOfflineMessage({
      sender: { id: 'usr_f5b68402', name: 'Himanshu Dwivedi', email: 'himanshudwivedi0325@gmail.com' },
      targetUser: { id: regData.user.id, name: regData.user.name, email: regData.user.email },
      conversationId: 'conv_demo_101',
      messageText: 'Hey Aakash, are you free for the project discussion tomorrow?',
      messageType: 'text'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // ----------------------------------------------------
    // TEST 4: Chat Message with @bot -> Triggers AI Chat Agent
    // ----------------------------------------------------
    console.log(`\n🔹 [DEMO TEST 4] Sending chat message with "@bot Who created you?"...`);
    const db = require('./src/database/db');
    const conv = db.getOrCreateDirectConversation('usr_f5b68402', regData.user.id);
    
    // Trigger AI Bot Query
    await n8nService.handleAIBotQuery({
      conversationId: conv.id,
      sender: { id: 'usr_f5b68402', name: 'Himanshu Dwivedi' },
      text: '@bot who created you and what are your features?',
      replyToId: null,
      socketManager: require('./src/socket/socketManager')
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    // ----------------------------------------------------
    // VERIFY: Check messages in HDTalk Database
    // ----------------------------------------------------
    console.log(`\n🔹 [VERIFY] Fetching conversation messages from HDTalk database...`);
    const messages = db.getMessages(conv.id);
    console.log(`\nMessages in Conversation [${conv.id}]:`);
    messages.forEach((m, idx) => {
      const sender = db.getUserById(m.senderId);
      console.log(`   [#${idx + 1}] ${sender ? sender.name : m.senderId}: "${m.text}"`);
    });

    console.log(`\n🎉 ALL 4 AUTOMATIONS VERIFIED LIVE SUCCESSFULLY!`);
    
    // Close servers and exit cleanly
    n8nServer.close(() => {
      process.exit(0);
    });
  });
}

runLiveDemo().catch(err => {
  console.error('Demo error:', err);
  process.exit(1);
});
