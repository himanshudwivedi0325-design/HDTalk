// Standalone Web Audio API Synthesizer for 100% Reliable Sound Effects

class SoundService {
  constructor() {
    this.audioCtx = null;
    this.ringInterval = null;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // 1. Loud Incoming Call Ringtone (High-audibility smartphone chime + vibration)
  playIncomingRing() {
    this.stopRing();
    const ctx = this.getAudioContext();

    const triggerVibrate = () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([600, 250, 600, 250, 1000]);
        }
      } catch (_) {}
    };

    const playIncomingMelody = () => {
      triggerVibrate();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;

        // High-energy melodic telephone chime (E5 -> G#5 -> B5 -> E6)
        const notes = [
          { freq: 659.25, time: 0.0, dur: 0.12, vol: 0.35 },
          { freq: 830.61, time: 0.12, dur: 0.12, vol: 0.38 },
          { freq: 987.77, time: 0.24, dur: 0.14, vol: 0.42 },
          { freq: 1318.51, time: 0.38, dur: 0.55, vol: 0.45 },
          // Second trill
          { freq: 659.25, time: 0.95, dur: 0.12, vol: 0.35 },
          { freq: 830.61, time: 1.07, dur: 0.12, vol: 0.38 },
          { freq: 987.77, time: 1.19, dur: 0.14, vol: 0.42 },
          { freq: 1318.51, time: 1.33, dur: 0.65, vol: 0.48 }
        ];

        notes.forEach(({ freq, time, dur, vol }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + time);

          gain.gain.setValueAtTime(0, now + time);
          gain.gain.linearRampToValueAtTime(vol, now + time + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + time);
          osc.stop(now + time + dur + 0.05);
        });
      } catch (e) {
        console.warn('Incoming ringtone playback note:', e);
      }
    };

    playIncomingMelody();
    this.ringInterval = setInterval(playIncomingMelody, 2600);
  }

  // 2. Outgoing Call Radar Pulse
  playOutgoingRing() {
    this.stopRing();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const playOutgoingPulse = () => {
      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.18, now + 0.08);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.85);
      } catch (e) {}
    };

    playOutgoingPulse();
    this.ringInterval = setInterval(playOutgoingPulse, 2400);
  }

  // Default alias
  playRing() {
    this.playIncomingRing();
  }

  stopRing() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(0);
      }
    } catch (_) {}
  }

  // Crisp Message Notification Pop
  playMessageReceived() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }

  // Sent message chirp
  playMessageSent() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {}
  }

  // Call Ended tone
  playCallEnded() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.25);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch (e) {}
  }
}

export const soundService = new SoundService();
