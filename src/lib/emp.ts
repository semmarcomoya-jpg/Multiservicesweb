/** Quién atiende el mostrador: el empleado escribe su clave una vez y queda "en turno" en este equipo. */
import { useSyncExternalStore } from 'react';

import { supabase } from './supabase';

export interface EmpSession { storeId: string; id: string; nombre: string; pin: string }
let cur: EmpSession | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export async function startShift(storeId: string, pin: string): Promise<EmpSession> {
  const { data, error } = await supabase.rpc('check_employee_pin', { p_store: storeId, p_pin: pin });
  if (error) throw error;
  const e = (data as { id: string; nombre: string }[] | null)?.[0];
  if (!e) throw new Error('Clave incorrecta o de otra sucursal');
  cur = { storeId, id: e.id, nombre: e.nombre, pin };
  emit();
  return cur;
}
export function endShift() {
  cur = null;
  emit();
}
export function useEmp(storeId: string | null | undefined) {
  const s = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => cur,
    () => cur,
  );
  return s && s.storeId === storeId ? s : null;
}
