// Root — routes the authenticated user to their role's default page.
import { redirect } from "next/navigation";
import { getAuthContext, defaultPageForRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  redirect(defaultPageForRole(ctx.profile.role));
}
