import React, { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

// Click-to-edit text or date, used anywhere a value should be typed over in place.
export default function EditableText({
  value,
  onSave,
  type = "text",
  placeholder = "Add",
  display,
  className,
  inputClassName,
  title = "Click to edit",
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const doneRef = useRef(false);

  const start = () => {
    doneRef.current = false;
    setDraft(value ? String(value).slice(0, type === "date" ? 10 : undefined) : "");
    setEditing(true);
  };

  const commit = async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const next = draft.trim();
    setEditing(false);
    if (next === (value || "")) return;
    await onSave(next || null);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
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
        className={cn("h-7 text-xs w-[150px]", inputClassName)}
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
        !value && "text-slate-400",
        className,
      )}
      title={title}
    >
      <span>{display ? display(value) : value || placeholder}</span>
      <Pencil className="w-3 h-3 text-slate-400 shrink-0" />
    </button>
  );
}