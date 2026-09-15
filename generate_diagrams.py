#!/usr/bin/env python3
"""
================================================================================
HDTalk ⚡ - Architectural Diagrams Generator
Generates high-resolution PNG figures for IEEE 830 SRS Documentation & PDF.
Author: Himanshu Dwivedi
================================================================================
"""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

OUT_DIR = os.path.join(os.path.dirname(__file__), "diagrams")
os.makedirs(OUT_DIR, exist_ok=True)

plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['font.family'] = 'sans-serif'

# ----------------------------------------------------------------------
# FIGURE 1: SYSTEM CONTEXT DIAGRAM (C4 CONTEXT LEVEL)
# ----------------------------------------------------------------------
def generate_fig1():
    fig, ax = plt.subplots(figsize=(10, 6), dpi=200)
    ax.set_facecolor('#0B1120')
    fig.patch.set_facecolor('#0B1120')
    ax.axis('off')

    # Title
    ax.text(5, 9.5, "HDTalk ⚡ Enterprise System Context Diagram (C4 Level 1)", 
            color='#38BDF8', fontsize=14, fontweight='bold', ha='center')
    ax.text(5, 9.1, "Created with ❤️ by Himanshu Dwivedi", 
            color='#94A3B8', fontsize=10, ha='center')

    # External Actors
    ax.annotate("Registered User / Developer\n(React 18 Desktop / Mobile)", 
                xy=(2, 7.5), xytext=(2, 7.5),
                bbox=dict(boxstyle="round,pad=0.6", fc="#1E293B", ec="#38BDF8", lw=1.5),
                color="#F8FAFC", fontsize=9, ha='center', va='center', weight='bold')

    ax.annotate("Peer / Collaborator\n(Web Browser Client)", 
                xy=(8, 7.5), xytext=(8, 7.5),
                bbox=dict(boxstyle="round,pad=0.6", fc="#1E293B", ec="#38BDF8", lw=1.5),
                color="#F8FAFC", fontsize=9, ha='center', va='center', weight='bold')

    # Central System
    central_text = ("HDTALK APPLICATION PLATFORM\n"
                    "• Express.js Unified Full-Stack Gateway (Port 5000)\n"
                    "• Socket.io Duplex Signaling & Presence Hub\n"
                    "• Web Audio API Dual-Tone PBX Synthesizer\n"
                    "• WebRTC Peer-to-Peer Mesh Conferencing Engine")
    ax.annotate(central_text, 
                xy=(5, 4.8), xytext=(5, 4.8),
                bbox=dict(boxstyle="round,pad=0.8", fc="#0369A1", ec="#38BDF8", lw=2),
                color="#FFFFFF", fontsize=10, ha='center', va='center', weight='bold')

    # Storage & Infrastructure
    ax.annotate("LOCAL STORAGE VAULT\n• Atomic db.json Database\n• Uploads Vault (/uploads/)", 
                xy=(2.2, 1.8), xytext=(2.2, 1.8),
                bbox=dict(boxstyle="round,pad=0.6", fc="#1E293B", ec="#10B981", lw=1.5),
                color="#F8FAFC", fontsize=9, ha='center', va='center')

    ax.annotate("STUN / TURN INFRASTRUCTURE\n• Google Public STUN (:19302)\n• Coturn RFC 5766 Relay Fallback", 
                xy=(7.8, 1.8), xytext=(7.8, 1.8),
                bbox=dict(boxstyle="round,pad=0.6", fc="#1E293B", ec="#F59E0B", lw=1.5),
                color="#F8FAFC", fontsize=9, ha='center', va='center')

    # Connectors
    kw_arrow = dict(arrowstyle="<->", color="#38BDF8", lw=1.8)
    ax.annotate("", xy=(2.5, 6.7), xytext=(4.0, 5.7), arrowprops=kw_arrow)
    ax.text(2.8, 6.3, "HTTPS / WSS", color="#38BDF8", fontsize=8, weight='bold')

    ax.annotate("", xy=(7.5, 6.7), xytext=(6.0, 5.7), arrowprops=kw_arrow)
    ax.text(6.6, 6.3, "HTTPS / WSS", color="#38BDF8", fontsize=8, weight='bold')

    ax.annotate("", xy=(4.0, 3.9), xytext=(2.8, 2.7), arrowprops=dict(arrowstyle="->", color="#10B981", lw=1.8))
    ax.text(2.6, 3.4, "Atomic Disk I/O", color="#10B981", fontsize=8)

    ax.annotate("", xy=(6.0, 3.9), xytext=(7.2, 2.7), arrowprops=dict(arrowstyle="<->", color="#F59E0B", lw=1.8))
    ax.text(6.8, 3.4, "NAT Traversal", color="#F59E0B", fontsize=8)

    # Direct P2P Media Stream
    ax.annotate("", xy=(3.5, 7.5), xytext=(6.5, 7.5), 
                arrowprops=dict(arrowstyle="<->", color="#10B981", lw=2.5, linestyle="--"))
    ax.text(5, 7.8, "DIRECT P2P DTLS-SRTP AUDIO / VIDEO / SCREEN STREAM", 
            color="#10B981", fontsize=8, ha='center', weight='bold')

    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    plt.tight_layout()
    path = os.path.join(OUT_DIR, "fig1_system_context.png")
    plt.savefig(path, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"[*] Generated: {path}")

