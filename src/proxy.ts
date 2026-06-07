// Next.js 16 Proxy (formerly Middleware). Refreshes the Supabase session on
// every request and performs an optimistic redirect for unauthenticated users.
// Role-based authorization is enforced in the layouts/server components, not here.

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on all paths except static assets and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
