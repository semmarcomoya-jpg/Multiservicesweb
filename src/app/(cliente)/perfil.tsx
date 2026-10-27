import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';

import { InstallCard } from '@/components/InstallCard';
import { Avatar, Btn, Card, Field, H1, Label, Note, P, Pills, Row, Screen, TopBar } from '@/components/ui';
import { pickImage, uploadImage } from '@/lib/upload';
import { useAuth } from '@/lib/auth';
import { useStores } from '@/lib/data';
import { digits } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';

export default function Perfil() {
  const { L } = useLang();
  const { profile, refreshProfile, signOut, session } = useAuth();
  const { data: stores } = useStores();
  const [f, setF] = useState({ nombre: '', apellidos: '', telefono: '', fecha_nac: '', store_id: '' as string | null });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [fotoBusy, setFotoBusy] = useState(false);
  const [fotoErr, setFotoErr] = useState('');

  useEffect(() => {
    if (profile)
      setF({ nombre: profile.nombre, apellidos: profile.apellidos, telefono: profile.telefono, fecha_nac: profile.fecha_nac || '', store_id: profile.store_id });
  }, [profile]);

  if (!profile) return null;
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const dateOk = !f.fecha_nac || /^\d{4}-\d{2}-\d{2}$/.test(f.fecha_nac);

  const save = async () => {
    if (!dateOk) return;
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ nombre: f.nombre.trim(), apellidos: f.apellidos.trim(), telefono: digits(f.telefono), fecha_nac: f.fecha_nac || null, store_id: profile.role === 'cliente' ? f.store_id : profile.store_id })
      .eq('id', profile.id);
    setBusy(false);
    setMsg(error ? errMsg(error) : L('Guardado', 'Saved'));
    refreshProfile();
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
    ninguna: L('Sin verificar. Para enviar más, muestra tu identificación en la tienda.', 'Not verified. To send more, show your ID at the store.'),
    pendiente: L('En revisión', 'Under review'),
    verificada: L('Identificación verificada', 'ID verified'),
    rechazada: L('No se pudo verificar. Pasa a la tienda.', 'Could not verify. Please visit the store.'),
  }[profile.id_status];

  return (
    <Screen wall="profile">
      <TopBar />
      <H1>{L('Mi perfil', 'My profile')}</H1>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={L('Cambiar foto de perfil', 'Change profile photo')} onPress={() => cambiarFoto()} disabled={fotoBusy}>
          <Avatar name={`${profile.nombre} ${profile.apellidos}`} size={84} uri={profile.foto_url} />
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: C.brown, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, lineHeight: 18 }}>+</Text>
          </View>
        </Pressable>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontWeight: '900', fontSize: 18, color: C.ink }}>{`${profile.nombre} ${profile.apellidos}`.trim()}</Text>
          <Row>
            <Btn small icon="camera" title={fotoBusy ? L('Subiendo…', 'Uploading…') : profile.foto_url ? L('Cambiar foto', 'Change photo') : L('Subir foto', 'Add photo')} onPress={() => cambiarFoto()} loading={fotoBusy} />
            {profile.foto_url ? <Btn small kind="ghost" title={L('Quitar', 'Remove')} onPress={quitarFoto} /> : null}
          </Row>
          {fotoErr ? <P small style={{ color: C.red }}>{fotoErr}</P> : <P small muted>{L('Así te reconocen en la tienda.', 'So the store recognizes you.')}</P>}
        </View>
      </Card>
      <View style={{ backgroundColor: C.brown, borderRadius: R.xl, padding: 18, gap: 4 }}>
        <Text style={{ color: C.goldSoft, fontWeight: '700' }}>{L('Tu número de cliente', 'Your member number')}</Text>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 1 }}>{profile.member_code}</Text>
        <Text style={{ color: C.goldSoft, fontSize: 13 }}>{L('Dilo en la tienda para sumar tus puntos.', 'Say it at the store to earn your points.')}</Text>
      </View>

      <InstallCard />

      {profile.role !== 'cliente' ? (
        <Card>
          <Label>{L('Acceso de personal', 'Staff access')}</Label>
          {profile.role === 'admin' ? <Btn icon="lock" title={L('Panel de administrador', 'Admin panel')} onPress={() => router.push('/admin')} /> : null}
          <Btn kind="ghost" icon="store" title={L('Modo tienda', 'Store mode')} onPress={() => router.push('/tienda')} />
        </Card>
      ) : null}

      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Nombre', 'First name')} value={f.nombre} onChangeText={set('nombre')} />
          <Field label={L('Apellidos', 'Last name')} value={f.apellidos} onChangeText={set('apellidos')} />
        </Row>
        <Field label={L('Teléfono', 'Phone')} value={f.telefono} onChangeText={(v) => set('telefono')(digits(v))} keyboardType="phone-pad" maxLength={10} />
        <Field label={L('Fecha de nacimiento (AAAA-MM-DD)', 'Date of birth (YYYY-MM-DD)')} value={f.fecha_nac} onChangeText={set('fecha_nac')} placeholder="1990-05-21" error={dateOk ? '' : L('Usa el formato AAAA-MM-DD', 'Use YYYY-MM-DD')} hint={L('Opcional. Te consentimos en tu cumpleaños.', 'Optional. We treat you on your birthday.')} />
        <P small muted>{session?.user.email}</P>
        {profile.role === 'cliente' && stores ? (
          <Pills label={L('Mi tienda favorita', 'My favorite store')} options={stores.map((x) => ({ v: x.id, label: x.nombre.replace('Castillo · ', ''), icon: 'store' }))} value={f.store_id} onChange={(v) => setF((p) => ({ ...p, store_id: v }))} />
        ) : null}
        {msg ? <Note kind="blue">{msg}</Note> : null}
        <Btn title={L('Guardar cambios', 'Save changes')} onPress={save} loading={busy} />
      </Card>

      <Card>
        <Label>{L('Identificación', 'ID')}</Label>
        <P muted>{idTxt}</P>
      </Card>

      <Card>
        <Btn kind="ghost" icon="receipt" title={L('Mis pedidos', 'My orders')} onPress={() => router.push('/pedidos')} />
        <Btn kind="ghost" icon="users" title={L('Mis personas', 'My people')} onPress={() => router.push('/beneficiarios')} />
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
    </Screen>
  );
}
