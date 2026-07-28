import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function EditableAmount({ amount, onSave, className, title = "Click to edit amount" }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(amount != null ? String(amount) : "");

  const handleSave = () => {
    setEditing(false);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed !== amount) {
      onSave(parsed);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="0.01"
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setEditing(false);
            setValue(amount != null ? String(amount) : "");
          }
        }}
        className="h-7 w-28 rounded border border-input bg-transparent px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className={cn(
        "inline-flex items-center gap-1 text-right font-medium rounded px-1.5 py-0.5 hover:underline hover:decoration-dotted cursor-text",
        className
      )}
      title={title}
    >
      {formatCurrency(amount)}
      <Pencil className="w-3 h-3 text-slate-400" />
    </button>
  );
}