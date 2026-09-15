# HDTalk ⚡ - Professional Real-Time Communication & HD Calling System

> **Created with ❤️ by Himanshu Dwivedi**  
> An ultra-modern, production-ready, self-hosted real-time messaging, professional synergy matchmaking, and HD WebRTC audio/video calling web application with Apphitect-style 3-panel architecture, light/dark themes, and signature royal electric blue styling.

---

## 🌟 Architecture & Core Highlights

- **100% Free & Self-Hosted Real-Time Engine**: Built with native **Socket.io** rooms and **WebRTC Mesh Signaling** — no expensive third-party APIs (like Agora, Twilio, or Stream) required.
- **Unified Full-Stack Deployment Ready**: Express serves both the REST API, Socket.io gateway, WebRTC signaling, and the compiled frontend static bundle from rontend/dist. Single container / single service deployment on any cloud.
- **Decoupled Architecture Ready**: Alternatively deploy the frontend to Vercel/Netlify/Cloudflare Pages and backend to Render/Railway/VPS.
- **Native Web Audio API Sound Generator**: Synthesizes pleasant dual-tone call ringers and message chimes directly in the browser without external audio assets.
- **Zero-Friction Storage**: Zero-dependency resilient JSON database with atomic writes, bcrypt security, and administrative CLI tools (
pm run db:reset, 
pm run db:seed).

---

## 🚀 Complete Feature Showcase

### 1. 💬 Real-Time Messaging & Chat
- **Instant Messaging**: Real-time message exchange via WebSocket rooms.
- **Continuous Typing Indicators**: Smart 1200ms keepalive throttling showing live typing animations in both the top chat header and in-feed wave bubbles.
- **Collapsible Messages Panel**: 1-click collapse/expand toggle (PanelLeftClose/PanelLeftOpen) to maximize the chat area to full screen.
- **Voice Notes & Audio Memos**: In-browser audio recording with real-time waveform visualization and inline playback.
- **Rich Media & File Sharing**: Upload and preview photos, videos, and documents up to 25MB.
- **Emoji Reactions**: Interactive instant emoji reactions (❤️, 🔥, 👍, 😂, 🚀, 🎉) on any message with real-time participant updates.
- **Read Receipts**: Single checkmark for sent, double checkmarks for delivered & read.

### 2. 🟢 Dynamic Presence & Last Active Timing ("Kab Active Tha")
- **Live Status Tracking**: Instant detection of user connect and disconnect events.
- **Dynamic Relative Time Formatting**:
  - Active now with pulsating emerald beacon when online.
  - Active just now for disconnects < 1 minute ago.
  - Active [X]m ago (e.g. Active 5m ago) / Active [X]h ago.
  - Active yesterday at HH:MM and Last seen [Date] for older timestamps.
- **Omnipresent Display**: Visible in the Chat Header, Sidebar Conversation cards, Profile Drawers, and Matchmaking cards.

### 3. 📹 HD WebRTC Video & Audio Calling
- **Direct PeerConnection**: Low-latency, high-definition audio and video mesh streams.
- **Incoming Call Modal**: Glassmorphic incoming call banner with animated radar waves, caller details, and synthesized ringtones.
- **Mid-Call Controls**:
  - Toggle microphone mute/unmute.
  - Turn camera on/off with clean avatar fallback.
  - Full HD Screen Sharing with seamless track renegotiation.
  - Virtual Background Blur with canvas-based shaders.
- **Draggable Picture-in-Picture (PiP)**: Floating local video tile during video calls.

### 4. 💼 Professional Synergy & Matchmaking Engine
- **Synergy Match Algorithm**: Dynamic scoring engine comparing roles, cross-functional synergy (e.g., Engineer + Designer), and shared skill tags.
- **Search & Filter**: Search peers by name, profession, skills, and online availability.
- **1-Click Actions**: Instant Direct Message, Video Call, or Send Connection Request.

### 5. 🎨 Design, Themes & Manual DP Upload
- **Manual DP Upload**: Direct device photo upload (PNG, JPG, WEBP up to 10MB) during Sign Up or from Profile Settings.
- **Dark & Light Themes**: Accessible, modern color palettes across all components with automatic localStorage persistence.
- **VisionOS 2.0 Glassmorphism**: Multi-layered frosted glass panels, ambient glow orbs, and electric blue accents.
- **Author Attribution**: "Created with ❤️ by Himanshu Dwivedi" prominently integrated in navbar, sidebars, headers, and tooltips.

