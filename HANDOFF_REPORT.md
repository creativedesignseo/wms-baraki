# HANDOFF — WMS Baraki Logística

> Realidad **verificada** (no supuesta). Última actualización: 2026-06-20
> (pipeline local + deploy Vercel READY + rutas comprobadas en prod en vivo).

## 📍 Coordenadas (fijas — no volver a preguntar)

- **GitHub** (privado): https://github.com/creativedesignseo/wms-baraki · rama `feat/wms-mvp`.
- **Supabase**: ref `hiofgzfhmhcvajsbiolz` · https://hiofgzfhmhcvajsbiolz.supabase.co ·
  dashboard https://supabase.com/dashboard/project/hiofgzfhmhcvajsbiolz · ⚠️ en cuenta distinta a
  la del MCP (da "no permission"); free → se pausa a los ~7 días sin uso.
- **Vercel**: proyecto `wms` · https://vercel.com/creativedesignseo-gmailcoms-projects/wms ·
  prod **https://wms-delta-nine.vercel.app** · deploy `vercel --prod`.
- **IA**: OpenRouter `google/gemini-2.5-flash-lite` (NO DeepSeek) · UPCitemdb + OpenFoodFacts.

## En vivo ahora

- **URL producción:** https://wms-delta-nine.vercel.app
- **Código en vivo:** `e9e9c7e` (precio sugerido en Guardar + botón "Buscar precio IA"); los
  commits posteriores son solo docs (no afectan runtime). Repo: `creativedesignseo/wms-baraki`.
- **Deploy Vercel:** estado **● READY** · Production · alias `wms-delta-nine.vercel.app` activo.
- **Verificación 2026-06-20** (re-verificado, pipeline local + prod en vivo): `tsc`/`eslint`/
  `next build` limpios; `/login` 200 ✓, `/stow`·`/approval`·`/dashboard`·`/inventory` 307→login ✓;
  APIs `stow/scan`·`enrich`·`deep-price`·`withdraw/lookup` → 401 JSON ✓; Supabase auth 200 ✓
  (el proyecto se había pausado y el owner lo reactivó — ver "Incidencias").
- **Verificación 2026-06-12** (panel de 3 agentes + pipeline local):
  - `tsc` / `eslint` / `next build` → limpios.
  - **25 rutas comprobadas en prod**: 11 páginas (307 sin sesión ✓, login 200 ✓) y
    14 APIs. Detectado y CORREGIDO: 3 APIs (`products/identify`, `products/delete`,
    `admin/migrate-images`) devolvían 307/HTML en vez de 401/403 JSON (usaban
    `requireRole` con redirect en Route Handlers).
  - **BD real**: 46 ubicaciones con nivel poblado (N1:21, N2:17, N3:8) · migraciones
    0007/0008/0009 aplicadas · `stock_movements` VIVA (primer retiro auditado:
    12/06 00:38, Jonatan, Pollo Frito, AMB-16, −1, vendido) · 28 productos (17 con
    imagen espejada https, 10 sin imagen, 1 URL externa sin espejar) · 30 lotes
    (29 activos, 1 retirado) · 2 cuentas (owner + operator) · 3 estaciones activas.

## 🎯 Dirección del producto (aclarada por el owner 2026-06-20)

Esto NO es solo para un bodegón propio: es un **WMS que se va a VENDER** a almacenes/bodegones de
Venezuela. La propuesta de valor que lo hace vendible: **automatizar el precio de referencia** que
hoy el operario saca a mano (busca el código en Amazon/Walmart → ve el precio → fija el precio de
venta). Si el sistema consigue ese precio rápido y fiable, hay producto; si no, no se vende. NO hay
que anclarse a "Valencia, Venezuela" — el sistema gestiona y precia mercancía no inventariada para
cualquier almacén cliente.