# ----------------------------------------------------------------------
# FIGURE 2: 3-TIER ARCHITECTURE
# ----------------------------------------------------------------------
def generate_fig2():
    fig, ax = plt.subplots(figsize=(10, 6.5), dpi=200)
    ax.set_facecolor('#0B1120')
    fig.patch.set_facecolor('#0B1120')
    ax.axis('off')

    ax.text(5, 9.6, "HDTalk ⚡ 3-Tier Layered Software Architecture", 
            color='#38BDF8', fontsize=14, fontweight='bold', ha='center')

    # Tier 1: Client Tier
    ax.annotate("PRESENTATION TIER (Browser Client)\n"
                "• React 18 SPA + Vite 5 + Tailwind CSS\n"
                "• VisionOS 2.0 Glassmorphic UI (Dark / Light Theme Tokens)\n"
                "• Web Audio API Synthetic Tone Generator\n"
                "• MediaCapture & getDisplayMedia 1080p Screen Pipeline",
                xy=(5, 7.8), xytext=(5, 7.8),
                bbox=dict(boxstyle="round,pad=0.7", fc="#1E293B", ec="#0284C7", lw=2),
                color="#F8FAFC", fontsize=9, ha='center', va='center')

    # Tier 2: Application Tier
    ax.annotate("APPLICATION TIER (Node.js 20 LTS + Express.js Server)\n"
                "• REST API Controllers: /api/auth, /api/chat, /api/users, /api/health\n"
                "• Socket.io Duplex Engine: Presence Lifecycle & 1200ms Typing Keepalive\n"
                "• WebRTC Mesh Signaling Hub: SDP Offer/Answer Relay & ICE Candidate Exchange\n"
                "• Multer Multipart Engine (10MB Avatars, 25MB Attachments) & Bcrypt (10 rounds)",
                xy=(5, 4.8), xytext=(5, 4.8),
                bbox=dict(boxstyle="round,pad=0.7", fc="#1E293B", ec="#10B981", lw=2),
                color="#F8FAFC", fontsize=9, ha='center', va='center')

    # Tier 3: Storage Tier
    ax.annotate("DATA & STORAGE TIER (Atomic Persistence Vault)\n"
                "• Resilient JSON Database (backend/data/db.json) with Synchronous Mutex Lock\n"
                "• High-Performance Local Uploads Vault (backend/uploads/)\n"
                "• Administrative CLI Management: npm run db:reset | npm run db:seed",
                xy=(5, 1.8), xytext=(5, 1.8),
                bbox=dict(boxstyle="round,pad=0.7", fc="#1E293B", ec="#F59E0B", lw=2),
                color="#F8FAFC", fontsize=9, ha='center', va='center')

    # Connecting Arrows
    ax.annotate("", xy=(5, 6.7), xytext=(5, 5.9), 
                arrowprops=dict(arrowstyle="<->", color="#38BDF8", lw=2))
    ax.text(5.2, 6.3, "HTTPS REST & WebSocket (WSS) Gateway", color="#38BDF8", fontsize=8, weight='bold')

    ax.annotate("", xy=(5, 3.7), xytext=(5, 2.9), 
                arrowprops=dict(arrowstyle="<->", color="#10B981", lw=2))
    ax.text(5.2, 3.3, "Atomic Synchronous Disk I/O & Stream Storage", color="#10B981", fontsize=8, weight='bold')

    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10.2)
    plt.tight_layout()
    path = os.path.join(OUT_DIR, "fig2_3tier_architecture.png")
    plt.savefig(path, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"[*] Generated: {path}")

