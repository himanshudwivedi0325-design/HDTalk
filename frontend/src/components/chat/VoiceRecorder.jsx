import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, Trash2 } from 'lucide-react';

export function VoiceRecorder({ onAudioReady, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    startRecording();
    return () => {
      stopRecordingCleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting voice recording:', err);
      onCancel();
    }
  };

  const stopRecordingCleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleFinish = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      onAudioReady(audioBlob);
    };
    stopRecordingCleanup();
  };

  const handleCancel = () => {
    stopRecordingCleanup();
    onCancel();
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-xs animate-in fade-in transition-colors duration-200">
      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
        <Mic className="w-4 h-4 text-rose-600 dark:text-rose-400" />
        <span>Recording {formatTime(recordTime)}</span>
      </div>

      {/* Simulated Live Audio Bars */}
      <div className="flex items-center gap-0.5 h-4">
        {[40, 70, 30, 90, 60, 80, 45, 95, 65, 35].map((h, i) => (
          <span
            key={i}
            className="w-1 bg-rose-500 dark:bg-rose-400/80 rounded-full animate-pulse"
            style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }}
          ></span>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={handleCancel}
          className="p-1.5 rounded-xl bg-white dark:bg-white/5 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-transparent transition"
          title="Cancel Recording"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          onClick={handleFinish}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-600/30 hover:scale-105 transition"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}
