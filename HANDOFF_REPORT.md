# HANDOFF — WMS Baraki Logística

> Realidad **verificada** (no supuesta). Última actualización: 2026-06-11 (rediseño "una orden").

## En vivo ahora

- **URL producción:** https://wms-delta-nine.vercel.app
- **Commit desplegado:** `cea4c78` — retiro por código de barras + FEFO + auditoría
- **Deploy Vercel:** `wms-iathhg7yu…` · estado **● READY** · Production · alias activo

## ⚠️ Pendiente INMEDIATO del owner: ejecutar migración 0009 en Supabase

`supabase/migrations/0009_stock_movements.sql` (SQL entregado en chat) crea la tabla
de **auditoría de retiros** (fecha+hora, operario con nombre, producto snapshot, hueco,
cantidad, motivo). La app funciona sin ella (las notas del lote registran igual), pero
el **historial visible en el Panel** y la auditoría real empiezan al ejecutarla.

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

## Pendiente (priorizado) — sistema de PRECIOS (decidido con el owner 2026-06-11)

> Trampa importante: un LLM NO busca precios reales solo (los inventa). El precio debe
> venir de fuente real (API) o de IA-con-búsqueda que CITE la fuente. NUNCA inventado
> (misma regla que el peso). Hoy el prompt de enrich NO prohíbe inventar precio → revisar.

1. **Precio de referencia honesto:** precio de fuente real (UPCitemdb `lowest_recorded_price`)
   + mostrar la fuente; quitar del prompt la generación de precio inventado.
2. **IA con búsqueda de precios** (enfoque elegido: fuente real + IA con búsqueda que cita
   fuente) para productos sin proveedor.
3. **Configurar fuentes/marketplaces** (super admin elige Amazon/Walmart/… en Ajustes).
4. **Precio de venta:** el operario/admin ve la referencia y fija el precio en USD.
5. **Divisa automática BCV:** tasa oficial del día (cron); bolívares = USD × tasa al vuelo.

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
