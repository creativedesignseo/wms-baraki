// AI provider factory. Single place to choose the implementation.
import type { AIProvider } from "./provider";
import { GeminiProvider } from "./gemini";

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!cached) cached = new GeminiProvider();
  return cached;
}

export type { AIProvider } from "./provider";
