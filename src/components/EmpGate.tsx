/** "¿Quién atiende el mostrador?": la clave del empleado, una vez por turno, para registrar todo a su nombre. */
import React, { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { Btn, Card, Field, H2, Note, P, Row } from '@/components/ui';
import { endShift, startShift, useEmp } from '@/lib/emp';
import { digits } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { errMsg } from '@/lib/supabase';
import { C } from '@/lib/theme';

export function EmpGate({ storeId, children }: { storeId: string; children: React.ReactNode }) {
  const { L } = useLang();
  const emp = useEmp(storeId);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!emp)
    return (
      <Card>
        <H2>{L('¿Quién atiende el mostrador?', 'Who is at the counter?')}</H2>
        <P small muted>{L('Escribe tu clave para registrar ventas, abonos y aprobaciones a tu nombre.', 'Enter your code to record sales, payments and approvals under your name.')}</P>
        <Row style={{ alignItems: 'flex-end' }}>
          <Field label={L('Clave de empleado', 'Employee code')} value={pin} onChangeText={(v) => setPin(digits(v))} secure keyboardType="number-pad" maxLength={6} style={{ maxWidth: 260 }} />
          <Btn
            title={L('Entrar', 'Enter')}
            loading={busy}
            disabled={pin.length < 4}
            onPress={async () => {
              setBusy(true);
              setErr('');
              try {
                await startShift(storeId, pin);
                setPin('');
              } catch (e) {
                setErr(errMsg(e));
              }
              setBusy(false);
            }}
          />
        </Row>
        {err ? <Note kind="red">{err}</Note> : null}
      </Card>
    );
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: C.blueSoft }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontWeight: '900', color: C.ink }}>{emp.nombre.charAt(0)}</Text>
        </View>
        <Text style={{ flex: 1, fontWeight: '800', color: C.blueInk }}>{L('Atiende: ', 'At the counter: ') + emp.nombre}</Text>
        <Btn small kind="ghost" title={L('Cambiar', 'Switch')} onPress={endShift} />
      </View>
      {children}
    </>
  );
}