# ----------------------------------------------------------------------
# FIGURE 3: WEBRTC SIGNALING & ICE SEQUENCE
# ----------------------------------------------------------------------
def generate_fig3():
    fig, ax = plt.subplots(figsize=(10, 7), dpi=200)
    ax.set_facecolor('#0B1120')
    fig.patch.set_facecolor('#0B1120')
    ax.axis('off')

    ax.text(5, 9.6, "HDTalk ⚡ WebRTC P2P Call Signaling & ICE Flow", 
            color='#38BDF8', fontsize=14, fontweight='bold', ha='center')

    # Entity Lifelines
    ax.text(1.8, 8.8, "Caller (Peer A)", color="#38BDF8", fontsize=10, weight='bold', ha='center')
    ax.text(5.0, 8.8, "Signaling Server (Socket.io)", color="#10B981", fontsize=10, weight='bold', ha='center')
    ax.text(8.2, 8.8, "Callee (Peer B)", color="#F59E0B", fontsize=10, weight='bold', ha='center')

    ax.plot([1.8, 1.8], [1.0, 8.5], color="#334155", lw=1.5, linestyle=":")
    ax.plot([5.0, 5.0], [1.0, 8.5], color="#334155", lw=1.5, linestyle=":")
    ax.plot([8.2, 8.2], [1.0, 8.5], color="#334155", lw=1.5, linestyle=":")

    steps = [
        (8.0, 1.8, 5.0, "1. call_user (offerSDP, callType)", "#38BDF8", "right"),
        (7.4, 5.0, 8.2, "2. incoming_call (offerSDP, callerInfo)", "#38BDF8", "right"),
        (6.7, 8.2, 8.2, "[Callee Plays Web Audio PBX Ringer (440+480Hz)]", "#F59E0B", "center"),
        (6.0, 8.2, 5.0, "3. accept_call (answerSDP)", "#10B981", "left"),
        (5.4, 5.0, 1.8, "4. call_accepted (answerSDP)", "#10B981", "left"),
        (4.7, 1.8, 8.2, "5. Exchange ICE Candidates (Bi-Directional Relay)", "#E2E8F0", "both"),
        (3.7, 1.8, 8.2, "=== DIRECT P2P DTLS-SRTP MEDIA CONNECTED ===", "#10B981", "media"),
        (2.8, 1.8, 8.2, "6. Screen Share Renegotiation (renegotiate_offer / answer)", "#38BDF8", "both"),
        (1.8, 1.8, 8.2, "7. end_call (Teardown & Clean Sockets)", "#EF4444", "both"),
    ]

    for y, x1, x2, label, color, direction in steps:
        if direction == "center":
            ax.annotate(label, xy=(x1, y), xytext=(x1, y),
                        bbox=dict(boxstyle="round,pad=0.3", fc="#1E293B", ec=color, lw=1),
                        color=color, fontsize=8, ha='center', va='center')
        elif direction == "media":
            ax.annotate("", xy=(x2, y), xytext=(x1, y),
                        arrowprops=dict(arrowstyle="<->", color=color, lw=3, linestyle="-"))
            ax.annotate(label, xy=(5.0, y+0.25), xytext=(5.0, y+0.25),
                        bbox=dict(boxstyle="round,pad=0.3", fc="#064E3B", ec=color, lw=1.5),
                        color="#FFFFFF", fontsize=8, ha='center', va='center', weight='bold')
        else:
            if direction == "right":
                ax.annotate("", xy=(x2, y), xytext=(x1, y),
                            arrowprops=dict(arrowstyle="->", color=color, lw=1.5))
                ax.text((x1+x2)/2, y+0.15, label, color=color, fontsize=8, ha='center', weight='bold')
            elif direction == "left":
                ax.annotate("", xy=(x2, y), xytext=(x1, y),
                            arrowprops=dict(arrowstyle="->", color=color, lw=1.5))
                ax.text((x1+x2)/2, y+0.15, label, color=color, fontsize=8, ha='center', weight='bold')
            elif direction == "both":
                ax.annotate("", xy=(x2, y), xytext=(x1, y),
                            arrowprops=dict(arrowstyle="<->", color=color, lw=1.5, linestyle="--"))
                ax.text(5.0, y+0.15, label, color=color, fontsize=8, ha='center', weight='bold')

    ax.set_xlim(0.5, 9.5)
    ax.set_ylim(0.5, 10.0)
    plt.tight_layout()
    path = os.path.join(OUT_DIR, "fig3_webrtc_signaling.png")
    plt.savefig(path, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"[*] Generated: {path}")

