/**
 * Panel · Historias (igual que en Viva). Publicar una foto o un video corto que los
 * clientes ven en Inicio. Puede llevar texto (español/inglés), un botón de acción y
 * una duración: 24 h, 3 días, 7 días o destacada (no caduca).
 */
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { Btn, Card, Empty, Field, H2, Icon, Label, Loading, Note, P, Pills, Row, SearchBox, matches } from '@/components/ui';
import { prodName, useProducts, useServices } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { expiresFor, hoursLeft, MAX_STORY_BYTES, mediaTypeOf, storyStatus, type StoryDuration } from '@/lib/stories';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import type { Store, Story, StoryLink } from '@/lib/types';
import { uploadImage } from '@/lib/upload';

interface Picked { uri: string; mime: string; ext: string; type: 'image' | 'video' }

async function pickStoryMedia(): Promise<Picked | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 60, allowsEditing: false });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const mime = a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg');
  const type = mediaTypeOf(mime) || (a.type === 'video' ? 'video' : a.type === 'image' ? 'image' : null);
  if (!type) throw new Error('Formato no admitido. Usa una foto (JPG, PNG) o un video MP4, WEBM o MOV.');
  if (a.fileSize && a.fileSize > MAX_STORY_BYTES) throw new Error('El archivo pesa más de 50 MB. Recórtalo o grábalo en menor calidad.');
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('webm') ? 'webm' : mime.includes('quicktime') ? 'mov' : type === 'video' ? 'mp4' : 'jpg';
  return { uri: a.uri, mime, ext, type };
}

export function StoriesAdmin({ storeId, admin, stores }: { storeId: string | null; admin: boolean; stores: Store[] }) {
  const { L, lang } = useLang();
  const [list, setList] = useState<Story[] | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    let q = supabase.from('stories').select('*').order('created_at', { ascending: false }).limit(60);
    if (!admin && storeId) q = q.eq('store_id', storeId);
    const { data } = await q;
    setList((data as Story[]) ?? []);
  }, [admin, storeId]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <Row gap={16} style={{ alignItems: 'flex-start' }}>
      <View style={{ flexGrow: 1, flexBasis: 320, maxWidth: 480, minWidth: 0 }}>
        <NewStory storeId={storeId} admin={admin} stores={stores} onDone={load} />
      </View>
      <View style={{ flexGrow: 2, flexBasis: 420, minWidth: 0 }}>
        <Card>
          <H2>{L('Tus historias', 'Your stories')}</H2>
          {list && list.length > 6 ? <SearchBox value={q} onChangeText={setQ} placeholder={L('Busca por texto o tienda', 'Search by text or store')} /> : null}
          {!list ? <Loading /> : null}
          {list && !list.length ? <Empty>{L('Aún no publicas historias. Sube una foto o video de tus promociones.', 'No stories yet. Upload a photo or video of your deals.')}</Empty> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {(list || []).filter((s) => matches(q, s.caption_es, s.caption_en, s.store_id ? stores.find((x) => x.id === s.store_id)?.nombre : L('Todas las tiendas', 'All stores'))).map((s) => (
              <StoryTile key={s.id} s={s} lang={lang} storeName={s.store_id ? stores.find((x) => x.id === s.store_id)?.nombre.replace('Castillo · ', '') ?? '' : L('Todas las tiendas', 'All stores')} onChanged={load} />
            ))}
          </View>
        </Card>
      </View>
    </Row>
  );
}

