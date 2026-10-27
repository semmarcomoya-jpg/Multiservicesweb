import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

export interface Picked { uri: string; mime: string; ext: string }

/** Abre la galería (o la cámara) y regresa la imagen elegida. */
export async function pickImage(camera = false): Promise<Picked | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: false };
  if (camera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  }
  const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const mime = a.mimeType || 'image/jpeg';
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  return { uri: a.uri, mime, ext };
}

/** Sube una imagen o video a un bucket y regresa la ruta guardada. */
export async function uploadImage(bucket: string, folder: string, img: Picked): Promise<string> {
  const res = await fetch(img.uri);
  const buf = await res.arrayBuffer();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${img.ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, buf, { contentType: img.mime, upsert: false });
  if (error) throw error;
  return path;
}

/** URL temporal para ver un archivo privado. */
export async function signedUrl(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

/** Sube a la carpeta pública y regresa la URL que cualquiera puede ver. */
export async function uploadPublic(folder: string): Promise<string | null> {
  const img = await pickImage();
  if (!img) return null;
  const path = await uploadImage('publico', folder, img);
  return supabase.storage.from('publico').getPublicUrl(path).data.publicUrl;
}
