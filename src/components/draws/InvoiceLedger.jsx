import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, FileText } from "lucide-react";
import QboTrackingCell from "./QboTrackingCell";
import UnconditionalLienDialog from "./UnconditionalLienDialog";
import ConditionalLienDialog from "./ConditionalLienDialog";
import { formatCurrency, formatDate } from "@/lib/format";

const REVIEW_OPTIONS = ["needs_review", "approved", "needs_correction"];

const reviewBadge = {
  approved: "bg-emerald-100 text-emerald-700",
  needs_review: "bg-amber-100 text-amber-700",
  needs_correction: "bg-red-100 text-red-700",
};

export default function InvoiceLedger({ drawId }) {
  const queryClient = useQueryClient();
  const [uncondTarget, setUncondTarget] = useState(null);
  const [condTarget, setCondTarget] = useState(null);

  const { data: drawCycle } = useQuery({
    queryKey: ["drawCycle", drawId],
    queryFn: () => base44.entities.DrawCycle.get(drawId),
  });
  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendors", drawId],
    queryFn: () => base44.entities.DrawVendor.filter({ draw_cycle_id: drawId }),
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
  });
  const { data: allDocs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => base44.entities.Document.list(),
  });
  const { data: budgetCategories = [] } = useQuery({
    queryKey: ["budgetCategories", drawCycle?.client_id],
    queryFn: () => base44.entities.BudgetCategory.filter({ client_id: drawCycle.client_id }),
    enabled: !!drawCycle?.client_id,
  });
  const { data: clientVendors = [] } = useQuery({
    queryKey: ["clientVendors", drawCycle?.client_id],
    queryFn: () => base44.entities.ClientVendor.filter({ client_id: drawCycle.client_id }),
    enabled: !!drawCycle?.client_id,
  });

  const derived = useMemo(() => {
    const vendorMap = new Map(vendors.map((v) => [v.id, v]));
    const catMap = new Map(budgetCategories.map((c) => [c.id, c]));
    const cvByVendor = new Map(clientVendors.map((cv) => [cv.vendor_id, cv.id]));
    const dvIds = new Set(drawVendors.map((dv) => dv.id));
    const dvById = new Map(drawVendors.map((dv) => [dv.id, dv]));

    // Invoices + lien releases for this draw's draw vendors
    const drawDocs = allDocs.filter((d) => dvIds.has(d.draw_vendor_id));
    const invoices = drawDocs.filter(
      (d) => d.document_type === "invoice" || d.document_type === "receipt"
    );
    // Conditional: tied to invoice via related_invoice_document_id, else per draw vendor
    const condByInvoice = {};
    const condByDV = {};
    for (const d of drawDocs) {
      if (d.document_type === "conditional_lien_release") {
        if (d.related_invoice_document_id) condByInvoice[d.related_invoice_document_id] = d;
        else condByDV[d.draw_vendor_id] = d;
      }
    }
    // Unconditional: per vendor-per-client (keyed by client_vendor_id)
    const uncondByCV = {};
    for (const d of allDocs) {
      if (d.document_type === "unconditional_lien_release" && d.client_vendor_id) {
        uncondByCV[d.client_vendor_id] = d;
      }
    }

    // Per-vendor invoice totals (for lien release amount)
    const vendorTotals = {};
    for (const inv of invoices) {
      const vid = dvById.get(inv.draw_vendor_id)?.vendor_id;
      if (vid) vendorTotals[vid] = (vendorTotals[vid] || 0) + (inv.amount || 0);
    }

    // Group invoices by budget category
    const groups = {};
    const uncategorized = { name: "Uncategorized", sortOrder: 9999, invoices: [] };
    for (const inv of invoices) {
      const dv = dvById.get(inv.draw_vendor_id);
      const catId = dv?.budget_category_id;
      const vendor = vendorMap.get(dv?.vendor_id);
      const cvId = cvByVendor.get(dv?.vendor_id);
      const row = {
        ...inv,
        vendorName: vendor?.name || "Unknown",
        clientVendorId: cvId,
        vendorTotal: vendorTotals[vendor?.id] || 0,
        cond: condByInvoice[inv.id] || condByDV[inv.draw_vendor_id],
        uncond: cvId ? uncondByCV[cvId] : undefined,
      };
      if (catId && catMap.has(catId)) {
        if (!groups[catId]) {
          const c = catMap.get(catId);
          groups[catId] = { name: c.name, sortOrder: c.sort_order || 0, invoices: [] };
        }
        groups[catId].invoices.push(row);
      } else {
        uncategorized.invoices.push(row);
      }
    }
    const groupList = Object.values(groups).sort((a, b) => a.sortOrder - b.sortOrder);
    if (uncategorized.invoices.length > 0) groupList.push(uncategorized);

    const grandTotal = invoices.reduce((s, inv) => s + (inv.amount || 0), 0);
    const approvedTotal = invoices
      .filter((i) => i.review_status === "approved")
      .reduce((s, inv) => s + (inv.amount || 0), 0);
    const enteredCount = invoices.filter((i) => i.qbo_status === "entered").length;

    return { groupList, grandTotal, approvedTotal, hasUncategorized: uncategorized.invoices.length > 0, invoiceCount: invoices.length, enteredCount };
  }, [drawVendors, vendors, allDocs, budgetCategories, clientVendors]);

  const { groupList, grandTotal, approvedTotal, hasUncategorized, invoiceCount, enteredCount } = derived;

  const updateDoc = async (docId, patch) => {
    await base44.entities.Document.update(docId, patch);
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const lienLabel = (doc) =>
    doc ? (
      <a
        href={doc.file_url || "#"}
        target={doc.file_url ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="text-emerald-600 font-medium hover:underline"
        title={doc.status?.replace(/_/g, " ")}
      >
        {doc.status === "complete" ? "✓ Signed" : doc.status?.replace(/_/g, " ").slice(0, 12) || "✓"}
      </a>
    ) : (
      <span className="text-slate-300">—</span>
    );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Invoice Ledger</h2>
          <p className="text-sm text-slate-500">Every invoice/receipt for this draw, grouped by budget category</p>
        </div>
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{formatCurrency(grandTotal)}</span> total
          {" · "}
          <span className="text-emerald-600">{formatCurrency(approvedTotal)} approved</span>
          {" · "}
          <span className="text-slate-500">QBO {enteredCount}/{invoiceCount} entered</span>
        </div>
      </div>

      {groupList.length === 0 ? (
        <div className="text-center py-10 text-slate-400 border border-dashed rounded-lg">
          <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          No invoices uploaded for this draw yet.
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-2.5 font-semibold">Vendor / Invoice</th>
                <th className="px-3 py-2.5 font-semibold text-right">Amount</th>
                <th className="px-3 py-2.5 font-semibold">Review</th>
                <th className="px-3 py-2.5 font-semibold">QBO</th>
                <th className="px-3 py-2.5 font-semibold">Lien Release</th>
                <th className="px-3 py-2.5 font-semibold">Received</th>
              </tr>
            </thead>
            <tbody>
              {groupList.map((group) => {
                const subtotal = group.invoices.reduce((s, inv) => s + (inv.amount || 0), 0);
                return (
                  <React.Fragment key={group.name}>
                    <tr className="bg-slate-100/70 border-b">
                      <td colSpan={6} className="px-3 py-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold uppercase tracking-wide ${hasUncategorized && group.name === "Uncategorized" ? "text-amber-700" : "text-slate-600"}`}>
                            {group.name}
                          </span>
                          <span className="text-xs text-slate-500">Subtotal: <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span></span>
                        </div>
                      </td>
                    </tr>
                    {group.invoices.map((inv) => (
                      <tr key={inv.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-900">{inv.vendorName}</div>
                          <a
                            href={inv.file_url || "#"}
                            target={inv.file_url ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 text-xs mt-0.5 ${inv.file_url ? "text-blue-600 hover:underline" : "text-slate-400"}`}
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            {inv.document_type === "receipt" ? "Receipt" : "Inv"}
                            {inv.invoice_number ? ` ${inv.invoice_number}` : ""}
                            {inv.invoice_date ? ` · ${formatDate(inv.invoice_date)}` : ""}
                          </a>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-900">
                          {formatCurrency(inv.amount || 0)}
                        </td>
                        <td className="px-3 py-2.5">
                          <Select value={inv.review_status || "approved"} onValueChange={(v) => updateDoc(inv.id, { review_status: v })}>
                            <SelectTrigger className={`h-7 text-xs w-32 border-0 shadow-none focus:ring-1 font-medium ${reviewBadge[inv.review_status] || reviewBadge.approved}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {REVIEW_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2.5">
                          <QboTrackingCell doc={inv} onUpdate={updateDoc} />
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1">
                              <span className="text-slate-400 w-10">Cond</span>
                              {inv.cond
                                ? lienLabel(inv.cond)
                                : <button onClick={() => setCondTarget(inv)} className="text-blue-600 hover:underline">Add</button>}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="text-slate-400 w-10">Uncond</span>
                              {inv.uncond
                                ? lienLabel(inv.uncond)
                                : inv.clientVendorId
                                  ? <button onClick={() => setUncondTarget(inv)} className="text-blue-600 hover:underline">Add</button>
                                  : <span className="text-slate-300" title="No client-vendor link">—</span>}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">
                          {inv.received_date ? formatDate(inv.received_date) : "—"}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-slate-100 font-semibold">
                <td className="px-3 py-3 text-slate-900">Grand Total</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-900">{formatCurrency(grandTotal)}</td>
                <td colSpan={4} className="px-3 py-3 text-xs font-normal text-slate-500">
                  {formatCurrency(approvedTotal)} approved · {formatCurrency(grandTotal - approvedTotal)} pending review
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {uncondTarget && (
        <UnconditionalLienDialog
          open
          onOpenChange={(o) => !o && setUncondTarget(null)}
          clientVendorId={uncondTarget.clientVendorId}
          vendorName={uncondTarget.vendorName}
          projectName={drawCycle?.project_name}
          drawAmount={uncondTarget.vendorTotal}
        />
      )}
      {condTarget && (
        <ConditionalLienDialog
          open
          onOpenChange={(o) => !o && setCondTarget(null)}
          drawVendorId={condTarget.draw_vendor_id}
          invoiceId={condTarget.id}
          existingDocId={condTarget.cond?.id}
          vendorName={condTarget.vendorName}
          projectName={drawCycle?.project_name}
          drawAmount={condTarget.vendorTotal}
        />
      )}
    </div>
  );
}