# ----------------------------------------------------------------------
# FIGURE 4: PRESENCE & TYPING FINITE STATE MACHINE
# ----------------------------------------------------------------------
def generate_fig4():
    fig, ax = plt.subplots(figsize=(10, 6), dpi=200)
    ax.set_facecolor('#0B1120')
    fig.patch.set_facecolor('#0B1120')
    ax.axis('off')

    ax.text(5, 9.5, "HDTalk ⚡ Dynamic Presence & 1200ms Typing State Machine", 
            color='#38BDF8', fontsize=13, fontweight='bold', ha='center')

    # State: Offline
    ax.annotate("OFFLINE / DISCONNECTED\n"
                "• lastSeen ISO Timestamp Stamped\n"
                "• < 60s: 'Active just now'\n"
                "• < 60m: 'Active Xm ago' (Active 5m ago)\n"
                "• Yesterday: 'Active yesterday at HH:MM'\n"
                "• Older: 'Last seen DD/MM/YYYY'",
                xy=(2.2, 5.0), xytext=(2.2, 5.0),
                bbox=dict(boxstyle="round,pad=0.6", fc="#1E293B", ec="#94A3B8", lw=1.5),
                color="#F8FAFC", fontsize=8.5, ha='center', va='center')

    # State: Online
    ax.annotate("ONLINE & ACTIVE\n"
                "• status: 'online'\n"
                "• Pulsating Emerald Badge (animate-pulse)\n"
                "• UI Label: 'Active now'",
                xy=(7.8, 6.8), xytext=(7.8, 6.8),
                bbox=dict(boxstyle="round,pad=0.6", fc="#064E3B", ec="#10B981", lw=2),
                color="#FFFFFF", fontsize=9, ha='center', va='center', weight='bold')

    # State: Typing
    ax.annotate("TYPING WAVE ACTIVE\n"
                "• In-Feed 3-Dot Animated Wave\n"
                "• Header Status: '<Name> is typing...'\n"
                "• 1200ms Keepalive Heartbeat Throttle\n"
                "• 3000ms Idle Auto-Clear Timer",
                xy=(7.8, 3.0), xytext=(7.8, 3.0),
                bbox=dict(boxstyle="round,pad=0.6", fc="#0369A1", ec="#38BDF8", lw=2),
                color="#FFFFFF", fontsize=8.5, ha='center', va='center', weight='bold')

    # Transitions
    ax.annotate("", xy=(6.5, 6.8), xytext=(4.3, 5.8), arrowprops=dict(arrowstyle="->", color="#10B981", lw=2))
    ax.text(5.2, 6.7, "WebSocket Connects", color="#10B981", fontsize=8, weight='bold')

    ax.annotate("", xy=(4.3, 4.8), xytext=(6.5, 6.2), arrowprops=dict(arrowstyle="->", color="#EF4444", lw=2))
    ax.text(5.2, 5.2, "WebSocket Disconnects", color="#EF4444", fontsize=8, weight='bold')

    ax.annotate("", xy=(7.8, 4.3), xytext=(7.8, 5.7), arrowprops=dict(arrowstyle="->", color="#38BDF8", lw=2))
    ax.text(8.0, 5.0, "Keystroke / typing:start", color="#38BDF8", fontsize=8, weight='bold')

    ax.annotate("", xy=(8.4, 5.7), xytext=(8.4, 4.3), arrowprops=dict(arrowstyle="->", color="#F59E0B", lw=2))
    ax.text(8.6, 5.0, "3000ms Idle / Send", color="#F59E0B", fontsize=8, weight='bold')

    ax.set_xlim(0, 10.5)
    ax.set_ylim(1.0, 10.0)
    plt.tight_layout()
    path = os.path.join(OUT_DIR, "fig4_presence_typing_fsm.png")
    plt.savefig(path, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"[*] Generated: {path}")

