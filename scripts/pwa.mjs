// Después de `expo export --platform web`: agrega el manifiesto y los íconos para poder instalar la app.
import fs from 'node:fs';
import path from 'node:path';

const base = (process.env.EXPO_BASE_URL || '').replace(/\/$/, '');
const dist = path.resolve('dist');
const manifest = {
  name: 'Castillo Multiservices',
  short_name: 'Castillo',
  description: 'Envíos a México, pago de servicios y tienda. En español e inglés.',
  lang: 'es',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#EAF2FB',
  theme_color: '#1656A8',
  icons: [
    { src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png' },
    { src: `${base}/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));

const tags = [
  `<link rel="manifest" href="${base}/manifest.json">`,
  `<meta name="theme-color" content="#1656A8">`,
  `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`,
  `<meta name="apple-mobile-web-app-capable" content="yes">`,
  `<meta name="mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-title" content="Castillo">`,
  `<meta name="apple-mobile-web-app-status-bar-style" content="default">`,
  // La app tiene sus propios colores: le pedimos al celular que NO la oscurezca solo (modo nocturno)
  `<meta name="color-scheme" content="only light">`,
  `<style>:root{color-scheme:only light}html,body{background:#EAF2FB;color-scheme:only light}input,select,textarea{color-scheme:only light}</style>`,
].join('\n    ');
for (const f of ['index.html', '404.html']) {
  const p = path.join(dist, f);
  if (!fs.existsSync(p)) continue;
  let html = fs.readFileSync(p, 'utf8');
  if (!html.includes('rel="manifest"')) html = html.replace('</head>', `    ${tags}\n  </head>`);
  html = html.replace(/<title>[^<]*<\/title>/, '<title>Castillo Multiservices</title>').replace('<html lang="en">', '<html lang="es">');
  fs.writeFileSync(p, html);
}
console.log('PWA listo', base || '/');