### Estado real de la "búsqueda automática de precio" (sin humo)
- **YA EXISTE Y FUNCIONA**: el botón "Buscar precio (IA)" en Guardar usa OpenRouter
  (gemini-2.5-flash-lite + plugin web/Exa). Es "entrar a internet y buscar el precio", automático,
  **ya pagado** (saldo OpenRouter $4.98). Probado en vivo: Pizza Red Baron → $4.99 con fuentes reales.
- **LÍMITE real = fiabilidad, no capacidad.** El LLM a veces interpreta mal: EAN `3083681063349`
  es Bonduelle verduras congeladas (según OpenFoodFacts), pero la IA web dijo "Nesquik"
  (alucinación). El candado "solo con fuente" evita el precio inventado, pero el nombre puede fallar.
- **NO se necesita ninguna API nueva para que funcione.** SerpApi (Google Shopping) sería más
  fiable/estructurado, pero requiere cuenta/key del owner → el owner no puede/quiere gestionarla →
  **descartado por ahora**. (Pedirla fue fricción innecesaria.)

### Malentendido aclarado (raíz de la confusión del owner)
El asistente de desarrollo (Claude) busca en la web porque tiene herramientas; la **APP desplegada
es código autónomo** que necesita una herramienta para buscar — y **ya la tiene** (OpenRouter). No
es que "no pueda buscar": ya busca. Lo pendiente es **pulir la FIABILIDAD**, sin pedir nada al owner.

### ✅ HECHO (2026-06-21, commit d420144) — flujo precio/identificación más fiable
- **Red de seguridad del precio** (`StowClient`): poll acotado que re-lee `/api/stow/scan` hasta que
  el precio aparece (el server ya lo escribió) → arregla el "a veces sin precio" del fire-and-forget.
- **Checksum del código** (`isValidGtin` en `upc.ts`): el scan marca `barcode_suspect` y Guardar avisa
  "código mal escaneado" (distingue mal-escaneo de producto-no-existe).
- **Nombre desde marca+categoría** (`composeName` en `upc.ts`): cuando OFF trae marca+categoría sin
  `product_name`, construye "Bonduelle · Verduras congeladas" en vez de null.
- **LLM = traductor, no identificador** (prompts de `openrouter.ts`/`gemini.ts` endurecidos): NUNCA
  sustituye el producto ni inventa → mata el caso Bonduelle→Nesquik.
- **Búsqueda de precio anclada al código de barras** (`deepPriceSearch`): evita el producto cruzado.

### 📊 Hallazgos de medición en vivo (2026-06-21) — para decisiones de negocio
- **UPCitemdb cubre ~33%, NO el 99%** que se asumía. Cubre productos US populares; **europeos
  (Bonduelle, Barilla) y locales NO están** (es API estadounidense). OFF rescata identificación (no
  precio) → ~58% identificados. **→ el botón "Buscar precio IA" es necesario para la MAYORÍA, no un
  caso raro.** Si se quiere cobertura ALTA de precio automático, evaluar una **API de Google Shopping
  de pago** (SerpApi) — el dueño no puede gestionar otra API por ahora.
- **A/B `deepseek-v4-flash` vs `gemini-2.5-flash-lite`** (búsqueda de precio): deepseek existe y es
  más barato ($0.09/M), y **NO alucina — pero es DEMASIADO conservador** (devuelve null aunque haya
  fuente con precio, ej. Barilla en amazon.es). Gemini consigue más precios con el candado de fuente.
  **Decisión: se mantiene gemini-2.5-flash-lite.** Ambos reciben las mismas fuentes (las busca Exa).

### Pendiente (no bloqueante)
- Caché compartida por código de barras (abarata y escala multi-cliente: el 1er almacén que escanea un
  producto paga la búsqueda, los demás la reusan gratis). Es la palanca de eficiencia real.
- P2: unificar la UI de los dos precios + cablear `price_source` (la columna ya existe por 0010).
- Evaluar SerpApi (Google Shopping) si se quiere subir la cobertura de precio automático.

