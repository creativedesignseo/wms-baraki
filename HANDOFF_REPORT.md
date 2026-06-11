# HANDOFF — WMS Baraki Logística

> Realidad **verificada** (no supuesta). Última actualización: 2026-06-11.

## En vivo ahora

- **URL producción:** https://wms-delta-nine.vercel.app
- **Commit desplegado:** `9a205ec` — `feat(stow): full-height workstation layout — bins fill the screen`
- **Deploy Vercel:** `wms-r8uv5z7iv...` · estado **● Ready** · Production
- **Verificación (2026-06-11):**
  - `tsc --noEmit` → limpio
  - `eslint` → limpio
  - `next build` → OK (`/stow` server-rendered dynamic)
  - `GET /login` → **200**
  - `GET /stow` sin sesión → **307** → /login (auth/RLS funcionando)

## Stack

Next.js 16 (App Router, `proxy.ts`) · React 19 · TS · Tailwind v4 ·
Supabase (Postgres + Auth + RLS + Storage, `hiofgzfhmhcvajsbiolz`) ·
OpenRouter `google/gemini-2.5-flash-lite` para enriquecimiento IA ·
deploy por **Vercel CLI** (`vercel --prod`) — **no hay remote git**.

## Qué hace hoy (operativo, en vivo)

- **Recepción ciega:** escanear → ficha mínima sub-segundo → `/api/enrich` async.
- **Stow caótico-por-zona:** muro de bins a pantalla completa (workstation 1920×1080),
  numerados 1–N, gradiente de color cyan→rojo por índice de posición.
  Zona la dicta el producto (Ambiente por defecto); el operario la cambia para frío.
- **Inventario** estilo Sortly (foto + filas expandibles).
- **Aprobación** de precios (USD + local) y **Panel** admin (tasas, ocupación, FEFO).
- **Multi-tenant** por `warehouse_id` con RLS real (sin `USING(true)`).

## Pendiente (priorizado)

1. **Sistema de color por NIVEL de altura** (discutido 2026-06-11, **no implementado**).
   El usuario quiere el modelo LaceUp/Amazon: el color = nivel físico, no el índice.
   - Baraki Valencia tiene **3 niveles**: bajo (suelo), medio, alto. Más neveras.
   - Colores LaceUp **brillantes** (los de la captura del usuario), no oscuros:
     nivel 1 amarillo `#F5C518`, nivel 2 morado `#9B59B6`, nivel 3 azul `#2980B9`
     (paleta de 5 disponible: +verde `#27AE60`, +rojo `#E74C3C` si crecen alturas).
   - Requiere: campo `level` en tabla `bins`, código `AMB-1-01`/`AMB-2-01`/...,
     `binColor()` por nivel en vez de por índice. Debe ser **configurable** por almacén.
2. Propagar diseño Sortly a Aprobación y Ajustes.
3. Alerta de zona equivocada cuando la IA detecta perecedero en bin Ambiente.
4. Limpiar productos demo `(sin nombre)` con stock 0.

## Notas

- Reemplazar placeholder `[PRODUCT_NAME]` por el nombre comercial final.
- Login demo (owner): `creativedesignseo@gmail.com`.
