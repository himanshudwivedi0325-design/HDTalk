const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const config = require('./config/config');
const { initSocket, getMetrics } = require('./socket/socketManager');

const db = require('./database/db');
const { authLimiter, apiLimiter, uploadLimiter } = require('./middleware/rateLimiter');
const authMiddleware = require('./middleware/authMiddleware');
const adminMiddleware = require('./middleware/adminMiddleware');

// Route handlers
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const webrtcRoutes = require('./routes/webrtcRoutes');
const pushRoutes = require('./routes/pushRoutes');
const adminRoutes = require('./routes/adminRoutes');
const n8nRoutes = require('./routes/n8nRoutes');

const app = express();
app.disable('x-powered-by');

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

// Allowed origins: exact string allowlist from ALLOWED_ORIGINS (or CLIENT_URL), comma-separated
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || '*';
const configuredOrigins = new Set(
  rawAllowedOrigins
    .split(',')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (configuredOrigins.has('*') || rawAllowedOrigins.trim() === '*') return true;
  const normalizedOrigin = origin.trim().replace(/\/+$/, '');
  if (configuredOrigins.has(normalizedOrigin)) return true;

  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    // Always permit local development environments
    if (host === 'localhost' || host === '127.0.0.1') {
      return true;
    }
    // Exact subdomain match for Render (endsWith prevents evilrender.com bypass)
    if (host === 'hdtalk.onrender.com' || host.endsWith('.onrender.com')) {
      return true;
    }
  } catch (_) {}

  return false;
};

// Middleware: exempt static assets and handle CORS cleanly
app.use((req, res, next) => {
  if (
    req.path.startsWith('/assets/') ||
    req.path === '/favicon.ico' ||
    req.path === '/robots.txt' ||
    req.path === '/sitemap.xml' ||
    req.path === '/manifest.json' ||
    req.path === '/icon.svg' ||
    req.path === '/icon-192.png' ||
    req.path === '/icon-512.png' ||
    req.path === '/og-image.png' ||
    req.path === '/twitter-image.png' ||
    req.path === '/og-image.svg' ||
    req.path === '/llms.txt' ||
    req.path === '/llms-full.txt'
  ) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return next();
  }
  return cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, origin || true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })(req, res, next);
});

// HTTP -> HTTPS 301 Redirect when behind production reverse proxy
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Helmet Security Headers (HSTS, noSniff, frameguard: deny, referrerPolicy, hidePoweredBy, CSP)
const helmet = require('helmet');
app.use(helmet({
  // Content-Security-Policy (Permissive for Vite SPA + WebRTC + WebSockets)
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
      scriptSrcElem: ["'self'", "'unsafe-inline'", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      styleSrcElem: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
      // Allow WebSocket connections to same origin + configured backend origins
      connectSrc: ["'self'", 'wss:', 'ws:', 'https:', 'http:'],
      // Media (audio/video for WebRTC voice/video)
      mediaSrc: ["'self'", 'blob:', 'data:', 'https:', 'http:'],
      // WebRTC object URLs
      workerSrc: ["'self'", 'blob:'],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
    reportOnly: false,
  },

  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: {
    action: 'deny'
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  hidePoweredBy: true
}));

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  res.setHeader('X-Robots-Tag', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  // SEC-6: Prevent caching of auth/sensitive API responses
  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

// Global NoSQL injection & prototype pollution prevention middleware
const mongoSanitize = require('express-mongo-sanitize');

const sanitizeNoSql = (obj) => {
  if (Array.isArray(obj)) {
    // Recursively sanitize each element in arrays
    obj.forEach((item, i) => {
      if (item && typeof item === 'object') {
        sanitizeNoSql(item);
      }
    });
  } else if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') {
        delete obj[key];
      } else if (obj[key] && typeof obj[key] === 'object') {
        sanitizeNoSql(obj[key]);
      }
    }
  }
  return obj;
};

const noSqlSanitizer = (req, res, next) => {
  if (req.body) sanitizeNoSql(req.body);
  if (req.query) sanitizeNoSql(req.query);
  if (req.params) sanitizeNoSql(req.params);
  next();
};