## 💰 Sistema de PRECIOS — núcleo EN VIVO (2026-06-20, commit 329bdb4)

Decisión del owner (2026-06-19): el precio sugerido es **precio de mercado internacional
en USD** (referencia, citando comercios) y el gerente fija el de venta. Ningún API da el
precio de góndola venezolano — eso es esperado, no un fallo.

> ✅ **CORRECCIÓN APLICADA (2026-06-20, commit a5f8c22): precio sugerido EN VIVO en Guardar.**
> El operario ve el **precio sugerido en grande** en el rail de producto de `StowClient` al
> escanear, junto a imagen + ubicación + cantidad. `scan` y `enrich` devuelven
> `suggested_price_usd`/`reference_price_usd`; el rail los pinta con procedencia honesta
> (sugerido de mercado / referencia aproximada / sin precio), y se actualiza en vivo cuando
> termina el enriquecimiento. **Decisión de roles del owner: el OPERARIO VE el precio** (rompe
> el viejo "operario = sin precios"). Verificado: tsc/eslint/build, deploy READY, /api/stow/scan
> 401 JSON.
> ✅ **Búsqueda Profunda EN GUARDAR (2026-06-20, commit e9e9c7e):** si un producto no tiene
> precio automático (offers), el operario pulsa **"Buscar precio (IA)"** en el rail → la IA
> con búsqueda web (OpenRouter+Exa) lo busca y lo sugiere CON fuentes citadas (enlace); sin
> fuente real, no rellena. `/api/deep-price` abierto a cualquier usuario autenticado del
> almacén (escribe solo SUGERENCIA, scoped por warehouse). Verificado en vivo (IA+UPCitemdb
> respondiendo; ej. Pizza Red Baron → $4.99 con 3 fuentes).
> **Pendiente sobre esto (no bloqueante):** (a) el operario VE el precio pero aún no lo
> EDITA/aprueba en Guardar; (b) falta mostrar el VES (requiere pasar la tasa a `StowClient`).

- **Fase 0 — precio inventado ELIMINADO.** Los prompts de IA (`gemini.ts`, `openrouter.ts`)
  ya NO piden `suggested_price_usd`; `enrich` ya no lo propaga. El precio nunca sale del LLM.
- **Fase 1 — precio real desde `offers[]` (gratis).** Nuevo `lib/price.ts`:
  `referencePriceFromOffers()` limpia (USD, >$0.05), recorta outliers con **MAD** (k=3) y
  devuelve la **MEDIANA** + comercios fuente + puerta de coherencia (n≥3 y dispersión≤60%).
  `upc.ts` usa esto en vez de `lowest_recorded_price` (basura: Coca-Cola daba $0). Validado
  con datos reales: Coca-Cola **$0→$9.99**, Pringles descarta packs $34–56 → **$3.49**.
  `enrich` pre-carga el sugerido SOLO si es coherente; si no, null y lo pone el gerente.
- **Fase 2 — números gigantes + procedencia.** `ApprovalClient`: precio USD/VES en grande
  (text-5xl/4xl, patrón del número de hueco); línea de procedencia honesta (verde=sugerido
  de mercado · ámbar=aproximado poca confianza · gris=sin referencia automática).

**Estado del sistema de precios:**
- **Fase 3 — Búsqueda Profunda: código EN VIVO (2026-06-20, commit d9ec86f).** Botón manual
  "Búsqueda profunda" en /approval (manager/owner) → `/api/deep-price` → `deepPriceSearch`
  de OpenRouter con el plugin web (Exa, ~$0.005/uso). **CANDADO**: sin `url_citation` real, el
  precio queda null (nunca inventa); persiste `suggested_price_usd` solo con fuente. Muestra
  las fuentes citadas con enlace. Resuelve el precio de productos de **OpenFoodFacts** sin
  offers (p.ej. el de la captura `5607047013403`). Verificado: `/api/deep-price` 401 JSON sin
  sesión. (La función real con búsqueda la prueba el owner con sesión de manager.)
  - ✅ **Migración 0010 EJECUTADA por el owner (2026-06-20)** (`supabase/migrations/0010_price_source.sql`):
    `price_source` + `price_sources` + backfill a 'manual' aplicados ("Success. No rows returned").
    El **CHECK duro** (no aprobar sin fuente) sigue COMENTADO en el SQL; activarlo exige antes
    cablear `price_source` en todas las vías de aprobado (paso siguiente, en código).
