// /scan — blind receiving (operator, manager).
import { requireRole } from "@/lib/auth";
import { ScanClient } from "@/components/scan/ScanClient";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  await requireRole("operator", "manager");
  return <ScanClient />;
}
