import React, { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

// Lets a vendor name be typed straight into a ledger row when it is unknown ("Unassigned").
export default function EditableVendorName({ name, onSave, className }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const doneRef = useRef(false);

  const start = () => {
    doneRef.current = false;
    setValue(name === "Unassigned" ? "" : name || "");
    setEditing(true);
  };

  const commit = async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const text = value.trim();
    setEditing(false);
    if (!text || text === name) return;
    await onSave(text);
  };

  if (editing) {
    return (
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
        onBlur={commit}
        placeholder="Vendor name"
        className="h-7 text-xs w-[190px]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        start();
      }}
      className={cn(
        "inline-flex items-center gap-1 text-left rounded hover:underline hover:decoration-dotted",
        (!name || name === "Unassigned") && "text-amber-700",
        className,
      )}
      title="Click to name this vendor"
    >
      <span>{name || "Unassigned"}</span>
      <Pencil className="w-3 h-3 text-slate-400 shrink-0" />
    </button>
  );
}