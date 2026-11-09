import React, { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Category editing: pick one of the project's budget categories, or type a new
// name — the parent adds it to the project's budget and assigns it here.
export default function EditableCategory({ categoryId, categoryName, categories = [], onSave, onCreate, className }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const doneRef = useRef(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    return categories
      .filter((c) => c.status !== "archived")
      .filter((c) => !q || (c.name || "").toLowerCase().includes(q));
  }, [categories, value]);

  const exact = categories.find(
    (c) => (c.name || "").trim().toLowerCase() === value.trim().toLowerCase(),
  );
  const canCreate = value.trim().length > 0 && !exact;

  const start = () => {
    doneRef.current = false;
    setValue(categoryId ? categoryName || "" : "");
    setEditing(true);
  };

  const commit = async (next) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const text = (next ?? value).trim();
    setEditing(false);
    if (!text) {
      if (categoryId) await onSave("");
      return;
    }
    if (exact) {
      if (exact.id !== categoryId) await onSave(exact.id);
      return;
    }
    if (categoryId && text === (categoryName || "").trim()) return;
    if (onCreate) await onCreate(text);
  };

  const clear = async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setEditing(false);
    if (categoryId) await onSave("");
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
          placeholder="Type or pick a category"
          className="h-7 text-xs w-[190px]"
        />
        <div className="absolute left-0 top-full z-50 mt-1 w-[190px] max-h-56 overflow-auto rounded-md border bg-popover p-1 shadow-md">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs text-slate-500 hover:bg-accent"
          >
            Uncategorized
          </button>
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(c.name)}
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent",
                c.id === categoryId ? "font-semibold text-slate-900" : "text-slate-700",
              )}
            >
              {c.name}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(value)}
              className="flex w-full items-center gap-1 rounded-sm px-2 py-1.5 text-left text-xs font-medium text-blue-600 hover:bg-accent"
            >
              <Plus className="w-3 h-3 shrink-0" /> Add "{value.trim()}" to budget
            </button>
          )}
          {matches.length === 0 && !canCreate && (
            <div className="px-2 py-1.5 text-xs text-slate-400">No categories yet</div>
          )}
        </div>
      </div>
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
        !categoryId && "text-amber-700",
        className,
      )}
      title="Pick a budget category or type a new one"
    >
      <span>{categoryId ? categoryName : "Uncategorized"}</span>
      <Pencil className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
    </button>
  );
}