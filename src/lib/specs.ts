/** Especificaciones de producto: campos sugeridos por familia y su traducción. */
export interface Spec { k: string; v: string }

/** [español, inglés] — los nombres se guardan en español y se traducen al mostrar. */
export const SPEC_TEMPLATES: Record<string, [string, string][]> = {
  cel: [
    ['Pantalla', 'Screen'],
    ['Memoria RAM', 'RAM'],
    ['Almacenamiento', 'Storage'],
    ['Cámara principal', 'Main camera'],
    ['Cámara frontal', 'Front camera'],
    ['Batería', 'Battery'],
    ['Procesador', 'Processor'],
    ['Sistema', 'Operating system'],
    ['Red', 'Network'],
    ['Doble SIM', 'Dual SIM'],
    ['Garantía', 'Warranty'],
  ],
  acc: [
    ['Tipo', 'Type'],
    ['Material', 'Material'],
    ['Color', 'Color'],
    ['Conexión', 'Connection'],
    ['Batería', 'Battery'],
    ['Garantía', 'Warranty'],
  ],
  chip: [
    ['Compañía', 'Carrier'],
    ['Datos', 'Data'],
    ['Minutos y mensajes', 'Talk & text'],
    ['Llamadas a México', 'Calls to Mexico'],
    ['Vigencia', 'Valid for'],
    ['Cobertura', 'Coverage'],
  ],
  reg: [
    ['Monto', 'Amount'],
    ['Dónde se usa', 'Where to use'],
    ['Vigencia', 'Valid for'],
  ],
  otro: [
    ['Material', 'Material'],
    ['Medidas', 'Size'],
    ['Peso', 'Weight'],
    ['Garantía', 'Warranty'],
  ],
};

const EN: Record<string, string> = Object.fromEntries(Object.values(SPEC_TEMPLATES).flat());

export const specLabel = (k: string, lang: 'es' | 'en') => (lang === 'en' ? EN[k] || k : k);
export const templateFor = (family: string) => SPEC_TEMPLATES[family] || SPEC_TEMPLATES.otro;
export const cleanSpecs = (s: Spec[] | null | undefined) => (s || []).map((x) => ({ k: String(x.k || '').trim(), v: String(x.v || '').trim() })).filter((x) => x.k && x.v);
