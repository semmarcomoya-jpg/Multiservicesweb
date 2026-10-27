-- =====================================================================
-- Castillo Multiservices · Datos iniciales (puedes editarlos después desde el panel de administrador)
-- =====================================================================

insert into public.service_categories (id, es, en, icon, orden) values
  ('rec', 'Recargas y planes',   'Top-ups & plans',      'phone', 1),
  ('pag', 'Pago de servicios',   'Bill payments',        'bolt',  2),
  ('tec', 'Servicio técnico',    'Phone setup & repair', 'tool',  3),
  ('tra', 'Trámites',            'Paperwork',            'doc',   4),
  ('paq', 'Paquetería a México', 'Parcels to Mexico',    'box',   5)
on conflict (id) do nothing;

insert into public.stores (id, nombre, direccion, ciudad, horario, telefono, zelle_dato, zelle_nombre, orden, delivery) values
  ('11111111-1111-4111-8111-111111111111', 'Castillo · Sucursal Centro',   '[dirección]', 'Houston, TX',  'Lun a Sáb 9:00–20:00', '[teléfono]', '[Zelle de Centro]',   'Castillo Multiservices', 1,
   '{"pickup":true,"curb":true,"home":true,"homeFee":5,"freeOver":150,"slots":"10:00, 12:00, 14:00, 16:00, 18:00","zips":""}'),
  ('22222222-2222-4222-8222-222222222222', 'Castillo · Sucursal Norte',    '[dirección]', 'Houston, TX',  'Lun a Dom 10:00–19:00', '[teléfono]', '[Zelle de Norte]',    'Castillo Multiservices', 2,
   '{"pickup":true,"curb":true,"home":true,"homeFee":5,"freeOver":150,"slots":"11:00, 13:00, 15:00, 17:00","zips":""}'),
  ('33333333-3333-4333-8333-333333333333', 'Castillo · Sucursal Pasadena', '[dirección]', 'Pasadena, TX', 'Lun a Sáb 9:00–19:00', '[teléfono]', '[Zelle de Pasadena]', 'Castillo Multiservices', 3,
   '{"pickup":true,"curb":true,"home":false,"homeFee":0,"freeOver":0,"slots":"10:00, 13:00, 16:00","zips":""}')
on conflict (id) do nothing;

insert into public.services (cat_id, es, en, desc_es, desc_en, icon, price_type, base, amounts, options, fee, fields, modes, eta_es, eta_en, orden) values
  ('rec', 'Recarga Telcel', 'Telcel top-up', 'Saldo para cualquier número Telcel en México.', 'Credit for any Telcel number in Mexico.',
   'phone', 'amount', 0, '{10,20,30,50}', '[]', 0,
   '[{"k":"num","es":"Número a 10 dígitos","en":"10-digit number","type":"tel","digits":10}]', '{digital}', 'Al momento', 'Right away', 1),
  ('rec', 'Recarga de celular en EE.UU.', 'U.S. phone refill', 'AT&T, T-Mobile, Cricket o Boost.', 'AT&T, T-Mobile, Cricket or Boost.',
   'sim', 'amount', 0, '{25,40,50,60}', '[]', 0,
   '[{"k":"co","es":"Compañía","en":"Carrier","type":"select","opts":"AT&T, T-Mobile, Cricket, Boost"},{"k":"num","es":"Número a 10 dígitos","en":"10-digit number","type":"tel","digits":10}]', '{digital}', 'Al momento', 'Right away', 2),
  ('pag', 'Pagar luz o agua (EE.UU.)', 'Pay power or water (U.S.)', 'Pagamos tu recibo y te mandamos el comprobante.', 'We pay your bill and send you the receipt.',
   'drop', 'amount', 0, '{}', '[]', 2,
   '[{"k":"co","es":"Compañía","en":"Company","type":"select","opts":"CenterPoint, Reliant, TXU Energy, Agua de la ciudad"},{"k":"acc","es":"Número de cuenta","en":"Account number","type":"text"},{"k":"bill","es":"Foto del recibo (opcional)","en":"Photo of the bill (optional)","type":"photo","optional":true}]', '{digital}', 'El mismo día', 'Same day', 3),
  ('pag', 'Pagar CFE en México', 'Pay CFE (Mexico power)', 'Paga la luz de tu familia en México.', 'Pay your family''s power bill in Mexico.',
   'bolt', 'amount', 0, '{}', '[]', 3,
   '[{"k":"svc","es":"Número de servicio (12 dígitos)","en":"Service number (12 digits)","type":"tel","digits":12},{"k":"name","es":"Nombre del titular","en":"Account holder","type":"text"}]', '{digital}', '24 horas', '24 hours', 4),
  ('tec', 'Configurar celular nuevo', 'New phone setup', 'Pasamos tus contactos, fotos y WhatsApp a tu celular nuevo.', 'We move your contacts, photos and WhatsApp to your new phone.',
   'tool', 'fixed', 20, '{}', '[]', 0,
   '[{"k":"model","es":"Modelo de tu celular","en":"Your phone model","type":"text"}]', '{store,home}', '45 minutos', '45 minutes', 5),
  ('tec', 'Cambio de mica', 'Screen protector install', 'Mica de vidrio templado colocada en tienda.', 'Tempered glass protector installed in store.',
   'shield', 'fixed', 10, '{}', '[]', 0,
   '[{"k":"model","es":"Modelo de tu celular","en":"Your phone model","type":"text"}]', '{store,curb}', '15 minutos', '15 minutes', 6),
  ('tra', 'Traducción de acta', 'Certificate translation', 'Traducción al inglés lista para trámite.', 'English translation ready for official use.',
   'doc', 'options', 0, '{}', '[{"es":"1 hoja","en":"1 page","p":25},{"es":"2 hojas","en":"2 pages","p":40}]', 0,
   '[{"k":"doc","es":"Foto del documento","en":"Photo of the document","type":"photo"}]', '{digital,store}', '24 horas', '24 hours', 7),
  ('paq', 'Caja a México', 'Box to Mexico', 'Mandamos tu caja hasta la puerta de tu familia.', 'We ship your box to your family''s door.',
   'box', 'options', 0, '{}', '[{"es":"Chica (hasta 10 kg)","en":"Small (up to 22 lb)","p":45},{"es":"Mediana (hasta 20 kg)","en":"Medium (up to 44 lb)","p":65},{"es":"Grande (hasta 30 kg)","en":"Large (up to 66 lb)","p":90}]', 0,
   '[{"k":"dest","es":"Ciudad y estado de destino","en":"Destination city and state","type":"text"},{"k":"who","es":"Quién recibe","en":"Recipient","type":"text"}]', '{store,home}', '7 a 10 días', '7 to 10 days', 8);

-- Empleados de ejemplo. CAMBIA ESTAS CLAVES desde Admin → Empleados antes de usar la app en serio.
insert into public.employees (store_id, nombre, rol, pin_hash) values
  ('11111111-1111-4111-8111-111111111111', 'Sandra', 'tienda', extensions.crypt('1111', extensions.gen_salt('bf'))),
  ('11111111-1111-4111-8111-111111111111', 'Marco',  'tienda', extensions.crypt('2222', extensions.gen_salt('bf'))),
  ('22222222-2222-4222-8222-222222222222', 'Luis',   'tienda', extensions.crypt('3333', extensions.gen_salt('bf'))),
  ('33333333-3333-4333-8333-333333333333', 'Ana',    'tienda', extensions.crypt('4444', extensions.gen_salt('bf'))),
  (null,                                   'Administrador', 'admin', extensions.crypt('9999', extensions.gen_salt('bf')));
