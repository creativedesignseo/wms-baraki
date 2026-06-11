# HANDOFF — WMS Baraki Logística

> Realidad **verificada** (no supuesta). Última actualización: 2026-06-11 (rediseño "una orden").

## En vivo ahora

- **URL producción:** https://wms-delta-nine.vercel.app
- **Commit desplegado:** `13274d9` — `feat(stow): operator can correct product identity at stow time`
- **Deploy Vercel:** `wms-2mc15xek2…` · estado **● READY** · Production · alias activo
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

## Pendiente (priorizado)

1. **Foto del producto por el operario** (capturar con cámara cuando no hay imagen del
   proveedor; guardar en Supabase Storage privado por almacén). El operario lo pidió
   para liquidaciones random sin código/sin imagen. La edición de identidad YA está;
   falta la captura+subida de foto y el modo "tomar foto" de la cámara.
2. Limpiar productos de prueba sin identificar (SQL opcional entregado en chat).
3. Sustituir placeholder `[PRODUCT_NAME]` por el nombre comercial final.
4. Página legacy `/scan` sigue existiendo (sin enlace en nav) — decidir si se elimina.
5. (Opcional) OCR de fecha de caducidad con la cámara; proveedor UPC de pago.

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
