# Castillo Multiservices

App web y móvil (Expo) para las tiendas multiservicios Castillo: envíos de dinero a México, pago de servicios y trámites, con pago por Zelle, panel de tienda y panel de administrador. Bilingüe (español / inglés).

**Fase 1 (este repositorio):**

- Clientes: registro, perfil con número de cliente, beneficiarios, envíos a México con tipo de cambio, catálogo de servicios con datos dinámicos (sin texto libre), entrega digital / en tienda / sin bajar del carro / a domicilio, pago con captura de Zelle, seguimiento del pedido en tiempo real y comprobante.
- Productos: catálogo por tienda (familia, marca, modelo, variantes con precio y existencias), carrito, entrega y pago con Zelle. La tienda **prende o apaga** cada producto y cada variante; si se rechaza un pago, las existencias regresan solas.
- Tienda: interruptor para **abrir o cerrar la tienda** (cerrada no recibe pedidos nuevos y muestra un aviso), pedidos en tiempo real, resumen por tipo con totales, clave de empleado para tomar cada pedido, verificación del pago, código de entrega, comprobante, bitácora. "Mi tienda": Zelle, funciones que se prenden o apagan, formas de entrega y servicios que ofrece.
- **Historias tipo TikTok** (igual que Viva): el administrador (para todas las tiendas) o cada tienda (para la suya) sube fotos o videos verticales con texto en español/inglés, botón de acción (producto, servicio, enviar dinero o tienda) y duración de 24 h, 3 días, 7 días o destacada. Los clientes las ven en Inicio con aro de color si no las han visto y se abren solas al entrar, una vez por visita. Cuenta vistas.
- **Ventas y corte:** informe de lo cobrado por la app desde el último corte (por tipo, por empleado, productos vendidos y detalle por folio), descarga para Excel (CSV) e impresión. "Hacer corte" con la clave del empleado guarda el corte y su historial.
- Administrador: abrir o cerrar cualquier tienda, ventas por tienda y tipo, catálogo de servicios con ícono y campos, tiendas, tipo de cambio y límites, empleados con clave cifrada, cuentas y roles, verificación de identificación.

**Fase 2 (pendiente):** crédito y apartado, mostrador con tarjeta QR (ventas en efectivo y tarjeta en el corte), puntos de lealtad, boca a boca, calificaciones por empleado.

## Tecnología

- Expo SDK 58 + Expo Router (web, Android y iPhone con el mismo código) · TypeScript
- Supabase: Postgres con seguridad por filas (RLS), Auth, Storage y Realtime
- Los montos, límites y cambios de estado se validan en el servidor (funciones SQL), no en la app.

## 1. Preparar Supabase

1. En tu proyecto de Supabase abre **SQL Editor** y ejecuta, en orden:
   - `supabase/migrations/20261026000001_fase1_esquema.sql`
   - `supabase/migrations/20261026000002_fase1_datos_iniciales.sql`
   - `supabase/migrations/20261026000003_productos_y_corte.sql`
   - `supabase/migrations/20261027000004_historias.sql`
   (o con la CLI: `supabase link` y `supabase db push`).
2. **Authentication → URL Configuration:** pon como *Site URL* la dirección donde publicarás la app (por ejemplo `https://semmarcomoya-jpg.github.io/Multiservicesweb/`) y agrégala también en *Redirect URLs*.
3. Crea tu cuenta desde la app ("Crear mi cuenta") y conviértete en administrador ejecutando en SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'TU-CORREO');
   ```
4. Entra de nuevo: verás el panel de administrador. **Cambia las claves de ejemplo** en Admin → Empleados (Sandra 1111, Marco 2222, Luis 3333, Ana 4444, Administrador 9999).
5. Cada sucursal crea su cuenta en la app y tú le asignas el rol **Tienda** y su sucursal en Admin → Cuentas.

## 2. Correr en tu computadora

```bash
npm install
cp .env.example .env      # pega la URL y la anon key de Supabase (Project Settings → API)
npx expo start            # w = navegador, o escanea el QR con Expo Go
```

Revisar tipos: `npm run typecheck` · Exportar la web: `npm run build:web` (genera `dist/`).

> Nunca pongas la **service_role key** en la app ni en el repositorio. La anon key es pública y segura gracias a RLS.

## 3. Publicar la web en GitHub Pages

1. En el repositorio: **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → New repository secret:**
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Cada push a `main` publica la app en `https://<cuenta>.github.io/<repositorio>/` (flujo `.github/workflows/deploy-web.yml`).

## 4. Apps de Android y iPhone

Con EAS: `npx eas-cli@latest build -p android` / `-p ios` (necesitas cuenta de Expo; para iPhone, cuenta de Apple Developer). Configura las mismas variables `EXPO_PUBLIC_*` en EAS.

## Estructura

```
src/app/            pantallas (Expo Router)
  (cliente)/        pestañas del cliente: inicio, enviar, servicios, pedidos, perfil
  servicio/[id]     pedir un servicio        pago            pago con Zelle
  pedido/[id]       seguimiento              beneficiarios/  a quién se envía
  tienda/           modo tienda              admin/          administración
src/components/     interfaz compartida (botones, campos, resumen, formularios)
src/lib/            Supabase, sesión, idioma, tipos, reglas compartidas
supabase/migrations esquema, seguridad y datos iniciales
```

## Avisos legales

Los envíos de dinero están regulados (licencias estatales de transmisor de dinero, FinCEN). Las ventas a plazos de la fase 2 tienen reglas estatales y federales. Revisa límites y procesos con tu proveedor y un asesor legal. La app nunca pide estatus migratorio.
