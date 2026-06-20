# 📍 Coordenadas del proyecto — WMS "Baraki Logística" (NO volver a preguntar)

> Datos fijos y verificados. Si algo aquí dice que existe, EXISTE — no respondas "no hay" sin
> comprobar primero estos enlaces. (Claves/secretos NO van aquí; viven solo en `.env.local`.)

| Recurso | Dónde |
|---|---|
| **Repositorio GitHub** (privado) | https://github.com/creativedesignseo/wms-baraki · cuenta `creativedesignseo` · rama de trabajo `feat/wms-mvp` |
| **Supabase** (BD + Auth) | proyecto ref `hiofgzfhmhcvajsbiolz` · URL `https://hiofgzfhmhcvajsbiolz.supabase.co` · dashboard https://supabase.com/dashboard/project/hiofgzfhmhcvajsbiolz · ⚠️ vive en una cuenta de Supabase DISTINTA a la del MCP conectado (por eso el MCP da "no permission"); se gestiona desde el dashboard. Plan free → **se pausa tras ~7 días sin uso** (reactivar en el dashboard). |
| **Vercel** (deploy) | proyecto `wms` · panel https://vercel.com/creativedesignseo-gmailcoms-projects/wms · prod **https://wms-delta-nine.vercel.app** · deploy por CLI `vercel --prod` (auto-deploy desde GitHub: pendiente conectar) |
| **IA** | OpenRouter `google/gemini-2.5-flash-lite` (multimodal + plugin web/Exa). **NO es DeepSeek.** Clave `OPENROUTER_API_KEY` en `.env.local`. |
| **APIs de datos** | UPCitemdb (trial, 100/día) + OpenFoodFacts (gratis) para identificar/precio referencia. |

Estado y pendientes vivos: ver `HANDOFF_REPORT.md`.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