function NewStory({ storeId, admin, stores, onDone }: { storeId: string | null; admin: boolean; stores: Store[]; onDone: () => void }) {
  const { L, nm } = useLang();
  const [target, setTarget] = useState<string>(admin ? 'all' : storeId || '');
  const { data: services } = useServices();
  const { data: products } = useProducts(target === 'all' ? null : target);
  const [media, setMedia] = useState<Picked | null>(null);
  const [capEs, setCapEs] = useState('');
  const [capEn, setCapEn] = useState('');
  const [link, setLink] = useState<StoryLink>('none');
  const [linkId, setLinkId] = useState<string | null>(null);
  const [duration, setDuration] = useState<StoryDuration>('24h');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    if (!admin && storeId) setTarget(storeId);
  }, [admin, storeId]);

  const choose = async () => {
    setMsg(null);
    try {
      const p = await pickStoryMedia();
      if (p) setMedia(p);
    } catch (e) {
      setMsg({ ok: false, t: errMsg(e) });
    }
  };

  const publish = async () => {
    if (!media) return;
    if ((link === 'product' || link === 'service') && !linkId) return setMsg({ ok: false, t: L('Elige a qué lleva el botón.', 'Choose where the button goes.') });
    setBusy(true);
    setMsg(null);
    try {
      const folder = target === 'all' ? 'general' : target;
      const path = await uploadImage('stories', folder, { uri: media.uri, mime: media.mime, ext: media.ext });
      const { data: pub } = supabase.storage.from('stories').getPublicUrl(path);
      const { error } = await supabase.from('stories').insert({
        store_id: target === 'all' ? null : target,
        media_url: pub.publicUrl,
        media_type: media.type,
        caption_es: capEs.trim() || null,
        caption_en: capEn.trim() || null,
        link_type: link,
        link_id: link === 'product' || link === 'service' ? linkId : null,
        expires_at: expiresFor(duration),
        // Lo nuevo va adelante
        sort_order: -Math.floor(Date.now() / 1000),
      });
      if (error) throw error;
      setMedia(null);
      setCapEs('');
      setCapEn('');
      setLink('none');
      setLinkId(null);
      setMsg({ ok: true, t: L('¡Publicada! Ya la ven tus clientes en Inicio.', 'Published! Customers see it on Home now.') });
      onDone();
    } catch (e) {
      setMsg({ ok: false, t: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const DUR: { v: StoryDuration; label: string }[] = [
    { v: '24h', label: L('24 horas', '24 hours') },
    { v: '3d', label: L('3 días', '3 days') },
    { v: '7d', label: L('7 días', '7 days') },
    { v: 'featured', label: L('Destacada (no caduca)', 'Featured (no expiry)') },
  ];

  return (
    <Card>
      <H2>{L('Nueva historia', 'New story')}</H2>
      <P small>{L('Foto o video corto en vertical (como TikTok). Tus clientes la ven arriba en Inicio y se abre sola al entrar.', 'Short vertical photo or video (like TikTok). Customers see it at the top of Home and it opens on its own.')}</P>
      <Pressable accessibilityRole="button" onPress={choose} disabled={busy}
        style={{ height: 300, borderRadius: R.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: C.brown, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: C.cream }}>
        {!media ? (
          <View style={{ alignItems: 'center', gap: 8, padding: 16 }}>
            <Icon n="camera" size={36} color={C.brown} />
            <Text style={{ color: C.brown, fontWeight: '800', textAlign: 'center' }}>{L('Elegir foto o video', 'Choose photo or video')}</Text>
            <P small style={{ textAlign: 'center' }}>{L('Hasta 50 MB. Videos de 15 a 60 segundos.', 'Up to 50 MB. 15 to 60 second videos.')}</P>
          </View>
        ) : media.type === 'image' ? (
          <Image source={{ uri: media.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ width: '100%', height: '100%', backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Text style={{ color: '#fff', fontSize: 40 }}>▶</Text>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{L('Video listo', 'Video ready')}</Text>
          </View>
        )}
      </Pressable>
      {media ? (
        <Pressable onPress={choose}>
          <Text style={{ color: C.brown, fontWeight: '800' }}>{L('Cambiar', 'Change')}</Text>
        </Pressable>
      ) : null}

      {admin ? (
        <Pills label={L('¿Quién la ve?', 'Who sees it?')} options={[{ v: 'all', label: L('Todas las tiendas', 'All stores') }, ...stores.map((s) => ({ v: s.id, label: s.nombre.replace('Castillo · ', ''), icon: 'store' }))]}
          value={target} onChange={(v) => { setTarget(v); if (link === 'product') { setLink('none'); setLinkId(null); } }} />
      ) : null}

      <Field label={L('Texto en español (opcional)', 'Text in Spanish (optional)')} value={capEs} onChangeText={setCapEs} maxLength={200} placeholder={L('Ej. ¡Galaxy A15 a $189 este fin!', 'E.g. Galaxy A15 for $189 this weekend!')} />
      <Field label={L('Texto en inglés (opcional)', 'Text in English (optional)')} value={capEn} onChangeText={setCapEn} maxLength={200} />

      <Pills
        label={L('Botón de la historia', 'Story button')}
        options={[
          { v: 'none' as StoryLink, label: L('Sin botón', 'No button') },
          { v: 'send' as StoryLink, label: L('Enviar dinero', 'Send money'), icon: 'send' },
          { v: 'service' as StoryLink, label: L('Un servicio', 'A service'), icon: 'tool' },
          ...(target !== 'all' ? [{ v: 'product' as StoryLink, label: L('Un producto', 'A product'), icon: 'bag' }] : []),
          { v: 'shop' as StoryLink, label: L('La tienda', 'The shop'), icon: 'bag' },
        ]}
        value={link}
        onChange={(v) => { setLink(v); setLinkId(null); }}
      />
      {link === 'service' && services ? (
        <Pills wrap options={services.filter((s) => s.activo).map((s) => ({ v: s.id, label: nm(s), icon: s.icon }))} value={linkId} onChange={setLinkId} />
      ) : null}
      {link === 'product' && products ? (
        <Pills wrap options={products.filter((p) => p.activo).map((p) => ({ v: p.id, label: prodName(p) }))} value={linkId} onChange={setLinkId} />
      ) : null}

      <Pills label={L('¿Cuánto tiempo se ve?', 'How long is it shown?')} options={DUR} value={duration} onChange={setDuration} />

      {msg ? <Note kind={msg.ok ? 'blue' : 'red'} icon={msg.ok ? 'check' : 'x'}>{msg.t}</Note> : null}
      <Btn title={busy ? L('Subiendo…', 'Uploading…') : L('Publicar historia', 'Publish story')} loading={busy} disabled={!media || (!admin && !storeId)} onPress={publish} />
    </Card>
  );
}

function StoryTile({ s, lang, storeName, onChanged }: { s: Story; lang: 'es' | 'en'; storeName: string; onChanged: () => void }) {
  const { L } = useLang();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const st = storyStatus(s);
  const label =
    st === 'active' ? L(`Quedan ${hoursLeft(s)} h`, `${hoursLeft(s)} h left`) : st === 'featured' ? L('Destacada', 'Featured') : st === 'expired' ? L('Terminó', 'Ended') : L('Programada', 'Scheduled');
  const act = async (fn: () => PromiseLike<unknown>) => {
    setBusy(true);
    await fn();
    setBusy(false);
    setConfirm(false);
    onChanged();
  };
  const setDur = (d: StoryDuration) => act(() => supabase.from('stories').update({ expires_at: expiresFor(d), starts_at: new Date().toISOString() }).eq('id', s.id));
  const cap = lang === 'es' ? s.caption_es || s.caption_en : s.caption_en || s.caption_es;
  return (
    <View style={{ width: 150, gap: 4, opacity: st === 'expired' ? 0.55 : 1 }}>
      <View style={{ width: 150, height: 240, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.cream }}>
        {s.media_type === 'image' ? (
          <Image source={{ uri: s.media_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ width: '100%', height: '100%', backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 34 }}>▶</Text>
          </View>
        )}
        <View style={{ position: 'absolute', left: 6, top: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: st === 'featured' ? C.gold : st === 'expired' ? '#666' : C.brown, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
          {st === 'featured' ? <Icon n="star" size={11} color="#fff" /> : null}
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{label}</Text>
        </View>
        <View style={{ position: 'absolute', right: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Icon n="eye" size={11} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{s.views}</Text>
        </View>
      </View>
      <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{cap || '—'}</Text>
      <Text numberOfLines={1} style={{ fontSize: 11, color: C.muted }}>{storeName}</Text>
      {confirm ? (
        <Row gap={10}>
          <Pressable disabled={busy} onPress={() => act(() => supabase.from('stories').delete().eq('id', s.id))}>
            <Text style={{ color: C.red, fontWeight: '800' }}>{L('Sí, borrar', 'Yes, delete')}</Text>
          </Pressable>
          <Pressable onPress={() => setConfirm(false)}>
            <Text style={{ color: C.brown, fontWeight: '800' }}>{L('Cancelar', 'Cancel')}</Text>
          </Pressable>
        </Row>
      ) : (
        <Row gap={10}>
          {st !== 'featured' ? (
            <Pressable disabled={busy} onPress={() => setDur('featured')}>
              <Text style={{ color: C.brown, fontWeight: '800', fontSize: 13 }}>{L('Destacar', 'Feature')}</Text>
            </Pressable>
          ) : null}
          {st === 'expired' ? (
            <Pressable disabled={busy} onPress={() => setDur('24h')}>
              <Text style={{ color: C.brown, fontWeight: '800', fontSize: 13 }}>{L('Renovar 24 h', 'Renew 24 h')}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setConfirm(true)}>
            <Text style={{ color: C.red, fontWeight: '800', fontSize: 13 }}>{L('Quitar', 'Remove')}</Text>
          </Pressable>
        </Row>
      )}
    </View>
  );
}
