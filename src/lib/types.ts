export type Role = 'cliente' | 'tienda' | 'admin';
export type Mode = 'digital' | 'store' | 'curb' | 'home';
export type OrderStatus = 'verificar' | 'proceso' | 'completado' | 'rechazado';

export interface Profile {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  fecha_nac: string | null;
  foto_url: string | null;
  idioma: 'es' | 'en';
  member_code: string | null;
  role: Role;
  store_id: string | null;
  id_status: 'ninguna' | 'pendiente' | 'verificada' | 'rechazada';
}

export interface StoreMods { send: boolean; svc: boolean; shop: boolean; credit: boolean; layaway: boolean; comm: boolean }
export interface StoreDelivery { pickup: boolean; curb: boolean; home: boolean; homeFee: number; freeOver: number; slots: string; zips: string }

export interface Store {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  horario: string;
  telefono: string;
  descripcion: string;
  zelle_dato: string;
  zelle_nombre: string;
  fotos: string[];
  mods: StoreMods;
  delivery: StoreDelivery;
  svc_off: string[];
  activo: boolean;
  orden: number;
}

export interface Category { id: string; es: string; en: string; icon: string; orden: number }

export type FieldType = 'text' | 'tel' | 'select' | 'photo';
export interface ServiceField { k: string; es: string; en: string; type: FieldType; opts?: string; digits?: number | string; optional?: boolean }
export interface ServiceOption { es: string; en: string; p: number | string }

export interface Service {
  id: string;
  cat_id: string;
  es: string;
  en: string;
  desc_es: string;
  desc_en: string;
  icon: string;
  price_type: 'fixed' | 'amount' | 'options';
  base: number;
  amounts: number[];
  options: ServiceOption[];
  fee: number;
  fields: ServiceField[];
  modes: Mode[];
  eta_es: string;
  eta_en: string;
  points: boolean;
  activo: boolean;
  orden: number;
}

export interface Settings {
  id: number;
  exchange_rate: number;
  rate_updated_at: string;
  send_fee: number;
  limit_l1: number;
  limit_l2: number;
  proveedor: string;
  brand: { nombre: string; corto: string };
}

export interface Beneficiary {
  id: string;
  user_id: string;
  nombre: string;
  apellidos: string;
  parentesco: string;
  telefono: string;
  estado: string;
  ciudad: string;
  metodo: 'cuenta' | 'efectivo';
  banco: string;
  cuenta: string;
  red: string;
}

export interface OrderDataItem { k: string; es: string; en: string; type: FieldType; value: string }

export interface Order {
  id: string;
  folio: string;
  user_id: string;
  store_id: string;
  kind: 'send' | 'service' | 'shop' | 'abono';
  service_id: string | null;
  service_name: { es: string; en: string; icon: string; cat: string; opcion: { es: string; en: string } | null } | null;
  data: OrderDataItem[];
  beneficiary: Beneficiary | null;
  monto: number;
  fee: number;
  total: number;
  rate: number | null;
  mxn: number | null;
  status: OrderStatus;
  captura_path: string | null;
  ticket_path: string | null;
  folio_prov: string;
  entrega: { mode: Mode; time?: string | null; address?: string | null; zip?: string | null; arrived?: boolean } | null;
  code: string | null;
  attended_by: string | null;
  attended_name: string | null;
  cliente_nombre: string;
  cliente_code: string;
  zelle_nombre: string;
  reject_reason: string;
  created_at: string;
  updated_at: string;
}

export interface OrderEvent { id: number; order_id: string; act: string; by_name: string; created_at: string }

export interface Employee { id: string; store_id: string | null; nombre: string; rol: 'tienda' | 'admin'; activo: boolean }