# ----------------------------------------------------------------------
# FIGURE 5: SCREEN SHARE RENEGOTIATION FLOW
# ----------------------------------------------------------------------
def generate_fig5():
    fig, ax = plt.subplots(figsize=(10, 6), dpi=200)
    ax.set_facecolor('#0B1120')
    fig.patch.set_facecolor('#0B1120')
    ax.axis('off')

    ax.text(5, 9.5, "HDTalk ⚡ 1080p Screen Sharing Track Renegotiation Architecture", 
            color='#38BDF8', fontsize=13, fontweight='bold', ha='center')

    boxes = [
        ("1. getDisplayMedia()\nAcquire 1080p@30fps\nsystem screen track", 1.5, 6.0, "#0284C7"),
        ("2. sender.replaceTrack()\nSubstitute webcam with\nscreen track on RTCRtpSender", 4.0, 6.0, "#0284C7"),
        ("3. peerConnection.createOffer()\nGenerate updated SDP offer\nwith 1080p video attributes", 6.5, 6.0, "#0284C7"),
        ("4. renegotiate_offer\nSocket.io signaling relays\nnew SDP offer to peer", 9.0, 6.0, "#10B981"),
        ("5. setRemoteDescription()\nRemote viewer applies offer\nand generates answer", 9.0, 2.5, "#10B981"),
        ("6. renegotiate_answer\nSocket.io relays answer back\nto presenter client", 6.5, 2.5, "#F59E0B"),
        ("7. Dominant Screen Render\nViewer expands screen to full;\nPresenter camera moves to PiP", 3.5, 2.5, "#064E3B"),
    ]

    for text, x, y, col in boxes:
        ax.annotate(text, xy=(x, y), xytext=(x, y),
                    bbox=dict(boxstyle="round,pad=0.5", fc="#1E293B", ec=col, lw=1.8),
                    color="#F8FAFC", fontsize=8, ha='center', va='center')

    # Arrows
    kw = dict(arrowstyle="->", color="#38BDF8", lw=1.8)
    ax.annotate("", xy=(2.7, 6.0), xytext=(2.3, 6.0), arrowprops=kw)
    ax.annotate("", xy=(5.2, 6.0), xytext=(4.8, 6.0), arrowprops=kw)
    ax.annotate("", xy=(7.7, 6.0), xytext=(7.3, 6.0), arrowprops=kw)
    ax.annotate("", xy=(9.0, 3.5), xytext=(9.0, 5.0), arrowprops=dict(arrowstyle="->", color="#10B981", lw=1.8))
    ax.annotate("", xy=(7.7, 2.5), xytext=(8.0, 2.5), arrowprops=dict(arrowstyle="->", color="#F59E0B", lw=1.8))
    ax.annotate("", xy=(4.9, 2.5), xytext=(5.3, 2.5), arrowprops=dict(arrowstyle="->", color="#10B981", lw=1.8))

    ax.set_xlim(0, 10.5)
    ax.set_ylim(1.0, 10.0)
    plt.tight_layout()
    path = os.path.join(OUT_DIR, "fig5_screen_share_renegotiation.png")
    plt.savefig(path, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"[*] Generated: {path}")