- **Fase 4 — tasa USD/VES automática (BCV)**: botón en Ajustes → `ve.dolarapi.com`.
  DECISIÓN PENDIENTE DEL OWNER: ¿oficial BCV o paralela/promedio? No cablear a ciegas
  (descuadraría todos los precios locales de golpe).

## 🩺 Incidencias diagnosticadas (verificadas, sin implementar)

- **Supabase se PAUSÓ por inactividad** (free tier, ~7 días): el 19/06 el login no entraba
  porque `hiofgzfhmhcvajsbiolz.supabase.co` daba NXDOMAIN. **Reactivado por el owner** desde
  el dashboard (auth 200 confirmado). Se repausará a los ~7 días sin uso; mitigación real =
  plan Pro de Supabase cuando el WMS entre en operación.
- **Visión NO está en Guardar.** El backend `/api/vision` (`identifyFromImage`, Gemini
  multimodal) y la UI de foto YA existen, pero SOLO en la página legacy `/scan`. En el flujo
  nuevo (`StowClient`) la cámara solo lee códigos de barras. Pendiente: portar "código no
  existe → foto → visión" a Guardar. (No usa DeepSeek — usa `gemini-2.5-flash-lite` vía
  OpenRouter, multimodal y barato.)
- **Imagen referencial null para productos de OFF.** `StowClient` dibuja la miniatura si
  `image_url` existe, pero muchos productos identificados por OpenFoodFacts tienen
  `image_url=null` aunque OFF SÍ tiene la foto (verificado para `5607047013403`). Pendiente:
  backfill + fallback en vivo de la imagen del proveedor por código.

## ✅ Migración 0009 EJECUTADA por el owner (2026-06-12)

La auditoría de retiros está operativa: tabla `stock_movements` con RLS, y el Panel
muestra "Movimientos recientes". Verificado con un retiro real en producción.

## Caducidad (2026-06-11, commit 66b6f54)

- Selector de fecha **nativo de calendario** en la orden de Guardar (sustituyó al
  ambiguo MMYY); formato es-ES.
- El manager/owner puede **editar la caducidad de un lote ya guardado** desde
  Inventario (sheet por lote) — endpoint `/api/batches/expiry` (YYYY-MM-DD o null).
- FEFO depende de esta fecha: el retiro saca primero lo que caduca antes.

## Retiro por código de barras (misión completada 2026-06-11)

- **Página /withdraw "Retirar"** (operator/manager/owner) — espejo de Guardar:
  escanear código (pistola/teclado/cámara) → producto con foto + stock total + lotes
  en orden FEFO ("saldrá primero lo que caduca antes") → cantidad (+5/+10/Todo) +
  motivo → confirmar. Feed de sesión. "Retirar" en el nav de Operación.
- **`/api/withdraw/lookup`**: barcode → producto + lotes activos FEFO + total.
- **`/api/withdraw/commit`**: reparte la cantidad entre lotes en orden FEFO (parcial
  reduce; total → `retirado`), notas de trazabilidad, devuelve desglose por hueco.
- **Auditoría `stock_movements`** (migración 0009): quién (id+nombre snapshot), cuándo
  (timestamptz), qué (nombre+barcode snapshot — sobrevive al borrado), de dónde (hueco),
  cuánto y por qué. Ambas vías de retiro la escriben; tolerante pre-migración.
- **Panel → "Movimientos recientes"**: últimos 12 retiros con hora/operario/motivo/hueco
  (oculta hasta que exista la tabla).
