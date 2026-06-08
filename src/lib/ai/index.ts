// AI provider factory. Single place to choose the implementation.
// Prefers OpenRouter when OPENROUTER_API_KEY is set; falls back to Gemini.
import type { AIProvider } from "./provider";
import { GeminiProvider } from "./gemini";
import { OpenRouterProvider } from "./openrouter";

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!cached) {
    cached = process.env.OPENROUTER_API_KEY
      ? new OpenRouterProvider()
      : new GeminiProvider();
  }
  return cached;
}

export type { AIProvider } from "./provider";
