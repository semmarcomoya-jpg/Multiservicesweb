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
  abierta: boolean;
  aviso_cerrada: string;
  orden: number;
  loyalty?: Loyalty;
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
  destacados_modo?: 'auto' | 'manual';
  credit?: CreditCfg;
  id_types?: Record<string, boolean>;
  redes?: string;
  terms_es?: string;
  terms_en?: string;
  help_wa?: string;
  help_mail?: string;
}
export interface CreditCfg { on: boolean; layaway: boolean; freqs: Record<'semanal' | 'quincenal' | 'mensual', boolean>; nList: string; minDown: number; rate: number; lateFee: number; grace: number; minPrice: number; layDays: number }

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
  channel?: 'app' | 'store';
  pay_method?: string;
  discount?: number;
  reward_name?: string;
  reward_pts?: number;
  plan_id?: string | null;
  inst?: number | null;
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
  items: OrderItem[] | null;
  paid_at: string | null;
  corte_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderEvent { id: number; order_id: string; act: string; by_name: string; created_at: string }

export interface Employee { id: string; store_id: string | null; nombre: string; rol: 'tienda' | 'admin'; activo: boolean }

export interface OrderItem { product_id: string; variant_id: string; name: string; label: string; qty: number; price: number }

export interface Family { id: string; es: string; en: string; icon: string; orden: number }
export interface Variant { id: string; product_id: string; label: string; price: number; stock: number; activo: boolean; orden: number }
export interface Product {
  id: string;
  store_id: string;
  family_id: string;
  marca: string;
  modelo: string;
  descripcion: string;
  compat: string;
  foto_url: string | null;
  activo: boolean;
  orden: number;
  product_variants: Variant[];
}

export interface Corte {
  id: string;
  store_id: string;
  desde: string | null;
  hasta: string;
  employee_name: string;
  n_orders: number;
  total: number;
  fees: number;
  resumen: { por_tipo: Record<string, { n: number; total: number }>; por_empleado: Record<string, { n: number; total: number }> };
  notas: string;
  created_at: string;
}

export type StoryLink = 'none' | 'product' | 'service' | 'send' | 'shop';
export interface Story {
  id: string;
  store_id: string | null;
  media_url: string;
  media_type: 'image' | 'video';
  caption_es: string | null;
  caption_en: string | null;
  link_type: StoryLink;
  link_id: string | null;
  starts_at: string;
  expires_at: string | null;
  sort_order: number;
  views: number;
  created_at: string;
}

export type WallMode = 'pattern' | 'color' | 'image';
export interface Frame { x: number; y: number; z: number }
export interface WallCfg { mode: WallMode; color: string; img: string | null }
export interface Brand {
  nombre: string;
  corto: string;
  logo_url?: string | null;
  cover_url?: string | null;
  cover_title_es?: string;
  cover_title_en?: string;
  cover_sub_es?: string;
  cover_sub_en?: string;
  home_bg_url?: string | null;
  /** Encuadre de las fotos: x/y en % (0–100, 50 = centro) y zoom (1–3) */
  cover_pos?: Frame;
  home_pos?: Frame;
  walls?: Partial<Record<'home' | 'send' | 'shop' | 'pts' | 'profile' | 'community', WallCfg>>;
}
export interface Promo {
  id: string;
  title_es: string;
  title_en: string;
  sub_es: string;
  sub_en: string;
  go: 'shop' | 'send' | 'services' | 'none';
  theme: 'shop' | 'send' | 'pts';
  img_url: string | null;
  activo: boolean;
  orden: number;
}

export interface Featured { id: string; kind: 'product' | 'service'; ref_id: string; orden: number }
export interface TopSeller { kind: 'product' | 'service'; ref_id: string; veces: number; total: number }

export interface Rating {
  id: string;
  order_id: string;
  user_id: string;
  store_id: string;
  employee_id: string | null;
  employee_name: string;
  stars: number;
  tags: string[];
  comment: string;
  followed_up: boolean;
  followed_by: string;
  followed_at: string | null;
  created_at: string;
}
export type PostKind = 'reco' | 'prod' | 'promo' | 'sug' | 'store' | 'aviso';
export interface PostReply { id: string; post_id: string; user_id: string | null; author_name: string; author_foto: string | null; is_store: boolean; hidden: boolean; hide_reason: string; text: string; created_at: string }
export interface Post {
  id: string;
  store_id: string | null;
  user_id: string | null;
  author_name: string;
  author_foto: string | null;
  kind: PostKind;
  stars: number;
  text: string;
  ref_type: 'product' | 'service' | null;
  ref_id: string | null;
  ref_label: string;
  likes: number;
  hidden: boolean;
  hide_reason: '' | 'ofensivo' | 'spam' | 'datos' | 'otro';
  hidden_by: string;
  photo_url: string | null;
  verified: boolean;
  reports: number;
  created_at: string;
  post_replies?: PostReply[];
}

export interface Notif { id: string; user_id: string; kind: string; title: string; body: string; link: string; ref_id: string | null; read_at: string | null; created_at: string }
export interface StoreScore { store_id: string; promedio: number; total: number }

export interface Reward { id: string; es: string; en: string; pts: number; type: 'fee' | 'off'; value: number }
export interface Loyalty { on: boolean; perTx: number; per100: number; bday: number; postPts?: number; rewards: Reward[] }
export interface LedgerRow { id: number; user_id: string; store_id: string; pts: number; kind: string; motivo: string; order_id: string | null; by_name: string; created_at: string }
export interface Member { user_id: string; nombre: string; member_code: string; telefono: string; foto_url: string | null; id_status: string; puntos: number; planes: number; credito_on: boolean; credito_limite: number }
export interface PlanPayment { plan_id: string; i: number; due: string; amount: number; paid_at: string | null; method: string; by_name: string; order_id: string | null }
export interface Plan {
  id: string; folio: string; kind: 'credito' | 'apartado'; user_id: string; store_id: string; product_id: string | null; variant_id: string | null;
  item_name: string; item_label: string; price: number; down: number; n: number; freq: 'semanal' | 'quincenal' | 'mensual'; rate: number; total_fin: number;
  status: 'solicitado' | 'activo' | 'rechazado' | 'liquidado' | 'cancelado'; cliente_nombre: string; cliente_code: string; approved_by: string; reject_reason: string; created_at: string;
  plan_payments?: PlanPayment[];
}
export interface CreditLine { user_id: string; store_id: string; on: boolean; limite: number; by_name: string }
export interface Customer { user_id: string; nombre: string; member_code: string; telefono: string; foto_url: string | null; id_status: string; favorita: boolean; pedidos: number; gastado: number; ultimo: string | null; puntos: number; planes: number; credito_on: boolean; credito_limite: number }
export interface IdDocRow { user_id: string; nombre: string; member_code: string; fecha_nac: string | null; id_status: string; tipo: string; front_path: string; back_path: string; submitted_at: string; reviewed_by: string; reviewed_at: string | null; note: string }
