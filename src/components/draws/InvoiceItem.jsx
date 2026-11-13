import React, { useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, CheckCircle, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizeInvoiceDate } from "@/lib/invoiceDate";

export const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    vendor_name: { type: "string", description: "Name of the vendor/company that issued this invoice or receipt" },
    invoice_number: { type: "string", description: "Invoice or receipt number printed on the document" },
    invoice_date: { type: "string", description: "The invoice date printed on the document, formatted YYYY-MM-DD" },
    amount: { type: "number", description: "Total amount in dollars" },
    scope_of_work: { type: "string", description: "Description of work, services, or items provided" },
    contact_name: { type: "string", description: "Contact person name if available" },
    email: { type: "string", description: "Vendor email if available" },
    phone: { type: "string", description: "Vendor phone if available" },
    address: { type: "string", description: "Vendor address if available" },
    tax_id: { type: "string", description: "Vendor tax ID if available" },
  },
  required: ["vendor_name", "amount"],
};

export default function InvoiceItem({ invoice, onChange, onRemove, onExtracted }) {
  const inputRef = useRef(null);

  const update = (patch) => onChange({ ...invoice, ...patch });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    update({ uploading: true, filename: file.name, error: "" });
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: EXTRACTION_SCHEMA,
      });
      if (result.status === "success" && result.output) {
        update({
          file_url,
          filename: file.name,
          uploading: false,
          amount: result.output.amount != null ? String(result.output.amount) : invoice.amount,
          invoice_number: result.output.invoice_number || invoice.invoice_number || "",
          invoice_date:
            normalizeInvoiceDate(result.output.invoice_date) || invoice.invoice_date || "",
          extractedData: result.output,
        });
        if (onExtracted) onExtracted(result.output);
      } else {
        update({ uploading: false, file_url, filename: file.name });
        if (onExtracted) onExtracted({});
      }
    } catch (err) {
      update({ uploading: false, error: err.message || "Failed to process invoice." });
    }
  };

  return (
    <div className="border rounded-md p-3 space-y-2 bg-slate-50/50">
      <div className="flex items-center gap-2">
        {invoice.file_url ? (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium flex-1 min-w-0">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{invoice.filename}</span>
          </span>
        ) : invoice.uploading ? (
          <span className="flex items-center gap-1 text-xs text-slate-500 flex-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting...
          </span>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="flex-1">
            <Upload className="w-3.5 h-3.5 mr-1.5" />Upload {(invoice.doc_type || "invoice").charAt(0).toUpperCase() + (invoice.doc_type || "invoice").slice(1)}
          </Button>
        )}
        <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFile} />
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-slate-400 hover:text-red-600" onClick={onRemove}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      {invoice.error && <p className="text-xs text-red-600">{invoice.error}</p>}
      <div className="flex items-center gap-2">
        <Select
          value={invoice.doc_type || "invoice"}
          onValueChange={(v) => update({ doc_type: v })}
        >
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="invoice">Invoice</SelectItem>
            <SelectItem value="receipt">Receipt</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-500 w-16 shrink-0">Amount $</span>
        <Input
          type="number"
          step="0.01"
          value={invoice.amount}
          onChange={(e) => update({ amount: e.target.value })}
          placeholder="0.00"
          className="h-8 w-40"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 w-16 shrink-0">Inv. #</span>
        <Input
          type="text"
          value={invoice.invoice_number || ""}
          onChange={(e) => update({ invoice_number: e.target.value })}
          placeholder="Auto-detected from file"
          className="h-8 flex-1"
        />
      </div>
    </div>
  );
}