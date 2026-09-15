import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export const THEMES = [
  { id: 'hdtalk', name: 'HDTalk Signature', primary: '#0066ff', secondary: '#00c8ff', desc: 'HDTalk official vibrant royal blue & oceanic midnight navy' },
  { id: 'apphitect', name: 'Apphitect Blue', primary: '#0052cc', secondary: '#00d2ff', desc: 'Apphitect flagship royal electric blue & crisp slate' },
  { id: 'vision', name: 'Vision Aurora', primary: '#8b5cf6', secondary: '#06b6d4', desc: 'Apple VisionOS frosted glass with aurora glow' },
  { id: 'midnight', name: 'Midnight Deep', primary: '#3b82f6', secondary: '#6366f1', desc: 'Ultra-dark obsidian with sapphire radiance' },
  { id: 'cyberpunk', name: 'Cyber Neon', primary: '#f43f5e', secondary: '#eab308', desc: 'High-contrast cyberpunk neon vectors' },
  { id: 'emerald', name: 'Cyber Emerald', primary: '#10b981', secondary: '#06b6d4', desc: 'Matrix green phosphor with digital teal' },
  { id: 'sunset', name: 'Sunset Bloom', primary: '#f97316', secondary: '#ec4899', desc: 'Warm dusk gradients with golden highlights' },
];

export function ThemeProvider({ children }) {
  // Brand color theme palette (e.g. 'hdtalk', 'vision', etc.)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('hdtalk_theme') || 'hdtalk';
  });

  // Appearance Mode ('light' | 'dark' | 'system')
  const [mode, setModeState] = useState(() => {
    return localStorage.getItem('hdtalk_mode') || 'dark';
  });

  // Track system dark mode preference
  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Listen for system appearance changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemIsDark(e.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, []);

  // Compute active resolved appearance ('light' or 'dark')
  const resolvedMode = mode === 'system' ? (systemIsDark ? 'dark' : 'light') : mode;

  // Apply dark class and color-scheme to html element
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedMode === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [resolvedMode]);

  // Apply palette theme class to body element
  useEffect(() => {
    THEMES.forEach(t => document.body.classList.remove(`theme-${t.id}`));
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('hdtalk_theme', theme);
  }, [theme]);

  // Save mode to localStorage
  const setMode = useCallback((newMode) => {
    setModeState(newMode);
    localStorage.setItem('hdtalk_mode', newMode);
  }, []);

  // Toggle between light and dark
  const toggleMode = useCallback(() => {
    const next = resolvedMode === 'dark' ? 'light' : 'dark';
    setMode(next);
  }, [resolvedMode, setMode]);

  const currentThemeObj = THEMES.find(t => t.id === theme) || THEMES[0];

  return (
    <ThemeContext.Provider value={{
      theme,
      themes: THEMES,
      currentThemeObj,
      setTheme,
      mode,
      setMode,
      resolvedMode,
      isDark: resolvedMode === 'dark',
      toggleMode
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
