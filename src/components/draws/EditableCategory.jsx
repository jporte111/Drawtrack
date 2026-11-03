import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const UNCATEGORIZED = "__none__";

export default function EditableCategory({ categoryId, categoryName, categories = [], onSave, className }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Select
        defaultOpen
        value={categoryId || UNCATEGORIZED}
        onValueChange={(v) => {
          setEditing(false);
          const next = v === UNCATEGORIZED ? null : v;
          if (next !== (categoryId || null)) onSave(next);
        }}
        onOpenChange={(open) => {
          if (!open) setEditing(false);
        }}
      >
        <SelectTrigger className="h-7 text-xs w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNCATEGORIZED}>Uncategorized</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className={cn(
        "inline-flex items-start gap-1 text-left rounded px-1.5 py-0.5 hover:underline hover:decoration-dotted",
        className
      )}
      title="Click to change category"
    >
      <span>{categoryName || "Uncategorized"}</span>
      <Pencil className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
    </button>
  );
}