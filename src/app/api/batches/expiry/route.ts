// POST /api/batches/expiry — set/clear a batch's expiration date (manager/owner).
// Lets the admin fix a perishable's expiry after it was stowed (FEFO depends on
// it). Accepts a plain YYYY-MM-DD date or null to clear it.

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface ExpiryBody {
  batch_id: string;
  expiration_date: string | null;
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (ctx.profile.role !== "manager" && ctx.profile.role !== "owner") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: ExpiryBody;
  try {
    body = (await request.json()) as ExpiryBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.batch_id) {
    return NextResponse.json({ error: "Falta batch_id" }, { status: 400 });
  }

  const raw = body.expiration_date?.trim() || null;
  // accept only a YYYY-MM-DD date (or null to clear)
  if (raw !== null && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return NextResponse.json({ error: "Fecha no válida" }, { status: 400 });
  }

  const wh = ctx.profile.warehouse_id;
  const admin = createAdminClient();
  const { error } = await admin
    .from("batches")
    .update({ expiration_date: raw })
    .eq("id", body.batch_id)
    .eq("warehouse_id", wh);
  if (error) {
    return NextResponse.json(
      { error: "No se pudo guardar", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
