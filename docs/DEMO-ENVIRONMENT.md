# HDTalk v1.1.0-RC1 — Demonstration Environment Specification & Operational Guide

**Author**: Himanshu Dwivedi  
**Role**: Release Engineer & System Architect  
**Version**: 1.1.0-RC1  
**Status**: Ready for Production Demonstration (`PASS`)  
**Target Environment**: Backend Gateway (`http://localhost:5000`) & Frontend SPA (`http://localhost:5173`)

---

## 1. Executive Summary

This document serves as the authoritative operational guide and verification record for the HDTalk demonstration environment. The demo environment has been provisioned according to strict release engineering standards:

1. **Zero Secret Leakage**: No passwords, private keys, or API tokens are printed in documentation, logged in stdout, or committed to version control.
2. **Authentic Security Flows**: All demo accounts utilize the application's actual bcrypt hashing (10 salt rounds), real JWT issuance, and authentic HTTP authentication endpoints.
3. **Pristine & Predictable Data State**: Pre-seeded with a compact, deterministic dataset (3 users, 1 conversation, 5 messages, 2 connection states) specifically modeled to showcase direct messaging, WebSockets, read receipts, message reactions, file attachments, and networking notifications.
4. **Reproducible Baseline**: Easily re-seeded at any time via a single command: `npm run db:demo-seed`.

---

## 2. Phase 1 — Database Architecture Audit

An exhaustive audit of the underlying JSON persistence engine (`backend/src/database/db.js`) was conducted to document the exact schema structures, storage locations, and state management mechanisms:

### 2.1 Storage & Reset Architecture
* **Primary Store**: `backend/data/db.json`
* **Backup & Recovery Store**: `backend/data/db.backup.json`
* **Write Mechanism**: Cross-platform atomic file writes via `atomicWriteFile()`. Mutations write to an ephemeral temp file (`.tmp_*`), execute an OS-level synchronous disk flush (`fsync`), and atomically rename over the target path.
* **Self-Healing**: If `db.json` is corrupted, empty, or truncated during boot, `loadDatabase()` automatically restores state from `db.backup.json` and preserves a corrupted archive.
* **Reset Mechanism**: `db.resetDb()` reinitializes in-memory and on-disk state to a pristine empty schema (`{ users: [], conversations: [], messages: [], connectionRequests: [] }`). Available via `npm run db:reset`.

### 2.2 Schema Definition & Entities

| Collection / Entity | Key Fields & Types | Persistence Mechanism |
| :--- | :--- | :--- |
| **users** | `id` (string, `usr_*`), `name` (string), `email` (string, unique lowercase), `password` (string, bcrypt hash), `profession` (string), `bio` (string), `interests` (array of strings), `avatar` (string URL), `status` (`online` | `offline`), `lastSeen` (ISO date), `createdAt` (ISO date) | Persistent (`db.json`) |
| **conversations** | `id` (string, `conv_*`), `type` (`direct` | `group`), `name` (optional group string), `participants` (array of user IDs), `createdAt` (ISO date), `updatedAt` (ISO date), `lastMessage` (object snapshot) | Persistent (`db.json`) |
| **messages** | `id` (string, `msg_*`), `conversationId` (string), `senderId` (string), `text` (string), `type` (`text` | `image` | `file` | `voice`), `mediaUrl` (nullable string), `replyToId` (nullable string), `reactions` (map: `{ [emoji]: [userId] }`), `readBy` (array of user IDs), `timestamp` (ISO date) | Persistent (`db.json`) |
| **connectionRequests** | `id` (string, `req_*`), `fromUserId` (string), `toUserId` (string), `note` (string), `status` (`pending` | `accepted` | `rejected`), `createdAt` (ISO date), `updatedAt` (ISO date) | Persistent (`db.json`) |
| **calls / call state** | Ephemeral signaling sessions, WebRTC SDP offers/answers, ICE candidate routing, and peer mesh room membership. | In-Memory (`socketManager.js`), strictly ephemeral to ensure zero persistent storage overhead. |
| **uploads** | Uploaded user media, voice recordings, and shared images saved to `backend/uploads/` with MIME & extension whitelisting. | Disk File Store + Static Express mount (`/uploads`). |
| **notifications** | Live event dispatching over WebSockets (`receive_message`, `connection_request_received`, `incoming_call`) combined with persistent unread message badges. | Dynamic Evaluation (comparing message `readBy` against current user ID). |

