import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EditableCategory({ categoryId, categoryName, categories = [], onSave, className }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(categoryId ? categoryName || "" : "");

  const start = () => {
    setValue(categoryId ? categoryName || "" : "");
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const next = value.trim();
    if (next === ((categoryId && categoryName) || "")) return;
    onSave(next);
  };

  const cancel = () => {
    setEditing(false);
    setValue(categoryId ? categoryName || "" : "");
  };

  if (editing) {
    return (
      <>
        <input
          autoFocus
          list="category-options"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          placeholder="Type a category"
          className="h-7 w-[170px] rounded border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <datalist id="category-options">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        start();
      }}
      className={cn(
        "inline-flex items-start gap-1 text-left rounded px-1.5 py-0.5 hover:underline hover:decoration-dotted",
        className
      )}
      title="Click to type a category"
    >
      <span>{categoryId ? categoryName : "Uncategorized"}</span>
      <Pencil className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
    </button>
  );
}