# ----------------------------------------------------------------------
# FIGURE 6: DATABASE ERD
# ----------------------------------------------------------------------
def generate_fig6():
    fig, ax = plt.subplots(figsize=(10, 6.5), dpi=200)
    ax.set_facecolor('#0B1120')
    fig.patch.set_facecolor('#0B1120')
    ax.axis('off')

    ax.text(5, 9.6, "HDTalk ⚡ Entity Relationship Model (db.json Store)", 
            color='#38BDF8', fontsize=14, fontweight='bold', ha='center')

    user_schema = ("USERS (users)\n"
                   "• id: PK, String (usr_<hex>)\n"
                   "• username: String (Unique)\n"
                   "• email: String (Unique RFC 5322)\n"
                   "• password: String (Bcrypt 10 rounds)\n"
                   "• displayName: String\n"
                   "• avatar: String (/uploads/...)\n"
                   "• profession: String\n"
                   "• skills: Array<String>\n"
                   "• status: 'online' | 'offline'\n"
                   "• lastSeen: ISO 8601 String")
    ax.annotate(user_schema, xy=(2.5, 6.8), xytext=(2.5, 6.8),
                bbox=dict(boxstyle="round,pad=0.6", fc="#1E293B", ec="#38BDF8", lw=1.8),
                color="#F8FAFC", fontsize=8, ha='center', va='center')

    conv_schema = ("CONVERSATIONS (conversations)\n"
                   "• id: PK, String (conv_<hex>)\n"
                   "• participants: Array<usr_id> [2]\n"
                   "• lastMessageId: FK -> messages.id\n"
                   "• updatedAt: ISO 8601 String\n"
                   "• createdAt: ISO 8601 String")
    ax.annotate(conv_schema, xy=(7.5, 6.8), xytext=(7.5, 6.8),
                bbox=dict(boxstyle="round,pad=0.6", fc="#1E293B", ec="#10B981", lw=1.8),
                color="#F8FAFC", fontsize=8, ha='center', va='center')

    msg_schema = ("MESSAGES (messages)\n"
                  "• id: PK, String (msg_<hex>)\n"
                  "• conversationId: FK -> conv.id\n"
                  "• senderId: FK -> users.id\n"
                  "• content: String (UTF-8)\n"
                  "• mediaType: 'text'|'image'|'audio'|'file'\n"
                  "• mediaUrl: String (/uploads/...)\n"
                  "• status: 'sent'|'delivered'|'read'\n"
                  "• reactions: Array<{userId, emoji}>")
    ax.annotate(msg_schema, xy=(7.5, 2.5), xytext=(7.5, 2.5),
                bbox=dict(boxstyle="round,pad=0.6", fc="#1E293B", ec="#F59E0B", lw=1.8),
                color="#F8FAFC", fontsize=8, ha='center', va='center')

    req_schema = ("CONNECTION REQUESTS\n"
                  "• id: PK, String (req_<hex>)\n"
                  "• fromUserId: FK -> users.id\n"
                  "• toUserId: FK -> users.id\n"
                  "• status: 'pending'|'accepted'|'rejected'\n"
                  "• createdAt: ISO 8601 String")
    ax.annotate(req_schema, xy=(2.5, 2.5), xytext=(2.5, 2.5),
                bbox=dict(boxstyle="round,pad=0.6", fc="#1E293B", ec="#818CF8", lw=1.8),
                color="#F8FAFC", fontsize=8, ha='center', va='center')

    # Relations
    kw_rel = dict(arrowstyle="->", color="#94A3B8", lw=1.8)
    ax.annotate("", xy=(6.0, 6.8), xytext=(4.2, 6.8), arrowprops=kw_rel)
    ax.text(5.1, 7.0, "participates (1:N)", color="#94A3B8", fontsize=7.5, ha='center')

    ax.annotate("", xy=(7.5, 4.3), xytext=(7.5, 5.3), arrowprops=kw_rel)
    ax.text(7.7, 4.8, "contains (1:N)", color="#94A3B8", fontsize=7.5)

    ax.annotate("", xy=(2.5, 4.2), xytext=(2.5, 5.0), arrowprops=kw_rel)
    ax.text(2.7, 4.6, "sends/receives", color="#94A3B8", fontsize=7.5)

    ax.set_xlim(0.5, 9.5)
    ax.set_ylim(0.5, 10.2)
    plt.tight_layout()
    path = os.path.join(OUT_DIR, "fig6_database_erd.png")
    plt.savefig(path, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"[*] Generated: {path}")

