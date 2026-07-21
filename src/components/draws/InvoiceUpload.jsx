import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, CheckCircle } from "lucide-react";

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    vendor_name: { type: "string", description: "Name of the vendor/company issuing the invoice" },
    amount: { type: "number", description: "Total invoice amount in dollars" },
    scope_of_work: { type: "string", description: "Description of work or services provided" },
    contact_name: { type: "string", description: "Contact person name if available" },
    email: { type: "string", description: "Vendor email if available" },
    phone: { type: "string", description: "Vendor phone if available" },
    address: { type: "string", description: "Vendor address if available" },
    tax_id: { type: "string", description: "Vendor tax ID if available" },
  },
  required: ["vendor_name", "amount"],
};

export default function InvoiceUpload({ onExtracted }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setFileName(file.name);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: EXTRACTION_SCHEMA,
      });
      if (result.status === "success" && result.output) {
        onExtracted({ ...result.output, invoice_file_url: file_url });
      } else {
        setError("Could not extract data from this file.");
      }
    } catch (err) {
      setError(err.message || "Failed to process invoice.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>Upload Invoice (optional — auto-fills the form)</Label>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Extracting...</> : <><Upload className="w-3.5 h-3.5 mr-1.5" />Upload Invoice</>}
        </Button>
        <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFile} />
        {fileName && !uploading && !error && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> {fileName}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}