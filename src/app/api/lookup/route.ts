// GET /api/lookup?barcode=XXXX — server-side UPC proxy (resolves CORS for the
// client and keeps any provider key off the browser). Requires a session so it
// isn't an open proxy. Provider logic lives in lib/upc.ts (swappable).

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { lookupUpc } from "@/lib/upc";

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const barcode = (searchParams.get("barcode") || searchParams.get("upc") || "").trim();
  if (!barcode) {
    return NextResponse.json({ error: "Falta barcode" }, { status: 400 });
  }

  const result = await lookupUpc(barcode);
  return NextResponse.json(result, { status: 200 });
}
