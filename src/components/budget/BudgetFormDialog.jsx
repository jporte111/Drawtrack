import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BUDGET_TYPES = [
  { value: "internal", label: "Internal" },
  { value: "lender", label: "Lender" },
  { value: "other", label: "Other" },
];

export default function BudgetFormDialog({ open, onOpenChange, clientId, budget }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", budget_type: "internal", source_url: "", notes: "" });

  useEffect(() => {
    if (open) {
      setForm({
        name: budget?.name || "",
        budget_type: budget?.budget_type || "internal",
        source_url: budget?.source_url || "",
        notes: budget?.notes || "",
      });
    }
  }, [open, budget]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (budget?.id) {
        await base44.entities.Budget.update(budget.id, form);
      } else {
        await base44.entities.Budget.create({ ...form, client_id: clientId, status: "active" });
      }
      queryClient.invalidateQueries({ queryKey: ["budgets", clientId] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{budget ? "Edit Budget" : "New Budget"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Budget Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. JLM Internal Budget"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Budget Type</Label>
            <Select value={form.budget_type} onValueChange={(v) => setForm({ ...form, budget_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUDGET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Source URL (optional reference, e.g. Dropbox)</Label>
            <Input
              value={form.source_url}
              onChange={(e) => setForm({ ...form, source_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}