---

## 3. Phase 2 — Fictional Demo Personas

Three distinct fictional personas were crafted for demo and evaluation scenarios. All personas are fictional, have zero ties to production users, and are authenticated via bcrypt hashes:

### Persona A: Alice Sterling (User A)
* **ID**: `usr_demo_alice`
* **Email**: `alice.sterling@demo.hdtalk.local`
* **Role**: Senior Frontend Architect
* **Bio**: Specializing in real-time WebRTC media rendering, accessible UI systems, and client performance.
* **Interests**: `['WebRTC', 'React', 'Design Systems', 'Accessibility']`
* **Avatar**: Professional female avatar portrait
* **Role in Demo**: Primary presentation account. Demonstrates dashboard hydration, unread badges, chat feed, and profile settings.

### Persona B: Bob Vance (User B)
* **ID**: `usr_demo_bob`
* **Email**: `bob.vance@demo.hdtalk.local`
* **Role**: Cloud Infrastructure Specialist
* **Bio**: Passionate about high-throughput Socket.io networks, media server tuning, and STUN/TURN relays.
* **Interests**: `['DevOps', 'Coturn', 'Docker', 'NodeJS']`
* **Avatar**: Professional male avatar portrait
* **Role in Demo**: Conversation partner for Alice. Demonstrates multi-user collaboration, real-time message sending, and reactions.

### Persona C: Clara Oswald (User C)
* **ID**: `usr_demo_clara`
* **Email**: `clara.oswald@demo.hdtalk.local`
* **Role**: Full Stack Engineer
* **Bio**: Building next-generation collaborative workflows and distributed messaging architectures.
* **Interests**: `['FullStack', 'WebSocket', 'GraphQL', 'TypeScript']`
* **Avatar**: Professional avatar portrait
* **Role in Demo**: External peer. Demonstrates matchmaking discovery and pending incoming connection notifications.

*(Note: In accordance with security mandates, demo passwords are never printed in this report or stored in plaintext).*

---

## 4. Phase 3 — Demonstration Dataset Structure

The demo dataset was compiled to highlight all major functional requirements without unnecessary bloat:

1. **Established Connection**: User A and User B have an accepted connection (`status: 'accepted'`), placing Bob Vance into Alice's direct messages list.
2. **Pending Notification**: User C has an active pending request to User A (`status: 'pending'`, note: *"Hi Alice, would love to collaborate on the frontend WebRTC interface!"*), proving notification handling.
3. **Chronological Message Feed**:
   * **Msg 1 (Alice -> Bob)**: *"Hi Bob! The WebRTC audio and video mesh streams are looking remarkably clear in HDTalk."* (`readBy: [Alice, Bob]`, Reaction: `👍` by Bob).
   * **Msg 2 (Bob -> Alice)**: *"Hey Alice! Just finished configuring the media relay pipeline. Real-time latency is under 30ms!"* (`readBy: [Alice, Bob]`, Reaction: `🚀` by Alice).
   * **Msg 3 (Alice -> Bob)**: *"That is fantastic. Let me send over the updated architecture specs for review."* (`readBy: [Alice, Bob]`).
   * **Msg 4 (Alice -> Bob, Image Attachment)**: `hdtalk-architecture-preview.png` served via `/uploads/hdtalk-architecture-preview.png` (`readBy: [Alice, Bob]`, Reaction: `✨` by Bob).
   * **Msg 5 (Bob -> Alice)**: *"Received and reviewed. The peer-to-peer signaling fallback works seamlessly!"* (`readBy: [Bob]` only).
4. **Unread Counter Verification**: Because Message 5 is only marked read by Bob, User A's initial session displays an unread badge counter (`unreadCount: 1`), which clears to `0` upon opening the conversation.

---

## 5. Phase 4 — Verification Matrix

Automated verification suite (`scratch/verify_demo_environment.cjs`) executed 27 validation checks covering REST APIs, persistence, and real headless Chrome CDP browser sessions:

