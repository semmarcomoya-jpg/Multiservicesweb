/** Marca y apariencia que el administrador configura (logo, portada, fondos). */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { supabase } from './supabase';
import type { Brand } from './types';

export const DEFAULT_BRAND: Brand = {
  nombre: 'Castillo Multiservices',
  corto: 'Castillo',
  cover_title_es: 'Tu familia, más cerca',
  cover_title_en: 'Your family, closer',
  cover_sub_es: 'Envía dinero a México, compra tu celular y paga tus servicios. Y gana puntos en cada movimiento.',
  cover_sub_en: 'Send money to Mexico, buy your phone and pay your bills. And earn points with every move.',
};

const Ctx = createContext<{ brand: Brand; reload: () => Promise<void> }>({ brand: DEFAULT_BRAND, reload: async () => {} });

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);
  const reload = useCallback(async () => {
    const { data } = await supabase.from('settings').select('brand').eq('id', 1).maybeSingle();
    if (data?.brand) setBrand({ ...DEFAULT_BRAND, ...(data.brand as Brand) });
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return <Ctx.Provider value={{ brand, reload }}>{children}</Ctx.Provider>;
}

export const useBranding = () => useContext(Ctx);
