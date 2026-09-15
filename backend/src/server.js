const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const config = require('./config/config');
const { initSocket, getMetrics } = require('./socket/socketManager');

const db = require('./database/db');
const { authLimiter } = require('./middleware/rateLimiter');

// Route handlers
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const webrtcRoutes = require('./routes/webrtcRoutes');
const pushRoutes = require('./routes/pushRoutes');

const app = express();

// Enable reverse proxy trust (Nginx / Cloudflare / Render / Railway)
app.set('trust proxy', 1);

// Determine native HTTPS or HTTP transport
let server;
if (config.SSL_KEY_PATH && config.SSL_CERT_PATH && fs.existsSync(config.SSL_KEY_PATH) && fs.existsSync(config.SSL_CERT_PATH)) {
  const https = require('https');
  server = https.createServer({
    key: fs.readFileSync(config.SSL_KEY_PATH),
    cert: fs.readFileSync(config.SSL_CERT_PATH)
  }, app);
  console.log('[Server] Native TLS/HTTPS termination enabled (PEM key/cert).');
} else if (config.SSL_PFX_PATH && fs.existsSync(config.SSL_PFX_PATH)) {
  const https = require('https');
  server = https.createServer({
    pfx: fs.readFileSync(config.SSL_PFX_PATH),
    passphrase: config.SSL_PASSPHRASE || undefined
  }, app);
  console.log('[Server] Native TLS/HTTPS termination enabled (PKCS#12/PFX).');
} else {
  server = http.createServer(app);
}

// Ensure uploads folder exists
if (!fs.existsSync(config.UPLOAD_DIR)) {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
}

// Allowed origins
const allowedOrigins = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.split(',').map(s => s.trim()) 
  : ['*'];

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes('*')) return true;
  if (origin.endsWith('.loca.lt') || origin.endsWith('.ngrok-free.app') || origin.endsWith('.onrender.com')) return true;
  if (origin === `http://localhost:${config.PORT}` || origin === `http://127.0.0.1:${config.PORT}`) return true;
  if (origin === `https://localhost:${config.PORT}` || origin === `https://127.0.0.1:${config.PORT}`) return true;
  return allowedOrigins.includes(origin);
};

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// HTTP -> HTTPS 301 Redirect when behind production reverse proxy
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Defensive Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded media files
app.use('/uploads', express.static(config.UPLOAD_DIR));

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/webrtc', webrtcRoutes);
app.use('/api/push', pushRoutes);

// Global API & Multer error handler
const multer = require('multer');
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'File too large. Maximum permitted size is 25MB.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

// Health check probes (Liveness & Readiness)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'HDTalk Real-Time Server',
    creator: 'Himanshu Dwivedi',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health/live', (req, res) => {
  res.json({
    status: 'live',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    creator: 'Himanshu Dwivedi'
  });
});

// Track real-time event loop delay
let lastLagCheck = Date.now();
let currentEventLoopLag = 0;
setInterval(() => {
  const now = Date.now();
  currentEventLoopLag = Math.max(0, now - lastLagCheck - 100);
  lastLagCheck = now;
}, 100).unref();

app.get('/api/health/ready', (req, res) => {
  try {
    const isDbHealthy = db && typeof db.getDb === 'function' && !!db.getDb();
    const isUploadsWritable = fs.existsSync(config.UPLOAD_DIR);
    const mem = process.memoryUsage();

    if (!isDbHealthy || !isUploadsWritable) {
      return res.status(503).json({
        status: 'unready',
        database: isDbHealthy ? 'connected' : 'unhealthy',
        storage: isUploadsWritable ? 'writable' : 'unreachable',
        memory: mem,
        creator: 'Himanshu Dwivedi'
      });
    }

    res.json({
      status: 'ready',
      database: 'connected',
      storage: 'writable',
      mediaStorage: require('./services/cloudMediaService').getStorageStatus(),
      uptime: process.uptime(),
      memory: {
        rssMB: (mem.rss / 1024 / 1024).toFixed(2),
        heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(2)
      },
      eventLoopLagMs: currentEventLoopLag,
      sockets: typeof getMetrics === 'function' ? getMetrics() : {},
      creator: 'Himanshu Dwivedi',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      message: err.message,
      creator: 'Himanshu Dwivedi'
    });
  }
});

// Real-time telemetry monitoring endpoint for continuous soak testing
app.get('/api/health/telemetry', (req, res) => {
  try {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const sockMetrics = typeof getMetrics === 'function' ? getMetrics() : {};
    const databaseState = db.getDb();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      eventLoopLagMs: currentEventLoopLag,
      memory: {
        rssMB: +(mem.rss / 1024 / 1024).toFixed(2),
        heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(2),
        externalMB: +(mem.external / 1024 / 1024).toFixed(2)
      },
      cpu: {
        userMicros: cpu.user,
        systemMicros: cpu.system
      },
      sockets: sockMetrics,
      database: {
        users: databaseState?.users?.length || 0,
        conversations: databaseState?.conversations?.length || 0,
        messages: databaseState?.messages?.length || 0
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by Socket.io CORS policy'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8 // 100MB for media & signaling packets
});

initSocket(io);

// Serve static frontend build if available (Unified full-stack deployment)
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Start server
server.listen(config.PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 HDTalk Backend running on http://localhost:${config.PORT}`);
  console.log(`⚡ Created with ❤️ by Himanshu Dwivedi`);
  console.log(`⚡ Socket.io Real-Time & WebRTC Engine is ACTIVE`);
  console.log(`⚡ Unified Frontend Hosting: ${fs.existsSync(frontendDist) ? 'ENABLED' : 'STANDALONE (API Mode)'}`);
  console.log(`=================================================`);
});

// Graceful shutdown
const handleShutdown = (signal) => {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  try {
    db.flushSync();
    console.log('[Server] In-memory database changes flushed to disk.');
  } catch (err) {
    console.error('[Server] Error flushing database on shutdown:', err);
  }
  server.close(() => {
    console.log('[Server] HTTP & Socket.io server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
