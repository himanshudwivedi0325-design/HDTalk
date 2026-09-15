# HDTalk — Production Coturn TURN Infrastructure & Deployment Guide
**Standard**: IEEE Std 830-1998 / RFC 5766 / RFC 6156 / RFC 8489 / RFC 8656  
**Platform Version**: HDTalk v1.1.0 Enterprise  
**Author**: Himanshu Dwivedi  
**Status**: Architecture Implemented & Tested; Real Relay Traversal **UNVERIFIED IN LOCAL DEV (NO LIVE VPS COTURN DAEMON)**  

---

## Executive Summary

The **HDTalk Real-Time Communication Platform** utilizes WebRTC full-mesh topology for 1-to-1 and group calling (up to 6 participants). Under standard network conditions, clients resolve direct Peer-to-Peer connections using STUN (Server Reflexive candidates `typ srflx`). However, in strict corporate firewalls, mobile carrier networks with Carrier-Grade NAT (CGNAT), and symmetric NAT topologies, direct P2P connections cannot be established without a **Traversal Using Relays around NAT (TURN)** server.

This document details the complete, enterprise-grade architecture, deployment procedure, security configuration, firewall topology, and verification protocol for running a dedicated **Coturn** TURN server for HDTalk.

> [!WARNING]
> ### Real-World Verification Status:
> **TURN infrastructure & configuration handling are IMPLEMENTED and PRODUCTION READY.**  
> However, because the current development and validation environment runs on a local Windows machine without an external Coturn VPS daemon or public IP:  
> **>>> REAL RELAY TRAVERSAL (typ relay) REMAINS UNVERIFIED <<<**  
> Real relay candidate allocation requires deploying Coturn to a real VPS per the specifications below.

---

## 1. WebRTC Architecture & ICE Pipeline Inspection

HDTalk's WebRTC subsystem incorporates an end-to-end ICE discovery and recovery engine:

```
+-------------------------------------------------------------------------+
|                        HDTalk Client Browser                            |
|                                                                         |
|  1. Fetches ICE Config from /api/webrtc/config                          |
|  2. Instantiates RTCPeerConnection(iceConfig)                           |
|  3. Harvests Candidates:                                                |
|     - host: Local IP / mDNS                                             |
|     - srflx: Google STUN (UDP 19302)                                    |
|     - relay: Dedicated Coturn Relay (UDP/TCP 3478, TURNS 5349)          |
|  4. Dispatches candidates via Socket.io signaling                       |
|  5. Bounded ICE Restart on connection failure (iceRestart: true)        |
+------------------------------------+------------------------------------+
                                     |
                         HTTPS / WSS |
                                     v
+------------------------------------+------------------------------------+
|                         HDTalk Backend Server                           |
|                                                                         |
|  - Reads STUN/TURN environment variables                                |
|  - Exposes GET /api/webrtc/config                                       |
|  - Dynamically constructs W3C-compliant iceServers configuration        |
|  - Zero secret leakage: Only returns client credentials                 |
|  - Validates signaling integrity and prevents rogue session hijacking   |
+------------------------------------+------------------------------------+
                                     |
                       Direct / Relay|
                                     v
+------------------------------------+------------------------------------+
|                      Dedicated Coturn Server (VPS)                      |
|                                                                         |
|  - Public Static IP Address (No double NAT)                             |
|  - UDP 3478 (Standard low-latency media relay)                          |
|  - TCP 3478 (Fallback for UDP-blocked enterprise networks)              |
|  - TLS 5349 (Encrypted TURNS over TCP for deep packet inspection bypass)|
|  - UDP 49160-49200 (Restricted media relay allocation port range)       |
|  - Long-term authentication mechanism (lt-cred-mech)                    |
|  - Local loopback and private network access blocked                    |
+-------------------------------------------------------------------------+
```

### 1.1 Endpoint Verification (`/api/webrtc/config`)
The backend provides dynamic ICE server configuration via `GET /api/webrtc/config`:
- **Response Format**:
  ```json
  {
    "success": true,
    "iceServers": [
      {
        "urls": [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302"
        ]
      },
      {
        "urls": [
          "turn:turn.yourdomain.com:3478?transport=udp",
          "turn:turn.yourdomain.com:3478?transport=tcp",
          "turns:turn.yourdomain.com:5349?transport=tcp"
        ],
        "username": "hdtalk_webrtc_prod",
        "credential": "StrongGeneratedTurnPassword2026!"
      }
    ],
    "maxMeshParticipants": 6,
    "hasTurnConfigured": true,
    "turnStatus": "CONFIGURED"
  }
  ```
- **Secret Isolation**: Server secrets (`JWT_SECRET`, database keys) are never exposed. Only the required WebRTC ICE authentication credentials are provided to the authenticated client.

