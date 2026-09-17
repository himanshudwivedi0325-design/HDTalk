import React from 'react';

export function HDTalkLogo({ 
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  showText = true, 
  showCreator = false,
  className = '' 
}) {
  const sizeMap = {
    sm: { icon: 'w-7 h-7', width: 28, height: 28, text: 'text-base', creator: 'text-[9px]' },
    md: { icon: 'w-9 h-9', width: 36, height: 36, text: 'text-lg', creator: 'text-[10px]' },
    lg: { icon: 'w-12 h-12', width: 48, height: 48, text: 'text-2xl', creator: 'text-xs' },
    xl: { icon: 'w-16 h-16', width: 64, height: 64, text: 'text-3xl', creator: 'text-xs' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Exact Vector Speech Bubble HD Logo with explicit bounding box constraints */}
      <div 
        className={`relative ${currentSize.icon} flex-shrink-0 transition-transform duration-200 hover:scale-105`}
        style={{
          width: `${currentSize.width}px`,
          height: `${currentSize.height}px`,
          minWidth: `${currentSize.width}px`,
          minHeight: `${currentSize.height}px`,
          maxWidth: `${currentSize.width}px`,
          maxHeight: `${currentSize.height}px`,
        }}
      >
        <svg
          viewBox="0 0 100 90"
          width={currentSize.width}
          height={currentSize.height}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* Main Rounded Blue Speech Bubble Body with Tail */}
          <path
            d="M 28 6 C 12 6 2 16 2 32 C 2 48 12 58 28 58 L 65 58 L 82 76 L 82 54 C 92 48 98 40 98 32 C 98 16 88 6 72 6 Z"
            fill="url(#hdtalk-gradient)"
            className="filter drop-shadow-[0_4px_12px_rgba(0,102,255,0.4)]"
          />
          {/* White 'HD' Lettering */}
          <text
            x="48"
            y="42"
            fill="#FFFFFF"
            fontSize="36"
            fontWeight="900"
            fontFamily="'Outfit', system-ui, -apple-system, sans-serif"
            textAnchor="middle"
            letterSpacing="-1.5"
          >
            HD
          </text>
          <defs>
            <linearGradient id="hdtalk-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0077FF" />
              <stop offset="100%" stopColor="#0055EE" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Brand Text & Creator Info */}
      {showText && (
        <div className="flex flex-col">
          <div className={`font-display font-extrabold tracking-tight leading-none ${currentSize.text} flex items-center`}>
            <span className="text-[#0066FF] font-black drop-shadow-[0_0_12px_rgba(0,102,255,0.4)]">HD</span>
            <span className="text-slate-900 dark:text-white font-medium ml-0.5">Talk</span>
            <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-600 dark:text-cyan-300 border border-blue-500/30 uppercase tracking-wider">
              PRO
            </span>
          </div>

          {showCreator && (
            <span className={`text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center gap-1 ${currentSize.creator}`}>
              <span>Created by</span>
              <a
                href="https://himanshuportfolio.site.je/"
                target="_blank"
                rel="noopener noreferrer author"
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Himanshu Dwivedi
              </a>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function CreatorBadge({ className = '' }) {
  return (
    <a
      href="https://himanshuportfolio.site.je/"
      target="_blank"
      rel="noopener noreferrer author"
      title="Visit Developer Portfolio - Himanshu Dwivedi"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 text-slate-600 dark:text-slate-300 text-[11px] font-medium backdrop-blur-md whitespace-nowrap flex-shrink-0 hover:border-blue-500/40 hover:text-blue-600 dark:hover:text-cyan-300 transition-all shadow-xs group cursor-pointer ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-cyan-400 group-hover:scale-125 transition-transform"></span>
      <span className="text-slate-400 dark:text-slate-400">by</span>
      <span className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-cyan-300 tracking-tight">Himanshu Dwivedi</span>
    </a>
  );
}
