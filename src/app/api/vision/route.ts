// POST /api/vision — no-barcode flow. Operator uploads a photo, Gemini Vision
// returns name/brand/category/description for the operator to confirm.
// Returns the identification only; the operator then submits it via /api/receive.

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { getAIProvider } from "@/lib/ai";

interface VisionBody {
  image_base64: string; // data URL or raw base64
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: VisionBody;
  try {
    body = (await request.json()) as VisionBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.image_base64) {
    return NextResponse.json({ error: "Falta image_base64" }, { status: 400 });
  }

  try {
    const identified = await getAIProvider().identifyFromImage(body.image_base64);
    return NextResponse.json(identified, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        error: "No se pudo identificar la imagen",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
