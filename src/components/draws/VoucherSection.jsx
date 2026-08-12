import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Upload, FileText } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import VoucherFormDialog from "./VoucherFormDialog";
import VoucherUploadDialog from "./VoucherUploadDialog";

export default function VoucherSection({ drawId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Vouchers</h2>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}><Upload className="w-4 h-4 mr-1" />Upload PDF</Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-1" />Add Voucher</Button>
        </div>
      </div>
      {vouchers.length === 0 ? (
        <div className="text-center py-6 text-slate-400 border border-dashed rounded-lg">No vouchers for this draw.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="overflow-x-auto hidden md:block">
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
                      <td className="px-3 py-2 font-medium">
                        {v.file_url ? (
                          <a href={v.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                            <FileText className="w-3.5 h-3.5" />{v.voucher_number || "View PDF"}
                          </a>
                        ) : (v.voucher_number || "—")}
                      </td>
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

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {vouchers.map((v) => {
              const dv = dvMap.get(v.draw_vendor_id);
              const vendor = vendorMap.get(v.vendor_id || dv?.vendor_id);
              return (
                <div key={v.id} className="border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">
                        {v.file_url ? (
                          <a href={v.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                            <FileText className="w-3.5 h-3.5" />{v.voucher_number || "View PDF"}
                          </a>
                        ) : (v.voucher_number || "—")}
                      </div>
                      <div className="text-sm text-slate-600">{vendor?.name || "—"}</div>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Issued: {formatDate(v.issue_date)}</span>
                    <span className="font-medium text-slate-900">{formatCurrency(v.amount)}</span>
                  </div>
                  {v.payment_date && (
                    <div className="text-sm text-slate-500">Paid: {formatDate(v.payment_date)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <VoucherFormDialog open={dialogOpen} onOpenChange={setDialogOpen} drawId={drawId} />
      <VoucherUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} drawId={drawId} />
    </div>
  );
}