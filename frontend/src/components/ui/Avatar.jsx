import React, { useState, useEffect } from 'react';

const SIZE_MAP = {
  xs: { box: 'w-6 h-6 text-[10px]', dot: 'w-2 h-2 -bottom-0.5 -right-0.5' },
  sm: { box: 'w-8 h-8 text-xs', dot: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5' },
  md: { box: 'w-10 h-10 text-sm', dot: 'w-3 h-3 -bottom-0.5 -right-0.5' },
  lg: { box: 'w-12 h-12 text-base', dot: 'w-3.5 h-3.5 -bottom-1 -right-1' },
  xl: { box: 'w-14 h-14 text-base font-bold', dot: 'w-3.5 h-3.5 -bottom-1 -right-1' },
  '2xl': { box: 'w-16 h-16 text-lg font-bold', dot: 'w-4 h-4 -bottom-1 -right-1' },
  '3xl': { box: 'w-24 h-24 text-2xl font-black', dot: 'w-5 h-5 -bottom-1.5 -right-1.5' }
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
  className = ''
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const cleanName = (name || 'HD').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (cleanName.slice(0, 2).toUpperCase() || 'HD');

  const charCodeSum = cleanName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const gradient = GRADIENTS[charCodeSum % GRADIENTS.length];

  const sizeCfg = SIZE_MAP[size] || SIZE_MAP.md;
  const roundedClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  const hasValidSrc = Boolean(src && typeof src === 'string' && src.trim().length > 0 && !src.includes('instagram.com'));

  return (
    <div className={`relative inline-flex flex-shrink-0 ${sizeCfg.box.split(' ')[0]} ${sizeCfg.box.split(' ')[1]} ${className}`}>
      {hasValidSrc && !imgError ? (
        <img
          src={src}
          alt={name || 'User'}
          onError={() => setImgError(true)}
          className={`w-full h-full object-cover ${roundedClass} ring-2 ring-slate-200/90 dark:ring-white/10 shadow-sm transition-all`}
        />
      ) : (
        <div
          className={`w-full h-full ${roundedClass} bg-gradient-to-tr ${gradient} flex items-center justify-center text-white font-display font-extrabold select-none shadow-sm ring-2 ring-slate-200/90 dark:ring-white/10 transition-transform`}
          title={name}
        >
          {initials}
        </div>
      )}

      {isOnline !== undefined && (
        <span
          className={`absolute ${sizeCfg.dot} rounded-full ring-2 ring-white dark:ring-[#0d121f] transition-colors ${
            isOnline ? 'bg-emerald-500 ring-emerald-200 dark:ring-emerald-950' : 'bg-slate-300 dark:bg-slate-600'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}

export default Avatar;
