import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import DocumentStatusCell from "./DocumentStatusCell";

export default function InvoiceStatusCell({ invoices, drawId }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  if (!invoices || invoices.length === 0) {
    return <span className="text-xs text-slate-300">—</span>;
  }

  if (invoices.length === 1) {
    const doc = invoices[0];
    if (doc.document_type === "receipt") {
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-cyan-600 bg-cyan-100 px-1.5 py-0.5 rounded shrink-0">Receipt</span>
          <div className="flex-1 min-w-0"><DocumentStatusCell doc={doc} drawId={drawId} /></div>
        </div>
      );
    }
    return <DocumentStatusCell doc={doc} drawId={drawId} />;
  }

  const completeCount = invoices.filter((d) => d.status === "complete" || d.status === "na").length;
  const total = invoices.reduce((sum, d) => sum + (d.amount || 0), 0);
  const hasReceipt = invoices.some((d) => d.document_type === "receipt");
  const label = hasReceipt && invoices.every((d) => d.document_type === "receipt") ? "receipts" : "invoices";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-input bg-transparent text-xs hover:bg-accent transition-colors w-full justify-between"
      >
        <span>{invoices.length} {label}</span>
        <span className="text-slate-400">{completeCount}/{invoices.length}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{label.charAt(0).toUpperCase() + label.slice(1)} ({formatCurrency(total)})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {invoices.map((inv, i) => (
              <div key={inv.id} className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-600 shrink-0 w-20 capitalize">{inv.document_type || "invoice"} {i + 1}</span>
                {inv.amount != null && <span className="text-xs text-slate-500 shrink-0">{formatCurrency(inv.amount)}</span>}
                <div className="flex-1 min-w-0"><DocumentStatusCell doc={inv} drawId={drawId} /></div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-400 hover:text-red-600 shrink-0"
                  onClick={async () => {
                    try {
                      await base44.entities.Document.delete(inv.id);
                    } catch (_e) {
                      // Document may have already been deleted — refresh anyway
                    }
                    queryClient.invalidateQueries({ queryKey: ["documents"] });
                    queryClient.invalidateQueries({ queryKey: ["openItems", drawId] });
                  }}
                  title="Delete invoice"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}