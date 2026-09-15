# HDTalk PRO (Chatz-Ultra) - Master Knowledge Base (brain.md)

> **Official Project Documentation & Living Memory**  
> **Creator & Lead Engineer**: Himanshu Dwivedi  
> **Application**: HDTalk PRO (Enterprise Real-Time Communication Suite)  
> **Repository**: [https://github.com/himanshudwivedi0325-design/HDTalk.git](https://github.com/himanshudwivedi0325-design/HDTalk.git)  
> **Production URL**: [https://hdtalk.onrender.com](https://hdtalk.onrender.com)  
> **Last Updated**: September 15, 2026  

---

## 1. System Architecture & Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS, Lucide React icons, Glassmorphic UI with CSS backdrop blur
- **Real-Time Client**: Socket.IO Client 4.x
- **Media & Streaming**: Native WebRTC (RTCPeerConnection with STUN/TURN ICE candidate negotiation)
- **Audio Recording**: MediaRecorder API with audio/webm / audio/ogg fallback

### Backend
- **Runtime**: Node.js (v20+) with Express
- **Real-Time Engine**: Socket.IO 4.x with clustering support, room management, and typing heartbeat
- **Database**: File-based persistent JSON store (`backend/data/db.json` and automatic atomic backup `db.backup.json`)
- **Authentication**: JWT (JSON Web Tokens) with 30-day persistence + bcryptjs password hashing
- **File Uploads**: Multer handling multipart/form-data for images, audio, video, and documents up to 25MB

---

## 2. Completed Core Features

### A. Telegram & Instagram Style Message Quoting & Reply
1. **Floating Action Bar**:
   - Each message bubble has a floating quick-action pill containing a `Reply` button with icon.
   - Clicking it triggers `setReplyingToMessage(message)`.
2. **Docked Reply Preview Banner**:
   - Renders right above the text input bar on both desktop and mobile.
   - Shows:
     - Left blue accent bar
     - Reply icon
     - "Replying to [Sender Name]" (or "Replying to Yourself")
     - Quoted preview snippet (Text snippet, 📷 Photo, 🎥 Video, 🎵 Voice message, or 📎 Document)
     - Cancel (X) button to dismiss reply mode.
   - Automatically auto-focuses the text input field.
   - Pressing the `Escape` key also dismisses the reply banner.
3. **Message Bubble Quoting Display**:
   - Replying sends `replyToId` to backend.
   - Backend automatically enriches the message with `replyTo: { id, senderId, senderName, text, type, mediaUrl, isDeleted }`.
   - Message bubble displays an Instagram/Telegram style quoted card inside the bubble with vertical accent line, author name, and message snippet.
   - Clicking on the quoted card smoothly scrolls to the original message (`#msg-${replyTo.id}`) and briefly applies a glowing highlight outline.

### B. Friend Connection & Request Management System
1. **Model & State**:
   - Stored in `db.json` under `connectionRequests` with fields: `id`, `fromUserId`, `toUserId`, `status` (`'pending'`, `'accepted'`, `'rejected'`), `createdAt`, `updatedAt`.
2. **Chat Gate / Lock**:
   - When User A sends a message or opens a new chat with User B, if they are not already connected, the conversation is flagged as `isPending: true`.
   - The chat input area locks and shows a clear connection status banner:
     - Sender view: "Connection Request Pending - Waiting for [User] to accept before you can chat."
     - Receiver view: "[User] sent you a connection request - [Accept Request] [Decline]".
3. **Dedicated UI Entry Points**:
   - **Laptop Top Navbar (`GlassNavbar.jsx`)**: Prominent button labeled `Requests` with a `UserCheck` icon and active pending badge.
   - **Laptop Messages Sidebar (`ConversationList.jsx`)**:
     - Filter pill: `[All Chats] [Unread] [Requests (Count)]`
     - Prominent Banner at top of chat list: "Review X Friend Requests - Click to view sent & received".
   - **Desktop Activity Rail (`ApphitectSidebar.jsx`)**: Dedicated `Users` icon with pending requests badge counter and tooltip.
   - **Mobile Bottom Navigation (`MobileBottomNav.jsx`)**: Dedicated `Requests` tab with red badge indicator.
4. **Modal Dialog (`FriendRequestsModal.jsx`)**:
   - Two comprehensive tabs:
     - **Received Requests**: Lists incoming requests with sender avatar, name, username, timestamp, and action buttons (`Accept`, `Decline`).
     - **Sent Requests**: Lists all outgoing requests with partner avatar, name, and status pill (`Pending`, `Accepted`).
   - Accepting instantly unlocks 1:1 chat and audio/video calling with real-time socket propagation.

### C. Message Deletion
1. **"Delete for Everyone"**:
   - Available to message sender within the message action menu.
   - Emits socket event `delete_message` and calls API `DELETE /api/chat/messages/:id`.
   - DB replaces message text with tombstone `This message was deleted`, sets `isDeleted: true`, and deletes associated media file from storage.
   - Broadcasts real-time update to all conversation participants.
2. **"Delete for Me"**:
   - Available to any user.
   - Hides the message locally from their chat view without affecting other participants.

### D. Mobile & Responsive Layout Enhancements
1. **Android Virtual Keyboard Fix**:
   - Fullscreen viewport lock (`fixed inset-0`) prevents layout distortion and input shifting when the keyboard opens.
   - Meta tag: `interactive-widget=resizes-content`.
2. **Chat Area Input Bar**:
   - Input container styled with `flex-shrink-0` and `z-20` so it remains pinned at the bottom under all circumstances.
3. **Mobile Navigation**:
   - When entering a chat on mobile, the top navbar and bottom nav bar automatically hide to provide 100% screen space to the chat.
   - The header displays a dedicated back chevron button to return to the conversation list.
4. **Desktop / Laptop Viewport Tuning**:
   - Text wrapping eliminated on navbar badges and buttons across all resolutions.

---

## 3. Database Schema Reference

### `users`
```json
{
  "id": "usr_xxxx",
  "username": "johndoe",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "<bcrypt_hash>",
  "avatar": "https://...",
  "status": "online",
  "headline": "Full-stack developer",
  "nativeLanguage": "English",
  "targetLanguage": "Spanish",
  "proficiency": "Intermediate",
  "lastSeen": "2026-09-15T05:00:00.000Z"
}
```

### `connectionRequests`
```json
{
  "id": "req_xxxx",
  "fromUserId": "usr_1",
  "toUserId": "usr_2",
  "status": "pending", // "pending" | "accepted" | "rejected"
  "createdAt": "2026-09-15T05:00:00.000Z",
  "updatedAt": "2026-09-15T05:00:00.000Z"
}
```

### `messages`
```json
{
  "id": "msg_xxxx",
  "conversationId": "conv_xxxx",
  "senderId": "usr_1",
  "text": "Hello world",
  "type": "text", // "text" | "image" | "video" | "audio" | "file"
  "mediaUrl": null,
  "replyToId": "msg_yyyy", // Optional: ID of quoted message
  "isDeleted": false,
  "reactions": {},
  "readBy": ["usr_1"],
  "createdAt": "2026-09-15T05:00:00.000Z"
}
```

---

## 4. Primary Codebase Map

| File | Purpose |
|------|---------|
| `frontend/src/App.jsx` | Root application layout, desktop activity rail, responsive modals |
| `frontend/src/context/ChatContext.jsx` | Central chat state, active conversation, message CRUD, reply state, friend requests |
| `frontend/src/context/SocketContext.jsx` | Real-time connection management, online presence, WebRTC signaling |
| `frontend/src/components/chat/ChatArea.jsx` | Main conversation view, message bubbles list, docked reply banner, bottom input controls |
| `frontend/src/components/chat/MessageBubble.jsx` | Message bubble rendering, quoted reply card, media viewer, deletion status |
| `frontend/src/components/chat/ConversationList.jsx` | Sidebar chat list, search, filter pills (All, Unread, Requests), request review banner |
| `frontend/src/components/layout/GlassNavbar.jsx` | Top header with HDTalk branding, WebSocket/WebRTC indicators, Requests button, Theme toggle |
| `frontend/src/components/layout/ApphitectSidebar.jsx` | Desktop vertical activity rail (Chats, Explore, Requests, Themes) |
| `frontend/src/components/layout/MobileBottomNav.jsx` | Mobile bottom navigation dock with unread and request counter badges |
| `frontend/src/components/modals/FriendRequestsModal.jsx` | Modal with tabs for Received & Sent requests with Accept/Decline actions |
| `backend/src/server.js` | HTTP server & Socket.IO initialization, security middleware, static file serving |
| `backend/src/database/db.js` | Persistent file database operations, message enrichment, connection request handling |
| `backend/src/socket/socketManager.js` | Real-time events: `send_message`, `delete_message`, `typing`, `join_conversation`, WebRTC signaling |
| `backend/src/controllers/chatController.js` | REST API handlers for conversations, messages, connection requests |

---

## 5. Deployment & Git Integration

- **Remote Git Origin**: `https://github.com/himanshudwivedi0325-design/HDTalk.git`
- **Branch**: `main`
- **Automatic Deployment**: Render web service auto-deploys on push to `main`.
- **Prebuild & Build Scripts**:
  - `prebuild`: installs frontend & backend dependencies.
  - `build`: executes Vite build (`npm --prefix frontend run build`).
- **Production Server Command**: `node backend/src/server.js`.
