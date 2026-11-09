import React, { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Vendor for one invoice: pick a known vendor, or type a new name.
export default function VendorPicker({ vendorId, vendorName, options = [], needsReview, onChange }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const doneRef = useRef(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    return options.filter((o) => !q || o.name.toLowerCase().includes(q)).slice(0, 8);
  }, [options, value]);
  const exact = options.find((o) => o.name.trim().toLowerCase() === value.trim().toLowerCase());

  const start = () => {
    doneRef.current = false;
    setValue(vendorName || "");
    setEditing(true);
  };

  const commit = (next) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const text = (next ?? value).trim();
    setEditing(false);
    if (!text) {
      onChange({ vendor_id: null, vendor_name: "", needsReview: true });
      return;
    }
    const opt = options.find((o) => o.name.trim().toLowerCase() === text.toLowerCase());
    onChange(
      opt
        ? { vendor_id: opt.id, vendor_name: opt.name, needsReview: false }
        : { vendor_id: null, vendor_name: text, needsReview: false },
    );
  };

  if (editing) {
    return (
      <div className="relative">
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              doneRef.current = true;
              setEditing(false);
            }
          }}
          onBlur={() => commit()}
          placeholder="Vendor name"
          className="h-8 w-[210px] text-xs"
        />
        <div className="absolute left-0 top-full z-50 mt-1 w-[210px] max-h-52 overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {matches.map((o) => (
            <button
              key={o.id || `name:${o.name}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(o.name)}
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent",
                o.id && o.id === vendorId ? "font-semibold text-slate-900" : "text-slate-700",
              )}
            >
              {o.name}
            </button>
          ))}
          {!exact && value.trim() && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(value)}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs font-medium text-blue-600 hover:bg-accent"
            >
              Use "{value.trim()}"
            </button>
          )}
          {matches.length === 0 && !value.trim() && (
            <div className="px-2 py-1.5 text-xs text-slate-400">No vendors yet</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      className={cn(
        "inline-flex h-8 max-w-[210px] items-center gap-1.5 rounded-md border px-2 text-xs",
        vendorName ? "border-slate-200 bg-white text-slate-800" : "border-amber-300 bg-amber-50 text-amber-800",
      )}
      title="Choose or type the vendor"
    >
      <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
      <span className="truncate">{vendorName || "Choose vendor"}</span>
      {needsReview && <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
    </button>
  );
}