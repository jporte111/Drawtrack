import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ExternalLink, Plus, Sparkles, Trash2 } from "lucide-react";
import ConditionalLienDialog from "./ConditionalLienDialog";
import UnconditionalLienDialog from "./UnconditionalLienDialog";
import QboTrackingCell from "./QboTrackingCell";

const REVIEW_OPTIONS = ["needs_review", "approved", "needs_correction"];
const reviewBadge = {
  approved: "bg-emerald-100 text-emerald-700",
  needs_review: "bg-amber-100 text-amber-700",
  needs_correction: "bg-red-100 text-red-700",
};

const toneClass = {
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  green: "bg-emerald-100 text-emerald-700",
  slate: "bg-slate-100 text-slate-500",
};
const dotClass = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  slate: "bg-slate-400",
};

function computeStatus(line) {
  if (!line.hasInvoice) {
    if (line.recipient === "vendor") return { label: "Missing Invoice", tone: "red" };
    return { label: "Complete", tone: "green" };
  }
  const inv = line.invoice;
  if (!inv.file_url) return { label: "Missing Invoice", tone: "red" };
  if (inv.review_status === "needs_correction") return { label: "Needs Correction", tone: "red" };
  if (inv.review_status === "needs_review") return { label: "Needs Review", tone: "amber" };
  if (!line.cond?.file_url) return { label: "Missing Conditional", tone: "amber" };
  return { label: "Complete", tone: "green" };
}

export default function DocStatusButton({ line, projectName, onAddInvoice, onSuggestCategory }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  const [uncondOpen, setUncondOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const status = computeStatus(line);
  const interactive = line.hasInvoice || line.recipient === "vendor";

  const updateDoc = async (docId, patch) => {
    await base44.entities.Document.update(docId, patch);
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete this ${line.docKind || "invoice"}${line.invoiceNumber ? ` (${line.invoiceNumber})` : ""}? This removes the entire vendor row from this draw, including any other invoices for it. This cannot be undone.`)) return;
    // Remove the invoice, its vendor's other attached documents, and the whole row
    const docs = await base44.entities.Document.filter({ draw_vendor_id: line.drawVendorId });
    for (const d of docs.items) {
      await base44.entities.Document.delete(d.id);
    }
    await base44.entities.DrawVendor.delete(line.drawVendorId);
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["drawVendors"] });
  };

  const handleSuggest = async () => {
    if (!onSuggestCategory) return;
    setSuggesting(true);
    setOpen(false);
    try {
      await onSuggestCategory(line);
    } finally {
      setSuggesting(false);
    }
  };

  if (!interactive) {
    return (
      <span className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium ${toneClass[status.tone]}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass[status.tone]}`} />
        {status.label}
      </span>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition hover:opacity-80 ${toneClass[status.tone]}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass[status.tone]}`} />
            {status.label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Document Requirements</div>

            <ReqRow ok={!!line.invoice?.file_url} label="Invoice file">
              {line.invoice?.file_url ? (
                <a href={line.invoice.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Open
                </a>
              ) : line.hasInvoice ? (
                <span className="text-xs text-slate-400">Missing file</span>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setOpen(false); onAddInvoice(line.drawVendorId); }}>
                  <Plus className="w-3 h-3 mr-1" /> Add Invoice
                </Button>
              )}
            </ReqRow>

            {line.hasInvoice && (
              <ReqRow ok={!!line.cond?.file_url} label="Conditional lien release">
                {line.cond?.file_url ? (
                  <a href={line.cond.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Open
                  </a>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setOpen(false); setCondOpen(true); }}>Add</Button>
                )}
              </ReqRow>
            )}

            {line.hasInvoice && line.clientVendorId && (
              <ReqRow ok={!!line.uncond?.file_url} label="Unconditional lien release">
                {line.uncond?.file_url ? (
                  <a href={line.uncond.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Open
                  </a>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setOpen(false); setUncondOpen(true); }}>Add</Button>
                )}
              </ReqRow>
            )}

            {line.hasInvoice && (
              <ReqRow ok={line.invoice?.review_status === "approved"} label="Review status">
                <Select value={line.invoice?.review_status || "approved"} onValueChange={(v) => updateDoc(line.invoice.id, { review_status: v })}>
                  <SelectTrigger className={`h-7 text-xs w-32 border-0 ${reviewBadge[line.invoice?.review_status] || reviewBadge.approved}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REVIEW_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </ReqRow>
            )}

            {line.hasInvoice && (
              <ReqRow ok={line.invoice?.qbo_status === "entered"} label="QBO entry">
                <QboTrackingCell doc={line.invoice} onUpdate={updateDoc} />
              </ReqRow>
            )}

            {line.hasInvoice && (
              <div className="pt-1 border-t">
                <Button size="sm" variant="ghost" className="h-7 text-xs w-full justify-start" onClick={() => { setOpen(false); onAddInvoice(line.drawVendorId); }}>
                  <Plus className="w-3 h-3 mr-1" /> Add another invoice to {line.vendorName}
                </Button>
              </div>
            )}
            {line.hasInvoice && line.invoice?.file_url && (
              <div className="pt-1 border-t">
                <Button size="sm" variant="ghost" className="h-7 text-xs w-full justify-start" onClick={handleSuggest} disabled={suggesting}>
                  <Sparkles className="w-3 h-3 mr-1" /> {suggesting ? "Suggesting..." : "Suggest category from invoice"}
                </Button>
              </div>
            )}
            {line.hasInvoice && (
              <div className="pt-1 border-t">
                <Button size="sm" variant="ghost" className="h-7 text-xs w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
                  <Trash2 className="w-3 h-3 mr-1" /> Delete {line.docKind || "Invoice"}
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {condOpen && (
        <ConditionalLienDialog
          open
          onOpenChange={(o) => !o && setCondOpen(false)}
          drawVendorId={line.drawVendorId}
          invoiceId={line.invoice?.id}
          existingDocId={line.cond?.id}
          vendorName={line.vendorName}
          projectName={projectName}
          drawAmount={line.vendorTotal}
        />
      )}
      {uncondOpen && (
        <UnconditionalLienDialog
          open
          onOpenChange={(o) => !o && setUncondOpen(false)}
          clientVendorId={line.clientVendorId}
          vendorName={line.vendorName}
          projectName={projectName}
          drawAmount={line.vendorTotal}
        />
      )}
    </>
  );
}

function ReqRow({ ok, label, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
        <span className="text-xs text-slate-700 truncate">{label}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}