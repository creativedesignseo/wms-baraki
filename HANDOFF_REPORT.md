# HANDOFF — WMS Baraki Logística

> Realidad **verificada** (no supuesta). Última actualización: 2026-06-11 (rediseño Industrial Precision).

## En vivo ahora

- **URL producción:** https://wms-delta-nine.vercel.app
- **Commit desplegado:** `5cc3113` — `feat(ui): Industrial Precision redesign — full app + level-colored bin wall`
- **Deploy Vercel:** `wms-pw7xyt3bd…` · estado **● Ready** · Production
- **Verificación (2026-06-11):**
  - `tsc --noEmit` / `eslint` / `next build` → limpios
  - Playwright en PRODUCCIÓN: /stow renderiza la pared por niveles; logout → /login
    (nuevo diseño) → login → /inventory. Todo OK a 1920×1080; móvil 390px verificado en local.

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

## ⚠️ Pendiente INMEDIATO: ejecutar migración 0007 en Supabase

`supabase/migrations/0007_bin_levels.sql` — añade `bins.level` y reparte el seed demo
(AMB 3 niveles × 6, REF 2 × 3, CON suelo). **La app ya funciona sin ella** (bandas
inferidas), pero los niveles REALES los fija el SQL. Pegar en Supabase → SQL Editor.

## Stack

Next.js 16 (App Router, `proxy.ts`) · React 19 · TS · Tailwind v4 ·
Supabase (`hiofgzfhmhcvajsbiolz`) · OpenRouter `google/gemini-2.5-flash-lite` ·
deploy por **Vercel CLI** (`vercel --prod`) — **no hay remote git**.

## Pendiente (priorizado)

1. **Ejecutar 0007 en Supabase** (ver arriba).
2. Limpiar productos demo `(sin nombre)` con stock 0 (SQL opcional entregado en chat).
3. Alerta de zona equivocada cuando la IA detecta perecedero en bin Ambiente.
4. Sustituir placeholder `[PRODUCT_NAME]` por el nombre comercial final.
5. Página legacy `/scan` sigue existiendo (sin enlace en nav) — decidir si se elimina.

## Notas

- Login demo (owner): `creativedesignseo@gmail.com`.
- Capturas de verificación de este turno: redesign-*.png / prod-*.png en la raíz
  (gitignoradas).
