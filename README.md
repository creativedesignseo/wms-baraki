# [PRODUCT_NAME] — WMS multi-tenant

Sistema de gestión de almacén (WMS) multi-tenant para almacenes que reciben
mercancía **sin catálogo previo** (liquidaciones, lotes mixtos tipo
Amazon/Walmart). Primer cliente: un bodegón en Venezuela, pero el sistema es
genérico para cualquier almacén similar.

> `[PRODUCT_NAME]` es un placeholder. Se reemplazará en código y UI cuando se
> decida el nombre definitivo.

## El problema que resuelve

El operario escanea un código de barras y la ficha se crea **al instante**
(sub-segundo). El enriquecimiento (búsqueda UPC + IA) y la sugerencia de
ubicación (putaway) corren **en segundo plano** — el operario nunca espera a la
red ni a la IA.

## Stack

- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind 4
- **Backend:** Supabase (Postgres + Auth + RLS + Storage)
- **API:** Next.js route handlers (`/src/app/api/`)
- **IA visión/texto:** Gemini Flash (capa gratuita), tras una interfaz
  `AIProvider` enchufable
- **Escáner:** `html5-qrcode` (cámara) + input USB nativo (pistola)
- **Deploy:** Vercel (frontend) + Supabase cloud

## Roles

`owner` · `manager` · `operator` — RLS real desde el primer commit (sin
`USING(true)`). Cada almacén es un tenant aislado por `warehouse_id`.

## Puesta en marcha

1. **Instalar dependencias**

   ```bash
   npm install
   ```

2. **Crear el proyecto Supabase** (cloud) y copiar las claves.

   ```bash
   cp .env.example .env.local
   # rellena NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   # SUPABASE_SERVICE_ROLE_KEY y GEMINI_API_KEY
   ```

3. **Ejecutar las migraciones SQL** en el SQL Editor de Supabase, en orden
   (ver carpeta `supabase/migrations/`).

4. **Arrancar en local**

   ```bash
   npm run dev
   ```

## Estructura

```
src/
  app/
    (auth)/login/         · login
    (app)/scan/           · recepción ciega (operator, manager)
    (app)/approval/       · cola de aprobación (manager, owner)
    (app)/inventory/      · inventario paginado + FEFO (todos)
    (app)/settings/       · ajustes del almacén (owner)
    api/receive/          · crea ficha mínima (sub-segundo)
    api/enrich/           · enriquecimiento async (UPC + Gemini)
    api/vision/           · foto → Gemini visión
    api/lookup/           · proxy UPC lookup server-side
  components/             · Scanner, QuickNumPad, FEFOBadge, ...
  lib/
    supabase/             · clientes SSR (server, client, middleware)
    ai/                   · AIProvider (interface) + GeminiProvider
    rules/                · motor de putaway (determinista)
    money.ts              · conversión doble moneda
    types.ts              · tipos del dominio + enums
  middleware.ts          · guard de rutas por rol
supabase/migrations/     · migraciones SQL (referencia)
```

## Invariantes (no negociables)

1. `weight` nunca se inventa → `NULL` si se desconoce.
2. `operator_id` siempre relleno en `batches`.
3. Camino crítico (`/api/receive`) sub-segundo; IA siempre en background.
4. RLS real desde el primer commit. Sin `USING(true)`.
5. API keys solo en variables de entorno server-side.
6. Multi-tenant desde el modelo de datos.
