/** Crédito y apartado: estado del plan, nombres y vista previa del calendario. */
import type { CreditCfg, Plan, PlanPayment } from './types';

export const DEFAULT_CREDIT: CreditCfg = { on: true, layaway: true, freqs: { semanal: true, quincenal: true, mensual: true }, nList: '4, 6, 8, 12', minDown: 20, rate: 0, lateFee: 5, grace: 3, minPrice: 50, layDays: 60 };
export const today = () => new Date().toISOString().slice(0, 10);
export const pays = (p: Plan) => (p.plan_payments || []).slice().sort((a, b) => a.i - b.i);
export const nextPay = (p: Plan) => pays(p).find((x) => !x.paid_at);
export const planLeft = (p: Plan) => pays(p).filter((x) => !x.paid_at).reduce((a, x) => a + Number(x.amount), 0);
export type PlanState = 'solicitado' | 'corriente' | 'atrasado' | 'liquidado' | 'rechazado' | 'cancelado';
export function planState(p: Plan): PlanState {
  if (p.status !== 'activo') return p.status as PlanState;
  const nx = nextPay(p);
  if (!nx) return 'liquidado';
  return nx.due.slice(0, 10) < today() ? 'atrasado' : 'corriente';
}
export const nOptions = (cfg: CreditCfg) => String(cfg.nList || '').split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => x > 0);
export const freqOn = (cfg: CreditCfg) => (['semanal', 'quincenal', 'mensual'] as const).filter((f) => cfg.freqs?.[f]);

/** Vista previa del calendario (la base lo vuelve a calcular al guardar). */
export function previewPlan(price: number, down: number, n: number, freq: 'semanal' | 'quincenal' | 'mensual', rate: number) {
  const fin = Math.round((price - down) * (1 + rate / 100) * 100) / 100;
  const each = Math.round((fin / n) * 100) / 100;
  const sched: Pick<PlanPayment, 'i' | 'due' | 'amount'>[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date();
    if (freq === 'mensual') d.setMonth(d.getMonth() + i);
    else d.setDate(d.getDate() + (freq === 'semanal' ? 7 : 14) * i);
    sched.push({ i, due: d.toISOString().slice(0, 10), amount: i === n ? Math.round((fin - each * (n - 1)) * 100) / 100 : each });
  }
  return { fin, each, sched };
}