| Check ID | Verification Area | Target & Criterion | Result |
| :---: | :--- | :--- | :---: |
| **01** | Authentication | User A (Alice) REST Login (`POST /api/auth/login`) | `PASS` (HTTP 200) |
| **02** | Token Issuance | Valid JWT signed and returned for User A | `PASS` |
| **03** | Profile Loading | User A `/api/auth/me` matches Senior Frontend Architect | `PASS` |
| **04** | Profile Attributes | User A interests array contains `WebRTC` | `PASS` |
| **05** | Authentication | User B (Bob) REST Login (`POST /api/auth/login`) | `PASS` (HTTP 200) |
| **06** | Profile Loading | User B `/api/auth/me` matches Cloud Infrastructure Specialist | `PASS` |
| **07** | Authentication | User C (Clara) REST Login (`POST /api/auth/login`) | `PASS` (HTTP 200) |
| **08** | Profile Loading | User C `/api/auth/me` matches Full Stack Engineer | `PASS` |
| **09** | Networking API | User A connection requests retrieved successfully | `PASS` |
| **10** | Connection State | Mutual accepted connection verified between Alice and Bob | `PASS` |
| **11** | Notifications | Pending incoming connection notification verified (Clara -> Alice) | `PASS` |
| **12** | Chat API | User A active conversations retrieved via REST | `PASS` |
| **13** | Conversation Metadata| Conversation partner correctly mapped to Bob Vance | `PASS` |
| **14** | Unread Badge | Unread counter accurately initialized (`unreadCount: 1`) | `PASS` |
| **15** | Message Feed | All 5 structured demo messages loaded in order | `PASS` |
| **16** | Message Reactions | Emoji reaction `👍` verified on Message 1 | `PASS` |
| **17** | Message Reactions | Emoji reaction `🚀` verified on Message 2 | `PASS` |
| **18** | File Sharing | Image message type and media URL correctly formatted | `PASS` |
| **19** | Static Asset | `/uploads/hdtalk-architecture-preview.png` accessible | `PASS` (HTTP 200) |
| **20** | Mark Read Flow | `POST /api/chat/conversations/:id/read` executed | `PASS` (HTTP 200) |
| **21** | State Update | Conversation unread badge clears to `0` after read | `PASS` |
| **22** | Chrome CDP | Browser login as User A; dashboard mounts into DOM | `PASS` |
| **23** | Chrome CDP | Conversation with Bob Vance rendered in sidebar list | `PASS` |
| **24** | Chrome CDP | Chat message feed active; text & media rendered | `PASS` |
| **25** | Chrome CDP | User Profile modal opens; displays Alice's profession & bio | `PASS` |
| **26** | Chrome CDP | Browser logout; JWT removed from storage; Auth modal restored | `PASS` |
| **27** | Chrome CDP | Browser re-login as User B; Bob's dashboard mounted | `PASS` |

**Verification Score**: **27 / 27 (100.0%)**

---

## 6. Phase 5 — Security & Compliance Controls

1. **Credential Sanitization**:
   * No passwords, credentials, or JWT tokens are committed or displayed in plain text.
   * Authentication secrets use environment variables (`JWT_SECRET`) with fallback defaults restricted to development.
2. **Repository Exclusion (`.gitignore`)**:
   * Verified exclusion of all environment files (`.env`, `.env.local`, `.env.*.local`).
   * Verified exclusion of TLS/HTTPS private keys and certificate files (`*.pem`, `*.pfx`, `*.key`).
   * Verified exclusion of database lock files and crash archives (`backend/data/.tmp_*`, `backend/data/db.corrupted.*`).
   * Verified exclusion of user uploaded media while preserving standard placeholder demo assets.
3. **GDPR / Privacy Compliance**:
   * Zero real personal data, phone numbers, or corporate emails are utilized in seed datasets.

---

## 7. Operator Instructions: Resetting the Demo Environment

To reset the demonstration environment to its clean, validated state at any time:

```bash
# From repository root:
npm run db:demo-seed

# Or from backend directory:
cd backend
npm run db:demo-seed
```

The seed script will atomically recreate the demo users, establish default conversations, restore unread notification badges, and synchronize `db.json` and `db.backup.json` without requiring a manual server recompile.

---

## 8. Final Release Verdict

# `PASS`

The demonstration environment is clean, stable, fully automated, and certified ready for production stakeholder review.
