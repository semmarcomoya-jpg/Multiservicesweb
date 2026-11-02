/** Historia "solo texto": se dibuja en vertical (1080×1920) y se sube como imagen. */
export const TEXT_BGS: { id: string; a: string; b: string; ink: string }[] = [
  { id: 'azul', a: '#0B2E5E', b: '#1656A8', ink: '#FFFFFF' },
  { id: 'cielo', a: '#2A8BDA', b: '#62BDF6', ink: '#FFFFFF' },
  { id: 'oro', a: '#F59E0B', b: '#FCD34D', ink: '#1F2937' },
  { id: 'rosa', a: '#BE185D', b: '#F472B6', ink: '#FFFFFF' },
  { id: 'verde', a: '#065F46', b: '#10B981', ink: '#FFFFFF' },
  { id: 'noche', a: '#111827', b: '#374151', ink: '#FFFFFF' },
];

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > max && line) {
        out.push(line);
        line = w;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** Regresa un PNG (blob) listo para subir o compartir. */
export async function renderTextStory(text: string, bgId: string, footer: string): Promise<Blob> {
  const bg = TEXT_BGS.find((x) => x.id === bgId) || TEXT_BGS[0];
  const W = 1080, H = 1920;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, bg.a);
  g.addColorStop(1, bg.b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Círculos suaves de adorno
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#FFFFFF';
  [[180, 260, 220], [920, 520, 160], [860, 1600, 260], [140, 1480, 120]].forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  // Texto: se achica hasta que quepa
  const t = text.trim() || ' ';
  let size = 120;
  let lines: string[] = [];
  for (; size >= 48; size -= 6) {
    ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`;
    lines = wrap(ctx, t, W - 160);
    if (lines.length * size * 1.18 < H - 600) break;
  }
  ctx.fillStyle = bg.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lh = size * 1.18;
  const y0 = H / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));
  ctx.font = '800 44px Nunito, system-ui, sans-serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText(footer, W / 2, H - 140);
  ctx.globalAlpha = 1;
  return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo crear la imagen'))), 'image/png'));
}

/** Comparte la imagen (WhatsApp, Facebook…) o la descarga si el navegador no puede compartir archivos. */
export async function shareBlob(blob: Blob, title: string) {
  const file = new File([blob], 'historia.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title });
    return 'shared';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'historia.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'downloaded';
}
