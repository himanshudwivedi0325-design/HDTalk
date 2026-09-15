import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { X, Save, User, Globe, Sparkles, Upload, Camera, Trash2, Loader2, Check } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

export function UserProfileModal({ isOpen, onClose }) {
  const { user, updateProfile } = useAuth();

  const [formData, setFormData] = useState({
    name: user?.name || '',
    avatar: user?.avatar || '',
    bio: user?.bio || '',
    profession: user?.profession || 'Full Stack Developer',
    interests: (user?.interests || []).join(', ')
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WEBP, etc.).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image size must be less than 10MB.');
      return;
    }

    setUploadError('');
    setUploading(true);
    setUploadSuccess(false);

    try {
      const res = await api.uploadAvatar(file);
      if (res && res.success && res.avatar) {
        setFormData(prev => ({ ...prev, avatar: res.avatar }));
        await updateProfile({ avatar: res.avatar });
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
      }
    } catch (err) {
      setUploadError(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async () => {
    setFormData(prev => ({ ...prev, avatar: '' }));
    setUploadError('');
    setUploadSuccess(false);
    try {
      await updateProfile({ avatar: '' });
    } catch (err) {
      console.warn(err);
    }
  };

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        ...formData,
        interests: formData.interests.split(',').map(s => s.trim()).filter(Boolean)
      });
      onClose();
    } catch (err) {
      console.warn(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-4 animate-in fade-in select-none transition-colors duration-200">
      <div className="bg-white dark:bg-[#0c1220] max-w-lg w-full rounded-3xl p-6 shadow-2xl border border-slate-200/90 dark:border-white/20 relative max-h-[90vh] overflow-y-auto transition-colors duration-200">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-purple-500/20 text-blue-600 dark:text-purple-300">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Your Profile Settings</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manage your professional profile & preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Avatar & Manual Device Upload Section */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {/* Clickable Avatar with Camera Overlay */}
            <div 
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="relative group cursor-pointer flex-shrink-0"
              title="Click to choose a photo from your computer"
            >
              <Avatar
                src={formData.avatar}
                name={formData.name || user.name}
                size="3xl"
                className="group-hover:opacity-85 transition ring-2 ring-blue-500/40"
              />
              <div className="absolute inset-0 rounded-2xl bg-black/45 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-150">
                <Camera className="w-5 h-5 mb-0.5 text-cyan-300" />
                <span className="text-[9px] font-bold">Change DP</span>
              </div>
              {uploading && (
                <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center text-white">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              )}
            </div>

            {/* Upload Buttons & Options */}
            <div className="flex-1 min-w-0 w-full">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                  Profile Picture (DP)
                </span>
                {formData.avatar && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={uploading}
                    className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 font-medium transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>

              {/* Hidden Native File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                className="hidden"
              />

              {/* Actions Row */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm shadow-blue-500/20 active:scale-95 transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading...' : 'Upload from Device'}</span>
                </button>

                {uploadSuccess && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold animate-in fade-in">
                    <Check className="w-3.5 h-3.5" />
                    <span>DP Updated!</span>
                  </span>
                )}
              </div>

              {uploadError && (
                <p className="text-[11px] text-rose-500 font-medium mb-1.5">{uploadError}</p>
              )}

              {/* Or paste custom URL */}
              <div className="pt-2 border-t border-slate-200/70 dark:border-white/10">
                <input
                  type="text"
                  value={formData.avatar}
                  onChange={(e) => setFormData(prev => ({ ...prev, avatar: e.target.value }))}
                  placeholder="Or paste an image URL (https://...)"
                  className="w-full px-3 py-1.5 rounded-xl vision-glass-input text-[11px] text-slate-900 dark:text-white focus:outline-none placeholder-slate-400"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {formData.avatar ? 'Custom DP photo is currently active.' : 'No photo uploaded: your stylish initials badge is active.'}
                </p>
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Display Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl vision-glass-input text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Profession / Role */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Profession / Role</label>
            <input
              type="text"
              required
              value={formData.profession}
              onChange={(e) => setFormData(prev => ({ ...prev, profession: e.target.value }))}
              placeholder="e.g. Full Stack Architect, UI/UX Designer, AI Engineer"
              className="w-full px-3 py-2 rounded-xl vision-glass-input text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">About / Bio</label>
            <textarea
              rows="2"
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl vision-glass-input text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Interests */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Interests & Skills (comma separated)</label>
            <input
              type="text"
              value={formData.interests}
              onChange={(e) => setFormData(prev => ({ ...prev, interests: e.target.value }))}
              placeholder="WebRTC, React, System Design, Cloud Architecture"
              className="w-full px-3 py-2 rounded-xl vision-glass-input text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* About HDTalk & Creator Info */}
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 text-xs flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="text-blue-600 dark:text-blue-400 font-black">HDTalk</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-600 dark:text-cyan-300 font-bold border border-blue-400/30">PRO</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Real-Time Messaging & HD WebRTC Calling</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Created by</span>
              <div className="text-xs font-bold text-blue-600 dark:text-cyan-300">Himanshu Dwivedi</div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl apphitect-btn-primary text-white font-semibold shadow-md shadow-blue-600/30 hover:scale-105 transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
