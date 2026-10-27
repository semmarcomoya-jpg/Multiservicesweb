import { useSyncExternalStore } from 'react';

import type { Mode, OrderDataItem, OrderItem } from './types';

/** Lo que el cliente armó antes de pagar (envío o servicio). Vive solo en memoria. */
export type PayDraft =
  | { kind: 'send'; storeId: string; beneficiaryId: string; beneficiaryName: string; monto: number; fee: number; rate: number; mxn: number }
  | {
      kind: 'service';
      storeId: string;
      serviceId: string;
      serviceName: { es: string; en: string };
      icon: string;
      option: number | null;
      optionLabel: string;
      amount: number | null;
      base: number;
      fee: number;
      data: OrderDataItem[];
      entrega: { mode: Mode; time?: string; address?: string; zip?: string };
    }
  | { kind: 'shop'; storeId: string; items: OrderItem[]; subtotal: number; fee: number; entrega: { mode: Mode; time?: string; address?: string; zip?: string } };

let current: PayDraft | null = null;
const subs = new Set<() => void>();

export const setDraft = (d: PayDraft | null) => {
  current = d;
  subs.forEach((f) => f());
};
export const getDraft = () => current;
export const useDraft = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => current,
    () => current,
  );
