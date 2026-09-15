import React, { createContext, useContext, useState, useEffect } from 'react';

const PwaContext = createContext(null);

export function PwaProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // Platform detection
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isAndroid = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);
  const isDesktop = !isIOS && !isAndroid;

  useEffect(() => {
    // 1. Check if already running in standalone PWA window
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      
      setIsInstalled(Boolean(isStandaloneMode));
    };

    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e) => {
      if (e.matches) {
        setIsInstalled(true);
        setCanInstall(false);
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    }

    // 2. Intercept Chromium / Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      // Prevent browser's default mini-infobar on mobile
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
      console.log('[PWA] beforeinstallprompt event captured.');
    };

    // 3. Listen to appinstalled event
    const handleAppInstalled = () => {
      console.log('[PWA] HDTalk application installed successfully!');
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
      setJustInstalled(true);
      setTimeout(() => setJustInstalled(false), 6000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  /**
   * Primary Action: Trigger native prompt or launch helpful installation walkthrough
   */
  const installApp = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        console.log('[PWA] User choice outcome:', choiceResult.outcome);
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
          setCanInstall(false);
          setIsInstalled(true);
        }
      } catch (err) {
        console.warn('[PWA] Prompt error:', err);
        setShowInstallModal(true);
      }
    } else {
      // If prompt isn't directly triggerable (iOS, Safari, already dismissed, or desktop), show step-by-step modal
      setShowInstallModal(true);
    }
  };

  return (
    <PwaContext.Provider
      value={{
        canInstall,
        isInstalled,
        installApp,
        showInstallModal,
        setShowInstallModal,
        isIOS,
        isAndroid,
        isDesktop,
        justInstalled,
        hasPrompt: Boolean(deferredPrompt)
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
}
