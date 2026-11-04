import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/format";

// Shows which supporting vendor invoices are still missing before a draw
// package is approved and sent to the client.
export default function DrawPackageCheck({ drawCycleId }) {
  const { data } = useQuery({
    queryKey: ["drawPackageCheck", drawCycleId],
    queryFn: async () => {
      const drawVendors = await base44.entities.DrawVendor.filter({ draw_cycle_id: drawCycleId });
      if (drawVendors.length === 0) return { missing: [], total: 0 };
      const [docs, vendors] = await Promise.all([
        base44.entities.Document.filter({ draw_vendor_id: { $in: drawVendors.map((dv) => dv.id) } }),
        base44.entities.Vendor.list(),
      ]);
      const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
      const byId = new Map(drawVendors.map((dv) => [dv.id, dv]));
      const missing = docs
        .filter((d) => d.document_type === "invoice" || d.document_type === "receipt")
        .filter((d) => !d.file_url)
        .map((d) => {
          const dv = byId.get(d.draw_vendor_id);
          return {
            id: d.id,
            vendor: vendorName.get(dv?.vendor_id) || dv?.vendor_name || "Unassigned",
            invoiceNumber: d.invoice_number || "",
            amount: d.amount,
          };
        });
      return {
        missing,
        total: missing.reduce((sum, m) => sum + (Number(m.amount) || 0), 0),
      };
    },
    enabled: !!drawCycleId,
  });

  if (!data) return null;

  if (data.missing.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
        All supporting invoices are attached to this draw.
      </div>
    );
  }

  return (
    <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 space-y-1">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        {data.missing.length} supporting invoice{data.missing.length === 1 ? "" : "s"} missing ({formatCurrency(data.total)})
      </div>
      <ul className="pl-6 space-y-0.5 text-xs">
        {data.missing.slice(0, 6).map((m) => (
          <li key={m.id}>
            {m.vendor}
            {m.invoiceNumber ? ` · ${m.invoiceNumber}` : ""}
            {m.amount != null ? ` · ${formatCurrency(m.amount)}` : ""}
          </li>
        ))}
        {data.missing.length > 6 && <li>and {data.missing.length - 6} more…</li>}
      </ul>
      <p className="pl-6 text-xs">You can still approve the draw — these will not be attached.</p>
    </div>
  );
}