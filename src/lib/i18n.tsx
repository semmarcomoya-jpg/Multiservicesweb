import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'es' | 'en';

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Texto en el idioma actual: L('Hola', 'Hello') */
  L: (es: string, en: string) => string;
  /** Nombre de un objeto con campos es/en */
  nm: (o: { es?: string; en?: string } | null | undefined) => string;
}

const Ctx = createContext<LangCtx | null>(null);
const KEY = 'castillo.lang';

export function LangProvider({ children }: { children: React.ReactNode }) {
  // Español por defecto; se recuerda el idioma que la persona elija en el encabezado
  const [lang, setLangState] = useState<Lang>('es');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'es' || v === 'en') setLangState(v);
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  const value = useMemo<LangCtx>(
    () => ({
      lang,
      setLang,
      L: (es, en) => (lang === 'es' ? es : en),
      nm: (o) => (o ? (lang === 'es' ? o.es : o.en) || o.es || o.en || '' : ''),
    }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLang fuera de LangProvider');
  return c;
}
