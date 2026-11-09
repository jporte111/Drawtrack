import React, { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

// Multi-file drop area: dropped files are uploaded and read one by one.
export default function InvoiceDropZone({ onFiles, busy }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => /\.(pdf|png|jpe?g)$/i.test(f.name));
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
        over ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-slate-50 hover:border-slate-400",
      )}
    >
      <UploadCloud className="w-5 h-5 text-slate-500" />
      <p className="text-sm font-medium text-slate-700">Drag and drop invoices here</p>
      <p className="text-xs text-slate-500">
        Drop several at once, or click to browse. PDF, PNG, JPG{busy ? " · processing…" : ""}
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}