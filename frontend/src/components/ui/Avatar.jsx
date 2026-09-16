import React, { useState, useEffect, useMemo } from 'react';
import { optimizeAvatarUrl } from '../../utils/imageOptimizer';

// Global cache of successfully loaded avatar image URLs to prevent re-flickering
const avatarLoadedCache = new Set();

const SIZE_MAP = {
  xs: { box: 'w-6 h-6 text-[10px]', dot: 'w-2 h-2 -bottom-0.5 -right-0.5', px: 48 },
  sm: { box: 'w-8 h-8 text-xs', dot: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5', px: 64 },
  md: { box: 'w-10 h-10 text-sm', dot: 'w-3 h-3 -bottom-0.5 -right-0.5', px: 80 },
  lg: { box: 'w-12 h-12 text-base', dot: 'w-3.5 h-3.5 -bottom-1 -right-1', px: 96 },
  xl: { box: 'w-14 h-14 text-base font-bold', dot: 'w-3.5 h-3.5 -bottom-1 -right-1', px: 128 },
  '2xl': { box: 'w-16 h-16 text-lg font-bold', dot: 'w-4 h-4 -bottom-1 -right-1', px: 160 },
  '3xl': { box: 'w-24 h-24 text-2xl font-black', dot: 'w-5 h-5 -bottom-1.5 -right-1.5', px: 256 }
};

const GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-indigo-600 to-purple-600',
  'from-cyan-600 to-blue-600',
  'from-emerald-600 to-teal-600',
  'from-blue-600 to-cyan-500',
  'from-violet-600 to-pink-600'
];

export function Avatar({
  src,
  name = '',
  size = 'md',
  isOnline,
  shape = 'squircle',
  className = '',
  priority = false
}) {
  const sizeCfg = SIZE_MAP[size] || SIZE_MAP.md;

  // Automatically compress & optimize remote CDN / Unsplash / Cloudinary URLs
  const optimizedSrc = useMemo(() => {
    return optimizeAvatarUrl(src, sizeCfg.px * 2);
  }, [src, sizeCfg.px]);

  const [imgLoaded, setImgLoaded] = useState(() => Boolean(optimizedSrc && avatarLoadedCache.has(optimizedSrc)));
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!optimizedSrc) {
      setImgLoaded(false);
      setImgError(false);
      return;
    }
    if (avatarLoadedCache.has(optimizedSrc)) {
      setImgLoaded(true);
      setImgError(false);
    } else {
      setImgLoaded(false);
      setImgError(false);
    }
  }, [optimizedSrc]);

  const cleanName = (name || 'HD').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (cleanName.slice(0, 2).toUpperCase() || 'HD');

  const charCodeSum = cleanName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const gradient = GRADIENTS[charCodeSum % GRADIENTS.length];
  const roundedClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  const hasValidSrc = Boolean(
    optimizedSrc && 
    typeof optimizedSrc === 'string' && 
    optimizedSrc.trim().length > 0 && 
    !optimizedSrc.includes('instagram.com')
  );

  return (
    <div className={`relative inline-flex flex-shrink-0 select-none ${sizeCfg.box.split(' ')[0]} ${sizeCfg.box.split(' ')[1]} ${className}`}>
      {/* 1. Base Layer: Instant Initials Fallback (Never shows an empty/blank gap while downloading) */}
      <div
        className={`w-full h-full ${roundedClass} bg-gradient-to-tr ${gradient} flex items-center justify-center text-white font-display font-extrabold shadow-sm ring-2 ring-slate-200/90 dark:ring-white/10 overflow-hidden transition-transform`}
        title={name}
      >
        <span className={sizeCfg.box.split(' ')[2] || 'text-xs'}>{initials}</span>
      </div>

      {/* 2. Top Layer: Image overlays smoothly; if cached, renders instantly with zero delay */}
      {hasValidSrc && !imgError && (
        <img
          src={optimizedSrc}
          alt={name || 'User'}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchpriority={priority ? 'high' : undefined}
          referrerPolicy="no-referrer"
          onLoad={() => {
            avatarLoadedCache.add(optimizedSrc);
            setImgLoaded(true);
          }}
          onError={() => setImgError(true)}
          className={`absolute inset-0 w-full h-full object-cover ${roundedClass} ring-2 ring-slate-200/90 dark:ring-white/10 shadow-sm transition-opacity duration-300 ease-out ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* 3. Online/Offline Status Indicator */}
      {isOnline !== undefined && (
        <span
          className={`absolute z-10 ${sizeCfg.dot} rounded-full ring-2 ring-white dark:ring-[#0d121f] transition-colors ${
            isOnline ? 'bg-emerald-500 ring-emerald-200 dark:ring-emerald-950' : 'bg-slate-300 dark:bg-slate-600'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}

export default Avatar;

