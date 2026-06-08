// /scan — blind receiving (operator, manager, owner).
// Owner is a superset of manager/operator, so they can receive too.
import { requireRole } from "@/lib/auth";
import { ScanClient } from "@/components/scan/ScanClient";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  await requireRole("operator", "manager", "owner");
  return <ScanClient />;
}
