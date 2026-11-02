/** Ilustraciones por servicio (las mismas de la maqueta v2) y el fondo de dibujos. */
import React from 'react';
import { SvgXml } from 'react-native-svg';

const NV = '#0B2E5E', BR = '#1656A8', SK = '#62BDF6', GR = '#2FA36B', GO = '#E8A317', KR = '#C98B4A';
const sh = '<ellipse cx="32" cy="57" rx="20" ry="3" fill="#0B2E5E" opacity=".1"/>';
const M = (x: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${sh}${x}</svg>`;

export const SCENES = {
  envio: M(`<rect x="6" y="28" width="38" height="22" rx="4" fill="${GR}"/><circle cx="25" cy="39" r="6" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M25 35v8" stroke="#fff" stroke-width="2"/><path d="M58 8L30 22l9 4 4 9z" fill="${BR}"/><path d="M39 26l19-18" stroke="${NV}" stroke-width="2"/><path d="M30 22l9 4-4 6" fill="${SK}"/>`),
  luz: M(`<path d="M26 8a14 14 0 0 0-8 25c2 2 3 4 3 7h14c0-3 1-5 3-7a14 14 0 0 0-12-25z" fill="#FFD25C"/><path d="M30 18l-6 10h6l-3 9 8-12h-6l3-7z" fill="${GO}"/><rect x="21" y="42" width="14" height="5" rx="2" fill="${NV}"/><rect x="23" y="48" width="10" height="4" rx="2" fill="${NV}" opacity=".7"/><path d="M44 22h12v28l-3-2-3 2-3-2-3 2z" fill="#fff" stroke="${BR}" stroke-opacity=".4" stroke-width="1.6"/><path d="M47 30h6M47 36h6" stroke="${BR}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`),
  recarga: M(`<rect x="16" y="6" width="26" height="46" rx="6" fill="${NV}"/><rect x="19" y="11" width="20" height="32" rx="3" fill="${SK}"/><path d="M29 20v14M22 27h14" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><circle cx="48" cy="16" r="9" fill="${GO}"/><path d="M48 11v10M45.5 13.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 1.7-2.5 2-2.5.8-2.5 2 1.1 2 2.5 2 2.5-.8 2.5-2" fill="none" stroke="#3B2600" stroke-width="1.4"/>`),
  celular: M(`<rect x="10" y="10" width="22" height="40" rx="5" fill="${BR}"/><rect x="13" y="14" width="16" height="28" rx="2" fill="#BFE3FF"/><rect x="30" y="6" width="24" height="46" rx="5" fill="${NV}"/><rect x="33" y="10" width="18" height="34" rx="2" fill="${SK}"/><circle cx="42" cy="48" r="1.6" fill="#fff"/><path d="M36 20h12M36 26h8" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`),
  paquete: M(`<path d="M8 22l24-12 24 12v22L32 56 8 44z" fill="${KR}"/><path d="M8 22l24 12 24-12" fill="none" stroke="#9C6532" stroke-width="2"/><path d="M32 34v22" stroke="#9C6532" stroke-width="2"/><path d="M20 16l24 12v8" fill="none" stroke="#F0D2A8" stroke-width="4"/>`),
  tramite: M(`<rect x="12" y="8" width="30" height="42" rx="4" fill="#fff" stroke="${BR}" stroke-opacity=".4" stroke-width="2"/><path d="M18 18h18M18 25h18M18 32h12" stroke="${BR}" stroke-width="2.4" stroke-linecap="round" opacity=".5"/><circle cx="44" cy="42" r="11" fill="#B23A2A" opacity=".9"/><circle cx="44" cy="42" r="7" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M40 42l3 3 5-6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`),
  credito: M(`<rect x="8" y="12" width="36" height="34" rx="5" fill="#fff" stroke="${BR}" stroke-opacity=".35" stroke-width="2"/><rect x="8" y="12" width="36" height="10" rx="5" fill="${BR}"/><rect x="8" y="18" width="36" height="4" fill="${BR}"/>${[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => `<rect x="${13 + c * 7.5}" y="${26 + r * 6}" width="5" height="4" rx="1" fill="${r === 1 && c === 2 ? GR : '#D9E5F3'}"/>`).join('')).join('')}<circle cx="48" cy="44" r="10" fill="${GO}"/><circle cx="48" cy="44" r="6" fill="none" stroke="#B57E05" stroke-width="1.6"/>`),
  puntos: M(`<rect x="12" y="26" width="40" height="26" rx="4" fill="${BR}"/><rect x="8" y="18" width="48" height="10" rx="3" fill="${SK}"/><rect x="29" y="18" width="6" height="34" fill="${GO}"/><path d="M32 18c-4-8-14-8-12-2 1 3 7 2 12 2zM32 18c4-8 14-8 12-2-1 3-7 2-12 2z" fill="${GO}"/>`),
  ok: M(`<rect x="10" y="10" width="34" height="42" rx="6" fill="#fff" stroke="${BR}" stroke-opacity=".3" stroke-width="2"/><path d="M17 22h20M17 29h20M17 36h12" stroke="${BR}" stroke-width="2.4" stroke-linecap="round" opacity=".45"/><circle cx="46" cy="42" r="12" fill="${GR}"/><path d="M40 42l4 4 8-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`),
  funda: M(`<rect x="18" y="6" width="28" height="48" rx="8" fill="${SK}"/><rect x="22" y="10" width="20" height="40" rx="5" fill="${NV}" opacity=".85"/><circle cx="28" cy="16" r="3" fill="#fff" opacity=".7"/>`),
  fiesta: M(`<path d="M10 54l12-36 24 24z" fill="${GO}"/><path d="M14 42l6 6M18 30l14 14" stroke="#fff" stroke-width="3" opacity=".7"/><circle cx="44" cy="12" r="3" fill="${BR}"/><circle cx="54" cy="24" r="3" fill="#E2503A"/><circle cx="36" cy="8" r="2" fill="${GR}"/><path d="M48 16l6-6M40 20l2-8M50 30l8-2" stroke="${SK}" stroke-width="2.4" stroke-linecap="round"/>`),
  calendario: M(`<rect x="8" y="12" width="48" height="40" rx="6" fill="#fff" stroke="${BR}" stroke-opacity=".35" stroke-width="2"/><rect x="8" y="12" width="48" height="12" rx="6" fill="#E2503A"/><rect x="8" y="18" width="48" height="6" fill="#E2503A"/><rect x="18" y="6" width="4" height="12" rx="2" fill="${NV}"/><rect x="42" y="6" width="4" height="12" rx="2" fill="${NV}"/><path d="M32 30l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z" fill="${GO}"/>`),
} as const;
export type SceneName = keyof typeof SCENES;

