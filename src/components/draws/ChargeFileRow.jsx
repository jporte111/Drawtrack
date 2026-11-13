import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, X, ExternalLink } from "lucide-react";
import VendorPicker from "./VendorPicker";

// One uploaded invoice inside the Add Invoice form.
export default function ChargeFileRow({ item, vendorOptions, onChange, onRemove }) {
  const update = (patch) => onChange({ ...item, ...patch });

  return (
    <div className="space-y-1.5 rounded-md border border-slate-200 bg-white p-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {item.uploading ? (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading {item.filename}…
            </span>
          ) : item.file_url ? (
            <a
              href={item.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.filename}</span>
            </a>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-slate-400 hover:text-red-600"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {item.error && <p className="text-xs text-red-600">{item.error}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <VendorPicker
          vendorId={item.vendor_id}
          vendorName={item.vendor_name}
          options={vendorOptions}
          needsReview={item.needsReview}
          onChange={update}
        />
        <Input
          type="number"
          step="0.01"
          value={item.amount}
          onChange={(e) => update({ amount: e.target.value })}
          placeholder="Amount $"
          className="h-8 w-28 text-right tabular-nums"
        />
        <Input
          value={item.invoice_number || ""}
          onChange={(e) => update({ invoice_number: e.target.value })}
          placeholder="Inv. #"
          className="h-8 w-24"
        />
        <Input
          type="date"
          value={item.invoice_date || ""}
          onChange={(e) => update({ invoice_date: e.target.value })}
          title="Invoice date — read from the file, editable"
          className="h-8 w-36"
        />
      </div>
    </div>
  );
}