// Preserve exact raw bytes for HMAC signature verification on webhook endpoints
app.use('/api/chat/bot-reply', express.raw({ type: '*/*', limit: '2mb' }));

app.use(express.json({
  limit: '100kb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(mongoSanitize({
  onSanitize: ({ req, key }) => {
    console.warn(`[Security] express-mongo-sanitize stripped prohibited key: ${key}`);
  }
}));
app.use(noSqlSanitizer);

// Serve static uploaded media files with caching
app.use('/uploads', express.static(config.UPLOAD_DIR, {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/chat', apiLimiter, chatRoutes);
app.use('/api/webrtc', apiLimiter, webrtcRoutes);
app.use('/api/push', apiLimiter, pushRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);
app.use('/api/n8n', apiLimiter, n8nRoutes);

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

// Real-time telemetry monitoring endpoint — Admin-only (requires authentication + admin role)
app.get('/api/health/telemetry', authMiddleware, adminMiddleware, (req, res) => {
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
    console.error('[Telemetry] Error generating telemetry:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to collect telemetry data.' });
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
  // Keep buffer small — file uploads go through /api/chat/upload REST endpoint,
  // not through Socket.IO. Signaling messages (SDP, ICE) are tiny.
  maxHttpBufferSize: 2e6 // 2MB — sufficient for all WebRTC signaling payloads
});

initSocket(io);

// Serve static frontend build if available (Unified full-stack deployment)
const frontendDist = path.join(__dirname, '../../frontend/dist');
const frontendPublic = path.join(__dirname, '../../frontend/public');

// Dedicated SEO & AI Discovery routes (robots.txt, sitemap.xml, llms.txt, llms-full.txt, og-image.png, etc.)
const serveSeoFile = (fileName, contentType, cacheControl = 'public, max-age=86400') => (req, res) => {
  const distPath = path.join(frontendDist, fileName);
  const publicPath = path.join(frontendPublic, fileName);
  const targetPath = fs.existsSync(distPath) ? distPath : (fs.existsSync(publicPath) ? publicPath : null);

  if (targetPath) {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('X-Robots-Tag', 'index, follow');
    return res.sendFile(targetPath);
  }
  res.status(404).send('Not Found');
};

app.get('/robots.txt', serveSeoFile('robots.txt', 'text/plain; charset=utf-8', 'no-cache, no-store, must-revalidate'));
app.get('/sitemap.xml', serveSeoFile('sitemap.xml', 'application/xml; charset=utf-8', 'no-cache, must-revalidate'));
app.get('/llms.txt', serveSeoFile('llms.txt', 'text/markdown; charset=utf-8'));
app.get('/llms-full.txt', serveSeoFile('llms-full.txt', 'text/markdown; charset=utf-8'));
app.get('/og-image.png', serveSeoFile('og-image.png', 'image/png'));
app.get('/twitter-image.png', serveSeoFile('twitter-image.png', 'image/png'));
app.get('/og-image.svg', serveSeoFile('og-image.svg', 'image/svg+xml'));
app.get('/icon-192.png', serveSeoFile('icon-192.png', 'image/png'));
app.get('/icon-512.png', serveSeoFile('icon-512.png', 'image/png'));
app.get('/favicon.ico', serveSeoFile('favicon.ico', 'image/x-icon'));
app.get('/manifest.json', serveSeoFile('manifest.json', 'application/manifest+json; charset=utf-8'));
app.get('/e84a2f7c9b1d3056e1829a4c7f0b2e65.txt', serveSeoFile('e84a2f7c9b1d3056e1829a4c7f0b2e65.txt', 'text/plain; charset=utf-8'));
app.get('/googlefa7a1a36ea6554fc.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send('google-site-verification: googlefa7a1a36ea6554fc.html');
});

// Dynamic Multi-Page SEO Meta Dictionary
const ROUTE_SEO_META = {
  '/': {
    title: 'HDTalk — Free Real-Time Chat & 1080p Video Calling Web App',
    desc: 'HDTalk is an ultra-fast real-time messaging, WebRTC 1080p video calling, and synergy matchmaking web application by Himanshu Dwivedi. Features sub-50ms chats, screen sharing, voice notes, PWA install, and zero ads.',
    canonical: 'https://hdtalk.onrender.com/'
  },
  '/features': {
    title: 'HDTalk Features — Sub-50ms Chat, 1080p WebRTC Video & Screen Sharing',
    desc: 'Explore HDTalk features: 1080p crystal clear WebRTC video calls, sub-50ms Socket.IO chat, Telegram-style replies, PWA offline access, voice notes, and professional matchmaking.',
    canonical: 'https://hdtalk.onrender.com/features'
  },
  '/about': {
    title: 'About HDTalk — Engineered by Himanshu Dwivedi',
    desc: 'Learn about HDTalk, an open-source real-time communication platform engineered by Himanshu Dwivedi using React, Node.js, WebRTC, and Socket.io.',
    canonical: 'https://hdtalk.onrender.com/about'
  },
  '/security': {
    title: 'HDTalk Security & Privacy — DTLS-SRTP WebRTC Encryption',
    desc: 'HDTalk privacy and security standards: DTLS-SRTP peer-to-peer media encryption, salted bcrypt authentication, zero adware, and strict data sanitization.',
    canonical: 'https://hdtalk.onrender.com/security'
  },
  '/faq': {
    title: 'HDTalk FAQ — Questions & Answers about HDTalk WebRTC Calling',
    desc: 'Common questions about HDTalk: free browser-based video calling, 1080p screen sharing, sub-50ms real-time chat, and PWA installation.',
    canonical: 'https://hdtalk.onrender.com/faq'
  },
  '/privacy': {
    title: 'HDTalk Privacy Policy — Transparent & Secure',
    desc: 'HDTalk Privacy Policy. We respect your confidentiality with end-to-end peer encryption, zero third-party tracking, and no data sales.',
    canonical: 'https://hdtalk.onrender.com/privacy'
  },
  '/terms': {
    title: 'HDTalk Terms of Service — Fair & Open Communication',
    desc: 'HDTalk Terms of Service for using real-time chat, WebRTC video calling, and matchmaking services.',
    canonical: 'https://hdtalk.onrender.com/terms'
  }
};

let cachedIndexHtml = null;
let lastIndexMtime = 0;

const getIndexHtmlWithSeo = (pathname) => {
  const indexPath = path.join(frontendDist, 'index.html');
  if (!fs.existsSync(indexPath)) return null;

  try {
    const stat = fs.statSync(indexPath);
    if (!cachedIndexHtml || stat.mtimeMs > lastIndexMtime) {
      cachedIndexHtml = fs.readFileSync(indexPath, 'utf8');
      lastIndexMtime = stat.mtimeMs;
    }

    const cleanPath = pathname.split('?')[0].replace(/\/+$/, '') || '/';
    const seo = ROUTE_SEO_META[cleanPath] || ROUTE_SEO_META['/'];

    let html = cachedIndexHtml;
    // Inject route-specific title
    html = html.replace(/<title>.*?<\/title>/i, `<title>${seo.title}</title>`);
    html = html.replace(/<meta name="title" content=".*?" \/>/i, `<meta name="title" content="${seo.title}" />`);
    // Inject route-specific description
    html = html.replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${seo.desc}" />`);
    // Inject route-specific canonical
    html = html.replace(/<link rel="canonical" href=".*?" \/>/i, `<link rel="canonical" href="${seo.canonical}" />`);
    // Inject Open Graph tags
    html = html.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${seo.title}" />`);
    html = html.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${seo.desc}" />`);
    html = html.replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${seo.canonical}" />`);
    // Inject Twitter Card tags
    html = html.replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${seo.title}" />`);
    html = html.replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${seo.desc}" />`);

    return html;
  } catch (err) {
    console.error('[SEO] Error processing index.html SEO injection:', err);
    return null;
  }
};

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, {
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
    const htmlWithSeo = getIndexHtmlWithSeo(req.path);
    if (htmlWithSeo) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Robots-Tag', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
      return res.send(htmlWithSeo);
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