---

## 📁 Project Structure

`
chatz-ultra/
├── backend/
│   ├── data/                # Database JSON storage (db.json)
│   ├── src/
│   │   ├── config/          # Environment configuration
│   │   ├── controllers/     # Auth, User, and Chat controllers
│   │   ├── database/        # Database methods (CRUD, resetDb, seedDefaultUsers)
│   │   ├── middleware/      # JWT authentication middleware
│   │   ├── routes/          # Express REST API routes
│   │   ├── socket/          # WebRTC signaling & Chat Socket.io gateway
│   │   └── server.js        # Main HTTP + Socket.io + Frontend static server
│   ├── uploads/             # Static voice notes, media, and avatar files
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/        # Sign In & Sign Up modal with DP upload
│   │   │   ├── call/        # WebRTC calling stage & floating glass controls
│   │   │   ├── chat/        # Messages, rich input, voice recorder, drawer
│   │   │   ├── discover/    # Synergy engine partner cards
│   │   │   ├── layout/      # Navbar, sidebar activity rail, modals
│   │   │   └── ui/          # Avatars, buttons, logos, dialogs
│   │   ├── context/         # Auth, Socket, Call, Chat, and Theme Contexts
│   │   ├── services/        # Web Audio synthesizer, WebRTC engine, API client
│   │   ├── utils/           # timeAgo.js relative date formatter
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── Dockerfile               # Multi-stage production container build
├── docker-compose.yml       # Production container orchestration
├── DEPLOYMENT.md            # Complete deployment guide for all platforms
└── README.md
`

---

## ⚡ Quick Start Guide (Local Development)

### 1. Install Dependencies
`ash
# Install backend and frontend dependencies in one command
npm run install:all
`

### 2. Start Development Servers
In two separate terminals:

`ash
# Terminal 1: Start Backend (Port 5000)
npm run dev:backend

# Terminal 2: Start Frontend (Port 5173 with Vite hot reload)
npm run dev:frontend
`

Visit **http://localhost:5173** in your browser.

---

## 🚀 Production Build & Run (Single Command)

HDTalk is equipped with unified full-stack serving:

`ash
# 1. Build frontend production distribution into frontend/dist
npm run build

# 2. Start the unified production server
npm run start
`

Visit **http://localhost:5000** — your complete application (UI, REST API, WebSockets, WebRTC) is live on port 5000!

---

## 🐳 Docker Deployment

Run HDTalk in an isolated, production-grade container with persistent volumes:

`ash
# Build and run with Docker Compose
docker-compose up -d --build

# View container logs
docker-compose logs -f
`

The app will be accessible at **http://localhost:5000**.

---

## 🔧 Database Management Commands

`ash
# Reset database to empty production state (wipes users & messages)
npm run db:reset

# Seed database with template admin user
npm run db:seed
`

---

## 📡 REST API Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| POST | /api/auth/register | Register new user with profile & avatar | No |
| POST | /api/auth/login | Authenticate user & issue JWT | No |
| GET | /api/auth/me | Retrieve authenticated user session | Yes |
| GET | /api/users | List professional peers with synergy scores | Yes |
| PUT | /api/users/profile | Update bio, profession, interests | Yes |
| POST | /api/users/avatar | Upload manual profile picture (multipart) | Yes |
| POST | /api/users/connections/request | Send connection request to a peer | Yes |
| GET | /api/chat/conversations | Get all active user conversations | Yes |
| POST | /api/chat/conversations | Get or create 1-on-1 conversation | Yes |
| GET | /api/chat/conversations/:id/messages | Fetch messages for conversation | Yes |
| POST | /api/chat/upload | Upload audio note or attachment file | Yes |
| GET | /api/health | Health check & system status | No |

---

## 📚 Project Documentation

- **[Software Requirements Specification (SRS)](SRS.md)** — Comprehensive IEEE 830 / ISO/IEC/IEEE 29148 specification detailing system architecture, functional requirements (Modules 1-6), data models (ERD + JSON Schema), security, and traceability matrix.
- **[Production Deployment Guide](DEPLOYMENT.md)** — Step-by-step production setup for Render.com, Railway.app, Docker Compose, Decoupled Vercel+Render, and Ubuntu VPS with Nginx, PM2, and SSL.

---

## 📄 License & Attribution

Designed and developed with ❤️ by **Himanshu Dwivedi**.  
Open-source under the MIT License.
