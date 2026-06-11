"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98] print:hidden"
    >
      <Printer className="h-4 w-4" /> Imprimir
    </button>
  );
}