- Verificado en vivo: scan `013800100399` → 6 uds AMB-16 (FEFO 110d) → retiro de 2 →
  lote 6→4 con nota; feed "×2 · 2 de AMB-16". Botón "Retirar" del inventario también
  audita.
- (El retiro por lote del Inventario, manager/owner, sigue disponible como vía admin.)
- **Alta de usuarios:** página **/team** (manager/owner) — el admin da de alta empleados
  (correo, nombre, rol, contraseña). **Nadie se auto-registra** en un almacén (sería un
  agujero multi-tenant). `/api/users/create`: warehouse = el del creador (no del input);
  un encargado solo crea operarios; un dueño cualquier rol. Verificado en vivo: operario
  creado → entra → solo ve Guardar + Inventario.

## Modelo de roles (confirmado por el owner 2026-06-11)

Un solo sistema, 3 roles fijos (no permisos sueltos):
- **operario** (`operator`): escanear, guardar, **corregir identidad** del producto
  (nombre/categoría/código/peso/volumen), verificar hueco por QR. NO precios, NO Panel,
  NO crear/borrar nada.
- **administrador** (`manager`): + crear/editar/borrar ubicaciones, **precios**, aprobar,
  etiquetas QR, **borrar productos**.
- **super admin** (`owner`): + ajustes del almacén.
- **Borrar productos** (`/api/products/delete`, manager/owner): bloquea si hay stock
  activo (409); si no, borra lotes históricos + producto + imagen de Storage. Botón
  papelera en Inventario solo visible a manager/owner. Verificado en vivo.
- **Gestión de ubicaciones (manager/owner):** editar estación (renombrar, capacidad en
  bloque) y **borrar** (seguro: bloquea si hay stock; desactiva si hay historial). El
  operario NUNCA ve el Panel (separación de roles ya existente).
- **Etiquetas QR imprimibles:** `/dashboard/labels` — una pegatina por hueco (número +
  color de nivel + QR del código + zona), estilo LaceUp. Botón "Etiquetas QR" en el Panel.
- **Confirmar hueco por QR:** en la orden de Guardar, botón opcional "Verificar hueco (QR)"
  → escanea el QR físico del hueco y comprueba contra la ubicación sugerida (verde si
  coincide, ámbar si es el equivocado). No bloquea el flujo rápido.
- **Imágenes en vivo:** las fotos del proveedor se espejan a Supabase Storage (bucket
  público `product-images`, https) → ya se ven (resuelto el bloqueo http/mixed-content).
  Backfill ejecutado 2026-06-11: 10/11 productos migrados. Migración R2 (Cloudflare)
  pendiente para más adelante (preferencia del owner).
- **Peso/volumen:** columna `products.volume` (migración 0008, ejecutada); editor del
  operario con campos Peso (kg) / Volumen (L); se muestran como chips. Peso ya sesga a
  baldas bajas; volumen guardado para futura selección por tamaño de ubicación.
- **Editor del operario (nuevo):** botón "Editar" en Guardar → corrige nombre /
  categoría / código sin esperar al gerente. Escribir una categoría re-infiere la zona
  (ej. "Lácteos" en un Sin-código → salta solo a Refrigerado). Endpoint
  `/api/products/identify` (service-role, whitelist solo identidad — **nunca precio**;
  scoped por warehouse). El **precio sigue siendo exclusivo del gerente en /approval**.
- **Verificación (2026-06-11):**
  - `tsc --noEmit` / `eslint` / `next build` → limpios
  - Playwright en PRODUCCIÓN: idle minimalista; mantequilla `036800265257` → orden
    **flood amarillo Nivel 1 + número 3 + "↓ Agáchate" + REFRIGERADO REF-03**; "Sin código"
    → chooser de zona honesto. Móvil 390px y Panel (pared) verificados en local.

## Rediseño "una orden" (Semáforo guiado) — completado este turno

