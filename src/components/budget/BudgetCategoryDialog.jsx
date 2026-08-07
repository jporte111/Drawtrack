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

export default function BudgetCategoryDialog({ open, onOpenChange, budgetId, clientId, category, nextSort }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", original_budget: "", revised_budget: "", sort_order: 0, notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: category?.name || "",
        original_budget: category?.original_budget ?? "",
        revised_budget: category?.revised_budget ?? "",
        sort_order: category?.sort_order ?? nextSort ?? 0,
        notes: category?.notes || "",
      });
    }
  }, [open, category, nextSort]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        original_budget: form.original_budget === "" ? null : Number(form.original_budget),
        revised_budget: form.revised_budget === "" ? null : Number(form.revised_budget),
        sort_order: Number(form.sort_order) || 0,
      };
      if (category?.id) {
        await base44.entities.BudgetCategory.update(category.id, payload);
      } else {
        await base44.entities.BudgetCategory.create({ ...payload, budget_id: budgetId, client_id: clientId, status: "active" });
      }
      queryClient.invalidateQueries({ queryKey: ["budgetCategories", budgetId] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{category ? "Edit Budget Category" : "New Budget Category"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Roofing"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Original Budget ($)</Label>
              <Input
                type="number" step="0.01"
                value={form.original_budget}
                onChange={(e) => setForm({ ...form, original_budget: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Revised Budget ($)</Label>
              <Input
                type="number" step="0.01"
                value={form.revised_budget}
                onChange={(e) => setForm({ ...form, revised_budget: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Sort Order</Label>
            <Input
              type="number" step="1"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
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