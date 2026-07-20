import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AddVendorDialog({ open, onOpenChange, drawId }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vendor_id: "", scope_of_work: "", amount: "", notes: "" });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
  });
  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendors", drawId],
    queryFn: () => base44.entities.DrawVendor.filter({ draw_cycle_id: drawId }),
  });

  const linkedIds = new Set(drawVendors.map((dv) => dv.vendor_id));
  const availableVendors = vendors.filter((v) => !linkedIds.has(v.id));

  useEffect(() => {
    if (open) setForm({ vendor_id: "", scope_of_work: "", amount: "", notes: "" });
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dv = await base44.entities.DrawVendor.create({
        draw_cycle_id: drawId,
        vendor_id: form.vendor_id,
        scope_of_work: form.scope_of_work,
        amount: form.amount ? Number(form.amount) : null,
        notes: form.notes,
        status: "pending",
      });
      await base44.entities.Document.bulkCreate([
        { draw_vendor_id: dv.id, document_type: "invoice", status: "not_requested" },
        { draw_vendor_id: dv.id, document_type: "conditional_lien_release", status: "not_requested" },
        { draw_vendor_id: dv.id, document_type: "unconditional_lien_release", status: "not_requested" },
      ]);
      queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Vendor to Draw</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
              <SelectContent>
                {availableVendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {availableVendors.length === 0 && (
              <p className="text-xs text-amber-600">All vendors are already linked to this draw.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Scope of Work</Label>
            <Input value={form.scope_of_work} onChange={(e) => setForm({ ...form, scope_of_work: e.target.value })} placeholder="e.g., Foundation pour" />
          </div>
          <div className="space-y-1.5">
            <Label>Amount ($)</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.vendor_id}>{saving ? "Adding..." : "Add Vendor"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}