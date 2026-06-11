# HANDOFF — WMS Baraki Logística

> Realidad **verificada** (no supuesta). Última actualización: 2026-06-11 (zonas producto-céntricas).

## En vivo ahora

- **URL producción:** https://wms-delta-nine.vercel.app
- **Commit desplegado:** `fb6630a` — `feat(stow): product-driven zones, robust ID, relocation alerts`
- **Deploy Vercel:** `wms-4fv7yl5a0…` · estado **● READY** · Production · alias activo
- **Verificación (2026-06-11):**
  - `tsc --noEmit` / `eslint` / `next build` → limpios
  - Playwright en PRODUCCIÓN: mantequilla `036800265257` → identificada → **Refrigerado
    REF-03 automático**; forzar Ambiente → banner ámbar "Parece Refrigerado"; panel
    "Reubicaciones sugeridas" lista 5 lotes mal ubicados. Móvil 390px verificado en local.

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

1. **Editar categoría desde /approval** para productos `failed` → cierra el círculo de
   identificación manual sin tocar SQL (ver sección "Identificación").
2. Limpiar productos demo `(sin nombre)` con stock 0 (SQL opcional entregado en chat).
3. Sustituir placeholder `[PRODUCT_NAME]` por el nombre comercial final.
4. Página legacy `/scan` sigue existiendo (sin enlace en nav) — decidir si se elimina.
5. (Opcional) Proveedor UPC de pago si se necesita cobertura ~total de códigos.

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
