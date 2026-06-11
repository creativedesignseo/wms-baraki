// /dashboard/labels — printable rack labels (manager/owner). Each location gets
// a QR (encodes its code, e.g. "AMB-11"), the big position number, the level
// color (matches the on-screen wall), the code and zone — the physical sticker
// the operator scans to confirm placement. Print-friendly (AppShell hides).
import QRCode from "qrcode";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { levelMeta } from "@/lib/levels";
import { resolveLevels, type BinForStow } from "@/lib/rules/putaway";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Zone } from "@/lib/types";

export const dynamic = "force-dynamic";

const ZONE_LABEL: Record<Zone, string> = {
  general: "Ambiente",
  refrigerado: "Refrigerado",
  congelado: "Congelado",
  hazmat: "Hazmat",
};
const NUM = "font-[family-name:var(--font-num)] tabular-nums";

export default async function LabelsPage() {
  const ctx = await requireRole("manager", "owner");
  const supabase = await createClient();
  const wh = ctx.profile.warehouse_id;

  const { data: bins } = await supabase
    .from("bins")
    .select("id, station_id, code, position, zone, level, capacity, stations(name)")
    .eq("warehouse_id", wh)
    .eq("active", true)
    .order("code", { ascending: true });

  const forStow: BinForStow[] = (bins ?? []).map((b) => ({
    id: b.id,
    station_id: b.station_id,
    station_name: "",
    code: b.code,
    position: b.position,
    level: b.level ?? null,
    zone: b.zone as Zone,
    capacity: b.capacity,
    used: 0,
    active: true,
  }));
  const levels = resolveLevels(forStow);

  // Generate a QR data URL per bin (encodes the code, scanned to confirm placement).
  const labels = await Promise.all(
    (bins ?? []).map(async (b) => {
      const station = (Array.isArray(b.stations) ? b.stations[0] : b.stations) as
        | { name?: string }
        | null;
      const qr = await QRCode.toDataURL(b.code, {
        margin: 1,
        width: 220,
        errorCorrectionLevel: "M",
      });
      return {
        id: b.id,
        code: b.code,
        position: b.position,
        zone: b.zone as Zone,
        level: levels.get(b.id) ?? 1,
        station: station?.name ?? "",
        qr,
      };
    }),
  );

  return (
    <div className="flex-1 px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <Link
              href="/dashboard"
              className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Panel
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Etiquetas de ubicación</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Imprime y pega una en cada hueco. El color = nivel; el operario escanea el QR
              para confirmar dónde guarda.
            </p>
          </div>
          <PrintButton />
        </div>

        {labels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400">
            No hay ubicaciones. Crea estaciones en el Panel.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-2">
            {labels.map((l) => {
              const meta = levelMeta(l.level);
              return (
                <div
                  key={l.id}
                  className="flex break-inside-avoid overflow-hidden rounded-xl border border-zinc-300 bg-white"
                >
                  {/* color stub = level */}
                  <div
                    className="flex w-20 shrink-0 flex-col items-center justify-center px-1 py-2"
                    style={{ backgroundColor: meta.color, color: meta.text }}
                  >
                    <span className={`text-4xl font-bold leading-none ${NUM}`}>{l.position}</span>
                    <span className="mt-1 text-center text-[8px] font-bold uppercase leading-tight tracking-wide">
                      N{l.level}
                      <br />
                      {meta.name}
                    </span>
                  </div>
                  {/* QR + meta */}
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.qr} alt={l.code} className="h-20 w-20" />
                    <span className={`text-sm font-bold text-ink ${NUM}`}>{l.code}</span>
                    <span className="text-center text-[9px] font-medium uppercase tracking-wide text-zinc-500">
                      {ZONE_LABEL[l.zone]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
