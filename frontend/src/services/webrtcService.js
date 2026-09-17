// Native WebRTC Engine for HD Video & Audio Calling with P2P Mesh & Robust Recovery
// Author: Himanshu Dwivedi

const DEFAULT_ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelay',
      credential: 'openrelay'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelay',
      credential: 'openrelay'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelay',
      credential: 'openrelay'
    }
  ]
};

export class WebRTCService {
  constructor() {
    this.iceConfig = DEFAULT_ICE_SERVERS;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.screenStream = null;
    this.videoSender = null;
    this.isScreenSharing = false;
    this.isBlurEnabled = false;
    this.blurCanvas = null;
    this.blurAnimFrame = null;
    this.audioContext = null;
    this.analyser = null;
    this.pendingCandidates = [];

    // Reconnection & Recovery Management
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectTimer = null;
    this.isReconnecting = false;

    // Multi-Peer Mesh Engine (roomId -> Map<userId, PeerEntry>)
    // PeerEntry: { pc, stream, senders, status, pendingCandidates, reconnectAttempts }
    this.meshPeers = new Map();

    // Callbacks for 1:1 calling
    this.onRemoteStream = null;
    this.onIceCandidate = null;
    this.onConnectionStateChange = null;
    this.onScreenShareEnded = null;
    this.onHardwareStatusChange = null;
    this.onDiagnosticsUpdate = null;
  }

  // Configure ICE / STUN / TURN servers dynamically from backend
  setIceServers(iceServers) {
    if (Array.isArray(iceServers) && iceServers.length > 0) {
      console.log('[WebRTC] Updating ICE servers dynamically. Count:', iceServers.length);
      this.iceConfig = { iceServers };
    }
  }

