import React, { useEffect, useState } from 'react';

import { Btn, Card, Field, H2, Note, P, Row, Toggle } from '@/components/ui';
import { useServices } from '@/lib/data';
import { useLang } from '@/lib/i18n';
import { errMsg, supabase } from '@/lib/supabase';
import type { Store, StoreDelivery, StoreMods } from '@/lib/types';

const DEF_MODS: StoreMods = { send: true, svc: true, shop: true, credit: false, layaway: false, comm: true };
const DEF_DEL: StoreDelivery = { pickup: true, curb: true, home: false, homeFee: 5, freeOver: 0, slots: '10:00, 12:00, 14:00, 16:00, 18:00', zips: '' };

/** Formulario de una tienda. Lo usan la propia tienda (Mi tienda) y el administrador. */
export function StoreForm({ store, onSaved, admin }: { store: Store; onSaved?: () => void; admin?: boolean }) {
  const { L, nm } = useLang();
  const { data: services } = useServices();
  const [f, setF] = useState<Store>(store);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(store), [store]);

  const mods = { ...DEF_MODS, ...(f.mods || {}) };
  const del = { ...DEF_DEL, ...(f.delivery || {}) };
  const set = (k: keyof Store) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const setMod = (k: keyof StoreMods, v: boolean) => setF((p) => ({ ...p, mods: { ...mods, [k]: v } }));
  const setDel = (patch: Partial<StoreDelivery>) => setF((p) => ({ ...p, delivery: { ...del, ...patch } }));

  const save = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    const payload = {
      nombre: f.nombre,
      direccion: f.direccion,
      ciudad: f.ciudad,
      horario: f.horario,
      telefono: f.telefono,
      descripcion: f.descripcion,
      zelle_dato: f.zelle_dato,
      zelle_nombre: f.zelle_nombre,
      mods,
      delivery: { ...del, homeFee: Number(del.homeFee) || 0, freeOver: Number(del.freeOver) || 0 },
      svc_off: f.svc_off || [],
      abierta: f.abierta !== false,
      aviso_cerrada: f.aviso_cerrada || '',
      ...(admin ? { activo: f.activo, orden: Number(f.orden) || 0 } : {}),
    };
    const { error } = await supabase.from('stores').update(payload).eq('id', store.id);
    setBusy(false);
    if (error) setErr(errMsg(error));
    else {
      setMsg(L('Cambios guardados', 'Changes saved'));
      onSaved?.();
    }
  };

  const MODS: [keyof StoreMods, string, string, string][] = [
    ['send', 'send', L('Envíos a México', 'Money to Mexico'), L('Depósito o retiro en efectivo', 'Deposit or cash pickup')],
    ['svc', 'tool', L('Pago de servicios y trámites', 'Bill pay & services'), L('Recargas, luz, agua, trámites…', 'Top-ups, utilities, paperwork…')],
    ['shop', 'bag', L('Productos', 'Products'), L('Catálogo, carrito y pago', 'Catalog, cart and payment')],
    ['credit', 'wallet', L('Crédito', 'Credit'), L('Compras a plazos (fase 2)', 'Installments (phase 2)')],
    ['layaway', 'calendar', L('Apartado', 'Layaway'), L('Fase 2', 'Phase 2')],
    ['comm', 'chat', L('Boca a boca', 'Word of mouth'), L('Reseñas (fase 2)', 'Reviews (phase 2)')],
  ];

  return (
    <>
      <Card>
        <H2>{L('Abrir o cerrar la tienda', 'Open or close the store')}</H2>
        <Toggle icon="store" label={f.abierta !== false ? L('Abierta: recibe pedidos', 'Open: taking orders') : L('Cerrada: no recibe pedidos nuevos', 'Closed: no new orders')}
          sub={L('Los pedidos que ya tienes siguen igual. Guarda para aplicar.', 'Existing orders stay as they are. Save to apply.')}
          value={f.abierta !== false} onChange={(v) => setF((p) => ({ ...p, abierta: v }))} />
        <Field label={L('Aviso para clientes cuando está cerrada (opcional)', 'Message for customers when closed (optional)')} value={f.aviso_cerrada || ''} onChangeText={set('aviso_cerrada')}
          placeholder={L('Ej. Cerramos por inventario, abrimos mañana a las 9:00', 'E.g. Closed for inventory, open tomorrow at 9:00')} />
      </Card>

      <Card>
        <H2>{L('¿Qué ofrece esta tienda?', 'What does this store offer?')}</H2>
        <P small muted>{L('Lo que apagues desaparece para los clientes de esta tienda.', 'What you turn off disappears for this store’s customers.')}</P>
        <Row gap={10} style={{ alignItems: 'stretch' }}>
          {MODS.map(([k, ic, t, sub]) => (
            <Toggle key={k} icon={ic} label={t} sub={sub} value={!!mods[k]} onChange={(v) => setMod(k, v)} />
          ))}
        </Row>
      </Card>

      <Card>
        <H2>{L('Cuenta Zelle de la tienda', 'Store Zelle account')}</H2>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Correo o teléfono Zelle', 'Zelle email or phone')} value={f.zelle_dato} onChangeText={set('zelle_dato')} autoCapitalize="none" />
          <Field label={L('Nombre que ve el cliente en Zelle', 'Name the customer sees in Zelle')} value={f.zelle_nombre} onChangeText={set('zelle_nombre')} />
        </Row>
      </Card>

      <Card>
        <H2>{L('Datos de la tienda', 'Store details')}</H2>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Nombre', 'Name')} value={f.nombre} onChangeText={set('nombre')} />
          <Field label={L('Teléfono', 'Phone')} value={f.telefono} onChangeText={set('telefono')} keyboardType="phone-pad" />
        </Row>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={L('Dirección', 'Address')} value={f.direccion} onChangeText={set('direccion')} />
          <Field label={L('Ciudad', 'City')} value={f.ciudad} onChangeText={set('ciudad')} />
        </Row>
        <Field label={L('Horario', 'Hours')} value={f.horario} onChangeText={set('horario')} />
        <Field label={L('Descripción', 'Description')} value={f.descripcion} onChangeText={set('descripcion')} multiline />
        {admin ? (
          <Row style={{ alignItems: 'flex-start' }}>
            <Toggle label={L('Tienda activa (visible para clientes)', 'Active store (visible to customers)')} value={!!f.activo} onChange={(v) => setF((p) => ({ ...p, activo: v }))} />
            <Field label={L('Orden', 'Order')} value={String(f.orden ?? 0)} onChangeText={(v) => setF((p) => ({ ...p, orden: Number(v) || 0 }))} keyboardType="number-pad" style={{ maxWidth: 120 }} />
          </Row>
        ) : null}
      </Card>

      <Card>
        <H2>{L('Formas de entrega', 'Delivery options')}</H2>
        <Row gap={10} style={{ alignItems: 'stretch' }}>
          <Toggle icon="store" label={L('Recoger en tienda', 'Pick up in store')} value={!!del.pickup} onChange={(v) => setDel({ pickup: v })} />
          <Toggle icon="car" label={L('Sin bajar del carro', 'Curbside')} value={!!del.curb} onChange={(v) => setDel({ curb: v })} />
          <Toggle icon="truck" label={L('A domicilio', 'Home delivery')} value={!!del.home} onChange={(v) => setDel({ home: v })} />
        </Row>
        <Field label={L('Horarios para recoger (separados por coma)', 'Pickup times (comma separated)')} value={del.slots} onChangeText={(v) => setDel({ slots: v })} />
        {del.home ? (
          <Row style={{ alignItems: 'flex-start' }}>
            <Field label={L('Cargo a domicilio (USD)', 'Delivery fee (USD)')} value={String(del.homeFee)} onChangeText={(v) => setDel({ homeFee: v as unknown as number })} keyboardType="decimal-pad" />
            <Field label={L('Gratis desde (USD, 0 = nunca)', 'Free from (USD, 0 = never)')} value={String(del.freeOver)} onChangeText={(v) => setDel({ freeOver: v as unknown as number })} keyboardType="decimal-pad" />
            <Field label={L('Códigos postales (vacío = todos)', 'ZIP codes (empty = all)')} value={del.zips} onChangeText={(v) => setDel({ zips: v })} />
          </Row>
        ) : null}
      </Card>

      {mods.svc && services ? (
        <Card>
          <H2>{L('Servicios que ofrece esta tienda', 'Services this store offers')}</H2>
          <Row gap={10} style={{ alignItems: 'stretch' }}>
            {services.filter((sv) => sv.activo).map((sv) => {
              const on = !(f.svc_off || []).includes(sv.id);
              return (
                <Toggle key={sv.id} icon={sv.icon} label={nm(sv)} value={on}
                  onChange={(v) => setF((p) => ({ ...p, svc_off: v ? (p.svc_off || []).filter((x) => x !== sv.id) : [...(p.svc_off || []), sv.id] }))} />
              );
            })}
          </Row>
        </Card>
      ) : null}

      {err ? <Note kind="red">{err}</Note> : null}
      {msg ? <Note kind="blue" icon="check">{msg}</Note> : null}
      <Btn title={L('Guardar cambios', 'Save changes')} onPress={save} loading={busy} style={{ alignSelf: 'flex-start' }} />
    </>
  );
}
