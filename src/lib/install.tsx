import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Instalar la app desde el navegador (PWA).
 * - Android / Chrome / Edge: el navegador nos da un evento para mostrar "Instalar".
 * - iPhone (Safari): no hay botón automático; se explica "Compartir → Agregar a inicio".
 */
interface InstallCtx {
  canPrompt: boolean;
  installed: boolean;
  isIOS: boolean;
  isWeb: boolean;
  install: () => Promise<boolean>;
}

const Ctx = createContext<InstallCtx>({ canPrompt: false, installed: false, isIOS: false, isWeb: false, install: async () => false });

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function InstallProvider({ children }: { children: React.ReactNode }) {
  const isWeb = Platform.OS === 'web';
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const isIOS = isWeb && typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone) setInstalled(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // Service worker mínimo (requisito para poder instalarla)
    if ('serviceWorker' in navigator) {
      const base = (document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null)?.href.replace(/manifest\.json$/, '') || '/';
      navigator.serviceWorker.register(base + 'sw.js').catch(() => {});
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [isWeb]);

  const install = async () => {
    if (!evt) return false;
    await evt.prompt();
    const r = await evt.userChoice;
    setEvt(null);
    if (r.outcome === 'accepted') setInstalled(true);
    return r.outcome === 'accepted';
  };

  return <Ctx.Provider value={{ canPrompt: !!evt, installed, isIOS, isWeb, install }}>{children}</Ctx.Provider>;
}

export const useInstall = () => useContext(Ctx);
