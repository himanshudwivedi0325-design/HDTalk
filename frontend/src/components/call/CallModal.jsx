import React, { useEffect, useRef } from 'react';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  PhoneCall, 
  Monitor, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle, 
  CircleDot, 
  Users, 
  Activity, 
  RefreshCw, 
  X
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';

// Subcomponent for individual group participant video tile in P2P mesh
function MeshParticipantTile({ participant }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // Dedicated audio playback for mesh participant (works even if video is off)
  useEffect(() => {
    if (audioRef.current && participant.stream) {
      if (audioRef.current.srcObject !== participant.stream) {
        audioRef.current.srcObject = participant.stream;
      }
      audioRef.current.muted = false;
      audioRef.current.volume = 1.0;
      audioRef.current.play().catch(e => console.log('Mesh audio play note:', e));
    }
  }, [participant.stream]);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      if (videoRef.current.srcObject !== participant.stream) {
        videoRef.current.srcObject = participant.stream;
      }
      videoRef.current.play().catch(e => console.log('Mesh tile play note:', e));
    }
  }, [participant.stream]);

  const hasVideo = Boolean(participant.stream && participant.stream.getVideoTracks().length > 0 && participant.stream.getVideoTracks()[0].enabled);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-xl flex items-center justify-center aspect-video sm:aspect-auto">
      {/* Hidden dedicated audio element ensuring participant voice is always heard */}
      <audio ref={audioRef} autoPlay playsInline />

      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <Avatar
            src={participant.user?.avatar}
            name={participant.user?.name}
            size="2xl"
            shape="circle"
            className="ring-2 ring-white/20 mb-2 shadow-lg"
          />
          <span className="text-xs font-semibold text-white truncate max-w-[120px]">
            {participant.user?.name || 'Participant'}
          </span>
          <span className="text-[10px] text-cyan-400 font-mono mt-0.5">
            {participant.status === 'connected' ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      )}

      {/* Label overlay */}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white font-medium flex items-center gap-1.5">
        <span>{participant.user?.name || 'Participant'}</span>
        {participant.status !== 'connected' && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
        )}
      </div>
    </div>
  );
}