UI/UX rehecha tras crítica del owner: el operario ya no ve una pared de 18 ubicaciones
ni pestañas de zona. Diseño elegido por panel de 3 agentes + juez; revisado por panel
adversarial de 3 lentes (behavior/design/a11y) — 2 major corregidos.
- **Color = NIVEL/altura** es la ÚNICA señal de color fuerte (mapea a la etiqueta física
  del rack). **Zona = palabra + punto**, nunca un flood de color.
- **Idle:** un solo campo de escaneo dominante; sin pared, sin pestañas.
- **Orden (identificado):** flood del color del nivel + número GIGANTE de ubicación +
  flecha direccional (↓ agáchate / → a la altura / ↑ alcanza) + zona como palabra. Rail
  con producto (+miniatura si hay `image_url`), cantidad, confirmar.
- **Sin identificar (sin código):** panel neutro honesto "¿A qué zona va?" + 3 botones;
  confirmar bloqueado hasta elegir (no guarda en Ambiente a escondidas).
- **Sin hueco:** flood rojo de marca.
- **Cambiar ubicación:** sheet on-demand (reusa BinWall); la pared de 18 NO está en stow.
- **Pared de 18 + ocupación → Panel del gerente** ("Estantería por zona").
- Fix backend: `scan` reusa `product_id` (no duplica fichas pending al re-elegir zona);
  `scan` devuelve `image_url`.

## Identificación de productos — REALIDAD (importante)

- Proveedores gratuitos: **UPCitemdb (trial)** + **OpenFoodFacts** (fallback, sin clave).
- **Ningún proveedor gratuito cubre el 100%.** Ej.: `036800265257` (mantequilla Food Club,
  regional EE.UU.) NO está en ninguno → se identificó corrigiendo su ficha A MANO en la BD.
- Qué resuelve el código nuevo: (1) OFF añade cobertura real de alimentación que UPCitemdb
  no tiene; (2) enriquecimiento HONESTO — si nada se identifica, queda `failed` y aparece
  en revisión (antes mentía `enriched` y se ocultaba); (3) una vez el producto tiene
  categoría (por API o manual), la zona, el banner y el panel funcionan solos.
- **Pendiente real:** dar al gerente una forma de asignar **categoría** a un producto
  `failed` desde /approval (hoy solo edita nombre y precio) para cerrar el círculo sin SQL.

## Rediseño "Industrial Precision" (completado este turno)

