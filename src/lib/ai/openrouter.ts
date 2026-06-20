// OpenRouter implementation of AIProvider. SERVER ONLY (OPENROUTER_API_KEY).
// OpenAI-compatible Chat Completions; multimodal via image_url; JSON output.
// Default model is cheap + multimodal so it covers BOTH enrichText and vision.

import type { AIProvider } from "./provider";
import type {
  DeepPriceResult,
  DeepPriceSource,
  EnrichedProduct,
  IdentifiedProduct,
  RawLookupData,
} from "@/lib/types";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";

function apiKey(): string {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw new Error("Missing OPENROUTER_API_KEY");
  return k;
}

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

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

type Message = { role: "user"; content: unknown };

async function chat(messages: Message[]): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      // Optional attribution headers (OpenRouter rankings).
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "[PRODUCT_NAME] WMS",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

export class OpenRouterProvider implements AIProvider {
  async enrichText(
    barcode: string | null,
    rawData: RawLookupData,
  ): Promise<EnrichedProduct> {
    const prompt = `Eres un asistente de catalogación de almacén. Normaliza este
producto al ESPAÑOL para un sistema de inventario en Venezuela.

Código de barras: ${barcode ?? "(desconocido)"}
Datos crudos del proveedor (pueden estar en inglés o incompletos):
${JSON.stringify(rawData ?? {}, null, 2)}

Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma:
{
  "name": string|null,
  "category": string|null,
  "description": string|null,
  "weight": number|null
}

REGLAS:
- weight: PESO EN KG, SOLO si aparece en los datos crudos. JAMÁS lo inventes. Si no hay dato fiable, null.
- NUNCA estimes ni inventes precios. El precio se calcula aparte desde fuentes reales.
- No incluyas texto fuera del JSON.`;

    const content = await chat([{ role: "user", content: prompt }]);
    const parsed = parseJson<Record<string, unknown>>(content);
    return {
      name: str(parsed?.name) ?? rawData?.name ?? null,
      category: str(parsed?.category) ?? rawData?.category ?? null,
      description: str(parsed?.description) ?? rawData?.description ?? null,
      weight: num(parsed?.weight) ?? rawData?.weight ?? null,
      // Price is NEVER produced by the LLM (it would be invented). It's computed
      // downstream from real offers in /api/enrich. See lib/price.ts.
      suggested_price_usd: null,
    };
  }

  async identifyFromImage(imageBase64: string): Promise<IdentifiedProduct> {
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const prompt = `Identifica este producto de almacén a partir de la foto.
Devuelve EXCLUSIVAMENTE un objeto JSON en ESPAÑOL:
{
  "name": string|null,
  "brand": string|null,
  "category": string|null,
  "description": string|null
}
No inventes datos que no puedas ver. No incluyas texto fuera del JSON.`;

    const content = await chat([
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ]);
    const parsed = parseJson<Record<string, unknown>>(content);
    return {
      name: str(parsed?.name),
      brand: str(parsed?.brand),
      category: str(parsed?.category),
      description: str(parsed?.description),
    };
  }

  async deepPriceSearch(
    name: string,
    barcode: string | null,
  ): Promise<DeepPriceResult> {
    const prompt = `Busca en comercios online el PRECIO DE VENTA actual de este producto y
estima la MEDIANA en USD. Producto: "${name}"${barcode ? ` (código ${barcode})` : ""}.
Haz UNA sola búsqueda. Devuelve EXCLUSIVAMENTE un objeto JSON:
{ "price_usd": number|null, "note": string }
Si NO encuentras un precio respaldado por una fuente real, price_usd debe ser null.
JAMÁS inventes un precio.`;

    // OpenRouter `web` plugin (Exa by default) → message.annotations[] carry the
    // real url_citation sources. Don't set response_format here; it can conflict
    // with the web plugin. We parse JSON tolerantly from the content instead.
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "[PRODUCT_NAME] WMS",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        plugins: [{ id: "web", max_results: 5 }],
        temperature: 0.1,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices?: {
        message?: {
          content?: string;
          annotations?: {
            type?: string;
            url_citation?: { url?: string; title?: string };
          }[];
        };
      }[];
    };
    const msg = data.choices?.[0]?.message;
    const parsed = parseJson<Record<string, unknown>>(msg?.content ?? "");

    const sources: DeepPriceSource[] = (msg?.annotations ?? [])
      .filter((a) => a.type === "url_citation" && a.url_citation?.url)
      .map((a) => {
        const url = a.url_citation!.url as string;
        return { merchant: str(a.url_citation?.title) ?? hostnameOf(url), url };
      });

    // CANDADO: no real source → no price. Never persist an unsourced number.
    const price = sources.length > 0 ? num(parsed?.price_usd) : null;
    return { price_usd: price, sources };
  }
}
