import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DRAW_STATUSES = ["in_progress", "submitted", "under_review", "funded", "closed"];

export default function DrawFormDialog({ open, onOpenChange, draw, clientId, showLenderFields = true }) {
  const isEdit = !!draw;
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", project_name: "", status: "in_progress", draw_date: "", amount: "", description: "", lender_current_payment_due: "", application_cert_url: "", continuation_sheet_url: "" });

  useEffect(() => {
    if (draw) {
      setForm({
        name: draw.name || "",
        project_name: draw.project_name || "",
        status: draw.status && draw.status !== "draft" ? draw.status : "in_progress",
        draw_date: draw.draw_date ? draw.draw_date.split("T")[0] : "",
        amount: draw.amount ?? "",
        description: draw.description || "",
        lender_current_payment_due: draw.lender_current_payment_due ?? "",
        application_cert_url: draw.application_cert_url || "",
        continuation_sheet_url: draw.continuation_sheet_url || "",
      });
    } else {
      setForm({ name: "", project_name: "", status: "in_progress", draw_date: "", amount: "", description: "", lender_current_payment_due: "", application_cert_url: "", continuation_sheet_url: "" });
    }
  }, [draw, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, amount: form.amount ? Number(form.amount) : null, lender_current_payment_due: form.lender_current_payment_due ? Number(form.lender_current_payment_due) : null };
    try {
      if (isEdit) {
        await base44.entities.DrawCycle.update(draw.id, payload);
        queryClient.invalidateQueries({ queryKey: ["draw", draw.id] });
      } else {
        await base44.entities.DrawCycle.create({ ...payload, client_id: clientId });
      }
      queryClient.invalidateQueries({ queryKey: ["draws"] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Draw" : "New Draw Cycle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Draw Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Draw #3" required />
          </div>
          <div className="space-y-1.5">
            <Label>Project Name</Label>
            <Input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DRAW_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Draw Date</Label>
              <Input type="date" value={form.draw_date} onChange={(e) => setForm({ ...form, draw_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Amount ($)</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className={`border-t pt-4 space-y-4 ${showLenderFields ? "" : "hidden"}`}>
            <div className="space-y-1.5">
              <Label>Lender Current Payment Due ($)</Label>
              <Input type="number" value={form.lender_current_payment_due} onChange={(e) => setForm({ ...form, lender_current_payment_due: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Application Cert URL (AIA G702) <span className="text-slate-400 font-normal">optional</span></Label>
              <Input value={form.application_cert_url} onChange={(e) => setForm({ ...form, application_cert_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label>Continuation Sheet URL (AIA G703) <span className="text-slate-400 font-normal">optional</span></Label>
              <Input value={form.continuation_sheet_url} onChange={(e) => setForm({ ...form, continuation_sheet_url: e.target.value })} placeholder="https://..." />
            </div>
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