export function CallModal() {
  const { 
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
    recordingDuration,
    callDuration,
    callDiagnostics,
    isGroupCall,
    groupParticipants,
    acceptCall, 
    rejectCall, 
    endCall,
    leaveGroupCall,
    toggleMic, 
    toggleCam, 
    toggleScreenShare, 
    toggleBlur,
    toggleRecording,
    clearStatusMessage
  } = useCall();

  const { user } = useAuth();
  const outgoingPreviewRef = useRef(null);

  // Directly attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.log('Local video play note:', e));
    }
  }, [localStream, callState, localVideoRef]);

  // Directly attach dedicated unmuted remote audio in 1:1 call
  useEffect(() => {
    const audioEl = remoteAudioRef?.current;
    if (!audioEl || !remoteStream) return;

    if (audioEl.srcObject !== remoteStream) {
      audioEl.srcObject = remoteStream;
    }

    const playAudio = () => {
      audioEl.muted = false;
      audioEl.volume = 1.0;
      audioEl.play().catch(e => {
        console.warn('[CallModal] Remote audio play attempt note:', e);
      });
    };
    playAudio();

    const audioTracks = remoteStream.getAudioTracks();
    const handleAudioUnmute = () => playAudio();
    audioTracks.forEach(track => {
      track.enabled = true;
      track.addEventListener('unmute', handleAudioUnmute);
    });

    const handleUserGesture = () => {
      if (audioEl && (audioEl.paused || audioEl.muted)) {
        audioEl.muted = false;
        audioEl.volume = 1.0;
        audioEl.play().catch(() => {});
      }
    };
    window.addEventListener('click', handleUserGesture, { once: true });
    window.addEventListener('touchstart', handleUserGesture, { once: true });

    return () => {
      audioTracks.forEach(track => track.removeEventListener('unmute', handleAudioUnmute));
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('touchstart', handleUserGesture);
    };
  }, [remoteStream, callState, remoteAudioRef]);

  // Directly attach remote video in 1:1 call (muted so browser autoplay policies never block video)
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl || !remoteStream) return;

    if (videoEl.srcObject !== remoteStream) {
      videoEl.srcObject = remoteStream;
    }
    videoEl.muted = true;
    const playRemote = () => {
      videoEl.play().catch(err => console.log('Remote play retry note:', err));
    };
    playRemote();

    const videoTracks = remoteStream.getVideoTracks();
    const handleUnmute = () => playRemote();
    videoTracks.forEach(track => track.addEventListener('unmute', handleUnmute));

    return () => {
      videoTracks.forEach(track => track.removeEventListener('unmute', handleUnmute));
    };
  }, [remoteStream, callState, isRemoteScreenSharing, remoteVideoRef]);

  // Outgoing local preview
  useEffect(() => {
    if (outgoingPreviewRef.current && localStream) {
      outgoingPreviewRef.current.srcObject = localStream;
      outgoingPreviewRef.current.play().catch(e => console.log('Outgoing preview play note:', e));
    }
  }, [localStream, callState]);

  if (callState === 'idle') return null;

  // 1. INCOMING CALL FULL-SCREEN CALLING STAGE (WhatsApp / Telegram style)
  if (callState === 'incoming') {
    return (
      <div 
        className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-10 bg-slate-950/95 backdrop-blur-2xl text-white select-none animate-in fade-in duration-300"
        onKeyDown={(e) => {
          if (e.key === 'Enter') acceptCall();
          if (e.key === 'Escape') rejectCall('declined');
        }}
        tabIndex={0}
      >
        {/* Ambient glow backgrounds */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-br from-emerald-500/25 via-cyan-500/20 to-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-tr from-blue-600/20 to-teal-500/20 rounded-full blur-3xl"></div>
        </div>

        {/* Top Header Badge */}
        <div className="relative z-10 pt-4 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md shadow-lg">
            {callType === 'video' ? (
              <Video className="w-4 h-4 text-emerald-400 animate-pulse" />
            ) : (
              <PhoneCall className="w-4 h-4 text-cyan-400 animate-pulse" />
            )}
            <span className="text-xs font-bold tracking-wide uppercase text-emerald-300">
              Incoming {callType === 'video' ? 'HD Video Call' : 'Voice Call'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">HDTalk End-to-End Encrypted WebRTC</p>
        </div>

        {/* Center: Caller Identity & Pulsing Sonar Radar Rings */}
        <div className="relative z-10 flex flex-col items-center text-center my-auto">
          <div className="relative flex items-center justify-center my-6">
            {/* Concentric sonar pulses */}
            <span className="absolute w-44 h-44 rounded-full bg-emerald-500/15 animate-ping opacity-60"></span>
            <span className="absolute w-52 h-52 rounded-full border border-emerald-400/25 animate-pulse"></span>
            <span className="absolute w-60 h-60 rounded-full border border-cyan-400/15 animate-pulse"></span>

            {/* Main Caller Avatar */}
            <div className="relative z-10 ring-4 ring-emerald-500/70 rounded-full shadow-2xl shadow-emerald-500/30 p-1 bg-gradient-to-tr from-emerald-500 to-cyan-400">
              <Avatar
                src={remoteUser?.avatar}
                name={remoteUser?.name}
                size="3xl"
                shape="circle"
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover"
              />
            </div>
          </div>

          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight drop-shadow-md">
            {remoteUser?.name || 'Someone'}
          </h2>
          <p className="text-sm text-slate-300 font-medium mt-1">
            {remoteUser?.headline || remoteUser?.profession || 'HDTalk Member'}
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs text-emerald-400 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Ringing... (Click or tap to answer)</span>
          </div>
        </div>

        {/* Bottom Action Controls (Large, Thumb-Friendly buttons) */}
        <div className="relative z-10 w-full max-w-sm pb-6 flex items-center justify-around gap-6">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => rejectCall('declined')}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 hover:scale-110 active:scale-95 transition cursor-pointer"
              title="Decline Call (Esc)"
              aria-label="Decline Call"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-xs font-semibold text-slate-300">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={acceptCall}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-white flex items-center justify-center shadow-xl shadow-emerald-500/50 ring-4 ring-emerald-400/40 hover:scale-110 active:scale-95 transition animate-bounce cursor-pointer"
              title="Accept Call (Enter)"
              aria-label="Accept Call"
            >
              {callType === 'video' ? (
                <Video className="w-7 h-7" />
              ) : (
                <PhoneCall className="w-7 h-7" />
              )}
            </button>
            <span className="text-xs font-bold text-emerald-400">Accept</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. OUTGOING CALL SCREEN (Calling / Ringing state)
  if (callState === 'calling' || callState === 'ringing') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 animate-in fade-in select-none">
        <div className="bg-white/95 dark:bg-[#0c1220]/95 max-w-sm w-full rounded-3xl p-6 text-center shadow-2xl border border-slate-200/90 dark:border-white/20 relative overflow-hidden transition-colors duration-200">
          <div className="relative mx-auto w-36 h-36 rounded-3xl overflow-hidden border-2 border-blue-500/40 dark:border-cyan-500/40 shadow-2xl my-3 bg-black">
            {localStream ? (
              <video
                ref={outgoingPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Avatar
                  src={remoteUser?.avatar}
                  name={remoteUser?.name}
                  size="3xl"
                  shape="squircle"
                />
              </div>
            )}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[9px] text-cyan-300 font-bold uppercase tracking-wider">
              Preview
            </div>
          </div>

          <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white mb-1">
            Calling {remoteUser?.name}...
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-cyan-400 animate-ping"></span>
            <span>
              {callState === 'ringing' 
                ? 'Ringing... (Waiting for answer)' 
                : 'Connecting signaling channel...'}
            </span>
          </p>

          <button
            onClick={() => endCall(true)}
            className="flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs mx-auto shadow-lg shadow-rose-600/40 transition hover:scale-105"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Cancel Call</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. CONNECTED / RECONNECTING CALL STAGE
  const totalMeshCount = groupParticipants instanceof Map 
    ? groupParticipants.size + 1 
    : (Array.isArray(groupParticipants) ? groupParticipants.length + 1 : 1);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#08090f] select-none animate-in fade-in">
      {/* Reconnecting Notification Banner (Phase 6) */}
      {callState === 'reconnecting' && (
        <div className="absolute top-0 left-0 right-0 z-40 bg-amber-500/90 text-slate-950 font-bold text-xs py-2 px-4 text-center shadow-lg flex items-center justify-center gap-2 animate-pulse">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Network connection lost. Re-establishing WebRTC peer stream...</span>
        </div>
      )}

      {/* Floating Status / Warning Banner */}
      {callStatusMessage && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 text-slate-100 border border-white/20 text-xs py-1.5 px-4 rounded-full shadow-2xl flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>{callStatusMessage}</span>
          <button onClick={clearStatusMessage} className="text-white/60 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Top Header Floating Pill */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-2xl vision-glass border border-white/20 shadow-xl">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${callState === 'reconnecting' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-ping'}`}></span>
          <span className="font-semibold text-xs text-white">
            {isGroupCall ? `HDTalk Group Mesh (${totalMeshCount}/6)` : remoteUser?.name}
          </span>
        </div>
        <span className="text-white/30">•</span>
        <span className="font-mono text-xs text-cyan-300 font-bold">{callDuration}</span>
        <span className="text-white/30">•</span>
        <span className="text-[10px] text-slate-300 font-medium px-2 py-0.5 rounded bg-white/10 border border-white/10 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span className="font-bold text-blue-400">HDTalk</span> {isGroupCall ? 'Mesh' : 'P2P'}
        </span>

        {/* Real-time Diagnostics HUD (Phase 12) */}
        {callDiagnostics && (
          <>
            <span className="text-white/30">•</span>
            <div className="flex items-center gap-1 text-[10px] text-cyan-300 font-mono">
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>{callDiagnostics.roundTripTime || '<1'}ms</span>
              {callDiagnostics.packetsLost > 0 && (
                <span className="text-rose-400">({callDiagnostics.packetsLost} lost)</span>
              )}
            </div>
          </>
        )}

        {isRecording && (
          <>
            <span className="text-white/30">•</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/25 border border-rose-500/50 text-[10px] text-rose-200 font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>REC {recordingDuration}</span>
            </div>
          </>
        )}
      </div>

      {/* Remote Screen Share Active Pill */}
      {isRemoteScreenSharing && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 text-xs font-semibold backdrop-blur-xl shadow-2xl animate-pulse">
          <Monitor className="w-4 h-4 text-cyan-300" />
          <span>{remoteUser?.name} is sharing their screen</span>
        </div>
      )}

      {/* Main Viewport */}
      {isGroupCall ? (
        // GROUP MESH RESPONSIVE GRID (Phases 3, 4, 11)
        <div className="flex-1 p-4 pt-20 pb-24 grid gap-3 sm:gap-4 overflow-y-auto auto-rows-fr"
             style={{
               gridTemplateColumns: totalMeshCount <= 2 ? 'repeat(auto-fit, minmax(320px, 1fr))' :
                                    totalMeshCount <= 4 ? 'repeat(2, minmax(0, 1fr))' :
                                    'repeat(3, minmax(0, 1fr))'
             }}>
          {/* Local User Tile */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-blue-500/40 shadow-xl flex items-center justify-center aspect-video sm:aspect-auto">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoOff && !isScreenSharing ? 'hidden' : ''}`}
            />
            {isVideoOff && !isScreenSharing && (
              <div className="flex flex-col items-center justify-center p-4">
                <Avatar src={user?.avatar} name={user?.name} size="2xl" shape="circle" className="ring-2 ring-blue-500 mb-2" />
                <span className="text-xs font-semibold text-white">You (Camera Off)</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-cyan-300 font-semibold flex items-center gap-1.5">
              <span>You (Host)</span>
              {isMuted && <MicOff className="w-3 h-3 text-rose-400" />}
            </div>
          </div>

          {/* Remote Mesh Participant Tiles */}
          {(groupParticipants instanceof Map ? Array.from(groupParticipants.values()) : (Array.isArray(groupParticipants) ? groupParticipants : [])).map(p => (
            <MeshParticipantTile key={p.userId} participant={p} />
          ))}
        </div>
      ) : (
        // 1:1 CALL STAGE
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-black/40 via-transparent to-black/60">
          {/* Dedicated unmuted audio element for incoming 1:1 call audio */}
          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
          />
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />

          {(callType === 'audio' && !isRemoteScreenSharing) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="mb-4">
                <Avatar
                  src={remoteUser?.avatar}
                  name={remoteUser?.name}
                  size="3xl"
                  shape="circle"
                  className="ring-4 ring-white/20 shadow-2xl"
                />
              </div>
              <h4 className="font-display font-bold text-xl text-white mb-1">{remoteUser?.name}</h4>
              <div className="flex items-center gap-1 h-6">
                {[30, 70, 45, 90, 60, 100, 50, 80, 40].map((h, i) => (
                  <span
                    key={i}
                    className="w-1 bg-cyan-400 rounded-full animate-pulse"
                    style={{ height: `${h}%`, animationDelay: `${i * 150}ms` }}
                  ></span>
                ))}
              </div>
            </div>
          )}

          {/* Local PiP Window */}
          <div className="absolute bottom-24 right-4 sm:bottom-28 sm:right-6 w-36 sm:w-52 aspect-video rounded-2xl overflow-hidden vision-glass border-2 border-white/20 shadow-2xl z-20 transition-transform hover:scale-105">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoOff && !isScreenSharing ? 'hidden' : ''}`}
            />
            {isVideoOff && !isScreenSharing && (
              <div className="w-full h-full bg-[#141824] flex items-center justify-center text-xs text-slate-400 font-medium">
                Camera Off
              </div>
            )}
            <div className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white font-semibold flex items-center gap-1.5">
              <span>You</span>
              {isScreenSharing && (
                <span className="text-cyan-300 font-bold flex items-center gap-0.5">
                  • <Monitor className="w-2.5 h-2.5 inline" /> Sharing
                </span>
              )}
              {isMuted && <MicOff className="w-2.5 h-2.5 text-rose-400" />}
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Call Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 p-2 rounded-3xl vision-glass-dock shadow-2xl border border-white/20">
        <button
          onClick={toggleMic}
          className={`p-3 rounded-2xl transition duration-200 ${
            isMuted
              ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleCam}
          className={`p-3 rounded-2xl transition duration-200 ${
            isVideoOff
              ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={isVideoOff ? 'Enable Camera' : 'Turn Off Camera'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-2xl transition duration-200 ${
            isScreenSharing
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/40 ring-2 ring-cyan-300 scale-105'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
        >
          <Monitor className="w-5 h-5" />
        </button>

        <button
          onClick={toggleBlur}
          className={`p-3 rounded-2xl transition duration-200 ${
            isBlurEnabled
              ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40 shadow-lg shadow-purple-500/20'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={isBlurEnabled ? 'Disable Blur' : 'Enable Virtual Background Blur'}
        >
          <Sparkles className="w-5 h-5" />
        </button>

        <button
          onClick={toggleRecording}
          className={`p-3 rounded-2xl transition duration-200 ${
            isRecording
              ? 'bg-rose-600 text-white font-bold shadow-lg shadow-rose-600/50 ring-2 ring-rose-400 scale-105 animate-pulse'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={isRecording ? 'Stop & Download Recording' : 'Record Call (Audio + Video)'}
        >
          <CircleDot className="w-5 h-5" />
        </button>

        <button
          onClick={() => (isGroupCall ? leaveGroupCall() : endCall(true))}
          className="p-3 px-5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-bold shadow-lg shadow-rose-600/40 hover:scale-105 transition active:scale-95"
          title="End Call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
