import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const UNCATEGORIZED = "__none__";

// Category editing is limited to the project's own Schedule of Values so the
// ledger can never drift into categories the budget does not contain.
export default function EditableCategory({ categoryId, categoryName, categories = [], onSave, className }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Select
        defaultOpen
        value={categoryId || UNCATEGORIZED}
        onValueChange={(value) => {
          setEditing(false);
          if ((value || UNCATEGORIZED) === (categoryId || UNCATEGORIZED)) return;
          onSave(value === UNCATEGORIZED ? "" : value);
        }}
        open
        onOpenChange={(o) => { if (!o) setEditing(false); }}
      >
        <SelectTrigger className="h-7 text-xs w-[190px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={UNCATEGORIZED}>Uncategorized</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
        !categoryId && "text-amber-700",
        className,
      )}
      title="Select a budget category for this project"
    >
      <span>{categoryId ? categoryName : "Uncategorized"}</span>
      <Pencil className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
    </button>
  );
}