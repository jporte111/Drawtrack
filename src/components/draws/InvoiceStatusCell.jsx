import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import DocumentStatusCell from "./DocumentStatusCell";

export default function InvoiceStatusCell({ invoices, drawId }) {
  const [open, setOpen] = useState(false);

  if (!invoices || invoices.length === 0) {
    return <span className="text-xs text-slate-300">—</span>;
  }

  if (invoices.length === 1) {
    return <DocumentStatusCell doc={invoices[0]} drawId={drawId} />;
  }

  const completeCount = invoices.filter((d) => d.status === "complete" || d.status === "na").length;
  const total = invoices.reduce((sum, d) => sum + (d.amount || 0), 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-input bg-transparent text-xs hover:bg-accent transition-colors w-full justify-between"
      >
        <span>{invoices.length} invoices</span>
        <span className="text-slate-400">{completeCount}/{invoices.length}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invoices ({formatCurrency(total)})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {invoices.map((inv, i) => (
              <div key={inv.id} className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-600 shrink-0 w-20">Invoice {i + 1}</span>
                {inv.amount != null && <span className="text-xs text-slate-500 shrink-0">{formatCurrency(inv.amount)}</span>}
                <div className="flex-1 min-w-0"><DocumentStatusCell doc={inv} drawId={drawId} /></div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}