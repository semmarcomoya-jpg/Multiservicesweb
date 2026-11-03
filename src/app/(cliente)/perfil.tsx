import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { BirthdayField } from '@/components/BirthdayField';
import { InstallCard } from '@/components/InstallCard';
import { resetTour } from '@/components/Tour';
import { Avatar, Btn, Card, Field, H1, Label, Note, P, Pills, Row, Screen, TopBar, NavyHead, Seg, Icon } from '@/components/ui';
import { pickImage, uploadImage } from '@/lib/upload';
import { useAuth } from '@/lib/auth';
import { CountryCombo, StateCityPicker } from '@/components/PlacePicker';
import { useStores } from '@/lib/data';
import { SpecialDays } from '@/components/SpecialDays';
import { digits } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { Scene } from '@/components/scenes';
import { useMyPoints } from '@/lib/points';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R, getThemePref, setThemePref, type ThemePref } from '@/lib/theme';
import { PushCard } from '@/components/PushCard';

export default function Perfil() {
  const { L, lang, setLang } = useLang();
  const { profile, refreshProfile, signOut, session } = useAuth();
  const { data: stores } = useStores();
  const { balance } = useMyPoints(profile?.id);
  // Lo que ha mandado por mes (últimos 6 meses)
  const [sent, setSent] = useState<{ total: number; created_at: string }[]>([]);
  useEffect(() => {
    if (!profile?.id) return;
    const from = new Date();
    from.setMonth(from.getMonth() - 5, 1);
    supabase.from('orders').select('total, created_at').eq('user_id', profile.id).eq('kind', 'send').neq('status', 'rechazado').gte('created_at', from.toISOString()).limit(500)
      .then(({ data }) => setSent((data as { total: number; created_at: string }[]) ?? []));
  }, [profile?.id]);
  const [f, setF] = useState({ nombre: '', apellidos: '', telefono: '', fecha_nac: '', store_id: '' as string | null, pais: '' as string, estado: '' });
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'res' | 'pts' | 'cred' | 'ajustes'>('res');
  const [themePref, setThemeP] = useState<ThemePref>(getThemePref());
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fotoBusy, setFotoBusy] = useState(false);
  const [fotoErr, setFotoErr] = useState('');

  useEffect(() => {
    if (profile)
      setF({ nombre: profile.nombre || '', apellidos: profile.apellidos || '', telefono: profile.telefono || '', fecha_nac: profile.fecha_nac ? profile.fecha_nac.split('-').reverse().join('/') : '', store_id: profile.store_id, pais: profile.pais || '', estado: profile.estado || '' });
  }, [profile]);

  if (!profile) return null;
  const myStore = (stores || []).find((x) => x.id === profile.store_id);
  const ptsStore = (myStore && myStore.loyalty?.on ? myStore : (stores || []).find((x) => x.activo && x.loyalty?.on)) || null;
  const pts = ptsStore ? balance(ptsStore.id) : 0;
  const nextRw = ptsStore?.loyalty?.rewards?.filter((r) => Number(r.pts) > pts).sort((a, b) => a.pts - b.pts)[0];
  const set = (k: keyof typeof f) => (v: string) => {
    setOk(false);
    setMsg('');
    setF((p) => ({ ...p, [k]: v }));
  };
  // Acepta 21/05/1990, 21-5-1990 o 1990-05-21; se guarda como 1990-05-21
  const toIso = (t: string): string | null => {
    const v = t.trim();
    if (!v) return '';
    let y: number, m: number, d: number;
    let r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(v);
    if (r) [y, m, d] = [+r[1], +r[2], +r[3]];
    else if ((r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(v))) [d, m, y] = [+r[1], +r[2], +r[3]];
    else return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1 || y < 1900 || dt > new Date()) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };
  const iso = toIso(f.fecha_nac);
  // ¿Hay algo distinto a lo guardado?
  const dirty =
    !profile ||
    (f.nombre || '').trim() !== (profile.nombre || '') ||
    (f.apellidos || '').trim() !== (profile.apellidos || '') ||
    digits(f.telefono || '') !== (profile.telefono || '') ||
    (iso === null ? true : (iso || null) !== (profile.fecha_nac || null)) ||
    (profile.role === 'cliente' && (f.store_id || null) !== (profile.store_id || null)) ||
    (f.pais || '') !== (profile.pais || '') ||
    (f.estado || '').trim() !== (profile.estado || '');
  const dateOk = iso !== null;

  const save = async () => {
    setOk(false);
    if (!dateOk) return setMsg(L('Revisa tu fecha de nacimiento: elige día, mes y año, o déjala vacía.', 'Check your date of birth: pick day, month and year, or leave it empty.'));
    if (!(f.nombre || '').trim()) return setMsg(L('Escribe tu nombre.', 'Enter your first name.'));
    setBusy(true);
    setMsg('');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ nombre: (f.nombre || '').trim(), apellidos: (f.apellidos || '').trim(), telefono: digits(f.telefono || ''), fecha_nac: iso || null, store_id: profile.role === 'cliente' ? f.store_id || null : profile.store_id, pais: f.pais || null, estado: (f.estado || '').trim() })
        .eq('id', profile.id)
        .select('id');
      if (error) throw error;
      // Si no regresó nada, la base no dejó guardar (permisos)
      if (!data || data.length === 0) throw new Error(L('No se pudo guardar: tu sesión no tiene permiso. Cierra sesión y vuelve a entrar.', 'Could not save: your session has no permission. Sign out and sign in again.'));
      setOk(true);
      setMsg(L('¡Listo! Tus datos se guardaron.', 'Done! Your details were saved.'));
      await refreshProfile();
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  // Foto de perfil: se sube a tu carpeta y se guarda en tu perfil
  const cambiarFoto = async (camera = false) => {
    setFotoErr('');
    const img = await pickImage(camera);
    if (!img) return;
    setFotoBusy(true);
    try {
      const path = await uploadImage('avatars', profile.id, img);
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from('profiles').update({ foto_url: url }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
    } catch (e) {
      setFotoErr(errMsg(e));
    }
    setFotoBusy(false);
  };
  const quitarFoto = async () => {
    await supabase.from('profiles').update({ foto_url: null }).eq('id', profile.id);
    refreshProfile();
  };

  const idTxt = {
    ninguna: L('Sin verificar. Para enviar más, sube tu identificación o muéstrala en la tienda.', 'Not verified. To send more, upload your ID or show it at the store.'),
    pendiente: L('En revisión', 'Under review'),
    verificada: L('Identificación verificada', 'ID verified'),
    rechazada: L('No se pudo verificar. Pasa a la tienda.', 'Could not verify. Please visit the store.'),
  }[profile.id_status];

  return (
    <Screen wall="profile">
      <NavyHead style={{ borderRadius: 22, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={L('Cambiar foto de perfil', 'Change profile photo')} onPress={() => cambiarFoto()} disabled={fotoBusy}>
            <Avatar name={`${profile.nombre} ${profile.apellidos}`} size={60} uri={profile.foto_url} />
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#62BDF6', borderWidth: 2, borderColor: '#0B2E5E', alignItems: 'center', justifyContent: 'center' }}>
              <Icon n="camera" size={12} color="#06213F" />
            </View>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 21, fontWeight: '900', color: '#fff' }} numberOfLines={1}>{`${profile.nombre} ${profile.apellidos}`.trim()}</Text>
            <Text style={{ color: '#C9DDF4', fontSize: 13 }}>{`${profile.member_code} · ${idTxt}`}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={L('Mi tarjeta', 'My card')} onPress={() => router.push('/tarjeta')}
            style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon n="qr" size={22} color="#fff" />
          </Pressable>
        </View>
        {fotoErr ? <Text style={{ color: '#F7DCD6', fontSize: 12 }}>{fotoErr}</Text> : null}
        {fotoBusy ? <Text style={{ color: '#C9DDF4', fontSize: 12 }}>{L('Subiendo foto…', 'Uploading photo…')}</Text> : null}
      </NavyHead>
      <Seg
        options={[
          { v: 'res' as const, label: L('Resumen', 'Overview') },
          { v: 'pts' as const, label: L('Puntos', 'Points') },
          { v: 'cred' as const, label: L('Crédito', 'Credit') },
          { v: 'ajustes' as const, label: L('Ajustes', 'Settings') },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'pts' ? (
        <Card>
          {ptsStore ? (
            <>
              <Row style={{ alignItems: 'baseline' }}>
                <Text style={{ fontSize: 30, fontWeight: '900', color: C.ink }}>{pts}</Text>
                <P muted>{L('puntos en ', 'points at ') + ptsStore.nombre.replace('Castillo · ', '')}</P>
              </Row>
              {nextRw ? (
                <>
                  <View style={{ height: 7, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.min(100, (pts / nextRw.pts) * 100)}%`, height: '100%', backgroundColor: C.brown }} />
                  </View>
                  <P small muted>{L(`${nextRw.pts - pts} más para "${nextRw.es}"`, `${nextRw.pts - pts} more for "${nextRw.en || nextRw.es}"`)}</P>
                </>
              ) : null}
              {(ptsStore.loyalty?.rewards || []).map((r) => (
                <Row key={r.id || r.es} style={{ justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: C.ink }}>{lang === 'es' ? r.es : r.en || r.es}</Text>
                    <P small muted>{`${r.pts} pts`}</P>
                  </View>
                  <Text style={{ fontWeight: '900', fontSize: 12, color: pts >= r.pts ? '#1E7A4A' : C.brown }}>{pts >= r.pts ? L('Lo puedes usar', 'Available') : L(`Te faltan ${r.pts - pts}`, `${r.pts - pts} to go`)}</Text>
                </Row>
              ))}
            </>
          ) : (
            <P muted>{L('Tu tienda todavía no tiene puntos activos.', 'Your store has no points program yet.')}</P>
          )}
          <Btn kind="ghost" icon="star" title={L('Ver mis movimientos de puntos', 'See my points history')} onPress={() => router.push('/puntos')} />
        </Card>
      ) : null}

      {tab === 'cred' ? (
        <Card>
          <P muted>{L('Tus compras a pagos y apartados, con cada abono y cuándo vence.', 'Your installment purchases and layaways, with each payment and due date.')}</P>
          <Btn icon="wallet" title={L('Mi crédito y apartados', 'My credit & layaways')} onPress={() => router.push('/credito')} />
          <Btn kind="ghost" icon="chart" title={L('Mis cuentas (lo que he gastado)', 'My accounts (my spending)')} onPress={() => router.push('/cuentas')} />
        </Card>
      ) : null}

      {tab === 'res' ? (<>
      {(() => {
        const now = new Date();
        const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
        const vals = months.map((m) => sent.filter((o) => { const d = new Date(o.created_at); return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth(); }).reduce((a, o) => a + Number(o.total), 0));
        const mx = Math.max(1, ...vals);
        const tot = vals.reduce((a, v) => a + v, 0);
        if (!tot) return null;
        return (
          <Card style={{ gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16.5, fontWeight: '900', color: C.ink }}>{L('Lo que has mandado', 'What you have sent')}</Text>
              <P small muted>{L('últimos 6 meses', 'last 6 months')}</P>
            </Row>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 96 }}>
              {months.map((m, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
                  <View accessibilityLabel={`${m.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short' })}: ${vals[i].toFixed(2)}`}
                    style={{ width: '100%', height: `${Math.max(3, (vals[i] / mx) * 78)}%`, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: i === 5 ? C.gold : C.brown }} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: C.muted }}>{m.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short' }).replace('.', '')}</Text>
                </View>
              ))}
            </View>
            <P small muted>{L(`Total: $${tot.toFixed(2)}`, `Total: $${tot.toFixed(2)}`)}</P>
          </Card>
        );
      })()}
      <SpecialDays />
      {profile.id_status !== 'verificada' ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/identidad')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Scene n="tramite" size={40} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: C.ink }}>{profile.id_status === 'pendiente' ? L('Tu identificación está en revisión', 'Your ID is under review') : L('Sube tu identificación', 'Upload your ID')}</Text>
            <P small muted>{L('Para mandar montos más altos', 'To send larger amounts')}</P>
          </View>
          <Icon n="arrow" size={16} color={C.muted} />
        </Pressable>
      ) : null}

      <InstallCard />

      {profile.role !== 'cliente' ? (
        <Card>
          <Label>{L('Acceso de personal', 'Staff access')}</Label>
          {profile.role === 'admin' ? <Btn icon="lock" title={L('Panel de administrador', 'Admin panel')} onPress={() => router.push('/admin')} /> : null}
          <Btn kind="ghost" icon="store" title={L('Modo tienda', 'Store mode')} onPress={() => router.push('/tienda')} />
        </Card>
      ) : null}

      <Card>
        <Btn kind="ghost" icon="qr" title={L('Mi tarjeta', 'My card')} onPress={() => router.push('/tarjeta')} />
        <Btn kind="ghost" icon="star" title={L('Mis puntos', 'My points')} onPress={() => router.push('/puntos')} />
        <Btn kind="ghost" icon="wallet" title={L('Mi crédito y apartados', 'My credit & layaways')} onPress={() => router.push('/credito')} />
        <Btn kind="ghost" icon="chart" title={L('Mis cuentas', 'My accounts')} onPress={() => router.push('/cuentas')} />
        <Btn kind="ghost" icon="receipt" title={L('Mis pedidos', 'My orders')} onPress={() => router.push('/pedidos')} />
        <Btn kind="ghost" icon="users" title={L('Mis personas', 'My people')} onPress={() => router.push('/beneficiarios')} />
        <Btn kind="ghost" icon="chat" title={L('Boca a boca', 'Word of mouth')} onPress={() => router.push('/comunidad')} />
      </Card>
      </>) : null}

      {tab === 'ajustes' ? (<>
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Nombre', 'First name')} value={f.nombre} onChangeText={set('nombre')} />
          <Field label={L('Apellidos', 'Last name')} value={f.apellidos} onChangeText={set('apellidos')} />
        </Row>
        <Field label={L('Teléfono', 'Phone')} value={f.telefono} onChangeText={(v) => set('telefono')(digits(v))} keyboardType="phone-pad" maxLength={10} />
        <CountryCombo label={L('¿De qué país eres?', 'Which country are you from?')} value={f.pais} onChange={(v) => { setOk(false); setMsg(''); setF((p) => ({ ...p, pais: v, estado: '' })); }} />
        {f.pais ? <StateCityPicker country={f.pais} estado={f.estado} hideCity onEstado={(v) => { setOk(false); setMsg(''); setF((p) => ({ ...p, estado: v })); }} /> : null}
        <P small muted>{L('Lo usamos para avisarte de los días especiales de tu tierra y de Estados Unidos.', 'We use it to remind you of special days back home and in the U.S.')}</P>
        <BirthdayField value={f.fecha_nac} onChange={(v) => { setOk(false); setMsg(''); setF((p) => ({ ...p, fecha_nac: v })); }} />
        <P small muted>{session?.user.email}</P>
        {profile.role === 'cliente' && stores ? (
          <Pills label={L('Mi tienda favorita', 'My favorite store')} options={stores.map((x) => ({ v: x.id, label: x.nombre.replace('Castillo · ', ''), icon: 'store', img: x.fotos?.[0] || null }))} value={f.store_id} onChange={(v) => { setOk(false); setMsg(''); setF((p) => ({ ...p, store_id: v })); }} />
        ) : null}
        {msg ? <Note kind={ok ? 'blue' : 'red'} icon={ok ? 'check' : 'x'}>{msg}</Note> : null}
        {/* Después de guardar el botón dice "✓ Guardado" hasta que cambies algo */}
        <Btn title={dirty ? L('Guardar cambios', 'Save changes') : L('✓ Guardado', '✓ Saved')} kind={dirty ? 'primary' : 'ghost'} disabled={!dirty && !busy} onPress={save} loading={busy} />
      </Card>

      <Card>
        <Label>{L('Identificación', 'ID')}</Label>
        <P muted>{idTxt}</P>
        {profile.id_status !== 'verificada' ? <Btn kind="ghost" icon="id" title={profile.id_status === 'pendiente' ? L('Ver estado', 'See status') : L('Verificar mi identidad', 'Verify my identity')} onPress={() => router.push('/identidad')} /> : null}
      </Card>

      </>) : null}

      {tab === 'ajustes' ? (<>
      <Card>
        <Pills label={L('Idioma', 'Language')} options={[{ v: 'es' as const, label: 'Español' }, { v: 'en' as const, label: 'English' }]} value={lang} onChange={setLang} />
        <Pills
          label={L('Colores de la app', 'App colors')}
          options={[
            { v: 'auto' as ThemePref, label: L('Como mi celular', 'Like my phone') },
            { v: 'light' as ThemePref, label: L('Claro', 'Light') },
            { v: 'dark' as ThemePref, label: L('Modo noche', 'Dark') },
          ]}
          value={themePref}
          onChange={(v) => { setThemeP(v); setThemePref(v); }}
        />
        <P small muted>{L('Se guarda en este celular. Al cambiarlo, la app se recarga.', 'Saved on this phone. Changing it reloads the app.')}</P>
      </Card>
      <PushCard />
      <Card>
        <Btn kind="ghost" icon="doc" title={L('Ayuda y términos', 'Help & terms')} onPress={() => router.push('/ayuda')} />
        <Btn kind="ghost" icon="star" title={L('Ver la guía de bienvenida', 'See the welcome guide')} onPress={() => { resetTour(); router.push({ pathname: '/inicio', params: { tour: '1' } }); }} />
        <Btn
          kind="danger"
          icon="x"
          title={L('Cerrar sesión', 'Sign out')}
          onPress={async () => {
            await signOut();
            router.replace('/bienvenida');
          }}
        />
      </Card>
      </>) : null}
    </Screen>
  );
}
