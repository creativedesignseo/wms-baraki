// /withdraw — "Retirar mercancía": the outbound mirror of Guardar. Scan the
// product's barcode, set the quantity, confirm — FEFO decides which batches
// the units leave from, and every withdrawal lands in the audit trail.
import { requireRole } from "@/lib/auth";
import { WithdrawClient } from "@/components/withdraw/WithdrawClient";

export const dynamic = "force-dynamic";

export default async function WithdrawPage() {
  await requireRole("operator", "manager", "owner");
  return <WithdrawClient />;
}
