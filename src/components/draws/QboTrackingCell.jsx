import React, { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";

const QBO_OPTIONS = ["not_entered", "entered", "needs_review"];
const qboBadge = {
  not_entered: "bg-slate-100 text-slate-500",
  entered: "bg-emerald-100 text-emerald-700",
  needs_review: "bg-amber-100 text-amber-700",
};

export default function QboTrackingCell({ doc, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ qbo_status: "not_entered", qbo_bill_id: "", qbo_entry_date: "", qbo_notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        qbo_status: doc.qbo_status || "not_entered",
        qbo_bill_id: doc.qbo_bill_id || "",
        qbo_entry_date: doc.qbo_entry_date || "",
        qbo_notes: doc.qbo_notes || "",
      });
    }
  }, [doc, open]);

  const handleSave = async () => {
    setSaving(true);
    const patch = { ...form };
    if (form.qbo_status === "entered" && !form.qbo_entry_date) {
      patch.qbo_entry_date = new Date().toISOString().split("T")[0];
    }
    try {
      await onUpdate(doc.id, patch);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const label = (form.qbo_status || "not_entered").replace(/_/g, " ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium hover:opacity-80 transition ${qboBadge[form.qbo_status] || qboBadge.not_entered}`}
        >
          {label}
          <Settings2 className="w-3 h-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">QBO Tracking</div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bill Status</Label>
            <Select value={form.qbo_status} onValueChange={(v) => setForm((f) => ({ ...f, qbo_status: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {QBO_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">QBO Bill ID</Label>
            <Input value={form.qbo_bill_id} onChange={(e) => setForm((f) => ({ ...f, qbo_bill_id: e.target.value }))} placeholder="e.g., Bill-1234" className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Entry Date</Label>
            <Input type="date" value={form.qbo_entry_date || ""} onChange={(e) => setForm((f) => ({ ...f, qbo_entry_date: e.target.value }))} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.qbo_notes} onChange={(e) => setForm((f) => ({ ...f, qbo_notes: e.target.value }))} rows={2} className="text-xs" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}