# ----------------------------------------------------------------------
# FIGURE 7: CALL LIFECYCLE FSM
# ----------------------------------------------------------------------
def generate_fig7():
    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=200)
    ax.set_facecolor('#0B1120')
    fig.patch.set_facecolor('#0B1120')
    ax.axis('off')

    ax.text(5, 9.4, "HDTalk ⚡ WebRTC Call Lifecycle Finite State Machine", 
            color='#38BDF8', fontsize=13, fontweight='bold', ha='center')

    states = [
        ("IDLE STATE\nNo call active;\nawaiting call trigger", 1.8, 6.0, "#94A3B8"),
        ("RINGING / CALLING\nDual-Tone 440+480Hz PBX Tone;\nRadar Modal Displayed", 5.0, 6.0, "#38BDF8"),
        ("CONNECTED MEDIA\nDirect DTLS-SRTP P2P;\nElapsed Timer Running", 8.2, 6.0, "#10B981"),
        ("RENEGOTIATING\nScreen Sharing Track Swap;\nUpdating Video SDP", 8.2, 2.2, "#F59E0B"),
        ("TERMINATED\nTracks Stopped;\nAudioContext Closed", 1.8, 2.2, "#EF4444"),
    ]

    for text, x, y, col in states:
        ax.annotate(text, xy=(x, y), xytext=(x, y),
                    bbox=dict(boxstyle="round,pad=0.6", fc="#1E293B", ec=col, lw=2),
                    color="#F8FAFC", fontsize=8.5, ha='center', va='center')

    # Transitions
    kw = dict(arrowstyle="->", color="#38BDF8", lw=1.8)
    ax.annotate("", xy=(3.6, 6.0), xytext=(2.9, 6.0), arrowprops=kw)
    ax.text(3.2, 6.2, "call_user", color="#38BDF8", fontsize=8)

    ax.annotate("", xy=(6.9, 6.0), xytext=(6.2, 6.0), arrowprops=kw)
    ax.text(6.5, 6.2, "accept_call", color="#10B981", fontsize=8)

    ax.annotate("", xy=(8.2, 3.4), xytext=(8.2, 4.8), arrowprops=dict(arrowstyle="->", color="#F59E0B", lw=1.8))
    ax.text(8.4, 4.1, "Screen Share", color="#F59E0B", fontsize=8)

    ax.annotate("", xy=(7.9, 4.8), xytext=(7.9, 3.4), arrowprops=dict(arrowstyle="->", color="#10B981", lw=1.8))
    ax.text(7.3, 4.1, "Stop Share", color="#10B981", fontsize=8)

    ax.annotate("", xy=(3.0, 2.2), xytext=(6.8, 2.2), arrowprops=dict(arrowstyle="->", color="#EF4444", lw=1.8))
    ax.text(4.9, 2.4, "end_call / hangup", color="#EF4444", fontsize=8)

    ax.annotate("", xy=(1.8, 4.8), xytext=(1.8, 3.4), arrowprops=dict(arrowstyle="->", color="#94A3B8", lw=1.8))
    ax.text(1.2, 4.1, "Reset to Idle", color="#94A3B8", fontsize=8)

    ax.set_xlim(0.5, 9.5)
    ax.set_ylim(1.0, 10.0)
    plt.tight_layout()
    path = os.path.join(OUT_DIR, "fig7_call_lifecycle_fsm.png")
    plt.savefig(path, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"[*] Generated: {path}")

