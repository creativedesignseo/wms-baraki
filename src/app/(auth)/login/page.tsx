"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Warehouse } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

const INPUT =
  "mt-1.5 h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-ink";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(traducirError(error.message));
      return;
    }
    // Full reload so proxy.ts + server components pick up the fresh session.
    router.push(nextUrl);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        {/* brand mark */}
        <div className="deck-rise flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-[0_2px_8px_rgba(225,25,49,0.35)]">
            <Warehouse className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink">
              [PRODUCT_NAME]
            </div>
            <div className="font-[family-name:var(--font-num)] text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Consola de almacén
            </div>
          </div>
        </div>

        {/* industrial touch: barcode motif */}
        <div aria-hidden className="barcode-stripes mt-5 h-6 text-zinc-200" />

        <div
          className="deck-rise mt-5 rounded-2xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          style={{ animationDelay: "60ms" }}
        >
          <h1 className="text-2xl font-bold tracking-tight text-ink">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Inicia sesión para acceder al almacén
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-[13px] font-medium text-zinc-700">
                Correo
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT}
                placeholder="operario@almacen.com"
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="block text-[13px] font-medium text-zinc-700"
              >
                Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function traducirError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos";
  if (/email not confirmed/i.test(msg)) return "Confirma tu correo antes de entrar";
  return msg;
}
