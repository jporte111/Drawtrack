import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, FileText, StickyNote } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import AddVendorDialog from "./AddVendorDialog";
import DocumentStatusCell from "./DocumentStatusCell";
import GenerateLienReleasesDialog from "./GenerateLienReleasesDialog";

const DV_STATUSES = ["pending", "documents_requested", "documents_received", "under_review", "complete"];

function EditableAmount({ dvId, amount, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(amount != null ? String(amount) : "");

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onSave(parseFloat(value) || 0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            onSave(parseFloat(value) || 0);
          }
          if (e.key === "Escape") {
            setEditing(false);
            setValue(amount != null ? String(amount) : "");
          }
        }}
        className="h-7 w-28 rounded border border-input bg-transparent px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-right font-medium w-full hover:bg-slate-100 rounded px-1 py-0.5 cursor-text"
    >
      {formatCurrency(amount)}
    </button>
  );
}

export default function VendorChecklist({ drawId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [genVendor, setGenVendor] = useState({ name: "", amount: null });
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
      if (!acc[doc.draw_vendor_id]) acc[doc.draw_vendor_id] = {};
      acc[doc.draw_vendor_id][doc.document_type] = doc;
      return acc;
    }, {});

  const handleDVStatusChange = async (dvId, status) => {
    await base44.entities.DrawVendor.update(dvId, { status });
    queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
  };

  const handleAmountChange = async (dvId, newAmount) => {
    await base44.entities.DrawVendor.update(dvId, { amount: newAmount });
    queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
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
                  <th className="px-2 py-2 font-semibold">Scope</th>
                  <th className="px-2 py-2 font-semibold text-right">Amount</th>
                  <th className="px-2 py-2 font-semibold">Invoice</th>
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
                    <tr key={dv.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-2 py-2.5 font-medium text-slate-900">
                        {vendor?.name || "Unknown"}
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
                      <td className="px-2 py-2.5 text-slate-600 max-w-[140px] truncate">{dv.scope_of_work || "—"}</td>
                      <td className="px-2 py-2.5 text-right">
                        <EditableAmount dvId={dv.id} amount={dv.amount} onSave={(amt) => handleAmountChange(dv.id, amt)} />
                      </td>
                      <td className="px-2 py-2"><DocumentStatusCell doc={docs.invoice} drawId={drawId} /></td>
                      <td className="px-2 py-2"><DocumentStatusCell doc={docs.conditional_lien_release} drawId={drawId} /></td>
                      <td className="px-2 py-2"><DocumentStatusCell doc={docs.unconditional_lien_release} drawId={drawId} /></td>
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
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => openGenerateDialog(vendor?.name || "Unknown", dv.amount)} title="Generate lien release forms">
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleRemoveVendor(dv.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
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
                      <EditableAmount dvId={dv.id} amount={dv.amount} onSave={(amt) => handleAmountChange(dv.id, amt)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 shrink-0">Invoice</span>
                      <div className="flex-1 min-w-0"><DocumentStatusCell doc={docs.invoice} drawId={drawId} /></div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 shrink-0">Cond. Release</span>
                      <div className="flex-1 min-w-0"><DocumentStatusCell doc={docs.conditional_lien_release} drawId={drawId} /></div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 shrink-0">Uncond. Release</span>
                      <div className="flex-1 min-w-0"><DocumentStatusCell doc={docs.unconditional_lien_release} drawId={drawId} /></div>
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
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-700" onClick={() => openGenerateDialog(vendor?.name || "Unknown", dv.amount)} title="Generate lien release forms">
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