# ----------------------------------------------------------------------
# FIGURE 8: WEB AUDIO SYNTHESIZER PIPELINE
# ----------------------------------------------------------------------
def generate_fig8():
    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=200)
    ax.set_facecolor('#0B1120')
    fig.patch.set_facecolor('#0B1120')
    ax.axis('off')

    ax.text(5, 9.4, "HDTalk ⚡ Web Audio API Dual-Tone PBX Synthesizer Pipeline", 
            color='#38BDF8', fontsize=13, fontweight='bold', ha='center')

    # AudioContext
    ax.annotate("W3C AudioContext\n(Browser Native Memory)", xy=(1.8, 5.5), xytext=(1.8, 5.5),
                bbox=dict(boxstyle="round,pad=0.5", fc="#1E293B", ec="#38BDF8", lw=2),
                color="#FFFFFF", fontsize=9, ha='center', va='center', weight='bold')

    # Oscillators
    ax.annotate("OscillatorNode 1\n440.0 Hz (Sine Wave)", xy=(4.5, 7.2), xytext=(4.5, 7.2),
                bbox=dict(boxstyle="round,pad=0.4", fc="#0284C7", ec="#38BDF8", lw=1.5),
                color="#FFFFFF", fontsize=8.5, ha='center', va='center')

    ax.annotate("OscillatorNode 2\n480.0 Hz (Sine Wave)", xy=(4.5, 3.8), xytext=(4.5, 3.8),
                bbox=dict(boxstyle="round,pad=0.4", fc="#0284C7", ec="#38BDF8", lw=1.5),
                color="#FFFFFF", fontsize=8.5, ha='center', va='center')

    # Gain / Envelope
    ax.annotate("Master GainNode (ADSR Envelope)\nCadence: 2.0s ON / 4.0s OFF Cycle\nPeak Gain: 0.15 Volume", 
                xy=(7.5, 5.5), xytext=(7.5, 5.5),
                bbox=dict(boxstyle="round,pad=0.5", fc="#1E293B", ec="#10B981", lw=2),
                color="#FFFFFF", fontsize=8.5, ha='center', va='center', weight='bold')

    # Destination
    ax.annotate("AudioDestination\n(Speakers / Headphones)", xy=(9.2, 5.5), xytext=(9.2, 5.5),
                bbox=dict(boxstyle="round,pad=0.4", fc="#064E3B", ec="#10B981", lw=1.5),
                color="#FFFFFF", fontsize=8, ha='center', va='center')

    # Connectors
    kw = dict(arrowstyle="->", color="#38BDF8", lw=1.8)
    ax.annotate("", xy=(3.4, 7.2), xytext=(2.9, 6.0), arrowprops=kw)
    ax.annotate("", xy=(3.4, 3.8), xytext=(2.9, 5.0), arrowprops=kw)
    ax.annotate("", xy=(6.0, 5.8), xytext=(5.6, 7.2), arrowprops=kw)
    ax.annotate("", xy=(6.0, 5.2), xytext=(5.6, 3.8), arrowprops=kw)
    ax.annotate("", xy=(8.3, 5.5), xytext=(8.0, 5.5), arrowprops=dict(arrowstyle="->", color="#10B981", lw=2))

    ax.set_xlim(0.5, 10.2)
    ax.set_ylim(1.5, 10.0)
    plt.tight_layout()
    path = os.path.join(OUT_DIR, "fig8_webaudio_synth.png")
    plt.savefig(path, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"[*] Generated: {path}")

if __name__ == "__main__":
    generate_fig1()
    generate_fig2()
    generate_fig3()
    generate_fig4()
    generate_fig5()
    generate_fig6()
    generate_fig7()
    generate_fig8()
    print("[SUCCESS] All 8 architectural diagrams successfully generated in /diagrams/")