### 1.2 Frontend ICE Configuration & Bounded Reconnection
In `frontend/src/services/webrtcService.js`:
- `fetchIceServers('/api/webrtc/config', token)` dynamically populates `this.iceConfig`.
- If the connection transitions to `disconnected` or `failed`:
  `triggerIceRestart(toUserId, socket)` generates an offer with `{ iceRestart: true }` and executes bounded exponential backoff (`Math.min(1000 * 2^(attempts-1), 5000)`), retrying up to 3 times before terminating cleanly.

---

## 2. Recommended Infrastructure: Dedicated Linux VPS

For high-availability real-time media relay, Coturn should **never** share compute resources with high-CPU transcoders or run on localhost. It must be hosted on a dedicated Linux instance with direct public IPv4 connectivity.

### 2.1 Hardware Sizing Recommendations
| Metric | 25 Concurrent Calls (50 Peers) | 100 Concurrent Calls (200 Peers) | 250 Concurrent Calls (500 Peers) |
| :--- | :--- | :--- | :--- |
| **vCPU** | 1 vCPU | 2 vCPU | 4 vCPU |
| **RAM** | 1 GB | 2 GB | 4 GB |
| **Bandwidth** | 25 Mbps symmetric | 100 Mbps symmetric | 250 Mbps symmetric unmetered |
| **OS** | Ubuntu 22.04 / 24.04 LTS | Ubuntu 22.04 / 24.04 LTS | Ubuntu 22.04 / 24.04 LTS |

---

## 3. Firewall & Port Requirements

Configuring the firewall properly is critical. WebRTC relay traffic will fail completely if the dynamic media relay port range is blocked or mismatched.

### 3.1 Firewall Rules Matrix
| Port | Protocol | Traffic Type | Purpose | Direction |
| :--- | :---: | :--- | :--- | :---: |
| **3478** | **UDP** | TURN / STUN | Primary low-latency media signaling and relay | Inbound |
| **3478** | **TCP** | TURN / STUN | Fallback for corporate firewalls blocking UDP | Inbound |
| **5349** | **TCP** | TURNS (TLS) | Encrypted TURN over TLS (bypasses Deep Packet Inspection) | Inbound |
| **49160:49200** | **UDP** | Relay Media | Bounded relay UDP allocation ports for media packet forwarding | Inbound |
| **80** | **TCP** | HTTP | Let's Encrypt Certbot SSL certificate validation (initial setup) | Inbound |
| **443** | **TCP** | HTTPS | Optional alternate TURNS port | Inbound |

> [!IMPORTANT]
> Avoid exposing unmanaged port ranges (e.g. `1024:65535`). Restricting `min-port` and `max-port` to `49160:49200` (or `49152:65535` for large fleets) reduces attack surface while providing ample relay socket capacity (each 1:1 call allocates 2 to 4 relay ports).

### 3.2 UFW (Ubuntu) Firewall Configuration Commands
```bash
# Reset UFW to default deny incoming
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH administration
sudo ufw allow 22/tcp

# Allow Coturn Standard Ports
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 5349/tcp

# Allow Restricted WebRTC Relay Allocation Port Range
sudo ufw allow 49160:49200/udp

# Allow Certbot for TLS certificates
sudo ufw allow 80/tcp

# Enable Firewall
sudo ufw enable
sudo ufw status verbose
```

---

## 4. Production Coturn Installation & Configuration

### 4.1 Step 1: Install Coturn
On Ubuntu/Debian:
```bash
sudo apt update && sudo apt install -y coturn certbot
```

Enable the Coturn background service:
```bash
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/g' /etc/default/coturn
```

### 4.2 Step 2: Obtain TLS Certificate for TURNS
```bash
# Ensure DNS A record for turn.yourdomain.com points to VPS Public IP
sudo certbot certonly --standalone -d turn.yourdomain.com --non-interactive --agree-tos -m admin@yourdomain.com
```

Ensure Coturn has read access to Let's Encrypt certificates:
```bash
sudo chown -R turnserver:turnserver /etc/letsencrypt/archive
sudo chown -R turnserver:turnserver /etc/letsencrypt/live
```

### 4.3 Step 3: Authoritative Production `turnserver.conf`
Create or edit `/etc/turnserver.conf`:

```ini
# ====================================================================
# HDTalk Production Coturn Configuration (turnserver.conf)
# Author: Himanshu Dwivedi
# ====================================================================

# 1. NETWORK & LISTENING PORTS
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0

# PUBLIC IP CONFIGURATION (CRUCIAL)
# Replace with your VPS static public IPv4 address.
# If VPS is behind NAT (AWS EC2 / GCP): external-ip=PUBLIC_IP/PRIVATE_IP
external-ip=203.0.113.50

# 2. REALM & AUTHENTICATION
realm=turn.yourdomain.com
server-name=turn.yourdomain.com

# Enable RFC 5389 / 5766 Long-Term Credential Mechanism
lt-cred-mech

# Production Authenticated User Credentials
# Format: user=username:password
user=hdtalk_webrtc_prod:StrongGeneratedTurnPassword2026!

# 3. TLS CERTIFICATE & SECURITY
cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
cipher-list="HIGH:!aNULL:!MD5"

# 4. RESTRICTED RELAY PORT RANGE
min-port=49160
max-port=49200

# 5. SECURITY HARDENING & ANTI-ABUSE
fingerprint
stale-nonce=600
no-stdout-log
log-file=/var/log/turnserver/turnserver.log
verbose

# Block open relay abuse & internal LAN scanning
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=127.0.0.0-127.255.255.255

# Disable administrative telnet CLI
no-cli
```

### 4.4 Step 4: Start and Verify Coturn Daemon
```bash
sudo systemctl restart coturn
sudo systemctl enable coturn
sudo systemctl status coturn
```

Verify listening ports:
```bash
sudo ss -tulpn | grep turnserver
```
Expected output:
- `UDP 0.0.0.0:3478`
- `TCP 0.0.0.0:3478`
- `TCP 0.0.0.0:5349`

---

## 5. HDTalk Backend Environment Variables

Configure `backend/.env` with the verified production Coturn credentials:

```bash
# --------------------------------------------------------------------
# HDTalk Production WebRTC STUN/TURN Configuration
# --------------------------------------------------------------------
STUN_SERVERS=stun:stun.l.google.com:19302,stun:turn.yourdomain.com:3478

# Dedicated Coturn Endpoints
TURN_URL_UDP=turn:turn.yourdomain.com:3478?transport=udp
TURN_URL_TCP=turn:turn.yourdomain.com:3478?transport=tcp
TURN_URL_TLS=turns:turn.yourdomain.com:5349?transport=tcp

# Authentication Credentials (matches `user=` in turnserver.conf)
TURN_USERNAME=hdtalk_webrtc_prod
TURN_CREDENTIAL=StrongGeneratedTurnPassword2026!
```

---

## 6. Verification & Validation Procedure

### 6.1 Step-by-Step Trickle ICE Test
1. Open the WebRTC Official Candidate Harvester:
   `https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/`
2. Remove default STUN servers.
3. Add your TURN server:
   - **TURN URI**: `turn:turn.yourdomain.com:3478?transport=udp`
   - **TURN Username**: `hdtalk_webrtc_prod`
   - **TURN Password**: `StrongGeneratedTurnPassword2026!`
4. Click **Gather candidates**.
5. **Expected Output**:
   - `typ srflx` $\rightarrow$ STUN response returning your public IP.
   - `typ relay` $\rightarrow$ **TURN Allocation Success!** Candidate IP matches `external-ip` of Coturn server, with port in range `49160-49200`.

### 6.2 Node.js Backend Configuration Test
Run the automated configuration test:
```bash
node test_turn_config.cjs
```
Ensures:
- `/api/webrtc/config` outputs valid `iceServers` array.
- Protocol URLs (`udp`, `tcp`, `turns`) are properly formed.
- No internal secrets are leaked in responses.

---

## 7. Security Best Practices & Troubleshooting

### 7.1 Security Considerations
- **Never Hardcode Secrets**: Keep TURN passwords out of git. Only load from `.env`.
- **Deny Private Subnets**: Always include `denied-peer-ip` rules in `turnserver.conf` to prevent attackers using the TURN server as a proxy to probe internal cloud infrastructure.
- **Log Rotation**: Configure `/etc/logrotate.d/coturn` to rotate `/var/log/turnserver/turnserver.log` weekly.
- **Automated SSL Renewal**: Add a Certbot renewal hook to reload Coturn:
  ```bash
  # /etc/letsencrypt/renewal-hooks/deploy/coturn.sh
  systemctl restart coturn
  ```

### 7.2 Common Failure Modes & Fixes
| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **No relay candidate gathered** | Relay port range blocked in cloud security group. | Open UDP ports `49160-49200` in AWS/GCP firewall. |
| **`401 Unauthorized` in logs** | Username/password mismatch or wrong realm. | Verify `user=` in `turnserver.conf` matches `.env`. |
| **`438 Stale Nonce`** | High latency or client clock drift. | Normal for initial challenge; subsequent requests succeed. |
| **Relay IP returns 0.0.0.0 / private IP** | `external-ip` not set in `turnserver.conf`. | Set `external-ip=<PUBLIC_IP>` in `turnserver.conf`. |
| **TURNS connection fails** | Expired or unreadable Let's Encrypt certificate. | Fix permissions on `/etc/letsencrypt/live` (`turnserver:turnserver`). |

---

*Document compiled and verified by Himanshu Dwivedi, Lead Production Reliability & Security Engineer.*
