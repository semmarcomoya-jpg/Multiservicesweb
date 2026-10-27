import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Scenery, WALL_THEMES, Wallpaper, type WallTheme } from '@/components/art';
import { PanelHeader } from '@/components/panel';
import { Text } from '@/components/Text';
import { Btn, Card, Field, H2, Note, P, Row, Screen } from '@/components/ui';
import { DEFAULT_BRAND, useBranding } from '@/lib/branding';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';
import type { Brand, WallCfg, WallMode } from '@/lib/types';
import { uploadPublic } from '@/lib/upload';

const SECTIONS: [WallTheme, string, string][] = [
  ['home', 'Inicio', 'Home'],
  ['send', 'Envíos', 'Transfers'],
  ['shop', 'Tienda', 'Shop'],
  ['pts', 'Puntos', 'Points'],
  ['profile', 'Perfil y cuenta', 'Profile & account'],
  ['community', 'Boca a boca', 'Word of mouth'],
];

function Seg({ value, onChange, opts }: { value: string; onChange: (v: WallMode) => void; opts: [WallMode, string][] }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#F2DCC8', borderRadius: 999, padding: 3, alignSelf: 'flex-start' }}>
      {opts.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable key={v} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(v)}
            style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: on ? C.ink : 'transparent' }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: on ? '#fff' : C.softInk }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AdminApariencia() {
  const { L } = useLang();
  const { brand, reload } = useBranding();
  const [b, setB] = useState<Brand>(brand);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => setB(brand), [brand]);

  const wall = (t: WallTheme): WallCfg => ({ mode: 'pattern', color: WALL_THEMES[t].color, img: null, ...(b.walls?.[t] || {}) });
  const setWall = (t: WallTheme, p: Partial<WallCfg>) => setB((x) => ({ ...x, walls: { ...(x.walls || {}), [t]: { ...wall(t), ...p } } }));
  const set = (k: keyof Brand) => (v: string) => setB((x) => ({ ...x, [k]: v }));

  const upload = async (key: string, folder: string, apply: (url: string) => void) => {
    setErr('');
    setBusy(key);
    try {
      const url = await uploadPublic(folder);
      if (url) apply(url);
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy('');
  };

  const save = async () => {
    setBusy('save');
    setErr('');
    setMsg('');
    const { error } = await supabase.from('settings').update({ brand: b }).eq('id', 1);
    setBusy('');
    if (error) setErr(errMsg(error));
    else {
      setMsg(L('Guardado. Tus clientes ya ven la nueva apariencia.', 'Saved. Your customers now see the new look.'));
      reload();
    }
  };

  return (
    <Screen wide>
      <PanelHeader kind="admin" />

      <Card>
        <Row style={{ alignItems: 'flex-start', gap: 16 }}>
          {b.logo_url ? (
            <Image source={{ uri: b.logo_url }} style={{ width: 80, height: 80, borderRadius: 22 }} />
          ) : (
            <View style={{ width: 80, height: 80, borderRadius: 22, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 40 }}>{(b.nombre || 'C').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 10, minWidth: 240 }}>
            <H2>{L('Marca', 'Brand')}</H2>
            <Row style={{ alignItems: 'flex-start' }}>
              <Field label={L('Nombre de la empresa', 'Company name')} value={b.nombre} onChangeText={set('nombre')} />
              <Field label={L('Nombre corto (encabezados)', 'Short name (headers)')} value={b.corto} onChangeText={set('corto')} />
            </Row>
            <Row>
              <Btn small icon="upload" title={L('Subir logo', 'Upload logo')} loading={busy === 'logo'} onPress={() => upload('logo', 'branding', (u) => setB((x) => ({ ...x, logo_url: u })))} />
              <Btn small kind="ghost" title={L('Usar inicial', 'Use initial')} onPress={() => setB((x) => ({ ...x, logo_url: null }))} />
            </Row>
          </View>
        </Row>
      </Card>

      <Card>
        <H2>{L('Fondos de pantalla', 'Wallpapers')}</H2>
        <P small muted>
          {L(
            'Cada sección de la app tiene su propio fondo, como los fondos de chat de WhatsApp. Elige un patrón con íconos, un color liso o tu propia imagen.',
            'Each section of the app has its own background, like WhatsApp chat wallpapers. Pick an icon pattern, a plain color or your own image.',
          )}
        </P>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {SECTIONS.map(([t, es, en]) => {
            const w = wall(t);
            return (
              <View key={t} style={st.wallCard}>
                <Text style={{ fontWeight: '800', fontSize: 15, color: C.ink }}>{L(es, en)}</Text>
                <View style={st.preview}>
                  <PreviewWall cfg={w} theme={t} />
                  <View style={{ backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: C.ink }}>{L('Así se lee una tarjeta', 'This is how a card reads')}</Text>
                  </View>
                </View>
                <Seg value={w.mode} onChange={(m) => (m === 'image' && !w.img ? upload('w' + t, 'branding/fondos', (u) => setWall(t, { mode: 'image', img: u })) : setWall(t, { mode: m }))}
                  opts={[['pattern', L('Patrón', 'Pattern')], ['color', L('Color', 'Color')], ['image', L('Imagen', 'Image')]]} />
                <Row style={{ alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>{L('Color de fondo', 'Background color')}</Text>
                  <ColorInput value={w.color} onChange={(c) => setWall(t, { color: c })} />
                </Row>
                {w.mode === 'image' ? (
                  <Btn small kind="ghost" icon="upload" loading={busy === 'w' + t} title={L('Cambiar imagen', 'Change image')} onPress={() => upload('w' + t, 'branding/fondos', (u) => setWall(t, { mode: 'image', img: u }))} />
                ) : null}
              </View>
            );
          })}
        </View>
      </Card>

      <Card>
        <View style={{ height: 150, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
          {b.cover_url ? <Image source={{ uri: b.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Scenery />}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 52, backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 10 }}>
            <Text style={{ fontWeight: '900', fontSize: 13, color: C.ink }}>{b.cover_title_es || DEFAULT_BRAND.cover_title_es}</Text>
          </View>
        </View>
        <H2>{L('Imagen de portada', 'Cover image')}</H2>
        <P small muted>{L('Es lo primero que ven tus clientes. Usa una foto vertical y alegre (recomendado 1080 × 1350 px o más).', 'It is the first thing customers see. Use a cheerful vertical photo (1080 × 1350 px or more).')}</P>
        <Row>
          <Btn small icon="upload" title={L('Subir portada', 'Upload cover')} loading={busy === 'cover'} onPress={() => upload('cover', 'branding', (u) => setB((x) => ({ ...x, cover_url: u })))} />
          <Btn small kind="ghost" title={L('Usar ilustración', 'Use illustration')} onPress={() => setB((x) => ({ ...x, cover_url: null }))} />
        </Row>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Título (español)', 'Title (Spanish)')} value={b.cover_title_es || ''} onChangeText={set('cover_title_es')} />
          <Field label={L('Título (inglés)', 'Title (English)')} value={b.cover_title_en || ''} onChangeText={set('cover_title_en')} />
          <Field label={L('Texto (español)', 'Text (Spanish)')} value={b.cover_sub_es || ''} onChangeText={set('cover_sub_es')} />
          <Field label={L('Texto (inglés)', 'Text (English)')} value={b.cover_sub_en || ''} onChangeText={set('cover_sub_en')} />
        </Row>
      </Card>

      <Card>
        <View style={{ height: 150, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
          {b.home_bg_url ? <Image source={{ uri: b.home_bg_url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Scenery mid />}
        </View>
        <H2>{L('Imagen del encabezado de inicio', 'Home header image')}</H2>
        <P small muted>{L('La foto que va arriba del saludo. Funciona mejor una imagen horizontal (1600 × 900 px).', 'The photo above the greeting. A horizontal image works best (1600 × 900 px).')}</P>
        <Row>
          <Btn small icon="upload" title={L('Subir fondo', 'Upload background')} loading={busy === 'home'} onPress={() => upload('home', 'branding', (u) => setB((x) => ({ ...x, home_bg_url: u })))} />
          <Btn small kind="ghost" title={L('Usar ilustración', 'Use illustration')} onPress={() => setB((x) => ({ ...x, home_bg_url: null }))} />
        </Row>
      </Card>

      {err ? <Note kind="red">{err}</Note> : null}
      {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}
      <Btn title={L('Guardar apariencia', 'Save appearance')} onPress={save} loading={busy === 'save'} style={{ alignSelf: 'flex-start' }} />
    </Screen>
  );
}

/** Muestra el fondo del borrador (no el guardado) */
function PreviewWall({ cfg, theme }: { cfg: WallCfg; theme: WallTheme }) {
  if (cfg.mode === 'color') return <View style={[StyleSheet.absoluteFill, { backgroundColor: cfg.color }]} />;
  if (cfg.mode === 'image' && cfg.img)
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: cfg.color }]}>
        <Image source={{ uri: cfg.img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,247,240,0.80)' }]} />
      </View>
    );
  return <Wallpaper theme={theme} override={{ mode: 'pattern', color: cfg.color, img: null }} />;
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // En web usamos el selector de color del navegador
  if (typeof document !== 'undefined')
    return React.createElement('input', {
      type: 'color',
      value: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#FFF3E6',
      onChange: (e: { target: { value: string } }) => onChange(e.target.value.toUpperCase()),
      'aria-label': 'color',
      style: { width: 40, height: 30, border: `1px solid ${C.line}`, borderRadius: 8, padding: 2, background: '#fff', cursor: 'pointer' },
    });
  return <TextInput value={value} onChangeText={onChange} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 8, height: 32, width: 100 }} />;
}

const st = StyleSheet.create({
  wallCard: { flexGrow: 1, flexBasis: 200, maxWidth: 260, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, gap: 10, backgroundColor: '#fff' },
  preview: { height: 116, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
});

