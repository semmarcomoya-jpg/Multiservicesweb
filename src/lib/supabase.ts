import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = !!url && !!anonKey;

// En web el almacenamiento por defecto (localStorage) basta; en el celular usamos AsyncStorage.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

/** Mensaje de error legible a partir de un error de Supabase. */
export function errMsg(e: unknown): string {
  if (!e) return '';
  if (typeof e === 'string') return e;
  const m = (e as { message?: string }).message;
  return m || 'Ocurrió un error. Intenta de nuevo.';
}

/**
 * Crear una cuenta nueva desde el panel SIN cerrar la sesión del administrador:
 * usamos un cliente aparte que no guarda sesión. Si en Supabase está activa la
 * confirmación por correo, la persona recibe el correo para activar su cuenta.
 */
export async function createAccount(p: { email: string; password: string; nombre: string; apellidos: string; telefono: string; idioma: 'es' | 'en' }) {
  const tmp = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'castillo-alta-temporal' },
  });
  const { data, error } = await tmp.auth.signUp({
    email: p.email,
    password: p.password,
    options: { data: { nombre: p.nombre, apellidos: p.apellidos, telefono: p.telefono, idioma: p.idioma } },
  });
  if (error) throw error;
  // Supabase no avisa si el correo ya existía: regresa un usuario sin identidades
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('Ese correo ya tiene una cuenta.');
  return { needsConfirm: !data.session };
}
