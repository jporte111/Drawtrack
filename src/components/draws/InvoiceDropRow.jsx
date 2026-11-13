import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Loader2, X } from "lucide-react";
import VendorPicker from "./VendorPicker";

export default function InvoiceDropRow({ invoice, vendorOptions, onChange, onRemove }) {
  const update = (patch) => onChange({ ...invoice, ...patch });

  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-white p-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {invoice.uploading ? (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading {invoice.filename}…
            </span>
          ) : invoice.file_url ? (
            <a
              href={invoice.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink className="w-3 h-3 shrink-0" />
              <span className="truncate">{invoice.filename}</span>
            </a>
          ) : (
            <span className="text-xs text-slate-500">
              Manual entry{invoice.filename ? ` · ${invoice.filename}` : ""}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-slate-400 hover:text-red-600"
          onClick={onRemove}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      {invoice.error && <p className="text-xs text-red-600">{invoice.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <VendorPicker
          vendorId={invoice.vendor_id}
          vendorName={invoice.vendor_name}
          options={vendorOptions}
          needsReview={invoice.needsReview}
          onChange={(v) => update(v)}
        />
        <Select value={invoice.doc_type || "invoice"} onValueChange={(v) => update({ doc_type: v })}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="invoice">Invoice</SelectItem>
            <SelectItem value="receipt">Receipt</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          step="0.01"
          value={invoice.amount}
          onChange={(e) => update({ amount: e.target.value })}
          placeholder="Amount $"
          className="h-8 w-32"
        />
        <Input
          type="text"
          value={invoice.invoice_number || ""}
          onChange={(e) => update({ invoice_number: e.target.value })}
          placeholder="Inv. #"
          className="h-8 w-32"
        />
        <Input
          type="date"
          value={invoice.invoice_date || ""}
          onChange={(e) => update({ invoice_date: e.target.value })}
          title="Invoice date — read from the file, editable"
          className="h-8 w-36"
        />
      </div>
    </div>
  );
}