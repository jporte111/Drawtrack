import React from "react";
import { FileText, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import DocumentStatusCell from "./DocumentStatusCell";

export default function VendorLineItems({ invoices, drawId }) {
  const queryClient = useQueryClient();

  if (!invoices || invoices.length === 0) {
    return <p className="text-xs text-slate-400 italic px-2 py-1">No invoices or receipts yet.</p>;
  }

  const handleDelete = async (id) => {
    try {
      await base44.entities.Document.delete(id);
    } catch (_e) {
      // may already be deleted
    }
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["openItems", drawId] });
  };

  return (
    <div className="space-y-1.5">
      {invoices.map((inv, i) => {
        const isReceipt = inv.document_type === "receipt";
        return (
          <div key={inv.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-slate-50 border border-slate-100">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${isReceipt ? "bg-cyan-100 text-cyan-700" : "bg-red-100 text-red-700"}`}>
              {isReceipt ? "Receipt" : "Invoice"} {invoices.length > 1 ? i + 1 : ""}
            </span>
            {inv.amount != null && (
              <span className="text-xs font-medium text-slate-700 shrink-0">{formatCurrency(inv.amount)}</span>
            )}
            {inv.file_url && (
              <a href={inv.file_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-700 shrink-0" title="View file">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {inv.notes && <span className="text-xs text-slate-400 truncate flex-1">{inv.notes}</span>}
            <div className="flex-1 min-w-0 max-w-[180px] ml-auto">
              <DocumentStatusCell doc={inv} drawId={drawId} />
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-400 hover:text-red-600 shrink-0"
              onClick={() => handleDelete(inv.id)}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}