  async fetchIceServers(apiUrl = '/api/webrtc/config', token = null) {
    try {
      const headers = {};
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
      if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;
      const res = await fetch(apiUrl, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.iceServers && data.iceServers.length > 0) {
          this.setIceServers(data.iceServers);
          console.log('[WebRTC] Successfully fetched ICE server config from backend');
        }
      }
    } catch (e) {
      console.warn('[WebRTC] Could not fetch remote ICE servers, using default STUN:', e.message);
    }
  }

  // Create virtual media stream fallback when camera/mic is absent or blocked
  createSimulatedStream(label = 'HDTalk HD Video') {
    console.log('[WebRTC] Initializing simulated HD media stream fallback');
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    let frame = 0;

    const renderLoop = () => {
      frame++;
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#0a0f1d');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#0b1329');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const pulse1 = Math.sin(frame * 0.04) * 30;
      const radGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 20,
        canvas.width / 2, canvas.height / 2, 220 + pulse1
      );
      radGrad.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
      radGrad.addColorStop(0.5, 'rgba(147, 51, 234, 0.25)');
      radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 260 + pulse1, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 20, 80, 0, Math.PI * 2);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#60a5fa';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', canvas.width / 2, canvas.height / 2 - 18);
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 100);

      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('● 1080p HD Real-Time WebRTC Stream', canvas.width / 2, canvas.height / 2 + 135);

      const barCount = 18;
      const barWidth = 8;
      const gap = 6;
      const startX = (canvas.width - (barCount * (barWidth + gap))) / 2;
      for (let i = 0; i < barCount; i++) {
        const barHeight = 15 + Math.sin(frame * 0.1 + i * 0.5) * 20 + Math.random() * 15;
        ctx.fillStyle = '#818cf8';
        ctx.fillRect(startX + i * (barWidth + gap), canvas.height / 2 + 170 - barHeight / 2, barWidth, barHeight);
      }

      this.blurAnimFrame = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    const stream = canvas.captureStream(30);

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        if (this.audioContext && this.audioContext.state !== 'closed') {
          try { this.audioContext.close(); } catch (e) {}
        }
        this.audioContext = new AudioContextClass();
        const osc = this.audioContext.createOscillator();
        const dst = this.audioContext.createMediaStreamDestination();
        const gain = this.audioContext.createGain();
        gain.gain.value = 0.0001;
        osc.frequency.setValueAtTime(440, this.audioContext.currentTime);
        osc.connect(gain);
        gain.connect(dst);
        osc.start();
        dst.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      }
    } catch (e) {
      console.warn('[WebRTC] Simulated audio init note:', e);
    }

    return stream;
  }

  // Initialize local media (Camera & Mic with graceful degradation)
  async startLocalStream(constraints = { video: true, audio: true }) {
    let audioTrack = null;
    let videoTrack = null;
    let hardwareStatus = { videoAvailable: false, audioAvailable: false, isFallback: false };

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // 1. Attempt requested constraints
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        hardwareStatus.videoAvailable = this.localStream.getVideoTracks().length > 0;
        hardwareStatus.audioAvailable = this.localStream.getAudioTracks().length > 0;
        this.initAudioAnalyser(this.localStream);
        if (this.onHardwareStatusChange) this.onHardwareStatusChange(hardwareStatus);
        return this.localStream;
      } catch (primaryErr) {
        console.warn('[WebRTC] Primary getUserMedia failed (' + primaryErr.name + '):', primaryErr.message);

        // 2. Hardware Fallback: If video failed (e.g. webcam busy or permission denied), try audio-only!
        if (constraints.video) {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioTrack = audioStream.getAudioTracks()[0];
            hardwareStatus.audioAvailable = true;
          } catch (audioErr) {
            console.warn('[WebRTC] Audio also failed:', audioErr.message);
          }
        }
      }
    }

    // 3. Simulated Stream Fallback if full media acquisition failed
    const simStream = this.createSimulatedStream('HDTalk Live Feed');
    hardwareStatus.isFallback = true;

    if (audioTrack) {
      // Real mic audio + virtual video
      this.localStream = new MediaStream([simStream.getVideoTracks()[0], audioTrack]);
    } else {
      // Pure simulated stream
      this.localStream = simStream;
    }

    this.initAudioAnalyser(this.localStream);
    if (this.onHardwareStatusChange) this.onHardwareStatusChange(hardwareStatus);
    return this.localStream;
  }

  // Audio Analyser with clean AudioContext lifecycle (Prevents context ceiling leaks)
  initAudioAnalyser(stream) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (this.audioContext && this.audioContext.state !== 'closed') {
        try { this.audioContext.close(); } catch (e) {}
        this.audioContext = null;
      }

      this.audioContext = new AudioContextClass();
      const audioTracks = stream ? stream.getAudioTracks() : [];
      if (audioTracks.length > 0) {
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);
      }
    } catch (e) {
      console.warn('[WebRTC] Audio analyser init note:', e);
    }
  }

  getAudioFrequencies() {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  // ----------------------------------------------------
  // 1:1 PEER CONNECTION LIFECYCLE
  // ----------------------------------------------------
  createPeerConnection(targetUserId = null, socket = null, preservePending = false) {
    const savedPending = preservePending ? [...this.pendingCandidates] : [];
    this.closePeerConnection();
    if (preservePending) {
      this.pendingCandidates = savedPending;
    }

    this.peerConnection = new RTCPeerConnection(this.iceConfig);
    this.remoteStream = new MediaStream();
    this.videoSender = null;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;

    // Attach local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        try {
          const sender = this.peerConnection.addTrack(track, this.localStream);
          if (track.kind === 'video') {
            this.videoSender = sender;
          }
        } catch (e) {
          console.warn('[WebRTC] Error adding local track:', e);
        }
      });
    }

    // Ensure video transceiver exists
    if (!this.videoSender) {
      try {
        this.peerConnection.addTransceiver('video', { direction: 'sendrecv' });
      } catch (e) {}
    }

    // Remote track listener
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind, event.track.id);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream.getTracks().some(t => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
      }

      if (this.onRemoteStream) {
        this.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
      }

      event.track.onunmute = () => {
        console.log('[WebRTC] Remote track unmuted:', event.track.kind);
        if (this.onRemoteStream) {
          this.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
        }
      };
    };

    // ICE Candidate generation
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate);
      }
    };

    // Connection state machine with bounded exponential backoff
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WebRTC] PeerConnection state changed:', state);

      if (state === 'connected') {
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        if (this.onConnectionStateChange) this.onConnectionStateChange('connected');
      } else if (state === 'connecting') {
        if (this.onConnectionStateChange) this.onConnectionStateChange('connecting');
      } else if (state === 'disconnected') {
        console.warn('[WebRTC] Connection transiently disconnected. Preparing recovery...');
        this.isReconnecting = true;
        if (this.onConnectionStateChange) this.onConnectionStateChange('reconnecting');

        // Allow 3.5 seconds grace period for transient network restoration before triggering ICE restart
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.peerConnection && this.peerConnection.connectionState === 'disconnected') {
              this.triggerIceRestart(targetUserId, socket);
            }
          }, 3500);
        }
      } else if (state === 'failed') {
        console.error('[WebRTC] PeerConnection failed. Initiating bounded ICE restart...');
        this.isReconnecting = true;
        if (this.onConnectionStateChange) this.onConnectionStateChange('reconnecting');
        this.triggerIceRestart(targetUserId, socket);
      } else if (state === 'closed') {
        if (this.onConnectionStateChange) this.onConnectionStateChange('ended');
      }
    };

    // ICE connection state listener
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log('[WebRTC] ICE state changed:', iceState);
      if (iceState === 'failed') {
        this.triggerIceRestart(targetUserId, socket);
      }
    };

    return this.peerConnection;
  }

  // Bounded ICE Restart & Reconnection Pipeline (NFR-021)
  async triggerIceRestart(toUserId, socket) {
    if (!this.peerConnection || !socket || !toUserId) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[WebRTC] Reconnection exhausted (${this.reconnectAttempts}/${this.maxReconnectAttempts}). Terminating.`);
      if (this.onConnectionStateChange) this.onConnectionStateChange('failed');
      return;
    }

    this.reconnectAttempts++;
    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000);
    console.log(`[WebRTC] Attempting ICE restart (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${backoffMs}ms...`);

    setTimeout(async () => {
      try {
        if (!this.peerConnection || this.peerConnection.connectionState === 'closed') return;
        if (this.peerConnection.signalingState !== 'stable') {
          console.log('[WebRTC] Deferring ICE restart offer: signalingState = ' + this.peerConnection.signalingState);
          return;
        }

        const offer = await this.peerConnection.createOffer({ iceRestart: true });
        await this.peerConnection.setLocalDescription(offer);
        console.log('[WebRTC] Dispatched ICE restart offer to peer:', toUserId);

        socket.emit('call_renegotiate', {
          toUserId,
          signalData: offer
        });
      } catch (err) {
        console.warn('[WebRTC] Error generating ICE restart offer:', err);
      }
    }, backoffMs);
  }

  // 1:1 Offer & Answer
  async createOffer() {
    if (!this.peerConnection) this.createPeerConnection();
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer) {
    if (!this.peerConnection) this.createPeerConnection(null, null, true);
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    await this.drainPendingCandidates();
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      await this.drainPendingCandidates();
    }
  }

  async drainPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    if (this.pendingCandidates.length > 0) {
      console.log(`[WebRTC] Flushing ${this.pendingCandidates.length} buffered ICE candidates`);
      while (this.pendingCandidates.length > 0) {
        const candidate = this.pendingCandidates.shift();
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Error adding buffered candidate:', e.message);
        }
      }
    }
  }

  async handleIceCandidate(candidate) {
    if (!candidate) return;
    if (this.peerConnection && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Error adding candidate:', e.message);
      }
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  // ----------------------------------------------------
  // MULTI-PEER GROUP MESH ENGINE (Phases 3, 4, 11)
  // ----------------------------------------------------
  createMeshPeer({
    roomId,
    remoteUserId,
    isInitiator,
    onRemoteStream,
    onPeerStateChange,
    socket
  }) {
    if (this.meshPeers.has(remoteUserId)) {
      this.closeMeshPeer(remoteUserId);
    }

    console.log(`[Mesh Engine] Initializing peer connection for: ${remoteUserId} (initiator: ${isInitiator})`);
    const pc = new RTCPeerConnection(this.iceConfig);
    const remoteStream = new MediaStream();
    const pendingCandidates = [];
    let videoSender = null;

    // Attach local stream tracks to this peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        try {
          const sender = pc.addTrack(track, this.localStream);
          if (track.kind === 'video') videoSender = sender;
        } catch (e) {
          console.warn(`[Mesh Engine] Error adding track to peer ${remoteUserId}:`, e);
        }
      });
    }

    // Ensure video transceiver exists
    if (!videoSender) {
      try { pc.addTransceiver('video', { direction: 'sendrecv' }); } catch (e) {}
    }

    // On remote track received
    pc.ontrack = (event) => {
      console.log(`[Mesh Engine] Remote track received from ${remoteUserId}:`, event.track.kind);
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach(track => {
          if (!remoteStream.getTracks().some(t => t.id === track.id)) {
            remoteStream.addTrack(track);
          }
        });
      } else {
        if (!remoteStream.getTracks().some(t => t.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }
      }

      if (onRemoteStream) {
        onRemoteStream(remoteUserId, new MediaStream(remoteStream.getTracks()));
      }

      event.track.onunmute = () => {
        if (onRemoteStream) {
          onRemoteStream(remoteUserId, new MediaStream(remoteStream.getTracks()));
        }
      };
    };

    // Forward ICE candidate to remote peer via room signaling
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('mesh_ice_candidate', {
          roomId,
          toUserId: remoteUserId,
          candidate: event.candidate
        });
      }
    };

    // Connection state monitor
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[Mesh Engine] Peer ${remoteUserId} state:`, state);
      if (onPeerStateChange) {
        onPeerStateChange(remoteUserId, state);
      }
      if (state === 'failed' || state === 'closed') {
        this.closeMeshPeer(remoteUserId);
      }
    };

    const peerEntry = {
      pc,
      remoteStream,
      videoSender,
      pendingCandidates,
      status: 'new'
    };

    this.meshPeers.set(remoteUserId, peerEntry);

    // If initiator, generate and emit offer
    if (isInitiator) {
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('mesh_signal', {
            roomId,
            toUserId: remoteUserId,
            signalData: offer,
            type: 'offer'
          });
        } catch (err) {
          console.error(`[Mesh Engine] Error generating offer for ${remoteUserId}:`, err);
        }
      })();
    }

    return peerEntry;
  }

  async handleMeshSignal({ roomId, fromUserId, signalData, type, socket, onRemoteStream, onPeerStateChange }) {
    let peer = this.meshPeers.get(fromUserId);

    if (!peer) {
      // Incoming offer from late joiner
      peer = this.createMeshPeer({
        roomId,
        remoteUserId: fromUserId,
        isInitiator: false,
        onRemoteStream,
        onPeerStateChange,
        socket
      });
    }

    const { pc, pendingCandidates } = peer;

    if (signalData.type === 'offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData));
        // Flush pending candidates
        while (pendingCandidates.length > 0) {
          const c = pendingCandidates.shift();
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('mesh_signal', {
          roomId,
          toUserId: fromUserId,
          signalData: answer,
          type: 'answer'
        });
      } catch (e) {
        console.warn(`[Mesh Engine] Error handling offer from ${fromUserId}:`, e);
      }
    } else if (signalData.type === 'answer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData));
        while (pendingCandidates.length > 0) {
          const c = pendingCandidates.shift();
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
        }
      } catch (e) {
        console.warn(`[Mesh Engine] Error handling answer from ${fromUserId}:`, e);
      }
    }
  }

  async handleMeshIceCandidate(fromUserId, candidate) {
    const peer = this.meshPeers.get(fromUserId);
    if (!peer || !candidate) return;

    if (peer.pc && peer.pc.remoteDescription && peer.pc.remoteDescription.type) {
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn(`[Mesh Engine] Candidate error for ${fromUserId}:`, e);
      }
    } else {
      peer.pendingCandidates.push(candidate);
    }
  }

  closeMeshPeer(remoteUserId) {
    if (this.meshPeers.has(remoteUserId)) {
      const peer = this.meshPeers.get(remoteUserId);
      if (peer.pc) {
        try { peer.pc.close(); } catch (e) {}
      }
      this.meshPeers.delete(remoteUserId);
      console.log(`[Mesh Engine] Peer ${remoteUserId} closed and cleaned`);
    }
  }

  closeAllMeshPeers() {
    this.meshPeers.forEach((peer, userId) => {
      if (peer.pc) {
        try { peer.pc.close(); } catch (e) {}
      }
    });
    this.meshPeers.clear();
  }

  // ----------------------------------------------------
  // MEDIA TOGGLES & SCREEN SHARING
  // ----------------------------------------------------
  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled !== undefined ? enabled : !track.enabled;
      });
    }
  }

  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled !== undefined ? enabled : !track.enabled;
      });
    }
  }

  async startScreenShare(toUserId = null, socket = null, isMesh = false, roomId = null) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing is not supported on this browser or requires a secure context (HTTPS / localhost).');
    }

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { ideal: 30, max: 60 }
        },
        audio: false
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];
      if (!screenTrack) throw new Error('No video track found in screen capture.');

      if ('contentHint' in screenTrack) screenTrack.contentHint = 'detail';

      // 1. Replace track in 1:1 call
      if (this.peerConnection) {
        if (!this.videoSender) {
          this.videoSender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video') ||
                             this.peerConnection.getSenders().find(s => !s.track);
        }
        if (this.videoSender) {
          await this.videoSender.replaceTrack(screenTrack);
        } else {
          this.videoSender = this.peerConnection.addTrack(screenTrack, this.screenStream);
        }
      }

      // 2. Replace track in all active mesh peers
      for (const [peerId, peer] of this.meshPeers.entries()) {
        try {
          if (peer.videoSender) {
            await peer.videoSender.replaceTrack(screenTrack);
          } else if (peer.pc) {
            const sender = peer.pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              await sender.replaceTrack(screenTrack);
              peer.videoSender = sender;
            }
          }
        } catch (e) {
          console.warn(`[WebRTC] Could not replace screen track for mesh peer ${peerId}:`, e);
        }
      }

      // Handle native user stop from floating browser bar
      screenTrack.onended = async () => {
        console.log('[WebRTC] Native screen share ended by browser');
        await this.stopScreenShare(toUserId, socket, isMesh, roomId);
        if (this.onScreenShareEnded) this.onScreenShareEnded();
      };

      this.isScreenSharing = true;
      return this.screenStream;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        console.log('[WebRTC] User cancelled screen sharing dialog');
        return null;
      }
      console.error('[WebRTC] Error starting screen share:', err);
      throw err;
    }
  }

  async stopScreenShare(toUserId = null, socket = null, isMesh = false, roomId = null) {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      this.screenStream = null;
    }

    const cameraTrack = this.localStream ? this.localStream.getVideoTracks()[0] : null;

    // Restore camera in 1:1 call
    if (this.videoSender) {
      try {
        await this.videoSender.replaceTrack(cameraTrack || null);
      } catch (e) {
        console.warn('[WebRTC] Error restoring camera track in 1:1 call:', e);
      }
    }

    // Restore camera in all mesh peers
    for (const [peerId, peer] of this.meshPeers.entries()) {
      try {
        if (peer.videoSender) {
          await peer.videoSender.replaceTrack(cameraTrack || null);
        }
      } catch (e) {
        console.warn(`[WebRTC] Error restoring camera track for mesh peer ${peerId}:`, e);
      }
    }

    this.isScreenSharing = false;
  }

  // ----------------------------------------------------
  // DYNAMIC DEVICE SWITCHING (Cameras, Mics, Audio Sinks)
  // ----------------------------------------------------
  async getMediaDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return { audioInputs: [], videoInputs: [], audioOutputs: [] };
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        audioInputs: devices.filter(d => d.kind === 'audioinput'),
        videoInputs: devices.filter(d => d.kind === 'videoinput'),
        audioOutputs: devices.filter(d => d.kind === 'audiooutput')
      };
    } catch (e) {
      console.warn('[WebRTC] Error enumerating devices:', e.message);
      return { audioInputs: [], videoInputs: [], audioOutputs: [] };
    }
  }

  async switchVideoDevice(deviceId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = stream.getVideoTracks()[0];
      if (!newTrack) return null;

      if (this.localStream) {
        const oldTrack = this.localStream.getVideoTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          this.localStream.removeTrack(oldTrack);
        }
        this.localStream.addTrack(newTrack);
      }

      if (this.peerConnection && this.videoSender) {
        await this.videoSender.replaceTrack(newTrack);
      }

      for (const peer of this.meshPeers.values()) {
        if (peer.videoSender) {
          try { await peer.videoSender.replaceTrack(newTrack); } catch (e) {}
        }
      }

      return newTrack;
    } catch (err) {
      console.warn('[WebRTC] switchVideoDevice error:', err);
      throw err;
    }
  }

  async switchAudioDevice(deviceId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
    try {
      const constraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = stream.getAudioTracks()[0];
      if (!newTrack) return null;

      if (this.localStream) {
        const oldTrack = this.localStream.getAudioTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          this.localStream.removeTrack(oldTrack);
        }
        this.localStream.addTrack(newTrack);
      }

      if (this.peerConnection) {
        const audioSender = this.peerConnection.getSenders().find(s => s.track?.kind === 'audio');
        if (audioSender) {
          await audioSender.replaceTrack(newTrack);
        }
      }

      for (const peer of this.meshPeers.values()) {
        if (peer.pc) {
          const audioSender = peer.pc.getSenders().find(s => s.track?.kind === 'audio');
          if (audioSender) {
            try { await audioSender.replaceTrack(newTrack); } catch (e) {}
          }
        }
      }

      this.initAudioAnalyser(this.localStream);
      return newTrack;
    } catch (err) {
      console.warn('[WebRTC] switchAudioDevice error:', err);
      throw err;
    }
  }

  // Mid-Call WebRTC Renegotiation Handlers (for 1:1 calls)
  async renegotiate(toUserId, socket) {
    if (!this.peerConnection || !socket || !toUserId) return;
    if (this.peerConnection.signalingState !== 'stable') {
      console.log('[WebRTC] Signaling state not stable (' + this.peerConnection.signalingState + '), deferring');
      return;
    }
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      socket.emit('call_renegotiate', { toUserId, signalData: offer });
    } catch (e) {
      console.warn('[WebRTC] Renegotiation offer error:', e);
    }
  }

  async handleRenegotiateOffer(offer, fromUserId, socket) {
    if (!this.peerConnection || !socket || !fromUserId) return;
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      await this.drainPendingCandidates();
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      socket.emit('renegotiate_answer', { toUserId: fromUserId, signalData: answer });

      if (this.onRemoteStream && this.remoteStream) {
        this.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
      }
    } catch (e) {
      console.warn('[WebRTC] Renegotiation answer error:', e);
    }
  }

  async handleRenegotiateAnswer(answer) {
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      await this.drainPendingCandidates();

      if (this.onRemoteStream && this.remoteStream) {
        this.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
      }
    } catch (e) {
      console.warn('[WebRTC] Error applying renegotiation answer:', e);
    }
  }

  // Canvas-based Background Blur filter
  applyCanvasBlurFilter(videoElement) {
    if (!videoElement) return;

    this.isBlurEnabled = !this.isBlurEnabled;
    if (!this.isBlurEnabled) {
      if (this.blurAnimFrame) cancelAnimationFrame(this.blurAnimFrame);
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    this.blurCanvas = canvas;

    const render = () => {
      if (!this.isBlurEnabled) return;
      ctx.filter = 'blur(10px)';
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';
      ctx.drawImage(videoElement, canvas.width * 0.2, canvas.height * 0.1, canvas.width * 0.6, canvas.height * 0.8,
                                canvas.width * 0.2, canvas.height * 0.1, canvas.width * 0.6, canvas.height * 0.8);
      this.blurAnimFrame = requestAnimationFrame(render);
    };
    render();

    return canvas.captureStream(30);
  }

  // Observability: Collect real-time diagnostic statistics (Phase 12)
  async getStats(peerId = null) {
    const pc = peerId ? (this.meshPeers.get(peerId)?.pc) : this.peerConnection;
    if (!pc) return null;

    try {
      const statsReport = await pc.getStats();
      const stats = {
        bytesSent: 0,
        bytesReceived: 0,
        packetsLost: 0,
        jitter: 0,
        roundTripTime: 0,
        frameWidth: 0,
        frameHeight: 0,
        framesPerSecond: 0,
        candidateType: 'unknown',
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        signalingState: pc.signalingState
      };

      statsReport.forEach(report => {
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          stats.bytesSent += report.bytesSent || 0;
          stats.framesPerSecond = report.framesPerSecond || 0;
        } else if (report.type === 'inbound-rtp') {
          stats.bytesReceived += report.bytesReceived || 0;
          stats.packetsLost += report.packetsLost || 0;
          if (report.jitter) stats.jitter = Math.round(report.jitter * 1000);
          if (report.frameWidth) stats.frameWidth = report.frameWidth;
          if (report.frameHeight) stats.frameHeight = report.frameHeight;
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (report.currentRoundTripTime) {
            stats.roundTripTime = Math.round(report.currentRoundTripTime * 1000);
          }
        } else if (report.type === 'local-candidate') {
          stats.candidateType = report.candidateType || stats.candidateType;
        }
      });

      return stats;
    } catch (e) {
      return null;
    }
  }

  // Clean up 1:1 call resources
  closePeerConnection() {
    this.pendingCandidates = [];
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
    }
    if (this.blurAnimFrame) {
      cancelAnimationFrame(this.blurAnimFrame);
      this.blurAnimFrame = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      this.screenStream = null;
    }
    this.isScreenSharing = false;
    this.videoSender = null;
  }

  // Complete cleanup of all media, timers, mesh peers, and audio contexts (Phase 9)
  cleanupAll() {
    this.closePeerConnection();
    this.closeAllMeshPeers();
    this.pendingCandidates = [];

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      this.localStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch (e) {}
      this.audioContext = null;
    }

    this.analyser = null;
    this.isScreenSharing = false;
    this.isBlurEnabled = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
  }
}

export const webrtcService = new WebRTCService();
