// Data Access Layer for auth. This is the REAL authorization boundary
// (proxy.ts only does optimistic redirects). Always resolve the profile here
// before trusting a role or a warehouse_id.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

export interface AuthContext {
  userId: string;
  email: string | null;
  profile: Profile;
}

/**
 * Returns the authenticated user's profile, or null if not signed in / no
 * profile row. Does NOT redirect — callers decide.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { userId: user.id, email: user.email ?? null, profile };
}

/** Require a signed-in user with a profile, else redirect to /login. */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Require one of the given roles, else redirect to a safe default page. */
export async function requireRole(...roles: Role[]): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!roles.includes(ctx.profile.role)) {
    redirect(defaultPageForRole(ctx.profile.role));
  }
  return ctx;
}

/** Landing page per role after login. */
export function defaultPageForRole(role: Role): string {
  switch (role) {
    case "operator":
      return "/scan";
    case "manager":
      return "/scan";
    case "owner":
      return "/inventory";
    default:
      return "/inventory";
  }
}

export function canApprove(role: Role): boolean {
  return role === "manager" || role === "owner";
}

export function canManageSettings(role: Role): boolean {
  return role === "owner";
}
