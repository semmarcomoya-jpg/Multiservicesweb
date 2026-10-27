/** Elegir un documento (PDF o imagen) y subirlo a la carpeta pública. */
import { Platform } from 'react-native';

import { supabase } from './supabase';
import { pickImage } from './upload';

export interface Uploaded { url: string; name: string; isPdf: boolean }
const MAX = 10 * 1024 * 1024;

function pickWeb(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Sube una ficha técnica. En web acepta PDF o imagen; en el teléfono, una foto. */
export async function uploadDoc(folder: string): Promise<Uploaded | null> {
  let body: Blob | ArrayBuffer;
  let mime: string;
  let name: string;
  if (Platform.OS === 'web') {
    const f = await pickWeb('application/pdf,image/jpeg,image/png,image/webp');
    if (!f) return null;
    if (f.size > MAX) throw new Error('El archivo pesa más de 10 MB. Usa uno más ligero.');
    body = f;
    mime = f.type || 'application/pdf';
    name = f.name;
  } else {
    const img = await pickImage();
    if (!img) return null;
    body = await (await fetch(img.uri)).arrayBuffer();
    mime = img.mime;
    name = 'ficha.' + img.ext;
  }
  const ext = mime.includes('pdf') ? 'pdf' : mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const path = `${folder}/fichas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('publico').upload(path, body, { contentType: mime, upsert: false });
  if (error) throw error;
  return { url: supabase.storage.from('publico').getPublicUrl(path).data.publicUrl, name, isPdf: ext === 'pdf' };
}
