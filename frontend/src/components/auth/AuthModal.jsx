import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Sparkles, ArrowRight, Lock, Mail, User, Briefcase, Upload, Camera, Trash2, Loader2 } from 'lucide-react';
import { HDTalkLogo, CreatorBadge } from '../ui/HDTalkLogo';
import { Avatar } from '../ui/Avatar';

export function AuthModal() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('');
  const [avatar, setAvatar] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const avatarInputRef = useRef(null);

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file (PNG, JPG, etc.)');
      return;
    }
    setError('');

    // Instant local preview so user sees their DP immediately
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setAvatar(ev.target.result);
      }
    };
    reader.readAsDataURL(file);

    setUploadingAvatar(true);
    try {
      const res = await api.uploadRegistrationAvatar(file);
      if (res && (res.avatarUrl || res.fileUrl)) {
        setAvatar(res.avatarUrl || res.fileUrl);
      }
    } catch (err) {
      console.warn('Registration avatar background upload notice:', err);
      // Keep local preview intact; registration backend safely saves base64 avatar
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please provide both email and password.');
      return;
    }

    if (cleanPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const cleanName = name.trim();
        const cleanProfession = profession.trim();
        if (!cleanName) {
          setError('Please enter your full name.');
          setLoading(false);
          return;
        }
        await register({
          name: cleanName,
          email: cleanEmail,
          password: cleanPassword,
          profession: cleanProfession || 'Professional',
          avatar: avatar.trim()
        });
      } else {
        await login(cleanEmail, cleanPassword);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-[#060b17]/90 backdrop-blur-2xl p-4 select-none transition-colors duration-200">
      {/* Dynamic Background Glow Vectors */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/15 dark:bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="bg-white/95 dark:bg-[#0c1220]/95 max-w-md w-full rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-200/90 dark:border-blue-500/20 relative z-10 transition-colors duration-200">
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <HDTalkLogo size="lg" showText={true} showCreator={false} className="mb-1 justify-center" />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-Time Messaging & HD WebRTC Calling System
          </p>
          <div className="mt-2.5">
            <CreatorBadge />
          </div>
        </div>

        {/* Tab Switcher: Sign In vs Create Account */}
        <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 mb-5">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              !isRegister
                ? 'bg-white dark:bg-[#162035] text-blue-600 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              isRegister
                ? 'bg-white dark:bg-[#162035] text-blue-600 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {isRegister && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Himanshu Dwivedi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl vision-glass-input text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Profession / Role</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Software Engineer, Designer, Student..."
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl vision-glass-input text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Optional Profile Picture (DP) Upload */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-3">
                <Avatar
                  src={avatar}
                  name={name || 'New User'}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Profile Picture (DP)</span>
                    {avatar && (
                      <button
                        type="button"
                        onClick={() => setAvatar('')}
                        className="text-[10px] text-rose-500 hover:underline font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarFile}
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={() => avatarInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 text-[11px] font-semibold transition"
                  >
                    <Upload className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
                    <span>{uploadingAvatar ? 'Uploading...' : (avatar ? 'Change Photo' : 'Upload DP (Optional)')}</span>
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl vision-glass-input text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl vision-glass-input text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl apphitect-btn-primary text-white font-bold text-xs shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 hover:scale-[1.02] transition active:scale-95 mt-4"
          >
            <span>{loading ? 'Processing...' : (isRegister ? 'Create Genuine Account' : 'Sign In to HDTalk')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => { setIsRegister(prev => !prev); setError(''); }}
            className="text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-300 font-medium transition"
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
          </button>
        </div>

        {/* Creator Attribution */}
        <div className="mt-5 pt-3.5 border-t border-slate-200 dark:border-white/10 text-center">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Crafted with ❤️ by <span className="text-blue-600 dark:text-blue-400 font-bold">Himanshu Dwivedi</span>
          </p>
        </div>
      </div>
    </div>
  );
}
