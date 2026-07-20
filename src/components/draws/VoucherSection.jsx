import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import VoucherFormDialog from "./VoucherFormDialog";

export default function VoucherSection({ drawId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: vouchers = [] } = useQuery({
    queryKey: ["vouchers", drawId],
    queryFn: () => base44.entities.Voucher.filter({ draw_cycle_id: drawId }),
  });
  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendors", drawId],
    queryFn: () => base44.entities.DrawVendor.filter({ draw_cycle_id: drawId }),
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
  });

  const vendorMap = new Map(vendors.map((v) => [v.id, v]));
  const dvMap = new Map(drawVendors.map((dv) => [dv.id, dv]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Vouchers</h2>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-1" />Add Voucher</Button>
      </div>
      {vouchers.length === 0 ? (
        <div className="text-center py-6 text-slate-400 border border-dashed rounded-lg">No vouchers for this draw.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-2 font-semibold">Voucher #</th>
                <th className="px-3 py-2 font-semibold">Vendor</th>
                <th className="px-3 py-2 font-semibold text-right">Amount</th>
                <th className="px-3 py-2 font-semibold">Issued</th>
                <th className="px-3 py-2 font-semibold">Paid</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => {
                const dv = dvMap.get(v.draw_vendor_id);
                const vendor = vendorMap.get(v.vendor_id || dv?.vendor_id);
                return (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{v.voucher_number || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{vendor?.name || "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(v.amount)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(v.issue_date)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(v.payment_date)}</td>
                    <td className="px-3 py-2"><StatusBadge status={v.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <VoucherFormDialog open={dialogOpen} onOpenChange={setDialogOpen} drawId={drawId} />
    </div>
  );
}