# HDTalk ⚡ - Complete Production Deployment & Infrastructure Guide

> **Created with ❤️ by Himanshu Dwivedi**

This guide provides comprehensive, battle-tested instructions for deploying **HDTalk** to cloud platforms, container hosts, and custom Linux VPS servers with full SSL, reverse proxy WebSocket routing, health monitoring, and rollback safeguards.

---

## 📋 Table of Contents
1. [Architecture & Deployment Models](#1-architecture--deployment-models)
2. [Option 1: Unified Deployment on Render.com](#option-1-unified-deployment-on-rendercom-recommended)
3. [Option 2: Unified Deployment on Railway.app](#option-2-unified-deployment-on-railwayapp)
4. [Option 3: Docker & Docker Compose (VPS / Cloud VM)](#option-3-docker--docker-compose-self-hosted-cloud--vps)
5. [Option 4: Decoupled (Vercel Frontend + Render/Railway Backend)](#option-4-decoupled-vercel-frontend--renderrailway-backend)
6. [Option 5: Ubuntu VPS with Nginx, PM2 & Free SSL (Let's Encrypt)](#option-5-ubuntu-vps-with-nginx-pm2--free-ssl-lets-encrypt)
7. [Production Health Checks & Probes](#7-production-health-checks--probes)
8. [Rate Limiting & Security Configuration](#8-rate-limiting--security-configuration)
9. [WebRTC Production STUN/TURN Architecture](#9-webrtc-production-stunturn-architecture)
10. [Rollback & Disaster Recovery Procedures](#10-rollback--disaster-recovery-procedures)
11. [Production Verification Checklist](#11-production-verification-checklist)

---

## 1. Architecture & Deployment Models

HDTalk supports two deployment models:

| Model | Setup Complexity | Recommended Hosts | Description |
| :--- | :--- | :--- | :--- |
| **Unified Full-Stack** *(Recommended)* | ⭐ Very Low (1 service) | Render, Railway, Docker, VPS | Single Node.js server serves the React client SPA, REST APIs, Socket.io, and WebRTC signaling on the same port. |
| **Decoupled** | ⭐⭐ Medium (2 services) | Vercel (Edge) + Render/Railway (API) | Frontend deployed to static edge CDN, backend deployed to container compute with strict CORS. |

---

## Option 1: Unified Deployment on Render.com (Recommended)

Render offers a simple deployment pipeline for Node.js Web Services.

### Steps:
1. Push your repository to **GitHub** or **GitLab**.
2. Log into [Render.com](https://render.com) and click **New +** -> **Web Service**.
3. Select your repository.
4. Fill in the deployment settings:
   - **Name**: `hdtalk-app`
   - **Region**: Closest to your users (e.g., Frankfurt, Singapore, Oregon)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm run install:all && npm run build
     ```
   - **Start Command**:
     ```bash
     npm run start
     ```
5. Add Environment Variables under **Advanced**:
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `JWT_SECRET`: Generate a secure random 32+ character string
   - `CLIENT_URL`: `https://hdtalk-app.onrender.com`
6. Click **Create Web Service**.
7. Render will provide a free HTTPS URL with automated SSL certificates.

---

## Option 2: Unified Deployment on Railway.app

1. Log into [Railway.app](https://railway.app) and click **New Project** -> **Deploy from GitHub repo**.
2. Select your repository.
3. In project settings, add the following variables:
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `your_production_secret_key_here`
   - `CLIENT_URL`: `*` (or your assigned Railway domain)
4. Under **Build Settings**:
   - **Build Command**: 
     ```bash
     npm run install:all && npm run build
     ```
   - **Start Command**: 
     ```bash
     npm run start
     ```
5. Railway will automatically detect the port, provision an SSL certificate, and deploy the application.

---

## Option 3: Docker & Docker Compose (Self-Hosted Cloud / VPS)

HDTalk includes a multi-stage Dockerfile and docker-compose.yml.

### Quick Deploy:
```bash
# Clone repository
git clone https://github.com/your-username/chatz-ultra.git
cd chatz-ultra

# Build and start in detached mode
docker-compose up -d --build

# View real-time logs
docker-compose logs -f
```

The container automatically persists your database (`backend/data`) and media uploads (`backend/uploads`) in persistent Docker volumes.

---

## Option 4: Decoupled (Vercel Frontend + Render/Railway Backend)

If you prefer hosting the React frontend on Vercel:

### 1. Deploy Backend to Render or Railway:
- Set Root Directory to `backend`.
- Set Build Command to `npm install`.
- Set Start Command to `npm start`.
- Note down the backend URL (e.g., `https://hdtalk-api.onrender.com`).

### 2. Deploy Frontend to Vercel:
- Import repository into [Vercel](https://vercel.com).
- Set Root Directory to `frontend`.
- Add Environment Variables:
  - `VITE_API_URL`: `https://hdtalk-api.onrender.com`
  - `VITE_SOCKET_URL`: `https://hdtalk-api.onrender.com`
- In backend environment variables, update `CLIENT_URL` to your Vercel URL (e.g., `https://hdtalk.vercel.app`) to ensure strict CORS and WebSocket authorization.

---

## Option 5: Ubuntu VPS with Nginx, PM2 & Free SSL (Let's Encrypt)

For high-performance self-hosting on AWS EC2, DigitalOcean Droplet, Hetzner, or Linode:

### 1. System Setup
```bash
# Update server packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS, Nginx, Git, Certbot
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git certbot python3-certbot-nginx

# Install PM2 process manager
sudo npm install -g pm2
```

### 2. Clone & Build
```bash
cd /var/www
git clone https://github.com/your-username/chatz-ultra.git hdtalk
cd hdtalk

# Install all dependencies and build frontend
npm run install:all
npm run build
```

### 3. Start Backend with PM2
```bash
cd /var/www/hdtalk/backend
pm2 start src/server.js --name "hdtalk"
pm2 save
pm2 startup
```

### 4. Configure Nginx Reverse Proxy with WebSocket & TLS Support
Create `/etc/nginx/sites-available/hdtalk`:
```nginx
# HTTP -> HTTPS 301 Permanent Redirect
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

# Production HTTPS + WSS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Certificates (managed via Certbot Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Upload Limit (30MB to accommodate 25MB multipart payloads)
    client_max_body_size 30M;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Defensive Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # WebSocket Upgrade Headers (WSS -> WS)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forwarded Client & Protocol Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # Long-Lived WebSocket Timeout Configuration (Prevent mid-call disconnects)
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 60s;
        proxy_buffering off;
    }
}
```

Enable site and test Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/hdtalk /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Install Free SSL with Certbot
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 7. Production Health Checks & Probes

HDTalk includes formal cloud-native health check probes for container orchestrators (Docker, Kubernetes, Nomad):

- **General Health (`GET /api/health`)**:
  - Returns service status, creator attribution, uptime, and timestamp.
- **Liveness Probe (`GET /api/health/live`)**:
  - Verifies process execution and Node.js event loop responsiveness.
  - Returns HTTP 200 OK.
- **Readiness Probe (`GET /api/health/ready`)**:
  - Validates storage subsystem writability (`uploads/`), database connectivity (`data/db.json`), and memory usage metrics (RSS, Heap).
  - Returns HTTP 200 OK when ready to serve traffic, or HTTP 503 Service Unavailable if degraded.

### Kubernetes Probe Example:
```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 5000
  initialDelaySeconds: 5
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 5000
  initialDelaySeconds: 10
  periodSeconds: 15
```

---

## 8. Rate Limiting & Security Configuration

HDTalk includes built-in in-memory rate limiting to defend against brute force and resource starvation:

- **Authentication Endpoints (`/api/auth/login`, `/api/auth/register`)**:
  - Threshold: 50 requests / 60 seconds per IP.
  - Response: HTTP 429 Too Many Requests with `Retry-After` header.
- **Media Upload Endpoints (`/api/chat/upload`)**:
  - Threshold: 100 uploads / 60 seconds per IP.
  - Maximum upload size: 25MB per file with extension and MIME verification.
  - Disallowed extensions: `.exe`, `.bat`, `.cmd`, `.sh`, `.php`, `.js`, `.mjs`, `.html`, `.htm`, `.vbs`, `.scr`, `.jar`.

---

## 9. WebRTC Production STUN/TURN Architecture

For peer-to-peer audio/video calling across strict symmetric NATs and corporate firewalls:

1. **Default STUN Configuration**:
   - Out of the box, HDTalk queries Google STUN servers (`stun:stun.l.google.com:19302`).
2. **Production TURN Deployment**:
   - Set environment variables on the backend:
     ```env
     TURN_URL=turn:turn.yourdomain.com:3478?transport=udp
     TURN_USERNAME=hdtalk_user
     TURN_CREDENTIAL=super_secret_turn_token
     ```
   - Alternatively, pass multiple TURN servers via `TURN_SERVERS` JSON array:
     ```env
     TURN_SERVERS=[{"urls":["turn:turn1.yourdomain.com:3478","turn:turn1.yourdomain.com:443?transport=tcp"],"username":"hdtalk","credential":"key"}]
     ```
   - Frontend dynamically requests ICE configuration securely via authenticated `GET /api/webrtc/config`.

---

## 10. Rollback & Disaster Recovery Procedures

### Database Snapshot & Auto-Recovery:
- The JSON document store maintains an auto-recovering atomic flush mechanism (`db.backup.json` and `.tmp_*` atomic rename).
- In the event of process crash or ungraceful termination, the store automatically self-heals by rolling back to the latest valid snapshot.

### Safe Rollback Steps:
1. **Stop the Application**:
   ```bash
   pm2 stop hdtalk
   # Or for docker:
   docker-compose down
   ```
2. **Restore Database from Backup**:
   ```bash
   cp backend/data/db.backup.json backend/data/db.json
   ```
3. **Revert Git Version**:
   ```bash
   git checkout <previous-commit-or-tag>
   npm run install:all && npm run build
   ```
4. **Restart Application**:
   ```bash
   pm2 restart hdtalk
   ```
5. **Verify Readiness**:
   ```bash
   curl -i http://localhost:5000/api/health/ready
   ```

---

## 11. Production Verification Checklist

- [x] **Database Sanitation**: Tested passwords hashed using bcrypt (10 rounds).
- [x] **File Upload Filter**: Enforced 10MB limits on avatars and 25MB on media attachments with MIME type verification.
- [x] **JWT Expiration**: Tokens expire after 7 days and use HMAC-SHA256 signature.
- [x] **Graceful Shutdown**: Server handles SIGTERM and SIGINT cleanly without dropping active database writes.
- [x] **Creator Attribution**: "Created with ❤️ by Himanshu Dwivedi" preserved across all modules, health probes, and logs.
- [x] **Health Probes**: Liveness (`/api/health/live`) and Readiness (`/api/health/ready`) verified.
- [x] **Rate Limiting**: Sliding window rate limiting active on auth and upload endpoints.

---

### 🎉 Congratulations!
Your HDTalk real-time communication platform is fully hardened, scalable, and ready for production deployment!