- **Design system:** Archivo (UI) + IBM Plex Mono (números/códigos); neutros zinc/papel
  (#f6f6f4), bordes hairline `--color-line`, rojo de marca #e11931 usado con cuentagotas.
  Tokens en `globals.css`; paleta de NIVELES LaceUp (`src/lib/levels.ts`).
- **COLOR = NIVEL físico** (modelo LaceUp/Amazon): 1 Suelo amarillo `#f2c40f`,
  2 Medio morado `#9b59b6`, 3 Alto azul `#2e86c1`, 4 verde, 5 rojo.
- **Stow** (`StowClient` + `BinWall`): superficie de comando edge-to-edge. La pared
  dibuja la estantería real en alzado (alto arriba, suelo abajo), columnas alineadas
  como bahías; bin sugerido late (bin-pulse); tarjeta "GUÁRDALO EN" del color del nivel;
  feed de sesión con chips de nivel; selector de zona segmentado.
- **Lógica:** `suggestBin` prefiere baldas bajas para pesados; `resolveLevels` con
  fallback por bandas cuando la columna `level` aún no existe (código funciona ANTES
  y DESPUÉS de la migración, vía `select("*")`).
- **Resto de páginas** (inventario, panel, aprobación, ajustes, login, loading)
  restiladas al mismo contrato vía 4 agentes paralelos + auditorías adversariales
  (todas en verde; único hallazgo real —addBins sin nivel— corregido a mano).
- **StationsManager:** nuevo campo "Niveles" (1–5) con preview de distribución
  coloreada; sondea la columna `level` antes de insertarla (compat pre-migración).

## Stack

Next.js 16 (App Router, `proxy.ts`) · React 19 · TS · Tailwind v4 ·
Supabase (`hiofgzfhmhcvajsbiolz`) · OpenRouter `google/gemini-2.5-flash-lite` ·
deploy por **Vercel CLI** (`vercel --prod`) — **no hay remote git**.

## Pendiente — sistema de PRECIOS (estado al 2026-06-20)

> Regla de oro: un LLM NO busca precios (los inventa). El precio viene de fuente real (API)
> o de IA-con-búsqueda que CITE la fuente. NUNCA inventado (misma regla que el peso).

1. ✅ **HECHO (Fase 0-2, en vivo):** precio inventado del LLM eliminado; referencia real =
   mediana de `offers[]` de UPCitemdb citando comercios; números grandes + procedencia en
   /approval. Detalle en la sección "Sistema de PRECIOS" arriba.
2. ✅ **Fase 3 — IA con búsqueda que cita fuente** (botón Búsqueda Profunda): código EN VIVO
   (commit d9ec86f, OpenRouter+Exa) + migración 0010 EJECUTADA por el owner (2026-06-20).
3. ⏳ **Configurar fuentes/marketplaces** (super admin elige Amazon/Walmart/… en Ajustes).
4. ✅ **Precio de venta:** el gerente ve la referencia y fija el precio USD en /approval.
5. ⏳ **Fase 4 — Divisa automática BCV** (`ve.dolarapi.com`); decidir oficial vs paralela.

## Pendiente — operario

1. **Foto del producto por el operario** (capturar con cámara; subir al bucket
   `product-images` que YA existe). La infraestructura de Storage está lista (helper
   `uploadProductImage` ya escrito); falta el modo "tomar foto" de la cámara + botón.
2. **OCR de fecha de caducidad** con la cámara (sin IA pesada, por velocidad).
3. **Generar códigos de barras propios** (opcional, pedido por el owner): etiquetas
   imprimibles Code128/EAN para productos que lleguen sin código legible — mismo
   patrón que las etiquetas QR de huecos (/dashboard/labels).
4. Limpiar estaciones/productos de prueba (ahora se pueden borrar desde el Panel).
5. Sustituir placeholder `[PRODUCT_NAME]` por el nombre comercial final.
6. Página legacy `/scan` sigue existiendo (sin enlace en nav) — decidir si se elimina.
7. (Opcional) Migrar imágenes a Cloudflare R2 (cambiar solo `src/lib/storage.ts`).
   Editar capacidad/nivel por hueco individual (hoy es en bloque por estación).

## Hecho este turno (zonas producto-céntricas)

- `lib/upc.ts`: fallback OpenFoodFacts + reintento con cero a la izquierda (UPC-12).
- `lib/rules/putaway.ts`: hints de zona **bilingües**; podados los colisionables
  (`cream`/`nata`/`gas` suelto → evita misroutear gaseosa/gasa/cosmética).
- `api/enrich`: honesto (`failed` si no identifica) + devuelve name/category/inferred_zone.
- `api/stow/scan`: zona la decide el producto; override del operario es sticky.
- `api/stow/confirm`: `zone_warning` tras guardar en zona equivocada (nunca bloquea).
- `StowClient`: banner ámbar "Parece X" + botón "Mover a X"; toast de aviso.
- `dashboard`: card "Reubicaciones sugeridas" (lotes en zona que contradice su categoría).

## Migración 0007 (niveles) — YA EJECUTADA por el owner el 2026-06-11

`bins.level` existe en producción (28 bins repartidos: AMB 3×6, REF 2×3, CON suelo).

## Notas

- Login demo (owner): `creativedesignseo@gmail.com`.
- Capturas de verificación de este turno: redesign-*.png / prod-*.png en la raíz
  (gitignoradas).
