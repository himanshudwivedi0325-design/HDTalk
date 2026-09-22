import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { webrtcService } from '../services/webrtcService';
import { soundService } from '../services/soundService';
import { callRecorderService } from '../services/recorderService';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useAuth();

  // Call States: 'idle' | 'calling' (outgoing init) | 'ringing' (callee ringing) | 'incoming' | 'connecting' | 'connected' | 'reconnecting' | 'ended'
  const [callState, setCallState] = useState('idle');
  const [callType, setCallType] = useState('video'); // 'video' | 'audio'
  const [remoteUser, setRemoteUser] = useState(null);
  const [pendingSignal, setPendingSignal] = useState(null);
  const [callStatusMessage, setCallStatusMessage] = useState('');

  // Group Mesh Calling States (Phases 3, 4, 11)
  const [isGroupCall, setIsGroupCall] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState(null);
  // groupParticipants: Map of userId -> { userId, user, callType, stream, status }
  const [groupParticipants, setGroupParticipants] = useState(new Map());

  // Streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [hardwareStatus, setHardwareStatus] = useState({ videoAvailable: true, audioAvailable: true, isFallback: false });

  // Media Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [isBlurEnabled, setIsBlurEnabled] = useState(false);
  const [inCallChatOpen, setInCallChatOpen] = useState(false);

  // Call duration timer
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);

  // Ring timeout (45 seconds for outgoing call)
  const ringTimeoutRef = useRef(null);

  // Real-time WebRTC Diagnostics (Phase 12)
  const [callDiagnostics, setCallDiagnostics] = useState(null);
  const diagnosticsIntervalRef = useRef(null);

  // In-Call Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordTimerRef = useRef(null);

  // Video and Audio element references
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Refs for stable closures in callbacks
  const remoteUserRef = useRef(null);
  const callStateRef = useRef('idle');
  const activeRoomIdRef = useRef(null);
  const titleIntervalRef = useRef(null);
  const originalTitleRef = useRef(typeof document !== 'undefined' ? document.title : 'HDTalk');
  const outgoingCallSignaledRef = useRef(false);
  const callerCandidateQueueRef = useRef([]);

  const startTitleFlashing = (callerName) => {
    stopTitleFlashing();
    if (typeof document === 'undefined') return;
    originalTitleRef.current = document.title;
    let toggle = false;
    titleIntervalRef.current = setInterval(() => {
      document.title = toggle 
        ? `📞 INCOMING CALL - ${callerName || 'Someone'} is calling...`
        : `⚡ HDTalk - Click to Answer!`;
      toggle = !toggle;
    }, 800);
  };

  const stopTitleFlashing = () => {
    if (titleIntervalRef.current) {
      clearInterval(titleIntervalRef.current);
      titleIntervalRef.current = null;
    }
    if (typeof document !== 'undefined' && originalTitleRef.current) {
      document.title = originalTitleRef.current;
    }
  };

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  // Fetch STUN/TURN ICE server configuration from backend on initialization
  useEffect(() => {
    webrtcService.fetchIceServers();
  }, []);

  // Bind WebRTC callbacks
  useEffect(() => {
    webrtcService.onRemoteStream = (stream) => {
      console.log('[CallContext] Received remote stream tracks:', stream.getTracks().length);
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(e => console.log('Remote play note:', e));
      }
    };

    webrtcService.onScreenShareEnded = () => {
      console.log('[CallContext] Native screen share ended by browser');
      setIsScreenSharing(false);
      if (webrtcService.localStream) {
        setLocalStream(webrtcService.localStream);
      }
      const target = remoteUserRef.current;
      if (socket && target) {
        socket.emit('screen_share_status', { toUserId: target.id, isSharing: false });
      }
    };

    webrtcService.onIceCandidate = (candidate) => {
      const target = remoteUserRef.current;
      if (!socket || !target || !target.id) return;

      // Queue caller ICE candidates until call_user offer has been dispatched
      if (callStateRef.current === 'calling' && !outgoingCallSignaledRef.current) {
        callerCandidateQueueRef.current.push(candidate);
        return;
      }

      socket.emit('ice_candidate', {
        toUserId: target.id,
        candidate
      });
    };

    webrtcService.onHardwareStatusChange = (status) => {
      setHardwareStatus(status);
    };

    webrtcService.onConnectionStateChange = (state) => {
      console.log('[CallContext] Connection state transition:', state);
      if (state === 'connecting') {
        setCallState('connecting');
      } else if (state === 'connected') {
        setCallState('connected');
        clearRingTimeout();
        startTimer();
        startDiagnostics();
      } else if (state === 'reconnecting') {
        setCallState('reconnecting');
      } else if (state === 'failed') {
        console.warn('[CallContext] WebRTC connection failed permanently.');
        setCallStatusMessage('Call disconnected due to network failure');
        endCall(false);
      } else if (state === 'ended') {
        endCall(false);
      }
    };
  }, [socket]);

  // Keep local video element updated with local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.log('Local play note:', e));
    }
  }, [localStream, callState]);

  // Keep remote video element updated with remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.log('Remote play note:', e));
    }
  }, [remoteStream, callState]);

  // Keep dedicated remote audio element updated with remote stream for crystal-clear voice output
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.play().catch(e => console.warn('[CallContext] Remote audio play note:', e));
    }
  }, [remoteStream, callState]);

  // Real-time diagnostics polling during active calls
  const startDiagnostics = () => {
    if (diagnosticsIntervalRef.current) clearInterval(diagnosticsIntervalRef.current);
    diagnosticsIntervalRef.current = setInterval(async () => {
      if (callStateRef.current === 'connected') {
        const stats = await webrtcService.getStats();
        if (stats) setCallDiagnostics(stats);
      }
    }, 2000);
  };

  const stopDiagnostics = () => {
    if (diagnosticsIntervalRef.current) {
      clearInterval(diagnosticsIntervalRef.current);
      diagnosticsIntervalRef.current = null;
    }
    setCallDiagnostics(null);
  };

  const startRingTimeout = (target) => {
    clearRingTimeout();
    // 45 seconds timeout for outgoing unanswered calls
    ringTimeoutRef.current = setTimeout(() => {
      console.log('[Call] Ringing timed out after 45s. Cancelling call.');
      soundService.stopRing();
      soundService.playCallEnded();
      if (socket && target) {
        socket.emit('end_call', { toUserId: target.id });
      }
      cleanup();
      setCallState('idle');
      setCallStatusMessage('No answer from user');
    }, 45000);
  };

  const clearRingTimeout = () => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  };

  // Socket Signaling Listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming Call
    const handleIncomingCall = (data) => {
      console.log('[Call] Incoming call received from:', data.callerName);
      const callerObj = {
        id: data.callerId,
        name: data.callerName,
        avatar: data.callerAvatar
      };
      remoteUserRef.current = callerObj;
      setRemoteUser(callerObj);
      setCallType(data.callType || 'video');
      setPendingSignal(data.signalData);
      setCallState('incoming');
      soundService.playIncomingRing();
      startTitleFlashing(data.callerName);
    };

    // Callee device ringing acknowledge
    const handleCallRinging = (data) => {
      console.log('[Call] Remote peer device is ringing:', data.targetUserId);
      setCallState('ringing');
    };

    // Caller receives acceptance from Callee
    const handleCallAccepted = async (data) => {
      console.log('[Call] Call accepted by remote peer');
      clearRingTimeout();
      stopTitleFlashing();
      soundService.stopRing();
      setCallState('connecting');

      if (data.signalData) {
        await webrtcService.handleAnswer(data.signalData);
      }
    };

    // Peer rejected call
    const handleCallRejected = (data) => {
      console.log('[Call] Call rejected:', data.reason);
      clearRingTimeout();
      stopTitleFlashing();
      soundService.stopRing();
      soundService.playCallEnded();
      cleanup();
      setCallState('idle');
      setCallStatusMessage(`Call declined: ${data.reason || 'declined'}`);
    };

    // Peer ended call
    const handleCallEnded = (data) => {
      console.log('[Call] Remote peer hung up:', data?.reason || 'normal');
      clearRingTimeout();
      stopTitleFlashing();
      soundService.stopRing();
      soundService.playCallEnded();
      cleanup();
      setCallState('idle');
      if (data?.reason) setCallStatusMessage(data.reason);
    };

    // Peer ICE Candidate
    const handleIceCandidate = (data) => {
      if (data.candidate) {
        webrtcService.handleIceCandidate(data.candidate);
      }
    };

    // Peer screen share toggle
    const handleScreenStatus = (data) => {
      setIsRemoteScreenSharing(!!data.isSharing);
    };

    // Mid-call renegotiation (e.g. ICE restart or screen share)
    const handleCallRenegotiate = async (data) => {
      console.log('[Call] Mid-call renegotiation requested from:', data.fromUserId);
      await webrtcService.handleRenegotiateOffer(data.signalData, data.fromUserId, socket);
    };

    const handleRenegotiateAnswer = async (data) => {
      console.log('[Call] Mid-call renegotiation answered');
      await webrtcService.handleRenegotiateAnswer(data.signalData);
    };

    // ----------------------------------------------------
    // GROUP MESH ROOM CALL LISTENERS (Phases 3, 4, 11)
    // ----------------------------------------------------
    const handleCallRoomUsers = ({ roomId, participants }) => {
      console.log(`[Mesh Call] Received room participants (${participants.length}):`, participants);
      setGroupParticipants(prev => {
        const next = new Map(prev);
        participants.forEach(p => {
          if (!next.has(p.userId)) {
            next.set(p.userId, { ...p, stream: null, status: 'connecting' });
            // Initiator establishes connection with existing member
            webrtcService.createMeshPeer({
              roomId,
              remoteUserId: p.userId,
              isInitiator: true,
              onRemoteStream: (uid, stream) => handleMeshRemoteStream(uid, stream),
              onPeerStateChange: (uid, state) => handleMeshPeerState(uid, state),
              socket
            });
          }
        });
        return next;
      });
    };

    const handleRoomUserJoined = ({ roomId, userId, callType: cType, user: pUser }) => {
      console.log(`[Mesh Call] New participant joined room ${roomId}:`, userId);
      setGroupParticipants(prev => {
        const next = new Map(prev);
        if (!next.has(userId)) {
          next.set(userId, { userId, user: pUser, callType: cType, stream: null, status: 'connecting' });
        }
        return next;
      });
    };

    const handleRoomUserLeft = ({ roomId, userId }) => {
      console.log(`[Mesh Call] Participant left room ${roomId}:`, userId);
      webrtcService.closeMeshPeer(userId);
      setGroupParticipants(prev => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    };

    const handleCallRoomError = ({ message }) => {
      console.warn('[Mesh Call] Room error:', message);
      setCallStatusMessage(message);
      leaveGroupCall();
    };

    const handleMeshSignal = async (data) => {
      await webrtcService.handleMeshSignal({
        roomId: data.roomId,
        fromUserId: data.fromUserId,
        signalData: data.signalData,
        type: data.type,
        socket,
        onRemoteStream: handleMeshRemoteStream,
        onPeerStateChange: handleMeshPeerState
      });
    };

    const handleMeshIceCandidate = async (data) => {
      await webrtcService.handleMeshIceCandidate(data.fromUserId, data.candidate);
    };

    const handleMeshRemoteStream = (uid, stream) => {
      console.log(`[Mesh Call] Remote stream received from peer ${uid}`);
      setGroupParticipants(prev => {
        const next = new Map(prev);
        const existing = next.get(uid);
        if (existing) {
          next.set(uid, { ...existing, stream, status: 'connected' });
        }
        return next;
      });
    };

    const handleMeshPeerState = (uid, state) => {
      setGroupParticipants(prev => {
        const next = new Map(prev);
        const existing = next.get(uid);
        if (existing) {
          next.set(uid, { ...existing, status: state });
        }
        return next;
      });
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_ringing', handleCallRinging);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('screen_share_status', handleScreenStatus);
    socket.on('call_renegotiate', handleCallRenegotiate);
    socket.on('renegotiate_answer', handleRenegotiateAnswer);

    // Group Mesh Events
    socket.on('call_room_users', handleCallRoomUsers);
    socket.on('room_user_joined', handleRoomUserJoined);
    socket.on('room_user_left', handleRoomUserLeft);
    socket.on('call_room_error', handleCallRoomError);
    socket.on('mesh_signal', handleMeshSignal);
    socket.on('mesh_ice_candidate', handleMeshIceCandidate);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_ringing', handleCallRinging);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_ended', handleCallEnded);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('screen_share_status', handleScreenStatus);
      socket.off('call_renegotiate', handleCallRenegotiate);
      socket.off('renegotiate_answer', handleRenegotiateAnswer);

      socket.off('call_room_users', handleCallRoomUsers);
      socket.off('room_user_joined', handleRoomUserJoined);
      socket.off('room_user_left', handleRoomUserLeft);
      socket.off('call_room_error', handleCallRoomError);
      socket.off('mesh_signal', handleMeshSignal);
      socket.off('mesh_ice_candidate', handleMeshIceCandidate);
    };
  }, [socket]);

  const startTimer = () => {
    setCallDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallDuration(0);
  };

  const cleanup = () => {
    clearRingTimeout();
    stopTimer();
    stopDiagnostics();

    if (callRecorderService.isRecording) {
      callRecorderService.stopRecording();
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);

    webrtcService.cleanupAll();
    stopTitleFlashing();
    outgoingCallSignaledRef.current = false;
    callerCandidateQueueRef.current = [];
    remoteUserRef.current = null;
    activeRoomIdRef.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setRemoteUser(null);
    setPendingSignal(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setIsRemoteScreenSharing(false);
    setIsBlurEnabled(false);
    setInCallChatOpen(false);
    setIsGroupCall(false);
    setActiveRoomId(null);
    setGroupParticipants(new Map());
  };

  // 1. Initiate 1:1 Outgoing Call
  const initiateCall = async (rawTargetUser, type = 'video') => {
    if (!rawTargetUser || !socket) return;

    // Normalize target user object whether string ID or user object
    let targetUserObj = null;
    if (typeof rawTargetUser === 'string') {
      targetUserObj = { id: rawTargetUser, name: 'User', avatar: null };
    } else {
      targetUserObj = {
        id: rawTargetUser.id || rawTargetUser._id || rawTargetUser.userId,
        name: rawTargetUser.name || rawTargetUser.username || 'User',
        avatar: rawTargetUser.avatar || null
      };
    }

    if (!targetUserObj.id) {
      console.error('[Call] initiateCall aborted: missing target user id', rawTargetUser);
      return;
    }

    try {
      outgoingCallSignaledRef.current = false;
      callerCandidateQueueRef.current = [];

      remoteUserRef.current = targetUserObj;
      setRemoteUser(targetUserObj);
      setCallType(type);
      setCallState('calling');
      soundService.playOutgoingRing();

      // Start 45-second ring timeout
      startRingTimeout(targetUserObj);

      // Acquire media with hardware fallback
      const stream = await webrtcService.startLocalStream({
        video: type === 'video',
        audio: true
      });
      setLocalStream(stream);

      // Create 1:1 peer connection bound to target user
      webrtcService.createPeerConnection(targetUserObj.id, socket);

      // Create WebRTC Offer
      const offer = await webrtcService.createOffer();

      // Emit call_user
      socket.emit('call_user', {
        targetUserId: targetUserObj.id,
        callType: type,
        signalData: offer
      });

      // Mark call as signaled and flush initial caller ICE candidates
      outgoingCallSignaledRef.current = true;
      if (callerCandidateQueueRef.current.length > 0) {
        console.log(`[CallContext] Flushing ${callerCandidateQueueRef.current.length} queued caller ICE candidates`);
        while (callerCandidateQueueRef.current.length > 0) {
          const cand = callerCandidateQueueRef.current.shift();
          socket.emit('ice_candidate', {
            toUserId: targetUserObj.id,
            candidate: cand
          });
        }
      }
    } catch (err) {
      console.error('Failed to initiate call:', err);
      soundService.stopRing();
      cleanup();
      setCallState('idle');
      setCallStatusMessage('Could not start call. Please check device permissions.');
    }
  };

  // 2. Accept Incoming Call
  const acceptCall = async () => {
    const target = remoteUserRef.current || remoteUser;
    if (!socket || !target) return;
    try {
      clearRingTimeout();
      stopTitleFlashing();
      soundService.stopRing();
      setCallState('connecting');

      // Acquire local media
      const stream = await webrtcService.startLocalStream({
        video: callType === 'video',
        audio: true
      });
      setLocalStream(stream);

      // Preserve caller ICE candidates received during ringing
      webrtcService.createPeerConnection(target.id, socket, true);

      // Answer WebRTC offer
      const answer = await webrtcService.createAnswer(pendingSignal);

      // Emit accept_call
      socket.emit('accept_call', {
        toUserId: target.id,
        signalData: answer
      });
    } catch (err) {
      console.error('Failed to accept call:', err);
      soundService.stopRing();
      stopTitleFlashing();
      rejectCall('Hardware permission error');
    }
  };

  // 3. Reject Incoming Call
  const rejectCall = (reason = 'declined') => {
    clearRingTimeout();
    stopTitleFlashing();
    soundService.stopRing();
    const target = remoteUserRef.current || remoteUser;
    if (socket && target) {
      socket.emit('reject_call', {
        toUserId: target.id,
        reason
      });
    }
    cleanup();
    setCallState('idle');
  };

  // 4. End Call
  const endCall = (notifyPeer = true) => {
    clearRingTimeout();
    soundService.stopRing();
    soundService.playCallEnded();

    if (isGroupCall && activeRoomId) {
      leaveGroupCall();
      return;
    }

    const target = remoteUserRef.current || remoteUser;
    if (notifyPeer && socket && target) {
      socket.emit('end_call', {
        toUserId: target.id
      });
    }
    cleanup();
    setCallState('idle');
  };

  // 5. Group Mesh Room Calling (Phases 3, 4, 11)
  const joinGroupCall = async (roomId, type = 'video') => {
    if (!socket || !roomId) return;
    try {
      cleanup();
      setIsGroupCall(true);
      setActiveRoomId(roomId);
      activeRoomIdRef.current = roomId;
      setCallType(type);
      setCallState('connected');

      // Acquire local media
      const stream = await webrtcService.startLocalStream({
        video: type === 'video',
        audio: true
      });
      setLocalStream(stream);
      startTimer();

      // Join room via socket
      socket.emit('join_call_room', { roomId, callType: type });
    } catch (err) {
      console.error('Failed to join group call:', err);
      leaveGroupCall();
      setCallStatusMessage('Could not connect to group call.');
    }
  };

  const leaveGroupCall = () => {
    if (socket && activeRoomIdRef.current) {
      socket.emit('leave_call_room', { roomId: activeRoomIdRef.current });
    }
    cleanup();
    setCallState('idle');
  };

  // Media Toggles
  const toggleMic = () => {
    const next = !isMuted;
    setIsMuted(next);
    webrtcService.toggleAudio(!next);
  };

  const toggleCam = () => {
    const next = !isVideoOff;
    setIsVideoOff(next);
    webrtcService.toggleVideo(!next);
  };

  const toggleScreenShare = async () => {
    const target = remoteUserRef.current || remoteUser;
    if (!isScreenSharing) {
      try {
        const stream = await webrtcService.startScreenShare(target?.id, socket, isGroupCall, activeRoomId);
        if (!stream) return;
        setIsScreenSharing(true);
        setLocalStream(stream);
        if (socket && target) {
          socket.emit('screen_share_status', { toUserId: target.id, isSharing: true });
        }
      } catch (err) {
        console.warn('Screen share failed:', err);
        setCallStatusMessage(err.message || 'Screen sharing failed.');
      }
    } else {
      await webrtcService.stopScreenShare(target?.id, socket, isGroupCall, activeRoomId);
      setIsScreenSharing(false);
      if (webrtcService.localStream) {
        setLocalStream(webrtcService.localStream);
      }
      if (socket && target) {
        socket.emit('screen_share_status', { toUserId: target.id, isSharing: false });
      }
    }
  };

  const toggleBlur = () => {
    if (localVideoRef.current) {
      webrtcService.applyCanvasBlurFilter(localVideoRef.current);
      setIsBlurEnabled(prev => !prev);
    }
  };

  const startRecording = () => {
    try {
      callRecorderService.startRecording(localStream, remoteStream);
      setIsRecording(true);
      setRecordingDuration(0);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('[CallContext] Recording start note:', err);
      setCallStatusMessage(err.message || 'Could not start call recording.');
    }
  };

  const stopRecording = () => {
    callRecorderService.stopRecording();
    setIsRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecordingDuration(0);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const getMediaDevices = useCallback(async () => {
    return await webrtcService.getMediaDevices();
  }, []);

  const switchCamera = useCallback(async (deviceId) => {
    try {
      const track = await webrtcService.switchVideoDevice(deviceId);
      if (webrtcService.localStream) {
        setLocalStream(new MediaStream(webrtcService.localStream.getTracks()));
      }
      return track;
    } catch (e) {
      console.warn('[CallContext] switchCamera error:', e);
      return null;
    }
  }, []);

  const switchMicrophone = useCallback(async (deviceId) => {
    try {
      const track = await webrtcService.switchAudioDevice(deviceId);
      if (webrtcService.localStream) {
        setLocalStream(new MediaStream(webrtcService.localStream.getTracks()));
      }
      return track;
    } catch (e) {
      console.warn('[CallContext] switchMicrophone error:', e);
      return null;
    }
  }, []);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <CallContext.Provider value={{
      callState,
      callType,
      remoteUser,
      localStream,
      remoteStream,
      hardwareStatus,
      callStatusMessage,
      localVideoRef,
      remoteVideoRef,
      remoteAudioRef,
      isMuted,
      isVideoOff,
      isScreenSharing,
      isRemoteScreenSharing,
      isBlurEnabled,
      isRecording,
      recordingDuration: formatDuration(recordingDuration),
      inCallChatOpen,
      callDuration: formatDuration(callDuration),
      rawDurationSeconds: callDuration,
      callDiagnostics,
      isGroupCall,
      activeRoomId,
      groupParticipants: Array.from(groupParticipants.values()),
      joinGroupCall,
      leaveGroupCall,
      initiateCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMic,
      toggleCam,
      toggleScreenShare,
      toggleBlur,
      toggleRecording,
      startRecording,
      stopRecording,
      getMediaDevices,
      switchCamera,
      switchMicrophone,
      setInCallChatOpen,
      clearStatusMessage: () => setCallStatusMessage('')
    }}>
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);