/** Escoge la ilustración de un servicio por su ícono o categoría */
export function sceneFor(icon?: string | null, cat?: string | null): SceneName {
  const k = `${icon || ''} ${cat || ''}`;
  if (/send|envi/.test(k)) return 'envio';
  if (/bolt|drop|luz|agua|pag/.test(k)) return 'luz';
  if (/phone|sim|rec/.test(k)) return 'recarga';
  if (/box|paq/.test(k)) return 'paquete';
  if (/doc|tra|id/.test(k)) return 'tramite';
  if (/tool|tec/.test(k)) return 'celular';
  return 'tramite';
}

export function Scene({ n, size }: { n: SceneName; size?: number }) {
  return <SvgXml xml={SCENES[n]} width={size ?? '100%'} height={size ?? '100%'} />;
}

/** Fondo de dibujos (como WhatsApp) con objetos de Castillo, como imagen para la web */
const DOODLE_PATHS = ['M21 3L10 14M21 3l-7 18-4-7-7-4 18-7', 'M7 2h10v20H7zM11 18h2', 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z', 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8', 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', 'M3 11l9-7 9 7M5 10v10h14V10', 'M4 9h16v12H4zM2 5h20v4H2zM12 5v16', 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', 'M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z', 'M4 5h16v11H8l-4 4z', 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h4'];
const SPOTS = [[10, 14, -12], [84, 8, 8], [160, 22, -6], [38, 66, 14], [118, 60, -18], [190, 86, 10], [8, 128, 6], [80, 118, -8], [150, 140, 16], [34, 182, -14], [110, 178, 4], [184, 192, -10]];
export function doodleSvg(color = '#1656A8', opacity = 0.07) {
  const g = SPOTS.map(([x, y, r], i) => `<g transform="translate(${x} ${y}) rotate(${r} 12 12)"><path d="${DOODLE_PATHS[i % DOODLE_PATHS.length]}"/></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><g fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${g}</g></svg>`;
}
export const doodleUrl = (color?: string, opacity?: number) => `url("data:image/svg+xml,${encodeURIComponent(doodleSvg(color, opacity))}")`;
