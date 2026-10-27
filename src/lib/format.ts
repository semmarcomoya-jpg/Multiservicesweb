export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const money = (v: unknown) =>
  '$' + num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const mxn = (v: unknown) =>
  '$' + num(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MXN';

export const digits = (v: string) => (v || '').replace(/\D/g, '');

export function timeAgo(iso: string, lang: 'es' | 'en'): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return lang === 'es' ? 'justo ahora' : 'just now';
  if (mins < 60) return lang === 'es' ? `hace ${mins} min` : `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return lang === 'es' ? `hace ${h} h` : `${h} h ago`;
  const d = Math.round(h / 24);
  return lang === 'es' ? `hace ${d} día${d === 1 ? '' : 's'}` : `${d} day${d === 1 ? '' : 's'} ago`;
}

export const splitList = (s: string | null | undefined) =>
  String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
