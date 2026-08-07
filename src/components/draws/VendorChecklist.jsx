import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, FileText, StickyNote, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import AddVendorDialog from "./AddVendorDialog";
import AddInvoiceDialog from "./AddInvoiceDialog";
import InvoiceStatusCell from "./InvoiceStatusCell";
import EditableAmount from "./EditableAmount";
import DocumentStatusCell from "./DocumentStatusCell";
import GenerateLienReleasesDialog from "./GenerateLienReleasesDialog";
const DV_STATUSES = ["pending", "documents_requested", "documents_received", "under_review", "complete"];

export default function VendorChecklist({ drawId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [genVendor, setGenVendor] = useState({ name: "", amount: null });
  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false);
  const [addInvoiceDVId, setAddInvoiceDVId] = useState(null);
  const queryClient = useQueryClient();

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
  const { data: drawCycle } = useQuery({
    queryKey: ["drawCycle", drawId],
    queryFn: () => base44.entities.DrawCycle.get(drawId),
  });

  const vendorMap = new Map(vendors.map((v) => [v.id, v]));
  const dvIds = new Set(drawVendors.map((dv) => dv.id));
  const docsByDV = allDocs
    .filter((d) => dvIds.has(d.draw_vendor_id))
    .reduce((acc, doc) => {
      const entry = acc[doc.draw_vendor_id] || { invoices: [], conditionalByInvoice: {}, conditionalLegacy: [], unconditional: null };
      if (doc.document_type === "invoice" || doc.document_type === "receipt") {
        entry.invoices.push(doc);
      } else if (doc.document_type === "conditional_lien_release") {
        if (doc.related_invoice_document_id) entry.conditionalByInvoice[doc.related_invoice_document_id] = doc;
        else entry.conditionalLegacy.push(doc);
      } else if (doc.document_type === "unconditional_lien_release") {
        entry.unconditional = doc;
      }
      acc[doc.draw_vendor_id] = entry;
      return acc;
    }, {});

  const renderConditionalCells = (docs) => {
    const invoices = docs?.invoices || [];
    if (invoices.length === 0) {
      const legacy = docs?.conditionalLegacy?.[0];
      return legacy ? <DocumentStatusCell doc={legacy} drawId={drawId} /> : <span className="text-xs text-slate-300">—</span>;
    }
    return (
      <div className="flex flex-col gap-0.5">
        {invoices.map((inv) => (
          <DocumentStatusCell key={inv.id} doc={docs.conditionalByInvoice?.[inv.id]} drawId={drawId} />
        ))}
      </div>
    );
  };

  const invoiceTotalByDV = drawVendors.reduce((acc, dv) => {
    const invoices = docsByDV[dv.id]?.invoices || [];
    acc[dv.id] = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    return acc;
  }, {});

  // Auto-sync DrawVendor amount to match invoice total
  useEffect(() => {
    drawVendors.forEach((dv) => {
      const computed = invoiceTotalByDV[dv.id];
      if (computed != null && dv.amount !== computed) {
        base44.entities.DrawVendor.update(dv.id, { amount: computed });
      }
    });
  }, [invoiceTotalByDV]);

  // Backfill a "missing" conditional lien release for any invoice lacking one
  useEffect(() => {
    const missing = [];
    drawVendors.forEach((dv) => {
      const docs = docsByDV[dv.id];
      if (!docs) return;
      (docs.invoices || []).forEach((inv) => {
        if (!docs.conditionalByInvoice?.[inv.id]) {
          missing.push({ draw_vendor_id: dv.id, related_invoice_document_id: inv.id });
        }
      });
    });
    if (missing.length === 0) return;
    base44.entities.Document.bulkCreate(
      missing.map((m) => ({
        draw_vendor_id: m.draw_vendor_id,
        document_type: "conditional_lien_release",
        status: "missing",
        related_invoice_document_id: m.related_invoice_document_id,
      }))
    ).then(() => queryClient.invalidateQueries({ queryKey: ["documents"] }));
  }, [drawVendors, allDocs]);

  const handleDVStatusChange = async (dvId, status) => {
    await base44.entities.DrawVendor.update(dvId, { status });
    queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
  };

  const handleInvoiceAmountChange = async (doc, amount) => {
    await base44.entities.Document.update(doc.id, { amount });
    queryClient.invalidateQueries({ queryKey: ["documents"] });

    // Sync the linked Open Item title so the displayed amount stays in step
    const linkedItems = await base44.entities.OpenItem.filter({ document_id: doc.id });
    const active = linkedItems.filter((i) => i.status === "open" || i.status === "in_progress");
    const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
    await Promise.all(
      active.map((item) => {
        const base = (item.title || "").replace(/\s—\s.*$/, "").trim();
        return base44.entities.OpenItem.update(item.id, { title: `${base} — ${formatted}` });
      })
    );
    queryClient.invalidateQueries({ queryKey: ["openItems", drawId] });
  };

  const handleRemoveVendor = async (dvId) => {
    await base44.entities.OpenItem.deleteMany({ draw_vendor_id: dvId });
    await base44.entities.Document.deleteMany({ draw_vendor_id: dvId });
    await base44.entities.DrawVendor.delete(dvId);
    queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["openItems", drawId] });
  };

  const openGenerateDialog = (vendorName, amount) => {
    setGenVendor({ name: vendorName, amount });
    setGenDialogOpen(true);
  };

  const openAddInvoice = (dvId) => {
    setAddInvoiceDVId(dvId);
    setAddInvoiceOpen(true);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Vendor Checklist</h2>
          <p className="text-sm text-slate-500">Document collection status per vendor</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="shrink-0"><Plus className="w-4 h-4 mr-1" />Add Vendor</Button>
      </div>
      {drawVendors.length === 0 ? (
        <div className="text-center py-8 text-slate-400 border border-dashed rounded-lg">No vendors linked to this draw yet.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="overflow-x-auto -mx-2 hidden md:block">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-2 py-2 font-semibold">Vendor</th>
                  <th className="px-2 py-2 font-semibold">Budget Category</th>
                  <th className="px-2 py-2 font-semibold text-right">Amount</th>
                  <th className="px-2 py-2 font-semibold">Invoice / Receipt</th>
                  <th className="px-2 py-2 font-semibold">Conditional Release</th>
                  <th className="px-2 py-2 font-semibold">Unconditional Release</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {drawVendors.map((dv) => {
                  const vendor = vendorMap.get(dv.vendor_id);
                  const docs = docsByDV[dv.id] || {};
                  return (
                    <React.Fragment key={dv.id}>
                      <tr className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-2 py-2.5 font-medium text-slate-900 align-top">
                          {vendor?.name || "Unknown"}
                          {docs.invoices && docs.invoices.length > 0 && (
                            <div className="flex flex-col gap-0.5 mt-1">
                              {docs.invoices.map((inv, i) => (
                                <a
                                  key={inv.id}
                                  href={inv.file_url || "#"}
                                  target={inv.file_url ? "_blank" : undefined}
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 max-w-[180px] truncate"
                                  title={inv.file_url ? "View file" : "No file uploaded"}
                                >
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{inv.invoice_number ? `${inv.document_type === "receipt" ? "Receipt" : "Inv."} ${inv.invoice_number}` : (inv.notes || `${inv.document_type === "receipt" ? "Receipt" : "Inv"} ${i + 1}`)}</span>
                                </a>
                              ))}
                            </div>
                          )}
                          {dv.notes && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" className="text-xs font-normal text-slate-400 hover:text-slate-700 mt-0.5 max-w-[160px] truncate text-left flex items-center gap-1 cursor-pointer">
                                  <StickyNote className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{dv.notes}</span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 text-sm" side="top">
                                <p className="text-slate-700 whitespace-pre-wrap">{dv.notes}</p>
                              </PopoverContent>
                            </Popover>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-slate-600 max-w-[140px] truncate align-top">{dv.scope_of_work || "—"}</td>
                        <td className="px-2 py-2.5 text-right font-medium">
                          {docs.invoices && docs.invoices.length === 1 ? (
                            <EditableAmount
                              amount={invoiceTotalByDV[dv.id] || 0}
                              onSave={(val) => handleInvoiceAmountChange(docs.invoices[0], val)}
                              className="justify-end"
                            />
                          ) : (
                            <span>{formatCurrency(invoiceTotalByDV[dv.id] || 0)}</span>
                          )}
                        </td>
                        <td className="px-2 py-2"><InvoiceStatusCell invoices={docs.invoices || []} drawId={drawId} /></td>
                        <td className="px-2 py-2">{renderConditionalCells(docs)}</td>
                        <td className="px-2 py-2"><DocumentStatusCell doc={docs.unconditional} drawId={drawId} /></td>
                        <td className="px-2 py-2">
                          <Select value={dv.status} onValueChange={(v) => handleDVStatusChange(dv.id, v)}>
                            <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DV_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => openAddInvoice(dv.id)} title="Add invoices">
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => openGenerateDialog(vendor?.name || "Unknown", invoiceTotalByDV[dv.id] || 0)} title="Generate lien release forms">
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleRemoveVendor(dv.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {drawVendors.map((dv) => {
              const vendor = vendorMap.get(dv.vendor_id);
              const docs = docsByDV[dv.id] || {};
              return (
                <div key={dv.id} className="border rounded-lg p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{vendor?.name || "Unknown"}</div>
                      <div className="text-xs text-slate-500 truncate">{dv.scope_of_work || "—"}</div>
                      {docs.invoices && docs.invoices.length > 0 && (
                        <div className="flex flex-col gap-0.5 mt-1">
                          {docs.invoices.map((inv, i) => (
                            <a
                              key={inv.id}
                              href={inv.file_url || "#"}
                              target={inv.file_url ? "_blank" : undefined}
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 max-w-[180px] truncate"
                              title={inv.file_url ? "View file" : "No file uploaded"}
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate">{inv.invoice_number ? `${inv.document_type === "receipt" ? "Receipt" : "Inv."} ${inv.invoice_number}` : (inv.notes || `${inv.document_type === "receipt" ? "Receipt" : "Inv"} ${i + 1}`)}</span>
                            </a>
                          ))}
                        </div>
                      )}
                      {dv.notes && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className="text-xs text-slate-400 hover:text-slate-700 italic truncate mt-0.5 flex items-center gap-1 text-left w-full">
                              <StickyNote className="w-3 h-3 shrink-0" />
                              <span className="truncate">{dv.notes}</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 text-sm">
                            <p className="text-slate-700 whitespace-pre-wrap">{dv.notes}</p>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    <div className="font-medium text-sm shrink-0">
                      {docs.invoices && docs.invoices.length === 1 ? (
                        <EditableAmount
                          amount={invoiceTotalByDV[dv.id] || 0}
                          onSave={(val) => handleInvoiceAmountChange(docs.invoices[0], val)}
                        />
                      ) : (
                        <span>{formatCurrency(invoiceTotalByDV[dv.id] || 0)}</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 shrink-0">Invoice</span>
                      <div className="flex-1 min-w-0"><InvoiceStatusCell invoices={docs.invoices || []} drawId={drawId} /></div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 shrink-0">Cond. Release</span>
                      <div className="flex-1 min-w-0">{renderConditionalCells(docs)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 shrink-0">Uncond. Release</span>
                      <div className="flex-1 min-w-0"><DocumentStatusCell doc={docs.unconditional} drawId={drawId} /></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t">
                    <Select value={dv.status} onValueChange={(v) => handleDVStatusChange(dv.id, v)}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DV_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-700" onClick={() => openAddInvoice(dv.id)} title="Add invoices">
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-700" onClick={() => openGenerateDialog(vendor?.name || "Unknown", invoiceTotalByDV[dv.id] || 0)} title="Generate lien release forms">
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleRemoveVendor(dv.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <AddVendorDialog open={dialogOpen} onOpenChange={setDialogOpen} drawId={drawId} clientId={drawCycle?.client_id} />
      <AddInvoiceDialog open={addInvoiceOpen} onOpenChange={setAddInvoiceOpen} drawVendorId={addInvoiceDVId} drawId={drawId} />
      <GenerateLienReleasesDialog
        open={genDialogOpen}
        onOpenChange={setGenDialogOpen}
        vendorName={genVendor.name}
        projectName={drawCycle?.project_name || ""}
        drawAmount={genVendor.amount}
      />
    </div>
  );
}