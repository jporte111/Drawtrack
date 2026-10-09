import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";
import { EXTRACTION_SCHEMA } from "./InvoiceItem";

export default function AttachInvoiceFileDialog({ open, onOpenChange, invoice, vendorName }) {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !invoice?.id) return;
    setUploading(true);
    setError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      let patch = { file_url, status: "complete" };
      try {
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: EXTRACTION_SCHEMA,
        });
        if (result.status === "success" && result.output) {
          setExtracted(result.output);
          if (result.output.amount != null) patch.amount = result.output.amount;
          if (result.output.invoice_number) patch.invoice_number = result.output.invoice_number;
        }
      } catch {
        /* keep file even if extraction fails */
      }
      await base44.entities.Document.update(invoice.id, patch);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (o) => {
    if (!o) {
      setError("");
      setExtracted(null);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add invoice file{vendorName ? ` - ${vendorName}` : ""}</DialogTitle>
        </DialogHeader>
        {uploading ? (
          <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading and extracting...
          </div>
        ) : (
          <div className="space-y-3">
            <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Choose file (PDF, PNG, JPG)
            </Button>
            <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFile} />
            {extracted && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-md p-2 space-y-1">
                <div className="text-emerald-600 font-medium">Extracted details:</div>
                {extracted.amount != null && <div>Amount: ${Number(extracted.amount).toFixed(2)}</div>}
                {extracted.invoice_number && <div>Invoice #: {extracted.invoice_number}</div>}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Amount (optional override)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Leave empty to use extracted amount"
                value={extracted?.amount ?? ""}
                onChange={(e) => setExtracted((prev) => ({ ...(prev || {}), amount: parseFloat(e.target.value) || null }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                type="button"
                disabled={!extracted}
                onClick={async () => {
                  const patch = {};
                  if (extracted?.amount != null) patch.amount = extracted.amount;
                  if (Object.keys(patch).length > 0) {
                    await base44.entities.Document.update(invoice.id, patch);
                    queryClient.invalidateQueries({ queryKey: ["documents"] });
                  }
                  handleClose(false);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}