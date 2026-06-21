// Gemini Flash implementation of AIProvider. SERVER ONLY (uses GEMINI_API_KEY).
// Returns best-effort structured data; callers handle null/failed gracefully.

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider } from "./provider";
import type {
  DeepPriceResult,
  EnrichedProduct,
  IdentifiedProduct,
  RawLookupData,
} from "@/lib/types";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });
}

// Tolerant JSON parse — strips ``` fences if the model adds them.
function parseJson<T>(text: string): T | null {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export class GeminiProvider implements AIProvider {
  async enrichText(
    barcode: string | null,
    rawData: RawLookupData,
  ): Promise<EnrichedProduct> {
    const model = getModel();
    const prompt = `Eres un asistente de catalogación de almacén. Normaliza este
producto al ESPAÑOL para un sistema de inventario en Venezuela.

Código de barras: ${barcode ?? "(desconocido)"}
Datos crudos del proveedor (pueden estar en inglés o incompletos):
${JSON.stringify(rawData ?? {}, null, 2)}

Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma:
{
  "name": string|null,                 // nombre comercial corto en español
  "category": string|null,             // categoría en español (ej. "Bebidas", "Limpieza")
  "description": string|null,          // 1 frase
  "weight": number|null                // PESO EN KG. SOLO si aparece en los datos crudos. NUNCA lo inventes. Si no hay dato fiable, null.
}

REGLAS:
- name/category: TRADUCE y NORMALIZA al español los datos crudos. Eres un TRADUCTOR, no un
  identificador: NUNCA sustituyas el producto por otro distinto ni inventes un nombre que no se
  derive de los datos crudos. Si traen marca/nombre/categoría, respétalos (solo tradúcelos). Si
  los datos crudos no permiten identificar el producto, devuelve name y category en null.
- weight: si los datos crudos no traen un peso fiable, devuelve null. JAMÁS inventes un peso.
- NUNCA estimes ni inventes precios. El precio se calcula aparte desde fuentes reales.
- No incluyas texto fuera del JSON.`;

    const result = await model.generateContent(prompt);
    const parsed = parseJson<Record<string, unknown>>(result.response.text());
    return {
      name: str(parsed?.name) ?? rawData?.name ?? null,
      category: str(parsed?.category) ?? rawData?.category ?? null,
      description: str(parsed?.description) ?? rawData?.description ?? null,
      // weight only survives if the model echoed a real number; never fabricated.
      weight: num(parsed?.weight) ?? rawData?.weight ?? null,
      // Price is NEVER produced by the LLM (it would be invented). It's computed
      // downstream from real offers in /api/enrich. See lib/price.ts.
      suggested_price_usd: null,
    };
  }

  async identifyFromImage(imageBase64: string): Promise<IdentifiedProduct> {
    const model = getModel();
    // Accept data URLs or raw base64.
    const match = imageBase64.match(/^data:(.+?);base64,(.*)$/);
    const mimeType = match ? match[1] : "image/jpeg";
    const data = match ? match[2] : imageBase64;

    const prompt = `Identifica este producto de almacén a partir de la foto.
Devuelve EXCLUSIVAMENTE un objeto JSON en ESPAÑOL:
{
  "name": string|null,        // nombre del producto
  "brand": string|null,       // marca si es visible
  "category": string|null,    // categoría en español
  "description": string|null  // 1 frase
}
No inventes datos que no puedas ver. No incluyas texto fuera del JSON.`;

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data, mimeType } },
    ]);
    const parsed = parseJson<Record<string, unknown>>(result.response.text());
    return {
      name: str(parsed?.name),
      brand: str(parsed?.brand),
      category: str(parsed?.category),
      description: str(parsed?.description),
    };
  }

  // Deep price search needs live web grounding with cited sources. The direct
  // Gemini path here doesn't wire google_search grounding yet, so we refuse
  // rather than return an unsourced (invented) price. OpenRouter is the active
  // provider for this feature (see lib/ai/index.ts).
  async deepPriceSearch(): Promise<DeepPriceResult> {
    throw new Error(
      "Búsqueda profunda no disponible con el proveedor Gemini directo; requiere OpenRouter.",
    );
  }
}
