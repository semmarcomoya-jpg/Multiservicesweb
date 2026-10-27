/**
 * Historias (igual que en Viva): reglas, lo que ya vio este teléfono y la
 * lista compartida entre Inicio y el visor.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { supabase } from './supabase';
import type { Story } from './types';

// ---------- Reglas
export type StoryStatus = 'scheduled' | 'active' | 'featured' | 'expired';
export type StoryDuration = '24h' | '3d' | '7d' | 'featured';
const HOURS: Record<Exclude<StoryDuration, 'featured'>, number> = { '24h': 24, '3d': 72, '7d': 168 };

/** Cuánto dura en pantalla una foto. Los videos duran lo que dura el video. */
export const IMAGE_STORY_MS = 5_000;
/** El bucket admite 50 MB por archivo. */
export const MAX_STORY_BYTES = 50 * 1024 * 1024;

export function storyStatus(s: { starts_at: string; expires_at: string | null }, now = new Date()): StoryStatus {
  const t = now.getTime();
  if (Date.parse(s.starts_at) > t) return 'scheduled';
  if (s.expires_at === null) return 'featured';
  return Date.parse(s.expires_at) > t ? 'active' : 'expired';
}
export function expiresFor(d: StoryDuration, from = new Date()): string | null {
  return d === 'featured' ? null : new Date(from.getTime() + HOURS[d] * 3_600_000).toISOString();
}
export function hoursLeft(s: { expires_at: string | null }, now = new Date()): number | null {
  if (s.expires_at === null) return null;
  return Math.max(0, Math.ceil((Date.parse(s.expires_at) - now.getTime()) / 3_600_000));
}
/** Primero lo no visto; dentro de cada grupo, el orden que decidió la tienda. */
export function orderForViewer<T extends { id: string; sort_order: number }>(list: readonly T[], seen: ReadonlySet<string>): T[] {
  return list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      const d = (seen.has(a.s.id) ? 1 : 0) - (seen.has(b.s.id) ? 1 : 0);
      if (d) return d;
      if (a.s.sort_order !== b.s.sort_order) return a.s.sort_order - b.s.sort_order;
      return a.i - b.i;
    })
    .map((x) => x.s);
}
export function mediaTypeOf(mime: string): 'image' | 'video' | null {
  if (/^image\/(jpeg|png|webp)$/.test(mime)) return 'image';
  if (/^video\/(mp4|webm|quicktime)$/.test(mime)) return 'video';
  return null;
}

// ---------- Lo que ya vio este teléfono (para el aro de color)
const KEY = 'castillo.stories.seen.v1';
let seen: string[] | null = null;
const listeners = new Set<(ids: ReadonlySet<string>) => void>();
async function loadSeen(): Promise<string[]> {
  if (seen !== null) return seen;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    seen = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    seen = [];
  }
  return seen;
}
export function markStorySeen(id: string) {
  void loadSeen().then((cur) => {
    if (cur.includes(id)) return;
    seen = [...cur, id].slice(-200);
    AsyncStorage.setItem(KEY, JSON.stringify(seen)).catch(() => {});
    const snap = new Set(seen);
    listeners.forEach((fn) => fn(snap));
  });
}
export function useSeenStories(): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set(seen ?? []));
  useEffect(() => {
    let alive = true;
    void loadSeen().then((cur) => alive && setIds(new Set(cur)));
    listeners.add(setIds);
    return () => {
      alive = false;
      listeners.delete(setIds);
    };
  }, []);
  return ids;
}

// ---------- Lista compartida y "se abren solas" una vez por visita
let cached: Story[] | null = null;
export const cachedStories = () => cached;

export async function fetchStories(): Promise<Story[]> {
  const { data, error } = await supabase.from('stories').select('*').order('sort_order').order('created_at', { ascending: false });
  if (error) return [];
  cached = (data as Story[]) ?? [];
  return cached;
}

let autoOpened = false;
export const autoOpenDecided = () => autoOpened;
/** Con qué historia abrir el visor solo al entrar: la primera nueva o, si ya vio todas, la primera. Una vez por visita. */
export async function takeAutoOpen(list: readonly Story[]): Promise<string | null> {
  if (autoOpened) return null;
  autoOpened = true;
  if (!list.length) return null;
  const s = new Set(await loadSeen());
  const ordered = orderForViewer(list, s);
  return (ordered.find((x) => !s.has(x.id)) || ordered[0]).id;
}

export async function countView(id: string) {
  await supabase.rpc('story_view', { p_story: id });
}
