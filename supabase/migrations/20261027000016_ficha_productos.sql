-- Ficha de producto: especificaciones con estructura, más fotos y ficha técnica (PDF o imagen)
alter table public.products add column if not exists specs jsonb not null default '[]';   -- [{ "k": "Pantalla", "v": "6.5 pulgadas" }, ...]
alter table public.products add column if not exists fotos text[] not null default '{}';  -- fotos extra (la principal sigue en foto_url)
alter table public.products add column if not exists ficha_url text;                     -- ficha técnica: PDF o imagen
alter table public.products add column if not exists ficha_name text not null default '';

-- Ejemplos en los celulares de muestra (solo si aún no tienen datos)
update public.products set specs = '[
  {"k": "Pantalla", "v": "6.5 pulgadas Super AMOLED"},
  {"k": "Memoria RAM", "v": "4 GB"},
  {"k": "Almacenamiento", "v": "128 GB (ampliable con microSD)"},
  {"k": "Cámara principal", "v": "50 MP"},
  {"k": "Cámara frontal", "v": "13 MP"},
  {"k": "Batería", "v": "5,000 mAh, carga rápida 25 W"},
  {"k": "Sistema", "v": "Android 14"},
  {"k": "Red", "v": "4G LTE"},
  {"k": "Doble SIM", "v": "Sí"}
]'::jsonb
where modelo = 'Galaxy A15' and specs = '[]'::jsonb;

update public.products set specs = '[
  {"k": "Pantalla", "v": "6.5 pulgadas, 120 Hz"},
  {"k": "Memoria RAM", "v": "8 GB"},
  {"k": "Almacenamiento", "v": "256 GB"},
  {"k": "Cámara principal", "v": "50 MP con estabilizador"},
  {"k": "Cámara frontal", "v": "16 MP"},
  {"k": "Batería", "v": "5,000 mAh, carga rápida 30 W"},
  {"k": "Sistema", "v": "Android 14"},
  {"k": "Red", "v": "5G"},
  {"k": "Doble SIM", "v": "Sí"}
]'::jsonb
where modelo = 'Moto G54' and specs = '[]'::jsonb;
