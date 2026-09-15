/**
 * ChatZ Ultra - In-Call Media Recorder Service
 * Records mixed audio (local mic + remote audio) and active video stream into WebM format.
 */
class CallRecorderService {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.startTime = null;
    this.audioContext = null;
    this.onStateChange = null;
  }

  startRecording(localStream, remoteStream) {
    if (this.isRecording) return false;

    try {
      const tracks = [];

      // 1. Choose the primary video track (prefer remote stream, or fallback to local)
      const remoteVideoTrack = remoteStream?.getVideoTracks()?.[0];
      const localVideoTrack = localStream?.getVideoTracks()?.[0];
      const activeVideoTrack = remoteVideoTrack || localVideoTrack;

      if (activeVideoTrack) {
        tracks.push(activeVideoTrack);
      }

      // 2. Mix local and remote audio using Web Audio API
      const localAudioTrack = localStream?.getAudioTracks()?.[0];
      const remoteAudioTrack = remoteStream?.getAudioTracks()?.[0];

      let mixedAudioTrack = null;

      if (localAudioTrack || remoteAudioTrack) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
          const destination = this.audioContext.createMediaStreamDestination();

          if (localAudioTrack) {
            const localSource = this.audioContext.createMediaStreamSource(new MediaStream([localAudioTrack]));
            localSource.connect(destination);
          }

          if (remoteAudioTrack) {
            const remoteSource = this.audioContext.createMediaStreamSource(new MediaStream([remoteAudioTrack]));
            remoteSource.connect(destination);
          }

          mixedAudioTrack = destination.stream.getAudioTracks()[0];
          if (mixedAudioTrack) {
            tracks.push(mixedAudioTrack);
          }
        }
      }

      if (tracks.length === 0) {
        throw new Error('No audio or video streams available to record.');
      }

      const combinedStream = new MediaStream(tracks);

      // Determine best supported MIME type
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(combinedStream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.downloadRecording();
        this.cleanup();
      };

      this.mediaRecorder.start(1000); // chunk every second
      this.isRecording = true;
      this.startTime = Date.now();

      if (this.onStateChange) this.onStateChange(true);
      return true;
    } catch (err) {
      console.error('[CallRecorder] Failed to start recording:', err);
      this.cleanup();
      throw err;
    }
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;
    try {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } catch (e) {
      console.warn('[CallRecorder] Error stopping MediaRecorder:', e);
    }
    this.isRecording = false;
    if (this.onStateChange) this.onStateChange(false);
  }

  downloadRecording() {
    if (this.recordedChunks.length === 0) {
      console.warn('[CallRecorder] No data chunks collected for download.');
      return;
    }

    try {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = ChatZ_Call_Recording_.webm;

      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);

      console.log('[CallRecorder] Recording downloaded:', filename);
    } catch (err) {
      console.error('[CallRecorder] Error downloading recording:', err);
    }
  }

  cleanup() {
    this.isRecording = false;
    this.recordedChunks = [];
    this.mediaRecorder = null;
    this.startTime = null;
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}

export const callRecorderService = new CallRecorderService();
